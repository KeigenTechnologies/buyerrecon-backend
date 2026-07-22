#!/usr/bin/env tsx
/**
 * Sprint 3 — RiskWorker Option B — Family A in-memory proof command.
 *
 * Stage A (proof-command establishment) artifact for the selected triple:
 *   selected_architecture_family = family_a_in_memory
 *   selected_semantic_surface    = full
 *   persistence_disposition      = simulated
 *
 * What this command does when (later, separately authorized to) run:
 *   1. Builds a deterministic caller-owned in-memory dependency satisfying
 *      the merged narrow worker query contract (`RiskEvidenceQueryable`,
 *      PR #436). The dependency serves one fixed synthetic joined source
 *      row and records persistence invocations in local memory only.
 *   2. Invokes the governed FULL worker surface (`runRiskEvidenceWorker`)
 *      with `record_only: false` explicitly, so record-only suppression is
 *      never selected and the environment is never consulted for mode.
 *   3. Checks deterministic aggregate expectations (one source read, one
 *      candidate, one persistence invocation, no suppression, no unexpected
 *      dependency operation).
 *   4. Emits exactly one machine-readable safe JSON payload on stdout —
 *      abstract booleans, counts, and enumerated labels only — and exits 0
 *      on satisfied expectations, nonzero otherwise. Unexpected failures
 *      are caught and reduced to an enumerated safe failure label; no raw
 *      error message, stack trace, SQL text, row data, or identifier is
 *      ever printed.
 *
 * Explicit limits (semantic non-overclaim):
 *   - This command is ESTABLISHED but UNEXECUTED under the establishing GO.
 *   - Successful future execution would prove ONLY the scoped worker
 *     behavior against this deterministic in-memory simulation.
 *   - The simulation does not prove real persistence correctness, real SQL
 *     correctness, real-database compatibility, schema or constraint
 *     enforcement, transactionality, rollback, durability, concurrency, or
 *     production safety.
 *   - A separately established Stage B safe classifier is required to
 *     consume and reduce this payload; none is established here.
 *   - Both this command and the classifier require independent head-pinned
 *     review before merge; execution requires a later exact-scoped GO.
 *   - Gate D/E status is not moved, marked, or implied by this file.
 *
 * Simulation honesty: the in-memory dependency implements ONLY the single
 * narrow query surface the worker statically invokes. It does not imitate a
 * database client, transactions, schema constraints, networking, credential
 * handling, or durability. No DB, network, filesystem-write, environment,
 * or process access occurs in this file.
 */

import {
  runRiskEvidenceWorker,
  type RiskEvidenceQueryable,
  type RiskEvidenceWorkerOptions,
} from '../src/scoring/risk-evidence/worker.js';

/* --------------------------------------------------------------------------
 * Deterministic constants. No wall-clock reads, no randomness, no env.
 * ------------------------------------------------------------------------ */

const SELECTED_ARCHITECTURE_FAMILY = 'family_a_in_memory';
const SELECTED_SEMANTIC_SURFACE = 'full';
const PERSISTENCE_DISPOSITION = 'simulated';

/** Fixed proof window — fixed ISO instants, never "now". */
const PROOF_WINDOW_START = new Date('2026-01-01T00:00:00.000Z');
const PROOF_WINDOW_END = new Date('2026-01-08T00:00:00.000Z');

/** Synthetic version labels (worker supports explicit overrides for both). */
const PROOF_OBSERVATION_VERSION = 'risk-obs-proof-v0';
const PROOF_SCORING_VERSION = 'scoring-proof-v0';

/**
 * Statically expected dependency-call arities, from the worker's two query
 * call sites: the source-read join takes 7 parameters; the per-candidate
 * persistence upsert takes 13. Used only to classify simulated operations —
 * no SQL text is interpreted or reproduced here.
 */
const SOURCE_READ_PARAM_COUNT = 7;
const PERSISTENCE_PARAM_COUNT = 13;

/** Deterministic aggregate expectations for the fixed scenario below. */
const EXPECTED_SOURCE_READ_COUNT = 1;
const EXPECTED_CANDIDATE_COUNT = 1;
const EXPECTED_PERSISTENCE_INVOCATION_COUNT = 1;

/** Enumerated safe failure labels — the only failure text this file emits. */
const SAFE_FAILURE_LABEL = {
  WORKER_ENTRY_FAILED: 'worker_entry_failed_safe',
  AGGREGATE_EXPECTATION_MISMATCH: 'aggregate_expectation_mismatch',
  UNEXPECTED_DEPENDENCY_OPERATION: 'unexpected_dependency_operation',
  PAYLOAD_EMISSION_FAILED: 'payload_emission_failed_safe',
} as const;

