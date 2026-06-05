# Sprint 3 - `accepted_events` Read-Privilege Pre-Check Diagnostic GO (Docs-Only)

> **DOCS-ONLY PRE-CHECK DIAGNOSTIC GO PLANNING RECORD. THIS PR
> DOES NOT EXECUTE.** It records the operator plan for one bounded
> read-only diagnostic session to confirm the app role now has the
> exact `accepted_events` read privileges required by
> `scripts/extract-behavioural-features.ts`, including the
> `consent_state` grant proof merged in PR #127. This PR runs no
> production command, runs no diagnostic, applies no grant, runs no
> extractor or worker, writes no data, opens no Gate 4E, and invents
> no Gate 4F. No secrets, no raw identifiers, no payloads, and no
> customer data.

---

## 1. Status

- **Status:** `ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_DIAGNOSTIC_GO_PLANNING`
- **Immediate prerequisite:** PR #127
  (`docs/sprint3-accepted-events-consent-state-grant-proof.md`,
  merged `2026-06-05T15:57:53Z`, commit
  `487d7488691afb44706203f8a0ba98768a477283`)
- **Purpose:** authorize a later, separate, read-only pre-check
  diagnostic session before any behavioural extractor execution.

**Authorization granted by this PR after merge only:**

- `precheck_diagnostic_go_recorded=true`
- `read_only_privilege_checks_only=true`
- `begin_read_only_rollback_required=true`
- `psql_on_error_stop_required=true`
- `app_role_required=true`
- `post_diagnostic_evidence_pr_required=true`
- `single_diagnostic_session_only=true`

**Still false and not authorized by this PR:**

- `diagnostic_run_by_this_pr=false`
- `grant_authorised_by_this_pr=false`
- `extractor_authorised_by_this_pr=false`
- `extractor_run_by_this_pr=false`
- `stage0_authorised_by_this_pr=false`
- `risk_worker_authorised_by_this_pr=false`
- `poi_worker_authorised_by_this_pr=false`
- `evidence_snapshot_authorised_by_this_pr=false`
- `lane_preview_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_authorised_by_this_pr=false`

---

## 2. Diagnostic objective

The later diagnostic must verify all of the following before the
behavioural extractor can receive any separate execution GO:

1. The session role is exactly `buyerrecon_prod_collector_app`.
2. The database is exactly `buyerrecon_production`.
3. `transaction_read_only` is `on`.
4. Table-level `SELECT` on `public.accepted_events` remains `false`.
5. `consent_state` column-level `SELECT` is now `true` after PR #127.
6. Every `accepted_events` column directly required by
   `scripts/extract-behavioural-features.ts` is `true`.
7. Unsafe or intentionally excluded columns remain denied:
   `ip_hash=false` and `request_id=false`.
8. `raw` and `canonical_jsonb` status is recorded as prior
   carry-forward privilege state, not as a privilege newly changed
   by this PR or by the diagnostic.
9. No `accepted_events` rows are read.
10. No raw identifiers, payloads, DSNs, secrets, or customer data are
    printed.

---

## 3. Extractor-required column set

Repo inspection of `scripts/extract-behavioural-features.ts` shows
that the behavioural extractor reads `accepted_events` through the
`candidate_sessions` and `session_events` CTEs.

| Column | Why required | Expected privilege |
| --- | --- | --- |
| `event_id` | event ordering and endpoint features | `true` |
| `workspace_id` | session key and optional filter | `true` |
| `site_id` | session key and optional filter | `true` |
| `session_id` | session key | `true` |
| `received_at` | window filter and timing features | `true` |
| `event_contract_version` | browser contract filter | `true` |
| `event_origin` | browser-origin filter | `true` |
| `consent_state` | consent landmark aggregation | `true` |
| `raw` | `raw->>'event_name'` and `raw->>'page_path'` only | `true` |

`canonical_jsonb` is not a direct behavioural extractor input in the
current script. It must still be reported as a prior carry-forward
privilege status because PR #127 proved it remained `t -> t` and was
not changed by the `consent_state` grant session.

