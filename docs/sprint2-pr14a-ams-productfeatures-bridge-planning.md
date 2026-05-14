# Sprint 2 PR#14a — AMS ProductFeatures Bridge Planning

**Status.** PLANNING ONLY. Docs-only. No code, no `package.json`,
no migration, no `schema.sql` change, no DB writes, no `psql`, no
Render, no AMS repo changes. PR#0–PR#13b implementation files are
referenced read-only.

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — workflow
  truth file; §10 + §23 AMS Series Core reserved-name guard,
  §11–§14 PCF / Timing scope, §22 PR mapping cadence.
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md`
  (Helen OD-1..OD-15, commit `6739bc7`) — §2.1 AMS Product Layer
  reference alignment, §17 AMS reserved-name guard for Fit /
  Intent / Window / TRQ / ProductDecision families.
- `docs/sprint2-pr13b-product-context-timing-observer.md`
  (implementation at commit `e20ad7b`; Hetzner-PASS at `469b203`)
  — Option C read-only observer; emits internal-only
  `buyerrecon_product_features_shape_preview`.
- AMS read-only references (NOT runtime imports):
  `docs/algorithms/BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0.md`,
  `internal/contracts/features.go` (`ProductFeatures { Namespace
  json.RawMessage }`), `internal/contracts/contracts_test.go`,
  `internal/engines/interfaces.go` (`ProductScorer`,
  `ProductScorerInput`),
  `internal/products/buyerrecon/scorer/types.go`,
  `internal/products/buyerrecon/adapter/feature_adapter.go`
  (parses `ProductFeatures.Namespace` → `BuyerReconProductFeatures`),
  `internal/products/buyerrecon/adapter/thinsdk_adapter.go`,
  `internal/products/buyerrecon/sites/sites.go`.

---

## §1 PR#14a scope

PR#14a is the **planning-only step** for the future BuyerRecon →
AMS `ProductFeatures.Namespace` bridge. It produces:

- One planning doc (this file).

It produces NO code, NO migration, NO schema change, NO DB writes,
NO CLI, NO npm script, NO Render touch, NO AMS repo change. PR#14b
is the implementation step that follows, gated on Codex review +
Helen sign-off of this planning doc. PR#14a does NOT pre-commit
PR#14b to a specific implementation shape — see §12 for the five
options Helen chooses between.

PR#14a sits **after** PR#13b's read-only observer (the
"buyerrecon_product_features_shape_preview" emitter) and **before**
any future bridge implementation. It turns "shape preview" into a
**bridge contract plan**, not runtime integration. It does NOT
execute AMS Product Layer logic, NOT create `ProductDecision`, NOT
implement `Fit` / `Intent` / `Window` / `TRQ` scoring, NOT create
customer-facing output.

---

## §2 Current source state

PR#12–PR#13 chain status before PR#14a starts:

| Layer | State | Commit |
| --- | --- | --- |
| `poi_observations_v0_1` | Durable, Hetzner-proven | PR#11c / PR#11d Hetzner PASS |
| `poi_sequence_observations_v0_1` | Durable, Hetzner-proven | PR#12d / PR#12e Hetzner PASS |
| PR#13a Product-Context Fit + Timing Window planning | Helen OD-1..OD-15 signed | `6739bc7` |
| PR#13b Product-Context / Timing Observer (Option C) | Read-only observer; Hetzner-PASS | impl `e20ad7b`, proof `469b203` |

### PR#13b observer summary

- Reads `poi_observations_v0_1` + `poi_sequence_observations_v0_1`
  + `information_schema.{tables, columns}` only.
- Writes nothing.
- Emits a **markdown report** with structured sections (boundary,
  source readiness, source scan, evidence quality, product-context
  preview, timing/actionability, AMS-aligned JSON preview, read-only
  proof, run metadata).
- The JSON-preview block is internal-only,
  non-authoritative, and labelled `buyerrecon_product_features_shape_preview`
  to avoid colliding with AMS's canonical `BuyerReconProductFeatures`
  identifier.
- Does NOT execute AMS Product Layer. Does NOT call `Fit` /
  `Intent` / `Window` / `TRQ` scoring. Does NOT issue
  `ProductDecision`. Does NOT touch Lane A/B, Trust, Policy, or
  customer output.

### Last Hetzner staging proof (PR#13b)

- 8 POI rows / 8 POI Sequences / 6 stage0_excluded / 2 eligible / 0
  anomalies on every regression observer.
- Pre = Post counts on all 8 monitored tables (observer wrote
  nothing).
- Mapping coverage 100% (`{ homepage: 7, pricing: 1 }`);
  actionability band `warm_recent` × 8; one conversion-proximity
  hit (`pricing_visited: 1`).

PR#14a is the planning step that decides **whether and how** the
JSON preview shape PR#13b emits could later become a payload AMS
Product Layer can consume via `ProductFeatures.Namespace`.

---

## §3 AMS target contract

The AMS-owned target shape PR#14a plans to align with — **read-only
reference, NOT a runtime import**:

### `ProductFeatures` (AMS canonical, frozen)

From `internal/contracts/features.go`:

```
type ProductFeatures struct {
  Namespace json.RawMessage   // typed + versioned per-product payload
  // ... AMS-canonical fields
}
```

`ProductFeatures.Namespace` carries a **product-namespaced JSON
payload** that the AMS adapter layer parses into a typed
product-specific feature struct. For BuyerRecon, AMS's
`internal/products/buyerrecon/adapter/feature_adapter.go` parses
`Namespace` into `BuyerReconProductFeatures` (AMS-owned type with
sub-blocks `Fit`, `Intent`, `Window`).

### Downstream AMS surfaces (out of PR#14 scope)

- `Fit` / `Intent` / `Window` / `TRQ` scoring — AMS canonical.
- `ProductDecision` — AMS canonical, proposal-shaped, consumed by
  Trust Core via `TrustInputsV3`.
- `ProductScorer` / `ProductScorerInput` — AMS frozen engine
  interfaces.

**PR#14a only plans the bridge INPUT shape**: the JSON object that
goes inside `ProductFeatures.Namespace`. Everything downstream
(`Fit`/`Intent`/`Window`/`TRQ`/`ProductDecision`) is AMS-owned and
out of PR#14 scope.

---

## §4 Bridge payload boundary

### Three distinct concepts (DO NOT CONFLATE)

| Concept | Owner | Status |
| --- | --- | --- |
| **PR#13b preview** | BuyerRecon | Already exists. Internal-only, observer-side inspection sample. Emitted as `buyerrecon_product_features_shape_preview` inside the PR#13b markdown report. |
| **Future bridge candidate** | BuyerRecon | Planned by PR#14a; built by PR#14b. Validated JSON payload **planned** for handoff to the AMS Product Layer. Internal-only until AMS bridge runtime is wired. |
| **AMS `ProductFeatures.Namespace`** | AMS | Canonical contract. Frozen in `internal/contracts/features.go`. BuyerRecon must never claim ownership of this name. |
| **AMS `BuyerReconProductFeatures`** | AMS | Canonical adapter-side type that AMS deserialises `Namespace` into. Never minted by BuyerRecon runtime. |

### Planning-only naming convention for PR#14a / PR#14b

Use namespace-disjoint terms. Recommended:

- `bridge_candidate` — generic shorthand
- **`product_features_namespace_candidate`** — top-level name (planning-clear, AMS-respecting)
- `ams_bridge_payload_candidate` — alternative
- `buyerrecon_feature_namespace_preview` — alternative if Helen prefers to keep "preview" continuity from PR#13b

**Recommended default for PR#14b runtime**: `product_features_namespace_candidate`.

### Why three names, not one

- The PR#13b **preview** is shaped for human inspection (markdown
  report block), capped at `OBS_SAMPLE_LIMIT`, carries an explicit
  `preview_metadata.non_authoritative = true` flag.
- The future **bridge candidate** is shaped for AMS adapter
  ingestion: full per-session payload, schema-validated, version-
  stamped, deterministic.
- The AMS **canonical contract** is owned by AMS; BuyerRecon never
  redefines or shadows it.

Collapsing these three into one name would either pollute the AMS
namespace or obscure the readiness boundary between preview and
production-shape payload.

---

## §5 Field mapping plan

PR#14b will map PR#13b preview concepts into a `product_features_namespace_candidate`
payload aligned with AMS `BuyerReconProductFeatures` JSON shape
(three top-level sections at the JSON-key level: `fit`, `intent`,
`window`). **These are INPUT features only, NOT AMS scores or
classifications.**

### `fit`-like evidence inputs

Maps from PR#13b `product_context_preview` + `evidence_quality`:

| Bridge candidate field (lowercase JSON key) | Source in PR#13b | Notes |
| --- | --- | --- |
| `page_type_distribution` | `product_context_preview.universal_surface_distribution` | Per-session, surface label → count |
| `mapping_coverage_percent` | `product_context_preview.mapping_coverage_percent` | Per-session 0..100 |
| `unknown_surface_count` | `evidence_quality.unknown_surface_count` | Per-session (audit) |
| `excluded_surface_count` | `evidence_quality.excluded_surface_count` | Per-session (audit) |
| `category_template` | `product_context_preview.category_template` | Enum value (not a score) |
| `site_mapping_version` | `product_context_preview.site_mapping_version` | Version stamp |

PR#14a explicitly notes: **NO** `FitScore`, **NO** `FitResult`,
**NO** `FitConfidence01`, **NO** `NonFitMarkers`, **NO**
`HardSuppress`. Those are AMS-owned downstream outputs computed by
the AMS Product Layer from these inputs.

### `intent`-like evidence inputs

Maps from PR#13b per-session preview + POI Sequence facts:

| Bridge candidate field | Source in PR#13b | Notes |
| --- | --- | --- |
| `poi_count` | session's POI Sequence `poi_count` | Integer ≥ 0 |
| `unique_poi_count` | session's POI Sequence `unique_poi_count` | Integer ≥ 0 |
| `pricing_signal_present` | session's preview boolean | Boolean — derived from universal-surface taxonomy hit, NOT a score |
| `comparison_signal_present` | session's preview boolean | Boolean |
| `conversion_proximity_indicators` | aggregated across session sequences | Object: `{ pricing_visited: count, comparison_visited: count, demo_request_visited: count }` |
| `poi_sequence_pattern_class` | session's POI Sequence pattern class | Enum (`single_poi`, `multi_poi_linear`, etc.) |

PR#14a explicitly notes: **NO** `IntentScore`, **NO**
`IntentResult`, **NO** `IntentState`, **NO** AMS `INTENT.*` reason
codes.

### `window`-like evidence inputs

Maps from PR#13b `timing_actionability` + per-session preview:

| Bridge candidate field | Source in PR#13b | Notes |
| --- | --- | --- |
| `hours_since_last_session_or_null` | per-session preview | Float / null |
| `actionability_band` | per-session preview | BuyerRecon-side band (`hot_now` / `warm_recent` / `cooling` / `stale` / `dormant` / `insufficient_evidence`) — NOT AMS `WindowState` |
| `progression_depth` | session's POI Sequence `progression_depth` | Integer ≥ 0 |
| `timing_window_bucket` | per-session timing bucket | Enum (`<=1h` / `<=24h` / `<=7d` / `<=30d` / `<=90d` / `>90d` / `unknown`) |
| `sales_motion` | `product_context_preview.sales_motion` | Enum — context for AMS to interpret bands |
| `freshness_decay_model_version` | `run_metadata.freshness_decay_model_version` | Version stamp |

PR#14a explicitly notes: **NO** `WindowState`, **NO**
`WindowResult`, **NO** `WindowScore`, **NO** AMS `WINDOW.*` reason
codes. The PR#13b `dormant` label is namespace-disjoint from the
AMS `WindowState` `dormant` value (coincidental word overlap; PR#13a
§17 + PR#13b enforcement). Bridge candidate's `actionability_band`
field name makes the disjointness explicit.

### AMS JSON casing / struct compatibility note

> **Exact AMS JSON field casing / Go struct compatibility MUST be
> verified by Option D or an equivalent AMS adapter fixture before
> Option E. PR#14b candidate keys are not authoritative AMS runtime
> fields until that compatibility proof passes.**

The bridge-candidate field names in the tables above (`page_type_distribution`,
`mapping_coverage_percent`, `poi_count`, `unique_poi_count`,
`pricing_signal_present`, `comparison_signal_present`,
`hours_since_last_session_or_null`, `actionability_band`,
`progression_depth`, `timing_window_bucket`, `sales_motion`, etc.)
are **planning-shape only**. They reflect PR#13b's preview-side
conventions and a best-effort alignment with AMS's documented
`BuyerReconProductFeatures` JSON sub-blocks. PR#14b implementations
MUST NOT assume that:

- AMS's exact Go struct `json:"…"` tags match these names verbatim
- AMS's expected casing (camelCase vs snake_case vs PascalCase) is
  identical to PR#14b candidate output
- Sub-block boundaries (`fit` / `intent` / `window`) admit only
  the fields listed here and no others
- Type widths (int / int64 / float64 / string) are interchangeable

Casing and struct compatibility must be **proven by Option D** (a
cross-repo AMS fixture PR that round-trips a BuyerRecon-emitted
fixture through AMS's canonical
`internal/products/buyerrecon/adapter/feature_adapter.go`) **or an
equivalent AMS-adapter-side validator** before Option E runtime
integration is attempted. Until that proof passes, every PR#14b
candidate payload carries `preview_metadata.must_not_be_treated_as_ams_runtime_output:
true` (see OD-15).

---

## §6 Versioning contract

Every `product_features_namespace_candidate` payload MUST carry the
following version stamps for replay / comparison / rollback. Mirrors
PR#13a §11 + PR#13b `run_metadata`:

| Field | Source / meaning |
| --- | --- |
| `bridge_contract_version` | PR#14a / PR#14b contract version (e.g. `'pfn-bridge-v0.1'`) |
| `bridge_payload_version` | Per-payload version stamp (allows payload-shape evolution) |
| `observer_version` | PR#13b observer version that produced the preview (if PR#14b option B/C) |
| `product_context_profile_version` | PR#13b profile envelope |
| `universal_surface_taxonomy_version` | PR#13a §4.2 |
| `category_template_version` | PR#13a §4.3 |
| `buying_role_lens_version` | PR#13a §4.4 (deferred per OD-9; recommend `'brl-v0.1-deferred'`) |
| `site_mapping_version` | PR#13a §4.5 |
| `excluded_mapping_version` | PR#13a §4.6 |
| `timing_window_model_version` | PR#13a §14 |
| `freshness_decay_model_version` | PR#13a §4.10 |
| `source_table_poi_version` | PR#11c table contract (e.g. `'poi_observations_v0_1'`) |
| `source_table_poi_sequence_version` | PR#12d table contract |
| `source_poi_observation_version` | Carried from POI rows |
| `source_poi_input_version` | Carried from POI rows |
| `source_poi_sequence_version` | Carried from POI Sequence rows |
| `ams_product_layer_reference_version` | Reference-only stamp pointing at the AMS spec version PR#14b targets (e.g. `'BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0'`) |
| `generated_at` | ISO-8601 timestamp the payload was produced (CLI / report boundary timestamp, not used inside pure mapper) |
| `effective_from` (optional) | If the bridge produces back-dated payloads for replay |

### Determinism requirements

- Given the same input evidence rows + same version stamps + same
  evaluation clock → byte-identical payload.
- No `Date.now()` inside pure mapper functions. Clock timestamps
  enter only at CLI / report boundaries.
- No `Math.random()` anywhere in PR#14b runtime.

### Replay / comparison / rollback

- Two payloads with different `bridge_payload_version` but same
  evidence inputs MUST be safe to compare side-by-side.
- Rolling back a `site_mapping_version` (e.g. from v0.2 back to
  v0.1) is a pure data/config rollback; PR#14b runtime needs no
  coordinated code rollback.
- If PR#14b ever introduces a durable table (NOT recommended at
  v0.1), rollback semantics mirror PR#12d's "additive-only,
  forward-only" pattern.

---

## §7 Source boundary

The future bridge MUST NOT read raw ledgers.

### Allowed source inputs (recommended default for PR#14b)

- **PR#13b observer / mapper output** (preferred) — operates on the
  already-validated PCF preview shape; bridge is a pure
  transformation
- `poi_observations_v0_1` — only if PR#14b option B/C decides to
  read POI directly instead of going through PR#13b output
- `poi_sequence_observations_v0_1` — same as above
- `information_schema.tables` / `information_schema.columns` —
  only for read-only source-readiness probes (PR#13b-style
  fail-closed)

### Forbidden direct reads (enforced by future PR#14b static-source sweep + SQL allowlist)

- `accepted_events`
- `rejected_events`
- `ingest_requests`
- `session_features`
- `session_behavioural_features_v0_2`
- `stage0_decisions`
- `risk_observations_v0_1`
- `scoring_output_lane_a`
- `scoring_output_lane_b`
- `site_write_tokens`
- Any customer output / report table
- Any AMS-owned table (read or write)

### Stage 0 carry-through

PR#14b uses Stage 0 carry-through via POI / POI Sequence fields
already on PR#11c / PR#12d schema (`stage0_excluded`,
`poi_eligible`, `poi_sequence_eligible`). **No `stage0_decisions`
re-read.**

### No collector / SDK reads

Sprint 1 / Track A territory. PR#14a / PR#14b are evidence-bridge
layers, not evidence-producer layers.

---

## §8 Privacy boundary

PR#14a / PR#14b MUST honour:

- **No personal identification.** No `email`, `phone`, `person_id`,
  `visitor_id`, `company_id`, `domain_id`, `account_id`,
  `email_hash`, `person_hash`, `device_fingerprint`, `font_list`.
- **No deanonymisation.** No reverse lookup attempts.
- **No enrichment in the BuyerRecon bridge.** The bridge transforms
  durable evidence into AMS-compatible JSON; it never enriches.
  AMS Product Layer downstream may perform its own documented
  firmographic enrichment per its own MVP (50 ms circuit-breaker
  IP-to-company lookup, per AMS spec). PR#14b does not constrain
  AMS's downstream behaviour, and equally the BuyerRecon-side
  bridge does not import or invoke AMS enrichment.
- **No sensitive inference.** No demographic / protected-class
  inference.
- **No raw URLs or query strings.** Only normalised universal-
  surface labels.
- **Truncated session IDs only in reports.** Bridge candidate
  **SHOULD AVOID** carrying session IDs unless explicitly justified
  for internal traceability — see OD-4 below.
- **No customer-specific private scoring code.** All customer
  behaviour is versioned templates / mappings / configs.
- **Site mapping / config MUST remain versioned and
  non-leaky** into generic product logic.

### Bridge candidate field privacy

The bridge candidate payload should default to **session-anonymous**
shape. If Helen approves OD-4 with session traceability, the bridge
candidate MUST use truncated session prefixes (`prefix(8)…suffix(4)`)
or a session-hash, **never** the full session ID.

---

## §9 Output boundary

PR#14a is planning only — produces this document, nothing else.

PR#14b output, when later implemented, is **internal-only** until a
separate later PR defines safe downstream use:

- **No customer-facing rendering.** No dashboard, report, or
  customer surface.
- **No automated sales action.**
- **No Lane A / Lane B writes.**
- **No Trust / Policy reads or writes.**
- **No `ProductDecision` minting** in BuyerRecon. `ProductDecision`
  is AMS-owned; PR#14b only produces the **input** payload.
- **No AMS Product Layer runtime execution.** PR#14b emits JSON;
  AMS Product Layer is a separate cross-repo concern.
- **No reason codes in AMS namespaces** (`FIT.*`, `INTENT.*`,
  `WINDOW.*` — see §10). PR#14b reasons, if any, live in a
  disjoint internal namespace (`pcf_*`, `bridge_*`,
  `product_context_*`).
- **No buyer-intent claim language.**
- **No customer-eligible signal** without a separate later PR
  passing Policy Pass 2 + Lane A gating per workflow truth file
  §17–§18.

---

## §10 AMS reserved-name guard (strengthened)

The reserved-name guard from PR#13a §17 carries forward to PR#14b
verbatim. **Future BuyerRecon bridge runtime MUST NOT redefine or
own any of these AMS canonical names** as TypeScript types,
classes, interfaces, enums, exported constants, top-level
identifiers, or JSON output keys at the type-defining level:

### Fit family
- `Fit`, `FitFeatures`, `FitResult`, `FitScore`, `FitConfidence01`
- `NonFitMarkers`, `HardSuppress`

### Intent family
- `Intent`, `IntentFeatures`, `IntentResult`, `IntentScore`
- `IntentState`

### Window family
- `Window`, `WindowFeatures`, `WindowResult`, `WindowState`
- AMS `WindowState` enum values: `in_window`, `approaching`,
  `too_early`. The word `dormant` overlaps coincidentally with
  PR#13a's `actionability_band` enum — namespace-disjoint, no
  runtime coupling.

### TRQ family
- `TRQ`, `TRQResult`, `TRQBand`, `TRQScore`, `TRQConfidence01`
- `RawTRQScore01`

### Product Layer contracts
- `ProductDecision`, `ProductFeatures`, `ProductScorerInput`,
  `ProductScorer`
- `BuyerReconConfig`, `BuyerReconProductFeatures`
- `RequestedAction`

### AMS reason-code namespaces
- `FIT.*`, `INTENT.*`, `WINDOW.*`

### What PR#14b MAY do

- **Docs**, **comments**, and **tests** MAY reference these names
  when explaining the AMS alignment boundary (e.g. "produces JSON
  shape compatible with `BuyerReconProductFeatures`").
- **JSON output KEY values** that AMS expects (lowercase: `fit`,
  `intent`, `window`) MAY appear in the emitted JSON because that
  is what AMS deserialises. These are **strings inside a JSON
  blob**, not TypeScript-level identifiers.
- **TypeScript runtime source** uses namespace-disjoint names:
  `product_features_namespace_candidate`, `bridge_payload_*`,
  `pcf_*`, `bridge_*`, `product_context_*`.

### Static-source enforcement (PR#14b)

PR#14b implementation tests MUST include a static-source sweep
(mirroring PR#12e Group J + PR#13b Group I) that fails the build
if any reserved name appears as a TypeScript identifier in PR#14b
runtime source. Comments stripped before the sweep.

---

## §11 Validation strategy for future PR#14b

PR#14b implementation tests SHOULD cover:

| Category | Test |
| --- | --- |
| **Pure mapper** | Same input → same output (byte-identical); no `Date.now()` / `Math.random()` |
| **Schema validation** | Bridge candidate has every required version field (§6); missing → reject |
| **Shape validation** | Top-level keys exactly `{ fit, intent, window, metadata, versions }`; any extra key → reject |
| **Reserved-name guard** | Static-source sweep over PR#14b runtime files; zero matches for any name in §10 |
| **No `FIT.*` / `INTENT.*` / `WINDOW.*` emission** | String-literal sweep; zero matches |
| **No raw-ledger SQL** | If PR#14b reads DB: SQL allowlist test; zero `FROM` against forbidden tables |
| **No DB writes** | Static-source sweep for `INSERT INTO` / `UPDATE ... SET` / `DELETE FROM` / DDL; zero matches |
| **Malformed input** | Invalid POI rows / invalid PR#13b preview → reject as row-level (mirrors PR#13b `invalid_evidence_refs`), never crash |
| **Determinism** | Two runs over the same fixture produce byte-identical payloads |
| **Privacy** | No full session IDs in payload; no raw URLs; no secrets; truncation/masking at the boundary |
| **Internal-only label** | Payload sample carries `internal_only: true` + `non_authoritative: true` + `must_not_be_treated_as_ams_runtime_output: true` |
| **AMS reference compatibility** | Generated payload's top-level JSON shape matches AMS adapter's expected `BuyerReconProductFeatures` JSON keys (lowercase `fit` / `intent` / `window`). **Read-only check** — does not import AMS runtime. |
| **Stage 0 carry-through** | Stage 0-excluded sessions in payload are marked carry-through, never invented |
| **OD-14 carry-through** | Evidence_refs validation (PR#12c OD-14) inherited; lower-layer refs rejected if PR#14b inspects them |

---

## §12 PR#14b implementation options

Five options, ordered from least invasive to most. Helen picks via
OD-1.

### Option A — Docs-only contract hardening

**Scope.** Extend `docs/architecture/buyerrecon-workflow-locked-v0.1.md`
and add a `docs/sprint2-pr14b-*` planning continuation with the
concrete v0.1 JSON Schema for `product_features_namespace_candidate`.
No code. No DB. No runtime.

| Aspect | Detail |
| --- | --- |
| Source reads | None |
| Outputs | Doc only (JSON Schema / TypeScript interface in code blocks for spec) |
| Pros | Lowest risk; lets cross-repo Trust / Policy contract design proceed against a stable bridge JSON Schema before any code lands |
| Risks | Spec drift between planning and eventual implementation; mitigated by Codex review |
| Validation | Codex review; no DB; no runtime tests |
| When Helen chooses | When the right next move is to stabilise the JSON Schema before writing any code. Suitable when AMS-side bridge work is also in planning phase. |

### Option B — Pure TypeScript bridge-shape mapper only (recommended baseline)

**Scope.** `src/scoring/ams-product-features-bridge/{types,mapper,index}.ts`.
Pure functions; no DB import. Takes the PR#13b observer's
per-session preview output (or, alternatively, raw POI / POI
Sequence rows — see OD-2) and emits a `product_features_namespace_candidate`
JSON object in memory. No CLI. No table. No AMS runtime.

| Aspect | Detail |
| --- | --- |
| Source reads | None (pure functions; runtime callers supply inputs) |
| Outputs | TypeScript object → `JSON.stringify` for emit |
| Pros | Replay-testable in unit tests with stub inputs; zero DB risk; mirrors PR#10 POI Core Input shape (contract + adapter); smallest safe step |
| Risks | No staging proof against real evidence rows; limits ability to spot real-data edge cases until a follow-up observer/worker PR |
| Validation | Vitest unit tests (shape + version-stamp completeness + privacy posture + determinism) — no DB / Hetzner proof |
| When Helen chooses | When the right next move is a contract + algorithm validated by deterministic unit tests, before any observer wiring. **Recommended default if Helen wants algorithmic safety first.** |

### Option C — Read-only bridge candidate observer CLI

**Scope.** `src/scoring/ams-product-features-bridge-observer/*` + a
CLI + npm script (e.g. `observe:ams-bridge-candidate`). Reuses
PR#13b mapper OR reads POI / POI Sequence directly (Helen OD-2).
Emits internal `product_features_namespace_candidate` samples to
stdout as markdown + JSON. **No durable table; writes nothing.**

| Aspect | Detail |
| --- | --- |
| Source reads | `poi_observations_v0_1`, `poi_sequence_observations_v0_1`, `information_schema`; or PR#13b observer output reused |
| Outputs | Markdown report (mirrors PR#13b style) with embedded JSON `product_features_namespace_candidate` sample |
| Pros | Proves the algorithm against real staging data without DB risk; surfaces real-data edge cases before any durable / cross-repo commitment; mirrors observer-first cadence (PR#11b → PR#11c → PR#11d, PR#12b → PR#12d → PR#12e, PR#13b) |
| Risks | Profile loading needs a contract decision (fixture vs. future profile store) — same trade-off as PR#13b |
| Validation | Vitest stub-client tests + Hetzner staging proof |
| When Helen chooses | When the right next move is to prove the bridge JSON shape against real staging evidence before any cross-repo or durable commitment. Mirrors the PR#13b proof cadence. **Strong default if Helen wants a Hetzner-observable proof step like PR#13b.** |

### Option D — Cross-repo AMS compatibility fixture

**Scope.** BuyerRecon-side: emit a fixture JSON file (e.g. via
Option B mapper exporting a deterministic fixture). AMS-repo-side
(separate AMS PR): write a read-only validator test in AMS Go that
deserialises the fixture into `BuyerReconProductFeatures` via the
canonical AMS adapter, and asserts shape compatibility.

| Aspect | Detail |
| --- | --- |
| Source reads | BuyerRecon: PR#13b output / POI / POI Sequence. AMS: the BuyerRecon-emitted fixture file. |
| Outputs | BuyerRecon: fixture JSON in `tests/fixtures/` or similar. AMS: a Go test that ingests it. |
| Pros | Cross-repo compatibility proof; catches AMS adapter / BuyerRecon shape drift early; lets AMS-side contract changes be detected at AMS PR time |
| Risks | Requires separate AMS PR discipline and repo coordination; two-repo change cadence; harder to roll back coherently |
| Validation | BuyerRecon unit tests (Option B-level) + AMS Go unit test (separate PR) |
| When Helen chooses | After Option B or C has proved the shape internally and there is a need for AMS-side acceptance before runtime integration. Good for the step BEFORE Option E. |

### Option E — Actual bridge runtime

**Scope.** Wire BuyerRecon-side bridge output to AMS Product Layer
runtime (whether by direct package import once cross-repo bridging
is set up, or by inter-process JSON exchange). AMS executes
`Fit` / `Intent` / `Window` / `TRQ` against the bridge payload and
returns `ProductDecision`.

| Aspect | Detail |
| --- | --- |
| Source reads | Cross-repo. BuyerRecon owns the BuyerRecon-side; AMS owns the AMS-side. |
| Outputs | AMS `ProductDecision` (consumed by Trust + Policy downstream — out of PR#14 scope). |
| Pros | Closes the evidence → decision loop. |
| Risks | Largest blast radius. Cross-repo runtime coupling. Rollback non-trivial. Premature without A/B/C/D proof. Likely needs Trust / Policy / Lane A/B gating PRs to land first. |
| Validation | Full Hetzner staging proof + AMS staging proof + Trust / Policy / Lane A/B gating proof + Helen-locked customer-facing copy review. |
| When Helen chooses | Only after Option B AND (Option C OR Option D) have proved the contract, and after a separate Policy Pass 2 + Lane A/B gating PR has defined safe customer-eligible surfaces. **NOT recommended as the first PR#14b step.** |

### Recommended default

**Option B or Option C.**

- **Option B** if the priority is the smallest safe step: pure TS
  mapper, unit-tested, no DB risk, no Hetzner proof needed.
- **Option C** if the priority is a Hetzner-observable internal
  proof similar to PR#13b: bridge candidate observer CLI, real
  staging evidence, mirrors the proven observer-first cadence.

**Option D** is a sensible step BETWEEN Option C and Option E once
the BuyerRecon-side proof is stable.

**Option E** is NOT recommended for the next PR. Wait for at least
B/C proof; ideally B → C → D before E.

**Option A** stays available if Helen wants more contract
hardening before any code.

---

## §13 OD list for Helen

| # | Open decision | Recommended |
| --- | --- | --- |
| **OD-1** | PR#14b default option: A, B, C, D, or E? | **Option B** (pure TS mapper) or **Option C** (read-only observer CLI). Lean **C** if Helen wants Hetzner-proven shape. Lean **B** if smallest-safe step. |
| **OD-2** | Should bridge candidate be generated from PR#13b preview object, or directly from POI / POI Sequence evidence? | **From PR#13b preview** for Option B (pure transformation; smaller blast radius). **From POI / POI Sequence directly** for Option C if Helen wants the bridge observer to be independent of the PR#13b CLI. |
| **OD-3** | Exact bridge payload top-level name? | `product_features_namespace_candidate` (clear it's a candidate, not the canonical AMS contract). |
| **OD-4** | Should session traceability be allowed in bridge candidate? If so, truncated / session-hash only? | **NO session_id in payload by default.** If Helen approves, **truncated prefix only** (`sess_aaaaaaaa…2222`) — never the full ID. |
| **OD-5** | Should bridge payload include `category_template` and `sales_motion` directly? | **YES** — both are context inputs the AMS Product Layer needs to interpret `actionability_band` and `surface_distribution`. |
| **OD-6** | Should `buying_role_lens` remain deferred? | **YES** — defer to a follow-up PR per PR#13a OD-9. Bridge payload carries `buying_role_lens_version: 'brl-v0.1-deferred'` as a placeholder. |
| **OD-7** | Should AMS compatibility be proven in BuyerRecon only, or with a separate AMS fixture PR? | **BuyerRecon-only for PR#14b** (Option B or C). Reserve **Option D (AMS fixture PR)** for a later step. |
| **OD-8** | Should any durable BuyerRecon-side table be explicitly forbidden until AMS consumes the namespace payload? | **YES** — explicit prohibition until AMS has actually consumed bridge output. AMS expects JSON under `ProductFeatures.Namespace`, not a BuyerRecon-side durable layer. A future PR can revisit if a real consumer use-case demands it. |
| **OD-9** | Should downstream enrichment remain AMS-only? | **YES** — BuyerRecon bridge does no enrichment; AMS Product Layer downstream may per its own MVP. |
| **OD-10** | Minimum proof required before any bridge runtime execution (Option E)? | At minimum: Option B PASS + Option C PASS + Option D PASS (cross-repo AMS fixture validates) + a separate Policy Pass 2 + Lane A/B gating PR landing + Helen-locked customer-facing copy review. |
| **OD-11** | Should PR#14b emit `actionability_band` directly as a payload field, or only as a `window`-namespaced JSON sub-block? | **As a `window`-namespaced field** (`payload.window.actionability_band`) for cleanest AMS-shape alignment without claiming AMS-runtime semantics. |
| **OD-12** | Should bridge candidate carry `evidence_refs` proof tokens (e.g. POI observation IDs) for downstream audit? | **YES, but in a dedicated `evidence_provenance` sub-block** — never inside `fit`/`intent`/`window`. Direct POI ref shape only (OD-14 from PR#12c carries forward). |
| **OD-13** | Should PR#14b reasons be in a disjoint `pcf_*` / `bridge_*` namespace? | **YES** — strictly disjoint from AMS `FIT.*` / `INTENT.*` / `WINDOW.*`. Mirrors PR#13a OD-13. |
| **OD-14** | Should `freshness_decay_model_version` and `timing_window_model_version` be carried per-payload, or only on the run metadata? | **Both** — per-payload for byte-replay determinism, and on run metadata for operator triage. |
| **OD-15** | Should the bridge candidate carry a `preview_metadata` block (mirroring PR#13b)? | **YES** — `non_authoritative: true`, `internal_only: true`, `alignable_with_ams_product_features_namespace: true`, `must_not_be_treated_as_ams_runtime_output: true`. |

---

## §14 Acceptance criteria for PR#14a

This PR is complete when:

1. ✓ `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md`
   exists and covers §1–§15 of this structure.
2. ✓ Codex re-review returns PASS (or PASS WITH NON-BLOCKING NOTES,
   patched docs-only before sign-off).
3. ✓ Helen signs off OD-1..OD-15.
4. ✓ The doc names every reserved AMS Product Layer + AMS Series
   Core canonical name in "MUST NOT mint / MUST NOT redefine"
   context only — never as a duplicate BuyerRecon runtime
   implementation.
5. ✓ The doc names every forbidden source table explicitly.
6. ✓ The doc names every forbidden output (customer-facing, Trust,
   Policy, Lane A/B, AMS `ProductDecision`, AMS scoring reason
   codes in shared namespaces).
7. ✓ The doc commits to no implementation in PR#14a.
8. ✓ The doc frames the bridge as PLANNING ONLY — no AMS runtime
   integration, no `ProductDecision`, no customer output.
9. ✓ The doc distinguishes PR#13b preview, future bridge candidate,
   and AMS canonical contract as three separate concepts.
10. ✓ The doc defines source / privacy / output boundaries.
11. ✓ The doc defines five PR#14b options (A–E) with scope / source
    reads / outputs / pros / risks / validation / when-to-choose.
12. ✓ The doc defines a 15-entry OD list for Helen.
13. ✓ Commit + push on `sprint2-architecture-contracts-d4cc2bf` after
    sign-off.
14. ✓ Working tree clean post-push; only this doc changed.
15. ✓ No code, no `package.json`, no migration, no `schema.sql`, no
    DB, no `psql`, no Render, no AMS repo change at any point in
    PR#14a.

---

## §15 Suggested Codex review checklist

Codex should verify:

- ✅ **Scope safety** — docs-only; no code / `package.json` /
  migration / `schema.sql` / DB / `psql` / Render / AMS repo touched
- ✅ **AMS alignment** — explicitly acknowledges AMS canonical
  BuyerRecon Product Layer (PR#13a §2.1) and does NOT position
  PR#14b as a duplicate or replacement
- ✅ **Source boundary** — names `poi_observations_v0_1` +
  `poi_sequence_observations_v0_1` + `information_schema` (+
  optional PR#13b output reuse) as the allowed inputs; every
  forbidden table from PR#11d / PR#12d / PR#12e / PR#13b list is
  reiterated; raw ledger reads are explicitly forbidden
- ✅ **Privacy boundary** — no personal identification, no
  deanonymisation, no BuyerRecon-side enrichment; AMS-side
  enrichment is documented as a separate AMS-owned concern
- ✅ **Output boundary** — no customer-facing output, no Lane A/B,
  no Trust / Policy / `ProductDecision` minting in BuyerRecon, no
  AMS Product Layer runtime execution
- ✅ **AMS reserved-name guard** — repeats and strengthens PR#13a §17;
  PR#14b runtime MUST NOT mint Fit / Intent / Window / TRQ /
  ProductDecision / ProductFeatures / ProductScorerInput /
  ProductScorer / BuyerReconConfig / BuyerReconProductFeatures /
  RequestedAction / NonFitMarkers / HardSuppress / IntentState /
  AMS `WindowState` values (`in_window`, `approaching`,
  `too_early`); `FIT.*` / `INTENT.*` / `WINDOW.*` reason-code
  namespaces remain reserved
- ✅ **No duplicate Product Layer** — PR#14b is a bridge INPUT
  payload, not a re-implementation of AMS Fit / Intent / Window /
  TRQ / ProductDecision
- ✅ **No customer output** — bridge candidate is internal-only;
  carries `preview_metadata.non_authoritative = true` etc.
- ✅ **No premature durable table** — OD-8 reaffirms the prohibition
  until AMS consumes the namespace payload
- ✅ **PR#14b option clarity** — five options (A–E) each scoped with
  pros / risks / validation; recommended default (Option B or C)
  is documented but not forced
- ✅ **Replay / rollback semantics** — every per-payload version
  field listed; byte-identical replay requirement stated; no
  `Date.now()` / `Math.random()` inside pure mapper
- ✅ **Coincidental `dormant` overlap** — PR#13a / PR#13b's
  `actionability_band.dormant` is namespace-disjoint from AMS
  `WindowState.dormant`; bridge candidate field name
  (`actionability_band`) makes the disjointness explicit
- ✅ **OD list completeness** — 15 ODs cover option choice, input
  source, naming, session traceability, context fields, role lens
  deferral, AMS fixture timing, durable table prohibition,
  enrichment ownership, Option-E prerequisites, payload structure,
  evidence provenance, reason-code namespace, version-stamp
  placement, preview metadata
- ✅ **Acceptance criteria** are testable / falsifiable

---

**End of PR#14a planning document.**
