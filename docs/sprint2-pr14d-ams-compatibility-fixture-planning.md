# Sprint 2 PR#14d — AMS Compatibility Fixture Planning

**Status.** PLANNING ONLY. Docs-only. No code, no `package.json`,
no migration, no `schema.sql`, no DB writes, no `psql`, no Render,
no AMS repo changes, no fixture file yet, no AMS tests yet. PR#14a /
PR#14b / PR#14c source and AMS reference files are read-only.

**Date.** 2026-05-15. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — workflow
  truth file; §10 + §23 AMS reserved-name guard, §22 PR mapping
  cadence.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md`
  (Helen OD-1..OD-15, commit `982e90e`) — §3 AMS target contract,
  §4 three-name discipline, §5 AMS JSON casing / struct
  compatibility note, §10 reserved-name guard, §12 Option D
  scope.
- `docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md`
  (implementation at commit `1441c86`) — Option B pure mapper +
  validators consumed here.
- `docs/sprint2-pr14c-productfeatures-bridge-candidate-observer.md`
  (implementation at commit `4b3b1b6`; Hetzner-PASS proof closure at
  `671c632`) — Option C read-only observer that produced the staging
  evidence baseline for fixture sourcing decisions.
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md`
  (Helen OD-1..OD-15, commit `6739bc7`) — universal-surface
  taxonomy, actionability bands, AMS-disjoint vocabulary.
- `docs/sprint2-pr13b-product-context-timing-observer.md`
  (impl `e20ad7b`, Hetzner-PASS `469b203`) — PR#13b observer + the
  `SessionPreview` shape carried into PR#14c.
- AMS read-only references (NOT runtime imports):
  `docs/algorithms/BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0.md`,
  `internal/contracts/features.go` (`ProductFeatures.Namespace
  json.RawMessage` carrier),
  `internal/products/buyerrecon/adapter/feature_adapter.go`
  (`ParseBuyerReconFeatures` — `encoding/json.Unmarshal` →
  `BuyerReconProductFeatures`),
  `internal/products/buyerrecon/scorer/types.go`
  (`BuyerReconProductFeatures { Fit, Intent, Window }` and the
  three sub-types `FitFeatures`, `IntentFeatures`, `WindowFeatures`
  with PascalCase Go fields and no `json:"…"` tags — meaning
  `encoding/json` matches case-insensitively against the Go field
  names).

---

## §1 PR#14d scope

