# BuyerRecon Sprint 2 PR#18af (continuation) — Gate 4C Path β Non-Production Browser Proof Plan (Planning Only)

Status: **planning-only runbook. Verdict: PLANNING_ONLY — no execution approved, no website runtime/config change, no production traffic, no endpointUrl re-flip, no Gate 4C execution. Aggregated Gate 4C readiness verdict remains BLOCKED_PENDING_HELEN_GO. See §1 and §13.**

PR#18af-Path-β is the docs-only planning step opened by the PR#73 (PR#18af staging-collector-target discovery) closing recommendation: *"next step is Path β planning unless Helen explicitly chooses Path α."* Helen has not chosen Path α. This PR therefore drafts the Path β runbook so the remaining Gate 4C proof gap — `staging_collector_pass (ThinSDK→HTTP junction) = BLOCKED` — has a concrete, executable, hard-bounded plan that can be re-reviewed and (with explicit Helen GO) later executed.

This file does not:
- modify `thinlayer/br-thinlayer-init.js`,
- modify `thinlayer/thin-sdk.iife.js`,
- modify any other website file,
- modify any `endpointUrl` configured anywhere,
- modify the AMS commit pin (`13d4900`) recorded by PR#71,
- modify any backend source / test / migration / schema / DB script,
- merge website PR #3 (`gate4c-staging-mock-thinsdk-proof`),
- merge website PR #4 (`transportOptions.mode = 'sprint2_v1_event'`),
- approve or execute Gate 4C,
- approve or execute any endpoint flip on buyerrecon.com,
- approve or execute any non-production website deployment,
- approve or execute any Playwright run,
- approve or execute any DB grant change, `/var/www` edit, bundle deploy, or production probe,
- relax any of the eleven PR#18ab governance locks,
- approve any customer-facing surface, Lane A/B writer, AMS Trust / Pass 1 / Pass 2, Sprint 4 governance runtime (PR#19c), Sprint 5 internal learning (PR#19d), or Sprint 3 external report MVP (PR#20).

> **No Gate 4C execution.**
> **No endpointUrl re-flip.**
> **No PR #3 / PR #4 merge.**
> **Website PR #3 remains HOLD. Website PR #4 remains HOLD.**
> **No production endpoint, no production token, no production DB.**
> **No deploy. No `/var/www` edit. No DB grant change.**
> **No Playwright execution. No Track A invocation. No Lane A/B writer activation.**
> **No customer-facing surface. No AMS commit re-pin.**
> **Path α and Path β both require explicit Helen GO. Path β is the stronger executional proof path because it eliminates the ThinSDK→HTTP structural-inference gap.**

---

## 1. Status / verdict

**Final verdict: PLANNING_ONLY.** This PR is a runbook draft. No part of the runbook is executed by this PR. The aggregated Gate 4C readiness verdict remains **BLOCKED_PENDING_HELEN_GO**.

PR#73 (`docs/sprint2-pr18af-staging-collector-target-discovery.md`) left the verdict matrix as:

| Verdict slot | State |
| --- | --- |
| `mock_validator_pass` | PASS (PR #3 carry-forward) |
| `staging_collector_pass` (body-shape acceptance) | PASS (PR#17x Gate 2 + PR#17z Gate 3 carry-forward) |
| `staging_collector_pass` (ThinSDK→HTTP junction) | BLOCKED_PENDING_NON_PROD_WEBSITE_DEPLOYMENT_WITH_PR4_CONFIG_AND_HELEN_GO |
| `local_route_layer_pass` | PASS (PR#18af vitest 111/111) |
| `legacy_collect_tolerance` | BLOCKED_PENDING_SAFE_LEGACY_TARGET |

Path β closes only one row of this matrix: `staging_collector_pass (ThinSDK→HTTP junction)`. It does **not** unblock `legacy_collect_tolerance`, does **not** authorise any further gate, and does **not** approve Gate 4C even after a hypothetical Path β PASS — Gate 4C PASS still requires the combined endpoint-flip readiness review (PR#18ac §10.1) plus explicit Helen GO.

### What is in scope of this PR

- Definition of "Candidate D" (the non-production website surface required by Path β).
- Safe endpoint classification — what target a Path β execution may legitimately call, expressed in token-redacted prose only.
- Browser proof flow — the exact deterministic sequence a future Path β execution must follow.
- Evidence capture rules — redacted, structural-only.
- PASS / BLOCKED criteria — categorical and pre-stated, so the verdict cannot be retro-justified.
- Legacy `/collect` tolerance handling — confirmation that Path β does not address it.
- Rollback / stop-line block — carry-forward of PR#18z rollback bundle and the emergency kill switch.
- Governance carry-forward — PR#17s / PR#18w 26-row baseline, PR#19c / PR#19d / PR#20 lock-off, Gate 4D / 4E out-of-scope, Gate 4F not invented.

### What is NOT in scope of this PR

- No execution of any step in the runbook.
- No identification of a specific non-production website host (deployment topology is operator-owned).
- No identification of a specific Hetzner staging endpoint URL (the URL category is `staging-class /v1/event`; the precise URL is operator-confirmed at execution time per PR#17x §15).
- No token, no Authorization header, no DSN, no `request_id` UUID value, no raw payload, no raw `session_id`.
- No recommendation about whether Helen should pick Path α or Path β. PR#73 already recorded that Path β is the stronger executional proof path while requiring explicit Helen GO; this PR does not re-litigate that.

---

## 2. Mandatory reference compliance

PR#18af-Path-β honors the hard-gate references in `docs/ops/cutover-hard-gates.md` and the eleven PR#18ab governance locks. None are touched:

| Lock | State |
| --- | --- |
| `customer_claim_allowed=false` | unchanged |
| `coupon_gate_allowed=false` | unchanged |
| `playwright_required_for_gate4=false` | unchanged (Path β proposes Playwright *for proof scope only*, not for Gate 4 as a whole; the lock remains in place) |
| `track_a_required_for_gate4=false` | unchanged |
| `gnn_in_phase_1=false` | unchanged |
| `black_box_in_phase_1=false` | unchanged |
| `mock_substitutes_for_acceptance=false` | unchanged (Path β proof must be browser-driven, not mock) |
| `single_doc_substitutes_for_acceptance=false` | unchanged (this planning doc is not promotion-grade) |
| `allowed_evidence_kinds_outside_local_proof=[]` | unchanged |
| `allowed_promotion_actions_outside_local_proof=[]` | unchanged |
| `allowed_customer_language=[]` | unchanged |

PR#17s §1 and PR#18w §1 — *"the 26 HTTP 400 `request_body_invalid_json` rows from 2026-05-19 are the historical envelope-shape warning. Do not delete, mutate, annotate, or normalise them"* — are upheld categorically. Path β proof does not touch the 26-row baseline; canary success under any subsequent gate is measured as a *delta from* the 26-row baseline, never *by mutating* it.

---

## 3. Inputs and provenance

Base branch: `sprint2-architecture-contracts-d4cc2bf` at tip `a30fde0` ("Sprint 2 PR#18af: clarify staging target discovery posture (#73)").

Read-only provenance underpinning this plan:
- `docs/sprint2-pr18af-staging-collector-target-discovery.md` (PR #73, merged) — §5.4 defines the unbuilt "Candidate D" target; §6 records the BLOCKED row this plan addresses.
- `docs/sprint2-pr18ai-pre-gate4c-readiness-review.md` (PR #72, merged) — pre-Gate-4C aggregated readiness review; §x cites the rollback bundle and the `window.__BR_THIN_DISABLED` emergency kill switch.
- `docs/sprint2-pr18ae-supplement-thinsdk-option-key-proof.md` (PR #71, merged) — AMS commit `13d4900` proves `transportOptions.mode = 'sprint2_v1_event'` is the canonical option key; pins website Sprint2-capable artifact hash `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`.
- `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` (PR #63, merged) — Gate 4C scope; §6.2 ThinSDK transport requirement (FetchTransport, not sendBeacon); §10.1 Gate 4C PASS criteria; §6.6 rollback bundle reference.
- `docs/sprint2-pr18ad-gate1-contract-diff-confirmation.md` (PR #65, merged) — Gate 1 static contract diff carry-forward.
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 PASS (Attempt 3, 2026-05-21) against the Hetzner staging Sprint 2 `/v1/event` endpoint; §15 token-provisioning runbook.
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 planning runbook; §10.1 acceptance criteria.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 PASS, staging-only DB-backed multi-fixture acceptance.
- `docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md` — Gate 4A DB grant / traffic re-audit; the 26-row baseline reference paired with PR#17s.
- Website repo (read-only reference) — PR #3 (`docs/gate4c-staging-mock-thinsdk-proof.md` + `tools/gate4c-thinsdk-mock-proof.mjs`); PR #4 (3-line ThinSDK `transportOptions.mode` patch in `thinlayer/br-thinlayer-init.js`).

---

## 4. Candidate D environment definition

PR#73 §5.4 defined Candidate D as the unbuilt non-production target. This section pins exactly what Candidate D must be for a Path β execution to be valid.

### 4.1 Candidate D — required properties (all must hold)

A non-production website surface qualifies as Candidate D iff:

1. **Surface class.** Non-production by hostname and by deployment ownership. Examples of acceptable surface class: a Playwright-driven local dev server on `http://localhost:NNNN`; a preview/staging website deployment under a clearly non-production hostname owned by Keigen Technologies. Examples of unacceptable surface class: `buyerrecon.com`, `www.buyerrecon.com`, or any host whose DNS / TLS / analytics surface is customer-reachable.
2. **SDK artifact.** Carries the Sprint2-capable `thinlayer/thin-sdk.iife.js` artifact pinned by PR#71, sha256 `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`. No alternate build. No locally-rebuilt variant.
3. **ThinSDK init config.** Carries either (a) the literal PR #4 patch (`transportOptions: { mode: 'sprint2_v1_event' }` added to `br-thinlayer-init.js`), or (b) an isolated proof-only init file that loads the same SDK artifact and sets the same `transportOptions.mode = 'sprint2_v1_event'`. The isolated proof-only init file MUST NOT replace the production `br-thinlayer-init.js` on any production-class host; it lives only in the Candidate D surface.
4. **endpointUrl pinning.** `endpointUrl` configured on the loaded ThinSDK instance points only at a documented non-production target per §5. No production `/v1/event`, no production `/collect`, no Render legacy endpoint.
5. **Consent gate.** `window.buyerreconConsent.check()` (or equivalent consent surface as the SDK requires) is satisfied by the Candidate D test harness deterministically and only for the controlled proof event. Path β does NOT exercise organic consent flows.
6. **Driver.** A browser automation driver (Playwright recommended; Cypress, Puppeteer, or a manual Chrome session under operator control are alternates) that issues one (1) deterministic page load + one (1) controlled trigger event. The driver MUST NOT enable scheduled telemetry, MUST NOT enable user-simulated interaction loops, and MUST NOT enable bulk fixture replay.
7. **Network isolation.** Candidate D execution MUST run on an operator-controlled network where outgoing traffic to buyerrecon.com `/v1/event`, `buyerrecon-backend.onrender.com/collect`, and any production-class endpoint is *blocked or proven absent* (operator-confirmed at execution time). Path β is staging-only by construction; this isolation invariant is one of the §10 stop-lines.

### 4.2 Candidate D — what it is NOT

- NOT a deploy of website PR #3 or PR #4 to any production-class host. PR #3 and PR #4 remain HOLD.
- NOT an `endpointUrl` change on buyerrecon.com. Production `endpointUrl` stays on Render legacy `/collect` until Gate 4C is independently authorised under PR#18ac §10.1.
- NOT a `/var/www` edit on the production Nginx host.
- NOT a customer-facing surface in any form.
- NOT a Lane A/B writer activation.
- NOT a Track A invocation.
- NOT an AMS Trust / Pass 1 / Pass 2 runtime activation.
- NOT a Sprint 4 (PR#19c) governance runtime activation.
- NOT a Sprint 5 (PR#19d) internal-learning runtime activation.
- NOT a Sprint 3 (PR#20) external-report runtime activation.
- NOT a runtime scoring path.

### 4.3 Candidate D — operator preconditions

Before Path β can be executed, the operator (Helen) must confirm — in a follow-up PR that records the confirmation — each of the following:

- a Candidate D surface exists that satisfies §4.1.1–§4.1.7;
- the Sprint2-capable SDK artifact hash `048d1d23…` is verifiably present on that surface;
- the ThinSDK init config on that surface carries `transportOptions.mode = 'sprint2_v1_event'` (per §4.1.3);
- a documented non-production staging `/v1/event` endpoint per §5 is available and reachable from the Candidate D surface;
- the operator-side network isolation invariant (§4.1.7) holds at execution time;
- the operator-side rollback bundle (§10) is present and not stale.

If any precondition fails, Path β execution is BLOCKED and the verdict remains BLOCKED_PENDING_HELEN_GO.

---

## 5. Safe endpoint classification

Path β execution must target an endpoint of a specific class. This section uses redacted prose only — no URL, no token, no DSN, no Authorization header.

### 5.1 Approved target class

| Class | Description | Source of authority |
| --- | --- | --- |
| `staging-class /v1/event` | The Hetzner staging Sprint 2 collector `/v1/event` endpoint previously proven by PR#17x Attempt 3 (Gate 2 PASS, 2026-05-21) and PR#17z (Gate 3 PASS). The same host, the same TLS cert class, the same Nginx fronting (per PR#17x §7.3 / §8.3), the same staging DB tenancy. | PR#17x §15 token-provisioning runbook; PR#17z §4 execution audit trail. |

### 5.2 Forbidden target classes

| Class | Why forbidden |
| --- | --- |
| `production /v1/event` (`buyerrecon.com/v1/event`) | Customer-reachable; hard-gated by `docs/ops/cutover-hard-gates.md` §8 stop-lines and PR#17x §4.1 endpoint safety. Hitting this endpoint constitutes production traffic. |
| `production /collect` (`buyerrecon-backend.onrender.com/collect`) | Render legacy production collector. Currently the live target of buyerrecon.com `endpointUrl` per PR#17x §1. Hitting it constitutes production traffic. Out of Path β scope by construction. |
| `unverified third-party` | Any host outside the Keigen Technologies non-production tenancy. Cannot be reached by Path β even for sanity checks. |
| `mock-only target` (`staging-mock.invalid` etc.) | Cannot be reached by HTTP by design. Used only by PR #3 mock harness, not by Path β. |

### 5.3 Secret-handling rules (categorical)

- Path β execution MUST NOT print any raw `Authorization` header value, raw `Bearer` token, raw site-write token, raw site_write_token, raw PEPPER, raw DSN, raw `DATABASE_URL`, raw `postgres://` connection string, raw token_hash, or raw `request_id` UUID value to any log, console, evidence file, PR comment, or commit message.
- Path β execution MAY redact-and-record:
  - the *class* of authorization used (`staging site-write token, redacted`),
  - the *fact* that an Authorization header was present (`Authorization: <redacted>`),
  - the *length category* of the token if useful for sanity (`length in {32, 48, 64}` etc.),
  - the *fact* that the request reached the expected target *class* (per §5.1), not the URL.
- Path β execution MUST follow PR#17x §15 token-provisioning rules. Tokens are operator-provisioned out-of-band; no token is committed to this repo, no token is printed by any planning doc.
- Placeholder / sentinel-value tokens are treated as MISSING per PR#17x §4.2.1 and BLOCK Path β preflight.

---

## 6. Browser proof flow

Path β execution is a deterministic 8-step sequence. Each step has an explicit acceptance check. Failure at any step is a categorical BLOCK; no step-skipping, no retry-without-recording.

### Step 1 — Candidate D surface confirmation
Confirm the Candidate D surface (§4) is live, on a non-production hostname, and carries the Sprint2-capable SDK artifact (`048d1d23…`) plus the `transportOptions.mode = 'sprint2_v1_event'` config (per §4.1.2–§4.1.3). Acceptance: operator-recorded categorical YES.

### Step 2 — Endpoint reachability confirmation
Confirm — without firing a real event — that the Candidate D ThinSDK init has `endpointUrl` pointing at the §5.1 approved target class only. Acceptance: structural inspection of the loaded ThinSDK instance's config object (e.g., via DevTools snapshot redacted to category only) confirms target class is `staging-class /v1/event`.

### Step 3 — Network isolation invariant check
Confirm operator-side network isolation per §4.1.7. Acceptance: operator-recorded categorical YES; outgoing traffic to production endpoints is blocked or proven absent for the duration of the proof.

### Step 4 — Consent gate seed
Set the consent gate deterministically per §4.1.5 so the ThinSDK does not silently suppress the proof event. Acceptance: `window.buyerreconConsent.check()` (or equivalent) returns the value the SDK requires to permit a controlled event.

### Step 5 — Browser session start + page load
The browser automation driver loads the Candidate D surface's primary page exactly once. No additional page transitions. No background polling. Acceptance: page reaches `load` state without uncaught exception in the ThinSDK boot sequence.

### Step 6 — Single controlled event trigger
Trigger exactly one (1) controlled event through the ThinSDK API (e.g., a synthetic `page_view` event or a deterministic `track` event of a fixture name like `gate4c_path_beta_proof_event`). Acceptance: ThinSDK enqueues the event and the FetchTransport invokes a single outgoing HTTP request.

### Step 7 — Outgoing request structural observation
The driver intercepts the outgoing HTTP request via browser-side instrumentation (Playwright `page.on('request')`, Chrome DevTools Protocol, or equivalent) and structurally observes — without storing raw secrets — the following:

- **Transport.** The request is issued by the ThinSDK FetchTransport (per PR#18ac §6.2 requirement: FetchTransport, not sendBeacon).
- **HTTP method.** `POST`.
- **Target.** The request URL matches the §5.1 approved target class (recorded by *class*, not by full URL).
- **Content-Type.** `application/json` (case-insensitive; charset parameter acceptable per backend `isJsonContentType`).
- **Authorization header.** Present (value redacted, recorded only as `Authorization: <redacted>`).
- **Body shape — 5 categorical assertions, all must hold:**
  1. The body is a single top-level JSON object (NOT a top-level JSON array — this is the PR#17s 26-row historical warning rule, restated as a Path β invariant).
  2. The body is NOT wrapped in `{ events: [...] }` (that is the `/v1/batch` envelope shape, not `/v1/event`).
  3. The body contains all 8 required Sprint 2 fields per PR#71 documentation: `event_name`, `schema_key`, `schema_version`, `client_event_id`, `event_type`, `event_origin`, `occurred_at`, `session_id`.
  4. Each field's *type* matches the Sprint 2 contract (per `validateEventCore` Step 1→8 deterministic check order, `src/collector/v1/validation.ts` L163–L175 carry-forward from PR#73 §3): `event_name: string`, `schema_key: non-empty string`, `schema_version: three-component semver string`, `client_event_id: UUIDv4 or UUIDv7 string`, `event_type: one of {page, track, identify, group, system, debug}`, `event_origin: one of {browser, server, system}` and matrix-consistent with `event_type`, `occurred_at: ISO string inside (-24h, +5min) window`, `session_id: non-empty string` (mandatory because `event_origin = browser`).
  5. The body sha256 hash (computed over the raw byte sequence) is recorded — the hash itself is non-secret (it is a one-way digest of redacted-by-redaction-rule structural content), but no raw body bytes are stored alongside it.

### Step 8 — Staging response observation
The Hetzner staging Sprint 2 collector responds. The driver records the HTTP status code, the response Content-Type, and a *categorical* description of the response body shape (e.g., "OrchestratorOutput.response shape per `src/collector/v1/routes.ts` `/v1/event` happy path"). Path β acceptance: `200 OK` plus categorical confirmation that `accepted_count + rejected_count == 1`. Any other status code, or any `rejected_count == 1`, fails Path β.

Optional Step 8b — Staging DB acceptance verification: if the operator has read-only access to the staging DB per PR#17z §4 (and only if), the operator may run a single deterministic SELECT bound to the proof's `request_id` (recorded categorically; the raw `request_id` UUID value is NOT printed in any evidence file) and confirm exactly one ingest row + one accepted row + zero rejected rows. This step is optional; if omitted, Path β acceptance rests on the HTTP 200 plus `accepted_count == 1` observation alone.

---

## 7. Evidence capture

Path β evidence is **redacted by construction**. Nothing in the evidence file may carry a real secret or a real user-identifier. The evidence file's purpose is to record *structural and categorical observations*, not to reproduce traffic.

### 7.1 Allowed evidence (categorical / redacted)

- Request URL category (`staging-class /v1/event`), not the full URL.
- HTTP method (`POST`).
- Content-Type header value (`application/json` or `application/json; charset=utf-8`).
- Authorization header presence (`Authorization: <redacted>`).
- Body shape checklist (5 categorical YES/NO per §6 Step 7).
- Body sha256 hash (one-way digest, non-secret; useful for cross-execution reproducibility checks).
- Field names and types per the §6 Step 7.4 enumeration.
- HTTP response status code (`200`, `400`, `401`, `403`, `413`, `415`, `500`, etc.).
- HTTP response Content-Type.
- Categorical response body shape (`OrchestratorOutput.response shape` or `error envelope`).
- Optional staging DB delta if Step 8b was performed: `ingest +1 / accepted +1 / rejected +0`, with `auth_status = ok`, `http_status = 200`, `reject_reason_code = NULL`, `endpoint = /v1/event` — exactly as PR#17x §9.1.4 / PR#17z §4 recorded their PASS evidence.

### 7.2 Forbidden evidence (categorical)

- Raw payload bytes.
- Raw `session_id` value.
- Raw `client_event_id` UUID value.
- Raw `request_id` UUID value.
- Raw response body bytes.
- Raw `Authorization` header value.
- Raw `Bearer` token.
- Raw site-write token.
- Raw `SITE_WRITE_TOKEN`, `PEPPER`, `DATABASE_URL`, `postgres://` connection string, DSN.
- Raw `token_hash`.
- Raw user-identifying fields (`anonymous_id`, `user_id` if present, IP, UA string).
- Raw URL of the staging endpoint (record by class only).
- Screenshots that include any of the above.
- Console / network panel exports that include any of the above without redaction.

### 7.3 Evidence-file conventions

- Evidence is recorded in a single Markdown file under `docs/`, named (suggestively) `sprint2-pr18af-path-beta-execution-evidence.md` when Path β is later executed (NOT in this PR).
- The execution-evidence PR is a separate, post-Path-β PR opened only with explicit Helen GO after Path β has actually run.
- This PR (the planning PR) does NOT pre-populate any evidence file. Evidence does not exist yet.

---

## 8. PASS / BLOCKED criteria

Path β verdict is binary at the row it addresses. Adjacent rows in the §1 verdict matrix are NOT affected by Path β execution.

### 8.1 `staging_collector_pass (ThinSDK→HTTP junction)` = **PASS** iff ALL of the following hold

1. Candidate D preconditions §4.3 categorically confirmed.
2. Step 1–7 of the §6 browser proof flow execute without BLOCK.
3. Step 7's 5 body-shape categorical assertions all hold YES.
4. Step 8 returns HTTP `200` with `accepted_count + rejected_count == 1` and `rejected_count == 0`.
5. Optional Step 8b — if performed — confirms `ingest +1 / accepted +1 / rejected +0` for the proof's `request_id` (recorded categorically).
6. No secret of any class enumerated in §7.2 was printed.
7. No stop-line of any class enumerated in §10 was crossed.

### 8.2 `staging_collector_pass (ThinSDK→HTTP junction)` = **BLOCKED** iff ANY of the following hold

- Any §4.3 precondition fails.
- Any §6 step's acceptance check fails.
- Any §7.2 forbidden evidence is observed in any artifact.
- Any §10 stop-line is crossed.
- The body shape fails any of the 5 categorical assertions in §6 Step 7.
- The HTTP status code is anything other than `200`.
- The Step 8 `rejected_count` is non-zero.
- The Candidate D surface cannot be confirmed as non-production-class.

### 8.3 What PASS does NOT mean

A Path β PASS does **not** mean:

- Gate 4C is approved. Gate 4C PASS is a separate, downstream verdict per PR#18ac §10.1 that aggregates Path β PASS with Gate 4A PASS (PR#18w), Gate 4B PASS, Gate 1 confirmation (PR#18ad), AMS option key proof (PR#71), mock harness PASS (PR #3), and Helen GO.
- `mock_validator_pass` alone is sufficient — it is not.
- The body-shape acceptance carry-forward alone is sufficient — it is not.
- The `local_route_layer_pass` alone is sufficient — it is not.
- `legacy_collect_tolerance` is upgraded. Path β does not address legacy `/collect` (see §9).
- Any production endpoint, traffic, or surface is approved. Production remains untouched.

### 8.4 What BLOCKED means

A Path β BLOCKED preserves the PR#73 row state verbatim: `staging_collector_pass (ThinSDK→HTTP junction) = BLOCKED_PENDING_NON_PROD_WEBSITE_DEPLOYMENT_WITH_PR4_CONFIG_AND_HELEN_GO`. No fallback verdict. No mock-substitutes-for-acceptance. The aggregated Gate 4C verdict stays BLOCKED_PENDING_HELEN_GO.

If a Candidate D surface or a safe staging target cannot be produced operationally, the verdict reverts to **BLOCKED_PENDING_SAFE_STAGING_TARGET** — the same category PR#72 originally recorded. Path β does not invent a target; it only proves against one that already exists.

---

## 9. Legacy `/collect` tolerance handling

Path β does **not** address `legacy_collect_tolerance`. The reasons are categorical:

- The Render legacy `/collect` collector exists only in production (`buyerrecon-backend.onrender.com/collect`). It is hard-gated by `docs/ops/cutover-hard-gates.md` §8.
- No non-production Render-class legacy collector exists in any governance doc (PR#73 §5.6 enumerated and ruled out this target as PRODUCTION_FORBIDDEN).
- A mock-only legacy `/collect` (analogous to the PR #3 mock for `/v1/event`) would not constitute promotion-grade evidence per PR#18ab `mock_substitutes_for_acceptance=false`.

Path β therefore leaves `legacy_collect_tolerance = BLOCKED_PENDING_SAFE_LEGACY_TARGET` unchanged.

### 9.1 Implication for Gate 4C scoping

Gate 4C as scoped by PR#18ac §10.1 can in principle be approved by Helen on a **combined mode + endpoint** path (the website ThinSDK switches both `transportOptions.mode = 'sprint2_v1_event'` AND `endpointUrl = staging-class /v1/event` simultaneously) **without** legacy `/collect` tolerance, because the new path does not need to remain bilingual with the legacy collector once endpointUrl flips off Render legacy. However:

- This is a Helen-GO decision, not a Path β automatic consequence.
- It requires explicit Helen approval recorded in a separate PR (e.g., a future PR#18ag).
- Path β does not preempt or recommend this. PR#73 §9 already documented Path α and Path β; the combined-path option is a Helen-only judgment.

---

## 10. Rollback / stop-lines

### 10.1 Rollback bundle (carry-forward — not modified by this PR)

The on-host rollback bundle from PR#18z remains available:

```
/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/
  ROLLBACK-PROCEDURE.md
  <bundle artifacts per PR#18z>
```

Rollback semantics for any *future* `br-thinlayer-init.js` config change (PR #4 itself, or any Path β-derived isolated proof config) are:

- **One-file revert.** The config change is a 3-line diff in `thinlayer/br-thinlayer-init.js`. Reverting is a single-file `git revert` plus a single redeploy of the website bundle. No DB rollback. No schema rollback. No data rollback.
- **Emergency kill switch.** `window.__BR_THIN_DISABLED = true` (set by hand at runtime, or by a 1-line ThinLayer init flag) immediately disables the ThinSDK at the page level. Documented in PR#17t §1 ("`window.__BR_THIN_DISABLED`") and re-cited by PR#72 §x.
- **Bundle restore.** If a non-prod deploy is needed and goes wrong, restore from the PR#18z bundle per the bundle's `ROLLBACK-PROCEDURE.md`. This is operator-only.

This planning PR does **not** deploy anything and does **not** invoke the rollback bundle. The rollback bundle is referenced so a future Path β executor has it available pre-staged.

### 10.2 Stop-lines (categorical — failing any of these BLOCKS Path β immediately)

Path β execution must STOP and record BLOCKED if any of the following occurs:

- Any production endpoint is contacted (`buyerrecon.com/v1/event`, `buyerrecon-backend.onrender.com/collect`, or any production-class host).
- Any `/var/www` file is edited on any production-class host.
- Any production-class token, DSN, or DB credential is provisioned to the proof environment.
- Any real customer-facing traffic is generated by the proof.
- Any `endpointUrl` is flipped on buyerrecon.com.
- Any production DB write occurs.
- Any secret enumerated in §7.2 is exposed in any artifact.
- Any attempt is made to merge website PR #4 as part of the proof flow.
- Any "Gate 4C execution" language appears in the proof evidence (Path β PASS is a *prerequisite step*, not Gate 4C itself).
- Any pre-merge attempt is made to deploy the PR #4 config to a production-class host.
- Any Lane A/B writer is activated.
- Any Track A invocation occurs.
- Any AMS Trust / Pass 1 / Pass 2 runtime is activated.
- Any Sprint 4 (PR#19c) governance runtime is activated.
- Any Sprint 5 (PR#19d) internal-learning runtime is activated.
- Any Sprint 3 (PR#20) external-report runtime is activated.
- Any of the eleven PR#18ab governance locks is relaxed.
- Any customer-facing surface is activated.
- Any AMS commit re-pin occurs (the AMS commit pin `13d4900` recorded by PR#71 is the only Sprint2-capable pin Path β honors).
- Any modification is made to the PR#17s / PR#18w 26-row baseline.

### 10.3 No-deploy guarantee for this planning PR

This PR is text-only. It does not produce a deploy artifact, does not modify any runtime config, and does not interact with any operator-side environment.

---

## 11. Governance carry-forward

### 11.1 PR#17s / PR#18w 26-row baseline

The 26 HTTP 400 `request_body_invalid_json` rows from 2026-05-19 are the categorical envelope-shape historical warning. Path β:

- does NOT delete, mutate, annotate, or normalise any of those rows;
- treats the 26-row count as the *baseline* against which any future canary's `request_body_invalid_json` count is measured (PR#18ac §10.1 and PR#18w §x carry-forward);
- defines `request_body_invalid_json_observed_post_flip > 0 in the canary window` as a Gate 4C stop-line (carry-forward from PR#18ac §10.1, NOT introduced by this PR);
- Path β execution itself MUST NOT generate any `request_body_invalid_json` row because the body shape (§6 Step 7's 5 categorical assertions) precludes it.

### 11.2 Deferred work locks (unchanged)

| Track | Locked off | Reason |
| --- | --- | --- |
| PR#19b (Sprint 3 external output contract handoff) | yes | handoff doc only; no runtime |
| PR#19c (Sprint 4 governance runtime handoff) | yes | handoff doc only; no runtime |
| PR#19d (Sprint 5 internal learning / knob handoff) | yes | handoff doc only; no runtime |
| PR#20 (Sprint 3 external report MVP) | yes | implementation merged but inactive; no customer surface |

Path β does not unlock any of these. No Sprint 4 / Sprint 5 runtime is activated by Path β PASS.

### 11.3 Gate scope

| Gate | Scope vs Path β |
| --- | --- |
| Gate 4A | DB grant / traffic re-audit (PR#18w) — PASS, independent of Path β. |
| Gate 4B | Website bundle artifact / config / rollback — independent of Path β; PR#73 carry-forward applies. |
| Gate 4C | Endpoint canary (PR#18ac §10.1) — Path β PASS is a *prerequisite input* to Gate 4C PASS, NOT Gate 4C itself. |
| Gate 4D | Organic observation — out of scope of Path β. Requires its own PR and its own Helen GO. |
| Gate 4E | Track A / Playwright (full) — out of scope of Path β. `track_a_required_for_gate4 = false` and `playwright_required_for_gate4 = false` locks remain in force; Path β uses Playwright (or equivalent) *only* for the controlled proof event in §6, not for full Gate 4E coverage. |
| Gate 4F | Not invented. Gate 4D/4E are defined in PR#18ac §10.1; Gate 4F is not a defined gate in any governance doc. Path β does not invent it. |

---

## 12. What PR#18af-Path-β does NOT promote

PR#18af-Path-β does **not** approve, recommend, or imply:

- that any Path β step in §6 should be executed by anyone in this session,
- that the website PR #3 should be merged (Website PR #3 remains HOLD),
- that the website PR #4 should be merged (Website PR #4 remains HOLD),
- that `endpointUrl` should be re-flipped from Render legacy to Hetzner Sprint 2,
- that any non-production website host should be stood up by this PR,
- that any browser-automation harness should be authored by this PR,
- that Gate 4C is ready to execute,
- that any production endpoint should receive traffic,
- that Track A or Playwright (full) should be invoked,
- that any production DB grant should be changed,
- that any customer-facing surface should be activated,
- that the AMS commit pin (`13d4900`) should be updated,
- that the PR#17s / PR#18w 26-row historical warning rule should be touched,
- that any of the eleven PR#18ab governance locks should be relaxed,
- that PR#19b / PR#19c / PR#19d / PR#20 should be activated,
- that Gate 4D or Gate 4E is in scope,
- that a "Gate 4F" exists as a gate.

PR#18af-Path-β is a docs-only planning artifact. The aggregated Gate 4C verdict remains **BLOCKED_PENDING_HELEN_GO**.

---

## 13. Hard-boundary block (categorical)

PR#18af-Path-β approves nothing beyond the recording of the Path β plan itself.

- No Gate 4C execution.
- No endpointUrl re-flip.
- No PR #3 / PR #4 merge.
- Website PR #3 remains HOLD. Website PR #4 remains HOLD.
- No bundle deploy.
- No `/var/www` edit.
- No DB grant change.
- No production endpoint contacted.
- No production token used.
- No production DB touched.
- No browser-automation execution in this session.
- No `legacy_collect_tolerance` upgrade.
- No PR#17s / PR#18w 26-row historical warning touched.
- No PR#18ab governance lock relaxed.
- No customer-facing surface activated.
- No AMS commit re-pin.
- No Track A / Playwright (full) invocation.
- No Lane A/B writer activation.
- No AMS Trust / Pass 1 / Pass 2 runtime activation.
- No Sprint 4 (PR#19c) runtime activation.
- No Sprint 5 (PR#19d) runtime activation.
- No Sprint 3 (PR#20) runtime activation.
- No raw token, raw Authorization header, raw Bearer, raw site-write token, raw `SITE_WRITE_TOKEN`, raw PEPPER, raw `DATABASE_URL`, raw `postgres://` string, raw DSN, raw `request_id` UUID value, raw `session_id`, raw payload, raw response body, raw `token_hash` printed in this PR or in any future Path β execution evidence.

Each subsequent gate (4C, 4D, 4E) requires its own explicit Helen GO. Each Path β execution requires its own explicit Helen GO.

---

## 14. Final verdict and next-step framing

**Final verdict: PLANNING_ONLY.**

Aggregated Gate 4C readiness verdict: **BLOCKED_PENDING_HELEN_GO** (unchanged).

Path β can be executed *later* without touching production iff:

- Helen explicitly approves Path β execution in a follow-up PR,
- a Candidate D surface satisfying §4 is constructed by the operator,
- a §5.1 approved target endpoint is reachable,
- the §10.2 stop-lines all hold,
- the §7.2 evidence-redaction rules are followed,
- the §6 8-step sequence runs without BLOCK.

Unresolved requirements (operator-owned, not actionable from this repo):

- The Candidate D surface itself does not yet exist (PR#73 §5.4 enumerated it as unbuilt).
- An operator-side Playwright-or-equivalent harness for the 8-step browser proof flow does not yet exist.
- The operator-side network isolation invariant (§4.1.7) has not been confirmed for a Candidate D environment that does not yet exist.
- The Path β execution evidence file does not yet exist (and will not, per §7.3, until a separate post-execution PR is opened with explicit Helen GO).

The next docs-only step *could* be a separate PR that proposes a concrete Candidate D construction (e.g., a Playwright project scaffold under a clearly non-production hostname) — but only if Helen chooses to proceed with Path β. If Helen chooses Path α instead, this Path β plan remains on file as a documented unactivated alternative; nothing in this PR pressures the Path α / Path β decision.

No forbidden action occurred in the authoring of this PR.
