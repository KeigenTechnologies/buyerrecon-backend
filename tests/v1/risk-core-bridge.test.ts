/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — pure tests.
 *
 * Pure: no DB connection. Tests cover:
 *   - Deterministic envelope construction
 *   - Preservation of identity / source versions / evidence_refs
 *   - Normalized risk feature mapping (no "score" field exists)
 *   - Validation: empty fields, NaN, Infinity, out-of-range
 *   - Stage 0 eligibility derivation (excluded=true →
 *     eligible_for_buyer_motion_risk_core=false)
 *   - ContextTag carry-through (BYTESPIDER_PASSTHROUGH stays context-only)
 *   - Forbidden output keys absent (Lane A/B / score / RiskOutput /
 *     policy / trust / report / verdict / decision)
 *   - Input immutability
 *   - Source-code grep: no INSERT INTO scoring_output_lane_a/_b in
 *     PR#7b active source; no forbidden imports / ML libs
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  BRIDGE_SOURCE_TABLE,
  buildRiskCoreBridgeEnvelope,
  deepFreeze,
  preserveContextTags,
  preserveEvidenceRefs,
  preserveVelocity,
  RISK_CORE_BRIDGE_ENVELOPE_VERSION,
  type BridgeStage0Context,
  type RiskCoreBridgeEnvelope,
  type RiskCoreBridgeInput,
} from '../../src/scoring/risk-core-bridge/index.js';

/* --------------------------------------------------------------------------
 * Test-side defence-in-depth: forbidden envelope-key audit
 *
 * The denylist + walker live here (not in the adapter) so they don't
 * collide with the PR#3 generic-score-shaped-identifier sweep that
 * scans `src/scoring/**`. The PR#3 sweep excludes `tests/`, so the
 * literal forbidden tokens can safely appear here as denylist data.
 * The TypeScript envelope shape (`types.ts`) is the load-bearing
 * compile-time contract; this walker is belt-and-braces.
 * ------------------------------------------------------------------------ */

const FORBIDDEN_ENVELOPE_KEYS: readonly string[] = Object.freeze([
  // Scoring / RiskOutput territory
  'score',
  'final_score',
  'risk_score',
  'risk_index',
  'riskOutput',
  'risk_output',
  'verification_score',
  // Policy / lane projection territory
  'evidence_band',
  'action_recommendation',
  'policy',
  'policy_decision',
  'lane_a',
  'lane_b',
  'scoring_output_lane_a',
  'scoring_output_lane_b',
  // Trust / runtime decision territory
  'trust',
  'trust_decision',
  'final_decision',
  'runtime_decision',
  // Reason-code emission territory (downstream concern)
  'reason_codes',
  'reason_impacts',
  'triggered_tags',
  'penalty_total',
  // Customer-facing / report territory
  'customer_facing',
  'report',
  'verdict',
  'decision',
]);

const FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_ENVELOPE_KEYS);

function assertNoForbiddenKeys(value: unknown, path = '$'): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoForbiddenKeys(v, `${path}[${i}]`));
    return;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_SET.has(k)) {
      throw new Error(`bridge envelope contains forbidden key ${JSON.stringify(k)} at ${path}.${k}`);
    }
    assertNoForbiddenKeys((value as Record<string, unknown>)[k], `${path}.${k}`);
  }
}

const ROOT = join(__dirname, '..', '..');
const ADAPTER_FILE      = join(ROOT, 'src', 'scoring', 'risk-core-bridge', 'adapter.ts');
const TYPES_FILE        = join(ROOT, 'src', 'scoring', 'risk-core-bridge', 'types.ts');
const VERSION_FILE      = join(ROOT, 'src', 'scoring', 'risk-core-bridge', 'version.ts');
const EVIDENCE_FILE     = join(ROOT, 'src', 'scoring', 'risk-core-bridge', 'evidence-map.ts');
const INDEX_FILE        = join(ROOT, 'src', 'scoring', 'risk-core-bridge', 'index.ts');

const PR7B_ACTIVE_SOURCES: ReadonlyArray<[string, string]> = [
  ['src/scoring/risk-core-bridge/adapter.ts',      ADAPTER_FILE],
  ['src/scoring/risk-core-bridge/types.ts',        TYPES_FILE],
  ['src/scoring/risk-core-bridge/version.ts',      VERSION_FILE],
  ['src/scoring/risk-core-bridge/evidence-map.ts', EVIDENCE_FILE],
  ['src/scoring/risk-core-bridge/index.ts',        INDEX_FILE],
];

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

