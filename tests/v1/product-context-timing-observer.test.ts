/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — tests.
 *
 * Pure tests. No real pg. Stub client exercises every boundary +
 * mapper + report path.
 *
 * Test groups (mapping to spec's 12 testing requirements):
 *   A. (5) Excluded surfaces counted, not deleted
 *   B. (4) Unknown / unmapped surfaces counted, not fatal
 *   C. (6) Timing / actionability band determinism
 *   D. (8) Sample output truncates session IDs
 *   E. (7) Version fields always present
 *   F. (10) Read-only proof block + no customer-output claim
 *   G. (2) Missing source tables / columns fail closed
 *   H. (3) SQL constants read only allowed tables; no DML / DDL
 *   I. (9) Runtime source does not define reserved AMS Product Layer names
 *   J. (11) Runtime source emits no `FIT.*` / `INTENT.*` / `WINDOW.*` reason codes
 *   K. (12) Option C boundary: no durable table, no migration / schema change, no DB writes
 *   L. Universal surface classifier — pattern coverage
 *   M. Evidence_refs OD-14 carry-through (invalid refs → reject)
 *   N. Mapping coverage % math
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ACTIONABILITY_BANDS_ALLOWED,
  buildSessionPreview,
  CATEGORY_TEMPLATES_ALLOWED,
  classifyActionabilityBand,
  classifyUniversalSurface,
  decideProductContextTimingCliExitCode,
  DEFAULT_CATEGORY_TEMPLATE,
  DEFAULT_PRIMARY_CONVERSION_GOAL,
  DEFAULT_SALES_MOTION,
  EVIDENCE_PREVIEW_REJECT_REASONS,
  EXCLUDED_SURFACES,
  groupBySession,
  isValidEvidenceRefs,
  makeStubClient,
  OBSERVER_VERSION,
  parseDatabaseUrl,
  PRIMARY_CONVERSION_GOALS_ALLOWED,
  REQUIRED_POI_COLUMNS,
  REQUIRED_POI_SEQUENCE_COLUMNS,
  renderMarkdown,
  runProductContextTimingObserver,
  SALES_MOTIONS_ALLOWED,
  SELECT_POI_ROWS_SQL,
  SELECT_POI_SEQUENCE_ROWS_SQL,
  SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL,
  SELECT_POI_TABLE_PRESENT_SQL,
  SELECT_TABLE_COLUMNS_SQL,
  truncateSessionId,
  type ObserverReport,
  type ObserverRunOptions,
  type PoiRowRaw,
  type PoiSequenceRowRaw,
} from '../../src/scoring/product-context-timing-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const T_BASE_MS = Date.parse('2026-05-14T10:00:00.000Z');
const ISO_T0    = '2026-05-14T10:00:00.000Z';
const ISO_T1    = '2026-05-14T10:30:00.000Z';

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function mkOpts(over: Partial<ObserverRunOptions> = {}): ObserverRunOptions {
  return {
    workspace_id:               'ws_demo',
    site_id:                    'site_demo',
    window_start:               new Date('2026-05-13T10:00:00.000Z'),
    window_end:                 new Date('2026-05-14T18:00:00.000Z'),
    limit:                      1000,
    sample_limit:               3,
    category_template:          DEFAULT_CATEGORY_TEMPLATE,
    primary_conversion_goal:    DEFAULT_PRIMARY_CONVERSION_GOAL,
    sales_motion:               DEFAULT_SALES_MOTION,
    evaluation_at:              new Date('2026-05-14T12:00:00.000Z'),
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
    first_seen_at:            ISO_T0,
    last_seen_at:             ISO_T0,
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
    first_seen_at:                ISO_T0,
    last_seen_at:                 ISO_T0,
    duration_seconds:             0,
    stage0_excluded:              false,
    poi_sequence_eligible:        true,
    evidence_refs:                [{ table: 'poi_observations_v0_1', poi_observation_id: 1 }],
    ...over,
  };
}

/* --------------------------------------------------------------------------
 * A. Excluded surfaces counted, not deleted (test req 5)
 * ------------------------------------------------------------------------ */

