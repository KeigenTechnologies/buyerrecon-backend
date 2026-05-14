/**
 * Sprint 2 PR#12d — POI Sequence Worker.
 *
 * Manual-CLI batch trigger. NO cron, NO queue, NO post-commit hook,
 * NO scheduler (per PR#12c OD-4).
 *
 * Pipeline:
 *   1. PR#4 contract guards (assertScoringContractsOrThrow +
 *      assertActiveScoringSourceCleanOrThrow).
 *   2. SELECT POI rows from `poi_observations_v0_1` (window-bounded).
 *   3. Group by (workspace_id, site_id, session_id) via observer mapper.
 *   4. For each session group:
 *      - buildDurableSequenceRecord  [throws on shape problems → reject]
 *      - buildUpsertParams           [defence-in-depth invariant check]
 *      - INSERT ... ON CONFLICT DO UPDATE
 *      - count inserted / updated
 *   5. Aggregate WorkerReport, return.
 *
 * Forbidden reads (enforced by query.ts + static-source sweep):
 *   accepted_events, rejected_events, ingest_requests,
 *   session_features, session_behavioural_features_v0_2,
 *   stage0_decisions, risk_observations_v0_1,
 *   scoring_output_lane_a, scoring_output_lane_b, site_write_tokens.
 *
 * Forbidden writes: any table other than `poi_sequence_observations_v0_1`.
 *
 * No customer-facing output. No Lane A/B writes. No Trust / Policy /
 * Product-Context Fit / score / verdict / reason codes / AMS Series
 * Core runtime naming. No Render production deploy (A0 P-4 still
 * blocking).
 *
 * SQL/connection errors propagate to the CLI (which exits non-zero).
 * Only data-shape errors become row-level rejects.
 *
 * Idempotency: `INSERT ... ON CONFLICT DO UPDATE` per the natural
 * key `(workspace_id, site_id, session_id, poi_sequence_version,
 * poi_observation_version)`. First run inserts; rerun on unchanged
 * source updates the row deterministically (the `derived_at` field
 * advances to the new run's wall-clock and `updated_at` bumps to
 * NOW(); row count stays stable — see docs/sprint2-pr12d-*.md §
 * "derived_at semantics").
 */

import pg from 'pg';
import {
  assertActiveScoringSourceCleanOrThrow,
  assertScoringContractsOrThrow,
} from '../contracts.js';
import {
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  type PoiObservationRowRaw,
  type PoiSequencePatternClass,
} from '../poi-sequence-observer/index.js';
import {
  buildDurableSequenceRecord,
  groupRowsBySession,
  type GroupedRows,
} from './mapper.js';
import {
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL,
  UPSERT_POI_SEQUENCE_OBSERVATION_SQL,
} from './query.js';
import { buildUpsertParams } from './upsert.js';
import {
  POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
  REJECT_REASONS,
  type RejectReason,
  type UpsertAction,
  type WorkerReport,
  type WorkerRowResult,
  type WorkerRunMetadata,
  type WorkerRunOptions,
} from './types.js';

/* --------------------------------------------------------------------------
 * Masking helpers (mirror PR#11c / PR#11d / PR#12b convention)
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    return { host: u.host || '<host>', name: u.pathname.replace(/^\//, '') || '<db>' };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Per-group processor
 * ------------------------------------------------------------------------ */

interface ProcessGroupCommon {
  readonly derived_at_iso:                   string;
  readonly poi_input_version_expected:       string;
  readonly poi_observation_version_expected: string;
  readonly poi_observations_table_version:   string;
}

async function processGroup(
  client: pg.Pool | pg.PoolClient | pg.Client,
  group:  GroupedRows,
  common: ProcessGroupCommon,
): Promise<WorkerRowResult> {
  const sessionId = group.session_id;

  // Build durable record (mapper validates shape).
  const mapped = buildDurableSequenceRecord({
    group,
    derived_at_iso:                   common.derived_at_iso,
    poi_input_version_expected:       common.poi_input_version_expected,
    poi_observation_version_expected: common.poi_observation_version_expected,
    poi_observations_table_version:   common.poi_observations_table_version,
  });
  if (mapped.outcome === 'rejected') {
    return {
      outcome:    'rejected',
      reason:     mapped.reason,
      session_id: sessionId,
      detail:     mapped.detail,
    };
  }

  // Defence-in-depth upsert builder invariants.
  let params: readonly unknown[];
  try {
    params = buildUpsertParams(mapped.record);
  } catch (err) {
    return {
      outcome:    'rejected',
      reason:     'ADAPTER_VALIDATION_ERROR',
      session_id: sessionId,
      detail:     (err as Error).message ?? String(err),
    };
  }

  // UPSERT — SQL / connection errors propagate to the runner.
  const res = await client.query<{ poi_sequence_observation_id: number | string; inserted: boolean }>(
    UPSERT_POI_SEQUENCE_OBSERVATION_SQL,
    params as unknown[],
  );
  const inserted = res.rows[0]?.inserted === true;
  const action: UpsertAction = inserted ? 'inserted' : 'updated';

  return {
    outcome:        'upserted',
    session_id:     sessionId,
    upsert_action:  action,
    pattern_class:  mapped.record.poi_sequence_pattern_class,
    stage0_excluded: mapped.record.stage0_excluded,
    poi_count:      mapped.record.poi_count,
  };
}

