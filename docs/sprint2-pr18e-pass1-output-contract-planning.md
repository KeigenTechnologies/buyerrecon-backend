# BuyerRecon PR#18e — Pass 1 output contract planning after Timing/Product Context observer proof

Status: **docs-only planning record. Verdict: PLANNING ONLY — Pass 1 output contract planning. No Pass 1 runtime, no Trust runtime, no Pass 2 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no Gate 4 work, no production traffic.**

PR#18e is the next step in the post-Gate-3 chain defined by PR#18a → PR#18b → PR#18c → PR#18d. The PR#18c read-only Timing / Product-Context observer was successfully exercised on the Hetzner staging host in PR#18d (verdict `PASS_WITH_WARNINGS`), with one warning carried forward (`optional_source_count_query_failed / warn / public.risk_observations_v0_1`). PR#18e locks the **Pass 1 output contract** — the shape of the preview-only candidate that PR#18c's observer hands forward to a future Pass 1 surface — without authorising any Pass 1 runtime, customer-facing surface, or Lane A/B output.

PR#18e is a **planning document only**. It introduces no implementation. It does not write any Lane A/B row, does not invoke AMS Pass 1 / Pass 2 / Trust runtime, does not modify the AMS repository, does not change schema / migrations / production config / `/var/www` / `endpointUrl`, and does not touch any production endpoint. Each subsequent PR (PR#18f Trust planning, PR#18g Lane A/B governance planning, any Gate 4 PR) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18e.**
> **No production traffic is approved by PR#18e.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18e; no production artefact / config mode flip is approved by PR#18e.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18e.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18e.**
> **PR#18e advances the PR#18a §13 chain by exactly one step. It does NOT pre-authorise PR#18f (Trust planning) or PR#18g (Lane A/B governance planning); each requires its own separate Helen GO.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `8567116` — "Sprint 2 PR#18d: record timing observer staging proof (#36)").

