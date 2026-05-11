/**
 * Sprint 1 PR#12 — pure tests for the §9b session_features derived-layer
 * observation extension.
 *
 * These tests cover the pure helpers exported from
 * `scripts/observation-session-features.ts`:
 *   - parseSessionFeaturesConfig
 *   - decideSessionFeatures (status logic)
 *   - renderSessionFeaturesSection (privacy: paths only, session_id truncated)
 *   - All §9b SQL strings (SELECT-only, no forbidden tokens, no DML)
 *
 * Also covers the PR#9 `decide()` function's PR#12 extension: when the
 * sessionFeaturesContribution argument is supplied, its blocks/watches are
 * merged into the overall decision and BLOCK > WATCH > PASS precedence holds.
 *
 * No DB connection — every fixture is a plain JS object or a hand-rolled
 * fake `pg.Client` that records SQL calls.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import {
  DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS,
  DEFAULT_SESSION_FEATURES_VERSION,
  SESSION_FEATURES_SQL_STRINGS,
  decideSessionFeatures,
  loadSessionFeaturesHealth,
  parseSessionFeaturesConfig,
  renderSessionFeaturesSection,
  truncateSessionId,
  type SessionFeaturesConfig,
  type SessionFeaturesHealth,
  type SessionFeaturesLatestRow,
} from '../../scripts/observation-session-features.js';

import { decide } from '../../scripts/collector-observation-report.js';

const ROOT = join(__dirname, '..', '..');

/* --------------------------------------------------------------------------
 * Fixture helpers
 * ------------------------------------------------------------------------ */

function defaultConfig(overrides: Partial<SessionFeaturesConfig> = {}): SessionFeaturesConfig {
  return {
    extractionVersion: DEFAULT_SESSION_FEATURES_VERSION,
    maxLagHours: DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS,
    requireSessionFeatures: false,
    ...overrides,
  };
}

function healthyHealth(overrides: Partial<SessionFeaturesHealth> = {}): SessionFeaturesHealth {
  const now = new Date();
  const earlier = new Date(now.getTime() - 60_000);
  return {
    tablePresent: true,
    extractionVersion: DEFAULT_SESSION_FEATURES_VERSION,
    rows: 8,
    latestExtractedAt: now,
    firstSeen: earlier,
    lastSeen: now,
    totalSourceEvents: 14,
    totalPageViews: 8,
    totalCtaClicks: 2,
    totalFormStarts: 2,
    totalFormSubmits: 2,
    totalUniquePaths: 6,
    sessionsWithCta: 2,
    sessionsWithFormStart: 2,
    sessionsWithFormSubmit: 2,
    canonicalKeyCountMin: 19,
    canonicalKeyCountMax: 19,
    duplicateNaturalKeyCount: 0,
    sourceEventCountMismatchCount: 0,
    canonicalKeyAnomalyCount: 0,
    hasCtaMismatchCount: 0,
    hasFormStartMismatchCount: 0,
    hasFormSubmitMismatchCount: 0,
    durationAnomalyCount: 0,
    jsonbTypeAnomalyCount: 0,
    latestAcceptedReceivedAt: now,
    latestExtractedAtOverall: now,
    extractionLagHours: 0,
    topRows: [],
    ...overrides,
  };
}

function emptyDecisionInputs() {
  const windowStart = new Date(Date.now() - 24 * 3600 * 1000);
  return {
    ingest: { total: 1, ok_rows: 1, error_rows: 0, first_seen: new Date(), last_seen: new Date() },
    accRej: { accepted: 1, rejected: 0, rejected_breakdown: [] },
    evidence: {
      ingest_total: 1,
      ingest_body_sha_complete: 1,
      accepted_total: 1,
      accepted_payload_sha_complete: 1,
      canonical_present: 1,
      canonical_key_19: 1,
      canonical_key_not_19: 0,
    },
    recon: { violations: 0, ledger_skew: 0, unreconciled: 0 },
    tokens: [
      { token_id: 'tk', disabled_at: null, last_used_at: new Date(), created_at: new Date() },
    ],
    windowStart,
  };
}

