/**
 * Sprint 2 PR#12d — POI Sequence Worker — tests.
 *
 * Pure tests. No real pg connection. Stub client exercises the worker
 * pipeline end-to-end.
 *
 * Test groups:
 *   A. Mapper — classification mirrors PR#12b observer
 *   B. Mapper — evidence_refs only direct POI rows (OD-14)
 *   C. Mapper — lower-layer refs rejected as direct refs
 *   D. Mapper — source_versions includes POI table/input/observation/sequence versions
 *   E. Mapper — Stage 0 carry-through
 *   F. Mapper — natural key construction (no poi_input_version)
 *   G. Worker — upsert idempotency (rerun keeps row count stable)
 *   H. Static-source sweep — no forbidden source reads in query
 *   I. Forbidden-column sweep — no Lane/Trust/Policy/PCF/customer fields
 *   J. AMS Series Core name guard — no reserved names in runtime
 *   K. Migration SQL contains required constraints + CHECKs
 *   L. Verification SQL covers core invariants
 *   M. Upsert builder — defence-in-depth invariants
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  POI_SEQUENCE_VERSION,
  type PoiObservationRowRaw,
} from '../../src/scoring/poi-sequence-observer/index.js';
import {
  aggregateReport,
  buildDurableSequenceRecord,
  buildSequenceRecord,
  buildUpsertParams,
  groupRowsBySession,
  makeStubClient,
  POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
  REJECT_REASONS,
  runPoiSequenceWorker,
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL,
  truncateSessionId,
  UPSERT_POI_SEQUENCE_OBSERVATION_SQL,
  type DurableSequenceRow,
  type WorkerReport,
  type WorkerRowResult,
  type WorkerRunOptions,
} from '../../src/scoring/poi-sequence-worker/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const ISO_T0 = '2026-05-14T10:00:00.000Z';
const ISO_T1 = '2026-05-14T10:00:30.000Z';
const ISO_T2 = '2026-05-14T10:01:00.000Z';
const ISO_DERIVED = '2026-05-14T10:05:00.000Z';

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function mkRow(over: Partial<PoiObservationRowRaw> = {}): PoiObservationRowRaw {
  return {
    poi_observation_id:       1,
    workspace_id:             'ws_demo',
    site_id:                  'site_demo',
    session_id:               'sess_aaaaaaaa1111bbbbbbbb1111',
    poi_type:                 'page_path',
    poi_key:                  '/pricing',
    poi_input_version:        'poi-core-input-v0.1',
    poi_observation_version:  'poi-observation-v0.1',
    extraction_version:       'sf-v0.4',
    evidence_refs:            [{ table: 'session_features', source_row_id: 'sf-1' }],
    source_versions:          { session_features: 'sf-v0.4', poi_input_version: 'poi-core-input-v0.1' },
    source_table:             'session_features',
    stage0_excluded:          false,
    poi_eligible:             true,
    first_seen_at:            ISO_T0,
    last_seen_at:             ISO_T0,
    derived_at:               ISO_T0,
    ...over,
  };
}

function mkBuildArgs(rows: readonly PoiObservationRowRaw[]) {
  const groups = groupRowsBySession(rows);
  return {
    group: groups[0]!,
    derived_at_iso:                   ISO_DERIVED,
    poi_input_version_expected:       'poi-core-input-v0.1',
    poi_observation_version_expected: 'poi-observation-v0.1',
    poi_observations_table_version:   POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
  };
}

/* --------------------------------------------------------------------------
 * A. Mapper — classification mirrors PR#12b observer
 * ------------------------------------------------------------------------ */

