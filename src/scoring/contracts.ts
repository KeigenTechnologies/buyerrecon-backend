/**
 * Sprint 2 PR#4 — scoring contract loader / startup guard.
 *
 * Track B (BuyerRecon Evidence Foundation). Pure TypeScript module.
 *
 * Purpose. Load + validate the three Sprint 2 scoring contract
 * artefacts (`scoring/version.yml`, `scoring/reason_code_dictionary.yml`,
 * `scoring/forbidden_codes.yml`) and expose fail-fast assertion
 * functions that future scoring workers (Sprint 2 PR#5 Stage 0, PR#6
 * Stage 1, deferred PR#3b router/observer) MUST call at startup.
 *
 * PR#4 owns the enforcement seam for Hard Rules C and D
 * (signal-truth-v0.1 §10). The future workers own the invocation side.
 *
 * Hard non-PR#4 boundaries:
 *   - No DB connection. No `pg`, `pg-pool`, `pg.Pool` import.
 *   - No HTTP / fetch / axios / etc.
 *   - No ML library imports.
 *   - No import from src/collector/v1/**, src/app, src/server, src/auth.
 *   - No scoring algorithm; no `verification_score` computation.
 *   - No reason-code emission; no INSERT into scoring_output_lane_a/b.
 *
 * Authority:
 *   - docs/architecture/ARCHITECTURE_GATE_A0.md §K row PR#4
 *   - docs/contracts/signal-truth-v0.1.md §10 Hard Rules C + D, §13.2
 *   - docs/sprint2-pr4-scoring-contract-loader-planning.md (Codex PASS)
 *
 * Helen sign-off OD-1..OD-7:
 *   OD-1 src/scoring/contracts.ts (this file)
 *   OD-2 library + CLI runner (scripts/check-scoring-contracts.ts)
 *   OD-3 yaml dependency + check:scoring-contracts npm script
 *   OD-4 B_* structurally validated only; lane policy is future-worker's
 *   OD-5 startup guard only; no worker boot wrapper
 *   OD-6 fixtures under tests/fixtures/scoring-contracts/
 *   OD-7 lightweight Hetzner npm proof only; no DB proof
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import YAML from 'yaml';

/* --------------------------------------------------------------------------
 * Type exports — the parsed shape of each contract file.
 * Validation lives in validateScoringContracts; parsing is structural only.
 * ------------------------------------------------------------------------ */

export interface VersionContract {
  scoring_version:                 string;
  reason_code_dictionary_version:  string;
  forbidden_codes_version:         string;
  status:                          'record_only';
  automated_action_enabled:        false;
  notes?:                          string;
}

export type ReasonCodeNamespace = 'A_' | 'B_' | 'REVIEW_' | 'OBS_';

export interface ReasonCodeEntry {
  meaning:                       string;
  can_route_to_review:           boolean;
  can_trigger_automated_action:  false;
  // All other optional fields tolerated as unknown.
  [k: string]:                   unknown;
}

export interface ReasonCodeDictionary {
  metadata:             { version: string; [k: string]: unknown };
  policies?:            { [k: string]: unknown };
  codes:                { [code: string]: ReasonCodeEntry };
  reserved_namespaces:  { [prefix: string]: unknown };
  [k: string]:          unknown;
}

export interface PatternList {
  applies_to: string;
  patterns:   string[];
  [k: string]: unknown;
}

export interface ForbiddenCodes {
  metadata:                                                { version: string; [k: string]: unknown };
  hard_blocked_codes:                                      string[];
  hard_blocked_code_patterns:                              PatternList;
  hard_blocked_band_values:                                string[];
  hard_blocked_action_values:                              string[];
  // v1 invariant: this array MUST contain 'strong'
  // (signal-truth-v0.1 §11 + PR#3 OD-6).
  hard_blocked_verification_method_strength_values_in_v1:  string[];
  prefix_allowlist:                                        string[];
  string_patterns_blocked_in_code:                         PatternList;
  sdk_payload_field_blocklist_followup?:                   { [k: string]: unknown };
  [k: string]: unknown;
}

export interface ScoringContracts {
  version:     VersionContract;
  dictionary:  ReasonCodeDictionary;
  forbidden:   ForbiddenCodes;
}

export interface ContractValidationIssue {
  contract: 'version' | 'dictionary' | 'forbidden';
  path:     string;
  message:  string;
  hard:     boolean;
}

