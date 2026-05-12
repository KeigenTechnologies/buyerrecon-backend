# Sprint 2 PR#2 — Server-side refresh-loop / repeated-pageview derivation

Track B (BuyerRecon Evidence Foundation). Factual bridge for future
scoring; **NOT** a scorer. Follow-on to Sprint 2 PR#1
(`session_behavioural_features_v0_2`).

This PR adds 8 additive columns and one factual SQL pipeline. It does not
launch in production. It does not touch the v1 collector. It does not
trust SDK refresh-loop hints. It does not compute, store, or emit any
score, classification, recommendation, confidence band, agent label,
buyer-intent label, lead-quality label, or reason code.

Authority:

- `docs/architecture/ARCHITECTURE_GATE_A0.md` (§K Sprint 2 PR#2)
- `docs/contracts/signal-truth-v0.1.md`
- `docs/sprint2-pr2-refresh-loop-server-derivation-planning.md` (Helen-approved D-1..D-7; Codex PASS)
- `scoring/forbidden_codes.yml` (CF-2 scope: `applies_to: emitted_reason_codes_only` for hard_blocked_code_patterns)

## 1. What this PR does

Adds a deterministic server-side derivation of refresh-loop / repeated
page-view facts to the existing PR#1 behavioural feature layer:

- 8 additive columns on `session_behavioural_features_v0_2`.
- Server-side CTE pipeline inside the existing extractor SQL.
- New verification SQL `docs/sql/verification/09_refresh_loop_invariants.sql`.
- `DEFAULT_FEATURE_VERSION` bumped to `behavioural-features-v0.3`.
- `feature_presence_map` / `feature_source_map` gain a 13th key
  (`refresh_loop_candidate`) for v0.3 rows. v0.2 rows continue to carry
  12-key maps.
- Pure tests for SQL structure, threshold constants, contract scope,
  forbidden-term sweep.
- DB tests for N / W / K boundaries, alternating paths, two streaks,
  pooled-median, SDK-hint-ignored, candidate-window/full-session,
  late-event rerun, v0.2 backward-compat, source-tables-unchanged.

## 2. Decisions implemented (D-1..D-7)

| ID  | Decision                                                                                 | Source                                                                  |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| D-1 | Additive columns on `session_behavioural_features_v0_2` (no new table).                  | Helen-approved planning §D-1.                                           |
| D-2 | Column name is `refresh_loop_candidate` (factual). NOT `refresh_loop_observed`.          | Helen-approved D-2 — judgement-implying names are forbidden.            |
| D-3 | Thresholds N=3, W=10000 ms, K=1.                                                         | Helen-approved D-3. Extraction thresholds, NOT scoring thresholds.      |
| D-4 | SDK refresh-loop hints are IGNORED (Option α). No comparison, no `sdk_hint_*` field.     | Helen-approved D-4. Replay-attack defence.                              |
| D-5 | Modify existing `scripts/extract-behavioural-features.ts` (no new script).               | Helen-approved D-5.                                                     |
| D-6 | New verification SQL `docs/sql/verification/09_refresh_loop_invariants.sql`.             | Helen-approved D-6.                                                     |
| D-7 | `DEFAULT_FEATURE_VERSION = 'behavioural-features-v0.3'`; `EXPECTED_FEATURE_COUNT_V0_3 = 13`. | Helen-approved D-7.                                                     |

## 3. Files changed / added

| File                                                                  | Type     | Notes                                                                                   |
| --------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `migrations/010_session_behavioural_features_v0_2_refresh_loop.sql`   | new      | 8 additive `ADD COLUMN IF NOT EXISTS` + 3 idempotent `DO $$ … END $$` CHECK constraints. |
| `src/db/schema.sql`                                                   | modified | Mirrors the 8 new columns + 3 CHECKs inside the existing `session_behavioural_features_v0_2` block. |
| `scripts/extract-behavioural-features.ts`                             | modified | Header banner; bumped `DEFAULT_FEATURE_VERSION`; added `EXPECTED_FEATURE_COUNT_V0_3 = 13`; added `REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS / _MAX_SPAN_MS / _MAX_ACTIONS_BETWEEN`; extended `EXTRACTION_SQL` CTE pipeline; updated INSERT + DO UPDATE; v0.2/v0.3 map shape branched on `$5`; `runExtraction` passes `$6/$7/$8`. |
| `tests/v1/db/_setup.ts`                                               | modified | Bootstrap now applies migration 010 (idempotent). New `applyMigration010()` helper.     |
| `tests/v1/behavioural-features-extraction.test.ts`                    | rewritten | Pure tests for v0.3 / refresh-loop contract; comment-stripped forbidden-term sweeps; map-key index-based slicing. |
| `tests/v1/db/behavioural-features.dbtest.ts`                          | extended | PR#1 tests now expect 13-key maps (v0.3 default); new sections 22-33 cover PR#2.        |
| `docs/sql/verification/09_refresh_loop_invariants.sql`                | new      | 11 read-only SELECTs + 2 presence guards. NO unsafe `same_path_repeat_count >= refresh_loop_count` invariant. |
| `docs/sprint2-pr2-refresh-loop-server-derivation.md`                  | new (this file) | Implementation summary.                                                          |

## 4. New columns (8 additive)

| Column                              | Type     | Default | Note                                                                          |
| ----------------------------------- | -------- | ------- | ----------------------------------------------------------------------------- |
| `refresh_loop_candidate`            | BOOLEAN  | NULL    | `(COALESCE(refresh_loop_count, 0) > 0)`. Server-derived. Factual; never a judgement. |
| `refresh_loop_count`                | INT      | 0       | Number of candidate streaks in the session.                                   |
| `same_path_repeat_count`            | INT      | 0       | `MAX(run_length)` over all same-path runs in the session.                     |
| `same_path_repeat_max_span_ms`      | BIGINT   | NULL    | `MAX(run_span_ms)` over all same-path runs.                                   |
| `same_path_repeat_min_delta_ms`     | BIGINT   | NULL    | `MIN(min adjacent same-path delta)` over all same-path runs.                  |
| `same_path_repeat_median_delta_ms`  | BIGINT   | NULL    | Median of ALL adjacent same-path deltas pooled per session. NOT a median of per-run medians. |
| `repeat_pageview_candidate_count`   | INT      | 0       | Sum of page-view counts across candidate streaks only.                        |
| `refresh_loop_source`               | TEXT     | NULL    | Provenance. PR#2 always writes `'server_derived'` (D-4 Option α).             |

Total post-migration column count: 29 (PR#1) + 8 (PR#2) = **37**.

CHECK constraints (3, all wrapped in DO blocks for idempotency):

- `sbf_v0_2_refresh_loop_count_nonneg`
- `sbf_v0_2_same_path_repeat_count_nonneg`
- `sbf_v0_2_repeat_pageview_candidate_count_nonneg`

No FK references on any new column. No new index — existing PR#1 indexes
on `(workspace_id, site_id)`, `session_id`, `feature_version` cover all
anticipated query patterns.

## 5. Algorithm (factual, server-side, locked)

Input: `accepted_events` only, filtered to `event_contract_version =
'event-contract-v0.1'`, `event_origin = 'browser'`, `session_id <>
'__server__'`, non-null tenancy fields.

Deterministic ordering: `(received_at ASC, event_id ASC)`.

1. **`page_view_seq`** — All page_view events per session with
   `LAG(received_at)` and `LAG(page_path)` over the window.
2. **`pv_with_actions`** — For each page_view (after the session's
   first), count the action events (`cta_click | form_start |
   form_submit`) whose `received_at ∈ [prev_pv_received_at, current.received_at)`.
3. **`run_breaks`** — A page_view starts a new same-path run iff it is
   the session's first PV OR its `page_path` differs from the previous PV's
   `page_path`. **K is NOT a run-break** — it is a per-run candidate
   filter only.
4. **`run_assigned`** — Cumulative `SUM(is_run_break)` as the per-run
   identifier.
5. **`run_aggs`** — Per-run aggregates: `run_length`, `run_start`,
   `run_end`, `run_span_ms`, `run_min_delta_ms` (NULL for length-1
   runs), `run_max_actions_between` (NULL for length-1 runs).
6. **`candidate_streaks`** — Runs satisfying ALL three D-3 thresholds:
   `run_length >= 3 (N)`, `run_span_ms <= 10000 (W)`,
   `COALESCE(run_max_actions_between, 0) <= 1 (K)`.
7. **`same_path_deltas_pooled`** — ALL eligible adjacent same-path PV
   deltas, pooled per session, regardless of W and K.
8. **`refresh_loop_median`** — `PERCENTILE_CONT(0.5)` over the pooled
   set per session.
9. **`refresh_loop_aggs`** — Per-session aggregates:
   - `refresh_loop_count = COUNT(candidate streaks)`
   - `same_path_repeat_count = MAX(run_length)` (across all runs;
      regardless of W and K — see D-2)
   - `same_path_repeat_max_span_ms = MAX(run_span_ms)`
   - `same_path_repeat_min_delta_ms = MIN(run_min_delta_ms)`
   - `repeat_pageview_candidate_count = SUM(run_length WHERE candidate)`

All output columns are COALESCE'd to deterministic FALSE / 0 for v0.3
rows with no page_views (e.g. zero-PV sessions). `refresh_loop_source`
is always the literal `'server_derived'`.

## 6. v0.2 / v0.3 map shape

The SQL branches `feature_presence_map` and `feature_source_map` on the
`$5` (feature_version) parameter:

- `feature_version = 'behavioural-features-v0.3'` → 13-key maps
  (`refresh_loop_candidate` added with values `'present'` /
  `'server_derived'`).
- `feature_version = 'behavioural-features-v0.2'` → 12-key maps,
  identical to PR#1 baseline shape.

`valid_feature_count + missing_feature_count` is 13 for v0.3 rows and 12
for v0.2 rows. Verified by:

- `docs/sql/verification/08_behavioural_features_invariants.sql` (v0.2 = 12)
- `docs/sql/verification/09_refresh_loop_invariants.sql` (v0.3 = 13)

## 7. Extraction thresholds (constants, exported from extractor)

```ts
export const REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS = 3;
export const REFRESH_LOOP_MAX_SPAN_MS                = 10000;
export const REFRESH_LOOP_MAX_ACTIONS_BETWEEN        = 1;
```

Passed at query time as parameters `$6 / $7 / $8`. The SQL string is
static; the constants change in one place (the extractor module) and
flow through the query without rewriting SQL.

## 8. Invariants verified by SQL (09_refresh_loop_invariants.sql)

| #  | Invariant                                                                                  |
| -- | ------------------------------------------------------------------------------------------ |
| 0  | Table presence guard (`to_regclass`).                                                      |
| 1  | All 8 PR#2 columns present (`information_schema.columns`).                                 |
| 2  | v0.3 rows: `valid + missing = 13`.                                                         |
| 3  | v0.2 baseline rows still satisfy `valid + missing = 12` (regression guard).                |
| 4  | `refresh_loop_candidate IS TRUE` ⇒ `same_path_repeat_count >= 3`.                          |
| 5  | `refresh_loop_count > 0` ⇒ `repeat_pageview_candidate_count >= refresh_loop_count * 3`.    |
| 6  | `refresh_loop_candidate = (refresh_loop_count > 0)`.                                       |
| 7  | Non-negativity for the 3 BIGINT span / delta columns.                                      |
| 8  | `refresh_loop_source` enum (PR#2 only writes `'server_derived'`).                          |
| 9  | NO `refresh_loop_observed` column on the table (D-2 forbidden).                            |
| 10 | NO scoring / classification / agent columns (CF-2 / Architecture Gate A0).                 |
| 11 | Latest-20 v0.3 rows for one boundary (human inspection).                                   |

NOT included (planning correction): the unsafe invariant
`same_path_repeat_count >= refresh_loop_count`. It is NOT safe because
candidate streaks can be entirely contained within a single longer
same-path run, so the two metrics measure different things. Replaced by
the two stronger invariants (#4 and #5) that hold by construction.

## 9. Test plan

### Pure tests (`tests/v1/behavioural-features-extraction.test.ts`)

- 113 pure tests; all green.
- Covers: env parsing, v1 filters, candidate-window vs full-session,
  deterministic ordering across multiple CTEs, idempotent upsert,
  privacy/secrets, forbidden-term sweeps (`scoring/forbidden_codes.yml`
  via `.patterns`), no Track A / Core AMS / collector v1 imports,
  bucket helpers, migration 009 + 010 structural assertions, schema.sql
  PR#2 mirror, v0.2 / v0.3 map key counts, refresh-loop CTE pipeline
  structure, threshold constants exported with D-3 values, SDK-hint
  ignored, name is `refresh_loop_candidate` not `refresh_loop_observed`.

### DB tests (`tests/v1/db/behavioural-features.dbtest.ts`)

- 50 DB tests; all green against local `br_collector_test`.
- PR#1 baseline tests retained (1-21) — map count now 13.
- PR#2 tests (22-33): column presence; N / W / K boundary cases;
  alternating paths; two streaks; pooled median across asymmetric runs;
  SDK-hint-ignored (raw_overrides `refresh_loop: true`/`false`);
  candidate-window vs full-session for refresh-loop; late-event rerun
  preserves the row; source tables unchanged; v0.2 backward-compat
  still 12-key.

### Validation commands

```
npx tsc --noEmit                                # type-check
npx vitest run                                  # pure suite: 1790 tests
TEST_DATABASE_URL=postgres://localhost:5432/br_collector_test \
  npx vitest run --config vitest.db.config.ts   # DB suite: 124 tests, 1 skip
```

All three commands pass.

## 10. Hard non-scoring boundary (verified by tests and YAML)

PR#2 must not introduce — and tests sweep the active extractor / both
migrations for — any of these terms (outside comments / docs):

- `risk_score | buyer_score | intent_score | bot_score | human_score | fraud_score`
- `classification | recommended_action | confidence_band`
- `is_bot | is_agent | ai_agent | is_human`
- `lead_quality | company_enrichment | ip_enrichment`
- `reason_code` (forbidden as a column or active identifier)
- Uppercase reason-code-shaped strings matching
  `hard_blocked_code_patterns.patterns` from `scoring/forbidden_codes.yml`.

PR#2 also must not introduce `refresh_loop_observed` (D-2). The
extraction layer is FACTUAL; consumers (Sprint 2 PR#5 Stage 0, PR#6
Stage 1) may combine these facts with other evidence under separate
Helen-approved gates.

## 11. SDK hint policy (D-4 Option α) — explicit

The extractor does NOT read, trust, compare, or emit any SDK refresh-loop
hint. PR#2 derives candidate state purely from the server-observed
sequence of `accepted_events`. The DB test `PR#2 — SDK refresh-loop hint
is IGNORED (server-only derivation)` verifies that a lying SDK
(`raw_overrides.refresh_loop = true`) does not set
`refresh_loop_candidate = true` when the server algorithm sees fewer
than N=3 same-path page_views; conversely, a denying SDK
(`raw_overrides.refresh_loop = false`) does not prevent the server
algorithm from setting `refresh_loop_candidate = true` when the data
warrants. `refresh_loop_source` is always `'server_derived'`.

## 12. Rollback

Migration 010 is purely additive. Rollback (no CASCADE):

```sql
ALTER TABLE session_behavioural_features_v0_2
  DROP COLUMN IF EXISTS refresh_loop_candidate,
  DROP COLUMN IF EXISTS refresh_loop_count,
  DROP COLUMN IF EXISTS same_path_repeat_count,
  DROP COLUMN IF EXISTS same_path_repeat_max_span_ms,
  DROP COLUMN IF EXISTS same_path_repeat_min_delta_ms,
  DROP COLUMN IF EXISTS same_path_repeat_median_delta_ms,
  DROP COLUMN IF EXISTS repeat_pageview_candidate_count,
  DROP COLUMN IF EXISTS refresh_loop_source;
```

CHECK constraints drop automatically with their columns. CASCADE is not
used: v0.2 / v0.3 introduce no FK references on these columns.

Pre-PR#2 v0.2 rows in `session_behavioural_features_v0_2` are preserved
unchanged by migration 010 (additive only, NULL / 0 defaults).

## 13. Out of scope / explicitly NOT done

- **No production deploy.** Architecture Gate A0 P-4 still blocks.
- **No collector v1 changes.** The collector is untouched.
- **No scoring, no classification, no judgement.** No score / risk /
  recommendation / confidence band / agent label / buyer-intent label /
  reason code is computed, stored, or emitted.
- **No SDK trust.** SDK refresh-loop hints are ignored (D-4 Option α).
- **No new index.** PR#1 indexes cover anticipated query patterns.
- **No FK reference.** No referential dependency introduced.
- **No Track A / Core AMS coupling.** No imports from
  `ams-qa-behaviour-tests`, `keigentechnologies/AMS`, `src/app`,
  `src/server`, `src/auth`, `src/collector/v1`.
- **No CRM, IP enrichment, company enrichment.** None of these concepts
  appear in PR#2 active code.

## 13b. Codex BLOCKER fix — K-threshold tuple boundary

Codex flagged that the original `pv_with_actions` CTE counted actions
between adjacent page_views using **timestamp-only** bounds:

```
se.received_at >= pv.prev_pv_received_at
AND se.received_at <  pv.received_at
```

This contradicts the deterministic ordering used elsewhere in the
pipeline (`received_at ASC, event_id ASC`). When an action event shares
a `received_at` with a page_view, the timestamp-only predicate
mis-classified the action relative to the event_id tie-break.

**Fix** (extractor SQL only — no migration / schema / collector touched):

- `page_view_seq` now also carries `LAG(event_id) OVER w AS prev_pv_event_id`.
- `pv_with_actions` now uses the full deterministic tuple boundary:
  - lower bound: `se.received_at > prev_pv_received_at OR (se.received_at = prev_pv_received_at AND se.event_id > prev_pv_event_id)`
  - upper bound: `se.received_at < current.received_at OR (se.received_at = current.received_at AND se.event_id < current.event_id)`
- First-PV case (`prev_pv_received_at IS NULL`) is unchanged in
  behaviour: both halves short-circuit to NULL, no rows match, COUNT = 0
  via COALESCE.

**Tests added (no existing test weakened):**

- Pure SQL-shape tests in `tests/v1/behavioural-features-extraction.test.ts`:
  - `page_view_seq` selects `LAG(event_id) OVER w AS prev_pv_event_id`
  - `pv_with_actions` uses both `received_at` and `event_id` in the
    action boundary (lower AND upper)
  - The old timestamp-only predicate is not present as the sole boundary
- DB tie-case tests in `tests/v1/db/behavioural-features.dbtest.ts`
  (§25b — relies on `accepted_events.event_id` being `BIGSERIAL`, so
  sequential `seedAccepted()` calls deterministically order event_ids):
  - **A.** action BETWEEN PV1 and PV2 by event_id at the same timestamp
    → action counts; K=1 streak is a candidate.
  - **B.** action AFTER PV2 by event_id at the same timestamp → action
    does NOT count between PV1 and PV2; candidate remains TRUE.
  - **C.** two actions BETWEEN PV1 and PV2 by event_id at the same
    timestamp → K=2 > 1 → candidate FALSE; same_path_repeat_count
    remains 3 (run length unaffected, K rejects).

**Test results after fix:**

```
npx tsc --noEmit                                      → clean
npx vitest run tests/v1/behavioural-features-extraction.test.ts
                                                       → 115 / 115 passing
npx vitest run --config vitest.db.config.ts \
  tests/v1/db/behavioural-features.dbtest.ts           → 53 / 53 passing
npx vitest run --config vitest.db.config.ts            → 127 passing, 1 skipped
npx vitest run                                         → 1792 / 1792 passing
```

## 14. Next gates

- Codex review of this PR (no merge until PASS).
- After Codex PASS: PR#3 contract artefact for the factual surface that
  Stage 0 (PR#5) will consume from `session_behavioural_features_v0_2`
  v0.3 rows. Stage 0 has its own Helen-approved gate.
