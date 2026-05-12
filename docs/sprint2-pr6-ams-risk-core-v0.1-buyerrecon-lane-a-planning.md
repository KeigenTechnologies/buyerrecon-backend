1. PR#6 is an evidence-layer upgrade, not a new scorer.
2. Existing AMS Risk / POI / Series / Trust / Policy algorithms remain authoritative.
3. risk_observations_v0_1 is RiskInputs-compatible evidence, not RiskOutput.
4. PR#6 emits no risk_index, verification_score, evidence_band, reason_codes, reason_impacts, triggered_tags, penalty_total, or action_recommendation.
5. scoring_output_lane_a remains later Policy Pass 1 / Lane A projection.
6. behavioural_risk_01 is a normalized input feature only. Do not call it a score.
7. BYTESPIDER_PASSTHROUGH is provenance/context only. Not Lane B, not declared-agent scoring.
8. No Lane A writes. No Lane B writes.
9. No collector/app/server/auth/product-adapter/AMS repo changes.
10. No Render production.
- Add Codex review result section:
  “Codex planning review: PASS WITH NON-BLOCKING NOTES”
- Add the two non-blocking notes explicitly:
  behavioural_risk_01 naming discipline
  BYTESPIDER_PASSTHROUGH provenance-only discipline

# Sprint 2 PR#6 — behavioural-pattern evidence + AMS Risk Core input upgrade (BuyerRecon Lane A) — planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation. No code, no migration, no `schema.sql` change, no
`psql`, no `package.json` change, no DB touch, no collector / app /
server / auth change. PR#1–PR#5 implementation files are referenced
read-only. The AMS repo is referenced read-only.

