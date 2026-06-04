# Sprint 3 — `accepted_events` Read Privilege Diagnostic GO (Docs-Only)

> **DOCS-ONLY OPERATOR GO RECORD. THIS PR DOES NOT EXECUTE.** It
> records Helen's explicit GO for one bounded read-only diagnostic
> session to inspect `accepted_events` read privileges for
> `buyerrecon_prod_collector_app`. The diagnostic happens **only**
> in a later, separate operator session after this PR merges. This
> PR runs no queries, applies no grants, contacts no production
> environment, does not run the extractor, and does not open Gate
> 4E. No secrets, no raw payloads, no raw `request_id` /
> `session_id`.

---

## 1. Status

- **Status:** `ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_GO_PLANNING`
- **Planning source:** PR #117
  (`docs/sprint3-accepted-events-read-privilege-diagnostic-planning.md`,
  merged `2026-06-04T21:43:28Z`, commit
  `7f2e84c86fa0ac0d8efb7af56e3feca424566127`)

**Authorization granted by this PR (after merge only):**

- `diagnostic_go_recorded=true`
- `read_only_queries_only=true`
- `begin_read_only_rollback_required=true`
- `post_diagnostic_evidence_pr_required=true`
- `single_session_only=true`

**Still false (NOT authorized by this PR):**

- `grant_authorised_by_this_pr=false`
- `extractor_authorised_by_this_pr=false`
- `schema_change_authorised_by_this_pr=false`
- `worker_activation_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_authorised_by_this_pr=false`
- `diagnostic_before_this_pr_merges_authorised=false`

---

## 2. Helen GO statement

> **Helen authorizes the operator to execute one bounded read-only
> diagnostic session against `buyerrecon_production` using the app
> role loaded from `.env.production`, strictly per the query scope
> in §3. All queries must run inside explicit
> `BEGIN READ ONLY ... ROLLBACK` blocks. No GRANT. No DDL. No DML.
> No extractor run.**

**No diagnostic before this PR is merged.**

---

## 3. Authorized diagnostic queries