/* --------------------------------------------------------------------------
 * Path resolution
 *
 * Default rootDir resolves to the repo root via __dirname-equivalent.
 * Robust against both ESM (NodeNext) and tsx-compiled execution.
 * ------------------------------------------------------------------------ */

function resolveRootDir(opts?: { rootDir?: string }): string {
  if (opts?.rootDir) return resolve(opts.rootDir);
  // Walk up from process.cwd() until we find a package.json. This
  // is portable across tsx (ESM/CJS), tsc-compiled output, and vitest,
  // because none of them reliably define both __dirname AND
  // import.meta.url across module modes.
  let dir = resolve(process.cwd());
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      statSync(join(dir, 'package.json'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error('resolveRootDir: could not locate repo root (no package.json found above process.cwd())');
      }
      dir = parent;
    }
  }
}

/* --------------------------------------------------------------------------
 * Pure helpers
 * ------------------------------------------------------------------------ */

const KNOWN_NAMESPACES: readonly string[] = ['A_', 'B_', 'REVIEW_', 'OBS_'];
const OBS_NAMESPACE_CAP = 7;
/**
 * Activation-flag detection in scoring/version.yml.
 *
 * Two layers:
 *
 *   ACTIVATION_KEY_FAMILY_PATTERNS — prefix-family regexes. ANY top-level
 *     key matching one of these families and set to boolean true raises a
 *     HARD issue. Catches e.g. live_scoring_enabled, production_rollout_enabled,
 *     customer_facing_report_enabled, enabled_for_customers_beta.
 *
 *   ACTIVATION_KEY_EXACT — exact key names that do not fit a family but are
 *     still forbidden when true (e.g. action_enabled).
 *
 * automated_action_enabled is validated separately above (MUST === false;
 * not merely "not true"); the family + exact matchers skip it.
 *
 * The version.yml keys that are part of the canonical contract
 * (scoring_version, reason_code_dictionary_version, forbidden_codes_version,
 * status, automated_action_enabled, notes) are skipped before activation-key
 * matching runs.
 */
