/**
 * Sprint 2 PR#12b — POI Sequence Observer — tests.
 *
 * Pure tests. No real pg connection. The runner accepts a stub client;
 * in-memory tests exercise every pattern-classification path, the
 * Stage 0 carry-through rule, evidence_refs / source_versions
 * validation, the forbidden-key sweep, the deterministic ordering /
 * tie-break, and the report-edge masking.
 *
 * Test groups:
 *   A. Masking helpers (truncateSessionId / parseDatabaseUrl)
 *   B. Mapper — pattern classification
 *   C. Mapper — Stage 0 carry-through + eligibility
 *   D. Mapper — has_progression / progression_depth rules
 *   E. Mapper — evidence_refs / source_versions / forbidden_source_table validation
 *   F. Mapper — forbidden_key recursive sweep
 *   G. Mapper — deterministic ordering / no Date.now / no randomness
 *   H. Aggregator — distributions + total_anomalies rollup
 *   I. Runner end-to-end (stub client) — healthy run
 *   J. Runner end-to-end — anomalies surface in counters + samples
 *   K. Runner end-to-end — table absent → early empty report
 *   L. Static-source boundary sweep (PR#12b runtime files)
 *   M. SQL constants — allowlist + read-only
 *   N. Privacy — no poi_key / no full session_id / no DSN in report
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { POI_CORE_INPUT_VERSION } from '../../src/scoring/poi-core/index.js';
import { POI_OBSERVATION_VERSION_EXPECTED } from '../../src/scoring/poi-table-observer/index.js';
import {
  aggregateReport,
  ANOMALY_KINDS,
  buildSequenceRecord,
  classifyPattern,
  FORBIDDEN_REF_KEYS,
  groupRowsBySession,
  hasForbiddenKeyRecursive,
  isValidEvidenceRefs,
  isValidSourceVersions,
  makeStubClient,
  parseDatabaseUrl,
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  POI_SEQUENCE_VERSION,
  runPoiSequenceObserver,
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL,
  SELECT_TABLE_PRESENT_SQL,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
  type AnomalyKind,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type PoiObservationRowRaw,
  type PoiSequenceRecord,
} from '../../src/scoring/poi-sequence-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const ISO_T0 = '2026-05-13T18:00:00.000Z';
const ISO_T1 = '2026-05-13T18:00:30.000Z';
const ISO_T2 = '2026-05-13T18:01:00.000Z';
const ISO_T3 = '2026-05-13T18:02:00.000Z';

/* --------------------------------------------------------------------------
 * Test fixtures
 * ------------------------------------------------------------------------ */

function baselineRunMetadata(over: Partial<ObserverRunMetadata> = {}): ObserverRunMetadata {
  return {
    source_table:                     'poi_observations_v0_1',
    workspace_id_filter:              'ws_demo',
    site_id_filter:                   'site_demo',
    window_start:                     '2026-05-12T18:00:00.000Z',
    window_end:                       '2026-05-13T18:00:00.000Z',
    row_limit:                        100,
    sample_limit:                     5,
    anomaly_sample_limit:             5,
    database_host:                    'localhost:5432',
    database_name:                    'buyerrecon_test',
    run_started_at:                   ISO_T0,
    run_ended_at:                     ISO_T0,
    poi_sequence_version:             POI_SEQUENCE_VERSION,
    poi_input_version_expected:       POI_CORE_INPUT_VERSION,
    poi_observation_version_expected: POI_OBSERVATION_VERSION_EXPECTED,
    forbidden_ref_keys_checked:       FORBIDDEN_REF_KEYS,
    record_only:                      true,
    ...over,
  };
}

function baselineRunOptions(over: Partial<ObserverRunOptions> = {}): ObserverRunOptions {
  return {
    workspace_id:                     'ws_demo',
    site_id:                          'site_demo',
    window_start:                     new Date('2026-05-12T18:00:00.000Z'),
    window_end:                       new Date('2026-05-13T18:00:00.000Z'),
    limit:                            1000,
    sample_limit:                     5,
    anomaly_sample_limit:             5,
    poi_input_version_expected:       POI_CORE_INPUT_VERSION,
    poi_observation_version_expected: POI_OBSERVATION_VERSION_EXPECTED,
    ...over,
  };
}

