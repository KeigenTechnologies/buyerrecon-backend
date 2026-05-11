/**
 * Sprint 1 PR#5c-2 — v1 collector orchestrator (Track B).
 *
 * Pure / near-pure composition of PR#4 auth (injected) + PR#5b-1 envelope &
 * core validation + PR#5b-2 PII / consent / boundary / dedupe + PR#5b-3
 * canonical projection & payload hash + PR#5c-1 row-builders.
 *
 * Route-free, DB-free, env-free. Returns `OrchestratorOutput` row candidates
 * ready for PR#7 to bind to HTTP routes and execute via `pool.query`.
 *
 * Critical locked contracts preserved by this orchestrator:
 *   - accepted_events.payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope(...))
 *     — NOT a hash of canonical_jsonb (the two shapes are deliberately distinct per §2.5 line 168).
 *   - accepted_events.canonical_jsonb = buildCanonicalJsonb(...)
 *   - rejected_events.raw_payload_sha256 = payloadSha256(raw_event_fragment)
 *     — the fragment is whatever parseEnvelope produced at that index,
 *     including non-object primitives in /v1/batch (Option A from PR#5c-2 plan).
 *   - ingest_requests.request_body_sha256 = sha256Hex(raw_body_bytes)
 *   - No empty-hash fallback. No fake-IP fallback.
 *   - PR#5b-2 consent_state_summary deny-by-default rule unchanged.
 *
 * Auth contract:
 *   PR#5c-2 takes a pre-resolved `auth` object. It does NOT call
 *   resolveSiteWriteToken, hashSiteWriteToken, or any DB lookup. PR#7 will
 *   resolve auth BEFORE invoking the orchestrator and pass the result via
 *   `RunRequestInput.auth`.
 */

import {
  buildAcceptedEventRow,
  buildIngestRequestRow,
  buildRejectedEventRow,
  UNAUTH_WORKSPACE_SENTINEL,
} from './row-builders.js';
import { buildCanonicalJsonb } from './canonical.js';
import { validateConsent } from './consent.js';
import { makeDedupeKey } from './dedupe.js';
import { parseEnvelope, type V1Endpoint, type EnvelopeReasonCode } from './envelope.js';
import { firstPiiReasonCode, scanForPii } from './pii.js';
import { stageForReasonCode } from './stage-map.js';
import {
  detectClientEventIdFormat,
  validateEventCore,
  type EventValidationOk,
} from './validation.js';
import { validatePayloadBoundary } from './boundary.js';
import type {
  AcceptedEventRow,
  AuthStatus,
  EventResponseEntry,
  IngestRequestRow,
  OrchestratorOutput,
  RejectedEventRow,
  RequestContext,
  RequestResponse,
  ResolvedBoundary,
} from './types.js';
import type { ReasonCode, RejectedStage } from './reason-codes.js';

/* --------------------------------------------------------------------------
 * Public input contracts
 * ------------------------------------------------------------------------ */

export interface CollectorConfig {
  collector_version: string;
  validator_version: string;
  event_contract_version: string;
  /** Server pepper for ipHash. Injected by PR#7; orchestrator never reads env. */
  ip_hash_pepper: string;
  /** Per-site consent_state_summary opt-in. Defaults to false in PR#7's wiring. */
  allow_consent_state_summary: boolean;
  /** Optional deterministic-clock override for tests. Defaults to Date.now() at entry. */
  now_ms?: number;
}

export interface RunRequestInput {
  ctx: RequestContext;
  auth: {
    status: AuthStatus;
    /** Non-null when auth.status === 'ok'; null otherwise. */
    resolved: ResolvedBoundary | null;
    /** §2.8 code populated when auth.status !== 'ok'; null when 'ok'. */
    reason_code: ReasonCode | null;
  };
  config: CollectorConfig;
}

/* --------------------------------------------------------------------------
 * Internal helpers
 * ------------------------------------------------------------------------ */

interface BestEffortFields {
  client_event_id: string | null;
  id_format: string | null;
  event_name: string | null;
  event_type: string | null;
  schema_key: string | null;
  schema_version: string | null;
}

