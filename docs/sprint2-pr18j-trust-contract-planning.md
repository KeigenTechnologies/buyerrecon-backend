# BuyerRecon PR#18j — Trust contract planning after Pass 1 v0.2

Status: **docs-only planning record. Verdict: PLANNING ONLY — Trust contract planning. No Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no Gate 4 work.**

PR#18j is the next step in the post-Gate-3 chain defined by PR#18a → PR#18b → PR#18c → PR#18d → PR#18e → PR#18i (Pass 1 contract v0.2). The Pass 1 output contract is now locked at version `pass1-output-contract-v0.2` (PR#18i, PR #41 merged at `65c4438`). PR#18j locks the **Trust contract** — the shape of the preview-only candidate that consumes a `Pass1Candidate` and produces a `TrustCandidate` for later review — without authorising any Trust runtime, customer-facing surface, Lane A/B output, or AMS runtime bridge.

PR#18j is a **planning document only**. It introduces no implementation. It does not write any Lane A/B row, does not invoke AMS Trust runtime, does not modify the AMS repository, does not change schema / migrations / production config / `/var/www` / `endpointUrl`, and does not touch any production endpoint. Each subsequent PR (any future Pass 2 claim-governance planning PR, any future Lane A/B governance planning PR, any future Gate 4 planning PR, and any runtime-implementation PR for Pass 1 / Trust / Pass 2) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18j.**
> **No production traffic is approved by PR#18j.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18j; no production artefact / config mode flip is approved by PR#18j.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18j.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18j.**
> **PR#18j is planning-layer only. It does NOT amend the Pass 1 v0.2 contract. It does NOT pre-authorise any runtime PR.** Any future Trust runtime / Pass 2 planning / Lane A/B governance / Gate 4 PR remains separately gated by its own explicit Helen GO.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `65c4438` — "Sprint 2 PR#18i: clarify Pass 1 risk taxonomy (#41)").

PR branch: `buyerrecon-sprint2-pr18j-trust-contract-planning`

