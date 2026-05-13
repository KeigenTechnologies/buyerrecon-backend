/**
 * Sprint 2 PR#10 — POI Core Input — pure tests.
 *
 * Pure: no DB connection. Tests cover all 11 PR#9a §9 surfaces:
 *
 *   A. Normalised path / route key generation
 *   B. Query string stripping
 *   C. CTA / form ID allowlist shape
 *   D. evidence_refs required
 *   E. No raw forbidden fields in serialised output
 *   F. No Lane A/B output
 *   G. No Policy / Trust imports
 *   H. No visitor / person / company identity fields
 *   I. Stable natural key (deterministic)
 *   J. Version mismatch rejection
 *   K. Malformed evidence_refs row-level reject (adapter throws here
 *      since PR#10 is contract-only; an observer would catch + map)
 *
 * Plus auxiliary:
 *   L. Stage 0 eligibility carry-through (OD-7)
 *   M. UTM context (OD-4 — context only, never POI key)
 *   N. Static-source boundary sweep (no DB / Lane A/B / Policy / Trust
 *      imports / identity fields in active source)
 *   O. Immutability — input not mutated; envelope deep-frozen
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  buildPoiCoreInput,
  classifyOfferSurface,
  classifyReferrer,
  deriveRoutePattern,
  normalisePagePath,
  normaliseUtmCampaignClass,
  normaliseUtmMediumClass,
  normaliseUtmSourceClass,
  OFFER_SURFACE,
  OFFER_SURFACES_ALLOWED,
  POI_CORE_INPUT_VERSION,
  POI_SURFACE_CLASS,
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPE,
  POI_TYPES_ALLOWED,
  REFERRER_CLASS,
  REFERRER_CLASSES_ALLOWED,
  validateCtaId,
  validateFormId,
  type BuildPoiCoreInputArgs,
  type PoiContext,
  type PoiCoreInput,
  type PoiEvidenceRef,
  type PoiSourceRow,
  type PoiStage0Context,
  type PoiSurfaceClass,
  type PoiType,
  type RawSurfaceObservation,
  type RouteRule,
} from '../../src/scoring/poi-core/index.js';

const ROOT = join(__dirname, '..', '..');
const VERSION_FILE   = join(ROOT, 'src', 'scoring', 'poi-core', 'version.ts');
const TYPES_FILE     = join(ROOT, 'src', 'scoring', 'poi-core', 'types.ts');
const NORMALISE_FILE = join(ROOT, 'src', 'scoring', 'poi-core', 'normalise.ts');
const ADAPTER_FILE   = join(ROOT, 'src', 'scoring', 'poi-core', 'adapter.ts');
const INDEX_FILE     = join(ROOT, 'src', 'scoring', 'poi-core', 'index.ts');

const PR10_ACTIVE_SOURCES: ReadonlyArray<[string, string]> = [
  ['src/scoring/poi-core/version.ts',   VERSION_FILE],
  ['src/scoring/poi-core/types.ts',     TYPES_FILE],
  ['src/scoring/poi-core/normalise.ts', NORMALISE_FILE],
  ['src/scoring/poi-core/adapter.ts',   ADAPTER_FILE],
  ['src/scoring/poi-core/index.ts',     INDEX_FILE],
];

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

const FIXED_DERIVED_AT = '2026-05-13T14:00:00.000Z';

function baselineSourceRow(overrides: Partial<PoiSourceRow> = {}): PoiSourceRow {
  return {
    source_table:                'session_features',
    source_row_id:               'session_features_row_001',
    workspace_id:                'buyerrecon_staging_ws',
    site_id:                     'buyerrecon_com',
    session_id:                  'sess-pr10-abcdef0123',
    source_event_count:          5,
    evidence_refs: [
      { table: 'session_features', session_features_id: 1, feature_version: 'session-features-v0.1' },
    ],
    first_seen_at:               '2026-05-13T13:55:00.000Z',
    last_seen_at:                '2026-05-13T13:58:00.000Z',
    behavioural_feature_version: null,
    ...overrides,
  };
}

function baselineRawSurface(overrides: Partial<RawSurfaceObservation> = {}): RawSurfaceObservation {
  return {
    raw_page_path:    'https://buyerrecon.com/pricing?utm_campaign=q2',
    raw_referrer:     'https://www.google.com/search?q=buyerrecon',
    cta_id:           'cta_pricing_book_demo',
    form_id:          'form_signup_email_v2',
    raw_offer_surface: 'pricing',
    route_rules:      [{ pattern: /\/users\/\d+/, replacement: '/users/:id' }],
    poi_surface_class: null,
    ...overrides,
  };
}

function baselineArgs(overrides: Partial<BuildPoiCoreInputArgs> = {}): BuildPoiCoreInputArgs {
  return {
    source_row:        baselineSourceRow(),
    raw_surface:       baselineRawSurface(),
    poi_type:          POI_TYPE.PAGE_PATH,
    derived_at:        FIXED_DERIVED_AT,
    scoring_version:   's2.v1.0',
    poi_input_version: POI_CORE_INPUT_VERSION,
    ...overrides,
  };
}

function baselineStage0(overrides: Partial<PoiStage0Context> = {}): PoiStage0Context {
  return {
    stage0_decision_id: '00000000-0000-4000-8000-0000000000aa',
    stage0_version:     'stage0-hard-exclusion-v0.2',
    excluded:           false,
    rule_id:            'no_stage0_exclusion',
    record_only:        true,
    ...overrides,
  };
}

/* ==========================================================================
 * GROUP A — Normalised path / route key generation
 * ========================================================================== */

describe('PR#10 — A. normalisePagePath', () => {
  it('strips scheme + host + query + fragment from a full URL', () => {
    expect(normalisePagePath('https://buyerrecon.com/pricing?token=abc#section1')).toBe('/pricing');
  });

  it('accepts a path-only input', () => {
    expect(normalisePagePath('/pricing')).toBe('/pricing');
  });

  it('lower-cases the path', () => {
    expect(normalisePagePath('https://buyerrecon.com/Demo')).toBe('/demo');
    expect(normalisePagePath('/Pricing')).toBe('/pricing');
  });

  it('collapses duplicate slashes', () => {
    expect(normalisePagePath('https://buyerrecon.com//pricing///plans')).toBe('/pricing/plans');
  });

  it('removes trailing slash (except root)', () => {
    expect(normalisePagePath('https://buyerrecon.com/pricing/')).toBe('/pricing');
    expect(normalisePagePath('/')).toBe('/');
    expect(normalisePagePath('https://buyerrecon.com/')).toBe('/');
  });

  it('preserves hyphens, underscores, dots (legitimate URL chars)', () => {
    expect(normalisePagePath('/my-page')).toBe('/my-page');
    expect(normalisePagePath('/snake_case_page')).toBe('/snake_case_page');
    expect(normalisePagePath('/file.html')).toBe('/file.html');
  });

  it('rejects empty / non-string / no-leading-slash paths', () => {
    expect(normalisePagePath('')).toBeNull();
    expect(normalisePagePath(null)).toBeNull();
    expect(normalisePagePath(undefined)).toBeNull();
    expect(normalisePagePath(42)).toBeNull();
    expect(normalisePagePath('relative-path')).toBeNull();
  });

  it('rejects paths containing whitespace or control characters', () => {
    expect(normalisePagePath('/has space')).toBeNull();
    expect(normalisePagePath('/has\ttab')).toBeNull();
    expect(normalisePagePath('/has\nnewline')).toBeNull();
  });
});