PR#14d is the **planning-only step** for the future cross-repo AMS
compatibility fixture (PR#14a §12 Option D). It produces:

- One docs file (this file).

It produces NO code, NO `package.json` change, NO migration, NO
schema change, NO DB writes, NO CLI, NO npm script, NO Render
touch, NO AMS repo change, NO fixture JSON, NO AMS test, NO BuyerRecon
runtime fixture-emitter code. PR#14e is the future implementation
step that follows, gated on Codex review + Helen sign-off of this
planning doc.

PR#14d sits **after** PR#14b's pure mapper (`1441c86`) and PR#14c's
read-only observer Hetzner-PASS (proof closure `671c632`), and
**before** any cross-repo fixture work. It turns the
`product_features_namespace_candidate` JSON shape into a **compatibility-
fixture plan**, not a runtime bridge. PR#14d does NOT pre-commit
PR#14e to a specific repo or artifact shape — see §12 for the five
forward options Helen chooses between.

PR#14d does **not** implement Option E (live runtime bridge). Option
E remains explicitly out-of-scope until Option C or Option D proves
JSON shape compatibility with AMS.

---

## §2 Current source state

| Layer | State | Commit |
| --- | --- | --- |
| `poi_observations_v0_1` | Durable, Hetzner-proven | PR#11c / PR#11d Hetzner PASS |
| `poi_sequence_observations_v0_1` | Durable, Hetzner-proven | PR#12d / PR#12e Hetzner PASS |
| PR#13a planning | Helen OD-1..OD-15 signed | `6739bc7` |
| PR#13b observer | Hetzner-PASS | impl `e20ad7b`, proof `469b203` |
| PR#14a planning | Helen OD-1..OD-15 signed | `982e90e` |
| PR#14b mapper (Option B) | Pure TS mapper + validators | `1441c86` |
| PR#14c observer (Option C) | Hetzner-PASS | impl `4b3b1b6`, proof closure `671c632` |

### PR#14b summary (Option B)

- Pure TypeScript mapper `buildBridgeNamespaceCandidate(input)`.
- Output `BridgeNamespaceCandidate` with namespace-disjoint sub-block
  keys `payload_candidate.fit_like_inputs` / `intent_like_inputs` /
  `timing_like_inputs`.
- Recursive validators reject AMS reserved names (`Fit`, `Intent`,
  `Window`, `WindowState`, ..., `ProductDecision`, ...,
  `RequestedAction`), AMS reason-code namespace strings
  (`^(FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*$`), PII / enrichment / raw-URL
  / `session_id` keys, and free-form `conversion_proximity_indicators`
  keys outside the v0.1 allowlist (`pricing_visited`,
  `comparison_visited`, `demo_request_visited`).
- Every candidate carries six `preview_metadata` literal-`true` flags
  including `exact_ams_struct_compatibility_unproven_until_fixture`.
- No DB / no SQL / no CLI / no clock / no randomness.

### PR#14c summary (Option C)

- Read-only observer CLI bridging PR#13b previews into PR#14b
  candidates.
- Hetzner proof closure at `671c632`:
  - HEAD `4b3b1b6` implementation.
  - POI rows scanned: 8.
  - POI Sequence rows scanned: 8.
  - PR#13b preview accepted: 2.
  - PR#13b preview rejected: 6 (`stage0_excluded_session = 6`).
  - `candidate_inputs_seen`: 2.
  - `candidates_built`: 2.
  - `candidates_rejected`: 0.
  - `namespace_key_candidate_distribution.buyerrecon`: 2.
  - `bridge_contract_version_distribution.productfeatures-namespace-bridge-contract-v0.1`: 2.
  - `bridge_payload_version_distribution.productfeatures-namespace-candidate-v0.1`: 2.
  - All monitored tables Pre = Post (observer wrote nothing).
  - No DB writes / no AMS Product Layer runtime / no `ProductDecision`
    / no customer output / no full session IDs / no raw URLs / no
    `FIT.*` / `INTENT.*` / `WINDOW.*` strings.
- Regression observers (`observe:product-context-timing`,
  `observe:poi-table`, `observe:poi-sequence-table`) all PASS with
  zero anomalies after the run.

This is the staging baseline PR#14d treats as the source of truth
for the *shape* of a candidate today (not for any specific session's
content).

---

## §3 Compatibility-fixture purpose

The future Option D fixture exists to answer one cross-repo question
that BuyerRecon-side tests alone cannot answer:

> Given a `product_features_namespace_candidate` JSON blob emitted
> by PR#14b/PR#14c today, **can the canonical AMS adapter
> (`ParseBuyerReconFeatures` in
> `internal/products/buyerrecon/adapter/feature_adapter.go`)
> deserialise it — directly, or via a known translator — into a
> typed `BuyerReconProductFeatures` value, without producing
> `ProductDecision` and without executing AMS scoring?**

Explicit purposes:

1. **JSON shape / casing / type-width compatibility.** Validate that
   the BuyerRecon-emitted payload can survive AMS's `encoding/json`
   `Unmarshal` into `BuyerReconProductFeatures`. AMS uses
   case-insensitive matching against the Go field names because
   `internal/products/buyerrecon/scorer/types.go` carries **no
   `json:"…"` struct tags** today. That means the JSON key `Fit`
   matches the Go field `Fit`, and **the snake_case key
   `fit_like_inputs` does NOT match**. PR#14d's planning section
   §6 enumerates exactly which gaps that creates.

2. **Pre-runtime bridge evidence.** Prove the shape contract works
   *before* anyone wires a runtime path between the two repos
   (Option E). A fixture is the cheapest, lowest-blast-radius proof.

3. **Reusable cross-repo contract evidence.** Keep the fixture as a
   long-lived artifact future AMS adapter PRs can re-validate
   against, the way PR#13b's universal-surface taxonomy is locked
   and re-tested by every later observer.

4. **Internal-only / non-authoritative posture.** The fixture proves
   *parse compatibility*, not customer eligibility. It MUST NOT be
   mistaken for "BuyerRecon is now wired to AMS." Every fixture
   artifact carries the six `preview_metadata` flags PR#14b already
   bakes in.

Non-purposes:

- The fixture does NOT prove AMS scoring correctness. AMS-side
  scoring tests are AMS-owned.
- The fixture does NOT prove customer-facing eligibility. That
  remains gated on Policy Pass 2 + Lane A/B (workflow truth file
  §17–§18).
- The fixture does NOT freeze the AMS canonical contract; AMS owns
  evolution of `BuyerReconProductFeatures`. The fixture is a
  cross-repo *consumer*, not a *definer*.

---

## §4 Three-layer distinction (DO NOT CONFLATE)

| Layer | Owner | Status today | What changes in PR#14e |
| --- | --- | --- | --- |
| **BuyerRecon bridge candidate** (`product_features_namespace_candidate`) | BuyerRecon | Implemented in PR#14b; produced from real staging evidence in PR#14c. Internal-only, namespace-disjoint sub-block keys (`fit_like_inputs` / `intent_like_inputs` / `timing_like_inputs`). | No change to the candidate contract itself. |
| **Future compatibility fixture** | BuyerRecon (canonical fixture) **and** AMS (acceptance test) — see OD-2 | Does not exist yet. Will be: static, sanitized sample JSON file(s) + a validator test that proves the JSON is parseable by AMS via the canonical adapter (directly or via a documented translator). | New artifacts in BuyerRecon repo and/or AMS repo, but no runtime wiring. |
| **AMS runtime `ProductFeatures.Namespace` / `BuyerReconProductFeatures`** | AMS | Canonical, frozen in `internal/contracts/features.go` + `internal/products/buyerrecon/scorer/types.go`. AMS owns evolution. | No change in PR#14e. PR#14e *consumes* this contract via the AMS adapter. |

These layers MUST stay distinct in code, file paths, type names,
identifiers, version stamps, and docs. Collapsing any pair invites
either (a) BuyerRecon claiming ownership of AMS canonical names
(forbidden by §10), or (b) treating fixture parse-success as runtime
proof (forbidden by §11).

---

## §5 Fixture artifact plan (NOT IMPLEMENTED IN PR#14d)

Suggested artifact paths and shapes — **exact names remain Helen's
choice and will be finalised in PR#14e**. PR#14d does NOT create any
of these files.

### Suggested BuyerRecon-side artifacts (future)

| Path | Purpose |
| --- | --- |
| `docs/fixtures/productfeatures-namespace/buyerrecon-candidate-v0.1.json` | Single canonical valid fixture — deterministic, sanitized, version-stamped. |
| `docs/fixtures/productfeatures-namespace/buyerrecon-candidate-invalid-cases-v0.1.json` | Array of invalid fixtures (see §8) the BuyerRecon validator must reject. |
| `docs/fixtures/productfeatures-namespace/README.md` | Explains: internal-only / non-authoritative status, generation method, sanitization policy, regeneration command (if any), reserved-name guard, sample-metadata flag contract, and the *exact* PR#14a §5 casing-disclaimer block. |

Alternative: keep fixtures under `tests/fixtures/` if Helen prefers
test-adjacent placement. PR#14d does NOT prescribe; OD-2 settles it.

### Suggested AMS-side artifacts (future, separate AMS PR)

| Path | Purpose |
| --- | --- |
| `internal/products/buyerrecon/adapter/testdata/buyerrecon_candidate_v0_1.json` | Mirrored copy of the BuyerRecon-emitted canonical fixture, or a Go-side translator's output of it (depending on OD-5). |
| `internal/products/buyerrecon/adapter/feature_adapter_compat_test.go` | Go test that: (a) reads the fixture, (b) wraps it in a `contracts.ProductFeatures.Namespace`, (c) calls `ParseBuyerReconFeatures`, (d) asserts no panic / no error / non-nil result, (e) asserts no `ProductDecision` is created (the adapter cannot create one — but the assertion documents the invariant), (f) asserts no AMS scorer is invoked. |
| `internal/products/buyerrecon/adapter/feature_adapter_compat_invalid_test.go` | Negative-case test confirming malformed/forbidden fixtures fail gracefully (return `Unavailable` features, never panic). |

PR#14d does **not** mint these files; it only names them so PR#14e
review can verify scope.

### Hard rule

No artifact in PR#14e may **execute** AMS scoring
(`scorer.Fit`, `scorer.Intent`, `scorer.Window`, `scorer.TRQ`,
`scorer.RequestedAction`) against the fixture. The fixture proves
parse compatibility only. Calling scorers would re-introduce the
risk profile of Option E inside what is supposed to be a fixture
proof.

---

## §6 Candidate-to-AMS mapping questions

The fixture work must answer, in writing, every one of these. PR#14d
catalogues them; PR#14e/OD-5 resolves them with the fixture proof.

### 6.1 Top-level namespace key

- BuyerRecon emits `namespace_key_candidate = "buyerrecon"` at the
  candidate root.
- AMS `contracts.ProductFeatures` carries `Product string`,
  `NamespaceSchema string`, `NamespaceVersion string`, and
  `Namespace json.RawMessage`. The string `"buyerrecon"` flows into
  `ProductFeatures.Product`, not into `Namespace`.
- **Question.** Should the fixture (a) embed only the payload JSON
  that goes INSIDE `Namespace`, or (b) ship a full
  `ProductFeatures{Product, NamespaceSchema, NamespaceVersion,
  Namespace}` envelope? See OD-8.

### 6.2 JSON casing

- BuyerRecon emits snake_case lowercase JSON keys
  (`mapping_coverage_percent`, `pricing_signal_present`, ...).
- AMS `BuyerReconProductFeatures` Go fields are PascalCase
  (`PageTypeDistribution`, `DemoRequested`, `SessionsInLast7Days`).
  `encoding/json.Unmarshal` matches case-insensitively, but only
  against the Go field name itself — so JSON key `pagetypedistribution`
  matches `PageTypeDistribution`, but `mapping_coverage_percent`
  matches NO Go field on `FitFeatures`.
- **Question.** Does the fixture translate snake_case → PascalCase
  (or strip underscores), or does AMS gain explicit `json:"…"` tags
  in a separate AMS PR? Or does PR#14e introduce a documented
  translator step between the BuyerRecon candidate and the AMS-side
  fixture? See OD-5.

### 6.3 Go struct tags / decoding rules

- `internal/products/buyerrecon/scorer/types.go` carries **no**
  `json:"…"` tags on `FitFeatures`, `IntentFeatures`, or
  `WindowFeatures`. Decoding is therefore reliant on Go's default
  case-insensitive name matching.
- Adding `json:"…"` tags is an AMS-owned decision and out of
  PR#14d's authority.
- **Question.** Does the fixture proof aim for "BuyerRecon JSON works
  today as-is" (requires a translator), or "BuyerRecon JSON will
  work once AMS lands explicit `json:` tags" (deferred)? See OD-5.

### 6.4 Number type handling

- BuyerRecon emits TypeScript `number` (IEEE-754 float64) for both
  integer counters (`poi_count`, `unique_poi_count`,
  `progression_depth`) and ratios (`mapping_coverage_percent`).
- AMS expects `int` for some fields (`ComparisonPageCount`,
  `SessionsInLast7Days`, `DirectReturnCount`, `RepeatPricingRevisitCount`)
  and `OptionalFloat64` / `OptionalInt` wrappers for nullable
  observations.
- **Question.** Does the fixture round / cast / wrap before AMS sees
  it, or does the AMS-side test accept a documented unmarshal-loss
  semantics?

### 6.5 Nullable fields

- BuyerRecon emits `hours_since_last_qualifying_activity_or_null:
  number | null`.
- AMS `WindowFeatures.HoursSinceLastSession` is `OptionalFloat64
  { Value float64; Available bool }` — a *struct*, not a nullable
  number.
- **Question.** The shape difference is irreconcilable without a
  translator. PR#14e MUST decide the translator's home (BuyerRecon
  side, AMS side, or a third compatibility layer).

