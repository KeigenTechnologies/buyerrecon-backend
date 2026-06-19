# Step2E Execution Blocked / Failed

## Status

**Status:** `STEP2E_EXECUTION_BLOCKED_OR_FAILED`

- **Evidence-only.** **Docs-only.**
- Under a fresh scoped `HELEN STEP2E EXECUTION GO`, targeted discovery confirmed the reviewed
  Step2E command (`extract:behavioural-features = tsx scripts/extract-behavioural-features.ts`), and
  **exactly one** Step2E command was run. The command **exited nonzero**.
- Captured stdout/stderr were **not printed** and were **removed by the wrapper**, so the **failure
  class is unknown**.
- No rerun; no fix applied; Stage0 not rerun; Route C not rerun; no auth retry; no grants/role
  changes; no worker/downstream-extractor/Lane/scoring/AMS/customer-output; no Gate4E/Gate4F.
- **No** DSN, password, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, or user identifier appears in this document.

This PR **records** an already-run, GO-scoped Step2E attempt. **This PR reruns nothing**, applies no
fix, and authorizes no rerun.

---

## Evidence chain

- **PR #310** (`33e47d142743d254e1b295b0e9896121c2508625`): recorded post-Stage0 evidence inspection
  PASS with `step2e_readiness_candidate=true`.
- A fresh scoped `HELEN STEP2E EXECUTION GO` authorized exactly one Step2E command after confirming
  the reviewed command.

Reviewed Step2E command (confirmed by targeted discovery; non-secret repo identifier):

```text
extract:behavioural-features = tsx scripts/extract-behavioural-features.ts
```

---

## Evidence labels

```text
step2e_execution_attempted=true
pr310_merge_present=true
tracked_working_tree_clean=true
step2e_command_identified=true
step2e_command_shape=DATABASE_URL_STAGE0_RUNNER_DSN_npm_run_extract_behavioural_features
step2e_required_dsn_available=true
step2e_command_executed=true
step2e_command_attempts=1
step2e_command_exit_code=nonzero
step2e_execution_result=blocked_or_failed
db_mutation_executed=unknown
stage0_rerun_executed=false
route_c_rerun_executed=false
auth_retry_executed=false
grants_or_role_changes_executed=false
workers_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

---

## Interpretation

- Step2E readiness was supported by PR #310, but the **first Step2E execution attempt exited
  nonzero**.
- The **reviewed command was identified and executed exactly once**
  (`step2e_command_identified=true`, `step2e_command_attempts=1`).
- Because **raw stdout/stderr were not printed and were removed by the wrapper**, the **failure
  class is `unknown`**.
- `db_mutation_executed=unknown` because the command exited nonzero and **no post-run mutation proof
  was run**.
- **No rerun occurred.**
- **No fix was applied.**
- **Stage0 was not rerun.**
- **Route C was not rerun.**
- **No auth retry occurred.**
- **No grants or role changes occurred.**
- **No worker, downstream extractor, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F
  action occurred.**
- **No secret / raw / customer / request / session values were printed.**
- This evidence **does not authorize a rerun or fix**.
- The **next valid step is a separate decision** on either a **safe failure-localization preflight**
  or a **separately scoped rerun with sanitized error classification** — each under its own explicit
  scoped Helen GO.

---

## Does NOT authorize

This PR does **NOT** authorize: a Step2E rerun, a Stage0 rerun, a Route C rerun, an auth retry, any
fix or remediation, DB mutation, GRANT/REVOKE or role change, credential rotation, custody rewrite,
DSN discovery, host/port discovery, `.env.production` inspection, `pg_hba` inspection, workers,
downstream extractors, Lane/scoring, AMS runtime, customer output, Gate4E, Gate4F, deploy, or
runtime command. Any failure-localization preflight or rerun requires its own separate explicit
scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, customer row data, **raw psql output, raw PostgreSQL error text**,
**raw stdout/stderr** of the failed command, env-var value, or customer data. The captured
stdout/stderr were withheld and removed by the wrapper; only the safe `nonzero` exit-class label is
recorded. The `package.json` **script name** and `scripts/*.ts` **file path** shown are non-secret
repository identifiers; the `step2e_command_shape` value is a **safe token form of the command**
(the actual `STAGE0_RUNNER_DSN` value was bound from a hidden current-shell variable and was **never
printed, echoed, committed, or stored**); the recorded commit hash is **public**. All values above
are safe labels / booleans / category tokens / non-secret identifiers / a public git commit hash —
not secret or row values. **This PR runs nothing.**
