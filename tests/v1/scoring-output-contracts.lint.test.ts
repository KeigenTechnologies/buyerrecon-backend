/**
 * Sprint 2 PR#3 — CI SQL linter for Hard Rule H.
 *
 * Hard Rule H (signal-truth-v0.1 §10):
 *   "No JOIN between scoring_output_lane_a and scoring_output_lane_b in
 *    any query"
 *
 * This pure test implements a minimal SQL JOIN detector that flags:
 *   (a) explicit JOIN — `… scoring_output_lane_a … JOIN … scoring_output_lane_b …`
 *       (and the symmetric a-JOIN-b ordering)
 *   (b) comma cross-product — `FROM … scoring_output_lane_a , … scoring_output_lane_b …`
 *
 * The detector scans every SQL statement (delimited by semicolons) in
 * the repository's active source files (.sql in migrations/, plus
 * embedded SQL inside .ts/.js files in src/ and scripts/). It does NOT
 * scan test files or documentation; those are allowed to mention both
 * table names (e.g. as fixtures, plan-doc references, prose explainers).
 *
 * The test also includes inline positive- and negative-control SQL
 * fixtures asserted directly so the detector behaviour is self-tested.
 *
 * Wired into `npm test` automatically by living under tests/v1.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const LANE_A = 'scoring_output_lane_a';
const LANE_B = 'scoring_output_lane_b';

/* --------------------------------------------------------------------------
 * Detector
 * ------------------------------------------------------------------------ */

interface JoinViolation {
  kind: 'explicit_join' | 'comma_cross_product' | 'cte_aliased_or_implicit_join';
  statement: string;
}

/**
 * Strip SQL comments and split a SQL document into statements by `;`.
 * Statements are roughly normalised: comments removed, whitespace
 * collapsed to single spaces. Conservative: this is a defence
 * mechanism, false positives are preferred over false negatives.
 */
