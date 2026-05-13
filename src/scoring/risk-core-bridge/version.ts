/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — version stamps.
 *
 * Pure module. No DB. No filesystem. No process side effects.
 *
 * The bridge's envelope is a typed contract. Any field added,
 * renamed, removed, or repurposed bumps the envelope version. PR#7a
 * §11.2 #8 requires this.
 *
 * The source table the bridge consumes is also a frozen literal so
 * downstream callers can verify shape provenance without inspecting
 * the underlying row.
 */

/**
 * The envelope version PR#7b stamps on every `RiskCoreBridgeEnvelope`
 * it builds. Bumping this value requires:
 *   1. A matching `docs/sprint2-pr7a-risk-core-bridge-contract.md`
 *      revision with Helen sign-off, AND
 *   2. A re-evaluation of every downstream consumer (the existing
 *      AMS Risk Core call site, future Policy Pass 1 projection,
 *      etc.).
 *
 * The value below is the PR#7b initial freeze.
 */
export const RISK_CORE_BRIDGE_ENVELOPE_VERSION = 'risk-core-bridge-envelope-v0.1';

/**
 * The frozen source-table literal. The bridge consumes exactly one
 * primary source per PR#7a §5: `risk_observations_v0_1` (PR#6's
 * RECORD_ONLY evidence layer). Bumping this value means the bridge
 * source has moved, which is a contract revision, not an
 * implementation tweak.
 */
export const BRIDGE_SOURCE_TABLE = 'risk_observations_v0_1' as const;
export type BridgeSourceTable = typeof BRIDGE_SOURCE_TABLE;
