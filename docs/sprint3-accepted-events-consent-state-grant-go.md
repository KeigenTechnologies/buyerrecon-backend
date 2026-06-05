# Sprint 3 — `accepted_events.consent_state` Column Grant GO (Docs-Only)

> **DOCS-ONLY GRANT GO PLANNING RECORD. THIS PR DOES NOT EXECUTE.**
> It records the reviewed candidate column-level SELECT grant for
> `accepted_events.consent_state` required by the behavioural
> features extractor. The grant happens **only** in a later,
> separate operator session with explicit Helen GO after Codex
> review passes. Merging this PR alone is not the GO. This PR
> runs no commands, applies no grants, does not contact production,
> does not run any extractor or worker, and does not open Gate 4E.
> No secrets, no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Status

- **Status:** `ACCEPTED_EVENTS_CONSENT_STATE_GRANT_GO_PLANNING`
- **Blocker source:** PR #125
  (`docs/sprint3-behavioural-features-extractor-go.md`, merged
  `2026-06-05T10:50:03Z`, commit
  `033cf4824e487d34ffb7d0efeba55de649c3966e`)

**Authorization granted by this PR (after Codex review passes and
Helen explicitly states the GO phrase — merge alone is not the GO):**

- `grant_go_planning_recorded=true`
- `helen_explicit_go_required_before_execution=true`
- `post_grant_proof_pr_required=true`
- `precheck_diagnostic_go_required_after_proof=true`
- `behavioural_extractor_go_pr_required_after_precheck=true`

**Still false (NOT authorized by this PR):**

- `grant_applied_by_this_pr=false`
- `behavioural_extractor_authorised_by_this_pr=false`
- `stage0_authorised_by_this_pr=false`
- `risk_worker_authorised_by_this_pr=false`
- `worker_activation_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`

---

## 2. Why this grant is needed

