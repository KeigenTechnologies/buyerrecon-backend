/**
 * Sprint 2 PR#12e — POI Sequence Table Observer — runner.
 *
 * Orchestrator. Issues read-only SELECTs (query.ts) against an
 * already-constructed pg pool/client, threads results through the
 * pure aggregator (report.ts), returns a `TableObserverReport`.
 * Writes nothing.
 *
 * The runner does NOT read `process.env`. The CLI is responsible for
 * env parsing and supplying the options.
 *
 * SQL/connection errors propagate to the CLI exit. Data-shape
 * problems are folded into anomaly counters.
 *
 * Read scope (PR#12e locked boundary):
 *   - `poi_sequence_observations_v0_1`     (primary)
 *   - `information_schema.tables`          (table-presence check)
 *   - `information_schema.columns`         (forbidden-column sweep)
 *
 * Forbidden reads enforced by `query.ts` SQL constants + the
 * static-source sweep in `tests/v1/poi-sequence-table-observer.test.ts`.
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
  SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  SELECT_FORBIDDEN_COLUMNS_SQL,
  SELECT_HAS_PROGRESSION_DISTRIBUTION_SQL,
  SELECT_HAS_PROGRESSION_MISMATCH_COUNT_SQL,
  SELECT_HAS_PROGRESSION_MISMATCH_SAMPLE_SQL,
  SELECT_HAS_REPETITION_DISTRIBUTION_SQL,
  SELECT_HAS_REPETITION_MISMATCH_COUNT_SQL,
  SELECT_HAS_REPETITION_MISMATCH_SAMPLE_SQL,
  SELECT_INVALID_PATTERN_CLASS_COUNT_SQL,
  SELECT_INVALID_PATTERN_CLASS_SAMPLE_SQL,
  SELECT_NEGATIVE_COUNT_COUNT_SQL,
  SELECT_NEGATIVE_COUNT_SAMPLE_SQL,
  SELECT_NEGATIVE_DURATION_COUNT_SQL,
  SELECT_NEGATIVE_DURATION_SAMPLE_SQL,
  SELECT_POI_COUNT_DISTRIBUTION_SQL,
  SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_COUNT_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  SELECT_POI_SEQUENCE_PATTERN_CLASS_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_VERSION_DISTRIBUTION_SQL,
  SELECT_PROGRESSION_DEPTH_DISTRIBUTION_SQL,
  SELECT_PROGRESSION_DEPTH_MISMATCH_COUNT_SQL,
  SELECT_PROGRESSION_DEPTH_MISMATCH_SAMPLE_SQL,
  SELECT_REPEATED_POI_COUNT_MISMATCH_COUNT_SQL,
  SELECT_REPEATED_POI_COUNT_MISMATCH_SAMPLE_SQL,
  SELECT_ROW_COUNT_SQL,
  SELECT_SAMPLE_SESSION_IDS_SQL,
  SELECT_SOURCE_COUNT_MISMATCH_COUNT_SQL,
  SELECT_SOURCE_COUNT_MISMATCH_SAMPLE_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
  SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
  SELECT_TABLE_PRESENT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  SELECT_UNIQUE_SESSION_IDS_SQL,
  SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL,
} from './query.js';
import {
  ANOMALY_KINDS,
  FORBIDDEN_COLUMNS,
  type AnomalyKind,
  type TableObserverReport,
  type TableObserverRunMetadata,
  type TableObserverRunOptions,
} from './types.js';

type PgQueryable = pg.Pool | pg.PoolClient | pg.Client;

interface QueryRow {
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * Anomaly query plan tables
 * ------------------------------------------------------------------------ */

