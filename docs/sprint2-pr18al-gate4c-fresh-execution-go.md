# Sprint 2 PR#18al — Gate 4C Fresh Execution GO (after cache-safe website wiring)

> **DOCS-ONLY EXECUTION-AUTHORIZATION RECORD. THIS PR DOES NOT
> EXECUTE.** It records a fresh Helen execution GO for **one**
> Gate 4C combined mode+endpoint retry, following the rolled-back
> attempt in PR #82 and the cache-safe asset + 103-page wiring landed
> in website PR #7 and PR #8. The retry itself happens **only** in a
> later, separate operator session strictly per the merged PR #80
> runbook. This PR runs no commands, deploys nothing, does not edit
> `/var/www`, does not contact production, does not generate traffic,
> does not run a canary, does not flip the live endpoint, and does
> not open Gate 4D. No secrets, no raw payloads, no raw
> `request_id` / `session_id` — placeholders / redactions only.

---

## 1. Status / verdict

- **Status:** `EXECUTION_GO_RECORDED` (fresh; supersedes the
  consumed PR #81 GO).
- **Readiness source:** `GATE4C_READY_FOR_HELEN_CUTOVER_GO_RECORDED_BY_PR79`
  (carry-forward).
- **Runbook source:** `PR80_GATE4C_CUTOVER_GO_RUNBOOK`
  (`docs/sprint2-pr18ak-gate4c-cutover-go-planning-runbook.md`, merged).
- **Cache-safe asset source:** website PR #7, merge commit
  `8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d`.
- **Versioned-pair wiring source:** website PR #8, merge commit
  `e7918f6c78f1cb67b9807b21519db220a8cffa19` (103 production HTML
  pages wired to the versioned pair; legacy unversioned files
  unchanged).
- **Prior rolled-back attempt:** PR #82 (`GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`,
  likely cache-mix root cause; exact production browser cache state
  was not directly captured).

**Authorization granted by this PR:**

- `gate_4c_execution_authorised_by_this_pr=true`
- `combined_mode_endpoint_flip_authorised_by_this_pr=true`
- `production_versioned_pair_serve_authorised_by_this_pr=true`
- `controlled_canary_authorised_by_this_pr=true`
- `rollback_execution_authorised_if_stopline_hit=true`
- `post_execution_evidence_pr_required=true`
- `single_attempt_only=true` (this GO authorizes exactly **one**
  combined mode+endpoint retry attempt; consumed on first use)

**Still false (NOT authorized by this PR):**

