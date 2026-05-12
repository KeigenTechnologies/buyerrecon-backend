/**
 * Sprint 2 PR#5 — Stage 0 RECORD_ONLY worker (DB-side).
 *
 * Pipeline:
 *   1. Call PR#4 `assertScoringContractsOrThrow()` — refuses to start
 *      if scoring/version.yml / dictionary / forbidden_codes.yml are
 *      malformed or if `status !== 'record_only'` /
 *      `automated_action_enabled !== false`.
 *   2. Call PR#4 `assertActiveScoringSourceCleanOrThrow()` —
 *      defence-in-depth source-code grep on `src/scoring/**`.
 *   3. Extract Stage0Input per candidate session via
 *      `extractStage0Inputs(pool, opts)` (reads accepted_events +
 *      ingest_requests via request_id correlation only).
 *   4. Evaluate each Stage0Input via `evaluateStage0Decision` (pure).
 *   5. Upsert rows into `stage0_decisions` under the 5-column natural
 *      key `(workspace_id, site_id, session_id, stage0_version,
 *      scoring_version)` — `ON CONFLICT DO UPDATE`.
 *
 * No `INSERT INTO scoring_output_lane_a` / `_b`. No reason_code
 * emission. No customer-facing output. No automated action.
 */

import pg from 'pg';
import { assertActiveScoringSourceCleanOrThrow, assertScoringContractsOrThrow } from '../contracts.js';
import { evaluateStage0Decision, STAGE0_VERSION_DEFAULT } from './evaluate-stage0.js';
import { extractStage0Inputs } from './extract-stage0-inputs.js';
import type { Stage0DecisionRow, Stage0RuleId } from './types.js';

export interface Stage0WorkerOptions {
  workspace_id:    string | null;
  site_id:         string | null;
  window_start:    Date;
  window_end:      Date;
  stage0_version:  string;
  /**
   * Optional override (defaults to the loaded scoring contracts'
   * `scoring_version`). Useful for tests that want a synthetic value.
   */
  scoring_version_override?: string;
  /** Repo root for the PR#4 contract loader (defaults to auto-detect). */
  rootDir?:        string;
}

export interface Stage0WorkerResult {
  upserted_rows:     number;
  excluded_rows:     number;
  non_excluded_rows: number;
  stage0_version:    string;
  scoring_version:   string;
  window_start:      Date;
  window_end:        Date;
}

/* --------------------------------------------------------------------------
 * UPSERT SQL — idempotent under the 5-column natural key.
 *
 * Per OD-10: re-running under the same (workspace_id, site_id,
 * session_id, stage0_version, scoring_version) refreshes the same
 * row; any version change produces a NEW row (replay/provenance
 * preserved).
 *
 * Forbidden columns NOT written: verification_score, evidence_band,
 * action_recommendation, reason_codes (none exist on the table).
 * ------------------------------------------------------------------------ */

const UPSERT_SQL = `
INSERT INTO stage0_decisions (
  workspace_id,
  site_id,
  session_id,
  stage0_version,
  scoring_version,
  excluded,
  rule_id,
  rule_inputs,
  evidence_refs,
  record_only,
  source_event_count
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, TRUE, $10
)
ON CONFLICT (workspace_id, site_id, session_id, stage0_version, scoring_version)
DO UPDATE SET
  excluded           = EXCLUDED.excluded,
  rule_id            = EXCLUDED.rule_id,
  rule_inputs        = EXCLUDED.rule_inputs,
  evidence_refs      = EXCLUDED.evidence_refs,
  source_event_count = EXCLUDED.source_event_count,
  updated_at         = now()
RETURNING stage0_decision_id, excluded, rule_id
`;

