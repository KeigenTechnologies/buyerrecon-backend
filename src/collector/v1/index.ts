/**
 * Sprint 1 PR#5a — v1 collector contract foundation (Track B).
 *
 * Barrel module + the VALIDATOR_VERSION constant. PR#5a ships the contract
 * surface only — no validation logic, no orchestrator, no DB writes, no
 * routes. Validation rules and PII / consent / boundary modules land in
 * PR#5b; the orchestrator and row-builder bodies land in PR#5c; HTTP route
 * binding lands in PR#7.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

/**
 * Stamped on every accepted_events row at write time (in PR#5c).
 * Bumped manually when the validator pipeline materially changes
 * (per Decision D11; not auto-derived from package version).
 */
export const VALIDATOR_VERSION = 'buyerrecon-v1-validator-0.1' as const;

export type ValidatorVersion = typeof VALIDATOR_VERSION;

export * from './reason-codes.js';
export * from './types.js';
export * from './hash.js';
export * from './row-builders.js';