- `pr81_re_use_authorised_by_this_pr=false` (PR #81 GO is consumed by
  the PR #82 attempt; this is a *new* GO, not a reactivation)
- `mode_first_production_state_authorised_by_this_pr=false`
- `production_collect_tolerance_test_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `runtime_scoring_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `gate_4d_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `pr19c_runtime_authorised_by_this_pr=false`
- `pr19d_runtime_authorised_by_this_pr=false`
- `pr20_runtime_authorised_by_this_pr=false`

The authorization above takes effect in a **later operator session**;
this PR causes no action at merge time.

---

## 2. Why a fresh GO

The PR #81 execution GO was consumed by the PR #82 attempt, which
hit the `request_body_invalid_json_observed_post_flip > 0` stop-line
and was cleanly rolled back. The PR #82 root-cause evidence
**strongly supports** a cache-mix (old SDK + new init), without
directly capturing the historical browser cache state. Two website
PRs (#7 + #8) have since landed to remove the failure mode:

- **PR #7** added the cache-safe versioned assets to the repo
  (byte-identical SDK, operator-pasted exact init).
- **PR #8** wired all 103 production HTML pages to the versioned
  pair (SDK-before-init order preserved; zero unversioned survivors;
  zero mixed-pair pages; both proofs PASS on the synced base).

The cache-mix failure mode is therefore closed at the repo layer.
A fresh, narrowly-scoped GO for **one** retry attempt is appropriate.

---

## 3. Inputs / source-of-truth references

| Item | Reference |
| --- | --- |
| Path α residual-risk acceptance | PR #77 (merged) |
| Gate 4C aggregation readiness | PR #79 (merged) |
| Cutover runbook | PR #80 (merged) |
| Consumed prior GO | PR #81 (merged; **consumed by PR #82**) |
| Rolled-back execution evidence | PR #82 (merged; `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`) |
| Option-key proof | PR #71 — `transportOptions.mode = 'sprint2_v1_event'` at AMS pin `13d4900` |
| Website cache-safe assets | Website PR #7, merge `8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d` |
| Website versioned-pair wiring (103 pages) | Website PR #8, merge `e7918f6c78f1cb67b9807b21519db220a8cffa19` |
| Versioned SDK | `thinlayer/thin-sdk.048d1d23.iife.js` sha256 `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` |
| Versioned init | `thinlayer/br-thinlayer-init.69f898f8.js` sha256 `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` |
| Legacy unversioned SDK (preserved for rollback) | `thinlayer/thin-sdk.iife.js` sha256 `048d1d23…` |
| Legacy unversioned init (preserved for rollback) | `thinlayer/br-thinlayer-init.js` sha256 `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |
| Rollback bundle | PR #18z on-host: `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/` + `ROLLBACK-PROCEDURE.md` |
| Invalid-JSON baseline | PR#17s / PR#18w 26-row baseline (must remain untouched) |
| Governance locks | PR#18ab final-scoring + PR#73 hard-gate carry-forward (all in force) |
| Deferred runtime | PR#19c / PR#19d / PR#20 inactive; PR#76 ProductContextProfile upstream-only |

---

## 4. Helen execution GO statement

> **Helen authorizes the operator to execute one Gate 4C combined
> mode+endpoint cutover retry, using the website repo state at or
> after merge commit `e7918f6c78f1cb67b9807b21519db220a8cffa19`,
> strictly per the merged PR #80 runbook, subject to all preflight
> checks, stop-lines, rollback conditions, redaction rules, and
> post-execution evidence requirements below.**

Clarifications:
- **Single attempt only.** This GO authorizes exactly one combined
  mode+endpoint retry; it is consumed on first use. A subsequent
  retry (if needed) requires a new GO record.
- This GO is for **Gate 4C only**.
- **Not** a general production-deploy permission.
- **Not** Gate 4D / 4E / 4F.
- **Not** customer-output, Lane writer, runtime scoring, or AMS
  Trust / Pass activation.

---

## 5. Authorized execution scope (later operator session, per PR #80)

In the later operator session, the operator is authorized to do
**only** the following:

### A. Pre-retry repo + asset verification
- Confirm website repo state is **at or after merge commit
  `e7918f6c78f1cb67b9807b21519db220a8cffa19`** on
  `production-live-20260508`.
- Confirm versioned pair present with expected hashes:
  - `thinlayer/thin-sdk.048d1d23.iife.js` sha256 `048d1d23…`
  - `thinlayer/br-thinlayer-init.69f898f8.js` sha256 `69f898f8…`
- Confirm candidate init contains:
  - `endpointUrl: 'https://buyerrecon.com/v1/event'`
  - `transportOptions: { mode: 'sprint2_v1_event' }`
- Confirm candidate init does **not** contain `/collect` or
  `buyerrecon-backend.onrender.com`.
- Re-run `tools/gate4c-cache-safe-asset-proof.mjs` (expect 10/10).
- Re-run `tools/gate4c-versioned-pair-wiring-proof.mjs` (expect 15/15).
- Confirm PR #18z rollback bundle path exists:
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`
  + `ROLLBACK-PROCEDURE.md`.
- Confirm PR#17s / PR#18w 26-row baseline untouched.
- Confirm PR#18ab locks and PR#73 hard-gates in force.

### B. Pre-canary static HTTPS verification (production)
- Verify both versioned assets are served at expected hashes from
  the production host **before** any browser/canary traffic:
  - `https://buyerrecon.com/thinlayer/thin-sdk.048d1d23.iife.js`
    → sha256 `048d1d23…`
  - `https://buyerrecon.com/thinlayer/br-thinlayer-init.69f898f8.js`
    → sha256 `69f898f8…`
- Verify on a sample of production HTML pages that the served HTML
  references the **versioned pair** in SDK-before-init order **and
  contains zero references** to `/thinlayer/thin-sdk.iife.js` or
  `/thinlayer/br-thinlayer-init.js`.

### C. DB preflight baseline
- Capture read-only baseline of `ingest_total`, `accepted_total`,
  `rejected_total`, `request_body_invalid_json_total` (so any
  post-canary delta is calculable). No writes.

### D. Production host apply
- Apply the candidate website state to the production host per
  PR #80 (i.e. serve the versioned pair; legacy unversioned files
  remain available for rollback).