const ACTIVATION_KEY_FAMILY_PATTERNS: readonly RegExp[] = [
  /^customer_facing_/,
  /^live_/,
  /^production_/,
  /^enabled_for_/,
];
const ACTIVATION_KEY_EXACT: readonly string[] = ['action_enabled'];
const VERSION_CANONICAL_KEYS: readonly string[] = [
  'scoring_version',
  'reason_code_dictionary_version',
  'forbidden_codes_version',
  'status',
  'automated_action_enabled',
  'notes',
];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function namespaceOf(code: string): string | null {
  for (const ns of KNOWN_NAMESPACES) if (code.startsWith(ns)) return ns;
  return null;
}
function tryCompileRegex(pat: string): RegExp | null {
  try {
    return new RegExp(pat);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
 * loadScoringContracts
 *
 * Reads the three YAML files; throws on file-read or YAML-parse error.
 * Returns the parsed shapes without applying validation rules — those
 * are validateScoringContracts' job.
 * ------------------------------------------------------------------------ */

export function loadScoringContracts(opts?: { rootDir?: string }): ScoringContracts {
  const root = resolveRootDir(opts);
  const versionPath    = join(root, 'scoring', 'version.yml');
  const dictionaryPath = join(root, 'scoring', 'reason_code_dictionary.yml');
  const forbiddenPath  = join(root, 'scoring', 'forbidden_codes.yml');

  const version    = YAML.parse(readFileSync(versionPath,    'utf8')) as VersionContract;
  const dictionary = YAML.parse(readFileSync(dictionaryPath, 'utf8')) as ReasonCodeDictionary;
  const forbidden  = YAML.parse(readFileSync(forbiddenPath,  'utf8')) as ForbiddenCodes;

  return { version, dictionary, forbidden };
}

/* --------------------------------------------------------------------------
 * validateScoringContracts
 *
 * Pure. No I/O. Returns the issue list (empty array means PASS).
 * Every issue PR#4 raises is HARD by default (Hard Rules C + D say the
 * scorer must refuse to start).
 * ------------------------------------------------------------------------ */

export function validateScoringContracts(c: ScoringContracts): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];

  // ---- §H — scoring/version.yml ------------------------------------------
  const v = c.version as unknown as Record<string, unknown> | null;
  if (!isObject(v)) {
    issues.push({ contract: 'version', path: '<root>', message: 'version.yml did not parse to an object', hard: true });
    // Without a version block we cannot meaningfully continue checking
    // cross-version constraints; return early.
    return issues;
  }
  if (!isNonEmptyString(v.scoring_version)) {
    issues.push({ contract: 'version', path: 'scoring_version', message: 'scoring_version missing or not a non-empty string', hard: true });
  }
  if (!isNonEmptyString(v.reason_code_dictionary_version)) {
    issues.push({ contract: 'version', path: 'reason_code_dictionary_version', message: 'reason_code_dictionary_version missing or not a non-empty string', hard: true });
  }
  if (!isNonEmptyString(v.forbidden_codes_version)) {
    issues.push({ contract: 'version', path: 'forbidden_codes_version', message: 'forbidden_codes_version missing or not a non-empty string', hard: true });
  }
  if (v.status !== 'record_only') {
    issues.push({ contract: 'version', path: 'status', message: `status MUST be 'record_only' (got ${JSON.stringify(v.status)})`, hard: true });
  }
  if (v.automated_action_enabled !== false) {
    issues.push({ contract: 'version', path: 'automated_action_enabled', message: `automated_action_enabled MUST be false (got ${JSON.stringify(v.automated_action_enabled)})`, hard: true });
  }
  // Activation-flag detection: every top-level key in version.yml that
  // is not in the canonical set is checked against the prefix-family
  // patterns AND the exact-name list. Any match with value === true is
  // a HARD issue. Boolean false, null, strings, and absence are all
  // tolerated — the rule only fires on an active "true" flip.
  for (const key of Object.keys(v)) {
    if (VERSION_CANONICAL_KEYS.includes(key)) continue;
    const matchesFamily = ACTIVATION_KEY_FAMILY_PATTERNS.some((re) => re.test(key));
    const matchesExact  = ACTIVATION_KEY_EXACT.includes(key);
    if (!matchesFamily && !matchesExact) continue;
    if (v[key] === true) {
      issues.push({
        contract: 'version',
        path:     key,
        message:  `${key} is an activation flag and MUST NOT be true under RECORD_ONLY (status=record_only)`,
        hard:     true,
      });
    }
  }

  // ---- §F — scoring/reason_code_dictionary.yml ---------------------------
  const d = c.dictionary as unknown as Record<string, unknown> | null;
  if (!isObject(d)) {
    issues.push({ contract: 'dictionary', path: '<root>', message: 'reason_code_dictionary.yml did not parse to an object', hard: true });
    return issues;
  }
  const dmeta = d.metadata;
  if (!isObject(dmeta) || !isNonEmptyString((dmeta as Record<string, unknown>).version)) {
    issues.push({ contract: 'dictionary', path: 'metadata.version', message: 'dictionary metadata.version missing or empty', hard: true });
  }
  if (!isObject(d.codes)) {
    issues.push({ contract: 'dictionary', path: 'codes', message: 'codes missing or not an object', hard: true });
  }
  if (!isObject(d.reserved_namespaces)) {
    issues.push({ contract: 'dictionary', path: 'reserved_namespaces', message: 'reserved_namespaces missing or not an object', hard: true });
  }

  // Cross-version: dictionary metadata.version === version.reason_code_dictionary_version
  if (
    isObject(dmeta) &&
    isNonEmptyString((dmeta as Record<string, unknown>).version) &&
    isNonEmptyString(v.reason_code_dictionary_version) &&
    (dmeta as Record<string, unknown>).version !== v.reason_code_dictionary_version
  ) {
    issues.push({
      contract: 'dictionary',
      path:     'metadata.version',
      message:  `dictionary metadata.version (${(dmeta as Record<string, unknown>).version}) must match version.yml reason_code_dictionary_version (${v.reason_code_dictionary_version})`,
      hard:     true,
    });
  }

  // ---- §G — scoring/forbidden_codes.yml ----------------------------------
  const f = c.forbidden as unknown as Record<string, unknown> | null;
  if (!isObject(f)) {
    issues.push({ contract: 'forbidden', path: '<root>', message: 'forbidden_codes.yml did not parse to an object', hard: true });
    return issues;
  }
  const fmeta = f.metadata;
  if (!isObject(fmeta) || !isNonEmptyString((fmeta as Record<string, unknown>).version)) {
    issues.push({ contract: 'forbidden', path: 'metadata.version', message: 'forbidden metadata.version missing or empty', hard: true });
  }
  if (
    isObject(fmeta) &&
    isNonEmptyString((fmeta as Record<string, unknown>).version) &&
    isNonEmptyString(v.forbidden_codes_version) &&
    (fmeta as Record<string, unknown>).version !== v.forbidden_codes_version
  ) {
    issues.push({
      contract: 'forbidden',
      path:     'metadata.version',
      message:  `forbidden metadata.version (${(fmeta as Record<string, unknown>).version}) must match version.yml forbidden_codes_version (${v.forbidden_codes_version})`,
      hard:     true,
    });
  }

  // §G.1 — shape
  if (!isStringArray(f.hard_blocked_codes)) {
    issues.push({ contract: 'forbidden', path: 'hard_blocked_codes', message: 'hard_blocked_codes must be a string[]', hard: true });
  }
  if (!isObject(f.hard_blocked_code_patterns)) {
    issues.push({ contract: 'forbidden', path: 'hard_blocked_code_patterns', message: 'hard_blocked_code_patterns missing or not an object', hard: true });
  } else {
    const hb = f.hard_blocked_code_patterns as Record<string, unknown>;
    if (hb.applies_to !== 'emitted_reason_codes_only') {
      issues.push({ contract: 'forbidden', path: 'hard_blocked_code_patterns.applies_to', message: `applies_to MUST be 'emitted_reason_codes_only' (got ${JSON.stringify(hb.applies_to)})`, hard: true });
    }
    if (!isStringArray(hb.patterns)) {
      issues.push({ contract: 'forbidden', path: 'hard_blocked_code_patterns.patterns', message: 'patterns missing or not string[]', hard: true });
    } else {
      hb.patterns.forEach((p, i) => {
        if (tryCompileRegex(p) === null) {
          issues.push({ contract: 'forbidden', path: `hard_blocked_code_patterns.patterns[${i}]`, message: `invalid regex: ${p}`, hard: true });
        }
      });
    }
  }
  if (!isObject(f.string_patterns_blocked_in_code)) {
    issues.push({ contract: 'forbidden', path: 'string_patterns_blocked_in_code', message: 'string_patterns_blocked_in_code missing or not an object', hard: true });
  } else {
    const sb = f.string_patterns_blocked_in_code as Record<string, unknown>;
    if (sb.applies_to !== 'source_code_strings_only') {
      issues.push({ contract: 'forbidden', path: 'string_patterns_blocked_in_code.applies_to', message: `applies_to MUST be 'source_code_strings_only' (got ${JSON.stringify(sb.applies_to)})`, hard: true });
    }
    if (!isStringArray(sb.patterns)) {
      issues.push({ contract: 'forbidden', path: 'string_patterns_blocked_in_code.patterns', message: 'patterns missing or not string[]', hard: true });
    } else {
      sb.patterns.forEach((p, i) => {
        if (tryCompileRegex(p) === null) {
          issues.push({ contract: 'forbidden', path: `string_patterns_blocked_in_code.patterns[${i}]`, message: `invalid regex: ${p}`, hard: true });
        }
      });
    }
  }
  if (!isStringArray(f.hard_blocked_band_values)) {
    issues.push({ contract: 'forbidden', path: 'hard_blocked_band_values', message: 'hard_blocked_band_values must be a string[]', hard: true });
  }
  if (!isStringArray(f.hard_blocked_action_values)) {
    issues.push({ contract: 'forbidden', path: 'hard_blocked_action_values', message: 'hard_blocked_action_values must be a string[]', hard: true });
  }
  if (!isStringArray(f.prefix_allowlist)) {
    issues.push({ contract: 'forbidden', path: 'prefix_allowlist', message: 'prefix_allowlist must be a string[]', hard: true });
  }

  // §G.4 — verification_method_strength reserved-not-emitted
  if (!isStringArray(f.hard_blocked_verification_method_strength_values_in_v1)) {
    issues.push({
      contract: 'forbidden',
      path:     'hard_blocked_verification_method_strength_values_in_v1',
      message:  'hard_blocked_verification_method_strength_values_in_v1 missing or not string[] (signal-truth §11 + PR#3 OD-6)',
      hard:     true,
    });
  } else if (!f.hard_blocked_verification_method_strength_values_in_v1.includes('strong')) {
    issues.push({
      contract: 'forbidden',
      path:     'hard_blocked_verification_method_strength_values_in_v1',
      message:  "hard_blocked_verification_method_strength_values_in_v1 MUST contain 'strong' (signal-truth §11 + PR#3 OD-6)",
      hard:     true,
    });
  }

  // ---- §F.2..§F.5 — per-code invariants ----------------------------------
  if (isObject(d.codes)) {
    const codes = d.codes as Record<string, unknown>;
    let obsCount = 0;
    const prefixAllowlist: string[] = isStringArray(f.prefix_allowlist) ? f.prefix_allowlist : [];
    const hardBlockedCodes: string[] = isStringArray(f.hard_blocked_codes) ? f.hard_blocked_codes : [];
    const codePatterns: RegExp[] = (() => {
      const hb = f.hard_blocked_code_patterns;
      if (!isObject(hb) || !isStringArray((hb as Record<string, unknown>).patterns)) return [];
      return ((hb as Record<string, unknown>).patterns as string[])
        .map(tryCompileRegex)
        .filter((r): r is RegExp => r !== null);
    })();

    for (const [code, entry] of Object.entries(codes)) {
      const ns = namespaceOf(code);

      // Prefix
      if (ns === null) {
        issues.push({ contract: 'dictionary', path: `codes.${code}`, message: `code prefix must be one of A_/B_/REVIEW_/OBS_`, hard: true });
      } else if (code.startsWith('UX_')) {
        // Defensive — namespaceOf already rejects UX_; this is belt+braces.
        issues.push({ contract: 'dictionary', path: `codes.${code}`, message: `UX_* codes are reserved-not-emitted in v1`, hard: true });
      }

      // Entry shape
      if (!isObject(entry)) {
        issues.push({ contract: 'dictionary', path: `codes.${code}`, message: 'code entry must be an object', hard: true });
        continue;
      }
      const e = entry as Record<string, unknown>;
      if (!isNonEmptyString(e.meaning)) {
        issues.push({ contract: 'dictionary', path: `codes.${code}.meaning`, message: 'meaning missing or empty (dictionary uses `meaning`, not `description`)', hard: true });
      }
      if (typeof e.can_route_to_review !== 'boolean') {
        issues.push({ contract: 'dictionary', path: `codes.${code}.can_route_to_review`, message: 'can_route_to_review must be a boolean', hard: true });
      }
      if (typeof e.can_trigger_automated_action !== 'boolean') {
        issues.push({ contract: 'dictionary', path: `codes.${code}.can_trigger_automated_action`, message: 'can_trigger_automated_action must be a boolean', hard: true });
      } else if (e.can_trigger_automated_action !== false) {
        issues.push({ contract: 'dictionary', path: `codes.${code}.can_trigger_automated_action`, message: 'can_trigger_automated_action MUST be false for every code in v1 (Hard Rule B + version.yml.automated_action_enabled: false)', hard: true });
      }
      if ('can_trigger_action' in e) {
        issues.push({ contract: 'dictionary', path: `codes.${code}.can_trigger_action`, message: 'legacy can_trigger_action field is REMOVED post-CF-3 — use can_route_to_review + can_trigger_automated_action', hard: true });
      }

      // Cross-checks against forbidden_codes.yml
      if (ns !== null && prefixAllowlist.length > 0 && !prefixAllowlist.includes(ns)) {
        issues.push({ contract: 'dictionary', path: `codes.${code}`, message: `code prefix ${ns} is not in forbidden.prefix_allowlist`, hard: true });
      }
      if (hardBlockedCodes.includes(code)) {
        issues.push({ contract: 'dictionary', path: `codes.${code}`, message: `code appears in forbidden.hard_blocked_codes`, hard: true });
      }
      for (const re of codePatterns) {
        if (re.test(code)) {
          issues.push({ contract: 'dictionary', path: `codes.${code}`, message: `code matches forbidden.hard_blocked_code_patterns regex /${re.source}/`, hard: true });
          break;
        }
      }

      if (ns === 'OBS_') obsCount++;
    }

    if (obsCount > OBS_NAMESPACE_CAP) {
      issues.push({ contract: 'dictionary', path: 'codes (OBS_*)', message: `OBS_* code count (${obsCount}) exceeds v1 cap of ${OBS_NAMESPACE_CAP} (signal-truth §12.2)`, hard: true });
    }
  }

  // §F.5 — reserved UX_ namespace
  if (isObject(d.codes)) {
    for (const code of Object.keys(d.codes as Record<string, unknown>)) {
      if (code.startsWith('UX_')) {
        // Already raised above via namespaceOf path; safe to leave.
        break;
      }
    }
  }

  return issues;
}

