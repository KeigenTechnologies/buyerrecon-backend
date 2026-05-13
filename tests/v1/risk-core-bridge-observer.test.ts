/**
 * Sprint 2 PR#8b — Risk Core Bridge Observer — pure tests.
 *
 * Pure: no DB connection. Tests cover:
 *   A. Mapper happy path + derived_at sourcing + evidence_refs verbatim
 *   B. PostgreSQL NUMERIC handling (strings, invalid strings, out-of-range)
 *   C. Stage 0 lookup truth table (Path A exact pointer + Path B fallback)
 *   D. Reject aggregation across a mixed batch
 *   E. Masking (truncateSessionId + serialised-JSON sweep)
 *   F. Report shape + sample limit
 *   G. Static boundary tests (no writes, no Lane A/B, no upstream raw reads,
 *      no forbidden imports, no reason_code_dictionary import, etc.)
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  aggregateReport,
  classifyAdapterError,
  extractStage0Pointers,
  isPlausibleUuid,
  makeStubClient,
  mapRiskObservationRow,
  mapStage0Row,
  parseDatabaseUrl,
  processRowForTest,
  REJECT_REASONS,
  runRiskCoreBridgeObserver,
  SELECT_RISK_OBSERVATIONS_SQL,
  SELECT_STAGE0_BY_DECISION_ID_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
  serialiseReport,
  truncateSessionId,
  validateEvidenceRefsShape,
  type EvidenceRef,
  type ObserverReport,
  type ObserverRowResult,
  type ObserverRunMetadata,
  type RejectReason,
  type RiskObservationRowRaw,
  type Stage0RowRaw,
} from '../../src/scoring/risk-core-bridge-observer/index.js';
import { RISK_CORE_BRIDGE_ENVELOPE_VERSION } from '../../src/scoring/risk-core-bridge/index.js';
import type { Pool } from 'pg';

const ROOT = join(__dirname, '..', '..');
const TYPES_FILE    = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'types.ts');
const SQL_FILE      = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'sql.ts');
const MAPPER_FILE   = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'mapper.ts');
const REPORT_FILE   = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'report.ts');
const RUNNER_FILE   = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'runner.ts');
const INDEX_FILE    = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer', 'index.ts');
const CLI_FILE      = join(ROOT, 'scripts', 'risk-core-bridge-observation-report.ts');

const PR8B_ACTIVE_SOURCES: ReadonlyArray<[string, string]> = [
  ['src/scoring/risk-core-bridge-observer/types.ts',  TYPES_FILE],
  ['src/scoring/risk-core-bridge-observer/sql.ts',    SQL_FILE],
  ['src/scoring/risk-core-bridge-observer/mapper.ts', MAPPER_FILE],
  ['src/scoring/risk-core-bridge-observer/report.ts', REPORT_FILE],
  ['src/scoring/risk-core-bridge-observer/runner.ts', RUNNER_FILE],
  ['src/scoring/risk-core-bridge-observer/index.ts',  INDEX_FILE],
  ['scripts/risk-core-bridge-observation-report.ts',  CLI_FILE],
];

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

const FIXED_CREATED_AT = new Date('2026-05-13T08:00:00.000Z');
const FIXED_CREATED_AT_ISO = FIXED_CREATED_AT.toISOString();

function baselineRow(overrides: Partial<RiskObservationRowRaw> = {}): RiskObservationRowRaw {
  return {
    risk_observation_id:    '00000000-0000-4000-8000-000000000001',
    workspace_id:           '__test_ws_pr8b__',
    site_id:                '__test_site_pr8b__',
    session_id:             'sess-pr8b-abcdef0123',
    observation_version:    'risk-obs-v0.1',
    scoring_version:        's2.v1.0',
    velocity: {
      events_per_second:          1,
      pageview_burst_count_10s:   0,
      sub_200ms_transition_count: 0,
      refresh_loop_count:         0,
      same_path_repeat_count:     0,
    },
    // NUMERIC arrives from pg as strings by default — fixture mirrors reality.
    device_risk_01:         '0.000',
    network_risk_01:        '0.000',
    identity_risk_01:       '0.000',
    behavioural_risk_01:    '0.250',
    tags:                   ['REFRESH_LOOP_CANDIDATE'],
    evidence_refs: [
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions',                   stage0_decision_id: '00000000-0000-4000-8000-0000000000aa', rule_id: 'no_stage0_exclusion' },
    ],
    source_event_count:    3,
    record_only:            true,
    created_at:             FIXED_CREATED_AT,
    ...overrides,
  };
}

function baselineStage0Row(overrides: Partial<Stage0RowRaw> = {}): Stage0RowRaw {
  return {
    stage0_decision_id:  '00000000-0000-4000-8000-0000000000aa',
    workspace_id:        '__test_ws_pr8b__',
    site_id:             '__test_site_pr8b__',
    session_id:          'sess-pr8b-abcdef0123',
    stage0_version:      'stage0-hard-exclusion-v0.2',
    excluded:            false,
    rule_id:             'no_stage0_exclusion',
    record_only:         true,
    ...overrides,
  };
}

function baselineMetadata(overrides: Partial<ObserverRunMetadata> = {}): ObserverRunMetadata {
  return {
    observation_version:        'risk-obs-v0.1',
    scoring_version:             's2.v1.0',
    window_start:                '2026-05-12T00:00:00.000Z',
    window_end:                  '2026-05-13T00:00:00.000Z',
    database_host:               '127.0.0.1:5432',
    database_name:               'buyerrecon_staging',
    run_started_at:              '2026-05-13T09:00:00.000Z',
    run_ended_at:                '2026-05-13T09:00:05.000Z',
    source_table:                'risk_observations_v0_1',
    bridge_envelope_version:     RISK_CORE_BRIDGE_ENVELOPE_VERSION,
    ...overrides,
  };
}

/* ==========================================================================
 * GROUP A — Mapper happy path
 * ========================================================================== */

