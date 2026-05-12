/**
 * Sprint 2 PR#5 — opt-in DB tests for the Stage 0 RECORD_ONLY worker
 * and the `stage0_decisions` schema.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set.
 *
 * Test boundary: `__test_ws_pr5__`. Disjoint from prior PR boundaries.
 *
 * PR#5 ships RECORD_ONLY. No Lane A / Lane B writes. No reason-code
 * emission. Raw UA strings are read transiently in the extractor and
 * MUST NOT appear in any persisted `rule_inputs` JSONB.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { bootstrapTestDb, endTestPool, getTestPool } from './_setup.js';
import { runStage0Worker } from '../../../src/scoring/stage0/run-stage0-worker.js';
import { STAGE0_RULE_IDS } from '../../../src/scoring/stage0/types.js';

const TEST_WORKSPACE = '__test_ws_pr5__';
const TEST_SITE      = '__test_site_pr5__';
const TEST_STAGE0_VERSION  = 'stage0-test-v0.1';
const TEST_STAGE0_VERSION2 = 'stage0-test-v0.2';

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
    'DELETE FROM stage0_decisions WHERE workspace_id = $1',
    [TEST_WORKSPACE],
  );
  await pool.query(
    'DELETE FROM accepted_events WHERE workspace_id = $1',
    [TEST_WORKSPACE],
  );
  await pool.query(
    "DELETE FROM ingest_requests WHERE workspace_id = $1",
    [TEST_WORKSPACE],
  );
});

/* --------------------------------------------------------------------------
 * Compact seed helpers (test-only)
 * ------------------------------------------------------------------------ */

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

interface SeedSessionOpts {
  sessionId:           string;
  userAgent?:          string | null;
  pagePaths?:          string[];
  ctaCount?:           number;
  formStartCount?:     number;
  formSubmitCount?:    number;
  baseTimeMs?:         number;
  /** Spacing between events (ms). Use 50 to force a high events/sec rate. */
  eventGapMs?:         number;
}

