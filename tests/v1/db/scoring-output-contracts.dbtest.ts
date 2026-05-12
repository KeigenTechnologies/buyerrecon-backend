/**
 * Sprint 2 PR#3 — opt-in DB tests for scoring_output_lane_a /
 * scoring_output_lane_b contract layer.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set.
 *
 * Test boundary: `__test_ws_pr3__`. Distinct from PR#1 / PR#2's
 * `__test_ws_pr1_behavioural__` and the smoke / PR#8 / PR#11 boundaries
 * so PR#3 tests never collide with neighbours.
 *
 * PR#3 ships NO writer. Lane rows in these tests are inserted under
 * the test boundary only — exercising schema invariants and role
 * privileges, NOT scorer behaviour. The DB layer is asserted; no
 * scoring algorithm or reason-code emission is exercised.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { Pool } from 'pg';
import { bootstrapTestDb, endTestPool, getTestPool } from './_setup.js';

const TEST_WORKSPACE = '__test_ws_pr3__';
const TEST_WORKSPACE_OTHER = '__test_ws_pr3_other__';
const TEST_SITE = '__test_site_pr3__';
const TEST_SCORING_VERSION = 's2.v1.0';

let pool: Pool;

beforeAll(async () => {
  pool = getTestPool();
  await bootstrapTestDb(pool);
}, 30_000);

afterAll(async () => {
  await endTestPool(pool);
});

beforeEach(async () => {
  await pool.query(
    'DELETE FROM scoring_output_lane_a WHERE workspace_id IN ($1, $2)',
    [TEST_WORKSPACE, TEST_WORKSPACE_OTHER],
  );
  await pool.query(
    'DELETE FROM scoring_output_lane_b WHERE workspace_id IN ($1, $2)',
    [TEST_WORKSPACE, TEST_WORKSPACE_OTHER],
  );
});

/* --------------------------------------------------------------------------
 * Seed helpers — test-only DML inside the test boundary. PR#3 ships NO
 * writer code; these inserts exercise schema invariants only.
 * ------------------------------------------------------------------------ */

interface LaneARow {
  session_id?: string;
  workspace_id?: string;
  site_id?: string;
  scoring_version?: string;
  source_feature_version?: string | null;
  verification_score?: number;
  evidence_band?: string;
  action_recommendation?: string | null; // null → DB DEFAULT
  reason_codes?: string;
  evidence_refs?: string;
  knob_version_id?: string | null;
}

