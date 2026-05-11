/**
 * Sprint 1 PR#5b-1 — core per-event validation (Track B).
 *
 * Pure function. Implements §2.9 R-2 (required fields), R-3 (browser session_id),
 * R-5 (occurred_at window), R-9 (id_format admit set: uuidv4 / uuidv7 only),
 * R-10 (event_origin / event_type matrix), R-12 (debug=true reject for
 * site-write-token writes).
 *
 * Per Decision D3, first deterministic reason wins — we do NOT accumulate
 * multiple validation errors. The order of checks is documented at each step
 * so reviewers can verify the deterministic ordering.
 *
 * NOT in scope (deferred to PR#5b-2 / PR#5b-3 / PR#5c):
 *   - PII regex (§2.10) — PR#5b-2
 *   - consent-denied + consent_state_summary forbidden-fields (R-11) — PR#5b-2
 *   - boundary mismatch (R-/§4.1 #5) — PR#5b-2 (wraps PR#4 helper)
 *   - intra-batch dedupe — PR#5b-2
 *   - canonical_jsonb projection — PR#5b-3
 *   - per-event payload_sha256 canonicalisation — PR#5b-3
 *   - schema_version_unsupported (depends on a registry) — deferred
 *   - field-level reasons (missing_required_field, property_type_mismatch,
 *     property_not_allowed, context_not_allowed) — PR#5b-2 once schema lookup exists
 */

import type { ReasonCode } from './reason-codes.js';

/* --------------------------------------------------------------------------
 * Public type aliases (per PR#5b-1 spec).
 * ------------------------------------------------------------------------ */

export type IdFormat = 'uuidv7' | 'uuidv4' | 'invalid';
export type EventOrigin = 'browser' | 'server' | 'system';
export type EventType = 'page' | 'track' | 'identify' | 'group' | 'system' | 'debug';

/* --------------------------------------------------------------------------
 * Internal admit sets and constants.
 * ------------------------------------------------------------------------ */

const VALID_EVENT_ORIGINS: ReadonlySet<string> = new Set<EventOrigin>([
  'browser',
  'server',
  'system',
]);

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  'page',
  'track',
  'identify',
  'group',
  'system',
  'debug',
]);

const ALLOWED_TYPES_BY_ORIGIN: Record<EventOrigin, ReadonlySet<EventType>> = {
  browser: new Set<EventType>(['page', 'track']),
  server: new Set<EventType>(['track', 'identify', 'group', 'system']),
  // Per the user's spec: PR#5b-1 admits {system, debug} for origin='system'.
  // PR#5b-2/5c will distinguish admin/internal from site-write paths and
  // tighten the system+debug case where appropriate.
  system: new Set<EventType>(['system', 'debug']),
};

/** Strict UUIDv4 — version nibble = 4, RFC 4122 variant. */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Strict UUIDv7 — version nibble = 7, RFC 4122 variant. */
const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Three-component semver shape check (e.g. "1.0.0", "2.10.3"). PR#5b-1 enforces shape only. */
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** R-5 windows: occurred_at must be within (-24h, +5min) of the server clock. */
const FIVE_MIN_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/* --------------------------------------------------------------------------
 * Exported helpers.
 * ------------------------------------------------------------------------ */

/**
 * Detect a `client_event_id` format per §2.9 R-9.
 *
 * Sprint 1 admits `uuidv4` and `uuidv7` only; UUIDv5, opaque strings, integers,
 * non-strings, and the empty string all return `'invalid'`. The caller is
 * responsible for distinguishing missing (undefined / null) from invalid
 * before calling this — both are mapped to `'invalid'` here.
 */
export function detectClientEventIdFormat(value: unknown): IdFormat {
  if (typeof value !== 'string' || value.length === 0) return 'invalid';
  if (UUID_V7_RE.test(value)) return 'uuidv7';
  if (UUID_V4_RE.test(value)) return 'uuidv4';
  return 'invalid';
}

/**
 * Validate `(event_origin, event_type)` per §2.9 R-10. Returns null on accept.
 *
 * - Unknown / non-string origin → `event_origin_invalid` (covers reserved
 *   values `agent_ai` / `agent_human`).
 * - Unknown / non-string event_type → `event_type_invalid`.
 * - Origin × type matrix violation → `event_type_invalid`.
 */
export function validateEventTypeOrigin(
  origin: unknown,
  eventType: unknown,
): ReasonCode | null {
  if (typeof origin !== 'string' || origin.length === 0 || !VALID_EVENT_ORIGINS.has(origin)) {
    return 'event_origin_invalid';
  }
  if (
    typeof eventType !== 'string' ||
    eventType.length === 0 ||
    !VALID_EVENT_TYPES.has(eventType)
  ) {
    return 'event_type_invalid';
  }
  const allowed = ALLOWED_TYPES_BY_ORIGIN[origin as EventOrigin];
  if (!allowed.has(eventType as EventType)) {
    return 'event_type_invalid';
  }
  return null;
}

/* --------------------------------------------------------------------------
 * validateEventCore — full per-event check.
 * ------------------------------------------------------------------------ */

export interface ValidateEventCoreInput {
  /** The parsed per-event JSON object (one element of envelope.events). */
  event: unknown;
  /**
   * Source of the request's auth credential. Site-write tokens cause R-12
   * (debug=true → debug_only_not_allowed). Admin / internal token kinds may
   * carry debug=true legitimately. Defaults to `'site_write'` (the common case).
   */
  source_token_kind?: 'site_write' | 'admin' | 'internal';
  /** Override clock for deterministic tests. Defaults to `Date.now()`. */
  now_ms?: number;
}

