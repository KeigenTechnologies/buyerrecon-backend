# BuyerRecon PR#18a — Post-Gate-3 scoring/output chain planning before Gate 4

Status: **docs-only planning record. Verdict: PLANNING ONLY — no implementation, no execution, no Gate 4 work.**

PR#18a is the strategic pause before Gate 4. It records — in advance of any code change or production action — the sequence that the scoring / output / trust / lane-governance chain must traverse after the Gate 3 PASS (PR #32, merge `a35616b`) and before any Gate 4 step (website ThinSDK activation, production `endpointUrl` re-flip, production artefact / config mode flip, or buyerrecon.com production `/v1/event` traffic).

This is a **planning document only**. It defines the chain; it does not execute it. Each subsequent PR (PR#18b → PR#18g and any Gate 4 PR thereafter) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1 / Gate 2 (PR #30) / Gate 3 (PR #32) are closed.**
> **Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18a.**
> **No production traffic is approved by PR#18a.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18a; no production artefact / config mode flip is approved by PR#18a.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no Timing / Product Context runtime execution, no knobs / dashboard implementation is approved by PR#18a.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18a.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `a35616b` — "Sprint 2 PR#17z: record Gate 3 execution proof (#32)").

PR branch: `buyerrecon-sprint2-pr18a-post-gate3-scoring-chain-planning`

Mandatory reference compliance:

- `docs/ops/cutover-hard-gates.md` — operational standard.
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 runbook + PR#17x §9.1.4 Attempt 3 PASS evidence.
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 planning runbook.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 execution proof (PR #32, merged at `a35616b`).
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md` — Product Context / Timing planning baseline.
- `docs/sprint2-pr13b-product-context-timing-observer.md` — Product Context / Timing observer (read-only).
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A / Lane B Evidence Review contract baseline.
- `docs/sprint2-pr16b-lane-ab-preview-observer.md` — Lane A / Lane B preview observer (read-only; no durable writer).

---

## 1. Status / verdict

**PLANNING ONLY — no implementation, no execution, no Gate 4 work.**

- Gate 1 (Static Contract Diff + host hash + ThinSDK contract inspection — PR#17s / PR#17t / PR#17u), Gate 2 (controlled fixture acceptance — PR#17x, PR #30, merge `a77f2d7`), and Gate 3 (staging-only DB-backed multi-fixture acceptance — PR#17z, PR #32, merge `a35616b`) are all **closed**.
- Gate 4 (website ThinSDK activation + production artefact / config mode flip + `endpointUrl` re-flip + canary + rollback + Render `/collect` replacement decision + production monitoring) is **paused** and **not started**. PR#18a does not start Gate 4 and does not pre-authorise any Gate 4 sub-step.
- PR#18a does **not** approve: production activation, `endpointUrl` re-flip, production traffic, buyerrecon.com production `/v1/event`, Render `/collect` replacement, customer-facing output, Track A, Playwright, durable Lane A/B writer, AMS Trust runtime, Pass 1 runtime, Pass 2 runtime, Timing / Product Context runtime execution beyond existing read-only observers, knobs / dashboard implementation, `/var/www` edit, DB grant change, or any AMS source / website artefact / production config change.
- On future execution under Helen GO, each subsequent PR in §13's recommended sequence transitions independently. There is no automatic "PR#18a → Gate 4" path.

---

## 2. Why not Gate 4 immediately

Gate 3 PASS (PR #32) proves:

- The staging Sprint 2 `/v1/event` collector accepts and rejects controlled fixtures correctly under staging token auth (Gate 3 PR#17z §4.5).
- DB-backed deltas move exactly as planned (`ingest +4`, `accepted +2`, `rejected +1` — Gate 3 PR#17z §4.6).
- Per-`request_id` row lookups confirm `workspace_id`, `site_id`, `endpoint`, `auth_status`, `http_status`, `reject_reason_code` for every fixture (Gate 3 PR#17z §4.7).
- Staging Lane A/B counts on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` remained at `0` / `0` (Gate 3 PR#17z §4.8).
- No production endpoint, no production DB, no production token, no production pepper, no `/var/www`, no `endpointUrl` re-flip, no DB grant change, no customer-facing output (Gate 3 PR#17z §6).

Gate 3 PASS does **not** prove:

- **Scoring quality.** No claim about whether the per-event evidence (accepted_events + session_features + session_behavioural_features_v0_2 + POI observations + POI sequence observations + product-context timing observer output) is correctly interpreted by any scoring policy. Gate 3 fixtures were synthetic envelope-shape / validation-shape proofs, not real buyer-motion evidence.
- **Trust calibration.** No claim about model confidence, evidence confidence, or action confidence. No Trust dimensions are exercised by Gate 3.
- **Output governance.** No claim about what should or should not appear in any customer-facing report, Lane A/B preview report, or Evidence Review report.
- **Customer-safe reporting.** No customer-facing artefact exists; no Pass 1 / Trust / Pass 2 output path is exercised; no claim allowlist / denylist / fallback language is in place at runtime.
- **Lane A/B decision policy.** No `public.scoring_output_lane_a` / `public.scoring_output_lane_b` row is written by Gate 3. The Lane A/B preview observer (PR#16b) is read-only and produces no durable writes. There is no Lane A/B decision policy that could be invoked in production today.
- **Production transport-stage risk.** Gate 4 introduces website ThinSDK activation (`mode: 'sprint2_v1_event'`), `endpointUrl` re-flip, and live customer traffic. None of these surface area is exercised by Gate 3.

**Production activation should wait until the scoring / policy / trust / lane governance chain is updated.** Activating production `endpointUrl` re-flip + ThinSDK Sprint 2 mode before Pass 1 / Trust / Pass 2 / Lane A/B output governance is locked would put live buyer-event traffic onto a path that has no governed downstream scoring or output discipline — even if the transport layer itself is proven, the *meaning* of accepted events is not yet policy-bounded. The carry-forward note from the PR #31 follow-up applies here: **HTTP / DB-row outcomes are not the same as scoring / customer-safety outcomes.**

---

## 3. Carry-forward evidence from Gate 3

Categorical only. No secrets, no UUIDs, no raw payloads, no fixture body bytes, no response body bytes.

| Item | Value |
|---|---|
| Source | `docs/sprint2-pr17z-gate3-execution-proof.md` (PR #32, merged at `a35616b`) |
| Posture | staging-only, DB-backed (HTTP outcome alone did not carry the verdict) |
| Aggregate `ingest_requests` delta (bound to `buyerrecon_staging_ws` / `buyerrecon_com`) | **+4** |
| Aggregate `accepted_events` delta | **+2** |
| Aggregate `rejected_events` delta | **+1** |
| F1 verdict | **ACCEPTED** (browser/page page_view; HTTP 200; accepted_events=1; rejected_events=0) |
| F2 verdict | **ACCEPTED** (browser/track cta_click; HTTP 200; accepted_events=1; rejected_events=0) |
| F3 verdict | **VALIDATION-REJECT** (missing `event_name`; HTTP 200; accepted_events=0; rejected_events=1; reason=`event_name_invalid`; stage=`validation`) |
| F4 verdict | **ENVELOPE-REJECT** (top-level JSON array; HTTP 400; ingest reject_reason_code=`request_body_invalid_json`; accepted_events=0; rejected_events=0) |
| Lane A/B counts | `public.scoring_output_lane_a = 0` · `public.scoring_output_lane_b = 0` |
| Cleanup | header file shredded; token export file shredded; fixture / response files removed; env vars unset; no `/tmp/pr17z-*` residue |
| Production safety | no production endpoint contacted; no production DB queried; the 26 production `ingest_requests` canary evidence rows remain preserved; PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety untouched |
| Secret safety | no raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, or raw response body printed in any artefact |
| What Gate 3 PASS does NOT approve | Gate 4, production `endpointUrl` re-flip, production traffic, Render `/collect` replacement, `/var/www` edit, DB grant changes, Track A, Playwright, customer-facing output, Lane A/B writer, AMS Trust runtime, Pass 1 runtime, Pass 2 runtime, Timing / Product Context runtime execution, knobs / dashboard, website ThinSDK production activation, production artefact / config mode flip |

---

## 4. Proposed post-Gate-3 sequence

The chain from Gate 3 PASS to Gate 4 PASS must traverse the following stages, in order, with each stage gated by its own explicit Helen GO:

1. **Timing / Product Context refresh** — see §5. Determines whether the existing PR#13b observer is sufficient to seed downstream stages, or whether a refresh / re-read against post-Gate-3 staging evidence is required.
2. **Pass 1 planning / preview** — see §6. Defines the first internal policy / scoring preview layer; no customer output, no durable customer claims.
3. **Trust planning / preview** — see §7. Defines the multi-dimensional trust contract (evidence, model, action confidence + decay + AMS Trust shared-core alignment); no runtime AMS Trust integration in this stage.
4. **Pass 2 planning / preview** — see §8. Defines the customer-safety claim-gating layer that sits after Trust.
5. **Lane A/B preview + output governance** — see §9. Defines the Lane A / Lane B preview semantics, table-write governance, output redaction, customer-facing claim boundaries; no durable Lane A/B writer; no customer output.
6. **Gate 4 planning** — see §11. Plans the website ThinSDK activation + production artefact / config mode flip + `endpointUrl` re-flip + canary + rollback + Render `/collect` replacement decision + production monitoring.
7. **Gate 4 execution** — only after a separate Helen GO that explicitly cites the closed Pass 1 / Trust / Pass 2 / Lane A/B governance chain. No Gate 4 execution PR is opened until all preceding stages are closed.

Each numbered step (1 → 7) is a separate PR (see §13). No step is bundled. No step is pre-authorised by PR#18a.

---

## 5. Timing / Product Context

The first stage. Scope is **read-only refresh planning** — confirm that the existing PR#13b observer's evidence surface is adequate after Gate 3, or scope a refresh.

### 5.1 What this stage should do

- Review the current Product Context / Timing observer state defined by `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md` (§1–§17) and implemented by `docs/sprint2-pr13b-product-context-timing-observer.md` and the source under `src/scoring/product-context-timing-observer/`.
- Decide whether the existing PR#13b timing observer is sufficient as a seed for Pass 1, or whether a new observer refresh against post-Gate-3 staging data (or against the steady-state production-canary evidence — separately gated) is required.
- Confirm the evidence sources the observer reads: `accepted_events`, `session_features`, `session_behavioural_features_v0_2`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`, plus the product-context timing observer output table itself. Confirm whether any source has changed shape since PR#13b.
- Keep the stage **evidence / observation first**. No runtime scoring decision is emitted. No customer-facing output is produced. No production traffic is generated.

### 5.2 Forbidden in this stage

- No customer output of any kind.
- No runtime scoring decision (no policy gate based on observer output is enabled at runtime; observer remains read-only).
- No production traffic; no `curl` against any production endpoint; no `psql` against `buyerrecon_production`.
- No DB grant change; no new writer role.
- No knob / dashboard surface that exposes raw observer output to operators.

### 5.3 Open decisions

- **OD-T1.** Whether to refresh the observer after Gate 3 staging data is in the staging DB (e.g., re-run the observer against the four Gate 3 fixtures' rows to confirm shape stability), or to leave Gate 3 synthetic data out of any future observer evaluation entirely. Default proposal: exclude Gate 3 synthetic data from any commercial-context evaluation (it is non-customer fixture data); permit shape-validation re-reads only.
- **OD-T2.** Whether the four Gate 3 synthetic fixture rows in `ingest_requests` / `accepted_events` / `rejected_events` should be excluded from commercial scoring examples and from any Evidence Review report sample population (a synthetic-marker column or a separate workspace boundary may be required to enforce this; do not introduce a runtime-only marker that customers cannot inspect).
- **OD-T3.** Whether the timing windows defined in PR#13a §7 — `hot_now` / `warm_recent` / `cooling` / `stale` / `dormant` / `insufficient_evidence` — remain the v1 contract. Default proposal: yes, these remain v1 unless Pass 1 / Pass 2 require a different granularity that PR#13a has not anticipated.
- **OD-T4.** Whether confidence remains **capped** unless server-side evidence supports higher confidence (PR#13a §4 / §8 evidence-source-boundary rule). Default proposal: yes — confidence stays capped at the lowest evidence tier present, never elevated by client-side claim alone.
- **OD-T5.** Whether the observer needs any new metric (e.g., evidence-gap counts surfaced from Stage 0 / risk observations) to feed Pass 1 effectively, or whether Pass 1 can read raw observer output without amendment.

---

## 6. Pass 1

The first policy / scoring preview stage. Internal only. **Not customer output. Not durable customer claims. Not production traffic approval.**

### 6.1 What Pass 1 should do

- Consume evidence outputs from §5's Timing / Product Context observer (and possibly directly from raw evidence tables — see OD-P3) and produce **preview-only** candidate interpretations.
- Remain internal. Outputs are visible only to operator / Codex review / Evidence Review snapshot at internal granularity; nothing is emitted on a customer-facing surface.
- Not write customer-facing Lane A/B outputs. Specifically: Pass 1 must not INSERT or UPDATE any row in `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. The PR#17f / PR#17q grant-safety boundary stands.
- Not create durable production customer claims (no row in any customer-visible table, no API surface, no report rendered for customers).
- Not approve production traffic. Pass 1 is exercised against staging or replayed evidence only.

### 6.2 Forbidden in this stage

- No customer output.
- No durable production customer claim of any kind.
- No `public.scoring_output_lane_a` / `public.scoring_output_lane_b` write (existing grant safety per PR#17f / PR#17q remains the runtime steady state).
- No production runtime activation. Pass 1 is docs-first (its contract is locked before its implementation observer ships).
- No knob that lets an operator bypass Pass 1.

### 6.3 Open decisions

- **OD-P1.** Exact Pass 1 inputs. Candidates: Timing / Product Context observer output (PR#13b); session features + session behavioural features v0.2; POI core observations; POI sequence observations; risk observations v0.1; Stage 0 decisions. Final input list locks per workspace / site boundary discipline (no production data leakage).
- **OD-P2.** Whether Pass 1 is **docs-only first** (contract PR with no observer code) or **read-only observer first** (observer that emits Pass 1 preview rows into an internal table for Codex / Helen review, with no customer surface). Default proposal: docs-only contract PR first, observer PR second, both before any policy-runtime PR.
- **OD-P3.** Output shape — should Pass 1 emit a typed preview object per session / per workspace-window, or a per-event preview? What columns / fields are categorically permitted (per PR#13a §10 output boundary)?
- **OD-P4.** Forbidden claims — what assertions must Pass 1 explicitly refuse to make? Candidates: "this is a real buyer", "this user will convert", "this is a high-quality lead". The forbidden-claim allowlist is locked by Pass 2 (§8), but Pass 1's preview output must not pre-bake these claims either.
- **OD-P5.** Evidence thresholds — at what evidence tier does Pass 1 produce a non-`insufficient_evidence` preview? Default proposal: align with PR#13a §7 timing-window thresholds; never exceed the underlying evidence tier.

---

## 7. Trust

Trust is broader than a single "confidence" number. PR#18a defines Trust as a **multi-dimensional contract** that Pass 1 / Pass 2 will consume.

### 7.1 Dimensions Trust should distinguish

- **Score confidence** — how confident the scoring layer is in its own output, given the inputs. Affected by evidence completeness, model maturity, and policy stability.
- **Evidence confidence** — how confident the evidence pipeline is that the inputs to scoring are themselves correctly observed (PR#13a-style evidence-source-boundary, PR#17q grant-safety, PR#17u host-side hash proof, PR#17z Gate 3 DB-backed acceptance proof). Evidence confidence is a hard cap on score confidence.
- **Trust decay** — how confidence degrades over time as evidence ages, sessions go cold, or session boundaries are broken. Distinct from PR#13a timing windows (which classify timing, not decay rate).
- **Scoring-action trust** — how confident the layer is that a *recommended action* (if any were emitted — none are in PR#18a) corresponds to the observed evidence + score. Distinct from score confidence: a high-confidence score can map to a low-confidence action if the action is policy-bounded.
- **AMS shared-core Trust alignment** — where AMS shared-core Trust contracts already define a semantic, PR#18a's Trust contract must align (no double-namespacing, no contradiction). Alignment is **docs-only**; no runtime AMS Trust integration is introduced by PR#18a or by any PR in §13's sequence until separately planned.

### 7.2 What Trust should NOT be in v1

- A single number rolled up across all dimensions (that would collapse the multi-dimensional contract).
- A customer-visible field (Trust dimensions remain internal until Pass 2 / Lane governance opens specific outputs).
- A runtime AMS Trust integration (no AMS code is touched; no AMS endpoint is called; no AMS Trust row is read at runtime by PR#18a's sequence).

### 7.3 Open decisions

- **OD-Tr1.** Which trust dimensions are v1. Default proposal: all five named in §7.1, with explicit nulls when a dimension cannot be computed.
- **OD-Tr2.** How trust decay is represented — half-life in hours, session-boundary marker, evidence-age tier, or hybrid. Lock this before Pass 2 references it.
- **OD-Tr3.** Whether Trust consumes Timing / Product Context + Pass 1 output **or** raw evidence directly. Default proposal: Trust consumes Pass 1 output + a constrained set of evidence-confidence inputs from §5; it does not re-read raw evidence to avoid divergence from Pass 1's interpretation.
- **OD-Tr4.** How to prevent overclaim — a multi-dimensional Trust output is more honest, but each dimension must have a categorical "I cannot say" state distinct from "low confidence" to prevent Pass 2 from interpreting "low confidence" as "permission to claim weakly".
- **OD-Tr5.** How Lane B / AI-agent evidence remains **dark / internal** under Trust. Lane B's existence must not surface as a customer-visible claim, even at low confidence. Trust must reflect "this evidence is internal-only" categorically without emitting the Lane B reason on any customer surface.

---

## 8. Pass 2

The second policy / review layer. Sits **after Trust**. Its job is to gate what is allowed to leave the system as a claim — internal or external.

### 8.1 What Pass 2 should do

- Gate claims. Each claim type (e.g., "this lead has evidence of buyer intent", "this session shows product-context fit", "this traffic is not human-typical") must pass a Pass 2 rule that combines Trust dimensions, evidence completeness, and customer-safety constraints.
- Gate customer-visible language. Pass 2 owns the allowlist of phrases / claim shapes / numeric ranges that may appear on any customer-visible surface.
- Prevent weak or unsupported assertions from being rendered. Default behaviour for unsupported assertions is the §8.3 fallback language, not a guess.
- Separate Lane A from Lane B at the claim layer. Lane B reasons must not leak into Lane A claims or customer surfaces (per §9 / PR#16a §8).
- Preserve no customer output until explicitly approved. PR#18a, PR#18b … PR#18g do not turn any customer-visible surface on.

### 8.2 What Pass 2 should NOT do in v1

- Replace Trust. Pass 2 is a customer-safety gate over Trust, not a substitute for it.
- Generate customer-facing prose. Pass 2 emits structured claim allow / deny outcomes; copy generation, if any, belongs in a separate locked-down surface (Evidence Review / customer report) that does not enable customer output at runtime in v1.
- Bypass the Lane A/B grant-safety boundary. Pass 2 must not require `INSERT` / `UPDATE` privileges on `public.scoring_output_lane_a` / `public.scoring_output_lane_b`.

### 8.3 Open decisions

- **OD-P2-1.** Exact Pass 2 rule set. Candidates: minimum evidence-tier per claim type; minimum Trust dimension floor per claim type; consent gate; sample-population threshold; freshness window.
- **OD-P2-2.** Claim allowlist / denylist. The allowlist is the only path to a customer-visible claim; everything not on it is implicitly denied. Allowlist locks in a separate PR (proposed PR#18e per §13).
- **OD-P2-3.** Customer-safe thresholds — at what Trust + evidence combination does a claim become customer-safe? Default proposal: customer-safe thresholds are *strictly higher* than internal-Codex-review thresholds; an internal preview-passing claim is not automatically customer-safe.
- **OD-P2-4.** Fallback language when evidence is insufficient — categorical strings such as "insufficient evidence to characterise this session" or "no determination". Fallback language is the default, not the exception; the burden of proof sits on the claim.
- **OD-P2-5.** How Pass 2 interacts with the Evidence Review report and Lane A/B preview report (PR#16a §5 + §6 + §8). Likely: Pass 2 is the upstream gate; Evidence Review and Lane A/B reports inherit their customer-visibility from Pass 2's allowlist.

---

## 9. Lane A / B preview + output governance

The lane-governance stage. Builds on PR#16a's contract and PR#16b's read-only preview observer.

### 9.1 Lane definitions (carried forward from PR#16a §3)

- **Lane A** — invalid-traffic / non-buyer-motion evidence path. Potentially customer-facing **later**, after governance. Lane A claims must pass Pass 2 (§8) before any customer surface renders them.
- **Lane B** — AI-agent / good-bot / dark-internal evidence path. No customer output in v1 unless **separately approved** under a future PR with its own Helen GO. Lane B's existence must not leak into Lane A claims, into Evidence Review output, into customer reports, or into any operator-facing dashboard that is not Lane-aware.

### 9.2 Output ordering — preview → writer → customer output

The order is non-negotiable:

1. **Preview first.** Lane A and Lane B previews exist as read-only observer output (PR#16b is the existing preview observer; further preview observers may be added under their own PRs). Previews are visible internally only.
2. **Writer later.** A durable Lane A or Lane B writer that INSERTs rows into `public.scoring_output_lane_a` / `public.scoring_output_lane_b` requires its own PR with its own Helen GO and its own grant-safety amendment. **No such writer is introduced by PR#18a or by any §13 PR.** The PR#17f / PR#17q grant safety stands.
3. **Customer output last.** Customer-facing Lane A claims require Pass 2 approval (§8) **and** a separate customer-facing-surface PR. PR#18a does not start that surface.

### 9.3 Lane A/B table write governance

- `public.scoring_output_lane_a` and `public.scoring_output_lane_b` remain at the PR#17f / PR#17q grant-safety steady state: `buyerrecon_scoring_worker` has no `INSERT` / `UPDATE` / `DELETE`; `buyerrecon_internal_readonly` has `SELECT` only; `buyerrecon_customer_api` has no privileges.
- Gate 3 confirmed both tables remained at `count(*) = 0` per `(workspace_id, site_id)` (PR#17z §4.8).
- Any future writer requires a fresh grant amendment + a fresh PR + a fresh Helen GO. PR#18a forbids any such amendment.

### 9.4 Read access — who can read what

- `buyerrecon_internal_readonly` retains `SELECT` on both lane tables (per migration `016_scoring_output_lane_grant_safety.sql`). Used for Codex / internal review and Evidence Review snapshots.
- `buyerrecon_customer_api` has no `SELECT` on either lane table and must not receive any in v1. Customer-facing surfaces must consume Pass-2-allowed claim outputs, never raw lane rows.

### 9.5 Output redaction

- Lane B reasons are never surfaced on a customer surface. Lane B observations live behind an internal-only view (when implemented) or in the dark via the observer itself.
- Lane A claim language is governed by Pass 2's allowlist (§8.3 OD-P2-2). Numeric scores, raw evidence references, raw `request_id` / UUID values, raw payload bytes, and any token / hash / pepper / DSN material **never** reach a customer surface.

### 9.6 Customer-facing claim boundaries

- Customer-facing claims are limited to Pass-2-allowed phrases / shapes (§8.3 OD-P2-2 allowlist).
- "Lane A" / "Lane B" / "scoring output lane" / "invalid traffic" / "bot" / "AI agent" / "good bot" / similar internal taxonomy is **not** customer-visible language. Customer surfaces, when they exist, render Pass-2 outputs in customer-facing copy that does not name the lanes.
- Evidence Review report (PR#16a §5) may consume preview evidence later **internally**, never as customer output, until a separate PR opens that path with its own Helen GO.

### 9.7 No Lane B leakage into customer output

PR#16a §3 / §6 / §8 already record this as a hard rule. PR#18a re-affirms it: Lane B reasons, Lane B counts, Lane B presence/absence, and any inference derivable from Lane B's existence are off-limits for customer surfaces. Pass 2 must enforce this categorically.

---

## 10. Knobs / dashboard / operator controls

**Future work only.** No knob, no dashboard, no operator control is introduced by PR#18a or by any PR in §13's sequence until policy / Trust / lane semantics are stable.

- Thresholds / knobs **must not exist before policy / trust semantics are stable.** A knob that mutates Pass 2's allowlist or Trust's decay rate before §6 / §7 / §8 are locked turns the governance into shifting sand.
- Dashboards **must not expose raw or unsafe evidence.** Raw `request_id` UUIDs, raw payload columns, `token_hash` / DSN material, Lane B rows, or unredacted internal observations are not dashboard-eligible. A future dashboard PR must inherit Pass 2's redaction discipline.
- Knobs **must not let operators bypass Trust or Pass 2.** No "force-pass" / "manual-override" / "ignore-fallback" knob is acceptable in v1. Overrides, if any, require their own audited workflow and post-Pass-2 governance.
- No implementation in PR#18a. No `src/` change, no `scripts/`, no `tests/`, no migration, no schema change, no env-var, no systemd unit, no Nginx file.

---

## 11. Relationship to Gate 4

Gate 4 is **later**, after §5 → §9 are closed (in addition to any new Trust / Pass 1 / Pass 2 / Lane governance PRs that emerge during planning).

### 11.1 What Gate 4 will eventually cover

- **Website ThinSDK activation** — `mode: 'sprint2_v1_event'` in the production init's `ThinSDK.init({...})` options (per PR#17y §11 and `docs/ops/cutover-hard-gates.md`).
- **Production artefact / config mode flip** — the buyerrecon.com production `thinlayer/thin-sdk.iife.js` artefact (PR#17u-confirmed hash) plus the init config that selects Sprint 2 envelope mode.
- **`endpointUrl` re-flip** — buyerrecon.com ThinLayer's `endpointUrl` moved from Render legacy (`https://buyerrecon-backend.onrender.com/collect`) to the production Sprint 2 collector (`https://buyerrecon.com/v1/event` per the PR#17o Nginx route).
- **Canary / rollback** — a defined canary scope (which workspace / site / sub-population), an explicit one-step rollback target (Render legacy `/collect`), and the categorical rollback criteria.
- **Render `/collect` replacement decision** — whether to retire the Render legacy collector after canary stability is proven, or to retain it as a long-term fallback. This is a separate sub-step within Gate 4 planning.
- **Production monitoring** — categorical evidence collection during canary, including the boundary rules of PR#17z §6 (no raw payload / no `request_id` UUID value / no token / hash / pepper printed in monitoring artefacts).

### 11.2 What PR#18a does NOT do for Gate 4

- PR#18a does **not** start Gate 4. No Gate 4 planning PR is opened by PR#18a; that is PR#18g per §13.
- PR#18a does **not** pre-authorise any Gate 4 sub-step. The Gate 4 PR sequence (PR B bundle deploy / PR C `endpointUrl` re-flip + mode activation / PR D organic observation / PR E Track A) remains separately gated as in PR#17y §12.
- PR#18a does **not** edit `docs/ops/cutover-hard-gates.md`. Any Gate-4 contract change belongs in its own PR with its own Helen GO.

---

## 12. Non-goals

PR#18a explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No code changes.** No `src/`, no `scripts/`, no `tests/` (other than the docs file added by PR#18a itself).
- **No DB changes.** No SQL migration, no `schema.sql` edit, no `INSERT` / `UPDATE` / `DELETE` / `GRANT` / `REVOKE`.
- **No migrations.** Migration `016_scoring_output_lane_grant_safety.sql` remains the runtime grant-safety boundary.
- **No `schema.sql` edit.** The canonical schema mirror remains unchanged.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Gate 4.** No Gate 4 sub-step planned, executed, or pre-authorised.
- **No Track A.** Track A remains gated under PR#17e (or successor) and is not invoked.
- **No Playwright.** No headless / programmatic browser run.
- **No customer-facing output.** No Pass 1 / Trust / Pass 2 customer surface exists; none enabled.
- **No Lane A/B writer.** No `INSERT` to `public.scoring_output_lane_a` / `public.scoring_output_lane_b`. PR#17f / PR#17q grant safety stands.
- **No AMS runtime changes.** No AMS source change, no AMS endpoint call, no AMS Trust runtime integration.
- **No `endpointUrl` re-flip.** `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy.
- **No `/var/www` edit.** Hetzner host's `/var/www/buyerrecon.com/html/thinlayer/*.js` files remain at PR#17u-confirmed hashes.
- **No website artefact changes.** `thinlayer/thin-sdk.iife.js` and related bundles untouched.
- **No knobs / dashboard implementation.** §10 forbids implementation in v1.
- **No production artefact / config mode flip.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this doc.

---

## 13. Recommended next PRs after PR#18a

The following sequence is the **recommended** path. Each PR is its own scope, requires its own Helen GO, and is **not** pre-authorised by PR#18a. No PR below is implemented or opened by PR#18a.

- **PR#18b — Timing / Product Context observer refresh planning** (or read-only refresh). Locks OD-T1 → OD-T5 (§5.3) and either (a) confirms PR#13b is sufficient and PR#18b becomes a docs-only confirmation, or (b) scopes a read-only refresh observer PR.
- **PR#18c — Pass 1 output contract planning.** Locks OD-P1 → OD-P5 (§6.3). Docs-only contract PR; no observer code; no policy runtime.
- **PR#18d — Trust contract planning.** Locks OD-Tr1 → OD-Tr5 (§7.3). Docs-only; defines the five Trust dimensions, decay representation, AMS shared-core alignment statements (without integrating AMS at runtime).
- **PR#18e — Pass 2 / claim governance planning.** Locks OD-P2-1 → OD-P2-5 (§8.3). Docs-only; defines the claim allowlist / denylist / fallback-language contract; references Trust + Pass 1 outputs.
- **PR#18f — Lane A/B preview governance planning.** Locks any remaining lane-governance OD items from §9 not already covered by PR#16a; defines what (if anything) needs to change in the preview observer before a future writer PR is even planned.
- **PR#18g — Gate 4 planning only, after scoring chain is aligned.** Plans the website ThinSDK activation + production artefact / config mode flip + `endpointUrl` re-flip + canary + rollback + Render `/collect` replacement decision + production monitoring. Docs-only; does not execute Gate 4.

**None of PR#18b–PR#18g is implemented, opened, or pre-authorised by PR#18a.** Helen GO is required for each independently.

---

## 14. Acceptance criteria for PR#18a

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md`). No other files touched. No code / scripts / tests / package / migrations / schema / env / systemd / Nginx / AMS / website / production-config changes.
- **Post-Gate-3 sequence is explicit.** §4 numbered list 1 → 7 is the chain.
- **Gate 4 paused.** §1, §2, §11, §13 all state Gate 4 is not started and not pre-authorised.
- **Downstream non-approvals are clear.** §1, §11, §12 enumerate the long-form non-approval list and PR#18a forbids each item.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.
- **No production / customer / runtime actions.** No `curl`, no `psql`, no production endpoint contacted, no customer surface enabled, no runtime scoring decision emitted, no Lane writer activated, no grant changed.

---

End of PR#18a. **Verdict: PLANNING ONLY — no implementation, no execution, no Gate 4 work. The post-Gate-3 sequence (Timing / Product Context → Pass 1 → Trust → Pass 2 → Lane A/B preview + output governance → Gate 4 planning → Gate 4 execution) is recorded for Helen's review. Each subsequent PR (PR#18b → PR#18g and any Gate 4 PR thereafter) requires its own separate Helen GO under `docs/ops/cutover-hard-gates.md`; no Gate 4 sub-step, production `endpointUrl` re-flip, production traffic, Render `/collect` replacement, `/var/www` edit, DB grant change, Track A, Playwright, customer-facing output, Lane A/B writer, AMS Trust runtime, Pass 1 runtime, Pass 2 runtime, Timing / Product Context runtime execution, knobs / dashboard implementation, website ThinSDK production activation, or production artefact / config mode flip is approved by PR#18a.**
