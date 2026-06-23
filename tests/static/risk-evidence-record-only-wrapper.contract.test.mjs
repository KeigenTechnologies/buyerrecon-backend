import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const wrapperPath = 'scripts/run-risk-evidence-record-only-worker.ts';
const wrapper = fs.readFileSync(wrapperPath, 'utf8');

assert.equal(
  pkg.scripts['risk-evidence:record-only'],
  'tsx scripts/run-risk-evidence-record-only-worker.ts',
  'risk-evidence:record-only package script must point to the dedicated wrapper'
);

assert.match(wrapper, /RISK_EVIDENCE_RECORD_ONLY/);
assert.match(wrapper, /RISK_EVIDENCE_CAPTURE_MODE/);
assert.match(wrapper, /RECORD_ONLY/);
assert.match(wrapper, /failClosed/);
assert.match(wrapper, /record_only_mode_confirmed=false/);
assert.match(wrapper, /worker_execution_authorized=false/);
assert.match(wrapper, /await import\('\.\/run-risk-evidence-worker'\)/);

console.log('record_only_wrapper_static_contract_pass=true');
