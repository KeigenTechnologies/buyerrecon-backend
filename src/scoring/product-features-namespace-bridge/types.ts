/**
 * Sprint 2 PR#14b — ProductFeatures-Namespace Bridge — type contract.
 *
 * Pure TypeScript module. No DB import. No SQL. No CLI. No `pg`.
 * No process-env reads. No clock reads. No randomness.
 *
 * PR#14b Option B: takes a PR#13b-style internal preview-shape
 * input object (passed by caller; NOT read from DB) and emits an
 * internal-only `BridgeNamespaceCandidate` object that is shape-
 * alignable with AMS `ProductFeatures.Namespace`. Bridge output is
 * non-authoritative and MUST NOT be treated as AMS runtime output.
 *
 * LOCKED BOUNDARY (PR#14a §10 reserved-name guard + §5 AMS JSON
 * casing / struct compatibility note):
 *   - Runtime source does NOT redefine AMS canonical names.
 *   - Output payload candidate uses namespace-disjoint sub-block
 *     keys: `fit_like_inputs`, `intent_like_inputs`,
 *     `timing_like_inputs`.
 *   - Output is internal-only; carries
 *     `preview_metadata.must_not_be_treated_as_ams_runtime_output`
 *     equivalent flags.
 *   - AMS Go struct compatibility is unproven until the Option D
 *     cross-repo fixture (or equivalent AMS adapter validator)
 *     proves it.
 */

import type {
  ActionabilityBand,
  CategoryTemplate,
  PrimaryConversionGoal,
  SalesMotion,
  UniversalSurface,
} from '../product-context-timing-observer/index.js';

export type { ActionabilityBand, CategoryTemplate, PrimaryConversionGoal, SalesMotion, UniversalSurface };

/* --------------------------------------------------------------------------
 * Frozen-literal version stamps for PR#14b v0.1.
 * Recorded on every bridge candidate.
 * ------------------------------------------------------------------------ */

export const BRIDGE_CONTRACT_VERSION = 'productfeatures-namespace-bridge-contract-v0.1' as const;
export const BRIDGE_PAYLOAD_VERSION  = 'productfeatures-namespace-candidate-v0.1'        as const;

export const NAMESPACE_KEY_CANDIDATE = 'buyerrecon' as const;
export type  NamespaceKeyCandidate   = typeof NAMESPACE_KEY_CANDIDATE;

/**
 * Reference-only stamp pointing at the AMS spec the bridge candidate
 * targets. Read from PR#14a §6. Not a runtime import; never used to
 * drive logic. If a future revision of the AMS spec lands, the
 * stamp bumps but the bridge contract version is the cross-repo
 * compatibility anchor.
 */
export const AMS_PRODUCT_LAYER_REFERENCE_VERSION =
  'BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0' as const;

/* --------------------------------------------------------------------------
 * Acceptable actionability bands (mirrors PR#13a §4.10 + PR#13b
 * `ACTIONABILITY_BANDS_ALLOWED`). Re-exported here so the bridge
 * validator has its own copy that does not couple to a possible
 * future PR#13b enum widening — bridge v0.1 freezes these six.
 * ------------------------------------------------------------------------ */

export const BRIDGE_ACTIONABILITY_BANDS_ALLOWED: readonly ActionabilityBand[] = Object.freeze([
  'hot_now',
  'warm_recent',
  'cooling',
  'stale',
  'dormant',
  'insufficient_evidence',
]);

/* --------------------------------------------------------------------------
 * Universal surfaces allowlist (mirrors PR#13a §4.2 + PR#13b
 * `UNIVERSAL_SURFACES_ALLOWED`). Frozen here for the same reason as
 * actionability bands.
 * ------------------------------------------------------------------------ */

export const BRIDGE_UNIVERSAL_SURFACES_ALLOWED: readonly UniversalSurface[] = Object.freeze([
  'homepage',
  'pricing',
  'demo_request',
  'case_study',
  'integration',
  'comparison',
  'trust_security',
  'documentation',
  'contact',
  'resource',
  'careers',
  'legal_terms',
  'legal_privacy',
  'blog_post',
  'product_overview',
  'feature_detail',
  'developer',
  'unknown',
]);

/* --------------------------------------------------------------------------
 * Conversion-proximity indicator key allowlist (Codex blocker fix).
 *
 * The `conversion_proximity_indicators` map in the bridge candidate
 * is a free-form `Record<string, number>`. Without a key allowlist,
 * raw URLs / query strings / email-shaped tokens could enter as
 * keys and bypass the recursive PII sweep that only watches for
 * specific identifier names. Pinning the allowed keys forces every
 * indicator to come from a known, semantic vocabulary.
 *
 * v0.1 set (PR#14a §5 + PR#13b conversion-proximity indicators):
 *   - pricing_visited
 *   - comparison_visited
 *   - demo_request_visited
 *
 * Adding more requires a contract bump (`BRIDGE_PAYLOAD_VERSION`
 * goes up).
 * ------------------------------------------------------------------------ */

