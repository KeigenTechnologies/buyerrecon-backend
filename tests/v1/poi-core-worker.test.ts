/**
 * Sprint 2 PR#11c — POI Core Worker — tests.
 *
 * Pure tests. No real pg connection. The worker accepts a stub
 * client; in-memory tests exercise the full processRow path
 * including the Stage 0 side-read truth table and the UPSERT call.
 *
 * Test groups (mirrors PR#11b structure):
 *   - A. Envelope mapper happy paths
 *   - B. Identity / version / timestamp rejects
 *   - C. Page-path candidate selection + OD-11 discriminator
 *   - D. Stage 0 side-read truth table
 *   - E. Stage 0 excluded is CARRY-THROUGH, not a reject
 *   - F. Upsert parameter builder invariants
 *   - G. processRow → UPSERT happy path + xmax inserted/updated
 *   - H. Adapter throws → RejectReason classification
 *   - I. aggregateReport — distributions, counters, carry-through
 *   - J. Masking — truncateSessionId / parseDatabaseUrl
 *   - K. Static-source sweep over PR#11c active source
 *   - L. SQL constants (FROM/JOIN allowlist, UPSERT shape)
 *   - M. runPoiCoreWorker end-to-end via stub client
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  POI_CORE_INPUT_VERSION,
  POI_SURFACE_CLASS,
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPE,
  REFERRER_CLASSES_ALLOWED,
  type PoiCoreInput,
  type PoiSourceTable,
  type PoiSurfaceClass,
  type PoiType,
} from '../../src/scoring/poi-core/index.js';

import {
  aggregateReport,
  buildUpsertParams,
  classifyAdapterError,
  makeStubClient,
  mapSessionFeaturesRowToArgs,
  mapStage0Row,
  parseDatabaseUrl,
  parsePoiCoreWorkerEnvOptions,
  pickPagePathCandidate,
  POI_KEY_SOURCE_FIELDS_ALLOWED,
  POI_OBSERVATION_VERSION_DEFAULT,
  processRowForTest,
  REJECT_REASONS,
  runPoiCoreWorker,
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
  truncateSessionId,
  UPSERT_POI_OBSERVATION_SQL,
  type SessionFeaturesRowRaw,
  type Stage0RowRaw,
  type WorkerRowResult,
  type WorkerRunOptions,
} from '../../src/scoring/poi-core-worker/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const COMMON = {
  poi_input_version:       POI_CORE_INPUT_VERSION,
  poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
  scoring_version:         's2.v1.0',
};

const ISO_NOW    = '2026-05-13T10:00:00.000Z';
const ISO_BEFORE = '2026-05-13T09:55:00.000Z';

function sfRow(overrides: Partial<SessionFeaturesRowRaw> = {}): SessionFeaturesRowRaw {
  return {
    session_features_id:  '101',
    workspace_id:         'ws_demo',
    site_id:              'site_demo',
    session_id:           'sess_aaaaaaaa1111bbbbbbbb2222',
    extraction_version:   'session-features-v0.1',
    extracted_at:         new Date(ISO_NOW),
    first_seen_at:        new Date(ISO_BEFORE),
    last_seen_at:         new Date(ISO_NOW),
    source_event_count:   12,
    landing_page_path:    '/pricing',
    last_page_path:       '/demo/request',
    ...overrides,
  };
}

function stage0Row(overrides: Partial<Stage0RowRaw> = {}): Stage0RowRaw {
  return {
    stage0_decision_id: '11111111-2222-3333-4444-555555555555',
    workspace_id:       'ws_demo',
    site_id:            'site_demo',
    session_id:         'sess_aaaaaaaa1111bbbbbbbb2222',
    stage0_version:     'stage0-v0.1',
    excluded:           false,
    rule_id:            'no_stage0_exclusion',
    record_only:        true,
    ...overrides,
  };
}

interface StubConfig {
  readonly stage0Rows?:        Record<string, Stage0RowRaw[]>;
  readonly upsertInserted?:    boolean;
  readonly captureUpserts?:    Array<{ sql: string; params: readonly unknown[] }>;
}

/**
 * Build a stub pg client that routes by SQL string. SF SELECT
 * isn't called by `processRowForTest` (that test path drives a
 * single row). Stage 0 SELECT returns rows keyed by session_id.
 * UPSERT returns `{ inserted: <bool> }` per the SQL's RETURNING
 * clause; the test config controls whether it's inserted vs
 * updated.
 */
function makeStub(cfg: StubConfig = {}) {
  return makeStubClient(async (sql, params) => {
    if (sql.includes('FROM stage0_decisions')) {
      const [, , sessionId] = params as [string, string, string];
      const rows = cfg.stage0Rows?.[sessionId] ?? [];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('INSERT INTO poi_observations_v0_1')) {
      if (cfg.captureUpserts) cfg.captureUpserts.push({ sql, params });
      const inserted = cfg.upsertInserted !== false;
      return { rows: [{ poi_observation_id: 1, inserted }], rowCount: 1 };
    }
    if (sql.includes('FROM session_features')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

/* ==========================================================================
 * A. Mapper happy paths
 * ========================================================================== */

describe('A. mapSessionFeaturesRowToArgs — happy paths', () => {
  it('builds args from a fully-populated SF row', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow(), null, COMMON);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.poi_type).toBe(POI_TYPE.PAGE_PATH);
    expect(out.input.raw_surface.raw_page_path).toBe('/pricing');
    expect(out.input.source_row.source_table).toBe('session_features');
    expect(out.input.source_row.source_row_id).toBe('101');
    expect(out.input.derived_at).toBe(ISO_NOW);
    expect(out.poi_key_source_field).toBe('landing_page_path');
    expect(out.source_versions.session_features).toBe('session-features-v0.1');
    expect(out.source_versions.poi_input_version).toBe(POI_CORE_INPUT_VERSION);
  });

  it('appends stage0_decisions to evidence_refs when Stage 0 supplied', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow(), {
      stage0_decision_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      stage0_version:     'stage0-v0.1',
      excluded:           false,
      rule_id:            'no_stage0_exclusion',
      record_only:        true,
    }, COMMON);
    if (out.outcome !== 'ok') throw new Error('expected ok');
    const tables = out.input.source_row.evidence_refs.map((r) => r.table);
    expect(tables).toEqual(['session_features', 'stage0_decisions']);
    expect(out.source_versions.stage0_decisions).toBe('stage0-v0.1');
  });
});

