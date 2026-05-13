
Helen sign-off for BuyerRecon workflow truth file:

I approve `docs/architecture/buyerrecon-workflow-locked-v0.1.md` as the locked BuyerRecon workflow truth file.

Locked:
- BuyerRecon evidence-foundation build order is distinct from AMS runtime order.
- AMS runtime order is Risk Core + Series Core concurrently → build PoiInputsV3 → AMS PoI Core → Product Layer / Product-Context Fit → Policy Pass 1 → Trust Core → Policy Pass 2.
- BuyerRecon POI Sequence is in-session POI ordering / POI-flow evidence over `poi_observations_v0_1`.
- AMS Series Core is reserved for cross-session cadence / compression / acceleration / revisit / SeriesConfidence / SeriesOutput / TimeOutput.
- BuyerRecon POI remains valid as normalisation / observation evidence; AMS PoI Core is downstream evaluation/scoring.
- Product-Context Fit, Timing Window Detection, Policy Pass 1, Trust Core, Policy Pass 2, Lane A/B, Output, Governance, and Learning Loop are locked as defined in the truth file.
- PR#12b may proceed only after this truth file is committed/pushed, and must follow the POI Sequence Observer boundary.
# BuyerRecon Workflow — Locked v0.1

## 0. Purpose and status

**This document is the repo truth file for BuyerRecon workflow
alignment.** It exists so Helen, ChatGPT, Claude Code, and Codex
share one canonical view of how BuyerRecon's evidence chain is
sequenced, what each layer is and is not, and how BuyerRecon
relates to the original AMS canonical layers in
`/Users/admin/github/keigentechnologies/ams`.

- **It supersedes earlier wording that called in-session POI ordering
  "Series Core".** That naming collided with AMS canonical `Series
  Core` (cross-session continuity). The immediate BuyerRecon PR#12
  concept is renamed to **POI Sequence**. See §10 + §23.
- **It is docs-only.** No code, no schema, no migration, no DB, no
  Render touched.
- **It does not implement any new layer.** It only locks the names,
  ordering, and boundaries so future PRs / Codex reviews / Helen
  sign-offs reference a stable description.
- **PR#10 / PR#11 POI is valid and Hetzner-proven; not rolled back.**
  See §8 + §22.

**Path note.** This file lives at
`docs/architecture/buyerrecon-workflow-locked-v0.1.md`. Earlier
root-level draft copies were deferred out of this PR; future
references must point to the `docs/architecture/` path.

---

## 1. One-sentence architecture

**BuyerRecon is an evidence-first buyer-motion verification system:
first prove what happened, then remove or mark high-bot / invalid
traffic, then derive Risk and POI evidence, then build in-session
POI Sequence evidence, then apply Product-Context Fit and
timing/actionability, then pass through Policy / Trust / Policy,
then project only safe outputs to Lane A while keeping
sensitive / internal signals in Lane B.**

---

## 2. Master workflow

The full BuyerRecon pipeline from collector to learning loop.
Evidence branches (4A–4D) converge into the scoring + interpretation
cores at step 5; they are NOT strict serial scoring steps.