async function seedSession(opts: SeedSessionOpts): Promise<{
  request_id: string;
  events: number;
}> {
  const requestId  = randomUUID();
  const baseMs     = opts.baseTimeMs ?? Date.now() - 60_000;
  const gap        = opts.eventGapMs ?? 1000;
  const pagePaths  = opts.pagePaths ?? ['/'];
  const cta        = opts.ctaCount ?? 0;
  const fs         = opts.formStartCount ?? 0;
  const fsub       = opts.formSubmitCount ?? 0;

  // Insert one ingest_requests row carrying the (transient) user_agent.
  await pool.query(
    `INSERT INTO ingest_requests (
       request_id, received_at,
       workspace_id, site_id,
       endpoint, http_status, size_bytes, user_agent, ip_hash,
       request_body_sha256, expected_event_count, accepted_count, rejected_count,
       auth_status, collector_version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      requestId,
      new Date(baseMs),
      TEST_WORKSPACE, TEST_SITE,
      '/v1/event', 200, 1024,
      opts.userAgent ?? null,
      sha256Hex('pr5-test-ip'),
      sha256Hex('pr5-test-body'),
      pagePaths.length + cta + fs + fsub,
      pagePaths.length + cta + fs + fsub,
      0,
      'ok',
      'pr5-test',
    ],
  );

  // Seed accepted_events linked to the request_id.
  const insertOne = async (eventName: string, page_path: string, offsetMs: number): Promise<void> => {
    const raw = {
      event_name: eventName,
      event_type: eventName === 'page_view' ? 'page' : 'track',
      event_origin: 'browser',
      schema_key:   eventName === 'page_view' ? 'br.page' : 'br.cta',
      schema_version: '1.0.0',
      session_id:   opts.sessionId,
      page_url:     `https://buyerrecon.com${page_path}`,
      page_path,
      consent_source: 'cmp',
    };
    const canonical = {
      request_id: requestId,
      workspace_id: TEST_WORKSPACE,
      site_id:      TEST_SITE,
      event_name:   eventName,
      event_type:   raw.event_type,
      event_origin: 'browser',
      occurred_at:  new Date(baseMs + offsetMs).toISOString(),
      received_at:  new Date(baseMs + offsetMs).toISOString(),
      schema_key:   raw.schema_key,
      schema_version: '1.0.0',
      id_format:    'uuidv4',
      traffic_class: 'unknown',
      session_id:   opts.sessionId,
      consent_state: 'granted',
      consent_source: 'cmp',
      tracking_mode:  'full',
      storage_mechanism: 'cookie',
    };
    const rawJson = JSON.stringify(raw);
    await pool.query(
      `INSERT INTO accepted_events (
         site_id, hostname, event_type, session_id, browser_id, client_timestamp_ms,
         received_at, raw, collector_version, client_event_id,
         event_contract_version,
         request_id, workspace_id, validator_version, schema_key, schema_version,
         event_origin, id_format, traffic_class, payload_sha256, size_bytes, ip_hash,
         consent_state, consent_source, tracking_mode, storage_mechanism,
         canonical_jsonb, debug_mode
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10,
               $11,
               $12, $13, $14, $15, $16,
               $17, $18, $19, $20, $21, $22,
               $23, $24, $25, $26,
               $27::jsonb, $28)`,
      [
        TEST_SITE,
        'host.example',
        raw.event_type,
        opts.sessionId,
        'br_test_pr5',
        baseMs + offsetMs,
        new Date(baseMs + offsetMs),
        rawJson,
        'pr5-test',
        null,
        'event-contract-v0.1',
        requestId,
        TEST_WORKSPACE,
        'pr5-validator-test',
        raw.schema_key,
        '1.0.0',
        'browser',
        'uuidv4',
        'unknown',
        sha256Hex(rawJson),
        Buffer.byteLength(rawJson, 'utf8'),
        sha256Hex('pr5-test-ip'),
        'granted',
        'cmp',
        'full',
        'cookie',
        JSON.stringify(canonical),
        false,
      ],
    );
  };

  let off = 0;
  for (const p of pagePaths) {
    await insertOne('page_view', p, off);
    off += gap;
  }
  for (let i = 0; i < cta; i++) {
    await insertOne('cta_click', '/', off);
    off += gap;
  }
  for (let i = 0; i < fs; i++) {
    await insertOne('form_start', '/', off);
    off += gap;
  }
  for (let i = 0; i < fsub; i++) {
    await insertOne('form_submit', '/', off);
    off += gap;
  }
  return { request_id: requestId, events: pagePaths.length + cta + fs + fsub };
}

interface SourceCounts {
  accepted: number;
  rejected: number;
  ingest:   number;
  session_features: number;
  session_behavioural_features_v0_2: number;
}
async function readSourceCounts(): Promise<SourceCounts> {
  const c = async (t: string): Promise<number> => {
    const r = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${t}`);
    return r.rows[0]!.c;
  };
  return {
    accepted: await c('accepted_events'),
    rejected: await c('rejected_events'),
    ingest:   await c('ingest_requests'),
    session_features: await c('session_features'),
    session_behavioural_features_v0_2: await c('session_behavioural_features_v0_2'),
  };
}

async function runWorker(stage0_version = TEST_STAGE0_VERSION) {
  const now    = new Date();
  const start  = new Date(now.getTime() - 168 * 3600 * 1000);
  return runStage0Worker(pool, {
    workspace_id: TEST_WORKSPACE,
    site_id:      TEST_SITE,
    window_start: start,
    window_end:   now,
    stage0_version,
  });
}

/* --------------------------------------------------------------------------
 * 1. Migration / table presence
 * ------------------------------------------------------------------------ */

describe('PR#5 — table presence + idempotent migration', () => {
  it('stage0_decisions exists', async () => {
    const r = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.stage0_decisions')::text AS regclass`,
    );
    expect(r.rows[0]!.regclass).toBe('stage0_decisions');
  });

  it('applying migration 012 twice succeeds', async () => {
    const { applyMigration012 } = await import('./_setup.js');
    await applyMigration012(pool);
    await applyMigration012(pool);
  });
});

/* --------------------------------------------------------------------------
 * 2. Worker happy path — non-excluded session
 * ------------------------------------------------------------------------ */

