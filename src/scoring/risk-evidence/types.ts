/**
 * Sprint 2 PR#6 — behavioural-pattern evidence type contract.
 *
 * Track B (BuyerRecon Evidence Foundation). Pure TypeScript types
 * shared between the pure adapter, the pure normaliser, and the DB
 * worker. No DB import here. No runtime side effects.
 *
 * IMPORTANT (Helen D-11 upgrade-not-restart rule):
 *   The shapes below mirror the *inputs* the existing AMS Risk Core
 *   consumes via its upstream adapter
 *   (`internal/adapters/adapters.go.ToRiskInputs` →
 *    `CommonFeatures.BehavioralRisk01` per
 *    `internal/riskcore/engine.go:14-21`).
 *
 *   They are NOT RiskOutput. They are NOT a Risk Core slice. PR#6
 *   does not implement Risk Core; it produces the evidence the
 *   existing AMS Risk Core call needs.
 *
 *   No risk_index. No verification_score. No evidence_band. No
 *   reason_codes. No reason_impacts. No triggered_tags. No
 *   penalty_total. No action_recommendation.
 *
 * Critical naming discipline (Codex non-blocking note #1):
 *   `behavioural_risk_01` is a normalised INPUT FEATURE in [0, 1].
 *   It is NOT a "score". It is NOT customer-facing. It is NOT a
 *   RiskIndex. It is NOT a verification_score.
 */

import type { ContextTag } from './context-tags.js';

/* --------------------------------------------------------------------------
 * Version stamps
 * ------------------------------------------------------------------------ */

/**
 * The default observation_version PR#6 stamps on each persisted row.
 * Bumping this value produces a NEW row alongside any prior row at
 * the same (workspace_id, site_id, session_id, scoring_version)
 * (per D-14 / PR#5 OD-10 natural-key discipline).
 */
export const OBSERVATION_VERSION_DEFAULT = 'risk-obs-v0.1';

/**
 * The current `session_behavioural_features_v0_2.feature_version` PR#6
 * reads from. Matches `scripts/extract-behavioural-features.ts`'s
 * `DEFAULT_FEATURE_VERSION = 'behavioural-features-v0.3'`.
 *
 * Hetzner staging (PR#6 commit `de76950`) revealed that without this
 * filter the worker JOIN matched BOTH `behavioural-features-v0.2` AND
 * `behavioural-features-v0.3` rows for the same session — `upserted_rows`
 * reported `4` while only `2` rows landed under the natural key (the
 * second UPSERT overwrote the first via ON CONFLICT DO UPDATE). The
 * final persisted rows were clean, but the worker was wasting work on
 * obsolete feature versions and the `upserted_rows` count was
 * misleading. The filter below is the fix.
 *
 * Bumping this value (e.g. when PR#1 ships v0.4) requires a matching
 * bump in `OBSERVATION_VERSION_DEFAULT` so prior persisted rows remain
 * reproducible from their own provenance row.
 */
export const CURRENT_BEHAVIOURAL_FEATURE_VERSION = 'behavioural-features-v0.3';

/* --------------------------------------------------------------------------
 * Session behavioural features v0.3 — read view (PR#1 + PR#2 layer)
 * ------------------------------------------------------------------------ */

/**
 * Read view of `session_behavioural_features_v0_2` (the v0.3 row shape
 * produced by PR#1 migration 009 + PR#2 migration 010). PR#6 reads a
 * minimal subset of columns for the adapter and normaliser. Only the
 * columns the adapter actually consumes are typed here; the worker
 * SELECT statement is the authoritative column list.
 */
export interface SessionBehaviouralFeaturesV0_3Row {
  // Identity + provenance
  behavioural_features_id:                     number;
  workspace_id:                                string;
  site_id:                                     string;
  session_id:                                  string;
  feature_version:                             string;
  source_event_count:                          number;

  // Engagement / interaction temporal-order signals (PR#1 §10)
  ms_from_consent_to_first_cta:                number | null;
  dwell_ms_before_first_action:                number | null;
  first_form_start_precedes_first_cta:         boolean | null;
  form_start_count_before_first_cta:           number;
  has_form_submit_without_prior_form_start:    boolean;
  form_submit_count_before_first_form_start:   number;

  // Cadence / velocity signals (PR#1 §10)
  ms_between_pageviews_p50:                    number | null;
  pageview_burst_count_10s:                    number;
  max_events_per_second:                       number;
  sub_200ms_transition_count:                  number;

