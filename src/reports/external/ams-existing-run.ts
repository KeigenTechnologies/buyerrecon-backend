/**
 * BuyerRecon Golden Session v0.1 — "existing AMS run" input mode.
 *
 * WHY THIS EXISTS
 *
 * The canonical Golden Session entrypoint historically had exactly one input
 * mode: run the AMS `buyerrecon-report` binary itself, then read the golden
 * JSON that child produced. For a session whose AMS run has ALREADY happened
 * that mode is unusable, because AMS replay persistence
 * (`replay_runs`, `replay_evidence_cards`) is append-only with no conflict
 * target: a second invocation appends a second run row and a second evidence
 * card, producing duplicate authoritative output under a new run id.
 *
 * This module adds a second, fail-closed input mode that consumes an ALREADY
 * PRODUCED canonical AMS golden JSON plus the persisted run identity, and
 * reconciles the two against each other before any package is built.
 *
 * STRUCTURAL NO-AMS GUARANTEE
 *
 * `AmsInputMode` is a discriminated union. The `existing_run` variant carries
 * NO `ams_bin` and NO `ams_db_url` field at all, so there is no value the
 * existing-run branch could pass to an `execFile` of the AMS binary. The
 * absence is enforced by the type system, not by a runtime flag check.
 *
 * AUTHORITY SPLIT (unchanged)
 *
 * Nothing here re-scores, re-decides or overrides AMS. It only validates that
 * the supplied artifact and the persisted run describe the SAME run, and
 * fails closed otherwise.
 *
 * WHICH SIDE IS AUTHORITATIVE FOR WHAT
 *
 * Established by direct inspection of the canonical schema, not assumed:
 *
 *   - PERSISTED (replay rows) is authoritative for PROVENANCE only: run
 *     identity, site, subject, and the exact ordered `source_event_ids`.
 *   - THE GOLDEN JSON is the sole artifact-side carrier of the policy final
 *     decision (`authoritative_final_decision`).
 *   - NOTHING persists the policy final decision. There is no
 *     `final_decision` / `FinalDecision` / verdict column on `replay_runs` or
 *     `replay_evidence_cards`, and no such key inside the persisted
 *     `evidence_card` / `adapter_quality` JSON.
 *
 * The persisted values that LOOK decision-shaped are not decisions:
 * `evidence_card.RequestedAction` and `replay_runs.action_distribution` are
 * PRODUCT proposals, and `replay_evidence_cards.status` is an adapter data-
 * quality state. A product proposal must never be interpreted, converted or
 * presented as a policy final decision — see `persistedFinalDecision`, which
 * exists to make that impossible rather than merely discouraged.
 *
 * The absence of a persisted decision column does NOT weaken provenance
 * reconciliation: run-to-card linkage and exact ordered source-event equality
 * are enforced independently of any decision check.
 *
 * DATABASE ACCESS
 *
 * SELECT-only. This module issues no INSERT, UPDATE, DELETE or DDL.
 */

import type { GoldenSessionDbClient } from './session-evidence-atoms.js';

/** Flags that select and parameterise the existing-run input mode. */
export const AMS_EXISTING_RUN_FLAGS = Object.freeze([
  '--ams-golden-json',
  '--ams-run-id',
  '--ams-final-decision',
] as const);

/** Flags that belong exclusively to the fresh-AMS input mode. */
export const AMS_FRESH_RUN_FLAGS = Object.freeze(['--ams-bin', '--ams-db-url'] as const);

/**
 * Canonical AMS final-decision domain (contracts.RuntimeDecisionOutput).
 * Declared here so this module has no dependency on the packaging module.
 */
export const AMS_FINAL_DECISIONS = Object.freeze([
  'ALLOW',
  'ALLOW_WITH_FRICTION',
  'HOLD',
  'REVIEW',
  'DENY',
  'NO_ACTION',
] as const);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What the canonical replay schema does and does not persist, as verified by
 * direct `information_schema` inspection of the canonical database.
 *
 * `persisted_final_decision_column` is `null` because no such column exists.
 * It is recorded explicitly so that a future schema that DOES persist a
 * decision is a deliberate edit here, not a silent behaviour change.
 */
