/**
 * Sprint 2 PR#4 — pure tests for the scoring contract loader / startup guard.
 *
 * No DB connection. No HTTP. No process side-effects beyond
 * `fs.readFileSync` on the live YAML files and the fixtures.
 *
 * Test boundary: malformed fixtures under
 * `tests/fixtures/scoring-contracts/`. Each fixture replaces ONE of the
 * three contract slots while the other two are loaded live; this scopes
 * each test to a single hard issue.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import {
  assertActiveScoringSourceCleanOrThrow,
  assertReasonCodeStructurallyAllowed,
  assertRuleReferencesOrThrow,
  assertScoringContractsOrThrow,
  checkActiveScoringSourceAgainstForbiddenPatterns,
  isReasonCodeStructurallyAllowed,
  loadScoringContracts,
  validateRuleReferences,
  validateScoringContracts,
  type ForbiddenCodes,
  type ReasonCodeDictionary,
  type ScoringContracts,
  type VersionContract,
} from '../../src/scoring/contracts.js';

const ROOT = join(__dirname, '..', '..');
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'scoring-contracts');

function liveContracts(): ScoringContracts {
  return loadScoringContracts({ rootDir: ROOT });
}
function loadFixtureYaml<T>(name: string): T {
  return YAML.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as T;
}
function withVersion(v: unknown): ScoringContracts {
  const c = liveContracts();
  return { ...c, version: v as VersionContract };
}
function withDictionary(d: unknown): ScoringContracts {
  const c = liveContracts();
  return { ...c, dictionary: d as ReasonCodeDictionary };
}
function withForbidden(f: unknown): ScoringContracts {
  const c = liveContracts();
  return { ...c, forbidden: f as ForbiddenCodes };
}

/* --------------------------------------------------------------------------
 * 1-3. Live contracts load + validate + assert
 * ------------------------------------------------------------------------ */

