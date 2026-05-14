/**
 * Sprint 2 PR#12b — POI Sequence Observer — masking + aggregator.
 *
 * Pure module. No DB. No HTTP. No process side effects on import.
 * No clock reads (timestamps come from row data or explicit
 * ISO-8601 strings the runner supplies).
 *
 * Folds per-session PoiSequenceRecord values into the public
 * PoiSequenceObserverReport. Applies session_id masking and DSN
 * masking at the report edge so the serialised JSON never carries
 * a full session_id or a full DSN.
 *
 * Per Helen's locked privacy rule (truth file §9):
 *   - NO poi_key values in samples (default).
 *   - NO raw URL / referrer / UA / IP / token / pepper / cookie / email.
 *   - Anomaly samples surface poi_observation_id (BIGSERIAL) ONLY.
 */

import {
  ANOMALY_KINDS,
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  type AnomalyKind,
  type ObserverRunMetadata,
  type PoiSequenceObserverReport,
  type PoiSequencePatternClass,
  type PoiSequenceRecord,
} from './types.js';

/* --------------------------------------------------------------------------
 * Masking — session_id + DSN
 *
 * Mirrors PR#11b / PR#11c / PR#11d convention verbatim so a single
 * runbook step ("mask session_id at the edge") covers every
 * observer.
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  const prefix = sessionId.slice(0, 8);
  const suffix = sessionId.slice(-4);
  return `${prefix}…${suffix}`;
}

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
 * Bucket helpers
 * ------------------------------------------------------------------------ */

function countBucketLabel(n: number): string {
  if (n <= 0) return '0';
  if (n === 1) return '1';
  if (n === 2) return '2';
  if (n <= 5)  return '3..5';
  if (n <= 10) return '6..10';
  return '11+';
}