All queries must run inside `BEGIN READ ONLY ... ROLLBACK`. Do not
use PGOPTIONS-only for read-only enforcement (carry-forward from
PR #106 session).

### Session setup

```bash
cd /opt/buyerrecon-backend || exit 1

# Load app DSN silently
export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN loaded" || { echo "ERROR: APP_DSN not loaded — stop"; exit 1; }

# Confirm DB name only
DATABASE_URL="$APP_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('db_name:', u.pathname.replace(/^\//, ''));
"
```

Expected: `db_name: buyerrecon_production`. If not — **stop.**

### Diagnostic queries

```bash
psql --no-password --tuples-only --no-align -d "$APP_DSN" <<'SQL'
BEGIN READ ONLY;

-- D1: Role / database / read-only confirmation
SELECT current_user,
       current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

-- D2: Schema USAGE
SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage;

-- D3: Table-level SELECT on accepted_events
SELECT has_table_privilege(current_user,
       'public.accepted_events', 'SELECT') AS ae_table_select;

-- D4: Column-level SELECT on all 11 extractor-required columns
SELECT
  has_column_privilege(current_user, 'public.accepted_events', 'event_id',               'SELECT') AS event_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'workspace_id',            'SELECT') AS workspace_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'site_id',                 'SELECT') AS site_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'session_id',              'SELECT') AS session_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'received_at',             'SELECT') AS received_at_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'raw',                     'SELECT') AS raw_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'consent_source',          'SELECT') AS consent_source_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'schema_key',              'SELECT') AS schema_key_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'canonical_jsonb',         'SELECT') AS canonical_jsonb_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'event_contract_version',  'SELECT') AS ecv_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'event_origin',            'SELECT') AS eo_sel;

-- D5: PR #87 already-granted columns — confirm still in place
SELECT
  has_column_privilege(current_user, 'public.accepted_events', 'workspace_id',    'SELECT') AS ws_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'site_id',         'SELECT') AS site_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'client_event_id', 'SELECT') AS cev_sel;

-- D6: RLS state
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'accepted_events'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- D7: Trigger count
SELECT COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'accepted_events';

ROLLBACK;
SQL
```

---

## 4. Required evidence from the diagnostic session

The results must be recorded in a post-diagnostic docs-only evidence
PR. That PR must include (no DSNs, no secrets, no raw data):

| Evidence item | Format |
| --- | --- |
| `current_user` | Role name |
| `current_database()` | DB name |
| `txn_read_only` | `on` |
| `schema_usage` (D2) | bool |
| `ae_table_select` (D3) | bool |
| All 11 column SELECT booleans (D4) | `event_id_sel`, `workspace_id_sel`, … |
| PR #87 column confirmations (D5) | `ws_sel`, `site_sel`, `cev_sel` |
| `relrowsecurity` / `relforcerowsecurity` (D6) | two booleans |
| `trigger_count` (D7) | integer |
| No raw accepted_events row data | Confirmed |
| No GRANT / DDL / DML executed | Confirmed |
| No extractor run | Confirmed |
| Categorical diagnosis | One of: `table_select_missing_only`, `column_select_partial`, `schema_usage_missing`, `rls_or_trigger_blocker`, `wrong_role_or_db`, `multiple_gaps` |

---

## 5. Stop-lines

Halt the session immediately if any of the following:

| Stop-line | Action |
| --- | --- |
| Any query runs outside `BEGIN READ ONLY ... ROLLBACK` | Stop immediately |
| Any GRANT / ALTER / DDL / DML appears | Stop |
| A DSN, password, token, or secret would be printed | Stop — do not run |
| Any raw `accepted_events` row data would be selected | Stop — do not run |
| Extractor rerun command appears | Stop |
| Downstream worker run command appears | Stop |
| Customer output / Lane / scoring / AMS Trust-Pass activation language | Stop |
| Gate 4E opening, readiness, or automatic-advance language | Stop |
| Gate 4F language | Stop |

---

## 6. Governance locks carry-forward

| Lock | State |
| --- | --- |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `customer_visibility_allowed` | false |
| `lane_write_allowed` | false |
| `allowed_customer_language` | `[]` |
| `SAFE_CLAIMS_DICTIONARY` | `Object.freeze({})` — empty |
| PR#18ab locks | In force |
| Lane A/B row counts | Must remain `0/0` |
| Migration 016 grant safety | In force |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 7. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_GO_PLANNING
planning_source: PR_117_ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_PLANNING
pr117_merge_commit: 7f2e84c86fa0ac0d8efb7af56e3feca424566127
diagnostic_go_recorded: true
diagnostic_before_this_pr_merges_authorised: false
begin_read_only_rollback_required: true
pgoptions_not_relied_on: true
session_role: app_role_via_DATABASE_URL_from_env_production
post_diagnostic_evidence_pr_required: true
single_session_only: true
extractor_columns_checked:
  - event_id
  - workspace_id
  - site_id
  - session_id
  - received_at
  - raw
  - consent_source
  - schema_key
  - canonical_jsonb
  - event_contract_version
  - event_origin
pr87_columns_confirmed:
  - workspace_id
  - site_id
  - client_event_id
schema_usage_check_included: true
grant_authorised_by_this_pr: false
extractor_authorised_by_this_pr: false
schema_change_authorised_by_this_pr: false
worker_activation_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_authorised_by_this_pr: false
lane_preview_in_scope: false
next_step: operator_run_diagnostic_per_section_3_then_open_evidence_pr_then_grant_fix_pr
```

---

## 8. Hard boundaries

This PR does **not**:
- run any diagnostic query
- apply any DB grant or change privileges
- contact production or perform DB writes
- run the extractor or any other worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- change backend code, packages, migrations, or schema
- open Gate 4E
- invent Gate 4F
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the diagnostic operator GO only.

`next_step: operator_run_diagnostic_per_section_3_then_open_evidence_pr_then_grant_fix_pr`
