/**
 * Sprint 1 PR#8 — POST /v1/event route → real DB rows.
 *
 * Issues real HTTP via node:http + global fetch against a local Express app
 * mounting the real createV1Router with a real pg.Pool. Asserts the DB rows
 * actually land where they should and that request-level vs event-level
 * rejection semantics from PR#5c-2 are preserved end-to-end.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  TEST_DISABLED_TOKEN,
  TEST_TOKEN,
  TEST_WORKSPACE_ID,
  bootstrapTestDb,
  cleanupTestBoundary,
  endTestPool,
  getTestPool,
  makeValidEvent,
  seedDisabledToken,
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

async function countWorkspaceRows(
  table: 'accepted_events' | 'rejected_events' | 'ingest_requests',
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE workspace_id = $1`,
    [TEST_WORKSPACE_ID],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

describe('POST /v1/event — valid event', () => {
  it('writes one ingest_requests + one accepted_events row, HTTP 200', async () => {
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    expect(res.status).toBe(200);
    expect(await countWorkspaceRows('ingest_requests')).toBe(1);
    expect(await countWorkspaceRows('accepted_events')).toBe(1);
    expect(await countWorkspaceRows('rejected_events')).toBe(0);

    const ingest = await pool.query(
      `SELECT auth_status, http_status, accepted_count, rejected_count,
              expected_event_count, reconciled_at
         FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    const row = ingest.rows[0] as Record<string, unknown>;
    expect(row.auth_status).toBe('ok');
    expect(row.http_status).toBe(200);
    expect(row.accepted_count).toBe(1);
    expect(row.rejected_count).toBe(0);
    expect(row.expected_event_count).toBe(1);
    expect(row.reconciled_at).not.toBeNull();
  });
});

describe('POST /v1/event — invalid event (validation reject)', () => {
  it('writes one ingest + zero accepted + one rejected, HTTP 200', async () => {
    // Bad client_event_id format triggers validation reject at the orchestrator.
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent({ client_event_id: 'not-a-uuid' })),
    });
    expect(res.status).toBe(200);
    expect(await countWorkspaceRows('ingest_requests')).toBe(1);
    expect(await countWorkspaceRows('accepted_events')).toBe(0);
    expect(await countWorkspaceRows('rejected_events')).toBe(1);
  });
});

describe('POST /v1/event — request-level rejects', () => {
  it('invalid JSON → HTTP 400, ingest only, request_body_sha256 stored', async () => {
    const body = '{not-json';
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body,
    });
    expect(res.status).toBe(400);
    expect(await countWorkspaceRows('ingest_requests')).toBe(1);
    expect(await countWorkspaceRows('accepted_events')).toBe(0);
    expect(await countWorkspaceRows('rejected_events')).toBe(0);

    const ingest = await pool.query(
      `SELECT request_body_sha256, http_status, reject_reason_code
         FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    const row = ingest.rows[0] as Record<string, unknown>;
    expect(typeof row.request_body_sha256).toBe('string');
    expect((row.request_body_sha256 as string).length).toBe(64);
    expect(row.http_status).toBe(400);
    expect(row.reject_reason_code).toBe('request_body_invalid_json');
  });

  it('bad Content-Type → HTTP 415, ingest only', async () => {
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    expect(await countWorkspaceRows('ingest_requests')).toBe(1);
    expect(await countWorkspaceRows('accepted_events')).toBe(0);
    expect(await countWorkspaceRows('rejected_events')).toBe(0);

    const ingest = await pool.query(
      `SELECT http_status, reject_reason_code FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(ingest.rows[0]?.http_status).toBe(415);
    expect(ingest.rows[0]?.reject_reason_code).toBe('content_type_invalid');
  });
});

describe('POST /v1/event — auth rejects', () => {
  it('missing/invalid token → HTTP 401, ingest only, auth_status=invalid_token', async () => {
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeValidEvent()),
    });
    expect(res.status).toBe(401);
    // Auth-failed requests still produce an ingest row, but workspace_id is
    // null (no resolved boundary). Count via auth_status, not workspace.
    const ingest = await pool.query<{ auth_status: string; http_status: number; reject_reason_code: string }>(
      `SELECT auth_status, http_status, reject_reason_code
         FROM ingest_requests
        WHERE auth_status = 'invalid_token' AND http_status = 401
          AND received_at > NOW() - INTERVAL '5 seconds'`,
    );
    expect(ingest.rowCount).toBeGreaterThanOrEqual(1);
    expect(ingest.rows[0].reject_reason_code).toBe('auth_invalid');
    // No accepted/rejected events for the test workspace.
    expect(await countWorkspaceRows('accepted_events')).toBe(0);
    expect(await countWorkspaceRows('rejected_events')).toBe(0);
  });

  it('disabled token → HTTP 403, ingest only, auth_status=site_disabled', async () => {
    await seedDisabledToken(pool);
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_DISABLED_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    expect(res.status).toBe(403);
    const ingest = await pool.query<{
      auth_status: string;
      http_status: number;
      reject_reason_code: string;
    }>(
      `SELECT auth_status, http_status, reject_reason_code
         FROM ingest_requests
        WHERE auth_status = 'site_disabled' AND http_status = 403
          AND received_at > NOW() - INTERVAL '5 seconds'`,
    );
    expect(ingest.rowCount).toBeGreaterThanOrEqual(1);
    expect(ingest.rows[0].reject_reason_code).toBe('auth_site_disabled');
  });
});
