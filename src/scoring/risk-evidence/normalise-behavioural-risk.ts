/**
 * Sprint 2 PR#6 — deterministic behavioural-risk normaliser.
 *
 * Pure function. No DB. No HTTP. No clock reads. No randomness. No
 * ML libraries.
 *
 * Maps a `SessionBehaviouralFeaturesV0_3Row` to a single
 * `behavioural_risk_01` value in [0, 1] using the AMS-Risk-Core-spec
 * Formula 1 + Formula 2 pattern (warn/hard per-metric normalisation
 * + weighted aggregation).
 *
 * IMPORTANT (Codex non-blocking note #1):
 *   The output is `behavioural_risk_01` — a normalised INPUT FEATURE
 *   in [0, 1]. It is NOT a "score". It is NOT customer-facing. It is
 *   NOT a verification_score. It is NOT a RiskIndex. AMS Risk Core
 *   produces RiskIndex DOWNSTREAM from this evidence; PR#6 does not
 *   invoke Risk Core.
 *
 * Determinism guarantees:
 *   - Same input row + same config → same output value, byte-stable.
 *   - Monotonic per configured feature: increasing any input feature
 *     (all else equal) never decreases the output.
 *   - Bounded: output ∈ [0, 1].
 *   - Baseline non-anomalous row → output ≈ 0.
 */

import type { SessionBehaviouralFeaturesV0_3Row } from './types.js';
import {
  type BehaviouralRiskNormalisationConfig,
  type NormalisationFeatureKey,
  NORMALISATION_FEATURE_KEYS,
} from './normalisation-config.js';

/**
 * Linear warn/hard map. Value at warn → 0; value at hard → 1; linear
 * in between; clamped to [0, 1] outside.
 *
 * `hard > warn` is asserted at module load (config invariants), so
 * the denominator is always > 0.
 */
function normaliseFeature(value: number, warn: number, hard: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= warn) return 0;
  if (value >= hard) return 1;
  return (value - warn) / (hard - warn);
}

/**
 * Pure: extract the integer-or-zero per-feature value from the SBF
 * row. Missing / null / non-finite values are treated as 0 (baseline
 * non-anomalous behaviour), preserving the "no score on absence"
 * AMS principle.
 */
function readFeature(
  sbf: SessionBehaviouralFeaturesV0_3Row,
  key:  NormalisationFeatureKey,
): number {
  switch (key) {
    case 'events_per_second':           return sbf.max_events_per_second ?? 0;
    case 'pageview_burst_count_10s':    return sbf.pageview_burst_count_10s ?? 0;
    case 'sub_200ms_transition_count':  return sbf.sub_200ms_transition_count ?? 0;
    case 'refresh_loop_count':          return sbf.refresh_loop_count ?? 0;
    case 'same_path_repeat_count':      return sbf.same_path_repeat_count ?? 0;
  }
}

/**
 * Compute the per-feature 0..1 normalisation of each configured
 * feature. Exposed for tests that want to assert per-feature
 * behaviour without re-implementing the warn/hard map.
 */
export function computeFeatureNormalisations(
  sbf: SessionBehaviouralFeaturesV0_3Row,
  cfg: BehaviouralRiskNormalisationConfig,
): Record<NormalisationFeatureKey, number> {
  const result = {} as Record<NormalisationFeatureKey, number>;
  for (const k of NORMALISATION_FEATURE_KEYS) {
    const v = readFeature(sbf, k);
    const { warn, hard } = cfg.thresholds[k];
    result[k] = normaliseFeature(v, warn, hard);
  }
  return result;
}

/**
 * Round a finite [0, 1] value to 3 decimal places (matches the
 * `risk_observations_v0_1.behavioural_risk_01` column type
 * `NUMERIC(4,3)`). The DB CHECK constraint enforces [0, 1] at the
 * persistence boundary; this rounding step keeps the in-memory value
 * stable across replay so test assertions don't break on
 * float-precision drift.
 */
function roundTo3dp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.round(x * 1000) / 1000;
}

/**
 * The PR#6 normaliser. Pure. Same input → same output.
 *
 * Aggregation: weighted sum of the per-feature 0..1 normalisations.
 * Weights sum to 1.0 (asserted at config load), so the output is in
 * [0, 1] without an extra clamp; the final `roundTo3dp` collapses
 * float-precision noise.
 */
export function normaliseBehaviouralRisk01(
  sbf: SessionBehaviouralFeaturesV0_3Row,
  cfg: BehaviouralRiskNormalisationConfig,
): number {
  const norms = computeFeatureNormalisations(sbf, cfg);
  let acc = 0;
  for (const k of NORMALISATION_FEATURE_KEYS) {
    acc += norms[k] * cfg.weights[k];
  }
  return roundTo3dp(acc);
}
