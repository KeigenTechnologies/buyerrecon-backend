/**
 * Sprint 1 PR#7 — scope discipline.
 *
 * Asserts the PR#7 surface didn't drift into Track A / Core AMS / scoring
 * surfaces, didn't bring in production URLs or Playwright, didn't change the
 * pinned v1 barrel, and didn't touch the orchestrator/row-builders/PR#5
 * helper bodies. All file-string assertions — no live HTTP, no DB.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

const PR7_NEW_FILES = [
  'src/collector/v1/config.ts',
  'src/collector/v1/http-context.ts',
  'src/collector/v1/auth-route.ts',
  'src/collector/v1/persistence.ts',
  'src/collector/v1/routes.ts',
  'tests/v1/config.test.ts',
  'tests/v1/http-context.test.ts',
  'tests/v1/auth-route.test.ts',
  'tests/v1/persistence.test.ts',
  'tests/v1/persistence-conflict.test.ts',
  'tests/v1/routes.test.ts',
  'tests/v1/scope-pr7.test.ts',
  'docs/sprint2-pr7-routes-sql-env.md',
] as const;

const READ = (relPath: string): string => readFileSync(join(ROOT, relPath), 'utf8');

describe('PR#7 — new files exist', () => {
  for (const p of PR7_NEW_FILES) {
    it(`exists: ${p}`, () => {
      expect(existsSync(join(ROOT, p))).toBe(true);
    });
  }
});

// Files to check for forbidden tokens. We exclude:
//   - the doc file (disclaimer prose may legitimately mention out-of-scope paths)
//   - this scope-test file itself (the test legitimately names forbidden tokens
//     in order to assert their absence; including itself causes false positives)
const FILES_TO_SCAN = PR7_NEW_FILES.filter(
  (p) => !p.endsWith('.md') && p !== 'tests/v1/scope-pr7.test.ts',
);

describe('PR#7 — no Track A / Core AMS path references in active code or test code', () => {
  for (const p of FILES_TO_SCAN) {
    it(`${p} has no Track A path reference`, () => {
      expect(READ(p).toLowerCase()).not.toContain('ams-qa-behaviour-tests');
    });
    it(`${p} has no Core AMS path reference`, () => {
      expect(READ(p).toLowerCase()).not.toContain('keigentechnologies/ams');
    });
  }
});

describe('PR#7 — no scoring / bot / AI-agent identifiers in active SQL/TS code', () => {
  const FORBIDDEN = [
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
  for (const p of FILES_TO_SCAN) {
    for (const tok of FORBIDDEN) {
      it(`${p} contains no \`${tok}\``, () => {
        const re = new RegExp(`\\b${tok}\\b`, 'i');
        expect(READ(p)).not.toMatch(re);
      });
    }
  }
});

describe('PR#7 — v1 barrel pinned at PR#5a re-exports (regression)', () => {
  const barrel = READ('src/collector/v1/index.ts');

  it('still has exactly 4 `export * from` lines', () => {
    const reExports = barrel.match(/^export\s+\*\s+from\s+['"][^'"]+['"]\s*;?/gm) ?? [];
    expect(reExports).toHaveLength(4);
  });

  it('does not re-export PR#7 modules', () => {
    expect(barrel).not.toMatch(/from\s+['"]\.\/config\.js['"]/);
    expect(barrel).not.toMatch(/from\s+['"]\.\/http-context\.js['"]/);
    expect(barrel).not.toMatch(/from\s+['"]\.\/auth-route\.js['"]/);
    expect(barrel).not.toMatch(/from\s+['"]\.\/persistence\.js['"]/);
    expect(barrel).not.toMatch(/from\s+['"]\.\/routes\.js['"]/);
    expect(barrel).not.toMatch(/from\s+['"]\.\/orchestrator\.js['"]/);
  });
});

describe('PR#7 / PR#8b — app.ts factory mounts v1 router BEFORE global express.json', () => {
  // PR#8b moved the middleware wiring out of src/server.ts into src/app.ts
  // via createApp(...). The mount-order assertion now lives on the factory
  // file; src/server.ts only invokes the factory inside start().
  // Strip /* … */ block comments and // line comments before regex matching
  // so JSDoc that mentions banned identifiers doesn't false-positive the
  // assertions below.
  const stripTsComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const appFactory = stripTsComments(READ('src/app.ts'));
  const server = stripTsComments(READ('src/server.ts'));

  it('app.ts contains createV1Router import', () => {
    expect(appFactory).toMatch(/from\s+['"]\.\/collector\/v1\/routes\.js['"]/);
  });

  it('app.ts mounts v1 router before app.use(express.json(', () => {
    const v1MountIdx = appFactory.search(/app\.use\(\s*\n?\s*createV1Router\(/);
    const jsonMountIdx = appFactory.search(/app\.use\(express\.json\(/);
    expect(v1MountIdx).toBeGreaterThan(-1);
    expect(jsonMountIdx).toBeGreaterThan(-1);
    expect(v1MountIdx).toBeLessThan(jsonMountIdx);
  });

  it('app.ts CORS allowedHeaders includes Authorization (both casings)', () => {
    expect(appFactory).toMatch(/Authorization/);
    expect(appFactory).toMatch(/authorization/);
  });

  it('server.ts adopts createApp (proof of PR#8b refactor)', () => {
    expect(server).toMatch(/from\s+['"]\.\/app\.js['"]/);
    expect(server).toMatch(/\bcreateApp\s*\(/);
  });

  it('server.ts no longer calls loadV1ConfigFromEnv at module top level (PR#8b)', () => {
    // The loader call must live inside start(), not at module top. We assert
    // by checking that every loadV1ConfigFromEnv() invocation in the file is
    // textually after the `async function start(` declaration. If start()
    // doesn't exist, fail. If a loader call appears before start(), fail.
    const startIdx = server.search(/async\s+function\s+start\s*\(/);
    expect(startIdx).toBeGreaterThan(-1);
    const loaderCalls: number[] = [];
    const re = /loadV1ConfigFromEnv\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(server)) !== null) loaderCalls.push(m.index);
    expect(loaderCalls.length).toBeGreaterThan(0);
    for (const idx of loaderCalls) {
      expect(idx).toBeGreaterThan(startIdx);
    }
  });
});

describe('PR#7 — no Playwright / live URLs in tests', () => {
  // Exclude this scope-test from URL/playwright scanning — it legitimately
  // names the production hosts in order to assert their absence elsewhere.
  const TEST_FILES = PR7_NEW_FILES.filter(
    (p) => p.startsWith('tests/') && p !== 'tests/v1/scope-pr7.test.ts',
  );
  const PROD_URL_PATTERNS = [
    'buyerrecon.com',
    'keigen.co.uk',
    'fidcern.com',
    'realbuyergrowth.com',
    'timetopoint.com',
  ];

  for (const p of TEST_FILES) {
    it(`${p} does NOT import playwright`, () => {
      expect(READ(p)).not.toMatch(/from\s+['"]playwright['"]/);
      expect(READ(p)).not.toMatch(/from\s+['"]@playwright\/test['"]/);
    });
    for (const host of PROD_URL_PATTERNS) {
      it(`${p} does NOT reference live host ${host}`, () => {
        expect(READ(p).toLowerCase()).not.toContain(host);
      });
    }
  }
});

describe('PR#7 — orchestrator / row-builders / PR#5 helpers unchanged', () => {
  // The orchestrator's contract markers must remain present.
  const orchestrator = READ('src/collector/v1/orchestrator.ts');
  it('orchestrator still exports runRequest', () => {
    expect(orchestrator).toMatch(/export\s+function\s+runRequest\b/);
  });
  it('orchestrator still asserts payload_sha256 contract in JSDoc', () => {
    expect(orchestrator).toMatch(/payload_sha256\s*=\s*payloadSha256/);
  });

  const rowBuilders = READ('src/collector/v1/row-builders.ts');
  it('row-builders still exports the three builders', () => {
    expect(rowBuilders).toMatch(/export\s+const\s+buildIngestRequestRow/);
    expect(rowBuilders).toMatch(/export\s+const\s+buildAcceptedEventRow/);
    expect(rowBuilders).toMatch(/export\s+const\s+buildRejectedEventRow/);
  });

  const dedupe = READ('src/collector/v1/dedupe.ts');
  it('dedupe module is present (PR#5b-2 intra-batch dedupe)', () => {
    expect(dedupe).toMatch(/duplicate_client_event_id/);
  });
});

describe('PR#7 — no auto-deletion / schema redesign / migration in PR#7 files', () => {
  // Same scope-test self-exclusion as above.
  for (const p of FILES_TO_SCAN) {
    const s = READ(p);
    it(`${p} contains no DELETE FROM / TRUNCATE / DROP TABLE / DROP INDEX`, () => {
      expect(s).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(s).not.toMatch(/\bTRUNCATE\b/i);
      expect(s).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(s).not.toMatch(/\bDROP\s+INDEX\b/i);
    });
  }
});

describe('PR#7 — no fake IP fallback in active code', () => {
  for (const p of PR7_NEW_FILES) {
    if (p.endsWith('.md')) continue;
    if (p.startsWith('tests/')) continue; // tests legitimately reference null IP and assertions
    const s = READ(p);
    it(`${p} does not assign "0.0.0.0" / "unknown" to ip`, () => {
      // Disallow any literal that looks like a synthesised IP default in active code.
      expect(s).not.toMatch(/ip\s*[:=]\s*['"]0\.0\.0\.0['"]/);
      expect(s).not.toMatch(/ip\s*[:=]\s*['"]unknown['"]/);
    });
  }
});