/* --------------------------------------------------------------------------
 * assertScoringContractsOrThrow
 *
 * Load + validate. Throw with a readable multi-line issue list on any
 * HARD issue. This is the function future PR#5 / PR#6 workers MUST call
 * at startup before any session is scored.
 * ------------------------------------------------------------------------ */

export function assertScoringContractsOrThrow(opts?: { rootDir?: string }): ScoringContracts {
  const c = loadScoringContracts(opts);
  const issues = validateScoringContracts(c);
  const hard = issues.filter((i) => i.hard);
  if (hard.length > 0) {
    throw new Error(formatIssues('Scoring contract validation FAILED', hard));
  }
  return c;
}

function formatIssues(header: string, issues: ContractValidationIssue[]): string {
  const lines = [header + ':'];
  for (const i of issues) {
    lines.push(`  [${i.contract}] ${i.path}: ${i.message}`);
  }
  return lines.join('\n');
}

/* --------------------------------------------------------------------------
 * isReasonCodeStructurallyAllowed / assertReasonCodeStructurallyAllowed
 *
 * STRUCTURAL validity check ONLY. These helpers do NOT authorise
 * lane-specific emission (OD-4). Lane policy is the future worker /
 * observer's responsibility.
 * ------------------------------------------------------------------------ */

export function isReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): boolean {
  if (!isObject(c.dictionary?.codes)) return false;
  const entry = (c.dictionary.codes as Record<string, unknown>)[code];
  if (!isObject(entry)) return false;

  const ns = namespaceOf(code);
  if (ns === null) return false;

  const prefixAllowlist = isStringArray(c.forbidden?.prefix_allowlist) ? c.forbidden.prefix_allowlist : [];
  if (!prefixAllowlist.includes(ns)) return false;

  const hardBlockedCodes = isStringArray(c.forbidden?.hard_blocked_codes) ? c.forbidden.hard_blocked_codes : [];
  if (hardBlockedCodes.includes(code)) return false;

  const hbPatterns = c.forbidden?.hard_blocked_code_patterns;
  if (isObject(hbPatterns) && isStringArray((hbPatterns as Record<string, unknown>).patterns)) {
    for (const p of (hbPatterns as Record<string, unknown>).patterns as string[]) {
      const re = tryCompileRegex(p);
      if (re && re.test(code)) return false;
    }
  }

  const e = entry as Record<string, unknown>;
  if (e.can_trigger_automated_action !== false) return false;

  return true;
}

