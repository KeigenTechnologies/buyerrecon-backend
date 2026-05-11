/**
 * Sprint 1 PR#4 — workspace/site auth resolution layer.
 *
 * Pure functions only. No DB connection. No env-var read. No logging.
 * The caller (collector wiring lands in §3.PR#5) supplies:
 *   - the raw token (from the Authorization header)
 *   - the pepper (loaded by the caller from SITE_WRITE_TOKEN_PEPPER)
 *   - a lookupByHash callback that performs the DB query
 *
 * This shape mirrors the existing src/probe/encrypt.ts convention
 * (encryptEmail takes the key as a parameter) so tests can inject a
 * deterministic pepper and a stub lookup without touching env or DB.
 *
 * Spec: handoff §1 Decision #4, §2.1, §2.2, §2.7 auth_status,
 *       §2.8 reason codes (auth_invalid | auth_site_disabled | workspace_site_mismatch),
 *       §3.PR#4, §3 invariants, §4.1 #5.
 *
 * Three-part architecture: this is Track B (evidence/security foundation).
 * NOT Track A scoring. NOT Core AMS product code.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stable hash of a site write token, suitable for indexed equality lookup.
 *
 * HMAC-SHA256(token, pepper) — see PR#4 doc for rationale.
 * - Defeats DB-leak offline matching (attacker also needs the pepper).
 * - O(1) deterministic, no per-row salt.
 * - Raw token is never returned.
 *
 * @param token  the raw bearer token (case-sensitive; not normalised).
 * @param pepper the server pepper (≥ 32 random bytes, hex-encoded recommended).
 * @returns a 64-char lowercase hex digest.
 */
export function hashSiteWriteToken(token: string, pepper: string): string {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('hashSiteWriteToken: token must be a non-empty string');
  }
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('hashSiteWriteToken: pepper must be a non-empty string');
  }
  return createHmac('sha256', pepper).update(token).digest('hex');
}

/**
 * Constant-time hex string comparison. Used as an internal guard against
 * timing oracles when the caller cross-checks two hashes.
 *
 * Both inputs MUST be hex strings of equal length (typical: 64 chars).
 * Returns false (not throws) on length mismatch — the caller treats unequal
 * inputs as "no match" rather than as an error condition.
 */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  // timingSafeEqual requires equal-length Buffers.
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Row shape returned by the caller's lookupByHash callback. */
export interface SiteWriteTokenRow {
  token_id: string;
  workspace_id: string;
  site_id: string;
  disabled_at: Date | string | null;
}

/** Synchronous lookup callback — caller decides DB driver, async wrapping, etc. */
export type LookupByHash = (hash: string) => SiteWriteTokenRow | null;

/** Successful resolution: server-stamped workspace/site identity. */
export interface ResolveOk {
  ok: true;
  token_id: string;
  workspace_id: string;
  site_id: string;
}

/** Rejection: §2.8 reason codes for the auth stage only. */
export interface ResolveErr {
  ok: false;
  reason_code: 'auth_invalid' | 'auth_site_disabled';
}

export type ResolveResult = ResolveOk | ResolveErr;

/**
 * Resolve a raw bearer token to a (workspace_id, site_id) identity.
 *
 * Rules (per §2.8 + §4.1 #5):
 *   - missing/empty token       → auth_invalid
 *   - unknown token (no row)    → auth_invalid
 *   - found row + disabled_at   → auth_site_disabled
 *   - found row + active        → ok (workspace_id, site_id, token_id)
 *
 * Does NOT update last_used_at (pure-function constraint; PR#5 wires that).
 * Does NOT trust payload values (caller passes only the token + pepper).
 */
export function resolveSiteWriteToken(
  token: string | null | undefined,
  pepper: string,
  lookupByHash: LookupByHash,
): ResolveResult {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, reason_code: 'auth_invalid' };
  }
  if (typeof pepper !== 'string' || pepper.length === 0) {
    // Pepper misconfiguration is a server config error, but from the auth
    // standpoint there is no way to admit anyone — surface it as auth_invalid
    // rather than throw (matches §2.7 auth_status='invalid_token').
    return { ok: false, reason_code: 'auth_invalid' };
  }

  const hash = hashSiteWriteToken(token, pepper);
  const row = lookupByHash(hash);
  if (row === null) {
    return { ok: false, reason_code: 'auth_invalid' };
  }
  if (row.disabled_at !== null && row.disabled_at !== undefined) {
    return { ok: false, reason_code: 'auth_site_disabled' };
  }
  return {
    ok: true,
    token_id: row.token_id,
    workspace_id: row.workspace_id,
    site_id: row.site_id,
  };
}

/** Subset of payload that may carry boundary fields the server must verify. */
export interface PayloadBoundary {
  workspace_id?: string | null;
  site_id?: string | null;
}

/** Resolved (auth-derived) identity passed in by the caller. */
export interface ResolvedBoundary {
  workspace_id: string;
  site_id: string;
}

/** Boundary check result. */
export type BoundaryResult =
  | { ok: true }
  | { ok: false; reason_code: 'workspace_site_mismatch' };

/**
 * Verify the payload-side boundary fields (if present) match the auth-derived
 * boundary. Per §1 Decision #4 and the §3 invariant, the server NEVER trusts
 * payload-side workspace_id/site_id — this function exists only to detect a
 * sender that has supplied conflicting values, which is a §4.1 #5 reject.
 *
 * Rules:
 *   - payload.workspace_id present and !== resolved.workspace_id → workspace_site_mismatch
 *   - payload.site_id present and !== resolved.site_id           → workspace_site_mismatch
 *   - payload missing both fields                                → ok (server stamps resolved values)
 *
 * NEVER returns payload-side values back to the caller. The caller receives
 * either ok or a reject reason; the server-stamped (resolved) identity is
 * already in the caller's hand from resolveSiteWriteToken.
 */
export function assertPayloadBoundary(
  resolved: ResolvedBoundary,
  payload?: PayloadBoundary | null,
): BoundaryResult {
  if (!payload) return { ok: true };

  // Treat null and undefined as "not present" — both are common JSON shapes.
  const pw = payload.workspace_id;
  const ps = payload.site_id;

  if (typeof pw === 'string' && pw.length > 0 && pw !== resolved.workspace_id) {
    return { ok: false, reason_code: 'workspace_site_mismatch' };
  }
  if (typeof ps === 'string' && ps.length > 0 && ps !== resolved.site_id) {
    return { ok: false, reason_code: 'workspace_site_mismatch' };
  }
  return { ok: true };
}