const FIXED_DERIVED_AT = '2026-05-13T09:00:00.000Z';

function baselineInput(
  overrides: Partial<RiskCoreBridgeInput> = {},
): RiskCoreBridgeInput {
  return {
    risk_observation_id:            '00000000-0000-4000-8000-000000000001',
    workspace_id:                   '__test_ws_pr7b__',
    site_id:                        '__test_site_pr7b__',
    session_id:                     'sess-baseline',
    observation_version:            'risk-obs-v0.1',
    scoring_version:                's2.v1.0',
    behavioural_feature_version:    'behavioural-features-v0.3',
    velocity: {
      events_per_second:          1,
      pageview_burst_count_10s:   0,
      sub_200ms_transition_count: 0,
      refresh_loop_count:         0,
      same_path_repeat_count:     0,
    },
    device_risk_01:                 0,
    network_risk_01:                0,
    identity_risk_01:               0,
    behavioural_risk_01:            0.42,
    context_tags:                   [],
    evidence_refs: [
      {
        table: 'session_behavioural_features_v0_2',
        behavioural_features_id: 7,
        feature_version: 'behavioural-features-v0.3',
      },
      {
        table: 'stage0_decisions',
        stage0_decision_id: '00000000-0000-4000-8000-0000000000aa',
        rule_id: 'no_stage0_exclusion',
      },
    ],
    source_event_count:             3,
    record_only:                    true,
    derived_at:                     FIXED_DERIVED_AT,
    ...overrides,
  };
}

function baselineStage0(overrides: Partial<BridgeStage0Context> = {}): BridgeStage0Context {
  return {
    stage0_decision_id:  '00000000-0000-4000-8000-0000000000aa',
    stage0_version:      'stage0-hard-exclusion-v0.2',
    excluded:            false,
    rule_id:             'no_stage0_exclusion',
    record_only:         true,
    ...overrides,
  };
}

/* --------------------------------------------------------------------------
 * 1. Builds deterministic envelope from minimal valid input
 * ------------------------------------------------------------------------ */

