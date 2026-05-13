/**
 * Sprint 2 PR#11d — POI Observations Table Observer — runner.
 *
 * Orchestrator. Issues the read-only SELECTs (query.ts) against an
 * already-constructed pg pool/client, threads results through the
 * aggregator (report.ts), returns a `TableObserverReport`. Writes
 * nothing.
 *
 * The runner does NOT read `process.env`. The CLI is responsible
 * for parsing env vars and supplying the options.
 *
 * SQL/connection errors propagate out of the runner. The CLI catches
 * them and exits non-zero. Data-shape problems (e.g. unexpected
 * column values) are folded into anomaly counts.
 *
 * Read scope (PR#11d locked boundary):
 *   - `poi_observations_v0_1`            (primary)
 *   - `information_schema.columns`       (forbidden-column sweep)
 *   - `information_schema.tables`        (table-presence check)
 *
 * Forbidden reads enforced by `query.ts` SQL constants + the
 * test-K static-source sweep.
 */

import pg from 'pg';
import {
  aggregateReport,
  parseDatabaseUrl,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
  type DistributionRow,
} from './report.js';
import {
  SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
  SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_COUNT_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  SELECT_EXTRACTION_VERSION_DISTRIBUTION_SQL,
  SELECT_FORBIDDEN_COLUMNS_SQL,
  SELECT_NEGATIVE_SOURCE_EVENT_COUNT_COUNT_SQL,
  SELECT_NEGATIVE_SOURCE_EVENT_COUNT_SAMPLE_SQL,
  SELECT_POI_ELIGIBLE_DISTRIBUTION_SQL,
  SELECT_POI_ELIGIBLE_MISMATCH_COUNT_SQL,
  SELECT_POI_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  SELECT_POI_INPUT_VERSION_DISTRIBUTION_SQL,
  SELECT_POI_KEY_SOURCE_FIELD_DISTRIBUTION_SQL,
  SELECT_POI_KEY_UNSAFE_COUNT_SQL,
  SELECT_POI_KEY_UNSAFE_SAMPLE_SQL,
  SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL,
  SELECT_POI_SURFACE_CLASS_DISTRIBUTION_SQL,
  SELECT_POI_TYPE_DISTRIBUTION_SQL,
  SELECT_ROW_COUNT_SQL,
  SELECT_SAMPLE_SESSION_IDS_SQL,
  SELECT_SOURCE_TABLE_DISTRIBUTION_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
  SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
  SELECT_TABLE_PRESENT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  SELECT_UNIQUE_SESSION_IDS_SQL,
  SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL,
  SELECT_V0_1_ENUM_VIOLATION_COUNT_SQL,
  SELECT_V0_1_ENUM_VIOLATION_SAMPLE_SQL,
} from './query.js';
import {
  ANOMALY_KINDS,
  FORBIDDEN_COLUMNS,
  type AnomalyKind,
  type TableObserverReport,
  type TableObserverRunMetadata,
  type TableObserverRunOptions,
} from './types.js';

/* --------------------------------------------------------------------------
 * Lightweight client abstraction (mirrors PR#11b precedent)
 *
 * The runner accepts any value that satisfies the `pg.Pool | pg.Client`
 * query interface. The test harness supplies a stub client via
 * `makeStubClient`; production CLI supplies a real `pg.Pool`.
 * ------------------------------------------------------------------------ */

type PgQueryable = pg.Pool | pg.PoolClient | pg.Client;

