/**
 * Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer — runner.
 *
 * Pure orchestrator. Reuses PR#13b's
 * `runProductContextTimingObserverDetailed` to fetch preview
 * records, then reuses PR#14b's `buildBridgeNamespaceCandidate` to
 * turn each accepted preview into a `BridgeNamespaceCandidate`. No
 * new SQL. No DB writes. No AMS runtime execution.
 *
 * Determinism: no `Date.now()` / `new Date()` / `Math.random()` in
 * pure mapping code. Wall-clock timestamps come only from PR#13b's
 * detailed result and the explicit `evaluation_at` option.
 */

import type pg from 'pg';
import {
  ACTIONABILITY_BANDS_ALLOWED,
  runProductContextTimingObserverDetailed,
  timingBucketLabel,
  truncateSessionId,
  UNIVERSAL_SURFACES_ALLOWED,
  type ObserverRunOptions,
  type RunObserverArgs,
  type SessionPreview,
} from '../product-context-timing-observer/index.js';
import {
  ALLOWED_CONVERSION_PROXIMITY_INDICATORS,
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  buildBridgeNamespaceCandidate,
  type BridgeMapperInput,
  type BridgeNamespaceCandidate,
  type ValidateResult,
} from '../product-features-namespace-bridge/index.js';
import {
  BRIDGE_CANDIDATE_OBSERVER_VERSION,
  type BridgeCandidateExitDecision,
  type BridgeCandidateGenerationSummary,
  type BridgeCandidateObserverReport,
  type BridgeCandidateReadOnlyProof,
  type BridgeCandidateSample,
  type CandidateFeatureSummary,
  type ProductContextObserverInputSummary,
} from './types.js';

/* --------------------------------------------------------------------------
 * Internal helper — not exported; mirrors the numeric-aggregator
 * shape used in CandidateFeatureSummary.
 * ------------------------------------------------------------------------ */

interface NumericAggregator {
  count: number;
  sum:   number;
  min:   number | null;
  max:   number | null;
}

function emptyAggregator(): NumericAggregator {
  return { count: 0, sum: 0, min: null, max: null };
}

function pushAggregator(agg: NumericAggregator, v: number): void {
  agg.count++;
  agg.sum += v;
  if (agg.min === null || v < agg.min) agg.min = v;
  if (agg.max === null || v > agg.max) agg.max = v;
}

function aggregatorAvg(agg: NumericAggregator): number | null {
  return agg.count === 0 ? null : agg.sum / agg.count;
}

/* --------------------------------------------------------------------------
 * Pure: convert one accepted SessionPreview + the run-level
 * ObserverReport context into a PR#14b BridgeMapperInput.
 * ------------------------------------------------------------------------ */

export interface BuildBridgeMapperInputArgs {
  readonly preview:                                 SessionPreview;
  readonly observer_version:                        string;
  readonly product_context_profile_version:         string;
  readonly universal_surface_taxonomy_version:      string;
  readonly category_template_version:               string;
  readonly buying_role_lens_version:                string;
  readonly site_mapping_version:                    string;
  readonly excluded_mapping_version:                string;
  readonly timing_window_model_version:             string;
  readonly freshness_decay_model_version:           string;
  readonly source_poi_input_versions:               readonly string[];
  readonly source_poi_observation_versions:         readonly string[];
  readonly source_poi_sequence_versions:            readonly string[];
  readonly category_template:                       BridgeMapperInput['category_template'];
  readonly primary_conversion_goal:                 BridgeMapperInput['primary_conversion_goal'];
  readonly sales_motion:                            BridgeMapperInput['sales_motion'];
}

