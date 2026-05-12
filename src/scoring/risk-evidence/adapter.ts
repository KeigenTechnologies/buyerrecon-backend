/**
 * Sprint 2 PR#6 — pure BuyerRecon-side adapter:
 *   SessionBehaviouralFeaturesV0_3Row + Stage0DecisionRowReadView
 *     → RiskInputsCompat (AMS-RiskInputs-compatible evidence payload)
 *
 * Pure function. No DB. No HTTP. No clock reads. No randomness. No
 * ML libraries. Mirrors the AMS `internal/adapters/adapters.go`
 * `ToRiskInputs` anti-corruption pattern.
 *
 * Helen D-11 upgrade-not-restart rule:
 *   This adapter is the BuyerRecon-side anti-corruption boundary
 *   that feeds the existing AMS Risk Core pathway. It does NOT
 *   replace, fork, shadow, or re-implement AMS Risk Core. It
 *   produces ONLY the inputs the existing AMS Risk Core call needs
 *   (per `internal/riskcore/engine.go:14-21` TODO).
 *
 * No scoring. No reason-code emission. No B_* emission. No Lane B
 * writes. No declared-agent classification. No customer-facing
 * output.
 */

import type {
  RiskInputsCompat,
  SessionBehaviouralFeaturesV0_3Row,
  Stage0DecisionRowReadView,
} from './types.js';
import {
  CONTEXT_TAG,
  type ContextTag,
  assertContextTagsValid,
  CONTEXT_TAGS_MAX_PER_SESSION,
  shouldEmitBytespiderPassthrough,
} from './context-tags.js';
import {
  type BehaviouralRiskNormalisationConfig,
  BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1,
} from './normalisation-config.js';
import { normaliseBehaviouralRisk01 } from './normalise-behavioural-risk.js';

/**
 * Build the `velocity` JSONB object the AMS Risk Core consumes via
 * its upstream adapter. Per-metric numeric rates only — no raw UA,
 * no IP, no token, no payload bytes.
 *
 * Determinism: integer values pulled straight from the SBF row;
 * missing / null inputs default to 0. Output key order is fixed by
 * the JS object literal below.
 */
function buildVelocity(
  sbf: SessionBehaviouralFeaturesV0_3Row,
): Record<string, number> {
  return {
    events_per_second:               sbf.max_events_per_second ?? 0,
    pageview_burst_count_10s:        sbf.pageview_burst_count_10s ?? 0,
    sub_200ms_transition_count:      sbf.sub_200ms_transition_count ?? 0,
    refresh_loop_count:              sbf.refresh_loop_count ?? 0,
    same_path_repeat_count:          sbf.same_path_repeat_count ?? 0,
  };
}

/**
 * Deterministic ContextTag predicate emission. Order is the order of
 * the OD-13 enum.
 */
