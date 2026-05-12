/**
 * Sprint 2 PR#6 — behavioural_risk_01 deterministic normalisation
 * configuration (v0.1).
 *
 * Pure constants. No I/O. Frozen at module load.
 *
 * Per Helen-signed D-12: at v0.1 the config lives as TypeScript
 * constants. Externalisation to YAML is a future PR (knob-panel
 * control). Any change to the constants below requires a matching
 * bump in `OBSERVATION_VERSION_DEFAULT` so prior persisted rows
 * remain reproducible from their own provenance row.
 *
 * The shape mirrors the AMS Risk Core algorithm spec's Formula 1
 * (warn / hard normalisation per metric) + Formula 2 (weighted
 * aggregation, NOT pure-max). Hard non-ML: no learned weights, no
 * gradient updates, no inference-time training. All constants are
 * static and deterministic.
 *
 * IMPORTANT (Codex non-blocking note #1):
 *   The output of the normaliser is `behavioural_risk_01` — a
 *   normalised INPUT FEATURE in [0, 1]. It is NOT a "score". It is
 *   NOT a verification_score. It is NOT a RiskIndex. The AMS Risk
 *   Core produces RiskIndex DOWNSTREAM from this evidence.
 */

/**
 * Feature key identifier set. Each key names a column on
 * `session_behavioural_features_v0_2` (v0.3) that contributes to the
 * normalisation. The string identifiers are also used as JSONB keys
 * in `risk_observations_v0_1.velocity`.
 *
 * The five features below were chosen to mirror the AMS Risk Core
 * spec's behavioural-pattern weight panel (request-burst /
 * pageview-burst / cadence / refresh-loop / sub-200ms-transition
 * cluster) while staying within PR#1 + PR#2's existing column set.
 */
export type NormalisationFeatureKey =
  | 'events_per_second'
  | 'pageview_burst_count_10s'
  | 'sub_200ms_transition_count'
  | 'refresh_loop_count'
  | 'same_path_repeat_count';

export const NORMALISATION_FEATURE_KEYS: readonly NormalisationFeatureKey[] = [
  'events_per_second',
  'pageview_burst_count_10s',
  'sub_200ms_transition_count',
  'refresh_loop_count',
  'same_path_repeat_count',
];

/**
 * Per-feature warn / hard thresholds. A feature value at `warn`
 * maps to 0; a value at `hard` maps to 1. Linear in between,
 * clamped to [0, 1] outside. `hard > warn` is asserted at module
 * load.
 */
export interface FeatureThresholds {
  warn: number;
  hard: number;
}

export interface BehaviouralRiskNormalisationConfig {
  /** Per-feature normalisation thresholds. */
  thresholds: Readonly<Record<NormalisationFeatureKey, FeatureThresholds>>;
  /**
   * Per-feature weights for the weighted aggregation. MUST sum to
   * exactly 1.0 (validated at module load). Helen-signed defaults
   * below.
   */
  weights:    Readonly<Record<NormalisationFeatureKey, number>>;
}

/* --------------------------------------------------------------------------
 * v0.1 Helen-signed defaults (D-12)
 * ------------------------------------------------------------------------ */

const THRESHOLDS_V0_1: Record<NormalisationFeatureKey, FeatureThresholds> = {
  events_per_second:           { warn: 5,  hard: 20 },
  pageview_burst_count_10s:    { warn: 3,  hard: 10 },
  sub_200ms_transition_count:  { warn: 3,  hard: 10 },
  refresh_loop_count:          { warn: 2,  hard: 6  },
  same_path_repeat_count:      { warn: 3,  hard: 8  },
};

const WEIGHTS_V0_1: Record<NormalisationFeatureKey, number> = {
  events_per_second:           0.25,
  pageview_burst_count_10s:    0.20,
  sub_200ms_transition_count:  0.20,
  refresh_loop_count:          0.20,
  same_path_repeat_count:      0.15,
};

function assertConfigInvariants(c: BehaviouralRiskNormalisationConfig): void {
  for (const k of NORMALISATION_FEATURE_KEYS) {
    const th = c.thresholds[k];
    if (!th || !Number.isFinite(th.warn) || !Number.isFinite(th.hard)) {
      throw new Error(`PR#6 normalisation-config: missing thresholds for ${k}`);
    }
    if (!(th.hard > th.warn)) {
      throw new Error(`PR#6 normalisation-config: hard must be > warn for ${k} (got warn=${th.warn} hard=${th.hard})`);
    }
    if (th.warn < 0) {
      throw new Error(`PR#6 normalisation-config: warn must be >= 0 for ${k} (got ${th.warn})`);
    }
    const w = c.weights[k];
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
      throw new Error(`PR#6 normalisation-config: weight invalid for ${k} (got ${String(w)})`);
    }
  }
  const sum = NORMALISATION_FEATURE_KEYS.reduce((acc, k) => acc + c.weights[k], 0);
  // Allow 1e-9 floating-point slack.
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`PR#6 normalisation-config: weights must sum to 1.0 (got ${sum})`);
  }
}

export const BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1: BehaviouralRiskNormalisationConfig = Object.freeze({
  thresholds: Object.freeze(THRESHOLDS_V0_1),
  weights:    Object.freeze(WEIGHTS_V0_1),
});

assertConfigInvariants(BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
