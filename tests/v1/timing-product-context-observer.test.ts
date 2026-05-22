/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer — pure tests.
 *
 * No real pg. Stub PgQueryable exercises every boundary, mapper, and
 * runner path. Covers PR#18c's required test surface:
 *
 *   A. Synthetic-fixture exclusion (workspace/site pair, schema_key
 *      namespace, token label).
 *   B. Timing-band classification — band boundaries (hot_now / warm_recent /
 *      cooling / stale / dormant / insufficient_evidence) + null-evidence.
 *   C. Confidence-cap logic — observer NEVER emits 'high'; cap reasons
 *      are categorical.
 *   D. Missing optional-table handling (to_regclass returns NULL).
 *   E. Required-table missing → final_status='BLOCKED'.
 *   F. insufficient_evidence distinct from negative evidence (band selection).
 *   G. Pass-forward shape carries no customer claim text.
 *   H. Session_id redaction (no full id ever emitted).
 *   I. Lane B presence stays dark/internal — no Lane B reason in
 *      customer-visible language; lane_b_dark_internal exclusion flag set.
 *   J. AMS reserved-name guard — runtime types & values do not include
 *      `Fit` / `Intent` / `Window` / `ProductDecision` / `RequestedAction`
 *      / `Pass1` / `Pass2` / `TrustDecisionV3` / `BuyerReconProductFeatures`.
 *   K. SQL constants are SELECT-only (no DML / DDL verbs).
 *   L. Static-source sweep over runtime module: no `FIT.*` / `INTENT.*` /
 *      `WINDOW.*` reason-code namespaces appear.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  AMS_RESERVED_NAMES_FORBIDDEN,
  AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN,
  ANOMALY_KINDS_ALLOWED,
  buildSessionCandidate,
  buildTimingBandDistribution,
  classifyTimingBand,
  computeConfidenceCap,
  CONFIDENCE_CAPS_ALLOWED,
  COUNT_RISK_OBSERVATIONS_SQL,
  COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL,
  COUNT_SESSION_FEATURES_SQL,
  countSyntheticFixtureRows,
  groupAcceptedEventsBySession,
  isSyntheticFixtureRow,
  isSyntheticFixtureTokenLabel,
  OBSERVER_VERSION,
  PASS_FORWARD_CONTRACT_VERSION,
  PRODUCT_CONTEXT_CANDIDATES_ALLOWED,
  parseDatabaseUrl,
  renderMarkdown,
  REPORT_VERSION,
  runTimingProductContextObserver,
  SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX,
  SYNTHETIC_FIXTURE_SITE_ID,
  SYNTHETIC_FIXTURE_TOKEN_LABELS,
  SYNTHETIC_FIXTURE_WORKSPACE_ID,
  SELECT_ACCEPTED_EVENTS_SQL,
  SELECT_INGEST_REQUESTS_SQL,
  SELECT_REJECTED_EVENTS_SQL,
  SELECT_TABLE_PRESENT_TO_REGCLASS_SQL,
  TIMING_BAND_THRESHOLDS_HOURS,
  TIMING_BANDS_ALLOWED,
  truncateSessionId,
  type ObserverRunOptions,
  type RawAcceptedEventRow,
} from '../../src/scoring/timing-product-context-observer/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');
const MODULE_DIR = join(REPO_ROOT, 'src', 'scoring', 'timing-product-context-observer');

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function mkOpts(over: Partial<ObserverRunOptions> = {}): ObserverRunOptions {
  return {
    workspace_id:                   'ws_commercial',
    site_id:                        'site_commercial',
    window_start:                   new Date('2026-05-14T00:00:00.000Z'),
    window_end:                     new Date('2026-05-21T00:00:00.000Z'),
    window_hours:                   168,
    evaluation_at:                  new Date('2026-05-21T12:00:00.000Z'),
    limit:                          1000,
    require_timing_product_context: false,
    ...over,
  };
}

interface StubQueryShape {
  readonly [k: string]: unknown;
}

interface StubScript {
  readonly presence:    Record<string, boolean>;
  readonly accepted:    readonly StubQueryShape[];
  readonly ingest:      readonly StubQueryShape[];
  readonly rejected:    readonly StubQueryShape[];
  readonly counts:      Partial<Record<string, number>>;
  readonly tokenLabels: readonly string[];
  readonly laneA:       number;
  readonly laneB:       number;
  /**
   * If the SQL contains any of these substrings, the stub throws.
   * Used to exercise optional_source_count_query_failed anomaly paths.
   */
  readonly throwOnSqlSubstring?: readonly string[];
}

interface StubClient {
  query<T extends StubQueryShape>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
}

