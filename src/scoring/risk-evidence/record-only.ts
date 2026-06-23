/**
 * Sprint 3 — RECORD_ONLY mode detection + safe labels for the risk-evidence
 * worker write-path refactor.
 *
 * No DB. No HTTP. No side effects on import. Reads the environment only when
 * `isRiskEvidenceRecordOnlyMode()` is called.
 *
 * Convention (established by the PR #343 `risk-evidence:record-only` wrapper):
 *   RISK_EVIDENCE_RECORD_ONLY   = 'true'
 *   RISK_EVIDENCE_CAPTURE_MODE  = 'RECORD_ONLY'
 *
 * The dedicated wrapper sets both and fails closed if it cannot confirm them.
 * This helper is the worker-side counterpart: it only reports RECORD_ONLY when
 * both are explicitly confirmed, and it fails closed (throws) on an ambiguous
 * partial request rather than silently writing.
 */

export const RISK_EVIDENCE_RECORD_ONLY_ENV = 'RISK_EVIDENCE_RECORD_ONLY';
export const RISK_EVIDENCE_CAPTURE_MODE_ENV = 'RISK_EVIDENCE_CAPTURE_MODE';

const RECORD_ONLY_TRUE = 'true';
const CAPTURE_MODE_RECORD_ONLY = 'RECORD_ONLY';

/**
 * Returns true ONLY when both env vars explicitly confirm RECORD_ONLY mode.
 *
 * - Neither set            -> false (normal write run; `risk-evidence:run`
 *                             behaviour is unchanged).
 * - Both set & confirmed   -> true  (RECORD_ONLY; the orchestrator skips the
 *                             persist function — no UPSERT occurs).
 * - Any other combination  -> throws `record_only_mode_ambiguous_fails_closed`
 *                             (fail closed: refuse to silently write when
 *                             RECORD_ONLY was partially / inconsistently set).
 */
export function isRiskEvidenceRecordOnlyMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env[RISK_EVIDENCE_RECORD_ONLY_ENV];
  const mode = env[RISK_EVIDENCE_CAPTURE_MODE_ENV];

  const flagSet = typeof flag === 'string' && flag.length > 0;
  const modeSet = typeof mode === 'string' && mode.length > 0;

  // Absence of any RECORD_ONLY signal => normal write run (unchanged).
  if (!flagSet && !modeSet) return false;

  if (flag === RECORD_ONLY_TRUE && mode === CAPTURE_MODE_RECORD_ONLY) return true;

  // A partial / inconsistent RECORD_ONLY request must not silently write.
  throw new Error('record_only_mode_ambiguous_fails_closed');
}

/**
 * Safe, value-free labels describing a RECORD_ONLY suppressed-write run.
 * Booleans/category tokens only — no rows, payloads, or secrets.
 */
export function recordOnlyWriteSuppressedLabels(): string[] {
  return [
    'record_only_write_suppressed_by_flag=true',
    'worker_execution_authorized=false',
  ];
}