export function assertReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): void {
  if (!isReasonCodeStructurallyAllowed(c, code)) {
    throw new Error(`Reason code ${JSON.stringify(code)} is not structurally allowed under the loaded contracts`);
  }
}

/* --------------------------------------------------------------------------
 * validateRuleReferences / assertRuleReferencesOrThrow
 *
 * Forward-defined helpers per §F.7. PR#4 ships these now even though
 * no Stage 0 / Stage 1 rule files exist yet; PR#5 / PR#6 call them
 * with their own rule-reference lists.
 * ------------------------------------------------------------------------ */

export function validateRuleReferences(c: ScoringContracts, refs: string[]): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  refs.forEach((code, i) => {
    if (!isReasonCodeStructurallyAllowed(c, code)) {
      issues.push({
        contract: 'dictionary',
        path:     `rule_references[${i}]`,
        message:  `rule reference ${JSON.stringify(code)} is not structurally allowed (missing from dictionary, prefix not in allowlist, hard-blocked, or can_trigger_automated_action !== false)`,
        hard:     true,
      });
    }
  });
  return issues;
}

export function assertRuleReferencesOrThrow(c: ScoringContracts, refs: string[]): void {
  const issues = validateRuleReferences(c, refs);
  const hard = issues.filter((i) => i.hard);
  if (hard.length > 0) {
    throw new Error(formatIssues('Rule-reference validation FAILED', hard));
  }
}

