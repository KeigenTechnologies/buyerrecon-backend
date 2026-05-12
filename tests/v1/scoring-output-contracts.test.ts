/**
 * Sprint 2 PR#3 — pure tests for scoring_output_lane_a /
 * scoring_output_lane_b contract layer.
 *
 * No DB connection. Tests cover:
 *   - migration 011 structural assertions (tables, CHECKs, natural key,
 *     role-existence assertions, no CREATE ROLE, no dangerous ALTER ROLE,
 *     no INSERT INTO, no CASCADE in rollback)
 *   - schema.sql mirrors both tables
 *   - verification_score carve-out file allowlist (the ONE allowed
 *     score-shaped identifier; generic score-shaped names stay blocked)
 *   - reason_codes (plural) is the column name; singular reason_code is
 *     not used as a column
 *   - forbidden-term sweep against scoring/forbidden_codes.yml `.patterns`
 *   - no imports from collector / app / server / auth / Track A / AMS
 *   - no writer code in active source
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const MIGRATION_011_PATH = join(ROOT, 'migrations', '011_scoring_output_lanes.sql');
const SCHEMA_PATH = join(ROOT, 'src', 'db', 'schema.sql');
const PR3_TEST_FILE = join(ROOT, 'tests', 'v1', 'scoring-output-contracts.test.ts');
const PR3_LINT_FILE = join(ROOT, 'tests', 'v1', 'scoring-output-contracts.lint.test.ts');
const PR3_DBTEST_FILE = join(ROOT, 'tests', 'v1', 'db', 'scoring-output-contracts.dbtest.ts');
const PR3_PLAN_DOC = join(ROOT, 'docs', 'sprint2-pr3-scoring-output-contracts-planning.md');
const PR3_IMPL_DOC = join(ROOT, 'docs', 'sprint2-pr3-scoring-output-contracts.md');
const FORBIDDEN_CODES_PATH = join(ROOT, 'scoring', 'forbidden_codes.yml');

const PR3_VERIFICATION_SQL_A = join(ROOT, 'docs', 'sql', 'verification', '10_scoring_output_lane_a_invariants.sql');
const PR3_VERIFICATION_SQL_B = join(ROOT, 'docs', 'sql', 'verification', '11_scoring_output_lane_b_invariants.sql');

const SETUP_PATH = join(ROOT, 'tests', 'v1', 'db', '_setup.ts');

function stripSqlComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}
function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/* --------------------------------------------------------------------------
 * Migration 011 exists + structure
 * ------------------------------------------------------------------------ */

describe('migration 011 — file presence', () => {
  it('migrations/011_scoring_output_lanes.sql exists', () => {
    expect(existsSync(MIGRATION_011_PATH)).toBe(true);
  });
});

describe('migration 011 — required tables', () => {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  it('CREATE TABLE IF NOT EXISTS scoring_output_lane_a', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+scoring_output_lane_a/);
  });
  it('CREATE TABLE IF NOT EXISTS scoring_output_lane_b', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+scoring_output_lane_b/);
  });
});

