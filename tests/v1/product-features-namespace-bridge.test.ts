/**
 * Sprint 2 PR#14b — ProductFeatures-Namespace Bridge — tests.
 *
 * Pure tests. No DB. No CLI. Pure mapper/validator coverage.
 *
 * Test groups (mapping to the spec's 21 testing requirements):
 *   A.  (1)  Valid minimal input → valid candidate
 *   B.  (2)  Required version fields are present on the output
 *   C.  (3)  preview_metadata flags are all literal `true`
 *   D.  (4)  Missing version field rejects
 *   E.  (5)  Invalid namespace_key_candidate rejects (output guard)
 *   F.  (6)  Invalid actionability band rejects
 *   G.  (7)  Unknown surface label rejects
 *   H.  (8)  Negative / fractional counts reject
 *   I.  (9)  mapping_coverage_percent outside 0..100 rejects
 *   J.  (10) Non-boolean pricing/comparison signal rejects
 *   K.  (11) Invalid hours_since_last_qualifying_activity rejects
 *   L.  (12) Forbidden AMS reserved-key in candidate rejects
 *   M.  (13) FIT.* / INTENT.* / WINDOW.* reason-code values reject
 *   N.  (14) Raw URL / query / email / company/person keys reject
 *   O.  (15) Full session_id field rejects
 *   P.  (16) Determinism — same input deep-equals same output
 *   Q.  (17) Static-source guard — no reserved AMS names defined
 *   R.  (18) Static-source guard — no Date.now / new Date / Math.random in mapper
 *   S.  (19) No SQL / DB / pg imports in bridge module
 *   T.  (20) No package.json change
 *   U.  (21) PR#13b observer untouched
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_CONVERSION_PROXIMITY_INDICATORS,
  AMS_PRODUCT_LAYER_REFERENCE_VERSION,
  BRIDGE_CONTRACT_VERSION,
  BRIDGE_PAYLOAD_VERSION,
  buildBridgeNamespaceCandidate,
  NAMESPACE_KEY_CANDIDATE,
  validateBridgeCandidate,
  validateBridgeMapperInput,
  type BridgeMapperInput,
  type BridgeNamespaceCandidate,
  type ValidateResult,
} from '../../src/scoring/product-features-namespace-bridge/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function mkInput(over: Partial<BridgeMapperInput> = {}): BridgeMapperInput {
  return {
    observer_version:                       'product-context-timing-observer-v0.1',
    product_context_profile_version:        'pcp-v0.1',
    universal_surface_taxonomy_version:     'ust-v0.1',
    category_template_version:              'generic_b2b-v0.1',
    buying_role_lens_version:               'brl-v0.1-deferred',
    site_mapping_version:                   'site_map-v0.1-baseline',
    excluded_mapping_version:               'excl_map-v0.1-baseline',
    timing_window_model_version:            'tw-v0.1',
    freshness_decay_model_version:          'fd-v0.1',
    source_poi_observation_versions:        ['poi-observation-v0.1'],
    source_poi_input_versions:              ['poi-core-input-v0.1'],
    source_poi_sequence_versions:           ['poi-sequence-v0.1'],
    category_template:                      'generic_b2b',
    primary_conversion_goal:                'request_diagnostic',
    sales_motion:                           'sales_led',
    surface_distribution:                   { pricing: 1, homepage: 7 },
    mapping_coverage_percent:               100.0,
    unknown_surface_count:                  0,
    excluded_surface_count:                 0,
    poi_count:                              1,
    unique_poi_count:                       1,
    pricing_signal_present:                 true,
    comparison_signal_present:              false,
    conversion_proximity_indicators:        { pricing_visited: 1 },
    hours_since_last_qualifying_activity_or_null: 12.5,
    buyerrecon_actionability_band:          'warm_recent',
    timing_bucket:                          '<=24h',
    progression_depth:                      1,
    ...over,
  };
}

function expectOk(result: ValidateResult): BridgeNamespaceCandidate {
  if (!result.ok) {
    throw new Error(`Expected ok candidate; got reject_reasons: ${result.reject_reasons.join(', ')}`);
  }
  return result.candidate;
}

function expectReject(result: ValidateResult): readonly string[] {
  if (result.ok) {
    throw new Error('Expected reject result; got ok candidate');
  }
  return result.reject_reasons;
}

/* --------------------------------------------------------------------------
 * A. Valid minimal input → valid candidate
 * ------------------------------------------------------------------------ */

