#!/usr/bin/env tsx
/**
 * BuyerRecon Golden Session v0.1 — internal orchestration entrypoint.
 *
 * Runs the merged AMS cmd/buyerrecon-report surface ONCE in its deterministic
 * JSON mode for one explicit browser subject and pinned bounds, validates the
 * authoritative AMS golden JSON, reads the backend persisted evidence for
 * exactly one explicit backend session, and writes one internal JSON artifact
 * plus one internal Markdown artifact.
 *
 * INTERNAL ONLY. No customer delivery, no external API, no worker execution,
 * no database write (SELECT-only reads through the existing app pool), no
 * output-flag change. AMS is invoked as a fixed executable via execFile (no
 * shell) with allowlisted, validated arguments, bounded stdout/stderr, and an
 * explicit timeout. AMS scoring is never duplicated: its JSON is the sole
 * authoritative scoring/policy input.
 *
 * The operator must provide BOTH identities explicitly (no guessing, no
 * derivation): the backend session identity and the AMS browser-subject
 * identity. session_level_isolation=false is recorded in every artifact.
 *
 * Two mutually exclusive AMS input modes:
 *
 *   fresh_ams     (historical, unchanged) runs the AMS binary once itself.
 *   existing_run  consumes an ALREADY produced canonical AMS golden JSON and
 *                 reconciles it against the persisted authoritative run. AMS
 *                 is NEVER executed in this mode: the resolved existing_run
 *                 input carries no binary path at all.
 *
 * Usage, fresh_ams:
 *   tsx scripts/run-golden-session.ts \
 *     --workspace <workspace_id> --site <site_id> --session <session_id> \
 *     --subject <ams_browser_subject_id> --start YYYY-MM-DD --end YYYY-MM-DD \
 *     --ams-bin /abs/path/to/buyerrecon-report --ams-db-url postgres://... \
 *     [--project <project_id>] [--output <dir>]
 *
 * Usage, existing_run (no AMS execution, no --ams-bin, no --ams-db-url):
 *   tsx scripts/run-golden-session.ts \
 *     --workspace <workspace_id> --site <site_id> --session <session_id> \
 *     --subject <ams_browser_subject_id> --start YYYY-MM-DD --end YYYY-MM-DD \
 *     --ams-golden-json /abs/path/to/<site>_<start>_<end>_golden.json \
 *     --ams-run-id <uuid> --ams-final-decision <CANONICAL_DECISION> \
 *     [--project <project_id>] [--output <dir>]
 *
 * Backend DB: the existing src/db/client pool (its own allowlisted env read).
 * Failures are reported with finite safe stage labels only — never raw child
 * stderr, database errors, SQL, connection details, or row contents.
 */

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import pool from '../src/db/client.js';
import {
  buildGoldenSessionPackage,
  renderGoldenSessionMarkdown,
  serializeGoldenSessionPackage,
  validateAmsGoldenSessionJson,
} from '../src/reports/external/golden-session-package.js';
import {
  readSessionPersistedRows,
  type BackendSessionIdentity,
} from '../src/reports/external/session-evidence-atoms.js';
import {
  AMS_EXISTING_RUN_FLAGS,
  readPersistedAmsRunRows,
  reconcilePersistedAmsRun,
  resolveAmsInputMode,
  type AmsInputMode,
  type AmsRunVerificationFlags,
} from '../src/reports/external/ams-existing-run.js';

const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

const AMS_TIMEOUT_MS = 180_000;
const AMS_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

type FailureStage =
  | 'input_invalid'
  | 'ams_executable_unavailable'
  | 'ams_execution_failed'
  | 'ams_output_invalid'
  | 'ams_identity_mismatch'
  | 'ams_run_reconciliation_failed'
  | 'evidence_read_failed'
  | 'evidence_mapping_failed'
  | 'report_build_failed'
  | 'artifact_write_failed';

function failStage(stage: FailureStage, detail?: string): never {
  // Safe, stage-specific summary only. Raw diagnostics are intentionally withheld.
  process.stderr.write(`run-golden-session FAILED stage=${stage}${detail !== undefined ? ` (${detail})` : ''}\n`);
  process.exit(1);
}

interface CliArgs {
  workspace: string;
  project: string;
  site: string;
  session: string;
  subject: string;
  start: string;
  end: string;
  /** Discriminated AMS input. The existing_run variant has no binary path. */
  amsInput: AmsInputMode;
  output: string;
}

