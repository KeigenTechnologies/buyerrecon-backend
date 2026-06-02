# Sprint 2 PR#18ap — Gate 4C: Collector Grant Diagnostic Proof and Proposed Minimal Fix (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC PROOF AND GRANT PROPOSAL RECORD.** This PR
> records the read-only diagnostic results from the session planned in
> PR #85, interprets the findings, and proposes the smallest candidate
> grant fix for operator review. It does **not** apply any DB grant,
> does not deploy, does not contact production, does not run a canary,
> does not retry Gate 4C, and does not open Gate 4D. No secrets, no
> raw payloads, no raw `request_id` / `session_id` — categorical /
> structural facts and redactions only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` |
| PR #85 | Merged — `GATE4C_BLOCKED_DIAGNOSTIC_PENDING` |
| PR #85 merge commit | `afe2b51be25147288593dd239a160090a07020f2` |
| PR #83 GO | Consumed |
| Gate 4C | Blocked and rolled back |
| Gate 4D | Closed |
| Production posture | Rolled back to legacy `/collect` |
| Retry authorized | No — any future retry requires fix + post-fix proof + new GO |

---

## 2. Failure carried forward

The Gate 4C execution under PR #83 GO produced:

- **Static frontend cutover: PASS.** Versioned SDK/init served at
  expected hashes; `endpointUrl: https://buyerrecon.com/v1/event`;
  `mode: sprint2_v1_event`; SDK-before-init order confirmed.
- **Old `request_body_invalid_json` / cache-mix failure: NOT
  reproduced.**
- **Browser canary:** `POST https://buyerrecon.com/v1/event` →
  **HTTP 500**. Stop-line triggered.
- **Collector logs (categorical):**

  ```
  kind: storage_failure
  message: permission denied for table accepted_events
  ```

  Request IDs redacted; no raw UUIDs reproduced.
- **Rollback: completed and verified.** Legacy `/collect` posture
  restored.

---

## 3. Read-only diagnostic proof

Diagnostic executed per PR #85 §6. All commands were read-only
(`SELECT` / `SHOW` only). No writes were performed.

### 3.1 Role and database identity

| Item | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |
| `transaction_read_only` | `on` |
| Diagnostic timestamp | `2026-06-02T16:34:16Z` |

### 3.2 Table-level privileges (`has_table_privilege`)

| Table | `SELECT` | `INSERT` | `UPDATE` | `DELETE` |
| --- | --- | --- | --- | --- |
| `public.accepted_events` | **false** | true | false | false |
| `public.ingest_requests` | false | true | true | false |
| `public.rejected_events` | false | true | false | false |

### 3.3 Column-level privileges (`has_column_privilege`)

**`accepted_events` — conflict target and returning columns:**

| Column | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `workspace_id` | **false** | true | false |
| `site_id` | **false** | true | false |
| `client_event_id` | **false** | true | false |
| `event_id` | **true** | true | false |
| `session_id` | false | true | false |

**`ingest_requests` — key columns:**

| Column | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `request_id` | true | true | true |
| `accepted_count` | false | true | true |
| `rejected_count` | false | true | true |
| `reconciled_at` | false | true | true |

**`rejected_events` — key columns:**

| Column | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `id` | false | true | false |
| `reason_code` | false | true | false |
| `request_id` | false | true | false |

### 3.4 RLS state

| Table | `relrowsecurity` | `relforcerowsecurity` |
| --- | --- | --- |
| `public.accepted_events` | false | false |
| `public.ingest_requests` | false | false |
| `public.rejected_events` | false | false |

### 3.5 Policies

No policies observed for `ingest_requests`, `accepted_events`, or
`rejected_events`.

### 3.6 Triggers

No triggers observed for `ingest_requests`, `accepted_events`, or
`rejected_events`.

### 3.7 `accepted_events` indexes

