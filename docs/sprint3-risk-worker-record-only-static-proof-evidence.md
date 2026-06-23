# Sprint 3 - RECORD_ONLY Risk Evidence Static Proof Evidence

**Status:** `RISK_WORKER_RECORD_ONLY_STATIC_PROOF_EVIDENCE`

This is a **docs-only static proof evidence** record for the risk-evidence
RECORD_ONLY gating path. It records proof from tracked source and static test
artifacts only. It does not run the worker, `risk-evidence:run`,
`risk-evidence:record-only`, a classifier, capture, SQL/psql, DB mutation,
deploy, production touch, Lane/scoring, AMS runtime, customer output, Gate4E, or
Gate4F.

This static proof evidence does not authorize capture.
A future capture GO remains separate and must be explicitly scoped.

---

## Trusted Base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=5638cccc09535ad0424067983f900d3709ea6969
```

---

## Allowed Static Inputs

```text
package.json
scripts/run-risk-evidence-record-only-worker.ts
src/scoring/risk-evidence/record-only.ts
src/scoring/risk-evidence/worker.ts
src/scoring/risk-evidence/index.ts
tests/static/risk-evidence-record-only-wrapper.contract.test.mjs
tests/static/risk-evidence-record-only-write-path-refactor.contract.test.mjs
```

No runtime output files were inspected. No old or new `run.err` /
`run.safe.out` was read, copied, grepped, or reproduced.

---

## Evidence Chain

```text
pr343_record_only_wrapper_merged=true
pr347_write_path_refactor_merged=true
record_only_wrapper_command_present=true
record_only_static_contract_tests_present=true
worker_runtime_execution_performed=false
capture_execution_performed=false
classifier_execution_performed=false
```

PR #343 added the dedicated `risk-evidence:record-only` wrapper command. PR #347
merged the careful write-path refactor that isolates persistence behind
`persistRiskEvidenceCandidates(...)` and routes RECORD_ONLY mode through compute
and safe counts while skipping persistence.

---

## Static Proof Findings

```text
record_only_entrypoint_present=true
record_only_flag_or_wrapper_present=true
record_only_absence_fails_closed=true
record_only_gates_db_writes=true
record_only_gates_customer_visible_output=true
persist_function_single_entrypoint=true
all_upsert_sql_confined_to_persist_function=true
record_only_path_does_not_call_persist_function=true
normal_risk_evidence_run_unchanged=true
write_path_bypass_detected=false
customer_visible_bypass_detected=false
capture_command_reviewed=true
worker_execution_authorized=false
capture_go_authorized=false
```

Static source inspection confirms:

- `risk-evidence:run` remains mapped to `tsx scripts/run-risk-evidence-worker.ts`.
- `risk-evidence:record-only` remains mapped to the dedicated wrapper
  `tsx scripts/run-risk-evidence-record-only-worker.ts`.
- The wrapper sets both RECORD_ONLY env-var names before importing worker logic
  and fails closed if it cannot confirm them.
- `isRiskEvidenceRecordOnlyMode(...)` returns true only when both RECORD_ONLY
  env-var names are explicitly confirmed; partial or inconsistent requests throw
  `record_only_mode_ambiguous_fails_closed`.
- `buildRiskEvidenceCandidates(...)` is the compute/candidate path and does not
  call the persist function.
- `persistRiskEvidenceCandidates(...)` is the single UPSERT entrypoint.
- The only `UPSERT_SQL` query usage is inside
  `persistRiskEvidenceCandidates(...)`.
- The RECORD_ONLY branch in `runRiskEvidenceWorker(...)` sets
  `record_only_write_suppressed=true`, leaves `upserted_rows=0`, and does not
  call `persistRiskEvidenceCandidates(...)`.
- The normal non-RECORD_ONLY branch remains write-capable only through
  `persistRiskEvidenceCandidates(...)`.
- The static proof artifacts introduce no classifier, capture, Lane/scoring,
  AMS runtime, customer output, Gate4E, or Gate4F path.

---

## Result Semantics

```text
candidate_count_safe_count_only=true
record_only_result_label_safe=true
record_only_write_suppressed_label_safe=true
normal_upserted_rows_semantics_preserved=true
record_only_upserted_rows_claims_no_db_write=true
raw_row_output_emitted=false
raw_runtime_output_emitted=false
```

`candidate_count`, `record_only`, and `record_only_write_suppressed` are safe
summary fields. In normal mode, `upserted_rows` remains the count returned after
the persist function runs. In RECORD_ONLY mode, `upserted_rows=0` reflects that
persistence was skipped and must not be read as a database-write count.

---

## Validation

```text
git_diff_check_passed=true
check_constants_passed=true
tsc_no_emit_passed=true
wrapper_static_contract_test_passed=true
write_path_refactor_static_contract_test_passed=true
validation_runtime_worker_executed=false
validation_sql_psql_executed=false
validation_db_mutation_executed=false
```

Validation commands used:

```text
git diff --check
npm run check:constants
npx tsc --noEmit
node tests/static/risk-evidence-record-only-wrapper.contract.test.mjs
node tests/static/risk-evidence-record-only-write-path-refactor.contract.test.mjs
git status --short
```

All validation remained static/file-read or type-check only. The static contract
tests read files and assert source text; they do not import or execute the
worker, wrapper, npm scripts, DB/runtime path, or capture path.

---

## Explicit Non-Authorization

This PR does **not** authorize:

```text
worker execution
risk-evidence:run
risk-evidence:record-only
classifier execution
capture execution
raw runtime output read/cat/grep/copy
run.err read/cat/grep/copy
run.safe.out read/cat/grep/copy
SQL/psql
DB mutation
deploy
production touch
Lane/scoring/AMS/customer/Gate4E/F
```

Merging this static proof evidence changes no runtime behavior and authorizes no
execution.

---

## Safety / Raw-Data Boundary

This record contains no secret value, no DSN value or DSN component, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, raw
`pg_hba` lines, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, raw psql output, raw PostgreSQL error text, stack trace /
exception text, worker stdout/stderr, or `run.safe.out` / `run.err` contents.

The env-var names (`RISK_EVIDENCE_RECORD_ONLY`, `RISK_EVIDENCE_CAPTURE_MODE`),
the `package.json` script names (`risk-evidence:run`,
`risk-evidence:record-only`), the module paths, the table name
(`risk_observations_v0_1`), the database name (`buyerrecon_production`), and
the recorded commit hash are non-secret identifiers. All values above are safe
labels, booleans, category tokens, non-secret identifiers, or a public git
commit hash. This PR runs nothing.

---

## Next Safe Step

Review and merge this docs-only static proof evidence PR if approved. Capture is
still blocked until a separate future Step 4 capture GO is explicitly scoped
after this evidence is reviewed and merged.