describe('PR#7b — buildRiskCoreBridgeEnvelope: determinism + shape', () => {
  it('builds an envelope from a minimal valid input', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    expect(env.envelope_version).toBe(RISK_CORE_BRIDGE_ENVELOPE_VERSION);
    expect(env.envelope_version).toBe('risk-core-bridge-envelope-v0.1');
    expect(env.source_table).toBe(BRIDGE_SOURCE_TABLE);
    expect(env.source_table).toBe('risk_observations_v0_1');
  });

  it('is deterministic — same input → byte-stable envelope', () => {
    const a = buildRiskCoreBridgeEnvelope(baselineInput());
    const b = buildRiskCoreBridgeEnvelope(baselineInput());
    const c = buildRiskCoreBridgeEnvelope(baselineInput());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it('reads no clock, env, DB, or filesystem (pure)', () => {
    // The adapter imports no `pg`, no `fs`, no `process`, no `fetch`.
    // Static-source grep verifies this; runtime behaviour is exercised
    // by the determinism test above (a clock read would fail it).
    const adapter = stripTsComments(readFileSync(ADAPTER_FILE, 'utf8'));
    expect(/from\s+['"]pg['"]/.test(adapter)).toBe(false);
    expect(/from\s+['"]fs['"]/.test(adapter)).toBe(false);
    expect(/from\s+['"]node:fs['"]/.test(adapter)).toBe(false);
    expect(/\bDate\.now\s*\(/.test(adapter)).toBe(false);
    expect(/\bprocess\.env\b/.test(adapter)).toBe(false);
    expect(/\bfetch\s*\(/.test(adapter)).toBe(false);
  });
});

/* --------------------------------------------------------------------------
 * 2. Preservation
 * ------------------------------------------------------------------------ */

describe('PR#7b — preservation of identity, versions, evidence_refs', () => {
  it('preserves workspace_id / site_id / session_id verbatim', () => {
    const input = baselineInput({
      workspace_id: 'ws-X',
      site_id:      'site-Y',
      session_id:   'sess-Z',
    });
    const env = buildRiskCoreBridgeEnvelope(input);
    expect(env.workspace_id).toBe('ws-X');
    expect(env.site_id).toBe('site-Y');
    expect(env.session_id).toBe('sess-Z');
  });

  it('preserves source identity (risk_observation_id) in two places', () => {
    const input = baselineInput({
      risk_observation_id: 'd9b4d8f2-1234-4abc-9def-000000000abc',
    });
    const env = buildRiskCoreBridgeEnvelope(input);
    expect(env.source_identity.risk_observation_id).toBe('d9b4d8f2-1234-4abc-9def-000000000abc');
    expect(env.provenance.risk_observation_id).toBe('d9b4d8f2-1234-4abc-9def-000000000abc');
  });

  it('preserves all required source versions', () => {
    const input = baselineInput({
      observation_version:         'risk-obs-v0.1',
      scoring_version:             's2.v1.0',
      behavioural_feature_version: 'behavioural-features-v0.3',
    });
    const stage0 = baselineStage0({ stage0_version: 'stage0-hard-exclusion-v0.2' });
    const env = buildRiskCoreBridgeEnvelope({ ...input, stage0 });
    expect(env.source_versions.observation_version).toBe('risk-obs-v0.1');
    expect(env.source_versions.scoring_version).toBe('s2.v1.0');
    expect(env.source_versions.behavioural_feature_version).toBe('behavioural-features-v0.3');
    expect(env.source_versions.stage0_version).toBe('stage0-hard-exclusion-v0.2');
  });

  it('records stage0_version as null when Stage 0 context is not provided', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    expect(env.source_versions.stage0_version).toBeNull();
  });

  it('preserves evidence_refs verbatim — no rewrite, no dedup, no summary', () => {
    const refs = [
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions',                   stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 2, feature_version: 'behavioural-features-v0.3' }, // intentional duplicate-table-entry
    ];
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ evidence_refs: refs }));
    expect(env.evidence_refs).toHaveLength(3);
    expect(env.evidence_refs[0]).toEqual(refs[0]);
    expect(env.evidence_refs[1]).toEqual(refs[1]);
    expect(env.evidence_refs[2]).toEqual(refs[2]);
  });

  it('preserves source_event_count and record_only literal', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ source_event_count: 11 }));
    expect(env.provenance.source_event_count).toBe(11);
    expect(env.provenance.record_only).toBe(true);
  });

  it('passes derived_at through (no clock read)', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ derived_at: '2030-01-01T00:00:00.000Z' }));
    expect(env.provenance.derived_at).toBe('2030-01-01T00:00:00.000Z');
  });
});

/* --------------------------------------------------------------------------
 * 3. Normalized risk feature mapping
 * ------------------------------------------------------------------------ */

describe('PR#7b — normalized_risk_features mapping', () => {
  it('maps all four *_risk_01 input features into normalized_risk_features', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      device_risk_01:      0.1,
      network_risk_01:     0.2,
      identity_risk_01:    0.3,
      behavioural_risk_01: 0.4,
    }));
    expect(env.normalized_risk_features.device_risk_01).toBe(0.1);
    expect(env.normalized_risk_features.network_risk_01).toBe(0.2);
    expect(env.normalized_risk_features.identity_risk_01).toBe(0.3);
    expect(env.normalized_risk_features.behavioural_risk_01).toBe(0.4);
  });

  it('preserves the velocity record verbatim', () => {
    const velocity = {
      events_per_second:          12,
      pageview_burst_count_10s:   5,
      sub_200ms_transition_count: 3,
      refresh_loop_count:         2,
      same_path_repeat_count:     4,
    };
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ velocity }));
    expect(env.normalized_risk_features.velocity).toEqual(velocity);
  });

  it('behavioural_risk_01 stays under normalized_risk_features only — NOT exposed as a top-level "score"', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_risk_01: 0.87 }));
    expect(env.normalized_risk_features.behavioural_risk_01).toBe(0.87);
    // The envelope has no top-level fields named like a score.
    const top = Object.keys(env);
    for (const forbidden of ['score', 'final_score', 'risk_score', 'risk_index', 'behavioural_score']) {
      expect(top).not.toContain(forbidden);
    }
  });

  it('no PR#7b active source declares a "score" / risk_index / verification_score / evidence_band field', () => {
    // Mirrors the PR#6 naming-discipline sweep (Codex non-blocking
    // note #1 carried into PR#7).
    for (const [name, path] of PR7B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      // Look for `<token>: TYPE` field declarations only — not
      // arbitrary string occurrences (the FORBIDDEN_ENVELOPE_KEYS list
      // itself is allowed to MENTION these tokens as data).
      for (const token of ['risk_index', 'verification_score', 'evidence_band',
                            'reason_codes', 'reason_impacts', 'triggered_tags',
                            'penalty_total', 'action_recommendation',
                            'final_decision', 'trust_decision',
                            'policy_decision', 'risk_score']) {
        const re = new RegExp(`(?:^|[\\s,;])${token}\\s*:\\s*(?:string|number|boolean|null|true|false|undefined|readonly|Record|Array)`, 'm');
        if (re.test(body)) {
          throw new Error(`PR#7b source ${name} declares forbidden field "${token}"`);
        }
      }
    }
  });
});

