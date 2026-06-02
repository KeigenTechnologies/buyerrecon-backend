# Sprint 2 PR#18av — Gate 4C Execution PASS Evidence (Docs-Only)

> **DOCS-ONLY POST-EXECUTION EVIDENCE RECORD.** This PR records the
> Gate 4C combined mode+endpoint cutover execution result under the
> PR #91 fresh execution GO. The retry succeeded. It performs **no**
> execution, **no** retry, **no** DB write, **no** production contact,
> **no** deploy, **no** `/var/www` edit, and does **not** open Gate 4D.
> No secrets, no raw payloads, no raw `request_id` / `session_id`
> — categorical / structural facts and redactions only.

---

## 1. Final verdict

**`GATE4C_EXECUTION_PASS`**

Gate 4C combined mode+endpoint cutover succeeded. Static HTTPS
proof confirmed versioned pair served at expected hashes. Server-side
DB evidence confirmed 9 `accepted_events` rows written during the
canary window. Collector logs were clean — no `storage_failure`, no
`permission denied`, no `request_body_invalid_json`. No stop-lines
were triggered. Rollback was not needed.

---

## 2. GO status

| Item | Value |
| --- | --- |
| GO source | PR #91 (`docs/sprint2-pr18au-gate4c-fresh-go-after-grant-proof.md`, merged) — `EXECUTION_GO_RECORDED` |
| PR #91 merge commit | `b7281a7935fb39b9a7792bb42bc31cf618dc13e7` |
| Single-attempt constraint | `single_attempt_only=true` — this GO authorized exactly one retry |
| GO consumed | Yes — the retry was the single authorized combined mode+endpoint attempt |
| Further retry authorized by PR #91 | No |

---

## 3. Preflight

**Preflight verdict: `GATE4C_PREFLIGHT_PASS`**

### 3.1 WEBROOT baseline (pre-apply)

| Metric | Value |
| --- | --- |
| Active HTML versioned SDK refs | 0 |
| Active HTML versioned init refs | 0 |
| Active HTML legacy SDK refs | 103 |
| Active HTML legacy init refs | 103 |
| `thin-sdk.iife.js` sha256 | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |
| `br-thinlayer-init.js` sha256 | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |

### 3.2 Rollback readiness

| Item | Status |
| --- | --- |
| Rollback bundle | Present at `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/` |
| `ROLLBACK-PROCEDURE.md` | Present at `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` |

### 3.3 Service and route

| Item | Status |
| --- | --- |
| `buyerrecon-production-collector.service` | Active on port `3073` |
| Nginx `location = /v1/event` route | Present — proxying to `http://127.0.0.1:3073/v1/event` |

### 3.4 Production collector role and DB

| Item | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |

### 3.5 DB grant state (pre-apply)

| Privilege | Value |
| --- | --- |
| `accepted_events.event_id` SELECT | true |
| `accepted_events.workspace_id` SELECT | true |
| `accepted_events.site_id` SELECT | true |
| `accepted_events.client_event_id` SELECT | true |
| `accepted_events.session_id` SELECT | false |
| `accepted_events` table-level SELECT | false |
| `accepted_events` INSERT | true |
| RLS on `accepted_events` / `ingest_requests` / `rejected_events` | false |
| Policy count | 0 |
| Trigger count | 0 |
| `accepted_events_dedup` index | Valid |

### 3.6 DB audit baseline (pre-apply)

| Metric | Value |
| --- | --- |
| `accepted_total` | 0 |
| `ingest_total` | 29 |
| `rejected_total` | 0 |
| Ingest breakdown | `/v1/event \| 400 \| request_body_invalid_json \| 29` |
| Protected invalid-json baseline (pre-2026-05-20) | 26 |

---

## 4. Apply evidence

Versioned pair applied to `$WEBROOT`.

Local post-apply filesystem verification:

| Item | Value |
| --- | --- |
| Versioned SDK sha256 on disk | `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` ✓ |
| Versioned init sha256 on disk | `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` ✓ |
| Legacy rollback SDK sha256 | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` — remained present ✓ |
| Legacy rollback init sha256 | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` — remained present ✓ |
| Active HTML versioned SDK refs | 103 ✓ |
| Active HTML versioned init refs | 103 ✓ |
| Active HTML legacy SDK refs | 0 ✓ |
| Active HTML legacy init refs | 0 ✓ |
| SDK-before-init order (sample: `trust.html`) | SDK at line 799, init at line 801 ✓ |

Note: repeated `find: grep terminated by signal 13` messages appeared
during the sample order check due to `head` / pipe closing early. This
is a normal shell pipe behaviour; it did not affect the result.

---

## 5. Static HTTPS verification

| Item | Value |
| --- | --- |
| Timestamp | `2026-06-02T21:13:07Z` |
| Served versioned SDK sha256 | `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` ✓ |
| Served versioned init sha256 | `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` ✓ |
| Served init `endpointUrl` | `https://buyerrecon.com/v1/event` ✓ |
| Served init `mode` | `sprint2_v1_event` ✓ |
| Served init `/collect` present | No ✓ |
| Served init `onrender` present | No ✓ |
| Served `index.html` | Versioned SDK + versioned init ✓ |
| Unversioned refs on served page | None ✓ |
| SDK-before-init order | Confirmed ✓ |

Static HTTPS verification: **PASS**

---

## 6. Canary / browser observation

| Item | Value |
| --- | --- |
| Canary start | `2026-06-02T21:14:34Z` |
| Canary end | `2026-06-02T21:25:23Z` |
| Browser target | `POST https://buyerrecon.com/v1/event` |

