# RISK_WORKER_DSN Custody Presence Proof — PASS

## Status

**Status:** `RISK_WORKER_DSN_CUSTODY_PRESENCE_PROOF_PASS`

- **Evidence-only.** **Docs-only.**
- Following the PR #329 custody/binding plan
  (`RISK_WORKER_DSN_CUSTODY_BINDING_PLANNING_ONLY`), a prior custody presence
  proof **correctly blocked** because the root-only env file
  `/etc/buyerrecon/risk-worker.env` was missing. Under a **separate scoped
  root-only env-file creation GO**, the file was created with the key
  `RISK_WORKER_DSN` using **hidden/manual input only**, and the custody presence
  proof was **rerun and returned PASS**.
- The proof confirmed **source/key presence only**: the DSN value was **not**
  printed, read to output, parsed, validated, transformed, checksummed,
  length-checked, stored in repo, passed in argv, or logged.
- `DATABASE_URL` was **not** bound for worker execution; no worker ran; no
  SQL/psql ran; no DB mutation; no role/grant change; no customer/Gate action.
- **No** DSN value or DSN component, password, host, port, username, database
  name, URI, connection string, env value, raw PostgreSQL error text, `pg_hba`
  raw line, customer payload, raw `accepted_events` payload, raw
  `canonical_jsonb`, `request_id`, `session_id`, user identifier, IP, user-agent,
  header, or body value appears in this document.

This PR **records** an already-run, GO-scoped custody presence proof. **This PR
reruns nothing**, binds nothing, mutates nothing, and authorizes no downstream
action.

---

## Evidence chain

- **PR #329** (`c196f09b26fff034fdc999eabf1f9776e7007610`): merged
  `RISK_WORKER_DSN_CUSTODY_BINDING_PLANNING_ONLY` — planned the approved
  custody/binding shape for `RISK_WORKER_DSN`; preferred source
  `root_only_env_file` at candidate path `/etc/buyerrecon/risk-worker.env`;
  presence/metadata-only proof requirements (value never read/printed/parsed).
- A prior custody presence proof **blocked** (file missing) — the planned
  fail-closed behavior.
- A **separate scoped root-only env-file creation GO** created
  `/etc/buyerrecon/risk-worker.env` with key `RISK_WORKER_DSN` via hidden/manual
  input only (not part of this evidence PR).
- The custody presence proof was **rerun → PASS**, recorded here.

---

## Evidence labels

```text
risk_worker_dsn_custody_presence_attempted=true
pr329_merge_present=true
tracked_working_tree_clean=true
risk_worker_dsn_plan_present=true
risk_worker_dsn_plan_status_present=true
risk_worker_dsn_source_category=root_only_env_file
risk_worker_dsn_candidate_path_checked=true
risk_worker_dsn_custody_file_exists=true
risk_worker_dsn_custody_file_owner_ok=true
risk_worker_dsn_custody_file_permissions_ok=true
risk_worker_dsn_key_present=true
approved_secret_custody_available=true
risk_worker_dsn_custody_presence_result=pass
risk_worker_dsn_value_printed=false
risk_worker_dsn_value_read_to_output=false
risk_worker_dsn_value_parsed=false
risk_worker_dsn_value_validated=false
risk_worker_dsn_value_transformed=false
risk_worker_dsn_value_checksumed=false
risk_worker_dsn_value_length_checked=false
risk_worker_dsn_value_stored_in_repo=false
risk_worker_dsn_value_passed_in_argv=false
risk_worker_dsn_value_logged=false
database_url_bound_for_worker=false
worker_executed=false
db_mutation_executed=false
sql_or_psql_executed=false
role_or_grant_change_executed=false
secret_file_created_or_edited=false
stage0_rerun_executed=false
step2e_rerun_executed=false
route_c_rerun_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
credential_printed=false
host_port_printed=false
env_file_value_printed=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

Note: `secret_file_created_or_edited=false` is recorded **for this evidence PR**
— the file was created earlier under its own separate scoped GO, not by this PR
and not by the presence proof itself (which is read-only metadata).

---

## Interpretation (bounded)

- `/etc/buyerrecon/risk-worker.env` **exists**.
- It is the **root-only env file custody source planned by PR #329**
  (`risk_worker_dsn_source_category=root_only_env_file`), with owner and
  permissions confirmed acceptable
  (`risk_worker_dsn_custody_file_owner_ok=true`,
  `risk_worker_dsn_custody_file_permissions_ok=true`).
- It **contains the key name `RISK_WORKER_DSN`**
  (`risk_worker_dsn_key_present=true`), so
  `approved_secret_custody_available=true`.
- This proves **custody source / key presence only**.
- This **does not prove authentication**.
- This **does not prove the DSN value is correct**.
- This **does not bind `DATABASE_URL`** (`database_url_bound_for_worker=false`).
- This **does not authorize the first risk-worker run** (`worker_executed=false`).
- The **first risk-worker run still requires a separate explicit Helen GO** (the
  PR #328 path).
- **Lane/scoring, AMS runtime, customer output, Gate4E, and Gate4F remain
  unauthorized.**
- This was a **presence/metadata read only** — `db_mutation_executed=false`,
  `sql_or_psql_executed=false`, `role_or_grant_change_executed=false`.
- **No DSN value or component, secret, raw, customer, request, session, IP,
  header, or body value was printed.**

---

## Does NOT authorize

This PR does **NOT** authorize: binding `DATABASE_URL`, running the risk worker,
the PR #328 first-run command pack, a custody value read/parse/validation, any
SQL/psql, any DB mutation, any GRANT/REVOKE/role change, any secret-file
edit, Stage0/Step2E/Route C reruns, downstream extractors, Lane/scoring, AMS
runtime, customer output, Gate4E, Gate4F, deploy, or runtime command. The first
risk-worker run, and any custody value use, require their own separate explicit
scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, generated password, DSN URI, connection string, raw
secret-manager payload, service-file content, `.env.production` or
`risk-worker.env` content/value, token, private key, IP address, host value,
port value, real URI, login source, **raw `pg_hba` lines**, raw `accepted_events`
payload, raw `canonical_jsonb`, real `session_id` / `request_id` / user
identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, or env-var value. The custody presence proof
checked **file existence, ownership, permissions, and key-name presence only**;
the `RISK_WORKER_DSN` value was **never** read to output, printed, parsed,
validated, transformed, checksummed, length-checked, stored in repo, passed in
argv, or logged — only **presence/metadata booleans** and **category tokens** are
recorded. `RISK_WORKER_DSN` and `DATABASE_URL` appear as **env-var names only**.
The candidate custody path `/etc/buyerrecon/risk-worker.env` is a **non-secret
path** (its contents are secret and were not read or shown). The role names
(`buyerrecon_risk_worker`, etc.), the database name (`buyerrecon_production`),
the repo path (`/opt/buyerrecon-backend`), and the recorded commit hash are
**non-secret** identifiers. All values above are safe labels / booleans /
category tokens / non-secret identifiers / a public git commit hash — not secret
or row values. **This PR runs nothing.**