**Date.** 2026-05-12. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#5 committed) | `baa17f9793dd10b95ee143a7f237ad966b4f183e` |
| AMS repo path | `/Users/admin/github/keigentechnologies/ams` |
| AMS HEAD at review | `9bf4cc921629272b08e7287a9c216ad11d8c9609` (branch `main`) |
| Prior closed commits | PR#0 `d4cc2bf` · PR#1 `bea880d` · PR#2 `3d88177` · PR#3 `4318e02` · PR#4 `cc2ae4c` · PR#5 `baa17f9` |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing workflow)
- AMS `docs/algorithms/RISK_CORE_ALGORITHM_SPEC_v2.0.md`, `POI_CORE_*`, `SERIES_CORE_*`, `TRUST_CORE_*`, `BUYERRECON_PRODUCT_LAYER_*`
- AMS `internal/contracts/signals.go` — frozen `RiskInputs` / `RiskOutput` / `CommonFeatures`
- AMS `internal/adapters/adapters.go` — anti-corruption mapping pattern (`ToRiskInputs`, etc.)
- AMS `internal/products/buyerrecon/` — BuyerRecon product adapter (existing in Go)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K row PR#6 + §0.6 P-decisions
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules
- BuyerRecon prior planning + impl docs (PR#1–PR#5)

---

## §0 Helen architecture correction (locks the framing of this doc)

PR#6 is **NOT** a new standalone BuyerRecon scorer. PR#6 is **NOT** a
replacement for AMS Risk Core. The existing AMS workflow remains the
governing architecture and PR#6 must preserve and upgrade existing
assets, not replace them.

The governing AMS workflow is:

```
Evidence layer
  → gate low-quality traffic
  → shared Risk / POI / Series cores
  → product layer: product fit + timing
  → Policy Pass 1
  → Trust Core
  → Policy Pass 2
  → report / output
```

Definitions Helen has locked for this round:

- **`risk_observations_v0_1`** = finer-grained **behavioural-pattern
  risk observation** layer in BuyerRecon. **Evidence-layer artefact.**
  AMS-Risk-Core-**input**-compatible (mirrors the `RiskInputs` /
  `CommonFeatures` shape the existing AMS Risk Core consumes via
  `internal/adapters/adapters.go.ToRiskInputs`). **Not a Risk Core
  output. Not a score. Not a reason-code emission.**
- **`scoring_output_lane_a`** = much-later **Policy Pass 1 /
  Lane A projection** after shared Risk / POI / Series cores AND
  product-layer fit + timing have all run. **PR#6 does NOT write
  `scoring_output_lane_a`.** A separate later PR (Policy / projection
  layer) owns that table.

Layer-by-layer ownership in this round:

| Layer | Owner | PR#6 touches? |
| --- | --- | --- |
| Evidence layer (factual features) | BuyerRecon backend (PR#1 + PR#2) | reads (read-only) |
| Evidence layer (behavioural-pattern evidence) | **BuyerRecon backend — PR#6 ships this** | **writes** `risk_observations_v0_1` |
| Gate low-quality traffic | BuyerRecon backend (PR#5 `stage0_decisions`) | reads (read-only; eligibility filter) |
| Shared Risk Core | AMS (existing `internal/riskcore/`) | NO — AMS owns risk semantics |
| Shared POI Core | AMS (existing `internal/poicore/`) | NO |
| Shared Series Core | AMS (existing `internal/seriescore/`) | NO |
| Product layer (Fit + Intent + Window + TRQ + Action) | AMS (existing `internal/products/buyerrecon/scorer/`) | NO |
| Policy Pass 1 (Lane A projection) | AMS (existing `internal/policy/pass1.go`) | NO — owns the future `scoring_output_lane_a` writer |
| Trust Core | AMS (existing `internal/trustcore/`) | NO |
| Policy Pass 2 (final runtime decision) | AMS (existing `internal/policy/pass2.go`) | NO |
| Report / output | AMS (existing `internal/products/buyerrecon/output/`) | NO |

PR#6 occupies **one slot** in the evidence layer — it adds finer
behavioural-pattern observations that the existing AMS Risk Core
(and downstream cores) can consume.

---

## §1 PR#6 purpose

PR#6 is the **behavioural-pattern evidence and risk-input upgrade**
for the existing AMS Risk Core pathway, contributed from the
BuyerRecon side.

Current scope:

- Limited to Lane A invalid-traffic / non-buyer-motion behavioural
  evidence. (Lane B declared-agent evidence remains deferred to
  PR#3b; PR#6 does not touch Lane B.)
- **RECORD_ONLY** (CHECK `record_only IS TRUE` enforced at DB layer;
  PR#4 `assertScoringContractsOrThrow` re-asserts
  `automated_action_enabled === false` at worker boot).
- **Internal only** (`buyerrecon_customer_api` has zero direct SELECT
  on `risk_observations_v0_1`).
- **No scoring.** PR#6 emits no `risk_index`, no `reason_codes`, no
  `reason_impacts`, no `triggered_tags`, no `penalty_total`. Those
  are AMS Risk Core's `RiskOutput` fields; AMS owns them.
- **No reason-code emission.** PR#6 emits `tags` (ContextTags — short
  neutral labels) only. Reason codes are downstream concerns.
- **No product-layer logic.** Fit / Intent / Window / TRQ / Action
  / Encode is AMS's BuyerRecon product layer scorer (existing). PR#6
  is upstream of that.

What PR#6 **does** ship:

1. A pure TypeScript **normalisation adapter** that maps PR#1 + PR#2
   derived behavioural facts into the AMS `RiskInputs` /
   `CommonFeatures.BehavioralRisk01` shape.
2. A **DB worker** that filters Stage-0-non-excluded sessions, runs
   the adapter, and persists one `risk_observations_v0_1` row per
   eligible session (idempotent upsert).
3. A new **`risk_observations_v0_1`** table (the evidence-layer
   destination).
4. Tests + verification SQL + implementation doc.

PR#6 is the *exact integration adapter* the AMS Risk Core algorithm
spec already anticipated (`internal/riskcore/engine.go:14-21` — the
known integration TODO that `BehavioralRisk01` enters via an
upstream adapter that maps `CommonFeatures` into the Risk Core call).

---

## §2 A0 / AMS alignment

### §2.1 A0 §K row PR#6 — verbatim

> | **PR#6** | Stage 1 scoring scaffold (pure-function) | Vendor
> `lib/stage1-behaviour-score.js`; `score_run` writer; `proof_bundle`
> JSONB; stamps `scoring_version` + `knob_version_id` | extends PR#3 |
> pure (130 vendored tests) + dbtest + replay determinism | **no** |

### §2.2 Helen architecture correction vs A0 §K wording

A0 §K calls PR#6 "Stage 1 scoring scaffold (pure-function)" and
references vendoring Track A's `lib/stage1-behaviour-score.js`. Per
Helen's correction in §0:

- **AMS already has strong Risk / POI / Series / Trust / Policy
  algorithms.** The existing AMS Risk Core, POI Core, Series Core,
  Trust Core, and Policy Pass 1 / Pass 2 stay. PR#6 does NOT
  reimplement them.
- "Stage 1 scoring scaffold" is reframed as **"behavioural-pattern
  evidence + risk-input upgrade"**. The behavioural facts Track A's
  `lib/stage1-behaviour-score.js` derived in isolation are now
  produced by BuyerRecon's PR#1 + PR#2 derived-feature layer;
  PR#6's adapter normalises them into the AMS Risk Core's expected
  input shape.
- "Score" terminology is removed from PR#6's surface. PR#6 does not
  compute a `verification_score`. The AMS Risk Core consumes PR#6's
  evidence and produces `RiskIndex` downstream.
- "Vendor `lib/stage1-behaviour-score.js`" remains relevant only as
  a *reference for the behavioural-feature semantics* (which PR#1 +
  PR#2 already captured). PR#6 does not re-vendor a scoring lib.

### §2.3 ADR alignment

- **ADR-001 Frozen contract discipline.** PR#6's output shape MUST
  conform to the existing `RiskInputs` / `CommonFeatures` typed
  fields the AMS Risk Core consumes (per
  `internal/contracts/signals.go`). No new typed fields invented on
  the BuyerRecon side that don't have a slot in those contracts.
- **ADR-002 Jury / Judge separation.** PR#6 is *jury* (evidence).
  Risk Core / POI / Series remain *jury cores*. Trust + Policy
  remain *judge*. PR#6 does not invoke any judge layer.
- **ADR-010 Adapters are anti-corruption boundaries.** PR#6 is *the
  BuyerRecon-side anti-corruption adapter* feeding the AMS pipeline.
  Dumb mapping; no scoring interpretation.
- **ADR-012 No untyped namespace escape hatch.** PR#6 uses typed TS
  shapes for inputs + outputs. No `Record<string, unknown>` on
  stable output boundaries.
- **ADR-015 Trust governance is a first-class reusable subsystem.**
  PR#6 does not compute trust.

### §2.4 Upgrade, not restart

PR#6 is an **upgrade** to the existing AMS architecture. It is **not**
a restart and not a replacement.

- The existing AMS Risk Core, POI Core, Series Core, Trust Core,
  Policy Pass 1, and Policy Pass 2 algorithms are **preserved
  unchanged**. PR#6 does not fork, shadow, port, or re-implement
  any of them.
- PR#6 does not throw away prior AMS architecture or algorithm
  assets. Years of deep-research work on AMS Risk / POI / Series /
  Trust / Policy semantics remain authoritative.
- This round of deep research upgrades **evidence granularity**
  (finer behavioural-pattern signals on the BuyerRecon side),
  **product-layer fit / timing evidence** (richer inputs for the
  existing AMS BuyerRecon product scorer), **policy explainability**
  (the new ContextTag layer surfaces reasons that downstream Policy
  Pass 1 / Pass 2 can cite), and **report evidence quality**
  (downstream product output can render finer evidence).
- PR#6 adds behavioural-pattern evidence **into** the existing Risk
  Core pathway — via the AMS-anticipated adapter slot recorded at
  `internal/riskcore/engine.go:14-21` (the `CommonFeatures.BehavioralRisk01`
  upstream adapter TODO).
- PR#6 does not redefine the whole AMS scoring process. It fits
  one slot — the evidence-input slot — and leaves every other slot
  untouched.

### §2.5 AMS pipeline diagram + PR#6 position

The governing AMS workflow, with PR#6's position marked:

```
Evidence layer
  → gate low-quality traffic                          ← PR#5 stage0_decisions
  → shared Risk / POI / Series cores                  ← existing AMS, unchanged
  → product layer: product fit + timing               ← existing AMS BuyerRecon product scorer
  → Policy Pass 1                                     ← existing AMS; writes scoring_output_lane_a here later
  → Trust Core                                        ← existing AMS, unchanged
  → Policy Pass 2                                     ← existing AMS, unchanged
  → report / output                                   ← existing AMS BuyerRecon product output
```

PR#6 sits at the transition from:

```
session_behavioural_features_v0_2 + stage0_decisions
        → behavioural risk observations / Risk Core input-compatible evidence
        (i.e. risk_observations_v0_1)
```

PR#6 produces the input that the existing AMS Risk Core consumes via
its adapter slot. PR#6 does NOT implement:

- POI (existing AMS `internal/poicore/`)
- Series (existing AMS `internal/seriescore/`)
- product fit / timing (existing AMS `internal/products/buyerrecon/scorer/`)
- Policy Pass 1 (existing AMS `internal/policy/pass1.go`; future
  writer of `scoring_output_lane_a`)
- Trust Core (existing AMS `internal/trustcore/`)
- Policy Pass 2 (existing AMS `internal/policy/pass2.go`)
- report / output (existing AMS `internal/products/buyerrecon/output/`)

Each of those slots is owned by AMS-side code that already exists.
PR#6 changes none of them.

### §2.6 Existing AMS Risk Core path PR#6 feeds into

`internal/riskcore/engine.go:14-21` records the open adapter
integration TODO verbatim:

> The algorithm spec (Formula 4, 4A) defines a runtime_comp sourced
> from CommonFeatures.BehavioralRisk01. This field is NOT in the
> frozen RiskInputs contract — it enters via an upstream adapter
> that maps CommonFeatures into the Risk Core call. Until the
> adapter/orchestration layer is implemented, runtime_comp = 0.0
> (neutral). This is a known integration TODO.

PR#6 is precisely that upstream adapter on the BuyerRecon side. The
deliverable is a `risk_observations_v0_1` row carrying the
RiskInputs-compatible payload (including `behavioural_risk_01`) the
Risk Core call needs. The actual Risk Core invocation lives in AMS
(or in a future BuyerRecon-side RPC / batch bridge — out of PR#6
scope).

---

## §3 Corrected data chain (governing flow)

```
[Evidence layer — factual]
  accepted_events / ingest_requests              (PR#10 collector)
    → session_features                            (PR#11; not read by PR#6 by default; gated by OD-7)
    → session_behavioural_features_v0_2 (v0.3)    (PR#1 + PR#2; PR#6's primary input)

[Gate low-quality traffic]
    → stage0_decisions                            (PR#5; eligibility filter — only `excluded = FALSE` rows continue)

[Evidence layer — behavioural risk observations]
    → risk_observations_v0_1                      ← PR#6 ships this (finer behavioural-pattern evidence; AMS-RiskInputs-compatible; one row per Stage-0-eligible session)

[Shared cores — AMS-owned, unchanged]
    → existing AMS Risk Core pathway              (`internal/riskcore/`; consumes risk_observations_v0_1 via adapter slot)
    → existing AMS POI Core                       (`internal/poicore/`)
    → existing AMS Series Core                    (`internal/seriescore/`)

[Product layer — AMS-owned, unchanged]
    → AMS BuyerRecon product layer                (existing `internal/products/buyerrecon/scorer/`: Fit + Intent + Window + TRQ + Action + Encode; produces ProductDecision)

[Policy Pass 1 — AMS-owned, unchanged]
    → Policy Pass 1 projection                    (existing `internal/policy/pass1.go`; **future writer target of `scoring_output_lane_a`**)

[Trust + Policy Pass 2 — AMS-owned, unchanged]
    → AMS Trust Core                              (existing `internal/trustcore/`; produces TrustDecisionV3)
    → AMS Policy Pass 2                           (existing `internal/policy/pass2.go`; produces RuntimeDecisionOutput)

[Report / output — AMS-owned, unchanged]
    → AMS BuyerRecon product output               (existing `internal/products/buyerrecon/output/`; evidence card, report)
```

Three rules that follow from this chain:

1. **PR#6 never writes `scoring_output_lane_a`.** That table is the
   Policy Pass 1 / Lane A projection's writer target. Owned by a
   later AMS-side or BuyerRecon-bridging PR — explicitly out of PR#6
   scope.
2. **PR#6 never writes Lane B.** Deferred PR#3b territory.
3. **PR#6 emits evidence only.** No risk_index, no reason_codes, no
   product decision, no trust state, no policy decision.

---

## §4 Proposed TypeScript interface shape (evidence-only)

TypeScript shapes that mirror the **inputs** the existing AMS Risk
Core consumes via its adapter. PR#6 exposes these as the public
surface of `src/scoring/risk-evidence/` (proposed path; OD-2).

### §4.1 `RiskInputsCompat` — RiskInputs-compatible evidence payload

```ts
// Mirrors AMS internal/contracts/signals.go RiskInputs + the
// BehavioralRisk01 slot on CommonFeatures (which enters Risk Core via
// the upstream adapter — see riskcore/engine.go:14-21).
export interface RiskInputsCompat {
  subject_id:           string;                  // BuyerRecon session_id (the AMS SubjectID slot)
  velocity:             Record<string, number>;  // per-metric rates (events/sec, pageview burst, etc.)
  device_risk_01:       number;                  // clamp [0,1]; 0 default (no SDK fingerprint in v1)
  network_risk_01:      number;                  // clamp [0,1]; 0 default in v1
  identity_risk_01:     number;                  // clamp [0,1]; 0 default in v1
  behavioural_risk_01:  number;                  // clamp [0,1]; the runtime_comp input (CommonFeatures.BehavioralRisk01)
  tags:                 readonly string[];       // ContextTags — short neutral behavioural labels
}
```

### §4.2 `RiskObservationRow` — persistence shape (evidence row)

```ts
export interface RiskObservationRow {
  // Natural-key components (mirrors PR#3 OD-10 / PR#5 5-column key)
  workspace_id:               string;
  site_id:                    string;
  session_id:                 string;
  observation_version:        string;   // e.g. 'risk-obs-v0.1'
  scoring_version:            string;   // mirror scoring/version.yml (currently 's2.v1.0')

  // RiskInputs-compatible payload (the evidence the Risk Core adapter consumes)
  velocity:                   Record<string, number>;       // JSONB object
  device_risk_01:             number;                       // NUMERIC(4,3); 0..1
  network_risk_01:            number;                       // NUMERIC(4,3); 0..1
  identity_risk_01:           number;                       // NUMERIC(4,3); 0..1
  behavioural_risk_01:        number;                       // NUMERIC(4,3); 0..1
  tags:                       string[];                     // JSONB array of UPPER_SNAKE_CASE labels

  // Provenance + minimisation (mirrors PR#5 OD-11 discipline)
  record_only:                true;                         // CHECK IS TRUE
  source_event_count:         number;                       // CHECK >= 0
  evidence_refs:              Array<{ table: string; [k: string]: unknown }>;
  created_at:                 string;                       // TIMESTAMPTZ
  updated_at:                 string;                       // TIMESTAMPTZ
}
```

**Critical absences** (these fields are NOT on the row by design):

- No `risk_index` (AMS Risk Core's `RiskOutput.RiskIndex` 0..100).
- No `reason_codes` (AMS Risk Core / product layer concerns).
- No `reason_impacts`.
- No `triggered_tags` (the *output* form — input `tags` are PR#6's
  responsibility; *triggered* tags come from Risk Core).
- No `penalty_total`.
- No `evidence_band`, `action_recommendation`, `verification_score`
  (those are `ProductDecision` / Policy Pass 1 projection fields).

### §4.3 BuyerRecon-side adapter (analogous to AMS `adapters.ToRiskInputs`)

```ts
// Pure mapping. NO scoring. NO interpretation. NO emission.
export function buyerreconBehaviouralToRiskInputs(
  sbf:    SessionBehaviouralFeaturesV0_3Row,   // PR#1 + PR#2 v0.3 row
  stage0: Stage0DecisionRowReadView,           // PR#5 row; precondition: excluded === false
): RiskInputsCompat;
```

The adapter normalises PR#1 + PR#2 fields into:

- `velocity` entries (e.g. `events_per_second: sbf.max_events_per_second`,
  `pageview_burst_count_10s: sbf.pageview_burst_count_10s`).
- `behavioural_risk_01` (a deterministic min-max normalisation of
  the behavioural facts the AMS Risk Core formula 4 / 4A weighs).
- `tags` (short UPPER_SNAKE_CASE ContextTags such as
  `REFRESH_LOOP_CANDIDATE` when `sbf.refresh_loop_candidate = TRUE`).
- `device_risk_01` / `network_risk_01` / `identity_risk_01` all `0`
  in v1 (BuyerRecon has no SDK fingerprint signal yet).

The adapter is a **dumb mapper**. It runs no scoring algorithm and
emits no reason codes. The `behavioural_risk_01` scalar is a
deterministic normalisation (well-defined min/max thresholds per
input feature) — not a learned score.

### §4.4 Pure normalisation function (the only non-trivial logic in PR#6)

```ts
export interface BehaviouralRiskNormalisationConfig {
  weights:   Record<string, number>;    // per-feature weights (sum to 1)
  thresholds: Record<string, { warn: number; hard: number }>; // per-feature warn/hard
}

export function normaliseBehaviouralRisk01(
  sbf: SessionBehaviouralFeaturesV0_3Row,
  cfg: BehaviouralRiskNormalisationConfig,
): number;   // returns a [0, 1] clamp
```

The normalisation mirrors AMS's `Formula 1` (warn/hard
normalisation per metric) + `Formula 2` (weighted aggregation —
NOT pure-max). Cfg lives in TypeScript constants under
`src/scoring/risk-evidence/normalisation-config.ts`. No external
config file at v0.1 (deferred until Helen sign-off on the weights
panel — OD-11).

---

## §5 ContextTag naming convention (replaces the previous reason-code namespace)

PR#6 emits no reason codes. The previous version of this planning
doc proposed a `RISK.<SUFFIX>` namespace; that section is withdrawn
under Helen's correction because PR#6 is not a Risk Core slice and
does not emit Risk Core outputs.

What PR#6 *does* emit is the `tags` array — short neutral labels
that the AMS Risk Core's tag-penalty stage may apply weights to.
Convention:

| Property | Rule |
| --- | --- |
| Shape | `UPPER_SNAKE_CASE`. No prefix namespace. Examples: `REFRESH_LOOP_CANDIDATE`, `HIGH_REQUEST_BURST`, `ZERO_FOREGROUND_TIME`, `NO_MEANINGFUL_INTERACTION_VIA_FORM`. |
| Cardinality cap | Maximum 16 tags per session at v0.1 (matches AMS's tag-penalty input shape). |
| Reusability | Tags must be product-neutral. No BuyerRecon-only domain language. |
| Forbidden namespaces | Tags MUST NOT match `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` reason-code prefixes from `scoring/reason_code_dictionary.yml`. Tags are not reason codes. |
| Forbidden words | Tags MUST NOT match patterns in `scoring/forbidden_codes.yml.hard_blocked_code_patterns.patterns` (e.g. `*_VERIFIED`, `*_CONFIRMED`, `BUYER_*`). |
| PR#4 wiring | PR#6 calls `assertScoringContractsOrThrow()` + `assertActiveScoringSourceCleanOrThrow()` at worker boot. PR#6 does NOT call `validateRuleReferences` (no reason codes). |

The initial tag enum (OD-12 below) is the only allowed set.

---

## §6 Stage 0 eligibility

**Default: skip excluded sessions.**

- PR#6 only writes `risk_observations_v0_1` rows for sessions where
  `stage0_decisions.excluded = FALSE` (i.e. PR#5 returned
  `rule_id = 'no_stage0_exclusion'`).
- Stage-0-excluded sessions (curl, headless_chrome, probe paths,
  high request-rate, attack-like patterns) are NOT mirrored. Their
  Stage 0 verdict is already the authoritative outcome for the gate
  step; running behavioural-pattern evidence collection over them
  contaminates the dataset.
- Bytespider / AI-crawler sessions (P-11 carve-out): PR#5 returns
  `excluded = FALSE` for them, so they flow into PR#6. The adapter
  emits a `BYTESPIDER_PASSTHROUGH` ContextTag (proposed OD-12) so
  downstream cores observe their declared-agent nature without PR#6
  needing to invent a Lane B writer.

The natural-key tuple for `risk_observations_v0_1` is
`(workspace_id, site_id, session_id, observation_version,
scoring_version)` — at most one row per Stage-0-non-excluded session
per `(observation_version, scoring_version)` tuple.

---

## §7 Allowed read sources

| Source | Default | Notes |
| --- | --- | --- |
| `stage0_decisions` (PR#5) | **YES (read-only)** | Eligibility gate. SELECT rows where `excluded = FALSE`. |
| `session_behavioural_features_v0_2` v0.3 (PR#1 + PR#2) | **YES (read-only)** | The primary evidence source. |
| `session_features` (PR#11) | **NO by default** | Unlocking requires Helen amendment. |
| `accepted_events` | **NO by default** | Extractor-layer concern (PR#1 / PR#5). PR#6 does not re-aggregate raw events. |
| `ingest_requests` | **NO** | UA / IP / request-level evidence is PR#5 Stage 0's territory. |
| `scoring_output_lane_a` / `_b` (PR#3) | **NO** | Lane tables are downstream; PR#6 is upstream. |
| `risk_observations_v0_1` (self) | **YES for idempotent upsert** | `ON CONFLICT DO UPDATE` requires self-conflict resolution. |
| `scoring/version.yml`, `reason_code_dictionary.yml`, `forbidden_codes.yml` via PR#4 loader | **YES** | Startup contract check only. |

---

## §8 Forbidden scope (hard boundaries)

PR#6 **must not**:

- Touch the collector (`src/collector/v1/**`) or its routes.
- Touch `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Modify any pre-existing migration (001..012).
- Read or write `scoring_output_lane_a` (Policy Pass 1 projection — owned by a later PR).
- Read or write `scoring_output_lane_b` (Hard Rule I + PR#3 OD-7).
- Compute or persist `risk_index` / `reason_codes` / `reason_impacts`
  / `triggered_tags` / `penalty_total` — those are AMS Risk Core
  `RiskOutput` fields.
- Compute or persist `verification_score`, `evidence_band`,
  `action_recommendation` — those are Policy Pass 1 / `ProductDecision`
  fields.
- Compute POI / Series / Trust outputs.
- Implement Fit / Intent / Window / TRQ / Action / Encode — those
  are AMS's BuyerRecon product-layer scorer (`internal/products/buyerrecon/scorer/`).
- Issue a final policy / trust / runtime decision.
- Emit `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` reason codes.
- Produce customer-facing output. `buyerrecon_customer_api` zero
  direct SELECT on `risk_observations_v0_1` (mirrors PR#3 OD-7 / PR#5).
- Take automated action. `scoring/version.yml.automated_action_enabled
  === false` re-asserted at worker boot.
- Persist raw `user_agent`, `ip_hash`, `token_hash`, `pepper`, bearer
  tokens, `Authorization` headers, raw payloads, raw request bodies,
  raw `canonical_jsonb`, raw `page_url`. OD-11 inherited from PR#5.
- Import ML libraries (`sklearn`, `xgboost`, `torch`, `onnx`,
  `lightgbm`). Hard Rule F.
- Touch Render production. A0 P-4 still blocking. Hetzner staging
  only.
- Modify PR#1 / PR#2 / PR#3 / PR#4 / PR#5 implementation files.
- Re-implement / fork / shadow the existing AMS Risk Core / POI
  Core / Series Core / Trust Core / Policy Pass 1 / Pass 2
  algorithms. The AMS implementations remain authoritative.

---

## §9 Tensions / blockers (refined under Helen's correction)

Most tensions from the earlier draft of this doc dissolve once
PR#6 is correctly framed as an evidence-layer upgrade (not a
Risk Core slice). The remaining ones:

| ID | Tension | Resolution under the corrected framing |
| --- | --- | --- |
| **G1** | A0 §K row PR#6 wording ("Stage 1 scoring scaffold (pure-function)") implies PR#6 emits a `verification_score`. | Helen's correction reframes PR#6 as evidence-layer-only. PR#6 emits no `verification_score`. The 0..99 vs 0..100 boundary mismatch dissolves because PR#6 emits no integer score at all. The `verification_score` column on the future `scoring_output_lane_a` is the Policy Pass 1 projection's concern, not PR#6's. |
| **G2** | Reason-code namespace mismatch (AMS `RISK.<SUFFIX>` vs BuyerRecon `A_*`). | Dissolves under corrected framing. **PR#6 emits no reason codes at all.** Tags are not reason codes. Both reason-code dictionaries continue to apply to *their respective downstream layers* (AMS Risk Core / AMS product layer / Policy Pass 1 projection). |
| **G3** | Mapping the 8 BuyerRecon behavioural fields into the AMS Risk Core's expected input shape. | The PR#6 adapter is exactly this map. Per `internal/riskcore/engine.go:14-21`, the AMS spec already anticipated an upstream adapter populating `CommonFeatures.BehavioralRisk01`. PR#6 fulfils that on the BuyerRecon side. |
| **G4** | AMS Risk Core is Go; BuyerRecon backend is TypeScript. | The TypeScript-Go boundary lives between `risk_observations_v0_1` (BuyerRecon DB) and the AMS Risk Core call site (AMS Go process or a future bridge). PR#6 does NOT cross the language boundary — it stops at the DB. How the AMS pipeline subsequently reads `risk_observations_v0_1` (read-replica, batch export, RPC) is a later integration decision. |
| **G5** | A0 §K "extends PR#3" wording vs. Helen's correction that `scoring_output_lane_a` is Policy Pass 1's destination. | **The solution is NOT to replace the existing AMS Risk Core.** The solution is to create `risk_observations_v0_1` as a finer-grained behavioural risk **evidence / Risk-Core-input-compatible** layer that **feeds the existing AMS Risk Core pathway**, while leaving `scoring_output_lane_a` for the later Policy Pass 1 projection writer. PR#6 introduces `risk_observations_v0_1` (NEW table). `scoring_output_lane_a` stays unwritten in PR#6 — it is the Policy Pass 1 projection's writer target. Helen's §0 + §2.4 "Upgrade, not restart" definition is the authority. |

---

## §10 Open decisions for Helen (defaults)

| OD | Question | Recommended default |
| --- | --- | --- |
| **D-1** | Architecture position | **Evidence-layer upgrade** for the existing AMS pipeline. PR#6 is the BuyerRecon-side anti-corruption adapter feeding the existing AMS Risk Core. Not a Risk Core slice. |
| **D-2** | PR title / commit framing | **"Sprint 2 PR#6: behavioural-pattern evidence + AMS Risk Core input upgrade (BuyerRecon Lane A)"**. RECORD_ONLY. |
| **D-3** | Destination table | **`risk_observations_v0_1`** (NEW table; evidence layer). NOT `scoring_output_lane_a` (that's the Policy Pass 1 projection's target, owned by a later PR). |
| **D-4** | Reason-code emission | **None.** PR#6 emits no reason codes. PR#4's `validateRuleReferences` is not invoked. |
| **D-5** | Score emission | **None.** No `risk_index`, no `verification_score`, no `evidence_band`, no `action_recommendation`. PR#6's only continuous-valued output is `behavioural_risk_01` (NUMERIC(4,3), 0..1) — a normalised input feature, not a score. |
| **D-6** | Stage 0 eligibility | **Skip excluded sessions.** Only `stage0_decisions.excluded = FALSE` rows flow into PR#6. |
| **D-7** | Input source policy | **`stage0_decisions` + `session_behavioural_features_v0_2` only.** No direct `accepted_events` / `ingest_requests` / `session_features` reads. |
| **D-8** | Confidence ceiling | **Not applicable to PR#6.** PR#6 emits no `evidence_band`. The downstream `evidence_band ∈ {low, medium}` ceiling lives on the Policy Pass 1 projection's `scoring_output_lane_a` row, not on `risk_observations_v0_1`. |
| **D-9** | Cross-language integration timing | **Deferred to a separate gate.** PR#6 stops at the DB. How AMS Risk Core (Go) reads `risk_observations_v0_1` (read-replica, batch export, RPC bridge) is a follow-on architecture decision after PR#6 + PR#7 + PR#8 ship and 2 weeks of Hetzner staging stability. |
| **D-10** | RECORD_ONLY + internal-only posture | **Yes.** CHECK `record_only IS TRUE`; `buyerrecon_customer_api` zero direct SELECT on `risk_observations_v0_1`. |
| **D-11** | **Upgrade-not-restart rule** | **PR#6 preserves existing AMS Risk / POI / Series / Trust / Policy algorithms and only adds finer-grained behavioural evidence into the Risk Core pathway.** No AMS-side code is replaced, forked, ported, or shadowed. PR#6 is additive at the evidence-input slot only. (Helen's foundational architectural rule for this round — see §0 and §2.4.) |
| **D-12** | `behavioural_risk_01` normalisation config | **TypeScript constants in `src/scoring/risk-evidence/normalisation-config.ts`** at v0.1. Per-feature warn/hard thresholds + weights. Externalised to YAML in a later PR if Helen wants knob-panel control. |
| **D-13** | Initial ContextTag enum | **Recommended starting set** (UPPER_SNAKE_CASE, ≤16): `REFRESH_LOOP_CANDIDATE`, `HIGH_REQUEST_BURST`, `ZERO_FOREGROUND_TIME`, `NO_MEANINGFUL_INTERACTION`, `JS_NOT_EXECUTED`, `SUB_200MS_TRANSITION_RUN`, `BEHAVIOURAL_CADENCE_ANOMALY`, `BYTESPIDER_PASSTHROUGH`. Each tag is emitted by a deterministic predicate in the adapter; no learned classification. Helen confirms / amends the set. |
| **D-14** | Row cardinality | **One row per (workspace_id, site_id, session_id, observation_version, scoring_version)**. Mirrors PR#5's 5-column natural-key discipline. |

All 14 ODs are load-bearing — Helen signs all 14 (or substitutes
explicit alternatives) before implementation begins. D-11 is the
foundational rule; the others are implementation specifics that
sit under it.

---

## §11 Test plan (planning only)

When PR#6 implementation ships, it includes the following test
surfaces (mirrors PR#5 discipline).

### §11.1 Pure tests (`tests/v1/risk-evidence-v0_1.test.ts` — proposed path)

- **Adapter purity.** `buyerreconBehaviouralToRiskInputs` is a pure
  function. No DB / HTTP / clock / randomness.
- **Adapter mapping correctness.** Each PR#1 + PR#2 v0.3 field maps
  to the expected `velocity` / `tags` / `behavioural_risk_01` slot.
  Missing fields default deterministically (0 / empty / false); the
  adapter never invents data.
- **`behavioural_risk_01` normalisation invariants:**
  - Output always in `[0, 1]`.
  - Monotonic in each input feature (increasing the input does not
    decrease the output, all else equal).
  - Reproducible: same SBF row + same config → same number.
  - Degraded mode: when SBF row is the v1 baseline (all factual
    fields at "non-anomalous" defaults), `behavioural_risk_01 ≈ 0`.
- **ContextTag enum discipline:**
  - Every emitted tag is in the OD-12 allowed enum.
  - Every emitted tag matches `/^[A-Z][A-Z0-9_]*$/`.
  - No emitted tag matches `A_*` / `B_*` / `REVIEW_*` / `OBS_*` /
    `UX_*` prefixes.
  - No emitted tag matches `forbidden_codes.yml.hard_blocked_code_patterns.patterns`.
  - Tag cardinality ≤ 16 per session.
- **Forbidden-source-code sweep.** `src/scoring/risk-evidence/**`
  has no string matching
  `forbidden_codes.yml.string_patterns_blocked_in_code.patterns`
  (mirrors PR#5 vendor-exclude carve-out pattern).
- **No reason-code emission.** Pure-test sweep confirms PR#6 source
  contains no string starting with `A_`, `B_`, `REVIEW_`, `OBS_`,
  `UX_`, or `RISK.` as an active code-shaped identifier (allowed in
  comments only).
- **No `risk_index` / `verification_score` / `reason_codes` /
  `reason_impacts` / `triggered_tags` / `penalty_total` /
  `evidence_band` / `action_recommendation` field on the persisted
  shape.** Static-source assertion against the
  `RiskObservationRow` interface and the migration's column list.
- **No product-adapter import.** Zero imports from
  `src/collector/v1/**`, `src/app/**`, `src/server/**`,
  `src/auth/**`. Zero imports of any AMS path (the AMS-Go
  codebase is a sibling repo; no cross-repo imports anyway, but
  defence-in-depth grep).
- **No Lane A / Lane B writer.** Zero `INSERT INTO
  scoring_output_lane_a` / `_b` in PR#6 source.
- **PR#4 startup-guard wiring.** Worker boot calls
  `assertScoringContractsOrThrow()` +
  `assertActiveScoringSourceCleanOrThrow()` before any
  `risk_observations_v0_1` write.

### §11.2 DB tests (`tests/v1/db/risk-observations-v0_1.dbtest.ts` — proposed)

- **Migration applies idempotently.**
- **Natural-key uniqueness (5-column).** Insert at `(ws, site, sess,
  observation_version, scoring_version)`; second insert at the same
  5-tuple → `ON CONFLICT DO UPDATE`. Different `observation_version`
  → new row. Different `scoring_version` → new row.
- **`record_only IS TRUE` CHECK rejects FALSE inserts.**
- **`behavioural_risk_01 BETWEEN 0 AND 1` CHECK** rejects out-of-range
  inserts. Same for the four other `*_risk_01` columns.
- **`source_event_count >= 0` CHECK** rejects negatives.
- **JSONB shape CHECKs:** `velocity` is an object, `tags` is an
  array of strings, `evidence_refs` is an array.
- **Stage 0 eligibility.** Worker run against a mixed seed produces
  rows only for `stage0_decisions.excluded = FALSE` sessions.
- **Source tables unchanged.** `accepted_events`, `rejected_events`,
  `ingest_requests`, `session_features`,
  `session_behavioural_features_v0_2`, `stage0_decisions`,
  `scoring_output_lane_a`, `scoring_output_lane_b` row counts equal
  before/after worker run.
- **No Lane A / Lane B writes by PR#6.**
- **Forbidden-key sweep on `velocity` and `evidence_refs` JSONB**
  (OD-11 parity inherited from PR#5): no `raw_user_agent` /
  `token_hash` / `ip_hash` / `pepper` / `bearer` / `authorization` /
  `raw_payload` / `canonical_jsonb` / `raw_page_url` keys appear in
  any persisted JSONB.
- **Customer-API role zero SELECT** on `risk_observations_v0_1`.
- **`buyerrecon_scoring_worker` SELECT + INSERT + UPDATE** on the new table.
- **`buyerrecon_internal_readonly` SELECT** on the new table.
- **Replay determinism.** Re-running the worker over the same seed
  data produces identical `velocity`, `behavioural_risk_01`, and
  `tags` values. A0 §K's "replay determinism" requirement is
  preserved at the evidence layer.

### §11.3 Test boundary

`__test_ws_pr6__`. Disjoint from prior PRs.

---

## §12 Staging proof plan (planning only)

Hetzner staging only. **No Render production touched** (A0 P-4 still blocking).

```bash
cd /opt/buyerrecon-backend
git pull
npm install
npx tsc --noEmit
npm run check:scoring-contracts        # PR#4 still PASS
npm test                               # full pure suite incl. PR#6's new tests

# Apply migration (NEW table only)
node -e 'console.log("host=" + new URL(process.env.DATABASE_URL).host)'
psql "$DATABASE_URL" -f migrations/013_risk_observations_v0_1.sql

# Run evidence worker RECORD_ONLY over a small candidate window
WORKSPACE_ID="<helen_staging_ws>" SITE_ID="<helen_staging_site>" SINCE_HOURS=24 \
  npm run risk-evidence:run            # script name confirmed via OD-2

# Source-tables-unchanged invariant
psql "$DATABASE_URL" -c "SELECT
  (SELECT COUNT(*) FROM accepted_events)                     AS accepted,
  (SELECT COUNT(*) FROM rejected_events)                     AS rejected,
  (SELECT COUNT(*) FROM ingest_requests)                     AS ingest,
  (SELECT COUNT(*) FROM session_features)                    AS session_features,
  (SELECT COUNT(*) FROM session_behavioural_features_v0_2)   AS sbf_v0_2,
  (SELECT COUNT(*) FROM stage0_decisions)                    AS stage0,
  (SELECT COUNT(*) FROM scoring_output_lane_a)               AS lane_a,
  (SELECT COUNT(*) FROM scoring_output_lane_b)               AS lane_b,
  (SELECT COUNT(*) FROM risk_observations_v0_1)              AS risk_evidence;"
# Expected: accepted/rejected/ingest/session_features/sbf_v0_2/stage0/lane_a/lane_b
# unchanged from pre-PR#6; only risk_evidence may have new rows.

# Eligibility-gate invariant
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM risk_observations_v0_1 r
   WHERE NOT EXISTS (
     SELECT 1 FROM stage0_decisions s
      WHERE s.workspace_id = r.workspace_id
        AND s.site_id      = r.site_id
        AND s.session_id   = r.session_id
        AND s.excluded     = FALSE
   );"
# Expected: 0.

# Verification SQL
psql "$DATABASE_URL" -f docs/sql/verification/13_risk_observations_v0_1_invariants.sql

npm run observe:collector              # PR#12 still PASS
```

**No write to `scoring_output_lane_a`** is expected from PR#6 — the
staging proof asserts the Lane A row count is unchanged. The
Policy Pass 1 projection writer is a separate later PR.

---

## §13 What this planning doc does NOT do

> **This planning doc does not replace AMS architecture or
> algorithms.** It only prepares a BuyerRecon behavioural-evidence
> upgrade compatible with existing AMS assets. The existing AMS
> Risk Core, POI Core, Series Core, Trust Core, Policy Pass 1,
> Policy Pass 2, BuyerRecon product layer, and BuyerRecon product
> output remain authoritative and unchanged.

- Does **not** implement PR#6.
- Does **not** create migration 013.
- Does **not** modify `src/db/schema.sql`.
- Does **not** modify `package.json`.
- Does **not** touch the DB or run `psql`.
- Does **not** touch `src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/**`.
- Does **not** modify migrations 001..012.
- Does **not** modify PR#1 / PR#2 / PR#3 / PR#4 / PR#5
  implementation files.
- Does **not** touch the AMS repo at
  `/Users/admin/github/keigentechnologies/ams`. The AMS Risk Core,
  POI Core, Series Core, Trust Core, Policy Pass 1 / Pass 2,
  product layer, and product output are all read-only references
  and remain authoritative.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`, or
  `scoring/forbidden_codes.yml`. Both reason-code dictionaries
  stay intact; they apply to downstream layers, not to PR#6.
- Does **not** commit. Does **not** push.

---

## §14 Implementation gate (for a future implementation turn)

PR#6 implementation may begin only after **all** of the following hold:

1. Helen written sign-off on this planning doc.
2. Helen explicit answers on D-1..D-14 (or substituted alternatives), including the foundational **D-11 upgrade-not-restart rule**.
3. Codex review of this planning doc → PASS.
4. PR#5 commit `baa17f97…` remains stable; PR#5 Hetzner staging
   proof recorded.
5. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.
6. The AMS Risk Core spec (`docs/algorithms/RISK_CORE_ALGORITHM_SPEC_v2.0.md`)
   and `internal/contracts/signals.go` definition of `RiskInputs` /
   `CommonFeatures.BehavioralRisk01` remain stable. Any subsequent
   bump in AMS triggers a re-validation of PR#6's evidence shape.

After all six hold:

1. New branch from `sprint2-architecture-contracts-d4cc2bf` HEAD
   (currently `baa17f97…`).
2. Implementation PR ships under a file inventory mirroring PR#5's
   layout: types + adapter + normalisation function + worker + CLI
   + migration + schema mirror + tests + verification SQL + impl
   doc.
3. Codex review of the implementation PR → PASS.
4. Hetzner staging proof per §12.
5. No Render production exposure (A0 P-4 still blocking).
6. AMS Risk Core, POI Core, Series Core, Trust Core, Policy Pass 1
   / Pass 2, product layer, and product output remain unchanged.
   PR#6 is **additive** to the existing AMS pipeline.
