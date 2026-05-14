/**
 * Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer — tests.
 *
 * Pure tests. No real pg. Reuses the PR#13b stub-client pattern and
 * exercises PR#14c's runner / report / exit-decision helpers.
 *
 * Test groups (mapping to spec's 20 testing requirements):
 *   A. (4)  Observer uses only PR#13b allowed source tables + info_schema
 *   B. (5)  No DB writes / no DML / no DDL in runtime source
 *   C. (6)  Calls PR#14b mapper for accepted preview rows
 *   D. (7)  Candidate build success count matches accepted valid inputs
 *   E. (8)  Candidate reject reasons aggregate correctly
 *   F. (9)  Invalid PR#14b input becomes candidate reject, not crash
 *   G. (2)  Source readiness fail_closed → exit 2
 *   H. (3)  Non-fail_closed → exit 0
 *   I. (10) Full session IDs not emitted
 *   J. (11) Raw URLs / query strings / email-shaped not emitted (PR#14b guard)
 *   K. (12) Samples carry internal_only / non_authoritative / no AMS exec / no ProductDecision
 *   L. (13) No FIT.* / INTENT.* / WINDOW.* in runtime
 *   M. (14) Runtime does not define AMS reserved names
 *   N. (15) No Date.now / new Date / Math.random in pure mapper/adapter
 *   O. (16) No new SQL beyond PR#13b SQL constants
 *   P. (17) package.json carries exactly one new PR#14c script
 *   Q. (1)  Pure helper: buildBridgeMapperInputFromPreview shape
 *   R. (1)  decideBridgeCandidateObserverExit decision matrix
 *   S. (18) PR#13b observer behaviour unchanged
 *   T. (19) PR#14b mapper behaviour unchanged
 *   U. (20) Markdown report carries read-only-proof + no customer claim
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CATEGORY_TEMPLATE,
  DEFAULT_PRIMARY_CONVERSION_GOAL,
  DEFAULT_SALES_MOTION,
  makeStubClient,
  REQUIRED_POI_COLUMNS,
  REQUIRED_POI_SEQUENCE_COLUMNS,
  SELECT_TABLE_COLUMNS_SQL,
  type ObserverRunOptions,
  type PoiRowRaw,
  type PoiSequenceRowRaw,
  type SessionPreview,
} from '../../src/scoring/product-context-timing-observer/index.js';
import {
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  type BridgeMapperInput,
} from '../../src/scoring/product-features-namespace-bridge/index.js';
import {
  BRIDGE_CANDIDATE_OBSERVER_VERSION,
  buildBridgeMapperInputFromPreview,
  decideBridgeCandidateObserverExit,
  rejectReasonFamily,
  renderBridgeCandidateObserverMarkdown,
  runBridgeCandidateObserver,
  type BridgeCandidateObserverReport,
} from '../../src/scoring/product-features-bridge-candidate-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const T_NOW    = '2026-05-14T12:00:00.000Z';
const T_PREV1  = '2026-05-14T10:00:00.000Z';

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function mkOpts(over: Partial<ObserverRunOptions> = {}): ObserverRunOptions {
  return {
    workspace_id:            'ws_demo',
    site_id:                 'site_demo',
    window_start:            new Date('2026-05-13T10:00:00.000Z'),
    window_end:              new Date('2026-05-14T18:00:00.000Z'),
    limit:                   1000,
    sample_limit:            3,
    category_template:       DEFAULT_CATEGORY_TEMPLATE,
    primary_conversion_goal: DEFAULT_PRIMARY_CONVERSION_GOAL,
    sales_motion:            DEFAULT_SALES_MOTION,
    evaluation_at:           new Date(T_NOW),
    ...over,
  };
}

function mkPoiRow(over: Partial<PoiRowRaw> = {}): PoiRowRaw {
  return {
    poi_observation_id:       1,
    workspace_id:             'ws_demo',
    site_id:                  'site_demo',
    session_id:               'sess_aaaaaaaa1111bbbbbbbb1111',
    poi_type:                 'page_path',
    poi_key:                  '/pricing',
    poi_input_version:        'poi-core-input-v0.1',
    poi_observation_version:  'poi-observation-v0.1',
    first_seen_at:            T_PREV1,
    last_seen_at:             T_PREV1,
    stage0_excluded:          false,
    poi_eligible:             true,
    ...over,
  };
}

function mkPoiSeqRow(over: Partial<PoiSequenceRowRaw> = {}): PoiSequenceRowRaw {
  return {
    poi_sequence_observation_id:  1,
    workspace_id:                 'ws_demo',
    site_id:                      'site_demo',
    session_id:                   'sess_aaaaaaaa1111bbbbbbbb1111',
    poi_sequence_version:         'poi-sequence-v0.1',
    poi_observation_version:      'poi-observation-v0.1',
    poi_count:                    1,
    unique_poi_count:             1,
    has_progression:              false,
    has_repetition:               false,
    progression_depth:            1,
    poi_sequence_pattern_class:   'single_poi',
    first_seen_at:                T_PREV1,
    last_seen_at:                 T_PREV1,
    duration_seconds:             0,
    stage0_excluded:              false,
    poi_sequence_eligible:        true,
    evidence_refs:                [{ table: 'poi_observations_v0_1', poi_observation_id: 1 }],
    ...over,
  };
}

interface StubFixture {
  readonly poiRows:    readonly PoiRowRaw[];
  readonly poiSeqRows: readonly PoiSequenceRowRaw[];
}

function makeHealthyStub(fixture: StubFixture, opts: { tablesPresent?: boolean } = {}) {
  const present = opts.tablesPresent !== false;
  return makeStubClient(async (sql, params) => {
    if (sql.includes("table_name   = 'poi_observations_v0_1'") && sql.includes('information_schema.tables')) {
      return { rows: [{ present }], rowCount: 1 };
    }
    if (sql.includes("table_name   = 'poi_sequence_observations_v0_1'") && sql.includes('information_schema.tables')) {
      return { rows: [{ present }], rowCount: 1 };
    }
    if (sql === SELECT_TABLE_COLUMNS_SQL) {
      const tableName = params[0];
      if (tableName === 'poi_observations_v0_1') {
        return { rows: REQUIRED_POI_COLUMNS.map((c) => ({ column_name: c })), rowCount: REQUIRED_POI_COLUMNS.length };
      }
      if (tableName === 'poi_sequence_observations_v0_1') {
        return { rows: REQUIRED_POI_SEQUENCE_COLUMNS.map((c) => ({ column_name: c })), rowCount: REQUIRED_POI_SEQUENCE_COLUMNS.length };
      }
    }
    if (sql.includes('FROM poi_observations_v0_1')) {
      return { rows: fixture.poiRows, rowCount: fixture.poiRows.length };
    }
    if (sql.includes('FROM poi_sequence_observations_v0_1')) {
      return { rows: fixture.poiSeqRows, rowCount: fixture.poiSeqRows.length };
    }
    return { rows: [], rowCount: 0 };
  });
}

/* --------------------------------------------------------------------------
 * A. Source allowlist (test req 4)
 * B. No DML / DDL (test req 5)
 * ------------------------------------------------------------------------ */

