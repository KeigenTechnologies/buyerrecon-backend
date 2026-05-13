/**
 * Sprint 2 PR#11d — POI Observations Table Observer — masking + aggregator.
 *
 * Pure module. No DB. No HTTP. No clock except via explicit ISO-8601
 * strings the runner supplies. No filesystem.
 *
 * Aggregates per-anomaly + per-distribution query results into the
 * final `TableObserverReport`. Applies session_id masking and DSN
 * masking at the report edge so the serialised JSON never carries a
 * full session_id or a full DSN.
 */

import {
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPES_ALLOWED,
  type PoiSourceTable,
  type PoiSurfaceClass,
  type PoiType,
} from '../poi-core/index.js';
import {
  ANOMALY_KINDS,
  FORBIDDEN_COLUMNS,
  type AnomalyKind,
  type BooleanDistribution,
  type TableObserverReport,
  type TableObserverRunMetadata,
} from './types.js';

const PRIMARY_SOURCE_TABLES: readonly PoiSourceTable[] = Object.freeze([
  'session_features',
  'session_behavioural_features_v0_2',
]);

/**
 * Mask a session_id (mirrors PR#11b / PR#11c convention).
 *   - length >= 12 → prefix(8) + `…` + suffix(4)
 *   - length <  12 → `***` (avoids prefix/suffix overlap)
 */
export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  const prefix = sessionId.slice(0, 8);
  const suffix = sessionId.slice(-4);
  return `${prefix}…${suffix}`;
}

/**
 * Parse a `DATABASE_URL` into `{ host, name }` parts, masking
 * userinfo + password. Never throws. The full URL is NEVER returned.
 */
