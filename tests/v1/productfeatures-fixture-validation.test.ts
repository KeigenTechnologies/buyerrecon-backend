/**
 * Sprint 2 PR#14f — ProductFeatures fixture validation tests.
 *
 * Test-only. Loads the PR#14e BuyerRecon-side fixture JSON files
 * (under `docs/fixtures/productfeatures-namespace/`) and validates:
 *
 *   1. the valid fixture matches the PR#14b bridge candidate contract;
 *   2. the invalid-cases catalogue is correctly categorised and
 *      covers I-1 through I-18 exactly once;
 *   3. a test-local fixture privacy value scanner detects URL- /
 *      query- / email-shape string VALUES that current PR#14b
 *      validator does not claim to scan as values (Codex blocker
 *      from PR#14d / PR#14e — the precise PR#14b vs PR#14f
 *      boundary);
 *   4. no AMS runtime, no `ProductDecision`, no customer output,
 *      no DB.
 *
 * Test groups (A..N):
 *   A.  Fixture files exist (paths)
 *   B.  JSON parse + object (not array)
 *   C.  Valid fixture top-level shape
 *   D.  PR#14b `validateBridgeCandidate` accepts the valid candidate
 *   E.  Valid candidate value-by-value checks
 *   F.  Valid fixture forbidden-token scan (raw text)
 *   G.  Invalid fixture top-level shape
 *   H.  case_id coverage I-1..I-18 exactly once each
 *   I.  Invalid-case → expected_reject_reason_family mapping
 *   J.  PR#14b validator behaviour on PR#14b-family cases (I-9..I-14, I-18)
 *   K.  Test-local fixture privacy value scan helper (I-6, I-7, I-8)
 *   L.  README alignment grep
 *   M.  Scope / static guard — no package / migration / schema / DB / AMS / Render touch
 *   N.  Helper sanity — value-only scanner ignores key names
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_CONVERSION_PROXIMITY_INDICATORS,
  AMS_PRODUCT_LAYER_REFERENCE_VERSION,
  BRIDGE_ACTIONABILITY_BANDS_ALLOWED,
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  BRIDGE_UNIVERSAL_SURFACES_ALLOWED,
  NAMESPACE_KEY_CANDIDATE,
  validateBridgeCandidate,
  validateBridgeMapperInput,
} from '../../src/scoring/product-features-namespace-bridge/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

const FIXTURE_DIR              = 'docs/fixtures/productfeatures-namespace';
const FIXTURE_README_PATH      = `${FIXTURE_DIR}/README.md`;
const FIXTURE_VALID_PATH       = `${FIXTURE_DIR}/buyerrecon-candidate-valid-v0.1.json`;
const FIXTURE_INVALID_PATH     = `${FIXTURE_DIR}/buyerrecon-candidate-invalid-v0.1.json`;

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}
function readFixtureJson(rel: string): unknown {
  return JSON.parse(readRepo(rel));
}

/* --------------------------------------------------------------------------
 * Test-local PR#14f fixture privacy VALUE scanner.
 *
 * Current PR#14b validator rejects forbidden raw-URL / query / email
 * KEYS via `FORBIDDEN_PII_KEYS`. It does NOT claim general value-
 * shape scanning. This helper is the value-shape side of the
 * fixture privacy posture promised by PR#14d / PR#14e and required
 * by future fixture-consumer tests.
 *
 * The scanner walks parsed JSON recursively and only examines
 * STRING VALUES (not keys). It returns an array of findings
 * `{ kind, value, path }` for any value matching the URL / query /
 * email / person-or-company-enrichment patterns.
 * ------------------------------------------------------------------------ */

type PrivacyValueFinding = {
  readonly kind:  'url_value' | 'query_string_value' | 'email_value' | 'person_or_company_enrichment_value';
  readonly value: string;
  readonly path:  string;
};

const URL_VALUE_PATTERN          = /^https?:\/\//i;
const QUERY_STRING_VALUE_PATTERN = /(?:\?|^)[A-Za-z0-9_.-]+=[^&\s]+(?:&[A-Za-z0-9_.-]+=[^&\s]+)*/;
const EMAIL_VALUE_PATTERN        = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PERSON_OR_COMPANY_PATTERN  = /\b(?:[Ll]td|[Ll]td\.|[Ii]nc|[Ii]nc\.|GmbH|S\.A\.|@person|@company)\b/;