describe('PR#8b — A. Mapper happy path', () => {
  it('valid row maps into a valid RiskCoreBridgeInput', () => {
    const out = mapRiskObservationRow(baselineRow(), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.workspace_id).toBe('__test_ws_pr8b__');
    expect(out.input.site_id).toBe('__test_site_pr8b__');
    expect(out.input.session_id).toBe('sess-pr8b-abcdef0123');
    expect(out.input.risk_observation_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(out.input.observation_version).toBe('risk-obs-v0.1');
    expect(out.input.scoring_version).toBe('s2.v1.0');
  });

  it('behavioural_feature_version is derived from the SBF evidence_refs entry', () => {
    const out = mapRiskObservationRow(baselineRow(), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.behavioural_feature_version).toBe('behavioural-features-v0.3');
  });

  it('evidence_refs are preserved verbatim (same elements, same order)', () => {
    const refs = [
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 9, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions',                   stage0_decision_id: 'abc-001', rule_id: 'no_stage0_exclusion' },
    ];
    const out = mapRiskObservationRow(baselineRow({ evidence_refs: refs }), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.evidence_refs).toEqual(refs);
  });

  it('created_at maps to derived_at (ISO-8601)', () => {
    const out = mapRiskObservationRow(baselineRow(), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.derived_at).toBe(FIXED_CREATED_AT_ISO);
  });

  it('mapper source contains no Date.now() call', () => {
    const body = stripTsComments(readFileSync(MAPPER_FILE, 'utf8'));
    expect(/\bDate\.now\s*\(/.test(body)).toBe(false);
  });

  it('rejects MISSING_DERIVED_AT when created_at is null', () => {
    const out = mapRiskObservationRow(baselineRow({ created_at: null }), null);
    expect(out.outcome).toBe('rejected');
    if (out.outcome !== 'rejected') return;
    expect(out.reason).toBe('MISSING_DERIVED_AT');
  });

  it('rejects MISSING_DERIVED_AT when created_at is an unparseable string', () => {
    const out = mapRiskObservationRow(baselineRow({ created_at: 'not-a-date' }), null);
    expect(out.outcome).toBe('rejected');
    if (out.outcome !== 'rejected') return;
    expect(out.reason).toBe('MISSING_DERIVED_AT');
  });
});

/* ==========================================================================
 * GROUP B — NUMERIC handling
 * ========================================================================== */

describe('PR#8b — B. NUMERIC string handling', () => {
  it("'0' / '0.250' / '1' parse correctly and pass the adapter", () => {
    const out = mapRiskObservationRow(baselineRow({
      device_risk_01:      '0',
      network_risk_01:     '0.250',
      identity_risk_01:    '1',
      behavioural_risk_01: '0.500',
    }), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.device_risk_01).toBe(0);
    expect(out.input.network_risk_01).toBe(0.25);
    expect(out.input.identity_risk_01).toBe(1);
    expect(out.input.behavioural_risk_01).toBe(0.5);
  });

  it('native finite numbers pass correctly', () => {
    const out = mapRiskObservationRow(baselineRow({
      device_risk_01:      0,
      network_risk_01:     0.25,
      identity_risk_01:    1,
      behavioural_risk_01: 0.5,
    }), null);
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.input.behavioural_risk_01).toBe(0.5);
  });

  it("empty string rejects INVALID_RISK_VALUE", () => {
    const out = mapRiskObservationRow(baselineRow({ behavioural_risk_01: '' }), null);
    expect(out.outcome).toBe('rejected');
    if (out.outcome !== 'rejected') return;
    expect(out.reason).toBe('INVALID_RISK_VALUE');
  });

  it("'NaN' / 'Infinity' / '-Infinity' / 'abc' all reject INVALID_RISK_VALUE", () => {
    for (const v of ['NaN', 'Infinity', '-Infinity', 'abc']) {
      const out = mapRiskObservationRow(baselineRow({ behavioural_risk_01: v }), null);
      expect(out.outcome).toBe('rejected');
      if (out.outcome !== 'rejected') continue;
      expect(out.reason).toBe('INVALID_RISK_VALUE');
    }
  });

  it("'-0.1' / '1.5' (out-of-range strings) reject INVALID_RISK_VALUE — no silent clamp", () => {
    for (const v of ['-0.1', '1.5', '2', '-1']) {
      const out = mapRiskObservationRow(baselineRow({ behavioural_risk_01: v }), null);
      expect(out.outcome).toBe('rejected');
      if (out.outcome !== 'rejected') continue;
      expect(out.reason).toBe('INVALID_RISK_VALUE');
    }
  });

  it('native NaN / Infinity reject INVALID_RISK_VALUE', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      const out = mapRiskObservationRow(baselineRow({ behavioural_risk_01: v }), null);
      expect(out.outcome).toBe('rejected');
      if (out.outcome !== 'rejected') continue;
      expect(out.reason).toBe('INVALID_RISK_VALUE');
    }
  });

  it('out-of-range native numbers reject INVALID_RISK_VALUE (no clamp, no round)', () => {
    for (const v of [-0.1, 1.0001, 2, -1]) {
      const out = mapRiskObservationRow(baselineRow({ behavioural_risk_01: v }), null);
      expect(out.outcome).toBe('rejected');
      if (out.outcome !== 'rejected') continue;
      expect(out.reason).toBe('INVALID_RISK_VALUE');
    }
  });

  it('velocity entries that are NaN / Infinity / non-numeric reject INVALID_RISK_VALUE', () => {
    const out1 = mapRiskObservationRow(baselineRow({ velocity: { events_per_second: NaN } }), null);
    expect(out1.outcome).toBe('rejected');
    if (out1.outcome === 'rejected') expect(out1.reason).toBe('INVALID_RISK_VALUE');

    const out2 = mapRiskObservationRow(baselineRow({ velocity: { events_per_second: Infinity } }), null);
    expect(out2.outcome).toBe('rejected');
    if (out2.outcome === 'rejected') expect(out2.reason).toBe('INVALID_RISK_VALUE');

    const out3 = mapRiskObservationRow(baselineRow({ velocity: { events_per_second: 'abc' as unknown as number } }), null);
    expect(out3.outcome).toBe('rejected');
    if (out3.outcome === 'rejected') expect(out3.reason).toBe('INVALID_RISK_VALUE');
  });
});

/* ==========================================================================
 * GROUP C — Stage 0 lookup truth table (PR#8a §5.1.1)
 * ========================================================================== */

