# Dedicated Minimal Risk-Worker LOGIN Role — Create / Grant / Proof PASS

## Status

**Status:** `RISK_WORKER_DEDICATED_LOGIN_ROLE_PROOF_PASS`

- **Evidence-only.** **Docs-only.**
- Under a scoped `HELEN RISK WORKER DEDICATED LOGIN ROLE CREATE + GRANT + PROOF
  GO`, the dedicated minimal risk-worker LOGIN role `buyerrecon_risk_worker` was
  **created**, its password was **set interactively via psql `\password`**,
  exactly **four direct minimal grants** were applied, and the read-only
  **proof / readiness gate passed**.
- The execution followed the merged PR #324 command pack
  (`docs/sprint3-risk-worker-dedicated-login-role-command-pack.md`) over the
  **local PostgreSQL admin path**; the create statement carried **no password
  clause**, and the password was set only at the interactive `\password` prompt.
- No worker ran; no Stage0/Step2E/Route C rerun; no downstream extractor,
  Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action occurred.
- **No** password, DSN, host, port, connection string, env value, raw
  PostgreSQL error text, `pg_hba` raw line, customer payload, PII, raw
  `accepted_events` payload, raw `canonical_jsonb`, `request_id`, `session_id`,
  user identifier, IP, user-agent, header, or body value appears in this
  document.

This PR **records** an already-run, GO-scoped create/grant/proof. **This PR
reruns nothing**, applies no further change, and authorizes no downstream action.

---

## Evidence chain

- **PR #324** (`eab4662b3de8c7cf6e7d354494f7e1da9f5c822b`): merged
  `RISK_WORKER_DEDICATED_LOGIN_ROLE_COMMAND_PACK_PLANNING_ONLY` — the docs-only
  command-pack planning for creating and proving `buyerrecon_risk_worker`
  (Option B direct minimal grants; create with no password literal; password via
  interactive `\password`; readiness gate over `proof.safe.out`).
- A scoped `HELEN RISK WORKER DEDICATED LOGIN ROLE CREATE + GRANT + PROOF GO`
  authorized exactly one controlled execution of that command pack.

Chain context (from earlier merged evidence):
- PR #322 (`RISK_WORKER_LOGIN_ROLE_DISCOVERY_NO_USABLE_RUNTIME_ROLE`): no existing
  usable runtime role — `buyerrecon_scoring_worker` NOLOGIN; `buyerrecon_app`
  lacked `session_behavioural_features_v0_2` SELECT; `postgres` rejected as
  admin/superuser.
- PR #323 (`RISK_WORKER_DEDICATED_LOGIN_ROLE_PLANNING_ONLY`): recommended a
  dedicated minimal LOGIN role (`buyerrecon_risk_worker`) with exactly four
  direct grants.

The risk-evidence worker's required privilege set (from
`src/scoring/risk-evidence/worker.ts`): SELECT on `stage0_decisions` and
`session_behavioural_features_v0_2`; INSERT + UPDATE on `risk_observations_v0_1`.

---

## Evidence labels

