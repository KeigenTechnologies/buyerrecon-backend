/**
 * Sprint 1 PR#5b-3 — canonical_jsonb data-minimised projection (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network.
 *
 * Per handoff §2.5, `accepted_events.canonical_jsonb` is the DURABLE
 * data-minimised projection of an accepted event — the long-lived defensible
 * evidence of what was accepted. It is NOT covered by the 90-day raw-payload
 * purge in Sprint 1.
 *
 * Per Decision D3 (PR#5 plan), the projection is exactly 19 fields. This
 * module always emits all 19 keys; unavailable optional fields are emitted
 * as `null`. `traffic_class` defaults to `'unknown'` per Decision #13
 * (Sprint 1 traffic_class never takes any other value on this projection).
 *
 * IMPORTANT — `canonical_jsonb` is NOT the same shape as the input fed to
 * `accepted_events.payload_sha256`. Per §2.5 line 168, `payload_sha256` is
 * computed over the *normalised event envelope* (broader than this
 * projection — server-stamped fields included, before the data-minimisation
 * pass). PR#5c orchestrator decides which shape to feed each helper.
 *
 * Exclusion list — these fields MUST NEVER appear on the output, even if
 * the inbound event payload supplies them:
 *
 *   raw `properties`, raw `context`, page_url / page_path / page_referrer /
 *   page_title, user_id, company_id, anonymous_id, browser_id, email, phone,
 *   name, address, ip, user_agent, ip_hash, debug, debug_mode, raw,
 *   payload_jsonb, payload_sha256, accepted_at, validator_version, sent_at,
 *   any scoring / bot / AI-agent fields.
 *
 * The projection deliberately does NOT call PII / consent / boundary /
 * dedupe validation. Those run upstream in the orchestrator (PR#5c) before
 * this projection is built. PR#5b-3 is a pure projection layer.
 */

import type { EventValidationOk } from './validation.js';

/** Structured input shape — orchestrator (PR#5c) supplies one source per field. */
export interface CanonicalJsonbInput {
  /** PR#5b-1 validateEventCore output (8 normalised fields). */
  validated: EventValidationOk;
  /** PR#4-resolved auth boundary. */
  resolved: {
    workspace_id: string;
    site_id: string;
  };
  /** Server-stamped request context (request_id minted by route middleware in PR#7). */
  ctx: {
    request_id: string;
    received_at: Date;
  };
  /**
   * Optional fields supplied by the inbound event but not in EventValidationOk.
   * When unavailable, the corresponding output key is `null` — never absent.
   * `traffic_class` defaults to `'unknown'` (Sprint 1 / Decision #13).
   */
  optional?: {
    session_seq?: number | null;
    traffic_class?: 'unknown' | null;
    consent_state?: string | null;
    consent_source?: string | null;
    tracking_mode?: string | null;
    storage_mechanism?: string | null;
  };
}

/**
 * Build the 19-key canonical_jsonb projection from the structured sources.
 * Output shape is fixed: every key is present every time. Unavailable
 * optional values are `null`. Input is read-only (not mutated).
 */
export function buildCanonicalJsonb(input: CanonicalJsonbInput): Record<string, unknown> {
  const { validated, resolved, ctx, optional } = input;
  const opt = optional ?? {};

  return {
    request_id: ctx.request_id,
    workspace_id: resolved.workspace_id,
    site_id: resolved.site_id,
    client_event_id: validated.client_event_id,
    event_name: validated.event_name,
    event_type: validated.event_type,
    event_origin: validated.event_origin,
    occurred_at: validated.occurred_at.toISOString(),
    received_at: ctx.received_at.toISOString(),
    schema_key: validated.schema_key,
    schema_version: validated.schema_version,
    id_format: validated.id_format,
    traffic_class: opt.traffic_class ?? 'unknown',
    session_id: validated.session_id ?? null,
    session_seq: opt.session_seq ?? null,
    consent_state: opt.consent_state ?? null,
    consent_source: opt.consent_source ?? null,
    tracking_mode: opt.tracking_mode ?? null,
    storage_mechanism: opt.storage_mechanism ?? null,
  };
}
