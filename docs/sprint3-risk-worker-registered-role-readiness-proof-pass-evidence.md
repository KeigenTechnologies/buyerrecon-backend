# Registered Risk-Worker Role — Readiness Proof PASS

## Status

**Status:** `RISK_WORKER_REGISTERED_ROLE_READINESS_PROOF_PASS`

- **Evidence-only.** **Docs-only.**
- Under a scoped `HELEN RISK WORKER REGISTERED ROLE READINESS PROOF GO`, the
  operator ran **exactly one** local-admin PostgreSQL **read-only** proof
  transaction on the production host, using the registered role identity
  `RISK_WORKER_ROLE=buyerrecon_risk_worker`.
- The proof verified the PR #321 role-confirmation assumptions (role exists, can
  login, least-privilege attributes, the four required privileges, no unwanted
  privileges) **and** the PR #320 downstream-input-readiness assumptions
  (required input tables present and populated at aggregate level).
- **No DB mutation** occurred; **no role/grant change** occurred; **no
  worker/runtime/customer/Gate** action occurred.
- **No** password, DSN, host, port, connection string, env value, raw PostgreSQL
  error text, `pg_hba` raw line, customer payload, raw `accepted_events`
  payload, raw `canonical_jsonb`, `request_id`, `session_id`, user identifier,
  IP, user-agent, header, or body value appears in this document.

This PR **records** an already-run, GO-scoped read-only readiness proof. **This
PR reruns nothing**, mutates nothing, and authorizes no downstream action.

---

## Evidence chain

- **PR #326** (`b3ea292d640cbd9e9ec8b9e0f5594919ec3c585c`): registered
  `RISK_WORKER_ROLE=buyerrecon_risk_worker` in `.claude/constants.md` as a
  non-secret role identity (status `RISK_WORKER_ROLE_REGISTERED_DOC_ONLY`;
  registered, not yet guardrail-enforced).
- **PR #325** (`RISK_WORKER_DEDICATED_LOGIN_ROLE_PROOF_PASS`): recorded the
  create/grant/proof PASS for `buyerrecon_risk_worker`.
- A scoped `HELEN RISK WORKER REGISTERED ROLE READINESS PROOF GO` authorized
  exactly one read-only proof transaction combining the PR #321 role-confirmation
  checks and the PR #320 downstream-input-readiness checks under the registered
  role.

The risk-evidence worker's required privilege set (from
`src/scoring/risk-evidence/worker.ts`): SELECT on `stage0_decisions` and
`session_behavioural_features_v0_2`; INSERT + UPDATE on `risk_observations_v0_1`.

---

## Evidence labels