const FLAGS = new Set<string>([
  '--workspace', '--project', '--site', '--session', '--subject',
  '--start', '--end', '--ams-bin', '--ams-db-url', '--output',
  ...AMS_EXISTING_RUN_FLAGS,
]);

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === undefined || FLAGS.has(flag) === false) failStage('input_invalid', `unknown_flag_${String(flag)}`);
    if (value === undefined || value.startsWith('--')) failStage('input_invalid', `missing_value_for_${flag}`);
    if (values.has(flag)) failStage('input_invalid', `duplicate_flag_${flag}`);
    values.set(flag, value);
  }

  const required = (flag: string, pattern: RegExp, label: string): string => {
    const value = values.get(flag);
    if (value === undefined || pattern.test(value) === false) failStage('input_invalid', label);
    return value;
  };

  const workspace = required('--workspace', SAFE_ID, 'workspace');
  const site = required('--site', SAFE_ID, 'site');
  const session = required('--session', SAFE_ID, 'session');
  const subject = required('--subject', SAFE_ID, 'subject');
  const start = required('--start', SAFE_DATE, 'start');
  const end = required('--end', SAFE_DATE, 'end');
  const amsResolution = resolveAmsInputMode(values);
  if (amsResolution.ok === false) failStage('input_invalid', amsResolution.reason);
  const amsInput = amsResolution.input;

  const project = values.get('--project') ?? 'golden-session-internal';
  if (SAFE_ID.test(project) === false) failStage('input_invalid', 'project');
  const output = values.get('--output') ?? join('reports', 'golden-session');

  if (start > end) failStage('input_invalid', 'start_after_end');

  return { workspace, project, site, session, subject, start, end, amsInput, output };
}