export const PERSISTED_RUN_AUTHORITY = Object.freeze({
  /** Persisted and authoritative for provenance. */
  provenance_fields: Object.freeze([
    'replay_runs.run_id',
    'replay_runs.site_id',
    'replay_evidence_cards.run_id',
    'replay_evidence_cards.subject_id',
    'replay_evidence_cards.source_event_ids',
  ] as const),
  /**
   * Persisted, decision-SHAPED, and NOT decisions: product proposals and an
   * adapter data-quality state. Never a final-decision source.
   */
  non_decision_fields: Object.freeze([
    'replay_evidence_cards.status',
    'replay_evidence_cards.evidence_card.RequestedAction',
    'replay_runs.action_distribution',
  ] as const),
  /** No canonical column or JSON key persists the policy final decision. */
  persisted_final_decision_column: null,
} as const);

/**
 * The persisted final decision for a run, which is ALWAYS `null`: the canonical
 * schema has no field that carries one.
 *
 * This function is the only sanctioned way to ask persistence for a decision,
 * and it takes the rows so that the answer cannot be mistaken for "we did not
 * look". It deliberately ignores `evidence_card.RequestedAction`,
 * `replay_evidence_cards.status` and `replay_runs.action_distribution`: those
 * are product proposals and adapter states. `RequestedAction='suppress'` is
 * NOT `final_decision='HOLD'`, does not imply it, and cannot validate it.
 */
export function persistedFinalDecision(_rows: PersistedAmsRunRows): null {
  return null;
}

/**
 * Which verifications actually happened, kept as distinct facts so a report can
 * never collapse "provenance verified against the database" into "final
 * decision verified against the database".
 */
export interface AmsRunVerificationFlags {
  /** Run identity, site, subject and exact ordered source events matched rows. */
  readonly persisted_provenance_verified: boolean;
  /** The artifact's `authoritative_final_decision` matched the declaration. */
  readonly golden_json_decision_verified: boolean;
  /** Always false: nothing persists a decision to verify against. */
  readonly persisted_final_decision_verified: false;
  /** Always true: the gap is a schema property, not a skipped check. */
  readonly persisted_final_decision_unavailable_by_schema: true;
}

/**
 * Resolved AMS input. The `existing_run` variant deliberately has no binary or
 * AMS database-url field, which is what makes AMS execution unreachable there.
 */
export type AmsInputMode =
  | { readonly mode: 'fresh_ams'; readonly ams_bin: string; readonly ams_db_url: string }
  | {
      readonly mode: 'existing_run';
      readonly ams_golden_json_path: string;
      readonly ams_run_id: string;
      readonly expected_final_decision: string;
    };

export type AmsInputModeResolution =
  | { readonly ok: true; readonly input: AmsInputMode }
  | { readonly ok: false; readonly reason: string };