export async function runStage0Worker(
  pool: pg.Pool | pg.PoolClient | pg.Client,
  opts: Stage0WorkerOptions,
): Promise<Stage0WorkerResult> {
  // §1–§2 — PR#4 startup guards.
  const contracts = assertScoringContractsOrThrow({ rootDir: opts.rootDir });
  assertActiveScoringSourceCleanOrThrow({ rootDir: opts.rootDir });

  const scoring_version = opts.scoring_version_override ?? contracts.version.scoring_version;
  const stage0_version  = opts.stage0_version;

  // §3 — extract.
  const inputs = await extractStage0Inputs(pool, {
    workspace_id: opts.workspace_id,
    site_id:      opts.site_id,
    window_start: opts.window_start,
    window_end:   opts.window_end,
  });

  // §4–§5 — evaluate + upsert. One row per candidate session.
  let upserted = 0;
  let excluded_rows = 0;
  for (const input of inputs) {
    const decision = evaluateStage0Decision(input);
    const row: Stage0DecisionRow = {
      workspace_id:        input.workspaceId,
      site_id:             input.siteId,
      session_id:          input.sessionId,
      stage0_version,
      scoring_version,
      excluded:            decision.excluded,
      rule_id:             decision.ruleId,
      rule_inputs:         decision.ruleInputs,
      evidence_refs:       decision.evidenceRefs,
      record_only:         true,
      source_event_count:  input.sourceEventCount,
    };
    await pool.query<{ stage0_decision_id: string; excluded: boolean; rule_id: Stage0RuleId }>(
      UPSERT_SQL,
      [
        row.workspace_id,
        row.site_id,
        row.session_id,
        row.stage0_version,
        row.scoring_version,
        row.excluded,
        row.rule_id,
        JSON.stringify(row.rule_inputs),
        JSON.stringify(row.evidence_refs),
        row.source_event_count,
      ],
    );
    upserted++;
    if (row.excluded) excluded_rows++;
  }

  return {
    upserted_rows:     upserted,
    excluded_rows,
    non_excluded_rows: upserted - excluded_rows,
    stage0_version,
    scoring_version,
    window_start:      opts.window_start,
    window_end:        opts.window_end,
  };
}

/* --------------------------------------------------------------------------
 * Env-var parsing helper for the CLI runner.
 * ------------------------------------------------------------------------ */

export interface Stage0WorkerEnvOpts {
  databaseUrl:   string;
  options:       Stage0WorkerOptions;
}

const DEFAULT_SINCE_HOURS = 168;

export function parseStage0EnvOptions(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Stage0WorkerEnvOpts {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('Sprint 2 PR#5 stage0 worker — DATABASE_URL is required');
  }

  const workspace_id = typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
    ? env.WORKSPACE_ID : null;
  const site_id = typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
    ? env.SITE_ID : null;

  let window_end: Date;
  if (typeof env.UNTIL === 'string' && env.UNTIL.length > 0) {
    const u = Date.parse(env.UNTIL);
    if (!Number.isFinite(u)) {
      throw new Error(`UNTIL is not a parseable timestamp: ${JSON.stringify(env.UNTIL)}`);
    }
    window_end = new Date(u);
  } else {
    window_end = now;
  }

  let window_start: Date;
  if (typeof env.SINCE === 'string' && env.SINCE.length > 0) {
    const s = Date.parse(env.SINCE);
    if (!Number.isFinite(s)) {
      throw new Error(`SINCE is not a parseable timestamp: ${JSON.stringify(env.SINCE)}`);
    }
    window_start = new Date(s);
  } else {
    const rawHours = env.SINCE_HOURS ?? String(DEFAULT_SINCE_HOURS);
    const hours = Number.parseInt(rawHours, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error(`SINCE_HOURS must be a positive integer (got ${JSON.stringify(rawHours)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }
  if (window_start.getTime() >= window_end.getTime()) {
    throw new Error('window_start must be strictly before window_end');
  }

  const stage0_version = typeof env.STAGE0_VERSION === 'string' && env.STAGE0_VERSION.length > 0
    ? env.STAGE0_VERSION
    : STAGE0_VERSION_DEFAULT;

  return {
    databaseUrl,
    options: {
      workspace_id,
      site_id,
      window_start,
      window_end,
      stage0_version,
    },
  };
}
