/**
 * Sprint 1 PR#11 — opt-in DB tests for the session-features extractor.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set. Seeds
 * accepted_events directly under a fresh disposable workspace
 * (`__test_ws_pr11__`), runs the extractor against real Postgres, and
 * asserts row-level facts including:
 *
 *   1. page-view-only session
 *   2. mixed session (page_view + cta_click + form_start + form_submit)
 *   3. multiple page paths → unique_path_count
 *   4. cross-workspace isolation (same session_id, different workspace)
 *   5. session_id='__server__' skipped
 *   6. legacy event_contract_version skipped
 *   7. non-browser event_origin skipped
 *   8. idempotent rerun
 *   9. rerun after a new event refreshes the same row
 *  10. extraction_version isolation (two versions → two rows)
 *  11. canonical_key_count_min/max
 *  12. first/last event_id deterministic tie-break
 *  13. candidate-window semantics: an older event outside the window for a
 *      session that was touched inside the window IS aggregated
 *  14. no mutation of accepted_events / rejected_events / ingest_requests
 *
 * Test boundary: workspace_id = '__test_ws_pr11__'. This is distinct from
 * the PR#8 boundary (`__test_ws_pr8__`) and the smoke boundary
 * (`buyerrecon_smoke_ws`), so PR#11 tests never collide.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  bootstrapTestDb,
  endTestPool,
  getTestPool,
} from './_setup.js';
import {
  EXTRACTION_SQL,
  runExtraction,
} from '../../../scripts/extract-session-features.js';
import { payloadSha256 } from '../../../src/collector/v1/payload-hash.js';
import { sha256Hex } from '../../../src/collector/v1/hash.js';

const TEST_WORKSPACE = '__test_ws_pr11__';
const TEST_WORKSPACE_OTHER = '__test_ws_pr11_other__';
const TEST_SITE = '__test_site_pr11__';
const TEST_EXTRACTION_VERSION = 'session-features-v0.1';
const TEST_EXTRACTION_VERSION_ALT = 'session-features-v0.2-rc';

let pool: Pool;

beforeAll(async () => {
  pool = getTestPool();
  await bootstrapTestDb(pool);
}, 30_000);

afterAll(async () => {
  await endTestPool(pool);
});

beforeEach(async () => {
  // Clean ONLY the PR#11 boundary. Do not touch other workspaces.
  await pool.query('DELETE FROM session_features WHERE workspace_id IN ($1, $2)', [
    TEST_WORKSPACE,
    TEST_WORKSPACE_OTHER,
  ]);
  await pool.query('DELETE FROM accepted_events WHERE workspace_id IN ($1, $2)', [
    TEST_WORKSPACE,
    TEST_WORKSPACE_OTHER,
  ]);
});

/* --------------------------------------------------------------------------
 * Seed helpers — test-only DML writes against accepted_events for fixture
 * setup. The PR#11 extractor under test NEVER writes to accepted_events.
 * ------------------------------------------------------------------------ */

interface SeedEvent {
  workspace_id?: string;
  site_id?: string;
  session_id: string;
  event_name: string;
  event_type?: string;          // 'page' for page_view, 'track' otherwise
  schema_key?: string;          // 'br.page' / 'br.cta' / 'br.form'
  event_origin?: string;        // 'browser' default
  event_contract_version?: string;
  consent_source?: string;
  page_url?: string | null;
  page_path?: string | null;
  client_event_id?: string;
  received_at?: Date;
  raw_overrides?: Record<string, unknown>;
  canonical_jsonb?: Record<string, unknown>;
}