/* --------------------------------------------------------------------------
 * 4. Validation: empty / NaN / Infinity / out-of-range
 * ------------------------------------------------------------------------ */

describe('PR#7b — input validation', () => {
  it('rejects empty workspace_id', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ workspace_id: '' })))
      .toThrow(/workspace_id/);
  });

  it('rejects empty site_id', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ site_id: '' })))
      .toThrow(/site_id/);
  });

  it('rejects empty session_id', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ session_id: '' })))
      .toThrow(/session_id/);
  });

  it('rejects empty risk_observation_id', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ risk_observation_id: '' })))
      .toThrow(/risk_observation_id/);
  });

  it('rejects missing required source versions', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ observation_version: '' })))
      .toThrow(/observation_version/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ scoring_version: '' })))
      .toThrow(/scoring_version/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_feature_version: '' })))
      .toThrow(/behavioural_feature_version/);
  });

  it('rejects empty evidence_refs (PR#7a §5.3 required lineage)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ evidence_refs: [] })))
      .toThrow(/evidence_refs must contain at least one/);
  });

  it('rejects evidence_refs entries missing a non-empty `table`', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      evidence_refs: [{ table: '', some_id: 1 }],
    }))).toThrow(/evidence_refs\[0\]\.table/);
  });

  it('rejects *_risk_01 below 0', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_risk_01: -0.1 })))
      .toThrow(/behavioural_risk_01/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ device_risk_01: -1 })))
      .toThrow(/device_risk_01/);
  });

  it('rejects *_risk_01 above 1', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_risk_01: 1.000001 })))
      .toThrow(/behavioural_risk_01/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ network_risk_01: 2 })))
      .toThrow(/network_risk_01/);
  });

  it('rejects NaN risk values', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_risk_01: NaN })))
      .toThrow(/behavioural_risk_01/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ identity_risk_01: NaN })))
      .toThrow(/identity_risk_01/);
  });

  it('rejects Infinity risk values', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ behavioural_risk_01: Infinity })))
      .toThrow(/behavioural_risk_01/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ device_risk_01: -Infinity })))
      .toThrow(/device_risk_01/);
  });

  it('rejects velocity entries that are not finite numbers', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      velocity: { events_per_second: NaN },
    }))).toThrow(/velocity/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      velocity: { events_per_second: Infinity },
    }))).toThrow(/velocity/);
  });

  it('rejects negative source_event_count', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ source_event_count: -1 })))
      .toThrow(/source_event_count/);
  });

  it('rejects non-integer source_event_count', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ source_event_count: 3.5 })))
      .toThrow(/source_event_count/);
  });

  it('rejects record_only !== true', () => {
    expect(() => buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      record_only: false as unknown as true,
    })).toThrow(/record_only/);
  });

  it('rejects empty derived_at', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({ derived_at: '' })))
      .toThrow(/derived_at/);
  });
});

/* --------------------------------------------------------------------------
 * 4b. Codex blocker #1 — ContextTag enum constraint (PR#7a §8 + D-13)
 *
 * The bridge MUST reject any tag outside the Helen-signed D-13 enum,
 * including tags in forbidden reason-code namespaces (A_*, B_*,
 * REVIEW_*, OBS_*, UX_*, RISK.*) and tags matching
 * `forbidden_codes.yml` patterns (BUYER_*, *_VERIFIED, *_CONFIRMED,
 * etc.). The PR#6 `validateContextTag` encodes all three checks.
 * ------------------------------------------------------------------------ */