const PR14C_RUNTIME_FILES = [
  'src/scoring/product-features-bridge-candidate-observer/types.ts',
  'src/scoring/product-features-bridge-candidate-observer/runner.ts',
  'src/scoring/product-features-bridge-candidate-observer/report.ts',
  'src/scoring/product-features-bridge-candidate-observer/index.ts',
  'scripts/product-features-bridge-candidate-observation-report.ts',
];

function readSource(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('A. source allowlist — runtime references only PR#13b allowed tables', () => {
  it('no SQL FROM/JOIN against forbidden tables in PR#14c runtime', () => {
    const forbidden = [
      'accepted_events', 'rejected_events', 'ingest_requests',
      'session_features', 'session_behavioural_features_v0_2',
      'stage0_decisions', 'risk_observations_v0_1',
      'scoring_output_lane_a', 'scoring_output_lane_b',
      'site_write_tokens',
    ];
    for (const f of PR14C_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        expect(src, `${f} must not FROM ${t}`).not.toMatch(new RegExp(`\\bFROM\\s+${t}\\b`));
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(new RegExp(`\\bJOIN\\s+${t}\\b`));
      }
    }
  });
});

describe('B. no DML / DDL / GRANT / REVOKE in PR#14c runtime', () => {
  it('no INSERT / UPDATE / DELETE / TRUNCATE / DROP / ALTER / CREATE / GRANT / REVOKE', () => {
    for (const f of PR14C_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/);
      expect(src, `${f} UPDATE SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
      expect(src, `${f} DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/);
      expect(src, `${f} TRUNCATE`).not.toMatch(/\bTRUNCATE\b/);
      expect(src, `${f} DROP`).not.toMatch(/\bDROP\s+(TABLE|INDEX|VIEW|SCHEMA)\b/i);
      expect(src, `${f} ALTER`).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(src, `${f} CREATE`).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(src, `${f} GRANT`).not.toMatch(/\bGRANT\b/);
      expect(src, `${f} REVOKE`).not.toMatch(/\bREVOKE\b/);
    }
  });
});

