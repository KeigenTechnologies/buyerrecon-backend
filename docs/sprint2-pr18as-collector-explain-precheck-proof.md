# Sprint 2 PR#18as — Gate 4C: Collector `EXPLAIN` Pre-Check Proof After `accepted_events` Grant (Docs-Only)

> **DOCS-ONLY EXPLAIN PRE-CHECK EVIDENCE RECORD.** This PR records
> the `EXPLAIN`-only (no `ANALYZE`) pre-check run after the
> `accepted_events` conflict-target SELECT grant recorded in PR #87.
> It does not prove full runtime write success, does not apply any
> DB grant, does not deploy, does not run a canary, does not retry
> Gate 4C, and does not open Gate 4D. The `EXPLAIN`-only commands
> were run in a prior read-only operator session and are recorded
> here. This PR itself contacts no environment and performs no
> production action.
> No secrets, no raw payloads, no raw `request_id` / `session_id`
> — categorical / structural facts only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` |
| PR #85 | Merged — `GATE4C_BLOCKED_DIAGNOSTIC_PENDING` |
| PR #86 | Merged — `GATE4C_BLOCKED_GRANT_PROPOSAL_PENDING_REVIEW` |
| PR #87 | Merged — `GATE4C_BLOCKED_GRANT_APPLIED_WRITE_PROOF_PENDING` |
| PR #88 | Merged — `GATE4C_BLOCKED_WRITE_PROOF_PLANNING` |
| PR #88 merge commit | `b36ed1f8fc2c7e26db5022157c9ea03230df1f3f` |
| Grant applied | `GRANT SELECT (workspace_id, site_id, client_event_id) ON public.accepted_events TO buyerrecon_prod_collector_app` at `2026-06-02T17:01:16Z` |
| PR #83 GO | Consumed |
| Gate 4C | Blocked — write-path proof still pending |
| Gate 4D | Closed |
| Production posture | Rolled back to legacy `/collect` |
| Retry authorized | No — full write-path proof and new fresh GO still required |

---

## 2. Pre-check purpose and scope

The `EXPLAIN`-only pre-check was performed to determine whether
PostgreSQL can **plan** the v1 `accepted_events` insert/conflict/
returning path after the conflict-target SELECT grant, without
executing the INSERT or creating any durable rows.

| Item | Value |
| --- | --- |
| Command used | `EXPLAIN (VERBOSE, COSTS OFF)` — **not** `EXPLAIN ANALYZE` |
| INSERT executed | No |
| Durable rows created | No |
| Sequence consumed | No — `event_id` BIGSERIAL is only incremented on actual execution; `EXPLAIN` without `ANALYZE` does not call it |
| Canary run | No |
| Website touched | No |
| `/var/www` edited | No |
| Gate 4C retry | No |
| Customer output | No |
| Lane / scoring / AMS Trust / Pass | No |
| Gate 4D opened | No |

---

## 3. Role / database / privilege state at time of pre-check

| Item | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |

Post-grant privilege state confirmed consistent with PR #87 §4:

| Column / privilege | Value |
| --- | --- |
| `accepted_events.event_id` SELECT | true |
| `accepted_events.workspace_id` SELECT | true |
| `accepted_events.site_id` SELECT | true |
| `accepted_events.client_event_id` SELECT | true |
| `accepted_events.session_id` SELECT | false |
| `accepted_events` table-level SELECT | false |
| `accepted_events` INSERT | true |
| RLS on `accepted_events` | false |
| Policy count | 0 |
| Trigger count | 0 |
| `accepted_events_dedup` index | Present — definition unchanged |

---

## 4. EXPLAIN pre-check

### 4.1 Timestamp

`2026-06-02T17:38:06Z`

### 4.2 Command category

```
EXPLAIN (VERBOSE, COSTS OFF)
INSERT INTO accepted_events ( <37 columns per persistence.ts ACCEPTED_INSERT_SQL> )
VALUES ( <37 synthetic placeholder literals — no real customer values> )
ON CONFLICT (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL
  DO NOTHING
RETURNING event_id
```

All 37 VALUES were synthetic placeholder literals. No real customer
values, no raw payloads, no `request_id`, no `session_id`, no IP
hashes, no user agents, no tokens, no DSNs.

### 4.3 Plan output (categorical)

PostgreSQL returned a query plan. Key plan lines:

```
Insert on public.accepted_events
  Output: accepted_events.event_id
  Conflict Resolution: NOTHING
  Conflict Arbiter Indexes: accepted_events_dedup
  ->  Result
```

The planner:
- resolved `ON CONFLICT` against the `accepted_events_dedup`
  partial unique index,
- accepted the `RETURNING event_id` output projection, and
- produced a complete plan without any `permission denied` error.

### 4.4 Verdict

**`EXPLAIN_PRECHECK_PASS`**

---

## 5. Interpretation

- PostgreSQL planned the `accepted_events` insert / conflict /
  returning shape successfully after the conflict-target SELECT
  grant.
- The `permission denied for table accepted_events` error that
  blocked Gate 4C execution (PR #84) did **not** appear during
  `EXPLAIN` planning.
- `accepted_events_dedup` (the partial unique index on
  `(workspace_id, site_id, client_event_id)`) was correctly
  identified as the conflict arbiter.
- `RETURNING event_id` was resolved in the plan output projection.
- This is a **positive signal** that the conflict-target column
  SELECT grant addresses the planning-time privilege gap.

**What this does not prove:** `EXPLAIN` without `ANALYZE` does not
execute the INSERT, does not enforce NOT NULL constraints at
runtime, does not increment sequences, and does not create durable
rows. A full safe write-path proof (PR #88 Option A or B) is still
required before any Gate 4C retry is authorized.

---

## 6. No-write confirmation

Post-`EXPLAIN` read-only row count check:

| Metric | Value |
| --- | --- |
| Confirmation timestamp | `2026-06-02T17:39:29Z` |
| `accepted_events_total` | 0 |
| `ingest_requests_total` | 29 |
| `rejected_events_total` | 0 |

No durable rows in `accepted_events`, `ingest_requests`, or
`rejected_events` were created by the `EXPLAIN`-only pre-check.
The `ingest_requests_total` of 29 reflects the pre-existing
baseline unchanged from PR #84 §5.

---

## 7. Required next steps before any Gate 4C retry

| Step | Status |
| --- | --- |
| 1. Conflict-target SELECT grant applied | Done (PR #87) |
| 2. Post-grant privilege snapshot | Done (PR #87 §4) |
| 3. `EXPLAIN` pre-check | **Done — `EXPLAIN_PRECHECK_PASS` (this PR)** |
| 4. Full safe write-path proof | **Not yet done — required** |
| 5. Post-proof evidence docs PR | Not yet done |
| 6. New fresh Gate 4C execution GO PR | Not yet done |
| 7. Single-attempt Gate 4C retry | Not yet done — gated on 4–6 |

The preferred write-path proof path remains **Option A** (staging
environment proof) from PR #88. If staging is unavailable,
**Option B** (transaction-rollback SQL proof against production,
with acknowledged sequence caveat) may be considered under explicit
approval. **Option C** (production write-path probe) remains last
resort and requires a separate Helen GO.

No Gate 4C retry is authorized until steps 4–6 above are complete.

---

## 8. Machine-readable block

```yaml
status: GATE4C_BLOCKED_EXPLAIN_PRECHECK_PASS_WRITE_PROOF_PENDING
pr88_status: GATE4C_BLOCKED_WRITE_PROOF_PLANNING
explain_precheck_timestamp: 2026-06-02T17:38:06Z
explain_command: EXPLAIN_VERBOSE_COSTS_OFF
explain_analyze_used: false
insert_executed: false
durable_rows_created: false
sequence_consumed: false
conflict_arbiter_index_resolved: accepted_events_dedup
returning_event_id_resolved: true
permission_denied_observed: false
explain_precheck_verdict: EXPLAIN_PRECHECK_PASS
no_write_confirmation_timestamp: 2026-06-02T17:39:29Z
accepted_events_total_post_explain: 0
ingest_requests_total_post_explain: 29
rejected_events_total_post_explain: 0
app_role_confirmed: buyerrecon_prod_collector_app
database_confirmed: buyerrecon_production
workspace_id_sel: true
site_id_sel: true
client_event_id_sel: true
event_id_sel: true
session_id_sel: false
ae_table_select: false
ae_table_insert: true
rls_unchanged: true
policies_unchanged: true
triggers_unchanged: true
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
next_step: full_safe_write_path_proof_then_evidence_pr_then_new_gate4c_go_pr_then_single_retry
```

---

## 9. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- execute an INSERT or write to the DB
- deploy or edit `/var/www`
- run a canary or retry Gate 4C
- contact any environment (the `EXPLAIN`-only commands were run in a prior operator session; this PR records them)
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime
- claim full runtime write-path proof

It records the `EXPLAIN`-only pre-check result only.

`next_step: full_safe_write_path_proof_then_evidence_pr_then_new_gate4c_go_pr_then_single_retry`
