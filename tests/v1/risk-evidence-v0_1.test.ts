/**
 * Sprint 2 PR#6 — pure tests for the behavioural-pattern evidence
 * adapter, normaliser, ContextTag enum, and source-code discipline.
 *
 * Pure: no DB connection. Tests cover:
 *   - Adapter purity + mapping correctness
 *   - behavioural_risk_01 bounded / deterministic / monotonic / baseline ≈ 0
 *   - ContextTag enum discipline (shape, allowed enum, forbidden prefixes,
 *     forbidden patterns, cardinality cap)
 *   - BYTESPIDER_PASSTHROUGH provenance-only discipline (Codex note #2)
 *   - behavioural_risk_01 naming discipline (Codex note #1)
 *   - No risk_index / verification_score / reason_codes / etc. on the
 *     RiskObservationRow shape or the migration column list
 *   - No INSERT INTO scoring_output_lane_a / _b in PR#6 source
 *   - No forbidden ML imports
 *   - No imports from collector / app / server / auth
 *   - PR#4 startup-guard wiring is called by the worker
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  buyerreconBehaviouralToRiskInputs,
  computeFeatureNormalisations,
  CONTEXT_TAG,
  CONTEXT_TAGS_ALLOWED,
  CONTEXT_TAGS_MAX_PER_SESSION,
  CONTEXT_TAG_SHAPE_REGEX,
  FORBIDDEN_TAG_PATTERNS,
  FORBIDDEN_TAG_PREFIXES,
  BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1,
  NORMALISATION_FEATURE_KEYS,
  OBSERVATION_VERSION_DEFAULT,
  assertContextTagsValid,
  isContextTagAllowed,
  normaliseBehaviouralRisk01,
  shouldEmitBytespiderPassthrough,
  validateContextTag,
  type ContextTag,
  type RiskObservationRow,
  type SessionBehaviouralFeaturesV0_3Row,
  type Stage0DecisionRowReadView,
} from '../../src/scoring/risk-evidence/index.js';

const ROOT = join(__dirname, '..', '..');
const TYPES_FILE        = join(ROOT, 'src', 'scoring', 'risk-evidence', 'types.ts');
const CONTEXT_TAGS_FILE = join(ROOT, 'src', 'scoring', 'risk-evidence', 'context-tags.ts');
const CONFIG_FILE       = join(ROOT, 'src', 'scoring', 'risk-evidence', 'normalisation-config.ts');
const NORM_FILE         = join(ROOT, 'src', 'scoring', 'risk-evidence', 'normalise-behavioural-risk.ts');
const ADAPTER_FILE      = join(ROOT, 'src', 'scoring', 'risk-evidence', 'adapter.ts');
const WORKER_FILE       = join(ROOT, 'src', 'scoring', 'risk-evidence', 'worker.ts');
const INDEX_FILE        = join(ROOT, 'src', 'scoring', 'risk-evidence', 'index.ts');
const CLI_FILE          = join(ROOT, 'scripts', 'run-risk-evidence-worker.ts');
const MIGRATION_013     = join(ROOT, 'migrations', '013_risk_observations_v0_1.sql');

const PR6_ACTIVE_SOURCES: ReadonlyArray<[string, string]> = [
  ['src/scoring/risk-evidence/types.ts',                    TYPES_FILE],
  ['src/scoring/risk-evidence/context-tags.ts',             CONTEXT_TAGS_FILE],
  ['src/scoring/risk-evidence/normalisation-config.ts',     CONFIG_FILE],
  ['src/scoring/risk-evidence/normalise-behavioural-risk.ts', NORM_FILE],
  ['src/scoring/risk-evidence/adapter.ts',                  ADAPTER_FILE],
  ['src/scoring/risk-evidence/worker.ts',                   WORKER_FILE],
  ['src/scoring/risk-evidence/index.ts',                    INDEX_FILE],
  ['scripts/run-risk-evidence-worker.ts',                   CLI_FILE],
];

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

function baselineSbf(
  overrides: Partial<SessionBehaviouralFeaturesV0_3Row> = {},
): SessionBehaviouralFeaturesV0_3Row {
  return {
    behavioural_features_id:                     1,
    workspace_id:                                '__test_ws_pr6__',
    site_id:                                     '__test_site_pr6__',
    session_id:                                  'sess-baseline',
    feature_version:                             'v0.3',
    source_event_count:                          3,
    ms_from_consent_to_first_cta:                12000,
    dwell_ms_before_first_action:                4000,
    first_form_start_precedes_first_cta:         false,
    form_start_count_before_first_cta:           0,
    has_form_submit_without_prior_form_start:    false,
    form_submit_count_before_first_form_start:   0,
    ms_between_pageviews_p50:                    1500,
    pageview_burst_count_10s:                    0,
    max_events_per_second:                       1,
    sub_200ms_transition_count:                  0,
    refresh_loop_candidate:                      false,
    refresh_loop_count:                          0,
    same_path_repeat_count:                      0,
    same_path_repeat_min_delta_ms:               null,
    valid_feature_count:                         9,
    missing_feature_count:                       0,
    ...overrides,
  };
}

function baselineStage0(
  overrides: Partial<Stage0DecisionRowReadView> = {},
): Stage0DecisionRowReadView {
  return {
    stage0_decision_id:  '00000000-0000-4000-8000-000000000001',
    workspace_id:        '__test_ws_pr6__',
    site_id:             '__test_site_pr6__',
    session_id:          'sess-baseline',
    excluded:            false,
    rule_id:             'no_stage0_exclusion',
    rule_inputs:         {
      matched_rule_id:    'no_stage0_exclusion',
      user_agent_family:  'browser',
      ua_source:          'ingest_requests',
      events_per_second:  1,
      path_loop_count:    1,
    },
    ...overrides,
  };
}

/* --------------------------------------------------------------------------
 * 1. Adapter purity + mapping correctness
 * ------------------------------------------------------------------------ */

