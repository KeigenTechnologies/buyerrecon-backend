/**
 * Sprint 2 PR#6 — behavioural-pattern evidence module entry.
 *
 * Public re-exports for tests, the CLI, and the future bridge layer
 * that will hand `risk_observations_v0_1` rows to the AMS Risk Core
 * call (cross-language integration is deferred per Helen D-9).
 *
 * No DB. No HTTP. No side effects on import. The worker performs DB
 * I/O when invoked.
 */

export {
  buyerreconBehaviouralToRiskInputs,
} from './adapter.js';
export {
  CONTEXT_TAG,
  CONTEXT_TAGS_ALLOWED,
  CONTEXT_TAGS_MAX_PER_SESSION,
  CONTEXT_TAG_SHAPE_REGEX,
  FORBIDDEN_TAG_PATTERNS,
  FORBIDDEN_TAG_PREFIXES,
  BYTESPIDER_PASSTHROUGH_UA_FAMILIES,
  assertContextTagsValid,
  isContextTagAllowed,
  shouldEmitBytespiderPassthrough,
  validateContextTag,
  type ContextTag,
} from './context-tags.js';
export {
  BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1,
  NORMALISATION_FEATURE_KEYS,
  type BehaviouralRiskNormalisationConfig,
  type FeatureThresholds,
  type NormalisationFeatureKey,
} from './normalisation-config.js';
export {
  computeFeatureNormalisations,
  normaliseBehaviouralRisk01,
} from './normalise-behavioural-risk.js';
export {
  OBSERVATION_VERSION_DEFAULT,
  type RiskInputsCompat,
  type RiskObservationRow,
  type SessionBehaviouralFeaturesV0_3Row,
  type Stage0DecisionRowReadView,
} from './types.js';
export {
  parseRiskEvidenceEnvOptions,
  runRiskEvidenceWorker,
  type RiskEvidenceEnvOpts,
  type RiskEvidenceWorkerOptions,
  type RiskEvidenceWorkerResult,
} from './worker.js';