function emptyPatternDistribution(): Record<PoiSequencePatternClass, number> {
  const out = Object.create(null) as Record<PoiSequencePatternClass, number>;
  for (const c of POI_SEQUENCE_PATTERN_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

function emptyAnomalySamples(): Record<AnomalyKind, number[]> {
  const out = Object.create(null) as Record<AnomalyKind, number[]>;
  for (const k of ANOMALY_KINDS) out[k] = [];
  return out;
}

/* --------------------------------------------------------------------------
 * Aggregator input — runner produces per-session records and a parallel
 * list of (record_index, kind, sample_id) anomaly tuples; the
 * aggregator folds both into a PoiSequenceObserverReport.
 * ------------------------------------------------------------------------ */

export interface AnomalySampleId {
  readonly kind: AnomalyKind;
  readonly id:   number;
}

export interface AggregateInputs {
  readonly rows_scanned:                       number;
  readonly records:                            readonly PoiSequenceRecord[];

  /** Pre-collected per-anomaly poi_observation_id samples. */
  readonly anomaly_sample_ids:                 Readonly<Record<AnomalyKind, readonly number[]>>;

  readonly sample_session_ids_raw:             readonly string[];
  readonly run_metadata:                       ObserverRunMetadata;
}

/* --------------------------------------------------------------------------
 * Main aggregator
 * ------------------------------------------------------------------------ */

export function aggregateReport(inputs: AggregateInputs): PoiSequenceObserverReport {
  const records = inputs.records;

  // Identity diagnostics.
  const uniqueSessionIds = new Set<string>();
  const uniquePairs      = new Set<string>();
  for (const r of records) {
    uniqueSessionIds.add(`${r.workspace_id}\x1f${r.site_id}\x1f${r.session_id}`);
    uniquePairs.add(`${r.workspace_id}\x1f${r.site_id}`);
  }

  // Pattern distribution + boolean distributions.
  const patternDist = emptyPatternDistribution();
  let stage0True = 0;     let stage0False = 0;
  let eligibleTrue = 0;   let eligibleFalse = 0;
  let repetitionTrue = 0; let repetitionFalse = 0;
  let progressionTrue = 0; let progressionFalse = 0;

  const poi_count_distribution:         Record<string, number> = Object.create(null);
  const progression_depth_distribution: Record<string, number> = Object.create(null);

  const poi_input_version_distribution:       Record<string, number> = Object.create(null);
  const poi_observation_version_distribution: Record<string, number> = Object.create(null);

  // Per-anomaly counters folded from per-record fields.
  let invalid_evidence_refs_count   = 0;
  let invalid_source_versions_count = 0;
  let forbidden_source_table_count  = 0;
  let forbidden_key_present_count   = 0;

  // Session-scoped pattern anomaly counters.
  let unknown_pattern_count            = 0;
  let insufficient_temporal_data_count = 0;

  for (const r of records) {
    patternDist[r.poi_sequence_pattern_class] = (patternDist[r.poi_sequence_pattern_class] ?? 0) + 1;

    if (r.stage0_excluded)        stage0True++;     else stage0False++;
    if (r.poi_sequence_eligible)  eligibleTrue++;   else eligibleFalse++;
    if (r.has_repetition)         repetitionTrue++; else repetitionFalse++;
    if (r.has_progression)        progressionTrue++; else progressionFalse++;

    const cb = countBucketLabel(r.poi_count);
    poi_count_distribution[cb]         = (poi_count_distribution[cb] ?? 0) + 1;
    const pb = countBucketLabel(r.progression_depth);
    progression_depth_distribution[pb] = (progression_depth_distribution[pb] ?? 0) + 1;

    for (const v of r.poi_input_versions) {
      poi_input_version_distribution[v]       = (poi_input_version_distribution[v] ?? 0) + 1;
    }
    for (const v of r.poi_observation_versions) {
      poi_observation_version_distribution[v] = (poi_observation_version_distribution[v] ?? 0) + 1;
    }

    invalid_evidence_refs_count   += r.anomaly_invalid_evidence_refs;
    invalid_source_versions_count += r.anomaly_invalid_source_versions;
    forbidden_source_table_count  += r.anomaly_forbidden_source_table;
    forbidden_key_present_count   += r.anomaly_forbidden_key_present;

    if (r.poi_sequence_pattern_class === 'unknown')                    unknown_pattern_count++;
    if (r.poi_sequence_pattern_class === 'insufficient_temporal_data') insufficient_temporal_data_count++;
  }

  const total_anomalies =
      unknown_pattern_count
    + insufficient_temporal_data_count
    + invalid_evidence_refs_count
    + invalid_source_versions_count
    + forbidden_source_table_count
    + forbidden_key_present_count;

  // Anomaly samples — copy from runner, frozen.
  const anomaly_samples: Record<AnomalyKind, readonly number[]> = emptyAnomalySamples() as unknown as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) {
    anomaly_samples[k] = Object.freeze([...inputs.anomaly_sample_ids[k]]);
  }

  // Sample session_ids masked at the edge.
  const sample_session_id_prefixes = inputs.sample_session_ids_raw.map(truncateSessionId);

  return {
    rows_scanned:                          inputs.rows_scanned,
    sessions_seen:                         records.length,
    poi_sequences_built:                   records.length,
    unique_session_ids_seen:               uniqueSessionIds.size,
    unique_workspace_site_pairs_seen:      uniquePairs.size,

    poi_sequence_pattern_class_distribution: Object.freeze(patternDist),
    poi_count_distribution:                  Object.freeze(poi_count_distribution),
    progression_depth_distribution:          Object.freeze(progression_depth_distribution),

    stage0_excluded_distribution:            { true_count: stage0True,     false_count: stage0False },
    poi_sequence_eligible_distribution:      { true_count: eligibleTrue,   false_count: eligibleFalse },
    has_repetition_distribution:             { true_count: repetitionTrue, false_count: repetitionFalse },
    has_progression_distribution:            { true_count: progressionTrue, false_count: progressionFalse },

    poi_input_version_distribution:        Object.freeze(poi_input_version_distribution),
    poi_observation_version_distribution:  Object.freeze(poi_observation_version_distribution),

    unknown_pattern_count,
    insufficient_temporal_data_count,
    invalid_evidence_refs_count,
    invalid_source_versions_count,
    forbidden_source_table_count,
    forbidden_key_present_count,
    total_anomalies,

    anomaly_samples:                       Object.freeze(anomaly_samples) as Readonly<Record<AnomalyKind, readonly number[]>>,

    sample_session_id_prefixes:            Object.freeze(sample_session_id_prefixes),

    run_metadata:                          inputs.run_metadata,
  };
}

/**
 * JSON serialiser (defence in depth). The CLI calls
 * `JSON.stringify(report)` directly; this helper exists so tests can
 * assert deterministic shape without re-implementing the serialiser.
 */
export function serialiseReport(report: PoiSequenceObserverReport): string {
  return JSON.stringify(report, null, 2);
}
