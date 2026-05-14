/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Read-only observer over `poi_observations_v0_1` +
 * `poi_sequence_observations_v0_1`. Builds an internal preview
 * envelope that is *alignable* with the AMS BuyerRecon Product
 * Layer JSON shape (under `ProductFeatures.Namespace`) but is NOT
 * authoritative and does NOT execute AMS Product Layer logic.
 *
 * LOCKED BOUNDARY (PR#13a §2.1 + §17 reserved-name guard):
 *   - Observer reads ONLY `poi_observations_v0_1` +
 *     `poi_sequence_observations_v0_1` + `information_schema`.
 *   - Observer writes nothing.
 *   - Observer does NOT implement Fit / Intent / Window / TRQ /
 *     ProductDecision scoring (AMS Product Layer canonical).
 *   - Observer TypeScript runtime source does NOT redefine AMS
 *     reserved names: `Fit`, `FitFeatures`, `FitResult`, `FitScore`,
 *     `Intent`, `IntentFeatures`, `IntentResult`, `IntentState`,
 *     `Window`, `WindowFeatures`, `WindowResult`, `WindowState`,
 *     `TRQ`, `TRQResult`, `TRQBand`, `ProductDecision`,
 *     `ProductFeatures`, `ProductScorerInput`, `ProductScorer`,
 *     `BuyerReconConfig`, `BuyerReconProductFeatures`,
 *     `RequestedAction`. PR#13b uses `pcf_*` / `product_context_*`
 *     / `timing_*` / `actionability_*` / `evidence_preview_*`
 *     conventions instead.
 *   - Observer does NOT emit `FIT.*` / `INTENT.*` / `WINDOW.*`
 *     reason-code namespaces. PR#13b reasons live in `pcf_*`
 *     namespace only.
 *   - Observer does NOT make buyer-intent claims, customer-facing
 *     output, Trust / Policy / Lane A/B writes, or AMS Series Core
 *     runtime work.
 */

/* --------------------------------------------------------------------------
 * Frozen-literal version stamps for PR#13b v0.1.
 * Recorded on every report.run_metadata.
 * ------------------------------------------------------------------------ */

export const OBSERVER_VERSION                     = 'product-context-timing-observer-v0.1' as const;
export const PRODUCT_CONTEXT_PROFILE_VERSION      = 'pcp-v0.1' as const;
export const UNIVERSAL_SURFACE_TAXONOMY_VERSION   = 'ust-v0.1' as const;
export const CATEGORY_TEMPLATE_VERSION            = 'generic_b2b-v0.1' as const;
export const BUYING_ROLE_LENS_VERSION             = 'brl-v0.1-deferred' as const;
export const SITE_MAPPING_VERSION                 = 'site_map-v0.1-baseline' as const;
export const EXCLUDED_MAPPING_VERSION             = 'excl_map-v0.1-baseline' as const;
export const TIMING_WINDOW_MODEL_VERSION          = 'tw-v0.1' as const;
export const FRESHNESS_DECAY_MODEL_VERSION        = 'fd-v0.1' as const;

/* --------------------------------------------------------------------------
 * Universal surface taxonomy v0.1 (PR#13a §4.2 18-label seed).
 *
 * These are JSON-VALUE labels, NOT TypeScript class names — every
 * label is lowercase snake_case to match what AMS feature_adapter
 * expects under `BuyerReconProductFeatures.Fit.PageTypeDistribution`.
 * ------------------------------------------------------------------------ */

export const UNIVERSAL_SURFACES_ALLOWED = [
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
] as const;

export type UniversalSurface = typeof UNIVERSAL_SURFACES_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Excluded surfaces v0.1 — counted, NOT deleted from underlying
 * POI / POI Sequence evidence (PR#13a §4.6).
 * ------------------------------------------------------------------------ */

export const EXCLUDED_SURFACES: readonly UniversalSurface[] = Object.freeze([
  'legal_terms',
  'legal_privacy',
  'careers',
]);

/* --------------------------------------------------------------------------
 * Category template enum v0.1 (PR#13a §4.3).
 * ------------------------------------------------------------------------ */

export const CATEGORY_TEMPLATES_ALLOWED = [
  'generic_b2b',
  'b2b_software',
  'b2b_service_agency',
  'high_ticket_exporter',
] as const;
export type CategoryTemplate = typeof CATEGORY_TEMPLATES_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Primary conversion goal enum v0.1 (PR#13a §4.7).
 * ------------------------------------------------------------------------ */

export const PRIMARY_CONVERSION_GOALS_ALLOWED = [
  'book_demo',
  'request_diagnostic',
  'contact_sales',
  'download_report',
  'start_trial',
  'sign_up',
  'request_quote',
] as const;
export type PrimaryConversionGoal = typeof PRIMARY_CONVERSION_GOALS_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Sales motion enum v0.1 (PR#13a §4.8).
 * ------------------------------------------------------------------------ */

export const SALES_MOTIONS_ALLOWED = [
  'self_serve',
  'sales_led',
  'partner_led',
  'high_ticket_consultative',
  'product_led_assisted',
] as const;
export type SalesMotion = typeof SALES_MOTIONS_ALLOWED[number];

/* --------------------------------------------------------------------------
 * BuyerRecon-side actionability bands (PR#13a §4.10).
 *
 * NOT AMS `WindowState`. The coincidental `dormant` overlap is
 * namespace-disjoint (PR#13a §17). Runtime MUST NOT emit
 * `in_window` / `approaching` / `too_early` as PR#13b band values.
 * ------------------------------------------------------------------------ */

export const ACTIONABILITY_BANDS_ALLOWED = [
  'hot_now',
  'warm_recent',
  'cooling',
  'stale',
  'dormant',
  'insufficient_evidence',
] as const;
export type ActionabilityBand = typeof ACTIONABILITY_BANDS_ALLOWED[number];

/* --------------------------------------------------------------------------
 * PR#13b reason-code namespace (`pcf_*`).
 * DISJOINT from AMS `FIT.*` / `INTENT.*` / `WINDOW.*`.
 * ------------------------------------------------------------------------ */

export type PcfReasonToken =
  | 'pcf_evidence_strong'
  | 'pcf_evidence_thin'
  | 'pcf_evidence_excluded'
  | 'pcf_mapping_unknown'
  | 'pcf_stage0_excluded_session'
  | 'pcf_insufficient_evidence'
  | 'pcf_recent_activity'
  | 'pcf_stale_activity';

/* --------------------------------------------------------------------------
 * Defaults (PR#13b v0.1 — conservative, deterministic).
 * Per PR#13a recommendations + spec direction.
 * ------------------------------------------------------------------------ */

export const DEFAULT_CATEGORY_TEMPLATE:          CategoryTemplate          = 'generic_b2b';
export const DEFAULT_PRIMARY_CONVERSION_GOAL:    PrimaryConversionGoal     = 'request_diagnostic';
export const DEFAULT_SALES_MOTION:               SalesMotion               = 'sales_led';

/* --------------------------------------------------------------------------
 * Timing thresholds per sales motion (hours).
 * Conservative seed values (PR#13a OD-6 finalises real production
 * values).
 * ------------------------------------------------------------------------ */

export interface TimingThresholdsHours {
  readonly t_hot:     number;
  readonly t_warm:    number;
  readonly t_stale:   number;
  readonly t_dormant: number;
}

export const TIMING_THRESHOLDS_BY_SALES_MOTION:
  Readonly<Record<SalesMotion, TimingThresholdsHours>> = Object.freeze({
  self_serve:               Object.freeze({ t_hot:    4, t_warm:   48, t_stale:  336, t_dormant: 1440 }),
  product_led_assisted:     Object.freeze({ t_hot:    8, t_warm:   96, t_stale:  720, t_dormant: 2160 }),
  sales_led:                Object.freeze({ t_hot:   12, t_warm:  168, t_stale:  720, t_dormant: 2160 }),
  partner_led:              Object.freeze({ t_hot:   24, t_warm:  240, t_stale: 1440, t_dormant: 4320 }),
  high_ticket_consultative: Object.freeze({ t_hot:   24, t_warm:  336, t_stale: 2160, t_dormant: 4320 }),
});

/* --------------------------------------------------------------------------
 * Required column allowlist — used by the readiness check.
 *
 * If any required column is missing on the live table, the observer
 * fails closed with a clear error (not a silent zero).
 * ------------------------------------------------------------------------ */

export const REQUIRED_POI_COLUMNS: readonly string[] = Object.freeze([
  'poi_observation_id',
  'workspace_id', 'site_id', 'session_id',
  'poi_type', 'poi_key',
  'poi_input_version', 'poi_observation_version',
  'first_seen_at', 'last_seen_at',
  'stage0_excluded', 'poi_eligible',
]);

export const REQUIRED_POI_SEQUENCE_COLUMNS: readonly string[] = Object.freeze([
  'poi_sequence_observation_id',
  'workspace_id', 'site_id', 'session_id',
  'poi_sequence_version', 'poi_observation_version',
  'poi_count', 'unique_poi_count', 'has_progression', 'has_repetition',
  'progression_depth', 'poi_sequence_pattern_class',
  'first_seen_at', 'last_seen_at', 'duration_seconds',
  'stage0_excluded', 'poi_sequence_eligible',
]);

/* --------------------------------------------------------------------------
 * Run options — CLI parses env vars, hands them to the runner.
 * ------------------------------------------------------------------------ */

export interface ObserverRunOptions {
  readonly workspace_id:               string;
  readonly site_id:                    string;

  readonly window_start:               Date;
  readonly window_end:                 Date;

  readonly limit:                      number;
  readonly sample_limit:               number;

  /** Profile defaults applied when no per-customer profile fixture is supplied. */
  readonly category_template:          CategoryTemplate;
  readonly primary_conversion_goal:    PrimaryConversionGoal;
  readonly sales_motion:               SalesMotion;

  /** Evaluation clock passed in explicitly (NOT read inside pure logic). */
  readonly evaluation_at:              Date;
}

/* --------------------------------------------------------------------------
 * Reject reasons for the evidence-quality summary.
 * ------------------------------------------------------------------------ */

export type EvidencePreviewRejectReason =
  | 'missing_identity'
  | 'missing_timestamps'
  | 'mapping_unknown_surface'
  | 'excluded_surface_only'
  | 'stage0_excluded_session'
  | 'invalid_evidence_refs';

export const EVIDENCE_PREVIEW_REJECT_REASONS: readonly EvidencePreviewRejectReason[] = Object.freeze([
  'missing_identity',
  'missing_timestamps',
  'mapping_unknown_surface',
  'excluded_surface_only',
  'stage0_excluded_session',
  'invalid_evidence_refs',
]);

/* --------------------------------------------------------------------------
 * Internal report shape — markdown is generated FROM this structured
 * data by `report.ts::renderMarkdown`. The structured shape exists so
 * tests can assert on it without parsing markdown.
 * ------------------------------------------------------------------------ */

export interface BoundaryBlock {
  readonly workspace_id:        string;
  readonly site_id:             string;
  readonly window_start:        string;   // ISO-8601
  readonly window_end:          string;   // ISO-8601
  readonly checked_at:          string;   // ISO-8601
  readonly database_host:       string;   // masked
  readonly database_name:       string;
}

export interface SourceReadinessBlock {
  readonly poi_observations_v0_1_present:           boolean;
  readonly poi_sequence_observations_v0_1_present:  boolean;
  readonly poi_missing_columns:                     readonly string[];
  readonly poi_sequence_missing_columns:            readonly string[];
  readonly fail_closed:                             boolean;
  readonly fail_closed_reason:                      string | null;
}

export interface SourceScanBlock {
  readonly poi_rows_scanned:                        number;
  readonly poi_sequence_rows_scanned:               number;
  readonly unique_session_ids_seen:                 number;
  readonly poi_input_versions_observed:             readonly string[];
  readonly poi_observation_versions_observed:       readonly string[];
  readonly poi_sequence_versions_observed:          readonly string[];
  readonly earliest_observed_at:                    string | null;  // ISO-8601
  readonly latest_observed_at:                      string | null;  // ISO-8601
}

export interface EvidenceQualityBlock {
  readonly rows_accepted_into_preview:              number;
  readonly rows_rejected_from_preview:              number;
  readonly reject_reason_counts:                    Readonly<Record<EvidencePreviewRejectReason, number>>;
  readonly invalid_evidence_refs_count:             number;
  readonly unknown_surface_count:                   number;
  readonly excluded_surface_count:                  number;
}

export interface ProductContextPreviewBlock {
  readonly universal_surface_distribution:          Readonly<Record<string, number>>;
  readonly category_template:                       CategoryTemplate;
  readonly primary_conversion_goal:                 PrimaryConversionGoal;
  readonly sales_motion:                            SalesMotion;
  readonly site_mapping_version:                    string;
  readonly excluded_mapping_version:                string;
  readonly mapping_coverage_percent:                number;
}

export interface TimingActionabilityBlock {
  readonly actionability_band_distribution:         Readonly<Record<ActionabilityBand, number>>;
  readonly timing_window_bucket_distribution:       Readonly<Record<string, number>>;
  readonly stale_count:                             number;
  readonly dormant_count:                           number;
  readonly insufficient_evidence_count:             number;
  readonly conversion_proximity_indicators:         Readonly<Record<string, number>>;
}

export interface AmsAlignedJsonPreviewSample {
  readonly truncated_session_id_prefix:             string;
  readonly buyerrecon_product_features_shape_preview: {
    readonly fit:    { readonly page_type_distribution: Readonly<Record<string, number>>; readonly mapping_coverage_percent: number };
    readonly intent: { readonly pricing_signal_present: boolean; readonly comparison_signal_present: boolean; readonly poi_count: number; readonly unique_poi_count: number };
    readonly window: { readonly hours_since_last_session_or_null: number | null; readonly session_in_window_band: ActionabilityBand; readonly progression_depth: number };
  };
  readonly preview_metadata: {
    readonly non_authoritative:                                  true;
    readonly internal_only:                                      true;
    readonly alignable_with_ams_product_features_namespace:      true;
    readonly must_not_be_treated_as_ams_runtime_output:          true;
  };
}

export interface AmsAlignedJsonPreviewBlock {
  readonly samples:                                 readonly AmsAlignedJsonPreviewSample[];
  readonly disclaimer:                              string;
}

export interface ReadOnlyProofBlock {
  readonly no_db_writes_performed:                  true;
  readonly no_lane_a_b_writes:                      true;
  readonly no_trust_writes:                         true;
  readonly no_policy_writes:                        true;
  readonly no_customer_output:                      true;
  readonly no_ams_product_layer_runtime_execution:  true;
  readonly no_durable_pcf_table:                    true;
  readonly no_migration_or_schema_change:           true;
}

export interface ObserverRunMetadata {
  readonly observer_version:                        string;
  readonly product_context_profile_version:         string;
  readonly universal_surface_taxonomy_version:      string;
  readonly category_template_version:               string;
  readonly buying_role_lens_version:                string;
  readonly site_mapping_version:                    string;
  readonly excluded_mapping_version:                string;
  readonly timing_window_model_version:             string;
  readonly freshness_decay_model_version:           string;
  readonly source_table_poi:                        'poi_observations_v0_1';
  readonly source_table_poi_sequence:               'poi_sequence_observations_v0_1';
  readonly record_only:                             true;
  readonly run_started_at:                          string;
  readonly run_ended_at:                            string;
}

export interface ObserverReport {
  readonly boundary:                                BoundaryBlock;
  readonly source_readiness:                        SourceReadinessBlock;
  readonly source_scan:                             SourceScanBlock;
  readonly evidence_quality:                        EvidenceQualityBlock;
  readonly product_context_preview:                 ProductContextPreviewBlock;
  readonly timing_actionability:                    TimingActionabilityBlock;
  readonly ams_aligned_json_preview:                AmsAlignedJsonPreviewBlock;
  readonly read_only_proof:                         ReadOnlyProofBlock;
  readonly run_metadata:                            ObserverRunMetadata;
}

/* --------------------------------------------------------------------------
 * Raw row shapes (internal — runner consumes from pg).
 * ------------------------------------------------------------------------ */

export interface PoiRowRaw {
  readonly poi_observation_id:       unknown;
  readonly workspace_id:             unknown;
  readonly site_id:                  unknown;
  readonly session_id:               unknown;
  readonly poi_type:                 unknown;
  readonly poi_key:                  unknown;
  readonly poi_input_version:        unknown;
  readonly poi_observation_version:  unknown;
  readonly first_seen_at:            unknown;
  readonly last_seen_at:             unknown;
  readonly stage0_excluded:          unknown;
  readonly poi_eligible:             unknown;
}

export interface PoiSequenceRowRaw {
  readonly poi_sequence_observation_id:  unknown;
  readonly workspace_id:                 unknown;
  readonly site_id:                      unknown;
  readonly session_id:                   unknown;
  readonly poi_sequence_version:         unknown;
  readonly poi_observation_version:      unknown;
  readonly poi_count:                    unknown;
  readonly unique_poi_count:             unknown;
  readonly has_progression:              unknown;
  readonly has_repetition:               unknown;
  readonly progression_depth:            unknown;
  readonly poi_sequence_pattern_class:   unknown;
  readonly first_seen_at:                unknown;
  readonly last_seen_at:                 unknown;
  readonly duration_seconds:             unknown;
  readonly stage0_excluded:              unknown;
  readonly poi_sequence_eligible:        unknown;
  readonly evidence_refs:                unknown;
}