function mkRow(over: Partial<PoiObservationRowRaw> = {}): PoiObservationRowRaw {
  return {
    poi_observation_id:       1,
    workspace_id:             'ws_demo',
    site_id:                  'site_demo',
    session_id:               'sess_aaaaaaaa1111bbbbbbbb2222',
    poi_type:                 'page_path',
    poi_key:                  '/pricing',
    poi_input_version:        POI_CORE_INPUT_VERSION,
    poi_observation_version:  POI_OBSERVATION_VERSION_EXPECTED,
    extraction_version:       'sf-v0.4',
    evidence_refs:            [{ table: 'session_features', source_row_id: 'sf-1' }],
    source_versions:          { session_features: 'sf-v0.4', poi_input_version: POI_CORE_INPUT_VERSION },
    source_table:             'session_features',
    stage0_excluded:          false,
    poi_eligible:             true,
    first_seen_at:            ISO_T0,
    last_seen_at:             ISO_T1,
    derived_at:               ISO_T0,
    ...over,
  };
}

/* --------------------------------------------------------------------------
 * A. Masking helpers
 * ------------------------------------------------------------------------ */

describe('A. masking helpers', () => {
  it('truncateSessionId masks long IDs', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });
  it('truncateSessionId returns *** for short IDs', () => {
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });
  it('parseDatabaseUrl returns host + db name only, never password', () => {
    const r = parseDatabaseUrl('postgres://user:hunter2@db.internal:5432/buyerrecon_staging');
    expect(r.host).toBe('db.internal:5432');
    expect(r.name).toBe('buyerrecon_staging');
    expect(JSON.stringify(r)).not.toContain('hunter2');
  });
  it('parseDatabaseUrl returns sentinels on garbage / undefined', () => {
    expect(parseDatabaseUrl(undefined)).toEqual({ host: '<unset>', name: '<unset>' });
    expect(parseDatabaseUrl('not-a-url')).toEqual({ host: '<unparseable>', name: '<unparseable>' });
  });
});

/* --------------------------------------------------------------------------
 * B. Mapper — pattern classification
 * ------------------------------------------------------------------------ */

describe('B. pattern classification', () => {
  it('classifyPattern: single_poi when exactly one row', () => {
    expect(classifyPattern({ poi_count: 1, unique_poi_count: 1, repeated_poi_count: 0, has_temporal_data: true })).toBe('single_poi');
    // single row with NULL timestamps is still single_poi (no ordering to verify).
    expect(classifyPattern({ poi_count: 1, unique_poi_count: 1, repeated_poi_count: 0, has_temporal_data: false })).toBe('single_poi');
  });

  it('classifyPattern: repeated_same_poi when 2+ rows but only one distinct POI', () => {
    expect(classifyPattern({ poi_count: 3, unique_poi_count: 1, repeated_poi_count: 2, has_temporal_data: true })).toBe('repeated_same_poi');
  });

  it('classifyPattern: multi_poi_linear when 2+ distinct POIs, no repeats', () => {
    expect(classifyPattern({ poi_count: 3, unique_poi_count: 3, repeated_poi_count: 0, has_temporal_data: true })).toBe('multi_poi_linear');
  });

  it('classifyPattern: loop_or_backtrack when 2+ distinct POIs with at least one repeat', () => {
    expect(classifyPattern({ poi_count: 4, unique_poi_count: 3, repeated_poi_count: 1, has_temporal_data: true })).toBe('loop_or_backtrack');
  });

  it('classifyPattern: insufficient_temporal_data when 2+ rows lack timestamps', () => {
    expect(classifyPattern({ poi_count: 2, unique_poi_count: 2, repeated_poi_count: 0, has_temporal_data: false })).toBe('insufficient_temporal_data');
  });

  it('classifyPattern: unknown is the explicit fallback (must stay 0 in healthy run)', () => {
    // No reachable healthy path produces this — we construct an impossible
    // state (poi_count=0) to verify the fallback branch.
    expect(classifyPattern({ poi_count: 0, unique_poi_count: 0, repeated_poi_count: 0, has_temporal_data: true })).toBe('unknown');
  });

  it('buildSequenceRecord: single POI row → single_poi, no progression', () => {
    const groups = groupRowsBySession([mkRow()]);
    const rec    = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_pattern_class).toBe('single_poi');
    expect(rec.has_progression).toBe(false);
    expect(rec.progression_depth).toBe(1);
    expect(rec.repeated_poi_count).toBe(0);
  });

  it('buildSequenceRecord: same POI twice → repeated_same_poi (not progression)', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/pricing', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/pricing', first_seen_at: ISO_T1 }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_pattern_class).toBe('repeated_same_poi');
    expect(rec.has_repetition).toBe(true);
    expect(rec.has_progression).toBe(false);
    expect(rec.progression_depth).toBe(1);
  });

  it('buildSequenceRecord: multi_poi_linear when 3 distinct POIs in order', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/landing', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/pricing', first_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 3, poi_key: '/demo',    first_seen_at: ISO_T2 }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_pattern_class).toBe('multi_poi_linear');
    expect(rec.has_progression).toBe(true);
    expect(rec.progression_depth).toBe(3);
    expect(rec.has_repetition).toBe(false);
  });

  it('buildSequenceRecord: loop_or_backtrack when an earlier POI re-appears', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/landing', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/pricing', first_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 3, poi_key: '/landing', first_seen_at: ISO_T2 }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_pattern_class).toBe('loop_or_backtrack');
    expect(rec.has_repetition).toBe(true);
    expect(rec.has_progression).toBe(true);
    expect(rec.progression_depth).toBe(2);
  });

  it('buildSequenceRecord: insufficient_temporal_data when timestamps missing in 2+ rows', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/landing', first_seen_at: null }),
      mkRow({ poi_observation_id: 2, poi_key: '/pricing', first_seen_at: null }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_pattern_class).toBe('insufficient_temporal_data');
  });
});