function scanPrivacyValuesOf(node: unknown, path: string, out: PrivacyValueFinding[]): void {
  if (node === null) return;
  if (typeof node === 'string') {
    if (URL_VALUE_PATTERN.test(node)) {
      out.push({ kind: 'url_value', value: node, path });
    } else if (EMAIL_VALUE_PATTERN.test(node)) {
      out.push({ kind: 'email_value', value: node, path });
    } else if (QUERY_STRING_VALUE_PATTERN.test(node)) {
      out.push({ kind: 'query_string_value', value: node, path });
    } else if (PERSON_OR_COMPANY_PATTERN.test(node)) {
      out.push({ kind: 'person_or_company_enrichment_value', value: node, path });
    }
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      scanPrivacyValuesOf(node[i], `${path}[${i}]`, out);
    }
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      scanPrivacyValuesOf(obj[k], path === '' ? k : `${path}.${k}`, out);
    }
  }
}

function scanPrivacyValues(node: unknown): readonly PrivacyValueFinding[] {
  const out: PrivacyValueFinding[] = [];
  scanPrivacyValuesOf(node, '', out);
  return Object.freeze(out);
}

/* --------------------------------------------------------------------------
 * A. Fixture files exist
 * ------------------------------------------------------------------------ */

describe('A. fixture files exist', () => {
  it('docs/fixtures/productfeatures-namespace/README.md exists', () => {
    expect(existsSync(join(REPO_ROOT, FIXTURE_README_PATH))).toBe(true);
    expect(statSync(join(REPO_ROOT, FIXTURE_README_PATH)).size).toBeGreaterThan(0);
  });
  it('valid fixture JSON exists', () => {
    expect(existsSync(join(REPO_ROOT, FIXTURE_VALID_PATH))).toBe(true);
  });
  it('invalid fixture JSON exists', () => {
    expect(existsSync(join(REPO_ROOT, FIXTURE_INVALID_PATH))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * B. JSON parse + object (not array)
 * ------------------------------------------------------------------------ */

describe('B. JSON parse + object (not array)', () => {
  it('valid fixture parses as a JSON object', () => {
    const v = readFixtureJson(FIXTURE_VALID_PATH);
    expect(v).not.toBeNull();
    expect(typeof v).toBe('object');
    expect(Array.isArray(v)).toBe(false);
  });
  it('invalid fixture parses as a JSON object', () => {
    const v = readFixtureJson(FIXTURE_INVALID_PATH);
    expect(v).not.toBeNull();
    expect(typeof v).toBe('object');
    expect(Array.isArray(v)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * C. Valid fixture top-level shape
 * ------------------------------------------------------------------------ */

describe('C. valid fixture top-level shape', () => {
  const v = readFixtureJson(FIXTURE_VALID_PATH) as Record<string, unknown>;
  it('has fixture_id', ()      => { expect(typeof v.fixture_id).toBe('string');      expect((v.fixture_id      as string).length).toBeGreaterThan(0); });
  it('has fixture_version', () => { expect(typeof v.fixture_version).toBe('string'); expect((v.fixture_version as string).length).toBeGreaterThan(0); });
  it('fixture_status === "valid_candidate"', () => { expect(v.fixture_status).toBe('valid_candidate'); });
  it('has fixture_notes', ()   => { expect(typeof v.fixture_notes).toBe('string');   expect((v.fixture_notes   as string).length).toBeGreaterThan(0); });
  it('has product_features_namespace_candidate object', () => {
    expect(typeof v.product_features_namespace_candidate).toBe('object');
    expect(v.product_features_namespace_candidate).not.toBeNull();
    expect(Array.isArray(v.product_features_namespace_candidate)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * D. PR#14b validateBridgeCandidate accepts the valid candidate
 * ------------------------------------------------------------------------ */

describe('D. PR#14b validateBridgeCandidate accepts the valid candidate', () => {
  const v = readFixtureJson(FIXTURE_VALID_PATH) as Record<string, unknown>;
  const candidate = v.product_features_namespace_candidate as Record<string, unknown>;

  it('returns empty reject-reason array', () => {
    const reasons = validateBridgeCandidate(candidate);
    expect(reasons, `unexpected reject reasons: ${JSON.stringify(reasons)}`).toEqual([]);
  });

  it('bridge_contract_version matches PR#14b constant', () => {
    expect(candidate.bridge_contract_version).toBe(BRIDGE_CONTRACT_VERSION);
    expect(candidate.bridge_contract_version).toBe('productfeatures-namespace-bridge-contract-v0.1');
  });
  it('bridge_payload_version matches PR#14b constant', () => {
    expect(candidate.bridge_payload_version).toBe(BRIDGE_PAYLOAD_VERSION);
    expect(candidate.bridge_payload_version).toBe('productfeatures-namespace-candidate-v0.1');
  });
  it('namespace_key_candidate is "buyerrecon"', () => {
    expect(candidate.namespace_key_candidate).toBe(NAMESPACE_KEY_CANDIDATE);
    expect(candidate.namespace_key_candidate).toBe('buyerrecon');
  });
  it('ams_product_layer_reference_version matches PR#14b default constant', () => {
    expect(candidate.ams_product_layer_reference_version).toBe(AMS_PRODUCT_LAYER_REFERENCE_VERSION);
  });

  it('preview_metadata flags are every literal `true`', () => {
    const pm = candidate.preview_metadata as Record<string, unknown>;
    for (const flag of [
      'internal_only',
      'non_authoritative',
      'not_customer_facing',
      'does_not_execute_ams_product_layer',
      'does_not_create_product_decision',
      'exact_ams_struct_compatibility_unproven_until_fixture',
    ]) {
      expect(pm[flag], `preview_metadata.${flag} must be true`).toBe(true);
    }
  });
});

/* --------------------------------------------------------------------------
 * E. Valid candidate value-by-value checks
 * ------------------------------------------------------------------------ */

describe('E. valid candidate value-by-value', () => {
  const v = readFixtureJson(FIXTURE_VALID_PATH) as Record<string, unknown>;
  const candidate = v.product_features_namespace_candidate as Record<string, unknown>;
  const payload   = candidate.payload_candidate as Record<string, unknown>;
  const fit       = payload.fit_like_inputs    as Record<string, unknown>;
  const intent    = payload.intent_like_inputs as Record<string, unknown>;
  const timing    = payload.timing_like_inputs as Record<string, unknown>;

  it('surface_distribution matches spec', () => {
    const sd = fit.surface_distribution as Record<string, number>;
    expect(sd.homepage).toBe(1);
    expect(sd.pricing).toBe(1);
    expect(sd.demo_request).toBe(1);
    expect(sd.unknown).toBe(1);
    for (const label of Object.keys(sd)) {
      expect(BRIDGE_UNIVERSAL_SURFACES_ALLOWED).toContain(label);
    }
  });
  it('mapping_coverage_percent === 75',       () => { expect(fit.mapping_coverage_percent).toBe(75); });
  it('unknown_surface_count === 1',           () => { expect(fit.unknown_surface_count).toBe(1); });
  it('excluded_surface_count === 0',          () => { expect(fit.excluded_surface_count).toBe(0); });
  it('category_template === "generic_b2b"',   () => { expect(fit.category_template).toBe('generic_b2b'); });

  it('pricing_signal_present === true',       () => { expect(intent.pricing_signal_present).toBe(true); });
  it('comparison_signal_present === false',   () => { expect(intent.comparison_signal_present).toBe(false); });
  it('conversion_proximity_indicators only contains allowlisted keys', () => {
    const cpi = intent.conversion_proximity_indicators as Record<string, number>;
    const keys = Object.keys(cpi);
    for (const k of keys) {
      expect(ALLOWED_CONVERSION_PROXIMITY_INDICATORS).toContain(k);
    }
    expect(new Set(keys)).toEqual(new Set(['pricing_visited', 'comparison_visited', 'demo_request_visited']));
  });

  it('hours_since_last_qualifying_activity_or_null === 6.5', () => {
    expect(timing.hours_since_last_qualifying_activity_or_null).toBe(6.5);
  });
  it('buyerrecon_actionability_band === "hot_now" and is allowed', () => {
    expect(timing.buyerrecon_actionability_band).toBe('hot_now');
    expect(BRIDGE_ACTIONABILITY_BANDS_ALLOWED).toContain(timing.buyerrecon_actionability_band);
  });
  it('timing_bucket === "<=24h"',          () => { expect(timing.timing_bucket).toBe('<=24h'); });
  it('progression_depth === 3',            () => { expect(timing.progression_depth).toBe(3); });
  it('sales_motion === "sales_led"',       () => { expect(timing.sales_motion).toBe('sales_led'); });
  it('primary_conversion_goal === "request_diagnostic"', () => {
    expect(timing.primary_conversion_goal).toBe('request_diagnostic');
  });
});

/* --------------------------------------------------------------------------
 * F. Valid fixture forbidden-token scan (raw text)
 *
 * The valid fixture MUST NOT contain real PII / AMS-runtime / score
 * tokens. `not_customer_facing` is an allowed safety-metadata flag
 * and is exempted by the `\b` word boundary not matching after `not_`.
 *
 * Forbidden tokens constructed via array-join to keep this file
 * from carrying the literal `customer` + `_facing` token next to
 * each other in source.
 * ------------------------------------------------------------------------ */

describe('F. valid fixture forbidden-token scan', () => {
  // Constructed at module load to keep the literal forbidden-token
  // strings out of source-form. This mirrors the PR#14b types.ts
  // module-load construction pattern (PR#3 carve-out precedent).
  const CUSTOMER_FACING_TOKEN = ['customer', 'facing'].join('_');
  const EMAIL_TOKEN           = ['e', 'mail'].join('');

  const FORBIDDEN_TOKENS_WORD: readonly string[] = Object.freeze([
    'session_id',
    'truncated_session_id_prefix',
    'page_url',
    'full_url',
    'url_query',
    'query',
    EMAIL_TOKEN,
    'phone',
    'person_id',
    'visitor_id',
    'company_id',
    'account_id',
    'ip',
    'ip_hash',
    'user_agent',
    'token_hash',
    'ProductDecision',
    'ProductFeatures',
    'BuyerReconProductFeatures',
    'FitScore',
    'IntentScore',
    'WindowState',
    'TRQ',
    CUSTOMER_FACING_TOKEN,
    'report',
    'verdict',
  ]);
  const FORBIDDEN_TOKENS_DOTTED: readonly string[] = Object.freeze(['FIT.', 'INTENT.', 'WINDOW.']);

  const src = readRepo(FIXTURE_VALID_PATH);

  for (const t of FORBIDDEN_TOKENS_WORD) {
    it(`valid fixture must not contain word-boundary token "${t}"`, () => {
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      expect(src, `unexpected forbidden token ${t} in valid fixture`).not.toMatch(re);
    });
  }
  for (const t of FORBIDDEN_TOKENS_DOTTED) {
    it(`valid fixture must not contain dotted token "${t}"`, () => {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      expect(src, `unexpected forbidden token ${t} in valid fixture`).not.toMatch(re);
    });
  }

  it('`not_customer_facing` (allowed safety flag) IS present in valid fixture (sanity)', () => {
    expect(src).toContain(['not', 'customer', 'facing'].join('_'));
  });
});

/* --------------------------------------------------------------------------
 * G. Invalid fixture top-level shape
 * ------------------------------------------------------------------------ */

describe('G. invalid fixture top-level shape', () => {
  const inv = readFixtureJson(FIXTURE_INVALID_PATH) as Record<string, unknown>;
  it('has fixture_id', ()      => { expect(typeof inv.fixture_id).toBe('string'); });
  it('has fixture_version', () => { expect(typeof inv.fixture_version).toBe('string'); });
  it('fixture_status === "invalid_cases"', () => { expect(inv.fixture_status).toBe('invalid_cases'); });
  it('has fixture_notes', ()   => { expect(typeof inv.fixture_notes).toBe('string'); });
  it('invalid_cases is a non-empty array', () => {
    expect(Array.isArray(inv.invalid_cases)).toBe(true);
    expect((inv.invalid_cases as unknown[]).length).toBeGreaterThan(0);
  });
});

/* --------------------------------------------------------------------------
 * H. case_id coverage I-1 .. I-18 exactly once each + family allowlist
 * ------------------------------------------------------------------------ */

interface InvalidCase {
  readonly case_id: string;
  readonly description: string;
  readonly expected_reject_reason_family: string;
  readonly candidate_patch_or_bad_fragment: unknown;
}

const EXPECTED_FAMILIES: readonly string[] = Object.freeze([
  'pr14b_validator_required_fields',
  'pr14b_validator_enum_or_allowlist',
  'pr14f_fixture_privacy_value_scan',
  'pr14b_validator_forbidden_keys',
  'pr14b_validator_reason_namespace_string',
  'pr14b_validator_numeric',
]);

describe('H. case_id coverage I-1..I-18', () => {
  const inv = readFixtureJson(FIXTURE_INVALID_PATH) as Record<string, unknown>;
  const cases = inv.invalid_cases as readonly InvalidCase[];

  it('contains exactly I-1 .. I-18, each once', () => {
    const ids = cases.map((c) => c.case_id);
    const expected = Array.from({ length: 18 }, (_, i) => `I-${i + 1}`);
    expect(new Set(ids)).toEqual(new Set(expected));
    expect(ids.length).toBe(18);
    for (const id of expected) {
      expect(ids.filter((x) => x === id).length).toBe(1);
    }
  });

  it('every expected_reject_reason_family is on the EXPECTED_FAMILIES allowlist', () => {
    for (const c of cases) {
      expect(EXPECTED_FAMILIES, `case ${c.case_id} family ${c.expected_reject_reason_family}`).toContain(c.expected_reject_reason_family);
    }
  });

  it('all six expected families are represented at least once across the catalogue', () => {
    const fams = new Set(cases.map((c) => c.expected_reject_reason_family));
    for (const f of EXPECTED_FAMILIES) {
      expect(fams, `expected family ${f} not used`).toContain(f);
    }
  });
});

/* --------------------------------------------------------------------------
 * I. Invalid-case → expected_reject_reason_family mapping
 * ------------------------------------------------------------------------ */

const EXPECTED_FAMILY_BY_CASE_ID: Readonly<Record<string, string>> = Object.freeze({
  'I-1':  'pr14b_validator_required_fields',
  'I-2':  'pr14b_validator_enum_or_allowlist',
  'I-3':  'pr14b_validator_enum_or_allowlist',
  'I-4':  'pr14b_validator_enum_or_allowlist',
  'I-5':  'pr14b_validator_enum_or_allowlist',
  'I-6':  'pr14f_fixture_privacy_value_scan',
  'I-7':  'pr14f_fixture_privacy_value_scan',
  'I-8':  'pr14f_fixture_privacy_value_scan',
  'I-9':  'pr14b_validator_forbidden_keys',
  'I-10': 'pr14b_validator_forbidden_keys',
  'I-11': 'pr14b_validator_forbidden_keys',
  'I-12': 'pr14b_validator_reason_namespace_string',
  'I-13': 'pr14b_validator_reason_namespace_string',
  'I-14': 'pr14b_validator_reason_namespace_string',
  'I-15': 'pr14b_validator_numeric',
  'I-16': 'pr14b_validator_numeric',
  'I-17': 'pr14b_validator_numeric',
  'I-18': 'pr14b_validator_forbidden_keys',
});

describe('I. invalid case → expected_reject_reason_family mapping', () => {
  const inv = readFixtureJson(FIXTURE_INVALID_PATH) as Record<string, unknown>;
  const cases = inv.invalid_cases as readonly InvalidCase[];
  const byId = new Map<string, InvalidCase>(cases.map((c) => [c.case_id, c]));

  for (const [caseId, expectedFamily] of Object.entries(EXPECTED_FAMILY_BY_CASE_ID)) {
    it(`${caseId} → ${expectedFamily}`, () => {
      const c = byId.get(caseId);
      expect(c, `case ${caseId} missing`).toBeDefined();
      expect(c!.expected_reject_reason_family).toBe(expectedFamily);
    });
  }
});

/* --------------------------------------------------------------------------
 * J. PR#14b validator behaviour on PR#14b-family cases
 *
 * For cases the catalogue claims PR#14b rejects today, apply the
 * patch fragment onto a deep copy of the valid candidate and assert
 * `validateBridgeCandidate` produces a reject reason of the
 * expected family.
 * ------------------------------------------------------------------------ */

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function deepMergeInto(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    const existing = target[k];
    if (isRecord(existing) && isRecord(v)) {
      deepMergeInto(existing, v);
    } else {
      target[k] = deepClone(v);
    }
  }
}

function getInvalidCase(byId: ReadonlyMap<string, InvalidCase>, caseId: string): InvalidCase {
  const c = byId.get(caseId);
  if (c === undefined) {
    throw new Error(`missing invalid fixture case ${caseId}`);
  }
  return c;
}

function applyInvalidFixtureFragment(
  validCandidate: Record<string, unknown>,
  invalidCase: InvalidCase,
): Record<string, unknown> {
  const bad = deepClone(validCandidate);
  const fragment = invalidCase.candidate_patch_or_bad_fragment;
  if (!isRecord(fragment)) {
    throw new Error(`invalid fixture case ${invalidCase.case_id} patch fragment must be an object`);
  }

  const omitFields = fragment.omit_fields_from_valid_candidate;
  if (omitFields !== undefined) {
    if (!Array.isArray(omitFields)) {
      throw new Error(`invalid fixture case ${invalidCase.case_id} omit_fields_from_valid_candidate must be an array`);
    }
    for (const field of omitFields) {
      if (typeof field !== 'string' || field.length === 0) {
        throw new Error(`invalid fixture case ${invalidCase.case_id} omit field must be a non-empty string`);
      }
      delete bad[field];
    }
    return bad;
  }

  deepMergeInto(bad, fragment);
  return bad;
}

function extractUnknownSurfaceLabel(invalidCase: InvalidCase): string {
  const fragment = invalidCase.candidate_patch_or_bad_fragment;
  if (!isRecord(fragment)) {
    throw new Error(`invalid fixture case ${invalidCase.case_id} patch fragment must be an object`);
  }
  const payload = fragment.payload_candidate;
  if (!isRecord(payload)) {
    throw new Error(`invalid fixture case ${invalidCase.case_id} missing payload_candidate fragment`);
  }
  const fit = payload.fit_like_inputs;
  if (!isRecord(fit)) {
    throw new Error(`invalid fixture case ${invalidCase.case_id} missing fit_like_inputs fragment`);
  }
  const surfaceDistribution = fit.surface_distribution;
  if (!isRecord(surfaceDistribution)) {
    throw new Error(`invalid fixture case ${invalidCase.case_id} missing surface_distribution fragment`);
  }

  const unknownLabels = Object.keys(surfaceDistribution).filter((label) => !BRIDGE_UNIVERSAL_SURFACES_ALLOWED.includes(label as never));
  expect(unknownLabels, `${invalidCase.case_id} must carry exactly one unknown surface label in the fixture fragment`).toHaveLength(1);
  return unknownLabels[0]!;
}

describe('J. PR#14b validator rejects PR#14b-family invalid cases', () => {
  const v = readFixtureJson(FIXTURE_VALID_PATH) as Record<string, unknown>;
  const validCandidate = v.product_features_namespace_candidate as Record<string, unknown>;
  const inv = readFixtureJson(FIXTURE_INVALID_PATH) as Record<string, unknown>;
  const cases = inv.invalid_cases as readonly InvalidCase[];
  const byId = new Map<string, InvalidCase>(cases.map((c) => [c.case_id, c]));

  it('I-2: namespace_key_candidate not "buyerrecon" → invalid_namespace_key_candidate', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-2'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('invalid_namespace_key_candidate');
  });

  it('I-4: actionability_band="in_window" (AMS WindowState value) → payload_invalid_buyerrecon_actionability_band', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-4'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('payload_invalid_buyerrecon_actionability_band');
  });

  it('I-5: unknown conversion_proximity_indicator key → unknown_conversion_proximity_indicator_key:landing_visited', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-5'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons.some((r) => r.startsWith('payload_unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });

  it('I-9: full session_id key → forbidden_pii_or_enrichment_key_present:session_id', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-9'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_pii_or_enrichment_key_present:session_id');
  });

  it('I-10: ProductDecision key anywhere → forbidden_ams_runtime_key_present:ProductDecision', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-10'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_ams_runtime_key_present:ProductDecision');
  });

  it('I-11: ProductFeatures key anywhere → forbidden_ams_runtime_key_present:ProductFeatures', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-11'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_ams_runtime_key_present:ProductFeatures');
  });

  it('I-12: FIT.PRICE_VISITED string value → forbidden_ams_reason_namespace_value_present:FIT.PRICE_VISITED', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-12'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_ams_reason_namespace_value_present:FIT.PRICE_VISITED');
  });
  it('I-13: INTENT.HIGH string value → forbidden_ams_reason_namespace_value_present:INTENT.HIGH', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-13'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_ams_reason_namespace_value_present:INTENT.HIGH');
  });
  it('I-14: WINDOW.IN_WINDOW string value → forbidden_ams_reason_namespace_value_present:WINDOW.IN_WINDOW', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-14'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('forbidden_ams_reason_namespace_value_present:WINDOW.IN_WINDOW');
  });

  it('I-15: negative poi_count → payload_invalid_poi_count', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-15'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('payload_invalid_poi_count');
  });
  it('I-16: fractional unique_poi_count → payload_invalid_unique_poi_count', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-16'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('payload_invalid_unique_poi_count');
  });
  it('I-17: mapping_coverage_percent = 150 → payload_invalid_mapping_coverage_percent', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-17'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('payload_invalid_mapping_coverage_percent');
  });

  it('I-18: customer_facing key in payload → forbidden_pii_or_enrichment_key_present:customer_facing', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-18'));
    const customerFacingKey = ['customer', 'facing'].join('_');
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain(`forbidden_pii_or_enrichment_key_present:${customerFacingKey}`);
  });

  it('I-1: required field bridge_contract_version absent → missing_candidate_field:bridge_contract_version', () => {
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-1'));
    const reasons = validateBridgeCandidate(bad);
    expect(reasons).toContain('missing_candidate_field:bridge_contract_version');
  });

  it('I-3: unknown surface label is caught by validateBridgeMapperInput (pre-mapper)', () => {
    // I-3 falls to the pre-mapper input validator (universal-surface
    // taxonomy allowlist) rather than the post-mapper candidate validator.
    // Extract the offending label from the fixture fragment, then
    // feed that exact label into a mapper-input-shaped object.
    const unknownSurfaceLabel = extractUnknownSurfaceLabel(getInvalidCase(byId, 'I-3'));
    const reasons = validateBridgeMapperInput({
      observer_version: 'x', product_context_profile_version: 'x',
      universal_surface_taxonomy_version: 'x', category_template_version: 'x',
      buying_role_lens_version: 'x', site_mapping_version: 'x',
      excluded_mapping_version: 'x', timing_window_model_version: 'x',
      freshness_decay_model_version: 'x',
      source_poi_observation_versions: ['v'], source_poi_input_versions: ['v'],
      source_poi_sequence_versions: ['v'],
      category_template: 'generic_b2b', primary_conversion_goal: 'request_diagnostic',
      sales_motion: 'sales_led',
      surface_distribution: { homepage: 1, [unknownSurfaceLabel]: 2 },
      mapping_coverage_percent: 100,
      unknown_surface_count: 0, excluded_surface_count: 0,
      poi_count: 0, unique_poi_count: 0,
      pricing_signal_present: false, comparison_signal_present: false,
      conversion_proximity_indicators: {},
      hours_since_last_qualifying_activity_or_null: null,
      buyerrecon_actionability_band: 'insufficient_evidence',
      timing_bucket: '<=24h', progression_depth: 0,
    });
    expect(reasons).toContain(`unknown_surface_label:${unknownSurfaceLabel}`);
  });

  it('applyInvalidFixtureFragment does not mutate the original valid candidate', () => {
    const before = JSON.stringify(validCandidate);
    const bad = applyInvalidFixtureFragment(validCandidate, getInvalidCase(byId, 'I-10'));
    expect(bad).not.toBe(validCandidate);
    expect(JSON.stringify(validCandidate)).toBe(before);
  });
});