`ip_hash` and `request_id` must remain `false`.

---

## 4. Operator command plan

The commands below are a plan for the later operator session after
this PR merges. They must not be run by this PR.

Requirements:

- Use `psql -v ON_ERROR_STOP=1`.
- Use the production app DSN silently.
- Do not echo, log, paste, or print the DSN, password, or token.
- Wrap the checks in `BEGIN READ ONLY; ... ROLLBACK;`.
- Emit only role/database/read-only status and boolean privilege
  results.
- Do not use `SELECT *`.
- Do not select from `public.accepted_events`.
- Do not print `session_id`, `request_id`, UUID, IP, user agent,
  `raw`, `canonical_jsonb`, accepted_events row data, or customer
  payload values.

```bash
cd /opt/buyerrecon-backend || exit 1

# Load the production app DSN into APP_DSN silently from .env.production.
# The value must never be printed.
[ -n "$APP_DSN" ] || { echo "ERROR: APP_DSN not loaded - stop"; exit 1; }

psql -v ON_ERROR_STOP=1 --no-password --tuples-only --no-align -d "$APP_DSN" <<'SQL'
BEGIN READ ONLY;

-- P1: role, database, and read-only gate
SELECT
  'ROLE_GATE'
  || '|' || current_user
  || '|' || current_database()
  || '|' || current_setting('transaction_read_only') AS role_gate;

-- P2: accepted_events table boundary and extractor-required columns
SELECT
  'AE_PRECHECK'
  || '|ae_table_select=' || has_table_privilege(
       current_user, 'public.accepted_events', 'SELECT')
  || '|event_id_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'event_id', 'SELECT')
  || '|workspace_id_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'workspace_id', 'SELECT')
  || '|site_id_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'site_id', 'SELECT')
  || '|session_id_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'session_id', 'SELECT')
  || '|received_at_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'received_at', 'SELECT')
  || '|event_contract_version_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'event_contract_version', 'SELECT')
  || '|event_origin_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'event_origin', 'SELECT')
  || '|consent_state_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'consent_state', 'SELECT')
  || '|raw_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'raw', 'SELECT')
  || '|canonical_jsonb_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'canonical_jsonb', 'SELECT')
  || '|ip_hash_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'ip_hash', 'SELECT')
  || '|request_id_sel=' || has_column_privilege(
       current_user, 'public.accepted_events', 'request_id', 'SELECT')
  AS accepted_events_privilege_precheck;

ROLLBACK;
SQL
```

Expected safe interpretation:

```text
ROLE_GATE|buyerrecon_prod_collector_app|buyerrecon_production|on
AE_PRECHECK|ae_table_select=f|event_id_sel=t|workspace_id_sel=t|site_id_sel=t|session_id_sel=t|received_at_sel=t|event_contract_version_sel=t|event_origin_sel=t|consent_state_sel=t|raw_sel=t|canonical_jsonb_sel=t|ip_hash_sel=f|request_id_sel=f
```

`raw_sel=t` and `canonical_jsonb_sel=t` must be documented as prior
carry-forward privileges, not newly authorized or newly changed by
this diagnostic.

---

## 5. Required evidence PR after the diagnostic

The later diagnostic evidence PR must include only:

| Evidence item | Required result |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |
| `transaction_read_only` | `on` |
| `ae_table_select` | `false` |
| All extractor-required columns | `true` |
| `consent_state_sel` | `true` |
| `raw_sel` | `true`, prior carry-forward |
| `canonical_jsonb_sel` | `true`, prior carry-forward |
| `ip_hash_sel` | `false` |
| `request_id_sel` | `false` |
| No `accepted_events` row reads | Confirmed |
| No raw identifiers or payloads printed | Confirmed |
| No DSN/password/token printed | Confirmed |
| No grant, DML, or DDL attempted | Confirmed |
| No extractor or worker run | Confirmed |

The evidence PR must not contain DSNs, passwords, tokens, raw UUIDs,
`session_id` values, `request_id` values, IP addresses, user agents,
raw rows, `accepted_events` row data, raw payloads,
`canonical_jsonb` payloads, or customer data.