async function seedAccepted(e: SeedEvent): Promise<{ event_id: number }> {
  const workspace_id = e.workspace_id ?? TEST_WORKSPACE;
  const site_id = e.site_id ?? TEST_SITE;
  const event_type = e.event_type ?? (e.event_name === 'page_view' ? 'page' : 'track');
  const schema_key = e.schema_key ?? (e.event_name === 'page_view' ? 'br.page' : 'br.cta');
  const event_origin = e.event_origin ?? 'browser';
  const event_contract_version = e.event_contract_version ?? 'event-contract-v0.1';
  const consent_source = e.consent_source ?? 'cmp';
  const page_url = e.page_url === undefined ? 'https://buyerrecon.com/' : e.page_url;
  const page_path = e.page_path === undefined ? '/' : e.page_path;
  const received_at = e.received_at ?? new Date();
  const raw: Record<string, unknown> = {
    event_name: e.event_name,
    event_type,
    event_origin,
    schema_key,
    schema_version: '1.0.0',
    client_event_id: e.client_event_id ?? null,
    session_id: e.session_id,
    page_url,
    page_path,
    consent_source,
    ...(e.raw_overrides ?? {}),
  };
  // 19-key canonical projection (default) — matches v1 collector's
  // buildCanonicalJsonb output shape; test seeds only need the shape.
  const canonical_jsonb = e.canonical_jsonb ?? {
    request_id: '00000000-0000-4000-8000-000000000111',
    workspace_id,
    site_id,
    client_event_id: e.client_event_id ?? null,
    event_name: e.event_name,
    event_type,
    event_origin,
    occurred_at: received_at.toISOString(),
    received_at: received_at.toISOString(),
    schema_key,
    schema_version: '1.0.0',
    id_format: 'uuidv4',
    traffic_class: 'unknown',
    session_id: e.session_id,
    session_seq: null,
    consent_state: 'granted',
    consent_source,
    tracking_mode: 'full',
    storage_mechanism: 'cookie',
  };

  const rawJson = JSON.stringify(raw);
  const result = await pool.query<{ event_id: number }>(
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
             $27::jsonb, $28)
     RETURNING event_id`,
    [
      site_id,
      'host.example',
      event_type,
      e.session_id,
      'br_test',
      received_at.getTime(),
      received_at,
      rawJson,
      'pr11-test',
      e.client_event_id ?? null,
      event_contract_version,
      '00000000-0000-4000-8000-000000000111',
      workspace_id,
      'pr11-validator-test',
      schema_key,
      '1.0.0',
      event_origin,
      'uuidv4',
      'unknown',
      payloadSha256(raw),
      Buffer.byteLength(rawJson, 'utf8'),
      sha256Hex(Buffer.from('pr11-test-ip')),
      'granted',
      consent_source,
      'full',
      'cookie',
      JSON.stringify(canonical_jsonb),
      false,
    ],
  );
  return { event_id: result.rows[0]!.event_id };
}

interface RowCounts {
  accepted: number;
  rejected: number;
  ingest: number;
}

async function readSourceTableCounts(): Promise<RowCounts> {
  const a = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM accepted_events`);
  const r = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM rejected_events`);
  const i = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ingest_requests`);
  return { accepted: a.rows[0]!.c, rejected: r.rows[0]!.c, ingest: i.rows[0]!.c };
}

async function extractDefault(workspace_id: string = TEST_WORKSPACE) {
  // Always scope by workspace_id so PR#11 dbtests never write session_features
  // for workspaces outside the __test_ws_pr11* boundary (no collateral writes
  // into buyerrecon_smoke_ws or __test_ws_pr8__).
  const now = new Date();
  const window_start = new Date(now.getTime() - 168 * 3600 * 1000);
  return runExtraction(pool, {
    workspace_id,
    site_id: null,
    window_start,
    window_end: now,
    extraction_version: TEST_EXTRACTION_VERSION,
  });
}

async function selectRow(workspace_id: string, session_id: string, extraction_version = TEST_EXTRACTION_VERSION) {
  const r = await pool.query(
    `SELECT *
       FROM session_features
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
        AND extraction_version = $4`,
    [workspace_id, TEST_SITE, session_id, extraction_version],
  );
  return r.rows[0] ?? null;
}

/* --------------------------------------------------------------------------
 * 1. page-view-only session
 * ------------------------------------------------------------------------ */