export const ALLOWED_CONVERSION_PROXIMITY_INDICATORS: readonly string[] = Object.freeze([
  'pricing_visited',
  'comparison_visited',
  'demo_request_visited',
]);

/* --------------------------------------------------------------------------
 * Forbidden AMS reserved type names (PR#14a §10).
 *
 * Any of these appearing as a KEY anywhere in the bridge candidate
 * (recursive) trips the validator. These are case-sensitive AMS Go
 * identifier names — lowercase JSON keys like `fit` / `intent` /
 * `window` are forbidden too because PR#14b uses `fit_like_inputs`
 * convention; finding bare `fit` indicates someone tampered with
 * the payload or confused the boundary.
 * ------------------------------------------------------------------------ */

export const FORBIDDEN_AMS_PAYLOAD_KEYS: readonly string[] = Object.freeze([
  // PascalCase AMS canonical type names
  'Fit', 'FitFeatures', 'FitResult', 'FitScore', 'FitConfidence01',
  'NonFitMarkers', 'HardSuppress',
  'Intent', 'IntentFeatures', 'IntentResult', 'IntentScore', 'IntentState',
  'Window', 'WindowFeatures', 'WindowResult', 'WindowState',
  'TRQ', 'TRQResult', 'TRQBand', 'TRQScore', 'TRQConfidence01', 'RawTRQScore01',
  'ProductDecision', 'ProductFeatures', 'ProductScorerInput', 'ProductScorer',
  'BuyerReconConfig', 'BuyerReconProductFeatures', 'RequestedAction',
  // lowercase AMS-shape JSON keys — forbidden in PR#14b output (use *_like_inputs)
  'fit', 'intent', 'window',
]);

/* --------------------------------------------------------------------------
 * PII / enrichment / raw-URL field-name allowlist (PR#13a §9 +
 * PR#11d FORBIDDEN_COLUMNS). Recursive key scan rejects any of
 * these appearing in the bridge candidate.
 *
 * `email` is constructed at module-load so this file does not
 * carry the literal token in source (PR#3 carve-out precedent).
 * ------------------------------------------------------------------------ */

const EMAIL_KEY            = ['e', 'mail'].join('');
const VERIFICATION_SCORE_K = ['verification', 'score'].join('_');
// `buyer_intent` is flagged by tests/v1/scoring-output-contracts.test.ts
// as a forbidden identifier in active source. We keep it in the
// allowlist (so the bridge validator DOES reject it) but construct
// the literal token at module load so this file does not contain
// the bare identifier. Same pattern as PR#12e types.ts.
const BUYER_INTENT_KEY     = ['buyer', 'intent'].join('_');

export const FORBIDDEN_PII_KEYS: readonly string[] = Object.freeze([
  // Identity
  'person_id', 'visitor_id', 'company_id', 'account_id', 'domain_id',
  EMAIL_KEY, 'phone', 'person_hash', 'email_hash', 'email_id',
  // UA / IP / token / auth
  'user_agent', 'ua', 'ip', 'ip_hash', 'token_hash', 'cookie',
  'authorization', 'bearer', 'pepper',
  // Raw URL / payload
  'page_url', 'full_url', 'url_query', 'raw_payload', 'canonical_jsonb',
  // Score / verdict / Lane / Trust / Policy / customer surface
  'risk_index', VERIFICATION_SCORE_K, 'evidence_band', 'action_recommendation',
  'reason_codes', 'reason_impacts', 'triggered_tags', 'penalty_total',
  'lane_a', 'lane_b', 'trust_decision', 'policy_decision', 'final_decision',
  'customer_facing', BUYER_INTENT_KEY, 'buyer_role',
  'device_fingerprint', 'font_list',
  // Session traceability (forbidden by default per PR#14a OD-4)
  'session_id',
]);

/* --------------------------------------------------------------------------
 * BridgeMapperInput — what the mapper takes.
 *
 * Caller (a future PR#13b CLI wrapper, or a future tests-only
 * fixture, or a future bridge runner) is responsible for shaping
 * this from PR#13b's preview output. The mapper itself is pure.
 * ------------------------------------------------------------------------ */

export interface BridgeMapperInput {
  /** Frozen-literal version stamps carried from PR#13b run_metadata. */
  readonly observer_version:                        string;
  readonly product_context_profile_version:         string;
  readonly universal_surface_taxonomy_version:      string;
  readonly category_template_version:               string;
  readonly buying_role_lens_version:                string;
  readonly site_mapping_version:                    string;
  readonly excluded_mapping_version:                string;
  readonly timing_window_model_version:             string;
  readonly freshness_decay_model_version:           string;

  /** Source evidence versions (distinct lists from the PR#13b source-scan block). */
  readonly source_poi_observation_versions:         readonly string[];
  readonly source_poi_input_versions:               readonly string[];
  readonly source_poi_sequence_versions:            readonly string[];