function splitSqlStatements(src: string): string[] {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const noLine = noBlock.replace(/--[^\n]*/g, ' ');
  // Preserve DO $$ … $$ blocks as a single statement boundary by leaving
  // semicolons inside dollar-quoted strings — but to keep the detector
  // simple, we just split on every `;`. Any DO block referencing both
  // lane tables would still be flagged on the substring check below,
  // which is the conservative outcome.
  return noLine
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

/**
 * Test whether a single SQL statement is a Hard-Rule-H violation.
 * Three violation shapes are recognised:
 *
 * 1. Explicit JOIN: both table names appear directly with a `JOIN`
 *    keyword between them, in either order.
 * 2. Comma cross-product: both table names appear in a `FROM` clause
 *    separated by a comma (with optional aliases / whitespace / newlines).
 * 3. CTE-aliased / implicit join (conservative catch-all): a single
 *    statement that references BOTH table names AND contains a `JOIN`
 *    keyword anywhere. This catches cases such as
 *      WITH a AS (SELECT * FROM scoring_output_lane_a),
 *           b AS (SELECT * FROM scoring_output_lane_b)
 *      SELECT * FROM a JOIN b USING (session_id);
 *    where neither raw table name appears adjacent to the JOIN
 *    keyword. Hard Rule H forbids ANY query joining the two surfaces,
 *    so a conservative false-positive (e.g. two side-by-side single-
 *    lane SELECTs that happen to share a statement with an unrelated
 *    JOIN against a third table) is preferred over a false-negative.
 *    Single-lane statements and separate single-lane statements
 *    (split by `;`) are not affected.
 */
export function detectLaneJoin(statement: string): JoinViolation | null {
  const lower = statement.toLowerCase();
  const hasA = lower.includes(LANE_A);
  const hasB = lower.includes(LANE_B);
  if (!hasA || !hasB) return null;

  // (1) Explicit JOIN. Either ordering. Allow any aliases and any number
  //     of tokens between the table name and the JOIN keyword.
  const explicitAB = new RegExp(
    String.raw`\b${LANE_A}\b[\s\S]*?\bjoin\b[\s\S]*?\b${LANE_B}\b`,
    'i',
  );
  const explicitBA = new RegExp(
    String.raw`\b${LANE_B}\b[\s\S]*?\bjoin\b[\s\S]*?\b${LANE_A}\b`,
    'i',
  );
  if (explicitAB.test(statement) || explicitBA.test(statement)) {
    return { kind: 'explicit_join', statement };
  }

  // (2) Comma cross-product. Look for a FROM clause that lists both
  //     tables separated by a comma. Allow optional alias tokens between
  //     the table name and the comma.
  const commaAB = new RegExp(
    String.raw`\bfrom\b[\s\S]*?\b${LANE_A}\b\s*(?:as\s+\w+\s*|\w+\s*)?,[\s\S]*?\b${LANE_B}\b`,
    'i',
  );
  const commaBA = new RegExp(
    String.raw`\bfrom\b[\s\S]*?\b${LANE_B}\b\s*(?:as\s+\w+\s*|\w+\s*)?,[\s\S]*?\b${LANE_A}\b`,
    'i',
  );
  if (commaAB.test(statement) || commaBA.test(statement)) {
    return { kind: 'comma_cross_product', statement };
  }

  // (3) Conservative CTE-aliased / implicit join. If a single statement
  //     references both lane surfaces AND contains a JOIN keyword
  //     anywhere (in any position relative to the table names), flag
  //     it. This catches CTE-aliased forms, subquery alias forms, and
  //     any other arrangement where the raw table names don't appear
  //     adjacent to the JOIN. Statement splitting on `;` already
  //     prevents this rule from flagging two side-by-side single-lane
  //     SELECTs sitting in the same file.
  if (/\bjoin\b/i.test(statement)) {
    return { kind: 'cte_aliased_or_implicit_join', statement };
  }

  return null;
}

/**
 * Scan a multi-statement SQL document and return every violation.
 */
export function scanSqlDocument(src: string): JoinViolation[] {
  const out: JoinViolation[] = [];
  for (const stmt of splitSqlStatements(src)) {
    const v = detectLaneJoin(stmt);
    if (v) out.push(v);
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Inline self-tests: positive + negative fixtures
 * ------------------------------------------------------------------------ */

describe('Hard Rule H linter — inline fixtures', () => {
  const POSITIVE_EXPLICIT = `
    SELECT a.scoring_output_lane_a_id, b.scoring_output_lane_b_id
      FROM scoring_output_lane_a a
      JOIN scoring_output_lane_b b
        ON a.session_id = b.session_id;
  `;
  const POSITIVE_EXPLICIT_REVERSE = `
    SELECT *
      FROM scoring_output_lane_b b
      LEFT JOIN scoring_output_lane_a a
        ON a.session_id = b.session_id;
  `;
  const POSITIVE_COMMA = `
    SELECT a.session_id
      FROM scoring_output_lane_a a, scoring_output_lane_b b
     WHERE a.session_id = b.session_id;
  `;
  const NEGATIVE_LANE_A_SINGLE = `
    SELECT * FROM scoring_output_lane_a WHERE workspace_id = '__test_ws_pr3__';
  `;
  const NEGATIVE_LANE_B_SINGLE = `
    SELECT * FROM scoring_output_lane_b WHERE workspace_id = '__test_ws_pr3__';
  `;
  const NEGATIVE_BOTH_TABLES_BUT_NO_JOIN = `
    -- Two separate queries in the same file are allowed.
    SELECT count(*) FROM scoring_output_lane_a;
    SELECT count(*) FROM scoring_output_lane_b;
  `;
  const NEGATIVE_TEXT_MENTION_ONLY = `
    -- Comment-only mention of scoring_output_lane_a and scoring_output_lane_b
    -- in the same comment block must not trigger; comments are stripped first.
    SELECT 1;
  `;
  /**
   * Codex blocker (CTE-aliased cross-lane JOIN). Both lane surfaces
   * are referenced inside CTE bodies, and the final SELECT joins the
   * CTE aliases — the raw table names never appear adjacent to the
   * JOIN keyword. The conservative detector flags this as
   * `cte_aliased_or_implicit_join`.
   */
  const POSITIVE_CTE_ALIASED = `
    WITH a AS (SELECT * FROM scoring_output_lane_a),
         b AS (SELECT * FROM scoring_output_lane_b)
    SELECT * FROM a JOIN b USING (session_id);
  `;
  /**
   * Negative case for the conservative CTE rule: two CTE bodies, each
   * pulling from a single lane surface, but the final SELECT references
   * only one alias — no JOIN against the other. (Statement-splitting on
   * `;` cannot help here because the whole thing is one statement;
   * absence of `JOIN` is what spares it.)
   */
  const NEGATIVE_CTE_NO_FINAL_JOIN = `
    WITH a AS (SELECT * FROM scoring_output_lane_a),
         b AS (SELECT * FROM scoring_output_lane_b)
    SELECT * FROM a WHERE a.workspace_id = '__test_ws_pr3__';
  `;

  it('positive: explicit JOIN A→B is flagged', () => {
    expect(scanSqlDocument(POSITIVE_EXPLICIT).length).toBeGreaterThanOrEqual(1);
    expect(scanSqlDocument(POSITIVE_EXPLICIT)[0]!.kind).toBe('explicit_join');
  });

  it('positive: explicit JOIN B→A is flagged', () => {
    expect(scanSqlDocument(POSITIVE_EXPLICIT_REVERSE).length).toBeGreaterThanOrEqual(1);
    expect(scanSqlDocument(POSITIVE_EXPLICIT_REVERSE)[0]!.kind).toBe('explicit_join');
  });

  it('positive: comma cross-product is flagged', () => {
    expect(scanSqlDocument(POSITIVE_COMMA).length).toBeGreaterThanOrEqual(1);
    expect(scanSqlDocument(POSITIVE_COMMA)[0]!.kind).toBe('comma_cross_product');
  });

  it('positive: CTE-aliased cross-lane JOIN is flagged (Codex blocker)', () => {
    const violations = scanSqlDocument(POSITIVE_CTE_ALIASED);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]!.kind).toBe('cte_aliased_or_implicit_join');
  });

  it('negative: single-lane query (A only) is NOT flagged', () => {
    expect(scanSqlDocument(NEGATIVE_LANE_A_SINGLE)).toEqual([]);
  });

  it('negative: single-lane query (B only) is NOT flagged', () => {
    expect(scanSqlDocument(NEGATIVE_LANE_B_SINGLE)).toEqual([]);
  });

  it('negative: separate single-lane queries in the same file are NOT flagged', () => {
    expect(scanSqlDocument(NEGATIVE_BOTH_TABLES_BUT_NO_JOIN)).toEqual([]);
  });

  it('negative: comment-only mention does not trigger (comments stripped)', () => {
    expect(scanSqlDocument(NEGATIVE_TEXT_MENTION_ONLY)).toEqual([]);
  });

  it('negative: two CTE bodies but no final JOIN between them is NOT flagged', () => {
    expect(scanSqlDocument(NEGATIVE_CTE_NO_FINAL_JOIN)).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * Repo-wide scan
 *
 * Targets:
 *   migrations/*.sql                — all migration files
 *   docs/sql/verification/*.sql     — verification SQL
 *   src/db/schema.sql               — canonical schema
 *   src/**\/*.ts + scripts/**\/*.ts — embedded SQL strings (template literals)
 *
 * Skipped:
 *   tests/                          — fixtures, dbtests, this linter file
 *   node_modules / .git / dist / build / coverage
 *   docs/ outside docs/sql/verification (prose explainers may mention both
 *     names — see PR#3 planning doc)
 * ------------------------------------------------------------------------ */

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.vercel',
  '.turbo', '.cache', 'tmp', '.husky', '.idea', '.vscode',
  'tests',  // test files are allowed to mention both names
]);

function walkRepoFiles(root: string, accept: (path: string) => boolean): string[] {
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
      if (accept(full)) out.push(full);
    }
  }
  return out;
}

describe('Hard Rule H linter — repo-wide sweep', () => {
  it('no SQL file in migrations/, docs/sql/verification/, or src/db/schema.sql joins scoring_output_lane_a with scoring_output_lane_b', () => {
    const sqlFiles = walkRepoFiles(ROOT, (path) => {
      if (!path.endsWith('.sql')) return false;
      // Only scan the directories that ship active queries.
      const rel = path.slice(ROOT.length + 1);
      return (
        rel.startsWith('migrations/') ||
        rel.startsWith('docs/sql/verification/') ||
        rel === join('src', 'db', 'schema.sql') ||
        rel === 'src/db/schema.sql'
      );
    });
    const offenders: string[] = [];
    for (const f of sqlFiles) {
      const src = readFileSync(f, 'utf8');
      const violations = scanSqlDocument(src);
      if (violations.length > 0) {
        offenders.push(`${f.slice(ROOT.length + 1)} (${violations.length} violation${violations.length === 1 ? '' : 's'})`);
      }
    }
    expect(offenders, `Hard Rule H violations:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no TS / JS source under src/ or scripts/ contains an embedded SQL string joining the two lane tables', () => {
    const tsFiles = walkRepoFiles(ROOT, (path) => {
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(path)) return false;
      const rel = path.slice(ROOT.length + 1);
      return rel.startsWith('src/') || rel.startsWith('scripts/');
    });
    const offenders: string[] = [];
    for (const f of tsFiles) {
      const src = readFileSync(f, 'utf8');
      // Embedded SQL strings: backtick template literals + single-quoted
      // strings. Scan the entire file as if it were SQL — the detector
      // requires both table names AND a JOIN keyword, so non-SQL text is
      // ignored by construction.
      const violations = scanSqlDocument(src);
      if (violations.length > 0) {
        offenders.push(`${f.slice(ROOT.length + 1)} (${violations.length} violation${violations.length === 1 ? '' : 's'})`);
      }
    }
    expect(offenders, `Hard Rule H violations in TS source:\n${offenders.join('\n')}`).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * No PR#3 writer in active source
 *   - No INSERT INTO scoring_output_lane_a outside tests/ and docs/.
 *   - No INSERT INTO scoring_output_lane_b outside tests/ and docs/.
 *   - Migration 011 contains no INSERT INTO anything.
 * ------------------------------------------------------------------------ */

describe('PR#3 — no writer in active source', () => {
  it('no INSERT INTO scoring_output_lane_a / scoring_output_lane_b in migrations/, src/, or scripts/', () => {
    const active = walkRepoFiles(ROOT, (path) => {
      if (!/\.(ts|tsx|js|mjs|cjs|sql)$/.test(path)) return false;
      const rel = path.slice(ROOT.length + 1);
      return rel.startsWith('migrations/') || rel.startsWith('src/') || rel.startsWith('scripts/');
    });
    const offenders: string[] = [];
    for (const f of active) {
      const src = readFileSync(f, 'utf8');
      const stripped = /\.sql$/.test(f)
        ? src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
        : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      if (/INSERT\s+INTO\s+scoring_output_lane_(a|b)\b/i.test(stripped)) {
        offenders.push(f.slice(ROOT.length + 1));
      }
    }
    expect(offenders, `writer code found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('migration 011 contains no INSERT INTO statement against ANY table', () => {
    const sql = readFileSync(
      join(ROOT, 'migrations', '011_scoring_output_lanes.sql'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });
});