describe('A. valid minimal input → valid candidate', () => {
  it('builds a non-empty BridgeNamespaceCandidate from baseline input', () => {
    const r = buildBridgeNamespaceCandidate(mkInput());
    const c = expectOk(r);
    expect(c.bridge_contract_version).toBe(BRIDGE_CONTRACT_VERSION);
    expect(c.bridge_payload_version).toBe(BRIDGE_PAYLOAD_VERSION);
    expect(c.namespace_key_candidate).toBe(NAMESPACE_KEY_CANDIDATE);
    expect(c.payload_candidate.fit_like_inputs.surface_distribution).toEqual({ homepage: 7, pricing: 1 });
    expect(c.payload_candidate.intent_like_inputs.poi_count).toBe(1);
    expect(c.payload_candidate.timing_like_inputs.buyerrecon_actionability_band).toBe('warm_recent');
  });

  it('ams_product_layer_reference_version defaults to v0.1 spec when input omits it', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    expect(c.ams_product_layer_reference_version).toBe(AMS_PRODUCT_LAYER_REFERENCE_VERSION);
  });

  it('caller-supplied ams_product_layer_reference_version is preserved', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput({
      ams_product_layer_reference_version: 'BUYERRECON_PRODUCT_LAYER_FUTURE_v2_1',
    })));
    expect(c.ams_product_layer_reference_version).toBe('BUYERRECON_PRODUCT_LAYER_FUTURE_v2_1');
  });
});

/* --------------------------------------------------------------------------
 * B. Required version fields are present on the output
 * ------------------------------------------------------------------------ */