- Edit only the intended website artifact / page files.
- No backend deploy. No AMS deploy. No DB migration. No customer
  output system touched.

### E. Controlled canary (single attempt, bounded window)
- Run only the minimum approved canary needed to verify ingestion.
- Bounded canary window per PR #80.
- **Mode-first production state is forbidden.**
- **Production `/collect` tolerance test is forbidden.**
- The only intended production collector target after the flip is
  the Hetzner Sprint 2 `/v1/event` endpoint.

### F. Read-only observation
- Run **SELECT-only** observation queries.
- Record accepted / rejected / `request_body_invalid_json` deltas
  since canary start.
- No raw payload. No token. No `Authorization` header value. No DSN.
  No raw `request_id` / `session_id`.

### G. Decision (PASS / rollback / continue)
- Apply §6 canary checks + §6 stop-line; decide PASS, rollback (§7),
  or continue observation within the bounded window.

### H. Evidence PR
- Create a **separate** post-execution evidence PR per §8 — required
  whether the verdict is PASS or rolled-back.

---

## 6. Stop-lines

Execution must **stop and roll back** if any of the following occurs:

- Any POST to `https://buyerrecon.com/v1/event` returns **400
  `request_body_invalid_json`**.
- Any new `request_body_invalid_json` row appears in
  `ingest_requests_ledger` after canary start
  (`request_body_invalid_json_observed_post_flip > 0`).
- Static HTTPS verification does not show **both** versioned files
  with expected hashes (`048d1d23…` / `69f898f8…`).
- Candidate init does not show
  `endpointUrl: 'https://buyerrecon.com/v1/event'`.
- Candidate init does not show
  `transportOptions.mode: 'sprint2_v1_event'`.
- Candidate page or HTML references **any** unversioned Gate 4C
  ThinSDK path (`/thinlayer/thin-sdk.iife.js` or
  `/thinlayer/br-thinlayer-init.js`) on a page meant for retry.
- SDK-before-init order is not confirmed on the served pages.
- Production host serves a **mixed versioned / unversioned pair**.
- `rejected_events` burst above the expected canary threshold.
- Accepted-event delta from the 26-row baseline is absent when the
  canary should have generated one.
- Unexpected `/collect` traffic after the flip.
- `endpointUrl` resolves to the wrong host.
- ThinSDK artifact hash mismatch (anything other than `048d1d23…`).
- Init diff contains anything beyond the approved cache-safe pair.
- Raw payload printed. Token / `Authorization` / DSN exposed. Raw
  `request_id` / `session_id` printed. Customer data printed.
- Production DB write required.
- Customer output becomes visible. Lane writer / scoring / AMS
  Trust / Pass activates.
- Any PR#18ab lock would need relaxation.
- Rollback bundle missing or invalid.
- Operator cannot produce redacted evidence.
- Rollback verification cannot be completed.
- Any unexpected backend / DB / AMS / customer-output / scoring /
  Lane behavior appears.

---

## 7. Rollback (authorized if any stop-line hit)

This PR authorizes rollback **if any stop-line is hit**.

