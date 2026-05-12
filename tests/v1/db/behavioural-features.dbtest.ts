/**
 * Sprint 2 PR#1 + PR#2 — opt-in DB tests for behavioural_features_v0.3 extractor.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set. Seeds
 * accepted_events directly under a fresh disposable workspace
 * (`__test_ws_pr1_behavioural__`), runs the extractor against real
 * Postgres, and asserts row-level facts.
 *
 * PR#1 baseline scenarios (1-21): unchanged in behaviour; uses
 * TEST_FEATURE_VERSION='behavioural-features-v0.3' now (default version).
 * The maps assert 13 keys in v0.3.
 *
 * PR#2 refresh-loop scenarios (23+):
 *   - N boundary (1, 2, 3 consecutive same-path page_views)
 *   - W boundary (span <= 10000ms vs > 10000ms)
 *   - K boundary (0, 1, 2 actions between adjacent same-path PVs)
 *   - alternating paths A/B/A → no candidate
 *   - two streaks per session
 *   - late-event rerun preserves refresh-loop fields
 *   - candidate-window vs full-session for refresh-loop
 *   - SDK refresh-loop hint ignored (server-only derivation)
 *   - v0.3 valid + missing = 13, v0.2 row still = 12
 *   - source tables unchanged
 *
 * Test boundary: `__test_ws_pr1_behavioural__`. Distinct from PR#8
 * (`__test_ws_pr8__`), PR#11 (`__test_ws_pr11__`), and the smoke
 * boundary (`buyerrecon_smoke_ws`) so PR#1/PR#2 tests never collide.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { bootstrapTestDb, endTestPool, getTestPool } from './_setup.js';
import {
  EXTRACTION_SQL,
  EXPECTED_FEATURE_COUNT_V0_2,
  EXPECTED_FEATURE_COUNT_V0_3,
  REFRESH_LOOP_MAX_ACTIONS_BETWEEN,
  REFRESH_LOOP_MAX_SPAN_MS,
  REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS,
  runExtraction,
} from '../../../scripts/extract-behavioural-features.js';
import { payloadSha256 } from '../../../src/collector/v1/payload-hash.js';
import { sha256Hex } from '../../../src/collector/v1/hash.js';

const TEST_WORKSPACE = '__test_ws_pr1_behavioural__';
const TEST_WORKSPACE_OTHER = '__test_ws_pr1_behavioural_other__';
const TEST_SITE = '__test_site_pr1_behavioural__';
const TEST_SITE_OTHER = '__test_site_pr1_behavioural_other__';
const TEST_FEATURE_VERSION = 'behavioural-features-v0.3';
const TEST_FEATURE_VERSION_V0_2 = 'behavioural-features-v0.2';

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

describe('PR#1 — feature_presence_map + feature_source_map shapes (v0.3 default)', () => {
  it('feature_presence_map is a JSONB object with 13 keys (v0.3)', async () => {
    await seedAccepted({ session_id: 'sess-map-shape', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-map-shape');
    expect(row).not.toBeNull();
    const presence = row!.feature_presence_map as Record<string, string>;
    expect(typeof presence).toBe('object');
    expect(Object.keys(presence).length).toBe(EXPECTED_FEATURE_COUNT_V0_3);
    for (const v of Object.values(presence)) {
      expect(['present', 'missing', 'not_extractable']).toContain(v);
    }
    expect(presence['refresh_loop_candidate']).toBe('present');
  });

  it('feature_source_map is a JSONB object with 13 keys (v0.3)', async () => {
    await seedAccepted({ session_id: 'sess-source-shape', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-source-shape');
    expect(row).not.toBeNull();
    const source = row!.feature_source_map as Record<string, string>;
    expect(typeof source).toBe('object');
    expect(Object.keys(source).length).toBe(EXPECTED_FEATURE_COUNT_V0_3);
    for (const v of Object.values(source)) {
      expect(['server_derived', 'not_extractable']).toContain(v);
    }
    expect(source['refresh_loop_candidate']).toBe('server_derived');
  });

  it('valid_feature_count + missing_feature_count = EXPECTED_FEATURE_COUNT_V0_3 (13)', async () => {
    await seedAccepted({ session_id: 'sess-counts', event_name: 'page_view' });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-counts');
    expect(row).not.toBeNull();
    expect(Number(row!.valid_feature_count) + Number(row!.missing_feature_count)).toBe(
      EXPECTED_FEATURE_COUNT_V0_3,
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
 * 22. PR#2 refresh-loop columns present (NOT refresh_loop_observed)
 * ------------------------------------------------------------------------ */