/**
 * Defensive best-effort field extraction from a raw event fragment. NEVER
 * throws. Returns all-null for non-object / primitive / null / array
 * fragments.
 */
function extractBestEffortFields(raw: unknown): BestEffortFields {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      client_event_id: null,
      id_format: null,
      event_name: null,
      event_type: null,
      schema_key: null,
      schema_version: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const client_event_id = typeof obj.client_event_id === 'string' ? obj.client_event_id : null;
  const id_format = client_event_id !== null ? detectClientEventIdFormat(client_event_id) : null;
  return {
    client_event_id,
    id_format,
    event_name: typeof obj.event_name === 'string' ? obj.event_name : null,
    event_type: typeof obj.event_type === 'string' ? obj.event_type : null,
    schema_key: typeof obj.schema_key === 'string' ? obj.schema_key : null,
    schema_version: typeof obj.schema_version === 'string' ? obj.schema_version : null,
  };
}

/**
 * Extract the 6 optional fields for canonical_jsonb projection from a raw
 * event. Always uses traffic_class='unknown' (Decision #13).
 */
function extractOptionalForCanonical(raw: Record<string, unknown>) {
  return {
    session_seq: typeof raw.session_seq === 'number' && Number.isFinite(raw.session_seq)
      ? raw.session_seq
      : null,
    traffic_class: 'unknown' as const,
    consent_state: typeof raw.consent_state === 'string' ? raw.consent_state : null,
    consent_source: typeof raw.consent_source === 'string' ? raw.consent_source : null,
    tracking_mode: typeof raw.tracking_mode === 'string' ? raw.tracking_mode : null,
    storage_mechanism: typeof raw.storage_mechanism === 'string' ? raw.storage_mechanism : null,
  };
}

/** HTTP status map for request-level auth rejections. */
const AUTH_HTTP_STATUS: Record<Exclude<AuthStatus, 'ok'>, number> = {
  invalid_token: 401,
  site_disabled: 403,
  boundary_mismatch: 403,
};

/** HTTP status map for envelope-level rejections. */
const ENVELOPE_HTTP_STATUS: Record<EnvelopeReasonCode, number> = {
  content_type_invalid: 415,
  request_body_invalid_json: 400,
  request_too_large: 413,
  batch_too_large: 413,
  batch_item_count_exceeded: 413,
};

/* --------------------------------------------------------------------------
 * Request-level rejection helpers
 * ------------------------------------------------------------------------ */

function buildAuthRejectOutput(input: RunRequestInput): OrchestratorOutput {
  const { ctx, auth, config } = input;
  // auth.status !== 'ok' here. AUTH_HTTP_STATUS keys are exactly those values.
  const httpStatus = AUTH_HTTP_STATUS[auth.status as Exclude<AuthStatus, 'ok'>];

  const ingestRequest: IngestRequestRow = buildIngestRequestRow({
    ctx,
    resolved: auth.resolved,
    ip_hash_pepper: config.ip_hash_pepper,
    expected_event_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    reconciled_at: ctx.received_at,
    http_status: httpStatus,
    auth_status: auth.status,
    reject_reason_code: auth.reason_code,
    collector_version: config.collector_version,
  });

  const response: RequestResponse = {
    request_id: ctx.request_id,
    expected_event_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    results: [],
  };

  return {
    ingest_request: ingestRequest,
    accepted: [],
    rejected: [],
    response,
    http_status: httpStatus,
  };
}

function buildEnvelopeRejectOutput(
  input: RunRequestInput,
  reason: EnvelopeReasonCode,
): OrchestratorOutput {
  const { ctx, auth, config } = input;
  const httpStatus = ENVELOPE_HTTP_STATUS[reason];

  const ingestRequest: IngestRequestRow = buildIngestRequestRow({
    ctx,
    resolved: auth.resolved,
    ip_hash_pepper: config.ip_hash_pepper,
    expected_event_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    reconciled_at: ctx.received_at,
    http_status: httpStatus,
    auth_status: 'ok',
    reject_reason_code: reason,
    collector_version: config.collector_version,
  });

  const response: RequestResponse = {
    request_id: ctx.request_id,
    expected_event_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    results: [],
  };

  return {
    ingest_request: ingestRequest,
    accepted: [],
    rejected: [],
    response,
    http_status: httpStatus,
  };
}

