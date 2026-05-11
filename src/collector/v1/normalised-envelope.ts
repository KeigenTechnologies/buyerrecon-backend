/**
 * Sprint 1 PR#5c-1 — accepted-event normalised envelope (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network, no Date.now.
 *
 * Per handoff §2.5 line 168, `accepted_events.payload_sha256` is the SHA-256
 * of the *individual normalised event envelope* — "after canonicalisation,
 * before the canonical projection". This module produces THAT shape.
 *
 *   accepted_events.payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope(...))
 *
 * IMPORTANT — this is NOT canonical_jsonb. The two shapes are deliberately
 * distinct:
 *   - normalisedEnvelope: broader, 36-key allowlist, includes server-stamped
 *     fields per §2.1, includes `properties` / `context` / `page_*` (post
 *     allowlist validation), used as the per-event hash input.
 *   - canonical_jsonb (canonical.ts): narrower 19-key data-minimised
 *     projection, used as the durable evidence column.
 *
 * Rules:
 *   - Fixed 36-key allowlist. Output always has exactly the 36 keys; missing
 *     optional fields are emitted as null (parallel to canonical_jsonb's
 *     null-policy).
 *   - traffic_class is always 'unknown' (Decision #13 / Sprint 1).
 *   - debug is always false (site-token writes never set debug=true per R-12;
 *     R-12 already rejected such events upstream).
 *   - All Date inputs are converted to ISO 8601 strings; date-shaped string
 *     inputs are normalised through Date.parse → toISOString so the same
 *     instant produces the same hash regardless of input formatting.
 *   - size_bytes is computed from stableStringify(raw_event), NOT
 *     JSON.stringify(raw_event), so the byte length is deterministic and
 *     independent of object-key insertion order.
 *
 * Excluded under all circumstances:
 *   canonical_jsonb, payload_sha256, accepted_at, payload_purged_at, ip_hash,
 *   user_agent, raw IP, risk_score, classification, recommended_action,
 *   behavioural_score, bot_score, agent_score, is_bot, is_agent.
 *
 * NOT validation: this module trusts that PR#5b-1 / PR#5b-2 have already run
 * and accepted the event. It does no PII / consent / boundary / dedupe /
 * R-rule checks. It is a projection layer.
 */

import type { EventValidationOk } from './validation.js';
import { stableStringify } from './stable-json.js';

export interface NormalisedEnvelopeInput {
  validated: EventValidationOk;
  resolved: { workspace_id: string; site_id: string };
  ctx: { request_id: string; received_at: Date };
  /** The original event JSON object as parsed from the wire (post-validation). */
  raw_event: Record<string, unknown>;
  config: {
    validator_version: string;
    collector_version: string;
  };
}

/* --------------------------------------------------------------------------
 * Allowlist key constants (exported for tests).
 * ------------------------------------------------------------------------ */

export const NORMALISED_ENVELOPE_KEYS = [
  // Server-stamped — per §2.1 server-stamped fields table
  'request_id',
  'received_at',
  'workspace_id',
  'site_id',
  'validator_version',
  'collector_version',
  'id_format',
  'traffic_class',
  'size_bytes',
  // Identity (validated)
  'client_event_id',
  'event_name',
  'event_type',
  'event_origin',
  // Schema (validated)
  'schema_key',
  'schema_version',
  // Time (validated)
  'occurred_at',
  // Identity / join (raw_event)
  'anonymous_id',
  'user_id',
  'company_id',
  'session_id',
  'session_seq',
  'session_started_at',
  'session_last_seen_at',
  // Consent (raw_event)
  'consent_state',
  'consent_source',
  'consent_updated_at',
  'pre_consent_mode',
  'tracking_mode',
  'storage_mechanism',
  // Page (raw_event)
  'page_url',
  'page_path',
  'page_referrer',
  'page_title',
  // Containers (raw_event)
  'properties',
  'context',
  // Debug
  'debug',
] as const;

