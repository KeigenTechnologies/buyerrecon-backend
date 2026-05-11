/**
 * Sprint 2 PR#1 — opt-in DB tests for behavioural_features_v0.2 extractor.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set. Seeds
 * accepted_events directly under a fresh disposable workspace
 * (`__test_ws_pr1_behavioural__`), runs the extractor against real
 * Postgres, and asserts row-level facts including:
 *
 *   1.  page-view-only session
 *   2.  cta-after-pageview session
 *   3.  immediate-cta session (ms_from_consent_to_first_cta)
 *   4.  form_start before cta
 *   5.  form_submit without prior form_start
 *   6.  multiple pageviews → ms_between_pageviews_p50
 *   7.  pageview burst within 10 seconds
 *   8.  max_events_per_second
 *   9.  sub_200ms_transition_count
 *  10.  interaction_density_bucket
 *  11.  scroll_depth_bucket_before_first_cta NULL + not_extractable
 *  12.  multi-session isolation
 *  13.  cross-workspace isolation
 *  14.  cross-site isolation (same session_id under two sites does not merge)
 *  15.  candidate-window vs full-session aggregation (event outside window)
 *  16.  late-event rerun updates same row (same behavioural_features_id)
 *  17.  source tables unchanged
 *  18.  feature_presence_map is a JSONB object with all 12 keys
 *  19.  feature_source_map is a JSONB object
 *  20.  no scoring columns present on the table
 *  21.  idempotent rerun
 *  22.  no refresh_loop column (D-3: deferred to PR#2)
 *
 * Test boundary: `__test_ws_pr1_behavioural__`. Distinct from PR#8
 * (`__test_ws_pr8__`), PR#11 (`__test_ws_pr11__`), and the smoke
 * boundary (`buyerrecon_smoke_ws`) so PR#1 tests never collide.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { bootstrapTestDb, endTestPool, getTestPool } from './_setup.js';
import {
  EXTRACTION_SQL,
  EXPECTED_FEATURE_COUNT_V0_2,
  runExtraction,
} from '../../../scripts/extract-behavioural-features.js';
import { payloadSha256 } from '../../../src/collector/v1/payload-hash.js';
import { sha256Hex } from '../../../src/collector/v1/hash.js';

const TEST_WORKSPACE = '__test_ws_pr1_behavioural__';
const TEST_WORKSPACE_OTHER = '__test_ws_pr1_behavioural_other__';
const TEST_SITE = '__test_site_pr1_behavioural__';
const TEST_SITE_OTHER = '__test_site_pr1_behavioural_other__';
const TEST_FEATURE_VERSION = 'behavioural-features-v0.2';

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
    'DELETE FROM session_behavioural_features_v0_2 WHERE workspace_id IN ($1, $2)',
    [TEST_WORKSPACE, TEST_WORKSPACE_OTHER],
  );
  await pool.query(
    'DELETE FROM accepted_events WHERE workspace_id IN ($1, $2)',
    [TEST_WORKSPACE, TEST_WORKSPACE_OTHER],
  );
});

/* --------------------------------------------------------------------------
 * Seed helpers — test-only DML against accepted_events. The PR#1 extractor
 * under test NEVER writes to accepted_events.
 * ------------------------------------------------------------------------ */

