/**
 * Sprint 2 PR#12e — POI Sequence Table Observer — tests.
 *
 * Pure tests. No real pg connection. Stub client exercises every
 * SQL allowlist + aggregator + masking path.
 *
 * Test groups:
 *   A. Masking helpers
 *   B. Aggregator — counters + total rollup + anomaly samples
 *   C. Aggregator — distribution folding
 *   D. End-to-end via stub client — healthy run (8 single_poi rows)
 *   E. End-to-end — table absent → early empty report
 *   F. End-to-end — anomalies surface in counters + samples
 *   G. Anomaly samples expose only numeric ID; no poi_key / no session_id /
 *      no evidence_refs / no source_versions payload
 *   H. Static-source sweep — read scope + no DML/DDL + no forbidden table reads
 *   I. SQL constants — allowlist (only `poi_sequence_observations_v0_1`
 *      + `information_schema`)
 *   J. AMS Series Core reserved-name guard
 *   K. Forbidden-column / scoring-name guard in runtime
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  aggregateReport,
  ANOMALY_KINDS,
  FORBIDDEN_COLUMNS,
  makeStubClient,
  parseDatabaseUrl,
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  runPoiSequenceTableObserver,
  SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
  SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  SELECT_FORBIDDEN_COLUMNS_SQL,
  SELECT_HAS_PROGRESSION_DISTRIBUTION_SQL,
  SELECT_HAS_PROGRESSION_MISMATCH_COUNT_SQL,
  SELECT_HAS_PROGRESSION_MISMATCH_SAMPLE_SQL,
  SELECT_HAS_REPETITION_DISTRIBUTION_SQL,
  SELECT_HAS_REPETITION_MISMATCH_COUNT_SQL,
  SELECT_HAS_REPETITION_MISMATCH_SAMPLE_SQL,
  SELECT_INVALID_PATTERN_CLASS_COUNT_SQL,
  SELECT_INVALID_PATTERN_CLASS_SAMPLE_SQL,
  SELECT_NEGATIVE_COUNT_COUNT_SQL,
  SELECT_NEGATIVE_COUNT_SAMPLE_SQL,
  SELECT_NEGATIVE_DURATION_COUNT_SQL,
  SELECT_NEGATIVE_DURATION_SAMPLE_SQL,
  SELECT_POI_COUNT_DISTRIBUTION_SQL,
  SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_COUNT_SQL,
  SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  SELECT_POI_SEQUENCE_PATTERN_CLASS_DISTRIBUTION_SQL,
  SELECT_POI_SEQUENCE_VERSION_DISTRIBUTION_SQL,
  SELECT_PROGRESSION_DEPTH_DISTRIBUTION_SQL,
  SELECT_PROGRESSION_DEPTH_MISMATCH_COUNT_SQL,
  SELECT_PROGRESSION_DEPTH_MISMATCH_SAMPLE_SQL,
  SELECT_REPEATED_POI_COUNT_MISMATCH_COUNT_SQL,
  SELECT_REPEATED_POI_COUNT_MISMATCH_SAMPLE_SQL,
  SELECT_ROW_COUNT_SQL,
  SELECT_SAMPLE_SESSION_IDS_SQL,
  SELECT_SOURCE_COUNT_MISMATCH_COUNT_SQL,
  SELECT_SOURCE_COUNT_MISMATCH_SAMPLE_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
  SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
  SELECT_TABLE_PRESENT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  SELECT_UNIQUE_SESSION_IDS_SQL,
  SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
  type AnomalyKind,
  type TableObserverRunMetadata,
  type TableObserverRunOptions,
} from '../../src/scoring/poi-sequence-table-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const ISO_NOW    = '2026-05-14T18:00:00.000Z';
const ISO_BEFORE = '2026-05-13T18:00:00.000Z';

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function baselineRunMetadata(over: Partial<TableObserverRunMetadata> = {}): TableObserverRunMetadata {
  return {
    source_table:                     'poi_sequence_observations_v0_1',
    workspace_id_filter:              'ws_demo',
    site_id_filter:                   'site_demo',
    window_start:                     ISO_BEFORE,
    window_end:                       ISO_NOW,
    row_limit:                        10_000,
    sample_limit:                     10,
    anomaly_sample_limit:             5,
    database_host:                    'localhost:5432',
    database_name:                    'buyerrecon_test',
    run_started_at:                   ISO_NOW,
    run_ended_at:                     ISO_NOW,
    poi_sequence_version_expected:    'poi-sequence-v0.1',
    poi_observation_version_expected: 'poi-observation-v0.1',
    forbidden_columns_checked:        FORBIDDEN_COLUMNS,
    record_only:                      true,
    ...over,
  };
}

function baselineRunOptions(over: Partial<TableObserverRunOptions> = {}): TableObserverRunOptions {
  return {
    workspace_id:                       'ws_demo',
    site_id:                            'site_demo',
    window_start:                       new Date(ISO_BEFORE),
    window_end:                         new Date(ISO_NOW),
    limit:                              10_000,
    sample_limit:                       10,
    anomaly_sample_limit:               5,
    poi_sequence_version_expected:      'poi-sequence-v0.1',
    poi_observation_version_expected:   'poi-observation-v0.1',
    ...over,
  };
}

function emptyAggregateInputs(over: Partial<AggregateInputs> = {}): AggregateInputs {
  const emptyIds:    Record<AnomalyKind, readonly number[]> =
    Object.fromEntries(ANOMALY_KINDS.map((k) => [k, [] as readonly number[]])) as Record<AnomalyKind, readonly number[]>;
  const emptyCounts: Record<AnomalyKind, number> =
    Object.fromEntries(ANOMALY_KINDS.map((k) => [k, 0])) as Record<AnomalyKind, number>;
  return {
    table_present:                                  true,
    rows_in_table:                                  0,
    rows_inspected:                                 0,
    anomaly_counts:                                 emptyCounts,
    anomaly_sample_ids:                             emptyIds,
    forbidden_column_names_present:                 [],
    poi_sequence_pattern_class_rows:                [],
    poi_count_distribution_rows:                    [],
    progression_depth_distribution_rows:            [],
    stage0_excluded_distribution_rows:              [],
    poi_sequence_eligible_distribution_rows:        [],
    has_repetition_distribution_rows:               [],
    has_progression_distribution_rows:              [],
    poi_sequence_version_distribution_rows:         [],
    poi_observation_version_distribution_rows:      [],
    unique_session_ids_seen:                        0,
    unique_workspace_site_pairs_seen:               0,
    sample_session_ids_raw:                         [],
    run_metadata:                                   baselineRunMetadata(),
    ...over,
  };
}

function inputsWithAnomaly(kind: AnomalyKind, count: number, sample_ids: readonly number[]): AggregateInputs {
  const base = emptyAggregateInputs();
  const counts = { ...base.anomaly_counts } as Record<AnomalyKind, number>;
  const ids    = { ...base.anomaly_sample_ids } as Record<AnomalyKind, readonly number[]>;
  counts[kind] = count;
  ids[kind]    = Object.freeze([...sample_ids]);
  return { ...base, anomaly_counts: counts, anomaly_sample_ids: ids };
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
 * B. Aggregator — counters + total rollup + anomaly samples
 * ------------------------------------------------------------------------ */

