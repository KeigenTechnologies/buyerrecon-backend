import { describe, expect, it } from 'vitest';

import {
  AMS_GOLDEN_SCHEMA_VERSION,
  GOLDEN_PACKAGE_ARTIFACT_VERSION,
  buildGoldenSessionPackage,
  deriveBuyerMotionPresentation,
  renderGoldenSessionMarkdown,
  serializeGoldenSessionPackage,
  validateAmsGoldenSessionJson,
  type AmsGoldenSessionResult,
} from '../../../src/reports/external/golden-session-package.js';
import {
  GOLDEN_SESSION_STAGE_MISSING_LABELS,
  mapSessionRowsToEvidenceAtoms,
  readSessionPersistedRows,
  summarizeStagePresence,
  type BackendSessionIdentity,
  type GoldenSessionDbClient,
  type SessionPersistedRows,
} from '../../../src/reports/external/session-evidence-atoms.js';

// ---------------------------------------------------------------------------
// Fixtures: injected fake AMS process result + injected fake database rows.
// No real AMS CLI and no real database are used anywhere in this suite.
// ---------------------------------------------------------------------------

const WINDOW_START = '2026-07-20T00:00:00Z';
const WINDOW_END = '2026-07-20T23:59:59Z';

const IDENTITY: BackendSessionIdentity = {
  workspace_id: 'ws_golden',
  project_id: 'golden-session-internal',
  site_id: 'site_golden',
  session_id: 'session_backend_001',
  window_start: WINDOW_START,
  window_end: WINDOW_END,
};

const EXPECTED_AMS_IDENTITY = {
  site_id: 'site_golden',
  subject_id: 'browser_subject_abc',
  window_start: WINDOW_START,
  window_end: WINDOW_END,
};

function amsFixture(): AmsGoldenSessionResult {
  return {
    schema_version: AMS_GOLDEN_SCHEMA_VERSION,
    status: 'SCORED',
    limitations: [],
    scope: {
      site_id: 'site_golden',
      subject_id: 'browser_subject_abc',
      subject_identity_model: 'browser_subject',
      session_level_isolation: false,
      window_start: WINDOW_START,
      window_end: WINDOW_END,
    },
    authoritative_final_decision: 'ALLOW_WITH_FRICTION',
    risk: { RiskIndex: 12, ReasonCodes: ['RISK.VELOCITY_NORMAL'] },
    series: { SeriesConfidence: 0.4 },
    poi: { PoiScore: 61, IntentClass: 'evaluation', Confidence01: 0.7, ReasonCodes: ['POI.PROGRESSION'] },
    product_decision: {
      ProductScore: 58,
      RequestedAction: 'SOFT_PROMPT',
      ReasonCodes: ['BR.FIT_OK', 'BR.INTENT_BUILDING'],
      DecisionConfidence01: 0.66,
    },
    policy_pass_1: {
      TrustInvocationMode: 'CONTINUE',
      ActionTier: 'tier_2',
      GatingReasonCodes: ['P1.TIER_OK'],
      EarlyExit: false,
    },
    trust: {
      TrustBand: 'building',
      Decision: 'SOFT_PROMPT',
      ConfidenceScore01: 0.52,
      ReasonCodes: ['TRUST.HISTORY_THIN'],
    },
    runtime_decision: {
      FinalDecision: 'ALLOW_WITH_FRICTION',
      GatingReasonCodes: ['P2.FRICTION_APPLIED'],
      ActionTier: 'tier_2',
    },
    evidence_card: {
      FitScore: 71,
      FitReasonCodes: ['FIT.SEGMENT_MATCH'],
      IntentScore: 55,
      IntentState: 'building',
      IntentReasonCodes: ['INTENT.REPEAT_VIEW'],
      WindowScore: 47,
      WindowState: 'open',
      WindowReasonCodes: ['WINDOW.RECENT'],
      TRQScore: 60,
      TRQBand: 'medium',
      RequestedAction: 'SOFT_PROMPT',
      ActionReasonCodes: ['ACTION.SOFT_PROMPT_OK'],
    },
    source_event_ids: [101, 102, 103],
  };
}

