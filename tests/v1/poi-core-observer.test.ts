/**
 * Sprint 2 PR#11b — POI Core Input Observer — tests.
 *
 * Pure tests. No real pg connection. The runner accepts a stub
 * client; the in-memory tests exercise the full processRow path
 * including the Stage 0 side-read truth table.
 *
 * Mirrors PR#8b test surface (group structure + boundary sweeps) but
 * scoped to the PR#11b observer:
 *   - A. Envelope mapper — SF row → buildPoiCoreInput args
 *   - B. Envelope mapper — SBF row → row-level reject
 *   - C. Page-path candidate selection (landing → last fallback)
 *   - D. Stage 0 side-read truth table (absent / present / 2+ rows)
 *   - E. Stage 0 excluded is CARRY-THROUGH, not a reject
 *   - F. Adapter throws — classified to RejectReason taxonomy
 *   - G. Report aggregation — rows_scanned_by_source_table,
 *        source_table_distribution, poi_type_distribution
 *   - H. Masking — truncateSessionId, parseDatabaseUrl
 *   - I. Static-source sweep over PR#11b active source
 *   - J. Privacy / forbidden-key invariants
 *   - K. Stub-client end-to-end runs
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
  REFERRER_CLASS,
  REFERRER_CLASSES_ALLOWED,
  type PoiSourceTable,
  type PoiSurfaceClass,
  type PoiType,
  type ReferrerClass,
} from '../../src/scoring/poi-core/index.js';

import {
  aggregateReport,
  classifyAdapterError,
  makeStubClient,
  mapSessionBehaviouralFeaturesRow,
  mapSessionFeaturesRow,
  mapStage0Row,
  parseDatabaseUrl,
  processRowForTest,
  REJECT_REASONS,
  runPoiCoreInputObserver,
  SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL,
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
  serialiseReport,
  truncateSessionId,
  type ObserverRowResult,
  type ObserverRunOptions,
  type SessionBehaviouralFeaturesRowRaw,
  type SessionFeaturesRowRaw,
  type Stage0RowRaw,
} from '../../src/scoring/poi-core-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

/* --------------------------------------------------------------------------
 * Fixture helpers
 * ------------------------------------------------------------------------ */