describe('PR#8b — C. Stage 0 lookup truth table', () => {
  it('exact pointer + exactly 1 PK row resolves: use that Stage 0 context', async () => {
    const client = makeStubClient(async (sql) => {
      if (sql === SELECT_STAGE0_BY_DECISION_ID_SQL) {
        return { rows: [baselineStage0Row()], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const r = await processRowForTest(client, baselineRow());
    expect(r.outcome).toBe('envelope_built');
    if (r.outcome !== 'envelope_built') return;
    expect(r.envelope.eligibility.stage0_rule_id).toBe('no_stage0_exclusion');
    expect(r.envelope.eligibility.stage0_excluded).toBe(false);
    expect(r.envelope.source_versions.stage0_version).toBe('stage0-hard-exclusion-v0.2');
  });

  it('exact pointer + 0 PK rows: INVALID_STAGE0_CONTEXT (dangling pointer)', async () => {
    const client = makeStubClient(async (sql) => {
      if (sql === SELECT_STAGE0_BY_DECISION_ID_SQL) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const r = await processRowForTest(client, baselineRow());
    expect(r.outcome).toBe('rejected');
    if (r.outcome !== 'rejected') return;
    expect(r.reason).toBe('INVALID_STAGE0_CONTEXT');
    expect(r.detail).toMatch(/dangling pointer|0 stage0_decisions rows/);
  });

  it('multiple stage0_decision_id pointers in evidence_refs: INVALID_STAGE0_CONTEXT', async () => {
    const client = makeStubClient(async () => ({ rows: [], rowCount: 0 }));
    const row = baselineRow({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
        { table: 'stage0_decisions', stage0_decision_id: 'aaa', rule_id: 'no_stage0_exclusion' },
        { table: 'stage0_decisions', stage0_decision_id: 'bbb', rule_id: 'no_stage0_exclusion' },
      ],
    });
    const r = await processRowForTest(client, row);
    expect(r.outcome).toBe('rejected');
    if (r.outcome !== 'rejected') return;
    expect(r.reason).toBe('INVALID_STAGE0_CONTEXT');
    expect(r.detail).toMatch(/multiple exact pointers|2 stage0_decision_id pointers/);
  });

  it('no pointer + 0 fallback rows: no stage0 context, envelope still builds', async () => {
    const client = makeStubClient(async (sql) => {
      if (sql === SELECT_STAGE0_BY_LINEAGE_SQL) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const row = baselineRow({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
        // no stage0_decisions entry
      ],
    });
    const r = await processRowForTest(client, row);
    expect(r.outcome).toBe('envelope_built');
    if (r.outcome !== 'envelope_built') return;
    expect(r.envelope.eligibility.stage0_rule_id).toBeNull();
    expect(r.envelope.eligibility.stage0_excluded).toBe(false);
    expect(r.envelope.source_versions.stage0_version).toBeNull();
  });

  it('no pointer + exactly 1 fallback row: use that Stage 0 context', async () => {
    const client = makeStubClient(async (sql) => {
      if (sql === SELECT_STAGE0_BY_LINEAGE_SQL) {
        return { rows: [baselineStage0Row({ excluded: true, rule_id: 'known_bot_ua_family' })], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const row = baselineRow({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      ],
    });
    const r = await processRowForTest(client, row);
    expect(r.outcome).toBe('envelope_built');
    if (r.outcome !== 'envelope_built') return;
    expect(r.envelope.eligibility.stage0_excluded).toBe(true);
    expect(r.envelope.eligibility.stage0_rule_id).toBe('known_bot_ua_family');
    // PR#7b derives eligible_for_buyer_motion_risk_core from stage0.excluded
    expect(r.envelope.eligibility.eligible_for_buyer_motion_risk_core).toBe(false);
  });

  it('no pointer + ≥ 2 fallback rows: INVALID_STAGE0_CONTEXT', async () => {
    const client = makeStubClient(async (sql) => {
      if (sql === SELECT_STAGE0_BY_LINEAGE_SQL) {
        return { rows: [baselineStage0Row(), baselineStage0Row({ stage0_decision_id: 'other' })], rowCount: 2 };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const row = baselineRow({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      ],
    });
    const r = await processRowForTest(client, row);
    expect(r.outcome).toBe('rejected');
    if (r.outcome !== 'rejected') return;
    expect(r.reason).toBe('INVALID_STAGE0_CONTEXT');
    expect(r.detail).toMatch(/lineage fallback resolved 2/);
  });

  it('extractStage0Pointers ignores non-stage0 evidence_refs entries', () => {
    const refs: EvidenceRef[] = [
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions', stage0_decision_id: 'pointer-1' },
      { table: 'something_else', some_id: 'x' },
    ];
    const out = extractStage0Pointers(refs);
    expect(out.pointers).toEqual(['pointer-1']);
  });
});

/* ==========================================================================
 * GROUP D — Reject aggregation
 * ========================================================================== */

describe('PR#8b — D. Reject aggregation', () => {
  it('mixed batch produces correct per-reason counts', () => {
    const fixedMeta = baselineMetadata();
    // Build synthetic per-row outcomes — 1 envelope + various rejects.
    const results: ObserverRowResult[] = [
      // 1 envelope_built (via a tiny synthetic envelope object)
      {
        outcome: 'envelope_built',
        session_id: 'sess-pr8b-abcdef0123',
        envelope: {
          envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
          workspace_id: 'ws',
          site_id: 'site',
          session_id: 'sess-pr8b-abcdef0123',
          source_table: 'risk_observations_v0_1',
          source_identity: { risk_observation_id: 'id-1' },
          source_versions: {
            observation_version: 'risk-obs-v0.1',
            scoring_version: 's2.v1.0',
            behavioural_feature_version: 'behavioural-features-v0.3',
            stage0_version: null,
          },
          evidence_refs: [],
          normalized_risk_features: {
            velocity: {},
            device_risk_01: 0,
            network_risk_01: 0,
            identity_risk_01: 0,
            behavioural_risk_01: 0,
          },
          context_tags: ['REFRESH_LOOP_CANDIDATE'],
          eligibility: {
            stage0_excluded: false,
            stage0_rule_id: null,
            bridge_eligible: true,
            eligible_for_buyer_motion_risk_core: true,
          },
          provenance: {
            risk_observation_id: 'id-1',
            source_event_count: 0,
            record_only: true,
            derived_at: '2026-05-13T08:00:00.000Z',
          },
        },
      },
      { outcome: 'rejected', reason: 'MISSING_SBF_EVIDENCE_REF', session_id: 'sess-aaaaaaaa1111', detail: 'no SBF' },
      { outcome: 'rejected', reason: 'MISSING_SBF_EVIDENCE_REF', session_id: 'sess-bbbbbbbb2222', detail: 'no SBF' },
      { outcome: 'rejected', reason: 'INVALID_CONTEXT_TAG',      session_id: 'sess-cccccccc3333', detail: 'B_*' },
      { outcome: 'rejected', reason: 'INVALID_RISK_VALUE',       session_id: 'sess-dddddddd4444', detail: '1.5' },
      { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT',   session_id: 'sess-eeeeeeee5555', detail: '2 rows' },
    ];
    const report = aggregateReport({ results, rows_scanned: 6, sample_limit: 10, run_metadata: fixedMeta });
    expect(report.rows_scanned).toBe(6);
    expect(report.envelopes_built).toBe(1);
    expect(report.rejects).toBe(5);
    expect(report.reject_reasons.MISSING_SBF_EVIDENCE_REF).toBe(2);
    expect(report.reject_reasons.INVALID_CONTEXT_TAG).toBe(1);
    expect(report.reject_reasons.INVALID_RISK_VALUE).toBe(1);
    expect(report.reject_reasons.INVALID_STAGE0_CONTEXT).toBe(1);
    expect(report.missing_sbf_evidence_ref_count).toBe(2);
    expect(report.behavioural_feature_version_distribution['behavioural-features-v0.3']).toBe(1);
    expect(report.context_tag_distribution['REFRESH_LOOP_CANDIDATE']).toBe(1);
    expect(report.eligible_for_buyer_motion_risk_core_count).toBe(1);
    expect(report.stage0_excluded_count).toBe(0);
  });

  it('every RejectReason is initialised to 0 (even if not seen)', () => {
    const report = aggregateReport({ results: [], rows_scanned: 0, sample_limit: 10, run_metadata: baselineMetadata() });
    for (const r of REJECT_REASONS) {
      expect(report.reject_reasons[r]).toBe(0);
    }
  });

  it('classifyAdapterError maps adapter throw messages to taxonomy', () => {
    expect(classifyAdapterError('PR#7b bridge input invalid: workspace_id must be a non-empty string'))
      .toBe('MISSING_REQUIRED_ID');
    expect(classifyAdapterError('PR#7b bridge input invalid: behavioural_risk_01 must be a finite number in [0, 1]'))
      .toBe('INVALID_RISK_VALUE');
    expect(classifyAdapterError('PR#7b bridge input invalid: context_tags[0] — tag matches forbidden namespace prefix "B_"'))
      .toBe('INVALID_CONTEXT_TAG');
    expect(classifyAdapterError('something completely unexpected')).toBe('ADAPTER_VALIDATION_ERROR');
  });
});

/* ==========================================================================
 * GROUP E — Masking
 * ========================================================================== */

describe('PR#8b — E. Masking', () => {
  it('truncateSessionId returns 8 chars + ellipsis + 4 chars', () => {
    expect(truncateSessionId('sess-pr8b-abcdef0123')).toBe('sess-pr8…0123');
  });

  it('truncateSessionId returns *** for empty or very short IDs', () => {
    expect(truncateSessionId('')).toBe('***');
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('len11chars1')).toBe('***');
  });

  it('full session_id never appears in serialised report JSON', () => {
    const fullId = 'sess-pr8b-DO-NOT-LEAK-THIS-VALUE-EVER';
    const report = aggregateReport({
      results: [{
        outcome: 'envelope_built',
        session_id: fullId,
        envelope: {
          envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
          workspace_id: 'w', site_id: 's', session_id: fullId,
          source_table: 'risk_observations_v0_1',
          source_identity: { risk_observation_id: 'r' },
          source_versions: { observation_version: 'risk-obs-v0.1', scoring_version: 's2.v1.0', behavioural_feature_version: 'behavioural-features-v0.3', stage0_version: null },
          evidence_refs: [],
          normalized_risk_features: { velocity: {}, device_risk_01: 0, network_risk_01: 0, identity_risk_01: 0, behavioural_risk_01: 0 },
          context_tags: [],
          eligibility: { stage0_excluded: false, stage0_rule_id: null, bridge_eligible: true, eligible_for_buyer_motion_risk_core: true },
          provenance: { risk_observation_id: 'r', source_event_count: 0, record_only: true, derived_at: '2026-05-13T00:00:00.000Z' },
        },
      }],
      rows_scanned: 1, sample_limit: 10, run_metadata: baselineMetadata(),
    });
    const json = serialiseReport(report);
    // The full ID must NOT appear.
    expect(json.includes(fullId)).toBe(false);
    // The truncated form MUST appear in the sample list.
    expect(json.includes(truncateSessionId(fullId))).toBe(true);
  });

  it('forbidden field-name fixture strings do not leak through evidence_refs into the report', () => {
    // The aggregator never serialises the envelope itself — it
    // copies counts + truncated samples only. Even if a row's
    // evidence_refs carried these substring keys, the report JSON
    // must not contain them.
    const forbidden = ['token_hash', 'ip_hash', 'user_agent', 'pepper', 'bearer', 'authorization', 'raw_payload', 'canonical_jsonb', 'page_url'];
    const report = aggregateReport({
      results: [{
        outcome: 'envelope_built',
        session_id: 'sess-pr8b-abcdef0123',
        envelope: {
          envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
          workspace_id: 'w', site_id: 's', session_id: 'sess-pr8b-abcdef0123',
          source_table: 'risk_observations_v0_1',
          source_identity: { risk_observation_id: 'r' },
          source_versions: { observation_version: 'risk-obs-v0.1', scoring_version: 's2.v1.0', behavioural_feature_version: 'behavioural-features-v0.3', stage0_version: null },
          // evidence_refs carries a forbidden-looking subkey to test that the aggregator does NOT serialise it.
          evidence_refs: [{ table: 'session_behavioural_features_v0_2', feature_version: 'behavioural-features-v0.3', token_hash: 'LEAK', ip_hash: 'LEAK', user_agent: 'LEAK', pepper: 'LEAK', bearer: 'LEAK', authorization: 'LEAK', raw_payload: 'LEAK', canonical_jsonb: 'LEAK', page_url: 'LEAK' }],
          normalized_risk_features: { velocity: {}, device_risk_01: 0, network_risk_01: 0, identity_risk_01: 0, behavioural_risk_01: 0 },
          context_tags: [],
          eligibility: { stage0_excluded: false, stage0_rule_id: null, bridge_eligible: true, eligible_for_buyer_motion_risk_core: true },
          provenance: { risk_observation_id: 'r', source_event_count: 0, record_only: true, derived_at: '2026-05-13T00:00:00.000Z' },
        },
      }],
      rows_scanned: 1, sample_limit: 10, run_metadata: baselineMetadata(),
    });
    const json = serialiseReport(report);
    for (const f of forbidden) {
      expect(json.includes(f)).toBe(false);
    }
    expect(json.includes('LEAK')).toBe(false);
  });

  it('parseDatabaseUrl returns host + name and never echoes user/password', () => {
    const { host, name } = parseDatabaseUrl('postgres://user:secretpass@db.example.com:5432/buyerrecon_staging');
    expect(host).toBe('db.example.com:5432');
    expect(name).toBe('buyerrecon_staging');
    // The full secret never appears in the host/name pair.
    expect(host).not.toContain('secretpass');
    expect(name).not.toContain('secretpass');
  });

  it('parseDatabaseUrl tolerates undefined / unparseable inputs without throwing', () => {
    expect(parseDatabaseUrl(undefined).host).toBe('<unset>');
    expect(parseDatabaseUrl('').host).toBe('<unset>');
    expect(parseDatabaseUrl('not a url').host).toBe('<unparseable>');
  });
});

/* ==========================================================================
 * GROUP F — Report shape
 * ========================================================================== */

describe('PR#8b — F. Report shape', () => {
  it('every required field is present with the correct type', () => {
    const report: ObserverReport = aggregateReport({
      results: [], rows_scanned: 0, sample_limit: 10, run_metadata: baselineMetadata(),
    });
    expect(typeof report.rows_scanned).toBe('number');
    expect(typeof report.envelopes_built).toBe('number');
    expect(typeof report.rejects).toBe('number');
    expect(typeof report.reject_reasons).toBe('object');
    expect(typeof report.behavioural_feature_version_distribution).toBe('object');
    expect(typeof report.missing_sbf_evidence_ref_count).toBe('number');
    expect(typeof report.context_tag_distribution).toBe('object');
    expect(typeof report.stage0_excluded_count).toBe('number');
    expect(typeof report.eligible_for_buyer_motion_risk_core_count).toBe('number');
    expect(Array.isArray(report.sample_session_id_prefixes)).toBe(true);
    expect(report.run_metadata.source_table).toBe('risk_observations_v0_1');
    expect(report.run_metadata.bridge_envelope_version).toBe(RISK_CORE_BRIDGE_ENVELOPE_VERSION);
  });

  it('sample limit is respected', () => {
    const results: ObserverRowResult[] = [];
    for (let i = 0; i < 50; i++) {
      results.push({
        outcome: 'envelope_built',
        session_id: `sess-${String(i).padStart(8, '0')}-${String(i).padStart(4, '0')}`,
        envelope: {
          envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
          workspace_id: 'w', site_id: 's', session_id: `sess-${String(i).padStart(8, '0')}-${String(i).padStart(4, '0')}`,
          source_table: 'risk_observations_v0_1',
          source_identity: { risk_observation_id: String(i) },
          source_versions: { observation_version: 'risk-obs-v0.1', scoring_version: 's2.v1.0', behavioural_feature_version: 'behavioural-features-v0.3', stage0_version: null },
          evidence_refs: [],
          normalized_risk_features: { velocity: {}, device_risk_01: 0, network_risk_01: 0, identity_risk_01: 0, behavioural_risk_01: 0 },
          context_tags: [],
          eligibility: { stage0_excluded: false, stage0_rule_id: null, bridge_eligible: true, eligible_for_buyer_motion_risk_core: true },
          provenance: { risk_observation_id: String(i), source_event_count: 0, record_only: true, derived_at: '2026-05-13T00:00:00.000Z' },
        },
      });
    }
    const report = aggregateReport({ results, rows_scanned: 50, sample_limit: 7, run_metadata: baselineMetadata() });
    expect(report.sample_session_id_prefixes.length).toBe(7);
  });

  it('distributions sum to envelope_built totals', () => {
    const refsTagA = ['REFRESH_LOOP_CANDIDATE'];
    const refsTagB = ['HIGH_REQUEST_BURST', 'BYTESPIDER_PASSTHROUGH'];
    const mkEnv = (tags: string[]) => ({
      outcome: 'envelope_built' as const,
      session_id: 'sess-abcdefghijklmnop',
      envelope: {
        envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
        workspace_id: 'w', site_id: 's', session_id: 'sess-abcdefghijklmnop',
        source_table: 'risk_observations_v0_1' as const,
        source_identity: { risk_observation_id: 'r' },
        source_versions: { observation_version: 'risk-obs-v0.1', scoring_version: 's2.v1.0', behavioural_feature_version: 'behavioural-features-v0.3', stage0_version: null },
        evidence_refs: [],
        normalized_risk_features: { velocity: {}, device_risk_01: 0, network_risk_01: 0, identity_risk_01: 0, behavioural_risk_01: 0 },
        context_tags: tags,
        eligibility: { stage0_excluded: false, stage0_rule_id: null, bridge_eligible: true as const, eligible_for_buyer_motion_risk_core: true },
        provenance: { risk_observation_id: 'r', source_event_count: 0, record_only: true as const, derived_at: '2026-05-13T00:00:00.000Z' },
      },
    });
    const report = aggregateReport({
      results: [mkEnv(refsTagA), mkEnv(refsTagA), mkEnv(refsTagB)],
      rows_scanned: 3, sample_limit: 10, run_metadata: baselineMetadata(),
    });
    expect(report.envelopes_built).toBe(3);
    expect(report.context_tag_distribution['REFRESH_LOOP_CANDIDATE']).toBe(2);
    expect(report.context_tag_distribution['HIGH_REQUEST_BURST']).toBe(1);
    expect(report.context_tag_distribution['BYTESPIDER_PASSTHROUGH']).toBe(1);
  });
});

/* ==========================================================================
 * GROUP G — Static boundary tests
 * ========================================================================== */

describe('PR#8b — G. Static boundary discipline', () => {
  const FORBIDDEN_WRITE_SQL = [
    /INSERT\s+INTO/i,
    /UPDATE\s+\w+\s+SET/i,
    /DELETE\s+FROM/i,
    /TRUNCATE\b/i,
    /CREATE\s+TABLE/i,
    /ALTER\s+TABLE/i,
    /DROP\s+TABLE/i,
    /CREATE\s+INDEX/i,
    /GRANT\b/i,
    /REVOKE\b/i,
  ];

  it('observer source contains zero DML / DDL statements', () => {
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of FORBIDDEN_WRITE_SQL) {
        if (re.test(body)) {
          throw new Error(`PR#8b source ${name} contains forbidden SQL pattern /${re.source}/`);
        }
      }
    }
  });

  it('observer source contains zero references to scoring_output_lane_a / _b', () => {
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      if (/scoring_output_lane_a|scoring_output_lane_b/i.test(body)) {
        throw new Error(`PR#8b source ${name} references Lane A/B`);
      }
    }
  });

  it('observer source contains zero FROM/JOIN against raw upstream tables', () => {
    const forbiddenTables = [
      'accepted_events', 'rejected_events', 'ingest_requests',
      'session_features', 'session_behavioural_features_v0_2',
    ];
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const tbl of forbiddenTables) {
        // Match FROM <tbl> or JOIN <tbl> (case-insensitive, word boundaries).
        const re = new RegExp(`(?:FROM|JOIN)\\s+${tbl}\\b`, 'i');
        if (re.test(body)) {
          throw new Error(`PR#8b source ${name} contains FROM/JOIN against forbidden upstream table ${tbl}`);
        }
      }
    }
  });

  it('session_behavioural_features_v0_2 appears in observer source only as an evidence_refs literal (matched as a value, never read from SQL)', () => {
    // The literal MUST appear (mapper matches it against evidence_refs[].table).
    // It MUST NEVER appear in a FROM/JOIN clause (already enforced above).
    const mapperBody = stripTsComments(readFileSync(MAPPER_FILE, 'utf8'));
    expect(mapperBody.includes("'session_behavioural_features_v0_2'")).toBe(true);
    // Defence-in-depth: not present in sql.ts.
    const sqlBody = stripTsComments(readFileSync(SQL_FILE, 'utf8'));
    expect(/session_behavioural_features_v0_2/.test(sqlBody)).toBe(false);
  });

  it('observer source contains no imports from collector / app / server / auth', () => {
    const forbiddenImports = [
      /from\s+['"][^'"]*src\/collector\/v1/,
      /from\s+['"][^'"]*src\/app(\.|\/)/,
      /from\s+['"][^'"]*src\/server/,
      /from\s+['"][^'"]*src\/auth/,
    ];
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenImports) {
        if (re.test(body)) {
          throw new Error(`PR#8b source ${name} contains forbidden import matching /${re.source}/`);
        }
      }
    }
  });

  it('observer source contains no reason_code_dictionary / forbidden_codes / Trust / Policy / report imports', () => {
    const forbidden = [
      /reason_code_dictionary/i,
      /forbidden_codes\b/i,
      /from\s+['"][^'"]*src\/scoring\/trust/i,
      /from\s+['"][^'"]*src\/scoring\/policy/i,
      /from\s+['"][^'"]*src\/scoring\/report/i,
      /import\s+.*RiskOutput\b/,
      /import\s+.*RiskIndex\b/,
    ];
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbidden) {
        if (re.test(body)) {
          throw new Error(`PR#8b source ${name} contains forbidden reference matching /${re.source}/`);
        }
      }
    }
  });

  it('observer source contains no ML / truth-claim substrings', () => {
    const forbiddenSubstrings = [
      'import sklearn', 'from sklearn',
      'import torch',   'from torch',
      'import xgboost', 'from xgboost',
      'fraud_confirmed', 'bot_confirmed', 'ai_detected', 'is_real_buyer',
    ];
    for (const [name, path] of PR8B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const s of forbiddenSubstrings) {
        if (body.includes(s)) {
          throw new Error(`PR#8b source ${name} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });

  it('observer SQL allowlist: only risk_observations_v0_1 and stage0_decisions appear in FROM clauses', () => {
    const sqlBody = stripTsComments(readFileSync(SQL_FILE, 'utf8'));
    const fromMatches = sqlBody.match(/(?:FROM|JOIN)\s+([a-z0-9_]+)/gi) ?? [];
    const tables = new Set(fromMatches.map((m) => m.replace(/(?:FROM|JOIN)\s+/i, '').toLowerCase()));
    for (const t of tables) {
      expect(['risk_observations_v0_1', 'stage0_decisions']).toContain(t);
    }
  });

  it('CLI source defaults to read-only behaviour (no INSERT/UPDATE/DELETE in script)', () => {
    const body = stripTsComments(readFileSync(CLI_FILE, 'utf8'));
    expect(/INSERT\s+INTO/i.test(body)).toBe(false);
    expect(/UPDATE\s+\w+\s+SET/i.test(body)).toBe(false);
    expect(/DELETE\s+FROM/i.test(body)).toBe(false);
  });

  it('CLI source masks DATABASE_URL (no full URL stdout write)', () => {
    const body = stripTsComments(readFileSync(CLI_FILE, 'utf8'));
    // No `console.log(DATABASE_URL)` or stdout write of the raw URL.
    expect(/(?:process\.stdout\.write|console\.log)\([^)]*\bDATABASE_URL\b/.test(body)).toBe(false);
  });

  it('subtree forbidden-source-sweep over src/scoring/risk-core-bridge-observer/**', () => {
    const root = join(ROOT, 'src', 'scoring', 'risk-core-bridge-observer');
    const files = listTsFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const stripped = stripTsComments(readFileSync(f, 'utf8'));
      for (const s of ['import sklearn', 'import torch', 'fraud_confirmed', 'is_real_buyer']) {
        if (stripped.includes(s)) {
          throw new Error(`subtree sweep: ${f} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });
});

function listTsFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      const full = join(dir, name);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) { stack.push(full); continue; }
      if (/\.ts$/.test(full)) out.push(full);
    }
  }
  return out;
}

/* ==========================================================================
 * GROUP H — Codex blocker fix: SQL-path failures propagate to CLI exit 2
 *
 * PR#8a §10 requires the CLI to exit 2 on connection / SQL error.
 * The earlier implementation swallowed Stage 0 SQL failures as
 * row-level UNEXPECTED_ERROR rejects, which let the CLI exit 0 on
 * what should be exit 2. These tests prove that:
 *
 *   (a) A throw from the Stage 0 exact-pointer query propagates out
 *       of runRiskCoreBridgeObserver (the CLI then catches it and
 *       exits 2).
 *   (b) A throw from the Stage 0 fallback lineage query propagates
 *       out of runRiskCoreBridgeObserver.
 *   (c) Data-shape Stage 0 problems remain row-level
 *       INVALID_STAGE0_CONTEXT (the existing Group C tests cover
 *       dangling pointer / multiple pointers / multi-fallback
 *       rows — included again here for symmetry of intent).
 *   (d) Malformed `stage0_decision_id` values are pre-validated and
 *       become INVALID_STAGE0_CONTEXT BEFORE any SQL is issued.
 * ========================================================================== */

describe('PR#8b — H. Codex blocker: SQL-path failures propagate', () => {
  function makeRunOptions() {
    return {
      observation_version: 'risk-obs-v0.1',
      scoring_version:     's2.v1.0',
      workspace_id:        null,
      site_id:             null,
      window_start:        new Date('2026-05-12T00:00:00.000Z'),
      window_end:          new Date('2026-05-13T00:00:00.000Z'),
      limit:               100,
      sample_limit:        10,
    };
  }

  it('(a) Stage 0 exact-pointer query throw propagates out of runRiskCoreBridgeObserver', async () => {
    const sqlError = new Error('connection terminated unexpectedly during PK lookup');
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          // Return one PR#6 row whose evidence_refs carries a valid
          // stage0_decision_id pointer (forces Path A).
          return { rows: [baselineRow()], rowCount: 1 };
        }
        if (sql === SELECT_STAGE0_BY_DECISION_ID_SQL) {
          throw sqlError;
        }
        throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
      },
    };
    await expect(runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    })).rejects.toThrow(/connection terminated/);
  });

  it('(b) Stage 0 lineage fallback query throw propagates out of runRiskCoreBridgeObserver', async () => {
    const sqlError = new Error('permission denied for table stage0_decisions');
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          // Return one PR#6 row whose evidence_refs has NO stage0
          // pointer (forces Path B fallback).
          return {
            rows: [baselineRow({
              evidence_refs: [
                { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
              ],
            })],
            rowCount: 1,
          };
        }
        if (sql === SELECT_STAGE0_BY_LINEAGE_SQL) {
          throw sqlError;
        }
        throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
      },
    };
    await expect(runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    })).rejects.toThrow(/permission denied/);
  });

  it('(b\') primary risk_observations_v0_1 SELECT throw propagates out of runRiskCoreBridgeObserver', async () => {
    const sqlError = new Error('connection refused (host unreachable)');
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          throw sqlError;
        }
        throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
      },
    };
    await expect(runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    })).rejects.toThrow(/connection refused/);
  });

  it('(c) data-shape Stage 0 problems still produce a successful report with row-level INVALID_STAGE0_CONTEXT (no throw)', async () => {
    // Mixed batch: one dangling-pointer row + one multi-pointer row +
    // one valid row. Stage 0 queries return data (no SQL error).
    const stub = {
      async query(sql: string, params?: readonly unknown[]) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return {
            rows: [
              // Row 1 — valid pointer; SQL returns 1 row → use.
              baselineRow({ session_id: 'sess-valid-aaaaaaaaaaaa' }),
              // Row 2 — dangling pointer; SQL returns 0 rows.
              baselineRow({
                session_id: 'sess-dangling-bbbbbbbbbb',
                evidence_refs: [
                  { table: 'session_behavioural_features_v0_2', behavioural_features_id: 2, feature_version: 'behavioural-features-v0.3' },
                  { table: 'stage0_decisions', stage0_decision_id: '00000000-0000-4000-8000-0000000000bb', rule_id: 'no_stage0_exclusion' },
                ],
              }),
              // Row 3 — multiple pointers; rejected before SQL.
              baselineRow({
                session_id: 'sess-multi-cccccccccccc',
                evidence_refs: [
                  { table: 'session_behavioural_features_v0_2', behavioural_features_id: 3, feature_version: 'behavioural-features-v0.3' },
                  { table: 'stage0_decisions', stage0_decision_id: '00000000-0000-4000-8000-0000000000c1', rule_id: 'no_stage0_exclusion' },
                  { table: 'stage0_decisions', stage0_decision_id: '00000000-0000-4000-8000-0000000000c2', rule_id: 'no_stage0_exclusion' },
                ],
              }),
            ],
            rowCount: 3,
          };
        }
        if (sql === SELECT_STAGE0_BY_DECISION_ID_SQL) {
          const pointer = (params ?? [])[0] as string;
          if (pointer === '00000000-0000-4000-8000-0000000000aa') {
            return { rows: [baselineStage0Row()], rowCount: 1 };
          }
          if (pointer === '00000000-0000-4000-8000-0000000000bb') {
            return { rows: [], rowCount: 0 };  // dangling
          }
          return { rows: [], rowCount: 0 };
        }
        throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
      },
    };
    const report = await runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    });
    expect(report.rows_scanned).toBe(3);
    expect(report.envelopes_built).toBe(1);
    expect(report.rejects).toBe(2);
    expect(report.reject_reasons.INVALID_STAGE0_CONTEXT).toBe(2);
  });

  it('(d) malformed stage0_decision_id is rejected as INVALID_STAGE0_CONTEXT BEFORE any SQL is issued', async () => {
    // The stub throws on ANY Stage 0 SQL — proving pre-validation
    // short-circuits before issuing the $1::uuid query.
    const stub = makeStubClient(async (sql) => {
      // The SELECT constants begin with `\nSELECT` (template literal).
      if (sql.includes('FROM stage0_decisions')) {
        throw new Error('SQL must not be issued for malformed UUID');
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const row = baselineRow({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
        { table: 'stage0_decisions', stage0_decision_id: 'not-a-uuid', rule_id: 'no_stage0_exclusion' },
      ],
    });
    const r = await processRowForTest(stub, row);
    expect(r.outcome).toBe('rejected');
    if (r.outcome !== 'rejected') return;
    expect(r.reason).toBe('INVALID_STAGE0_CONTEXT');
    expect(r.detail).toMatch(/not a plausible UUID|before issuing SQL/i);
  });

  it('isPlausibleUuid accepts 8-4-4-4-12 hex (case-insensitive)', () => {
    expect(isPlausibleUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isPlausibleUuid('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true);
    expect(isPlausibleUuid('AbCdEf01-1234-5678-9aBc-DeF012345678')).toBe(true);
  });

  it('isPlausibleUuid rejects malformed strings', () => {
    expect(isPlausibleUuid('not-a-uuid')).toBe(false);
    expect(isPlausibleUuid('')).toBe(false);
    expect(isPlausibleUuid('00000000-0000-0000-0000-000000000001-extra')).toBe(false);
    expect(isPlausibleUuid('00000000_0000_0000_0000_000000000001')).toBe(false);  // wrong separators
    expect(isPlausibleUuid('00000000-0000-0000-0000-00000000000Z')).toBe(false);  // non-hex
    expect(isPlausibleUuid('00000000-0000-0000-0000-00000000000')).toBe(false);   // too short
    expect(isPlausibleUuid(123)).toBe(false);
    expect(isPlausibleUuid(null)).toBe(false);
    expect(isPlausibleUuid(undefined)).toBe(false);
  });
});

/* ==========================================================================
 * GROUP I — Codex re-review fix: malformed evidence_refs becomes row-level
 *                                MISSING_EVIDENCE_REFS (NOT a SQL exit-2)
 *
 * After the Group H blocker fix removed the broad try/catches, a
 * malformed `evidence_refs` value like `[null]` or `["bad"]` would
 * cause `extractStage0Pointers` to throw a TypeError on `.table`
 * access. With no surrounding catch, that throw would propagate
 * through processRow → runRiskCoreBridgeObserver → CLI catch →
 * exit 2 — but it is a DATA-shape problem (PR#8a §7.2), not a
 * SQL/connection failure.
 *
 * The patch:
 *   - processRow pre-validates evidence_refs SHAPE via
 *     `validateEvidenceRefsShape` BEFORE calling resolveStage0.
 *     Malformed shapes return row-level MISSING_EVIDENCE_REFS;
 *     no Stage 0 SQL is issued.
 *   - extractStage0Pointers is also defensive (skips non-plain-object
 *     entries) so any future caller is protected too.
 *
 * Group H's SQL-error propagation tests still pass (proven below by
 * running them again).
 * ========================================================================== */

describe('PR#8b — I. Codex re-review fix: malformed evidence_refs is a row-level reject (not a SQL exit-2)', () => {
  function makeRunOptions() {
    return {
      observation_version: 'risk-obs-v0.1',
      scoring_version:     's2.v1.0',
      workspace_id:        null,
      site_id:             null,
      window_start:        new Date('2026-05-12T00:00:00.000Z'),
      window_end:          new Date('2026-05-13T00:00:00.000Z'),
      limit:               100,
      sample_limit:        10,
    };
  }

  it('evidence_refs: [null] produces a successful observer report with rejects=1, MISSING_EVIDENCE_REFS=1; no throw', async () => {
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return {
            rows: [baselineRow({
              evidence_refs: [null] as unknown as Array<Record<string, unknown>>,
            })],
            rowCount: 1,
          };
        }
        // Any Stage 0 SQL is a test failure — the pre-guard should
        // short-circuit before any Stage 0 lookup runs.
        throw new Error('Stage 0 SQL must not be issued for malformed evidence_refs');
      },
    };
    const report = await runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    });
    expect(report.rows_scanned).toBe(1);
    expect(report.envelopes_built).toBe(0);
    expect(report.rejects).toBe(1);
    expect(report.reject_reasons.MISSING_EVIDENCE_REFS).toBe(1);
  });

  it('evidence_refs: ["bad"] produces a successful observer report with rejects=1, MISSING_EVIDENCE_REFS=1; no throw', async () => {
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return {
            rows: [baselineRow({
              evidence_refs: ['bad'] as unknown as Array<Record<string, unknown>>,
            })],
            rowCount: 1,
          };
        }
        throw new Error('Stage 0 SQL must not be issued for malformed evidence_refs');
      },
    };
    const report = await runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    });
    expect(report.rows_scanned).toBe(1);
    expect(report.envelopes_built).toBe(0);
    expect(report.rejects).toBe(1);
    expect(report.reject_reasons.MISSING_EVIDENCE_REFS).toBe(1);
  });

  it('evidence_refs: [] (empty) produces row-level MISSING_EVIDENCE_REFS, no Stage 0 SQL issued', async () => {
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return {
            rows: [baselineRow({ evidence_refs: [] })],
            rowCount: 1,
          };
        }
        throw new Error('Stage 0 SQL must not be issued for empty evidence_refs');
      },
    };
    const report = await runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    });
    expect(report.envelopes_built).toBe(0);
    expect(report.reject_reasons.MISSING_EVIDENCE_REFS).toBe(1);
  });

  it('evidence_refs entry with missing/empty .table → row-level MISSING_EVIDENCE_REFS, no Stage 0 SQL issued', async () => {
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return {
            rows: [baselineRow({
              evidence_refs: [{ behavioural_features_id: 7 /* missing table */ }] as unknown as Array<Record<string, unknown>>,
            })],
            rowCount: 1,
          };
        }
        throw new Error('Stage 0 SQL must not be issued for malformed evidence_refs entry');
      },
    };
    const report = await runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    });
    expect(report.reject_reasons.MISSING_EVIDENCE_REFS).toBe(1);
  });

  it('processRowForTest on malformed evidence_refs returns MISSING_EVIDENCE_REFS and does NOT issue Stage 0 SQL', async () => {
    let stage0SqlIssued = false;
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('FROM stage0_decisions')) {
        stage0SqlIssued = true;
        throw new Error('Stage 0 SQL must not be issued for malformed evidence_refs');
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    });
    const row = baselineRow({
      evidence_refs: [null] as unknown as Array<Record<string, unknown>>,
    });
    const r = await processRowForTest(stub, row);
    expect(r.outcome).toBe('rejected');
    if (r.outcome !== 'rejected') return;
    expect(r.reason).toBe('MISSING_EVIDENCE_REFS');
    expect(stage0SqlIssued).toBe(false);
  });

  it('validateEvidenceRefsShape direct tests cover the rejection paths', () => {
    // Non-array
    expect(validateEvidenceRefsShape(null).outcome).toBe('rejected');
    expect(validateEvidenceRefsShape(undefined).outcome).toBe('rejected');
    expect(validateEvidenceRefsShape('not-an-array').outcome).toBe('rejected');
    expect(validateEvidenceRefsShape(42).outcome).toBe('rejected');
    expect(validateEvidenceRefsShape({}).outcome).toBe('rejected');
    // Empty
    expect(validateEvidenceRefsShape([]).outcome).toBe('rejected');
    // null entry
    expect(validateEvidenceRefsShape([null]).outcome).toBe('rejected');
    // string entry
    expect(validateEvidenceRefsShape(['bad']).outcome).toBe('rejected');
    // number entry
    expect(validateEvidenceRefsShape([42]).outcome).toBe('rejected');
    // array entry
    expect(validateEvidenceRefsShape([['nested']]).outcome).toBe('rejected');
    // object missing .table
    expect(validateEvidenceRefsShape([{ behavioural_features_id: 1 }]).outcome).toBe('rejected');
    // object with empty .table
    expect(validateEvidenceRefsShape([{ table: '' }]).outcome).toBe('rejected');
    // object with non-string .table
    expect(validateEvidenceRefsShape([{ table: 42 }]).outcome).toBe('rejected');
    // Valid shape
    const ok = validateEvidenceRefsShape([
      { table: 'session_behavioural_features_v0_2', feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions', stage0_decision_id: '00000000-0000-4000-8000-0000000000aa' },
    ]);
    expect(ok.outcome).toBe('ok');
    if (ok.outcome === 'ok') {
      expect(ok.evidenceRefs).toHaveLength(2);
    }
  });

  it('extractStage0Pointers is defensive: malformed evidence_refs arrays do NOT throw', () => {
    // null entry — would previously throw TypeError on .table
    expect(() => extractStage0Pointers([null] as unknown as EvidenceRef[])).not.toThrow();
    // string entry
    expect(() => extractStage0Pointers(['bad'] as unknown as EvidenceRef[])).not.toThrow();
    // number entry
    expect(() => extractStage0Pointers([42] as unknown as EvidenceRef[])).not.toThrow();
    // array entry (Array.isArray would have been falsy on the inner type)
    expect(() => extractStage0Pointers([['nested']] as unknown as EvidenceRef[])).not.toThrow();
    // All-bad mix returns empty pointers
    const result = extractStage0Pointers([
      null, 'bad', 42, ['nested'],
    ] as unknown as EvidenceRef[]);
    expect(result.pointers).toEqual([]);
  });

  it('Group H SQL-propagation tests still pass: connection error during Stage 0 PK lookup → CLI catch path (rejects)', async () => {
    // Regression check: the Group I pre-guard does NOT swallow real
    // SQL errors. The primary SELECT returns a valid row with a valid
    // Stage 0 pointer; the Stage 0 PK SELECT throws a synthetic
    // connection error. The observer MUST reject (propagate), not
    // produce a successful report.
    const stub = {
      async query(sql: string) {
        if (sql === SELECT_RISK_OBSERVATIONS_SQL) {
          return { rows: [baselineRow()], rowCount: 1 };
        }
        if (sql === SELECT_STAGE0_BY_DECISION_ID_SQL) {
          throw new Error('Group I regression: connection terminated');
        }
        throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
      },
    };
    await expect(runRiskCoreBridgeObserver({
      client:         stub as unknown as Pool,
      options:        makeRunOptions(),
      database_host:  'h',
      database_name:  'd',
    })).rejects.toThrow(/Group I regression: connection terminated/);
  });
});