function amsFixtureJson(mutate?: (value: Record<string, unknown>) => void): string {
  const value = JSON.parse(JSON.stringify(amsFixture())) as Record<string, unknown>;
  if (mutate !== undefined) mutate(value);
  return JSON.stringify(value, null, 2);
}

function fullRows(): SessionPersistedRows {
  return {
    accepted_events_aggregate: {
      source_event_count: 9,
      first_event_id: 101,
      last_event_id: 103,
      first_received_at: '2026-07-20T10:00:00.000Z',
      last_received_at: '2026-07-20T10:20:00.000Z',
    },
    session_features: {
      session_features_id: 41,
      extraction_version: 'session-features-v0.1',
      extracted_at: '2026-07-20T11:00:00.000Z',
      first_seen_at: '2026-07-20T10:00:00.000Z',
      last_seen_at: '2026-07-20T10:20:00.000Z',
      session_duration_ms: 1_200_000,
      source_event_count: 9,
      page_view_count: 5,
      cta_click_count: 1,
      form_start_count: 1,
      form_submit_count: 0,
      unique_path_count: 4,
    },
    behavioural_features: {
      behavioural_features_id: 7,
      feature_version: 'behavioural-v0.2',
      extracted_at: '2026-07-20T11:05:00.000Z',
      first_seen_at: '2026-07-20T10:00:00.000Z',
      last_seen_at: '2026-07-20T10:20:00.000Z',
      source_event_count: 9,
      valid_feature_count: 11,
      missing_feature_count: 2,
    },
    stage0_decisions: [{
      stage0_decision_id: '3f0e8a3c-0000-4000-8000-000000000001',
      scoring_version: 'stage0-v0.1',
      excluded: false,
      rule_id: 'stage0.rule.human_traffic',
      created_at: '2026-07-20T10:30:00.000Z',
      source_event_count: 9,
    }],
    risk_observations: [{
      risk_observation_id: '3f0e8a3c-0000-4000-8000-000000000002',
      observation_version: 'risk-obs-v0.1',
      scoring_version: 'risk-core-v1',
      created_at: '2026-07-20T10:35:00.000Z',
      source_event_count: 9,
    }],
    poi_observations: [{
      poi_observation_id: 5001,
      poi_type: 'pricing_page',
      poi_key: '/pricing',
      poi_observation_version: 'poi-obs-v0.1',
      poi_eligible: true,
      derived_at: '2026-07-20T10:40:00.000Z',
      first_seen_at: '2026-07-20T10:05:00.000Z',
      last_seen_at: '2026-07-20T10:15:00.000Z',
      source_event_count: 3,
    }],
    poi_sequence_observations: [{
      poi_sequence_observation_id: 6001,
      poi_sequence_version: 'poi-sequence-v0.1',
      poi_count: 3,
      unique_poi_count: 2,
      poi_sequence_pattern_class: 'progression',
      has_repetition: false,
      has_progression: true,
      derived_at: '2026-07-20T10:45:00.000Z',
      first_seen_at: '2026-07-20T10:05:00.000Z',
      last_seen_at: '2026-07-20T10:15:00.000Z',
    }],
  };
}

function emptyRows(): SessionPersistedRows {
  return {
    accepted_events_aggregate: null,
    session_features: null,
    behavioural_features: null,
    stage0_decisions: [],
    risk_observations: [],
    poi_observations: [],
    poi_sequence_observations: [],
  };
}

function validatedAms(): AmsGoldenSessionResult {
  const validation = validateAmsGoldenSessionJson(amsFixtureJson(), EXPECTED_AMS_IDENTITY);
  if (validation.ok === false) throw new Error('fixture must validate');
  return validation.result;
}