describe('A. excluded surfaces counted, not deleted', () => {
  it('excluded_surface_count increments when poi_key matches an excluded pattern', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/privacy-policy' })],
      [mkPoiSeqRow()],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.excluded_surface_count).toBe(1);
    // underlying surface_distribution still records the surface — not deleted
    expect(p.surface_distribution['legal_privacy']).toBe(1);
  });

  it('session with all excluded surfaces → rejected reason `excluded_surface_only`', () => {
    const groups = groupBySession(
      [
        mkPoiRow({ poi_observation_id: 1, poi_key: '/privacy' }),
        mkPoiRow({ poi_observation_id: 2, poi_key: '/terms' }),
      ],
      [mkPoiSeqRow({ poi_count: 2, unique_poi_count: 2 })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(false);
    expect(p.reject_reason).toBe('excluded_surface_only');
    // surface_distribution still carries the labels (counted, not deleted)
    expect(p.surface_distribution['legal_privacy']).toBe(1);
    expect(p.surface_distribution['legal_terms']).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * B. Unknown surfaces counted, not fatal (test req 4)
 * ------------------------------------------------------------------------ */

describe('B. unknown surfaces counted, not fatal', () => {
  it('unmapped path → unknown surface label, counted in unknown_surface_count', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/some/random/internal-path-12345' })],
      [mkPoiSeqRow()],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.unknown_surface_count).toBe(1);
    expect(p.surface_distribution['unknown']).toBe(1);
  });

  it('all-unknown session → rejected `mapping_unknown_surface`, but no throw', () => {
    const groups = groupBySession(
      [
        mkPoiRow({ poi_observation_id: 1, poi_key: '/abc/foo' }),
        mkPoiRow({ poi_observation_id: 2, poi_key: '/xyz/bar' }),
      ],
      [mkPoiSeqRow({ poi_count: 2, unique_poi_count: 2 })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.reject_reason).toBe('mapping_unknown_surface');
    expect(p.accepted_into_preview).toBe(false);
  });

  it('mixed mapped + unknown session is accepted; unknown is just counted', () => {
    const groups = groupBySession(
      [
        mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' }),
        mkPoiRow({ poi_observation_id: 2, poi_key: '/some/unmapped/path' }),
      ],
      [mkPoiSeqRow({ poi_count: 2, unique_poi_count: 2 })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(true);
    expect(p.unknown_surface_count).toBe(1);
    expect(p.surface_distribution['pricing']).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * C. Timing / actionability band determinism (test req 6)
 * ------------------------------------------------------------------------ */

describe('C. actionability band determinism', () => {
  it('classifies hot_now within threshold', () => {
    // sales_led t_hot = 12h → 6h ago is hot_now
    expect(classifyActionabilityBand(T_BASE_MS - 6 * 3600 * 1000, T_BASE_MS, 'sales_led', 1, 1)).toBe('hot_now');
  });

  it('classifies warm_recent between t_hot and t_warm', () => {
    // sales_led: t_hot=12h, t_warm=168h → 24h is warm_recent
    expect(classifyActionabilityBand(T_BASE_MS - 24 * 3600 * 1000, T_BASE_MS, 'sales_led', 1, 1)).toBe('warm_recent');
  });

  it('classifies cooling between t_warm and t_stale', () => {
    // sales_led: t_warm=168h, t_stale=720h → 240h is cooling
    expect(classifyActionabilityBand(T_BASE_MS - 240 * 3600 * 1000, T_BASE_MS, 'sales_led', 1, 1)).toBe('cooling');
  });

  it('classifies stale between t_stale and t_dormant', () => {
    // sales_led: t_stale=720h, t_dormant=2160h → 1000h is stale
    expect(classifyActionabilityBand(T_BASE_MS - 1000 * 3600 * 1000, T_BASE_MS, 'sales_led', 1, 1)).toBe('stale');
  });

  it('classifies dormant beyond t_dormant', () => {
    // sales_led: t_dormant=2160h → 3000h is dormant
    expect(classifyActionabilityBand(T_BASE_MS - 3000 * 3600 * 1000, T_BASE_MS, 'sales_led', 1, 1)).toBe('dormant');
  });

  it('classifies insufficient_evidence when no last activity / no POI', () => {
    expect(classifyActionabilityBand(null, T_BASE_MS, 'sales_led', 1, 1)).toBe('insufficient_evidence');
    expect(classifyActionabilityBand(T_BASE_MS, T_BASE_MS, 'sales_led', 0, 0)).toBe('insufficient_evidence');
  });

  it('deterministic: same input produces same band across calls', () => {
    const a = classifyActionabilityBand(T_BASE_MS - 5 * 3600 * 1000, T_BASE_MS, 'sales_led', 2, 2);
    const b = classifyActionabilityBand(T_BASE_MS - 5 * 3600 * 1000, T_BASE_MS, 'sales_led', 2, 2);
    expect(a).toBe(b);
  });

  it('different sales motions produce different bands at same hoursSinceLast', () => {
    const elapsed = T_BASE_MS - 6 * 3600 * 1000; // 6 hours ago
    const selfServeBand   = classifyActionabilityBand(elapsed, T_BASE_MS, 'self_serve',               1, 1);  // t_hot=4 → warm
    const salesLedBand    = classifyActionabilityBand(elapsed, T_BASE_MS, 'sales_led',                1, 1);  // t_hot=12 → hot
    expect(selfServeBand).toBe('warm_recent');
    expect(salesLedBand).toBe('hot_now');
  });
});

/* --------------------------------------------------------------------------
 * D. Sample output truncates session IDs (test req 8)
 * ------------------------------------------------------------------------ */

describe('D. sample output truncates session IDs', () => {
  it('truncateSessionId masks long ids to prefix...suffix', () => {
    expect(truncateSessionId('sess_aaaaaaaa1111bbbbbbbb2222')).toBe('sess_aaa…2222');
  });

  it('truncateSessionId returns *** for short ids', () => {
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });

  it('runner samples carry only truncated session prefixes; never full session_id', async () => {
    const FULL = 'sess_FULL_REVEAL_TOKEN_SHOULD_NOT_LEAK_xxxx';
    const stub = makeHealthyStub({
      poiRows: [mkPoiRow({ poi_observation_id: 1, session_id: FULL, poi_key: '/pricing', last_seen_at: new Date(T_BASE_MS - 3600 * 1000).toISOString() })],
      poiSeqRows: [mkPoiSeqRow({ session_id: FULL, last_seen_at: new Date(T_BASE_MS - 3600 * 1000).toISOString() })],
    });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts({ evaluation_at: new Date(T_BASE_MS), sample_limit: 5 }),
      database_host: 'h', database_name: 'd',
    });
    const md = renderMarkdown(r);
    expect(md).not.toContain('FULL_REVEAL_TOKEN');
    expect(JSON.stringify(r.ams_aligned_json_preview)).not.toContain('FULL_REVEAL_TOKEN');
  });
});

/* --------------------------------------------------------------------------
 * E. Version fields always present (test req 7)
 * ------------------------------------------------------------------------ */

describe('E. version fields always present', () => {
  it('run_metadata carries every required version stamp', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const rm = r.run_metadata;
    expect(rm.observer_version).toBe(OBSERVER_VERSION);
    expect(rm.product_context_profile_version).toBe('pcp-v0.1');
    expect(rm.universal_surface_taxonomy_version).toBe('ust-v0.1');
    expect(rm.category_template_version).toBe('generic_b2b-v0.1');
    expect(rm.buying_role_lens_version).toBe('brl-v0.1-deferred');
    expect(rm.site_mapping_version).toBe('site_map-v0.1-baseline');
    expect(rm.excluded_mapping_version).toBe('excl_map-v0.1-baseline');
    expect(rm.timing_window_model_version).toBe('tw-v0.1');
    expect(rm.freshness_decay_model_version).toBe('fd-v0.1');
    expect(rm.record_only).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * F. Read-only proof block + no customer-output claim (test req 10)
 * ------------------------------------------------------------------------ */

describe('F. read-only proof block', () => {
  it('read_only_proof block asserts all 8 read-only invariants', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const rp = r.read_only_proof;
    expect(rp.no_db_writes_performed).toBe(true);
    expect(rp.no_lane_a_b_writes).toBe(true);
    expect(rp.no_trust_writes).toBe(true);
    expect(rp.no_policy_writes).toBe(true);
    expect(rp.no_customer_output).toBe(true);
    expect(rp.no_ams_product_layer_runtime_execution).toBe(true);
    expect(rp.no_durable_pcf_table).toBe(true);
    expect(rp.no_migration_or_schema_change).toBe(true);
  });

  it('rendered markdown contains "Internal evidence preview" disclaimer + "Not customer-facing"', async () => {
    const stub = makeHealthyStub({ poiRows: [mkPoiRow()], poiSeqRows: [mkPoiSeqRow()] });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    const md = renderMarkdown(r);
    expect(md).toContain('Internal evidence preview');
    expect(md).toContain('Not customer-facing');
    expect(md).toContain('Not authoritative');
  });
});

/* --------------------------------------------------------------------------
 * G. Missing source tables / columns fail closed (test req 2)
 * ------------------------------------------------------------------------ */

describe('G. fail-closed on missing source', () => {
  it('missing poi_observations_v0_1 → fail_closed=true; no further queries issued', async () => {
    let queriedPrimary = false;
    const stub = makeStubClient(async (sql) => {
      if (sql.includes("table_name   = 'poi_observations_v0_1'") && sql.includes('information_schema.tables')) {
        return { rows: [{ present: false }], rowCount: 1 };
      }
      if (sql.includes("table_name   = 'poi_sequence_observations_v0_1'") && sql.includes('information_schema.tables')) {
        return { rows: [{ present: true }], rowCount: 1 };
      }
      if (sql.includes('FROM poi_observations_v0_1') || sql.includes('FROM poi_sequence_observations_v0_1')) {
        queriedPrimary = true;
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.source_readiness.fail_closed).toBe(true);
    expect(r.source_readiness.fail_closed_reason).toMatch(/poi_observations_v0_1 missing/);
    expect(queriedPrimary).toBe(false);
  });

  it('missing required column fails closed with named column', async () => {
    const stub = makeStubClient(async (sql, params) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ present: true }], rowCount: 1 };
      }
      if (sql === SELECT_TABLE_COLUMNS_SQL) {
        const tableName = params[0];
        if (tableName === 'poi_observations_v0_1') {
          // Drop `poi_eligible` to force a missing-column failure.
          return {
            rows: REQUIRED_POI_COLUMNS.filter((c) => c !== 'poi_eligible').map((c) => ({ column_name: c })),
            rowCount: REQUIRED_POI_COLUMNS.length - 1,
          };
        }
        if (tableName === 'poi_sequence_observations_v0_1') {
          return {
            rows: REQUIRED_POI_SEQUENCE_COLUMNS.map((c) => ({ column_name: c })),
            rowCount: REQUIRED_POI_SEQUENCE_COLUMNS.length,
          };
        }
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await runProductContextTimingObserver({
      client:        stub as unknown as never,
      options:       mkOpts(),
      database_host: 'h', database_name: 'd',
    });
    expect(r.source_readiness.fail_closed).toBe(true);
    expect(r.source_readiness.poi_missing_columns).toContain('poi_eligible');
    expect(r.source_readiness.fail_closed_reason).toMatch(/poi_eligible/);
  });
});

/* --------------------------------------------------------------------------
 * H. SQL constants — allowlist; no DML / DDL (test req 3)
 * ------------------------------------------------------------------------ */

describe('H. SQL constants — allowlist', () => {
  const allSql = [
    SELECT_POI_TABLE_PRESENT_SQL,
    SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL,
    SELECT_TABLE_COLUMNS_SQL,
    SELECT_POI_ROWS_SQL,
    SELECT_POI_SEQUENCE_ROWS_SQL,
  ];

  it('reads only allowed tables + information_schema', () => {
    const forbidden = [
      'accepted_events', 'rejected_events', 'ingest_requests',
      'session_features', 'session_behavioural_features_v0_2',
      'stage0_decisions', 'risk_observations_v0_1',
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

  it('SELECT_POI_ROWS_SQL targets poi_observations_v0_1 only', () => {
    expect(SELECT_POI_ROWS_SQL).toMatch(/FROM poi_observations_v0_1/);
    expect(SELECT_POI_ROWS_SQL).not.toMatch(/\bJOIN\b/i);
  });

  it('SELECT_POI_SEQUENCE_ROWS_SQL targets poi_sequence_observations_v0_1 only', () => {
    expect(SELECT_POI_SEQUENCE_ROWS_SQL).toMatch(/FROM poi_sequence_observations_v0_1/);
    expect(SELECT_POI_SEQUENCE_ROWS_SQL).not.toMatch(/\bJOIN\b/i);
  });
});

/* --------------------------------------------------------------------------
 * I. Runtime source does not define reserved AMS Product Layer names (test req 9)
 * J. Runtime source emits no `FIT.` / `INTENT.` / `WINDOW.` reason-code
 *    namespace strings (test req 11)
 * ------------------------------------------------------------------------ */

const PR13B_RUNTIME_FILES = [
  'src/scoring/product-context-timing-observer/types.ts',
  'src/scoring/product-context-timing-observer/query.ts',
  'src/scoring/product-context-timing-observer/mapper.ts',
  'src/scoring/product-context-timing-observer/report.ts',
  'src/scoring/product-context-timing-observer/runner.ts',
  'src/scoring/product-context-timing-observer/index.ts',
  'scripts/product-context-timing-observation-report.ts',
];

function readSource(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('I. AMS reserved-name guard — PR#13b runtime', () => {
  it('does NOT define any reserved AMS Product Layer name as a TypeScript identifier', () => {
    // These are AMS-owned. Per PR#13a §17, PR#13b runtime MUST NOT
    // mint TypeScript types/classes/interfaces/enums/exported
    // identifiers under these names.
    const reservedTypeNames = [
      'FitFeatures', 'FitResult', 'FitScore', 'FitConfidence01',
      'IntentFeatures', 'IntentResult', 'IntentScore', 'IntentState',
      'WindowFeatures', 'WindowResult', 'WindowState',
      'TRQResult', 'TRQBand', 'TRQScore', 'TRQConfidence01',
      'ProductDecision', 'ProductFeatures', 'ProductScorerInput',
      'ProductScorer', 'BuyerReconConfig', 'BuyerReconProductFeatures',
      'RequestedAction', 'NonFitMarkers', 'HardSuppress',
    ];
    for (const f of PR13B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reservedTypeNames) {
        // Must not appear as an identifier in a `type`, `interface`,
        // `class`, `enum`, `const`, `function`, or `let` definition.
        const definitionRe = new RegExp(`\\b(?:type|interface|class|enum|const|function|let|var)\\s+${name}\\b`);
        expect(src, `${f} must not define identifier "${name}"`).not.toMatch(definitionRe);
        // Must not be an exported member of an export-list, e.g.
        // `export { Fit, FitFeatures }` — defensive sweep.
        const exportRe = new RegExp(`\\bexport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
        expect(src, `${f} must not export-list "${name}"`).not.toMatch(exportRe);
      }
    }
  });
});

describe('J. no FIT.* / INTENT.* / WINDOW.* reason-code namespaces in runtime', () => {
  it('runtime emits no `FIT.*` / `INTENT.*` / `WINDOW.*` reason-code namespace strings', () => {
    // Pattern: `'FIT.' | "FIT." | `FIT.` (and same for INTENT / WINDOW)
    const re = /['"`](?:FIT|INTENT|WINDOW)\.[A-Z_]+['"`]/;
    for (const f of PR13B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not emit FIT.* / INTENT.* / WINDOW.* reason codes`).not.toMatch(re);
    }
  });
});

/* --------------------------------------------------------------------------
 * K. Option C boundary: no durable table, no migration / schema change,
 *    no DB writes (test req 12)
 * ------------------------------------------------------------------------ */

describe('K. Option C boundary', () => {
  it('no migration 016 created', () => {
    let exists = false;
    try {
      statSync(join(REPO_ROOT, 'migrations/016_product_context_fit_observations_v0_1.sql'));
      exists = true;
    } catch { /* expected */ }
    expect(exists).toBe(false);
  });

  it('schema.sql does NOT mention product_context_fit_observations_v0_1', () => {
    const schema = readSource('src/db/schema.sql');
    expect(schema).not.toMatch(/product_context_fit_observations_v0_1/);
  });

  it('runtime source has no INSERT/UPDATE/DELETE statements', () => {
    for (const f of PR13B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/);
      expect(src, `${f} UPDATE … SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
      expect(src, `${f} DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/);
    }
  });
});

/* --------------------------------------------------------------------------
 * L. Universal-surface classifier — pattern coverage
 * ------------------------------------------------------------------------ */

describe('L. universal-surface classifier', () => {
  it.each([
    ['/',                                  'homepage'],
    ['/pricing',                           'pricing'],
    ['/plans',                             'pricing'],
    ['/demo',                              'demo_request'],
    ['/request-demo',                      'demo_request'],
    ['/free-trial',                        'demo_request'],
    ['/case-studies/acme',                 'case_study'],
    ['/integrations/zapier',               'integration'],
    ['/compare/foo-vs-bar',                'comparison'],
    ['/security',                          'trust_security'],
    ['/gdpr',                              'trust_security'],
    ['/docs/intro',                        'documentation'],
    ['/contact',                           'contact'],
    ['/talk-to-sales',                     'contact'],
    ['/resources/library',                 'resource'],
    ['/careers',                           'careers'],
    ['/terms',                             'legal_terms'],
    ['/tos',                               'legal_terms'],
    ['/privacy',                           'legal_privacy'],
    ['/cookie-policy',                     'legal_privacy'],
    ['/blog/post-title',                   'blog_post'],
    ['/blog',                              'blog_post'],
    ['/developer/docs',                    'developer'],
    ['/api/v1',                            'developer'],
    ['/features/awesome',                  'feature_detail'],
    ['/product/overview',                  'product_overview'],
    ['/platform',                          'product_overview'],
    ['/some-random-internal-path',         'unknown'],
  ])('classifies %s as %s', (key, expected) => {
    expect(classifyUniversalSurface('page_path', key)).toBe(expected);
  });

  it('non-page_path poi_type → unknown', () => {
    expect(classifyUniversalSurface('cta_id', '/pricing')).toBe('unknown');
    expect(classifyUniversalSurface('referrer_class', 'organic')).toBe('unknown');
  });
});

/* --------------------------------------------------------------------------
 * M. evidence_refs OD-14 carry-through
 * ------------------------------------------------------------------------ */

describe('M. evidence_refs OD-14 carry-through', () => {
  it('invalid evidence_refs (lower-layer table) → rejected `invalid_evidence_refs`', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' })],
      [mkPoiSeqRow({
        evidence_refs: [{ table: 'session_features', source_row_id: 'sf-1' }],
      })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(false);
    expect(p.reject_reason).toBe('invalid_evidence_refs');
  });

  it('valid evidence_refs (poi_observations_v0_1 only) → accepted', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' })],
      [mkPoiSeqRow({
        evidence_refs: [{ table: 'poi_observations_v0_1', poi_observation_id: 1 }],
      })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.reject_reason).toBe(null);
    expect(p.accepted_into_preview).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * N. Mapping coverage % math + Stage 0 carry-through
 * ------------------------------------------------------------------------ */

describe('N. mapping coverage % + Stage 0 carry-through', () => {
  it('mapping_coverage_percent rounds to one decimal', () => {
    const groups = groupBySession(
      [
        mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' }),  // mapped
        mkPoiRow({ poi_observation_id: 2, poi_key: '/random' }),    // unknown
        mkPoiRow({ poi_observation_id: 3, poi_key: '/random2' }),   // unknown
      ],
      [mkPoiSeqRow({ poi_count: 3, unique_poi_count: 3 })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    // 1 mapped of 3 = 33.3%
    expect(p.mapping_coverage_percent).toBeCloseTo(33.3, 1);
  });

  it('Stage 0-excluded session is rejected and NOT in preview, but distribution is still computed', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing', stage0_excluded: true, poi_eligible: false })],
      [mkPoiSeqRow({ stage0_excluded: true, poi_sequence_eligible: false })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(false);
    expect(p.reject_reason).toBe('stage0_excluded_session');
    // surface still counted — carry-through, not deleted
    expect(p.surface_distribution['pricing']).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * O. parseDatabaseUrl masking + enum-allowlist plumbing
 * ------------------------------------------------------------------------ */

describe('O. parseDatabaseUrl + enum allowlists', () => {
  it('parseDatabaseUrl never returns the password', () => {
    const r = parseDatabaseUrl('postgres://user:hunter2@db.internal:5432/buyerrecon_staging');
    expect(r.host).toBe('db.internal:5432');
    expect(r.name).toBe('buyerrecon_staging');
    expect(JSON.stringify(r)).not.toContain('hunter2');
  });

  it('actionability bands enum equals the 6 PR#13a v0.1 values exactly', () => {
    expect([...ACTIONABILITY_BANDS_ALLOWED]).toEqual([
      'hot_now', 'warm_recent', 'cooling', 'stale', 'dormant', 'insufficient_evidence',
    ]);
  });

  it('enum allowlists are non-empty', () => {
    expect(CATEGORY_TEMPLATES_ALLOWED.length).toBeGreaterThan(0);
    expect(PRIMARY_CONVERSION_GOALS_ALLOWED.length).toBeGreaterThan(0);
    expect(SALES_MOTIONS_ALLOWED.length).toBeGreaterThan(0);
    expect(EVIDENCE_PREVIEW_REJECT_REASONS.length).toBeGreaterThan(0);
    expect(EXCLUDED_SURFACES.length).toBeGreaterThan(0);
  });
});

/* --------------------------------------------------------------------------
 * Stub helpers
 * ------------------------------------------------------------------------ */

interface StubFixture {
  readonly poiRows:    readonly PoiRowRaw[];
  readonly poiSeqRows: readonly PoiSequenceRowRaw[];
}

function makeHealthyStub(fixture: StubFixture) {
  return makeStubClient(async (sql, params) => {
    if (sql.includes("table_name   = 'poi_observations_v0_1'") && sql.includes('information_schema.tables')) {
      return { rows: [{ present: true }], rowCount: 1 };
    }
    if (sql.includes("table_name   = 'poi_sequence_observations_v0_1'") && sql.includes('information_schema.tables')) {
      return { rows: [{ present: true }], rowCount: 1 };
    }
    if (sql === SELECT_TABLE_COLUMNS_SQL) {
      const tableName = params[0];
      if (tableName === 'poi_observations_v0_1') {
        return {
          rows: REQUIRED_POI_COLUMNS.map((c) => ({ column_name: c })),
          rowCount: REQUIRED_POI_COLUMNS.length,
        };
      }
      if (tableName === 'poi_sequence_observations_v0_1') {
        return {
          rows: REQUIRED_POI_SEQUENCE_COLUMNS.map((c) => ({ column_name: c })),
          rowCount: REQUIRED_POI_SEQUENCE_COLUMNS.length,
        };
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
 * P. evidence_refs validator — Codex blocker 1
 *
 * `isValidEvidenceRefs` must reject every malformed entry, mirroring
 * the PR#12e SQL bad-id predicate. Tests prove:
 *   - missing poi_observation_id rejects
 *   - string ID rejects
 *   - negative ID rejects
 *   - fractional ID rejects
 *   - NaN / Infinity rejects
 *   - valid integer ID (including 0) accepts
 *   - lower-layer refs still reject
 *   - malformed evidence_refs become row-level rejects, not crashes
 * ------------------------------------------------------------------------ */

describe('P. evidence_refs validator — full integer + table guard', () => {
  it('accepts valid `{ table: poi_observations_v0_1, poi_observation_id: <int> }`', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 1 }])).toBe(true);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 0 }])).toBe(true);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 12345 }])).toBe(true);
    expect(isValidEvidenceRefs([
      { table: 'poi_observations_v0_1', poi_observation_id: 1 },
      { table: 'poi_observations_v0_1', poi_observation_id: 2 },
    ])).toBe(true);
  });

  it('rejects missing poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1' }])).toBe(false);
  });

  it('rejects string poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: '42' }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: '' }])).toBe(false);
  });

  it('rejects negative poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: -1 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: -0.5 }])).toBe(false);
  });

  it('rejects fractional poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 1.5 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 0.001 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: 99.9999 }])).toBe(false);
  });

  it('rejects NaN / Infinity / -Infinity poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: Number.NaN }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: Number.POSITIVE_INFINITY }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: Number.NEGATIVE_INFINITY }])).toBe(false);
  });

  it('rejects null / boolean / array / object poi_observation_id', () => {
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: null }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: true }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: [1] }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'poi_observations_v0_1', poi_observation_id: { v: 1 } }])).toBe(false);
  });

  it('rejects lower-layer table refs (OD-14 guard)', () => {
    expect(isValidEvidenceRefs([{ table: 'session_features', poi_observation_id: 1 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'session_behavioural_features_v0_2', poi_observation_id: 1 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'stage0_decisions', poi_observation_id: 1 }])).toBe(false);
    expect(isValidEvidenceRefs([{ table: 'accepted_events', poi_observation_id: 1 }])).toBe(false);
  });

  it('rejects non-array / empty array / non-object entries', () => {
    expect(isValidEvidenceRefs([])).toBe(false);
    expect(isValidEvidenceRefs(null)).toBe(false);
    expect(isValidEvidenceRefs({ table: 'poi_observations_v0_1', poi_observation_id: 1 })).toBe(false);
    expect(isValidEvidenceRefs(['poi_observations_v0_1'])).toBe(false);
    expect(isValidEvidenceRefs([42])).toBe(false);
    expect(isValidEvidenceRefs([null])).toBe(false);
  });

  it('rejects mixed-validity arrays — one bad entry fails the whole array', () => {
    expect(isValidEvidenceRefs([
      { table: 'poi_observations_v0_1', poi_observation_id: 1 },
      { table: 'poi_observations_v0_1', poi_observation_id: 2.5 },  // fractional
    ])).toBe(false);
    expect(isValidEvidenceRefs([
      { table: 'poi_observations_v0_1', poi_observation_id: 1 },
      { table: 'session_features',      poi_observation_id: 2 },    // lower-layer
    ])).toBe(false);
  });

  it('runner-level: row with fractional evidence_refs id becomes row-level reject, not crash', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' })],
      [mkPoiSeqRow({
        evidence_refs: [{ table: 'poi_observations_v0_1', poi_observation_id: 1.5 }],
      })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(false);
    expect(p.reject_reason).toBe('invalid_evidence_refs');
  });

  it('runner-level: row with string evidence_refs id becomes row-level reject', () => {
    const groups = groupBySession(
      [mkPoiRow({ poi_observation_id: 1, poi_key: '/pricing' })],
      [mkPoiSeqRow({
        evidence_refs: [{ table: 'poi_observations_v0_1', poi_observation_id: '1' }],
      })],
    );
    const p = buildSessionPreview(groups[0]!, T_BASE_MS, 'sales_led');
    expect(p.accepted_into_preview).toBe(false);
    expect(p.reject_reason).toBe('invalid_evidence_refs');
  });
});

/* --------------------------------------------------------------------------
 * Q. CLI exit-code decision — Codex blocker 2
 *
 * `decideProductContextTimingCliExitCode` MUST map:
 *   - fail_closed=true  → exit_code 2 + controlled stderr message
 *   - fail_closed=false → exit_code 0 + null stderr
 *
 * Controlled stderr message MUST NOT include DATABASE_URL / secrets
 * / stack trace.
 * ------------------------------------------------------------------------ */

function mkReport(over: { fail_closed?: boolean; fail_closed_reason?: string | null } = {}): ObserverReport {
  // Distinguish "caller passed null" from "caller omitted the key"
  // — `??` treats both alike, but the test needs the explicit-null
  // case to flow through to the runner's "unspecified" fallback.
  const reason: string | null = Object.prototype.hasOwnProperty.call(over, 'fail_closed_reason')
    ? (over.fail_closed_reason ?? null)
    : (over.fail_closed === true ? 'table poi_observations_v0_1 missing' : null);
  return {
    boundary: {
      workspace_id: 'ws', site_id: 'site',
      window_start: ISO_T0, window_end: ISO_T1,
      checked_at: ISO_T0,
      database_host: 'h', database_name: 'd',
    },
    source_readiness: {
      poi_observations_v0_1_present:          over.fail_closed === true ? false : true,
      poi_sequence_observations_v0_1_present: over.fail_closed === true ? false : true,
      poi_missing_columns:                    [],
      poi_sequence_missing_columns:           [],
      fail_closed:                            over.fail_closed ?? false,
      fail_closed_reason:                     reason,
    },
    source_scan: {
      poi_rows_scanned: 0, poi_sequence_rows_scanned: 0, unique_session_ids_seen: 0,
      poi_input_versions_observed: [], poi_observation_versions_observed: [], poi_sequence_versions_observed: [],
      earliest_observed_at: null, latest_observed_at: null,
    },
    evidence_quality: {
      rows_accepted_into_preview: 0, rows_rejected_from_preview: 0,
      reject_reason_counts: Object.fromEntries(EVIDENCE_PREVIEW_REJECT_REASONS.map((r) => [r, 0])) as Record<typeof EVIDENCE_PREVIEW_REJECT_REASONS[number], number>,
      invalid_evidence_refs_count: 0, unknown_surface_count: 0, excluded_surface_count: 0,
    },
    product_context_preview: {
      universal_surface_distribution: {},
      category_template: DEFAULT_CATEGORY_TEMPLATE,
      primary_conversion_goal: DEFAULT_PRIMARY_CONVERSION_GOAL,
      sales_motion: DEFAULT_SALES_MOTION,
      site_mapping_version: 'site_map-v0.1-baseline',
      excluded_mapping_version: 'excl_map-v0.1-baseline',
      mapping_coverage_percent: 0,
    },
    timing_actionability: {
      actionability_band_distribution: Object.fromEntries(ACTIONABILITY_BANDS_ALLOWED.map((b) => [b, 0])) as Record<typeof ACTIONABILITY_BANDS_ALLOWED[number], number>,
      timing_window_bucket_distribution: {},
      stale_count: 0, dormant_count: 0, insufficient_evidence_count: 0,
      conversion_proximity_indicators: {},
    },
    ams_aligned_json_preview: { samples: [], disclaimer: 'x' },
    read_only_proof: {
      no_db_writes_performed:                  true,
      no_lane_a_b_writes:                      true,
      no_trust_writes:                         true,
      no_policy_writes:                        true,
      no_customer_output:                      true,
      no_ams_product_layer_runtime_execution:  true,
      no_durable_pcf_table:                    true,
      no_migration_or_schema_change:           true,
    },
    run_metadata: {
      observer_version: OBSERVER_VERSION,
      product_context_profile_version: 'pcp-v0.1',
      universal_surface_taxonomy_version: 'ust-v0.1',
      category_template_version: 'generic_b2b-v0.1',
      buying_role_lens_version: 'brl-v0.1-deferred',
      site_mapping_version: 'site_map-v0.1-baseline',
      excluded_mapping_version: 'excl_map-v0.1-baseline',
      timing_window_model_version: 'tw-v0.1',
      freshness_decay_model_version: 'fd-v0.1',
      source_table_poi: 'poi_observations_v0_1',
      source_table_poi_sequence: 'poi_sequence_observations_v0_1',
      record_only: true,
      run_started_at: ISO_T0,
      run_ended_at: ISO_T0,
    },
  };
}

describe('Q. CLI exit-code decision', () => {
  it('fail_closed report → exit_code 2 + controlled stderr message containing the reason', () => {
    const r = mkReport({ fail_closed: true, fail_closed_reason: 'table poi_observations_v0_1 missing' });
    const d = decideProductContextTimingCliExitCode(r);
    expect(d.exit_code).toBe(2);
    expect(d.stderr_message).not.toBeNull();
    expect(d.stderr_message).toContain('fail_closed');
    expect(d.stderr_message).toContain('table poi_observations_v0_1 missing');
  });

  it('non-fail_closed report → exit_code 0 + null stderr', () => {
    const r = mkReport({ fail_closed: false });
    const d = decideProductContextTimingCliExitCode(r);
    expect(d.exit_code).toBe(0);
    expect(d.stderr_message).toBeNull();
  });

  it('fail_closed with null reason still produces controlled message', () => {
    const r = mkReport({ fail_closed: true, fail_closed_reason: null });
    const d = decideProductContextTimingCliExitCode(r);
    expect(d.exit_code).toBe(2);
    expect(d.stderr_message).toContain('unspecified');
  });

  it('controlled stderr message does NOT leak DATABASE_URL / passwords / stack trace markers', () => {
    const r = mkReport({ fail_closed: true, fail_closed_reason: 'sensitive_reason_should_pass_through' });
    const d = decideProductContextTimingCliExitCode(r);
    const msg = d.stderr_message ?? '';
    expect(msg).not.toContain('postgres://');
    expect(msg).not.toContain('password');
    expect(msg).not.toContain('DATABASE_URL=');
    expect(msg).not.toMatch(/at\s+\w+\s+\(/); // no stack-trace frames
    expect(msg.split('\n').length).toBe(1);   // single line only
  });
});
