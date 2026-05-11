/**
 * Sprint 1 PR#5a — v1 collector type contracts (Track B).
 *
 * Type-only module. Zero runtime code. Defines the row shapes the future
 * orchestrator (PR#5c) will produce and the route layer (PR#7) will INSERT.
 *
 * Row shapes match the CURRENT live schema after PR#1–PR#4 — including legacy
 * NOT NULL columns (raw, hostname, browser_id, event_contract_version,
 * client_timestamp_ms, etc.) that PR#5 will keep populating until the
 * eventual rename / drop-NOT-NULL reconciliation lands post-Sprint-1.
 *
 * No business logic, no validation rules, no I/O. Everything PR#5b/5c will
 * import from here is a pure type.
 */

import type { ReasonCode, RejectedStage } from './reason-codes.js';

/* --------------------------------------------------------------------------
 * Inputs the orchestrator (PR#5c) accepts from the route layer (PR#7).
 * ------------------------------------------------------------------------ */

/** What the orchestrator gets handed by route middleware. */
export interface RequestContext {
  /** UUID minted by route middleware (PR#7); collector-generated, no DB default. */
  request_id: string;
  /** Server-side ingest timestamp. */
  received_at: Date;
  /** '/v1/event' | '/v1/batch' once routes ship in PR#7. */
  endpoint: string;
  /** HTTP method (typically 'POST'). */
  method: string;
  /** Raw Content-Type header value (or null if absent). */
  content_type: string | null;
  /** Raw User-Agent header value. */
  user_agent: string | null;
  /** Raw client IP — never persisted; only ipHash() of it is. */
  ip: string | null;
  /** Raw Authorization header value (or null if absent). */
  auth_header: string | null;
  /** Exact bytes of the HTTP request body — fed to sha256Hex for request_body_sha256. */
  raw_body_bytes: Buffer;
}

/** Output of PR#4 auth resolution — mirrored here so PR#5b/5c don't depend on PR#4 internals. */
export interface ResolvedBoundary {
  token_id: string;
  workspace_id: string;
  site_id: string;
}

/** Auth-status enum on ingest_requests (per §2.7). Distinct from §2.8 reject reason codes. */
export type AuthStatus =
  | 'ok'
  | 'invalid_token'
  | 'site_disabled'
  | 'boundary_mismatch';

/* --------------------------------------------------------------------------
 * Row shapes (one TypeScript interface per live table, post-PR#1–PR#4).
 * ------------------------------------------------------------------------ */

/** Row shape for ingest_requests — every column from §2.7 / PR#1. */
export interface IngestRequestRow {
  request_id: string;
  received_at: Date;
  workspace_id: string | null;
  site_id: string | null;
  endpoint: string;
  http_status: number | null;
  size_bytes: number;
  user_agent: string | null;
  ip_hash: string;
  request_body_sha256: string;
  expected_event_count: number;
  accepted_count: number;
  rejected_count: number;
  reconciled_at: Date | null;
  auth_status: AuthStatus;
  reject_reason_code: ReasonCode | null;
  collector_version: string;
}

/**
 * Row shape for accepted_events.
 *
 * Includes BOTH the legacy NOT NULL columns (still required by the live schema)
 * AND the PR#2 evidence columns (added in §3.PR#2; nullable on the DB side until
 * post-cutover). New v1 builders (PR#5c) populate every field; legacy `/collect`
 * route only populates the legacy subset.
 */
export interface AcceptedEventRow {
  // ---- Legacy columns (still NOT NULL on the live table) ----
  site_id: string;
  hostname: string;
  event_type: string;
  session_id: string;
  browser_id: string;
  client_timestamp_ms: number;
  received_at: Date;
  raw: unknown;
  collector_version: string;
  client_event_id: string | null;
  page_view_id: string | null;
  previous_page_view_id: string | null;
  event_sequence_index: number | null;
  event_contract_version: string;

