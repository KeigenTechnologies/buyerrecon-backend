/**
 * Sprint 1 PR#8 — POST /v1/batch route → real DB rows.
 *
 * Runs with ENABLE_V1_BATCH=true. Asserts mixed/empty/non-object-fragment
 * batches land the expected rows and that Option A (non-object fragments
 * stored verbatim with raw_payload_sha256 = payloadSha256(fragment)) is
 * preserved end-to-end through the persistence layer.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { payloadSha256 } from '../../../src/collector/v1/payload-hash.js';
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

async function rowCount(
  table: 'accepted_events' | 'rejected_events' | 'ingest_requests',
): Promise<number> {
  const r = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE workspace_id = $1`,
    [TEST_WORKSPACE_ID],
  );
  return parseInt(r.rows[0]?.count ?? '0', 10);
}

describe('POST /v1/batch — mixed batch', () => {
  it('writes one ingest + N accepted + M rejected, HTTP 200', async () => {
    // 2 valid (different client_event_ids) + 2 invalid (bad client_event_id)
    const events = [
      makeValidEvent({ client_event_id: '11111111-1111-4111-8111-111111111111' }),
      makeValidEvent({ client_event_id: 'not-a-uuid-a' }),
      makeValidEvent({ client_event_id: '22222222-2222-4222-8222-222222222222' }),
      makeValidEvent({ client_event_id: 'not-a-uuid-b' }),
    ];
    const res = await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ events }),
    });
    expect(res.status).toBe(200);
    expect(await rowCount('ingest_requests')).toBe(1);
    expect(await rowCount('accepted_events')).toBe(2);
    expect(await rowCount('rejected_events')).toBe(2);

    const ingest = await pool.query(
      `SELECT expected_event_count, accepted_count, rejected_count, reconciled_at
         FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    const row = ingest.rows[0] as Record<string, unknown>;
    expect(row.expected_event_count).toBe(4);
    expect(row.accepted_count).toBe(2);
    expect(row.rejected_count).toBe(2);
    expect(row.reconciled_at).not.toBeNull();
  });
});

describe('POST /v1/batch — empty batch', () => {
  it('writes ingest only with expected_event_count=0', async () => {
    const res = await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(200);
    expect(await rowCount('ingest_requests')).toBe(1);
    expect(await rowCount('accepted_events')).toBe(0);
    expect(await rowCount('rejected_events')).toBe(0);
    const ingest = await pool.query(
      `SELECT expected_event_count FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(ingest.rows[0]?.expected_event_count).toBe(0);
  });
});

describe('POST /v1/batch — non-object fragments (Option A)', () => {
  it('stores fragments verbatim with missing_required_field + payloadSha256(fragment)', async () => {
    // Number, null, array, string — none are plain objects.
    const fragments: unknown[] = [42, null, [1, 2, 3], 'oops'];
    const res = await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ events: fragments }),
    });
    expect(res.status).toBe(200);
    expect(await rowCount('accepted_events')).toBe(0);
    expect(await rowCount('rejected_events')).toBe(4);

    const rejected = await pool.query<{
      raw: unknown;
      raw_payload_sha256: string;
      reason_code: string;
      rejected_stage: string;
    }>(
      `SELECT raw, raw_payload_sha256, reason_code, rejected_stage
         FROM rejected_events WHERE workspace_id = $1
        ORDER BY id ASC`,
      [TEST_WORKSPACE_ID],
    );
    expect(rejected.rowCount).toBe(4);
    // Match each stored row to the corresponding fragment by recomputed hash.
    const expectedHashes = fragments.map((f) => payloadSha256(f));
    const storedHashes = rejected.rows.map((r) => r.raw_payload_sha256);
    expect(new Set(storedHashes)).toEqual(new Set(expectedHashes));
    // Every row uses the locked reason_code + stage.
    for (const r of rejected.rows) {
      expect(r.reason_code).toBe('missing_required_field');
      expect(r.rejected_stage).toBe('validation');
    }
  });

  it('does NOT wrap fragments or fall back to empty hash', async () => {
    const fragments: unknown[] = [42];
    await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ events: fragments }),
    });
    const rejected = await pool.query<{ raw: unknown; raw_payload_sha256: string }>(
      `SELECT raw, raw_payload_sha256 FROM rejected_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(rejected.rowCount).toBe(1);
    // raw must be the number 42, stored verbatim (no { fragment: 42 } wrapper).
    expect(rejected.rows[0].raw).toBe(42);
    // No empty-hash fallback.
    const empty = payloadSha256({});
    expect(rejected.rows[0].raw_payload_sha256).not.toBe(empty);
    expect(rejected.rows[0].raw_payload_sha256).toBe(payloadSha256(42));
  });
});

describe('POST /v1/batch — over 100 events', () => {
  it('returns HTTP 413 and writes ingest only', async () => {
    const events = Array.from({ length: 101 }, (_, i) =>
      makeValidEvent({
        client_event_id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`,
      }),
    );
    const res = await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ events }),
    });
    expect(res.status).toBe(413);
    expect(await rowCount('ingest_requests')).toBe(1);
    expect(await rowCount('accepted_events')).toBe(0);
    expect(await rowCount('rejected_events')).toBe(0);
    const ingest = await pool.query(
      `SELECT reject_reason_code FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(ingest.rows[0]?.reject_reason_code).toBe('batch_item_count_exceeded');
  });
});
