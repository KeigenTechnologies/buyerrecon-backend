# Step2E Collector-Identity Localization — `accepted_events` SELECT Gap

## Status

**Status:** `STEP2E_COLLECTOR_LOCALIZATION_ACCEPTED_EVENTS_SELECT_GAP`

- **Evidence-only.** **Docs-only.**
- After PR #314 fixed collector auth, a **sanitized collector-identity failure-localization rerun**
  was executed **with `SINCE` supplied**, under the correct collector/extractor identity
  `buyerrecon_prod_collector_app`. **This was localization only** — Step2E itself was **not** rerun.
- The localization used **static script checks** plus **read-only** table-presence and privilege
  checks inside an explicit read-only transaction. **No DB mutation occurred.**
- It localizes the likely Step2E blocker to a **missing `accepted_events` SELECT privilege** for
  `buyerrecon_prod_collector_app`, even though the behavioural write-target privileges are present.
- No Step2E rerun; no Stage0 rerun; no Route C rerun; no auth retry; **no grants or role changes**;
  no worker/downstream-extractor/Lane/scoring/AMS/customer-output; no Gate4E/Gate4F.
- **No** password, DSN, host, port, connection string, env value, raw PostgreSQL error text,
  `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`, customer payload, PII,
  `request_id`, `session_id`, user identifier, IP, user-agent, header, or body value appears in this
  document.

This PR **records** an already-run, GO-scoped read-only localization rerun. **This PR reruns
nothing**, grants nothing, and authorizes no Step2E rerun.

---

## Evidence chain

- **PR #314** (`bef778d3c35956a58f5d3ff7709e7a70b4da647b`): recorded
  `COLLECTOR_PASSWORD_RESYNC_AUTH_PREFLIGHT_PASS` — the collector auth blocker was fixed and the
  auth preflight passed as `buyerrecon_prod_collector_app` against `buyerrecon_production`.
- PR #313 had recorded `STEP2E_CORRECT_IDENTITY_RERUN_BLOCKED_OR_FAILED` with the next step being a
  sanitized collector-identity failure-localization rerun (likely with `SINCE`).
- A fresh scoped GO authorized exactly that: a **read-only** localization rerun under the collector
  identity with `SINCE` supplied — no Step2E rerun, no mutation, no grants.

Reviewed Step2E command (confirmed by static discovery; non-secret repo identifier):

```text
extract:behavioural-features = tsx scripts/extract-behavioural-features.ts
```

The script statically references `DATABASE_URL`, `SINCE`, `accepted_events`,
`session_behavioural_features`, and `session_features` (non-secret repository identifiers; no env
values shown). It does **not** reference `EXTRACTION_VERSION`.

---

## Evidence labels