PR branch: `buyerrecon-sprint2-pr18e-pass1-output-contract-planning`

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic chain; PR#18e is step 2 (Pass 1 planning) and locks OD-P1 → OD-P5 from PR#18a §6.3.
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — the §7 confidence-cap policy (low / medium only) carried forward; PR#18e Pass 1 preview never exceeds these caps.
- `docs/sprint2-pr18c-timing-product-context-observer.md` — the read-only observer; PR#18e Pass 1 input is the `ProductContextSessionCandidate` pass-forward shape it emits.
- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — PR#18d PASS_WITH_WARNINGS; the §8 `risk_observations_v0_1` warning carried forward into §7 below.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md` — AMS reserved-name guard; PR#18e does NOT redefine AMS Pass 1 / Pass 2 / Trust names.
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` — Lane A / Lane B governance baseline; PR#18e Pass 1 is upstream of Lane A/B and emits no Lane A/B output.
- `docs/sprint2-pr15a-evidence-review-snapshot-observer.md` — Evidence Review Snapshot is a separate read-only surface; PR#18e Pass 1 does not write to it.

Contract version: **`pass1-output-contract-v0.2`** (frozen-literal; rev-locked under PR#18i amendment to PR#18e). v0.1 was the initial PR#18e lock; v0.2 expands the `risk_evidence_status` enum from three states (`unavailable` / `warning` / `usable_later`) to four states (`unavailable` / `warning` / `blocked` / `usable_later`) and permits the `'usable_later'` value following PR#18h's PASS closure of the PR#18d `risk_observations_v0_1` source-health warning. See §7.4 below for the amendment audit trail. Any future change requires a new contract version stamp and its own PR.

---

## 1. Status / verdict

**PLANNING ONLY — Pass 1 output contract planning. No runtime, no customer output.**

- PR#18e defines the *shape* of the Pass 1 preview-only candidate (§4) plus the categorical enums of allowed Pass 1 interpretations (§5) and explicitly forbidden claims (§6).
- PR#18e does NOT implement Pass 1. No `src/scoring/pass1/` module is introduced. No CLI script. No DB query. No DDL. No DML.
- PR#18e does NOT authorise any Pass 1 runtime invocation against any data source — staging or production.
- PR#18e does NOT authorise any customer-facing surface. The Pass 1 candidate is internal-only by contract; PR#18g (Lane A/B governance) and any future customer-surface PR are the gates for downstream visibility.
- PR#18e does NOT pre-authorise PR#18f (Trust planning) or PR#18g (Lane A/B governance planning). Each is a separately-gated PR.
- The PR#18d `risk_observations_v0_1` warning (§7) is preserved as a categorical carry-forward; PR#18e Pass 1 planning is unblocked, but any future Pass 1 runtime PR that consumes risk evidence is blocked until the warning is investigated and resolved.

---

## 2. Inputs allowed into Pass 1 planning

Pass 1's only sanctioned input is the `ProductContextSessionCandidate` shape defined by PR#18c's observer (`src/scoring/timing-product-context-observer/types.ts:ProductContextSessionCandidate`). Per-candidate fields:

| Field | Source | Use in Pass 1 |
|---|---|---|
| `timing_band_candidate` | PR#18c `mapper.classifyTimingBand` | Primary temporal signal; one of `hot_now` / `warm_recent` / `cooling` / `stale` / `dormant` / `insufficient_evidence` (PR#18b §7.1). |
| `product_context_candidate` | PR#18c `mapper.buildSessionCandidate` | Categorical context label; one of `evidence_observed` / `single_source_signal` / `synthetic_only_excluded` / `insufficient_evidence` / `threshold_not_locked` (PR#18c §5.3). |
| `confidence_cap` | PR#18c `mapper.computeConfidenceCap` | Categorical cap; `low` or `medium` only — Pass 1 must NOT elevate above this cap (PR#18b §7.2 / PR#18c §5.2). |
| `confidence_reason` | PR#18c `mapper.computeConfidenceCap` | Categorical reason; one of the seven `CONFIDENCE_REASONS_ALLOWED` enums in `types.ts`. |
| `evidence_refs` | PR#18c `mapper.buildSessionCandidate` | Categorical labels (`accepted_events:N`); Pass 1 may inspect counts but must NEVER access underlying row content. |
| `exclusion_flags` | PR#18c `mapper.buildSessionCandidate` | Categorical flags (`session_id_redacted`, `optional_source_missing`, `lane_b_dark_internal`); Pass 1 must respect each. |
| `pass_forward_to_pass1` | PR#18c `mapper.buildSessionCandidate` | Boolean gate; Pass 1 must only consider candidates where this is `true`. |
| `session_id_redacted` | PR#18c `mapper.truncateSessionId` | Truncated form `prefix(8)…suffix(4)` only; Pass 1 must NEVER reverse this or join against a full session_id. |

### Insufficient-evidence reasons

Where a candidate carries `product_context_candidate = 'insufficient_evidence'` or `timing_band_candidate = 'insufficient_evidence'`, Pass 1 must treat the row as `insufficient_evidence` (§5) and emit the `pass_to_trust_planning: no` outcome.

### Carry-forward from PR#18d staging proof

PR#18d reported `candidate_count = 0` and `pass_forward_to_pass1_count = 0` because the staging proof boundary `(buyerrecon_staging_ws, buyerrecon_com)` contained only Gate-N proof rows in-window (all excluded by the synthetic-fixture rule). This is **acceptable input for contract planning**: PR#18e is locking the *shape* of the Pass 1 contract, not its volume. The shape is well-defined even when zero candidates are present. PR#18e explicitly states this is **not sufficient evidence for runtime / customer output** — a future Pass 1 runtime PR must demonstrate non-zero commercial candidates (after Gate 4 PR C re-flips production `endpointUrl` and commercial Sprint 2 evidence accumulates) before any runtime emission is approved.

---

## 3. Inputs not allowed

The Pass 1 contract explicitly forbids the following as inputs to any Pass 1 evaluation, planning artefact, or future runtime:

- **Raw `session_id`**. Only `session_id_redacted` (prefix(8)…suffix(4)) is permitted.
- **`request_id` UUID values**. PR#18c's observer uses these internally for grouping; they never reach the candidate output and must never reach Pass 1.
- **Raw payload bytes** of any kind — fixture body, accepted_event raw column, canonical_jsonb projection, encoded request body, response body.
- **Full URLs with query strings**. Query strings may carry PII, campaign identifiers, customer-supplied tokens, or session continuation markers. Pass 1 inputs do not include any URL beyond categorical fields already in the observer's pass-forward shape (none today).
- **Token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header values**.
- **Synthetic Gate 2 / Gate 3 / Gate-N proof rows as commercial evidence**. The observer already excludes these via PR#18c §4 / PR#18b §6; Pass 1 must NOT re-introduce them by reading directly from `accepted_events` / `ingest_requests` / `rejected_events` bypassing the observer's exclusion. Pass 1's only sanctioned upstream is the observer's pass-forward shape — *not* the raw DB.
- **`public.risk_observations_v0_1` evidence** until the PR#18d §8 warning (`optional_source_count_query_failed / warn / public.risk_observations_v0_1`) is investigated and resolved. PR#18e Pass 1 is **planning-only**; the warning is non-blocking for planning. Any future Pass 1 runtime / contract amendment that consumes risk-observation evidence is blocked until §7 carry-forward is closed.
- **Lane B / AI-agent observations** as customer-visible inputs. Lane B remains dark / internal (PR#18b §10 OD-6 / PR#18c exclusion-flag `lane_b_dark_internal`). Pass 1 may *receive* the `lane_b_dark_internal` exclusion flag from the observer's pass-forward shape — but it must NOT emit any output that surfaces Lane B's existence beyond a categorical exclusion flag on the Pass 1 candidate itself (§4 `exclusion_flags`).

---

## 4. Pass 1 output contract

The Pass 1 output is a **preview-only candidate**. One Pass 1 candidate per (input observer candidate where `pass_forward_to_pass1 = true`). Pass 1 emits no row when the observer candidate is gated out.

### 4.1 Contract shape (v0.1 — amended to v0.2 by PR#18i; see §7.4)

```
Pass1Candidate {
  pass1_candidate_id:           string              // observer-redacted id form; NEVER the raw session_id
  input_observer_version:       'timing-product-context-observer-v0.1'
  pass1_contract_version:       'pass1-output-contract-v0.2'

  timing_band_candidate:        TimingBand          // carried forward from observer; not recomputed
  product_context_candidate:    ProductContextCandidate  // carried forward; not recomputed

  evidence_confidence_cap:      'low' | 'medium'    // carried forward; NEVER elevated above observer
  evidence_confidence_reason:   ConfidenceReason    // carried forward

  pass1_interpretation:         Pass1Interpretation // §5 categorical enum only — NEVER customer-facing prose

  allowed_evidence_refs:        readonly string[]   // subset of observer's evidence_refs; counts only
  exclusion_flags:              readonly ExclusionFlag[]  // includes observer flags + Pass 1-added flags
  insufficiency_reasons:        readonly string[]   // categorical labels only (§5 interpretation enum)

  risk_evidence_status:         'unavailable' | 'warning' | 'blocked' | 'usable_later'
                                                    // 'unavailable' — observer cannot reach the risk source at all (e.g., table absent)
                                                    // 'warning'     — soft anomaly recorded on the risk source (e.g., transient count-query failure)
                                                    // 'blocked'     — categorical defect (schema/permission/query failure) recorded; risk evidence unsafe to read
                                                    // 'usable_later' — source health proven (PR#18h PASS closed the PR#18d warning); risk evidence eligible for FUTURE planning;
                                                    //                  RUNTIME scoring of risk evidence still requires a separate Helen-GO'd PR.

  customer_claim_allowed:       false               // ALWAYS false in PR#18e — locked at the contract
  lane_output_allowed:          false               // ALWAYS false in PR#18e — locked at the contract

  pass_to_trust_planning:       boolean             // true only for interpretations that warrant Trust review
}
```

### 4.2 Field discipline

- **`pass1_candidate_id`**: a categorical, internally-routable identifier. Derivation: a hash of (`observer_run_id`, `session_id_redacted`, `pass1_contract_version`) — *not* a hash that can be reversed to the full session_id. Never a UUID generated from a request_id. The exact derivation is locked when the first Pass 1 read-only observer ships (separate PR, separate Helen GO); PR#18e only fixes the *field name* and its categorical contract.
- **`evidence_confidence_cap`**: must be a verbatim copy of the observer's `confidence_cap`. Pass 1 has **no mechanism to elevate** the cap. If a future amendment ever needed to drop the cap further (e.g., `confidence_cap = 'low'` because Pass 1 reasoned about anomalies the observer didn't see), that drop must be expressed via `pass1_interpretation` + `insufficiency_reasons`, not by mutating the cap.
- **`pass1_interpretation`**: the single categorical enum chosen from §5. **Never a free-form string. Never customer-facing prose.**
- **`allowed_evidence_refs`**: must be a strict subset of the observer's `evidence_refs`. Pass 1 may downgrade (drop refs it considers unsafe), but never add references the observer did not vouch for.
- **`exclusion_flags`**: must always include the observer's flags. Pass 1 may *add* flags from a Pass-1-defined enum (e.g., `blocked_by_risk_warning`) but must not remove flags set upstream.
- **`risk_evidence_status`** (v0.2 four-state contract):
  - `'unavailable'` — the observer cannot reach the risk source at all (e.g., `risk_observations_v0_1` table absent under the operator's DB role, or the source is not listed in `source_tables_present`). Pass 1 emits `blocked_by_risk_warning` for any candidate whose `evidence_refs` reference risk evidence.
  - `'warning'` — the observer recorded a non-blocking anomaly against the risk source (e.g., a soft `optional_source_count_query_failed / warn`). Pass 1 emits `blocked_by_risk_warning` for any candidate whose `evidence_refs` reference risk evidence.
  - `'blocked'` — the observer recorded a categorical defect that prevents safe risk evidence consumption (e.g., schema mismatch, permission denied, deterministic query failure such as PR#18d's pre-PR#18g state). Pass 1 emits `blocked_by_risk_warning` and Trust / Pass 2 must not consume risk evidence.
  - `'usable_later'` — source health has been proven by a separately-gated source-health re-proof (PR#18h's PASS re-proof closed the PR#18d `risk_observations_v0_1` warning). Risk evidence may now be considered in **future Pass 1 / Trust planning**. **Runtime scoring is still not approved**; customer claims are still not approved; Trust / Pass 2 must still govern any later use. Candidates with `risk_evidence_status = 'usable_later'` may receive a non-`blocked_by_risk_warning` interpretation from §5, but their `pass_to_trust_planning` flag may still be `false` if other §5 conditions are not met.
  - **v0.1 → v0.2 transition rule**: PR#18h's PASS closure of the PR#18d / PR#18f source-health warning (after PR#18g's `derived_at` → `created_at` code fix) is the **prerequisite** for any candidate's `risk_evidence_status` to be set to `'usable_later'`. If a future observer run re-introduces a `warn` or `blocked` anomaly on the risk source, candidates must drop back to `'warning'` or `'blocked'` until the anomaly is closed again.
- **`customer_claim_allowed`** and **`lane_output_allowed`**: ALWAYS `false` in this contract. Future PRs that want to flip either flag must amend the contract under a new version stamp (`pass1-output-contract-v0.3`) with their own PR + Helen GO + Codex review. **PR#18i / contract version v0.2 does NOT change either flag.**
- **`pass_to_trust_planning`**: a binary gate to PR#18f (Trust planning). It is `true` only for interpretations §5 marks as "warrants Trust review"; for the rest, Pass 1 stops at the preview and Trust does not see the candidate.

### 4.3 No raw fields in the contract

Explicit list of fields that MUST NOT exist anywhere in `Pass1Candidate` or its serialised form:

- `session_id` (full form) / `raw_session_id`.
- `request_id` / `request_uuid` / any UUID-shaped string field.
- `raw_event` / `payload` / `canonical_jsonb` / `request_body` / `response_body`.
- `url` / `full_url` / `referrer_full` (categorical referrer class is acceptable but only if locked to a known allowlist — out of scope for v0.1).
- `token` / `token_hash` / `token_prefix` / `token_suffix` / `token_id` / `pepper` / `database_url` / `dsn` / `authorization` / `bearer`.
- `customer_claim_text` / `customer_message` / `marketing_copy` / `lead_score` / `revenue_estimate` / `pipeline_estimate`.

---

## 5. Pass 1 allowed interpretations

The `Pass1Interpretation` enum is **closed**. Pass 1 emits one of these eight categorical values and nothing else. No free-form interpretation field. No prose.

| Enum value | Categorical meaning |
|---|---|
| `insufficient_evidence` | Observer reported `insufficient_evidence` for either timing or product-context; Pass 1 has no basis to interpret further. `pass_to_trust_planning = false`. |
| `timing_context_present` | Observer reported a non-`insufficient_evidence` timing band with confidence cap ≤ `medium`. No product-context inference attempted. Eligible for Trust planning review. |
| `product_context_present` | Observer reported a non-`insufficient_evidence` product-context candidate with confidence cap ≤ `medium`. No timing-band claim. Eligible for Trust planning review. |
| `timing_and_product_context_present` | Both timing band and product context are non-`insufficient_evidence`, both at confidence cap ≤ `medium`. Eligible for Trust planning review. |
| `needs_trust_review` | Pass 1 detected a condition where the candidate should explicitly be reviewed by a future Trust planning step before being interpreted further. `pass_to_trust_planning = true`. Distinct from the three "present" interpretations above by being an explicit escalation flag rather than a state. |
| `blocked_by_synthetic_only` | Observer flagged the row via the synthetic-fixture exclusion machinery; Pass 1 emits this categorical state and does NOT pass to Trust. `customer_claim_allowed = false`, `lane_output_allowed = false`, `pass_to_trust_planning = false`. |
| `blocked_by_missing_required_evidence` | Observer reported `required_source_missing` (e.g. `accepted_events` absent — leads to `BLOCKED` final_status); Pass 1 does not interpret. `pass_to_trust_planning = false`. |
| `blocked_by_risk_warning` | The candidate's `evidence_refs` reference risk-observation evidence AND `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`. Pass 1 categorically refuses to interpret based on unavailable / unsafe risk evidence. `pass_to_trust_planning = false`. *(v0.2 note: this enum remains the gate while the risk source is in any non-`'usable_later'` state. When `risk_evidence_status = 'usable_later'`, candidates that reference risk evidence may instead receive one of the three `*_present` interpretations or `needs_trust_review`, subject to all other §5 conditions; PR#18i contract amendment does NOT itself approve a runtime decision to consume risk evidence.)* |

### 5.1 What is explicitly NOT in the enum

No `high_intent`, no `ready_to_buy`, no `human_visitor`, no `bot_visitor`, no `ai_agent_detected`, no `invalid_traffic`, no `lead_quality`, no `conversion_likely`, no `revenue_eligible`, no customer-facing language of any kind. These categorical absences are part of the v0.1 contract, carried forward unchanged into v0.2, and removable only via a new contract version stamp (`pass1-output-contract-v0.3` or higher).

---

## 6. Pass 1 forbidden claims

Pass 1 must NEVER emit any of the following — neither in the Pass 1 candidate, nor in any downstream artefact derived from a Pass 1 candidate, nor in any customer-visible surface, internal report, log line, dashboard, or audit trail:

- **"Buyer is ready to buy"** / "high purchase intent" / "imminent conversion" / "showing buying signals" / any temporal-buying claim.
- **"Buyer is high intent"** / "qualified lead" / "warm prospect" / any lead-grading claim.
- **"Visitor is human"** / "visitor is AI" / "visitor is bot" / "visitor is genuine" / any final visitor-classification claim. Lane A/B is the gate for these decisions (PR#18b §10 OD-6); Pass 1 does not emit them. The internal `exclusion_flags` (e.g. `lane_b_dark_internal`) are categorical exclusion markers, NOT classification claims.
- **"Invalid traffic"** / "validated good traffic" / any final traffic-quality conclusion.
- **Customer-facing lead score** of any kind (numeric or categorical) — neither in the Pass 1 candidate fields, nor in any field derivable from them. `customer_claim_allowed = false` is locked at the contract.
- **Revenue / pipeline claims** — "$X expected revenue", "high pipeline impact", "estimated deal size N", "ARR contribution". Not in Pass 1, not in any field derived from a Pass 1 candidate.
- **Lane A/B output** — Pass 1 does not produce a Lane A/B row, does not produce a Lane A/B preview row, does not write to `public.scoring_output_lane_a` or `public.scoring_output_lane_b`, and does not emit any field that a downstream surface could interpret as Lane membership. `lane_output_allowed = false` is locked at the contract.
- **Any claim based only on synthetic / control rows.** If a candidate's evidence_refs reference only synthetic Gate-N rows (already filtered by observer, so this should never occur in practice — but defence-in-depth applies), Pass 1 emits `blocked_by_synthetic_only`. No commercial interpretation.
- **Any claim using risk evidence while the PR#18d §8 `risk_observations_v0_1` warning remains unresolved.** Pass 1 emits `blocked_by_risk_warning` for these candidates (§5).
- **AMS reserved-name pretensions** — Pass 1 must NOT emit any field labelled `Fit` / `Intent` / `Window` / `ProductDecision` / `RequestedAction` / `TRQ` / `BuyerReconProductFeatures` / `Pass1` (as a type name) / `Pass2` / `TrustDecisionV3`. The AMS reserved-name guard (PR#14a §10) applies to Pass 1 outputs at the JSON-key, type-name, and column-name level.

---

## 7. Risk warning carry-forward (from PR#18d §8)

PR#18d's staging proof surfaced one warning that PR#18e is contractually required to preserve and propagate:

| Field | Value |
|---|---|
| Source | `docs/sprint2-pr18d-timing-product-context-observer-proof.md` §8 |
| Anomaly kind | `optional_source_count_query_failed` |
| Severity | `warn` |
| Detail | `public.risk_observations_v0_1` (table name only; no SQL error text was captured) |
| Table presence | **present** (confirmed by separate `to_regclass` probe in PR#18d §3.1) |
| Reported count in PR#18d | `0` (default-on-failure from `countOptional`; not a confirmed empty source) |

### 7.1 Effect on PR#18e

- **Pass 1 planning may proceed.** PR#18e is docs-only and does not consume risk evidence at runtime.
- **`risk_evidence_status` is locked at `'warning'`** in the Pass 1 contract (§4) until the warning is closed.
- Candidates whose `evidence_refs` reference risk-observation sources emit `pass1_interpretation = 'blocked_by_risk_warning'` (§5).

### 7.2 Effect on any future PR

- **Pass 1 runtime / observer cannot rely on risk-observation evidence** until the warning is investigated and resolved.
- Resolution requires a **separately-gated PR** that demonstrates risk_observations_v0_1 query health categorically. Categorical hypotheses (per PR#18d §8.1):
  - DB role privilege — inspect `information_schema.role_table_grants` (read-only).
  - Column-shape drift — inspect `information_schema.columns` for the deployed `risk_observations_v0_1` schema.
  - Transient failure — categorical re-run of the observer on a separately-gated run.
- The resolution PR MUST be docs-only or read-only (no `GRANT` / `REVOKE` / DDL). Any grant amendment is its own follow-up PR under explicit Helen GO.

### 7.3 PR#18e contractual guarantees regarding §7

- The `Pass1Candidate.risk_evidence_status` field will **not** report `'usable_later'` until a PR that closes this warning is merged and explicitly cited by an amendment to PR#18e (`pass1-output-contract-v0.2`). *(Status under PR#18i: this prerequisite is met — PR#18g + PR#18h closed the warning. See §7.4 for the amendment audit trail.)*
- The `blocked_by_risk_warning` interpretation enum will NOT be removed from §5 until the warning is closed. *(Status under PR#18i: the enum is retained in §5 as the gate for `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`; the v0.2 amendment expands its applicability rule rather than removing the enum.)*

### 7.4 PR#18i amendment — risk_evidence_status `'usable_later'` unlocked (v0.1 → v0.2)

**This subsection records the v0.1 → v0.2 contract amendment performed by PR#18i.** The amendment is docs-only and does NOT approve runtime scoring, customer output, Lane A/B writer, AMS runtime bridge, Pass 1 runtime, Pass 2 runtime, Trust runtime, or Gate 4 work.

| Step in the §7.3 transition path | PR | Status |
|---|---|---|
| 1. Diagnose the source-health warning | PR#18f (PR #38, merge `96d0563`) | **closed** — verdict `BLOCKED / schema_mismatch` recorded |
| 2. Narrow code fix to the observer query | PR#18g (PR #39, merge `9b29afd`) | **closed** — `COUNT_RISK_OBSERVATIONS_SQL` now filters on canonical `created_at`; schema-guard tests K.6–K.9 added; 52/52 targeted tests pass |
| 3. Staging re-proof confirming the warning is closed | PR#18h (PR #40, merge `e041bfb`) | **closed** — final_status `PASS`; `risk_observations_v0_1` count confirmed as `2`; `optional_source_count_query_failed / warn / public.risk_observations_v0_1` anomaly ABSENT from the re-proof report |
| 4. Contract amendment permitting `risk_evidence_status = 'usable_later'` | PR#18i (this amendment) | **applied** |

#### What v0.2 changes vs. v0.1

- **Contract version stamp**: `pass1-output-contract-v0.1` → `pass1-output-contract-v0.2`.
- **`risk_evidence_status` enum**: expanded from `'unavailable' | 'warning' | 'usable_later'` (3 states) to `'unavailable' | 'warning' | 'blocked' | 'usable_later'` (4 states). The `'blocked'` state is a new categorical for the schema/permission/query-failure case that PR#18f catalogued; it is distinct from `'warning'` (soft anomaly) and from `'unavailable'` (source absent entirely).
- **Permission to emit `'usable_later'`**: previously locked out by §7.3 until a separately-gated PR closed the warning. PR#18h has now done so; v0.2 permits the value to appear on candidate rows whose `evidence_refs` reference the (now-healthy) risk source. Setting the value is a **planning** signal, not a runtime authorisation.
- **`blocked_by_risk_warning` interpretation**: remains in §5. Now gated by `risk_evidence_status ∈ {'unavailable', 'warning', 'blocked'}`. When `risk_evidence_status = 'usable_later'`, candidates may instead receive `timing_context_present` / `product_context_present` / `timing_and_product_context_present` / `needs_trust_review` from §5, subject to all other §5 conditions (multi-source threshold, confidence cap, exclusion flags, etc.).

#### What v0.2 explicitly does NOT change

- `customer_claim_allowed` — remains `false`.
- `lane_output_allowed` — remains `false`.
- Every entry in §6 (Pass 1 forbidden claims) — unchanged.
- §3 (Inputs not allowed) — unchanged for everything other than the risk-evidence row, which is now governed by the four-state `risk_evidence_status` rather than the prior binary "warning open / closed" framing.
- §11 (Non-goals) — unchanged.
- §8 (Relationship to Trust) — unchanged; Pass 1 still does not emit `TrustDecisionV3` or call AMS Trust at runtime.
- §9 (Relationship to Pass 2) — unchanged; Pass 1 still does not generate customer claims.
- §10 (Relationship to Lane A/B) — unchanged; PR#17f / PR#17q grant safety stands.

#### What v0.2 does NOT authorise

- Any Pass 1 runtime invocation against risk evidence. The `'usable_later'` state is a planning-layer signal that future Pass 1 / Trust planning may reference risk evidence; actual runtime consumption requires a separately-gated PR with its own Helen GO.
- Any customer-facing claim derived from risk evidence.
- Any Lane A/B writer activity.
- Any AMS runtime bridge.
- Any Gate 4 work, production `endpointUrl` re-flip, production traffic, website ThinSDK production activation, or production artefact / config mode flip.

#### Reversibility

If a future observer run re-introduces an `optional_source_count_query_failed / warn` or any other categorical defect on `public.risk_observations_v0_1`, candidates must immediately drop back from `'usable_later'` to the matching `'warning'` / `'blocked'` state, and the `blocked_by_risk_warning` interpretation re-applies. The v0.2 four-state enum is bidirectional; PR#18i does not bake `'usable_later'` as a permanent floor.

---

## 8. Relationship to Trust (PR#18f)

Pass 1 is NOT Trust. Pass 1 produces preview candidates that Trust may later review.

### 8.1 What Pass 1 does NOT do

- No Trust decay calculation.
- No action-confidence emission.
- No `TrustDecisionV3` output.
- No `NewTrustScore` / `ConfidenceScore01` / `EffectiveR` / `EscrowDelayMin` / `ReviewRequired` field.
- No AMS Trust runtime invocation (AMS owns Trust per PR#18b §4.2 / `internal/trustcore/engine.go`).

### 8.2 What Pass 1 hands forward to Trust planning

When `pass_to_trust_planning = true`, the `Pass1Candidate` is the input to PR#18f Trust planning. PR#18f locks:

- The Trust dimensions consumed (per PR#18a §7.1: score-confidence / evidence-confidence / trust-decay / scoring-action-trust / AMS-shared-core alignment).
- The mapping of Pass 1 interpretations → Trust input slots.
- The decay representation (OD-Tr2 in PR#18a §7.3).
- The AMS Trust shared-core alignment posture (OD-Tr3).

**PR#18f is not opened by PR#18e.** PR#18f remains separately gated by its own Helen GO.

---

## 9. Relationship to Pass 2 (later — see PR#18a §8 / OD-P2-1..5)

Pass 2 is NOT part of PR#18e. Pass 2 sits **after** Trust and gates claim language + customer-visible assertions (PR#18a §8). PR#18e Pass 1 must NOT pre-empt Pass 2 by generating customer-facing claims.

### 9.1 Discipline

- Pass 1 emits only the §5 categorical interpretation enum.
- Pass 1's `customer_claim_allowed = false` is the contract-level lock.
- Pass 2, when separately planned and implemented, will own the claim allowlist (PR#18a §8.3 OD-P2-2). Pass 1 does not anticipate or pre-bake that allowlist.

---

## 10. Relationship to Lane A/B (later — see PR#18a §9 / PR#16a / PR#18g)

Pass 1 is **upstream of** Lane A/B governance.

### 10.1 Discipline

- Pass 1 does NOT write `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. The PR#17f / PR#17q grant-safety boundary stands.
- Pass 1 does NOT emit a Lane A / Lane B output row.
- Pass 1 receives the observer's `lane_b_dark_internal` exclusion flag and propagates it categorically; it does NOT surface Lane B's existence as a customer-visible claim or anywhere outside the `exclusion_flags` field.
- Lane A/B preview / writer / customer-output governance is PR#18g's scope. PR#18g remains separately gated.