describe('PR#10 — A. deriveRoutePattern', () => {
  const userIdRule: RouteRule  = { pattern: /\/users\/\d+/, replacement: '/users/:id' };
  const slugRule: RouteRule    = { pattern: /\/post\/[a-z0-9-]+/, replacement: '/post/:slug' };

  it('collapses numeric IDs using a single rule', () => {
    expect(deriveRoutePattern('/users/12345', [userIdRule])).toBe('/users/:id');
  });

  it('applies multiple rules in order', () => {
    expect(deriveRoutePattern('/users/789/post/my-article', [userIdRule, slugRule])).toBe('/users/:id/post/:slug');
  });

  it('returns the path verbatim when no rule matches', () => {
    expect(deriveRoutePattern('/pricing', [userIdRule])).toBe('/pricing');
  });

  it('returns null for null/empty input', () => {
    expect(deriveRoutePattern(null, [userIdRule])).toBeNull();
    expect(deriveRoutePattern('', [userIdRule])).toBeNull();
  });

  it('ignores malformed rules silently (no throw)', () => {
    expect(deriveRoutePattern('/users/1', [{ pattern: null as unknown as RegExp, replacement: ':id' }])).toBe('/users/1');
    expect(deriveRoutePattern('/users/1', [{ pattern: /\d+/, replacement: null as unknown as string }])).toBe('/users/1');
  });
});

/* ==========================================================================
 * GROUP B — Query string stripping (covered in part by Group A; reinforced)
 * ========================================================================== */

describe('PR#10 — B. Query string stripping', () => {
  it('strips ?token=...', () => {
    expect(normalisePagePath('https://buyerrecon.com/pricing?token=secret')).toBe('/pricing');
  });

  it('strips ?email=...', () => {
    expect(normalisePagePath('https://buyerrecon.com/welcome?email=a@b.com')).toBe('/welcome');
  });

  it('strips multi-param query', () => {
    expect(normalisePagePath('https://buyerrecon.com/p?a=1&b=2&c=3')).toBe('/p');
  });

  it('strips fragment', () => {
    expect(normalisePagePath('https://buyerrecon.com/p#section')).toBe('/p');
  });

  it('path-only input with ? gets the ? stripped (defence in depth)', () => {
    expect(normalisePagePath('/p?token=x')).toBe('/p');
  });

  it('built envelope page_path key never contains a ? character', () => {
    const env = buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.PAGE_PATH,
      raw_surface: baselineRawSurface({ raw_page_path: 'https://buyerrecon.com/pricing?token=abc&utm=foo' }),
    }));
    expect(env.poi.poi_key).toBe('/pricing');
    expect(env.poi.poi_key).not.toContain('?');
    expect(env.poi.poi_key).not.toContain('token');
  });
});

/* ==========================================================================
 * GROUP C — CTA / form ID allowlist shape
 * ========================================================================== */

describe('PR#10 — C. CTA / form ID allowlist', () => {
  it('validateCtaId accepts cta_[a-z0-9_]+ shapes', () => {
    expect(validateCtaId('cta_pricing_book_demo')).toBe('cta_pricing_book_demo');
    expect(validateCtaId('cta_x')).toBe('cta_x');
    expect(validateCtaId('cta_a1_b2_c3')).toBe('cta_a1_b2_c3');
  });

  it('validateCtaId rejects malformed shapes', () => {
    expect(validateCtaId('CTA_Pricing')).toBeNull();          // upper-case
    expect(validateCtaId('cta-pricing')).toBeNull();          // hyphen instead of underscore
    expect(validateCtaId('cta_')).toBeNull();                 // trailing underscore only
    expect(validateCtaId('not_cta')).toBeNull();              // wrong prefix
    expect(validateCtaId('pricing')).toBeNull();              // no prefix
    expect(validateCtaId('Book a Demo')).toBeNull();          // raw text (button label)
    expect(validateCtaId('cta_pricing book')).toBeNull();     // space
    expect(validateCtaId('cta_' + 'x'.repeat(65))).toBeNull(); // too long
    expect(validateCtaId('')).toBeNull();
    expect(validateCtaId(null)).toBeNull();
    expect(validateCtaId(42)).toBeNull();
  });

  it('validateFormId accepts form_[a-z0-9_]+ shapes', () => {
    expect(validateFormId('form_signup_email_v2')).toBe('form_signup_email_v2');
    expect(validateFormId('form_x')).toBe('form_x');
  });

  it('validateFormId rejects malformed shapes', () => {
    expect(validateFormId('FORM_Signup')).toBeNull();
    expect(validateFormId('form-signup')).toBeNull();
    expect(validateFormId('Sign up here')).toBeNull();
    expect(validateFormId('form_')).toBeNull();
    expect(validateFormId('')).toBeNull();
    expect(validateFormId(null)).toBeNull();
  });

  it('adapter rejects when poi_type=cta_id but cta_id fails allowlist', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      poi_type:    POI_TYPE.CTA_ID,
      raw_surface: baselineRawSurface({ cta_id: 'Book a Demo Now!' }),
    }))).toThrow(/cta_id failed allowlist validation/);
  });

  it('adapter rejects when poi_type=form_id but form_id fails allowlist', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      poi_type:    POI_TYPE.FORM_ID,
      raw_surface: baselineRawSurface({ form_id: 'Sign up please' }),
    }))).toThrow(/form_id failed allowlist validation/);
  });
});

/* ==========================================================================
 * GROUP D — evidence_refs required
 * ========================================================================== */

describe('PR#10 — D. evidence_refs required', () => {
  it('rejects when source_row.evidence_refs is not an array', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: null as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs must be an array/);
  });

  it('rejects when source_row.evidence_refs is empty', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: [] }),
    }))).toThrow(/at least one provenance entry/);
  });

  it('rejects evidence_refs entries that are not plain objects', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: [null] as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs\[0\] is not a plain object/);
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: ['bad'] as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs\[0\] is not a plain object/);
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: [42] as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs\[0\] is not a plain object/);
  });

  it('rejects evidence_refs entries with missing or empty .table', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: [{ table: '' }] as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs\[0\]\.table must be a non-empty string/);
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: [{ other_field: 'x' }] as unknown as readonly PoiEvidenceRef[] }),
    }))).toThrow(/evidence_refs\[0\]\.table must be a non-empty string/);
  });

  it('evidence_refs are preserved verbatim on the envelope', () => {
    const refs = [
      { table: 'session_features', session_features_id: 9, feature_version: 'session-features-v0.1' },
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 3, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions', stage0_decision_id: 'abc-001', rule_id: 'no_stage0_exclusion' },
    ];
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: refs }),
    }));
    expect(env.evidence_refs).toHaveLength(3);
    expect(env.evidence_refs[0]).toEqual(refs[0]);
    expect(env.evidence_refs[1]).toEqual(refs[1]);
    expect(env.evidence_refs[2]).toEqual(refs[2]);
  });
});

/* ==========================================================================
 * GROUP E — No raw forbidden fields in serialised output
 * ========================================================================== */

