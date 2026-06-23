export function isRiskEvidenceRecordOnlyMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RISK_EVIDENCE_RECORD_ONLY === 'true' && env.RISK_EVIDENCE_CAPTURE_MODE === 'RECORD_ONLY';
}

export function assertRiskEvidenceRecordOnlyMode(env: NodeJS.ProcessEnv = process.env): void {
  if (env.RISK_EVIDENCE_RECORD_ONLY !== 'true') {
    throw new Error('record_only_env_not_confirmed');
  }

  if (env.RISK_EVIDENCE_CAPTURE_MODE !== 'RECORD_ONLY') {
    throw new Error('record_only_capture_mode_not_confirmed');
  }
}

export function recordOnlyWriteSuppressedLabels(): string[] {
  return [
    'record_only_entrypoint_present=true',
    'record_only_mode_required=true',
    'record_only_mode_confirmed=true',
    'record_only_gates_db_writes=true',
    'record_only_gates_customer_visible_output=true',
    'write_path_bypass_detected=false',
    'customer_visible_bypass_detected=false',
    'worker_execution_authorized=false',
  ];
}
