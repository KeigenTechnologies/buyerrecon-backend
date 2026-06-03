# Sprint 2 PR#18bb — Gate 4D Read-Only Observation GO After Option B Audit Grant Proof (Docs-Only)

> **DOCS-ONLY OBSERVATION-AUTHORIZATION RECORD. THIS PR DOES NOT
> EXECUTE.** It records a Helen GO for one bounded read-only Gate 4D
> observation rerun, following the Option B column-level audit grant
> proof recorded in PR #97. The observation itself happens **only**
> in a later, separate operator session. This PR runs no queries,
> contacts no production environment, writes no data, activates no
> worker, Lane writer, scoring runtime, customer output, AMS Trust /
> Pass runtime, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — placeholders /
> redactions only.

---

## 1. Status / verdict

- **Status:** `GATE4D_OBSERVATION_GO_RECORDED` (second attempt;
  unblocked by Option B audit grant proof in PR #97)
- **Prior blocked observation:** PR #95 (`GATE4D_OBSERVATION_BLOCKED`
  — audit SELECT gap on downstream readiness tables)
- **Grant fix source:** PR #96 (planning) + PR #97
  (`GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS`)
- **Observation start reference:** Gate 4C PASS timestamp
  `2026-06-02T21:14:34Z`
- **Observation type:** read-only; no mutations; no worker activation

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
- `db_write_authorised_by_this_pr=false`
- `observation_before_this_pr_merges_authorised=false`

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #95 | Merged — `GATE4D_OBSERVATION_BLOCKED` |
| PR #96 | Merged — `GATE4D_DOWNSTREAM_AUDIT_GRANT_PLANNING` |
| PR #97 | Merged — `GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS` |
| PR #97 merge commit | `5b30c1f3f67db194a354339ee040f9d48ae618f8` |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — unchanged |
| Prior GO (PR #94) | Consumed |
| Gate 4D observation | Blocked — rerun requires this new GO |
| Option B audit grants | Applied and proofed: PK column SELECT `t|t|t|t`; table-level SELECT `f|f|f|f`; `session_id` SELECT `f|f|f|f`; `COUNT(*)` all four tables succeeded; negative proof confirmed |
| Gate 4E | Closed |
| Gate 4F | Not invented |

**No observation before this PR is merged.**

---

## 3. Helen observation GO statement

> **Helen authorizes the operator to execute one bounded read-only
> Gate 4D post-cutover observation rerun, covering the window from
> Gate 4C PASS (`2026-06-02T21:14:34Z`) through the end of the
> operator-chosen 24h or 48h window, strictly per the query scope in
> §4 and the redaction rules in §5, using only
> `buyerrecon_prod_audit_readonly` with `transaction_read_only=on`.
> No mutations, no worker activation, no Lane writer, no scoring
> output, no customer output, no AMS Trust / Pass runtime.**

Clarifications:

- **Single window only.** Consumed on first use.
- **Read-only role required.** `buyerrecon_prod_audit_readonly` with
  `transaction_read_only=on`. No exceptions.
- **Not** a Gate 4E GO. **Not** a scoring activation. **Not** a
  customer-output approval.
- **No observation before this PR is merged.**
- After observation: a separate post-observation evidence PR is
  required before any further Gate 4D steps.

---

## 4. Authorized observation scope

### 4.1 Observation window

| Option | Use when |
| --- | --- |
| 24h window | Sufficient live traffic since Gate 4C PASS |
| 48h window | Traffic volume low; longer window needed |

Window reference: start at `2026-06-02T21:14:34Z`; end at
operator-chosen timestamp within the 24–48h range from Gate 4C PASS.

### 4.2 Allowed queries

All queries under `buyerrecon_prod_audit_readonly` /
`transaction_read_only=on`. No DML.

**A. Ingestion summary:**
```sql
SELECT endpoint, http_status, reject_reason_code, COUNT(*) AS row_count
FROM public.ingest_requests
WHERE received_at >= '2026-06-02T21:14:34Z'
GROUP BY endpoint, http_status, reject_reason_code
ORDER BY row_count DESC;
```

**B. Accepted events — total in window:**
```sql
SELECT COUNT(*) AS accepted_total_in_window
FROM public.accepted_events
WHERE received_at >= '2026-06-02T21:14:34Z';
```

**C. Accepted events — hourly distribution:**
```sql
SELECT
  DATE_TRUNC('hour', received_at AT TIME ZONE 'UTC') AS hour_bucket,
  COUNT(*) AS accepted_count
FROM public.accepted_events
WHERE received_at >= '2026-06-02T21:14:34Z'
GROUP BY hour_bucket
ORDER BY hour_bucket;
```

**D. Rejected events — categorical breakdown:**
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

**F. Protected 26-row baseline:**
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

**I. Downstream readiness COUNT(*) — now unblocked by PR #97:**
```sql
SELECT
  (SELECT COUNT(*) FROM public.session_features)                  AS session_features_count,
  (SELECT COUNT(*) FROM public.session_behavioural_features_v0_2) AS behavioural_features_count,
  (SELECT COUNT(*) FROM public.stage0_decisions)                   AS stage0_count,
  (SELECT COUNT(*) FROM public.risk_observations_v0_1)             AS risk_obs_count;
```

Zero counts are acceptable (workers not yet activated). The proof
target is whether queries succeed without `permission denied`.

**J. Collector log categorical counts (counts only; no raw lines):**
```bash
journalctl -u buyerrecon-production-collector.service \
  --since "2026-06-02 21:14:34" --until "<OBS_END>" --no-pager \
  | grep -ic 'storage_failure'        || echo "0"

journalctl -u buyerrecon-production-collector.service \
  --since "2026-06-02 21:14:34" --until "<OBS_END>" --no-pager \
  | grep -ic 'permission denied'      || echo "0"

journalctl -u buyerrecon-production-collector.service \
  --since "2026-06-02 21:14:34" --until "<OBS_END>" --no-pager \
  | grep -ic 'request_body_invalid_json' || echo "0"

journalctl -u buyerrecon-production-collector.service \
  --since "2026-06-02 21:14:34" --until "<OBS_END>" --no-pager \
  | grep -ic 'error'                  || echo "0"
```
Record the four integer counts only. Do **not** paste raw log lines.

### 4.3 Forbidden outputs

No raw payloads, `canonical_jsonb`, `request_id`, `session_id`,
`browser_id`, IP hashes, user agents, token hashes, DSNs,
Authorization values, customer-identifying data, raw log lines
containing identifiers, row-level samples, worker execution, scoring
writer, Lane writer, customer-facing reports, or AMS Trust / Pass
runtime.

---

## 5. Redaction rules

- Record integer counts and categorical `reason_code` / `rejected_stage` / `endpoint` / `http_status` values only.
- Log scans: summarize as count of matching lines, not verbatim lines.
- Any result that would expose `session_id`, `request_id`,
  `browser_id`, IP hash, user agent, or customer field — record only
  the count, not the value.
- No `canonical_jsonb`, `raw`, JSONB field content, or risk scores.

---

## 6. Observation stop-lines

Halt and mark `GATE4D_OBSERVATION_BLOCKED` if any of the following:

| Stop-line | Action |
| --- | --- |
| Role / database mismatch | Stop |
| `transaction_read_only` not `on` | Stop |
| Any query requires raw identifiers or sensitive columns | Stop |
| `new_invalid_json_since_gate4c > 0` | Stop |
| `collect_hits_since_gate4c > 0` | Stop |
| `storage_failure` or `permission denied` log count `> 0` | Stop |
| `accepted_total_in_window = 0` (window > 6h) | Stop |
| Lane A/B row count non-zero | Stop |
| Downstream `COUNT(*)` queries fail with `permission denied` | Stop — Option B grant may not be in effect |
| Customer output / scoring / AMS Trust / Pass activation | Stop |
| Any secret or raw identifier exposure risk | Stop |

---

## 7. Required post-observation evidence PR

A separate docs-only evidence PR must be created after the
observation session, recording (no secrets, no raw identifiers):

- Observation window (start / end timestamps)
- Role and database confirmed
- `accepted_total_in_window`
- `ingest_requests` categorical breakdown
- `rejected_events` categorical breakdown
- `new_invalid_json_since_gate4c`
- `protected_invalid_json_pre_20260520` (expected `26`)
- `collect_hits_since_gate4c` (expected `0`)
- Lane A/B counts (expected `0 / 0`)
- Downstream `COUNT(*)` readiness counts (from query I)
- Collector log categorical counts (four integers)
- Sensitive-column protection carried forward (no `session_id` or row-level data in evidence)
- Customer output / worker / scoring / Lane / AMS Trust / Pass — all inactive
- Final verdict: `GATE4D_OBSERVATION_PASS` or `GATE4D_OBSERVATION_BLOCKED`

---

## 8. Governance carry-forward

- PR#18ab final-scoring governance locks: **in force**.
- PR#73 hard-gate carry-forward locks: **in force**.
- Protected 26-row invalid-json baseline: **must remain intact**.
- `customer_claim_allowed = false`, `lane_output_allowed = false`,
  `customer_visibility_allowed = false`, `lane_write_allowed = false`,
  `allowed_customer_language = []` — all **in force**.
- Migration 016 grant safety: **in force** (Lane A/B counts `0/0`).
- PR#19c / PR#19d / PR#20: **inactive**.
- No scoring runtime. No AMS Trust / Pass runtime.
- Gate 4E: **closed**. Gate 4F: **not invented**.

---

## 9. Machine-readable block

```yaml
status: GATE4D_OBSERVATION_GO_RECORDED
go_attempt: second_after_option_b_grant_proof
gate4c_pass_source: PR_92_GATE4C_EXECUTION_PASS
gate4c_pass_timestamp: 2026-06-02T21:14:34Z
prior_blocked_observation: PR_95_GATE4D_OBSERVATION_BLOCKED
grant_fix_planning: PR_96_GATE4D_DOWNSTREAM_AUDIT_GRANT_PLANNING
grant_fix_proof: PR_97_GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS
pr97_merge_commit: 5b30c1f3f67db194a354339ee040f9d48ae618f8
observation_role: buyerrecon_prod_audit_readonly
observation_db: buyerrecon_production
transaction_read_only_required: true
observation_window_start: 2026-06-02T21:14:34Z
observation_window_recommendation: 24h_or_48h
gate_4d_readonly_observation_authorised_by_this_pr: true
single_observation_window_only: true
post_observation_evidence_pr_required: true
downstream_count_star_now_unblocked: true
worker_activation_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_authorised_by_this_pr: false
observation_before_this_pr_merges_authorised: false
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
next_step: operator_execute_single_readonly_observation_then_open_evidence_pr
```

---

## 10. Hard boundaries

This PR does **not**:
- execute any observation or query
- contact production
- perform any DB write
- apply any DB grant
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

It **only records Helen's explicit GO** for one later read-only
observation rerun. The observation happens in a later operator
session, strictly per §4, and must be followed by a separate
post-observation evidence PR.

`next_step: operator_execute_single_readonly_observation_then_open_evidence_pr`