Contract version: **`trust-contract-v0.1`** (frozen-literal; rev-locked under PR#18j). Any future change requires a new contract version stamp and its own PR.

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic chain; PR#18j is the Trust-planning step in PR#18a §13's sequence (Trust planning follows Pass 1 planning; precedes Pass 2 planning and Lane A/B governance planning).
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — the Pass 1 output contract at v0.2 (amended by PR#18i). PR#18j Trust input is the `Pass1Candidate` shape it locks.
- `docs/sprint2-pr18i-pass1-risk-evidence-amendment.md` — the v0.1 → v0.2 amendment record; PR#18j consumes v0.2 directly.
- `docs/sprint2-pr18h-timing-observer-risk-reproof.md` — the staging proof that closed the `risk_observations_v0_1` warning chain; PR#18j's `risk_trust` dimension reads `risk_evidence_status = 'usable_later'` only because PR#18h closed the chain.
- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — the original observer staging proof that motivated the risk-evidence carry-forward.
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — the Timing / Product-Context refresh plan, including PR#18b §4 AMS dirty-worktree-is-reference-only rule (re-affirmed for Trust planning in §10 below).
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A / Lane B Evidence Review contract baseline; PR#18j's `lane_visibility_trust` dimension respects PR#16a's Lane B dark-internal posture.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md` — AMS reserved-name guard re-asserted in §6 forbidden outputs.

---

## 1. Status / verdict

**PLANNING ONLY — Trust contract planning. No Trust runtime, no customer output, no Lane writer, no Gate 4.**

- PR#18j defines the *shape* of the Trust preview-only candidate (§5) plus the six categorical Trust dimensions (§4), the closed nine-value `trust_summary` enum (§5), and the explicitly forbidden Trust outputs (§6).
- PR#18j does NOT implement Trust. No `src/scoring/trust/` module is introduced. No CLI script. No DB query. No DDL. No DML.
- PR#18j does NOT authorise any Trust runtime invocation against any data source — staging or production.
- PR#18j does NOT authorise any customer-facing surface. The Trust candidate is internal-only by contract; any future Pass 2 claim-governance PR and any future customer-surface PR are the gates for downstream visibility.
- PR#18j does NOT pre-authorise any future Pass 2 claim-governance planning PR, future Lane A/B governance planning PR, or future Gate 4 planning PR. Each is a separately-gated PR.
- PR#18j does NOT amend the Pass 1 v0.2 contract; Pass 1's `customer_claim_allowed = false` / `lane_output_allowed = false` / `risk_evidence_status` four-state enum / `Pass1Interpretation` eight-value enum / `blocked_by_risk_warning` applicability rule all carry forward unchanged.
- PR#18j does NOT amend the AMS reserved-name guard (PR#14a §10); Trust outputs MUST NOT redefine AMS canonical names (`TrustDecisionV3`, `ProductDecision`, `RequestedAction`, `Fit`, `Intent`, `Window`, etc.).

---

## 2. Why Trust comes after Pass 1

Pass 1 produces preview interpretation candidates that capture *what we observed* (timing band, product context, evidence completeness, confidence cap, exclusion flags). Trust answers a different question: *how reliable is each candidate's interpretation, and is it safe to consider for any later action?*

| Layer | Question | Owned by |
|---|---|---|
| Observer (PR#18c / PR#18g) | What did we read from the evidence sources? | BuyerRecon read-only observer |
| Pass 1 (PR#18e / PR#18i, contract v0.2) | What's the categorical interpretation of those observations? | BuyerRecon planning contract |
| **Trust (PR#18j, contract v0.1)** | **How reliable is the Pass 1 interpretation? Which dimensions are usable? What blocks consumption?** | **BuyerRecon planning contract** |
| Pass 2 (future planning PR) | What claim language is safe for the customer surface? | BuyerRecon planning contract |
| Customer surface (future PR) | What renders to the customer? | Future surface PR |
| AMS Pass 1 / Trust / Pass 2 runtime (AMS-owned) | Production decisioning | AMS (reference-only for BuyerRecon today) |

Trust is **not** Pass 1: Pass 1 chooses the interpretation enum; Trust evaluates whether each dimension supports that interpretation. Trust is **not** Pass 2: Pass 2 governs customer-visible language and claim allowlist/denylist. Trust does **not** create customer-visible claims by itself; it only produces an internal `TrustCandidate` that Pass 2 may later gate.

The PR#18a §7 dimensions (score-confidence / evidence-confidence / trust-decay / scoring-action-trust / AMS shared-core alignment) are concretised here as the six §4 dimensions, plus the lane-visibility dimension required by PR#16a's Lane A/B governance baseline.

---

## 3. Trust input contract

Trust's **only** sanctioned input is the `Pass1Candidate` shape locked by PR#18e/PR#18i at contract version `pass1-output-contract-v0.2`. PR#18j does not read raw observer output, does not read raw DB rows, does not read AMS contracts at runtime, and does not bypass Pass 1.

### 3.1 Allowed inputs (the v0.2 Pass1Candidate fields)

| Field | Source | Use in Trust |
|---|---|---|
| `pass1_contract_version` | PR#18e v0.2 / PR#18i | Must equal `'pass1-output-contract-v0.2'`. Trust refuses inputs from older or newer Pass 1 versions until separately upgraded. |
| `timing_band_candidate` | PR#18c observer | Primary input to §4.2 `timing_trust`. |
| `product_context_candidate` | PR#18c observer | Primary input to §4.3 `product_context_trust`. |
| `evidence_confidence_cap` | PR#18c observer | Hard cap on Trust dimensions. Trust dimensions can never exceed this cap. |
| `pass1_interpretation` | PR#18e §5 | One of the eight v0.2 enum values. Trust reads as a categorical input only. |
| `allowed_evidence_refs` | PR#18e §4.1 | Read for categorical evidence-count signals (e.g. `accepted_events:N`). Trust must NEVER look up the underlying rows. |
| `exclusion_flags` | PR#18e §4.1 | Carried forward into Trust output's `trust_blockers` / `trust_warnings` per §5. |
| `insufficiency_reasons` | PR#18e §4.1 | Carried forward; if non-empty, Trust dimensions cap downward. |
| `risk_evidence_status` | PR#18e v0.2 / PR#18i (4 states) | Primary input to §4.4 `risk_trust`. See §4.4 for the per-state mapping. |
| `customer_claim_allowed = false` | PR#18e contract lock | Trust verifies the input enforces this; Trust output also locks at `false`. |
| `lane_output_allowed = false` | PR#18e contract lock | Trust verifies the input enforces this; Trust output also locks at `false`. |
| `pass_to_trust_planning = true` | PR#18e §4.1 | Trust only evaluates candidates where this gate is `true`. When `false`, Pass 1 stopped at preview and Trust does not see the candidate. |
| `session_id_redacted` | PR#18c observer (truncated form) | Carried into Trust output's `trust_candidate_id` derivation. Never the raw id. |

### 3.2 Forbidden inputs

Trust must NEVER read or accept any of the following as input — neither directly from a DB, nor from any intermediate surface, nor as a smuggled field on a Pass 1 candidate:

- **Raw `session_id`.** Only `session_id_redacted` is permitted.
- **`request_id` UUID values.** Used by the observer for grouping; never reach Pass 1 or Trust.
- **Raw payload bytes** of any kind (`accepted_event.raw`, `canonical_jsonb`, encoded request body, response body, fixture body).
- **Full URLs with query strings.** Categorical referrer-class is acceptable only if locked to a known allowlist by a separate PR; full URLs never reach Trust.
- **Token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header values.**
- **Synthetic Gate 2 / Gate 3 / Gate-N proof rows as commercial evidence.** Already excluded by the observer (PR#18c §4 / PR#18b §6) and not present in Pass 1 candidates that reach Trust.
- **Lane B / AI-agent evidence as customer-visible input.** Trust may receive the `lane_b_dark_internal` exclusion flag in `exclusion_flags`; it must NOT surface Lane B's existence beyond a categorical `lane_visibility_trust = 'blocked'` (or `'internal_only'`) value in §5. No Lane B reason text reaches any downstream surface through Trust.
- **Direct AMS dirty-worktree shapes.** Per PR#18b §4.1.1, any AMS observation against a dirty AMS working tree is reference-only and non-contractual. Trust must NOT consume an AMS field, struct, or JSON key whose authoritative form was only seen in a dirty AMS worktree — only fields that exist on a clean committed AMS HEAD (or are explicitly cited by an AMS commit/PR merged into AMS `main`) are eligible inputs to any future Trust runtime PR.
- **`ProductDecision` / `RequestedAction` final outputs.** These are AMS canonical runtime types (per `internal/contracts/features.go` + `internal/policy/pass2.go`). Trust does NOT accept these as inputs nor emit them as outputs.

---

## 4. Trust dimensions

Trust is a **multi-dimensional planning layer**, not a single number. Trust v0.1 emits six categorical dimensions plus one categorical summary (§5).

Each of the six dimensions uses the enum `'low' | 'medium' | 'not_usable'` — **never `'high'`**. The PR#18b §7.2 confidence-cap policy carries forward: high confidence is not emitted at the BuyerRecon planning layer in any contract this PR introduces.

### 4.1 `evidence_trust`

- Reflects the quality and completeness of the evidence references the observer surfaced.
- Inputs: `allowed_evidence_refs` counts, `exclusion_flags`, `insufficiency_reasons`, `source_tables_present` summary (carried via Pass 1's pass-forward).
- `'low'` when only one server-side source contributed signal, OR when `insufficiency_reasons` is non-empty, OR when an optional source the policy would prefer is absent.
- `'medium'` when at least two server-side sources contributed signal AND no insufficiency reasons are present AND no optional source the policy depends on is absent.
- `'not_usable'` when no server-side source contributed, OR when only synthetic / control rows produced the signal (the observer would have already flagged via `synthetic_exclusion_filter_empty`).

### 4.2 `timing_trust`

- Reflects freshness / decay of Timing evidence (PR#18b §7.1 bands).
- Inputs: `timing_band_candidate`, `evidence_confidence_cap`.
- `'low'` for `cooling` / `stale` (PR#13a §7 / PR#18c §5.1 bands).
- `'medium'` for `hot_now` / `warm_recent` *when* `evidence_confidence_cap` is `'medium'` AND the observer-side multi-source threshold (§4.1 `evidence_trust = 'medium'`) was met. Trust never promotes timing trust above the observer's confidence cap.
- `'not_usable'` for `dormant` / `insufficient_evidence`, OR whenever `timing_band_candidate` is missing.
- **No stale evidence may be promoted to a stronger trust value.** A `stale` band is at best `'low'`; a `dormant` band is `'not_usable'`. `insufficient_evidence` is categorically distinct from `dormant` and remains `'not_usable'` (PR#18b §7.1 / PR#18c §5.1).

### 4.3 `product_context_trust`

- Reflects whether the product-context candidate is supported by the underlying evidence.
- Inputs: `product_context_candidate` (PR#18c §5.3 enum: `evidence_observed` / `single_source_signal` / `synthetic_only_excluded` / `insufficient_evidence` / `threshold_not_locked`), `evidence_confidence_cap`.
- `'medium'` when `product_context_candidate = 'evidence_observed'` AND `evidence_trust = 'medium'`.
- `'low'` when `product_context_candidate = 'single_source_signal'`.
- `'not_usable'` when `product_context_candidate ∈ {'insufficient_evidence', 'threshold_not_locked', 'synthetic_only_excluded'}`.
- Multi-source vs single-source distinction is categorical, not numeric; Trust never invents a confidence score on this dimension.

### 4.4 `risk_trust`

This dimension is gated by the Pass 1 v0.2 `risk_evidence_status` four-state enum (PR#18i v0.2 amendment).

- **Only usable** when `risk_evidence_status = 'usable_later'`. In this state, `risk_trust` may be `'low'` or `'medium'` based on §4.1 `evidence_trust` and the categorical risk-observation count (read only as a count via `allowed_evidence_refs`, never the underlying row content).
- **`'not_usable'`** when `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`. All three are fail-closed per PR#18i §4.2 / PR#18e §4.2; Trust dimension MUST drop to `'not_usable'` and the §5 `trust_summary` MUST include `blocked_by_risk_status` (or `trust_review_needed` if a future PR refines that policy).
- **`risk_trust` MUST NEVER produce a customer claim** at the Trust layer. Even when `risk_trust = 'medium'`, the downstream Pass 2 claim-governance layer (separately gated) is the only place where any risk-evidence-derived language could become customer-visible — and only via the Pass 2 allowlist, never via Trust.

### 4.5 `action_trust`

- Categorical statement of whether a later action would be safe to consider.
- v0.1 enum: `'not_authorized' | 'planning_only'`.
- **`'not_authorized'`** is the v0.1 default whenever any other dimension is `'not_usable'`, OR whenever `customer_claim_allowed = false` AND `lane_output_allowed = false` (which is always under v0.2). In practice, this is the steady state today.
- **`'planning_only'`** is a categorical signal that *if* a future runtime PR were to authorise actions (none does today), this candidate would be in scope. It does NOT trigger any action; it is a planning enum value only.
- **Trust never emits a runtime action recommendation.** No `RequestedAction`, no `ProductDecision`, no `AllowWithFriction`, no `Review`, no `Hold`, no `Deny`. AMS Pass 2 runtime owns those decisions; Trust at the BuyerRecon planning layer is upstream of any of them.

### 4.6 `lane_visibility_trust`

- Categorical statement of which Lane (if any) a candidate could later become visible in, after governance.
- v0.1 enum: `'internal_only' | 'lane_a_preview_only' | 'blocked'`.
- **`'internal_only'`** is the v0.1 default. Trust does not surface a Lane A or Lane B claim to any customer; it only marks the candidate as eligible for later internal-only review.
- **`'lane_a_preview_only'`** is reserved for candidates that a future Lane A/B governance planning PR may flag as eligible for Lane A *preview-layer* output (not customer output). PR#18j does NOT authorise Lane A preview emission; it only categorically reserves the enum value.
- **`'blocked'`** when the `exclusion_flags` carry `lane_b_dark_internal` (i.e. Lane B observations are present anywhere in the candidate's evidence chain). Lane B remains dark / internal (PR#18b §10 OD-6 / PR#16a §3). Trust does NOT surface Lane B's existence; the `'blocked'` value is a categorical lane-visibility statement only, never a customer-visible Lane B reason.

---

## 5. Trust output contract

The Trust output is a **preview-only candidate** that consumes one `Pass1Candidate` (where `pass_to_trust_planning = true`) and produces one `TrustCandidate`. Trust emits no row when the Pass 1 candidate is not passed forward or when Pass 1 itself rejected the candidate via `blocked_by_*` interpretation.

### 5.1 Contract shape (v0.1)

```
TrustCandidate {
  trust_contract_version:       'trust-contract-v0.1'
  source_pass1_contract_version: 'pass1-output-contract-v0.2'
  trust_candidate_id:           string              // observer/Pass-1-redacted id form; NEVER the raw session_id

  evidence_trust:               'low' | 'medium' | 'not_usable'
  timing_trust:                 'low' | 'medium' | 'not_usable'
  product_context_trust:        'low' | 'medium' | 'not_usable'
  risk_trust:                   'low' | 'medium' | 'not_usable'

  action_trust:                 'not_authorized' | 'planning_only'

  lane_visibility_trust:        'internal_only' | 'lane_a_preview_only' | 'blocked'

  trust_summary:                TrustSummary        // §5.2 categorical enum only — NEVER customer-facing prose
  trust_blockers:               readonly string[]   // categorical labels only (subset of §5.3)
  trust_warnings:               readonly string[]   // categorical labels only (subset of §5.3)

  pass_to_pass2_planning:       boolean

  customer_claim_allowed:       false               // ALWAYS false in v0.1 — locked at the contract
  lane_output_allowed:          false               // ALWAYS false in v0.1 — locked at the contract
}
```

### 5.2 `TrustSummary` enum (closed; 9 values; no `'high'`)

| Value | Categorical meaning |
|---|---|
| `insufficient_evidence` | One or more of the §4 dimensions is `'not_usable'` because the underlying Pass 1 candidate reported insufficient evidence. `pass_to_pass2_planning = false`. |
| `trust_review_needed` | Mixed dimensions; not a clean PASS but not a clean BLOCK either. Pass 1 candidate would benefit from manual review before any Pass 2 surface considers it. `pass_to_pass2_planning = false` in v0.1 (a future Pass 2 planning PR may permit selective handoff). |
| `evidence_supported_low` | All required dimensions are at least `'low'` (none `'not_usable'`); no warnings. `pass_to_pass2_planning = true` (Pass 2 may consider the candidate; outcome still governed by Pass 2 allowlist). |
| `evidence_supported_medium` | All required dimensions are at least `'low'` AND at least one is `'medium'` AND `evidence_trust = 'medium'`. `pass_to_pass2_planning = true`. |
| `blocked_by_synthetic_only` | The candidate's `exclusion_flags` show synthetic-only origin (should not normally reach Trust, but defence-in-depth). `pass_to_pass2_planning = false`. |
| `blocked_by_missing_evidence` | A required source was missing per Pass 1's `insufficiency_reasons`. `pass_to_pass2_planning = false`. |
| `blocked_by_risk_status` | `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}` AND the candidate's `evidence_refs` reference risk evidence. Trust refuses to produce a non-blocked summary. `pass_to_pass2_planning = false`. |
| `blocked_by_lane_b_visibility` | `lane_visibility_trust = 'blocked'` because Lane B observations are present in the candidate's evidence chain. Lane B stays dark / internal; the candidate does not pass to Pass 2 planning at this point. `pass_to_pass2_planning = false`. |
| `planning_only_no_action` | Categorical signal that this candidate is at the planning layer only; no action surface is being recommended; explicitly distinguished from `blocked_by_*` states. `pass_to_pass2_planning` may be `true` or `false` depending on whether other dimensions support handoff. |

**No `'high'` trust summary.** No `ready_to_buy`, no `high_intent`, no `qualified_lead`, no `imminent_conversion`, no customer-facing language of any kind. These categorical absences are part of the v0.1 contract and removable only via a new contract version stamp (`trust-contract-v0.2` or higher).

### 5.3 `trust_blockers` and `trust_warnings` allowed values (categorical only)

Both fields carry only categorical labels from the same enum set. **No free-form strings. No customer-facing prose. No PII.**

Allowed labels include (extendable by a future contract version):

- `evidence_trust_not_usable`
- `timing_trust_not_usable`
- `product_context_trust_not_usable`
- `risk_trust_not_usable`
- `risk_evidence_status_unavailable`
- `risk_evidence_status_warning`
- `risk_evidence_status_blocked`
- `lane_b_dark_internal_observed`
- `synthetic_only_excluded_in_evidence`
- `insufficient_evidence_in_pass1`
- `optional_source_missing_in_pass1`
- `evidence_confidence_cap_low`
- `pass1_interpretation_blocked_by_*` (where `*` is one of the PR#18e §5 `blocked_by_*` values)
- `pass_to_pass2_planning_gate_failed`

### 5.4 Field discipline

- **`trust_contract_version`**: literal `'trust-contract-v0.1'`. Trust v0.2 (or higher) requires a separate amendment PR with its own Helen GO.
- **`source_pass1_contract_version`**: literal `'pass1-output-contract-v0.2'`. If the input Pass 1 contract version differs, Trust refuses to evaluate the candidate (categorical contract-mismatch handling; emits no Trust candidate).
- **`trust_candidate_id`**: a categorical, internally-routable identifier. Derivation: hash of (`pass1_candidate_id`, `trust_contract_version`) — *not* a hash that can be reversed to the full session_id. Never a UUID generated from a request_id. The exact derivation is locked when the first Trust read-only observer ships (separate PR, separate Helen GO); PR#18j only fixes the *field name* and its categorical contract.
- **`evidence_trust` / `timing_trust` / `product_context_trust` / `risk_trust`**: each is `'low' | 'medium' | 'not_usable'`. **None may ever be `'high'`.** Promotion to `'medium'` requires evidence support per §4; without it, the dimension is `'low'` or `'not_usable'`.
- **`action_trust`**: only `'not_authorized'` or `'planning_only'`. Never an action verb. Never a runtime trigger.
- **`lane_visibility_trust`**: only `'internal_only'` / `'lane_a_preview_only'` / `'blocked'`. No Lane B emission of any kind.
- **`trust_summary`**: the single categorical enum chosen from §5.2. **Never a free-form string. Never customer-facing prose.**
- **`trust_blockers` / `trust_warnings`**: arrays of categorical labels from §5.3. Never sentences. Never customer-facing.
- **`pass_to_pass2_planning`**: a binary gate to a future Pass 2 claim-governance planning PR. It is `true` only for `trust_summary ∈ {evidence_supported_low, evidence_supported_medium, planning_only_no_action}` (and even then, only when no `trust_blockers` entries fire). For all `blocked_by_*` summaries, it is `false`.
- **`customer_claim_allowed`** and **`lane_output_allowed`**: ALWAYS `false` in this contract. Future PRs that want to flip either flag must amend the contract under a new version stamp (`trust-contract-v0.2` or higher) with their own PR + Helen GO + Codex review. **PR#18j does NOT change either flag.**

### 5.5 No raw fields in the contract

Explicit list of fields that MUST NOT exist anywhere in `TrustCandidate` or its serialised form:

- `session_id` (full form) / `raw_session_id`.
- `request_id` / `request_uuid` / any UUID-shaped string field.
- `raw_event` / `payload` / `canonical_jsonb` / `request_body` / `response_body`.
- `url` / `full_url` / `referrer_full`.
- `token` / `token_hash` / `token_prefix` / `token_suffix` / `token_id` / `pepper` / `database_url` / `dsn` / `authorization` / `bearer`.
- `customer_claim_text` / `customer_message` / `marketing_copy` / `lead_score` / `revenue_estimate` / `pipeline_estimate`.
- `ProductDecision` / `RequestedAction` / `TrustDecisionV3` (AMS canonical types — PR#14a §10 reserved-name guard).

---

## 6. Trust forbidden outputs

Trust must NEVER emit any of the following — neither in the Trust candidate, nor in any downstream artefact derived from a Trust candidate, nor in any customer-visible surface, internal report, log line, dashboard, or audit trail:

- **High confidence / high trust.** No dimension reaches `'high'`; no summary value evaluates to anything stronger than `evidence_supported_medium`.
- **`ready_to_buy`** / "imminent conversion" / "showing buying signals" / any temporal-buying claim.
- **`high_intent`** / "qualified lead" / "warm prospect" / any lead-grading claim.
- **Final human / AI / bot classification** of any kind. Lane A/B governance (separately gated) is the only layer where a Lane A claim could later become customer-visible, and only via Pass 2's allowlist — NOT via Trust output.
- **Final invalid-traffic conclusion.** Same — Lane A/B governance gates this, not Trust.
- **Customer-facing score** of any kind (numeric or categorical).
- **Revenue / pipeline claims** — "$X expected revenue", "high pipeline impact", "estimated deal size", "ARR contribution".
- **`ProductDecision`** — AMS canonical runtime type (per `internal/contracts/features.go` and `internal/policy/pass2.go` — reference-only for BuyerRecon today).
- **`RequestedAction`** — AMS canonical runtime type.
- **`TrustDecisionV3`** — AMS canonical Trust Core runtime type (per `internal/trustcore/engine.go` — reference-only). Trust v0.1 at the BuyerRecon planning layer does NOT emit this; future AMS-bridge work is separately gated.
- **Lane A/B write.** Trust does NOT write `public.scoring_output_lane_a` / `public.scoring_output_lane_b`. PR#17f / PR#17q grant safety stands.
- **Customer-visible Lane B output.** Lane B remains dark / internal; the `lane_visibility_trust = 'blocked'` value is a categorical statement only and does NOT carry a Lane B reason text.
- **Automated action recommendation** of any kind. Trust is planning-layer; it does not trigger any runtime path.
- **AMS reserved names** (PR#14a §10): no `Fit` / `Intent` / `Window` / `WindowState` / `ProductDecision` / `RequestedAction` / `TRQ` / `BuyerReconProductFeatures` / `Pass1` (as type) / `Pass2` / `TrustDecisionV3` emitted as JSON keys, type names, or column names.

---

## 7. Trust decay (planning-only definition)

Trust v0.1 records a **planning-only definition** of trust decay. **PR#18j does NOT implement decay.** No code path computes decay rates; no half-life is hard-coded; no decay constants are emitted on the candidate.

### 7.1 Definitional posture (v0.1 contract)

- **Freshness matters.** Stale / dormant evidence lowers Trust dimensions per §4.2 (`stale` → at most `'low'`; `dormant` → `'not_usable'`).
- **`insufficient_evidence` is NOT negative evidence.** A candidate whose timing band is `insufficient_evidence` is categorically distinct from one whose band is `dormant`. The former says "we cannot say"; the latter says "we observed evidence; the answer is: no recent activity" (PR#18b §7.1 / PR#18c §5.1 carry-forward).
- **Synthetic / control evidence cannot increase Trust.** Even when `risk_evidence_status = 'usable_later'`, candidates whose evidence chain is entirely synthetic (per the observer's exclusion machinery) cannot lift any Trust dimension above `'low'`. In practice, the observer would have already classified such candidates as `synthetic_only_excluded` and Pass 1 would have emitted `blocked_by_synthetic_only`, so Trust would not see them — but defence-in-depth applies.
- **Future runtime decay must be separately implemented and tested.** A decay function (e.g., half-life in hours, session-boundary marker, evidence-age tier) belongs to a future runtime PR with its own contract version (`trust-contract-v0.2` or higher), its own Helen GO, its own targeted test suite, and a follow-up staging proof analogous to PR#18h's.

### 7.2 What §7 does NOT do

- Does NOT compute decay at the contract-planning layer.
- Does NOT emit any numeric decay rate or half-life.
- Does NOT lock a specific decay model (the model is OD-Tr2 in PR#18a §7.3, deferred until a future runtime PR).
- Does NOT authorise any decay-driven action.

---

## 8. Relationship to Pass 2 (future Pass 2 claim-governance planning PR)

Trust is NOT Pass 2.

### 8.1 What Trust does NOT do that Pass 2 will

- Trust does NOT govern customer-visible language.
- Trust does NOT own the claim allowlist / denylist.
- Trust does NOT emit fallback language for insufficient evidence (Pass 2 will).
- Trust does NOT decide which Pass 1-derived signals become customer-facing claims.

### 8.2 Handoff rule

Trust passes a `TrustCandidate` to a future Pass 2 claim-governance planning PR **only when**:

- `trust_contract_version = 'trust-contract-v0.1'` and `source_pass1_contract_version = 'pass1-output-contract-v0.2'`.
- `customer_claim_allowed = false` (the contract lock holds at handoff).
- `lane_output_allowed = false` (the contract lock holds at handoff).
- `trust_summary ∈ {evidence_supported_low, evidence_supported_medium, planning_only_no_action}` — none of the `blocked_by_*` summaries pass forward.
- `trust_blockers` is empty (no fired blocker labels).
- No required §4 dimension is `'not_usable'`.

When any of these conditions fails, `pass_to_pass2_planning` is `false` and Trust emits the candidate as audit-only.

### 8.3 What Pass 2 will own (out of scope for PR#18j)

- Claim allowlist / denylist (PR#18a §8 OD-P2-2).
- Customer-safe threshold combinations (OD-P2-3).
- Fallback language for insufficient evidence (OD-P2-4).
- Interaction with Evidence Review report + Lane A/B preview report (OD-P2-5).

PR#18j does NOT pre-bake any of these. The future Pass 2 planning PR is **not opened by PR#18j**.

---

## 9. Relationship to Lane A/B

Trust does NOT write Lane A/B. Lane A/B preview / writer / customer-output governance remains future-gated (PR#16a Evidence Review contract + a future Lane A/B governance planning PR).

### 9.1 Discipline

- Trust does NOT INSERT or UPDATE any row in `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. PR#17f / PR#17q grant safety on these tables stands.
- Trust does NOT emit a Lane A / Lane B output row of any kind.
- Trust DOES receive the observer's `lane_b_dark_internal` exclusion flag (via Pass 1's `exclusion_flags`) and DOES propagate it categorically into `lane_visibility_trust = 'blocked'` and `trust_summary = 'blocked_by_lane_b_visibility'`. **Trust does NOT surface Lane B's existence on any customer-visible surface.** The categorical statement is internal-only.
- Lane B evidence must be excluded from customer-facing Trust outputs. Since Trust v0.1 emits zero customer-facing outputs, this rule is automatically satisfied; v0.2 or higher (which might add a customer-facing surface) would need to re-prove the exclusion at its own contract amendment.

---

## 10. Relationship to AMS Trust Core (reference-only; no runtime bridge)

This is a **BuyerRecon planning contract only**. PR#18j does **not** call AMS at runtime.

### 10.1 AMS contracts referenced (read-only, reference-only)

PR#18b §4.2 catalogued the AMS canonical contracts that BuyerRecon's planning chain aligns with. For Trust planning, the relevant references are:

- `internal/trustcore/engine.go` — AMS Trust Core engine producing `TrustDecisionV3`. **Reference-only. BuyerRecon Trust v0.1 does NOT emit `TrustDecisionV3`** (PR#14a §10 reserved-name guard).
- `internal/policy/pass1.go` — AMS Pass 1 (`EvaluatePreTrust`) consumes `Pass1Input` and a `ResolvedPolicyConfig`; outputs `PolicyPassOneResolution` with `TrustInvocationMode` ∈ {`CONTINUE`, `SKIP_TRUST`, `CONSTRAINED_BLOCK`}. **AMS owns Pass 1 runtime; BuyerRecon's Pass 1 v0.2 contract is a *planning preview* upstream of AMS Pass 1.**
- `internal/policy/pass2.go` — AMS Pass 2 (`ResolveFinal`). **AMS owns Pass 2 runtime; BuyerRecon's Pass 2 planning (future) is upstream of AMS Pass 2.**
- `internal/contracts/features.go` — `CommonFeatures` + `ProductFeatures` + `NormalizedFeatureBundle`. **AMS owns these.** BuyerRecon emits the `ProductFeatures.Namespace` payload via the PR#14b candidate; Trust output does NOT redefine these types.

### 10.2 Dirty-worktree rule (PR#18b §4.1.1 carry-forward)

Any AMS observation against a dirty AMS working tree is **reference-only and non-contractual**. PR#18j re-affirms:

- AMS dirty-worktree observations are reference material for orienting the conversation, NOT a contractual basis for any BuyerRecon Trust implementation.
- Any future BuyerRecon Trust runtime / bridge PR must — at the time that PR is opened — re-inspect AMS at a clean committed HEAD (`git status` clean) **OR** explicitly cite the exact AMS commit / PR that has been merged into AMS `main` and that the BuyerRecon PR depends on. Citing "the AMS workspace at the time of PR#18j's inspection" is **NOT** acceptable.
- BuyerRecon Trust v0.1 must NOT copy or reimplement AMS Trust Core code, type shapes, JSON key sets, reason-code sets, or runtime semantics based solely on what PR#18j might have seen in a dirty AMS workspace.

### 10.3 Future AMS bridge

A future BuyerRecon → AMS Trust bridge would:

- Be a separately-gated PR with its own Helen GO.
- Require a clean committed AMS HEAD (or specific cited AMS commit / PR) as the contractual basis.
- Be the runtime counterpart to PR#18j's planning contract — it would NOT replace or amend this contract.
- Follow the PR#14d / PR#14e fixture / translator pattern: BuyerRecon's Trust output JSON would need a translator into the shape AMS Trust Core's `TrustInputsV3` (or successor) expects; direct parse is not guaranteed compatible.
- Be subject to AMS PR#A7 offline-dry-run boundary: offline parse compatibility is NOT runtime activation.

PR#18j does NOT open or pre-authorise this future bridge PR.

### 10.4 No AMS repo modification by PR#18j

PR#18j read no AMS files in this turn. PR#18b §4 was the only AMS read-only inspection in this chain; PR#18j relies on PR#18b's recorded findings rather than re-inspecting. No AMS file modified, no AMS PR opened, no AMS runtime call.

---

## 11. Non-goals

PR#18j explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No code.** No `src/scoring/trust/` module, no observer that emits Trust candidate rows into any table, no CLI script that invokes Trust against any data source.
- **No runtime.** No Trust runtime invocation; no `TrustDecisionV3` emission; no AMS Trust Core call.
- **No DB writes.** No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `ALTER` / `CREATE` / `DROP` / `GRANT` / `REVOKE` against any database.
- **No migration.** No new file under `migrations/`. No `schema.sql` edit.
- **No grants.** PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety stand.
- **No customer output.** No surface that renders any field of a Trust candidate to any customer.
- **No Lane writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **No Pass 1 runtime.** AMS Pass 1 reference-only; BuyerRecon Pass 1 contract is v0.2 docs-only.
- **No Pass 2 runtime.** Future Pass 2 planning PR is separately gated.
- **No AMS runtime bridge.** AMS canonical contracts remain reference-only per PR#18b §4 / §4.1.1.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated per PR#18a §11 / PR#17y §12.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A / Playwright.** Track A remains gated under PR#17e (or successor); no headless / programmatic browser run.
- **No knobs / dashboard.** PR#18a §10 forbids implementation in v1; PR#18j re-affirms.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No production artefact / config mode flip.** No website artefact change. No production config edit.
- **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes.**
- **No AMS repo modification.** PR#18b §4.1.1 dirty-worktree rule still applies; AMS observations remain reference-only and non-contractual.
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this doc.

---

## 12. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18j-trust-contract-planning.md`). No other files touched.
- **Trust input contract consumes Pass 1 v0.2 only.** §3.1 enumerates the allowed Pass 1 v0.2 fields; §3.2 enumerates the forbidden inputs; the contract refuses any other Pass 1 contract version.
- **Trust dimensions defined.** §4 locks the six categorical dimensions (`evidence_trust`, `timing_trust`, `product_context_trust`, `risk_trust`, `action_trust`, `lane_visibility_trust`) with per-dimension input rules.
- **Trust output contract preview-only.** §5 locks the `TrustCandidate` shape under contract version `trust-contract-v0.1`; `customer_claim_allowed = false` and `lane_output_allowed = false` are locked at the contract.
- **No high trust.** §4 / §5.2 / §5.4 enumerate the allowed enums; `'high'` does not appear anywhere; the closed `TrustSummary` enum tops out at `evidence_supported_medium`.
- **No customer claims.** §6's forbidden-output list + §5.4's `customer_claim_allowed = false` + §9's Lane-A/B-not-in-PR#18j affirmations together prevent any customer-facing assertion.
- **Lane B stays dark / internal.** §4.6 + §5.2 (`blocked_by_lane_b_visibility`) + §9.1 collectively ensure no Lane B reason text reaches any downstream surface through Trust.
- **Runtime and Gate 4 remain unapproved.** §1, §11, and the closing line all assert no Trust runtime, no Pass 1 / Pass 2 runtime, no Lane writer, no AMS bridge, no Gate 4 work.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18j. **Verdict: PLANNING ONLY — Trust contract planning under contract version `trust-contract-v0.1` consuming Pass 1 contract version `pass1-output-contract-v0.2`. The `TrustCandidate` shape is locked (§5), the six Trust dimensions are defined as categorical enums capped at `'medium'` (§4), the closed nine-value `TrustSummary` enum is locked (§5.2), the forbidden-output list is enumerated (§6), trust decay is defined at the planning layer only with no runtime implementation (§7), and the relationships to Pass 2 (§8) / Lane A/B (§9) / AMS Trust Core (§10) are documented as separately-gated downstream steps with AMS remaining reference-only per PR#18b §4.1.1. `customer_claim_allowed = false` and `lane_output_allowed = false` are locked at the contract. No Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no AMS repo modification, no Gate 4 work, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no knobs / dashboard, no website ThinSDK production activation, no production artefact / config mode flip, no code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are approved or introduced by PR#18j. Any future Pass 2 claim-governance planning PR, future Lane A/B governance planning PR, future Gate 4 PR, or future Trust runtime / bridge PR remains separately gated by its own explicit Helen GO.**