const ANOMALY_COUNT_SQL: Readonly<Record<AnomalyKind, string>> = Object.freeze({
  duplicate_natural_key:                 SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
  poi_sequence_eligible_mismatch:        SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_COUNT_SQL,
  invalid_pattern_class:                 SELECT_INVALID_PATTERN_CLASS_COUNT_SQL,
  has_progression_mismatch:              SELECT_HAS_PROGRESSION_MISMATCH_COUNT_SQL,
  progression_depth_mismatch:            SELECT_PROGRESSION_DEPTH_MISMATCH_COUNT_SQL,
  repeated_poi_count_mismatch:           SELECT_REPEATED_POI_COUNT_MISMATCH_COUNT_SQL,
  has_repetition_mismatch:               SELECT_HAS_REPETITION_MISMATCH_COUNT_SQL,
  source_count_mismatch:                 SELECT_SOURCE_COUNT_MISMATCH_COUNT_SQL,
  negative_count:                        SELECT_NEGATIVE_COUNT_COUNT_SQL,
  timestamp_ordering_violation:          SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  negative_duration:                     SELECT_NEGATIVE_DURATION_COUNT_SQL,
  evidence_refs_invalid:                 SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  evidence_refs_forbidden_direct_table:  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL,
  evidence_refs_bad_id:                  SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL,
  source_versions_invalid:               SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
});

const ANOMALY_SAMPLE_SQL: Readonly<Record<AnomalyKind, string>> = Object.freeze({
  duplicate_natural_key:                 SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
  poi_sequence_eligible_mismatch:        SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  invalid_pattern_class:                 SELECT_INVALID_PATTERN_CLASS_SAMPLE_SQL,
  has_progression_mismatch:              SELECT_HAS_PROGRESSION_MISMATCH_SAMPLE_SQL,
  progression_depth_mismatch:            SELECT_PROGRESSION_DEPTH_MISMATCH_SAMPLE_SQL,
  repeated_poi_count_mismatch:           SELECT_REPEATED_POI_COUNT_MISMATCH_SAMPLE_SQL,
  has_repetition_mismatch:               SELECT_HAS_REPETITION_MISMATCH_SAMPLE_SQL,
  source_count_mismatch:                 SELECT_SOURCE_COUNT_MISMATCH_SAMPLE_SQL,
  negative_count:                        SELECT_NEGATIVE_COUNT_SAMPLE_SQL,
  timestamp_ordering_violation:          SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  negative_duration:                     SELECT_NEGATIVE_DURATION_SAMPLE_SQL,
  evidence_refs_invalid:                 SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  evidence_refs_forbidden_direct_table:  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL,
  evidence_refs_bad_id:                  SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL,
  source_versions_invalid:               SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
});

/* --------------------------------------------------------------------------
 * Coercion helpers (BIGSERIAL arrives as JS string by default)
 * ------------------------------------------------------------------------ */

function coercePoiSequenceObservationId(v: unknown): number | null {
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
    const id = coercePoiSequenceObservationId(r['poi_sequence_observation_id']);
    if (id !== null) out.push(id);
  }
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
    source_table:                     'poi_sequence_observations_v0_1',
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
    poi_sequence_version_expected:    args.options.poi_sequence_version_expected,
    poi_observation_version_expected: args.options.poi_observation_version_expected,
    forbidden_columns_checked:        FORBIDDEN_COLUMNS,
    record_only:                      true,
  };
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

