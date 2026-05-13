/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — module entry.
 *
 * Public re-exports for tests, any future worker, and downstream
 * callers that route `RiskCoreBridgeEnvelope` payloads into the
 * existing AMS Risk Core pathway.
 *
 * No DB. No HTTP. No process side effects on import. The adapter is
 * pure; any future worker that performs DB I/O lives in its own
 * file under this directory (out of PR#7b scope unless contract
 * revision approves a worker).
 */

export {
  buildRiskCoreBridgeEnvelope,
} from './adapter.js';
export {
  deepFreeze,
  preserveContextTags,
  preserveEvidenceRefs,
  preserveVelocity,
} from './evidence-map.js';
export {
  type BridgeStage0Context,
  type EvidenceRef,
  type RiskCoreBridgeEnvelope,
  type RiskCoreBridgeInput,
} from './types.js';
export {
  BRIDGE_SOURCE_TABLE,
  RISK_CORE_BRIDGE_ENVELOPE_VERSION,
  type BridgeSourceTable,
} from './version.js';