  // Refresh-loop / repeated pageview signals (PR#2 migration 010)
  refresh_loop_candidate:                      boolean | null;
  refresh_loop_count:                          number;
  same_path_repeat_count:                      number;
  same_path_repeat_min_delta_ms:               number | null;

  // Observability metadata
  valid_feature_count:                         number;
  missing_feature_count:                       number;
}

/* --------------------------------------------------------------------------
 * Stage 0 decision row — read view (PR#5 layer)
 * ------------------------------------------------------------------------ */

/**
 * Read view of `stage0_decisions` (PR#5 layer). PR#6 reads a minimal
 * subset for the eligibility filter + the BYTESPIDER_PASSTHROUGH
 * provenance tag.
 *
 * Precondition for the adapter: `excluded === false`. The worker's
 * SELECT statement enforces the precondition; the adapter re-asserts
 * defensively.
 *
 * Helen-signed OD-11 / PR#5 rule_inputs allowed keys (the only keys
 * PR#6 may read from the JSONB blob): matched_rule_id,
 * user_agent_family, matched_family, ua_source, path_pattern_matched,
 * events_per_second, path_loop_count, signal_confidence_bucket.
 */
export interface Stage0DecisionRowReadView {
  stage0_decision_id:  string;
  workspace_id:        string;
  site_id:             string;
  session_id:          string;
  excluded:            boolean;
  rule_id:             string;
  rule_inputs:         Record<string, unknown>;
}

/* --------------------------------------------------------------------------
 * RiskInputsCompat — AMS-RiskInputs-compatible evidence payload
 * ------------------------------------------------------------------------ */

/**
 * Mirrors AMS `internal/contracts/signals.go` `RiskInputs` plus the
 * `BehavioralRisk01` slot on `CommonFeatures` (which enters AMS Risk
 * Core via the upstream adapter — see
 * `internal/riskcore/engine.go:14-21`).
 *
 * This is the **pure adapter output** — the shape the BuyerRecon side
 * hands off (via the `risk_observations_v0_1` table) to the
 * downstream AMS Risk Core consumer. PR#6 does not invoke Risk Core;
 * it only produces the input.
 *
 * Hard absences (BY DESIGN — these are AMS RiskOutput / Policy Pass 1
 * concerns, not PR#6's):
 *   - NO `risk_index`
 *   - NO `verification_score`
 *   - NO `evidence_band`
 *   - NO `reason_codes`
 *   - NO `reason_impacts`
 *   - NO `triggered_tags`
 *   - NO `penalty_total`
 *   - NO `action_recommendation`
 */
export interface RiskInputsCompat {
  /** BuyerRecon session_id (the AMS SubjectID slot). */
  subject_id:           string;
  /** Per-metric rates (events/sec, pageview-burst count, etc.). */
  velocity:             Record<string, number>;
  /** [0,1] clamp; 0 default in v1 (no SDK fingerprint signal yet). */
  device_risk_01:       number;
  /** [0,1] clamp; 0 default in v1. */
  network_risk_01:      number;
  /** [0,1] clamp; 0 default in v1. */
  identity_risk_01:     number;
  /**
   * [0,1] clamp — the `CommonFeatures.BehavioralRisk01` runtime_comp
   * input. NORMALISED INPUT FEATURE ONLY. Not a score.
   */
  behavioural_risk_01:  number;
  /** Short UPPER_SNAKE_CASE ContextTag labels. Max 16 per session. */
  tags:                 readonly ContextTag[];
}

/* --------------------------------------------------------------------------
 * RiskObservationRow — persistence shape
 * ------------------------------------------------------------------------ */

/**
 * The full row shape inserted into `risk_observations_v0_1`. The DB
 * worker builds this from a Stage0DecisionRowReadView +
 * SessionBehaviouralFeaturesV0_3Row + the scoring contract versions;
 * the migration's CHECK constraints enforce the shape at the DB
 * layer.
 */
export interface RiskObservationRow {
  workspace_id:         string;
  site_id:              string;
  session_id:           string;
  observation_version:  string;
  scoring_version:      string;

  velocity:             Record<string, number>;
  device_risk_01:       number;
  network_risk_01:      number;
  identity_risk_01:     number;
  behavioural_risk_01:  number;
  tags:                 ContextTag[];

  record_only:          true;
  source_event_count:   number;
  evidence_refs:        Array<{ table: string; [k: string]: unknown }>;
}
