#!/usr/bin/env node
/**
 * Sprint 3 — RiskWorker Option B — Family A safe proof-payload classifier.
 *
 * Stage B (safe-classifier establishment) artifact for the selected triple:
 *   selected_architecture_family = family_a_in_memory
 *   selected_semantic_surface    = full
 *   persistence_disposition      = simulated
 *
 * Standalone reducer for the PRIVATE JSON payload emitted by the Stage A
 * proof command (`scripts/run-risk-evidence-worker-in-memory-proof.ts`).
 * It NEVER executes, imports, or wraps the proof command.
 *
 * Contract:
 *   - reads exactly one UTF-8 JSON object from stdin (bounded size);
 *   - validates a fixed allowlisted schema derived from the Stage A payload;
 *   - rejects unknown fields without naming, counting, or echoing them;
 *   - reduces the private payload to one minimal safe classification object
 *     on stdout (finite hard-coded statuses and labels only);
 *   - fails closed on missing, oversized, malformed, extra, contradictory,
 *     or unsupported input;
 *   - emits no raw diagnostic, no echo of input, nothing on stderr;
 *   - exits 0 only for a PASS classification, nonzero otherwise.
 *
 * Explicit limits (semantic non-overclaim):
 *   - This classifier is ESTABLISHED but UNEXECUTED under the establishing
 *     GO; the Stage A proof command is likewise still unexecuted.
 *   - Classifier establishment proves no worker behavior.
 *   - A future PASS classification would apply ONLY to the scoped
 *     deterministic in-memory simulation — never to real persistence
 *     correctness, real-database compatibility, transactionality, rollback,
 *     durability, concurrency, schema enforcement, production safety, or
 *     Gate D/E passage.
 *   - Execution requires a later exact-scoped GO after one fresh combined
 *     head-pinned review of the proof command and this classifier.
 *
 * No filesystem, environment, process-argument, child-process, network, or
 * dynamic-evaluation access. JSON.parse is the only deserialization.
 */

/* Finite, hard-coded safe surface. Nothing outside these values is emitted. */
const SELECTED_ARCHITECTURE_FAMILY = 'family_a_in_memory';
const SELECTED_SEMANTIC_SURFACE = 'full';
const PERSISTENCE_DISPOSITION = 'simulated';

const CLASSIFICATION = Object.freeze({
  PASS: 'pass',
  BLOCKED: 'blocked',
});

const SAFE_LABEL = Object.freeze({
  INPUT_MISSING: 'input_missing',
  INPUT_OVERSIZED: 'input_oversized',
  INPUT_INVALID: 'input_invalid',
  SCHEMA_INVALID: 'schema_invalid',
  PROOF_CONDITIONS_NOT_MET: 'proof_conditions_not_met',
  CLASSIFIER_INTERNAL_FAILURE: 'classifier_internal_failure',
});

/** Small fixed bound — generous for the Stage A payload, nothing more. */
const MAX_INPUT_BYTES = 8192;

/** Deterministic aggregate expectations mirrored from the Stage A scenario. */
const EXPECTED_COUNT = 1;

/**
 * Fixed allowlisted input schema, derived solely from the Stage A
 * proof-command payload contract. `values` non-null means the field must
 * equal one of the listed values exactly.
 */
const PAYLOAD_SCHEMA = Object.freeze({
  proof_status: { kind: 'enum', values: ['pass', 'fail'] },
  selected_architecture_family: {
    kind: 'enum',
    values: [SELECTED_ARCHITECTURE_FAMILY],
  },
  selected_semantic_surface: {
    kind: 'enum',
    values: [SELECTED_SEMANTIC_SURFACE],
  },
  persistence_disposition: { kind: 'enum', values: [PERSISTENCE_DISPOSITION] },
  worker_entry_completed: { kind: 'boolean' },
  source_read_observed: { kind: 'boolean' },
  persistence_observed: { kind: 'boolean' },
  source_read_count: { kind: 'count' },
  persistence_invocation_count: { kind: 'count' },
  candidate_count: { kind: 'count' },
  persisted_count: { kind: 'count' },
  record_only_selected: { kind: 'boolean' },
  record_only_write_suppressed: { kind: 'boolean' },
  aggregate_expectations_satisfied: { kind: 'boolean' },
  unexpected_operation_present: { kind: 'boolean' },
  safe_failure_label: {
    kind: 'enum',
    values: [
      null,
      'worker_entry_failed_safe',
      'aggregate_expectation_mismatch',
      'unexpected_dependency_operation',
      'payload_emission_failed_safe',
    ],
  },
});

