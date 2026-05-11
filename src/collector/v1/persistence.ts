/**
 * Sprint 1 PR#7 — DB transaction writer for OrchestratorOutput (Track B).
 *
 * Single transaction per request:
 *   1. BEGIN
 *   2. INSERT INTO ingest_requests (initial counts = 0, http_status placeholder)
 *   3. Per-row INSERT INTO accepted_events with
 *        ON CONFLICT (workspace_id, site_id, client_event_id)
 *          WHERE workspace_id IS NOT NULL
 *            AND site_id IS NOT NULL
 *            AND client_event_id IS NOT NULL
 *        DO NOTHING RETURNING event_id
 *      On rowCount===0 (PR#6 partial unique index hit), reclassify the
 *      accepted candidate as a duplicate_client_event_id rejected row.
 *   4. Also catch SQLSTATE 23505 from the legacy idx_accepted_dedup_client_event
 *      (different triple — (site_id, session_id, client_event_id)) and
 *      reclassify the same way. Unknown 23505 constraints → ROLLBACK + rethrow.
 *   5. INSERT INTO rejected_events for [...orchestrator.rejected, ...reclassified].
 *   6. UPDATE ingest_requests SET accepted_count, rejected_count, reconciled_at.
 *   7. COMMIT.
 *
 * ROLLBACK on any non-conflict error. Best-effort touchTokenLastUsedAt runs
 * outside this transaction so a transient hiccup on token metadata never
 * fails event capture.
 *
 * Critical contracts preserved:
 *   - accepted_events.raw and accepted_events.canonical_jsonb pass to pg as
 *     JS objects (always plain Record per row-builders) — pg auto-encodes to
 *     JSONB.
 *   - rejected_events.raw passes through toJsonbText(...) (JSON.stringify +
 *     `$2::jsonb` cast in the SQL). Required because PR#5c-2 Option A allows
 *     primitive / null / array / string fragments under /v1/batch; pg's default
 *     prepareValue would fail for null (NOT NULL violation), arrays (PG array
 *     literal, not JSON), and bare strings (invalid JSON syntax). JSON.stringify
 *     produces a valid JSON text for every JS value, which the JSONB cast
 *     accepts.
 *   - rejected_events.schema_errors_jsonb and pii_hits_jsonb stay as JS
 *     objects-or-null — they're always shaped as Record<string, unknown> | null
 *     by the row-builders.
 *   - Date values pass to pg as Date instances — never ISO strings.
 *   - reason_codes passes as JS string[].
 *   - raw_payload_sha256 for reclassified duplicates = payloadSha256(accepted.raw)
 *     — recomputed here (NOT reusing accepted.payload_sha256, which hashes the
 *     normalised envelope, a distinct shape per the §2.5 line 168 contract).
 *
 * Cross-request retries from SDKs never produce a raw 500: ON CONFLICT
 * DO NOTHING is non-throwing, and 23505 from the legacy index is caught and
 * reclassified inside the same transaction.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import type { Pool, PoolClient } from 'pg';
import { payloadSha256 } from './payload-hash.js';
import { stableStringify } from './stable-json.js';
import type {
  AcceptedEventRow,
  EventResponseEntry,
  IngestRequestRow,
  OrchestratorOutput,
  RejectedEventRow,
  RequestResponse,
} from './types.js';

/* --------------------------------------------------------------------------
 * Public output shape
 * ------------------------------------------------------------------------ */

export interface PersistenceResult {
  /** Response body to return to the HTTP client — reflects post-rebucketing counts/results. */
  final_response: RequestResponse;
  /** HTTP status to return — equal to output.http_status (rebucketing never escalates to 5xx). */
  final_http_status: number;
  accepted_written: number;
  rejected_written: number;
  /** Count of accepted candidates that hit the dedup index and were reclassified. */
  dedupe_reclassified: number;
}

/* --------------------------------------------------------------------------
 * SQL constants
 * ------------------------------------------------------------------------ */

const INGEST_INSERT_SQL = `
INSERT INTO ingest_requests (
  request_id, received_at, workspace_id, site_id, endpoint, http_status,
  size_bytes, user_agent, ip_hash, request_body_sha256, expected_event_count,
  accepted_count, rejected_count, reconciled_at, auth_status,
  reject_reason_code, collector_version
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
`.trim();