/* ==========================================================================
 * Auxiliary: mapStage0Row direct tests (the helper the runner uses)
 * ========================================================================== */

describe('PR#8b — auxiliary: mapStage0Row', () => {
  it('valid Stage 0 row maps to BridgeStage0Context', () => {
    const out = mapStage0Row(baselineStage0Row());
    expect(out.outcome).toBe('ok');
    if (out.outcome !== 'ok') return;
    expect(out.stage0.stage0_decision_id).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(out.stage0.excluded).toBe(false);
    expect(out.stage0.record_only).toBe(true);
  });

  it('rejects INVALID_STAGE0_CONTEXT when fields are missing', () => {
    const out = mapStage0Row(baselineStage0Row({ rule_id: '' }));
    expect(out.outcome).toBe('rejected');
    if (out.outcome !== 'rejected') return;
    expect(out.reason).toBe('INVALID_STAGE0_CONTEXT');
  });

  it('rejects INVALID_STAGE0_CONTEXT when record_only is not literal true', () => {
    const out = mapStage0Row(baselineStage0Row({ record_only: false as unknown as true }));
    expect(out.outcome).toBe('rejected');
    if (out.outcome !== 'rejected') return;
    expect(out.reason).toBe('INVALID_STAGE0_CONTEXT');
  });
});

