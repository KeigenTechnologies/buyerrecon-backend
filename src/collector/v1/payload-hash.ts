/**
 * Sprint 1 PR#5b-3 — payload hash helper (Track B).
 *
 * Pure function. No env reads, no DB, no runtime clock reads, no logging,
 * no network. Composes PR#5a's `sha256Hex` with PR#5b-3's `stableStringify`
 * to produce a deterministic 64-char lowercase hex digest.
 *
 * IMPORTANT — the input shape is the CALLER's responsibility:
 *
 *   `canonical_jsonb` is NOT the same as the input that
 *   `accepted_events.payload_sha256` will later be computed over.
 *
 * Per handoff §2.5 line 168, `accepted_events.payload_sha256` is the SHA-256
 * of the *individual normalised event envelope* — "after canonicalisation,
 * before the canonical projection". `canonical_jsonb` (built by
 * `canonical.ts`) is the data-minimised durable projection used as evidence.
 * The two shapes are deliberately distinct in the spec.
 *
 * `payloadSha256` ships only the deterministic helper. PR#5c orchestrator
 * decides which exact normalised envelope shape to feed into this function
 * for each call site (accepted_events, rejected_events, ingest_requests).
 *
 * Errors:
 *   - undefined / NaN / Infinity / BigInt / Map / Set / RegExp / Buffer /
 *     class instance / circular / invalid Date all propagate the
 *     `stableStringify` TypeError unchanged. The caller sees a single
 *     deterministic failure surface for unsupported inputs.
 */

import { sha256Hex } from './hash.js';
import { stableStringify } from './stable-json.js';

/**
 * SHA-256 of `stableStringify(value)` → 64-char lowercase hex.
 *
 * Output format: raw hex (no `sha256:` prefix). Matches the shape of PR#5a's
 * `sha256Hex` and `ipHash`, and matches the schema-side TEXT columns
 * `accepted_events.payload_sha256`, `rejected_events.raw_payload_sha256`,
 * `ingest_requests.request_body_sha256`.
 */
export function payloadSha256(value: unknown): string {
  return sha256Hex(stableStringify(value));
}
