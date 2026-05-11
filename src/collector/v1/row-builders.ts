/**
 * Sprint 1 PR#5c-1 — row-builder bodies (Track B).
 *
 * Pure functions. No env reads, no DB, no logging, no network. No validation
 * — PR#5b-1 / PR#5b-2 already ran by the time the orchestrator calls these.
 *
 * Three builders, one per output table:
 *   - buildIngestRequestRow   → ingest_requests row candidate (§2.7)
 *   - buildAcceptedEventRow   → accepted_events row candidate (§2.5)
 *   - buildRejectedEventRow   → rejected_events row candidate (§2.6)
 *
 * Critical locked rule (§2.5 line 168):
 *   accepted_events.payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope(...))
 *   accepted_events.canonical_jsonb = buildCanonicalJsonb(...)
 *   These are DIFFERENT shapes; the row-builder must NOT hash canonical_jsonb.
 *
 * Legacy NOT NULL compatibility shims (documented):
 *   - accepted_events.session_id ← validated.session_id ?? '__server__'
 *   - accepted_events.browser_id ← raw_event.anonymous_id ?? '__server__'
 *   - accepted_events.hostname ← raw_event.hostname ?? URL(page_url).host ?? '__unknown_host__'
 *   - ingest_requests.ip_hash workspace salt ← resolved?.workspace_id ?? '__unauth__'
 *
 * These sentinels exist only to satisfy the legacy NOT NULL columns on the
 * live schema. They are NOT evidence claims; they mark "the SDK did not
 * supply this value and the schema does not yet allow NULL here". A future
 * schema PR may relax the NOT NULL constraint and drop these shims.
 */

import { sha256Hex, ipHash } from './hash.js';
import { payloadSha256 } from './payload-hash.js';
import { stableStringify } from './stable-json.js';
import { buildCanonicalJsonb } from './canonical.js';
import { buildAcceptedNormalisedEnvelope } from './normalised-envelope.js';
import type {
  AcceptedEventRow,
  AuthStatus,
  IngestRequestRow,
  RejectedEventRow,
  RequestContext,
  ResolvedBoundary,
} from './types.js';
import type { EventValidationOk } from './validation.js';
import type { ReasonCode, RejectedStage } from './reason-codes.js';

/* --------------------------------------------------------------------------
 * Legacy compatibility sentinels (documented in module header).
 * ------------------------------------------------------------------------ */

export const LEGACY_SESSION_ID_SENTINEL = '__server__';
export const LEGACY_BROWSER_ID_SENTINEL = '__server__';
export const LEGACY_HOSTNAME_SENTINEL = '__unknown_host__';
export const UNAUTH_WORKSPACE_SENTINEL = '__unauth__';

/* --------------------------------------------------------------------------
 * Type-narrowing helpers.
 * ------------------------------------------------------------------------ */

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asFiniteNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asPlainObjectOrNull(v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return null;
  return v as Record<string, unknown>;
}

function asDateOrNull(v: unknown): Date | null {
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v : null;
  }
  if (typeof v === 'string' && v.length > 0) {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  return null;
}

/** Derive the legacy `hostname` NOT NULL column from raw_event.hostname or page_url. */
function deriveLegacyHostname(raw_event: Record<string, unknown>): string {
  const explicit = asStringOrNull(raw_event.hostname);
  if (explicit !== null) return explicit;
  const pageUrl = asStringOrNull(raw_event.page_url);
  if (pageUrl !== null) {
    try {
      return new URL(pageUrl).host;
    } catch {
      // Fall through to sentinel
    }
  }
  return LEGACY_HOSTNAME_SENTINEL;
}

/* --------------------------------------------------------------------------
 * ingest_requests row builder
 * ------------------------------------------------------------------------ */

export interface BuildIngestRequestRowArgs {
  ctx: RequestContext;
  /** null when auth itself failed (workspace_id / site_id stay null on the row). */
  resolved: ResolvedBoundary | null;
  /** Pepper sourced by the caller (env read happens at the route layer, not here). */
  ip_hash_pepper: string;
  expected_event_count: number;
  accepted_count: number;
  rejected_count: number;
  /** Set by the orchestrator (PR#5c-2). For request-level reject = ctx.received_at. */
  reconciled_at: Date | null;
  http_status: number;
  /** Supplied by the orchestrator — NOT inferred inside the builder. */
  auth_status: AuthStatus;
  reject_reason_code: ReasonCode | null;
  collector_version: string;
}

