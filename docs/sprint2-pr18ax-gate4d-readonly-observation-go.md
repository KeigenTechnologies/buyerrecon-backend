# Sprint 2 PR#18ax — Gate 4D Read-Only Post-Cutover Observation GO (Docs-Only)

> **DOCS-ONLY OBSERVATION-AUTHORIZATION RECORD. THIS PR DOES NOT
> EXECUTE.** It records a Helen GO for one bounded read-only Gate 4D
> post-cutover observation run, following the `GATE4C_EXECUTION_PASS`
> evidence merged in PR #92 and the Gate 4D planning merged in PR #93.
> The observation itself happens **only** in a later, separate operator
> session. This PR runs no queries, contacts no production environment,
> writes no data, activates no worker, Lane writer, scoring runtime,
> customer output, AMS Trust / Pass runtime, and does not open Gate 4E.
> No secrets, no raw payloads, no raw `request_id` / `session_id`
> — placeholders / redactions only.

---

## 1. Status / verdict

- **Status:** `GATE4D_OBSERVATION_GO_RECORDED`
- **Planning source:** PR #93 (`docs/sprint2-pr18aw-gate4d-planning-after-gate4c-pass.md`, merged).
- **Gate 4C PASS source:** PR #92 (`docs/sprint2-pr18av-gate4c-execution-pass-evidence.md`, merged) — `GATE4C_EXECUTION_PASS`, `2026-06-02T21:14:34Z`.
- **Observation start reference:** at or after PR #92 merge / Gate 4C PASS timestamp.
- **Observation type:** read-only; no mutations; no worker activation.

**Authorization granted by this PR (after merge only):**

- `gate_4d_readonly_observation_authorised_by_this_pr=true`
- `read_only_role_required=true` (`buyerrecon_prod_audit_readonly`)
- `production_db_required=true` (`buyerrecon_production`)
- `transaction_read_only_required=true`
- `post_observation_evidence_pr_required=true`
- `single_observation_window_only=true`

**Still false (NOT authorized by this PR):**

- `worker_activation_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `pr19c_runtime_authorised_by_this_pr=false`
- `pr19d_runtime_authorised_by_this_pr=false`
- `pr20_runtime_authorised_by_this_pr=false`
- `db_write_authorised_by_this_pr=false`
- `deploy_authorised_by_this_pr=false`

The authorization takes effect in a **later operator session** only after
this PR is merged; it causes no action at merge time.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #93 | Merged — `GATE4D_PLANNING_RECORDED` |
| PR #93 merge commit | `74e771e95f3de424ea016f148a9ae56bb470daf8` |
| Production `/v1/event` | Live since `2026-06-02T21:14:34Z` |
| Gate 4D observation | Eligible for execution **only after this GO merges** |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Closed |
| Lane writer | Closed |
| Scoring runtime | Closed |
| AMS Trust / Pass runtime | Closed |

---

## 3. Helen observation GO statement

> **Helen authorizes the operator to execute one bounded read-only
> Gate 4D post-cutover observation covering the window from Gate 4C
> PASS (`2026-06-02T21:14:34Z`) through the end of the chosen
> 24h or 48h window, strictly per the query scope in §4 and the
> redaction rules in §5. No mutations, no worker activation, no Lane
> writer, no scoring output, no customer output, no AMS Trust / Pass
> runtime.**

Clarifications:

- **Single window only.** This GO authorizes one bounded observation
  run; it is consumed on first use.
- **Read-only role required.** All queries must run under
  `buyerrecon_prod_audit_readonly` with `transaction_read_only=on`.
  No exceptions.
- **Not** a Gate 4E GO. **Not** a scoring activation. **Not** a
  customer-output approval.
- **No observation before this PR is merged.**
- After observation: a separate post-observation evidence PR is
  required before any further Gate 4D steps are taken.

---

## 4. Authorized observation scope

### 4.1 Observation window

| Option | Use when |
| --- | --- |
| 24h window | Sufficient live traffic exists since Gate 4C PASS to produce meaningful accepted_events accumulation |
| 48h window | Traffic volume is low and a longer window is needed for a representative sample |

Window reference: start at `2026-06-02T21:14:34Z` (Gate 4C PASS /
canary start); end at operator-chosen timestamp within the 24–48h range.

### 4.2 Allowed queries

All queries must use read-only role and `transaction_read_only=on`.

**A. Ingestion summary:**
```sql
SELECT endpoint, http_status, reject_reason_code, COUNT(*) AS row_count
FROM public.ingest_requests
WHERE received_at >= '2026-06-02T21:14:34Z'
GROUP BY endpoint, http_status, reject_reason_code
ORDER BY row_count DESC;
```

**B. Accepted events by time bucket:**
```sql
SELECT
  DATE_TRUNC('hour', received_at) AS hour_bucket,
  COUNT(*) AS accepted_count