export function buildBridgeMapperInputFromPreview(args: BuildBridgeMapperInputArgs): BridgeMapperInput {
  const p = args.preview;

  // Per-session conversion-proximity indicators (PR#14b allowlist only).
  // Each indicator carries a count of `1` for "present in this session"
  // — the aggregate distribution sums them across sessions at the
  // observer level.
  const cpi: Record<string, number> = Object.create(null) as Record<string, number>;
  if (p.pricing_signal_present)                                cpi.pricing_visited      = 1;
  if (p.comparison_signal_present)                             cpi.comparison_visited   = 1;
  if ((p.surface_distribution['demo_request'] ?? 0) > 0)       cpi.demo_request_visited = 1;

  return Object.freeze({
    observer_version:                        args.observer_version,
    product_context_profile_version:         args.product_context_profile_version,
    universal_surface_taxonomy_version:      args.universal_surface_taxonomy_version,
    category_template_version:               args.category_template_version,
    buying_role_lens_version:                args.buying_role_lens_version,
    site_mapping_version:                    args.site_mapping_version,
    excluded_mapping_version:                args.excluded_mapping_version,
    timing_window_model_version:             args.timing_window_model_version,
    freshness_decay_model_version:           args.freshness_decay_model_version,
    source_poi_observation_versions:         args.source_poi_observation_versions,
    source_poi_input_versions:               args.source_poi_input_versions,
    source_poi_sequence_versions:            args.source_poi_sequence_versions,
    category_template:                       args.category_template,
    primary_conversion_goal:                 args.primary_conversion_goal,
    sales_motion:                            args.sales_motion,
    surface_distribution:                    p.surface_distribution,
    mapping_coverage_percent:                p.mapping_coverage_percent,
    unknown_surface_count:                   p.unknown_surface_count,
    excluded_surface_count:                  p.excluded_surface_count,
    poi_count:                               p.poi_count,
    unique_poi_count:                        p.unique_poi_count,
    pricing_signal_present:                  p.pricing_signal_present,
    comparison_signal_present:               p.comparison_signal_present,
    conversion_proximity_indicators:         Object.freeze(cpi),
    hours_since_last_qualifying_activity_or_null: p.hours_since_last_session_or_null,
    buyerrecon_actionability_band:           p.actionability_band,
    timing_bucket:                           timingBucketLabel(p.hours_since_last_session_or_null),
    progression_depth:                       p.progression_depth,
  });
}

/* --------------------------------------------------------------------------
 * Pure: classify a PR#14b reject-reason string into a top-level
 * family for aggregate reporting. Reasons of the form `family:value`
 * are grouped under `family`; reasons without a colon are used
 * as-is.
 * ------------------------------------------------------------------------ */

export function rejectReasonFamily(reason: string): string {
  const idx = reason.indexOf(':');
  return idx >= 0 ? reason.slice(0, idx) : reason;
}

/* --------------------------------------------------------------------------
 * decideBridgeCandidateObserverExit
 *
 * Pure helper. Maps the structured report to a CLI exit code.
 *   - fail_closed source readiness → exit 2
 *   - all candidate inputs rejected → exit 2 (every accepted preview
 *     failed PR#14b validation; treat as a candidate-generation
 *     failure beyond the implicit threshold)
 *   - otherwise → exit 0
 *
 * Returns single-line stderr message that NEVER contains secrets,
 * DSN, or stack traces.
 * ------------------------------------------------------------------------ */

export function decideBridgeCandidateObserverExit(
  report: BridgeCandidateObserverReport,
): BridgeCandidateExitDecision {
  if (report.source_readiness.fail_closed === true) {
    const reason = report.source_readiness.fail_closed_reason ?? 'unspecified source-readiness failure';
    return Object.freeze({
      exit_code:      2,
      status:         'fail',
      stderr_message: `fail_closed source readiness: ${reason}`,
    });
  }
  const g = report.bridge_candidate_generation;
  if (g.candidate_inputs_seen > 0 && g.candidates_built === 0) {
    return Object.freeze({
      exit_code:      2,
      status:         'fail',
      stderr_message: `bridge candidate generation failed: ${g.candidate_inputs_seen} input(s); 0 built; ${g.candidates_rejected} rejected`,
    });
  }
  return Object.freeze({ exit_code: 0, status: 'success', stderr_message: null });
}

/* --------------------------------------------------------------------------
 * Public entry point — observer runner
 * ------------------------------------------------------------------------ */

export interface RunBridgeCandidateObserverArgs {
  readonly client:        pg.Pool | pg.PoolClient | pg.Client;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
  readonly sample_limit?: number;          // default 3
}

const DEFAULT_SAMPLE_LIMIT_CANDIDATES = 3;

function buildReadOnlyProof(): BridgeCandidateReadOnlyProof {
  return Object.freeze({
    no_db_writes_performed:                 true,
    no_durable_bridge_table:                true,
    no_migration_or_schema_change:          true,
    no_customer_output:                     true,
    no_lane_a_b_output:                     true,
    no_trust_policy_output:                 true,
    no_ams_product_layer_runtime_execution: true,
    no_product_decision_created:            true,
  });
}