/* --------------------------------------------------------------------------
 * C. Stage 0 carry-through + eligibility
 * ------------------------------------------------------------------------ */

describe('C. Stage 0 carry-through', () => {
  it('all rows stage0_excluded=false → poi_sequence_eligible=true', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, stage0_excluded: false }),
      mkRow({ poi_observation_id: 2, poi_key: '/demo', stage0_excluded: false }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.stage0_excluded).toBe(false);
    expect(rec.poi_sequence_eligible).toBe(true);
  });

  it('any row stage0_excluded=true → poi_sequence_eligible=false', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, stage0_excluded: false }),
      mkRow({ poi_observation_id: 2, poi_key: '/demo', stage0_excluded: true }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.stage0_excluded).toBe(true);
    expect(rec.poi_sequence_eligible).toBe(false);
  });

  it('Stage0-excluded sessions still produce a POI Sequence record (carry-through, not reject)', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, stage0_excluded: true }),
    ]);
    expect(groups.length).toBe(1);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.poi_sequence_eligible).toBe(false);
    expect(rec.poi_sequence_pattern_class).toBe('single_poi'); // pattern classification still runs
  });
});

/* --------------------------------------------------------------------------
 * D. Progression rules
 * ------------------------------------------------------------------------ */

describe('D. progression rules', () => {
  it('has_progression = unique_poi_count >= 2', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/a', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1 }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.has_progression).toBe(true);
    expect(rec.progression_depth).toBe(2);
  });

  it('single_poi is NOT progression', () => {
    const rec = buildSequenceRecord(groupRowsBySession([mkRow()])[0]!);
    expect(rec.has_progression).toBe(false);
  });

  it('repeated_same_poi is NOT progression', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, poi_key: '/x', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/x', first_seen_at: ISO_T1 }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.has_progression).toBe(false);
    expect(rec.progression_depth).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * E. evidence_refs / source_versions / forbidden_source_table validation
 * ------------------------------------------------------------------------ */

describe('E. evidence_refs / source_versions / forbidden_source_table', () => {
  // Canonical PR#10 PoiEvidenceRef field is `table` (NOT `source_table`).
  // See src/scoring/poi-core/types.ts:194.

  it('isValidEvidenceRefs accepts entries with allowed `table` value', () => {
    expect(isValidEvidenceRefs([{ table: 'session_features' }])).toBe(true);
    expect(isValidEvidenceRefs([{ table: 'stage0_decisions' }])).toBe(true);
    expect(isValidEvidenceRefs([{ table: 'session_behavioural_features_v0_2' }])).toBe(true);
    expect(isValidEvidenceRefs([
      { table: 'session_features' },
      { table: 'stage0_decisions' },
      { table: 'session_behavioural_features_v0_2' },
    ])).toBe(true);
  });

  it('isValidEvidenceRefs rejects raw-lineage / forbidden `table` values', () => {
    expect(isValidEvidenceRefs([{ table: 'accepted_events' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'rejected_events' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'ingest_requests' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'risk_observations_v0_1' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'scoring_output_lane_a' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'scoring_output_lane_b' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'site_write_tokens' }])).toBe(false);
  });

  it('isValidEvidenceRefs rejects missing / non-string / empty-string `table` field', () => {
    expect(isValidEvidenceRefs([{}])).toBe(false);
    expect(isValidEvidenceRefs([{ source_table: 'session_features' }])).toBe(false); // wrong field name
    expect(isValidEvidenceRefs([{ table: 4 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: null }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: '' }])).toBe(false);
  });

  it('isValidEvidenceRefs rejects non-object entries', () => {
    expect(isValidEvidenceRefs(['session_features'])).toBe(false);
    expect(isValidEvidenceRefs([42])).toBe(false);
    expect(isValidEvidenceRefs([null])).toBe(false);
    expect(isValidEvidenceRefs([['table', 'session_features']])).toBe(false);
  });

  it('isValidEvidenceRefs rejects empty array / non-array / null / object root', () => {
    expect(isValidEvidenceRefs([])).toBe(false);
    expect(isValidEvidenceRefs(null)).toBe(false);
    expect(isValidEvidenceRefs({ table: 'session_features' })).toBe(false);
  });

  it('isValidSourceVersions accepts object with string values', () => {
    expect(isValidSourceVersions({ session_features: 'sf-v0.4' })).toBe(true);
    expect(isValidSourceVersions({})).toBe(true);
  });

  it('isValidSourceVersions rejects array / null / non-string values', () => {
    expect(isValidSourceVersions([])).toBe(false);
    expect(isValidSourceVersions(null)).toBe(false);
    expect(isValidSourceVersions({ session_features: 4 })).toBe(false);
  });

  it('buildSequenceRecord surfaces invalid_evidence_refs anomaly', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, evidence_refs: [] }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.anomaly_invalid_evidence_refs).toBe(1);
  });

  it('buildSequenceRecord surfaces invalid_source_versions anomaly', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, source_versions: null }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.anomaly_invalid_source_versions).toBe(1);
  });

  it('buildSequenceRecord surfaces forbidden_source_table anomaly', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, source_table: 'session_behavioural_features_v0_2' }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.anomaly_forbidden_source_table).toBe(1);
  });

  it('invalid evidence_refs becomes anomaly, not a run-level crash', async () => {
    const rows = [mkRow({ evidence_refs: 'not-an-array' })];
    const stub = makeStubClient(makeStubFor(rows));
    const report = await runPoiSequenceObserver({
      client:        stub as unknown as never,
      options:       baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(report.invalid_evidence_refs_count).toBeGreaterThan(0);
    expect(report.total_anomalies).toBeGreaterThan(0);
  });

  it('runner increments invalid_evidence_refs_count for `[{ table: accepted_events }]`', async () => {
    const rows = [
      mkRow({ poi_observation_id: 77, evidence_refs: [{ table: 'accepted_events' }] }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const report = await runPoiSequenceObserver({
      client:        stub as unknown as never,
      options:       baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(report.invalid_evidence_refs_count).toBe(1);
    expect(report.total_anomalies).toBeGreaterThan(0);
    // Sample contains only the BIGSERIAL id — no payload, no poi_key,
    // no raw row, no evidence_refs contents.
    expect(report.anomaly_samples.invalid_evidence_refs).toEqual([77]);
    const serialised = JSON.stringify(report.anomaly_samples);
    expect(serialised).not.toContain('accepted_events');
    expect(serialised).not.toContain('/pricing');
    expect(serialised).not.toContain(rows[0]!.session_id as string);
  });
});

/* --------------------------------------------------------------------------
 * F. Forbidden-key recursive sweep
 * ------------------------------------------------------------------------ */

describe('F. forbidden-key recursive sweep', () => {
  it('hasForbiddenKeyRecursive returns true for shallow forbidden key', () => {
    expect(hasForbiddenKeyRecursive({ email: 'x' })).toBe(true);
    expect(hasForbiddenKeyRecursive({ ip_hash: 'x' })).toBe(true);
  });

  it('hasForbiddenKeyRecursive returns true for nested forbidden key', () => {
    expect(hasForbiddenKeyRecursive({ outer: { inner: { user_agent: 'mozilla' } } })).toBe(true);
  });

  it('hasForbiddenKeyRecursive walks arrays', () => {
    expect(hasForbiddenKeyRecursive([{ a: 1 }, { email: 'x' }])).toBe(true);
  });

  it('hasForbiddenKeyRecursive returns false for clean structures', () => {
    expect(hasForbiddenKeyRecursive({ table: 'session_features', source_row_id: 'sf-1' })).toBe(false);
    expect(hasForbiddenKeyRecursive([])).toBe(false);
    expect(hasForbiddenKeyRecursive(null)).toBe(false);
  });

  it('buildSequenceRecord surfaces forbidden_key_present anomaly', () => {
    const groups = groupRowsBySession([
      mkRow({ poi_observation_id: 1, evidence_refs: [{ table: 'session_features', email: 'x@y' }] }),
    ]);
    const rec = buildSequenceRecord(groups[0]!);
    expect(rec.anomaly_forbidden_key_present).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * G. Deterministic ordering, no Date.now, no randomness
 * ------------------------------------------------------------------------ */

describe('G. deterministic ordering', () => {
  it('two consecutive runs with the same input produce identical records (no Date.now / no randomness)', () => {
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: '/a', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1 }),
    ];
    const r1 = buildSequenceRecord(groupRowsBySession(rows)[0]!);
    const r2 = buildSequenceRecord(groupRowsBySession(rows)[0]!);
    expect(r1).toEqual(r2);
  });

  it('mapper does NOT call Date.now (static-source check)', () => {
    const src = readFileSync(join(REPO_ROOT, 'src/scoring/poi-sequence-observer/mapper.ts'), 'utf8');
    const stripped = stripTsComments(src);
    expect(stripped).not.toMatch(/Date\.now\s*\(/);
    expect(stripped).not.toMatch(/Math\.random\s*\(/);
  });

  it('first POI is determined by first_seen_at ASC (SQL ordering — same poi_observation_id stable tie-break)', () => {
    // SQL guarantees ASC ordering; the mapper trusts the input order.
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: '/early',   first_seen_at: ISO_T0, last_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/middle',  first_seen_at: ISO_T1, last_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 3, poi_key: '/late',    first_seen_at: ISO_T2, last_seen_at: ISO_T2 }),
    ];
    const rec = buildSequenceRecord(groupRowsBySession(rows)[0]!);
    expect(rec.first_seen_at).toBe(ISO_T0);
    expect(rec.last_seen_at).toBe(ISO_T2);
    expect(rec.duration_seconds).toBe(60); // T0 → T2 = 1 minute
  });
});

/* --------------------------------------------------------------------------
 * H. Aggregator — distributions + rollup
 * ------------------------------------------------------------------------ */

function emptyAggregateInputs(over: Partial<AggregateInputs> = {}): AggregateInputs {
  const emptyIds: Record<AnomalyKind, readonly number[]> = Object.fromEntries(
    ANOMALY_KINDS.map((k) => [k, [] as readonly number[]]),
  ) as Record<AnomalyKind, readonly number[]>;
  return {
    rows_scanned:           0,
    records:                [],
    anomaly_sample_ids:     emptyIds,
    sample_session_ids_raw: [],
    run_metadata:           baselineRunMetadata(),
    ...over,
  };
}

describe('H. aggregator distributions + rollup', () => {
  it('empty inputs → zero everywhere', () => {
    const r = aggregateReport(emptyAggregateInputs());
    expect(r.sessions_seen).toBe(0);
    expect(r.poi_sequences_built).toBe(0);
    expect(r.total_anomalies).toBe(0);
    for (const c of POI_SEQUENCE_PATTERN_CLASSES_ALLOWED) {
      expect(r.poi_sequence_pattern_class_distribution[c]).toBe(0);
    }
  });

  it('mixed pattern records produce a per-class distribution', () => {
    const records = [
      mkRecord({ poi_sequence_pattern_class: 'single_poi',          session_id: 'sess_aaaaaaaa1111bbbbbbbb1111' }),
      mkRecord({ poi_sequence_pattern_class: 'repeated_same_poi',   session_id: 'sess_aaaaaaaa1111bbbbbbbb2222' }),
      mkRecord({ poi_sequence_pattern_class: 'multi_poi_linear',    session_id: 'sess_aaaaaaaa1111bbbbbbbb3333' }),
      mkRecord({ poi_sequence_pattern_class: 'loop_or_backtrack',   session_id: 'sess_aaaaaaaa1111bbbbbbbb4444' }),
      mkRecord({ poi_sequence_pattern_class: 'insufficient_temporal_data', session_id: 'sess_aaaaaaaa1111bbbbbbbb5555' }),
    ];
    const r = aggregateReport(emptyAggregateInputs({ rows_scanned: 5, records }));
    expect(r.poi_sequences_built).toBe(5);
    expect(r.poi_sequence_pattern_class_distribution.single_poi).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.repeated_same_poi).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.multi_poi_linear).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.loop_or_backtrack).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.insufficient_temporal_data).toBe(1);
    expect(r.insufficient_temporal_data_count).toBe(1);
    expect(r.unknown_pattern_count).toBe(0);
  });

  it('per-record anomaly fields roll up into run-level counters + total', () => {
    const records = [
      mkRecord({ anomaly_invalid_evidence_refs: 2, anomaly_forbidden_key_present: 1 }),
      mkRecord({ anomaly_invalid_source_versions: 3, anomaly_forbidden_source_table: 1, session_id: 'sess_aaaaaaaa9999bbbbbbbb8888' }),
    ];
    const r = aggregateReport(emptyAggregateInputs({ rows_scanned: 4, records }));
    expect(r.invalid_evidence_refs_count).toBe(2);
    expect(r.invalid_source_versions_count).toBe(3);
    expect(r.forbidden_source_table_count).toBe(1);
    expect(r.forbidden_key_present_count).toBe(1);
    expect(r.total_anomalies).toBe(2 + 3 + 1 + 1);
  });

  it('unique_session_ids_seen + unique_workspace_site_pairs_seen', () => {
    const records = [
      mkRecord({ workspace_id: 'ws_a', site_id: 's1', session_id: 'sess_aaaaaaaa1111bbbbbbbb1111' }),
      mkRecord({ workspace_id: 'ws_a', site_id: 's1', session_id: 'sess_aaaaaaaa1111bbbbbbbb2222' }),
      mkRecord({ workspace_id: 'ws_b', site_id: 's2', session_id: 'sess_aaaaaaaa1111bbbbbbbb3333' }),
    ];
    const r = aggregateReport(emptyAggregateInputs({ rows_scanned: 3, records }));
    expect(r.unique_session_ids_seen).toBe(3);
    expect(r.unique_workspace_site_pairs_seen).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * I. Runner end-to-end — healthy run via stub client
 * ------------------------------------------------------------------------ */

function makeStubFor(rows: readonly PoiObservationRowRaw[], tablePresent = true) {
  return async (sql: string, _params: readonly unknown[]) => {
    if (sql.includes('information_schema.tables')) {
      return { rows: [{ table_present: tablePresent }], rowCount: 1 };
    }
    if (sql.includes('FROM poi_observations_v0_1')) {
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  };
}

describe('I. runner end-to-end — healthy run', () => {
  it('one session with 3 distinct POIs → multi_poi_linear, eligible, no anomalies', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: '/a', first_seen_at: ISO_T0 }),
      mkRow({ poi_observation_id: 2, poi_key: '/b', first_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 3, poi_key: '/c', first_seen_at: ISO_T2 }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.rows_scanned).toBe(3);
    expect(r.sessions_seen).toBe(1);
    expect(r.poi_sequences_built).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.multi_poi_linear).toBe(1);
    expect(r.poi_sequence_eligible_distribution.true_count).toBe(1);
    expect(r.total_anomalies).toBe(0);
  });

  it('multi-session input — Stage0-excluded session still produces a record', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: 'sess_alpha123456789012345',  poi_key: '/a', stage0_excluded: false }),
      mkRow({ poi_observation_id: 2, session_id: 'sess_alpha123456789012345',  poi_key: '/b', stage0_excluded: false, first_seen_at: ISO_T1 }),
      mkRow({ poi_observation_id: 3, session_id: 'sess_beta1234567890123456', poi_key: '/x', stage0_excluded: true,  first_seen_at: ISO_T0 }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.sessions_seen).toBe(2);
    expect(r.poi_sequence_eligible_distribution.true_count).toBe(1);
    expect(r.poi_sequence_eligible_distribution.false_count).toBe(1);
    expect(r.stage0_excluded_distribution.true_count).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * J. Runner — anomalies surface in counters + samples
 * ------------------------------------------------------------------------ */

describe('J. runner — anomalies surface', () => {
  it('forbidden_key_present surfaces in counter + non-empty sample IDs', async () => {
    const rows = [
      mkRow({ poi_observation_id: 42, evidence_refs: [{ table: 'session_features', email: 'leak@example.com' }] }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.forbidden_key_present_count).toBe(1);
    expect(r.anomaly_samples.forbidden_key_present).toEqual([42]);
    // Sample contains no poi_key / no session_id / no evidence_refs payload.
    expect(JSON.stringify(r.anomaly_samples)).not.toContain('leak@example.com');
    expect(JSON.stringify(r.anomaly_samples)).not.toContain('email');
    expect(JSON.stringify(r.anomaly_samples)).not.toContain(rows[0]!.session_id as string);
  });

  it('anomaly_sample_limit=0 suppresses samples but counter remains accurate', async () => {
    const rows = [
      mkRow({ poi_observation_id: 1, evidence_refs: 'bad' }),
      mkRow({ poi_observation_id: 2, evidence_refs: 'bad' }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions({ anomaly_sample_limit: 0 }),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.invalid_evidence_refs_count).toBe(2);
    expect(r.anomaly_samples.invalid_evidence_refs).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * K. Runner — table absent → early empty report
 * ------------------------------------------------------------------------ */

describe('K. runner — table absent', () => {
  it('table_present=false returns empty report without querying the table', async () => {
    let queriedTable = false;
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_present: false }], rowCount: 1 };
      }
      if (sql.includes('FROM poi_observations_v0_1')) {
        queriedTable = true;
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(queriedTable).toBe(false);
    expect(r.rows_scanned).toBe(0);
    expect(r.sessions_seen).toBe(0);
    expect(r.total_anomalies).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * L. Static-source boundary sweep — PR#12b runtime files
 * ------------------------------------------------------------------------ */

const PR12B_RUNTIME_FILES = [
  'src/scoring/poi-sequence-observer/types.ts',
  'src/scoring/poi-sequence-observer/query.ts',
  'src/scoring/poi-sequence-observer/mapper.ts',
  'src/scoring/poi-sequence-observer/report.ts',
  'src/scoring/poi-sequence-observer/runner.ts',
  'src/scoring/poi-sequence-observer/index.ts',
  'scripts/poi-sequence-observation-report.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('L. static-source boundary sweep', () => {
  it('no DML / DDL / GRANT / REVOKE / TRUNCATE in active TS source', () => {
    for (const f of PR12B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/);
      expect(src, `${f} must not contain UPDATE … SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
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
    for (const f of PR12B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        const fromRe  = new RegExp(`\\bFROM\\s+${t}\\b`);
        const joinRe  = new RegExp(`\\bJOIN\\s+${t}\\b`);
        const writeRe = new RegExp(`\\b(?:INSERT\\s+INTO|UPDATE)\\s+${t}\\b`);
        expect(src, `${f} must not FROM ${t}`).not.toMatch(fromRe);
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(joinRe);
        expect(src, `${f} must not write to ${t}`).not.toMatch(writeRe);
      }
    }
  });

  it('no imports from policy / trust / lane / collector / app / server / auth / PR#11b observer / PR#11c worker', () => {
    for (const f of PR12B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/policy/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/trust/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/lane/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-core-observer/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-core-worker/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/app/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/server/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth/);
    }
  });

  it('PR#12b runtime source does NOT mint AMS Series Core reserved names', () => {
    // The literal strings 'SeriesOutput', 'TimeOutput', 'seriescore',
    // 'series_version', 'series_eligible', 'series_observations_v0_1'
    // are reserved AMS canonical names (truth file §10 + §23). PR#12b
    // is "POI Sequence", not "Series Core" — these must not appear in
    // runtime source. Docs / tests / comments may reference them.
    const reserved = [
      'SeriesOutput',
      'TimeOutput',
      'seriescore',
      'series_version',
      'series_eligible',
      'series_observations_v0_1',
      'observe:series',
    ];
    for (const f of PR12B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reserved) {
        expect(src, `${f} must not mint reserved AMS Series name "${name}"`).not.toContain(name);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * M. SQL constants — allowlist + read-only
 * ------------------------------------------------------------------------ */

describe('M. SQL constants — allowlist', () => {
  const allSql = [
    SELECT_TABLE_PRESENT_SQL,
    SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL,
  ];

  it('every SQL constant reads only poi_observations_v0_1 or information_schema', () => {
    const forbidden = [
      'session_features', 'session_behavioural_features_v0_2',
      'stage0_decisions', 'accepted_events', 'rejected_events',
      'ingest_requests', 'risk_observations_v0_1',
      'scoring_output_lane_a', 'scoring_output_lane_b',
      'site_write_tokens',
    ];
    for (const sql of allSql) {
      for (const t of forbidden) {
        expect(sql).not.toMatch(new RegExp(`\\bFROM\\s+${t}\\b`));
        expect(sql).not.toMatch(new RegExp(`\\bJOIN\\s+${t}\\b`));
      }
    }
  });

  it('every SQL constant is read-only (no DML / DDL / GRANT / REVOKE)', () => {
    for (const sql of allSql) {
      expect(sql).not.toMatch(/\bINSERT\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+[a-z_]/i);
      expect(sql).not.toMatch(/\bDELETE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bCREATE\b/i);
      expect(sql).not.toMatch(/\bALTER\b/i);
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bGRANT\b/i);
      expect(sql).not.toMatch(/\bREVOKE\b/i);
    }
  });

  it('SELECT_TABLE_PRESENT_SQL reads information_schema.tables only', () => {
    expect(SELECT_TABLE_PRESENT_SQL).toMatch(/FROM information_schema\.tables/);
    expect(SELECT_TABLE_PRESENT_SQL).not.toMatch(/FROM poi_observations_v0_1/);
  });

  it('SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL reads poi_observations_v0_1 only, no JOIN', () => {
    expect(SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL).toMatch(/FROM poi_observations_v0_1/);
    expect(SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL).not.toMatch(/\bJOIN\b/i);
  });
});

/* --------------------------------------------------------------------------
 * N. Privacy — no poi_key / no full session_id / no DSN in report
 * ------------------------------------------------------------------------ */

describe('N. privacy posture', () => {
  it('serialised report does not contain poi_key values by default (samples only carry IDs)', async () => {
    const SECRET_POI_KEY = '/secret-pricing-page';
    const rows = [
      mkRow({ poi_observation_id: 1, poi_key: SECRET_POI_KEY }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    const serialised = serialiseReport(r);
    expect(serialised).not.toContain(SECRET_POI_KEY);
  });

  it('serialised report does not contain full session_id (only masked prefixes)', async () => {
    const FULL_SESS = 'sess_aaaaaaaa1111bbbbbbbb2222FULL_REVEAL_TOKEN';
    const rows = [
      mkRow({ poi_observation_id: 1, session_id: FULL_SESS }),
    ];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    const serialised = serialiseReport(r);
    expect(serialised).not.toContain(FULL_SESS);
    expect(serialised).not.toContain('FULL_REVEAL_TOKEN');
  });

  it('serialised report does not contain DSN password', () => {
    const r = aggregateReport(emptyAggregateInputs({
      run_metadata: baselineRunMetadata({ database_host: 'db.internal:5432', database_name: 'buyerrecon_staging' }),
    }));
    const serialised = serialiseReport(r);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('postgres://');
  });

  it('forbidden tokens recursive list — none present anywhere in serialised report', async () => {
    // Construct a report whose underlying rows contain none of the
    // forbidden field NAMES in JSON-key position. We then assert no
    // forbidden NAME appears as a JSON key in the output.
    const rows = [mkRow({ poi_observation_id: 1 })];
    const stub = makeStubClient(makeStubFor(rows));
    const r = await runPoiSequenceObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    const serialised = serialiseReport(r);
    for (const k of FORBIDDEN_REF_KEYS) {
      const keyPattern = new RegExp(`"${k}"\\s*:`);
      expect(serialised, `forbidden key "${k}" must not appear as JSON key in report`).not.toMatch(keyPattern);
    }
  });
});

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function mkRecord(over: Partial<PoiSequenceRecord> = {}): PoiSequenceRecord {
  return {
    poi_sequence_version:           POI_SEQUENCE_VERSION,
    workspace_id:                   'ws_demo',
    site_id:                        'site_demo',
    session_id:                     'sess_aaaaaaaa1111bbbbbbbb1111',
    poi_input_versions:             [POI_CORE_INPUT_VERSION],
    poi_observation_versions:       [POI_OBSERVATION_VERSION_EXPECTED],
    extraction_versions:            ['sf-v0.4'],
    poi_count:                      1,
    unique_poi_count:               1,
    first_poi_type:                 'page_path',
    first_poi_key_present:          true,
    last_poi_type:                  'page_path',
    last_poi_key_present:           true,
    first_seen_at:                  ISO_T0,
    last_seen_at:                   ISO_T1,
    duration_seconds:               30,
    repeated_poi_count:             0,
    has_repetition:                 false,
    has_progression:                false,
    progression_depth:              1,
    poi_sequence_pattern_class:     'single_poi',
    stage0_excluded:                false,
    poi_sequence_eligible:          true,
    evidence_refs_count:            1,
    anomaly_invalid_evidence_refs:    0,
    anomaly_invalid_source_versions:  0,
    anomaly_forbidden_source_table:   0,
    anomaly_forbidden_key_present:    0,
    ...over,
  };
}