### 6.6 Boolean fields

- BuyerRecon emits `pricing_signal_present`, `comparison_signal_present`
  as bare `boolean`.
- AMS `IntentFeatures` carries `DemoRequested`, `TrialStarted`,
  `FormStarted`, `FormSubmitted` as bare `bool`; and
  `BurstNearConversionAssets` as `OptionalBool`.
- **Question.** Which BuyerRecon booleans map onto which AMS
  booleans? The names do not align ("pricing_signal_present" is not
  "DemoRequested"). The fixture must document the mapping or AMS
  must add an adapter step.

### 6.7 Map fields

- BuyerRecon emits `surface_distribution: Record<UniversalSurface,
  number>` (snake_case keys like `homepage`, `pricing`,
  `demo_request`).
- AMS `FitFeatures.PageTypeDistribution map[string]int` accepts any
  string key.
- **Question.** Do PR#13b's universal-surface labels align with
  whatever taxonomy AMS expects in `PageTypeDistribution`? The
  fixture must surface this and OD-5 must record the answer.

### 6.8 Missing optional fields

- AMS uses `OptionalFloat64 / OptionalInt / OptionalBool` to
  distinguish "observed zero / false" from "unavailable". JSON
  Unmarshal of a missing key produces the Go zero value of the
  wrapper struct (`{ Value: 0, Available: false }`) — i.e., correct
  "unavailable" semantics by accident.
- BuyerRecon does not emit Optional wrappers; it emits either the
  value or omits the key.
- **Question.** Is omission the right encoding for "unavailable" in
  the fixture, or must the fixture emit explicit `{ Value, Available }`
  objects? OD-5 must record the answer.

### 6.9 Required fields

- The AMS adapter's "availability promotion" logic
  (`feature_adapter.go` lines 27–37) treats availability as derived
  from whether *any* of a small set of fields was populated. There
  are no truly required fields; `UnavailableFeatures()` is the
  fallback.
- BuyerRecon, in contrast, hard-requires every PR#14b version stamp
  and every payload sub-block.