/* ==========================================================================
 * B. Identity / version / timestamp rejects
 * ========================================================================== */

describe('B. mapper rejects', () => {
  it('MISSING_REQUIRED_ID when workspace_id empty', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({ workspace_id: '' }), null, COMMON);
    expect(out.outcome).toBe('rejected');
    if (out.outcome === 'rejected') expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });
  it('MISSING_REQUIRED_ID when session_features_id missing', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({ session_features_id: null }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });
  it('MISSING_REQUIRED_ID when extraction_version empty', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({ extraction_version: '' }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });
  it('MISSING_REQUIRED_ID when source_event_count negative', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({ source_event_count: -1 }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });
  it('MISSING_EXTRACTED_AT when extracted_at null', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({ extracted_at: null }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_EXTRACTED_AT');
  });
  it('NO_PAGE_PATH_CANDIDATE when both landing + last are null', () => {
    const out = mapSessionFeaturesRowToArgs(sfRow({
      landing_page_path: null,
      last_page_path:    null,
    }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('NO_PAGE_PATH_CANDIDATE');
  });
});

/* ==========================================================================
 * C. Page-path candidate + OD-11 discriminator
 * ========================================================================== */

describe('C. pickPagePathCandidate + OD-11 discriminator', () => {
  it('prefers landing_page_path; source_field=landing_page_path', () => {
    const c = pickPagePathCandidate(sfRow());
    expect(c).toEqual({ path: '/pricing', source_field: 'landing_page_path' });
  });
  it('falls back to last_page_path; source_field=last_page_path', () => {
    const c = pickPagePathCandidate(sfRow({
      landing_page_path: null,
      last_page_path:    '/demo/request',
    }));
    expect(c).toEqual({ path: '/demo/request', source_field: 'last_page_path' });
  });
  it('falls back to last_page_path when landing is empty string', () => {
    const c = pickPagePathCandidate(sfRow({
      landing_page_path: '',
      last_page_path:    '/resources/buyer-intent',
    }));
    expect(c?.source_field).toBe('last_page_path');
  });
  it('returns null when both missing', () => {
    const c = pickPagePathCandidate(sfRow({ landing_page_path: null, last_page_path: null }));
    expect(c).toBeNull();
  });
  it('POI_KEY_SOURCE_FIELDS_ALLOWED is the 2-element enum', () => {
    expect([...POI_KEY_SOURCE_FIELDS_ALLOWED].sort()).toEqual(['landing_page_path', 'last_page_path']);
  });
});

/* ==========================================================================
 * D. Stage 0 side-read truth table
 * ========================================================================== */

describe('D. Stage 0 side-read truth table', () => {
  it('absent (0 rows) → envelope upserted with stage0_excluded=false', async () => {
    const stub = makeStub({});
    const result = await processRowForTest(stub, sfRow(), COMMON);
    expect(result.outcome).toBe('upserted');
    if (result.outcome === 'upserted') {
      expect(result.envelope.eligibility.stage0_excluded).toBe(false);
      expect(result.envelope.eligibility.poi_eligible).toBe(true);
      expect(result.envelope.eligibility.stage0_rule_id).toBe(null);
    }
  });

  it('present (1 row, not excluded) → envelope upserted with Stage 0 forwarded', async () => {
    const stub = makeStub({
      stage0Rows: { 'sess_aaaaaaaa1111bbbbbbbb2222': [stage0Row()] },
    });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    if (result.outcome !== 'upserted') throw new Error('expected upserted');
    expect(result.envelope.eligibility.stage0_excluded).toBe(false);
    expect(result.envelope.eligibility.stage0_rule_id).toBe('no_stage0_exclusion');
    expect(result.envelope.source_versions.stage0_version).toBe('stage0-v0.1');
  });

  it('2+ rows → INVALID_STAGE0_CONTEXT reject (no DB write)', async () => {
    const stub = makeStub({
      stage0Rows: {
        'sess_aaaaaaaa1111bbbbbbbb2222': [
          stage0Row({ stage0_decision_id: '11111111-2222-3333-4444-555555555555' }),
          stage0Row({ stage0_decision_id: '66666666-7777-8888-9999-aaaaaaaaaaaa' }),
        ],
      },
    });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    if (result.outcome !== 'rejected') throw new Error('expected rejected');
    expect(result.reason).toBe('INVALID_STAGE0_CONTEXT');
  });

  it('mapStage0Row rejects when record_only is not the literal true', () => {
    const out = mapStage0Row(stage0Row({ record_only: false }));
    expect(out.outcome).toBe('rejected');
  });
});

/* ==========================================================================
 * E. Stage 0 EXCLUDED is CARRY-THROUGH (PR#11a §5.1 patch)
 * ========================================================================== */