describe('migration 011 — Lane A column shape', () => {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  const block = sql.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_a \(([\s\S]*?)\n\);/);
  it('Lane A CREATE TABLE block parses', () => {
    expect(block).not.toBeNull();
  });
  const body = (block?.[1] ?? '').toLowerCase();
  for (const col of [
    'scoring_output_lane_a_id',
    'workspace_id', 'site_id', 'session_id', 'scoring_version',
    'source_feature_version',
    'verification_score', 'evidence_band', 'action_recommendation',
    'reason_codes', 'evidence_refs',
    'knob_version_id', 'record_only',
    'created_at', 'updated_at',
  ]) {
    it(`Lane A has column ${col}`, () => {
      expect(body).toContain(col);
    });
  }
  it('Lane A: verification_score CHECK between 0 and 99', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*verification_score\s+BETWEEN\s+0\s+AND\s+99\s*\)/i);
  });
  it("Lane A: evidence_band CHECK IN ('low','medium')", () => {
    expect(sql).toMatch(/CHECK\s*\(\s*evidence_band\s+IN\s*\(\s*'low'\s*,\s*'medium'\s*\)\s*\)/i);
  });
  it("Lane A: action_recommendation CHECK IN ('record_only','review') with DEFAULT 'record_only'", () => {
    expect(sql).toMatch(/action_recommendation\s+TEXT\s+NOT NULL\s+DEFAULT\s+'record_only'/i);
    expect(sql).toMatch(/CHECK\s*\(\s*action_recommendation\s+IN\s*\(\s*'record_only'\s*,\s*'review'\s*\)\s*\)/i);
  });
  it("Lane A: reason_codes CHECK jsonb_typeof = 'array' with DEFAULT '[]'", () => {
    expect(sql).toMatch(/reason_codes\s+JSONB\s+NOT NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*reason_codes\s*\)\s*=\s*'array'\s*\)/i);
  });
  it("Lane A: evidence_refs CHECK jsonb_typeof = 'array' with DEFAULT '[]'", () => {
    expect(sql).toMatch(/evidence_refs\s+JSONB\s+NOT NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*evidence_refs\s*\)\s*=\s*'array'\s*\)/i);
  });
  it('Lane A: natural key UNIQUE (workspace_id, site_id, session_id, scoring_version)', () => {
    expect(sql).toMatch(
      /scoring_output_lane_a_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*scoring_version\s*\)/i,
    );
  });
});

describe('migration 011 — Lane B column shape', () => {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  const block = sql.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_b \(([\s\S]*?)\n\);/);
  it('Lane B CREATE TABLE block parses', () => {
    expect(block).not.toBeNull();
  });
  const body = (block?.[1] ?? '').toLowerCase();
  for (const col of [
    'scoring_output_lane_b_id',
    'workspace_id', 'site_id', 'session_id', 'scoring_version',
    'agent_family', 'verification_method', 'verification_method_strength',
    'reason_codes', 'evidence_refs',
    'record_only',
    'created_at', 'updated_at',
  ]) {
    it(`Lane B has column ${col}`, () => {
      expect(body).toContain(col);
    });
  }
  it("Lane B: verification_method CHECK IN ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none')", () => {
    expect(sql).toMatch(
      /CHECK\s*\(\s*verification_method\s+IN\s*\(\s*'reverse_dns'\s*,\s*'ip_validation'\s*,\s*'web_bot_auth'\s*,\s*'partner_allowlist'\s*,\s*'none'\s*\)\s*\)/i,
    );
  });
  it('Lane B: verification_method_strength CHECK IS NULL (v1 reserved-not-emitted, OD-6)', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*verification_method_strength\s+IS\s+NULL\s*\)/i);
  });
  it("Lane B: reason_codes CHECK jsonb_typeof = 'array'", () => {
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*reason_codes\s*\)\s*=\s*'array'\s*\)/i);
  });
  it("Lane B: evidence_refs CHECK jsonb_typeof = 'array'", () => {
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*evidence_refs\s*\)\s*=\s*'array'\s*\)/i);
  });
  it('Lane B: natural key UNIQUE (workspace_id, site_id, session_id, scoring_version)', () => {
    expect(sql).toMatch(
      /scoring_output_lane_b_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*scoring_version\s*\)/i,
    );
  });
});

/* --------------------------------------------------------------------------
 * Migration 011 — role-existence assertions + no CREATE ROLE / dangerous ALTER ROLE
 * ------------------------------------------------------------------------ */

