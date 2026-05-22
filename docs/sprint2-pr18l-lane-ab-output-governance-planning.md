# BuyerRecon PR#18l — Lane A/B preview and output governance planning after Pass 2

Status: **docs-only planning record. Verdict: PLANNING ONLY — Lane A/B preview and output governance planning. No Lane writer, no customer output, no dashboard, no Gate 4.**

PR#18l is the next step in the post-Gate-3 chain defined by PR#18a → PR#18b → PR#18c → PR#18d → PR#18e → PR#18i (Pass 1 contract v0.2) → PR#18j (Trust contract v0.1) → PR#18k (Pass 2 claim-governance contract v0.1). The Pass 2 claim-governance output contract is now locked at version `pass2-claim-governance-contract-v0.1` (PR#18k, PR #43 merged at `3a23d2e`) and consumes Trust at `trust-contract-v0.1` (which itself consumes Pass 1 at `pass1-output-contract-v0.2`). PR#18l locks the **Lane A/B preview and output governance contract** — the shape of the preview-only candidate that consumes a `Pass2ClaimGovernanceCandidate` and produces a `LaneGovernanceCandidate` deciding whether anything may later become Lane A preview, Lane B internal-only, or blocked — without authorising any Lane A/B writer, customer-facing surface, dashboard, scoring runtime, or AMS runtime bridge.

PR#18l is a **planning document only**. It introduces no implementation. It does not write any Lane A or Lane B row, does not grant any new access on the Lane tables, does not invoke AMS Pass 2 runtime, does not modify the AMS repository, does not change schema / migrations / production config / `/var/www` / `endpointUrl`, and does not touch any production endpoint. Each subsequent PR (any future Lane writer PR, any future customer-surface PR, any future Gate 4 planning PR, and any runtime-implementation PR for Pass 1 / Trust / Pass 2 / Lane governance) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18l.**
> **No production traffic is approved by PR#18l.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18l; no production artefact / config mode flip is approved by PR#18l.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no dashboard, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no Lane governance runtime is approved by PR#18l.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config / DB grant changes are introduced by PR#18l.**
> **PR#18l is planning-layer only. It does NOT amend the Pass 1 v0.2 contract, the Trust v0.1 contract, or the Pass 2 v0.1 contract. It does NOT pre-authorise any runtime PR or any Lane writer PR.** Any future Lane writer PR, future customer-surface PR, future Gate 4 PR, or future Pass 1 / Trust / Pass 2 / Lane runtime PR remains separately gated by its own explicit Helen GO.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `3a23d2e` — "Sprint 2 PR#18k: plan Pass 2 claim governance (#43)").

PR branch: `buyerrecon-sprint2-pr18l-lane-ab-output-governance-planning`

