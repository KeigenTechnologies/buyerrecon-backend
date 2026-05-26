# Sprint 2 PR#18ak — Gate 4C Cutover GO Planning / Operator Runbook (Docs-Only)

> **PLANNING / RUNBOOK ONLY. NO EXECUTION.** This PR prepares the
> future Gate 4C combined mode+endpoint cutover steps for a later,
> separate, explicit Helen execution GO. It does **not** execute the
> cutover, does **not** flip `endpointUrl`, does **not** merge
> website PR #3 / #4 / #6, does **not** deploy, does **not** edit
> `/var/www`, does **not** contact staging or production, does
> **not** generate traffic, and does **not** open Gate 4D. No
> secrets, no raw tokens, no raw payloads — placeholders only.

---

## 1. Status / verdict

- **Status:** `PLANNING_ONLY`.
- **Current readiness:** `GATE4C_READY_FOR_HELEN_CUTOVER_GO_RECORDED_BY_PR79`.
- **Execution authorization (this PR):**
  - `gate_4c_execution_authorised_by_this_pr=false`
  - `endpoint_flip_authorised_by_this_pr=false`
  - `website_pr_4_merge_authorised_by_this_pr=false`
  - `deploy_authorised_by_this_pr=false`
  - `var_www_edit_authorised_by_this_pr=false`
  - `canary_authorised_by_this_pr=false`
  - `gate_4d_authorised_by_this_pr=false`

This PR prepares the future cutover runbook. **It does not authorize
the operator to run it.** Running any step below requires a separate,
explicit Helen execution GO PR (or a deferral decision).

---

## 2. Inputs / source-of-truth references

