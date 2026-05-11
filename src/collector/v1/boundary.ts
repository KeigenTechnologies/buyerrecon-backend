/**
 * Sprint 1 PR#5b-2 — boundary wrapper around PR#4 auth helper (Track B).
 *
 * Pure function. No env reads, no DB, no token hashing, no auth lookup, no
 * route binding. This module is a thin v1-namespace wrapper around the PR#4
 * helper at src/auth/workspace.ts so the orchestrator (PR#5c) can call all
 * v1 validation modules through a consistent surface.
 *
 * Decision D10: payload is typed `unknown` defensively. PR#4's
 * assertPayloadBoundary already guards every payload field with a runtime
 * `typeof === 'string'` check, so non-string values pass through harmlessly
 * (treated as not-present); the TypeScript cast here is purely to satisfy
 * the narrower PR#4 interface signature.
 */

import { assertPayloadBoundary } from '../../auth/workspace.js';

export interface PayloadBoundaryFields {
  workspace_id?: unknown;
  site_id?: unknown;
}

export type ValidatePayloadBoundaryResult =
  | { ok: true }
  | { ok: false; reason_code: 'workspace_site_mismatch' };

/**
 * Verify payload-side workspace_id / site_id (when present) match the
 * auth-derived (workspace_id, site_id). Per §1 Decision #4 + §3 invariant,
 * the server NEVER trusts payload-side values; this wrapper exists only to
 * detect a sender that has supplied conflicting payload values, which is a
 * §4.1 #5 reject (workspace_site_mismatch).
 *
 * Behaviour:
 *   - payload undefined / null / empty {}                           → ok
 *   - payload.workspace_id matches resolved (or absent / non-string) → continue
 *   - payload.workspace_id is a string and !== resolved              → workspace_site_mismatch
 *   - payload.site_id is a string and !== resolved                   → workspace_site_mismatch
 *
 * Result NEVER echoes payload-side workspace/site values.
 */
export function validatePayloadBoundary(
  resolved: { workspace_id: string; site_id: string },
  payload: PayloadBoundaryFields | null | undefined,
): ValidatePayloadBoundaryResult {
  // PR#4's helper accepts a narrower PayloadBoundary type but performs runtime
  // typeof guards. The cast lets unknown-typed payload values pass through
  // safely — non-string values are treated as not-present and the function
  // returns ok unless an actual string mismatch is found.
  return assertPayloadBoundary(
    resolved,
    payload as { workspace_id?: string | null; site_id?: string | null } | null | undefined,
  );
}