describe('PR#7b — ContextTag enum constraint (Codex blocker #1)', () => {
  it('rejects unknown enum value (UNKNOWN_TAG)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['UNKNOWN_TAG'],
    }))).toThrow(/context_tags\[0\][\s\S]*not in the Helen-signed D-13 enum/);
  });

  it('rejects B_* namespace (taxonomy / Lane B reason-code shape)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['B_KNOWN_AGENT'],
    }))).toThrow(/context_tags\[0\][\s\S]*forbidden namespace prefix "B_"/);
  });

  it('rejects A_* namespace (Lane A reason-code shape)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['A_TRAFFIC_INVALID'],
    }))).toThrow(/context_tags\[0\][\s\S]*forbidden namespace prefix "A_"/);
  });

  it('rejects REVIEW_* / OBS_* / UX_* / RISK.* namespaces', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['REVIEW_HUMAN'],
    }))).toThrow(/forbidden namespace prefix "REVIEW_"/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['OBS_SOMETHING'],
    }))).toThrow(/forbidden namespace prefix "OBS_"/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['UX_RENDERED'],
    }))).toThrow(/forbidden namespace prefix "UX_"/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['RISK.SOMETHING'],
    }))).toThrow(/UPPER_SNAKE_CASE shape|forbidden namespace prefix "RISK\."/);
  });

  it('rejects customer-judgement shaped value (BUYER_VERIFIED)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['BUYER_VERIFIED'],
    }))).toThrow(/forbidden namespace prefix "BUYER_"|forbidden pattern/);
  });

  it('rejects *_CONFIRMED / *_VERIFIED truth-claim patterns', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['SESSION_CONFIRMED'],
    }))).toThrow(/forbidden pattern/);
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['INTENT_VERIFIED'],
    }))).toThrow(/forbidden pattern|forbidden namespace prefix "INTENT_"/);
  });

  it('rejects non-UPPER_SNAKE_CASE shape', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['camelCaseTag'],
    }))).toThrow(/UPPER_SNAKE_CASE shape/);
  });

  it('accepts every Helen-signed D-13 enum value', () => {
    const enumValues = [
      'REFRESH_LOOP_CANDIDATE',
      'HIGH_REQUEST_BURST',
      'ZERO_FOREGROUND_TIME',
      'NO_MEANINGFUL_INTERACTION',
      'JS_NOT_EXECUTED',
      'SUB_200MS_TRANSITION_RUN',
      'BEHAVIOURAL_CADENCE_ANOMALY',
      'BYTESPIDER_PASSTHROUGH',
    ];
    const env = buildRiskCoreBridgeEnvelope(baselineInput({ context_tags: enumValues }));
    expect(env.context_tags).toEqual(enumValues);
  });
});

/* --------------------------------------------------------------------------
 * 4c. Codex blocker #2 — behavioural_feature_version lineage anchor
 *
 * PR#7a §5.2: behavioural_feature_version MUST be sourced from the
 * `session_behavioural_features_v0_2` provenance entry on
 * `evidence_refs[]`. The adapter MUST refuse to process a row where
 * the SBF anchor is missing or where its feature_version disagrees
 * with the declared input.behavioural_feature_version.
 * ------------------------------------------------------------------------ */

describe('PR#7b — behavioural_feature_version lineage anchor (Codex blocker #2)', () => {
  it('rejects evidence_refs missing the session_behavioural_features_v0_2 entry', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      evidence_refs: [
        // only a Stage 0 entry; no SBF entry
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }))).toThrow(/must contain at least one "session_behavioural_features_v0_2" entry/);
  });

  it('rejects SBF entry missing a non-empty feature_version', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 7 /* no feature_version */ },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }))).toThrow(/session_behavioural_features_v0_2 entry #0 is missing a non-empty feature_version/);
  });

  it('rejects SBF entry with empty-string feature_version', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 7, feature_version: '' },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }))).toThrow(/missing a non-empty feature_version/);
  });

  it('rejects mismatch between declared input version and SBF provenance feature_version', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      behavioural_feature_version: 'behavioural-features-v0.3',
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 7, feature_version: 'behavioural-features-v0.2' },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }))).toThrow(/must match evidence_refs session_behavioural_features_v0_2 entry feature_version/);
  });

  it('rejects mismatch when multiple SBF entries disagree (any disagreement is a lineage break)', () => {
    expect(() => buildRiskCoreBridgeEnvelope(baselineInput({
      behavioural_feature_version: 'behavioural-features-v0.3',
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 2, feature_version: 'behavioural-features-v0.2' },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }))).toThrow(/must match evidence_refs session_behavioural_features_v0_2/);
  });

  it('accepts multiple SBF entries when all agree on feature_version', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      behavioural_feature_version: 'behavioural-features-v0.3',
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 2, feature_version: 'behavioural-features-v0.3' },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
    }));
    expect(env.source_versions.behavioural_feature_version).toBe('behavioural-features-v0.3');
  });
});

