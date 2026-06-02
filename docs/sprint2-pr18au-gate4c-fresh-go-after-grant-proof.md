# Sprint 2 PR#18au — Gate 4C Fresh Execution GO (after collector grant and write-path proof)

> **DOCS-ONLY EXECUTION-AUTHORIZATION RECORD. THIS PR DOES NOT
> EXECUTE.** It records a fresh Helen execution GO for **one**
> Gate 4C combined mode+endpoint retry, following the rolled-back
> attempt in PR #84, the production DB grant applied and recorded in
> PR #87, and the write-path proof chain in PR #89–#90. The retry
> itself happens **only** in a later, separate operator session
> strictly per the merged PR #80 runbook. This PR runs no commands,
> deploys nothing, does not edit `/var/www`, does not contact
> production, does not generate traffic, does not run a canary, does
> not flip the live endpoint, and does not open Gate 4D. No secrets,
> no raw payloads, no raw `request_id` / `session_id` —
> placeholders / redactions only.

---

## 1. Status / verdict

- **Status:** `EXECUTION_GO_RECORDED` (fresh; supersedes the
  consumed PR #83 GO).
- **Readiness source:** `GATE4C_READY_FOR_HELEN_CUTOVER_GO_RECORDED_BY_PR79`
  (carry-forward).
- **Runbook source:** `PR80_GATE4C_CUTOVER_GO_RUNBOOK`
  (`docs/sprint2-pr18ak-gate4c-cutover-go-planning-runbook.md`,
  merged).
- **Cache-safe asset source:** website PR #7, merge commit
  `8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d`.
- **Versioned-pair wiring source:** website PR #8, merge commit
  `e7918f6c78f1cb67b9807b21519db220a8cffa19` (103 production HTML
  pages wired to the versioned pair; legacy unversioned files
  unchanged).
- **Prior rolled-back attempt:** PR #84
  (`GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` — HTTP 500 at
  `/v1/event`; root cause: production collector app role lacked
  `SELECT` on `accepted_events` conflict-target columns).
- **Grant fix:** `GRANT SELECT (workspace_id, site_id,
  client_event_id) ON public.accepted_events TO
  buyerrecon_prod_collector_app` applied at `2026-06-02T17:01:16Z`
  (PR #87).
- **Proof chain:** `EXPLAIN_PRECHECK_PASS` (PR #89);
  `COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING` (PR #90).

**Authorization granted by this PR (after merge only):**

- `gate_4c_execution_authorised_by_this_pr=true`
- `combined_mode_endpoint_flip_authorised_by_this_pr=true`
- `production_versioned_pair_serve_authorised_by_this_pr=true`
- `controlled_canary_authorised_by_this_pr=true`
- `rollback_execution_authorised_if_stopline_hit=true`
- `post_execution_evidence_pr_required=true`
- `single_attempt_only=true` (this GO authorizes exactly **one**
  combined mode+endpoint retry; consumed on first use)

**Still false (NOT authorized by this PR):**

- `pr83_re_use_authorised_by_this_pr=false` (PR #83 GO is consumed
  by the PR #84 attempt; this is a *new* GO, not a reactivation)
- `retry_before_this_pr_merges_authorised=false`
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

The PR #83 execution GO was consumed by the PR #84 attempt, which
reached production `/v1/event` and received HTTP 500. The
collector logs showed `storage_failure: permission denied for table
accepted_events`. The cache-safe frontend path worked correctly;
the old `request_body_invalid_json` / cache-mix failure was **not**
reproduced.

The following work has since been completed:

- **PR #85** — diagnostic plan confirmed the privilege tension
  (`INSERT=true` but `permission denied` observed).
- **PR #86** — read-only diagnostic proof confirmed `SELECT=false`
  on `workspace_id`, `site_id`, and `client_event_id` for the
  `ON CONFLICT` target path; ruled out RLS, triggers, and role
  mismatch.
- **PR #87** — narrow column-level `SELECT` grant applied to
  `buyerrecon_prod_collector_app` on `accepted_events`:
  `workspace_id`, `site_id`, `client_event_id`. Post-grant
  privilege snapshot confirmed.
- **PR #88** — write-path proof planning recorded.
- **PR #89** — `EXPLAIN_PRECHECK_PASS` recorded: PostgreSQL
  planned the `INSERT … ON CONFLICT … RETURNING event_id` shape
  without `permission denied`; `accepted_events_dedup` resolved as
  conflict arbiter.
- **PR #90** — `COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING` recorded:
  staging `POST /v1/event → HTTP 200`; `accepted_count=1`;
  `rejected_count=0`; 1 row written to `accepted_events`.

The DB-layer permission blocker is addressed. A fresh, narrowly
scoped GO for **one** retry attempt is appropriate.

---

## 3. Known caveat

The staging proof used `buyerrecon_app` with table-level
`SELECT=true` on `accepted_events` in `buyerrecon_staging`, which
is broader than the production posture (`buyerrecon_prod_collector_app`
with column-level `SELECT=true` on three conflict-target columns,
table-level `SELECT=false`). Production runtime sufficiency of the
narrow grant is supported by:

- Production `EXPLAIN_PRECHECK_PASS` under the actual production app
  role after the grant (PR #89), and
- staging runtime write-path PASS (PR #90).

A production runtime write is not yet directly proven at the exact
minimum privilege. The production retry therefore remains bounded,
single-attempt, and rollback-protected per PR #80.

---

## 4. Inputs / source-of-truth references

| Item | Reference |
| --- | --- |
| Path α residual-risk acceptance | PR #77 (merged) |
| Gate 4C aggregation readiness | PR #79 (merged) |
| Cutover runbook | PR #80 (merged) |
| Consumed prior GO | PR #83 (merged; **consumed by PR #84**) |
| Rolled-back execution evidence | PR #84 (merged; `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`) |
| Permission diagnostic plan | PR #85 (merged) |
| Grant diagnostic proof | PR #86 (merged) |
| Grant operator proof | PR #87 (merged; grant applied `2026-06-02T17:01:16Z`) |
| Write-path proof planning | PR #88 (merged) |
| `EXPLAIN` pre-check | PR #89 (merged; `EXPLAIN_PRECHECK_PASS`) |
| Staging write-path proof | PR #90 (merged; `COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING`) |
| Option key proof | PR #71 — `transportOptions.mode = 'sprint2_v1_event'` at AMS pin `13d4900` |
| Website cache-safe assets | Website PR #7, merge `8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d` |
| Website versioned-pair wiring (103 pages) | Website PR #8, merge `e7918f6c78f1cb67b9807b21519db220a8cffa19` |
| Versioned SDK | `/thinlayer/thin-sdk.048d1d23.iife.js` sha256 `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` |
| Versioned init | `/thinlayer/br-thinlayer-init.69f898f8.js` sha256 `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` |
| Forbidden unversioned SDK (rollback only) | `/thinlayer/thin-sdk.iife.js` sha256 `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |
| Forbidden unversioned init (rollback only) | `/thinlayer/br-thinlayer-init.js` sha256 `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |
| Invalid-JSON baseline | 26-row protected baseline (PR#17s / PR#18w) — must remain untouched |
| Governance locks | PR#18ab final-scoring + PR#73 hard-gate carry-forward (all in force) |
| Deferred runtime | PR#19c / PR#19d / PR#20 inactive; PR#76 ProductContextProfile upstream-only |

---

## 5. Helen execution GO statement

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
- **No retry before this PR is merged.** The authorization takes
  effect only after merge.

---

## 6. Required backend / DB state at retry time

Before the operator session begins, confirm all of the following:

| Check | Expected |
| --- | --- |
| `current_user` (production) | `buyerrecon_prod_collector_app` |
| `accepted_events.workspace_id` column SELECT | true |
| `accepted_events.site_id` column SELECT | true |
| `accepted_events.client_event_id` column SELECT | true |
| `accepted_events.event_id` column SELECT | true |
| `accepted_events.session_id` column SELECT | false |
| `accepted_events` table-level SELECT | false |
| `accepted_events` INSERT | true |
| RLS on `accepted_events` | false |
| Policy count | 0 |
| Trigger count | 0 |
| `accepted_events_dedup` index | Present and valid |
| Protected 26-row invalid-json baseline | Intact and untouched |

If any check fails — **stop and do not proceed**.

---

## 7. Authorized execution scope (later operator session, per PR #80)

### A. Pre-retry repo + asset verification

- Confirm website repo state is **at or after** merge commit
  `e7918f6c78f1cb67b9807b21519db220a8cffa19` on
  `production-live-20260508`.
- Confirm versioned pair present with expected hashes:
  - `/thinlayer/thin-sdk.048d1d23.iife.js` sha256 `048d1d23…`
  - `/thinlayer/br-thinlayer-init.69f898f8.js` sha256 `69f898f8…`
- Confirm candidate init contains:
  - `endpointUrl: 'https://buyerrecon.com/v1/event'`
  - `transportOptions: { mode: 'sprint2_v1_event' }`
- Confirm candidate init does **not** contain `/collect` or
  `buyerrecon-backend.onrender.com`.
- Confirm rollback bundle path exists and `ROLLBACK-PROCEDURE.md`
  is present.
- Confirm PR#17s / PR#18w 26-row baseline untouched.
- Confirm PR#18ab locks and PR#73 hard-gates in force.
- Confirm `buyerrecon_prod_collector_app` production privilege
  state (§6 above).

### B. Pre-canary static HTTPS verification (production)

- Verify both versioned assets served at expected hashes:
  - `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`
  - `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770`
- Verify served init has `endpointUrl: https://buyerrecon.com/v1/event`
  and `transportOptions.mode: sprint2_v1_event`.
- Verify served index references versioned pair in SDK-before-init
  order with **zero** unversioned refs.

### C. DB preflight baseline

- Capture read-only baseline of `ingest_total`, `accepted_total`,
  `rejected_total`, `request_body_invalid_json_total`, and
  `accepted_events_total` under `buyerrecon_prod_audit_readonly`.
  No writes.

### D. Production host apply

- Apply the candidate website state (versioned pair) to the
  production host per PR #80.
- No backend deploy. No AMS deploy. No DB migration. No customer
  output touched.

### E. Controlled canary (single attempt, bounded window)

- Run only the minimum approved canary needed to verify ingestion.
- Bounded canary window per PR #80.
- Mode-first production state is **forbidden**.
- Production `/collect` tolerance test is **forbidden**.
- The only intended production collector target after the flip is
  the Hetzner Sprint 2 `/v1/event` endpoint.

### F. Read-only observation

- Record accepted / rejected / `request_body_invalid_json` deltas
  since canary start.
- Check collector service logs for `storage_failure` /
  `permission denied` — **any such entry is an immediate stop-line**.
- No raw payload, no token, no `Authorization` value, no DSN, no
  raw `request_id` / `session_id`.

### G. Decision (PASS / rollback)

- Apply PR #80 §6 canary checks + §7 stop-lines; decide PASS,
  rollback, or continue observation within the bounded window.

### H. Evidence PR

- Create a separate post-execution evidence PR whether verdict is
  PASS or rolled-back.

---

## 8. Stop-lines

Execution must **stop and roll back** if any of the following:

- Any `POST https://buyerrecon.com/v1/event` returns `400
  request_body_invalid_json`.
- Any `POST https://buyerrecon.com/v1/event` returns `500` or
  any collector log shows `storage_failure` or `permission denied
  for table accepted_events`.
- Any new `request_body_invalid_json` row appears in
  `ingest_requests_ledger` after canary start.
- `accepted_since_canary = 0` after the browser canary completes.
- Static HTTPS verification does not show both versioned files at
  expected hashes (`048d1d23…` / `69f898f8…`).
- Candidate init does not show
  `endpointUrl: 'https://buyerrecon.com/v1/event'`.
- Candidate init does not show
  `transportOptions.mode: 'sprint2_v1_event'`.
- Any candidate page or HTML references an unversioned Gate 4C
  ThinSDK path (`/thinlayer/thin-sdk.iife.js` or
  `/thinlayer/br-thinlayer-init.js`).
- SDK-before-init order is not confirmed on served pages.
- Production host serves a mixed versioned / unversioned pair.
- `collect_hits_post_flip > 0`.
- Rollback bundle missing or invalid.
- Operator cannot produce redacted evidence.
- Rollback verification cannot be completed.
- Secrets, tokens, DSNs, private keys, raw payloads, customer data,
  raw `request_id`, or raw `session_id` are printed.
- Any unexpected backend / DB / AMS / customer-output / scoring /
  Lane behavior appears.

---

## 9. Rollback (authorized if any stop-line hit)

**Primary:** rollback bundle at
`/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`
using `ROLLBACK-PROCEDURE.md`.

**Secondary:** restore production page references to the legacy
unversioned pair (`/thinlayer/thin-sdk.iife.js` +
`/thinlayer/br-thinlayer-init.js`); the legacy `br-thinlayer-init.js`
hash `9b0e4530…` carries the legacy `/collect` endpoint.

**Emergency kill:** `window.__BR_THIN_DISABLED = true` if
applicable.

**Rollback verification (required):**

- Served init has **no** `sprint2_v1_event`.
- `endpointUrl` restored to legacy `/collect`.
- No new `request_body_invalid_json` rows since rollback
  verification timestamp.
- Production host stable.

**Rollback constraints:** Must not delete / mutate / annotate /
normalise the PR#17s / PR#18w 26-row baseline rows.

---

## 10. Required post-execution evidence PR

A separate post-execution evidence PR must record (whether PASS or
rollback):

- Website repo commit deployed / referenced.
- Static HTTPS verification result (hashes served).
- Served init endpoint / mode verification.
- Browser / network observation summary (no raw payloads).
- DB baseline **before** canary.
- DB observation **after** canary (accepted / rejected / ingest
  deltas, `collect_hits_post_flip`).
- Collector log categorical summary (request IDs redacted) — in
  particular, confirm `permission denied` absent or present.
- Stop-line status.
- Rollback status if triggered.
- **Final verdict** — one of:
  - `GATE4C_EXECUTION_PASS`
  - `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`
- Gate 4D remains closed unless and until a `GATE4C_EXECUTION_PASS`
  evidence PR is merged.

---

## 11. Governance carry-forward

- PR#18ab final-scoring governance locks: **in force** (all eleven
  `false` / `[]`).
- PR#73 hard-gate carry-forward locks: **in force**.
- PR#17s / PR#18w 26-row baseline: **untouched**.
- PR#19c / PR#19d / PR#20: **inactive**.
- PR#76 ProductContextProfile v0.1: upstream contract, **not
  activated** by this cutover.
- No report / customer output. No Lane writers. No runtime scoring.
  No AMS Trust / Pass runtime.
- Gate 4D / Gate 4E: **out of scope**. Gate 4F: **not invented**.

---

## 12. Machine-readable block

```yaml
status: EXECUTION_GO_RECORDED
go_freshness: fresh_after_pr84_rollback_and_grant_proof_chain
gate_4c_readiness_source: PR_79_READY_FOR_HELEN_CUTOVER_GO_UNDER_PATH_ALPHA
runbook_source: PR_80_GATE4C_CUTOVER_GO_RUNBOOK
path_alpha_acceptance_source: PR_77
prior_consumed_go: PR_83
prior_rolled_back_attempt: PR_84
grant_fix_source: PR_87
grant_applied: GRANT_SELECT_workspace_id_site_id_client_event_id_ON_accepted_events_TO_buyerrecon_prod_collector_app
explain_precheck_source: PR_89_EXPLAIN_PRECHECK_PASS
staging_proof_source: PR_90_COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING
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
production_db_role: buyerrecon_prod_collector_app
accepted_events_workspace_id_select: true
accepted_events_site_id_select: true
accepted_events_client_event_id_select: true
accepted_events_event_id_select: true
accepted_events_session_id_select: false
accepted_events_table_select: false
accepted_events_insert: true
gate_4c_execution_authorised_by_this_pr: true
combined_mode_endpoint_flip_authorised_by_this_pr: true
production_versioned_pair_serve_authorised_by_this_pr: true
controlled_canary_authorised_by_this_pr: true
rollback_execution_authorised_if_stopline_hit: true
post_execution_evidence_pr_required: true
single_attempt_only: true
retry_before_this_pr_merges_authorised: false
pr83_re_use_authorised_by_this_pr: false
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
next_step: operator_execute_single_gate4c_retry_per_pr80_after_this_pr_merges_then_open_evidence_pr
```

---

## 13. Hard boundaries

This PR does **not** itself:

- execute commands
- deploy
- edit `/var/www`
- contact staging or production
- generate traffic / run a canary
- flip any endpoint on the live host
- merge or modify any website PR
- change backend code / package / migration / schema
- apply DB grants or change DB privileges
- mutate secrets / tokens / roles
- create customer output
- activate Lane writers / runtime scoring / AMS Trust / Pass
- open Gate 4D / Gate 4E
- invent Gate 4F

It **only records Helen's explicit fresh execution GO** for one
later operator retry. The retry happens in a later operator session,
strictly per PR #80, and must be followed by a separate
post-execution evidence PR.

`next_step: operator_execute_single_gate4c_retry_per_pr80_after_this_pr_merges_then_open_evidence_pr`
