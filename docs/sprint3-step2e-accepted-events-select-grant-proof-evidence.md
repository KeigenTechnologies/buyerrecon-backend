# Step2E `accepted_events` SELECT Grant + Proof PASS

## Status

**Status:** `STEP2E_ACCEPTED_EVENTS_SELECT_GRANT_PROOF_PASS`

- **Evidence-only.** **Docs-only.**
- PR #315 localized the likely Step2E collector privilege blocker to
  `accepted_events_select_privilege=false` for the collector/extractor app role
  `buyerrecon_prod_collector_app`.
- Under a fresh scoped `HELEN STEP2E ACCEPTED_EVENTS SELECT GRANT + PROOF GO`, **exactly one**
  narrow grant was executed — `GRANT SELECT ON TABLE public.accepted_events TO
  buyerrecon_prod_collector_app;` — and a read-only privilege proof confirmed the gap is closed.
- The proof confirms `accepted_events` SELECT is **now true**, the behavioural/session privileges
  **remain true**, and `stage0_decisions` SELECT **remains false** (the no-`stage0_decisions`-grant
  boundary is preserved).
- No Step2E rerun; no Stage0 rerun; no Route C rerun; no
  worker/downstream-extractor/Lane/scoring/AMS/customer-output; no Gate4E/Gate4F.
- **No** password, DSN, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, user identifier, IP, user-agent, header, or body value appears in this
  document.

This PR **records** an already-run, GO-scoped narrow grant and its passing proof. **This PR reruns
nothing**, applies no further change, and authorizes no Step2E rerun.

---

## Evidence chain

- **PR #315** (`f9b5932fb00559abcc4a2118156e9c0c69cd1166`): recorded
  `STEP2E_COLLECTOR_LOCALIZATION_ACCEPTED_EVENTS_SELECT_GAP` — collector auth passed, write-target
  privileges present, but `accepted_events_select_privilege=false` was the actionable likely
  blocker; next step was a **narrow `accepted_events` SELECT grant/proof path**.
- A fresh scoped `HELEN STEP2E ACCEPTED_EVENTS SELECT GRANT + PROOF GO` authorized exactly one
  narrow `SELECT`-only grant on `public.accepted_events` to `buyerrecon_prod_collector_app`, plus a
  read-only privilege proof.

Approved grant (single statement; non-secret schema/role identifiers only):

```text
GRANT SELECT ON TABLE public.accepted_events TO buyerrecon_prod_collector_app;
```

---

## Evidence labels

```text
step2e_accepted_events_select_grant_attempted=true
pr315_merge_present=true
tracked_working_tree_clean=true
grant_target_table=public.accepted_events
grant_target_role=buyerrecon_prod_collector_app
accepted_events_select_grant_executed=true
accepted_events_select_privilege_after=true
session_behavioural_features_select_privilege_after=true
session_behavioural_features_insert_privilege_after=true
session_behavioural_features_update_privilege_after=true
session_features_select_privilege_after=true
stage0_decisions_select_privilege_after=false
accepted_events_select_grant_proof_result=pass
db_mutation_executed=true
step2e_rerun_executed=false
stage0_rerun_executed=false
route_c_rerun_executed=false
workers_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
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

- PR #315 identified `accepted_events_select_privilege=false` as the **likely Step2E collector
  privilege blocker**.
- The approved grant applied **only `SELECT` on `public.accepted_events`** to
  `buyerrecon_prod_collector_app` (`grant_target_table=public.accepted_events`,
  `grant_target_role=buyerrecon_prod_collector_app`, `accepted_events_select_grant_executed=true`).
- The proof confirms **`accepted_events_select_privilege_after=true`** — the gap is closed.
- The proof confirms the **behavioural / session privileges remain true**:
  `session_behavioural_features_select_privilege_after=true`,
  `session_behavioural_features_insert_privilege_after=true`,
  `session_behavioural_features_update_privilege_after=true`,
  `session_features_select_privilege_after=true`.
- The proof confirms **`stage0_decisions_select_privilege_after=false`**, **preserving the
  no-`stage0_decisions`-grant boundary** established in PR #315 (`stage0_decisions` was not proven
  required by the Step2E script and was deliberately not granted).
- This was a **scoped DB mutation** — the single approved `SELECT` grant
  (`db_mutation_executed=true`) — and **nothing else**: no other GRANT/REVOKE, no role change, no
  DDL/DML beyond the one grant.
- This **fixes the `accepted_events` SELECT privilege gap only**.
- This **does not rerun Step2E**.
- This **does not authorize customer output, Lane/scoring, AMS runtime, Gate4E, or Gate4F**.
- **No worker, downstream extractor, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F
  action occurred.**
- **No secret / raw / customer / request / session / IP / header / body values were printed.**
- The **next valid action after review/merge is a sanitized Step2E rerun with `SINCE` supplied**,
  capturing **only safe labels** and **no raw payloads/errors** if it fails — under its own separate
  explicit scoped Helen GO.

---

## Does NOT authorize

This PR does **NOT** authorize: a Step2E rerun, a Stage0 rerun, a Route C rerun, any further fix or
remediation, any additional GRANT/REVOKE or role change (including any `stage0_decisions` grant) or
DB mutation beyond the already-run single `SELECT` grant, credential rotation, custody rewrite, DSN
discovery, host/port discovery, `.env.production` inspection, `pg_hba` inspection, workers,
downstream extractors, Lane/scoring, AMS runtime, customer output, Gate4E, Gate4F, deploy, or
runtime command. The sanitized Step2E rerun, and any further grant, require their own separate
explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated password, DSN URI,
connection string, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, or env-var value. The grant + proof ran a single approved
`SELECT` grant plus read-only privilege checks only; no rows, payloads, or canonical data were read
or printed — only **privilege booleans** were recorded. The collector DSN was constructed internally
in shell from a hidden password and was **never printed**. The grant statement, **table name**
(`public.accepted_events`), the other referenced **table names**, the **role name**
(`buyerrecon_prod_collector_app`), and the **database/schema identifiers** shown are non-secret
schema / role identifiers; the recorded commit hash is **public**. All values above are safe labels
/ booleans / category tokens / non-secret identifiers / a public git commit hash — not secret or row
values. **This PR runs nothing.**
