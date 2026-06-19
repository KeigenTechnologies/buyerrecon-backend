# Stage0 Route C Diagnostic Result: database_connect_missing

## Status

**Status:** `STAGE0_ROUTE_C_DIAGNOSTIC_RESULT_DATABASE_CONNECT_MISSING`

- **Evidence-only.** **Docs-only.**
- Under a fresh scoped `HELEN ROUTE C DIAGNOSTIC EXECUTION GO`, **exactly one** Route C
  catalog/metadata diagnostic was run using the already-custodied `ROUTE_C_DIAG_DSN`.
- No Stage0 ran; run-lock not touched; no DB mutation; no auth retry against
  `buyerrecon_stage0_runner`; no workers/extractors/deploy/runtime/Lane/scoring/AMS/customer-output.
- **No** DSN, password, host, port, username (beyond non-secret role identifiers), connection
  string, password hash, env value, raw PostgreSQL error text, `pg_hba` raw line, custody content,
  customer payload, or PII appears in this document.

This PR **records** an already-run diagnostic. **This PR runs no psql/SQL**, applies no fix, and
authorizes nothing.

---

## Evidence chain

- **PR #305** (`93d493acb0989211e4f75ce43763031f8f177b83`): proved the diagnostic DSN was custodied
  (`approved_operator_hidden_input`) and a tiny auth preflight passed
  (`STAGE0_ROUTE_C_DIAGNOSTIC_DSN_AUTH_PREFLIGHT_PASS`).
- A fresh scoped `HELEN ROUTE C DIAGNOSTIC EXECUTION GO` authorized exactly one Route C
  catalog/metadata diagnostic using the existing `ROUTE_C_DIAG_DSN`.

---

## Evidence labels

```text
route_c_diagnostic_attempted=true
route_c_diag_dsn_available=true
route_c_diag_user_expected=true
route_c_diag_database_expected=true
target_role_name=buyerrecon_stage0_runner
target_role_exists=true
target_role_can_login=true
target_role_valid_until_state=never_expires
target_role_connection_limit_state=unlimited
target_role_connect_privilege=false
target_role_superuser=false
target_role_createrole=false
target_role_createdb=false
target_role_replication=false
target_role_bypassrls=false
route_c_catalog_classifier=database_connect_missing
psql_executed=true
sql_executed=true
route_c_diagnostic_result=pass
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
db_mutation_executed=false
stage0_executed=false
run_lock_touched=false
auth_retry_against_stage0_runner=false
workers_executed=false
extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
```

---

## Interpretation

- The Route C diagnostic **executed successfully** (`route_c_diagnostic_result=pass`).
- The diagnostic connected as **`buyerrecon_route_c_diag`** against **`buyerrecon_production`**.
- Target role **`buyerrecon_stage0_runner` exists** (`target_role_exists=true`).
- Target role **can login** (`target_role_can_login=true`).
- Target role **valid-until state is `never_expires`**.
- Target role **connection limit is `unlimited`**.
- Target role does **not** have `SUPERUSER` / `CREATEROLE` / `CREATEDB` / `REPLICATION` /
  `BYPASSRLS`.
- The specific Route C catalog finding is **`database_connect_missing`**, because
  `target_role_connect_privilege=false`.
- This **does not prove Stage0 works**.
- This **does not run Stage0**.
- This **does not authorize a fix**.

### Likely minimal fix candidate (NOT authorized here)

The likely minimal fix candidate is:

```sql
-- CANDIDATE ONLY — DO NOT RUN. NOT AUTHORIZED BY THIS PR.
GRANT CONNECT ON DATABASE buyerrecon_production TO buyerrecon_stage0_runner;
```

That fix is **not authorized by this PR** and requires a **separate explicit scoped Helen GO**.
Any such grant would be a separately reviewed, GO-gated correction step, followed by a separately
GO-gated Option A binding/auth preflight rerun before Step 2E / Stage 0.

---

## Does NOT authorize

This PR does **NOT** authorize: applying the candidate `GRANT`, any GRANT/REVOKE, CREATE/ALTER
ROLE, credential rotation, custody rewrite, Route C rerun, Stage0, run-lock touch, DB mutation,
auth retry as `buyerrecon_stage0_runner`, `.env.production` inspection, DSN discovery, host/port
discovery, `pg_hba` inspection, Route B, Step2E, remediation, workers/extractors, deploy, runtime
command, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, customer row data, **raw psql output, raw PostgreSQL error text**, env-var
value, or customer data. The role names `buyerrecon_route_c_diag` and `buyerrecon_stage0_runner`
and the database name `buyerrecon_production` are **non-secret identifiers** already in the reviewed
docs chain / constants registry; the recorded commit hash is **public**. The custodied DSN lives
only in a hidden current-shell variable and was **never printed, echoed, committed, or stored in
this document**. All values above are safe labels / booleans / category tokens / non-secret
identifiers / a public git commit hash — not secret or row values. The single Route C diagnostic
already ran under explicit GO; **this PR runs nothing and applies no fix.**