describe('A. mapper classification mirrors PR#12b observer', () => {
  it('single POI row → single_poi pattern, no progression', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    const obsRec = buildSequenceRecord(groupRowsBySession([mkRow()])[0]!);
    expect(result.record.poi_sequence_pattern_class).toBe(obsRec.poi_sequence_pattern_class);
    expect(result.record.has_progression).toBe(false);
    expect(result.record.progression_depth).toBe(1);
  });

  it('two distinct POIs → multi_poi_linear; matches observer classification', () => {
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: '/a', first_seen_at: ISO_T0, last_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1 }),
    ];
    const result = buildDurableSequenceRecord(mkBuildArgs(rows));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.poi_sequence_pattern_class).toBe('multi_poi_linear');
    expect(result.record.unique_poi_count).toBe(2);
    expect(result.record.has_progression).toBe(true);
    expect(result.record.repeated_poi_count).toBe(0);
  });

  it('same POI repeated → repeated_same_poi, NOT progression', () => {
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: '/x', first_seen_at: ISO_T0, last_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/x', first_seen_at: ISO_T1, last_seen_at: ISO_T1 }),
    ];
    const result = buildDurableSequenceRecord(mkBuildArgs(rows));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.poi_sequence_pattern_class).toBe('repeated_same_poi');
    expect(result.record.has_repetition).toBe(true);
    expect(result.record.has_progression).toBe(false);
    expect(result.record.repeated_poi_count).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * B. Mapper — evidence_refs only direct POI rows (OD-14)
 * ------------------------------------------------------------------------ */

describe('B. evidence_refs only direct POI rows', () => {
  it('every evidence_refs entry has table = "poi_observations_v0_1" and a numeric poi_observation_id', () => {
    const rows = [
      mkRow({ poi_observation_id: 11, poi_key: '/a', first_seen_at: ISO_T0, last_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 22, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1 }),
    ];
    const result = buildDurableSequenceRecord(mkBuildArgs(rows));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.evidence_refs).toEqual([
      { table: 'poi_observations_v0_1', poi_observation_id: 11 },
      { table: 'poi_observations_v0_1', poi_observation_id: 22 },
    ]);
  });

  it('source_min_poi_observation_id / source_max_poi_observation_id span the contributing POI ids', () => {
    const rows = [
      mkRow({ poi_observation_id: 100, poi_key: '/a', first_seen_at: ISO_T0, last_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 150, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 125, poi_key: '/c', first_seen_at: ISO_T2, last_seen_at: ISO_T2 }),
    ];
    const result = buildDurableSequenceRecord(mkBuildArgs(rows));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.source_min_poi_observation_id).toBe(100);
    expect(result.record.source_max_poi_observation_id).toBe(150);
    expect(result.record.source_poi_observation_count).toBe(3);
  });
});

/* --------------------------------------------------------------------------
 * C. Mapper — lower-layer refs rejected as direct refs
 *
 * The upsert builder is the canonical enforcement point (OD-14):
 * even if a record somehow carries a lower-layer table value, the
 * builder throws and the worker classifies it as
 * ADAPTER_VALIDATION_ERROR.
 * ------------------------------------------------------------------------ */

