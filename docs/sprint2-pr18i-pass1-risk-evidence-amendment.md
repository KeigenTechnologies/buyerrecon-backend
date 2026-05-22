# BuyerRecon PR#18i — Pass 1 contract amendment: `risk_evidence_status` `'usable_later'` unlocked

Status: **docs-only contract amendment. Verdict: PASS — the Pass 1 output contract is amended from v0.1 to v0.2 to expand `risk_evidence_status` from three states (`unavailable` / `warning` / `usable_later`) to four states (`unavailable` / `warning` / `blocked` / `usable_later`) and to permit the `'usable_later'` value following PR#18h's PASS staging re-proof closure of the PR#18d `risk_observations_v0_1` source-health warning. No runtime, no customer output, no Lane writer, no AMS runtime bridge, no Pass 1 / Pass 2 / Trust runtime, no Gate 4 work.**

PR#18i is a narrow docs-only amendment to the Pass 1 output contract planning document established by PR#18e (PR #37, merge `1fd044e`). It updates `docs/sprint2-pr18e-pass1-output-contract-planning.md` in place by:

- Bumping the contract version stamp from `pass1-output-contract-v0.1` to `pass1-output-contract-v0.2`.
- Expanding the `risk_evidence_status` enum to four states.
- Recording the v0.1 → v0.2 amendment audit trail as a new sub-section §7.4 inside PR#18e.
- Reaffirming every non-`risk_evidence_status` boundary unchanged.

PR#18i ships this single companion document (this file) as a stand-alone summary of the amendment for future audit lookup. The contract itself is the doc PR#18i amended; this file is the audit record of why.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18i.**
> **No production traffic is approved by PR#18i.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18i; no production artefact / config mode flip is approved by PR#18i.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18i.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18i.**
> **PR#18i is a planning-layer contract amendment. It does NOT pre-authorise any runtime PR.** Any future Pass 1 / Trust / Pass 2 runtime PR that would consume risk-observation evidence still requires its own explicit Helen GO.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `e041bfb` — "Sprint 2 PR#18h: record timing observer risk re-proof (#40)").

PR branch: `buyerrecon-sprint2-pr18i-pass1-risk-evidence-amendment`

Mandatory reference compliance:

- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — the Pass 1 contract; PR#18i amends it (the doc is now v0.2; §7.4 is the new amendment subsection).
- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — PR#18d staging proof that recorded the original `optional_source_count_query_failed / warn / public.risk_observations_v0_1` warning.
- `docs/sprint2-pr18f-risk-observations-source-health.md` — PR#18f source-health diagnostic; verdict `BLOCKED / schema_mismatch`.
- `docs/sprint2-pr18g-risk-observations-created-at-fix.md` — PR#18g narrow code fix (`derived_at` → `created_at`).
- `docs/sprint2-pr18h-timing-observer-risk-reproof.md` — PR#18h staging re-proof; verdict `PASS`; risk source-health warning closed.

---

## 1. Why PR#18i exists

The PR#18e Pass 1 output contract (v0.1) recorded the PR#18d `risk_observations_v0_1` source-health warning in §7 and bound the `risk_evidence_status` field to it. The contract explicitly held `risk_evidence_status` at `'warning'` (or effectively `'unavailable'` while the underlying observer query was broken) and committed in §7.3 that the field "will **not** report `'usable_later'` until a PR that closes this warning is merged and explicitly cited by an amendment to PR#18e (`pass1-output-contract-v0.2`)".

That prerequisite chain has now completed:

