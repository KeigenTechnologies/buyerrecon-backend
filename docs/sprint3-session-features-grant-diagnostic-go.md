# Sprint 3 — `session_features` Grant Diagnostic Operator GO (Docs-Only)

> **DOCS-ONLY OPERATOR GO RECORD. THIS PR DOES NOT EXECUTE.** It
> records Helen's explicit GO for one bounded read-only diagnostic
> session to inspect the `session_features` production privilege gap
> identified in PR #108 and planned in PR #109. The diagnostic
> happens **only** in a later, separate operator session after this
> PR merges. This PR runs no queries, writes no data, contacts no
> production environment, does not run the extractor, does not apply
> any grant, and does not open Gate 4E. No secrets, no raw payloads,
> no raw `request_id` / `session_id`.

---

## 1. Status / verdict

- **Status:** `SESSION_FEATURES_GRANT_DIAGNOSTIC_GO_RECORDED`
- **Planning source:** PR #109
  (`docs/sprint3-session-features-grant-diagnostic-planning.md`,
  merged `2026-06-04T16:01:49Z`, commit
  `5a19ade5672d6bb24bdf438705cbe9260fd0e646`)
- **Failure source:** PR #108
  (`SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`)

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
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `ams_trust_pass_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_authorised_by_this_pr=false`
- `diagnostic_before_this_pr_merges_authorised=false`

---

## 2. Helen GO statement

> **Helen authorizes the operator to execute one bounded read-only
> diagnostic session against `buyerrecon_production`, strictly per
> the query scope in §3. All queries must run inside explicit
> `BEGIN READ ONLY ... ROLLBACK` blocks. No GRANT. No DDL. No DML.
> No extractor run. No grant change.**

**No diagnostic before this PR is merged.**

---

## 3. Authorized diagnostic queries