/* --------------------------------------------------------------------------
 * parseSessionFeaturesConfig
 * ------------------------------------------------------------------------ */

describe('parseSessionFeaturesConfig — defaults', () => {
  it('uses defaults when no env vars are set', () => {
    const c = parseSessionFeaturesConfig({});
    expect(c.extractionVersion).toBe(DEFAULT_SESSION_FEATURES_VERSION);
    expect(c.maxLagHours).toBe(DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS);
    expect(c.requireSessionFeatures).toBe(false);
  });

  it('OBS_REQUIRE_SESSION_FEATURES requires exact "true"', () => {
    expect(parseSessionFeaturesConfig({ OBS_REQUIRE_SESSION_FEATURES: 'true' }).requireSessionFeatures)
      .toBe(true);
    expect(parseSessionFeaturesConfig({ OBS_REQUIRE_SESSION_FEATURES: 'True' }).requireSessionFeatures)
      .toBe(false);
    expect(parseSessionFeaturesConfig({ OBS_REQUIRE_SESSION_FEATURES: '1' }).requireSessionFeatures)
      .toBe(false);
    expect(parseSessionFeaturesConfig({ OBS_REQUIRE_SESSION_FEATURES: '' }).requireSessionFeatures)
      .toBe(false);
    expect(parseSessionFeaturesConfig({ OBS_REQUIRE_SESSION_FEATURES: 'yes' }).requireSessionFeatures)
      .toBe(false);
  });

  it('OBS_SESSION_FEATURES_VERSION uses raw value when non-empty', () => {
    const c = parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_VERSION: 'session-features-v0.2' });
    expect(c.extractionVersion).toBe('session-features-v0.2');
  });

  it('OBS_SESSION_FEATURES_VERSION falls back to default when empty', () => {
    const c = parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_VERSION: '' });
    expect(c.extractionVersion).toBe(DEFAULT_SESSION_FEATURES_VERSION);
  });

  it('OBS_SESSION_FEATURES_MAX_LAG_HOURS parses positive integer', () => {
    expect(parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_MAX_LAG_HOURS: '6' }).maxLagHours)
      .toBe(6);
  });

  it('OBS_SESSION_FEATURES_MAX_LAG_HOURS rejects non-positive / non-finite', () => {
    expect(parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_MAX_LAG_HOURS: '0' }).maxLagHours)
      .toBe(DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS);
    expect(parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_MAX_LAG_HOURS: '-2' }).maxLagHours)
      .toBe(DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS);
    expect(parseSessionFeaturesConfig({ OBS_SESSION_FEATURES_MAX_LAG_HOURS: 'abc' }).maxLagHours)
      .toBe(DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS);
  });
});

/* --------------------------------------------------------------------------
 * decideSessionFeatures — status logic
 * ------------------------------------------------------------------------ */

describe('decideSessionFeatures — missing table', () => {
  it('require=false, missing table → no contribution', () => {
    const r = decideSessionFeatures(null, defaultConfig({ requireSessionFeatures: false }), 5);
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });

  it('require=false, tablePresent=false → no contribution', () => {
    const r = decideSessionFeatures(
      healthyHealth({ tablePresent: false, rows: 0 }),
      defaultConfig({ requireSessionFeatures: false }),
      5,
    );
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });

  it('require=true, missing table → WATCH', () => {
    const r = decideSessionFeatures(null, defaultConfig({ requireSessionFeatures: true }), 5);
    expect(r.blocks).toEqual([]);
    expect(r.watches).toHaveLength(1);
    expect(r.watches[0]).toContain('table not present');
    expect(r.watches[0]).toContain('OBS_REQUIRE_SESSION_FEATURES=true');
  });

  it('require=true, tablePresent=false → WATCH (never BLOCK)', () => {
    const r = decideSessionFeatures(
      healthyHealth({ tablePresent: false, rows: 0 }),
      defaultConfig({ requireSessionFeatures: true }),
      5,
    );
    expect(r.blocks).toEqual([]);
    expect(r.watches).toHaveLength(1);
  });
});