function buildFixturePackage(rows: SessionPersistedRows = fullRows()) {
  return buildGoldenSessionPackage({ backend_identity: IDENTITY, ams: validatedAms(), rows });
}

// ---------------------------------------------------------------------------

describe('AMS golden JSON validation', () => {
  it('accepts the pinned merged-AMS golden JSON shape', () => {
    const validation = validateAmsGoldenSessionJson(amsFixtureJson(), EXPECTED_AMS_IDENTITY);
    expect(validation.ok).toBe(true);
  });

  it('rejects malformed JSON and multiple JSON values safely', () => {
    for (const raw of ['{not json', '{}{}', `${amsFixtureJson()}\n${amsFixtureJson()}`]) {
      const validation = validateAmsGoldenSessionJson(raw, EXPECTED_AMS_IDENTITY);
      expect(validation.ok).toBe(false);
      if (validation.ok === false) expect(validation.failure_stage).toBe('ams_output_invalid');
    }
  });

  it('rejects unsupported schema versions and unknown top-level keys', () => {
    const badVersion = validateAmsGoldenSessionJson(
      amsFixtureJson((v) => { v.schema_version = 'golden-session-ams-v9.9'; }),
      EXPECTED_AMS_IDENTITY,
    );
    expect(badVersion.ok).toBe(false);

    const extraKey = validateAmsGoldenSessionJson(
      amsFixtureJson((v) => { v.unexpected_extra = { x: 1 }; }),
      EXPECTED_AMS_IDENTITY,
    );
    expect(extraKey.ok).toBe(false);
  });

  it('rejects a SCORED result whose runtime decision is missing or contradictory', () => {
    const missingRuntime = validateAmsGoldenSessionJson(
      amsFixtureJson((v) => { delete v.runtime_decision; }),
      EXPECTED_AMS_IDENTITY,
    );
    expect(missingRuntime.ok).toBe(false);

    const contradictory = validateAmsGoldenSessionJson(
      amsFixtureJson((v) => { v.authoritative_final_decision = 'DENY'; }),
      EXPECTED_AMS_IDENTITY,
    );
    expect(contradictory.ok).toBe(false);
    if (contradictory.ok === false) {
      expect(contradictory.reasons).toContain('contradictory_final_decision');
    }
  });

  it('fails safely on a mismatched AMS subject', () => {
    const validation = validateAmsGoldenSessionJson(amsFixtureJson(), {
      ...EXPECTED_AMS_IDENTITY,
      subject_id: 'browser_subject_other',
    });
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(validation.failure_stage).toBe('ams_identity_mismatch');
      expect(validation.reasons).toContain('subject_mismatch');
    }
  });

  it('fails safely on mismatched pinned bounds', () => {
    const validation = validateAmsGoldenSessionJson(amsFixtureJson(), {
      ...EXPECTED_AMS_IDENTITY,
      window_end: '2026-07-21T23:59:59Z',
    });
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(validation.failure_stage).toBe('ams_identity_mismatch');
      expect(validation.reasons).toContain('window_end_mismatch');
    }
  });

  it('rejects an AMS result that claims session-level isolation', () => {
    const validation = validateAmsGoldenSessionJson(
      amsFixtureJson((v) => { (v.scope as Record<string, unknown>).session_level_isolation = true; }),
      EXPECTED_AMS_IDENTITY,
    );
    expect(validation.ok).toBe(false);
  });
});