function makeStubClient(script: StubScript): StubClient {
  return {
    async query<T extends StubQueryShape>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
      for (const needle of script.throwOnSqlSubstring ?? []) {
        if (sql.includes(needle)) {
          // Reserved-example error message — never includes DSN / token / pepper.
          throw new Error('stub-injected query failure');
        }
      }
      if (sql === SELECT_TABLE_PRESENT_TO_REGCLASS_SQL) {
        const fq = (params?.[0] as string) ?? '';
        return { rows: [{ present: Boolean(script.presence[fq]) }] as unknown as T[] };
      }
      if (sql === SELECT_ACCEPTED_EVENTS_SQL) return { rows: script.accepted as unknown as T[] };
      if (sql === SELECT_INGEST_REQUESTS_SQL) return { rows: script.ingest as unknown as T[] };
      if (sql === SELECT_REJECTED_EVENTS_SQL) return { rows: script.rejected as unknown as T[] };
      if (sql.includes('FROM public.session_features'))                  return { rows: [{ n: script.counts['session_features'] ?? 0 }] as unknown as T[] };
      if (sql.includes('FROM public.session_behavioural_features_v0_2')) return { rows: [{ n: script.counts['session_behavioural_features_v0_2'] ?? 0 }] as unknown as T[] };
      if (sql.includes('FROM public.poi_observations_v0_1'))             return { rows: [{ n: script.counts['poi_observations_v0_1'] ?? 0 }] as unknown as T[] };
      if (sql.includes('FROM public.poi_sequence_observations_v0_1'))    return { rows: [{ n: script.counts['poi_sequence_observations_v0_1'] ?? 0 }] as unknown as T[] };
      if (sql.includes('FROM public.risk_observations_v0_1'))            return { rows: [{ n: script.counts['risk_observations_v0_1'] ?? 0 }] as unknown as T[] };
      if (sql.includes('FROM public.scoring_output_lane_a'))             return { rows: [{ n: script.laneA }] as unknown as T[] };
      if (sql.includes('FROM public.scoring_output_lane_b'))             return { rows: [{ n: script.laneB }] as unknown as T[] };
      if (sql.includes('FROM public.site_write_tokens'))                 return { rows: script.tokenLabels.map((l) => ({ label: l })) as unknown as T[] };
      throw new Error(`unexpected SQL in stub: ${sql.slice(0, 60)}`);
    },
  };
}

const ALL_PRESENT: Record<string, boolean> = Object.freeze({
  'public.accepted_events':                   true,
  'public.ingest_requests':                   true,
  'public.rejected_events':                   true,
  'public.session_features':                  true,
  'public.session_behavioural_features_v0_2': true,
  'public.poi_observations_v0_1':             true,
  'public.poi_sequence_observations_v0_1':    true,
  'public.risk_observations_v0_1':            true,
  'public.site_write_tokens':                 true,
});

const REQUIRED_MISSING_PRESENCE: Record<string, boolean> = Object.freeze({
  'public.accepted_events':                   false,   // ← required, absent
  'public.ingest_requests':                   true,
  'public.rejected_events':                   true,
  'public.session_features':                  false,
  'public.session_behavioural_features_v0_2': false,
  'public.poi_observations_v0_1':             false,
  'public.poi_sequence_observations_v0_1':    false,
  'public.risk_observations_v0_1':            false,
  'public.site_write_tokens':                 false,
});

/* --------------------------------------------------------------------------
 * A. Synthetic-fixture exclusion
 * ------------------------------------------------------------------------ */