interface QueryRow {
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * Per-anomaly query plan (split: COUNT + SAMPLE)
 *
 * Per Codex blocker (PR#11d v0.2): anomaly counters MUST be
 * authoritative. We split each anomaly check into two queries — a
 * `COUNT(*)` (no LIMIT, exact) and a separate sample query (capped
 * at `anomaly_sample_limit`). The sample query is SKIPPED when the
 * caller passes `anomaly_sample_limit=0`, but the count query always
 * runs.
 * ------------------------------------------------------------------------ */

const ANOMALY_COUNT_SQL: Readonly<Record<AnomalyKind, string>> = Object.freeze({
  duplicate_natural_key:           SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
  poi_eligible_mismatch:           SELECT_POI_ELIGIBLE_MISMATCH_COUNT_SQL,
  evidence_refs_invalid:           SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  source_versions_invalid:         SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
  v0_1_enum_violation:             SELECT_V0_1_ENUM_VIOLATION_COUNT_SQL,
  negative_source_event_count:     SELECT_NEGATIVE_SOURCE_EVENT_COUNT_COUNT_SQL,
  timestamp_ordering_violation:    SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  poi_key_unsafe:                  SELECT_POI_KEY_UNSAFE_COUNT_SQL,
  evidence_refs_forbidden_key:     SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_COUNT_SQL,
});

const ANOMALY_SAMPLE_SQL: Readonly<Record<AnomalyKind, string>> = Object.freeze({
  duplicate_natural_key:           SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
  poi_eligible_mismatch:           SELECT_POI_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  evidence_refs_invalid:           SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  source_versions_invalid:         SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
  v0_1_enum_violation:             SELECT_V0_1_ENUM_VIOLATION_SAMPLE_SQL,
  negative_source_event_count:     SELECT_NEGATIVE_SOURCE_EVENT_COUNT_SAMPLE_SQL,
  timestamp_ordering_violation:    SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  poi_key_unsafe:                  SELECT_POI_KEY_UNSAFE_SAMPLE_SQL,
  evidence_refs_forbidden_key:     SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_SAMPLE_SQL,
});

/* --------------------------------------------------------------------------
 * Coercion of `poi_observation_id` to a JS number
 *
 * BIGSERIAL arrives from pg as a JS string by default. We coerce to
 * number for the anomaly samples (BIGSERIAL fits comfortably in a
 * double until ~2^53; at staging scale this is fine. A future PR can
 * promote to bigint if the table grows past Number.MAX_SAFE_INTEGER).
 *
 * Invalid values (non-string, non-finite-integer) are silently
 * dropped — the row count still reflects the SQL row count, so the
 * counter remains accurate even if a sample ID fails coercion.
 * ------------------------------------------------------------------------ */

function coercePoiObservationId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

function pickIdsFromRows(rows: readonly QueryRow[]): readonly number[] {
  const out: number[] = [];
  for (const r of rows) {
    const id = coercePoiObservationId(r['poi_observation_id']);
    if (id !== null) out.push(id);
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        PgQueryable;
  readonly options:       TableObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runPoiTableObserver(args: RunObserverArgs): Promise<TableObserverReport> {
  const run_started_at = new Date().toISOString();

  const workspaceId = args.options.workspace_id ?? null;
  const siteId      = args.options.site_id      ?? null;

  // ---- Table-presence check (information_schema.tables) ---------------
  const present = await args.client.query<{ table_present: boolean }>(SELECT_TABLE_PRESENT_SQL);
  const table_present = present.rows[0]?.table_present === true;

  // If the table is not present, return an early empty report. The
  // operator's runbook treats `table_present=false` as a migration-
  // not-applied state.
  if (!table_present) {
    const run_ended_at = new Date().toISOString();
    return aggregateReport({
      table_present:                  false,
      rows_in_table:                  0,
      rows_inspected:                 0,
      anomaly_counts:                 emptyAnomalyCounts(),
      anomaly_sample_ids:             emptyAnomalyIds(),
      forbidden_column_names_present: [],
      poi_type_distribution_rows:                 [],
      poi_surface_class_distribution_rows:        [],
      source_table_distribution_rows:             [],
      poi_key_source_field_distribution_rows:     [],
      stage0_excluded_distribution_rows:          [],
      poi_eligible_distribution_rows:             [],
      extraction_version_distribution_rows:       [],
      poi_input_version_distribution_rows:        [],
      poi_observation_version_distribution_rows:  [],
      unique_session_ids_seen:        0,
      unique_workspace_site_pairs_seen: 0,
      sample_session_ids_raw:         [],
      run_metadata: buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
    });
  }

  // ---- Row count + window scope ---------------------------------------
  const rowCountRes = await args.client.query<{ row_count: unknown }>(SELECT_ROW_COUNT_SQL, [
    args.options.window_start,
    args.options.window_end,
    workspaceId,
    siteId,
  ]);
  const rows_in_table = coerceCountFromRow(rowCountRes.rows[0]?.row_count);

  // ---- Forbidden-column sweep -----------------------------------------
  const forbiddenColsRes = await args.client.query<{ column_name: unknown }>(
    SELECT_FORBIDDEN_COLUMNS_SQL,
    [FORBIDDEN_COLUMNS as unknown as string[]],
  );
  const forbidden_column_names_present: readonly string[] =
    forbiddenColsRes.rows
      .map((r) => (typeof r.column_name === 'string' ? r.column_name : null))
      .filter((v): v is string => v !== null);

  // ---- Anomaly queries (per AnomalyKind) ------------------------------
  // Counter (authoritative; no LIMIT) + samples (capped at
  // `anomaly_sample_limit`; skipped when the limit is 0). The two are
  // independent — the counter is always exact regardless of how many
  // samples the caller asked for.
  const anomaly_counts:     Record<AnomalyKind, number>          = emptyAnomalyCounts();
  const anomaly_sample_ids: Record<AnomalyKind, readonly number[]> = emptyAnomalyIds();
  let rows_inspected = 0;
  for (const kind of ANOMALY_KINDS) {
    // 1. Counter query — exact, no LIMIT.
    const countRes = await args.client.query<{ count: unknown }>(ANOMALY_COUNT_SQL[kind], [
      args.options.window_start,
      args.options.window_end,
      workspaceId,
      siteId,
    ]);
    const count = coerceCountFromRow(countRes.rows[0]?.count);
    anomaly_counts[kind] = count;
    rows_inspected += count;

    // 2. Sample query — only when samples are requested AND the
    // counter is positive. If `anomaly_sample_limit=0`, samples are
    // suppressed; the counter still reports the full count.
    if (args.options.anomaly_sample_limit > 0 && count > 0) {
      const sampleRes = await args.client.query<QueryRow>(ANOMALY_SAMPLE_SQL[kind], [
        args.options.window_start,
        args.options.window_end,
        workspaceId,
        siteId,
        args.options.anomaly_sample_limit,
      ]);
      anomaly_sample_ids[kind] = Object.freeze(pickIdsFromRows(sampleRes.rows));
    }
    // else: anomaly_sample_ids[kind] stays at its emptyAnomalyIds()
    // default (empty array).
  }

  // ---- Distribution queries -------------------------------------------
  const poi_type_rows                    = await runDistribution(args, SELECT_POI_TYPE_DISTRIBUTION_SQL,                workspaceId, siteId);
  const poi_surface_class_rows           = await runDistribution(args, SELECT_POI_SURFACE_CLASS_DISTRIBUTION_SQL,       workspaceId, siteId);
  const source_table_rows                = await runDistribution(args, SELECT_SOURCE_TABLE_DISTRIBUTION_SQL,            workspaceId, siteId);
  const poi_key_source_field_rows        = await runDistribution(args, SELECT_POI_KEY_SOURCE_FIELD_DISTRIBUTION_SQL,    workspaceId, siteId);
  const stage0_excluded_rows             = await runDistribution(args, SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,         workspaceId, siteId);
  const poi_eligible_rows                = await runDistribution(args, SELECT_POI_ELIGIBLE_DISTRIBUTION_SQL,            workspaceId, siteId);
  const extraction_version_rows          = await runDistribution(args, SELECT_EXTRACTION_VERSION_DISTRIBUTION_SQL,      workspaceId, siteId);
  const poi_input_version_rows           = await runDistribution(args, SELECT_POI_INPUT_VERSION_DISTRIBUTION_SQL,       workspaceId, siteId);
  const poi_observation_version_rows     = await runDistribution(args, SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL, workspaceId, siteId);

  // ---- Identity diagnostics -------------------------------------------
  const uniqSessRes = await args.client.query<{ count: unknown }>(SELECT_UNIQUE_SESSION_IDS_SQL, [
    args.options.window_start, args.options.window_end, workspaceId, siteId,
  ]);
  const unique_session_ids_seen = coerceCountFromRow(uniqSessRes.rows[0]?.count);

  const uniqPairsRes = await args.client.query<{ count: unknown }>(SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL, [
    args.options.window_start, args.options.window_end, workspaceId, siteId,
  ]);
  const unique_workspace_site_pairs_seen = coerceCountFromRow(uniqPairsRes.rows[0]?.count);

  const sampleRes = await args.client.query<{ session_id: unknown }>(SELECT_SAMPLE_SESSION_IDS_SQL, [
    args.options.window_start, args.options.window_end, workspaceId, siteId, args.options.sample_limit,
  ]);
  const sample_session_ids_raw: readonly string[] =
    sampleRes.rows
      .map((r) => (typeof r.session_id === 'string' ? r.session_id : null))
      .filter((v): v is string => v !== null);

  const run_ended_at = new Date().toISOString();

  return aggregateReport({
    table_present:                  true,
    rows_in_table,
    rows_inspected,
    anomaly_counts,
    anomaly_sample_ids,
    forbidden_column_names_present,
    poi_type_distribution_rows:                  poi_type_rows,
    poi_surface_class_distribution_rows:         poi_surface_class_rows,
    source_table_distribution_rows:              source_table_rows,
    poi_key_source_field_distribution_rows:      poi_key_source_field_rows,
    stage0_excluded_distribution_rows:           stage0_excluded_rows,
    poi_eligible_distribution_rows:              poi_eligible_rows,
    extraction_version_distribution_rows:        extraction_version_rows,
    poi_input_version_distribution_rows:         poi_input_version_rows,
    poi_observation_version_distribution_rows:   poi_observation_version_rows,
    unique_session_ids_seen,
    unique_workspace_site_pairs_seen,
    sample_session_ids_raw,
    run_metadata: buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
  });
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function emptyAnomalyIds(): Record<AnomalyKind, readonly number[]> {
  const out = Object.create(null) as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) out[k] = Object.freeze<number[]>([]);
  return out;
}

function emptyAnomalyCounts(): Record<AnomalyKind, number> {
  const out = Object.create(null) as Record<AnomalyKind, number>;
  for (const k of ANOMALY_KINDS) out[k] = 0;
  return out;
}

function coerceCountFromRow(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

async function runDistribution(
  args:        RunObserverArgs,
  sql:         string,
  workspaceId: string | null,
  siteId:      string | null,
): Promise<readonly DistributionRow[]> {
  const r = await args.client.query<QueryRow>(sql, [
    args.options.window_start,
    args.options.window_end,
    workspaceId,
    siteId,
  ]);
  return r.rows.map((row) => ({
    bucket: row['bucket'],
    count:  row['count'],
  }));
}

function buildRunMetadata(
  args:           RunObserverArgs,
  workspaceId:    string | null,
  siteId:         string | null,
  run_started_at: string,
  run_ended_at:   string,
): TableObserverRunMetadata {
  return {
    source_table:                     'poi_observations_v0_1',
    workspace_id_filter:              workspaceId,
    site_id_filter:                   siteId,
    window_start:                     args.options.window_start.toISOString(),
    window_end:                       args.options.window_end.toISOString(),
    row_limit:                        args.options.limit,
    sample_limit:                     args.options.sample_limit,
    anomaly_sample_limit:             args.options.anomaly_sample_limit,
    database_host:                    args.database_host,
    database_name:                    args.database_name,
    run_started_at,
    run_ended_at,
    poi_input_version_expected:       args.options.poi_input_version_expected,
    poi_observation_version_expected: args.options.poi_observation_version_expected,
    forbidden_columns_checked:        FORBIDDEN_COLUMNS,
    record_only:                      true,
  };
}

/* --------------------------------------------------------------------------
 * Stub client for pure tests (mirrors PR#11b precedent)
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
 * Re-exports for the CLI
 * ------------------------------------------------------------------------ */

export { parseDatabaseUrl, serialiseReport, truncateSessionId };
