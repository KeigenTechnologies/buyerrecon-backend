/**
 * Sprint 2 PR#17k — shouldSkipDbInit() + src/server.ts startup-skip guard.
 *
 * Pure tests. No DB connection. No network. No env mutation. The tests
 * import shouldSkipDbInit from src/db/client.ts (which imports pg and
 * constructs a pool at module top, but pg.Pool does not connect until a
 * query is issued — these tests never query). The src/server.ts shape
 * assertions follow the existing PR#8b pattern from
 * tests/v1/app-factory.test.ts: read the file as a string and assert on
 * its post-comment-strip shape so we do not import src/server.ts (which
 * is not import-safe).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shouldSkipDbInit } from '../src/db/client.js';

const ROOT = join(__dirname, '..');
const SERVER_PATH = join(ROOT, 'src', 'server.ts');
const CLIENT_PATH = join(ROOT, 'src', 'db', 'client.ts');

function stripTsComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/* --------------------------------------------------------------------------
 * shouldSkipDbInit — pure helper unit tests
 * ------------------------------------------------------------------------ */

describe('PR#17k — shouldSkipDbInit()', () => {
  it('returns false when SKIP_DB_INIT is unset', () => {
    expect(shouldSkipDbInit({})).toBe(false);
  });

  it('returns true only for the exact literal "true"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'true' })).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'false' })).toBe(false);
  });

  it('returns false for "FALSE"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'FALSE' })).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'TRUE' })).toBe(false);
  });

  it('returns false for "True" (case-sensitive)', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'True' })).toBe(false);
  });

  it('returns false for "1"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: '1' })).toBe(false);
  });

  it('returns false for "0"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: '0' })).toBe(false);
  });

  it('returns false for the empty string', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: '' })).toBe(false);
  });

  it('returns false for "yes"', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: 'yes' })).toBe(false);
  });

  it('returns false for whitespace " true "', () => {
    expect(shouldSkipDbInit({ SKIP_DB_INIT: ' true ' })).toBe(false);
  });

  it('reads from process.env by default', () => {
    // We do not mutate process.env in tests; we just exercise the default
    // parameter path. SKIP_DB_INIT is not "true" in the test env, so this
    // must be false. (If a developer's local env had SKIP_DB_INIT=true,
    // they would see this fail — that is a deliberate signal.)
    expect(shouldSkipDbInit()).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * src/server.ts shape — guard wiring and skip-message redaction
 * ------------------------------------------------------------------------ */

describe('PR#17k — src/server.ts skip-init guard wiring', () => {
  const rawSource = readFileSync(SERVER_PATH, 'utf8');
  const source = stripTsComments(rawSource);

  it('imports shouldSkipDbInit from db/client', () => {
    expect(source).toMatch(/shouldSkipDbInit/);
    expect(source).toMatch(/from\s+['"]\.\/db\/client\.js['"]/);
  });

  it('calls shouldSkipDbInit() before initDb()', () => {
    const skipIdx = source.search(/\bshouldSkipDbInit\s*\(/);
    const initIdx = source.search(/\binitDb\s*\(/);
    expect(skipIdx).toBeGreaterThan(-1);
    expect(initIdx).toBeGreaterThan(-1);
    expect(skipIdx).toBeLessThan(initIdx);
  });

  it('guards initDb() inside the start() function', () => {
    const startIdx = source.search(/async\s+function\s+start\s*\(/);
    const guardIdx = source.search(/\bshouldSkipDbInit\s*\(/);
    const initIdx = source.search(/\binitDb\s*\(/);
    expect(startIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(startIdx);
    expect(initIdx).toBeGreaterThan(startIdx);
  });

  it('skip log message contains no DSN / token / pepper / password material', () => {
    // The skip message lives as a string literal in src/server.ts. It must
    // not embed env values, DSN fragments, or secret-like substrings.
    const match = source.match(/['"`][^'"`]*schema bootstrap skipped[^'"`]*['"`]/i);
    expect(match).toBeTruthy();
    const msg = match![0];
    expect(msg).not.toMatch(
      /postgres:\/\/|DATABASE_URL|pepper|password|\btoken\b|hash=[a-f0-9]{16,}|10\.[0-9]+\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\./i,
    );
  });
});

/* --------------------------------------------------------------------------
 * src/db/client.ts — shouldSkipDbInit export shape
 * ------------------------------------------------------------------------ */

describe('PR#17k — src/db/client.ts exports shouldSkipDbInit', () => {
  const rawSource = readFileSync(CLIENT_PATH, 'utf8');
  const source = stripTsComments(rawSource);

  it('exports a function named shouldSkipDbInit', () => {
    expect(source).toMatch(/export\s+function\s+shouldSkipDbInit\b/);
  });

  it('compares to the literal "true" (strict equality, not truthiness)', () => {
    expect(source).toMatch(/SKIP_DB_INIT\s*===\s*['"]true['"]/);
  });

  it('does not introduce DDL-grant or role-broadening text', () => {
    expect(source).not.toMatch(/GRANT\s+/i);
    expect(source).not.toMatch(/CREATE\s+ROLE/i);
    expect(source).not.toMatch(/ALTER\s+ROLE/i);
    expect(source).not.toMatch(/SUPERUSER/i);
  });
});
