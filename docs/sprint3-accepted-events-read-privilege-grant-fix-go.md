# Sprint 3 — `accepted_events` Read Privilege Grant Fix GO Planning (Docs-Only)

> **DOCS-ONLY GRANT FIX GO PLANNING RECORD. THIS PR DOES NOT
> EXECUTE.** It records the reviewed candidate column-level SELECT
> grant for `accepted_events` and defines the post-grant proof plan.
> The grant happens **only** in a later, separate operator session
> with explicit Helen GO after Codex review passes. Merging this PR
> alone is not the GO. This PR runs no commands, applies no grants,
> does not contact production, does not run the extractor, and does
> not open Gate 4E. No secrets, no raw payloads, no raw `request_id`
> / `session_id`.

---

## 1. Status

- **Status:** `ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_GO_PLANNING`
- **Planning source:** PR #120
  (`docs/sprint3-accepted-events-read-privilege-grant-fix-planning.md`,
  merged `2026-06-05T08:42:34Z`, commit
  `f7d1f8320203ecc2be3451d02d8b82da4342ddce`)
- **Diagnostic source:** PR #119
  (`ACCEPTED_EVENTS_READ_PRIVILEGE_DIAGNOSTIC_COMPLETE_COLUMN_GAP_CONFIRMED`)

**Authorization granted by this PR (after Codex review passes and Helen explicitly states the GO phrase — merge alone is not the GO):**

- `grant_fix_go_planning_recorded=true`
- `helen_explicit_go_required_before_execution=true`
- `post_grant_proof_pr_required=true`
- `extractor_rerun_go_pr_required_after_proof=true`

**Still false (NOT authorized by this PR):**

- `grant_applied_by_this_pr=false`
- `extractor_authorised_by_this_pr=false`
- `worker_activation_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`

---

## 2. Helen GO statement

> **The production column-level SELECT grant in §3 may be applied
> in a later, separate operator session ONLY after:**
> 1. This PR has passed Codex review and merged.
> 2. Helen explicitly states:
>    **`HELEN ACCEPTED_EVENTS READ GRANT GO: apply the
>    accepted_events column grants now.`**
>
> **Merging this PR alone is not the GO.** The execution requires
> the explicit phrase above in addition to the merge.

---

## 3. Repo-verified candidate grant

All 8 target columns confirmed present in `public.accepted_events`
from `src/db/schema.sql`. `ip_hash` and `request_id` confirmed
present but not read by the extractor (excluded). `user_agent` is
not a column in `accepted_events` (it is in `ingest_requests`).

