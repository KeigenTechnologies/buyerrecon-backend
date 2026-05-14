/**
 * Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer — types.
 *
 * Pure module. No DB import. No SQL constants here (the observer
 * reuses PR#13b's runner for the data fetch + the same SQL allowlist).
 *
 * Read-only observer CLI that:
 *   1. Reuses `runProductContextTimingObserverDetailed` (PR#13b) to
 *      fetch + classify per-session preview records from real POI /
 *      POI Sequence evidence.
 *   2. Converts every accepted preview into a PR#14b BridgeMapperInput.
 *   3. Calls PR#14b `buildBridgeNamespaceCandidate` per session.
 *   4. Aggregates success/reject counts + emits a markdown report.
 *
 * BOUNDARY (locked):
 *   - Read scope = PR#13b read scope (POI + POI Sequence +
 *     information_schema).
 *   - Writes: none.
 *   - No durable bridge table, no migration, no schema change.
 *   - No AMS Product Layer runtime execution.
 *   - No `ProductDecision` minted.
 *   - No customer output.
 *   - No reserved AMS runtime names defined in TypeScript source.
 */

import type {
  BoundaryBlock,
  SourceReadinessBlock,
} from '../product-context-timing-observer/index.js';
import type {
  ActionabilityBand,
  BridgeNamespaceCandidate,
} from '../product-features-namespace-bridge/index.js';

/* --------------------------------------------------------------------------
 * Frozen version stamp for PR#14c v0.1.
 * ------------------------------------------------------------------------ */

export const BRIDGE_CANDIDATE_OBSERVER_VERSION =
  'product-features-bridge-candidate-observer-v0.1' as const;

/* --------------------------------------------------------------------------
 * PR#14b validator-style reject-reason aggregator buckets.
 *
 * The actual reject reasons come back as opaque `string[]` from
 * the PR#14b validator. The observer counts the top-level family
 * (the prefix before the first `:` if present, else the whole
 * token) for aggregate reporting. Specific reasons remain available
 * per-row but are NOT carried into the markdown sample to avoid
 * leaking the failing payload's content.
 * ------------------------------------------------------------------------ */

export type BridgeRejectFamily =
  | 'input_not_object'
  | 'missing_or_empty_version_field'
  | 'missing_or_invalid_string_array'
  | 'invalid_ams_product_layer_reference_version'
  | 'missing_or_empty_field'
  | 'invalid_surface_distribution'
  | 'unknown_surface_label'
  | 'invalid_mapping_coverage_percent'
  | 'invalid_unknown_surface_count'
  | 'invalid_excluded_surface_count'
  | 'invalid_poi_count'
  | 'invalid_unique_poi_count'
  | 'unique_poi_count_exceeds_poi_count'
  | 'invalid_pricing_signal_present'
  | 'invalid_comparison_signal_present'
  | 'invalid_conversion_proximity_indicators'
  | 'unknown_conversion_proximity_indicator_key'
  | 'invalid_conversion_proximity_indicator_value'
  | 'invalid_hours_since_last_qualifying_activity_or_null'
  | 'invalid_buyerrecon_actionability_band'
  | 'invalid_progression_depth'
  | 'invalid_timing_bucket'
  | 'candidate_not_object'
  | 'missing_candidate_field'
  | 'invalid_namespace_key_candidate'
  | 'invalid_source_evidence_versions_object'
  | 'invalid_source_evidence_versions_field'
  | 'invalid_preview_metadata_object'
  | 'preview_metadata_flag_must_be_true'
  | 'invalid_payload_candidate_object'
  | 'invalid_payload_sub_block'
  | 'payload_invalid_field'
  | 'forbidden_ams_runtime_key_present'
  | 'forbidden_pii_or_enrichment_key_present'
  | 'forbidden_ams_reason_namespace_value_present'
  | 'other';

/* --------------------------------------------------------------------------
 * Sample shape — capped, masked. Contains the structured bridge
 * candidate (from PR#14b) but NEVER raw URLs, full session IDs,
 * email-shaped tokens, etc. — PR#14b's recursive guard would have
 * rejected such payloads before they reached the sample.
 *
 * The PR#14b candidate carries its own `preview_metadata` block;
 * we re-state the flags at the sample level so an operator reading
 * just the sample sees the boundary explicitly.
 * ------------------------------------------------------------------------ */

