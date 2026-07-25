import { describe, expect, it } from 'vitest';

import {
  AMS_EXISTING_RUN_FLAGS,
  AMS_FINAL_DECISIONS,
  AMS_FRESH_RUN_FLAGS,
  GOLDEN_JSON_EMBEDDED_RUN_ID,
  PERSISTED_RUN_AUTHORITY,
  buildExistingRunReportMetadata,
  persistedFinalDecision,
  readPersistedAmsRunRows,
  reconcilePersistedAmsRun,
  renderExistingRunReportMetadata,
  resolveAmsInputMode,
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
    ...over,
  };
}

/** The verification shape every successful reconciliation must report. */
const VERIFIED_FLAGS = {
  persisted_provenance_verified: true,
  golden_json_decision_verified: true,
  persisted_final_decision_verified: false,
  persisted_final_decision_unavailable_by_schema: true,
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

  it.each(AMS_EXISTING_RUN_FLAGS)('requires all existing-run flags together (missing %s)', (missing) => {
    const supplied = existingFlags();
    supplied.delete(missing);
    const r = resolveAmsInputMode(supplied);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('ams_existing_run_flags_required_together');
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
    expect(r.reasons).toContain('persisted_source_event_count_mismatch');
  });

  it('fails closed on the same set in a different order (canonical order enforced)', () => {
    const scrambled = [52, 51, 53, 54, 55, 56, 57, 58, 59];
    const card = { ...(rows().cards[0] as Record<string, unknown>), source_event_ids: scrambled };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_source_event_ids_mismatch');
  });

  it('fails closed on a different event id entirely', () => {
    const other = [51, 52, 53, 54, 55, 56, 57, 58, 60];
    const card = { ...(rows().cards[0] as Record<string, unknown>), source_event_ids: other };
    const r = reconcilePersistedAmsRun(rows({ cards: [card] }), expectation());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_source_event_ids_mismatch');
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
        reason: 'persisted_source_event_ids_mismatch',
      },
      {
        field: 'source_event_count',
        rows: rows(),
        expect: expectation({ source_event_ids: EVENT_IDS.slice(0, 8) }),
        reason: 'persisted_source_event_count_mismatch',
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
      expect(agreeingDecision.reasons).toContain('persisted_source_event_ids_mismatch');
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
    if (bad.ok === false) expect(bad.reasons).toContain('persisted_source_event_ids_mismatch');

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
// Existing-run reporting metadata

describe('existing-run report metadata', () => {
  const verified: AmsRunVerificationFlags = {
    persisted_provenance_verified: true,
    golden_json_decision_verified: true,
    persisted_final_decision_verified: false,
    persisted_final_decision_unavailable_by_schema: true,
  };
  const meta = buildExistingRunReportMetadata(RUN_ID, verified);

  it('emits golden_json_embedded_run_id as the boolean false', () => {
    expect(meta.golden_json_embedded_run_id).toBe(false);
    expect(typeof meta.golden_json_embedded_run_id).toBe('boolean');
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
    ]);
  });

  it('renders a failed provenance verification honestly rather than defaulting to true', () => {
    const lines = renderExistingRunReportMetadata(buildExistingRunReportMetadata(RUN_ID, undefined));
    expect(lines).toContain('  persisted_provenance_verified=false');
    expect(lines).toContain('  golden_json_decision_verified=false');
    // The schema facts are unaffected by a missing reconciliation.
    expect(lines).toContain('  golden_json_embedded_run_id=false');
    expect(lines).toContain('  persisted_final_decision_unavailable_by_schema=true');
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
