/**
 * Sprint 3.5 — Phase C1: DB pool factory SCAFFOLD (no runtime use).
 *
 * Status: SPRINT3_5_PHASE_C1_DB_POOL_FACTORY_SCAFFOLD_NO_RUNTIME_USE
 *
 * This module is an INTENTIONALLY UNWIRED scaffold. In Phase C1 it is:
 *   - not imported by any runtime source, worker, report, observer, or customer-output path,
 *   - not called anywhere,
 *   - env-free: it reads no environment values and references no connection-source env name,
 *   - connection-free: it constructs no database pool/client and runs no SQL,
 *   - import-free: it imports no application modules and no database driver.
 *
 * It exists only to establish a single, reviewed seam for a FUTURE, separately-approved
 * centralization (Phase C planning: SPRINT3_5_PHASE_C_PG_POOL_CENTRALIZATION_PLANNING_ONLY).
 * It migrates NO existing construction site and changes NO existing behavior.
 *
 * The `check:db-pool-factory-scaffold` guardrail statically proves the invariants above, and the
 * Phase B `check:pg-pool-construction` guardrail proves the existing construction topology is
 * unchanged.
 */

/** Explicit marker: the factory is NOT wired into any runtime path in C1. */
export const POOL_FACTORY_WIRING_ENABLED = false as const;

/** Pool classes that a future factory would serve (names only — data, not behavior). */
export type PoolClassName = "server_app" | "cli_worker" | "cli_single_client";

/** Pure, env-free description of an intended pool configuration (data only; NOT applied). */
export interface IntendedPoolConfig {
  readonly poolClass: PoolClassName;
  readonly max: number;
  readonly idleTimeoutMillis: number;
}

/**
 * The CURRENT per-class pool configuration values, recorded as inert DATA so a future slice can
 * migrate call sites to identical settings. Nothing here is applied to any real connection in C1.
 */
export const INTENDED_POOL_CONFIGS: readonly IntendedPoolConfig[] = [
  { poolClass: "server_app", max: 10, idleTimeoutMillis: 30000 },
  { poolClass: "cli_worker", max: 4, idleTimeoutMillis: 5000 },
];

/**
 * Pure config normalizer — no I/O, no env, no connection. Takes an explicit config and returns a
 * normalized copy. Deterministic; safe to unit-test without a database or network.
 */
export function normalizeIntendedPoolConfig(input: IntendedPoolConfig): IntendedPoolConfig {
  return {
    poolClass: input.poolClass,
    max: Math.max(1, Math.floor(input.max)),
    idleTimeoutMillis: Math.max(0, Math.floor(input.idleTimeoutMillis)),
  };
}

/**
 * Future factory-shape stub — INTENTIONALLY UNWIRED in C1.
 *
 * It constructs nothing, reads no env, and is called nowhere. If it is ever invoked before it is
 * properly wired under a later, separately-approved GO, it FAILS CLOSED so an accidental early call
 * cannot silently open a database connection. The real construction body is deferred to a future,
 * separately-reviewed slice (PR C1+ / C2), never to this scaffold.
 */
export function createPoolScaffoldUnwired(_config: IntendedPoolConfig): never {
  throw new Error("db_pool_factory_scaffold_unwired");
}
