# Sprint 2 PR#18al — Gate 4C Helen Execution GO (Combined Mode+Endpoint Flip Authorization)

> **DOCS-ONLY EXECUTION-AUTHORIZATION RECORD. THIS PR DOES NOT
> EXECUTE.** It records Helen's explicit GO authorizing the operator
> to execute the Gate 4C combined mode+endpoint cutover in a **later
> operator session**, strictly per the merged PR #80 runbook. This PR
> runs no commands, merges no website PR, flips no `endpointUrl`,
> deploys nothing, edits no `/var/www`, contacts no host, generates no
> traffic, runs no canary, and opens no Gate 4D. A separate
> post-execution evidence PR is required. No secrets — placeholders /
> redactions only.

---

## 1. Status / verdict

- **Status:** `EXECUTION_GO_RECORDED`.
- **Readiness source:** `GATE4C_READY_FOR_HELEN_CUTOVER_GO_RECORDED_BY_PR79`.
- **Runbook source:** `PR80_GATE4C_CUTOVER_GO_RUNBOOK`
  (`docs/sprint2-pr18ak-gate4c-cutover-go-planning-runbook.md`, merged).

**Authorization granted by this PR:**
- `gate_4c_execution_authorised_by_this_pr=true`
- `combined_mode_endpoint_flip_authorised_by_this_pr=true`
- `website_pr_4_merge_or_operator_delta_authorised_by_this_pr=true`
- `endpoint_flip_authorised_by_this_pr=true`
- `production_bundle_replacement_authorised_by_this_pr=true`
- `controlled_canary_authorised_by_this_pr=true`

**Still false (NOT authorized by this PR):**
- `gate_4d_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `runtime_scoring_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `pr19c_runtime_authorised_by_this_pr=false`
- `pr19d_runtime_authorised_by_this_pr=false`
- `pr20_runtime_authorised_by_this_pr=false`

The authorization above takes effect in a **later operator session**;
it does not cause any action at merge time of this PR.

---

## 2. Helen execution GO statement

> **Helen authorizes the operator to execute Gate 4C combined
> mode+endpoint cutover according to the merged PR #80 runbook,
> subject to all preflight checks, stop-lines, rollback conditions,
> redaction rules, and post-execution evidence requirements in that
> runbook.**

Clarifications:
- This GO is for **Gate 4C only**.
- This GO is **not** a general production-deploy permission.
- This GO is **not** Gate 4D.
- This GO is **not** customer-output activation.
- This GO is **not** runtime scoring / Lane writer / AMS Trust / Pass
  activation.

---

## 3. Authorized execution scope

In the later operator session, the operator is authorized to do
**only** the following, strictly per PR #80:

### A. Pre-cutover verification
- verify website base/source state.
- verify SDK artifact hash:
  `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`.
- verify current init hash:
  `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`.
