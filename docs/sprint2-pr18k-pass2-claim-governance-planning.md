# BuyerRecon PR#18k — Pass 2 claim-governance contract planning after Trust contract

Status: **docs-only planning record. Verdict: PLANNING ONLY — Pass 2 claim-governance contract planning. No Pass 2 runtime, no Trust runtime, no Pass 1 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no Gate 4 work.**

PR#18k is the next step in the post-Gate-3 chain defined by PR#18a → PR#18b → PR#18c → PR#18d → PR#18e → PR#18i (Pass 1 contract v0.2) → PR#18j (Trust contract v0.1). The Trust output contract is now locked at version `trust-contract-v0.1` (PR#18j, PR #42 merged at `0a9f7d7`) and consumes Pass 1 at `pass1-output-contract-v0.2`. PR#18k locks the **Pass 2 claim-governance contract** — the shape of the preview-only candidate that consumes a `TrustCandidate` and produces a `Pass2ClaimGovernanceCandidate` governing claim language, customer-safe wording, evidence thresholds, and output blocking — without authorising any Pass 2 runtime, customer-facing surface, Lane A/B output, or AMS runtime bridge.

PR#18k is a **planning document only**. It introduces no implementation. It does not write any Lane A/B row, does not invoke AMS Pass 2 runtime, does not modify the AMS repository, does not change schema / migrations / production config / `/var/www` / `endpointUrl`, and does not touch any production endpoint. Each subsequent PR (any future Lane A/B governance planning PR, any future Gate 4 planning PR, and any runtime-implementation PR for Pass 1 / Trust / Pass 2) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18k.**
> **No production traffic is approved by PR#18k.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18k; no production artefact / config mode flip is approved by PR#18k.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18k.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18k.**
> **PR#18k is planning-layer only. It does NOT amend the Pass 1 v0.2 contract or the Trust v0.1 contract. It does NOT pre-authorise any runtime PR.** Any future Lane A/B governance planning PR, future Gate 4 PR, or future Pass 1 / Trust / Pass 2 runtime PR remains separately gated by its own explicit Helen GO.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `0a9f7d7` — "Sprint 2 PR#18j: clarify Trust dimension enums (#42)").

PR branch: `buyerrecon-sprint2-pr18k-pass2-claim-governance-planning`

