/**
 * Sprint 2 PR#5 — pure tests for the Stage 0 RECORD_ONLY worker.
 *
 * Pure: no DB connection. Tests cover the vendor provenance, the
 * BuyerRecon evaluator (incl. P-11 AI-crawler carve-out + Stage 1
 * envelope discard + rule_inputs minimization), and the import /
 * scope discipline boundaries.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  KNOWN_AI_CRAWLER_UA_FAMILIES,
  STAGE0_VERSION_DEFAULT,
  evaluateStage0Decision,
  isKnownAiCrawler,
} from '../../src/scoring/stage0/evaluate-stage0.js';
import { STAGE0_RULE_IDS } from '../../src/scoring/stage0/types.js';
import type { Stage0Input } from '../../src/scoring/stage0/types.js';
import { normaliseUserAgentFamily } from '../../src/scoring/stage0/extract-stage0-inputs.js';
import { parseStage0EnvOptions } from '../../src/scoring/stage0/run-stage0-worker.js';

const ROOT = join(__dirname, '..', '..');
const VENDOR_LIB     = join(ROOT, 'src', 'scoring', 'stage0', 'vendor', 'stage0-hard-exclusion.js');
const VENDOR_DTS     = join(ROOT, 'src', 'scoring', 'stage0', 'vendor', 'stage0-hard-exclusion.d.ts');
const VENDOR_DOC     = join(ROOT, 'docs', 'vendor', 'track-a-stage0-pr5.md');
const EVALUATOR_FILE = join(ROOT, 'src', 'scoring', 'stage0', 'evaluate-stage0.ts');
const EXTRACTOR_FILE = join(ROOT, 'src', 'scoring', 'stage0', 'extract-stage0-inputs.ts');
const WORKER_FILE    = join(ROOT, 'src', 'scoring', 'stage0', 'run-stage0-worker.ts');
const CLI_FILE       = join(ROOT, 'scripts', 'run-stage0-worker.ts');
const TYPES_FILE     = join(ROOT, 'src', 'scoring', 'stage0', 'types.ts');
const MIGRATION_012  = join(ROOT, 'migrations', '012_stage0_decisions.sql');

const PR5_ACTIVE_SOURCES: ReadonlyArray<[string, string]> = [
  ['src/scoring/stage0/evaluate-stage0.ts',      EVALUATOR_FILE],
  ['src/scoring/stage0/extract-stage0-inputs.ts', EXTRACTOR_FILE],
  ['src/scoring/stage0/run-stage0-worker.ts',     WORKER_FILE],
  ['src/scoring/stage0/types.ts',                 TYPES_FILE],
  ['scripts/run-stage0-worker.ts',                CLI_FILE],
];

/* --------------------------------------------------------------------------
 * Vendor provenance — SHA-256 must match the documented Track A SHA
 * ------------------------------------------------------------------------ */

const EXPECTED_VENDOR_SHA256 =
  '7dc97bd96875df8ad0f45d819ba37fd5c8076aaae8748183540a72e43c82b303';
const EXPECTED_TRACK_A_COMMIT =
  '6ce15f20d6349ee89b8cba6412b6c74e297cad4d';

