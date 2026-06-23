/**
 * Sprint 3 — static contract test for the RECORD_ONLY write-path refactor.
 *
 * STATIC / FILE-READ ONLY. This test imports only node:fs + node:assert and
 * reads source files as text. It does NOT import or execute the worker or the
 * wrapper, does not touch the DB, and runs no worker/classifier/capture.
 *
 * Invariants proven (Step 2 of the RECORD_ONLY write-path refactor plan):
 *  - package script risk-evidence:run remains unchanged
 *  - package script risk-evidence:record-only remains the dedicated wrapper
 *  - UPSERT_SQL is referenced only by persistRiskEvidenceCandidates(...)
 *  - the record-only branch does NOT call persistRiskEvidenceCandidates(...)
 *  - the normal run path reaches a write ONLY via persistRiskEvidenceCandidates
 *  - the wrapper fails closed when RECORD_ONLY is absent
 *  - no new write SQL constant / classifier / capture path is introduced
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const worker = fs.readFileSync('src/scoring/risk-evidence/worker.ts', 'utf8');
const recordOnly = fs.readFileSync('src/scoring/risk-evidence/record-only.ts', 'utf8');
const wrapperPath = 'scripts/run-risk-evidence-record-only-worker.ts';
const wrapper = fs.readFileSync(wrapperPath, 'utf8');

/* 1. package scripts ------------------------------------------------------ */
assert.equal(
  pkg.scripts['risk-evidence:run'],
  'tsx scripts/run-risk-evidence-worker.ts',
  'risk-evidence:run must remain unchanged',
);
assert.equal(
  pkg.scripts['risk-evidence:record-only'],
  'tsx scripts/run-risk-evidence-record-only-worker.ts',
  'risk-evidence:record-only must remain the dedicated wrapper',
);

/* 2. function regions in worker.ts ---------------------------------------- */
const persistIdx = worker.indexOf('export async function persistRiskEvidenceCandidates');
const orchestratorIdx = worker.indexOf('export async function runRiskEvidenceWorker');
assert.ok(persistIdx > -1, 'persistRiskEvidenceCandidates must be defined');
assert.ok(orchestratorIdx > persistIdx, 'runRiskEvidenceWorker must follow the persist function');
assert.ok(
  worker.includes('export function buildRiskEvidenceCandidates'),
  'buildRiskEvidenceCandidates compute path must be defined',
);

const persistBody = worker.slice(persistIdx, orchestratorIdx);
const orchestratorBody = worker.slice(orchestratorIdx);

/* 3. UPSERT_SQL referenced only by the persist function ------------------- */
// The query usage form is `UPSERT_SQL,` (passed as the first pool.query arg).
// Exactly one such usage, and it must live inside the persist function.
const upsertUsages = worker.match(/UPSERT_SQL,/g) || [];
assert.equal(upsertUsages.length, 1, 'UPSERT_SQL must be used exactly once (a single query site)');
assert.ok(persistBody.includes('UPSERT_SQL,'), 'the UPSERT_SQL usage must live in the persist function');
assert.ok(
  !orchestratorBody.includes('UPSERT_SQL'),
  'the orchestrator must NOT reference UPSERT_SQL directly',
);

/* 4. record-only branch does not call persist; normal branch does --------- */
const ifIdx = orchestratorBody.indexOf('if (record_only)');
const elseIdx = orchestratorBody.indexOf('} else {', ifIdx);
const persistCall = 'persistRiskEvidenceCandidates(pool, candidates)';
const persistCallIdx = orchestratorBody.indexOf(persistCall);
assert.ok(ifIdx > -1, 'orchestrator must branch on record_only');
assert.ok(elseIdx > ifIdx, 'orchestrator must have an else branch for the write path');
assert.ok(persistCallIdx > elseIdx, 'persist must be called only in the non-record-only (else) branch');
// the record-only branch (between `if (record_only)` and `} else {`) must NOT call persist.
const recordOnlyBranch = orchestratorBody.slice(ifIdx, elseIdx);
assert.ok(
  !recordOnlyBranch.includes('persistRiskEvidenceCandidates('),
  'the record-only branch must NOT call persistRiskEvidenceCandidates(...)',
);
// persist is called exactly once in the orchestrator (the single write site).
const persistCallCount = (orchestratorBody.match(/persistRiskEvidenceCandidates\(pool, candidates\)/g) || []).length;
assert.equal(persistCallCount, 1, 'persist must be called exactly once, in the else branch');

/* 5. RECORD_ONLY gate derives from the env helper ------------------------- */
assert.ok(
  worker.includes('isRiskEvidenceRecordOnlyMode'),
  'worker must derive RECORD_ONLY mode via isRiskEvidenceRecordOnlyMode()',
);
assert.ok(
  recordOnly.includes('RISK_EVIDENCE_RECORD_ONLY') && recordOnly.includes('RISK_EVIDENCE_CAPTURE_MODE'),
  'record-only helper must use the established env convention',
);
assert.ok(
  recordOnly.includes('record_only_mode_ambiguous_fails_closed'),
  'record-only helper must fail closed on an ambiguous partial request',
);

/* 6. wrapper fails closed when RECORD_ONLY is absent ---------------------- */
assert.ok(wrapper.includes('failClosed'), 'wrapper must define a fail-closed path');
assert.ok(wrapper.includes('process.exit(2)'), 'wrapper must exit non-zero on fail-closed');
assert.ok(
  wrapper.includes("process.env.RISK_EVIDENCE_RECORD_ONLY") &&
    wrapper.includes("process.env.RISK_EVIDENCE_CAPTURE_MODE"),
  'wrapper must set both RECORD_ONLY env vars',
);

/* 7. no NEW write-SQL constant introduced --------------------------------- */
// Exactly the two known SQL constants: SELECT_SQL and UPSERT_SQL. No third.
const sqlConsts = (worker.match(/const\s+[A-Z0-9_]*SQL\s*=/g) || []).sort();
assert.deepEqual(
  sqlConsts,
  ['const SELECT_SQL =', 'const UPSERT_SQL ='],
  'no new *_SQL constant may be introduced in the worker',
);
// the new record-only helper introduces no classifier/capture/lane/gate path.
for (const forbidden of ['classifier', 'capture', 'scoring_output_lane', 'Gate4E', 'Gate4F', 'INSERT INTO']) {
  assert.ok(
    !recordOnly.includes(forbidden),
    `record-only helper must not introduce a '${forbidden}' path`,
  );
}

console.log('risk-evidence-record-only-write-path-refactor.contract: PASS');