async function insertLaneA(r: LaneARow = {}): Promise<void> {
  const cols: string[] = ['workspace_id', 'site_id', 'session_id', 'scoring_version', 'verification_score', 'evidence_band'];
  const vals: unknown[] = [
    r.workspace_id ?? TEST_WORKSPACE,
    r.site_id ?? TEST_SITE,
    r.session_id ?? `sess-${Math.random().toString(36).slice(2, 10)}`,
    r.scoring_version ?? TEST_SCORING_VERSION,
    r.verification_score ?? 42,
    r.evidence_band ?? 'low',
  ];
  if (r.action_recommendation !== undefined && r.action_recommendation !== null) {
    cols.push('action_recommendation');
    vals.push(r.action_recommendation);
  }
  if (r.source_feature_version !== undefined) {
    cols.push('source_feature_version');
    vals.push(r.source_feature_version);
  }
  if (r.reason_codes !== undefined) {
    cols.push('reason_codes');
    vals.push(r.reason_codes);
  }
  if (r.evidence_refs !== undefined) {
    cols.push('evidence_refs');
    vals.push(r.evidence_refs);
  }
  if (r.knob_version_id !== undefined) {
    cols.push('knob_version_id');
    vals.push(r.knob_version_id);
  }

  const placeholders = vals.map((_, i) => {
    const k = cols[i];
    if (k === 'reason_codes' || k === 'evidence_refs') return `$${i + 1}::jsonb`;
    return `$${i + 1}`;
  });
  const sql = `INSERT INTO scoring_output_lane_a (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
  await pool.query(sql, vals);
}

interface LaneBRow {
  session_id?: string;
  workspace_id?: string;
  site_id?: string;
  scoring_version?: string;
  agent_family?: string;
  verification_method?: string;
  verification_method_strength?: string | null;
  reason_codes?: string;
  evidence_refs?: string;
}

async function insertLaneB(r: LaneBRow = {}): Promise<void> {
  const cols: string[] = ['workspace_id', 'site_id', 'session_id', 'scoring_version', 'agent_family', 'verification_method'];
  const vals: unknown[] = [
    r.workspace_id ?? TEST_WORKSPACE,
    r.site_id ?? TEST_SITE,
    r.session_id ?? `sess-${Math.random().toString(36).slice(2, 10)}`,
    r.scoring_version ?? TEST_SCORING_VERSION,
    r.agent_family ?? 'unknown_agent',
    r.verification_method ?? 'none',
  ];
  if (r.verification_method_strength !== undefined) {
    cols.push('verification_method_strength');
    vals.push(r.verification_method_strength);
  }
  if (r.reason_codes !== undefined) {
    cols.push('reason_codes');
    vals.push(r.reason_codes);
  }
  if (r.evidence_refs !== undefined) {
    cols.push('evidence_refs');
    vals.push(r.evidence_refs);
  }
  const placeholders = vals.map((_, i) => {
    const k = cols[i];
    if (k === 'reason_codes' || k === 'evidence_refs') return `$${i + 1}::jsonb`;
    return `$${i + 1}`;
  });
  const sql = `INSERT INTO scoring_output_lane_b (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
  await pool.query(sql, vals);
}

interface SourceCounts {
  accepted: number;
  rejected: number;
  ingest: number;
  session_features: number;
  session_behavioural_features_v0_2: number;
}

async function readSourceCounts(): Promise<SourceCounts> {
  const r = async (t: string): Promise<number> => {
    const res = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${t}`);
    return res.rows[0]!.c;
  };
  return {
    accepted: await r('accepted_events'),
    rejected: await r('rejected_events'),
    ingest: await r('ingest_requests'),
    session_features: await r('session_features'),
    session_behavioural_features_v0_2: await r('session_behavioural_features_v0_2'),
  };
}

/* --------------------------------------------------------------------------
 * 1-2. Table + column presence
 * ------------------------------------------------------------------------ */

describe('PR#3 — table presence', () => {
  it('scoring_output_lane_a and scoring_output_lane_b exist after bootstrap', async () => {
    const r = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.scoring_output_lane_a')::text AS regclass`,
    );
    expect(r.rows[0]!.regclass).toBe('scoring_output_lane_a');
    const s = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.scoring_output_lane_b')::text AS regclass`,
    );
    expect(s.rows[0]!.regclass).toBe('scoring_output_lane_b');
  });

  it('Lane A has the required columns', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='scoring_output_lane_a'
        ORDER BY column_name`,
    );
    const cols = new Set(r.rows.map((row) => row.column_name));
    for (const c of [
      'scoring_output_lane_a_id',
      'workspace_id', 'site_id', 'session_id', 'scoring_version',
      'source_feature_version',
      'verification_score', 'evidence_band', 'action_recommendation',
      'reason_codes', 'evidence_refs',
      'knob_version_id', 'record_only',
      'created_at', 'updated_at',
    ]) {
      expect(cols.has(c), `Lane A missing column ${c}`).toBe(true);
    }
  });

  it('Lane B has the required columns', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='scoring_output_lane_b'
        ORDER BY column_name`,
    );
    const cols = new Set(r.rows.map((row) => row.column_name));
    for (const c of [
      'scoring_output_lane_b_id',
      'workspace_id', 'site_id', 'session_id', 'scoring_version',
      'agent_family', 'verification_method', 'verification_method_strength',
      'reason_codes', 'evidence_refs',
      'record_only',
      'created_at', 'updated_at',
    ]) {
      expect(cols.has(c), `Lane B missing column ${c}`).toBe(true);
    }
  });
});

/* --------------------------------------------------------------------------
 * 3. Idempotent migration rerun
 * ------------------------------------------------------------------------ */

describe('PR#3 — migration 011 is idempotent', () => {
  it('applying migration 011 twice succeeds', async () => {
    const { applyMigration011 } = await import('./_setup.js');
    await applyMigration011(pool);
    await applyMigration011(pool);
    // No error means PASS. Verify tables still exist.
    const r = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.scoring_output_lane_a')::text AS regclass`,
    );
    expect(r.rows[0]!.regclass).toBe('scoring_output_lane_a');
  });
});

/* --------------------------------------------------------------------------
 * 4-10. Lane A INSERT invariants
 * ------------------------------------------------------------------------ */

