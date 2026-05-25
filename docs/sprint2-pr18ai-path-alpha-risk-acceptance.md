# BuyerRecon Sprint 2 PR#18ai (continuation) — Path α Risk-Acceptance Decision Record (Docs-Only)

Status: **risk-acceptance decision record. Verdict: PATH_ALPHA_ACCEPTED for Gate 4C aggregation input. No execution approved by this PR. No production/staging contact. No website config change. Aggregated Gate 4C readiness verdict remains BLOCKED_PENDING_AGGREGATION_REVIEW (i.e., the next step is a separate Gate 4C aggregation PR that may now consider Path α as accepted input). See §1 and §6.**

PR#18ai-Path-α-Risk-Acceptance records Helen's explicit decision to accept the **Path α structural-composition proof** as sufficient for the upcoming Gate 4C aggregation review, despite Path β Candidate D custom one-event execution remaining unproven against the current Sprint2-capable SDK build. The decision is made with full awareness of the residual risk surfaced by website PR #6 (the no-auto-fire Candidate D fixture's read-only method discovery showed the current SDK exposes no safe documented one-event public method) and recorded here so a later Gate 4C aggregation PR has a single, frozen reference to cite.

This PR does **not**:
- execute Gate 4C,
- merge website PR #3 (`gate4c-staging-mock-thinsdk-proof`),
- merge website PR #4 (`transportOptions.mode = 'sprint2_v1_event'`),
- deploy any artifact to any host,
- edit `/var/www`,
- flip `endpointUrl` on any production-class host,
- contact production,
- contact staging,
- mutate any DB, secret, role, or token,
- activate any customer-facing surface,
- activate Lane A/B writers, runtime scoring, AMS Trust, Pass 1, or Pass 2,
- approve PR #4 merge,
- approve production deploy,
- relax any of the eleven PR#18ab final-scoring governance locks.

> **No Gate 4C execution.**
> **No endpointUrl re-flip.**
> **No PR #3 / PR #4 merge.**
> **Website PR #3 remains HOLD. Website PR #4 remains HOLD. Website PR #6 remains HOLD.**
> **No production endpoint, no production token, no production DB.**
> **No deploy. No `/var/www` edit. No DB grant change.**

---

## 1. Decision

**Helen chooses Path α for Gate 4C readiness review.**

Path α treats the existing structural-composition proof bundle (see §2) as sufficient evidence that the Sprint2-capable ThinSDK build, when activated via PR #4's three-line `transportOptions.mode = 'sprint2_v1_event'` patch and a subsequent endpoint flip, will produce request bodies the backend Sprint 2 collector accepts at the validator / route layer. The decision is recorded so a later Gate 4C aggregation PR has a single citable record of Helen's explicit acceptance.

