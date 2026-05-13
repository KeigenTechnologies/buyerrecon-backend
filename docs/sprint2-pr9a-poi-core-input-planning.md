# Sprint 2 PR#9a — POI Core Input Contract Planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation work. No code, no migration, no `schema.sql` change,
no `psql`, no DB touch, no collector / app / server / auth change.
No PR#6 / PR#7 / PR#8 code modification. PR#0–PR#8b implementation
files are referenced read-only.

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#8b pushed + Hetzner-proven) | `011b6c29c6016ef4b13ecdfc1576eea3d54006ee` |
| Prior closed commits | PR#0 `d4cc2bf` · PR#1 `bea880d` · PR#2 `3d88177` · PR#3 `4318e02` · PR#4 `cc2ae4c` · PR#5 `baa17f9` · PR#6 plan `9794210` · PR#6 impl `de76950` · PR#6 patch `1cd9ac1` · PR#7a `9667106` · Codex config `9a64669` · PR#7b `987db3d` · PR#8a `09d0145` · PR#8b `011b6c2` |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing shared-core workflow)
- AMS `docs/algorithms/POI_CORE_*` (POI Core algorithm spec — read-only reference)
- AMS `internal/poicore/` (existing POI core code — read-only reference)
- `docs/sprint2-pr7a-risk-core-bridge-contract.md` (precedent contract shape)
- `docs/sprint2-pr8a-risk-core-bridge-observer-planning.md` (precedent observer-planning shape)
- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md` (Helen-signed §0 architecture correction)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` (P-4 Render production still blocking)
- BuyerRecon prior planning + impl docs (PR#0–PR#8b)

---

## §1 Status / upstream proof

PR#8b — the **Risk Core Bridge Observer** — has completed Hetzner
staging proof with the following gate signals all green:

| Gate | Result |
| --- | --- |
| Branch synced to PR#8b HEAD | `011b6c2` |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| Targeted observer tests | 66 / 66 PASS |
| Full suite | 41 files / 2232 tests PASS |
| OBS boundary | `OBS_WORKSPACE_ID=buyerrecon_staging_ws`, `OBS_SITE_ID=buyerrecon_com`, `OBS_WINDOW_HOURS=720` |
| DB target | Hetzner staging — host `127.0.0.1:5432`, db `buyerrecon_staging` |
| PRE/POST source-table parity | accepted_events 14·14, ingest_requests 14·14, rejected_events 0·0, risk_observations_v0_1 2·2, scoring_output_lane_a 0·0, scoring_output_lane_b 0·0, session_behavioural_features_v0_2 16·16, session_features 8·8, stage0_decisions 8·8 |
| Observer exit code | 0 |
| `rows_scanned` / `envelopes_built` / `rejects` | 2 / 2 / 0 |
| `behavioural_feature_version_distribution` | `behavioural-features-v0.3: 2` |
| `missing_sbf_evidence_ref_count` | 0 |
| ContextTags emitted | `ZERO_FOREGROUND_TIME: 2` · `NO_MEANINGFUL_INTERACTION: 2` |
| `stage0_excluded_count` / `eligible_for_buyer_motion_risk_core_count` | 0 / 2 |
| `run_metadata.source_table` | `risk_observations_v0_1` |
| `run_metadata.bridge_envelope_version` | `risk-core-bridge-envelope-v0.1` |
| Render production | UNTOUCHED + still blocked (A0 P-4) |
| Customer-facing output | NONE — observer is internal engineering diagnostic |
| Envelope persistence | NONE (PR#8a OD-8) |

The Hetzner staging proof passes all PR#8a invariants: no source table mutated,
no Lane A/B rows, no secrets printed, full session_id never appears in the
report (masked via `truncateSessionId`). PR#8b is the **upstream gate** that
unlocks PR#9a planning.

---

## §2 Why PR#9a exists

After Risk Core bridge observer PASS, the next shared-core primitive
on the **AMS shared core priority** is **POI**, not Policy, not
Trust, not a product adapter, not a dashboard, not a Lane A/B writer.

The AMS shared-core order (locked):

1. **Risk** — is this behavioural evidence risky / low-integrity?
2. **POI** — what object / surface / entity is the behaviour attached to?
3. **Series** — is there repeated / patterned behaviour over time?
4. **Trust** — how much should this evidence chain be trusted?
5. **Policy** — what action / output is allowed?

Product adapters (BuyerRecon, future Real-Buyer-Growth, future
Keigen suite products) come **AFTER** these shared cores, NOT
before. PR#6 + PR#7 established the Risk-input path. PR#9a plans
the next shared-core surface: POI.

**Why POI, not Policy / Trust / product adapter?**

- **POI before Policy.** Policy decides actions. Decisions over
  what surface? — POI is the addressable unit policy refers to.
- **POI before Trust.** Trust scores evidence chains. Evidence
  attached to what entity? — POI gives evidence a stable target.
- **POI before product adapter.** Product adapters interpret the
  output of shared cores for a specific product (BuyerRecon
  buyer-fit, future RBG outreach surface, etc.). They need POI to
  reason about *where* the behaviour happened.
- **POI before dashboards / Lane A/B writers.** Dashboards render
  policy output. Lane A/B is Policy Pass 1 projection (still
  deferred). Neither can land before POI exists.
- **POI before any further BuyerRecon product code.** The
  buyerrecon-backend repo has accumulated Risk-Core evidence and
  Stage 0 gate plumbing. The next *non-product* primitive is the
  one that lets behaviour attach to surfaces — POI.

This planning doc keeps PR#9a **at the contract level**. Any code
work happens later in PR#10 (or its successor).

---

## §3 POI definition

### §3.1 Generic AMS POI

A **POI** is a *normalized Object of Interest* that evidence can
attach to **across products**. The same POI primitive serves:

- BuyerRecon (page / route / CTA / form / offer surface)
- Future Keigen-suite products (whatever each product names its
  object: real-buyer-growth surfaces, ArtCulture-AI piece pages,
  Fidcern asset surfaces, etc.)
- Future analytical layers (POI-conditioned Risk, POI-conditioned
  Series, etc.)

The shared-core POI primitive must NOT carry product-specific
semantics. It is a normalized addressable object with a stable
key, a typed taxonomy, and a lineage chain.

POI primitives are **NOT** any of the following:

- A scoring decision over a POI (that's POI-conditioned scoring,
  downstream).
- A customer-facing label for the POI ("hot page", "buyer
  surface", etc. — those are product adapter concerns).
- A claim about the **person** who interacted with the POI (that's
  identity, explicitly out of scope — see §6).
- A claim about the **company** that owns the POI (that's
  enrichment, explicitly out of scope).

### §3.2 BuyerRecon v0.1 POI (narrow first instance)

For BuyerRecon Sprint 2 / first implementation, **BuyerRecon POI**
is **surface-centric** only — not person-centric, not company-centric,
not IP-derived. Candidate POI types for v0.1:

| POI type | Description | Example POI key |
| --- | --- | --- |
| `page_path` | Normalized request path. Query strings stripped or filtered to a safe allowlist. | `/pricing`, `/demo` |
| `route` | Logical route pattern after path normalisation (collapses `/post/123` and `/post/456` into `/post/:id`). | `/post/:id` |
| `cta_id` | Stable CTA identifier emitted by the SDK (e.g. `cta_id` payload field). Allowlist-shaped, no raw text. | `cta_pricing_book_demo` |
| `form_id` | Stable form identifier (form `id` attribute or SDK form taxonomy). | `form_signup_email_v2` |
| `offer_surface` | Coarse offer-type surface class (demo / pricing / trust / footer). | `offer.demo` |
| `referrer_class` | Coarse referrer category (search / social / email / direct / unknown). NEVER the raw referrer URL. | `referrer.search` |
| `utm_campaign_class` | Optional. Allowlist-shaped UTM campaign label. May be excluded from POI v0.1 and only carried as context — see OD-4. | `campaign.q2-launch-2026` |

**BuyerRecon POI v0.1 explicitly EXCLUDES:**

- Person identity (`person_id`, `visitor_id`, `email_id`, anything
  that identifies a human).
- Company identity (`company_id`, `domain_id`, anything that
  identifies an organisation).
- IP-derived entity (`ip_company`, `ip_org`, `asn_id`, etc.).
- Raw URL with uncontrolled query parameters (`/checkout?token=...`).
- Cookie-derived identity.
- Hashed identity (`person_hash`, `email_hash`, etc.).
- Person-fingerprint features (device fingerprint, font lists, etc.).

These exclusions are HARD per §6 and the OD-3 sign-off below.

---

## §4 Candidate input evidence

The future implementation (PR#10 or later) will need to read from
upstream layers to derive POI. Each candidate is evaluated for
direct-read suitability under the *prefer-derived-layers* principle.

### §4.1 Allowed / conditional reads (recommended for future implementation)

| Source | Suitability for POI derivation | Notes |
| --- | --- | --- |
| `session_behavioural_features_v0_2` (PR#1 + PR#2) | **YES** — derived layer | Already carries cadence / velocity / refresh-loop features per session. Candidate input for deriving session+surface POI evidence without re-reading the raw event ledger. |
| `session_features` (PR#11) | **YES** — derived layer | Carries first-seen / last-seen / dwell / page-count per session. Provides natural POI-aggregation context. |
| `risk_observations_v0_1` (PR#6) | **CONDITIONAL — observer/join context by default, NOT a POI derivation input** | Default OD-5 recommendation keeps POI independent from Risk to avoid a Risk↔POI cycle. A future observer may read `risk_observations_v0_1` as join context (for example, "POI observed near Risk evidence") without using Risk to derive the POI key. It becomes a POI derivation input only if Helen explicitly selects that OD-5 path in writing. |
| `stage0_decisions` (PR#5) | **YES, read-only side-read for eligibility/provenance only** | Mirrors PR#7a / PR#8a §5 usage. Stage 0 is a gate, not a POI source. Carrying its `excluded` flag + `rule_id` lets POI evidence flag "session was Stage-0-excluded". |
| `evidence_refs` (on any derived row) | **YES** | Preserve the existing lineage chain so the future POI observer can audit back to the source SBF / Stage 0 row. |

### §4.2 Forbidden reads (default v0)

| Source | Status | Reason |
| --- | --- | --- |
| `accepted_events` | **NO** (default) — audit ledger only | PR#9a prefers derived layers. Allowing a raw-ledger read for POI would let POI bypass PR#1 / PR#2 lineage and re-derive features from raw events. If a specific lineage-audit need surfaces, it requires a **contract revision** (see OD-5). |
| `rejected_events` | **NO** | Out-of-scope. Stage 0 is the gate for invalid traffic. |
| `ingest_requests` | **NO** | Request-layer evidence is Stage 0's territory. POI is surface-centric, not request-centric. |
| `site_write_tokens` | **NO** | Auth surface. Never read by analytical layers. |
| `accepted_events.raw` JSONB (the original SDK payload) | **NO** | Carries raw URLs with query strings + raw event property fields. Privacy-unsafe for POI; reach only through the derived feature layer. |
| `accepted_events.canonical_jsonb` | **NO** | Same as raw — internal collector canonicalisation, not for POI. |
| `accepted_events.user_agent` / `ip_hash` | **NO** | Person-correlation surface. Not relevant for surface-centric POI. |
| `scoring_output_lane_a` / `scoring_output_lane_b` | **NO** | Downstream of POI. Reading them would invert the layering. |

### §4.3 Principle

**POI v0.1 reads only from the existing derived feature / evidence
layers needed to produce independent surface evidence, and from PR#5
Stage 0 for eligibility/provenance.** By default, POI stays
independent from Risk: `risk_observations_v0_1` is observer/join
context only, not a POI derivation input. It may become an input only
if Helen explicitly selects that OD-5 path. POI does not bypass
lineage into the raw event ledger. Any raw-ledger or Risk-as-input
expansion requires explicit contract amendment with Helen sign-off.

---

## §5 Proposed PR#10 or later implementation shape

Two future-implementation options. **Helen picks one in OD-2.**

### §5.1 Option A — POI input contract only (lowest risk)

PR#10 = `PoiCoreInput` TypeScript contract + fixtures + tests. No DB.

Deliverables:

- `src/scoring/poi-core/types.ts` — `PoiCoreInput`, `PoiKey`,
  `PoiType` enum (page_path / route / cta_id / form_id /
  offer_surface / referrer_class / utm_campaign_class), `PoiLineage`,
  `PoiObservation` (in-memory shape, not persisted).
- `src/scoring/poi-core/normalise.ts` — pure normalisation: query
  string stripping, route-pattern derivation, CTA/form allowlist
  validation, referrer-class categorisation.
- `src/scoring/poi-core/adapter.ts` — pure
  `buildPoiCoreInput(sessionRow, ...)` adapter (mirrors PR#7b
  shape — pure function, no I/O).
- `tests/v1/poi-core.test.ts` — pure tests (mirrors PR#7b test surface).
- Optionally `docs/sprint2-pr10-poi-core-input.md` — implementation report.

Pros:
- Smallest blast radius. Zero DB risk.
- Codex-reviewable in one pass.
- Mirrors PR#7a contract / PR#7b adapter / PR#8b observer cadence.
- Provides the input type the future Risk-Core-style observer
  (call it PR#10b or PR#11) needs.

Cons:
- No production data observed yet. Real-world POI distribution is
  still unknown when PR#10 ships.
- Requires a follow-on PR (analogous to PR#8b) to actually run the
  observer against staging data.

### §5.2 Option B — Derived `poi_observations_v0_1` table + read-only observer

PR#10 = migration 014 (NEW table) + worker that derives POI from
PR#5 / PR#1 / PR#2 / PR#6 derived rows + read-only observer CLI.

Deliverables:

- `migrations/014_poi_observations_v0_1.sql` — additive NEW table.
- `src/db/schema.sql` mirror block.
- `src/scoring/poi-core/types.ts` (same shape as Option A).
- `src/scoring/poi-core/normalise.ts`, `adapter.ts` (same).
- `src/scoring/poi-core/worker.ts` — DB worker mirroring PR#5 /
  PR#6 patterns. RECORD_ONLY. Writes `poi_observations_v0_1`.
- `scripts/run-poi-core-worker.ts` — CLI runner.
- `src/scoring/poi-core-observer/` — read-only observer (mirrors
  PR#8b structure).
- `scripts/poi-core-observation-report.ts` — observer CLI.
- `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`.
- Tests (pure + DB).
- Implementation report doc.

Pros:
- Provides real production-data observability for POI immediately.
- Establishes the POI evidence chain for downstream Series / Trust /
  Policy / product layers.
- Faster end-to-end visibility.

Cons:
- Larger blast radius (schema change + worker + observer + verification).
- Two separate Codex reviews (planning + impl).
- Harder to roll back cleanly.
- Worker design + table column set + role grants all need Helen
  sign-off BEFORE PR#10 implementation.

### §5.3 Recommendation

**Recommended: Option A (contract-only) first.**

Reasons:
- Lowest risk.
- Matches the PR#7a → PR#7b cadence that worked for Risk Core.
- The PR#10b/PR#11 follow-on (observer / table) can then mirror
  PR#8a / PR#8b verbatim — established pattern, faster review.
- A single contract PR is cheaper to revise if Codex surfaces
  taxonomy or normalisation issues.
- The contract is documentation-adjacent, which is the right
  artefact to validate the POI **shape** before any production data
  flows through it.

If Helen chooses Option B (per OD-2), Codex review of the planning
doc must be especially strict on the column list and column
exclusions because the table cannot be reshaped post-migration
without a follow-on schema-change PR.

### §5.4 Draft column categories (Option B only)

If Option B is chosen, the future `poi_observations_v0_1` migration
should include these column categories. **No final SQL here** — just
categories for the planning sign-off:

- **Identity boundaries** — `workspace_id` (TEXT), `site_id` (TEXT),
  `session_id` (TEXT). Mirrors PR#5 / PR#6 boundary pattern.
- **POI key fields** — `poi_type` (TEXT enum), `poi_key` (TEXT —
  normalised key value), `poi_surface_class` (TEXT — coarse label).
  Allowlist-shaped values only.
- **Evidence lineage** — `evidence_refs` (JSONB array). Carries
  references to upstream PR#1 / PR#2 row IDs + versions, PR#5
  Stage 0 eligibility/provenance where used, and PR#6
  `risk_observations_v0_1` only if Helen explicitly selects the
  OD-5 Risk-as-input path. NEVER raw payload.
- **Feature / version fields** — `poi_input_version` (TEXT;
  default `poi-core-input-v0.1`), `scoring_version` (TEXT; mirrors
  `scoring/version.yml.scoring_version`).
- **Timestamps** — `first_seen_at`, `last_seen_at`, `derived_at`,
  `created_at`, `updated_at`. ALL `TIMESTAMPTZ`. `derived_at` is
  the **provenance** timestamp; observer run-time goes only in
  `run_metadata`.
- **Provenance** — `source_table` (TEXT; literal
  `'session_behavioural_features_v0_2'` / `'session_features'` /
  etc.; `'risk_observations_v0_1'` only if Helen explicitly selects
  the OD-5 Risk-as-input path), `source_event_count` (INT),
  `record_only` (BOOLEAN, CHECK IS TRUE).

**Explicit column exclusions** (must NOT appear on the
`poi_observations_v0_1` table):

- ❌ raw URL query strings
- ❌ `user_agent` / raw UA
- ❌ `ip_hash` / `ip` / any IP-derived field
- ❌ `token_hash` / `pepper` / `bearer` / `authorization`
- ❌ `person_id` / `visitor_id` / `email_id` / any person identity
- ❌ `company_id` / `domain_id` / `asn_id` / any company identity
- ❌ `risk_index` / `verification_score` / `evidence_band` /
  `action_recommendation` / `reason_codes` / `reason_impacts` /
  `triggered_tags` / `penalty_total` / any RiskOutput-shaped field
- ❌ `lane_a` / `lane_b` / any Policy Pass 1 projection field
- ❌ `trust_decision` / `policy_decision` / `final_decision` / any
  Trust / Policy output
- ❌ `customer_facing` / `report` / `verdict` / `decision` / any
  customer-rendered output

These exclusions are tested by the same forbidden-key sweep PR#7b /
PR#8b already use.

---

## §6 Hard exclusions

PR#9a planning AND any subsequent implementation MUST exclude:

- **Render production deployment.** A0 P-4 still blocking.
- **Customer-facing output of any kind.** Internal engineering
  diagnostics only.
- **Lane A / Lane B writes.** `scoring_output_lane_a` /
  `scoring_output_lane_b` remain empty until Policy Pass 1 ships
  (deferred).
- **Policy decisions.** No Policy Pass 1 / Policy Pass 2 / runtime
  decision output.
- **Trust decisions.** No Trust Core invocation, no Trust output.
- **Final scoring.** No RiskIndex, no RiskOutput, no `verification_score`,
  no `evidence_band`, no `action_recommendation`.
- **CRM / sales / outreach automation.** No webhook out, no email,
  no Slack, no LinkedIn DMs, no third-party push.
- **Visitor ID / person ID / company deanonymisation.** No identity
  layer. POI is surface-centric only.
- **IP / company enrichment.** No reverse-DNS, no ASN lookup, no
  IP-to-org mapping, no Clearbit-style enrichment.
- **Raw full URLs with query strings.** Path-only or
  normalised-route only.
- **Raw `user_agent` exposure** in any persisted column or report
  field. Even `user_agent_family` (the normalised label) is
  out-of-scope for POI v0.1 — it's a person-correlation surface,
  not a POI surface.
- **Token hashes / IP hashes / peppers / auth headers** anywhere.
- **ML models.** No sklearn, no torch, no xgboost, no onnx, no
  lightgbm. POI normalisation is deterministic.
- **Black-box scoring.** Every POI derivation rule is explicit,
  reviewable, and unit-tested.
- **Dashboard / report renderer.** Reports are JSON for engineers.
- **Product adapter claims.** POI v0.1 is shared-core; no BuyerRecon-
  specific buyer-fit, intent, window, TRQ, action, encode logic.
- **GA4 / GTM / LinkedIn changes.** The collector stays untouched.

---

## §7 Privacy and consent boundary

### §7.1 Surface-centric, not person-centric

POI v0.1 is **object / surface-centric**. The unit of analysis is
"the page / route / CTA / form / offer surface". It is NOT "the
person who interacted with the surface" and NOT "the company they
work for".

### §7.2 No identity enrichment

POI MUST NOT turn into:

- An identity-enrichment layer (no visitor ID, no person ID, no
  email lookup, no company lookup).
- A reverse-DNS / IP-to-org pipeline.
- A device-fingerprint surface.
- A cookie-derived identity surface.

If a future product wants to attach person / company identity to
POI evidence, that's a separate identity-product PR with its own
consent boundary review — NOT a quiet expansion of POI.

### §7.3 Normalized, privacy-safe POI keys

- Path keys are **normalised**. Query strings are stripped or
  reduced to a safe allowlist (no `?token=...`, no `?email=...`,
  no `?session=...`). Trailing slashes are normalised. Case is
  lower-cased.
- Route keys are derived by replacing identifier path segments
  with named placeholders (e.g. `/users/12345` → `/users/:id`).
- CTA / form IDs are accepted only from a documented allowlist
  shape (e.g. `cta_[a-z0-9_]+`). Raw user-entered text (button
  labels, headlines) is NOT a POI key.
- Referrer is reduced to a **class** (search / social / email /
  direct / unknown). The raw referrer URL is NEVER persisted as
  a POI key.
- UTM keys are bounded to allowlist-shaped campaign labels — see
  OD-4 for the open decision on whether UTM is in POI v0.1 at all.

### §7.4 Evidence lineage points at derived layers

The future POI implementation's `evidence_refs[]` MUST point at the
existing derived layer rows used by the selected OD-5 path — PR#1 /
PR#2 plus PR#5 Stage 0 for eligibility/provenance; PR#6
`risk_observations_v0_1` only if Helen explicitly selects
Risk-as-input. Evidence refs never point directly at raw
`accepted_events` rows. This preserves the audit chain without
exposing raw payload bytes.

### §7.5 Path handling helpers

A future `normalise.ts` module should provide pure helpers:

- `normalisePagePath(url: string): string | null` — strips
  protocol, host, query, fragment; lowercases; normalises trailing
  slash; returns null if the path is unsafe (e.g. contains a token
  in a path segment).
- `deriveRoutePattern(path: string, routeRules: RouteRule[]): string`
  — collapses numeric IDs, UUIDs, etc. into named placeholders.
- `classifyReferrer(rawReferrer: string | null): ReferrerClass` —
  maps raw referrer to a coarse class enum. The raw referrer is
  NEVER returned.

Each helper is pure, deterministic, and unit-tested.

---

## §8 Versioning / naming proposal

Suggested versioning + module names. **All require Codex review +
Helen sign-off before implementation.**

| Concept | Proposed name | Pattern source |
| --- | --- | --- |
| POI input contract version | `poi-core-input-v0.1` | mirrors `risk-core-bridge-envelope-v0.1` |
| POI observation row version | `poi-observation-v0.1` (only if Option B) | mirrors `risk-obs-v0.1` |
| Future DB table | `poi_observations_v0_1` (only if Option B) | mirrors `risk_observations_v0_1` |
| Future migration | `migrations/014_poi_observations_v0_1.sql` (only if Option B) | mirrors `013_risk_observations_v0_1.sql` |
| Future verification SQL | `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` (only if Option B) | mirrors `13_*.sql` |
| Future contract module | `src/scoring/poi-core/` | mirrors `src/scoring/risk-core-bridge/` |
| Future observer module | `src/scoring/poi-core-observer/` (Option B only) | mirrors `src/scoring/risk-core-bridge-observer/` |
| Future CLI script | `scripts/poi-core-observation-report.ts` (Option B only) | mirrors `scripts/risk-core-bridge-observation-report.ts` |
| Future npm script | `observe:poi-core-input` or `observe:poi-core` | mirrors `observe:risk-core-bridge` |

The number 014 is the next free migration. PR#9a reserves it
conceptually; only PR#10 actually creates it (and only if Option B
is chosen).

---

## §9 Tests required for future implementation

### §9.1 Pure tests (mandatory for any PR#10 shape — Option A or B)

- **Normalised path / route key generation** — given a raw path,
  the helper produces the expected normalised key; given a malformed
  / unsafe path, the helper rejects.
- **Query string stripping** — `/pricing?token=abc&utm=foo` →
  `/pricing` (or `/pricing` + allowlisted UTM context, depending on
  OD-4).
- **Route-pattern derivation** — `/users/12345` → `/users/:id`,
  `/post/xyz-uuid-...` → `/post/:slug`, etc.
- **CTA / form ID allowlist shape** — only `cta_[a-z0-9_]+` /
  `form_[a-z0-9_]+` accepted; non-matching input rejected.
- **Referrer classification** — known referrer hosts mapped to
  correct class; unknown hosts → `referrer.unknown`.
- **`evidence_refs` required** — adapter rejects input with empty
  or missing `evidence_refs`.
- **No raw forbidden fields in serialised output** — static-source
  sweep: no `user_agent` / `ip_hash` / `token_hash` / `pepper` /
  `bearer` / `authorization` / `raw_payload` / `canonical_jsonb` /
  full URL with query / `person_id` / `visitor_id` / `company_id` /
  `email_id` / `email_hash` / `device_fingerprint` strings appear
  in any persisted shape or report JSON.
- **No Lane A / Lane B output** — static-source grep over PR#10
  active source for `INSERT INTO scoring_output_lane_a` / `_b` →
  zero matches.
- **No Policy / Trust imports** — static-source grep → zero
  imports from a hypothetical `src/scoring/policy` or `src/scoring/trust`.
- **No visitor / person / company identity fields** — type-level
  + runtime walker (mirrors PR#7b `assertNoForbiddenKeys`).
- **Stable natural key** — if Option B: rows under the same
  `(workspace_id, site_id, session_id, poi_type, poi_key, poi_input_version,
  scoring_version)` upsert idempotently.
- **Version mismatch rejection** — if input carries a version
  string outside the supported set, reject deterministically.
- **Malformed `evidence_refs` row-level reject if observer exists**
  — mirrors PR#8b §I MISSING_EVIDENCE_REFS handling.

### §9.2 DB tests (only if Option B chosen)

- **Migration applies idempotently** — CREATE TABLE IF NOT EXISTS,
  CREATE INDEX IF NOT EXISTS.
- **Additive only** — no `ALTER` on existing tables, no `DROP`,
  no `CASCADE`.
- **Natural-key uniqueness** — UNIQUE constraint on the natural
  key tuple; second INSERT at the same tuple → ON CONFLICT DO UPDATE.
- **Idempotent upsert** — re-running the worker over the same seed
  produces the same row count.
- **Source-count / evidence_refs consistency** — every persisted
  row's `evidence_refs[]` entries resolve to extant
  PR#1 / PR#2 / PR#5 / PR#6 rows.
- **No forbidden columns** — `information_schema.columns` query
  returns zero rows for the §6 / §5.4 exclusion list.
- **Timestamps ordered** — `first_seen_at <= last_seen_at`,
  `created_at <= updated_at`.
- **No raw URL query strings** — JSONB-key sweep on `poi_key`
  + any context columns for `?` characters (defensive).
- **No writes to source tables** — pre/post counts on
  `accepted_events`, `rejected_events`, `ingest_requests`,
  `session_features`, `session_behavioural_features_v0_2`,
  `stage0_decisions`, `risk_observations_v0_1` are equal
  before / after the PR#10 worker run.
- **`scoring_output_lane_a` / `_b` counts unchanged** — verified
  operator-side per PR#8a §11 pattern (NOT inside the worker
  process).
- **Role privileges** — `buyerrecon_customer_api` zero SELECT;
  `buyerrecon_scoring_worker` SELECT + INSERT + UPDATE;
  `buyerrecon_internal_readonly` SELECT only.

---

## §10 Runtime proof required later

When PR#10 (and any DB-touching follow-on) ships, the Hetzner
staging proof must include:

- **Git state** — HEAD at the expected PR#10 commit; clean working tree.
- **Static checks** — `npx tsc --noEmit`, `npm run check:scoring-contracts`,
  `npm test` (full suite), targeted PR#10 test file.
- **Staging env boundary** — host = `127.0.0.1:5432` (or staging
  hostname), db = `buyerrecon_staging`; explicitly NOT Render
  production.
- **Database URL masking** — full URL never printed; only host +
  db name surface in stdout.
- **PRE counts** — operator-side `psql -c 'SELECT COUNT(*) FROM …'`
  on every source table + Lane A/B + the new POI table (if
  Option B).
- **Worker / observer run** — exit code 0; JSON report on stdout
  (observer) or PASS summary (worker).
- **POST counts** — operator-side psql on the same tables; deltas
  match expectations (source tables unchanged; new table populated
  per row count if Option B).
- **Diff proof** — source-table row counts equal pre/post; Lane A/B
  remain 0 / 0; new POI rows (if Option B) match the worker's
  reported `upserted_rows`.
- **No Render production touched.** A0 P-4 still blocking.
- **No secrets printed** — `grep` stdout for `password`, full URL,
  `token_hash`, `pepper`, `user_agent`, raw URL with query → 0 hits.
- **No customer-facing output** — no rendered text, no dashboard
  output.
- **observe:risk-core-bridge still PASS** — the PR#8b observer
  remains green; PR#10 does not regress prior cores.

---

## §11 Codex review checklist

Before PR#10 implementation starts, Codex must answer **YES** to all
of the following questions about THIS PR#9a planning doc:

| # | Question | Expected |
| --- | --- | --- |
| 1 | Is PR#9a planning **docs-only** (one new file under `docs/`)? | YES |
| 2 | Does it position POI as a **shared-core** primitive (Risk → POI → Series → Trust → Policy), not a BuyerRecon-local scorer? | YES |
| 3 | Does it explicitly **avoid identity enrichment** (no person / visitor / company / IP-org / email / hashed identity)? | YES |
| 4 | Does it **avoid customer-facing output** (no dashboards, no rendered text, no marketing copy, no scoring label)? | YES |
| 5 | Does it **avoid Policy / Trust / Lane A/B** writes or claims? | YES |
| 6 | Does it preserve **evidence lineage** to derived layers (PR#1 / PR#2 / PR#5, and PR#6 only if Helen selects the OD-5 Risk-as-input path) and forbid raw-ledger bypass? | YES |
| 7 | Does it define **privacy-safe POI keys** (query strings stripped, route patterns normalised, referrer reduced to class, no raw UA / IP, no full URL)? | YES |
| 8 | Does it sequence implementation **after planning sign-off** (PR#10 is a separate gated PR)? | YES |
| 9 | Does it **avoid DB / migration / code in PR#9a** (no `migrations/*.sql`, no `src/**/*.ts`, no `package.json`)? | YES |
| 10 | Does it state clearly that PR#10 **must not touch Render production**? | YES |
| 11 | Does it propose explicit **versioning** (`poi-core-input-v0.1` etc.) so a future bump is reviewable? | YES |
| 12 | Does it include a **runtime proof plan** that mirrors the PR#8b Hetzner proof shape? | YES |
| 13 | Does it list **open decisions** for Helen so the implementation PR has unambiguous gates? | YES |
| 14 | Are all 7 PR#9a hard exclusions in §6 explicitly enumerated (Render, customer output, Lane A/B, Policy, Trust, identity, ML)? | YES |

Codex BLOCKED if any answer is NO. PR#9a commit proceeds only on
unanimous YES.

---

## §12 Open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Is POI the correct next shared primitive after Risk (vs. Series, Trust, or something else)? | **YES** — POI is the addressable unit Risk evidence attaches to. Series / Trust / Policy all reference POI downstream. Doing POI first means later cores have a stable POI surface to consume. |
| **OD-2** | Should the next implementation PR be **contract-only first (Option A)** or **derived `poi_observations_v0_1` table first (Option B)**? | **Option A — contract-only first.** Mirrors PR#7a → PR#7b cadence. Lowest risk. The follow-on (PR#11 or equivalent) can then mirror PR#8a / PR#8b exactly. |
| **OD-3** | Which BuyerRecon surfaces are allowed POI v0.1: `page_path`, `route`, `cta_id`, `form_id`, `offer_surface`, `referrer_class`? | **All six** — none expose identity. Each has a normalised key shape per §3.2. |
| **OD-4** | Should UTM campaign / source be part of POI v0.1, or **only context** (carried but not POI-typed)? | **Only context.** UTM values flow easily into POI-key land where they shouldn't (`utm_id=person_email`). Better to carry UTM as a `poi_context` field separately, with strict allowlist shapes. Helen may flip this to "POI v0.1 includes UTM campaign class" if low-risk normalisation is acceptable. |
| **OD-5** | Should `risk_observations_v0_1` be an **input** to POI derivation, or should POI remain independent and later joined by Series / Trust / Policy? | **Independent.** Crossing Risk-Core evidence into POI keys creates a cycle (POI conditioned on Risk, Risk conditioned on POI). Cleaner: POI carries its own session+surface evidence; Series / Trust / Policy join POI + Risk + (future) POI downstream. |
| **OD-6** | What is the **minimum runtime proof** for PR#10 (or its implementation successor)? | Mirrors PR#8b proof: HEAD synced; tsc / scoring contracts / full + targeted tests PASS; staging boundary correct; PRE = POST source counts; Lane A/B = 0 before + after; no secrets in stdout; no Render touched. If Option B (DB table) also include row-count verification of the new `poi_observations_v0_1` table. |
| **OD-7** | Does POI v0.1 share the **PR#5 Stage 0 eligibility rule** (skip excluded sessions for buyer-motion-shaped POI inference)? | **YES, with carry-through.** Stage-0-excluded sessions are not buyer-motion sources, but the POI observation may still record "session targeted POI X" for audit. Mark such rows with `eligibility.stage0_excluded = true` so downstream Series / Trust can decide whether to consume them. |
| **OD-8** | Should POI v0.1 **distinguish first-time vs. returning POI observation** per session? | **Optional v0.1 feature.** A `first_seen_in_session` boolean column (Option B) or `first_seen_in_session: true` field on the input contract (Option A) provides cheap distinction. Recommend deferring this until PR#11 once the contract proves stable. |

All 8 ODs are load-bearing — Helen signs all 8 (or substitutes
explicit alternatives) before PR#10 implementation begins.

---

## §13 Recommended next PR after planning

The next PR after this planning doc lands depends on Helen's
choice in OD-2:

- **If lowest risk (recommended):** PR#10 is **POI Core Input
  Contract only** (Option A above). Pure TypeScript types,
  normalisation helpers, adapter, pure tests. No DB. No migration.
  No worker. No observer. ~600 lines of code + ~800 lines of tests.
  Mirrors PR#7a → PR#7b cadence. A follow-on PR (let's call it
  PR#11) then ships the derived `poi_observations_v0_1` table +
  worker + read-only observer, mirroring PR#6 + PR#8b structure
  exactly.

- **If faster evidence chain (higher risk):** PR#10 is the
  `poi_observations_v0_1` derived table + worker + read-only
  observer (Option B above). Larger surface, requires Codex review
  of column list, role grants, worker behaviour, observer
  invariants, and verification SQL. Only proceed if PR#9a planning
  is Codex-approved AND Helen explicitly chooses Option B in
  OD-2.

Default recommendation: **Option A (lowest risk).** Codex's
review burden is smaller, the cadence is established, and the
implementation gate stays clean.

---

## §14 What this planning doc does NOT do

- Does **not** implement PR#10 (or any future PR).
- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json`.
- Does **not** touch the DB or run `psql`.
- Does **not** touch the collector (`src/collector/v1/**`).
- Does **not** modify `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#6 / PR#7a / PR#7b / PR#8a / PR#8b code.
- Does **not** modify any migration in `migrations/`.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`, or
  `scoring/forbidden_codes.yml`.
- Does **not** create customer-facing output.
- Does **not** commit. Does **not** push.

---

## §15 Implementation gate

PR#10 implementation may begin only after **all** of the following
hold:

1. Helen written sign-off on this PR#9a planning doc (OD-1..OD-8,
   especially OD-2's Option A vs. Option B choice).
2. Codex xhigh review of this PR#9a planning doc → PASS.
3. PR#8b commit `011b6c2` (or later) remains stable.
4. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.
5. AMS shared-core priority order (Risk → POI → Series → Trust →
   Policy) remains the operative architecture rule. No product-
   adapter PR overtakes this sequence without explicit Helen
   amendment.

After all five hold, PR#10 implementation may begin on a new branch
from `sprint2-architecture-contracts-d4cc2bf` HEAD (or its successor).