interface SeedEvent {
  workspace_id?: string;
  site_id?: string;
  session_id: string;
  event_name: string;
  event_type?: string;
  schema_key?: string;
  event_origin?: string;
  event_contract_version?: string;
  consent_state?: string | null;
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
  const schema_key =
    e.schema_key ?? (e.event_name === 'page_view' ? 'br.page' : 'br.cta');
  const event_origin = e.event_origin ?? 'browser';
  const event_contract_version = e.event_contract_version ?? 'event-contract-v0.1';
  const consent_state = e.consent_state === undefined ? 'granted' : e.consent_state;
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
  const canonical_jsonb = e.canonical_jsonb ?? {
    request_id: '00000000-0000-4000-8000-000000000222',
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
    consent_state: consent_state ?? 'granted',
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
      'br_test_pr1',
      received_at.getTime(),
      received_at,
      rawJson,
      'pr1-behavioural-test',
      e.client_event_id ?? null,
      event_contract_version,
      '00000000-0000-4000-8000-000000000222',
      workspace_id,
      'pr1-validator-test',
      schema_key,
      '1.0.0',
      event_origin,
      'uuidv4',
      'unknown',
      payloadSha256(raw),
      Buffer.byteLength(rawJson, 'utf8'),
      sha256Hex(Buffer.from('pr1-test-ip')),
      consent_state,
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
  session_features: number;
}

async function readSourceTableCounts(): Promise<RowCounts> {
  const a = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM accepted_events');
  const r = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM rejected_events');
  const i = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM ingest_requests');
  const s = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM session_features');
  return {
    accepted: a.rows[0]!.c,
    rejected: r.rows[0]!.c,
    ingest: i.rows[0]!.c,
    session_features: s.rows[0]!.c,
  };
}

async function extractDefault(workspace_id: string = TEST_WORKSPACE) {
  const now = new Date();
  const window_start = new Date(now.getTime() - 168 * 3600 * 1000);
  return runExtraction(pool, {
    workspace_id,
    site_id: null,
    window_start,
    window_end: now,
    feature_version: TEST_FEATURE_VERSION,
  });
}

async function selectRow(
  workspace_id: string,
  session_id: string,
  site_id: string = TEST_SITE,
  feature_version: string = TEST_FEATURE_VERSION,
): Promise<Record<string, unknown> | null> {
  const r = await pool.query(
    `SELECT * FROM session_behavioural_features_v0_2
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
        AND feature_version = $4`,
    [workspace_id, site_id, session_id, feature_version],
  );
  return r.rows[0] ?? null;
}

/* --------------------------------------------------------------------------
 * 1. page-view-only session
 * ------------------------------------------------------------------------ */

describe('PR#1 — page_view-only session', () => {
  it('produces a row with no interactions, page_view_count derived correctly via source_event_count', async () => {
    const now = Date.now();
    await seedAccepted({
      session_id: 'sess-pv-only',
      event_name: 'page_view',
      received_at: new Date(now - 600_000),
      page_path: '/a',
    });
    await seedAccepted({
      session_id: 'sess-pv-only',
      event_name: 'page_view',
      received_at: new Date(now - 300_000),
      page_path: '/b',
    });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-pv-only');
    expect(row).not.toBeNull();
    expect(row!.source_event_count).toBe(2);
    expect(row!.dwell_ms_before_first_action).toBeNull();
    expect(row!.ms_from_consent_to_first_cta).toBeNull();
    expect(row!.has_form_submit_without_prior_form_start).toBe(false);
    expect(row!.first_form_start_precedes_first_cta).toBe(false);
    expect(row!.form_start_count_before_first_cta).toBe(0);
    expect(row!.form_submit_count_before_first_form_start).toBe(0);
    expect(row!.interaction_density_bucket).toBe('0');
    expect(row!.scroll_depth_bucket_before_first_cta).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 2. cta-after-pageview session (dwell_ms + ms_from_consent_to_first_cta)
 * ------------------------------------------------------------------------ */

describe('PR#1 — cta-after-pageview session', () => {
  it('produces non-null dwell_ms_before_first_action and ms_from_consent_to_first_cta', async () => {
    const now = Date.now();
    await seedAccepted({
      session_id: 'sess-cta-1',
      event_name: 'page_view',
      received_at: new Date(now - 60_000),
    });
    await seedAccepted({
      session_id: 'sess-cta-1',
      event_name: 'cta_click',
      received_at: new Date(now - 55_000),
    });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-cta-1');
    expect(row).not.toBeNull();
    expect(row!.dwell_ms_before_first_action).not.toBeNull();
    expect(Number(row!.dwell_ms_before_first_action)).toBeGreaterThanOrEqual(4900);
    expect(Number(row!.dwell_ms_before_first_action)).toBeLessThanOrEqual(5100);
    expect(row!.ms_from_consent_to_first_cta).not.toBeNull();
    expect(row!.interaction_density_bucket).toBe('1-2');
  });
});

/* --------------------------------------------------------------------------
 * 3. immediate-cta session (sub-1000ms from consent to first CTA)
 * ------------------------------------------------------------------------ */

describe('PR#1 — immediate-cta session', () => {
  it('produces ms_from_consent_to_first_cta < 1000', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({
      session_id: 'sess-immediate-cta',
      event_name: 'page_view',
      received_at: new Date(t),
    });
    await seedAccepted({
      session_id: 'sess-immediate-cta',
      event_name: 'cta_click',
      received_at: new Date(t + 200),
    });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-immediate-cta');
    expect(row).not.toBeNull();
    expect(Number(row!.ms_from_consent_to_first_cta)).toBeLessThan(1000);
  });
});

/* --------------------------------------------------------------------------
 * 4. form_start before cta
 * ------------------------------------------------------------------------ */

describe('PR#1 — form_start before cta', () => {
  it('first_form_start_precedes_first_cta is TRUE and count >= 1', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-fs-before-cta', event_name: 'page_view', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-fs-before-cta', event_name: 'form_start', received_at: new Date(t + 1000) });
    await seedAccepted({ session_id: 'sess-fs-before-cta', event_name: 'cta_click',  received_at: new Date(t + 2000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-fs-before-cta');
    expect(row).not.toBeNull();
    expect(row!.first_form_start_precedes_first_cta).toBe(true);
    expect(row!.form_start_count_before_first_cta).toBe(1);
  });

  it('when no cta_click exists, first_form_start_precedes_first_cta is TRUE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-fs-no-cta', event_name: 'page_view', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-fs-no-cta', event_name: 'form_start', received_at: new Date(t + 1000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-fs-no-cta');
    expect(row).not.toBeNull();
    expect(row!.first_form_start_precedes_first_cta).toBe(true);
    expect(row!.form_start_count_before_first_cta).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * 5. form_submit without prior form_start
 * ------------------------------------------------------------------------ */

describe('PR#1 — form_submit without prior form_start', () => {
  it('has_form_submit_without_prior_form_start is TRUE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-submit-no-start', event_name: 'page_view',  received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-submit-no-start', event_name: 'form_submit', received_at: new Date(t + 1000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-submit-no-start');
    expect(row).not.toBeNull();
    expect(row!.has_form_submit_without_prior_form_start).toBe(true);
    expect(row!.form_submit_count_before_first_form_start).toBe(1);
  });

  it('when form_start precedes form_submit, has_form_submit_without_prior_form_start is FALSE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-submit-after-start', event_name: 'page_view',  received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-submit-after-start', event_name: 'form_start',  received_at: new Date(t + 1000) });
    await seedAccepted({ session_id: 'sess-submit-after-start', event_name: 'form_submit', received_at: new Date(t + 2000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-submit-after-start');
    expect(row).not.toBeNull();
    expect(row!.has_form_submit_without_prior_form_start).toBe(false);
    expect(row!.form_submit_count_before_first_form_start).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 6. multiple pageviews → ms_between_pageviews_p50
 * ------------------------------------------------------------------------ */

describe('PR#1 — ms_between_pageviews_p50', () => {
  it('computes p50 across deltas; NULL when fewer than 2 pageviews', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-p50', event_name: 'page_view', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-p50', event_name: 'page_view', received_at: new Date(t + 1000) });
    await seedAccepted({ session_id: 'sess-p50', event_name: 'page_view', received_at: new Date(t + 3000) });
    await seedAccepted({ session_id: 'sess-p50', event_name: 'page_view', received_at: new Date(t + 6000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-p50');
    expect(row).not.toBeNull();
    // Deltas in ms: 1000, 2000, 3000 — p50 = 2000
    // (BIGINT comes back from pg as string; coerce.)
    expect(Number(row!.ms_between_pageviews_p50)).toBe(2000);
  });

  it('single page_view → ms_between_pageviews_p50 IS NULL', async () => {
    await seedAccepted({ session_id: 'sess-single-pv', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-single-pv');
    expect(row).not.toBeNull();
    expect(row!.ms_between_pageviews_p50).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * 7. pageview burst within 10 seconds
 * ------------------------------------------------------------------------ */

describe('PR#1 — pageview_burst_count_10s', () => {
  it('detects 4 pageviews within 10 seconds', async () => {
    const t = Date.now() - 60_000;
    for (let i = 0; i < 4; i++) {
      await seedAccepted({
        session_id: 'sess-burst',
        event_name: 'page_view',
        received_at: new Date(t + i * 2000),
        page_path: `/p${i}`,
      });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-burst');
    expect(row).not.toBeNull();
    expect(Number(row!.pageview_burst_count_10s)).toBeGreaterThanOrEqual(4);
  });
});

/* --------------------------------------------------------------------------
 * 8. max_events_per_second
 * ------------------------------------------------------------------------ */

describe('PR#1 — max_events_per_second', () => {
  it('counts events grouped into per-second buckets', async () => {
    const t = Date.parse('2026-05-11T12:00:00.000Z');
    // 3 events in the same second
    await seedAccepted({ session_id: 'sess-eps', event_name: 'page_view', received_at: new Date(t + 100) });
    await seedAccepted({ session_id: 'sess-eps', event_name: 'page_view', received_at: new Date(t + 200) });
    await seedAccepted({ session_id: 'sess-eps', event_name: 'page_view', received_at: new Date(t + 300) });
    // 1 event in the next second
    await seedAccepted({ session_id: 'sess-eps', event_name: 'page_view', received_at: new Date(t + 1100) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-eps');
    expect(row).not.toBeNull();
    expect(Number(row!.max_events_per_second)).toBe(3);
  });
});

/* --------------------------------------------------------------------------
 * 9. sub_200ms_transition_count
 * ------------------------------------------------------------------------ */

describe('PR#1 — sub_200ms_transition_count', () => {
  it('counts transitions where delta < 200ms', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-sub200', event_name: 'page_view', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-sub200', event_name: 'page_view', received_at: new Date(t + 50)  }); // < 200
    await seedAccepted({ session_id: 'sess-sub200', event_name: 'page_view', received_at: new Date(t + 150) }); // < 200 (delta 100)
    await seedAccepted({ session_id: 'sess-sub200', event_name: 'page_view', received_at: new Date(t + 5000) }); // >= 200

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-sub200');
    expect(row).not.toBeNull();
    expect(Number(row!.sub_200ms_transition_count)).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 10. interaction_density_bucket
 * ------------------------------------------------------------------------ */

describe('PR#1 — interaction_density_bucket', () => {
  it('zero interactions → "0"', async () => {
    await seedAccepted({ session_id: 'sess-bucket-0', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-bucket-0');
    expect(row).not.toBeNull();
    expect(row!.interaction_density_bucket).toBe('0');
  });

  it('1-2 interactions → "1-2"', async () => {
    await seedAccepted({ session_id: 'sess-bucket-12', event_name: 'page_view' });
    await seedAccepted({ session_id: 'sess-bucket-12', event_name: 'cta_click' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-bucket-12');
    expect(row).not.toBeNull();
    expect(row!.interaction_density_bucket).toBe('1-2');
  });

  it('3-5 interactions → "3-5"', async () => {
    await seedAccepted({ session_id: 'sess-bucket-35', event_name: 'page_view' });
    for (let i = 0; i < 3; i++) {
      await seedAccepted({ session_id: 'sess-bucket-35', event_name: 'cta_click' });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-bucket-35');
    expect(row).not.toBeNull();
    expect(row!.interaction_density_bucket).toBe('3-5');
  });

  it('11+ interactions → ">10"', async () => {
    await seedAccepted({ session_id: 'sess-bucket-gt10', event_name: 'page_view' });
    for (let i = 0; i < 11; i++) {
      await seedAccepted({ session_id: 'sess-bucket-gt10', event_name: 'cta_click' });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-bucket-gt10');
    expect(row).not.toBeNull();
    expect(row!.interaction_density_bucket).toBe('>10');
  });
});

/* --------------------------------------------------------------------------
 * 11. scroll_depth_bucket_before_first_cta — NULL + not_extractable
 * ------------------------------------------------------------------------ */

describe('PR#1 — scroll_depth_bucket_before_first_cta', () => {
  it('is NULL in v0.2 and feature_source_map marks not_extractable', async () => {
    await seedAccepted({ session_id: 'sess-scroll', event_name: 'page_view' });
    await seedAccepted({ session_id: 'sess-scroll', event_name: 'cta_click' });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-scroll');
    expect(row).not.toBeNull();
    expect(row!.scroll_depth_bucket_before_first_cta).toBeNull();
    const sourceMap = row!.feature_source_map as Record<string, string>;
    expect(sourceMap['scroll_depth_bucket_before_first_cta']).toBe('not_extractable');
    const presenceMap = row!.feature_presence_map as Record<string, string>;
    expect(presenceMap['scroll_depth_bucket_before_first_cta']).toBe('not_extractable');
  });
});

/* --------------------------------------------------------------------------
 * 12-14. Isolation tests
 * ------------------------------------------------------------------------ */

describe('PR#1 — multi-session isolation', () => {
  it('produces one row per session', async () => {
    await seedAccepted({ session_id: 'sess-iso-a', event_name: 'page_view' });
    await seedAccepted({ session_id: 'sess-iso-b', event_name: 'page_view' });
    await extractDefault();
    const r = await pool.query<{ c: number }>(
      'SELECT COUNT(*)::int AS c FROM session_behavioural_features_v0_2 WHERE workspace_id = $1',
      [TEST_WORKSPACE],
    );
    expect(r.rows[0]!.c).toBe(2);
  });
});

describe('PR#1 — cross-workspace isolation', () => {
  it('same session_id in two workspaces produces 2 distinct rows', async () => {
    await seedAccepted({
      workspace_id: TEST_WORKSPACE,
      session_id: 'sess-cross-ws',
      event_name: 'page_view',
    });
    await seedAccepted({
      workspace_id: TEST_WORKSPACE_OTHER,
      session_id: 'sess-cross-ws',
      event_name: 'page_view',
    });
    await extractDefault(TEST_WORKSPACE);
    await extractDefault(TEST_WORKSPACE_OTHER);
    const a = await selectRow(TEST_WORKSPACE, 'sess-cross-ws');
    const b = await selectRow(TEST_WORKSPACE_OTHER, 'sess-cross-ws');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.behavioural_features_id).not.toBe(b!.behavioural_features_id);
  });
});

describe('PR#1 — cross-site isolation (same session_id, different sites do not merge)', () => {
  it('produces 2 distinct rows for same session_id under different sites', async () => {
    await seedAccepted({
      site_id: TEST_SITE,
      session_id: 'sess-cross-site',
      event_name: 'page_view',
    });
    await seedAccepted({
      site_id: TEST_SITE_OTHER,
      session_id: 'sess-cross-site',
      event_name: 'page_view',
    });
    await extractDefault();
    const a = await selectRow(TEST_WORKSPACE, 'sess-cross-site', TEST_SITE);
    const b = await selectRow(TEST_WORKSPACE, 'sess-cross-site', TEST_SITE_OTHER);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.behavioural_features_id).not.toBe(b!.behavioural_features_id);
  });
});

/* --------------------------------------------------------------------------
 * 15. candidate-window vs full-session aggregation
 * ------------------------------------------------------------------------ */

describe('PR#1 — candidate-window vs full-session aggregation', () => {
  it('aggregates events outside window for sessions touched in window', async () => {
    const now = Date.now();
    // OLD event (300 days ago) — outside the default 168-hour window
    await seedAccepted({
      session_id: 'sess-cw-1',
      event_name: 'page_view',
      received_at: new Date(now - 300 * 86400_000),
      page_path: '/old',
    });
    // RECENT event (1 hour ago) — inside the default window; makes the session a candidate
    await seedAccepted({
      session_id: 'sess-cw-1',
      event_name: 'page_view',
      received_at: new Date(now - 3600_000),
      page_path: '/recent',
    });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-cw-1');
    expect(row).not.toBeNull();
    // Both events should be aggregated (full-session)
    expect(row!.source_event_count).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 16. late-event rerun updates same row
 * ------------------------------------------------------------------------ */

describe('PR#1 — late-event rerun updates same row', () => {
  it('rerun after a new event refreshes the same behavioural_features_id', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-late', event_name: 'page_view', received_at: new Date(t) });
    await extractDefault();
    const firstRow = await selectRow(TEST_WORKSPACE, 'sess-late');
    expect(firstRow).not.toBeNull();
    const firstId = firstRow!.behavioural_features_id;
    const firstCount = firstRow!.source_event_count;

    // Add a late event and rerun
    await seedAccepted({ session_id: 'sess-late', event_name: 'cta_click', received_at: new Date(t + 5000) });
    await extractDefault();
    const secondRow = await selectRow(TEST_WORKSPACE, 'sess-late');
    expect(secondRow).not.toBeNull();
    expect(secondRow!.behavioural_features_id).toBe(firstId);
    expect(Number(secondRow!.source_event_count)).toBe(Number(firstCount) + 1);
  });
});

/* --------------------------------------------------------------------------
 * 17. source tables unchanged
 * ------------------------------------------------------------------------ */

describe('PR#1 — source tables unchanged', () => {
  it('does not mutate accepted_events / rejected_events / ingest_requests / session_features', async () => {
    await seedAccepted({ session_id: 'sess-src-1', event_name: 'page_view' });
    await seedAccepted({ session_id: 'sess-src-1', event_name: 'cta_click' });

    const before = await readSourceTableCounts();
    await extractDefault();
    const after = await readSourceTableCounts();
    expect(after.accepted).toBe(before.accepted);
    expect(after.rejected).toBe(before.rejected);
    expect(after.ingest).toBe(before.ingest);
    expect(after.session_features).toBe(before.session_features);
  });
});

/* --------------------------------------------------------------------------
 * 18-19. feature_presence_map + feature_source_map shapes
 * ------------------------------------------------------------------------ */

describe('PR#1 — feature_presence_map + feature_source_map shapes', () => {
  it('feature_presence_map is a JSONB object with 12 keys', async () => {
    await seedAccepted({ session_id: 'sess-map-shape', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-map-shape');
    expect(row).not.toBeNull();
    const presence = row!.feature_presence_map as Record<string, string>;
    expect(typeof presence).toBe('object');
    expect(Object.keys(presence).length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    // Every value must be one of present | missing | not_extractable
    for (const v of Object.values(presence)) {
      expect(['present', 'missing', 'not_extractable']).toContain(v);
    }
  });

  it('feature_source_map is a JSONB object with 12 keys', async () => {
    await seedAccepted({ session_id: 'sess-source-shape', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-source-shape');
    expect(row).not.toBeNull();
    const source = row!.feature_source_map as Record<string, string>;
    expect(typeof source).toBe('object');
    expect(Object.keys(source).length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    for (const v of Object.values(source)) {
      expect(['server_derived', 'not_extractable']).toContain(v);
    }
  });

  it('valid_feature_count + missing_feature_count = EXPECTED_FEATURE_COUNT_V0_2', async () => {
    await seedAccepted({ session_id: 'sess-counts', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-counts');
    expect(row).not.toBeNull();
    expect(Number(row!.valid_feature_count) + Number(row!.missing_feature_count)).toBe(
      EXPECTED_FEATURE_COUNT_V0_2,
    );
  });
});

/* --------------------------------------------------------------------------
 * 20. no scoring columns present
 * ------------------------------------------------------------------------ */

describe('PR#1 — no scoring columns present on session_behavioural_features_v0_2', () => {
  it('information_schema does not show any scoring/judgement column', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'session_behavioural_features_v0_2'
          AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed)'`,
    );
    expect(r.rows.length).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 21. idempotent rerun
 * ------------------------------------------------------------------------ */

describe('PR#1 — idempotent rerun', () => {
  it('rerun produces same row count, stable behavioural_features_id', async () => {
    await seedAccepted({ session_id: 'sess-idemp', event_name: 'page_view' });
    await extractDefault();
    const before = await pool.query<{ id: string; n: number }>(
      `SELECT behavioural_features_id::text AS id, COUNT(*) OVER () AS n
         FROM session_behavioural_features_v0_2 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    await extractDefault();
    const after = await pool.query<{ id: string; n: number }>(
      `SELECT behavioural_features_id::text AS id, COUNT(*) OVER () AS n
         FROM session_behavioural_features_v0_2 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    expect(before.rows[0]!.n).toBe(after.rows[0]!.n);
    expect(before.rows[0]!.id).toBe(after.rows[0]!.id);
  });
});

/* --------------------------------------------------------------------------
 * 22. no refresh_loop column (D-3 deferred to PR#2)
 * ------------------------------------------------------------------------ */

describe('PR#1 — no refresh_loop column (D-3 deferred to PR#2)', () => {
  it('information_schema does not show any refresh_loop column', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'session_behavioural_features_v0_2'
          AND column_name LIKE 'refresh_loop%'`,
    );
    expect(r.rows.length).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * Sanity: SQL string sweep at runtime (defence-in-depth)
 * ------------------------------------------------------------------------ */

describe('PR#1 — EXTRACTION_SQL runtime sanity', () => {
  it('writes only to session_behavioural_features_v0_2', () => {
    const inserts = EXTRACTION_SQL.match(/INSERT INTO\s+(\w+)/g) ?? [];
    expect(inserts.length).toBe(1);
    expect(inserts[0]!).toMatch(/INSERT INTO session_behavioural_features_v0_2/);
  });
});