/* --------------------------------------------------------------------------
 * Per-event rejection helper
 * ------------------------------------------------------------------------ */

interface PerEventRejectArgs {
  ctx: RequestContext;
  resolved: ResolvedBoundary;
  raw: unknown;
  reason_code: ReasonCode;
  rejected_stage: RejectedStage;
  reason_detail: string | null;
  pii_hits_jsonb: Record<string, unknown> | null;
  best_effort: BestEffortFields;
  collector_version: string;
}

function makePerEventReject(args: PerEventRejectArgs): {
  row: RejectedEventRow;
  result: EventResponseEntry;
} {
  const row = buildRejectedEventRow({
    ctx: args.ctx,
    resolved: args.resolved,
    raw_event: args.raw,
    reason_code: args.reason_code,
    rejected_stage: args.rejected_stage,
    reason_detail: args.reason_detail,
    schema_errors_jsonb: null,
    pii_hits_jsonb: args.pii_hits_jsonb,
    best_effort: args.best_effort,
    config: { collector_version: args.collector_version },
  });
  const result: EventResponseEntry = {
    status: 'rejected',
    client_event_id: args.best_effort.client_event_id,
    reason_code: args.reason_code,
  };
  return { row, result };
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

/**
 * Run the v1 collector pipeline. Pure composition of existing helpers; no
 * DB / no routes / no env reads / no token lookup.
 *
 * Precondition: `ctx.ip` must be a non-empty string. The orchestrator
 * propagates `TypeError` from `buildIngestRequestRow` if this precondition
 * is violated (no fake-IP fallback). PR#7's route layer is responsible for
 * resolving the client IP before invocation.
 */
export function runRequest(input: RunRequestInput): OrchestratorOutput {
  const { ctx, auth, config } = input;
  const nowMs = config.now_ms ?? Date.now();

  // 1. Auth status gate — request-level reject.
  if (auth.status !== 'ok') {
    return buildAuthRejectOutput(input);
  }

  // After Phase 1, auth.status === 'ok'; resolved must be non-null per the
  // contract. Surface a TypeError if the contract was violated by the caller
  // (PR#7 is responsible for upholding it).
  if (auth.resolved === null) {
    throw new TypeError(
      'runRequest: auth.status === "ok" but auth.resolved is null; this violates the input contract',
    );
  }
  const resolved: ResolvedBoundary = auth.resolved;

  // 2. Envelope parse — request-level reject on failure.
  const envelopeResult = parseEnvelope({
    endpoint: ctx.endpoint as V1Endpoint,
    content_type: ctx.content_type,
    raw_body_bytes: ctx.raw_body_bytes,
  });
  if (!envelopeResult.ok) {
    return buildEnvelopeRejectOutput(input, envelopeResult.reason_code);
  }
  const events = envelopeResult.events;

  // 3. Per-event loop.
  const accepted: AcceptedEventRow[] = [];
  const rejected: RejectedEventRow[] = [];
  const results: EventResponseEntry[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    const bestEffort = extractBestEffortFields(raw);

    // 3a. Validation gate. Non-object fragments are caught here via
    //     validateEventCore's first guard (returns 'missing_required_field').
    const validationResult = validateEventCore({
      event: raw,
      source_token_kind: 'site_write',
      now_ms: nowMs,
    });
    if (!validationResult.ok) {
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw,
        reason_code: validationResult.reason_code,
        rejected_stage: stageForReasonCode(validationResult.reason_code),
        reason_detail: null,
        pii_hits_jsonb: null,
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
      continue;
    }
    const validated: EventValidationOk = validationResult;

    // After validation succeeds, raw is guaranteed to be a plain object
    // (validateEventCore rejects non-objects at its first guard). Use a
    // typed local for downstream consumers that require Record shape.
    const rawObj = raw as Record<string, unknown>;

    // 3b. PII gate.
    const piiReason = firstPiiReasonCode(rawObj);
    if (piiReason !== null) {
      const hits = scanForPii(rawObj);
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw: rawObj,
        reason_code: piiReason,
        rejected_stage: 'pii',
        reason_detail: null,
        pii_hits_jsonb: { hits },
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
      continue;
    }

    // 3c. Boundary gate (per-event).
    const boundaryResult = validatePayloadBoundary(resolved, rawObj);
    if (!boundaryResult.ok) {
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw: rawObj,
        reason_code: boundaryResult.reason_code,
        rejected_stage: 'boundary',
        reason_detail: null,
        pii_hits_jsonb: null,
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
      continue;
    }

    // 3d. Canonical projection (computed once; used by consent + accepted-row paths).
    const optional = extractOptionalForCanonical(rawObj);
    const canonical = buildCanonicalJsonb({ validated, resolved, ctx, optional });

    // 3e. Consent gate (with canonical for forbidden-field check).
    const consentResult = validateConsent({
      event: rawObj,
      canonical,
      config: { allowConsentStateSummary: config.allow_consent_state_summary },
    });
    if (!consentResult.ok) {
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw: rawObj,
        reason_code: consentResult.reason_code,
        rejected_stage: stageForReasonCode(consentResult.reason_code),
        reason_detail: null,
        pii_hits_jsonb: null,
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
      continue;
    }

    // 3f. Intra-batch dedupe gate (runs AFTER validation / PII / boundary /
    //     consent; invalid or consent-rejected events do not consume slots).
    const dedupeKey = makeDedupeKey(
      resolved.workspace_id,
      resolved.site_id,
      validated.client_event_id,
    );
    if (seen.has(dedupeKey)) {
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw: rawObj,
        reason_code: 'duplicate_client_event_id',
        rejected_stage: 'dedupe',
        reason_detail: null,
        pii_hits_jsonb: null,
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
      continue;
    }
    seen.add(dedupeKey);

    // 3g. Accepted row build. Wrap in try/catch so a per-event helper failure
    //     (e.g. a stableStringify throw on an unsupported value buried in
    //     properties) becomes an event-level internal_validation_error rather
    //     than tanking the whole batch.
    try {
      const acceptedRow = buildAcceptedEventRow({
        ctx,
        resolved,
        validated,
        raw_event: rawObj,
        config: {
          validator_version: config.validator_version,
          collector_version: config.collector_version,
          event_contract_version: config.event_contract_version,
          ip_hash_pepper: config.ip_hash_pepper,
        },
      });
      accepted.push(acceptedRow);
      results.push({
        status: 'accepted',
        client_event_id: validated.client_event_id,
        reason_code: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const { row, result } = makePerEventReject({
        ctx,
        resolved,
        raw: rawObj,
        reason_code: 'internal_validation_error',
        rejected_stage: 'storage',
        reason_detail: message,
        pii_hits_jsonb: null,
        best_effort: bestEffort,
        collector_version: config.collector_version,
      });
      rejected.push(row);
      results.push(result);
    }
  }

  // 4. Finalise.
  const acceptedCount = accepted.length;
  const rejectedCount = rejected.length;
  const expectedEventCount = events.length;
  const reconciledAt = new Date(nowMs);

  const ingestRequest = buildIngestRequestRow({
    ctx,
    resolved,
    ip_hash_pepper: config.ip_hash_pepper,
    expected_event_count: expectedEventCount,
    accepted_count: acceptedCount,
    rejected_count: rejectedCount,
    reconciled_at: reconciledAt,
    http_status: 200,
    auth_status: 'ok',
    reject_reason_code: null,
    collector_version: config.collector_version,
  });

  const response: RequestResponse = {
    request_id: ctx.request_id,
    expected_event_count: expectedEventCount,
    accepted_count: acceptedCount,
    rejected_count: rejectedCount,
    results,
  };

  return {
    ingest_request: ingestRequest,
    accepted,
    rejected,
    response,
    http_status: 200,
  };
}

// Silence the unused import marker for UNAUTH_WORKSPACE_SENTINEL — it is
// re-asserted in tests that verify the auth-reject path emits a non-null
// ip_hash via the row-builder's internal use of the sentinel. Re-export
// would change the index.ts barrel; keep silent reference instead.
void UNAUTH_WORKSPACE_SENTINEL;