export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    const host = u.host || '<host>';
    const name = u.pathname.replace(/^\//, '') || '<db>';
    return { host, name };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Counter init helpers
 * ------------------------------------------------------------------------ */

function emptyPoiTypeCounter(): Record<PoiType, number> {
  const out = Object.create(null) as Record<PoiType, number>;
  for (const t of POI_TYPES_ALLOWED) out[t] = 0;
  return out;
}

function emptyPoiSurfaceClassCounter(): Record<PoiSurfaceClass, number> {
  const out = Object.create(null) as Record<PoiSurfaceClass, number>;
  for (const c of POI_SURFACE_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

function emptySourceTableCounter(): Record<PoiSourceTable, number> {
  const out = Object.create(null) as Record<PoiSourceTable, number>;
  for (const t of PRIMARY_SOURCE_TABLES) out[t] = 0;
  return out;
}

function emptyPoiKeySourceFieldCounter(): Record<'landing_page_path' | 'last_page_path', number> {
  return Object.create(null) as Record<'landing_page_path' | 'last_page_path', number>;
}

function emptyBooleanDistribution(): BooleanDistribution {
  return { true_count: 0, false_count: 0 };
}

function emptyAnomalySamples(): Record<AnomalyKind, number[]> {
  const out = Object.create(null) as Record<AnomalyKind, number[]>;
  for (const k of ANOMALY_KINDS) out[k] = [];
  return out;
}

/* --------------------------------------------------------------------------
 * Distribution-row shape returned by the SQL constants
 * ------------------------------------------------------------------------ */

export interface DistributionRow {
  readonly bucket: unknown;
  readonly count:  unknown;
}

/* --------------------------------------------------------------------------
 * Aggregator input — runner produces this, aggregator turns into a
 * `TableObserverReport`. Keeps the runner thin and the aggregator
 * pure.
 * ------------------------------------------------------------------------ */

export interface AggregateInputs {
  readonly table_present:                          boolean;
  readonly rows_in_table:                          number;
  readonly rows_inspected:                         number;

  /**
   * Authoritative anomaly counters (exact, no LIMIT). The aggregator
   * uses these for `*_count` fields on the report — NEVER derives
   * counts from sample-array length.
   */
  readonly anomaly_counts:                         Readonly<Record<AnomalyKind, number>>;

  /**
   * Capped anomaly sample IDs (up to `anomaly_sample_limit` per kind).
   * Empty arrays when `anomaly_sample_limit=0`. The aggregator copies
   * these verbatim into the report's `anomaly_samples` field.
   */
  readonly anomaly_sample_ids:                     Readonly<Record<AnomalyKind, readonly number[]>>;

  readonly forbidden_column_names_present:         readonly string[];

  readonly poi_type_distribution_rows:                 readonly DistributionRow[];
  readonly poi_surface_class_distribution_rows:        readonly DistributionRow[];
  readonly source_table_distribution_rows:             readonly DistributionRow[];
  readonly poi_key_source_field_distribution_rows:     readonly DistributionRow[];
  readonly stage0_excluded_distribution_rows:          readonly DistributionRow[];
  readonly poi_eligible_distribution_rows:             readonly DistributionRow[];
  readonly extraction_version_distribution_rows:       readonly DistributionRow[];
  readonly poi_input_version_distribution_rows:        readonly DistributionRow[];
  readonly poi_observation_version_distribution_rows:  readonly DistributionRow[];

  readonly unique_session_ids_seen:                number;
  readonly unique_workspace_site_pairs_seen:       number;
  readonly sample_session_ids_raw:                 readonly string[];

  readonly run_metadata:                           TableObserverRunMetadata;
}

/* --------------------------------------------------------------------------
 * Coercion helpers — pg returns BIGINT/COUNT(*) as JS strings by default
 * ------------------------------------------------------------------------ */

function coerceBigintCount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function bucketTextOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function bucketBooleanOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function foldTextDistribution(rows: readonly DistributionRow[]): Record<string, number> {
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const r of rows) {
    const k = bucketTextOrNull(r.bucket);
    if (k === null) continue;
    out[k] = (out[k] ?? 0) + coerceBigintCount(r.count);
  }
  return out;
}

function foldTextDistributionInto<K extends string>(
  init:  Record<K, number>,
  rows:  readonly DistributionRow[],
): Record<K, number> {
  for (const r of rows) {
    const k = bucketTextOrNull(r.bucket);
    if (k === null) continue;
    if ((k as K) in init) {
      init[k as K] = (init[k as K] ?? 0) + coerceBigintCount(r.count);
    } else {
      (init as Record<string, number>)[k] = coerceBigintCount(r.count);
    }
  }
  return init;
}

function foldBooleanDistribution(rows: readonly DistributionRow[]): BooleanDistribution {
  const out = emptyBooleanDistribution();
  let true_count  = 0;
  let false_count = 0;
  for (const r of rows) {
    const b = bucketBooleanOrNull(r.bucket);
    if (b === true)  true_count  += coerceBigintCount(r.count);
    if (b === false) false_count += coerceBigintCount(r.count);
  }
  return { true_count: out.true_count + true_count, false_count: out.false_count + false_count };
}

/* --------------------------------------------------------------------------
 * Main aggregator
 *
 * Counters come from `inputs.anomaly_counts` (authoritative COUNT(*)
 * queries — exact regardless of sample cap). Samples come from
 * `inputs.anomaly_sample_ids` (capped at `anomaly_sample_limit` by
 * the runner; empty when the limit is 0). The two are independent —
 * a healthy counter can be 0 while another is 100 with only 5
 * samples surfaced, or vice versa.
 * ------------------------------------------------------------------------ */

export function aggregateReport(inputs: AggregateInputs): TableObserverReport {
  // Authoritative anomaly counters (from COUNT(*) queries, NOT
  // sample-array length).
  const duplicate_natural_key_count           = inputs.anomaly_counts.duplicate_natural_key;
  const poi_eligible_mismatch_count           = inputs.anomaly_counts.poi_eligible_mismatch;
  const evidence_refs_invalid_count           = inputs.anomaly_counts.evidence_refs_invalid;
  const source_versions_invalid_count         = inputs.anomaly_counts.source_versions_invalid;
  const v0_1_enum_violation_count             = inputs.anomaly_counts.v0_1_enum_violation;
  const negative_source_event_count_count     = inputs.anomaly_counts.negative_source_event_count;
  const timestamp_ordering_violation_count    = inputs.anomaly_counts.timestamp_ordering_violation;
  const poi_key_unsafe_count                  = inputs.anomaly_counts.poi_key_unsafe;
  const evidence_refs_forbidden_key_count     = inputs.anomaly_counts.evidence_refs_forbidden_key;

  const forbidden_column_present_count = inputs.forbidden_column_names_present.length;

  const total_anomalies =
      duplicate_natural_key_count
    + poi_eligible_mismatch_count
    + evidence_refs_invalid_count
    + source_versions_invalid_count
    + v0_1_enum_violation_count
    + negative_source_event_count_count
    + timestamp_ordering_violation_count
    + poi_key_unsafe_count
    + evidence_refs_forbidden_key_count
    + forbidden_column_present_count;

  // Anomaly samples — IDs only (non-PII BIGSERIALs). Per Helen's
  // locked rule: NO session_id, NO poi_key, NO evidence_refs, NO
  // source_row_id, NO raw row contents. The runner already capped
  // these at `anomaly_sample_limit` (and skipped the sample query
  // entirely when the limit was 0), so the aggregator just freezes
  // and forwards.
  const anomaly_samples: Record<AnomalyKind, readonly number[]> = emptyAnomalySamples() as unknown as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) {
    anomaly_samples[k] = Object.freeze([...inputs.anomaly_sample_ids[k]]);
  }

  // Distributions
  const poi_type_distribution = foldTextDistributionInto<PoiType>(
    emptyPoiTypeCounter(),
    inputs.poi_type_distribution_rows,
  );
  const poi_surface_class_distribution = foldTextDistributionInto<PoiSurfaceClass>(
    emptyPoiSurfaceClassCounter(),
    inputs.poi_surface_class_distribution_rows,
  );
  const source_table_distribution = foldTextDistributionInto<PoiSourceTable>(
    emptySourceTableCounter(),
    inputs.source_table_distribution_rows,
  );
  const poi_key_source_field_distribution = foldTextDistributionInto<'landing_page_path' | 'last_page_path'>(
    emptyPoiKeySourceFieldCounter(),
    inputs.poi_key_source_field_distribution_rows,
  );
  const stage0_excluded_distribution = foldBooleanDistribution(inputs.stage0_excluded_distribution_rows);
  const poi_eligible_distribution    = foldBooleanDistribution(inputs.poi_eligible_distribution_rows);
  const extraction_version_distribution       = foldTextDistribution(inputs.extraction_version_distribution_rows);
  const poi_input_version_distribution        = foldTextDistribution(inputs.poi_input_version_distribution_rows);
  const poi_observation_version_distribution  = foldTextDistribution(inputs.poi_observation_version_distribution_rows);

  // Sample session ids — masked at the edge.
  const sample_session_id_prefixes = inputs.sample_session_ids_raw.map(truncateSessionId);

  return {
    table_present:                    inputs.table_present,
    rows_in_table:                    inputs.rows_in_table,
    rows_inspected:                   inputs.rows_inspected,

    duplicate_natural_key_count,
    poi_eligible_mismatch_count,
    evidence_refs_invalid_count,
    source_versions_invalid_count,
    v0_1_enum_violation_count,
    negative_source_event_count_count,
    timestamp_ordering_violation_count,
    poi_key_unsafe_count,
    evidence_refs_forbidden_key_count,

    forbidden_column_present_count,
    forbidden_column_names_present:   Object.freeze([...inputs.forbidden_column_names_present]),

    total_anomalies,

    anomaly_samples:                  Object.freeze(anomaly_samples) as Readonly<Record<AnomalyKind, readonly number[]>>,

    poi_type_distribution:                  Object.freeze(poi_type_distribution),
    poi_surface_class_distribution:         Object.freeze(poi_surface_class_distribution),
    source_table_distribution:              Object.freeze(source_table_distribution),
    poi_key_source_field_distribution:      Object.freeze(poi_key_source_field_distribution),
    stage0_excluded_distribution,
    poi_eligible_distribution,
    extraction_version_distribution:        Object.freeze(extraction_version_distribution),
    poi_input_version_distribution:         Object.freeze(poi_input_version_distribution),
    poi_observation_version_distribution:   Object.freeze(poi_observation_version_distribution),

    unique_session_ids_seen:                inputs.unique_session_ids_seen,
    unique_workspace_site_pairs_seen:       inputs.unique_workspace_site_pairs_seen,
    sample_session_id_prefixes:             Object.freeze(sample_session_id_prefixes),

    run_metadata:                           inputs.run_metadata,
  };
}

/**
 * JSON serialiser (defence in depth). The CLI calls
 * `JSON.stringify(report)` directly; this helper exists so tests can
 * assert deterministic shape without re-implementing the serialiser.
 */
export function serialiseReport(report: TableObserverReport): string {
  return JSON.stringify(report, null, 2);
}

/* --------------------------------------------------------------------------
 * Re-export FORBIDDEN_COLUMNS for the CLI runbook metadata block
 * ------------------------------------------------------------------------ */

export { FORBIDDEN_COLUMNS };
