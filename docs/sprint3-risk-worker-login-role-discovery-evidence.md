# Risk-Worker LOGIN Role Discovery — No Usable Runtime Role

## Status

**Status:** `RISK_WORKER_LOGIN_ROLE_DISCOVERY_NO_USABLE_RUNTIME_ROLE`

- **Evidence-only.** **Docs-only.**
- After PR #321 (`RISK_WORKER_LOGIN_ROLE_CONFIRMATION_COMMAND_PACK_PLANNING_ONLY`)
  left `RISK_WORKER_ROLE` unknown, a scoped read-only **catalog discovery** was
  run to find LOGIN members of the NOLOGIN group role `buyerrecon_scoring_worker`.
- The checkout was first synced to include PR #321; discovery ran over the
  **local PostgreSQL admin read-only catalog path** (`sudo -u postgres`,
  `BEGIN READ ONLY … ROLLBACK`), querying catalog only
  (`pg_roles`, `pg_has_role`, `has_table_privilege`).
- The discovery **found two LOGIN members at the catalog level**
  (`discovery_result=candidate_found`), but **neither is an acceptable
  production risk-worker runtime identity** — hence the document status
  `RISK_WORKER_LOGIN_ROLE_DISCOVERY_NO_USABLE_RUNTIME_ROLE`.
- No DSN/env/secret was inspected; no grant or role change occurred; no worker
  ran; no Stage0/Step2E/Route C/Lane/scoring/AMS/customer-output/Gate4E/Gate4F
  action occurred.
- **No** password, DSN, host, port, connection string, env value, raw
  PostgreSQL error text, `pg_hba` raw line, customer payload, PII, raw
  `accepted_events` payload, raw `canonical_jsonb`, `request_id`, `session_id`,
  user identifier, IP, user-agent, header, or body value appears in this
  document. Role names are **non-secret database identifiers** required for
  candidate selection.

This PR **records** an already-run, GO-scoped read-only catalog discovery.
**This PR reruns nothing**, confirms no role, applies no grant, and authorizes
no downstream action.

---

## Evidence chain

- **PR #321** (`a3f9bcce59742ee7c1e2fa0a18ec05aae427d0c9`): merged
  `RISK_WORKER_LOGIN_ROLE_CONFIRMATION_COMMAND_PACK_PLANNING_ONLY` — a
  command-pack planning record for confirming a candidate risk-worker LOGIN
  role. That diagnostic requires a candidate role, which was still unknown.
- A scoped read-only catalog discovery was authorized to enumerate LOGIN members
  of `buyerrecon_scoring_worker` (the NOLOGIN group that holds the
  migration-intended scoring/risk privileges), so that a candidate — if any —
  could later be validated by the PR #321 confirmation diagnostic.

The risk-evidence worker's required privilege set (confirmed from source —
`src/scoring/risk-evidence/worker.ts`): SELECT on `stage0_decisions` and
`session_behavioural_features_v0_2`; INSERT + UPDATE on `risk_observations_v0_1`.

---

## Evidence labels

```text
scoring_worker_login_member_discovery_attempted=true
pr321_merge_present=true
tracked_working_tree_clean=true
buyerrecon_scoring_worker_exists=true
buyerrecon_scoring_worker_can_login=false
scoring_worker_login_member_count=2
candidate_risk_worker_login_role_1=buyerrecon_app
candidate_risk_worker_login_role_2=postgres
candidate_buyerrecon_app_can_login=true
candidate_buyerrecon_app_stage0_decisions_select_privilege=true
candidate_buyerrecon_app_session_behavioural_features_select_privilege=false
candidate_buyerrecon_app_risk_observations_insert_privilege=true
candidate_buyerrecon_app_risk_observations_update_privilege=true
candidate_postgres_can_login=true
candidate_postgres_stage0_decisions_select_privilege=true
candidate_postgres_session_behavioural_features_select_privilege=true
candidate_postgres_risk_observations_insert_privilege=true
candidate_postgres_risk_observations_update_privilege=true
db_mutation_executed=false
grants_or_role_changes_executed=false
worker_executed=false
stage0_rerun_executed=false
step2e_rerun_executed=false
route_c_rerun_executed=false
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
discovery_result=candidate_found
script_exit_code=0
```