type SafeFailureLabel =
  (typeof SAFE_FAILURE_LABEL)[keyof typeof SAFE_FAILURE_LABEL];

/* --------------------------------------------------------------------------
 * Deterministic source scenario — exactly one synthetic joined row shaped
 * like the worker's SELECT projection (stage0_decisions ⋈ SBF v0.3 read
 * view). Synthetic values only; no customer data, no copied records.
 * One row deterministically yields one candidate and therefore one
 * persistence invocation on the full (non-suppressed) path.
 * ------------------------------------------------------------------------ */

const DETERMINISTIC_SOURCE_ROWS: ReadonlyArray<{ [column: string]: any }> = [
  {
    stage0_decision_id: 'stage0-proof-0001',
    workspace_id: 'ws-proof',
    site_id: 'site-proof',
    session_id: 'session-proof-0001',
    excluded: false,
    rule_id: 'rule-proof',
    rule_inputs: {},
    behavioural_features_id: 1,
    feature_version: 'behavioural-features-v0.3',
    source_event_count: 12,
    ms_from_consent_to_first_cta: 1500,
    dwell_ms_before_first_action: 900,
    first_form_start_precedes_first_cta: true,
    form_start_count_before_first_cta: 1,
    has_form_submit_without_prior_form_start: false,
    form_submit_count_before_first_form_start: 0,
    ms_between_pageviews_p50: 2200,
    pageview_burst_count_10s: 1,
    max_events_per_second: 2,
    sub_200ms_transition_count: 0,
    refresh_loop_candidate: false,
    refresh_loop_count: 0,
    same_path_repeat_count: 0,
    same_path_repeat_min_delta_ms: null,
    valid_feature_count: 18,
    missing_feature_count: 0,
  },
];

/* --------------------------------------------------------------------------
 * Caller-owned deterministic in-memory dependency. Satisfies the narrowed
 * worker contract structurally (no casts, no suppression directives, no
 * concrete client import). Records operations in local memory only.
 * ------------------------------------------------------------------------ */

interface DependencyOperationLog {
  source_read_count: number;
  persistence_invocation_count: number;
  unexpected_operation_count: number;
}

function makeInMemoryDependency(): {
  dependency: RiskEvidenceQueryable;
  log: DependencyOperationLog;
} {
  const log: DependencyOperationLog = {
    source_read_count: 0,
    persistence_invocation_count: 0,
    unexpected_operation_count: 0,
  };

  const dependency: RiskEvidenceQueryable = {
    async query(
      text: string,
      values: ReadonlyArray<unknown>,
    ): Promise<{ rows: Array<{ [column: string]: any }> }> {
      const textPresent = typeof text === 'string' && text.length > 0;

      if (textPresent && values.length === SOURCE_READ_PARAM_COUNT) {
        log.source_read_count += 1;
        // Serve the fixed synthetic scenario. Window/version filtering is
        // intentionally not re-implemented: the worker under proof owns
        // its parameters; this simulation owns only deterministic supply.
        return { rows: DETERMINISTIC_SOURCE_ROWS.map((r) => ({ ...r })) };
      }

      if (textPresent && values.length === PERSISTENCE_PARAM_COUNT) {
        // Simulated persistence: count the invocation in local memory and
        // return the minimum deterministic result shape. Nothing is
        // written anywhere; no durability or constraint semantics exist.
        log.persistence_invocation_count += 1;
        return { rows: [] };
      }

      log.unexpected_operation_count += 1;
      return { rows: [] };
    },
  };

  return { dependency, log };
}

/* --------------------------------------------------------------------------
 * Safe payload emission — exactly one JSON object on stdout, always.
 * ------------------------------------------------------------------------ */

interface SafeProofPayload {
  proof_status: 'pass' | 'fail';
  selected_architecture_family: string;
  selected_semantic_surface: string;
  persistence_disposition: string;
  worker_entry_completed: boolean;
  source_read_observed: boolean;
  persistence_observed: boolean;
  source_read_count: number;
  persistence_invocation_count: number;
  candidate_count: number;
  persisted_count: number;
  record_only_selected: boolean;
  record_only_write_suppressed: boolean;
  aggregate_expectations_satisfied: boolean;
  unexpected_operation_present: boolean;
  safe_failure_label: SafeFailureLabel | null;
}