describe('PR#6 — adapter purity + mapping', () => {
  it('adapter is pure: same input → same output (referential transparency)', () => {
    const sbf    = baselineSbf();
    const stage0 = baselineStage0();
    const a = buyerreconBehaviouralToRiskInputs(sbf, stage0);
    const b = buyerreconBehaviouralToRiskInputs(sbf, stage0);
    expect(b).toEqual(a);
  });

  it('adapter reads only the supplied SBF + Stage 0 row (no globals, no DB)', () => {
    const out = buyerreconBehaviouralToRiskInputs(baselineSbf(), baselineStage0());
    expect(out.subject_id).toBe('sess-baseline');
    expect(Object.keys(out.velocity).sort()).toEqual([
      'events_per_second',
      'pageview_burst_count_10s',
      'refresh_loop_count',
      'same_path_repeat_count',
      'sub_200ms_transition_count',
    ]);
  });

  it('adapter rejects Stage-0-excluded rows defensively (precondition violation)', () => {
    const stage0Excluded = baselineStage0({ excluded: true, rule_id: 'known_bot_ua_family' });
    expect(() => buyerreconBehaviouralToRiskInputs(baselineSbf(), stage0Excluded))
      .toThrow(/precondition violated.*stage0\.excluded/);
  });

  it('adapter rejects mismatched (workspace, site, session) tuples', () => {
    const mismatched = baselineStage0({ session_id: 'sess-other' });
    expect(() => buyerreconBehaviouralToRiskInputs(baselineSbf(), mismatched))
      .toThrow(/precondition violated.*workspace_id, site_id, session_id/);
  });

  it('adapter emits only ContextTags from the OD-13 enum', () => {
    const out = buyerreconBehaviouralToRiskInputs(
      baselineSbf({
        refresh_loop_candidate: true,
        max_events_per_second: 30,
        pageview_burst_count_10s: 12,
        sub_200ms_transition_count: 15,
        same_path_repeat_min_delta_ms: 50,
      }),
      baselineStage0(),
    );
    for (const t of out.tags) {
      expect(isContextTagAllowed(t)).toBe(true);
    }
  });

  it('velocity object carries normalised numeric rates only (no raw UA / IP)', () => {
    const out = buyerreconBehaviouralToRiskInputs(baselineSbf(), baselineStage0());
    for (const [k, v] of Object.entries(out.velocity)) {
      expect(typeof v).toBe('number');
      expect(['raw_user_agent', 'user_agent', 'ip_hash', 'token_hash', 'page_url']
        .includes(k)).toBe(false);
    }
  });

  it('device_risk_01 / network_risk_01 / identity_risk_01 default to 0 in v1', () => {
    const out = buyerreconBehaviouralToRiskInputs(baselineSbf(), baselineStage0());
    expect(out.device_risk_01).toBe(0);
    expect(out.network_risk_01).toBe(0);
    expect(out.identity_risk_01).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 2. behavioural_risk_01 bounded / deterministic / monotonic / baseline ≈ 0
 * ------------------------------------------------------------------------ */

describe('PR#6 — behavioural_risk_01 normalisation invariants', () => {
  it('behavioural_risk_01 is bounded [0, 1]', () => {
    const inputs = [
      baselineSbf(),
      baselineSbf({ max_events_per_second: 100, pageview_burst_count_10s: 100, sub_200ms_transition_count: 100, refresh_loop_count: 100, same_path_repeat_count: 100 }),
      baselineSbf({ max_events_per_second: 7, pageview_burst_count_10s: 5 }),
    ];
    for (const sbf of inputs) {
      const v = normaliseBehaviouralRisk01(sbf, BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('behavioural_risk_01 is deterministic across re-invocations', () => {
    const sbf = baselineSbf({ max_events_per_second: 10, pageview_burst_count_10s: 6 });
    const a = normaliseBehaviouralRisk01(sbf, BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
    const b = normaliseBehaviouralRisk01(sbf, BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
    const c = normaliseBehaviouralRisk01(sbf, BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('behavioural_risk_01 is monotonic in each configured feature', () => {
    const cfg = BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1;
    for (const key of NORMALISATION_FEATURE_KEYS) {
      // Map config-key → SBF column.
      const small = baselineSbf({ [colFor(key)]: cfg.thresholds[key].warn } as Partial<SessionBehaviouralFeaturesV0_3Row>);
      const large = baselineSbf({ [colFor(key)]: cfg.thresholds[key].hard } as Partial<SessionBehaviouralFeaturesV0_3Row>);
      const vSmall = normaliseBehaviouralRisk01(small, cfg);
      const vLarge = normaliseBehaviouralRisk01(large, cfg);
      expect(vLarge).toBeGreaterThanOrEqual(vSmall);
    }
  });

  it('baseline non-anomalous SBF row → behavioural_risk_01 ≈ 0', () => {
    const v = normaliseBehaviouralRisk01(baselineSbf(), BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
    expect(v).toBe(0);
  });

  it('all-hard SBF row → behavioural_risk_01 = 1', () => {
    const allHard = baselineSbf({
      max_events_per_second:      BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1.thresholds.events_per_second.hard,
      pageview_burst_count_10s:   BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1.thresholds.pageview_burst_count_10s.hard,
      sub_200ms_transition_count: BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1.thresholds.sub_200ms_transition_count.hard,
      refresh_loop_count:         BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1.thresholds.refresh_loop_count.hard,
      same_path_repeat_count:     BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1.thresholds.same_path_repeat_count.hard,
    });
    const v = normaliseBehaviouralRisk01(allHard, BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1);
    expect(v).toBe(1);
  });

  it('computeFeatureNormalisations returns per-feature 0..1 values', () => {
    const norms = computeFeatureNormalisations(
      baselineSbf({ max_events_per_second: 12 }),  // between warn=5 and hard=20
      BEHAVIOURAL_RISK_NORMALISATION_CONFIG_V0_1,
    );
    for (const k of NORMALISATION_FEATURE_KEYS) {
      expect(norms[k]).toBeGreaterThanOrEqual(0);
      expect(norms[k]).toBeLessThanOrEqual(1);
    }
    expect(norms.events_per_second).toBeCloseTo((12 - 5) / (20 - 5), 6);
  });
});

function colFor(key: string): keyof SessionBehaviouralFeaturesV0_3Row {
  switch (key) {
    case 'events_per_second':           return 'max_events_per_second';
    case 'pageview_burst_count_10s':    return 'pageview_burst_count_10s';
    case 'sub_200ms_transition_count':  return 'sub_200ms_transition_count';
    case 'refresh_loop_count':          return 'refresh_loop_count';
    case 'same_path_repeat_count':      return 'same_path_repeat_count';
    default: throw new Error(`unknown normalisation key: ${key}`);
  }
}

/* --------------------------------------------------------------------------
 * 3. ContextTag enum discipline
 * ------------------------------------------------------------------------ */

describe('PR#6 — ContextTag enum discipline', () => {
  it('every allowed ContextTag matches UPPER_SNAKE_CASE', () => {
    for (const t of CONTEXT_TAGS_ALLOWED) {
      expect(CONTEXT_TAG_SHAPE_REGEX.test(t)).toBe(true);
    }
  });

  it('no allowed ContextTag matches A_ / B_ / REVIEW_ / OBS_ / UX_ / RISK. prefixes', () => {
    for (const t of CONTEXT_TAGS_ALLOWED) {
      for (const p of FORBIDDEN_TAG_PREFIXES) {
        expect(t.startsWith(p)).toBe(false);
      }
    }
  });

  it('no allowed ContextTag matches forbidden_codes.yml patterns', () => {
    for (const t of CONTEXT_TAGS_ALLOWED) {
      for (const re of FORBIDDEN_TAG_PATTERNS) {
        expect(re.test(t)).toBe(false);
      }
    }
  });

  it('validateContextTag rejects A_* / B_* / RISK.* / BUYER_* / *_VERIFIED candidates', () => {
    const bad = ['A_TRAFFIC_INVALID', 'B_AI_AGENT', 'RISK.SOMETHING', 'BUYER_VERIFIED', 'INTENT_HIGH', 'EVENT_CONFIRMED'];
    for (const t of bad) {
      expect(validateContextTag(t)).not.toBeNull();
    }
  });

  it('assertContextTagsValid throws when cardinality > 16', () => {
    const tooMany = new Array(17).fill(CONTEXT_TAG.HIGH_REQUEST_BURST);
    expect(() => assertContextTagsValid(tooMany)).toThrow(/cardinality exceeded/);
  });

  it('CONTEXT_TAGS_MAX_PER_SESSION is exactly 16', () => {
    expect(CONTEXT_TAGS_MAX_PER_SESSION).toBe(16);
  });

  it('OBSERVATION_VERSION_DEFAULT is the v0.1 stamp', () => {
    expect(OBSERVATION_VERSION_DEFAULT).toBe('risk-obs-v0.1');
  });
});

/* --------------------------------------------------------------------------
 * 4. BYTESPIDER_PASSTHROUGH provenance-only discipline (Codex note #2)
 * ------------------------------------------------------------------------ */

describe('PR#6 — BYTESPIDER_PASSTHROUGH provenance-only discipline', () => {
  it('BYTESPIDER_PASSTHROUGH is a ContextTag only', () => {
    expect(CONTEXT_TAGS_ALLOWED.includes('BYTESPIDER_PASSTHROUGH' as ContextTag)).toBe(true);
  });

  it('shouldEmitBytespiderPassthrough fires on declared AI / search crawler families', () => {
    for (const fam of ['bytespider', 'gptbot', 'claudebot', 'perplexity-user', 'ccbot', 'googlebot', 'bingbot', 'duckduckbot', 'petalbot']) {
      expect(shouldEmitBytespiderPassthrough({ user_agent_family: fam })).toBe(true);
    }
  });

  it('shouldEmitBytespiderPassthrough does not fire on browser / curl / null', () => {
    expect(shouldEmitBytespiderPassthrough({ user_agent_family: 'browser' })).toBe(false);
    expect(shouldEmitBytespiderPassthrough({ user_agent_family: 'curl' })).toBe(false);
    expect(shouldEmitBytespiderPassthrough({})).toBe(false);
  });

  it('Bytespider Stage 0 row → adapter emits BYTESPIDER_PASSTHROUGH and ZERO B_* / Lane B / declared-agent fields', () => {
    const out = buyerreconBehaviouralToRiskInputs(
      baselineSbf(),
      baselineStage0({ rule_inputs: { user_agent_family: 'bytespider' } }),
    );
    expect(out.tags).toContain('BYTESPIDER_PASSTHROUGH');
    // No B_* tags.
    expect(out.tags.some((t) => t.startsWith('B_'))).toBe(false);
    // No declared-agent scoring field on RiskInputsCompat shape.
    expect(Object.keys(out)).not.toContain('declared_agent_label');
    expect(Object.keys(out)).not.toContain('lane_b_decision');
    expect(Object.keys(out)).not.toContain('ai_agent');
    expect(Object.keys(out)).not.toContain('reason_codes');
    expect(Object.keys(out)).not.toContain('risk_index');
    expect(Object.keys(out)).not.toContain('verification_score');
    expect(Object.keys(out)).not.toContain('evidence_band');
  });

  it('worker source contains zero INSERT INTO scoring_output_lane_b for any Bytespider passthrough', () => {
    const worker = stripTsComments(readFileSync(WORKER_FILE, 'utf8'));
    expect(/INSERT INTO\s+scoring_output_lane_b/i.test(worker)).toBe(false);
    expect(/INSERT INTO\s+scoring_output_lane_a/i.test(worker)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 5. behavioural_risk_01 naming discipline (Codex note #1)
 * ------------------------------------------------------------------------ */

describe('PR#6 — behavioural_risk_01 naming discipline (Codex note #1)', () => {
  it('PR#6 source describes behavioural_risk_01 as a normalised input feature, NOT a "score"', () => {
    for (const [, path] of PR6_ACTIVE_SOURCES) {
      const body = readFileSync(path, 'utf8');
      // It is acceptable for the source to NAME `risk_score` only in a
      // forbidden-token context (e.g. a denylist). The discipline check
      // is that PR#6 never types behavioural_risk_01 as a score-shaped
      // field. We test the assertion positively by inspecting the
      // documented purpose strings: "normalised input feature" or
      // "input feature" should appear at least once across PR#6 source.
      void body; // body is per-file; the positive-shape test runs once below.
    }
    // At least one PR#6 source file must explicitly describe
    // behavioural_risk_01 as an input feature (not a score).
    const concatenated = PR6_ACTIVE_SOURCES.map(([, p]) => readFileSync(p, 'utf8')).join('\n');
    expect(/normalised input feature|normalized input feature|input feature/i.test(concatenated)).toBe(true);
  });

  it('PR#6 source never associates behavioural_risk_01 with score / risk_index / verification_score / evidence_band (proximity sweep)', () => {
    // After stripping TS comments, scan each PR#6 active source for
    // every occurrence of `behavioural_risk_01`. Fail if any of the
    // forbidden tokens — `score` (whole word; does NOT match
    // `scoring_version` / `scoring`), `risk_index`,
    // `verification_score`, `evidence_band` — appears within ~80
    // chars in either direction.
    const PROXIMITY_CHARS = 80;
    const forbiddenChecks: ReadonlyArray<[string, RegExp]> = [
      ['score',              /\bscore\b/],
      ['risk_index',         /\brisk_index\b/],
      ['verification_score', /\bverification_score\b/],
      ['evidence_band',      /\bevidence_band\b/],
    ];
    for (const [name, path] of PR6_ACTIVE_SOURCES) {
      const stripped = stripTsComments(readFileSync(path, 'utf8'));
      const re = /behavioural_risk_01/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stripped)) !== null) {
        const start = Math.max(0, m.index - PROXIMITY_CHARS);
        const end   = Math.min(stripped.length, m.index + m[0].length + PROXIMITY_CHARS);
        const window = stripped.slice(start, end);
        for (const [label, fre] of forbiddenChecks) {
          if (fre.test(window)) {
            throw new Error(
              `PR#6 source ${name} associates behavioural_risk_01 with forbidden ` +
              `naming token "${label}" within ${PROXIMITY_CHARS} chars at index ` +
              `${m.index}. Context window:\n${JSON.stringify(window)}`,
            );
          }
        }
      }
    }
  });

  it('No PR#6 type or schema names behavioural_risk_01 as RiskIndex / verification_score / evidence_band', () => {
    const types = readFileSync(TYPES_FILE, 'utf8');
    const adapter = readFileSync(ADAPTER_FILE, 'utf8');
    const worker = readFileSync(WORKER_FILE, 'utf8');
    // None of the PR#6 active sources may *declare* a field with these names.
    for (const body of [types, adapter, worker]) {
      expect(/(?:^|[\s,;])risk_index\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])verification_score\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])evidence_band\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])reason_codes\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])reason_impacts\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])triggered_tags\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])penalty_total\s*:/m.test(body)).toBe(false);
      expect(/(?:^|[\s,;])action_recommendation\s*:/m.test(body)).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------
 * 6. RiskObservationRow + migration column-list discipline
 * ------------------------------------------------------------------------ */

describe('PR#6 — RiskObservationRow + migration column-list discipline', () => {
  it('migration 013 has no risk_index / verification_score / reason_codes / etc. columns', () => {
    const sql = readFileSync(MIGRATION_013, 'utf8');
    const forbidden = [
      'risk_index', 'verification_score', 'evidence_band',
      'action_recommendation', 'reason_codes', 'reason_impacts',
      'triggered_tags', 'penalty_total', 'final_decision',
      'trust_decision', 'policy_decision',
    ];
    // Look for COLUMN declarations only (`<name> TYPE`), not arbitrary
    // string occurrences in comments. The migration's column list is
    // bounded by the CREATE TABLE statement.
    const colDeclRegex = (name: string) => new RegExp(`(?:^|\\n)\\s*${name}\\s+[A-Z][A-Za-z0-9_(,)\\s]*`);
    for (const name of forbidden) {
      expect(colDeclRegex(name).test(sql)).toBe(false);
    }
    // Positive: the migration declares behavioural_risk_01.
    expect(/behavioural_risk_01\s+NUMERIC/.test(sql)).toBe(true);
  });

  it('migration 013 enforces record_only IS TRUE + all four *_risk_01 ranges', () => {
    const sql = readFileSync(MIGRATION_013, 'utf8');
    expect(/record_only\s+IS\s+TRUE/i.test(sql)).toBe(true);
    expect(/behavioural_risk_01\s*>=\s*0\s+AND\s+behavioural_risk_01\s*<=\s*1/i.test(sql)).toBe(true);
    expect(/device_risk_01\s*>=\s*0\s+AND\s+device_risk_01\s*<=\s*1/i.test(sql)).toBe(true);
    expect(/network_risk_01\s*>=\s*0\s+AND\s+network_risk_01\s*<=\s*1/i.test(sql)).toBe(true);
    expect(/identity_risk_01\s*>=\s*0\s+AND\s+identity_risk_01\s*<=\s*1/i.test(sql)).toBe(true);
  });

  it('migration 013 declares the 5-column UNIQUE natural key (D-14)', () => {
    const sql = readFileSync(MIGRATION_013, 'utf8');
    expect(/UNIQUE[\s\S]*?workspace_id[\s\S]*?site_id[\s\S]*?session_id[\s\S]*?observation_version[\s\S]*?scoring_version/.test(sql)).toBe(true);
  });

  it('migration 013 grants customer_api ZERO access (Hard Rule I parity)', () => {
    const sql = readFileSync(MIGRATION_013, 'utf8');
    expect(/REVOKE ALL ON risk_observations_v0_1 FROM buyerrecon_customer_api/i.test(sql)).toBe(true);
    expect(/has_table_privilege\([^)]*buyerrecon_customer_api[^)]*risk_observations_v0_1[^)]*SELECT/i.test(sql)).toBe(true);
  });

  it('RiskObservationRow shape has no forbidden field names', () => {
    type Row = RiskObservationRow;
    const exemplar: Row = {
      workspace_id:         'a',
      site_id:              'b',
      session_id:           'c',
      observation_version:  'd',
      scoring_version:      'e',
      velocity:             {},
      device_risk_01:       0,
      network_risk_01:      0,
      identity_risk_01:     0,
      behavioural_risk_01:  0,
      tags:                 [],
      record_only:          true,
      source_event_count:   0,
      evidence_refs:        [],
    };
    const keys = Object.keys(exemplar);
    for (const forbidden of [
      'risk_index', 'verification_score', 'evidence_band',
      'action_recommendation', 'reason_codes', 'reason_impacts',
      'triggered_tags', 'penalty_total',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

/* --------------------------------------------------------------------------
 * 7. No Lane A / Lane B writer; no forbidden imports; PR#4 wiring
 * ------------------------------------------------------------------------ */

describe('PR#6 — source-code scope discipline', () => {
  it('PR#6 source contains no INSERT INTO scoring_output_lane_a / _b', () => {
    for (const [, path] of PR6_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      expect(/INSERT\s+INTO\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/INSERT\s+INTO\s+scoring_output_lane_b/i.test(body)).toBe(false);
      expect(/UPDATE\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/UPDATE\s+scoring_output_lane_b/i.test(body)).toBe(false);
      // Also no SELECT from Lane A / Lane B.
      expect(/FROM\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/FROM\s+scoring_output_lane_b/i.test(body)).toBe(false);
    }
  });

  it('PR#6 source has no imports from collector / app / server / auth', () => {
    for (const [name, path] of PR6_ACTIVE_SOURCES) {
      const body = readFileSync(path, 'utf8');
      const forbiddenImportPatterns: RegExp[] = [
        /from\s+['"][^'"]*src\/collector\/v1/,
        /from\s+['"][^'"]*src\/app(\.|\/)/,
        /from\s+['"][^'"]*src\/server/,
        /from\s+['"][^'"]*src\/auth/,
      ];
      for (const re of forbiddenImportPatterns) {
        const match = re.test(body);
        if (match) {
          throw new Error(`PR#6 source ${name} contains forbidden import matching /${re.source}/`);
        }
      }
    }
  });

  it('PR#6 source has no ML / forbidden source-code substrings', () => {
    const forbiddenSubstrings = [
      'import sklearn', 'from sklearn',
      'import xgboost', 'from xgboost',
      'import torch',   'from torch',
      'import onnx',    'from onnx',
      'import lightgbm','from lightgbm',
      // truth-claim variable / field names from scoring/forbidden_codes.yml
      'fraud_confirmed', 'bot_confirmed', 'ai_detected', 'intent_verified',
      'buyer_verified', 'real_buyer_verified', 'is_real_buyer',
      'is_bot', 'is_ai', 'is_fraud', 'is_human',
      'human_score', 'bot_score', 'buyer_score', 'fraud_score', 'intent_score',
    ];
    for (const [name, path] of PR6_ACTIVE_SOURCES) {
      const body = readFileSync(path, 'utf8');
      // Strip comments + strings used only as denylist data.
      const stripped = body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      for (const s of forbiddenSubstrings) {
        if (stripped.includes(s)) {
          throw new Error(`PR#6 source ${name} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });

  it('worker imports + calls PR#4 startup guards', () => {
    const worker = readFileSync(WORKER_FILE, 'utf8');
    expect(/assertScoringContractsOrThrow\s*\(/.test(worker)).toBe(true);
    expect(/assertActiveScoringSourceCleanOrThrow\s*\(/.test(worker)).toBe(true);
    // And they are called BEFORE the SELECT/UPSERT pair.
    const guardIdx  = Math.max(worker.search(/assertScoringContractsOrThrow\s*\(/),
                               worker.search(/assertActiveScoringSourceCleanOrThrow\s*\(/));
    const insertIdx = worker.search(/INSERT INTO\s+risk_observations_v0_1/i);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(insertIdx);
  });

  it('worker reads only stage0_decisions + session_behavioural_features_v0_2', () => {
    const worker = stripTsComments(readFileSync(WORKER_FILE, 'utf8'));
    // The only FROM/JOIN clauses in the worker SQL refer to these two
    // sources (plus the destination's self-conflict resolution which is
    // not a FROM/JOIN).
    const fromMatches = worker.match(/(?:FROM|JOIN)\s+([a-z0-9_]+)/gi) ?? [];
    const tables = new Set(fromMatches.map((m) => m.replace(/(?:FROM|JOIN)\s+/i, '').toLowerCase()));
    const allowed = new Set([
      'stage0_decisions',
      'session_behavioural_features_v0_2',
    ]);
    for (const t of tables) {
      expect(allowed.has(t)).toBe(true);
    }
    // Forbidden sources must not appear.
    for (const forbidden of ['accepted_events', 'ingest_requests', 'session_features',
                              'scoring_output_lane_a', 'scoring_output_lane_b']) {
      expect(tables.has(forbidden)).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------
 * 8. Walked-tree forbidden-source-sweep — defence-in-depth (mirrors PR#5)
 * ------------------------------------------------------------------------ */

describe('PR#6 — risk-evidence subtree forbidden-source-sweep', () => {
  it('every .ts under src/scoring/risk-evidence/** carries no forbidden substring', () => {
    const root = join(ROOT, 'src', 'scoring', 'risk-evidence');
    const files = listTsFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const stripped = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      for (const s of ['import sklearn', 'import torch', 'import xgboost', 'fraud_confirmed', 'is_real_buyer']) {
        if (stripped.includes(s)) {
          throw new Error(`subtree sweep: ${f} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });
});

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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
