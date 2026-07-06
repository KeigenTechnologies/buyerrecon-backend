/**
 * Sprint 3.5 — Phase C2: shared DB pool factory (minimal, behavior-neutral).
 *
 * Status: SPRINT3_5_PHASE_C2_LOW_RISK_CLI_OBSERVATION_POOL_FACTORY_MIGRATION
 *
 * Phase C1 introduced this module as an unwired scaffold. Phase C2 wires it to EXACTLY ONE
 * low-risk CLI observation/report path (scripts/poi-table-observation-report.ts), moving that
 * script's inline pool construction here WITHOUT changing behavior:
 *   - same connection input (the caller passes its already-resolved connection string),
 *   - same pool options (max: 4, idleTimeoutMillis: 5000),
 *   - no new env variable names, no role-scoped DSN, no hidden fallback, no global singleton.
 *
 * Invariants:
 *   - reads NO environment values (the connection string is passed in by the caller),
 *   - opens NO connection on import and NO connection on construction (pg.Pool is lazy;
 *     it connects on first query, exactly as the inline construction did),
 *   - imports only the pg driver; no application-module import.
 *
 * The check:pg-pool-construction guardrail allowlists this single construction site, and
 * check:db-pool-factory-scaffold proves this module has exactly one runtime importer (the migrated
 * CLI) and no worker / risk-evidence / record-only / customer-output importer.
 */

import pg from "pg";

/** The factory is now wired to exactly one low-risk CLI observation path (Phase C2). */
export const POOL_FACTORY_WIRING_ENABLED = true as const;

/** Pool classes a future slice would serve (names only — data, not behavior). */
export type PoolClassName = "server_app" | "cli_worker" | "cli_single_client";

/** Pure, env-free description of an intended pool configuration (data only). */
export interface IntendedPoolConfig {
  readonly poolClass: PoolClassName;
  readonly max: number;
  readonly idleTimeoutMillis: number;
}

/** Pure config normalizer — no I/O, no env, no connection. Deterministic; unit-testable. */
export function normalizeIntendedPoolConfig(input: IntendedPoolConfig): IntendedPoolConfig {
  return {
    poolClass: input.poolClass,
    max: Math.max(1, Math.floor(input.max)),
    idleTimeoutMillis: Math.max(0, Math.floor(input.idleTimeoutMillis)),
  };
}

/**
 * Create the CLI observation pool for a read-only observation/report CLI.
 *
 * Behavior-neutral replacement for the inline construction that previously lived in
 * scripts/poi-table-observation-report.ts: identical options (max: 4, idleTimeoutMillis: 5000) and
 * the same `connectionString` the caller already resolved from its own connection-source env read.
 * No env is read here; no connection is opened until the caller issues a query (pg.Pool is lazy).
 */
export function createCliObservationPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max:               4,
    idleTimeoutMillis: 5000,
  });
}