describe('PR#11 — page_view-only session', () => {
  it('produces one row with page_view_count = source_event_count = 3', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-pv-1', event_name: 'page_view', received_at: new Date(now - 600_000), page_path: '/a' });
    await seedAccepted({ session_id: 'sess-pv-1', event_name: 'page_view', received_at: new Date(now - 300_000), page_path: '/b' });
    await seedAccepted({ session_id: 'sess-pv-1', event_name: 'page_view', received_at: new Date(now - 60_000),  page_path: '/c' });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-pv-1');
    expect(row).not.toBeNull();
    expect(row.source_event_count).toBe(3);
    expect(row.page_view_count).toBe(3);
    expect(row.cta_click_count).toBe(0);
    expect(row.form_start_count).toBe(0);
    expect(row.form_submit_count).toBe(0);
    expect(row.unique_path_count).toBe(3);
    expect(row.has_cta_click).toBe(false);
    expect(row.has_form_start).toBe(false);
    expect(row.has_form_submit).toBe(false);
    expect(row.landing_page_path).toBe('/a');
    expect(row.last_page_path).toBe('/c');
    // pg returns BIGINT as string; coerce for the numeric assertion.
    expect(Number(row.session_duration_ms)).toBe(540_000);
  });
});

/* --------------------------------------------------------------------------
 * 2. mixed session
 * ------------------------------------------------------------------------ */

