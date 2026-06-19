# Stage0 Route C Diagnostic Role Setup Evidence

## Status

**Status:** `STAGE0_ROUTE_C_DIAGNOSTIC_ROLE_SETUP_CREATED_NOT_CUSTODIED`

- **Evidence-only.** **Docs-only.**
- Under explicit GO (`HELEN ROUTE C DIAGNOSTIC ROLE CUSTODY SETUP GO`), scope was exactly **one**
  controlled setup execution to create/verify `buyerrecon_route_c_diag` and store its secret safely.
- Execution **created/verified the diagnostic role and set its password**, but **custody was not
  completed**.
- **No** password, DSN, host, port, username, connection string, password hash, env value, raw
  PostgreSQL error text, `pg_hba` raw line, custody content, customer payload, or PII appears in
  this document.

---

## Evidence chain

- **PR #303** (`6428377247557895a5648c9cc66edd7109637295`): merged the Route C diagnostic role +
  custody command pack (`STAGE0_ROUTE_C_DIAGNOSTIC_ROLE_CUSTODY_COMMAND_PACK_REVIEW_ONLY`).
- Explicit GO present: `HELEN ROUTE C DIAGNOSTIC ROLE CUSTODY SETUP GO` — exactly one controlled
  setup execution.

---

## Evidence summary (safe labels)

```text
route_c_diag_role_setup_attempted=true
pr303_merge_present=true
tracked_working_tree_clean=true
diagnostic_role_name=buyerrecon_route_c_diag
password_loaded=true
diagnostic_role_created=true
diagnostic_role_independent_from_stage0_runner=true
diagnostic_role_independent_from_app_roles=true
diagnostic_role_superuser=false
diagnostic_role_createrole=false
diagnostic_role_createdb=false
diagnostic_role_replication=false
diagnostic_role_bypassrls=false
diagnostic_role_table_write_privileges=false
diagnostic_role_app_table_ownership=false
diagnostic_role_customer_data_read_privileges=false
diagnostic_role_connect_privilege=true
custody_write_attempted=true
custody_write_succeeded=false
custody_source_category=unknown
password_printed=false
password_hash_printed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
custody_value_printed=false
db_mutation_executed=true
route_c_diagnostic_executed=false
stage0_executed=false
run_lock_touched=false
route_c_diag_role_setup_result=created_not_custodied
```

---

## Interpretation

- The dedicated diagnostic role setup **succeeded**.
- The role is **independent from the Stage0 runner** and **from application roles**.
- The role has **no excessive privileges** as shown by the safe labels (no SUPERUSER / CREATEROLE /
  CREATEDB / REPLICATION / BYPASSRLS; no table writes, app-table ownership, or customer-data reads;
  only CONNECT plus LOGIN).
- **Password / DSN / host / port / credential values were not printed.**
- The diagnostic DSN was **not stored in approved custody** during this run
  (`custody_write_succeeded=false`, `custody_source_category=unknown`).
- **Route C diagnostic remains blocked** until the diagnostic DSN is safely custodied **and** a
  fresh explicit scoped Helen GO is issued.

Note: `db_mutation_executed=true` reflects only the GO-scoped role creation / password set in this
single setup execution; no Route C diagnostic, Stage0, or run-lock action occurred, and no further
mutation is authorized.

---

## Does NOT authorize

This PR does **NOT** authorize: a custody-write retry, Route C diagnostic execution, Route C retry,
SQL, psql, auth retry, Stage0, run-lock touch, further role creation/alteration, grants/revokes,
credential rotation, `.env.production` inspection, DSN discovery, host/port discovery, `pg_hba`
inspection, Route B, Step2E, remediation, workers/extractors, deploy, runtime command, Lane/scoring,
AMS runtime, customer output, Gate4E, or Gate4F. The next step (safe custody of the diagnostic DSN)
requires a separate scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, customer row data, **raw psql output, raw PostgreSQL error text**, env-var
value, or customer data. The role names `buyerrecon_route_c_diag` and `buyerrecon_stage0_runner`
are **non-secret identifiers**; the recorded commit hash is **public**. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git commit hash — not
secret or row values. The diagnostic password was loaded and set inside the GO-scoped execution but
was **never printed, echoed, committed, or stored in this document**; custody was not completed.