| Input | Reference | Role |
| --- | --- | --- |
| Path α residual-risk acceptance | PR #77 (`docs/sprint2-pr18ai-path-alpha-risk-acceptance.md`, merged) | Helen's explicit acceptance of ThinSDK→HTTP residual risk |
| Gate 4C aggregation | PR #79 (`docs/sprint2-pr18ai-gate4c-path-alpha-aggregation-review.md`, merged) | `GATE4C_READY_FOR_HELEN_CUTOVER_GO` under Path α |
| Canonical option key | PR #71 (`docs/sprint2-pr18ae-supplement-thinsdk-option-key-proof.md`) | `transportOptions.mode = 'sprint2_v1_event'` at AMS pin `13d4900` |
| Proposed config patch | Website PR #4 (HOLD) | One-file `br-thinlayer-init.js` delta adding `transportOptions.mode = 'sprint2_v1_event'` |
| Website base + SDK artifact | `production-live-20260508`; `thinlayer/thin-sdk.iife.js` sha256 `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` | Sprint2-capable SDK already present on the deploy line |
| Current production init | `thinlayer/br-thinlayer-init.js` sha256 `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` | Legacy-array config (pre-cutover baseline) |
| Rollback bundle | `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/` + `ROLLBACK-PROCEDURE.md` (PR #18z) | On-host rollback source-of-truth |
| Invalid-JSON baseline | PR#17s / PR#18w 26-row baseline (HTTP 400 `request_body_invalid_json`, 2026-05-19) | Canary comparison baseline; must not be deleted/mutated/annotated/normalised |
| Governance locks | PR#18ab final-scoring locks; PR#73 hard-gate carry-forward locks | Remain in force, unchanged |
| Deferred runtime | PR#19c / PR#19d / PR#20 | Remain inactive |

---

## 3. Combined flip model

The future cutover is a **combined mode+endpoint flip**, executed
atomically — **not** mode-first.

The future cutover will combine, in a single change set:
- **Sprint 2 body mode:** `transportOptions.mode = 'sprint2_v1_event'`
  in `br-thinlayer-init.js`.
- **`endpointUrl` flip:** from the legacy Render `/collect` to the
  Hetzner Sprint 2 `/v1/event` endpoint.

Posture:
- `legacy_collect_tolerance` remains
  `OUT_OF_SCOPE_UNDER_COMBINED_FLIP_PATH`.
- **Do not** test production `/collect`.
- **Do not** run mode-first on production. (Enabling Sprint 2 mode
  while still pointing at legacy `/collect` is explicitly excluded;
  the combined flip avoids posting Sprint 2 single-object bodies to
  the legacy collector.)

---

## 4. Website PR #4 handling

- Website **PR #4 remains HOLD** until a separate execution GO PR.
- A future execution GO **may** authorize one of:
  - merge website PR #4, **or**
  - reproduce its one-file `br-thinlayer-init.js` config delta into
    an operator bundle,
  depending on the final operator choice at GO time.
- **PR #80a (this PR) itself must not merge PR #4.**

Confirmed for this PR:
- no website PR #3 merge
- no website PR #4 merge
- no website PR #6 merge

---

## 5. Operator preflight checklist (verify before any future execution)

> All checks below are read-only verifications to be performed at a
> future GO. This PR does not perform them against any host.

**Repository / source:**
- [ ] Website `production-live-20260508` (or intended branch) is clean.
- [ ] SDK artifact hash: `thinlayer/thin-sdk.iife.js` =
  `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`.
- [ ] Current init hash before cutover: `thinlayer/br-thinlayer-init.js` =
  `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`.
- [ ] Proposed init includes `transportOptions: { mode: 'sprint2_v1_event' }`.
- [ ] Proposed `endpointUrl` target is the Hetzner Sprint 2 `/v1/event` endpoint.
- [ ] No raw tokens or secrets embedded in the init or bundle.

**Host / rollback:**
- [ ] `/var/www` target path confirmed — **do not edit it in this planning PR.**
- [ ] Rollback bundle exists at
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`.
- [ ] `ROLLBACK-PROCEDURE.md` exists in that bundle.
- [ ] Operator has SSH/root access if needed (verified at GO time, not here).
- [ ] No customer-output system will be activated by the cutover.

**Database / observation:**
- [ ] Canary observation SQL is **read-only** (SELECT-only).
- [ ] PR#17s / PR#18w 26-row baseline exists and must not be
  deleted / mutated / annotated / normalised.
- [ ] `request_body_invalid_json_observed_post_flip` stop-line query
  exists or is defined before any canary.

---

## 6. Future execution sequence — **NOT TO BE RUN IN THIS PR**

> Every command block in this section is a **future** operator step.
> **NONE is executed by this PR.** They run only under a separate,
> explicit Helen execution GO. Placeholders only; no real secrets.

**A. Pre-cutover snapshot** — `[NOT TO RUN IN THIS PR]`
- Record pre-cutover on-host hashes of `thin-sdk.iife.js` and
  `br-thinlayer-init.js`; snapshot current `endpointUrl` value.

**B. Prepare candidate init/bundle** — `[NOT TO RUN IN THIS PR]`
- Produce the candidate `br-thinlayer-init.js` carrying
  `transportOptions: { mode: 'sprint2_v1_event' }` and the
  `/v1/event` `endpointUrl`, into an operator bundle (no deploy).

**C. Confirm diff** — `[NOT TO RUN IN THIS PR]`
- Confirm the candidate diff contains **only** the intended
  `br-thinlayer-init.js` change (mode + endpoint); `thin-sdk.iife.js`
  unchanged at `048d1d23…`.

**D. Apply bundle to host** — `[NOT TO RUN IN THIS PR — REQUIRES FUTURE GO]`
- Apply the bundle to the staging/production host **only** under an
  explicit future GO. `<OPERATOR_APPLY_STEP_PLACEHOLDER>`.

**E. Trigger minimal canary** — `[NOT TO RUN IN THIS PR — REQUIRES FUTURE GO]`
- Trigger a minimal canary **only** if approved by the future GO.
  `<OPERATOR_CANARY_STEP_PLACEHOLDER>`.

**F. Read-only observation queries** — `[NOT TO RUN IN THIS PR]`
- Run SELECT-only observation queries (see §7). No writes.

**G. Decide PASS / rollback / continue** — `[NOT TO RUN IN THIS PR]`
- Apply §7 canary checks + §7 stop-line; decide PASS, rollback
  (§8), or continue observation.

**H. Record evidence** — `[NOT TO RUN IN THIS PR]`
- Record evidence in a later proof PR (§9), secrets redacted.

---

## 7. Canary window

The canary window is defined conceptually here (timing/size set at GO).

**Canary checks (read-only):**
- accepted-event count delta from the 26-row baseline
- no `request_body_invalid_json_observed_post_flip`
- no `rejected_events` burst
- no unexpected `/collect` traffic once the flip should have moved to
  `/v1/event`
- no raw payload / secret exposure in any observation output
- no customer-output activation
- no Lane writer / runtime scoring / AMS Trust / Pass runtime activation

**Stop-line:**
- `request_body_invalid_json_observed_post_flip > 0` during the canary
  window triggers rollback review / stop (carry-forward from PR#18ac
  §10.1; not introduced by this PR).

---

## 8. Rollback

- **Primary rollback:** restore the PR#18z on-host bundle using
  `ROLLBACK-PROCEDURE.md` in
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`.
- **Secondary rollback:** revert the one-file `br-thinlayer-init.js`
  to hash `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
  (and `endpointUrl` back to legacy `/collect`).
- **Emergency kill:** set `window.__BR_THIN_DISABLED = true` before
  the init loads, if applicable, to halt the layer.
- Rollback must **not** delete / mutate the PR#17s / PR#18w baseline
  rows.
- Rollback proof must be recorded in a later proof PR (§9).
- `rollback_execution_authorised_by_this_pr=false`.

---

## 9. Evidence PR after future execution

A future post-execution proof PR must record:
- cutover timestamp
- pre/post artifact hashes (`thin-sdk.iife.js`, `br-thinlayer-init.js`)
- operator commands with **secrets redacted**
- canary window (start/end)
- read-only observation summaries
- accepted / rejected / `request_body_invalid_json` counts
- rollback readiness confirmation
- explicit statement whether rollback was needed
- **no** raw payload
- **no** token
- **no** `Authorization` value
- **no** DSN
- **no** raw `request_id` / `session_id`

---

## 10. Governance carry-forward

- PR#18ab final-scoring governance locks: **unchanged** (all eleven
  remain `false` / `[]`).
- PR#73 hard-gate carry-forward locks: **unchanged**.
- PR#17s / PR#18w 26-row baseline: **untouched**.
- PR#19c / PR#19d / PR#20: **remain inactive**.
- No report / customer output.
- No Lane writers.
- No runtime scoring.
- No AMS Trust / Pass runtime.
- Gate 4D / Gate 4E: **out of scope**.
- Gate 4F: **not invented** (not a defined gate in any governance doc).

---

## 11. Machine-readable block

```yaml
status: PLANNING_ONLY
gate_4c_readiness_source: PR_79_READY_FOR_HELEN_CUTOVER_GO_UNDER_PATH_ALPHA
path_alpha_acceptance_source: PR_77
gate_4c_execution_authorised_by_this_pr: false
website_pr_4_merge_authorised_by_this_pr: false
endpoint_flip_authorised_by_this_pr: false
deploy_authorised_by_this_pr: false
var_www_edit_authorised_by_this_pr: false
canary_authorised_by_this_pr: false
rollback_execution_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
next_step: separate_helen_execution_go_or_deferral
```

---

## 12. Hard boundaries

This PR does **not**:
- execute Gate 4C
- flip `endpointUrl`
- merge website PR #3 / #4 / #6
- deploy
- edit `/var/www`
- contact staging
- contact production
- generate traffic
- run a canary
- run DB writes
- change secrets / tokens / roles
- activate customer output
- activate Lane writers
- activate runtime scoring
- activate AMS Trust / Pass runtime
- open Gate 4D
- open Gate 4E
- invent Gate 4F

The single scoped output of this PR is a **planning/operator runbook**
that a later, separate, explicit Helen execution GO PR (or a deferral
decision) may consult. Nothing else.

`next_step: separate_helen_execution_go_or_deferral`
