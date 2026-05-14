/**
 * Sprint 2 PR#14b — ProductFeatures-Namespace Bridge — pure mapper.
 *
 * Pure module. NO clock reads. NO randomness. NO DB / SQL / pg /
 * process.env / filesystem.
 *
 * `buildBridgeNamespaceCandidate(input)` takes a PR#13b-style
 * preview-shape input object and returns a `ValidateResult` —
 * either the built `BridgeNamespaceCandidate` or a structured list
 * of reject reasons. Two-stage validation (pre-mapper input + post-
 * mapper candidate) guarantees no malformed candidate ever escapes.
 *
 * Determinism: same input → same output, every time. Key order in
 * the output is fixed by the literal object expression below. Maps
 * (surface_distribution, conversion_proximity_indicators) preserve
 * insertion order via a sorted-key copy.
 */

import {
  AMS_PRODUCT_LAYER_REFERENCE_VERSION,
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  NAMESPACE_KEY_CANDIDATE,
  type BridgeCandidatePayload,
  type BridgeMapperInput,
  type BridgeNamespaceCandidate,
  type BridgePreviewMetadata,
  type FitLikeInputs,
  type IntentLikeInputs,
  type SourceEvidenceVersions,
  type TimingLikeInputs,
  type ValidateResult,
} from './types.js';
import {
  validateBridgeCandidate,
  validateBridgeMapperInput,
} from './validate.js';

/* --------------------------------------------------------------------------
 * Sort-and-freeze helper — gives deterministic key order across
 * runs without relying on JS-engine-specific insertion order
 * stability (Node's V8 is stable but property-order edge cases
 * exist; sorting eliminates the ambiguity).
 * ------------------------------------------------------------------------ */

function sortedFrozenMap(m: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const keys = Object.keys(m).sort();
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const k of keys) out[k] = m[k]!;
  return Object.freeze(out);
}

function sortedFrozenStringArray(arr: readonly string[]): readonly string[] {
  return Object.freeze([...arr].sort());
}

/* --------------------------------------------------------------------------
 * Frozen preview metadata block — every flag is the literal `true`.
 * ------------------------------------------------------------------------ */

const PREVIEW_METADATA: BridgePreviewMetadata = Object.freeze({
  internal_only:                                            true,
  non_authoritative:                                        true,
  not_customer_facing:                                      true,
  does_not_execute_ams_product_layer:                       true,
  does_not_create_product_decision:                         true,
  exact_ams_struct_compatibility_unproven_until_fixture:    true,
});

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export function buildBridgeNamespaceCandidate(input: BridgeMapperInput): ValidateResult {
  // Stage 1: input validation
  const inputReasons = validateBridgeMapperInput(input);
  if (inputReasons.length > 0) {
    return Object.freeze({ ok: false, reject_reasons: inputReasons });
  }

  // Stage 2: build the candidate deterministically
  const fit_like_inputs: FitLikeInputs = Object.freeze({
    surface_distribution:       sortedFrozenMap(input.surface_distribution),
    mapping_coverage_percent:   input.mapping_coverage_percent,
    unknown_surface_count:      input.unknown_surface_count,
    excluded_surface_count:     input.excluded_surface_count,
    category_template:          input.category_template,
    site_mapping_version:       input.site_mapping_version,
  });

  const intent_like_inputs: IntentLikeInputs = Object.freeze({
    poi_count:                       input.poi_count,
    unique_poi_count:                input.unique_poi_count,
    pricing_signal_present:          input.pricing_signal_present,
    comparison_signal_present:       input.comparison_signal_present,
    conversion_proximity_indicators: sortedFrozenMap(input.conversion_proximity_indicators),
  });

  const timing_like_inputs: TimingLikeInputs = Object.freeze({
    hours_since_last_qualifying_activity_or_null: input.hours_since_last_qualifying_activity_or_null,
    buyerrecon_actionability_band:                input.buyerrecon_actionability_band,
    timing_bucket:                                input.timing_bucket,
    progression_depth:                            input.progression_depth,
    freshness_decay_model_version:                input.freshness_decay_model_version,
    sales_motion:                                 input.sales_motion,
    primary_conversion_goal:                      input.primary_conversion_goal,
  });

  const payload_candidate: BridgeCandidatePayload = Object.freeze({
    fit_like_inputs,
    intent_like_inputs,
    timing_like_inputs,
  });

  const source_evidence_versions: SourceEvidenceVersions = Object.freeze({
    poi_observation_versions:  sortedFrozenStringArray(input.source_poi_observation_versions),
    poi_input_versions:        sortedFrozenStringArray(input.source_poi_input_versions),
    poi_sequence_versions:     sortedFrozenStringArray(input.source_poi_sequence_versions),
  });

  const candidate: BridgeNamespaceCandidate = Object.freeze({
    bridge_contract_version:               BRIDGE_CONTRACT_VERSION,
    bridge_payload_version:                BRIDGE_PAYLOAD_VERSION,
    generated_from_observer_version:       input.observer_version,
    product_context_profile_version:       input.product_context_profile_version,
    universal_surface_taxonomy_version:    input.universal_surface_taxonomy_version,
    category_template_version:             input.category_template_version,
    buying_role_lens_version:              input.buying_role_lens_version,
    site_mapping_version:                  input.site_mapping_version,
    excluded_mapping_version:              input.excluded_mapping_version,
    timing_window_model_version:           input.timing_window_model_version,
    freshness_decay_model_version:         input.freshness_decay_model_version,
    source_evidence_versions,
    ams_product_layer_reference_version:   input.ams_product_layer_reference_version ?? AMS_PRODUCT_LAYER_REFERENCE_VERSION,
    namespace_key_candidate:               NAMESPACE_KEY_CANDIDATE,
    payload_candidate,
    preview_metadata:                      PREVIEW_METADATA,
  });

  // Stage 3: post-mapper validation (defence-in-depth — every
  // forbidden key / value scan runs against the built object).
  const candidateReasons = validateBridgeCandidate(candidate);
  if (candidateReasons.length > 0) {
    return Object.freeze({ ok: false, reject_reasons: candidateReasons });
  }

  return Object.freeze({ ok: true, candidate });
}
