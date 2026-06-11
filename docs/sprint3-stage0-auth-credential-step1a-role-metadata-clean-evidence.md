# Sprint 3 — Stage 0 auth/credential Step 1A — Role Metadata Preflight — Evidence (CLEAN)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`

This is a **docs-only evidence record**. Under the fresh GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1A CLEAN RERUN GO`, the operator ran the
**corrected PR #204 Step 1A** minimal `pg_roles`-only role metadata classifier on
production. **The trusted scope label was present**
(`diagnostic_scope=pr204_step1a_pg_roles_only_classifier`), the **Step 1A query
passed**, and the role metadata is **`role_metadata_clean`** (role exists, can
login, validity unbounded, no superuser/createdb/createrole) — **booleans only,
raw output withheld**.

**This is a Step 1A role-metadata result only — NOT a Step 1B grant check, NOT a
Stage 0 execution, and NOT a proof of the exact root cause.** This PR changes no
roles/grants, runs no SQL, and records safe **booleans only** — no secrets, DSN,
password, host, port, raw SQL/error text, or raw data.

> Provenance: PR #201 diagnostic result
> (`STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`); PR #204 corrected Step 1
> query/command adjustment plan (`e22ff83045017e56082ff009a69257901b547d4d`);
> PR #205 prior Step 1A not-run / old rerun evidence
> (`0e9f11f5d69037b34deb2b049f2c51187b094342`).

---

## 1. Authorization & Sync Gate

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1A CLEAN RERUN GO` — exactly **one**
  corrected PR #204 Step 1A minimal `pg_roles`-only classifier; approved custody
  connection only; **no** runner password; **no** login as
  `buyerrecon_stage0_runner`; raw output withheld; allowlist booleans only.
- Production sync gate (passed before execution):
  ```text
  current_head=0e9f11f5d69037b34deb2b049f2c51187b094342
  merge_e22ff83_present=true
  merge_0e9f11f_present=true
  sync_gate_pass=true
  ```
- This did **not** authorize Step 1B, password use/reset, role change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the corrected Step 1A)

```text
sync_attempted=true
stage0_executed=false
step1b_executed=false
runner_password_used=false
psql_login_as_stage0_runner=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
current_head=0e9f11f5d69037b34deb2b049f2c51187b094342
merge_e22ff83_present=true
merge_0e9f11f_present=true
sync_gate_pass=true
stage0_auth_credential_step1a_attempted=true
diagnostic_scope=pr204_step1a_pg_roles_only_classifier
stage0_executed=false
step1b_executed=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
runner_password_used=false
psql_login_as_stage0_runner=false
raw_sql_output_withheld=true
on_production_host=true
merge_e22ff83_present=true
merge_0e9f11f_present=true
pr204_plan_doc_present=true
pr205_evidence_doc_present=true
approved_custody_source_present=true
custody_components_present=true
step1a_query_invoked=true
step1a_query_pass=true
raw_sql_output_printed=false
role_exists=true
role_can_login=true
role_validity_state=unbounded
role_has_no_superuser=true
role_has_no_createdb=true
role_has_no_createrole=true
step1a_role_metadata_result=role_metadata_clean
```

---

## 3. Interpretation — Step 1A CLEAN

- The **corrected PR #204 Step 1A did run** — confirmed by the trusted scope
  label `diagnostic_scope=pr204_step1a_pg_roles_only_classifier` (not the old
  PR #202 command that mis-ran in PR #205).
- The **Step 1A query passed** (`step1a_query_invoked=true`,
  `step1a_query_pass=true`), raw output withheld
  (`raw_sql_output_withheld=true`, `raw_sql_output_printed=false`).
- **Role metadata booleans:**
  - `role_exists=true`;
  - `role_can_login=true`;
  - `role_validity_state=unbounded`;
  - `role_has_no_superuser=true`; `role_has_no_createdb=true`;
    `role_has_no_createrole=true`;
  - `step1a_role_metadata_result=role_metadata_clean`.

**Bounded conclusion (not over-claimed):**
- This **points away** from **role-missing / cannot-login / validity / forbidden
  role-attribute** as the cause of the PR #201 `auth_or_credential` blocker — the
  role exists, can log in, is unbounded, and has none of the forbidden
  attributes.
- It **does not prove** password / custody as the exact root cause.
- It **does not** check Step 1B grant boundaries (`required_grants_hold` /
  `forbidden_privileges_absent`) — that is a separate step.
- It **does not authorize** password reset, role change, GRANT/DML/DDL, Stage 0
  retry, or runtime action.

This is a meaningful, secret-safe narrowing: the `auth_or_credential` blocker is
**not** explained by basic role usability — consistent with (but not proof of) a
**password/custody** explanation, pending Step 1B and any later steps.

---

## 4. What Did Not Happen

- No Step 1B.
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

---

## 5. Verdict

- **PASS — Step 1A role metadata is `role_metadata_clean`** (role exists, can
  login, validity unbounded, no superuser/createdb/createrole), via the trusted
  PR #204 Step 1A scope, raw output withheld, no secret used or exposed.
- This is **not** a Step 1B result, **not** a Stage 0 execution, and **not** a
  proof of the exact `auth_or_credential` root cause.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 1B, inspect raw output, reset a password, change a role,
   run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 1B** (grant-boundary check — `required_grants_hold` /
   `forbidden_privileges_absent`) requires its **own fresh explicit Helen GO** and
   its own docs-only evidence PR (catalog booleans only; approved custody
   connection; no runner password/login; raw output withheld).
4. Given `role_metadata_clean`, **Step 1C** will weigh whether the remaining
   `auth_or_credential` issue points to **password custody/reset planning**
   (PR #202 Step 2) — itself a separate docs-only plan + Codex review + GO. **Do
   not pre-judge.**
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Step 1A used the **approved custody connection only** (no
`buyerrecon_stage0_runner` password; no login as that role); raw SQL output was
withheld (`raw_sql_output_withheld=true`, `raw_sql_output_printed=false`) and only
the **allowlisted role-metadata booleans** were emitted. All values above are safe
labels / booleans / a public git commit hash / role / database names — not secret
or row values.
