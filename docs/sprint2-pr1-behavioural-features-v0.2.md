# Sprint 2 PR#1 — `session_behavioural_features_v0_2` factual extractor

| Field | Value |
|---|---|
| Status | **Implementation PR — docs/config + new derived layer.** Local + Hetzner staging only. No Render production work. |
| Date | 2026-05-11 |
| Owner | Helen Chen, Keigen Technologies (UK) Limited |
| Planning authority | `docs/sprint2-pr1-behavioural-features-v0.2-planning.md` (Helen-approved) |
| Architecture authority | `docs/architecture/ARCHITECTURE_GATE_A0.md` (commit `a87eb05`) |
| Contract authority | `docs/contracts/signal-truth-v0.1.md` (PR#0 commit `d4cc2bf`) |
| Approved decisions | D-1 `session_behavioural_features_v0_2`, D-2 `behavioural-features-v0.2`, D-3 PR#1 does NOT absorb PR#2 refresh-loop, D-4 SDK refresh-loop ignored as truth, D-5 scroll-depth nullable/not_extractable, D-6 UA-taxonomy deferred, D-7 interaction_density_bucket included, D-8 pure + opt-in DB tests required |

> **Hard rule.** PR#1 is a downstream factual extraction layer. No collector write-path changes. No scoring. No reason-code emission. No Lane A / Lane B output. No Stage 0 / Stage 1 worker. No customer-facing output. No Render production work. No live SDK rollout.

## §1 Scope

This PR adds the second downstream derived-factual layer beyond `session_features` (PR#11). It reads `accepted_events` and writes one row per `(workspace_id, site_id, session_id, feature_version)` to `session_behavioural_features_v0_2`. The table is a **factual bridge** for future Sprint 2 PRs (PR#5 Stage 0 worker, PR#6 Stage 1 worker) — it is **not** a scorer itself.

**Files in this PR (8 total):**

| Status | Path |
|---|---|
| new | `migrations/009_session_behavioural_features_v0_2.sql` |
| modified (append-only) | `src/db/schema.sql` |
| new | `scripts/extract-behavioural-features.ts` |
| new | `tests/v1/behavioural-features-extraction.test.ts` (pure tests) |
| new | `tests/v1/db/behavioural-features.dbtest.ts` (opt-in DB tests) |
| new | `docs/sql/verification/08_behavioural_features_invariants.sql` |
| new | `docs/sprint2-pr1-behavioural-features-v0.2.md` (this file) |
| modified (one line) | `package.json` (`"extract:behavioural-features"` script entry) |

## §2 Hard non-scoring boundary

PR#1 is enforceable-not-aspirational on these:

- ❌ No `risk_score`, `score`, `classification`, `recommended_action`, `confidence_band`, `is_bot`, `is_agent`, `ai_agent`, `is_human`, `buyer`, `intent`, `lead_quality`, `crm`, `company_enrich`, `ip_enrich`, `reason_code` columns or values.
- ❌ No emitted `A_*` / `B_*` / `REVIEW_*` / `OBS_*` reason codes.
- ❌ No Lane A / Lane B output (those tables don't exist yet; arrive in PR#3).
- ❌ No Stage 0 / Stage 1 worker (PR#5 / PR#6).
- ❌ No customer-facing surface.
- ❌ No refresh-loop column (deferred to Sprint 2 PR#2 per Helen-approved D-3).
- ❌ No SDK-emitted refresh-loop boolean trusted as truth (D-4).
- ❌ No UA-derived crawler / AI-agent taxonomy (D-6 deferred).

**Enforced by:**

- Pure-test forbidden-term sweep (`tests/v1/behavioural-features-extraction.test.ts`) against the migration SQL + extractor source.
- Pure-test load of `scoring/forbidden_codes.yml` via the post-CF-2 `.patterns` shape — scopes `hard_blocked_code_patterns.patterns` to emitted reason codes only (so the schema field `verification_method_strength` is allowed), and applies `string_patterns_blocked_in_code.patterns` to source-code strings.
- DB test asserting `information_schema.columns` returns zero rows for any column matching `(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed)`.
- DB test asserting no `refresh_loop%` column exists.

## §3 Table schema

See `migrations/009_session_behavioural_features_v0_2.sql` and the corresponding block appended to `src/db/schema.sql`.

**Boundary columns** (mirrors PR#11 `session_features`):

- `behavioural_features_id BIGSERIAL PRIMARY KEY`
- `workspace_id TEXT NOT NULL`, `site_id TEXT NOT NULL`, `session_id TEXT NOT NULL`
- `feature_version TEXT NOT NULL` (v0.2 default: `'behavioural-features-v0.2'`)
- `extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Session endpoint metadata** (re-derived from `accepted_events`, NOT taken from `session_features`):

- `first_seen_at TIMESTAMPTZ`, `last_seen_at TIMESTAMPTZ`
- `source_event_count INT NOT NULL DEFAULT 0`
- `source_event_id_min BIGINT`, `source_event_id_max BIGINT`
- `first_event_id BIGINT`, `last_event_id BIGINT`

**12 Stage-1-shaped factual fields:**

| Field | Type | Derivation |
|---|---|---|
| `ms_from_consent_to_first_cta` | BIGINT | first event with `consent_state IS NOT NULL` → first `cta_click` event, delta in ms. NULL when no consent observation or no CTA or temporal-order anomaly. |
| `dwell_ms_before_first_action` | BIGINT | first `page_view` → first event in `(cta_click, form_start, form_submit)`, delta in ms. NULL when no page_view or no action or temporal-order anomaly. **"Action" is defined exactly as `event_name IN ('cta_click','form_start','form_submit')`.** |
| `first_form_start_precedes_first_cta` | BOOLEAN | TRUE iff first `form_start` exists AND (no `cta_click` OR first form_start < first cta). FALSE when no form_start. Always deterministic. |
| `form_start_count_before_first_cta` | INT NOT NULL DEFAULT 0 | Count of form_starts with received_at < first cta_click; counts all form_starts when no cta_click exists. |
| `has_form_submit_without_prior_form_start` | BOOLEAN NOT NULL DEFAULT FALSE | TRUE iff `form_submit_count_before_first_form_start > 0`. |
| `form_submit_count_before_first_form_start` | INT NOT NULL DEFAULT 0 | Count of form_submits with received_at < first form_start; counts all form_submits when no form_start exists. |
| `ms_between_pageviews_p50` | BIGINT | Median of inter-page_view deltas in ms (`PERCENTILE_CONT(0.5)`). NULL when fewer than 2 page_view events. |
| `pageview_burst_count_10s` | INT NOT NULL DEFAULT 0 | Max number of page_view events in any 10-second window starting at any page_view (`COUNT(*) OVER (RANGE BETWEEN CURRENT ROW AND INTERVAL '10 seconds' FOLLOWING)`). |
| `max_events_per_second` | INT NOT NULL DEFAULT 0 | Max events in any 1-second bucket (`date_trunc('second', received_at)`). |
| `sub_200ms_transition_count` | INT NOT NULL DEFAULT 0 | Count of inter-page_view deltas < 200ms. Explicit empirical threshold; replaces ambiguous "zero dwell" wording. |
| `interaction_density_bucket` | TEXT | Enum bucket from `cta + form_start + form_submit` count: `'0'`, `'1-2'`, `'3-5'`, `'6-10'`, `'>10'`. Factual count range; not a severity label. |
| `scroll_depth_bucket_before_first_cta` | TEXT | Enum bucket `'0'` / `'1-25'` / `'26-50'` / `'51-75'` / `'76-100'`. **Always NULL in v0.2** (SDK does not emit scroll events). Provenance map marks `not_extractable`. |

**Provenance metadata:**

- `valid_feature_count INT NOT NULL DEFAULT 0` — count of features marked `'present'` in `feature_presence_map`.
- `missing_feature_count INT NOT NULL DEFAULT 0` — count of features marked `'missing'` or `'not_extractable'`.
- `valid + missing = 12` for every v0.2 row (enforced by extraction logic; verified by invariant SQL).
- `feature_presence_map JSONB NOT NULL DEFAULT '{}'::jsonb` — `{ <field>: 'present' | 'missing' | 'not_extractable' }` for the 12 fields.
- `feature_source_map JSONB NOT NULL DEFAULT '{}'::jsonb` — `{ <field>: 'server_derived' | 'not_extractable' }`.

**Minimal non-negativity CHECK constraints** on counts only. **No CHECK constraints on bucket enums** (per Codex correction in planning §10): bucket validity is validated by invariant SQL so v0.3+ can evolve bucket boundaries without a column migration.

**Natural key:** `UNIQUE (workspace_id, site_id, session_id, feature_version)`.

**Indexes:** `(workspace_id, site_id, last_seen_at DESC)`, `(workspace_id, site_id, session_id)`, `(feature_version, extracted_at DESC)`.

## §4 Extraction semantics

Identical pattern to PR#11 `extract-session-features.ts`:

- **Source.** Read `accepted_events` directly. **Do not** depend on `session_features` (it may be stale; lacks event-level ordering needed for behavioural derivation).
- **Filters.** `event_contract_version = 'event-contract-v0.1'` AND `event_origin = 'browser'` AND `workspace_id IS NOT NULL` AND `site_id IS NOT NULL` AND `session_id IS NOT NULL` AND `session_id <> '__server__'`.
- **Candidate-window vs full-session aggregation.** SINCE_HOURS (default 168 = 7 days) selects **candidate sessions** (sessions with ≥ 1 event in the window). Aggregation pulls **all events for those candidate sessions** regardless of received_at.
- **Deterministic ordering.** `ORDER BY received_at ASC, event_id ASC` (and `DESC, DESC` for last-event endpoint resolution + window functions).
- **Idempotent upsert.** Single CTE pipeline with `INSERT INTO session_behavioural_features_v0_2 (…) … ON CONFLICT (workspace_id, site_id, session_id, feature_version) DO UPDATE SET …`. Re-runs refresh the same row; `behavioural_features_id` stays stable.

**CLI env contract** (matches PR#11):

| Env var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Never printed |
| `WORKSPACE_ID` | no | (no filter) | Optional |
| `SITE_ID` | no | (no filter) | Optional |
| `SINCE_HOURS` | no | `168` | Candidate window in hours |
| `SINCE` | no | — | ISO timestamp; overrides `SINCE_HOURS` lower bound |
| `UNTIL` | no | NOW | ISO timestamp |
| `FEATURE_VERSION` | no | `behavioural-features-v0.2` | |

## §5 Refresh-loop deferred to PR#2

Per Helen-approved D-3:

- PR#1 does **not** include a `refresh_loop` column.
- PR#1 does **not** trust any SDK-emitted refresh-loop boolean.
- Sprint 2 PR#2 adds server-side refresh-loop derivation via a follow-up additive migration.

Pure tests enforce this:

- `Refresh-loop deferred to PR#2 (D-3 default)` test group asserts no `refresh_loop` column in migration, schema.sql, or EXTRACTION_SQL.
- Extractor source contains no `refresh_loop_observed` / `refresh_loop_candidate` string.
- DB test queries `information_schema` to assert no `refresh_loop%` column exists.

## §6 Test plan

**Pure tests** (`tests/v1/behavioural-features-extraction.test.ts`, 81 tests):

- env parsing (defaults, overrides, invalid inputs)
- EXTRACTION_SQL structure (v1 filters, `__server__` exclusion, candidate-window pattern, deterministic ordering, idempotent upsert, only-target-table writes, no source-table mutation, no DDL, no token/IP/UA selection)
- forbidden-code sweep loading `scoring/forbidden_codes.yml` via `.patterns` (CF-2 shape)
- CF-2 carve-out: schema field name `verification_method_strength` is NOT blocked
- no scoring / classification / action identifiers in active code (strips comments first)
- no Track A / Core AMS / collector v1 imports
- refresh-loop deferred verification
- bucket helpers (`bucketiseInteractionDensity`, `bucketiseScrollDepth`)
- `EXPECTED_FEATURE_COUNT_V0_2 = 12` + structural match in EXTRACTION_SQL
- migration SQL structure (CREATE TABLE / UNIQUE / 3 indexes / non-CASCADE rollback / no refresh_loop column / no bucket CHECK)

**DB tests** (`tests/v1/db/behavioural-features.dbtest.ts`, 30 tests):

- page-view-only session
- cta-after-pageview (dwell + ms_from_consent_to_first_cta)
- immediate-cta session (sub-1000ms)
- form_start before cta (both with and without cta in session)
- form_submit without prior form_start (and the inverse)
- ms_between_pageviews_p50 with multiple pageviews; NULL for single pageview
- pageview_burst_count_10s
- max_events_per_second
- sub_200ms_transition_count
- interaction_density_bucket (0, 1-2, 3-5, >10)
- scroll_depth NULL + not_extractable provenance
- multi-session isolation, cross-workspace isolation, cross-site isolation
- candidate-window/full-session aggregation
- late-event rerun updates same `behavioural_features_id`
- source tables unchanged (accepted_events / rejected_events / ingest_requests / session_features)
- feature_presence_map JSONB shape (12 keys, allowed values)
- feature_source_map JSONB shape (12 keys, allowed values)
- valid + missing = 12 invariant
- no scoring columns present (information_schema query)
- idempotent rerun
- no `refresh_loop%` column (D-3 deferred)

DB tests use an isolated workspace `__test_ws_pr1_behavioural__` (distinct from PR#8 `__test_ws_pr8__`, PR#11 `__test_ws_pr11__`, and smoke `buyerrecon_smoke_ws`).

## §7 Runtime proof

**Local proof** (this PR validates):

1. `npx tsc --noEmit` — clean (exit 0).
2. `unset TEST_DATABASE_URL; npm test` — 1758/1758 (1677 pre-PR#1 + 81 new pure tests).
3. Apply migration 009: `psql "$TEST_DATABASE_URL" -f migrations/009_session_behavioural_features_v0_2.sql` (or rely on `bootstrapTestDb` which runs `src/db/schema.sql`).
4. `TEST_DATABASE_URL="…" npm run test:db:v1` — 104/104 + 1 skipped (the existing PR#8b stress test, gated behind `STRESS_PARALLEL`).
5. Run extractor against local DB: `DATABASE_URL=$TEST_DATABASE_URL WORKSPACE_ID=__test_ws_pr1_behavioural__ npm run extract:behavioural-features` — exit 0.
6. Verify invariants per `docs/sql/verification/08_behavioural_features_invariants.sql`.
7. Rerun extractor — confirm idempotency (row count + `behavioural_features_id` unchanged).
8. Confirm source tables unchanged.

**Hetzner staging proof** (Helen-operated, after Codex review):

1. `git pull` PR#1 branch on Hetzner.
2. Apply migration 009 via P-4 approved ops mechanism (operator workstation; **not from inside Render web container** per A0 P-4 still blocking).
3. Run extractor against `buyerrecon_smoke_ws` / `buyerrecon_com` with `SINCE_HOURS=720`.
4. Verify row count matches PR#11 staging proof pattern (~8 rows; matches the v1 sessions captured in Hetzner staging).
5. Run invariant SQL (file 08) with `<WORKSPACE_ID>` / `<SITE_ID>` substituted. Queries 1–9 return zero rows.
6. Rerun extractor; confirm idempotency.
7. Source tables (`accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features`) row counts unchanged.
8. `npm run observe:collector` continues to PASS (no behavioural observation extension in PR#1).

**No Render production proof.** P-4 is still blocking. PR#1 ships local + Hetzner only.

## §8 Rollback

```sql
DROP TABLE IF EXISTS session_behavioural_features_v0_2;
```

**No `CASCADE`.** PR#1 introduces no foreign keys; CASCADE would silently drop any future FK-referencing object and is unsafe.

Indexes are dropped automatically when the table is dropped.

**Code rollback:** revert the PR#1 commit. The revert removes the extractor script, tests, doc, verification SQL, schema.sql append block, package.json one-liner, and migration 009.

**No raw-evidence rollback.** `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features` are untouched.

**No collector-route rollback.** v1 collector routes are unchanged.

**No production rollback.** PR#1 never touches Render production.

## §9 Codex review checklist

- ✅ `src/collector/v1/**` untouched. `src/app.ts` / `src/server.ts` / `src/auth/**` untouched. `migrations/001 … 008` untouched. `scripts/extract-session-features.ts` / `scripts/collector-observation-report.ts` / `scripts/observation-session-features.ts` untouched. `render.yaml` / `Dockerfile` / `.env.example` untouched. `docs/contracts/**` / `scoring/**` / `docs/architecture/**` / `docs/deepresearch/**` untouched. AMS repo / Track A repo untouched.
- ✅ Migration 009 is additive only (`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`). No FK. No constraint promotion. No DML.
- ✅ `src/db/schema.sql` append-only block; pre-existing schema unchanged.
- ✅ Extractor reads `accepted_events`; writes only to `session_behavioural_features_v0_2`; mutates no other table (`UPDATE` / `DELETE FROM` / `INSERT INTO` / `TRUNCATE` / `DROP` / `ALTER` against source tables forbidden and tested).
- ✅ Extractor never selects `token_hash`, `ip_hash`, `user_agent`, peppers, bearer tokens, or authorization headers.
- ✅ Extractor never imports Track A code, AMS code, or `src/collector/v1/**`. Verified by pure tests.
- ✅ No `risk_score` / `classification` / `recommended_action` / `confidence_band` / `is_bot` / `is_agent` / `ai_agent` / `is_human` / `buyer` / `intent` / `lead_quality` / `crm` / `enrich` / `reason_code` in active code or SQL. Forbidden-term sweep loads `scoring/forbidden_codes.yml` via `.patterns` (post-CF-2 shape).
- ✅ No `A_*` / `B_*` / `REVIEW_*` / `OBS_*` reason codes emitted.
- ✅ No refresh-loop column in v0.2 (D-3 deferred to PR#2). No SDK refresh-loop boolean trusted.
- ✅ No hard CHECK constraints on bucket enums (`interaction_density_bucket`, `scroll_depth_bucket_before_first_cta`) — validated by invariant SQL.
- ✅ Rollback uses `DROP TABLE IF EXISTS …` — no `CASCADE`.
- ✅ `npx tsc --noEmit` clean.
- ✅ `unset TEST_DATABASE_URL; npm test` passes 1758/1758.
- ✅ `TEST_DATABASE_URL=… npm run test:db:v1` passes 104/104 (+1 skipped stress test).
- ✅ Local extractor smoke runs against test DB; idempotent rerun; source tables unchanged.
- ✅ Verification SQL is read-only; uses `to_regclass` presence guard so the file is safe to run pre-migration.
- ✅ No commit, no push, no deploy, no live SDK rollout.