---

## Interpretation

- `buyerrecon_scoring_worker` **exists but is NOLOGIN**
  (`buyerrecon_scoring_worker_exists=true`,
  `buyerrecon_scoring_worker_can_login=false`) — it is a group role only and
  must not be used directly as `RISK_WORKER_ROLE`.
- **Two LOGIN members were discovered** (`scoring_worker_login_member_count=2`):
  `buyerrecon_app` and `postgres`. At the raw catalog level this is a
  `candidate_found` result — but governance review of the two candidates yields
  **no acceptable runtime role**:
  - **`buyerrecon_app` — rejected (privilege gap):** it **fails the required
    risk-worker privilege set** because
    `candidate_buyerrecon_app_session_behavioural_features_select_privilege=false`.
    The risk worker reads `session_behavioural_features_v0_2`, so a missing
    SELECT there disqualifies it as-is. (Its `stage0_decisions` SELECT and
    `risk_observations_v0_1` INSERT/UPDATE are present, but the set is
    incomplete.)
  - **`postgres` — rejected (wrong class of role):** it has **all** privilege
    booleans `true`, but it is an **administrative / superuser role**, not an
    application worker role. Using a superuser as a production worker runtime
    identity violates least-privilege and role separation and **must not** be
    accepted as `RISK_WORKER_ROLE`.
- **Therefore no acceptable confirmed `RISK_WORKER_ROLE` exists from this
  discovery** — the document status is
  `RISK_WORKER_LOGIN_ROLE_DISCOVERY_NO_USABLE_RUNTIME_ROLE`. The raw
  `discovery_result=candidate_found` label reflects only that catalog members
  exist; it is **not** a usable-runtime-role verdict.
- This discovery **did not mutate the database** (`db_mutation_executed=false`),
  applied **no** grant or role change (`grants_or_role_changes_executed=false`),
  and ran **no** worker (`worker_executed=false`).
- **Do not run the PR #321 confirmation diagnostic with `postgres`.**
- **Do not run the PR #320 input-readiness proof with `postgres`.**
- **Do not run the risk worker.**
- **Next valid step:** planning for a **dedicated minimal risk/scoring worker
  LOGIN role** (least-privilege; a member of `buyerrecon_scoring_worker` or
  directly granted only the four required privileges — analogous to how
  `buyerrecon_stage0_runner` was provisioned), **or** a separately reviewed
  operator decision about an existing non-admin login role (e.g. closing the
  `buyerrecon_app` `session_behavioural_features_v0_2` SELECT gap — its own
  separate planning + review + scoped GO, not authorized here). Any new login
  role would also require registration in `.claude/constants.md` as its own
  reviewed change.

---

## Does NOT authorize

This PR does **NOT** authorize: running the PR #321 confirmation diagnostic
(with `postgres` or any role), running the PR #320 input-readiness proof,
running the risk worker, a Stage0 rerun, a Step2E rerun, a Route C rerun, any
GRANT/REVOKE or role change, any DB mutation, credential rotation, custody
rewrite, DSN discovery, host/port discovery, `.env.production` inspection,
`pg_hba` inspection, workers, downstream extractors, Lane/scoring, AMS runtime,
customer output, Gate4E, Gate4F, deploy, or runtime command. Selecting,
provisioning, or granting any risk-worker login role requires its own separate
explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, or env-var value. The
discovery ran read-only catalog checks only (`pg_roles`, `pg_has_role`,
`has_table_privilege`) inside a read-only transaction with rollback; no rows,
payloads, or canonical data were read or printed — only **role names**,
**privilege booleans**, a **member count**, and **category tokens**. The role
names (`buyerrecon_scoring_worker`, `buyerrecon_app`, `postgres`,
`buyerrecon_stage0_runner`), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the module path, and the recorded commit hash are
**non-secret** database / repository / public-git identifiers. All values above
are safe labels / booleans / counts / category tokens / non-secret identifiers /
a public git commit hash — not secret or row values. **This PR runs nothing.**