FROM public.accepted_events
WHERE received_at >= '2026-06-02T21:14:34Z'
GROUP BY hour_bucket
ORDER BY hour_bucket;
```

**C. Accepted events total in window:**
```sql
SELECT COUNT(*) AS accepted_total_in_window
FROM public.accepted_events
WHERE received_at >= '2026-06-02T21:14:34Z';
```

**D. Rejected events categorical breakdown:**
```sql
SELECT reject_reason_code, rejected_stage, COUNT(*) AS row_count
FROM public.rejected_events
WHERE rejected_at >= '2026-06-02T21:14:34Z'
GROUP BY reject_reason_code, rejected_stage
ORDER BY row_count DESC;
```

**E. New invalid-json rows since Gate 4C PASS:**
```sql
SELECT COUNT(*) AS new_invalid_json_since_gate4c
FROM public.ingest_requests
WHERE reject_reason_code = 'request_body_invalid_json'
  AND received_at >= '2026-06-02T21:14:34Z';
```

**F. Protected 26-row baseline still intact:**
```sql
SELECT COUNT(*) AS protected_invalid_json_pre_20260520
FROM public.ingest_requests
WHERE reject_reason_code = 'request_body_invalid_json'
  AND received_at < '2026-05-20 00:00:00+00';
```
Expected: `26`.

**G. Collect-hits post-flip:**
```sql
SELECT COUNT(*) AS collect_hits_since_gate4c
FROM public.ingest_requests
WHERE endpoint ILIKE '%collect%'
  AND received_at >= '2026-06-02T21:14:34Z';
```
Expected: `0`.

**H. Lane A/B row counts:**
```sql
SELECT
  (SELECT COUNT(*) FROM public.scoring_output_lane_a) AS lane_a_count,
  (SELECT COUNT(*) FROM public.scoring_output_lane_b) AS lane_b_count;
```
Expected: both `0`.

**I. Downstream table existence / row counts (existence check only):**
```sql
SELECT
  (SELECT COUNT(*) FROM public.session_features)                  AS session_features_count,
  (SELECT COUNT(*) FROM public.session_behavioural_features_v0_2) AS behavioural_features_count,
  (SELECT COUNT(*) FROM public.stage0_decisions)                   AS stage0_count,
  (SELECT COUNT(*) FROM public.risk_observations_v0_1)             AS risk_obs_count;
```

**J. Collector log categorical scan (categorical only; no raw lines containing identifiers):**
```bash
journalctl -u buyerrecon-production-collector.service \
  --since "2026-06-02 21:14:34" \
  --until "<OBSERVATION_END_TIMESTAMP>" \
  | grep -ic 'storage_failure\|permission denied\|request_body_invalid_json\|error'