function emitAndExit(classificationStatus, safeFailureLabel) {
  const safeOutput = {
    classification_status: classificationStatus,
    selected_architecture_family: SELECTED_ARCHITECTURE_FAMILY,
    selected_semantic_surface: SELECTED_SEMANTIC_SURFACE,
    persistence_disposition: PERSISTENCE_DISPOSITION,
    scoped_proof_passed: classificationStatus === CLASSIFICATION.PASS,
    safe_failure_label: safeFailureLabel,
  };
  try {
    process.stdout.write(`${JSON.stringify(safeOutput)}\n`);
  } catch {
    process.exit(3);
  }
  process.exit(classificationStatus === CLASSIFICATION.PASS ? 0 : 1);
}

function blocked(safeFailureLabel) {
  emitAndExit(CLASSIFICATION.BLOCKED, safeFailureLabel);
}

/* Backstops: nothing raw may ever reach default runtime diagnostics. */
process.on('uncaughtException', () => {
  blocked(SAFE_LABEL.CLASSIFIER_INTERNAL_FAILURE);
});
process.on('unhandledRejection', () => {
  blocked(SAFE_LABEL.CLASSIFIER_INTERNAL_FAILURE);
});

function readBoundedStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let finished = false;
    const finish = (value) => {
      if (!finished) {
        finished = true;
        resolve(value);
      }
    };
    process.stdin.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_INPUT_BYTES) {
        finish({ oversized: true, text: '' });
        process.stdin.destroy();
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      finish({ oversized: false, text: Buffer.concat(chunks).toString('utf8') });
    });
    process.stdin.on('error', () => {
      finish({ oversized: false, text: '' });
    });
  });
}

/**
 * Validate the parsed value against the fixed allowlist. Returns a safe
 * verdict only — never any detail of what was wrong or what was present.
 */
function validatePayload(payload) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return { ok: false };
  }

  const schemaKeys = Object.keys(PAYLOAD_SCHEMA);
  const payloadKeys = Object.keys(payload);

  // Unknown fields fail closed; nothing about them is named or counted out.
  for (const key of payloadKeys) {
    if (!Object.prototype.hasOwnProperty.call(PAYLOAD_SCHEMA, key)) {
      return { ok: false };
    }
  }
  // Every allowlisted field is required.
  for (const key of schemaKeys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      return { ok: false };
    }
  }

  for (const key of schemaKeys) {
    const rule = PAYLOAD_SCHEMA[key];
    const value = payload[key];
    if (rule.kind === 'boolean') {
      if (typeof value !== 'boolean') return { ok: false };
    } else if (rule.kind === 'count') {
      if (!Number.isInteger(value) || value < 0) return { ok: false };
    } else if (rule.kind === 'enum') {
      if (!rule.values.includes(value)) return { ok: false };
    } else {
      return { ok: false };
    }
  }

  // Internal consistency of aggregate facts.
  const consistent =
    payload.source_read_observed === (payload.source_read_count > 0) &&
    payload.persistence_observed === (payload.persistence_invocation_count > 0);
  if (!consistent) return { ok: false };

  // A payload claiming PASS must be internally coherent with that claim.
  if (payload.proof_status === 'pass') {
    const passCoherent =
      payload.worker_entry_completed === true &&
      payload.aggregate_expectations_satisfied === true &&
      payload.unexpected_operation_present === false &&
      payload.safe_failure_label === null;
    if (!passCoherent) return { ok: false };
  }

  return { ok: true };
}

/**
 * Decide the scoped classification for a schema-valid payload. PASS only
 * when every required scoped condition is affirmatively established.
 */
function classify(payload) {
  const pass =
    payload.proof_status === 'pass' &&
    payload.worker_entry_completed === true &&
    payload.source_read_observed === true &&
    payload.persistence_observed === true &&
    payload.source_read_count === EXPECTED_COUNT &&
    payload.persistence_invocation_count === EXPECTED_COUNT &&
    payload.candidate_count === EXPECTED_COUNT &&
    payload.persisted_count === EXPECTED_COUNT &&
    payload.record_only_selected === false &&
    payload.record_only_write_suppressed === false &&
    payload.aggregate_expectations_satisfied === true &&
    payload.unexpected_operation_present === false &&
    payload.safe_failure_label === null;
  return pass;
}

async function main() {
  const input = await readBoundedStdin();
  if (input.oversized) blocked(SAFE_LABEL.INPUT_OVERSIZED);
  if (input.text.trim().length === 0) blocked(SAFE_LABEL.INPUT_MISSING);

  let payload;
  try {
    // JSON.parse of the full text rejects multiple JSON values and any
    // trailing non-whitespace content by construction.
    payload = JSON.parse(input.text);
  } catch {
    blocked(SAFE_LABEL.INPUT_INVALID);
  }

  const verdict = validatePayload(payload);
  if (!verdict.ok) blocked(SAFE_LABEL.SCHEMA_INVALID);

  if (classify(payload)) {
    emitAndExit(CLASSIFICATION.PASS, null);
  }
  blocked(SAFE_LABEL.PROOF_CONDITIONS_NOT_MET);
}

main().catch(() => {
  blocked(SAFE_LABEL.CLASSIFIER_INTERNAL_FAILURE);
});