const COMMON = {
  poi_input_version: POI_CORE_INPUT_VERSION,
  scoring_version:   's2.v1.0',
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

function sbfRow(overrides: Partial<SessionBehaviouralFeaturesRowRaw> = {}): SessionBehaviouralFeaturesRowRaw {
  return {
    behavioural_features_id: '202',
    workspace_id:            'ws_demo',
    site_id:                 'site_demo',
    session_id:              'sess_bbbbbbbb2222cccccccc3333',
    feature_version:         'behavioural-features-v0.3',
    extracted_at:            new Date(ISO_NOW),
    first_seen_at:           new Date(ISO_BEFORE),
    last_seen_at:            new Date(ISO_NOW),
    source_event_count:      8,
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

/**
 * Build a stub pg client that routes by SQL string. Returns a Stage 0
 * row when SELECT_STAGE0_BY_LINEAGE_SQL is issued, empty otherwise.
 * The `stage0Rows` mapping is keyed by session_id for selective
 * presence.
 */
function makeStubFor(stage0Rows: Record<string, Stage0RowRaw[]>) {
  return makeStubClient(async (sql, params) => {
    if (sql.includes('FROM stage0_decisions')) {
      const [, , sessionId] = params as [string, string, string];
      const rows = stage0Rows[sessionId] ?? [];
      return { rows, rowCount: rows.length };
    }
    // SF / SBF SELECTs should not be called in unit tests that
    // exclusively use processRowForTest. If they are, return empty.
    return { rows: [], rowCount: 0 };
  });
}

/* --------------------------------------------------------------------------
 * A. Envelope mapper — SF row → BuildPoiCoreInputArgs
 * ------------------------------------------------------------------------ */

describe('A. mapSessionFeaturesRow — happy paths', () => {
  it('builds a page_path adapter input from a fully-populated SF row', () => {
    const out = mapSessionFeaturesRow(sfRow(), null, COMMON);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.poi_type).toBe(POI_TYPE.PAGE_PATH);
    expect(out.input.raw_surface.raw_page_path).toBe('/pricing');
    expect(out.input.source_row.source_table).toBe('session_features');
    expect(out.input.source_row.source_row_id).toBe('101');
    expect(out.input.source_row.behavioural_feature_version).toBe(null);
    expect(out.input.derived_at).toBe(ISO_NOW);
    expect(out.input.scoring_version).toBe('s2.v1.0');
    expect(out.input.poi_input_version).toBe(POI_CORE_INPUT_VERSION);
  });

  it('builds evidence_refs referencing only allowlisted tables', () => {
    const out = mapSessionFeaturesRow(sfRow(), null, COMMON);
    if (out.outcome !== 'ok') throw new Error('expected ok');
    const tables = out.input.source_row.evidence_refs.map((r) => r.table);
    expect(tables).toEqual(['session_features']);
  });

  it('adds a stage0_decisions evidence_ref when Stage 0 is supplied', () => {
    const out = mapSessionFeaturesRow(
      sfRow(),
      {
        stage0_decision_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        stage0_version:     'stage0-v0.1',
        excluded:           false,
        rule_id:            'no_stage0_exclusion',
        record_only:        true,
      },
      COMMON,
    );
    if (out.outcome !== 'ok') throw new Error('expected ok');
    const tables = out.input.source_row.evidence_refs.map((r) => r.table);
    expect(tables).toEqual(['session_features', 'stage0_decisions']);
  });
});

describe('A. mapSessionFeaturesRow — identity / version / timestamp rejects', () => {
  it('rejects MISSING_REQUIRED_ID when workspace_id is empty', () => {
    const out = mapSessionFeaturesRow(sfRow({ workspace_id: '' }), null, COMMON);
    expect(out.outcome).toBe('rejected');
    if (out.outcome === 'rejected') expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_REQUIRED_ID when session_features_id is missing', () => {
    const out = mapSessionFeaturesRow(sfRow({ session_features_id: null }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_REQUIRED_ID when extraction_version is empty', () => {
    const out = mapSessionFeaturesRow(sfRow({ extraction_version: '' }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_REQUIRED_ID when source_event_count is negative', () => {
    const out = mapSessionFeaturesRow(sfRow({ source_event_count: -1 }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_EXTRACTED_AT when extracted_at is null', () => {
    const out = mapSessionFeaturesRow(sfRow({ extracted_at: null }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_EXTRACTED_AT');
  });

  it('rejects MISSING_EXTRACTED_AT when extracted_at is an unparseable string', () => {
    const out = mapSessionFeaturesRow(sfRow({ extracted_at: 'not-a-date' }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_EXTRACTED_AT');
  });
});

/* --------------------------------------------------------------------------
 * B. Envelope mapper — SBF row → row-level reject
 * ------------------------------------------------------------------------ */

describe('B. mapSessionBehaviouralFeaturesRow — deliberate diagnostic reject', () => {
  it('rejects NO_PAGE_PATH_CANDIDATE because SBF schema has no path columns', () => {
    const out = mapSessionBehaviouralFeaturesRow(sbfRow(), null, COMMON);
    expect(out.outcome).toBe('rejected');
    if (out.outcome === 'rejected') {
      expect(out.reason).toBe('NO_PAGE_PATH_CANDIDATE');
      expect(out.detail).toContain('session_behavioural_features_v0_2');
      expect(out.detail).toContain('no privacy-safe page_path candidate');
    }
  });

  it('still validates identity before reaching the deliberate reject', () => {
    const out = mapSessionBehaviouralFeaturesRow(sbfRow({ workspace_id: '' }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_REQUIRED_ID when feature_version is empty', () => {
    const out = mapSessionBehaviouralFeaturesRow(sbfRow({ feature_version: '' }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_REQUIRED_ID');
  });

  it('rejects MISSING_EXTRACTED_AT when extracted_at is invalid', () => {
    const out = mapSessionBehaviouralFeaturesRow(sbfRow({ extracted_at: null }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('MISSING_EXTRACTED_AT');
  });
});

/* --------------------------------------------------------------------------
 * C. Page-path candidate selection (landing → last fallback)
 * ------------------------------------------------------------------------ */

describe('C. page-path candidate selection', () => {
  it('prefers landing_page_path when both are populated', () => {
    const out = mapSessionFeaturesRow(sfRow({
      landing_page_path: '/pricing',
      last_page_path:    '/demo/request',
    }), null, COMMON);
    if (out.outcome !== 'ok') throw new Error('expected ok');
    expect(out.input.raw_surface.raw_page_path).toBe('/pricing');
  });

  it('falls back to last_page_path when landing_page_path is null', () => {
    const out = mapSessionFeaturesRow(sfRow({
      landing_page_path: null,
      last_page_path:    '/demo/request',
    }), null, COMMON);
    if (out.outcome !== 'ok') throw new Error('expected ok');
    expect(out.input.raw_surface.raw_page_path).toBe('/demo/request');
  });

  it('falls back to last_page_path when landing_page_path is empty string', () => {
    const out = mapSessionFeaturesRow(sfRow({
      landing_page_path: '',
      last_page_path:    '/resources/buyer-intent',
    }), null, COMMON);
    if (out.outcome !== 'ok') throw new Error('expected ok');
    expect(out.input.raw_surface.raw_page_path).toBe('/resources/buyer-intent');
  });

  it('rejects NO_PAGE_PATH_CANDIDATE when both are null', () => {
    const out = mapSessionFeaturesRow(sfRow({
      landing_page_path: null,
      last_page_path:    null,
    }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('NO_PAGE_PATH_CANDIDATE');
  });

  it('rejects NO_PAGE_PATH_CANDIDATE when both are empty', () => {
    const out = mapSessionFeaturesRow(sfRow({
      landing_page_path: '',
      last_page_path:    '',
    }), null, COMMON);
    if (out.outcome !== 'rejected') throw new Error('expected rejected');
    expect(out.reason).toBe('NO_PAGE_PATH_CANDIDATE');
  });
});

/* --------------------------------------------------------------------------
 * D. Stage 0 side-read truth table
 * ------------------------------------------------------------------------ */

describe('D. Stage 0 side-read truth table', () => {
  it('processRow — Stage 0 absent → envelope still builds (no Stage 0 context)', async () => {
    const stub = makeStubFor({});  // no Stage 0 rows for any session
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    expect(result.outcome).toBe('envelope_built');
    if (result.outcome === 'envelope_built') {
      expect(result.envelope.eligibility.stage0_excluded).toBe(false);
      expect(result.envelope.eligibility.poi_eligible).toBe(true);
      expect(result.envelope.eligibility.stage0_rule_id).toBe(null);
    }
  });

  it('processRow — Stage 0 present 1 row → forwarded to adapter', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [stage0Row()],
    });
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'envelope_built') throw new Error('expected envelope_built');
    expect(result.envelope.eligibility.stage0_excluded).toBe(false);
    expect(result.envelope.eligibility.stage0_rule_id).toBe('no_stage0_exclusion');
    expect(result.envelope.source_versions.stage0_version).toBe('stage0-v0.1');
  });

  it('processRow — Stage 0 lineage returns 2 rows → INVALID_STAGE0_CONTEXT', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [
        stage0Row({ stage0_decision_id: '11111111-2222-3333-4444-555555555555' }),
        stage0Row({ stage0_decision_id: '66666666-7777-8888-9999-aaaaaaaaaaaa' }),
      ],
    });
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'rejected') throw new Error('expected rejected');
    expect(result.reason).toBe('INVALID_STAGE0_CONTEXT');
  });

  it('mapStage0Row — record_only must be the literal true', () => {
    const out = mapStage0Row(stage0Row({ record_only: false }));
    expect(out.outcome).toBe('rejected');
  });

  it('mapStage0Row — excluded must be a boolean', () => {
    const out = mapStage0Row(stage0Row({ excluded: 'no' as unknown as boolean }));
    expect(out.outcome).toBe('rejected');
  });

  it('mapStage0Row — happy path returns the PoiStage0Context shape', () => {
    const out = mapStage0Row(stage0Row());
    if (out.outcome !== 'ok') throw new Error('expected ok');
    expect(out.stage0.record_only).toBe(true);
    expect(out.stage0.excluded).toBe(false);
    expect(out.stage0.rule_id).toBe('no_stage0_exclusion');
  });
});

/* --------------------------------------------------------------------------
 * E. Stage 0 EXCLUDED is CARRY-THROUGH, not a reject (PR#11a §5.1 patch)
 * ------------------------------------------------------------------------ */

describe('E. Stage 0 excluded is carry-through, NOT a reject reason', () => {
  it('processRow — Stage 0 excluded=true → envelope built, poi_eligible=false', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [
        stage0Row({ excluded: true, rule_id: 'known_bot_ua_family' }),
      ],
    });
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'envelope_built') throw new Error('expected envelope_built');
    expect(result.envelope.eligibility.stage0_excluded).toBe(true);
    expect(result.envelope.eligibility.poi_eligible).toBe(false);
    expect(result.envelope.eligibility.stage0_rule_id).toBe('known_bot_ua_family');
  });

  it('aggregator — Stage 0 excluded rows increment stage0_excluded_count, NOT a reject_reason', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [
        stage0Row({ excluded: true, rule_id: 'known_bot_ua_family' }),
      ],
    });
    const built = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [built],
      rows_scanned_by_source_table: {
        session_features:                  1,
        session_behavioural_features_v0_2: 0,
      },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.stage0_excluded_count).toBe(1);
    expect(report.eligible_for_poi_count).toBe(0);
    expect(report.envelopes_built).toBe(1);
    expect(report.rejects).toBe(0);
  });

  it('REJECT_REASONS does NOT contain a STAGE0_EXCLUDED entry', () => {
    expect((REJECT_REASONS as readonly string[])).not.toContain('STAGE0_EXCLUDED');
  });
});

/* --------------------------------------------------------------------------
 * F. Adapter throws — classified to RejectReason taxonomy
 * ------------------------------------------------------------------------ */

describe('F. adapter-thrown errors → RejectReason classification', () => {
  it('classifyAdapterError page_path normalisation message → INVALID_PAGE_PATH', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: page_path normalisation rejected raw_page_path (got "/welcome/person@example.com")')).toBe('INVALID_PAGE_PATH');
  });

  it('classifyAdapterError stage0 message → INVALID_STAGE0_CONTEXT', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: stage0.rule_id must be a non-empty string (got "")')).toBe('INVALID_STAGE0_CONTEXT');
  });

  it('classifyAdapterError identity message → MISSING_REQUIRED_ID', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: source_row.workspace_id must be a non-empty string (got "")')).toBe('MISSING_REQUIRED_ID');
  });

  it('classifyAdapterError unknown message → ADAPTER_VALIDATION_ERROR', () => {
    expect(classifyAdapterError('something totally unexpected')).toBe('ADAPTER_VALIDATION_ERROR');
  });

  it('processRow — credential-shaped path triggers INVALID_PAGE_PATH', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features',
      sfRow({ landing_page_path: '/reset/token/secret-value' }), COMMON);
    if (result.outcome !== 'rejected') throw new Error('expected rejected');
    expect(result.reason).toBe('INVALID_PAGE_PATH');
  });

  it('processRow — email-shaped path triggers INVALID_PAGE_PATH', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features',
      sfRow({ landing_page_path: '/welcome/person@example.com', last_page_path: null }), COMMON);
    if (result.outcome !== 'rejected') throw new Error('expected rejected');
    expect(result.reason).toBe('INVALID_PAGE_PATH');
  });
});