function emitPayloadAndExit(payload: SafeProofPayload): never {
  try {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } catch {
    // Even payload emission must fail safe and silent.
    process.exit(3);
  }
  process.exit(payload.proof_status === 'pass' ? 0 : 1);
}

function failClosed(
  label: SafeFailureLabel,
  partial?: Partial<SafeProofPayload>,
): never {
  emitPayloadAndExit({
    proof_status: 'fail',
    selected_architecture_family: SELECTED_ARCHITECTURE_FAMILY,
    selected_semantic_surface: SELECTED_SEMANTIC_SURFACE,
    persistence_disposition: PERSISTENCE_DISPOSITION,
    worker_entry_completed: false,
    source_read_observed: false,
    persistence_observed: false,
    source_read_count: 0,
    persistence_invocation_count: 0,
    candidate_count: 0,
    persisted_count: 0,
    record_only_selected: false,
    record_only_write_suppressed: false,
    aggregate_expectations_satisfied: false,
    unexpected_operation_present: false,
    safe_failure_label: label,
    ...partial,
  });
}

/* --------------------------------------------------------------------------
 * Proof orchestration.
 * ------------------------------------------------------------------------ */

async function main(): Promise<never> {
  const { dependency, log } = makeInMemoryDependency();

  const options: RiskEvidenceWorkerOptions = {
    workspace_id: null,
    site_id: null,
    window_start: PROOF_WINDOW_START,
    window_end: PROOF_WINDOW_END,
    observation_version: PROOF_OBSERVATION_VERSION,
    scoring_version_override: PROOF_SCORING_VERSION,
    // Explicit FULL surface selection: record-only suppression is never
    // chosen and the worker never consults the environment for mode.
    record_only: false,
  };

  let result;
  try {
    result = await runRiskEvidenceWorker(dependency, options);
  } catch {
    // Governed worker entry failed. Reduce to an enumerated safe label —
    // no raw error message, stack, or cause chain leaves this process.
    failClosed(SAFE_FAILURE_LABEL.WORKER_ENTRY_FAILED, {
      source_read_count: log.source_read_count,
      persistence_invocation_count: log.persistence_invocation_count,
      source_read_observed: log.source_read_count > 0,
      persistence_observed: log.persistence_invocation_count > 0,
      unexpected_operation_present: log.unexpected_operation_count > 0,
    });
  }

  const unexpectedOperationPresent = log.unexpected_operation_count > 0;

  const aggregateExpectationsSatisfied =
    log.source_read_count === EXPECTED_SOURCE_READ_COUNT &&
    log.persistence_invocation_count === EXPECTED_PERSISTENCE_INVOCATION_COUNT &&
    result.candidate_count === EXPECTED_CANDIDATE_COUNT &&
    result.upserted_rows === EXPECTED_PERSISTENCE_INVOCATION_COUNT &&
    result.record_only === false &&
    result.record_only_write_suppressed === false &&
    !unexpectedOperationPresent;

  const payload: SafeProofPayload = {
    proof_status: aggregateExpectationsSatisfied ? 'pass' : 'fail',
    selected_architecture_family: SELECTED_ARCHITECTURE_FAMILY,
    selected_semantic_surface: SELECTED_SEMANTIC_SURFACE,
    persistence_disposition: PERSISTENCE_DISPOSITION,
    worker_entry_completed: true,
    source_read_observed: log.source_read_count > 0,
    persistence_observed: log.persistence_invocation_count > 0,
    source_read_count: log.source_read_count,
    persistence_invocation_count: log.persistence_invocation_count,
    candidate_count: result.candidate_count,
    persisted_count: result.upserted_rows,
    record_only_selected: result.record_only,
    record_only_write_suppressed: result.record_only_write_suppressed,
    aggregate_expectations_satisfied: aggregateExpectationsSatisfied,
    unexpected_operation_present: unexpectedOperationPresent,
    safe_failure_label: aggregateExpectationsSatisfied
      ? null
      : unexpectedOperationPresent
        ? SAFE_FAILURE_LABEL.UNEXPECTED_DEPENDENCY_OPERATION
        : SAFE_FAILURE_LABEL.AGGREGATE_EXPECTATION_MISMATCH,
  };

  emitPayloadAndExit(payload);
}

main().catch(() => {
  // Terminal backstop: nothing raw may reach default uncaught output.
  failClosed(SAFE_FAILURE_LABEL.WORKER_ENTRY_FAILED);
});