describe('decideSessionFeatures — empty / steady-state', () => {
  it('rows=0 and accepted_events > 0 → WATCH', () => {
    const r = decideSessionFeatures(healthyHealth({ rows: 0 }), defaultConfig(), 14);
    expect(r.blocks).toEqual([]);
    expect(r.watches).toHaveLength(1);
    expect(r.watches[0]).toContain('0 rows in window');
    expect(r.watches[0]).toContain('accepted_events in window = 14');
  });

  it('rows=0 and accepted_events = 0 → no contribution', () => {
    const r = decideSessionFeatures(healthyHealth({ rows: 0 }), defaultConfig(), 0);
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });

  it('healthy summary → no contribution', () => {
    const r = decideSessionFeatures(healthyHealth(), defaultConfig(), 14);
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });
});

describe('decideSessionFeatures — BLOCK conditions', () => {
  it('duplicate natural-key → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ duplicateNaturalKeyCount: 2 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('duplicate natural-key');
    expect(r.watches).toEqual([]);
  });

  it('source_event_count mismatch → BLOCK (full-session check phrasing)', () => {
    const r = decideSessionFeatures(
      healthyHealth({ sourceEventCountMismatchCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('source_event_count mismatch');
    expect(r.blocks[0]).toContain('full-session');
  });

  it('canonical_key_count anomaly → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ canonicalKeyAnomalyCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('canonical_key_count anomaly');
  });

  it('has_cta_click mismatch → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ hasCtaMismatchCount: 3 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('has_cta_click mismatch');
  });

  it('has_form_start mismatch → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ hasFormStartMismatchCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('has_form_start mismatch');
  });

  it('has_form_submit mismatch → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ hasFormSubmitMismatchCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('has_form_submit mismatch');
  });

  it('duration anomaly → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ durationAnomalyCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('session_duration_ms anomaly');
  });

  it('JSONB type anomaly → BLOCK', () => {
    const r = decideSessionFeatures(
      healthyHealth({ jsonbTypeAnomalyCount: 1 }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('JSONB count-map type anomaly');
  });
});

