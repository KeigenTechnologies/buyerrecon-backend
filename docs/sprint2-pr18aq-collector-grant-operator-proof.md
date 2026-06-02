# Sprint 2 PR#18aq — Gate 4C: `accepted_events` Conflict-Target Grant Operator Proof (Docs-Only)

> **DOCS-ONLY POST-GRANT PROOF RECORD.** This PR records the
> production DB grant operator session: pre-grant snapshot, the
> narrow column-level `SELECT` grant applied as a manual production
> step, and the post-grant privilege snapshot confirming the grant
> took effect. It does **not** apply any further DB change, does not
> deploy, does not contact production, does not run a canary, does
> not retry Gate 4C, and does not open Gate 4D. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts and redactions only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` |
| PR #85 | Merged — `GATE4C_BLOCKED_DIAGNOSTIC_PENDING` |
| PR #86 | Merged — `GATE4C_BLOCKED_GRANT_PROPOSAL_PENDING_REVIEW` |
| PR #86 merge commit | `489e511ad63745b3cd82d3fc2598299f6e5468c1` |
| PR #83 GO | Consumed |
| Gate 4C | Blocked and rolled back |
| Gate 4D | Closed |
| Production posture | Rolled back to legacy `/collect`; no Gate 4C active |
| Retry authorized | No — write-path proof and a new fresh GO still required |

---

## 2. Grant applied

The narrow column-level `SELECT` grant from PR #86 §6 was applied
manually by the operator as a production DB operator step.

| Item | Value |
| --- | --- |
| Grant timestamp | `2026-06-02T17:01:16Z` |
| Grant output | `GRANT` |
| Role granted to | `buyerrecon_prod_collector_app` |
| Database | `buyerrecon_production` |

```sql
GRANT SELECT (workspace_id, site_id, client_event_id)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

**Scope of this grant:**

| Item | Applied |
| --- | --- |
| Column-level `SELECT` on `accepted_events.workspace_id` | Yes |
| Column-level `SELECT` on `accepted_events.site_id` | Yes |
| Column-level `SELECT` on `accepted_events.client_event_id` | Yes |
| Table-level `SELECT` on `accepted_events` | **No** — not granted |
| Any grant on `rejected_events` | No |
| Any grant on `ingest_requests` | No |
| Any grant on `session_id` | No |
| RLS / policy / trigger change | No |
| Code change | No |
| Schema change | No |
| Migration | No |

---

## 3. Pre-grant snapshot

Captured via read-only diagnostic session at
`2026-06-02 17:00:23 UTC` under `buyerrecon_prod_audit_readonly`
(or equivalent read-only role). No writes performed.

### 3.1 Role / database identity

| `current_user` | `current_database()` | Timestamp |
| --- | --- | --- |
| `buyerrecon_prod_collector_app` | `buyerrecon_production` | `2026-06-02 17:00:23.335586 UTC` |

### 3.2 Table-level privileges (pre-grant)

| Table | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `public.accepted_events` | false | true | false |
| `public.ingest_requests` | false | true | true |
| `public.rejected_events` | false | true | false |

### 3.3 Column-level `SELECT` on `accepted_events` (pre-grant)

| Column | `SELECT` |
| --- | --- |
| `event_id` | true |
| `workspace_id` | **false** |
| `site_id` | **false** |
| `client_event_id` | **false** |
| `session_id` | false |

### 3.4 RLS / policies / triggers (pre-grant)

| Check | Value |
| --- | --- |
| `accepted_events.relrowsecurity` | false |
| `ingest_requests.relrowsecurity` | false |
| `rejected_events.relrowsecurity` | false |
| Policy count | 0 |
| Trigger count | 0 |

---

## 4. Post-grant snapshot

Captured via read-only session at `2026-06-02 17:01:27 UTC`
immediately after the `GRANT` statement returned `GRANT`.

### 4.1 Role / database identity (post-grant)

| `current_user` | `current_database()` | Timestamp |
| --- | --- | --- |
| `buyerrecon_prod_collector_app` | `buyerrecon_production` | `2026-06-02 17:01:27.657002 UTC` |

### 4.2 Column-level `SELECT` on `accepted_events` (post-grant)

| Column | `SELECT` before | `SELECT` after |
| --- | --- | --- |
| `event_id` | true | true ✓ |
| `workspace_id` | false | **true** ✓ |
| `site_id` | false | **true** ✓ |
| `client_event_id` | false | **true** ✓ |
| `session_id` | false | false ✓ |

