# Sprint 2 PR#18bc — Gate 4D Read-Only Observation PASS Evidence (Docs-Only)

> **DOCS-ONLY POST-OBSERVATION EVIDENCE RECORD.** This PR records the
> Gate 4D read-only observation rerun result following the PR #98 GO
> and the Option B audit grant proof in PR #97. The observation
> completed with `GATE4D_OBSERVATION_PASS`. It performs **no** DB
> grant, **no** DB write, **no** production contact, **no** worker
> activation, and does **not** open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts only.

---

## 1. Observation verdict

**`GATE4D_OBSERVATION_PASS`**

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #95 | Merged — `GATE4D_OBSERVATION_BLOCKED` (first attempt; audit SELECT gap) |
| PR #97 | Merged — `GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS` |
| PR #98 | Merged — `GATE4D_OBSERVATION_GO_RECORDED` (second GO) |
| PR #98 merge commit | `905d0b6c17cd1e3b7f2fbab48a17073a8977c605` |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — unchanged |
| Gate 4D | **`GATE4D_OBSERVATION_PASS`** (this PR) |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not activated |
| Lane writer | Not activated |
| Scoring runtime | Not activated |
| AMS Trust / Pass runtime | Not activated |

---

## 3. Observation environment

| Item | Value |
| --- | --- |
| Role | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| `default_transaction_read_only` | `on` |
| Observation start | `2026-06-02 21:14:34+00` |
| Observation end | Captured `OBS_END_SQL` value from operator session |
| Query types used | `SELECT` / `COUNT(*)` / `GROUP BY` only |

No raw payloads, `canonical_jsonb`, `request_id`, `session_id`,
`browser_id`, IP hashes, user agents, token hashes, DSNs,
Authorization values, or customer-identifying data were selected
or recorded in this observation session.

---

## 4. Collector-layer evidence

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

### 4.4 Invalid-JSON, baseline, and collect-hits

| Metric | Value |
| --- | --- |
| `new_invalid_json_since_gate4c` | 0 |
| `protected_invalid_json_pre_20260520` | 26 — **intact** |
| `collect_hits_since_gate4c` | 0 |

---

## 5. Lane / scoring-output lock evidence

| Table | Row count |
| --- | --- |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |

Lane A/B writer remained inactive. Migration 016 grant safety in
force.

---

## 6. Downstream readiness evidence

The downstream `COUNT(*)` readiness query executed successfully
under the Option B column-level audit grants (PR #97). No
`permission denied` was returned.

| Table | Count |
| --- | --- |
| `session_features` | 0 |
| `session_behavioural_features_v0_2` | 0 |
| `stage0_decisions` | 0 |
| `risk_observations_v0_1` | 0 |

Zero counts are expected and acceptable. Downstream workers have
not been activated; these tables will accumulate rows when worker
pipelines are enabled under their own separately gated PRs. The
proof target was that the read-only observation could complete
under the Option B audit grants without exposing sensitive columns.

---

## 7. Sensitive-column protection evidence

Spot-check of the Option B grant posture during the observation
session:

| Check | Value |
| --- | --- |
| `session_features` table-level SELECT | false — intentional; column-level only |
| `session_features.session_features_id` SELECT | true — PK column; safe surrogate |
| `session_features.session_id` SELECT | **false** — sensitive column; access denied |

**Interpretation:** The audit role can execute `COUNT(*)` readiness
checks on downstream tables. Sensitive `session_id` (and other
non-granted columns) remain protected at the PostgreSQL permission
layer. No table-level SELECT was granted. Option B least-privilege
posture is confirmed active.

---

## 8. Collector log evidence

Categorical counts from the journal window. No raw log lines.

| Log category | Count |
| --- | --- |
| `storage_failure` | 0 |
| `permission denied` | 0 |
| `request_body_invalid_json` | 0 |
| `error` (general) | 0 |

Collector logs: **clean**.

---

## 9. Stop-line status

| Stop-line | Status |
| --- | --- |
| Read-only role / database mismatch | Not triggered |
| `transaction_read_only` not `on` | Not triggered |
| Query required raw identifiers / payloads / sensitive columns | Not triggered |
| `new_invalid_json_since_gate4c > 0` | Not triggered — count `0` |
| `collect_hits_since_gate4c > 0` | Not triggered — count `0` |
| `storage_failure` / `permission denied` log count `> 0` | Not triggered — count `0` |
| `accepted_events_total_in_window = 0` | Not triggered — count `9` |
| Lane A/B row count non-zero | Not triggered — both `0` |
| Downstream `COUNT(*)` checks fail | Not triggered — all succeeded |
| Customer output / scoring / AMS Trust / Pass activation | Not observed |
| Secret / raw identifier exposure | Not observed |

All stop-lines: **clear**.

---

## 10. Conclusion

| Item | Status |
| --- | --- |
| Overall verdict | **`GATE4D_OBSERVATION_PASS`** |
| Production collector ingestion | Stable — `accepted_in_window=9`, logs clean |
| Invalid-json recurrence | None |
| Collect endpoint fallback | None |
| Rejected events | None |
| Storage_failure / permission denied | None |
| Lane / scoring output | Inactive (`0/0`) |
| Downstream readiness COUNT(*) | Completed — no `permission denied`; zero counts expected |
| Sensitive-column protection | Confirmed active (`session_id` denied) |
| Gate 4E | Closed |
| Gate 4F | Not invented |

Any next gate or runtime activation requires a separate planning
PR and explicit Helen GO.

---

## 11. Machine-readable block

```yaml
status: GATE4D_OBSERVATION_PASS
gate4c_status: GATE4C_EXECUTION_PASS
observation_go_source: PR_98_GATE4D_OBSERVATION_GO_RECORDED
option_b_grant_source: PR_97_GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS
observation_role: buyerrecon_prod_audit_readonly
observation_db: buyerrecon_production
default_transaction_read_only: on
observation_start: "2026-06-02 21:14:34+00"
accepted_total_in_window: 9
new_invalid_json_since_gate4c: 0
protected_invalid_json_pre_20260520: 26
collect_hits_since_gate4c: 0
rejected_total_in_window: 0
lane_a_count: 0
lane_b_count: 0
session_features_count: 0
behavioural_features_count: 0
stage0_count: 0
risk_obs_count: 0
downstream_count_star_succeeded: true
session_features_table_select: false
session_features_id_select: true
session_id_select: false
log_storage_failure_count: 0
log_permission_denied_count: 0
log_invalid_json_count: 0
log_error_count: 0
all_stop_lines_clear: true
db_write_performed: false
worker_activated: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
db_grant_applied_by_this_pr: false
next_step: separate_planning_pr_or_go_for_any_next_gate_or_runtime_activation
```

---

## 12. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- contact production or perform any DB write
- execute any observation or run production queries
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

It records the Gate 4D observation rerun PASS only.

`next_step: separate_planning_pr_or_go_for_any_next_gate_or_runtime_activation`
