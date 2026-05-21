/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer (refresh) — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Read-only observer over the existing BuyerRecon evidence tables. Builds
 * an internal preview / pass-forward shape that PR#18d (Pass 1 planning)
 * can consume. NOT customer-facing. NOT a Lane A/B writer. NOT an AMS
 * runtime bridge. NOT a final Product Layer decision. NOT a Trust score.
 * NOT a Pass 1 / Pass 2 verdict.
 *
 * Boundary (PR#18b §1 / §2 / §5 / §11):
 *   - SELECT only against the §3 source set; no INSERT / UPDATE / DELETE.
 *   - No durable output table; no migration; no schema change.
 *   - No customer claim text in any field.
 *   - Confidence is capped at "medium" — observer never emits "high".
 *   - Synthetic Gate 2 / Gate 3 proof rows are categorically excluded from
 *     commercial candidate evaluation (PR#18b §6); excluded counts are
 *     reported separately. Proof rows are NEVER deleted.
 *   - Module does NOT redefine AMS reserved names (PR#14a §10): no `Fit`,
 *     `Intent`, `Window`, `WindowState`, `ProductDecision`, `RequestedAction`,
 *     `TRQ`, `BuyerReconProductFeatures`, `Pass1`, `Pass2`, `TrustDecisionV3`.
 *   - Module does NOT emit `FIT.*` / `INTENT.*` / `WINDOW.*` /
 *     `PRODUCT_DECISION.*` / `REQUESTED_ACTION.*` strings anywhere.
 */

/* --------------------------------------------------------------------------
 * Frozen-literal version stamps for PR#18c v0.1.
 * ------------------------------------------------------------------------ */

export const OBSERVER_VERSION                       = 'timing-product-context-observer-v0.1' as const;
export const REPORT_VERSION                         = 'timing-product-context-observer-v0.1' as const;
export const PASS_FORWARD_CONTRACT_VERSION          = 'timing-product-context-pass-forward-v0.1' as const;
export const SYNTHETIC_EXCLUSION_RULE_VERSION       = 'synthetic-fixture-exclusion-v0.1' as const;
export const TIMING_BAND_THRESHOLDS_VERSION         = 'timing-band-thresholds-v0.1-observer-only' as const;
export const CONFIDENCE_CAP_POLICY_VERSION          = 'confidence-cap-policy-v0.1-low-medium-only' as const;

/* --------------------------------------------------------------------------
 * Timing band enum (PR#18b §7.1) — categorical, observer-only.
 * ------------------------------------------------------------------------ */

export const TIMING_BANDS_ALLOWED = [
  'hot_now',
  'warm_recent',
  'cooling',
  'stale',
  'dormant',
  'insufficient_evidence',
] as const;
export type TimingBand = typeof TIMING_BANDS_ALLOWED[number];

/**
 * v0.1 observer thresholds (NOT customer-facing scoring). Measured in
 * hours-since-most-recent-server-side-evidence-event. PR#18b §10 / OD-3
 * locks these only as observer-level placeholders — recalibration belongs
 * to PR#18d (Pass 1) or later, after commercial v1 evidence accumulates.
 *
 * The thresholds are intentionally conservative: any uncertainty defaults
 * to `insufficient_evidence`, not to an aggressive band.
 */
export const TIMING_BAND_THRESHOLDS_HOURS = Object.freeze({
  hot_now_max_hours:     1,    // (-inf, 1h]   → hot_now
  warm_recent_max_hours: 24,   // (1h, 24h]    → warm_recent
  cooling_max_hours:     168,  // (24h, 7d]    → cooling   (7 * 24)
  stale_max_hours:       720,  // (7d, 30d]    → stale     (30 * 24)
  dormant_max_hours:     2160, // (30d, 90d]   → dormant   (90 * 24)
  // > 2160h or no evidence  → insufficient_evidence
} as const);

/* --------------------------------------------------------------------------
 * Confidence cap enum (PR#18b §7.2 / §9 confidence policy).
 *
 * Observer NEVER emits 'high'. PR#18c v0.1 is capped at 'medium'.
 * ------------------------------------------------------------------------ */

export const CONFIDENCE_CAPS_ALLOWED = ['low', 'medium'] as const;
export type ConfidenceCap = typeof CONFIDENCE_CAPS_ALLOWED[number];

/**
 * Categorical reason for the confidence cap selection. Internal only.
 */
export const CONFIDENCE_REASONS_ALLOWED = [
  'no_evidence_in_window',
  'single_source_only',
  'client_only_evidence',
  'multi_source_server_side',
  'synthetic_only_after_exclusion',
  'missing_optional_sources',
  'threshold_not_locked',
] as const;
export type ConfidenceReason = typeof CONFIDENCE_REASONS_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Product-context candidate label enum (v0.1 — internal only).
 *
 * NOT a Product Layer decision. NOT a customer claim. NOT a Trust / Pass
 * 1 / Pass 2 verdict. Final Product Context semantics are PR#18d's scope.
 * ------------------------------------------------------------------------ */

export const PRODUCT_CONTEXT_CANDIDATES_ALLOWED = [
  'evidence_observed',          // ≥ 2 server-side sources show activity for this session
  'single_source_signal',       // exactly one server-side source shows activity
  'synthetic_only_excluded',    // only Gate 2 / Gate 3 proof rows; excluded from commercial eval
  'insufficient_evidence',      // no qualifying evidence
  'threshold_not_locked',       // observer cannot classify reliably (future PR locks semantics)
] as const;
export type ProductContextCandidate = typeof PRODUCT_CONTEXT_CANDIDATES_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Exclusion flag enum — categorical per-candidate flags.
 * ------------------------------------------------------------------------ */

export const EXCLUSION_FLAGS_ALLOWED = [
  'synthetic_fixture_workspace_site',  // (workspace_id, site_id) is the Gate-N proof boundary
  'synthetic_fixture_schema_key',      // schema_key matches buyerrecon.test.*
  'synthetic_fixture_label',           // associated site_write_tokens.label matches Gate-N label set
  'lane_b_dark_internal',              // any Lane B observation; stays dark per PR#18b §10 OD-6
  'optional_source_missing',           // an optional source table was absent at run time
  'session_id_redacted',               // session id was truncated for output (always true)
  'final_status_pass',
] as const;
export type ExclusionFlag = typeof EXCLUSION_FLAGS_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Source-table presence + counts.
 * ------------------------------------------------------------------------ */

export interface SourceTablesPresent {
  readonly accepted_events:                   boolean;
  readonly ingest_requests:                   boolean;
  readonly rejected_events:                   boolean;
  readonly session_features:                  boolean;
  readonly session_behavioural_features_v0_2: boolean;
  readonly poi_observations_v0_1:             boolean;
  readonly poi_sequence_observations_v0_1:    boolean;
  readonly risk_observations_v0_1:            boolean;
  readonly site_write_tokens:                 boolean;
}

export interface SourceCounts {
  readonly accepted_events_in_window:                   number;
  readonly ingest_requests_in_window:                   number;
  readonly rejected_events_in_window:                   number;
  readonly session_features_in_window:                  number;
  readonly session_behavioural_features_v0_2_in_window: number;
  readonly poi_observations_v0_1_in_window:             number;
  readonly poi_sequence_observations_v0_1_in_window:    number;
  readonly risk_observations_v0_1_in_window:            number;
}

/* --------------------------------------------------------------------------
 * Synthetic / control-traffic exclusion summary.
 * ------------------------------------------------------------------------ */

export interface SyntheticControlExclusion {
  readonly rule_version:                              string;
  readonly excluded_workspace_site_pair_matches:      number;
  readonly excluded_schema_key_namespace_matches:     number;
  readonly excluded_token_label_matches:              number;
  readonly excluded_accepted_events_rows:             number;
  readonly excluded_rejected_events_rows:             number;
  readonly excluded_ingest_requests_rows:             number;
  readonly proof_rows_preserved:                      true;  // categorical guarantee — never deleted
}

/* --------------------------------------------------------------------------
 * Timing band distribution.
 * ------------------------------------------------------------------------ */

export interface TimingBandDistribution {
  readonly hot_now:               number;
  readonly warm_recent:           number;
  readonly cooling:               number;
  readonly stale:                 number;
  readonly dormant:               number;
  readonly insufficient_evidence: number;
}

export function emptyTimingBandDistribution(): TimingBandDistribution {
  return Object.freeze({
    hot_now:               0,
    warm_recent:           0,
    cooling:               0,
    stale:                 0,
    dormant:               0,
    insufficient_evidence: 0,
  });
}

/* --------------------------------------------------------------------------
 * Per-session product-context candidate (the pass-forward atom).
 *
 * Every field is categorical / counted / redacted. No raw session_id,
 * no request_id UUID, no full URL, no payload byte, no token / hash /
 * pepper / DSN / Authorization-header value.
 * ------------------------------------------------------------------------ */

export interface ProductContextSessionCandidate {
  readonly session_id_redacted:        string;          // truncated form (prefix(8)…suffix(4))
  readonly timing_band_candidate:      TimingBand;
  readonly product_context_candidate:  ProductContextCandidate;
  readonly confidence_cap:             ConfidenceCap;
  readonly confidence_reason:          ConfidenceReason;
  readonly evidence_refs:              readonly string[];  // categorical labels like "accepted_events:3"
  readonly exclusion_flags:            readonly ExclusionFlag[];
  readonly pass_forward_to_pass1:      boolean;
}

/* --------------------------------------------------------------------------
 * Anomalies — categorical only, never raw row content.
 * ------------------------------------------------------------------------ */

export const ANOMALY_KINDS_ALLOWED = [
  'required_source_missing',
  'optional_source_missing',
  'optional_source_count_query_failed',
  'unexpected_lane_a_row_count_nonzero',
  'unexpected_lane_b_row_count_nonzero',
  'synthetic_exclusion_filter_empty',
] as const;
export type AnomalyKind = typeof ANOMALY_KINDS_ALLOWED[number];

export interface Anomaly {
  readonly kind:       AnomalyKind;
  readonly detail:     string;     // short categorical description, never raw row content
  readonly severity:   'info' | 'warn' | 'block';
}

/* --------------------------------------------------------------------------
 * Final status.
 * ------------------------------------------------------------------------ */

export const FINAL_STATUSES_ALLOWED = ['PASS', 'PASS_WITH_WARNINGS', 'BLOCKED'] as const;
export type FinalStatus = typeof FINAL_STATUSES_ALLOWED[number];

/* --------------------------------------------------------------------------
 * Top-level observation report (the §5 contract from PR#18c brief).
 * ------------------------------------------------------------------------ */

export interface TimingProductContextObservationReport {
  readonly report_version:            typeof REPORT_VERSION;
  readonly observer_version:          typeof OBSERVER_VERSION;
  readonly pass_forward_contract_version: typeof PASS_FORWARD_CONTRACT_VERSION;
  readonly synthetic_exclusion_rule_version: typeof SYNTHETIC_EXCLUSION_RULE_VERSION;
  readonly timing_band_thresholds_version: typeof TIMING_BAND_THRESHOLDS_VERSION;
  readonly confidence_cap_policy_version:  typeof CONFIDENCE_CAP_POLICY_VERSION;

  readonly checked_at:                string;            // ISO-8601 UTC
  readonly window_hours:              number;
  readonly window_start:              string;            // ISO-8601 UTC
  readonly window_end:                string;            // ISO-8601 UTC

  readonly workspace_id:              string;
  readonly site_id:                   string;

  readonly database_host:             string;            // masked, host only
  readonly database_name:             string;            // masked, db name only

  readonly source_tables_present:     SourceTablesPresent;
  readonly source_counts:             SourceCounts;
  readonly synthetic_control_exclusion: SyntheticControlExclusion;

  readonly timing_band_distribution:  TimingBandDistribution;
  readonly product_context_candidates: readonly ProductContextSessionCandidate[];

  readonly anomalies:                 readonly Anomaly[];
  readonly final_status:              FinalStatus;

  readonly boundary_affirmations:     readonly string[];  // categorical boundary statements
}

/* --------------------------------------------------------------------------
 * Run options accepted by the runner.
 * ------------------------------------------------------------------------ */

export interface ObserverRunOptions {
  readonly workspace_id:                  string;
  readonly site_id:                       string;
  readonly window_start:                  Date;
  readonly window_end:                    Date;
  readonly window_hours:                  number;
  readonly evaluation_at:                 Date;
  readonly limit:                         number;  // max rows fetched per source
  readonly require_timing_product_context: boolean; // if true, missing optional sources downgrade final_status
}

/* --------------------------------------------------------------------------
 * AMS reserved-name guard (PR#14a §10) — re-asserted as runtime constants
 * the test suite scans against. Listed here (as the *list of forbidden
 * names*, NOT as type aliases) so that the static-source sweep can
 * confirm the runtime module never redefines them.
 * ------------------------------------------------------------------------ */

export const AMS_RESERVED_NAMES_FORBIDDEN: readonly string[] = Object.freeze([
  'Fit',
  'FitFeatures',
  'FitResult',
  'FitScore',
  'Intent',
  'IntentFeatures',
  'IntentResult',
  'IntentState',
  'Window',
  'WindowFeatures',
  'WindowResult',
  'WindowState',
  'TRQ',
  'TRQResult',
  'TRQBand',
  'ProductDecision',
  'ProductFeatures',
  'ProductScorerInput',
  'ProductScorer',
  'BuyerReconConfig',
  'BuyerReconProductFeatures',
  'RequestedAction',
  'Pass1',
  'Pass2',
  'TrustDecisionV3',
]);

export const AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN: readonly string[] = Object.freeze([
  'FIT.',
  'INTENT.',
  'WINDOW.',
  'PRODUCT_DECISION.',
  'REQUESTED_ACTION.',
]);