/* --------------------------------------------------------------------------
 * checkActiveScoringSourceAgainstForbiddenPatterns
 *
 * PR#4 central CI source-code grep (Step B per planning doc §G.5).
 *
 *   Scope (IN):  src/scoring/**
 *                scripts/check-scoring-contracts.ts (if present)
 *   Scope (OUT): scoring/*.yml (self-referential)
 *                docs/**, tests/**, tests/fixtures/**
 *                migrations/**, src/collector/v1/**, src/app.ts, src/server.ts,
 *                src/auth/**, scripts/extract-behavioural-features.ts
 *
 *   Patterns: forbidden.string_patterns_blocked_in_code.patterns ONLY.
 *             Hard-blocked-code-patterns are scoped to emitted reason
 *             codes and are NOT used here (Codex non-blocking note #2).
 * ------------------------------------------------------------------------ */

const ACTIVE_SCORING_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walkActiveScoringFiles(rootDir: string): string[] {
  const out: string[] = [];
  const scoringDir = join(rootDir, 'src', 'scoring');
  const cliPath    = join(rootDir, 'scripts', 'check-scoring-contracts.ts');
  // src/scoring/**
  const stack: string[] = [];
  try {
    statSync(scoringDir);
    stack.push(scoringDir);
  } catch {
    /* tree absent — fresh checkout edge case; skip */
  }
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
        stack.push(full);
        continue;
      }
      if (ACTIVE_SCORING_EXTENSIONS.test(full)) out.push(full);
    }
  }
  // scripts/check-scoring-contracts.ts only (sibling scripts/ files are NOT in scope)
  try {
    statSync(cliPath);
    out.push(cliPath);
  } catch {
    /* not yet present in fresh checkouts; tolerated */
  }
  return out;
}

