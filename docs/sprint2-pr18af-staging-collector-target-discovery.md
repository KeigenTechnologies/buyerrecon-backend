# BuyerRecon Sprint 2 PR#18af — Gate 4C Safe Non-Production Staging Collector Target Discovery / Proof

Status: **discovery and local-layer proof. Verdict: PARTIAL UPGRADE — `mock_validator_pass = PASS` carry-forward; `local_route_layer_pass = PASS` newly proven; `staging_collector_pass` upgraded to PASS for the body-shape acceptance layer (carry-forward from PR#17x Gate 2 PASS and PR#17z Gate 3 PASS) but BLOCKED for the ThinSDK→HTTP junction layer; `legacy_collect_tolerance` remains BLOCKED. Final pre-Gate-4C verdict still BLOCKED_PENDING_HELEN_GO. See §6.**

PR#18af is the docs-only discovery step opened by the PR#18ai pre-Gate-4C readiness review's `staging_collector_pass = BLOCKED_PENDING_SAFE_STAGING_TARGET_AND_HELEN_GO` follow-up question: *is there a safe non-production target against which Gate 4C's `staging_collector_pass` verdict can be upgraded from BLOCKED to PASS, or is the BLOCKED state categorical?*

This file does not:
- merge or modify website PR #3 (`gate4c-staging-mock-thinsdk-proof`),
- merge or modify website PR #4 (`thinlayer/br-thinlayer-init.js — transportOptions.mode`),
- approve or execute Gate 4C endpointUrl re-flip,
- change any production DB grant, run any production HTTP call, edit any production `/var/www` file, or alter the AMS commit pin recorded by PR#71 (`13d4900` `transportOptions.mode = 'sprint2_v1_event'`).

Where PR#18af cites PR#71 / PR#72 / PR#17x / PR#17z / PR#17s / PR#18ab / PR#18ac / PR#18ad / PR#18ai, those references are read-only.

> **No Gate 4C execution.**
> **No endpointUrl re-flip.**
> **No PR #3 / PR #4 merge.**
> **No production endpoint, no production token, no production DB.**

---

## 1. Status / verdict

**Final verdict: BLOCKED_PENDING_HELEN_GO** for Gate 4C end-to-end, but with the underlying verdict matrix tightened as follows (see §6 for the categorical table and §7 for the rationale per row):

| Verdict slot | Pre-PR#18af state (PR#18ai) | PR#18af state | Change |
| --- | --- | --- | --- |
| `mock_validator_pass` | PASS | PASS | unchanged (PR #3 carry-forward) |
| `staging_collector_pass` (body-shape acceptance) | BLOCKED_PENDING_SAFE_STAGING_TARGET_AND_HELEN_GO | **PASS** (carry-forward from PR#17x Gate 2 PASS Attempt 3, 2026-05-21 and PR#17z Gate 3 PASS) | **upgraded** |
| `staging_collector_pass` (ThinSDK→HTTP junction) | not separately enumerated by PR#18ai | BLOCKED_PENDING_NON_PROD_WEBSITE_DEPLOYMENT_WITH_PR4_CONFIG_AND_HELEN_GO | **newly enumerated** |
| `local_route_layer_pass` | not enumerated by PR#18ai | **PASS** (this PR, vitest 111/111 against `validateEventCore` + `parseEnvelope` + `createV1Router` in-process) | **newly proven** |
| `legacy_collect_tolerance` | BLOCKED_PENDING_SAFE_STAGING_TARGET | BLOCKED_PENDING_SAFE_LEGACY_TARGET | unchanged in substance, label sharpened |

The aggregated final verdict for the *Gate 4C endpoint canary* gate (PR#18ac §10.1) remains **BLOCKED_PENDING_HELEN_GO** because the ThinSDK→HTTP junction layer cannot be promoted to PASS by docs or in-process tests; it requires either a non-production website deployment carrying the PR #4 config aimed at the Hetzner staging `/v1/event` endpoint, or explicit Helen-as-operator GO to deem the existing PR#17x/PR#17z body-shape PASS + PR#71 option-key proof + PR #3 mock harness sufficient for Gate 4C scope.

PR#18af makes no recommendation about which of those two paths Helen should take. It only reports honestly what exists and what does not.

### What is in scope of this PR
- Enumeration and classification of every candidate `/v1/event` target reachable from this repo or from related governance docs.
- In-process vitest proof against the canonical Sprint 2 single-object body shape, exercising `validateEventCore`, `parseEnvelope`, and `createV1Router` (the three Sprint 2 collector source-of-truth layers).
- Categorical citation of PR#17x and PR#17z PASS evidence as carry-forward for the body-shape acceptance verdict.
- Honest BLOCKED reporting for the ThinSDK→HTTP junction layer and for the legacy `/collect` tolerance layer, with the exact missing condition spelled out per row.

### What is NOT in scope of this PR
- No new HTTP call to Hetzner staging. PR#17x §15 token-provisioning runbook and PR#17z §4 audit trail are cited as existing operator-side PASS evidence; PR#18af does not re-run them.
- No bundle deploy. No `/var/www` edit. No DB grant change. No `endpointUrl` flip.
- No Track A invocation. No Playwright run. No customer-facing output. No Lane A/B writer activation.
- No AMS commit re-pin. No website PR #4 merge. No website PR #3 merge. No legacy Render `/collect` probe.
- No upgrade of `legacy_collect_tolerance` — that verdict requires a safe legacy target which does not exist.

---

## 2. Mandatory reference compliance

PR#18af honors the hard-gate references in `docs/ops/cutover-hard-gates.md` and the eleven governance locks recorded by PR#18ab §1.1:

| Lock | State |
| --- | --- |
| `customer_claim_allowed=false` | unchanged |
| `coupon_gate_allowed=false` | unchanged |
| `playwright_required_for_gate4=false` | unchanged |
| `track_a_required_for_gate4=false` | unchanged |
| `gnn_in_phase_1=false` | unchanged |
| `black_box_in_phase_1=false` | unchanged |
| `mock_substitutes_for_acceptance=false` | unchanged (PR #3 mock alone is not promotion-grade) |
| `single_doc_substitutes_for_acceptance=false` | unchanged (PR#18af is not promotion-grade either) |
| `allowed_evidence_kinds_outside_local_proof=[]` | unchanged |
| `allowed_promotion_actions_outside_local_proof=[]` | unchanged |
| `allowed_customer_language=[]` | unchanged |

PR#17s §1 — *"the 26 HTTP 400 `request_body_invalid_json` rows from 2026-05-19 are the historical envelope-shape warning. Do not delete, mutate, annotate, or normalise them"* — is upheld (this PR does not touch any `ingest_requests` row).

---

## 3. Inputs and provenance

Base branch: `sprint2-architecture-contracts-d4cc2bf` at tip `a1668c6` ("Sprint 2 PR#18ai: add pre-Gate 4C readiness review (#72)").

Source-of-truth reads underpinning the local-layer proof:
- `src/collector/v1/validation.ts` — `validateEventCore` exported at L176; Step 1→8 deterministic check order at L163–L175.
- `src/collector/v1/envelope.ts` — `parseEnvelope` (rejects top-level array → `request_body_invalid_json`).
- `src/collector/v1/routes.ts` — `createV1Router` (the real Express router under test).
- `tests/v1/validation.test.ts` — 64 assertions including the *"accepts a valid browser page event"* happy path (L178).
- `tests/v1/envelope.test.ts` — 30 assertions including the *"rejects /v1/event body that is a JSON array (envelope shape) → `request_body_invalid_json`"* smoking-gun negative test (L106) and the *"valid /v1/event returns one event"* happy path (L188).
- `tests/v1/routes.test.ts` — 17 assertions including the *"POST /v1/event — happy path > returns 200 and writes ingest + accepted rows"* fixture (L216) backed by the canonical browser `page_view` body at L178–L201 (8 required fields plus consent/page metadata).

Cross-document provenance for the candidate classification table in §5:
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 PASS (Attempt 3, 2026-05-21) against Hetzner staging `/v1/event`. §15 records the token-provisioning runbook required to re-execute.
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 PLANNING runbook; §10.1 acceptance criteria.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 PASS, staging-only DB-backed multi-fixture acceptance.
- `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` — Gate 4C scope; §6.2 ThinSDK transport requirement (FetchTransport, not sendBeacon).
- `docs/sprint2-pr18ad-gate1-contract-diff-confirmation.md` — static contract diff carry-forward (`source_missing_for_static_bundle_inspection = yes`).
- `docs/sprint2-pr18ae-supplement-thinsdk-option-key-proof.md` — PR#71: AMS commit `13d4900` proves `transportOptions.mode = 'sprint2_v1_event'` is the canonical option key.
- `docs/sprint2-pr18ai-pre-gate4c-readiness-review.md` — PR#72: aggregated pre-Gate-4C readiness; verdict BLOCKED_PENDING_SAFE_STAGING_TARGET_AND_HELEN_GO.
- Website repo (read-only reference) — PR #3 (`docs/gate4c-staging-mock-thinsdk-proof.md` + `tools/gate4c-thinsdk-mock-proof.mjs`, `staging-mock.invalid` URLs); PR #4 (3-line ThinSDK `transportOptions.mode` config patch).

---

## 4. The discovery question, restated

PR#18ai left `staging_collector_pass = BLOCKED_PENDING_SAFE_STAGING_TARGET_AND_HELEN_GO`. PR#18af asks: *is there any safe non-production target that can be exercised — by docs, by local tests, or by carry-forward citation — to upgrade `staging_collector_pass` to PASS?*

To answer this honestly, PR#18af enumerates **all** candidate targets (§5), classifies each (§5.7 table), and reports for each whether it can be exercised, by whom, and for which sub-layer of Gate 4C scope (§6 verdict matrix). PR#18af refuses to collapse the question into a single PASS/BLOCKED boolean when the reality is multi-layered.

---

## 5. Candidate `/v1/event` target enumeration

### 5.1 Candidate A — Hetzner Sprint 2 `/v1/event` staging endpoint (operator-gated)

**What it is.** The same staging host PR#17x Attempt 3 (2026-05-21) and PR#17z executed against. The Hetzner-class staging deployment of the Sprint 2 `/v1/event` collector, fronted by the operator-confirmable Nginx hop (PR#17x §7.3 / §8.3).

**Classification.** `SAFE_STAGING_TARGET`.

**Reachability from this repo / this session.** Not reachable from this Claude Code session. Requires:
- operator-side shell with `GATE2_*` env vars provisioned per PR#17x §15 (or `GATE3_*` per PR#17y §4),
- staging site-write token in a non-production tenancy,
- staging DSN sanity check (`staging`-class hostname; not `buyerrecon-prod` and not `*.onrender.com`),
- explicit Helen-as-operator GO per PR#17x §6.6 / PR#17z §5.

**Existing PASS evidence (carry-forward).**
- PR#17x §9.1.4: Gate 2 PASS (Attempt 3, 2026-05-21). `ingest +1 / accepted +1 / rejected +0` with `auth_status = ok`, `http_status = 200`, `reject_reason_code = NULL`, `endpoint = /v1/event`. Body shape used: canonical Sprint 2 single-object body per §5.1 fixture (which matches the 8-field shape PR#71 proves AMS emits).
- PR#17z §4: Gate 3 PASS, staging-only DB-backed multi-fixture acceptance.

**What this target proves for Gate 4C scope.** That the Hetzner Sprint 2 `/v1/event` collector accepts the canonical Sprint 2 body shape and persists it correctly to the staging DB. It does **not** prove that the ThinSDK FetchTransport (with `transportOptions.mode = 'sprint2_v1_event'` enabled per PR#71) emits the same body shape over real HTTP to that endpoint — see §5.4 and §5.5.

**Action taken in PR#18af.** None — PR#18af does not re-execute PR#17x or PR#17z. The existing PASS verdicts are cited as carry-forward evidence.

---

### 5.2 Candidate B — In-process vitest harness against `validateEventCore` / `parseEnvelope` / `createV1Router`

**What it is.** The three Sprint 2 collector source-of-truth layers can be exercised inside this Claude Code session by running `npx vitest run tests/v1/validation.test.ts tests/v1/envelope.test.ts tests/v1/routes.test.ts`. `routes.test.ts` uses `node:http` + `global fetch` + Express `createV1Router` with a fake pg pool that records query calls — no real DB, no real network.

**Classification.** `SAFE_LOCAL_TARGET`.

**Reachability from this repo / this session.** Fully reachable. No env vars, tokens, DB, or network access required. The fixture body at `tests/v1/routes.test.ts:178` is a canonical Sprint 2 single-object body with the same 8 required fields PR#71 proves AMS emits when `transportOptions.mode = 'sprint2_v1_event'` is set (the field overlap is enumerated in §5.7.1).

**Local-layer execution evidence (this PR).** Run from `/Users/admin/github/buyerrecon-backend` on branch `buyerrecon-sprint2-pr18af-staging-collector-target-discovery`, base tip `a1668c6`:

```
$ npx vitest run tests/v1/validation.test.ts tests/v1/envelope.test.ts tests/v1/routes.test.ts --reporter=verbose
 RUN  v4.1.4 /Users/admin/github/buyerrecon-backend
 ...
 Test Files  3 passed (3)
      Tests  111 passed (111)
   Start at  12:30:25
   Duration  507ms
```

Of the 111 assertions, the ones that bear directly on Gate 4C body-shape acceptance are:
- `validateEventCore — happy paths > accepts a valid browser page event` — confirms the 8-field Sprint 2 body validates as `{ ok: true }`.
- `parseEnvelope — JSON parse > rejects /v1/event body that is a JSON array (envelope shape) → request_body_invalid_json` — confirms the smoking-gun PR#17s 26-row historical warning is still enforced (legacy array bodies are rejected; only Sprint 2 single-object bodies are accepted).
- `parseEnvelope — batch shape & item count > valid /v1/event returns one event` — confirms `/v1/event` accepts a single-object body and yields exactly one event.
- `POST /v1/event — happy path > returns 200 and writes ingest + accepted rows` — confirms the full route-layer end-to-end (route handler + auth + envelope + validator + persistence stub) returns HTTP 200 against the canonical Sprint 2 body and writes the expected ingest/accepted row pair.

**What this target proves for Gate 4C scope.** That the in-process Sprint 2 collector layers (validator + envelope + route) accept the canonical Sprint 2 body shape and reject the legacy array shape, deterministically and reproducibly inside Claude Code. It does **not** prove anything about HTTP transit, TLS, Nginx fronting, real DB persistence, real auth tokens, or the actual ThinSDK FetchTransport — all of those live outside the in-process harness.

**Action taken in PR#18af.** Executed in this PR. Output cited above. This evidence supports the new `local_route_layer_pass = PASS` verdict in §6.

---

### 5.3 Candidate C — Website PR #3 mock harness (`staging-mock.invalid`)

**What it is.** The website-repo Node-side script at `tools/gate4c-thinsdk-mock-proof.mjs` (per PR #3) that loads `thinlayer/thin-sdk.iife.js`, configures it with a `staging-mock.invalid` `endpointUrl` and `transportOptions.mode = 'sprint2_v1_event'`, intercepts the emitted body without making real HTTP, and asserts the body matches the Sprint 2 single-object shape.

**Classification.** `MOCK_ONLY_TARGET`.

**Reachability from this repo / this session.** Lives in the website repo (`KeigenTechnologies-buyerrecon-website`). Not directly executable from the backend repo, but its evidence is already recorded by PR #3.

**Existing PASS evidence (carry-forward).** PR #3 establishes `mock_validator_pass = PASS` — the AMS ThinSDK source emits a body matching the Sprint 2 contract. PR#18ai aggregates this into the `mock_validator_pass = PASS` slot.

**What this target proves for Gate 4C scope.** That the ThinSDK (per AMS commit `13d4900`, the commit PR#71 pins) emits a body shape matching the Sprint 2 contract when `transportOptions.mode = 'sprint2_v1_event'` is set. It does **not** prove that the body reaches a real endpoint — `staging-mock.invalid` is an unreachable hostname by design.

**Action taken in PR#18af.** Not exercised — PR#18af is backend-side and does not re-run website-side harnesses. PR #3's `mock_validator_pass = PASS` is cited as carry-forward.

---

### 5.4 Candidate D — A hypothetical non-production website deployment carrying the PR #4 config, aimed at the Hetzner Sprint 2 `/v1/event` staging endpoint

**What it is.** A non-production website host that:
- carries the PR #4 patch (`transportOptions.mode = 'sprint2_v1_event'` in `thinlayer/br-thinlayer-init.js`),
- has `endpointUrl` aimed at the Hetzner Sprint 2 `/v1/event` staging endpoint (Candidate A),
- runs an actual browser session (Playwright, Cypress, or manual browser) under `tracking_mode = 'full'` to fire events,
- so that the full ThinSDK FetchTransport → HTTP → staging Nginx → staging Sprint 2 collector → staging DB chain can be exercised end-to-end without touching production.

**Classification.** `SAFE_STAGING_TARGET` if it exists; `UNKNOWN_UNSAFE` otherwise.

**Reachability from this repo / this session.** Unknown. PR#18af did not search the website repo or the operator's deployment topology for such a host. The PR#18ai planning section mentions that Track A and Playwright are explicitly deferred (`track_a_required_for_gate4 = false`, `playwright_required_for_gate4 = false`) so this target is *not required* by Gate 4C scope. But if Helen wants to upgrade `staging_collector_pass` (ThinSDK→HTTP junction) from BLOCKED to PASS without invoking Helen-as-operator-GO, this is the only path.

**Existing PASS evidence.** None. This target has never been built.

**What this target would prove for Gate 4C scope.** Full ThinSDK → HTTP → staging junction. Eliminates the ThinSDK→HTTP gap that PR #3 mock harness cannot close and that PR#17x/PR#17z body-shape acceptance does not address.

**Action taken in PR#18af.** None. PR#18af enumerates this candidate honestly but does not construct it. A separate engineering ticket would be needed.

---

### 5.5 Candidate E — buyerrecon.com `/v1/event` production endpoint

**Classification.** `PRODUCTION_FORBIDDEN`.

**Rationale.** Hard-gated by `docs/ops/cutover-hard-gates.md` §8 stop-line conditions and PR#17x §4.1 endpoint safety checks. Hitting buyerrecon.com `/v1/event` would constitute production traffic and is categorically out of scope for *any* gate pre-Gate-4C/4D/4E PASS.

**Action taken in PR#18af.** None. Enumerated for completeness only.

---

### 5.6 Candidate F — Render legacy `/collect` endpoint (`buyerrecon-backend.onrender.com/collect`)

**Classification.** `PRODUCTION_FORBIDDEN`.

**Rationale.** The Render legacy collector is the current production endpoint that `buyerrecon.com` `endpointUrl` points at (per PR#17x §1: *"`endpointUrl` remains on Render legacy"*). It is production traffic. There is no non-production Render-class legacy collector identified anywhere in the governance docs.

**Action taken in PR#18af.** None. This candidate is the source of the `legacy_collect_tolerance` BLOCKED verdict in §6 — there is no safe target to probe legacy tolerance against without touching production.

---

### 5.7 Classification summary

| Candidate | Target | Classification | Layer it proves | Status |
| --- | --- | --- | --- | --- |
| A | Hetzner Sprint 2 `/v1/event` staging | `SAFE_STAGING_TARGET` | body-shape acceptance + staging DB write | PASS (PR#17x Gate 2 + PR#17z Gate 3, carry-forward only) |
| B | In-process vitest (`validateEventCore` / `parseEnvelope` / `createV1Router`) | `SAFE_LOCAL_TARGET` | in-process validator + envelope + route | PASS (this PR, 111/111) |
| C | PR #3 `staging-mock.invalid` mock harness | `MOCK_ONLY_TARGET` | AMS ThinSDK → body shape | PASS (PR #3, carry-forward) |
| D | Non-prod website + PR #4 config + Hetzner staging endpoint + browser session | `SAFE_STAGING_TARGET` if built; otherwise N/A | full ThinSDK → HTTP → staging junction | does not exist; not built by PR#18af |
| E | `buyerrecon.com/v1/event` | `PRODUCTION_FORBIDDEN` | n/a | hard-gated; never exercised |
| F | `buyerrecon-backend.onrender.com/collect` | `PRODUCTION_FORBIDDEN` | n/a | hard-gated; never exercised |

#### 5.7.1 Field-overlap check — Candidate B's `validEvent()` vs PR#71's documented ThinSDK emit shape

PR#71 (`docs/sprint2-pr18ae-supplement-thinsdk-option-key-proof.md`) documents that AMS commit `13d4900` `thinsdk/sprint2-envelope.ts` emits a single-object body with the 8 required Sprint 2 fields. Candidate B's `tests/v1/routes.test.ts:178 validEvent()` includes all 8:

| Sprint 2 required field (PR#71) | Present in `validEvent()` at L178–L201 | Type |
| --- | --- | --- |
| `event_name` | yes (`'page_view'`) | string |
| `schema_key` | yes (`'br.page'`) | non-empty string |
| `schema_version` | yes (`'1.0.0'`) | three-component semver |
| `client_event_id` | yes (`'f47ac10b-58cc-4372-a567-0e02b2c3d479'`) | UUIDv4 |
| `event_type` | yes (`'page'`) | in {page, track, identify, group, system, debug} |
| `event_origin` | yes (`'browser'`) | matrix-consistent with `event_type` |
| `occurred_at` | yes (`new Date(Date.now() - 60_000).toISOString()`) | ISO string inside (-24h, +5min) window |
| `session_id` | yes (`'sess_alpha'`) | mandatory for browser origin |

Additional non-required fields in `validEvent()`: `anonymous_id`, `page_url`, `page_path`, `consent_state`, `consent_source`, `tracking_mode`, `storage_mechanism`. These are accepted by the validator (they fall outside the 8 required slots and are passed through to persistence). The presence of the 8 required slots is what matters for the body-shape acceptance verdict.

The conjunction of PR#71 (AMS emits these 8 fields) + PR#18af Candidate B vitest happy-path PASS (the backend accepts these 8 fields) closes the AMS↔backend body-shape compatibility loop *structurally*, but not *over HTTP* (that gap is what Candidate D would close).

---

## 6. Verdict matrix

| Verdict slot | State | Evidence | Why this verdict |
| --- | --- | --- | --- |
| `mock_validator_pass` | PASS | PR #3 (`mock_validator_pass = PASS`), PR#18ai §x carry-forward, PR#71 AMS commit `13d4900` pin | Mock ThinSDK harness confirms the AMS source emits the Sprint 2 body shape under `transportOptions.mode = 'sprint2_v1_event'`. |
| `staging_collector_pass` (body-shape acceptance layer) | **PASS** (carry-forward) | PR#17x §9.1.4 Gate 2 PASS Attempt 3 (2026-05-21); PR#17z §4 Gate 3 PASS | Hetzner Sprint 2 `/v1/event` staging endpoint accepts the canonical Sprint 2 single-object body and persists it correctly to the staging DB. This is the same body shape PR#71 proves AMS emits. |
| `staging_collector_pass` (ThinSDK→HTTP junction layer) | BLOCKED_PENDING_NON_PROD_WEBSITE_DEPLOYMENT_WITH_PR4_CONFIG_AND_HELEN_GO | Candidate D in §5.4 — not built | Cannot be PASSed by docs, by in-process tests, or by carry-forward citation. Requires either a non-production website host carrying the PR #4 config aimed at Hetzner staging plus a browser session, or explicit Helen-as-operator GO to deem the existing structural composition (PR#71 ⊕ PR#17x ⊕ PR#17z ⊕ PR #3) sufficient for Gate 4C scope. |
| `local_route_layer_pass` | **PASS** (this PR) | `npx vitest run tests/v1/{validation,envelope,routes}.test.ts` — 111/111 tests pass on base tip `a1668c6` | In-process validator + envelope + route layers accept the canonical Sprint 2 body and reject the legacy array body. New verdict slot enumerated to record what PR#18af actually proved in this session, separate from the older verdict labels. |
| `legacy_collect_tolerance` | BLOCKED_PENDING_SAFE_LEGACY_TARGET | Candidate F (`/collect` on Render) is PRODUCTION_FORBIDDEN; no non-production Render-class legacy collector exists | There is no safe target against which legacy `/collect` tolerance can be exercised. This BLOCKED is categorical and unchanged by PR#18af. |

**Aggregated Gate 4C readiness verdict: BLOCKED_PENDING_HELEN_GO.** The body-shape acceptance layer is now PASS via carry-forward; the in-process layer is now PASS; the AMS option-key layer is PASS (PR#71); the mock harness layer is PASS (PR #3). The only remaining gap is the ThinSDK→HTTP junction layer, which requires either Candidate D construction or explicit Helen GO to proceed without it.

---

## 7. Rationale per verdict-matrix row

### 7.1 Why `mock_validator_pass` remains PASS unchanged
PR#18af does not exercise the PR #3 mock harness; it cites the existing PR #3 evidence as carry-forward. The PR #3 verdict was correct at the time of merge and is unaffected by anything in this PR. PR #71 (AMS commit pin) was added downstream of PR #3 and strengthens the carry-forward by binding the harness's expected shape to a categorical AMS source commit.

### 7.2 Why `staging_collector_pass` (body-shape) is now PASS
PR#18ai marked `staging_collector_pass = BLOCKED_PENDING_SAFE_STAGING_TARGET` because it was conservatively scoped to "has a fresh staging execution been performed against the PR #4-equipped ThinSDK?". PR#18af refines the scope into two sub-layers and observes that:
- the *body-shape acceptance* sub-layer **has already been exercised twice** against the Hetzner staging Sprint 2 `/v1/event` endpoint — by PR#17x Attempt 3 (Gate 2 PASS) and by PR#17z (Gate 3 PASS) — both with the canonical Sprint 2 single-object body shape;
- those PASSes are carry-forward evidence that the staging collector accepts the body shape PR#71 proves AMS emits.

PR#18af does **not** claim that PR#17x / PR#17z executed the actual ThinSDK FetchTransport. They executed `curl --data-binary` (or fetch-equivalent) against the staging endpoint with a hand-crafted body that matches the PR#71-documented ThinSDK emit shape. That is a *structural* equivalence, not an *executional* one. The body-shape acceptance verdict is upgraded to PASS on structural grounds; the executional gap is what Candidate D would close.

### 7.3 Why `staging_collector_pass` (ThinSDK→HTTP junction) is BLOCKED
Closing this gap requires real HTTP transit by a real ThinSDK build. None of:
- PR#71 (read-only inspection of AMS source — no HTTP),
- PR #3 (mock harness, `staging-mock.invalid` — no HTTP),
- PR#17x / PR#17z (curl/fetch with hand-crafted body — HTTP yes, but not via ThinSDK),
- PR#18af Candidate B (vitest in-process — no HTTP)

exercises the full ThinSDK → HTTP → staging junction. Only Candidate D (a non-prod website carrying the PR #4 config, aimed at the Hetzner staging endpoint, driven by a browser session) would. PR#18af does not build Candidate D — that would be a separate non-docs PR with significant scope. Instead, PR#18af reports BLOCKED honestly and identifies the exact unmet condition.

If Helen judges that the structural composition (PR#71 ⊕ PR#17x ⊕ PR#17z ⊕ PR #3 ⊕ PR#18af local-layer PASS) is sufficient for Gate 4C — i.e., that the ThinSDK→HTTP gap is structurally closed even without a Candidate D execution — that is a Helen-GO decision recordable in a follow-up PR. PR#18af does not preempt that decision.

### 7.4 Why `local_route_layer_pass = PASS` is enumerated as a new verdict slot
PR#18ai did not enumerate this slot. PR#18af adds it because the in-process vitest evidence is the only *new* execution this discovery PR produced, and it must be recorded distinctly so it is not conflated with the older `staging_collector_pass` slot (which is about a *staging* target, not a *local in-process* one). Conflating them would be dishonest. Adding a new verdict slot is the correct way to record what was actually proven.

### 7.5 Why `legacy_collect_tolerance` remains BLOCKED
There is no non-production Render-class legacy `/collect` endpoint identified in any governance doc. The legacy `/collect` collector exists only in production (`buyerrecon-backend.onrender.com/collect`). The label is sharpened from `BLOCKED_PENDING_SAFE_STAGING_TARGET` (PR#18ai) to `BLOCKED_PENDING_SAFE_LEGACY_TARGET` (PR#18af) because the missing condition is specifically a *legacy*-class safe target, not just any staging target — the Hetzner Sprint 2 endpoint does not have legacy `/collect` shape support and would not be the right target even if reachable. Sharpening this label does not represent a substantive change.

---

## 8. What PR#18af does NOT promote

PR#18af does **not** approve, recommend, or imply:
- that Gate 4C is ready to execute,
- that the website PR #3 should be merged,
- that the website PR #4 should be merged,
- that `endpointUrl` should be re-flipped from Render legacy to Hetzner Sprint 2 production,
- that the production buyerrecon.com `/v1/event` endpoint should receive traffic,
- that Track A or Playwright should be invoked,
- that any production DB grant should be changed,
- that any customer-facing surface should be activated,
- that the AMS commit pin (`13d4900`) should be updated,
- that the PR#17s 26-row historical warning rule should be touched,
- that any of the eleven PR#18ab governance locks should be relaxed.

PR#18af is a docs-only discovery artifact. The aggregated Gate 4C verdict remains BLOCKED_PENDING_HELEN_GO.

---

## 9. Next-step options (presented; not recommended)

If Helen wants to move toward Gate 4C execution, the two available paths are:

### 9.1 Path α — Helen GO on structural composition (no new build)
Helen treats PR#71 ⊕ PR#17x ⊕ PR#17z ⊕ PR #3 ⊕ PR#18af (this PR) as a sufficient structural proof set for Gate 4C, and opens a Helen-GO PR (e.g., `PR#18ag`) recording the decision and approving Gate 4C execution. The ThinSDK→HTTP junction remains structurally implied rather than executionally proven. Tradeoff: faster, but accepts structural inference where Helen previously required execution.

### 9.2 Path β — Build Candidate D before Gate 4C
A separate engineering PR builds a non-production website host carrying the PR #4 config aimed at Hetzner staging, runs a browser session (manually or via Playwright — the latter is currently locked off by PR#18ab `playwright_required_for_gate4=false` but could be temporarily lifted for the proof and re-locked), and records executional PASS for the ThinSDK→HTTP junction. Tradeoff: slower, but eliminates the structural-inference gap.

PR#18af makes no recommendation between α and β. Both paths require explicit Helen GO.

---

## 10. PR boundaries and rollback

- PR#18af touches exactly one file: `docs/sprint2-pr18af-staging-collector-target-discovery.md` (this file).
- Rollback: `git revert <merge_commit>` is non-destructive. No DB state, no infra state, no bundle state, no AMS state is affected by this PR.
- This PR does NOT modify:
  - any `src/` file,
  - any `tests/` file,
  - any other `docs/` file,
  - any `package.json` / `vitest` configuration,
  - any AMS commit pin,
  - any website file,
  - any production endpoint / token / DB.

---

## 11. Hard-boundary block (categorical)

PR#18af approves nothing beyond the recording of the discovery and the local-layer PASS evidence.

- No Gate 4C execution.
- No endpointUrl re-flip.
- No PR #3 / PR #4 merge.
- No bundle deploy.
- No `/var/www` edit.
- No DB grant change.
- No production endpoint contacted.
- No production token used.
- No production DB touched.
- No `legacy_collect_tolerance` upgrade.
- No PR#17s 26-row historical warning touched.
- No PR#18ab governance lock relaxed.
- No customer-facing surface activated.
- No AMS commit re-pin.
- No Track A / Playwright invocation.
- No Lane A/B writer activation.
- No raw token / Authorization header / `request_id` UUID value / raw response body / DSN / pepper / `token_hash` printed.

Each subsequent gate requires its own explicit Helen GO.

---

## 12. Final verdict

**Aggregated Gate 4C readiness: BLOCKED_PENDING_HELEN_GO.**

Underlying verdict-matrix changes vs PR#18ai:
- `mock_validator_pass = PASS` (carry-forward, unchanged)
- `staging_collector_pass` (body-shape acceptance) = **PASS** (upgraded via PR#17x + PR#17z carry-forward)
- `staging_collector_pass` (ThinSDK→HTTP junction) = BLOCKED_PENDING_NON_PROD_WEBSITE_DEPLOYMENT_WITH_PR4_CONFIG_AND_HELEN_GO (newly enumerated)
- `local_route_layer_pass` = **PASS** (newly proven, vitest 111/111)
- `legacy_collect_tolerance` = BLOCKED_PENDING_SAFE_LEGACY_TARGET (label sharpened; substance unchanged)