describe('PR#3 — Lane A invariants', () => {
  it('valid Lane A row inserts under test boundary', async () => {
    await insertLaneA({ session_id: 'sess-la-ok', verification_score: 50 });
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM scoring_output_lane_a
        WHERE workspace_id=$1 AND session_id=$2`,
      [TEST_WORKSPACE, 'sess-la-ok'],
    );
    expect(r.rows[0]!.c).toBe(1);
  });

  it('action_recommendation defaults to record_only when omitted', async () => {
    await insertLaneA({ session_id: 'sess-la-default' });
    const r = await pool.query<{ action_recommendation: string }>(
      `SELECT action_recommendation FROM scoring_output_lane_a WHERE session_id=$1`,
      ['sess-la-default'],
    );
    expect(r.rows[0]!.action_recommendation).toBe('record_only');
  });

  it("evidence_band='high' is REJECTED (Hard Rule A)", async () => {
    await expect(insertLaneA({ session_id: 'sess-la-high', evidence_band: 'high' })).rejects.toThrow();
  });

  it("action_recommendation='exclude' is REJECTED (Hard Rule B)", async () => {
    await expect(insertLaneA({ session_id: 'sess-la-excl', action_recommendation: 'exclude' })).rejects.toThrow();
  });

  it("action_recommendation='allow' is REJECTED (Hard Rule B)", async () => {
    await expect(insertLaneA({ session_id: 'sess-la-allow', action_recommendation: 'allow' })).rejects.toThrow();
  });

  it("reason_codes='{}' (object, not array) is REJECTED by CHECK", async () => {
    await expect(insertLaneA({ session_id: 'sess-la-rc-obj', reason_codes: '{}' })).rejects.toThrow();
  });

  it("evidence_refs='{}' (object, not array) is REJECTED by CHECK", async () => {
    await expect(insertLaneA({ session_id: 'sess-la-er-obj', evidence_refs: '{}' })).rejects.toThrow();
  });

  it('verification_score outside [0,99] is REJECTED', async () => {
    await expect(insertLaneA({ session_id: 'sess-la-vs-100', verification_score: 100 })).rejects.toThrow();
    await expect(insertLaneA({ session_id: 'sess-la-vs-neg', verification_score: -1 })).rejects.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * 11-13. Lane B INSERT invariants
 * ------------------------------------------------------------------------ */

describe('PR#3 — Lane B invariants', () => {
  it("valid Lane B row inserts with verification_method='none' and strength NULL", async () => {
    await insertLaneB({
      session_id: 'sess-lb-ok',
      agent_family: 'unknown_agent',
      verification_method: 'none',
    });
    const r = await pool.query<{ verification_method_strength: string | null }>(
      `SELECT verification_method_strength FROM scoring_output_lane_b
        WHERE workspace_id=$1 AND session_id=$2`,
      [TEST_WORKSPACE, 'sess-lb-ok'],
    );
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]!.verification_method_strength).toBeNull();
  });

  it('verification_method outside enum is REJECTED', async () => {
    await expect(insertLaneB({ session_id: 'sess-lb-bad', verification_method: 'something_else' })).rejects.toThrow();
  });

  it("verification_method_strength='strong' is REJECTED (v1 reserved-not-emitted, OD-6)", async () => {
    await expect(
      insertLaneB({
        session_id: 'sess-lb-strong',
        verification_method: 'reverse_dns',
        verification_method_strength: 'strong',
      }),
    ).rejects.toThrow();
  });

  it("reason_codes='{}' (object) is REJECTED by CHECK on Lane B", async () => {
    await expect(insertLaneB({ session_id: 'sess-lb-rc-obj', reason_codes: '{}' })).rejects.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * 14-16. Natural key + cross-workspace isolation
 * ------------------------------------------------------------------------ */

describe('PR#3 — natural-key uniqueness + cross-workspace isolation', () => {
  it('Lane A natural-key duplicate is REJECTED', async () => {
    await insertLaneA({ session_id: 'sess-la-nk' });
    await expect(insertLaneA({ session_id: 'sess-la-nk' })).rejects.toThrow();
  });

  it('Lane B natural-key duplicate is REJECTED', async () => {
    await insertLaneB({ session_id: 'sess-lb-nk' });
    await expect(insertLaneB({ session_id: 'sess-lb-nk' })).rejects.toThrow();
  });

  it('cross-workspace rows with same (site, session, scoring_version) are ALLOWED on Lane A', async () => {
    await insertLaneA({ session_id: 'sess-xws', workspace_id: TEST_WORKSPACE });
    await insertLaneA({ session_id: 'sess-xws', workspace_id: TEST_WORKSPACE_OTHER });
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM scoring_output_lane_a WHERE session_id=$1`,
      ['sess-xws'],
    );
    expect(r.rows[0]!.c).toBe(2);
  });

  it('cross-workspace rows with same (site, session, scoring_version) are ALLOWED on Lane B', async () => {
    await insertLaneB({ session_id: 'sess-xws-b', workspace_id: TEST_WORKSPACE });
    await insertLaneB({ session_id: 'sess-xws-b', workspace_id: TEST_WORKSPACE_OTHER });
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM scoring_output_lane_b WHERE session_id=$1`,
      ['sess-xws-b'],
    );
    expect(r.rows[0]!.c).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 17. Source tables unchanged after migration + after PR#3 inserts
 * ------------------------------------------------------------------------ */

describe('PR#3 — source tables unchanged', () => {
  it('inserting into Lane A / Lane B does not mutate accepted_events / rejected_events / ingest_requests / session_features / session_behavioural_features_v0_2', async () => {
    const before = await readSourceCounts();
    await insertLaneA({ session_id: 'sess-src-a' });
    await insertLaneB({ session_id: 'sess-src-b' });
    const after = await readSourceCounts();
    expect(after.accepted).toBe(before.accepted);
    expect(after.rejected).toBe(before.rejected);
    expect(after.ingest).toBe(before.ingest);
    expect(after.session_features).toBe(before.session_features);
    expect(after.session_behavioural_features_v0_2).toBe(before.session_behavioural_features_v0_2);
  });
});

/* --------------------------------------------------------------------------
 * 18-21. Role privilege assertions (Hard Rule I + OD-7 + scorer/audit)
 * ------------------------------------------------------------------------ */

describe('PR#3 — role privilege assertions', () => {
  async function hasPriv(role: string, table: string, priv: string): Promise<boolean> {
    const r = await pool.query<{ allowed: boolean }>(
      `SELECT has_table_privilege($1::name, $2::regclass, $3::text) AS allowed`,
      [role, table, priv],
    );
    return r.rows[0]!.allowed;
  }

  it('Hard Rule I: buyerrecon_customer_api has ZERO SELECT on scoring_output_lane_b', async () => {
    expect(await hasPriv('buyerrecon_customer_api', 'scoring_output_lane_b', 'SELECT')).toBe(false);
  });

  it('OD-7 baseline: buyerrecon_customer_api has ZERO direct SELECT on scoring_output_lane_a (redacted view deferred)', async () => {
    expect(await hasPriv('buyerrecon_customer_api', 'scoring_output_lane_a', 'SELECT')).toBe(false);
  });

  it('buyerrecon_customer_api has no INSERT / UPDATE / DELETE on either lane table', async () => {
    for (const t of ['scoring_output_lane_a', 'scoring_output_lane_b']) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await hasPriv('buyerrecon_customer_api', t, p), `customer-api should not hold ${p} on ${t}`).toBe(false);
      }
    }
  });

  it('buyerrecon_scoring_worker has SELECT + INSERT + UPDATE on both lane tables', async () => {
    for (const t of ['scoring_output_lane_a', 'scoring_output_lane_b']) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE']) {
        expect(await hasPriv('buyerrecon_scoring_worker', t, p), `scorer should hold ${p} on ${t}`).toBe(true);
      }
    }
  });

  it('buyerrecon_internal_readonly has SELECT on both lane tables', async () => {
    expect(await hasPriv('buyerrecon_internal_readonly', 'scoring_output_lane_a', 'SELECT')).toBe(true);
    expect(await hasPriv('buyerrecon_internal_readonly', 'scoring_output_lane_b', 'SELECT')).toBe(true);
  });

  it('buyerrecon_internal_readonly has no INSERT / UPDATE / DELETE on either lane table', async () => {
    for (const t of ['scoring_output_lane_a', 'scoring_output_lane_b']) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await hasPriv('buyerrecon_internal_readonly', t, p), `readonly should not hold ${p} on ${t}`).toBe(false);
      }
    }
  });
});
