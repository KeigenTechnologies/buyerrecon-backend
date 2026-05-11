/**
 * Sprint 1 PR#6 — accepted_events cross-request dedupe unique index smoke tests.
 * Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA
 * scoring), NOT Core AMS.
 *
 * Repo convention: file/text-level assertions only. No DB connection. The
 * real-DB concurrent-load test (50 SDK retries → exactly 1 accepted row)
 * lives in PR#8's verification suite per handoff §2.12 check #3 and
 * §4.1 acceptance #8.
 *
 * Regex discipline:
 *   - Many assertions operate on a `migrationActive` slice that strips SQL
 *     line comments (`-- …`) so the "no active BEGIN/COMMIT/DROP" checks do
 *     not false-positive on the rollback prose in the file footer.
 *   - The CREATE statement is anchored against `\bCREATE UNIQUE INDEX` so it
 *     does not match the legacy partial unique index in src/db/schema.sql or
 *     prose like "this CREATE UNIQUE INDEX …".
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '007_accepted_events_dedup_index.sql');
const PREFLIGHT_PATH = join(ROOT, 'docs', 'sql', 'preflight', '007_accepted_events_dedup_duplicates.sql');
const DOC_PATH       = join(ROOT, 'docs', 'sprint2-pr6-accepted-events-dedup-index.md');
const SCHEMA_PATH    = join(ROOT, 'src', 'db', 'schema.sql');
const BARREL_PATH    = join(ROOT, 'src', 'collector', 'v1', 'index.ts');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const preflight = readFileSync(PREFLIGHT_PATH, 'utf8');
const doc       = readFileSync(DOC_PATH, 'utf8');
const schema    = readFileSync(SCHEMA_PATH, 'utf8');
const barrel    = readFileSync(BARREL_PATH, 'utf8');

/** Strip `-- …` line comments so structural checks operate on active SQL only. */
function stripSqlLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

const migrationActive = stripSqlLineComments(migration);
const preflightActive = stripSqlLineComments(preflight);

describe('PR#6 — migration file exists', () => {
  it('1. migration file exists at migrations/007_accepted_events_dedup_index.sql', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migration.length).toBeGreaterThan(0);
  });
});

describe('PR#6 — migration DDL shape (active SQL only)', () => {
  it('2. contains an active CREATE UNIQUE INDEX CONCURRENTLY statement', () => {
    expect(migrationActive).toMatch(/\bCREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\b/i);
  });

  it('3. index name is exactly accepted_events_dedup', () => {
    expect(migrationActive).toMatch(
      /\bCREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+accepted_events_dedup\b/i,
    );
  });

  it('4. target table is accepted_events', () => {
    expect(migrationActive).toMatch(
      /\baccepted_events_dedup\s+ON\s+accepted_events\s*\(/i,
    );
  });

  it('5. column order is exactly (workspace_id, site_id, client_event_id)', () => {
    expect(migrationActive).toMatch(
      /ON\s+accepted_events\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*client_event_id\s*\)/i,
    );
  });

  it('6. IF NOT EXISTS is present on the CREATE statement', () => {
    expect(migrationActive).toMatch(
      /\bCREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\b/i,
    );
  });

  it('7. partial WHERE clause includes workspace_id IS NOT NULL', () => {
    expect(migrationActive).toMatch(/\bworkspace_id\s+IS\s+NOT\s+NULL\b/i);
  });

  it('8. partial WHERE clause includes site_id IS NOT NULL', () => {
    expect(migrationActive).toMatch(/\bsite_id\s+IS\s+NOT\s+NULL\b/i);
  });

  it('9. partial WHERE clause includes client_event_id IS NOT NULL', () => {
    expect(migrationActive).toMatch(/\bclient_event_id\s+IS\s+NOT\s+NULL\b/i);
  });

  it('contains exactly one active CREATE statement (no other DDL)', () => {
    const createMatches = migrationActive.match(/\bCREATE\b/gi) ?? [];
    expect(createMatches.length).toBe(1);
  });
});

describe('PR#6 — migration must not run inside a transaction (CONCURRENTLY)', () => {
  it('10a. no active BEGIN', () => {
    expect(migrationActive).not.toMatch(/\bBEGIN\b/i);
  });

  it('10b. no active COMMIT', () => {
    expect(migrationActive).not.toMatch(/\bCOMMIT\b/i);
  });

  it('10c. no active ROLLBACK statement (rollback only appears in line comments)', () => {
    expect(migrationActive).not.toMatch(/\bROLLBACK\b/i);
  });

  it('10d. no active START TRANSACTION', () => {
    expect(migrationActive).not.toMatch(/\bSTART\s+TRANSACTION\b/i);
  });
});

