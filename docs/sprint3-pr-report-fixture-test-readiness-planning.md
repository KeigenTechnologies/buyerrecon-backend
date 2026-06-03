# Sprint 3 — External Report Fixture and Contract-Test Readiness Planning (Docs-Only)

> **DOCS-ONLY PLANNING RECORD.** This PR plans the fixture and
> contract-test readiness path for the external report scaffold
> before any runtime activation or customer-facing output. It does
> **not** add tests, does not change code, does not activate report
> runtime, does not activate customer output, does not add safe
> claims, does not activate scoring, does not write Lane A/B, does
> not activate workers, does not contact production, and does not
> open Gate 4E. No secrets, no raw payloads, no raw `request_id` /
> `session_id` — categorical / structural facts only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — PR #92, merged |
| Gate 4D observation | Pending rerun — PR #98 GO merged; waiting for 24h window |
| PR #99 | Sprint 3 external report readiness planning — merged |
| PR #20 | Sprint 3 external report MVP scaffold — merged; **not customer-active** |
| `SAFE_CLAIMS_DICTIONARY` | `Object.freeze({})` — production dictionary is empty |
| `FIXTURE_SAFE_CLAIMS` | Test/render-fixture only (`src/reports/external/safe-claims.ts`); must never feed a customer surface |
| `DEFAULT_EXTERNAL_OUTPUT_FLAGS` | All `false` — `show_evidence_grade`, `show_recommendations`, `show_account_inference`, `auto_send_reports` |
| `customer_claim_allowed` | false |
| `customer_visibility_allowed` | false |
| `allowed_customer_language` | `[]` |
| `lane_output_allowed` | false |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 2. Fixture / test objective

Fixture and contract-test readiness means confirming, in a
test-only environment using synthetic data:

1. Report contract shapes (`EvidenceAtom`, `SessionEvidenceCard`,
   etc.) can be built from synthetic fixtures — no production data.
2. Redaction and forbidden-claim guards (`sanitizeCustomerText`,
   `assertCustomerSafeText`, `validateClaimBlock`) reject
   disallowed language.
3. No customer-visible language can be emitted while
   `SAFE_CLAIMS_DICTIONARY` is empty.
4. Report rendering remains internal / test-only — no delivery
   proof is generated for a customer destination.
5. `FIXTURE_SAFE_CLAIMS` cannot cross into production paths or
   trigger customer output when `customer_claim_allowed=false`.
6. All `DEFAULT_EXTERNAL_OUTPUT_FLAGS` remain `false`.

This is verification that the existing scaffold guards are correct,
not runtime activation.

---

## 3. Existing test coverage

The following test file already covers parts of the readiness
objective:

**`tests/v1/external-report/external-report.test.ts`**

Existing test cases (confirmed from source):

| Test | Guard |
| --- | --- |
| `contracts compile and default feature flags remain false` | `DEFAULT_EXTERNAL_OUTPUT_FLAGS` all `false` |
| `safe-claim validation rejects forbidden phrases` | `forbiddenCustomerPhrases` list; `assertCustomerSafeText` |
| `safe-claim validation rejects unapproved non-forbidden sales phrasing` | `validateSafeClaimEntry` |
| `safe-claim validation accepts approved and explicit structural copy` | `FIXTURE_SAFE_CLAIMS` shape |
| `fixture safe-claim templates satisfy the same validator` | `FIXTURE_SAFE_CLAIMS` entries pass validator |
| `ClaimInference emits the PR19b confidence_band contract field` | `CLAIM_INFERENCE_CONFIDENCE_FIELD` |
| `ClaimBlock arrays are mandatory and section shapes stay disjoint` | `ClaimBlock` structure |
| `evidence grade disclaimer is present and never rendered as probability` | `renderReportMarkdown` |
| `empty state / connected-no-data / single-session / weak-account / repeated-account / conflicting-evidence fixture renders safely` | `EXTERNAL_REPORT_FIXTURES`; render safety |
| `raw request IDs, raw session IDs, auth headers, and token-like strings are not rendered` | Redaction guard |
| `Lane B and AI-agent language is not rendered` | Forbidden language guard |
| `report renderer preserves non-production and Gate 4C boundaries` | Gate 4C boundary in renderer |