describe('PR#11 — mixed session', () => {
  it('counts page_view + cta_click + form_start + form_submit independently', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-mix-1', event_name: 'page_view', received_at: new Date(now - 600_000) });
    await seedAccepted({ session_id: 'sess-mix-1', event_name: 'cta_click', schema_key: 'br.cta', received_at: new Date(now - 500_000) });
    await seedAccepted({ session_id: 'sess-mix-1', event_name: 'cta_click', schema_key: 'br.cta', received_at: new Date(now - 400_000) });
    await seedAccepted({ session_id: 'sess-mix-1', event_name: 'form_start', schema_key: 'br.form', received_at: new Date(now - 300_000) });
    await seedAccepted({ session_id: 'sess-mix-1', event_name: 'form_submit', schema_key: 'br.form', received_at: new Date(now - 60_000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-mix-1');
    expect(row.source_event_count).toBe(5);
    expect(row.page_view_count).toBe(1);
    expect(row.cta_click_count).toBe(2);
    expect(row.form_start_count).toBe(1);
    expect(row.form_submit_count).toBe(1);
    expect(row.has_cta_click).toBe(true);
    expect(row.has_form_start).toBe(true);
    expect(row.has_form_submit).toBe(true);
    expect(row.event_name_counts).toEqual({
      page_view: 1,
      cta_click: 2,
      form_start: 1,
      form_submit: 1,
    });
    expect(row.schema_key_counts).toEqual({
      'br.page': 1,
      'br.cta': 2,
      'br.form': 2,
    });
    expect(row.consent_source_counts).toEqual({ cmp: 5 });
  });
});

/* --------------------------------------------------------------------------
 * 3. multiple page paths
 * ------------------------------------------------------------------------ */

describe('PR#11 — unique_path_count counts distinct page_path values, ignoring nulls', () => {
  it('three distinct paths = 3; same path twice = 1; null path counted as 0', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-paths-A', event_name: 'page_view', page_path: '/x', received_at: new Date(now - 300_000) });
    await seedAccepted({ session_id: 'sess-paths-A', event_name: 'page_view', page_path: '/y', received_at: new Date(now - 200_000) });
    await seedAccepted({ session_id: 'sess-paths-A', event_name: 'page_view', page_path: '/z', received_at: new Date(now - 100_000) });

    await seedAccepted({ session_id: 'sess-paths-B', event_name: 'page_view', page_path: '/repeat', received_at: new Date(now - 200_000) });
    await seedAccepted({ session_id: 'sess-paths-B', event_name: 'page_view', page_path: '/repeat', received_at: new Date(now - 100_000) });

    await seedAccepted({ session_id: 'sess-paths-C', event_name: 'page_view', page_path: null, received_at: new Date(now - 100_000) });

    await extractDefault();
    expect((await selectRow(TEST_WORKSPACE, 'sess-paths-A')).unique_path_count).toBe(3);
    expect((await selectRow(TEST_WORKSPACE, 'sess-paths-B')).unique_path_count).toBe(1);
    expect((await selectRow(TEST_WORKSPACE, 'sess-paths-C')).unique_path_count).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 4. same session_id across workspaces does NOT merge
 * ------------------------------------------------------------------------ */

describe('PR#11 — cross-workspace isolation', () => {
  it('same session_id under two workspace_ids produces two rows', async () => {
    const now = Date.now();
    await seedAccepted({ workspace_id: TEST_WORKSPACE,       session_id: 'sess-cross', event_name: 'page_view', received_at: new Date(now - 100_000) });
    await seedAccepted({ workspace_id: TEST_WORKSPACE_OTHER, session_id: 'sess-cross', event_name: 'page_view', received_at: new Date(now - 100_000) });

    await extractDefault(TEST_WORKSPACE);
    await extractDefault(TEST_WORKSPACE_OTHER);
    const a = await selectRow(TEST_WORKSPACE,       'sess-cross');
    const b = await selectRow(TEST_WORKSPACE_OTHER, 'sess-cross');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a.source_event_count).toBe(1);
    expect(b.source_event_count).toBe(1);
    expect(a.workspace_id).toBe(TEST_WORKSPACE);
    expect(b.workspace_id).toBe(TEST_WORKSPACE_OTHER);
  });
});

/* --------------------------------------------------------------------------
 * 5. session_id = '__server__' is skipped
 * ------------------------------------------------------------------------ */

describe('PR#11 — __server__ sentinel session is skipped', () => {
  it('no session_features row for __server__ even with v1 contract + browser origin', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: '__server__', event_name: 'page_view', received_at: new Date(now - 100_000) });
    await extractDefault();
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM session_features WHERE workspace_id = $1 AND session_id = $2`,
      [TEST_WORKSPACE, '__server__'],
    );
    expect(r.rows[0]!.c).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 6. legacy event_contract_version is skipped
 * ------------------------------------------------------------------------ */

describe('PR#11 — legacy event_contract_version is skipped', () => {
  it('legacy-thin-v2.0 events produce no session_features rows', async () => {
    const now = Date.now();
    await seedAccepted({
      session_id: 'sess-legacy',
      event_name: 'page_view',
      event_contract_version: 'legacy-thin-v2.0',
      received_at: new Date(now - 100_000),
    });
    await extractDefault();
    expect(await selectRow(TEST_WORKSPACE, 'sess-legacy')).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 7. non-browser event_origin is skipped
 * ------------------------------------------------------------------------ */

describe('PR#11 — non-browser event_origin is skipped', () => {
  it('event_origin=server is excluded from session_features', async () => {
    const now = Date.now();
    await seedAccepted({
      session_id: 'sess-server-origin',
      event_name: 'page_view',
      event_origin: 'server',
      received_at: new Date(now - 100_000),
    });
    await extractDefault();
    expect(await selectRow(TEST_WORKSPACE, 'sess-server-origin')).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 8. idempotent rerun
 * ------------------------------------------------------------------------ */

describe('PR#11 — idempotent rerun', () => {
  it('extracting twice over the same input produces no duplicate row; session_features_id stable; extracted_at advances', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-idem', event_name: 'page_view', received_at: new Date(now - 100_000) });

    await extractDefault();
    const first = await selectRow(TEST_WORKSPACE, 'sess-idem');
    expect(first).not.toBeNull();
    const firstId = first.session_features_id;
    const firstExtractedAt = new Date(first.extracted_at).getTime();

    // Ensure the second extraction has a strictly later NOW() value.
    await new Promise((r) => setTimeout(r, 20));

    await extractDefault();
    const second = await selectRow(TEST_WORKSPACE, 'sess-idem');
    expect(second.session_features_id).toBe(firstId);
    expect(new Date(second.extracted_at).getTime()).toBeGreaterThanOrEqual(firstExtractedAt);

    // Exactly one row for this session.
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM session_features WHERE workspace_id = $1 AND session_id = $2`,
      [TEST_WORKSPACE, 'sess-idem'],
    );
    expect(r.rows[0]!.c).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * 9. rerun after new event updates the same row
 * ------------------------------------------------------------------------ */

describe('PR#11 — rerun after late-arriving event refreshes the same row', () => {
  it('counts and last_seen_at update; row id unchanged', async () => {
    const baseNow = Date.now();
    await seedAccepted({ session_id: 'sess-late', event_name: 'page_view', received_at: new Date(baseNow - 600_000) });
    await extractDefault();
    const before = await selectRow(TEST_WORKSPACE, 'sess-late');
    expect(before.source_event_count).toBe(1);
    expect(before.has_cta_click).toBe(false);

    // Add a late-arriving cta_click.
    await seedAccepted({
      session_id: 'sess-late',
      event_name: 'cta_click',
      schema_key: 'br.cta',
      received_at: new Date(baseNow - 60_000),
    });

    await extractDefault();
    const after = await selectRow(TEST_WORKSPACE, 'sess-late');
    expect(after.session_features_id).toBe(before.session_features_id);
    expect(after.source_event_count).toBe(2);
    expect(after.cta_click_count).toBe(1);
    expect(after.has_cta_click).toBe(true);
    expect(new Date(after.last_seen_at).getTime()).toBeGreaterThan(new Date(before.last_seen_at).getTime());
  });
});

/* --------------------------------------------------------------------------
 * 10. extraction_version isolation
 * ------------------------------------------------------------------------ */

describe('PR#11 — extraction_version isolation', () => {
  it('two different extraction_versions produce two rows for the same session', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-ver', event_name: 'page_view', received_at: new Date(now - 100_000) });

    await extractDefault();
    await runExtraction(pool, {
      workspace_id: TEST_WORKSPACE,
      site_id: null,
      window_start: new Date(now - 168 * 3600 * 1000),
      window_end: new Date(now),
      extraction_version: TEST_EXTRACTION_VERSION_ALT,
    });

    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM session_features WHERE workspace_id = $1 AND session_id = $2`,
      [TEST_WORKSPACE, 'sess-ver'],
    );
    expect(r.rows[0]!.c).toBe(2);

    expect(await selectRow(TEST_WORKSPACE, 'sess-ver', TEST_EXTRACTION_VERSION)).not.toBeNull();
    expect(await selectRow(TEST_WORKSPACE, 'sess-ver', TEST_EXTRACTION_VERSION_ALT)).not.toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 11. canonical_key_count_min/max
 * ------------------------------------------------------------------------ */

describe('PR#11 — canonical_key_count min/max', () => {
  it('all-19-key canonical events produce min = max = 19', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-can', event_name: 'page_view', received_at: new Date(now - 200_000) });
    await seedAccepted({ session_id: 'sess-can', event_name: 'page_view', received_at: new Date(now - 100_000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-can');
    expect(row.canonical_key_count_min).toBe(19);
    expect(row.canonical_key_count_max).toBe(19);
  });
});

/* --------------------------------------------------------------------------
 * 12. first/last event_id deterministic tie-break
 * ------------------------------------------------------------------------ */

describe('PR#11 — first/last event_id deterministic tie-break on equal received_at', () => {
  it('when received_at is equal, lower event_id wins for "first" and higher wins for "last"', async () => {
    const ts = new Date(Date.now() - 100_000);
    const e1 = await seedAccepted({ session_id: 'sess-tie', event_name: 'page_view', received_at: ts, page_path: '/first' });
    const e2 = await seedAccepted({ session_id: 'sess-tie', event_name: 'page_view', received_at: ts, page_path: '/middle' });
    const e3 = await seedAccepted({ session_id: 'sess-tie', event_name: 'page_view', received_at: ts, page_path: '/last' });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-tie');
    // BIGSERIAL is monotonic, so e1.event_id < e2.event_id < e3.event_id.
    expect(Number(e1.event_id)).toBeLessThan(Number(e2.event_id));
    expect(Number(e2.event_id)).toBeLessThan(Number(e3.event_id));
    // pg returns BIGINT as string; coerce both sides for comparison.
    expect(Number(row.first_event_id)).toBe(Number(e1.event_id));
    expect(Number(row.last_event_id)).toBe(Number(e3.event_id));
    expect(row.landing_page_path).toBe('/first');
    expect(row.last_page_path).toBe('/last');
  });
});

/* --------------------------------------------------------------------------
 * 13. candidate-window vs full-session aggregation
 * ------------------------------------------------------------------------ */

describe('PR#11 — candidate-window semantics', () => {
  it('an older event outside the candidate window IS aggregated when the session was touched inside the window', async () => {
    const now = Date.now();
    // Older event: 200 hours ago (outside the 168-hour candidate window).
    await seedAccepted({
      session_id: 'sess-cand',
      event_name: 'page_view',
      received_at: new Date(now - 200 * 3600 * 1000),
      page_path: '/old',
    });
    // Recent event: 1 hour ago (inside the 168-hour window) — this touches
    // the session and makes it a candidate.
    await seedAccepted({
      session_id: 'sess-cand',
      event_name: 'page_view',
      received_at: new Date(now - 3600 * 1000),
      page_path: '/new',
    });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-cand');
    expect(row).not.toBeNull();
    // Both events are aggregated, NOT just the in-window one.
    expect(row.source_event_count).toBe(2);
    expect(row.unique_path_count).toBe(2);
    expect(row.landing_page_path).toBe('/old');
    expect(row.last_page_path).toBe('/new');
  });

  it('a session whose only events are entirely outside the window is NOT extracted', async () => {
    const now = Date.now();
    await seedAccepted({
      session_id: 'sess-cand-outside',
      event_name: 'page_view',
      received_at: new Date(now - 200 * 3600 * 1000),
    });
    await extractDefault();
    expect(await selectRow(TEST_WORKSPACE, 'sess-cand-outside')).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 14. no mutation of source tables — global count guard
 * ------------------------------------------------------------------------ */

describe('PR#11 — extractor does NOT mutate accepted_events / rejected_events / ingest_requests', () => {
  it('row counts in those three tables are unchanged before/after extraction', async () => {
    const now = Date.now();
    await seedAccepted({ session_id: 'sess-mut', event_name: 'page_view', received_at: new Date(now - 100_000) });

    const before = await readSourceTableCounts();
    await extractDefault();
    await extractDefault();                          // run twice to confirm rerun safety
    const after = await readSourceTableCounts();

    expect(after.accepted).toBe(before.accepted);
    expect(after.rejected).toBe(before.rejected);
    expect(after.ingest).toBe(before.ingest);
  });
});

/* --------------------------------------------------------------------------
 * 15. SQL string sanity check (defence in depth — same as the pure test,
 *      run against the imported string under the real DB suite too).
 * ------------------------------------------------------------------------ */

describe('PR#11 — EXTRACTION_SQL no banned scoring identifiers (DB-suite parity check)', () => {
  const BANNED = [
    'risk_score', 'buyer_score', 'intent_score', 'bot_score', 'human_score',
    'classification', 'recommended_action', 'confidence_band',
    'is_bot', 'is_agent', 'ai_agent',
    'lead_quality', 'crm', 'company_enrichment', 'ip_enrichment',
  ];
  for (const banned of BANNED) {
    it(`SQL has no \`${banned}\``, () => {
      expect(EXTRACTION_SQL).not.toMatch(new RegExp(`\\b${banned}\\b`, 'i'));
    });
  }
});