describe('PR#6 — migration must not perform data mutation', () => {
  it('11a. no active DELETE', () => {
    expect(migrationActive).not.toMatch(/\bDELETE\b/i);
  });

  it('11b. no active UPDATE', () => {
    expect(migrationActive).not.toMatch(/\bUPDATE\b/i);
  });

  it('11c. no active INSERT', () => {
    expect(migrationActive).not.toMatch(/\bINSERT\b/i);
  });

  it('11d. no active ALTER TABLE', () => {
    expect(migrationActive).not.toMatch(/\bALTER\s+TABLE\b/i);
  });

  it('11e. no active TRUNCATE', () => {
    expect(migrationActive).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('11f. no active DROP (rollback DROP only in commented footer)', () => {
    expect(migrationActive).not.toMatch(/\bDROP\b/i);
  });
});

describe('PR#6 — rollback documented in comments', () => {
  it('12. commented rollback contains DROP INDEX CONCURRENTLY IF EXISTS accepted_events_dedup', () => {
    expect(migration).toMatch(
      /DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+accepted_events_dedup/i,
    );
  });

  it('the DROP appears only in commented context, not as active SQL', () => {
    expect(migrationActive).not.toMatch(/DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+accepted_events_dedup/i);
  });
});

describe('PR#6 — migration header references PR#6 scope', () => {
  it('mentions §3.PR#6 (handoff anchor)', () => {
    expect(migration).toMatch(/§3\.PR#6/);
  });

  it('mentions the three-part architecture rule', () => {
    expect(migration.toLowerCase()).toContain('three-part architecture');
  });

  it('mentions Track B', () => {
    expect(migration).toMatch(/Track\s+B/i);
  });

  it('warns the migration must not be folded into schema.sql / initDb', () => {
    expect(migration.toLowerCase()).toMatch(/(schema\.sql|initdb)/i);
    expect(migration).toMatch(/(do NOT|MUST NOT|must not)/);
  });
});

describe('PR#6 — preflight SQL file', () => {
  it('13. preflight SQL exists at docs/sql/preflight/007_accepted_events_dedup_duplicates.sql', () => {
    expect(existsSync(PREFLIGHT_PATH)).toBe(true);
    expect(preflight.length).toBeGreaterThan(0);
  });

  it('14. preflight groups on (workspace_id, site_id, client_event_id) in that order', () => {
    expect(preflightActive).toMatch(
      /GROUP\s+BY\s+workspace_id\s*,\s*site_id\s*,\s*client_event_id/i,
    );
  });

  it('15. preflight uses HAVING COUNT(*) > 1', () => {
    expect(preflightActive).toMatch(/HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1/i);
  });

  it('preflight includes duplicate_count column alias', () => {
    expect(preflightActive).toMatch(/\bduplicate_count\b/i);
  });

  it('preflight includes MIN(received_at) and MAX(received_at)', () => {
    expect(preflightActive).toMatch(/MIN\s*\(\s*received_at\s*\)/i);
    expect(preflightActive).toMatch(/MAX\s*\(\s*received_at\s*\)/i);
  });

  it('preflight includes a sample of event_ids', () => {
    expect(preflightActive).toMatch(/sample_event_ids/i);
    expect(preflightActive).toMatch(/event_id/i);
  });

  it('preflight WHERE matches the partial-index predicate (all three IS NOT NULL)', () => {
    expect(preflightActive).toMatch(/\bworkspace_id\s+IS\s+NOT\s+NULL\b/i);
    expect(preflightActive).toMatch(/\bsite_id\s+IS\s+NOT\s+NULL\b/i);
    expect(preflightActive).toMatch(/\bclient_event_id\s+IS\s+NOT\s+NULL\b/i);
  });
});

describe('PR#6 — preflight SQL is strictly read-only', () => {
  it('16a. no active DELETE', () => {
    expect(preflightActive).not.toMatch(/\bDELETE\b/i);
  });

  it('16b. no active UPDATE', () => {
    expect(preflightActive).not.toMatch(/\bUPDATE\b/i);
  });

  it('16c. no active INSERT', () => {
    expect(preflightActive).not.toMatch(/\bINSERT\b/i);
  });

  it('16d. no active TRUNCATE', () => {
    expect(preflightActive).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('16e. no active ALTER TABLE', () => {
    expect(preflightActive).not.toMatch(/\bALTER\s+TABLE\b/i);
  });

  it('16f. no active DROP', () => {
    expect(preflightActive).not.toMatch(/\bDROP\b/i);
  });

  it('16g. no active CREATE', () => {
    expect(preflightActive).not.toMatch(/\bCREATE\b/i);
  });
});

describe('PR#6 — docs file', () => {
  it('17. docs file exists at docs/sprint2-pr6-accepted-events-dedup-index.md', () => {
    expect(existsSync(DOC_PATH)).toBe(true);
    expect(doc.length).toBeGreaterThan(0);
  });

  it('docs reference PR#7 and PR#8 dependency / deferral', () => {
    expect(doc).toMatch(/PR#7/);
    expect(doc).toMatch(/PR#8/);
  });

  it('docs reference Track B (and not Track A / Core AMS as PR#6 scope)', () => {
    expect(doc).toMatch(/Track\s+B/i);
  });

  it('docs explain CONCURRENTLY rationale and operational warning', () => {
    expect(doc.toLowerCase()).toContain('concurrently');
    expect(doc.toLowerCase()).toMatch(/(preflight|operational warning|migration window)/);
  });
});

describe('PR#6 — src/db/schema.sql must NOT carry the new index', () => {
  it('18. schema.sql does not contain accepted_events_dedup', () => {
    expect(schema).not.toMatch(/\baccepted_events_dedup\b/);
  });

  it('schema.sql still carries the legacy idx_accepted_dedup_client_event partial unique index (untouched)', () => {
    expect(schema).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_accepted_dedup_client_event/i,
    );
  });
});

describe('PR#6 — v1 barrel pinned at PR#5a re-exports (no PR#6 surface)', () => {
  it('19a. barrel has exactly 4 `export * from` lines', () => {
    const reExports = barrel.match(/^export\s+\*\s+from\s+['"][^'"]+['"]\s*;?/gm) ?? [];
    expect(reExports.length).toBe(4);
  });

  it('19b. barrel does not export anything new for PR#6', () => {
    expect(barrel).not.toMatch(/dedup-index|accepted-events-dedup|pr6/i);
  });

  it('19c. barrel does not re-export orchestrator (still gated for PR#7)', () => {
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+['"]\.\/orchestrator\.js['"]/);
  });
});

describe('PR#6 — scope discipline (no Track A / Core AMS / scoring / bot / AI-agent)', () => {
  // SQL files have line-comment-stripped "active" slices. The markdown doc is
  // documentation prose and legitimately names Track A / Core AMS / scoring
  // tokens in disclaimer sentences (per the PR spec it explicitly tells the
  // reader what is NOT included). Per the prompt's "avoid over-broad tests
  // that match disclaimer prose" rule, the scoring-token and Track-path
  // assertions therefore scope to ACTIVE SQL slices only. Markdown prose
  // cannot execute; the operational risk being guarded against is an active
  // code/SQL surface, which the SQL slices fully cover.
  const sqlActiveSlices: ReadonlyArray<{ name: string; content: string }> = [
    { name: 'migrations/007 (active SQL)', content: migrationActive },
    { name: 'docs/sql/preflight/007 (active SQL)', content: preflightActive },
  ];

  const FORBIDDEN_ACTIVE_TOKENS = [
    'risk_score',
    'classification',
    'recommended_action',
    'bot_score',
    'agent_score',
    'behavioural_score',
    'behavior_score',
    'is_bot',
    'ai_agent',
  ];

  for (const { name, content } of sqlActiveSlices) {
    for (const token of FORBIDDEN_ACTIVE_TOKENS) {
      it(`20a. no active "${token}" in ${name}`, () => {
        const re = new RegExp(`\\b${token}\\b`, 'i');
        expect(content).not.toMatch(re);
      });
    }
  }

  for (const { name, content } of sqlActiveSlices) {
    it(`20b. no Track A path reference (ams-qa-behaviour-tests) in ${name}`, () => {
      expect(content.toLowerCase()).not.toContain('ams-qa-behaviour-tests');
    });

    it(`20c. no Core AMS path reference (keigentechnologies/ams) in ${name}`, () => {
      expect(content.toLowerCase()).not.toContain('keigentechnologies/ams');
    });
  }
});