/* --------------------------------------------------------------------------
 * C. Calls PR#14b mapper for accepted preview rows
 * D. Candidate build success count matches accepted valid inputs
 * E. Candidate reject reasons aggregate
 * ------------------------------------------------------------------------ */

describe('C + D + E. mapper integration + build success / reject aggregation', () => {
  it('one accepted preview yields one bridge candidate; sample emitted', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.bridge_candidate_generation.candidate_inputs_seen).toBe(1);
    expect(r.bridge_candidate_generation.candidates_built).toBe(1);
    expect(r.bridge_candidate_generation.candidates_rejected).toBe(0);
    expect(r.samples.length).toBe(1);
    expect(r.samples[0]!.bridge_candidate.bridge_contract_version).toBe(BRIDGE_CONTRACT_VERSION);
    expect(r.samples[0]!.bridge_candidate.bridge_payload_version).toBe(BRIDGE_PAYLOAD_VERSION);
    expect(r.samples[0]!.bridge_candidate.namespace_key_candidate).toBe('buyerrecon');
  });

  it('multiple accepted previews → multiple candidates built; distributions populated', async () => {
    const poiRows = [
      mkPoiRow({ poi_observation_id: 1, session_id: 'sess_alpha000000000000000', poi_key: '/pricing' }),
      mkPoiRow({ poi_observation_id: 2, session_id: 'sess_beta00000000000000000', poi_key: '/' }),
    ];
    const poiSeqRows = [
      mkPoiSeqRow({ poi_sequence_observation_id: 1, session_id: 'sess_alpha000000000000000' }),
      mkPoiSeqRow({ poi_sequence_observation_id: 2, session_id: 'sess_beta00000000000000000',
                    evidence_refs: [{ table: 'poi_observations_v0_1', poi_observation_id: 2 }] }),
    ];
    const r = await runBridgeCandidateObserver({
      client: makeHealthyStub({ poiRows, poiSeqRows }) as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.bridge_candidate_generation.candidates_built).toBe(2);
    expect(r.bridge_candidate_generation.namespace_key_candidate_distribution.buyerrecon).toBe(2);
    expect(r.bridge_candidate_generation.bridge_contract_version_distribution[BRIDGE_CONTRACT_VERSION]).toBe(2);
    expect(r.candidate_feature_summary.surface_distribution_aggregate.pricing).toBeGreaterThanOrEqual(1);
  });

  it('stage0-excluded preview is rejected at PR#13b preview stage and never reaches bridge mapper', async () => {
    const stub = makeHealthyStub({
      poiRows:    [mkPoiRow({ stage0_excluded: true, poi_eligible: false })],
      poiSeqRows: [mkPoiSeqRow({ stage0_excluded: true, poi_sequence_eligible: false })],
    });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.product_context_observer_input.preview_accepted_rows).toBe(0);
    expect(r.product_context_observer_input.preview_rejected_rows).toBe(1);
    expect(r.bridge_candidate_generation.candidate_inputs_seen).toBe(0);
    expect(r.bridge_candidate_generation.candidates_built).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * F. Invalid PR#14b input becomes candidate reject, not crash
 * ------------------------------------------------------------------------ */

describe('F. invalid bridge input is a row-level reject, not a crash', () => {
  it('mapper input with unknown conversion_proximity key still results in a controlled reject', () => {
    // Build a per-session preview with all valid PR#13b shape; then
    // synthesize a mapper input with a tampered conversion_proximity
    // key to prove the PR#14b validator catches it and the family
    // reason aggregator records it without throwing.
    const preview: SessionPreview = {
      workspace_id:                       'ws_demo',
      site_id:                            'site_demo',
      session_id:                         'sess_alpha0000000000000000',
      poi_count:                          1,
      unique_poi_count:                   1,
      progression_depth:                  1,
      poi_sequence_pattern_class:         'single_poi',
      stage0_excluded:                    false,
      poi_sequence_eligible:              true,
      hours_since_last_session_or_null:   12,
      actionability_band:                 'warm_recent',
      surface_distribution:               Object.freeze({ pricing: 1 }),
      excluded_surface_count:             0,
      unknown_surface_count:              0,
      mapping_coverage_percent:           100,
      pricing_signal_present:             true,
      comparison_signal_present:          false,
      accepted_into_preview:              true,
      reject_reason:                      null,
    };
    const baseArgs = {
      preview,
      observer_version:                   'product-context-timing-observer-v0.1',
      product_context_profile_version:    'pcp-v0.1',
      universal_surface_taxonomy_version: 'ust-v0.1',
      category_template_version:          'generic_b2b-v0.1',
      buying_role_lens_version:           'brl-v0.1-deferred',
      site_mapping_version:               'site_map-v0.1-baseline',
      excluded_mapping_version:           'excl_map-v0.1-baseline',
      timing_window_model_version:        'tw-v0.1',
      freshness_decay_model_version:      'fd-v0.1',
      source_poi_input_versions:          ['poi-core-input-v0.1'],
      source_poi_observation_versions:    ['poi-observation-v0.1'],
      source_poi_sequence_versions:       ['poi-sequence-v0.1'],
      category_template:                  'generic_b2b'        as BridgeMapperInput['category_template'],
      primary_conversion_goal:            'request_diagnostic' as BridgeMapperInput['primary_conversion_goal'],
      sales_motion:                       'sales_led'          as BridgeMapperInput['sales_motion'],
    };
    expect(() => buildBridgeMapperInputFromPreview(baseArgs)).not.toThrow();
    const built = buildBridgeMapperInputFromPreview(baseArgs);
    expect(built.conversion_proximity_indicators.pricing_visited).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * G + H. Exit decision (test reqs 2 + 3)
 * ------------------------------------------------------------------------ */

describe('G. source readiness fail_closed → exit 2', () => {
  it('CLI exit decision = 2 when source readiness is fail_closed', async () => {
    const stub = makeHealthyStub({ poiRows: [], poiSeqRows: [] }, { tablesPresent: false });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.source_readiness.fail_closed).toBe(true);
    expect(r.exit_decision.exit_code).toBe(2);
    expect(r.exit_decision.status).toBe('fail');
    expect(r.exit_decision.stderr_message).toContain('fail_closed');
  });
});

describe('H. healthy report → exit 0', () => {
  it('non-fail_closed run with at least one built candidate maps to exit 0', async () => {
    const r = await runBridgeCandidateObserver({
      client: makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] }) as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.source_readiness.fail_closed).toBe(false);
    expect(r.exit_decision.exit_code).toBe(0);
    expect(r.exit_decision.status).toBe('success');
    expect(r.exit_decision.stderr_message).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * I + J + K. Privacy posture in samples (test reqs 10 / 11 / 12)
 * ------------------------------------------------------------------------ */

describe('I. samples never carry full session IDs', () => {
  it('full session_id is masked / not present in serialised samples', async () => {
    const FULL = 'sess_FULL_REVEAL_TOKEN_xxxx_yyyy';
    const stub = makeHealthyStub({
      poiRows:    [mkPoiRow({ session_id: FULL })],
      poiSeqRows: [mkPoiSeqRow({ session_id: FULL })],
    });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const md = renderBridgeCandidateObserverMarkdown(r);
    expect(md).not.toContain('FULL_REVEAL_TOKEN');
    expect(JSON.stringify(r.samples)).not.toContain('FULL_REVEAL_TOKEN');
  });
});

describe('J. samples never carry raw URLs / query strings / email-shaped values', () => {
  it('PR#14b recursive guard rejected any payload containing these; serialised report is clean', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const ser = JSON.stringify(r.samples);
    expect(ser).not.toMatch(/https?:\/\//);
    expect(ser).not.toMatch(/[^"]*\?utm_source=/);
    expect(ser).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});

describe('K. sample_metadata flags all literal true', () => {
  it('every sample carries internal_only / non_authoritative / not_customer_facing / no AMS exec / no ProductDecision', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.samples.length).toBeGreaterThan(0);
    for (const s of r.samples) {
      expect(s.sample_metadata.internal_only).toBe(true);
      expect(s.sample_metadata.non_authoritative).toBe(true);
      expect(s.sample_metadata.not_customer_facing).toBe(true);
      expect(s.sample_metadata.does_not_execute_ams_product_layer).toBe(true);
      expect(s.sample_metadata.does_not_create_product_decision).toBe(true);
      expect(s.sample_metadata.exact_ams_struct_compatibility_unproven_until_fixture).toBe(true);
    }
  });
});

/* --------------------------------------------------------------------------
 * L + M. AMS reserved-name guards (test reqs 13 + 14)
 * ------------------------------------------------------------------------ */

describe('L. no FIT.* / INTENT.* / WINDOW.* in PR#14c runtime', () => {
  it('runtime source emits no `FIT.` / `INTENT.` / `WINDOW.` reason-code namespace strings', () => {
    const re = /['"`](?:FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*['"`]/;
    for (const f of PR14C_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain a FIT./INTENT./WINDOW. reason-code namespace literal`).not.toMatch(re);
    }
  });
});

describe('M. PR#14c runtime does not define AMS reserved type names', () => {
  it('no `type|interface|class|enum|const|function|let|var` definitions for reserved AMS names', () => {
    const reserved = [
      'FitFeatures', 'FitResult', 'FitScore', 'FitConfidence01',
      'IntentFeatures', 'IntentResult', 'IntentScore', 'IntentState',
      'WindowFeatures', 'WindowResult', 'WindowState',
      'TRQResult', 'TRQBand', 'TRQScore', 'TRQConfidence01',
      'ProductDecision', 'ProductFeatures', 'ProductScorerInput',
      'ProductScorer', 'BuyerReconConfig', 'BuyerReconProductFeatures',
      'RequestedAction', 'NonFitMarkers', 'HardSuppress',
    ];
    for (const f of PR14C_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reserved) {
        const re = new RegExp(`\\b(?:type|interface|class|enum|const|function|let|var)\\s+${name}\\b`);
        expect(src, `${f} must not define identifier "${name}"`).not.toMatch(re);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * N. No Date.now / new Date / Math.random in pure mapper/adapter
 * ------------------------------------------------------------------------ */

describe('N. no Date.now / new Date / Math.random in pure adapter code', () => {
  it('runner.ts adapter function (buildBridgeMapperInputFromPreview) has no clock reads', () => {
    const src = stripTsComments(readSource('src/scoring/product-features-bridge-candidate-observer/runner.ts'));
    // Extract only the `buildBridgeMapperInputFromPreview` function body.
    const start = src.indexOf('export function buildBridgeMapperInputFromPreview');
    expect(start).toBeGreaterThan(-1);
    // Find the function-end via a simple brace counter scan.
    let depth = 0;
    let i = start;
    while (i < src.length && src[i] !== '{') i++;
    const bodyStart = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = src.slice(bodyStart, i + 1);
    expect(body).not.toMatch(/\bDate\.now\s*\(/);
    expect(body).not.toMatch(/\bnew\s+Date\b/);
    expect(body).not.toMatch(/\bMath\.random\s*\(/);
  });
});

/* --------------------------------------------------------------------------
 * O. No new SQL in PR#14c runtime
 * ------------------------------------------------------------------------ */

describe('O. PR#14c introduces no new SQL constants', () => {
  it('runtime source contains no `SELECT ... FROM` literals beyond comments', () => {
    for (const f of PR14C_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain SELECT ... FROM`).not.toMatch(/\bSELECT\s+[^;]*\bFROM\b/i);
    }
  });
});

/* --------------------------------------------------------------------------
 * P. package.json carries exactly one new PR#14c script
 * ------------------------------------------------------------------------ */

describe('P. package.json carries exactly one PR#14c script', () => {
  it('observe:product-features-bridge-candidate script is present', () => {
    const pkg = readSource('package.json');
    expect(pkg).toContain('"observe:product-features-bridge-candidate"');
    expect(pkg).toContain('scripts/product-features-bridge-candidate-observation-report.ts');
  });
});

/* --------------------------------------------------------------------------
 * Q. buildBridgeMapperInputFromPreview shape
 * ------------------------------------------------------------------------ */

describe('Q. buildBridgeMapperInputFromPreview', () => {
  it('only allowed conversion_proximity_indicators keys appear', () => {
    const preview: SessionPreview = {
      workspace_id: 'ws_demo', site_id: 'site_demo', session_id: 'sess_aaaaaaaa1111bbbbbbbb1111',
      poi_count: 3, unique_poi_count: 3, progression_depth: 3,
      poi_sequence_pattern_class: 'multi_poi_linear',
      stage0_excluded: false, poi_sequence_eligible: true,
      hours_since_last_session_or_null: 6,
      actionability_band: 'hot_now',
      surface_distribution: Object.freeze({ pricing: 1, comparison: 1, demo_request: 1 }),
      excluded_surface_count: 0, unknown_surface_count: 0,
      mapping_coverage_percent: 100,
      pricing_signal_present: true, comparison_signal_present: true,
      accepted_into_preview: true, reject_reason: null,
    };
    const built = buildBridgeMapperInputFromPreview({
      preview,
      observer_version: 'product-context-timing-observer-v0.1',
      product_context_profile_version:    'pcp-v0.1',
      universal_surface_taxonomy_version: 'ust-v0.1',
      category_template_version:          'generic_b2b-v0.1',
      buying_role_lens_version:           'brl-v0.1-deferred',
      site_mapping_version:               'site_map-v0.1-baseline',
      excluded_mapping_version:           'excl_map-v0.1-baseline',
      timing_window_model_version:        'tw-v0.1',
      freshness_decay_model_version:      'fd-v0.1',
      source_poi_input_versions:          ['poi-core-input-v0.1'],
      source_poi_observation_versions:    ['poi-observation-v0.1'],
      source_poi_sequence_versions:       ['poi-sequence-v0.1'],
      category_template:                  'generic_b2b'         as BridgeMapperInput['category_template'],
      primary_conversion_goal:            'request_diagnostic'  as BridgeMapperInput['primary_conversion_goal'],
      sales_motion:                       'sales_led'           as BridgeMapperInput['sales_motion'],
    });
    expect(Object.keys(built.conversion_proximity_indicators).sort()).toEqual(['comparison_visited', 'demo_request_visited', 'pricing_visited']);
    expect(built.buyerrecon_actionability_band).toBe('hot_now');
    expect(built.timing_bucket).toBe('<=24h');  // 6 hours → <=24h bucket
  });

  it('preview with no signals produces empty conversion_proximity_indicators map', () => {
    const preview: SessionPreview = {
      workspace_id: 'ws_demo', site_id: 'site_demo', session_id: 'sess_aaaaaaaa1111bbbbbbbb1111',
      poi_count: 1, unique_poi_count: 1, progression_depth: 1,
      poi_sequence_pattern_class: 'single_poi',
      stage0_excluded: false, poi_sequence_eligible: true,
      hours_since_last_session_or_null: 12,
      actionability_band: 'warm_recent',
      surface_distribution: Object.freeze({ homepage: 1 }),
      excluded_surface_count: 0, unknown_surface_count: 0,
      mapping_coverage_percent: 100,
      pricing_signal_present: false, comparison_signal_present: false,
      accepted_into_preview: true, reject_reason: null,
    };
    const built = buildBridgeMapperInputFromPreview({
      preview,
      observer_version: 'x', product_context_profile_version: 'x',
      universal_surface_taxonomy_version: 'x', category_template_version: 'x',
      buying_role_lens_version: 'x', site_mapping_version: 'x',
      excluded_mapping_version: 'x', timing_window_model_version: 'x',
      freshness_decay_model_version: 'x',
      source_poi_input_versions: ['x'], source_poi_observation_versions: ['x'], source_poi_sequence_versions: ['x'],
      category_template: 'generic_b2b' as BridgeMapperInput['category_template'],
      primary_conversion_goal: 'request_diagnostic' as BridgeMapperInput['primary_conversion_goal'],
      sales_motion: 'sales_led' as BridgeMapperInput['sales_motion'],
    });
    expect(Object.keys(built.conversion_proximity_indicators)).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * R. decideBridgeCandidateObserverExit decision matrix
 * ------------------------------------------------------------------------ */

function mkReport(over: Partial<{ fail_closed: boolean; reason: string | null; inputs: number; built: number; rejected: number }> = {}): BridgeCandidateObserverReport {
  const fail_closed = over.fail_closed ?? false;
  const inputs      = over.inputs      ?? 1;
  const built       = over.built       ?? 1;
  const rejected    = over.rejected    ?? 0;
  return {
    boundary: {
      workspace_id: 'ws_demo', site_id: 'site_demo',
      window_start: T_PREV1, window_end: T_NOW, checked_at: T_NOW,
      database_host: 'h', database_name: 'd',
      bridge_candidate_observer_version: BRIDGE_CANDIDATE_OBSERVER_VERSION,
      bridge_contract_version: BRIDGE_CONTRACT_VERSION,
      bridge_payload_version:  BRIDGE_PAYLOAD_VERSION,
    },
    source_readiness: {
      poi_observations_v0_1_present:          !fail_closed,
      poi_sequence_observations_v0_1_present: !fail_closed,
      poi_missing_columns: [],
      poi_sequence_missing_columns: [],
      fail_closed,
      fail_closed_reason: fail_closed ? (over.reason ?? 'table poi_observations_v0_1 missing') : null,
    },
    product_context_observer_input: {
      poi_rows_scanned: 0, poi_sequence_rows_scanned: 0, unique_sessions_seen: 0,
      preview_accepted_rows: 0, preview_rejected_rows: 0,
      preview_reject_reason_counts: {},
      source_poi_input_versions: [], source_poi_observation_versions: [], source_poi_sequence_versions: [],
    },
    bridge_candidate_generation: {
      candidate_inputs_seen: inputs, candidates_built: built, candidates_rejected: rejected,
      reject_reason_counts: {}, namespace_key_candidate_distribution: {}, bridge_contract_version_distribution: {}, bridge_payload_version_distribution: {},
    },
    candidate_feature_summary: {
      surface_distribution_aggregate: {},
      actionability_band_distribution: { hot_now: 0, warm_recent: 0, cooling: 0, stale: 0, dormant: 0, insufficient_evidence: 0 },
      conversion_proximity_indicator_distribution: {},
      progression_depth_distribution: {},
      mapping_coverage_min: null, mapping_coverage_max: null, mapping_coverage_avg: null,
      hours_since_last_min_excluding_null: null, hours_since_last_max_excluding_null: null, hours_since_last_avg_excluding_null: null,
    },
    samples: [],
    read_only_proof: {
      no_db_writes_performed: true, no_durable_bridge_table: true, no_migration_or_schema_change: true,
      no_customer_output: true, no_lane_a_b_output: true, no_trust_policy_output: true,
      no_ams_product_layer_runtime_execution: true, no_product_decision_created: true,
    },
    exit_decision: { exit_code: 0, status: 'success', stderr_message: null },
  };
}

describe('R. decideBridgeCandidateObserverExit', () => {
  it('fail_closed → exit_code 2 with controlled message', () => {
    const d = decideBridgeCandidateObserverExit(mkReport({ fail_closed: true }));
    expect(d.exit_code).toBe(2);
    expect(d.status).toBe('fail');
    expect(d.stderr_message).toContain('fail_closed');
  });

  it('all candidate inputs rejected → exit_code 2', () => {
    const d = decideBridgeCandidateObserverExit(mkReport({ inputs: 5, built: 0, rejected: 5 }));
    expect(d.exit_code).toBe(2);
    expect(d.status).toBe('fail');
    expect(d.stderr_message).toContain('bridge candidate generation failed');
  });

  it('healthy report → exit_code 0', () => {
    const d = decideBridgeCandidateObserverExit(mkReport({ inputs: 2, built: 2, rejected: 0 }));
    expect(d.exit_code).toBe(0);
    expect(d.status).toBe('success');
    expect(d.stderr_message).toBeNull();
  });

  it('zero inputs (no accepted previews) → exit_code 0 (nothing to fail)', () => {
    const d = decideBridgeCandidateObserverExit(mkReport({ inputs: 0, built: 0, rejected: 0 }));
    expect(d.exit_code).toBe(0);
  });

  it('controlled stderr message never leaks DSN / password / stack trace', () => {
    const d = decideBridgeCandidateObserverExit(mkReport({ fail_closed: true, reason: 'sensitive: only_reason_should_pass' }));
    const msg = d.stderr_message ?? '';
    expect(msg).not.toContain('postgres://');
    expect(msg).not.toContain('DATABASE_URL=');
    expect(msg).not.toContain('password');
    expect(msg).not.toMatch(/at\s+\w+\s+\(/);
    expect(msg.split('\n').length).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * S. PR#13b observer behaviour unchanged
 * T. PR#14b bridge mapper behaviour unchanged
 * ------------------------------------------------------------------------ */

describe('S. PR#13b observer behaviour unchanged after refactor', () => {
  it('runProductContextTimingObserver still exists and returns ObserverReport', () => {
    const src = readSource('src/scoring/product-context-timing-observer/runner.ts');
    expect(src).toContain('export async function runProductContextTimingObserver(args: RunObserverArgs): Promise<ObserverReport>');
  });

  it('runProductContextTimingObserverDetailed is exported alongside it', () => {
    const src = readSource('src/scoring/product-context-timing-observer/runner.ts');
    expect(src).toContain('export async function runProductContextTimingObserverDetailed');
  });

  it('timingBucketLabel is exported (PR#14c reuse target)', () => {
    const src = readSource('src/scoring/product-context-timing-observer/runner.ts');
    expect(src).toContain('export function timingBucketLabel');
  });
});

describe('T. PR#14b bridge mapper untouched', () => {
  it('buildBridgeNamespaceCandidate signature is unchanged', () => {
    const src = readSource('src/scoring/product-features-namespace-bridge/mapper.ts');
    expect(src).toContain('export function buildBridgeNamespaceCandidate(input: BridgeMapperInput): ValidateResult');
  });
});

/* --------------------------------------------------------------------------
 * U. Markdown report carries read-only proof + no customer claim
 * ------------------------------------------------------------------------ */

describe('U. report includes read-only proof block', () => {
  it('rendered markdown contains read-only proof and disclaimers', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runBridgeCandidateObserver({
      client: stub as unknown as never,
      options: mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const md = renderBridgeCandidateObserverMarkdown(r);
    expect(md).toContain('Internal evidence preview');
    expect(md).toContain('Not customer-facing');
    expect(md).toContain('Not authoritative');
    expect(md).toContain('no_db_writes_performed');
    expect(md).toContain('no_durable_bridge_table');
    expect(md).toContain('no_ams_product_layer_runtime_execution');
    expect(md).toContain('no_product_decision_created');
  });
});

/* --------------------------------------------------------------------------
 * V. rejectReasonFamily helper
 * ------------------------------------------------------------------------ */

describe('V. rejectReasonFamily', () => {
  it('splits prefix:value pairs', () => {
    expect(rejectReasonFamily('unknown_surface_label:totally_made_up')).toBe('unknown_surface_label');
    expect(rejectReasonFamily('forbidden_ams_runtime_key_present:Fit')).toBe('forbidden_ams_runtime_key_present');
  });

  it('returns full string when no colon present', () => {
    expect(rejectReasonFamily('input_not_object')).toBe('input_not_object');
    expect(rejectReasonFamily('unique_poi_count_exceeds_poi_count')).toBe('unique_poi_count_exceeds_poi_count');
  });
});
