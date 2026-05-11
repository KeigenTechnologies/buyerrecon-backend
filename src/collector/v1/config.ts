/**
 * Sprint 1 PR#7 — v1 collector env / config loader (Track B).
 *
 * Pure-ish helper: takes a NodeJS.ProcessEnv shape, validates required secrets,
 * and returns a frozen CollectorConfig plus the auth pepper and feature flags.
 *
 * runRequest / orchestrator / row-builders / any PR#5 helper must NOT read
 * process.env. This loader is the ONLY entry point that reads env in PR#7's
 * write path. Tests construct LoadedV1Config directly with synthetic env shapes.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import { COLLECTOR_VERSION, CANONICAL_CONTRACT_VERSION } from '../../constants.js';
import { VALIDATOR_VERSION } from './index.js';
import type { CollectorConfig } from './orchestrator.js';

/** Loader return shape — CollectorConfig (for runRequest) plus the auth pepper and flags. */
export interface LoadedV1Config {
  /** Passed to runRequest. */
  config: CollectorConfig;
  /**
   * SITE_WRITE_TOKEN_PEPPER. Used ONLY by resolveSiteWriteToken (auth lookup).
   * Distinct security purpose from CollectorConfig.ip_hash_pepper.
   * Never reaches runRequest.
   */
  site_write_token_pepper: string;
  /** Per handoff Decision #1 — /v1/batch is feature-gated. Defaults false. */
  enable_v1_batch: boolean;
}

/**
 * Read required + optional env vars and build a LoadedV1Config.
 *
 * Throws Error (NOT TypeError) on missing / empty required peppers so app
 * boot fails loudly in production. The caller (src/server.ts start()) already
 * catches and process.exit(1)s on any error from the bootstrap path.
 *
 * Boolean flags: only the literal string "true" enables; any other value
 * (undefined, "", "1", "TRUE", "false", " true ") is treated as false. This
 * matches the convention already documented in .env.example.
 */
export function loadV1ConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LoadedV1Config {
  const sitePepper = env.SITE_WRITE_TOKEN_PEPPER;
  if (typeof sitePepper !== 'string' || sitePepper.length === 0) {
    throw new Error(
      'loadV1ConfigFromEnv: SITE_WRITE_TOKEN_PEPPER is required and must be a non-empty string',
    );
  }

  const ipPepper = env.IP_HASH_PEPPER;
  if (typeof ipPepper !== 'string' || ipPepper.length === 0) {
    throw new Error(
      'loadV1ConfigFromEnv: IP_HASH_PEPPER is required and must be a non-empty string',
    );
  }

  const allow_consent_state_summary = env.ALLOW_CONSENT_STATE_SUMMARY === 'true';
  const enable_v1_batch = env.ENABLE_V1_BATCH === 'true';

  const config: CollectorConfig = {
    collector_version: COLLECTOR_VERSION,
    validator_version: VALIDATOR_VERSION,
    event_contract_version: CANONICAL_CONTRACT_VERSION,
    ip_hash_pepper: ipPepper,
    allow_consent_state_summary,
  };

  return {
    config,
    site_write_token_pepper: sitePepper,
    enable_v1_batch,
  };
}