| Step | PR | Action | Status |
|---|---|---|---|
| Diagnose | PR#18f (PR #38, merge `96d0563`) | Read-only source-health diagnostic. Recorded `table_exists: true`, `select_privilege: true`, `derived_at_present: false`, `created_at_present: true`, `corrected_query_with_created_at: 2`. Verdict: **`BLOCKED / schema_mismatch`**. | **closed** |
| Fix | PR#18g (PR #39, merge `9b29afd`) | Narrow code fix: `COUNT_RISK_OBSERVATIONS_SQL` filters on canonical `created_at` instead of non-existent `derived_at`. Added schema-guard tests K.6–K.9. 52/52 targeted observer tests pass; `npx tsc --noEmit` clean. | **closed** |
| Re-proof | PR#18h (PR #40, merge `e041bfb`) | Read-only staging re-proof. `observer_exit_code: 0`. Previously-recorded `optional_source_count_query_failed / warn / public.risk_observations_v0_1` anomaly **absent** from the new report. `source_counts.risk_observations_v0_1_in_window: 2` (the real count, matching PR#18f §4). Only remaining anomaly: `synthetic_exclusion_filter_empty / info`. Final status: **`PASS`**. | **closed** |
| Contract amendment | **PR#18i (this PR)** | Docs-only: bump `pass1-output-contract-v0.1` → `pass1-output-contract-v0.2`; expand `risk_evidence_status` enum to four states; permit `'usable_later'`. | **applied** |

PR#18i is step 4 of the four-step transition path. It is the contract-layer change that registers the source-health closure into the Pass 1 planning surface. It is docs-only and does NOT authorise any runtime path.

---

## 2. Exact contract changes (applied in `docs/sprint2-pr18e-pass1-output-contract-planning.md`)

### 2.1 Contract version stamp

| Location | Before (v0.1) | After (v0.2) |
|---|---|---|
| Preamble line 31 | `Contract version: **`pass1-output-contract-v0.1`** (frozen-literal; rev-locked under PR#18e). Any future change requires a new contract version stamp and its own PR.` | `Contract version: **`pass1-output-contract-v0.2`** (frozen-literal; rev-locked under PR#18i amendment to PR#18e). v0.1 was the initial PR#18e lock; v0.2 expands the `risk_evidence_status` enum from three states ... to four states ... and permits the `'usable_later'` value following PR#18h's PASS closure of the PR#18d `risk_observations_v0_1` source-health warning. See §7.4 below for the amendment audit trail.` |
| §4.1 contract-shape heading | `### 4.1 Contract shape (v0.1)` | `### 4.1 Contract shape (v0.1 — amended to v0.2 by PR#18i; see §7.4)` |
| §4.1 contract-shape body field | `pass1_contract_version: 'pass1-output-contract-v0.1'` | `pass1_contract_version: 'pass1-output-contract-v0.2'` |

### 2.2 `risk_evidence_status` enum expansion (the central amendment)

| Before (v0.1) | After (v0.2) |
|---|---|
| `risk_evidence_status: 'unavailable' \| 'warning' \| 'usable_later'` (three states) | `risk_evidence_status: 'unavailable' \| 'warning' \| 'blocked' \| 'usable_later'` (four states) |

New state semantics (v0.2):