export interface CheckSourceOptions {
  rootDir?: string;
  /**
   * Optional override of the loaded forbidden contract — primarily for
   * tests that want to assert detector behaviour against synthetic
   * patterns. If omitted, contracts are loaded from disk.
   */
  forbidden?: ForbiddenCodes;
  /**
   * Optional extra in-memory file bodies to scan in addition to the
   * default active-scoring tree. Useful for tests that simulate a
   * forbidden string appearing in active scoring source without
   * actually writing such a file to disk.
   */
  extraSources?: Array<{ path: string; body: string }>;
}

export function checkActiveScoringSourceAgainstForbiddenPatterns(
  opts?: CheckSourceOptions,
): ContractValidationIssue[] {
  const root = resolveRootDir(opts);
  const forbidden = opts?.forbidden ?? loadScoringContracts(opts).forbidden;
  const issues: ContractValidationIssue[] = [];

  const patternsBlock = forbidden.string_patterns_blocked_in_code;
  if (!isObject(patternsBlock) || !isStringArray((patternsBlock as Record<string, unknown>).patterns)) {
    issues.push({
      contract: 'forbidden',
      path:     'string_patterns_blocked_in_code.patterns',
      message:  'patterns missing or not string[]; cannot run source-code grep',
      hard:     true,
    });
    return issues;
  }
  const rawPatterns = (patternsBlock as Record<string, unknown>).patterns as string[];

  const files = walkActiveScoringFiles(root);
  const bodies: Array<{ path: string; body: string }> = files.map((p) => ({
    path: p,
    body: readFileSync(p, 'utf8'),
  }));
  if (opts?.extraSources) bodies.push(...opts.extraSources);

  for (const { path, body } of bodies) {
    const stripped = stripTsComments(body);
    for (const pat of rawPatterns) {
      // Patterns may be plain substrings (e.g. `fraud_confirmed`) or
      // quoted/import-shape strings (e.g. `"import sklearn"`). Use
      // simple substring detection: the .patterns array is small and
      // false-positive-tolerant.
      if (stripped.includes(pat)) {
        issues.push({
          contract: 'forbidden',
          path:     `${path.slice(root.length + 1)}::${pat}`,
          message:  `active scoring source contains forbidden source-code string ${JSON.stringify(pat)}`,
          hard:     true,
        });
      }
    }
  }
  return issues;
}

export function assertActiveScoringSourceCleanOrThrow(opts?: CheckSourceOptions): void {
  const issues = checkActiveScoringSourceAgainstForbiddenPatterns(opts);
  const hard = issues.filter((i) => i.hard);
  if (hard.length > 0) {
    throw new Error(formatIssues('Active scoring source contains forbidden strings', hard));
  }
}