`scripts/extract-behavioural-features.ts` (Sprint 2 PR#1 + PR#2)
reads `accepted_events.consent_state` in two places (confirmed from
source):

- **Line 302** — direct SELECT in the `session_events` CTE:
  `ae.consent_state`
- **Line 339** — WHERE filter:
  `WHERE consent_state IS NOT NULL AND consent_state <> ''`

The current `accepted_events` column-level SELECT grant chain
(PR #87 + PR #122) covers:

```
workspace_id, site_id, client_event_id  (PR #87)
session_id, received_at, raw, consent_source, schema_key,
canonical_jsonb, event_contract_version, event_origin  (PR #122)
```

`consent_state` is a **different column** from `consent_source`.
The behavioural extractor will fail with `permission denied for
column consent_state` without this grant.

---

## 3. Column characterisation

`accepted_events.consent_state TEXT` (confirmed from
`src/db/schema.sql` line 56) holds a factual consent-state label
(e.g. `'granted'`, `'denied'`). It is:

- Non-PII — not a raw identifier, payload, IP hash, or customer
  data value; it is a categorical label attached to a consented
  event.
- Already written by `buyerrecon_prod_collector_app` via the v1
  collector INSERT path — granting SELECT back on a value the role
  already writes is lower risk than granting SELECT to a different
  role.
- Not in the excluded column list from PR #120 (`ip_hash`,
  `request_id`).

---

## 4. Helen GO statement

> **The production column-level SELECT grant in §5 may be applied
> in a later, separate operator session ONLY after:**
> 1. This PR has passed Codex review and merged.
> 2. Helen explicitly states:
>    **`HELEN CONSENT_STATE GRANT GO: apply the consent_state
>    column grant now.`**
>
> **Merging this PR alone is not the GO.**

---

## 5. Reviewed candidate grant

```sql
-- REVIEWED CANDIDATE — DO NOT RUN UNTIL HELEN EXPLICIT GO + CODEX PASS
-- Adds SELECT on the single missing column required by the behavioural extractor.

GRANT SELECT (consent_state)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

**Scope:**

| Item | Value |
| --- | --- |
| Grant type | Column-level `SELECT` on `consent_state` only |
| Role | `buyerrecon_prod_collector_app` |
| Table | `public.accepted_events` |
| Table-level SELECT granted | **No** |
| `ip_hash` SELECT granted | **No** |
| `request_id` SELECT granted | **No** |
| Raw payload columns (`raw`, `canonical_jsonb`) | Not changed — already granted by PR #122 |
| INSERT / UPDATE / DELETE | Not changed |
| Worker activation | No |
| Customer output | No |

---

## 6. Operator safety posture

Before applying the grant, the operator must:

```bash
# Load production superuser / DBA DSN silently — never print
# (same as prior accepted_events grant sessions)

# Confirm DB name only
DATABASE_URL="$SUPER_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('db_name:', u.pathname.replace(/^\//, ''));
"
```

Expected: `db_name: buyerrecon_production`. If not — **stop.**

**Stop-lines for the grant operator session:**

| Stop-line | Action |
| --- | --- |
| `db_name` is not `buyerrecon_production` | Stop |
| Target role is not `buyerrecon_prod_collector_app` | Stop |
| DSN / password / token would be printed | Stop |
| Any GRANT broader than `SELECT (consent_state)` appears | Stop |
| Any table-level SELECT proposed | Stop |
| Any extractor / worker command appears | Stop |
| Gate 4E or Gate 4F language appears | Stop |

---

## 7. Post-grant proof requirements

After the grant is applied (separate operator session, not this
PR), a post-grant proof PR must confirm via `BEGIN READ ONLY ...
ROLLBACK`:

| Check | Expected |
| --- | --- |
| `has_column_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'consent_state', 'SELECT')` | **true** |
| `has_table_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'SELECT')` | false — table-level not granted |
| `has_column_privilege(…, 'ip_hash', 'SELECT')` | false |
| `has_column_privilege(…, 'request_id', 'SELECT')` | false |
| All prior PR #87 / PR #122 columns still `true` | Confirmed |
| No extractor run during proof | Confirmed |
| Lane A/B row counts | `0/0` — unchanged |
| No customer output / scoring / AMS Trust-Pass | Confirmed |
| Gate 4E / Gate 4F | Not opened / not invented |

The post-grant proof PR must **not** run the behavioural extractor.

---

## 8. Required sequence after this PR

| Step | Status |
| --- | --- |
| a. This grant GO planning PR | **This PR** |
| b. Codex narrow review | Pending |
| c. Merge | Pending |
| d. Explicit Helen GO phrase | Required — separate from merge |
| e. Apply `GRANT SELECT (consent_state)` | Not yet done — gated on (d) |
| f. Post-grant proof PR | Not yet done |
| g. Accepted_events read-privilege pre-check diagnostic GO | Not yet done — gated on (f) |
| h. Pre-check diagnostic execution and evidence PR | Not yet done |
| i. Behavioural extractor run GO PR | Not yet done — gated on (h) |
| j. Behavioural extractor run | Not yet done |
| k. Post-extractor evidence PR | Not yet done — before Stage 0 |

---

## 9. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_CONSENT_STATE_GRANT_GO_PLANNING
blocker_source: PR_125_BEHAVIOURAL_FEATURES_EXTRACTOR_GO_PLANNING
pr125_merge_commit: 033cf4824e487d34ffb7d0efeba55de649c3966e
missing_column: consent_state
column_type: TEXT
column_sensitivity: categorical_label_non_pii
table: public.accepted_events
role: buyerrecon_prod_collector_app
candidate_grant: GRANT_SELECT_consent_state_column_only
table_level_select: false
ip_hash_granted: false
request_id_granted: false
helen_go_phrase: "HELEN CONSENT_STATE GRANT GO: apply the consent_state column grant now"
grant_applied_by_this_pr: false
behavioural_extractor_authorised_by_this_pr: false
stage0_authorised_by_this_pr: false
worker_activation_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: helen_explicit_go_then_grant_then_proof_pr_then_precheck_diagnostic_go_then_behavioural_extractor_go
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- run the behavioural extractor or any other worker
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

It records the `consent_state` column grant GO planning only.

`next_step: helen_explicit_go_then_grant_then_proof_pr_then_precheck_diagnostic_go_then_behavioural_extractor_go`