export async function runPoiSequenceTableObserver(args: RunObserverArgs): Promise<TableObserverReport> {
  const run_started_at = new Date().toISOString();

  const workspaceId = args.options.workspace_id ?? null;
  const siteId      = args.options.site_id      ?? null;

  // ---- Table-presence check -----------------------------------------------
  const present = await args.client.query<{ table_present: boolean }>(SELECT_TABLE_PRESENT_SQL);
  const table_present = present.rows[0]?.table_present === true;

  if (!table_present) {
    const run_ended_at = new Date().toISOString();
    return aggregateReport({
      table_present:                                  false,
      rows_in_table:                                  0,
      rows_inspected:                                 0,
      anomaly_counts:                                 emptyAnomalyCounts(),
      anomaly_sample_ids:                             emptyAnomalyIds(),
      forbidden_column_names_present:                 [],
      poi_sequence_pattern_class_rows:                [],
      poi_count_distribution_rows:                    [],
      progression_depth_distribution_rows:            [],
      stage0_excluded_distribution_rows:              [],
      poi_sequence_eligible_distribution_rows:        [],
      has_repetition_distribution_rows:               [],
      has_progression_distribution_rows:              [],
      poi_sequence_version_distribution_rows:         [],
      poi_observation_version_distribution_rows:      [],
      unique_session_ids_seen:                        0,
      unique_workspace_site_pairs_seen:               0,
      sample_session_ids_raw:                         [],
      run_metadata: buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
    });
  }

  // ---- Row count + window scope -------------------------------------------
  const rowCountRes = await args.client.query<{ row_count: unknown }>(SELECT_ROW_COUNT_SQL, [
    args.options.window_start, args.options.window_end, workspaceId, siteId,
  ]);
  const rows_in_table = coerceCountFromRow(rowCountRes.rows[0]?.row_count);

  // ---- Forbidden-column sweep ---------------------------------------------
  const forbiddenColsRes = await args.client.query<{ column_name: unknown }>(
    SELECT_FORBIDDEN_COLUMNS_SQL,
    [FORBIDDEN_COLUMNS as unknown as string[]],
  );
  const forbidden_column_names_present: readonly string[] =
    forbiddenColsRes.rows
      .map((r) => (typeof r.column_name === 'string' ? r.column_name : null))
      .filter((v): v is string => v !== null);

  // ---- Anomaly queries (per AnomalyKind) ----------------------------------
  const anomaly_counts:     Record<AnomalyKind, number>           = emptyAnomalyCounts();
  const anomaly_sample_ids: Record<AnomalyKind, readonly number[]> = emptyAnomalyIds();
  let rows_inspected = 0;
  for (const kind of ANOMALY_KINDS) {
    const countRes = await args.client.query<{ count: unknown }>(ANOMALY_COUNT_SQL[kind], [
      args.options.window_start, args.options.window_end, workspaceId, siteId,
    ]);
    const count = coerceCountFromRow(countRes.rows[0]?.count);
    anomaly_counts[kind] = count;
    rows_inspected += count;

    if (args.options.anomaly_sample_limit > 0 && count > 0) {
      const sampleRes = await args.client.query<QueryRow>(ANOMALY_SAMPLE_SQL[kind], [
        args.options.window_start, args.options.window_end, workspaceId, siteId, args.options.anomaly_sample_limit,
      ]);
      anomaly_sample_ids[kind] = Object.freeze(pickIdsFromRows(sampleRes.rows));
    }
  }

  // ---- Distribution queries -----------------------------------------------
  const poi_sequence_pattern_class_rows           = await runDistribution(args, SELECT_POI_SEQUENCE_PATTERN_CLASS_DISTRIBUTION_SQL, workspaceId, siteId);
  const poi_count_distribution_rows               = await runDistribution(args, SELECT_POI_COUNT_DISTRIBUTION_SQL,                  workspaceId, siteId);
  const progression_depth_distribution_rows       = await runDistribution(args, SELECT_PROGRESSION_DEPTH_DISTRIBUTION_SQL,          workspaceId, siteId);
  const stage0_excluded_distribution_rows         = await runDistribution(args, SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,            workspaceId, siteId);
  const poi_sequence_eligible_distribution_rows   = await runDistribution(args, SELECT_POI_SEQUENCE_ELIGIBLE_DISTRIBUTION_SQL,      workspaceId, siteId);
  const has_repetition_distribution_rows          = await runDistribution(args, SELECT_HAS_REPETITION_DISTRIBUTION_SQL,             workspaceId, siteId);
  const has_progression_distribution_rows         = await runDistribution(args, SELECT_HAS_PROGRESSION_DISTRIBUTION_SQL,            workspaceId, siteId);
  const poi_sequence_version_distribution_rows    = await runDistribution(args, SELECT_POI_SEQUENCE_VERSION_DISTRIBUTION_SQL,       workspaceId, siteId);
  const poi_observation_version_distribution_rows = await runDistribution(args, SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL,    workspaceId, siteId);

  // ---- Identity diagnostics -----------------------------------------------
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
    table_present:                                  true,
    rows_in_table,
    rows_inspected,
    anomaly_counts,
    anomaly_sample_ids,
    forbidden_column_names_present,
    poi_sequence_pattern_class_rows,
    poi_count_distribution_rows,
    progression_depth_distribution_rows,
    stage0_excluded_distribution_rows,
    poi_sequence_eligible_distribution_rows,
    has_repetition_distribution_rows,
    has_progression_distribution_rows,
    poi_sequence_version_distribution_rows,
    poi_observation_version_distribution_rows,
    unique_session_ids_seen,
    unique_workspace_site_pairs_seen,
    sample_session_ids_raw,
    run_metadata: buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
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

export { parseDatabaseUrl, serialiseReport, truncateSessionId };
