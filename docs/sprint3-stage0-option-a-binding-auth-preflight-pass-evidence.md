# Stage0 Option A Binding/Auth Preflight PASS (After CONNECT Grant)

## Status

**Status:** `STAGE0_OPTION_A_BINDING_AUTH_PREFLIGHT_PASS_AFTER_CONNECT_GRANT`

- **Evidence-only.** **Docs-only.**
- Under a fresh scoped `HELEN OPTION A BINDING/AUTH PREFLIGHT RERUN GO`, **exactly one** psql auth
  preflight was run using the hidden `STAGE0_RUNNER_DSN`.
- No Stage0 ran; run-lock not touched; no DB mutation; no Route C rerun; no
  workers/extractors/deploy/runtime/Lane/scoring/AMS/customer-output.
- **No** DSN, password, host, port, connection string, password hash, env value, raw PostgreSQL
  error text, `pg_hba` raw line, custody content, customer payload, or PII appears in this document.

This PR **records** an already-run preflight. **This PR runs no psql/SQL**, runs no Stage0, and
authorizes nothing.

---

## Evidence chain

- **PR #306** (Route C result `database_connect_missing`): the runner role lacked CONNECT.
- **PR #307** (`89bf7ee437fbc48d3df592b3ae4fb386c2e465f0`): recorded the minimal CONNECT grant
  applied — `GRANT CONNECT ON DATABASE buyerrecon_production TO buyerrecon_stage0_runner;` with
  `target_role_connect_privilege_after=true`.
- A fresh scoped `HELEN OPTION A BINDING/AUTH PREFLIGHT RERUN GO` authorized exactly one psql auth
  preflight using the existing hidden `STAGE0_RUNNER_DSN`.

---

## Evidence labels

```text
option_a_binding_auth_preflight_attempted=true
pr307_merge_present=true
tracked_working_tree_clean=true
stage0_runner_dsn_available=true
auth_user_expected=true
auth_database_expected=true
connect_effective=true
transaction_read_only=false
psql_executed=true
sql_executed=true
option_a_binding_auth_preflight_result=pass
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
db_mutation_executed=false
route_c_rerun_executed=false
stage0_executed=false
run_lock_touched=false
workers_executed=false
extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
```

---

## Interpretation

- The **Option A binding/auth preflight rerun passed** after the PR #307 CONNECT grant
  (`option_a_binding_auth_preflight_result=pass`).
- `STAGE0_RUNNER_DSN` **authenticated as `buyerrecon_stage0_runner`**.
- The connection **reached `buyerrecon_production`**.
- **CONNECT is effective** (`connect_effective=true`).
- `transaction_read_only=false` is recorded as a **non-failure** for this binding/auth preflight
  (identity/connect-only check).
- This **confirms the prior `database_connect_missing` blocker is fixed at the binding/auth
  preflight level**.
- This **does not run Stage0**.
- This **does not prove Stage0 execution succeeds**.
- This **does not touch run-lock**.
- This **does not authorize Step 2E or Stage 0**.
- The **next valid step is a separately GO-gated Stage0 execution decision**, if desired.

---

## Does NOT authorize

This PR does **NOT** authorize: Step2E, Stage0, run-lock touch, a Stage0 execution decision (that
requires its own scoped GO), a Route C rerun, any DB mutation, GRANT/REVOKE, CREATE/ALTER ROLE,
credential rotation, custody rewrite, DSN discovery, host/port discovery, `.env.production`
inspection, `pg_hba` inspection, workers/extractors, deploy, runtime command, Lane/scoring, AMS
runtime, customer output, Gate4E, or Gate4F.

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, customer row data, **raw psql output, raw PostgreSQL error text**, env-var
value, or customer data. The role name `buyerrecon_stage0_runner` and the database name
`buyerrecon_production` are **non-secret identifiers**; the recorded commit hash is **public**. The
`STAGE0_RUNNER_DSN` lives only in a hidden current-shell variable and was **never printed, echoed,
committed, or stored in this document**. All values above are safe labels / booleans / category
tokens / non-secret identifiers / a public git commit hash — not secret or row values. The single
auth preflight already ran under explicit GO; **this PR runs nothing.**