```
Record only the counts, not raw log lines.

### 4.3 Forbidden outputs

| Category | Forbidden |
| --- | --- |
| Row content | No — counts and categorical fields only |
| `canonical_jsonb` | No |
| `request_id` | No |
| `session_id` | No |
| `browser_id` | No |
| IP hashes | No |
| User agents | No |
| Token hashes | No |
| DSNs | No |
| Authorization values | No |
| Customer-identifying data | No |
| Customer-facing reports | No |
| Raw log lines with identifiers | No |

---

## 5. Redaction rules

- Record integer counts and categorical `reason_code` / `rejected_stage` / `endpoint` / `http_status` values only.
- Any log scan result must be summarized as a count of matching lines, not as verbatim log lines.
- If a query result would expose a `request_id`, `session_id`, `browser_id`, IP hash, user agent, or any customer field — **do not record it; record only the count**.
- No `canonical_jsonb`, no `raw` column content.

---

## 6. Observation stop-lines

Halt the observation and mark `GATE4D_OBSERVATION_BLOCKED` if any of the following:

| Stop-line | Action |
| --- | --- |
| Read-only role cannot access required tables | Stop |
| Any query requires raw identifiers or payloads | Stop — do not run |
| New `request_body_invalid_json` spike since Gate 4C PASS (`E > 0`) | Stop |
| `storage_failure` / `permission denied` observed in collector logs since Gate 4C PASS | Stop |
| `accepted_events_total_in_window = 0` (no ingestion in observation window) | Stop |
| `collect_hits_since_gate4c > 0` | Stop |
| `rejected_events` show materially unexpected reason patterns | Stop — record categorical reasons |
| Lane A/B row counts non-zero | Stop — migration 016 grant safety breach |
| Any customer output / scoring / AMS Trust / Pass activation observed | Stop |
| Any secret or raw identifier would be exposed | Stop |

---

## 7. Required execution environment

| Item | Required value |
| --- | --- |
| DB role | `buyerrecon_prod_audit_readonly` |
| DB | `buyerrecon_production` |
| `transaction_read_only` | `on` |
| `statement_timeout` | `10000` (10 s) |
| Observation type | `SELECT` / `COUNT` only — no DML |

---

## 8. Required post-observation evidence PR

A separate docs-only evidence PR must be created after the observation
session, recording (no secrets, no raw identifiers):

- Observation window (start / end timestamps)
- Role and database confirmed
- Query categories executed
- `accepted_total_in_window` count
- `ingest_requests` breakdown (endpoint / status / reason / count)
- `rejected_events` breakdown (reason / stage / count)
- `new_invalid_json_since_gate4c` count
- `protected_invalid_json_pre_20260520` count (expected `26`)
- `collect_hits_since_gate4c` count (expected `0`)
- Lane A/B counts (expected `0 / 0`)
- Downstream table counts (categorical)
- Collector log scan result (count of matching lines, not raw lines)
- All stop-line statuses
- Final verdict: `GATE4D_OBSERVATION_PASS` or `GATE4D_OBSERVATION_BLOCKED`

---

## 9. Governance carry-forward

- PR#18ab final-scoring governance locks: **in force**.
- PR#73 hard-gate carry-forward locks: **in force**.
- Protected 26-row invalid-json baseline: **must remain intact**.
- `customer_claim_allowed = false` — **in force**.
- `lane_output_allowed = false` — **in force**.
- `customer_visibility_allowed = false` — **in force**.
- `lane_write_allowed = false` — **in force**.
- `allowed_customer_language = []` — **in force**.
- Migration 016 grant safety: **in force** (Lane A/B counts must remain `0/0`).
- PR#19c / PR#19d / PR#20: **inactive**.
- No scoring runtime. No AMS Trust / Pass runtime.
- Gate 4E: **closed**. Gate 4F: **not invented**.

---

## 10. Machine-readable block

```yaml
status: GATE4D_OBSERVATION_GO_RECORDED
gate4c_pass_source: PR_92_GATE4C_EXECUTION_PASS
gate4c_pass_timestamp: 2026-06-02T21:14:34Z
gate4d_planning_source: PR_93_GATE4D_PLANNING_RECORDED
observation_role: buyerrecon_prod_audit_readonly
observation_db: buyerrecon_production
transaction_read_only_required: true
observation_window_start: 2026-06-02T21:14:34Z
observation_window_recommendation: 24h_or_48h
gate_4d_readonly_observation_authorised_by_this_pr: true
single_observation_window_only: true
post_observation_evidence_pr_required: true
worker_activation_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
pr19c_runtime_authorised_by_this_pr: false
pr19d_runtime_authorised_by_this_pr: false
pr20_runtime_authorised_by_this_pr: false
db_write_authorised_by_this_pr: false
deploy_authorised_by_this_pr: false
observation_before_this_pr_merges_authorised: false
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
next_step: operator_execute_single_readonly_observation_per_section4_then_open_evidence_pr
```

---

## 11. Hard boundaries

This PR does **not**:
- execute any observation or query
- contact production
- perform any DB write
- deploy or activate any worker
- edit `/var/www`
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime, or PR#19c / PR#19d / PR#20 runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It **only records Helen's explicit GO** for one later read-only
observation run. The observation happens in a later operator session,
strictly per §4, and must be followed by a separate post-observation
evidence PR.

`next_step: operator_execute_single_readonly_observation_per_section4_then_open_evidence_pr`
