# Sprint 3 — Stage 0 auth/credential Step 1A — Evidence (NOT RUN: old Step 1 rerun + local-shell spillover)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1A_NOT_RUN_OLD_STEP1_RERUN_LOCAL_SHELL_SPILLOVER`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1A ROLE METADATA PREFLIGHT GO` (one corrected
PR #204 Step 1A minimal `pg_roles`-only classifier), the **corrected Step 1A did
not run**. The operator **accidentally pasted/ran the OLD PR #202 Step 1 metadata
preflight command again** — which failed the same way as PR #203 — and after the
SSH connection closed, remaining pasted command text ran harmlessly in the local
Mac shell.

**No Step 1A allowlist labels were produced.** This PR changes no roles/grants,
runs no SQL, and records **safe labels only** — no secrets, DSN, password, raw
SQL/error text, or raw data.

> Provenance: PR #203 Step 1 metadata preflight blocked evidence
> (`ab921c0faa649772ce3a40002b76373b7592ae8d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1_METADATA_PREFLIGHT_BLOCKED_QUERY_FAILED`); PR #204
> corrected Step 1 query/command adjustment plan
> (`e22ff83045017e56082ff009a69257901b547d4d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1_QUERY_ADJUSTMENT_PLANNING_ONLY`).

---

## 1. Authorization & Intended Scope

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1A ROLE METADATA PREFLIGHT GO`.
- **Intended:** exactly **one** corrected **Step 1A** minimal `pg_roles`-only
  classifier from merged PR #204, whose **expected** labels would have included:
  - `stage0_auth_credential_step1a_attempted`;
  - `diagnostic_scope=pr204_step1a_pg_roles_only_classifier`;
  - `step1a_query_invoked`;
  - `role_exists`; `role_can_login`; `role_validity_state`;
  - `role_has_no_superuser`; `role_has_no_createdb`; `role_has_no_createrole`;
  - `step1a_role_metadata_result`.
- This did **not** authorize Step 1B, password use/reset, role change, or Stage 0.
- The operator ran the action manually. Claude Code did not execute anything.

---

## 2. What Actually Ran (the OLD PR #202 Step 1 command — not Step 1A)

The old PR #202 Step 1 metadata preflight command was pasted again **instead of**
the corrected PR #204 Step 1A. It emitted (the same failure shape as PR #203):

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

Note the scope label is **`pr202_step1_...`** (the old command), **not**
`pr204_step1a_pg_roles_only_classifier` — confirming the corrected Step 1A was
**not** the command that ran.

---

## 3. Local-Shell Spillover (after SSH closed; not a production result)

After the SSH connection closed, remaining pasted command text ran in the **local
Mac shell**, producing:

```text
cd: no such file or directory: /opt/buyerrecon-backend
```

This is a **local-shell artifact** — it occurred **after** SSH closed and is
**not** a production-host result (the production host is `/opt/buyerrecon-backend`;
the local Mac has no such path). It is recorded only to explain the visible
transcript tail; it produced no DSN handling, no `psql`, no Stage 0, and no
secret exposure.

---

## 4. Interpretation (bounded)

- **Corrected Step 1A did not run.** No Step 1A allowlist labels were produced —
  specifically **none** of: `role_exists`, `role_can_login`, `role_validity_state`,
  `role_has_no_superuser`, `role_has_no_createdb`, `role_has_no_createrole`,
  `step1a_role_metadata_result`.
- The **old Step 1 metadata query was accidentally invoked again** and **failed
  the same way as PR #203** (`metadata_query_pass=false`,
  `step1_role_metadata_preflight_result=blocked_metadata_query_failed`).
- **This does not change the PR #203 conclusion** — it merely reran the same old
  command with the same outcome.
- **This does not prove** a role-usability cause or a password/custody cause.
- The local `cd: no such file or directory` happened **after SSH closed** and was
  **not** a production-host result.

This is an **operator paste/command-selection slip**, not a Step 1A result and not
a new finding.

---

## 5. What Did Not Happen

- No corrected Step 1A execution.
- No Step 1B.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No runner password used.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset; no role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No raw SQL / PostgreSQL output printed.
- No DSN / password / token / host / port / IP printed.

---

## 6. Verdict

- **STEP 1A NOT RUN.** The corrected PR #204 Step 1A classifier was **not**
  executed; the old PR #202 Step 1 command was accidentally rerun (failing as
  before), and a post-SSH local-shell `cd` error is a harmless local artifact. No
  Step 1A booleans were produced; no cause proven; no secret exposed.

---

## 7. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun corrected Step 1A, inspect raw output, reset a password,
   change a role, run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. A corrected **Step 1A** rerun requires a **fresh explicit Helen GO** and must
   run the **PR #204 Step 1A** command (scope label
   `pr204_step1a_pg_roles_only_classifier`) — **not** the old PR #202 Step 1
   command — with the approved custody connection only, no runner password, no
   login as the runner, raw output withheld, allowlist booleans only, recorded in
   its own docs-only evidence PR.
4. **Stage 0 execution remains separately GO-gated.**

---

## 8. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. No `buyerrecon_stage0_runner` password was used and no login as
that role occurred; raw SQL output was withheld; **no Step 1A booleans were
produced.** The `cd: no such file or directory: /opt/buyerrecon-backend` line is a
local-shell path-not-found artifact (the path is the production host path, absent
on the local Mac) — not a secret or a production result. All values above are safe
labels / booleans / public git commit hashes / role / database names — not secret
or row values.
