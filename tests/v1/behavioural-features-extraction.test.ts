/**
 * Sprint 2 PR#1 — pure tests for behavioural-features-v0.2 extractor.
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
 *   - refresh-loop deferred (no refresh_loop column, no SDK boolean
 *     trusted) — Helen-approved D-3 default.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_FEATURE_VERSION,
  DEFAULT_SINCE_HOURS,
  EXPECTED_FEATURE_COUNT_V0_2,
  EXTRACTION_SQL,
  bucketiseInteractionDensity,
  bucketiseScrollDepth,
  parseOptionsFromEnv,
} from '../../scripts/extract-behavioural-features.js';

const ROOT = join(__dirname, '..', '..');
const EXTRACTOR_PATH = join(ROOT, 'scripts', 'extract-behavioural-features.ts');
const MIGRATION_PATH = join(
  ROOT,
  'migrations',
  '009_session_behavioural_features_v0_2.sql',
);
const FORBIDDEN_CODES_PATH = join(ROOT, 'scoring', 'forbidden_codes.yml');

/* --------------------------------------------------------------------------
 * parseOptionsFromEnv
 * ------------------------------------------------------------------------ */

describe('parseOptionsFromEnv — defaults', () => {
  const now = new Date('2026-05-11T12:00:00Z');

  it('uses default FEATURE_VERSION when env unset', () => {
    const opts = parseOptionsFromEnv({}, now);
    expect(opts.feature_version).toBe(DEFAULT_FEATURE_VERSION);
    expect(DEFAULT_FEATURE_VERSION).toBe('behavioural-features-v0.2');
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
  const now = new Date('2026-05-11T12:00:00Z');

  it('FEATURE_VERSION env override', () => {
    const opts = parseOptionsFromEnv({ FEATURE_VERSION: 'behavioural-features-v0.3-rc' }, now);
    expect(opts.feature_version).toBe('behavioural-features-v0.3-rc');
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

  beforeAll: () => {
    /* placeholder */
  };

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
 * EXTRACTION_SQL — structural sweeps
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
    // No literal received_at >= / received_at <= window predicate in session_events.
    expect(body).not.toMatch(/received_at\s*>=\s*\$1/);
    expect(body).not.toMatch(/received_at\s*<=\s*\$2/);
  });
});

describe('EXTRACTION_SQL — deterministic ordering', () => {
  it('uses (received_at, event_id) ordering for ROW_NUMBER endpoints', () => {
    expect(EXTRACTION_SQL).toMatch(/ORDER BY received_at ASC,\s*event_id ASC/);
    expect(EXTRACTION_SQL).toMatch(/ORDER BY received_at DESC,\s*event_id DESC/);
  });

  it('uses (received_at, event_id) ordering for pageview LAG', () => {
    const pvOrdered = EXTRACTION_SQL.match(/pageview_ordered AS \(([\s\S]*?)\),/);
    expect(pvOrdered).not.toBeNull();
    expect(pvOrdered![1]!).toMatch(/ORDER BY received_at ASC,\s*event_id ASC/);
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
 * Forbidden-code sweep — load scoring/forbidden_codes.yml via .patterns
 *   - hard_blocked_code_patterns.patterns applies to emitted reason codes ONLY
 *   - string_patterns_blocked_in_code.patterns applies to source-code strings
 *
 * We use a minimal regex YAML extractor (no PyYAML / node-yaml dependency).
 * We extract the two `patterns:` lists and verify scope-correct behaviour.
 * ------------------------------------------------------------------------ */

function extractYamlPatternList(yamlSrc: string, sectionKey: string): string[] {
  // Match e.g. "hard_blocked_code_patterns:\n  applies_to: ...\n  note: |\n    ...\n  patterns:\n    - 'foo'\n    - 'bar'\n"
  // We find the section header at column 0, then look for "  patterns:" at column 2,
  // then collect "    - " items at column 4 until next column-0 or column-2 sibling.
  const lines = yamlSrc.split('\n');
  let inSection = false;
  let inPatterns = false;
  const patterns: string[] = [];
  for (const line of lines) {
    if (!inSection) {
      if (line.startsWith(sectionKey + ':')) inSection = true;
      continue;
    }
    // Detect end of section: next column-0 token.
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
    // Inside patterns list. Collect items.
    const itemMatch = line.match(/^\s{4,}-\s+"?([^"#]+?)"?\s*(?:#.*)?$/);
    if (itemMatch) {
      patterns.push(itemMatch[1]!.trim());
    } else if (line.trim() === '' || /^\s/.test(line)) {
      // blank or indented continuation; keep scanning
      continue;
    } else {
      // dedent out
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
    expect(yamlSrc).toMatch(/hard_blocked_code_patterns:[\s\S]*?applies_to:\s*emitted_reason_codes_only/);
  });

  it('PR#1 extractor source contains no string matching any of these patterns at column 0 of a reason-code shape', () => {
    // PR#1 emits no reason codes. We assert the extractor source does not contain a
    // reason-code-shaped string literal that matches any pattern. The schema field
    // `verification_method_strength` (from signal-truth-v0.1.md) is intentionally
    // ALLOWED — CF-2 carve-out — and the patterns apply only to emitted reason codes.
    const src = readFileSync(EXTRACTOR_PATH, 'utf8');
    // Strip comments/strings that may legitimately reference these patterns as
    // documentation; for this sweep we just verify no UPPERCASE reason-code shape
    // appears in the source that matches the forbidden patterns.
    for (const pat of patterns) {
      // Tighten each pattern to "reason-code shape": uppercase + underscore.
      // Skip patterns that don't start with ^ or end with $ (they are bare
      // substring matches we keep loose).
      const re = new RegExp(pat);
      // Search for upper-case word matches in the source.
      const candidates = src.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
      for (const cand of candidates) {
        if (re.test(cand)) {
          throw new Error(
            `PR#1 extractor source contains "${cand}" which matches forbidden reason-code pattern /${pat}/`,
          );
        }
      }
    }
  });

  it('the schema field name `verification_method_strength` is NOT blocked (CF-2 carve-out)', () => {
    // The string is allowed because hard_blocked_code_patterns applies only to
    // emitted reason codes. We verify that even though `.*_VERIFIED$` is in the
    // forbidden list, the lowercase schema field `verification_method_strength`
    // does NOT match it (case-sensitive reason-code pattern would not match
    // lowercase substring).
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

  it('PR#1 extractor source contains no forbidden source-code strings', () => {
    const src = readFileSync(EXTRACTOR_PATH, 'utf8');
    // Strip JSDoc/comment lines and string-literal references that mention the
    // forbidden pattern names as documentation rather than as active identifiers.
    // To keep this test conservative we strip /* … */ + // comments.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    for (const pat of patterns) {
      // The YAML stores either bare substrings (e.g. fraud_confirmed) or quoted
      // strings (e.g. "import sklearn"). We grep for both literal occurrences.
      expect(stripped).not.toContain(pat);
    }
  });

  it('PR#1 migration SQL contains no forbidden source-code strings', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    // Strip SQL comments (-- … and /* … */) before sweep.
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

describe('PR#1 source — no scoring / classification / action identifiers', () => {
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

  // Note: 'reason_code' is forbidden as a COLUMN/FIELD identifier in PR#1
  // active code/SQL. It may legitimately appear inside JSDoc that references
  // `scoring/reason_code_dictionary.yml` as a path. The strip-comments pass
  // below handles that.
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

  it('migration SQL (stripped of comments) has no forbidden identifiers', () => {
    const sql = stripSqlComments(readFileSync(MIGRATION_PATH, 'utf8'));
    for (const tok of FORBIDDEN_IDENTIFIERS_NOT_IN_COMMENTS) {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      expect(sql).not.toMatch(re);
    }
  });
});

/* --------------------------------------------------------------------------
 * No Track A / Core AMS / collector v1 imports
 * ------------------------------------------------------------------------ */

describe('PR#1 source — no Track A / Core AMS / collector v1 imports', () => {
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
 * Refresh-loop deferred — D-3 default (PR#1 omits, PR#2 adds later)
 * ------------------------------------------------------------------------ */

describe('Refresh-loop deferred to PR#2 (D-3 default)', () => {
  it('migration SQL does not declare a refresh_loop column', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    // We allow doc comments that say "deferred to PR#2"; we forbid active
    // column declarations.
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/^\s*refresh_loop[\w_]*\s+(BOOLEAN|TEXT|INT|JSONB)/im);
  });

  it('schema.sql block has no refresh_loop column', () => {
    const schema = readFileSync(join(ROOT, 'src', 'db', 'schema.sql'), 'utf8');
    const blockMatch = schema.match(
      /CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2 \(([\s\S]*?)^\);/m,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    expect(block).not.toMatch(/^\s*refresh_loop[\w_]*\s+(BOOLEAN|TEXT|INT|JSONB)/im);
  });

  it('extractor SQL does not write a refresh_loop column', () => {
    expect(EXTRACTION_SQL).not.toMatch(/\brefresh_loop[\w_]*/);
  });

  it('extractor source does not trust an SDK refresh-loop boolean', () => {
    const src = readFileSync(EXTRACTOR_PATH, 'utf8');
    expect(src).not.toMatch(/refresh_loop_observed/);
    expect(src).not.toMatch(/refresh_loop_candidate/);
  });
});

/* --------------------------------------------------------------------------
 * Pure helpers — bucketise functions + expected feature count constant
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

describe('EXPECTED_FEATURE_COUNT_V0_2', () => {
  it('is 12 for v0.2 (matches feature_presence_map / feature_source_map keys)', () => {
    expect(EXPECTED_FEATURE_COUNT_V0_2).toBe(12);
  });

  it('matches the number of keys in feature_presence_map / feature_source_map built by EXTRACTION_SQL', () => {
    // feature_presence_map: each entry is 'key', pl.p_<id> (key followed by
    // a column reference). Count those specifically.
    const presenceBody = (EXTRACTION_SQL.match(
      /jsonb_build_object\(([\s\S]*?)\)\s+AS\s+feature_presence_map/,
    ) ?? [, ''])[1]!;
    const presenceKeys = presenceBody.match(/'([a-z0-9_]+)'\s*,\s*pl\.p_/g) ?? [];
    expect(presenceKeys.length).toBe(EXPECTED_FEATURE_COUNT_V0_2);

    // feature_source_map: each entry is 'key', 'server_derived' OR
    // 'not_extractable'. Count those specifically.
    const sourceBody = (EXTRACTION_SQL.match(
      /jsonb_build_object\(([\s\S]*?)\)\s+AS\s+feature_source_map/,
    ) ?? [, ''])[1]!;
    const sourceKeys =
      sourceBody.match(/'([a-z0-9_]+)'\s*,\s*'(?:server_derived|not_extractable)'/g) ?? [];
    expect(sourceKeys.length).toBe(EXPECTED_FEATURE_COUNT_V0_2);
  });
});

/* --------------------------------------------------------------------------
 * Migration SQL — structure
 * ------------------------------------------------------------------------ */

describe('migration 009 — structure', () => {
  it('exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  const sql = readFileSync(MIGRATION_PATH, 'utf8');

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

  it('does not declare a refresh_loop column', () => {
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/^\s*refresh_loop[\w_]*\s+(BOOLEAN|TEXT|INT|JSONB)/im);
  });

  it('does not introduce hard CHECK constraints on bucket enums', () => {
    expect(sql).not.toMatch(/CHECK\s*\(\s*interaction_density_bucket\s+IN/i);
    expect(sql).not.toMatch(/CHECK\s*\(\s*scroll_depth_bucket_before_first_cta\s+IN/i);
  });
});