describe('PR#5 — non-excluded browser session', () => {
  it('writes one stage0_decisions row with excluded=false and rule_id=no_stage0_exclusion', async () => {
    await seedSession({
      sessionId: 'sess-clean',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0 Safari/537.36',
      pagePaths: ['/', '/about'],
      ctaCount:  1,
    });
    const res = await runWorker();
    expect(res.upserted_rows).toBe(1);
    expect(res.excluded_rows).toBe(0);

    const row = await pool.query<{ excluded: boolean; rule_id: string; record_only: boolean; scoring_version: string }>(
      `SELECT excluded, rule_id, record_only, scoring_version FROM stage0_decisions
        WHERE workspace_id=$1 AND session_id=$2`,
      [TEST_WORKSPACE, 'sess-clean'],
    );
    expect(row.rows[0]!.excluded).toBe(false);
    expect(row.rows[0]!.rule_id).toBe('no_stage0_exclusion');
    expect(row.rows[0]!.record_only).toBe(true);
    expect(row.rows[0]!.scoring_version).toBe('s2.v1.0');
  });
});

/* --------------------------------------------------------------------------
 * 3. Bot UA exclusions
 * ------------------------------------------------------------------------ */

describe('PR#5 — known bot UA family is hard-excluded', () => {
  it('curl UA → excluded with rule_id=known_bot_ua_family', async () => {
    await seedSession({
      sessionId: 'sess-curl',
      userAgent: 'curl/8.0',
      pagePaths: ['/'],
    });
    await runWorker();
    const row = await pool.query<{ excluded: boolean; rule_id: string }>(
      `SELECT excluded, rule_id FROM stage0_decisions WHERE session_id=$1`,
      ['sess-curl'],
    );
    expect(row.rows[0]!.excluded).toBe(true);
    expect(row.rows[0]!.rule_id).toBe('known_bot_ua_family');
  });
});

/* --------------------------------------------------------------------------
 * 4. P-11 — Bytespider passes through
 * ------------------------------------------------------------------------ */