/* --------------------------------------------------------------------------
 * 5. Stage 0 eligibility
 * ------------------------------------------------------------------------ */

describe('PR#7b — Stage 0 eligibility', () => {
  it('stage0.excluded=true sets eligible_for_buyer_motion_risk_core=false', () => {
    const env = buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ excluded: true, rule_id: 'known_bot_ua_family' }),
    });
    expect(env.eligibility.stage0_excluded).toBe(true);
    expect(env.eligibility.eligible_for_buyer_motion_risk_core).toBe(false);
    expect(env.eligibility.stage0_rule_id).toBe('known_bot_ua_family');
    // bridge_eligible is the structural literal — still true.
    expect(env.eligibility.bridge_eligible).toBe(true);
  });

  it('stage0.excluded=false keeps eligible_for_buyer_motion_risk_core=true', () => {
    const env = buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ excluded: false }),
    });
    expect(env.eligibility.stage0_excluded).toBe(false);
    expect(env.eligibility.eligible_for_buyer_motion_risk_core).toBe(true);
    expect(env.eligibility.stage0_rule_id).toBe('no_stage0_exclusion');
  });

  it('no stage0 context — stage0_excluded=false (default), rule_id=null, eligibility=true', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    expect(env.eligibility.stage0_excluded).toBe(false);
    expect(env.eligibility.stage0_rule_id).toBeNull();
    expect(env.eligibility.eligible_for_buyer_motion_risk_core).toBe(true);
  });

  it('Stage 0 rule_id does NOT leak into normalized_risk_features', () => {
    const env = buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ rule_id: 'scanner_or_probe_path' }),
    });
    const featureKeys = Object.keys(env.normalized_risk_features);
    expect(featureKeys).not.toContain('rule_id');
    expect(featureKeys).not.toContain('stage0_rule_id');
    expect(featureKeys).not.toContain('scanner_or_probe_path');
    // And it doesn't leak into context_tags either.
    expect(env.context_tags).not.toContain('scanner_or_probe_path');
  });

  it('rejects stage0 with empty stage0_decision_id / version / rule_id', () => {
    expect(() => buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ stage0_decision_id: '' }),
    })).toThrow(/stage0\.stage0_decision_id/);
    expect(() => buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ stage0_version: '' }),
    })).toThrow(/stage0\.stage0_version/);
    expect(() => buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: baselineStage0({ rule_id: '' }),
    })).toThrow(/stage0\.rule_id/);
  });

  it('rejects stage0.record_only !== true', () => {
    expect(() => buildRiskCoreBridgeEnvelope({
      ...baselineInput(),
      stage0: { ...baselineStage0(), record_only: false as unknown as true },
    })).toThrow(/stage0\.record_only/);
  });
});

/* --------------------------------------------------------------------------
 * 6. ContextTag carry-through (BYTESPIDER_PASSTHROUGH discipline)
 * ------------------------------------------------------------------------ */

describe('PR#7b — ContextTag carry-through', () => {
  it('BYTESPIDER_PASSTHROUGH is carried as context/provenance only', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['BYTESPIDER_PASSTHROUGH', 'HIGH_REQUEST_BURST'],
    }));
    expect(env.context_tags).toContain('BYTESPIDER_PASSTHROUGH');
    expect(env.context_tags).toContain('HIGH_REQUEST_BURST');
  });

  it('BYTESPIDER_PASSTHROUGH does NOT alter normalized_risk_features', () => {
    const baseFeatures = {
      device_risk_01:      0,
      network_risk_01:     0,
      identity_risk_01:    0,
      behavioural_risk_01: 0.5,
    };
    const without = buildRiskCoreBridgeEnvelope(baselineInput({
      ...baseFeatures,
      context_tags: [],
    }));
    const withTag = buildRiskCoreBridgeEnvelope(baselineInput({
      ...baseFeatures,
      context_tags: ['BYTESPIDER_PASSTHROUGH'],
    }));
    expect(withTag.normalized_risk_features).toEqual(without.normalized_risk_features);
  });

  it('BYTESPIDER_PASSTHROUGH does NOT cause any Lane B emission on the envelope', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['BYTESPIDER_PASSTHROUGH'],
    }));
    expect(Object.keys(env)).not.toContain('lane_b');
    expect(Object.keys(env)).not.toContain('scoring_output_lane_b');
    // And no AI-agent classification field.
    expect(Object.keys(env)).not.toContain('ai_agent');
    expect(Object.keys(env)).not.toContain('declared_agent_label');
    expect(Object.keys(env)).not.toContain('agent_class');
    // The forbidden-key sweep below covers this comprehensively.
    assertNoForbiddenKeys(env);
  });
});

