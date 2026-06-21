# Collector Password Resync + Auth Preflight PASS

## Status

**Status:** `COLLECTOR_PASSWORD_RESYNC_AUTH_PREFLIGHT_PASS`

- **Evidence-only.** **Docs-only.**
- A prior collector auth failure classifier had recorded
  `collector_auth_failure_category=password_authentication_failed` for the collector/extractor app
  role `buyerrecon_prod_collector_app`.
- Under a fresh scoped `HELEN COLLECTOR PASSWORD RESYNC + AUTH PREFLIGHT GO`, **exactly one**
  controlled **password-only** resync was run for `buyerrecon_prod_collector_app` (new password
  supplied by **hidden input**), and **exactly one** auth preflight was run as
  `buyerrecon_prod_collector_app`. The auth preflight **passed**.
- The collector DSN was **constructed internally in shell** from the same hidden password and was
  **never printed**.
- No Step2E rerun; no Stage0 rerun; no Route C rerun; **no grants or role changes other than the
  password-only reset**; no worker/downstream-extractor/Lane/scoring/AMS/customer-output; no
  Gate4E/Gate4F.
- **No** password, DSN, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, or user identifier appears in this document.

This PR **records** an already-run, GO-scoped password-only resync and a passing auth preflight.
**This PR reruns nothing**, applies no further change, and authorizes no Step2E rerun.

---

## Evidence chain

- **PR #313** (`dc43d9fe7d99d0bc0bb3c26af9786075f4a2464d`): recorded
  `STEP2E_CORRECT_IDENTITY_RERUN_BLOCKED_OR_FAILED` — Step2E exited nonzero under the correct
  collector/extractor identity; next step was a sanitized collector-identity failure-localization
  preflight.
- A prior collector auth failure classifier recorded
  `collector_auth_failure_category=password_authentication_failed`, isolating a
  password / DSN-password mismatch for `buyerrecon_prod_collector_app`.
- A fresh scoped `HELEN COLLECTOR PASSWORD RESYNC + AUTH PREFLIGHT GO` authorized exactly one
  password-only resync and exactly one auth preflight under the collector identity.

---

## Evidence labels

```text
collector_password_resync_attempted=true
collector_password_loaded=true
collector_password_resync_executed=true
collector_dsn_constructed_in_shell=true
collector_extractor_dsn_available=true
auth_user_expected=true
auth_database_expected=true
connect_effective=true
collector_auth_preflight_result=pass
psql_executed=true
sql_executed=true
db_mutation_executed=true
step2e_rerun_executed=false
stage0_rerun_executed=false
route_c_rerun_executed=false
grants_or_role_changes_executed=password_only
workers_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
password_printed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_request_or_session_identifier_printed=false
```

---

## Interpretation

- The **prior collector auth issue was a password / DSN-password mismatch**
  (`password_authentication_failed`).
- The `buyerrecon_prod_collector_app` password was **resynced by hidden input**
  (`collector_password_loaded=true`, `collector_password_resync_executed=true`); this was a
  **password-only** change (`grants_or_role_changes_executed=password_only`).
- The collector DSN was **built internally in shell from the same hidden password** and was **not
  printed** (`collector_dsn_constructed_in_shell=true`, `collector_extractor_dsn_available=true`,
  `dsn_printed=false`, `password_printed=false`).
- The **auth preflight passed** as `buyerrecon_prod_collector_app` against `buyerrecon_production`
  (`auth_user_expected=true`, `auth_database_expected=true`, `collector_auth_preflight_result=pass`).
- **CONNECT is effective** (`connect_effective=true`).
- This **fixes the collector-auth preflight blocker**.
- The resync was a **password-only DB mutation** (`db_mutation_executed=true`,
  `psql_executed=true`, `sql_executed=true`); **no GRANT/REVOKE or role change** occurred beyond the
  password reset.
- This **does not rerun Step2E** and **does not authorize a Step2E rerun**.
- This **does not authorize grants**.
- This **does not authorize a Stage0 rerun**.
- This **does not authorize Gate4E or Gate4F**.
- **No worker, downstream extractor, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F
  action occurred.**
- **No secret / raw / customer / request / session values were printed.**
- The **next valid step is a sanitized collector-identity failure-localization rerun** — likely with
  `SINCE` supplied — **not a blind Step2E rerun**, under its own separate explicit scoped Helen GO.

---

## Does NOT authorize

This PR does **NOT** authorize: a Step2E rerun, a Stage0 rerun, a Route C rerun, any further fix or
remediation, GRANT/REVOKE or role change, any additional DB mutation beyond the already-run
password-only reset, credential rotation beyond that reset, custody rewrite, DSN discovery,
host/port discovery, `.env.production` inspection, `pg_hba` inspection, workers, downstream
extractors, Lane/scoring, AMS runtime, customer output, Gate4E, Gate4F, deploy, or runtime command.
Any failure-localization rerun or Step2E rerun requires its own separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, new password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file content,
`.env.production` content/value, token, private key, IP address, host value, port value, real URI,
login source, **raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, customer row data, **raw psql output, raw PostgreSQL
error text**, or env-var value. The new collector password was supplied by hidden input and the
collector DSN was constructed internally in shell from that hidden password; **neither the password
nor the DSN was printed, echoed, committed, or stored** in this record — only the safe `pass`
auth-class label is recorded. The role name `buyerrecon_prod_collector_app` and database name
`buyerrecon_production` are **non-secret role/database identifiers**; the recorded commit hash is
**public**. All values above are safe labels / booleans / category tokens / non-secret identifiers /
a public git commit hash — not secret or row values. **This PR runs nothing.**
