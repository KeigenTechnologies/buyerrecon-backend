# Sprint 3 — External Evidence Report Readiness Planning After Gate 4C PASS (Docs-Only)

> **DOCS-ONLY PLANNING RECORD.** This PR plans the readiness path for
> the external evidence report after production ingestion is confirmed
> via Gate 4C PASS. It does **not** implement report runtime, does not
> activate customer output, does not add safe claims, does not activate
> scoring, does not write Lane A/B, does not activate workers, does not
> contact production, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — PR #92, merged |
| Gate 4D planning | Merged — PR #93 |
| Gate 4D observation | Pending rerun — PR #98 GO merged; waiting for 24h window |
| PR #19b | Sprint 3 external output / report contract handoff — merged; docs-only; no runtime |
| PR #20 | Sprint 3 external report MVP scaffold — merged; **not customer-active**; `safe_claims` enforced empty; PR#18ab locks restated in renderer |
| `safe_claims` | Empty — `src/reports/external/safe-claims.ts` |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `allowed_customer_language` | `[]` |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 2. Definition of external report readiness

"External report readiness" means confirming that the upstream data
inputs, contracts, and governance gates are satisfied before any
internal preview or customer-facing report can be considered. It does
**not** mean runtime activation.

Readiness requires:

1. Stable production ingestion (Gate 4D observation PASS).
2. Downstream derivation tables populated (workers activated under
   their own separately gated PRs).