describe('E. Stage 0 excluded is carry-through, NOT a reject', () => {
  it('Stage 0 excluded=true → envelope still upserts, poi_eligible=false', async () => {
    const stub = makeStub({
      stage0Rows: {
        'sess_aaaaaaaa1111bbbbbbbb2222': [stage0Row({ excluded: true, rule_id: 'known_bot_ua_family' })],
      },
    });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    if (result.outcome !== 'upserted') throw new Error('expected upserted');
    expect(result.envelope.eligibility.stage0_excluded).toBe(true);
    expect(result.envelope.eligibility.poi_eligible).toBe(false);
    expect(result.envelope.eligibility.stage0_rule_id).toBe('known_bot_ua_family');
  });

  it('REJECT_REASONS does NOT contain STAGE0_EXCLUDED', () => {
    expect((REJECT_REASONS as readonly string[])).not.toContain('STAGE0_EXCLUDED');
    expect((REJECT_REASONS as readonly string[])).toContain('EVIDENCE_REF_REJECT');
  });

  it('aggregator counts Stage 0 excluded as carry-through, not reject', async () => {
    const stub = makeStub({
      stage0Rows: {
        'sess_aaaaaaaa1111bbbbbbbb2222': [stage0Row({ excluded: true, rule_id: 'known_bot_ua_family' })],
      },
    });
    const upserted = await processRowForTest(stub, sfRow(), COMMON);
    const report = aggregateReport({
      results: [upserted],
      rows_scanned: 1,
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.stage0_excluded_count).toBe(1);
    expect(report.eligible_for_poi_count).toBe(0);
    expect(report.rows_inserted + report.rows_updated).toBe(1);
    expect(report.rejects).toBe(0);
  });
});

/* ==========================================================================
 * F. Upsert parameter builder invariants
 * ========================================================================== */

describe('F. buildUpsertParams invariants', () => {
  function happyEnvelope(): PoiCoreInput {
    return makeFakeEnvelope({
      session_id:        'sess_aaaaaaaa1111bbbbbbbb2222',
      stage0_excluded:   false,
      poi_eligible:      true,
      poi_key:           '/pricing',
      poi_surface_class: null,
    });
  }

  it('produces 21 positional parameters in the documented order', () => {
    const env = happyEnvelope();
    const params = buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { session_features: 'session-features-v0.1', poi_input_version: POI_CORE_INPUT_VERSION },
    });
    expect(params).toHaveLength(21);
    expect(params[0]).toBe('ws_demo');                              // $1 workspace_id
    expect(params[3]).toBe('page_path');                            // $4 poi_type
    expect(params[4]).toBe('/pricing');                             // $5 poi_key
    expect(params[6]).toBe(POI_CORE_INPUT_VERSION);                 // $7 poi_input_version
    expect(params[7]).toBe(POI_OBSERVATION_VERSION_DEFAULT);        // $8 poi_observation_version
    expect(params[8]).toBe('session-features-v0.1');                // $9 extraction_version
    expect(typeof params[9]).toBe('string');                        // $10 evidence_refs JSON
    expect(params[10]).toBe('session_features');                    // $11 source_table
    expect(params[13]).toBe('landing_page_path');                   // $14 poi_key_source_field
    expect(params[15]).toBe(false);                                 // $16 stage0_excluded
    expect(params[16]).toBe(true);                                  // $17 poi_eligible
  });

  it('rejects poi_type that is not page_path (v0.1 hard-code)', () => {
    const env = makeFakeEnvelope({ poi_type: POI_TYPE.ROUTE });
    expect(() => buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { session_features: 'session-features-v0.1' },
    })).toThrow(/poi_type must be 'page_path'/);
  });

  it('rejects poi_key_source_field outside the OD-11 enum', () => {
    const env = happyEnvelope();
    expect(() => buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      // @ts-expect-error intentionally bad
      poi_key_source_field:    'bogus_field',
      source_versions:         { session_features: 'session-features-v0.1' },
    })).toThrow(/poi_key_source_field must be one of/);
  });

  it('rejects evidence_refs empty array', () => {
    const env = makeFakeEnvelope({ evidence_refs: [] });
    expect(() => buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { session_features: 'session-features-v0.1' },
    })).toThrow(/evidence_refs must be non-empty/);
  });

  it('rejects source_versions missing the session_features key', () => {
    const env = happyEnvelope();
    expect(() => buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { poi_input_version: POI_CORE_INPUT_VERSION },
    })).toThrow(/source_versions\["session_features"\]/);
  });

  it('rejects mismatch between envelope.poi_eligible and NOT stage0_excluded', () => {
    // Fabricate an envelope where the invariant is violated.
    const env = makeFakeEnvelope({ stage0_excluded: true, poi_eligible: true });
    expect(() => buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { session_features: 'session-features-v0.1' },
    })).toThrow(/poi_eligible.*does not equal NOT stage0_excluded/);
  });

  it('serialises evidence_refs and source_versions as JSON strings', () => {
    const env = happyEnvelope();
    const params = buildUpsertParams({
      envelope: env,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      poi_key_source_field:    'landing_page_path',
      source_versions:         { session_features: 'session-features-v0.1', poi_input_version: POI_CORE_INPUT_VERSION },
    });
    // $10 evidence_refs
    expect(typeof params[9]).toBe('string');
    expect(() => JSON.parse(params[9] as string)).not.toThrow();
    // $15 source_versions
    expect(typeof params[14]).toBe('string');
    expect(JSON.parse(params[14] as string)).toMatchObject({ session_features: 'session-features-v0.1' });
  });
});

/* ==========================================================================
 * G. processRow → UPSERT happy path
 * ========================================================================== */