Path β is technically the stronger executional proof path (per backend PR#74 §9 and PR#75 §1), because it would close the ThinSDK→HTTP structural-inference gap with a real browser-driven one-event proof. Helen's choice of Path α is **not** a denial of Path β's value; it is a deliberate decision to ship Gate 4C readiness now using the structural proof that already exists rather than wait for the SDK / harness contract work required to make Path β actually executable (see §3 and §5).

The aggregated Gate 4C readiness verdict remains conditional on a subsequent **Gate 4C aggregation PR** that combines this risk-acceptance decision with the bundle in §2 plus the upstream Gate 4A PASS / Gate 4B PASS / Gate 1 confirmation evidence, per PR#18ac §10.1.

---

## 2. Accepted evidence bundle (Path α composition)

| Element | Document / PR | What it proves | Layer |
| --- | --- | --- | --- |
| AMS option-key proof | `docs/sprint2-pr18ae-supplement-thinsdk-option-key-proof.md` (PR #71) | `transportOptions.mode = 'sprint2_v1_event'` is the canonical AMS option key at commit pin `13d4900`; SDK artifact sha256 pin `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` | source / option key |
| Staging body-shape acceptance | PR #17x Gate 2 PASS (Attempt 3, 2026-05-21) + PR #17z Gate 3 PASS | The Hetzner staging Sprint 2 `/v1/event` endpoint accepts the canonical Sprint 2 single-object body via curl/fetch-equivalent execution | staging accept (HTTP + DB) |
| Mock harness PASS | Website PR #3 (HOLD) — mock_validator_pass carry-forward | The AMS ThinSDK source emits a body shape matching the Sprint 2 contract when `transportOptions.mode = 'sprint2_v1_event'` is set, against `staging-mock.invalid` (no real HTTP) | source → body shape |
| Backend harness + execute mode | Website PR #5 (merged at `0bd62fc` on `production-live-20260508`) | Fail-closed Playwright-driven harness, locked Playwright `1.49.1` dev dep, 44/44 self-tests PASS, HTTPS-only endpoint enforcement, body-shape + response-shape + Authorization PASS conditions, redacted-evidence template | harness contract + fixture pipeline |
| Target discovery + local-layer PASS | `docs/sprint2-pr18af-staging-collector-target-discovery.md` (PR #73) | Candidate enumeration; `local_route_layer_pass = PASS` (vitest 111/111 against `validateEventCore` + `parseEnvelope` + `createV1Router`); `staging_collector_pass (body-shape)` = PASS via PR#17x/PR#17z carry-forward | local route + classification |
| Path β plan + execution preflight | `docs/sprint2-pr18af-path-beta-nonprod-browser-proof-plan.md` (PR #74) + `docs/sprint2-pr18af-path-beta-execution-go-preflight.md` (PR #75) | Categorical Candidate D requirements, env-var contract, network isolation invariant, PASS/BLOCKED criteria; documented but not executed | planning / preflight |
| Candidate D fixture with discovery | Website PR #6 (HOLD) | No-auto-fire static page with `window.gate4cDiscoverThinSDKMethods()`; honest read-only finding that the current SDK exposes no safe documented one-event public method (`track()` / `page()` / `identify()` / `group()` / `capture()` / `emit()` / `dispatch()` all absent) | proof harness state + residual risk |

The decision in §1 treats the union of these elements as the accepted evidence bundle for Gate 4C aggregation input.

---

## 3. Accepted residual risk

The Path α decision is recorded with explicit acknowledgement of the following residual risks. Helen's acceptance of each is the operative content of this PR.

| Residual risk | What it means | Why Helen accepts it now |
| --- | --- | --- |
| Browser-level ThinSDK→HTTP custom one-event proof is not executed | No real Chromium-driven session has fired exactly one Sprint 2 single-object body through the production-shaped ThinSDK FetchTransport into the Hetzner staging `/v1/event` endpoint and back. The structural proof (PR #71 + PR#17x/z + PR #3) covers source → body shape and staging → accept independently but does not close the literal HTTP transit step with a real SDK build. | The Gate 4C cutover question is *compatibility and acceptance*, not *originating-side execution proof*. The structural proof bundle is consistent with itself and with the PR#73 local-layer PASS; the executional gap is information about the test, not about the cutover risk. |
| Current SDK has no safe documented single-event public method | Website PR #6's read-only discovery shows the collector / prototype surface includes `start()`, `stop()`, `flush()`, `send(e)`, `setAdapter(e)`, plus internal `notifyPageView` / `emitPageView` / `emitSessionStart`-style methods — but no `track()` / `page()` / `identify()` / `group()` / `capture()` / `emit()` / `dispatch()` public method. | This is an SDK-public-API limitation, not a cutover-correctness limitation. It blocks Path β executability but does not affect Gate 4C scope. |
| Path β remains stronger technically but blocked on prerequisites | Path β requires either (A) a SDK upgrade exposing a single-event public method, or (B) a harness-contract revision accepting the `session_start + page_view` pair from `start()` as the proof event set. Neither has been done. | Both prerequisites are scoped to separate, downstream work (see §5). Gate 4C should not be held hostage to either. |
| `legacy_collect_tolerance` remains BLOCKED | No safe non-production Render-class legacy `/collect` collector exists. | This was BLOCKED before Path α/β were even named (PR#73 §6) and is not unblocked by Path α. Gate 4C aggregation must explicitly note this residual. |

---

## 4. Why Path α is acceptable for now

1. **Gate 4C scope.** The hard-gate references in `docs/ops/cutover-hard-gates.md` and the Gate 4C plan in `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` §10.1 frame Gate 4C as a *compatibility + cutover readiness* gate (does the Sprint 2 collector accept the bodies the production-bound ThinSDK build will emit?), not a *ThinSDK public-API redesign* gate.
2. **Structural proof covers every Gate 4C-scoped invariant.** The accepted bundle in §2 covers:
   - source-level mode (PR #71),
   - emitted body shape (PR #3),
   - staging body-shape acceptance (PR #17x / PR #17z),
   - local route + envelope + validator acceptance (PR #73 `local_route_layer_pass = PASS`),
   - HTTPS-only endpoint enforcement and fail-closed harness behavior (PR #5 commit `741585d`),
   - operator preflight (PR #75),
   - the harness's no-auto-fire posture (PR #6).
   These are sufficient for Gate 4C compatibility evaluation under §10.1.
3. **Long-term ThinSDK public-API work is separable.** The lack of a documented one-event method is a *real* gap — but it is a gap in the *future* Track A / Playwright / lifecycle-event-proof workstream (see §5), not in Gate 4C's compatibility evaluation. Holding Gate 4C until that workstream lands would conflate two distinct goals.
4. **The harness is execution-ready when Helen later GOes Path β.** PR #5 + PR #6 + the preflight runbook in PR #75 leave a clean, fail-closed, evidence-template-equipped path to a Path β execution under a separate Helen GO, *after* the SDK or harness-contract work in §5. Path α today does not foreclose Path β tomorrow.

---

## 5. Required future work

Path α acceptance does NOT eliminate the underlying work; it sequences it after Gate 4C aggregation. The following tracks remain on file as required future work:

| Track | Description | Why it matters | Status |
| --- | --- | --- | --- |
| AMS / ThinSDK public event API contract | Define and ship a safe, documented, single-event public method on the collector (`track()` or equivalent) that emits exactly one event per call without firing lifecycle observers. The contract should specify body shape, transport path, consent gating, and back-pressure semantics. | Without this, Path β remains structurally executable only via internal `send(e)` (disqualified) or via `start()` (which auto-emits `session_start + page_view`). | Not started. Separate track. |
| ProductContextProfile v0.1 contract lock | Lock the v0.1 schema for `ProductContextProfile` per the in-progress branch `buyerrecon-product-context-profile-contract-v0-1`. | Downstream consumers (Sprint 3 PR#20 external report MVP; Sprint 4/5 governance and learning) require a frozen schema. This is on a separate branch and is NOT a Gate 4C dependency, but it is documented here so Helen's roadmap stays coherent. | In progress on a separate branch. |
| Lifecycle-event proof OR safe one-event method | One of the two prerequisites for Path β execution per the residual-risk table in §3 row 3. | Once either prerequisite lands, the harness from PR #5 / PR #6 can be exercised against a real Candidate D surface under a separate Helen GO. | Blocked on the ThinSDK public API track above (Helen-side decision). |

None of these tracks is required for Gate 4C aggregation review. All are post-Gate-4C work.

---

## 6. Boundaries

This PR records a decision. It does not authorise any action beyond that record.

- This PR does **not** approve an `endpointUrl` flip on `buyerrecon.com` or any production-class host.
- This PR does **not** approve website PR #4 merge.
- This PR does **not** approve website PR #3 merge.
- This PR does **not** approve website PR #6 merge.
- This PR does **not** approve production deploy.
- This PR does **not** execute Gate 4C.
- This PR does **not** generate canary traffic.
- This PR does **not** modify any backend `src/`, `tests/`, `package.json`, migration, schema, or DB script.
- This PR does **not** modify any website file (`thinlayer/`, `tests/`, `tools/`, `package.json`, etc.).
- This PR does **not** modify the AMS commit pin (PR#71 commit `13d4900`).
- This PR does **not** modify the SDK artifact pin (`048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`).
- This PR does **not** modify the PR#17s / PR#18w 26-row baseline.
- This PR does **not** relax any of the eleven PR#18ab final-scoring governance locks.
- This PR does **not** unblock `legacy_collect_tolerance`.
- This PR does **not** unblock PR#19c / PR#19d / PR#20 runtime activation.
- This PR does **not** approve Gate 4D, Gate 4E, or any later gate.

The single, scoped permission this PR grants is: **a later Gate 4C aggregation PR may now consider Path α as accepted input under the §2 bundle.** Nothing else.

---

## 7. Governance carry-forward

### 7.1 PR#17s / PR#18w 26-row baseline

The 26 HTTP 400 `request_body_invalid_json` rows from 2026-05-19 are the categorical envelope-shape historical warning. This decision record:

- does NOT delete, mutate, annotate, or normalise any of those rows;
- treats the 26-row count as the *baseline* against which any future canary's `request_body_invalid_json` count is measured (carry-forward from PR#18ac §10.1 and PR#18w §x);
- recognises that `request_body_invalid_json_observed_post_flip > 0 in the canary window` remains a Gate 4C stop-line (carry-forward; not introduced by this PR);
- does not generate any `request_body_invalid_json` row because it executes nothing.

### 7.2 PR#18ab final-scoring governance locks — unchanged

Every one of the eleven PR#18ab final-scoring governance locks remains unchanged and is not relaxed by this decision or by the subsequent Gate 4C aggregation PR that will cite it:

- `customer_claim_allowed=false`
- `customer_visibility_allowed=false`
- `lane_output_allowed=false`
- `lane_write_allowed=false`
- `runtime_scoring_allowed=false`
- `ams_trust_runtime_allowed=false`
- `pass1_runtime_allowed=false`
- `pass2_runtime_allowed=false`
- `dashboard_customer_output_allowed=false`
- `sales_claim_upgrade_allowed=false`
- `allowed_customer_language=[]`

PR#73 hard-gate carry-forward locks (PR#73 §2.1) also remain unchanged: `coupon_gate_allowed=false`, `playwright_required_for_gate4=false`, `mock_substitutes_for_acceptance=false`, `single_doc_substitutes_for_acceptance=false`, `track_a_required_for_gate4=false`, `gnn_in_phase_1=false`, `black_box_in_phase_1=false`, `allowed_evidence_kinds_outside_local_proof=[]`, `allowed_promotion_actions_outside_local_proof=[]`.

### 7.3 Deferred work locks — unchanged

| Track | Locked off | Reason |
| --- | --- | --- |
| PR#19b (Sprint 3 external output contract handoff) | yes | handoff doc only; no runtime |
| PR#19c (Sprint 4 governance runtime handoff) | yes | handoff doc only; no runtime |
| PR#19d (Sprint 5 internal learning / knob handoff) | yes | handoff doc only; no runtime |
| PR#20 (Sprint 3 external report MVP) | yes | implementation merged but inactive; no customer surface |

Path α acceptance does not unlock any of these. No Sprint 3 / 4 / 5 runtime is activated by this decision.

### 7.4 Gate scope

| Gate | Scope vs Path α acceptance |
| --- | --- |
| Gate 4A | DB grant / traffic re-audit (PR#18w) — PASS, independent of Path α. |
| Gate 4B | Website bundle artifact / config / rollback — independent of Path α; PR#73 carry-forward applies. |
| Gate 4C | Endpoint canary (PR#18ac §10.1) — Path α decision is an *aggregation-input* per §1 / §6, NOT Gate 4C execution itself. |
| Gate 4D | Organic observation — out of scope. Requires its own PR and Helen GO. |
| Gate 4E | Track A / Playwright (full) — out of scope. `track_a_required_for_gate4 = false` and `playwright_required_for_gate4 = false` locks remain in force. |
| Gate 4F | **Not invented.** Gate 4D / 4E are the only later gates defined in `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` §10.1; Gate 4F is not a defined gate in any governance doc. This decision record does not invent it. |

---

## 8. Final verdict and next-step framing

**Verdict: PATH_ALPHA_ACCEPTED for Gate 4C aggregation input.**

The next step is a **separate Gate 4C aggregation PR** that:

1. cites this record as Helen's explicit Path α risk-acceptance,
2. combines it with Gate 4A PASS (PR#18w), Gate 4B PASS, Gate 1 confirmation (PR#18ad), and the §2 accepted bundle,
3. performs the aggregation-level evaluation per `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` §10.1,
4. produces either an aggregated Gate 4C PASS (which itself is *not* yet an `endpointUrl` flip authorisation — that's a separate decision per §6) or an aggregated Gate 4C BLOCKED with a categorical reason.

If Helen later wishes to re-open Path β — after the SDK / harness-contract work in §5 lands — this decision record does not obstruct that. Path α acceptance is not a closure of Path β; it is a sequencing decision.

No forbidden action occurred in the authoring of this PR.
