# Step2E Correct-Identity Rerun Blocked / Failed

## Status

**Status:** `STEP2E_CORRECT_IDENTITY_RERUN_BLOCKED_OR_FAILED`

- **Evidence-only.** **Docs-only.**
- Under a fresh scoped `HELEN STEP2E CORRECT-IDENTITY RERUN GO`, the reviewed Step2E command
  (`extract:behavioural-features = tsx scripts/extract-behavioural-features.ts`) was run **exactly
  once** with `DATABASE_URL` bound to the **intended collector/extractor app identity**
  (`buyerrecon_prod_collector_app`, via the hidden `COLLECTOR_EXTRACTOR_DSN`). The command
  **exited nonzero**.
- The command **did not** use `STAGE0_RUNNER_DSN`.
- Captured stdout/stderr were **not printed**, so the **failure class is unknown**.
- No rerun; no fix applied; Stage0 not rerun; Route C not rerun; no auth retry; no grants/role
  changes; no worker/downstream-extractor/Lane/scoring/AMS/customer-output; no Gate4E/Gate4F.
- **No** DSN, password, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, or user identifier appears in this document.

This PR **records** an already-run, GO-scoped Step2E correct-identity attempt. **This PR reruns
nothing**, applies no fix, and authorizes no rerun.

---

## Evidence chain

- **PR #312** (`a6cc774d56bdbf3727bbe90b0be504f1c1c2edc1`): localized the first Step2E nonzero
  (PR #311) to **wrong execution identity or missing behavioural-extractor privileges** on
  `buyerrecon_stage0_runner`.
- **Static identity discovery** then established the intended Step2E identity is the
  **collector/extractor app role** `buyerrecon_prod_collector_app` (the role that writes
  `accepted_events` and behavioural features), **not** `buyerrecon_stage0_runner`.
- A fresh scoped `HELEN STEP2E CORRECT-IDENTITY RERUN GO` authorized exactly one Step2E command
  under the correct identity.

Reviewed Step2E command (confirmed by static discovery; non-secret repo identifier):

```text
extract:behavioural-features = tsx scripts/extract-behavioural-features.ts
```

Executed command shape (safe token form; the actual DSN value was bound from a hidden current-shell
variable and was **never printed, echoed, committed, or stored**):

```text
DATABASE_URL="$COLLECTOR_EXTRACTOR_DSN" npm run extract:behavioural-features
```

---

## Evidence labels

```text
step2e_correct_identity_rerun_attempted=true
pr312_merge_present=true
tracked_working_tree_clean=true
step2e_command_identified=true
step2e_command_shape=DATABASE_URL_COLLECTOR_EXTRACTOR_DSN_npm_run_extract_behavioural_features
step2e_execution_identity=buyerrecon_prod_collector_app
used_stage0_runner_dsn=false
collector_extractor_dsn_available=true
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

- The **correct intended Step2E identity was used**: `buyerrecon_prod_collector_app`
  (`step2e_execution_identity=buyerrecon_prod_collector_app`).
- **`STAGE0_RUNNER_DSN` was not used** (`used_stage0_runner_dsn=false`); `DATABASE_URL` was bound to
  the hidden `COLLECTOR_EXTRACTOR_DSN` (`collector_extractor_dsn_available=true`).
- The reviewed Step2E command was **executed exactly once** under the correct identity
  (`step2e_command_identified=true`, `step2e_command_attempts=1`).
- The command **exited nonzero** (`step2e_command_exit_code=nonzero`,
  `step2e_execution_result=blocked_or_failed`).
- The **failure class remains `unknown`** because **raw stdout/stderr were not printed**.
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
- The **next valid step is a sanitized collector-identity failure-localization preflight**, **not a
  blind rerun** — under its own explicit scoped Helen GO. Because the wrong-identity hypothesis is
  now ruled out (the correct collector/extractor identity still exited nonzero), localization should
  target the collector identity's privileges/behaviour on the behavioural-extractor path.

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
stdout/stderr were withheld; only the safe `nonzero` exit-class label is recorded. The
`package.json` **script name** and `scripts/*.ts` **file path** shown are non-secret repository
identifiers; the `step2e_command_shape` value is a **safe token form of the command** (the actual
`COLLECTOR_EXTRACTOR_DSN` value was bound from a hidden current-shell variable and was **never
printed, echoed, committed, or stored**); the role name `buyerrecon_prod_collector_app` is a
**non-secret role identifier**; the recorded commit hash is **public**. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git commit hash — not
secret or row values. **This PR runs nothing.**