export interface EventValidationOk {
  ok: true;
  event_origin: EventOrigin;
  event_type: EventType;
  event_name: string;
  schema_key: string;
  schema_version: string;
  client_event_id: string;
  /** Always 'uuidv4' or 'uuidv7' on an accepted event (never 'invalid'). */
  id_format: 'uuidv4' | 'uuidv7';
  /** null is allowed only for non-browser origins (R-3). Browser events always have a string here. */
  session_id: string | null;
  occurred_at: Date;
}

export interface EventValidationReject {
  ok: false;
  reason_code: ReasonCode;
}

/**
 * Validate a single parsed event per §2.9 R-2 / R-3 / R-5 / R-9 / R-10 / R-12.
 *
 * Deterministic check order (D3 — first match wins):
 *   1. event_origin and event_type are present, well-formed, and matrix-consistent (R-10).
 *   2. Browser-origin events carry a non-empty session_id (R-3).
 *   3. event_name is a non-empty string (R-2).
 *   4. schema_key is a non-empty string (R-2).
 *   5. schema_version is a three-component semver string (R-2).
 *   6. client_event_id is present and is uuidv4 / uuidv7 (R-9).
 *   7. occurred_at is a parseable timestamp inside the (-24h, +5min) window (R-5).
 *   8. R-12: payload `debug = true` is rejected for site-write-token sources.
 */
export function validateEventCore(
  input: ValidateEventCoreInput,
): EventValidationOk | EventValidationReject {
  // Top-level shape: must be a plain JSON object.
  if (typeof input.event !== 'object' || input.event === null || Array.isArray(input.event)) {
    return { ok: false, reason_code: 'missing_required_field' };
  }
  const e = input.event as Record<string, unknown>;
  const sourceKind = input.source_token_kind ?? 'site_write';
  const nowMs = typeof input.now_ms === 'number' ? input.now_ms : Date.now();

  // Step 1 — event_origin × event_type matrix (R-10).
  const matrixReject = validateEventTypeOrigin(e.event_origin, e.event_type);
  if (matrixReject !== null) return { ok: false, reason_code: matrixReject };
  const event_origin = e.event_origin as EventOrigin;
  const event_type = e.event_type as EventType;

  // Step 2 — browser-origin events require a non-empty session_id (R-3).
  let session_id: string | null;
  if (event_origin === 'browser') {
    if (typeof e.session_id !== 'string' || e.session_id.length === 0) {
      return { ok: false, reason_code: 'session_id_missing' };
    }
    session_id = e.session_id;
  } else {
    // server / system: session_id is optional. If present it must be a non-empty string.
    if (e.session_id === undefined || e.session_id === null) {
      session_id = null;
    } else if (typeof e.session_id === 'string' && e.session_id.length > 0) {
      session_id = e.session_id;
    } else {
      return { ok: false, reason_code: 'session_id_invalid' };
    }
  }

  // Step 3 — event_name (R-2).
  if (typeof e.event_name !== 'string' || e.event_name.length === 0) {
    return { ok: false, reason_code: 'event_name_invalid' };
  }
  const event_name = e.event_name;

  // Step 4 — schema_key (R-2). PR#5b-1 only checks shape; registry lookup
  // (and `schema_version_unsupported`) is deferred.
  if (typeof e.schema_key !== 'string' || e.schema_key.length === 0) {
    return { ok: false, reason_code: 'schema_unknown' };
  }
  const schema_key = e.schema_key;

  // Step 5 — schema_version (R-2). Three-component semver shape only.
  if (typeof e.schema_version !== 'string' || !SEMVER_RE.test(e.schema_version)) {
    return { ok: false, reason_code: 'schema_version_malformed' };
  }
  const schema_version = e.schema_version;

  // Step 6 — client_event_id (R-9; uuidv4 or uuidv7 only).
  if (e.client_event_id === undefined || e.client_event_id === null || e.client_event_id === '') {
    return { ok: false, reason_code: 'client_event_id_missing' };
  }
  const id_format = detectClientEventIdFormat(e.client_event_id);
  if (id_format === 'invalid') {
    return { ok: false, reason_code: 'client_event_id_invalid' };
  }
  const client_event_id = e.client_event_id as string;

  // Step 7 — occurred_at (R-5 window).
  if (e.occurred_at === undefined || e.occurred_at === null || e.occurred_at === '') {
    return { ok: false, reason_code: 'occurred_at_missing' };
  }
  let occurred_at: Date;
  if (typeof e.occurred_at === 'number' && Number.isFinite(e.occurred_at)) {
    occurred_at = new Date(e.occurred_at);
  } else if (typeof e.occurred_at === 'string') {
    const t = Date.parse(e.occurred_at);
    if (!Number.isFinite(t)) return { ok: false, reason_code: 'occurred_at_invalid' };
    occurred_at = new Date(t);
  } else {
    return { ok: false, reason_code: 'occurred_at_invalid' };
  }
  const occurredMs = occurred_at.getTime();
  if (!Number.isFinite(occurredMs)) {
    return { ok: false, reason_code: 'occurred_at_invalid' };
  }
  if (occurredMs > nowMs + FIVE_MIN_MS) {
    return { ok: false, reason_code: 'occurred_at_too_future' };
  }
  if (occurredMs < nowMs - ONE_DAY_MS) {
    return { ok: false, reason_code: 'occurred_at_too_old' };
  }

  // Step 8 — R-12: payload debug=true via site-write token is rejected.
  if (e.debug === true && sourceKind === 'site_write') {
    return { ok: false, reason_code: 'debug_only_not_allowed' };
  }

  return {
    ok: true,
    event_origin,
    event_type,
    event_name,
    schema_key,
    schema_version,
    client_event_id,
    id_format: id_format as 'uuidv4' | 'uuidv7',
    session_id,
    occurred_at,
  };
}