---

## 6. Stop-lines

Stop immediately if any of the following appears or occurs:

| Stop-line | Action |
| --- | --- |
| Database is not `buyerrecon_production` | Stop |
| Role is not `buyerrecon_prod_collector_app` | Stop |
| `transaction_read_only` is not `on` | Stop |
| `consent_state_sel` is still `false` | Stop |
| Any extractor-required accepted_events column is `false` | Stop |
| Table-level accepted_events `SELECT` is `true` | Stop |
| `ip_hash_sel` is `true` | Stop |
| `request_id_sel` is `true` | Stop |
| DSN, password, token, or secret would be printed | Stop |
| Any raw identifier, payload, row data, or customer data would be printed | Stop |
| Any extractor or worker command is attempted | Stop |
| Any GRANT, DML, or DDL is attempted | Stop |
| Gate 4E opening, readiness, or automatic-advance language appears | Stop |
| Gate 4F language appears | Stop |

---

## 7. Carry-forward gating

If the later diagnostic passes, the next step is still a separate
behavioural extractor execution GO PR and a separate operator
session. This PR must not authorize the behavioural extractor
directly.

Required sequence:

1. Merge this pre-check diagnostic GO planning PR.
2. Run the bounded read-only diagnostic in a separate operator
   session.
3. Open a docs-only diagnostic evidence PR.
4. After that evidence passes review and merges, open a separate
   behavioural extractor execution GO PR.
5. Only after that separate extractor GO is authorized may the
   behavioural extractor be run.

---

## 8. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_DIAGNOSTIC_GO_PLANNING
pr127_merge_commit: 487d7488691afb44706203f8a0ba98768a477283
pr127_merged_at: "2026-06-05T15:57:53Z"
role_required: buyerrecon_prod_collector_app
database_required: buyerrecon_production
transaction_read_only_required: true
psql_on_error_stop_required: true
begin_read_only_rollback_required: true
diagnostic_run_by_this_pr: false
grant_authorised_by_this_pr: false
extractor_authorised_by_this_pr: false
extractor_run_by_this_pr: false
worker_authorised_by_this_pr: false
stage0_authorised_by_this_pr: false
risk_worker_authorised_by_this_pr: false
poi_worker_authorised_by_this_pr: false
evidence_snapshot_authorised_by_this_pr: false
lane_preview_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_authorised_by_this_pr: false
accepted_events_table_select_expected: false
consent_state_select_expected: true
ip_hash_select_expected: false
request_id_select_expected: false
raw_select_expected: true
raw_select_status: prior_carry_forward_not_new
canonical_jsonb_select_expected: true
canonical_jsonb_select_status: prior_carry_forward_not_new
extractor_required_accepted_events_columns:
  - event_id
  - workspace_id
  - site_id
  - session_id
  - received_at
  - event_contract_version
  - event_origin
  - consent_state
  - raw
no_row_reads_required: true
no_select_star: true
no_raw_payload_output: true
no_customer_data_output: true
post_diagnostic_evidence_pr_required: true
next_step_after_pass: separate_behavioural_extractor_execution_go_pr
```

---

## 9. Hard boundaries

This PR does **not**:

- run the diagnostic
- run any production command
- apply any DB grant or change privileges
- run the behavioural extractor
- run Stage 0
- run any risk worker, POI worker, or downstream worker
- create an evidence snapshot
- activate Lane preview, Lane writes, scoring runtime, customer
  output, or AMS Trust / Pass runtime
- change backend code, scripts, package files, migrations, schema,
  env files, deployment files, website files, AMS files, runtime
  files, worker files, or customer-output artifacts
- open Gate 4E
- invent Gate 4F
- reproduce DSNs, passwords, tokens, raw UUIDs, raw `session_id`
  values, raw `request_id` values, IP addresses, user agents,
  raw rows, `accepted_events` row data, raw payloads,
  `canonical_jsonb` payloads, or customer data

It records the accepted_events read-privilege pre-check diagnostic
GO planning only.