| Index name | Definition |
| --- | --- |
| `accepted_events_dedup` | `CREATE UNIQUE INDEX accepted_events_dedup ON public.accepted_events USING btree (workspace_id, site_id, client_event_id) WHERE ((workspace_id IS NOT NULL) AND (site_id IS NOT NULL) AND (client_event_id IS NOT NULL))` |
| `accepted_events_pkey` | Primary key on `event_id` |
| `accepted_events_request_id` | Index on `request_id` |
| `idx_accepted_browser` | Index on `browser_id` |
| `idx_accepted_dedup_client_event` | Index on `(site_id, session_id, client_event_id) WHERE client_event_id IS NOT NULL` |
| `idx_accepted_session` | Index on `session_id` |
| `idx_accepted_site_received` | Index on `(site_id, received_at)` |
| `idx_accepted_site_ts` | Index on `(site_id, client_timestamp_ms)` |
| `idx_accepted_site_type` | Index on `(site_id, event_type)` |

### 3.8 Sequence privileges

| Sequence | `USAGE` | `SELECT` | `UPDATE` |
| --- | --- | --- | --- |
| `public.accepted_events_event_id_seq` | true | true | false |
| `public.rejected_events_id_seq` | true | true | false |

---

## 4. Code path under diagnosis

`src/collector/v1/persistence.ts` (compiled to
`dist/collector/v1/persistence.js`) performs the `accepted_events`
insert as:

```sql
INSERT INTO accepted_events ( … )
VALUES ($1 … $37)
ON CONFLICT (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL
  DO NOTHING
RETURNING event_id
```

Conflict resolution uses the partial unique index
`accepted_events_dedup` on `(workspace_id, site_id,
client_event_id)` with the same three-column `WHERE` predicate.
A secondary 23505 catch covers the legacy index
`idx_accepted_dedup_client_event` on `(site_id, session_id,
client_event_id)`.

---

## 5. Diagnostic interpretation

| Candidate root cause | Assessment |
| --- | --- |
| Live role mismatch (`current_user` ≠ `buyerrecon_prod_collector_app`) | **Ruled out** — `current_user` confirmed as `buyerrecon_prod_collector_app` (§3.1) |
| RLS / policy blocker | **Ruled out** — `relrowsecurity=false` on all three tables; no policies observed (§3.4–§3.5) |
| Trigger blocker | **Ruled out** — no triggers observed on any relevant table (§3.6) |
| `RETURNING event_id` requires `SELECT` on `event_id` | **Ruled out as sole cause** — `accepted_events.event_id` already has `SELECT=true` (§3.3) |
| Missing `SELECT` on `accepted_events` conflict-target columns (`workspace_id`, `site_id`, `client_event_id`) | **Leading candidate** — all three columns show `SELECT=false` (§3.3); `ON CONFLICT` resolution against the `accepted_events_dedup` partial index requires the executor to evaluate the conflict target, which may require read access to these columns |

**Leading candidate conclusion:** The `ON CONFLICT (workspace_id,
site_id, client_event_id) WHERE …` clause requires PostgreSQL to
locate and evaluate the `accepted_events_dedup` partial unique
index at execution time. The role holds `INSERT=true` but
`SELECT=false` on the three conflict-target columns. The
`permission denied for table accepted_events` error is consistent
with PostgreSQL requiring read access to resolve the index conflict
target when table-level `SELECT` is absent and no column-level
`SELECT` has been granted on those columns.

This interpretation is stated as the **leading candidate**, not a
proven fact. The post-fix proof (§7) will confirm or refute it.

---

## 6. Proposed minimal grant fix

> **This grant must not be applied in this PR.** It is recorded
> here as a proposed operator action pending review. The operator
> must apply it explicitly in a separate step after this PR is
> reviewed and approved.