describe('PR#10 — E. No raw forbidden fields in serialised output', () => {
  it('envelope JSON contains no token / ip / user_agent / pepper / bearer / authorization / raw_payload / canonical_jsonb / page_url / query strings', () => {
    const env = buildPoiCoreInput(baselineArgs());
    const json = JSON.stringify(env);
    const forbidden = [
      'token_hash', 'token', 'ip_hash', 'ip_address', 'user_agent', 'pepper',
      'bearer', 'authorization', 'Authorization', 'raw_payload', 'canonical_jsonb',
      'page_url', // explicit raw URL field name
      '?',         // any literal query-string marker leaking through
    ];
    for (const f of forbidden) {
      expect(json).not.toContain(f);
    }
  });

  it('even when evidence_refs carry forbidden subkeys, the envelope passes them through verbatim (caller controls upstream privacy) — but the adapter does NOT inject any of these itself', () => {
    // PR#9a §7.4: evidence_refs point at derived layers; if the caller
    // ever passes a forbidden subkey, that's the caller's bug. The
    // adapter still must not INVENT any forbidden field. This test
    // exercises the verbatim-preservation behaviour while documenting
    // the boundary.
    const refs = [
      { table: 'session_features', session_features_id: 7, feature_version: 'session-features-v0.1' },
      // Caller-supplied evidence-ref with a forbidden subkey would
      // round-trip verbatim. Production callers must not do this.
    ];
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: refs }),
    }));
    // The adapter itself emits no forbidden fields on the envelope structure.
    expect(Object.keys(env)).not.toContain('user_agent');
    expect(Object.keys(env)).not.toContain('ip_hash');
    expect(Object.keys(env)).not.toContain('token_hash');
    expect(Object.keys(env)).not.toContain('raw_payload');
    expect(Object.keys(env.poi)).not.toContain('user_agent');
    expect(Object.keys(env.provenance)).not.toContain('user_agent');
  });
});

/* ==========================================================================
 * GROUP F — No Lane A/B output
 * ========================================================================== */

describe('PR#10 — F. No Lane A/B output', () => {
  it('envelope shape has no scoring_output_lane_a or scoring_output_lane_b field', () => {
    const env = buildPoiCoreInput(baselineArgs());
    const allKeys = collectAllKeys(env);
    expect(allKeys).not.toContain('scoring_output_lane_a');
    expect(allKeys).not.toContain('scoring_output_lane_b');
    expect(allKeys).not.toContain('lane_a');
    expect(allKeys).not.toContain('lane_b');
  });

  it('no PR#10 active source contains INSERT INTO scoring_output_lane_a/_b', () => {
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      if (/INSERT\s+INTO\s+scoring_output_lane_a/i.test(body)) {
        throw new Error(`PR#10 source ${name} contains forbidden INSERT INTO scoring_output_lane_a`);
      }
      if (/INSERT\s+INTO\s+scoring_output_lane_b/i.test(body)) {
        throw new Error(`PR#10 source ${name} contains forbidden INSERT INTO scoring_output_lane_b`);
      }
    }
  });
});

/* ==========================================================================
 * GROUP G — No Policy / Trust imports
 * ========================================================================== */

