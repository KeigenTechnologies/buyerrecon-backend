# Sprint 2 PR#11c — POI Observations Table + Manual Worker Planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation work. No code, no migration, no `schema.sql` change,
no `psql`, no DB touch, no collector / app / server / auth change.
No PR#6 / PR#7 / PR#8 / PR#9a / PR#10 / PR#11a / PR#11b code
modification. PR#0–PR#11b implementation files are referenced
read-only.

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#11b pushed + Hetzner-proven) | `1a3b25251f7f5a24814c19b86769b2eee1df982d` |
| Prior closed commits | PR#0..PR#10 + PR#11a `3007162` + PR#11b `1a3b252` |
| PR#10 POI Core Input Contract HEAD | `f9d2a75` (read-only reference) |
| PR#11a POI Observation chain planning HEAD | `3007162` (read-only reference) |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing shared-core workflow)
- AMS `docs/algorithms/POI_CORE_*` (POI Core algorithm spec — read-only reference)
- `docs/sprint2-pr9a-poi-core-input-planning.md` (Helen-signed OD-1..OD-8)
- `docs/sprint2-pr10-poi-core-input.md` (PR#10 contract impl + Codex xhigh PASS)
- `docs/sprint2-pr11a-poi-derived-observation-planning.md` (Helen-signed OD-1..OD-10; §5.2 baseline column shape)
- `docs/sprint2-pr11b-poi-core-input-observer.md` (PR#11b impl + Hetzner proof)
- `docs/sprint2-pr8a-risk-core-bridge-observer-planning.md` (PR#8b precedent observer planning)
- `docs/sprint2-pr8b-risk-core-bridge-observer.md` (PR#8b precedent observer impl + Hetzner proof)
- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md` (Helen-signed §0 architecture correction)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` (P-4 Render production still blocking)
- `src/scoring/poi-core/{types,normalise,adapter,index,version}.ts` (PR#10 contract — read-only reference)
- `src/scoring/poi-core-observer/{types,sql,mapper,report,runner,index}.ts` (PR#11b observer — read-only reference)
- `src/db/schema.sql:320-440` (session_features + SBF), `src/db/schema.sql:580-636` (stage0_decisions) — read-only schema reference
- `migrations/008..013` — existing migrations end at 013; PR#11c will use migration 014

---

## §1 Goal

Plan the durable `poi_observations_v0_1` table + manual-CLI worker
that persists the **successfully-built `page_path` POI envelopes**
PR#11b proved on real staging data. PR#11c is the **persistence
gate** for POI evidence: PR#11b proved the contract works in memory;
PR#11c gives the contract a durable backing store so downstream
Series / Trust / Policy / Product-Context-Fit layers can later
consume POI evidence with stable provenance.

PR#11c is **docs-only**. It writes one new file under `docs/` and
nothing else. PR#11c does NOT create the migration, does NOT create
the worker, does NOT create tests, does NOT touch the DB, does NOT
edit `schema.sql` or `package.json`. Implementation lands in a
separate gated PR (PR#11c impl) after Codex xhigh PASS and Helen
sign-off on the OD list below.

---

## §2 Status / upstream proof

PR#11b — the **POI Core Input Observer** — completed Hetzner staging
proof at HEAD `1a3b252` with the following gate signals all green:

| Gate | Result |
| --- | --- |
| Branch synced to PR#11b HEAD | `1a3b252` |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| Targeted PR#11b observer tests | 72 / 72 PASS |
| Full suite | 43 files / 2452 tests PASS |
| OBS boundary | `OBS_WORKSPACE_ID=buyerrecon_staging_ws`, `OBS_SITE_ID=buyerrecon_com`, `OBS_WINDOW_HOURS=720` |
| DB target | Hetzner staging — host `127.0.0.1:5432`, db `buyerrecon_staging` |
| Observer exit code | 0 |
| `rows_scanned` (total) | 24 |
| `rows_scanned_by_source_table.session_features` | 8 |
| `rows_scanned_by_source_table.session_behavioural_features_v0_2` | 16 |
| `envelopes_built` | 8 |
| `rejects` | 16 (all `NO_PAGE_PATH_CANDIDATE` from SBF — expected) |
| `poi_type_distribution.page_path` | 8 |
| `source_table_distribution.session_features` | 8 |
| `source_table_distribution.session_behavioural_features_v0_2` | 0 |
| `stage0_excluded_count` | 6 |
| `eligible_for_poi_count` | 2 |
| `unsafe_poi_key_reject_count` | 0 |
| `evidence_ref_reject_count` | 0 |
| PRE/POST source-table parity | accepted_events 14·14, ingest_requests 14·14, rejected_events 0·0, risk_observations_v0_1 2·2, scoring_output_lane_a 0·0, scoring_output_lane_b 0·0, session_behavioural_features_v0_2 16·16, session_features 8·8, stage0_decisions 8·8 |
| Render production | UNTOUCHED + still blocked (A0 P-4) |
| Customer-facing output | NONE |
| DB writes from PR#11b | NONE (read-only observer) |

**Three load-bearing signals from the proof shape PR#11c's design:**

1. **SF produced 8 of 8 envelopes; SBF produced 0 of 16.** The SBF
   schema carries no path / CTA / form / offer / referrer columns,
   so every SBF row rejects with `NO_PAGE_PATH_CANDIDATE`. There is
   nothing to persist from SBF in v0.1. → PR#11c v0.1 persists only
   `session_features` envelopes.

2. **`stage0_excluded_count=6` vs. `eligible_for_poi_count=2`.**
   Six of the eight successful envelopes were Stage-0-excluded.
   Those rows STILL built valid `PoiCoreInput` envelopes — Stage 0
   exclusion is carry-through, not a reject (PR#11a §5.1 patch).
   → PR#11c v0.1 stores Stage-0-excluded rows with
   `stage0_excluded=true, poi_eligible=false` for audit lineage.

3. **`unsafe_poi_key_reject_count=0`, `evidence_ref_reject_count=0`.**
   PR#10's privacy filters did not trip on real staging data. POI
   key normalisation and `evidence_refs` validation are both clean
   on the current sample. → PR#11c worker can reuse the PR#10
   adapter verbatim; no contract revision needed before PR#11c.

PR#11b is the **upstream gate** that unlocks PR#11c planning.

---

## §3 Scope boundaries

PR#11c planning is **docs-only**. It MUST NOT:

- write or edit any `.ts` source file
- write or edit any `.sql` file (no migration, no `schema.sql` edit,
  no verification SQL file creation)
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
- create a verification SQL file
- modify any PR#10 / PR#11b file
- commit
- push

PR#11c deliverable is exactly one new file:

```
docs/sprint2-pr11c-poi-observations-table-worker-planning.md   ← this file
```

The validation surface for PR#11c is:

```
git diff -- docs/sprint2-pr11c-poi-observations-table-worker-planning.md
git status --short
```

No `tsc`, no `npm test`, no contract checks. PR#11c is text.

---

## §4 Durable table design — `poi_observations_v0_1`

PR#11c v0.1 introduces one new table. The shape below refines the
PR#11a §5.2 baseline for the proven PR#11b path: **only successful
`page_path` POI observations derived from `session_features` are
persisted in v0.1**.

### §4.1 Column shape (planned for PR#11c impl)

The migration body is **planned** here — the SQL block is illustrative
only; PR#11c planning does NOT create `migrations/014_*.sql` or edit
`src/db/schema.sql`. PR#11c implementation creates both.

```sql
-- migrations/014_poi_observations_v0_1.sql (PLANNED — not created in PR#11c planning)
CREATE TABLE IF NOT EXISTS poi_observations_v0_1 (
  poi_observation_id        BIGSERIAL    PRIMARY KEY,

  -- Identity boundary
  workspace_id              TEXT         NOT NULL,
  site_id                   TEXT         NOT NULL,
  session_id                TEXT         NOT NULL,

  -- POI key (PR#10 contract)
  poi_type                  TEXT         NOT NULL,
  poi_key                   TEXT         NOT NULL,
  poi_surface_class         TEXT,        -- NULL allowed; finite enum when set

  -- Versions (PR#4 + PR#10 + PR#11c stamps)
  poi_input_version         TEXT         NOT NULL,
  poi_observation_version   TEXT         NOT NULL,
  extraction_version        TEXT         NOT NULL,

  -- Evidence lineage (PR#10 envelope verbatim, post-validation)
  -- NO DEFAULT — every persisted row MUST carry at least one
  -- evidence_ref entry (see CONSTRAINT poi_obs_v0_1_evidence_refs_nonempty
  -- below). The worker always builds evidence_refs from the
  -- successful session_features source row; optional stage0_decisions
  -- evidence_ref is appended when the Stage 0 side-read returns a
  -- row. Empty lineage is invalid.
  evidence_refs             JSONB        NOT NULL,

  -- Primary source provenance (v0.1: SF only)
  source_table              TEXT         NOT NULL,
  source_row_id             TEXT         NOT NULL,
  source_event_count        INT          NOT NULL,
  poi_key_source_field      TEXT         NOT NULL,   -- OD-11: 'landing_page_path' | 'last_page_path'

  -- Forward-compatible versions map
  -- (extraction_version / stage0_version / future behavioural_feature_version)
  source_versions           JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- Eligibility / provenance (Stage 0 carry-through)
  stage0_excluded           BOOLEAN      NOT NULL DEFAULT FALSE,
  -- poi_eligible is the pure boolean inverse of stage0_excluded
  -- (enforced by CONSTRAINT poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded
  -- below). It is eligibility carry-through, not an independent
  -- judgement — see §5.5.
  poi_eligible              BOOLEAN      NOT NULL,
  -- stage0_rule_id is PROVENANCE-ONLY (see §5.5). NULL when no
  -- Stage 0 row found for the session. Persisted only for audit
  -- lineage — it MUST NOT become a POI key, POI context, scoring
  -- reason, customer-facing reason code, Policy/Trust reason,
  -- downstream judgement, report language, or Product-Context-Fit
  -- input.
  stage0_rule_id            TEXT,

  -- Timestamps
  first_seen_at             TIMESTAMPTZ,
  last_seen_at              TIMESTAMPTZ,
  derived_at                TIMESTAMPTZ  NOT NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Record-only literal (mirrors PR#5 / PR#6 pattern)
  record_only               BOOLEAN      NOT NULL DEFAULT TRUE,

  -- v0.1 constraints — every constraint widens at most via a future
  -- migration after explicit contract amendment with Helen sign-off.

  CONSTRAINT poi_obs_v0_1_poi_type_v0_1
    CHECK (poi_type = 'page_path'),                         -- PR#11c v0.1 hard-coded

  CONSTRAINT poi_obs_v0_1_source_table_v0_1
    CHECK (source_table = 'session_features'),              -- PR#11c v0.1 SF only

  CONSTRAINT poi_obs_v0_1_poi_key_source_field
    CHECK (poi_key_source_field IN ('landing_page_path', 'last_page_path')),

  CONSTRAINT poi_obs_v0_1_record_only_must_be_true
    CHECK (record_only IS TRUE),

  CONSTRAINT poi_obs_v0_1_source_event_count_nonneg
    CHECK (source_event_count >= 0),

  CONSTRAINT poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded
    -- poi_eligible is eligibility carry-through, not an independent
    -- judgement. It MUST be the pure boolean inverse of
    -- stage0_excluded. No other PR#11c worker rule may set
    -- poi_eligible — see §5.5 / OD-8.
    CHECK (poi_eligible = (NOT stage0_excluded)),

  CONSTRAINT poi_obs_v0_1_timestamps_ordered
    CHECK (first_seen_at IS NULL
           OR last_seen_at IS NULL
           OR first_seen_at <= last_seen_at),

  CONSTRAINT poi_obs_v0_1_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),

  CONSTRAINT poi_obs_v0_1_evidence_refs_nonempty
    -- Empty lineage is invalid. PR#10 adapter already rejects empty
    -- evidence_refs at envelope build time; this DB-level CHECK is
    -- defence-in-depth against a future worker bug or an out-of-band
    -- DML path.
    CHECK (jsonb_array_length(evidence_refs) > 0),

  CONSTRAINT poi_obs_v0_1_source_versions_is_object
    CHECK (jsonb_typeof(source_versions) = 'object'),

  CONSTRAINT poi_obs_v0_1_natural_key UNIQUE
    (workspace_id, site_id, session_id, poi_type, poi_key,
     poi_input_version, poi_observation_version, extraction_version)
);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_workspace_site
  ON poi_observations_v0_1 (workspace_id, site_id, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_session
  ON poi_observations_v0_1 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_poi_key
  ON poi_observations_v0_1 (workspace_id, site_id, poi_type, poi_key);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_versions
  ON poi_observations_v0_1 (poi_input_version, poi_observation_version, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_stage0_excluded
  ON poi_observations_v0_1 (workspace_id, site_id, stage0_excluded, derived_at DESC)
  WHERE stage0_excluded = TRUE;
```

### §4.2 Explicit column exclusions

The following columns MUST NOT appear in
`poi_observations_v0_1`. The PR#11d table observer's
`information_schema.columns` sweep verifies their absence.

- ❌ score / verdict / decision / `risk_index` / `verification_score` /
  `evidence_band` / `action_recommendation` / `reason_codes` /
  `reason_impacts` / `triggered_tags` / `penalty_total` / any
  RiskOutput-shaped field
- ❌ `lane_a` / `lane_b` / any Policy Pass 1 projection field
- ❌ `trust_decision` / `policy_decision` / `final_decision`
- ❌ `customer_facing` / `report` / `verdict` / any customer-rendered
  output
- ❌ raw URL with query strings / `page_url` / `full_url` / `url_query` /
  `query`
- ❌ `user_agent` / `ua` / `user_agent_family`
- ❌ `ip` / `ip_hash` / `asn_id` / `ip_company` / `ip_org`
- ❌ `token_hash` / `pepper` / `bearer` / `authorization` / `cookie` /
  `auth`
- ❌ `person_id` / `visitor_id` / `email_id` / `person_hash` /
  `email_hash` / `email` / `phone`
- ❌ `company_id` / `domain_id` / `account_id`
- ❌ `device_fingerprint` / `font_list`
- ❌ `raw_payload` / `payload` / `canonical_jsonb`
- ❌ `behavioural_feature_version` as a first-class column (OD-9 — kept
  in `source_versions` JSONB only, since PR#11c v0.1 does not persist
  SBF)

### §4.3 Natural key (OD-3)

`(workspace_id, site_id, session_id, poi_type, poi_key,
poi_input_version, poi_observation_version, extraction_version)`
UNIQUE.

The `extraction_version` term lets a future bump of
`session-features-v0.1 → v0.2` cohabitate in the same table without a
collision. `source_row_id` is **deliberately NOT in the natural key**
— if two SF row IDs produce the same `(session_id, poi_key,
extraction_version)` tuple (e.g. an SF re-extract for the same
session under the same extraction_version), the worker upserts and
the second row's `source_row_id` overwrites the first via
`ON CONFLICT DO UPDATE` (OD-6). `source_table` is also not in the
natural key for v0.1 — the CHECK constraint already pins it to
`'session_features'`.

### §4.4 Provenance fields (OD-11)

`poi_key_source_field TEXT NOT NULL CHECK IN
('landing_page_path', 'last_page_path')` — records which
`session_features` column the worker chose to derive `poi_key` from.
PR#11b's mapper prefers `landing_page_path` and falls back to
`last_page_path`. Surfacing the choice as a first-class column lets
PR#11d's table observer (and any future audit) confirm provenance
without inferring it.

This field is provenance, not customer output. It is not a POI key,
not a POI context, not a downstream-consumable signal. If Codex
prefers to keep this field out of v0.1 and instead lift the value
into `source_versions` JSONB, that is acceptable — see OD-11 below.

### §4.5 Forward compatibility — `source_versions` JSONB (OD-9)

`source_versions JSONB NOT NULL DEFAULT '{}'` carries the
forward-compat versions map. PR#11c v0.1 writes:

```json
{
  "session_features":  "<row's extraction_version>",
  "stage0_decisions":  "<row's stage0_version OR omitted>",
  "poi_input_version": "poi-core-input-v0.1"
}
```

When SBF becomes a primary POI source in a future PR (after the SBF
schema gains a path/cta/form/offer/referrer surface), the worker adds
`"session_behavioural_features_v0_2": "<feature_version>"` to the
same map. No schema change required.

Reason for keeping `behavioural_feature_version` out of the v0.1
column list: dedicated SBF-specific columns imply SBF participation
in PR#11c v0.1, which contradicts the PR#11b Hetzner proof (SBF
produced 0 envelopes). Embedding SBF semantics in v0.1 columns would
either lock the wrong shape or leave a perpetually-null column. JSONB
forward-compat keeps the schema clean.

### §4.6 Role grants (OD-7)

Grants are planned, not specified as SQL here. Exact SQL lands in
PR#11c implementation:

| Role | Grants on `poi_observations_v0_1` |
| --- | --- |
| `buyerrecon_scoring_worker` | SELECT + INSERT + UPDATE (no DELETE). Used by the manual-CLI worker. |
| `buyerrecon_internal_readonly` | SELECT only. Used by the PR#11d table observer and ad-hoc engineering reads. |
| `buyerrecon_customer_api` | **No access** in v0.1. Customer-API exposure requires explicit Helen sign-off later. |
| Migration applier | Owns DDL (CREATE TABLE / CREATE INDEX). |

---

## §5 Worker design — `poi-core-worker` (manual CLI)

PR#11c v0.1 ships **one** worker. Manual CLI batch trigger only.
**No cron, no queue, no post-commit hook, no scheduler.** Per
PR#11a OD-6, scheduler operationalisation is deferred to a future PR
after PR#11d Hetzner proof PASS.

### §5.1 Proposed file layout (PR#11c impl scope, not PR#11c planning)

```
migrations/014_poi_observations_v0_1.sql                          ← additive migration
src/db/schema.sql                                                  ← mirror block (additive)
src/scoring/poi-core-worker/
  types.ts                                                         ← worker-local types
  query.ts                                                         ← read-only SELECTs (SF + Stage 0 lineage)
  upsert.ts                                                        ← INSERT … ON CONFLICT DO UPDATE builder
  worker.ts                                                        ← runWorker(opts): Promise<WorkerReport>
  index.ts                                                         ← module entry
scripts/run-poi-core-worker.ts                                     ← manual CLI batch trigger
docs/sql/verification/14_poi_observations_v0_1_invariants.sql      ← verification SQL (OD-10)
tests/v1/poi-core-worker.test.ts                                   ← targeted tests
docs/sprint2-pr11c-poi-observations-table-worker.md                ← impl report
```

### §5.2 Source reads (OD-5 — corrected)

Primary read:

- **`session_features`** — full row, identical column set to PR#11b's
  `SELECT_SESSION_FEATURES_SQL`.

Side-read:

- **`stage0_decisions`** — by `(workspace_id, site_id, session_id)`
  lineage lookup with `LIMIT 2`. Identical to PR#11b's
  `SELECT_STAGE0_BY_LINEAGE_SQL`.

Forbidden reads (mirrors PR#11b allowlist exactly):

- ❌ `session_behavioural_features_v0_2` — **NOT a PR#11c v0.1
  persistence source.** PR#11b proved SBF has no POI material. The
  worker MUST NOT issue a SELECT against SBF in v0.1. A future PR may
  add SBF as a primary source once the SBF schema gains a
  surface-centric column — that requires explicit contract amendment.
- ❌ `accepted_events` / `accepted_events.raw_payload` /
  `accepted_events.canonical_jsonb`
- ❌ `rejected_events`
- ❌ `ingest_requests`
- ❌ `risk_observations_v0_1` (PR#9a OD-5: POI stays independent from
  Risk)
- ❌ `scoring_output_lane_a` / `scoring_output_lane_b`
- ❌ `site_write_tokens`

### §5.3 Pipeline (per row)

```
session_features row
  → triage identity (workspace_id / site_id / session_id present)
  → Stage 0 side-read by lineage (0 / 1 / 2+ → use / absent / invalid)
  → pickPagePathCandidate(landing → last fallback)
      └─ NULL → reject (do not insert; counts as NO_PAGE_PATH_CANDIDATE
                in worker report, NOT a DB write)
  → build BuildPoiCoreInputArgs (re-use PR#11b mapper verbatim where
    possible; the worker's mapper module imports the PR#11b mapper's
    pure helpers — see OD-2.1 below)
  → buildPoiCoreInput(...)  [PR#10 adapter — throws on validation]
      └─ throw → reject (do not insert; classified by the same
                  classifyAdapterError taxonomy)
  → assemble upsert parameters from the envelope + the chosen
    poi_key_source_field
  → INSERT INTO poi_observations_v0_1 ... ON CONFLICT
    (workspace_id, site_id, session_id, poi_type, poi_key,
     poi_input_version, poi_observation_version, extraction_version)
    DO UPDATE SET
      poi_surface_class       = EXCLUDED.poi_surface_class,
      evidence_refs           = EXCLUDED.evidence_refs,
      source_row_id           = EXCLUDED.source_row_id,
      source_event_count      = EXCLUDED.source_event_count,
      poi_key_source_field    = EXCLUDED.poi_key_source_field,
      source_versions         = EXCLUDED.source_versions,
      stage0_excluded         = EXCLUDED.stage0_excluded,
      poi_eligible            = EXCLUDED.poi_eligible,
      stage0_rule_id          = EXCLUDED.stage0_rule_id,
      first_seen_at           = EXCLUDED.first_seen_at,
      last_seen_at            = EXCLUDED.last_seen_at,
      derived_at              = EXCLUDED.derived_at,
      updated_at              = NOW()
    WHERE poi_observations_v0_1.poi_observation_version
        = EXCLUDED.poi_observation_version  -- belt-and-braces
```

The worker is idempotent: re-running over the same SF window yields
the same row count (rows already present hit `ON CONFLICT DO UPDATE`
with identical values).

### §5.4 Worker report (stdout JSON)

Mirrors PR#11b observer report shape with worker-specific deltas:

```
WorkerReport = {
  rows_scanned: number,
  rows_inserted: number,
  rows_updated: number,
  rows_unchanged: number,            // upsert hit but identical values
  rejects: number,
  reject_reasons: Record<RejectReason, number>,
  poi_type_distribution: { page_path: number },
  poi_surface_class_distribution: Record<PoiSurfaceClass, number>,  // mostly 0 in v0.1
  source_table_distribution: { session_features: number, ... },
  stage0_excluded_count: number,
  eligible_for_poi_count: number,
  unsafe_poi_key_reject_count: number,
  evidence_ref_reject_count: number,
  unique_session_ids_seen: number,
  sample_session_id_prefixes: string[],   // masked
  run_metadata: { ... same shape as PR#11b ... }
}
```

The worker prints the report to stdout. No customer-facing output.

### §5.5 Stage 0 excluded handling (OD-8)

Stage-0-excluded SF rows are **stored**, not filtered. The worker
writes them with `stage0_excluded=TRUE, poi_eligible=FALSE`. This
preserves audit lineage and matches the PR#11a §5.1 carry-through
rule.

**`poi_eligible` is the pure boolean inverse of `stage0_excluded`.**
The worker derives it as `poi_eligible = (NOT stage0_excluded)` and
nothing else. No other PR#11c worker rule may set
`poi_eligible=false`. `poi_eligible` is eligibility carry-through,
not a downstream judgement, not a score, not a Trust/Policy
decision, not a customer-facing claim, not a Product-Context-Fit
input. The DB CHECK constraint
`poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`
enforces this at the storage layer; the worker upsert builder must
match.

**`stage0_rule_id` is provenance-only.** It is persisted for audit
lineage so PR#11d's table observer can confirm WHY a session was
Stage-0-excluded. It MUST NOT become any of:

- a POI key (PR#11a §6 forbids Stage 0 fields from becoming POI keys)
- a POI context (PR#10 `PoiContext` is UTM-only; Stage 0 is not
  context)
- a scoring reason / `reason_code` entry
- a customer-facing reason code, label, or rendered text
- a Policy / Trust reason or decision input
- a downstream judgement signal of any kind
- a Product-Context-Fit input or weight
- a report language string (the PR#11d table observer report MAY
  surface counts by `stage0_rule_id` for engineering diagnostics, but
  the value itself never lands in a customer-facing surface)

The column exists solely to explain Stage 0 eligibility provenance
back to engineering audits. If a future PR wants to use
`stage0_rule_id` for any judgement-shaped purpose, it is a separate
PR with its own Helen sign-off — not a quiet promotion.

PR#11b's staging proof had 6 of 8 SF envelopes Stage-0-excluded.
PR#11c v0.1 would persist all 8 — the same 6 rows would land with
`stage0_excluded=TRUE` flags + `poi_eligible=FALSE`, the SF row's
Stage 0 `rule_id` carried verbatim. The PR#11d table observer
surfaces this distribution back to the operator.

### §5.6 Lane A / Lane B parity (locked invariant)

The worker writes to **`poi_observations_v0_1` only**. Specifically
forbidden:

- ❌ `INSERT/UPDATE/DELETE` on `scoring_output_lane_a`
- ❌ `INSERT/UPDATE/DELETE` on `scoring_output_lane_b`
- ❌ Any `INSERT/UPDATE/DELETE` on any table other than
  `poi_observations_v0_1`

PR#11c runtime proof (§7) REQUIRES PRE/POST counts on Lane A/B to
remain `0 / 0`. The PR#11b Hetzner proof already established this
baseline; PR#11c must not regress it.

### §5.7 No envelope persistence outside the table

The worker is the ONLY caller that persists `PoiCoreInput`-derived
state. PR#11b observer continues to discard envelopes (no
persistence). There is no shadow table, no in-memory cache, no
sidecar file.

---

## §6 Migration plan — `014_poi_observations_v0_1.sql`

| Item | Decision |
| --- | --- |
| Migration number | **014** (OD-1). Next free after `013_risk_observations_v0_1.sql`. |
| Migration shape | **Additive only.** `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` + CHECK / UNIQUE constraints. No `ALTER` on existing tables. No `DROP`. No `CASCADE`. |
| Idempotency | `IF NOT EXISTS` on the table + every index. Re-applying the migration is a no-op. |
| Rollback story | Not in v0.1. Per PR#5/PR#6/PR#12 precedent, migrations are forward-only; rollback is a fresh additive migration if needed. |
| `schema.sql` mirror | PR#11c impl mirrors the table block into `src/db/schema.sql` at the bottom of the existing chain (after `risk_observations_v0_1`). The mirror is informational; production applies migrations, not `schema.sql`. |
| Test order | Local migration apply (against ephemeral DB if available) + tests + verification SQL — before Hetzner staging migration. |
| Hetzner staging migration | Deferred to PR#11d Hetzner staging proof. PR#11c impl may attach a staging migration apply transcript to its impl report if convenient. |
| Render production migration | **Not in PR#11c.** A0 P-4 still blocks Render. |

---

## §7 Runtime proof plan

PR#11c implementation runtime proof — local + targeted:

| Gate | Requirement |
| --- | --- |
| Branch synced to PR#11c HEAD | YES |
| `git status --short` clean | YES |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| Targeted PR#11c test file | PASS |
| Full suite | PASS — must remain ≥ 2452 tests (current PR#11b baseline) |
| `git diff --check` | PASS |
| Local migration apply (against ephemeral DB) | exit 0; re-apply is a no-op (idempotency) |
| Worker dry-run against ephemeral DB seed | exit 0; expected `rows_inserted` matches seeded SF row count; `rows_updated = 0` on first run |
| Worker re-run against same seed | exit 0; `rows_unchanged = N`, `rows_inserted = 0`, `rows_updated = 0` (or `rows_updated = N` if `updated_at = NOW()` policy fires — see OD-6.1) |
| Lane A/B parity | `scoring_output_lane_a` / `_b` row counts equal before and after worker run |
| Source-table parity | `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1` row counts equal before and after worker run |
| No forbidden columns | `information_schema.columns` sweep returns 0 rows for the §4.2 exclusion list |
| Verification SQL | All invariants in `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` PASS |
| No secrets in stdout | DSN masked, full session_id masked, no token / pepper / UA / IP / raw payload |

The full **Hetzner staging proof** is reserved for **PR#11d**, which
adds the read-only table observer. PR#11c impl ships green on local
gates only — Hetzner staging migration is the gate PR#11d closes.

---

## §8 Test plan (planned for PR#11c impl, not PR#11c planning)

### §8.1 Pure tests (`tests/v1/poi-core-worker.test.ts`)

- Upsert builder given a `PoiCoreInput` envelope → produces the
  expected `INSERT … ON CONFLICT … DO UPDATE` statement and
  parameter array.
- Idempotency: two builds over the same envelope produce identical
  parameters.
- Natural-key extraction matches the §4.3 tuple exactly.
- Forbidden-key recursive sweep on `evidence_refs` rejects nested
  forbidden keys (re-uses PR#10 adapter; verifies the worker does
  NOT bypass that check).
- `poi_surface_class` enum validated against PR#10
  `POI_SURFACE_CLASSES_ALLOWED`.
- `source_table` value rejected if not `'session_features'` (v0.1).
- `poi_type` value rejected if not `'page_path'` (v0.1).
- `poi_key_source_field` value rejected if not in
  `('landing_page_path', 'last_page_path')`.
- `stage0_excluded=true` envelope → upsert parameters carry
  `poi_eligible=false`.
- Stage 0 absent envelope → upsert parameters carry
  `stage0_excluded=false, poi_eligible=true, stage0_rule_id=null`.
- Static-source sweep: no `INSERT INTO` / `UPDATE` / `DELETE` against
  any table other than `poi_observations_v0_1`.
- Static-source sweep: no read of forbidden source tables (§5.2).

### §8.2 DB tests (against ephemeral DB)

- Migration applies idempotently — re-apply is a no-op.
- Additive only: no `ALTER` on existing tables, no `DROP`, no
  `CASCADE`.
- Natural-key uniqueness: second INSERT at the same tuple → ON
  CONFLICT DO UPDATE (no duplicate row).
- Idempotent worker run: re-running over the same seed yields the
  same row count.
- `evidence_refs` integrity: every persisted row's entries resolve
  to extant `session_features` / `stage0_decisions` rows (via
  `evidence_refs[].source_row_id` join).
- Forbidden columns sweep on `information_schema.columns`: zero
  rows for the §4.2 exclusion list.
- Timestamp ordering: `first_seen_at <= last_seen_at`,
  `created_at <= updated_at`.
- No raw URL query strings: defensive `?` sweep on `poi_key`.
- Source-table parity: pre/post counts equal on every read source.
- Lane A/B counts unchanged (operator-side).
- Role privileges: `buyerrecon_customer_api` zero SELECT;
  `buyerrecon_scoring_worker` SELECT + INSERT + UPDATE only;
  `buyerrecon_internal_readonly` SELECT only.
- `poi_type` CHECK rejects non-`page_path` values.
- `source_table` CHECK rejects non-`session_features` values.
- `record_only` CHECK enforces `IS TRUE`.

### §8.3 Verification SQL (`docs/sql/verification/14_poi_observations_v0_1_invariants.sql`)

Operator-side SQL the PR#11d table observer (and ad-hoc engineering
reads) can run to confirm table health. Planned contents:

- Row count by `(workspace_id, site_id, stage0_excluded)`
- POI key length distribution (defensive — flag very long keys)
- `evidence_refs` empty-array count (should be 0)
- `poi_surface_class` distribution
- `poi_key_source_field` distribution
- Timestamp ordering check
- Natural-key duplicate check (should always be 0)
- Forbidden-column sweep on `information_schema.columns`
- Lane A/B count parity (sanity check from the same verification file)

PR#11c planning does NOT create this SQL file. PR#11c impl creates
it under `docs/sql/verification/`.

---

## §9 Codex review checklist

Before PR#11c implementation starts, Codex must answer **YES** to all
of the following questions about THIS PR#11c planning doc:

| # | Question | Expected |
| --- | --- | --- |
| 1 | Is PR#11c planning **docs-only** (one new file under `docs/`)? | YES |
| 2 | Does it position `poi_observations_v0_1` as the persistence backing of the PR#10 contract + PR#11b observer (not a customer-facing surface)? | YES |
| 3 | Does PR#11c v0.1 persist **only** successful `page_path` POI observations derived from `session_features`? | YES |
| 4 | Does PR#11c v0.1 explicitly **NOT** persist SBF rows (matches PR#11b Hetzner finding)? | YES |
| 5 | Does the natural key include `extraction_version` (OD-3) and exclude `source_row_id`? | YES |
| 6 | Does the column shape exclude every column in §4.2 (no score / verdict / policy / trust / Lane / identity / raw URL / UA / IP / token / pepper)? | YES |
| 7 | Is `behavioural_feature_version` kept out of first-class columns and folded into `source_versions` JSONB (OD-9)? | YES |
| 8 | Does the worker trigger via **manual CLI batch only** (no cron / no queue / no post-commit hook)? | YES |
| 9 | Does the worker write to **`poi_observations_v0_1` only** and reaffirm Lane A/B remain `0 / 0`? | YES |
| 10 | Does PR#11c preserve the **PR#11a / PR#11b privacy posture** (surface-centric only, allowlisted evidence_refs, recursive forbidden-key sweep, session_id masking, DSN masking)? | YES |
| 11 | Does PR#11c **avoid Render production** (A0 P-4 still blocking)? | YES |
| 12 | Does PR#11c **avoid customer-facing output** (no dashboards, no rendered text, no scoring labels)? | YES |
| 13 | Does PR#11c preserve **evidence lineage** to derived layers (SF + Stage 0 only) and forbid raw-ledger bypass? | YES |
| 14 | Does PR#11c propose explicit versioning (`poi-observation-v0.1`) so a future bump is reviewable? | YES |
| 15 | Does PR#11c sequence Hetzner staging proof to **PR#11d** rather than PR#11c impl? | YES |
| 16 | Does PR#11c list **open decisions** for Helen so the impl PR has unambiguous gates? | YES |
| 17 | Are downstream consumers (Series / Trust / Policy / Product-Context-Fit) **NOT** allowed to depend on `poi_observations_v0_1` until PR#11d PASS? | YES |

Codex BLOCKED if any answer is NO. PR#11c planning commit proceeds
only on unanimous YES.

---

## §10 Hard exclusions

PR#11c planning AND any subsequent PR#11c implementation MUST exclude:

- **Render production deployment.** A0 P-4 still blocking.
- **Customer-facing output of any kind.** Internal engineering
  diagnostics + persistence-layer reads only.
- **Lane A / Lane B writes.** `scoring_output_lane_a` /
  `scoring_output_lane_b` remain empty.
- **Policy decisions.** No Policy Pass 1 / Pass 2 / runtime decision.
- **Trust decisions.** No Trust Core invocation.
- **Final scoring.** No `RiskIndex`, no `RiskOutput`, no
  `verification_score`, no `evidence_band`, no `action_recommendation`.
- **CRM / sales / outreach automation.** No webhook out, no email,
  no Slack, no LinkedIn DM.
- **Visitor ID / person ID / company / IP-org enrichment.** POI stays
  surface-centric.
- **IP / company enrichment.** No reverse-DNS, no ASN, no Clearbit.
- **Raw full URLs with query strings.** PR#10 `normalisePagePath` is
  the only path to `poi_key`.
- **Raw `user_agent`** in any persisted column or report field. Even
  `user_agent_family` stays out.
- **Token hashes / IP hashes / peppers / auth headers** anywhere.
- **ML models.** POI normalisation stays deterministic.
- **Black-box scoring.** Every rule explicit, reviewable, unit-tested.
- **Dashboard / report renderer.** Reports are JSON for engineers.
- **Product adapter claims.** PR#11c chain is shared-core only.
- **GA4 / GTM / LinkedIn changes.** Collector stays untouched.
- **Cron / queue / post-commit hook** for the PR#11c worker. Manual
  CLI batch only in v0.1.
- **Shadow / temporary observation table.** PR#11c v0.1 has one
  durable table: `poi_observations_v0_1`.
- **SBF as a primary POI persistence source.** PR#11c v0.1 persists
  `session_features` only.
- **Risk-as-input to POI derivation.** PR#9a OD-5 holds: POI stays
  independent.
- **Downstream consumption dependency on `poi_observations_v0_1`**
  before PR#11d Hetzner proof PASS.

---

## §11 OD-* open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Migration number = **014** (next free after PR#6's `013_risk_observations_v0_1.sql`)? | **YES.** Confirmed by `ls migrations/`. |
| **OD-2** | Column shape = PR#11a §5.2 baseline refined for PR#11c v0.1 (no score / verdict / policy / trust / Lane / identity / raw URL / UA / IP / token / pepper)? | **YES — §4.1 shape exactly.** Refinements: `poi_type` and `source_table` CHECK-constrained to v0.1 values; `behavioural_feature_version` removed from first-class columns; `poi_key_source_field` added (subject to OD-11). |
| **OD-3** | Natural key = `(workspace_id, site_id, session_id, poi_type, poi_key, poi_input_version, poi_observation_version, extraction_version)` UNIQUE; `source_row_id` excluded from key? | **YES.** `extraction_version` term lets a future SF extraction-version bump cohabitate. `source_row_id` excluded so an SF re-extract upserts cleanly. `source_table` excluded because the CHECK constraint pins it to `'session_features'` in v0.1. |
| **OD-4** | Worker trigger = **manual CLI batch only** (no cron, no queue, no post-commit hook)? | **YES.** Scheduler operationalisation deferred to a future PR after PR#11d Hetzner proof PASS. Locking in a scheduler before durable observability exists is the wrong order. |
| **OD-5** | Worker source reads = `session_features` primary + `stage0_decisions` side-read only? Forbid SBF, accepted_events, rejected_events, ingest_requests, risk_observations_v0_1, Lane A/B, site_write_tokens. | **YES.** PR#11b observed SBF produced 0 envelopes — PR#11c v0.1 persists only the proven successful SF path. SBF promotion to a primary POI source requires a future PR with explicit contract amendment. |
| **OD-6** | Worker upsert = idempotent `ON CONFLICT DO UPDATE`? | **YES.** Per §5.3 SQL sketch. Re-running over the same seed yields the same row count. **OD-6.1 sub-question:** should `ON CONFLICT DO UPDATE` always set `updated_at = NOW()` (which makes the upsert nondeterministic on timestamp but idempotent on data), or compare-and-skip when EXCLUDED values match the existing row (true no-op on identical seeds)? Recommended default: **always set `updated_at = NOW()`** — simpler, matches PR#5/PR#6 pattern, and the table observer can detect "row changed semantically" via the natural-key tuple. |
| **OD-7** | Role grants — `customer_api` zero SELECT; `scoring_worker` SELECT+INSERT+UPDATE; `internal_readonly` SELECT only; migrator owns DDL? | **YES.** Exact SQL deferred to PR#11c impl. |
| **OD-8** | Stage 0 excluded rows = **stored** with `stage0_excluded=true, poi_eligible=false`, NOT filtered at write time; `poi_eligible = NOT stage0_excluded` (no other rule may set it); `stage0_rule_id` is provenance-only? | **YES.** Three clauses: (1) Excluded rows stored, not filtered — PR#11b Hetzner proof had `stage0_excluded_count=6` vs `eligible_for_poi_count=2`, that 6 is a real staging signal worth preserving for audit lineage. (2) `poi_eligible` is the pure boolean inverse of `stage0_excluded`; the DB CHECK constraint enforces it, the worker derives it identically, and no other PR#11c rule may flip it — `poi_eligible` is eligibility carry-through, not a judgement / score / Trust/Policy decision / customer claim / Product-Context-Fit input. (3) `stage0_rule_id` is provenance-only — persisted for audit lineage so PR#11d's table observer can confirm WHY a row was excluded, but never a POI key, POI context, scoring reason, customer reason code, downstream judgement, Policy/Trust reason, report language, or Product-Context-Fit input. Any future use beyond audit requires its own Helen sign-off. |
| **OD-9** | Keep `behavioural_feature_version` **out** of first-class columns (use `source_versions` JSONB instead) since PR#11c v0.1 does not persist SBF? | **YES.** Dedicated SBF-specific columns imply SBF participation in PR#11c v0.1, which contradicts the PR#11b proof. JSONB forward-compat keeps the v0.1 schema clean and lets a future SBF-persistence PR add the entry without a schema change. |
| **OD-10** | Verification SQL file name = `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`, created in PR#11c impl (not PR#11c planning)? | **YES.** Mirrors PR#6 `13_*.sql` precedent. PR#11c planning does NOT create the SQL file. |
| **OD-11** | Add `poi_key_source_field TEXT NOT NULL CHECK IN ('landing_page_path', 'last_page_path')` as a first-class provenance column? | **YES (recommended), unless Codex prefers JSONB.** Surfacing the choice as a first-class column lets PR#11d's observer (and any future audit) confirm provenance without inferring it from `evidence_refs`. Alternative: lift the value into `source_versions` JSONB under `"poi_key_source_field"`. Recommended default is **first-class column** because the choice between `landing_page_path` and `last_page_path` is a tight binary enum that benefits from an explicit CHECK constraint; JSONB would require an additional validator at write time. Helen may flip to the JSONB form if Codex raises a column-count concern. |

All 11 ODs are load-bearing — Helen signs all 11 (or substitutes
explicit alternatives) before PR#11c implementation begins.

---

## §12 Recommended next steps

1. **Codex xhigh review** of this PR#11c planning doc. Codex must
   answer YES to every question in §9.
2. **Helen written sign-off** on OD-1..OD-11. Sign-off may
   substitute explicit alternatives for any OD, but each OD must be
   resolved in writing before PR#11c impl starts.
3. **Commit PR#11c planning**
   (`docs/sprint2-pr11c-poi-observations-table-worker-planning.md`)
   to `sprint2-architecture-contracts-d4cc2bf` as a docs-only commit.
   No code change accompanies the commit. Push.
4. **Begin PR#11c implementation** on a fresh worktree from the
   post-PR#11c-planning HEAD. PR#11c impl ships:
   - `migrations/014_poi_observations_v0_1.sql`
   - `src/db/schema.sql` mirror block (additive)
   - `src/scoring/poi-core-worker/{types,query,upsert,worker,index}.ts`
   - `scripts/run-poi-core-worker.ts` (manual CLI)
   - `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`
   - `tests/v1/poi-core-worker.test.ts`
   - `docs/sprint2-pr11c-poi-observations-table-worker.md` (impl report)
   - `package.json` script entry (single new key — e.g.
     `"poi-core-worker:run"`)
5. **Begin PR#11d** only after PR#11c impl's Codex xhigh PASS.
   PR#11d ships the read-only `poi_observations_v0_1` table observer
   + Hetzner staging proof transcript that mirrors the PR#8b /
   PR#11b cadence.
6. **Architecture Gate A0 P-4 Render production block** remains in
   force across the entire chain. No PR#11c step modifies Render
   state.
7. **Downstream consumers** (Series / Trust / Policy /
   Product-Context-Fit) are **NOT** allowed to read or join
   `poi_observations_v0_1` until PR#11d Hetzner proof PASS. The
   table is "engineering-internal" between PR#11c impl and PR#11d
   PASS; any consumer that crosses that line must wait for the gate.

---

## §13 What this planning doc does NOT do

- Does **not** implement the worker, table, or verification SQL.
- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json` / lockfile.
- Does **not** touch the DB or run `psql`.
- Does **not** touch Render.
- Does **not** touch the collector (`src/collector/v1/**`).
- Does **not** modify `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#6 / PR#7 / PR#8 / PR#9a / PR#10 / PR#11a /
  PR#11b code.
- Does **not** modify any migration in `migrations/`.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`,
  `scoring/forbidden_codes.yml`.
- Does **not** create the table.
- Does **not** create the worker.
- Does **not** create the observer (that is PR#11d).
- Does **not** create the verification SQL file.
- Does **not** create customer-facing output.
- Does **not** commit. Does **not** push.

---

## §14 Implementation gate

PR#11c implementation may begin only after **all** of the following
hold:

1. Helen written sign-off on this PR#11c planning doc (OD-1..OD-11).
2. Codex xhigh review of this PR#11c planning doc → PASS.
3. PR#11b commit `1a3b252` (or later) remains stable and
   Hetzner-proven.
4. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.
5. AMS shared-core priority order (Risk → POI → Series → Trust →
   Policy) remains the operative architecture rule. No product-
   adapter PR overtakes this sequence without explicit Helen
   amendment.
6. PR#9a OD-5 holds — POI stays independent from Risk;
   `risk_observations_v0_1` is not a POI derivation input.
7. PR#11a OD-2 holds — `session_features` +
   `session_behavioural_features_v0_2` are the primary POI sources,
   with `stage0_decisions` as side-read; the PR#11c v0.1 refinement
   narrows primary sources to `session_features` only (per OD-5
   above) without contradicting PR#11a.
8. PR#11a OD-9 holds — Stage 0 carry-through preserved.
9. PR#11b Hetzner staging proof at `1a3b252` remains the upstream
   gate evidence.

After all nine hold, PR#11c implementation may begin on a new branch
from `sprint2-architecture-contracts-d4cc2bf` HEAD (or its
successor).
