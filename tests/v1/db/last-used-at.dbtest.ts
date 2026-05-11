/**
 * Sprint 1 PR#8 — site_write_tokens.last_used_at touched after successful auth.
 *
 * PR#7 makes this best-effort and post-response. Tests poll up to 5×100ms
 * for the column to flip from NULL to non-null. Failure of the touch must
 * never block event capture; that property is locked by an existing
 * fake-pool persistence test (tests/v1/persistence.test.ts) so PR#8 does
 * not retest it.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  TEST_TOKEN,
  TEST_TOKEN_ID,
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

async function readLastUsedAt(): Promise<Date | null> {
  const r = await pool.query<{ last_used_at: Date | null }>(
    `SELECT last_used_at FROM site_write_tokens WHERE token_id = $1`,
    [TEST_TOKEN_ID],
  );
  return r.rows[0]?.last_used_at ?? null;
}

async function pollForNonNullLastUsedAt(maxAttempts = 5, delayMs = 100): Promise<Date | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const v = await readLastUsedAt();
    if (v !== null) return v;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return readLastUsedAt();
}

describe('PR#8 — site_write_tokens.last_used_at updates after successful auth', () => {
  it('is null after seedTestToken (clean before-state)', async () => {
    const before = await readLastUsedAt();
    expect(before).toBeNull();
  });

  it('becomes non-null within 5×100ms after a successful /v1/event', async () => {
    const before = await readLastUsedAt();
    expect(before).toBeNull();

    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify(makeValidEvent()),
    });
    expect(res.status).toBe(200);

    const after = await pollForNonNullLastUsedAt();
    expect(after).not.toBeNull();
    expect(after instanceof Date || typeof after === 'string').toBe(true);
  });
});
