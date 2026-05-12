/**
 * Sprint 2 PR#1 + PR#2 — pure tests for behavioural-features-v0.3 extractor.
 *
 * No DB connection. Tests cover:
 *   - parseOptionsFromEnv defaults + overrides + invalid inputs
 *   - EXTRACTION_SQL string contains required v1 filters
 *   - EXTRACTION_SQL is an idempotent upsert against
 *     session_behavioural_features_v0_2 only
 *   - EXTRACTION_SQL never mutates source tables
 *   - EXTRACTION_SQL never selects token_hash / ip_hash / user_agent /
 *     peppers / raw bearer tokens
 *   - source code carries no forbidden scoring/action/classification terms
 *   - forbidden-code sweeps load scoring/forbidden_codes.yml via
 *     `.patterns` (post-CF-2 shape)
 *   - reason-code regex patterns are scoped to emitted reason codes only
 *     (so schema field names like `verification_method_strength` are NOT
 *     spuriously blocked)
 *   - no Track A / Core AMS / collector v1 imports
 *   - bucket helpers behave deterministically
 *   - PR#2 refresh-loop server-side derivation:
 *       * `refresh_loop_candidate` is the column name (NOT
 *         `refresh_loop_observed` — judgement implication forbidden by D-2)
 *       * Helen-approved thresholds D-3 (N=3, W=10000ms, K=1)
 *       * SDK refresh-loop hints are NOT trusted (D-4 Option alpha)
 *       * v0.3 feature_presence_map / feature_source_map have 13 keys
 *       * v0.2 feature_presence_map / feature_source_map remain 12 keys
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_FEATURE_VERSION,
  DEFAULT_SINCE_HOURS,
  EXPECTED_FEATURE_COUNT_V0_2,
  EXPECTED_FEATURE_COUNT_V0_3,
  EXTRACTION_SQL,
  REFRESH_LOOP_MAX_ACTIONS_BETWEEN,
  REFRESH_LOOP_MAX_SPAN_MS,
  REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS,
  bucketiseInteractionDensity,
  bucketiseScrollDepth,
  parseOptionsFromEnv,
} from '../../scripts/extract-behavioural-features.js';

const ROOT = join(__dirname, '..', '..');
const EXTRACTOR_PATH = join(ROOT, 'scripts', 'extract-behavioural-features.ts');
const MIGRATION_PR1_PATH = join(
  ROOT,
  'migrations',
  '009_session_behavioural_features_v0_2.sql',
);
const MIGRATION_PR2_PATH = join(
  ROOT,
  'migrations',
  '010_session_behavioural_features_v0_2_refresh_loop.sql',
);
const FORBIDDEN_CODES_PATH = join(ROOT, 'scoring', 'forbidden_codes.yml');

/* --------------------------------------------------------------------------
 * parseOptionsFromEnv
 * ------------------------------------------------------------------------ */

describe('parseOptionsFromEnv — defaults', () => {
  const now = new Date('2026-05-12T12:00:00Z');

  it('uses default FEATURE_VERSION = behavioural-features-v0.3 when env unset', () => {
    const opts = parseOptionsFromEnv({}, now);
    expect(opts.feature_version).toBe(DEFAULT_FEATURE_VERSION);
    expect(DEFAULT_FEATURE_VERSION).toBe('behavioural-features-v0.3');
  });

  it('uses default SINCE_HOURS=168 (7 days) when env unset', () => {
    const opts = parseOptionsFromEnv({}, now);
    const expectedStart = new Date(now.getTime() - DEFAULT_SINCE_HOURS * 3600 * 1000);
    expect(opts.window_start.toISOString()).toBe(expectedStart.toISOString());
    expect(opts.window_end.toISOString()).toBe(now.toISOString());
    expect(DEFAULT_SINCE_HOURS).toBe(168);
  });

  it('returns null filters by default', () => {
    const opts = parseOptionsFromEnv({}, now);
    expect(opts.workspace_id).toBeNull();
    expect(opts.site_id).toBeNull();
  });
});

