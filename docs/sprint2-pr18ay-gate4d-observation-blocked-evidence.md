# Sprint 2 PR#18ay — Gate 4D Read-Only Observation Blocked Evidence (Docs-Only)

> **DOCS-ONLY OBSERVATION EVIDENCE RECORD.** This PR records the Gate
> 4D read-only observation result following the PR #94 GO. The
> collector layer was healthy. The observation was blocked because the
> `buyerrecon_prod_audit_readonly` role lacks `SELECT` on required
> downstream readiness tables. It performs **no** DB grant, **no** DB
> write, **no** production contact, **no** deploy, **no** worker
> activation, and does **not** open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts only.

---

## 1. Observation verdict

**`GATE4D_OBSERVATION_BLOCKED`**

**Reason:** Downstream readiness observation could not complete.
`buyerrecon_prod_audit_readonly` lacks `SELECT` on
`session_features`, `session_behavioural_features_v0_2`,
`stage0_decisions`, and `risk_observations_v0_1`.

**Important:** This is **not** a Gate 4C failure. Gate 4C remains
`GATE4C_EXECUTION_PASS`. Production `/v1/event` ingestion was healthy
during the observation window. The block is a read-only audit-grant
coverage gap for downstream readiness tables only.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #93 | Merged — `GATE4D_PLANNING_RECORDED` |
| PR #94 | Merged — `GATE4D_OBSERVATION_GO_RECORDED` |
| PR #94 merge commit | `8ceea984b1dde0cd430e135a3cb650a5430e885f` |
| Gate 4C verdict | **`GATE4C_EXECUTION_PASS`** — unchanged |
| Gate 4D observation | `GATE4D_OBSERVATION_BLOCKED` (this PR) |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not activated |
| Lane writer | Not activated |
| Scoring runtime | Not activated |
| AMS Trust / Pass runtime | Not activated |

---

## 3. Observation session

| Item | Value |
| --- | --- |
| `observation_start_utc` | `2026-06-02 21:14:34+00` |
| `observation_end_utc` | `2026-06-02 21:57:04+00` |
| Role | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| Session mode | Read-only audit session under `PGOPTIONS` read-only; `transaction_read_only=on` intended and operated as such |

No DB writes were performed. No mutations. No worker activation.

---

## 4. Collector-layer evidence (completed successfully)

### 4.1 Ingestion summary

| Endpoint | HTTP status | Reject reason | Row count |
| --- | --- | --- | --- |
| `/v1/event` | 200 | `<null>` | 9 |

### 4.2 Accepted events

| Metric | Value |
| --- | --- |
| `accepted_total_in_window` | 9 |

Hourly bucket:

| Hour bucket | Accepted count |
| --- | --- |
| `2026-06-02 21:00:00 UTC` | 9 |

### 4.3 Rejected events

| Metric | Value |
| --- | --- |
| `rejected_total_in_window` | 0 |
| Categorical breakdown | No rows |

### 4.4 Invalid-JSON and collect-hits checks

| Metric | Value |
| --- | --- |
| `new_invalid_json_since_gate4c` | 0 |
| `protected_invalid_json_pre_20260520` | 26 — **intact** |
| `collect_hits_since_gate4c` | 0 |

### 4.5 Collector-layer summary

```
accepted_in_window       = 9
new_invalid_json         = 0
collect_hits             = 0
rejected_in_window       = 0
```

Collector layer: **healthy**.

---

## 5. Collector log evidence

Categorical counts only. No raw log lines.

| Log category | Count since Gate 4C PASS |
| --- | --- |
| `storage_failure` | 0 |
| `permission denied` | 0 |
| `request_body_invalid_json` | 0 |
| `error` (general) | 0 |

Collector logs: **clean**.

---

## 6. Lane / scoring-output lock confirmation

| Table | Row count |
| --- | --- |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |

Lane A/B writer remained inactive. Migration 016 grant safety in
force.

---

## 7. Downstream readiness — blocked

The downstream readiness portion of the PR #94 §4.2-I observation
query failed. A prior privilege diagnostic was run to characterize
the access gap.

### 7.1 Table existence and audit-role SELECT privilege

| Table | Exists | `audit_can_select` |
| --- | --- | --- |
| `risk_observations_v0_1` | true | **false** |
| `scoring_output_lane_a` | true | true |
| `scoring_output_lane_b` | true | true |
| `session_behavioural_features_v0_2` | true | **false** |
| `session_features` | true | **false** |
| `stage0_decisions` | true | **false** |