/* --------------------------------------------------------------------------
 * 7. Forbidden keys absent on envelope
 * ------------------------------------------------------------------------ */

describe('PR#7b — forbidden envelope keys', () => {
  it('FORBIDDEN_ENVELOPE_KEYS includes every key the contract forbids', () => {
    const required: ReadonlyArray<string> = [
      'scoring_output_lane_a', 'scoring_output_lane_b', 'lane_a', 'lane_b',
      'score', 'risk_score', 'risk_index', 'riskOutput', 'risk_output',
      'verification_score', 'evidence_band', 'action_recommendation',
      'policy', 'policy_decision', 'trust', 'trust_decision',
      'final_decision', 'reason_codes', 'reason_impacts',
      'triggered_tags', 'penalty_total',
      'customer_facing', 'report', 'verdict', 'decision',
    ];
    for (const k of required) {
      expect(FORBIDDEN_ENVELOPE_KEYS).toContain(k);
    }
  });

  it('assertNoForbiddenKeys passes on a happy-path envelope', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      context_tags: ['BYTESPIDER_PASSTHROUGH', 'HIGH_REQUEST_BURST'],
    }));
    expect(() => assertNoForbiddenKeys(env)).not.toThrow();
  });

  it('assertNoForbiddenKeys catches a synthetic injected forbidden key', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    // The real envelope is deep-frozen; synthesise a mutable variant
    // to prove the audit walker works.
    const synthetic = JSON.parse(JSON.stringify(env)) as Record<string, unknown>;
    synthetic.risk_score = 42;
    expect(() => assertNoForbiddenKeys(synthetic)).toThrow(/risk_score/);
  });

  it('catches a forbidden key nested inside provenance', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    const synthetic = JSON.parse(JSON.stringify(env)) as RiskCoreBridgeEnvelope & {
      provenance: { lane_a: unknown };
    };
    synthetic.provenance.lane_a = 'oops';
    expect(() => assertNoForbiddenKeys(synthetic)).toThrow(/lane_a/);
  });

  it('every PR#7b active source contains no `INSERT INTO scoring_output_lane_a/_b`', () => {
    for (const [, path] of PR7B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      expect(/INSERT\s+INTO\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/INSERT\s+INTO\s+scoring_output_lane_b/i.test(body)).toBe(false);
      expect(/UPDATE\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/UPDATE\s+scoring_output_lane_b/i.test(body)).toBe(false);
      expect(/FROM\s+scoring_output_lane_a/i.test(body)).toBe(false);
      expect(/FROM\s+scoring_output_lane_b/i.test(body)).toBe(false);
    }
  });

  it('every PR#7b active source contains no forbidden imports', () => {
    const forbiddenImports: RegExp[] = [
      /from\s+['"][^'"]*src\/collector\/v1/,
      /from\s+['"][^'"]*src\/app(\.|\/)/,
      /from\s+['"][^'"]*src\/server/,
      /from\s+['"][^'"]*src\/auth/,
      /from\s+['"]pg['"]/,
    ];
    for (const [name, path] of PR7B_ACTIVE_SOURCES) {
      const body = stripTsComments(readFileSync(path, 'utf8'));
      for (const re of forbiddenImports) {
        if (re.test(body)) {
          throw new Error(`PR#7b source ${name} contains forbidden import matching /${re.source}/`);
        }
      }
    }
  });

  it('every PR#7b active source contains no ML / truth-claim substrings', () => {
    const forbiddenSubstrings = [
      'import sklearn', 'from sklearn',
      'import xgboost', 'from xgboost',
      'import torch',   'from torch',
      'import onnx',    'from onnx',
      'import lightgbm','from lightgbm',
      'fraud_confirmed', 'bot_confirmed', 'ai_detected', 'intent_verified',
      'buyer_verified', 'real_buyer_verified', 'is_real_buyer',
      'is_bot', 'is_ai', 'is_fraud', 'is_human',
      'human_score', 'bot_score', 'buyer_score', 'fraud_score', 'intent_score',
    ];
    for (const [name, path] of PR7B_ACTIVE_SOURCES) {
      const stripped = stripTsComments(readFileSync(path, 'utf8'));
      for (const s of forbiddenSubstrings) {
        if (stripped.includes(s)) {
          throw new Error(`PR#7b source ${name} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });

  it('PR#7b subtree forbidden-source-sweep (defence-in-depth)', () => {
    const root = join(ROOT, 'src', 'scoring', 'risk-core-bridge');
    const files = listTsFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const stripped = stripTsComments(readFileSync(f, 'utf8'))
        .replace(/['"]\s*pg\s*['"]/, '');  // not relevant here, defensive
      for (const s of ['import sklearn', 'import torch', 'import xgboost', 'fraud_confirmed', 'is_real_buyer']) {
        if (stripped.includes(s)) {
          throw new Error(`subtree sweep: ${f} contains forbidden substring ${JSON.stringify(s)}`);
        }
      }
    }
  });
});

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

/* --------------------------------------------------------------------------
 * 8. Input immutability
 * ------------------------------------------------------------------------ */

describe('PR#7b — input immutability', () => {
  it('does not mutate the input object', () => {
    const input = baselineInput({
      context_tags: ['HIGH_REQUEST_BURST'],
      evidence_refs: [
        { table: 'session_behavioural_features_v0_2', behavioural_features_id: 9, feature_version: 'behavioural-features-v0.3' },
        { table: 'stage0_decisions', stage0_decision_id: 'abc', rule_id: 'no_stage0_exclusion' },
      ],
      velocity: { events_per_second: 4, pageview_burst_count_10s: 2 },
    });
    const snapshot = JSON.stringify(input);
    buildRiskCoreBridgeEnvelope(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('envelope arrays/objects do not share identity with input', () => {
    const refs = [
      { table: 'session_behavioural_features_v0_2', behavioural_features_id: 1, feature_version: 'behavioural-features-v0.3' },
      { table: 'stage0_decisions', stage0_decision_id: 'x', rule_id: 'no_stage0_exclusion' },
    ];
    const tags = ['HIGH_REQUEST_BURST'];
    const velocity = { events_per_second: 7 };
    const env = buildRiskCoreBridgeEnvelope(baselineInput({
      evidence_refs: refs,
      context_tags:  tags,
      velocity,
    }));
    expect(env.evidence_refs).not.toBe(refs);
    expect(env.context_tags).not.toBe(tags);
    expect(env.normalized_risk_features.velocity).not.toBe(velocity);
  });

  it('envelope is deep-frozen', () => {
    const env = buildRiskCoreBridgeEnvelope(baselineInput());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.source_versions)).toBe(true);
    expect(Object.isFrozen(env.normalized_risk_features)).toBe(true);
    expect(Object.isFrozen(env.normalized_risk_features.velocity)).toBe(true);
    expect(Object.isFrozen(env.eligibility)).toBe(true);
    expect(Object.isFrozen(env.provenance)).toBe(true);
    expect(Object.isFrozen(env.evidence_refs)).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 9. Pure helpers (evidence-map.ts)
 * ------------------------------------------------------------------------ */

describe('PR#7b — evidence-map pure helpers', () => {
  it('preserveEvidenceRefs returns deep-frozen verbatim copy', () => {
    const refs = [{ table: 't', id: 1 }, { table: 'u', id: 2 }];
    const out  = preserveEvidenceRefs(refs);
    expect(out).toEqual(refs);
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out[0])).toBe(true);
  });

  it('preserveVelocity returns deep-frozen verbatim copy', () => {
    const v = { events_per_second: 1, pageview_burst_count_10s: 0 };
    const out = preserveVelocity(v);
    expect(out).toEqual(v);
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('preserveContextTags returns deep-frozen verbatim copy', () => {
    const tags = ['HIGH_REQUEST_BURST', 'BYTESPIDER_PASSTHROUGH'];
    const out  = preserveContextTags(tags);
    expect(out).toEqual(tags);
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('deepFreeze on a primitive is a no-op', () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('s')).toBe('s');
    expect(deepFreeze(null)).toBeNull();
  });
});
