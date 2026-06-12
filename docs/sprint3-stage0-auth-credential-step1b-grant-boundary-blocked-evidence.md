# Sprint 3 — Stage 0 auth/credential Step 1B — Grant-Boundary Preflight — Evidence (BLOCKED: query failed)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_GRANT_BOUNDARY_BLOCKED_QUERY_FAILED`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1B GRANT BOUNDARY PREFLIGHT GO`, the operator
ran the PR #204 **Step 1B** grant-boundary classifier on production. The **Step 1B
query was invoked but did not pass**; raw SQL/PostgreSQL output was **withheld**;
and **no Step 1B grant-boundary booleans were produced**.

**This is not a Stage 0 execution, did not use the runner password, and did not
log in as `buyerrecon_stage0_runner`.** This PR changes no roles/grants, runs no
SQL, and records safe **booleans only** — no secrets, DSN, password, raw SQL/error
text, or raw data.

> Provenance: PR #204 corrected Step 1 query/command adjustment plan
> (`e22ff83045017e56082ff009a69257901b547d4d`); PR #206 Step 1A role metadata
> clean evidence (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`).

---

## 1. Authorization & Sync Gate

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1B GRANT BOUNDARY PREFLIGHT GO`.
- Production sync gate (passed before execution):
  ```text
  current_head=b2a38af7588ceaeda87f41050c621dc4af80206d
  merge_e22ff83_present=true
  merge_b2a38af_present=true
  sync_gate_pass=true
  ```
- This did **not** authorize a fix, retry, password/custody action, role change,
  or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 1B attempt)

```text
sync_attempted=true
stage0_executed=false
runner_password_used=false
psql_login_as_stage0_runner=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
current_head=b2a38af7588ceaeda87f41050c621dc4af80206d
merge_e22ff83_present=true
merge_b2a38af_present=true
sync_gate_pass=true
stage0_auth_credential_step1b_attempted=true
diagnostic_scope=pr204_step1b_grant_boundary_classifier
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
runner_password_used=false
psql_login_as_stage0_runner=false
raw_sql_output_withheld=true
on_production_host=true
merge_e22ff83_present=true
merge_b2a38af_present=true
pr204_plan_doc_present=true
pr206_evidence_doc_present=true
approved_custody_source_present=true
custody_components_present=true
step1b_query_invoked=true
step1b_query_pass=false
raw_sql_output_printed=false
step1b_grant_boundary_result=blocked_step1b_query_failed
```

---

## 3. Interpretation (bounded)

- Step 1B **did run** in the sense that the query was **invoked**
  (`step1b_query_invoked=true`) under the trusted scope label
  `diagnostic_scope=pr204_step1b_grant_boundary_classifier`.
- The **Step 1B query did not pass** (`step1b_query_pass=false`).
- **Raw SQL/PostgreSQL output was withheld** (`raw_sql_output_withheld=true`,
  `raw_sql_output_printed=false`).
- **No Step 1B grant-boundary booleans were produced.** Therefore:
  - **Do not claim** `required_grants_hold`;
  - **Do not claim** `forbidden_privileges_absent`;
  - **Do not infer** that required grants are missing;
  - **Do not infer** that forbidden privileges are present.
- **This does not change** the PR #206 Step 1A `role_metadata_clean` evidence.
- **This does not prove** a password/custody root cause.
- **This does not authorize** password reset, role change, GRANT/DML/DDL, Stage 0
  retry, or runtime action.
- The result means **Step 1B is blocked at query execution** and needs a
  **separately reviewed query/command adjustment plan** before any rerun (analogous
  to the Step 1 → Step 1A adjustment in PRs #203/#204).

This is a **Step 1B query/tooling blockage**, not a grant-boundary finding.

---

## 4. What Did Not Happen

- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No `buyerrecon_stage0_runner` password used.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset; no role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- Raw SQL / PostgreSQL output withheld.
- No DSN / password / token / host / port / IP printed.
- **No retry** after the blocked result.
- **No fix attempted.**

---

## 5. Verdict

- **BLOCKED — Step 1B grant-boundary preflight stopped at query execution; no
  grant-boundary booleans produced.** The query was invoked but did not pass; raw
  output withheld; no secret used or exposed.
- This is **not** a grant-boundary result (no `required_grants_hold` /
  `forbidden_privileges_absent`), **not** a change to the PR #206 clean role
  metadata, **not** a password/custody root-cause proof, and **not** a Stage 0
  execution. A **separately reviewed query/command adjustment** is required before
  rerun.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun Step 1B, inspect raw output, reset a password, change a role,
   run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. Prepare a **separately reviewed, secret-safe Step 1B query/command adjustment
   plan** (a docs-only plan/command-pack) that fixes the Step 1B grant-boundary
   query's execution/output issue while keeping **catalog-booleans-only**, the
   **approved custody connection** (no runner password, no login as the runner),
   and **raw output withheld** — then a **fresh explicit GO** for **one** corrected
   Step 1B preflight, recorded in its own docs-only evidence PR.
4. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Step 1B used the **approved custody connection only** (no
`buyerrecon_stage0_runner` password; no login as that role); raw SQL output was
withheld (`raw_sql_output_withheld=true`, `raw_sql_output_printed=false`); **no
Step 1B grant-boundary booleans were produced.** All values above are safe labels
/ booleans / a public git commit hash / role / database names — not secret or row
values.