describe('C. lower-layer refs rejected as direct refs', () => {
  function mkRecord(over: Partial<DurableSequenceRow>): DurableSequenceRow {
    const base: DurableSequenceRow = {
      workspace_id:                  'ws_demo',
      site_id:                       'site_demo',
      session_id:                    'sess_aaaaaaaa1111bbbbbbbb1111',
      poi_sequence_version:          POI_SEQUENCE_VERSION,
      poi_observation_version:       'poi-observation-v0.1',
      poi_count:                     1,
      unique_poi_count:              1,
      first_poi_type:                'page_path',
      first_poi_key:                 '/pricing',
      last_poi_type:                 'page_path',
      last_poi_key:                  '/pricing',
      first_seen_at:                 ISO_T0,
      last_seen_at:                  ISO_T0,
      duration_seconds:              0,
      repeated_poi_count:            0,
      has_repetition:                false,
      has_progression:                false,
      progression_depth:             1,
      poi_sequence_pattern_class:    'single_poi',
      stage0_excluded:               false,
      poi_sequence_eligible:         true,
      stage0_rule_id:                null,
      evidence_refs:                 [{ table: 'poi_observations_v0_1', poi_observation_id: 1 }],
      source_versions:               { poi_observations: 'poi-observations-v0.1', poi_sequence_version: POI_SEQUENCE_VERSION },
      source_poi_observation_count:  1,
      source_min_poi_observation_id: 1,
      source_max_poi_observation_id: 1,
      derived_at:                    ISO_DERIVED,
    };
    return { ...base, ...over };
  }

  it('rejects evidence_refs entry pointing at session_features', () => {
    const rec = mkRecord({
      evidence_refs: [{ table: 'session_features' as unknown as 'poi_observations_v0_1', poi_observation_id: 1 }],
    });
    expect(() => buildUpsertParams(rec)).toThrow(/OD-14.*poi_observations_v0_1/);
  });

  it('rejects evidence_refs entry pointing at session_behavioural_features_v0_2', () => {
    const rec = mkRecord({
      evidence_refs: [{ table: 'session_behavioural_features_v0_2' as unknown as 'poi_observations_v0_1', poi_observation_id: 1 }],
    });
    expect(() => buildUpsertParams(rec)).toThrow(/OD-14/);
  });

  it('rejects evidence_refs entry pointing at stage0_decisions', () => {
    const rec = mkRecord({
      evidence_refs: [{ table: 'stage0_decisions' as unknown as 'poi_observations_v0_1', poi_observation_id: 1 }],
    });
    expect(() => buildUpsertParams(rec)).toThrow(/OD-14/);
  });

  it('rejects empty evidence_refs array', () => {
    const rec = mkRecord({ evidence_refs: [] });
    expect(() => buildUpsertParams(rec)).toThrow(/non-empty array/);
  });
});

/* --------------------------------------------------------------------------
 * D. Mapper — source_versions includes POI info
 * ------------------------------------------------------------------------ */

describe('D. source_versions populated correctly', () => {
  it('source_versions contains poi_observations, poi_input_version, poi_observation_version, poi_sequence_version', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.source_versions['poi_observations']).toBe(POI_OBSERVATIONS_TABLE_VERSION_DEFAULT);
    expect(result.record.source_versions['poi_input_version']).toBe('poi-core-input-v0.1');
    expect(result.record.source_versions['poi_observation_version']).toBe('poi-observation-v0.1');
    expect(result.record.source_versions['poi_sequence_version']).toBe(POI_SEQUENCE_VERSION);
  });
});

/* --------------------------------------------------------------------------
 * E. Stage 0 carry-through
 * ------------------------------------------------------------------------ */

describe('E. Stage 0 carry-through', () => {
  it('all POI rows stage0_excluded=false → poi_sequence_eligible=true', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([
      mkRow({ poi_observation_id: 1, stage0_excluded: false }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1, stage0_excluded: false }),
    ]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.stage0_excluded).toBe(false);
    expect(result.record.poi_sequence_eligible).toBe(true);
  });

  it('any POI row stage0_excluded=true → poi_sequence_eligible=false', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([
      mkRow({ poi_observation_id: 1, stage0_excluded: false }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1, stage0_excluded: true }),
    ]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.stage0_excluded).toBe(true);
    expect(result.record.poi_sequence_eligible).toBe(false);
  });

  it('stage0_rule_id carries through as provenance (first non-null wins)', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([
      mkRow({ poi_observation_id: 1, stage0_rule_id: null }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1, last_seen_at: ISO_T1, stage0_excluded: true, stage0_rule_id: 'webdriver_global_present' }),
    ]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.record.stage0_rule_id).toBe('webdriver_global_present');
  });
});

/* --------------------------------------------------------------------------
 * F. Natural key construction (no poi_input_version)
 * ------------------------------------------------------------------------ */

describe('F. natural key construction', () => {
  it('builds upsert params in the documented order; natural-key params are $1..$5', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    const params = buildUpsertParams(result.record);
    expect(params[0]).toBe('ws_demo');                        // workspace_id
    expect(params[1]).toBe('site_demo');                      // site_id
    expect(params[2]).toBe('sess_aaaaaaaa1111bbbbbbbb1111'); // session_id
    expect(params[3]).toBe(POI_SEQUENCE_VERSION);             // poi_sequence_version
    expect(params[4]).toBe('poi-observation-v0.1');           // poi_observation_version
    // poi_input_version is NOT a natural-key param — it lives only in
    // source_versions JSONB ($24).
    expect(JSON.stringify(params)).not.toContain('"poi-core-input-v0.1"' + ',$4'); // sanity
  });
});

