/**
 * Sprint 2 PR#11d — POI Observations Table Observer — tests.
 *
 * Pure tests. No real pg connection. The runner accepts a stub client;
 * in-memory tests exercise every anomaly-check, distribution, and
 * masking path.
 *
 * Test groups:
 *   - A. Masking helpers
 *   - B. Aggregator — anomaly counters / total rollup
 *   - C. Anomaly samples — sample_limit, default 5, 0 suppresses,
 *        non-PII payload only (no session_id / poi_key / evidence_refs)
 *   - D. Distribution folding (text + boolean buckets)
 *   - E. Run metadata shape + masking
 *   - F. End-to-end runPoiTableObserver via stub client — healthy run
 *   - G. End-to-end — table absent → early empty report
 *   - H. End-to-end — anomalies surface in counters + samples
 *   - I. Forbidden-column sweep
 *   - J. Static-source sweep — read scope + no DML/DDL + no PR#11b/c
 *        observer/worker imports
 *   - K. SQL constants — every query targets only allowed tables
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
} from '../../src/scoring/poi-core/index.js';
import {
  ANOMALY_KINDS,
  aggregateReport,
  FORBIDDEN_COLUMNS,
  makeStubClient,
  parseDatabaseUrl,
  POI_OBSERVATION_VERSION_EXPECTED,
  runPoiTableObserver,
  SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
  SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_COUNT_SQL,
  SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_SAMPLE_SQL,
  SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
  SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
  SELECT_FORBIDDEN_COLUMNS_SQL,
  SELECT_NEGATIVE_SOURCE_EVENT_COUNT_COUNT_SQL,
  SELECT_NEGATIVE_SOURCE_EVENT_COUNT_SAMPLE_SQL,
  SELECT_POI_ELIGIBLE_DISTRIBUTION_SQL,
  SELECT_POI_ELIGIBLE_MISMATCH_COUNT_SQL,
  SELECT_POI_ELIGIBLE_MISMATCH_SAMPLE_SQL,
  SELECT_POI_KEY_SOURCE_FIELD_DISTRIBUTION_SQL,
  SELECT_POI_KEY_UNSAFE_COUNT_SQL,
  SELECT_POI_KEY_UNSAFE_SAMPLE_SQL,
  SELECT_POI_TYPE_DISTRIBUTION_SQL,
  SELECT_ROW_COUNT_SQL,
  SELECT_SOURCE_TABLE_DISTRIBUTION_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
  SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
  SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
  SELECT_TABLE_PRESENT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
  SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
  SELECT_V0_1_ENUM_VIOLATION_COUNT_SQL,
  SELECT_V0_1_ENUM_VIOLATION_SAMPLE_SQL,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
  type AnomalyKind,
  type TableObserverRunMetadata,
  type TableObserverRunOptions,
} from '../../src/scoring/poi-table-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const ISO_NOW    = '2026-05-13T18:00:00.000Z';
const ISO_BEFORE = '2026-05-12T18:00:00.000Z';

/* --------------------------------------------------------------------------
 * A. Masking helpers
 * ------------------------------------------------------------------------ */

