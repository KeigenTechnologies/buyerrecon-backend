# Sprint 2 PR#14b — ProductFeatures-Namespace Bridge Mapper (Option B)

**Status.** IMPLEMENTATION. Pure TypeScript mapper / validator per
PR#14a §12 Option B. Helen sign-off OD-1..OD-15 (PR#14a, commit
`982e90e`) implemented here. **No DB, no SQL, no CLI, no package
script.**

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — workflow
  truth file; §10 + §23 AMS Series Core guard, §11–§14 PCF / Timing
  scope.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md`
  (Helen OD-1..OD-15, commit `982e90e`) — §4 three-name discipline,
  §5 field-mapping plan (+ JSON-casing note), §6 versioning, §10
  reserved-name guard, §11 validation strategy, §12 Option B.
- `docs/sprint2-pr13b-product-context-timing-observer.md`
  (impl `e20ad7b`, Hetzner-PASS `469b203`) — preview-shape source.
- AMS read-only references: `BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0`,
  `internal/contracts/features.go`, `internal/products/buyerrecon/adapter/feature_adapter.go`.

---

## §1 Files in this PR

| Path | Purpose |
| --- | --- |
| `src/scoring/product-features-namespace-bridge/types.ts` | Frozen-literal version stamps, reserved-name allowlists, `BridgeMapperInput`, `BridgeNamespaceCandidate`, `ValidateResult` |
| `src/scoring/product-features-namespace-bridge/validate.ts` | Pre-mapper `validateBridgeMapperInput` + post-mapper `validateBridgeCandidate` (defence-in-depth recursive scans) |
| `src/scoring/product-features-namespace-bridge/mapper.ts` | Pure `buildBridgeNamespaceCandidate(input)` with sorted/frozen output; two-stage validation |
| `src/scoring/product-features-namespace-bridge/index.ts` | Public re-exports |
| `tests/v1/product-features-namespace-bridge.test.ts` | 21-requirement coverage (Groups A–V) |
| `docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md` | This implementation doc |

**No changes** to: `package.json`, migrations, `schema.sql`, DB,
`scripts/`, CLI wiring, PR#13b observer code, AMS repo.

---

## §2 Source boundary

The mapper is **pure** and reads its input from an explicit
in-memory `BridgeMapperInput` object passed by the caller. It does
NOT read:

- POI / POI Sequence tables (no DB import)
- Raw ledgers (no `accepted_events` / `rejected_events` / `ingest_requests`)
- `session_features` / `session_behavioural_features_v0_2` / `stage0_decisions`
- `risk_observations_v0_1` / `scoring_output_lane_a` / `scoring_output_lane_b`
- `site_write_tokens`
- `process.env`
- Filesystem
- Network / HTTP

**Caller responsibility.** The caller (a future test fixture, a
future PR#14c observer CLI if Helen approves, or a future bridge
runtime) is responsible for shaping a valid `BridgeMapperInput`
from PR#13b's preview output or any equivalent upstream source.

---

## §3 Mapper / validator behaviour

### Entry point — `buildBridgeNamespaceCandidate(input)`

Two-stage pipeline:

1. **Pre-mapper validation** via `validateBridgeMapperInput(input)`.
   Reasons returned as `string[]`; empty array = OK. Catches:
   - Missing or empty version-stamp fields
   - Non-array `source_poi_*_versions`
   - Missing `category_template` / `primary_conversion_goal` / `sales_motion`
   - Invalid `surface_distribution` shape OR unknown surface labels
     outside the v0.1 taxonomy (PR#13a §4.2)
   - `mapping_coverage_percent` outside `[0, 100]` or non-finite
   - Negative / fractional counts (`poi_count`, `unique_poi_count`,
     `unknown_surface_count`, `excluded_surface_count`,
     `progression_depth`)
   - `unique_poi_count > poi_count`
   - Non-boolean signals
   - `hours_since_last_qualifying_activity_or_null` not null and not
     a finite non-negative number
   - `buyerrecon_actionability_band` not in the v0.1 6-value enum

2. **Mapper** assembles the `BridgeNamespaceCandidate` deterministically:
   - Top-level version stamps copied from input
   - `source_evidence_versions` sub-block built from sorted, frozen
     copies of each `source_poi_*_versions` array
   - `payload_candidate` with three frozen sub-blocks:
     `fit_like_inputs` / `intent_like_inputs` / `timing_like_inputs`
   - Maps inside the payload (`surface_distribution`,
     `conversion_proximity_indicators`) sorted by key + frozen
   - `preview_metadata` literal `true` flags
   - `ams_product_layer_reference_version` defaults to
     `'BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0'` if input omits

3. **Post-mapper validation** via `validateBridgeCandidate(candidate)`.
   Defence-in-depth recursive scans:
   - Every top-level required version stamp present
   - `namespace_key_candidate === 'buyerrecon'`
   - `source_evidence_versions.{poi_observation_versions, poi_input_versions, poi_sequence_versions}` all string arrays
   - Every `preview_metadata` flag literally `true`
   - Payload sub-block shape correctness
   - **Recursive key scan** rejects any key matching the AMS
     reserved type list (`Fit`, `FitFeatures`, ..., `RequestedAction`,
     plus lowercase `fit` / `intent` / `window`)
   - **Recursive key scan** rejects any key matching the PII /
     enrichment / raw-URL / score / Lane / Trust / Policy /
     `session_id` forbidden list
   - **Recursive string-value scan** rejects any value matching the
     `^(FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*$` AMS reason-code
     namespace pattern

Output discriminated union:

```ts
type ValidateResult =
  | { ok: true;  candidate: BridgeNamespaceCandidate }
  | { ok: false; reject_reasons: readonly string[] };
```

### Output shape (top-level keys, in fixed order)

```
bridge_contract_version
bridge_payload_version
generated_from_observer_version
product_context_profile_version
universal_surface_taxonomy_version
category_template_version
buying_role_lens_version
site_mapping_version
excluded_mapping_version
timing_window_model_version
freshness_decay_model_version
source_evidence_versions {
  poi_observation_versions [sorted]
  poi_input_versions       [sorted]
  poi_sequence_versions    [sorted]
}
ams_product_layer_reference_version
namespace_key_candidate    ("buyerrecon")
payload_candidate {
  fit_like_inputs {
    surface_distribution  [sorted Record<UniversalSurface, int>]
    mapping_coverage_percent  (0..100)
    unknown_surface_count
    excluded_surface_count
    category_template
    site_mapping_version
  }
  intent_like_inputs {
    poi_count
    unique_poi_count
    pricing_signal_present
    comparison_signal_present
    conversion_proximity_indicators  [sorted Record<allowed-key, int>] — keys constrained by ALLOWED_CONVERSION_PROXIMITY_INDICATORS
  }
  timing_like_inputs {
    hours_since_last_qualifying_activity_or_null  (null | finite >= 0)
    buyerrecon_actionability_band  (one of 6 v0.1 bands)
    timing_bucket
    progression_depth
    freshness_decay_model_version
    sales_motion
    primary_conversion_goal
  }
}
preview_metadata {
  internal_only:                                            true
  non_authoritative:                                        true
  not_customer_facing:                                      true
  does_not_execute_ams_product_layer:                       true
  does_not_create_product_decision:                         true
  exact_ams_struct_compatibility_unproven_until_fixture:    true
}
```

### Determinism

- No `Date.now()`, no `new Date()`, no `Math.random()`, no `crypto`
  anywhere in `mapper.ts` / `validate.ts` (test Group R enforces).
- Same input → byte-identical output (test Group P enforces).
- Map keys sorted alphabetically before output assembly.
- String arrays sorted before output assembly.

### Privacy

- `session_id` is in the `FORBIDDEN_PII_KEYS` list — appears as any
  key at any depth in the candidate → reject (test Group O).
- 21 forbidden-PII keys swept recursively (test Group N).
- 23 forbidden AMS reserved type names swept recursively (test
  Group L).
- AMS reason-code namespace values (`FIT.*` / `INTENT.*` /
  `WINDOW.*`) swept recursively (test Group M).

---

## §4 AMS reserved-name guard (PR#14a §10 carry-through)

PR#14b runtime source MUST NOT define any of these as TypeScript
identifiers. **Test Group Q enforces** via a static-source sweep
over the 4 runtime files.

- Fit family: `Fit`, `FitFeatures`, `FitResult`, `FitScore`, `FitConfidence01`, `NonFitMarkers`, `HardSuppress`
- Intent family: `Intent`, `IntentFeatures`, `IntentResult`, `IntentScore`, `IntentState`
- Window family: `Window`, `WindowFeatures`, `WindowResult`, `WindowState`
- TRQ family: `TRQ`, `TRQResult`, `TRQBand`, `TRQScore`, `TRQConfidence01`
- Product Layer: `ProductDecision`, `ProductFeatures`, `ProductScorerInput`, `ProductScorer`, `BuyerReconConfig`, `BuyerReconProductFeatures`, `RequestedAction`
- Reason-code namespaces: `FIT.*`, `INTENT.*`, `WINDOW.*`

PR#14b naming convention:
- Top-level output type: `BridgeNamespaceCandidate`
- Payload sub-blocks: `fit_like_inputs`, `intent_like_inputs`,
  `timing_like_inputs`
- Frozen constants: `BRIDGE_CONTRACT_VERSION`,
  `BRIDGE_PAYLOAD_VERSION`, `NAMESPACE_KEY_CANDIDATE`

---

## §5 AMS JSON casing / struct compatibility

Per PR#14a §5 closing note: **exact AMS JSON field casing and Go
struct compatibility are UNPROVEN until Option D (cross-repo AMS
fixture) or an equivalent AMS-adapter-side validator proves them.**

Every PR#14b candidate carries
`preview_metadata.exact_ams_struct_compatibility_unproven_until_fixture
= true`. The bridge candidate is **internal-only**; nothing in
PR#14b authorises handing the candidate to AMS Product Layer at
runtime. Helen's Option-E gate (PR#14a §13 OD-10) defines the
minimum proof before any bridge runtime execution.

---

## §6 Rollback path

Forward-only at the file level. To revert PR#14b:

```bash
git rm -r src/scoring/product-features-namespace-bridge
git rm tests/v1/product-features-namespace-bridge.test.ts
git rm docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md
```

**No DB rollback needed.** PR#14b introduces no migration, no
schema change, no DB writes, no `package.json` script.

---

## §7 PR checklist (workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Bridge layer / pure TS mapper between PR#13b preview shape and AMS-compatible JSON candidate (PR#14a §12 Option B) |
| **Allowed source tables** | None (pure mapper; reads `BridgeMapperInput` only) |
| **Forbidden source tables** | All — bridge module has no DB / pg / SQL imports (test Group S enforces) |
| **Customer-facing or internal-only** | Internal-only; `preview_metadata` flags all literal `true` |
| **Score / verdict / reason-code allowed?** | Forbidden — bridge candidate emits NO Fit/Intent/Window/TRQ scores; recursive value-scan rejects AMS `FIT.*` / `INTENT.*` / `WINDOW.*` reason codes |
| **DB writes** | None |
| **Observer-first or durable table** | Neither — pure mapper. PR#14c could wrap this in a read-only observer CLI if Helen approves; out of PR#14b scope. |
| **Version fields** | 12 top-level version stamps + 3-array source_evidence_versions sub-block + `bridge_contract_version` + `bridge_payload_version` |
| **Rollback path** | File-level removal only |
| **Codex review checklist** | Source allowlist (pure module), no-DB-imports guarantee (test Group S), AMS reserved-name guard (Group Q), no `Date.now` / `Math.random` (Group R), determinism (Group P), every required version field present (Group B), preview_metadata literal `true` (Group C), every forbidden category of input rejected (Groups D–O), PR#13b observer untouched (Group U) |

---

**End of PR#14b implementation documentation.**