const ACCEPTED_INSERT_SQL = `
INSERT INTO accepted_events (
  site_id, hostname, event_type, session_id, browser_id, client_timestamp_ms,
  received_at, raw, collector_version, client_event_id, page_view_id,
  previous_page_view_id, event_sequence_index, event_contract_version,
  request_id, workspace_id, validator_version, schema_key, schema_version,
  event_origin, id_format, traffic_class, payload_sha256, size_bytes, ip_hash,
  consent_state, consent_source, consent_updated_at, pre_consent_mode,
  tracking_mode, storage_mechanism, session_seq, session_started_at,
  session_last_seen_at, canonical_jsonb, payload_purged_at, debug_mode
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37)
ON CONFLICT (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL
  DO NOTHING
RETURNING event_id
`.trim();

const REJECTED_INSERT_SQL = `
INSERT INTO rejected_events (
  site_id, raw, reason_codes, received_at, collector_version,
  request_id, workspace_id, client_event_id, id_format, event_name, event_type,
  schema_key, schema_version, rejected_stage, reason_code, reason_detail,
  schema_errors_jsonb, pii_hits_jsonb, raw_payload_sha256, size_bytes,
  debug_mode, sample_visible_to_admin, rejected_at
)
VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23)
`.trim();

const INGEST_UPDATE_SQL = `
UPDATE ingest_requests
SET accepted_count = $1,
    rejected_count = $2,
    reconciled_at = $3,
    http_status = $4
WHERE request_id = $5
`.trim();

const TOKEN_TOUCH_SQL = `
UPDATE site_write_tokens
SET last_used_at = NOW()
WHERE token_id = $1
`.trim();

/* --------------------------------------------------------------------------
 * Constraint names — must match migrations/004 (legacy) and migrations/007 (PR#6)
 * ------------------------------------------------------------------------ */

/** PR#6 partial unique index on (workspace_id, site_id, client_event_id). */
const DEDUP_INDEX_NEW = 'accepted_events_dedup';
/** Legacy partial unique index on (site_id, session_id, client_event_id). */
const DEDUP_INDEX_LEGACY = 'idx_accepted_dedup_client_event';

/* --------------------------------------------------------------------------
 * Parameter builders — translate row objects to positional value arrays
 * ------------------------------------------------------------------------ */

function ingestRowToParams(row: IngestRequestRow): unknown[] {
  return [
    row.request_id,
    row.received_at,
    row.workspace_id,
    row.site_id,
    row.endpoint,
    row.http_status,
    row.size_bytes,
    row.user_agent,
    row.ip_hash,
    row.request_body_sha256,
    row.expected_event_count,
    row.accepted_count,
    row.rejected_count,
    row.reconciled_at,
    row.auth_status,
    row.reject_reason_code,
    row.collector_version,
  ];
}

function acceptedRowToParams(row: AcceptedEventRow): unknown[] {
  return [
    row.site_id,
    row.hostname,
    row.event_type,
    row.session_id,
    row.browser_id,
    row.client_timestamp_ms,
    row.received_at,
    row.raw,
    row.collector_version,
    row.client_event_id,
    row.page_view_id,
    row.previous_page_view_id,
    row.event_sequence_index,
    row.event_contract_version,
    row.request_id,
    row.workspace_id,
    row.validator_version,
    row.schema_key,
    row.schema_version,
    row.event_origin,
    row.id_format,
    row.traffic_class,
    row.payload_sha256,
    row.size_bytes,
    row.ip_hash,
    row.consent_state,
    row.consent_source,
    row.consent_updated_at,
    row.pre_consent_mode,
    row.tracking_mode,
    row.storage_mechanism,
    row.session_seq,
    row.session_started_at,
    row.session_last_seen_at,
    row.canonical_jsonb,
    row.payload_purged_at,
    row.debug_mode,
  ];
}

function rejectedRowToParams(row: RejectedEventRow): unknown[] {
  return [
    row.site_id,
    toJsonbText(row.raw),
    row.reason_codes,
    row.received_at,
    row.collector_version,
    row.request_id,
    row.workspace_id,
    row.client_event_id,
    row.id_format,
    row.event_name,
    row.event_type,
    row.schema_key,
    row.schema_version,
    row.rejected_stage,
    row.reason_code,
    row.reason_detail,
    row.schema_errors_jsonb,
    row.pii_hits_jsonb,
    row.raw_payload_sha256,
    row.size_bytes,
    row.debug_mode,
    row.sample_visible_to_admin,
    row.rejected_at,
  ];
}

function toJsonbText(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError('Cannot persist undefined as JSONB');
  }
  return encoded;
}

