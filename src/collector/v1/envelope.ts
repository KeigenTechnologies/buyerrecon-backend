/**
 * Sprint 1 PR#5b-1 — request envelope parser (Track B).
 *
 * Pure function. Validates content-type, body size limits, and JSON envelope
 * shape per §2.9 R-1 + §2.9 R-6 + §2.2 collector API surface.
 *
 * No HTTP / Express / DB / env. The caller passes raw body bytes + content-type
 * + endpoint; parseEnvelope returns either parsed events or one of the five
 * §2.8 envelope reason codes (per D3, first deterministic reason wins).
 *
 * Note on shape errors. §2.8 has no separate code for "valid JSON but wrong
 * envelope shape" (e.g. /v1/batch body where `events` is not an array, or a
 * top-level array sent to /v1/event). We map all such cases to
 * `request_body_invalid_json` — the body is not a valid request body even
 * though JSON.parse succeeded. This matches the canonical enum without
 * adding new reason codes.
 */

import type { ReasonCode } from './reason-codes.js';

export const V1_EVENT_MAX_BYTES = 32 * 1024;
export const V1_BATCH_MAX_BYTES = 512 * 1024;
export const V1_BATCH_MAX_EVENTS = 100;

export type V1Endpoint = '/v1/event' | '/v1/batch';

export interface ParseEnvelopeInput {
  endpoint: V1Endpoint;
  /** Raw `Content-Type` header value, or null if the header was absent. */
  content_type: string | null;
  /** Exact body bytes — fed to size cap, JSON.parse, and (in PR#5c) request_body_sha256. */
  raw_body_bytes: Buffer;
}

/** Subset of ReasonCode that this module can return. */
export type EnvelopeReasonCode = Extract<
  ReasonCode,
  | 'content_type_invalid'
  | 'request_body_invalid_json'
  | 'request_too_large'
  | 'batch_too_large'
  | 'batch_item_count_exceeded'
>;

export type EnvelopeResult =
  | { ok: true; events: unknown[] }
  | { ok: false; reason_code: EnvelopeReasonCode };

/**
 * True iff the Content-Type's base media type is application/json.
 *
 * Optional parameters (e.g. `; charset=utf-8`) are accepted. Comparison is
 * case-insensitive on the base media type per RFC 7231 §3.1.1.
 *
 * Examples accepted:  'application/json'
 *                     'application/json; charset=utf-8'
 *                     'application/json;charset=UTF-8'
 *                     'Application/JSON'
 *
 * Examples rejected:  null, '', 'text/plain', 'application/xml',
 *                     'application/x-www-form-urlencoded',
 *                     'application/vnd.api+json' (strict — no `+json` suffix)
 */
export function isJsonContentType(content_type: string | null): boolean {
  if (typeof content_type !== 'string' || content_type.length === 0) return false;
  const semiIdx = content_type.indexOf(';');
  const base = (semiIdx === -1 ? content_type : content_type.slice(0, semiIdx))
    .trim()
    .toLowerCase();
  return base === 'application/json';
}

export function parseEnvelope(input: ParseEnvelopeInput): EnvelopeResult {
  const { endpoint, content_type, raw_body_bytes } = input;

  // 1. Content-Type
  if (!isJsonContentType(content_type)) {
    return { ok: false, reason_code: 'content_type_invalid' };
  }

  // 2. Size cap (per endpoint). Bytes-on-the-wire — measured before decode/parse.
  if (endpoint === '/v1/event' && raw_body_bytes.byteLength > V1_EVENT_MAX_BYTES) {
    return { ok: false, reason_code: 'request_too_large' };
  }
  if (endpoint === '/v1/batch' && raw_body_bytes.byteLength > V1_BATCH_MAX_BYTES) {
    return { ok: false, reason_code: 'batch_too_large' };
  }

  // 3. JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_body_bytes.toString('utf8'));
  } catch {
    return { ok: false, reason_code: 'request_body_invalid_json' };
  }

  // 4. Endpoint-specific shape check
  if (endpoint === '/v1/event') {
    // /v1/event body must be a JSON object (single event). Arrays / null / primitives reject.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason_code: 'request_body_invalid_json' };
    }
    return { ok: true, events: [parsed] };
  }

  // /v1/batch body must be a JSON object with `events: array`.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason_code: 'request_body_invalid_json' };
  }
  const events = (parsed as Record<string, unknown>).events;
  if (!Array.isArray(events)) {
    return { ok: false, reason_code: 'request_body_invalid_json' };
  }

  // 5. Batch item count cap
  if (events.length > V1_BATCH_MAX_EVENTS) {
    return { ok: false, reason_code: 'batch_item_count_exceeded' };
  }

  return { ok: true, events };
}