---

## 11. Non-goals

PR#18e explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No Pass 1 runtime.** No `src/scoring/pass1/` module, no observer that emits Pass 1 candidate rows into any table, no CLI script that invokes Pass 1 against any data source.
- **No DB writes.** No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `ALTER` / `CREATE` / `DROP` / `GRANT` / `REVOKE` against any database.
- **No customer-facing output.** No surface that renders a Pass 1 candidate field to any customer.
- **No Lane A/B writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **No AMS runtime bridge.** AMS Pass 1 (`internal/policy/pass1.go`) / Pass 2 (`internal/policy/pass2.go`) / Trust Core (`internal/trustcore/engine.go`) remain reference-only per PR#18b §4. No runtime call.
- **No Trust runtime.** No `TrustDecisionV3` emission. No trust-decay calculation. No AMS Trust integration.
- **No Pass 2 runtime.** No claim allowlist enforcement. No customer-claim emission gate.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated per PR#18a §11 / PR#17y §12.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A.** Track A remains gated under PR#17e (or successor).
- **No Playwright.** No headless / programmatic browser run.
- **No knobs / dashboard implementation.** PR#18a §10 forbids implementation in v1; PR#18e re-affirms.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No production artefact / config mode flip.** No website artefact change. No production config edit.
- **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes.**
- **No AMS repo modification.** PR#18b §4.1.1 — AMS dirty-worktree observations remain reference-only and non-contractual.
- **No reliance on `risk_observations_v0_1` evidence at runtime** until the PR#18d §8 warning is resolved.
- **No secrets in any artefact.** No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, vault content, or shell-history extract appears in this doc.

