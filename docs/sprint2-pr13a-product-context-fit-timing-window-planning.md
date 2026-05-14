# Sprint 2 PR#13a — Product-Context Fit + Timing Window Planning

**Status.** PLANNING ONLY. Docs-only. No code, no `package.json`,
no migration, no `schema.sql` change, no DB writes, no `psql`, no
Render. PR#0–PR#12e implementation files are referenced read-only.

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (workflow
  truth file; commit `c063784`) — §11 Product-Context Fit, §12
  ProductContextProfile, §13 universal taxonomy / category template
  / buying-role lens / site mapping, §14 Timing Window Detection
  (in-session vs cross-session split).
- `docs/sprint2-pr12e-poi-sequence-table-observer.md` (Hetzner-PASS
  closure at commit `ab9d800`) — PR#12 chain (a–e) closed; durable
  POI Sequence evidence layer locked at v0.1.
- `docs/sprint2-pr12d-poi-sequence-observations-table-worker.md`
  (commit `a0713c9`) — durable `poi_sequence_observations_v0_1`
  table.
- `docs/sprint2-pr12c-poi-sequence-observations-table-worker-planning.md`
  (commit `f991e0b`) — Helen sign-off OD-1..OD-14 cadence
  precedent.
- PR#11c precedent for durable-table planning; PR#12c precedent for
  this same docs-only planning shape.

---

## §1 Title and PR scope

PR#13a plans the next evidence-consumer layer downstream of POI
Sequence: **Product-Context Fit + Timing Window Detection**. It
produces:

- One planning doc (this file).

It produces NO code, NO migration, NO schema change, NO DB write,
NO CLI, NO npm script, NO Render touch. PR#13b is the implementation
PR that follows, gated on Codex review + Helen sign-off of this
planning doc. PR#13a does NOT pre-commit PR#13b to a specific
implementation shape — see §14 for the four options Helen chooses
between.

---

## §2 Background — where PR#13a sits

PR#12 chain (a–e) closed the POI Sequence evidence layer at v0.1.
Durable evidence available downstream:

| Table | Source | Notes |
| --- | --- | --- |
| `poi_observations_v0_1` | PR#11c migration 014 | Per-session POI envelopes; PR#11d table observer Hetzner-PASS |
| `poi_sequence_observations_v0_1` | PR#12d migration 015 | Per-session POI Sequence facts (pattern class, repetition, progression, duration, Stage 0 carry-through); PR#12e table observer Hetzner-PASS |

These two tables are the **only durable BuyerRecon-side evidence
inputs** PR#13b is allowed to consume by default. Earlier-layer
tables (`session_features`, `session_behavioural_features_v0_2`,
`stage0_decisions`, raw ledgers) remain forbidden unless a future
sign-off explicitly opens a side-read with documented justification.

**Workflow truth file §11–§14 define the contract this PR plans.**
Specifically:
- §11: Product-Context Fit emits *observation bands* (weak / possible
  / moderate / strong) and reasons; it MUST NOT make hard buyer-intent
  claims.
- §12: `ProductContextProfile` is a versioned configuration envelope;
  every PCF observation MUST record the versions in use for replay.
- §13: universal taxonomy / category template / buying-role lens /
  site mapping are the four configurable knobs. **No private
  customer scoring code.**
- §14: Timing Window splits into *A in-session / short-window* (this
  PR's scope) and *B cross-session continuity* (future AMS Series
  Core territory; NOT this PR).

---

## §2.1 AMS Product Layer reference alignment

**AMS already contains a canonical Helen-authored BuyerRecon Product
Layer.** Read-only audit of `/Users/admin/github/keigentechnologies/ams`
confirmed:

| AMS surface | What it is |
| --- | --- |
| `docs/algorithms/BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0.md` | 75 KB v2.0 spec, "Ready for Implementation — MVP Thin Layer" |
| `internal/products/buyerrecon/scorer/*.go` | Fully implemented Fit / Intent / Window / TRQ / ProductDecision in Go |
| `internal/products/buyerrecon/adapter/*.go` | Feature / enrichment / milestone / snitcher / thinsdk adapters parsing `ProductFeatures.Namespace` → `BuyerReconProductFeatures` |
| `internal/products/buyerrecon/sites/sites.go` | Keigen-owned offer-site registry (separate concept from PR#13a `site_mapping`; see §4.5) |
| `internal/contracts/features.go` | Frozen `ProductFeatures { Namespace json.RawMessage }` contract |

### Canonical AMS Product Layer decomposition

The AMS BuyerRecon Product Layer composes a `ProductDecision`
(proposal-shaped; consumed downstream by Trust + Policy) from four
sub-scores:

- **Fit** — ICP / firmographic / page-pattern / non-fit-marker /
  hard-suppress logic.
- **Intent** — proxy / pricing / research / POI / Series-derived
  signals.
- **Window** — recency / revisit concentration / Series-timing /
  session-strength / burst.
- **TRQ** — composite ("Trustworthy, Ready, Qualified") with
  `TRQScore`, `TRQConfidence01`, `TRQBand`.

These four are **AMS canonical and reserved**. PR#13b runtime source
MUST NOT mint or redefine them. See §17.

### Where PR#13a / PR#13b sit

PR#13a / PR#13b are **upstream** of the AMS BuyerRecon Product Layer.
They prepare the BuyerRecon-side evidence features (POI + POI
Sequence shape) that can later be wrapped into the JSON shape AMS
expects under `ProductFeatures.Namespace`.

```
poi_observations_v0_1 + poi_sequence_observations_v0_1
      │
      ▼  PR#13b BuyerRecon-side evidence adapter / observer
      │   (Product-Context Fit + Timing Window — this PR's scope)
      │
      ▼  BuyerReconProductFeatures-shaped JSON
      │   (placed under ProductFeatures.Namespace by a future bridge)
      │
      ▼  AMS BuyerRecon Product Layer (canonical)
      │   Fit / Intent / Window / TRQ → ProductDecision
      │
      ▼  Trust Core → Policy Pass 2 → Lane A/B → Output
```

### What PR#13b is NOT

- **PR#13b is NOT a Product Layer implementation.** Fit / Intent /
  Window / TRQ / ProductDecision are AMS-owned.
- **PR#13b does NOT duplicate AMS scoring logic.** Appendix D weights,
  band thresholds, hard-suppress rules, and the TRQ formula belong to
  AMS Product Layer.
- **PR#13b does NOT implement AMS Series Core** (cross-session
  continuity remains the truth file §10 reserved territory).