| # | Layer | What happens | Status |
| --- | --- | --- | --- |
| **0** | Site installation / consent / collector connectivity | Customer's site loads the BuyerRecon SDK; consent obtained per workspace policy; events flow to the collector. | DONE (Sprint 1) |
| **1** | Raw evidence ledger | `accepted_events`, `rejected_events`, `ingest_requests`. The collector writes evidence verbatim. No scoring. No judgement. | DONE (PR#0..PR#5) |
| **2** | Derived feature evidence | `session_features` (per-session factual aggregates: page-count, dwell, first/last seen, landing/last path). `session_behavioural_features_v0_2` (cadence, refresh-loop, density buckets). Factual derivation only. | DONE (PR#1 + PR#2) |
| **3** | Stage 0 high-bot / hard-exclusion provenance | `stage0_decisions`. High-confidence-bot or hard-exclusion gate (webdriver, known-bot UA family, scanner/probe paths, etc.). NOT buyer intent. `stage0_rule_id` is provenance only. | DONE (PR#5) |
| **4A** | Risk evidence branch | `risk_observations_v0_1`. Cadence / velocity / burst / sub-200ms transitions / refresh-loop signals → bounded `[0,1]` risk inputs for the AMS Risk Core. NOT Lane A/B output. | DONE (PR#6 + PR#7b + PR#8b) |
| **4B** | POI evidence branch | `poi_observations_v0_1`. Surface-centric normalised POI envelopes (`page_path` for v0.1, with surface taxonomy enum). Privacy filter rejects email-shaped / credential-shaped / raw-URL POI keys. `poi_eligible = NOT stage0_excluded`. | DONE (PR#9a → PR#11d, Hetzner-proven 2026-05-13) |
| **4C** | POI Sequence evidence (in-session ordering) | In-session POI order, repetition, shallow vs. progression, duration, `poi_sequence_pattern_class`. Reads `poi_observations_v0_1` only. NOT scoring. NOT AMS Series Core. | PR#12a planning (renamed from "Series Core" 2026-05-13); PR#12b implementation next |
| **4D** | Timing-window evidence | Recency, first-value window, session freshness, sales-action timing window. In-session timing belongs here; cross-session timing belongs to future AMS Series Core. | NOT YET IMPLEMENTED |
| **5** | AMS-compatible scoring / interpretation cores | AMS Risk Core (consumes bounded risk inputs), AMS PoI Core (consumes `PoiInputsV3` → `PoiOutputV3 { PoiScore, IntentClass, Confidence01, ReasonCodes }`), future AMS Series Core (cross-session continuity only). BuyerRecon-side bridges map BuyerRecon evidence into AMS frozen contracts. | AMS canonical layers EXIST in `/Users/admin/github/keigentechnologies/ams`; BuyerRecon-side bridge wiring NOT YET IMPLEMENTED |
| **6** | Product-Context Fit | Customer product / category / site semantic interpretation. Consumes POI + POI Sequence + Timing + Risk + Stage 0 + account context + `ProductContextProfile` + site mapping + category template + buying-role lens. Outputs early observation bands (weak/possible/moderate/strong), NOT hard buyer intent. | NOT YET IMPLEMENTED |
| **7** | Timing-for-sales-action | "Is this evidence actionable now?" Freshness / decay / recency / return window. Outputs sales-action timing class (`fresh_now / warming / stale / expired / needs_more_evidence` or `no_action / monitor / now / later`). Modifies actionability; does not prove commercial fit. | NOT YET IMPLEMENTED |
| **8** | Policy Pass 1 | Decides what evidence is eligible, suppressed, downgraded, review-only, or internal-only. Runs BEFORE Trust. | NOT YET IMPLEMENTED |
| **9** | Trust Core scoring | AMS Trust Core (`internal/trustcore` in AMS). Scores evidence completeness / consistency / reliability / limitations. NOT Policy. Does not decide final customer exposure alone. | AMS canonical layer EXISTS; BuyerRecon-side bridge NOT YET IMPLEMENTED |
| **10** | Policy Pass 2 | Final permissioning after Trust. Outputs `customer_visible_allowed / recommendation_allowed / auto_report_allowed / internal_only / needs_human_review / suppress / lane_assignment`. | NOT YET IMPLEMENTED |
| **11** | Lane A / Lane B projection | Lane A = customer / action-facing eligible output. Lane B = internal / dark / research-only output. Output governance, NOT evidence. Risk + POI evidence may exist without entering Lane A. | Lane A/B tables `scoring_output_lane_a` + `scoring_output_lane_b` exist from PR#3 migration 011 (mirrored in `schema.sql`); 0/0 across all Hetzner proofs. Final projection NOT YET IMPLEMENTED |
| **12** | Output layer | Session card, account card, buyer-motion timeline, evidence grade (E0–E4), safe-claim block, report automation. External + internal renderers. | NOT YET IMPLEMENTED |
| **13** | Governance + internal learning | Audit, retention, deletion/suppression, monitoring, FP/FN replay, knobs, outcome feedback. | PARTIAL (audit / role grants / DSN masking / `session_id` masking / forbidden-column sweeps DONE; FP/FN / outcome feedback / replay NOT YET IMPLEMENTED) |

**Evidence branches converge at step 5.** 4A Risk, 4B POI, 4C POI
Sequence, 4D Timing are not a strict serial scoring chain; they
contribute parallel evidence streams that scoring/interpretation
layers join.

---

## 2.1 AMS canonical runtime core order vs BuyerRecon evidence build order

**Two distinct orders. They must not be collapsed into a single
"Risk → POI → Series → Trust → Policy" claim.**

### A. BuyerRecon evidence-foundation build order

The order in which BuyerRecon BUILDS upstream evidence layers
before any AMS scoring core can execute. Implementation /
dependency / readiness order, NOT runtime scoring order. This is
the order the §2 master workflow describes:

```
Raw ledger
  → derived features
  → Stage 0
  → Risk evidence branch
  → POI evidence branch
  → POI Sequence evidence
  → Timing-window evidence
  → Product-Context Fit
  → Policy / Trust / output later
```

### B. AMS canonical runtime core order

The order in which the AMS canonical orchestrator EXECUTES the
shared cores at runtime, per
`/Users/admin/github/keigentechnologies/ams/internal/orchestration/pipeline.go`
steps 6–13:

```
Risk Core + Series Core (concurrent)
  → build PoiInputsV3 (carries SeriesOutput)
  → AMS PoI Core
  → Product Layer / BuyerRecon Product-Context Fit
  → Policy Pass 1
  → Trust Core (if needed)
  → Policy Pass 2 (or direct finalisation for SKIP_TRUST)
  → Trust write-back
```

### Note

**BuyerRecon POI Sequence is an upstream evidence /
feature-observation layer. It is NOT AMS Series Core and it does
NOT change the AMS canonical runtime order.**

### AMS source references

- `docs/architecture/ARCHITECTURE_V2.md` line 661 — "PoI Core
  depends on the `SeriesOutput` produced by Series Core, so it
  MUST execute after the concurrent group completes."
- `internal/orchestration/pipeline.go` lines 66–72 — numbered
  runtime steps 6–13: Risk + Series concurrent → build
  `PoiInputsV3` → PoI → ProductScorer → Policy Pass 1 → Trust →
  Policy Pass 2 → Trust write-back.
- `internal/contracts/signals.go` lines 76–94 — `type PoiInputsV3
  struct { ... Series SeriesOutput ... }`: `PoiInputsV3.Series`
  carries longitudinal continuity output from Series Core into
  PoI Core. This is why PoI Core MUST execute after the
  Risk+Series concurrent group.

### Why this matters

Pre-rename PR#12a wording said "AMS shared-core priority (Risk →
POI → Series → Trust → Policy)". That collapses two different
things: BuyerRecon's evidence-build readiness order (where POI
evidence is built before any cross-session continuity work is
feasible) and the AMS runtime order (where Risk Core and Series
Core execute concurrently, then both fan-in to PoI Core via
`PoiInputsV3`). The two orders agree only on the final Trust +
Policy positions; the Risk / Series / PoI segment is
concurrent-then-fan-in in AMS runtime, not the serial Risk → POI
→ Series sequence the old wording implied.

---

## 3. Layer type taxonomy

| Layer type | What it does | What it MUST NOT do | Examples |
| --- | --- | --- | --- |
| **Evidence layer** | Records factual observations from collector / derived features / Stage 0 / POI / POI Sequence. | Score, judge, decide, customer-face. | `accepted_events`, `session_features`, `stage0_decisions`, `poi_observations_v0_1`, future `poi_sequence_observations_v0_1` |
| **Scoring / interpretation layer** | Produces bounded numeric scores + classification from evidence. | Make policy/permissioning decisions; customer-face. | AMS Risk Core, AMS PoI Core, future AMS Series Core |
| **Product-Context Fit layer** | Calibrates POI + POI Sequence + Timing patterns against customer product/category buyer-motion. Outputs observation bands. | Make final buyer-intent claims; bypass Policy/Trust. | Future BuyerRecon PCF layer + `ProductContextProfile` |
| **Timing layer** | Decides whether evidence is fresh / actionable now. | Prove commercial fit by itself. | Future BuyerRecon Timing Window Detection + future AMS Series Core for cross-session |
| **Policy layer** | Two passes: Pass 1 eligibility (pre-Trust), Pass 2 final permissioning (post-Trust). | Be a score. Hide its decisions from audit. | Future BuyerRecon Policy Pass 1 + Policy Pass 2 |
| **Trust layer** | Longitudinal trust score per subject; evidence reliability assessment. | Be Policy. Decide customer exposure alone. | AMS Trust Core |
| **Output layer** | Customer-facing reports + internal diagnostics renderers. | Re-derive evidence. Be a scoring decision. | Future session card, account card, evidence grade renderer |
| **Governance layer** | Audit, retention, deletion, monitoring, role boundary, runtime proof. | Be enterprise decoration; be skipped on the v0.1 path. | Existing role grants, Hard-Rule-I parity checks, Hetzner proof runbooks |
| **Learning layer** | FP/FN replay, knob/version updates, outcome feedback. | Learn by creating private customer code. | Future BuyerRecon learning loop |

---

## 4. Stage 0 high-bot / hard exclusion

- **`stage0_decisions`** is the durable Stage 0 hard-exclusion layer.
- High-confidence bot / hard-exclusion provenance: `webdriver_global_present`,
  `automation_globals_detected`, `known_bot_ua_family`,
  `scanner_or_probe_path`, `impossible_request_frequency`,
  `non_browser_runtime`, `attack_like_request_pattern`,
  `no_stage0_exclusion` (eligibility-positive).
- **Stage 0 is NOT buyer intent.** It is a high-confidence
  hard-exclusion gate.
- **Stage 0 is NOT customer-facing** by default. `customer_api` role
  has zero SELECT on `stage0_decisions` (PR#3 OD-7 / PR#5 / PR#6 / PR#11c
  Hard-Rule-I parity).
- **`stage0_rule_id` is provenance-only.** It is NOT a POI key, POI
  context, scoring reason, customer-facing reason code, Policy /
  Trust reason, downstream judgement, report language, or
  Product-Context-Fit input. Persisted only for audit lineage.
- **Stage 0-excluded sessions still carry evidence downstream**,
  marked `poi_eligible=FALSE` / future `poi_sequence_eligible=FALSE`.
  Carry-through, not reject. PR#11b Hetzner proof: 6 of 8 sessions
  excluded; all 8 stored.

---

## 5. Raw evidence ledger

- **`accepted_events`** — verbatim accepted event ledger (PR#0..PR#3).
- **`rejected_events`** — verbatim rejected event ledger.
- **`ingest_requests`** — request-layer audit.

The collector **writes evidence, not scoring.** No judgement happens
here. No customer-facing field exists on these tables. Downstream
evidence layers consume PR#1+PR#2 derived features (session_features
+ SBF), NOT the raw ledger directly (PR#9a §4.2 forbidden-read rule).

---

## 6. Derived feature evidence

- **`session_features`** (PR#1) — per-session factual aggregates:
  page-count, dwell, first/last seen, source-event-count, landing
  path, last path, has-CTA-click, has-form-start, has-form-submit,
  event-name distribution. **Factual derived features, NOT judgement.**
- **`session_behavioural_features_v0_2`** (PR#1 + PR#2) — cadence,
  refresh-loop, pageview burst, sub-200ms transition count,
  interaction density bucket, scroll-depth bucket. **Factual
  behavioural aggregates, NOT scoring.**

These tables are the upstream that all downstream evidence /
scoring / interpretation layers consume. They never carry score /
verdict / reason codes.

---

## 7. Risk evidence branch

- **`risk_observations_v0_1`** (PR#6, Hetzner-proven via PR#8b at `011b6c2`).
- Risk evidence is a **branch**: it feeds AMS Risk Core later; it is
  NOT itself Lane A/B output.
- Risk evidence later feeds Policy + Trust via AMS-compatible scoring
  cores; it does NOT automatically become customer-facing.
- Risk-POI independence holds (PR#9a OD-5): POI does not read Risk;
  Risk does not read POI. A future Risk↔POI cross-reference happens
  at the AMS PoI Core / Trust Core layer, not earlier.

---

## 8. POI evidence branch

- **`poi_observations_v0_1`** (PR#11c migration 014, Hetzner-proven
  via PR#11d at `8e0841d`).
- **BuyerRecon POI = POI normalisation / observation evidence
  layer.** PR#10 contract + PR#11a..d observer/worker/table-observer.
- **AMS PoI Core (`internal/poicore` in AMS) = downstream POI
  evaluation engine.** Produces `PoiOutputV3 { PoiScore 0..100,
  IntentClass [GOOD/NEUTRAL/WEAK/ALERT], Confidence01,
  EntryRecommendation, ReasonCodes, ReasonImpacts, LegitimacyFlags,
  AnomalyFlags }`.
- **These are complementary layers, NOT duplicates.** BuyerRecon POI
  corresponds approximately to AMS's Feature Layer + adapter that
  builds `PoiInputsV3`; it does NOT correspond to the AMS
  `PoiEngine`.
- **PR#10 / PR#11 POI is valid and NOT rolled back.** Hetzner-proven
  PASS (2026-05-13).
- **`poi_eligible = NOT stage0_excluded`** — pure boolean inverse,
  enforced at three layers (PR#10 adapter, PR#11c upsert builder,
  DB CHECK `poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`).
- **`stage0_rule_id` is provenance-only** (per §4).
- **`evidence_refs` is non-empty** (DB CHECK
  `poi_obs_v0_1_evidence_refs_nonempty`). Allowlist:
  `{session_features, session_behavioural_features_v0_2, stage0_decisions}`
  + recursive 24-forbidden-key sweep.
- **`poi_observations_v0_1` is internal durable evidence, NOT
  customer-facing output.** `customer_api` zero SELECT.
- Surface taxonomy (`PoiSurfaceClass`, 14 dotted-namespace labels):
  `page.general / page.home / page.pricing / page.demo /
  page.resources / page.trust / cta.primary / cta.secondary /
  form.demo / form.contact / offer.demo / offer.pricing /
  offer.trust / referrer.class`.
- POI type enum (`POI_TYPE`, 6 values): `page_path / route / cta_id /
  form_id / offer_surface / referrer_class`. UTM is context only,
  never a POI key.

A future BuyerRecon-side AMS-bridge adapter will map BuyerRecon
POI evidence + Risk evidence into `PoiInputsV3 + RiskOutput` for
the AMS PoI Core engine. That bridge is a **separate future PR**,
not PR#12.

---

## 9. POI Sequence evidence

**POI Sequence = in-session POI ordering / POI-flow evidence layer.**

- It is **evidence foundation / feature-observation**.
- It is **NOT scoring**, **NOT AMS Series Core**, NOT Trust, NOT
  Policy, NOT Product-Context Fit, NOT buyer-role mapping, NOT
  customer-facing judgement.
- It is derived only from `poi_observations_v0_1` (single source
  allowlist).
- Stage 0 carry-through via POI rows; no Stage 0 re-read.

### Candidate facts (v0.1)

| Field | Notes |
| --- | --- |
| `poi_sequence_version` | Frozen literal (`'poi-sequence-v0.1'`) |
| `workspace_id`, `site_id`, `session_id` | Identity / session boundary; `session_id` masked on output |
| `poi_observation_version` | Carried from POI rows; agreement check |
| `poi_input_version` | Carried; agreement check |
| `poi_count` | Total POI rows for the session |
| `unique_poi_count` | Distinct `(poi_type, poi_key)` pairs |
| `first_poi_type` / `first_poi_key` / `last_poi_type` / `last_poi_key` | First / last POI in chronological order |
| `first_seen_at` / `last_seen_at` | Earliest / latest across POI rows |
| `duration_seconds` | `last_seen_at - first_seen_at`; 0 when one POI |
| `repeated_poi_count` | Count of POI rows that repeat an earlier `(poi_type, poi_key)` |
| `has_repetition` | `repeated_poi_count > 0` |
| `has_progression` | `unique_poi_count >= 2` |
| `progression_depth` | `unique_poi_count` |
| `poi_sequence_pattern_class` | One of the v0.1 taxonomy classes (below) |
| `stage0_excluded` | TRUE if any POI row in the session has `stage0_excluded=TRUE` |
| `poi_sequence_eligible` | `= NOT stage0_excluded` (pure boolean inverse) |
| `evidence_refs` | Refs to `poi_observations_v0_1` rows only |
| `source_versions` | `{ poi_observations: ..., poi_input_version: ..., poi_sequence_version: ... }` |

### v0.1 taxonomy classes

- `single_poi` — exactly one POI row for the session
- `repeated_same_poi` — `poi_count >= 2` AND `unique_poi_count == 1`
- `multi_poi_linear` — `unique_poi_count >= 2` AND no POI repeats
- `loop_or_backtrack` — `unique_poi_count >= 2` AND at least one POI repeats
- `insufficient_temporal_data` — timestamps missing / inconsistent
- `unknown` — fallback (must remain 0 in a healthy run)

### Rules

- **Source = `poi_observations_v0_1` only** (v0.1). No Stage 0
  re-read, no SF/SBF re-read, no raw-ledger read, no Risk read,
  no Lane A/B read.
- **Stage 0-excluded sessions produce records** with
  `poi_sequence_eligible=FALSE` (carry-through, not reject).
- `single_poi` is NOT progression.
- Meaningful progression requires **2+ distinct POIs**.
- **No score, no verdict, no reason codes, no customer output.**
- Anomaly samples (if any) carry `poi_observation_id` only — no
  session_id, no poi_key, no evidence_refs (per PR#11d precedent).

---

## 10. AMS Series Core

**AMS Series Core = cross-session continuity ONLY.** It is the
canonical layer in `/Users/admin/github/keigentechnologies/ams/internal/seriescore`.

### What AMS Series Core covers

- **Cadence** (`SessionCount`, `AvgGapDays`, `TotalDays`)
- **Compression** (`IsCompressing`, `TrendSlope`, `Confidence`) — bounded-window OLS slope of gap shrinkage
- **Acceleration** (`IsAccelerating`, `RateTrend`) — bounded-window OLS slope of session-rate
- **Revisit** (`IsRevisit`, `VisitCount`, `DaysSinceLast`) — across sessions, not within
- **SeriesConfidence** ∈ [0,1]

### Inputs (from AMS `engines.SeriesComputeInput`)

```
SeriesComputeInput {
  SubjectID
  SessionTimes []time.Time
  CurrentSessionT time.Time
  PriorPoiScores []int
  PriorRiskScores []int
  PriorTrustScores []int
  ContinuityConfidence01 float64
}
```

### Output (frozen contract per AMS ADR-005)

`SeriesOutput` (with legacy frozen alias `TimeOutput` per ADR-005).
Consumed by AMS PoI Core (`PoiInputsV3.Series`), Trust Core
(`TrustInputsV3.Series`), and Product Layer.

### BuyerRecon disposition

- **Future BuyerRecon Series Core work only.** Becomes meaningful
  once BuyerRecon has multi-session subject continuity (currently
  staging has 1 session per subject, so cross-session continuity
  cannot compute).
- **MUST NOT be confused with POI Sequence.** POI Sequence is
  in-session; AMS Series Core is cross-session.

### Reserved names (do NOT mint in BuyerRecon until future Series Core layer)

- `Series Core`
- `seriescore` (module / package name)
- `SeriesOutput`
- `TimeOutput`
- `Cadence`, `Compression`, `Acceleration`, `Revisit`
- `SeriesConfidence`, `series_status`
- `series_observations_v0_1`, `series_version`, `series_eligible`

---

## 11. Product-Context Fit

**Product-Context Fit determines whether observed behaviour fits the
customer's product / category / site buyer-motion pattern.** It is
a downstream layer, NOT part of POI Sequence and NOT part of AMS
shared cores.

### Consumes

- POI evidence (`poi_observations_v0_1`)
- POI Sequence evidence (future `poi_sequence_observations_v0_1`)
- Timing evidence (future)
- Risk evidence (`risk_observations_v0_1`)
- Stage 0 eligibility (via POI carry-through)
- Account / session context
- `ProductContextProfile` (the versioned configuration envelope; §12)
- Site mapping (customer-specific URL → surface-meaning)
- Category template (product/category default interpretation)
- Buying-role lens (cross-cutting persona view)

### Outputs

Early observations / bands, NOT hard buyer intent:

- `weak / possible / moderate / strong`
- Reasons (versioned reason codes)
- Limitations (what evidence is missing)
- Versions (product_context_profile_version,
  category_template_version, site_mapping_version,
  role_lens_version, product_fit_rule_version)

### Product-Context Fit is NOT

- Raw POI evidence
- POI Sequence evidence
- AMS Series Core
- Final buyer-intent claim
- Final sales-action permission
- Policy
- Trust

### Product-Context Fit is NOT about BuyerRecon's own website.

It calibrates observed POI + POI Sequence patterns on a
**customer's** website against that customer's product / category
buyer-motion patterns. BuyerRecon itself is one example of a
customer using the system; the system must not bake BuyerRecon's
own site taxonomy into Product-Context Fit.

---

## 12. ProductContextProfile

**`ProductContextProfile`** is the versioned configuration envelope
that Product-Context Fit consumes. Every PCF observation must
record the versions in use so old observations are reproducible
after mapping / template / lens / rule changes.

### Structure

```
ProductContextProfile {
  product_context_profile_version
  category_template
  primary_conversion_goal
  sales_motion
  site_mapping_version
  site_mapping
  excluded_mapping
  role_lens_version
  role_lens_enabled
  product_fit_rule_version
}
```

### Version fields (per-PCF-observation provenance)

- `universal_surface_taxonomy_version`
- `category_template_version`
- `buying_role_lens_version`
- `site_mapping_version`
- `product_context_profile_version`
- `product_fit_rule_version`

### Replay / reproducibility

Every Product-Context Fit observation MUST record these versions so
an audit run can reproduce the same band/reasons from an old POI +
POI Sequence + Timing input set even after the underlying
templates / mappings / rules evolve.

---

## 13. Universal taxonomy / category template / buying-role lens / site mapping

### Definitions

- **Universal taxonomy** — standard surface meanings shared across
  all customers (the BuyerRecon-side baseline `PoiSurfaceClass`
  enum is the v0.1 universal surface taxonomy seed).
- **Category template** — product / category default
  interpretation of the universal taxonomy (e.g. "B2B SaaS",
  "developer tools", "e-commerce checkout flow").
- **Buying-role lens** — cross-cutting lens applied across all
  customers / categories, NOT a tree branch under category.
- **Site mapping** — customer-specific semantic adapter
  (customer's `/buy` URL → universal `conversion_action` surface).

### Universal surface examples

| URL pattern | Universal surface meaning |
| --- | --- |
| `/pricing` | `commercial_evaluation` |
| `/demo` | `conversion_action` |
| `/security` | `risk_validation` |
| `/docs` | `technical_evaluation` |
| `/careers` | `excluded_low_intent` |
| `/team` | `brand_trust` |
| `/process` | `proof_validation` |

### Buying-role lens

- `economic_buyer`
- `technical_evaluator`
- `risk_compliance_reviewer`
- `procurement_logistics`
- `operator_user`

### Hard rule

**Customers MAY have different mappings / configs / templates / role
lenses.** Customers MUST NOT have:

- Private scoring code per customer
- Private if-else logic per customer
- Private unversioned ML model per customer

All customer-specific behaviour MUST be expressed as versioned
templates, mappings, and configs — never as a private code fork.

---

## 14. Timing Window Detection

**Timing Window Detection asks whether evidence is fresh / current /
actionable now.** It splits into two scopes:

### A. In-session / short-window timing

Belongs to evidence / feature-observation + POI Sequence:

- First 10 minutes after install
- Last 30 minutes activity
- Same-session POI spacing
- Session duration
- `first_seen_at` to `last_seen_at`
- Recency of key POI
- Freshness of evidence

### B. Cross-session timing / continuity

Belongs to future AMS Series Core:

- Return visit after days
- Shrinking gaps (compression)
- Accelerating cadence (acceleration)
- Revisit count
- Days since last activity
- Continuity confidence

### Sales-action timing output

- `fresh_now` / `warming` / `stale` / `expired` / `needs_more_evidence`
- `no_action` / `monitor` / `now` / `later`

### Rule

**Timing modifies actionability; it does not prove commercial fit
by itself.** Timing combined with Product-Context Fit + Risk +
POI/POI Sequence is what later policy/trust layers consume.

---

## 15. Policy Pass 1

**Policy Pass 1 happens BEFORE Trust.** It decides what evidence is
eligible, suppressed, downgraded, review-only, or internal-only.

### Inputs

- Stage 0 (via POI carry-through)
- Risk evidence + AMS Risk Core output
- POI evidence + AMS PoI Core output
- POI Sequence evidence
- Timing evidence
- Product-Context Fit observation
- Privacy flags
- Workspace / site policy

### Outputs

- `eligible_for_trust`
- `review_only`
- `internal_only`
- `suppress`
- `insufficient_evidence`

---

## 16. Trust Core

**AMS Trust Core (`internal/trustcore`)** scores / assesses evidence
**reliability, completeness, consistency, and limitations** with
longitudinal trust evolution per subject.

### Key facts

- Inputs (frozen `TrustInputsV3`): `Poi`, `Risk`, `Series` (legacy
  frozen field name for AMS Series Core output), plus prior trust
  state.
- Outputs (frozen `TrustDecisionV3`): `NewTrustScore`, `TrustBand`,
  `Decision`, `AllowedActions`, `ReasonCodes`, decay / probation /
  recovery state, `ConfidenceScore01`, `Trajectory`.
- **Trust is NOT Policy.** Trust governs evidence reliability;
  Policy governs final customer exposure.
- **Trust does NOT decide final customer exposure alone.** Policy
  Pass 2 reads Trust output + Policy rules and resolves the final
  decision.

### BuyerRecon disposition

AMS Trust Core layer EXISTS. BuyerRecon-side bridge (mapping
BuyerRecon evidence + AMS PoI/Risk/Series outputs into
`TrustInputsV3`) is NOT YET IMPLEMENTED.

---

## 17. Policy Pass 2

**Policy Pass 2 is final permissioning AFTER Trust.**

### Outputs

- `customer_visible_allowed`
- `recommendation_allowed`
- `auto_report_allowed`
- `internal_only`
- `needs_human_review`
- `suppress`
- `lane_assignment` (Lane A vs Lane B)

---

## 18. Lane A / Lane B

- **Lane A = customer / action-facing eligible output.**
- **Lane B = internal / dark / research-only output.**

### Rules

- Lane A / Lane B are **output governance, NOT evidence**.
- Risk evidence and POI evidence MAY exist without entering Lane A.
- **Lane B signals must NOT leak to customers.**
- **No automated sales action may fire from Lane B.**
- Hetzner staging proofs require PRE = POST = 0 on both
  `scoring_output_lane_a` and `scoring_output_lane_b`.

### Current state

Lane A/B tables exist from PR#3 migration 011:

- `scoring_output_lane_a`
- `scoring_output_lane_b`

They are mirrored in `schema.sql`. Both remain 0/0 across Hetzner
proofs. Final Lane A/B projection logic is not implemented yet.

**Provenance corrections:** Lane A/B are tables, not columns. The
migration is PR#3 / migration 011, not PR#4. Lane A/B are output
governance / projection lanes, not evidence foundation.

---

## 19. Output layer

### External

- Installation status
- First-value evidence
- Session evidence card
- Account evidence card
- Buyer-motion timeline
- Evidence grade (E0–E4)
- Safe-claim block
- Report automation

### Internal

- Tracker / consent health
- Ingestion latency
- Risk / bot diagnostics
- False-positive audit
- Report render / send status
- Calibration / debug panels

### Safe-wording rules

- **Allowed:** *observed* / *consistent with* / *suggests* /
  *indicates* / *insufficient evidence* / *not yet verified*.
- **Forbidden:** *confirmed buyer* / *definitely buyer* /
  *guaranteed intent* / *high-converting lead*.

The output layer is NOT YET IMPLEMENTED.

---

## 20. Governance layer

### What governance owns

- Build contract (`scoring/version.yml`,
  `reason_code_dictionary.yml`, `forbidden_codes.yml`)
- `audit_events` table (future)
- Deletion + suppression
- Retention
- Monitoring (latency, error rates, regression observers)
- Incident timeline
- Workspace / project / site boundary
- Role model (`buyerrecon_migrator`, `buyerrecon_scoring_worker`,
  `buyerrecon_internal_readonly`, `buyerrecon_customer_api`)
- Runtime proof (Hetzner staging proofs per PR)

### Rule

**Governance is part of evidence trust, NOT enterprise decoration.**
A v0.1 path that skips governance is not v0.1 — it is a draft.

### Current state

Governance is PARTIAL:
- Role grants / Hard-Rule-I parity checks DONE (PR#3 onwards).
- DSN masking / `session_id` masking / forbidden-column sweeps DONE
  (PR#8b / PR#11b / PR#11c / PR#11d).
- Architecture Gate A0 P-4 Render production block ACTIVE.
- `audit_events` table NOT YET IMPLEMENTED.
- Retention / deletion / suppression policy NOT YET IMPLEMENTED.

---

## 21. Internal learning loop

### Components

- FP / FN queues
- Review tasks
- Outcome feedback (won / lost / no decision)
- Replay corpus
- Knob versions
- Score versions
- `product_context_profile` versions
- Improvement records
- Rollback pointers

### Workflow

```
real outcome / human review
  → case
  → FP / FN classification
  → recurring pattern
  → proposed template / knob / timing-window change
  → replay test
  → shadow run
  → new version
  → active version or rollback
```

### Hard rule

**Do NOT learn by creating private customer code.** Learn by
improving versioned **templates**, **mappings**, **knobs**, and
**profiles**. Every learning artefact is a new version, not a
fork.

### Current state

NOT YET IMPLEMENTED.

---

## 22. Current PR mapping

| Sprint / PR | Workflow layer | State |
| --- | --- | --- |
| Sprint 1 / Track B | Collector + raw ledger (§5) | DONE |
| Sprint 2 PR#1 + PR#2 | Derived feature evidence (§6) | DONE |
| Sprint 2 PR#5 | Stage 0 (§4) | DONE |
| Sprint 2 PR#6 | Risk evidence layer (§7) | DONE (Hetzner-proven via PR#8b at `011b6c2`) |
| Sprint 2 PR#7a + PR#7b | Risk Core Bridge contract + adapter | DONE |
| Sprint 2 PR#8a + PR#8b | Risk Core Bridge Observer | DONE (Hetzner-proven) |
| Sprint 2 PR#9a | POI Core Input planning | DONE |
| Sprint 2 PR#10 | BuyerRecon POI evidence — contract (§8) | DONE (`f9d2a75`) |
| Sprint 2 PR#11a | POI Derived Observation planning | DONE |
| Sprint 2 PR#11b | POI Core Input Observer | DONE (Hetzner-proven at `1a3b252`) |
| Sprint 2 PR#11c | POI Observations Table + Worker | DONE (`e90b18b`) |
| Sprint 2 PR#11d | POI Table Observer + Hetzner Proof | DONE (Hetzner-proven 2026-05-13 at `8e0841d`) |
| Sprint 2 PR#12a (committed `eeee8d9`) | "Series Core Planning" — superseded by PR#12a rename patch | SUPERSEDED |
| Sprint 2 PR#12a correction (committed `ca3f174`) | Rename → "POI Sequence Planning" | DONE — committed + pushed |
| Sprint 2 PR#12b (next) | Read-only POI Sequence Observer (§9 / §4C) | NOT YET IMPLEMENTED |

### Not yet implemented (named for future planning)

- POI Sequence durable table (`poi_sequence_observations_v0_1`)
- POI Sequence table observer
- AMS Series Core (cross-session continuity; §10)
- `ProductContextProfile` (§12)
- Product-Context Fit observations (§11)
- Timing Window Detection (§14)
- Policy Pass 1 (§15)
- Trust Core BuyerRecon-side bridge (§16)
- Policy Pass 2 (§17)
- Lane A/B final projection (§18)
- Output layer (§19)
- Internal learning dashboard (§21)
- BuyerRecon → AMS PoI Core bridge (mapping BuyerRecon POI
  evidence into `PoiInputsV3 + RiskOutput`)
- BuyerRecon → AMS Trust Core bridge

---

## 23. Naming locks

### Correct immediate names (PR#12 chain)

- `POI Sequence` (the in-session POI-ordering concept)
- `poi-sequence-observer` (module path under `src/scoring/`)
- `observe:poi-sequence` (npm script name)
- `poi_sequence_version`
- `poi_sequence_eligible`
- `poi_sequence_pattern_class`
- `poi_sequence_observations_v0_1` (future durable table)

### Reserved AMS canonical names (do NOT mint in BuyerRecon)

- `Series Core` (used in BuyerRecon-concept context)
- `seriescore` (module / package name)
- `SeriesOutput`
- `TimeOutput` (legacy frozen alias per AMS ADR-005)
- `Cadence`, `Compression`, `Acceleration`, `Revisit` (as
  BuyerRecon-concept field names; AMS canonical references in
  docs / comments are allowed)
- `SeriesConfidence`, `series_status`
- `series_observations_v0_1`
- `series_version`, `series_eligible`

### POI naming note

- **BuyerRecon `poi-core` (in `src/scoring/poi-core/`)** = POI
  normalisation / observation evidence layer (NOT a scoring
  engine).
- **AMS `poicore` (in `internal/poicore/` in AMS repo)** = POI
  evaluation engine producing `PoiScore` / `IntentClass` /
  `Confidence01` / `ReasonCodes`.
- Future bridge maps BuyerRecon POI evidence + Risk evidence into
  AMS `PoiInputsV3` / `RiskOutput` → AMS `PoiOutputV3`. The bridge
  is a separate future PR (not PR#12).

### Frozen-name guard discipline

PR#12b and any subsequent BuyerRecon PR must NOT mint the reserved
AMS canonical names in BuyerRecon runtime source. Static-source
sweeps (mirroring the PR#3 `verification_score` allowlist precedent
in `tests/v1/scoring-output-contracts.test.ts`) enforce this.

---

## 24. PR checklist (from now on)

**Every new PR must state, in its impl/planning doc:**

| Field | Examples |
| --- | --- |
| Workflow layer | "Evidence layer (§6 derived features)", "Scoring layer (§5 AMS Risk Core bridge)", etc. |
| Allowed source tables | Explicit list — e.g. "`poi_observations_v0_1` only" |
| Forbidden source tables | Explicit list — e.g. "`accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1`, Lane A/B, `site_write_tokens`" |
| Customer-facing or internal-only | "Internal-only; no customer exposure in this PR" |
| Score / verdict / reason-code allowed or forbidden | "Forbidden — this PR is evidence, not decision" |
| DB writes allowed or forbidden | "Read-only" / "Single durable table write to `<table>` only; no source-table mutation" |
| Observer-first or durable table | "Observer-first (mirrors PR#11b)" / "Durable table + worker (PR#11c precedent)" |
| Version fields | "`<layer>_version` literal frozen at `'<layer>-v0.1'`; future bumps reviewable" |
| Rollback path | "Forward-only migration; rollback = additive cleanup PR" |
| Codex review checklist | PR-specific Codex checklist mirroring PR#11a / PR#11c style |

A PR that does not declare these fields is not v0.1-ready.

---

## 25. Alignment notes from repo audit

### AMS files inspected (read-only)

| Path | Purpose |
| --- | --- |
| `CONSTITUTION_v2.0.md`, `AGENTS_v2.0.md`, `CLAUDE_v2.1.md`, `README_v2.1.md` | ADR-005 frozen-name guards; canonical layer naming |
| `docs/architecture/ARCHITECTURE_V2.md` §6 / §7.2 / §10.5 | Layer boundaries; concurrent Risk + Series at §7.2 |
| `docs/architecture/FIELD_LAYERING_V2.md` §6.2 / §10.3 | Field-ownership boundaries (observation-time vs cross-session) |
| `docs/architecture/PACKAGE_BOUNDARY_MATRIX_V2.md` §138 / §265 / §284 | Boundary: "Cross-session cadence/compression/acceleration belong to Series Core, not Feature Layer" |
| `docs/algorithms/POI_CORE_ALGORITHM_SPEC_v2.1.md` | Canonical AMS PoI Core spec; produces `PoiOutputV3` |
| `docs/algorithms/SERIES_CORE_ALGORITHM_SPEC_v2.0.md` | Canonical AMS Series Core spec; cross-session continuity |
| `docs/algorithms/TRUST_CORE_ALGORITHM_SPEC_v2.1.md` | Canonical AMS Trust Core spec; `TrustInputsV3` → `TrustDecisionV3` |
| `docs/algorithms/BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0.md` (existence noted) | BuyerRecon-Product-Layer consumer spec |
| `internal/contracts/signals.go` | Frozen `RiskInputs`, `RiskOutput`, `SeriesOutput`, `PoiInputsV3`, `PoiOutputV3`, `TrustInputsV3`, `TrustDecisionV3` |
| `internal/engines/interfaces.go` | `RiskEngine`, `SeriesEngine`, `PoiEngine`, `TrustEngine`, `ProductScorer` interfaces |
| `internal/poicore/engine.go` + `config.go` | AMS PoI Core engine (real algorithm) |
| `internal/seriescore/engine.go` + `config.go` | AMS Series Core engine (cross-session continuity) |
| `internal/trustcore/` (existence noted) | AMS Trust Core engine |
| `internal/riskcore/`, `internal/policy/`, `internal/orchestration/`, `internal/products/buyerrecon/` (existence noted) | AMS shared cores + BuyerRecon product-layer adapter location |

### BuyerRecon files inspected

| Layer | Files |
| --- | --- |
| Architecture | `docs/architecture/ARCHITECTURE_GATE_A0.md` |
| Migrations | `migrations/002..014_*.sql` (everything from `event_contract_v2` through `poi_observations_v0_1`) |
| Risk evidence | `docs/sprint2-pr6-*`, `src/scoring/risk-evidence/{adapter,context-tags,normalisation-config,normalise-behavioural-risk,types,worker,index}.ts`, `src/scoring/risk-core-bridge/*`, `src/scoring/risk-core-bridge-observer/*` |
| POI contract | `docs/sprint2-pr9a-poi-core-input-planning.md`, `docs/sprint2-pr10-poi-core-input.md`, `src/scoring/poi-core/{types,normalise,adapter,index,version}.ts`, `tests/v1/poi-core.test.ts` |
| POI observer | `docs/sprint2-pr11a-*`, `docs/sprint2-pr11b-*`, `src/scoring/poi-core-observer/*`, `tests/v1/poi-core-observer.test.ts` |
| POI worker / table | `docs/sprint2-pr11c-*`, `migrations/014_poi_observations_v0_1.sql`, `src/scoring/poi-core-worker/*`, `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` |
| POI table observer | `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md`, `src/scoring/poi-table-observer/*`, `tests/v1/poi-table-observer.test.ts` |
| PR#12a planning | `docs/sprint2-pr12a-poi-sequence-planning.md` (renamed from `series-core-planning.md` at commit `ca3f174`; current committed PR#12a planning doc) |

### Confirmed alignments

1. **Dual order — BuyerRecon evidence build order vs AMS runtime
   core order** (see §2.1 for full reference). BuyerRecon evidence
   branches (4A Risk, 4B POI, 4C POI Sequence, 4D Timing) are an
   evidence-readiness build order; the AMS canonical runtime
   executes Risk Core + Series Core concurrently, then builds
   `PoiInputsV3` (carrying `SeriesOutput`), then runs PoI Core,
   Product Layer / Product-Context Fit, Policy Pass 1, Trust Core,
   Policy Pass 2, Trust write-back. **The two orders must not be
   collapsed into a serial "Risk → POI → Series → Trust → Policy"
   shorthand**, which earlier PR#12a wording incorrectly implied.
2. **PR#10/PR#11 POI is BuyerRecon-local POI normalisation /
   observation evidence**, complementary to AMS canonical PoI
   Core (downstream evaluation engine). Not a duplication; not a
   rollback trigger.
3. **PR#12 POI Sequence is in-session ordering**, distinct from
   AMS canonical Series Core (cross-session continuity).
4. **Stage 0 carry-through pattern is consistent** across BuyerRecon
   POI (PR#10..PR#11d) and the planned POI Sequence layer (§9):
   excluded sessions are stored, marked ineligible.
5. **Privacy posture is strictly stronger** in BuyerRecon than in
   AMS: `normalisePagePath` email-PII rejection, `truncateSessionId`
   masking, DSN masking, recursive forbidden-key sweeps, PR#3
   `verification_score` carve-out. AMS-side bridges must preserve
   BuyerRecon masking on outbound surfaces.
6. **Lane A / Lane B parity** (0/0 PRE = POST) holds across every
   Hetzner staging proof to date.
7. **Render production untouched.** A0 P-4 still blocking.

### Known naming conflicts and resolutions

| Conflict | Resolution |
| --- | --- |
| Both repos used "PoI Core" / "POI Core" naming | KEEP both. BuyerRecon `poi-core` = normalisation layer; AMS `poicore` = evaluation engine. Documented in §8 + §23. No rename. |
| BuyerRecon PR#12a originally used "Series Core" for in-session POI ordering, conflicting with AMS canonical `Series Core` (cross-session continuity) | RENAME the BuyerRecon concept to "POI Sequence". PR#12a rename correction is committed at `ca3f174` ("Sprint 2 PR#12a: rename Series Core to POI Sequence (AMS-compat)"). AMS canonical Series Core names reserved for future BuyerRecon cross-session continuity layer. This workflow truth file is the only uncommitted file in the current PR. |
| `SeriesOutput` / `TimeOutput` / `seriescore` / `Cadence` / etc. — AMS canonical contract names | RESERVED. BuyerRecon must NOT mint these names in PR#12b runtime source. Static-source sweep will enforce. See §23 frozen-name guard. |

### Open decisions

1. **PR#12b implementation kickoff** — pending Codex review +
   Helen sign-off on this workflow truth file, then PR#12b
   read-only POI Sequence Observer implementation per §9.
2. **AMS bridge timing** — the BuyerRecon → AMS PoI Core bridge
   adapter (mapping BuyerRecon evidence into `PoiInputsV3`) is a
   future PR. No timing locked yet.
3. **`ProductContextProfile` shape** — §12 sketches the structure;
   the concrete TypeScript / SQL shape lands in a future PR
   (likely PR#13 or later, after POI Sequence proof on Hetzner).
4. **Timing Window Detection module split** — in-session timing
   (§14.A) probably lives close to POI Sequence; cross-session
   timing (§14.B) lives in future BuyerRecon Series Core. Exact
   module boundary lands in a future planning PR.
5. **Trust Core bridge** — needs the AMS Trust Core engine call
   path designed BuyerRecon-side. Future PR.

### Not-now items

- **Render production deploy** — blocked by A0 P-4.
- **Customer-facing output renderer** — blocked until Policy Pass 2
  + Lane A/B projection land.
- **ML / learned weights** — explicit non-goal across all layers.
- **Private customer code paths** — explicitly forbidden by §13
  hard rule.
- **Buyer-intent claims** — never made by evidence/scoring/
  Product-Context-Fit layers alone; require Policy + Trust.

---

**End of locked workflow truth file v0.1.** Future revisions are
versioned (`buyerrecon-workflow-locked-v0.2.md`, etc.) and require
Codex review + Helen sign-off, mirroring the planning-doc cadence.
