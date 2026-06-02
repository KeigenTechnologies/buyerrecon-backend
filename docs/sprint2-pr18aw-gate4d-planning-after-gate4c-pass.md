# Sprint 2 PR#18aw — Gate 4D: Post-Cutover Observation and Scoring-Readiness Planning (Docs-Only)

> **DOCS-ONLY GATE 4D PLANNING RECORD.** This PR records the Gate 4D
> planning scope following the `GATE4C_EXECUTION_PASS` evidence merged
> in PR #92. It does not execute any observation, does not contact
> production, does not deploy, does not write to DB, does not activate
> any worker, Lane writer, scoring runtime, customer output, AMS Trust
> / Pass runtime, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #92 merge commit | `bcbecd83e791eddd3956181b1c65fa53ea583d4b` |
| Production `/v1/event` | Live — `accepted_since_canary = 9`, collector logs clean |
| PR #91 GO | Consumed |
| Gate 4D | Eligible for planning; **not open for runtime execution** by this PR |
| Gate 4E | Closed |
| Gate 4F | Not invented |

Gate 4D planning eligibility is unlocked by the `GATE4C_EXECUTION_PASS`
verdict (per PR#18m §6.4). Planning eligibility does **not** mean
runtime execution is authorized. Each Gate 4D execution step requires
its own explicit GO.

---

## 2. Gate 4D objective

Gate 4D is the **post-cutover observation and scoring-readiness
planning gate** (per PR#18m §6 Gate 4D definition). Its purpose is:

1. Confirm stable production ingestion following the Gate 4C cutover:
   - `accepted_events` accumulating from live `/v1/event` traffic
   - `ingest_requests` showing expected HTTP 200 rows
   - `rejected_events` at zero or within expected categorical bounds
   - No recurrence of `request_body_invalid_json` or `storage_failure`

2. Confirm the protected 26-row invalid-json baseline remains intact.

3. Confirm `collect_hits_post_flip = 0` over the observation window.

4. Assess downstream extraction and scoring-readiness in categorical
   read-only terms — without activating any worker, Lane writer,
   scoring runtime, or customer-facing surface.

5. Decide what evidence is required before any future
   scoring / Lane / customer-facing work may be proposed.

**Gate 4D does not by itself approve:**

| Item | Status |
| --- | --- |
| Customer output | Closed — `customer_claim_allowed = false` |
| Lane writer (`scoring_output_lane_a` / `_lane_b`) | Closed — `lane_write_allowed = false`; migration 016 grant safety in force |
| Lane A/B preview activation | Closed — `lane_output_allowed = false` |
| Customer visibility | Closed — `customer_visibility_allowed = false` |
| Scoring runtime (Pass 1 / Trust / Pass 2) | Closed |
| AMS Trust / Pass runtime | Closed |
| Track A / Playwright | Closed — Gate 4E, separately gated |
| PR#19c / PR#19d / PR#20 runtime activation | Closed |

---

## 3. Planned read-only observation

The following observation is planned for a future authorized operator
session. **It is not run by this PR.**

### 3.1 Observation window

Recommended: 24–48 hours after Gate 4C PASS timestamp
(`2026-06-02T21:14:34Z`), covering a representative traffic window.
The exact window must be stated in the Gate 4D observation GO PR.

### 3.2 Observation queries (future session, read-only)

All queries must run under `buyerrecon_prod_audit_readonly` with
`transaction_read_only=on`. No writes.

**Ingestion summary by endpoint / status / reason:**
```sql
SELECT endpoint, http_status, reject_reason_code, COUNT(*) AS row_count
FROM public.ingest_requests
WHERE received_at >= '<GATE4C_PASS_TIMESTAMP>'
GROUP BY endpoint, http_status, reject_reason_code
ORDER BY row_count DESC;
```

**Accepted events total and time-bucket sample:**
```sql
SELECT
  DATE_TRUNC('hour', received_at) AS hour_bucket,
  COUNT(*) AS accepted_count
FROM public.accepted_events
WHERE received_at >= '<GATE4C_PASS_TIMESTAMP>'
GROUP BY hour_bucket
ORDER BY hour_bucket;
```

**Rejected events breakdown:**
```sql
SELECT reject_reason_code, rejected_stage, COUNT(*) AS row_count
FROM public.rejected_events
WHERE rejected_at >= '<GATE4C_PASS_TIMESTAMP>'
GROUP BY reject_reason_code, rejected_stage
ORDER BY row_count DESC;
```

**New invalid-json rows since Gate 4C PASS:**
```sql
SELECT COUNT(*) AS new_invalid_json_since_gate4c
FROM public.ingest_requests
WHERE reject_reason_code = 'request_body_invalid_json'
  AND received_at >= '<GATE4C_PASS_TIMESTAMP>';
```

**Protected 26-row baseline still intact:**
```sql
SELECT COUNT(*) AS protected_invalid_json_pre_20260520
FROM public.ingest_requests
WHERE reject_reason_code = 'request_body_invalid_json'
  AND received_at < '2026-05-20 00:00:00+00';
```
Expected: `26`.

**Lane A/B row counts (must remain zero):**
```sql
SELECT
  (SELECT COUNT(*) FROM public.scoring_output_lane_a) AS lane_a_count,
  (SELECT COUNT(*) FROM public.scoring_output_lane_b) AS lane_b_count;
```
Expected: both `0`.

**Collect-hits post-flip (must remain zero):**
```sql
SELECT COUNT(*) AS collect_hits
FROM public.ingest_requests
WHERE endpoint ILIKE '%collect%'
  AND received_at >= '<GATE4C_PASS_TIMESTAMP>';
```
Expected: `0`.

### 3.3 Collector log scan

Categorical only — no raw request IDs, no raw payloads:

```bash
journalctl -u buyerrecon-production-collector.service \
  --since "<GATE4C_PASS_TIMESTAMP>" \
  --until "<OBSERVATION_END_TIMESTAMP>" \
  | grep -i 'storage_failure\|permission denied\|error\|invalid_json' \
  | head -50
```

Expected: no `storage_failure`, no `permission denied`, no
`request_body_invalid_json` collector errors.

### 3.4 Redaction rules for observation evidence

- No raw `request_id`, `session_id`, `client_event_id`, `browser_id`
  reproduced.
- No raw IP hashes, user agents, or customer data.
- No DSNs, tokens, or Authorization values.
- Counts and categorical reason codes only.

---

## 4. Downstream readiness checklist (planning only)

The following lists downstream components whose readiness must be
assessed before any future activation is proposed. Assessment is
**read-only / categorical** in this PR; no worker is activated here.

| Component | Readiness question | Activation status |
| --- | --- | --- |
| `session_features` extractor | Does `accepted_events` have enough rows and expected schema shape for the extractor to produce `session_features` rows? | Inactive — not activated by this PR |
| Behavioural features worker | Is the source data shape (`session_features` upstream) consistent with the worker's expected input? | Inactive |
| Stage 0 worker | Are `accepted_events` present with the expected `event_origin` / `traffic_class` / `schema_key` shape? | Inactive |
| `risk_observations_v0_1` observer | Are the upstream source-health conditions (timing, POI, product-context) satisfied for risk observation generation? | Inactive |
| POI / product-context / timing observers | Do the implemented observer binaries match the production collector's output shape? | Inactive |
| Evidence snapshot observer | Is `accepted_events` accumulation sufficient for a meaningful evidence snapshot? | Inactive |
| Lane A/B preview | Are the `scoring_output_lane_a` / `scoring_output_lane_b` upstream input shapes locked and non-zero? | **Closed** — `lane_write_allowed = false`; migration 016 grant safety in force |

**No worker is activated, deployed, or scheduled by this PR.**
Activation of any worker requires its own future GO.

---

## 5. Stop-lines for Gate 4D observation (carry-forward)

Any of the following during the Gate 4D observation window must
halt further Gate 4D progress:

| Stop-line | Action |
| --- | --- |
| New `request_body_invalid_json` spike after Gate 4C PASS | Stop — investigate before proceeding |
| Any `storage_failure` or `permission denied` in collector logs | Stop — re-run grant diagnostic |
| `accepted_events` unexpectedly zero over observation window | Stop |
| `rejected_events` materially higher than expected | Stop — investigate reject reason codes |
| Lane A/B row count becomes non-zero | Stop — migration 016 grant safety breach |
| `collect_hits_post_flip > 0` | Stop |
| Protected 26-row invalid-json baseline changes | Stop |
| Downstream extractor missing required evidence columns | Stop — do not activate |
| Raw identifiers or customer data appearing in logs / reports | Stop |
| Any accidental Lane / scoring / customer-output activation | Stop |
| Track A / Playwright activity | Stop — Gate 4E is separate |

---

## 6. Required future PR sequence

| Step | Status |
| --- | --- |
| a. Gate 4D planning PR | **This PR** |
| b. Gate 4D read-only observation GO PR | Not yet done — requires Helen GO |
| c. Gate 4D observation execution / evidence PR | Not yet done — gated on (b) |
| d. Scoring-readiness or Lane-preview planning | Not yet done — separately gated after (c) PASS |

Gate 4E (Track A / Playwright) is a separate track and is not in this
sequence. Gate 4F is not invented.

No Lane writer, no customer output, no scoring runtime, and no AMS
Trust / Pass runtime are activated at any step in this sequence without
their own explicit, separately scoped GO.

---

## 7. Machine-readable block

```yaml
status: GATE4D_PLANNING_RECORDED
gate4c_pass_source: PR_92_GATE4C_EXECUTION_PASS
gate4c_pass_merge_commit: bcbecd83e791eddd3956181b1c65fa53ea583d4b
gate4d_execution_authorised_by_this_pr: false
gate4d_observation_go_pr_required: true
observation_window_recommendation: 24h_to_48h_after_gate4c_pass
lane_a_count_must_remain: 0
lane_b_count_must_remain: 0
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
worker_activated_by_this_pr: false
scoring_runtime_activated_by_this_pr: false
ams_trust_pass_activated_by_this_pr: false
track_a_playwright_in_scope: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
production_contact_by_this_pr: false
db_write_by_this_pr: false
deploy_by_this_pr: false
next_step: gate4d_observation_go_pr_then_observation_execution_evidence_pr_then_scoring_readiness_planning
```

---

## 8. Hard boundaries

This PR does **not**:
- execute any production observation or query
- contact production
- perform any DB write
- deploy or activate any worker
- deploy or edit `/var/www`
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime, or PR#19c / PR#19d / PR#20 runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records Gate 4D planning only.

`next_step: gate4d_observation_go_pr_then_observation_execution_evidence_pr_then_scoring_readiness_planning`