Contract version: **`pass2-claim-governance-contract-v0.1`** (frozen-literal; rev-locked under PR#18k). Any future change requires a new contract version stamp and its own PR.

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic chain. PR#18k is the Pass 2 / claim-governance step in PR#18a §13's sequence (Pass 2 planning follows Trust planning; precedes Lane A/B governance planning).
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — the Pass 1 output contract at v0.2 (amended by PR#18i). Pass 1 is upstream of Trust, which is upstream of Pass 2.
- `docs/sprint2-pr18i-pass1-risk-evidence-amendment.md` — Pass 1 v0.1 → v0.2 amendment record (four-state `risk_evidence_status` enum).
- `docs/sprint2-pr18j-trust-contract-planning.md` — the Trust output contract at v0.1. PR#18k Pass 2 input is the `TrustCandidate` shape it locks.
- `docs/sprint2-pr18h-timing-observer-risk-reproof.md` — the staging proof that closed the `risk_observations_v0_1` warning chain.
- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — the original observer staging proof that motivated the risk-evidence carry-forward.
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — the Timing / Product-Context refresh plan, including PR#18b §4 AMS dirty-worktree-is-reference-only rule (re-affirmed in §11 below).
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A / Lane B Evidence Review contract baseline; PR#18k's `lane_visibility_decision` respects PR#16a's Lane B dark-internal posture and PR#16a §8 customer-wording rules.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md` — AMS reserved-name guard re-asserted in §6 forbidden outputs / §7 denylist / §11 AMS posture.

---

## 1. Status / verdict

**PLANNING ONLY — Pass 2 claim-governance contract planning. No Pass 2 runtime, no customer output, no Lane writer, no Gate 4.**

- PR#18k defines the *shape* of the Pass 2 preview-only candidate (§5) plus the closed six-value `claim_governance_status` enum (§6), the v0.1 empty allowlist + explicit denylist for customer-facing language (§7), and the evidence-grade rules (§8).
- PR#18k does NOT implement Pass 2. No `src/scoring/pass2/` module is introduced. No CLI script. No DB query. No DDL. No DML.
- PR#18k does NOT authorise any Pass 2 runtime invocation against any data source — staging or production.
- PR#18k does NOT authorise any customer-facing surface. The Pass 2 candidate is internal-only by contract; any future Lane A/B governance planning PR and any future customer-surface PR are the gates for downstream visibility.
- PR#18k does NOT pre-authorise any future Lane A/B governance planning PR or future Gate 4 planning PR. Each is a separately-gated PR.
- PR#18k does NOT amend the Pass 1 v0.2 contract or the Trust v0.1 contract. Both carry forward unchanged.
- PR#18k does NOT amend the AMS reserved-name guard (PR#14a §10); Pass 2 outputs MUST NOT redefine AMS canonical names (`ProductDecision`, `RequestedAction`, `TrustDecisionV3`, `Fit`, `Intent`, `Window`, etc.).

---

## 2. Why Pass 2 comes after Trust

Pass 2 sits **after** Trust in the planning chain. The four-layer separation:

| Layer | Question | Owned by |
|---|---|---|
| Observer (PR#18c / PR#18g) | What did we read from the evidence sources? | BuyerRecon read-only observer |
| Pass 1 (PR#18e v0.2 / PR#18i) | What is the categorical interpretation of those observations? | BuyerRecon planning contract |
| Trust (PR#18j v0.1) | How reliable is the Pass 1 interpretation? | BuyerRecon planning contract |
| **Pass 2 (PR#18k v0.1)** | **What claim language is governed — claimable, blocked, deferred, internal-only? Is any customer-facing output eligible at all?** | **BuyerRecon planning contract** |
| Lane A/B governance (future planning PR) | Which lane (if any) does a candidate ultimately surface in? | BuyerRecon planning contract (future) |
| Customer surface (future PR) | What renders to the customer? | Future surface PR |
| AMS Policy / Trust runtime (AMS-owned) | Production decisioning | AMS (reference-only for BuyerRecon today) |

Pass 2 is **not Trust**: Trust evaluates the reliability of each dimension; Pass 2 governs whether *any* claim-language assertion would be safe given that reliability — and if so, what shape.

Pass 2 does **not itself create Lane A/B writes or customer output** in PR#18k. It produces a categorical governance candidate that a future Lane A/B governance planning PR may consume; the final customer-surface gate is a separate downstream PR.

Pass 2 is the layer where the **default is fail-closed for customer language**: the v0.1 contract emits `allowed_customer_language = []` (empty array) in every candidate. The denylist (§7) is explicit and binding; the allowlist remains empty until a future contract version (`pass2-claim-governance-contract-v0.2` or higher) adds entries under its own Helen GO + Codex review.

---

## 3. Pass 2 input contract

Pass 2's **only** sanctioned input is the `TrustCandidate` shape locked by PR#18j at contract version `trust-contract-v0.1`. PR#18k does not read raw observer output, does not read raw Pass 1 candidates, does not read raw DB rows, does not read AMS contracts at runtime, and does not bypass Trust.

### 3.1 Allowed inputs (the v0.1 TrustCandidate fields)

| Field | Source | Use in Pass 2 |
|---|---|---|
| `trust_contract_version` | PR#18j v0.1 | Must equal `'trust-contract-v0.1'`. Pass 2 refuses inputs from older or newer Trust versions until separately upgraded. |
| `source_pass1_contract_version` | PR#18j v0.1 | Carried forward into the Pass 2 candidate for audit; must equal `'pass1-output-contract-v0.2'`. |
| `evidence_trust` | PR#18j §4.1 | Primary input to §8 `evidence_grade`. |
| `timing_trust` | PR#18j §4.2 | Influences §8 `evidence_grade` and the §6 `claim_governance_status`. |
| `product_context_trust` | PR#18j §4.3 | Influences §8 `evidence_grade` and the §6 status. |
| `risk_trust` | PR#18j §4.4 | If `'not_usable'`, Pass 2 emits `claim_blocked` and risk-backed customer claims remain forbidden (regardless of any other dimension). |
| `action_trust` | PR#18j §4.5 | If `'not_authorized'`, Pass 2 does NOT emit `lane_a_preview_possible`; the gate is hard. |
| `lane_visibility_trust` | PR#18j §4.6 | Carried directly into Pass 2's `lane_visibility_decision`. If Trust says `'blocked'`, Pass 2 also says `'blocked'`. |
| `trust_summary` | PR#18j §5.2 | Read as a categorical input only. Pass 2 does NOT override or upgrade Trust's summary. |
| `trust_blockers` | PR#18j §5.3 | If non-empty, Pass 2 emits `claim_blocked` or `not_claimable` (depending on which labels fired). Pass 2 NEVER overrides a Trust blocker. |
| `trust_warnings` | PR#18j §5.3 | Carried forward as categorical labels; may downgrade the §8 `evidence_grade` or `claim_governance_status`. |
| `pass_to_pass2_planning` | PR#18j §5.4 | Pass 2 only evaluates candidates where this gate is `true`. When `false`, Trust stopped at preview and Pass 2 does not see the candidate. |
| `customer_claim_allowed = false` | PR#18j contract lock | Pass 2 verifies the input enforces this; Pass 2 output also locks at `false`. |
| `lane_output_allowed = false` | PR#18j contract lock | Pass 2 verifies the input enforces this; Pass 2 output also locks at `false`. |
| `trust_candidate_id` | PR#18j §5.4 | Carried into Pass 2 output's `pass2_candidate_id` derivation. Never the raw session_id. |

### 3.2 Forbidden inputs

Pass 2 must NEVER read or accept any of the following as input — neither directly from a DB, nor from any intermediate surface, nor as a smuggled field on a Trust candidate:

- **Raw `session_id`.** Only redacted forms permitted via `trust_candidate_id`.
- **`request_id` UUID values.** Used by the observer for grouping; never reach Pass 1, Trust, or Pass 2.
- **Raw payload bytes** of any kind (`accepted_event.raw`, `canonical_jsonb`, encoded request body, response body, fixture body).
- **Full URLs with query strings.** Categorical referrer-class is acceptable only if locked to a known allowlist by a separate PR; full URLs never reach Pass 2.
- **Token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header values.**
- **Synthetic Gate 2 / Gate 3 / Gate-N proof rows as commercial evidence.** Already excluded by the observer (PR#18c §4 / PR#18b §6) and not present in Pass 1 / Trust candidates that reach Pass 2.
- **Lane B / AI-agent evidence as customer-visible input.** Pass 2 may receive `lane_visibility_trust = 'blocked'` from Trust and propagate that as `lane_visibility_decision = 'blocked'`; it must NOT surface Lane B's existence beyond the categorical statement. No Lane B reason text reaches any downstream surface through Pass 2.
- **Direct AMS dirty-worktree shapes.** Per PR#18b §4.1.1, any AMS observation against a dirty AMS working tree is reference-only and non-contractual. Pass 2 must NOT consume an AMS field, struct, or JSON key whose authoritative form was only seen in a dirty AMS worktree — only fields that exist on a clean committed AMS HEAD (or are explicitly cited by an AMS commit/PR merged into AMS `main`) are eligible inputs to any future Pass 2 runtime PR.
- **`ProductDecision` / `RequestedAction` final outputs.** These are AMS canonical runtime types (per `internal/contracts/features.go` + `internal/policy/pass2.go`). Pass 2 does NOT accept these as inputs nor emit them as outputs.
- **Any customer-facing text generated upstream.** Pass 2's input is a categorical Trust candidate, not a customer-claim draft. If any upstream layer attempted to smuggle customer-claim text into the Trust candidate, Pass 2 categorically refuses to consume that field.

---

## 4. Pass 2 purpose

Pass 2 is a **claim-governance layer**. It decides, in planning form only, what categorical disposition to attach to each Trust-vouched candidate before any customer-visible surface, Lane A/B writer, or downstream report could consume it.

### 4.1 What Pass 2 decides (in planning form)

- **Whether a preview candidate is claimable later.** A candidate that survives Trust may still be `not_claimable` at Pass 2 if the evidence grade is insufficient or specific blockers fire.
- **Whether evidence is too weak.** Pass 2 emits `insufficient_evidence` as a categorical status (distinct from `claim_blocked` — see §6).
- **Whether wording must be blocked or downgraded.** Pass 2 owns the `allowed_customer_language` allowlist (empty in v0.1) and the `forbidden_customer_language` denylist (explicit list per §7).
- **Whether Lane A could later be visible.** Only candidates whose `lane_visibility_trust = 'lane_a_preview_only'` (from Trust) AND whose `action_trust = 'planning_only'` AND no Trust blockers fired AND evidence-grade gates pass MAY receive `lane_a_preview_possible`. Even then, **PR#18k does NOT authorise Lane A preview emission**; that is the future Lane A/B governance planning PR's scope.
- **Whether Lane B must remain dark / internal.** Categorically yes, always, via `lane_visibility_decision = 'blocked'` when Trust signalled Lane B presence.
- **Whether customer-facing claims are forbidden.** The v0.1 default is *always forbidden* — `customer_claim_allowed = false` is a contract lock.

### 4.2 What Pass 2 must NOT do

- **Produce customer output in PR#18k.** No customer-surface emission; `allowed_customer_language = []` is the v0.1 contract.
- **Write Lane A/B.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **Trigger actions.** No `RequestedAction` emission. No automated workflow trigger.
- **Override Trust blockers.** Trust blockers carry forward into Pass 2 categorically. Pass 2 NEVER promotes a Trust-blocked candidate to a non-blocked Pass 2 status.
- **Create final classifications.** No "this is a buyer", "this is a bot", "this is invalid traffic" output. Pass 2 governs claim language; it does not produce the claims.

---

## 5. Pass 2 output contract

The Pass 2 output is a **preview-only governance candidate**. One candidate per (input `TrustCandidate` where `pass_to_pass2_planning = true`). Pass 2 emits no row when Trust did not pass forward.

### 5.1 Contract shape (v0.1)

```
Pass2ClaimGovernanceCandidate {
  pass2_contract_version:           'pass2-claim-governance-contract-v0.1'
  source_trust_contract_version:    'trust-contract-v0.1'
  source_pass1_contract_version:    'pass1-output-contract-v0.2'
  pass2_candidate_id:               string              // observer/Pass-1/Trust-redacted id form; NEVER the raw session_id

  claim_governance_status:          Pass2GovernanceStatus  // §6 categorical enum only — NEVER customer-facing prose

  claim_blockers:                   readonly string[]   // categorical labels only (subset of §6.1)
  claim_warnings:                   readonly string[]   // categorical labels only (subset of §6.1)

  allowed_customer_language:        readonly string[]   // ALWAYS empty in v0.1 — locked at the contract
  forbidden_customer_language:      readonly string[]   // categorical labels from §7 denylist

  evidence_grade:                   'low' | 'medium' | 'not_usable'

  lane_visibility_decision:         'internal_only' | 'lane_a_preview_only' | 'blocked'

  pass_to_lane_governance_planning: boolean

  customer_claim_allowed:           false               // ALWAYS false in v0.1 — locked at the contract
  lane_output_allowed:              false               // ALWAYS false in v0.1 — locked at the contract
}
```

### 5.2 Field discipline

- **`pass2_contract_version`**: literal `'pass2-claim-governance-contract-v0.1'`. Pass 2 v0.2 (or higher) requires a separate amendment PR with its own Helen GO.
- **`source_trust_contract_version`**: literal `'trust-contract-v0.1'`. If the input Trust contract version differs, Pass 2 refuses to evaluate the candidate (categorical contract-mismatch handling; emits no Pass 2 candidate).
- **`source_pass1_contract_version`**: literal `'pass1-output-contract-v0.2'`. Carried forward from the Trust candidate for audit.
- **`pass2_candidate_id`**: a categorical, internally-routable identifier. Derivation: hash of (`trust_candidate_id`, `pass2_contract_version`) — *not* a hash that can be reversed to the full session_id. Never a UUID generated from a request_id. The exact derivation is locked when the first Pass 2 read-only observer ships (separate PR, separate Helen GO); PR#18k only fixes the *field name* and its categorical contract.
- **`claim_governance_status`**: the single categorical enum chosen from §6. **Never a free-form string. Never customer-facing prose.**
- **`claim_blockers` / `claim_warnings`**: arrays of categorical labels from §6.1. **Never sentences. Never customer-facing. Never PII.**
- **`allowed_customer_language`**: ALWAYS `[]` in v0.1 — locked at the contract. Even when `claim_governance_status = 'lane_a_preview_possible'`, the allowlist remains empty in v0.1. Adding any entry requires a contract version bump.
- **`forbidden_customer_language`**: categorical labels from the §7 denylist. Pass 2 emits whichever denylist labels would apply if a future surface attempted to render this candidate. **The denylist is binding even though the surface does not exist yet.**
- **`evidence_grade`**: `'low' | 'medium' | 'not_usable'`. **Never `'high'`.** Per §8 rules; capped by Trust dimensions.
- **`lane_visibility_decision`**: `'internal_only' | 'lane_a_preview_only' | 'blocked'`. Derived from `lane_visibility_trust` (PR#18j §4.6) plus Pass 2's own evidence-grade and blocker checks. NEVER stronger than what Trust signalled.
- **`pass_to_lane_governance_planning`**: a binary gate to a future Lane A/B governance planning PR. It is `true` only when `claim_governance_status ∈ {'lane_a_preview_possible'}` AND no `claim_blockers` fired AND `evidence_grade ≠ 'not_usable'` AND `lane_visibility_decision ≠ 'blocked'`. For all other status values, it is `false`.
- **`customer_claim_allowed`** and **`lane_output_allowed`**: ALWAYS `false` in this contract. Future PRs that want to flip either flag must amend the contract under a new version stamp (`pass2-claim-governance-contract-v0.2` or higher) with their own PR + Helen GO + Codex review. **PR#18k does NOT change either flag.**

### 5.3 No raw fields in the contract

Explicit list of fields that MUST NOT exist anywhere in `Pass2ClaimGovernanceCandidate` or its serialised form:

- `session_id` (full form) / `raw_session_id`.
- `request_id` / `request_uuid` / any UUID-shaped string field.
- `raw_event` / `payload` / `canonical_jsonb` / `request_body` / `response_body`.
- `url` / `full_url` / `referrer_full`.
- `token` / `token_hash` / `token_prefix` / `token_suffix` / `token_id` / `pepper` / `database_url` / `dsn` / `authorization` / `bearer`.
- `customer_claim_text` / `customer_message` / `marketing_copy` / `lead_score` / `revenue_estimate` / `pipeline_estimate`.
- `ProductDecision` / `RequestedAction` / `TrustDecisionV3` (AMS canonical types — PR#14a §10 reserved-name guard).

---

## 6. Allowed claim-governance statuses

The `Pass2GovernanceStatus` enum is **closed**. Pass 2 emits one of these six categorical values and nothing else. **No free-form claim text. No customer-facing prose. No final classifications.**

| Enum value | Categorical meaning |
|---|---|
| `not_claimable` | The Trust candidate is internally valid but no customer-facing claim is supportable given current evidence + governance posture. `pass_to_lane_governance_planning = false`. |
| `claim_blocked` | A specific blocker fired (Trust blocker carried forward, risk-evidence status non-usable, Lane B observed, synthetic-only origin, etc.). `pass_to_lane_governance_planning = false`. |
| `claim_deferred` | Categorical "not now" — evidence is partially supported but Pass 2 needs more time / a future contract version / additional evidence sources before a customer-facing path is even theoretically considered. Distinct from `not_claimable` (which says: never, given current rules) and from `insufficient_evidence` (which says: the evidence simply isn't there). `pass_to_lane_governance_planning = false` in v0.1. |
| `internal_review_only` | The candidate is interpretable internally (e.g. for Codex / Helen review, Evidence Review snapshot internal posture); no customer surface is even theoretically reachable from this status. `pass_to_lane_governance_planning = false`. |
| `lane_a_preview_possible` | Trust signalled `lane_visibility_trust = 'lane_a_preview_only'`, Pass 2's blockers are empty, evidence grade is at least `'low'`, and the candidate would be eligible for the **future** Lane A/B governance planning PR's evaluation. **PR#18k does NOT authorise Lane A preview emission**; this status only marks eligibility. `pass_to_lane_governance_planning = true`. |
| `insufficient_evidence` | The Trust candidate already reported `'not_usable'` on a required dimension (evidence_trust / timing_trust / product_context_trust). Categorically distinct from `not_claimable` (which has evidence but no claimable path) and from `claim_deferred` (which has partial evidence but no governance-eligible path yet). `pass_to_lane_governance_planning = false`. |

### 6.1 Allowed labels for `claim_blockers` and `claim_warnings`

Both fields carry only categorical labels from the same enum set. **No free-form strings. No customer-facing prose. No PII.**

Allowed labels (extendable by a future contract version):

- `trust_summary_blocked_*` (where `*` is one of PR#18j §5.2's `blocked_by_*` values: `synthetic_only`, `missing_evidence`, `risk_status`, `lane_b_visibility`)
- `trust_blocker_carried_forward` (when any `trust_blockers` from §3.1 input was non-empty)
- `trust_warning_carried_forward`
- `evidence_trust_not_usable`
- `timing_trust_not_usable`
- `product_context_trust_not_usable`
- `risk_trust_not_usable`
- `risk_evidence_status_unavailable`
- `risk_evidence_status_warning`
- `risk_evidence_status_blocked`
- `lane_b_dark_internal_observed`
- `lane_visibility_trust_blocked`
- `action_trust_not_authorized`
- `synthetic_only_excluded_in_evidence`
- `insufficient_evidence_in_pass1`
- `optional_source_missing_in_pass1`
- `evidence_confidence_cap_low`
- `evidence_grade_not_usable`
- `pass_to_lane_governance_planning_gate_failed`

### 6.2 What is explicitly NOT in the status enum

No `ready_to_buy`, no `high_intent`, no `buyer_is_human`, no `visitor_is_ai_agent`, no final bot classification, no final invalid traffic conclusion, no `lead_score`, no `conversion_probability`, no `revenue` claim, no `pipeline` claim, no automated action recommendation. These categorical absences are part of the v0.1 contract and removable only via a new contract version stamp.

---

## 7. Claim allowlist / denylist

For Pass 2 v0.1:

- **The customer-facing claim allowlist is empty.** `allowed_customer_language = []` is locked at the contract for every candidate, regardless of `claim_governance_status`. Adding any allowlist entry requires `pass2-claim-governance-contract-v0.2` (or higher) with its own PR + Helen GO + Codex review.
- **The denylist is explicit and binding.** Pass 2 categorically refuses to emit any customer-facing claim from the list below; the `forbidden_customer_language` field on each candidate carries the categorical denylist labels that would apply.

### 7.1 Forbidden customer claims (explicit denylist — v0.1)

The denylist is binding for every Pass 2 candidate, regardless of evidence grade, regardless of Trust dimensions, regardless of future contract amendments unless they explicitly remove a denylist entry (which itself requires a new contract version + PR + Helen GO).

| Forbidden phrase / pattern | Categorical label |
|---|---|
| "This visitor is ready to buy" / any "ready to buy" wording | `deny_ready_to_buy` |
| "This visitor has high intent" / "high-intent prospect" / "warm prospect" | `deny_high_intent` |
| "This visitor is human" / final human classification | `deny_final_human_classification` |
| "This visitor is an AI agent" / final AI-agent classification | `deny_final_ai_agent_classification` |
| "This is invalid traffic" / final invalid-traffic conclusion | `deny_final_invalid_traffic` |
| "This is a qualified lead" / "MQL" / "SQL" categorical | `deny_qualified_lead` |
| "This account is in-market" / "in-market account" | `deny_in_market_account` |
| "This session will convert" / any conversion-probability claim | `deny_conversion_probability` |
| "Revenue opportunity" / "$X expected revenue" | `deny_revenue_claim` |
| "Pipeline generated" / "ARR impact" / "pipeline impact" | `deny_pipeline_claim` |
| Any score or ranking presented as customer-visible truth | `deny_customer_visible_score` |
| Any Lane B / AI-agent claim shown to a customer | `deny_lane_b_customer_visible` |
| Any "real buyer" / "genuine traffic" final assertion | `deny_final_buyer_or_genuine_classification` |
| Any automated next-step action recommendation | `deny_automated_action_recommendation` |

### 7.2 Safe internal-only language examples

The following phrases are acceptable in **internal-only** contexts (e.g., Codex review, Evidence Review report internal posture, audit logs that do not reach customers). They are NOT customer outputs in PR#18k, and PR#18k does NOT authorise any surface to render them to customers:

- "insufficient evidence"
- "timing context observed"
- "product-context evidence present"
- "requires Trust review"
- "claim blocked by evidence policy"
- "internal review only"
- "Lane B observation present — kept dark per governance"
- "synthetic / control traffic excluded"
- "candidate deferred pending evidence"

These examples are **not** part of the `allowed_customer_language` allowlist (which is empty in v0.1). They are categorical descriptions for internal audit and review surfaces only.

### 7.3 Denylist enforcement rule

Pass 2 emits `forbidden_customer_language` populated with the categorical labels above on every candidate where the candidate's underlying evidence would, if naïvely rendered, trigger one of those phrases. The field is informational + audit-only; PR#18k does NOT introduce a runtime path that consumes it. A future customer-surface PR consumes the denylist as a hard pre-render gate.

---

## 8. Evidence-grade rules

`evidence_grade` is a categorical statement of the underlying evidence quality at the Pass 2 layer. Three values: `'low' | 'medium' | 'not_usable'`. **`'high'` is never emitted by Pass 2 v0.1.**

### 8.1 Derivation rules

- **`'not_usable'`** when any of:
  - Any `trust_blockers` are non-empty.
  - `evidence_trust = 'not_usable'` OR `timing_trust = 'not_usable'` OR `product_context_trust = 'not_usable'`.
  - `risk_trust = 'not_usable'` AND the candidate's underlying evidence references risk-observation evidence.
  - `pass_to_pass2_planning = false` (would not reach Pass 2 — included here for defence-in-depth).
- **`'low'`** when none of the `'not_usable'` conditions hold AND any of:
  - Evidence is single-source (per `evidence_trust = 'low'`).
  - Timing is stale (`timing_trust = 'low'` because the band is `cooling` or `stale`).
  - Product context is single-source (`product_context_trust = 'low'`).
  - Synthetic / control evidence was excluded but the candidate's remaining evidence is sparse (per `trust_warnings` containing `synthetic_only_excluded_in_evidence` and `evidence_trust = 'low'`).
  - `evidence_confidence_cap_low` warning fired.
- **`'medium'`** when none of the `'not_usable'` conditions hold AND all three of `evidence_trust`, `timing_trust`, `product_context_trust` are `'medium'` AND no `trust_warnings` downgrade the candidate.

### 8.2 Hard rules

- **No `'high'` grade in v0.1.** The categorical absence is part of the contract and removable only via a new contract version stamp.
- **Synthetic / control evidence cannot increase grade.** Even if a candidate's evidence pool is dominated by synthetic-excluded rows, the residual non-synthetic evidence is what counts; never increase grade because exclusion removed weak signal.
- **`insufficient_evidence` is NOT negative evidence.** A candidate that fell to `claim_governance_status = 'insufficient_evidence'` (§6) is categorically distinct from one that fell to `not_claimable` for evidence-grade reasons. The two `'low'` / `'not_usable'` paths converge structurally but the status enum distinguishes them.
- **Trust dimension cap.** Pass 2's `evidence_grade` is bounded above by the lowest non-`'not_usable'` Trust dimension value among `evidence_trust`, `timing_trust`, `product_context_trust`. Pass 2 can never lift a Trust-`'low'` dimension to `'medium'`.

---

## 9. Lane A/B relationship

Pass 2 does NOT write Lane A/B. Lane A/B preview / writer / customer-output governance remains future-gated (PR#16a Evidence Review contract + a future Lane A/B governance planning PR).

### 9.1 Discipline

- Pass 2 does NOT INSERT or UPDATE any row in `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. PR#17f / PR#17q grant safety on these tables stands.
- Pass 2 does NOT emit a Lane A or Lane B output row of any kind.
- Pass 2 carries forward Trust's `lane_visibility_trust` into its own `lane_visibility_decision` field categorically. When Trust said `'blocked'`, Pass 2 also says `'blocked'`. Pass 2 NEVER promotes the visibility decision beyond what Trust signalled.
- **Lane B remains dark / internal.** When `lane_visibility_decision = 'blocked'`, Pass 2 sets `claim_governance_status = 'claim_blocked'` (or `not_claimable` if other gates also fire), populates `claim_blockers` with `lane_b_dark_internal_observed` / `lane_visibility_trust_blocked`, and does NOT surface Lane B's existence beyond those categorical labels.
- **Lane A customer visibility remains future-governed.** Pass 2's `lane_a_preview_possible` status only marks eligibility for the future Lane A/B governance planning PR's evaluation; PR#18k does NOT authorise any Lane A preview emission. Lane A customer visibility itself is downstream of the future Lane A/B governance PR + a separate customer-surface PR.

### 9.2 Pass-forward to future Lane A/B governance planning PR

When `pass_to_lane_governance_planning = true`, the `Pass2ClaimGovernanceCandidate` is the input to the future Lane A/B governance planning PR. The future PR will:

- Receive only candidates with `claim_governance_status = 'lane_a_preview_possible'`.
- Receive only candidates with `evidence_grade ∈ {'low', 'medium'}` (never `'not_usable'`).
- Receive only candidates with `lane_visibility_decision = 'lane_a_preview_only'`.
- Receive only candidates with empty `claim_blockers`.
- Lock the Lane A preview emission contract (or further defer it).

PR#18k does NOT open or pre-authorise that future PR.

---

## 10. Relationship to Evidence Review / reports

Pass 2 may later inform Evidence Review report wording, but **not in PR#18k**.

### 10.1 What Evidence Review must NOT expose (re-affirmed)

Per PR#15a / PR#16a and the boundaries of PR#18b / PR#18j, no Evidence Review surface may render:

- Raw `session_id` values.
- Raw `request_id` UUID values.
- Raw payload bytes / canonical_jsonb / request body / response body.
- Full URLs with query strings.
- Lane B / AI-agent dark evidence (no surfacing of Lane B reasons, even categorically, beyond an internal review-only context).
- Unsupported claims — any claim not explicitly on the (currently empty in v0.1) `allowed_customer_language` allowlist.
- Scores not approved by governance (no customer-visible lead score, conversion probability, revenue claim, or ranking).

### 10.2 Future Evidence Review interaction

A future PR may define how Pass 2 candidates feed Evidence Review report wording. That PR is separately gated and is NOT opened by PR#18k. Until then, Evidence Review remains read-only per PR#15a baseline, with no Pass 2 candidate consumption.

---

## 11. Relationship to AMS Policy / Trust Core (reference-only; no runtime bridge)

This is a **BuyerRecon planning contract only**. PR#18k does NOT call AMS at runtime.

### 11.1 AMS contracts referenced (read-only, reference-only)

PR#18b §4.2 catalogued the AMS canonical contracts that BuyerRecon's planning chain aligns with. For Pass 2 claim-governance planning, the relevant references are:

- `internal/policy/pass2.go` — AMS Pass 2 (`ResolveFinal`). **AMS owns Pass 2 runtime**; emits `RuntimeDecisionOutput` with `FinalDecision ∈ {'ALLOW', 'ALLOW_WITH_FRICTION', 'REVIEW', 'HOLD', 'DENY'}` and friction-multiplier / escrow-delay fields. **BuyerRecon Pass 2 claim-governance is a planning preview upstream of AMS Pass 2 runtime; the two are NOT the same thing and must NOT be conflated.**
- `internal/policy/pass1.go` — AMS Pass 1 (`EvaluatePreTrust`). **AMS owns Pass 1 runtime**; BuyerRecon's Pass 1 v0.2 contract is upstream.
- `internal/trustcore/engine.go` — AMS Trust Core (`TrustDecisionV3`). **AMS owns Trust runtime**; BuyerRecon Trust v0.1 is upstream.
- `internal/contracts/features.go` — `CommonFeatures` + `ProductFeatures` + `NormalizedFeatureBundle`. **AMS owns these.** Pass 2 output does NOT redefine these types.

### 11.2 Dirty-worktree rule (PR#18b §4.1.1 carry-forward)

Any AMS observation against a dirty AMS working tree is **reference-only and non-contractual**. PR#18k re-affirms:

- AMS dirty-worktree observations are reference material for orienting the conversation, NOT a contractual basis for any BuyerRecon Pass 2 implementation.
- Any future BuyerRecon Pass 2 runtime / bridge PR must — at the time that PR is opened — re-inspect AMS at a clean committed HEAD (`git status` clean) **OR** explicitly cite the exact AMS commit / PR that has been merged into AMS `main` and that the BuyerRecon PR depends on. Citing "the AMS workspace at the time of PR#18k's inspection" is **NOT** acceptable.
- BuyerRecon Pass 2 v0.1 must NOT copy or reimplement AMS Pass 2 code, type shapes, JSON key sets, reason-code sets, or runtime semantics based solely on what a dirty AMS workspace might have shown.

### 11.3 Future AMS integration

A future BuyerRecon → AMS Pass 2 integration (or BuyerRecon claim-governance → AMS Pass 2 alignment) would:

- Be a separately-gated PR with its own Helen GO.
- Require a clean committed AMS HEAD (or specific cited AMS commit / PR) as the contractual basis.
- Be the runtime counterpart to PR#18k's planning contract — it would NOT replace or amend this contract.
- Follow the PR#14d / PR#14e fixture / translator pattern.
- Be subject to AMS PR#A7 offline-dry-run boundary.

PR#18k does NOT open or pre-authorise this future bridge PR.

### 11.4 No AMS repo modification by PR#18k

PR#18k read no AMS files in this turn. PR#18b §4 was the only AMS read-only inspection in this chain; PR#18k relies on PR#18b's recorded findings rather than re-inspecting. No AMS file modified, no AMS PR opened, no AMS runtime call.

---

## 12. Reversibility / fail-closed rules

The Pass 2 contract is **fail-closed by design**. If any upstream layer regresses or any downstream condition turns adverse, Pass 2 falls back to a blocked / not-claimable / internal-only / insufficient-evidence state. PR#18k preserves all such fallback rules.

### 12.1 Trust regression → Pass 2 fallback

If the upstream Trust contract regresses on any of the following, Pass 2's `claim_governance_status` MUST fall back to one of `{claim_blocked, not_claimable, internal_review_only, insufficient_evidence}`:

- Any `trust_blockers` becomes non-empty → `claim_blocked` (with `trust_blocker_carried_forward` in `claim_blockers`).
- `trust_summary` regresses to a `blocked_by_*` value → `claim_blocked` (with the matching `trust_summary_blocked_*` label).
- `pass_to_pass2_planning` regresses to `false` → Pass 2 emits no candidate for that input.
- Any Trust dimension regresses to `'not_usable'` → Pass 2's `evidence_grade` becomes `'not_usable'` (per §8.1) and status drops to `not_claimable` or `claim_blocked` (depending on whether other blockers also fired).

### 12.2 Risk-evidence regression

If `risk_evidence_status` regresses from `'usable_later'` back to `'warning'`, `'blocked'`, or `'unavailable'` (which is permitted under the Pass 1 v0.2 contract's reversibility rule per PR#18i §5 / §7.4), and the candidate's evidence chain references risk evidence:

- Trust's `risk_trust` drops to `'not_usable'`.
- Pass 2's `claim_blockers` includes `risk_trust_not_usable` plus the matching `risk_evidence_status_*` label.
- `claim_governance_status` → `claim_blocked`.
- `forbidden_customer_language` populated with all risk-derived denylist labels.
- Risk-backed customer claims remain forbidden categorically.

### 12.3 Lane B re-emergence

If Lane B evidence appears in a candidate's evidence chain (Trust signals `lane_visibility_trust = 'blocked'`):

- Pass 2's `lane_visibility_decision = 'blocked'`.
- `claim_blockers` includes `lane_b_dark_internal_observed` / `lane_visibility_trust_blocked`.
- `claim_governance_status` → `claim_blocked`.
- Customer-facing output remains blocked categorically.

### 12.4 Synthetic / control-only evidence

If the candidate's evidence chain consists entirely of synthetic / control rows (the observer would have already classified this via `synthetic_only_excluded`, so this is defence-in-depth):

- Pass 2's `claim_blockers` includes `synthetic_only_excluded_in_evidence`.
- `claim_governance_status` → `claim_blocked`.
- `evidence_grade` → `'not_usable'`.
- Customer claims remain blocked categorically.

### 12.5 Contract version mismatch

If `source_trust_contract_version ≠ 'trust-contract-v0.1'` OR `source_pass1_contract_version ≠ 'pass1-output-contract-v0.2'` at the input boundary:

- Pass 2 refuses to evaluate the candidate.
- No `Pass2ClaimGovernanceCandidate` is emitted.
- A future Pass 2 contract amendment that accepts other versions requires its own PR + Helen GO.

---

## 13. Non-goals

PR#18k explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No code.** No `src/scoring/pass2/` module, no observer that emits Pass 2 candidate rows into any table, no CLI script that invokes Pass 2 against any data source.
- **No runtime.** No Pass 2 runtime invocation; no AMS Pass 2 runtime call.
- **No DB writes.** No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `ALTER` / `CREATE` / `DROP` / `GRANT` / `REVOKE` against any database.
- **No migration.** No new file under `migrations/`. No `schema.sql` edit.
- **No grants.** PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety stand.
- **No customer output.** `allowed_customer_language = []` is locked at the contract.
- **No Lane writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **No Pass 1 runtime.** AMS Pass 1 reference-only; BuyerRecon Pass 1 v0.2 contract is docs-only.
- **No Trust runtime.** AMS Trust Core reference-only; BuyerRecon Trust v0.1 contract is docs-only.
- **No Pass 2 runtime.** This contract is docs-only.
- **No AMS runtime bridge.** AMS canonical contracts remain reference-only per PR#18b §4 / §4.1.1.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated per PR#18a §11 / PR#17y §12.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A / Playwright.** Track A remains gated under PR#17e (or successor); no headless / programmatic browser run.
- **No knobs / dashboard.** PR#18a §10 forbids implementation in v1; PR#18k re-affirms.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No production artefact / config mode flip.** No website artefact change. No production config edit.
- **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes.**
- **No AMS repo modification.** PR#18b §4.1.1 dirty-worktree rule still applies; AMS observations remain reference-only and non-contractual.
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this doc.

---

## 14. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18k-pass2-claim-governance-planning.md`). No other files touched.
- **Pass 2 input consumes `TrustCandidate` only.** §3.1 enumerates the allowed Trust v0.1 fields; §3.2 enumerates the forbidden inputs; the contract refuses any other Trust contract version or any other Pass 1 contract version.
- **Pass 2 output is preview-only.** §5 locks the `Pass2ClaimGovernanceCandidate` shape under contract version `pass2-claim-governance-contract-v0.1`.
- **`customer_claim_allowed = false`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **`lane_output_allowed = false`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **`allowed_customer_language = []`** locked at the contract — §5.1 / §5.2 / §7 / §14 itself.
- **Forbidden claims explicit.** §7.1 denylist enumerates fourteen categorical forbidden patterns with categorical labels.
- **Lane B remains dark / internal.** §4.1 / §5.2 / §9.1 / §12.3 collectively ensure no Lane B reason text reaches any downstream surface through Pass 2.
- **No runtime and no Gate 4.** §1, §13, and the closing line all assert no Pass 2 runtime, no Pass 1 runtime, no Trust runtime, no Lane writer, no AMS bridge, no Gate 4 work.
- **No `'high'` evidence grade.** §5.2 / §8 / §14 enumerate the allowed enum; `'high'` does not appear anywhere; the closed `evidence_grade` enum is `'low' | 'medium' | 'not_usable'`.
- **Reversibility recorded.** §12 enumerates the five fail-closed regression paths.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18k. **Verdict: PLANNING ONLY — Pass 2 claim-governance contract planning under contract version `pass2-claim-governance-contract-v0.1` consuming Trust contract version `trust-contract-v0.1` (which in turn consumes Pass 1 contract version `pass1-output-contract-v0.2`). The `Pass2ClaimGovernanceCandidate` shape is locked (§5), the closed six-value `claim_governance_status` enum is locked (§6), the explicit denylist for customer-facing language is enumerated (§7.1) while the allowlist is locked at `[]`, the evidence-grade rules are categorical and capped at `'medium'` (§8), and the relationships to Lane A/B (§9) / Evidence Review (§10) / AMS Policy & Trust Core (§11) are documented as separately-gated downstream steps with AMS remaining reference-only per PR#18b §4.1.1. `customer_claim_allowed = false`, `lane_output_allowed = false`, and `allowed_customer_language = []` are locked at the contract. Reversibility / fail-closed rules (§12) ensure Pass 2 falls back to blocked / not-claimable / internal-only / insufficient-evidence on any upstream regression. No Pass 2 runtime, no Trust runtime, no Pass 1 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no AMS repo modification, no Gate 4 work, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no knobs / dashboard, no website ThinSDK production activation, no production artefact / config mode flip, no code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are approved or introduced by PR#18k. Any future Lane A/B governance planning PR, future Gate 4 PR, or future Pass 1 / Trust / Pass 2 runtime / bridge PR remains separately gated by its own explicit Helen GO.**