/* --------------------------------------------------------------------------
 * G. Worker — upsert idempotency (stub client; rerun keeps row count
 *    stable; first run inserts, second run updates)
 * ------------------------------------------------------------------------ */

function baselineWorkerOptions(over: Partial<WorkerRunOptions> = {}): WorkerRunOptions {
  return {
    workspace_id:                       'ws_demo',
    site_id:                            'site_demo',
    window_start:                       new Date('2026-05-13T18:00:00.000Z'),
    window_end:                         new Date('2026-05-14T18:00:00.000Z'),
    limit:                              1000,
    sample_limit:                       5,
    poi_sequence_version:               POI_SEQUENCE_VERSION,
    poi_input_version_expected:         'poi-core-input-v0.1',
    poi_observation_version_expected:   'poi-observation-v0.1',
    poi_observations_table_version:     POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
    rootDir:                            REPO_ROOT,
    ...over,
  };
}

function makeStubFor(rows: readonly PoiObservationRowRaw[], opts: { rerun?: boolean } = {}) {
  return async (sql: string, _params: readonly unknown[]) => {
    if (sql.includes('FROM poi_observations_v0_1')) {
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('INSERT INTO poi_sequence_observations_v0_1')) {
      // Simulate ON CONFLICT DO UPDATE: first run "inserted", rerun "updated".
      return {
        rows: [{ poi_sequence_observation_id: 1, inserted: !opts.rerun }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
}

describe('G. worker idempotency', () => {
  it('first run inserts (rows_inserted = sessions; rows_updated = 0)', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: 'sess_alpha123456789012345' }),
      mkRow({ poi_observation_id: 2, session_id: 'sess_beta1234567890123456', poi_key: '/b' }),
    ];
    const stub = makeStubClient(makeStubFor(rows, { rerun: false }));
    const r = await runPoiSequenceWorker({
      client: stub as unknown as never,
      options: baselineWorkerOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.rows_scanned).toBe(2);
    expect(r.sessions_seen).toBe(2);
    expect(r.rows_inserted).toBe(2);
    expect(r.rows_updated).toBe(0);
    expect(r.rejects).toBe(0);
  });

  it('rerun on unchanged source → rows_updated = sessions; rows_inserted = 0; row count stable', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: 'sess_alpha123456789012345' }),
      mkRow({ poi_observation_id: 2, session_id: 'sess_beta1234567890123456', poi_key: '/b' }),
    ];
    const stub = makeStubClient(makeStubFor(rows, { rerun: true }));
    const r = await runPoiSequenceWorker({
      client: stub as unknown as never,
      options: baselineWorkerOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.rows_inserted).toBe(0);
    expect(r.rows_updated).toBe(2);
    expect(r.sessions_seen).toBe(2);
  });

  it('Stage0-excluded sessions still upsert (carry-through, not reject)', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: 'sess_alpha123456789012345', stage0_excluded: true, poi_eligible: false }),
    ];
    const stub = makeStubClient(makeStubFor(rows, { rerun: false }));
    const r = await runPoiSequenceWorker({
      client: stub as unknown as never,
      options: baselineWorkerOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.rows_inserted).toBe(1);
    expect(r.stage0_excluded_count).toBe(1);
    expect(r.poi_sequence_eligible_count).toBe(0);
    expect(r.rejects).toBe(0);
  });

  it('report contains masked session_id only', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: 'sess_REVEAL_THIS_FULL_TOKEN_PREFIX_AND_SUFFIX' }),
    ];
    const stub = makeStubClient(makeStubFor(rows, { rerun: false }));
    const r = await runPoiSequenceWorker({
      client: stub as unknown as never,
      options: baselineWorkerOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain('REVEAL_THIS_FULL_TOKEN');
    expect(r.sample_session_id_prefixes.every((s) => s.includes('…') || s === '***')).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * H. Static-source sweep — no forbidden source reads in query / runtime
 * ------------------------------------------------------------------------ */

const PR12D_RUNTIME_FILES = [
  'src/scoring/poi-sequence-worker/types.ts',
  'src/scoring/poi-sequence-worker/query.ts',
  'src/scoring/poi-sequence-worker/mapper.ts',
  'src/scoring/poi-sequence-worker/upsert.ts',
  'src/scoring/poi-sequence-worker/worker.ts',
  'src/scoring/poi-sequence-worker/index.ts',
  'scripts/run-poi-sequence-worker.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('H. static-source sweep — no forbidden source reads', () => {
  it('no SQL FROM/JOIN against forbidden tables in runtime source', () => {
    const forbidden = [
      'session_features',
      'session_behavioural_features_v0_2',
      'stage0_decisions',
      'accepted_events',
      'rejected_events',
      'ingest_requests',
      'risk_observations_v0_1',
      'scoring_output_lane_a',
      'scoring_output_lane_b',
      'site_write_tokens',
    ];
    for (const f of PR12D_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        const fromRe = new RegExp(`\\bFROM\\s+${t}\\b`);
        const joinRe = new RegExp(`\\bJOIN\\s+${t}\\b`);
        expect(src, `${f} must not FROM ${t}`).not.toMatch(fromRe);
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(joinRe);
      }
    }
  });

  it('only allowed write target is poi_sequence_observations_v0_1', () => {
    const writeTargets = [
      'poi_observations_v0_1',
      'session_features',
      'session_behavioural_features_v0_2',
      'stage0_decisions',
      'accepted_events',
      'rejected_events',
      'ingest_requests',
      'risk_observations_v0_1',
      'scoring_output_lane_a',
      'scoring_output_lane_b',
      'site_write_tokens',
    ];
    for (const f of PR12D_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of writeTargets) {
        const writeRe = new RegExp(`\\b(?:INSERT\\s+INTO|UPDATE)\\s+${t}\\b`);
        expect(src, `${f} must not write to ${t}`).not.toMatch(writeRe);
      }
    }
  });

  it('no DDL / GRANT / REVOKE / TRUNCATE / DELETE in active TS source', () => {
    for (const f of PR12D_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/);
      expect(src, `${f} must not contain TRUNCATE`).not.toMatch(/\bTRUNCATE\b/);
      expect(src, `${f} must not contain DROP …`).not.toMatch(/\bDROP\s+(TABLE|INDEX|VIEW|SCHEMA)\b/i);
      expect(src, `${f} must not contain ALTER TABLE`).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(src, `${f} must not contain CREATE TABLE`).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(src, `${f} must not contain GRANT`).not.toMatch(/\bGRANT\b/);
      expect(src, `${f} must not contain REVOKE`).not.toMatch(/\bREVOKE\b/);
    }
  });
});