describe('PR#4 — live scoring contracts', () => {
  it('loadScoringContracts() loads the three YAML files without error', () => {
    const c = loadScoringContracts({ rootDir: ROOT });
    expect(c.version.scoring_version).toBe('s2.v1.0');
    expect(c.version.reason_code_dictionary_version).toBe('rc-v0.1');
    expect(c.version.forbidden_codes_version).toBe('forbidden-v0.1');
    expect(c.dictionary.metadata.version).toBe('rc-v0.1');
    expect(c.forbidden.metadata.version).toBe('forbidden-v0.1');
  });

  it('validateScoringContracts() on live contracts returns []', () => {
    const c = liveContracts();
    expect(validateScoringContracts(c)).toEqual([]);
  });

  it('assertScoringContractsOrThrow() on live contracts returns the loaded shape', () => {
    const c = assertScoringContractsOrThrow({ rootDir: ROOT });
    expect(c).toBeDefined();
    expect(c.version.status).toBe('record_only');
    expect(c.version.automated_action_enabled).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 4. version.yml malformed cases
 * ------------------------------------------------------------------------ */

describe('PR#4 — version.yml malformed fixtures', () => {
  it("status !== 'record_only' yields HARD issue at version.status", () => {
    const v = loadFixtureYaml<VersionContract>('version-status-live.yml');
    const issues = validateScoringContracts(withVersion(v));
    const target = issues.find((i) => i.contract === 'version' && i.path === 'status');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/record_only/);
  });

  it('automated_action_enabled === true yields HARD issue', () => {
    const v = loadFixtureYaml<VersionContract>('version-automated-action-true.yml');
    const issues = validateScoringContracts(withVersion(v));
    const target = issues.find((i) => i.path === 'automated_action_enabled');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });

  it('reason_code_dictionary_version mismatch yields HARD issue at dictionary.metadata.version', () => {
    const v = loadFixtureYaml<VersionContract>('version-mismatch-dictionary.yml');
    const issues = validateScoringContracts(withVersion(v));
    const target = issues.find((i) => i.contract === 'dictionary' && i.path === 'metadata.version');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/rc-vBAD/);
  });

  /**
   * Codex blocker fix: activation flags are detected by prefix family,
   * not just by exact name. Each of the four fixtures below carries
   * one boolean-true activation key that the canonical exact-match
   * list would have missed.
   */
  it.each([
    ['version-live-scoring-enabled.yml',            'live_scoring_enabled'],
    ['version-production-rollout-enabled.yml',      'production_rollout_enabled'],
    ['version-customer-facing-report-enabled.yml',  'customer_facing_report_enabled'],
    ['version-enabled-for-customers-beta.yml',      'enabled_for_customers_beta'],
  ] as const)('prefix-family activation key %s (true) yields HARD issue at the exact key', (fixture, key) => {
    const v = loadFixtureYaml<VersionContract>(fixture);
    const issues = validateScoringContracts(withVersion(v));
    const target = issues.find((i) => i.contract === 'version' && i.path === key);
    expect(target, `expected HARD issue at version.${key}`).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/RECORD_ONLY/);
    expect(target!.message).toMatch(new RegExp(key));
  });

  it('activation-flag rule does NOT fire when the key is set to false (boolean false is tolerated)', () => {
    // Synthetic case (not a fixture file): valid version.yml shape
    // with a same-family key set to false. The matcher must skip it.
    const synth: VersionContract & Record<string, unknown> = {
      scoring_version:                's2.v1.0',
      reason_code_dictionary_version: 'rc-v0.1',
      forbidden_codes_version:        'forbidden-v0.1',
      status:                         'record_only',
      automated_action_enabled:       false,
      live_scoring_enabled:           false,
      production_rollout_enabled:     false,
      customer_facing_report_enabled: false,
      enabled_for_customers_beta:     false,
      action_enabled:                 false,
    };
    const issues = validateScoringContracts(withVersion(synth));
    // None of the activation-family keys may appear as an issue path
    // when their values are boolean false.
    for (const k of [
      'live_scoring_enabled',
      'production_rollout_enabled',
      'customer_facing_report_enabled',
      'enabled_for_customers_beta',
      'action_enabled',
    ]) {
      expect(issues.find((i) => i.path === k), `${k}=false must not raise`).toBeUndefined();
    }
  });

  it('exact-name action_enabled=true is still HARD (not subsumed by a family)', () => {
    const synth: VersionContract & Record<string, unknown> = {
      scoring_version:                's2.v1.0',
      reason_code_dictionary_version: 'rc-v0.1',
      forbidden_codes_version:        'forbidden-v0.1',
      status:                         'record_only',
      automated_action_enabled:       false,
      action_enabled:                 true,
    };
    const issues = validateScoringContracts(withVersion(synth));
    const target = issues.find((i) => i.contract === 'version' && i.path === 'action_enabled');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 5. reason_code_dictionary.yml malformed cases
 * ------------------------------------------------------------------------ */

describe('PR#4 — reason_code_dictionary.yml malformed fixtures', () => {
  it('code missing `meaning` yields HARD issue at codes.<code>.meaning', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-missing-meaning.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find(
      (i) => i.contract === 'dictionary' && i.path === 'codes.A_TEST_MISSING_MEANING.meaning',
    );
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/meaning/);
  });

  it('code with legacy can_trigger_action field yields HARD issue', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-legacy-can-trigger-action.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find(
      (i) => i.contract === 'dictionary' && i.path === 'codes.A_TEST_LEGACY.can_trigger_action',
    );
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/legacy/);
  });

  it('can_trigger_automated_action === true yields HARD issue', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-automated-action-true.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find(
      (i) => i.path === 'codes.A_TEST_AUTO_ACTION.can_trigger_automated_action',
    );
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });

  it('UX_* code in codes:` yields HARD issue', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-ux-code.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find((i) => i.path === 'codes.UX_FAKE_CODE');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/A_\/B_\/REVIEW_\/OBS_/);
  });

  it('OBS_* count > 7 yields HARD issue', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-obs-over-cap.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find((i) => i.path === 'codes (OBS_*)');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/exceeds v1 cap/);
  });

  it('unknown code prefix yields HARD issue', () => {
    const d = loadFixtureYaml<ReasonCodeDictionary>('dictionary-unknown-code-prefix.yml');
    const issues = validateScoringContracts(withDictionary(d));
    const target = issues.find((i) => i.path === 'codes.X_UNKNOWN_PREFIX');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 6. forbidden_codes.yml malformed cases
 * ------------------------------------------------------------------------ */

describe('PR#4 — forbidden_codes.yml malformed fixtures', () => {
  it('missing hard_blocked_code_patterns.applies_to yields HARD issue', () => {
    const f = loadFixtureYaml<ForbiddenCodes>('forbidden-missing-applies-to.yml');
    const issues = validateScoringContracts(withForbidden(f));
    const target = issues.find((i) => i.path === 'hard_blocked_code_patterns.applies_to');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });

  it('wrong hard_blocked_code_patterns.applies_to yields HARD issue', () => {
    const f = loadFixtureYaml<ForbiddenCodes>('forbidden-wrong-applies-to.yml');
    const issues = validateScoringContracts(withForbidden(f));
    const target = issues.find((i) => i.path === 'hard_blocked_code_patterns.applies_to');
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/emitted_reason_codes_only/);
  });

  it('missing hard_blocked_verification_method_strength_values_in_v1 yields HARD issue', () => {
    const f = loadFixtureYaml<ForbiddenCodes>('forbidden-missing-strength-list.yml');
    const issues = validateScoringContracts(withForbidden(f));
    const target = issues.find(
      (i) => i.path === 'hard_blocked_verification_method_strength_values_in_v1',
    );
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
  });

  it("strength list present but missing 'strong' yields HARD issue", () => {
    const f = loadFixtureYaml<ForbiddenCodes>('forbidden-strength-list-missing-strong.yml');
    const issues = validateScoringContracts(withForbidden(f));
    const target = issues.find(
      (i) => i.path === 'hard_blocked_verification_method_strength_values_in_v1',
    );
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/'strong'/);
  });

  it('invalid regex in hard_blocked_code_patterns.patterns yields HARD issue', () => {
    const f = loadFixtureYaml<ForbiddenCodes>('forbidden-invalid-regex.yml');
    const issues = validateScoringContracts(withForbidden(f));
    const target = issues.find((i) => /^hard_blocked_code_patterns\.patterns\[\d+\]$/.test(i.path));
    expect(target).toBeDefined();
    expect(target!.hard).toBe(true);
    expect(target!.message).toMatch(/invalid regex/);
  });
});