describe('G. processRow → UPSERT', () => {
  it('happy path: UPSERT runs, returns upserted with inserted action', async () => {
    const captured: Array<{ sql: string; params: readonly unknown[] }> = [];
    const stub = makeStub({ captureUpserts: captured, upsertInserted: true });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    expect(result.outcome).toBe('upserted');
    if (result.outcome === 'upserted') {
      expect(result.upsert_action).toBe('inserted');
    }
    expect(captured).toHaveLength(1);
    expect(captured[0]!.sql).toContain('INSERT INTO poi_observations_v0_1');
    expect(captured[0]!.sql).toContain('ON CONFLICT');
  });

  it('UPSERT params include the natural-key tuple and poi_key_source_field', async () => {
    const captured: Array<{ sql: string; params: readonly unknown[] }> = [];
    const stub = makeStub({ captureUpserts: captured });
    await processRowForTest(stub, sfRow(), COMMON);
    const p = captured[0]!.params;
    expect(p[0]).toBe('ws_demo');                              // workspace_id
    expect(p[1]).toBe('site_demo');                            // site_id
    expect(p[2]).toBe('sess_aaaaaaaa1111bbbbbbbb2222');        // session_id
    expect(p[3]).toBe('page_path');                            // poi_type
    expect(p[4]).toBe('/pricing');                             // poi_key
    expect(p[6]).toBe(POI_CORE_INPUT_VERSION);                 // poi_input_version
    expect(p[7]).toBe(POI_OBSERVATION_VERSION_DEFAULT);        // poi_observation_version
    expect(p[8]).toBe('session-features-v0.1');                // extraction_version
    expect(p[10]).toBe('session_features');                    // source_table
    expect(p[13]).toBe('landing_page_path');                   // poi_key_source_field
  });

  it('UPSERT params reflect last_page_path fallback when landing is null', async () => {
    const captured: Array<{ sql: string; params: readonly unknown[] }> = [];
    const stub = makeStub({ captureUpserts: captured });
    await processRowForTest(stub, sfRow({ landing_page_path: null, last_page_path: '/demo/request' }), COMMON);
    expect(captured[0]!.params[4]).toBe('/demo/request');         // poi_key
    expect(captured[0]!.params[13]).toBe('last_page_path');       // poi_key_source_field
  });

  it('updated action when DB returns inserted=false', async () => {
    const stub = makeStub({ upsertInserted: false });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    if (result.outcome !== 'upserted') throw new Error('expected upserted');
    expect(result.upsert_action).toBe('updated');
  });
});

/* ==========================================================================
 * H. Adapter throws → RejectReason classification
 * ========================================================================== */

describe('H. classifyAdapterError', () => {
  it('page_path normalisation rejection → INVALID_PAGE_PATH', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: page_path normalisation rejected raw_page_path (got "/welcome/person@example.com")')).toBe('INVALID_PAGE_PATH');
  });
  it('evidence_refs message → EVIDENCE_REF_REJECT', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: evidence_refs[0].table "accepted_events" is not in the PR#10 default allowlist')).toBe('EVIDENCE_REF_REJECT');
  });
  it('forbidden-key evidence_refs error → EVIDENCE_REF_REJECT (NOT MISSING_REQUIRED_ID even if mentions identity-like keys)', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: evidence_refs evidence_refs[0].account_id is a forbidden key')).toBe('EVIDENCE_REF_REJECT');
  });
  it('stage0 message → INVALID_STAGE0_CONTEXT', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: stage0.rule_id must be a non-empty string')).toBe('INVALID_STAGE0_CONTEXT');
  });
  it('identity message → MISSING_REQUIRED_ID', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: source_row.workspace_id must be a non-empty string')).toBe('MISSING_REQUIRED_ID');
  });
  it('unknown → ADAPTER_VALIDATION_ERROR', () => {
    expect(classifyAdapterError('something totally unexpected')).toBe('ADAPTER_VALIDATION_ERROR');
  });
  it('processRow surfaces INVALID_PAGE_PATH on credential-shaped path', async () => {
    const stub = makeStub({});
    const result = await processRowForTest(stub, sfRow({ landing_page_path: '/reset/token/secret-value' }), COMMON);
    if (result.outcome !== 'rejected') throw new Error('expected rejected');
    expect(result.reason).toBe('INVALID_PAGE_PATH');
  });
});

/* ==========================================================================
 * I. aggregateReport — distributions + counters
 * ========================================================================== */