describe('A. masking helpers', () => {
  it('truncateSessionId masks long IDs to prefix…suffix', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });
  it('truncateSessionId returns *** for short IDs', () => {
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });
  it('parseDatabaseUrl returns host + db name only, never the password', () => {
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
 * B. Aggregator — counters + rollup
 * ------------------------------------------------------------------------ */

function emptyAggregateInputs(over: Partial<AggregateInputs> = {}): AggregateInputs {
  const emptyIds:    Record<AnomalyKind, readonly number[]> =
    Object.fromEntries(ANOMALY_KINDS.map((k) => [k, [] as readonly number[]])) as Record<AnomalyKind, readonly number[]>;
  const emptyCounts: Record<AnomalyKind, number> =
    Object.fromEntries(ANOMALY_KINDS.map((k) => [k, 0])) as Record<AnomalyKind, number>;
  return {
    table_present:                  true,
    rows_in_table:                  0,
    rows_inspected:                 0,
    anomaly_counts:                 emptyCounts,
    anomaly_sample_ids:             emptyIds,
    forbidden_column_names_present: [],
    poi_type_distribution_rows:                 [],
    poi_surface_class_distribution_rows:        [],
    source_table_distribution_rows:             [],
    poi_key_source_field_distribution_rows:     [],
    stage0_excluded_distribution_rows:          [],
    poi_eligible_distribution_rows:             [],
    extraction_version_distribution_rows:       [],
    poi_input_version_distribution_rows:        [],
    poi_observation_version_distribution_rows:  [],
    unique_session_ids_seen:                    0,
    unique_workspace_site_pairs_seen:           0,
    sample_session_ids_raw:                     [],
    run_metadata:                               baselineRunMetadata(),
    ...over,
  };
}

/**
 * Helper — set BOTH `anomaly_counts[kind]` and a matching IDs array
 * `anomaly_sample_ids[kind]` in one shot. Useful for tests that
 * simulate "all rows are surfaced as samples" (count = ids.length).
 */
function inputsWithAnomaly(
  kind:  AnomalyKind,
  count: number,
  sample_ids: readonly number[],
  over:  Partial<AggregateInputs> = {},
): AggregateInputs {
  const base = emptyAggregateInputs(over);
  const counts = { ...base.anomaly_counts } as Record<AnomalyKind, number>;
  const ids    = { ...base.anomaly_sample_ids } as Record<AnomalyKind, readonly number[]>;
  counts[kind] = count;
  ids[kind]    = Object.freeze([...sample_ids]);
  return { ...base, anomaly_counts: counts, anomaly_sample_ids: ids };
}

describe('B. aggregator — counters + rollup', () => {
  it('empty inputs → report with zero anomalies + total_anomalies=0', () => {
    const r = aggregateReport(emptyAggregateInputs());
    expect(r.duplicate_natural_key_count).toBe(0);
    expect(r.poi_eligible_mismatch_count).toBe(0);
    expect(r.evidence_refs_invalid_count).toBe(0);
    expect(r.source_versions_invalid_count).toBe(0);
    expect(r.v0_1_enum_violation_count).toBe(0);
    expect(r.negative_source_event_count_count).toBe(0);
    expect(r.timestamp_ordering_violation_count).toBe(0);
    expect(r.poi_key_unsafe_count).toBe(0);
    expect(r.evidence_refs_forbidden_key_count).toBe(0);
    expect(r.forbidden_column_present_count).toBe(0);
    expect(r.total_anomalies).toBe(0);
  });

  it('per-kind counts feed the correct counter + total rolls up', () => {
    const inputs = emptyAggregateInputs({
      anomaly_counts: {
        duplicate_natural_key:           2,
        poi_eligible_mismatch:           1,
        evidence_refs_invalid:           0,
        source_versions_invalid:         1,
        v0_1_enum_violation:             3,
        negative_source_event_count:     0,
        timestamp_ordering_violation:    0,
        poi_key_unsafe:                  1,
        evidence_refs_forbidden_key:     1,
      },
      anomaly_sample_ids: {
        duplicate_natural_key:           [1, 2],
        poi_eligible_mismatch:           [3],
        evidence_refs_invalid:           [],
        source_versions_invalid:         [4],
        v0_1_enum_violation:             [5, 6, 7],
        negative_source_event_count:     [],
        timestamp_ordering_violation:    [],
        poi_key_unsafe:                  [8],
        evidence_refs_forbidden_key:     [9],
      },
      forbidden_column_names_present: ['email', 'user_agent'],
    });
    const r = aggregateReport(inputs);
    expect(r.duplicate_natural_key_count).toBe(2);
    expect(r.poi_eligible_mismatch_count).toBe(1);
    expect(r.source_versions_invalid_count).toBe(1);
    expect(r.v0_1_enum_violation_count).toBe(3);
    expect(r.poi_key_unsafe_count).toBe(1);
    expect(r.evidence_refs_forbidden_key_count).toBe(1);
    expect(r.forbidden_column_present_count).toBe(2);
    expect(r.total_anomalies).toBe(2 + 1 + 0 + 1 + 3 + 0 + 0 + 1 + 1 + 2);
  });

  it('forbidden_column_names_present surfaces verbatim (schema metadata, not row data)', () => {
    const r = aggregateReport(emptyAggregateInputs({
      forbidden_column_names_present: ['email', 'user_agent', 'risk_index'],
    }));
    expect(r.forbidden_column_names_present).toEqual(['email', 'user_agent', 'risk_index']);
  });
});

/* --------------------------------------------------------------------------
 * C. Anomaly counters are AUTHORITATIVE — independent of sample IDs
 *
 * Per Codex blocker (PR#11d v0.2): the previous design derived
 * counters from sample-array length, which made counters a lower
 * bound when LIMIT capped. The new design uses two queries per
 * anomaly — an exact COUNT(*) and a separate sample query. Counters
 * remain authoritative even when:
 *   - samples are suppressed (anomaly_sample_limit=0)
 *   - the sample cap is below the true count
 *   - the count exceeds the sample-id array length
 * ------------------------------------------------------------------------ */

describe('C. anomaly counters are authoritative', () => {
  it('counter > sample IDs length — counter reflects the full count', () => {
    // 100 anomalies in reality, but only 5 sample IDs surfaced.
    const inputs = inputsWithAnomaly('duplicate_natural_key', 100, [1, 2, 3, 4, 5]);
    const r = aggregateReport(inputs);
    expect(r.duplicate_natural_key_count).toBe(100);
    expect(r.anomaly_samples.duplicate_natural_key).toEqual([1, 2, 3, 4, 5]);
    expect(r.total_anomalies).toBe(100);
  });

  it('counter remains full when anomaly_sample_limit=0 (samples suppressed)', () => {
    // Simulates runner with anomaly_sample_limit=0: count is N, sample IDs are empty.
    const inputs = inputsWithAnomaly('poi_eligible_mismatch', 42, []);
    const r = aggregateReport(inputs);
    expect(r.poi_eligible_mismatch_count).toBe(42);
    expect(r.anomaly_samples.poi_eligible_mismatch).toEqual([]);
    expect(r.total_anomalies).toBe(42);
  });

  it('counter = 0 + samples empty → counter is 0 (does NOT default to samples.length)', () => {
    const inputs = inputsWithAnomaly('evidence_refs_invalid', 0, []);
    const r = aggregateReport(inputs);
    expect(r.evidence_refs_invalid_count).toBe(0);
    expect(r.anomaly_samples.evidence_refs_invalid).toEqual([]);
  });

  it('multiple anomaly kinds with different count-vs-sample shapes', () => {
    const inputs = emptyAggregateInputs({
      anomaly_counts: {
        duplicate_natural_key:           1000,    // huge count
        poi_eligible_mismatch:           3,
        evidence_refs_invalid:           0,
        source_versions_invalid:         50,
        v0_1_enum_violation:             0,
        negative_source_event_count:     0,
        timestamp_ordering_violation:    0,
        poi_key_unsafe:                  0,
        evidence_refs_forbidden_key:     0,
      },
      anomaly_sample_ids: {
        duplicate_natural_key:           [1, 2, 3, 4, 5],  // capped
        poi_eligible_mismatch:           [10, 11, 12],
        evidence_refs_invalid:           [],
        source_versions_invalid:         [],                // suppressed
        v0_1_enum_violation:             [],
        negative_source_event_count:     [],
        timestamp_ordering_violation:    [],
        poi_key_unsafe:                  [],
        evidence_refs_forbidden_key:     [],
      },
    });
    const r = aggregateReport(inputs);
    expect(r.duplicate_natural_key_count).toBe(1000);
    expect(r.poi_eligible_mismatch_count).toBe(3);
    expect(r.source_versions_invalid_count).toBe(50);
    expect(r.anomaly_samples.duplicate_natural_key).toHaveLength(5);
    expect(r.anomaly_samples.poi_eligible_mismatch).toHaveLength(3);
    expect(r.anomaly_samples.source_versions_invalid).toEqual([]);
    expect(r.total_anomalies).toBe(1000 + 3 + 50);
  });

  it('samples include only numeric poi_observation_id values', () => {
    const inputs = inputsWithAnomaly('duplicate_natural_key', 3, [42, 43, 44]);
    const r = aggregateReport(inputs);
    for (const id of r.anomaly_samples.duplicate_natural_key) {
      expect(typeof id).toBe('number');
      expect(Number.isInteger(id)).toBe(true);
    }
  });

  it('serialised report does NOT contain full session_ids, poi_keys, or evidence_refs in anomaly samples', () => {
    const inputs = inputsWithAnomaly('duplicate_natural_key', 5, [1, 2, 3, 4, 5], {
      sample_session_ids_raw: ['sess_aaaaaaaa1111bbbbbbbb2222'],
    });
    const r = aggregateReport(inputs);
    const json = serialiseReport(r);
    expect(json).not.toContain('sess_aaaaaaaa1111bbbbbbbb2222');
    expect(json).toContain('sess_aaa…2222');
    // The anomaly-samples block is integer-only — structural check.
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const samples = parsed['anomaly_samples'] as Record<string, unknown>;
    expect(samples).toBeTruthy();
    expect(typeof samples).toBe('object');
    for (const [kind, value] of Object.entries(samples)) {
      expect(Array.isArray(value), `anomaly_samples.${kind} must be an array`).toBe(true);
      const arr = value as unknown[];
      for (const item of arr) {
        expect(typeof item, `anomaly_samples.${kind}[*] must be a number, never a string`).toBe('number');
        expect(Number.isInteger(item)).toBe(true);
      }
    }
  });

  it('JSON-key sweep — report has no forbidden field-name keys', () => {
    const r = aggregateReport(emptyAggregateInputs());
    const json = serialiseReport(r);
    const forbiddenKeys = [
      'raw_payload', 'canonical_jsonb', 'user_agent', 'ip_hash', 'token_hash',
      'authorization', 'bearer', 'cookie', 'pepper',
      'person_id', 'visitor_id', 'company_id', 'email', 'phone',
      'page_url', 'full_url', 'url_query',
    ];
    for (const k of forbiddenKeys) {
      const keyPattern = new RegExp(`"${k}"\\s*:`);
      expect(json, `report must not contain JSON key "${k}":`).not.toMatch(keyPattern);
    }
  });
});

/* --------------------------------------------------------------------------
 * D. Distribution folding
 * ------------------------------------------------------------------------ */

describe('D. distribution folding', () => {
  it('text distribution folds bucket+count rows into a record', () => {
    const r = aggregateReport(emptyAggregateInputs({
      poi_type_distribution_rows: [
        { bucket: 'page_path',   count: '5' },
        { bucket: 'referrer_class', count: 1 },  // not in v0.1 but illustrates init+update
      ],
    }));
    expect(r.poi_type_distribution.page_path).toBe(5);
    expect(r.poi_type_distribution.referrer_class).toBe(1);
    expect(r.poi_type_distribution.route).toBe(0);
  });

  it('boolean distribution folds true/false rows', () => {
    const r = aggregateReport(emptyAggregateInputs({
      stage0_excluded_distribution_rows: [
        { bucket: true,  count: '6' },
        { bucket: false, count: '2' },
      ],
    }));
    expect(r.stage0_excluded_distribution.true_count).toBe(6);
    expect(r.stage0_excluded_distribution.false_count).toBe(2);
  });

  it('poi_surface_class buckets initialise to 0 even when no rows present', () => {
    const r = aggregateReport(emptyAggregateInputs());
    expect(Object.keys(r.poi_surface_class_distribution).sort()).toEqual([...POI_SURFACE_CLASSES_ALLOWED].sort());
    for (const c of POI_SURFACE_CLASSES_ALLOWED) {
      expect(r.poi_surface_class_distribution[c]).toBe(0);
    }
  });

  it('poi_key_source_field — non-empty rows fold into the record', () => {
    const r = aggregateReport(emptyAggregateInputs({
      poi_key_source_field_distribution_rows: [
        { bucket: 'landing_page_path', count: '6' },
        { bucket: 'last_page_path',    count: 2 },
      ],
    }));
    expect(r.poi_key_source_field_distribution.landing_page_path).toBe(6);
    expect(r.poi_key_source_field_distribution.last_page_path).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * E. Run metadata + masking
 * ------------------------------------------------------------------------ */

describe('E. run metadata', () => {
  it('source_table, target stamps, and record_only true land on metadata', () => {
    const md = baselineRunMetadata();
    expect(md.source_table).toBe('poi_observations_v0_1');
    expect(md.record_only).toBe(true);
    expect(md.poi_input_version_expected).toBe(POI_CORE_INPUT_VERSION);
    expect(md.poi_observation_version_expected).toBe(POI_OBSERVATION_VERSION_EXPECTED);
    expect(md.forbidden_columns_checked).toEqual(FORBIDDEN_COLUMNS);
  });
});

/* --------------------------------------------------------------------------
 * F. End-to-end via stub client — healthy run
 * ------------------------------------------------------------------------ */

interface StubScenario {
  readonly table_present?:                     boolean;
  readonly row_count?:                         number;
  readonly forbidden_columns_present?:         readonly string[];
  readonly anomaly_rows?:                      Partial<Record<AnomalyKind, readonly number[]>>;
  readonly poi_type_distribution_rows?:        Array<{ bucket: string; count: string | number }>;
  readonly stage0_excluded_distribution_rows?: Array<{ bucket: boolean; count: string | number }>;
  readonly poi_eligible_distribution_rows?:    Array<{ bucket: boolean; count: string | number }>;
  readonly poi_key_source_field_distribution_rows?: Array<{ bucket: string; count: string | number }>;
  readonly source_table_distribution_rows?:    Array<{ bucket: string; count: string | number }>;
  readonly poi_surface_class_distribution_rows?: Array<{ bucket: string; count: string | number }>;
  readonly extraction_version_distribution_rows?: Array<{ bucket: string; count: string | number }>;
  readonly poi_input_version_distribution_rows?:  Array<{ bucket: string; count: string | number }>;
  readonly poi_observation_version_distribution_rows?: Array<{ bucket: string; count: string | number }>;
  readonly unique_session_ids_seen?:           number;
  readonly unique_workspace_site_pairs_seen?:  number;
  readonly sample_session_ids?:                readonly string[];
}

function makeScenarioStub(s: StubScenario) {
  return makeStubClient(async (sql) => {
    if (sql.includes('information_schema.tables')) {
      return { rows: [{ table_present: s.table_present !== false }], rowCount: 1 };
    }
    if (sql.includes('information_schema.columns')) {
      const rows = (s.forbidden_columns_present ?? []).map((c) => ({ column_name: c }));
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('COUNT(DISTINCT session_id)')) {
      return { rows: [{ count: s.unique_session_ids_seen ?? 0 }], rowCount: 1 };
    }
    if (sql.includes('COUNT(DISTINCT (workspace_id, site_id))')) {
      return { rows: [{ count: s.unique_workspace_site_pairs_seen ?? 0 }], rowCount: 1 };
    }
    if (sql.match(/SELECT COUNT\(\*\)::bigint AS row_count\s+FROM poi_observations_v0_1/)) {
      return { rows: [{ row_count: s.row_count ?? 0 }], rowCount: 1 };
    }
    if (sql.includes('SELECT session_id') && sql.includes('LIMIT $5')) {
      const rows = (s.sample_session_ids ?? []).map((sid) => ({ session_id: sid }));
      return { rows, rowCount: rows.length };
    }
    // Anomaly queries — two queries per AnomalyKind under the new
    // design: a COUNT(*) query (no LIMIT) and a separate sample
    // query (capped at $5 anomaly_sample_limit). Dispatch by query
    // shape — COUNT vs SAMPLE — using the SELECT clause.
    const isCountQuery  = sql.match(/SELECT COUNT\(\*\)::bigint AS count\s+FROM poi_observations_v0_1/);
    const isSampleQuery = sql.match(/SELECT poi_observation_id\s+FROM poi_observations_v0_1/);

    function answer(kind: AnomalyKind) {
      const ids = s.anomaly_rows?.[kind] ?? [];
      if (isCountQuery) {
        return { rows: [{ count: String(ids.length) }], rowCount: 1 };
      }
      if (isSampleQuery) {
        return idsRows(ids);
      }
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('AND (workspace_id, site_id, session_id, poi_type, poi_key')) {
      return answer('duplicate_natural_key');
    }
    if (sql.includes('poi_eligible <> (NOT stage0_excluded)')) {
      return answer('poi_eligible_mismatch');
    }
    if (sql.includes("jsonb_typeof(evidence_refs) <> 'array'")) {
      return answer('evidence_refs_invalid');
    }
    if (sql.includes("jsonb_typeof(source_versions) <> 'object'")) {
      return answer('source_versions_invalid');
    }
    if (sql.includes("poi_type            <> 'page_path'")) {
      return answer('v0_1_enum_violation');
    }
    if (sql.includes('source_event_count < 0')) {
      return answer('negative_source_event_count');
    }
    if (sql.includes('first_seen_at > last_seen_at')) {
      return answer('timestamp_ordering_violation');
    }
    if (sql.includes("poi_key LIKE '%?%'")) {
      return answer('poi_key_unsafe');
    }
    if (sql.includes("evidence_refs::text ~*")) {
      return answer('evidence_refs_forbidden_key');
    }
    // Distribution queries
    if (sql.includes('GROUP BY poi_type')) {
      return rowsOf(s.poi_type_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY poi_surface_class')) {
      return rowsOf(s.poi_surface_class_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY source_table')) {
      return rowsOf(s.source_table_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY poi_key_source_field')) {
      return rowsOf(s.poi_key_source_field_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY stage0_excluded')) {
      return rowsOf(s.stage0_excluded_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY poi_eligible')) {
      return rowsOf(s.poi_eligible_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY extraction_version')) {
      return rowsOf(s.extraction_version_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY poi_input_version')) {
      return rowsOf(s.poi_input_version_distribution_rows ?? []);
    }
    if (sql.includes('GROUP BY poi_observation_version')) {
      return rowsOf(s.poi_observation_version_distribution_rows ?? []);
    }
    return { rows: [], rowCount: 0 };
  });
}

function idsRows(ids: readonly number[] | undefined) {
  const arr = (ids ?? []).map((id) => ({ poi_observation_id: String(id) }));
  return { rows: arr, rowCount: arr.length };
}

function rowsOf<T>(arr: readonly T[]) {
  return { rows: arr, rowCount: arr.length };
}

function defaultRunOptions(): TableObserverRunOptions {
  return {
    workspace_id:                     'ws_demo',
    site_id:                          'site_demo',
    window_start:                     new Date(ISO_BEFORE),
    window_end:                       new Date(ISO_NOW),
    limit:                            100,
    sample_limit:                     5,
    anomaly_sample_limit:             5,
    poi_input_version_expected:       POI_CORE_INPUT_VERSION,
    poi_observation_version_expected: POI_OBSERVATION_VERSION_EXPECTED,
  };
}

describe('F. runPoiTableObserver end-to-end via stub client — healthy run', () => {
  it('healthy table → all counters zero, distributions populate, sample masked', async () => {
    const client = makeScenarioStub({
      table_present:             true,
      row_count:                 8,
      forbidden_columns_present: [],
      anomaly_rows:              {},
      poi_type_distribution_rows: [{ bucket: 'page_path', count: '8' }],
      stage0_excluded_distribution_rows: [
        { bucket: true,  count: '6' },
        { bucket: false, count: '2' },
      ],
      poi_eligible_distribution_rows: [
        { bucket: true,  count: '2' },
        { bucket: false, count: '6' },
      ],
      poi_key_source_field_distribution_rows: [{ bucket: 'landing_page_path', count: '8' }],
      source_table_distribution_rows:         [{ bucket: 'session_features',  count: '8' }],
      extraction_version_distribution_rows:   [{ bucket: 'session-features-v0.1', count: '8' }],
      poi_input_version_distribution_rows:    [{ bucket: POI_CORE_INPUT_VERSION, count: '8' }],
      poi_observation_version_distribution_rows: [{ bucket: POI_OBSERVATION_VERSION_EXPECTED, count: '8' }],
      unique_session_ids_seen:                8,
      unique_workspace_site_pairs_seen:       1,
      sample_session_ids:                     ['sess_aaaaaaaa1111bbbbbbbb2222', 'sess_bbbbbbbb2222cccccccc3333'],
    });

    const report = await runPoiTableObserver({
      client: client as unknown as Parameters<typeof runPoiTableObserver>[0]['client'],
      options: defaultRunOptions(),
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });

    expect(report.table_present).toBe(true);
    expect(report.rows_in_table).toBe(8);
    expect(report.total_anomalies).toBe(0);
    expect(report.poi_type_distribution.page_path).toBe(8);
    expect(report.stage0_excluded_distribution).toEqual({ true_count: 6, false_count: 2 });
    expect(report.poi_eligible_distribution).toEqual({ true_count: 2, false_count: 6 });
    expect(report.poi_key_source_field_distribution.landing_page_path).toBe(8);
    expect(report.source_table_distribution.session_features).toBe(8);
    expect(report.unique_session_ids_seen).toBe(8);
    expect(report.unique_workspace_site_pairs_seen).toBe(1);
    expect(report.sample_session_id_prefixes).toEqual(['sess_aaa…2222', 'sess_bbb…3333']);
    expect(report.forbidden_column_present_count).toBe(0);
    expect(report.run_metadata.source_table).toBe('poi_observations_v0_1');
    expect(report.run_metadata.record_only).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * G. Table absent → early empty report
 * ------------------------------------------------------------------------ */

describe('G. table absent', () => {
  it('table_present=false → empty report, no further queries executed', async () => {
    let extraQueries = 0;
    const client = makeStubClient(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_present: false }], rowCount: 1 };
      }
      extraQueries += 1;
      return { rows: [], rowCount: 0 };
    });
    const report = await runPoiTableObserver({
      client: client as unknown as Parameters<typeof runPoiTableObserver>[0]['client'],
      options: defaultRunOptions(),
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });
    expect(report.table_present).toBe(false);
    expect(report.rows_in_table).toBe(0);
    expect(report.total_anomalies).toBe(0);
    expect(extraQueries).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * H. Anomalies surface in counters + samples
 * ------------------------------------------------------------------------ */

describe('H. anomalies surface in counters + samples', () => {
  it('duplicate natural-key + poi_key_unsafe rows propagate to report', async () => {
    const client = makeScenarioStub({
      table_present: true,
      row_count: 5,
      anomaly_rows: {
        duplicate_natural_key: [1001, 1002],
        poi_key_unsafe:        [1003],
      },
    });
    const report = await runPoiTableObserver({
      client: client as unknown as Parameters<typeof runPoiTableObserver>[0]['client'],
      options: defaultRunOptions(),
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });
    expect(report.duplicate_natural_key_count).toBe(2);
    expect(report.poi_key_unsafe_count).toBe(1);
    expect(report.total_anomalies).toBe(3);
    expect(report.anomaly_samples.duplicate_natural_key).toEqual([1001, 1002]);
    expect(report.anomaly_samples.poi_key_unsafe).toEqual([1003]);
  });

  it('anomaly_sample_limit=0 propagates from options → all samples empty', async () => {
    const client = makeScenarioStub({
      table_present: true,
      anomaly_rows: { duplicate_natural_key: [11, 12, 13] },
    });
    const report = await runPoiTableObserver({
      client: client as unknown as Parameters<typeof runPoiTableObserver>[0]['client'],
      options: { ...defaultRunOptions(), anomaly_sample_limit: 0 },
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });
    expect(report.duplicate_natural_key_count).toBe(3);
    for (const k of ANOMALY_KINDS) {
      expect(report.anomaly_samples[k]).toEqual([]);
    }
  });
});

/* --------------------------------------------------------------------------
 * I. Forbidden-column sweep
 * ------------------------------------------------------------------------ */

describe('I. forbidden-column sweep', () => {
  it('column names returned by the sweep land on forbidden_column_names_present', async () => {
    const client = makeScenarioStub({
      table_present: true,
      forbidden_columns_present: ['user_agent', 'email'],
    });
    const report = await runPoiTableObserver({
      client: client as unknown as Parameters<typeof runPoiTableObserver>[0]['client'],
      options: defaultRunOptions(),
      database_host: 'localhost:5432',
      database_name: 'buyerrecon_test',
    });
    expect(report.forbidden_column_present_count).toBe(2);
    expect(report.forbidden_column_names_present).toEqual(['user_agent', 'email']);
  });

  it('FORBIDDEN_COLUMNS list contains all PR#11c §4.2 exclusions including behavioural_feature_version', () => {
    expect(FORBIDDEN_COLUMNS).toContain('risk_index');
    expect(FORBIDDEN_COLUMNS).toContain('lane_a');
    expect(FORBIDDEN_COLUMNS).toContain('lane_b');
    expect(FORBIDDEN_COLUMNS).toContain('user_agent');
    expect(FORBIDDEN_COLUMNS).toContain('email');
    expect(FORBIDDEN_COLUMNS).toContain('person_id');
    expect(FORBIDDEN_COLUMNS).toContain('behavioural_feature_version');
  });
});

/* --------------------------------------------------------------------------
 * J. Static-source sweep — read scope + DML/DDL discipline + import discipline
 * ------------------------------------------------------------------------ */

const PR11D_SOURCE_FILES = [
  'src/scoring/poi-table-observer/types.ts',
  'src/scoring/poi-table-observer/query.ts',
  'src/scoring/poi-table-observer/report.ts',
  'src/scoring/poi-table-observer/runner.ts',
  'src/scoring/poi-table-observer/index.ts',
  'scripts/poi-table-observation-report.ts',
];

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('J. static-source boundary sweep — PR#11d', () => {
  it('no DML / DDL / GRANT / REVOKE / TRUNCATE in active TS source', () => {
    for (const f of PR11D_SOURCE_FILES) {
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

  it('no SQL FROM/JOIN against forbidden tables (case-sensitive uppercase SQL convention)', () => {
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
    const runtimeFiles = [
      'src/scoring/poi-table-observer/query.ts',
      'src/scoring/poi-table-observer/runner.ts',
      'src/scoring/poi-table-observer/report.ts',
      'scripts/poi-table-observation-report.ts',
    ];
    for (const f of runtimeFiles) {
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

  it('no imports from PR#11b observer, PR#11c worker non-types, policy/trust/series/lane/collector/app/server/auth', () => {
    for (const f of PR11D_SOURCE_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/policy/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/trust/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/series/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/lane/);
      // No import from PR#11b observer (Codex blocker: PR#11d
      // must not depend on observer runtime internals).
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-core-observer/);
      // No import from PR#11c worker (Codex blocker: PR#11d
      // must not depend on worker runtime internals; observation
      // version constant is duplicated locally as
      // POI_OBSERVATION_VERSION_EXPECTED).
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/scoring\/poi-core-worker/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/app/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/server/);
      expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth/);
    }
  });
});

/* --------------------------------------------------------------------------
 * K. SQL constants — every query targets only allowed tables
 * ------------------------------------------------------------------------ */

describe('K. SQL constants — allowlist', () => {
  const allSql = [
    SELECT_TABLE_PRESENT_SQL,
    SELECT_ROW_COUNT_SQL,
    SELECT_FORBIDDEN_COLUMNS_SQL,
    // Anomaly COUNT(*) queries (authoritative)
    SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL,
    SELECT_POI_ELIGIBLE_MISMATCH_COUNT_SQL,
    SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL,
    SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL,
    SELECT_V0_1_ENUM_VIOLATION_COUNT_SQL,
    SELECT_NEGATIVE_SOURCE_EVENT_COUNT_COUNT_SQL,
    SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL,
    SELECT_POI_KEY_UNSAFE_COUNT_SQL,
    SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_COUNT_SQL,
    // Anomaly SAMPLE queries (capped)
    SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL,
    SELECT_POI_ELIGIBLE_MISMATCH_SAMPLE_SQL,
    SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL,
    SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL,
    SELECT_V0_1_ENUM_VIOLATION_SAMPLE_SQL,
    SELECT_NEGATIVE_SOURCE_EVENT_COUNT_SAMPLE_SQL,
    SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL,
    SELECT_POI_KEY_UNSAFE_SAMPLE_SQL,
    SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_SAMPLE_SQL,
    // Distributions
    SELECT_POI_TYPE_DISTRIBUTION_SQL,
    SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL,
    SELECT_POI_ELIGIBLE_DISTRIBUTION_SQL,
    SELECT_POI_KEY_SOURCE_FIELD_DISTRIBUTION_SQL,
    SELECT_SOURCE_TABLE_DISTRIBUTION_SQL,
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

  it('every SQL constant is read-only (no DML/DDL)', () => {
    for (const sql of allSql) {
      expect(sql).not.toMatch(/\bINSERT\b/i);
      expect(sql).not.toMatch(/\bUPDATE\b\s+[a-z_]/i);
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
    expect(SELECT_TABLE_PRESENT_SQL).not.toMatch(/FROM information_schema\.columns/);
    expect(SELECT_TABLE_PRESENT_SQL).not.toMatch(/FROM poi_observations_v0_1/);
  });

  it('SELECT_FORBIDDEN_COLUMNS_SQL reads information_schema.columns only', () => {
    expect(SELECT_FORBIDDEN_COLUMNS_SQL).toMatch(/FROM information_schema\.columns/);
    expect(SELECT_FORBIDDEN_COLUMNS_SQL).not.toMatch(/FROM poi_observations_v0_1/);
  });
});

/* --------------------------------------------------------------------------
 * Test helpers
 * ------------------------------------------------------------------------ */

function baselineRunMetadata(): TableObserverRunMetadata {
  return {
    source_table:                     'poi_observations_v0_1',
    workspace_id_filter:              'ws_demo',
    site_id_filter:                   'site_demo',
    window_start:                     ISO_BEFORE,
    window_end:                       ISO_NOW,
    row_limit:                        100,
    sample_limit:                     5,
    anomaly_sample_limit:             5,
    database_host:                    'localhost:5432',
    database_name:                    'buyerrecon_test',
    run_started_at:                   ISO_NOW,
    run_ended_at:                     ISO_NOW,
    poi_input_version_expected:       POI_CORE_INPUT_VERSION,
    poi_observation_version_expected: POI_OBSERVATION_VERSION_EXPECTED,
    forbidden_columns_checked:        FORBIDDEN_COLUMNS,
    record_only:                      true,
  };
}

// Reference POI_SURFACE_CLASS to keep the import resolved (used as
// type-narrowing target in similar test files).
void POI_SURFACE_CLASS;