```text
step2e_collector_failure_localization_corrected_attempted=true
pr314_merge_present=true
tracked_working_tree_clean=true
step2e_command_present=true
step2e_script_file_present=true
step2e_script_mentions_database_url=true
step2e_script_mentions_since=true
step2e_script_mentions_extraction_version=false
step2e_script_mentions_accepted_events=true
step2e_script_mentions_session_behavioural_features=true
step2e_script_mentions_session_features=true
since_env_present=true
extraction_version_env_present=false
collector_extractor_dsn_available=true
auth_user_expected=true
auth_database_expected=true
connect_effective=true
collector_auth_probe_result=pass
accepted_events_table_present=true
session_behavioural_features_table_present=true
session_features_table_present=true
stage0_decisions_table_present=true
accepted_events_select_privilege=false
session_behavioural_features_select_privilege=true
session_behavioural_features_insert_privilege=true
session_behavioural_features_update_privilege=true
session_features_select_privilege=true
stage0_decisions_select_privilege=false
collector_privilege_metadata_result=pass
accepted_events_aggregate_count=unknown
stage0_decisions_aggregate_count=unknown
collector_aggregate_count_result=blocked_or_failed
step2e_failure_likely_class=localization_query_shape_or_privilege_unknown
psql_executed=true
sql_executed=true
read_only_transaction=true
db_mutation_executed=false
step2e_rerun_executed=false
stage0_rerun_executed=false
route_c_rerun_executed=false
auth_retry_executed=false
grants_or_role_changes_executed=false
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

- **Collector auth is now fixed and passed** (`connect_effective=true`,
  `collector_auth_probe_result=pass`, `auth_user_expected=true`, `auth_database_expected=true`).
- **`SINCE` was supplied** (`since_env_present=true`); `EXTRACTION_VERSION` was neither referenced by
  the script nor present in the environment (`step2e_script_mentions_extraction_version=false`,
  `extraction_version_env_present=false`).
- The Step2E script **statically mentions** `accepted_events`, `session_behavioural_features`, and
  `session_features` (`step2e_command_present=true`, `step2e_script_file_present=true`).
- `buyerrecon_prod_collector_app` **has the required privileges on
  `session_behavioural_features_v0_2`**: SELECT=true, INSERT=true, UPDATE=true
  (`session_behavioural_features_select_privilege=true`,
  `session_behavioural_features_insert_privilege=true`,
  `session_behavioural_features_update_privilege=true`).
- `buyerrecon_prod_collector_app` **has `session_features` SELECT=true**
  (`session_features_select_privilege=true`).
- `buyerrecon_prod_collector_app` **lacks `accepted_events` SELECT**
  (`accepted_events_select_privilege=false`). **This is the likely Step2E privilege blocker** —
  the extractor reads `accepted_events` as its source table.
- The previous classifier label `localization_query_shape_or_privilege_unknown` is **too broad**;
  the **actionable sub-signal** is `accepted_events_select_privilege=false`.
- The aggregate-count probe was **blocked/failed** (`collector_aggregate_count_result=blocked_or_failed`,
  `accepted_events_aggregate_count=unknown`, `stage0_decisions_aggregate_count=unknown`) —
  consistent with the missing `accepted_events` SELECT; no row data was read or printed.
- `stage0_decisions_select_privilege=false` was observed, **but `stage0_decisions` was only part of
  the diagnostic count check and is not proven required by the Step2E script**.
  **Do not grant `stage0_decisions` SELECT based on this evidence alone.**
- The privilege-metadata probe itself completed cleanly (`collector_privilege_metadata_result=pass`);
  all probing was inside an explicit **read-only transaction** (`read_only_transaction=true`,
  `db_mutation_executed=false`).
- **No rerun, fix, grant, or role change occurred.** Step2E, Stage0, and Route C were not rerun; no
  auth retry; no grants/role changes; no worker, downstream extractor, Lane/scoring, AMS runtime,
  customer output, Gate4E, or Gate4F action.
- **No secret / raw / customer / request / session / IP / header / body values were printed.**
- The **next valid action is a narrow `accepted_events` SELECT grant/proof path** for
  `buyerrecon_prod_collector_app`, under its own separate explicit scoped Helen GO.
- **Do not rerun Step2E until that grant is reviewed/proofed.**

---

## Does NOT authorize

This PR does **NOT** authorize: a Step2E rerun, a Stage0 rerun, a Route C rerun, an auth retry, any
fix or remediation, DB mutation, GRANT/REVOKE or role change (including any `accepted_events` or
`stage0_decisions` grant), credential rotation, custody rewrite, DSN discovery, host/port discovery,
`.env.production` inspection, `pg_hba` inspection, workers, downstream extractors, Lane/scoring, AMS
runtime, customer output, Gate4E, Gate4F, deploy, or runtime command. The narrow `accepted_events`
SELECT grant/proof path, and any rerun, require their own separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated password, DSN URI,
connection string, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, or env-var value. The localization ran read-only static and
privilege/metadata checks only; no rows, payloads, or canonical data were read or printed — only
**table-presence booleans**, **privilege booleans**, and **`unknown` aggregate-count category
tokens** were recorded. The collector DSN was constructed internally in shell from a hidden password
and was **never printed**. The `package.json` **script name**, the `scripts/*.ts` **file path**, the
referenced **table names**, the **env-var names** (`DATABASE_URL`, `SINCE`), the **role name**
(`buyerrecon_prod_collector_app`), and the **database name** (`buyerrecon_production`) shown are
non-secret repository / role / database identifiers; the recorded commit hash is **public**. All
values above are safe labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