- **Question.** Should the fixture file enforce BuyerRecon-side
  required-field discipline (matches today's PR#14b candidate), or
  match AMS's "loose unmarshal" semantics? The two are not
  contradictory — fixture is BuyerRecon-canonical, AMS test is
  parse-tolerant — but PR#14e doc must say this explicitly.

### 6.10 Payload version placement

- BuyerRecon embeds `bridge_contract_version` and
  `bridge_payload_version` at the candidate root.
- AMS `ProductFeatures.NamespaceSchema` / `NamespaceVersion` are
  envelope-level fields *outside* the `Namespace` JSON blob.
- **Question.** Does the fixture replicate version stamps in both
  places (envelope + payload root), or strip them from the payload
  before handing to AMS? See OD-8.

### 6.11 Metadata fields

- BuyerRecon embeds `preview_metadata { internal_only: true,
  non_authoritative: true, not_customer_facing: true,
  does_not_execute_ams_product_layer: true,
  does_not_create_product_decision: true,
  exact_ams_struct_compatibility_unproven_until_fixture: true }`.
- AMS `BuyerReconProductFeatures` has no metadata sub-block; the
  AMS Unmarshal will silently ignore unknown fields by default.
- **Question.** Keep `preview_metadata` in the fixture for
  BuyerRecon-side validators (yes — every artifact carries those
  flags by §11), and accept AMS-side silent-ignore? Or strip before
  AMS consumption? See OD-8.

### 6.12 Translator vs. direct acceptance

- **Question.** Does AMS accept the current `fit_like_inputs /
  intent_like_inputs / timing_like_inputs` shape directly (no — see
  §6.2), or does PR#14e introduce a translator?
- Translator options:
  - **(T-a) BuyerRecon-side TS translator** — pure transform that
    re-keys the candidate into a Go-canonical shape before fixture
    emission.
  - **(T-b) AMS-side Go translator** — new file in AMS adapter
    package that maps BuyerRecon JSON into `BuyerReconProductFeatures`,
    leaving the canonical adapter unchanged.
  - **(T-c) AMS struct-tag PR** — AMS-owned PR that adds
    `json:"fit_like_inputs"` (etc.) to the existing Go types, making
    the BuyerRecon JSON directly acceptable. Highest blast radius
    on the AMS side; not recommended without separate review.

### Important reminder

**Do not assume direct AMS compatibility until a fixture test proves
it.** The PR#14b candidate's casing-disclaimer flag
`exact_ams_struct_compatibility_unproven_until_fixture: true`
remains true until the Option D fixture passes.

---

## §7 Valid fixture cases (planned)

PR#14e must include — at minimum — the following valid fixtures. Each
must round-trip through (a) PR#14b `validateBridgeCandidate` (BuyerRecon
side) and (b) the chosen AMS-side acceptance test (Option D-style).

| ID | Case | Shape note |
| --- | --- | --- |
| V-1 | Minimal valid candidate | All required version stamps present; `surface_distribution = { homepage: 1 }`; all booleans `false`; `conversion_proximity_indicators = {}`; `hours_since_last_qualifying_activity_or_null = null`; `buyerrecon_actionability_band = "insufficient_evidence"`; `progression_depth = 0` |
| V-2 | All allowed `conversion_proximity_indicators` populated | `{ pricing_visited: 2, comparison_visited: 1, demo_request_visited: 1 }` |
| V-3 | Taxonomy-valid `unknown` surface | `surface_distribution = { homepage: 3, unknown: 2 }`; `unknown_surface_count = 2` |
| V-4 | `hours_since_last_qualifying_activity_or_null = null` | Matches PR#13b's "no qualifying activity in window" path |
| V-5a..V-5f | Each actionability band exactly once | `hot_now`, `warm_recent`, `cooling`, `stale`, `dormant`, `insufficient_evidence` |
| V-6 | Multi-surface | `surface_distribution = { homepage: 4, pricing: 3, comparison: 2, demo_request: 1, case_study: 1 }`; `mapping_coverage_percent = 100` |
| V-7 | Empty `conversion_proximity_indicators` | `{}` — proves the allowlist accepts empty |
| V-8 | Explicit `ams_product_layer_reference_version` | Field set to `'BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0'` rather than relying on the default |

OD-6 records which subset is mandatory for v0.1.

---

## §8 Invalid fixture cases (planned)

PR#14e must verify each of the following is **rejected** by the
BuyerRecon-side validator where current PR#14b supports it, or by
PR#14e's fixture-specific privacy scan before any fixture is
accepted — and, where applicable, by the AMS-side test (parse fails
gracefully, no panic, no `ProductDecision`).

The "Expected rejection" column below distinguishes between *current
PR#14b validator behaviour* and *required PR#14e fixture-side
behaviour*. Where the column reads "PR#14e fixture privacy scan",
the fixture work itself must supply the rejection logic — current
PR#14b validator does not claim general recursive raw-URL / query-
string / email-shape *value* scanning. PR#14b rejects raw URL /
query / email-shape material as forbidden *keys*, rejects
free-form `conversion_proximity_indicators` keys outside the
allowlist, and rejects AMS reason-code namespace *strings* — those
are its current value-shape guarantees.

