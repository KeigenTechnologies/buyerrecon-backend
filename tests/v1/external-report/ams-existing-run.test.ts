import { describe, expect, it } from 'vitest';

import {
  AMS_EXISTING_RUN_FLAGS,
  AMS_EXISTING_RUN_OPTIONAL_FLAGS,
  AMS_EXISTING_RUN_REQUIRED_FLAGS,
  AMS_FINAL_DECISIONS,
  AMS_FRESH_RUN_FLAGS,
  CRYPTOGRAPHIC_LINKAGE,
  CROSS_SOURCE_LINKAGE,
  EMBEDDED_RUN_LINKAGE,
  GOLDEN_JSON_EMBEDDED_RUN_ID,
  GOLDEN_SESSION_CANONICAL_SOURCE_EVENT_IDS,
  PERSISTED_RUN_AUTHORITY,
  buildExistingRunReportMetadata,
  persistedFinalDecision,
  readPersistedAmsRunRows,
  detectRunLinkageAmbiguity,
  reconcilePersistedAmsRun,
  reconcileSourceEventProvenance,
  renderExistingRunReportMetadata,
  resolveAmsInputMode,
  resolveGoldenJsonFinalDecision,
  validateSourceEventIdSequence,
  type AmsRunVerificationFlags,
  type PersistedAmsRunExpectation,
  type PersistedAmsRunRows,
} from '../../../src/reports/external/ams-existing-run.js';
import type { GoldenSessionDbClient } from '../../../src/reports/external/session-evidence-atoms.js';

// ---------------------------------------------------------------------------
// Fixtures. No AMS binary is referenced, no child process is spawned and no
// real database is used anywhere in this suite.

const RUN_ID = '9005b50c-e37e-4e78-81c0-a3ec94f4f9f9';
const SUBJECT = 'brw_dnrzh1ta';
const SITE = 'buyerrecon_com';
const GOLDEN = '/abs/path/buyerrecon_com_2026-07-24_2026-07-24_golden.json';
const EVENT_IDS = [51, 52, 53, 54, 55, 56, 57, 58, 59];

function flags(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

const existingFlags = (over: Record<string, string> = {}): Map<string, string> =>
  flags({
    '--ams-golden-json': GOLDEN,
    '--ams-run-id': RUN_ID,
    '--ams-final-decision': 'HOLD',
    ...over,
  });

function rows(over: {
  runs?: Array<Record<string, unknown>>;
  cards?: Array<Record<string, unknown>>;
} = {}): PersistedAmsRunRows {
  return {
    runs: over.runs ?? [{ run_id: RUN_ID, site_id: SITE }],
    cards:
      over.cards ?? [
        {
          run_id: RUN_ID,
          subject_id: SUBJECT,
          status: 'DEGRADED',
          source_event_ids: [...EVENT_IDS],
          evidence_card: { RequestedAction: 'suppress' },
        },
      ],
  };
}

function expectation(over: Partial<PersistedAmsRunExpectation> = {}): PersistedAmsRunExpectation {
  return {
    ams_run_id: RUN_ID,
    site_id: SITE,
    subject_id: SUBJECT,
    source_event_ids: [...EVENT_IDS],
    artifact_final_decision: 'HOLD',
    expected_final_decision: 'HOLD',
    artifact_requested_action: 'suppress',
    // The canonical golden JSON carries no run id at all (see the schema-fact
    // assertions below), so the artifact-side run id is absent by default.
    artifact_run_id: undefined,
    // Independent third provenance source: canonical accepted-event ids for the
    // exact workspace/site/session. Agreement of the artifact and the card is
    // not sufficient on its own.
    accepted_event_ids: [...EVENT_IDS],
    run_candidates: [],
    ...over,
  };
}

/** The verification shape every successful reconciliation must report. */
const VERIFIED_FLAGS = {
  persisted_provenance_verified: true,
  golden_json_decision_verified: true,
  persisted_final_decision_verified: false,
  persisted_final_decision_unavailable_by_schema: true,
  decision_authority: 'golden_json',
  operator_decision_expectation_supplied: true,
  operator_decision_expectation_matched: true,
  cross_source_consistency_linkage_verified: true,
  observationally_equivalent_run_candidate_count: 0,
  run_linkage_ambiguity_detected: false,
} as const;

// ---------------------------------------------------------------------------
// Mode resolution

describe('resolveAmsInputMode — existing-run selection and the no-AMS boundary', () => {
  it('resolves existing-run mode with all three flags', () => {
    const r = resolveAmsInputMode(existingFlags());
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.input.mode).toBe('existing_run');
  });

  it('existing-run mode carries NO ams binary or ams db url (structural no-AMS guarantee)', () => {
    const r = resolveAmsInputMode(existingFlags());
    expect(r.ok).toBe(true);
    if (r.ok === false || r.input.mode !== 'existing_run') throw new Error('expected existing_run');
    // The resolved value has no field an execFile of AMS could consume.
    expect(Object.prototype.hasOwnProperty.call(r.input, 'ams_bin')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(r.input, 'ams_db_url')).toBe(false);
    expect(Object.keys(r.input).sort()).toEqual([
      'ams_golden_json_path',
      'ams_run_id',
      'expected_final_decision',
      'mode',
    ]);
  });

  it('accepts the approved two-flag contract with no --ams-final-decision', () => {
    // The authorized existing-run invocation: golden json + run id, nothing else.
    const r = resolveAmsInputMode(
      flags({ '--ams-golden-json': GOLDEN, '--ams-run-id': RUN_ID }),
    );
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.input.mode).toBe('existing_run');
    if (r.input.mode !== 'existing_run') return;
    expect(r.input.ams_golden_json_path).toBe(GOLDEN);
    expect(r.input.ams_run_id).toBe(RUN_ID);
    // No expectation declared — and no decision invented to stand in for one.
    expect(r.input.expected_final_decision).toBeUndefined();
  });

  it.each(AMS_EXISTING_RUN_REQUIRED_FLAGS)(
    'requires the two contract flags together (missing %s)',
    (missing) => {
      const supplied = existingFlags();
      supplied.delete(missing);
      const r = resolveAmsInputMode(supplied);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.reason).toBe('ams_existing_run_flags_required_together');
    },
  );

  it('does not require the optional decision expectation', () => {
    expect(AMS_EXISTING_RUN_REQUIRED_FLAGS).not.toContain('--ams-final-decision');
    expect(AMS_EXISTING_RUN_OPTIONAL_FLAGS).toContain('--ams-final-decision');
    // Still recognised as an existing-run flag, so it is parsed, not rejected.
    expect(AMS_EXISTING_RUN_FLAGS).toContain('--ams-final-decision');
    const supplied = existingFlags();
    supplied.delete('--ams-final-decision');
    expect(resolveAmsInputMode(supplied).ok).toBe(true);
  });

  it('selects existing-run mode from the optional flag alone, then fails closed on the missing pair', () => {
    const r = resolveAmsInputMode(flags({ '--ams-final-decision': 'HOLD' }));
    expect(r).toEqual({ ok: false, reason: 'ams_existing_run_flags_required_together' });
  });

  it('rejects a relative golden-json path', () => {
    const r = resolveAmsInputMode(existingFlags({ '--ams-golden-json': 'relative/golden.json' }));
    expect(r).toEqual({ ok: false, reason: 'ams_golden_json_must_be_absolute' });
  });

  it('rejects a malformed run id', () => {
    const r = resolveAmsInputMode(existingFlags({ '--ams-run-id': 'not-a-uuid' }));
    expect(r).toEqual({ ok: false, reason: 'ams_run_id_invalid' });
  });

  it('rejects a final decision outside the canonical domain', () => {
    const r = resolveAmsInputMode(existingFlags({ '--ams-final-decision': 'MAYBE' }));
    expect(r).toEqual({ ok: false, reason: 'ams_final_decision_invalid' });
  });

  it.each(AMS_FINAL_DECISIONS)('accepts canonical decision %s', (decision) => {
    const r = resolveAmsInputMode(existingFlags({ '--ams-final-decision': decision }));
    expect(r.ok).toBe(true);
  });

  it.each(AMS_FRESH_RUN_FLAGS)('rejects ambiguous existing-run + fresh flag %s', (freshFlag) => {
    const supplied = existingFlags({
      [freshFlag]: freshFlag === '--ams-bin' ? '/abs/buyerrecon-report' : 'postgresql://h/db',
    });
    const r = resolveAmsInputMode(supplied);
    expect(r).toEqual({ ok: false, reason: 'ams_mode_ambiguous_existing_run_and_fresh_ams' });
  });
});

