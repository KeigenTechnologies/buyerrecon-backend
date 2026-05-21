# BuyerRecon PR#18b — Timing / Product Context refresh planning + read-only observer refresh

Status: **docs-only planning record. Verdict: PLANNING ONLY — no runtime scoring, no customer output, no Gate 4 work, no production traffic, no Lane A/B writer, no AMS runtime bridge.**

PR#18b is the first step in the post-Gate-3 chain defined by PR#18a (PR #33, merge `9355b98`). It addresses the **Timing / Product Context refresh** stage — the docs-only review of whether the existing PR#13b read-only observer is sufficient as a seed for Pass 1 planning (PR#18c), or whether a refresh (still read-only, no durable writer) is required before Pass 1 contracts are locked.

PR#18b is a **planning document only**. It does not execute scoring, does not enable any customer surface, does not write any Lane A/B row, does not invoke AMS Pass 1 / Pass 2 / Trust runtime, does not modify the AMS repository, and does not introduce any code change in BuyerRecon. Each subsequent PR (PR#18c → PR#18g and any Gate 4 PR thereafter) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) are closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18b.**
> **No production traffic is approved by PR#18b.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18b; no production artefact / config mode flip is approved by PR#18b.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no Timing / Product Context runtime execution (beyond existing read-only observers), no knobs / dashboard implementation is approved by PR#18b.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18b.**
> **No AMS repo modification. No AMS PR opened by PR#18b.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `9355b98` — "Sprint 2 PR#18a: plan post-Gate-3 scoring chain (#33)").

