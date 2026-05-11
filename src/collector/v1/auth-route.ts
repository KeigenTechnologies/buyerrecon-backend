/**
 * Sprint 1 PR#7 — bearer-token extraction + prefetch-adapter auth resolution
 * (Track B).
 *
 * The existing src/auth/workspace.ts resolveSiteWriteToken is SYNCHRONOUS and
 * takes a sync `LookupByHash` callback. To avoid modifying that PR#4 module,
 * PR#7 follows the prefetch-adapter pattern:
 *
 *   1. extractBearerToken from the Authorization header (sync, pure)
 *   2. hash the token via hashSiteWriteToken (the same function
 *      resolveSiteWriteToken would call internally) and run the DB SELECT
 *      asynchronously here
 *   3. pass a sync closure (() => prefetchedRow) to resolveSiteWriteToken
 *
 * Map the ResolveResult into the auth slice runRequest expects. The route
 * handler never sees the raw token after this helper completes.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import {
  hashSiteWriteToken,
  resolveSiteWriteToken,
  type SiteWriteTokenRow,
} from '../../auth/workspace.js';
import type { RunRequestInput } from './orchestrator.js';

/** Async lookup signature; injected by createV1Router (or by tests). */
export type AsyncLookupByHash = (hash: string) => Promise<SiteWriteTokenRow | null>;

/**
 * Pull a non-empty bearer token out of an Authorization header value.
 *
 * Returns null (treated downstream as auth_invalid) for:
 *   - null / undefined / empty header
 *   - non-Bearer scheme (e.g., Basic, Digest)
 *   - missing token after "Bearer "
 *   - more than two whitespace-separated parts
 *   - empty token after trimming
 *
 * The scheme keyword is case-sensitive at "Bearer" per RFC 6750 §2.1 in
 * spirit — but we accept any casing of "bearer" because real-world SDKs are
 * inconsistent and rejecting cased variants would just produce spurious
 * auth_invalid noise. The token itself is NOT case-normalised.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (typeof authHeader !== 'string' || authHeader.length === 0) return null;
  const parts = authHeader.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') return null;
  if (token.length === 0) return null;
  return token;
}

/** Result type returned by resolveAuthForRunRequest. */
export type AuthResolution = RunRequestInput['auth'];

/**
 * Resolve the Authorization header into the auth slice runRequest expects.
 *
 * Behaviour:
 *   - empty / malformed bearer → { status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' }
 *   - unknown token            → same as above (lookup miss is indistinguishable from invalid)
 *   - disabled token           → { status: 'site_disabled', resolved: null, reason_code: 'auth_site_disabled' }
 *   - active token             → { status: 'ok', resolved: {token_id, workspace_id, site_id}, reason_code: null }
 *
 * Throws if the DB lookup itself fails — the route handler maps that to
 * HTTP 500 auth_lookup_failure. Never returns or logs the raw token.
 */
export async function resolveAuthForRunRequest(
  authHeader: string | null,
  pepper: string,
  asyncLookup: AsyncLookupByHash,
): Promise<AuthResolution> {
  const token = extractBearerToken(authHeader);
  if (token === null) {
    return { status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' };
  }

  // Hash up-front and SELECT before handing a sync closure to the pure
  // PR#4 helper. This preserves the prefetch-adapter contract without
  // modifying src/auth/workspace.ts.
  const hash = hashSiteWriteToken(token, pepper);
  const row = await asyncLookup(hash);

  // Pass the original token + pepper so resolveSiteWriteToken re-hashes
  // identically; the lookupByHash closure simply returns the prefetched row.
  const result = resolveSiteWriteToken(token, pepper, () => row);

  if (result.ok) {
    return {
      status: 'ok',
      resolved: {
        token_id: result.token_id,
        workspace_id: result.workspace_id,
        site_id: result.site_id,
      },
      reason_code: null,
    };
  }

  if (result.reason_code === 'auth_site_disabled') {
    return { status: 'site_disabled', resolved: null, reason_code: 'auth_site_disabled' };
  }
  return { status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' };
}