describe('authoritative decision preservation (no recalculation)', () => {
  it('preserves the Policy Pass 2 final decision exactly as AMS reported it', () => {
    const pkg = buildFixturePackage();
    expect(pkg.ams_authoritative.authoritative_final_decision).toBe('ALLOW_WITH_FRICTION');
    expect(pkg.ams_authoritative.runtime_decision?.FinalDecision).toBe('ALLOW_WITH_FRICTION');
  });

  it('preserves Fit, Intent, Window, TRQ, Action, Pass 1, Trust and reason codes verbatim', () => {
    const pkg = buildFixturePackage();
    const fixture = amsFixture();
    expect(pkg.ams_authoritative.evidence_card).toEqual(fixture.evidence_card);
    expect(pkg.ams_authoritative.product_decision).toEqual(fixture.product_decision);
    expect(pkg.ams_authoritative.policy_pass_1).toEqual(fixture.policy_pass_1);
    expect(pkg.ams_authoritative.trust).toEqual(fixture.trust);
    expect(pkg.ams_authoritative.risk).toEqual(fixture.risk);
    expect(pkg.ams_authoritative.poi).toEqual(fixture.poi);
    expect(pkg.ams_authoritative.runtime_decision?.GatingReasonCodes).toEqual(['P2.FRICTION_APPLIED']);
  });

  it('does not duplicate AMS scoring: backend rows never change the AMS decision payload', () => {
    const withEvidence = buildFixturePackage(fullRows());
    const withoutEvidence = buildFixturePackage(emptyRows());
    expect(withEvidence.ams_authoritative).toEqual(withoutEvidence.ams_authoritative);
    expect(withEvidence.buyer_motion).toBe(withoutEvidence.buyer_motion);
    expect(withEvidence.recommended_operator_action).toBe(withoutEvidence.recommended_operator_action);
  });

  it('presents buyer motion categorically without inventing presence from absence', () => {
    expect(deriveBuyerMotionPresentation(validatedAms())).toBe('present');

    const noAction = validatedAms();
    noAction.product_decision = { ...noAction.product_decision!, RequestedAction: 'NO_ACTION' };
    expect(deriveBuyerMotionPresentation(noAction)).toBe('absent');

    const unscored = validatedAms();
    unscored.status = 'NO_EVENTS_IN_SCOPE';
    expect(deriveBuyerMotionPresentation(unscored)).toBe('uncertain');

    const degraded = validatedAms();
    degraded.limitations = ['degraded:config'];
    expect(deriveBuyerMotionPresentation(degraded)).toBe('uncertain');
  });
});

describe('dual identity', () => {
  it('keeps the backend session identity and the AMS browser-subject identity distinct', () => {
    const pkg = buildFixturePackage();
    expect(pkg.backend_session_identity.session_id).toBe('session_backend_001');
    expect(pkg.ams_browser_subject_identity.subject_id).toBe('browser_subject_abc');
    expect(pkg.backend_session_identity.session_id)
      .not.toBe(pkg.ams_browser_subject_identity.subject_id);
    expect(pkg.identity_limitation).toContain('not_an_exact_session_identity');
    expect(pkg.limitations[0]).toContain('not_an_exact_session_identity');
  });

  it('retains session_level_isolation=false everywhere it is recorded', () => {
    const pkg = buildFixturePackage();
    expect(pkg.session_level_isolation).toBe(false);
    expect(pkg.ams_browser_subject_identity.session_level_isolation).toBe(false);
    expect(pkg.ams_authoritative.scope.session_level_isolation).toBe(false);
  });
});

