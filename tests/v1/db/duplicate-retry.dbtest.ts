/**
 * Sprint 1 PR#8 — cross-request duplicate retry proof (sequential, small scale).
 *
 * Sends the same client_event_id N times sequentially. Asserts the DB ends
 * up with exactly 1 accepted_events row and N-1 rejected_events rows with
 * reason_code = 'duplicate_client_event_id'. Every HTTP response is 200 —
 * the SDK retry path never produces a 5xx.
 *
 * 50-retry parallel stress is intentionally deferred to PR#8b — see
 * docs/sprint2-pr8-db-verification.md.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  TEST_SITE_ID,
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
  app = await startV1TestApp(pool, { enable_v1_batch: false });
});

afterAll(async () => {
  await stopV1TestApp(app);
  await endTestPool(pool);
});

beforeEach(async () => {
  await cleanupTestBoundary(pool);
  await seedTestToken(pool);
});

async function postEventSequential(body: string, n: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body,
    });
    statuses.push(res.status);
  }
  return statuses;
}

describe('PR#8 — duplicate_client_event_id reclassification (3 retries)', () => {
  it('3 sequential identical /v1/event requests → 1 accepted + 2 duplicate rejected, all HTTP 200', async () => {
    const event = makeValidEvent({
      client_event_id: '55555555-5555-4555-8555-555555555555',
    });
    const statuses = await postEventSequential(JSON.stringify(event), 3);
    expect(statuses).toEqual([200, 200, 200]);

    const accepted = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM accepted_events
        WHERE workspace_id = $1 AND site_id = $2
          AND client_event_id = $3`,
      [TEST_WORKSPACE_ID, TEST_SITE_ID, event.client_event_id],
    );
    expect(parseInt(accepted.rows[0]?.count ?? '0', 10)).toBe(1);

    const duplicateRejected = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM rejected_events
        WHERE workspace_id = $1 AND client_event_id = $2
          AND reason_code = 'duplicate_client_event_id'
          AND rejected_stage = 'dedupe'`,
      [TEST_WORKSPACE_ID, event.client_event_id],
    );
    expect(parseInt(duplicateRejected.rows[0]?.count ?? '0', 10)).toBe(2);
  });
});

describe('PR#8 — duplicate_client_event_id reclassification (5 retries)', () => {
  it('5 sequential identical /v1/event requests → 1 accepted + 4 duplicate rejected, all HTTP 200', async () => {
    // NOTE: do not use an all-sixes UUID here. `66666666-6666-4666-8666-666666666666`
    // contains the 13-digit substring `6666666666666` which passes the Luhn
    // checksum and triggers the orchestrator's PII payment-card detector,
    // causing every request to reject as `pii_payment_detected` before
    // dedupe runs. The mostly-alphabetic UUID below is Luhn-safe because it
    // contains no 13-19 digit run for the payment regex to even consider.
    const event = makeValidEvent({
      client_event_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    const statuses = await postEventSequential(JSON.stringify(event), 5);
    expect(statuses).toEqual([200, 200, 200, 200, 200]);

    const accepted = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM accepted_events
        WHERE workspace_id = $1 AND site_id = $2
          AND client_event_id = $3`,
      [TEST_WORKSPACE_ID, TEST_SITE_ID, event.client_event_id],
    );
    expect(parseInt(accepted.rows[0]?.count ?? '0', 10)).toBe(1);

    const duplicateRejected = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM rejected_events
        WHERE workspace_id = $1 AND client_event_id = $2
          AND reason_code = 'duplicate_client_event_id'`,
      [TEST_WORKSPACE_ID, event.client_event_id],
    );
    expect(parseInt(duplicateRejected.rows[0]?.count ?? '0', 10)).toBe(4);
  });

  it('5 retries: no HTTP 5xx, no orphan rejected rows beyond the duplicate set', async () => {
    const event = makeValidEvent({
      client_event_id: '77777777-7777-4777-8777-777777777777',
    });
    const statuses = await postEventSequential(JSON.stringify(event), 5);
    for (const s of statuses) {
      expect(s).toBeLessThan(500);
      expect(s).toBe(200);
    }
    // Every rejected row for this client_event_id must be a duplicate.
    const other = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM rejected_events
        WHERE workspace_id = $1 AND client_event_id = $2
          AND reason_code <> 'duplicate_client_event_id'`,
      [TEST_WORKSPACE_ID, event.client_event_id],
    );
    expect(parseInt(other.rows[0]?.count ?? '0', 10)).toBe(0);
  });

  it('reconciliation invariant holds for every retry request', async () => {
    const event = makeValidEvent({
      client_event_id: '88888888-8888-4888-8888-888888888888',
    });
    await postEventSequential(JSON.stringify(event), 3);
    const bad = await pool.query(
      `SELECT request_id
         FROM ingest_requests
        WHERE workspace_id = $1
          AND reconciled_at IS NOT NULL
          AND accepted_count + rejected_count <> expected_event_count`,
      [TEST_WORKSPACE_ID],
    );
    expect(bad.rowCount).toBe(0);
  });
});

describe('PR#8 — DB unique key invariant (no two accepted with same triple)', () => {
  it('GROUP BY (workspace, site, client_event_id) HAVING COUNT(*) > 1 returns zero rows', async () => {
    const event = makeValidEvent({
      client_event_id: '99999999-9999-4999-8999-999999999999',
    });
    await postEventSequential(JSON.stringify(event), 4);
    const dup = await pool.query(
      `SELECT workspace_id, site_id, client_event_id, COUNT(*) AS c
         FROM accepted_events
        WHERE workspace_id = $1
          AND site_id      = $2
          AND client_event_id IS NOT NULL
        GROUP BY workspace_id, site_id, client_event_id
        HAVING COUNT(*) > 1`,
      [TEST_WORKSPACE_ID, TEST_SITE_ID],
    );
    expect(dup.rowCount).toBe(0);
  });
});