function isAbsolutePosixOrWin(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

/**
 * Decide which AMS input mode the operator selected, from the already-parsed
 * flag map. Pure: no filesystem, no database, no process execution.
 *
 * Existing-run mode is selected when ANY existing-run flag is present, and it
 * then requires ALL of them. Mixing existing-run and fresh-AMS flags is
 * rejected as ambiguous rather than silently preferring one.
 */
export function resolveAmsInputMode(values: ReadonlyMap<string, string>): AmsInputModeResolution {
  const presentExisting = AMS_EXISTING_RUN_FLAGS.filter((f) => values.has(f));
  const presentFresh = AMS_FRESH_RUN_FLAGS.filter((f) => values.has(f));

  if (presentExisting.length > 0) {
    if (presentExisting.length !== AMS_EXISTING_RUN_FLAGS.length) {
      return { ok: false, reason: 'ams_existing_run_flags_required_together' };
    }
    if (presentFresh.length > 0) {
      return { ok: false, reason: 'ams_mode_ambiguous_existing_run_and_fresh_ams' };
    }

    const goldenPath = values.get('--ams-golden-json') as string;
    if (isAbsolutePosixOrWin(goldenPath) === false) {
      return { ok: false, reason: 'ams_golden_json_must_be_absolute' };
    }
    const runId = values.get('--ams-run-id') as string;
    if (UUID_RE.test(runId) === false) return { ok: false, reason: 'ams_run_id_invalid' };

    const decision = values.get('--ams-final-decision') as string;
    if ((AMS_FINAL_DECISIONS as readonly string[]).includes(decision) === false) {
      return { ok: false, reason: 'ams_final_decision_invalid' };
    }

    return {
      ok: true,
      input: {
        mode: 'existing_run',
        ams_golden_json_path: goldenPath,
        ams_run_id: runId,
        expected_final_decision: decision,
      },
    };
  }

  // Fresh-AMS mode: unchanged historical contract.
  const amsBin = values.get('--ams-bin');
  if (amsBin === undefined || isAbsolutePosixOrWin(amsBin) === false) {
    return { ok: false, reason: 'ams_bin_must_be_absolute' };
  }
  const amsDbUrl = values.get('--ams-db-url');
  if (amsDbUrl === undefined || /^postgres(ql)?:\/\//.test(amsDbUrl) === false) {
    return { ok: false, reason: 'ams_db_url' };
  }
  return { ok: true, input: { mode: 'fresh_ams', ams_bin: amsBin, ams_db_url: amsDbUrl } };
}

/** Rows read from the AMS replay persistence surface for one run id. */
export interface PersistedAmsRunRows {
  readonly runs: ReadonlyArray<Record<string, unknown>>;
  readonly cards: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Read the persisted AMS replay rows for one run id. SELECT-only.
 * Deliberately does NOT filter cards by subject, so a wrong-subject card is
 * surfaced to reconciliation as a mismatch instead of silently disappearing.
 */
export async function readPersistedAmsRunRows(
  db: GoldenSessionDbClient,
  amsRunId: string,
): Promise<PersistedAmsRunRows> {
  const runs = await db.query(
    `SELECT run_id, site_id, window_start, window_end, subjects_total, subjects_scoreable
       FROM replay_runs
      WHERE run_id = $1::uuid`,
    [amsRunId],
  );
  const cards = await db.query(
    `SELECT run_id, subject_id, status, source_event_ids, evidence_card
       FROM replay_evidence_cards
      WHERE run_id = $1::uuid`,
    [amsRunId],
  );
  return { runs: runs.rows, cards: cards.rows };
}

/** What the supplied golden JSON asserts, to be reconciled against persistence. */
export interface PersistedAmsRunExpectation {
  readonly ams_run_id: string;
  readonly site_id: string;
  readonly subject_id: string;
  /** From the supplied artifact's scope.source_event_ids, in artifact order. */
  readonly source_event_ids: ReadonlyArray<number>;
  /** From the supplied artifact's authoritative_final_decision. */
  readonly artifact_final_decision: string;
  /** Operator-declared expectation for the final decision. */
  readonly expected_final_decision: string;
  /** From the supplied artifact's product_decision.RequestedAction, if present. */
  readonly artifact_requested_action: string | undefined;
  /**
   * Run id asserted BY THE ARTIFACT ITSELF, if it carries one at all.
   *
   * The canonical v0.1 golden JSON does NOT: its accepted top-level key set is
   * closed and has no run-id member, and `scope` has no run-id field either, so
   * this is `undefined` today and the declared `--ams-run-id` is the only
   * artifact-side run id. If a future artifact does carry one, a disagreement
   * fails closed here instead of silently preferring the declaration.
   */
  readonly artifact_run_id: string | undefined;
}

export type PersistedAmsRunReconciliation =
  | {
      readonly ok: true;
      readonly source_event_count: number;
      readonly verification: AmsRunVerificationFlags;
    }
  | { readonly ok: false; readonly reasons: ReadonlyArray<string> };

function toNumberArray(value: unknown): ReadonlyArray<number> | undefined {
  if (Array.isArray(value) === false) return undefined;
  const out: number[] = [];
  for (const v of value as unknown[]) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
    if (Number.isFinite(n) === false) return undefined;
    out.push(n);
  }
  return out;
}

/**
 * Reconcile the supplied artifact against the persisted authoritative run.
 * Pure: takes already-fetched rows. Fails closed on ANY missing, duplicate or
 * contradictory row. Never repairs, never prefers one side silently.
 *
 * NOTE ON THE FINAL DECISION. `replay_runs` and `replay_evidence_cards` do NOT
 * persist the policy final decision; the evidence card stores the PRODUCT
 * proposal (`RequestedAction`) and the adapter `status`. The final decision is
 * therefore reconciled between the artifact and the operator-declared
 * expectation, while `RequestedAction` — which IS persisted — is reconciled
 * artifact-versus-database to detect a stale or foreign artifact.
 *
 * The `RequestedAction` check is a STALENESS check on a product proposal. It is
 * not a decision check: no value of `RequestedAction` can satisfy, imply or
 * substitute for the final-decision check, and no value of it can fail one.
 * The two are computed from disjoint inputs below.
 *
 * Provenance checks run regardless of the decision checks, so the missing
 * persisted decision column cannot weaken source-event reconciliation.
 */
export function reconcilePersistedAmsRun(
  rows: PersistedAmsRunRows,
  expected: PersistedAmsRunExpectation,
): PersistedAmsRunReconciliation {
  const structureReasons: string[] = [];

  if (rows.runs.length === 0) structureReasons.push('persisted_run_missing');
  else if (rows.runs.length > 1) structureReasons.push('persisted_run_duplicate');

  if (rows.cards.length === 0) structureReasons.push('persisted_evidence_card_missing');
  else if (rows.cards.length > 1) structureReasons.push('persisted_evidence_card_duplicate');

  if (structureReasons.length > 0) return { ok: false, reasons: structureReasons };

  const run = rows.runs[0] as Record<string, unknown>;
  const card = rows.cards[0] as Record<string, unknown>;

  // ---- Provenance. Computed only from row identity and source events. Never
  // reads any decision, product proposal or adapter status.
  const provenanceReasons: string[] = [];

  if (expected.artifact_run_id !== undefined && expected.artifact_run_id !== expected.ams_run_id) {
    provenanceReasons.push('golden_json_run_id_mismatch');
  }
  if (String(run.run_id) !== expected.ams_run_id) provenanceReasons.push('persisted_run_id_mismatch');
  if (String(run.site_id) !== expected.site_id) provenanceReasons.push('persisted_run_site_mismatch');
  // Internal linkage: the card must belong to this exact run row.
  if (String(card.run_id) !== expected.ams_run_id) provenanceReasons.push('persisted_card_run_id_mismatch');
  if (String(card.subject_id) !== expected.subject_id) provenanceReasons.push('persisted_card_subject_mismatch');

  const persistedIds = toNumberArray(card.source_event_ids);
  if (persistedIds === undefined) {
    provenanceReasons.push('persisted_source_event_ids_invalid');
  } else {
    if (persistedIds.length !== expected.source_event_ids.length) {
      provenanceReasons.push('persisted_source_event_count_mismatch');
    } else if (persistedIds.some((id, i) => id !== expected.source_event_ids[i])) {
      // Exact ordered equality: canonical order must match, not just set equality.
      provenanceReasons.push('persisted_source_event_ids_mismatch');
    }
  }

  // ---- Decision. The golden JSON is the only decision carrier, so this is an
  // artifact-versus-declaration check. `persistedFinalDecision(rows)` is null by
  // schema and is therefore never consulted as an alternative source.
  const decisionReasons: string[] = [];

  if (expected.artifact_final_decision !== expected.expected_final_decision) {
    decisionReasons.push('golden_json_final_decision_mismatch');
  }

  // Staleness check on the PRODUCT proposal. Disjoint from the decision check
  // above: it can neither satisfy nor fail it.
  const persistedAction = (card.evidence_card as Record<string, unknown> | null | undefined)?.RequestedAction;
  if (
    expected.artifact_requested_action !== undefined &&
    typeof persistedAction === 'string' &&
    persistedAction !== expected.artifact_requested_action
  ) {
    decisionReasons.push('persisted_requested_action_mismatch');
  }

  const reasons = [...provenanceReasons, ...decisionReasons];
  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    source_event_count: expected.source_event_ids.length,
    verification: {
      persisted_provenance_verified: provenanceReasons.length === 0,
      golden_json_decision_verified: decisionReasons.length === 0,
      persisted_final_decision_verified: false,
      persisted_final_decision_unavailable_by_schema: true,
    },
  };
}
