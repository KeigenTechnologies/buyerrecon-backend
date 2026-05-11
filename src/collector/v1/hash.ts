/**
 * Sprint 1 PR#5a — hash helpers (Track B).
 *
 * Pure functions. No env reads. No DB / log / network. No persistence.
 *
 * sha256Hex — content fingerprint helper for request_body_sha256 (PR#5c)
 *   and per-event payload_sha256 (PR#5b/5c). Plain SHA-256 is fine here:
 *   these are integrity proofs of payload bytes, not security-sensitive
 *   secrets. Pepper is unnecessary.
 *
 * ipHash — workspace-scoped IP pseudonymisation (Decision D8). HMAC-SHA256
 *   with a server-held pepper. The pepper is supplied by the caller — env
 *   reads land in PR#5c. The future env var name is IP_HASH_PEPPER (kept
 *   distinct from SITE_WRITE_TOKEN_PEPPER so they can rotate independently).
 *   Raw IP is normalised (lowercase + trim) for stable equality across IPv6
 *   canonicalisation variants but is NEVER returned from this module.
 */

import { createHash, createHmac } from 'crypto';

/**
 * SHA-256 of an arbitrary input → 64-char lowercase hex digest.
 *
 * Throws on null/undefined input. The empty string IS a valid input and
 * returns the well-known empty-input digest
 * (e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855).
 */
export function sha256Hex(input: Buffer | string): string {
  if (input === null || input === undefined) {
    throw new Error('sha256Hex: input must be Buffer or string');
  }
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Workspace-scoped HMAC-SHA256 of an IP address → 64-char lowercase hex.
 *
 *   ipHash(ip, workspaceId, pepper)
 *     = HMAC-SHA256(`${workspaceId}:${ip.toLowerCase().trim()}`, pepper)
 *
 * Properties:
 * - Deterministic for fixed (ip, workspaceId, pepper).
 * - Different workspace_id → different hash (cross-workspace correlation prevented).
 * - Different pepper → different hash (rotation invalidates prior matches).
 * - Raw IP is never returned; only the hash hex is.
 *
 * Throws on empty inputs. The caller is responsible for sourcing the pepper
 * (env-var read happens in PR#5c, not here).
 */
export function ipHash(ip: string, workspaceId: string, pepper: string): string {
  if (typeof ip !== 'string' || ip.length === 0) {
    throw new Error('ipHash: ip must be a non-empty string');
  }
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw new Error('ipHash: workspaceId must be a non-empty string');
  }
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('ipHash: pepper must be a non-empty string');
  }
  const normalisedIp = ip.toLowerCase().trim();
  return createHmac('sha256', pepper).update(`${workspaceId}:${normalisedIp}`).digest('hex');
}