export async function runBridgeCandidateObserver(args: RunBridgeCandidateObserverArgs): Promise<BridgeCandidateObserverReport> {
  // Step 1: reuse PR#13b detailed runner
  const pr13bArgs: RunObserverArgs = {
    client:        args.client,
    options:       args.options,
    database_host: args.database_host,
    database_name: args.database_name,
  };
  const detailed = await runProductContextTimingObserverDetailed(pr13bArgs);
  const report   = detailed.report;
  const previews = detailed.previews;

  const sampleLimit = args.sample_limit ?? DEFAULT_SAMPLE_LIMIT_CANDIDATES;

  // Step 2: count preview reject reasons for the input-summary block
  const previewRejectReasonCounts: Record<string, number> = Object.create(null);
  for (const reason of Object.keys(report.evidence_quality.reject_reason_counts)) {
    previewRejectReasonCounts[reason] = report.evidence_quality.reject_reason_counts[reason as keyof typeof report.evidence_quality.reject_reason_counts] ?? 0;
  }

  const product_context_observer_input: ProductContextObserverInputSummary = Object.freeze({
    poi_rows_scanned:                  report.source_scan.poi_rows_scanned,
    poi_sequence_rows_scanned:         report.source_scan.poi_sequence_rows_scanned,
    unique_sessions_seen:              report.source_scan.unique_session_ids_seen,
    preview_accepted_rows:             report.evidence_quality.rows_accepted_into_preview,
    preview_rejected_rows:             report.evidence_quality.rows_rejected_from_preview,
    preview_reject_reason_counts:      Object.freeze(previewRejectReasonCounts),
    source_poi_input_versions:         report.source_scan.poi_input_versions_observed,
    source_poi_observation_versions:   report.source_scan.poi_observation_versions_observed,
    source_poi_sequence_versions:      report.source_scan.poi_sequence_versions_observed,
  });

  // Step 3: build bridge candidate per accepted preview
  const generationRejectReasonCounts: Record<string, number> = Object.create(null);
  const namespaceKeyDist:             Record<string, number> = Object.create(null);
  const bridgeContractDist:           Record<string, number> = Object.create(null);
  const bridgePayloadDist:            Record<string, number> = Object.create(null);
  const surfaceAggregate:             Record<string, number> = Object.create(null);
  const actionabilityDist = ((): Record<string, number> => {
    const r: Record<string, number> = Object.create(null);
    for (const b of ACTIONABILITY_BANDS_ALLOWED) r[b] = 0;
    return r;
  })();
  const conversionDist: Record<string, number> = Object.create(null);
  for (const k of ALLOWED_CONVERSION_PROXIMITY_INDICATORS) conversionDist[k] = 0;
  const progressionDepthDist: Record<string, number> = Object.create(null);

  const coverageAgg = emptyAggregator();
  const hoursAgg    = emptyAggregator();

  const samples: BridgeCandidateSample[] = [];

  const acceptedPreviews = previews.filter((p) => p.accepted_into_preview);
  let candidates_built     = 0;
  let candidates_rejected  = 0;

  for (const preview of acceptedPreviews) {
    const mapperInput = buildBridgeMapperInputFromPreview({
      preview,
      observer_version:                    report.run_metadata.observer_version,
      product_context_profile_version:     report.run_metadata.product_context_profile_version,
      universal_surface_taxonomy_version:  report.run_metadata.universal_surface_taxonomy_version,
      category_template_version:           report.run_metadata.category_template_version,
      buying_role_lens_version:            report.run_metadata.buying_role_lens_version,
      site_mapping_version:                report.run_metadata.site_mapping_version,
      excluded_mapping_version:            report.run_metadata.excluded_mapping_version,
      timing_window_model_version:         report.run_metadata.timing_window_model_version,
      freshness_decay_model_version:       report.run_metadata.freshness_decay_model_version,
      source_poi_input_versions:           report.source_scan.poi_input_versions_observed,
      source_poi_observation_versions:     report.source_scan.poi_observation_versions_observed,
      source_poi_sequence_versions:        report.source_scan.poi_sequence_versions_observed,
      category_template:                   report.product_context_preview.category_template,
      primary_conversion_goal:             report.product_context_preview.primary_conversion_goal,
      sales_motion:                        report.product_context_preview.sales_motion,
    });

    const result: ValidateResult = buildBridgeNamespaceCandidate(mapperInput);

    if (result.ok) {
      candidates_built++;
      const c = result.candidate;

      // Distributions
      namespaceKeyDist[c.namespace_key_candidate]   = (namespaceKeyDist[c.namespace_key_candidate]   ?? 0) + 1;
      bridgeContractDist[c.bridge_contract_version] = (bridgeContractDist[c.bridge_contract_version] ?? 0) + 1;
      bridgePayloadDist[c.bridge_payload_version]   = (bridgePayloadDist[c.bridge_payload_version]   ?? 0) + 1;

      // Surface aggregate
      for (const [label, count] of Object.entries(c.payload_candidate.fit_like_inputs.surface_distribution)) {
        surfaceAggregate[label] = (surfaceAggregate[label] ?? 0) + count;
      }

      // Actionability band
      const band = c.payload_candidate.timing_like_inputs.buyerrecon_actionability_band;
      actionabilityDist[band] = (actionabilityDist[band] ?? 0) + 1;

      // Conversion proximity aggregate (allowed keys only)
      for (const [k, v] of Object.entries(c.payload_candidate.intent_like_inputs.conversion_proximity_indicators)) {
        if (k in conversionDist) conversionDist[k] += v;
      }

      // Progression depth bucket
      const pd = c.payload_candidate.timing_like_inputs.progression_depth;
      const pdBucket = pd === 0 ? '0' : pd === 1 ? '1' : pd === 2 ? '2' : pd <= 5 ? '3..5' : pd <= 10 ? '6..10' : '11+';
      progressionDepthDist[pdBucket] = (progressionDepthDist[pdBucket] ?? 0) + 1;

      // Mapping coverage + hours since last
      pushAggregator(coverageAgg, c.payload_candidate.fit_like_inputs.mapping_coverage_percent);
      const hsl = c.payload_candidate.timing_like_inputs.hours_since_last_qualifying_activity_or_null;
      if (hsl !== null) pushAggregator(hoursAgg, hsl);

      // Sample (capped, ID-masked)
      if (samples.length < sampleLimit) {
        samples.push(Object.freeze({
          truncated_session_id_prefix: truncateSessionId(preview.session_id),
          bridge_candidate:            c,
          sample_metadata: Object.freeze({
            internal_only:                                            true as const,
            non_authoritative:                                        true as const,
            not_customer_facing:                                      true as const,
            does_not_execute_ams_product_layer:                       true as const,
            does_not_create_product_decision:                         true as const,
            exact_ams_struct_compatibility_unproven_until_fixture:    true as const,
          }),
        }));
      }
    } else {
      candidates_rejected++;
      for (const reason of result.reject_reasons) {
        const family = rejectReasonFamily(reason);
        generationRejectReasonCounts[family] = (generationRejectReasonCounts[family] ?? 0) + 1;
      }
    }
  }

  const bridge_candidate_generation: BridgeCandidateGenerationSummary = Object.freeze({
    candidate_inputs_seen:                acceptedPreviews.length,
    candidates_built,
    candidates_rejected,
    reject_reason_counts:                 Object.freeze(generationRejectReasonCounts),
    namespace_key_candidate_distribution: Object.freeze(namespaceKeyDist),
    bridge_contract_version_distribution: Object.freeze(bridgeContractDist),
    bridge_payload_version_distribution:  Object.freeze(bridgePayloadDist),
  });

  const candidate_feature_summary: CandidateFeatureSummary = Object.freeze({
    surface_distribution_aggregate:               Object.freeze(surfaceAggregate),
    actionability_band_distribution:              Object.freeze(actionabilityDist) as CandidateFeatureSummary['actionability_band_distribution'],
    conversion_proximity_indicator_distribution:  Object.freeze(conversionDist),
    progression_depth_distribution:               Object.freeze(progressionDepthDist),
    mapping_coverage_min:                         coverageAgg.min,
    mapping_coverage_max:                         coverageAgg.max,
    mapping_coverage_avg:                         aggregatorAvg(coverageAgg),
    hours_since_last_min_excluding_null:          hoursAgg.min,
    hours_since_last_max_excluding_null:          hoursAgg.max,
    hours_since_last_avg_excluding_null:          aggregatorAvg(hoursAgg),
  });

  // Step 4: assemble the report
  const draftReport: BridgeCandidateObserverReport = Object.freeze({
    boundary: Object.freeze({
      ...report.boundary,
      bridge_candidate_observer_version: BRIDGE_CANDIDATE_OBSERVER_VERSION,
      bridge_contract_version:           BRIDGE_CONTRACT_VERSION,
      bridge_payload_version:            BRIDGE_PAYLOAD_VERSION,
    }),
    source_readiness:                report.source_readiness,
    product_context_observer_input,
    bridge_candidate_generation,
    candidate_feature_summary,
    samples:                         Object.freeze(samples),
    read_only_proof:                 buildReadOnlyProof(),
    // Placeholder; replaced below once the exit decision is computed.
    exit_decision:                   Object.freeze({ exit_code: 0, status: 'success', stderr_message: null }),
  });

  // Step 5: compute exit decision against the assembled report and
  // splice it back in. We do this in two passes so the exit-decision
  // helper has read access to the final structured data, and the
  // returned report has the matching `exit_decision` block.
  const exit_decision = decideBridgeCandidateObserverExit(draftReport);
  return Object.freeze({ ...draftReport, exit_decision });
}

