/**
 * Sprint 1 PR#7 — Express Request → RequestContext mapping (Track B).
 *
 * Pure helper. No DB. No env. No auth. No orchestrator call. Lifts header / IP
 * / clock / UUID extraction out of the route handler so the per-request mapping
 * is unit-testable without spinning up an HTTP server.
 *
 * Critical invariants:
 *   - raw_body_bytes MUST be the exact Buffer produced by express.raw, never
 *     reconstructed from parsed JSON.
 *   - ctx.ip stays null when missing — caller (route layer) is responsible for
 *     returning collector_misconfigured. No fake "0.0.0.0" fallback.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import type { Request } from 'express';
import type { RequestContext } from './types.js';

export interface BuildRequestContextDeps {
  /** Generates a fresh request_id. Injectable for deterministic tests. */
  uuid: () => string;
  /** Captures the server-side received_at instant. Injectable for tests. */
  now: () => Date;
}

export interface BuildRequestContextArgs {
  req: Request;
  /** Exact wire bytes from express.raw — must NOT be a re-serialised JSON. */
  raw_body_bytes: Buffer;
  /** Endpoint literal. Set by the per-route handler ('/v1/event' | '/v1/batch'). */
  endpoint: string;
}

/**
 * Build a RequestContext from an Express request + the raw body Buffer.
 *
 * Behaviour:
 *   - request_id: deps.uuid()
 *   - received_at: deps.now()
 *   - method: req.method
 *   - content_type: req.headers['content-type'] as the raw string (or null)
 *   - user_agent: req.headers['user-agent'] (or null)
 *   - auth_header: req.headers['authorization'] (or null)
 *   - ip: prefers req.socket.remoteAddress (most direct); falls back to req.ip
 *         only if a trust-proxy chain is in use; null if neither is available
 *   - raw_body_bytes: the Buffer passed in
 *
 * The route handler MUST check ctx.ip !== null before invoking runRequest;
 * a null ip is treated as collector_misconfigured (500), never faked.
 */
export function buildRequestContext(
  deps: BuildRequestContextDeps,
  args: BuildRequestContextArgs,
): RequestContext {
  const { req, raw_body_bytes, endpoint } = args;

  const content_type = firstStringHeader(req.headers['content-type']);
  const user_agent = firstStringHeader(req.headers['user-agent']);
  const auth_header = firstStringHeader(req.headers['authorization']);

  // Prefer socket.remoteAddress (raw, not influenced by X-Forwarded-For unless
  // express trust-proxy is configured). Fall back to req.ip only when the
  // socket has no remoteAddress (rare; mocked socket in tests). Stay null
  // when neither is available — route layer returns 500 collector_misconfigured.
  const socketIp = req.socket?.remoteAddress;
  const reqIp = typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : null;
  const ip: string | null =
    typeof socketIp === 'string' && socketIp.length > 0 ? socketIp : reqIp;

  return {
    request_id: deps.uuid(),
    received_at: deps.now(),
    endpoint,
    method: req.method,
    content_type,
    user_agent,
    ip,
    auth_header,
    raw_body_bytes,
  };
}

/**
 * Normalise an Express header value (which may be string, string[], or
 * undefined) to either a non-empty string or null. For duplicate headers,
 * pick the first occurrence — matches Node's default behaviour for the
 * relevant single-value headers in this PR.
 */
function firstStringHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.length > 0);
    return typeof first === 'string' ? first : null;
  }
  return null;
}
