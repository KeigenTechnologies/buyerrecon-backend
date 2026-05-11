/**
 * Sprint 1 PR#8 — accepted_events_dedup index validity on a real DB.
 *
 * Verifies PR#6 migration 007 lands a partial UNIQUE INDEX that is valid,
 * uniquely keyed on (workspace_id, site_id, client_event_id) in order, with
 * the three-column IS NOT NULL partial predicate. Also asserts the legacy
 * idx_accepted_dedup_client_event partial unique index is still in place
 * (different triple — they coexist).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import {
  bootstrapTestDb,
  endTestPool,
  getTestPool,
  verifyAcceptedEventsDedupValid,
} from './_setup.js';

let pool: Pool;

beforeAll(async () => {
  pool = getTestPool();
  await bootstrapTestDb(pool);
});

afterAll(async () => {
  await endTestPool(pool);
});

describe('PR#8 — accepted_events_dedup migration validity', () => {
  it('index exists', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.exists).toBe(true);
  });

  it('index is unique', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.is_unique).toBe(true);
  });

  it('pg_index.indisvalid = true', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.is_valid).toBe(true);
  });

  it('index def names accepted_events and column triple in order', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.indexdef).not.toBeNull();
    const def = state.indexdef ?? '';
    expect(def).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+accepted_events_dedup/i);
    expect(def).toMatch(/ON\s+(public\.)?accepted_events/i);
    // pg_get_indexdef emits columns in the declared order.
    expect(def).toMatch(
      /\(\s*workspace_id\s*,\s*site_id\s*,\s*client_event_id\s*\)/i,
    );
  });

  it('partial predicate includes workspace_id IS NOT NULL', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.indexdef ?? '').toMatch(/workspace_id\s+IS\s+NOT\s+NULL/i);
  });

  it('partial predicate includes site_id IS NOT NULL', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.indexdef ?? '').toMatch(/site_id\s+IS\s+NOT\s+NULL/i);
  });

  it('partial predicate includes client_event_id IS NOT NULL', async () => {
    const state = await verifyAcceptedEventsDedupValid(pool);
    expect(state.indexdef ?? '').toMatch(/client_event_id\s+IS\s+NOT\s+NULL/i);
  });
});

describe('PR#8 — legacy partial unique index still present', () => {
  it('idx_accepted_dedup_client_event exists', async () => {
    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname  = 'idx_accepted_dedup_client_event'`,
    );
    expect(result.rowCount).toBe(1);
  });
});

describe('PR#8 — schema.sql must NOT contain accepted_events_dedup', () => {
  it('the dedup index must NOT be folded into schema.sql (CONCURRENTLY incompatible)', () => {
    // Read-only assertion against the file. Migration 007 is the canonical
    // home for accepted_events_dedup; schema.sql gets it via psql -f, never
    // via initDb()/pool.query(schema).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const schema = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'src', 'db', 'schema.sql'),
      'utf8',
    );
    expect(schema).not.toMatch(/accepted_events_dedup/);
  });
});
