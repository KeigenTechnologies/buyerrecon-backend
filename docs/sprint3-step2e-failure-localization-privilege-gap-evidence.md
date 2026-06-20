# Step2E Sanitized Failure-Localization Preflight — Privilege Gap Evidence

## Status

**Status:** `STEP2E_FAILURE_LOCALIZATION_PRIVILEGE_GAP`

- **Evidence-only.** **Docs-only.**
- PR #311 recorded a Step2E execution `blocked_or_failed` after **exactly one** nonzero attempt.
- Under a fresh scoped GO, a **sanitized failure-localization preflight** was run to localize that
  nonzero outcome **without** rerunning Step2E.
- The preflight used **static script checks** plus **read-only** table-presence and privilege checks
  inside an explicit read-only transaction. **No DB mutation occurred.**
- The preflight **did not** rerun Step2E, **did not** rerun Stage0, **did not** rerun Route C,
  **did not** retry auth, **did not** apply grants/role changes, and **did not** run workers,
  downstream extractors, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F.
- **No** DSN, password, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, or user identifier appears in this document.

This PR **records** an already-run, GO-scoped read-only preflight. **This PR reruns nothing**,
applies no grant, and authorizes no rerun.

---

## Evidence chain

- **PR #311** (`24b95bf71036d6d21227215d6ab1291e87b3aa18`): recorded
  `STEP2E_EXECUTION_BLOCKED_OR_FAILED` — exactly one Step2E attempt, nonzero exit, failure class
  unknown (raw stdout/stderr withheld).
- A fresh scoped GO authorized a **read-only sanitized failure-localization preflight** over the
  reviewed Step2E behavioural-extractor command, with no rerun and no mutation.

Reviewed Step2E command (confirmed by static discovery; non-secret repo identifier):

```text
extract:behavioural-features = tsx scripts/extract-behavioural-features.ts
```

The script statically references `DATABASE_URL`, `SINCE`, `accepted_events`,
`session_behavioural_features`, and `session_features` (non-secret repository identifiers; no env
values shown).

---

## Evidence labels

```text
step2e_failure_localization_attempted=true
pr311_merge_present=true
tracked_working_tree_clean=true
step2e_command_present=true
step2e_script_file_present=true
step2e_script_mentions_database_url=true
step2e_script_mentions_since=true
step2e_script_mentions_extraction_version=false
step2e_script_mentions_accepted_events=true
step2e_script_mentions_session_behavioural_features=true
step2e_script_mentions_session_features=true
stage0_runner_dsn_available=true
auth_user_expected=true
auth_database_expected=true
accepted_events_table_present=true
session_behavioural_features_table_present=true
session_features_table_present=true
accepted_events_select_privilege=true
session_behavioural_features_select_privilege=false
session_behavioural_features_insert_privilege=false
session_behavioural_features_update_privilege=false
session_features_select_privilege=false
psql_executed=true
sql_executed=true
step2e_failure_localization_result=pass
read_only_transaction=true
db_mutation_executed=false
step2e_rerun_executed=false
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

- The preflight **localizes** the likely Step2E nonzero failure; it does **not** rerun or fix it.
- **Static script checks** confirmed the reviewed Step2E command and that the behavioural extractor
  script references `DATABASE_URL`, `SINCE`, `accepted_events`, `session_behavioural_features`, and
  `session_features` (`step2e_command_present=true`, `step2e_script_file_present=true`).
- The Stage0 runner DSN **authenticates correctly** to the expected user and database
  (`stage0_runner_dsn_available=true`, `auth_user_expected=true`, `auth_database_expected=true`) —
  so the failure is **not** an authentication or wrong-database failure.
- `accepted_events` exists and **SELECT is available** to the execution identity
  (`accepted_events_table_present=true`, `accepted_events_select_privilege=true`) — so the read of
  the source table is **not** the gap.
- `session_behavioural_features` (the `_v0_2` write target) **exists**, but the Stage0 runner
  **lacks SELECT, INSERT, and UPDATE** on it
  (`session_behavioural_features_select_privilege=false`,
  `session_behavioural_features_insert_privilege=false`,
  `session_behavioural_features_update_privilege=false`).
- `session_features` **exists**, but the Stage0 runner **lacks SELECT** on it
  (`session_features_select_privilege=false`).
- **Localization:** the likely Step2E nonzero failure is **missing behavioural-extractor privileges
  for the execution identity used**, or **the wrong execution identity being used for Step2E** —
  not auth, not the source-table read, not table absence.
- All privilege probing was done inside an explicit **read-only transaction**
  (`read_only_transaction=true`, `db_mutation_executed=false`).
- **No rerun, fix, grant, or role change occurred.** Step2E, Stage0, and Route C were not rerun; no
  auth retry; no grants/role changes; no worker, downstream extractor, Lane/scoring, AMS runtime,
  customer output, Gate4E, or Gate4F action.
- **No secret / raw / customer / request / session values were printed.**
- This evidence **does not authorize grants**, **does not authorize a rerun**, and **does not
  decide** whether `buyerrecon_stage0_runner` should receive behavioural-extractor privileges.
- The **next valid step is a separate decision**: either **identify the correct Step2E execution
  identity**, or **approve a least-privilege grant plan** for the behavioural-extractor path — each
  under its own explicit scoped Helen GO.

---

## Does NOT authorize

This PR does **NOT** authorize: a Step2E rerun, a Stage0 rerun, a Route C rerun, an auth retry, any
fix or remediation, DB mutation, GRANT/REVOKE or role change, a decision on whether
`buyerrecon_stage0_runner` receives behavioural-extractor privileges, credential rotation, custody
rewrite, DSN discovery, host/port discovery, `.env.production` inspection, `pg_hba` inspection,
workers, downstream extractors, Lane/scoring, AMS runtime, customer output, Gate4E, Gate4F, deploy,
or runtime command. Any grant plan, identity correction, or rerun requires its own separate explicit
scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, customer row data, **raw psql output, raw PostgreSQL error text**,
or env-var value. The preflight ran read-only static and privilege checks only; no rows, payloads,
or canonical data were read or printed — only **table-presence booleans** and **privilege booleans**
were recorded. The `package.json` **script name**, the `scripts/*.ts` **file path**, the referenced
**table names**, the **env-var names** (`DATABASE_URL`, `SINCE`), and the **role name**
(`buyerrecon_stage0_runner`) shown are non-secret repository / role identifiers; the recorded commit
hash is **public**. All values above are safe labels / booleans / category tokens / non-secret
identifiers / a public git commit hash — not secret or row values. **This PR runs nothing.**