export type BuildIngestRequestRow = (args: BuildIngestRequestRowArgs) => IngestRequestRow;

/**
 * Build an `ingest_requests` row candidate. Pure — no DB, no env reads.
 *
 * Throws TypeError if `ctx.ip` is missing — the caller MUST resolve a client
 * IP before invoking this builder. Faking '0.0.0.0' would silently corrupt
 * the per-IP request-rate evidence; throwing surfaces the misconfiguration.
 *
 * When auth failed (`resolved === null`), the workspace salt for `ip_hash`
 * falls back to the `UNAUTH_WORKSPACE_SENTINEL` constant. This keeps the
 * §2.7 NOT NULL invariant on `ip_hash` while documenting that no resolved
 * workspace existed.
 */
export const buildIngestRequestRow: BuildIngestRequestRow = (args) => {
  const { ctx, resolved, ip_hash_pepper } = args;

  if (typeof ctx.ip !== 'string' || ctx.ip.length === 0) {
    throw new TypeError(
      'buildIngestRequestRow: ctx.ip is required for ip_hash; ' +
        'caller must resolve a client IP before invoking the builder',
    );
  }

  const workspaceSalt = resolved?.workspace_id ?? UNAUTH_WORKSPACE_SENTINEL;
  const ipHashValue = ipHash(ctx.ip, workspaceSalt, ip_hash_pepper);
  const requestBodySha256 = sha256Hex(ctx.raw_body_bytes);

  return {
    request_id: ctx.request_id,
    received_at: ctx.received_at,
    workspace_id: resolved?.workspace_id ?? null,
    site_id: resolved?.site_id ?? null,
    endpoint: ctx.endpoint,
    http_status: args.http_status,
    size_bytes: ctx.raw_body_bytes.byteLength,
    user_agent: ctx.user_agent,
    ip_hash: ipHashValue,
    request_body_sha256: requestBodySha256,
    expected_event_count: args.expected_event_count,
    accepted_count: args.accepted_count,
    rejected_count: args.rejected_count,
    reconciled_at: args.reconciled_at,
    auth_status: args.auth_status,
    reject_reason_code: args.reject_reason_code,
    collector_version: args.collector_version,
  };
};

/* --------------------------------------------------------------------------
 * accepted_events row builder
 * ------------------------------------------------------------------------ */

export interface BuildAcceptedEventRowArgs {
  ctx: RequestContext;
  resolved: ResolvedBoundary;
  validated: EventValidationOk;
  /** The original event JSON object as parsed from the wire. Stored verbatim into the legacy `raw` column. */
  raw_event: Record<string, unknown>;
  config: {
    validator_version: string;
    collector_version: string;
    event_contract_version: string;
    ip_hash_pepper: string;
  };
}

export type BuildAcceptedEventRow = (args: BuildAcceptedEventRowArgs) => AcceptedEventRow;

/**
 * Build an `accepted_events` row candidate. Pure — no DB, no env reads, no
 * validation (PR#5b-1 / PR#5b-2 already ran upstream).
 *
 * Critical contract:
 *   payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope(...))
 *   canonical_jsonb = buildCanonicalJsonb(...)
 *
 * These are DIFFERENT shapes; the builder must not hash canonical_jsonb.
 */
