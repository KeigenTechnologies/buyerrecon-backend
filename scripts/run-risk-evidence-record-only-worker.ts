import { assertRiskEvidenceRecordOnlyMode } from '../src/scoring/risk-evidence/record-only';
/**
 * RECORD_ONLY wrapper for the risk evidence worker.
 *
 * This file is an explicit entrypoint for future bounded capture runs.
 * It is not executed by this PR.
 *
 * Safety contract:
 * - Only this wrapper sets RISK_EVIDENCE_RECORD_ONLY=true.
 * - Absence of explicit RECORD_ONLY mode fails closed.
 * - The normal risk-evidence:run command remains unchanged.
 * - This wrapper does not run a classifier and does not print raw captured output.
 */

const REQUIRED_RECORD_ONLY_VALUE = 'true';

function failClosed(reason: string): never {
  console.log('record_only_entrypoint_present=true');
  console.log('record_only_mode_required=true');
  console.log('record_only_mode_confirmed=false');
  console.log(`record_only_stop_line=${reason}`);
  console.log('worker_execution_authorized=false');
  process.exit(2);
}

process.env.RISK_EVIDENCE_RECORD_ONLY = REQUIRED_RECORD_ONLY_VALUE;
process.env.RISK_EVIDENCE_CAPTURE_MODE = 'RECORD_ONLY';

if (process.env.RISK_EVIDENCE_RECORD_ONLY !== REQUIRED_RECORD_ONLY_VALUE) {
  failClosed('record_only_env_not_confirmed');
}

if (process.env.RISK_EVIDENCE_CAPTURE_MODE !== 'RECORD_ONLY') {
  failClosed('record_only_capture_mode_not_confirmed');
}

assertRiskEvidenceRecordOnlyMode();

console.log('record_only_entrypoint_present=true');
console.log('record_only_mode_required=true');
console.log('record_only_mode_confirmed=true');
console.log('worker_execution_authorized=false');
console.log('classifier_execution_attempted=false');
console.log('raw_output_printed=false');

/**
 * Import after RECORD_ONLY env is set.
 * Future proof PR must verify the downstream worker honors this mode before any capture GO.
 */
await import('./run-risk-evidence-worker');