---

## 12. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18e-pass1-output-contract-planning.md`). No other files touched.
- **Clear Pass 1 input / output contract.** §2 enumerates the allowed inputs (the observer's pass-forward shape); §3 enumerates forbidden inputs; §4 locks the `Pass1Candidate` shape under contract version `pass1-output-contract-v0.2` (originally `v0.1` under PR#18e; amended to `v0.2` by PR#18i — see §7.4); §5 locks the 8-value `Pass1Interpretation` enum; §6 locks the forbidden-claim list.
- **Risk warning preserved.** §7 carries forward PR#18d §8 verbatim and binds Pass 1's `risk_evidence_status` field + `blocked_by_risk_warning` interpretation to its resolution.
- **No customer claims.** §6's forbidden-claim list + §4's `customer_claim_allowed = false` contract lock + §10's Lane-A/B-not-in-PR#18e affirmations together prevent any customer-facing assertion from being generated.
- **No runtime / output approval.** §1, §11, and the closing line all assert no runtime, no output, no Lane writer, no AMS bridge, no Gate 4 work.
- **Safe handoff to Trust planning.** §4.1's `pass_to_trust_planning` boolean + §8's discipline define exactly what PR#18f will receive. PR#18f is NOT opened by PR#18e.
- **No secret values.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18e. **Verdict: PLANNING ONLY — Pass 1 output contract planning under contract version `pass1-output-contract-v0.2` (originally v0.1 under PR#18e; amended to v0.2 by PR#18i — see §7.4 for the amendment audit trail). The Pass 1 candidate shape is locked (§4), the allowed-interpretation enum is closed at 8 categorical values (§5), the forbidden-claim list is enumerated (§6), the PR#18d `risk_observations_v0_1` warning is carried forward (§7) and bound to the `risk_evidence_status` field + `blocked_by_risk_warning` interpretation. v0.2 expands `risk_evidence_status` to four states (`unavailable` / `warning` / `blocked` / `usable_later`) following PR#18h's PASS staging re-proof closure of the warning chain (PR#18d → PR#18f → PR#18g → PR#18h); the `'usable_later'` state is a planning-layer signal that does NOT itself authorise runtime scoring, customer output, Lane A/B writer, AMS runtime bridge, Trust runtime, Pass 2 runtime, or Gate 4 work. The relationships to Trust (§8) / Pass 2 (§9) / Lane A/B (§10) are documented as separately-gated downstream steps, and the non-goals list (§11) preserves all boundaries from PR#18a / PR#18b. No Pass 1 runtime, no Trust runtime, no Pass 2 runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no Gate 4 work, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no knobs / dashboard, no website ThinSDK production activation, no production artefact / config mode flip, no AMS repo modification, no code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are approved or introduced by PR#18e or PR#18i. Any future Pass 1 runtime / Trust runtime / Pass 2 runtime / Lane A/B writer / Gate 4 PR remains separately gated by its own explicit Helen GO.**