/* ==========================================================================
 * Auxiliary: SELECT_RISK_OBSERVATIONS_SQL is a SELECT-only statement
 * ========================================================================== */

describe('PR#8b — auxiliary: SQL constants', () => {
  it('SELECT_RISK_OBSERVATIONS_SQL begins with SELECT and contains no write-statement keywords', () => {
    const sql = SELECT_RISK_OBSERVATIONS_SQL.trim();
    expect(sql.startsWith('SELECT')).toBe(true);
    // Word-boundary check so `created_at` does NOT substring-match CREATE.
    const upper = sql.toUpperCase();
    for (const kw of ['INSERT INTO', 'UPDATE ', 'DELETE FROM', 'TRUNCATE ', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'GRANT ', 'REVOKE ']) {
      expect(upper.includes(kw)).toBe(false);
    }
  });

  it('SELECT_STAGE0_BY_DECISION_ID_SQL is a parameterised SELECT on stage0_decisions PK', () => {
    expect(SELECT_STAGE0_BY_DECISION_ID_SQL).toContain('FROM stage0_decisions');
    expect(SELECT_STAGE0_BY_DECISION_ID_SQL).toContain('stage0_decision_id = $1');
  });

  it('SELECT_STAGE0_BY_LINEAGE_SQL is a parameterised SELECT keyed by (workspace_id, site_id, session_id)', () => {
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toContain('FROM stage0_decisions');
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toContain('workspace_id = $1');
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toContain('site_id      = $2');
    expect(SELECT_STAGE0_BY_LINEAGE_SQL).toContain('session_id   = $3');
  });
});
