# Risk-Worker RECORD_ONLY Output Capture — BLOCKED (RECORD_ONLY Control Not Proven)

## Status

**Status:** `RISK_WORKER_RECORD_ONLY_CAPTURE_BLOCKED_RECORD_ONLY_CONTROL_NOT_PROVEN`

- **Evidence-only.** **Docs-only.**
- Under a scoped `HELEN RISK WORKER RECORD_ONLY OUTPUT CAPTURE GO`, the fresh
  bounded capture attempt **stopped before worker execution** because the
  **RECORD_ONLY control could not be proven from the current worker source**.
- Repo / base / path preflight **passed**, and the reviewed command path was
  **proven** from current repo artifacts — but the fail-closed RECORD_ONLY
  guard (per the PR #335 plan) **triggered the stop-line** before any worker
  invocation.
- No fresh `run.err` / `run.safe.out` capture pair was created by a worker run;
  no runtime cause was classified; no remediation is authorized.
- **No** worker invocation, classifier execution, raw-output read/print, SQL/psql,
  fix, DB mutation, or Lane/scoring/AMS/customer/Gate4E/Gate4F action occurred.
- **No** DSN value/component, password, token, host, port, raw PostgreSQL error,
  `pg_hba` line, stack trace, exception text, customer payload, raw
  `accepted_events` payload, raw `canonical_jsonb`, `request_id`, `session_id`,
  user identifier, IP, user-agent, header, or body value appears in this
  document.

This PR **records** an already-run, GO-scoped capture attempt that blocked
fail-closed before execution. **This PR reruns nothing**, classifies nothing,
mutates nothing, and authorizes no downstream action.

---

## Evidence chain

- **PR #335** (`cab24b877e17c5207c052ad96840975e879e8517`): merged
  `RISK_WORKER_RECORD_ONLY_OUTPUT_CAPTURE_PLANNING_ONLY` — the candidate
  command-pack plan whose preflight requires (among other gates) **RECORD_ONLY
  mode only** and a **proven reviewed command path**, and which **stops before
  running** if either cannot be confirmed.
- A scoped `HELEN RISK WORKER RECORD_ONLY OUTPUT CAPTURE GO` authorized exactly
  one bounded capture attempt. Preflight passed and the command path was proven,
  but the **RECORD_ONLY control was not proven from the current worker source**
  (`scripts/run-risk-evidence-worker.ts`), so the attempt **correctly stopped
  before invoking the worker** at
  `stop_line=record_only_control_not_proven_from_source`.

Carry-forward (from prior merged evidence): first run `worker_exit_code=1`;
Phase A `diagnostic_result=inconclusive` (PR #333); Phase B
`runtime_output_pair_count=0`, `classifier_execution_attempted=false` (PR #334);
runtime cause `unknown_or_unclassified`.

---

## Evidence labels

```text
record_only_capture_attempted=true
repo_preflight_pass=true
head_equals_pr335_base=true
working_tree_clean=true
package_script_path_proven=true
reviewed_command_path_proven=true
record_only_control_proven=false
stop_line=record_only_control_not_proven_from_source
worker_command_invoked=false
worker_invocation_count=0
raw_output_read=false
raw_output_printed=false
classifier_execution_attempted=false
classifier_execution_count=0
sql_psql_executed=false
fix_executed=false
db_mutation_executed=false
lane_scoring_ams_customer_gate_executed=false
gate4e_executed=false
gate4f_executed=false
diagnostic_result=blocked_before_worker_execution
runtime_cause=unknown_or_unclassified
```

---

## Interpretation

- The attempt **stopped before worker execution**
  (`worker_command_invoked=false`, `worker_invocation_count=0`,
  `diagnostic_result=blocked_before_worker_execution`).
- The **repo / base / path preflight passed** (`repo_preflight_pass=true`,
  `head_equals_pr335_base=true`, `working_tree_clean=true`).
- The **reviewed command path was proven** from current repo artifacts
  (`package_script_path_proven=true`, `reviewed_command_path_proven=true`).
- The **RECORD_ONLY control was not proven** from the current worker source
  (`record_only_control_proven=false`) → the fail-closed guard fired at
  `stop_line=record_only_control_not_proven_from_source`.
- Therefore the run **correctly stopped before invoking the worker** — exactly
  the PR #335 stop-line behavior.
- **No fresh `run.err` / `run.safe.out` capture pair was created by a worker
  run** (the worker never ran).
- **No runtime cause was classified** (`runtime_cause=unknown_or_unclassified`,
  `classifier_execution_attempted=false`).
- This was a **non-execution stop** — `db_mutation_executed=false`,
  `sql_psql_executed=false`, `fix_executed=false`.
- **No remediation is authorized** by this evidence.
- **No** Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action
  occurred.
- **No secret / DSN / raw / customer / request / session / IP / header / body
  value was printed.**

---

## Does NOT authorize

This PR does **NOT** authorize: another capture attempt, a worker run/rerun, a
classifier run, reading/`cat`/`grep`/copying any old or new `run.err` /
`run.safe.out`, any SQL/psql, any DB mutation, any source/config/runtime/DSN/
secret edit, any fix/remediation (including adding or changing a RECORD_ONLY
flag/wrapper), tool installation, or any Lane/scoring/AMS/customer/Gate4E/Gate4F
action. Any next step requires its own separate explicit scoped Helen GO.

---

## Next safe step

The next step is **not** another execution attempt. It should be a **docs-only
source-inspection / command-contract resolution plan** to determine, from
existing repo artifacts only:

- how RECORD_ONLY is intended to be **selected / enforced** for
  `scripts/run-risk-evidence-worker.ts` (e.g. an env flag, a default-on guard, or
  a code-level invariant), and
- whether the command path needs a **separate reviewed wrapper / flag** before
  any capture GO can be retried.

That resolution plan is **planning-only** (no execution, no source edit) and
would itself be reviewed/merged before any new
`HELEN RISK WORKER RECORD_ONLY OUTPUT CAPTURE GO` is reconsidered. No worker run,
classifier, fix, or downstream/Gate action is implied or authorized.

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
contents. The worker **never ran**, so no fresh captured output exists; no old
captured output was read, `cat`-ed, `grep`-ed, copied, or inspected. Only safe
**stop-line tokens**, **booleans**, **zero counts**, and **category tokens** are
recorded. `RISK_WORKER_DSN` / `DATABASE_URL` are not present as values (env-var
names only where referenced); the custody path `/etc/buyerrecon/risk-worker.env`
is a **non-secret path** whose contents were not read. The `package.json` script
name (`risk-evidence:run`), the `scripts/*.ts` path
(`scripts/run-risk-evidence-worker.ts`), the role name
(`buyerrecon_risk_worker`), the database name (`buyerrecon_production`), the repo
path (`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
identifiers. All values above are safe labels / booleans / zero counts / category
tokens / non-secret identifiers / a public git commit hash — not secret or row
values. **This PR runs nothing.**
