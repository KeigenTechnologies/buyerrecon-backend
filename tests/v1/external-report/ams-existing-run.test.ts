import { describe, expect, it } from 'vitest';

import {
  AMS_EXISTING_RUN_FLAGS,
  AMS_FINAL_DECISIONS,
  AMS_FRESH_RUN_FLAGS,
  readPersistedAmsRunRows,
  reconcilePersistedAmsRun,
  resolveAmsInputMode,
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
    ...over,
  };
}

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
    expect(r).toEqual({ ok: true, source_event_count: 9 });
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

  it('fails closed when the artifact decision contradicts the declared expectation', () => {
    const r = reconcilePersistedAmsRun(
      rows(),
      expectation({ artifact_final_decision: 'ALLOW', expected_final_decision: 'HOLD' }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('artifact_final_decision_mismatch');
  });

  it('fails closed when the persisted product proposal contradicts the artifact', () => {
    const r = reconcilePersistedAmsRun(rows(), expectation({ artifact_requested_action: 'escalate' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons).toContain('persisted_requested_action_mismatch');
  });

  it('tolerates numeric source ids arriving as strings from the driver', () => {
    const card = {
      ...(rows().cards[0] as Record<string, unknown>),
      source_event_ids: EVENT_IDS.map(String),
    };
    expect(reconcilePersistedAmsRun(rows({ cards: [card] }), expectation())).toEqual({
      ok: true,
      source_event_count: 9,
    });
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