- **PR#13b does NOT bridge into AMS at runtime.** The bridge that
  hands `BuyerReconProductFeatures` JSON to AMS is a separate future
  PR; PR#13b only ensures the BuyerRecon-side feature preparation
  produces a JSON shape that is **AMS-compatible** when that bridge
  lands.

### Enrichment clarification

PR#13b does **no enrichment** (see §9). AMS Product Layer downstream
**may** perform documented firmographic enrichment per its own MVP
(50 ms circuit breaker IP-to-company lookup). PR#13b's "no
enrichment" rule applies to PR#13b only and does not constrain AMS's
canonical downstream behaviour.

---

## §3 Non-goals and hard boundaries

PR#13a is planning only. PR#13b implementation, when defined, MUST
NOT do any of the following — and PR#13a does not authorise them:

| Forbidden | Why |
| --- | --- |
| Final buyer-intent claims | PCF emits observation bands, not commercial verdicts. Buyer-intent claims belong to Policy Pass 2 + Trust Core downstream (truth file §16–§17). |
| Customer-facing output | Output layer is truth-file §19, gated by Policy Pass 2 + Lane A/B (§17–§18). PR#13a/PR#13b are internal evidence/feature observation. |
| Trust / Policy reads or writes | Trust Core is AMS canonical (§16); Policy passes 1 + 2 are §15 / §17. Not in this PR's chain. |
| Lane A / Lane B reads or writes | Lane projection is §18; output governance, not evidence. |
| Scoring-output tables (`scoring_output_lane_a`, `scoring_output_lane_b`) | Forbidden source/destination. |
| AMS Series Core runtime naming | Reserved per truth file §10 + §23. Cross-session cadence / compression / acceleration / revisit / SeriesConfidence are future BuyerRecon work and MUST NOT appear in PR#13b runtime source. |
| Private customer scoring code | All customer-specific behaviour is expressed as versioned templates / mappings / configs / profiles (§13 hard rule). |
| Raw ledger reads | `accepted_events`, `rejected_events`, `ingest_requests` are forbidden for this layer. |
| Collector / SDK changes | Sprint 1 / Track A territory. |
| Reason codes / verdicts / customer report fields | Forbidden namespace per `scoring/forbidden_codes.yml`. |
| Personal identification / deanonymisation / enrichment | Privacy boundary (§9). |
| Render production deploy | A0 P-4 still blocking. |
| Touching workers (PR#11c, PR#12d) | Worker code is locked; PR#13b is a new evidence-consumer layer, not a worker patch. |
| Modifying migrations 001–015 or `schema.sql` | Forward-only; new migrations only if PR#13b option D is chosen. |

---

## §4 Concept definitions

### 4.1 ProductContextProfile

A **versioned configuration envelope** that defines how POI + POI
Sequence + Timing evidence is interpreted for a specific customer
workspace / site. Replayable, comparable, rollback-safe.

- Carries the four configurable knobs from §13 of the truth file:
  `universal_surface_taxonomy`, `category_template`,
  `buying_role_lens`, `site_mapping`.
- Plus `excluded_mapping`, `primary_conversion_goal`, `sales_motion`.
- Plus per-knob version stamps for replay.
- **Not customer scoring code.** A profile is *data + config*,
  evaluated by shared generic logic.

### 4.2 universal_surface_taxonomy

Generic page/surface classes that apply across B2B websites. v0.1
seed candidates (Helen OD-2 finalises):

`homepage`, `pricing`, `demo_request`, `case_study`, `integration`,
`comparison`, `trust_security`, `documentation`, `contact`,
`resource`, `careers`, `legal_terms`, `legal_privacy`, `blog_post`,
`product_overview`, `feature_detail`, `developer`, `unknown`.

Constraints:
- Independent of BuyerRecon's own site. Must apply to arbitrary B2B
  sites once a `site_mapping` is supplied.
- Stable namespace; additions only via versioned bumps.
- `unknown` is the explicit fallback; every site mapping MUST resolve
  every URL pattern to a taxonomy label OR explicitly mark
  `unmapped` (see §4.7 site_mapping).

### 4.3 category_template

A versioned **category lens** that interprets universal-surface
sequences for a category of B2B site. v0.1 seed candidates (Helen
OD-1 finalises):

| Template | Use case |
| --- | --- |
| `generic_b2b` | Default fallback when no category-specific template is known |
| `b2b_software` | SaaS / software vendors |
| `b2b_service_agency` | Service / agency / consulting providers |
| `high_ticket_exporter` | Enterprise / high-ticket / international export sales |

A template defines:
- **Expected surface importance**: per-surface weight or ranking
  (e.g. `pricing` matters more than `careers`).
- **Common conversion pathways**: ordered patterns of POI Sequence
  expected on the path to `primary_conversion_goal` (e.g.
  `homepage → product_overview → pricing → demo_request`).
- **Useful POI groupings**: e.g. group `documentation` + `developer`
  + `integration` as "technical evaluation" for the
  `technical_evaluator` lens (§4.5).

Constraint: templates are **generic data**, not private customer
logic. A customer adopting `b2b_software` gets the same generic
template every other `b2b_software` customer gets.

### 4.4 buying_role_lens

A cross-cutting probabilistic lens applied to surface/sequence
evidence. v0.1 seed candidates (Helen OD-9 finalises whether to
include in PR#13b or defer):

`economic_buyer`, `technical_evaluator`, `risk_compliance_reviewer`,
`procurement_logistics`, `operator_user`, `practitioner_user`,
`partner_channel`, `unknown`.

Constraints:
- **Probabilistic / contextual** language only. No final identity
  claim. No personal identification.
- Outputs are weighted hints (e.g. "this session's POI Sequence is
  consistent with technical_evaluator behaviour"), not assignments.
- A session may carry multiple non-zero lens weights — that is
  expected, not a bug.
- Lens weights MUST NOT be customer-facing without an explicit later
  PR defining safe output boundaries.

### 4.5 site_mapping

Maps site-specific URL / path patterns to `universal_surface_taxonomy`
labels. Versioned and testable. Per-workspace / per-site granularity.

Constraints:
- MUST allow `unmapped` (without failure) for URLs that match no
  pattern. The PCF layer treats `unmapped` as `unknown` taxonomy
  for evaluation purposes.
- MUST define **precedence** when multiple patterns match
  (longest-prefix-wins is the v0.1 recommendation; Codex/Helen
  decide via OD).
- MUST define **conflict handling** when two patterns at the same
  precedence resolve to different taxonomy labels (recommendation:
  reject the mapping at load time; never silently pick one).
- MUST NOT carry raw URL query strings, fragments, or user-specific
  path segments. Patterns operate on normalised path prefixes /
  globs only.

**Distinction from AMS `sites` registry.** AMS has its own
`internal/products/buyerrecon/sites/sites.go` registry that maps
Keigen-owned offer site IDs (e.g. `buyerrecon_com`,
`realbuyergrowth_com`, `fidcern_com`, `timetopoint_com`,
`keigen_co_uk`) to `Hostname` / `OfferContext` / `ReportLabel`. That
is a **different concept** from PR#13a's `site_mapping`:

| Concept | What it maps | Scope |
| --- | --- | --- |
| AMS `sites.SiteMeta` | Keigen-owned offer SiteID → Hostname / OfferContext / ReportLabel | Internal Keigen offer registry |
| PR#13a `site_mapping` | Customer site URL pattern → `universal_surface_taxonomy` label | Per-workspace / per-site customer configuration |

PR#13b MUST NOT replace, read, or mutate the AMS `sites` registry.
The two registries coexist at different layers.

### 4.6 excluded_mapping

Defines surfaces / path patterns excluded from Product-Context Fit
evaluation and Timing Window calculations. Example v0.1 exclusions:

`legal_privacy`, `legal_terms`, `cookie_policy`, `careers`,
`unsubscribe`, `404`, `internal_admin`, `staging_test_paths`,
`blog_post` (when explicitly out of scope for this category template).

Constraints:
- **Excludes from evaluation, does NOT delete source evidence.** The
  underlying POI / POI Sequence rows remain in their durable tables;
  the PCF layer simply does not weigh them.
- Justification: protects evidence quality (e.g. counting cookie-page
  visits in a `b2b_software` evaluation would distort the picture).
- Excluded surfaces are still recorded in PCF observations as
  `evidence_excluded_count` for audit transparency.

### 4.7 primary_conversion_goal

The site's main desired conversion outcome under this
`ProductContextProfile` version. v0.1 seed candidates (Helen OD-4
finalises):

`book_demo`, `request_diagnostic`, `contact_sales`, `download_report`,
`start_trial`, `sign_up`, `request_quote`.

Constraints:
- One **primary** goal per `ProductContextProfile` version.
- Multiple **secondary** goals permitted (e.g. `download_report` as
  a softer secondary while `book_demo` is primary).
- **Conversion goal ≠ buyer intent proof.** Reaching the goal means
  the session touched the conversion surface; it does NOT prove
  buyer-intent or that the conversion converted commercially.

### 4.8 sales_motion

Defines the sales context that shapes timing / actionability
interpretation. v0.1 seed candidates (Helen OD-5 finalises):

`self_serve`, `sales_led`, `partner_led`, `high_ticket_consultative`,
`product_led_assisted`.

Constraints:
- Affects how **freshness / decay / actionability bands** map onto
  observation (e.g. `self_serve` has shorter actionable windows than
  `high_ticket_consultative`).
- **Does NOT prescribe final sales action** in PR#13a/PR#13b.
  Actionability bands are evidence modifiers, not sales playbook
  instructions.

### 4.9 Timing windows (in-session + short-window)

**In-session and short-window timing only.** Cross-session continuity
(cadence / compression / acceleration / revisit / SeriesConfidence)
is **future AMS Series Core territory** (truth file §10) and is NOT
in PR#13a/PR#13b scope.

In-scope timing concepts:

| Concept | Definition |
| --- | --- |
| `first_value_window` | Time from `session.first_seen_at` to first qualifying POI |
| `last_activity_recency` | Time since `session.last_seen_at` (clock-aware; recomputed at evaluation time) |
| `in_session_progression_speed` | Duration / progression_depth (derived from PR#12d `duration_seconds` + `progression_depth`) |
| `revisit_in_window` | Same `session_id` observed within a short window after `last_seen_at` (in-session only; no cross-session lookback) |
| `stale_window_lapse` | `last_activity_recency` > threshold defined per `sales_motion` |

**NOT in scope (future AMS Series Core):**
- `Cadence` (cross-session SessionCount, AvgGapDays, TotalDays)
- `Compression` (cross-session gap shrinkage trend)
- `Acceleration` (cross-session session-rate trend)
- `Revisit` (cross-session, not in-session)
- `SeriesConfidence`

PR#13b runtime source MUST NOT mint AMS reserved names per truth
file §10 + §23.

### 4.10 freshness / decay / actionability bands

Bands are **actionability modifiers**, not commercial-fit proof.
v0.1 seed candidates (Helen OD-7 finalises):

| Band | Meaning |
| --- | --- |
| `hot_now` | Qualifying evidence in the last <T_hot> per `sales_motion` |
| `warm_recent` | Qualifying evidence in <T_warm>, decaying |
| `cooling` | Evidence beyond T_warm but within T_stale |
| `stale` | Evidence beyond T_stale |
| `dormant` | No qualifying evidence in T_dormant |
| `insufficient_evidence` | Not enough POI / POI Sequence rows to band |

Decay inputs:
- Time since last qualifying evidence (POI / POI Sequence row).
- POI Sequence pattern strength (`single_poi` decays faster than
  `multi_poi_linear` or `loop_or_backtrack`).
- Proximity to `primary_conversion_goal` (sequences that reached
  the conversion surface band differently from those that did not).

Determinism requirement: bands MUST be **deterministic and
replayable** given:
- Fixed input evidence rows,
- Fixed `ProductContextProfile` version stamps,
- Fixed evaluation clock timestamp (passed as parameter, not read
  from `Date.now()` inside pure logic).

### Distinction from AMS `WindowState`

PR#13a freshness/actionability bands (`hot_now` / `warm_recent` /
`cooling` / `stale` / `dormant` / `insufficient_evidence`) are
**BuyerRecon-side modifiers**, NOT AMS `WindowState`. AMS Product
Layer already defines its own canonical band enum:

| AMS `WindowState` (reserved downstream) | PR#13a band (this PR) |
| --- | --- |
| `in_window` | `hot_now` |
| `approaching` | `warm_recent` |
| `too_early` | `cooling` |
| `dormant` | `dormant` (word overlap; **no runtime coupling**) |

The two enums are **semantically related but namespace-disjoint**.
PR#13b's bands feed AMS Product Layer indirectly (via the
`BuyerReconProductFeatures.Window` shape) but MUST NOT inherit
the `WindowState` values or be referenced as `WindowState` in
runtime. The word `dormant` appears in both enums by coincidence;
PR#13b runtime source MUST NOT emit `dormant` as an AMS
`WindowState` value or any value associated with the
`WindowFeatures` / `WindowResult` types reserved in §17.

---

## §5 Proposed ProductContextProfile shape

Per truth file §12, structure with version-stamp provenance.
PR#13b implementation may extend; PR#13a locks the v0.1 shape.

```
ProductContextProfile {
  // Identity / scope
  workspace_id:                            text
  site_id:                                 text

  // Versioned content
  product_context_profile_version:         text  -- e.g. 'pcp-v0.1'
  universal_surface_taxonomy_version:      text  -- e.g. 'ust-v0.1'
  category_template:                       text  -- one of the §4.3 enum
  category_template_version:               text  -- e.g. 'b2b_software-v0.1'
  buying_role_lens_enabled:                bool  -- OD-9 may defer
  buying_role_lens_version:                text  -- e.g. 'brl-v0.1'
  site_mapping_version:                    text  -- e.g. 'site_map-v0.1'
  site_mapping:                            jsonb -- pattern → universal_surface
  excluded_mapping_version:                text
  excluded_mapping:                        jsonb -- pattern list
  primary_conversion_goal:                 text  -- one of §4.7 enum
  secondary_conversion_goals:              text[] -- optional
  sales_motion:                            text  -- one of §4.8 enum
  timing_window_model_version:             text  -- e.g. 'tw-v0.1'
  freshness_decay_model_version:           text  -- e.g. 'fd-v0.1'
  product_fit_rule_version:                text  -- e.g. 'pfr-v0.1' — generic eval logic version

  // Provenance
  effective_from:                          timestamptz
  created_at:                              timestamptz
  created_by:                              text  -- internal identifier; not customer-facing
}
```

Per-PCF-observation (future PR#13b output, NOT this PR) MUST record
every `*_version` field above so an audit run can reproduce the
same observation from old evidence even after taxonomies / mappings
/ rules evolve.

---

## §6 Taxonomy / template / mapping model

### Layering (no overlap)

| Layer | Scope | Versioned by |
| --- | --- | --- |
| Universal taxonomy | All customers, all categories | `universal_surface_taxonomy_version` |
| Category template | Per category (e.g. `b2b_software`) | `category_template_version` |
| Buying-role lens | Cross-cutting view | `buying_role_lens_version` |
| Site mapping | Per workspace + site | `site_mapping_version` |
| Excluded mapping | Per workspace + site | `excluded_mapping_version` |

### Customer-configurable boundary

Customers may have different `site_mapping`, `excluded_mapping`,
`category_template` selections, `primary_conversion_goal`,
`sales_motion`. **Customers MUST NOT have**:
- Private scoring code
- Private if-else logic
- Private unversioned ML model
- Bespoke private taxonomy or template that bypasses the versioned
  envelope

All customer-specific behaviour is expressed as versioned
templates / mappings / configs / profiles (truth file §13 hard rule
carried verbatim).

### Load-time validation requirements (PR#13b)

- Every `site_mapping` pattern MUST resolve to a label in
  `universal_surface_taxonomy` (allowlist).
- Pattern conflicts MUST fail closed (reject at load time, not
  silently pick).
- `primary_conversion_goal` MUST be one of the enum values for the
  selected `category_template_version`.
- `sales_motion` MUST be one of the enum values for the selected
  `product_fit_rule_version`.

---

## §7 Timing window + freshness/actionability model

### Inputs (all already on durable BuyerRecon tables)

- `poi_observations_v0_1.first_seen_at`, `.last_seen_at`,
  `.derived_at`, `.stage0_excluded`, `.poi_eligible`, `.poi_key`,
  `.poi_type`, `.poi_observation_version`.
- `poi_sequence_observations_v0_1.first_seen_at`, `.last_seen_at`,
  `.duration_seconds`, `.poi_count`, `.unique_poi_count`,
  `.repeated_poi_count`, `.has_progression`, `.progression_depth`,
  `.poi_sequence_pattern_class`, `.stage0_excluded`,
  `.poi_sequence_eligible`, `.poi_sequence_version`,
  `.poi_observation_version`, `.source_versions`.

### Evaluation parameters

- **Evaluation clock** (`evaluation_at: timestamptz`) — passed in
  explicitly. PR#13b runtime logic MUST NOT call `Date.now()`
  inside pure evaluation functions (mirrors PR#12b / PR#12d mapper
  determinism rule).
- **Profile** — `ProductContextProfile` instance frozen at the
  evaluation moment.
- **Thresholds** — sourced from `category_template` × `sales_motion`
  lookup table; versioned via `timing_window_model_version` +
  `freshness_decay_model_version`.

### Outputs (concept; PR#13b decides surface)

- `pcf_band` (one of §4.10) — actionability modifier
- `pcf_band_confidence` ∈ `[0,1]`
- `timing_window_class` (e.g. `in_session`, `recent`,
  `short_revisit_in_window`, `stale_lapse`) — evidence modifier
- `evidence_excluded_count` — audit transparency
- `pcf_observation_reasons` — versioned **internal** reason tokens
  (NOT customer-facing reason codes; namespace must be disjoint from
  AMS PoI Core / Trust Core / Policy reason codes)

---

## §8 Source boundary

### Allowed source tables (PR#13b default)

- `poi_observations_v0_1` (PR#11c migration 014; Hetzner-PASS)
- `poi_sequence_observations_v0_1` (PR#12d migration 015; Hetzner-PASS)
- `information_schema.tables` / `information_schema.columns`
  (presence + forbidden-column sweep diagnostics, only if PR#13b
  chooses option C or D)

### Forbidden source tables (enforced by future PR#13b static-source
sweep + SQL allowlist tests)

- `accepted_events`, `rejected_events`, `ingest_requests` (raw ledger)
- `session_features`, `session_behavioural_features_v0_2` (lower
  layer; PCF must use POI / POI Sequence persisted evidence, not
  derived features directly. Exception only if Codex/Helen approves
  a documented side-read.)
- `stage0_decisions` (Stage 0 carry-through is via POI /
  POI-Sequence fields, never a re-read)
- `risk_observations_v0_1` (Risk evidence is a separate AMS Risk
  Core consumer concern; PCF does not read Risk directly. A future
  combined-evidence layer can join Risk with PCF outputs after a
  separate PR.)
- `scoring_output_lane_a`, `scoring_output_lane_b` (Lane projection)
- `site_write_tokens` (auth surface)

### No collector / SDK reads

Sprint 1 / Track A territory. PR#13a/PR#13b are evidence-consumer
layers, not evidence-producer layers.

### Stage 0 carry-through

PR#13b uses Stage 0 carry-through fields already present on POI /
POI-Sequence rows (`stage0_excluded`, `poi_eligible`,
`poi_sequence_eligible`, optionally `stage0_rule_id` for
provenance-only audit). **No re-read of `stage0_decisions`.**

---

## §9 Privacy boundary

PR#13a/PR#13b MUST honour:

- **No personal identification.** No `email`, `phone`, `person_id`,
  `visitor_id`, `company_id`, `domain_id`, `account_id`,
  `email_hash`, `person_hash`, `device_fingerprint`, `font_list`.
- **No deanonymisation.** No reverse lookup attempts; no inferring
  identity from session sequences.
- **No enrichment in PR#13b.** No third-party data join; no
  IP-to-company resolution; no reverse-DNS; no firmographic
  enrichment performed by PR#13b. **Scope note:** this rule
  applies to PR#13b (the BuyerRecon-side evidence adapter /
  observer) only. AMS Product Layer downstream **may** perform its
  own documented firmographic enrichment (e.g. AMS MVP's 50 ms
  circuit-breaker IP-to-company lookup) under its own canonical
  ownership; PR#13b does not constrain AMS's downstream behaviour.
  PR#13b must not introduce enrichment, deanonymisation,
  person/company identity claims, or sensitive inference of its
  own.
- **No sensitive inference.** No demographic / protected-class
  inference. No browsing-history reconstruction beyond the in-session
  POI Sequence already persisted.
- **No private customer scoring code.** Customer-specific behaviour
  is data + config (§4.1 / §6), not code.
- **Work at session / site / workspace level only.** No subject
  continuity across sessions in PR#13b scope (that is future AMS
  Series Core territory; truth file §10).
- **Customer mapping / config MUST NOT leak into generic product
  logic.** The shared evaluator reads the customer's profile by
  reference; it does not branch on customer identity.
- **Raw URL query strings, fragments, user-specific path segments
  forbidden** in site_mapping patterns + PCF observations.
- **Anomaly samples (if PR#13b option C or D)** surface BIGSERIAL
  IDs only, per PR#11d / PR#12e precedent. No `poi_key`, no
  `session_id` full value, no payload.

---

## §10 Output boundary

PR#13a is planning only — produces this document, nothing else.

PR#13b output is **internal evidence / feature observation only**
regardless of which implementation option Helen picks. Specifically:

- No customer-facing rendering, dashboard, or report.
- No automated sales action.
- No Lane A / Lane B write.
- No Trust / Policy / customer report column.
- No reason codes in the AMS PoI Core / Trust Core / Policy reason-
  code namespace (PR#13b reasons live in a disjoint internal
  `pcf_*` namespace, never customer-facing).
- No buyer-intent claim language.

A **separate later PR** is required to define safe output boundaries
if any PR#13b observation becomes customer-eligible. That later PR
must pass Policy Pass 2 + Lane A gating per truth file §17–§18.

---

## §11 Versioning / replay / rollback

### Version fields (every PCF observation MUST record)

| Field | Source |
| --- | --- |
| `product_context_profile_version` | Active profile version |
| `universal_surface_taxonomy_version` | Active taxonomy version |
| `category_template_version` | Active template version |
| `buying_role_lens_version` | If lens enabled |
| `site_mapping_version` | Active mapping version |
| `excluded_mapping_version` | Active exclusion version |
| `timing_window_model_version` | Active timing-window thresholds version |
| `freshness_decay_model_version` | Active decay-band thresholds version |
| `product_fit_rule_version` | Active generic-evaluator logic version |
| Source evidence versions | `poi_observation_version`, `poi_sequence_version` carried from inputs |
| `evaluation_at` | Clock timestamp at evaluation |
| `created_at` | Observation row insert time (if option D) |
| `effective_from` (profile level) | Profile activation timestamp |

### Replay requirements

- Given the same input POI / POI Sequence rows + the same set of
  version stamps + the same `evaluation_at`, PR#13b's evaluator MUST
  produce **byte-identical** output. This is a stronger constraint
  than PR#12d's `derived_at`-may-advance semantics — PCF is
  contract-bound for replay so older observations are reproducible
  after profile evolution.

### Comparison requirements

- Two PCF observations with **different profile version stamps**
  but identical evidence inputs MUST be safe to compare side-by-side.
  No data dependency between version-stamp blocks; no
  cross-version state.

### Rollback safety

- Rolling back a profile version (e.g. reverting
  `site_mapping_version` from `v0.2` to `v0.1`) MUST be a pure
  data/config rollback. No PR#13b runtime state requires a
  coordinated code rollback.
- If PR#13b chooses option D (durable table), rollback is
  "deactivate the v0.2 profile; v0.1 stays valid; old v0.2
  observations remain in the table for audit." No `DROP COLUMN`,
  no destructive migration.

---

## §12 Verification expectations for PR#13b

Regardless of which implementation option is chosen, PR#13b must
ship with verification covering:

| Category | Required check |
| --- | --- |
| **Source allowlist** | Only `poi_observations_v0_1` + `poi_sequence_observations_v0_1` reads (+ `information_schema` for option C/D); static-source sweep + SQL allowlist test |
| **No forbidden tables** | Full PR#12e forbidden-table list, plus explicit `risk_observations_v0_1` / `stage0_decisions` exclusion |
| **No write outside scope** | If option D, exactly one write target (`product_context_fit_observations_v0_1`); no writes elsewhere |
| **Forbidden columns** | PR#12e FORBIDDEN_COLUMNS list applied to any new PR#13b table |
| **No AMS Series Core runtime names** | Reserved-name guard from truth file §10 + §23 |
| **Version-stamp completeness** | Every observation row MUST carry every version stamp listed in §11 |
| **Replay determinism** | Same input + same version stamps + same `evaluation_at` → byte-identical output |
| **Privacy posture** | No `poi_key` / `session_id` / payload in samples; masked DSN; recursive forbidden-key sweep |
| **Stage 0 carry-through** | `poi_sequence_eligible = NOT stage0_excluded` carried; no `stage0_decisions` re-read |
| **Exclusion mapping audit** | `evidence_excluded_count` surfaced when excluded surfaces appear in input |
| **Band determinism** | No `Date.now()` / `Math.random()` inside pure evaluator |
| **Hetzner staging proof** | Pre = Post on all source/control tables; Lane A/B 0/0; regression observers all PASS |

---

## §13 OD list for Helen

| # | Open decision | Recommended starting point |
| --- | --- | --- |
| **OD-1** | Initial `category_template` set | `generic_b2b`, `b2b_software`, `b2b_service_agency`, `high_ticket_exporter` |
| **OD-2** | Initial `universal_surface_taxonomy` labels | §4.2 18-label seed; Helen prunes / adds |
| **OD-3** | Whether BuyerRecon's own site mapping is first fixture/demo or generic test only | **Generic test only** — BuyerRecon's site should NOT be the default mapping; truth file §11 explicitly forbids baking BuyerRecon's own surface taxonomy into Product-Context Fit |
| **OD-4** | `primary_conversion_goal` options | §4.7 seed (`book_demo`, `request_diagnostic`, `contact_sales`, `download_report`, `start_trial`, `sign_up`, `request_quote`) |
| **OD-5** | `sales_motion` enum values | §4.8 seed (`self_serve`, `sales_led`, `partner_led`, `high_ticket_consultative`, `product_led_assisted`) |
| **OD-6** | Timing window thresholds (per `sales_motion`) | TBD by Helen — seed defaults: `self_serve` T_hot=4h, T_warm=48h, T_stale=14d; `high_ticket_consultative` T_hot=24h, T_warm=14d, T_stale=90d. Exact values are a Helen call. |
| **OD-7** | Freshness / actionability band names | §4.10 seed (`hot_now`, `warm_recent`, `cooling`, `stale`, `dormant`, `insufficient_evidence`) |
| **OD-8** | PR#13b implementation shape | Pick one of §14 options A / B / C / D |
| **OD-9** | Include `buying_role_lens` in PR#13b or defer | Recommended **defer to a follow-up PR** unless OD-8 picks option A or B — the lens adds complexity that benefits from the simpler-shape baseline first |
| **OD-10** | Minimum runtime proof needed before any customer-facing display | At minimum: full PR#13b chain (planning → impl → Hetzner staging proof) + a separate **Policy Pass 2 + Lane A gating PR** + Helen-locked customer-facing copy review. No customer display from PR#13b alone. |
| **OD-11** | Whether `risk_observations_v0_1` is allowed as a PR#13b source | Recommended **NO** for v0.1 — Risk evidence joins with PCF at the AMS PoI Core / Trust Core layer, not at the PCF observer. Open as a separate combined-evidence PR if needed. |
| **OD-12** | Whether `session_features` / `session_behavioural_features_v0_2` may be side-read | Recommended **NO** for v0.1 — PCF must work from POI / POI Sequence persisted evidence. Lower-layer reads break the "evidence-consumer of durable layers" principle. |
| **OD-13** | Whether PR#13b reasons share namespace with AMS PoI Core reason codes | Recommended **NO** — PR#13b reasons live in a disjoint `pcf_*` internal namespace. Mixing namespaces invites future Trust / Policy / customer-output bleed. |
| **OD-14** | Whether PR#13b output replaces PR#12d POI Sequence rows as the new evidence frontier | Recommended **NO** — PR#13b is an additive evidence-consumer, not a replacement. POI Sequence remains the canonical durable evidence. |
| **OD-15** | Should PR#13b output a `BuyerReconProductFeatures`-shaped JSON envelope that AMS Product Layer can later consume via `ProductFeatures.Namespace`? | Recommended **YES**, but as an **upstream adapter / observer output only** — never by redefining AMS runtime types inside BuyerRecon. PR#13b emits a JSON-shape preview that aligns with AMS's expected `BuyerReconProductFeatures` structure (`Fit` / `Intent` / `Window` sub-blocks at the JSON-key level). A future bridge PR is responsible for actually handing the JSON to the AMS Go runtime; PR#13b only ensures shape compatibility. This avoids a future translation layer and keeps PR#13b aligned with the AMS canonical surface (§2.1). |

---

## §14 PR#13b implementation options

Four options, ordered from least invasive to most. Helen picks via
OD-8.

### Option A — Docs-only contract expansion

**Scope.** Extend `docs/architecture/buyerrecon-workflow-locked-v0.1.md`
§11–§14 with the concrete v0.1 contract for `ProductContextProfile`,
universal taxonomy, category templates, mappings, timing-window
thresholds, and freshness bands. No code. No DB. No runtime.

| Aspect | Detail |
| --- | --- |
| Source reads | None |
| Outputs | Doc only |
| Pros | Lowest risk; preserves planning cadence; lets downstream Trust / Policy contract design proceed against a stable PCF contract before any code lands. |
| Risks | Bigger spec → bigger risk of drift between contract and eventual implementation. Mitigated by Codex + Helen sign-off cadence. |
| Tests / proof | Codex review; no DB; no runtime tests. |
| When Helen chooses it | When the right next move is to stabilise the contract before writing any code. Suitable if Trust / Policy planning needs to move first. |

### Option B — Pure TypeScript mapper/adapter only, no DB

**Scope.** `src/scoring/product-context-fit/{types,classifier,mapper,evaluator,index}.ts`
(pure modules; no DB import). Functions take POI / POI Sequence
records + a `ProductContextProfile` + an `evaluation_at` and return
a `PcfObservation` object in memory. No CLI. No table.

| Aspect | Detail |
| --- | --- |
| Source reads | None (pure functions) |
| Outputs | TypeScript object only (in-memory) |
| Pros | Replay-testable in unit tests with stub inputs; zero DB risk; mirrors PR#10 POI Core Input shape (contract + adapter). Cleanest path to a stable contract validated by tests. |
| Risks | No staging proof against real evidence rows. Limits ability to spot real-data edge cases until a follow-up observer/worker PR. |
| Tests / proof | Vitest unit tests (classification + band determinism + version-stamp completeness + privacy posture). No Hetzner DB proof. |
| When Helen chooses it | When the right next move is a contract + algorithm validated by deterministic unit tests, before any observer wiring. Recommended default if Helen wants algorithmic safety first. |

### Option C — Read-only Product-Context Fit Observer CLI

**Scope.** `src/scoring/product-context-fit-observer/*` + a CLI
script + npm script `observe:product-context-fit`. Reads POI +
POI Sequence; loads a `ProductContextProfile` fixture for testing;
evaluates and emits a JSON report. **No durable table; writes nothing.**
Mirrors PR#11b / PR#12b observer-first cadence.

| Aspect | Detail |
| --- | --- |
| Source reads | `poi_observations_v0_1`, `poi_sequence_observations_v0_1`; `information_schema` for presence probes |
| Outputs | JSON report to stdout (sessions seen, band distribution, exclusion counts, anomaly counters; no payload in samples) |
| Pros | Proves the algorithm against real staging data without DB risk; surfaces real-data edge cases before any durable table commits. Mirrors the proven observer-first cadence (PR#11b → PR#11c → PR#11d, PR#12b → PR#12d → PR#12e). |
| Risks | Profile loading needs a contract decision: from a fixture file in the repo for v0.1, or from a future profile-storage layer. Recommend fixture for option C. |
| Tests / proof | Full vitest stub-client tests + Hetzner staging proof. |
| When Helen chooses it | When the right next move is to prove the algorithm against real staging evidence before committing to a durable table shape. Mirrors PR#12b. **Recommended default for Sprint 2 momentum.** |

### Option D — Durable `product_context_fit_observations_v0_1` table + manual worker + verification SQL

**Scope.** Full PR#12c / PR#12d / PR#12e-style chain compressed into
one PR: migration 016 (new durable table), manual CLI worker,
verification SQL, table observer + Hetzner proof.

| Aspect | Detail |
| --- | --- |
| Source reads | Same as Option C |
| Outputs | Durable row per `(workspace_id, site_id, session_id, profile_versions...)`; manual worker upserts with `ON CONFLICT DO UPDATE`; observer reads back |
| Pros | Stable contract surface for any future Trust / Policy / Lane consumer. |
| Risks | **AMS-alignment risk (new).** AMS BuyerRecon Product Layer is the canonical consumer of BuyerRecon-side features via `ProductFeatures.Namespace` (§2.1). A durable BuyerRecon-side `product_context_fit_observations_v0_1` table risks becoming a **redundant intermediate layer** that AMS doesn't need — AMS expects JSON under `ProductFeatures.Namespace`, not a separate BuyerRecon durable surface. Premature persistence commitment before either (a) Option B/C proves the JSON shape against real staging evidence OR (b) a separate bridge PR has defined how the durable table actually feeds AMS. Plus the standard PR#12-chain risks: largest blast radius, reintroduces compression Helen has resisted, higher Codex review burden. |
| Tests / proof | Migration apply on Hetzner; worker first-run + rerun (idempotency); verification SQL; table observer; full regression pass. Multi-step PR. Plus an explicit AMS-bridge justification doc proving the durable table is the right consumer shape. |
| When Helen chooses it | Only after Option B or Option C has proven the JSON shape against real staging evidence AND a downstream AMS bridge PR has confirmed the durable table is the right consumer surface. **Requires explicit Helen approval after Option B/C proof.** Not a first-step option. |

### Recommended default

**Option C** (read-only Product-Context Fit Observer CLI producing
AMS-compatible JSON preview from existing POI / POI Sequence
evidence), conditional on Codex review + Helen sign-off of this
planning doc. It mirrors the proven PR#11b / PR#12b observer-first
cadence: prove the algorithm against real staging data before any
durable commitment, **and** it produces a JSON preview that aligns
with AMS's expected `BuyerReconProductFeatures` shape under
`ProductFeatures.Namespace` (per OD-15).

If Helen wants the smallest safe implementation path,
**Option B** remains the safe alternative: pure TypeScript
mapper/adapter, no DB, no observer CLI, output validated by unit
tests against fixture inputs. Option B is the lowest-risk way to
prove the JSON shape with no real-DB dependency.

If Helen wants to defer all code, **Option A** stays the path.

**Option D should not be the first PR#13b step.** It requires
explicit Helen approval after Option B or Option C has proven the
JSON shape against real staging evidence AND a separate AMS-bridge
PR has justified the durable BuyerRecon-side table.

---

## §15 Acceptance criteria for PR#13a

This PR is complete when:

1. ✓ `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md`
   exists and covers §1–§16 of this structure.
2. ✓ Codex re-review returns PASS (or PASS WITH NON-BLOCKING NOTES,
   patched docs-only before sign-off).
3. ✓ Helen signs off OD-1..OD-15.
4. ✓ The doc names every reserved AMS Series Core and AMS BuyerRecon
   Product Layer canonical name in "MUST NOT mint / MUST NOT
   redefine" context only — never as a duplicate BuyerRecon runtime
   Product Layer implementation.
5. ✓ The doc names every forbidden source table explicitly.
6. ✓ The doc names every forbidden output (customer-facing, Trust,
   Policy, Lane A/B, AMS Series Core, reason codes in
   shared namespaces).
7. ✓ The doc commits to no implementation in PR#13a.
8. ✓ Commit + push on `sprint2-architecture-contracts-d4cc2bf` after
   sign-off.
9. ✓ Working tree clean post-push; only this doc changed.
10. ✓ No code, no `package.json`, no migration, no `schema.sql`, no
    DB, no `psql`, no Render touched at any point in PR#13a.

---

## §16 Suggested Codex review checklist

Codex should verify:

- ✅ Docs-only — no code / `package.json` / migration / `schema.sql`
  / DB / `psql` / Render
- ✅ No implementation prescribed for PR#13a itself; PR#13b options
  enumerated as alternatives, not a single mandate
- ✅ Source boundary names `poi_observations_v0_1` +
  `poi_sequence_observations_v0_1` as the allowed reads; every
  forbidden table from PR#11d / PR#12d / PR#12e list is reiterated
- ✅ AMS Series Core reserved-name guard reiterated (truth file §10
  + §23); PR#13b runtime MUST NOT mint `SeriesOutput`, `TimeOutput`,
  `seriescore`, `series_version`, `series_eligible`,
  `series_observations_v0_1`, `Cadence`, `Compression`,
  `Acceleration`, `Revisit`, `SeriesConfidence`, `observe:series`
- ✅ Hard boundary: PR#13b does NOT make buyer-intent claims, does
  NOT emit customer-facing output, does NOT write Lane A/B, does
  NOT read Trust / Policy
- ✅ Replay/rollback semantics: PR#13b output is byte-identical given
  the same evidence + version stamps + evaluation clock
- ✅ Privacy posture: no personal identification, no deanonymisation,
  no enrichment, no `Date.now()` / `Math.random()` in pure
  evaluator, anomaly samples ID-only if observer/worker is chosen
- ✅ Customer-config boundary: customer-specific behaviour is
  versioned data/config, never private scoring code (truth file
  §13 hard rule)
- ✅ Stage 0 carry-through only (no `stage0_decisions` re-read)
- ✅ `risk_observations_v0_1` is forbidden direct source for PR#13b
  (OD-11 recommended NO)
- ✅ Reason-code namespace is disjoint from AMS PoI Core / Trust
  Core / Policy (OD-13 recommended NO to shared namespace)
- ✅ Acceptance criteria § are testable / falsifiable
- ✅ The four PR#13b options are scoped honestly with pros / risks
- ✅ Recommended default (Option C — observer CLI mirroring PR#11b /
  PR#12b cadence) is documented but not forced
- ✅ PR#13a explicitly acknowledges AMS canonical BuyerRecon Product
  Layer (§2.1) and does NOT position PR#13b as a duplicate or
  replacement
- ✅ PR#13b does NOT duplicate AMS `Fit` / `Intent` / `Window` / `TRQ`
  / `ProductDecision` scoring logic
- ✅ AMS reserved-name guard is present (§17) and covers every name
  listed by the AMS audit (Fit*/Intent*/Window*/TRQ*/Product*
  families + `FIT.*` / `INTENT.*` / `WINDOW.*` reason-code
  namespaces)
- ✅ PR#13b output shape can align with `BuyerReconProductFeatures`
  under `ProductFeatures.Namespace` if OD-15 is YES (recommended)
- ✅ PR#13b actionability bands (`hot_now` / `warm_recent` /
  `cooling` / `stale` / `dormant` / `insufficient_evidence`) are
  documented as NOT AMS `WindowState`; the coincidental `dormant`
  overlap is namespace-disjoint with no runtime coupling

---

## §17 AMS reserved-name guard

**PR#13b runtime source MUST NOT mint or redefine any of the
following AMS-owned names.** Mirrors the workflow truth file §10 +
§23 frozen-name guard pattern applied to AMS Series Core. Reserved
because AMS BuyerRecon Product Layer (§2.1) already owns them at
v2.0 in `internal/products/buyerrecon/scorer/*.go` +
`internal/contracts/features.go` + `internal/engines/interfaces.go`.

### Reserved type / field names

**Fit family**
- `Fit`
- `FitFeatures`
- `FitResult`
- `FitScore`
- `FitConfidence01`
- `NonFitMarkers`
- `HardSuppress`

**Intent family**
- `Intent`
- `IntentFeatures`
- `IntentResult`
- `IntentScore`
- `IntentState`

**Window family** (note overlap with PR#13a "Timing Window" concept —
the planning-doc concept is allowed; the runtime types below are not)
- `Window`
- `WindowFeatures`
- `WindowResult`
- `WindowState`
- `in_window`, `approaching`, `too_early` (as AMS `WindowState` enum
  values; `dormant` is coincidental word overlap — see §4.10 — but
  PR#13b runtime MUST NOT emit it as an AMS `WindowState` value)

**TRQ family**
- `TRQ`
- `TRQResult`
- `TRQBand`
- `TRQScore`
- `TRQConfidence01`
- `RawTRQScore01`

**Product Layer contracts**
- `ProductDecision`
- `ProductFeatures`
- `ProductScorerInput`
- `ProductScorer`
- `BuyerReconConfig`
- `BuyerReconProductFeatures`
- `RequestedAction`

**Reason-code namespaces** (PR#13b reasons MUST live in a disjoint
namespace; the recommended convention is `pcf_*` or
`product_context_*` per OD-13)
- `FIT.*`
- `INTENT.*`
- `WINDOW.*`

### Documentation vs runtime

- **Documentation, comments, and tests MAY reference these names**
  when explaining the AMS alignment boundary (e.g. "produces JSON
  shape compatible with `BuyerReconProductFeatures`").
- **Runtime TypeScript source MUST NOT redefine these names** as
  TypeScript types, classes, interfaces, exported constants,
  variable names, JSON output keys at the type-defining level, or
  any identifier that competes with the AMS canonical declaration.
- The only valid way to use these names in BuyerRecon runtime is a
  **future explicit AMS-bridge PR** that integrates with the AMS Go
  runtime (out of PR#13b scope).

### PR#13b naming convention

PR#13b internal observer / adapter concepts should use a
namespace-disjoint convention such as:

| Concept | PR#13b name | Maps later (via bridge) to AMS |
| --- | --- | --- |
| PCF observation envelope | `PcfObservation` / `product_context_observation` | wraps fields that may BECOME `BuyerReconProductFeatures` JSON |
| Pattern-strength feature | `pcf_pattern_strength_*` | feeds AMS `IntentFeatures` / `WindowFeatures` |
| Actionability band | `pcf_actionability_band` / `pcf_band` (§4.10) | informs AMS `WindowFeatures` indirectly |
| Reason token | `pcf_*` (e.g. `pcf_evidence_strong`, `pcf_evidence_thin`) | disjoint from AMS `FIT.*` / `INTENT.*` / `WINDOW.*` |
| Profile envelope | `ProductContextProfile` (truth file §12) | a BuyerRecon-side configuration concept; not an AMS type |

### Static-source enforcement (PR#13b)

PR#13b implementation tests should include a static-source sweep
(mirroring PR#12e test Group J) that fails the build if any
reserved name in this section appears as an identifier in PR#13b
TypeScript runtime source. Documentation comments stripped before
the sweep; the sweep operates on active source only.

---

**End of PR#13a planning document.**