describe('B. all required version stamps present on output', () => {
  it('candidate carries every required version field', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const required: readonly (keyof BridgeNamespaceCandidate)[] = [
      'bridge_contract_version',
      'bridge_payload_version',
      'generated_from_observer_version',
      'product_context_profile_version',
      'universal_surface_taxonomy_version',
      'category_template_version',
      'buying_role_lens_version',
      'site_mapping_version',
      'excluded_mapping_version',
      'timing_window_model_version',
      'freshness_decay_model_version',
      'ams_product_layer_reference_version',
    ];
    for (const k of required) {
      expect(typeof c[k]).toBe('string');
      expect((c[k] as string).length).toBeGreaterThan(0);
    }
    expect(Array.isArray(c.source_evidence_versions.poi_observation_versions)).toBe(true);
    expect(Array.isArray(c.source_evidence_versions.poi_input_versions)).toBe(true);
    expect(Array.isArray(c.source_evidence_versions.poi_sequence_versions)).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * C. preview_metadata flags are all literal `true`
 * ------------------------------------------------------------------------ */

describe('C. preview_metadata flags', () => {
  it('every preview_metadata flag is literally true', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    expect(c.preview_metadata.internal_only).toBe(true);
    expect(c.preview_metadata.non_authoritative).toBe(true);
    expect(c.preview_metadata.not_customer_facing).toBe(true);
    expect(c.preview_metadata.does_not_execute_ams_product_layer).toBe(true);
    expect(c.preview_metadata.does_not_create_product_decision).toBe(true);
    expect(c.preview_metadata.exact_ams_struct_compatibility_unproven_until_fixture).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * D. Missing version field rejects
 * ------------------------------------------------------------------------ */

describe('D. missing version field rejects', () => {
  it.each([
    'observer_version',
    'product_context_profile_version',
    'universal_surface_taxonomy_version',
    'category_template_version',
    'buying_role_lens_version',
    'site_mapping_version',
    'excluded_mapping_version',
    'timing_window_model_version',
    'freshness_decay_model_version',
  ])('rejects when %s is empty', (field) => {
    const input = mkInput({ [field]: '' } as Partial<BridgeMapperInput>);
    const reasons = expectReject(buildBridgeNamespaceCandidate(input));
    expect(reasons.some((r) => r.includes(field))).toBe(true);
  });

  it.each([
    'source_poi_observation_versions',
    'source_poi_input_versions',
    'source_poi_sequence_versions',
  ])('rejects when %s is not a string array', (field) => {
    const input = { ...mkInput(), [field]: null } as unknown as BridgeMapperInput;
    const reasons = expectReject(buildBridgeNamespaceCandidate(input));
    expect(reasons.some((r) => r.includes(field))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * E. Invalid namespace_key_candidate rejects (output-side guard)
 * ------------------------------------------------------------------------ */

describe('E. invalid namespace_key_candidate rejects', () => {
  it('post-mapper validator rejects tampered namespace_key_candidate', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    // Cast to a mutable shape and tamper; then re-validate.
    const tampered = { ...c, namespace_key_candidate: 'not_buyerrecon' as unknown as 'buyerrecon' };
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons).toContain('invalid_namespace_key_candidate');
  });
});

/* --------------------------------------------------------------------------
 * F. Invalid actionability band rejects
 * ------------------------------------------------------------------------ */

describe('F. invalid actionability band rejects', () => {
  it.each([
    'in_window',        // AMS WindowState — forbidden
    'approaching',      // AMS WindowState — forbidden
    'too_early',        // AMS WindowState — forbidden
    'totally_random',
    '',
  ])('rejects buyerrecon_actionability_band = %s', (band) => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ buyerrecon_actionability_band: band as never }),
    ));
    expect(reasons.some((r) => r.includes('buyerrecon_actionability_band'))).toBe(true);
  });

  it.each([
    'hot_now',
    'warm_recent',
    'cooling',
    'stale',
    'dormant',
    'insufficient_evidence',
  ])('accepts band = %s', (band) => {
    const r = buildBridgeNamespaceCandidate(mkInput({ buyerrecon_actionability_band: band as never }));
    expect(r.ok).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * G. Unknown surface label rejects
 * ------------------------------------------------------------------------ */

describe('G. unknown surface label rejects', () => {
  it('rejects surface_distribution containing a label outside the universal taxonomy', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ surface_distribution: { pricing: 1, totally_made_up_label: 2 } }),
    ));
    expect(reasons.some((r) => r.startsWith('unknown_surface_label:'))).toBe(true);
  });

  it('accepts the explicit "unknown" label (which IS in the taxonomy)', () => {
    const r = buildBridgeNamespaceCandidate(mkInput({
      surface_distribution: { pricing: 1, unknown: 3 },
    }));
    expect(r.ok).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * H. Negative / fractional counts reject
 * ------------------------------------------------------------------------ */

describe('H. negative / fractional counts reject', () => {
  it('rejects negative poi_count', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ poi_count: -1 })));
    expect(reasons).toContain('invalid_poi_count');
  });

  it('rejects fractional unique_poi_count', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ unique_poi_count: 1.5 })));
    expect(reasons).toContain('invalid_unique_poi_count');
  });

  it('rejects unique_poi_count > poi_count', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ poi_count: 1, unique_poi_count: 2 })));
    expect(reasons).toContain('unique_poi_count_exceeds_poi_count');
  });

  it('rejects negative unknown_surface_count', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ unknown_surface_count: -1 })));
    expect(reasons).toContain('invalid_unknown_surface_count');
  });

  it('rejects fractional progression_depth', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ progression_depth: 2.5 })));
    expect(reasons).toContain('invalid_progression_depth');
  });

  it('rejects negative count inside surface_distribution', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ surface_distribution: { pricing: -1 } }),
    ));
    expect(reasons).toContain('invalid_surface_distribution');
  });
});

/* --------------------------------------------------------------------------
 * I. mapping_coverage_percent outside 0..100 rejects
 * ------------------------------------------------------------------------ */

describe('I. mapping_coverage_percent outside 0..100 rejects', () => {
  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])('rejects mapping_coverage_percent = %s', (v) => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({ mapping_coverage_percent: v as number })));
    expect(reasons).toContain('invalid_mapping_coverage_percent');
  });

  it.each([0, 50.5, 100, 12.345])('accepts mapping_coverage_percent = %s', (v) => {
    const r = buildBridgeNamespaceCandidate(mkInput({ mapping_coverage_percent: v as number }));
    expect(r.ok).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * J. Non-boolean pricing/comparison signal rejects
 * ------------------------------------------------------------------------ */

describe('J. non-boolean pricing/comparison signal rejects', () => {
  it('rejects pricing_signal_present = "true" (string)', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ pricing_signal_present: 'true' as unknown as boolean }),
    ));
    expect(reasons).toContain('invalid_pricing_signal_present');
  });

  it('rejects comparison_signal_present = 1 (number)', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ comparison_signal_present: 1 as unknown as boolean }),
    ));
    expect(reasons).toContain('invalid_comparison_signal_present');
  });
});