function runAmsOnce(
  args: CliArgs,
  fresh: Extract<AmsInputMode, { mode: 'fresh_ams' }>,
  amsOutputDir: string,
): Promise<void> {
  // Fixed command shape: fixed executable, allowlisted validated arguments,
  // no shell, bounded output, explicit timeout. Invoked exactly once per run.
  const amsArgs = [
    '-site', args.site,
    '-start', args.start,
    '-end', args.end,
    '-db-url', fresh.ams_db_url,
    '-output', amsOutputDir,
    '-subject', args.subject,
  ];
  return new Promise((resolve) => {
    execFile(
      fresh.ams_bin,
      amsArgs,
      { timeout: AMS_TIMEOUT_MS, maxBuffer: AMS_MAX_OUTPUT_BYTES, windowsHide: true },
      (error) => {
        if (error !== null) {
          const code = typeof (error as NodeJS.ErrnoException).code === 'string'
            ? (error as NodeJS.ErrnoException).code
            : undefined;
          if (code === 'ENOENT' || code === 'EACCES') failStage('ams_executable_unavailable');
          // Timeout, non-zero exit, or signal. Raw stderr is withheld by design.
          failStage('ams_execution_failed', `exit_${String((error as { code?: unknown }).code ?? 'unknown')}`);
        }
        resolve();
      },
    );
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const windowStart = `${args.start}T00:00:00Z`;
  const windowEnd = `${args.end}T23:59:59Z`;

  // Exactly one of the two AMS input modes runs. The existing_run branch has
  // no binary path in scope, so it cannot execute AMS even accidentally.
  let goldenRaw: string;
  if (args.amsInput.mode === 'fresh_ams') {
    const fresh = args.amsInput;
    if (existsSync(fresh.ams_bin) === false) failStage('ams_executable_unavailable');

    const amsOutputDir = join(args.output, 'ams');
    try {
      mkdirSync(amsOutputDir, { recursive: true });
    } catch {
      failStage('artifact_write_failed', 'output_directory');
    }

    await runAmsOnce(args, fresh, amsOutputDir);

    const goldenPath = join(amsOutputDir, `${args.site}_${args.start}_${args.end}_golden.json`);
    try {
      goldenRaw = readFileSync(goldenPath, 'utf8');
    } catch {
      failStage('ams_output_invalid', 'golden_json_not_produced');
    }
  } else {
    // existing_run: AMS is never invoked here. The already-produced canonical
    // golden JSON is read from an absolute operator-supplied path.
    const existing = args.amsInput;
    if (existsSync(existing.ams_golden_json_path) === false) {
      failStage('ams_output_invalid', 'golden_json_not_found');
    }
    try {
      goldenRaw = readFileSync(existing.ams_golden_json_path, 'utf8');
    } catch {
      failStage('ams_output_invalid', 'golden_json_unreadable');
    }
  }

  const validation = validateAmsGoldenSessionJson(goldenRaw, {
    site_id: args.site,
    subject_id: args.subject,
    window_start: windowStart,
    window_end: windowEnd,
  });
  if (validation.ok === false) failStage(validation.failure_stage, validation.reasons.join(','));

  const identity: BackendSessionIdentity = {
    workspace_id: args.workspace,
    project_id: args.project,
    site_id: args.site,
    session_id: args.session,
    window_start: windowStart,
    window_end: windowEnd,
  };

  let rows;
  let reconciliationFailure: string | undefined;
  let reconciliationFlags: AmsRunVerificationFlags | undefined;
  try {
    if (args.amsInput.mode === 'existing_run') {
      // Reconcile the supplied artifact against the persisted authoritative
      // run BEFORE any package is constructed. SELECT-only.
      const persisted = await readPersistedAmsRunRows(pool, args.amsInput.ams_run_id);
      const reconciliation = reconcilePersistedAmsRun(persisted, {
        ams_run_id: args.amsInput.ams_run_id,
        site_id: args.site,
        subject_id: args.subject,
        source_event_ids: validation.result.source_event_ids,
        artifact_final_decision: validation.result.authoritative_final_decision,
        expected_final_decision: args.amsInput.expected_final_decision,
        artifact_requested_action: validation.result.product_decision?.RequestedAction,
        // The canonical artifact carries no run id: its accepted top-level key
        // set is closed with no run-id member, and `scope` has no run-id field.
        // Read defensively anyway, so that if the canonical schema ever does
        // carry one, it is reconciled instead of silently ignored.
        artifact_run_id:
          typeof (validation.result as { run_id?: unknown }).run_id === 'string'
            ? (validation.result as { run_id: string }).run_id
            : undefined,
      });
      if (reconciliation.ok === false) reconciliationFailure = reconciliation.reasons.join(',');
      else reconciliationFlags = reconciliation.verification;
    }
    rows = await readSessionPersistedRows(pool, identity);
  } catch {
    failStage('evidence_read_failed');
  } finally {
    await pool.end().catch(() => undefined);
  }
  // Raised after the pool is closed so the failure stage is never masked by the
  // surrounding catch.
  if (reconciliationFailure !== undefined) {
    failStage('ams_run_reconciliation_failed', reconciliationFailure);
  }

  let pkg;
  try {
    pkg = buildGoldenSessionPackage({ backend_identity: identity, ams: validation.result, rows });
  } catch {
    failStage('report_build_failed');
  }

  let markdown: string;
  try {
    markdown = renderGoldenSessionMarkdown(pkg);
  } catch {
    failStage('report_build_failed', 'markdown');
  }

  const baseName = `golden-session_${args.site}_${args.session}_${args.start}_${args.end}`;
  const jsonPath = join(args.output, `${baseName}.json`);
  const markdownPath = join(args.output, `${baseName}.md`);
  try {
    writeFileSync(jsonPath, serializeGoldenSessionPackage(pkg), 'utf8');
    writeFileSync(markdownPath, markdown, 'utf8');
  } catch {
    failStage('artifact_write_failed');
  }

  const missing = pkg.stage_presence.filter((s) => s.present === false).map((s) => s.missing_label);
  process.stdout.write('run-golden-session OK (internal only, no delivery)\n');
  process.stdout.write(`  ams_input_mode=${args.amsInput.mode}\n`);
  process.stdout.write(`  ams_invoked=${String(args.amsInput.mode === 'fresh_ams')}\n`);
  if (args.amsInput.mode === 'existing_run') {
    process.stdout.write(`  ams_run_id=${args.amsInput.ams_run_id}\n`);
    // Four distinct facts, never collapsed into one "reconciled" claim. The
    // final decision is verified against the golden JSON, NOT against the
    // database: the canonical replay schema persists no decision field, so
    // `persisted_final_decision_verified` is structurally false and no
    // `persisted_final_decision=` value is ever emitted.
    process.stdout.write(
      `  persisted_provenance_verified=${String(reconciliationFlags?.persisted_provenance_verified === true)}\n`,
    );
    process.stdout.write(
      `  golden_json_decision_verified=${String(reconciliationFlags?.golden_json_decision_verified === true)}\n`,
    );
    process.stdout.write(`  persisted_final_decision_verified=false\n`);
    process.stdout.write(`  persisted_final_decision_unavailable_by_schema=true\n`);
  }
  process.stdout.write(`  ams_status=${pkg.ams_authoritative.status}\n`);
  process.stdout.write(`  authoritative_final_decision=${pkg.ams_authoritative.authoritative_final_decision}\n`);
  process.stdout.write(`  buyer_motion=${pkg.buyer_motion}\n`);
  process.stdout.write(`  recommended_operator_action=${pkg.recommended_operator_action}\n`);
  process.stdout.write(`  evidence_atoms=${pkg.evidence_atoms.length}\n`);
  process.stdout.write(`  missing_stages=${missing.length === 0 ? 'none' : missing.join(',')}\n`);
  process.stdout.write(`  json_artifact=${jsonPath}\n`);
  process.stdout.write(`  markdown_artifact=${markdownPath}\n`);
}

main().catch(() => failStage('report_build_failed', 'unexpected'));