/* --------------------------------------------------------------------------
 * K. Test-local fixture privacy VALUE scanner catches I-6, I-7, I-8
 * ------------------------------------------------------------------------ */

describe('K. fixture privacy value scan (PR#14f-side, not PR#14b)', () => {
  const inv = readFixtureJson(FIXTURE_INVALID_PATH) as Record<string, unknown>;
  const cases = inv.invalid_cases as readonly InvalidCase[];
  const byId = new Map<string, InvalidCase>(cases.map((c) => [c.case_id, c]));

  it('I-6 fragment triggers a url_value or query_string_value finding', () => {
    const c = byId.get('I-6')!;
    const findings = scanPrivacyValues(c.candidate_patch_or_bad_fragment);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.kind === 'url_value' || f.kind === 'query_string_value')).toBe(true);
  });

  it('I-7 fragment triggers a query_string_value finding', () => {
    const c = byId.get('I-7')!;
    const findings = scanPrivacyValues(c.candidate_patch_or_bad_fragment);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.kind === 'query_string_value')).toBe(true);
  });

  it('I-8 fragment triggers an email_value finding', () => {
    const c = byId.get('I-8')!;
    const findings = scanPrivacyValues(c.candidate_patch_or_bad_fragment);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.kind === 'email_value')).toBe(true);
  });

  it('I-9 fragment is NOT classified as a PR#14f privacy VALUE finding (it is a PR#14b forbidden-key case)', () => {
    const c = byId.get('I-9')!;
    expect(c.expected_reject_reason_family).toBe('pr14b_validator_forbidden_keys');
    const findings = scanPrivacyValues(c.candidate_patch_or_bad_fragment);
    expect(findings.length).toBe(0);
  });

  it('valid fixture passes the PR#14f privacy value scan with zero findings', () => {
    const v = readFixtureJson(FIXTURE_VALID_PATH);
    const findings = scanPrivacyValues(v);
    expect(findings, `unexpected privacy findings in valid fixture: ${JSON.stringify(findings)}`).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
 * L. README alignment grep
 * ------------------------------------------------------------------------ */

describe('L. README alignment', () => {
  const readme = readRepo(FIXTURE_README_PATH);

  it('README states no real full session IDs anywhere', () => {
    expect(readme).toContain('real full session IDs');
  });
  it('README clarifies invalid fixture contains one synthetic full-session-id-shaped value only in I-9', () => {
    expect(readme).toContain('full-session-id-shaped');
    expect(readme).toContain('case `I-9`');
  });
  it('README clarifies I-6/I-7/I-8 are PR#14f fixture privacy value-scan cases', () => {
    expect(readme).toContain('`pr14f_fixture_privacy_value_scan`');
    expect(readme).toMatch(/\bI-6\b/);
    expect(readme).toMatch(/\bI-7\b/);
    expect(readme).toMatch(/\bI-8\b/);
  });
  it('README clarifies I-9 is a current PR#14b forbidden-key case', () => {
    expect(readme).toContain('forbidden-key case');
  });
  it('README states exact AMS Go struct compatibility remains unproven until AMS-side fixture test passes', () => {
    expect(readme).toContain('exact_ams_struct_compatibility_unproven_until_fixture');
    expect(readme.toLowerCase()).toContain('unproven');
  });
  it('README states no AMS Product Layer execution', () => {
    expect(readme).toContain('Does not execute AMS Product Layer');
  });
  it('README states no ProductDecision creation', () => {
    expect(readme).toContain('Does not create');
    expect(readme).toContain('`ProductDecision`');
  });
});

/* --------------------------------------------------------------------------
 * M. Scope / static guard — no package / migration / schema / DB / AMS / Render touch
 * ------------------------------------------------------------------------ */

const PR14F_TEST_FILE = 'tests/v1/productfeatures-fixture-validation.test.ts';

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('M. scope / static guards', () => {
  it('package.json carries no new observe:* script added by PR#14f', () => {
    const pkg = readRepo('package.json');
    expect(pkg).not.toContain('observe:productfeatures-fixture');
    expect(pkg).not.toContain('observe:product-features-fixture');
    expect(pkg).not.toContain('fixture-validation');
  });

  it('PR#14f test file has no pg / src-db / AMS-runtime imports', () => {
    const src = stripTsComments(readRepo(PR14F_TEST_FILE));
    expect(src).not.toMatch(/from\s+['"]pg['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*\/db\/[^'"]+['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*\/ams\/[^'"]*['"]/i);
  });

  it('PR#14f test file does not read the env or contain SQL DML/DQL', () => {
    // Build scan patterns at runtime so this file's own scanner
    // regex literals don't carry the literal target substrings.
    const src = stripTsComments(readRepo(PR14F_TEST_FILE));
    const envRe       = new RegExp('\\b' + 'process' + '\\.env\\b');
    const sqlFromRe   = new RegExp('\\b' + 'FROM'   + '\\s+[a-z_]',                'i');
    const sqlInsertRe = new RegExp('\\b' + 'INSERT' + '\\s+INTO\\b',               'i');
    const sqlUpdateRe = new RegExp('\\b' + 'UPDATE' + '\\s+[a-z_][a-z0-9_]*\\s+SET\\b', 'i');
    const sqlDeleteRe = new RegExp('\\b' + 'DELETE' + '\\s+FROM\\b',               'i');
    expect(src).not.toMatch(envRe);
    expect(src).not.toMatch(sqlFromRe);
    expect(src).not.toMatch(sqlInsertRe);
    expect(src).not.toMatch(sqlUpdateRe);
    expect(src).not.toMatch(sqlDeleteRe);
  });

  it('PR#14f test file does not import AMS scorer / adapter / contracts', () => {
    const src = stripTsComments(readRepo(PR14F_TEST_FILE));
    expect(src).not.toMatch(/buyerrecon\/scorer/);
    expect(src).not.toMatch(/buyerrecon\/adapter/);
    expect(src).not.toMatch(/internal\/contracts/);
  });

  it('PR#14f test file does not mint a ProductDecision constant or call any scorer entrypoint', () => {
    const src = stripTsComments(readRepo(PR14F_TEST_FILE));
    expect(src).not.toMatch(/\b(?:type|interface|class|enum|const|function|let|var)\s+ProductDecision\b/);
    expect(src).not.toMatch(/\bnew\s+ProductScorer\b/);
    expect(src).not.toMatch(/\bRequestedAction\b/);
  });
});

/* --------------------------------------------------------------------------
 * N. Helper sanity — value-only scanner ignores key names
 * ------------------------------------------------------------------------ */

describe('N. fixture privacy value scanner ignores KEY names (values only)', () => {
  it('a URL-shape KEY without a URL-shape VALUE produces zero findings', () => {
    const node = { ['https://example.test/path']: 'safe_value' };
    const findings = scanPrivacyValues(node);
    expect(findings).toEqual([]);
  });
  it('an email-shape KEY without an email-shape VALUE produces zero findings', () => {
    const node = { ['someone@example.test']: 'safe_value' };
    const findings = scanPrivacyValues(node);
    expect(findings).toEqual([]);
  });
  it('a URL-shape VALUE under any benign key is flagged', () => {
    const node = { some_key: 'https://example.test/pricing' };
    const findings = scanPrivacyValues(node);
    expect(findings.length).toBe(1);
    expect(findings[0]!.kind).toBe('url_value');
  });
  it('an email-shape VALUE under any benign key is flagged', () => {
    const node = { some_key: 'sample.user@example.test' };
    const findings = scanPrivacyValues(node);
    expect(findings.length).toBe(1);
    expect(findings[0]!.kind).toBe('email_value');
  });
  it('a query-string-shape VALUE under any benign key is flagged', () => {
    const node = { some_key: '?utm_source=test&utm_campaign=demo' };
    const findings = scanPrivacyValues(node);
    expect(findings.some((f) => f.kind === 'query_string_value')).toBe(true);
  });
});