/* --------------------------------------------------------------------------
 * Aggregator
 * ------------------------------------------------------------------------ */

function emptyRejectCounter(): Record<RejectReason, number> {
  const out = Object.create(null) as Record<RejectReason, number>;
  for (const r of REJECT_REASONS) out[r] = 0;
  return out;
}

function emptyPatternDistribution(): Record<PoiSequencePatternClass, number> {
  const out = Object.create(null) as Record<PoiSequencePatternClass, number>;
  for (const c of POI_SEQUENCE_PATTERN_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

export interface AggregateInputs {
  readonly results:        readonly WorkerRowResult[];
  readonly rows_scanned:   number;
  readonly sessions_seen:  number;
  readonly sample_limit:   number;
  readonly run_metadata:   WorkerRunMetadata;
}

export function aggregateReport(args: AggregateInputs): WorkerReport {
  const reject_reasons    = emptyRejectCounter();
  const patternDist       = emptyPatternDistribution();
  const sample: string[]  = [];
  const seenSessions      = new Set<string>();

  let rows_inserted = 0;
  let rows_updated  = 0;
  let rejects       = 0;
  let stage0_excluded_count       = 0;
  let poi_sequence_eligible_count = 0;

  for (const r of args.results) {
    const sid = r.outcome === 'upserted' ? r.session_id : r.session_id;
    if (sid !== null) seenSessions.add(sid);

    if (r.outcome === 'upserted') {
      if (r.upsert_action === 'inserted') rows_inserted++;
      else                                 rows_updated++;
      patternDist[r.pattern_class] = (patternDist[r.pattern_class] ?? 0) + 1;
      if (r.stage0_excluded) stage0_excluded_count++;
      else                   poi_sequence_eligible_count++;
      if (sample.length < args.sample_limit) {
        sample.push(truncateSessionId(r.session_id));
      }
      continue;
    }

    rejects++;
    reject_reasons[r.reason] = (reject_reasons[r.reason] ?? 0) + 1;
  }

  return {
    rows_scanned:                          args.rows_scanned,
    sessions_seen:                         args.sessions_seen,
    rows_inserted,
    rows_updated,
    rejects,
    reject_reasons:                        Object.freeze(reject_reasons),
    poi_sequence_pattern_class_distribution: Object.freeze(patternDist),
    stage0_excluded_count,
    poi_sequence_eligible_count,
    unique_session_ids_seen:               seenSessions.size,
    sample_session_id_prefixes:            Object.freeze(sample.slice()),
    run_metadata:                          args.run_metadata,
  };
}

/* --------------------------------------------------------------------------
 * runPoiSequenceWorker — public entry point
 * ------------------------------------------------------------------------ */

export interface RunWorkerArgs {
  readonly client:        pg.Pool | pg.PoolClient | pg.Client;
  readonly options:       WorkerRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runPoiSequenceWorker(args: RunWorkerArgs): Promise<WorkerReport> {
  // §1 — PR#4 startup guards.
  assertScoringContractsOrThrow({ rootDir: args.options.rootDir });
  assertActiveScoringSourceCleanOrThrow({ rootDir: args.options.rootDir });

  const run_started_at = new Date().toISOString();
  const derived_at_iso = run_started_at;

  const workspaceId = args.options.workspace_id ?? null;
  const siteId      = args.options.site_id      ?? null;

  // §2 — SELECT POI rows.
  const fetchRes = await args.client.query<PoiObservationRowRaw>(
    SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL,
    [
      args.options.window_start,
      args.options.window_end,
      workspaceId,
      siteId,
      args.options.limit,
    ],
  );
  const poiRows: readonly PoiObservationRowRaw[] = fetchRes.rows;
  const rows_scanned = poiRows.length;

  // §3 — Group by session.
  const groups = groupRowsBySession(poiRows);
  const sessions_seen = groups.length;

  // §4 — Per-group processing.
  const common: ProcessGroupCommon = {
    derived_at_iso,
    poi_input_version_expected:       args.options.poi_input_version_expected,
    poi_observation_version_expected: args.options.poi_observation_version_expected,
    poi_observations_table_version:   args.options.poi_observations_table_version,
  };
  const results: WorkerRowResult[] = [];
  for (const group of groups) {
    const r = await processGroup(args.client, group, common);
    results.push(r);
  }

  const run_ended_at = new Date().toISOString();

  const run_metadata: WorkerRunMetadata = {
    source_table:                     'poi_observations_v0_1',
    target_table:                     'poi_sequence_observations_v0_1',
    workspace_id_filter:              workspaceId,
    site_id_filter:                   siteId,
    window_start:                     args.options.window_start.toISOString(),
    window_end:                       args.options.window_end.toISOString(),
    row_limit:                        args.options.limit,
    sample_limit:                     args.options.sample_limit,
    database_host:                    args.database_host,
    database_name:                    args.database_name,
    run_started_at,
    run_ended_at,
    poi_sequence_version:             args.options.poi_sequence_version,
    poi_input_version_expected:       args.options.poi_input_version_expected,
    poi_observation_version_expected: args.options.poi_observation_version_expected,
    poi_observations_table_version:   args.options.poi_observations_table_version,
    record_only:                      true,
  };

  return aggregateReport({
    results,
    rows_scanned,
    sessions_seen,
    sample_limit: args.options.sample_limit,
    run_metadata,
  });
}

/* --------------------------------------------------------------------------
 * Stub client for pure tests
 * ------------------------------------------------------------------------ */

export type StubQueryFn = (sql: string, params: readonly unknown[]) => Promise<{ rows: readonly unknown[]; rowCount: number | null }>;

export interface StubClient {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export function makeStubClient(fn: StubQueryFn): StubClient {
  return {
    async query<T = unknown>(sql: string, params: readonly unknown[] = []) {
      const r = await fn(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount };
    },
  };
}

/* --------------------------------------------------------------------------
 * Env-var parsing for the CLI runner (co-located with worker; PR#11c
 * precedent).
 * ------------------------------------------------------------------------ */

const DEFAULT_WINDOW_HOURS = 720;
const DEFAULT_LIMIT        = 50_000;
const DEFAULT_SAMPLE_LIMIT = 10;

export interface WorkerEnvOpts {
  readonly databaseUrl: string;
  readonly options:     WorkerRunOptions;
}

export function parsePoiSequenceWorkerEnvOptions(
  env: NodeJS.ProcessEnv = process.env,
  now: Date              = new Date(),
): WorkerEnvOpts {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required (host + db name will be printed; full URL is never printed)');
  }

  const workspace_id = typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
    ? env.WORKSPACE_ID : null;
  const site_id = typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
    ? env.SITE_ID : null;

  // Window
  let window_end: Date;
  if (typeof env.UNTIL === 'string' && env.UNTIL.length > 0) {
    const u = Date.parse(env.UNTIL);
    if (!Number.isFinite(u)) throw new Error(`UNTIL is not a parseable timestamp: ${JSON.stringify(env.UNTIL)}`);
    window_end = new Date(u);
  } else {
    window_end = now;
  }
  let window_start: Date;
  if (typeof env.SINCE === 'string' && env.SINCE.length > 0) {
    const s = Date.parse(env.SINCE);
    if (!Number.isFinite(s)) throw new Error(`SINCE is not a parseable timestamp: ${JSON.stringify(env.SINCE)}`);
    window_start = new Date(s);
  } else {
    const rawHours = env.WINDOW_HOURS ?? String(DEFAULT_WINDOW_HOURS);
    const hours = Number.parseInt(rawHours, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error(`WINDOW_HOURS must be a positive integer (got ${JSON.stringify(rawHours)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }
  if (window_start.getTime() >= window_end.getTime()) {
    throw new Error('window_start must be strictly before window_end');
  }

  // Limits
  const rawLimit = env.WORKER_LIMIT ?? String(DEFAULT_LIMIT);
  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`WORKER_LIMIT must be a positive integer (got ${JSON.stringify(rawLimit)})`);
  }
  const rawSampleLimit = env.SAMPLE_LIMIT ?? String(DEFAULT_SAMPLE_LIMIT);
  const sample_limit = Number.parseInt(rawSampleLimit, 10);
  if (!Number.isFinite(sample_limit) || sample_limit < 0) {
    throw new Error(`SAMPLE_LIMIT must be a non-negative integer (got ${JSON.stringify(rawSampleLimit)})`);
  }

  // Version stamps (callers may override for replay / re-derivation).
  const poi_sequence_version =
    typeof env.POI_SEQUENCE_VERSION === 'string' && env.POI_SEQUENCE_VERSION.length > 0
      ? env.POI_SEQUENCE_VERSION : 'poi-sequence-v0.1';
  const poi_input_version_expected =
    typeof env.POI_INPUT_VERSION === 'string' && env.POI_INPUT_VERSION.length > 0
      ? env.POI_INPUT_VERSION : 'poi-core-input-v0.1';
  const poi_observation_version_expected =
    typeof env.POI_OBSERVATION_VERSION === 'string' && env.POI_OBSERVATION_VERSION.length > 0
      ? env.POI_OBSERVATION_VERSION : 'poi-observation-v0.1';
  const poi_observations_table_version =
    typeof env.POI_OBSERVATIONS_TABLE_VERSION === 'string' && env.POI_OBSERVATIONS_TABLE_VERSION.length > 0
      ? env.POI_OBSERVATIONS_TABLE_VERSION : POI_OBSERVATIONS_TABLE_VERSION_DEFAULT;

  return {
    databaseUrl,
    options: {
      workspace_id,
      site_id,
      window_start,
      window_end,
      limit,
      sample_limit,
      poi_sequence_version,
      poi_input_version_expected,
      poi_observation_version_expected,
      poi_observations_table_version,
    },
  };
}
