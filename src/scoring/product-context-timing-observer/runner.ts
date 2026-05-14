/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — runner.
 *
 * Orchestrator. Issues the read-only SELECTs (query.ts) against an
 * already-constructed pg pool/client, calls the pure mapper, builds
 * the structured `ObserverReport`. Writes nothing.
 *
 * The runner does NOT read `process.env`. The CLI parses env vars
 * and supplies the options + an explicit `evaluation_at` clock.
 *
 * Read scope (PR#13b locked boundary):
 *   - `poi_observations_v0_1`               (primary)
 *   - `poi_sequence_observations_v0_1`      (primary)
 *   - `information_schema.tables`           (presence)
 *   - `information_schema.columns`          (required-column readiness)
 *
 * Forbidden reads enforced by query.ts SQL constants + the static-
 * source sweep in `tests/v1/product-context-timing-observer.test.ts`.
 *
 * Failure modes:
 *   - Source table absent  → return report with `fail_closed=true`,
 *     no further queries issued.
 *   - Required column missing → same.
 *   - SQL / connection errors → propagate to CLI.
 */

import pg from 'pg';
import {
  buildSessionPreview,
  emptyActionabilityDist,
  emptyUniversalSurfaceDist,
  groupBySession,
  truncateSessionId,
} from './mapper.js';
import {
  SELECT_POI_ROWS_SQL,
  SELECT_POI_SEQUENCE_ROWS_SQL,
  SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL,
  SELECT_POI_TABLE_PRESENT_SQL,
  SELECT_TABLE_COLUMNS_SQL,
} from './query.js';
import { parseDatabaseUrl, renderMarkdown } from './report.js';
import {
  BUYING_ROLE_LENS_VERSION,
  CATEGORY_TEMPLATE_VERSION,
  EVIDENCE_PREVIEW_REJECT_REASONS,
  EXCLUDED_MAPPING_VERSION,
  FRESHNESS_DECAY_MODEL_VERSION,
  OBSERVER_VERSION,
  PRODUCT_CONTEXT_PROFILE_VERSION,
  REQUIRED_POI_COLUMNS,
  REQUIRED_POI_SEQUENCE_COLUMNS,
  SITE_MAPPING_VERSION,
  TIMING_WINDOW_MODEL_VERSION,
  UNIVERSAL_SURFACE_TAXONOMY_VERSION,
  type AmsAlignedJsonPreviewBlock,
  type AmsAlignedJsonPreviewSample,
  type BoundaryBlock,
  type EvidencePreviewRejectReason,
  type EvidenceQualityBlock,
  type ObserverReport,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type PoiRowRaw,
  type PoiSequenceRowRaw,
  type ProductContextPreviewBlock,
  type ReadOnlyProofBlock,
  type SourceReadinessBlock,
  type SourceScanBlock,
  type TimingActionabilityBlock,
} from './types.js';

type PgQueryable = pg.Pool | pg.PoolClient | pg.Client;

interface QueryRow {
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        PgQueryable;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runProductContextTimingObserver(args: RunObserverArgs): Promise<ObserverReport> {
  const run_started_at = new Date().toISOString();
  const checked_at     = args.options.evaluation_at.toISOString();

  // §1 boundary
  const boundary: BoundaryBlock = {
    workspace_id:    args.options.workspace_id,
    site_id:         args.options.site_id,
    window_start:    args.options.window_start.toISOString(),
    window_end:      args.options.window_end.toISOString(),
    checked_at,
    database_host:   args.database_host,
    database_name:   args.database_name,
  };

  // §2 source readiness
  const poiPresentRes      = await args.client.query<{ present: boolean }>(SELECT_POI_TABLE_PRESENT_SQL);
  const poiSeqPresentRes   = await args.client.query<{ present: boolean }>(SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL);
  const poiPresent         = poiPresentRes.rows[0]?.present === true;
  const poiSeqPresent      = poiSeqPresentRes.rows[0]?.present === true;

  let poiMissingCols:    string[] = [];
  let poiSeqMissingCols: string[] = [];

  if (poiPresent) {
    const r = await args.client.query<{ column_name: unknown }>(SELECT_TABLE_COLUMNS_SQL, ['poi_observations_v0_1']);
    const present = new Set(r.rows.map((x) => (typeof x.column_name === 'string' ? x.column_name : null)).filter((v): v is string => v !== null));
    poiMissingCols = REQUIRED_POI_COLUMNS.filter((c) => !present.has(c));
  }
  if (poiSeqPresent) {
    const r = await args.client.query<{ column_name: unknown }>(SELECT_TABLE_COLUMNS_SQL, ['poi_sequence_observations_v0_1']);
    const present = new Set(r.rows.map((x) => (typeof x.column_name === 'string' ? x.column_name : null)).filter((v): v is string => v !== null));
    poiSeqMissingCols = REQUIRED_POI_SEQUENCE_COLUMNS.filter((c) => !present.has(c));
  }

  const failClosed       = !poiPresent || !poiSeqPresent || poiMissingCols.length > 0 || poiSeqMissingCols.length > 0;
  const failClosedReason = failClosed
    ? buildFailClosedReason(poiPresent, poiSeqPresent, poiMissingCols, poiSeqMissingCols)
    : null;

  const source_readiness: SourceReadinessBlock = {
    poi_observations_v0_1_present:           poiPresent,
    poi_sequence_observations_v0_1_present:  poiSeqPresent,
    poi_missing_columns:                     Object.freeze([...poiMissingCols]),
    poi_sequence_missing_columns:            Object.freeze([...poiSeqMissingCols]),
    fail_closed:                             failClosed,
    fail_closed_reason:                      failClosedReason,
  };

  if (failClosed) {
    const run_ended_at = new Date().toISOString();
    return Object.freeze({
      boundary,
      source_readiness,
      source_scan:                emptySourceScanBlock(),
      evidence_quality:           emptyEvidenceQualityBlock(),
      product_context_preview:    emptyProductContextPreviewBlock(args.options),
      timing_actionability:       emptyTimingActionabilityBlock(),
      ams_aligned_json_preview:   emptyAmsAlignedJsonPreviewBlock(),
      read_only_proof:            buildReadOnlyProof(),
      run_metadata:               buildRunMetadata(run_started_at, run_ended_at),
    });
  }

  // §3 source scan
  const poiRowsRes = await args.client.query<QueryRow>(SELECT_POI_ROWS_SQL, [
    args.options.window_start,
    args.options.window_end,
    args.options.workspace_id,
    args.options.site_id,
    args.options.limit,
  ]);
  const poiSeqRowsRes = await args.client.query<QueryRow>(SELECT_POI_SEQUENCE_ROWS_SQL, [
    args.options.window_start,
    args.options.window_end,
    args.options.workspace_id,
    args.options.site_id,
    args.options.limit,
  ]);
  const poiRows         = poiRowsRes.rows as unknown as readonly PoiRowRaw[];
  const poiSeqRows      = poiSeqRowsRes.rows as unknown as readonly PoiSequenceRowRaw[];

  const groups = groupBySession(poiRows, poiSeqRows);

  const poiInputVersions:       Set<string> = new Set();
  const poiObservationVersions: Set<string> = new Set();
  const poiSequenceVersions:    Set<string> = new Set();
  for (const r of poiRows) {
    const v1 = typeof r.poi_input_version       === 'string' ? r.poi_input_version       : null;
    const v2 = typeof r.poi_observation_version === 'string' ? r.poi_observation_version : null;
    if (v1 !== null) poiInputVersions.add(v1);
    if (v2 !== null) poiObservationVersions.add(v2);
  }
  for (const r of poiSeqRows) {
    const v1 = typeof r.poi_sequence_version    === 'string' ? r.poi_sequence_version    : null;
    const v2 = typeof r.poi_observation_version === 'string' ? r.poi_observation_version : null;
    if (v1 !== null) poiSequenceVersions.add(v1);
    if (v2 !== null) poiObservationVersions.add(v2);
  }

  let earliestMs: number | null = null;
  let latestMs:   number | null = null;
  for (const r of poiRows) {
    const t1 = coerceTimestampMs(r.first_seen_at);
    const t2 = coerceTimestampMs(r.last_seen_at);
    for (const t of [t1, t2]) {
      if (t === null) continue;
      if (earliestMs === null || t < earliestMs) earliestMs = t;
      if (latestMs   === null || t > latestMs)   latestMs   = t;
    }
  }

  const source_scan: SourceScanBlock = {
    poi_rows_scanned:                  poiRows.length,
    poi_sequence_rows_scanned:         poiSeqRows.length,
    unique_session_ids_seen:           groups.length,
    poi_input_versions_observed:       Object.freeze([...poiInputVersions].sort()),
    poi_observation_versions_observed: Object.freeze([...poiObservationVersions].sort()),
    poi_sequence_versions_observed:    Object.freeze([...poiSequenceVersions].sort()),
    earliest_observed_at:              earliestMs !== null ? new Date(earliestMs).toISOString() : null,
    latest_observed_at:                latestMs   !== null ? new Date(latestMs).toISOString()   : null,
  };

  // §4–§7 build per-session previews + aggregate
  const evaluationMs = args.options.evaluation_at.getTime();
  const previews = groups.map((g) => buildSessionPreview(g, evaluationMs, args.options.sales_motion));

  let acceptedCount  = 0;
  let rejectedCount  = 0;
  let invalidRefs    = 0;
  let unknownSurfaceTotal  = 0;
  let excludedSurfaceTotal = 0;

  const rejectReasonCounts: Record<EvidencePreviewRejectReason, number> = (() => {
    const out = Object.create(null) as Record<EvidencePreviewRejectReason, number>;
    for (const r of EVIDENCE_PREVIEW_REJECT_REASONS) out[r] = 0;
    return out;
  })();
  const surfaceDistTotal      = emptyUniversalSurfaceDist();
  const actionabilityDistTotal = emptyActionabilityDist();
  const timingBucketDist:     Record<string, number> = Object.create(null);
  const conversionProximity:  Record<string, number> = Object.create(null);

  let totalMapped = 0;
  let totalSurfaces = 0;
  let staleCount = 0;
  let dormantCount = 0;
  let insufficientEvidenceCount = 0;

  for (const p of previews) {
    if (p.accepted_into_preview) acceptedCount++; else rejectedCount++;
    if (p.reject_reason !== null) {
      rejectReasonCounts[p.reject_reason] = (rejectReasonCounts[p.reject_reason] ?? 0) + 1;
      if (p.reject_reason === 'invalid_evidence_refs') invalidRefs++;
    }
    unknownSurfaceTotal  += p.unknown_surface_count;
    excludedSurfaceTotal += p.excluded_surface_count;

    for (const [k, v] of Object.entries(p.surface_distribution)) {
      surfaceDistTotal[k] = (surfaceDistTotal[k] ?? 0) + v;
      totalSurfaces += v;
      if (k !== 'unknown') totalMapped += v;
    }

    actionabilityDistTotal[p.actionability_band] = (actionabilityDistTotal[p.actionability_band] ?? 0) + 1;
    if (p.actionability_band === 'stale')                  staleCount++;
    if (p.actionability_band === 'dormant')                dormantCount++;
    if (p.actionability_band === 'insufficient_evidence')  insufficientEvidenceCount++;

    const bucket = timingBucketLabel(p.hours_since_last_session_or_null);
    timingBucketDist[bucket] = (timingBucketDist[bucket] ?? 0) + 1;

    if (p.pricing_signal_present)    conversionProximity['pricing_visited']        = (conversionProximity['pricing_visited']        ?? 0) + 1;
    if (p.comparison_signal_present) conversionProximity['comparison_visited']     = (conversionProximity['comparison_visited']     ?? 0) + 1;
    if (p.surface_distribution['demo_request'] !== undefined && p.surface_distribution['demo_request'] > 0) {
      conversionProximity['demo_request_visited'] = (conversionProximity['demo_request_visited'] ?? 0) + 1;
    }
  }

  const mappingCoveragePct = totalSurfaces === 0 ? 0 : Math.round((totalMapped / totalSurfaces) * 1000) / 10;

  const evidence_quality: EvidenceQualityBlock = {
    rows_accepted_into_preview: acceptedCount,
    rows_rejected_from_preview: rejectedCount,
    reject_reason_counts:       Object.freeze(rejectReasonCounts),
    invalid_evidence_refs_count: invalidRefs,
    unknown_surface_count:      unknownSurfaceTotal,
    excluded_surface_count:     excludedSurfaceTotal,
  };

  const product_context_preview: ProductContextPreviewBlock = {
    universal_surface_distribution: Object.freeze(surfaceDistTotal),
    category_template:              args.options.category_template,
    primary_conversion_goal:        args.options.primary_conversion_goal,
    sales_motion:                   args.options.sales_motion,
    site_mapping_version:           SITE_MAPPING_VERSION,
    excluded_mapping_version:       EXCLUDED_MAPPING_VERSION,
    mapping_coverage_percent:       mappingCoveragePct,
  };

  const timing_actionability: TimingActionabilityBlock = {
    actionability_band_distribution: Object.freeze(actionabilityDistTotal),
    timing_window_bucket_distribution: Object.freeze(timingBucketDist),
    stale_count:                  staleCount,
    dormant_count:                dormantCount,
    insufficient_evidence_count:  insufficientEvidenceCount,
    conversion_proximity_indicators: Object.freeze(conversionProximity),
  };

  // §7 AMS-aligned JSON preview — sample up to `sample_limit`
  // ACCEPTED sessions only; ID-only / truncated; no raw URLs.
  const acceptedPreviews = previews.filter((p) => p.accepted_into_preview);
  const samples: AmsAlignedJsonPreviewSample[] = [];
  for (let i = 0; i < acceptedPreviews.length && samples.length < args.options.sample_limit; i++) {
    const p = acceptedPreviews[i]!;
    samples.push({
      truncated_session_id_prefix: truncateSessionId(p.session_id),
      buyerrecon_product_features_shape_preview: {
        fit: {
          page_type_distribution: Object.freeze({ ...p.surface_distribution }),
          mapping_coverage_percent: p.mapping_coverage_percent,
        },
        intent: {
          pricing_signal_present:    p.pricing_signal_present,
          comparison_signal_present: p.comparison_signal_present,
          poi_count:                 p.poi_count,
          unique_poi_count:          p.unique_poi_count,
        },
        window: {
          hours_since_last_session_or_null: p.hours_since_last_session_or_null,
          session_in_window_band:           p.actionability_band,
          progression_depth:                p.progression_depth,
        },
      },
      preview_metadata: {
        non_authoritative:                                  true,
        internal_only:                                      true,
        alignable_with_ams_product_features_namespace:      true,
        must_not_be_treated_as_ams_runtime_output:          true,
      },
    });
  }

  const ams_aligned_json_preview: AmsAlignedJsonPreviewBlock = {
    samples:    Object.freeze(samples),
    disclaimer: 'This JSON preview is non-authoritative and internal-only. It is alignable with the AMS BuyerRecon Product Layer JSON shape under ProductFeatures.Namespace, but it does NOT execute AMS Product Layer logic and MUST NOT be treated as AMS runtime output.',
  };

  const run_ended_at = new Date().toISOString();
  const report: ObserverReport = Object.freeze({
    boundary,
    source_readiness,
    source_scan,
    evidence_quality,
    product_context_preview,
    timing_actionability,
    ams_aligned_json_preview,
    read_only_proof:  buildReadOnlyProof(),
    run_metadata:     buildRunMetadata(run_started_at, run_ended_at),
  });

  return report;
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function coerceTimestampMs(v: unknown): number | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime();
  if (typeof v === 'string' && v.length > 0) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function buildFailClosedReason(
  poiPresent:     boolean,
  poiSeqPresent:  boolean,
  poiMissing:     readonly string[],
  poiSeqMissing:  readonly string[],
): string {
  const reasons: string[] = [];
  if (!poiPresent)         reasons.push('table poi_observations_v0_1 missing');
  if (!poiSeqPresent)      reasons.push('table poi_sequence_observations_v0_1 missing');
  if (poiMissing.length > 0)    reasons.push(`poi_observations_v0_1 missing columns: ${poiMissing.join(', ')}`);
  if (poiSeqMissing.length > 0) reasons.push(`poi_sequence_observations_v0_1 missing columns: ${poiSeqMissing.join(', ')}`);
  return reasons.join('; ');
}

function timingBucketLabel(hoursSinceLast: number | null): string {
  if (hoursSinceLast === null) return 'unknown';
  if (hoursSinceLast <= 1)     return '<=1h';
  if (hoursSinceLast <= 24)    return '<=24h';
  if (hoursSinceLast <= 168)   return '<=7d';
  if (hoursSinceLast <= 720)   return '<=30d';
  if (hoursSinceLast <= 2160)  return '<=90d';
  return '>90d';
}

function emptySourceScanBlock(): SourceScanBlock {
  return Object.freeze({
    poi_rows_scanned:                  0,
    poi_sequence_rows_scanned:         0,
    unique_session_ids_seen:           0,
    poi_input_versions_observed:       Object.freeze<string[]>([]),
    poi_observation_versions_observed: Object.freeze<string[]>([]),
    poi_sequence_versions_observed:    Object.freeze<string[]>([]),
    earliest_observed_at:              null,
    latest_observed_at:                null,
  });
}

function emptyEvidenceQualityBlock(): EvidenceQualityBlock {
  const counts = Object.create(null) as Record<EvidencePreviewRejectReason, number>;
  for (const r of EVIDENCE_PREVIEW_REJECT_REASONS) counts[r] = 0;
  return Object.freeze({
    rows_accepted_into_preview:   0,
    rows_rejected_from_preview:   0,
    reject_reason_counts:         Object.freeze(counts),
    invalid_evidence_refs_count:  0,
    unknown_surface_count:        0,
    excluded_surface_count:       0,
  });
}

function emptyProductContextPreviewBlock(options: ObserverRunOptions): ProductContextPreviewBlock {
  return Object.freeze({
    universal_surface_distribution: Object.freeze(emptyUniversalSurfaceDist()),
    category_template:              options.category_template,
    primary_conversion_goal:        options.primary_conversion_goal,
    sales_motion:                   options.sales_motion,
    site_mapping_version:           SITE_MAPPING_VERSION,
    excluded_mapping_version:       EXCLUDED_MAPPING_VERSION,
    mapping_coverage_percent:       0,
  });
}

function emptyTimingActionabilityBlock(): TimingActionabilityBlock {
  return Object.freeze({
    actionability_band_distribution:   Object.freeze(emptyActionabilityDist()),
    timing_window_bucket_distribution: Object.freeze<Record<string, number>>({}),
    stale_count:                       0,
    dormant_count:                     0,
    insufficient_evidence_count:       0,
    conversion_proximity_indicators:   Object.freeze<Record<string, number>>({}),
  });
}

function emptyAmsAlignedJsonPreviewBlock(): AmsAlignedJsonPreviewBlock {
  return Object.freeze({
    samples:    Object.freeze<AmsAlignedJsonPreviewSample[]>([]),
    disclaimer: 'This JSON preview is non-authoritative and internal-only. It is alignable with the AMS BuyerRecon Product Layer JSON shape under ProductFeatures.Namespace, but it does NOT execute AMS Product Layer logic and MUST NOT be treated as AMS runtime output.',
  });
}

function buildReadOnlyProof(): ReadOnlyProofBlock {
  return Object.freeze({
    no_db_writes_performed:                  true,
    no_lane_a_b_writes:                      true,
    no_trust_writes:                         true,
    no_policy_writes:                        true,
    no_customer_output:                      true,
    no_ams_product_layer_runtime_execution:  true,
    no_durable_pcf_table:                    true,
    no_migration_or_schema_change:           true,
  });
}

function buildRunMetadata(run_started_at: string, run_ended_at: string): ObserverRunMetadata {
  return Object.freeze({
    observer_version:                       OBSERVER_VERSION,
    product_context_profile_version:        PRODUCT_CONTEXT_PROFILE_VERSION,
    universal_surface_taxonomy_version:     UNIVERSAL_SURFACE_TAXONOMY_VERSION,
    category_template_version:              CATEGORY_TEMPLATE_VERSION,
    buying_role_lens_version:               BUYING_ROLE_LENS_VERSION,
    site_mapping_version:                   SITE_MAPPING_VERSION,
    excluded_mapping_version:               EXCLUDED_MAPPING_VERSION,
    timing_window_model_version:            TIMING_WINDOW_MODEL_VERSION,
    freshness_decay_model_version:          FRESHNESS_DECAY_MODEL_VERSION,
    source_table_poi:                       'poi_observations_v0_1',
    source_table_poi_sequence:              'poi_sequence_observations_v0_1',
    record_only:                            true,
    run_started_at,
    run_ended_at,
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

export { parseDatabaseUrl, renderMarkdown };

/* --------------------------------------------------------------------------
 * decideProductContextTimingCliExitCode
 *
 * Pure helper. Maps the structured `ObserverReport` to a CLI exit
 * code so the CLI can write a controlled stderr line and exit 2 on
 * fail-closed source readiness while still rendering the markdown
 * report for operator triage.
 *
 * Returns:
 *   - exit_code: number (0 = healthy, 2 = fail-closed)
 *   - stderr_message: string | null (controlled, single-line; never
 *     contains DSN / secrets / stack trace)
 * ------------------------------------------------------------------------ */

export interface CliExitDecision {
  readonly exit_code:      0 | 2;
  readonly stderr_message: string | null;
}

export function decideProductContextTimingCliExitCode(report: ObserverReport): CliExitDecision {
  if (report.source_readiness.fail_closed === true) {
    const reason = report.source_readiness.fail_closed_reason ?? 'unspecified source-readiness failure';
    return Object.freeze({
      exit_code:      2,
      stderr_message: `fail_closed source readiness: ${reason}`,
    });
  }
  return Object.freeze({ exit_code: 0, stderr_message: null });
}