describe('parseOptionsFromEnv — overrides', () => {
  const now = new Date('2026-05-12T12:00:00Z');

  it('FEATURE_VERSION env override', () => {
    const opts = parseOptionsFromEnv({ FEATURE_VERSION: 'behavioural-features-v0.4-rc' }, now);
    expect(opts.feature_version).toBe('behavioural-features-v0.4-rc');
  });

  it('FEATURE_VERSION=behavioural-features-v0.2 still accepted for backward-compat extraction', () => {
    const opts = parseOptionsFromEnv({ FEATURE_VERSION: 'behavioural-features-v0.2' }, now);
    expect(opts.feature_version).toBe('behavioural-features-v0.2');
  });

  it('WORKSPACE_ID + SITE_ID filters', () => {
    const opts = parseOptionsFromEnv({ WORKSPACE_ID: 'ws1', SITE_ID: 'site1' }, now);
    expect(opts.workspace_id).toBe('ws1');
    expect(opts.site_id).toBe('site1');
  });

  it('SINCE_HOURS=24 override', () => {
    const opts = parseOptionsFromEnv({ SINCE_HOURS: '24' }, now);
    const expectedStart = new Date(now.getTime() - 24 * 3600 * 1000);
    expect(opts.window_start.toISOString()).toBe(expectedStart.toISOString());
  });

  it('SINCE ISO override', () => {
    const opts = parseOptionsFromEnv({ SINCE: '2026-05-01T00:00:00Z' }, now);
    expect(opts.window_start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('UNTIL ISO override', () => {
    const opts = parseOptionsFromEnv({ UNTIL: '2026-05-10T00:00:00Z' }, now);
    expect(opts.window_end.toISOString()).toBe('2026-05-10T00:00:00.000Z');
  });

  it('SINCE overrides SINCE_HOURS', () => {
    const opts = parseOptionsFromEnv(
      { SINCE: '2026-04-01T00:00:00Z', SINCE_HOURS: '24' },
      now,
    );
    expect(opts.window_start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('parseOptionsFromEnv — invalid inputs', () => {
  const exitMock: () => never = (() => {
    throw new Error('process.exit called');
  }) as unknown as () => never;
  const realExit = process.exit;
  const realError = console.error;

  it('invalid SINCE_HOURS exits', () => {
    process.exit = exitMock;
    console.error = () => undefined;
    try {
      expect(() => parseOptionsFromEnv({ SINCE_HOURS: 'abc' }, new Date())).toThrow();
    } finally {
      process.exit = realExit;
      console.error = realError;
    }
  });

  it('invalid UNTIL exits', () => {
    process.exit = exitMock;
    console.error = () => undefined;
    try {
      expect(() => parseOptionsFromEnv({ UNTIL: 'not-a-date' }, new Date())).toThrow();
    } finally {
      process.exit = realExit;
      console.error = realError;
    }
  });

  it('SINCE after UNTIL exits (window_start >= window_end)', () => {
    process.exit = exitMock;
    console.error = () => undefined;
    try {
      expect(() =>
        parseOptionsFromEnv(
          { SINCE: '2026-05-10T00:00:00Z', UNTIL: '2026-05-01T00:00:00Z' },
          new Date(),
        ),
      ).toThrow();
    } finally {
      process.exit = realExit;
      console.error = realError;
    }
  });
});

/* --------------------------------------------------------------------------
 * EXTRACTION_SQL — required v1 filters
 * ------------------------------------------------------------------------ */

describe('EXTRACTION_SQL — required v1 filters', () => {
  it("filters event_contract_version = 'event-contract-v0.1'", () => {
    expect(EXTRACTION_SQL).toContain("event_contract_version = 'event-contract-v0.1'");
  });

  it("filters event_origin = 'browser'", () => {
    expect(EXTRACTION_SQL).toContain("event_origin = 'browser'");
  });

  it("excludes session_id = '__server__'", () => {
    expect(EXTRACTION_SQL).toMatch(/session_id\s*<>\s*'__server__'/);
  });

  it('requires non-null workspace_id, site_id, session_id on candidate selection', () => {
    expect(EXTRACTION_SQL).toMatch(/ae\.workspace_id\s+IS\s+NOT\s+NULL/);
    expect(EXTRACTION_SQL).toMatch(/ae\.site_id\s+IS\s+NOT\s+NULL/);
    expect(EXTRACTION_SQL).toMatch(/ae\.session_id\s+IS\s+NOT\s+NULL/);
  });
});

describe('EXTRACTION_SQL — candidate-window vs full-session aggregation', () => {
  it('candidate_sessions CTE has received_at window filter', () => {
    const candidate = EXTRACTION_SQL.match(/candidate_sessions AS \(([\s\S]*?)\),/);
    expect(candidate).not.toBeNull();
    const body = candidate![1]!;
    expect(body).toMatch(/received_at\s*>=\s*\$1/);
    expect(body).toMatch(/received_at\s*<=\s*\$2/);
  });

  it('session_events CTE has NO received_at window filter (full-session)', () => {
    const sessionEvents = EXTRACTION_SQL.match(/session_events AS \(([\s\S]*?)\),/);
    expect(sessionEvents).not.toBeNull();
    const body = sessionEvents![1]!;
    expect(body).toMatch(/JOIN candidate_sessions/);
    expect(body).not.toMatch(/received_at\s*>=\s*\$1/);
    expect(body).not.toMatch(/received_at\s*<=\s*\$2/);
  });
});

describe('EXTRACTION_SQL — deterministic ordering', () => {
  it('uses (received_at ASC, event_id ASC) ordering for endpoints + LAG + refresh-loop runs', () => {
    // Multiple CTEs use this exact ordering. Verify at least three sites.
    const matches = EXTRACTION_SQL.match(/ORDER BY received_at ASC,\s*event_id ASC/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('uses (received_at DESC, event_id DESC) ordering for last-event endpoint', () => {
    expect(EXTRACTION_SQL).toMatch(/ORDER BY received_at DESC,\s*event_id DESC/);
  });

  it('uses (received_at, event_id) ordering for pageview LAG', () => {
    const pvOrdered = EXTRACTION_SQL.match(/pageview_ordered AS \(([\s\S]*?)\),/);
    expect(pvOrdered).not.toBeNull();
    expect(pvOrdered![1]!).toMatch(/ORDER BY received_at ASC,\s*event_id ASC/);
  });

  it('uses (received_at, event_id) ordering for PR#2 page_view_seq', () => {
    const seq = EXTRACTION_SQL.match(/page_view_seq AS \(([\s\S]*?)\),/);
    expect(seq).not.toBeNull();
    expect(seq![1]!).toMatch(/ORDER BY received_at ASC,\s*event_id ASC/);
  });
});

describe('EXTRACTION_SQL — idempotent upsert', () => {
  it('targets ON CONFLICT on the natural-key tuple', () => {
    expect(EXTRACTION_SQL).toMatch(
      /ON CONFLICT \(workspace_id, site_id, session_id, feature_version\)/,
    );
  });

  it('uses DO UPDATE (not DO NOTHING)', () => {
    expect(EXTRACTION_SQL).toMatch(/DO UPDATE SET/);
    expect(EXTRACTION_SQL).not.toMatch(/DO NOTHING/);
  });

  it('DO UPDATE SET refreshes all 8 PR#2 refresh-loop columns', () => {
    const updateBlock = EXTRACTION_SQL.match(/DO UPDATE SET([\s\S]*?)RETURNING/);
    expect(updateBlock).not.toBeNull();
    const body = updateBlock![1]!;
    for (const col of [
      'refresh_loop_candidate',
      'refresh_loop_count',
      'same_path_repeat_count',
      'same_path_repeat_max_span_ms',
      'same_path_repeat_min_delta_ms',
      'same_path_repeat_median_delta_ms',
      'repeat_pageview_candidate_count',
      'refresh_loop_source',
    ]) {
      expect(body).toMatch(new RegExp(`${col}\\s*=\\s*EXCLUDED\\.${col}`));
    }
  });

  it('returns at least primary identification columns', () => {
    expect(EXTRACTION_SQL).toMatch(
      /RETURNING\s+behavioural_features_id,\s+workspace_id,\s+site_id,\s+session_id/,
    );
  });
});

describe('EXTRACTION_SQL — only target table written', () => {
  it('INSERTs only into session_behavioural_features_v0_2', () => {
    const inserts = EXTRACTION_SQL.match(/INSERT INTO\s+(\w+)/g) ?? [];
    expect(inserts.length).toBe(1);
    expect(inserts[0]!).toMatch(/INSERT INTO session_behavioural_features_v0_2/);
  });

  it('does not mutate accepted_events / rejected_events / ingest_requests / site_write_tokens / session_features', () => {
    for (const verb of ['INSERT INTO', 'UPDATE', 'DELETE FROM', 'TRUNCATE']) {
      for (const tbl of [
        'accepted_events',
        'rejected_events',
        'ingest_requests',
        'site_write_tokens',
        'session_features\\b',
      ]) {
        const re = new RegExp(`${verb}\\s+${tbl}`, 'i');
        expect(EXTRACTION_SQL).not.toMatch(re);
      }
    }
  });

  it('does not perform any DDL (DROP / ALTER / CREATE)', () => {
    expect(EXTRACTION_SQL).not.toMatch(/\bDROP\s+(TABLE|INDEX|VIEW|SCHEMA|DATABASE)\b/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bALTER\s+(TABLE|INDEX|VIEW|SCHEMA|DATABASE)\b/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bCREATE\s+(TABLE|INDEX|VIEW|SCHEMA|DATABASE)\b/i);
  });
});

describe('EXTRACTION_SQL — privacy / secrets', () => {
  const forbiddenSelections = [
    'token_hash',
    'ip_hash',
    'user_agent',
    'site_write_token_pepper',
    'ip_hash_pepper',
    'Authorization',
    'bearer',
  ];
  for (const tok of forbiddenSelections) {
    it(`never references ${tok}`, () => {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      expect(EXTRACTION_SQL).not.toMatch(re);
    });
  }
});

/* --------------------------------------------------------------------------
 * PR#2 — refresh-loop server-side derivation contract
 * ------------------------------------------------------------------------ */

describe('PR#2 — refresh-loop factual extraction constants (D-3)', () => {
  it('REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS = 3', () => {
    expect(REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS).toBe(3);
  });

  it('REFRESH_LOOP_MAX_SPAN_MS = 10000', () => {
    expect(REFRESH_LOOP_MAX_SPAN_MS).toBe(10000);
  });

  it('REFRESH_LOOP_MAX_ACTIONS_BETWEEN = 1', () => {
    expect(REFRESH_LOOP_MAX_ACTIONS_BETWEEN).toBe(1);
  });
});

describe('PR#2 — refresh_loop_candidate name (NOT refresh_loop_observed)', () => {
  function stripCommentsTs(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }
  function stripCommentsSql(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  }

  it('extractor source (active code, comments stripped) never mentions refresh_loop_observed', () => {
    const src = stripCommentsTs(readFileSync(EXTRACTOR_PATH, 'utf8'));
    expect(src).not.toMatch(/refresh_loop_observed/);
  });

  it('migration 010 SQL (active DDL, comments stripped) never mentions refresh_loop_observed', () => {
    const sql = stripCommentsSql(readFileSync(MIGRATION_PR2_PATH, 'utf8'));
    expect(sql).not.toMatch(/refresh_loop_observed/);
  });

  it('extractor SQL writes refresh_loop_candidate as boolean column', () => {
    expect(EXTRACTION_SQL).toMatch(/refresh_loop_candidate/);
    expect(EXTRACTION_SQL).toMatch(
      /\(COALESCE\(rla\.refresh_loop_count,\s*0\)\s*>\s*0\)\s+AS\s+refresh_loop_candidate/,
    );
  });
});

describe('PR#2 — SDK refresh-loop hints are NEVER trusted (D-4 Option alpha)', () => {
  function stripCommentsTs(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }

  it('extractor source (active code, comments stripped) does not trust SDK refresh-loop hints', () => {
    const src = stripCommentsTs(readFileSync(EXTRACTOR_PATH, 'utf8'));
    expect(src).not.toMatch(/sdk_hint_present_not_trusted/);
    expect(src).not.toMatch(/sdk_refresh_loop/);
    expect(src).not.toMatch(/raw->>['"]refresh_loop[^'"]*['"]/);
    expect(src).not.toMatch(/raw->>['"]is_refresh_loop['"]/);
  });

  it('extractor SQL does not select / extract any SDK refresh-loop hint', () => {
    expect(EXTRACTION_SQL).not.toMatch(/sdk_hint_present_not_trusted/);
    expect(EXTRACTION_SQL).not.toMatch(/raw->>['"]refresh_loop[^'"]*['"]/);
    expect(EXTRACTION_SQL).not.toMatch(/raw->>['"]is_refresh_loop['"]/);
  });

  it('refresh_loop_source is the literal string server_derived (PR#2 active output)', () => {
    expect(EXTRACTION_SQL).toMatch(/'server_derived'::text\s+AS\s+refresh_loop_source/);
  });
});

describe('PR#2 — refresh-loop CTE pipeline structure', () => {
  it('has page_view_seq CTE with LAG over (received_at, event_id) including prev_pv_event_id', () => {
    const seq = EXTRACTION_SQL.match(/page_view_seq AS \(([\s\S]*?)\),/);
    expect(seq).not.toBeNull();
    const body = seq![1]!;
    expect(body).toMatch(/LAG\(received_at\)/);
    expect(body).toMatch(/LAG\(page_path\)/);
    // Codex BLOCKER fix: prev_pv_event_id must be carried so the action
    // boundary in pv_with_actions can use the full deterministic tuple.
    expect(body).toMatch(/LAG\(event_id\)\s+OVER\s+w\s+AS\s+prev_pv_event_id/);
    expect(body).toMatch(/event_name\s*=\s*'page_view'/);
  });

  it('has pv_with_actions CTE that counts cta_click | form_start | form_submit between adjacent PVs', () => {
    // pv_with_actions contains a subquery with nested parens, so the CTE
    // closing `),` is anchored to start-of-line via `\n\),`.
    const cte = EXTRACTION_SQL.match(/pv_with_actions AS \(([\s\S]*?)\n\),/);
    expect(cte).not.toBeNull();
    const body = cte![1]!;
    expect(body).toMatch(/'cta_click'/);
    expect(body).toMatch(/'form_start'/);
    expect(body).toMatch(/'form_submit'/);
    expect(body).toMatch(/actions_since_prev_pv/);
  });

  it('pv_with_actions uses the FULL (received_at, event_id) tuple boundary (Codex BLOCKER fix)', () => {
    const cte = EXTRACTION_SQL.match(/pv_with_actions AS \(([\s\S]*?)\n\),/);
    expect(cte).not.toBeNull();
    const body = cte![1]!;
    // Lower bound: prev_pv strict via received_at OR equal-timestamp + event_id strict.
    expect(body).toMatch(/se\.received_at\s*>\s*pv\.prev_pv_received_at/);
    expect(body).toMatch(/se\.event_id\s*>\s*pv\.prev_pv_event_id/);
    // Upper bound: curr_pv strict via received_at OR equal-timestamp + event_id strict.
    expect(body).toMatch(/se\.received_at\s*<\s*pv\.received_at/);
    expect(body).toMatch(/se\.event_id\s*<\s*pv\.event_id/);
    // Carries prev_pv_event_id forward from page_view_seq for use below.
    expect(body).toMatch(/pv\.prev_pv_event_id/);
  });

  it('pv_with_actions does NOT use timestamp-only half-open bounds as the sole boundary (old bug)', () => {
    const cte = EXTRACTION_SQL.match(/pv_with_actions AS \(([\s\S]*?)\n\),/);
    expect(cte).not.toBeNull();
    const body = cte![1]!;
    // The pre-fix predicates were the ONLY bound; assert neither appears
    // verbatim now (the fix replaces `>=` with strict `>` plus tuple
    // tie-break logic).
    expect(body).not.toMatch(/se\.received_at\s*>=\s*pv\.prev_pv_received_at/);
    expect(body).not.toMatch(/se\.received_at\s*<\s+pv\.received_at\s*\n\s*\),/);
  });

  it('has candidate_streaks CTE that filters by N + W + K thresholds', () => {
    const cte = EXTRACTION_SQL.match(/candidate_streaks AS \(([\s\S]*?)\),/);
    expect(cte).not.toBeNull();
    const body = cte![1]!;
    expect(body).toMatch(/run_length\s*>=\s*\$6::int/);
    expect(body).toMatch(/run_span_ms\s*<=\s*\$7::bigint/);
    expect(body).toMatch(/COALESCE\(run_max_actions_between,\s*0\)\s*<=\s*\$8::int/);
  });

  it('refresh-loop median pools eligible adjacent same-path deltas per session (NOT median of medians)', () => {
    const pool = EXTRACTION_SQL.match(/same_path_deltas_pooled AS \(([\s\S]*?)\),/);
    expect(pool).not.toBeNull();
    const body = pool![1]!;
    // Reads from page_view_seq (not run_aggs) — pooling regardless of W/K.
    expect(body).toMatch(/FROM page_view_seq/);
    expect(body).toMatch(/prev_pv_page_path\s*=\s*page_path/);

    const median = EXTRACTION_SQL.match(/refresh_loop_median AS \(([\s\S]*?)\),/);
    expect(median).not.toBeNull();
    expect(median![1]!).toMatch(/PERCENTILE_CONT\(0\.5\)\s+WITHIN\s+GROUP/);
  });

  it('refresh_loop_aggs LEFT JOINs candidate_streaks (not INNER) to keep non-candidate runs visible', () => {
    const cte = EXTRACTION_SQL.match(/refresh_loop_aggs AS \(([\s\S]*?)\)\s*,\s*feature_aggs AS/);
    expect(cte).not.toBeNull();
    expect(cte![1]!).toMatch(/LEFT JOIN candidate_streaks/);
  });
});

describe('PR#2 — INSERT writes the 8 refresh-loop columns', () => {
  it('INSERT column list contains the 8 PR#2 columns', () => {
    const insertBlock = EXTRACTION_SQL.match(
      /INSERT INTO session_behavioural_features_v0_2 \(([\s\S]*?)\)\s*SELECT/,
    );
    expect(insertBlock).not.toBeNull();
    const body = insertBlock![1]!;
    for (const col of [
      'refresh_loop_candidate',
      'refresh_loop_count',
      'same_path_repeat_count',
      'same_path_repeat_max_span_ms',
      'same_path_repeat_min_delta_ms',
      'same_path_repeat_median_delta_ms',
      'repeat_pageview_candidate_count',
      'refresh_loop_source',
    ]) {
      expect(body).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});

/* --------------------------------------------------------------------------
 * EXPECTED_FEATURE_COUNT — v0.2 (12) and v0.3 (13) maps
 * ------------------------------------------------------------------------ */

describe('EXPECTED_FEATURE_COUNT_V0_2 / V0_3', () => {
  it('v0.2 count is 12', () => {
    expect(EXPECTED_FEATURE_COUNT_V0_2).toBe(12);
  });

  it('v0.3 count is 13 (12 + refresh_loop_candidate)', () => {
    expect(EXPECTED_FEATURE_COUNT_V0_3).toBe(13);
  });

  /**
   * Slice helper: locate the feature_presence_map CASE block, then split
   * it into v0.3 (THEN ... ELSE) and v0.2 (ELSE ... END AS ...) bodies.
   * Anchor-based slicing avoids fragile regex on multi-paren content.
   */
  function slicePresenceMapBranches(sql: string): { v03: string; v02: string } {
    const endIdx = sql.indexOf('END AS feature_presence_map');
    expect(endIdx).toBeGreaterThan(0);
    // Start: walk backwards to find the CASE that opens this END.
    const caseIdx = sql.lastIndexOf('CASE', endIdx);
    expect(caseIdx).toBeGreaterThan(0);
    const block = sql.slice(caseIdx, endIdx);
    // The first 'ELSE' inside this CASE separates v0.3 from v0.2.
    const elseIdx = block.indexOf(' ELSE');
    expect(elseIdx).toBeGreaterThan(0);
    return {
      v03: block.slice(0, elseIdx),
      v02: block.slice(elseIdx),
    };
  }

  function sliceSourceMapBranches(sql: string): { v03: string; v02: string } {
    const endIdx = sql.indexOf('END AS feature_source_map');
    expect(endIdx).toBeGreaterThan(0);
    const caseIdx = sql.lastIndexOf('CASE', endIdx);
    expect(caseIdx).toBeGreaterThan(0);
    const block = sql.slice(caseIdx, endIdx);
    const elseIdx = block.indexOf(' ELSE');
    expect(elseIdx).toBeGreaterThan(0);
    return {
      v03: block.slice(0, elseIdx),
      v02: block.slice(elseIdx),
    };
  }

  it('SQL contains a v0.3 feature_presence_map jsonb_build_object with exactly 13 keys', () => {
    const { v03 } = slicePresenceMapBranches(EXTRACTION_SQL);
    const keys = v03.match(/'([a-z0-9_]+)'\s*,\s*pl\.p_/g) ?? [];
    expect(keys.length).toBe(EXPECTED_FEATURE_COUNT_V0_3);
    expect(v03).toMatch(/'refresh_loop_candidate'/);
  });

  it('SQL contains a v0.2 (ELSE) feature_presence_map jsonb_build_object with exactly 12 keys', () => {
    const { v02 } = slicePresenceMapBranches(EXTRACTION_SQL);
    const keys = v02.match(/'([a-z0-9_]+)'\s*,\s*pl\.p_/g) ?? [];
    expect(keys.length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    expect(v02).not.toMatch(/'refresh_loop_candidate'/);
  });

  it('SQL contains a v0.3 feature_source_map jsonb_build_object with exactly 13 source keys', () => {
    const { v03 } = sliceSourceMapBranches(EXTRACTION_SQL);
    const keys =
      v03.match(/'([a-z0-9_]+)'\s*,\s*'(?:server_derived|not_extractable)'/g) ?? [];
    expect(keys.length).toBe(EXPECTED_FEATURE_COUNT_V0_3);
    expect(v03).toMatch(/'refresh_loop_candidate'\s*,\s*'server_derived'/);
  });

  it('SQL contains a v0.2 feature_source_map jsonb_build_object with exactly 12 source keys', () => {
    const { v02 } = sliceSourceMapBranches(EXTRACTION_SQL);
    const keys =
      v02.match(/'([a-z0-9_]+)'\s*,\s*'(?:server_derived|not_extractable)'/g) ?? [];
    expect(keys.length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
    expect(v02).not.toMatch(/'refresh_loop_candidate'/);
  });
});

/* --------------------------------------------------------------------------
 * Forbidden-code sweep — load scoring/forbidden_codes.yml via .patterns
 *   - hard_blocked_code_patterns.patterns applies to emitted reason codes ONLY
 *   - string_patterns_blocked_in_code.patterns applies to source-code strings
 * ------------------------------------------------------------------------ */

function extractYamlPatternList(yamlSrc: string, sectionKey: string): string[] {
  const lines = yamlSrc.split('\n');
  let inSection = false;
  let inPatterns = false;
  const patterns: string[] = [];
  for (const line of lines) {
    if (!inSection) {
      if (line.startsWith(sectionKey + ':')) inSection = true;
      continue;
    }
    if (/^[A-Za-z_][\w]*:/.test(line)) {
      inSection = false;
      inPatterns = false;
      continue;
    }
    if (!inPatterns) {
      if (line.match(/^\s{2,4}patterns:/)) {
        inPatterns = true;
      }
      continue;
    }
    const itemMatch = line.match(/^\s{4,}-\s+"?([^"#]+?)"?\s*(?:#.*)?$/);
    if (itemMatch) {
      patterns.push(itemMatch[1]!.trim());
    } else if (line.trim() === '' || /^\s/.test(line)) {
      continue;
    } else {
      inPatterns = false;
      inSection = false;
    }
  }
  return patterns;
}

describe('Forbidden-code sweep — hard_blocked_code_patterns (emitted reason codes only)', () => {
  const yamlSrc = readFileSync(FORBIDDEN_CODES_PATH, 'utf8');
  const patterns = extractYamlPatternList(yamlSrc, 'hard_blocked_code_patterns');

  it('loads at least 5 reason-code regex patterns', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(5);
  });

  it('scope is emitted_reason_codes_only (annotation present in YAML)', () => {
    expect(yamlSrc).toMatch(
      /hard_blocked_code_patterns:[\s\S]*?applies_to:\s*emitted_reason_codes_only/,
    );
  });

  it('PR#2 extractor source contains no UPPERCASE reason-code-shaped strings matching any pattern', () => {
    const src = readFileSync(EXTRACTOR_PATH, 'utf8');
    for (const pat of patterns) {
      const re = new RegExp(pat);
      const candidates = src.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
      for (const cand of candidates) {
        if (re.test(cand)) {
          throw new Error(
            `extractor source contains "${cand}" matching forbidden reason-code pattern /${pat}/`,
          );
        }
      }
    }
  });

  it('the schema field name `verification_method_strength` is NOT blocked (CF-2 carve-out)', () => {
    const sample = 'verification_method_strength';
    const verifiedPattern = patterns.find((p) => p.includes('_VERIFIED$'));
    expect(verifiedPattern).toBeDefined();
    const re = new RegExp(verifiedPattern!);
    expect(re.test(sample)).toBe(false);
  });
});

describe('Forbidden-code sweep — string_patterns_blocked_in_code (source-code strings)', () => {
  const yamlSrc = readFileSync(FORBIDDEN_CODES_PATH, 'utf8');
  const patterns = extractYamlPatternList(yamlSrc, 'string_patterns_blocked_in_code');

  it('loads at least 10 source-code string patterns', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(10);
  });

  it('scope is source_code_strings_only (annotation present in YAML)', () => {
    expect(yamlSrc).toMatch(
      /string_patterns_blocked_in_code:[\s\S]*?applies_to:\s*source_code_strings_only/,
    );
  });

  it('PR#2 extractor source contains no forbidden source-code strings', () => {
    const src = readFileSync(EXTRACTOR_PATH, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    for (const pat of patterns) {
      expect(stripped).not.toContain(pat);
    }
  });

  it('PR#1 migration 009 SQL contains no forbidden source-code strings', () => {
    const sql = readFileSync(MIGRATION_PR1_PATH, 'utf8');
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '');
    for (const pat of patterns) {
      expect(stripped).not.toContain(pat);
    }
  });

  it('PR#2 migration 010 SQL contains no forbidden source-code strings', () => {
    const sql = readFileSync(MIGRATION_PR2_PATH, 'utf8');
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '');
    for (const pat of patterns) {
      expect(stripped).not.toContain(pat);
    }
  });
});

/* --------------------------------------------------------------------------
 * No-scoring boundary — narrowly-scoped sweep for forbidden identifiers
 * ------------------------------------------------------------------------ */

describe('PR#2 source + migration — no scoring / classification / action identifiers', () => {
  const FORBIDDEN_IDENTIFIERS = [
    'risk_score',
    'buyer_score',
    'intent_score',
    'bot_score',
    'human_score',
    'fraud_score',
    'classification',
    'recommended_action',
    'confidence_band',
    'is_bot',
    'is_agent',
    'ai_agent',
    'is_human',
    'lead_quality',
    'company_enrichment',
    'ip_enrichment',
  ];

  // 'reason_code' is forbidden as a COLUMN/FIELD identifier. Comments may
  // legitimately reference scoring/reason_code_dictionary.yml.
  const FORBIDDEN_IDENTIFIERS_NOT_IN_COMMENTS = [...FORBIDDEN_IDENTIFIERS, 'reason_code'];

  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }

  function stripSqlComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  }

  it('extractor source (stripped of comments) has no forbidden identifiers', () => {
    const src = stripComments(readFileSync(EXTRACTOR_PATH, 'utf8'));
    for (const tok of FORBIDDEN_IDENTIFIERS_NOT_IN_COMMENTS) {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      expect(src).not.toMatch(re);
    }
  });

  it('migration 009 SQL (stripped of comments) has no forbidden identifiers', () => {
    const sql = stripSqlComments(readFileSync(MIGRATION_PR1_PATH, 'utf8'));
    for (const tok of FORBIDDEN_IDENTIFIERS_NOT_IN_COMMENTS) {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      expect(sql).not.toMatch(re);
    }
  });

  it('migration 010 SQL (stripped of comments) has no forbidden identifiers', () => {
    const sql = stripSqlComments(readFileSync(MIGRATION_PR2_PATH, 'utf8'));
    for (const tok of FORBIDDEN_IDENTIFIERS_NOT_IN_COMMENTS) {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      expect(sql).not.toMatch(re);
    }
  });
});

/* --------------------------------------------------------------------------
 * No Track A / Core AMS / collector v1 imports
 * ------------------------------------------------------------------------ */

describe('PR#2 source — no Track A / Core AMS / collector v1 imports', () => {
  const src = readFileSync(EXTRACTOR_PATH, 'utf8');

  it('does not import or reference ams-qa-behaviour-tests', () => {
    expect(src).not.toMatch(/ams-qa-behaviour-tests/i);
  });

  it('does not import or reference keigentechnologies\\/AMS', () => {
    expect(src).not.toMatch(/keigentechnologies\/AMS/i);
  });

  it('does not import from src/collector/v1', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/collector\/v1[^'"]*['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*collector\/v1[^'"]*['"]/);
  });

  it('does not import from src/app or src/server or src/auth', () => {
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/app[^'"]*['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/server[^'"]*['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/auth[^'"]*['"]/);
  });
});

/* --------------------------------------------------------------------------
 * Pure helpers — bucketise functions
 * ------------------------------------------------------------------------ */

describe('bucketiseInteractionDensity', () => {
  it.each([
    [0, '0'],
    [1, '1-2'],
    [2, '1-2'],
    [3, '3-5'],
    [5, '3-5'],
    [6, '6-10'],
    [10, '6-10'],
    [11, '>10'],
    [100, '>10'],
  ] as const)('input %i → bucket %s', (input, expected) => {
    expect(bucketiseInteractionDensity(input)).toBe(expected);
  });

  it('non-finite input → 0 bucket', () => {
    expect(bucketiseInteractionDensity(NaN)).toBe('0');
    expect(bucketiseInteractionDensity(-1)).toBe('0');
  });
});

describe('bucketiseScrollDepth', () => {
  it.each([
    [null, null],
    [undefined, null],
    [0, '0'],
    [25, '1-25'],
    [26, '26-50'],
    [50, '26-50'],
    [51, '51-75'],
    [75, '51-75'],
    [76, '76-100'],
    [100, '76-100'],
  ] as const)('input %s → bucket %s', (input, expected) => {
    expect(bucketiseScrollDepth(input as number | null | undefined)).toBe(expected);
  });

  it('non-finite input → null', () => {
    expect(bucketiseScrollDepth(NaN)).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * Migration 010 (PR#2) — structure
 * ------------------------------------------------------------------------ */

describe('migration 010 — structure', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION_PR2_PATH)).toBe(true);
  });

  const sql = readFileSync(MIGRATION_PR2_PATH, 'utf8');

  it('uses ALTER TABLE … ADD COLUMN IF NOT EXISTS (additive, idempotent)', () => {
    expect(sql).toMatch(/ALTER TABLE session_behavioural_features_v0_2/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+refresh_loop_candidate\s+BOOLEAN/);
  });

  it('declares all 8 PR#2 columns with the correct types', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+refresh_loop_candidate\s+BOOLEAN/);
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+refresh_loop_count\s+INT\s+NOT NULL DEFAULT 0/,
    );
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+same_path_repeat_count\s+INT\s+NOT NULL DEFAULT 0/,
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+same_path_repeat_max_span_ms\s+BIGINT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+same_path_repeat_min_delta_ms\s+BIGINT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+same_path_repeat_median_delta_ms\s+BIGINT/);
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+repeat_pageview_candidate_count\s+INT\s+NOT NULL DEFAULT 0/,
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+refresh_loop_source\s+TEXT/);
  });

  // SQL comments (-- … and /* … */) often describe the rollback path or
  // explicitly mention forbidden identifiers as documentation; the active
  // DDL sweeps below operate on a comment-stripped copy.
  const strippedSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');

  it('active DDL never mentions refresh_loop_observed (judgement)', () => {
    expect(strippedSql).not.toMatch(/refresh_loop_observed/);
  });

  it('idempotent CHECK constraints via DO blocks for the 3 numeric count fields', () => {
    expect(sql).toMatch(/CHECK \(refresh_loop_count\s*>=\s*0\)/);
    expect(sql).toMatch(/CHECK \(same_path_repeat_count\s*>=\s*0\)/);
    expect(sql).toMatch(/CHECK \(repeat_pageview_candidate_count\s*>=\s*0\)/);
    expect(sql).toMatch(/DO \$\$/);
  });

  it('active rollback uses DROP COLUMN IF EXISTS (no CASCADE)', () => {
    // The active migration body does NOT emit a DROP — that lives in the
    // rollback note (a SQL comment). Active body assertion:
    expect(strippedSql).not.toMatch(/CASCADE/i);
    // The rollback example (in comments) names DROP COLUMN IF EXISTS:
    expect(sql).toMatch(/DROP COLUMN IF EXISTS\s+refresh_loop_candidate/);
  });

  it('active DDL introduces no FK references or new indexes', () => {
    expect(strippedSql).not.toMatch(/REFERENCES\s+\w+/i);
    expect(strippedSql).not.toMatch(/CREATE INDEX/i);
  });

  it('does not write to source tables (no DML in active DDL)', () => {
    for (const verb of ['INSERT INTO', 'UPDATE', 'DELETE FROM', 'TRUNCATE']) {
      const re = new RegExp(`\\b${verb}\\b`, 'i');
      expect(strippedSql).not.toMatch(re);
    }
  });
});

/* --------------------------------------------------------------------------
 * schema.sql — mirrors PR#2 columns inside the v0_2 block
 * ------------------------------------------------------------------------ */

describe('schema.sql — PR#2 refresh-loop columns mirrored', () => {
  const schema = readFileSync(join(ROOT, 'src', 'db', 'schema.sql'), 'utf8');
  const blockMatch = schema.match(
    /CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2 \(([\s\S]*?)^\);/m,
  );

  it('block exists', () => {
    expect(blockMatch).not.toBeNull();
  });

  it('block declares all 8 PR#2 columns', () => {
    const block = blockMatch![1]!;
    expect(block).toMatch(/\brefresh_loop_candidate\b\s+BOOLEAN/);
    expect(block).toMatch(/\brefresh_loop_count\b\s+INT/);
    expect(block).toMatch(/\bsame_path_repeat_count\b\s+INT/);
    expect(block).toMatch(/\bsame_path_repeat_max_span_ms\b\s+BIGINT/);
    expect(block).toMatch(/\bsame_path_repeat_min_delta_ms\b\s+BIGINT/);
    expect(block).toMatch(/\bsame_path_repeat_median_delta_ms\b\s+BIGINT/);
    expect(block).toMatch(/\brepeat_pageview_candidate_count\b\s+INT/);
    expect(block).toMatch(/\brefresh_loop_source\b\s+TEXT/);
  });

  it('block does not declare refresh_loop_observed (judgement)', () => {
    const block = blockMatch![1]!;
    expect(block).not.toMatch(/refresh_loop_observed/);
  });
});

/* --------------------------------------------------------------------------
 * Migration 009 (PR#1) — structure (unchanged invariants)
 * ------------------------------------------------------------------------ */

describe('migration 009 — PR#1 structure (unchanged)', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION_PR1_PATH)).toBe(true);
  });

  const sql = readFileSync(MIGRATION_PR1_PATH, 'utf8');

  it('uses CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2/);
  });

  it('declares natural-key UNIQUE (workspace_id, site_id, session_id, feature_version)', () => {
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*workspace_id,\s*site_id,\s*session_id,\s*feature_version\s*\)/,
    );
  });

  it('declares the three required indexes', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS\s+session_behavioural_features_v0_2_workspace_site/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS\s+session_behavioural_features_v0_2_session/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS\s+session_behavioural_features_v0_2_version/);
  });

  it('rollback uses non-CASCADE DROP TABLE IF EXISTS', () => {
    expect(sql).toMatch(/DROP TABLE IF EXISTS session_behavioural_features_v0_2;/);
    expect(sql).not.toMatch(/DROP TABLE\s+[\w_]+\s+CASCADE/i);
  });

  it('migration 009 itself does NOT declare any PR#2 refresh-loop columns', () => {
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    // The PR#1 baseline does not declare refresh-loop columns; those come
    // from migration 010 (PR#2).
    expect(stripped).not.toMatch(/^\s*refresh_loop_candidate\s+(BOOLEAN|TEXT|INT|JSONB)/im);
    expect(stripped).not.toMatch(/^\s*refresh_loop_count\s+(BOOLEAN|TEXT|INT|JSONB)/im);
  });

  it('does not introduce hard CHECK constraints on bucket enums', () => {
    expect(sql).not.toMatch(/CHECK\s*\(\s*interaction_density_bucket\s+IN/i);
    expect(sql).not.toMatch(/CHECK\s*\(\s*scroll_depth_bucket_before_first_cta\s+IN/i);
  });
});