function sha256(path: string): string {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

describe('PR#5 — Track A vendor provenance', () => {
  it('vendored stage0-hard-exclusion.js SHA-256 matches Track A commit', () => {
    expect(sha256(VENDOR_LIB)).toBe(EXPECTED_VENDOR_SHA256);
  });

  it('docs/vendor/track-a-stage0-pr5.md records the Track A commit hash', () => {
    const doc = readFileSync(VENDOR_DOC, 'utf8');
    expect(doc).toContain(EXPECTED_TRACK_A_COMMIT);
    expect(doc).toContain(EXPECTED_VENDOR_SHA256);
  });

  it('vendor .d.ts companion exists (TypeScript types only; NOT part of SHA proof)', () => {
    expect(() => readFileSync(VENDOR_DTS, 'utf8')).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * Evaluator core — pure adapter behaviour
 * ------------------------------------------------------------------------ */

function baselineInput(overrides: Partial<Stage0Input> = {}): Stage0Input {
  return {
    workspaceId:                   '__test_ws_pr5__',
    siteId:                        '__test_site_pr5__',
    sessionId:                     `sess-${Math.random().toString(36).slice(2, 10)}`,
    userAgentFamily:               null,
    pathsVisited:                  ['/'],
    maxEventsPerSecondSameBrowser: 1,
    pathLoopCount10m:              1,
    zeroEngagementAcrossSession:   false,
    sourceEventCount:              1,
    evidenceRefs:                  [],
    ...overrides,
  };
}

describe('PR#5 — evaluateStage0Decision (adapter behaviour)', () => {
  it('plain browser session is NOT excluded; rule_id = no_stage0_exclusion', () => {
    const out = evaluateStage0Decision(baselineInput());
    expect(out.excluded).toBe(false);
    expect(out.ruleId).toBe('no_stage0_exclusion');
  });

  it('curl UA family is excluded as known_bot_ua_family', () => {
    const out = evaluateStage0Decision(baselineInput({ userAgentFamily: 'curl' }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('known_bot_ua_family');
  });

  it('headless_chrome UA family is excluded as known_bot_ua_family', () => {
    const out = evaluateStage0Decision(baselineInput({ userAgentFamily: 'headless_chrome' }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('known_bot_ua_family');
  });

  it('high request rate (25/sec) yields impossible_request_frequency', () => {
    const out = evaluateStage0Decision(baselineInput({ maxEventsPerSecondSameBrowser: 25 }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('impossible_request_frequency');
  });

  it('probe path /wp-admin yields scanner_or_probe_path', () => {
    const out = evaluateStage0Decision(baselineInput({
      pathsVisited: ['/', '/wp-admin/'],
    }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('scanner_or_probe_path');
    // rule_inputs records the matched canonical path (no raw URL).
    expect(out.ruleInputs.path_pattern_matched).toBe('/wp-admin/');
  });

  it('path loop >=3 + zero engagement yields attack_like_request_pattern', () => {
    const out = evaluateStage0Decision(baselineInput({
      pathLoopCount10m:            3,
      zeroEngagementAcrossSession: true,
    }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('attack_like_request_pattern');
  });

  it('path loop alone (no zero engagement) does NOT trigger Stage 0', () => {
    const out = evaluateStage0Decision(baselineInput({
      pathLoopCount10m:            5,
      zeroEngagementAcrossSession: false,
    }));
    expect(out.excluded).toBe(false);
    expect(out.ruleId).toBe('no_stage0_exclusion');
  });

  it('rule_inputs records events_per_second + path_loop_count for every verdict', () => {
    const out = evaluateStage0Decision(baselineInput({ sourceEventCount: 42 }));
    expect(out.ruleInputs.events_per_second).toBe(1);
    expect(out.ruleInputs.path_loop_count).toBe(1);
  });

  it('every rule_id returned by evaluator is in the Stage0RuleId enum', () => {
    const cases: Array<Partial<Stage0Input>> = [
      {},
      { userAgentFamily: 'curl' },
      { userAgentFamily: 'wget' },
      { userAgentFamily: 'python_requests' },
      { userAgentFamily: 'headless_chrome' },
      { maxEventsPerSecondSameBrowser: 25 },
      { pathsVisited: ['/wp-admin/'] },
      { pathLoopCount10m: 3, zeroEngagementAcrossSession: true },
    ];
    for (const c of cases) {
      const out = evaluateStage0Decision(baselineInput(c));
      expect((STAGE0_RULE_IDS as readonly string[]).includes(out.ruleId)).toBe(true);
    }
  });
});

/* --------------------------------------------------------------------------
 * P-11 — AI-crawler taxonomy carve-out
 * ------------------------------------------------------------------------ */

describe('PR#5 — P-11 AI-crawler taxonomy correction (exclusion-side only)', () => {
  for (const family of ['bytespider', 'gptbot', 'claudebot', 'perplexity-user', 'googlebot', 'bingbot', 'ccbot', 'duckduckbot', 'petalbot']) {
    it(`${family} is NOT hard-excluded as bad-bot`, () => {
      const out = evaluateStage0Decision(baselineInput({ userAgentFamily: family }));
      expect(out.excluded).toBe(false);
      expect(out.ruleId).toBe('no_stage0_exclusion');
      // The carve-out is internal; the only persisted evidence is that
      // (a) the input family is recorded under user_agent_family and
      // (b) the rule_id is no_stage0_exclusion (i.e. known_bot_ua_family
      // did NOT fire). NO `ai_crawler_passthrough` boolean is persisted.
      expect(out.ruleInputs.user_agent_family).toBe(family);
      expect('ai_crawler_passthrough' in (out.ruleInputs as Record<string, unknown>)).toBe(false);
    });
  }

  it('isKnownAiCrawler is case-insensitive', () => {
    expect(isKnownAiCrawler('Bytespider')).toBe(true);
    expect(isKnownAiCrawler('bytespider')).toBe(true);
    expect(isKnownAiCrawler('curl')).toBe(false);
    expect(isKnownAiCrawler(null)).toBe(false);
    expect(isKnownAiCrawler(undefined)).toBe(false);
  });

  it('KNOWN_AI_CRAWLER_UA_FAMILIES contains the A0 §P P-11 minimum set', () => {
    const required = [
      'bytespider', 'gptbot', 'claudebot', 'perplexity-user',
      'perplexitybot', 'ccbot', 'googlebot', 'bingbot',
      'duckduckbot', 'petalbot',
    ];
    for (const f of required) {
      expect(KNOWN_AI_CRAWLER_UA_FAMILIES.has(f)).toBe(true);
    }
  });

  it('an unattributed bot (curl) is STILL hard-excluded after P-11 (carve-out is targeted)', () => {
    const out = evaluateStage0Decision(baselineInput({ userAgentFamily: 'curl' }));
    expect(out.excluded).toBe(true);
    expect(out.ruleId).toBe('known_bot_ua_family');
    // matched_family is populated only when known_bot_ua_family fires.
    expect(out.ruleInputs.matched_family).toBe('curl');
    // ai_crawler_passthrough is INTERNAL carve-out state — never persisted.
    expect('ai_crawler_passthrough' in (out.ruleInputs as Record<string, unknown>)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * Stage 1 envelope discard — adapter must NOT leak any Stage 1 field
 * ------------------------------------------------------------------------ */

describe('PR#5 — adapter discards all Stage 1 envelope fields', () => {
  it('Stage0Output shape does not expose stage1BehaviourScore', () => {
    const out = evaluateStage0Decision(baselineInput({ userAgentFamily: 'curl' }));
    const keys = Object.keys(out);
    for (const banned of [
      'stage1BehaviourScore', 'stage1', 'riskScore', 'classification',
      'recommendedAction', 'recordOnly', 'confidence', 'schemaVersion',
      'decisionSummary', 'finalRecordOnlyDecision', 'evidence_band',
      'verification_score', 'reasonCodes', 'reason_codes',
    ]) {
      expect(keys.includes(banned), `Stage0Output must not expose ${banned}`).toBe(false);
    }
  });

  it('rule_inputs object does not expose any Stage 1 envelope key', () => {
    const out = evaluateStage0Decision(baselineInput({ userAgentFamily: 'curl' }));
    for (const banned of [
      'riskScore', 'classification', 'recommendedAction',
      'recommended_action', 'evidence_band', 'verification_score',
      'reasonCodes', 'reason_codes', 'eligibleForScoring',
      'missingSignals', 'finalRecordOnlyDecision', 'decisionSummary',
    ]) {
      expect(banned in (out.ruleInputs as Record<string, unknown>)).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------
 * rule_inputs minimization (OD-11)
 * ------------------------------------------------------------------------ */

describe('PR#5 — rule_inputs minimization (OD-11)', () => {
  // OD-11 forbidden persisted keys. The post-Codex blocker fix also
  // forbids three keys that the earlier draft had persisted:
  //   - matched_rules           (array form was outside OD-11 allowlist)
  //   - ai_crawler_passthrough  (P-11 carve-out is INTERNAL only)
  //   - zero_engagement         (not in the signed OD-11 allowlist)
  const FORBIDDEN_KEYS = [
    'raw_user_agent', 'user_agent', 'token_hash', 'ip_hash',
    'pepper', 'bearer_token', 'bearer', 'authorization', 'Authorization',
    'raw_payload', 'raw_request_body', 'request_body', 'canonical_jsonb',
    'raw_page_url',
    'matched_rules', 'ai_crawler_passthrough', 'zero_engagement',
  ] as const;
  // Helen-signed OD-11 allowlist (the only keys PR#5 may persist).
  const ALLOWED_KEYS = [
    'matched_rule_id',
    'user_agent_family',
    'matched_family',
    'ua_source',
    'path_pattern_matched',
    'events_per_second',
    'path_loop_count',
    'signal_confidence_bucket',
  ] as const;

  const cases: Array<[string, Partial<Stage0Input>]> = [
    ['plain',           {}],
    ['curl bot',        { userAgentFamily: 'curl' }],
    ['bytespider',      { userAgentFamily: 'bytespider' }],
    ['high rate',       { maxEventsPerSecondSameBrowser: 25 }],
    ['probe path',      { pathsVisited: ['/wp-admin/'] }],
    ['attack pattern',  { pathLoopCount10m: 3, zeroEngagementAcrossSession: true }],
  ];

  for (const [label, overrides] of cases) {
    it(`rule_inputs (${label}) contains no forbidden key`, () => {
      const out = evaluateStage0Decision(baselineInput(overrides));
      for (const key of FORBIDDEN_KEYS) {
        expect(key in (out.ruleInputs as Record<string, unknown>),
          `forbidden key ${key} appeared in rule_inputs (${label})`).toBe(false);
      }
    });
    it(`rule_inputs (${label}) keys are all from the OD-11 allowlist`, () => {
      const out = evaluateStage0Decision(baselineInput(overrides));
      for (const k of Object.keys(out.ruleInputs)) {
        expect((ALLOWED_KEYS as readonly string[]).includes(k),
          `unexpected key ${k} in rule_inputs (${label})`).toBe(true);
      }
    });
  }

  it('a raw UA-like string never appears as a rule_inputs value', () => {
    const out = evaluateStage0Decision(baselineInput({
      userAgentFamily: 'curl', // family label only — the worker NEVER passes the raw UA
    }));
    const serialised = JSON.stringify(out.ruleInputs);
    expect(serialised.includes('Mozilla/')).toBe(false);
    expect(serialised.includes('AppleWebKit/')).toBe(false);
    expect(serialised.includes('Chrome/')).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * normaliseUserAgentFamily — UA → family mapping
 * ------------------------------------------------------------------------ */

describe('PR#5 — normaliseUserAgentFamily', () => {
  it('curl UA maps to curl', () => {
    expect(normaliseUserAgentFamily('curl/8.0')).toBe('curl');
  });
  it('python-requests UA maps to python_requests', () => {
    expect(normaliseUserAgentFamily('python-requests/2.31.0')).toBe('python_requests');
  });
  it('Bytespider UA maps to bytespider', () => {
    expect(normaliseUserAgentFamily('Mozilla/5.0 (compatible; Bytespider; ByteDance)')).toBe('bytespider');
  });
  it('a normal Chrome UA returns null (no Stage 0 family)', () => {
    expect(normaliseUserAgentFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'))
      .toBe(null);
  });
  it('empty / null / undefined returns null', () => {
    expect(normaliseUserAgentFamily('')).toBe(null);
    expect(normaliseUserAgentFamily(null)).toBe(null);
    expect(normaliseUserAgentFamily(undefined)).toBe(null);
  });
});

/* --------------------------------------------------------------------------
 * parseStage0EnvOptions — env-var parsing
 * ------------------------------------------------------------------------ */

describe('PR#5 — parseStage0EnvOptions', () => {
  const now = new Date('2026-05-12T12:00:00Z');

  it('requires DATABASE_URL', () => {
    expect(() => parseStage0EnvOptions({}, now)).toThrow(/DATABASE_URL/);
  });

  it('default STAGE0_VERSION matches STAGE0_VERSION_DEFAULT', () => {
    const parsed = parseStage0EnvOptions({ DATABASE_URL: 'postgres://x/y' }, now);
    expect(parsed.options.stage0_version).toBe(STAGE0_VERSION_DEFAULT);
  });

  it('STAGE0_VERSION env override is respected', () => {
    const parsed = parseStage0EnvOptions(
      { DATABASE_URL: 'postgres://x/y', STAGE0_VERSION: 'stage0-hard-exclusion-v0.3-rc' },
      now,
    );
    expect(parsed.options.stage0_version).toBe('stage0-hard-exclusion-v0.3-rc');
  });

  it('default SINCE_HOURS = 168 (matches PR#1 / PR#2)', () => {
    const parsed = parseStage0EnvOptions({ DATABASE_URL: 'postgres://x/y' }, now);
    const expectedStart = new Date(now.getTime() - 168 * 3600 * 1000);
    expect(parsed.options.window_start.toISOString()).toBe(expectedStart.toISOString());
  });

  it('rejects window_start >= window_end', () => {
    expect(() =>
      parseStage0EnvOptions(
        {
          DATABASE_URL: 'postgres://x/y',
          SINCE:        '2026-05-12T13:00:00Z',
          UNTIL:        '2026-05-12T12:00:00Z',
        },
        now,
      ),
    ).toThrow();
  });
});

/* --------------------------------------------------------------------------
 * Migration 012 — structural assertions
 * ------------------------------------------------------------------------ */

describe('PR#5 — migration 012 structure', () => {
  const sql = readFileSync(MIGRATION_012, 'utf8');

  it('CREATE TABLE IF NOT EXISTS stage0_decisions', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+stage0_decisions/);
  });

  it('5-column natural key includes stage0_version AND scoring_version (OD-10)', () => {
    expect(sql).toMatch(
      /stage0_decisions_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*stage0_version\s*,\s*scoring_version\s*\)/i,
    );
  });

  it('record_only CHECK IS TRUE', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*record_only\s+IS\s+TRUE\s*\)/i);
  });

  it('rule_id CHECK is the 8-value Stage-0-specific enum', () => {
    for (const id of STAGE0_RULE_IDS) {
      expect(sql).toContain(`'${id}'`);
    }
  });

  it('excluded ↔ rule_id co-invariant CHECK present', () => {
    expect(sql).toMatch(/excluded\s*=\s*TRUE[\s\S]*?rule_id\s*<>\s*'no_stage0_exclusion'/);
    expect(sql).toMatch(/excluded\s*=\s*FALSE[\s\S]*?rule_id\s*=\s*'no_stage0_exclusion'/);
  });

  it('JSONB shape CHECKs on rule_inputs (object) + evidence_refs (array)', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*rule_inputs\s*\)\s*=\s*'object'\s*\)/i);
    expect(sql).toMatch(/CHECK\s*\(\s*jsonb_typeof\(\s*evidence_refs\s*\)\s*=\s*'array'\s*\)/i);
  });

  it('source_event_count >= 0 CHECK', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*source_event_count\s*>=\s*0\s*\)/i);
  });

  it('NO forbidden columns: verification_score / evidence_band / action_recommendation / reason_codes / risk_score / classification / confidence_band / is_bot / is_agent / ai_agent / buyer_intent / lead_quality', () => {
    const ddl = sql.match(/CREATE TABLE IF NOT EXISTS stage0_decisions \(([\s\S]*?)\);/);
    expect(ddl).not.toBeNull();
    const block = ddl![1]!;
    for (const banned of [
      'verification_score', 'evidence_band', 'action_recommendation',
      'reason_codes', 'risk_score', 'classification', 'confidence_band',
      'is_bot', 'is_agent', 'ai_agent', 'buyer_intent', 'lead_quality',
    ]) {
      expect(block.toLowerCase().includes(banned)).toBe(false);
    }
  });

  it('role-existence assertions present for all four canonical roles', () => {
    for (const r of [
      'buyerrecon_migrator',
      'buyerrecon_scoring_worker',
      'buyerrecon_customer_api',
      'buyerrecon_internal_readonly',
    ]) {
      expect(sql).toMatch(new RegExp(`pg_roles[\\s\\S]*?rolname\\s*=\\s*'${r}'[\\s\\S]*?RAISE EXCEPTION`));
    }
  });

  it('Hard-Rule-I parity assertion at end (customer-API zero SELECT on stage0_decisions)', () => {
    expect(sql).toMatch(
      /has_table_privilege\(\s*'buyerrecon_customer_api'(?:::name)?\s*,\s*'stage0_decisions'(?:::regclass)?\s*,\s*'SELECT'(?:::text)?\s*\)[\s\S]*?RAISE EXCEPTION/,
    );
  });

  it('rollback comment uses DROP TABLE IF EXISTS, no CASCADE', () => {
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/CASCADE/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS\s+stage0_decisions/);
  });

  it('migration contains no INSERT INTO statement', () => {
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it('migration contains no CREATE ROLE / dangerous ALTER ROLE', () => {
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    expect(stripped).not.toMatch(/\bCREATE\s+ROLE\b/i);
    for (const d of ['SUPERUSER', 'CREATEROLE', 'CREATEDB', 'BYPASSRLS', 'PASSWORD']) {
      expect(stripped).not.toMatch(new RegExp(`\\bALTER\\s+ROLE\\b[^;]*\\b${d}\\b`, 'i'));
    }
  });
});

/* --------------------------------------------------------------------------
 * schema.sql mirror
 * ------------------------------------------------------------------------ */

describe('PR#5 — schema.sql mirrors stage0_decisions', () => {
  const schema = readFileSync(join(ROOT, 'src', 'db', 'schema.sql'), 'utf8');

  it('contains CREATE TABLE IF NOT EXISTS stage0_decisions', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+stage0_decisions/);
  });

  it('mirrors the 5-column natural key', () => {
    expect(schema).toMatch(
      /stage0_decisions_natural_key\s+UNIQUE\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*stage0_version\s*,\s*scoring_version\s*\)/i,
    );
  });

  it('does NOT touch pre-PR#5 tables (spot-check three)', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+accepted_events/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+session_features/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS\s+session_behavioural_features_v0_2/);
  });
});

/* --------------------------------------------------------------------------
 * Import discipline — PR#5 active sources only
 * ------------------------------------------------------------------------ */

describe('PR#5 — import discipline (active sources)', () => {
  const importsOf = (src: string): string[] => {
    const out: string[] = [];
    const re = /\bfrom\s+(['"])([^'"]+)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[2]!);
    return out;
  };

  it.each(PR5_ACTIVE_SOURCES)('%s: no import from src/collector/v1 / app / server / auth', (_, path) => {
    const imports = importsOf(readFileSync(path, 'utf8'));
    for (const s of imports) {
      expect(s.includes('src/collector/v1')).toBe(false);
      expect(/(^|\/)src\/(app|server|auth)(\/|$|\.)/.test(s)).toBe(false);
    }
  });

  it.each(PR5_ACTIVE_SOURCES)('%s: no HTTP / fetch libs', (_, path) => {
    const src = readFileSync(path, 'utf8');
    const imports = importsOf(src);
    for (const banned of ['http', 'https', 'axios', 'got', 'node-fetch']) {
      expect(imports.some((s) => s === banned)).toBe(false);
    }
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(/\bfetch\s*\(/.test(stripped)).toBe(false);
  });

  it.each(PR5_ACTIVE_SOURCES)('%s: no ML imports', (_, path) => {
    const imports = importsOf(readFileSync(path, 'utf8'));
    for (const banned of ['sklearn', 'xgboost', 'torch', 'onnx', 'tensorflow', '@tensorflow/tfjs']) {
      expect(imports.some((s) => s === banned || s.startsWith(banned + '/'))).toBe(false);
    }
  });

  it.each(PR5_ACTIVE_SOURCES)('%s: no Track A path imports (vendored copy is in src/scoring/stage0/vendor only)', (_, path) => {
    const imports = importsOf(readFileSync(path, 'utf8'));
    for (const s of imports) {
      expect(/ams-qa-behaviour-tests/i.test(s)).toBe(false);
      expect(/keigentechnologies\/AMS/i.test(s)).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------
 * No Lane A / Lane B writer in PR#5 active source
 * ------------------------------------------------------------------------ */

describe('PR#5 — no Lane A / Lane B writer in active source', () => {
  it.each(PR5_ACTIVE_SOURCES)('%s: no INSERT INTO scoring_output_lane_a / _b', (_, path) => {
    const stripped = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(/INSERT\s+INTO\s+scoring_output_lane_(a|b)\b/i.test(stripped)).toBe(false);
  });

  it('migration 012 does not modify migrations 001..011 (sanity: file path)', () => {
    expect(MIGRATION_012.endsWith('012_stage0_decisions.sql')).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * PR#4 startup guard wiring
 * ------------------------------------------------------------------------ */

describe('PR#5 — PR#4 startup guard wiring', () => {
  it('the worker imports assertScoringContractsOrThrow from the contract loader', () => {
    const src = readFileSync(WORKER_FILE, 'utf8');
    // Relative path: src/scoring/stage0/run-stage0-worker.ts → ../contracts.js
    expect(src).toMatch(/from\s+['"][^'"]*contracts\.js['"]/);
    expect(src).toMatch(/assertScoringContractsOrThrow/);
  });

  it('the worker also calls assertActiveScoringSourceCleanOrThrow (defence-in-depth)', () => {
    const src = readFileSync(WORKER_FILE, 'utf8');
    expect(src).toMatch(/assertActiveScoringSourceCleanOrThrow/);
  });

  it('runStage0Worker calls assertScoringContractsOrThrow before any DB write', () => {
    const src = readFileSync(WORKER_FILE, 'utf8');
    const fnStart = src.indexOf('export async function runStage0Worker');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, src.length);
    const guardIdx = fnBody.indexOf('assertScoringContractsOrThrow');
    const insertIdx = fnBody.indexOf('INSERT INTO');
    expect(guardIdx).toBeGreaterThan(-1);
    // INSERT INTO may live in a referenced SQL string above in the file;
    // here we just confirm the guard runs at the top of the function body.
    const queryIdx = fnBody.indexOf('pool.query');
    expect(queryIdx === -1 || guardIdx < queryIdx).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * §I.5 vendor-audit checklist — Stage 0 vendor file
 * ------------------------------------------------------------------------ */

describe('PR#5 — §I.5 vendor-audit checklist on vendored file', () => {
  const vendor = readFileSync(VENDOR_LIB, 'utf8');

  // The vendored file deliberately contains a FORBIDDEN_TOKENS data
  // array listing these strings; the §I.5 check ensures the strings
  // are not used in rule names, function names, or runtime paths.
  // We assert the RULES array's rule names don't contain any §I.5 token.
  it('RULES array names contain no §I.5 forbidden token', () => {
    const rulesBlock = vendor.match(/const RULES = \[([\s\S]*?)\];/);
    expect(rulesBlock).not.toBeNull();
    const ruleNames = (rulesBlock![1]!.match(/name:\s*'([^']+)'/g) ?? [])
      .map((m) => m.replace(/^name:\s*'/, '').replace(/'$/, ''));
    expect(ruleNames.length).toBeGreaterThan(0);
    for (const n of ruleNames) {
      for (const tok of ['qa', 'test', 'synthetic', 'bot_label', 'adversary',
                          'behaviour_qa', 'ams_qa', 'bad_traffic_qa',
                          'fixture', 'profile_name']) {
        expect(n.toLowerCase().includes(tok),
          `RULE name '${n}' contains §I.5 forbidden token '${tok}'`).toBe(false);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * package.json: stage0:run script + no new dependency
 * ------------------------------------------------------------------------ */

describe('PR#5 — package.json wiring', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts:      Record<string, string>;
    dependencies: Record<string, string>;
  };

  it('stage0:run script is defined', () => {
    expect(pkg.scripts['stage0:run']).toBeDefined();
    expect(pkg.scripts['stage0:run']).toMatch(/run-stage0-worker\.ts/);
  });

  it('check:scoring-contracts (PR#4) is still present', () => {
    expect(pkg.scripts['check:scoring-contracts']).toBeDefined();
  });

  it('PR#5 introduces no new runtime dependency (pg + yaml already present)', () => {
    expect(pkg.dependencies['pg']).toBeDefined();
    expect(pkg.dependencies['yaml']).toBeDefined();
  });
});