```text
registered_risk_worker_role_readiness_attempted=true
pr326_merge_present=true
tracked_working_tree_clean=true
risk_worker_role_constant_present=true
risk_worker_role_constant_value=buyerrecon_risk_worker
risk_worker_role_registered_not_enforced=true
candidate_role=buyerrecon_risk_worker
candidate_role_exists=true
candidate_role_can_login=true
candidate_role_superuser=false
candidate_role_createdb=false
candidate_role_createrole=false
candidate_role_replication=false
candidate_role_bypassrls=false
risk_worker_stage0_decisions_select_privilege=true
risk_worker_session_behavioural_features_select_privilege=true
risk_worker_risk_observations_insert_privilege=true
risk_worker_risk_observations_update_privilege=true
risk_worker_unwanted_delete_privilege=false
risk_worker_unwanted_truncate_privilege=false
risk_worker_unwanted_references_privilege=false
risk_worker_unwanted_trigger_privilege=false
stage0_decisions_table_present=true
session_behavioural_features_table_present=true
risk_observations_table_present=true
stage0_decisions_nonzero_count=true
session_behavioural_features_nonzero_count=true
registered_risk_worker_role_readiness_proof_result=pass
db_mutation_executed=false
role_or_grant_change_executed=false
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

- The registered non-secret role identity
  `RISK_WORKER_ROLE=buyerrecon_risk_worker` is **present in
  `.claude/constants.md`** (`risk_worker_role_constant_present=true`,
  `risk_worker_role_constant_value=buyerrecon_risk_worker`).
- The registration remains **registered-not-enforced / doc-only**
  (`risk_worker_role_registered_not_enforced=true`).
- `buyerrecon_risk_worker` **exists and can login**
  (`candidate_role_exists=true`, `candidate_role_can_login=true`).
- The role is **not superuser** and does **not** have `CREATEDB`, `CREATEROLE`,
  `REPLICATION`, or `BYPASSRLS` (`candidate_role_superuser=false`,
  `candidate_role_createdb=false`, `candidate_role_createrole=false`,
  `candidate_role_replication=false`, `candidate_role_bypassrls=false`).
- The role has the **required minimal privileges**:
  - `SELECT` on `public.stage0_decisions`
    (`risk_worker_stage0_decisions_select_privilege=true`),
  - `SELECT` on `public.session_behavioural_features_v0_2`
    (`risk_worker_session_behavioural_features_select_privilege=true`),
  - `INSERT` on `public.risk_observations_v0_1`
    (`risk_worker_risk_observations_insert_privilege=true`),
  - `UPDATE` on `public.risk_observations_v0_1`
    (`risk_worker_risk_observations_update_privilege=true`).
- The role does **not** have unwanted `DELETE`, `TRUNCATE`, `REFERENCES`, or
  `TRIGGER` on `public.risk_observations_v0_1`
  (`risk_worker_unwanted_delete_privilege=false`,
  `risk_worker_unwanted_truncate_privilege=false`,
  `risk_worker_unwanted_references_privilege=false`,
  `risk_worker_unwanted_trigger_privilege=false`).
- The **required downstream input tables are present**
  (`stage0_decisions_table_present=true`,
  `session_behavioural_features_table_present=true`,
  `risk_observations_table_present=true`).
- `stage0_decisions` has a **nonzero aggregate count**
  (`stage0_decisions_nonzero_count=true`).
- `session_behavioural_features_v0_2` has a **nonzero aggregate count**
  (`session_behavioural_features_nonzero_count=true`).
- This was a **read-only proof transaction** — `db_mutation_executed=false`.
- **No role/grant change occurred** (`role_or_grant_change_executed=false`).
- **No worker was run** (`worker_executed=false`).
- **No runtime/customer/Gate action occurred.**
- This **PASS proves `buyerrecon_risk_worker` is a registered and
  readiness-proofed role candidate** for future separately GO-gated risk-worker
  proof / runtime paths.
- This **does not authorize running the risk worker**.
- This **does not authorize Lane/scoring**.
- This **does not authorize AMS runtime**.
- This **does not authorize customer output**.
- This **does not authorize Gate4E or Gate4F**.
- **No secret / raw / customer / request / session / IP / header / body values
  were printed.**

---

## Does NOT authorize

This PR does **NOT** authorize: running the risk worker, a Stage0 rerun, a
Step2E rerun, a Route C rerun, any GRANT/REVOKE/CREATE ROLE/ALTER ROLE/DROP ROLE
or other role change, any DB mutation, credential rotation, custody rewrite, DSN
discovery, host/port discovery, `.env.production` inspection, `pg_hba`
inspection, workers, downstream extractors, Lane/scoring, AMS runtime, customer
output, Gate4E, Gate4F, deploy, or runtime command. Any next proof or downstream
action requires its own separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, or env-var value. The proof
ran read-only catalog / privilege / aggregate-count checks only (`pg_roles`
attributes, `has_table_privilege`, table-presence via `to_regclass`, `COUNT(*)`)
inside a read-only transaction with rollback; no rows, payloads, or canonical
data were read or printed — only **role attribute booleans**, **privilege
booleans**, **table-presence booleans**, and **nonzero-count booleans** were
recorded. The role names (`buyerrecon_risk_worker`, `buyerrecon_scoring_worker`,
`buyerrecon_app`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`),
the table names (`stage0_decisions`, `session_behavioural_features_v0_2`,
`risk_observations_v0_1`), the database name (`buyerrecon_production`), the
module path, and the recorded commit hash are **non-secret** database /
repository / public-git identifiers. All values above are safe labels / booleans
/ category tokens / non-secret identifiers / a public git commit hash — not
secret or row values. **This PR runs nothing.**