describe('A. synthetic-fixture exclusion', () => {
  it('A.1 workspace/site pair match', () => {
    expect(isSyntheticFixtureRow({ workspace_id: SYNTHETIC_FIXTURE_WORKSPACE_ID, site_id: SYNTHETIC_FIXTURE_SITE_ID })).toBe(true);
    expect(isSyntheticFixtureRow({ workspace_id: SYNTHETIC_FIXTURE_WORKSPACE_ID, site_id: 'other_site' })).toBe(false);
    expect(isSyntheticFixtureRow({ workspace_id: 'other_ws', site_id: SYNTHETIC_FIXTURE_SITE_ID })).toBe(false);
    expect(isSyntheticFixtureRow({})).toBe(false);
  });

  it('A.2 schema_key namespace match', () => {
    expect(isSyntheticFixtureRow({ schema_key: 'buyerrecon.test.page_view' })).toBe(true);
    expect(isSyntheticFixtureRow({ schema_key: 'buyerrecon.test.cta_click' })).toBe(true);
    expect(isSyntheticFixtureRow({ schema_key: 'buyerrecon.commercial.page_view' })).toBe(false);
    expect(SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX).toBe('buyerrecon.test.');
  });

  it('A.3 token label match', () => {
    expect(isSyntheticFixtureTokenLabel('pr17x_gate2_fixture')).toBe(true);
    expect(isSyntheticFixtureTokenLabel('pr17z_gate3_fixture')).toBe(true);
    expect(isSyntheticFixtureTokenLabel('commercial_site_token')).toBe(false);
    expect(isSyntheticFixtureTokenLabel('')).toBe(false);
    expect(isSyntheticFixtureTokenLabel(null)).toBe(false);
    expect(SYNTHETIC_FIXTURE_TOKEN_LABELS).toContain('pr17x_gate2_fixture');
    expect(SYNTHETIC_FIXTURE_TOKEN_LABELS).toContain('pr17z_gate3_fixture');
  });

  it('A.4 grouping excludes synthetic rows and never deletes them', () => {
    const rows: readonly RawAcceptedEventRow[] = [
      { session_id: 'sess_real_aaaaaa_zzzz', workspace_id: 'ws_commercial', site_id: 'site_commercial', schema_key: 'app.page_view', received_at: new Date('2026-05-20T12:00:00Z') },
      { session_id: 'sess_synth_xxxxxx_yyyy', workspace_id: SYNTHETIC_FIXTURE_WORKSPACE_ID, site_id: SYNTHETIC_FIXTURE_SITE_ID, schema_key: 'buyerrecon.test.page_view', received_at: new Date('2026-05-20T12:30:00Z') },
    ];
    const out = groupAcceptedEventsBySession(rows);
    expect(out.grouped).toHaveLength(1);
    expect(out.grouped[0]!.session_id).toBe('sess_real_aaaaaa_zzzz');
    expect(out.excluded_synthetic_row_count).toBe(1);
  });

  it('A.5 countSyntheticFixtureRows is additive and non-mutating', () => {
    const rows = [
      { schema_key: 'buyerrecon.test.page_view' },
      { schema_key: 'app.page_view' },
      { workspace_id: SYNTHETIC_FIXTURE_WORKSPACE_ID, site_id: SYNTHETIC_FIXTURE_SITE_ID },
    ];
    expect(countSyntheticFixtureRows(rows)).toBe(2);
    expect(rows).toHaveLength(3);  // not mutated
  });
});

/* --------------------------------------------------------------------------
 * B. Timing-band classification
 * ------------------------------------------------------------------------ */

describe('B. timing-band classification', () => {
  const evalAt = new Date('2026-05-21T12:00:00.000Z');
  const hAgo = (h: number) => new Date(evalAt.getTime() - h * 3_600_000);

  it('B.1 hot_now ≤ 1h', () => {
    expect(classifyTimingBand(hAgo(0.5), evalAt)).toBe('hot_now');
    expect(classifyTimingBand(hAgo(1),   evalAt)).toBe('hot_now');
  });
  it('B.2 warm_recent (1h, 24h]', () => {
    expect(classifyTimingBand(hAgo(2),  evalAt)).toBe('warm_recent');
    expect(classifyTimingBand(hAgo(24), evalAt)).toBe('warm_recent');
  });
  it('B.3 cooling (24h, 168h]', () => {
    expect(classifyTimingBand(hAgo(48),  evalAt)).toBe('cooling');
    expect(classifyTimingBand(hAgo(168), evalAt)).toBe('cooling');
  });
  it('B.4 stale (168h, 720h]', () => {
    expect(classifyTimingBand(hAgo(200), evalAt)).toBe('stale');
    expect(classifyTimingBand(hAgo(720), evalAt)).toBe('stale');
  });
  it('B.5 dormant (720h, 2160h]', () => {
    expect(classifyTimingBand(hAgo(1000), evalAt)).toBe('dormant');
    expect(classifyTimingBand(hAgo(2160), evalAt)).toBe('dormant');
  });
  it('B.6 insufficient_evidence > 2160h', () => {
    expect(classifyTimingBand(hAgo(3000), evalAt)).toBe('insufficient_evidence');
  });
  it('B.7 insufficient_evidence on null evidence', () => {
    expect(classifyTimingBand(null, evalAt)).toBe('insufficient_evidence');
  });
  it('B.8 future-dated evidence is anomalous → insufficient_evidence', () => {
    expect(classifyTimingBand(new Date(evalAt.getTime() + 60_000), evalAt)).toBe('insufficient_evidence');
  });
  it('B.9 thresholds frozen literal', () => {
    expect(TIMING_BAND_THRESHOLDS_HOURS.hot_now_max_hours).toBe(1);
    expect(TIMING_BAND_THRESHOLDS_HOURS.warm_recent_max_hours).toBe(24);
    expect(TIMING_BAND_THRESHOLDS_HOURS.cooling_max_hours).toBe(168);
    expect(TIMING_BAND_THRESHOLDS_HOURS.stale_max_hours).toBe(720);
    expect(TIMING_BAND_THRESHOLDS_HOURS.dormant_max_hours).toBe(2160);
  });
});

