# First Internal Risk-Worker Run — BLOCKED (Worker Exit Nonzero)

## Status

**Status:** `RISK_WORKER_FIRST_INTERNAL_RUN_BLOCKED_WORKER_EXIT_NONZERO`

- **Evidence-only.** **Docs-only.**
- Under a scoped `HELEN RISK WORKER FIRST INTERNAL RECORD_ONLY RUN GO`, **exactly
  one** bounded internal risk-worker execution was attempted via the PR #328
  command-pack path using `RISK_WORKER_ROLE=buyerrecon_risk_worker`.
- **Preflight passed** (role readiness, required privileges, unwanted-privilege
  absence, input-table presence + nonzero counts) and **custody was available**
  from the `root_only_env_file` source; `DATABASE_URL` was bound for the
  controlled worker shell.
- The existing command resolved (`npm run risk-evidence:run`); the worker was
  **started exactly once** and **exited nonzero** (`worker_exit_code=1`). The run
  **stopped at `STOP_LINE=worker_exit_nonzero` without retry**.
- Worker stdout/stderr were **not printed**; `run.safe.out` was **not copied**
  into evidence. No raw error, raw row, payload, `canonical_jsonb`, identifier,
  DSN, credential, host, port, `pg_hba`, or customer data was printed.
- No Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action
  occurred.

This PR **records** an already-run, GO-scoped first-run attempt that blocked on a
nonzero worker exit. **This PR reruns nothing**, diagnoses nothing, mutates
nothing, and authorizes no downstream action.

---

## Evidence chain

- **PR #330** (`b99036873b76f47c37b1ad50a86254a1a9f51292`): merged
  `RISK_WORKER_DSN_CUSTODY_PRESENCE_PROOF_PASS` — custody source/key presence
  confirmed (`/etc/buyerrecon/risk-worker.env`, key `RISK_WORKER_DSN`).
- **PR #328** (`RISK_WORKER_FIRST_INTERNAL_RUN_COMMAND_PACK_PLANNING_ONLY`):
  defined the bounded internal first-run command pack (resolved command
  `npm run risk-evidence:run`; readiness gate; exactly-one run; post-run
  aggregate proof; stop-lines).
- A scoped `HELEN RISK WORKER FIRST INTERNAL RECORD_ONLY RUN GO` authorized
  exactly one bounded internal run; it reached worker execution and the worker
  exited nonzero, triggering the `worker_exit_nonzero` stop-line.

---

## Evidence labels

```text
risk_worker_first_internal_run_attempted=true
pr330_merge_present=true
tracked_working_tree_clean=true
risk_worker_role_constant_present=true
risk_worker_role_constant_value=buyerrecon_risk_worker
candidate_role=buyerrecon_risk_worker
candidate_role_exists=true
candidate_role_can_login=true
required_privileges_pass=true
unwanted_privileges_absent=true
risk_worker_dsn_source_category=root_only_env_file
risk_worker_dsn_key_present=true
approved_secret_custody_available=true
worker_command_resolved=true
database_url_bound_for_worker=true
database_url_value_printed=false
worker_execution_started=true
worker_execution_count=1
worker_exit_code=1
STOP_LINE=worker_exit_nonzero
worker_execution_result=blocked_or_failed
risk_observations_count_after_present=false
risk_observations_count_delta_class=unknown
db_mutation_executed=unknown
role_or_grant_change_executed=false
stage0_rerun_executed=false
step2e_rerun_executed=false
route_c_rerun_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
credential_printed=false
host_port_printed=false
env_file_value_printed=false
worker_stdout_printed=false
worker_stderr_printed=false
run_safe_out_copied_to_evidence=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

### Pre-run labels that passed (recorded for context)

```text
candidate_role_superuser=false
candidate_role_createdb=false
candidate_role_createrole=false
candidate_role_replication=false
candidate_role_bypassrls=false
risk_worker_stage0_decisions_select_privilege=true
risk_worker_session_behavioural_features_select_privilege=true
risk_worker_risk_observations_insert_privilege=true
risk_worker_risk_observations_update_privilege=true
risk_worker_unwanted_delete_privilege=false
risk_worker_unwanted_truncate_privilege=false
risk_worker_unwanted_references_privilege=false
risk_worker_unwanted_trigger_privilege=false
stage0_decisions_table_present=true
session_behavioural_features_table_present=true
risk_observations_table_present=true
stage0_decisions_nonzero_count=true
session_behavioural_features_nonzero_count=true
risk_observations_count_before_present=true
```

---

## Interpretation

- This was the **first internal risk-worker run attempt**.
- The run **reached worker execution** (preflight, custody, binding, and command
  resolution all succeeded).
- **Exactly one** worker execution occurred (`worker_execution_count=1`); **no
  retry**.
- The worker **exited nonzero** with safe exit code `1` (`worker_exit_code=1`).
- The process **stopped at `worker_exit_nonzero`**; the result is
  **`blocked_or_failed`**.
- Because the **post-run aggregate proof did not complete**,
  **`db_mutation_executed` remains `unknown`** (the RECORD_ONLY worker may or may
  not have upserted before exiting; row-level detail was intentionally not read).
- This evidence **does not identify the underlying error cause** — raw worker
  stdout/stderr were **intentionally not printed or copied**
  (`worker_stdout_printed=false`, `worker_stderr_printed=false`,
  `run_safe_out_copied_to_evidence=false`).
- This evidence **does not authorize a rerun**.
- This evidence **does not authorize diagnostics** unless separately
  reviewed / GO-gated.
- This evidence **does not authorize** grants, role changes, SQL fixes, source
  fixes, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F.
- **No secret / DSN / raw / customer / request / session / IP / header / body
  value was printed.**

---

## Does NOT authorize

This PR does **NOT** authorize: a risk-worker rerun, any diagnostic of the
nonzero exit (which requires its own separate review/GO), reading or printing
worker stdout/stderr or `run.safe.out`/`run.err`, any SQL/psql, any DB mutation,
any GRANT/REVOKE/role change, any source/script/config fix, custody value
read/parse, Stage0/Step2E/Route C reruns, downstream extractors, Lane/scoring,
AMS runtime, customer output, Gate4E, Gate4F, deploy, or runtime command. Any
next step (diagnosis, rerun, or fix) requires its own separate explicit scoped
Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, generated password, DSN URI, connection string, raw
secret-manager payload, service-file content, `.env.production` or
`risk-worker.env` content/value, token, private key, IP address, host value,
port value, real URI, login source, **raw `pg_hba` lines**, raw `accepted_events`
payload, raw `canonical_jsonb`, real `session_id` / `request_id` / user
identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, **worker stdout/stderr**, `run.safe.out` /
`run.err` contents, or env-var value. The worker's captured stdout/stderr were
written to private temp files and **not printed or copied**; only the safe
**exit code** (`1`), **stop-line token**, **booleans**, and **category tokens**
are recorded. `RISK_WORKER_DSN` and `DATABASE_URL` appear as **env-var names
only**; the custody path `/etc/buyerrecon/risk-worker.env` is a **non-secret
path** whose contents were not read or shown. The role names
(`buyerrecon_risk_worker`, etc.), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the `package.json` script name (`risk-evidence:run`),
the repo path (`/opt/buyerrecon-backend`), and the recorded commit hash are
**non-secret** identifiers. All values above are safe labels / booleans / a safe
exit integer / category tokens / non-secret identifiers / a public git commit
hash — not secret or row values. **This PR runs nothing.**
