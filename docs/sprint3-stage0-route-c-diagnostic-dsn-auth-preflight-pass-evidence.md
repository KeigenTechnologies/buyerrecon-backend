# Stage0 Route C Diagnostic DSN Custody + Auth Preflight Evidence

## Status

**Status:** `STAGE0_ROUTE_C_DIAGNOSTIC_DSN_AUTH_PREFLIGHT_PASS`

- **Evidence-only.** **Docs-only.**
- Records two already-completed actions: a **custody-only hidden-input action** in the current
  shell, then **one tiny DSN auth preflight** run after explicit HELEN GO using the already-custodied
  `ROUTE_C_DIAG_DSN` shell variable.
- **No** password, DSN, host, port, username (beyond the non-secret role identifier), connection
  string, password hash, env value, raw PostgreSQL error text, `pg_hba` raw line, custody content,
  customer payload, or PII appears in this document.

This PR **records** that one tiny auth preflight already ran. **This PR itself runs no psql**,
authorizes no Route C, no Stage0, no DB mutation, no credential rotation, no custody rewrite, no
DSN/host/port discovery, no `.env.production` inspection, and no `pg_hba` inspection.

---

## Evidence chain

- **PR #304** (`e360de4ef980688d78d8d7ad5e4aa4c0b03e7e95`): recorded
  `STAGE0_ROUTE_C_DIAGNOSTIC_ROLE_SETUP_CREATED_NOT_CUSTODIED` — `buyerrecon_route_c_diag` was
  created/verified, password set, `db_mutation_executed=true` in that earlier setup, but custody was
  incomplete (`custody_write_succeeded=false`, `custody_source_category=unknown`,
  `route_c_diag_role_setup_result=created_not_custodied`).
- This evidence completes the custody gap and adds a tiny DSN auth preflight PASS.

---

## Custody-only action labels

```text
route_c_diag_custody_attempted=true
pr304_merge_present=true
tracked_working_tree_clean=true
diagnostic_role_name=buyerrecon_route_c_diag
approved_diagnostic_connection_available=true
custody_write_attempted=true
custody_write_succeeded=true
custody_source_category=approved_operator_hidden_input
route_c_diag_custody_result=custodied
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
custody_value_printed=false
sql_executed=false
psql_executed=false
route_c_diagnostic_executed=false
stage0_executed=false
run_lock_touched=false
```

---

## Tiny auth preflight labels

```text
route_c_diag_dsn_auth_preflight_attempted=true
route_c_diag_dsn_available=true
auth_user_expected=true
auth_database_expected=true
transaction_read_only=false
connect_effective=true
psql_executed=true
sql_executed=true
route_c_diag_dsn_auth_preflight_result=pass
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
route_c_diagnostic_executed=false
stage0_executed=false
run_lock_touched=false
db_mutation_executed=false
```

---

## Interpretation

- The diagnostic DSN was placed into **hidden current-shell custody**.
- Custody source category is **`approved_operator_hidden_input`**.
- The **tiny auth preflight passed**.
- It proved the already-custodied DSN **authenticates as `buyerrecon_route_c_diag` against
  `buyerrecon_production`** and that **CONNECT is effective**.
- `transaction_read_only=false` is recorded but is **not a failure**: this preflight only checked
  login / database / connect identity. Prior role-setup evidence (PR #304) showed **no table write
  privileges**.
- **No Route C diagnostic was run.**
- **No Stage0 was run.**
- **No run-lock was touched.**
- **No DB mutation occurred** during the auth preflight (`db_mutation_executed=false`).
- **No DSN / password / host / port / credential / connection components were printed.**
- **Route C diagnostic is now unblocked at the DSN-auth level**, but still **requires a fresh
  explicit scoped HELEN GO** before execution.

---

## Does NOT authorize

This PR does **NOT** authorize: running psql again, Route C diagnostic, Route C retry, SQL, psql,
auth retry, Stage0, run-lock touch, DB mutation, credential rotation, custody rewrite, further role
changes, grants/revokes, DSN discovery, host/port discovery, `.env.production` inspection, `pg_hba`
inspection, Route B, Step2E, remediation, workers/extractors, deploy, runtime command, Lane/scoring,
AMS runtime, customer output, Gate4E, or Gate4F. A future Route C diagnostic run requires a separate
explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, customer row data, **raw psql output, raw PostgreSQL error text**, env-var
value, or customer data. The role name `buyerrecon_route_c_diag` and the database name
`buyerrecon_production` are **non-secret identifiers**; the recorded commit hash is **public**. The
custodied DSN lives only in a hidden current-shell variable (`ROUTE_C_DIAG_DSN`) and was **never
printed, echoed, committed, or stored in this document**. All values above are safe labels /
booleans / category tokens / non-secret identifiers / a public git commit hash — not secret or row
values. The single psql auth preflight already ran under explicit GO; **this PR runs nothing**.
