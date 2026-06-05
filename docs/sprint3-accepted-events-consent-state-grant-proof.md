# Sprint 3 — `accepted_events.consent_state` Grant Proof (Docs-Only)

> **DOCS-ONLY POST-GRANT PROOF RECORD.** This PR records the
> application and proof of the `accepted_events.consent_state`
> column-level SELECT grant authorized by PR #126 and Helen's
> explicit GO. It does not run the behavioural extractor, does not
> run any downstream worker, does not write to DB, does not contact
> production beyond the already-completed operator session described
> below, and does not open Gate 4E. No secrets, no raw payloads, no
> raw `request_id` / `session_id`.

---

## 1. Proof verdict

**`ACCEPTED_EVENTS_CONSENT_STATE_GRANT_APPLIED_PASS`**

The `consent_state` column-level SELECT grant was applied
successfully. `consent_state_sel` changed from `f` to `t`. All
other relevant privilege boundaries remained unchanged.

---

## 2. Helen GO phrase

> **`HELEN CONSENT_STATE GRANT GO: apply the consent_state column
> grant now.`**

---

## 3. Grant execution

### 3.1 Exact grant applied

```sql
GRANT SELECT (consent_state) ON TABLE public.accepted_events TO buyerrecon_prod_collector_app;
```

This is a single-column `SELECT` grant only. No other column, no
table-level `SELECT`, no `ip_hash`, no `request_id`, no
`INSERT`/`UPDATE`/`DELETE`.

### 3.2 Grant execution output

```
BEGIN
GRANT
COMMIT
```

### 3.3 DSN path note

The first attempted env-key path (`.env.production` lacking
`SUPERUSER_DATABASE_URL`) stopped safely — no grant was applied
during that attempt. The grant was then applied via the local
`postgres` admin route. No DSN, password, or token was printed at
any point.

---

## 4. Pre-grant privilege snapshot

App role session (`buyerrecon_prod_collector_app`,
`buyerrecon_production`, `transaction_read_only=on`):

```
ROLE_GATE|buyerrecon_prod_collector_app|buyerrecon_production|on
PRE_GRANT|f|f|f|f|t|t
```

| Field | Pre-grant value | Notes |
| --- | --- | --- |
| `ae_tbl_select` | `f` | Table-level SELECT not granted |
| `consent_state_sel` | **`f`** | About to be granted |
| `ip_hash_sel` | `f` | Not granted — unchanged |
| `request_id_sel` | `f` | Not granted — unchanged |
| `raw_sel` | `t` | Prior carry-forward from PR #122 — not changed by this session |
| `canonical_jsonb_sel` | `t` | Prior carry-forward from PR #122 — not changed by this session |

---

## 5. Post-grant privilege snapshot

App role session (`buyerrecon_prod_collector_app`,
`buyerrecon_production`, `transaction_read_only=on`,
`2026-06-05 11:13:38.297383 UTC`):

```
POST_ROLE_GATE|buyerrecon_prod_collector_app|buyerrecon_production|on|2026-06-05 11:13:38.297383
POST_GRANT|f|t|f|f|t|t
```

| Field | Post-grant value | Change | Notes |
| --- | --- | --- | --- |
| `ae_tbl_select` | `f` | — | Table-level SELECT remains denied |
| `consent_state_sel` | **`t`** | ✓ **granted** | Newly granted by this session |
| `ip_hash_sel` | `f` | — | Unchanged — remains denied |
| `request_id_sel` | `f` | — | Unchanged — remains denied |
| `raw_sel` | `t` | — | Unchanged from pre-grant — prior carry-forward from PR #122 |
| `canonical_jsonb_sel` | `t` | — | Unchanged from pre-grant — prior carry-forward from PR #122 |

`raw_sel` and `canonical_jsonb_sel` were `t` before and after this
session. They were not changed by this grant. They reflect prior
accepted_events read grants from the extractor privilege chain
(PR #122). This session applied only `consent_state`.

---

## 6. Lane A/B counts

The app role (`buyerrecon_prod_collector_app`) received `permission
denied for table scoring_output_lane_a` when the Lane count query
was attempted — this is **expected least-privilege behaviour**.
The app role does not hold SELECT on Lane tables; no Lane access
was granted.

Lane A/B counts were verified separately via a local `postgres`
read-only aggregate session:

```
LANE_COUNT_PROOF|postgres|buyerrecon_production|on|0|0
```

| Table | Count |
| --- | --- |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |

Lane A/B writer remained inactive. Migration 016 grant safety in
force.

---

## 7. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Exact grant applied | `GRANT SELECT (consent_state) ON TABLE public.accepted_events TO buyerrecon_prod_collector_app` |
| Anything beyond single-column grant | None |
| `raw_sel` or `canonical_jsonb_sel` changed by this session | No — prior carry-forward; unchanged |
| DSN / password / token printed | No |
| Raw identifiers printed | No |
| `accepted_events` row reads | No |
| Raw payload / customer data printed | No |
| Behavioural extractor run | No |
| `accepted_events` pre-check diagnostic run | No |
| Downstream worker run | No |
| Customer output | No |
| Lane write | No |
| Scoring runtime | No |
| AMS Trust / Pass runtime | No |
| Gate 4E opened | No |
| Gate 4F invented | No |

---

## 8. Next step

This proof PR does **not** authorize behavioural extractor
execution. The required sequence after this proof merges:

1. **`accepted_events` read-privilege pre-check diagnostic GO** —
   a separate read-only diagnostic session confirming all required
   columns (including `consent_state`) have SELECT for
   `buyerrecon_prod_collector_app`, analogous to the session in
   PR #118–#119.
2. **Pre-check diagnostic execution and evidence PR.**
3. **Behavioural extractor run GO PR** — only after the diagnostic
   passes.
4. **Behavioural extractor run and post-extractor evidence PR.**

---

## 9. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_CONSENT_STATE_GRANT_APPLIED_PASS
go_source: PR_126_ACCEPTED_EVENTS_CONSENT_STATE_GRANT_GO_PLANNING
pr126_merge_commit: 204dcd768ade50f468ef8fd51977f530b5697d4f
helen_go_phrase: HELEN CONSENT_STATE GRANT GO apply the consent_state column grant now
grant_applied: GRANT_SELECT_consent_state_ON_accepted_events_TO_buyerrecon_prod_collector_app
pre_grant_consent_state_sel: false
post_grant_consent_state_sel: true
ae_tbl_select_pre: false
ae_tbl_select_post: false
ip_hash_sel: false
request_id_sel: false
raw_sel_pre: true
raw_sel_post: true
raw_sel_changed_by_session: false
canonical_jsonb_sel_pre: true
canonical_jsonb_sel_post: true
canonical_jsonb_sel_changed_by_session: false
proof_timestamp_utc: "2026-06-05 11:13:38.297383"
lane_a_count: 0
lane_b_count: 0
lane_count_role: postgres_read_only_aggregate
app_role_lane_select: denied_expected_least_privilege
grant_applied_by_this_pr: false
behavioural_extractor_authorised_by_this_pr: false
precheck_diagnostic_authorised_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: accepted_events_precheck_diagnostic_go_then_behavioural_extractor_go
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any further DB grant or change any privilege
- run the behavioural extractor or any downstream worker
- contact production or perform DB writes beyond the already-completed session
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the `accepted_events.consent_state` grant proof only.

`next_step: accepted_events_precheck_diagnostic_go_then_behavioural_extractor_go`
