# Sprint 2 PR#18am — Gate 4C Rolled-Back Execution Evidence (Docs-Only)

> **DOCS-ONLY POST-EXECUTION EVIDENCE RECORD.** This PR records what
> happened during the Gate 4C combined mode+endpoint cutover attempt
> (authorized by PR #81, executed per PR #80), the stop-line hit, the
> rollback, and the root-cause evidence. It performs **no** execution,
> **no** retry, **no** production contact, **no** deploy, **no**
> `/var/www` edit, **no** DB write. No secrets, no raw payloads, no
> raw `request_id` / `session_id` — categorical/structural facts and
> redactions only.

---

## 1. Status / verdict

**Verdict: `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`.**

The Gate 4C combined mode+endpoint cutover was executed in an operator
session under the PR #81 execution GO and the PR #80 runbook. The
canary tripped the `request_body_invalid_json_observed_post_flip > 0`
stop-line. The operator rolled back per PR #80 §8. Production is back
on the pre-cutover legacy posture. Root-cause evidence strongly
supports a **cache-mix** (old SDK served alongside the new init). No
retry is authorized by this PR.

---

## 2. Authorization + source of truth

| Item | Reference |
| --- | --- |
| Execution GO | PR #81 (`docs/sprint2-pr18al-gate4c-helen-execution-go.md`, merged) — `EXECUTION_GO_RECORDED` |
| Runbook | PR #80 (`docs/sprint2-pr18ak-gate4c-cutover-go-planning-runbook.md`, merged) — preflight §5, sequence §6, stop-line §7, rollback §8 |
| Path α acceptance | PR #77 (merged) |
| Aggregation readiness | PR #79 (merged) |
| Option key | PR #71 — `transportOptions.mode = 'sprint2_v1_event'` at AMS pin `13d4900` |

---

## 3. Execution timeline

| Phase | Detail |
| --- | --- |
| Bundle applied | Two-file live bundle to the website production host |
| `thin-sdk.iife.js` | `7098d648…` → `048d1d23…` (Sprint2-capable SDK) |
| `br-thinlayer-init.js` | `9b0e4530…` → `69f898f8…` (combined mode + endpoint) |
| Static HTTPS verification | **PASS** — served SDK hash `048d1d23…`; served init hash `69f898f8…`; init `endpointUrl = https://buyerrecon.com/v1/event`; init `transportOptions.mode = sprint2_v1_event` |
| Canary start | `2026-05-26T19:42:40Z` |
| Browser observation | `POST https://buyerrecon.com/v1/event → 400 Bad Request` |

The flip was combined mode+endpoint (not mode-first); the post-flip
target was the Hetzner Sprint 2 `/v1/event` endpoint. No production
`/collect` tolerance test was performed.

---

## 4. Canary observation (production DB, read-only)

| Metric | Pre-canary | Post-canary |
| --- | --- | --- |
| `ingest_total` | 26 | 28 |
| `accepted_total` | 0 | 0 |
| `rejected_total` | 0 | 0 |
| `request_body_invalid_json_total` | 0 | (see below) |

- Endpoint/status/class/count row: `/v1/event | 400 | request_body_invalid_json | 2`.
- `request_body_invalid_json_since_canary_start = 2`.

The canary generated 2 ingest rows, both HTTP `400`
`request_body_invalid_json`, accepted_count `0`.

---

## 5. Stop-line trigger

Per PR #80 §7 and PR #81 §5:

- **`request_body_invalid_json_observed_post_flip > 0`** — observed
  value `2`. **Stop-line triggered.**

Execution halted; rollback initiated immediately. No further canary
traffic was generated.

---

## 6. Rollback (executed per PR #80 §8)

| Restored | Value |
| --- | --- |
| `thin-sdk.iife.js` | restored to `7098d648…` |
| `br-thinlayer-init.js` | restored to `9b0e4530…` |
| `endpointUrl` | restored to `https://buyerrecon-backend.onrender.com/collect` |
| `transportOptions.mode` | `sprint2_v1_event` **removed** (legacy-array posture restored) |

- **HTTPS post-rollback verification: PASS.**
- Post-rollback DB (read-only): `ingest_total = 28`, `accepted_total = 0`,
  `rejected_total = 0`, `request_body_invalid_json_since_rollback_verify = 0`.

Production is back on the pre-cutover legacy `/collect` posture. No new
invalid-json rows since rollback verification.

---

## 7. Evidence directories (operator-host artifacts; referenced, not inlined)

- `/root/buyerrecon-gate4c-precutover-20260526T193653Z`
- `/root/buyerrecon-gate4c-candidate-20260526T192816Z`
- `/root/buyerrecon-gate4c-static-verify-20260526T193947Z`
- `/root/buyerrecon-gate4c-canary-20260526T194240Z`
- `/root/buyerrecon-gate4c-rollback-verify-20260526T194937Z`
- `/root/buyerrecon-gate4c-evidence-20260526T195037Z`
- `/tmp/buyerrecon-website-prod-live-capture/.gate4c-rootcause-capture-20260526T202816Z`
- `/tmp/buyerrecon-website-prod-live-capture/.gate4c-cachemix-proof-20260526T203032Z`

These directories hold the operator's redacted capture artifacts. They
are referenced here for audit; no raw payloads, tokens, or session
identifiers are reproduced in this doc.

---

## 8. Root-cause evidence

### 8.1 Candidate SDK + candidate init (clean local capture)

A local capture of the **candidate** SDK (`048d1d23…`) + **candidate**
init (`69f898f8…`) together:

- `request_count = 2`
- both POST bodies were **top-level JSON objects**
- both bodies had the required **8 fields**
- the `session_start` and `page_view` bodies were valid Sprint2-shaped
  single objects

→ When the new SDK and new init are paired, emission is contract-valid.
The candidate pairing itself is **not** the fault.

### 8.2 Cache-mix proof (old SDK + new init)

A capture pairing the **old** SDK (`7098d648…`) with the **new** init
(`69f898f8…`):

- emitted a **top-level JSON array** (not a single object)
- `body_length = 839`
- first array item: legacy `event_type = session_start`
- first item keys included **old-SDK** field names (e.g.
  `event_schema_version`, `event_type`, `client_timestamp_ms`,
  `anon_session_id`, …) — field *names* only; no values reproduced
- `has_required_8 = false`

→ This is exactly the shape the Sprint 2 `/v1/event` validator rejects
as `request_body_invalid_json` (top-level array; legacy fields; missing
the required 8).

### 8.3 Likely root cause

**Root-cause evidence strongly supports a cache-mix: the browser /
static cache served the OLD SDK (`7098d648…`) alongside the NEW init
(`69f898f8…`).** The new init set `transportOptions.mode =
'sprint2_v1_event'` and pointed at `/v1/event`, but the stale old SDK
ignored the body-mode option and emitted its legacy top-level array,
which `/v1/event` rejected — producing the 2 `request_body_invalid_json`
rows.

This is stated as the **likely** root cause. The exact production
browser cache state at canary time was **not** directly captured, so
this doc does not overclaim a proven production cache state; it records
that the local cache-mix reproduction matches the observed production
failure shape precisely.

---

## 9. Governance carry-forward

- PR#18ab final-scoring governance locks: **unchanged / in force**.
- PR#73 hard-gate carry-forward locks: **unchanged / in force**.
- PR#17s / PR#18w 26-row baseline: **preserved** — the rollback and
  this record did **not** delete / mutate / annotate / normalise any
  of the 26 baseline rows. (Pre-canary `ingest_total = 26` confirms the
  baseline; the 2 canary rows are additive and retained as evidence,
  not removed.)
- PR#19c / PR#19d / PR#20: **remain inactive**.
- PR#76 ProductContextProfile v0.1 contract: upstream, **not
  activated** by this attempt.
- No report / customer output. No Lane writers. No runtime scoring. No
  AMS Trust / Pass runtime.
- Gate 4D / Gate 4E: **out of scope**. Gate 4F: **not invented**.

---

## 10. Machine-readable block

```yaml
status: GATE4C_EXECUTION_BLOCKED_ROLLED_BACK
execution_go_source: PR_81
runbook_source: PR_80
path_alpha_acceptance_source: PR_77
aggregation_readiness_source: PR_79
canary_start: 2026-05-26T19:42:40Z
flip_model: combined_mode_endpoint
served_sdk_hash_post_apply: 048d1d23
served_init_hash_post_apply: 69f898f8
served_endpoint_post_apply: https_buyerrecon_com_v1_event
ingest_total_pre_canary: 26
ingest_total_post_canary: 28
accepted_total_post_canary: 0
rejected_total_post_canary: 0
request_body_invalid_json_since_canary_start: 2
stop_line_triggered: request_body_invalid_json_observed_post_flip_gt_0
rollback_executed: true
sdk_hash_post_rollback: 7098d648
init_hash_post_rollback: 9b0e4530
endpoint_post_rollback: render_legacy_collect
request_body_invalid_json_since_rollback_verify: 0
likely_root_cause: cache_mix_old_sdk_new_init
production_cache_state_directly_captured: false
twentysix_row_baseline_preserved: true
retry_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
next_step: cache_safe_website_artifact_config_fix_pr_then_new_execution_go
```

---

## 11. Required next step

A retry is **not** authorized by this PR. Before any Gate 4C retry:

1. **Cache-safe website artifact/config fix PR** — address the SDK/init
   cache-mix root cause so the browser cannot serve an old SDK with a
   new init. Likely approaches:
   - versioned SDK/init URLs (e.g. query-string or path version), or
   - versioned filenames (content-hashed asset names),
   so the init and the SDK it depends on are cache-coherent.
2. **Review** of that fix PR (Codex + Helen).
3. **A new execution GO** (a fresh PR#18al-style record) — the PR #81
   GO is considered consumed by this attempt and does **not** authorize
   a second cutover.

**No live retry until the cache-safe fix PR has review and a new
execution GO is recorded.**

---

## 12. Hard boundaries

This PR does **not**:
- execute or retry the cutover
- contact staging or production
- deploy or edit `/var/www`
- write to any DB
- merge any website PR (#3 / #4 / #6 remain HOLD)
- change secrets / tokens / roles
- reproduce raw payloads, raw `request_id`, or raw `session_id`
- activate customer output / Lane writers / runtime scoring / AMS Trust
  / Pass runtime
- open Gate 4D / Gate 4E
- invent Gate 4F

It records the rolled-back Gate 4C execution attempt and its
root-cause evidence only.

`next_step: cache_safe_website_artifact_config_fix_pr_then_new_execution_go`