**Rollback path:**
- **Primary:** PR #18z on-host rollback bundle using
  `ROLLBACK-PROCEDURE.md` in
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`.
- **Secondary:** restore production page references to the **legacy
  unversioned pair** (`/thinlayer/thin-sdk.iife.js` +
  `/thinlayer/br-thinlayer-init.js`); the legacy `br-thinlayer-init.js`
  hash `9b0e4530…` carries the legacy `/collect` endpoint.
- **Emergency kill:** `window.__BR_THIN_DISABLED = true` if
  applicable, to halt the layer.

**Rollback verification (required):**
- The served init has **no** `sprint2_v1_event`.
- `endpointUrl` is restored to the legacy `/collect`.
- No new `request_body_invalid_json` rows since the rollback
  verification timestamp.
- Production host is stable.

**Rollback constraints:**
- Rollback proof must be recorded in the evidence PR (§8).
- Rollback must **not** delete / mutate / annotate / normalise the
  PR#17s / PR#18w 26-row baseline rows.
- Exact rollback file names / asset references must be documented
  **without exposing secrets**.
- `rollback_execution_authorised_if_stopline_hit=true`.

---

## 8. Post-execution evidence PR (required whether PASS or rollback)

A separate post-execution evidence PR must record:

- Website repo commit deployed / referenced (expect
  `e7918f6c78f1cb67b9807b21519db220a8cffa19` or later on
  `production-live-20260508`).
- Static HTTPS verification result (per §5.B).
- Versioned asset hashes **served** by the production host.
- Candidate init endpoint / mode verification.
- Browser / network observation summary (no raw payloads).
- DB baseline **before** canary.
- DB result **after** canary.
- Any rejected-event rows and reason codes (categorical; no raw
  payloads).
- Stop-line status.
- Rollback status if triggered (including rollback verification per
  §7).
- **Final verdict** — one of:
  - `GATE4C_EXECUTION_PASS`
  - `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`
- No raw payload. No token. No `Authorization` value. No DSN. No raw
  `request_id` / `session_id`. No customer data.

**Gate 4D remains closed** unless and until a `GATE4C_EXECUTION_PASS`
evidence PR is merged. A `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`
verdict does not open Gate 4D and consumes this GO; another retry
requires a new GO record.

---

## 9. Governance carry-forward

- PR#18ab final-scoring governance locks: **in force** (all eleven
  `false` / `[]`).
- PR#73 hard-gate carry-forward locks: **in force**.
- PR#17s / PR#18w 26-row baseline: **untouched**.
- PR#19c / PR#19d / PR#20: **inactive**.
- PR#76 ProductContextProfile v0.1: upstream contract, **not
  activated** by this cutover.
- PR#78 downstream alignment: docs-only, **not activating** PR#20 / 21 / 22.
- No report / customer output. No Lane writers. No runtime scoring.
  No AMS Trust / Pass runtime.
- Gate 4D / Gate 4E: **out of scope**. Gate 4F: **not invented**.

---

## 10. Machine-readable block

```yaml
status: EXECUTION_GO_RECORDED
go_freshness: fresh_after_pr82_rollback
gate_4c_readiness_source: PR_79_READY_FOR_HELEN_CUTOVER_GO_UNDER_PATH_ALPHA
runbook_source: PR_80_GATE4C_CUTOVER_GO_RUNBOOK
path_alpha_acceptance_source: PR_77
prior_consumed_go: PR_81
prior_rolled_back_attempt: PR_82
cache_safe_asset_source: WEBSITE_PR_7_MERGE_8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d
versioned_pair_wiring_source: WEBSITE_PR_8_MERGE_e7918f6c78f1cb67b9807b21519db220a8cffa19
versioned_sdk_path: /thinlayer/thin-sdk.048d1d23.iife.js
versioned_sdk_sha256: 048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7
versioned_init_path: /thinlayer/br-thinlayer-init.69f898f8.js
versioned_init_sha256: 69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770
forbidden_retry_paths:
  - /thinlayer/thin-sdk.iife.js
  - /thinlayer/br-thinlayer-init.js
required_load_order: sdk_then_init
required_endpoint: https://buyerrecon.com/v1/event
required_mode: sprint2_v1_event
gate_4c_execution_authorised_by_this_pr: true
combined_mode_endpoint_flip_authorised_by_this_pr: true
production_versioned_pair_serve_authorised_by_this_pr: true
controlled_canary_authorised_by_this_pr: true
rollback_execution_authorised_if_stopline_hit: true
post_execution_evidence_pr_required: true
single_attempt_only: true
pr81_re_use_authorised_by_this_pr: false
mode_first_production_state_authorised_by_this_pr: false
production_collect_tolerance_test_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
pr19c_runtime_authorised_by_this_pr: false
pr19d_runtime_authorised_by_this_pr: false
pr20_runtime_authorised_by_this_pr: false
next_step: operator_execute_single_gate4c_retry_per_pr80_using_pr7_pr8_assets_then_open_evidence_pr
```

---

## 11. Hard boundaries

This PR does **not** itself:

- execute commands
- deploy
- edit `/var/www`
- contact staging or production
- generate traffic / run a canary
- flip any endpoint on the live host
- merge or modify any website PR
- change backend code / package / migration / schema / DB scripts
- change AMS source or repo
- mutate secrets / tokens / roles
- create customer output
- activate Lane writers / runtime scoring / AMS Trust / Pass
- open Gate 4D / Gate 4E
- invent Gate 4F

It **only records Helen's explicit fresh execution GO** for one
later operator retry. The cutover itself happens in that later
session, strictly per PR #80, and must be followed by a separate
post-execution evidence PR.

`next_step: operator_execute_single_gate4c_retry_per_pr80_using_pr7_pr8_assets_then_open_evidence_pr`
