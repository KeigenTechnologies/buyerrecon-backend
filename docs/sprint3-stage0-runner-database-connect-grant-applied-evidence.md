# Stage0 Runner Database CONNECT Grant Applied Evidence

## Status

**Status:** `STAGE0_RUNNER_DATABASE_CONNECT_GRANT_APPLIED`

- **Evidence-only.** **Docs-only.**
- Under a fresh scoped `HELEN STAGE0 RUNNER DATABASE CONNECT GRANT GO`, **exactly one** minimal
  production DB permission fix was applied: a `GRANT CONNECT` on the production database to the
  Stage0 runner role. The grant was verified (`target_role_connect_privilege_after=true`).
- No Route C rerun; no auth retry as `buyerrecon_stage0_runner`; no Stage0; run-lock not touched.
- **No** DSN, password, host, port, connection string, password hash, env value, raw PostgreSQL
  error text, `pg_hba` raw line, custody content, customer payload, or PII appears in this document.

This PR **records** an already-applied, GO-scoped fix. **This PR runs no psql/SQL**, runs no Route
C, runs no Stage0, and authorizes no further action.

---

## Evidence chain

- **PR #306** (`391c748059869d84dc5f814110b06ff4fa72df5b`): recorded the Route C diagnostic result
  `route_c_catalog_classifier=database_connect_missing` with `target_role_connect_privilege=false`.
- A fresh scoped `HELEN STAGE0 RUNNER DATABASE CONNECT GRANT GO` authorized exactly one minimal
  `GRANT CONNECT` fix.

Applied statement (database-CONNECT-only, minimal scope):

```sql
-- Applied under HELEN STAGE0 RUNNER DATABASE CONNECT GRANT GO (already executed; recorded here only).
GRANT CONNECT ON DATABASE buyerrecon_production TO buyerrecon_stage0_runner;
```

---

## Evidence labels

```text
connect_grant_attempted=true
target_role_name=buyerrecon_stage0_runner
target_database_name=buyerrecon_production
grant_statement_scope=database_connect_only
connect_grant_applied=true
target_role_connect_privilege_after=true
db_mutation_executed=true
route_c_rerun_executed=false
auth_retry_against_stage0_runner=false
stage0_executed=false
run_lock_touched=false
dsn_printed=false
host_port_printed=false
credential_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
customer_output_executed=false
```

---

## Interpretation

- The minimal **CONNECT grant fix was applied**.
- The Route C finding **`database_connect_missing` is resolved at the database CONNECT privilege
  level**.
- `buyerrecon_stage0_runner` now has **CONNECT on `buyerrecon_production`**
  (`target_role_connect_privilege_after=true`).
- This **does not prove Stage0 works**.
- This **did not run Route C again**.
- This **did not run Stage0**.
- This **did not run an auth retry** as `buyerrecon_stage0_runner`.
- This **did not touch run-lock**.
- This **did not authorize Step 2E or Stage 0**.
- `db_mutation_executed=true` reflects only this single GO-scoped `GRANT CONNECT`; no other mutation
  occurred.
- The **next valid step is a separately GO-gated binding/auth preflight rerun** (Option A
  binding/auth preflight), **not Stage 0**.

---

## Does NOT authorize

This PR does **NOT** authorize: Step2E, Stage0, run-lock touch, an Option A binding/auth preflight
rerun (that requires its own scoped GO), a Route C rerun, auth retry as `buyerrecon_stage0_runner`,
any further GRANT/REVOKE, CREATE/ALTER ROLE, credential rotation, custody rewrite, DSN discovery,
host/port discovery, `.env.production` inspection, `pg_hba` inspection, workers/extractors, deploy,
runtime command, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, customer row data, **raw psql output, raw PostgreSQL error text**, env-var
value, or customer data. The role name `buyerrecon_stage0_runner` and the database name
`buyerrecon_production` are **non-secret identifiers** already in the reviewed docs chain /
constants registry; the recorded commit hash is **public**. All values above are safe labels /
booleans / category tokens / non-secret identifiers / a public git commit hash — not secret or row
values. The single `GRANT CONNECT` already ran under explicit GO; **this PR runs nothing further**.
