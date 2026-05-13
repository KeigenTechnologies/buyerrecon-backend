# Sprint 2 PR#11a — POI Derived Observation + Observer-First Planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation work. No code, no migration, no `schema.sql` change,
no `psql`, no DB touch, no collector / app / server / auth change.
No PR#6 / PR#7 / PR#8 / PR#9a / PR#10 code modification. PR#0–PR#10
implementation files are referenced read-only.

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#10 pushed + Codex xhigh PASS) | `f9d2a75140d222b7fd16ed37a02f55ff398fbe16` |
| Prior closed commits | PR#0 `d4cc2bf` · PR#1 `bea880d` · PR#2 `3d88177` · PR#3 `4318e02` · PR#4 `cc2ae4c` · PR#5 `baa17f9` · PR#6 plan `9794210` · PR#6 impl `de76950` · PR#6 patch `1cd9ac1` · PR#7a `9667106` · Codex config `9a64669` · PR#7b `987db3d` · PR#8a `09d0145` · PR#8b `011b6c2` · PR#9a `94a27af` · PR#10 `f9d2a75` |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing shared-core workflow)
- AMS `docs/algorithms/POI_CORE_*` (POI Core algorithm spec — read-only reference)
- AMS `internal/poicore/` (existing POI core code — read-only reference)
- `docs/sprint2-pr7a-risk-core-bridge-contract.md` (precedent contract shape)
- `docs/sprint2-pr8a-risk-core-bridge-observer-planning.md` (precedent observer-planning shape)
- `docs/sprint2-pr8b-risk-core-bridge-observer.md` (precedent read-only observer impl + Hetzner proof)
- `docs/sprint2-pr9a-poi-core-input-planning.md` (POI Core Input planning — Helen-signed OD-1..OD-8)
- `docs/sprint2-pr10-poi-core-input.md` (POI Core Input Contract impl + Codex xhigh PASS)
- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md` (Helen-signed §0 architecture correction)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` (P-4 Render production still blocking)
- `src/scoring/poi-core/{types,normalise,adapter,index,version}.ts` (PR#10 contract — read-only reference)
- `tests/v1/poi-core.test.ts` (PR#10 tests — read-only reference)

---

## §1 Goal

Plan the next four-step POI chain after PR#10's contract-only landing.
PR#10 produced a pure `buildPoiCoreInput()` adapter, `PoiCoreInput` type,
normalisation helpers, and 148 pure tests. It produced **no DB row, no
worker, no observer, no production read**. The job of PR#11a is to plan
**how POI evidence reaches durable observability** without violating the
PR#9a / PR#10 privacy posture, the AMS shared-core priority order, or
the Architecture Gate A0 P-4 Render block.

The plan introduces an **observer-first** rollout: first prove the POI
input contract works on real staging data via a read-only observer
(PR#11b); only then create the durable table + worker (PR#11c); finally
add a table observer + Hetzner staging proof that mirrors PR#8b
(PR#11d).

PR#11a is **docs-only**. It writes one new file under `docs/` and
nothing else.

---

## §2 Status / upstream proof

PR#10 — the **POI Core Input Contract** — has completed Codex xhigh
review with the following gate signals all green:

| Gate | Result |
| --- | --- |
| Branch synced to PR#10 HEAD | `f9d2a75` |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| Targeted POI tests | 148 / 148 PASS |
| Full suite | 42 files / 2380 tests PASS |
| `git diff --check` | PASS |
| Codex xhigh review | PASS after 4 privacy blockers fixed |
| Render production | UNTOUCHED + still blocked (A0 P-4) |
| Customer-facing output | NONE — contract is internal type only |
| DB writes / DB reads from PR#10 source | NONE |
| Migrations created by PR#10 | 0 |

PR#10 closed four Codex privacy blockers explicitly:

1. **Email/token-shaped path segments** reject in `normalisePagePath()`.
   `/welcome/person@example.com` and `/welcome/person%40example.com`
   now return `null`. `@` literal, email-shape regex, and case-insensitive
   `%40` substring all reject. Defence-in-depth across all percent-encoded
   forms.
2. **`poi_surface_class` is finite/coarse/validated.** Allowlist of 14
   dotted-namespace labels: `page.general` / `page.home` / `page.pricing` /
   `page.demo` / `page.resources` / `page.trust` / `cta.primary` /
   `cta.secondary` / `form.demo` / `form.contact` / `offer.demo` /
   `offer.pricing` / `offer.trust` / `referrer.class`. No free-form text.
3. **`evidence_refs` allowlist only.** Permitted source tables:
   `session_features`, `session_behavioural_features_v0_2`,
   `stage0_decisions`. Forbidden-key sweep is recursive and walks nested
   JSON: rejects `raw_payload`, `canonical_jsonb`, `user_agent`,
   `token_hash`, `person_id`, `email`, etc. (24 keys total).
4. **Email-shaped PII rejection extended** to cover percent-encoded
   variants. Group S in `tests/v1/poi-core.test.ts` covers 13 regression
   cases including fully percent-encoded email paths.

The PR#10 contract is the **upstream gate** that unlocks PR#11a planning.
PR#11b/c/d build directly on the PR#10 surface.

---

## §3 Scope boundaries

PR#11a is **docs-only**. It MUST NOT:

- write or edit any `.ts` source file
- write or edit any `.sql` file
- write or edit `package.json` / `package-lock.json`
- write or edit `scoring/version.yml`, `scoring/reason_code_dictionary.yml`,
  `scoring/forbidden_codes.yml`
- write or edit any `migrations/*` file
- write or edit `src/db/schema.sql`
- touch any database (no `psql`, no DSN connection, no migration apply)
- touch Render (no environment edit, no service restart, no deploy)
- create a worker
- create an observer
- create a table
- modify any PR#10 file
- commit
- push

PR#11a deliverable is exactly one new file:

```
docs/sprint2-pr11a-poi-derived-observation-planning.md   ← this file
```

The validation surface for PR#11a is:

```
git diff -- docs/sprint2-pr11a-poi-derived-observation-planning.md
git status --short
```

No `tsc`, no `npm test`, no contract checks. PR#11a is text.

---

## §4 Four-step PR#11 chain

The POI rollout after the contract is a four-step sequence. Each step
is a separately gated PR. Each step has its own Codex xhigh review.

| PR | Title | What it ships | DB touch | Customer output |
| --- | --- | --- | --- | --- |
| **PR#11a** | POI Derived Observation + Observer-First Planning | This planning doc. | None. | None. |
| **PR#11b** | Read-only POI Input Observer | Module `src/scoring/poi-core-observer/`, CLI `scripts/poi-core-input-observation-report.ts`, targeted tests, impl report doc. Reads existing derived layers (PR#1 / PR#2 / PR#5), builds `PoiCoreInput` in memory via PR#10 adapter, emits a JSON diagnostics report. **Writes nothing.** | Read-only on whitelisted source tables. **No writes.** | None. Internal engineering diagnostic only. |
| **PR#11c** | `poi_observations_v0_1` table + manual-CLI worker | Migration `migrations/014_poi_observations_v0_1.sql`, `src/db/schema.sql` mirror block, `src/scoring/poi-core-worker/`, CLI `scripts/run-poi-core-worker.ts`, verification SQL `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`, tests, impl report doc. Idempotent upsert keyed on natural-key tuple. **Manual CLI batch trigger only — no cron, no queue, no post-commit hook.** | Additive: `CREATE TABLE IF NOT EXISTS` + indexes. Worker writes `poi_observations_v0_1` rows. Source tables read-only. | None. |
| **PR#11d** | POI Observation Table Observer + Hetzner staging proof | Module `src/scoring/poi-core-table-observer/`, CLI `scripts/poi-core-table-observation-report.ts`, targeted tests, impl report doc capturing the staging proof transcript. Verifies `poi_observations_v0_1` health: row counts, natural-key uniqueness, evidence-ref integrity, no forbidden columns, no source-count drift, no Lane A/B drift, no secrets in stdout. | Read-only. **No writes.** | None. |

Each PR has its own Codex blocker bar. Each PR has its own runtime
proof. PR#11d closes the loop with a Hetzner staging proof matching
PR#8b's pattern.

---

## §5 Detailed per-PR design

### §5.1 PR#11b — Read-only POI Input Observer

**Goal.** Prove `buildPoiCoreInput()` produces well-shaped, privacy-safe
`PoiCoreInput` envelopes when fed real staging-derived rows. No write,
no shadow table, no Lane projection.

**Files (proposed).**

```
src/scoring/poi-core-observer/
  types.ts                 ← observer-local report shape
  query.ts                 ← read-only SQL builders (allowlisted tables)
  envelope.ts              ← maps source rows → PR#10 buildPoiCoreInput args
  report.ts                ← aggregates report metrics
  index.ts                 ← module entry, re-exports
  observer.ts              ← main runReport(opts): Promise<Report>
scripts/poi-core-input-observation-report.ts   ← CLI runner
tests/v1/poi-core-observer.test.ts             ← targeted tests
docs/sprint2-pr11b-poi-core-input-observer.md  ← impl report
```

**Source tables (allowlisted — per OD-2 / OD-3).**

The PR#11b read allowlist distinguishes **primary POI derivation sources**
from a **side-read for eligibility/provenance**. Primary sources are
the only tables that may populate `PoiCoreInput.source_identity.source_table`
(PR#10 `PoiSourceTable`) and the durable `poi_observations_v0_1.source_table`
column (PR#11c §5.2). Stage 0 is never a primary POI derivation source.

Primary POI derivation sources (match PR#10 `PoiSourceTable`):

- `session_features` — page-count / dwell / first-seen / last-seen
- `session_behavioural_features_v0_2` — cadence / velocity / refresh-loop

Side-read for eligibility/provenance only (NOT a primary POI source):

- `stage0_decisions` — eligibility + provenance only (`excluded`,
  `rule_id`). May be joined into the per-session POI envelope to populate
  `stage0_excluded` / `poi_eligible` carry-through fields, and may appear
  in `evidence_refs[]`. **MUST NOT** be assigned to
  `PoiCoreInput.source_identity.source_table` and **MUST NOT** appear as
  the durable `poi_observations_v0_1.source_table` value.

**Forbidden reads (OD-3).**

- `accepted_events`, `accepted_events.raw_payload`, `accepted_events.canonical_jsonb`
- `rejected_events`
- `ingest_requests`
- `risk_observations_v0_1`
- `scoring_output_lane_a`, `scoring_output_lane_b`
- `site_write_tokens`

POI stays independent from Risk (per PR#9a OD-5).

**Output sink.**

- Stdout JSON report only (`run_metadata` + aggregated counts + a small
  distribution sample). **No DB write.** **No shadow table.** **No
  temporary `*_obs` artefact.** Mirrors PR#8b's pattern: the observer
  prints; the operator reads.

**Diagnostics fields (proposed; subject to Codex review).**

- `run_metadata`: `workspace_id`, `site_id`, `window_hours`,
  `source_versions` (per source table), `started_at`, `finished_at`,
  `observer_module_version`, `poi_input_version`,
  `extraction_version`, `record_only: true`
- `rows_scanned`: per source-table counts
- `envelopes_built`: number of `PoiCoreInput` envelopes successfully built
- `rejects`: counts by reason (`UNSAFE_PATH`, `BAD_SURFACE_CLASS`,
  `MISSING_EVIDENCE_REFS`, `INVALID_POI_TYPE`, etc.). Stage 0 exclusions
  are **NOT** a reject reason: they are eligibility/provenance state
  carried through on a successfully built envelope, not a failed
  envelope build. A Stage 0-excluded source row may still build a
  `PoiCoreInput` envelope with `stage0_excluded = true` and
  `poi_eligible = false`, provided all POI contract / privacy
  validations pass. Stage 0 exclusion counts are reported separately
  via `stage0_excluded_count` (below).
- `poi_type_distribution`: counts per `poi_type` enum value
- `poi_surface_class_distribution`: counts per `PoiSurfaceClass` enum
- `referrer_class_distribution`: counts per `ReferrerClass` enum
- `stage0_excluded_count`, `eligible_for_poi_count` — eligibility/
  provenance counters, NOT reject reasons. `stage0_excluded_count`
  reports envelopes built with `stage0_excluded = true`;
  `eligible_for_poi_count` reports envelopes built with
  `poi_eligible = true`. Both are derived from successfully-built
  envelopes.
- `behavioural_feature_version_distribution`: per `behavioural-features-v0.3` etc.
- `missing_sbf_evidence_ref_count`
- `sample_poi_keys`: privacy-gated sample (per OD-10) — only after PR#10
  `normalisePagePath` has run; truncated/limited; otherwise omitted

**Privacy invariants.**

- Full `session_id` MUST be masked (`truncateSessionId` from PR#8b helper
  precedent). Only a stable prefix appears in the report.
- DB URL MUST be masked. Only host + db name surface in stdout.
- No raw URL, no raw referrer, no UA, no IP, no `person_id`, no email.
- `sample_poi_keys` follows OD-10 — counts/distributions preferred;
  truncated samples only if privacy-safe.

**Tests.**

- Pure tests over the envelope mapper (mocked source rows).
- Static-source sweep over PR#11b active source: no `INSERT INTO` /
  `UPDATE` / `DELETE` against any allowlisted or forbidden table.
- Static-source sweep: no import from `src/scoring/policy` /
  `src/scoring/trust` / Lane A/B writers.
- Forbidden-key sweep on the report shape (mirrors PR#7b / PR#8b /
  PR#10 forbidden-key tests).
- Allowlist check: only the OD-2 read allowlist is read —
  `session_features` and `session_behavioural_features_v0_2` as primary
  POI sources, plus `stage0_decisions` as a side-read for
  eligibility/provenance. Stage 0 must not be piped as a primary source
  to the PR#10 adapter and must not appear as the envelope's
  `source_identity.source_table`.

**Runtime proof.** PR#11b runtime proof is local + targeted —
`npx tsc --noEmit`, `npm run check:scoring-contracts`, full + targeted
`npm test`, `git diff --check`, `git status --short`. The Hetzner
staging dry-run of the read-only observer is **optional** for PR#11b
because PR#11b does not persist. The full Hetzner staging proof is
reserved for PR#11d (which exercises the same code-path against
durable rows).

### §5.2 PR#11c — `poi_observations_v0_1` table + manual-CLI worker

**Goal.** Persist the `PoiCoreInput` envelopes PR#11b proved as a
durable evidence layer downstream Series / Trust / Policy can consume.

**Files (proposed).**

```
migrations/014_poi_observations_v0_1.sql
src/db/schema.sql                              ← mirror block (additive)
src/scoring/poi-core-worker/
  types.ts
  query.ts
  upsert.ts
  worker.ts                                    ← runWorker(opts): Promise<WorkerReport>
  index.ts
scripts/run-poi-core-worker.ts                 ← manual CLI batch trigger
docs/sql/verification/14_poi_observations_v0_1_invariants.sql
tests/v1/poi-core-worker.test.ts
docs/sprint2-pr11c-poi-observations-table.md   ← impl report
```

**Trigger.** Manual CLI batch (`scripts/run-poi-core-worker.ts`) only.
**NOT cron. NOT queue. NOT post-commit hook on `session_features`.**
Scheduler operationalisation is deferred to a future PR after PR#11d
proof. Manual trigger is sufficient for v0.1 because PR#11c is an
internal evidence layer with no customer-facing path, and observability
comes from PR#11d not from continuous ingestion.

**Table column shape (per OD-5).** Mirrors `PoiCoreInput` concepts, but
uses DB-practical columns:

| Column | Type | Notes |
| --- | --- | --- |
| `workspace_id` | TEXT | Identity boundary. |
| `site_id` | TEXT | Identity boundary. |
| `session_id` | TEXT | Session boundary. Masked in any report output. |
| `poi_type` | TEXT | Enum-validated against PR#10 `POI_TYPE`. |
| `poi_key` | TEXT | Normalised PR#10 `PoiKey.poi_key`. Privacy-safe. |
| `poi_surface_class` | TEXT NULL | Enum-validated against PR#10 `POI_SURFACE_CLASS`. NULL allowed. |
| `poi_input_version` | TEXT | Literal `'poi-core-input-v0.1'` from PR#10 `version.ts`. |
| `poi_observation_version` | TEXT | Literal `'poi-observation-v0.1'`. |
| `extraction_version` | TEXT | Versions the mapper from source rows. |
| `evidence_refs` | JSONB | Array of refs into allowlisted source tables. Recursive forbidden-key sweep applied. |
| `source_table` | TEXT | One of `session_features`, `session_behavioural_features_v0_2`. Mirrors PR#10 `PoiSourceTable` exactly. `stage0_decisions` may appear only in `evidence_refs[]` and in `stage0_*` eligibility/provenance fields (`stage0_excluded`, `poi_eligible`); it must NOT be the primary POI derivation `source_table`. |
| `source_row_id` | TEXT | Stable ID into the source table. |
| `source_versions` | JSONB | Map of source-table → feature-version string. |
| `first_seen_at` | TIMESTAMPTZ | From source feature row. |
| `last_seen_at` | TIMESTAMPTZ | From source feature row. |
| `derived_at` | TIMESTAMPTZ | Provenance — when the POI envelope was built. |
| `created_at` | TIMESTAMPTZ | Row insert time. Default `now()`. |
| `updated_at` | TIMESTAMPTZ | Row update time. Default `now()`. |
| `stage0_excluded` | BOOLEAN | Carry-through from PR#5 Stage 0. NULL means "no Stage 0 row found". |
| `poi_eligible` | BOOLEAN | Derived flag — eligible for downstream POI-conditioned scoring. |

**Explicit column exclusions** (must NOT appear):

- ❌ score / verdict / decision / `risk_index` / `verification_score` /
  `evidence_band` / `action_recommendation` / `reason_codes` /
  `reason_impacts` / `triggered_tags` / `penalty_total`
- ❌ `lane_a` / `lane_b` / Lane Policy Pass 1 projection fields
- ❌ `trust_decision` / `policy_decision` / `final_decision`
- ❌ `customer_facing` / `report` / `verdict` / `decision`
- ❌ raw URL query strings / `user_agent` / `ip_hash` / `ip` / `asn_id` /
  `token_hash` / `pepper` / `bearer` / `authorization`
- ❌ `person_id` / `visitor_id` / `email_id` / `person_hash` / `email_hash`
- ❌ `company_id` / `domain_id` / `ip_company` / `ip_org`
- ❌ `device_fingerprint` / `font_list` / `user_agent_family`

**Natural key.** `(workspace_id, site_id, session_id, poi_type, poi_key,
poi_input_version, poi_observation_version)` UNIQUE. Upsert is
idempotent: re-running the worker over the same seed yields the same
row count.

**Indexes.**

- UNIQUE index on the natural key.
- BTREE index on `(workspace_id, site_id, derived_at)` for windowed
  reads.
- BTREE index on `(workspace_id, site_id, poi_type, poi_key)` for
  POI-keyed reads.

**Role grants.**

- `buyerrecon_customer_api` → zero SELECT
- `buyerrecon_scoring_worker` → SELECT + INSERT + UPDATE on
  `poi_observations_v0_1` only; no DELETE
- `buyerrecon_internal_readonly` → SELECT only

**Tests.**

- Pure tests over the upsert builder.
- DB tests: migration applies idempotently; additive only (no ALTER on
  existing tables); natural-key uniqueness; idempotent upsert;
  source-count parity before/after; no forbidden columns
  (`information_schema.columns` sweep); timestamps ordered.
- Forbidden-key recursive sweep on `evidence_refs`.

**Runtime proof.** `npx tsc --noEmit`, `npm run check:scoring-contracts`,
full + targeted `npm test`, `git diff --check`, `git status --short`,
plus a local migration apply against an ephemeral DB if available. The
Hetzner staging proof is reserved for PR#11d.

### §5.3 PR#11d — POI Observation Table Observer + Hetzner staging proof

**Goal.** Prove `poi_observations_v0_1` is healthy, additive, and
privacy-safe on real staging data. Verifies the new table at the
operator boundary, mirroring PR#8b.

**Files (proposed).**

```
src/scoring/poi-core-table-observer/
  types.ts
  query.ts                                     ← SELECTs only
  report.ts
  observer.ts                                  ← runReport(opts): Promise<Report>
  index.ts
scripts/poi-core-table-observation-report.ts   ← CLI runner
tests/v1/poi-core-table-observer.test.ts
docs/sprint2-pr11d-poi-table-observer.md       ← impl report + staging proof transcript
```

**No special `hetzner-*-proof.ts` script.** The PR#8b script pattern
is preferred: a repo-local observer/report CLI that can be invoked
against the staging DSN, plus operator-side `psql` commands captured
in the impl report doc. Justification for a dedicated proof script
would need an OD-level decision; default is the PR#8b cadence.

**Report fields (proposed).**

- `run_metadata`: `workspace_id`, `site_id`, `window_hours`,
  `source_versions`, `started_at`, `finished_at`,
  `observer_module_version`, `poi_observation_version`,
  `source_table: 'poi_observations_v0_1'`, `record_only: true`
- `rows_in_table` (windowed + total)
- `natural_key_uniqueness_check`: PASS / FAIL count
- `evidence_ref_integrity`: count of rows whose `evidence_refs[]` resolve
  to extant PR#1 / PR#2 / PR#5 rows
- `forbidden_column_sweep`: count from `information_schema.columns`
  matching the §5.2 exclusion list — MUST be 0
- `poi_type_distribution`, `poi_surface_class_distribution`,
  `referrer_class_distribution`
- `stage0_excluded_count`, `poi_eligible_count`
- `timestamp_ordering_check`: count of rows where
  `first_seen_at > last_seen_at` OR `created_at > updated_at` — MUST be 0
- `source_count_drift_check`: PRE/POST source-table counts captured
  operator-side; surfaced in the impl report doc

**Hetzner staging proof — required gate signals.**

| Gate | Required |
| --- | --- |
| Branch synced to PR#11d HEAD | YES |
| `git status --short` clean | YES |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| Targeted PR#11d test file | PASS |
| Full suite | PASS |
| `git diff --check` | PASS |
| OBS boundary `OBS_WORKSPACE_ID`, `OBS_SITE_ID`, `OBS_WINDOW_HOURS` | Set |
| DB target host = `127.0.0.1:5432` (or staging hostname), db = `buyerrecon_staging` | YES |
| DSN masking in stdout | YES — full DSN never printed |
| PRE counts on `accepted_events`, `rejected_events`, `ingest_requests`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `poi_observations_v0_1` | Captured operator-side |
| Worker run (if running PR#11c worker too) | exit 0 |
| Observer run | exit 0 |
| POST counts on the same tables | Source counts unchanged. Lane A/B = 0 PRE / 0 POST. `poi_observations_v0_1` populated to worker's reported `upserted_rows`. |
| `grep stdout` for `password`, full DSN, `token_hash`, `pepper`, raw URL with query, raw referrer | 0 hits |
| Customer-facing output | NONE |
| Render production | UNTOUCHED + still blocked (A0 P-4) |
| `observe:risk-core-bridge` still PASS | YES |
| `npm test` (targeted PR#10 + PR#11b + PR#11c) still PASS | YES |

The Hetzner proof transcript lives inside the PR#11d impl report doc,
matching `docs/sprint2-pr8b-risk-core-bridge-observer.md` precedent.

---

## §6 Observer-first rationale

POI is privacy-sensitive. POI keys touch URL paths, route patterns,
CTA / form identifiers, referrer classes — all of which can leak
identity if mishandled. PR#10 closed four Codex blockers explicitly
around email-shaped path PII, `poi_surface_class` enum validation,
and `evidence_refs` allowlist + recursive forbidden-key sweep. Those
defences are pure-TS today. They have not yet been exercised against
real staging-derived rows.

**Observer-first** means: before any durable POI row exists, run a
read-only observer that pipes real `session_features` and
`session_behavioural_features_v0_2` rows through the PR#10 adapter and
prints a diagnostics report. These two tables are the only primary POI
derivation sources (PR#10 `PoiSourceTable`). `stage0_decisions` is an
**optional side-read** consulted only to populate eligibility /
provenance carry-through (`stage0_excluded`, `poi_eligible`) and to
append a Stage 0 entry into `evidence_refs[]`; Stage 0 rows are never
piped through the adapter as a primary source and never become the
envelope's `source_identity.source_table`. If the observer surfaces a
leak, the only recovery cost is patching the contract; there is no
migration to roll back, no row to scrub, no consumer to notify.

The risk profile of "build a table then run an observer" is the
opposite. A table embeds the privacy contract permanently. A leak
discovered after the table exists requires migration + scrub + audit.

PR#8b validated the read-only-observer pattern for Risk. PR#11b
applies the same pattern to POI **before** PR#11c writes anything
durable. PR#11c's table design is allowed to rest on whatever PR#11b
proves works.

The four-step sequence — plan (11a) → observe read-only (11b) →
persist (11c) → observe table (11d) — is the privacy-safe ordering.
It also matches the cadence Helen approved for Risk: PR#7a contract,
PR#7b adapter, PR#8a planning, PR#8b observer + Hetzner proof.

---

## §7 Privacy posture

The PR#9a / PR#10 privacy posture is **invariant** through PR#11a–d:

- **Surface-centric, not person-centric.** POI is a normalised object
  of interest. It is NEVER a person identity / company identity /
  IP-derived entity / device-fingerprint surface / cookie-derived
  identity.
- **No identity enrichment.** No visitor ID, no person ID, no email
  lookup, no company lookup, no reverse DNS, no IP-to-org.
- **No raw URLs with query strings.** PR#10 `normalisePagePath()`
  is the only path through which a URL becomes a POI key. Email /
  token / credential markers reject as `null`.
- **No raw referrer URL.** Referrer reduces to a class enum.
- **No raw UA.** Even `user_agent_family` is out — it's a
  person-correlation surface.
- **No token / pepper / auth header / IP / IP-hash.**
- **`evidence_refs` allowlist only.** Three source tables:
  `session_features`, `session_behavioural_features_v0_2`,
  `stage0_decisions`. Recursive forbidden-key sweep walks nested
  JSON.
- **Sample POI keys in reports follow OD-10.** Counts and
  distributions preferred. Truncated samples only if privacy-safe
  and only after PR#10 normalisation.
- **`session_id` masking** in any observer report. Full ID never
  printed.
- **DSN masking** in any CLI stdout. Only host + db name appear.
- **No customer-facing output.** Reports are JSON for engineers.
- **No Lane A / Lane B writes.** PR#11a/b/c/d all preserve the
  Architecture Gate A0 P-4 Render production block.

Any future expansion of POI's source-table allowlist requires an
explicit contract amendment with Helen sign-off — not a quiet edit
to the allowlist.

---

## §8 Runtime proof plan

| PR | Local gates | Hetzner staging proof |
| --- | --- | --- |
| **PR#11a** | `git diff -- docs/sprint2-pr11a-poi-derived-observation-planning.md`, `git status --short`. No tsc, no tests. | None — docs-only. |
| **PR#11b** | `npx tsc --noEmit`, `npm run check:scoring-contracts`, targeted + full `npm test`, `git diff --check`, `git status --short`. | **Optional dry-run** of the read-only observer against staging DSN. PR#11b does not persist so the dry-run is not gating. Full proof reserved for PR#11d. |
| **PR#11c** | All PR#11b local gates + local migration apply against an ephemeral DB (if available) + DB tests for additive-only / natural-key / forbidden-column sweep. | **Optional staging migration apply** + worker run. Full Hetzner proof reserved for PR#11d. PR#11c may attach the staging migration apply transcript to its impl report if convenient. |
| **PR#11d** | All PR#11b local gates + targeted PR#11d test file. | **Required.** Mirrors PR#8b: HEAD synced, clean tree, tsc, scoring contracts, full + targeted tests, OBS boundary set, staging DSN target, PRE counts, observer run exit 0, POST counts, source-count parity, Lane A/B = 0/0, no secrets in stdout, no Render touched, `observe:risk-core-bridge` still PASS. |

The PR#11d proof is the load-bearing gate. PR#11b and PR#11c may pass
local gates and a partial staging exercise, but the chain is not
considered complete until PR#11d's transcript lands.

---

## §9 Test plan

### §9.1 PR#11b (read-only observer)

Pure tests (targeted file `tests/v1/poi-core-observer.test.ts`):

- Envelope mapper given a `session_features` row → builds well-shaped
  `BuildPoiCoreInputArgs` and `PoiCoreInput` envelope.
- Envelope mapper given a `session_behavioural_features_v0_2` row →
  same.
- Envelope mapper given Stage 0 excluded row → carries
  `stage0_excluded = true`; does not silently drop.
- Envelope mapper given a malformed source row → reports a typed
  reject reason, does not throw.
- Report aggregator → counts roll up correctly across rejects and
  successes.
- Static-source sweep over PR#11b active source: no `INSERT INTO` /
  `UPDATE` / `DELETE` against any table.
- Static-source sweep: no import from `src/scoring/policy` /
  `src/scoring/trust` / Lane A/B writers.
- Static-source sweep: only the OD-2 read allowlist appears in PR#11b
  SQL strings — `session_features` and `session_behavioural_features_v0_2`
  as primary POI sources, plus `stage0_decisions` as a side-read for
  eligibility/provenance. The static check asserts that
  `stage0_decisions` is never bound to a primary-source code path
  (i.e. never piped into `buildPoiCoreInput()` as
  `PoiSourceRow.source_table`).
- Forbidden-key sweep on the emitted report shape (mirrors PR#7b /
  PR#8b / PR#10 sweeps).
- `truncateSessionId` invariant: full `session_id` does NOT appear in
  any report field; the truncated prefix DOES appear where useful.
- DSN masking: report never carries the DB password / full DSN string.

### §9.2 PR#11c (table + worker)

Pure tests:

- Upsert builder given a `PoiCoreInput` envelope → produces the
  expected `INSERT … ON CONFLICT … DO UPDATE` statement.
- Idempotency: two builds over the same envelope produce identical
  parameters.
- Natural-key extraction matches the §5.2 tuple exactly.
- Forbidden-key recursive sweep on `evidence_refs` rejects nested
  forbidden keys.
- `poi_surface_class` enum validated against PR#10
  `POI_SURFACE_CLASSES_ALLOWED`.
- `source_table` validated against PR#10 `PoiSourceTable` —
  i.e. `session_features` and `session_behavioural_features_v0_2` only.
  The OD-2 read allowlist is broader because it permits `stage0_decisions`
  as a side-read, but that does not make Stage 0 a primary POI source.
  A `stage0_decisions` value in `source_table` must be rejected by the
  upsert builder.

DB tests (`tests/v1/poi-core-worker.test.ts` against ephemeral DB):

- Migration applies idempotently (`CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`).
- Additive only: no ALTER on existing tables, no DROP, no CASCADE.
- Natural-key uniqueness: second INSERT at the same tuple → ON
  CONFLICT DO UPDATE.
- Idempotent worker run: re-running the worker over the same seed
  produces the same row count.
- `evidence_refs` integrity: every persisted row's entries resolve to
  extant PR#1 / PR#2 / PR#5 rows.
- Forbidden columns sweep on `information_schema.columns`: zero rows
  for the §5.2 exclusion list.
- Timestamp ordering: `first_seen_at <= last_seen_at`,
  `created_at <= updated_at`.
- No raw URL query strings: defensive `?` sweep on `poi_key`.
- Source-table parity: pre/post counts on `accepted_events`,
  `rejected_events`, `ingest_requests`, `session_features`,
  `session_behavioural_features_v0_2`, `stage0_decisions`,
  `risk_observations_v0_1` equal.
- Lane A/B counts unchanged (operator-side per PR#8a §11).
- Role privileges: `buyerrecon_customer_api` zero SELECT;
  `buyerrecon_scoring_worker` SELECT + INSERT + UPDATE;
  `buyerrecon_internal_readonly` SELECT only.

### §9.3 PR#11d (table observer)

Pure tests (`tests/v1/poi-core-table-observer.test.ts`):

- Query builder produces SELECT-only statements.
- Static-source sweep: no `INSERT INTO` / `UPDATE` / `DELETE`.
- Forbidden-key sweep on the emitted report shape.
- Natural-key uniqueness check builder.
- Forbidden-column sweep builder targets the §5.2 exclusion list.
- Timestamp-ordering check builder.
- `truncateSessionId` invariant on any report field referencing a
  session.
- DSN masking on any CLI stdout.

DB integration tests (against ephemeral DB):

- Observer over an empty table returns `rows_in_table: 0` with no errors.
- Observer over a seeded table returns the expected counts and
  distributions.
- Observer NEVER mutates the table (pre/post counts equal).

---

## §10 Codex review checklist

Before each PR#11 step commits, Codex must answer **YES** to all
of the following questions about the relevant impl PR. PR#11a alone
must answer YES to questions marked (A); PR#11b/c/d each must answer
YES to questions marked (B/C/D).

| # | Question | Applies | Expected |
| --- | --- | --- | --- |
| 1 | Is PR#11a planning **docs-only** (one new file under `docs/`)? | A | YES |
| 2 | Does PR#11a explicitly defer all code / DB / migration / worker / observer / table creation to PR#11b–d? | A | YES |
| 3 | Does PR#11a sequence implementation **observer-first** (PR#11b read-only before PR#11c durable table)? | A | YES |
| 4 | Does PR#11b read **only** from `session_features` and `session_behavioural_features_v0_2` as primary POI sources, plus `stage0_decisions` as an optional side-read for eligibility/provenance — and never pipe `stage0_decisions` as a primary source through the PR#10 adapter? | B | YES |
| 5 | Does PR#11b avoid reading `accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`? | B | YES |
| 6 | Does PR#11b output **log/report only** with **no DB write** and **no temporary shadow table**? | B | YES |
| 7 | Does PR#11c migration apply **additively** (no ALTER on existing tables, no DROP, no CASCADE)? | C | YES |
| 8 | Does PR#11c table column shape match §5.2 exactly and exclude every column in the §5.2 forbidden list? | C | YES |
| 9 | Does PR#11c trigger via **manual CLI batch only** (no cron, no queue, no post-commit hook)? | C | YES |
| 10 | Does PR#11c preserve role grants per §5.2 (`customer_api` zero SELECT; `scoring_worker` S/I/U; `internal_readonly` S only)? | C | YES |
| 11 | Does PR#11d table observer read-only (no writes anywhere)? | D | YES |
| 12 | Does PR#11d Hetzner staging proof transcript match the §5.3 gate-signal table? | D | YES |
| 13 | Do all four PRs preserve the **PR#9a / PR#10 privacy posture** (surface-centric only, no identity enrichment, no raw URL, no raw referrer, no UA, no IP, allowlisted evidence refs)? | A,B,C,D | YES |
| 14 | Do all four PRs **avoid Lane A / Lane B writes** and Architecture Gate A0 P-4 Render production? | A,B,C,D | YES |
| 15 | Do all four PRs **avoid customer-facing output** (no dashboards, no rendered text, no scoring label)? | A,B,C,D | YES |
| 16 | Do all four PRs preserve **evidence lineage** to derived layers and forbid raw-ledger bypass? | A,B,C,D | YES |
| 17 | Do all four PRs **propose explicit versioning** (`poi-observation-v0.1`, etc.) so a future bump is reviewable? | A,B,C,D | YES |
| 18 | Does each PR list **open decisions** for Helen so the next step has unambiguous gates? | A,B,C,D | YES |

Codex BLOCKED on any NO. PR#11a commit proceeds only on unanimous YES
to (A) rows.

---

## §11 Hard exclusions

PR#11a planning AND any subsequent PR#11b/c/d implementation MUST
exclude:

- **Render production deployment.** A0 P-4 still blocking.
- **Customer-facing output of any kind.** Internal engineering
  diagnostics only.
- **Lane A / Lane B writes.** `scoring_output_lane_a` /
  `scoring_output_lane_b` remain empty until Policy Pass 1 ships
  (deferred).
- **Policy decisions.** No Policy Pass 1 / Pass 2 / runtime decision.
- **Trust decisions.** No Trust Core invocation.
- **Final scoring.** No `RiskIndex`, no `RiskOutput`, no
  `verification_score`, no `evidence_band`, no `action_recommendation`.
- **CRM / sales / outreach automation.** No webhook out, no email,
  no Slack, no LinkedIn DM, no third-party push.
- **Visitor ID / person ID / company / IP-org enrichment.** POI stays
  surface-centric.
- **IP / company enrichment.** No reverse-DNS, no ASN, no Clearbit.
- **Raw full URLs with query strings.** PR#10 `normalisePagePath`
  remains the only path to a POI key.
- **Raw `user_agent`** in any persisted column or report field. Even
  `user_agent_family` stays out.
- **Token hashes / IP hashes / peppers / auth headers** anywhere.
- **ML models.** No sklearn, no torch, no xgboost, no onnx, no
  lightgbm. POI normalisation stays deterministic.
- **Black-box scoring.** Every POI derivation rule is explicit,
  reviewable, unit-tested.
- **Dashboard / report renderer.** Reports are JSON for engineers.
- **Product adapter claims.** PR#11 chain is shared-core only.
- **GA4 / GTM / LinkedIn changes.** Collector stays untouched.
- **Cron / queue / post-commit hook** for PR#11c worker. Manual CLI
  batch only in v0.1.
- **Temporary `*_obs` shadow table** in PR#11b. Read-only + report-only.
- **Dedicated `hetzner-*-proof.ts` script** in PR#11d unless a future
  OD-level decision justifies it.
- **Risk-as-input to POI derivation.** PR#9a OD-5 holds: POI stays
  independent.

---

## §12 OD-* open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Should PR#11b be **observer-first** before any durable POI table? | **YES.** Read-only observer over real staging-derived rows is the privacy-safe rollout. If the observer surfaces a leak, the only recovery cost is patching the contract — no migration to roll back, no row to scrub. Mirrors PR#8b cadence. |
| **OD-2** | Should PR#11b read **only** from `session_features` and `session_behavioural_features_v0_2` as primary POI derivation sources, with `stage0_decisions` available **only as a side-read** for eligibility/provenance (never piped as a primary source through the PR#10 adapter, never assigned to `PoiCoreInput.source_identity.source_table`, and never written into durable `poi_observations_v0_1.source_table`)? | **YES.** Two-table primary allowlist (mirrors PR#10 `PoiSourceTable`) plus Stage 0 as an explicit side-read. Stage 0 is read only for `excluded` + `rule_id` to populate `stage0_excluded` / `poi_eligible` carry-through and to append a Stage 0 entry into `evidence_refs[]`. Any future allowlist expansion — including any attempt to promote Stage 0 to a primary POI source — requires explicit contract amendment with Helen sign-off, not a quiet edit. |
| **OD-3** | Should PR#11b **forbid** reading `accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`? | **YES.** Reading `accepted_events` would bypass PR#1 / PR#2 lineage and re-derive features from the raw ledger. Reading `risk_observations_v0_1` would create a Risk↔POI cycle (PR#9a OD-5 holds: POI stays independent). Reading Lane A/B would invert layering. `rejected_events` and `ingest_requests` are Stage 0 territory, not POI's. `site_write_tokens` is auth surface. |
| **OD-4** | Should PR#11b **output sink** be log/report only with **no DB write** and **no temporary shadow table**? | **YES.** PR#11b must be read-only like PR#8b. Durable persistence begins only in PR#11c. Adding a shadow table to PR#11b would create two persistence layers to reason about and would defeat the observer-first risk profile. |
| **OD-5** | Should `poi_observations_v0_1` use the §5.2 column shape (mirrors PR#10 `PoiCoreInput` concepts, DB-practical columns, no score/verdict/policy/trust/lane fields)? | **YES — §5.2 shape exactly.** Identity boundary + POI key + evidence lineage + versions + provenance + Stage 0 carry-through + eligibility flag. Explicit exclusions enumerated. Any future column addition requires schema-change PR. |
| **OD-6** | Should PR#11c worker trigger be **manual CLI batch only** in v0.1 (no cron, no queue, no post-commit hook)? | **YES.** Manual trigger is sufficient because PR#11c is an internal evidence layer with no customer path. Continuous ingestion is operationalisation work that can come after PR#11d proof. Locking in a scheduler before observability exists is the wrong order. |
| **OD-7** | Should PR#11d Hetzner proof mirror the **PR#8b proof shape** (git HEAD clean, tsc, scoring contracts, targeted + full tests, staging env boundary, PRE/POST counts, no Render, no secrets) — using a **repo-local observer/report CLI** + operator psql commands rather than a dedicated `hetzner-*-proof.ts` script? | **YES.** PR#8b's pattern is proven. A dedicated proof script adds a new runtime artefact to review without changing the gate signals it captures. Default is the PR#8b cadence; a dedicated script may be reconsidered later if justified. |
| **OD-8** | Should the privacy gate require **both** synthetic-fixture coverage and Hetzner staging proof for the POI chain? | **YES, both.** Synthetic fixtures catch deterministic edge cases (the Codex blocker #4 / Group S tests are an example — they would not have been triggered by staging data alone). Staging proof catches real-world data-shape surprises. Either alone is insufficient. |
| **OD-9** | Should PR#11b and PR#11c carry **Stage 0 eligibility/provenance through** (do not silently drop excluded sessions; do not let Stage 0 become a POI key/context)? | **YES.** Stage-0-excluded sessions are not buyer-motion sources, but the POI observation may still record them flagged as `stage0_excluded = true` for audit. Downstream Series / Trust / Policy decide whether to consume them. Stage 0 is a gate, not a POI surface. |
| **OD-10** | Should **sample POI keys in reports** be allowed only if privacy-safe, truncated/limited, and generated after PR#10 normalisation — otherwise counts/distributions only? | **YES.** Default is counts and distributions per `poi_type` / `poi_surface_class` / `referrer_class`. Truncated key samples may appear in PR#11b / PR#11d reports only when they have passed `normalisePagePath` / `validateCtaId` / `validateFormId` (so email-shaped PII and credential markers cannot escape) and only when the sample size is bounded. Anything ambiguous defaults to count-only. |

All 10 ODs are load-bearing — Helen signs all 10 (or substitutes
explicit alternatives) before PR#11b implementation begins.

---

## §13 Recommended next steps

1. **Codex xhigh review** of this PR#11a planning doc. Codex must
   answer YES to every (A) row in §10.
2. **Helen written sign-off** on OD-1..OD-10 above. Sign-off may
   substitute explicit alternatives for any OD, but each OD must be
   resolved in writing before PR#11b starts.
3. **Commit PR#11a** (`docs/sprint2-pr11a-poi-derived-observation-planning.md`)
   to `sprint2-architecture-contracts-d4cc2bf` as a docs-only commit.
   No code change accompanies the commit. Push.
4. **Begin PR#11b** on a fresh worktree from the post-PR#11a HEAD.
   PR#11b is **read-only observer + report only**, NO DB write, NO
   shadow table. Follow §5.1 file layout and §9.1 test plan.
5. **Begin PR#11c** only after PR#11b's Codex xhigh PASS. PR#11c is
   the additive migration + manual-CLI worker. Follow §5.2 column
   shape exactly.
6. **Begin PR#11d** only after PR#11c's Codex xhigh PASS. PR#11d is
   the table observer + Hetzner staging proof, mirroring PR#8b.
7. **Architecture Gate A0 P-4 Render production block** remains in
   force across the entire chain. No PR#11 step modifies Render
   state.

---

## §14 What this planning doc does NOT do

- Does **not** implement PR#11b / PR#11c / PR#11d.
- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json` / `package-lock.json`.
- Does **not** touch the DB or run `psql`.
- Does **not** touch Render.
- Does **not** touch the collector (`src/collector/v1/**`).
- Does **not** modify `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#6 / PR#7a / PR#7b / PR#8a / PR#8b / PR#9a /
  PR#10 code.
- Does **not** modify any migration in `migrations/`.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`,
  `scoring/forbidden_codes.yml`.
- Does **not** create a worker.
- Does **not** create an observer.
- Does **not** create a table.
- Does **not** create customer-facing output.
- Does **not** commit. Does **not** push.

---

## §15 Implementation gate

PR#11b implementation may begin only after **all** of the following
hold:

1. Helen written sign-off on this PR#11a planning doc (OD-1..OD-10).
2. Codex xhigh review of this PR#11a planning doc → PASS.
3. PR#10 commit `f9d2a75` (or later) remains stable.
4. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.
5. AMS shared-core priority order (Risk → POI → Series → Trust →
   Policy) remains the operative architecture rule. No product-
   adapter PR overtakes this sequence without explicit Helen
   amendment.
6. PR#9a OD-5 holds — POI stays independent from Risk by default;
   `risk_observations_v0_1` is not a POI derivation input.
7. PR#9a OD-2 Option A holds — POI Core Input Contract (PR#10) is the
   established surface; PR#11b/c/d build on top of it without
   re-litigating the contract shape.

After all seven hold, PR#11b implementation may begin on a new branch
from `sprint2-architecture-contracts-d4cc2bf` HEAD (or its successor).