PR branch: `buyerrecon-sprint2-pr18b-timing-product-context-refresh`

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic pause + chain (this PR is step 1 of §4).
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 PASS evidence (PR #32, merge `a35616b`).
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 planning runbook.
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md` — Product-Context Fit + Timing Window planning baseline.
- `docs/sprint2-pr13b-product-context-timing-observer.md` — Read-only Product-Context / Timing observer (impl `e20ad7b`, proof `469b203`).
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md` — ProductFeatures bridge planning + AMS reserved-name guard.
- `docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md` — Pure TS mapper (`1441c86`).
- `docs/sprint2-pr14c-productfeatures-bridge-candidate-observer.md` — Read-only bridge candidate observer (impl `4b3b1b6`, proof closure `671c632`).
- `docs/sprint2-pr14d-ams-compatibility-fixture-planning.md` — AMS compatibility fixture planning.
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A / Lane B Evidence Review contract baseline.
- `docs/sprint2-pr16b-lane-ab-preview-observer.md` — Lane A / Lane B preview observer (read-only).

---

## 1. Status / verdict

**PLANNING ONLY — READ-ONLY OBSERVER REFRESH PLANNING ONLY.**

- No runtime scoring. The existing read-only observers (PR#13b Product-Context / Timing, PR#14c ProductFeatures bridge candidate, PR#16b Lane A/B preview) are the only Product Layer surfaces; no new runtime scoring decision is introduced by PR#18b.
- No customer output. No Pass 1 / Pass 2 / Trust runtime emission. No Lane A/B writer. No customer-facing claim text.
- No Gate 4 work. Gate 4 (website ThinSDK activation + `endpointUrl` re-flip + production artefact / config mode flip + canary + rollback + Render `/collect` replacement decision + production monitoring) remains paused per PR#18a §11.
- No production traffic. No `curl` / browser / synthetic generator against any production endpoint.
- No Lane A/B writer. PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- No AMS runtime bridge. AMS shared cores (Pass 1, Pass 2, Trust Core, BuyerRecon adapter) are referenced read-only; no runtime call, no AMS repo modification, no AMS PR opened.

---

## 2. Why Timing / Product Context comes first after Gate 3

Gate 3 PASS (PR#17z / PR #32) proved:

- The staging Sprint 2 `/v1/event` collector accepts / rejects controlled fixtures correctly under staging token auth.
- DB-backed deltas move exactly as planned (`ingest +4 / accepted +2 / rejected +1`).
- Per-`request_id` row lookups confirm `workspace_id`, `site_id`, `endpoint`, `auth_status`, `http_status`, `reject_reason_code`.
- Staging Lane A/B counts on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` remained at `0` / `0`.

Gate 3 PASS did **not** prove:

- **Commercial timing.** No claim about whether the four Gate 3 fixtures represent realistic buyer-motion timing windows; they are synthetic envelope/validation proofs, not commercial buyer evidence.
- **Product fit.** No claim about whether the underlying Product-Context Fit / Timing semantics (PR#13a §4–§7) hold against post-Gate-3 evidence shape.
- **Trust calibration or customer-safe claims.** No Trust dimension exercised; no Pass 2-style claim allowlist gate run; no Lane A/B preview rendered to any surface.

The PR#18a §4 sequence is **Timing / Product Context → Pass 1 → Trust → Pass 2 → Lane A/B governance → Gate 4 planning**. The Timing / Product Context refresh comes first because every later stage (Pass 1 / Trust / Pass 2 / Lane A/B) consumes Product-Context Fit + Timing Window outputs (PR#13a §5 ProductContextProfile + PR#13a §7 timing window). A refresh decision is gating: if PR#13b's observer is sufficient, PR#18c (Pass 1 planning) can proceed with current evidence shape; if it is not, a refresh PR must close before Pass 1 contract locks.

The PR#18a carry-forward note also applies: **HTTP / DB-row outcomes are not the same as scoring / customer-safety outcomes.** Timing / Product Context is where the chain re-anchors against commercial evidence shape after the Gate 1–3 transport / acceptance proofs.

---

## 3. Existing BuyerRecon evidence sources

The Timing / Product Context refresh — current state or future read-only refresh — reads from the following evidence sources only. **All sources are read-only; no source is written by PR#18b or any future refresh observer.**

| Source | Owner | What it carries | Note |
|---|---|---|---|
| `public.ingest_requests` | v1 collector (PR#7) | per-request envelope + auth + http_status + reject_reason_code + workspace_id + site_id + endpoint | Includes Gate 3 synthetic rows (see §6). |
| `public.accepted_events` | v1 collector (PR#5c / PR#7) | per-event accepted payload + workspace_id + site_id + canonical_jsonb projection + raw legacy column | Includes Gate 3 synthetic accepted_events rows. |
| `public.rejected_events` | v1 collector (PR#5c / PR#7) | per-event rejected payload + reject_reason_code + rejected_stage | Includes Gate 3 synthetic rejected_events row (F3). |
| `public.session_features` | PR#8 worker | session-level features (PR#8 contract) | No synthetic-fixture exclusion today. |
| `public.session_behavioural_features_v0_2` | PR#9 worker | behavioural feature roll-up v0.2 | Refresh loop in PR#10. |
| `public.poi_observations_v0_1` | PR#11d (Hetzner-proven) | POI observations | Used by PR#13b observer. |
| `public.poi_sequence_observations_v0_1` | PR#12e (Hetzner-proven) | POI sequence observations | Used by PR#13b observer. |
| `public.risk_observations_v0_1` | PR#7-bridge (risk-core-bridge) | risk observations | Optional input for future refresh. |
| Product-Context / Timing observer output | PR#13b (read-only) | `buyerrecon_product_features_shape_preview` (internal-only label) | Markdown + JSON preview; nothing durable. |
| Evidence Review snapshot | PR#16a / PR#16b derived | Lane A / Lane B preview, evidence gap counts | Read-only; preview, not writer. |

### 3.1 Test evidence versus commercial evidence

- **Gate 2 (PR #30) and Gate 3 (PR #32)** proof rows in `public.ingest_requests` / `public.accepted_events` / `public.rejected_events` are **test evidence** for transport / acceptance correctness — not commercial buyer-motion evidence. They must not be used to drive a Pass 1 / Trust / Pass 2 / Lane A/B claim about real buyer behaviour. See §6 for the exclusion contract.
- Commercial evidence is non-fixture customer-traffic evidence. None has been produced yet under the Sprint 2 envelope; production traffic remains on Render legacy `/collect`. Until Gate 4 PR C re-flips `endpointUrl`, commercial v1 evidence does not exist in the staging DB. PR#18b's refresh must therefore plan for the case where commercial evidence is empty or absent.

---

## 4. Existing AMS Product Layer / BuyerRecon adapter findings (read-only)

Inspection target: `/Users/admin/github/keigentechnologies/ams`. **Read-only.** No file modified, no commit made, no AMS PR opened. The repo state observed at inspection time is reported categorically below as a planning hygiene note; PR#18b does not interact with it beyond reading.

### 4.1 AMS repo state at inspection

- AMS repo found at `/Users/admin/github/keigentechnologies/ams`.
- AMS branch: `main`; HEAD: `9bf4cc921629272b08e7287a9c216ad11d8c9609`.
- AMS working tree was **dirty at inspection time**: 6 modified files (mostly in `internal/products/buyerrecon/adapter/` and `internal/products/buyerrecon/output/`) and 3 untracked files (`.env.example`, `Dockerfile`, `README_AMS_WORKER_V01.md`). This represents in-progress AMS-side work, almost certainly the BuyerRecon adapter / translator effort referenced in PR#14d. PR#18b did not touch these files; it only confirmed structural shape of the relevant directories. Helen / AMS owner should be aware that PR#18b's planning reflects the AMS contracts at HEAD `9bf4cc9` plus the in-progress adapter shape visible read-only on the workspace.

#### 4.1.1 AMS dirty-worktree observations are reference-only (hard rule)

The §4.1 inspection looked at AMS's working tree while it was dirty (uncommitted modifications + untracked files). That observation is **useful context** for understanding the direction AMS is moving in, but it is **not** a contractual source of truth for any BuyerRecon implementation. The following hard rules apply:

- **Reference-only, not contractual.** Anything observed in AMS's dirty working tree (the 6 modified files, the untracked files, any inferred shape from in-progress edits to `internal/products/buyerrecon/adapter/thinsdk_adapter.go`, `internal/products/buyerrecon/output/evidencecard.go`, or any other modified path) is reference material for orienting BuyerRecon's planning conversation only. It is **not** the AMS contract until the relevant AMS work is committed and merged.
- **Not contractual until committed / merged.** A field, type, behaviour, or constraint visible only in a dirty AMS working tree carries **no contractual weight** for BuyerRecon. AMS owns its own contract evolution; until the AMS owner commits and merges that change, BuyerRecon must treat it as provisional.
- **Future BuyerRecon implementation / bridge PRs must re-check AMS from a clean committed HEAD.** Any subsequent BuyerRecon PR that proposes implementation, a bridge, a translator, a fixture, or a runtime call against AMS must — at the time that PR is opened — re-inspect AMS at a clean committed HEAD (i.e., `git status` clean on the AMS workspace) **or** explicitly cite the exact AMS commit / PR that has been merged into AMS `main` and that the BuyerRecon PR depends on. Citing "the AMS workspace at the time of PR#18b's inspection" is **not** acceptable as a contractual basis for any future BuyerRecon implementation PR.
- **No copy / reimplementation from dirty AMS observations.** BuyerRecon must **not** copy or reimplement AMS product-layer code, type shapes, JSON key sets, reason-code sets, or runtime semantics based solely on what PR#18b saw in the dirty AMS workspace. The AMS reserved-name guard (PR#14a §10) and the namespace-disjoint candidate contract (PR#14b) remain the canonical BuyerRecon-side constraints; nothing observed in the dirty AMS tree relaxes or extends those constraints.
- **Runtime bridge / customer output remains out of scope.** Per §4.6, no runtime bridge from BuyerRecon to AMS exists today; per §11, no customer output is enabled by any PR in PR#18a's §13 sequence. AMS dirty-worktree observations do **not** lower either bar — Option E (live runtime bridge) and any customer-facing surface continue to require their own separately-planned PRs with their own explicit Helen GO.

### 4.2 AMS canonical contracts (frozen for BuyerRecon)

The following AMS surfaces are **owned by AMS**, **frozen** from BuyerRecon's perspective for PR#18b's planning window:

- **`internal/contracts/features.go`** — defines `CommonFeatures` (product-neutral facts: dwell, scroll, click, milestones, behavioural risks, identity hints, automation signals), `ProductFeatures` (with `Namespace json.RawMessage` as the product-namespaced payload), `NormalizedFeatureBundle`. BuyerRecon emits the `Namespace` payload; AMS owns the wrapper and the typed product-specific struct (`BuyerReconProductFeatures`).
- **`internal/products/buyerrecon/adapter/feature_adapter.go`** — `ParseBuyerReconFeatures` parses `ProductFeatures.Namespace` into typed `BuyerReconProductFeatures`. This is the **only sanctioned cross-repo entry point**. PR#14d §3 already locked this; PR#18b re-affirms it.
- **`internal/products/buyerrecon/adapter/thinsdk_adapter.go`** — currently modified on the AMS workspace; defines the ThinSDK event shape AMS understands (parses `event_type`, `site_id`, `hostname`, `path`, `anon_session_id`, `anon_browser_id`, `client_timestamp_ms`, `consent_signal`, `jurisdiction_hint`, plus sub-structs `ThinSourceContext`, `ThinSessionContinuity`, `ThinEngagementProxy`, `ThinCtaAndForm`, `ThinVelocity`, `ThinPathSequence`, `ThinAdapterContext`, `ThinClientEnvelope`). The exact mid-flight shape of this adapter is the AMS owner's concern; PR#18b's planning does not depend on the modifications stabilising.
- **`internal/policy/pass1.go`** — AMS Pass 1 (`EvaluatePreTrust`). Stateless pure function. Owns: compliance gates, hard ceilings, kill-switch, risk ceilings, degraded-mode suppression. Outputs `PolicyPassOneResolution` with `TrustInvocationMode` ∈ {`CONTINUE`, `SKIP_TRUST`, `CONSTRAINED_BLOCK`}. **AMS owns Pass 1 semantics.** PR#18c (BuyerRecon Pass 1 planning) does **not** reimplement Pass 1; it defines the *preview* layer that produces evidence inputs Pass 1 will eventually consume.
- **`internal/policy/pass2.go`** — AMS Pass 2 (`ResolveFinal`). Stateless pure function. Owns: action-tier gating, friction multiplier, soft routing ladder, final decision (`ALLOW` / `ALLOW_WITH_FRICTION` / `REVIEW` / `HOLD` / `DENY`). **AMS owns Pass 2 semantics.** PR#18e (BuyerRecon Pass 2 / claim governance planning) does **not** reimplement Pass 2; it defines the customer-safety claim-gate that sits *over* AMS Pass 2's output.
- **`internal/trustcore/engine.go`** — AMS Trust Core (`TrustDecisionV3`: `NewTrustScore`, `ConfidenceScore01`, `EffectiveR`, `EscrowDelayMin`, `ReviewRequired`). **AMS owns Trust Core semantics.** PR#18d (BuyerRecon Trust planning) does **not** reimplement Trust runtime; it defines the multi-dimensional Trust *contract* that aligns BuyerRecon's evidence-confidence + score-confidence + action-confidence + decay + AMS-shared-core posture without invoking AMS at runtime.

### 4.3 BuyerRecon candidate translator (Outcome C from AMS PR#A1 / PR#A3)

The BuyerRecon-emitted `product_features_namespace_candidate` (PR#14b `1441c86`, produced from real staging evidence by PR#14c `4b3b1b6`) uses **namespace-disjoint sub-block keys** (`fit_like_inputs`, `intent_like_inputs`, `timing_like_inputs`) to avoid the AMS reserved-name guard (`Fit`, `Intent`, `Window`, `WindowState`, `ProductDecision`, `RequestedAction`, `TRQ`, etc.).

The AMS adapter (`internal/products/buyerrecon/scorer/types.go` per PR#14d §3) currently carries **no `json:"…"` struct tags** and matches Go field names case-insensitively. This means:

- A direct `encoding/json.Unmarshal` of the BuyerRecon candidate into `BuyerReconProductFeatures` **will not match** snake_case keys to Go field names (e.g., `fit_like_inputs` does not match the Go `Fit` field).
- A **translator step** is therefore required between the BuyerRecon candidate JSON and a Go-shape that `ParseBuyerReconFeatures` can consume. This is Outcome C from AMS PR#A1 / PR#A3: direct parse is insufficient; the translator path is the cross-repo bridge.

**PR#18b's planning re-affirms this.** No translator is implemented by PR#18b; PR#14d / PR#14e own the future translator + fixture work. PR#18b's role is to ensure the Timing / Product Context refresh respects the candidate-payload boundary established by PR#14a–PR#14c — it does not reshape the candidate, does not bypass the namespace guard, and does not assert AMS-runtime-bridge readiness.

### 4.4 Offline scoring dry-run boundary (AMS PR#A7)

Per the AMS PR#A7 boundary: an offline scoring dry-run (e.g., feeding a candidate JSON into the AMS adapter offline to inspect what `BuyerReconProductFeatures` would parse into) is **not the runtime bridge** and **not customer output**. PR#18b re-affirms this:

- An offline dry-run, if ever performed, is read-only against fixture JSON; it does not run AMS Pass 1 / Pass 2 / Trust against live evidence; it does not produce a `ProductDecision`; it does not render any customer surface.
- Offline dry-run results are not evidence of production readiness. Gate 4 PR C activation remains separately gated regardless of what an offline dry-run shows.
- PR#18b does **not** execute an offline dry-run. It only catalogues the boundary so PR#18c / PR#18d / PR#18e planning can rely on the same distinction.

### 4.5 Reusable later, not now

The following AMS surfaces are **reusable later** for the BuyerRecon scoring/output chain — but only via the AMS adapter, only after the translator path (Outcome C) is proven, only via a runtime-bridge PR with its own Helen GO:

- AMS Pass 1 (`EvaluatePreTrust`) — consumes a `ResolvedPolicyConfig` + `Pass1Input`; not invokable from BuyerRecon today.
- AMS Trust Core (`TrustDecisionV3` engine) — consumes Pass 1 outputs + product/risk inputs; not invokable from BuyerRecon today.
- AMS Pass 2 (`ResolveFinal`) — consumes Pass 1 + Trust + Product + scores; produces final decision; not invokable from BuyerRecon today.
- AMS BuyerRecon adapter (`ParseBuyerReconFeatures`, `feature_adapter.go`, `thinsdk_adapter.go`, `enrichment_adapter.go`, `milestone_adapter.go`, `snitcher.go`, `synthetic.go`) — owns the cross-repo JSON → Go-struct path; runtime-bridge wiring out of scope for PR#18b.

### 4.6 Not yet a runtime bridge

- No runtime call from BuyerRecon to AMS exists today. Neither at the v1 collector level, nor at the observer level, nor at the report level. The "bridge" today is the **fixture-shape compatibility plan** (PR#14d) and the **read-only candidate emitter** (PR#14c). Anything beyond that — a live call into AMS Pass 1 / Pass 2 / Trust at runtime — is **Option E** in PR#14a §12 / PR#14d §1, and is out-of-scope for PR#18b and for every PR in PR#18a's §13 sequence until separately planned.

### 4.7 Must not be copied / reimplemented blindly in BuyerRecon

- AMS reserved names (`Fit`, `Intent`, `Window`, `WindowState`, `ProductDecision`, `RequestedAction`, `TRQ`, `Pass1`, `Pass2`, `TrustDecisionV3`, `BuyerReconProductFeatures` as a top-level concept) — BuyerRecon must not emit JSON keys, type names, or column names that collide with these. The PR#14a §10 AMS reserved-name guard and PR#14b's recursive validators already enforce this; PR#18b re-affirms.
- AMS Pass 1 / Pass 2 / Trust runtime logic — must not be reimplemented inside BuyerRecon's `src/scoring/` or `src/lane-ab-preview/` or any future observer. BuyerRecon's role is evidence + namespace candidate, not policy / trust runtime.
- AMS reason-code namespaces (`^(FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*$`, `^(PRODUCT_DECISION|TRUST)\.[A-Z][A-Z0-9_]*$`) — must not appear in BuyerRecon-emitted JSON, in BuyerRecon SQL identifiers, or in BuyerRecon report copy.

---

## 5. Product Context / Timing refresh objective

The Timing / Product Context refresh stage (this PR + any follow-on read-only observer PR) must produce or re-read **a refreshed, read-only view of timing / product-context evidence** that downstream stages (PR#18c Pass 1 planning, PR#18d Trust planning, PR#18e Pass 2 planning, PR#18f Lane A/B governance) can consume.

### 5.1 What the refresh should produce

- Categorical, read-only diagnostics on the current Product-Context Fit / Timing Window state per workspace / site boundary, drawn from the §3 evidence sources only.
- A categorical determination of whether the evidence supports any of the v1 timing windows: `hot_now` / `warm_recent` / `cooling` / `stale` / `dormant` / `insufficient_evidence` (per PR#13a §7).
- A categorical evidence-completeness / coverage diagnostic (which sources are present, which are sparse, which are absent) per workspace / site boundary.
- A categorical synthetic-fixture exclusion diagnostic (which rows are PR#17x / PR#17z proof traffic and therefore excluded from any commercial evaluation — see §6).
- A pass-forward summary suitable for PR#18c Pass 1 planning input (see §9).

### 5.2 What the refresh must NOT do

- **No customer claims.** Refresh output is internal-only; no surface emits this to a customer.
- **No actions triggered.** Refresh does not write Lane A/B rows, does not write any other durable table, does not call AMS runtime, does not call any external service, does not generate any report customers see.
- **No Lane A/B writer.** PR#17f / PR#17q grant safety stands; refresh observers connect with read-only DB role privileges only.
- **No AMS Trust runtime invocation.** AMS Trust Core is referenced as a target contract (§4.5); no runtime call is made by PR#18b or by any read-only observer PR that derives from it.
- **No synthetic Gate 2 / Gate 3 fixture rows treated as commercial buyer evidence** (see §6).

### 5.3 Posture toward AMS

- Refresh observers (current PR#13b, current PR#14c, any future read-only observer derived from PR#18b) emit BuyerRecon-side preview JSON only. They do **not** emit anything labelled `BuyerReconProductFeatures`; they do not emit AMS reserved names; they do not emit `Fit.*` / `Intent.*` / `Window.*` / `ProductDecision.*` / `RequestedAction.*` strings.
- The pass-forward to PR#18c (§9) is BuyerRecon-internal, not AMS-runtime-bound. The Pass 1 / Trust / Pass 2 planning PRs that follow must respect this same posture.

---

## 6. Synthetic fixture exclusion rule

Gate 2 (PR #30, four-fixture set defined in PR#17x §5) and Gate 3 (PR #32, four-fixture set defined in PR#17y §8 OD-1 + PR#17z §4.5) produced rows in `public.ingest_requests`, `public.accepted_events`, `public.rejected_events`, and `public.site_write_tokens`. These rows are **proof / control traffic**, not commercial buyer-motion evidence. They must not feed downstream scoring evaluations, commercial reports, or any customer-visible artefact.

### 6.1 What must be excluded

- All `ingest_requests` / `accepted_events` / `rejected_events` rows bound to the staging workspace / site pair `(workspace_id = 'buyerrecon_staging_ws', site_id = 'buyerrecon_com')`. This is the boundary pair PR#17x / PR#17y / PR#17z used; it is **not** a commercial workspace.
- All `site_write_tokens` rows whose `label` matches the proof-traffic label set: at minimum `pr17x_gate2_fixture`, `pr17z_gate3_fixture`, and any future Gate-N fixture label following the same convention.
- All event rows whose `schema_key` matches the synthetic-fixture schema-key namespace, at minimum `buyerrecon.test.*` (per PR#17y / PR#17z fixture bodies F1 = `buyerrecon.test.page_view`, F2 = `buyerrecon.test.cta_click`, F3 = the F1-like body with omitted `event_name`).
- All event rows whose `client_event_id` was generated by the operator fixture script (UUIDs minted by `uuidgen` / `python3 -c 'import uuid; print(uuid.uuid4())'` inside the Gate 3 operator script). Because the operator script does **not** persist a synthetic-marker column on the row, this exclusion is harder to apply directly via SQL than the workspace/site or schema_key exclusions; in practice the workspace / site boundary + schema_key namespace already captures the rows.

### 6.2 What must NOT happen

- **Do not delete proof / fixture rows from the DB.** They are audit evidence for Gate 2 / Gate 3 PASS; their preservation is a hard rule from PR#17x §11 / PR#17z §6. Deletion would destroy the audit chain.
- **Do not introduce a runtime-only synthetic-marker column** that customers cannot inspect. Any future exclusion column added to `ingest_requests` / `accepted_events` / `rejected_events` (out of PR#18b scope) must be readable by the same internal-readonly role that audits the data and must not become a hidden runtime override path.
- **Do not narrow the exclusion to "rows newer than Gate 3 cleanup timestamp"** as a substitute for the workspace / site + schema_key boundary. Future Gate-N runs will produce new proof rows; the exclusion contract must categorically cover any future Gate-N synthetic traffic, not be pinned to a moment in time.

### 6.3 Diagnostic obligation

The Timing / Product Context refresh observer (current PR#13b, or any future read-only refresh observer) must emit a **categorical synthetic-fixture exclusion diagnostic** alongside its primary output: how many rows were filtered out as proof traffic, broken down per source table and per exclusion criterion. The diagnostic is internal-only (per §5.2) and never appears in any customer-visible artefact.

---

## 7. Timing bands and confidence

The v1 timing windows from PR#13a §7 are carried forward unchanged unless OD-3 in §10 says otherwise. PR#18b does not propose recalibration; it does propose explicit confidence-cap posture.

### 7.1 Timing bands (v1)

- `hot_now` — recent, multi-signal evidence within a short window.
- `warm_recent` — recent evidence but partial or single-signal.
- `cooling` — evidence trending older; partial completeness.
- `stale` — evidence too old to be currently actionable.
- `dormant` — no recent evidence at all; far past the actionability window.
- `insufficient_evidence` — evidence is present but does not categorically place the session in any of the above; this is a **distinct categorical state**, not a synonym for low confidence.

`insufficient_evidence` is the default state when evidence is sparse, sources are absent, or the workspace / site boundary lacks the multi-signal completeness required to pick a band. Distinguishing `insufficient_evidence` from `dormant` is critical: the former says "we cannot say"; the latter says "we can say, and the answer is: no recent activity".

### 7.2 Confidence posture

PR#18b proposes the following confidence-cap rules (locks in PR#18c → PR#18d as those PRs reference them):

- **Evidence confidence is the cap.** Higher-level confidences (timing confidence, product-context confidence, score confidence — see PR#18a §7 Trust dimensions) cannot exceed evidence confidence. If evidence is partial, downstream confidences are capped at the evidence tier.
- **No high confidence from client-only evidence.** Client-only signals (ThinSDK-reported events without independent server-side corroboration) cannot lift confidence beyond the medium tier. This carries PR#13a §4 / §8 evidence-source-boundary forward.
- **No high confidence from synthetic-only evidence.** If the evidence pool consists entirely of §6-excluded synthetic / Gate-N proof rows (which it shouldn't, post-exclusion, but defence-in-depth applies), confidence outputs are categorically `insufficient_evidence`.
- **Multi-source threshold for elevation.** Elevating from the medium tier requires multiple independent server-side sources (e.g., POI observations + POI sequence observations + session features at minimum) — the exact source-count threshold is OD-T5 / OD-3 in §10.
- **Confidence is per-dimension, not a roll-up.** Per PR#18a §7, Trust will distinguish evidence / score / action confidence; Timing / Product Context confidence outputs must preserve that separation rather than collapsing into a single number.

---

## 8. Read-only observer refresh proposal

PR#18b is docs-only. The following is a **proposal** for the shape of any future read-only observer refresh PR — not an implementation, not pre-authorisation for any code PR. Helen decides whether to commission such a refresh (OD-1 in §10).

### 8.1 Proposed shape (if Helen authorises a future refresh observer PR)

- A new read-only observer (or an amendment to PR#13b's existing observer — OD-1 splits between "amend PR#13b" vs "new observer PR"). The observer:
  - Reads from the §3 evidence sources only.
  - Writes nothing durable. No new table created. No `INSERT` / `UPDATE` / `DELETE` against any existing table.
  - Connects to the staging DB with read-only role privileges (e.g., a staging mirror of `buyerrecon_internal_readonly`). Will fail closed if the DSN role has any write privilege on the source tables.
  - Emits categorical diagnostics only (counts, distributions, categorical band placements, evidence-completeness flags, synthetic-fixture exclusion counts).
  - Excludes synthetic-fixture rows per §6 before computing any commercial diagnostic, and reports the exclusion counts separately.
  - Reports product-context timing distributions per workspace / site boundary (band counts + percentile splits per band, never per-session row content).
  - Reports `insufficient_evidence` separately from negative evidence — i.e., the observer's output explicitly distinguishes "no evidence" from "evidence rules out activity".
  - Carries the PR#13b boundary-affirmation footer: no DB writes, no AMS Product Layer runtime, no `ProductDecision`, no customer output, no full session IDs, no raw URLs, no `FIT.*` / `INTENT.*` / `WINDOW.*` / `PRODUCT_DECISION.*` / `REQUESTED_ACTION.*` strings.

### 8.2 Forbidden in the future refresh observer

- No durable table creation.
- No `INSERT` / `UPDATE` / `DELETE` against any existing table.
- No DB grant change.
- No call into AMS Pass 1 / Pass 2 / Trust runtime.
- No emission of AMS reserved names (PR#14a §10 reserved-name guard applies).
- No customer-facing output.
- No knob / dashboard / operator-control surface added.

### 8.3 Alternative: PR#13b is sufficient

If Helen judges PR#13b's existing read-only observer is sufficient as a seed for PR#18c Pass 1 planning, PR#18b stands as the docs-only refresh confirmation and **no observer PR is opened**. The PR#18a §13 sequence then proceeds directly to PR#18c with PR#13b's output as Pass 1's evidence input.

---

## 9. Pass-forward contract to Pass 1 (PR#18c)

What PR#18b hands to PR#18c, regardless of which §8 path is chosen:

- **Product-context evidence summary.** Categorical per workspace / site: which §3 evidence sources are present, sparse, or absent; coverage percentile per source; synthetic-fixture exclusion counts per source.
- **Timing band candidate.** Categorical band placement (`hot_now` / `warm_recent` / `cooling` / `stale` / `dormant` / `insufficient_evidence`) per workspace / site boundary, with confidence-cap (§7.2).
- **Confidence cap.** Categorical evidence-confidence tier that downstream Pass 1 / Trust / Pass 2 dimensions cannot exceed.
- **Evidence refs.** Categorical references to source tables + row counts (never raw row content; never `request_id` UUID value; never raw payload bytes).
- **Exclusion flags for synthetic / control traffic.** Per-row exclusion outcome categorical only; never the row itself.
- **No customer-facing claim text.** The pass-forward is structured, internal, and consumed by PR#18c Pass 1 planning only.

The pass-forward is a **contract description**, not an implemented data structure. PR#18b does not introduce a `TimingProductContextPassForward` table, struct, or message type. PR#18c locks the structural shape; PR#18b only enumerates the fields PR#18c must accept.

---

## 10. Open decisions

The following decisions are recorded for Helen's review before the next PR in PR#18a's §13 sequence (PR#18c — Pass 1 output contract planning). None is pre-decided by PR#18b.

- **OD-1.** Docs-only planning vs read-only observer implementation. Two paths:
  - (a) PR#18b is docs-only (this doc); PR#18c proceeds with PR#13b's existing output as Pass 1's evidence input. No new observer PR.
  - (b) PR#18b is docs-only; a separate PR#18b-impl (or PR#18b' amendment to PR#13b) introduces a refreshed read-only observer before PR#18c locks Pass 1's input shape.

  Default proposal: **(a)** — PR#13b's existing observer is sufficient unless §3.1's "commercial evidence may be empty until Gate 4" gap creates a Pass 1 planning blocker; in which case (b) becomes the path.

- **OD-2.** Exact synthetic fixture exclusion patterns. §6.1 proposes `(workspace_id = 'buyerrecon_staging_ws', site_id = 'buyerrecon_com')` + `schema_key LIKE 'buyerrecon.test.%'` + `site_write_tokens.label IN ('pr17x_gate2_fixture', 'pr17z_gate3_fixture', …)`. Final pattern set + future Gate-N label namespace lock with Helen.

- **OD-3.** Whether timing band thresholds need recalibration after Gate 3. Default proposal: **no** — Gate 3 synthetic fixtures are not commercial evidence (§6), so they do not provide grounds to recalibrate bands. Bands are recalibrated, if at all, when commercial v1 evidence accumulates after Gate 4 PR C activation. PR#18b does not recalibrate.

- **OD-4.** Whether AMS Product Layer code should remain **reference-only** until the translator bridge is explicitly planned. Default proposal: **yes** — AMS contracts (`internal/contracts/features.go`, `internal/policy/pass1.go`, `internal/policy/pass2.go`, `internal/trustcore/engine.go`) remain reference-only for PR#18b → PR#18g; the translator bridge (Outcome C / Option E) requires its own separate PR per PR#14d / PR#14e, with its own Helen GO.

- **OD-5.** Whether product-context evidence should be refreshed before or after Pass 1 contract planning. Default proposal: **before** — Pass 1's input shape depends on knowing what evidence shape is realistic post-Gate-3. PR#18b's refresh confirmation (under OD-1 path (a)) is sufficient "refresh"; option (b) only applies if (a) is judged insufficient.

- **OD-6.** Whether Lane B / AI-agent observations should be visible to Timing / Product Context at all, or stay dark until Trust / Pass 2. Default proposal: **dark until Trust / Pass 2** — Lane B presence / counts / reasons are not consumed by the Timing / Product Context refresh. They remain internal to Lane B's own preview observer (PR#16b) and are surfaced (if ever) only through Pass 2's allowlist gating (PR#18a §9.4–§9.5). The Timing / Product Context refresh emits no Lane B reason on any output.

---

## 11. Non-goals

PR#18b explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No Gate 4** of any kind. Gate 4 PR B / PR C / PR D / PR E all remain separately gated per PR#18a §11 and PR#17y §12.
- **No production `endpointUrl` re-flip.** `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A.** Track A remains gated under PR#17e (or successor) and is not invoked.
- **No Playwright.** No headless / programmatic browser run.
- **No customer-facing output.** No Pass 1 / Trust / Pass 2 customer surface is enabled.
- **No Lane A/B writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **No AMS Trust runtime.** AMS Trust Core is reference-only.
- **No Pass 1 runtime.** AMS Pass 1 is reference-only; BuyerRecon Pass 1 contract is PR#18c's planning scope, not implementation.
- **No Pass 2 runtime.** Same as above — PR#18e plans it; PR#18b does not.
- **No Timing / Product Context runtime execution** beyond the existing read-only observers (PR#13b, PR#14c). No new runtime decision is emitted by PR#18b.
- **No knobs / dashboard implementation.** PR#18a §10 forbids implementation in v1; PR#18b re-affirms.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No production artefact / config mode flip.** No website artefact change. No production config edit.
- **No AMS repo modification.** No file under `/Users/admin/github/keigentechnologies/ams/` modified, written, or committed by PR#18b. No AMS PR opened. AMS in-progress work observed in §4.1 is left untouched.
- **No BuyerRecon runtime code** unless separately approved. No `src/`, no `scripts/`, no `tests/`, no `package.json`, no migration, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file.

---

## 12. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18b-timing-product-context-refresh-planning.md`). No other files touched. No code / scripts / tests / package / migrations / schema / env / systemd / Nginx / AMS / website / production-config changes.
- **AMS Product Layer inspected read-only.** §4 records the AMS findings from inspection at HEAD `9bf4cc9` (workspace dirty: 6 modified files + 3 untracked, in-progress AMS-side BuyerRecon adapter work) without modifying any AMS file. No AMS commit, no AMS PR, no AMS runtime call.
- **Existing BuyerRecon Product Context / Timing docs reviewed.** §3 references the §3 source set; §4 references PR#13a / PR#13b / PR#14a / PR#14b / PR#14c / PR#14d; §6 references PR#17x / PR#17y / PR#17z synthetic-fixture identities.
- **Synthetic fixture exclusion called out.** §6 enumerates the exclusion patterns and the "do not delete proof rows" rule.
- **Timing / Product Context refresh sequence clear.** §5 + §7 + §8 define the refresh objective, the v1 timing bands + confidence posture, and the read-only observer proposal (with OD-1's default favouring the docs-only path).
- **Pass-forward contract to Pass 1 clear.** §9 enumerates the categorical fields PR#18c Pass 1 planning must accept; no implemented data structure introduced.
- **Gate 4 remains paused.** §1, §2, §11 all assert Gate 4 is paused and not pre-authorised.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18b. **Verdict: PLANNING ONLY — READ-ONLY OBSERVER REFRESH PLANNING ONLY. No runtime scoring, no customer output, no Lane A/B writer, no AMS Trust / Pass 1 / Pass 2 runtime, no Timing / Product Context runtime execution beyond existing read-only observers, no AMS repo modification, no Gate 4 work. PR#18a's chain (Timing / Product Context → Pass 1 → Trust → Pass 2 → Lane A/B governance → Gate 4 planning → Gate 4 execution) advances by exactly one step. PR#18c (Pass 1 output contract planning) requires its own separate Helen GO and is not opened by PR#18b.**
