# Sprint 3 — `accepted_events` Read Privilege Grant Fix Planning (Docs-Only)

> **DOCS-ONLY GRANT FIX PLANNING RECORD.** This PR plans the
> least-privilege column-level SELECT grant fix for the
> `accepted_events` read privilege gap confirmed in PR #119. It
> does not apply any grant, does not run the extractor, does not
> change schema, does not contact production, and does not open
> Gate 4E. No secrets, no raw payloads, no raw `request_id` /
> `session_id`.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #119 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_COMPLETE_COLUMN_GAP_CONFIRMED` |
| PR #119 merge commit | `742d9e1c6a550d0a1f9a017344cb7655dd592e64` |
| `session_features` rows | 0 — extractor has not successfully run |
| Privilege gap | `buyerrecon_prod_collector_app` lacks SELECT on 8 extractor-required `accepted_events` columns |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Extractor rerun | Not authorized — requires new GO after fix and proof |

---

## 2. Repo-verified extractor read path

Script: `scripts/extract-session-features.ts` (Sprint 1 PR#11)

The extractor reads exactly 11 `accepted_events` columns across
two CTEs (confirmed from source):

| Column | CTE | Currently granted |
| --- | --- | --- |
| `event_id` | `session_events` | **Yes** |
| `workspace_id` | both | **Yes** (PR #87) |
| `site_id` | both | **Yes** (PR #87) |
| `session_id` | both | No — missing |
| `received_at` | both | No — missing |
| `raw` | `session_events` | No — missing |
| `consent_source` | `session_events` | No — missing |
| `schema_key` | `session_events` | No — missing |
| `canonical_jsonb` | `session_events` | No — missing |
| `event_contract_version` | both | No — missing |
| `event_origin` | both | No — missing |

No additional `accepted_events` columns are referenced — confirmed
by reading all `ae.*` references in the extractor SQL. All other
CTEs (`ranked`, `endpoints`, `event_name_per`, `schema_key_per`,
`consent_source_per`, `session_aggs`) derive from `session_events`,
not directly from `accepted_events`.

---

## 3. Columns excluded from the proposed grant (not needed by extractor)

The following `accepted_events` columns exist in the schema but are
**not** required by the extractor and **must not** be included in
the column-level grant:

| Column | Type | Reason to exclude |
| --- | --- | --- |
| `request_id` | UUID | Collector request identifier — not read by extractor |
| `ip_hash` | TEXT | IP address hash — sensitive; not read by extractor |
| `payload_sha256` | TEXT | Payload hash — not read by extractor |
| `size_bytes` | INT | Request size — not read by extractor |
| `browser_id` | TEXT | Browser identifier — not read by extractor |
| `page_view_id` | TEXT | Page view identifier — not read by extractor |
| `session_started_at` | TIMESTAMPTZ | Session timing — not read by extractor |
| `session_last_seen_at` | TIMESTAMPTZ | Session timing — not read by extractor |

The column-level grant targets exactly the 8 missing columns and
no more.

---

## 4. Proposed candidate grant (DO NOT RUN)

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Apply only after this planning PR merges and Helen issues explicit GO.
-- Grants SELECT on exactly the 8 extractor-required columns that are currently missing.

GRANT SELECT (
  session_id,
  received_at,
  raw,
  consent_source,
  schema_key,
  canonical_jsonb,
  event_contract_version,
  event_origin
)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

**Why column-level SELECT (not table-level):**

- Follows the least-privilege pattern from PR #87 (conflict-target
  columns), PR #114 (`session_features` audit grant), and PR #114
  (`session_features` write path).
- The 8 columns above are exactly what the extractor's
  `session_events` and `candidate_sessions` CTEs read. No more.
- Columns not read by the extractor — including `request_id`,
  `ip_hash`, `payload_sha256`, `browser_id` — remain inaccessible
  via SELECT, even though the app role already wrote them via INSERT.
- Table-level SELECT is not proposed and should only be considered
  if column-level is later proven technically insufficient.

**Why the app role `SELECT` on these columns is lower risk than
an audit role `SELECT`:**

The app role already writes `raw` and `canonical_jsonb` (and all
other `accepted_events` columns) via the v1 collector INSERT path.
Granting `SELECT` back on values the role already controls during
the write session does not expand the role's knowledge of customer
data beyond what it already processes.

---

## 5. Post-grant proof requirements

After the grant is applied (separate operator session, not this
PR), a post-grant proof PR must confirm:

| Check | Expected |
| --- | --- |
| `has_table_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'SELECT')` | **false** — table-level not granted |
| `has_column_privilege(…, 'session_id', 'SELECT')` | true |
| `has_column_privilege(…, 'received_at', 'SELECT')` | true |
| `has_column_privilege(…, 'raw', 'SELECT')` | true |
| `has_column_privilege(…, 'consent_source', 'SELECT')` | true |
| `has_column_privilege(…, 'schema_key', 'SELECT')` | true |
| `has_column_privilege(…, 'canonical_jsonb', 'SELECT')` | true |
| `has_column_privilege(…, 'event_contract_version', 'SELECT')` | true |
| `has_column_privilege(…, 'event_origin', 'SELECT')` | true |
| `has_column_privilege(…, 'event_id', 'SELECT')` | true (unchanged) |
| `has_column_privilege(…, 'workspace_id', 'SELECT')` | true (unchanged, PR #87) |
| `has_column_privilege(…, 'site_id', 'SELECT')` | true (unchanged, PR #87) |
| `has_column_privilege(…, 'request_id', 'SELECT')` | **false** — must not be granted |
| `has_column_privilege(…, 'ip_hash', 'SELECT')` | **false** — must not be granted |
| RLS unchanged | false/false |
| Trigger count unchanged | 0 |
| No extractor rerun during proof | Confirmed |
| No downstream worker | Confirmed |
| No customer output / Lane / scoring / AMS Trust-Pass | Confirmed |

---

## 6. Required follow-up sequence

| Step | Status |
| --- | --- |
| a. This grant-fix planning PR | **This PR** |
| b. Codex narrow review | Pending |
| c. Separate accepted_events grant-fix GO / implementation PR | Not yet done — gated on (b) |
| d. Helen explicit GO before production GRANT | Required |
| e. Execute only the reviewed column-level grant | Not yet done — gated on (d) |
| f. Post-grant proof PR | Not yet done |
| g. New extractor rerun GO PR | Not yet done — gated on (f) |
| h. Extractor rerun | Not yet done |
| i. Post-extractor evidence PR | Not yet done — before any downstream worker |

---

## 7. Stop-lines

| Stop-line | Action |
| --- | --- |
| Any production SQL executed by this planning PR | Stop |
| Any GRANT appears as executable rather than `-- CANDIDATE ONLY — DO NOT RUN` | Stop |
| Table-level SELECT proposed without explicit risk review | Stop |
| Grant includes `ip_hash`, `request_id`, `user_agent`, or other unused columns without explicit justification | Stop |
| Extractor rerun language | Stop |
| Downstream worker run language | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |
| Any DSN / token / password / secret would be printed | Stop |
| Any raw `request_id` / `session_id` / payload / `canonical_jsonb` / IP hash / user agent / customer data would be printed | Stop |

---

## 8. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PLANNING
diagnostic_source: PR_119_ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_COMPLETE_COLUMN_GAP_CONFIRMED
pr119_merge_commit: 742d9e1c6a550d0a1f9a017344cb7655dd592e64
app_role: buyerrecon_prod_collector_app
table: public.accepted_events
columns_already_granted: [event_id, workspace_id, site_id, client_event_id]
columns_missing_8:
  - session_id
  - received_at
  - raw
  - consent_source
  - schema_key
  - canonical_jsonb
  - event_contract_version
  - event_origin
candidate_grant_form: column_level_select_8_missing_columns
table_level_select_proposed: false
excluded_columns_rationale: request_id_ip_hash_payload_sha256_browser_id_not_read_by_extractor
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_by_this_pr: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: grant_fix_go_pr_then_helen_go_then_execute_then_proof_pr_then_extractor_go_pr
```

---

## 9. Hard boundaries

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

It records the grant-fix planning only.

`next_step: grant_fix_go_pr_then_helen_go_then_execute_then_proof_pr_then_extractor_go_pr`
