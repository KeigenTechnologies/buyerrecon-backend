# BuyerRecon-side ProductFeatures Namespace Fixtures (v0.1)

**Status.** Sprint 2 PR#14e. Static, sanitized fixture artifacts. No
runtime, no DB reads, no AMS execution.

**Date.** 2026-05-15. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md`
  (commit `982e90e`) — §3 AMS target contract, §5 JSON casing /
  struct compatibility note, §10 reserved-name guard, §12 Option D
  scope.
- `docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md`
  (commit `1441c86`) — pure mapper + recursive validators consumed
  here.
- `docs/sprint2-pr14c-productfeatures-bridge-candidate-observer.md`
  (impl `4b3b1b6`, proof closure `671c632`) — observer that
  produced the staging baseline these fixtures' shape mirrors.
- `docs/sprint2-pr14d-ams-compatibility-fixture-planning.md`
  (commit `a604faa`) — fixture purpose, §7 valid cases, §8 invalid
  cases, §10 source / privacy boundary, §11 output boundary.

---

## What these fixtures are

- **BuyerRecon-side fixture artifacts only.** Two static JSON files
  living under `docs/fixtures/productfeatures-namespace/`:
  - `buyerrecon-candidate-valid-v0.1.json` — one canonical valid
    `product_features_namespace_candidate`, matching the PR#14b
    bridge candidate contract.
  - `buyerrecon-candidate-invalid-v0.1.json` — an enumerated
    catalogue of invalid candidate shapes that future fixture-
    consumer tests (PR#14f / AMS-side adapter compat test) MUST
    reject.

- **Internal-only.** These fixtures are not shipped to customers,
  not rendered in any customer surface, not consumed by any
  customer-facing template.

- **Non-authoritative.** These fixtures do not define AMS canonical
  contracts. AMS owns `ProductFeatures` /
  `BuyerReconProductFeatures` evolution. The valid fixture is a
  BuyerRecon-side proposal of what a candidate looks like today; the
  AMS-side acceptance proof is future work (PR#14f).

- **Not customer-facing.** No customer is ever shown the contents
  of these files or any value derived from them.

- **Not AMS runtime output.** AMS Product Layer scoring is not
  invoked anywhere in this PR or by anything in this directory.

- **Does not execute AMS Product Layer.** No `Fit` / `Intent` /
  `Window` / `TRQ` scorer runs.

- **Does not create `ProductDecision`.** `ProductDecision` is an
  AMS-canonical type minted by the AMS Product Layer; nothing here
  mints one.

---

## What these fixtures are for

- **Future PR#14f / AMS-side compatibility fixture validation.**
  PR#14f will introduce — in a separate PR, with its own Helen
  sign-off — a BuyerRecon-side test (and likely a separate AMS-side
  Go test in its own AMS PR) that:
  1. parses the valid fixture and asserts it round-trips through
     the PR#14b `validateBridgeCandidate` validator,
  2. parses each invalid case and asserts the corresponding
     rejection,
  3. for the AMS-side test (separate AMS PR, optional), feeds the
     valid payload through `ParseBuyerReconFeatures` to confirm
     parse compatibility — without running any AMS scorer and
     without minting `ProductDecision`.

- **Reusable cross-repo contract evidence.** The fixture content
  here is the canonical reference future fixture-consumer tests
  read.

---

## What these fixtures are NOT

- **Not an AMS contract.** AMS owns
  `internal/contracts/features.go` and
  `internal/products/buyerrecon/scorer/types.go`. The fixture is a
  BuyerRecon-side proposal.

- **Not a guarantee of AMS parse success.** PR#14a §5 and PR#14d
  §3 flag that AMS `BuyerReconProductFeatures` carries no
  `json:"…"` struct tags today, so JSON key matching is
  case-insensitive against PascalCase Go field names. PR#14b
  candidate emits snake_case sub-block keys (`fit_like_inputs` /
  `intent_like_inputs` / `timing_like_inputs`), which do NOT match
  AMS Go fields directly. **Exact AMS Go struct compatibility
  remains unproven until an AMS-side fixture test (PR#14f or a
  separate AMS PR) passes.** A documented translator step (PR#14d
  OD-5: T-a / T-b / T-c) will likely be needed.

- **Not a runtime bridge.** No Option E runtime path is wired by
  these artifacts.

- **Not durable scoring output.** Nothing here writes to Lane A,
  Lane B, Trust, Policy, or any scoring output table.

---

## Files in this directory

| File | Status | Shape |
| --- | --- | --- |
| `README.md` | Explanatory doc (this file) | Markdown |
| `buyerrecon-candidate-valid-v0.1.json` | `fixture_status: "valid_candidate"` | JSON object with one `product_features_namespace_candidate` payload |
| `buyerrecon-candidate-invalid-v0.1.json` | `fixture_status: "invalid_cases"` | JSON object with `invalid_cases: array` |

Both JSON files use UTF-8, LF line endings, 2-space indentation, no
trailing commas, no comments.

---

## Valid fixture contract (`buyerrecon-candidate-valid-v0.1.json`)

The valid fixture follows the **PR#14b bridge candidate contract
verbatim**:

- `bridge_contract_version` = `"productfeatures-namespace-bridge-contract-v0.1"`
- `bridge_payload_version`  = `"productfeatures-namespace-candidate-v0.1"`
- Every PR#14a §6 version stamp present and non-empty.
- `source_evidence_versions.{poi_observation_versions,
  poi_input_versions, poi_sequence_versions}` are non-empty string
  arrays.
- `ams_product_layer_reference_version` =
  `"BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0"`.
- `namespace_key_candidate` = `"buyerrecon"`.
- `payload_candidate.fit_like_inputs` / `intent_like_inputs` /
  `timing_like_inputs` follow PR#14b types — surface labels drawn
  from the v0.1 universal-surface taxonomy
  (`BRIDGE_UNIVERSAL_SURFACES_ALLOWED`), conversion-proximity keys
  drawn from `ALLOWED_CONVERSION_PROXIMITY_INDICATORS`.
- `preview_metadata` carries the six literal-`true` flags
  (`internal_only`, `non_authoritative`, `not_customer_facing`,
  `does_not_execute_ams_product_layer`,
  `does_not_create_product_decision`,
  `exact_ams_struct_compatibility_unproven_until_fixture`).

---

## Invalid-cases catalogue (`buyerrecon-candidate-invalid-v0.1.json`)

The invalid fixture is a structured catalogue. Each entry has:

- `case_id` — a stable identifier (`I-1` … `I-18`) aligned with
  PR#14d §8.
- `description` — one-line summary.
- `expected_reject_reason_family` — *who* is expected to reject the
  case. Three families:
  - `"pr14b_validator_required_fields"` —
    `validateBridgeMapperInput` / `validateBridgeCandidate` rejects
    today by checking required-field presence.
  - `"pr14b_validator_forbidden_keys"` — PR#14b recursive forbidden-
    key scan (`FORBIDDEN_AMS_PAYLOAD_KEYS`, `FORBIDDEN_PII_KEYS`)
    rejects today.
  - `"pr14b_validator_enum_or_allowlist"` — PR#14b allowlist /
    enum check (surface taxonomy, actionability band,
    `ALLOWED_CONVERSION_PROXIMITY_INDICATORS`) rejects today.
  - `"pr14b_validator_numeric"` — PR#14b numeric-range check
    rejects today (`NaN`, `Infinity`, negative counts, fractional
    counts, `mapping_coverage_percent` outside `[0, 100]`).
  - `"pr14b_validator_reason_namespace_string"` — PR#14b recursive
    `^(FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*$` value scan rejects
    today.
  - `"pr14f_fixture_privacy_value_scan"` — *required future
    work in PR#14f.* Current PR#14b validator does NOT claim
    general recursive value-shape scanning for raw URL / query-
    string / email-shape / person-or-company-enrichment-shape
    string values. PR#14f MUST add or invoke an explicit fixture
    privacy value scan before any fixture is accepted.
- `candidate_patch_or_bad_fragment` — the offending JSON fragment.
  For `pr14f_fixture_privacy_value_scan` cases, the fragment
  contains the literal offending value (raw URL / query string /
  email string) so PR#14f's scanner has a concrete artifact to
  reject.

### Precise PR#14b vs PR#14f distinction (Codex blocker resolved in PR#14d)

The PR#14d §8 intro states this verbatim; repeated here so any
reader of these fixtures cannot misread the boundary:

- **Current PR#14b validator** rejects raw URL / query / email-shape
  material as **forbidden keys** (via `FORBIDDEN_PII_KEYS` —
  including `page_url`, `full_url`, `url_query`, and the
  module-load-constructed `email` key), rejects free-form
  `conversion_proximity_indicators` keys outside the allowlist, and
  rejects AMS reason-code namespace **strings** (`FIT.*` / `INTENT.*`
  / `WINDOW.*`). Those are its current value-shape guarantees.
- **PR#14b does NOT** claim general recursive raw-URL / query-string
  / email-shape **value** scanning.
- **PR#14f future fixture work** MUST add or invoke an explicit
  fixture privacy value scan for URL-shape / query-string-shape /
  email-shape / person-or-company-enrichment-shape **string values**
  before any fixture is accepted.

This distinction matters because cases `I-6`, `I-7`, and `I-8`
fall under `pr14f_fixture_privacy_value_scan`, not under any
current PR#14b value-shape guarantee. Case `I-9` is different: it
is a current PR#14b forbidden-key case because `session_id` is
forbidden; its value is synthetic and not DB-derived.

---

## Privacy posture for these files

The fixtures contain NO:

- raw URLs (in the **valid** fixture).
- query strings (in the **valid** fixture).
- email-shape strings (in the **valid** fixture).
- person / company / firmographic enrichment fields (in the **valid**
  fixture).
- real full session IDs (anywhere). The valid fixture contains no
  `session_id`. The invalid fixture contains one synthetic
  full-session-id-shaped value only in case `I-9`, solely to
  exercise PR#14b's forbidden `session_id` key rejection.
- truncated session-id prefixes (anywhere — valid or invalid).
- IP addresses, user-agent strings, token hashes, cookie material
  (anywhere — valid or invalid).
- secrets, API keys, DB DSNs (anywhere — valid or invalid).
- customer-specific private data (anywhere — valid or invalid).

The **invalid** fixture deliberately contains literal raw-URL,
query-string, and email-shape **example** strings as
`candidate_patch_or_bad_fragment` values. These exist only so the
future PR#14f fixture privacy scanner has concrete invalid material
to reject. They are synthetic and not associated with any real
person, company, or session.

---

## No DB reads

Fixture consumer tests (PR#14f) MUST NOT open a DB connection.
Fixtures are static JSON files; no SQL, no `pg`, no `process.env`
required at consumption time.

---

## Regeneration policy

These v0.1 fixtures are **frozen literals**. They are not regenerated
by a script in PR#14e. Future revisions land as new files
(`buyerrecon-candidate-valid-v0.2.json`, etc.) under a bumped
`bridge_payload_version`, never as in-place edits — same forward-only
discipline as PR#11c / PR#12d table versions.

---

## Reserved-name guard (carried forward from PR#14a §10 / PR#14d §9)

Future fixture-consumer tests, fixture generators, and translators
(if any) MUST NOT redefine or own these AMS canonical names in
**BuyerRecon runtime** as TypeScript types, classes, interfaces,
enums, exported constants, or top-level identifiers:

**Fit family.** `Fit`, `FitFeatures`, `FitResult`, `FitScore`,
`FitConfidence01`, `NonFitMarkers`, `HardSuppress`.

**Intent family.** `Intent`, `IntentFeatures`, `IntentResult`,
`IntentScore`, `IntentState`.

**Window family.** `Window`, `WindowFeatures`, `WindowResult`,
`WindowState`. AMS `WindowState` enum values: `in_window`,
`approaching`, `too_early`.

**TRQ family.** `TRQ`, `TRQResult`, `TRQBand`, `TRQScore`,
`TRQConfidence01`, `RawTRQScore01`.

**Product Layer contracts.** `ProductDecision`, `ProductFeatures`,
`ProductScorerInput`, `ProductScorer`, `BuyerReconConfig`,
`BuyerReconProductFeatures`, `RequestedAction`.

**AMS reason-code namespaces.** `FIT.*`, `INTENT.*`, `WINDOW.*`.

Docs (including this README), comments, and tests MAY reference
these names for alignment commentary. The invalid fixture MAY
contain them as `candidate_patch_or_bad_fragment` values to exercise
rejection.

---

## End of README