function deriveTags(
  sbf:     SessionBehaviouralFeaturesV0_3Row,
  stage0:  Stage0DecisionRowReadView,
): ContextTag[] {
  const tags: ContextTag[] = [];

  // REFRESH_LOOP_CANDIDATE — PR#2 server-side derived refresh-loop flag.
  if (sbf.refresh_loop_candidate === true) {
    tags.push(CONTEXT_TAG.REFRESH_LOOP_CANDIDATE);
  }

  // HIGH_REQUEST_BURST — either velocity dimension above the warn threshold.
  if ((sbf.max_events_per_second ?? 0) >= 5
      || (sbf.pageview_burst_count_10s ?? 0) >= 3) {
    tags.push(CONTEXT_TAG.HIGH_REQUEST_BURST);
  }

  // ZERO_FOREGROUND_TIME — no observable dwell before first action AND
  // no engagement at all. `dwell_ms_before_first_action === null` plus
  // zero CTA / form_start / form_submit signals indicates the session
  // had no foreground/interaction phase.
  const noEngagement =
    sbf.form_start_count_before_first_cta === 0 &&
    sbf.form_submit_count_before_first_form_start === 0 &&
    sbf.ms_from_consent_to_first_cta === null;
  if (sbf.dwell_ms_before_first_action === null && noEngagement) {
    tags.push(CONTEXT_TAG.ZERO_FOREGROUND_TIME);
  }

  // NO_MEANINGFUL_INTERACTION — session reached the SBF layer but
  // produced no CTA, form_start, or form_submit signal at all.
  if (noEngagement) {
    tags.push(CONTEXT_TAG.NO_MEANINGFUL_INTERACTION);
  }

  // JS_NOT_EXECUTED — observability gap proxy. When valid_feature_count
  // is zero but the session produced events, the SBF-derived JS-side
  // features were absent (typical for non-browser request shapes).
  if (sbf.valid_feature_count === 0 && sbf.missing_feature_count > 0) {
    tags.push(CONTEXT_TAG.JS_NOT_EXECUTED);
  }

  // SUB_200MS_TRANSITION_RUN — at least 3 sub-200ms inter-page-view
  // transitions, suggesting non-human cadence.
  if ((sbf.sub_200ms_transition_count ?? 0) >= 3) {
    tags.push(CONTEXT_TAG.SUB_200MS_TRANSITION_RUN);
  }

  // BEHAVIOURAL_CADENCE_ANOMALY — same-path repeat with sub-200ms
  // minimum delta indicates a tight loop the cadence model can't
  // explain as human.
  if (sbf.same_path_repeat_min_delta_ms !== null
      && sbf.same_path_repeat_min_delta_ms >= 0
      && sbf.same_path_repeat_min_delta_ms < 200) {
    tags.push(CONTEXT_TAG.BEHAVIOURAL_CADENCE_ANOMALY);
  }

  // BYTESPIDER_PASSTHROUGH — Stage 0 allowed a known declared
  // crawler-like session to pass (UA family in the AI / search
  // crawler allowlist + excluded === false). Provenance/context tag
  // ONLY — not a Lane B writer, not a B_* code, not a declared-agent
  // classification.
  if (shouldEmitBytespiderPassthrough(stage0.rule_inputs)) {
    tags.push(CONTEXT_TAG.BYTESPIDER_PASSTHROUGH);
  }

  // Defence-in-depth: enforce enum + cardinality before returning. The
  // adapter never persists more than CONTEXT_TAGS_MAX_PER_SESSION tags,
  // but tag-derivation logic could grow in a future PR. Crash early.
  assertContextTagsValid(tags);
  if (tags.length > CONTEXT_TAGS_MAX_PER_SESSION) {
    throw new Error(
      `PR#6 adapter: tag cardinality ${tags.length} exceeds ${CONTEXT_TAGS_MAX_PER_SESSION}`,
    );
  }
  return tags;
}

/**
 * The PR#6 BuyerRecon-side adapter. Pure. Mirrors AMS
 * `adapters.ToRiskInputs`.
 *
 * Preconditions:
 *   - `stage0.excluded === false` (PR#5 eligibility gate). The worker's
 *     SELECT enforces this; the adapter re-asserts defensively.
 *   - SBF row and Stage 0 row are for the SAME
 *     (workspace_id, site_id, session_id). The worker's JOIN enforces
 *     this; the adapter re-asserts defensively.
 */
export function buyerreconBehaviouralToRiskInputs(
  sbf:     SessionBehaviouralFeaturesV0_3Row,
  stage0:  Stage0DecisionRowReadView,
  cfg:     BehaviouralRiskNormalisationConfig = BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1,
): RiskInputsCompat {
  if (stage0.excluded !== false) {
    throw new Error(
      `PR#6 adapter precondition violated: stage0.excluded must be false ` +
      `(got ${String(stage0.excluded)} for session_id=${stage0.session_id}). ` +
      `The worker is responsible for filtering Stage-0-excluded sessions.`,
    );
  }
  if (sbf.workspace_id !== stage0.workspace_id
      || sbf.site_id !== stage0.site_id
      || sbf.session_id !== stage0.session_id) {
    throw new Error(
      `PR#6 adapter precondition violated: SBF and Stage 0 rows must share ` +
      `the same (workspace_id, site_id, session_id) tuple. The worker is ` +
      `responsible for the JOIN.`,
    );
  }

  const velocity            = buildVelocity(sbf);
  const tags                = deriveTags(sbf, stage0);
  const behavioural_risk_01 = normaliseBehaviouralRisk01(sbf, cfg);

  return {
    subject_id:           sbf.session_id,
    velocity,
    device_risk_01:       0,
    network_risk_01:      0,
    identity_risk_01:     0,
    behavioural_risk_01,
    tags,
  };
}