```sql
-- REVIEWED CANDIDATE — DO NOT RUN UNTIL HELEN EXPLICIT GO + CODEX PASS
-- Apply only after this planning PR merges and Helen issues the GO phrase in §2.

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

**Scope of this grant:**

| Item | Value |
| --- | --- |
| Grant type | Column-level `SELECT` on 8 columns only |
| Role | `buyerrecon_prod_collector_app` |
| Table | `public.accepted_events` |
| Table-level SELECT granted | **No** |
| `ip_hash` SELECT granted | **No** — not read by extractor |
| `request_id` SELECT granted | **No** — not read by extractor |
| `user_agent` | **Not in `accepted_events`** — not applicable |
| INSERT / UPDATE / DELETE | Not changed |
| Worker activation | No |
| Customer output | No |
| Gate 4E | No |
| Gate 4F | No |

**Why column-level SELECT (not table-level):**

Follows the least-privilege pattern from PR #87 (conflict-target
columns) and PR #114 (`session_features` write path). The 8 columns
above are exactly what the extractor's `candidate_sessions` and
`session_events` CTEs read — no more. Columns not read by the
extractor (`ip_hash`, `request_id`, and others) remain inaccessible
via SELECT.

---

## 4. Post-grant proof requirements

After the grant is applied (separate operator session, not this
PR), a post-grant proof PR must confirm via `BEGIN READ ONLY ...
ROLLBACK`:

### App-role column-level proof

| Column | Expected |
| --- | --- |
| `has_column_privilege(…, 'event_id', 'SELECT')` | true (unchanged) |
| `has_column_privilege(…, 'workspace_id', 'SELECT')` | true (unchanged, PR #87) |
| `has_column_privilege(…, 'site_id', 'SELECT')` | true (unchanged, PR #87) |
| `has_column_privilege(…, 'client_event_id', 'SELECT')` | true (unchanged, PR #87) |
| `has_column_privilege(…, 'session_id', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'received_at', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'raw', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'consent_source', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'schema_key', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'canonical_jsonb', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'event_contract_version', 'SELECT')` | **true** (new) |
| `has_column_privilege(…, 'event_origin', 'SELECT')` | **true** (new) |

### Excluded-column proof (must remain false)

| Column | Expected |
| --- | --- |
| `has_table_privilege(…, 'public.accepted_events', 'SELECT')` | **false** — table-level not granted |
| `has_column_privilege(…, 'ip_hash', 'SELECT')` | **false** |
| `has_column_privilege(…, 'request_id', 'SELECT')` | **false** |

### Additional checks

- RLS unchanged: `f/f`
- Trigger count unchanged: `0`
- No extractor rerun during proof.
- No downstream worker.
- No customer output / Lane / scoring / AMS Trust-Pass.
- Lane A/B row counts remain `0/0`.

---

## 5. Stop-lines

| Stop-line | Action |
| --- | --- |
| Any production SQL executed by this planning PR | Stop |
| Any GRANT before Helen explicit GO phrase | Stop |
| Table-level SELECT proposed or executed | Stop |
| `ip_hash`, `request_id`, or `user_agent` included in grant | Stop |
| Extractor rerun language | Stop |
| Downstream worker run language | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |
| Any DSN / token / password / secret would be printed | Stop |
| Any raw `request_id` / `session_id` / payload / `canonical_jsonb` / IP hash / customer data would be printed | Stop |

---

## 6. Required follow-up sequence

| Step | Status |
| --- | --- |
| a. This GO / implementation planning PR | **This PR** |
| b. Codex narrow review | Pending |
| c. Merge | Pending |
| d. Explicit Helen GO phrase | Required — separate from merge |
| e. Execute reviewed column-level GRANT | Not yet done — gated on (d) |
| f. Post-grant proof PR | Not yet done |
| g. New extractor rerun GO PR | Not yet done — gated on (f) |
| h. Extractor rerun | Not yet done |
| i. Post-extractor evidence PR | Not yet done — before any downstream worker |
| j. Downstream worker GO (if needed) | Not yet done — separately gated |

---

## 7. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_GO_PLANNING
planning_source: PR_120_ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PLANNING
pr120_merge_commit: f7d1f8320203ecc2be3451d02d8b82da4342ddce
app_role: buyerrecon_prod_collector_app
table: public.accepted_events
columns_to_grant_8:
  - session_id
  - received_at
  - raw
  - consent_source
  - schema_key
  - canonical_jsonb
  - event_contract_version
  - event_origin
table_level_select_granted: false
ip_hash_granted: false
request_id_granted: false
user_agent_not_in_accepted_events: true
helen_explicit_go_required_before_execution: true
helen_go_phrase: "HELEN ACCEPTED_EVENTS READ GRANT GO: apply the accepted_events column grants now"
grant_applied_by_this_pr: false
extractor_authorised_by_this_pr: false
worker_activation_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: helen_explicit_go_then_apply_section_3_grant_then_proof_pr_then_extractor_go_pr
```

---

## 8. Hard boundaries

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

It records the reviewed candidate grant statement and proof plan.
Execution requires Helen's explicit GO in addition to this PR
merging.

`next_step: helen_explicit_go_then_apply_section_3_grant_then_proof_pr_then_extractor_go_pr`