```text
risk_worker_role_create_attempted=true
pr324_merge_present=true
tracked_working_tree_clean=true
candidate_role=buyerrecon_risk_worker
candidate_role_created=true
password_interactive_step_completed=true
candidate_role_exists_after=true
candidate_role_can_login_after=true
candidate_role_superuser_after=false
candidate_role_createdb_after=false
candidate_role_createrole_after=false
candidate_role_replication_after=false
candidate_role_bypassrls_after=false
risk_worker_stage0_decisions_select_privilege_after=true
risk_worker_session_behavioural_features_select_privilege_after=true
risk_worker_risk_observations_insert_privilege_after=true
risk_worker_risk_observations_update_privilege_after=true
risk_worker_unwanted_delete_privilege_after=false
risk_worker_unwanted_truncate_privilege_after=false
risk_worker_unwanted_references_privilege_after=false
risk_worker_unwanted_trigger_privilege_after=false
dedicated_risk_worker_role_proof_result=pass
db_mutation_executed=true
grants_or_role_changes_executed=dedicated_risk_worker_only
worker_executed=false
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
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

---

## Interpretation

- `buyerrecon_risk_worker` now **exists as a dedicated LOGIN role**
  (`candidate_role_created=true`, `candidate_role_exists_after=true`).
- The role **can login** (`candidate_role_can_login_after=true`).
- The role is **not superuser** and does **not** have `CREATEDB`, `CREATEROLE`,
  `REPLICATION`, or `BYPASSRLS` (`candidate_role_superuser_after=false`,
  `candidate_role_createdb_after=false`, `candidate_role_createrole_after=false`,
  `candidate_role_replication_after=false`, `candidate_role_bypassrls_after=false`).
- The role has **exactly the required risk-worker privileges**:
  - `SELECT` on `public.stage0_decisions`
    (`risk_worker_stage0_decisions_select_privilege_after=true`),
  - `SELECT` on `public.session_behavioural_features_v0_2`
    (`risk_worker_session_behavioural_features_select_privilege_after=true`),
  - `INSERT` on `public.risk_observations_v0_1`
    (`risk_worker_risk_observations_insert_privilege_after=true`),
  - `UPDATE` on `public.risk_observations_v0_1`
    (`risk_worker_risk_observations_update_privilege_after=true`).
- The role does **not** have unwanted `DELETE`, `TRUNCATE`, `REFERENCES`, or
  `TRIGGER` on `public.risk_observations_v0_1`
  (`risk_worker_unwanted_delete_privilege_after=false`,
  `risk_worker_unwanted_truncate_privilege_after=false`,
  `risk_worker_unwanted_references_privilege_after=false`,
  `risk_worker_unwanted_trigger_privilege_after=false`).
- The **password was set interactively via psql `\password`**
  (`password_interactive_step_completed=true`) and was **not** printed, logged,
  committed, stored, placed in argv/env, or rendered into SQL text.
- This was a **scoped DB mutation** — the single role creation plus the four
  approved grants (`db_mutation_executed=true`,
  `grants_or_role_changes_executed=dedicated_risk_worker_only`) — and **nothing
  else**: no other GRANT/REVOKE, no role change, no DDL/DML beyond this.
- This proof confirms the dedicated risk-worker login role is **ready to be used
  as the candidate `RISK_WORKER_ROLE`** for later proof paths.
- This **does not run or authorize the risk worker**.
- This **does not run or authorize Lane/scoring**.
- This **does not run or authorize AMS runtime**.
- This **does not produce or authorize customer output**.
- This **does not authorize Gate4E or Gate4F**.
- **No worker, Stage0 rerun, Step2E rerun, Route C rerun, downstream extractor,
  Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action occurred.**
- **No secret / raw / customer / request / session / IP / header / body values
  were printed.**
- **Next valid step after review/merge:** update/record the non-secret runtime
  role constants/registry (e.g. register `buyerrecon_risk_worker` in
  `.claude/constants.md` and/or the production runtime registry — its own
  separate reviewed change), **or** run the already-planned role-confirmation
  (PR #321) / post-Stage0 input-readiness (PR #320) proof using
  `buyerrecon_risk_worker` as `RISK_WORKER_ROLE` — each under its own separate
  explicit scoped Helen GO. Even a later PASS only makes the risk-evidence worker
  a candidate; it does not run the worker.

---

## Does NOT authorize

This PR does **NOT** authorize: running the risk worker, running the PR #321
confirmation diagnostic, running the PR #320 input-readiness proof, a Stage0
rerun, a Step2E rerun, a Route C rerun, any further GRANT/REVOKE or role change
beyond the already-run role creation and four grants, any other DB mutation,
credential rotation, custody rewrite, DSN discovery, host/port discovery,
`.env.production` inspection, `pg_hba` inspection, workers, downstream
extractors, Lane/scoring, AMS runtime, customer output, Gate4E, Gate4F, deploy,
or runtime command. Any next proof, registry update, or downstream action
requires its own separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, or env-var value. The role
was created with **no password clause in SQL text**; the password was set only at
the interactive psql `\password` prompt (hashed client-side) and was **never**
printed, echoed, logged, committed, stored in a shell variable, placed in argv or
env, or rendered into SQL text. The proof ran read-only catalog / privilege
checks (`pg_roles` attributes, `has_table_privilege`) inside a read-only
transaction with rollback; no rows, payloads, or canonical data were read or
printed — only **role attribute booleans** and **privilege booleans** were
recorded. The role names (`buyerrecon_risk_worker`, `buyerrecon_scoring_worker`,
`buyerrecon_app`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`,
`postgres`), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the module path, and the recorded commit hash are
**non-secret** database / repository / public-git identifiers. All values above
are safe labels / booleans / category tokens / non-secret identifiers / a public
git commit hash — not secret or row values. **This PR runs nothing.**