describe('decideSessionFeatures — WATCH conditions', () => {
  it('stale extraction lag → WATCH (not BLOCK)', () => {
    const r = decideSessionFeatures(
      healthyHealth({ extractionLagHours: 48 }),
      defaultConfig({ maxLagHours: 24 }),
      14,
    );
    expect(r.blocks).toEqual([]);
    expect(r.watches).toHaveLength(1);
    expect(r.watches[0]).toContain('extraction lag');
    expect(r.watches[0]).toContain('48.00h');
    expect(r.watches[0]).toContain('24h');
  });

  it('fresh extraction lag → no contribution', () => {
    const r = decideSessionFeatures(
      healthyHealth({ extractionLagHours: 1.5 }),
      defaultConfig({ maxLagHours: 24 }),
      14,
    );
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });

  it('custom maxLagHours threshold lowers the WATCH trigger', () => {
    const r = decideSessionFeatures(
      healthyHealth({ extractionLagHours: 12 }),
      defaultConfig({ maxLagHours: 6 }),
      14,
    );
    expect(r.watches).toHaveLength(1);
    expect(r.watches[0]).toContain('exceeds threshold (6h)');
  });

  it('null extractionLagHours → no WATCH (cannot decide)', () => {
    const r = decideSessionFeatures(
      healthyHealth({ extractionLagHours: null }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toEqual([]);
    expect(r.watches).toEqual([]);
  });
});

describe('decideSessionFeatures — multiple anomalies accumulate', () => {
  it('two distinct BLOCK conditions are both reported', () => {
    const r = decideSessionFeatures(
      healthyHealth({
        duplicateNaturalKeyCount: 1,
        canonicalKeyAnomalyCount: 2,
      }),
      defaultConfig(),
      14,
    );
    expect(r.blocks).toHaveLength(2);
    expect(r.watches).toEqual([]);
  });

  it('BLOCK alongside stale lag → BLOCK + WATCH both surface', () => {
    const r = decideSessionFeatures(
      healthyHealth({
        durationAnomalyCount: 1,
        extractionLagHours: 100,
      }),
      defaultConfig({ maxLagHours: 24 }),
      14,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.watches).toHaveLength(1);
  });
});

/* --------------------------------------------------------------------------
 * decide() — PR#12 extension
 * ------------------------------------------------------------------------ */

describe('decide() — PR#12 extension merges session-features contribution', () => {
  it('no contribution → existing logic unchanged (PASS)', () => {
    const e = emptyDecisionInputs();
    const d = decide(e.ingest, e.accRej, e.evidence, e.recon, e.tokens, e.windowStart);
    expect(d.status).toBe('PASS');
    expect(d.blocks).toEqual([]);
    expect(d.watches).toEqual([]);
  });

  it('session-features WATCH alone → final status WATCH', () => {
    const e = emptyDecisionInputs();
    const d = decide(e.ingest, e.accRej, e.evidence, e.recon, e.tokens, e.windowStart, {
      blocks: [],
      watches: ['session_features extraction lag exceeds threshold'],
    });
    expect(d.status).toBe('WATCH');
    expect(d.watches).toEqual(['session_features extraction lag exceeds threshold']);
    expect(d.recommendation).toContain('warnings');
  });

  it('session-features BLOCK alone → final status BLOCK', () => {
    const e = emptyDecisionInputs();
    const d = decide(e.ingest, e.accRej, e.evidence, e.recon, e.tokens, e.windowStart, {
      blocks: ['session_features duplicate natural-key rows = 1'],
      watches: [],
    });
    expect(d.status).toBe('BLOCK');
    expect(d.blocks).toEqual(['session_features duplicate natural-key rows = 1']);
    expect(d.recommendation).toContain('Do not expand');
  });

  it('BLOCK precedence: session-features BLOCK overrides raw-layer WATCH', () => {
    const e = emptyDecisionInputs();
    // Force a raw-layer WATCH: rejected > 0
    const accRejWithRejected = { ...e.accRej, rejected: 1 };
    const d = decide(e.ingest, accRejWithRejected, e.evidence, e.recon, e.tokens, e.windowStart, {
      blocks: ['session_features duplicate natural-key rows = 1'],
      watches: [],
    });
    expect(d.status).toBe('BLOCK');
    expect(d.blocks).toHaveLength(1);
    expect(d.watches).toContain('rejected events present (rows = 1)');
  });

  it('raw-layer BLOCK + session-features clean → still BLOCK', () => {
    const e = emptyDecisionInputs();
    const reconWithViolation = { ...e.recon, violations: 1 };
    const d = decide(e.ingest, e.accRej, e.evidence, reconWithViolation, e.tokens, e.windowStart, {
      blocks: [],
      watches: [],
    });
    expect(d.status).toBe('BLOCK');
  });
});

/* --------------------------------------------------------------------------
 * renderSessionFeaturesSection — privacy + structure
 * ------------------------------------------------------------------------ */

describe('renderSessionFeaturesSection — privacy', () => {
  it('renders "table not present" when health is null', () => {
    const out = renderSessionFeaturesSection(null, defaultConfig());
    expect(out).toContain('## 9b. Session features summary');
    expect(out).toContain('table present? **no**');
  });

  it('renders WATCH note when require=true and table absent', () => {
    const out = renderSessionFeaturesSection(null, defaultConfig({ requireSessionFeatures: true }));
    expect(out).toContain('reported as WATCH');
  });

  it('renders no-impact note when require=false and table absent', () => {
    const out = renderSessionFeaturesSection(null, defaultConfig({ requireSessionFeatures: false }));
    expect(out).toContain('no status impact');
  });

  it('truncates session_id in top-10 table to 8 chars + ellipsis', () => {
    const row: SessionFeaturesLatestRow = {
      session_id: 'abcdef1234567890abcdef',
      source_event_count: 3,
      page_view_count: 2,
      cta_click_count: 1,
      form_start_count: 0,
      form_submit_count: 0,
      unique_path_count: 2,
      landing_page_path: '/',
      last_page_path: '/contact/',
      canonical_key_count_min: 19,
      canonical_key_count_max: 19,
      extracted_at: new Date(),
    };
    const out = renderSessionFeaturesSection(healthyHealth({ topRows: [row] }), defaultConfig());
    expect(out).toContain('abcdef12…');
    // The full session_id must NOT appear anywhere in the rendered section.
    expect(out).not.toContain('abcdef1234567890abcdef');
  });

  it('renders paths only — never references landing_page_url or last_page_url columns', () => {
    const row: SessionFeaturesLatestRow = {
      session_id: 'session-x',
      source_event_count: 1,
      page_view_count: 1,
      cta_click_count: 0,
      form_start_count: 0,
      form_submit_count: 0,
      unique_path_count: 1,
      landing_page_path: '/landing/',
      last_page_path: '/landing/',
      canonical_key_count_min: 19,
      canonical_key_count_max: 19,
      extracted_at: new Date(),
    };
    const out = renderSessionFeaturesSection(healthyHealth({ topRows: [row] }), defaultConfig());
    expect(out).toContain('landing_page_path');
    expect(out).toContain('last_page_path');
    // Render must not surface the URL column names from the underlying table.
    expect(out).not.toMatch(/\blanding_page_url\b/);
    expect(out).not.toMatch(/\blast_page_url\b/);
  });

  it('renders fresh extraction lag clamped to 0', () => {
    const out = renderSessionFeaturesSection(
      healthyHealth({ extractionLagHours: -2 }),
      defaultConfig(),
    );
    expect(out).toContain('extraction lag:');
    expect(out).toContain('0.00h');
  });

  it('renders "not computable" when lag is null', () => {
    const out = renderSessionFeaturesSection(
      healthyHealth({ extractionLagHours: null }),
      defaultConfig(),
    );
    expect(out).toContain('not computable');
  });

  it('rendered output contains no token/secret column references', () => {
    const out = renderSessionFeaturesSection(healthyHealth(), defaultConfig());
    expect(out.toLowerCase()).not.toContain('token_hash');
    expect(out.toLowerCase()).not.toContain('ip_hash');
    expect(out.toLowerCase()).not.toContain('user_agent');
    expect(out.toLowerCase()).not.toContain('bearer');
    expect(out.toLowerCase()).not.toContain('pepper');
    expect(out.toLowerCase()).not.toContain('authorization');
  });
});

describe('truncateSessionId', () => {
  it('truncates strings longer than 8 chars', () => {
    expect(truncateSessionId('abcdefghij')).toBe('abcdefgh…');
  });
  it('appends ellipsis even to short strings', () => {
    expect(truncateSessionId('abc')).toBe('abc…');
  });
  it('handles empty input', () => {
    expect(truncateSessionId('')).toBe('_(empty)_');
  });
});

/* --------------------------------------------------------------------------
 * SQL strings — SELECT-only, no forbidden tokens
 * ------------------------------------------------------------------------ */

describe('§9b SQL strings — SELECT-only / no DML', () => {
  const DML_FORBIDDEN = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bDROP\s+(TABLE|INDEX|VIEW|MATERIALIZED\s+VIEW|SCHEMA|DATABASE)\b/i,
    /\bALTER\s+(TABLE|INDEX|VIEW|SCHEMA|DATABASE)\b/i,
    /\bCREATE\s+(TABLE|INDEX|VIEW|MATERIALIZED\s+VIEW|SCHEMA|DATABASE)\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bCOPY\b/i,
    /\bBEGIN\b/i,
    /\bCOMMIT\b/i,
    /\bROLLBACK\b/i,
  ];

  for (const { name, sql } of SESSION_FEATURES_SQL_STRINGS) {
    it(`${name} starts with SELECT`, () => {
      expect(sql.trim().toUpperCase()).toMatch(/^SELECT\b/);
    });
    for (const pattern of DML_FORBIDDEN) {
      it(`${name} contains no ${pattern}`, () => {
        expect(sql).not.toMatch(pattern);
      });
    }
  }
});

describe('§9b SQL strings — no forbidden columns / secrets', () => {
  const FORBIDDEN_COLUMNS = [
    'token_hash',
    'ip_hash',
    'user_agent',
    'pepper',
    'bearer',
    'authorization',
    'raw_payload',
    'request_body',
  ];
  for (const { name, sql } of SESSION_FEATURES_SQL_STRINGS) {
    for (const col of FORBIDDEN_COLUMNS) {
      it(`${name} does not select ${col}`, () => {
        expect(sql.toLowerCase()).not.toContain(col);
      });
    }
  }
});

describe('§9b SQL strings — no scoring / classification / enrichment identifiers', () => {
  const FORBIDDEN = [
    'risk_score',
    'buyer_score',
    'intent_score',
    'classification',
    'recommended_action',
    'bot_score',
    'agent_score',
    'is_bot',
    'is_agent',
    'ai_agent',
    'lead_quality',
    'company_enrichment',
    'ip_enrichment',
    'crm',
  ];
  for (const { name, sql } of SESSION_FEATURES_SQL_STRINGS) {
    for (const tok of FORBIDDEN) {
      it(`${name} contains no \`${tok}\``, () => {
        const re = new RegExp(`\\b${tok}\\b`, 'i');
        expect(sql).not.toMatch(re);
      });
    }
  }
});

describe('§9b SQL — window-scoping rule', () => {
  it('SUMMARY query uses last_seen_at window predicates', () => {
    const sql = SESSION_FEATURES_SQL_STRINGS.find((s) => s.name === 'SESSION_FEATURES_SUMMARY_SQL')!.sql;
    expect(sql).toMatch(/last_seen_at\s*>=\s*\$4/);
    expect(sql).toMatch(/last_seen_at\s*<=\s*\$5/);
  });

  it('SOURCE_EVENT_MISMATCH query window-scopes session_features but full-session-joins accepted_events', () => {
    const sql = SESSION_FEATURES_SQL_STRINGS.find(
      (s) => s.name === 'SESSION_FEATURES_SOURCE_EVENT_MISMATCH_SQL',
    )!.sql;
    // Outer query scopes session_features by last_seen_at.
    expect(sql).toMatch(/sf\.last_seen_at\s*>=\s*\$4/);
    expect(sql).toMatch(/sf\.last_seen_at\s*<=\s*\$5/);
    // Inner join does NOT filter accepted_events by received_at — full session count.
    expect(sql).not.toMatch(/ae\.received_at/);
    // Inner join filters by the v1 event_contract_version and browser origin.
    expect(sql).toContain("event_contract_version = 'event-contract-v0.1'");
    expect(sql).toContain("event_origin = 'browser'");
    expect(sql).toContain("session_id  <> '__server__'");
  });

  it('FRESHNESS query is boundary-wide (no last_seen_at filter)', () => {
    const sql = SESSION_FEATURES_SQL_STRINGS.find((s) => s.name === 'SESSION_FEATURES_FRESHNESS_SQL')!.sql;
    expect(sql).not.toMatch(/last_seen_at/);
  });
});

/* --------------------------------------------------------------------------
 * loadSessionFeaturesHealth — fake client wiring
 * ------------------------------------------------------------------------ */

interface QueryCall { text: string; values?: unknown[] }

class FakeQueryClient {
  public calls: QueryCall[] = [];
  constructor(private readonly responses: Map<string, { rows: unknown[] }>) {}
  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ text, values });
    // Match on a stable prefix of the SQL text.
    for (const [key, resp] of this.responses.entries()) {
      if (text.includes(key)) return resp;
    }
    return { rows: [] };
  }
}

