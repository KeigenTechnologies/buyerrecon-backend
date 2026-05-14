/**
 * Sprint 2 PR#12e — POI Sequence Table Observer — masking + aggregator.
 *
 * Pure module. No DB. No HTTP. No process side effects on import.
 *
 * Folds runner outputs into the public `TableObserverReport`. Applies
 * session_id masking and DSN masking at the report edge so the
 * serialised JSON never carries a full session_id or a full DSN.
 *
 * Per Helen's locked privacy rule (truth file §9 + PR#12c OD-7):
 *   - NO poi_key values in samples.
 *   - NO evidence_refs / source_versions payload in samples.
 *   - Anomaly samples surface poi_sequence_observation_id (BIGSERIAL) ONLY.
 */

import {
  ANOMALY_KINDS,
  FORBIDDEN_COLUMNS,
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  type AnomalyKind,
  type BooleanDistribution,
  type PoiSequencePatternClass,
  type TableObserverReport,
  type TableObserverRunMetadata,
} from './types.js';

/* --------------------------------------------------------------------------
 * Masking — session_id + DSN (mirrors PR#11b / PR#11d / PR#12b / PR#12d)
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
 * Counter init helpers
 * ------------------------------------------------------------------------ */

function emptyPatternCounter(): Record<PoiSequencePatternClass, number> {
  const out = Object.create(null) as Record<PoiSequencePatternClass, number>;
  for (const c of POI_SEQUENCE_PATTERN_CLASSES_ALLOWED) out[c] = 0;
  return out;
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
 * Distribution-row shape returned by SQL constants
 * ------------------------------------------------------------------------ */

export interface DistributionRow {
  readonly bucket: unknown;
  readonly count:  unknown;
}

/* --------------------------------------------------------------------------
 * Aggregator inputs — runner builds this, aggregator folds it.
 * ------------------------------------------------------------------------ */

export interface AggregateInputs {
  readonly table_present:                              boolean;
  readonly rows_in_table:                              number;
  readonly rows_inspected:                             number;

  /** Authoritative anomaly counters (from COUNT(*) queries). */
  readonly anomaly_counts:                             Readonly<Record<AnomalyKind, number>>;
  /** Capped anomaly sample IDs (up to `anomaly_sample_limit` per kind). */
  readonly anomaly_sample_ids:                         Readonly<Record<AnomalyKind, readonly number[]>>;

  readonly forbidden_column_names_present:             readonly string[];

  readonly poi_sequence_pattern_class_rows:            readonly DistributionRow[];
  readonly poi_count_distribution_rows:                readonly DistributionRow[];
  readonly progression_depth_distribution_rows:        readonly DistributionRow[];
  readonly stage0_excluded_distribution_rows:          readonly DistributionRow[];
  readonly poi_sequence_eligible_distribution_rows:    readonly DistributionRow[];
  readonly has_repetition_distribution_rows:           readonly DistributionRow[];
  readonly has_progression_distribution_rows:          readonly DistributionRow[];
  readonly poi_sequence_version_distribution_rows:     readonly DistributionRow[];
  readonly poi_observation_version_distribution_rows:  readonly DistributionRow[];

  readonly unique_session_ids_seen:                    number;
  readonly unique_workspace_site_pairs_seen:           number;
  readonly sample_session_ids_raw:                     readonly string[];

  readonly run_metadata:                               TableObserverRunMetadata;
}

/* --------------------------------------------------------------------------
 * Coercion helpers
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

function foldPatternDistribution(rows: readonly DistributionRow[]): Record<PoiSequencePatternClass, number> {
  const out = emptyPatternCounter();
  for (const r of rows) {
    const k = bucketTextOrNull(r.bucket);
    if (k === null) continue;
    if ((k as PoiSequencePatternClass) in out) {
      out[k as PoiSequencePatternClass] = (out[k as PoiSequencePatternClass] ?? 0) + coerceBigintCount(r.count);
    } else {
      (out as Record<string, number>)[k] = coerceBigintCount(r.count);
    }
  }
  return out;
}

function foldBooleanDistribution(rows: readonly DistributionRow[]): BooleanDistribution {
  let true_count  = 0;
  let false_count = 0;
  for (const r of rows) {
    const b = bucketBooleanOrNull(r.bucket);
    if (b === true)  true_count  += coerceBigintCount(r.count);
    if (b === false) false_count += coerceBigintCount(r.count);
  }
  return { true_count, false_count };
}

/* --------------------------------------------------------------------------
 * aggregateReport — single source of truth for the public report shape
 * ------------------------------------------------------------------------ */

export function aggregateReport(inputs: AggregateInputs): TableObserverReport {
  // Authoritative anomaly counters (from COUNT(*) queries — NOT
  // sample-array length).
  const c = inputs.anomaly_counts;
  const duplicate_natural_key_count                = c.duplicate_natural_key;
  const poi_sequence_eligible_mismatch_count       = c.poi_sequence_eligible_mismatch;
  const invalid_pattern_class_count                = c.invalid_pattern_class;
  const has_progression_mismatch_count             = c.has_progression_mismatch;
  const progression_depth_mismatch_count           = c.progression_depth_mismatch;
  const repeated_poi_count_mismatch_count          = c.repeated_poi_count_mismatch;
  const has_repetition_mismatch_count              = c.has_repetition_mismatch;
  const source_count_mismatch_count                = c.source_count_mismatch;
  const negative_count_count                       = c.negative_count;
  const timestamp_ordering_violation_count         = c.timestamp_ordering_violation;
  const negative_duration_count                    = c.negative_duration;
  const evidence_refs_invalid_count                = c.evidence_refs_invalid;
  const evidence_refs_forbidden_direct_table_count = c.evidence_refs_forbidden_direct_table;
  const evidence_refs_bad_id_count                 = c.evidence_refs_bad_id;
  const source_versions_invalid_count              = c.source_versions_invalid;

  const forbidden_column_present_count = inputs.forbidden_column_names_present.length;

  const total_anomalies =
      duplicate_natural_key_count
    + poi_sequence_eligible_mismatch_count
    + invalid_pattern_class_count
    + has_progression_mismatch_count
    + progression_depth_mismatch_count
    + repeated_poi_count_mismatch_count
    + has_repetition_mismatch_count
    + source_count_mismatch_count
    + negative_count_count
    + timestamp_ordering_violation_count
    + negative_duration_count
    + evidence_refs_invalid_count
    + evidence_refs_forbidden_direct_table_count
    + evidence_refs_bad_id_count
    + source_versions_invalid_count
    + forbidden_column_present_count;

  // Anomaly samples — IDs only (non-PII BIGSERIALs).
  const anomaly_samples: Record<AnomalyKind, readonly number[]> =
    emptyAnomalySamples() as unknown as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) {
    anomaly_samples[k] = Object.freeze([...inputs.anomaly_sample_ids[k]]);
  }

  // Distributions.
  const poi_sequence_pattern_class_distribution = foldPatternDistribution(inputs.poi_sequence_pattern_class_rows);
  const poi_count_distribution                  = foldTextDistribution(inputs.poi_count_distribution_rows);
  const progression_depth_distribution          = foldTextDistribution(inputs.progression_depth_distribution_rows);
  const stage0_excluded_distribution            = foldBooleanDistribution(inputs.stage0_excluded_distribution_rows);
  const poi_sequence_eligible_distribution      = foldBooleanDistribution(inputs.poi_sequence_eligible_distribution_rows);
  const has_repetition_distribution             = foldBooleanDistribution(inputs.has_repetition_distribution_rows);
  const has_progression_distribution            = foldBooleanDistribution(inputs.has_progression_distribution_rows);
  const poi_sequence_version_distribution       = foldTextDistribution(inputs.poi_sequence_version_distribution_rows);
  const poi_observation_version_distribution    = foldTextDistribution(inputs.poi_observation_version_distribution_rows);

  // Sample session ids — masked at the edge.
  const sample_session_id_prefixes = inputs.sample_session_ids_raw.map(truncateSessionId);

  return {
    table_present:                              inputs.table_present,
    rows_in_table:                              inputs.rows_in_table,
    rows_inspected:                             inputs.rows_inspected,

    duplicate_natural_key_count,
    poi_sequence_eligible_mismatch_count,
    invalid_pattern_class_count,
    has_progression_mismatch_count,
    progression_depth_mismatch_count,
    repeated_poi_count_mismatch_count,
    has_repetition_mismatch_count,
    source_count_mismatch_count,
    negative_count_count,
    timestamp_ordering_violation_count,
    negative_duration_count,
    evidence_refs_invalid_count,
    evidence_refs_forbidden_direct_table_count,
    evidence_refs_bad_id_count,
    source_versions_invalid_count,

    forbidden_column_present_count,
    forbidden_column_names_present: Object.freeze([...inputs.forbidden_column_names_present]),

    total_anomalies,

    anomaly_samples: Object.freeze(anomaly_samples) as Readonly<Record<AnomalyKind, readonly number[]>>,

    poi_sequence_pattern_class_distribution: Object.freeze(poi_sequence_pattern_class_distribution),
    poi_count_distribution:                  Object.freeze(poi_count_distribution),
    progression_depth_distribution:          Object.freeze(progression_depth_distribution),
    stage0_excluded_distribution,
    poi_sequence_eligible_distribution,
    has_repetition_distribution,
    has_progression_distribution,
    poi_sequence_version_distribution:       Object.freeze(poi_sequence_version_distribution),
    poi_observation_version_distribution:    Object.freeze(poi_observation_version_distribution),

    unique_session_ids_seen:          inputs.unique_session_ids_seen,
    unique_workspace_site_pairs_seen: inputs.unique_workspace_site_pairs_seen,
    sample_session_id_prefixes:       Object.freeze(sample_session_id_prefixes),

    run_metadata: inputs.run_metadata,
  };
}

export function serialiseReport(report: TableObserverReport): string {
  return JSON.stringify(report, null, 2);
}

export { FORBIDDEN_COLUMNS };