All queries must run inside `BEGIN READ ONLY ... ROLLBACK`. Do not
use `PGOPTIONS`-only for read-only enforcement (carry-forward from
PR #106 — PGOPTIONS did not take effect in that session).

### Session A — App role diagnostic

Load app DSN from `.env.production` **without printing it**:

```bash
cd /opt/buyerrecon-backend || exit 1
export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN loaded" || { echo "ERROR: APP_DSN not loaded — stop"; exit 1; }
```

Confirm DB name without printing DSN:

```bash
node -e "const u=new URL(process.env.DATABASE_URL); console.log('db_name:', u.pathname.replace(/^\//,''));"
```

Expected: `buyerrecon_production`. If not — **stop.**

Then connect and run all Session A queries in one `BEGIN READ ONLY ... ROLLBACK`:

```bash
psql --no-password --tuples-only --no-align -d "$APP_DSN" <<'SQL'
BEGIN READ ONLY;

-- A1: Role / database / read-only confirmation
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

-- A2: Schema USAGE
SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage;

-- A3: session_features table privileges
SELECT
  has_table_privilege(current_user, 'public.session_features', 'SELECT') AS sf_select,
  has_table_privilege(current_user, 'public.session_features', 'INSERT') AS sf_insert,
  has_table_privilege(current_user, 'public.session_features', 'UPDATE') AS sf_update;

-- A4: session_features_id_seq sequence privileges
SELECT
  has_sequence_privilege(current_user, 'public.session_features_id_seq', 'USAGE')  AS seq_usage,
  has_sequence_privilege(current_user, 'public.session_features_id_seq', 'SELECT') AS seq_select;

-- A5: Table owner
SELECT tableowner
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'session_features';

-- A6: Sequence owner
SELECT r.rolname AS seq_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles r     ON r.oid = c.relowner
WHERE n.nspname = 'public'
  AND c.relname = 'session_features_id_seq'
  AND c.relkind = 'S';

-- A7: RLS state
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'session_features'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- A8: Trigger count
SELECT COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'session_features';

ROLLBACK;
SQL
```

### Session B — Audit role diagnostic

Load audit DSN using the `export PRODUCTION_DATABASE_URL=...` file format:

```bash
set -a
. /root/buyerrecon-production-db.env
set +a
export AUDIT_DSN="$PRODUCTION_DATABASE_URL"
unset PRODUCTION_DATABASE_URL
[ -n "$AUDIT_DSN" ] && echo "AUDIT_DSN loaded" || { echo "ERROR: AUDIT_DSN not loaded — stop"; exit 1; }
```

Then connect and run all Session B queries in one `BEGIN READ ONLY ... ROLLBACK`:

```bash
psql --no-password --tuples-only --no-align -d "$AUDIT_DSN" <<'SQL'
BEGIN READ ONLY;

-- B1: Audit role / database / read-only confirmation
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

-- B2: session_features table SELECT for audit role
SELECT
  has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'SELECT') AS sf_select,
  has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'INSERT') AS sf_insert;

-- B3: Column-level SELECT (from PR #97 Option B grant)
SELECT
  has_column_privilege('buyerrecon_prod_audit_readonly', 'public.session_features',
                       'session_features_id', 'SELECT') AS col_sf_id_select;

-- B4: Schema USAGE for audit role
SELECT has_schema_privilege('buyerrecon_prod_audit_readonly', 'public', 'USAGE') AS schema_usage;

ROLLBACK;
SQL
```

---

## 4. Required evidence from the diagnostic session

The results must be recorded in a post-diagnostic docs-only evidence
PR. That PR must include (no DSNs, no secrets, no raw identifiers):

| Evidence item | Format |
| --- | --- |
| Session A: `current_user` | Role name |
| Session A: `current_database()` | DB name |
| Session A: `txn_read_only` | `on` |
| Session A: `schema_usage` | bool |
| Session A: `sf_select` / `sf_insert` / `sf_update` | three booleans |
| Session A: `seq_usage` / `seq_select` | two booleans |
| Session A: `tableowner` | Role name |
| Session A: `seq_owner` | Role name |
| Session A: `relrowsecurity` / `relforcerowsecurity` | two booleans |
| Session A: `trigger_count` | integer |
| Session B: `current_user` | `buyerrecon_prod_audit_readonly` |
| Session B: `sf_select` / `sf_insert` | two booleans |
| Session B: `col_sf_id_select` | bool |
| Session B: `schema_usage` | bool |
| No raw request_id / session_id / IP hash / user agent / payload | Confirmed |
| No GRANT / DDL / DML executed | Confirmed |
| No extractor run | Confirmed |
| Categorical diagnosis | One of: `missing_table_grant`, `missing_sequence_grant`, `wrong_app_role`, `audit_missing_select`, `ownership_issue`, `multiple_gaps` |

---

## 5. Stop-lines

**Halt the session and do not proceed if any of the following:**

| Stop-line | Action |
| --- | --- |
| Any query runs outside `BEGIN READ ONLY ... ROLLBACK` | Stop immediately |
| Any GRANT statement appears in the session | Stop |
| Any DDL or DML appears in the session | Stop |
| A DSN, password, token, or secret would be printed | Stop — do not run |
| Raw `request_id`, `session_id`, `ip_hash`, `canonical_jsonb`, user agent, or customer data would be printed | Stop — do not run |
| Extractor rerun language appears | Stop |
| Downstream worker run language appears | Stop |
| Customer output / Lane / scoring / AMS Trust-Pass activation language appears | Stop |
| Gate 4E opening, readiness, or automatic-advance language appears | Stop |
| Gate 4F language appears | Stop |

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
status: SESSION_FEATURES_GRANT_DIAGNOSTIC_GO_RECORDED
planning_source: PR_109_SESSION_FEATURES_GRANT_DIAGNOSTIC_PLANNING
pr109_merge_commit: 5a19ade5672d6bb24bdf438705cbe9260fd0e646
diagnostic_go_recorded: true
diagnostic_before_this_pr_merges_authorised: false
begin_read_only_rollback_required: true
pgoptions_not_relied_on: true
session_a_role: app_role_via_DATABASE_URL_from_env_production
session_b_role: buyerrecon_prod_audit_readonly
post_diagnostic_evidence_pr_required: true
single_session_only: true
grant_authorised_by_this_pr: false
extractor_authorised_by_this_pr: false
schema_change_authorised_by_this_pr: false
worker_activation_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
ams_trust_pass_authorised_by_this_pr: false
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