/* --------------------------------------------------------------------------
 * 7. isReasonCodeStructurallyAllowed
 * ------------------------------------------------------------------------ */

describe('PR#4 — isReasonCodeStructurallyAllowed (structure only; not lane policy)', () => {
  const c = liveContracts();

  it('known A_* code passes (A_REFRESH_BURST exists in the live dictionary)', () => {
    expect(isReasonCodeStructurallyAllowed(c, 'A_REFRESH_BURST')).toBe(true);
  });

  it('known B_* code passes structurally (B_DECLARED_AI_CRAWLER) — lane permission lives in future workers, not PR#4', () => {
    expect(isReasonCodeStructurallyAllowed(c, 'B_DECLARED_AI_CRAWLER')).toBe(true);
  });

  it('nonexistent code fails', () => {
    expect(isReasonCodeStructurallyAllowed(c, 'A_DOES_NOT_EXIST')).toBe(false);
  });

  it('fabricated hard-blocked code fails (matches .*_VERIFIED$ pattern)', () => {
    expect(isReasonCodeStructurallyAllowed(c, 'A_BUYER_VERIFIED')).toBe(false);
  });

  it('assertReasonCodeStructurallyAllowed throws for nonexistent code', () => {
    expect(() => assertReasonCodeStructurallyAllowed(c, 'A_DOES_NOT_EXIST')).toThrow();
  });

  it('helper name confirms STRUCTURE: function does not depend on lane policy', () => {
    // The function MUST NOT accept any opts that hint at lane (no `lane`
    // argument in the signature) — proven by a structural type check on
    // the exported function shape via .length (number of declared params).
    expect((isReasonCodeStructurallyAllowed as Function).length).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 8. validateRuleReferences / assertRuleReferencesOrThrow
 * ------------------------------------------------------------------------ */

describe('PR#4 — validateRuleReferences (synthetic refs; future-safe API)', () => {
  const c = liveContracts();

  it('valid synthetic refs return []', () => {
    const refs = ['A_REFRESH_BURST', 'A_NO_FOREGROUND_TIME'];
    expect(validateRuleReferences(c, refs)).toEqual([]);
  });

  it('invalid ref returns one HARD issue at rule_references[index]', () => {
    const issues = validateRuleReferences(c, ['A_REFRESH_BURST', 'A_DOES_NOT_EXIST']);
    expect(issues.length).toBe(1);
    expect(issues[0]!.path).toBe('rule_references[1]');
    expect(issues[0]!.hard).toBe(true);
    expect(issues[0]!.contract).toBe('dictionary');
  });

  it('assertRuleReferencesOrThrow throws on invalid ref', () => {
    expect(() => assertRuleReferencesOrThrow(c, ['A_DOES_NOT_EXIST'])).toThrow();
  });

  it('assertRuleReferencesOrThrow passes on valid synthetic refs', () => {
    expect(() => assertRuleReferencesOrThrow(c, ['A_REFRESH_BURST'])).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * 9. CI source-code grep
 * ------------------------------------------------------------------------ */

describe('PR#4 — checkActiveScoringSourceAgainstForbiddenPatterns (Step B)', () => {
  it('returns [] for the current active scoring source (live forbidden patterns)', () => {
    const issues = checkActiveScoringSourceAgainstForbiddenPatterns({ rootDir: ROOT });
    expect(issues).toEqual([]);
  });

  it('flags a synthetic forbidden source string injected via extraSources', () => {
    // Use a synthetic forbidden override that ONLY contains a recognisable
    // marker pattern. This proves the detector reaches injected sources.
    const synthFmt: ForbiddenCodes = {
      ...liveContracts().forbidden,
      string_patterns_blocked_in_code: {
        applies_to: 'source_code_strings_only',
        patterns: ['__SYNTHETIC_PR4_FORBIDDEN_TOKEN__'],
      },
    };
    const issues = checkActiveScoringSourceAgainstForbiddenPatterns({
      rootDir: ROOT,
      forbidden: synthFmt,
      extraSources: [
        {
          path: '/synthetic/inline.ts',
          body: 'export const x = "__SYNTHETIC_PR4_FORBIDDEN_TOKEN__";',
        },
      ],
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.contract).toBe('forbidden');
    expect(issues[0]!.hard).toBe(true);
    expect(issues[0]!.path).toMatch(/__SYNTHETIC_PR4_FORBIDDEN_TOKEN__$/);
  });

  it('uses string_patterns_blocked_in_code.patterns, NOT hard_blocked_code_patterns.patterns', () => {
    // Build a synthetic forbidden where the two pattern lists are
    // DELIBERATELY DIFFERENT. The hard_blocked_code_patterns marker
    // must NOT be detected by the source-code grep; only the
    // string_patterns_blocked_in_code marker is.
    const synthFmt: ForbiddenCodes = {
      ...liveContracts().forbidden,
      hard_blocked_code_patterns: {
        applies_to: 'emitted_reason_codes_only',
        patterns: ['__REASON_CODE_MARKER__'],
      },
      string_patterns_blocked_in_code: {
        applies_to: 'source_code_strings_only',
        patterns: ['__SOURCE_STRING_MARKER__'],
      },
    };
    const issues = checkActiveScoringSourceAgainstForbiddenPatterns({
      rootDir: ROOT,
      forbidden: synthFmt,
      extraSources: [
        { path: '/synthetic/a.ts', body: 'const a = "__REASON_CODE_MARKER__";' },
        { path: '/synthetic/b.ts', body: 'const b = "__SOURCE_STRING_MARKER__";' },
      ],
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.path).toMatch(/__SOURCE_STRING_MARKER__$/);
  });

  it('assertActiveScoringSourceCleanOrThrow does not throw against live source', () => {
    expect(() => assertActiveScoringSourceCleanOrThrow({ rootDir: ROOT })).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * 10-15. Import discipline + writer + cleanup sweeps
 * ------------------------------------------------------------------------ */

describe('PR#4 — import discipline + writer absence + cleanup', () => {
  const loaderSrc = readFileSync(join(ROOT, 'src', 'scoring', 'contracts.ts'), 'utf8');
  const cliSrc = readFileSync(join(ROOT, 'scripts', 'check-scoring-contracts.ts'), 'utf8');
  const sources: Array<[string, string]> = [
    ['src/scoring/contracts.ts', loaderSrc],
    ['scripts/check-scoring-contracts.ts', cliSrc],
  ];

  const importsOf = (src: string): string[] => {
    const out: string[] = [];
    const re = /\bfrom\s+(['"])([^'"]+)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[2]!);
    return out;
  };

  it.each(sources)('%s: no DB imports (pg / pg-pool)', (_, src) => {
    const imports = importsOf(src);
    expect(imports.some((s) => s === 'pg' || s.startsWith('pg-') || s === 'pg-pool')).toBe(false);
  });

  it.each(sources)('%s: no HTTP imports (http/https/fetch libs)', (_, src) => {
    const imports = importsOf(src);
    for (const banned of ['http', 'https', 'axios', 'got', 'node-fetch']) {
      expect(imports.some((s) => s === banned)).toBe(false);
    }
    // Native fetch is a global, but we still forbid string 'fetch' as a
    // bare import or template-literal HTTP call in active code.
    expect(/\bfetch\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))).toBe(false);
  });

  it.each(sources)('%s: no ML imports (sklearn / xgboost / torch / onnx / tensorflow)', (_, src) => {
    const imports = importsOf(src);
    for (const banned of ['sklearn', 'xgboost', 'torch', 'onnx', 'tensorflow', '@tensorflow/tfjs']) {
      expect(imports.some((s) => s === banned || s.startsWith(banned + '/'))).toBe(false);
    }
  });

  it.each(sources)('%s: no collector / app / server / auth imports', (_, src) => {
    const imports = importsOf(src);
    for (const s of imports) {
      expect(s.includes('src/collector/v1')).toBe(false);
      expect(/(^|\/)src\/(app|server|auth)(\/|$|\.)/.test(s)).toBe(false);
    }
  });

  it.each(sources)('%s: no INSERT INTO scoring_output_lane_a/b (no writer)', (_, src) => {
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(/INSERT\s+INTO\s+scoring_output_lane_(a|b)\b/i.test(stripped)).toBe(false);
  });

  it.each(sources)('%s: no stale pg_has_table_privilege references', (_, src) => {
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(/pg_has_table_privilege/.test(stripped)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 16. package.json script presence
 * ------------------------------------------------------------------------ */

describe('PR#4 — package.json wiring', () => {
  it('check:scoring-contracts script is defined', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts['check:scoring-contracts']).toBeDefined();
    expect(pkg.scripts['check:scoring-contracts']).toMatch(/check-scoring-contracts\.ts/);
  });

  it('yaml is declared as a runtime dependency (not devDependency)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies['yaml']).toBeDefined();
    expect(pkg.devDependencies['yaml']).toBeUndefined();
  });
});
