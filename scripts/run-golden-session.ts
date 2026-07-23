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
 * Usage (all values validated; every flag except --project/--output required):
 *   tsx scripts/run-golden-session.ts \
 *     --workspace <workspace_id> --site <site_id> --session <session_id> \
 *     --subject <ams_browser_subject_id> --start YYYY-MM-DD --end YYYY-MM-DD \
 *     --ams-bin /abs/path/to/buyerrecon-report --ams-db-url postgres://... \
 *     [--project <project_id>] [--output <dir>]
 *
 * Backend DB: the existing src/db/client pool (its own allowlisted env read).
 * Failures are reported with finite safe stage labels only — never raw child
 * stderr, database errors, SQL, connection details, or row contents.
 */

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

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

const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_DB_URL = /^postgres(ql)?:\/\//;

const AMS_TIMEOUT_MS = 180_000;
const AMS_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

type FailureStage =
  | 'input_invalid'
  | 'ams_executable_unavailable'
  | 'ams_execution_failed'
  | 'ams_output_invalid'
  | 'ams_identity_mismatch'
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
  amsBin: string;
  amsDbUrl: string;
  output: string;
}

const FLAGS = new Set([
  '--workspace', '--project', '--site', '--session', '--subject',
  '--start', '--end', '--ams-bin', '--ams-db-url', '--output',
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
  const amsDbUrl = required('--ams-db-url', SAFE_DB_URL, 'ams_db_url');

  const amsBin = values.get('--ams-bin');
  if (amsBin === undefined || isAbsolute(amsBin) === false) failStage('input_invalid', 'ams_bin_must_be_absolute');

  const project = values.get('--project') ?? 'golden-session-internal';
  if (SAFE_ID.test(project) === false) failStage('input_invalid', 'project');
  const output = values.get('--output') ?? join('reports', 'golden-session');

  if (start > end) failStage('input_invalid', 'start_after_end');

  return { workspace, project, site, session, subject, start, end, amsBin, amsDbUrl, output };
}

function runAmsOnce(args: CliArgs, amsOutputDir: string): Promise<void> {
  // Fixed command shape: fixed executable, allowlisted validated arguments,
  // no shell, bounded output, explicit timeout. Invoked exactly once per run.
  const amsArgs = [
    '-site', args.site,
    '-start', args.start,
    '-end', args.end,
    '-db-url', args.amsDbUrl,
    '-output', amsOutputDir,
    '-subject', args.subject,
  ];
  return new Promise((resolve) => {
    execFile(
      args.amsBin,
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

  if (existsSync(args.amsBin) === false) failStage('ams_executable_unavailable');

  const windowStart = `${args.start}T00:00:00Z`;
  const windowEnd = `${args.end}T23:59:59Z`;

  const amsOutputDir = join(args.output, 'ams');
  try {
    mkdirSync(amsOutputDir, { recursive: true });
  } catch {
    failStage('artifact_write_failed', 'output_directory');
  }

  await runAmsOnce(args, amsOutputDir);

  const goldenPath = join(amsOutputDir, `${args.site}_${args.start}_${args.end}_golden.json`);
  let goldenRaw: string;
  try {
    goldenRaw = readFileSync(goldenPath, 'utf8');
  } catch {
    failStage('ams_output_invalid', 'golden_json_not_produced');
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
  try {
    rows = await readSessionPersistedRows(pool, identity);
  } catch {
    failStage('evidence_read_failed');
  } finally {
    await pool.end().catch(() => undefined);
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
