/**
 * Sprint 1 PR#8 — hash invariants from stored DB rows.
 *
 * Verifies that what the orchestrator + persistence write into the columns
 * actually matches what we recompute from the wire bytes / stored raw, with
 * the deliberate distinction that:
 *
 *   accepted_events.payload_sha256  hashes the normalised envelope (broader)
 *   accepted_events.canonical_jsonb is the data-minimised projection (19 keys)
 *   rejected_events.raw_payload_sha256 hashes the original raw event fragment
 *
 * The two shapes are intentionally different — § 2.5 line 168.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { sha256Hex } from '../../../src/collector/v1/hash.js';
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

describe('PR#8 — request_body_sha256 = sha256Hex(raw bytes)', () => {
  it('matches for a known-byte body', async () => {
    const bodyStr = JSON.stringify(makeValidEvent());
    const buf = Buffer.from(bodyStr, 'utf8');
    const expected = sha256Hex(buf);

    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: bodyStr,
    });
    expect(res.status).toBe(200);
    const row = await pool.query<{ request_body_sha256: string }>(
      `SELECT request_body_sha256 FROM ingest_requests WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(row.rows[0]?.request_body_sha256).toBe(expected);
  });
});

describe('PR#8 — accepted_events: payload_sha256 + canonical_jsonb shape', () => {
  it('payload_sha256 is present and 64 hex chars', async () => {
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    const r = await pool.query<{ payload_sha256: string }>(
      `SELECT payload_sha256 FROM accepted_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(r.rows[0]?.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('canonical_jsonb is present and has exactly 19 keys', async () => {
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    const r = await pool.query<{ canonical_jsonb: Record<string, unknown> }>(
      `SELECT canonical_jsonb FROM accepted_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(r.rows[0]?.canonical_jsonb).toBeTruthy();
    expect(Object.keys(r.rows[0]?.canonical_jsonb ?? {})).toHaveLength(19);
  });

  it('payload_sha256 !== payloadSha256(canonical_jsonb) — distinct shapes per §2.5 line 168', async () => {
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    const r = await pool.query<{
      payload_sha256: string;
      canonical_jsonb: Record<string, unknown>;
    }>(
      `SELECT payload_sha256, canonical_jsonb FROM accepted_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    const stored = r.rows[0];
    expect(stored).toBeTruthy();
    // The locked contract: payload_sha256 hashes the normalised envelope
    // (broader, distinct shape from canonical_jsonb). Recompute the canonical
    // hash from the stored projection and assert they differ.
    const canonicalHash = payloadSha256(stored.canonical_jsonb);
    expect(stored.payload_sha256).not.toBe(canonicalHash);
  });
});

describe('PR#8 — rejected_events: raw_payload_sha256 = payloadSha256(raw)', () => {
  it('ordinary validation reject: raw_payload_sha256 matches stored raw', async () => {
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent({ client_event_id: 'not-a-uuid' })),
    });
    const r = await pool.query<{ raw: unknown; raw_payload_sha256: string }>(
      `SELECT raw, raw_payload_sha256 FROM rejected_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(r.rowCount).toBe(1);
    const expected = payloadSha256(r.rows[0].raw);
    expect(r.rows[0].raw_payload_sha256).toBe(expected);
  });
});

describe('PR#8 — duplicate reclassification: raw_payload_sha256 = payloadSha256(raw), NOT accepted payload_sha256', () => {
  it('after a cross-request duplicate, the rejected row hashes the raw event', async () => {
    // First request — should succeed and write one accepted row.
    const evt = makeValidEvent({
      client_event_id: '44444444-4444-4444-8444-444444444444',
    });
    const body = JSON.stringify(evt);
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body,
    });
    // Second request — same client_event_id, should be reclassified as
    // duplicate via PR#6 partial unique index.
    await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body,
    });

    const accepted = await pool.query<{ raw: unknown; payload_sha256: string }>(
      `SELECT raw, payload_sha256 FROM accepted_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(accepted.rowCount).toBe(1);
    const acceptedPayloadSha = accepted.rows[0].payload_sha256;

    const rejected = await pool.query<{
      raw: unknown;
      raw_payload_sha256: string;
      reason_code: string;
    }>(
      `SELECT raw, raw_payload_sha256, reason_code
         FROM rejected_events WHERE workspace_id = $1`,
      [TEST_WORKSPACE_ID],
    );
    expect(rejected.rowCount).toBe(1);
    expect(rejected.rows[0].reason_code).toBe('duplicate_client_event_id');

    // raw_payload_sha256 hashes the raw event fragment …
    const expectedFromRaw = payloadSha256(rejected.rows[0].raw);
    expect(rejected.rows[0].raw_payload_sha256).toBe(expectedFromRaw);
    // … and NOT the accepted row's payload_sha256 (different shape).
    expect(rejected.rows[0].raw_payload_sha256).not.toBe(acceptedPayloadSha);
  });
});