describe('PR#10 — G. No Policy / Trust / Series imports', () => {
  it('no PR#10 active source imports from a Policy / Trust / Series / Lane module', () => {
    const forbiddenImportRegexes = [
      /from\s+['"][^'"]*src\/scoring\/policy/i,
      /from\s+['"][^'"]*src\/scoring\/trust/i,
      /from\s+['"][^'"]*src\/scoring\/series/i,
      /from\s+['"][^'"]*src\/scoring\/lane/i,
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenImportRegexes) {
        if (re.test(body)) {
          throw new Error(`PR#10 source ${name} contains forbidden import matching /${re.source}/`);
        }
      }
    }
  });

  it('no PR#10 active source imports from collector / app / server / auth', () => {
    const forbiddenImportRegexes = [
      /from\s+['"][^'"]*src\/collector\/v1/,
      /from\s+['"][^'"]*src\/app(\.|\/)/,
      /from\s+['"][^'"]*src\/server/,
      /from\s+['"][^'"]*src\/auth/,
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenImportRegexes) {
        if (re.test(body)) {
          throw new Error(`PR#10 source ${name} contains forbidden import matching /${re.source}/`);
        }
      }
    }
  });

  it('no PR#10 active source imports reason_code_dictionary / forbidden_codes', () => {
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      if (/reason_code_dictionary/i.test(body)) {
        throw new Error(`PR#10 source ${name} references reason_code_dictionary`);
      }
      if (/forbidden_codes\b/i.test(body)) {
        throw new Error(`PR#10 source ${name} references forbidden_codes`);
      }
    }
  });

  it('no PR#10 active source imports pg / DB clients', () => {
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      if (/from\s+['"]pg['"]/i.test(body)) {
        throw new Error(`PR#10 source ${name} imports pg`);
      }
      if (/from\s+['"]pg-pool['"]/i.test(body)) {
        throw new Error(`PR#10 source ${name} imports pg-pool`);
      }
    }
  });
});

/* ==========================================================================
 * GROUP H — No visitor / person / company identity fields
 * ========================================================================== */

describe('PR#10 — H. No identity / enrichment fields', () => {
  it('envelope shape has no visitor / person / company / email / IP-org / hashed-identity fields', () => {
    const env = buildPoiCoreInput(baselineArgs());
    const forbidden = [
      'person_id', 'visitor_id', 'company_id', 'domain_id', 'email_id', 'asn_id',
      'person_hash', 'email_hash', 'device_fingerprint',
      'ip_company', 'ip_org', 'ip_asn',
      'is_real_buyer', 'real_buyer', 'buyer_id',
    ];
    const allKeys = collectAllKeys(env);
    for (const k of forbidden) {
      expect(allKeys).not.toContain(k);
    }
  });

  it('no PR#10 active source declares an identity-style field', () => {
    // Look for type-level declarations of forbidden field names.
    const forbidden = [
      /(?:^|[\s,;])person_id\s*:/m,
      /(?:^|[\s,;])visitor_id\s*:/m,
      /(?:^|[\s,;])company_id\s*:/m,
      /(?:^|[\s,;])email_id\s*:/m,
      /(?:^|[\s,;])email_hash\s*:/m,
      /(?:^|[\s,;])person_hash\s*:/m,
      /(?:^|[\s,;])device_fingerprint\s*:/m,
      /(?:^|[\s,;])ip_company\s*:/m,
      /(?:^|[\s,;])ip_org\s*:/m,
      /(?:^|[\s,;])buyer_id\s*:/m,
      /(?:^|[\s,;])is_real_buyer\s*:/m,
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbidden) {
        if (re.test(body)) {
          throw new Error(`PR#10 source ${name} declares forbidden identity field matching /${re.source}/`);
        }
      }
    }
  });
});

/* ==========================================================================
 * GROUP I — Stable natural key (deterministic)
 * ========================================================================== */

describe('PR#10 — I. Determinism + stable natural key', () => {
  it('same input → byte-stable envelope', () => {
    const args = baselineArgs();
    const a = buildPoiCoreInput(args);
    const b = buildPoiCoreInput(args);
    const c = buildPoiCoreInput(args);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it('does not call Date.now() — adapter source contains no Date.now', () => {
    const body = stripTsComments(readFileSync(ADAPTER_FILE, 'utf8'));
    expect(/\bDate\.now\s*\(/.test(body)).toBe(false);
  });

  it('does not read process.env / fetch / fs / pg', () => {
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      if (/\bprocess\.env\b/.test(body)) {
        throw new Error(`PR#10 source ${name} reads process.env`);
      }
      if (/\bfetch\s*\(/.test(body)) {
        throw new Error(`PR#10 source ${name} calls fetch`);
      }
      if (/from\s+['"]fs['"]/.test(body)) {
        throw new Error(`PR#10 source ${name} imports fs`);
      }
      if (/from\s+['"]node:fs['"]/.test(body)) {
        throw new Error(`PR#10 source ${name} imports node:fs`);
      }
    }
  });

  it('natural key tuple (workspace, site, session, poi_type, poi_key, source_versions.poi_input_version, source_versions.scoring_version) is stable for identical inputs', () => {
    const args = baselineArgs();
    const a = buildPoiCoreInput(args);
    const b = buildPoiCoreInput(args);
    const keyTupleA = [a.workspace_id, a.site_id, a.session_id, a.poi.poi_type, a.poi.poi_key, a.source_versions.poi_input_version, a.source_versions.scoring_version].join('|');
    const keyTupleB = [b.workspace_id, b.site_id, b.session_id, b.poi.poi_type, b.poi.poi_key, b.source_versions.poi_input_version, b.source_versions.scoring_version].join('|');
    expect(keyTupleB).toBe(keyTupleA);
  });

  it('different poi_type → different natural-key tuple', () => {
    const argsPath = baselineArgs({ poi_type: POI_TYPE.PAGE_PATH });
    const argsRoute = baselineArgs({ poi_type: POI_TYPE.ROUTE, raw_surface: baselineRawSurface({ raw_page_path: '/users/123', route_rules: [{ pattern: /\/users\/\d+/, replacement: '/users/:id' }] }) });
    const envPath = buildPoiCoreInput(argsPath);
    const envRoute = buildPoiCoreInput(argsRoute);
    expect(envPath.poi.poi_type).not.toBe(envRoute.poi.poi_type);
    expect(envPath.poi.poi_key).not.toBe(envRoute.poi.poi_key);
  });
});

/* ==========================================================================
 * GROUP J — Version mismatch rejection
 * ========================================================================== */

describe('PR#10 — J. Version mismatch rejection', () => {
  it('rejects when poi_input_version does not match POI_CORE_INPUT_VERSION', () => {
    expect(() => buildPoiCoreInput({
      ...baselineArgs(),
      poi_input_version: 'poi-core-input-v0.0' as unknown as typeof POI_CORE_INPUT_VERSION,
    })).toThrow(/poi_input_version.*does not match POI_CORE_INPUT_VERSION/);
  });

  it('rejects when poi_input_version is a future-version string', () => {
    expect(() => buildPoiCoreInput({
      ...baselineArgs(),
      poi_input_version: 'poi-core-input-v0.2' as unknown as typeof POI_CORE_INPUT_VERSION,
    })).toThrow(/does not match/);
  });

  it('rejects when scoring_version is empty', () => {
    expect(() => buildPoiCoreInput(baselineArgs({ scoring_version: '' }))).toThrow(/scoring_version/);
  });

  it('rejects when derived_at is empty', () => {
    expect(() => buildPoiCoreInput(baselineArgs({ derived_at: '' }))).toThrow(/derived_at/);
  });
});

/* ==========================================================================
 * GROUP K — Malformed POI type / disallowed source rejection
 * ========================================================================== */

describe('PR#10 — K. Malformed POI type / disallowed source', () => {
  it('rejects when poi_type is not in the Helen-signed OD-3 allowlist', () => {
    expect(() => buildPoiCoreInput({
      ...baselineArgs(),
      poi_type: 'utm_campaign_class' as unknown as PoiType,
    })).toThrow(/poi_type.*OD-3 allowlist/);
  });

  it('rejects when source_table is not in the default allowlist (Risk-as-input requires OD-5 opt-in)', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        // risk_observations_v0_1 is NOT a default POI input source per OD-5
        source_table: 'risk_observations_v0_1' as unknown as PoiSourceRow['source_table'],
      }),
    }))).toThrow(/source_table.*not in the default allowlist/);
  });

  it('rejects empty workspace_id / site_id / session_id / source_row_id', () => {
    expect(() => buildPoiCoreInput(baselineArgs({ source_row: baselineSourceRow({ workspace_id: '' }) }))).toThrow(/workspace_id/);
    expect(() => buildPoiCoreInput(baselineArgs({ source_row: baselineSourceRow({ site_id: '' }) }))).toThrow(/site_id/);
    expect(() => buildPoiCoreInput(baselineArgs({ source_row: baselineSourceRow({ session_id: '' }) }))).toThrow(/session_id/);
    expect(() => buildPoiCoreInput(baselineArgs({ source_row: baselineSourceRow({ source_row_id: '' }) }))).toThrow(/source_row_id/);
  });

  it('rejects negative source_event_count', () => {
    expect(() => buildPoiCoreInput(baselineArgs({ source_row: baselineSourceRow({ source_event_count: -1 }) }))).toThrow(/source_event_count/);
  });
});

import type { PoiSourceRow as _PoiSourceRow } from '../../src/scoring/poi-core/index.js';

/* ==========================================================================
 * GROUP L — Stage 0 eligibility carry-through (OD-7)
 * ========================================================================== */

describe('PR#10 — L. Stage 0 eligibility carry-through', () => {
  it('stage0.excluded=true sets poi_eligible=false; stage0_rule_id surfaces; stage0_version surfaces', () => {
    const env = buildPoiCoreInput({
      ...baselineArgs(),
      stage0: baselineStage0({ excluded: true, rule_id: 'known_bot_ua_family' }),
    });
    expect(env.eligibility.stage0_excluded).toBe(true);
    expect(env.eligibility.poi_eligible).toBe(false);
    expect(env.eligibility.stage0_rule_id).toBe('known_bot_ua_family');
    expect(env.source_versions.stage0_version).toBe('stage0-hard-exclusion-v0.2');
  });

  it('stage0.excluded=false keeps poi_eligible=true', () => {
    const env = buildPoiCoreInput({
      ...baselineArgs(),
      stage0: baselineStage0({ excluded: false }),
    });
    expect(env.eligibility.stage0_excluded).toBe(false);
    expect(env.eligibility.poi_eligible).toBe(true);
  });

  it('no stage0 supplied → stage0_excluded=false, stage0_rule_id=null, poi_eligible=true', () => {
    const env = buildPoiCoreInput(baselineArgs());
    expect(env.eligibility.stage0_excluded).toBe(false);
    expect(env.eligibility.stage0_rule_id).toBeNull();
    expect(env.eligibility.poi_eligible).toBe(true);
    expect(env.source_versions.stage0_version).toBeNull();
  });

  it('Stage 0 rule_id does NOT leak into poi or poi_context', () => {
    const env = buildPoiCoreInput({
      ...baselineArgs(),
      stage0: baselineStage0({ rule_id: 'scanner_or_probe_path' }),
    });
    expect(JSON.stringify(env.poi)).not.toContain('scanner_or_probe_path');
    expect(JSON.stringify(env.poi_context)).not.toContain('scanner_or_probe_path');
  });

  it('rejects empty stage0_decision_id / stage0_version / rule_id / non-boolean excluded / non-true record_only', () => {
    expect(() => buildPoiCoreInput({ ...baselineArgs(), stage0: baselineStage0({ stage0_decision_id: '' }) })).toThrow(/stage0\.stage0_decision_id/);
    expect(() => buildPoiCoreInput({ ...baselineArgs(), stage0: baselineStage0({ stage0_version: '' }) })).toThrow(/stage0\.stage0_version/);
    expect(() => buildPoiCoreInput({ ...baselineArgs(), stage0: baselineStage0({ rule_id: '' }) })).toThrow(/stage0\.rule_id/);
    expect(() => buildPoiCoreInput({ ...baselineArgs(), stage0: { ...baselineStage0(), record_only: false as unknown as true } })).toThrow(/stage0\.record_only/);
  });
});

/* ==========================================================================
 * GROUP M — UTM context (OD-4 — UTM is context only, never a POI key)
 * ========================================================================== */

describe('PR#10 — M. UTM context (OD-4: context only)', () => {
  it('no POI_TYPE entry is utm_campaign_class', () => {
    expect(POI_TYPES_ALLOWED).not.toContain('utm_campaign_class' as PoiType);
    expect(POI_TYPES_ALLOWED).not.toContain('utm_source_class' as PoiType);
    expect(POI_TYPES_ALLOWED).not.toContain('utm_medium_class' as PoiType);
  });

  it('UTM normalisation helpers accept allowlist-shaped values', () => {
    expect(normaliseUtmCampaignClass('q2-launch-2026')).toBe('q2-launch-2026');
    expect(normaliseUtmSourceClass('google')).toBe('google');
    expect(normaliseUtmMediumClass('cpc')).toBe('cpc');
  });

  it('UTM normalisation rejects identity-shaped values (email-like, long, special chars)', () => {
    expect(normaliseUtmCampaignClass('person@example.com')).toBeNull();
    expect(normaliseUtmCampaignClass('has space')).toBeNull();
    expect(normaliseUtmCampaignClass('x'.repeat(65))).toBeNull();
    expect(normaliseUtmCampaignClass('')).toBeNull();
    expect(normaliseUtmCampaignClass(null)).toBeNull();
    expect(normaliseUtmCampaignClass(42)).toBeNull();
  });

  it('poi_context flows into the envelope as a separate field, NOT into poi_key', () => {
    const env = buildPoiCoreInput({
      ...baselineArgs(),
      poi_type: POI_TYPE.PAGE_PATH,
      poi_context: { utm_campaign_class: 'q2-launch-2026', utm_source_class: 'google', utm_medium_class: 'cpc' },
    });
    expect(env.poi_context.utm_campaign_class).toBe('q2-launch-2026');
    expect(env.poi_context.utm_source_class).toBe('google');
    expect(env.poi_context.utm_medium_class).toBe('cpc');
    // POI key never includes UTM
    expect(env.poi.poi_key).toBe('/pricing');
    expect(env.poi.poi_key).not.toContain('utm');
    expect(env.poi.poi_key).not.toContain('q2-launch');
  });

  it('adapter rejects UTM values that fail allowlist shape (defence in depth)', () => {
    expect(() => buildPoiCoreInput({
      ...baselineArgs(),
      poi_context: { utm_campaign_class: 'has space', utm_source_class: null, utm_medium_class: null },
    })).toThrow(/poi_context\.utm_campaign_class.*allowlist shape/);
  });

  it('null UTM fields are preserved as null on the envelope', () => {
    const env = buildPoiCoreInput({
      ...baselineArgs(),
      poi_context: { utm_campaign_class: null, utm_source_class: null, utm_medium_class: null },
    });
    expect(env.poi_context.utm_campaign_class).toBeNull();
    expect(env.poi_context.utm_source_class).toBeNull();
    expect(env.poi_context.utm_medium_class).toBeNull();
  });
});

/* ==========================================================================
 * GROUP N — Static-source boundary sweep (defence in depth)
 * ========================================================================== */

describe('PR#10 — N. Static-source boundary sweep', () => {
  it('no PR#10 active source declares a RiskOutput-shaped field', () => {
    const forbiddenFields = [
      /(?:^|[\s,;])risk_index\s*:/m,
      /(?:^|[\s,;])verification_score\s*:/m,
      /(?:^|[\s,;])evidence_band\s*:/m,
      /(?:^|[\s,;])action_recommendation\s*:/m,
      /(?:^|[\s,;])reason_codes\s*:/m,
      /(?:^|[\s,;])reason_impacts\s*:/m,
      /(?:^|[\s,;])triggered_tags\s*:/m,
      /(?:^|[\s,;])penalty_total\s*:/m,
      /(?:^|[\s,;])trust_decision\s*:/m,
      /(?:^|[\s,;])policy_decision\s*:/m,
      /(?:^|[\s,;])final_decision\s*:/m,
      /(?:^|[\s,;])customer_facing\s*:/m,
      /(?:^|[\s,;])verdict\s*:/m,
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenFields) {
        if (re.test(body)) {
          throw new Error(`PR#10 source ${name} declares forbidden field matching /${re.source}/`);
        }
      }
    }
  });

  it('no PR#10 active source contains ML / truth-claim substrings', () => {
    const forbiddenSubstrings = [
      'import sklearn', 'from sklearn',
      'import torch',   'from torch',
      'import xgboost', 'from xgboost',
      'import onnx',    'from onnx',
      'import lightgbm','from lightgbm',
      'fraud_confirmed', 'bot_confirmed', 'ai_detected', 'intent_verified',
      'buyer_verified', 'real_buyer_verified',
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const s of forbiddenSubstrings) {
        if (body.includes(s)) {
          throw new Error(`PR#10 source ${name} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });

  it('no PR#10 active source contains SQL DML/DDL keywords (it is a pure contract, no DB)', () => {
    const forbiddenSQL = [
      /INSERT\s+INTO/i,
      /UPDATE\s+\w+\s+SET/i,
      /DELETE\s+FROM/i,
      /TRUNCATE\b/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i,
      /DROP\s+TABLE/i,
    ];
    for (const [name, path] of PR10_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenSQL) {
        if (re.test(body)) {
          throw new Error(`PR#10 source ${name} contains forbidden SQL matching /${re.source}/`);
        }
      }
    }
  });

  it('subtree defence-in-depth sweep over src/scoring/poi-core/**', () => {
    const root = join(ROOT, 'src', 'scoring', 'poi-core');
    const files = listTsFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const stripped = stripTsComments(readFileSync(f, 'utf8'));
      for (const s of ['import sklearn', 'import torch', 'fraud_confirmed', 'is_real_buyer']) {
        if (stripped.includes(s)) {
          throw new Error(`subtree sweep: ${f} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });
});

/* ==========================================================================
 * GROUP O — Immutability
 * ========================================================================== */

describe('PR#10 — O. Immutability', () => {
  it('does not mutate the input args object', () => {
    const args = baselineArgs();
    const snapshot = JSON.stringify(args);
    buildPoiCoreInput(args);
    expect(JSON.stringify(args)).toBe(snapshot);
  });

  it('envelope arrays/objects do not share identity with input', () => {
    const refs = [
      { table: 'session_features', session_features_id: 1, feature_version: 'session-features-v0.1' },
    ];
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({ evidence_refs: refs }),
    }));
    expect(env.evidence_refs).not.toBe(refs);
  });

  it('envelope is deep-frozen', () => {
    const env = buildPoiCoreInput(baselineArgs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.poi)).toBe(true);
    expect(Object.isFrozen(env.poi_context)).toBe(true);
    expect(Object.isFrozen(env.source_versions)).toBe(true);
    expect(Object.isFrozen(env.source_identity)).toBe(true);
    expect(Object.isFrozen(env.eligibility)).toBe(true);
    expect(Object.isFrozen(env.provenance)).toBe(true);
    expect(Object.isFrozen(env.evidence_refs)).toBe(true);
  });
});

/* ==========================================================================
 * GROUP P — Codex blocker #1: unsafe token-shaped path segments reject
 * ========================================================================== */

describe('PR#10 — P. Unsafe path-segment rejection (Codex blocker #1)', () => {
  it('rejects /reset/token/secret-value (token marker + reset/secret triggers)', () => {
    expect(normalisePagePath('/reset/token/secret-value')).toBeNull();
  });

  it('rejects /checkout/session/abc (session marker)', () => {
    expect(normalisePagePath('/checkout/session/abc')).toBeNull();
  });

  it('rejects /auth/bearer/abc (auth + bearer markers)', () => {
    expect(normalisePagePath('/auth/bearer/abc')).toBeNull();
  });

  it('rejects percent-encoded /reset/%74%6f%6b%65%6e/secret-value (decoded token segment)', () => {
    expect(normalisePagePath('/reset/%74%6f%6b%65%6e/secret-value')).toBeNull();
  });

  it('rejects /api/jwt/value (jwt marker)', () => {
    expect(normalisePagePath('/api/jwt/eyJhbGciOiJIUzI1NiJ9')).toBeNull();
  });

  it('rejects /auth/access_token/value', () => {
    expect(normalisePagePath('/auth/access_token/abc')).toBeNull();
  });

  it('rejects /auth/refresh_token/value', () => {
    expect(normalisePagePath('/auth/refresh_token/abc')).toBeNull();
  });

  it('rejects /password/reset (password marker)', () => {
    expect(normalisePagePath('/password/reset')).toBeNull();
  });

  it('rejects /api/api_key/value', () => {
    expect(normalisePagePath('/api/api_key/abc')).toBeNull();
  });

  it('rejects malformed percent-encoded segments', () => {
    expect(normalisePagePath('/foo/%ZZ/bar')).toBeNull();
    expect(normalisePagePath('/foo/%/bar')).toBeNull();
  });

  it('accepts /pricing (safe path)', () => {
    expect(normalisePagePath('/pricing')).toBe('/pricing');
  });

  it('accepts /demo/request (safe path)', () => {
    expect(normalisePagePath('/demo/request')).toBe('/demo/request');
  });

  it('accepts /resources/buyer-intent (safe path)', () => {
    expect(normalisePagePath('/resources/buyer-intent')).toBe('/resources/buyer-intent');
  });

  it('accepts /code-of-conduct (substring `code` is exact-marker only, segment is `code-of-conduct` not `code`)', () => {
    expect(normalisePagePath('/code-of-conduct')).toBe('/code-of-conduct');
  });

  it('accepts /api-keys (exact `key` marker, segment is `api-keys` not `key`)', () => {
    expect(normalisePagePath('/api-keys')).toBe('/api-keys');
  });

  it('rejects exact `/code` segment (exact-match marker)', () => {
    expect(normalisePagePath('/code')).toBeNull();
  });

  it('rejects exact `/key` segment', () => {
    expect(normalisePagePath('/key')).toBeNull();
  });

  it('rejects exact `/email` segment', () => {
    expect(normalisePagePath('/email')).toBeNull();
  });

  it('rejects exact `/auth` segment', () => {
    expect(normalisePagePath('/auth')).toBeNull();
  });

  it('rejects exact `/reset` segment', () => {
    expect(normalisePagePath('/reset')).toBeNull();
  });

  it('built envelope page_path key for safe paths is preserved', () => {
    const env = buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.PAGE_PATH,
      raw_surface: baselineRawSurface({ raw_page_path: '/resources/buyer-intent' }),
    }));
    expect(env.poi.poi_key).toBe('/resources/buyer-intent');
  });

  it('adapter rejects when poi_type=page_path but raw_page_path has unsafe segment', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.PAGE_PATH,
      raw_surface: baselineRawSurface({ raw_page_path: '/checkout/session/abc' }),
    }))).toThrow(/page_path normalisation rejected/);
  });
});

/* ==========================================================================
 * GROUP Q — Codex blocker #2: poi_surface_class enum allowlist
 * ========================================================================== */

describe('PR#10 — Q. poi_surface_class enum allowlist (Codex blocker #2)', () => {
  it('POI_SURFACE_CLASSES_ALLOWED has the 14 documented coarse labels', () => {
    expect(POI_SURFACE_CLASSES_ALLOWED.length).toBe(14);
    expect(POI_SURFACE_CLASSES_ALLOWED).toContain(POI_SURFACE_CLASS.PAGE_PRICING);
    expect(POI_SURFACE_CLASSES_ALLOWED).toContain(POI_SURFACE_CLASS.CTA_PRIMARY);
    expect(POI_SURFACE_CLASSES_ALLOWED).toContain(POI_SURFACE_CLASS.FORM_DEMO);
    expect(POI_SURFACE_CLASSES_ALLOWED).toContain(POI_SURFACE_CLASS.OFFER_DEMO);
    expect(POI_SURFACE_CLASSES_ALLOWED).toContain(POI_SURFACE_CLASS.REFERRER_CLASS);
  });

  it('accepts page.pricing on the envelope', () => {
    const env = buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: POI_SURFACE_CLASS.PAGE_PRICING }),
    }));
    expect(env.poi.poi_surface_class).toBe('page.pricing');
  });

  it('accepts cta.primary', () => {
    const env = buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.CTA_ID,
      raw_surface: baselineRawSurface({ cta_id: 'cta_book_demo', poi_surface_class: POI_SURFACE_CLASS.CTA_PRIMARY }),
    }));
    expect(env.poi.poi_surface_class).toBe('cta.primary');
  });

  it('accepts form.demo', () => {
    const env = buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.FORM_ID,
      raw_surface: baselineRawSurface({ form_id: 'form_demo_request', poi_surface_class: POI_SURFACE_CLASS.FORM_DEMO }),
    }));
    expect(env.poi.poi_surface_class).toBe('form.demo');
  });

  it('accepts offer.demo', () => {
    const env = buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.OFFER_SURFACE,
      raw_surface: baselineRawSurface({ raw_offer_surface: 'demo', poi_surface_class: POI_SURFACE_CLASS.OFFER_DEMO }),
    }));
    expect(env.poi.poi_surface_class).toBe('offer.demo');
  });

  it('accepts null (no surface class supplied)', () => {
    const env = buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: null }),
    }));
    expect(env.poi.poi_surface_class).toBeNull();
  });

  it('rejects raw URL with query string', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 'https://example.com/pricing?token=abc' as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class.*not in POI_SURFACE_CLASSES_ALLOWED/);
  });

  it('rejects free-form labels with whitespace + secret words', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 'pricing page with secret token' as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class.*not in POI_SURFACE_CLASSES_ALLOWED/);
  });

  it('rejects identity-correlation labels (user_agent, email)', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 'user_agent' as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class.*not in POI_SURFACE_CLASSES_ALLOWED/);
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 'email' as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class.*not in POI_SURFACE_CLASSES_ALLOWED/);
  });

  it('rejects path-shaped values', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 'checkout/session/abc' as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class.*not in POI_SURFACE_CLASSES_ALLOWED/);
  });

  it('rejects non-string values (number, object)', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: 42 as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class must be a PoiSurfaceClass string or null/);
    expect(() => buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: { x: 1 } as unknown as PoiSurfaceClass }),
    }))).toThrow(/poi_surface_class must be a PoiSurfaceClass string or null/);
  });

  it('rejects empty string (treated as null)', () => {
    // Empty string is accepted and normalised to null per the
    // validator's "raw.length === 0" branch.
    const env = buildPoiCoreInput(baselineArgs({
      raw_surface: baselineRawSurface({ poi_surface_class: '' as unknown as PoiSurfaceClass }),
    }));
    expect(env.poi.poi_surface_class).toBeNull();
  });
});

/* ==========================================================================
 * GROUP R — Codex blocker #3: evidence_refs allowlist + forbidden keys
 * ========================================================================== */

describe('PR#10 — R. evidence_refs allowlist + forbidden-key sweep (Codex blocker #3)', () => {
  it('accepts session_features table', () => {
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', session_features_id: 1, feature_version: 'session-features-v0.1' }],
      }),
    }));
    expect(env.evidence_refs[0]!.table).toBe('session_features');
  });

  it('accepts session_behavioural_features_v0_2 table', () => {
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        source_table: 'session_behavioural_features_v0_2',
        behavioural_feature_version: 'behavioural-features-v0.3',
        evidence_refs: [{ table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' }],
      }),
    }));
    expect(env.evidence_refs[0]!.table).toBe('session_behavioural_features_v0_2');
  });

  it('accepts stage0_decisions table', () => {
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [
          { table: 'session_features', session_features_id: 1, feature_version: 'session-features-v0.1' },
          { table: 'stage0_decisions', stage0_decision_id: 'abc-001', rule_id: 'no_stage0_exclusion' },
        ],
      }),
    }));
    expect(env.evidence_refs).toHaveLength(2);
  });

  it('rejects evidence_refs[].table = accepted_events', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'accepted_events', some_id: 1 }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.table "accepted_events".*not in the PR#10 default allowlist/);
  });

  it('rejects evidence_refs[].table = rejected_events', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'rejected_events', some_id: 1 }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.table "rejected_events".*not in the PR#10 default allowlist/);
  });

  it('rejects evidence_refs[].table = ingest_requests', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'ingest_requests', some_id: 1 }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.table "ingest_requests".*not in the PR#10 default allowlist/);
  });

  it('rejects evidence_refs[].table = risk_observations_v0_1 (OD-5 default)', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'risk_observations_v0_1', risk_observation_id: 'x' }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.table "risk_observations_v0_1".*not in the PR#10 default allowlist/);
  });

  it('rejects evidence_refs entry with top-level raw_payload', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', raw_payload: '{...}' }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.raw_payload.*forbidden/);
  });

  it('rejects evidence_refs entry with top-level canonical_jsonb', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', canonical_jsonb: '{...}' }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.canonical_jsonb.*forbidden/);
  });

  it('rejects evidence_refs entry with top-level token_hash', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', token_hash: 'abc' }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.token_hash.*forbidden/);
  });

  it('rejects evidence_refs entry with nested { meta: { user_agent: "..." } } (recursive sweep)', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', meta: { user_agent: 'mozilla/5.0' } }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.meta\.user_agent.*forbidden/);
  });

  it('rejects evidence_refs entry with nested array containing ip_hash', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', refs: [{ ip_hash: 'sha256:...' }] }] as unknown as PoiEvidenceRef[],
      }),
    }))).toThrow(/evidence_refs\[0\]\.refs\[0\]\.ip_hash.*forbidden/);
  });

  it('rejects evidence_refs entry with email / phone / person_id', () => {
    for (const forbiddenKey of ['email', 'phone', 'person_id', 'visitor_id', 'company_id', 'account_id']) {
      const refs = [{ table: 'session_features', [forbiddenKey]: 'value' }] as unknown as PoiEvidenceRef[];
      expect(() => buildPoiCoreInput(baselineArgs({
        source_row: baselineSourceRow({ evidence_refs: refs }),
      }))).toThrow(new RegExp(`evidence_refs\\[0\\]\\.${forbiddenKey}.*forbidden`));
    }
  });

  it('rejects evidence_refs entry with cookie / authorization / bearer / pepper', () => {
    for (const forbiddenKey of ['cookie', 'authorization', 'Authorization', 'bearer', 'pepper']) {
      const refs = [{ table: 'session_features', [forbiddenKey]: 'value' }] as unknown as PoiEvidenceRef[];
      expect(() => buildPoiCoreInput(baselineArgs({
        source_row: baselineSourceRow({ evidence_refs: refs }),
      }))).toThrow(new RegExp(`evidence_refs\\[0\\]\\.${forbiddenKey}.*forbidden`));
    }
  });

  it('rejects evidence_refs entry with full_url / url_query / query / page_url', () => {
    for (const forbiddenKey of ['full_url', 'url_query', 'query', 'page_url']) {
      const refs = [{ table: 'session_features', [forbiddenKey]: '/abc?x=y' }] as unknown as PoiEvidenceRef[];
      expect(() => buildPoiCoreInput(baselineArgs({
        source_row: baselineSourceRow({ evidence_refs: refs }),
      }))).toThrow(new RegExp(`evidence_refs\\[0\\]\\.${forbiddenKey}.*forbidden`));
    }
  });

  it('allows safe verbatim subkeys (e.g. session_features_id + feature_version)', () => {
    const env = buildPoiCoreInput(baselineArgs({
      source_row: baselineSourceRow({
        evidence_refs: [{ table: 'session_features', session_features_id: 42, feature_version: 'session-features-v0.1', some_safe_field: 'ok' }],
      }),
    }));
    expect(env.evidence_refs[0]!.session_features_id).toBe(42);
    expect(env.evidence_refs[0]!.feature_version).toBe('session-features-v0.1');
  });
});

/* ==========================================================================
 * GROUP S — Codex blocker #4: email-shaped PII rejected in path segments
 * ========================================================================== */

describe('PR#10 — S. Email-shaped PII rejection (Codex blocker #4)', () => {
  it('rejects /welcome/person@example.com (literal @ in segment)', () => {
    expect(normalisePagePath('/welcome/person@example.com')).toBeNull();
  });

  it('rejects /welcome/person%40example.com (percent-encoded @)', () => {
    expect(normalisePagePath('/welcome/person%40example.com')).toBeNull();
  });

  it('rejects full URL with percent-encoded email + UTM query (path strip + segment check)', () => {
    expect(normalisePagePath('https://example.com/welcome/person%40example.com?utm_source=linkedin')).toBeNull();
  });

  it('rejects /users/test.user+tag@example.co.uk (plus-tag email)', () => {
    expect(normalisePagePath('/users/test.user+tag@example.co.uk')).toBeNull();
  });

  it('rejects /contact/%70%65%72%73%6f%6e%40%65%78%61%6d%70%6c%65%2e%63%6f%6d (fully percent-encoded email)', () => {
    // Decoded segment = 'person@example.com'. Reject via decoded @ check
    // AND raw %40 check (defence-in-depth).
    expect(normalisePagePath('/contact/%70%65%72%73%6f%6e%40%65%78%61%6d%70%6c%65%2e%63%6f%6d')).toBeNull();
  });

  it('rejects %40 in any case-variant of raw segment (defence-in-depth)', () => {
    // %40 is digit-only so case doesn't change the bytes, but the
    // toLowerCase() before substring search is defensive.
    expect(normalisePagePath('/foo/x%40y')).toBeNull();
  });

  it('rejects mixed @ + credential markers (compound trigger)', () => {
    expect(normalisePagePath('/auth/person@example.com')).toBeNull();   // /auth exact + @ in next segment
    expect(normalisePagePath('/reset/person@example.com')).toBeNull();  // /reset exact + @
  });

  // Positive regression — safe paths still pass after the email-PII filter.
  it('accepts /pricing (safe; no @ / %40)', () => {
    expect(normalisePagePath('/pricing')).toBe('/pricing');
  });

  it('accepts /demo/request (safe)', () => {
    expect(normalisePagePath('/demo/request')).toBe('/demo/request');
  });

  it('accepts /resources/buyer-intent (safe)', () => {
    expect(normalisePagePath('/resources/buyer-intent')).toBe('/resources/buyer-intent');
  });

  it('accepts /code-of-conduct (safe; substring "code" only triggers exact match)', () => {
    expect(normalisePagePath('/code-of-conduct')).toBe('/code-of-conduct');
  });

  it('accepts /api-keys (safe; substring "key" only triggers exact match)', () => {
    expect(normalisePagePath('/api-keys')).toBe('/api-keys');
  });

  it('built envelope page_path for an email-shaped path rejects with INVALID_POI_KEY-style throw', () => {
    expect(() => buildPoiCoreInput(baselineArgs({
      poi_type: POI_TYPE.PAGE_PATH,
      raw_surface: baselineRawSurface({ raw_page_path: '/welcome/person@example.com' }),
    }))).toThrow(/page_path normalisation rejected/);
  });
});

/* ==========================================================================
 * Auxiliary: normalisation helpers + version constant + classifications
 * ========================================================================== */

describe('PR#10 — auxiliary: classifyReferrer + classifyOfferSurface', () => {
  it('classifyReferrer maps known hosts to the right class', () => {
    expect(classifyReferrer('https://www.google.com/search?q=x')).toBe(REFERRER_CLASS.SEARCH);
    expect(classifyReferrer('https://bing.com/search?q=x')).toBe(REFERRER_CLASS.SEARCH);
    expect(classifyReferrer('https://duckduckgo.com/?q=x')).toBe(REFERRER_CLASS.SEARCH);
    expect(classifyReferrer('https://twitter.com/anything')).toBe(REFERRER_CLASS.SOCIAL);
    expect(classifyReferrer('https://x.com/anything')).toBe(REFERRER_CLASS.SOCIAL);
    expect(classifyReferrer('https://www.linkedin.com/anything')).toBe(REFERRER_CLASS.SOCIAL);
    expect(classifyReferrer('https://mail.google.com/anything')).toBe(REFERRER_CLASS.EMAIL);
  });

  it('classifyReferrer returns DIRECT for null/empty, UNKNOWN for unparseable or unmatched', () => {
    expect(classifyReferrer(null)).toBe(REFERRER_CLASS.DIRECT);
    expect(classifyReferrer('')).toBe(REFERRER_CLASS.DIRECT);
    expect(classifyReferrer('not-a-url')).toBe(REFERRER_CLASS.UNKNOWN);
    expect(classifyReferrer('https://random-blog.example.org/post')).toBe(REFERRER_CLASS.UNKNOWN);
  });

  it('classifyReferrer NEVER returns the raw URL', () => {
    const allowed: ReadonlyArray<string> = REFERRER_CLASSES_ALLOWED;
    expect(allowed).toContain(classifyReferrer('https://www.google.com'));
    expect(allowed).toContain(classifyReferrer('https://random.example.org'));
    expect(allowed).toContain(classifyReferrer(null));
  });

  it('classifyOfferSurface maps allowlist values + synonyms', () => {
    expect(classifyOfferSurface('offer.demo')).toBe(OFFER_SURFACE.DEMO);
    expect(classifyOfferSurface('offer.pricing')).toBe(OFFER_SURFACE.PRICING);
    expect(classifyOfferSurface('demo')).toBe(OFFER_SURFACE.DEMO);
    expect(classifyOfferSurface('pricing-page')).toBe(OFFER_SURFACE.PRICING);
    expect(classifyOfferSurface('trust')).toBe(OFFER_SURFACE.TRUST);
    expect(classifyOfferSurface('footer')).toBe(OFFER_SURFACE.FOOTER);
  });

  it('classifyOfferSurface rejects out-of-allowlist values', () => {
    expect(classifyOfferSurface('something-else')).toBeNull();
    expect(classifyOfferSurface('')).toBeNull();
    expect(classifyOfferSurface(null)).toBeNull();
    expect(classifyOfferSurface(42)).toBeNull();
  });
});

describe('PR#10 — auxiliary: POI_CORE_INPUT_VERSION', () => {
  it('is the frozen v0.1 stamp', () => {
    expect(POI_CORE_INPUT_VERSION).toBe('poi-core-input-v0.1');
  });

  it('POI_TYPES_ALLOWED has exactly the 6 OD-3 types', () => {
    expect(POI_TYPES_ALLOWED.length).toBe(6);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.PAGE_PATH);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.ROUTE);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.CTA_ID);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.FORM_ID);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.OFFER_SURFACE);
    expect(POI_TYPES_ALLOWED).toContain(POI_TYPE.REFERRER_CLASS);
  });

  it('OFFER_SURFACES_ALLOWED has the 4 surface classes', () => {
    expect(OFFER_SURFACES_ALLOWED.length).toBe(4);
  });
});

describe('PR#10 — auxiliary: all 6 poi_types build successfully via the adapter', () => {
  const allOk: ReadonlyArray<[PoiType, Partial<RawSurfaceObservation>, string]> = [
    [POI_TYPE.PAGE_PATH,      { raw_page_path: 'https://buyerrecon.com/Pricing?q=1' },                                              '/pricing'],
    [POI_TYPE.ROUTE,          { raw_page_path: '/users/12345', route_rules: [{ pattern: /\/users\/\d+/, replacement: '/users/:id' }] }, '/users/:id'],
    [POI_TYPE.CTA_ID,         { cta_id: 'cta_pricing_book_demo' },                                                                  'cta_pricing_book_demo'],
    [POI_TYPE.FORM_ID,        { form_id: 'form_signup_email_v2' },                                                                  'form_signup_email_v2'],
    [POI_TYPE.OFFER_SURFACE,  { raw_offer_surface: 'demo' },                                                                        'offer.demo'],
    [POI_TYPE.REFERRER_CLASS, { raw_referrer: 'https://www.google.com/search' },                                                    'referrer.search'],
  ];

  for (const [poi_type, surface, expectedKey] of allOk) {
    it(`poi_type=${poi_type} builds with key=${expectedKey}`, () => {
      const env = buildPoiCoreInput(baselineArgs({
        poi_type,
        raw_surface: baselineRawSurface(surface),
      }));
      expect(env.poi.poi_type).toBe(poi_type);
      expect(env.poi.poi_key).toBe(expectedKey);
    });
  }
});

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function collectAllKeys(value: unknown, acc: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (const v of value) collectAllKeys(v, acc);
    return acc;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    acc.push(k);
    collectAllKeys((value as Record<string, unknown>)[k], acc);
  }
  return acc;
}

function listTsFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      const full = join(dir, name);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) { stack.push(full); continue; }
      if (/\.ts$/.test(full)) out.push(full);
    }
  }
  return out;
}