describe('loadSessionFeaturesHealth — table missing short-circuits', () => {
  it('returns tablePresent=false when to_regclass yields null and never runs further queries', async () => {
    const client = new FakeQueryClient(new Map([
      ['to_regclass', { rows: [{ regclass: null }] }],
    ]));
    const result = await loadSessionFeaturesHealth(client, {
      workspaceId: 'ws',
      siteId: 'site',
      windowStart: new Date('2026-05-10T00:00:00Z'),
      windowEnd: new Date('2026-05-11T00:00:00Z'),
      config: defaultConfig(),
    });
    expect(result.tablePresent).toBe(false);
    expect(result.rows).toBe(0);
    // Only the presence query ran.
    expect(client.calls.length).toBe(1);
    expect(client.calls[0].text).toContain('to_regclass');
  });
});

describe('loadSessionFeaturesHealth — passes window params + extraction_version', () => {
  it('forwards (workspace, site, version, windowStart, windowEnd) as ISO strings to summary query', async () => {
    const client = new FakeQueryClient(new Map([
      ['to_regclass', { rows: [{ regclass: 'session_features' }] }],
      ['FROM session_features', { rows: [{ rows: 8, latest_extracted_at: null }] }],
      ['MAX(received_at)', { rows: [{ latest_accepted: null, latest_extracted_overall: null }] }],
    ]));
    const ws = 'wsX';
    const site = 'siteY';
    const start = new Date('2026-05-10T00:00:00Z');
    const end = new Date('2026-05-11T00:00:00Z');
    await loadSessionFeaturesHealth(client, {
      workspaceId: ws,
      siteId: site,
      windowStart: start,
      windowEnd: end,
      config: defaultConfig({ extractionVersion: 'custom-v0.2' }),
    });
    // Find the summary query call.
    const summaryCall = client.calls.find((c) =>
      c.text.includes('COALESCE(SUM(source_event_count)'),
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall!.values).toEqual([
      ws,
      site,
      'custom-v0.2',
      start.toISOString(),
      end.toISOString(),
    ]);
  });
});