Contract version: **`lane-governance-contract-v0.1`** (frozen-literal; rev-locked under PR#18l). Any future change requires a new contract version stamp and its own PR.

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic chain. PR#18l is the Lane A/B governance step in PR#18a §13's sequence (Lane governance planning follows Pass 2 planning; precedes any Gate 4 planning).
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — the Pass 1 output contract at v0.2 (amended by PR#18i).
- `docs/sprint2-pr18i-pass1-risk-evidence-amendment.md` — Pass 1 v0.1 → v0.2 amendment record.
- `docs/sprint2-pr18j-trust-contract-planning.md` — the Trust output contract at v0.1.
- `docs/sprint2-pr18k-pass2-claim-governance-planning.md` — the Pass 2 claim-governance contract at v0.1. PR#18l Lane input is the `Pass2ClaimGovernanceCandidate` shape it locks.
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A/B Evidence Review contract baseline. PR#18l's lane-visibility decisions respect PR#16a's Lane B dark-internal posture and PR#16a §8 customer-wording rules.
- `docs/sprint2-pr16b-lane-ab-preview-observer.md` — Lane A/B preview observer baseline.
- `docs/sprint2-pr17f-production-migration-operator-runbook.md` and `docs/sprint2-pr17h-pr17f-production-migration-proof.md` — production grant safety baseline; PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` is the authoritative posture and is NOT changed by PR#18l.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — closing proof for Gate 3 staging; PR#18l does not invoke Gate 3 evidence or production data.
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — PR#18b §4.1.1 AMS dirty-worktree-is-reference-only rule (re-affirmed in §11 below).
- `migrations/011_scoring_output_lanes.sql` and `migrations/016_scoring_output_lane_grant_safety.sql` — referenced read-only for Lane table definitions and grant posture; not modified.

---

## 1. Status / verdict

**PLANNING ONLY — Lane A/B preview and output governance planning. No Lane writer, no customer output, no dashboard, no Gate 4.**

- PR#18l defines the *shape* of the Lane governance preview-only candidate (§5) plus the closed five-value `lane_preview_decision` enum (§6), the Lane A eligibility rules (§7), the Lane B dark-internal rules (§8), and the block / fail-closed rules (§9).
- PR#18l does NOT implement Lane governance. No `src/scoring/lane-governance/` module is introduced. No CLI script. No DB query. No DDL. No DML. No new GRANT / REVOKE. No migration.
- PR#18l does NOT authorise any Lane A or Lane B writer. PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands; `buyerrecon_customer_api` retains `REVOKE ALL` on both Lane tables (migration 011 §`REVOKE ALL ON scoring_output_lane_* FROM buyerrecon_customer_api`).
- PR#18l does NOT authorise any customer-facing surface. The Lane governance candidate is internal-only by contract; any future customer-surface PR is the gate for downstream visibility.
- PR#18l does NOT authorise any dashboard. PR#18a §10 forbids dashboard implementation in v1; PR#18l re-affirms.
- PR#18l does NOT pre-authorise any future Lane writer PR or future Gate 4 planning PR. Each is a separately-gated PR.
- PR#18l does NOT amend the Pass 1 v0.2 contract, the Trust v0.1 contract, or the Pass 2 v0.1 contract. All three carry forward unchanged.
- PR#18l does NOT amend the AMS reserved-name guard (PR#14a §10); Lane governance outputs MUST NOT redefine AMS canonical names (`ProductDecision`, `RequestedAction`, `TrustDecisionV3`, `Fit`, `Intent`, `Window`, etc.).

---

## 2. Why Lane A/B governance comes after Pass 2

Lane A/B governance sits **after** Pass 2 in the planning chain. The five-layer separation:

| Layer | Question | Owned by |
|---|---|---|
| Observer (PR#18c / PR#18g) | What did we read from the evidence sources? | BuyerRecon read-only observer |
| Pass 1 (PR#18e v0.2 / PR#18i) | What is the categorical interpretation of those observations? | BuyerRecon planning contract |
| Trust (PR#18j v0.1) | How reliable is the Pass 1 interpretation? | BuyerRecon planning contract |
| Pass 2 (PR#18k v0.1) | What claim language is governed — claimable, blocked, deferred, internal-only? | BuyerRecon planning contract |
| **Lane A/B governance (PR#18l v0.1)** | **Does anything reach Lane A preview, Lane B internal-only, or stay blocked? Is any customer-facing or writer surface eligible at all?** | **BuyerRecon planning contract** |
| Customer surface (future PR) | What renders to the customer? | Future surface PR |
| Lane A/B writer (future PR) | Which rows physically land in `scoring_output_lane_a` / `scoring_output_lane_b`? | Future writer PR |
| Dashboard / report (future PR) | What internal / customer-facing report is rendered? | Future report PR |
| AMS Policy / Trust runtime | Production decisioning | AMS (reference-only for BuyerRecon today) |

Lane A/B governance is **not Pass 2**: Pass 2 governs whether *any* claim-language assertion would be safe; Lane governance decides whether that claim's underlying evidence has a *route* into Lane A preview, Lane B dark-internal observation, or stays blocked.

Lane A/B governance **must not bypass Pass 2**. Lane governance has no authority to:

- Promote a Pass 2 `claim_blocked` / `not_claimable` / `insufficient_evidence` candidate into Lane A preview.
- Override a Pass 2 blocker.
- Re-evaluate Trust dimensions.
- Re-read Pass 1 candidates or raw observer rows.
- Introduce a Lane B customer-visible path.

Lane A/B governance does **not itself create Lane A/B writes or customer output** in PR#18l. It produces a categorical governance candidate that a future Lane writer PR (separately gated) and a future customer-surface PR (separately gated) may consume.

Lane A/B governance is the layer where the **default is fail-closed for write and visibility**: the v0.1 contract emits `customer_visibility_allowed = false`, `lane_write_allowed = false`, `customer_claim_allowed = false`, and `allowed_customer_language = []` in every candidate. These four flags are locked at the contract; flipping any of them requires a contract version bump.

---

## 3. Lane definitions

Three categorical lanes:

### 3.1 Lane A — invalid-traffic / non-buyer-motion / customer-safe evidence path

- **Underlying table:** `public.scoring_output_lane_a` (migration 011).
- **Purpose:** captures invalid-traffic / behavioural-rubric evidence (declared in migration 011 as "invalid-traffic / behavioural rubric"). Fields include `verification_score`, `evidence_band`, `action_recommendation`, `reason_codes`, `evidence_refs`.
- **Customer visibility (v1):** **forbidden by PR#18l contract.** `customer_visibility_allowed = false` is locked in every Lane governance candidate. A future customer-surface PR is the only gate that could change this.
- **PR#18l posture:** Lane A may be marked `lane_a_preview_possible` when Pass 2 said so AND all §7 eligibility gates pass. Even then, PR#18l does NOT authorise Lane A emission; the future Lane writer PR is the gate.

### 3.2 Lane B — AI-agent / good-bot / dark-internal observation path

- **Underlying table:** `public.scoring_output_lane_b` (migration 011).
- **Purpose:** captures declared-agent observation (declared in migration 011 as "declared-agent observation"). Field `strength` is NULL in v1 (`scoring_output_lane_b_strength_null_v1` constraint).
- **Customer visibility (v1):** **forbidden categorically and forever in v1.** Lane B remains dark / internal in v1. No customer-facing AI-agent claim, no customer-facing good-bot disclosure, no customer-visible Lane B row, no Lane B summary in any customer report.
- **PR#18l posture:** Lane B is `lane_b_dark_internal` when Trust signalled `lane_visibility_trust = 'blocked'` (i.e. Lane B evidence present) AND no leak risk. Even then, PR#18l does NOT authorise Lane B emission or surfacing; Lane B is counted / flagged internally only for future policy review.

### 3.3 Blocked

A candidate is `blocked` (Lane governance level) when any of:

- Trust summary blocked (any `blocked_by_*` summary value).
- Pass 2 `claim_governance_status ∈ {'claim_blocked', 'not_claimable', 'insufficient_evidence'}`.
- Pass 2 emitted any `claim_blockers` entry.
- Evidence grade is `'not_usable'`.
- Risk evidence required but `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`.
- Lane B evidence would leak customer-visible (defence-in-depth).
- Synthetic / control-only evidence.
- Any forbidden customer-claim phrase would appear (Pass 2 §7.1 denylist labels populated).
- Contract version mismatch (Lane governance refuses to evaluate).
- Any raw ID / payload / secret-shaped field present (defence-in-depth).
- Any policy violation surfaced upstream.

### 3.4 Insufficient evidence (Lane level)

Distinct from `blocked`. Used when Pass 2 emitted `claim_governance_status = 'insufficient_evidence'` specifically (i.e., upstream evidence is too sparse to support any Lane decision), or when Lane governance itself cannot reach a decision given the current evidence grade. `pass_to_gate4_planning = false`.

---

## 4. Inputs allowed

Lane governance's **only** sanctioned input is the `Pass2ClaimGovernanceCandidate` shape locked by PR#18k at contract version `pass2-claim-governance-contract-v0.1`. PR#18l does not read raw observer output, does not read raw Pass 1 candidates, does not read raw Trust candidates, does not read raw DB rows, does not read AMS contracts at runtime, and does not bypass Pass 2.

### 4.1 Allowed inputs (the v0.1 Pass2ClaimGovernanceCandidate fields)

| Field | Source | Use in Lane governance |
|---|---|---|
| `pass2_contract_version` | PR#18k v0.1 | Must equal `'pass2-claim-governance-contract-v0.1'`. Lane governance refuses inputs from older or newer Pass 2 versions until separately upgraded. |
| `source_trust_contract_version` | PR#18k v0.1 | Carried forward into the Lane candidate for audit; must equal `'trust-contract-v0.1'`. |
| `source_pass1_contract_version` | PR#18k v0.1 | Carried forward into the Lane candidate for audit; must equal `'pass1-output-contract-v0.2'`. |
| `claim_governance_status` | PR#18k §6 | Primary input to §6 `lane_preview_decision`. |
| `claim_blockers` | PR#18k §6.1 | If non-empty, Lane governance emits `blocked` and `pass_to_gate4_planning = false`. |
| `claim_warnings` | PR#18k §6.1 | Carried forward as categorical labels; may downgrade the §6 decision. |
| `allowed_customer_language` | PR#18k contract lock | Must equal `[]`. Lane governance verifies the input enforces this; Lane output also locks at `[]`. |
| `forbidden_customer_language` | PR#18k §7.1 | Carried forward into the Lane candidate's `lane_reason_codes` for audit; any populated entry contributes to `blocked` if customer surfacing is being evaluated. |
| `evidence_grade` | PR#18k §8 | Hard gate: Lane A preview requires `'low'` or `'medium'`; `'not_usable'` forces `blocked` or `insufficient_evidence`. |
| `lane_visibility_decision` | PR#18k §5.1 | Primary input to §6 `lane_preview_decision`. When `'blocked'`, Lane governance also says `blocked`. When `'internal_only'`, Lane governance emits `internal_only`. When `'lane_a_preview_only'`, Lane governance MAY emit `lane_a_preview_possible` if all §7 gates pass. |
| `pass_to_lane_governance_planning` | PR#18k §5.1 / §5.2 | Lane governance only evaluates candidates where this gate is `true`. When `false`, Pass 2 stopped at preview and Lane governance does not see the candidate. |
| `customer_claim_allowed = false` | PR#18k contract lock | Lane governance verifies the input enforces this; Lane output also locks at `false`. |
| `lane_output_allowed = false` | PR#18k contract lock | Lane governance verifies the input enforces this; Lane output also locks at `false`. |
| `pass2_candidate_id` | PR#18k §5.1 | Carried into Lane output's `lane_candidate_id` derivation. Never the raw session_id. |

### 4.2 Forbidden inputs

Lane governance must NEVER read or accept any of the following as input — neither directly from a DB, nor from any intermediate surface, nor as a smuggled field on a Pass 2 candidate:

- **Raw `session_id`.** Only redacted forms permitted via `pass2_candidate_id`.
- **`request_id` UUID values.** Used by the observer for grouping; never reach Pass 1, Trust, Pass 2, or Lane governance.
- **Raw payload bytes** of any kind (`accepted_event.raw`, `canonical_jsonb`, encoded request body, response body, fixture body).
- **Full URLs with query strings.**
- **Token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header values.**
- **Synthetic Gate 2 / Gate 3 / Gate-N proof rows as commercial evidence.** Already excluded by the observer (PR#18c §4 / PR#18b §6) and not present in Pass 1 / Trust / Pass 2 candidates that reach Lane governance.
- **Lane B / AI-agent evidence as customer-visible input.** Lane governance may receive `lane_visibility_decision = 'blocked'` from Pass 2 (Lane B observed) and propagate that as `lane_preview_decision = 'lane_b_dark_internal'` or `blocked`; it must NOT surface Lane B's existence beyond categorical labels.
- **Customer-facing text generated upstream.** Lane governance's input is a categorical Pass 2 candidate, not a customer-claim draft. If any upstream layer attempted to smuggle customer-claim text into the Pass 2 candidate, Lane governance categorically refuses to consume that field.
- **Dirty AMS worktree shapes.** Per PR#18b §4.1.1, any AMS observation against a dirty AMS working tree is reference-only and non-contractual. Lane governance must NOT consume an AMS field, struct, or JSON key whose authoritative form was only seen in a dirty AMS worktree.
- **`ProductDecision` / `RequestedAction` / `TrustDecisionV3` runtime objects.** These are AMS canonical runtime types. Lane governance does NOT accept these as inputs nor emit them as outputs.

---

## 5. Lane governance output contract

The Lane governance output is a **preview-only governance candidate**. One candidate per (input `Pass2ClaimGovernanceCandidate` where `pass_to_lane_governance_planning = true`). Lane governance emits no row when Pass 2 did not pass forward.

### 5.1 Contract shape (v0.1)

```
LaneGovernanceCandidate {
  lane_governance_contract_version: 'lane-governance-contract-v0.1'
  source_pass2_contract_version:    'pass2-claim-governance-contract-v0.1'
  source_trust_contract_version:    'trust-contract-v0.1'
  source_pass1_contract_version:    'pass1-output-contract-v0.2'
  lane_candidate_id:                string              // observer/Pass-1/Trust/Pass-2-redacted id form; NEVER the raw session_id

  lane_preview_decision:            LanePreviewDecision  // §6 categorical enum only — NEVER customer-facing prose

  lane_reason_codes:                readonly string[]   // categorical labels only (subset of §6.1)
  lane_blockers:                    readonly string[]   // categorical labels only (subset of §6.1)
  lane_warnings:                    readonly string[]   // categorical labels only (subset of §6.1)

  customer_visibility_allowed:      false               // ALWAYS false in v0.1 — locked at the contract
  lane_write_allowed:               false               // ALWAYS false in v0.1 — locked at the contract
  customer_claim_allowed:           false               // ALWAYS false in v0.1 — locked at the contract
  allowed_customer_language:        readonly string[]   // ALWAYS [] in v0.1 — locked at the contract

  pass_to_gate4_planning:           boolean
}
```

### 5.2 Field discipline

- **`lane_governance_contract_version`**: literal `'lane-governance-contract-v0.1'`. Lane v0.2 (or higher) requires a separate amendment PR with its own Helen GO.
- **`source_pass2_contract_version`**: literal `'pass2-claim-governance-contract-v0.1'`. If the input Pass 2 contract version differs, Lane governance refuses to evaluate the candidate (categorical contract-mismatch handling; emits no Lane candidate).
- **`source_trust_contract_version`**: literal `'trust-contract-v0.1'`. Carried forward from the Pass 2 candidate for audit.
- **`source_pass1_contract_version`**: literal `'pass1-output-contract-v0.2'`. Carried forward for audit.
- **`lane_candidate_id`**: a categorical, internally-routable identifier. Derivation: hash of (`pass2_candidate_id`, `lane_governance_contract_version`) — *not* a hash that can be reversed to the full session_id. Never a UUID generated from a request_id. The exact derivation is locked when the first Lane governance read-only observer ships (separate PR, separate Helen GO); PR#18l only fixes the *field name* and its categorical contract.
- **`lane_preview_decision`**: the single categorical enum chosen from §6. **Never a free-form string. Never customer-facing prose. Never a final classification.**
- **`lane_reason_codes` / `lane_blockers` / `lane_warnings`**: arrays of categorical labels from §6.1. **Never sentences. Never customer-facing. Never PII.**
- **`customer_visibility_allowed`**: ALWAYS `false` in v0.1 — locked at the contract. Even when `lane_preview_decision = 'lane_a_preview_possible'`, the flag remains `false` in v0.1. Flipping requires a contract version bump + customer-surface PR + Helen GO.
- **`lane_write_allowed`**: ALWAYS `false` in v0.1 — locked at the contract. No Lane A or Lane B write authorised by PR#18l; Lane governance does NOT touch the Lane tables. Flipping requires a contract version bump + Lane writer PR + Helen GO.
- **`customer_claim_allowed`**: ALWAYS `false` in v0.1 — locked at the contract. Carried forward from Pass 2; cannot be lifted at the Lane layer.
- **`allowed_customer_language`**: ALWAYS `[]` in v0.1 — locked at the contract. Even when `lane_preview_decision = 'lane_a_preview_possible'`, the allowlist remains empty in v0.1. Adding any entry requires a contract version bump.
- **`pass_to_gate4_planning`**: a binary gate to a future Gate 4 planning PR. It is `true` only when `lane_preview_decision ∈ {'lane_a_preview_possible', 'lane_b_dark_internal'}` AND no `lane_blockers` fired AND no contract-mismatch occurred AND no `forbidden_customer_language` labels populated. For all other decision values, it is `false`. **PR#18l does NOT open Gate 4 planning.** A future Gate 4 planning PR is separately gated by Helen GO and may consume the completed governance chain.

### 5.3 No raw fields in the contract

Explicit list of fields that MUST NOT exist anywhere in `LaneGovernanceCandidate` or its serialised form:

- `session_id` (full form) / `raw_session_id`.
- `request_id` / `request_uuid` / any UUID-shaped string field.
- `raw_event` / `payload` / `canonical_jsonb` / `request_body` / `response_body`.
- `url` / `full_url` / `referrer_full`.
- `token` / `token_hash` / `token_prefix` / `token_suffix` / `token_id` / `pepper` / `database_url` / `dsn` / `authorization` / `bearer`.
- `customer_claim_text` / `customer_message` / `marketing_copy` / `lead_score` / `revenue_estimate` / `pipeline_estimate`.
- `verification_score` (Lane A table column — never reproduced inside the governance candidate; the future Lane writer PR may surface it on the Lane A row itself, not on the governance candidate).
- `evidence_band` / `action_recommendation` (Lane A table columns — same posture as `verification_score`).
- `strength` (Lane B table column — NULL in v1 anyway per migration 011 constraint; never reproduced in the governance candidate).
- `ProductDecision` / `RequestedAction` / `TrustDecisionV3` (AMS canonical types — PR#14a §10 reserved-name guard).

---

## 6. Lane preview decisions

The `LanePreviewDecision` enum is **closed**. Lane governance emits one of these five categorical values and nothing else. **No free-form lane text. No customer-facing prose. No final classifications.**

| Enum value | Categorical meaning |
|---|---|
| `blocked` | A specific blocker fired (Trust blocker carried forward, Pass 2 `claim_blocked`, evidence-grade `'not_usable'`, risk-evidence non-usable when required, Lane B leak risk, synthetic-only origin, contract mismatch, etc.). `pass_to_gate4_planning = false`. |
| `internal_only` | The candidate is interpretable for internal review (Codex / Helen review, Evidence Review snapshot internal posture); no Lane A preview, no Lane B emission, no customer surface is reachable from this decision. `pass_to_gate4_planning = false`. |
| `lane_a_preview_possible` | Pass 2 signalled `claim_governance_status = 'lane_a_preview_possible'` (or in some narrow internal-review cases — see §7), all §7 eligibility gates pass, and the candidate would be eligible for a **future** Lane writer PR's Lane A evaluation. **PR#18l does NOT authorise Lane A emission**; this decision only marks eligibility. `pass_to_gate4_planning = true`. |
| `lane_b_dark_internal` | Lane B evidence is present in the upstream chain (Trust said `lane_visibility_trust = 'blocked'` because of Lane B, Pass 2 propagated). The candidate is counted / flagged internally only — no customer surface, no customer-visible AI-agent claim, no Lane B summary in reports. `pass_to_gate4_planning = true` (Lane B observations may inform future Gate 4 policy review even though they never reach customers). |
| `insufficient_evidence` | Pass 2 already reported `claim_governance_status = 'insufficient_evidence'`, OR Lane governance itself cannot reach a decision given current evidence grade. Categorically distinct from `blocked` (which has a specific blocker fired). `pass_to_gate4_planning = false`. |

### 6.1 Allowed labels for `lane_reason_codes` / `lane_blockers` / `lane_warnings`

All three fields carry only categorical labels from the same enum set. **No free-form strings. No customer-facing prose. No PII.**

Allowed labels (extendable by a future contract version):

- `pass2_status_<value>` (where `<value>` is one of PR#18k §6's `claim_governance_status` values: `not_claimable`, `claim_blocked`, `claim_deferred`, `internal_review_only`, `lane_a_preview_possible`, `insufficient_evidence`)
- `pass2_blocker_carried_forward`
- `pass2_warning_carried_forward`
- `trust_summary_blocked_*` (subset from PR#18j §5.2)
- `evidence_grade_<value>` (`low` / `medium` / `not_usable`)
- `evidence_grade_not_usable`
- `risk_evidence_status_unavailable`
- `risk_evidence_status_warning`
- `risk_evidence_status_blocked`
- `lane_visibility_decision_<value>` (`internal_only` / `lane_a_preview_only` / `blocked`)
- `lane_b_evidence_present`
- `lane_b_leak_risk_detected`
- `synthetic_only_excluded_in_evidence`
- `forbidden_customer_language_populated`
- `contract_version_mismatch_pass2`
- `contract_version_mismatch_trust`
- `contract_version_mismatch_pass1`
- `raw_field_present_in_input` (defence-in-depth — should never fire)
- `pass_to_lane_governance_planning_gate_failed`

### 6.2 What is explicitly NOT in the decision enum

No `write_lane_a`, no `write_lane_b`, no `customer_visible`, no `publish_report`, no `score_customer`, no `ready_to_buy`, no `high_intent`, no final bot / human / AI classification, no final invalid-traffic conclusion, no `lead_score`, no `conversion_probability`, no `revenue` claim, no `pipeline` claim, no automated action recommendation. These categorical absences are part of the v0.1 contract and removable only via a new contract version stamp.

---

## 7. Lane A rules

Lane A preview is possible **only** when **all** of the following gates pass simultaneously:

- `pass_to_lane_governance_planning = true` (Pass 2 passed the candidate forward).
- `claim_governance_status ∈ {'lane_a_preview_possible', 'internal_review_only'}`. In the `internal_review_only` case, Lane governance may emit `lane_a_preview_possible` only when the underlying evidence would have been eligible were the candidate not internal-only-by-policy (this is a narrow path; the dominant route is via `'lane_a_preview_possible'`).
- `evidence_grade ∈ {'low', 'medium'}` (never `'not_usable'`).
- No Trust blockers (Pass 2 verified upstream; Lane governance re-verifies via `pass2_blocker_carried_forward` not appearing in the input).
- No Pass 2 `claim_blockers` (Lane governance refuses to emit `lane_a_preview_possible` when any Pass 2 blocker fired).
- No Lane B visibility issue — `lane_visibility_decision = 'lane_a_preview_only'` (NOT `'blocked'`, NOT `'internal_only'` for Lane B reasons).
- No synthetic-only evidence (categorical label `synthetic_only_excluded_in_evidence` is acceptable as a warning but not a Lane A blocker; if the candidate's residual non-synthetic evidence is empty, Lane governance emits `insufficient_evidence` or `blocked`, not `lane_a_preview_possible`).
- `customer_claim_allowed = false` in the input (verified; Lane output also locks at `false`).
- `lane_output_allowed = false` in the input (verified; Lane output also locks at `false`).
- No `forbidden_customer_language` labels populated on the Pass 2 candidate.

**Lane A preview possible does NOT mean customer output.** It does NOT mean a Lane A row write. It does NOT mean a dashboard surface. It marks eligibility for the *future* Lane writer PR's evaluation, nothing more. PR#18l does NOT authorise:

- Any INSERT into `public.scoring_output_lane_a`.
- Any new GRANT on `public.scoring_output_lane_a` (PR#17f / PR#17q grant safety stands).
- Any customer-visible Lane A row.
- Any dashboard rendering of Lane A.
- Any Evidence Review report exposure of Lane A beyond PR#16a's existing read-only baseline.

---

## 8. Lane B rules

Lane B remains **dark / internal in v1**. The rules are categorical and binding:

- Lane B **cannot** be shown to customers under any v1 contract version.
- Lane B **cannot** be used in customer reports, customer dashboards, or customer-facing Evidence Review surfaces.
- Lane B **cannot** be converted into a customer-visible AI-agent claim under any circumstance. Pass 2 §7.1 denylist label `deny_lane_b_customer_visible` is the binding gate.
- Lane B **cannot** write to a customer-facing Lane output. The `public.scoring_output_lane_b` table is internal-only by grant; `buyerrecon_customer_api` has `REVOKE ALL` (migration 011); PR#18l does NOT change this.
- Lane B **can** only be counted / flagged internally for future policy review.
- Lane B emission to `public.scoring_output_lane_b` itself is **not authorised by PR#18l** — that is a future Lane writer PR's scope, separately gated. PR#18l merely defines the `lane_b_dark_internal` decision; it does NOT produce a row.

When Lane governance emits `lane_preview_decision = 'lane_b_dark_internal'`:

- `customer_visibility_allowed = false` (always, in v1).
- `lane_write_allowed = false` (always, in v0.1 of this contract).
- `customer_claim_allowed = false` (always, in v0.1 of this contract).
- `allowed_customer_language = []` (always, in v0.1 of this contract).
- `lane_reason_codes` includes `lane_b_evidence_present` and the matching `lane_visibility_decision_blocked` (carried forward from Pass 2).
- `pass_to_gate4_planning` MAY be `true` — Lane B observations may inform future Gate 4 policy review without ever reaching customers.

### 8.1 Lane B leak defence-in-depth

Even when `lane_preview_decision = 'lane_b_dark_internal'` is the intended outcome, Lane governance MUST verify that no customer-facing field, surface, or downstream consumer could read Lane B reasons through the candidate. Defence-in-depth checks:

- The `lane_reason_codes` array carries categorical labels only — no human-readable Lane B reason text.
- The `lane_warnings` and `lane_blockers` arrays carry categorical labels only.
- No `customer_claim_text` / `customer_message` / `marketing_copy` field exists on the candidate (per §5.3).
- The `pass_to_gate4_planning` boolean does NOT carry any Lane B-specific payload; it is a binary gate only.

If any defence-in-depth check fails, Lane governance emits `lane_preview_decision = 'blocked'` with `lane_blockers` containing `lane_b_leak_risk_detected`.

---

## 9. Block / fail-closed rules

The Lane governance contract is **fail-closed by design**. If any upstream layer regresses or any downstream condition turns adverse, Lane governance falls back to a `blocked` / `internal_only` / `insufficient_evidence` state. PR#18l preserves all such fallback rules.

Block (emit `lane_preview_decision = 'blocked'`) if any of:

- **Trust summary blocked.** Trust signalled any `blocked_by_*` summary; Pass 2 propagated; Lane governance refuses to emit anything other than `blocked` (with `trust_summary_blocked_*` and `pass2_status_claim_blocked` labels).
- **Pass 2 status is `claim_blocked`, `not_claimable`, or `insufficient_evidence`.** Lane governance emits `blocked` (for `claim_blocked` / `not_claimable`) or `insufficient_evidence` (for the latter).
- **`evidence_grade = 'not_usable'`.** Lane governance emits `blocked` with `evidence_grade_not_usable`.
- **`risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`** AND the candidate's evidence chain references risk evidence (this is encoded upstream in Pass 1 / Trust, but Lane governance re-checks via the carried-forward labels).
- **Lane B evidence would leak customer-visible** — see §8.1 defence-in-depth; Lane governance emits `blocked` with `lane_b_leak_risk_detected`.
- **Synthetic / control-only evidence** — the candidate's evidence chain is dominated by synthetic-excluded rows AND residual non-synthetic evidence is empty.
- **Contract version mismatch** — `source_pass2_contract_version ≠ 'pass2-claim-governance-contract-v0.1'` OR `source_trust_contract_version ≠ 'trust-contract-v0.1'` OR `source_pass1_contract_version ≠ 'pass1-output-contract-v0.2'`. Lane governance refuses to evaluate the candidate; emits no Lane candidate.
- **Any forbidden customer-claim phrase would appear** — Pass 2's `forbidden_customer_language` is non-empty AND any consumer is being evaluated against customer surfacing. Lane governance emits `blocked` with `forbidden_customer_language_populated`.
- **Any raw ID / payload / secret-shaped field present** on the candidate. Defence-in-depth — should never fire in normal operation; if it does, Lane governance emits `blocked` with `raw_field_present_in_input`.

### 9.1 Reversibility

If any upstream contract amendment occurs (Pass 1 v0.2 → v0.3, Trust v0.1 → v0.2, Pass 2 v0.1 → v0.2), Lane governance MUST be reviewed in a separate PR. The Lane contract refuses inputs at any non-matching upstream version (§5.2 / §9 contract-version-mismatch rule).

If a candidate that previously reached `lane_a_preview_possible` later loses eligibility (e.g. risk-evidence regresses, Trust dimension regresses, Pass 2 status downgrades on re-evaluation), Lane governance MUST emit `blocked` or `insufficient_evidence` on the next evaluation. Lane governance does NOT carry forward stale `lane_a_preview_possible` decisions.

---

## 10. Relationship to existing Lane tables

PR#18l references the existing Lane tables as **read-only context**. It does NOT write them, does NOT alter them, and does NOT change grant posture.

### 10.1 Existing tables (read-only reference)

- `public.scoring_output_lane_a` — defined in `migrations/011_scoring_output_lanes.sql` (lines 103–142). Holds invalid-traffic / behavioural-rubric evidence. Columns include `scoring_output_lane_a_id`, `workspace_id`, `site_id`, `session_id`, `scoring_version`, `verification_score`, `evidence_band`, `action_recommendation`, `reason_codes`, `evidence_refs`, `created_at`. Indexed by `(workspace_id, site_id, created_at DESC)`, `(workspace_id, site_id, session_id)`, `(scoring_version, created_at DESC)`. Unique natural key on the appropriate composite (see migration 011).
- `public.scoring_output_lane_b` — defined in `migrations/011_scoring_output_lanes.sql` (lines 155–190). Holds declared-agent observation. Columns include `scoring_output_lane_b_id`, `workspace_id`, `site_id`, `session_id`, `scoring_version`, `strength` (NULL in v1 per `scoring_output_lane_b_strength_null_v1` constraint), `verification_method`, `reason_codes`, `evidence_refs`, `created_at`. Indexed by `(workspace_id, site_id, created_at DESC)`, `(workspace_id, site_id, session_id)`, `(scoring_version, created_at DESC)`. Unique natural key on the appropriate composite (see migration 011).

### 10.2 PR#18l write / grant posture

- **PR#18l does NOT INSERT, UPDATE, DELETE, or TRUNCATE either Lane table.** No DDL, no DML, no migration file.
- **PR#18l does NOT alter Lane table schema.** No `ALTER TABLE`, no new column, no new constraint, no new index.
- **PR#18l does NOT change Lane table grants.** PR#17f / PR#17q grant safety is the authoritative posture and stands:
  - `buyerrecon_migrator` retains `GRANT ALL` on both Lane tables (migration 011 §3).
  - `buyerrecon_scoring_worker` retains `GRANT SELECT, INSERT, UPDATE` on both Lane tables (migration 011 §3).
  - `buyerrecon_internal_readonly` retains `GRANT SELECT` on both Lane tables (migration 011 §3).
  - `buyerrecon_customer_api` retains **`REVOKE ALL`** on both Lane tables (migration 011 §3 / migration 016 grant safety) — the customer API role has zero access to either Lane table, and PR#18l does NOT change this.
  - `PUBLIC` retains `REVOKE ALL` on both Lane tables.
- **Customer API must not get direct Lane table access.** Migration 011 / migration 016 already enforce this with `REVOKE ALL ... FROM buyerrecon_customer_api`. PR#18l re-affirms; any future PR that proposes to grant `buyerrecon_customer_api` ANY access to either Lane table is a separately-gated PR requiring Helen GO and Codex review.
- **Any future Lane writer must be separately planned, reviewed, tested, and gated.** The future Lane writer PR is responsible for:
  - Defining the precise INSERT path (`buyerrecon_scoring_worker` is the writing role).
  - Defining idempotency / natural-key conflict handling.
  - Defining UPDATE rules (when, by which role, with what audit).
  - Defining test coverage (unit + integration + staging proof).
  - Re-checking grant posture at the time the writer PR is opened.
  - Receiving its own explicit Helen GO scoped to that writer PR.

---

## 11. Relationship to Evidence Review / reports

Lane governance may later inform Evidence Review reports, but **not in PR#18l**.

### 11.1 What Evidence Review / reports must NOT expose (re-affirmed)

Per PR#15a / PR#16a / PR#18k §10 and the boundaries of PR#18b, no Evidence Review surface or customer report may render:

- **Customer report in PR#18l** — none authorised.
- **Dashboard in PR#18l** — none authorised (PR#18a §10 forbids dashboard implementation in v1; PR#18l re-affirms).
- **Customer-visible Lane B** — categorically forbidden in v1 (§8).
- **Unsupported claims** — any claim not explicitly on the (currently empty in v0.1) `allowed_customer_language` allowlist.
- **Raw IDs / payloads / full URLs** — categorical denial across the chain.
- **Scores** unless later governance allows — no customer-visible lead score, conversion probability, revenue claim, ranking, or `verification_score` exposure beyond the existing PR#15a / PR#16a internal baseline.

### 11.2 Future Evidence Review interaction

A future PR may define how Lane governance candidates feed Evidence Review report wording. That PR is separately gated and is NOT opened by PR#18l. Until then, Evidence Review remains read-only per PR#15a / PR#16a baseline, with no Lane governance candidate consumption.

### 11.3 AMS Policy / Trust Core (reference-only; no runtime bridge)

This is a **BuyerRecon planning contract only**. PR#18l does NOT call AMS at runtime.

AMS dirty-worktree rule (PR#18b §4.1.1 carry-forward) re-affirmed:

- AMS dirty-worktree observations are reference material for orienting the conversation, NOT a contractual basis for any BuyerRecon Lane governance implementation.
- Any future BuyerRecon Lane governance runtime / bridge PR must — at the time that PR is opened — re-inspect AMS at a clean committed HEAD (`git status` clean) **OR** explicitly cite the exact AMS commit / PR that has been merged into AMS `main` and that the BuyerRecon PR depends on.
- BuyerRecon Lane governance v0.1 must NOT copy or reimplement AMS Pass 2 / Trust runtime code, type shapes, JSON key sets, reason-code sets, or runtime semantics based solely on what a dirty AMS workspace might have shown.

PR#18l reads no AMS files in this turn. No AMS file modified, no AMS PR opened, no AMS runtime call.

---

## 12. Relationship to Gate 4

**Gate 4 remains paused.**

- Lane governance planning does NOT activate production.
- Lane governance planning does NOT re-flip the production `endpointUrl`.
- Lane governance planning does NOT authorise any production traffic, any Track A invocation, any Playwright run, any website ThinSDK production activation, or any production artefact / config mode flip.
- Future Gate 4 planning MAY consume the completed governance chain (Pass 1 v0.2 → Trust v0.1 → Pass 2 v0.1 → Lane governance v0.1), but Gate 4 remains separately gated.
- Gate 4 PR B / PR C / PR D / PR E remain separately gated per PR#18a §11 / PR#17y §12.
- The Lane governance candidate's `pass_to_gate4_planning` boolean is a *forward gate signal only* — it does NOT itself open Gate 4. A future Gate 4 planning PR is responsible for defining the precise inputs Gate 4 consumes and receiving its own Helen GO.

---

## 13. Non-goals

PR#18l explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No code.** No `src/scoring/lane-governance/` module, no observer that emits Lane governance candidate rows into any table, no CLI script that invokes Lane governance against any data source.
- **No runtime.** No Lane governance runtime invocation; no Pass 2 runtime call; no Trust runtime call; no Pass 1 runtime call.
- **No DB writes.** No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `ALTER` / `CREATE` / `DROP` / `GRANT` / `REVOKE` against any database. PR#17f / PR#17q grant safety stands.
- **No Lane writer.** No write to `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. The future Lane writer PR is the separately-gated path.
- **No customer output.** `allowed_customer_language = []` and `customer_visibility_allowed = false` locked at the contract.
- **No dashboard.** PR#18a §10 forbids dashboard implementation in v1; PR#18l re-affirms.
- **No AMS bridge.** AMS canonical contracts remain reference-only per PR#18b §4.1.1.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A / Playwright.** Track A remains gated under PR#17e (or successor); no headless / programmatic browser run.
- **No knobs implementation.** PR#18a §10 forbids in v1; PR#18l re-affirms.
- **No migrations.** No new file under `migrations/`. No `schema.sql` edit.
- **No production `endpointUrl` re-flip.** No website artefact change. No production config edit.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No production artefact / config mode flip.**
- **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes.**
- **No AMS repo modification.** PR#18b §4.1.1 dirty-worktree rule still applies.
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header values, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this doc.

---

## 14. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18l-lane-ab-output-governance-planning.md`). No other files touched.
- **Consumes Pass 2 contract only.** §4.1 enumerates the allowed Pass 2 v0.1 fields; §4.2 enumerates the forbidden inputs; the contract refuses any other Pass 2 contract version, any other Trust contract version, or any other Pass 1 contract version.
- **Lane A/B preview contract defined.** §5 locks the `LaneGovernanceCandidate` shape under contract version `lane-governance-contract-v0.1`. §6 closes the `lane_preview_decision` enum at five values.
- **`customer_visibility_allowed = false`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **`lane_write_allowed = false`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **`customer_claim_allowed = false`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **`allowed_customer_language = []`** locked at the contract — §5.1 / §5.2 / §13 / closing line.
- **Lane B dark / internal.** §3.2 / §6 / §8 collectively ensure Lane B is never customer-visible, never customer-claimable, never written to a customer-facing surface.
- **Gate 4 paused.** §12 + §13 + closing line all assert Gate 4 remains paused.
- **Future Lane writer separately gated.** §10.2 enumerates the responsibilities the future Lane writer PR must satisfy and confirms it requires its own Helen GO.
- **No `'high'` evidence grade.** Lane A eligibility (§7) requires `evidence_grade ∈ {'low', 'medium'}`; `'not_usable'` forces `blocked`; `'high'` never appears (carried forward from Pass 2 / Trust contract locks).
- **Reversibility recorded.** §9.1 covers upstream contract amendment + candidate-eligibility regression handling.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18l. **Verdict: PLANNING ONLY — Lane A/B preview and output governance planning under contract version `lane-governance-contract-v0.1` consuming Pass 2 contract version `pass2-claim-governance-contract-v0.1` (which itself consumes Trust contract version `trust-contract-v0.1` and Pass 1 contract version `pass1-output-contract-v0.2`). The `LaneGovernanceCandidate` shape is locked (§5), the closed five-value `lane_preview_decision` enum is locked (§6), Lane A eligibility gates are enumerated (§7), Lane B dark / internal rules are categorical and binding (§8), block / fail-closed rules are enumerated (§9), and the relationships to existing Lane tables (§10) / Evidence Review (§11) / AMS Policy & Trust Core (§11.3) / Gate 4 (§12) are documented as separately-gated downstream steps with AMS remaining reference-only per PR#18b §4.1.1. `customer_visibility_allowed = false`, `lane_write_allowed = false`, `customer_claim_allowed = false`, and `allowed_customer_language = []` are locked at the contract. Block / fail-closed rules (§9) ensure Lane governance falls back to `blocked` / `internal_only` / `insufficient_evidence` on any upstream regression or contract mismatch. No Lane writer, no customer-facing output, no dashboard, no Lane governance runtime, no Pass 2 runtime, no Trust runtime, no Pass 1 runtime, no AMS runtime bridge, no AMS repo modification, no Gate 4 work, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no knobs implementation, no website ThinSDK production activation, no production artefact / config mode flip, no DB writes, no migrations, no schema.sql change, no DB grant changes, no code / scripts / tests / package / env / systemd / Nginx / AMS source / website artefact / production config changes are approved or introduced by PR#18l. Any future Lane writer PR, future customer-surface PR, future Gate 4 PR, or future Pass 1 / Trust / Pass 2 / Lane runtime / bridge PR remains separately gated by its own explicit Helen GO.**