describe('migration 011 — role-existence assertions (OD-8)', () => {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  for (const role of [
    'buyerrecon_migrator',
    'buyerrecon_scoring_worker',
    'buyerrecon_customer_api',
    'buyerrecon_internal_readonly',
  ]) {
    it(`asserts role ${role} exists via pg_roles + RAISE EXCEPTION`, () => {
      const re = new RegExp(
        `NOT EXISTS \\(SELECT 1 FROM pg_roles WHERE rolname\\s*=\\s*'${role}'\\)[\\s\\S]*?RAISE EXCEPTION`,
      );
      expect(sql).toMatch(re);
    });
  }
  it('contains at least 4 pg_roles WHERE rolname = checks (one per canonical role)', () => {
    const matches = sql.match(/pg_roles\s+WHERE\s+rolname\s*=\s*'/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});

describe('migration 011 — Hard-Rule-I post-migration assertion', () => {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  it('calls has_table_privilege for buyerrecon_customer_api on scoring_output_lane_b and aborts on TRUE', () => {
    // Explicit ::name / ::regclass / ::text casts are required so
    // Postgres can resolve the overloaded function.
    expect(sql).toMatch(
      /has_table_privilege\(\s*'buyerrecon_customer_api'(?:::(?:text|name))?\s*,\s*'scoring_output_lane_b'(?:::(?:text|regclass))?\s*,\s*'SELECT'(?:::text)?\s*\)[\s\S]*?RAISE EXCEPTION/,
    );
  });
});

describe('migration 011 — forbidden statements', () => {
  const raw = readFileSync(MIGRATION_011_PATH, 'utf8');
  const stripped = stripSqlComments(raw);

  it('contains no CREATE ROLE in active DDL', () => {
    expect(stripped).not.toMatch(/\bCREATE\s+ROLE\b/i);
  });

  for (const danger of ['SUPERUSER', 'CREATEROLE', 'CREATEDB', 'BYPASSRLS', 'PASSWORD']) {
    it(`contains no ALTER ROLE … ${danger}`, () => {
      const re = new RegExp(`\\bALTER\\s+ROLE\\b[^;]*\\b${danger}\\b`, 'i');
      expect(stripped).not.toMatch(re);
    });
  }

  it('contains no INSERT INTO statement targeting any table', () => {
    expect(stripped).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it('contains no UPDATE / DELETE / TRUNCATE against any source table', () => {
    for (const verb of ['UPDATE', 'DELETE FROM', 'TRUNCATE']) {
      for (const tbl of [
        'accepted_events',
        'rejected_events',
        'ingest_requests',
        'session_features',
        'session_behavioural_features_v0_2',
      ]) {
        const re = new RegExp(`${verb}\\s+${tbl}\\b`, 'i');
        expect(stripped).not.toMatch(re);
      }
    }
  });

  it('does not modify migrations 001–010 (sanity: file lives at 011)', () => {
    expect(MIGRATION_011_PATH.endsWith('011_scoring_output_lanes.sql')).toBe(true);
  });
});

describe('migration 011 — rollback comment uses DROP TABLE IF EXISTS, no CASCADE', () => {
  const raw = readFileSync(MIGRATION_011_PATH, 'utf8');
  it('rollback comment contains DROP TABLE IF EXISTS for both tables', () => {
    expect(raw).toMatch(/DROP TABLE IF EXISTS\s+scoring_output_lane_a/);
    expect(raw).toMatch(/DROP TABLE IF EXISTS\s+scoring_output_lane_b/);
  });
  it('active DDL contains no CASCADE (rollback narrative may still use the word "CASCADE" as a do-not-use warning)', () => {
    // Comments are stripped first so the operator-facing "no CASCADE"
    // warning in the rollback narrative does not trip the rule.
    expect(stripSqlComments(raw)).not.toMatch(/CASCADE/i);
  });
});

/* --------------------------------------------------------------------------
 * schema.sql mirrors both tables
 * ------------------------------------------------------------------------ */

describe('schema.sql — PR#3 tables mirrored (append-only)', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  it('contains CREATE TABLE IF NOT EXISTS scoring_output_lane_a', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+scoring_output_lane_a/);
  });
  it('contains CREATE TABLE IF NOT EXISTS scoring_output_lane_b', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+scoring_output_lane_b/);
  });
  it('Lane A natural-key UNIQUE present in schema.sql', () => {
    expect(schema).toMatch(
      /scoring_output_lane_a_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*scoring_version\s*\)/i,
    );
  });
  it('Lane B natural-key UNIQUE present in schema.sql', () => {
    expect(schema).toMatch(
      /scoring_output_lane_b_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*scoring_version\s*\)/i,
    );
  });
  it('schema.sql still contains pre-PR#3 tables (no accidental delete)', () => {
    // Spot-check three tables that PR#3 must NOT have removed.
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+accepted_events/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+session_features/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+session_behavioural_features_v0_2/);
  });
});

/* --------------------------------------------------------------------------
 * verification_score carve-out — file allowlist sweep
 * ------------------------------------------------------------------------ */