/* --------------------------------------------------------------------------
 * G. Report aggregation — by-source-table counters + comparison
 * ------------------------------------------------------------------------ */

describe('G. aggregateReport — SF vs SBF readiness comparison', () => {
  it('counts rows_scanned_by_source_table per primary source', () => {
    const report = aggregateReport({
      results: [],
      rows_scanned_by_source_table: {
        session_features:                  5,
        session_behavioural_features_v0_2: 3,
      },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.rows_scanned).toBe(8);
    expect(report.rows_scanned_by_source_table.session_features).toBe(5);
    expect(report.rows_scanned_by_source_table.session_behavioural_features_v0_2).toBe(3);
  });

  it('source_table_distribution shows session_features=N for SF envelopes', async () => {
    const stub = makeStubFor({});
    const sfResult  = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const sbfResult = await processRowForTest(stub, 'session_behavioural_features_v0_2', sbfRow(), COMMON);
    const report = aggregateReport({
      results: [sfResult, sbfResult],
      rows_scanned_by_source_table: {
        session_features:                  1,
        session_behavioural_features_v0_2: 1,
      },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.envelopes_built).toBe(1);
    expect(report.rejects).toBe(1);
    expect(report.source_table_distribution.session_features).toBe(1);
    expect(report.source_table_distribution.session_behavioural_features_v0_2).toBe(0);
    expect(report.reject_reasons.NO_PAGE_PATH_CANDIDATE).toBe(1);
  });

  it('poi_type_distribution shows only page_path in PR#11b v0.1', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [result],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.poi_type_distribution.page_path).toBe(1);
    expect(report.poi_type_distribution.route).toBe(0);
    expect(report.poi_type_distribution.cta_id).toBe(0);
    expect(report.poi_type_distribution.form_id).toBe(0);
    expect(report.poi_type_distribution.offer_surface).toBe(0);
    expect(report.poi_type_distribution.referrer_class).toBe(0);
  });

  it('sessions_seen_on_both_tables counts intersection of session_ids', () => {
    const sharedSession = 'sess_xxxxxxxx9999yyyyyyyy0000';
    const sfBuilt: ObserverRowResult = {
      outcome:    'envelope_built',
      envelope:   buildFakeEnvelope({ session_id: sharedSession, source_table: 'session_features' }),
      session_id: sharedSession,
      source_table: 'session_features',
    };
    const sbfReject: ObserverRowResult = {
      outcome:    'rejected',
      reason:     'NO_PAGE_PATH_CANDIDATE',
      session_id: sharedSession,
      source_table: 'session_behavioural_features_v0_2',
      detail:     'no path columns',
    };
    const report = aggregateReport({
      results: [sfBuilt, sbfReject],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 1 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.unique_session_ids_seen).toBe(1);
    expect(report.sessions_seen_on_both_tables).toBe(1);
  });

  it('reject_reasons exposes all observer-defined reasons with zero defaults', () => {
    const report = aggregateReport({
      results: [],
      rows_scanned_by_source_table: { session_features: 0, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    for (const r of REJECT_REASONS) {
      expect(report.reject_reasons[r]).toBe(0);
    }
  });
});

/* --------------------------------------------------------------------------
 * L. Codex blocker — full diagnostics contract
 *    (poi_surface_class_distribution + referrer_class_distribution
 *     + unsafe_poi_key_reject_count + evidence_ref_reject_count)
 * ------------------------------------------------------------------------ */

function emptyReport() {
  return aggregateReport({
    results: [],
    rows_scanned_by_source_table: { session_features: 0, session_behavioural_features_v0_2: 0 },
    sample_limit: 5,
    run_metadata: makeRunMetadata(),
  });
}

describe('L. ObserverReport diagnostics contract (Codex blocker patch)', () => {
  it('report includes the four new fields', () => {
    const report = emptyReport();
    expect(report).toHaveProperty('poi_surface_class_distribution');
    expect(report).toHaveProperty('referrer_class_distribution');
    expect(report).toHaveProperty('unsafe_poi_key_reject_count');
    expect(report).toHaveProperty('evidence_ref_reject_count');
  });

  it('all PR#10 PoiSurfaceClass buckets initialised to 0', () => {
    const report = emptyReport();
    expect(Object.keys(report.poi_surface_class_distribution).sort())
      .toEqual([...POI_SURFACE_CLASSES_ALLOWED].sort());
    for (const c of POI_SURFACE_CLASSES_ALLOWED) {
      expect(report.poi_surface_class_distribution[c]).toBe(0);
    }
  });

  it('all PR#10 ReferrerClass buckets initialised to 0', () => {
    const report = emptyReport();
    expect(Object.keys(report.referrer_class_distribution).sort())
      .toEqual([...REFERRER_CLASSES_ALLOWED].sort());
    for (const c of REFERRER_CLASSES_ALLOWED) {
      expect(report.referrer_class_distribution[c]).toBe(0);
    }
  });

  it('unsafe_poi_key_reject_count defaults to 0', () => {
    expect(emptyReport().unsafe_poi_key_reject_count).toBe(0);
  });

  it('evidence_ref_reject_count defaults to 0', () => {
    expect(emptyReport().evidence_ref_reject_count).toBe(0);
  });

  it('built envelope with poi_surface_class="page.pricing" increments the correct bucket', () => {
    const envelopeRow: ObserverRowResult = {
      outcome:      'envelope_built',
      envelope:     buildFakeEnvelope({
        session_id:        'sess_aaaaaaaa1111bbbbbbbb2222',
        source_table:      'session_features',
        poi_surface_class: POI_SURFACE_CLASS.PAGE_PRICING,
      }),
      session_id:   'sess_aaaaaaaa1111bbbbbbbb2222',
      source_table: 'session_features',
    };
    const report = aggregateReport({
      results: [envelopeRow],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.poi_surface_class_distribution['page.pricing']).toBe(1);
    // All other surface-class buckets remain at 0.
    for (const c of POI_SURFACE_CLASSES_ALLOWED) {
      if (c === POI_SURFACE_CLASS.PAGE_PRICING) continue;
      expect(report.poi_surface_class_distribution[c]).toBe(0);
    }
  });

  it('null poi_surface_class does NOT increment any bucket', () => {
    const envelopeRow: ObserverRowResult = {
      outcome:      'envelope_built',
      envelope:     buildFakeEnvelope({
        session_id:        'sess_aaaaaaaa1111bbbbbbbb2222',
        source_table:      'session_features',
        poi_surface_class: null,
      }),
      session_id:   'sess_aaaaaaaa1111bbbbbbbb2222',
      source_table: 'session_features',
    };
    const report = aggregateReport({
      results: [envelopeRow],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    for (const c of POI_SURFACE_CLASSES_ALLOWED) {
      expect(report.poi_surface_class_distribution[c]).toBe(0);
    }
  });

  it('PR#11b page_path-only run leaves referrer_class_distribution all zero', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [result],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    for (const c of REFERRER_CLASSES_ALLOWED) {
      expect(report.referrer_class_distribution[c]).toBe(0);
    }
  });

  it('hypothetical referrer_class envelope increments the matching bucket (forward-compatibility)', () => {
    // PR#11b cannot produce these envelopes (poi_type hard-coded to
    // page_path), but the aggregator must classify them correctly for
    // future multi-POI-type runs.
    const envelopeRow: ObserverRowResult = {
      outcome:      'envelope_built',
      envelope:     buildFakeEnvelope({
        session_id:   'sess_aaaaaaaa1111bbbbbbbb2222',
        source_table: 'session_features',
        poi_type:     POI_TYPE.REFERRER_CLASS,
        poi_key:      REFERRER_CLASS.SEARCH,
      }),
      session_id:   'sess_aaaaaaaa1111bbbbbbbb2222',
      source_table: 'session_features',
    };
    const report = aggregateReport({
      results: [envelopeRow],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.referrer_class_distribution['referrer.search']).toBe(1);
    expect(report.referrer_class_distribution['referrer.direct']).toBe(0);
  });

  it('INVALID_PAGE_PATH reject increments unsafe_poi_key_reject_count', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features',
      sfRow({ landing_page_path: '/welcome/person@example.com', last_page_path: null }), COMMON);
    const report = aggregateReport({
      results: [result],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.reject_reasons.INVALID_PAGE_PATH).toBe(1);
    expect(report.unsafe_poi_key_reject_count).toBe(1);
  });

  it('EVIDENCE_REF_REJECT reject increments evidence_ref_reject_count', () => {
    const rejectRow: ObserverRowResult = {
      outcome:      'rejected',
      reason:       'EVIDENCE_REF_REJECT',
      session_id:   'sess_aaaaaaaa1111bbbbbbbb2222',
      source_table: 'session_features',
      detail:       'evidence_refs[0].table is not in the PR#10 default allowlist',
    };
    const report = aggregateReport({
      results: [rejectRow],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.reject_reasons.EVIDENCE_REF_REJECT).toBe(1);
    expect(report.evidence_ref_reject_count).toBe(1);
  });

  it('classifyAdapterError maps evidence_refs messages to EVIDENCE_REF_REJECT', () => {
    expect(classifyAdapterError('PR#10 POI core input invalid: evidence_refs must contain at least one provenance entry')).toBe('EVIDENCE_REF_REJECT');
    expect(classifyAdapterError('PR#10 POI core input invalid: evidence_refs[0].table "accepted_events" is not in the PR#10 default allowlist (...)')).toBe('EVIDENCE_REF_REJECT');
    expect(classifyAdapterError('PR#10 POI core input invalid: evidence_refs evidence_refs[0].user_agent is a forbidden key (privacy / lineage rule)')).toBe('EVIDENCE_REF_REJECT');
  });

  it('REJECT_REASONS still does NOT contain STAGE0_EXCLUDED after Codex blocker patch', () => {
    expect((REJECT_REASONS as readonly string[])).not.toContain('STAGE0_EXCLUDED');
    expect((REJECT_REASONS as readonly string[])).toContain('EVIDENCE_REF_REJECT');
  });

  it('Stage 0 excluded still carries through (NOT a reject) after Codex blocker patch', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [
        stage0Row({ excluded: true, rule_id: 'known_bot_ua_family' }),
      ],
    });
    const built = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [built],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    expect(report.stage0_excluded_count).toBe(1);
    expect(report.rejects).toBe(0);
    expect(report.envelopes_built).toBe(1);
    expect(report.eligible_for_poi_count).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * H. Masking — truncateSessionId / parseDatabaseUrl
 * ------------------------------------------------------------------------ */

describe('H. masking helpers', () => {
  it('truncateSessionId masks long IDs to prefix…suffix', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });

  it('truncateSessionId returns *** for short IDs (<12 chars)', () => {
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });

  it('parseDatabaseUrl returns host + db name only, never the password', () => {
    const r = parseDatabaseUrl('postgres://user:pass@db.internal:5432/buyerrecon_staging');
    expect(r.host).toBe('db.internal:5432');
    expect(r.name).toBe('buyerrecon_staging');
    expect(JSON.stringify(r)).not.toContain('pass');
  });

  it('parseDatabaseUrl returns sentinels on garbage', () => {
    const r = parseDatabaseUrl('not-a-url');
    expect(r.host).toBe('<unparseable>');
    expect(r.name).toBe('<unparseable>');
  });

  it('parseDatabaseUrl returns sentinels on undefined', () => {
    const r = parseDatabaseUrl(undefined);
    expect(r.host).toBe('<unset>');
    expect(r.name).toBe('<unset>');
  });
});

/* --------------------------------------------------------------------------
 * I. Static-source sweep over PR#11b active source
 * ------------------------------------------------------------------------ */

const PR11B_SOURCE_FILES = [
  'src/scoring/poi-core-observer/types.ts',
  'src/scoring/poi-core-observer/sql.ts',
  'src/scoring/poi-core-observer/mapper.ts',
  'src/scoring/poi-core-observer/report.ts',
  'src/scoring/poi-core-observer/runner.ts',
  'src/scoring/poi-core-observer/index.ts',
  'scripts/poi-core-input-observation-report.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

/**
 * Strip TypeScript line + block comments so static-source sweeps
 * don't trip on documentation that legitimately enumerates
 * forbidden keywords (mirrors PR#8b precedent).
 */
function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('I. static-source boundary sweep — PR#11b', () => {
  it('no INSERT / UPDATE / DELETE / TRUNCATE / DROP / ALTER / CREATE TABLE / GRANT / REVOKE', () => {
    for (const f of PR11B_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/);
      expect(src, `${f} must not contain UPDATE …`).not.toMatch(/\bUPDATE\s+[a-z_]+\s+SET\b/i);
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
      'accepted_events',
      'rejected_events',
      'ingest_requests',
      'risk_observations_v0_1',
      'scoring_output_lane_a',
      'scoring_output_lane_b',
      'site_write_tokens',
    ];
    // Restrict the check to runtime modules (sql.ts + runner.ts) and
    // the CLI. The test file itself naturally mentions some forbidden
    // table names for clarity, but does NOT execute SQL against them.
    const runtimeFiles = [
      'src/scoring/poi-core-observer/sql.ts',
      'src/scoring/poi-core-observer/runner.ts',
      'scripts/poi-core-input-observation-report.ts',
    ];
    for (const f of runtimeFiles) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        // FROM <table> and JOIN <table> (with optional newlines)
        const fromRe = new RegExp(`\\bFROM\\s+${t}\\b`, 'i');
        const joinRe = new RegExp(`\\bJOIN\\s+${t}\\b`, 'i');
        expect(src, `${f} must not FROM ${t}`).not.toMatch(fromRe);
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(joinRe);
      }
    }
  });

  it('no imports from src/scoring/policy / trust / series / lane', () => {
    for (const f of PR11B_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/policy/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/trust/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/series/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/lane/);
    }
  });

  it('no imports from collector / app / server / auth', () => {
    for (const f of PR11B_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/app/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/server/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth/);
    }
  });

  it('does not read evidence_refs / raw_payload / canonical_jsonb JSONB columns', () => {
    // Restrict to runtime SQL strings — comments in mapper.ts and
    // types.ts legitimately mention these column names for
    // documentation.
    const sql = stripTsComments(readSource('src/scoring/poi-core-observer/sql.ts'));
    expect(sql).not.toMatch(/\bevidence_refs\s+/);   // SELECT clause field
    expect(sql).not.toMatch(/\braw_payload\b/);
    expect(sql).not.toMatch(/\bcanonical_jsonb\b/);
    expect(sql).not.toMatch(/\buser_agent\b/);
    expect(sql).not.toMatch(/\bip_hash\b/);
    expect(sql).not.toMatch(/\btoken_hash\b/);
  });
});

/* --------------------------------------------------------------------------
 * J. Privacy / forbidden-key invariants
 * ------------------------------------------------------------------------ */

describe('J. privacy invariants', () => {
  it('built envelope evidence_refs contain only allowlisted tables', async () => {
    const stub = makeStubFor({
      'sess_aaaaaaaa1111bbbbbbbb2222': [stage0Row()],
    });
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'envelope_built') throw new Error('expected envelope_built');
    const tables = result.envelope.evidence_refs.map((r) => r.table);
    for (const t of tables) {
      expect(['session_features', 'session_behavioural_features_v0_2', 'stage0_decisions']).toContain(t);
    }
  });

  it('serialised report never contains the full session_id', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [result],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    const serialised = serialiseReport(report);
    expect(serialised).not.toContain('sess_aaaaaaaa1111bbbbbbbb2222');
    // The masked prefix DOES appear.
    expect(serialised).toContain('sess_aaa…2222');
  });

  it('serialised report contains no forbidden privacy markers as JSON keys', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    const report = aggregateReport({
      results: [result],
      rows_scanned_by_source_table: { session_features: 1, session_behavioural_features_v0_2: 0 },
      sample_limit: 5,
      run_metadata: makeRunMetadata(),
    });
    const serialised = serialiseReport(report);
    // Match as JSON keys (`"<name>":`) so legitimate enum values like
    // `"referrer.email"` or `"page.demo"` cannot trip the substring
    // sweep. The real privacy threat is a forbidden FIELD NAME landing
    // in the report — not an enum-value substring.
    const forbiddenKeys = [
      'raw_payload', 'canonical_jsonb', 'user_agent', 'ip_hash', 'token_hash',
      'authorization', 'bearer', 'cookie', 'pepper',
      'person_id', 'visitor_id', 'company_id', 'email', 'phone',
      'page_url', 'full_url', 'url_query',
    ];
    for (const k of forbiddenKeys) {
      const keyPattern = new RegExp(`"${k}"\\s*:`);
      expect(serialised, `report must not contain JSON key "${k}":`).not.toMatch(keyPattern);
    }
  });

  it('built envelope shape has no Lane A/B / Risk / Trust / Policy fields', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'envelope_built') throw new Error('expected envelope_built');
    const env = result.envelope as unknown as Record<string, unknown>;
    expect(env).not.toHaveProperty('risk_index');
    expect(env).not.toHaveProperty('verification_score');
    expect(env).not.toHaveProperty('evidence_band');
    expect(env).not.toHaveProperty('action_recommendation');
    expect(env).not.toHaveProperty('lane_a');
    expect(env).not.toHaveProperty('lane_b');
    expect(env).not.toHaveProperty('trust_decision');
    expect(env).not.toHaveProperty('policy_decision');
    expect(env).not.toHaveProperty('verdict');
    expect(env).not.toHaveProperty('customer_facing');
  });

  it('record_only on built envelope provenance is the literal true', async () => {
    const stub = makeStubFor({});
    const result = await processRowForTest(stub, 'session_features', sfRow(), COMMON);
    if (result.outcome !== 'envelope_built') throw new Error('expected envelope_built');
    expect(result.envelope.provenance.record_only).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * K. Stub-client end-to-end runs through runPoiCoreInputObserver
 * ------------------------------------------------------------------------ */

describe('K. runPoiCoreInputObserver — end-to-end via stub client', () => {
  it('runs a happy-path SF row + SBF row scan and produces the expected counters', async () => {
    const sfRowFixture  = sfRow();
    const sbfRowFixture = sbfRow();
    const client = makeStubClient(async (sql) => {
      if (sql.includes('FROM session_features')) {
        return { rows: [sfRowFixture], rowCount: 1 };
      }
      if (sql.includes('FROM session_behavioural_features_v0_2')) {
        return { rows: [sbfRowFixture], rowCount: 1 };
      }
      if (sql.includes('FROM stage0_decisions')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const options: ObserverRunOptions = {
      poi_input_version: POI_CORE_INPUT_VERSION,
      scoring_version:   's2.v1.0',
      window_start:      new Date('2026-05-12T00:00:00Z'),
      window_end:        new Date('2026-05-13T11:00:00Z'),
      limit:             100,
      sample_limit:      5,
    };

    const report = await runPoiCoreInputObserver({
      client: client as unknown as Parameters<typeof runPoiCoreInputObserver>[0]['client'],
      options,
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });

    expect(report.rows_scanned).toBe(2);
    expect(report.rows_scanned_by_source_table.session_features).toBe(1);
    expect(report.rows_scanned_by_source_table.session_behavioural_features_v0_2).toBe(1);
    expect(report.envelopes_built).toBe(1);
    expect(report.rejects).toBe(1);
    expect(report.reject_reasons.NO_PAGE_PATH_CANDIDATE).toBe(1);
    expect(report.source_table_distribution.session_features).toBe(1);
    expect(report.source_table_distribution.session_behavioural_features_v0_2).toBe(0);
    expect(report.run_metadata.poi_type).toBe('page_path');
    expect(report.run_metadata.record_only).toBe(true);
    expect(report.run_metadata.stage0_side_read_table).toBe('stage0_decisions');
    expect(report.run_metadata.primary_source_tables).toEqual([
      'session_features',
      'session_behavioural_features_v0_2',
    ]);
  });

  it('throws when caller passes wrong poi_input_version', async () => {
    const client = makeStubClient(async () => ({ rows: [], rowCount: 0 }));
    await expect(
      runPoiCoreInputObserver({
        client: client as unknown as Parameters<typeof runPoiCoreInputObserver>[0]['client'],
        options: {
          poi_input_version: 'poi-core-input-v9.9',
          scoring_version:   's2.v1.0',
          window_start:      new Date('2026-05-12T00:00:00Z'),
          window_end:        new Date('2026-05-13T11:00:00Z'),
          limit:             10,
          sample_limit:      5,
        },
        database_host: 'localhost:5432',
        database_name: 'buyerrecon_test',
      }),
    ).rejects.toThrow(/poi_input_version/);
  });
});

/* --------------------------------------------------------------------------
 * Verify SQL statements are syntactically distinguishable in tests
 * ------------------------------------------------------------------------ */

describe('SQL constants', () => {
  it('SELECT_SESSION_FEATURES_SQL has only the expected FROM clause', () => {
    expect(SELECT_SESSION_FEATURES_SQL).toMatch(/FROM session_features\b/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM session_behavioural_features_v0_2/);
    expect(SELECT_SESSION_FEATURES_SQL).not.toMatch(/FROM stage0_decisions/);
  });
  it('SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL has only the expected FROM clause', () => {
    expect(SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL).toMatch(/FROM session_behavioural_features_v0_2\b/);
    expect(SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL).not.toMatch(/FROM session_features\s/);
    expect(SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL).not.toMatch(/FROM stage0_decisions/);
  });
  it('SELECT_STAGE0_BY_LINEAGE_SQL queries stage0_decisions LIMIT 2', () => {
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toMatch(/FROM stage0_decisions\b/);
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toMatch(/LIMIT 2/);
  });
});

/* --------------------------------------------------------------------------
 * Shared test helpers
 * ------------------------------------------------------------------------ */

function makeRunMetadata() {
  return {
    poi_input_version:      POI_CORE_INPUT_VERSION,
    scoring_version:        's2.v1.0',
    extraction_version:     null,
    feature_version:        null,
    window_start:           '2026-05-12T00:00:00.000Z',
    window_end:             '2026-05-13T11:00:00.000Z',
    database_host:          'localhost:5432',
    database_name:          'buyerrecon_test',
    run_started_at:         ISO_NOW,
    run_ended_at:           ISO_NOW,
    primary_source_tables:  Object.freeze<PoiSourceTable[]>(['session_features', 'session_behavioural_features_v0_2']),
    stage0_side_read_table: 'stage0_decisions' as const,
    poi_type:               'page_path' as const,
    record_only:            true as const,
  };
}

function buildFakeEnvelope(args: {
  session_id:          string;
  source_table:        PoiSourceTable;
  poi_type?:           PoiType;
  poi_key?:            string;
  poi_surface_class?:  PoiSurfaceClass | null;
}): import('../../src/scoring/poi-core/index.js').PoiCoreInput {
  return Object.freeze({
    poi_input_version: POI_CORE_INPUT_VERSION,
    workspace_id:      'ws_demo',
    site_id:           'site_demo',
    session_id:        args.session_id,
    source_identity: Object.freeze({
      source_table:  args.source_table,
      source_row_id: 'fake-row',
    }),
    source_versions: Object.freeze({
      poi_input_version:           POI_CORE_INPUT_VERSION,
      scoring_version:             's2.v1.0',
      behavioural_feature_version: null,
      stage0_version:              null,
    }),
    poi: Object.freeze({
      poi_type:           args.poi_type ?? POI_TYPE.PAGE_PATH,
      poi_key:            args.poi_key  ?? '/fake',
      poi_surface_class:  args.poi_surface_class ?? null,
    }),
    poi_context: Object.freeze({
      utm_campaign_class: null,
      utm_source_class:   null,
      utm_medium_class:   null,
    }),
    evidence_refs: Object.freeze([Object.freeze({ table: args.source_table, source_row_id: 'fake-row' })]),
    eligibility: Object.freeze({
      stage0_excluded: false,
      stage0_rule_id:  null,
      poi_eligible:    true,
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
