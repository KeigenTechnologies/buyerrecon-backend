# Sprint 3 — `accepted_events` Read Privilege Diagnostic Evidence (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC EVIDENCE RECORD.** This PR records the
> results of the read-only `accepted_events` privilege diagnostic
> session authorized by PR #118. It does not apply any grant, does
> not run the extractor, does not change schema, does not contact
> production beyond the already-completed operator session described
> below, and does not open Gate 4E. No secrets, no raw payloads, no
> raw `request_id` / `session_id` — privilege booleans and role
> names only.

---

## 1. Verdict

**`ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_COMPLETE_COLUMN_GAP_CONFIRMED`**

The diagnostic confirmed: the production app role
(`buyerrecon_prod_collector_app`) has schema USAGE on `public` and
partial column-level `SELECT` on `accepted_events`, but lacks SELECT
on 8 of the 11 columns required by the session_features extractor.
The failure cause is a column-level read privilege gap — not table
ownership, schema USAGE, RLS, triggers, the wrong database, or the
wrong app role.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #117 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_PLANNING` |
| PR #118 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_GO_PLANNING` |
| PR #118 merge commit | `11116eccd703ab79a5ba3c40ebb1c3621dfc2bac` |
| `session_features` rows | 0 — extractor has not successfully run |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Diagnostic session

| Item | Value |
| --- | --- |
| Method | Explicit `BEGIN READ ONLY ... ROLLBACK` — no PGOPTIONS reliance |
| Row-level `accepted_events` data queried | No |
| DSN / secret / token printed | No |
| Raw `request_id` / `session_id` / payload / `canonical_jsonb` values printed | No |
| IP hash / user agent / customer data printed | No |
| GRANT / DDL / DML executed | None |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |

---

## 4. Diagnostic output (categorical — privilege booleans only)

```
BEGIN
D1_ROLE_DB_READONLY|buyerrecon_prod_collector_app|buyerrecon_production|on|2026-06-05 08:20:44.961266
D2_SCHEMA_USAGE|t
D3_ACCEPTED_EVENTS_TABLE_SELECT|f
D4_EXTRACTOR_COLUMN_PRIVS|t|t|t|f|f|f|f|f|f|f|f
D5_PR87_COLUMN_PRIVS|t|t|t
D6_RLS_STATE|f|f
D7_TRIGGER_COUNT|0
ROLLBACK
```

---

## 5. Diagnostic summary

### 5.1 Role / database / read-only confirmation (D1)

| Field | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |
| `txn_read_only` | `on` |
| Timestamp | `2026-06-05 08:20:44.961266 UTC` |

### 5.2 Schema USAGE (D2)

`schema_usage = t` — schema access is not the blocker.

### 5.3 Table-level SELECT (D3)

`ae_table_select = f` — table-level SELECT not granted.

### 5.4 Column-level SELECT — 11 extractor-required columns (D4)

| Column | SELECT |
| --- | --- |
| `event_id` | **true** |
| `workspace_id` | **true** |
| `site_id` | **true** |
| `session_id` | **false** — missing |
| `received_at` | **false** — missing |
| `raw` | **false** — missing |
| `consent_source` | **false** — missing |
| `schema_key` | **false** — missing |
| `canonical_jsonb` | **false** — missing |
| `event_contract_version` | **false** — missing |
| `event_origin` | **false** — missing |

**3 columns granted; 8 columns missing.**

### 5.5 PR #87 already-granted columns (D5)

| Column | SELECT |
| --- | --- |
| `workspace_id` | true — confirms PR #87 grant in force |
| `site_id` | true — confirms PR #87 grant in force |
| `client_event_id` | true — confirms PR #87 grant in force |

D4 `event_id` being `true` is expected: the sequence-related grant
from the Gate 4C accepted_events fix (PR #87, which granted
column-level SELECT on `workspace_id`, `site_id`,
`client_event_id`) — `event_id` SELECT was confirmed true in PR #86
(`event_id SELECT=true` before the Gate 4C grant). It was already
present from an earlier grant.

### 5.6 RLS and triggers (D6–D7)

| Check | Value |
| --- | --- |
| `relrowsecurity` | false — not a blocker |
| `relforcerowsecurity` | false — not a blocker |
| `trigger_count` | 0 — not a blocker |

---

## 6. Root-cause analysis

| Candidate blocker | Assessment |
| --- | --- |
| Wrong role | **Ruled out** — `current_user = buyerrecon_prod_collector_app` confirmed |
| Wrong database | **Ruled out** — `current_database() = buyerrecon_production` confirmed |
| Schema USAGE missing | **Ruled out** — `schema_usage = t` |
| RLS | **Ruled out** — `relrowsecurity = f` |
| Trigger | **Ruled out** — `trigger_count = 0` |
| Table-level SELECT missing | Present but likely not the primary cause — column-level SELECT already grants partial access |
| **Column-level SELECT missing on 8 extractor-required columns** | **Confirmed root cause** — `session_id`, `received_at`, `raw`, `consent_source`, `schema_key`, `canonical_jsonb`, `event_contract_version`, `event_origin` all `false` |

The extractor's `session_events` CTE selects all 11 columns. With
8 of them lacking SELECT, the query fails with `permission denied`
even though `workspace_id`, `site_id`, and `event_id` are already
granted.

This supports a future **column-level grant** (Option B from PR #117)
covering the 8 missing columns rather than requiring table-level SELECT,
unless Option B is later proven technically infeasible.

---

## 7. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| GRANT / DDL / DML executed | None |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |
| Schema / migration change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |

---

## 8. Next step

This evidence PR does **not** fix `accepted_events` privileges. The
required sequence before any extractor rerun:

1. Separate `accepted_events` column-level grant-fix planning PR —
   review the 8 missing columns and propose the narrowest safe fix.
2. Grant-fix GO / implementation PR — Helen explicit GO required.
3. Post-grant proof PR.
4. New extractor rerun GO PR.
5. Extractor rerun only under the new GO.

---

## 9. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_COMPLETE_COLUMN_GAP_CONFIRMED
go_source: PR_118_ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_GO_PLANNING
pr118_merge_commit: 11116eccd703ab79a5ba3c40ebb1c3621dfc2bac
diagnostic_timestamp: "2026-06-05 08:20:44.961266 UTC"
app_role: buyerrecon_prod_collector_app
database: buyerrecon_production
txn_read_only: on
schema_usage: true
ae_table_select: false
rls_enabled: false
trigger_count: 0
column_select_granted: [event_id, workspace_id, site_id]
column_select_missing: [session_id, received_at, raw, consent_source, schema_key, canonical_jsonb, event_contract_version, event_origin]
pr87_columns_confirmed: [workspace_id, site_id, client_event_id]
root_cause: column_select_missing_8_extractor_required_columns
preferred_fix_direction: column_level_grant_option_b_from_pr117
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: accepted_events_column_grant_fix_planning_pr_then_fix_then_proof_then_new_extractor_go
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- run the extractor or any other worker
- contact production or perform DB writes beyond the already-completed
  read-only diagnostic session
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the `accepted_events` read privilege diagnostic evidence only.

`next_step: accepted_events_column_grant_fix_planning_pr_then_fix_then_proof_then_new_extractor_go`