**`src/reports/external/fixtures.ts`** — existing render fixtures
(`EXTERNAL_REPORT_FIXTURES`) provide synthetic data for all tests.
These are test-only; they contain no production identifiers.

---

## 4. Contract areas and source files

| Contract component | Source file | Status |
| --- | --- | --- |
| `EvidenceAtom` | `src/reports/external/contracts.ts` | Defined; scaffold only |
| `SessionEvidenceCard` | `src/reports/external/contracts.ts` | Defined; scaffold only |
| `AccountEvidenceCard` | `src/reports/external/contracts.ts` | Defined; scaffold only |
| `MotionTimelineNode` | `src/reports/external/contracts.ts` | Defined; scaffold only |
| `ClaimBlock` | `src/reports/external/contracts.ts` | Defined; arrays mandatory; sections disjoint |
| `ReportSnapshot` | `src/reports/external/contracts.ts` | Defined; carries version stamps |
| `ReportDeliveryProof` | `src/reports/external/contracts.ts` | Defined; no customer delivery authorized |
| `validateClaimBlock` | `src/reports/external/safe-claims.ts` | Active guard |
| `sanitizeCustomerText` | `src/reports/external/safe-claims.ts` | Active guard |
| `assertCustomerSafeText` | `src/reports/external/safe-claims.ts` | Active guard |
| `SAFE_CLAIMS_DICTIONARY` | `src/reports/external/safe-claims.ts` | `Object.freeze({})` — empty |
| `FIXTURE_SAFE_CLAIMS` | `src/reports/external/safe-claims.ts` | Test-fixture only |
| `DEFAULT_EXTERNAL_OUTPUT_FLAGS` | `src/reports/external/contracts.ts` | All `false` |
| `buildReportSnapshot` | `src/reports/external/builders.ts` | Builds from fixtures; scaffold only |
| `renderReportMarkdown` | `src/reports/external/renderer.ts` | Renders from snapshot; internal only |

---

## 5. Required fixture policy

All fixtures used in tests must adhere to:

| Policy | Requirement |
| --- | --- |
| Data source | Synthetic only — no production data |
| `request_id` | No raw production UUIDs |
| `session_id` | No production session identifiers |
| Raw payloads | Not present |
| IP hashes | Not present |
| User agents | Not present |
| Token / DSN / Auth values | Not present |
| Customer-identifying data | Not present |
| Labelling | Fixture-only values clearly labeled (e.g. `fixture-session-id`, `fixture-workspace-id`) |
| `FIXTURE_SAFE_CLAIMS` isolation | Must not be reachable from any production code path; must remain test-import only |

The existing `EXTERNAL_REPORT_FIXTURES` in `src/reports/external/fixtures.ts`
must be reviewed against these policies before any future
implementation PR extends them.

---

## 6. Required future test assertions (not implemented by this PR)

The following assertions should be added or confirmed in a future
fixture/test implementation PR. They do not exist yet or need
explicit confirmation:

| Assertion | Purpose |
| --- | --- |
| `SAFE_CLAIMS_DICTIONARY` is `Object.freeze({})` at runtime | Confirms production dictionary cannot be populated without explicit code change |
| `FIXTURE_SAFE_CLAIMS` cannot produce customer output when `customer_claim_allowed=false` | Confirms fixture isolation from production output path |
| `customer_claim_allowed=false` in `DEFAULT_EXTERNAL_OUTPUT_FLAGS` blocks claim generation | Explicit flag-gate test |
| `customer_visibility_allowed=false` blocks visible report surface | Explicit flag-gate test |
| `allowed_customer_language=[]` blocks customer-facing language emission | Explicit guard test |
| `lane_output_allowed=false` blocks Lane output | Explicit flag-gate test |
| `auto_send_reports=false` blocks delivery proof for customer destinations | `DEFAULT_EXTERNAL_OUTPUT_FLAGS.auto_send_reports` |
| No `ReportDeliveryProof` can be generated for a customer destination | Delivery path guard |
| `sanitizeCustomerText` removes or rejects all phrases in `forbiddenCustomerPhrases` list | Existing; confirm coverage is complete |
| Raw production `request_id` / `session_id` / IP hash / user agent / token / DSN fields are not rendered | Redaction guard completeness |
| Fixture renderer only reads from `EXTERNAL_REPORT_FIXTURES`; cannot read production DB | Import isolation |
| ProductContextProfile §6 version stamps are required before production activation | Forward requirement from sprint3-pr20 alignment note §2 |