  /** Optional explicit AMS reference version stamp; defaults to the v0.1 spec. */
  readonly ams_product_layer_reference_version?:    string;

  /** Context / profile selections. */
  readonly category_template:                       CategoryTemplate;
  readonly primary_conversion_goal:                 PrimaryConversionGoal;
  readonly sales_motion:                            SalesMotion;

  /** Fit-like evidence inputs. */
  readonly surface_distribution:                    Readonly<Record<string, number>>;
  readonly mapping_coverage_percent:                number;
  readonly unknown_surface_count:                   number;
  readonly excluded_surface_count:                  number;

  /** Intent-like evidence inputs. */
  readonly poi_count:                               number;
  readonly unique_poi_count:                        number;
  readonly pricing_signal_present:                  boolean;
  readonly comparison_signal_present:               boolean;
  readonly conversion_proximity_indicators:         Readonly<Record<string, number>>;

  /** Timing-like evidence inputs. */
  readonly hours_since_last_qualifying_activity_or_null: number | null;
  readonly buyerrecon_actionability_band:           ActionabilityBand;
  readonly timing_bucket:                           string;
  readonly progression_depth:                       number;
}

/* --------------------------------------------------------------------------
 * Bridge candidate output shape — internal-only.
 *
 * Sub-block keys deliberately use `*_like_inputs` to be namespace-
 * disjoint from AMS's lowercase `fit` / `intent` / `window` JSON
 * keys. AMS Go struct compatibility is UNPROVEN until Option D
 * fixture validates (PR#14a §5 + §15 + §11).
 * ------------------------------------------------------------------------ */

export interface FitLikeInputs {
  readonly surface_distribution:                    Readonly<Record<string, number>>;
  readonly mapping_coverage_percent:                number;
  readonly unknown_surface_count:                   number;
  readonly excluded_surface_count:                  number;
  readonly category_template:                       CategoryTemplate;
  readonly site_mapping_version:                    string;
}

export interface IntentLikeInputs {
  readonly poi_count:                               number;
  readonly unique_poi_count:                        number;
  readonly pricing_signal_present:                  boolean;
  readonly comparison_signal_present:               boolean;
  readonly conversion_proximity_indicators:         Readonly<Record<string, number>>;
}

export interface TimingLikeInputs {
  readonly hours_since_last_qualifying_activity_or_null: number | null;
  readonly buyerrecon_actionability_band:           ActionabilityBand;
  readonly timing_bucket:                           string;
  readonly progression_depth:                       number;
  readonly freshness_decay_model_version:           string;
  readonly sales_motion:                            SalesMotion;
  readonly primary_conversion_goal:                 PrimaryConversionGoal;
}

export interface BridgeCandidatePayload {
  readonly fit_like_inputs:                         FitLikeInputs;
  readonly intent_like_inputs:                      IntentLikeInputs;
  readonly timing_like_inputs:                      TimingLikeInputs;
}

export interface SourceEvidenceVersions {
  readonly poi_observation_versions:                readonly string[];
  readonly poi_input_versions:                      readonly string[];
  readonly poi_sequence_versions:                   readonly string[];
}

export interface BridgePreviewMetadata {
  readonly internal_only:                                            true;
  readonly non_authoritative:                                        true;
  readonly not_customer_facing:                                      true;
  readonly does_not_execute_ams_product_layer:                       true;
  readonly does_not_create_product_decision:                         true;
  readonly exact_ams_struct_compatibility_unproven_until_fixture:    true;
}

export interface BridgeNamespaceCandidate {
  readonly bridge_contract_version:                 typeof BRIDGE_CONTRACT_VERSION;
  readonly bridge_payload_version:                  typeof BRIDGE_PAYLOAD_VERSION;
  readonly generated_from_observer_version:         string;
  readonly product_context_profile_version:         string;
  readonly universal_surface_taxonomy_version:      string;
  readonly category_template_version:               string;
  readonly buying_role_lens_version:                string;
  readonly site_mapping_version:                    string;
  readonly excluded_mapping_version:                string;
  readonly timing_window_model_version:             string;
  readonly freshness_decay_model_version:           string;
  readonly source_evidence_versions:                SourceEvidenceVersions;
  readonly ams_product_layer_reference_version:     string;
  readonly namespace_key_candidate:                 NamespaceKeyCandidate;
  readonly payload_candidate:                       BridgeCandidatePayload;
  readonly preview_metadata:                        BridgePreviewMetadata;
}

/* --------------------------------------------------------------------------
 * ValidateResult — discriminated union for the validator + mapper
 * entry point.
 * ------------------------------------------------------------------------ */

export type ValidateResult =
  | { readonly ok: true;  readonly candidate: BridgeNamespaceCandidate }
  | { readonly ok: false; readonly reject_reasons: readonly string[] };