### 7.2 Failure observed

The downstream readiness multi-table count query (PR #94 §4.2-I)
failed with:

```
permission denied for table session_features
```

The query did not complete. No row counts for `session_features`,
`session_behavioural_features_v0_2`, `stage0_decisions`, or
`risk_observations_v0_1` were returned.

### 7.3 Interpretation

- `buyerrecon_prod_audit_readonly` was granted `SELECT` on the five
  Gate 4A audit tables (PR#18v) but was not granted `SELECT` on the
  downstream readiness tables added in later migrations.
- This is an audit-grant coverage gap, not a data integrity issue or
  a collector failure.
- `scoring_output_lane_a` and `scoring_output_lane_b` are accessible
  to the audit role (and confirmed zero — §6).
- The four inaccessible tables (`session_features`,
  `session_behavioural_features_v0_2`, `stage0_decisions`,
  `risk_observations_v0_1`) require separate `SELECT` grants to
  `buyerrecon_prod_audit_readonly` before the downstream readiness
  observation can complete.

---

## 8. Stop-line status

| Stop-line | Status |
| --- | --- |
| New `request_body_invalid_json` spike | Not triggered — count `0` |
| `storage_failure` / `permission denied` in collector logs | Not triggered — count `0` |
| `accepted_events_total_in_window = 0` | Not triggered — count `9` |
| `collect_hits_post_flip > 0` | Not triggered — count `0` |
| `rejected_events` materially unexpected | Not triggered — count `0` |
| Lane A/B rows non-zero | Not triggered — both `0` |
| Downstream readiness query access | **BLOCKED** — audit role lacks `SELECT` on 4 tables |
| Customer output / scoring / AMS Trust / Pass activation | Not observed |
| Raw identifiers / customer data exposure | Not observed |

---

## 9. Conclusion

| Item | Value |
| --- | --- |
| Overall verdict | **`GATE4D_OBSERVATION_BLOCKED`** |
| Block reason | `audit_role_select_gap_on_downstream_readiness_tables` |
| Gate 4C status | **`GATE4C_EXECUTION_PASS`** — unchanged |
| Production ingestion health | Healthy — `accepted_in_window=9`, clean logs |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 10. Required next steps

| Step | Notes |
| --- | --- |
| Separate diagnostic / grant-planning PR | Characterize the exact `SELECT` grants needed on `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, and `risk_observations_v0_1` for `buyerrecon_prod_audit_readonly`; do not apply grants in this PR |
| Option: narrow Gate 4D scope | Explicitly reduce the observation scope to exclude downstream readiness counts (collector-layer only), under explicit review — this would allow a PASS verdict on the collector-layer evidence already recorded in §4–§6 |
| New Gate 4D observation GO | After grants are addressed or scope is narrowed, a new observation GO PR is required before re-running the downstream portion |

No grants are applied by this PR. No runtime is activated.

---

## 11. Machine-readable block

```yaml
status: GATE4D_OBSERVATION_BLOCKED
block_reason: audit_role_select_gap_on_downstream_readiness_tables
gate4c_status: GATE4C_EXECUTION_PASS
observation_start_utc: "2026-06-02 21:14:34+00"
observation_end_utc: "2026-06-02 21:57:04+00"
observation_role: buyerrecon_prod_audit_readonly
observation_db: buyerrecon_production
accepted_total_in_window: 9
new_invalid_json_since_gate4c: 0
protected_invalid_json_pre_20260520: 26
collect_hits_since_gate4c: 0
rejected_total_in_window: 0
lane_a_count: 0
lane_b_count: 0
log_storage_failure_count: 0
log_permission_denied_count: 0
log_invalid_json_count: 0
log_error_count: 0
session_features_audit_select: false
session_behavioural_features_v0_2_audit_select: false
stage0_decisions_audit_select: false
risk_observations_v0_1_audit_select: false
scoring_output_lane_a_audit_select: true
scoring_output_lane_b_audit_select: true
downstream_query_error: permission_denied_for_table_session_features
db_write_performed: false
worker_activated: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
db_grant_applied_by_this_pr: false
next_step: separate_audit_grant_planning_pr_or_narrow_gate4d_scope_then_new_observation_go
```

---

## 12. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- contact production or perform any DB write
- deploy or activate any worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the Gate 4D observation block only.

`next_step: separate_audit_grant_planning_pr_or_narrow_gate4d_scope_then_new_observation_go`