/* --------------------------------------------------------------------------
 * Conflict rebucketing
 * ------------------------------------------------------------------------ */

/**
 * Rebuild a duplicate accepted candidate as a rejected row with
 * reason_code='duplicate_client_event_id'. Computes raw_payload_sha256 from
 * the original raw_event (accepted.raw) — NOT from accepted.payload_sha256,
 * which hashes the normalised envelope (different shape).
 */
function rebucketAcceptedAsDuplicate(accepted: AcceptedEventRow): RejectedEventRow {
  const rawPayloadSha256 = payloadSha256(accepted.raw);
  const sizeBytes = Buffer.byteLength(stableStringify(accepted.raw), 'utf8');

  return {
    // ---- Legacy columns ----
    site_id: accepted.site_id,
    raw: accepted.raw,
    // Dual-write per PR#3 transition.
    reason_codes: ['duplicate_client_event_id'],
    received_at: accepted.received_at,
    collector_version: accepted.collector_version,

    // ---- PR#3 evidence columns ----
    request_id: accepted.request_id,
    workspace_id: accepted.workspace_id,
    client_event_id: accepted.client_event_id,
    id_format: accepted.id_format,
    event_name: null,
    event_type: accepted.event_type,
    schema_key: accepted.schema_key,
    schema_version: accepted.schema_version,
    rejected_stage: 'dedupe',
    reason_code: 'duplicate_client_event_id',
    reason_detail: null,
    schema_errors_jsonb: null,
    pii_hits_jsonb: null,
    raw_payload_sha256: rawPayloadSha256,
    size_bytes: sizeBytes,
    debug_mode: false,
    sample_visible_to_admin: true,
    rejected_at: accepted.received_at,
  };
}

/**
 * Detect whether a thrown pg error is a 23505 unique_violation that names one
 * of the dedup indexes (PR#6 new index, or legacy index). Returns null for
 * other errors so the caller can rethrow.
 */
function classifyDedupConflictError(err: unknown): 'dedup' | 'unknown_23505' | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { code?: unknown; constraint?: unknown };
  if (e.code !== '23505') return null;
  const constraint = typeof e.constraint === 'string' ? e.constraint : '';
  if (constraint === DEDUP_INDEX_NEW || constraint === DEDUP_INDEX_LEGACY) {
    return 'dedup';
  }
  return 'unknown_23505';
}

/* --------------------------------------------------------------------------
 * Public API — writeOrchestratorOutput
 * ------------------------------------------------------------------------ */

/**
 * Write an OrchestratorOutput into a single DB transaction. Returns the final
 * response/status to send to the HTTP client (post-rebucketing).
 *
 * Always uses a dedicated client acquired from the pool. Releases the client
 * in a finally block.
 */