Browser/DevTools network panel had filter visibility issues during
the canary window; the `/v1/event` row was not reliably visible in
DevTools due to filtering/timing. Server-side DB evidence confirms
successful `/v1/event` ingestion. No raw browser payload, no headers,
no request IDs, no session IDs, no tokens, and no customer data are
reproduced in this record.

---

## 7. DB post-canary observation

| Item | Value |
| --- | --- |
| Canary start | `2026-06-02T21:14:34Z` |
| Canary end | `2026-06-02T21:25:23Z` |
| Rows since canary (endpoint / status / reason) | `/v1/event \| 200 \| <null> \| 9` |
| `accepted_since_canary` | **9** |
| `new_invalid_json_post_flip` | 0 |
| `collect_hits_post_flip` | 0 |
| `accepted_events_total` after canary | **9** |
| `rejected_events_total` after canary | 0 |
| Protected invalid-json baseline (pre-2026-05-20) | 26 — **intact** |

---

## 8. Collector log evidence

Collector service logs checked for the full canary window
(`2026-06-02T21:14:34Z` to `2026-06-02T21:25:23Z`).

**Result: `-- No entries --`**

| Log check | Observed |
| --- | --- |
| `storage_failure` | None |
| `permission denied for table accepted_events` | None |
| `request_body_invalid_json` collector error | None |
| Any collector error | None |

The `permission denied` blocker from PR #84 was **not reproduced**.
The accepted_events column-level SELECT grant (PR #87) resolved the
storage path.

---

## 9. Stop-line status

| Stop-line | Status |
| --- | --- |
| `400 request_body_invalid_json` | Not triggered |
| `500` / `storage_failure` / `permission denied` | Not triggered |
| New `request_body_invalid_json` row post-flip | Not triggered — `new_invalid_json_post_flip = 0` |
| `accepted_since_canary = 0` | Not triggered — `accepted_since_canary = 9` |
| `collect_hits_post_flip > 0` | Not triggered — `collect_hits_post_flip = 0` |
| Static HTTPS hash mismatch | Not triggered |
| Wrong endpoint / mode | Not triggered |
| Unversioned or mixed pair served | Not triggered |
| Unexpected backend / DB / AMS / customer-output / scoring / Lane behavior | Not observed |
| Rollback verification failure | Not applicable — rollback not triggered |

All stop-lines: **clear**.

---

## 10. Rollback

Rollback was **not triggered**. All PASS criteria were met:
HTTP 2xx rows confirmed in DB (`accepted_since_canary = 9`),
no stop-lines triggered, collector logs clean.

The rollback bundle and `ROLLBACK-PROCEDURE.md` remained available
throughout the session and were not used.

---

## 11. Governance carry-forward

- PR#18ab final-scoring governance locks: **in force**.
- PR#73 hard-gate carry-forward locks: **in force**.
- PR#17s / PR#18w 26-row invalid-json baseline: **preserved** — `new_invalid_json_post_flip = 0`; `protected_invalid_json_pre_20260520 = 26` unchanged.
- PR#19c / PR#19d / PR#20: **inactive**.
- PR#76 ProductContextProfile v0.1: upstream contract, **not activated**.
- No customer output. No Lane writers. No runtime scoring. No AMS Trust / Pass runtime.
- **Gate 4D** remains closed until this PASS evidence PR is reviewed and merged. After merge, Gate 4D planning may begin under a separate PR / GO.
- Gate 4E: **out of scope**. Gate 4F: **not invented**.

---

## 12. Machine-readable block

```yaml
status: GATE4C_EXECUTION_PASS
execution_go_source: PR_91
pr91_merge_commit: b7281a7935fb39b9a7792bb42bc31cf618dc13e7
runbook_source: PR_80
path_alpha_acceptance_source: PR_77
grant_fix_source: PR_87
explain_precheck_source: PR_89_EXPLAIN_PRECHECK_PASS
staging_proof_source: PR_90_COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING
preflight_verdict: GATE4C_PREFLIGHT_PASS
cache_safe_asset_source: WEBSITE_PR_7_MERGE_8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d
versioned_pair_wiring_source: WEBSITE_PR_8_MERGE_e7918f6c78f1cb67b9807b21519db220a8cffa19
versioned_sdk_path: /thinlayer/thin-sdk.048d1d23.iife.js
versioned_sdk_sha256: 048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7
versioned_init_path: /thinlayer/br-thinlayer-init.69f898f8.js
versioned_init_sha256: 69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770
static_https_verify_result: PASS
static_https_verify_timestamp: 2026-06-02T21:13:07Z
canary_start: 2026-06-02T21:14:34Z
canary_end: 2026-06-02T21:25:23Z
accepted_since_canary: 9
new_invalid_json_post_flip: 0
collect_hits_post_flip: 0
accepted_events_total_after: 9
rejected_events_total_after: 0
protected_invalid_json_baseline_preserved: true
protected_invalid_json_baseline_count: 26
collector_log_storage_failure: false
collector_log_permission_denied: false
all_stop_lines_clear: true
rollback_triggered: false
pr91_go_consumed: true
gate_4d_open: false
gate_4d_may_begin_after_this_pr_merges: true
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
runtime_scoring_activated: false
ams_trust_pass_activated: false
```

---

## 13. Hard boundaries

This PR does **not**:
- execute or retry the cutover
- contact production or perform any DB write
- deploy or edit `/var/www`
- run a canary
- open Gate 4D / Gate 4E (Gate 4D may begin planning after this PR merges)
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the Gate 4C execution PASS only.

`next_step: merge_this_evidence_pr_then_gate_4d_planning_may_begin_under_separate_pr_go`