All three conflict-target columns now have `SELECT=true`.
`session_id` intentionally remains `false`.

### 4.3 Table-level privileges on `accepted_events` (post-grant)

| Privilege | Value |
| --- | --- |
| `SELECT` (table-level) | **false** — intentionally not granted |
| `INSERT` | true — unchanged |
| `UPDATE` | false — unchanged |

Table-level `SELECT` was not granted. The grant is column-scoped
only.

### 4.4 RLS / policies / triggers (post-grant)

| Check | Value |
| --- | --- |
| `accepted_events.relrowsecurity` | false — unchanged |
| `ingest_requests.relrowsecurity` | false — unchanged |
| `rejected_events.relrowsecurity` | false — unchanged |
| Policy count | 0 — unchanged |
| Trigger count | 0 — unchanged |

---

## 5. Interpretation

The grant was applied cleanly and the post-grant snapshot confirms:

- The three `ON CONFLICT (workspace_id, site_id, client_event_id)`
  target columns now have `SELECT=true` for
  `buyerrecon_prod_collector_app`.
- The `accepted_events_dedup` partial unique index relies on these
  same three columns and their `WHERE` predicate
  (`workspace_id IS NOT NULL AND site_id IS NOT NULL AND
  client_event_id IS NOT NULL`).
- Table-level `SELECT` was deliberately not granted; the grant is
  the minimum column-level scope from PR #86.
- RLS, policies, and triggers are unchanged and continue to not
  block the write path.

Whether this grant fully resolves the `permission denied for table
accepted_events` failure observed in PR #84 is **not yet proven**.
A safe collector write-path proof is still required before any
Gate 4C retry (see §6).

---

## 6. Required next steps before any Gate 4C retry

| Step | Status |
| --- | --- |
| 1. Narrow column-level SELECT grant applied | **Done** (this PR) |
| 2. Post-grant privilege snapshot confirming columns | **Done** (§4.2) |
| 3. RLS / policies / triggers confirmed unchanged | **Done** (§4.4) |
| 4. Safe collector write-path proof | **Not yet done** — required |
| 5. New fresh Gate 4C execution GO PR | **Not yet done** — required |
| 6. Single-attempt Gate 4C retry | **Not yet done** — gated on 4 + 5 |

The write-path proof (step 4) must confirm the
`INSERT INTO accepted_events … ON CONFLICT (workspace_id, site_id,
client_event_id) … DO NOTHING RETURNING event_id` path succeeds
when executed as `buyerrecon_prod_collector_app` with the new
column-level grants in place. If a production probe is required, it
must be separately authorized — it is not authorized by this PR.

The new Gate 4C execution GO PR (step 5) must be a fresh
PR#83-style record with `single_attempt_only=true`, explicitly
referencing this post-grant proof.

---

## 7. Machine-readable block

```yaml
status: GATE4C_BLOCKED_GRANT_APPLIED_WRITE_PROOF_PENDING
pr84_verdict: GATE4C_EXECUTION_BLOCKED_ROLLED_BACK
pr86_proposal: GATE4C_BLOCKED_GRANT_PROPOSAL_PENDING_REVIEW
grant_timestamp: 2026-06-02T17:01:16Z
grant_output: GRANT
grant_statement: >
  GRANT SELECT (workspace_id, site_id, client_event_id)
  ON public.accepted_events
  TO buyerrecon_prod_collector_app
post_grant_workspace_id_select: true
post_grant_site_id_select: true
post_grant_client_event_id_select: true
post_grant_event_id_select: true
post_grant_session_id_select: false
post_grant_ae_table_select: false
post_grant_ae_table_insert: true
rls_unchanged: true
policies_unchanged: true
triggers_unchanged: true
app_role_confirmed: buyerrecon_prod_collector_app
database_confirmed: buyerrecon_production
write_path_proof_done: false
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
next_step: safe_collector_write_path_proof_then_new_gate4c_execution_go_pr_then_single_retry
```

---

## 8. Hard boundaries

This PR does **not**:
- apply any DB grant (the grant was applied as a prior manual
  production operator step, not by this PR)
- contact production or perform any DB write
- deploy or edit `/var/www`
- run a canary or retry Gate 4C
- authorize any Gate 4C retry
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the grant operator session proof only.

`next_step: safe_collector_write_path_proof_then_new_gate4c_execution_go_pr_then_single_retry`