export async function writeOrchestratorOutput(
  pool: Pool,
  output: OrchestratorOutput,
): Promise<PersistenceResult> {
  const client: PoolClient = await pool.connect();
  // One outer transaction guard. After `BEGIN` succeeds the flag flips to
  // true; the outer catch issues a single ROLLBACK on any post-BEGIN error
  // — including ingest insert failure and final UPDATE failure, which
  // previously had no rollback path. Inner blocks classify and rethrow but
  // do NOT call ROLLBACK themselves, avoiding double-rollback.
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    // Step 1: insert ingest_request with initial (0, 0) counts and
    // reconciled_at=null. The final UPDATE at step 5 fills both in once we
    // know how many rows actually committed (post-rebucketing).
    const ingestInitial: IngestRequestRow = {
      ...output.ingest_request,
      accepted_count: 0,
      rejected_count: 0,
      reconciled_at: null,
    };
    await client.query(INGEST_INSERT_SQL, ingestRowToParams(ingestInitial));

    // Step 2: per-row accepted inserts with ON CONFLICT DO NOTHING RETURNING.
    // ON CONFLICT covers the PR#6 partial unique index keyed on
    // (workspace_id, site_id, client_event_id) WHERE all three IS NOT NULL.
    // The legacy index uses a different triple and is NOT caught by ON CONFLICT
    // here; a hit raises 23505 which the try/catch below classifies and
    // reclassifies the same way.
    const acceptedWritten: AcceptedEventRow[] = [];
    const reclassified: RejectedEventRow[] = [];
    const reclassifiedIndices = new Set<number>();

    for (let i = 0; i < output.accepted.length; i++) {
      const acceptedRow = output.accepted[i];
      let hitConflict = false;
      try {
        const result = await client.query(
          ACCEPTED_INSERT_SQL,
          acceptedRowToParams(acceptedRow),
        );
        if (typeof result.rowCount === 'number' && result.rowCount === 0) {
          // PR#6 partial unique index conflict — silently swallowed by
          // ON CONFLICT DO NOTHING. Reclassify.
          hitConflict = true;
        } else {
          acceptedWritten.push(acceptedRow);
        }
      } catch (err) {
        const classified = classifyDedupConflictError(err);
        if (classified === 'dedup') {
          // Legacy idx_accepted_dedup_client_event conflict — same reclassification.
          hitConflict = true;
        } else {
          // Non-conflict error OR unknown 23505 — bubble to outer catch,
          // which issues the single ROLLBACK and rethrows.
          throw err;
        }
      }

      if (hitConflict) {
        reclassified.push(rebucketAcceptedAsDuplicate(acceptedRow));
        reclassifiedIndices.add(i);
      }
    }

    // Step 3: insert original rejected rows, then reclassified duplicates.
    // Any throw bubbles to the outer catch.
    for (const rejectedRow of output.rejected) {
      await client.query(REJECTED_INSERT_SQL, rejectedRowToParams(rejectedRow));
    }
    for (const reclassifiedRow of reclassified) {
      await client.query(REJECTED_INSERT_SQL, rejectedRowToParams(reclassifiedRow));
    }

    // Step 4: build final response — flip the response.results entries that
    // correspond to reclassified accepted candidates. The orchestrator already
    // emitted entries in event-index order: rejected entries first (from the
    // rejected pipeline) interleaved with accepted entries. We can't simply
    // index into results by accepted-array index. Instead, we walk
    // response.results and, for each accepted entry, drop one from the head
    // of an "accepted reclassification queue" — flipping it to rejected when
    // it matches a reclassified index.
    const finalResults: EventResponseEntry[] = [];
    let acceptedSeenIdx = 0;
    for (const entry of output.response.results) {
      if (entry.status === 'accepted') {
        if (reclassifiedIndices.has(acceptedSeenIdx)) {
          finalResults.push({
            status: 'rejected',
            client_event_id: entry.client_event_id,
            reason_code: 'duplicate_client_event_id',
          });
        } else {
          finalResults.push(entry);
        }
        acceptedSeenIdx += 1;
      } else {
        finalResults.push(entry);
      }
    }

    const finalAcceptedCount = acceptedWritten.length;
    const finalRejectedCount = output.rejected.length + reclassified.length;

    // Step 5: UPDATE ingest_requests with final counts + reconciled_at.
    // Any throw here bubbles to the outer catch — the transaction has not
    // yet committed, so the outer guard correctly rolls everything back.
    await client.query(INGEST_UPDATE_SQL, [
      finalAcceptedCount,
      finalRejectedCount,
      output.ingest_request.received_at,
      output.http_status,
      output.ingest_request.request_id,
    ]);

    await client.query('COMMIT');
    transactionOpen = false;

    const finalResponse: RequestResponse = {
      request_id: output.response.request_id,
      expected_event_count: output.response.expected_event_count,
      accepted_count: finalAcceptedCount,
      rejected_count: finalRejectedCount,
      results: finalResults,
    };

    return {
      final_response: finalResponse,
      final_http_status: output.http_status,
      accepted_written: finalAcceptedCount,
      rejected_written: finalRejectedCount,
      dedupe_reclassified: reclassified.length,
    };
  } catch (err) {
    // Outer guard: any throw after a successful BEGIN gets a single
    // ROLLBACK. If ROLLBACK itself throws we swallow that failure and
    // rethrow the ORIGINAL error so the caller never loses the root cause.
    if (transactionOpen) {
      transactionOpen = false;
      try {
        await client.query('ROLLBACK');
      } catch {
        // Swallow — the original error is the one the caller needs.
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

/* --------------------------------------------------------------------------
 * Best-effort token last_used_at touch — OUTSIDE the main transaction
 * ------------------------------------------------------------------------ */

/**
 * Update site_write_tokens.last_used_at = NOW() for the resolved token.
 * Best-effort: errors are swallowed silently — this is observability metadata,
 * not invariant. Callers should NOT await this in their critical path.
 */
export async function touchTokenLastUsedAt(pool: Pool, tokenId: string): Promise<void> {
  try {
    await pool.query(TOKEN_TOUCH_SQL, [tokenId]);
  } catch {
    // Intentionally swallowed — see contract above.
  }
}
