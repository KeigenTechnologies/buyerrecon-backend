# Sprint 3 — Stage 0 auth/credential Step 1 — Role Metadata Preflight — Evidence (BLOCKED: metadata query failed)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1_METADATA_PREFLIGHT_BLOCKED_QUERY_FAILED`

This is a **docs-only evidence record**. Under the GO for **Step 1** of the
PR #202 auth/credential resolution plan (role login/usability metadata check —
catalog booleans only, **no** `buyerrecon_stage0_runner` password, **no** psql
login as `buyerrecon_stage0_runner`, raw output withheld, no mutation, no Stage 0),
the operator ran the preflight on production. The **metadata query was invoked
but did not pass**; raw SQL/PostgreSQL output was **withheld**; and **no role
booleans were produced**.

**This is not a Stage 0 execution, did not use the runner password, and did not
log in as `buyerrecon_stage0_runner`.** This PR changes no roles/grants, runs no
SQL, and records **safe labels only** — no secrets, DSN, password, raw SQL/error
text, or raw data.

> Provenance: PR #201 diagnostic result
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`,
> `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`); PR #202 auth/credential
> resolution plan (`4b1aa590aa8e32385c39e044d3cbcd5be9a20177`,
> `STAGE0_AUTH_CREDENTIAL_RESOLUTION_PLANNING_ONLY`).

---

## 1. Authorization

- GO: explicit Step 1 GO — role login/usability metadata preflight, **catalog
  booleans only**, **no** `buyerrecon_stage0_runner` password, **no** psql login
  as `buyerrecon_stage0_runner`, raw output withheld, no mutation, no Stage 0.
- This did **not** authorize Step 2 (password custody/reset), a fix, a retry, or
  Stage 0 execution.
- The operator ran the preflight manually on the production host. Claude Code did
  not execute anything.

---

## 2. Production Sync Gate (passed before the attempt)

```text
current_head=4b1aa590aa8e32385c39e044d3cbcd5be9a20177
merge_f592c13_present=true
merge_4b1aa59_present=true
sync_gate_pass=true
```

---

## 3. Safe Labels (from the actual Step 1 attempt)

```text
stage0_auth_credential_step1_attempted=true
diagnostic_scope=pr202_step1_role_metadata_preflight_catalog_booleans
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
runner_password_used=false
psql_login_as_stage0_runner=false
raw_sql_output_withheld=true
on_production_host=true
merge_f592c13_present=true
merge_4b1aa59_present=true
pr202_plan_doc_present=true
approved_custody_source_present=true
custody_components_present=true
metadata_query_invoked=true
metadata_query_pass=false
raw_sql_output_printed=false
step1_role_metadata_preflight_result=blocked_metadata_query_failed
```

---

## 4. Interpretation (bounded)

- The Step 1 preflight ran on production (`on_production_host=true`) with the sync
  gate passed and the PR #202 plan doc present; the approved custody source and
  components were present.
- The **metadata query was invoked** (`metadata_query_invoked=true`) but **did
  not pass** (`metadata_query_pass=false`).
- **Raw SQL/PostgreSQL output was withheld** (`raw_sql_output_withheld=true`,
  `raw_sql_output_printed=false`).
- **No role booleans were produced.** Therefore **do not claim** any of:
  - `role_exists`;
  - `role_can_login`;
  - `role_validity_state`;
  - `required_grants_hold`;
  - `forbidden_privileges_absent`.
- **Do not infer** whether this is a **password issue** or a **role-usability
  issue** — Step 1 produced no usable booleans either way.
- The result means **Step 1 is blocked at the metadata-query execution / output
  stage**, and needs a **separately reviewed query/command adjustment** before any
  rerun.

This is **not** a Stage 0 execution, **not** a password check (no runner password
used; no login as `buyerrecon_stage0_runner`), and **not** a determination of the
`auth_or_credential` sub-cause.

---

## 5. What Did Not Happen

- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No runner password used.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset.
- No role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No extractor / risk / POI / evidence snapshot runtime.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- **No retry** after the blocked result.
- **No fix attempted.**
- No raw SQL / raw PostgreSQL output / DSN / password / token / host / port / IP /
  raw error text / customer data / row values / UUIDs / `request_id` /
  `session_id` / payload / `canonical_jsonb` printed.

---

## 6. Verdict

- **BLOCKED — Step 1 role metadata preflight stopped at metadata-query
  execution/output; no role booleans produced.** The query was invoked but did
  not pass; raw output was withheld; no secret was used or exposed.
- This is **not** a result about role existence/usability or password validity,
  and **not** a Stage 0 execution. A **separately reviewed query/command
  adjustment** is required before rerun.

---

## 7. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not rerun the metadata query, patch the query, inspect/print raw
   PostgreSQL output, reset passwords, change roles, run SQL fixes, run
   GRANT/DML/DDL, run Stage 0, touch run-lock, or run runtime/downstream/customer
   actions.**
3. Prepare a **separately reviewed, secret-safe Step 1 query/command adjustment**
   (a docs-only plan/command-pack) that fixes the metadata-query execution/output
   issue while keeping catalog-booleans-only, no runner password, no login as
   `buyerrecon_stage0_runner`, and raw output withheld — then a **fresh explicit
   GO** for **one** corrected Step 1 preflight.
4. **Stage 0 execution remains separately GO-gated.**

---

## 8. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. The Step 1 preflight used **no** `buyerrecon_stage0_runner`
password and did **not** log in as that role; raw SQL output was withheld
(`raw_sql_output_withheld=true`, `raw_sql_output_printed=false`); **no role
booleans were produced.** All values above are safe labels / booleans / public
git commit hashes / role / database names — not secret or row values.