/* --------------------------------------------------------------------------
 * C. Confidence-cap logic — never 'high'
 * ------------------------------------------------------------------------ */

describe('C. confidence cap policy (never high)', () => {
  it('C.1 allowed caps are exactly {low, medium}', () => {
    expect(CONFIDENCE_CAPS_ALLOWED).toEqual(['low', 'medium']);
    expect((CONFIDENCE_CAPS_ALLOWED as readonly string[]).includes('high')).toBe(false);
  });
  it('C.2 synthetic-only → low with synthetic reason', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 5, client_only_evidence: false,
      synthetic_only_evidence: true, missing_optional_sources: false, threshold_not_locked: false,
    });
    expect(r.cap).toBe('low');
    expect(r.reason).toBe('synthetic_only_after_exclusion');
  });
  it('C.3 client-only → low', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 0, client_only_evidence: true,
      synthetic_only_evidence: false, missing_optional_sources: false, threshold_not_locked: false,
    });
    expect(r.cap).toBe('low');
    expect(r.reason).toBe('client_only_evidence');
  });
  it('C.4 single source → low', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 1, client_only_evidence: false,
      synthetic_only_evidence: false, missing_optional_sources: false, threshold_not_locked: false,
    });
    expect(r.cap).toBe('low');
    expect(r.reason).toBe('single_source_only');
  });
  it('C.5 multi-source server-side → medium', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 3, client_only_evidence: false,
      synthetic_only_evidence: false, missing_optional_sources: false, threshold_not_locked: false,
    });
    expect(r.cap).toBe('medium');
    expect(r.reason).toBe('multi_source_server_side');
  });
  it('C.6 multi-source with missing optional → medium but with missing-optional reason', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 3, client_only_evidence: false,
      synthetic_only_evidence: false, missing_optional_sources: true, threshold_not_locked: false,
    });
    expect(r.cap).toBe('medium');
    expect(r.reason).toBe('missing_optional_sources');
  });
  it('C.7 threshold_not_locked → low', () => {
    const r = computeConfidenceCap({
      server_side_source_count: 5, client_only_evidence: false,
      synthetic_only_evidence: false, missing_optional_sources: false, threshold_not_locked: true,
    });
    expect(r.cap).toBe('low');
    expect(r.reason).toBe('threshold_not_locked');
  });
});

/* --------------------------------------------------------------------------
 * D. Missing optional-table handling
 * ------------------------------------------------------------------------ */

