# Risk-Worker RECORD_ONLY Flag-Consumption Implementation — BLOCKED

## Status

**Status:** `RISK_WORKER_RECORD_ONLY_FLAG_CONSUMPTION_IMPLEMENTATION_BLOCKED`

- **Evidence-only.** **Docs-only.**
- A Step-2 implementation attempt to make the risk-evidence worker **consume** the
  RECORD_ONLY flag (so all DB-write / customer-visible paths are gated) **failed
  before safely patching** `src/scoring/risk-evidence/worker.ts`.
- The patcher stopped at `stop_line=write_path_pattern_not_patchable_safely`: it
  could not safely gate the UPSERT / write path. The branch
  (`buyerrecon-risk-worker-record-only-flag-consumption`) committed **partial**
  files anyway (a helper + a wrapper assertion + a static test), but the worker
  was **not** patched and the static flag-consumption contract test **failed**.
- **PR #344 overclaimed** — its title/body said the worker consumes the
  RECORD_ONLY flag, but it does not. **PR #344 is not mergeable and has been
  closed as blocked / superseded.**
- This was a **failed/blocked source implementation attempt, not a runtime
  result** — no worker run, no capture, no classifier, no SQL/psql, no DB
  mutation, no deploy, no production touch, no Lane/scoring/AMS/customer/Gate
  action.
- **No** DSN value/component, password, token, host, port, raw PostgreSQL error,
  `pg_hba` line, stack trace, customer payload, raw `accepted_events` payload,
  raw `canonical_jsonb`, `request_id`, `session_id`, user identifier, IP,
  user-agent, header, body value, or `run.err`/`run.safe.out` content appears in
  this document.

This PR **records** the blocked Step-2 attempt. **This PR patches no code,
implements nothing, runs nothing, and authorizes no downstream action.**

---

## Evidence chain

- **PR #342** (`RISK_WORKER_RECORD_ONLY_WRAPPER_IMPLEMENTATION_PLANNING_ONLY`):
  planned the minimal RECORD_ONLY wrapper implementation; Step 1 = wrapper, Step
  2 = make the worker consume the flag with static proof, Step 3 = capture GO.
- **PR #343** (`feat: add RECORD_ONLY risk evidence wrapper command`, merged):
  added the dedicated `risk-evidence:record-only` wrapper + a static contract
  test; explicitly **did not** prove downstream gating (the worker does not yet
  consume the flag).
- **Step-2 attempt** (this evidence): an implementation attempt to make the
  worker consume the flag **blocked** at
  `write_path_pattern_not_patchable_safely`; PR #344 committed partial files but
  did not patch the worker and the static test failed. PR #344 closed as blocked.

---

## Evidence labels

```text
implementation_attempted=true
implementation_branch=buyerrecon-risk-worker-record-only-flag-consumption
partial_pr=344
partial_pr_closed=true
stop_line=write_path_pattern_not_patchable_safely
static_test_failed=true
worker_consumes_record_only_flag=false
record_only_helper_created_on_partial_branch=true
wrapper_assertion_created_on_partial_branch=true
worker_patch_applied=false
worker_execution_authorized=false
worker_run_executed=false
risk_evidence_run_executed=false
risk_evidence_record_only_executed=false
classifier_execution_attempted=false
capture_executed=false
raw_output_read=false
sql_psql_executed=false
db_mutation_executed=false
deploy_executed=false
lane_scoring_ams_customer_gate_executed=false
runtime_cause=unknown_or_unclassified
```

---

## Interpretation

- This was a **failed / blocked source implementation attempt**, **not** a
  runtime result (`worker_run_executed=false`, `risk_evidence_run_executed=false`,
  `risk_evidence_record_only_executed=false`, `capture_executed=false`).
- The patcher **could not safely gate the UPSERT / write path**
  (`stop_line=write_path_pattern_not_patchable_safely`,
  `worker_patch_applied=false`).
- The partial branch created a **partial implementation** — a record-only helper
  and a wrapper assertion (`record_only_helper_created_on_partial_branch=true`,
  `wrapper_assertion_created_on_partial_branch=true`) — but **did not prove
  RECORD_ONLY gating**.
- The **failing static test confirms the worker does not consume the flag**
  (`static_test_failed=true`, `worker_consumes_record_only_flag=false`).
- **PR #344 must remain unmerged** — it overclaimed flag consumption that does
  not exist; it has been **closed as blocked / superseded**
  (`partial_pr=344`, `partial_pr_closed=true`).
- **No capture GO may proceed.** `worker_execution_authorized=false`;
  `runtime_cause=unknown_or_unclassified` (unchanged).
- **No secret / DSN / raw / customer / request / session / IP / header / body /
  `run.err` / `run.safe.out` value was printed.**
- **Next safe step:** a **separate docs-only planning PR** for a more careful
  worker refactor / design that can gate the write path safely — **or stop**.
  No code patch, no worker run, no capture is authorized by this evidence.

---

## Does NOT authorize

This PR does **NOT** authorize: re-attempting the worker patch, any further code
change to `src/scoring/risk-evidence/worker.ts` or elsewhere, merging or
reopening PR #344, a worker run/rerun, `risk-evidence:run`,
`risk-evidence:record-only`, a classifier run, a capture, reading/`cat`/`grep`/
copying any `run.err`/`run.safe.out`, any SQL/psql, any DB mutation, any deploy
or production touch, or any Lane/scoring/AMS/customer/Gate4E/Gate4F action. Any
next step (a careful refactor design, a new implementation attempt, or a stop
decision) requires its own separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, **raw
`pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, **raw psql output, raw PostgreSQL error text**, **stack trace
/ exception text**, **worker stdout/stderr**, or `run.safe.out` / `run.err`
contents. No worker, capture, or test was run for this evidence; the partial
PR #344 branch is referenced by **name only** and its file contents are not
reproduced here. The env-var **names** (`RISK_EVIDENCE_RECORD_ONLY`,
`RISK_EVIDENCE_CAPTURE_MODE`), the `package.json` script names
(`risk-evidence:run`, `risk-evidence:record-only`), the `scripts/*.ts` paths, the
module path (`src/scoring/risk-evidence/worker.ts`), the role name
(`buyerrecon_risk_worker`), the table name (`risk_observations_v0_1`), the
database name (`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`),
and the recorded commit hash are **non-secret** identifiers. All values above are
safe labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