```sql
GRANT SELECT (workspace_id, site_id, client_event_id)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

**Rationale:** This is the narrowest grant that addresses the
leading candidate root cause. It grants column-level `SELECT` only
on the three columns named in the `ON CONFLICT` target and the
`accepted_events_dedup` partial index predicate. It does not grant
table-level `SELECT` on `accepted_events`, does not grant `SELECT`
on any other column, and does not touch `ingest_requests` or
`rejected_events`.

**`session_id` is excluded** from the first proposed grant.
`session_id` appears in the legacy index
`idx_accepted_dedup_client_event` on `(site_id, session_id,
client_event_id)`, but that index is handled separately in the
persistence code via a 23505 catch-and-reclassify path — not via
the `ON CONFLICT` target clause. Adding `session_id` is a fallback
only if post-fix proof shows the legacy index path is still failing
after the primary grant is applied (see §6.1).

### 6.1 Candidate fallback options (not proposed for this step)

| Fallback | When to consider |
| --- | --- |
| Add `GRANT SELECT (session_id) ON public.accepted_events TO buyerrecon_prod_collector_app` | Only if post-fix proof shows the legacy `idx_accepted_dedup_client_event` path is still failing after the primary grant |
| Escalate to table-level `GRANT SELECT ON public.accepted_events TO buyerrecon_prod_collector_app` | Only if column-level grants prove insufficient after testing, and after explicit review |
| `GRANT SELECT ON public.rejected_events TO buyerrecon_prod_collector_app` | Only if a future proof shows a separate `rejected_events` read path is required |
| `GRANT SELECT ON public.ingest_requests TO buyerrecon_prod_collector_app` | Only if a future proof shows a separate `ingest_requests` read path is required |

Do not apply broad `SELECT` grants on `rejected_events` or
`ingest_requests` unless a specific failing path is confirmed.

---

## 7. Required post-fix proof before any new Gate 4C GO

Before a new Gate 4C execution GO PR can be issued, the following
must all be satisfied:

1. **Apply the approved grant** — execute the proposed `GRANT` in
   §6 (or the approved variant) as an explicit, separately
   authorized operator action in production.

2. **Post-fix privilege snapshot** — run `has_column_privilege`
   and confirm:

   | Column | `SELECT` after fix |
   | --- | --- |
   | `accepted_events.workspace_id` | **true** |
   | `accepted_events.site_id` | **true** |
   | `accepted_events.client_event_id` | **true** |

3. **Confirm no regression** — recheck RLS, policies, and triggers
   remain unchanged. Confirm `current_user` is still
   `buyerrecon_prod_collector_app`.

4. **Collector write-path proof** — confirm the
   `INSERT INTO accepted_events … ON CONFLICT … RETURNING event_id`
   path succeeds with the fixed privileges:
   - Preferred: staging environment proof against a non-production
     copy of the schema with the same role and grants.
   - If a production probe is required: must be separately
     authorized by a new GO that explicitly covers a bounded,
     non-customer probe — not authorized by this PR.

5. **Docs record** — merge a post-fix evidence doc recording the
   privilege snapshot after the grant and the write-path proof
   result.

6. **New fresh Gate 4C execution GO PR** — a PR#83-style record
   with `single_attempt_only=true`, explicitly referencing the
   post-fix evidence above, before any Gate 4C retry is executed.

---

## 8. Machine-readable block

```yaml
status: GATE4C_BLOCKED_GRANT_PROPOSAL_PENDING_REVIEW
pr84_verdict: GATE4C_EXECUTION_BLOCKED_ROLLED_BACK
pr85_status: GATE4C_BLOCKED_DIAGNOSTIC_PENDING
diagnostic_timestamp: 2026-06-02T16:34:16Z
app_role: buyerrecon_prod_collector_app
database: buyerrecon_production
role_mismatch_ruled_out: true
rls_ruled_out: true
trigger_ruled_out: true
returning_event_id_ruled_out_as_sole_cause: true
leading_candidate: missing_select_on_on_conflict_target_columns
conflict_target_columns_select:
  workspace_id: false
  site_id: false
  client_event_id: false
event_id_select: true
proposed_grant: >
  GRANT SELECT (workspace_id, site_id, client_event_id)
  ON public.accepted_events
  TO buyerrecon_prod_collector_app
grant_applied_by_this_pr: false
session_id_included_in_primary_grant: false
gate_4c_retry_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_grant_applied_by_this_pr: false
production_contact_by_this_pr: false
deploy_by_this_pr: false
canary_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
next_step: apply_approved_grant_then_post_fix_privilege_snapshot_then_write_path_proof_then_new_gate4c_go
```

---

## 9. Hard boundaries

This PR does **not**:
- apply any DB grant or change any DB privilege
- fix or contact production
- deploy or edit `/var/www`
- run a canary or retry Gate 4C
- perform any DB write
- authorize any Gate 4C retry
- claim Gate 4C PASS
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the diagnostic proof and the proposed minimal grant only.

`next_step: apply_approved_grant_then_post_fix_privilege_snapshot_then_write_path_proof_then_new_gate4c_go`