/* --------------------------------------------------------------------------
 * K. Invalid hours_since_last_qualifying_activity rejects
 * ------------------------------------------------------------------------ */

describe('K. invalid hours_since_last_qualifying_activity rejects', () => {
  it('rejects negative hours', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ hours_since_last_qualifying_activity_or_null: -0.5 }),
    ));
    expect(reasons).toContain('invalid_hours_since_last_qualifying_activity_or_null');
  });

  it('rejects NaN / Infinity', () => {
    const r1 = expectReject(buildBridgeNamespaceCandidate(mkInput({
      hours_since_last_qualifying_activity_or_null: Number.NaN,
    })));
    expect(r1).toContain('invalid_hours_since_last_qualifying_activity_or_null');
    const r2 = expectReject(buildBridgeNamespaceCandidate(mkInput({
      hours_since_last_qualifying_activity_or_null: Number.POSITIVE_INFINITY,
    })));
    expect(r2).toContain('invalid_hours_since_last_qualifying_activity_or_null');
  });

  it('accepts null', () => {
    const r = buildBridgeNamespaceCandidate(mkInput({ hours_since_last_qualifying_activity_or_null: null }));
    expect(r.ok).toBe(true);
  });

  it('accepts 0 and positive finite values', () => {
    expect(buildBridgeNamespaceCandidate(mkInput({ hours_since_last_qualifying_activity_or_null: 0 })).ok).toBe(true);
    expect(buildBridgeNamespaceCandidate(mkInput({ hours_since_last_qualifying_activity_or_null: 1234.56 })).ok).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * L. Forbidden AMS reserved-key in candidate rejects
 * ------------------------------------------------------------------------ */

describe('L. forbidden AMS reserved-key in candidate', () => {
  it.each([
    'Fit', 'FitFeatures', 'FitScore', 'Intent', 'IntentState',
    'Window', 'WindowState', 'TRQ', 'TRQBand',
    'ProductDecision', 'ProductFeatures', 'BuyerReconProductFeatures',
    'RequestedAction', 'NonFitMarkers', 'HardSuppress',
    'fit', 'intent', 'window',  // lowercase JSON-key form also reserved in PR#14b
  ])('rejects when "%s" appears as a key anywhere in the candidate', (forbidden) => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    // Inject the forbidden key deep inside the candidate.
    const tampered = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    (tampered.payload_candidate as Record<string, unknown>)[forbidden] = { synthesized: true };
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons.some((r) => r.startsWith('forbidden_ams_runtime_key_present'))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * M. FIT.* / INTENT.* / WINDOW.* reason-code values reject
 * ------------------------------------------------------------------------ */

describe('M. FIT.* / INTENT.* / WINDOW.* reason-code values', () => {
  it.each([
    'FIT.DEGRADED_INPUTS',
    'INTENT.HIGH',
    'WINDOW.COMPRESSION_DETECTED',
  ])('rejects candidate containing reason-code value "%s"', (codeValue) => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const tampered = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    (tampered.payload_candidate as Record<string, unknown>).reason_token = codeValue;
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons.some((r) => r.startsWith('forbidden_ams_reason_namespace_value_present'))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * N. Raw URL / query / email / company/person keys reject
 * ------------------------------------------------------------------------ */

describe('N. raw URL / enrichment keys reject', () => {
  it.each([
    'page_url', 'full_url', 'url_query',
    'person_id', 'visitor_id', 'company_id', 'phone',
    'user_agent', 'ip', 'ip_hash', 'token_hash',
  ])('rejects when "%s" appears as a key in the candidate', (forbidden) => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const tampered = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    (tampered.payload_candidate as Record<string, unknown>)[forbidden] = 'leak';
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons.some((r) => r.startsWith('forbidden_pii_or_enrichment_key_present'))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * O. Full session_id field rejects
 * ------------------------------------------------------------------------ */

describe('O. full session_id field rejects', () => {
  it('rejects candidate containing a session_id key at any depth', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const tampered = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    ((tampered.payload_candidate as Record<string, unknown>).intent_like_inputs as Record<string, unknown>).session_id = 'sess_FULL_REVEAL';
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons.some((r) => r.startsWith('forbidden_pii_or_enrichment_key_present:session_id'))).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * P. Determinism — same input deep-equals same output
 * ------------------------------------------------------------------------ */

describe('P. determinism', () => {
  it('two consecutive runs on the same input produce deep-equal candidates', () => {
    const c1 = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const c2 = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    expect(c2).toEqual(c1);
  });

  it('JSON.stringify is byte-identical across runs (deterministic key order)', () => {
    const c1 = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const c2 = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    expect(JSON.stringify(c2)).toBe(JSON.stringify(c1));
  });

  it('surface_distribution + conversion_proximity_indicators sort keys consistently', () => {
    const input = mkInput({
      surface_distribution: { pricing: 1, homepage: 7, demo_request: 2 },
      conversion_proximity_indicators: { pricing_visited: 1, demo_request_visited: 1, comparison_visited: 0 },
    });
    const c = expectOk(buildBridgeNamespaceCandidate(input));
    expect(Object.keys(c.payload_candidate.fit_like_inputs.surface_distribution)).toEqual(['demo_request', 'homepage', 'pricing']);
    expect(Object.keys(c.payload_candidate.intent_like_inputs.conversion_proximity_indicators)).toEqual(['comparison_visited', 'demo_request_visited', 'pricing_visited']);
  });
});

/* --------------------------------------------------------------------------
 * Q. + R. + S. Static-source sweep over PR#14b runtime files
 * ------------------------------------------------------------------------ */

const PR14B_RUNTIME_FILES = [
  'src/scoring/product-features-namespace-bridge/types.ts',
  'src/scoring/product-features-namespace-bridge/mapper.ts',
  'src/scoring/product-features-namespace-bridge/validate.ts',
  'src/scoring/product-features-namespace-bridge/index.ts',
];

function readSource(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('Q. static-source guard — no reserved AMS names defined', () => {
  it('does NOT define any reserved AMS Product Layer name as a TypeScript identifier', () => {
    const reservedTypeNames = [
      'FitFeatures', 'FitResult', 'FitScore', 'FitConfidence01',
      'IntentFeatures', 'IntentResult', 'IntentScore', 'IntentState',
      'WindowFeatures', 'WindowResult', 'WindowState',
      'TRQResult', 'TRQBand', 'TRQScore', 'TRQConfidence01',
      'ProductDecision', 'ProductFeatures', 'ProductScorerInput',
      'ProductScorer', 'BuyerReconConfig', 'BuyerReconProductFeatures',
      'RequestedAction', 'NonFitMarkers', 'HardSuppress',
    ];
    for (const f of PR14B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      for (const name of reservedTypeNames) {
        const definitionRe = new RegExp(`\\b(?:type|interface|class|enum|const|function|let|var)\\s+${name}\\b`);
        expect(src, `${f} must not define identifier "${name}"`).not.toMatch(definitionRe);
      }
    }
  });

  it('does NOT emit `FIT.` / `INTENT.` / `WINDOW.` reason-code namespace strings as constants', () => {
    const re = /['"`](?:FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*['"`]/;
    for (const f of PR14B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not contain FIT./INTENT./WINDOW. reason-code namespace string literal`).not.toMatch(re);
    }
  });
});

describe('R. static-source guard — no Date.now / new Date / Math.random in mapper', () => {
  it('mapper.ts contains no Date.now / new Date / Math.random / crypto', () => {
    const src = stripTsComments(readSource('src/scoring/product-features-namespace-bridge/mapper.ts'));
    expect(src).not.toMatch(/\bDate\.now\s*\(/);
    expect(src).not.toMatch(/\bnew\s+Date\b/);
    expect(src).not.toMatch(/\bMath\.random\s*\(/);
    expect(src).not.toMatch(/\bcrypto\b/);
  });

  it('validate.ts contains no Date.now / new Date / Math.random / crypto', () => {
    const src = stripTsComments(readSource('src/scoring/product-features-namespace-bridge/validate.ts'));
    expect(src).not.toMatch(/\bDate\.now\s*\(/);
    expect(src).not.toMatch(/\bnew\s+Date\b/);
    expect(src).not.toMatch(/\bMath\.random\s*\(/);
    expect(src).not.toMatch(/\bcrypto\b/);
  });
});

describe('S. no SQL / DB / pg imports in bridge module', () => {
  it('no `import ... pg`, no `from "pg"`, no `process.env`, no SQL FROM/JOIN/INSERT', () => {
    for (const f of PR14B_RUNTIME_FILES) {
      const src = stripTsComments(readSource(f));
      expect(src, `${f} must not import pg`).not.toMatch(/from\s+['"]pg['"]/);
      expect(src, `${f} must not read process.env`).not.toMatch(/\bprocess\.env\b/);
      expect(src, `${f} must not contain SQL FROM`).not.toMatch(/\bFROM\s+[a-z_]/i);
      expect(src, `${f} must not contain SQL JOIN`).not.toMatch(/\bJOIN\s+[a-z_]/i);
      expect(src, `${f} must not contain INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/);
      expect(src, `${f} must not contain UPDATE … SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
      expect(src, `${f} must not contain DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/);
    }
  });
});

/* --------------------------------------------------------------------------
 * T. No package.json change
 * ------------------------------------------------------------------------ */

describe('T. no package.json change', () => {
  it('package.json contains no `observe:product-features-namespace-bridge` or similar new script', () => {
    const pkg = readSource('package.json');
    expect(pkg).not.toContain('product-features-namespace-bridge');
    expect(pkg).not.toContain('observe:product-features');
  });
});

/* --------------------------------------------------------------------------
 * U. PR#13b observer untouched
 * ------------------------------------------------------------------------ */

describe('U. PR#13b observer untouched', () => {
  it('PR#13b observer types.ts still exports OBSERVER_VERSION = product-context-timing-observer-v0.1', () => {
    const src = readSource('src/scoring/product-context-timing-observer/types.ts');
    expect(src).toContain(`'product-context-timing-observer-v0.1'`);
  });

  it('PR#13b observer mapper still exports classifyUniversalSurface + classifyActionabilityBand', () => {
    const src = readSource('src/scoring/product-context-timing-observer/mapper.ts');
    expect(src).toContain('export function classifyUniversalSurface');
    expect(src).toContain('export function classifyActionabilityBand');
  });

  it('PR#13b runner still exports runProductContextTimingObserver', () => {
    const src = readSource('src/scoring/product-context-timing-observer/runner.ts');
    expect(src).toContain('export async function runProductContextTimingObserver');
  });
});

/* --------------------------------------------------------------------------
 * V. Pre-mapper validator returns reasons cleanly (no throw on bad input)
 * ------------------------------------------------------------------------ */

describe('V. validators are pure (no throws on malformed input)', () => {
  it('validateBridgeMapperInput returns array on null input', () => {
    const r = validateBridgeMapperInput(null);
    expect(Array.isArray(r)).toBe(true);
    expect(r).toContain('input_not_object');
  });

  it('validateBridgeCandidate returns array on null candidate', () => {
    const r = validateBridgeCandidate(null);
    expect(Array.isArray(r)).toBe(true);
    expect(r).toContain('candidate_not_object');
  });

  it('validators do not throw on completely arbitrary input shapes', () => {
    expect(() => validateBridgeMapperInput({ random: 'garbage' })).not.toThrow();
    expect(() => validateBridgeMapperInput([1, 2, 3])).not.toThrow();
    expect(() => validateBridgeMapperInput('string')).not.toThrow();
    expect(() => validateBridgeCandidate({ random: 'garbage' })).not.toThrow();
    expect(() => validateBridgeCandidate(123)).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * W. conversion_proximity_indicators KEY allowlist (Codex blocker)
 *
 * Free-form `Record<string, number>` previously validated only
 * values. Codex flagged that raw URLs / query strings /
 * email-shaped tokens could enter as keys and bypass the recursive
 * PII sweep. The patch pins keys to
 * `ALLOWED_CONVERSION_PROXIMITY_INDICATORS` at both pre-mapper and
 * post-mapper validation.
 * ------------------------------------------------------------------------ */

describe('W. conversion_proximity_indicators key allowlist', () => {
  it('exports ALLOWED_CONVERSION_PROXIMITY_INDICATORS containing the v0.1 trio', () => {
    expect([...ALLOWED_CONVERSION_PROXIMITY_INDICATORS]).toEqual([
      'pricing_visited',
      'comparison_visited',
      'demo_request_visited',
    ]);
  });

  it.each([
    { pricing_visited: 1 },
    { comparison_visited: 0 },
    { demo_request_visited: 3 },
    { pricing_visited: 1, comparison_visited: 0, demo_request_visited: 2 },
  ])('accepts allowed-key map: %p', (map) => {
    const r = buildBridgeNamespaceCandidate(mkInput({ conversion_proximity_indicators: map }));
    expect(r.ok).toBe(true);
  });

  it('accepts empty conversion_proximity_indicators map', () => {
    const r = buildBridgeNamespaceCandidate(mkInput({ conversion_proximity_indicators: {} }));
    expect(r.ok).toBe(true);
  });

  it.each([
    'random_other_visit',
    'made_up_indicator',
  ])('rejects unknown indicator key: %s', (key) => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { [key]: 1 } }),
    ));
    expect(reasons.some((r) => r.startsWith('unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });

  it('rejects raw URL-shaped indicator key', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { 'https://example.com/demo?email=person@example.com': 1 } }),
    ));
    expect(reasons.some((r) => r.startsWith('unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });

  it('rejects query-string-shaped indicator key', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { 'utm_source=linkedin': 1 } }),
    ));
    expect(reasons.some((r) => r.startsWith('unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });

  it('rejects email-shaped indicator key', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { 'person@example.com': 1 } }),
    ));
    expect(reasons.some((r) => r.startsWith('unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });

  it('rejects mixed allowed + forbidden keys (reports the forbidden one)', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(mkInput({
      conversion_proximity_indicators: {
        pricing_visited: 1,
        'leaked.url/path': 1,
      },
    })));
    expect(reasons.some((r) => r === 'unknown_conversion_proximity_indicator_key:leaked.url/path')).toBe(true);
  });

  it('rejects negative indicator value', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { pricing_visited: -1 } }),
    ));
    expect(reasons.some((r) => r.startsWith('invalid_conversion_proximity_indicator_value:pricing_visited'))).toBe(true);
  });

  it('rejects fractional indicator value', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { pricing_visited: 1.5 } }),
    ));
    expect(reasons.some((r) => r.startsWith('invalid_conversion_proximity_indicator_value:pricing_visited'))).toBe(true);
  });

  it('rejects non-number indicator value', () => {
    const reasons = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: { pricing_visited: '1' as unknown as number } }),
    ));
    expect(reasons.some((r) => r.startsWith('invalid_conversion_proximity_indicator_value:pricing_visited'))).toBe(true);
  });

  it('rejects non-object conversion_proximity_indicators (array / null / scalar)', () => {
    const r1 = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: [] as unknown as Record<string, number> }),
    ));
    expect(r1).toContain('invalid_conversion_proximity_indicators');

    const r2 = expectReject(buildBridgeNamespaceCandidate(
      mkInput({ conversion_proximity_indicators: null as unknown as Record<string, number> }),
    ));
    expect(r2).toContain('invalid_conversion_proximity_indicators');
  });

  it('post-mapper validator rejects tampered candidate with forbidden indicator key', () => {
    const c = expectOk(buildBridgeNamespaceCandidate(mkInput()));
    const tampered = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    const intent = (tampered.payload_candidate as Record<string, unknown>).intent_like_inputs as Record<string, unknown>;
    intent.conversion_proximity_indicators = { 'https://leaked.example/demo': 1 };
    const reasons = validateBridgeCandidate(tampered);
    expect(reasons.some((r) => r.startsWith('payload_unknown_conversion_proximity_indicator_key:'))).toBe(true);
  });
});
