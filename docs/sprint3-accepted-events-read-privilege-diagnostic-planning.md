# Sprint 3 — `accepted_events` Read Privilege Diagnostic Planning (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC PLANNING RECORD.** This PR plans the
> read-only privilege diagnostic for the `accepted_events` read
> access gap that caused the session_features extractor rerun to
> fail in PR #116. It does not apply any grant, does not run the
> extractor, does not change schema, does not contact production,
> and does not open Gate 4E. No secrets, no raw payloads, no raw
> `request_id` / `session_id`.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #116 | Merged — `SESSION_FEATURES_EXTRACTOR_RERUN_FAILED_PERMISSION_DENIED_ACCEPTED_EVENTS` |
| PR #116 merge commit | `4218c4863c135d19641bef74b3ebab7cb96f2191` |
| PR #114 `session_features` grant fix | Still in place and proofed |
| PR #115 extractor GO | Consumed |
| `session_features` rows | 0 — extractor never completed |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Extractor rerun | Not authorized — requires new GO after `accepted_events` read fix |

---

## 2. Problem statement

The session_features extractor reads from `public.accepted_events`
as its source table. The rerun failed with:

```
permission denied for table accepted_events
```

The app role (`buyerrecon_prod_collector_app`) currently holds:

- `INSERT = true` on `accepted_events` (to write v1 events)
- `UPDATE = true` on `accepted_events` (ingest_requests reconciliation)
- Column-level `SELECT = true` on `workspace_id`, `site_id`,
  `client_event_id` (Gate 4C fix, PR #87 — for the ON CONFLICT path)
- Table-level `SELECT = false`
- Column-level `SELECT = false` on all other columns

The extractor requires `SELECT` on a broader set of `accepted_events`
columns than are currently granted.

---

## 3. Repo-verified extractor read path

Script: `scripts/extract-session-features.ts` (Sprint 1 PR#11)

The extractor reads `accepted_events` directly in two CTEs:

### 3.1 `candidate_sessions` CTE

```sql
SELECT DISTINCT workspace_id, site_id, session_id
  FROM accepted_events
 WHERE received_at >= $1
   AND received_at <= $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id = $4)
   AND event_contract_version = 'event-contract-v0.1'
   AND event_origin = 'browser'
   AND workspace_id IS NOT NULL
   AND site_id IS NOT NULL
   AND session_id IS NOT NULL
   AND session_id <> '__server__'
```

**Columns read:** `workspace_id`, `site_id`, `session_id`,
`received_at`, `event_contract_version`, `event_origin`

### 3.2 `session_events` CTE

```sql
SELECT ae.event_id,
       ae.workspace_id, ae.site_id, ae.session_id,
       ae.received_at,
       ae.raw,
       ae.consent_source,
       ae.schema_key,
       ae.canonical_jsonb,
       CASE WHEN ae.canonical_jsonb IS NULL THEN NULL
            ELSE (SELECT COUNT(*)::int FROM jsonb_object_keys(ae.canonical_jsonb))
       END AS canonical_key_count
  FROM accepted_events ae
  JOIN candidate_sessions cs
    ON ae.workspace_id = cs.workspace_id
   AND ae.site_id = cs.site_id
   AND ae.session_id = cs.session_id
 WHERE ae.event_contract_version = 'event-contract-v0.1'
   AND ae.event_origin = 'browser'
   AND ae.session_id <> '__server__'
```

**Columns read directly:** `event_id`, `workspace_id`, `site_id`,
`session_id`, `received_at`, `raw`, `consent_source`, `schema_key`,
`canonical_jsonb`, `event_contract_version`, `event_origin`

**Derived from `raw` JSONB (via `->>`operator):** `page_url`,
`page_path`, `event_name`, `consent_source` (fallback)

All remaining CTEs (`ranked`, `endpoints`, `event_name_per`,
`schema_key_per`, `consent_source_per`, `session_aggs`) read from
`session_events`, not directly from `accepted_events`.

### 3.3 Complete directly-read column list

| Column | Type | Already granted |
| --- | --- | --- |
| `event_id` | BIGINT | No |
| `workspace_id` | TEXT | **Yes** — column-level SELECT from PR #87 |
| `site_id` | TEXT | **Yes** — column-level SELECT from PR #87 |
| `session_id` | TEXT | No |
| `received_at` | TIMESTAMPTZ | No |
| `raw` | JSONB | No (app role writes it) |
| `consent_source` | TEXT | No |
| `schema_key` | TEXT | No |
| `canonical_jsonb` | JSONB | No (app role writes it) |
| `event_contract_version` | TEXT | No |
| `event_origin` | TEXT | No |

---

## 4. Privilege context — app role vs audit role distinction

The app role `buyerrecon_prod_collector_app` **already writes**
`raw` and `canonical_jsonb` into `accepted_events` via the v1
collector INSERT path (confirmed from
`src/collector/v1/persistence.ts`). It inserts `raw`, `canonical_jsonb`,
`session_id`, `ip_hash`, `user_agent`, and all other columns.

**Consequence:** Adding `SELECT` back on columns the app role
already inserts is materially different from granting SELECT to a
read-only audit role. The app role already controls these values
during the write session. This makes the privacy exposure of
table-level `SELECT` lower for this role than it would be for
`buyerrecon_prod_audit_readonly`.

This does **not** mean a table-level SELECT grant is automatically
acceptable — it still requires review — but it changes the risk
analysis compared to the audit role case.

---

## 5. Candidate fix options (planning only — DO NOT RUN)

### Option A — Table-level SELECT

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT ON TABLE public.accepted_events
  TO buyerrecon_prod_collector_app;
```

- Simplest to apply and maintain.
- Lower risk than an audit role table-level SELECT because the
  app role already writes all columns it would read.
- Grants read access to all columns including `ip_hash`,
  `user_agent`, `request_id`, and other columns not strictly needed
  for the extractor.
- Recommended if column-scoped approach is impractical.

### Option B — Column-level SELECT on all required columns

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT (event_id, workspace_id, site_id, session_id,
              received_at, raw, consent_source, schema_key,
              canonical_jsonb, event_contract_version, event_origin)
  ON TABLE public.accepted_events
  TO buyerrecon_prod_collector_app;
```

- More precise; limits read access to columns the extractor
  actually uses.
- `workspace_id` and `site_id` already have column-level SELECT
  (PR #87); this would add the remaining 9 columns.
- `raw` and `canonical_jsonb` are JSONB payload columns — including
  them is justified because the app role already writes them.
- Preferred if the privilege posture must remain minimal.

**Recommendation:** Option A (table-level SELECT) is pragmatic given
the app role already writes all data in the table. The diagnostic
(§6) should confirm the full privilege state before choosing.

---

## 6. Diagnostic questions to answer

The following must be answered by a later read-only diagnostic
operator session. **This PR does not execute that session.**

| # | Question |
| --- | --- |
| 1 | Does `buyerrecon_prod_collector_app` currently have table-level SELECT on `accepted_events`? |
| 2 | Does it have column-level SELECT on `session_id`? |
| 3 | Does it have column-level SELECT on `received_at`? |
| 4 | Does it have column-level SELECT on `raw`? |
| 5 | Does it have column-level SELECT on `canonical_jsonb`? |
| 6 | Does it have column-level SELECT on `event_contract_version`, `event_origin`? |
| 7 | Does it have column-level SELECT on `consent_source`, `schema_key`, `event_id`? |
| 8 | Are RLS or triggers present on `accepted_events`? |
| 9 | Is the issue confirmed as a missing SELECT grant, not a schema USAGE or sequence issue? |

### Planned read-only diagnostic queries (future session only)

```sql
BEGIN READ ONLY;

-- D1: Role / database / read-only confirmation
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

-- D2: Table-level SELECT (should be false unless already granted)
SELECT has_table_privilege(current_user,
       'public.accepted_events', 'SELECT') AS ae_table_select;

-- D3: Column-level SELECT on columns needed by the extractor
-- that are NOT already granted by PR #87
SELECT
  has_column_privilege(current_user, 'public.accepted_events', 'event_id',               'SELECT') AS event_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'session_id',              'SELECT') AS session_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'received_at',             'SELECT') AS received_at_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'raw',                     'SELECT') AS raw_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'consent_source',          'SELECT') AS consent_source_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'schema_key',              'SELECT') AS schema_key_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'canonical_jsonb',         'SELECT') AS canonical_jsonb_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'event_contract_version',  'SELECT') AS ecv_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'event_origin',            'SELECT') AS event_origin_sel;

-- D4: Confirm already-granted PR #87 columns still in place
SELECT
  has_column_privilege(current_user, 'public.accepted_events', 'workspace_id',    'SELECT') AS workspace_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'site_id',         'SELECT') AS site_id_sel,
  has_column_privilege(current_user, 'public.accepted_events', 'client_event_id', 'SELECT') AS client_event_id_sel;

-- D5: RLS and trigger state
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'accepted_events'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'accepted_events';

ROLLBACK;
```

---

## 7. Required follow-up sequence

| Step | Status |
| --- | --- |
| a. This diagnostic planning PR | **This PR** |
| b. Codex narrow review | Pending |
| c. Separate diagnostic operator GO PR | Not yet done |
| d. Read-only diagnostic execution | Not yet done — gated on (c) |
| e. Diagnostic evidence PR | Not yet done |
| f. Grant-fix planning PR | Not yet done — gated on (e) |
| g. Grant-fix GO / implementation PR | Not yet done |
| h. Post-grant proof PR | Not yet done |
| i. New extractor rerun GO PR | Not yet done |
| j. Extractor rerun | Not yet done |
| k. Post-extractor evidence PR | Not yet done — before any downstream worker |
| l. Downstream worker GOs (if needed) | Not yet done — separately gated |

---

## 8. Stop-lines

| Stop-line | Action |
| --- | --- |
| Any production SQL executed by this planning PR | Stop |
| Any GRANT appears as executable rather than `-- CANDIDATE ONLY — DO NOT RUN` | Stop |
| Any extractor rerun language | Stop |
| Any downstream worker run language | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |
| Any DSN / token / password / secret would be printed | Stop |
| Any raw `request_id` / `session_id` / payload / `canonical_jsonb` / IP hash / user agent / customer data would be printed | Stop |

---

## 9. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_PLANNING
failure_source: PR_116_SESSION_FEATURES_EXTRACTOR_RERUN_FAILED_PERMISSION_DENIED_ACCEPTED_EVENTS
pr116_merge_commit: 4218c4863c135d19641bef74b3ebab7cb96f2191
app_role: buyerrecon_prod_collector_app
table: public.accepted_events
columns_needed_by_extractor:
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
columns_already_granted_pr87:
  - workspace_id
  - site_id
  - client_event_id
app_role_table_select_current: false
app_role_already_writes_raw_canonical_jsonb: true
candidate_fix_a: GRANT_SELECT_TABLE_LEVEL
candidate_fix_b: GRANT_SELECT_column_level_11_columns
preferred_approach: Option_A_table_level_given_write_ownership_context
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_by_this_pr: false
gate_4e_opened: false
gate_4f_invented: false
next_step: diagnostic_operator_go_pr_then_session_then_evidence_pr_then_grant_fix_pr
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- run the extractor or any other worker
- contact production or perform DB writes
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the `accepted_events` read privilege diagnostic planning only.

`next_step: diagnostic_operator_go_pr_then_session_then_evidence_pr_then_grant_fix_pr`
