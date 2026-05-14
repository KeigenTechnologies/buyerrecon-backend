/**
 * Sprint 2 PR#14b — ProductFeatures-Namespace Bridge — public re-exports.
 *
 * No DB. No SQL. No HTTP. No process side effects on import.
 */

export {
  buildBridgeNamespaceCandidate,
} from './mapper.js';

export {
  validateBridgeCandidate,
  validateBridgeMapperInput,
} from './validate.js';

export {
  ALLOWED_CONVERSION_PROXIMITY_INDICATORS,
  AMS_PRODUCT_LAYER_REFERENCE_VERSION,
  BRIDGE_ACTIONABILITY_BANDS_ALLOWED,
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  BRIDGE_UNIVERSAL_SURFACES_ALLOWED,
  FORBIDDEN_AMS_PAYLOAD_KEYS,
  FORBIDDEN_PII_KEYS,
  NAMESPACE_KEY_CANDIDATE,
  type ActionabilityBand,
  type BridgeCandidatePayload,
  type BridgeMapperInput,
  type BridgeNamespaceCandidate,
  type BridgePreviewMetadata,
  type CategoryTemplate,
  type FitLikeInputs,
  type IntentLikeInputs,
  type NamespaceKeyCandidate,
  type PrimaryConversionGoal,
  type SalesMotion,
  type SourceEvidenceVersions,
  type TimingLikeInputs,
  type UniversalSurface,
  type ValidateResult,
} from './types.js';