describe('deterministic evidence mapping', () => {
  it('maps persisted rows to EvidenceAtom[] deterministically (byte-equivalent)', () => {
    const a = mapSessionRowsToEvidenceAtoms(IDENTITY, fullRows());
    const b = mapSessionRowsToEvidenceAtoms(IDENTITY, fullRows());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBe(7);
  });

  it('derives stable atom ids from originating persisted row identity', () => {
    const atoms = mapSessionRowsToEvidenceAtoms(IDENTITY, fullRows());
    const ids = atoms.map((a) => a.atom_id);
    expect(ids).toContain('atom_accepted_events_101_103');
    expect(ids).toContain('atom_session_features_41');
    expect(ids).toContain('atom_behavioural_features_7');
    expect(ids).toContain('atom_stage0_3f0e8a3c-0000-4000-8000-000000000001');
    expect(ids).toContain('atom_risk_observation_3f0e8a3c-0000-4000-8000-000000000002');
    expect(ids).toContain('atom_poi_observation_5001');
    expect(ids).toContain('atom_poi_sequence_6001');
  });

  it('creates genuine traceable references to the originating persisted rows', () => {
    const atoms = mapSessionRowsToEvidenceAtoms(IDENTITY, fullRows());
    const refs = new Map(atoms.map((a) => [a.atom_id, a.source_ref]));
    expect(refs.get('atom_session_features_41')).toBe('session_features:session_features_id:41');
    expect(refs.get('atom_poi_observation_5001')).toBe('poi_observations_v0_1:poi_observation_id:5001');
    expect(refs.get('atom_accepted_events_101_103')).toBe('accepted_events:event_id:101-103');
    for (const ref of refs.values()) expect(ref).toMatch(/^[a-z0-9_]+:[a-z0-9_]+:/);
  });

  it('orders atoms chronologically with a total deterministic tie-break', () => {
    const atoms = mapSessionRowsToEvidenceAtoms(IDENTITY, fullRows());
    const sortKeys = atoms.map((a) => `${a.observed_at}|${a.atom_id}`);
    expect(sortKeys).toEqual([...sortKeys].sort());
  });

  it('does not require any numeric lane/buyer score and never reads lane tables', () => {
    const pkg = buildFixturePackage();
    const serialized = serializeGoldenSessionPackage(pkg);
    expect(serialized).not.toContain('scoring_output_lane');
    for (const atom of pkg.evidence_atoms) {
      expect(['accepted_event_aggregate', 'session_features', 'behavioural_features',
        'stage0_decision', 'risk_observation', 'poi_observation', 'poi_sequence_observation'])
        .toContain(atom.category);
    }
  });
});

describe('missing backend stages', () => {
  it('produces the exact safe stage labels for missing stages', () => {
    const rows = fullRows();
    rows.risk_observations = [];
    const presence = summarizeStagePresence(rows);
    const riskEntry = presence.find((p) => p.stage === 'risk_observations');
    expect(riskEntry?.present).toBe(false);
    expect(riskEntry?.missing_label).toBe('risk_observation_stage_missing');

    const allMissing = summarizeStagePresence(emptyRows());
    expect(allMissing.map((p) => p.missing_label)).toEqual([
      'accepted_event_stage_missing',
      'session_feature_stage_missing',
      'behavioural_feature_stage_missing',
      'stage0_stage_missing',
      'risk_observation_stage_missing',
      'poi_observation_stage_missing',
      'poi_sequence_observation_stage_missing',
    ]);
    expect(Object.values(GOLDEN_SESSION_STAGE_MISSING_LABELS)).toHaveLength(7);
  });

  it('records missing stages as limitations in the package', () => {
    const rows = fullRows();
    rows.session_features = null;
    const pkg = buildGoldenSessionPackage({ backend_identity: IDENTITY, ams: validatedAms(), rows });
    expect(pkg.limitations).toContain('session_feature_stage_missing');
  });
});