describe('D. missing optional-table handling', () => {
  it('D.1 missing optional sources are reported as anomalies but do not block', async () => {
    const presence = {
      ...ALL_PRESENT,
      'public.session_features':                  false,
      'public.poi_observations_v0_1':             false,
      'public.poi_sequence_observations_v0_1':    false,
      'public.risk_observations_v0_1':            false,
      'public.session_behavioural_features_v0_2': false,
      'public.site_write_tokens':                 false,
    };
    const client = makeStubClient({
      presence, accepted: [], ingest: [], rejected: [], counts: {}, tokenLabels: [], laneA: 0, laneB: 0,
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    expect(report.final_status).not.toBe('BLOCKED');
    expect(report.anomalies.some((a) => a.kind === 'optional_source_missing')).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * E. Required-table missing → BLOCKED
 * ------------------------------------------------------------------------ */

describe('E. required-table missing → BLOCKED', () => {
  it('E.1 accepted_events absent blocks the run', async () => {
    const client = makeStubClient({
      presence: REQUIRED_MISSING_PRESENCE,
      accepted: [], ingest: [], rejected: [], counts: {}, tokenLabels: [], laneA: 0, laneB: 0,
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    expect(report.final_status).toBe('BLOCKED');
    expect(report.anomalies.some((a) => a.kind === 'required_source_missing')).toBe(true);
    expect(report.product_context_candidates).toHaveLength(0);
  });
});

/* --------------------------------------------------------------------------
 * F. insufficient_evidence distinct from negative evidence
 * ------------------------------------------------------------------------ */

describe('F. insufficient_evidence distinct from negative evidence', () => {
  it('F.1 null evidence → insufficient_evidence (not dormant)', () => {
    expect(classifyTimingBand(null, new Date())).toBe('insufficient_evidence');
  });
  it('F.2 90-day-old evidence → dormant (categorical "we can say: no recent activity")', () => {
    const evalAt = new Date('2026-05-21T12:00:00Z');
    expect(classifyTimingBand(new Date(evalAt.getTime() - 90 * 24 * 3_600_000), evalAt)).toBe('dormant');
  });
  it('F.3 >90-day-old evidence → insufficient_evidence (categorical "we cannot say")', () => {
    const evalAt = new Date('2026-05-21T12:00:00Z');
    expect(classifyTimingBand(new Date(evalAt.getTime() - 120 * 24 * 3_600_000), evalAt)).toBe('insufficient_evidence');
  });
});

/* --------------------------------------------------------------------------
 * G. Pass-forward shape carries no customer claim text
 * ------------------------------------------------------------------------ */

describe('G. pass-forward shape is internal-only categorical', () => {
  it('G.1 candidate fields are categorical enums + counts + redacted ids', () => {
    const candidate = buildSessionCandidate(
      { session_id: 'sess_full_aaaaaa_bbbb', accepted_event_count: 2, most_recent_received_at: new Date('2026-05-21T11:55:00Z') },
      { evaluation_at: new Date('2026-05-21T12:00:00Z'), server_side_source_count: 3, missing_optional_sources: false, threshold_not_locked: false, lane_b_dark_observed_globally: false },
    );
    expect(candidate.session_id_redacted).not.toContain('sess_full_aaaaaa_bbbb');
    expect(candidate.session_id_redacted).toMatch(/…/);
    expect(TIMING_BANDS_ALLOWED).toContain(candidate.timing_band_candidate);
    expect(PRODUCT_CONTEXT_CANDIDATES_ALLOWED).toContain(candidate.product_context_candidate);
    expect(CONFIDENCE_CAPS_ALLOWED).toContain(candidate.confidence_cap);
    expect(candidate.pass_forward_to_pass1).toBe(true);
  });
  it('G.2 insufficient evidence sessions are not passed forward', () => {
    const candidate = buildSessionCandidate(
      { session_id: 'sess_full_aaaaaa_bbbb', accepted_event_count: 0, most_recent_received_at: null },
      { evaluation_at: new Date('2026-05-21T12:00:00Z'), server_side_source_count: 0, missing_optional_sources: true, threshold_not_locked: false, lane_b_dark_observed_globally: false },
    );
    expect(candidate.product_context_candidate).toBe('insufficient_evidence');
    expect(candidate.pass_forward_to_pass1).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * H. Session_id redaction
 * ------------------------------------------------------------------------ */

describe('H. session_id redaction', () => {
  it('H.1 full session_id never emitted', () => {
    const truncated = truncateSessionId('sess_full_value_abcdefghijklmnop');
    expect(truncated).not.toBe('sess_full_value_abcdefghijklmnop');
    expect(truncated).toMatch(/…/);
  });
  it('H.2 short / invalid inputs collapse to ***', () => {
    expect(truncateSessionId('')).toBe('***');
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId(null)).toBe('***');
    expect(truncateSessionId(undefined)).toBe('***');
  });
});

/* --------------------------------------------------------------------------
 * I. Lane B dark/internal
 * ------------------------------------------------------------------------ */

describe('I. Lane B stays dark / internal', () => {
  it('I.1 Lane B presence sets the lane_b_dark_internal exclusion flag', () => {
    const candidate = buildSessionCandidate(
      { session_id: 'sess_full_aaaaaa_bbbb', accepted_event_count: 5, most_recent_received_at: new Date('2026-05-21T11:00:00Z') },
      { evaluation_at: new Date('2026-05-21T12:00:00Z'), server_side_source_count: 3, missing_optional_sources: false, threshold_not_locked: false, lane_b_dark_observed_globally: true },
    );
    expect(candidate.exclusion_flags).toContain('lane_b_dark_internal');
  });
  it('I.2 Lane B nonzero count surfaces only as a categorical anomaly + dark flag', async () => {
    const client = makeStubClient({
      presence: ALL_PRESENT,
      accepted: [{ session_id: 'sess_x_aaaaaa_bbbb', workspace_id: 'ws_commercial', site_id: 'site_commercial', schema_key: 'app.page_view', received_at: new Date('2026-05-21T11:55:00Z') }],
      ingest: [], rejected: [], counts: { session_features: 1, poi_observations_v0_1: 1 }, tokenLabels: [], laneA: 0, laneB: 3,
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    expect(report.anomalies.some((a) => a.kind === 'unexpected_lane_b_row_count_nonzero')).toBe(true);
    // Lane B existence must not appear as a customer claim. The report
    // explicitly labels itself "Not customer-facing" and emits only
    // categorical boundary affirmations — no buyer-intent / lead-quality /
    // bot-detection assertions reach the markdown surface.
    const md = renderMarkdown(report);
    expect(md).toMatch(/Not customer-facing/);
    const forbiddenCustomerClaimPhrases = [
      /\bthis lead\b/i,
      /\bbuyer intent detected\b/i,
      /\bgood bot\b/i,
      /\bAI agent detected\b/i,
      /\bbot-like behaviour\b/i,
      /\binvalid traffic confirmed\b/i,
    ];
    for (const re of forbiddenCustomerClaimPhrases) {
      expect(md).not.toMatch(re);
    }
  });
});

/* --------------------------------------------------------------------------
 * J. AMS reserved-name guard — runtime types & values
 * ------------------------------------------------------------------------ */

describe('J. AMS reserved-name guard', () => {
  it('J.1 module source does not declare AMS reserved names as exports', () => {
    const indexSrc = readFileSync(join(MODULE_DIR, 'index.ts'), 'utf8');
    for (const reserved of AMS_RESERVED_NAMES_FORBIDDEN) {
      // Allow occurrence only inside the AMS_RESERVED_NAMES_FORBIDDEN list itself.
      const exportFormDecl   = new RegExp(`export\\s+\\{[^}]*\\b${reserved}\\b`);
      const exportFormType   = new RegExp(`export\\s+(type|interface|class|const|let|var|function)\\s+${reserved}\\b`);
      expect(exportFormDecl.test(indexSrc)).toBe(false);
      expect(exportFormType.test(indexSrc)).toBe(false);
    }
  });
  it('J.2 AMS reserved-name list is non-empty and includes the critical names', () => {
    expect(AMS_RESERVED_NAMES_FORBIDDEN.length).toBeGreaterThan(0);
    for (const n of ['Fit', 'Intent', 'Window', 'ProductDecision', 'RequestedAction', 'Pass1', 'Pass2', 'TrustDecisionV3', 'BuyerReconProductFeatures']) {
      expect(AMS_RESERVED_NAMES_FORBIDDEN).toContain(n);
    }
  });
});

/* --------------------------------------------------------------------------
 * K. SQL constants are SELECT-only
 * ------------------------------------------------------------------------ */

describe('K. SQL constants are SELECT-only', () => {
  it('K.1 no DML / DDL verbs in any SQL constant', () => {
    const querySrc = readFileSync(join(MODULE_DIR, 'query.ts'), 'utf8');
    const forbidden = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE)\b/i;
    // SQL strings are inside backticks; extract them.
    const sqlMatches = querySrc.match(/`[\s\S]*?`/g) ?? [];
    for (const m of sqlMatches) {
      expect(forbidden.test(m)).toBe(false);
    }
  });

  it('K.2 session_behavioural_features_v0_2 SQL uses canonical last_seen_at (not last_refreshed_at)', () => {
    // Negative — the schema/query drift Codex caught must not regress.
    expect(COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL).not.toMatch(/last_refreshed_at/);
    // Positive — the query references the canonical column.
    expect(COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL).toMatch(/last_seen_at/);
  });

  it('K.3 entire query.ts module does not mention last_refreshed_at anywhere', () => {
    const querySrc = readFileSync(join(MODULE_DIR, 'query.ts'), 'utf8');
    expect(querySrc).not.toMatch(/last_refreshed_at/);
  });

  it('K.4 session_behavioural_features_v0_2.last_seen_at column exists in canonical schema.sql', () => {
    const schemaSrc = readFileSync(join(REPO_ROOT, 'src', 'db', 'schema.sql'), 'utf8');
    // Locate the CREATE TABLE block for session_behavioural_features_v0_2
    // and confirm last_seen_at is declared inside it.
    const blockMatch = schemaSrc.match(/CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2[\s\S]*?\);/);
    expect(blockMatch).not.toBeNull();
    expect(blockMatch![0]).toMatch(/\blast_seen_at\b\s+TIMESTAMPTZ/);
    // And the bug column does not exist.
    expect(blockMatch![0]).not.toMatch(/\blast_refreshed_at\b/);
  });

  it('K.5 session_features.last_seen_at column also exists (timing pattern parity)', () => {
    const schemaSrc = readFileSync(join(REPO_ROOT, 'src', 'db', 'schema.sql'), 'utf8');
    const blockMatch = schemaSrc.match(/CREATE TABLE IF NOT EXISTS session_features[\s\S]*?\);/);
    expect(blockMatch).not.toBeNull();
    expect(blockMatch![0]).toMatch(/\blast_seen_at\b\s+TIMESTAMPTZ/);
    // The session_features count SQL also references last_seen_at — parity check.
    expect(COUNT_SESSION_FEATURES_SQL).toMatch(/last_seen_at/);
  });

  it('K.6 risk_observations_v0_1 SQL uses canonical created_at (not derived_at)', () => {
    // Negative — PR#18f recorded BLOCKED / schema_mismatch because the observer
    // referenced a non-existent derived_at column. PR#18g fixes this; the
    // regression must not return.
    expect(COUNT_RISK_OBSERVATIONS_SQL).not.toMatch(/derived_at/);
    // Positive — the query references the canonical column documented by
    // migration 013 and src/db/schema.sql.
    expect(COUNT_RISK_OBSERVATIONS_SQL).toMatch(/created_at/);
  });

  it('K.7 query.ts COUNT_RISK_OBSERVATIONS_SQL block contains no derived_at reference', () => {
    // POI tables legitimately use derived_at, so we cannot assert
    // "no derived_at anywhere in query.ts". Instead, inspect the exact
    // exported risk-observations SQL constant for the bug-class column.
    expect(COUNT_RISK_OBSERVATIONS_SQL).not.toMatch(/\bderived_at\b/);
    // And confirm the constant filters on risk_observations_v0_1.
    expect(COUNT_RISK_OBSERVATIONS_SQL).toMatch(/FROM public\.risk_observations_v0_1/);
  });

  it('K.8 risk_observations_v0_1.created_at column exists in canonical schema.sql AND derived_at does not', () => {
    const schemaSrc = readFileSync(join(REPO_ROOT, 'src', 'db', 'schema.sql'), 'utf8');
    const blockMatch = schemaSrc.match(/CREATE TABLE IF NOT EXISTS risk_observations_v0_1[\s\S]*?\);/);
    expect(blockMatch).not.toBeNull();
    // Positive — created_at is the canonical timestamp column on this table.
    expect(blockMatch![0]).toMatch(/\bcreated_at\b\s+TIMESTAMPTZ/);
    // Negative — derived_at is NOT a column on this table (the bug Codex / PR#18f caught).
    expect(blockMatch![0]).not.toMatch(/\bderived_at\b/);
  });

  it('K.9 migrations/013_risk_observations_v0_1.sql indexes risk_observations on created_at (not derived_at)', () => {
    const migrationPath = join(REPO_ROOT, 'migrations', '013_risk_observations_v0_1.sql');
    const migrationSrc  = readFileSync(migrationPath, 'utf8');
    // The canonical workspace_site index uses created_at DESC.
    expect(migrationSrc).toMatch(/risk_observations_v0_1_workspace_site[\s\S]*?\(workspace_id, site_id, created_at DESC\)/);
    // The migration must not declare a derived_at column on risk_observations_v0_1.
    const tableBlock = migrationSrc.match(/CREATE TABLE IF NOT EXISTS risk_observations_v0_1[\s\S]*?\);/);
    expect(tableBlock).not.toBeNull();
    expect(tableBlock![0]).not.toMatch(/\bderived_at\b/);
  });
});

describe('M. optional_source_count_query_failed anomaly', () => {
  it('M.1 anomaly kind is declared in ANOMALY_KINDS_ALLOWED', () => {
    expect(ANOMALY_KINDS_ALLOWED).toContain('optional_source_count_query_failed');
  });

  it('M.2 a failing optional count query produces optional_source_count_query_failed (not silent zero)', async () => {
    const client = makeStubClient({
      presence: ALL_PRESENT,
      accepted: [{ session_id: 'sess_real_aaaaaa_bbbb', workspace_id: 'ws_commercial', site_id: 'site_commercial', schema_key: 'app.page_view', received_at: new Date('2026-05-21T11:55:00Z') }],
      ingest: [], rejected: [],
      counts: { session_features: 5 },
      tokenLabels: [], laneA: 0, laneB: 0,
      // Force the session_behavioural_features_v0_2 count query to throw.
      throwOnSqlSubstring: ['FROM public.session_behavioural_features_v0_2'],
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    const failures = report.anomalies.filter((a) => a.kind === 'optional_source_count_query_failed');
    expect(failures.length).toBeGreaterThanOrEqual(1);
    expect(failures.map((f) => f.detail)).toContain('public.session_behavioural_features_v0_2');
    // Failure must not leak SQL error text or anything DSN/token/secret-shaped.
    for (const f of failures) {
      expect(f.detail).not.toMatch(/Bearer |Authorization:|token_hash|SITE_WRITE_TOKEN_PEPPER|DATABASE_URL=|BEGIN PRIVATE KEY|BEGIN CERTIFICATE/);
      expect(f.detail).not.toMatch(/stub-injected/);  // ensure we did not propagate the stub exception message
    }
  });

  it('M.3 Lane A/B count failure surfaces optional_source_count_query_failed (not optional_source_missing)', async () => {
    const client = makeStubClient({
      presence: ALL_PRESENT,
      accepted: [], ingest: [], rejected: [],
      counts: {},
      tokenLabels: [], laneA: 0, laneB: 0,
      throwOnSqlSubstring: ['FROM public.scoring_output_lane_a', 'FROM public.scoring_output_lane_b'],
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    const failures = report.anomalies.filter((a) => a.kind === 'optional_source_count_query_failed');
    expect(failures.map((f) => f.detail)).toContain('public.scoring_output_lane_a');
    expect(failures.map((f) => f.detail)).toContain('public.scoring_output_lane_b');
  });
});

describe('N. site_write_tokens absent → optional_source_missing anomaly', () => {
  it('N.1 emits optional_source_missing with source detail when site_write_tokens is absent', async () => {
    const presence = { ...ALL_PRESENT, 'public.site_write_tokens': false };
    const client = makeStubClient({
      presence, accepted: [], ingest: [], rejected: [], counts: {}, tokenLabels: [], laneA: 0, laneB: 0,
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    const missing = report.anomalies.filter((a) => a.kind === 'optional_source_missing');
    expect(missing.map((m) => m.detail)).toContain('public.site_write_tokens');
  });

  it('N.2 site_write_tokens label probe failure surfaces optional_source_count_query_failed (distinct from missing)', async () => {
    const client = makeStubClient({
      presence: ALL_PRESENT,
      accepted: [], ingest: [], rejected: [], counts: {}, tokenLabels: [], laneA: 0, laneB: 0,
      throwOnSqlSubstring: ['FROM public.site_write_tokens'],
    });
    const report = await runTimingProductContextObserver({
      client: client as never, options: mkOpts(), database_host: 'host.staging', database_name: 'db_staging',
    });
    const failures = report.anomalies.filter((a) => a.kind === 'optional_source_count_query_failed');
    expect(failures.map((f) => f.detail)).toContain('public.site_write_tokens');
  });
});

/* --------------------------------------------------------------------------
 * L. Static-source sweep — no AMS reason-code namespaces
 * ------------------------------------------------------------------------ */

describe('L. AMS reason-code namespaces forbidden in runtime sources', () => {
  it('L.1 module sources do not emit FIT.* / INTENT.* / WINDOW.* reason codes', () => {
    // The AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN list itself contains
    // these prefix tokens by design (in types.ts) — that file is excluded
    // from the sweep when the only matches are inside that frozen list.
    for (const file of ['mapper.ts', 'query.ts', 'report.ts', 'runner.ts']) {
      const src = readFileSync(join(MODULE_DIR, file), 'utf8');
      for (const prefix of AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN) {
        // Allow trivial substring of unrelated words; the actual forbidden
        // form is "<PREFIX><SCREAMING_SNAKE>", which is what `<PREFIX>[A-Z_]+`
        // catches.
        const re = new RegExp(prefix.replace('.', '\\.') + '[A-Z][A-Z0-9_]*');
        expect(re.test(src)).toBe(false);
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * Aggregate distribution test
 * ------------------------------------------------------------------------ */

describe('Z. timing band distribution aggregation', () => {
  it('Z.1 buildTimingBandDistribution sums correctly', () => {
    const evalAt = new Date('2026-05-21T12:00:00Z');
    const ctx = {
      evaluation_at:                 evalAt,
      server_side_source_count:      3,
      missing_optional_sources:      false,
      threshold_not_locked:          false,
      lane_b_dark_observed_globally: false,
    } as const;
    const c1 = buildSessionCandidate({ session_id: 's1_aaaaaa_aaaa', accepted_event_count: 1, most_recent_received_at: new Date(evalAt.getTime() - 30 * 60_000) }, ctx);
    const c2 = buildSessionCandidate({ session_id: 's2_bbbbbb_bbbb', accepted_event_count: 1, most_recent_received_at: new Date(evalAt.getTime() - 2 * 3_600_000) }, ctx);
    const c3 = buildSessionCandidate({ session_id: 's3_cccccc_cccc', accepted_event_count: 0, most_recent_received_at: null }, ctx);
    const dist = buildTimingBandDistribution([c1, c2, c3]);
    expect(dist.hot_now).toBe(1);
    expect(dist.warm_recent).toBe(1);
    expect(dist.insufficient_evidence).toBe(1);
  });
});

/* --------------------------------------------------------------------------
 * Smoke: report metadata + DSN parsing
 * ------------------------------------------------------------------------ */

describe('Z. report metadata + DSN parsing', () => {
  it('Z.2 parseDatabaseUrl never echoes user/password', () => {
    // Reserved example string per RFC 2606 — example.invalid is guaranteed
    // never to resolve, and the user/password tokens are obviously synthetic.
    expect(parseDatabaseUrl('postgres://example_user:example_password@example.invalid:5432/example_db?sslmode=require'))
      .toEqual({ host: 'example.invalid:5432', name: 'example_db' });
    expect(parseDatabaseUrl(undefined)).toEqual({ host: '<unset>', name: '<unset>' });
    expect(parseDatabaseUrl('not a url')).toEqual({ host: '<unparseable>', name: '<unparseable>' });
  });
  it('Z.3 frozen version stamps', () => {
    expect(OBSERVER_VERSION).toBe('timing-product-context-observer-v0.1');
    expect(REPORT_VERSION).toBe('timing-product-context-observer-v0.1');
    expect(PASS_FORWARD_CONTRACT_VERSION).toBe('timing-product-context-pass-forward-v0.1');
  });
});