export const buildAcceptedEventRow: BuildAcceptedEventRow = (args) => {
  const { ctx, resolved, validated, raw_event, config } = args;

  if (typeof ctx.ip !== 'string' || ctx.ip.length === 0) {
    throw new TypeError(
      'buildAcceptedEventRow: ctx.ip is required for ip_hash; ' +
        'caller must resolve a client IP before invoking the builder',
    );
  }

  // Extract optional fields from raw_event for the canonical projection.
  const optionalForCanonical = {
    session_seq: asFiniteNumberOrNull(raw_event.session_seq),
    traffic_class: 'unknown' as const,
    consent_state: asStringOrNull(raw_event.consent_state),
    consent_source: asStringOrNull(raw_event.consent_source),
    tracking_mode: asStringOrNull(raw_event.tracking_mode),
    storage_mechanism: asStringOrNull(raw_event.storage_mechanism),
  };

  const normalisedEnvelope = buildAcceptedNormalisedEnvelope({
    validated,
    resolved,
    ctx,
    raw_event,
    config: {
      validator_version: config.validator_version,
      collector_version: config.collector_version,
    },
  });

  const canonicalJsonb = buildCanonicalJsonb({
    validated,
    resolved,
    ctx,
    optional: optionalForCanonical,
  });

  // payload_sha256 hashes the broader normalised envelope, NOT canonical_jsonb.
  const payloadSha256Value = payloadSha256(normalisedEnvelope);
  const ipHashValue = ipHash(ctx.ip, resolved.workspace_id, config.ip_hash_pepper);
  const sizeBytes = Buffer.byteLength(stableStringify(raw_event), 'utf8');

  // Legacy NOT NULL compatibility shims — documented as sentinels, not evidence.
  const legacySessionId = validated.session_id ?? LEGACY_SESSION_ID_SENTINEL;
  const legacyBrowserId = asStringOrNull(raw_event.anonymous_id) ?? LEGACY_BROWSER_ID_SENTINEL;
  const legacyHostname = deriveLegacyHostname(raw_event);

  // Optional date-typed columns from raw_event.
  const consentUpdatedAt = asDateOrNull(raw_event.consent_updated_at);
  const sessionStartedAt = asDateOrNull(raw_event.session_started_at);
  const sessionLastSeenAt = asDateOrNull(raw_event.session_last_seen_at);

  // Consent / tracking / storage evidence fields — pre-cutover policy is to
  // record `null` when the SDK did not supply them rather than invent a
  // default ('unknown' / 'inferred' / 'full' / 'none' / false). Inventing
  // defaults would turn "field absent" into an evidence claim. §2.5 target
  // has these as NOT NULL with admit-set values; PR#5c-1 era keeps them
  // nullable per the §3.PR#2 migration rule, and a future post-cutover PR
  // will tighten both the SDK contract and the DB columns to NOT NULL.
  const consentState = asStringOrNull(raw_event.consent_state);
  const consentSource = asStringOrNull(raw_event.consent_source);
  const trackingMode = asStringOrNull(raw_event.tracking_mode);
  const storageMechanism = asStringOrNull(raw_event.storage_mechanism);
  const preConsentMode =
    typeof raw_event.pre_consent_mode === 'boolean' ? raw_event.pre_consent_mode : null;

  return {
    // ---- Legacy NOT NULL columns ----
    site_id: resolved.site_id,
    hostname: legacyHostname,
    event_type: validated.event_type,
    session_id: legacySessionId,
    browser_id: legacyBrowserId,
    client_timestamp_ms: validated.occurred_at.getTime(),
    received_at: ctx.received_at,
    raw: raw_event,
    collector_version: config.collector_version,
    client_event_id: validated.client_event_id,
    page_view_id: asStringOrNull(raw_event.page_view_id),
    previous_page_view_id: asStringOrNull(raw_event.previous_page_view_id),
    event_sequence_index: asFiniteNumberOrNull(raw_event.event_sequence_index),
    event_contract_version: config.event_contract_version,

    // ---- PR#2 evidence columns ----
    request_id: ctx.request_id,
    workspace_id: resolved.workspace_id,
    validator_version: config.validator_version,
    schema_key: validated.schema_key,
    schema_version: validated.schema_version,
    event_origin: validated.event_origin,
    id_format: validated.id_format,
    traffic_class: 'unknown',
    payload_sha256: payloadSha256Value,
    size_bytes: sizeBytes,
    ip_hash: ipHashValue,
    consent_state: consentState,
    consent_source: consentSource,
    consent_updated_at: consentUpdatedAt,
    pre_consent_mode: preConsentMode,
    tracking_mode: trackingMode,
    storage_mechanism: storageMechanism,
    session_seq: asFiniteNumberOrNull(raw_event.session_seq),
    session_started_at: sessionStartedAt,
    session_last_seen_at: sessionLastSeenAt,
    canonical_jsonb: canonicalJsonb,
    payload_purged_at: null,
    debug_mode: false,
  };
};