describe('B. aggregator counters + rollup', () => {
  it('empty inputs → zero anomalies + total_anomalies = 0', () => {
    const r = aggregateReport(emptyAggregateInputs());
    expect(r.duplicate_natural_key_count).toBe(0);
    expect(r.poi_sequence_eligible_mismatch_count).toBe(0);
    expect(r.invalid_pattern_class_count).toBe(0);
    expect(r.has_progression_mismatch_count).toBe(0);
    expect(r.progression_depth_mismatch_count).toBe(0);
    expect(r.repeated_poi_count_mismatch_count).toBe(0);
    expect(r.has_repetition_mismatch_count).toBe(0);
    expect(r.source_count_mismatch_count).toBe(0);
    expect(r.negative_count_count).toBe(0);
    expect(r.timestamp_ordering_violation_count).toBe(0);
    expect(r.negative_duration_count).toBe(0);
    expect(r.evidence_refs_invalid_count).toBe(0);
    expect(r.evidence_refs_forbidden_direct_table_count).toBe(0);
    expect(r.evidence_refs_bad_id_count).toBe(0);
    expect(r.source_versions_invalid_count).toBe(0);
    expect(r.forbidden_column_present_count).toBe(0);
    expect(r.total_anomalies).toBe(0);
  });

  it('per-kind counts feed correct counter + total rolls up', () => {
    const base = emptyAggregateInputs();
    const counts = { ...base.anomaly_counts } as Record<AnomalyKind, number>;
    counts.duplicate_natural_key                = 2;
    counts.poi_sequence_eligible_mismatch       = 1;
    counts.invalid_pattern_class                = 3;
    counts.has_progression_mismatch             = 1;
    counts.progression_depth_mismatch           = 1;
    counts.repeated_poi_count_mismatch          = 1;
    counts.has_repetition_mismatch              = 1;
    counts.source_count_mismatch                = 1;
    counts.negative_count                       = 1;
    counts.timestamp_ordering_violation         = 1;
    counts.negative_duration                    = 1;
    counts.evidence_refs_invalid                = 1;
    counts.evidence_refs_forbidden_direct_table = 1;
    counts.evidence_refs_bad_id                 = 1;
    counts.source_versions_invalid              = 1;
    const r = aggregateReport({
      ...base,
      anomaly_counts: counts,
      forbidden_column_names_present: ['email', 'user_agent'],
    });
    // 2+1+3+1+1+1+1+1+1+1+1+1+1+1+1 = 18 row-level + 2 forbidden = 20
    expect(r.total_anomalies).toBe(20);
    expect(r.forbidden_column_present_count).toBe(2);
  });

  it('counter independent of sample IDs length (PR#11d Codex-blocker pattern)', () => {
    const inputs = inputsWithAnomaly('duplicate_natural_key', 100, [1, 2, 3, 4, 5]);
    const r = aggregateReport(inputs);
    expect(r.duplicate_natural_key_count).toBe(100);
    expect(r.anomaly_samples.duplicate_natural_key).toEqual([1, 2, 3, 4, 5]);
    expect(r.total_anomalies).toBe(100);
  });

  it('counter remains accurate when anomaly_sample_limit=0 (samples suppressed)', () => {
    const inputs = inputsWithAnomaly('poi_sequence_eligible_mismatch', 42, []);
    const r = aggregateReport(inputs);
    expect(r.poi_sequence_eligible_mismatch_count).toBe(42);
    expect(r.anomaly_samples.poi_sequence_eligible_mismatch).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * C. Aggregator — distribution folding
 * ------------------------------------------------------------------------ */

describe('C. distribution folding', () => {
  it('folds pattern-class distribution rows', () => {
    const r = aggregateReport(emptyAggregateInputs({
      poi_sequence_pattern_class_rows: [
        { bucket: 'single_poi',          count: '8' },
        { bucket: 'multi_poi_linear',    count: '2' },
        { bucket: 'loop_or_backtrack',   count: '1' },
      ],
    }));
    expect(r.poi_sequence_pattern_class_distribution.single_poi).toBe(8);
    expect(r.poi_sequence_pattern_class_distribution.multi_poi_linear).toBe(2);
    expect(r.poi_sequence_pattern_class_distribution.loop_or_backtrack).toBe(1);
    expect(r.poi_sequence_pattern_class_distribution.unknown).toBe(0);
  });

  it('folds boolean distributions (stage0_excluded, poi_sequence_eligible, has_repetition, has_progression)', () => {
    const r = aggregateReport(emptyAggregateInputs({
      stage0_excluded_distribution_rows:        [{ bucket: true, count: 6 }, { bucket: false, count: 2 }],
      poi_sequence_eligible_distribution_rows:  [{ bucket: true, count: 2 }, { bucket: false, count: 6 }],
      has_repetition_distribution_rows:         [{ bucket: false, count: 8 }],
      has_progression_distribution_rows:        [{ bucket: false, count: 8 }],
    }));
    expect(r.stage0_excluded_distribution).toEqual({ true_count: 6, false_count: 2 });
    expect(r.poi_sequence_eligible_distribution).toEqual({ true_count: 2, false_count: 6 });
    expect(r.has_repetition_distribution).toEqual({ true_count: 0, false_count: 8 });
    expect(r.has_progression_distribution).toEqual({ true_count: 0, false_count: 8 });
  });

  it('folds bucketed poi_count + progression_depth + version distributions', () => {
    const r = aggregateReport(emptyAggregateInputs({
      poi_count_distribution_rows:                  [{ bucket: '1', count: 8 }],
      progression_depth_distribution_rows:          [{ bucket: '1', count: 8 }],
      poi_sequence_version_distribution_rows:       [{ bucket: 'poi-sequence-v0.1', count: 8 }],
      poi_observation_version_distribution_rows:    [{ bucket: 'poi-observation-v0.1', count: 8 }],
    }));
    expect(r.poi_count_distribution['1']).toBe(8);
    expect(r.progression_depth_distribution['1']).toBe(8);
    expect(r.poi_sequence_version_distribution['poi-sequence-v0.1']).toBe(8);
    expect(r.poi_observation_version_distribution['poi-observation-v0.1']).toBe(8);
  });
});

/* --------------------------------------------------------------------------
 * D. End-to-end — healthy run (8 single_poi rows)
 * ------------------------------------------------------------------------ */

function makeHealthyStub() {
  return async (sql: string, _params: readonly unknown[]) => {
    if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
    if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
    if (sql.includes('SELECT COUNT(*)::bigint AS row_count')) return { rows: [{ row_count: '8' }], rowCount: 1 };
    // Specific COUNT queries — must match BEFORE the generic
    // `COUNT(*)::bigint AS count` branch below.
    if (sql.includes('COUNT(DISTINCT session_id)')) return { rows: [{ count: '8' }], rowCount: 1 };
    if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '1' }], rowCount: 1 };
    if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
    // Distribution queries
    if (sql.includes('poi_sequence_pattern_class AS bucket')) {
      return { rows: [{ bucket: 'single_poi', count: '8' }], rowCount: 1 };
    }
    if (sql.includes('CASE') && sql.includes('poi_count')) {
      return { rows: [{ bucket: '1', count: '8' }], rowCount: 1 };
    }
    if (sql.includes('CASE') && sql.includes('progression_depth')) {
      return { rows: [{ bucket: '1', count: '8' }], rowCount: 1 };
    }
    if (sql.includes('stage0_excluded AS bucket')) {
      return { rows: [{ bucket: true, count: '6' }, { bucket: false, count: '2' }], rowCount: 2 };
    }
    if (sql.includes('poi_sequence_eligible AS bucket')) {
      return { rows: [{ bucket: true, count: '2' }, { bucket: false, count: '6' }], rowCount: 2 };
    }
    if (sql.includes('has_repetition AS bucket')) {
      return { rows: [{ bucket: false, count: '8' }], rowCount: 1 };
    }
    if (sql.includes('has_progression AS bucket')) {
      return { rows: [{ bucket: false, count: '8' }], rowCount: 1 };
    }
    if (sql.includes('poi_sequence_version AS bucket')) {
      return { rows: [{ bucket: 'poi-sequence-v0.1', count: '8' }], rowCount: 1 };
    }
    if (sql.includes('poi_observation_version AS bucket')) {
      return { rows: [{ bucket: 'poi-observation-v0.1', count: '8' }], rowCount: 1 };
    }
    if (sql.includes('SELECT DISTINCT session_id')) {
      return { rows: [{ session_id: 'sess_aaaaaaaa1111bbbbbbbb1111' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
}

describe('D. end-to-end — healthy run', () => {
  it('8 single_poi rows / 6 excluded / 2 eligible / 0 anomalies', async () => {
    const stub = makeStubClient(makeHealthyStub());
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.table_present).toBe(true);
    expect(r.rows_in_table).toBe(8);
    expect(r.total_anomalies).toBe(0);
    expect(r.poi_sequence_pattern_class_distribution.single_poi).toBe(8);
    expect(r.stage0_excluded_distribution).toEqual({ true_count: 6, false_count: 2 });
    expect(r.poi_sequence_eligible_distribution).toEqual({ true_count: 2, false_count: 6 });
    expect(r.unique_session_ids_seen).toBe(8);
    expect(r.unique_workspace_site_pairs_seen).toBe(1);
    expect(r.run_metadata.source_table).toBe('poi_sequence_observations_v0_1');
    expect(r.run_metadata.record_only).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * E. Table absent → early empty report
 * ------------------------------------------------------------------------ */

describe('E. table absent', () => {
  it('table_present=false returns empty report without querying anomalies', async () => {
    let queriedTable = false;
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_present: false }], rowCount: 1 };
      }
      if (sql.includes('FROM poi_sequence_observations_v0_1')) {
        queriedTable = true;
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(queriedTable).toBe(false);
    expect(r.table_present).toBe(false);
    expect(r.rows_in_table).toBe(0);
    expect(r.total_anomalies).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * F. Anomalies surface in counters + samples
 * ------------------------------------------------------------------------ */

describe('F. anomalies surface', () => {
  it('duplicate_natural_key non-zero → counter exact, samples capped', async () => {
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
      if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
      if (sql.includes('row_count')) return { rows: [{ row_count: '20' }], rowCount: 1 };
      if (sql === SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL) return { rows: [{ count: '7' }], rowCount: 1 };
      if (sql === SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL) {
        return { rows: [
          { poi_sequence_observation_id: 11 },
          { poi_sequence_observation_id: 12 },
          { poi_sequence_observation_id: 13 },
          { poi_sequence_observation_id: 14 },
          { poi_sequence_observation_id: 15 },
        ], rowCount: 5 };
      }
      if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('AS bucket')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(DISTINCT session_id)')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '0' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.duplicate_natural_key_count).toBe(7);
    expect(r.anomaly_samples.duplicate_natural_key).toEqual([11, 12, 13, 14, 15]);
    expect(r.total_anomalies).toBe(7);
  });

  it('evidence_refs_forbidden_direct_table surfaces (OD-14 guard)', async () => {
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
      if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
      if (sql.includes('row_count')) return { rows: [{ row_count: '1' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL) return { rows: [{ count: '3' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL) {
        return { rows: [{ poi_sequence_observation_id: 99 }], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('AS bucket')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(DISTINCT')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '0' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.evidence_refs_forbidden_direct_table_count).toBe(3);
    expect(r.anomaly_samples.evidence_refs_forbidden_direct_table).toEqual([99]);
  });

  it('forbidden_column_present surfaces verbatim from schema sweep', async () => {
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
      if (sql.includes('information_schema.columns')) {
        return { rows: [{ column_name: 'lane_a' }, { column_name: 'trust_decision' }], rowCount: 2 };
      }
      if (sql.includes('row_count')) return { rows: [{ row_count: '1' }], rowCount: 1 };
      if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('AS bucket')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(DISTINCT')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '0' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.forbidden_column_names_present).toEqual(['lane_a', 'trust_decision']);
    expect(r.forbidden_column_present_count).toBe(2);
    expect(r.total_anomalies).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * G. Anomaly samples carry IDs only — no payload
 * ------------------------------------------------------------------------ */

describe('G. anomaly samples — IDs only, no payload', () => {
  it('forbidden_direct_table anomaly sample does not surface poi_key / session_id / evidence_refs / source_versions', async () => {
    const SECRET = 'sess_LEAK_ME_PLEASE_xxxxxxxxxxxxxxxx';
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
      if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
      if (sql.includes('row_count')) return { rows: [{ row_count: '1' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL) return { rows: [{ count: '1' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL) {
        // Even if the stub were to leak extra columns, the runner picks
        // only poi_sequence_observation_id; the aggregator only stores IDs.
        return { rows: [{
          poi_sequence_observation_id: 42,
          session_id: SECRET,
          poi_key: '/secret-page',
          evidence_refs: [{ table: 'session_features', email: 'leak@x' }],
        }], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('AS bucket')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(DISTINCT')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '0' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.anomaly_samples.evidence_refs_forbidden_direct_table).toEqual([42]);
    const serialised = JSON.stringify(r.anomaly_samples);
    expect(serialised).not.toContain(SECRET);
    expect(serialised).not.toContain('/secret-page');
    expect(serialised).not.toContain('leak@x');
    expect(serialised).not.toContain('session_features');
  });

  it('serialised report does not contain forbidden field names as JSON keys', async () => {
    const stub = makeStubClient(makeHealthyStub());
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    const serialised = serialiseReport(r);
    // Forbidden column names must not appear as JSON KEYS in the report
    // (they may appear inside `forbidden_columns_checked` as VALUE
    // strings — that's expected; the test asserts they're not keys).
    const valueListedColumns = new Set(FORBIDDEN_COLUMNS);
    for (const name of FORBIDDEN_COLUMNS) {
      // Defensive: assert there is no JSON object key `"<name>":` in the report.
      const keyPattern = new RegExp(`"${name}"\\s*:`);
      // Some names like 'report' appear in the report's literal source_table
      // metadata string set; but never as JSON keys for runtime fields.
      // We allow appearance only if it's surrounded by the
      // `forbidden_columns_checked` value list (where the names are strings,
      // not keys). The key-pattern check is enough — value-list strings are
      // not followed by `:`.
      expect(serialised, `forbidden column "${name}" must not appear as JSON key`).not.toMatch(keyPattern);
      // Touch valueListedColumns to keep lint quiet.
      void valueListedColumns;
    }
  });
});

/* --------------------------------------------------------------------------
 * H. Static-source sweep — PR#12e runtime files
 * ------------------------------------------------------------------------ */

const PR12E_RUNTIME_FILES = [
  'src/scoring/poi-sequence-table-observer/types.ts',
  'src/scoring/poi-sequence-table-observer/query.ts',
  'src/scoring/poi-sequence-table-observer/report.ts',
  'src/scoring/poi-sequence-table-observer/runner.ts',
  'src/scoring/poi-sequence-table-observer/index.ts',
  'scripts/poi-sequence-table-observation-report.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('H. static-source sweep', () => {
  it('no DML / DDL / GRANT / REVOKE / TRUNCATE in active TS source', () => {
    for (const f of PR12E_RUNTIME_FILES) {
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

  it('no SQL FROM/JOIN against forbidden tables (including poi_observations_v0_1)', () => {
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
      'poi_observations_v0_1',
    ];
    for (const f of PR12E_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const t of forbidden) {
        const fromRe = new RegExp(`\\bFROM\\s+${t}\\b`);
        const joinRe = new RegExp(`\\bJOIN\\s+${t}\\b`);
        expect(src, `${f} must not FROM ${t}`).not.toMatch(fromRe);
        expect(src, `${f} must not JOIN ${t}`).not.toMatch(joinRe);
      }
    }
  });

  it('no imports from policy / trust / lane / collector / app / server / auth / workers', () => {
    for (const f of PR12E_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/policy/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/trust/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/lane/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-core-worker/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-sequence-worker/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/app/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/server/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth/);
    }
  });
});

/* --------------------------------------------------------------------------
 * I. SQL constants — allowlist (poi_sequence_observations_v0_1 + info_schema only)
 * ------------------------------------------------------------------------ */

describe('I. SQL constants — allowlist', () => {
  const allSql = [
    SELECT_TABLE_PRESENT_SQL,
    SELECT_ROW_COUNT_SQL,
    SELECT_FORBIDDEN_COLUMNS_SQL,
    SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
    SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
    SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_COUNT_SQL,
    SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_SAMPLE_SQL,
    SELECT_INVALID_PATTERN_CLASS_COUNT_SQL,
    SELECT_INVALID_PATTERN_CLASS_SAMPLE_SQL,
    SELECT_HAS_PROGRESSION_MISMATCH_COUNT_SQL,
    SELECT_HAS_PROGRESSION_MISMATCH_SAMPLE_SQL,
    SELECT_PROGRESSION_DEPTH_MISMATCH_COUNT_SQL,
    SELECT_PROGRESSION_DEPTH_MISMATCH_SAMPLE_SQL,
    SELECT_REPEATED_POI_COUNT_MISMATCH_COUNT_SQL,
    SELECT_REPEATED_POI_COUNT_MISMATCH_SAMPLE_SQL,
    SELECT_HAS_REPETITION_MISMATCH_COUNT_SQL,
    SELECT_HAS_REPETITION_MISMATCH_SAMPLE_SQL,
    SELECT_SOURCE_COUNT_MISMATCH_COUNT_SQL,
    SELECT_SOURCE_COUNT_MISMATCH_SAMPLE_SQL,
    SELECT_NEGATIVE_COUNT_COUNT_SQL,
    SELECT_NEGATIVE_COUNT_SAMPLE_SQL,
    SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
    SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
    SELECT_NEGATIVE_DURATION_COUNT_SQL,
    SELECT_NEGATIVE_DURATION_SAMPLE_SQL,
    SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
    SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
    SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL,
    SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL,
    SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL,
    SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL,
    SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
    SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
    SELECT_POI_SEQUENCE_PATTERN_CLASS_DISTRIBUTION_SQL,
    SELECT_POI_COUNT_DISTRIBUTION_SQL,
    SELECT_PROGRESSION_DEPTH_DISTRIBUTION_SQL,
    SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
    SELECT_POI_SEQUENCE_ELIGIBLE_DISTRIBUTION_SQL,
    SELECT_HAS_REPETITION_DISTRIBUTION_SQL,
    SELECT_HAS_PROGRESSION_DISTRIBUTION_SQL,
    SELECT_POI_SEQUENCE_VERSION_DISTRIBUTION_SQL,
    SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL,
    SELECT_UNIQUE_SESSION_IDS_SQL,
    SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL,
    SELECT_SAMPLE_SESSION_IDS_SQL,
  ];

  it('every SQL constant reads only poi_sequence_observations_v0_1 or information_schema', () => {
    const forbidden = [
      'session_features', 'session_behavioural_features_v0_2',
      'stage0_decisions', 'accepted_events', 'rejected_events',
      'ingest_requests', 'risk_observations_v0_1',
      'scoring_output_lane_a', 'scoring_output_lane_b',
      'site_write_tokens', 'poi_observations_v0_1',
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
    expect(SELECT_TABLE_PRESENT_SQL).not.toMatch(/FROM poi_sequence_observations_v0_1/);
  });

  it('SELECT_FORBIDDEN_COLUMNS_SQL reads information_schema.columns only', () => {
    expect(SELECT_FORBIDDEN_COLUMNS_SQL).toMatch(/FROM information_schema\.columns/);
    expect(SELECT_FORBIDDEN_COLUMNS_SQL).not.toMatch(/FROM poi_sequence_observations_v0_1/);
  });
});

/* --------------------------------------------------------------------------
 * J. AMS Series Core reserved-name guard
 * ------------------------------------------------------------------------ */

describe('J. AMS Series Core reserved-name guard', () => {
  it('PR#12e runtime does NOT mint reserved AMS Series Core names', () => {
    const reserved = [
      'SeriesOutput',
      'TimeOutput',
      'seriescore',
      'series_version',
      'series_eligible',
      'series_observations_v0_1',
      'observe:series',
      'series-input',
    ];
    for (const f of PR12E_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reserved) {
        expect(src, `${f} must not mint reserved AMS Series name "${name}"`).not.toContain(name);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * K. Forbidden-column / scoring-name guard in runtime
 * ------------------------------------------------------------------------ */

/* --------------------------------------------------------------------------
 * L. evidence_refs_bad_id — integer validation (Codex blocker)
 *
 * `evidence_refs[].poi_observation_id` MUST be a JSON number that
 * represents a non-negative integer BIGSERIAL id. The PR#11d / PR#12d
 * pattern used `(elem ->> 'poi_observation_id')::numeric < 0` which
 * passes fractional values like `1.5`. The patched predicate adds an
 * integer-only check via `numeric = trunc(numeric)`.
 *
 * Tests here are split into two layers:
 *   1. SQL-string content assertions on the actual constants exported
 *      from query.ts — proves the predicate names every gate.
 *   2. JS mirror validator that re-implements the predicate logic for
 *      behaviour testing (real Postgres isn't available in pure tests).
 * ------------------------------------------------------------------------ */

describe('L. evidence_refs_bad_id — integer validation', () => {
  it('bad-id SQL predicate includes null-check, type-check, negative-check, and integer-check', () => {
    const sql = SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL;
    // null-check
    expect(sql).toMatch(/\(elem -> 'poi_observation_id'\) IS NULL/);
    // type-check
    expect(sql).toMatch(/jsonb_typeof\(elem -> 'poi_observation_id'\) <> 'number'/);
    // negative-check
    expect(sql).toMatch(/\(elem ->> 'poi_observation_id'\)::numeric < 0/);
    // integer-check (fractional rejection)
    expect(sql).toMatch(/trunc\(\s*\(elem ->> 'poi_observation_id'\)::numeric\s*\)/);
    // The cast must be guarded by a type-check (defence against
    // optimizer re-ordering of the cast).
    expect(sql).toMatch(/jsonb_typeof\(elem -> 'poi_observation_id'\)\s*=\s*'number'/);
  });

  it('bad-id SAMPLE SQL mirrors the COUNT predicate', () => {
    const sample = SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL;
    expect(sample).toMatch(/trunc\(\s*\(elem ->> 'poi_observation_id'\)::numeric\s*\)/);
    expect(sample).toMatch(/jsonb_typeof\(elem -> 'poi_observation_id'\) <> 'number'/);
  });

  // JS mirror — re-implements the SQL predicate so we can prove the
  // four reject categories without a real Postgres. The mirror MUST
  // stay in sync with EVIDENCE_REFS_BAD_ID_PREDICATE in query.ts.
  function isBadId(elem: Record<string, unknown>): boolean {
    if (!('poi_observation_id' in elem) || elem.poi_observation_id === undefined) return true;
    const v = elem.poi_observation_id;
    if (v === null) return true;
    if (typeof v !== 'number') return true;             // jsonb_typeof <> 'number'
    if (!Number.isFinite(v)) return true;
    if (v < 0) return true;                              // numeric < 0
    if (v !== Math.trunc(v)) return true;                // numeric <> trunc(numeric)
    return false;
  }

  it('integer JSON number passes (e.g. 7)', () => {
    expect(isBadId({ poi_observation_id: 7 })).toBe(false);
    expect(isBadId({ poi_observation_id: 0 })).toBe(false);
    expect(isBadId({ poi_observation_id: 123456789 })).toBe(false);
  });

  it('missing ID rejects', () => {
    expect(isBadId({ table: 'poi_observations_v0_1' })).toBe(true);
    expect(isBadId({ poi_observation_id: null as unknown as number })).toBe(true);
  });

  it('string ID rejects (JSON type "string")', () => {
    expect(isBadId({ poi_observation_id: '42' as unknown as number })).toBe(true);
    expect(isBadId({ poi_observation_id: '' as unknown as number })).toBe(true);
  });

  it('negative number rejects', () => {
    expect(isBadId({ poi_observation_id: -1 })).toBe(true);
    expect(isBadId({ poi_observation_id: -0.5 })).toBe(true);
  });

  it('fractional JSON number rejects (e.g. 1.5)', () => {
    expect(isBadId({ poi_observation_id: 1.5 })).toBe(true);
    expect(isBadId({ poi_observation_id: 0.1 })).toBe(true);
    expect(isBadId({ poi_observation_id: 99.99999 })).toBe(true);
  });

  it('boolean / array / object rejects (JSON type mismatch)', () => {
    expect(isBadId({ poi_observation_id: true as unknown as number })).toBe(true);
    expect(isBadId({ poi_observation_id: [1] as unknown as number })).toBe(true);
    expect(isBadId({ poi_observation_id: { id: 1 } as unknown as number })).toBe(true);
  });

  it('runner end-to-end: evidence_refs_bad_id surfaces in counter + ID-only sample', async () => {
    const stub = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ table_present: true }], rowCount: 1 };
      if (sql.includes('information_schema.columns')) return { rows: [], rowCount: 0 };
      if (sql.includes('row_count')) return { rows: [{ row_count: '1' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL) return { rows: [{ count: '2' }], rowCount: 1 };
      if (sql === SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL) {
        // Stub returns extra fields to prove the runner picks ONLY the id.
        return { rows: [
          { poi_sequence_observation_id: 77, evidence_refs: [{ poi_observation_id: 1.5 }] },
          { poi_sequence_observation_id: 88, evidence_refs: [{ poi_observation_id: -1 }] },
        ], rowCount: 2 };
      }
      if (sql.includes('SELECT COUNT(*)::bigint AS count')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('AS bucket')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(DISTINCT')) return { rows: [{ count: '0' }], rowCount: 1 };
      if (sql.includes('DISTINCT workspace_id, site_id')) return { rows: [{ count: '0' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await runPoiSequenceTableObserver({
      client: stub as unknown as never,
      options: baselineRunOptions(),
      database_host: 'h',
      database_name: 'd',
    });
    expect(r.evidence_refs_bad_id_count).toBe(2);
    expect(r.anomaly_samples.evidence_refs_bad_id).toEqual([77, 88]);
    const serialised = JSON.stringify(r.anomaly_samples);
    // Privacy assertions: no payload leak. The anomaly-kind keys
    // (e.g. "evidence_refs_bad_id") legitimately appear as JSON keys
    // in the serialised samples object, so we assert specifically that
    // the offending JSON payload values do NOT appear.
    expect(serialised).not.toContain('"poi_observation_id"');  // payload field name
    expect(serialised).not.toContain('1.5');                    // offending fractional value
    expect(serialised).not.toMatch(/"evidence_refs"\s*:\s*\[\{/); // raw payload array
  });
});

describe('K. forbidden-column / scoring name guard in runtime', () => {
  it('PR#12e runtime does NOT mint forbidden score / Lane / Trust / Policy / PCF / customer field names as identifiers', () => {
    // These tokens must not appear in active source as identifiers
    // (e.g. as variable names or property keys). Source-file comments
    // are stripped before this check.
    const forbiddenIdentifiers = [
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
    // Files in scope for runtime source — exclude types.ts because it
    // declares FORBIDDEN_COLUMNS (the allowlist of forbidden NAMES).
    const runtimeFiles = PR12E_RUNTIME_FILES.filter((f) => !f.endsWith('types.ts'));
    for (const f of runtimeFiles) {
      const src = stripTsComments(readSource(f));
      for (const t of forbiddenIdentifiers) {
        expect(src, `${f} must not mint identifier "${t}"`).not.toContain(t);
      }
    }
  });
});
