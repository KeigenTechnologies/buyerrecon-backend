/**
 * Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer — public re-exports.
 */

export {
  buildBridgeMapperInputFromPreview,
  decideBridgeCandidateObserverExit,
  rejectReasonFamily,
  runBridgeCandidateObserver,
  type BuildBridgeMapperInputArgs,
  type RunBridgeCandidateObserverArgs,
} from './runner.js';

export {
  renderBridgeCandidateObserverMarkdown,
} from './report.js';

export {
  BRIDGE_CANDIDATE_OBSERVER_VERSION,
  type BridgeCandidateExitDecision,
  type BridgeCandidateGenerationSummary,
  type BridgeCandidateObserverReport,
  type BridgeCandidateReadOnlyProof,
  type BridgeCandidateSample,
  type CandidateFeatureSummary,
  type ProductContextObserverInputSummary,
} from './types.js';