/**
 * Walks the repository (skipping node_modules, .git, dist, build, coverage)
 * and returns every TS / JS / SQL / MD path under the repo root.
 */
function walkRepoSource(root: string): string[] {
  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.vercel',
    '.turbo', '.cache', 'tmp', '.husky', '.idea', '.vscode',
  ]);
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (!SKIP_DIRS.has(name)) stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs|sql|md|yml|yaml)$/.test(name)) continue;
      out.push(full);
    }
  }
  return out;
}

describe('verification_score carve-out — active-source allowlist', () => {
  /**
   * The carve-out is enforced against ACTIVE SOURCE only — TS/JS/SQL
   * under migrations/, src/, scripts/, scoring/. Docs (.md, .yml in
   * docs/) and tests/ are not scanned: docs are prose explainers and
   * may legitimately name the column; tests may legitimately reference
   * it as a value-under-test.
   *
   * Within active source, the allowlist is:
   *   - migrations/011_scoring_output_lanes.sql   (Lane A column)
   *   - src/db/schema.sql                          (Lane A mirror)
   */
  const ALLOWLIST = new Set<string>([
    MIGRATION_011_PATH,
    SCHEMA_PATH,
  ]);

  const ACTIVE_PREFIXES = ['migrations/', 'src/', 'scripts/', 'scoring/'];
  const ACTIVE_EXTS = /\.(ts|tsx|js|mjs|cjs|sql)$/;

  it('verification_score appears in active source only inside the PR#3 allowlist', () => {
    const offenders: string[] = [];
    for (const f of walkRepoSource(ROOT)) {
      const rel = f.slice(ROOT.length + 1);
      if (!ACTIVE_PREFIXES.some((p) => rel.startsWith(p))) continue;
      if (!ACTIVE_EXTS.test(f)) continue;
      if (ALLOWLIST.has(f)) continue;
      // Strip comments — A0 / signal-truth boundary explainers in
      // existing files may name the column in JSDoc / SQL `--` notes.
      const raw = readFileSync(f, 'utf8');
      const stripped = /\.sql$/.test(f) ? stripSqlComments(raw) : stripTsComments(raw);
      if (/\bverification_score\b/.test(stripped)) {
        offenders.push(rel);
      }
    }
    expect(offenders, `verification_score found outside allowlist:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('Generic score-shaped identifiers remain forbidden in active source', () => {
  /**
   * Scope: TS/JS/SQL under migrations/, src/, scripts/, scoring/.
   * Excluded: tests/ (test files necessarily name the forbidden tokens
   * as part of their own assertion logic) and docs/ (prose).
   *
   * Comments are stripped first so existing JSDoc / SQL `--` boundary
   * explainers in PR#0..PR#2 files do not trip the rule.
   */
  const ACTIVE_PREFIXES = ['migrations/', 'src/', 'scripts/', 'scoring/'];
  const ACTIVE_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|sql)$/;
  const FORBIDDEN = [
    'risk_score',
    'buyer_score',
    'intent_score',
    'bot_score',
    'human_score',
    'fraud_score',
    'confidence_band',
    'recommended_action',
    'classification',
    'is_bot',
    'is_agent',
    'ai_agent',
    'is_human',
    'buyer_intent',
    'lead_quality',
    'company_enrichment',
    'ip_enrichment',
  ];

  for (const tok of FORBIDDEN) {
    it(`active source contains no ${tok}`, () => {
      const re = new RegExp(`\\b${tok}\\b`, 'i');
      const offenders: string[] = [];
      for (const f of walkRepoSource(ROOT)) {
        const rel = f.slice(ROOT.length + 1);
        if (!ACTIVE_PREFIXES.some((p) => rel.startsWith(p))) continue;
        if (!ACTIVE_EXTENSIONS.test(f)) continue;
        const raw = readFileSync(f, 'utf8');
        const stripped = /\.sql$/.test(f) ? stripSqlComments(raw) : stripTsComments(raw);
        if (re.test(stripped)) {
          offenders.push(rel);
        }
      }
      expect(offenders, `${tok} found in active source:\n${offenders.join('\n')}`).toEqual([]);
    });
  }
});

/* --------------------------------------------------------------------------
 * reason_codes plural, no singular reason_code column
 * ------------------------------------------------------------------------ */

describe('reason_codes (plural) is the column name; singular reason_code is forbidden as a column', () => {
  const sql11 = readFileSync(MIGRATION_011_PATH, 'utf8');
  it('migration 011 declares reason_codes JSONB (plural) on each table', () => {
    const occurrences = sql11.match(/\breason_codes\s+JSONB\b/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
  it('migration 011 contains no `reason_code` (singular) as a column declaration', () => {
    const stripped = stripSqlComments(sql11);
    // Match a typed column declaration: `reason_code` followed by TEXT/JSONB/etc.
    expect(stripped).not.toMatch(/\breason_code\s+(TEXT|JSONB|INT|VARCHAR|BIGINT|BOOLEAN)\b/i);
  });
  it('PR#3 schema.sql block contains no `reason_code` (singular) as a column declaration', () => {
    /**
     * Schema scope: only the two PR#3 lane-output CREATE TABLE blocks.
     * Pre-existing tables (e.g. `rejected_events`) legitimately carry a
     * `reason_code TEXT` column from PR#0 / Sprint 1 and are out of
     * scope for this PR#3 invariant.
     */
    const schema = stripSqlComments(readFileSync(SCHEMA_PATH, 'utf8'));
    const laneA = schema.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_a \(([\s\S]*?)\n\);/);
    const laneB = schema.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_b \(([\s\S]*?)\n\);/);
    expect(laneA).not.toBeNull();
    expect(laneB).not.toBeNull();
    for (const block of [laneA![1]!, laneB![1]!]) {
      expect(block).not.toMatch(/\breason_code\s+(TEXT|JSONB|INT|VARCHAR|BIGINT|BOOLEAN)\b/i);
    }
  });
});

/* --------------------------------------------------------------------------
 * forbidden-term sweep against scoring/forbidden_codes.yml (.patterns)
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
    const m = line.match(/^\s{4,}-\s+"?([^"#]+?)"?\s*(?:#.*)?$/);
    if (m) {
      patterns.push(m[1]!.trim());
    } else if (line.trim() === '' || /^\s/.test(line)) {
      continue;
    } else {
      inPatterns = false;
      inSection = false;
    }
  }
  return patterns;
}

describe('forbidden_codes.yml — hard_blocked_code_patterns scope (emitted reason codes only)', () => {
  const yamlSrc = readFileSync(FORBIDDEN_CODES_PATH, 'utf8');
  it('scope annotation is emitted_reason_codes_only', () => {
    expect(yamlSrc).toMatch(
      /hard_blocked_code_patterns:[\s\S]*?applies_to:\s*emitted_reason_codes_only/,
    );
  });
  it('PR#3 migration + schema + tests contain no UPPERCASE reason-code-shaped string matching any pattern', () => {
    const patterns = extractYamlPatternList(yamlSrc, 'hard_blocked_code_patterns');
    expect(patterns.length).toBeGreaterThanOrEqual(5);
    const targets = [
      MIGRATION_011_PATH,
      SCHEMA_PATH,
      PR3_TEST_FILE,
      PR3_LINT_FILE,
      PR3_DBTEST_FILE,
    ];
    for (const path of targets) {
      const text = readFileSync(path, 'utf8');
      const stripped = /\.sql$/.test(path) ? stripSqlComments(text) : stripTsComments(text);
      const candidates = stripped.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
      for (const pat of patterns) {
        const re = new RegExp(pat);
        for (const cand of candidates) {
          if (re.test(cand)) {
            throw new Error(`${path}: identifier "${cand}" matches forbidden reason-code pattern /${pat}/`);
          }
        }
      }
    }
  });
});

describe('forbidden_codes.yml — string_patterns_blocked_in_code (source-code strings)', () => {
  const yamlSrc = readFileSync(FORBIDDEN_CODES_PATH, 'utf8');
  it('scope annotation is source_code_strings_only', () => {
    expect(yamlSrc).toMatch(
      /string_patterns_blocked_in_code:[\s\S]*?applies_to:\s*source_code_strings_only/,
    );
  });
  it('PR#3 active SQL (migration + schema.sql PR#3 block) contains no blocked source strings', () => {
    /**
     * Scope: active SQL only. The test files themselves
     * (scoring-output-contracts.test.ts / lint.test.ts /
     * dbtest.ts) necessarily contain the forbidden tokens as quoted
     * test fixtures and assertion strings, so they are excluded.
     */
    const patterns = extractYamlPatternList(yamlSrc, 'string_patterns_blocked_in_code');
    expect(patterns.length).toBeGreaterThanOrEqual(10);
    const migration = stripSqlComments(readFileSync(MIGRATION_011_PATH, 'utf8'));
    const schemaFull = stripSqlComments(readFileSync(SCHEMA_PATH, 'utf8'));
    const laneA = schemaFull.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_a \(([\s\S]*?)\n\);/)?.[1] ?? '';
    const laneB = schemaFull.match(/CREATE TABLE IF NOT EXISTS scoring_output_lane_b \(([\s\S]*?)\n\);/)?.[1] ?? '';
    const pr3Schema = laneA + '\n' + laneB;
    const targets: Array<{ label: string; body: string }> = [
      { label: 'migrations/011_scoring_output_lanes.sql', body: migration },
      { label: 'src/db/schema.sql (PR#3 blocks only)', body: pr3Schema },
    ];
    for (const { label, body } of targets) {
      for (const pat of patterns) {
        expect(body, `${label}: contains blocked source string "${pat}"`).not.toContain(pat);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * No imports from collector / app / server / auth / Track A / AMS
 * ------------------------------------------------------------------------ */

describe('PR#3 source — no collector / app / server / auth / Track A / AMS imports', () => {
  const sources = [PR3_TEST_FILE, PR3_LINT_FILE, PR3_DBTEST_FILE];
  /**
   * Match `import ... from '<path>'` and `from '<path>'` clauses
   * specifically — not bare string mentions. The PR#3 pure-test file
   * has to quote forbidden package names inside its own regex
   * assertions (which would otherwise be self-triggering).
   */
  const importsOf = (src: string): string[] => {
    const out: string[] = [];
    const re = /\bfrom\s+(['"])([^'"]+)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[2]!);
    return out;
  };
  for (const path of sources) {
    const src = readFileSync(path, 'utf8');
    const rel = path.slice(ROOT.length + 1);
    const imports = importsOf(src);
    it(`${rel}: no import from src/collector/v1`, () => {
      expect(imports.some((s) => s.includes('src/collector/v1') || s.includes('collector/v1'))).toBe(false);
    });
    it(`${rel}: no import from src/app, src/server, src/auth`, () => {
      expect(imports.some((s) => /(^|\/)src\/(app|server|auth)(\/|$|\.)/.test(s))).toBe(false);
    });
    it(`${rel}: no import from ams-qa-behaviour-tests or keigentechnologies/AMS`, () => {
      expect(imports.some((s) => /ams-qa-behaviour-tests/i.test(s))).toBe(false);
      expect(imports.some((s) => /keigentechnologies\/AMS/i.test(s))).toBe(false);
    });
  }
});

/* --------------------------------------------------------------------------
 * No writer code in active source — repo-wide grep
 * ------------------------------------------------------------------------ */

describe('PR#3 — no writer code in active source', () => {
  it('no INSERT INTO scoring_output_lane_a / scoring_output_lane_b outside DB tests, fixtures, or docs prose', () => {
    const ACTIVE_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|sql)$/;
    const TEST_DIR = join(ROOT, 'tests');
    const DOCS_DIR = join(ROOT, 'docs');
    const offenders: string[] = [];
    for (const f of walkRepoSource(ROOT)) {
      // Inserts inside test files and fixtures are allowed (test boundary).
      if (f.startsWith(TEST_DIR)) continue;
      // Markdown / docs are allowed (prose explainers); active extensions only.
      if (f.startsWith(DOCS_DIR)) continue;
      if (!ACTIVE_EXTENSIONS.test(f)) continue;
      const raw = readFileSync(f, 'utf8');
      const stripped = /\.sql$/.test(f) ? stripSqlComments(raw) : stripTsComments(raw);
      if (/INSERT\s+INTO\s+scoring_output_lane_(a|b)\b/i.test(stripped)) {
        offenders.push(f.slice(ROOT.length + 1));
      }
    }
    expect(offenders, `writer code found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