/* --------------------------------------------------------------------------
 * Helper module scope — no banned identifiers in active code
 * ------------------------------------------------------------------------ */

describe('PR#12 — scope discipline on the new helper module', () => {
  const PR12_FILES = [
    'scripts/observation-session-features.ts',
    'scripts/collector-observation-report.ts',
  ];
  const FORBIDDEN = [
    'risk_score',
    'buyer_score',
    'intent_score',
    'classification',
    'recommended_action',
    'bot_score',
    'agent_score',
    'behavioural_score',
    'behavior_score',
    'is_bot',
    'is_agent',
    'ai_agent',
    'lead_quality',
    'company_enrichment',
    'ip_enrichment',
  ];
  // Strip /* … */ and // comments before regex match so disclaimer JSDoc
  // doesn't false-positive the assertions below (mirrors PR#7 scope tests).
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  for (const file of PR12_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(ROOT, file))).toBe(true);
    });
    for (const tok of FORBIDDEN) {
      it(`${file} has no \`${tok}\` in active code`, () => {
        const src = stripComments(readFileSync(join(ROOT, file), 'utf8'));
        const re = new RegExp(`\\b${tok}\\b`, 'i');
        expect(src).not.toMatch(re);
      });
    }
    it(`${file} has no DML in active code`, () => {
      const src = stripComments(readFileSync(join(ROOT, file), 'utf8'));
      expect(src).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(src).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
      expect(src).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(src).not.toMatch(/\bTRUNCATE\b/i);
      expect(src).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(src).not.toMatch(/\bDROP\s+INDEX\b/i);
      expect(src).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(src).not.toMatch(/\bCREATE\s+TABLE\b/i);
    });
  }
});