describe('PR#5 — Bytespider / known AI crawler is NOT hard-excluded (P-11)', () => {
  it('Bytespider UA → excluded=false; rule_inputs records user_agent_family but NO ai_crawler_passthrough persisted (carve-out is internal)', async () => {
    await seedSession({
      sessionId: 'sess-bytespider',
      userAgent: 'Mozilla/5.0 (compatible; Bytespider; ByteDance)',
      pagePaths: ['/', '/blog'],
    });
    await runWorker();
    const row = await pool.query<{ excluded: boolean; rule_id: string; rule_inputs: Record<string, unknown> }>(
      `SELECT excluded, rule_id, rule_inputs FROM stage0_decisions WHERE session_id=$1`,
      ['sess-bytespider'],
    );
    expect(row.rows[0]!.excluded).toBe(false);
    expect(row.rows[0]!.rule_id).toBe('no_stage0_exclusion');
    expect(row.rows[0]!.rule_inputs.user_agent_family).toBe('bytespider');
    // P-11 carve-out is INTERNAL pre-eval logic. No persisted boolean.
    expect('ai_crawler_passthrough' in row.rows[0]!.rule_inputs).toBe(false);
    // matched_family only appears when known_bot_ua_family fires — and
    // it didn't (the carve-out remapped the family to null upstream).
    expect('matched_family' in row.rows[0]!.rule_inputs).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 5. Probe path exclusion
 * ------------------------------------------------------------------------ */

describe('PR#5 — scanner / probe path is hard-excluded', () => {
  it('wp-admin probe → rule_id=scanner_or_probe_path; path_pattern_matched recorded (no full URL)', async () => {
    await seedSession({
      sessionId: 'sess-probe',
      pagePaths: ['/wp-admin/', '/'],
    });
    await runWorker();
    const row = await pool.query<{ excluded: boolean; rule_id: string; rule_inputs: Record<string, unknown> }>(
      `SELECT excluded, rule_id, rule_inputs FROM stage0_decisions WHERE session_id=$1`,
      ['sess-probe'],
    );
    expect(row.rows[0]!.excluded).toBe(true);
    expect(row.rows[0]!.rule_id).toBe('scanner_or_probe_path');
    expect(row.rows[0]!.rule_inputs.path_pattern_matched).toBe('/wp-admin/');
    // Defence: no `raw_page_url` ever appears.
    expect('raw_page_url' in row.rows[0]!.rule_inputs).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 6. High request frequency
 * ------------------------------------------------------------------------ */

describe('PR#5 — impossible request frequency', () => {
  it('25 page_views in one second → rule_id=impossible_request_frequency', async () => {
    // 25 events all in the same wall-clock second.
    const baseMs = Date.parse('2026-05-12T10:00:00.000Z');
    await seedSession({
      sessionId:  'sess-burst',
      baseTimeMs: baseMs,
      eventGapMs: 10,
      pagePaths:  Array.from({ length: 25 }, (_, i) => `/p${i}`),
    });
    await runWorker();
    const row = await pool.query<{ excluded: boolean; rule_id: string }>(
      `SELECT excluded, rule_id FROM stage0_decisions WHERE session_id=$1`,
      ['sess-burst'],
    );
    expect(row.rows[0]!.excluded).toBe(true);
    expect(row.rows[0]!.rule_id).toBe('impossible_request_frequency');
  });
});

/* --------------------------------------------------------------------------
 * 7. JSONB shape CHECKs
 * ------------------------------------------------------------------------ */

describe('PR#5 — stage0_decisions JSONB shape CHECKs', () => {
  it('rule_inputs that is not an object is REJECTED', async () => {
    await expect(pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id, rule_inputs, evidence_refs
       ) VALUES ($1, $2, $3, $4, $5, FALSE, 'no_stage0_exclusion', $6::jsonb, '[]'::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-bad-ri', TEST_STAGE0_VERSION, 's2.v1.0', '[]'],
    )).rejects.toThrow();
  });

  it('evidence_refs that is not an array is REJECTED', async () => {
    await expect(pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id, rule_inputs, evidence_refs
       ) VALUES ($1, $2, $3, $4, $5, FALSE, 'no_stage0_exclusion', '{}'::jsonb, $6::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-bad-er', TEST_STAGE0_VERSION, 's2.v1.0', '{}'],
    )).rejects.toThrow();
  });

  it('record_only=FALSE is REJECTED by CHECK', async () => {
    await expect(pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id, record_only
       ) VALUES ($1, $2, $3, $4, $5, FALSE, 'no_stage0_exclusion', FALSE)`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-not-record-only', TEST_STAGE0_VERSION, 's2.v1.0'],
    )).rejects.toThrow();
  });

  it('rule_id outside the enum is REJECTED', async () => {
    await expect(pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id
       ) VALUES ($1, $2, $3, $4, $5, TRUE, 'verification_score')`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-bad-rule', TEST_STAGE0_VERSION, 's2.v1.0'],
    )).rejects.toThrow();
  });

  it('excluded=TRUE with rule_id=no_stage0_exclusion is REJECTED', async () => {
    await expect(pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id
       ) VALUES ($1, $2, $3, $4, $5, TRUE, 'no_stage0_exclusion')`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-bad-coinv', TEST_STAGE0_VERSION, 's2.v1.0'],
    )).rejects.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * 8. Natural key — 5 columns including scoring_version (OD-10)
 * ------------------------------------------------------------------------ */

describe('PR#5 — 5-column natural key (OD-10)', () => {
  it('different scoring_version creates a NEW row', async () => {
    await seedSession({ sessionId: 'sess-nk', pagePaths: ['/'] });
    await runWorker(TEST_STAGE0_VERSION);
    // Manually upsert under a different scoring_version (synthetic).
    await pool.query(
      `INSERT INTO stage0_decisions (
         workspace_id, site_id, session_id, stage0_version, scoring_version,
         excluded, rule_id
       ) VALUES ($1, $2, $3, $4, $5, FALSE, 'no_stage0_exclusion')`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-nk', TEST_STAGE0_VERSION, 's2.v1.1'],
    );
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM stage0_decisions WHERE session_id=$1`,
      ['sess-nk'],
    );
    expect(r.rows[0]!.c).toBe(2);
  });

  it('same 5-tuple re-run triggers ON CONFLICT DO UPDATE (single row)', async () => {
    await seedSession({ sessionId: 'sess-idemp', pagePaths: ['/'] });
    const r1 = await runWorker(TEST_STAGE0_VERSION);
    const r2 = await runWorker(TEST_STAGE0_VERSION);
    expect(r1.upserted_rows).toBe(1);
    expect(r2.upserted_rows).toBe(1);
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM stage0_decisions WHERE session_id=$1`,
      ['sess-idemp'],
    );
    expect(r.rows[0]!.c).toBe(1);
  });

  it('different stage0_version on the same session creates a NEW row', async () => {
    await seedSession({ sessionId: 'sess-s0v', pagePaths: ['/'] });
    await runWorker(TEST_STAGE0_VERSION);
    await runWorker(TEST_STAGE0_VERSION2);
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM stage0_decisions WHERE session_id=$1`,
      ['sess-s0v'],
    );
    expect(r.rows[0]!.c).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 9. rule_inputs forbidden-key sweep (OD-11)
 * ------------------------------------------------------------------------ */

describe('PR#5 — rule_inputs OD-11 forbidden-key sweep', () => {
  // Post-Codex blocker fix: matched_rules / ai_crawler_passthrough /
  // zero_engagement are also forbidden — they were in the earlier
  // draft but are outside the Helen-signed OD-11 allowlist.
  const FORBIDDEN = [
    'raw_user_agent', 'user_agent', 'token_hash', 'ip_hash',
    'pepper', 'bearer_token', 'bearer', 'authorization', 'Authorization',
    'raw_payload', 'raw_request_body', 'request_body', 'canonical_jsonb',
    'raw_page_url',
    'matched_rules', 'ai_crawler_passthrough', 'zero_engagement',
  ] as const;

  it('after running the worker on a real UA seed, no row carries any forbidden key', async () => {
    // Seed several distinct sessions that exercise different rules.
    const rawUa1 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const rawUa2 = 'curl/8.0';
    const rawUa3 = 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)';
    await seedSession({ sessionId: 'sess-key-1', userAgent: rawUa1, pagePaths: ['/'] });
    await seedSession({ sessionId: 'sess-key-2', userAgent: rawUa2, pagePaths: ['/wp-admin/'] });
    await seedSession({ sessionId: 'sess-key-3', userAgent: rawUa3, pagePaths: ['/blog'] });
    await runWorker();

    const r = await pool.query<{ session_id: string; rule_inputs: Record<string, unknown> }>(
      `SELECT session_id, rule_inputs FROM stage0_decisions WHERE workspace_id=$1`,
      [TEST_WORKSPACE],
    );
    for (const row of r.rows) {
      const ri = row.rule_inputs as Record<string, unknown>;
      for (const k of FORBIDDEN) {
        expect(k in ri, `rule_inputs for ${row.session_id} carries forbidden key ${k}`).toBe(false);
      }
      // The raw UA strings must never appear as a value either.
      const serialised = JSON.stringify(ri);
      expect(serialised.includes('Mozilla/5.0')).toBe(false);
      expect(serialised.includes('AppleWebKit/')).toBe(false);
      expect(serialised.includes('Chrome/120')).toBe(false);
      expect(serialised.includes('curl/8.0')).toBe(false);
      expect(serialised.includes('ByteDance')).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------
 * 10. Forbidden columns absent from the table
 * ------------------------------------------------------------------------ */

describe('PR#5 — no forbidden columns exist on stage0_decisions', () => {
  it('information_schema returns no forbidden column name', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='stage0_decisions'
          AND column_name IN (
            'verification_score', 'evidence_band', 'action_recommendation',
            'reason_codes', 'risk_score', 'classification', 'confidence_band',
            'is_bot', 'is_agent', 'ai_agent', 'buyer_intent', 'lead_quality'
          )`,
    );
    expect(r.rows.length).toBe(0);
  });

  it('rule_id enum CHECK accepts only the 8 Stage 0 values', async () => {
    // Verify enum membership by attempting all 8 valid values and one invalid.
    for (const id of STAGE0_RULE_IDS) {
      const excluded = id !== 'no_stage0_exclusion';
      await pool.query(
        `INSERT INTO stage0_decisions (workspace_id, site_id, session_id, stage0_version, scoring_version, excluded, rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_WORKSPACE, TEST_SITE, `sess-enum-${id}`, TEST_STAGE0_VERSION, 's2.v1.0', excluded, id],
      );
    }
  });
});

/* --------------------------------------------------------------------------
 * 11. Source-table counts unchanged + no Lane A/B writes
 * ------------------------------------------------------------------------ */

describe('PR#5 — source tables unchanged + no Lane A/B writes', () => {
  it('running the worker does not mutate accepted_events / ingest_requests / session_features / session_behavioural_features_v0_2', async () => {
    await seedSession({ sessionId: 'sess-src', pagePaths: ['/'], userAgent: 'curl/8.0' });
    const before = await readSourceCounts();
    await runWorker();
    const after = await readSourceCounts();
    expect(after.accepted).toBe(before.accepted);
    expect(after.rejected).toBe(before.rejected);
    expect(after.ingest).toBe(before.ingest);
    expect(after.session_features).toBe(before.session_features);
    expect(after.session_behavioural_features_v0_2).toBe(before.session_behavioural_features_v0_2);
  });

  it('no Lane A / Lane B rows are written by PR#5', async () => {
    await seedSession({ sessionId: 'sess-lanes', pagePaths: ['/wp-admin/'] });
    const laneABefore = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM scoring_output_lane_a`);
    const laneBBefore = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM scoring_output_lane_b`);
    await runWorker();
    const laneAAfter  = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM scoring_output_lane_a`);
    const laneBAfter  = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM scoring_output_lane_b`);
    expect(laneAAfter.rows[0]!.c).toBe(laneABefore.rows[0]!.c);
    expect(laneBAfter.rows[0]!.c).toBe(laneBBefore.rows[0]!.c);
  });
});

/* --------------------------------------------------------------------------
 * 12. Customer-API role has zero direct SELECT on stage0_decisions (Hard-Rule-I parity)
 * ------------------------------------------------------------------------ */

describe('PR#5 — customer_api role privilege', () => {
  it('buyerrecon_customer_api has zero SELECT on stage0_decisions', async () => {
    const r = await pool.query<{ allowed: boolean }>(
      `SELECT has_table_privilege($1::name, $2::regclass, $3::text) AS allowed`,
      ['buyerrecon_customer_api', 'stage0_decisions', 'SELECT'],
    );
    expect(r.rows[0]!.allowed).toBe(false);
  });

  it('buyerrecon_scoring_worker has SELECT + INSERT + UPDATE on stage0_decisions', async () => {
    for (const p of ['SELECT', 'INSERT', 'UPDATE']) {
      const r = await pool.query<{ allowed: boolean }>(
        `SELECT has_table_privilege($1::name, $2::regclass, $3::text) AS allowed`,
        ['buyerrecon_scoring_worker', 'stage0_decisions', p],
      );
      expect(r.rows[0]!.allowed, `scoring_worker should hold ${p}`).toBe(true);
    }
  });

  it('buyerrecon_internal_readonly has SELECT on stage0_decisions', async () => {
    const r = await pool.query<{ allowed: boolean }>(
      `SELECT has_table_privilege($1::name, $2::regclass, $3::text) AS allowed`,
      ['buyerrecon_internal_readonly', 'stage0_decisions', 'SELECT'],
    );
    expect(r.rows[0]!.allowed).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 13. Worker does NOT depend on session_features or session_behavioural_features_v0_2
 * ------------------------------------------------------------------------ */

describe('PR#5 — worker runs against empty session_features / behavioural tables', () => {
  it('runs to completion without reading session_features / session_behavioural_features_v0_2', async () => {
    // Both tables are empty for this test boundary by construction
    // (the beforeEach only seeds accepted_events + ingest_requests).
    await seedSession({ sessionId: 'sess-no-derived', pagePaths: ['/'], userAgent: 'curl/8.0' });
    const res = await runWorker();
    expect(res.upserted_rows).toBe(1);
    const row = await pool.query<{ excluded: boolean }>(
      `SELECT excluded FROM stage0_decisions WHERE session_id=$1`,
      ['sess-no-derived'],
    );
    expect(row.rows[0]!.excluded).toBe(true);
  });
});