describe('I. aggregateReport', () => {
  it('report shape includes all required counters', () => {
    const r = aggregateReport({
      results: [],
      rows_scanned: 0,
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(r).toHaveProperty('rows_inserted');
    expect(r).toHaveProperty('rows_updated');
    expect(r).toHaveProperty('rows_unchanged');
    expect(r).toHaveProperty('rejects');
    expect(r).toHaveProperty('reject_reasons');
    expect(r).toHaveProperty('poi_type_distribution');
    expect(r).toHaveProperty('poi_surface_class_distribution');
    expect(r).toHaveProperty('referrer_class_distribution');
    expect(r).toHaveProperty('source_table_distribution');
    expect(r).toHaveProperty('stage0_excluded_count');
    expect(r).toHaveProperty('eligible_for_poi_count');
    expect(r).toHaveProperty('unsafe_poi_key_reject_count');
    expect(r).toHaveProperty('evidence_ref_reject_count');
  });
  it('all 14 PoiSurfaceClass buckets initialised to 0', () => {
    const r = aggregateReport({
      results: [], rows_scanned: 0, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    expect(Object.keys(r.poi_surface_class_distribution).sort()).toEqual([...POI_SURFACE_CLASSES_ALLOWED].sort());
    for (const c of POI_SURFACE_CLASSES_ALLOWED) expect(r.poi_surface_class_distribution[c]).toBe(0);
  });
  it('all 5 ReferrerClass buckets initialised to 0', () => {
    const r = aggregateReport({
      results: [], rows_scanned: 0, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    expect(Object.keys(r.referrer_class_distribution).sort()).toEqual([...REFERRER_CLASSES_ALLOWED].sort());
    for (const c of REFERRER_CLASSES_ALLOWED) expect(r.referrer_class_distribution[c]).toBe(0);
  });
  it('all reject_reasons initialised to 0', () => {
    const r = aggregateReport({
      results: [], rows_scanned: 0, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    for (const reason of REJECT_REASONS) expect(r.reject_reasons[reason]).toBe(0);
  });
  it('INVALID_PAGE_PATH reject increments unsafe_poi_key_reject_count', async () => {
    const stub = makeStub({});
    const result = await processRowForTest(stub, sfRow({ landing_page_path: '/welcome/person@example.com', last_page_path: null }), COMMON);
    const r = aggregateReport({
      results: [result], rows_scanned: 1, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    expect(r.unsafe_poi_key_reject_count).toBe(1);
  });
  it('EVIDENCE_REF_REJECT reject increments evidence_ref_reject_count', () => {
    const rejected: WorkerRowResult = {
      outcome:    'rejected',
      reason:     'EVIDENCE_REF_REJECT',
      session_id: 'sess_aaaaaaaa1111bbbbbbbb2222',
      detail:     'evidence_refs[0].table "accepted_events" is not in the PR#10 default allowlist',
    };
    const r = aggregateReport({
      results: [rejected], rows_scanned: 1, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    expect(r.evidence_ref_reject_count).toBe(1);
  });
  it('rows_unchanged is 0 in v0.1 (always-set-updated_at policy)', async () => {
    const stub = makeStub({ upsertInserted: false });
    const result = await processRowForTest(stub, sfRow(), COMMON);
    const r = aggregateReport({
      results: [result], rows_scanned: 1, sample_limit: 5, run_metadata: makeRunMetadata(),
    });
    expect(r.rows_unchanged).toBe(0);
    expect(r.rows_updated).toBe(1);
    expect(r.rows_inserted).toBe(0);
  });
});

/* ==========================================================================
 * J. Masking helpers
 * ========================================================================== */

describe('J. masking helpers', () => {
  it('truncateSessionId masks long IDs to prefix…suffix', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });
  it('truncateSessionId returns *** for short IDs', () => {
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });
  it('parseDatabaseUrl returns host + db name only', () => {
    const r = parseDatabaseUrl('postgres://user:pass@db.internal:5432/buyerrecon_staging');
    expect(r.host).toBe('db.internal:5432');
    expect(r.name).toBe('buyerrecon_staging');
    expect(JSON.stringify(r)).not.toContain('pass');
  });
});

/* ==========================================================================
 * K. Static-source sweep
 * ========================================================================== */

const PR11C_SOURCE_FILES = [
  'src/scoring/poi-core-worker/types.ts',
  'src/scoring/poi-core-worker/query.ts',
  'src/scoring/poi-core-worker/mapper.ts',
  'src/scoring/poi-core-worker/upsert.ts',
  'src/scoring/poi-core-worker/worker.ts',
  'src/scoring/poi-core-worker/index.ts',
  'scripts/run-poi-core-worker.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('K. static-source boundary sweep — PR#11c', () => {
  it('no DML / DDL / GRANT / REVOKE in active TS source (excluding INSERT INTO poi_observations_v0_1)', () => {
    for (const f of PR11C_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      // INSERT INTO is permitted ONLY for poi_observations_v0_1.
      const insertMatches = src.match(/\bINSERT\s+INTO\s+\w+/g) ?? [];
      for (const m of insertMatches) {
        expect(m, `${f} INSERT must target only poi_observations_v0_1`).toMatch(/INSERT\s+INTO\s+poi_observations_v0_1/);
      }
      expect(src, `${f} must not contain UPDATE <table> SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
      expect(src, `${f} must not contain DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/);
      expect(src, `${f} must not contain TRUNCATE`).not.toMatch(/\bTRUNCATE\b/);
      expect(src, `${f} must not contain DROP …`).not.toMatch(/\bDROP\s+(TABLE|INDEX|VIEW|SCHEMA)\b/i);
      expect(src, `${f} must not contain ALTER TABLE`).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(src, `${f} must not contain CREATE TABLE`).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(src, `${f} must not contain GRANT`).not.toMatch(/\bGRANT\b/);
      expect(src, `${f} must not contain REVOKE`).not.toMatch(/\bREVOKE\b/);
    }
  });

  it('no SQL FROM/JOIN against forbidden tables', () => {
    const forbidden = [
      'session_behavioural_features_v0_2',
      'accepted_events',
      'rejected_events',
      'ingest_requests',
      'risk_observations_v0_1',
      'scoring_output_lane_a',
      'scoring_output_lane_b',
      'site_write_tokens',
    ];
    // Restrict to runtime modules (query.ts + worker.ts + upsert.ts + CLI).
    // The test file naturally mentions some forbidden table names for
    // clarity, but does NOT execute SQL against them.
    const runtimeFiles = [
      'src/scoring/poi-core-worker/query.ts',
      'src/scoring/poi-core-worker/worker.ts',
      'src/scoring/poi-core-worker/upsert.ts',
      'src/scoring/poi-core-worker/mapper.ts',
      'scripts/run-poi-core-worker.ts',
    ];
    for (const f of runtimeFiles) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        // SQL convention: keywords uppercase. We deliberately do NOT
        // use the `i` flag so a prose mention like "MUST NOT
        // reconstruct paths from accepted_events" (lowercase "from")
        // does not trip the sweep. SQL strings in `query.ts` are all
        // uppercase, so the sweep still catches a real `FROM <table>`.
        const fromRe  = new RegExp(`\\bFROM\\s+${t}\\b`);
        const joinRe  = new RegExp(`\\bJOIN\\s+${t}\\b`);
        const writeRe = new RegExp(`\\b(?:INSERT\\s+INTO|UPDATE)\\s+${t}\\b`);
        expect(src, `${f} must not FROM ${t}`).not.toMatch(fromRe);
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(joinRe);
        expect(src, `${f} must not write to ${t}`).not.toMatch(writeRe);
      }
    }
  });

  it('no imports from policy / trust / series / lane / observer / collector / app / server / auth', () => {
    for (const f of PR11C_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/policy/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/trust/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/series/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/lane/);
      // No import from the PR#11b observer (per locked decision Q2).
      expect(src).not.toMatch(/from\s+['"][^'"]*poi-core-observer/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/app/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/server/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth/);
    }
  });

  it('worker query.ts does not SELECT evidence_refs / raw_payload / canonical_jsonb / user_agent / ip_hash / token_hash', () => {
    const sql = stripTsComments(readSource('src/scoring/poi-core-worker/query.ts'));
    // The string `evidence_refs` legitimately appears in the UPSERT
    // INSERT column list and ON CONFLICT update set, but NEVER as a
    // SELECT field of session_features / stage0_decisions. We assert
    // the SELECT clauses do not pull these fields by checking the SF
    // SELECT body specifically.
    expect(sql).not.toMatch(/SELECT[\s\S]+evidence_refs[\s\S]+FROM session_features/);
    expect(sql).not.toMatch(/SELECT[\s\S]+raw_payload[\s\S]+FROM/);
    expect(sql).not.toMatch(/SELECT[\s\S]+canonical_jsonb[\s\S]+FROM/);
    expect(sql).not.toMatch(/SELECT[\s\S]+user_agent[\s\S]+FROM/);
    expect(sql).not.toMatch(/SELECT[\s\S]+ip_hash[\s\S]+FROM/);
    expect(sql).not.toMatch(/SELECT[\s\S]+token_hash[\s\S]+FROM/);
  });
});

/* ==========================================================================
 * L. SQL constants
 * ========================================================================== */

describe('L. SQL constants', () => {
  it('SELECT_SESSION_FEATURES_SQL reads only session_features', () => {
    expect(SELECT_SESSION_FEATURES_SQL).toMatch(/FROM session_features\b/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM session_behavioural_features_v0_2/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM stage0_decisions/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM accepted_events/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM risk_observations_v0_1/);
  });
  it('SELECT_STAGE0_BY_LINEAGE_SQL reads only stage0_decisions and uses LIMIT 2', () => {
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toMatch(/FROM stage0_decisions\b/);
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toMatch(/LIMIT 2/);
  });
  it('UPSERT_POI_OBSERVATION_SQL targets poi_observations_v0_1 with ON CONFLICT 8-col natural key', () => {
    expect(UPSERT_POI_OBSERVATION_SQL).toMatch(/INSERT INTO poi_observations_v0_1/);
    expect(UPSERT_POI_OBSERVATION_SQL).toMatch(/ON CONFLICT \(workspace_id, site_id, session_id, poi_type, poi_key,\s*poi_input_version, poi_observation_version, extraction_version\)/);
    expect(UPSERT_POI_OBSERVATION_SQL).toMatch(/RETURNING poi_observation_id, \(xmax = 0\) AS inserted/);
    expect(UPSERT_POI_OBSERVATION_SQL).toMatch(/updated_at\s*=\s*NOW\(\)/);
  });
  it('UPSERT_POI_OBSERVATION_SQL does not touch scoring_output_lane_a or _b', () => {
    expect(UPSERT_POI_OBSERVATION_SQL).not.toMatch(/scoring_output_lane_a/);
    expect(UPSERT_POI_OBSERVATION_SQL).not.toMatch(/scoring_output_lane_b/);
  });
  it('UPSERT_POI_OBSERVATION_SQL hard-codes record_only = TRUE in VALUES', () => {
    expect(UPSERT_POI_OBSERVATION_SQL).toMatch(/TRUE\s*\)/);
  });
});

/* ==========================================================================
 * L.5. Migration 014 — role/sequence grant invariants (Codex-blocker patch)
 *
 * Static-source sweep on the migration body. Verifies that:
 *   - scoring_worker has the full sequence grant tuple (USAGE/SELECT/UPDATE)
 *   - internal_readonly has SELECT on the table
 *   - internal_readonly does NOT receive USAGE on the sequence
 *     (USAGE → nextval(...) mutates the sequence; incompatible with
 *      a strictly-read-only role)
 *   - internal_readonly does NOT receive UPDATE on the sequence
 *     (UPDATE → setval(...) mutates the sequence)
 *   - migration contains a Hard-Rule-I-style DO block asserting the
 *     above at apply time.
 * ========================================================================== */

describe('L.5. migration 014 — role / sequence grant invariants', () => {
  const MIGRATION = readSource('migrations/014_poi_observations_v0_1.sql');

  it('grants USAGE, SELECT, UPDATE on the sequence to scoring_worker', () => {
    expect(MIGRATION).toMatch(/GRANT\s+USAGE,\s*SELECT,\s*UPDATE\s+ON\s+SEQUENCE\s+poi_observations_v0_1_poi_observation_id_seq\s+TO\s+buyerrecon_scoring_worker/);
  });

  it('grants SELECT on the table to internal_readonly', () => {
    expect(MIGRATION).toMatch(/GRANT\s+SELECT\s+ON\s+poi_observations_v0_1\s+TO\s+buyerrecon_internal_readonly/);
  });

  it('does NOT grant any sequence privilege to internal_readonly', () => {
    // No "GRANT … ON SEQUENCE poi_observations_v0_1_poi_observation_id_seq … TO buyerrecon_internal_readonly".
    // Match each GRANT statement individually — the `[^;]` anchors keep
    // the regex from crossing into the prior or next GRANT statement.
    const seqGrants = MIGRATION.match(/GRANT[^;]+?ON\s+SEQUENCE\s+poi_observations_v0_1_poi_observation_id_seq[^;]+?TO\s+[^;]+;/g) ?? [];
    for (const g of seqGrants) {
      expect(g, 'sequence GRANT must not target internal_readonly').not.toMatch(/buyerrecon_internal_readonly/);
    }
  });

  it('does NOT grant USAGE on the sequence to internal_readonly (direct sweep)', () => {
    // Exhaustive: there must be NO occurrence of `GRANT USAGE … TO buyerrecon_internal_readonly` for this sequence.
    expect(MIGRATION).not.toMatch(/GRANT\s+USAGE[\s\S]*?ON\s+SEQUENCE\s+poi_observations_v0_1_poi_observation_id_seq[\s\S]*?TO\s+buyerrecon_internal_readonly/);
  });

  it('does NOT grant UPDATE on the sequence to internal_readonly (direct sweep)', () => {
    expect(MIGRATION).not.toMatch(/GRANT\s+UPDATE[\s\S]*?ON\s+SEQUENCE\s+poi_observations_v0_1_poi_observation_id_seq[\s\S]*?TO\s+buyerrecon_internal_readonly/);
  });

  it('contains a Hard-Rule-I-style assertion that internal_readonly has no USAGE on the sequence', () => {
    expect(MIGRATION).toMatch(/has_sequence_privilege\([\s\S]*?'buyerrecon_internal_readonly'[\s\S]*?'poi_observations_v0_1_poi_observation_id_seq'[\s\S]*?'USAGE'/);
    expect(MIGRATION).toMatch(/BLOCKER:[\s\S]*?buyerrecon_internal_readonly[\s\S]*?USAGE[\s\S]*?nextval/);
  });

  it('contains a Hard-Rule-I-style assertion that internal_readonly has no UPDATE on the sequence', () => {
    expect(MIGRATION).toMatch(/has_sequence_privilege\([\s\S]*?'buyerrecon_internal_readonly'[\s\S]*?'poi_observations_v0_1_poi_observation_id_seq'[\s\S]*?'UPDATE'/);
    expect(MIGRATION).toMatch(/BLOCKER:[\s\S]*?buyerrecon_internal_readonly[\s\S]*?UPDATE[\s\S]*?setval/);
  });

  it('contains a positive assertion that internal_readonly has SELECT on the table', () => {
    expect(MIGRATION).toMatch(/IF NOT has_table_privilege\([\s\S]*?'buyerrecon_internal_readonly'[\s\S]*?'poi_observations_v0_1'[\s\S]*?'SELECT'/);
  });

  it('still rejects customer_api SELECT on the table (existing Hard-Rule-I assertion preserved)', () => {
    expect(MIGRATION).toMatch(/has_table_privilege\([\s\S]*?'buyerrecon_customer_api'[\s\S]*?'poi_observations_v0_1'[\s\S]*?'SELECT'/);
  });

  it('rollback block does NOT mention revoking internal_readonly sequence privileges', () => {
    // The rollback chunk is the trailing `-- Rollback …` comment block.
    const rollback = MIGRATION.slice(MIGRATION.indexOf('-- Rollback'));
    expect(rollback).not.toMatch(/REVOKE[\s\S]*?ON\s+SEQUENCE[\s\S]*?FROM\s+buyerrecon_internal_readonly/);
  });
});

/* ==========================================================================
 * M. runPoiCoreWorker end-to-end via stub client
 * ========================================================================== */

describe('M. runPoiCoreWorker end-to-end via stub client', () => {
  it('happy-path SF row scan upserts one row and produces expected counters', async () => {
    const sf = sfRow();
    const captured: Array<{ sql: string; params: readonly unknown[] }> = [];
    const client = makeStubClient(async (sql, params) => {
      if (sql.includes('FROM session_features')) {
        return { rows: [sf], rowCount: 1 };
      }
      if (sql.includes('FROM stage0_decisions')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO poi_observations_v0_1')) {
        captured.push({ sql, params });
        return { rows: [{ poi_observation_id: 1, inserted: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const options: WorkerRunOptions = {
      poi_input_version:       POI_CORE_INPUT_VERSION,
      poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
      scoring_version:         's2.v1.0',
      window_start:            new Date('2026-05-12T00:00:00Z'),
      window_end:              new Date('2026-05-13T11:00:00Z'),
      limit:                   100,
      sample_limit:            5,
    };

    const report = await runPoiCoreWorker({
      client: client as unknown as Parameters<typeof runPoiCoreWorker>[0]['client'],
      options,
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });

    expect(report.rows_scanned).toBe(1);
    expect(report.rows_inserted).toBe(1);
    expect(report.rows_updated).toBe(0);
    expect(report.rejects).toBe(0);
    expect(report.poi_type_distribution.page_path).toBe(1);
    expect(report.source_table_distribution.session_features).toBe(1);
    expect(report.run_metadata.target_table).toBe('poi_observations_v0_1');
    expect(report.run_metadata.poi_type).toBe('page_path');
    expect(report.run_metadata.record_only).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it('throws when poi_input_version is wrong', async () => {
    const client = makeStubClient(async () => ({ rows: [], rowCount: 0 }));
    await expect(
      runPoiCoreWorker({
        client: client as unknown as Parameters<typeof runPoiCoreWorker>[0]['client'],
        options: {
          poi_input_version:       'poi-core-input-v9.9',
          poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
          scoring_version:         's2.v1.0',
          window_start:            new Date('2026-05-12T00:00:00Z'),
          window_end:              new Date('2026-05-13T11:00:00Z'),
          limit:                   10,
          sample_limit:            5,
        },
        database_host: 'localhost:5432',
        database_name: 'buyerrecon_test',
      }),
    ).rejects.toThrow(/poi_input_version/);
  });
});

/* ==========================================================================
 * N. CLI env parsing
 * ========================================================================== */

describe('N. parsePoiCoreWorkerEnvOptions', () => {
  it('rejects missing DATABASE_URL', () => {
    expect(() => parsePoiCoreWorkerEnvOptions({}, new Date(ISO_NOW))).toThrow(/DATABASE_URL/);
  });
  it('applies sensible defaults', () => {
    const out = parsePoiCoreWorkerEnvOptions(
      { DATABASE_URL: 'postgres://u:p@h:5432/db' },
      new Date(ISO_NOW),
    );
    expect(out.options.poi_input_version).toBe(POI_CORE_INPUT_VERSION);
    expect(out.options.poi_observation_version).toBe(POI_OBSERVATION_VERSION_DEFAULT);
    expect(out.options.scoring_version).toBe('s2.v1.0');
    expect(out.options.limit).toBe(10_000);
    expect(out.options.sample_limit).toBe(10);
  });
  it('honours WORKSPACE_ID / SITE_ID / EXTRACTION_VERSION filters', () => {
    const out = parsePoiCoreWorkerEnvOptions(
      {
        DATABASE_URL:       'postgres://u:p@h:5432/db',
        WORKSPACE_ID:       'ws_demo',
        SITE_ID:            'site_demo',
        EXTRACTION_VERSION: 'session-features-v0.1',
      },
      new Date(ISO_NOW),
    );
    expect(out.options.workspace_id).toBe('ws_demo');
    expect(out.options.site_id).toBe('site_demo');
    expect(out.options.extraction_version).toBe('session-features-v0.1');
  });
});

/* --------------------------------------------------------------------------
 * Shared test helpers
 * ------------------------------------------------------------------------ */

function makeRunMetadata() {
  return {
    poi_input_version:       POI_CORE_INPUT_VERSION,
    poi_observation_version: POI_OBSERVATION_VERSION_DEFAULT,
    scoring_version:         's2.v1.0',
    extraction_version:      null,
    window_start:            '2026-05-12T00:00:00.000Z',
    window_end:              '2026-05-13T11:00:00.000Z',
    database_host:           'localhost:5432',
    database_name:           'buyerrecon_test',
    run_started_at:          ISO_NOW,
    run_ended_at:            ISO_NOW,
    primary_source_tables:   Object.freeze<PoiSourceTable[]>(['session_features']),
    stage0_side_read_table:  'stage0_decisions' as const,
    poi_type:                'page_path' as const,
    target_table:            'poi_observations_v0_1' as const,
    record_only:             true as const,
  };
}

interface FakeEnvelopeOverrides {
  readonly session_id?:        string;
  readonly poi_type?:          PoiType;
  readonly poi_key?:           string;
  readonly poi_surface_class?: PoiSurfaceClass | null;
  readonly stage0_excluded?:   boolean;
  readonly poi_eligible?:      boolean;
  readonly evidence_refs?:     readonly { table: string; [k: string]: unknown }[];
}

function makeFakeEnvelope(overrides: FakeEnvelopeOverrides = {}): PoiCoreInput {
  const stage0_excluded = overrides.stage0_excluded ?? false;
  const poi_eligible    = overrides.poi_eligible    ?? (!stage0_excluded);
  return Object.freeze({
    poi_input_version: POI_CORE_INPUT_VERSION,
    workspace_id:      'ws_demo',
    site_id:           'site_demo',
    session_id:        overrides.session_id ?? 'sess_aaaaaaaa1111bbbbbbbb2222',
    source_identity: Object.freeze({
      source_table:  'session_features' as const,
      source_row_id: '101',
    }),
    source_versions: Object.freeze({
      poi_input_version:           POI_CORE_INPUT_VERSION,
      scoring_version:             's2.v1.0',
      behavioural_feature_version: null,
      stage0_version:              null,
    }),
    poi: Object.freeze({
      poi_type:           overrides.poi_type ?? POI_TYPE.PAGE_PATH,
      poi_key:            overrides.poi_key  ?? '/pricing',
      poi_surface_class:  overrides.poi_surface_class ?? null,
    }),
    poi_context: Object.freeze({
      utm_campaign_class: null,
      utm_source_class:   null,
      utm_medium_class:   null,
    }),
    evidence_refs: Object.freeze(overrides.evidence_refs ?? [
      Object.freeze({ table: 'session_features', source_row_id: '101', extraction_version: 'session-features-v0.1' }),
    ]),
    eligibility: Object.freeze({
      stage0_excluded,
      stage0_rule_id:  stage0_excluded ? 'known_bot_ua_family' : null,
      poi_eligible,
    }),
    provenance: Object.freeze({
      source_event_count: 1,
      record_only:        true as const,
      derived_at:         ISO_NOW,
      first_seen_at:      null,
      last_seen_at:       null,
    }),
  });
}

// Reference unused imports to satisfy the linter when the suite is
// run with --reporter=verbose (POI_SURFACE_CLASS is used in
// type-narrowing scenarios in similar test files; we keep the import
// for future tests).
void POI_SURFACE_CLASS;