describe('PR#2 — refresh-loop columns present and shaped correctly', () => {
  it('information_schema shows all 8 refresh-loop columns and NO refresh_loop_observed', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'session_behavioural_features_v0_2'
          AND (
                column_name LIKE 'refresh_loop%'
             OR column_name LIKE 'same_path_repeat%'
             OR column_name = 'repeat_pageview_candidate_count'
          )
        ORDER BY column_name`,
    );
    const names = new Set(r.rows.map((row) => row.column_name));
    for (const c of [
      'refresh_loop_candidate',
      'refresh_loop_count',
      'refresh_loop_source',
      'same_path_repeat_count',
      'same_path_repeat_max_span_ms',
      'same_path_repeat_min_delta_ms',
      'same_path_repeat_median_delta_ms',
      'repeat_pageview_candidate_count',
    ]) {
      expect(names.has(c)).toBe(true);
    }
    expect(names.has('refresh_loop_observed')).toBe(false);
  });

  it('no scoring/judgement columns leaked alongside the new factual columns', async () => {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'session_behavioural_features_v0_2'
          AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed|refresh_loop_observed)'`,
    );
    expect(r.rows.length).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 23. PR#2 — N threshold (consecutive same-path page_views)
 * ------------------------------------------------------------------------ */

describe('PR#2 — N threshold (min consecutive same-path page_views = 3)', () => {
  it('N=1 single page_view → refresh_loop_candidate FALSE, same_path_repeat_count=1', async () => {
    await seedAccepted({
      session_id: 'sess-n1',
      event_name: 'page_view',
      page_path: '/a',
    });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-n1');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.same_path_repeat_count).toBe(1);
    expect(row!.repeat_pageview_candidate_count).toBe(0);
    expect(row!.refresh_loop_source).toBe('server_derived');
  });

  it('N=2 two same-path PVs within W → still below N=3, refresh_loop_candidate FALSE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-n2', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-n2', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 500) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-n2');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.same_path_repeat_count).toBe(2);
    expect(row!.repeat_pageview_candidate_count).toBe(0);
  });

  it('N=3 three same-path PVs within W → refresh_loop_candidate TRUE', async () => {
    const t = Date.now() - 60_000;
    for (let i = 0; i < 3; i++) {
      await seedAccepted({
        session_id: 'sess-n3',
        event_name: 'page_view',
        page_path: '/a',
        received_at: new Date(t + i * 500),
      });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-n3');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(row!.same_path_repeat_count).toBe(3);
    expect(row!.repeat_pageview_candidate_count).toBe(3);
  });

  it('constants exposed for tests match D-3 (N=3, W=10000, K=1)', () => {
    expect(REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS).toBe(3);
    expect(REFRESH_LOOP_MAX_SPAN_MS).toBe(10000);
    expect(REFRESH_LOOP_MAX_ACTIONS_BETWEEN).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * 24. PR#2 — W threshold (max run span in ms)
 * ------------------------------------------------------------------------ */

describe('PR#2 — W threshold (max run span <= 10000ms)', () => {
  it('span < W → candidate TRUE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-w-in', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-w-in', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 2000) });
    await seedAccepted({ session_id: 'sess-w-in', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 4000) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-w-in');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(Number(row!.same_path_repeat_max_span_ms)).toBe(4000);
  });

  it('span > W → candidate FALSE despite N>=3', async () => {
    const t = Date.now() - 600_000;
    // 3 same-path PVs spanning 15s — exceeds W=10000ms.
    await seedAccepted({ session_id: 'sess-w-over', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-w-over', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 7000) });
    await seedAccepted({ session_id: 'sess-w-over', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 15000) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-w-over');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.same_path_repeat_count).toBe(3);
    expect(Number(row!.same_path_repeat_max_span_ms)).toBe(15000);
  });
});

/* --------------------------------------------------------------------------
 * 25. PR#2 — K threshold (max actions between adjacent same-path PVs)
 * ------------------------------------------------------------------------ */

describe('PR#2 — K threshold (max actions between adjacent same-path PVs <= 1)', () => {
  it('K=0 (no actions between) → candidate TRUE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-k0', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-k0', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 500) });
    await seedAccepted({ session_id: 'sess-k0', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 1000) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-k0');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
  });

  it('K=1 (one action between adjacent PVs) → candidate TRUE (boundary inclusive)', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-k1', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-k1', event_name: 'cta_click', received_at: new Date(t + 100) });
    await seedAccepted({ session_id: 'sess-k1', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 300) });
    await seedAccepted({ session_id: 'sess-k1', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 600) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-k1');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
  });

  it('K=2 (two actions between adjacent PVs) → candidate FALSE', async () => {
    const t = Date.now() - 60_000;
    await seedAccepted({ session_id: 'sess-k2', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-k2', event_name: 'cta_click', received_at: new Date(t + 100) });
    await seedAccepted({ session_id: 'sess-k2', event_name: 'form_start', received_at: new Date(t + 150) });
    await seedAccepted({ session_id: 'sess-k2', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 300) });
    await seedAccepted({ session_id: 'sess-k2', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 600) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-k2');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(false);
    // Run length is still 3 (path didn't change), but the K filter rejects it.
    expect(row!.same_path_repeat_count).toBe(3);
    expect(row!.refresh_loop_count).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 25b. PR#2 — same-received_at tie cases (Codex BLOCKER fix)
 *
 * accepted_events.event_id is BIGSERIAL, so seeding rows sequentially via
 * sequential `await seedAccepted(...)` calls assigns monotonically
 * increasing event_id values. That gives us deterministic event_id
 * ordering without altering the seed helper. The window ordering in
 * the extractor is (received_at ASC, event_id ASC), so when timestamps
 * tie, the earlier-seeded row is "before" the later-seeded row.
 * ------------------------------------------------------------------------ */

describe('PR#2 — same-received_at ties resolved by event_id (Codex BLOCKER fix)', () => {
  it('A. action ordered AFTER PV1 and BEFORE PV2 by event_id at same timestamp → action counts; K=1 streak is candidate', async () => {
    const t = Date.now() - 60_000;
    const T = new Date(t);
    // Seed order = event_id order: PV1 < action < PV2 < PV3.
    await seedAccepted({ session_id: 'sess-tie-a', event_name: 'page_view', page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-a', event_name: 'cta_click',                       received_at: T });
    await seedAccepted({ session_id: 'sess-tie-a', event_name: 'page_view', page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-a', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 100) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-tie-a');
    expect(row).not.toBeNull();
    // 1 action between PV1 and PV2, 0 between PV2 and PV3 → max actions in run = 1 (K=1 passes).
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(row!.same_path_repeat_count).toBe(3);
  });

  it('B. action ordered AFTER PV2 by event_id at same timestamp → does NOT count between PV1 and PV2; candidate TRUE', async () => {
    const t = Date.now() - 60_000;
    const T = new Date(t);
    // Seed order = event_id order: PV1 < PV2 < action < PV3.
    // The action's event_id is greater than PV2.event_id, so it is NOT
    // in the (PV1, PV2) interval. PV2 → PV3 spans a later timestamp,
    // and the action at T is strictly before PV3 → action counts as 1
    // between PV2 and PV3 (K=1 still passes).
    await seedAccepted({ session_id: 'sess-tie-b', event_name: 'page_view', page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-b', event_name: 'page_view', page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-b', event_name: 'cta_click',                       received_at: T });
    await seedAccepted({ session_id: 'sess-tie-b', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 100) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-tie-b');
    expect(row).not.toBeNull();
    // PV1→PV2: 0 actions. PV2→PV3: 1 action. Max = 1 ≤ K=1 → candidate.
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(row!.same_path_repeat_count).toBe(3);
  });

  it('C. two actions between PV1 and PV2 by event_id at same timestamp → K=2 fails; candidate FALSE; run length unchanged', async () => {
    const t = Date.now() - 60_000;
    const T = new Date(t);
    // Seed order = event_id order: PV1 < action1 < action2 < PV2 < PV3.
    await seedAccepted({ session_id: 'sess-tie-c', event_name: 'page_view',  page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-c', event_name: 'cta_click',                        received_at: T });
    await seedAccepted({ session_id: 'sess-tie-c', event_name: 'form_start',                       received_at: T });
    await seedAccepted({ session_id: 'sess-tie-c', event_name: 'page_view',  page_path: '/a', received_at: T });
    await seedAccepted({ session_id: 'sess-tie-c', event_name: 'page_view',  page_path: '/a', received_at: new Date(t + 100) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-tie-c');
    expect(row).not.toBeNull();
    // PV1→PV2: 2 actions > K=1 → run fails candidate filter.
    // PV2→PV3: 0 actions. Run length stays 3, but K rejects → not a candidate.
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.same_path_repeat_count).toBe(3);
  });
});

/* --------------------------------------------------------------------------
 * 26. PR#2 — alternating paths (A/B/A/B/A → no candidate)
 * ------------------------------------------------------------------------ */

describe('PR#2 — alternating paths break same-path runs', () => {
  it('A/B/A/B/A → 5 page_views, max same-path run length = 1, no candidate', async () => {
    const t = Date.now() - 60_000;
    const paths = ['/a', '/b', '/a', '/b', '/a'];
    for (let i = 0; i < paths.length; i++) {
      await seedAccepted({
        session_id: 'sess-alt',
        event_name: 'page_view',
        page_path: paths[i]!,
        received_at: new Date(t + i * 500),
      });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-alt');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.same_path_repeat_count).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * 27. PR#2 — two streaks in same session
 * ------------------------------------------------------------------------ */

describe('PR#2 — two streaks in same session', () => {
  it('two distinct same-path runs each >= N → refresh_loop_count = 2', async () => {
    const t = Date.now() - 60_000;
    // Streak 1 on /a (3 PVs, span 1000ms, no actions between)
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 500) });
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 1000) });
    // Path change to /b (single PV — breaks run)
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/b', received_at: new Date(t + 2000) });
    // Streak 2 on /c (3 PVs, span 1000ms)
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 3000) });
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 3500) });
    await seedAccepted({ session_id: 'sess-two-streaks', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 4000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-two-streaks');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(2);
    // repeat_pageview_candidate_count sums PV counts across both streaks: 3 + 3.
    expect(row!.repeat_pageview_candidate_count).toBe(6);
    // same_path_repeat_count is max run length across all runs.
    expect(row!.same_path_repeat_count).toBe(3);
  });
});

/* --------------------------------------------------------------------------
 * 28. PR#2 — same_path_repeat_median_delta_ms is POOLED median (not median of medians)
 * ------------------------------------------------------------------------ */

describe('PR#2 — pooled median of same-path deltas (NOT median of per-run medians)', () => {
  it('two runs with different delta distributions → median over pooled deltas', async () => {
    const t = Date.now() - 60_000;
    // Run 1 on /a: deltas 100ms, 100ms
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 100) });
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 200) });
    // Path change
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/b', received_at: new Date(t + 5000) });
    // Run 2 on /c: deltas 5000ms, 5000ms
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 10000) });
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 15000) });
    await seedAccepted({ session_id: 'sess-median', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 20000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-median');
    expect(row).not.toBeNull();
    // Pooled deltas: [100, 100, 5000, 5000] → median = (100 + 5000) / 2 = 2550.
    // (Median-of-per-run-medians would be (100 + 5000)/2 = 2550 also here,
    // but the SQL is verified to do the pooled computation; cross-check with
    // a more asymmetric case below.)
    expect(Number(row!.same_path_repeat_median_delta_ms)).toBe(2550);
  });

  it('asymmetric run sizes → pooled median differs from median-of-medians', async () => {
    const t = Date.now() - 60_000;
    // Run 1 on /a: 4 PVs → 3 deltas of 100ms each (median 100ms).
    for (let i = 0; i < 4; i++) {
      await seedAccepted({
        session_id: 'sess-median-asym',
        event_name: 'page_view',
        page_path: '/a',
        received_at: new Date(t + i * 100),
      });
    }
    // Path change
    await seedAccepted({
      session_id: 'sess-median-asym',
      event_name: 'page_view',
      page_path: '/b',
      received_at: new Date(t + 10000),
    });
    // Run 2 on /c: 2 PVs → 1 delta of 10000ms (per-run median 10000ms).
    await seedAccepted({ session_id: 'sess-median-asym', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 20000) });
    await seedAccepted({ session_id: 'sess-median-asym', event_name: 'page_view', page_path: '/c', received_at: new Date(t + 30000) });

    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-median-asym');
    expect(row).not.toBeNull();
    // Pooled deltas across the session: [100, 100, 100, 10000] → median = (100 + 100) / 2 = 100.
    // Median-of-per-run-medians would be (100 + 10000) / 2 = 5050 — different.
    expect(Number(row!.same_path_repeat_median_delta_ms)).toBe(100);
  });
});

/* --------------------------------------------------------------------------
 * 29. PR#2 — SDK refresh-loop hint ignored (D-4 Option α)
 * ------------------------------------------------------------------------ */

describe('PR#2 — SDK refresh-loop hint is IGNORED (server-only derivation)', () => {
  it('SDK hint refresh_loop=true in raw is not trusted; candidate determined by server algorithm', async () => {
    const t = Date.now() - 60_000;
    // Only 2 same-path PVs — server algorithm would say NOT a candidate (N<3).
    // SDK lies and emits refresh_loop=true in raw. Server must ignore.
    await seedAccepted({
      session_id: 'sess-sdk-lie',
      event_name: 'page_view',
      page_path: '/a',
      received_at: new Date(t),
      raw_overrides: { refresh_loop: true, is_refresh_loop: true },
    });
    await seedAccepted({
      session_id: 'sess-sdk-lie',
      event_name: 'page_view',
      page_path: '/a',
      received_at: new Date(t + 500),
      raw_overrides: { refresh_loop: true },
    });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-sdk-lie');
    expect(row).not.toBeNull();
    // Despite SDK lie, the server says: 2 PVs < N=3 → not a candidate.
    expect(row!.refresh_loop_candidate).toBe(false);
    expect(row!.refresh_loop_count).toBe(0);
    expect(row!.refresh_loop_source).toBe('server_derived');
  });

  it('SDK hint refresh_loop=false but server algorithm sees 3+ same-path PVs → server wins (TRUE)', async () => {
    const t = Date.now() - 60_000;
    for (let i = 0; i < 3; i++) {
      await seedAccepted({
        session_id: 'sess-sdk-deny',
        event_name: 'page_view',
        page_path: '/a',
        received_at: new Date(t + i * 500),
        raw_overrides: { refresh_loop: false, is_refresh_loop: false },
      });
    }
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-sdk-deny');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(row!.refresh_loop_source).toBe('server_derived');
  });
});

/* --------------------------------------------------------------------------
 * 30. PR#2 — candidate-window vs full-session (refresh-loop)
 * ------------------------------------------------------------------------ */

describe('PR#2 — refresh-loop derivation runs full-session, not window-bounded', () => {
  it('a candidate streak entirely OUTSIDE the window still produces refresh_loop_candidate=TRUE when session is a candidate (recent event)', async () => {
    const now = Date.now();
    // Three same-path PVs ~300 days ago — outside the default 168-hour window.
    const old = now - 300 * 86400_000;
    await seedAccepted({ session_id: 'sess-rl-cw', event_name: 'page_view', page_path: '/a', received_at: new Date(old) });
    await seedAccepted({ session_id: 'sess-rl-cw', event_name: 'page_view', page_path: '/a', received_at: new Date(old + 500) });
    await seedAccepted({ session_id: 'sess-rl-cw', event_name: 'page_view', page_path: '/a', received_at: new Date(old + 1000) });
    // A recent event makes the session a candidate (1 hour ago).
    await seedAccepted({ session_id: 'sess-rl-cw', event_name: 'page_view', page_path: '/b', received_at: new Date(now - 3600_000) });
    await extractDefault();
    const row = await selectRow(TEST_WORKSPACE, 'sess-rl-cw');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
    expect(row!.refresh_loop_count).toBe(1);
    expect(Number(row!.source_event_count)).toBe(4);
  });
});

/* --------------------------------------------------------------------------
 * 31. PR#2 — late-event rerun preserves refresh-loop fields
 * ------------------------------------------------------------------------ */

describe('PR#2 — late-event rerun refreshes refresh-loop fields on the same row', () => {
  it('rerun after a new same-path PV updates refresh_loop_count without changing behavioural_features_id', async () => {
    const t = Date.now() - 60_000;
    // Seed 2 same-path PVs first — not yet a candidate (N=2 < 3).
    await seedAccepted({ session_id: 'sess-rl-late', event_name: 'page_view', page_path: '/a', received_at: new Date(t) });
    await seedAccepted({ session_id: 'sess-rl-late', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 500) });
    await extractDefault();
    const first = await selectRow(TEST_WORKSPACE, 'sess-rl-late');
    expect(first).not.toBeNull();
    expect(first!.refresh_loop_candidate).toBe(false);
    const firstId = first!.behavioural_features_id;

    // Add a third same-path PV — push the run to N=3, within W.
    await seedAccepted({ session_id: 'sess-rl-late', event_name: 'page_view', page_path: '/a', received_at: new Date(t + 1000) });
    await extractDefault();
    const second = await selectRow(TEST_WORKSPACE, 'sess-rl-late');
    expect(second).not.toBeNull();
    expect(second!.behavioural_features_id).toBe(firstId);
    expect(second!.refresh_loop_candidate).toBe(true);
    expect(second!.refresh_loop_count).toBe(1);
    expect(second!.same_path_repeat_count).toBe(3);
  });
});