export interface BridgeCandidateSample {
  readonly truncated_session_id_prefix: string;
  readonly bridge_candidate:            BridgeNamespaceCandidate;
  readonly sample_metadata: {
    readonly internal_only:                                            true;
    readonly non_authoritative:                                        true;
    readonly not_customer_facing:                                      true;
    readonly does_not_execute_ams_product_layer:                       true;
    readonly does_not_create_product_decision:                         true;
    readonly exact_ams_struct_compatibility_unproven_until_fixture:    true;
  };
}

/* --------------------------------------------------------------------------
 * Observer report — structured input to the markdown renderer.
 * ------------------------------------------------------------------------ */

export interface ProductContextObserverInputSummary {
  readonly poi_rows_scanned:                       number;
  readonly poi_sequence_rows_scanned:              number;
  readonly unique_sessions_seen:                   number;
  readonly preview_accepted_rows:                  number;
  readonly preview_rejected_rows:                  number;
  readonly preview_reject_reason_counts:           Readonly<Record<string, number>>;
  readonly source_poi_input_versions:              readonly string[];
  readonly source_poi_observation_versions:        readonly string[];
  readonly source_poi_sequence_versions:           readonly string[];
}

export interface BridgeCandidateGenerationSummary {
  readonly candidate_inputs_seen:                  number;
  readonly candidates_built:                       number;
  readonly candidates_rejected:                    number;
  readonly reject_reason_counts:                   Readonly<Record<string, number>>;
  readonly namespace_key_candidate_distribution:   Readonly<Record<string, number>>;
  readonly bridge_contract_version_distribution:   Readonly<Record<string, number>>;
  readonly bridge_payload_version_distribution:    Readonly<Record<string, number>>;
}

export interface CandidateFeatureSummary {
  readonly surface_distribution_aggregate:         Readonly<Record<string, number>>;
  readonly actionability_band_distribution:        Readonly<Record<ActionabilityBand, number>>;
  readonly conversion_proximity_indicator_distribution: Readonly<Record<string, number>>;
  readonly progression_depth_distribution:         Readonly<Record<string, number>>;
  readonly mapping_coverage_min:                   number | null;
  readonly mapping_coverage_max:                   number | null;
  readonly mapping_coverage_avg:                   number | null;
  readonly hours_since_last_min_excluding_null:    number | null;
  readonly hours_since_last_max_excluding_null:    number | null;
  readonly hours_since_last_avg_excluding_null:    number | null;
}

export interface BridgeCandidateReadOnlyProof {
  readonly no_db_writes_performed:                 true;
  readonly no_durable_bridge_table:                true;
  readonly no_migration_or_schema_change:          true;
  readonly no_customer_output:                     true;
  readonly no_lane_a_b_output:                     true;
  readonly no_trust_policy_output:                 true;
  readonly no_ams_product_layer_runtime_execution: true;
  readonly no_product_decision_created:            true;
}

export interface BridgeCandidateExitDecision {
  readonly exit_code:      0 | 2;
  readonly status:         'success' | 'fail';
  readonly stderr_message: string | null;
}

export interface BridgeCandidateObserverReport {
  readonly boundary:                               BoundaryBlock & {
    readonly bridge_candidate_observer_version:    string;
    readonly bridge_contract_version:              string;
    readonly bridge_payload_version:               string;
  };
  readonly source_readiness:                       SourceReadinessBlock;
  readonly product_context_observer_input:         ProductContextObserverInputSummary;
  readonly bridge_candidate_generation:            BridgeCandidateGenerationSummary;
  readonly candidate_feature_summary:              CandidateFeatureSummary;
  readonly samples:                                readonly BridgeCandidateSample[];
  readonly read_only_proof:                        BridgeCandidateReadOnlyProof;
  readonly exit_decision:                          BridgeCandidateExitDecision;
}