describe('reuse of existing report surface', () => {
  it('builds the session evidence card through the existing builder', () => {
    const pkg = buildFixturePackage();
    expect(pkg.session_evidence_card?.card_id).toBe('session_card_session_backend_001');
    expect(pkg.session_evidence_card?.schema_version).toBe('0.1.0');
    expect(pkg.session_evidence_card?.evidence_atom_ids)
      .toEqual(pkg.evidence_atoms.map((a) => a.atom_id));
  });

  it('represents a zero-evidence session as a typed null card, never a fabricated one', () => {
    const pkg = buildFixturePackage(emptyRows());
    expect(pkg.session_evidence_card).toBeNull();
    expect(pkg.report_snapshot.session_evidence_cards).toHaveLength(0);
    expect(pkg.limitations).toContain('accepted_event_stage_missing');
  });

  it('builds the report snapshot through the existing builder with flags off', () => {
    const pkg = buildFixturePackage();
    expect(pkg.report_snapshot.schema_version).toBe('0.1.0');
    expect(pkg.report_snapshot.session_evidence_cards).toHaveLength(1);
    expect(pkg.report_snapshot.flags_snapshot).toEqual({
      show_evidence_grade: false,
      show_recommendations: false,
      show_account_inference: false,
      auto_send_reports: false,
    });
  });

  it('reuses the existing markdown renderer output verbatim inside the artifact', () => {
    const pkg = buildFixturePackage();
    const markdown = renderGoldenSessionMarkdown(pkg);
    expect(markdown).toContain('# BuyerRecon Evidence Review');
    expect(markdown).toContain('## Governance boundary');
  });

  it('keeps external delivery disabled (internal-only artifact)', () => {
    const pkg = buildFixturePackage();
    expect(pkg.internal_only).toBe(true);
    expect(pkg.report_snapshot.flags_snapshot.auto_send_reports).toBe(false);
    const serialized = serializeGoldenSessionPackage(pkg);
    expect(serialized).not.toContain('delivered_at');
    expect(serialized).not.toContain('recipient_category');
  });
});

describe('artifact determinism and completeness', () => {
  it('serializes identical input to identical JSON output', () => {
    expect(serializeGoldenSessionPackage(buildFixturePackage()))
      .toBe(serializeGoldenSessionPackage(buildFixturePackage()));
    const pkg = buildFixturePackage();
    expect(pkg.golden_session_artifact_version).toBe(GOLDEN_PACKAGE_ARTIFACT_VERSION);
  });

  it('renders identical markdown for identical input, including every required dimension', () => {
    const first = renderGoldenSessionMarkdown(buildFixturePackage());
    const second = renderGoldenSessionMarkdown(buildFixturePackage());
    expect(first).toBe(second);
    for (const required of [
      'Buyer motion: present',
      'Fit: score 71',
      'Intent: score 55',
      'Window / Timing: score 47',
      'TRQ: score 60',
      'Risk: index 12',
      'PoI: score 61',
      'Trust / confidence: band building',
      'Policy Pass 1: trust invocation CONTINUE',
      'Policy Pass 2 final decision (authoritative): ALLOW_WITH_FRICTION',
      'Recommended operator action: review_session_evidence_and_friction_outcome',
      '## Limitations',
      'session_level_isolation=false',
    ]) {
      expect(first).toContain(required);
    }
    expect(first).not.toMatch(/confirmed buyer|guaranteed intent|ready to buy|high intent/i);
  });
});

describe('injected read-only database dependency', () => {
  it('reads exactly one session through the injected client with SELECT-only, scoped queries', async () => {
    const executed: Array<{ text: string; values: ReadonlyArray<string> }> = [];
    const fake: GoldenSessionDbClient = {
      query: (text, values) => {
        executed.push({ text, values });
        if (text.includes('FROM accepted_events')) {
          return Promise.resolve({
            rows: [{
              source_event_count: 9,
              first_event_id: '101',
              last_event_id: '103',
              first_received_at: new Date('2026-07-20T10:00:00.000Z'),
              last_received_at: new Date('2026-07-20T10:20:00.000Z'),
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      },
    };

    const rows = await readSessionPersistedRows(fake, IDENTITY);
    expect(rows.accepted_events_aggregate?.source_event_count).toBe(9);
    expect(rows.accepted_events_aggregate?.first_received_at).toBe('2026-07-20T10:00:00.000Z');
    expect(rows.session_features).toBeNull();
    expect(executed).toHaveLength(7);
    for (const q of executed) {
      expect(q.text.trimStart().startsWith('SELECT')).toBe(true);
      expect(q.text).not.toMatch(/INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER/i);
      expect(q.text).not.toContain('scoring_output_lane');
      expect(q.values).toContain(IDENTITY.session_id);
    }
  });
});
