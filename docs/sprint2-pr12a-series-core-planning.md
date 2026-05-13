# Sprint 2 PR#12a — Series Core Planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation. No code, no migration, no `schema.sql` change, no
`psql`, no DB touch, no collector / app / server / auth change. No
PR#6 / PR#7 / PR#8 / PR#9a / PR#10 / PR#11a..d code modification.
PR#0–PR#11d implementation files are referenced read-only.

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#11d pushed) | `8e0841d70707750f10843982a1c2f74a862a38a1` |
| PR#11c impl HEAD (upstream parent) | `e90b18b` |
| PR#11b POI observer (Hetzner-proven) | `1a3b252` |
| PR#10 POI Core Input Contract HEAD | `f9d2a75` |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing shared-core workflow)
- `docs/sprint2-pr7a-risk-core-bridge-contract.md` (precedent contract shape)
- `docs/sprint2-pr8a-risk-core-bridge-observer-planning.md` (precedent observer-planning shape)
- `docs/sprint2-pr8b-risk-core-bridge-observer.md` (precedent observer impl + Hetzner proof)
- `docs/sprint2-pr9a-poi-core-input-planning.md` (Helen-signed OD-1..OD-8)
- `docs/sprint2-pr10-poi-core-input.md` (PR#10 POI contract impl)
- `docs/sprint2-pr11a-poi-derived-observation-planning.md` (Helen-signed OD-1..OD-10)
- `docs/sprint2-pr11b-poi-core-input-observer.md` (PR#11b read-only POI observer)
- `docs/sprint2-pr11c-poi-observations-table-worker-planning.md` (Helen-signed OD-1..OD-11)
- `docs/sprint2-pr11c-poi-observations-table-worker.md` (PR#11c worker impl)
- `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md` (PR#11d impl + Hetzner proof runbook)
- `migrations/014_poi_observations_v0_1.sql` (durable POI evidence layer — read-only reference)
- `src/scoring/poi-core/{types,normalise,adapter,index,version}.ts` (PR#10 — read-only reference)
- `src/scoring/poi-core-worker/{types,query,mapper,upsert,worker,index}.ts` (PR#11c — read-only reference)
- `src/scoring/poi-table-observer/{types,query,report,runner,index}.ts` (PR#11d — read-only reference)

**Upstream references read note.** This PR#12a planning doc is
derived from the PR#11c / PR#11d implementation + Hetzner-proof
chain (see §1). Before Codex review, the upstream references
listed in the Authority block above SHOULD be treated as required
review inputs — the doc summarises the Series boundary against
PR#10 / PR#11a..d, but Codex's confidence in the boundary depends
on consulting the actual source / migration / verification SQL.

---

## §1 Status / upstream proof

**Current HEAD.** `8e0841d` (Sprint 2 PR#11d: add POI table observer).
Base HEAD local + origin were in sync and clean before creating
this untracked PR#12a planning doc.

**Chain progression to date.**

| PR | Title | State |
| --- | --- | --- |
| PR#6 | Risk-evidence layer | Hetzner-proven; `risk_observations_v0_1` exists on staging |
| PR#7a / PR#7b | Risk Core Bridge contract + adapter | Closed |
| PR#8a / PR#8b | Risk Core Bridge Observer planning + impl | Hetzner-proven |
| PR#9a | POI Core Input planning | Closed |
| PR#10 | POI Core Input Contract | Closed |
| PR#11a | POI Derived Observation + Observer-First Planning | Closed |
| PR#11b | Read-only POI Input Observer | Hetzner-proven |
| PR#11c | POI Observations Table + Manual Worker | Closed |
| PR#11d | POI Observation Table Observer + Hetzner Proof Runbook | **Hetzner-proven PASS (2026-05-13)** at `8e0841d`; chain closed |

**PR#11b Hetzner proof signals (`1a3b252`, the load-bearing
evidence for everything downstream).**

| Signal | Value |
| --- | --- |
| `rows_scanned` (total) | 24 |
| `rows_scanned_by_source_table.session_features` | 8 |
| `rows_scanned_by_source_table.session_behavioural_features_v0_2` | 16 |
| `envelopes_built` | 8 |
| `rejects` | 16 (all `NO_PAGE_PATH_CANDIDATE` from SBF — expected) |
| `poi_type_distribution.page_path` | 8 |
| `source_table_distribution.session_features` | 8 |
| `stage0_excluded_count` | 6 |
| `eligible_for_poi_count` | 2 |
| `unsafe_poi_key_reject_count` | 0 |
| `evidence_ref_reject_count` | 0 |
| PRE/POST source-table parity | all 9 monitored tables unchanged |
| Lane A/B counts | 0 / 0 (PRE = POST) |

**PR#11d Hetzner staging proof — PASS (2026-05-13).** Helen ran
the §6 runbook in
`docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md` against
the pushed PR#11d HEAD `8e0841d70707750f10843982a1c2f74a862a38a1`.
Observed signals (the load-bearing evidence that unlocks Series):

| Stage | Signal | Result |
| --- | --- | --- |
| Sync | Hetzner `/opt/buyerrecon-backend` `git fetch` + `git reset --hard` to `8e0841d` | clean working tree at the pushed PR#11d HEAD |
| Local gates | `npx tsc --noEmit` | PASS |
| Local gates | `npm run check:scoring-contracts` | PASS |
| Local gates | PR#11c worker tests | 72 / 72 PASS |
| Local gates | PR#11d table observer tests | 32 / 32 PASS |
| Local gates | Full suite | 45 files / 2556 tests PASS |
| Local gates | `git diff --check` | exit 0 |
| Migration | `psql … -f migrations/014_poi_observations_v0_1.sql` | applied; re-apply idempotent (no-op) |
| Worker | `npm run run:poi-core-worker` — first run | 8 rows inserted from `session_features` |
| Worker | `npm run run:poi-core-worker` — re-run | 8 rows updated idempotently; row count remained 8 |
| Verification SQL | `psql … -f docs/sql/verification/14_poi_observations_v0_1_invariants.sql` (post-worker) | zero anomaly rows across all numbered checks |
| Table observer | `npm run observe:poi-table` exit code | 0 |
| Table observer | `table_present` | `true` |
| Table observer | `rows_in_table` | 8 |
| Table observer | `total_anomalies` | 0 |
| Table observer | `forbidden_column_present_count` | 0 |
| Table observer | `poi_type_distribution.page_path` | 8 |
| Table observer | `source_table_distribution.session_features` | 8 |
| Table observer | `stage0_excluded_distribution` | true 6 / false 2 |
| Table observer | `poi_eligible_distribution` | true 2 / false 6 |
| Table observer | `unique_session_ids_seen` | 8 |
| Table observer | `unique_workspace_site_pairs_seen` | 1 |
| Parity | Source / control table PRE = POST counts | unchanged across all 9 monitored tables |
| Parity | Lane A/B PRE / POST | 0 / 0 (unchanged) |
| Regression | PR#8b risk-core-bridge observer | `rows_scanned=2 / envelopes_built=2 / rejects=0` (PASS) |
| Regression | PR#11b POI core input observer | `rows_scanned=24 / envelopes_built=8 / rejects=16` all `NO_PAGE_PATH_CANDIDATE` from SBF (PASS) |
| Render production | UNTOUCHED + still blocked (A0 P-4) | confirmed |

**Outcome.** PR#11d is **PASS / pushed / Hetzner-proven /
closed**. `poi_observations_v0_1` exists durably on Hetzner
staging with **8 rows of `page_path` POI observations derived
from `session_features`**. Six are `stage0_excluded=TRUE,
poi_eligible=FALSE`; two are `poi_eligible=TRUE`. PR#11 chain is
complete.

**PR#12a planning is now unlocked.** No further upstream gate is
pending for Series planning, and the PR#12b implementation chain
may begin once PR#12a is Codex-PASS + Helen-signed and committed.

---

## §2 Why Series Core exists

The **AMS shared-core priority** is locked: Risk → POI → Series →
Trust → Policy. Each layer answers a distinct question and feeds
the next layer's input:

- **Risk** answers *is the behavioural evidence risky / automation-
  shaped*?
- **POI** answers *which safe product / surface points were
  touched in the session*?
- **Series** answers *in what order, with what spacing, with what
  repetition, did those POI observations occur within the
  session*?
- **Trust** weighs evidence chains given POI + Series + Risk facts.
- **Policy** decides what action (if any) is allowed given Trust
  evidence.

Series Core lives **after POI** (a session's POI observations
exist as durable rows in `poi_observations_v0_1`) and **before
Trust** (Trust cannot weigh evidence chains without sequence
facts). Series produces **factual sequence evidence** — what
ordered behaviour happened, not what it means commercially.

Series Core **does not judge buyer intent**. Buyer intent is a
product-adapter concern that lives downstream of Trust + Policy +
Product-Context-Fit. Series simply records the sequence facts
those layers later consume.

---

## §3 Series Core definition

**Series Core is a deterministic, factual sequence layer over POI
observations.**

For each session, given the set of POI rows in
`poi_observations_v0_1` belonging to that session, Series Core
produces ordered behaviour facts:

- Which POIs were observed (set + count).
- In what order (chronological by `derived_at` / `first_seen_at`).
- How many distinct POI keys vs. total POI observations
  (repetition signal).
- Whether the session moved through multiple distinct POI surfaces
  (progression) or repeatedly touched the same surface (shallow /
  loop).
- Temporal span from first POI to last POI (duration).
- Eligibility carry-through from POI rows
  (`stage0_excluded` / `poi_eligible`).

**Pure function.** Given the same POI input set, Series Core
produces byte-stable output. No clock read inside the adapter
(any `derived_at` / `series_built_at` is caller-injected). No
`Date.now()`. No randomness.

**No score. No verdict. No customer-facing judgement.** Series is
evidence, not decision.

---

## §4 What Series is NOT

Series Core MUST NOT carry any of the following. Each is a
separate downstream concern that depends on Series facts but is
not part of Series Core.

- ❌ Scoring of any kind (`risk_index`, `verification_score`,
  `evidence_band`, `action_recommendation`, `series_score`,
  `progression_score`).
- ❌ Trust decisions (`trust_decision`, `evidence_weight`).
- ❌ Policy decisions (`policy_decision`, `final_decision`,
  `triggered_tags`, `reason_codes`).
- ❌ Product-Context-Fit signals (commercial fit, technical
  evaluation, enterprise readiness, conversion proximity — all
  product-adapter concerns).
- ❌ Buyer role / persona mapping (e.g. "developer",
  "procurement", "executive" — no person inference of any kind).
- ❌ Site mapping templates (customer-specific page-taxonomy
  catalogs — those are configuration data, not Series output).
- ❌ Customer-facing output (no dashboards, no rendered text, no
  scoring labels, no marketing copy).
- ❌ Account / company / visitor / person identity (no
  `person_id`, `visitor_id`, `company_id`, `account_id`,
  `email_id`).
- ❌ Raw URL replay (path/query strings beyond the
  already-normalised `poi_key` from PR#10).
- ❌ Raw event replay (no read from `accepted_events` /
  `rejected_events`).
- ❌ ML inference (no models, no learned weights, no embeddings).
- ❌ Lane A/B writes (`scoring_output_lane_a`,
  `scoring_output_lane_b` remain empty).
- ❌ Dashboard / report renderer.

Buyer-intent CLAIMS are explicitly out of scope. Series records
what ORDERED behaviour happened. Whether that behaviour
constitutes intent is a downstream judgement that requires Trust
+ Policy + Product-Context-Fit (none of which exist yet).

---

## §5 Source boundary

### §5.1 Recommended v0.1 source — POI table only

Series Core v0.1 reads from exactly one table:

- **`poi_observations_v0_1`** — the durable POI evidence layer
  PR#11c created. Provides per-session POI rows with
  `poi_type`, `poi_key`, `poi_surface_class`, `derived_at`,
  `first_seen_at`, `last_seen_at`, `stage0_excluded`,
  `poi_eligible`, `stage0_rule_id`, `source_versions`, and
  `evidence_refs` per-row.

### §5.2 Forbidden reads by default

| Table | Reason forbidden |
| --- | --- |
| `accepted_events` | Raw event ledger. Series is post-POI and must not bypass PR#10 normalisation. |
| `rejected_events` | Stage 0 territory. Already filtered upstream. |
| `ingest_requests` | Request-layer evidence. Not part of POI/Series. |
| `session_features` | PR#11c worker already pulled this. POI rows carry SF lineage in `source_table` + `source_versions` + `evidence_refs`. |
| `session_behavioural_features_v0_2` | PR#11c v0.1 OD-5 — not a POI source. Series doesn't widen that allowlist. |
| `stage0_decisions` | Series uses POI carry-through fields (`stage0_excluded` + `stage0_rule_id`); no Stage 0 side-read needed (OD-4). |
| `risk_observations_v0_1` | Risk-POI independence (PR#9a OD-5). Risk-as-input for Series creates a Risk↔POI cycle via Series. |
| `scoring_output_lane_a` / `scoring_output_lane_b` | Lane A/B is Policy Pass 1 projection. Series is upstream of Policy. |
| `site_write_tokens` | Auth surface. Never read by analytical layers. |

### §5.3 Stage 0 carry-through

Stage 0 facts already flow through POI rows:

- `poi_observations_v0_1.stage0_excluded` (BOOLEAN)
- `poi_observations_v0_1.poi_eligible` (BOOLEAN; `= NOT stage0_excluded`)
- `poi_observations_v0_1.stage0_rule_id` (TEXT, nullable)

Series v0.1 **must not re-read `stage0_decisions`**. The PR#11c
worker (and PR#11d observer) already established Stage 0
carry-through via the POI table. Re-reading Stage 0 from Series
would duplicate work and re-introduce the Stage 0 read surface
that PR#11a / PR#11c carefully bounded.

---

## §6 Reality from current staging

The PR#11b Hetzner proof at `1a3b252` produced **8 successful POI
envelopes from 8 `session_features` rows** — i.e. **one POI row
per session** under the current staging seed. Each session
touched a single page-path POI; no session was observed
visiting multiple distinct POI surfaces.

**Implication for Series v0.1.** Most (likely all) sessions
currently produce a `single_poi` sequence. Series Core must
acknowledge this truthfully:

- A `single_poi` classification is the **correct factual outcome**
  when only one POI row exists for a session, not a failure.
- Series must NOT overclaim progression where none exists.
- Series must NOT invent a multi-POI sequence by joining other
  tables (e.g. inferring page transitions from `accepted_events`).

**Future richness.** Once the upstream POI extractor surfaces
multiple POI types per session (CTA + form + offer + referrer —
not just `page_path`), Series will start seeing meaningful
multi-POI sequences. PR#12b's observer-first design lets the
operator inspect that ramp without locking in premature semantics.

---

## §7 Candidate Series facts

The following fields are candidates for the Series Core output
shape. Final field list is an open decision per §16 OD-7..OD-10.

| Field | Type | Notes |
| --- | --- | --- |
| `series_version` | TEXT | Frozen literal (e.g. `'series-core-v0.1'`). |
| `workspace_id` | TEXT | Identity boundary. |
| `site_id` | TEXT | Identity boundary. |
| `session_id` | TEXT | Session boundary; masked in any report. |
| `poi_observation_version` | TEXT | Carried from POI input rows; must agree across all POI rows for the session. |
| `poi_input_version` | TEXT | Same — agreement check across input rows. |
| `poi_count` | INT | Total POI rows observed for the session. |
| `unique_poi_count` | INT | Distinct `(poi_type, poi_key)` pairs. |
| `first_poi_type` | TEXT | First POI in chronological order (by `derived_at`). |
| `first_poi_key` | TEXT | NORMALISED per PR#10 only. Privacy considerations §12. |
| `last_poi_type` | TEXT | Last POI in chronological order. |
| `last_poi_key` | TEXT | NORMALISED per PR#10 only. |
| `first_seen_at` | TIMESTAMPTZ | Earliest `first_seen_at` across POI rows. |
| `last_seen_at` | TIMESTAMPTZ | Latest `last_seen_at` across POI rows. |
| `duration_seconds` | INT | `last_seen_at − first_seen_at`. Zero when only one POI. |
| `repeated_poi_count` | INT | Count of POI rows that repeat an earlier `(poi_type, poi_key)`. |
| `revisited_poi_count` | INT | Same as `repeated_poi_count`? Open decision — keep separate or collapse (OD-7). |
| `has_repetition` | BOOLEAN | `repeated_poi_count > 0`. |
| `has_progression` | BOOLEAN | `unique_poi_count >= 2` (OD-8 — minimum-distinct threshold). |
| `progression_depth` | INT | `unique_poi_count`. |
| `sequence_pattern_class` | TEXT | One of §8 taxonomy. |
| `stage0_excluded` | BOOLEAN | TRUE if any POI row in the session is `stage0_excluded=TRUE`. Carry-through. |
| `series_eligible` | BOOLEAN | `= NOT stage0_excluded` (OD-6). |
| `evidence_refs` | JSONB array | References to the POI rows used. Allowlist: `poi_observations_v0_1` only. |
| `source_versions` | JSONB object | `{ poi_observations: '<poi_observation_version>', poi_input_version: '...', series_version: '...' }`. Forward-compat map. |
| `series_built_at` | TIMESTAMPTZ | Caller-injected provenance timestamp. NEVER `Date.now()` inside the adapter. |
| `record_only` | BOOLEAN | Literal `TRUE` (mirrors PR#5 / PR#6 / PR#11c). |
| `created_at` | TIMESTAMPTZ | (Durable table only — PR#12c+.) |
| `updated_at` | TIMESTAMPTZ | (Durable table only — PR#12c+.) |

**Explicitly excluded fields** (forbidden in any Series shape —
mirrors PR#11c §4.2):

- ❌ score / verdict / decision / `risk_index` / `verification_score` /
  `evidence_band` / `action_recommendation` / `reason_codes` /
  `reason_impacts` / `triggered_tags` / `penalty_total`
- ❌ `lane_a` / `lane_b` / `scoring_output_lane_a` / `scoring_output_lane_b`
- ❌ `trust_decision` / `policy_decision` / `final_decision`
- ❌ `customer_facing` / `report` / `verdict` / `buyer_intent` /
  `buyer_role` / `buyer_score` / `product_fit` /
  `product_context_fit`
- ❌ raw URL / query strings / `page_url` / `full_url` / `url_query`
- ❌ `user_agent` / `ua` / `ip` / `ip_hash` / `token_hash` /
  `bearer` / `cookie` / `pepper` / `authorization`
- ❌ `person_id` / `visitor_id` / `company_id` / `email_id` /
  `email` / `phone`
- ❌ `device_fingerprint` / `font_list`
- ❌ `raw_payload` / `canonical_jsonb`

---

## §8 Sequence pattern taxonomy v0.1

Proposed classes for `sequence_pattern_class`:

| Class | When applied |
| --- | --- |
| `single_poi` | Exactly one POI row for the session. (Expected current-staging dominant class — see §6.) |
| `repeated_same_poi` | `poi_count >= 2` and `unique_poi_count == 1` (same POI surface touched multiple times). |
| `multi_poi_linear` | `unique_poi_count >= 2` AND no POI repeats (each POI appears once, in some order). |
| `loop_or_backtrack` | `unique_poi_count >= 2` AND at least one POI repeats (visited, left, returned). |
| `insufficient_temporal_data` | Timestamps missing or inconsistent — `first_seen_at` / `last_seen_at` cannot be ordered. |
| `unknown` | Fallback for any case the v0.1 logic does not classify. Must remain 0 in a healthy run. |

**Final taxonomy is an open decision (OD-7 / OD-8).** Codex review
of PR#12b's observer findings against real data may add or
collapse classes. The v0.1 taxonomy MUST NOT include any class
that implies buyer intent (e.g. no `commercial_evaluation`,
`pricing_focused`, etc. — those are Product-Context-Fit
concerns, not Series).

---

## §9 Eligibility carry-through

Stage 0 facts flow through POI → Series. The recommended rule:

1. Series reads `stage0_excluded` from EVERY POI row in the
   session.
2. If ANY POI row has `stage0_excluded=TRUE`, the Series record's
   `stage0_excluded` is TRUE.
3. `series_eligible = NOT stage0_excluded`.
4. **Stage 0 exclusion is NOT a Series reject reason.** A
   Stage-0-excluded session still produces a Series record with
   `series_eligible=FALSE` for audit lineage — mirrors PR#11a §5.1
   carry-through (which mirrors PR#10 OD-7).

**Why store excluded sessions.** PR#11b Hetzner proof had 6 of 8
sessions excluded; PR#11c worker stored all 8. Series v0.1
inherits the same posture so downstream Trust / Policy /
Product-Context-Fit can decide whether to consume excluded rows
without re-querying POI.

---

## §10 Implementation path options

Three candidate paths for the Series implementation chain:

### §10.1 Option A — Series Core Contract only

PR#12b ships pure TypeScript: types, adapter, normalisation
helpers, fixtures, pure tests. No DB. No observer.

**Pros.** Lowest risk. Mirrors PR#7a / PR#10 cadence (Risk and
POI both started with contract-only PRs). Codex-reviewable in one
pass.

**Cons.** Does not exercise real data. Contract shape locked
before the operator can see how current POI data actually
flows through Series logic. PR#11a §6 observer-first rationale
applies here too: contract changes after seeing real data are
cheap; contract changes after a durable table exists are
migration-expensive.

### §10.2 Option B — Read-only Series Input Observer (RECOMMENDED)

PR#12b ships a read-only observer that reads
`poi_observations_v0_1`, builds Series facts in memory using a
worker-local mapper, emits a JSON diagnostics report. Writes
nothing.

**Pros.** Mirrors the PR#11b read-only-observer cadence that
worked for POI. Surfaces the current shallow `single_poi`
distribution truthfully. Lets Codex + Helen see real Series
shape before locking a durable contract or table. Privacy
posture is testable on real data — including the OD-9 sample
policy decision (§12).

**Cons.** Two implementation PRs total before durable persistence
(observer first, then contract / table). Slightly more
implementation work than Option A.

### §10.3 Option C — Durable `series_observations_v0_1` table + worker

PR#12b ships migration 015 + worker + table observer in one go.

**Pros.** Fastest path to a durable Series evidence layer.

**Cons.** **Premature for current staging.** With one POI per
session, the Series table would be ~8 rows of mostly
`single_poi` shape — not a useful evidence layer yet. Schema
changes are migration-expensive to revise. Locks the column
list before observing real richness. Violates the PR#11a §6
observer-first risk profile that POI carefully followed.

### §10.4 Recommended default — Option B

Read-only observer first. Once the observer runs against staging
and Codex + Helen agree the Series shape is sensible, PR#12c
ships either the Series Core contract (pure TS) and/or durable-
table planning, depending on PR#12b findings.

**PR#12a does not implement any of the above.** PR#12a is the
planning doc Codex reviews before PR#12b begins.

---

## §11 Proposed PR chain

### §11.1 Recommended (observer-first cadence)

| PR | Title | Shape |
| --- | --- | --- |
| **PR#12a** | Series Core Planning | Docs-only (this file). |
| **PR#12b** | Read-only Series Input Observer over `poi_observations_v0_1` | Module + CLI + tests + impl doc. Reads `poi_observations_v0_1` only; builds Series facts in memory; emits JSON diagnostics. No DB writes. |
| **PR#12c** | Series Core contract AND/OR durable-table planning | Decided by PR#12b findings + Codex review. Could be pure-TS contract only, or planning for a durable `series_observations_v0_1` table, or both. |
| **PR#12d** | Durable `series_observations_v0_1` table + manual-CLI worker | Only after PR#12c sign-off. Migration 015 + worker + verification SQL + tests. Manual CLI trigger only (mirrors PR#11c OD-4). |
| **PR#12e** | Series table observer + Hetzner proof | Mirrors PR#11d. Read-only table observer + Hetzner runbook. |

### §11.2 Alternative (compressed cadence — possible but risky)

| PR | Title |
| --- | --- |
| PR#12b | Series Core contract + read-only Series Input Observer |
| PR#12c | Durable `series_observations_v0_1` table + manual worker |
| PR#12d | Table observer + Hetzner proof |

The compressed chain saves one PR but commits to a contract shape
before the observer has produced findings. Helen may compress
later if PR#12b's observer reveals the contract is obvious; in
which case PR#12c absorbs both contract + table planning.

**Codex review should validate the sequence choice** as part of
PR#12a sign-off.

---

## §12 Privacy / safety posture

Series Core inherits the PR#9a / PR#10 / PR#11a..d privacy
invariants verbatim. None weaken; some additional posture is
specific to Series.

- **Only normalised POI observations.** Series reads
  `poi_observations_v0_1`. `poi_key` is already PR#10-normalised
  (query strings stripped, credential markers rejected, email-PII
  filtered). Series does NOT re-derive POI keys from raw data.
- **No raw URL / no raw referrer / no raw UA / no IP / no token /
  no auth header / no pepper / no cookie.** PR#11c migration 014's
  forbidden-column sweep already excludes these at the storage
  layer; Series cannot accidentally surface them by reading the
  POI table.
- **No person / company / visitor / email identity.** Same.
- **No customer-facing output.** Series reports are JSON for
  engineers.
- **No score / no Trust / no Policy fields.** Series is pre-Trust.
- **`evidence_refs` only point at `poi_observations_v0_1` rows.**
  Never at raw ledger. Never at `risk_observations_v0_1`. The
  PR#10 adapter pattern (recursive forbidden-key sweep) is the
  precedent — Series adapter SHOULD apply the same discipline.
- **Session-id masking.** Any observer / worker / report path
  masks `session_id` via the PR#11b / PR#11c / PR#11d
  `truncateSessionId` helper precedent (prefix + `…` + suffix,
  `***` if <12 chars).
- **DSN masking.** Any CLI uses the PR#11b / PR#11c / PR#11d
  `parseDatabaseUrl` helper precedent (host + db name only).

### §12.1 `poi_key` samples — special caution

PR#11d's table observer was designed with the rule "**anomaly
samples are `poi_observation_id` integers only — NEVER session_id,
poi_key, evidence_refs, or raw row contents**." Series faces the
same temptation: surfacing `first_poi_key` / `last_poi_key` as
report samples would expose the page paths users visited.

**Recommended PR#12b observer posture:**

- **Default:** report carries `poi_count` / `unique_poi_count` /
  `sequence_pattern_class` distributions only. NO `poi_key` values
  in samples.
- **If sample POI keys are needed for engineering audit**, they
  must (a) be the PR#10-normalised values (no raw URL), (b) be
  truncated to a short prefix (e.g. first 16 chars), (c) be
  emitted only behind an explicit `OBS_INCLUDE_POI_KEY_SAMPLES=true`
  env flag, and (d) be subject to Codex review per release.
- **Aggregate counts and distributions** are preferred over any
  per-key samples.

The conservative default for PR#12b v0.1 is **no sample POI keys
at all**. The observer surfaces counts + distributions only.

---

## §13 Tests / proof required for future PR#12b

### §13.1 Pure tests

- Reads only `poi_observations_v0_1`. Zero `FROM`/`JOIN` against
  any forbidden table (static-source sweep mirrors PR#11d Group J).
- Reads no raw ledger / Risk / Lane / source tables.
- Deterministic sequence ordering — given the same input POI rows,
  the same Series record is produced byte-stably.
- `single_poi` classification — one POI row → `sequence_pattern_class = 'single_poi'`,
  `unique_poi_count = 1`, `has_progression = false`,
  `progression_depth = 1`, `duration_seconds = 0` (or `last −
  first` if SF row carries distinct first/last timestamps).
- Multi-POI fixtures — `unique_poi_count >= 2` →
  `multi_poi_linear` or `loop_or_backtrack` depending on
  repetition.
- Repetition fixtures — `repeated_same_poi` when same `(poi_type,
  poi_key)` repeats.
- Loop / backtrack fixtures — visit A, visit B, visit A → classified
  correctly.
- Stage 0 carry-through fixtures —
  - All POI rows `stage0_excluded=FALSE` → Series
    `stage0_excluded=FALSE, series_eligible=TRUE`.
  - Any POI row `stage0_excluded=TRUE` → Series
    `stage0_excluded=TRUE, series_eligible=FALSE`.
  - Stage 0 excluded sessions still produce a Series record (not
    a reject).
- Insufficient timestamps → `insufficient_temporal_data`, never
  silent fallback.
- No customer-facing output in any code path.
- Masked session IDs in any report sample.
- No raw `poi_key` leakage beyond the §12.1 conservative-default
  rule (i.e. no `poi_key` in samples unless the explicit env-flag
  policy decision is made and documented).
- `evidence_refs` allowlist sweep — only `poi_observations_v0_1`
  table references.
- Forbidden-key recursive sweep on emitted report shape (mirrors
  PR#10 adapter + PR#11c worker + PR#11d observer sweeps).
- Static-source sweep — no imports from PR#11b observer / PR#11c
  worker non-types / PR#10 normaliser non-types.

### §13.2 DB tests (later — PR#12d / PR#12e)

Deferred until durable persistence lands (mirrors PR#11c §8.2
posture):

- Migration applies idempotently.
- Additive only.
- Natural-key uniqueness on `(workspace_id, site_id, session_id,
  series_version, poi_observation_version)` (OD-list open).
- `evidence_refs` integrity — every entry resolves to an extant
  POI row.
- Forbidden columns sweep on `information_schema.columns`
  (mirrors PR#11c §4.2 exclusion list + Series-specific
  additions per §7).
- Role grants — `customer_api` zero SELECT; `scoring_worker`
  S+I+U; `internal_readonly` SELECT only; migrator owns DDL.

---

## §14 Hetzner proof concept for future PR#12b

When PR#12b ships, the Hetzner staging proof should:

1. Sync the Hetzner working tree to the pushed PR#12b HEAD (mirror
   PR#11d §6.1 `cd /opt/buyerrecon-backend` + `git fetch && git
   reset --hard origin/<branch>`).
2. Run local gates on the Hetzner tree (tsc, scoring-contracts,
   full + targeted tests, diff --check).
3. Confirm `poi_observations_v0_1` is populated with the 8
   page_path rows PR#11d's proof established.
4. Set OBS env vars (`OBS_WORKSPACE_ID`, `OBS_SITE_ID`,
   `OBS_WINDOW_HOURS`).
5. PRE counts via psql on every monitored table — including
   `poi_observations_v0_1` (which should read 8).
6. **Run `npm run observe:series-input`** (the PR#12b CLI).

   **Expected with current staging seed:**
   - `sessions_seen`: 8
   - `series_built`: 8
   - `sequence_pattern_class_distribution.single_poi`: 8 (likely all)
   - `sequence_pattern_class_distribution.*` (other classes): 0
   - `stage0_excluded_count`: 6
   - `eligible_for_series_count`: 2
   - `anomalies`: 0
   - `unique_session_ids_seen`: 8
   - `unique_workspace_site_pairs_seen`: 1
   - DSN + session_id masked
   - No `poi_key` values in samples (per §12.1 default)

7. POST counts on every monitored table — every count unchanged.
   `poi_observations_v0_1`: 8 (unchanged). Lane A/B: 0 / 0.
8. Regression checks — `observe:risk-core-bridge`,
   `observe:poi-core-input`, `observe:poi-table` all still PASS.
9. No DB writes. No Render touched.

The proof transcript pattern mirrors PR#11d §6 / §7 verbatim.

---

## §15 Product-Context Fit boundary reminder

**Product-Context Fit is NOT part of Series Core.** It is a
downstream layer that consumes POI + Series facts together with
**the customer's product / category context** to calibrate buyer-
motion patterns on that customer's website.

Example heuristics that BELONG TO Product-Context Fit (NOT Series):

- A visit to a **pricing** page suggests *commercial fit*
  evaluation (paid-evaluator buyer motion).
- A visit to **docs / integration / API** pages suggests
  *technical* evaluation (developer-evaluator buyer motion).
- A visit to **security / compliance / trust** pages suggests
  *enterprise readiness* concerns.
- A visit to **demo / contact / book-a-call** pages is
  *conversion-proximate*.
- A visit to **career / blog / random marketing pages** is
  generally *weak buyer-motion*.

These mappings depend on:

- **The customer's product** (B2B SaaS vs e-commerce vs
  open-source tool).
- **The customer's category** (developer tools, fintech,
  healthcare, etc.).
- **The customer's site taxonomy** (which URLs map to which
  buyer-motion class).

**Product-Context Fit is also NOT about BuyerRecon's own
website.** It calibrates observed POI + Series patterns on a
**customer's website** against that customer's product / category
buyer-motion patterns. BuyerRecon itself is just one example of a
customer using the system; the system must not bake BuyerRecon's
site taxonomy into Series.

**Series Core only says what ordered behaviour happened on which
normalised POI surfaces.** Whether those surfaces constitute
commercial fit, technical evaluation, enterprise readiness, or
weak buyer-motion is downstream — Product-Context-Fit's job, not
Series's.

---

## §16 Open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Is Series the correct next shared-core primitive after POI? | **YES.** AMS shared-core priority Risk → POI → Series → Trust → Policy is locked; Series is the literal next step. Doing Series first means Trust / Policy / Product-Context-Fit later have a stable sequence-evidence surface to consume. |
| **OD-2** | Should PR#12b be a read-only Series Input Observer (Option B in §10), rather than a contract-only PR (Option A) or a table+worker PR (Option C)? | **YES — Option B.** Observer-first cadence worked for POI (PR#11b). Staging currently has shallow `single_poi` data; locking a contract or table shape before seeing real Series flow is premature. |
| **OD-3** | Should Series v0.1 source only `poi_observations_v0_1`? | **YES.** Single-source allowlist. Series builds sequence facts from POI rows only. Any future widening (e.g. to read Stage 0 directly, or to read Risk rows) requires explicit contract amendment. |
| **OD-4** | Should Series re-read `stage0_decisions`? | **NO.** POI rows already carry `stage0_excluded` / `poi_eligible` / `stage0_rule_id`. Re-reading Stage 0 would duplicate the PR#11c read surface. Series uses POI carry-through fields. |
| **OD-5** | Should Series process Stage-0-excluded sessions? | **YES.** Sessions with any `stage0_excluded=TRUE` POI row STILL produce a Series record — marked `series_eligible=FALSE`. Mirrors PR#11a §5.1 / PR#10 OD-7 carry-through pattern. Stage 0 exclusion is provenance, not a reject. |
| **OD-6** | Should `series_eligible=FALSE` if ANY POI row in the session is `stage0_excluded`? | **YES.** Pure boolean inverse: `series_eligible = NOT (stage0_excluded over all POI rows for the session)`. Enforced at the worker level (and, if a durable table lands later, at the DB CHECK level too — mirrors PR#11c's `poi_eligible = NOT stage0_excluded` Codex-blocker fix). |
| **OD-7** | Should single-POI sessions produce a Series record? | **YES.** Classify as `sequence_pattern_class = 'single_poi'`. `has_progression = false`. `progression_depth = 1`. NOT a reject; NOT a no-op. The factual outcome of "one POI was observed" is a meaningful Series fact. |
| **OD-8** | Should meaningful progression require 2+ distinct POIs? | **YES.** `has_progression = (unique_poi_count >= 2)`. Sessions with `repeated_same_poi` (`unique_poi_count = 1, poi_count >= 2`) have `has_progression = false` because no new surface was reached. |
| **OD-9** | Should Series include Product-Context-Fit or buyer-role mapping? | **NO.** Series is shared-core. Buyer-role / Product-Context-Fit is product-adapter / downstream. Mixing the two violates the AMS layering (§2). |
| **OD-10** | Should Series produce score / verdict / reason codes? | **NO.** Series is evidence, not decision. Score / verdict / reason-codes are Trust + Policy concerns. Series's `sequence_pattern_class` is descriptive, not evaluative. |
| **OD-11** | Should the durable `series_observations_v0_1` table wait until after the read-only observer proves real sequence shape? | **YES.** Same risk profile as PR#11a / PR#11c. Locking a column shape before seeing real-data distributions is migration-expensive to revise. PR#12b observer first; PR#12c+ table after Codex + Helen review of PR#12b findings. |

---

## §17 Codex review checklist

Codex must answer **YES** to all of the following about PR#12a:

| # | Question | Expected |
| --- | --- | --- |
| 1 | Is PR#12a docs-only? | YES |
| 2 | Zero code / package.json / migration / schema.sql / DB / Render touched? | YES |
| 3 | Series is correctly separated from Trust / Policy / Product-Context-Fit (no overlap in §3 / §4)? | YES |
| 4 | Source boundary is `poi_observations_v0_1` only? | YES |
| 5 | No raw / source-table reads (accepted_events, rejected_events, ingest_requests, session_features, SBF, stage0_decisions, risk_observations_v0_1, Lane A/B, site_write_tokens)? | YES |
| 6 | No customer-facing output anywhere in the proposed shape? | YES |
| 7 | Staging reality acknowledged (current POI data is shallow — likely `single_poi` dominant; Series must not overclaim progression)? | YES |
| 8 | Open decisions for Helen are sufficient (11 ODs cover source / Stage 0 / single-POI / progression / Product-Context-Fit boundary / durable-table sequencing)? | YES |
| 9 | Recommended PR sequence (PR#12a → PR#12b → PR#12c → PR#12d → PR#12e) is sensible and matches PR#11 cadence? | YES |
| 10 | Privacy posture preserved verbatim from PR#9a / PR#10 / PR#11a..d (no raw URL / UA / IP / token / identity)? | YES |
| 11 | Special caution on `poi_key` samples in §12.1 (default: no sample POI keys; explicit env-flag + Codex review required if needed)? | YES |
| 12 | Stage 0 carry-through preserved (OD-4..OD-6), with no Stage 0 re-read in Series v0.1? | YES |
| 13 | Series produces no score / no verdict / no reason codes (OD-10)? | YES |
| 14 | Hetzner proof concept (§14) mirrors PR#11b / PR#11d cadence verbatim? | YES |
| 15 | Product-Context-Fit boundary (§15) is clear and Series Core does NOT carry product-fit or buyer-role mapping? | YES |

Codex BLOCKED on any NO. PR#12a commit proceeds only on unanimous YES.

---

## §18 Recommended next step

After Codex xhigh re-review PASS and Helen written sign-off on
OD-1..OD-11:

1. **Commit PR#12a** (`docs/sprint2-pr12a-series-core-planning.md`)
   to `sprint2-architecture-contracts-d4cc2bf` as a docs-only
   commit. Push.
2. **Implement PR#12b — read-only Series Input Observer over
   `poi_observations_v0_1`** on a fresh worktree from the
   post-PR#12a HEAD. Mirror the PR#11b cadence verbatim:
   - `src/scoring/series-input-observer/{types,query,mapper,report,runner,index}.ts`
   - `scripts/series-input-observation-report.ts` (CLI)
   - `tests/v1/series-input-observer.test.ts`
   - `docs/sprint2-pr12b-series-input-observer.md`
   - `package.json` script entry: `"observe:series-input": "tsx scripts/series-input-observation-report.ts"`
3. **PR#11d Hetzner-proof gate — already satisfied.** PR#11d's
   Hetzner staging proof completed PASS on 2026-05-13 at
   `8e0841d` (see §1). `poi_observations_v0_1` is durable on
   staging with 8 rows; no further upstream gate remains for
   PR#12b.
4. **PR#12c / PR#12d / PR#12e** sequence based on PR#12b
   findings + Codex review.

**Architecture Gate A0 P-4 Render production block** remains in
force across the entire chain. No PR#12 step modifies Render
state.

---

## §19 What this planning doc does NOT do

- Does **not** implement the Series Core contract, observer,
  worker, or table.
- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json` / lockfile.
- Does **not** touch the DB or run `psql`.
- Does **not** touch Render.
- Does **not** touch the collector (`src/collector/v1/**`).
- Does **not** modify `src/app.ts`, `src/server.ts`,
  `src/auth/**`.
- Does **not** modify PR#6 / PR#7 / PR#8 / PR#9a / PR#10 /
  PR#11a..d code.
- Does **not** modify any migration in `migrations/`.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`,
  `scoring/forbidden_codes.yml`.
- Does **not** create customer-facing output.
- Does **not** commit. Does **not** push.

---

## §20 Implementation gate

PR#12b implementation may begin only after **all** of the
following hold:

1. Helen written sign-off on this PR#12a planning doc (OD-1..OD-11).
2. Codex xhigh review of this PR#12a planning doc → PASS.
3. PR#11d commit `8e0841d` remains stable.
4. **PR#11d Hetzner-proof PASS already satisfied (2026-05-13).**
   `poi_observations_v0_1` is durable, populated with 8 rows,
   and table-observer-verified on Hetzner staging — see §1 for
   the full signal table.
5. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.
6. AMS shared-core priority order (Risk → POI → Series → Trust →
   Policy) remains the operative architecture rule. No product-
   adapter PR overtakes this sequence without explicit Helen
   amendment.
7. PR#9a OD-5 holds — POI stays independent from Risk; Series
   v0.1 inherits the same independence (POI rows are the only
   read source).

After all seven hold, PR#12b implementation may begin on a new
branch from `sprint2-architecture-contracts-d4cc2bf` HEAD (or its
successor).