| State | Meaning |
|---|---|
| `'unavailable'` | Observer cannot reach the risk source at all (table absent under the operator's DB role, or source not listed in `source_tables_present`). Pass 1 emits `blocked_by_risk_warning` for any candidate whose `evidence_refs` reference risk evidence. |
| `'warning'` | Observer recorded a non-blocking anomaly against the risk source (e.g., soft `optional_source_count_query_failed / warn`). Pass 1 emits `blocked_by_risk_warning` for any candidate whose `evidence_refs` reference risk evidence. |
| `'blocked'` | **NEW in v0.2.** Observer recorded a categorical defect that prevents safe risk-evidence consumption (e.g., schema mismatch, permission denied, deterministic query failure — as catalogued by PR#18f's `BLOCKED / schema_mismatch` verdict before PR#18g's fix). Pass 1 emits `blocked_by_risk_warning`. Trust / Pass 2 must not consume risk evidence. |
| `'usable_later'` | **NEWLY PERMITTED in v0.2.** Source health has been proven by a separately-gated source-health re-proof (PR#18h closed the warning chain). Risk evidence may be considered in **future Pass 1 / Trust planning**. **Runtime scoring is still NOT approved**; customer claims are still NOT approved; Trust / Pass 2 must still govern any later use. Candidates with `risk_evidence_status = 'usable_later'` may receive a non-`blocked_by_risk_warning` interpretation from §5 (e.g. `timing_context_present`, `product_context_present`, `timing_and_product_context_present`, `needs_trust_review`), subject to all other §5 conditions. |

### 2.3 `blocked_by_risk_warning` interpretation gate

Refined applicability rule. The §5 enum row for `blocked_by_risk_warning` is now gated by `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}` (three states) — not by the prior implicit "warning open" framing. When `risk_evidence_status = 'usable_later'`, candidates may instead receive one of the three `*_present` interpretations or `needs_trust_review` from §5, subject to all other §5 conditions (multi-source threshold, confidence cap, exclusion flags).

### 2.4 New §7.4 amendment audit subsection

A new sub-section §7.4 ("PR#18i amendment — risk_evidence_status `'usable_later'` unlocked (v0.1 → v0.2)") was added inside the existing §7 (Risk warning carry-forward) block. The sub-section records:

- The four-step transition path (PR#18d / PR#18f / PR#18g / PR#18h / PR#18i) with PR numbers and merge commit IDs.
- The exact v0.1 → v0.2 changes.
- The list of fields v0.2 explicitly does NOT change (`customer_claim_allowed`, `lane_output_allowed`, §6 forbidden claims, §11 non-goals, §8/§9/§10 relationships).
- The list of things v0.2 does NOT authorise (Pass 1 runtime, customer claim, Lane A/B writer, AMS runtime bridge, Gate 4, production traffic, website ThinSDK activation, production artefact / config mode flip).
- The reversibility rule: if a future observer run re-introduces a risk-source anomaly, candidates must drop back from `'usable_later'` to the matching `'warning'` / `'blocked'` state.

### 2.5 Field-discipline expansion in §4.2

The §4.2 `risk_evidence_status` field-discipline bullet was expanded from a single line to a per-state breakdown (one bullet per state) plus an explicit v0.1 → v0.2 transition rule. The `customer_claim_allowed` / `lane_output_allowed` bullet was clarified to note that **PR#18i does NOT change either flag**; their future amendment would require contract version `v0.3` or higher.

### 2.6 Carry-forward to PR#18e §7.3 contractual guarantees

The two contractual guarantees in §7.3 were not deleted — they were left in place with an annotated "Status under PR#18i" suffix recording that the prerequisite is met (§7.4 details the amendment audit trail) and the `blocked_by_risk_warning` enum is retained in §5 as the gate for the three non-`'usable_later'` states.

### 2.7 §12 acceptance criteria + closing line

The §12 acceptance criterion that previously referenced `pass1-output-contract-v0.1` was updated to reference `pass1-output-contract-v0.2` with a parenthetical note pointing at §7.4 for the amendment trail. The end-of-doc closing-line verdict was rewritten to cite v0.2, the four-step PR chain, and the v0.2 boundary that `'usable_later'` is a planning-layer signal that does NOT authorise runtime scoring, customer output, Lane A/B writer, AMS runtime bridge, Trust runtime, Pass 2 runtime, or Gate 4 work.

---

## 3. What v0.2 explicitly does NOT change

The following are unchanged from v0.1. PR#18i does not touch these clauses except for any incidental version-stamp updates already noted in §2 above.

- `customer_claim_allowed` — **remains `false`**. Customer-facing claim emission is not approved by v0.2.
- `lane_output_allowed` — **remains `false`**. Lane A/B output is not approved by v0.2. PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- §6 (Pass 1 forbidden claims) — every clause unchanged. No "high intent" / "ready to buy" / "buyer is human/AI/bot" / "invalid traffic" / customer-facing lead score / revenue / pipeline / Lane A/B output emission is approved.
- §3 (Inputs not allowed) — every clause unchanged except the implicit risk-evidence row, which v0.2 reframes from a binary "warning open / closed" rule to the four-state `risk_evidence_status` rule.
- §11 (Non-goals) — every clause unchanged.
- §8 (Relationship to Trust) — unchanged. Pass 1 still does not emit `TrustDecisionV3`. AMS Trust Core remains reference-only; no AMS runtime bridge.
- §9 (Relationship to Pass 2) — unchanged. Pass 1 still does not generate customer claims.
- §10 (Relationship to Lane A/B) — unchanged. Pass 1 does not write `scoring_output_lane_a` / `scoring_output_lane_b`. Lane B remains dark / internal.
- The `Pass1Interpretation` enum count (eight values) — unchanged. The applicability rule for `blocked_by_risk_warning` is refined (see §2.3) but the enum value itself is not removed.

---

## 4. What v0.2 does NOT authorise

PR#18i is **planning-layer only**. It explicitly does NOT authorise:

- Any Pass 1 runtime invocation against risk evidence. The `'usable_later'` state is a planning-layer signal that future Pass 1 / Trust planning may reference risk evidence; actual runtime consumption requires a separately-gated PR with its own Helen GO.
- Any customer-facing claim derived from risk evidence.
- Any Lane A/B writer activity. PR#17f / PR#17q grant safety stands.
- Any AMS runtime bridge.
- Any Trust runtime / Pass 2 runtime.
- Any Gate 4 work, production `endpointUrl` re-flip, production traffic, website ThinSDK production activation, or production artefact / config mode flip.
- Any DB schema change, migration, grant change, or DDL/DML.
- Any AMS repo modification.

---

## 5. Reversibility

If a future observer run re-introduces an `optional_source_count_query_failed / warn` or any other categorical defect on `public.risk_observations_v0_1`, candidates must immediately drop back from `'usable_later'` to the matching `'warning'` / `'blocked'` state, and the `blocked_by_risk_warning` interpretation re-applies. The v0.2 four-state enum is bidirectional; PR#18i does not bake `'usable_later'` as a permanent floor.

The schema-guard tests K.6–K.9 added by PR#18g (in `tests/v1/timing-product-context-observer.test.ts`) act as the structural backstop: any attempt to re-introduce a `derived_at` reference on `risk_observations_v0_1` in the observer SQL, schema.sql, or migration 013 will fail the targeted observer suite at CI time, surfacing the regression before a staging re-proof would even need to run.

---

## 6. Boundaries (re-asserted)

- **Docs-only.** Exactly two files touched by PR#18i: the amended `docs/sprint2-pr18e-pass1-output-contract-planning.md` and the new audit-record `docs/sprint2-pr18i-pass1-risk-evidence-amendment.md` (this file).
- **No code, no scripts, no tests, no package files, no migrations, no `schema.sql` change, no env files, no systemd / Nginx files, no AMS source, no website artefacts, no production config changes** introduced by PR#18i.
- **No DB writes, no grants, no DDL, no DML.** PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety stand.
- **No runtime scoring; no Pass 1 / Pass 2 / Trust runtime; no customer-facing output; no Lane A/B writer; no AMS runtime bridge; no AMS repo modification; no Gate 4; no production `endpointUrl` re-flip; no production traffic; no Track A; no Playwright; no knobs / dashboard; no website ThinSDK production activation; no production artefact / config mode flip.**
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw payload, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this amendment record or in the v0.2 contract doc.

---

End of PR#18i. **Verdict: PASS — Pass 1 output contract amended from v0.1 to v0.2 docs-only. `risk_evidence_status` enum expanded from three states to four (`unavailable` / `warning` / `blocked` / `usable_later`); `'usable_later'` permitted following PR#18h's PASS closure of the PR#18d risk source-health warning chain (PR#18d → PR#18f → PR#18g → PR#18h → PR#18i). `customer_claim_allowed`, `lane_output_allowed`, §6 forbidden claims, §11 non-goals, §8/§9/§10 relationships all unchanged. PR#18i is planning-layer only and does NOT approve any Pass 1 runtime, Trust runtime, Pass 2 runtime, customer-facing output, Lane A/B writer, AMS runtime bridge, AMS repo modification, Gate 4 work, production `endpointUrl` re-flip, production traffic, Track A, Playwright, knobs / dashboard, website ThinSDK production activation, or production artefact / config mode flip. Any future Pass 1 / Trust / Pass 2 runtime PR that would consume risk-observation evidence remains separately gated by its own explicit Helen GO. v0.2 is reversible: if a future observer run re-introduces a risk-source anomaly, candidates drop back from `'usable_later'` to `'warning'` / `'blocked'` and the `blocked_by_risk_warning` interpretation re-applies.**