---

## 7. Required preconditions before any report runtime

Before any report runtime activation can be considered:

| Precondition | Status |
| --- | --- |
| Gate 4D observation PASS evidence merged | Not yet done |
| Downstream derivation tables non-zero (workers activated) | Not yet done |
| Evidence snapshot readiness established | Not yet done |
| Governance locks reviewed and intact | In force |
| Safe-claims governance reviewed | Not yet done |
| ProductContextProfile §6 version stamps added to `contracts.ts` | Not yet done |
| Explicit Helen GO for runtime activation | Not yet done |
| Codex review of runtime activation PR | Not yet done |
| Separate runtime activation PR | Not yet done |

---

## 8. Non-goals

This PR does **not**:
- add, modify, or run tests
- change `src/reports/external/` code
- run or schedule reports
- activate report runtime
- activate customer output
- add items to `SAFE_CLAIMS_DICTIONARY`
- enable `FIXTURE_SAFE_CLAIMS` in production paths
- activate scoring
- write Lane A/B rows
- activate any worker
- query production
- change DB, schema, or migrations
- open Gate 4E
- invent Gate 4F

---

## 9. Suggested future PR sequence

| Step | Notes |
| --- | --- |
| 1. Gate 4D observation rerun evidence PR | `GATE4D_OBSERVATION_PASS` required |
| 2. Worker activation planning PRs | Per worker; each with separate GO |
| 3. Report fixture / test implementation PR | Add §6 assertions; still internal/test-only; Helen GO + Codex review |
| 4. Report contract hardening PR | Add ProductContextProfile §6 version stamps to `contracts.ts`; Helen GO + Codex review |
| 5. Internal-only preview governance PR | If desired; explicit separate Helen GO |
| 6. Safe-claims governance PR | First safe-claims entries; Helen GO + Codex review |
| 7. Customer-facing output planning | Only after all above; separately gated |

Gate 4E and Gate 4F remain out of scope throughout this sequence.

---

## 10. Machine-readable block

```yaml
status: SPRINT3_REPORT_FIXTURE_TEST_READINESS_PLANNING
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_observation_status: GATE4D_OBSERVATION_PENDING_RERUN
pr99_status: SPRINT3_EXTERNAL_REPORT_READINESS_PLANNING_merged
pr20_status: scaffold_merged_not_customer_active
production_safe_claims_dictionary_empty: true
fixture_safe_claims_test_only: true
default_external_output_flags_all_false: true
customer_claim_allowed: false
customer_visibility_allowed: false
allowed_customer_language: []
lane_output_allowed: false
auto_send_reports: false
tests_added_by_this_pr: false
code_changed_by_this_pr: false
report_runtime_activated_by_this_pr: false
customer_output_activated_by_this_pr: false
worker_activation_by_this_pr: false
scoring_runtime_by_this_pr: false
ams_trust_pass_by_this_pr: false
db_write_by_this_pr: false
production_contact_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
next_step: gate4d_observation_pass_then_fixture_test_implementation_pr_then_contract_hardening_pr
```

---

## 11. Hard boundaries

This PR does **not**:
- add tests or change code
- contact production or perform DB queries
- activate report runtime, customer output, scoring, Lane writer,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the fixture and contract-test readiness planning only.

`next_step: gate4d_observation_pass_then_fixture_test_implementation_pr_then_contract_hardening_pr`