/* --------------------------------------------------------------------------
 * Internal type-narrowing helpers (defensive — never throws on type drift).
 * ------------------------------------------------------------------------ */

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asFiniteNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asBooleanOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function asPlainObjectOrNull(v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return null;
  return v as Record<string, unknown>;
}

/**
 * Normalise a date-shaped value (Date instance or ISO/parseable string) to a
 * canonical ISO 8601 string. Returns null on missing / invalid input.
 *
 * Note: this routes ALL date-ish values through Date.parse → toISOString so
 * input formatting variants (`'2026-05-09T10:00:00Z'` vs
 * `'2026-05-09T10:00:00.000Z'`) produce the same hashed output.
 */
function asIsoOrNull(v: unknown): string | null {
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (typeof v === 'string' && v.length > 0) {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/**
 * Build the per-event normalised envelope used as the input to
 * `payloadSha256(...)` for `accepted_events.payload_sha256`.
 *
 * Output: a plain object with exactly the 36 allowlisted keys. Missing
 * optional fields are emitted as `null`. `traffic_class` is always
 * `'unknown'`. `debug` is always `false`. `size_bytes` is the deterministic
 * byte length of `stableStringify(raw_event)`.
 */
export function buildAcceptedNormalisedEnvelope(
  input: NormalisedEnvelopeInput,
): Record<string, unknown> {
  const { validated, resolved, ctx, raw_event, config } = input;

  // size_bytes uses stableStringify (deterministic, key-order-independent)
  // rather than JSON.stringify (order-sensitive).
  const sizeBytes = Buffer.byteLength(stableStringify(raw_event), 'utf8');

  return {
    // Server-stamped (per §2.1)
    request_id: ctx.request_id,
    received_at: ctx.received_at.toISOString(),
    workspace_id: resolved.workspace_id,
    site_id: resolved.site_id,
    validator_version: config.validator_version,
    collector_version: config.collector_version,
    id_format: validated.id_format,
    // Sprint 1 / Decision #13: always 'unknown'.
    traffic_class: 'unknown',
    size_bytes: sizeBytes,

    // Identity (validated)
    client_event_id: validated.client_event_id,
    event_name: validated.event_name,
    event_type: validated.event_type,
    event_origin: validated.event_origin,

    // Schema (validated)
    schema_key: validated.schema_key,
    schema_version: validated.schema_version,

    // Time (validated)
    occurred_at: validated.occurred_at.toISOString(),

    // Identity / join (raw_event, defensive type-narrowing)
    anonymous_id: asStringOrNull(raw_event.anonymous_id),
    user_id: asStringOrNull(raw_event.user_id),
    company_id: asStringOrNull(raw_event.company_id),
    session_id: validated.session_id ?? null,
    session_seq: asFiniteNumberOrNull(raw_event.session_seq),
    session_started_at: asIsoOrNull(raw_event.session_started_at),
    session_last_seen_at: asIsoOrNull(raw_event.session_last_seen_at),

    // Consent (raw_event)
    consent_state: asStringOrNull(raw_event.consent_state),
    consent_source: asStringOrNull(raw_event.consent_source),
    consent_updated_at: asIsoOrNull(raw_event.consent_updated_at),
    pre_consent_mode: asBooleanOrNull(raw_event.pre_consent_mode),
    tracking_mode: asStringOrNull(raw_event.tracking_mode),
    storage_mechanism: asStringOrNull(raw_event.storage_mechanism),

    // Page (raw_event)
    page_url: asStringOrNull(raw_event.page_url),
    page_path: asStringOrNull(raw_event.page_path),
    page_referrer: asStringOrNull(raw_event.page_referrer),
    page_title: asStringOrNull(raw_event.page_title),

    // Containers (raw_event) — plain object only; arrays / non-plain become null
    properties: asPlainObjectOrNull(raw_event.properties),
    context: asPlainObjectOrNull(raw_event.context),

    // Debug — site-token writes never set debug=true (R-12 already rejects).
    debug: false,
  };
}
