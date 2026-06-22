# Sprint 3 — Risk-Worker Nonzero-Exit Safe Diagnostic — Command Pack (Docs-Only)

**Status:** `RISK_WORKER_NONZERO_EXIT_SAFE_DIAGNOSTIC_COMMAND_PACK_PLANNING_ONLY`

This is a **docs-only command-pack planning record**. It defines a future,
separately GO-gated diagnostic to **classify** the first internal risk-worker
run's nonzero exit (PR #331: `worker_exit_code=1`,
`STOP_LINE=worker_exit_nonzero`) into **safe categories only** — **without**
printing raw worker output, raw DB errors, secrets, rows, payloads, or
identifiers.

This PR **plans the diagnostic only**. It does **not** diagnose, classify, run or
rerun the worker, run production commands, run SQL/psql, read/print/copy
`run.safe.out` / `run.err` or worker stdout/stderr, inspect/print any DSN / env /
host / port / credential, mutate the DB, change roles/grants, apply any fix, or
run Lane/scoring / AMS runtime / customer output / Gate4E / Gate4F.

> Provenance of required base: `bd6951ccec1e264d3e1d15209ec080b03b34db2a` on
> `sprint2-architecture-contracts-d4cc2bf` (includes PR #328 first-run pack, PR
> #330 custody presence PASS, PR #331 first-run BLOCKED evidence).

---

## 1. Diagnostic goal & non-authorization

- **Goal:** classify the nonzero exit into one bounded **safe category** so the
  next step can be planned — using **safe labels/booleans only**.
- **Planning-only:** merging this PR does **not** authorize the diagnostic.
- A future diagnostic run requires a **separate explicit Helen GO**.
- The diagnostic authorizes **no remediation**: no grants, no role changes, no
  SQL fixes, no source fixes, no rerun, no DSN edit, no secret-file edit.
- Any fix or rerun requires a **later separate explicit Helen GO** after the
  diagnostic evidence is reviewed.

---

## 2. Phase A — static source-path classification (first; no production)

Done **first**, read-only over tracked repo files; **no production execution**:

- Inspect the `package.json` command mapping (`risk-evidence:run`).
- Inspect `scripts/run-risk-evidence-worker.ts` (the runner).
- Inspect the risk-evidence worker source path (`src/scoring/risk-evidence/`).
- Identify expected env vars (names only) and required tables / privileges.
- Confirm the RECORD_ONLY guard posture.

This phase emits the static booleans in §3 (e.g. `package_script_present`,
`runner_file_present`, `worker_source_present`, `command_shape_expected`,
`record_only_guard_present`, `database_url_expected_by_worker`). It reads **no**
production data, **no** secret, and **no** worker output.

> **PLANNING ONLY — DO NOT RUN.** Illustrative static checks (tracked repo only;
> no production, no DB, no secrets):

```bash
# Static, repo-only. No production. No DB. No secrets. (DO NOT RUN here.)
grep -qE '"risk-evidence:run"[[:space:]]*:' package.json   # package_script_present
test -f scripts/run-risk-evidence-worker.ts                 # runner_file_present
test -d src/scoring/risk-evidence                           # worker_source_present
grep -qE 'DATABASE_URL' scripts/run-risk-evidence-worker.ts # database_url_expected_by_worker
grep -qiE 'RECORD[_ ]?ONLY' scripts/run-risk-evidence-worker.ts  # record_only_guard_present
# expected env-var NAMES only (no values): DATABASE_URL, SINCE_HOURS, SINCE,
# UNTIL, WORKSPACE_ID, SITE_ID, OBSERVATION_VERSION, STAGE0_VERSION_FILTER,
# BEHAVIOURAL_FEATURE_VERSION
```

---

## 3. Phase B — future runtime classification (separate GO; safe labels only)

If — and only if — separately GO-gated, a runtime classification step may run.
It must emit **only safe labels / booleans** (no raw output):

```text
command_present=true|false
command_shape_expected=true|false
required_env_key_present=true|false
database_url_bound_for_worker=true|false
module_import_static_check_pass=true|false
package_script_present=true|false
runner_file_present=true|false
worker_source_present=true|false
record_only_guard_present=true|false
```

If — and only if — the classifier must read the **private** `run.safe.out` /
`run.err` to classify, it may do so **only through an allowlisted classifier**
that:

- matches captured lines against bounded patterns **in-process**;
- emits **only** a single `diagnostic_category` label (from §4) plus safe
  booleans;
- **never** prints, echoes, copies, or quotes any raw line;
- leaves `run.safe.out` / `run.err` as **private temp data** — never copied to
  docs/evidence.

---

## 4. Allowlisted safe categories (bounded)

The classifier may output exactly one of:

```text
auth_or_connection
missing_env_or_binding
migration_or_relation_missing
permission_or_acl
module_or_import_error
validation_or_contract_error
no_input_rows_or_empty_selection
upsert_conflict_or_constraint
unknown_or_unclassified
```

The classifier outputs **only the category label and safe booleans** — never raw
text. If no allowlisted category matches, it must return
`unknown_or_unclassified` (and `diagnostic_result=inconclusive`), never a raw
excerpt.

---

## 5. Required future diagnostic labels

```text
risk_worker_nonzero_exit_diagnostic_attempted=true
pr331_merge_present=true
tracked_working_tree_clean=true
diagnostic_scope=nonzero_exit_safe_classification
static_source_inspection_completed=true
package_script_present=true|false
runner_file_present=true|false
worker_source_present=true|false
command_shape_expected=true|false
record_only_guard_present=true|false
database_url_expected_by_worker=true|false
risk_worker_role_expected=buyerrecon_risk_worker
raw_worker_stdout_printed=false
raw_worker_stderr_printed=false
run_safe_out_copied_to_evidence=false
run_err_copied_to_evidence=false
diagnostic_classifier_used=true|false
diagnostic_category=auth_or_connection|missing_env_or_binding|migration_or_relation_missing|permission_or_acl|module_or_import_error|validation_or_contract_error|no_input_rows_or_empty_selection|upsert_conflict_or_constraint|unknown_or_unclassified
diagnostic_result=classified|blocked_or_failed|inconclusive
worker_rerun_executed=false
db_mutation_executed=false
sql_or_psql_executed=false
role_or_grant_change_executed=false
source_or_config_change_executed=false
secret_file_created_or_edited=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
credential_printed=false
host_port_printed=false
env_file_value_printed=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

Note: the diagnostic itself sets `worker_rerun_executed=false`,
`db_mutation_executed=false`, `sql_or_psql_executed=false` — it classifies only
and changes nothing.

---

## 6. Stop-lines

The future diagnostic (and this plan) must stop if:

- PR #331 merge not present;
- tracked tree dirty;
- the diagnostic would require **rerunning the worker**;
- the diagnostic would **print/copy worker stdout/stderr**;
- the diagnostic would **copy `run.safe.out` or `run.err`** to evidence;
- the diagnostic would **expose DSN / env / host / port / credential**;
- the diagnostic would **expose a raw PostgreSQL error or `pg_hba`**;
- the diagnostic would **expose raw rows, payloads, `canonical_jsonb`,
  `request_id`, `session_id`, user identifiers, IP, user-agent, headers, or body
  values**;
- the classifier **cannot classify** using the allowlisted safe categories
  (→ `unknown_or_unclassified` / `inconclusive`, not a raw excerpt);
- the diagnostic requires **SQL/psql or DB mutation**;
- the diagnostic requires a **role/grant change**;
- the diagnostic requires a **source/config fix**;
- the diagnostic requires a **secret-file edit**;
- the diagnostic would trigger **Lane/scoring, AMS runtime, customer output,
  Gate4E, or Gate4F**.

On any stop-line: halt and record it (safe labels only); do not proceed.

---

## 7. Interpretation / non-authorization

- This PR **only plans** a safe diagnostic path.
- It **does not** diagnose the current failure.
- It **does not** classify the failure yet.
- It **does not** authorize reading raw output.
- It **does not** authorize a rerun.
- It **does not** authorize remediation.
- It **does not** authorize a first-run retry.
- It **does not** authorize Lane/scoring, AMS runtime, customer output, Gate4E,
  or Gate4F.
- Any actual diagnostic execution requires a **separate explicit Helen GO** after
  review/merge.
- Any fix or rerun requires a **later separate explicit Helen GO** after the
  diagnostic evidence is reviewed.

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, generated password, DSN URI, connection string, raw
secret-manager payload, service-file content, `.env.production` /
`risk-worker.env` content/value, token, private key, IP address, host value,
port value, real URI, login source, **raw `pg_hba` lines**, raw `accepted_events`
payload, raw `canonical_jsonb`, real `session_id` / `request_id` / user
identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, **worker stdout/stderr**, or `run.safe.out`
/ `run.err` contents. The plan reads no production data and copies no worker
output; any future classification emits **only category labels + safe booleans**,
keeps `run.safe.out` / `run.err` as private temp data, and never prints raw
lines. The env-var **names** (`DATABASE_URL`, `SINCE_HOURS`, `SINCE`, `UNTIL`,
`WORKSPACE_ID`, `SITE_ID`, `OBSERVATION_VERSION`, `STAGE0_VERSION_FILTER`,
`BEHAVIOURAL_FEATURE_VERSION`), the `package.json` **script name**
(`risk-evidence:run`), the `scripts/*.ts` **path**, the worker source path
(`src/scoring/risk-evidence/`), the role names (`buyerrecon_risk_worker`, etc.),
the table names (`stage0_decisions`, `session_behavioural_features_v0_2`,
`risk_observations_v0_1`), the database name (`buyerrecon_production`), the repo
path (`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
repository / role / public-git identifiers. All values above are safe labels /
booleans / category tokens / non-secret identifiers / a public git commit hash —
not secret or row values. **This PR runs nothing.**