  // ---- PR#2 evidence columns (nullable in DB; PR#5c populates on every v1 row) ----
  request_id: string;
  workspace_id: string;
  validator_version: string;
  schema_key: string;
  schema_version: string;
  /** Sprint 1 admit set: 'browser' | 'server' | 'system' (per §2.9 R-10). */
  event_origin: string;
  /** Sprint 1 admit set: 'uuidv7' | 'uuidv4' (per §2.9 R-9). */
  id_format: string;
  /** Sprint 1 placeholder — always 'unknown' (Decision #13). */
  traffic_class: 'unknown';
  payload_sha256: string;
  size_bytes: number;
  ip_hash: string;
  /**
   * Per §2.5 target the consent fields are NOT NULL with values from the
   * §2.11 admit sets. Pre-cutover (PR#5c-1 era) the DB columns are nullable
   * and we deliberately record `null` when the SDK did not supply the field
   * rather than inventing a default ('unknown' / 'inferred' / 'full' /
   * 'none' / false). Inventing defaults would turn "missing" into an
   * evidence claim. Post-cutover, a future PR will tighten the SDK contract
   * + DB to NOT NULL and remove the `null` allowance here.
   */
  consent_state: string | null;
  consent_source: string | null;
  consent_updated_at: Date | null;
  pre_consent_mode: boolean | null;
  tracking_mode: string | null;
  /** Sprint 1 admit set: 'cookie' | 'session_storage' | 'memory' | 'none'. Null pre-cutover when SDK did not supply. */
  storage_mechanism: string | null;
  session_seq: number | null;
  session_started_at: Date | null;
  session_last_seen_at: Date | null;
  /** Data-minimised projection per Decision D3. Built by PR#5b canonical.ts. */
  canonical_jsonb: Record<string, unknown>;
  payload_purged_at: Date | null;
  /** Always false from site-token writes (§2.9 R-12); only TRUE on admin-side debug retrieval (§3.PR#9). */
  debug_mode: boolean;
}

/**
 * Row shape for rejected_events.
 *
 * Dual-write transition (per PR#3): both the new singular `reason_code` and
 * the legacy `reason_codes` array are populated; readers should use
 * `COALESCE(reason_code, reason_codes[1])`.
 */
export interface RejectedEventRow {
  // ---- Legacy columns ----
  site_id: string | null;
  raw: unknown;
  /** Dual-write — element [0] mirrors `reason_code` below for back-compat. */
  reason_codes: string[];
  received_at: Date;
  collector_version: string;

  // ---- PR#3 evidence columns ----
  request_id: string;
  workspace_id: string | null;
  client_event_id: string | null;
  id_format: string | null;
  event_name: string | null;
  event_type: string | null;
  schema_key: string | null;
  schema_version: string | null;
  rejected_stage: RejectedStage;
  reason_code: ReasonCode;
  reason_detail: string | null;
  schema_errors_jsonb: Record<string, unknown> | null;
  pii_hits_jsonb: Record<string, unknown> | null;
  raw_payload_sha256: string;
  size_bytes: number;
  debug_mode: boolean;
  sample_visible_to_admin: boolean;
  rejected_at: Date | null;
}

/* --------------------------------------------------------------------------
 * Response body shape (per §2.2 collector API surface).
 * ------------------------------------------------------------------------ */

/** Per-event entry in the response body. */
export interface EventResponseEntry {
  status: 'accepted' | 'rejected';
  client_event_id: string | null;
  reason_code: ReasonCode | null;
}

/** Full HTTP response body shape for /v1/event and /v1/batch. */
export interface RequestResponse {
  request_id: string;
  expected_event_count: number;
  accepted_count: number;
  rejected_count: number;
  results: EventResponseEntry[];
}

/* --------------------------------------------------------------------------
 * Orchestrator output (PR#5c). Declared in PR#5a so row-builders can share
 * the same return contract.
 * ------------------------------------------------------------------------ */

export interface OrchestratorOutput {
  ingest_request: IngestRequestRow;
  accepted: AcceptedEventRow[];
  rejected: RejectedEventRow[];
  response: RequestResponse;
  http_status: number;
}
