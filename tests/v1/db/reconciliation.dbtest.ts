/**
 * Sprint 1 PR#8 — reconciliation invariants on a real DB.
 *
 * Drives several /v1/event and /v1/batch requests through the real route +
 * persistence layers, then runs the §2.12-equivalent reconciliation SQL
 * against the stored rows.
 *
 * Invariants asserted (must hold for every reconciled ingest row under the
 * test boundary):
 *   1. accepted_count + rejected_count = expected_event_count
 *   2. SELECT COUNT(*) FROM accepted_events JOIN ON request_id = ingest.accepted_count
 *   3. SELECT COUNT(*) FROM rejected_events JOIN ON request_id = ingest.rejected_count
 *   4. reconciled_at IS NOT NULL on every parseable request
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  TEST_TOKEN,
  TEST_WORKSPACE_ID,
  bootstrapTestDb,
  cleanupTestBoundary,
  endTestPool,
  getTestPool,
  makeValidEvent,
  seedTestToken,
  startV1TestApp,
  stopV1TestApp,
  type V1TestApp,
} from './_setup.js';

let pool: Pool;
let app: V1TestApp;

beforeAll(async () => {
  pool = getTestPool();
  await bootstrapTestDb(pool);
  app = await startV1TestApp(pool, { enable_v1_batch: true });
});

afterAll(async () => {
  await stopV1TestApp(app);
  await endTestPool(pool);
});

beforeEach(async () => {
  await cleanupTestBoundary(pool);
  await seedTestToken(pool);
});

async function postEvent(body: unknown): Promise<Response> {
  return fetch(`${app.baseUrl}/v1/event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TEST_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

async function postBatch(events: unknown[]): Promise<Response> {
  return fetch(`${app.baseUrl}/v1/batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TEST_TOKEN}`,
    },
    body: JSON.stringify({ events }),
  });
}

describe('PR#8 — reconciliation invariants from stored DB rows', () => {
  beforeEach(async () => {
    // Drive a mix of request shapes so the suite has interesting data to join.
    await postEvent(makeValidEvent({ client_event_id: '11111111-1111-4111-8111-111111111111' }));
    await postEvent(makeValidEvent({ client_event_id: 'not-a-uuid' })); // 1 rejected
    await postBatch([
      makeValidEvent({ client_event_id: '22222222-2222-4222-8222-222222222222' }),
      // NOTE: do not use an all-threes UUID here. The 19-digit run
      // `3333333333334333833` (after the regex consumes the first three
      // dashed segments greedily) passes the Luhn checksum and triggers the
      // orchestrator's PII payment-card detector, turning this intended-valid
      // event into a pii_payment_detected reject. The all-fours UUID below is
      // Luhn-safe.
      makeValidEvent({ client_event_id: '44444444-4444-4444-8444-444444444444' }),
      makeValidEvent({ client_event_id: 'still-not-a-uuid' }),
    ]);
    await postBatch([]); // empty batch — ingest only with expected=0
  });

  it('every reconciled ingest row: accepted + rejected = expected', async () => {
    const result = await pool.query(
      `SELECT request_id, expected_event_count, accepted_count, rejected_count,
              accepted_count + rejected_count AS sum_actual, reconciled_at
         FROM ingest_requests
        WHERE workspace_id = $1
          AND reconciled_at IS NOT NULL
          AND accepted_count + rejected_count <> expected_event_count`,
      [TEST_WORKSPACE_ID],
    );
    expect(result.rowCount).toBe(0);
  });

  it('actual accepted_events row count equals ingest_requests.accepted_count', async () => {
    const result = await pool.query<{ request_id: string; ledger: number; actual: number }>(
      `SELECT ir.request_id::text                                 AS request_id,
              ir.accepted_count                                  AS ledger,
              COALESCE(a.cnt, 0)::int                            AS actual
         FROM ingest_requests ir
         LEFT JOIN (
           SELECT request_id, COUNT(*)::int AS cnt
             FROM accepted_events
            WHERE workspace_id = $1
            GROUP BY request_id
         ) a ON a.request_id = ir.request_id
        WHERE ir.workspace_id = $1
          AND ir.accepted_count <> COALESCE(a.cnt, 0)`,
      [TEST_WORKSPACE_ID],
    );
    expect(result.rowCount).toBe(0);
  });

  it('actual rejected_events row count equals ingest_requests.rejected_count', async () => {
    const result = await pool.query(
      `SELECT ir.request_id::text                                 AS request_id,
              ir.rejected_count                                  AS ledger,
              COALESCE(r.cnt, 0)::int                            AS actual
         FROM ingest_requests ir
         LEFT JOIN (
           SELECT request_id, COUNT(*)::int AS cnt
             FROM rejected_events
            WHERE workspace_id = $1
            GROUP BY request_id
         ) r ON r.request_id = ir.request_id
        WHERE ir.workspace_id = $1
          AND ir.rejected_count <> COALESCE(r.cnt, 0)`,
      [TEST_WORKSPACE_ID],
    );
    expect(result.rowCount).toBe(0);
  });

  it('reconciled_at is non-null on every ingest row for the test boundary', async () => {
    const result = await pool.query(
      `SELECT request_id FROM ingest_requests
        WHERE workspace_id = $1 AND reconciled_at IS NULL`,
      [TEST_WORKSPACE_ID],
    );
    expect(result.rowCount).toBe(0);
  });

  it('total accepted across boundary equals 3 (the 1 single-event + 2 batch accepted)', async () => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM accepted_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(parseInt(result.rows[0]?.count ?? '0', 10)).toBe(3);
  });

  it('total rejected across boundary equals 2 (the 1 bad-uuid single + 1 bad-uuid batch)', async () => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rejected_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(parseInt(result.rows[0]?.count ?? '0', 10)).toBe(2);
  });
});