3. Evidence snapshot observer producing rows.
4. All governance locks intact.
5. Report contract version stamps carrying the required ProductContextProfile
   fields (PR #20 / sprint3-pr20 alignment note §2 forward requirement).

None of these requirements are satisfied by this PR. This PR records
what they are and what must happen before any report runtime is
considered.

---

## 3. Required upstream evidence before any report runtime

### 3.1 Gate 4D observation PASS

The Gate 4D observation rerun (PR #98 GO) must produce a
`GATE4D_OBSERVATION_PASS` evidence PR before any report readiness
assessment proceeds. Specifically:

- `accepted_events` accumulating from live `/v1/event` traffic.
- `new_invalid_json_since_gate4c = 0`.
- `collect_hits_since_gate4c = 0`.
- `storage_failure / permission denied` log count `= 0`.
- Protected 26-row invalid-json baseline intact.
- Lane A/B counts `= 0`.

### 3.2 Downstream derivation readiness

Before evidence snapshots or report input data can be constructed,
the following tables must have non-zero rows produced by their
respective activated workers:

| Table | Worker status |
| --- | --- |
| `session_features` | Not yet activated — requires separate GO |
| `session_behavioural_features_v0_2` | Not yet activated |
| `stage0_decisions` | Not yet activated |
| `risk_observations_v0_1` | Not yet activated |

Worker activation for each table requires its own separately gated
PR and Helen GO. None are activated by this PR.

### 3.3 Evidence snapshot readiness

The evidence snapshot observer must have run and produced rows
before the report pipeline can assemble an `EvidenceAtom` / session
evidence card. This requires:

- `session_features` extractor running against real production events.
- Observer chain reading from `session_features`, `risk_observations_v0_1`,
  and related tables.
- Evidence snapshot rows present and schema-valid.

### 3.4 Governance locks must remain intact

Before any report runtime is considered, confirm all of the
following are still in force:

| Lock | Expected state |
| --- | --- |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `customer_visibility_allowed` | false |
| `lane_write_allowed` | false |
| `allowed_customer_language` | `[]` |
| `safe_claims` dictionary | Empty |
| PR#18ab eleven `false` / `[]` locks | All in force |
| PR#73 hard-gate carry-forward locks | All in force |
| Lane A/B row counts | `0/0` |

---

## 4. Report contract readiness

The PR #19b Sprint 3 external output / report contract handoff and
PR #20 external report MVP scaffold define the report contract shape.
Key contract components (from `src/reports/external/contracts.ts`
and `src/reports/external/safe-claims.ts`):

| Component | Notes |
| --- | --- |
| `EvidenceAtom` | Minimum factual unit; factual observation only |
| `SessionEvidenceCard` | Per-session aggregation of `EvidenceAtom` rows |
| `AccountEvidenceCard` | Per-account aggregation of session cards |
| `MotionTimelineNode` | Temporal sequence of evidence atoms |
| `ClaimBlock` | Must separate `facts[]`, `inferences[]`, `recommendations[]`, `limitations[]` |
| `ReportSnapshot` | Versioned snapshot of assembled evidence |
| `ReportDeliveryProof` | Proof record of any report delivery event |
| `validateClaimBlock` | Enforces `ClaimBlock` shape constraints |
| `sanitizeCustomerText` | Strips disallowed language before any customer surface |
| `safe_claims` | `src/reports/external/safe-claims.ts` — **currently empty** |

**Forward requirement (from sprint3-pr20 alignment note §2):**
Before any production Product-Context Fit observation or
customer-facing report output is activated, the report contract must
additionally carry the ProductContextProfile §6 version stamps:

- `product_context_profile_version`
- `category_template_version`
- `site_mapping_version`
- `buying_role_lens_version`
- `universal_surface_taxonomy_version`
- `product_fit_model_version`
- `product_fit_rule_version`

These version stamps require a separate code PR (not this planning PR)
with its own Helen GO and Codex review.

---

## 5. Governance locks (explicit carry-forward)

The following locks are in force and must not be relaxed without
explicit governance review:

- `safe_claims` dictionary remains **empty** until a separate
  governance review approves specific claim templates.
- `allowed_customer_language = []` — no customer-visible language
  approved.
- `customer_claim_allowed = false` — no customer claim generation.
- `lane_output_allowed = false` — no Lane A/B output.
- `customer_visibility_allowed = false` — no customer surface.
- `lane_write_allowed = false` — no Lane writer.
- No report runtime activation.
- No email / report delivery.
- No scoring writer.
- No AMS Trust / Pass runtime.
- PR#18ab eleven `false` / `[]` locks: **in force**.
- PR#73 hard-gate carry-forward locks: **in force**.

---

## 6. Non-goals

This PR does **not**:
- implement report runtime
- run or schedule reports
- send or deliver reports to any customer or internal surface
- expose customer output
- add items to `safe_claims`
- activate scoring
- write to `scoring_output_lane_a` or `scoring_output_lane_b`
- activate any worker
- query production
- change DB, schema, or migrations
- add or remove version stamps from `contracts.ts`
- open Gate 4E
- invent Gate 4F

---

## 7. Suggested future PR sequence

| Step | Notes |
| --- | --- |
| 1. Gate 4D observation rerun evidence PR | `GATE4D_OBSERVATION_PASS` required before further steps |
| 2. Worker activation planning PRs | Per worker, each with separate GO (session_features extractor, behavioural features, stage0, risk_observations) |
| 3. Evidence snapshot readiness proof | Confirm snapshot observer produces rows |
| 4. Report contract version-stamp code PR | Add ProductContextProfile §6 version stamps to `contracts.ts`; requires Helen GO + Codex review |
| 5. Report fixture / readiness planning | Confirm report shape against real `accepted_events` data |
| 6. Report contract fixture tests review | Confirm existing `tests/v1/external-report/*` pass against production-shaped data |
| 7. Internal-only preview governance planning | If desired before customer surface; requires explicit separate Helen GO; not authorized by this PR |
| 8. Safe-claims governance review | Separate PR to approve first safe-claims entries; requires Helen GO + Codex review |
| 9. Customer-facing report activation planning | Only after all above; separately gated; not in scope here |

Gate 4E and Gate 4F remain out of scope throughout this sequence.

---

## 8. Stop-lines for this readiness path

Progress toward any report runtime must stop if:

| Stop-line | Action |
| --- | --- |
| Gate 4D observation does not PASS | Stop — do not proceed to worker activation |
| `safe_claims` becomes non-empty without explicit approval | Stop |
| `customer_claim_allowed` or `lane_output_allowed` flips `true` | Stop |
| Lane A/B rows non-zero without authorization | Stop |
| Scoring runtime activated without GO | Stop |
| Report delivery activated without GO | Stop |
| Raw payloads / `request_id` / `session_id` / IP hashes / user agents exposed in evidence | Stop |
| Gate 4E language appears in any PR | Stop |
| Gate 4F language appears | Stop |

---

## 9. Machine-readable block

```yaml
status: SPRINT3_EXTERNAL_REPORT_READINESS_PLANNING
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_observation_status: GATE4D_OBSERVATION_PENDING_RERUN
pr19b_status: merged_docs_only_no_runtime
pr20_status: merged_scaffold_not_customer_active
safe_claims_empty: true
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
report_runtime_activated_by_this_pr: false
customer_output_activated_by_this_pr: false
worker_activation_by_this_pr: false
scoring_runtime_by_this_pr: false
ams_trust_pass_by_this_pr: false
db_write_by_this_pr: false
production_contact_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
next_step: gate4d_observation_pass_then_worker_activation_planning_then_report_contract_version_stamp_pr_then_fixture_review
```

---

## 10. Hard boundaries

This PR does **not**:
- implement report runtime
- activate customer output
- add safe claims
- activate scoring
- write Lane A/B
- activate workers
- contact production or perform DB queries
- change backend code, packages, migrations, or schema
- open Gate 4E
- invent Gate 4F
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the external report readiness planning only.

`next_step: gate4d_observation_pass_then_worker_activation_planning_then_report_contract_version_stamp_pr_then_fixture_review`