/* --------------------------------------------------------------------------
 * rejected_events row builder
 * ------------------------------------------------------------------------ */

export interface BuildRejectedEventRowArgs {
  ctx: RequestContext;
  /** May be null when auth itself failed AT the per-event stage (rare; usually request-level). */
  resolved: ResolvedBoundary | null;
  /**
   * The original individual event fragment as parsed from the wire. May be a
   * plain object OR a primitive / null / array — parseEnvelope guarantees
   * plain-object shape only for /v1/event; /v1/batch may pass through any
   * JSON value at each array index. PR#5c-2 widens this to `unknown` so the
   * orchestrator can record non-object fragments verbatim into the legacy
   * `raw` column without silent wrapping. `raw_payload_sha256` still hashes
   * the actual fragment via `payloadSha256(raw_event)` — no wrapper, no
   * empty-hash fallback.
   */
  raw_event: unknown;
  reason_code: ReasonCode;
  rejected_stage: RejectedStage;
  reason_detail: string | null;
  schema_errors_jsonb: Record<string, unknown> | null;
  pii_hits_jsonb: Record<string, unknown> | null;
  /**
   * Best-effort fields the orchestrator could extract from raw_event before
   * validation failed. Any may be null when validation failed early.
   */
  best_effort: {
    client_event_id: string | null;
    id_format: string | null;
    event_name: string | null;
    event_type: string | null;
    schema_key: string | null;
    schema_version: string | null;
  };
  config: {
    collector_version: string;
  };
}

export type BuildRejectedEventRow = (args: BuildRejectedEventRowArgs) => RejectedEventRow;

/**
 * Build a `rejected_events` row candidate for a per-event rejection.
 *
 * Per §2.6 case table: this builder is ONLY called for parseable per-event
 * rejections (validation / PII / consent / dedupe failures). Whole-request
 * unparseable failures do NOT create a rejected_events row — the proof
 * lives on `ingest_requests.request_body_sha256` only. The orchestrator
 * (PR#5c-2) enforces this rule and never invokes this builder for
 * request-level failures.
 *
 * `raw_payload_sha256` hashes the individual rejected event envelope as
 * parsed from the wire (NOT the request body, NOT a fallback empty hash).
 * If `payloadSha256(raw_event)` throws (e.g. raw_event contains an
 * unsupported value), the error propagates to the orchestrator — there is
 * no silent empty-hash fallback.
 */
export const buildRejectedEventRow: BuildRejectedEventRow = (args) => {
  const { ctx, resolved, raw_event, reason_code, rejected_stage, config } = args;

  const rawPayloadSha256 = payloadSha256(raw_event);
  const sizeBytes = Buffer.byteLength(stableStringify(raw_event), 'utf8');

  return {
    // ---- Legacy columns ----
    site_id: resolved?.site_id ?? null,
    raw: raw_event,
    // Dual-write per PR#3 transition: reason_codes[0] mirrors reason_code.
    reason_codes: [reason_code],
    received_at: ctx.received_at,
    collector_version: config.collector_version,

    // ---- PR#3 evidence columns ----
    request_id: ctx.request_id,
    workspace_id: resolved?.workspace_id ?? null,
    client_event_id: args.best_effort.client_event_id,
    id_format: args.best_effort.id_format,
    event_name: args.best_effort.event_name,
    event_type: args.best_effort.event_type,
    schema_key: args.best_effort.schema_key,
    schema_version: args.best_effort.schema_version,
    rejected_stage,
    reason_code,
    reason_detail: args.reason_detail,
    schema_errors_jsonb: args.schema_errors_jsonb,
    pii_hits_jsonb: args.pii_hits_jsonb,
    raw_payload_sha256: rawPayloadSha256,
    size_bytes: sizeBytes,
    debug_mode: false,
    sample_visible_to_admin: true,
    rejected_at: ctx.received_at,
  };
};