/* --------------------------------------------------------------------------
 * I. Forbidden columns — no Lane / Trust / Policy / PCF / customer
 *    field names in PR#12d runtime
 * ------------------------------------------------------------------------ */

describe('I. forbidden-column sweep in runtime', () => {
  it('runtime source does NOT mint forbidden score/Lane/Trust/Policy/PCF/customer field names', () => {
    const forbidden = [
      'risk_index',
      'evidence_band',
      'action_recommendation',
      'reason_codes',
      'reason_impacts',
      'triggered_tags',
      'penalty_total',
      'lane_a',
      'lane_b',
      'trust_decision',
      'policy_decision',
      'final_decision',
      'customer_facing',
      'buyer_intent',
      'product_context_fit',
      'buyer_role',
    ];
    for (const f of PR12D_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        expect(src, `${f} must not mint "${t}"`).not.toContain(t);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * J. AMS Series Core name guard — no reserved names in PR#12d runtime
 * ------------------------------------------------------------------------ */

describe('J. AMS Series Core reserved-name guard', () => {
  it('PR#12d runtime source does NOT mint reserved AMS Series Core names', () => {
    const reserved = [
      'SeriesOutput',
      'TimeOutput',
      'seriescore',
      'series_version',
      'series_eligible',
      'series_observations_v0_1',
      'observe:series',
    ];
    for (const f of PR12D_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reserved) {
        expect(src, `${f} must not mint reserved AMS Series name "${name}"`).not.toContain(name);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * K. Migration SQL contains required constraints + CHECKs
 * ------------------------------------------------------------------------ */

describe('K. migration 015 SQL', () => {
  const migrationPath = 'migrations/015_poi_sequence_observations_v0_1.sql';
  const sql = readSource(migrationPath);

  const requiredConstraints = [
    'poi_seq_obs_v0_1_version_pin',
    'poi_seq_obs_v0_1_pattern_class_enum',
    'poi_seq_obs_v0_1_eligible_is_pure_inverse_of_stage0_excluded',
    'poi_seq_obs_v0_1_poi_count_pos',
    'poi_seq_obs_v0_1_unique_poi_count_pos',
    'poi_seq_obs_v0_1_progression_depth_equals_unique',
    'poi_seq_obs_v0_1_has_progression_rule',
    'poi_seq_obs_v0_1_repeated_poi_count_identity',
    'poi_seq_obs_v0_1_has_repetition_rule',
    'poi_seq_obs_v0_1_duration_nonneg',
    'poi_seq_obs_v0_1_timestamps_ordered',
    'poi_seq_obs_v0_1_source_count_matches_poi_count',
    'poi_seq_obs_v0_1_record_only_must_be_true',
    'poi_seq_obs_v0_1_evidence_refs_is_array',
    'poi_seq_obs_v0_1_evidence_refs_nonempty',
    'poi_seq_obs_v0_1_source_versions_is_object',
    'poi_seq_obs_v0_1_natural_key',
  ];

  it.each(requiredConstraints)('contains CHECK / UNIQUE constraint %s', (name) => {
    expect(sql).toContain(name);
  });

  it('migration is additive (CREATE TABLE IF NOT EXISTS) and does not modify earlier migrations', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS poi_sequence_observations_v0_1/);
    // Strip SQL comments before checking — the rollback instructions in
    // the migration's trailing comment block legitimately mention
    // DROP TABLE for the operator-only rollback path.
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/\bDROP\s+TABLE\b/);
    expect(stripped).not.toMatch(/\bALTER\s+TABLE\s+poi_observations_v0_1\b/);
  });

  it('migration grants customer_api zero SELECT (Hard-Rule-I posture)', () => {
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+poi_sequence_observations_v0_1\s+FROM\s+buyerrecon_customer_api/);
  });

  it('migration grants internal_readonly SELECT only (no sequence USAGE/UPDATE)', () => {
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+poi_sequence_observations_v0_1\s+TO\s+buyerrecon_internal_readonly/i);
    expect(sql).not.toMatch(/GRANT\s+[^;]*USAGE[^;]*\s+TO\s+buyerrecon_internal_readonly/i);
  });
});

/* --------------------------------------------------------------------------
 * L. Verification SQL covers core invariants
 * ------------------------------------------------------------------------ */

describe('L. verification SQL', () => {
  const verificationPath = 'docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql';
  const sql = readSource(verificationPath);

  const requiredChecks = [
    'table_present',
    'poi_sequence_eligible <> (NOT stage0_excluded)',
    'has_progression <> (unique_poi_count >= 2)',
    'progression_depth <> unique_poi_count',
    'repeated_poi_count <> (poi_count - unique_poi_count)',
    'has_repetition <> (repeated_poi_count > 0)',
    'source_poi_observation_count <> poi_count',
    'forbidden_direct_table_value',
    'POI Sequence record',
  ];

  it.each(requiredChecks)('contains check / wording: %s', (s) => {
    expect(sql).toContain(s);
  });

  it('OD-14 direct-POI check exists', () => {
    expect(sql).toMatch(/elem ->> 'table' IS DISTINCT FROM 'poi_observations_v0_1'/);
  });
});

/* --------------------------------------------------------------------------
 * M. Upsert builder — defence-in-depth invariants
 * ------------------------------------------------------------------------ */

describe('M. upsert builder invariants', () => {
  it('throws when poi_sequence_eligible is not the inverse of stage0_excluded', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    const tampered = { ...result.record, poi_sequence_eligible: false }; // stage0_excluded=false → should be true
    expect(() => buildUpsertParams(tampered)).toThrow(/pure inverse|poi_sequence_eligible/i);
  });

  it('throws when poi_sequence_version is anything other than the frozen literal', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    const tampered = { ...result.record, poi_sequence_version: 'poi-sequence-v0.2' };
    expect(() => buildUpsertParams(tampered)).toThrow(/poi_sequence_version/);
  });

  it('throws when source_poi_observation_count != poi_count', () => {
    const result = buildDurableSequenceRecord(mkBuildArgs([mkRow()]));
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    const tampered = { ...result.record, source_poi_observation_count: 99 };
    expect(() => buildUpsertParams(tampered)).toThrow(/source_poi_observation_count/);
  });
});

/* --------------------------------------------------------------------------
 * N. Aggregator + masking helpers — coverage
 * ------------------------------------------------------------------------ */

describe('N. aggregator + masking', () => {
  it('truncateSessionId masks long ids', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });

  it('aggregateReport tallies inserted vs updated correctly', () => {
    const results: WorkerRowResult[] = [
      { outcome: 'upserted', session_id: 'sess_a000000000000000a000', upsert_action: 'inserted', pattern_class: 'single_poi',          stage0_excluded: false, poi_count: 1 },
      { outcome: 'upserted', session_id: 'sess_b000000000000000b000', upsert_action: 'updated',  pattern_class: 'multi_poi_linear',    stage0_excluded: false, poi_count: 2 },
      { outcome: 'rejected', session_id: 'sess_c000000000000000c000', reason: 'MISSING_POI_KEY', detail: 'x' },
    ];
    const r: WorkerReport = aggregateReport({
      results,
      rows_scanned:  5,
      sessions_seen: 3,
      sample_limit:  5,
      run_metadata: {
        source_table:                     'poi_observations_v0_1',
        target_table:                     'poi_sequence_observations_v0_1',
        workspace_id_filter:              null,
        site_id_filter:                   null,
        window_start:                     ISO_T0,
        window_end:                       ISO_T2,
        row_limit:                        1000,
        sample_limit:                     5,
        database_host:                    'h',
        database_name:                    'd',
        run_started_at:                   ISO_T0,
        run_ended_at:                     ISO_T2,
        poi_sequence_version:             POI_SEQUENCE_VERSION,
        poi_input_version_expected:       'poi-core-input-v0.1',
        poi_observation_version_expected: 'poi-observation-v0.1',
        poi_observations_table_version:   POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
        record_only:                      true,
      },
    });
    expect(r.rows_inserted).toBe(1);
    expect(r.rows_updated).toBe(1);
    expect(r.rejects).toBe(1);
    expect(r.reject_reasons.MISSING_POI_KEY).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.single_poi).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.multi_poi_linear).toBe(1);
    expect(REJECT_REASONS.length).toBeGreaterThan(0);
  });

  it('SQL constants are exported and read-only / write-poi-sequence-only', () => {
    expect(SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL).toMatch(/FROM poi_observations_v0_1/);
    expect(SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL).not.toMatch(/INSERT|UPDATE|DELETE/i);
    expect(UPSERT_POI_SEQUENCE_OBSERVATION_SQL).toMatch(/INSERT INTO poi_sequence_observations_v0_1/);
    expect(UPSERT_POI_SEQUENCE_OBSERVATION_SQL).toMatch(/ON CONFLICT/i);
  });
});