- verify PR #18z rollback bundle path:
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`
  + `ROLLBACK-PROCEDURE.md`.
- verify PR#17s / PR#18w 26-row baseline remains untouched.
- verify PR#18ab locks and PR#73 hard-gates remain in force.

### B. Prepare combined mode+endpoint bundle
- apply / consume the website PR #4-style delta:
  `transportOptions.mode = 'sprint2_v1_event'` (as proved by PR #71 —
  the canonical AMS option key at commit pin `13d4900`).
- flip `endpointUrl` from legacy Render `/collect` to the Hetzner
  Sprint 2 `/v1/event` endpoint.
- ensure **both** mode and endpoint flip occur **atomically** in the
  same candidate bundle.
- do **not** run a mode-first production state.
- do **not** test production `/collect`.
- do **not** make any customer-output change.

### C. Production host apply
- apply the approved bundle to the target website host per PR #80.
- edit **only** the intended website artifact/init file(s).
- no unrelated files.
- no ThinSDK artifact replacement unless the runbook explicitly
  confirms the existing artifact (`048d1d23…`) is correct.
- no backend deploy.
- no AMS deploy.
- no DB migration.

### D. Controlled canary
- run only the minimum approved canary/observation needed to verify
  ingestion.
- keep the canary window bounded.
- do **not** activate customer output.
- do **not** activate Lane writers.
- do **not** activate scoring runtime.
- do **not** activate AMS Trust / Pass runtime.

### E. Observation
- run **read-only** observation queries only.
- record accepted / rejected / `request_body_invalid_json` summaries.
- no raw payload.
- no token.
- no `Authorization` header value.
- no DSN.
- no raw `request_id`.
- no raw `session_id`.

### F. Evidence PR
- create a **separate** post-execution evidence PR.
- include redacted command summary, pre/post hashes, canary window,
  observation result, rollback readiness, and whether rollback was
  needed.
- do **not** embed secrets.

---

## 4. Combined flip constraints

- The cutover is **combined mode+endpoint only**.
- `legacy_collect_tolerance` remains
  `OUT_OF_SCOPE_UNDER_COMBINED_FLIP_PATH`.
- Production **mode-first is forbidden**.
- Production **`/collect` tolerance test is forbidden**.
- The only intended production collector target after the flip is the
  Hetzner Sprint 2 `/v1/event` endpoint.

---

## 5. Stop-lines

Execution must **stop and roll back / review** if any of the following
occurs:
- `request_body_invalid_json_observed_post_flip > 0`
- `rejected_events` burst above the expected canary threshold
- accepted-event delta from the 26-row baseline is **absent** when the
  canary should have generated one
- unexpected `/collect` traffic after the flip
- `endpointUrl` points to the wrong host
- ThinSDK artifact hash mismatch (not `048d1d23…`)
- init diff contains anything beyond the approved delta
- raw payload printed
- token / `Authorization` / DSN exposed
- production DB write required
- customer output becomes visible
- Lane writer / scoring / AMS Trust / Pass activates
- any PR#18ab lock would need relaxation
- rollback bundle missing or invalid
- operator cannot produce redacted evidence

---

## 6. Rollback authorization

This PR authorizes rollback **if any stop-line is hit**.

Rollback options:
- **Primary:** PR#18z on-host rollback bundle using
  `ROLLBACK-PROCEDURE.md` in
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`.
- **Secondary:** one-file `br-thinlayer-init.js` revert to hash
  `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
  (and `endpointUrl` back to legacy `/collect`).
- **Emergency kill:** `window.__BR_THIN_DISABLED` if applicable.

- Rollback proof must be recorded in the evidence PR (§3.F).
- Rollback must **not** delete / mutate / annotate / normalise the
  PR#17s / PR#18w 26-row baseline rows.

---

## 7. Governance carry-forward

- PR#18ab final-scoring governance locks remain **in force** (all
  eleven `false` / `[]`).
- PR#73 hard-gate carry-forward locks remain **in force**.
- PR#17s / PR#18w 26-row baseline remains **untouched**.
- PR#19c / PR#19d / PR#20 remain **inactive**.
- PR#76 ProductContextProfile v0.1 contract remains upstream but is
  **not activated** by this cutover.
- PR#78 downstream alignment remains docs-only and does **not**
  activate PR#20 / PR#21 / PR#22.
- No report / customer output.
- No Lane writers.
- No runtime scoring.
- No AMS Trust / Pass runtime.
- Gate 4D / Gate 4E: **out of scope**.
- Gate 4F: **not invented**.

---

## 8. Machine-readable block

```yaml
status: EXECUTION_GO_RECORDED
gate_4c_readiness_source: PR_79_READY_FOR_HELEN_CUTOVER_GO_UNDER_PATH_ALPHA
runbook_source: PR_80_GATE4C_CUTOVER_GO_RUNBOOK
path_alpha_acceptance_source: PR_77
gate_4c_execution_authorised_by_this_pr: true
combined_mode_endpoint_flip_authorised_by_this_pr: true
website_pr_4_merge_or_operator_delta_authorised_by_this_pr: true
endpoint_flip_authorised_by_this_pr: true
production_bundle_replacement_authorised_by_this_pr: true
controlled_canary_authorised_by_this_pr: true
rollback_execution_authorised_if_stopline_hit: true
post_execution_evidence_pr_required: true
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
pr19c_runtime_authorised_by_this_pr: false
pr19d_runtime_authorised_by_this_pr: false
pr20_runtime_authorised_by_this_pr: false
next_step: operator_execute_gate4c_per_pr80_then_open_evidence_pr
```

---

## 9. Hard boundaries

This PR does **not** itself:
- execute commands
- merge website PR #3 / #4 / #6 in this PR body
- deploy
- edit `/var/www`
- contact staging or production
- generate traffic
- run a canary
- mutate DB
- change secrets / tokens / roles
- create customer output
- activate Lane writers
- activate runtime scoring
- activate AMS Trust / Pass runtime
- open Gate 4D
- open Gate 4E
- invent Gate 4F

It **only records Helen's explicit execution GO** for a later operator
session. The cutover itself happens in that later session, strictly
per PR #80, and must be followed by a separate post-execution evidence
PR.

`next_step: operator_execute_gate4c_per_pr80_then_open_evidence_pr`