describe('resolveAmsInputMode — fresh-AMS mode is preserved unchanged', () => {
  it('resolves fresh mode from absolute bin + postgres url', () => {
    const r = resolveAmsInputMode(
      flags({ '--ams-bin': '/abs/buyerrecon-report', '--ams-db-url': 'postgresql://host/db' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.input).toEqual({
      mode: 'fresh_ams',
      ams_bin: '/abs/buyerrecon-report',
      ams_db_url: 'postgresql://host/db',
    });
  });

  it('still requires an absolute --ams-bin', () => {
    const r = resolveAmsInputMode(
      flags({ '--ams-bin': 'relative/bin', '--ams-db-url': 'postgres://host/db' }),
    );
    expect(r).toEqual({ ok: false, reason: 'ams_bin_must_be_absolute' });
  });

  it('still requires a postgres --ams-db-url', () => {
    const r = resolveAmsInputMode(
      flags({ '--ams-bin': '/abs/bin', '--ams-db-url': 'mysql://host/db' }),
    );
    expect(r).toEqual({ ok: false, reason: 'ams_db_url' });
  });

  it('fails closed when neither mode is selected', () => {
    expect(resolveAmsInputMode(flags({}))).toEqual({ ok: false, reason: 'ams_bin_must_be_absolute' });
  });
});

// ---------------------------------------------------------------------------
// Persisted-run reconciliation

describe('reconcilePersistedAmsRun', () => {
  it('accepts an exactly matching run, subject and ordered source-event set', () => {
    const r = reconcilePersistedAmsRun(rows(), expectation());
    expect(r).toEqual({ ok: true, source_event_count: 9, verification: VERIFIED_FLAGS });
  });

  it('fails closed when the persisted run is missing', () => {
    const r = reconcilePersistedAmsRun(rows({ runs: [] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_run_missing');
  });

  it('fails closed on a duplicate persisted run', () => {
    const dup = [
      { run_id: RUN_ID, site_id: SITE },
      { run_id: RUN_ID, site_id: SITE },
    ];
    const r = reconcilePersistedAmsRun(rows({ runs: dup }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_run_duplicate');
  });

  it('fails closed when the evidence card is missing', () => {
    const r = reconcilePersistedAmsRun(rows({ cards: [] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_evidence_card_missing');
  });

  it('fails closed on a duplicate evidence card', () => {
    const one = rows().cards[0] as Record<string, unknown>;
    const r = reconcilePersistedAmsRun(rows({ cards: [one, { ...one }] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_evidence_card_duplicate');
  });

  it('fails closed on a mismatched run id', () => {
    const r = reconcilePersistedAmsRun(
      rows({ runs: [{ run_id: '11111111-2222-3333-4444-555555555555', site_id: SITE }] }),
      expectation(),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_run_id_mismatch');
  });

  it('fails closed on a mismatched subject/browser identity', () => {
    const card = { ...(rows().cards[0] as Record<string, unknown>), subject_id: 'brw_sv8qm3v2' };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_card_subject_mismatch');
  });

  it('fails closed on a mismatched source-event count', () => {
    const card = { ...(rows().cards[0] as Record<string, unknown>), source_event_ids: [51, 52, 53] };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_and_persisted_card_source_event_ids_differ');
  });

  it('fails closed on the same set in a different order (canonical order enforced)', () => {
    const scrambled = [52, 51, 53, 54, 55, 56, 57, 58, 59];
    const card = { ...(rows().cards[0] as Record<string, unknown>), source_event_ids: scrambled };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_and_persisted_card_source_event_ids_differ');
  });

  it('fails closed on a different event id entirely', () => {
    const other = [51, 52, 53, 54, 55, 56, 57, 58, 60];
    const card = { ...(rows().cards[0] as Record<string, unknown>), source_event_ids: other };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_and_persisted_card_source_event_ids_differ');
  });

  it('Golden JSON final-decision mismatch fails closed', () => {
    // The golden JSON is the ONLY carrier of the policy final decision, so this
    // is an artifact-versus-declaration check, not a database check.
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'ALLOW', expected_final_decision: 'HOLD' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_mismatch');
    // Not misreported as a persisted-decision disagreement.
    expect(r.reasons.some((x) => /persisted_final_decision/.test(x))).toBe(false);
  });

  it('fails closed when the persisted product proposal contradicts the artifact', () => {
    // A staleness check on RequestedAction, which IS persisted. Its own reason
    // code, never conflated with the final-decision reason code.
    const r = reconcilePersistedAmsRun(rows(), expectation({ artifact_requested_action: 'escalate' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_requested_action_mismatch');
    expect(r.reasons).not.toContain('golden_json_final_decision_mismatch');
  });

  it('tolerates numeric source ids arriving as strings from the driver', () => {
    const card = {
      ...(rows().cards[0] as Record<string, unknown>),
      source_event_ids: EVENT_IDS.map(String),
    };
    expect(reconcilePersistedAmsRun(rows({ cards: [card] }), expectation())).toEqual({
      ok: true,
      source_event_count: 9,
      verification: VERIFIED_FLAGS,
    });
  });

  it('Golden JSON run ID mismatch fails closed', () => {
    // The canonical artifact carries no run id, so today this path is dormant.
    // If an artifact ever asserts one that disagrees with the declared and
    // persisted run id, reconciliation must fail rather than pick a winner.
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_run_id: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_run_id_mismatch');
  });

  it('Golden JSON and replay-row overlapping identity mismatch fails closed', () => {
    // Every field that BOTH the golden JSON and the replay rows carry must
    // agree. Each overlapping field is perturbed independently.
    const cases: ReadonlyArray<{
      field: string;
      rows: PersistedAmsRunRows;
      expect: PersistedAmsRunExpectation;
      reason: string;
    }> = [
      {
        field: 'run_id',
        rows: rows({ runs: [{ run_id: '11111111-1111-4111-8111-111111111111', site_id: SITE }] }),
        expect: expectation(),
        reason: 'persisted_run_id_mismatch',
      },
      {
        field: 'site_id',
        rows: rows({ runs: [{ run_id: RUN_ID, site_id: 'other_site' }] }),
        expect: expectation(),
        reason: 'persisted_run_site_mismatch',
      },
      {
        field: 'subject_id',
        rows: rows(),
        expect: expectation({ subject_id: 'brw_someone_else' }),
        reason: 'persisted_card_subject_mismatch',
      },
      {
        field: 'source_event_ids',
        rows: rows(),
        expect: expectation({ source_event_ids: [51, 52, 53, 54, 55, 56, 57, 58, 60] }),
        reason: 'golden_json_and_persisted_card_source_event_ids_differ',
      },
      {
        field: 'source_event_count',
        rows: rows(),
        expect: expectation({ source_event_ids: EVENT_IDS.slice(0, 8) }),
        reason: 'golden_json_and_persisted_card_source_event_ids_differ',
      },
      {
        field: 'card_to_run_linkage',
        rows: rows({
          cards: [
            {
              run_id: '22222222-2222-4222-8222-222222222222',
              subject_id: SUBJECT,
              status: 'DEGRADED',
              source_event_ids: [...EVENT_IDS],
              evidence_card: { RequestedAction: 'suppress' },
            },
          ],
        }),
        expect: expectation(),
        reason: 'persisted_card_run_id_mismatch',
      },
    ];

    for (const c of cases) {
      const r = reconcilePersistedAmsRun(c.rows, c.expect);
      expect(r.ok, `overlapping field must fail closed: ${c.field}`).toBe(false);
      if (r.ok) continue;
      expect(r.reasons, `reason for ${c.field}`).toContain(c.reason);
    }
  });

  it('RequestedAction is never treated as final decision', () => {
    // 1. Persistence is asked for a decision and answers "none", regardless of
    //    the product proposal sitting in the very rows it was handed.
    expect(persistedFinalDecision(rows())).toBeNull();

    // 2. A persisted product proposal that happens to equal a canonical
    //    decision token still does not become a decision.
    const decisionShapedCard = {
      run_id: RUN_ID,
      subject_id: SUBJECT,
      status: 'DEGRADED',
      source_event_ids: [...EVENT_IDS],
      evidence_card: { RequestedAction: 'HOLD' },
    };
    expect(persistedFinalDecision(rows({ cards: [decisionShapedCard] }))).toBeNull();

    // 3. The declared decision must still be justified by the ARTIFACT. With a
    //    persisted RequestedAction of 'HOLD' and an artifact saying ALLOW, the
    //    declaration of HOLD must NOT be validated by the persisted action.
    const r = reconcilePersistedAmsRun(
      rows({ cards: [decisionShapedCard] }),
      expectation({
        artifact_final_decision: 'ALLOW',
        expected_final_decision: 'HOLD',
        artifact_requested_action: 'HOLD',
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_mismatch');

    // 4. RequestedAction is registered as a non-decision field, and no
    //    decision column is claimed to exist.
    expect(PERSISTED_RUN_AUTHORITY.non_decision_fields).toContain(
      'replay_evidence_cards.evidence_card.RequestedAction',
    );
    expect(PERSISTED_RUN_AUTHORITY.persisted_final_decision_column).toBeNull();
    expect(PERSISTED_RUN_AUTHORITY.provenance_fields).not.toContain(
      'replay_evidence_cards.evidence_card.RequestedAction',
    );
  });

  it("RequestedAction='suppress' cannot cause, imply or validate final_decision='HOLD'", () => {
    // The real Golden Session shape: persisted RequestedAction is 'suppress'
    // and the artifact decision is 'HOLD'. These must remain independent.
    const persistedSuppress = rows();
    expect(
      (persistedSuppress.cards[0] as { evidence_card: { RequestedAction: string } }).evidence_card
        .RequestedAction,
    ).toBe('suppress');

    // CANNOT CAUSE: 'suppress' is not, and does not map to, a decision.
    expect(persistedFinalDecision(persistedSuppress)).toBeNull();
    expect((AMS_FINAL_DECISIONS as readonly string[]).includes('suppress')).toBe(false);

    // CANNOT VALIDATE: with the artifact reporting ALLOW, a declared HOLD fails
    // closed even though 'suppress' is persisted and is friction-shaped.
    const contradicted = reconcilePersistedAmsRun(
      persistedSuppress,
      expectation({ artifact_final_decision: 'ALLOW', expected_final_decision: 'HOLD' }),
    );
    expect(contradicted.ok).toBe(false);
    if (contradicted.ok === false) {
      expect(contradicted.reasons).toContain('golden_json_final_decision_mismatch');
    }

    // CANNOT IMPLY: when everything genuinely agrees, the success report still
    // refuses to claim the decision was verified against persistence.
    const agreed = reconcilePersistedAmsRun(persistedSuppress, expectation());
    expect(agreed.ok).toBe(true);
    if (agreed.ok === false) return;
    expect(agreed.verification.persisted_final_decision_verified).toBe(false);
    expect(agreed.verification.persisted_final_decision_unavailable_by_schema).toBe(true);
    expect(agreed.verification.golden_json_decision_verified).toBe(true);
    // No 'HOLD' is echoed as a persisted value anywhere in the result.
    expect(JSON.stringify(agreed)).not.toContain('HOLD');
  });

  it('absence of a persisted final-decision column does not weaken source-event reconciliation', () => {
    // Provenance is computed from row identity and source events only, so it
    // must still fail closed no matter what the decision fields say.
    const ids = [51, 52, 53, 54, 55, 56, 57, 58, 60];

    // (a) Decision fields in perfect agreement: provenance still fails.
    const agreeingDecision = reconcilePersistedAmsRun(rows(), expectation({ source_event_ids: ids }));
    expect(agreeingDecision.ok).toBe(false);
    if (agreeingDecision.ok === false) {
      expect(agreeingDecision.reasons).toContain('golden_json_and_persisted_card_source_event_ids_differ');
      expect(agreeingDecision.reasons).not.toContain('golden_json_final_decision_mismatch');
    }

    // (b) Decision fields absent entirely from the persisted card: provenance
    //     checks are unaffected — one failing, one passing.
    const noDecisionCard = {
      run_id: RUN_ID,
      subject_id: SUBJECT,
      status: 'DEGRADED',
      source_event_ids: [...EVENT_IDS],
      evidence_card: {},
    };
    const bad = reconcilePersistedAmsRun(
      rows({ cards: [noDecisionCard] }),
      expectation({ source_event_ids: ids }),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok === false) expect(bad.reasons).toContain('golden_json_and_persisted_card_source_event_ids_differ');

    const good = reconcilePersistedAmsRun(rows({ cards: [noDecisionCard] }), expectation());
    expect(good.ok).toBe(true);
    if (good.ok === false) return;
    expect(good.source_event_count).toBe(9);
    expect(good.verification.persisted_provenance_verified).toBe(true);
    expect(good.verification.persisted_final_decision_verified).toBe(false);
  });

  it('reports provenance and golden-JSON decision verification as separate facts', () => {
    const r = reconcilePersistedAmsRun(rows(), expectation());
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.verification).toEqual(VERIFIED_FLAGS);
  });
});

// ---------------------------------------------------------------------------
// Golden JSON is the sole decision authority

describe('Golden JSON final-decision authority', () => {
  it('reads the actual decision from the validated Golden JSON', () => {
    for (const decision of AMS_FINAL_DECISIONS) {
      expect(resolveGoldenJsonFinalDecision(decision)).toEqual({ ok: true, final_decision: decision });
    }
  });

  it('fails closed when the Golden JSON final decision is missing', () => {
    for (const absent of [undefined, null, '', 0, false, {}, []]) {
      expect(resolveGoldenJsonFinalDecision(absent)).toEqual({
        ok: false,
        reason: 'golden_json_final_decision_missing',
      });
    }
    // ...and reconciliation refuses the run rather than packaging it.
    const r = reconcilePersistedAmsRun(rows(), expectation({ artifact_final_decision: '' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_missing');
  });

  it('fails closed when the Golden JSON final decision is invalid', () => {
    expect(resolveGoldenJsonFinalDecision('MAYBE')).toEqual({
      ok: false,
      reason: 'golden_json_final_decision_invalid',
    });
    // A product action is not a decision, so it is invalid here too.
    expect(resolveGoldenJsonFinalDecision('suppress')).toEqual({
      ok: false,
      reason: 'golden_json_final_decision_invalid',
    });
    const r = reconcilePersistedAmsRun(rows(), expectation({ artifact_final_decision: 'MAYBE' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_invalid');
  });

  it('accepts a matching optional operator expectation', () => {
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'HOLD', expected_final_decision: 'HOLD' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.verification.operator_decision_expectation_supplied).toBe(true);
    expect(r.verification.operator_decision_expectation_matched).toBe(true);
    expect(r.verification.decision_authority).toBe('golden_json');
  });

  it('succeeds with no operator expectation at all, reporting it as not_applicable', () => {
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'HOLD', expected_final_decision: undefined }),
    );
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.verification.golden_json_decision_verified).toBe(true);
    expect(r.verification.operator_decision_expectation_supplied).toBe(false);
    expect(r.verification.operator_decision_expectation_matched).toBe('not_applicable');
    expect(r.verification.decision_authority).toBe('golden_json');
  });

  it('fails closed on a mismatching optional operator expectation, before any package is built', () => {
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'HOLD', expected_final_decision: 'ALLOW' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_mismatch');
  });

  it('operator expectation cannot override the Golden JSON', () => {
    // Artifact says HOLD, operator insists ALLOW: the run is refused. There is
    // no outcome in which the operator value is adopted as the decision.
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'HOLD', expected_final_decision: 'ALLOW' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_final_decision_mismatch');
    // The resolver is not even reachable with an operator value: its only input
    // is the artifact, so it cannot return the operator's ALLOW.
    expect(resolveGoldenJsonFinalDecision('HOLD')).toEqual({ ok: true, final_decision: 'HOLD' });
    expect(resolveGoldenJsonFinalDecision.length).toBe(1);
  });

  it('operator expectation cannot create a decision when the Golden JSON lacks one', () => {
    for (const artifact of ['', 'MAYBE']) {
      const r = reconcilePersistedAmsRun(
        rows(),
        expectation({ artifact_final_decision: artifact, expected_final_decision: 'HOLD' }),
      );
      expect(r.ok, `artifact decision ${JSON.stringify(artifact)} must not be repaired`).toBe(false);
      if (r.ok) continue;
      // The failure names the artifact, never the operator expectation, and the
      // supplied HOLD does not turn the run into a success.
      expect(r.reasons.some((x) => x.startsWith('golden_json_final_decision_'))).toBe(true);
      expect(r.reasons).not.toContain('golden_json_final_decision_mismatch');
    }
  });

  it("RequestedAction='suppress' cannot satisfy or influence final-decision validation", () => {
    // Persisted and artifact product action is 'suppress' throughout.
    const base = expectation({ artifact_requested_action: 'suppress' });

    // It cannot stand in for a missing decision.
    const missing = reconcilePersistedAmsRun(rows(), { ...base, artifact_final_decision: '' });
    expect(missing.ok).toBe(false);
    if (missing.ok === false) {
      expect(missing.reasons).toContain('golden_json_final_decision_missing');
    }

    // It cannot make a contradicted expectation pass.
    const contradicted = reconcilePersistedAmsRun(rows(), {
      ...base,
      artifact_final_decision: 'ALLOW',
      expected_final_decision: 'HOLD',
    });
    expect(contradicted.ok).toBe(false);

    // And with a valid decision it changes nothing about decision reporting.
    const fine = reconcilePersistedAmsRun(rows(), base);
    expect(fine.ok).toBe(true);
    if (fine.ok === false) return;
    expect(fine.verification.decision_authority).toBe('golden_json');
    expect(fine.verification.golden_json_decision_verified).toBe(true);
    expect(persistedFinalDecision(rows())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Existing-run reporting metadata

describe('existing-run report metadata', () => {
  const verified: AmsRunVerificationFlags = {
    persisted_provenance_verified: true,
    golden_json_decision_verified: true,
    persisted_final_decision_verified: false,
    persisted_final_decision_unavailable_by_schema: true,
    decision_authority: 'golden_json',
    operator_decision_expectation_supplied: true,
    operator_decision_expectation_matched: true,
    cross_source_consistency_linkage_verified: true,
    observationally_equivalent_run_candidate_count: 0,
    run_linkage_ambiguity_detected: false,
  };
  const meta = buildExistingRunReportMetadata(RUN_ID, verified);

  it('emits golden_json_embedded_run_id as the boolean false', () => {
    expect(meta.golden_json_embedded_run_id).toBe(false);
    expect(typeof meta.golden_json_embedded_run_id).toBe('boolean');
  });

  it('emits literal linkage-boundary classifications from the metadata object', () => {
    expect(CRYPTOGRAPHIC_LINKAGE).toBe(false);
    expect(EMBEDDED_RUN_LINKAGE).toBe(false);
    expect(CROSS_SOURCE_LINKAGE).toBe('consistency_linkage');
    expect(meta.cryptographic_linkage).toBe(false);
    expect(meta.embedded_run_linkage).toBe(false);
    expect(meta.cross_source_linkage).toBe('consistency_linkage');
    expect(JSON.parse(JSON.stringify(meta))).toMatchObject({
      cryptographic_linkage: false,
      embedded_run_linkage: false,
      cross_source_linkage: 'consistency_linkage',
      golden_json_embedded_run_id: false,
      cross_source_consistency_linkage_verified: true,
    });
  });

  it('does not omit the key', () => {
    expect(Object.hasOwn(meta, 'golden_json_embedded_run_id')).toBe(true);
    expect('golden_json_embedded_run_id' in meta).toBe(true);
    expect(Object.keys(meta)).toContain('golden_json_embedded_run_id');
    // Present in the serialized form too, not just as an undefined own key.
    expect(JSON.stringify(meta)).toContain('"golden_json_embedded_run_id":false');
  });

  it('is not a string', () => {
    expect(typeof meta.golden_json_embedded_run_id).not.toBe('string');
    expect(meta.golden_json_embedded_run_id as unknown).not.toBe('false');
    expect(meta.golden_json_embedded_run_id as unknown).not.toBe('true');
    expect(JSON.stringify(meta)).not.toContain('"golden_json_embedded_run_id":"false"');
  });

  it('cannot be true for any input', () => {
    // The exported schema fact itself.
    expect(GOLDEN_JSON_EMBEDDED_RUN_ID).toBe(false);
    // Exhaustive over every reconciliation input the builder accepts, including
    // absent reconciliation: the value is never derived from runtime input.
    const inputs: ReadonlyArray<AmsRunVerificationFlags | undefined> = [
      undefined,
      { ...verified, persisted_provenance_verified: false },
      { ...verified, golden_json_decision_verified: false },
      { ...verified, persisted_provenance_verified: false, golden_json_decision_verified: false },
      verified,
    ];
    for (const input of inputs) {
      for (const runId of [RUN_ID, '', 'not-a-uuid']) {
        const built = buildExistingRunReportMetadata(runId, input);
        expect(built.golden_json_embedded_run_id).toBe(false);
        expect(built.cryptographic_linkage).toBe(false);
        expect(built.embedded_run_linkage).toBe(false);
        expect(built.cross_source_linkage).toBe('consistency_linkage');
        expect(built.persisted_final_decision_verified).toBe(false);
        expect(built.persisted_final_decision_unavailable_by_schema).toBe(true);
      }
    }
  });

  it('does not represent the supplied --ams-run-id as a Golden JSON-embedded field', () => {
    // The supplied run id appears exactly once, under a name that attributes it
    // to the operator/persistence side, never to the artifact.
    expect(meta.ams_run_id).toBe(RUN_ID);
    const goldenJsonKeys = Object.keys(meta).filter((k) => k.startsWith('golden_json')).sort();
    expect(goldenJsonKeys).toEqual(['golden_json_decision_verified', 'golden_json_embedded_run_id']);
    // No golden_json* field carries the run id as its value.
    for (const key of goldenJsonKeys) {
      expect(meta[key as keyof typeof meta]).not.toBe(RUN_ID);
      expect(typeof meta[key as keyof typeof meta]).toBe('boolean');
    }
    // And no field claims the artifact asserted or verified a run id.
    expect(Object.keys(meta)).not.toContain('golden_json_run_id');
    expect(Object.keys(meta)).not.toContain('golden_json_run_id_verified');
  });

  it('preserves the four existing truthful fields unchanged', () => {
    expect(meta.persisted_provenance_verified).toBe(true);
    expect(meta.golden_json_decision_verified).toBe(true);
    expect(meta.persisted_final_decision_verified).toBe(false);
    expect(meta.persisted_final_decision_unavailable_by_schema).toBe(true);
    // No persisted decision value is present anywhere in the metadata.
    expect(JSON.stringify(meta)).not.toContain('HOLD');
    expect(Object.keys(meta)).not.toContain('persisted_final_decision');
  });

  it('renders exactly the truthful key=value lines the entrypoint prints', () => {
    expect(renderExistingRunReportMetadata(meta)).toEqual([
      `  ams_run_id=${RUN_ID}`,
      '  persisted_provenance_verified=true',
      '  golden_json_decision_verified=true',
      '  persisted_final_decision_verified=false',
      '  persisted_final_decision_unavailable_by_schema=true',
      '  golden_json_embedded_run_id=false',
      '  cryptographic_linkage=false',
      '  embedded_run_linkage=false',
      '  cross_source_linkage=consistency_linkage',
      '  decision_authority=golden_json',
      '  operator_decision_expectation_supplied=true',
      '  operator_decision_expectation_matched=true',
      '  cross_source_consistency_linkage_verified=true',
      '  observationally_equivalent_run_candidate_count=0',
      '  run_linkage_ambiguity_detected=false',
      '  policy_pass_2_authority_verified=false',
      '  final_decision_authority=authoritative_ams_result',
    ]);
  });

  it('reports decision_authority=golden_json and never the operator', () => {
    expect(meta.decision_authority).toBe('golden_json');
    // Whatever the operator did or did not supply, the authority is unchanged.
    for (const v of [
      undefined,
      { ...verified, operator_decision_expectation_supplied: false, operator_decision_expectation_matched: 'not_applicable' as const },
      { ...verified, operator_decision_expectation_matched: false },
    ]) {
      expect(buildExistingRunReportMetadata(RUN_ID, v).decision_authority).toBe('golden_json');
    }
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain('operator_final_decision_verified');
    expect(serialized).not.toContain('requested_action_validated_hold');
    expect(serialized).not.toContain('"persisted_final_decision"');
    expect(serialized).not.toContain('HOLD');
  });

  it('distinguishes a supplied expectation from an absent one', () => {
    const withExpectation = buildExistingRunReportMetadata(RUN_ID, verified);
    expect(withExpectation.operator_decision_expectation_supplied).toBe(true);
    expect(withExpectation.operator_decision_expectation_matched).toBe(true);

    const without = buildExistingRunReportMetadata(RUN_ID, {
      ...verified,
      operator_decision_expectation_supplied: false,
      operator_decision_expectation_matched: 'not_applicable',
    });
    expect(without.operator_decision_expectation_supplied).toBe(false);
    expect(without.operator_decision_expectation_matched).toBe('not_applicable');
    // The Golden JSON decision is still verified without any operator input.
    expect(without.golden_json_decision_verified).toBe(true);
    expect(without.decision_authority).toBe('golden_json');
    expect(renderExistingRunReportMetadata(without)).toContain(
      '  operator_decision_expectation_matched=not_applicable',
    );
  });

  it('renders a failed provenance verification honestly rather than defaulting to true', () => {
    const lines = renderExistingRunReportMetadata(buildExistingRunReportMetadata(RUN_ID, undefined));
    expect(lines).toContain('  persisted_provenance_verified=false');
    expect(lines).toContain('  golden_json_decision_verified=false');
    // The schema facts are unaffected by a missing reconciliation.
    expect(lines).toContain('  golden_json_embedded_run_id=false');
    expect(lines).toContain('  cryptographic_linkage=false');
    expect(lines).toContain('  embedded_run_linkage=false');
    expect(lines).toContain('  cross_source_linkage=consistency_linkage');
    expect(lines).toContain('  cross_source_consistency_linkage_verified=false');
    expect(lines).toContain('  persisted_final_decision_unavailable_by_schema=true');
  });

  it('does not permit operator-controlled linkage classification', () => {
    const injectedVerification = {
      ...verified,
      cryptographic_linkage: true,
      embedded_run_linkage: true,
      cross_source_linkage: 'cryptographic',
    } as AmsRunVerificationFlags;

    for (const runId of [RUN_ID, 'operator-value', 'cryptographic', 'embedded']) {
      const built = buildExistingRunReportMetadata(runId, injectedVerification);
      expect(built.cryptographic_linkage).toBe(false);
      expect(built.embedded_run_linkage).toBe(false);
      expect(built.cross_source_linkage).toBe('consistency_linkage');
    }
  });
});

// ---------------------------------------------------------------------------
// Database access shape

describe('readPersistedAmsRunRows', () => {
  it('issues SELECT-only statements and performs no write', async () => {
    const seen: string[] = [];
    const db: GoldenSessionDbClient = {
      query: async (text, values) => {
        seen.push(text);
        expect(values).toEqual([RUN_ID]);
        return { rows: [] };
      },
    };
    await readPersistedAmsRunRows(db, RUN_ID);

    expect(seen).toHaveLength(2);
    for (const sql of seen) {
      expect(sql.trimStart().startsWith('SELECT')).toBe(true);
      expect(/\b(INSERT|UPDATE|DELETE|UPSERT|COPY|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(sql)).toBe(false);
    }
    expect(seen.some((s) => /FROM replay_runs/.test(s))).toBe(true);
    expect(seen.some((s) => /FROM replay_evidence_cards/.test(s))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BLOCK-1 — three-source source-event provenance
//
// Mutual agreement between the artifact and the replay card is NOT validity.
// Each source is independently validated, then all three must match exactly and
// in canonical order.

describe('three-source source-event provenance', () => {
  const CANONICAL = [51, 52, 53, 54, 55, 56, 57, 58, 59];

  it('accepts the exact canonical sequence 51..59 across all three sources', () => {
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANONICAL],
      card_source_event_ids: [...CANONICAL],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r).toEqual({ ok: true, ids: CANONICAL, count: 9 });
  });

  it('rejects eight mutually matching ids shared by Golden and card', () => {
    const eight = CANONICAL.slice(0, 8);
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...eight],
      card_source_event_ids: [...eight],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Agreement between the two did not rescue them: event truth disagrees.
    expect(r.reasons).toContain('golden_json_and_accepted_events_source_event_ids_differ');
    expect(r.reasons).toContain('persisted_card_and_accepted_events_source_event_ids_differ');
  });

  it('rejects a duplicate id shared by Golden and card', () => {
    const dup = [51, 51, 52, 53, 54, 55, 56, 57, 58];
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...dup],
      card_source_event_ids: [...dup],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Caught by independent validation, before any comparison.
    expect(r.reasons).toContain('golden_json_source_event_ids_contain_duplicates');
    expect(r.reasons).toContain('persisted_card_source_event_ids_contain_duplicates');
  });

  it('rejects the same reordered sequence shared by Golden and card', () => {
    const reordered = [52, 51, 53, 54, 55, 56, 57, 58, 59];
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...reordered],
      card_source_event_ids: [...reordered],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Set-equivalent but not order-equivalent: canonical order is contractual.
    expect(r.reasons).toContain('golden_json_and_accepted_events_source_event_ids_differ');
  });

  it('rejects a Golden count that disagrees with its own array', () => {
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANONICAL],
      golden_declared_count: 8,
      card_source_event_ids: [...CANONICAL],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_source_event_count_disagrees_with_own_array');
  });

  it('rejects a card count that disagrees with its own array', () => {
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANONICAL],
      card_source_event_ids: [...CANONICAL],
      card_declared_count: 10,
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_card_source_event_count_disagrees_with_own_array');
  });

  it('rejects Golden/card agreement that disagrees with accepted events', () => {
    const shifted = [61, 62, 63, 64, 65, 66, 67, 68, 69];
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: [...shifted],
      card_source_event_ids: [...shifted],
      accepted_event_ids: [...CANONICAL],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_and_accepted_events_source_event_ids_differ');
  });

  it.each([
    ['non-integer', [51.5, 52, 53]],
    ['unsafe integer', [Number.MAX_SAFE_INTEGER + 2, 52, 53]],
    ['zero', [0, 52, 53]],
    ['negative', [-51, 52, 53]],
    ['non-numeric string', ['fifty-one', 52, 53]],
    ['null entry', [null, 52, 53]],
    ['boolean entry', [true, 52, 53]],
  ])('rejects %s ids in every source', (_label, bad) => {
    for (const key of ['golden_source_event_ids', 'card_source_event_ids', 'accepted_event_ids'] as const) {
      const input = {
        golden_source_event_ids: [...CANONICAL],
        card_source_event_ids: [...CANONICAL],
        accepted_event_ids: [...CANONICAL],
        [key]: bad,
      };
      const r = reconcileSourceEventProvenance(input as never);
      expect(r.ok, `${_label} must be rejected in ${key}`).toBe(false);
    }
  });

  it('rejects a non-array source entirely', () => {
    for (const notArray of [undefined, null, 'x', 9, {}]) {
      const r = reconcileSourceEventProvenance({
        golden_source_event_ids: [...CANONICAL],
        card_source_event_ids: [...CANONICAL],
        accepted_event_ids: notArray,
      });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.reasons).toContain('accepted_events_source_event_ids_not_an_array');
    }
  });

  it('normalises driver-supplied numeric strings without loosening validation', () => {
    const ok = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANONICAL],
      card_source_event_ids: CANONICAL.map(String),
      accepted_event_ids: CANONICAL.map(String),
    });
    expect(ok).toEqual({ ok: true, ids: CANONICAL, count: 9 });
  });
});

describe('run-linkage ambiguity (no embedded run id)', () => {
  const CANONICAL = [51, 52, 53, 54, 55, 56, 57, 58, 59];
  const candidate = (runId: string, ids: number[] = CANONICAL) => ({
    run_id: runId, subject_id: SUBJECT, site_id: SITE, source_event_ids: [...ids],
  });

  it('accepts a unique candidate', () => {
    const a = detectRunLinkageAmbiguity([candidate(RUN_ID)], RUN_ID, CANONICAL);
    expect(a).toEqual({
      observationally_equivalent_run_candidate_count: 0,
      run_linkage_ambiguity_detected: false,
    });
  });

  it('detects another run indistinguishable on every overlapping field', () => {
    const other = '11111111-1111-4111-8111-111111111111';
    const a = detectRunLinkageAmbiguity([candidate(RUN_ID), candidate(other)], RUN_ID, CANONICAL);
    expect(a).toEqual({
      observationally_equivalent_run_candidate_count: 1,
      run_linkage_ambiguity_detected: true,
    });
  });

  it('does not count a candidate with a different source-event set', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    const a = detectRunLinkageAmbiguity(
      [candidate(RUN_ID), candidate(other, [61, 62, 63])], RUN_ID, CANONICAL,
    );
    expect(a.run_linkage_ambiguity_detected).toBe(false);
  });

  it('fails reconciliation closed when an equivalent candidate exists', () => {
    const other = '33333333-3333-4333-8333-333333333333';
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ run_candidates: [candidate(RUN_ID), candidate(other)] }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('observationally_equivalent_run_candidate_present');
  });

  it('reports linkage as cross-source consistency, never artifact-native', () => {
    const r = reconcilePersistedAmsRun(rows(), expectation());
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.verification.cross_source_consistency_linkage_verified).toBe(true);
    expect(r.verification.observationally_equivalent_run_candidate_count).toBe(0);
    expect(r.verification.run_linkage_ambiguity_detected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BLOCK-1 (review 085a7a1) — shared malformation across ALL THREE sources.
// Three-way equality is not validity: each source must already be canonical.

describe('shared malformation across all three provenance sources', () => {
  const CANON = [...GOLDEN_SESSION_CANONICAL_SOURCE_EVENT_IDS];
  const allThree = (ids: unknown) =>
    reconcileSourceEventProvenance({
      golden_source_event_ids: ids,
      card_source_event_ids: ids,
      accepted_event_ids: ids,
      canonical_sequence: CANON,
    });

  it('accepts only the exact canonical sequence 51..59', () => {
    expect(allThree([...CANON])).toEqual({ ok: true, ids: CANON, count: 9 });
  });

  it.each([
    ['eight ids', [51, 52, 53, 54, 55, 56, 57, 58]],
    ['ten ids', [51, 52, 53, 54, 55, 56, 57, 58, 59, 60]],
    ['a duplicate', [51, 51, 52, 53, 54, 55, 56, 57, 58]],
    ['the correct ids in the wrong order', [52, 51, 53, 54, 55, 56, 57, 58, 59]],
    ['a zero', [0, 52, 53, 54, 55, 56, 57, 58, 59]],
    ['a negative id', [-51, 52, 53, 54, 55, 56, 57, 58, 59]],
    ['a non-integer', [51.5, 52, 53, 54, 55, 56, 57, 58, 59]],
    ['an unsafe integer', [Number.MAX_SAFE_INTEGER + 2, 52, 53, 54, 55, 56, 57, 58, 59]],
  ])('fails closed when all three sources share %s', (_label, ids) => {
    const r = allThree(ids);
    expect(r.ok, `all three sharing ${_label} must fail`).toBe(false);
    if (r.ok) return;
    // The failure must name each source independently, not a cross-source diff:
    // agreement is exactly what made the old two-sided model accept these.
    expect(r.reasons.some((x) => x.startsWith('golden_json_'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('persisted_card_'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('accepted_events_'))).toBe(true);
  });

  it('never sorts a reordered sequence into passing', () => {
    const reordered = [59, 58, 57, 56, 55, 54, 53, 52, 51];
    const r = allThree(reordered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('golden_json_source_event_ids_not_canonical_sequence');
    expect(r.reasons).toContain('persisted_card_source_event_ids_not_canonical_sequence');
    expect(r.reasons).toContain('accepted_events_source_event_ids_not_canonical_sequence');
  });

  it('enforces exactly nine per source, independently', () => {
    for (const label of ['golden_json', 'persisted_card', 'accepted_events'] as const) {
      const v = validateSourceEventIdSequence(CANON.slice(0, 8), label, undefined, CANON);
      expect(v.ok).toBe(false);
      if (v.ok) continue;
      expect(v.reasons).toContain(`${label}_source_event_count_not_exactly_9`);
    }
  });

  it.each([
    ['only Golden malformed', { g: [51, 52], c: null, a: null }],
    ['only the replay card malformed', { g: null, c: [51, 52], a: null }],
    ['only accepted events malformed', { g: null, c: null, a: [51, 52] }],
  ])('still fails closed when %s', (_label, m) => {
    const r = reconcileSourceEventProvenance({
      golden_source_event_ids: m.g ?? [...CANON],
      card_source_event_ids: m.c ?? [...CANON],
      accepted_event_ids: m.a ?? [...CANON],
      canonical_sequence: CANON,
    });
    expect(r.ok).toBe(false);
  });

  it('fails closed on a wrong self-declared count and on cross-source mismatch', () => {
    const badCount = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANON],
      golden_declared_count: 8,
      card_source_event_ids: [...CANON],
      accepted_event_ids: [...CANON],
      canonical_sequence: CANON,
    });
    expect(badCount.ok).toBe(false);

    const crossMismatch = reconcileSourceEventProvenance({
      golden_source_event_ids: [...CANON],
      card_source_event_ids: [...CANON],
      accepted_event_ids: [51, 52, 53, 54, 55, 56, 57, 58, 60],
      canonical_sequence: CANON,
    });
    expect(crossMismatch.ok).toBe(false);
  });

  it('fails reconciliation before package construction', () => {
    const eight = CANON.slice(0, 8);
    const r = reconcilePersistedAmsRun(
      rows({ cards: [{ run_id: RUN_ID, subject_id: SUBJECT, status: 'DEGRADED',
        source_event_ids: [...eight], evidence_card: { RequestedAction: 'suppress' } }] }),
      expectation({
        source_event_ids: [...eight],
        accepted_event_ids: [...eight],
        canonical_sequence: [...CANON],
      }),
    );
    expect(r.ok).toBe(false);
  });
});