| ID | Case | Expected rejection |
| --- | --- | --- |
| I-1 | Missing `bridge_contract_version` | PR#14b post-mapper validator: required-field violation |
| I-2 | Missing `bridge_payload_version` | Same as I-1 |
| I-3 | Unknown `namespace_key_candidate` (e.g. `"acme"`) | PR#14b validator: namespace key not `"buyerrecon"` |
| I-4 | Forbidden AMS runtime key in payload (e.g. `Fit`, `Intent`, `Window`, `ProductDecision`, `BuyerReconProductFeatures`, `WindowState`, `RequestedAction`) | PR#14b validator: recursive AMS-reserved-name scan |
| I-5 | AMS reason-code string (`FIT.PRICE_VISITED`, `INTENT.HIGH`, `WINDOW.IN_WINDOW`) anywhere as a string value | PR#14b validator: recursive `^(FIT\|INTENT\|WINDOW)\.[A-Z][A-Z0-9_]*$` scan |
| I-6 | Raw URL anywhere as a value (`https://…`, `?utm_source=`) | **PR#14e fixture privacy scan: recursive raw-URL/query/email-shaped value rejection.** Current PR#14b validator rejects raw URL / query / email-shape keys via forbidden-key scans (`FORBIDDEN_PII_KEYS` includes `page_url`, `full_url`, `url_query`) and conversion-proximity key allowlists; it does not claim general value-shape scanning except AMS reason namespace strings. |
| I-7 | Query-string-shaped value (`a=b&c=d`) | **PR#14e fixture privacy scan: recursive raw-URL/query/email-shaped value rejection.** Current PR#14b validator rejects raw URL / query / email-shape keys via forbidden-key scans and conversion-proximity key allowlists; it does not claim general value-shape scanning except AMS reason namespace strings. |
| I-8 | Email-shaped value (e.g. `someone@example.com` appearing as a payload string) | **PR#14e fixture privacy scan: recursive raw-URL/query/email-shaped value rejection.** Current PR#14b validator rejects email-shape *keys* (via `EMAIL_KEY` in `FORBIDDEN_PII_KEYS`) and conversion-proximity key allowlists; it does not claim general value-shape scanning except AMS reason namespace strings. |
| I-9 | `person_id` / `visitor_id` / `company_id` / `domain_id` / `account_id` / enrichment fields (forbidden as keys) | PR#14b validator: recursive PII *key* scan via `FORBIDDEN_PII_KEYS`. For values containing person/company/enrichment-shape strings under non-forbidden keys, **PR#14e fixture privacy scan: recursive enrichment-shape value rejection.** Current PR#14b validator does not claim general value-shape scanning except AMS reason namespace strings. |
| I-10 | Full `session_id` field present | PR#14b validator: `session_id` is on the forbidden-key list |
| I-11 | Unknown `conversion_proximity_indicator` key (e.g. `landing_visited`) | PR#14b validator: `ALLOWED_CONVERSION_PROXIMITY_INDICATORS` allowlist |
| I-12 | Unknown surface label outside PR#13a §4.2 taxonomy (e.g. `glossary`) | PR#14b pre-mapper validator: universal-surface allowlist |
| I-13 | Invalid numeric values (`NaN`, `Infinity`, negative `poi_count`, fractional `unique_poi_count`, `mapping_coverage_percent > 100`) | PR#14b pre-mapper validator |
| I-14 | Invalid `buyerrecon_actionability_band` using an AMS `WindowState` value (`in_window`, `approaching`, `too_early`) | PR#14b pre-mapper validator: actionability-band enum |
| I-15 | Candidate that tries to mint `ProductDecision` (field of that name anywhere) | PR#14b validator: AMS-reserved-name scan + downstream AMS test confirms scoring NOT invoked |
| I-16 | Candidate that includes customer-facing / verdict / report fields (`risk_index`, `final_decision`, `action_recommendation`, `customer_facing: true`) | PR#14b validator: forbidden-key scan |

OD-7 records which subset is mandatory for v0.1.

---

## §9 AMS reserved-name guard (carried forward verbatim)

The future fixture / fixture-emitter / translator (whichever PR#14e
ships) MUST NOT redefine or own any of these AMS canonical names in
**BuyerRecon runtime** as TypeScript types, classes, interfaces,
enums, exported constants, top-level identifiers, or output JSON
keys at the type-defining level:

**Fit family.** `Fit`, `FitFeatures`, `FitResult`, `FitScore`,
`FitConfidence01`, `NonFitMarkers`, `HardSuppress`.

**Intent family.** `Intent`, `IntentFeatures`, `IntentResult`,
`IntentScore`, `IntentState`.

**Window family.** `Window`, `WindowFeatures`, `WindowResult`,
`WindowState`. AMS `WindowState` enum values: `in_window`,
`approaching`, `too_early`. The word `dormant` overlaps coincidentally
with PR#13a's `actionability_band` enum — namespace-disjoint, no
runtime coupling.

**TRQ family.** `TRQ`, `TRQResult`, `TRQBand`, `TRQScore`,
`TRQConfidence01`, `RawTRQScore01`.

**Product Layer contracts.** `ProductDecision`, `ProductFeatures`,
`ProductScorerInput`, `ProductScorer`, `BuyerReconConfig`,
`BuyerReconProductFeatures`, `RequestedAction`.

**AMS reason-code namespaces.** `FIT.*`, `INTENT.*`, `WINDOW.*`.

### What docs MAY do

Docs (including this one), comments, and tests MAY reference these
names for alignment commentary — e.g. "fixture aims to be parseable
by AMS into `BuyerReconProductFeatures`" — without claiming ownership.

### What fixture artifacts MAY contain

A fixture JSON file MAY contain the lowercase keys `fit`, `intent`,
`window` if (and only if) the chosen translator path requires them.
Those are *strings inside a JSON blob*, not TypeScript-level
identifiers, and remain AMS-side JSON conventions. PR#14b's recursive
validator rejects bare `fit` / `intent` / `window` keys today
(`FORBIDDEN_AMS_PAYLOAD_KEYS`) — meaning any translator producing
such keys must run *after* PR#14b validation, or PR#14e must add a
documented carve-out that does NOT relax the BuyerRecon-side
candidate guarantees.

### Static-source enforcement (carried forward to PR#14e)