/* --------------------------------------------------------------------------
 * 32. PR#2 — source tables unchanged
 * ------------------------------------------------------------------------ */

describe('PR#2 — source tables unchanged after refresh-loop extraction', () => {
  it('does not mutate accepted_events / rejected_events / ingest_requests / session_features even when refresh-loop columns are written', async () => {
    const t = Date.now() - 60_000;
    for (let i = 0; i < 3; i++) {
      await seedAccepted({
        session_id: 'sess-rl-src',
        event_name: 'page_view',
        page_path: '/a',
        received_at: new Date(t + i * 500),
      });
    }
    const before = await readSourceTableCounts();
    await extractDefault();
    const after = await readSourceTableCounts();
    expect(after.accepted).toBe(before.accepted);
    expect(after.rejected).toBe(before.rejected);
    expect(after.ingest).toBe(before.ingest);
    expect(after.session_features).toBe(before.session_features);

    // And the new row carries refresh-loop facts.
    const row = await selectRow(TEST_WORKSPACE, 'sess-rl-src');
    expect(row).not.toBeNull();
    expect(row!.refresh_loop_candidate).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 33. PR#2 — v0.2 backward compat (12-key maps still emitted when version=v0.2)
 * ------------------------------------------------------------------------ */

describe('PR#2 — v0.2 backward-compat extraction still produces 12-key maps', () => {
  it('explicit FEATURE_VERSION=v0.2 → presence map has 12 keys (no refresh_loop_candidate)', async () => {
    const now = new Date();
    const window_start = new Date(now.getTime() - 168 * 3600 * 1000);
    await seedAccepted({ session_id: 'sess-v02-compat', event_name: 'page_view', page_path: '/a' });
    await runExtraction(pool, {
      workspace_id: TEST_WORKSPACE,
      site_id: null,
      window_start,
      window_end: now,
      feature_version: TEST_FEATURE_VERSION_V0_2,
    });
    const row = await selectRow(TEST_WORKSPACE, 'sess-v02-compat', TEST_SITE, TEST_FEATURE_VERSION_V0_2);
    expect(row).not.toBeNull();
    const presence = row!.feature_presence_map as Record<string, string>;
    expect(Object.keys(presence).length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    expect(presence['refresh_loop_candidate']).toBeUndefined();
    const source = row!.feature_source_map as Record<string, string>;
    expect(Object.keys(source).length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    expect(Number(row!.valid_feature_count) + Number(row!.missing_feature_count)).toBe(
      EXPECTED_FEATURE_COUNT_V0_2,
    );
  });
});

/* --------------------------------------------------------------------------
 * Sanity: SQL string sweep at runtime (defence-in-depth)
 * ------------------------------------------------------------------------ */

describe('PR#1+PR#2 — EXTRACTION_SQL runtime sanity', () => {
  it('writes only to session_behavioural_features_v0_2', () => {
    const inserts = EXTRACTION_SQL.match(/INSERT INTO\s+(\w+)/g) ?? [];
    expect(inserts.length).toBe(1);
    expect(inserts[0]!).toMatch(/INSERT INTO session_behavioural_features_v0_2/);
  });
});
