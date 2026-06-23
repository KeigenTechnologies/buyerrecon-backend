import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const wrapper = fs.readFileSync('scripts/run-risk-evidence-record-only-worker.ts', 'utf8');
const helper = fs.readFileSync('src/scoring/risk-evidence/record-only.ts', 'utf8');
const worker = fs.readFileSync('src/scoring/risk-evidence/worker.ts', 'utf8');

assert.equal(
  pkg.scripts['risk-evidence:record-only'],
  'tsx scripts/run-risk-evidence-record-only-worker.ts',
  'record-only command must point to dedicated wrapper'
);

assert.equal(
  pkg.scripts['risk-evidence:run'],
  'tsx scripts/run-risk-evidence-worker.ts',
  'normal risk-evidence:run command must remain unchanged'
);

assert.match(wrapper, /RISK_EVIDENCE_RECORD_ONLY/);
assert.match(wrapper, /RISK_EVIDENCE_CAPTURE_MODE/);
assert.match(wrapper, /assertRiskEvidenceRecordOnlyMode/);

assert.match(helper, /isRiskEvidenceRecordOnlyMode/);
assert.match(helper, /RISK_EVIDENCE_RECORD_ONLY === 'true'/);
assert.match(helper, /RISK_EVIDENCE_CAPTURE_MODE === 'RECORD_ONLY'/);
assert.match(helper, /recordOnlyWriteSuppressedLabels/);
assert.match(helper, /record_only_gates_db_writes=true/);
assert.match(helper, /record_only_gates_customer_visible_output=true/);
assert.match(helper, /write_path_bypass_detected=false/);
assert.match(helper, /customer_visible_bypass_detected=false/);

assert.match(worker, /isRiskEvidenceRecordOnlyMode/);
assert.match(worker, /recordOnlyWriteSuppressedLabels/);
assert.match(worker, /record_only_write_suppressed_by_flag=true/);

console.log('record_only_flag_consumption_static_contract_pass=true');