PR#14e implementation tests MUST include a static-source sweep
(mirroring PR#12e Group J / PR#13b Group I / PR#14b Group L /
PR#14c Group L) that fails the build if any reserved name appears
as a TypeScript identifier in PR#14e BuyerRecon runtime source.
Comments stripped before the sweep.

---

## §10 Source and privacy boundary

### Source rule

Fixture content MUST be generated from one of:

1. **PR#14b mapper output** (preferred) — pass a sanitized
   `BridgeMapperInput` to `buildBridgeNamespaceCandidate`; capture
   the validated candidate verbatim.
2. **PR#14c observer output** — capture an accepted sample from a
   Hetzner-PASS run (e.g. the `671c632` baseline). Sanitization
   responsibilities below still apply.
3. **Hand-authored sanitized JSON** — only for invalid-case
   fixtures and edge-case shapes (e.g. forced `null` /
   `NaN` / forbidden-key cases) where no real session would
   produce them.

No fixture may be generated from raw `accepted_events`,
`rejected_events`, `ingest_requests`, `session_features`,
`session_behavioural_features_v0_2`, `stage0_decisions`,
`risk_observations_v0_1`, `scoring_output_lane_a`,
`scoring_output_lane_b`, `site_write_tokens`, or any AMS-owned
table. **Fixture generation MUST NOT introduce any new SQL read.**

### Privacy posture (carried forward from PR#14a §8 + PR#14b)

The fixture MUST:

- **No personal identification.** No `email`, `phone`, `person_id`,
  `visitor_id`, `company_id`, `domain_id`, `account_id`,
  `email_hash`, `person_hash`, `device_fingerprint`, `font_list`.
- **No deanonymisation.** No reverse-lookup attempts; no
  cross-referencing against external corpora.
- **No enrichment.** No firmographic / IP-to-company / SIC / NAICS
  fields. (AMS Product Layer may perform its own enrichment
  downstream; the fixture does not pre-fill AMS enrichment slots.)
- **No raw URLs or query strings.** Only normalised
  universal-surface labels.
- **No full session IDs.** Either use fully synthetic IDs (preferred
  — see OD-4), or truncated `prefix(8)…suffix(4)` per PR#14c
  observer convention.
- **No secrets.** No API keys, no DB DSNs, no auth tokens.
- **No customer-specific private scoring code.** All customer
  behaviour stays in versioned templates / mappings / configs.
- **Samples remain synthetic or sanitized.** Even if generated from
  a real staging session, every field must be re-checked against the
  privacy allowlist before commit.
- **DB reads.** Fixture tests MUST NOT open a DB connection. They
  read static JSON files only.

---

## §11 Output boundary

The fixture proof, by construction:

- Does NOT produce customer output.
- Does NOT mint `ProductDecision`.
- Does NOT execute AMS Product Layer scoring (`Fit` / `Intent` /
  `Window` / `TRQ`). The AMS-side test (if any) calls only
  `ParseBuyerReconFeatures` / `UnavailableFeatures` / equivalent
  parse helpers; scorers are not invoked.
- Does NOT register a `RequestedAction`.
- Does NOT emit `FIT.*` / `INTENT.*` / `WINDOW.*` reason codes.
- Does NOT write to Lane A / Lane B / Trust / Policy.
- Does NOT alter the AMS canonical contract; the canonical Go types
  remain frozen.

Any later runtime bridge (Option E) is a **separate PR** with:

- Its own scoping doc + Helen OD list (mirroring PR#13a, PR#14a,
  this doc).
- Its own implementation PR with full test coverage.
- Its own Hetzner staging proof.
- Its own rollback path (defining what reverting customer-eligible
  surfaces looks like).
- Explicit Helen sign-off.
- Architecture Gate A0 P-4 unblock (Render production deploy still
  blocked at the time of writing).

PR#14d does NOT pre-authorise Option E by any wording in this doc.

---

## §12 PR#14e / future implementation options

Five forward choices after PR#14d. Helen picks via OD-1.

### Option A — BuyerRecon-side fixture JSON only

**Scope.** Add `docs/fixtures/productfeatures-namespace/*.json` files
(canonical valid + invalid array) emitted from PR#14b mapper output,
plus the README. No AMS repo changes. No test execution against AMS.

| Aspect | Detail |
| --- | --- |
| Repo touched | BuyerRecon only |
| Source | PR#14b mapper applied to a sanitized `BridgeMapperInput` (or a captured PR#14c sample, sanitized) |
| Output | Static JSON files + README |
| Pros | Smallest blast radius; lets Helen and Codex review the canonical shape statically; no cross-repo coordination |
| Risks | Does not actually prove AMS-side parse compatibility; "looks right to a human" is not "parses in AMS" |
| Validation | BuyerRecon-side: run PR#14b `validateBridgeCandidate` on every fixture (valid round-trips, invalid rejects with the expected reason). No AMS-side check. |
| When Helen should choose | When she wants the smallest next step inside BuyerRecon only, before any AMS-side commitment. |

### Option B — BuyerRecon-side fixture generator test

**Scope.** Add a Vitest test that constructs deterministic
`BridgeMapperInput` examples and exercises PR#14b mapper against
them. Optionally writes the result to a fixture JSON file gated on a
flag (e.g. `npm test -- --update-fixtures`). No AMS repo changes.

| Aspect | Detail |
| --- | --- |
| Repo touched | BuyerRecon only |
| Source | Synthetic in-test data |
| Output | In-memory candidate objects + optional fixture JSON when explicitly approved |
| Pros | Catches mapper-output drift in CI; flag-gated file-emit keeps the working tree predictable |
| Risks | Still does not prove AMS-side parse compatibility |
| Validation | Vitest. No DB. No Hetzner proof needed. |
| When Helen should choose | When she wants regression coverage of the candidate shape without coordinating cross-repo. |

### Option C — AMS-side compatibility fixture PR

**Scope.** Separate AMS PR that adds `internal/products/buyerrecon/adapter/testdata/buyerrecon_candidate_v0_1.json`
plus a Go test invoking `ParseBuyerReconFeatures` against it. No
BuyerRecon runtime bridge. The fixture file is mirrored from
BuyerRecon (or generated from a documented translator — see OD-5).

| Aspect | Detail |
| --- | --- |
| Repo touched | AMS only (plus BuyerRecon-side authorship of the canonical fixture content if Option A or B has run) |
| Source | BuyerRecon canonical fixture content (mirrored into AMS testdata) |
| Output | AMS Go test that PARSES the fixture; assertions: no error, no `ProductDecision`, no scorer invocation, expected sub-block availability |
| Pros | First *real* cross-repo proof. Catches casing / type-width / shape mismatch concretely. Sets precedent for future fixture additions. |
| Risks | Requires AMS-side review discipline; if the test fails, the answer is either "translate on BuyerRecon side" (OD-5) or "add `json:"…"` tags on AMS side" (a separate AMS decision). |
| Validation | AMS Go test (`go test ./internal/products/buyerrecon/adapter/...`). No BuyerRecon runtime change. |
| When Helen should choose | When she wants real cross-repo compatibility proof, accepting that the AMS PR is a separate review/merge cycle. **Strong default if real proof is the priority.** |

### Option D — Dual-repo fixture contract

**Scope.** BuyerRecon owns canonical fixture *generation* (Option A
or B); AMS owns canonical fixture *consumption* test (Option C).
Both repos reference the same fixture content (the AMS-side copy is
explicitly stamped as mirrored from BuyerRecon at a specific commit).
A future BuyerRecon contract bump triggers an AMS PR that re-mirrors
+ re-runs the AMS test.

| Aspect | Detail |
| --- | --- |
| Repo touched | Both BuyerRecon and AMS, in coordinated PRs |
| Source | BuyerRecon canonical fixture |
| Output | BuyerRecon JSON file + README + AMS Go test |
| Pros | Cleanest separation of ownership; durable cross-repo contract; future evolution is a predictable two-step (BuyerRecon bumps, AMS re-mirrors) |
| Risks | Two-repo coordination overhead; rollback requires reverting both PRs in order; fixture-mirror drift if AMS forgets to re-mirror |
| Validation | BuyerRecon validators (Option A + B) + AMS Go test (Option C) |
| When Helen should choose | After Option C has proved the AMS-side parse works. Option D formalises the contract by giving each side a canonical role. |

### Option E — Runtime bridge

**Scope.** Wire BuyerRecon-side bridge output to AMS Product Layer
runtime (direct package import or inter-process JSON exchange).
AMS executes `Fit` / `Intent` / `Window` / `TRQ` against the bridge
payload and returns `ProductDecision`.

| Aspect | Detail |
| --- | --- |
| Repo touched | Both BuyerRecon and AMS at runtime, plus likely Trust / Policy / Lane A/B gating PRs |
| Source | Cross-repo runtime |
| Output | AMS `ProductDecision` (consumed by Trust / Policy downstream — out of PR#14 scope) |
| Pros | Closes the evidence → decision loop |
| Risks | Largest blast radius. Cross-repo runtime coupling. Rollback non-trivial. Premature without A/B/C/D proof. Customer-facing eligibility implications. Architecture Gate A0 P-4 (Render production) still blocking. |
| Validation | Full BuyerRecon Hetzner staging proof + AMS staging proof + Trust / Policy / Lane A/B gating proof + Helen-locked customer-facing copy review |
| When Helen should choose | **Not recommended yet.** Requires: at minimum Option C (or D) proof; an explicit rollback plan; Helen-signed Policy Pass 2 + Lane A/B gating doc; A0 P-4 unblock for Render; an OD list as long as PR#14a/PR#13a's. |

### Recommended default

- **For the smallest next step inside BuyerRecon only**: Option A.
- **For real compatibility proof**: Option C (AMS-side fixture PR).
- **For the durable cross-repo contract**: Option D after Option C
  passes.
- **Prefer Option C or D before Option E.** Option E is explicitly
  not recommended without prior A/B/C/D proof and an A0 P-4 unblock.

---

## §13 Validation strategy for future fixture PR

PR#14e implementation tests SHOULD cover:

| Category | Test |
| --- | --- |
| **Fixture parse** | Every valid fixture JSON parses with `JSON.parse` without throwing. |
| **Fixture shape** | Every valid fixture round-trips through PR#14b `validateBridgeCandidate` returning `{ ok: true, candidate }` byte-identical. |
| **Forbidden-key scan** | Recursive scan over every fixture rejects any AMS-reserved key (PR#14b `FORBIDDEN_AMS_PAYLOAD_KEYS`). |
| **Privacy scan** | PR#14b `FORBIDDEN_PII_KEYS` covers forbidden keys; PR#14e MUST add or invoke an explicit fixture privacy value scan for email-shape and URL-shape (and query-string-shape and person/company/enrichment-shape) string values before any fixture is accepted. Current PR#14b validator does not claim general value-shape scanning except AMS reason namespace strings (`^(FIT\|INTENT\|WINDOW)\.[A-Z][A-Z0-9_]*$`). |
| **No `ProductDecision`** | The string `ProductDecision` does not appear in any fixture; AMS-side test (if any) asserts no `ProductDecision` is minted. |
| **No AMS scoring execution** | AMS-side test (if any) calls only `ParseBuyerReconFeatures`, never `scorer.Fit*` / `scorer.Intent*` / `scorer.Window*` / `scorer.TRQ*` / action selector. |
| **Casing / Go struct compatibility** | AMS-side test (if any) asserts the fixture deserialises into `BuyerReconProductFeatures` with expected sub-block `Available` flags. (Whether this is "deserialises as-is" or "deserialises via documented translator" is OD-5.) |
| **Deterministic fixture generation** | If PR#14e includes a fixture generator (Option B), running it twice produces byte-identical output. |
| **Version-stamp verification** | Every valid fixture carries every PR#14b version stamp (§6 of PR#14a). Missing stamp → rejected. |
| **Invalid fixture rejection** | Every invalid fixture (§8) is rejected with the expected reason family. |
| **Reserved-name static-source guard** | Static-source sweep over PR#14e BuyerRecon runtime source (if any) catches AMS-reserved identifiers — same as PR#14b Group L. |
| **Fixture README** | README explicitly states: internal-only, non-authoritative, does not execute AMS scoring, does not mint `ProductDecision`, sanitisation policy, regeneration command (if Option B), AMS-side counterpart commit (if Option C/D). |
| **Sample-metadata flag check** | Every valid fixture carries the six `preview_metadata` literal-`true` flags. |
| **CI determinism** | Tests do not read DB, do not read env, do not read filesystem outside `tests/` or `docs/fixtures/`. |

---

## §14 Open decisions (OD) for Helen

These resolve at PR#14e gate.

- **OD-1.** Should the next step (PR#14e) be Option A
  (BuyerRecon-only fixture artifact), Option B (BuyerRecon-side
  fixture generator test), Option C (AMS-side compatibility PR),
  Option D (dual-repo contract), or wait?
- **OD-2.** Which repo owns the canonical fixture JSON content?
  Recommended: BuyerRecon authors; AMS mirrors.
- **OD-3.** Should the canonical fixture be generated from a captured
  PR#14c staging sample (sanitized) or from a synthetic sanitized
  `BridgeMapperInput`? Recommended: synthetic, to avoid any chance
  of staging-data leak.
- **OD-4.** Should the fixture include truncated session prefixes
  (`prefix(8)…suffix(4)`) for traceability, or fully synthetic IDs?
  Recommended: fully synthetic IDs (e.g. `fixture_session_v01_01`),
  given the fixture is shape evidence not session evidence.
- **OD-5.** Does AMS accept the current `*_like_inputs` shape
  directly, or does PR#14e introduce a translator?
  - (T-a) BuyerRecon-side TS translator → fixture emits Go-canonical shape.
  - (T-b) AMS-side Go translator → AMS PR adds adapter step.
  - (T-c) AMS adds `json:"…"` struct tags (separate AMS decision).
  Helen picks; recommendation likely (T-b), keeping BuyerRecon
  candidate shape stable and confining changes to AMS adapter.
- **OD-6.** Which valid fixture cases (§7) are mandatory for v0.1?
  Recommended minimum: V-1, V-5a..V-5f, V-6.
- **OD-7.** Which invalid fixture cases (§8) are mandatory for v0.1?
  Recommended minimum: I-1, I-3, I-4, I-5, I-9, I-10, I-11, I-12,
  I-14, I-15.
- **OD-8.** Should the fixture include `preview_metadata`, source
  evidence versions, and bridge version stamps as-is, or strip them
  before AMS consumption?
  Recommended: keep them in the BuyerRecon canonical fixture;
  AMS-side test treats them as "unknown extra fields" (silently
  ignored by `encoding/json`).
- **OD-9.** Should the AMS-side test (if any) only parse the
  fixture, or also run an adapter normalisation step (the
  `Available` promotion logic in `feature_adapter.go`)?
  Recommended: include the normalisation assertion (it is the
  parse semantics in practice) but NOT the scorers.
- **OD-10.** What proof is required before Option E runtime bridge?
  Recommended minimum: Option C passes; Option D contract recorded;
  separate Policy Pass 2 + Lane A/B gating PR; A0 P-4 unblock for
  Render; Helen-locked customer-facing copy review.
- **OD-11.** Is any durable artifact (table / migration / cross-repo
  runtime call) forbidden until the AMS-side fixture test passes?
  Recommended: yes — PR#14b/PR#14c stay observer-only; no durable
  bridge artifact until OD-5 + OD-10 are satisfied.
- **OD-12.** Must Go struct compatibility be proven before any new
  BuyerRecon runtime code touches the bridge?
  Recommended: yes — Option C or D acts as the precondition for
  any PR#15-ish BuyerRecon bridge runtime addition.
- **OD-13.** Should PR#14e include a BuyerRecon-side static
  "fixture-coverage" test (asserts each band / each surface / each
  conversion-proximity indicator appears at least once across the
  valid fixture set)?
- **OD-14.** Should the canonical fixture's `generated_at` /
  `effective_from` (if any) be frozen literals, or live-clock at
  generation time? Recommended: frozen ISO literals, so two
  regenerations are byte-identical.
- **OD-15.** Does PR#14e need its own Hetzner staging proof?
  Recommended: only if PR#14e adds an observer or generator that
  reads DB. Option A / B alone do not require Hetzner; Option C /
  D AMS-side tests are AMS-staging concerns.

Add more if useful. Each OD must be answered before PR#14e files
land.

---

## §15 Acceptance criteria for PR#14d

PR#14d is acceptable iff:

- Exactly one docs-only file created
  (`docs/sprint2-pr14d-ams-compatibility-fixture-planning.md`).
- No code change anywhere.
- No `package.json` change.
- No migration / `schema.sql` / DB / `psql` change.
- No Render / AMS repo change.
- No fixture JSON file created.
- No AMS test added.
- Fixture *purpose* is explicit (§3).
- Three-layer separation is explicit and not collapsed (§4).
- Source boundary (§10) and output boundary (§11) are explicit.
- Valid and invalid fixture cases are catalogued (§7 + §8).
- Future options A–E + recommended default are present (§12).
- OD list for Helen (§14) is present and answerable.
- AMS reserved-name guard (§9) is repeated verbatim.
- Codex review checklist (§16) is present.
- Working tree clean apart from the new doc; doc is untracked; no
  commit; no push.

---

## §16 Suggested Codex review checklist

- **Scope safety.** Is anything in §5 / §7 / §8 / §12 implementable
  inside PR#14d? (No — PR#14d is docs-only.)
- **AMS alignment.** Do §3 / §6 / §9 accurately reflect
  `internal/contracts/features.go`,
  `internal/products/buyerrecon/scorer/types.go`, and
  `internal/products/buyerrecon/adapter/feature_adapter.go` at the
  AMS HEAD this PR references?
- **No runtime bridge.** Does the doc anywhere implicitly authorise
  Option E? (It must not.)
- **No `ProductDecision` minting.** Does any §5 / §7 / §12 wording
  imply that any future PR#14e artifact will mint `ProductDecision`?
  (It must not.)
- **No AMS scoring execution.** Does any planned validation step
  invoke `scorer.Fit*` / `scorer.Intent*` / `scorer.Window*` /
  `scorer.TRQ*` / action selector? (It must not.)
- **No customer output.** Does any planned artifact produce
  customer-eligible surfaces? (It must not.)
- **Fixture case completeness.** Are the valid (§7) and invalid
  (§8) catalogues complete enough for PR#14e to start without
  another planning PR?
- **Privacy safety.** Are §10's privacy rules carried forward from
  PR#14a §8 verbatim? Does §10 forbid raw-URL / query-string /
  email-shape / full-session-id leakage?
- **Reserved-name guard.** Is §9 byte-equivalent to PR#14a §10's
  reserved-name list (no additions, no quiet deletions)?
- **Future option clarity.** Is each of A–E §12 row complete (scope,
  repo touched, source, output, pros, risks, validation, when Helen
  should choose)?
- **Option ordering.** Does the recommended default explicitly
  prefer Option C or D *before* Option E? (It must.)
- **OD list.** Are there enough open decisions (§14) to cover every
  meaningful PR#14e branch point?
- **Acceptance criteria.** Is §15 a strict and observable list?
- **Authority correctness.** Are the cited commit hashes
  (`982e90e`, `1441c86`, `4b3b1b6`, `671c632`, `469b203`,
  `e20ad7b`, `6739bc7`) accurate for the docs they label?

---

**End of PR#14d compatibility-fixture planning.**
