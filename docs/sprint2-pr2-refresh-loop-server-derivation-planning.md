# Sprint 2 PR#2 — Server-side refresh-loop / repeated-pageview derivation (planning)

| Field | Value |
|---|---|
| Status | **PLANNING ONLY — no implementation has started, no DB / migration / production work has occurred.** |
| Date | 2026-05-11 |
| Owner | Helen Chen, Keigen Technologies (UK) Limited |
| Authority | `docs/architecture/ARCHITECTURE_GATE_A0.md` (commit `a87eb05`) + `docs/contracts/signal-truth-v0.1.md` (PR#0 `d4cc2bf`) + PR#1 contracts (commit `bea880d`) |
| Prerequisite for implementation | **Helen's written sign-off on this planning document per A0 §0.7.** |

> **Hard rule.** This document is a planning artefact. No code, migration, schema, scoring path, or contract has been created. Sprint 2 PR#2 implementation MUST NOT begin before Helen approves this document.

---

## §A Executive summary

**FACT.** A0 §K Sprint 2 PR#2 is explicitly defined as: *"Counts `accepted_events` with same `(session_id, page_path)` to derive `refresh_loop_observed` boolean; **does not trust SDK boolean**. None (extends PR#1). Pure + dbtest. No collector touch."*

**FACT.** PR#1 (commit `bea880d`) shipped `session_behavioural_features_v0_2` with **no** refresh-loop column, by Helen-approved D-3 deferral. Per the PR#1 planning doc §4: *"If Helen approves D-3 Option β, add: `refresh_loop_candidate BOOLEAN`, populated as NULL in v0.2."* — Option α (omit) was the approved default. **PR#2 is the follow-up that adds server-side refresh-loop derivation.**

**FACT.** signal-truth-v0.1 §6.5 defines `refresh_loop` as a derived feature object with fields like `consecutive_same_url_views`, `consecutive_reload_count`, `same_url_window_ms`, `reload_streak_window_ms`, `has_meaningful_interaction_before_reload`, `back_forward_count`, `spa_route_change_count`. **PR#2 adapts this to `page_path` (not URL) consistent with the Sprint 3 paths-only discipline + A0 PR#2 wording.**

**FACT.** Track A's `runtime.refresh-loop.test.js` validates the BuyerRecon website-JS emitter that fires `refresh_loop` after 4 same-path loads. Track A logic is **prototype-only** and **client-side**. PR#2 does NOT vendor Track A code; PR#2 derives independently from server-side `accepted_events`. The SDK boolean (if observed in `accepted_events.raw`) is **never trusted as source of truth** (per A0 + Codex review of PR#1 plan).

**RECOMMENDATION.** PR#2 adds **8 additive columns: 7 factual/derived fields + 1 provenance field** to `session_behavioural_features_v0_2` via migration 010, updates the extractor to populate them, and **bumps the default `FEATURE_VERSION` from `behavioural-features-v0.2` to `behavioural-features-v0.3`**. New rows under v0.3 carry the refresh-loop fields; old v0.2 rows remain unchanged. The natural key `(workspace_id, site_id, session_id, feature_version)` accommodates both versions in the same table without breaking anything.

**Arithmetic.** PR#1's `session_behavioural_features_v0_2` ships with **29 columns** (6 boundary/version/provenance + 7 endpoint metadata + 12 Stage-1-shaped factual + 4 provenance-meta). PR#2 adds 8 columns → **37 columns post-PR#2**.

**Hard non-scoring boundary** is preserved: no `refresh_loop_observed`, no severity bucket, no reason code, no Lane A/B output, no Stage 0/1 worker, no review queue, no customer-facing surface. Field name is `refresh_loop_candidate` (factual flag derived under fixed extraction thresholds), not a judgement.

**GO RECOMMENDATION:** **Go for implementation, contingent on Helen sign-off on 7 open decisions (D-1 through D-7 in §P).**

---

## §B Baseline repo state

| Check | Value |
|---|---|
| `pwd` | `/Users/admin/github/buyerrecon-backend` |
| `git branch --show-current` | `sprint2-architecture-contracts-d4cc2bf` |
| `git rev-parse HEAD` | `bea880d384e3fd8c9b79762107b7560fc7c634ae` (PR#1 implementation, Helen-approved + Hetzner staging proof PASS) |
| `git status --short` (PR#1 baseline, before this planning doc) | clean working tree at HEAD `bea880d` |
| `git status --short` (current state, with this planning doc) | one untracked file: `?? docs/sprint2-pr2-refresh-loop-server-derivation-planning.md` (this file) |
| `git log --oneline -5` | PR#1 `bea880d` → PR#1 plan `382246c` → PR#0 contracts `d4cc2bf` → A0 `a87eb05` → PR#12 `4fec39e` |
| `npx tsc --noEmit` | clean (exit 0) |
| `npm test` (TEST_DATABASE_URL unset) | **1758 / 1758 across 34 files** |

PR#1 baseline is clean. The only working-tree change introduced by this planning step is this planning document itself. Ready to plan PR#2.

---

## §C PR#1 behavioural layer facts (the layer PR#2 extends)

**Schema (migration 009 + `src/db/schema.sql` block, committed in `bea880d`).** Table `session_behavioural_features_v0_2` has **29 columns**:

- 6 boundary + version + provenance (`behavioural_features_id`, `workspace_id`, `site_id`, `session_id`, `feature_version`, `extracted_at`)
- 7 session endpoint metadata (`first_seen_at`, `last_seen_at`, `source_event_count`, `source_event_id_min`, `source_event_id_max`, `first_event_id`, `last_event_id`)
- **12 Stage-1-shaped factual fields** (none of which is refresh-loop): `ms_from_consent_to_first_cta`, `dwell_ms_before_first_action`, `first_form_start_precedes_first_cta`, `form_start_count_before_first_cta`, `has_form_submit_without_prior_form_start`, `form_submit_count_before_first_form_start`, `ms_between_pageviews_p50`, `pageview_burst_count_10s`, `max_events_per_second`, `sub_200ms_transition_count`, `interaction_density_bucket`, `scroll_depth_bucket_before_first_cta`
- 4 provenance-meta (`valid_feature_count`, `missing_feature_count`, `feature_presence_map JSONB`, `feature_source_map JSONB`)
- 8 minimal non-negativity CHECK constraints + 1 UNIQUE natural key

Column arithmetic: 6 + 7 + 12 + 4 = **29**. PR#2 adds 8 → **37** post-PR#2.

**Feature version.** Current default `behavioural-features-v0.2`. `EXPECTED_FEATURE_COUNT_V0_2 = 12`. Invariant: `valid + missing = 12` per row.

**Extractor pattern (`scripts/extract-behavioural-features.ts`, 640 lines, committed `bea880d`).**

- Exports `parseOptionsFromEnv`, `EXTRACTION_SQL`, `runExtraction`, `bucketiseInteractionDensity`, `bucketiseScrollDepth`, `DEFAULT_FEATURE_VERSION`, `DEFAULT_SINCE_HOURS`, `EXPECTED_FEATURE_COUNT_V0_2`.
- Single CTE pipeline (15 CTEs) → `INSERT … ON CONFLICT (workspace_id, site_id, session_id, feature_version) DO UPDATE SET … RETURNING`.
- Reads `accepted_events` directly. Filters: `event_contract_version='event-contract-v0.1'` + `event_origin='browser'` + boundary non-null + `session_id <> '__server__'`.
- Candidate-window (default `SINCE_HOURS=168` = 7 days) selects sessions touched in window; aggregation runs over **all events for those candidate sessions** (full-session pattern).
- Deterministic ordering: `ORDER BY received_at ASC, event_id ASC`.
- `if (invokedAsScript)` gate at the bottom — tests import without triggering CLI.

**No-refresh-loop boundary (current PR#1 state).** Pure tests assert (verified in `tests/v1/behavioural-features-extraction.test.ts`):

- migration 009 declares no `refresh_loop` column
- `src/db/schema.sql` block has no `refresh_loop` column
- `EXTRACTION_SQL` writes no `refresh_loop` column
- extractor source contains no `refresh_loop_observed` / `refresh_loop_candidate` string

DB tests (in `tests/v1/db/behavioural-features.dbtest.ts`) assert `information_schema.columns` returns 0 rows for `column_name LIKE 'refresh_loop%'`.

**feature_presence_map / feature_source_map pattern.** JSONB objects with 12 keys each (one per Stage-1-shaped field). Values:

- `feature_presence_map`: `'present'` | `'missing'` | `'not_extractable'`
- `feature_source_map`: `'server_derived'` | `'not_extractable'`

`scroll_depth_bucket_before_first_cta` is the only field whose source-map value is `'not_extractable'` in v0.2 (SDK does not emit scroll events).

**Idempotency + candidate-window/full-session pattern.** Identical to PR#11. Re-runs refresh the same row (`behavioural_features_id` stable). Late-arriving event after a previous extraction → next run updates the same row.

**Verification SQL (`docs/sql/verification/08_behavioural_features_invariants.sql`).** Read-only operator queries with `to_regclass('public.session_behavioural_features_v0_2')` presence guard. 10 queries: natural-key uniqueness, valid+missing=12, last_seen ≥ first_seen, bucket enum validity, boolean/count consistency, source_event_count matches accepted_events full-session count, JSONB shape sanity, non-negative counts/durations, no scoring columns, latest 20 rows inspection.

---

## §D A0 + signal-truth-v0.1 + PR#0 contract constraints relevant to PR#2

### D.1 A0 §K Sprint 2 PR#2 wording

A0 commit `a87eb05` line 791 in §K Sprint 2 roadmap:

> *"PR#2 — server-side refresh-loop derivation — Counts `accepted_events` with same `(session_id, page_path)` to derive `refresh_loop_observed` boolean; **does not trust SDK boolean** — none (extends PR#1) — pure + dbtest — **no** (collector untouched)."*

**Three hard A0 facts:**

1. **PR#2 is server-side.** Reads `accepted_events`. Does not modify collector. Does not need a new SDK event.
2. **PR#2 does NOT trust the SDK boolean.** Even if the website-JS emits a `refresh_loop` event into `accepted_events.raw`, PR#2 derives its result independently from the per-event timestamp+path sequence.
3. **PR#2 extends PR#1.** A0 says "none" under migrations — interpretable two ways:
   - (a) literally zero migration (use existing schema); or
   - (b) additive ALTER TABLE on `session_behavioural_features_v0_2` (the table PR#1 created).

The user's task explicitly proposes (b) with new columns. We follow that interpretation.

### D.2 signal-truth-v0.1 §6.5 — `refresh_loop` derived feature object

```yaml
refresh_loop:
  consecutive_same_url_views: integer
  consecutive_reload_count: integer
  same_url_window_ms: integer
  reload_streak_window_ms: integer
  has_meaningful_interaction_before_reload: boolean
  back_forward_count: integer
  spa_route_change_count: integer
```

**Adaptation notes for PR#2.**

- §6.5 uses `same_url_*` — A0 §K PR#2 + Sprint 3 paths-only discipline say **use `page_path` not URL.** Adopt `same_path_*`.
- `consecutive_reload_count` requires SDK `nav.type='reload'` distinction. PR#1 doesn't expose `nav.type`; PR#2 cannot reliably distinguish hard reload from SPA pushState from back/forward without that signal. **Defer the reload-vs-other-navigation split** to a future PR (Sprint 2.5 SDK extension or PR#2 follow-up). PR#2 v0.3 only counts **same-path consecutive page_views** regardless of navigation type.
- `back_forward_count` and `spa_route_change_count` similarly require SDK fields not currently in the v1 event_contract_version. Defer.
- `has_meaningful_interaction_before_reload` — translatable to "K = max action events between consecutive same-path page_views". Adopt as factual extraction threshold.

### D.3 Forbidden / hard rules

From `scoring/forbidden_codes.yml` + `signal-truth-v0.1.md` §10:

- **No reason-code emission.** PR#2 emits no `A_*`, `B_*`, `REVIEW_*`, `OBS_*` codes. PR#2 writes columns, not codes.
- **No automated action.** `action_recommendation` is restricted to `record_only` or `review` per v1 invariant. PR#2 writes no action recommendation.
- **No scoring identifiers.** No `risk_score`, `score`, `classification`, `recommended_action`, `confidence_band`, `is_bot`, `is_agent`, `ai_agent`, `is_human`, `buyer`, `intent`, `lead_quality`, `crm`, `enrich`, `verified`, `confirmed`, etc. Enforced by the existing PR#1 forbidden-term sweep (which scans both the migration SQL + extractor source against `scoring/forbidden_codes.yml.string_patterns_blocked_in_code.patterns`).
- **CF-2 carve-out.** Schema field names like `verification_method_strength` are allowed because the `hard_blocked_code_patterns.patterns` are scoped to emitted reason codes. The PR#1 test that asserts this continues to apply.

### D.4 Lane A / Lane B separation

PR#2 writes **no Lane A** and **no Lane B** output. Both tables (`scoring_output_lane_a`, `scoring_output_lane_b`) land in Sprint 2 PR#3.

### D.5 "Refresh-loop is not a reason code" wording

The user's task instructs:

> "`refresh_loop_candidate` … is a factual candidate flag derived by fixed extraction thresholds. It is **not** a risk label, **not** a bot label, and **not** a reason code."

This is the load-bearing semantic boundary. Future Sprint 2 PR#6 (Stage 1 scoring worker) may consume `refresh_loop_candidate` as one of its 8 inputs (Track A's `BEHAVIOURAL_ALLOWLIST` includes `refreshLoopObserved`). But PR#2 does not score, does not emit codes, does not gate any action. It produces a column.

---

## §E Track A refresh-loop reference (read-only — prototype, not production)

**FACT.** `/Users/admin/github/ams-qa-behaviour-tests` is a prototype repository (not a Git repo until P-9 is resolved). Two relevant files:

### E.1 `tests/runtime.refresh-loop.test.js` (338 lines, 13 tests)

Tests the BuyerRecon **website-JS** emitter (`/Users/admin/github/buyerrecon-website/js/buyerrecon-analytics.js`'s `_computeRefreshLoopEmit` + `_projectRefreshLoopPayload` + `detectAndEmitRefreshLoop` functions). Extracts the functions via regex and evaluates them inside a `vm.createContext`. Key facts:

- **Client-side threshold:** 4 same-path loads → emit (test loop `for t of [1000, 2000, 3000, 4000]`).
- **Distinct paths tracked independently** (path A reaches threshold; path B does not affect it).
- **Allowlist payload keys:** `event_category`, `signal_type`, `page_path`, `repeated_count`, `window_ms`, `detection_source`, `schema_version` (only these reach gtag/dataLayer).
- **Direct emit path** (`window.gtag('event', 'refresh_loop', …)` + `dataLayer.push({event: 'br_refresh_loop_observed', …})`); does NOT route through the shared `emit()` UTM-aware function (defence against UTM pollution).

### E.2 `lib/stage1-behaviour-score.js` (385 lines)

Track A's prototype Stage 1 scorer. `BEHAVIOURAL_ALLOWLIST` includes `'refreshLoopObserved'` as one of 8 expected scoring inputs. Stage 1 **trusts** the boolean — comment line 192 explicitly says: *"`refreshLoopObserved` is an UPSTREAM COMPOSITE flag — same trust model as Stage 0's nonBrowserRuntime. Stage 1 does NOT derive it from runtime telemetry code; the lib trusts the boolean and never imports the refresh-loop runtime files."*

**Critical point.** Track A's Stage 1 assumes someone upstream produces the boolean. PR#2 IS that "someone upstream" — but server-side, not client-side.

### E.3 What PR#2 must NOT do

- **Do NOT vendor Track A code.** PR#2 derives independently. Track A's `_computeRefreshLoopEmit` is client-side prototype using `sessionStorage` state; PR#2 is SQL over `accepted_events`.
- **Do NOT copy the client-side N=4 threshold blindly.** The user's task proposes N=3 as a more sensitive factual extraction threshold (per Sprint 2 deep-research). Threshold is an open decision (D-3).
- **Do NOT trust the SDK boolean as source of truth.** Even if the website-JS emits `refresh_loop` events into the collector, PR#2 must NOT take the SDK boolean's word for it. PR#2 re-derives from per-event sequence — that's the replay-attack defence Codex flagged in PR#1 review.
- **Do NOT copy Track A's payload allowlist as a contract.** Track A's `_REFRESH_LOOP_ALLOWED_KEYS` is for the gtag payload defence; not a PR#2 schema concern.

### E.4 Why server-side derivation is preferred over SDK/client flags

Three reasons (all already implied by A0 PR#2 + Codex review of PR#1):

1. **Replay attack defence.** A malicious or buggy client can suppress, fake, or replay refresh-loop emit events. Server-derived from raw `accepted_events` is tamper-resistant: any event the collector accepted is in the ledger.
2. **Reproducibility.** Server-side derivation can be re-run, re-extracted, recomputed deterministically from the same raw evidence. Client-side state is lost when the tab closes.
3. **Audit + governance alignment.** Sprint 4 audit/governance work expects scored / classified outputs to trace back to factual evidence. Server-derived refresh-loop facts have direct `accepted_events` provenance via `source_event_id_min` / `_max` already on the table.

---

## §F Recommended PR#2 scope

**One sentence.** Add **8 additive columns (7 factual/derived fields + 1 provenance field)** to `session_behavioural_features_v0_2`, update the extractor to populate them, bump the default `FEATURE_VERSION` to `behavioural-features-v0.3`, and keep the no-scoring boundary intact.

### F.1 What PR#2 includes — **7 files / actions total**

- 1 additive migration: `migrations/010_session_behavioural_features_v0_2_refresh_loop.sql` — `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for **8 columns (7 factual/derived + 1 provenance)**. No FK. No new indexes (existing indexes cover the new columns).
- 1 schema.sql append: extend the existing `session_behavioural_features_v0_2` block in `src/db/schema.sql` with the **8 column declarations (7 factual/derived + 1 provenance)** (matches the PR#11 / PR#1 schema-co-definition pattern).
- 1 extractor modification: `scripts/extract-behavioural-features.ts` — extend `EXTRACTION_SQL` CTE pipeline with refresh-loop derivation CTEs; bump `DEFAULT_FEATURE_VERSION` to `'behavioural-features-v0.3'`; add `EXPECTED_FEATURE_COUNT_V0_3 = 13` constant; add `feature_presence_map` / `feature_source_map` key for `refresh_loop_candidate`.
- Pure test additions to `tests/v1/behavioural-features-extraction.test.ts`: threshold helpers, algorithm SQL sweeps, SDK-hint-ignored verification, no-scoring-fields, forbidden-term sweep continues to pass.
- DB test additions to `tests/v1/db/behavioural-features.dbtest.ts`: refresh-loop scenarios (page_view runs, K=0/K=1, W boundary, distinct paths, no-refresh-loop control).
- 1 new verification SQL: `docs/sql/verification/09_refresh_loop_invariants.sql` (separate file for clean per-PR auditing; alternatively append to `08_*.sql` — see D-6).
- 1 PR doc: `docs/sprint2-pr2-refresh-loop-server-derivation.md` (implementation doc, separate from this planning doc).

### F.2 What PR#2 does NOT include

- ❌ No new table — additive columns to existing PR#1 table.
- ❌ No scoring, no reason codes, no Lane A/B output, no Stage 0/1 worker, no review queue, no customer-facing surface.
- ❌ No AI-agent / crawler taxonomy (deferred to Sprint 2 PR#5 per A0 P-11).
- ❌ No `refresh_loop_observed` column (replaced by `refresh_loop_candidate` to avoid judgement implication).
- ❌ No trust of SDK-emitted refresh-loop flags.
- ❌ No `nav.type` derivation (reload-vs-pushState distinction deferred — requires SDK extension).
- ❌ No `back_forward_count`, `spa_route_change_count`, `consecutive_reload_count` (signal-truth §6.5 fields that require SDK signals not yet in v1).
- ❌ No collector touch (`src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`, migrations 001–009, render.yaml, Dockerfile, .env*).
- ❌ No Render production work (P-4 still blocking).
- ❌ No live SDK rollout. No frontend changes.
- ❌ No AMS / Track A touch.

---

## §G Schema strategy recommendation

### G.1 Options evaluated

| Option | Description | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A** | Add additive columns to `session_behavioural_features_v0_2` via migration 010 | Single table; clean queries; PR#1's natural key already accommodates `feature_version` evolution; simplest extractor change. | Migration is technically an `ALTER TABLE`, slightly contradicts A0's literal "none" for migrations on PR#2 (but matches A0's intent). | **RECOMMENDED.** |
| **B** | Create sibling table `session_refresh_loop_features_v0_1` | Refresh-loop concerns fully isolated; future evolution decoupled. | Joins to query Stage 1 inputs together; doubles natural-key complexity; needs separate version policy. | Defer to a future PR if refresh-loop semantics evolve significantly. |
| **C** | Defer schema; only document algorithm | Smallest PR. | Doesn't deliver PR#2's value (Stage 1 input not produced). | Rejected — PR#2 must produce data. |

### G.2 Recommended: Option A

**Schema delta** (proposed in §H below; final shape subject to D-1 confirmation):

```sql
ALTER TABLE session_behavioural_features_v0_2
  ADD COLUMN IF NOT EXISTS refresh_loop_candidate             BOOLEAN,
  ADD COLUMN IF NOT EXISTS refresh_loop_count                 INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS same_path_repeat_count             INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS same_path_repeat_max_span_ms       BIGINT,
  ADD COLUMN IF NOT EXISTS same_path_repeat_min_delta_ms      BIGINT,
  ADD COLUMN IF NOT EXISTS same_path_repeat_median_delta_ms   BIGINT,
  ADD COLUMN IF NOT EXISTS repeat_pageview_candidate_count    INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refresh_loop_source                TEXT;
```

**8 additive columns total: 7 factual/derived fields + 1 provenance field** (`refresh_loop_source`). `ADD COLUMN IF NOT EXISTS` makes the migration idempotent. **Post-PR#2 table column count: 29 (PR#1) + 8 (PR#2) = 37.**

### G.3 feature_version bump (D-7 open decision)

**Default recommendation:** bump `DEFAULT_FEATURE_VERSION` from `behavioural-features-v0.2` to `behavioural-features-v0.3`. Rationale:

- v0.3 adds `refresh_loop_candidate` to `feature_presence_map` + `feature_source_map`, so `EXPECTED_FEATURE_COUNT` increases from 12 to **13**.
- Old v0.2 rows in the table remain unchanged (the migration `ADD COLUMN` adds NULL/0 for them — but only fresh v0.3 extraction populates the new columns meaningfully).
- New v0.3 rows have `valid + missing = 13` invariant.
- Both versions coexist in the same table via the existing natural key `(workspace_id, site_id, session_id, feature_version)`.
- This is the cleanest version contract; preserves PR#1's invariant for v0.2 rows.

**Alternative (D-7 Option β):** keep `feature_version='behavioural-features-v0.2'` and treat refresh-loop fields as "outside the core 12-count" (additional columns, not added to `feature_presence_map`). Pros: simpler, no version bump. Cons: PR#1's `valid + missing = 12` invariant remains for v0.2 rows, but `feature_presence_map` schema becomes ambiguous (does Stage 1 expect refresh-loop in the map or not?). Recommended against.

### G.4 No new index

Existing indexes on `(workspace_id, site_id, last_seen_at DESC)`, `(workspace_id, site_id, session_id)`, `(feature_version, extracted_at DESC)` cover all anticipated query patterns. No new index in PR#2.

---

## §H Field naming and data contract

### H.1 New columns — **8 additive: 7 factual/derived fields + 1 provenance field**

| Column | Type | Nullability | Meaning | Why factual |
|---|---|---|---|---|
| `refresh_loop_candidate` | BOOLEAN | NULL allowed (until extractor runs); FALSE/TRUE after | TRUE iff `refresh_loop_count > 0`. **A candidate flag derived under fixed extraction thresholds; NOT a judgement.** | Boolean derived deterministically from same-path streak detection. |
| `refresh_loop_count` | INT NOT NULL DEFAULT 0 | NOT NULL | Number of distinct same-path candidate streaks per session under the (N, W, K) thresholds. | Count. |
| `same_path_repeat_count` | INT NOT NULL DEFAULT 0 | NOT NULL | Max consecutive same-path page_view run length per session (regardless of timing/K thresholds). | Count. |
| `same_path_repeat_max_span_ms` | BIGINT | NULL allowed (only present if same-path streak exists) | Max time span (ms) of any same-path consecutive run within the session. | Duration measurement. |
| `same_path_repeat_min_delta_ms` | BIGINT | NULL allowed | Minimum inter-page_view delta within any same-path consecutive run. | Duration. |
| `same_path_repeat_median_delta_ms` | BIGINT | NULL allowed | **Median of ALL eligible adjacent same-path page_view deltas in the session.** I.e., the inter-page_view delta between every two consecutive same-path page_view events, pooled across all same-path runs in the session, then taking the percentile_cont(0.5) over that pool. **NOT a median of per-run medians.** NULL when zero such adjacent same-path pairs exist (e.g. session with one path repeat = 0 deltas; or session where no two consecutive page_views share a path). | Duration. |
| `repeat_pageview_candidate_count` | INT NOT NULL DEFAULT 0 | NOT NULL | Total count of page_view events that participate in any candidate streak (informational). | Count. |
| `refresh_loop_source` | TEXT | NULL allowed (until extractor runs) | Provenance label: `'server_derived'` for v0.3 rows. Future values may include `'sdk_hint_present_not_trusted'` if Helen approves recording SDK hint comparison (D-4 open decision). | String enum (operator metadata). |

**Hard non-judgement rule.** None of these field names contain `score`, `risk`, `classification`, `recommend`, `confidence`, `is_*`, `verified`, `confirmed`, or any reason-code-shaped string. The forbidden-term sweep in `tests/v1/behavioural-features-extraction.test.ts` continues to apply unchanged.

### H.2 What PR#2 does NOT introduce

- ❌ `refresh_loop_observed` (judgemental "observed" — replaced by `_candidate`)
- ❌ `is_refresh_loop_session`, `is_bot_pattern`, `looks_like_refresh_loop`
- ❌ Any score, risk, classification, recommendation, confidence, severity bucket
- ❌ Any reason-code-shaped string (A_*/B_*/REVIEW_*/OBS_*)
- ❌ Any URL column (paths only)
- ❌ Any user_agent / ip_hash / token_hash / pepper reference

### H.3 Extraction thresholds (factual, not scoring)

Three named constants exported by the extractor:

```typescript
export const REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS = 3;          // N
export const REFRESH_LOOP_MAX_SPAN_MS                = 10_000;     // W
export const REFRESH_LOOP_MAX_ACTIONS_BETWEEN        = 1;          // K
```

**Documentation discipline.** Every comment and PR doc reference to these constants MUST state:

> *"These are factual extraction thresholds, not scoring thresholds. They define what counts as a refresh-loop candidate streak. They do NOT define risk. Future Sprint 2 PR#6 (Stage 1 scorer) may consume `refresh_loop_candidate` as one of its 8 scoring inputs; PR#2 does NOT score."*

**Threshold values (D-3 open decision):**

| Constant | Default | Rationale |
|---|---|---|
| `REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS` (N) | **3** | More sensitive than Track A's client N=4. Sprint 2 deep-research recommended ≥3. |
| `REFRESH_LOOP_MAX_SPAN_MS` (W) | **10000** (10s) | Matches existing `pageview_burst_count_10s` window for consistency. |
| `REFRESH_LOOP_MAX_ACTIONS_BETWEEN` (K) | **1** | Allows single accidental interaction inside the streak. K=0 too strict; K=2+ too lenient. |

---

## §I Server-side algorithm

### I.1 Inputs

- Table: `accepted_events`
- Filters (identical to PR#1):
  - `event_contract_version = 'event-contract-v0.1'`
  - `event_origin = 'browser'`
  - `workspace_id IS NOT NULL AND site_id IS NOT NULL`
  - `session_id IS NOT NULL AND session_id <> '__server__'`
- Ordering: `ORDER BY received_at ASC, event_id ASC` (deterministic tie-break)
- Candidate-window pattern: candidate sessions selected by `received_at IN [window_start, window_end]`; full-session aggregation across all events for those sessions.

### I.2 Definitions

- **Page view event**: `raw->>'event_name' = 'page_view'`.
- **Action event**: `raw->>'event_name' IN ('cta_click', 'form_start', 'form_submit')` (matches PR#1's "action" definition).
- **Same-path run**: a maximal consecutive subsequence of page_view events with identical `raw->>'page_path'` value (no different-path page_view between them; action events between are counted but do not break the run).
- **Candidate streak**: a same-path run of length ≥ N=3 AND total span ≤ W=10000ms AND with ≤ K=1 action events between consecutive same-path page_views in the run.

### I.3 Algorithm sketch (single SQL CTE pipeline extension)

Extend the existing `EXTRACTION_SQL` pipeline by adding new CTEs before `feature_aggs`:

```sql
-- (new) ordered_pageviews_with_actions: order page_view + action events
ordered_pageviews_with_actions AS (
  SELECT workspace_id, site_id, session_id, event_id, received_at,
         raw->>'page_path' AS page_path,
         raw->>'event_name' AS event_name,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at ASC, event_id ASC
         ) AS evt_rn
    FROM session_events
   WHERE raw->>'event_name' IN ('page_view', 'cta_click', 'form_start', 'form_submit')
),
-- (new) consecutive same-path page_view runs (run boundaries reset on
-- different path or on a non-page_view event with K threshold logic)
pageview_runs AS (
  SELECT workspace_id, site_id, session_id, event_id, received_at, page_path,
         /* compute streak_id per (workspace, site, session, page_path) using
            islands-and-gaps pattern: increment streak_id whenever an event
            with a different page_path (or > K actions) occurs since last
            same-path page_view */
         …
    FROM ordered_pageviews_with_actions
   WHERE event_name = 'page_view'
),
-- (new) per-run aggregates
run_aggs AS (
  SELECT workspace_id, site_id, session_id, page_path, streak_id,
         COUNT(*)::int                                                  AS run_length,
         MIN(received_at)                                               AS run_start,
         MAX(received_at)                                               AS run_end,
         (EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) * 1000)::bigint
                                                                        AS run_span_ms,
         /* min + median inter-pageview delta within run */
         …
    FROM pageview_runs
   GROUP BY workspace_id, site_id, session_id, page_path, streak_id
),
-- (new) candidate streaks: runs that meet N + W + K thresholds
candidate_streaks AS (
  SELECT *
    FROM run_aggs
   WHERE run_length >= 3              -- N
     AND run_span_ms <= 10000         -- W
     /* K threshold via separate per-streak action count CTE; see I.4 */
),
-- (new) eligible_same_path_deltas: every inter-page_view delta where the
-- two consecutive page_view events (by deterministic ordering) share the
-- same page_path. Pooled per session across ALL same-path runs — NOT
-- bucketed per run. This is the source for same_path_repeat_median_delta_ms.
eligible_same_path_deltas AS (
  SELECT workspace_id, site_id, session_id,
         (EXTRACT(EPOCH FROM (received_at - prev_pv_received_at)) * 1000)::numeric AS delta_ms
    FROM (
      SELECT workspace_id, site_id, session_id, received_at, page_path,
             LAG(received_at) OVER (
               PARTITION BY workspace_id, site_id, session_id
               ORDER BY received_at ASC, event_id ASC
             ) AS prev_pv_received_at,
             LAG(page_path) OVER (
               PARTITION BY workspace_id, site_id, session_id
               ORDER BY received_at ASC, event_id ASC
             ) AS prev_page_path
        FROM session_events
       WHERE raw->>'event_name' = 'page_view'
    ) sub
   WHERE prev_pv_received_at IS NOT NULL
     AND prev_page_path = page_path   -- adjacent same-path pair
),
-- (new) per-session refresh-loop summary
refresh_loop_aggs AS (
  SELECT ra.workspace_id, ra.site_id, ra.session_id,
         (COUNT(*) FILTER (WHERE cs.run_length IS NOT NULL))::int       AS refresh_loop_count,
         MAX(ra.run_length)::int                                        AS same_path_repeat_count,
         MAX(ra.run_span_ms)::bigint                                    AS same_path_repeat_max_span_ms,
         MIN(ra.min_delta_ms)::bigint                                   AS same_path_repeat_min_delta_ms,
         SUM(CASE WHEN cs.run_length IS NOT NULL
                  THEN cs.run_length ELSE 0 END)::int                   AS repeat_pageview_candidate_count
    FROM run_aggs ra
    LEFT JOIN candidate_streaks cs USING (workspace_id, site_id, session_id, page_path, streak_id)
   GROUP BY ra.workspace_id, ra.site_id, ra.session_id
),
-- (new) per-session median over the pooled adjacent same-path deltas
refresh_loop_median AS (
  SELECT workspace_id, site_id, session_id,
         (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_ms))::bigint
           AS same_path_repeat_median_delta_ms
    FROM eligible_same_path_deltas
   GROUP BY workspace_id, site_id, session_id
)
-- Final feature_aggs CTE LEFT JOINs refresh_loop_aggs AND refresh_loop_median
-- to populate the 8 new columns:
-- (refresh_loop_candidate, refresh_loop_count, same_path_repeat_count,
--  same_path_repeat_max_span_ms, same_path_repeat_min_delta_ms,
--  same_path_repeat_median_delta_ms, repeat_pageview_candidate_count,
--  refresh_loop_source)
-- refresh_loop_candidate = (refresh_loop_count > 0)
-- refresh_loop_source = 'server_derived'
```

**Final INSERT/UPDATE** is identical pattern to PR#1 (`ON CONFLICT (workspace_id, site_id, session_id, feature_version) DO UPDATE SET …`) — add **all 8 new columns (7 factual/derived + `refresh_loop_source`)** to both the INSERT column list and the DO UPDATE SET list.

### I.4 K-threshold handling (max actions between consecutive same-path page_views)

The cleanest SQL approach: in `pageview_runs`, the islands-and-gaps "new streak" trigger fires when either:

1. The page_path changes (different `raw->>'page_path'` from the previous page_view in the session), OR
2. More than K action events have occurred since the previous same-path page_view.

This can be expressed as a window-function chain using `LAG` for previous-path and `COUNT(*) FILTER (WHERE event_name IN actions) OVER (…)` for between-action counting. SQL is moderately complex but deterministic. Final SQL to be reviewed during implementation.

### I.5 Edge cases

| Case | Expected output |
|---|---|
| Session has 0 page_views | `refresh_loop_count=0`, `refresh_loop_candidate=FALSE`, `same_path_repeat_count=0`, all duration fields NULL |
| Session has 1 page_view | Same as above |
| Session has 2 same-path page_views | `same_path_repeat_count=2`, but `refresh_loop_count=0` (below N=3 threshold), `refresh_loop_candidate=FALSE` |
| Session has 3 same-path page_views within 10s, 0 actions between | `refresh_loop_count=1`, `refresh_loop_candidate=TRUE`, `same_path_repeat_count=3`, `same_path_repeat_max_span_ms` set |
| Session has 3 same-path page_views spanning > 10s | `refresh_loop_count=0`, `refresh_loop_candidate=FALSE` (above W threshold), `same_path_repeat_count=3`, `same_path_repeat_max_span_ms` reflects the full span |
| Session has 3 same-path page_views with 2 cta_click between | `refresh_loop_count=0` (above K=1 threshold), `same_path_repeat_count=3` (streak still counted, just not a candidate) |
| Session alternates path A/B/A/B/A | `same_path_repeat_count=1` (no two consecutive same-path), `refresh_loop_count=0` |
| Session has TWO separate 3+ same-path streaks within the window | `refresh_loop_count=2`, candidate=TRUE |

---

## §J SDK / client hint policy

**Hard rule.** The website-JS may emit a `refresh_loop` event into `accepted_events.raw` (via gtag/dataLayer pipeline → ThinSDK → collector). PR#2's algorithm does **NOT** consult that SDK signal as source of truth.

**Three permissible policies (D-4 open decision):**

| Option | Description | Recommendation |
|---|---|---|
| α | **Ignore SDK hint entirely.** PR#2 derives independently; `refresh_loop_source = 'server_derived'` always. SDK hint events in `raw` are treated as ordinary page_view-adjacent events (filtered out by the `event_name IN ('page_view', 'cta_click', 'form_start', 'form_submit')` filter). | **Default recommended.** Simplest, no contract surface for client tampering. |
| β | **Record SDK hint as provenance comparison.** If `accepted_events.raw->>'event_name' = 'refresh_loop'` (or equivalent) is observed in the session, set `refresh_loop_source = 'sdk_hint_present_not_trusted'` regardless of whether server-derived `refresh_loop_candidate` agrees. The server-derived value remains authoritative. | Use only if Helen wants provenance for future calibration analysis. |
| γ | **Server-derived AND require SDK confirmation.** AND-gate. **Rejected** — defeats the server-side trust model; reintroduces SDK as source of truth. |

**Recommendation: α.** PR#2 doesn't touch SDK hints. Future PRs (Sprint 2 PR#7 false-positive review queue, Sprint 5 PR#3 outcome backfill) may revisit SDK-hint comparison as a calibration metric — but not in PR#2.

---

## §K Provenance / feature map policy

### K.1 If D-7 = bump to v0.3 (recommended default)

`feature_presence_map` adds 1 new key `refresh_loop_candidate`. Allowed values per `feature_presence_map`:

- `'present'` — refresh_loop_candidate is non-NULL (which is the default case for v0.3 rows where the extractor sets `FALSE` or `TRUE` deterministically).
- `'missing'` — refresh_loop_candidate is NULL (e.g. v0.2 rows extracted before PR#2). Should never occur on v0.3 rows.
- `'not_extractable'` — reserved; not used in v0.3.

`feature_source_map` adds 1 new key `refresh_loop_candidate`. Allowed values:

- `'server_derived'` — default v0.3 (D-4 Option α).
- `'sdk_hint_present_not_trusted'` — only if D-4 Option β is approved.
- `'not_extractable'` — not used in v0.3.

`EXPECTED_FEATURE_COUNT_V0_3 = 13`. Invariant: `valid_feature_count + missing_feature_count = 13` for every v0.3 row.

### K.2 The other 6 refresh-loop derivation columns are NOT in feature_presence_map

`refresh_loop_count`, `same_path_repeat_count`, `same_path_repeat_max_span_ms`, `same_path_repeat_min_delta_ms`, `same_path_repeat_median_delta_ms`, `repeat_pageview_candidate_count` are **diagnostic byproducts**, not Stage-1-shaped scoring inputs. They live on the table for observability and future analysis but are NOT tracked in feature_presence_map (which is reserved for Stage-1-shaped inputs).

### K.3 Privacy / leakage rules (inherited from PR#1, unchanged for PR#2)

- No raw values in maps (only the labels `present` / `missing` / `not_extractable` / `server_derived` / `sdk_hint_present_not_trusted`).
- No URLs (paths only — never used in PR#2 anyway; paths only via `raw->>'page_path'`).
- No PII.
- No QA / bot / synthetic / adversary labels.
- No `token_hash`, `ip_hash`, `user_agent`, peppers.

---

## §L Expected files

| Action | Path | Reason |
|---|---|---|
| **new** | `migrations/010_session_behavioural_features_v0_2_refresh_loop.sql` | Additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` × 8 columns. No FK. No new indexes. No CHECK on `refresh_loop_source` (string enum validated in invariant SQL). Optional non-negativity CHECK constraints on count columns (matches PR#1 pattern). |
| **modify** | `src/db/schema.sql` | Extend the `session_behavioural_features_v0_2` block (section 13) with the 8 new column declarations. No edits to other blocks. |
| **modify** | `scripts/extract-behavioural-features.ts` | Bump `DEFAULT_FEATURE_VERSION` to `'behavioural-features-v0.3'`; add `EXPECTED_FEATURE_COUNT_V0_3 = 13`; export thresholds; extend `EXTRACTION_SQL` CTE pipeline + INSERT/UPDATE column list; add `refresh_loop_candidate` to `feature_presence_map` + `feature_source_map`. |
| **modify** | `tests/v1/behavioural-features-extraction.test.ts` | Add pure tests for thresholds + algorithm SQL sweeps + SDK-hint-ignored + no-scoring + forbidden-term sweep continues to pass. Update the existing "no `refresh_loop` column" tests — they become "no `refresh_loop_observed` column" / "no scoring-shaped column"; the `refresh_loop_candidate` etc additions are not violations. |
| **modify** | `tests/v1/db/behavioural-features.dbtest.ts` | Add ~12 DB tests for refresh-loop scenarios. Bump the existing "no `refresh_loop%` column" assertion to be more specific (forbid `refresh_loop_observed`, allow `refresh_loop_candidate`). |
| **new** | `docs/sql/verification/09_refresh_loop_invariants.sql` | New verification file for refresh-loop invariants (see §N). **Alternative**: append to `08_behavioural_features_invariants.sql` (D-6 open decision). |
| **new** | `docs/sprint2-pr2-refresh-loop-server-derivation.md` | Implementation PR doc (separate from this planning doc). |

### L.1 Files that MUST NOT change

- `src/collector/v1/**` — collector route, orchestrator, persistence, row-builders, validation, auth, normalised-envelope, hash, canonical, stable-json, payload-hash, dedupe, pii, consent, boundary, reason-codes, stage-map, types
- `src/app.ts`, `src/server.ts`, `src/auth/**`
- `migrations/001 … 009` — frozen
- `scripts/extract-session-features.ts` — frozen
- `scripts/collector-observation-report.ts`, `scripts/observation-session-features.ts` — frozen
- `render.yaml`, `Dockerfile`, `.env*` — frozen
- `docs/contracts/signal-truth-v0.1.md` — frozen per Sprint 2 PR#0
- `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`, `scoring/version.yml`, `scoring/README.md` — frozen per Sprint 2 PR#0
- `docs/architecture/ARCHITECTURE_GATE_A0.md` — frozen per Helen sign-off at `a87eb05`
- `docs/sprint2-pr1-*.md` — frozen (PR#1 doc + planning doc are historical)
- AMS repo, Track A repo, all frontend / GTM / GA4 / LinkedIn / ThinSDK code

### L.2 Modify-or-separate-extractor decision (D-5)

The user's task said: *"Default likely: Modify existing behavioural extractor if adding columns to same table."*

**Recommendation: modify existing `scripts/extract-behavioural-features.ts`.** Reasons:

- Same target table → one INSERT path → one extractor.
- Bumping `DEFAULT_FEATURE_VERSION` keeps behavioural feature extraction in a single CLI surface.
- Avoids duplicating the candidate-window/full-session aggregation logic.
- Tests + observability remain in one place.

The alternative (separate extractor `extract-refresh-loop-features.ts`) doubles the surface and would need its own bootstrap path. Reject unless D-1 changes to "sibling table".

---

## §M Test plan

### M.1 Pure tests (extend existing `tests/v1/behavioural-features-extraction.test.ts`)

**Threshold constant exports:**

- `REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS = 3`
- `REFRESH_LOOP_MAX_SPAN_MS = 10000`
- `REFRESH_LOOP_MAX_ACTIONS_BETWEEN = 1`

Tests:

- Constants are exported and have the documented values.
- Constants are referenced in `EXTRACTION_SQL` (the SQL string contains the numeric literals or named references).

**EXTRACTION_SQL extension sweeps:**

- New CTEs (`ordered_pageviews_with_actions`, `pageview_runs`, `run_aggs`, `candidate_streaks`, `refresh_loop_aggs`) present.
- INSERT column list contains all 8 new columns (7 factual/derived + `refresh_loop_source`).
- DO UPDATE SET clause contains all 8 new columns (7 factual/derived + `refresh_loop_source`).
- `feature_presence_map` `jsonb_build_object` contains 13 keys (12 original + `refresh_loop_candidate`).
- `feature_source_map` `jsonb_build_object` contains 13 keys.
- `EXPECTED_FEATURE_COUNT_V0_3 = 13`.
- `DEFAULT_FEATURE_VERSION = 'behavioural-features-v0.3'`.

**SDK-hint-ignored verification:**

- `EXTRACTION_SQL` filter does NOT include `event_name = 'refresh_loop'` as an input event type — only `page_view`, `cta_click`, `form_start`, `form_submit`.
- Extractor source does NOT contain any reference to `raw->>'refresh_loop_observed'`, `raw->>'refresh_loop'`, or `refreshLoopObserved` as a trusted input.
- The 'sdk_hint_present_not_trusted' label appears in source comments only (if D-4 Option α confirmed), not as an active output value.

**Forbidden-term sweep (PR#1 invariant continues to apply):**

- `scoring/forbidden_codes.yml` loaded via `.patterns` (post-CF-2 shape).
- Extractor source + migration SQL (now including migration 010) swept against `string_patterns_blocked_in_code.patterns`.
- `verification_method_strength` schema field is NOT spuriously blocked.

**No-scoring discipline (PR#1 invariant continues to apply):**

- No `risk_score`, `score`, `classification`, `recommended_action`, `confidence_band`, `is_bot`, `is_agent`, `ai_agent`, `is_human`, `buyer`, `intent`, `lead_quality`, `crm`, `enrich`, `verified`, `confirmed`, `reason_code` in active code.
- Update the existing PR#1 test that asserts "no `refresh_loop` column" — refactor to "no `refresh_loop_observed` column AND no judgement-shaped column" since `refresh_loop_candidate` is now legitimate.

**No-collector-v1 / no-Track-A / no-Core-AMS import (PR#1 invariant continues):**

- Existing tests pass unchanged.

### M.2 DB tests (extend existing `tests/v1/db/behavioural-features.dbtest.ts`)

Use the existing isolated workspace `__test_ws_pr1_behavioural__` (already defined in PR#1 DB tests). The PR#2 tests are additive.

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Migration 010 applied: `information_schema.columns` shows 8 new columns | columns exist |
| 2 | Single page_view session | `refresh_loop_count=0`, `refresh_loop_candidate=FALSE`, `same_path_repeat_count=1`, span/delta fields NULL |
| 3 | Two same-path page_views | `same_path_repeat_count=2`, `refresh_loop_count=0` (below N=3), `refresh_loop_candidate=FALSE` |
| 4 | Three same-path page_views within 10s, 0 actions between | `refresh_loop_count=1`, `refresh_loop_candidate=TRUE`, `same_path_repeat_count=3`, `same_path_repeat_max_span_ms <= 10000` |
| 5 | Three same-path page_views spanning > 10s (e.g. 15s) | `refresh_loop_count=0`, `refresh_loop_candidate=FALSE`, `same_path_repeat_count=3`, `same_path_repeat_max_span_ms > 10000` |
| 6 | Three same-path page_views with 2 cta_click between | `refresh_loop_count=0` (above K=1), `refresh_loop_candidate=FALSE`, `same_path_repeat_count=3` |
| 7 | Three same-path page_views with 1 cta_click between | `refresh_loop_count=1` (K=1 allowed), `refresh_loop_candidate=TRUE` |
| 8 | Path A/B/A/B/A alternating | `same_path_repeat_count=1`, `refresh_loop_count=0` |
| 9 | Two separate 3+ same-path streaks in one session | `refresh_loop_count=2`, `refresh_loop_candidate=TRUE`, `same_path_repeat_count=3` (or max length) |
| 10 | Late-event rerun: add a 4th same-path page_view → rerun | Same `behavioural_features_id`; updated counts |
| 11 | Candidate-window / full-session: old same-path pageview outside window + 2 recent same-path pageviews inside window → full session has 3, candidate fires | `refresh_loop_count=1` (full-session aggregation) |
| 12 | SDK-hint-ignored: seed an event with `raw->>'refresh_loop'` true but no actual server-derivable streak | `refresh_loop_candidate=FALSE`, `refresh_loop_source='server_derived'` |
| 13 | Idempotent rerun: same source events → identical row | counts unchanged |
| 14 | Source tables unchanged: snapshot before/after extractor | `accepted_events`, `rejected_events`, `ingest_requests`, `session_features` row counts identical |
| 15 | `feature_presence_map` v0.3 rows have 13 keys including `refresh_loop_candidate` | length 13, value `'present'` |
| 16 | `feature_source_map` v0.3 rows have 13 keys including `refresh_loop_candidate: 'server_derived'` | length 13 |
| 17 | `valid + missing = 13` invariant for v0.3 rows | invariant holds |
| 18 | No scoring columns added (information_schema regex check) | 0 rows |
| 19 | v0.2 rows (extracted before PR#2) coexist with v0.3 rows | both present, distinct natural keys |
| 20 | Cross-workspace isolation maintained for new columns | OK |

**Total: ~20 new DB tests.**

---

## §N Verification SQL plan

### N.1 New file: `docs/sql/verification/09_refresh_loop_invariants.sql`

(D-6 default: separate file. Alternative: append to `08_*.sql`.)

All read-only `SELECT`. Each query gated by `to_regclass('public.session_behavioural_features_v0_2') IS NOT NULL` and presence of the new columns (via `information_schema.columns`).

**Query 0. Presence guard:**

```sql
SELECT to_regclass('public.session_behavioural_features_v0_2') AS regclass;
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public'
   AND table_name='session_behavioural_features_v0_2'
   AND column_name IN (
     'refresh_loop_candidate', 'refresh_loop_count', 'same_path_repeat_count',
     'same_path_repeat_max_span_ms', 'same_path_repeat_min_delta_ms',
     'same_path_repeat_median_delta_ms', 'repeat_pageview_candidate_count',
     'refresh_loop_source'
   );
-- Expected: 8 rows (after migration 010). If fewer, skip queries below.
```

**Query 1. `refresh_loop_candidate` consistent with `refresh_loop_count`:**

```sql
SELECT workspace_id, site_id, session_id, refresh_loop_candidate, refresh_loop_count
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND (   (refresh_loop_candidate = TRUE  AND refresh_loop_count = 0)
        OR (refresh_loop_candidate = FALSE AND refresh_loop_count > 0));
-- Expected: 0 rows.
```

**Query 2a. If `refresh_loop_candidate = TRUE`, `same_path_repeat_count >= REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS` (default 3):**

At least one same-path run met the minimum-length threshold N, so the per-session maximum run length must be ≥ N.

```sql
SELECT workspace_id, site_id, session_id,
       refresh_loop_candidate, same_path_repeat_count
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND refresh_loop_candidate = TRUE
   AND same_path_repeat_count < 3;   -- N = REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS
-- Expected: 0 rows.
```

**Query 2b. If `refresh_loop_count > 0`, `repeat_pageview_candidate_count >= refresh_loop_count * REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS`:**

Every candidate streak contributes ≥ N page_views to the candidate pool, so the total pool size must be ≥ count × N.

```sql
SELECT workspace_id, site_id, session_id,
       refresh_loop_count, repeat_pageview_candidate_count
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND refresh_loop_count > 0
   AND repeat_pageview_candidate_count < (refresh_loop_count * 3);
-- Expected: 0 rows.
```

**Note on the previously-considered `same_path_repeat_count >= refresh_loop_count` invariant.** That invariant is **unsafe** and was removed during planning revision. Counter-example: a session with 5 distinct same-path streaks each of length 3 yields `refresh_loop_count = 5` and `same_path_repeat_count = 3` (the per-session maximum run length, not the sum). The 2a + 2b pair captures the safe semantic without the false-positive risk.

**Query 3. Non-negative durations and counts:**

```sql
SELECT workspace_id, session_id
  FROM session_behavioural_features_v0_2
 WHERE refresh_loop_count                          < 0
    OR same_path_repeat_count                      < 0
    OR repeat_pageview_candidate_count             < 0
    OR (same_path_repeat_max_span_ms IS NOT NULL    AND same_path_repeat_max_span_ms    < 0)
    OR (same_path_repeat_min_delta_ms IS NOT NULL   AND same_path_repeat_min_delta_ms   < 0)
    OR (same_path_repeat_median_delta_ms IS NOT NULL AND same_path_repeat_median_delta_ms < 0);
-- Expected: 0 rows.
```

**Query 4. Feature-map updated for v0.3:**

```sql
SELECT workspace_id, session_id,
       feature_presence_map ? 'refresh_loop_candidate' AS pres_has_key,
       feature_source_map   ? 'refresh_loop_candidate' AS src_has_key
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND (NOT (feature_presence_map ? 'refresh_loop_candidate')
        OR NOT (feature_source_map ? 'refresh_loop_candidate'));
-- Expected: 0 rows.
```

**Query 5. valid + missing = 13 for v0.3 rows:**

```sql
SELECT workspace_id, session_id, valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND valid_feature_count + missing_feature_count <> 13;
-- Expected: 0 rows.
```

**Query 6. v0.2 rows (legacy) still have valid + missing = 12:**

```sql
SELECT workspace_id, session_id, valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.2'
   AND valid_feature_count + missing_feature_count <> 12;
-- Expected: 0 rows. (Backwards-compat invariant.)
```

**Query 7. refresh_loop_source allowed values:**

```sql
SELECT workspace_id, session_id, refresh_loop_source
  FROM session_behavioural_features_v0_2
 WHERE feature_version='behavioural-features-v0.3'
   AND refresh_loop_source IS NOT NULL
   AND refresh_loop_source NOT IN ('server_derived', 'sdk_hint_present_not_trusted');
-- Expected: 0 rows.
```

**Query 8. NO scoring / judgement columns added:**

Same as PR#1's invariant SQL query 9 — extended to also check for refresh-loop-shaped scoring fields.

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='session_behavioural_features_v0_2'
   AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed|refresh_loop_observed)';
-- Expected: 0 rows.
```

**Query 9. source_event_count unchanged across PR#1 → PR#2 reruns for v0.2 rows:**

Pure operator sanity. Cross-table invariant against `accepted_events` continues per PR#1's verification SQL query 6.

**Query 10. Latest 20 v0.3 rows for human inspection** — parameterised by workspace/site.

---

## §O Rollback plan

### O.1 Schema rollback (additive column drop, no CASCADE)

```sql
-- Reverse the migration 010 column additions
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

No `CASCADE` (no FK or view dependencies exist on these columns).

### O.2 Code rollback

Revert the PR#2 commit. Effect:

- Migration 010 removed (existing v0.3 rows retain the dropped columns until step O.1 runs).
- Extractor reverts to `DEFAULT_FEATURE_VERSION='behavioural-features-v0.2'` and the original CTE pipeline (no refresh-loop CTEs).
- Pure tests + DB tests revert to the PR#1 state.

### O.3 Data rollback

- No data rollback needed for `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features` — those tables are read-only inputs to PR#2.
- v0.2 rows in `session_behavioural_features_v0_2` are untouched by PR#2 (the migration adds NULL/0 columns to them, but no UPDATE).
- v0.3 rows can be discarded by `DELETE FROM session_behavioural_features_v0_2 WHERE feature_version='behavioural-features-v0.3'` if the operator wants to clean up post-rollback. Optional.

### O.4 Production rollback

**Not applicable.** PR#2 ships local + Hetzner only per A0 P-4 (still blocking). No Render production exposure.

---

## §P Open decisions for Helen

Seven blocking decisions. Defaults reflect Codex-style discipline; Helen may accept defaults with a single sign-off or override individually.

| ID | Decision | Default | Status |
|---|---|---|---|
| **D-1** | Schema strategy — additive columns on `session_behavioural_features_v0_2` vs sibling table? | **Additive columns (Option A).** PR#2 explicitly extends PR#1's behavioural factual layer. PR#1's natural key + feature_version already accommodate version evolution. Sibling table (Option B) is reserved for a hypothetical future major schema change. | Codex-style default; blocking |
| **D-2** | Field name for the boolean — `refresh_loop_candidate` vs `refresh_loop_observed` vs other? | **`refresh_loop_candidate`.** "Candidate" preserves the factual-not-judgemental discipline Codex flagged in PR#1. "Observed" implies an authoritative finding PR#2 cannot make. | Codex-style default; blocking |
| **D-3** | Threshold values for `(N, W, K)` — consecutive same-path page_views, window ms, max actions between | **N=3, W=10000ms, K=1.** Sprint 2 deep-research recommended. More sensitive than Track A's client-side N=4. K=1 allows single accidental interaction. | Helen-binary; blocking |
| **D-4** | SDK refresh-loop hint policy — ignore entirely (α), record as provenance (β), AND-gate (γ)? | **α — Ignore entirely.** Server-side is authoritative; SDK hints not trusted as truth and not recorded as comparison. β can be added in a future PR if calibration needs it. γ rejected. | Codex-style default; blocking |
| **D-5** | Modify existing `extract-behavioural-features.ts` vs create a separate `extract-refresh-loop-features.ts`? | **Modify existing.** Same target table → one INSERT path → one extractor. Avoids duplicating candidate-window/full-session aggregation. | Codex-style default; blocking |
| **D-6** | Verification SQL — new file `09_refresh_loop_invariants.sql` vs append to `08_behavioural_features_invariants.sql`? | **New file `09_*.sql`.** Cleaner per-PR auditing; mirrors PR#11's pattern (`06_session_features_invariants.sql` was its own file). | Helen-binary; non-blocking |
| **D-7** | Bump `DEFAULT_FEATURE_VERSION` to `behavioural-features-v0.3` (recommended) vs keep v0.2 with refresh-loop "outside core 12-count"? | **Bump to v0.3.** Adds `refresh_loop_candidate` to feature_presence_map. `EXPECTED_FEATURE_COUNT_V0_3 = 13`. v0.2 rows remain valid+missing=12. v0.3 rows have valid+missing=13. Cleanest version contract. | Codex-style default; blocking |

**All 7 decisions must be resolved in writing per A0 §0.7 before implementation begins.**

---

## §Q Go / no-go recommendation

**GO for implementation, contingent on Helen sign-off on D-1 through D-7.**

The plan:

- preserves A0 §K PR#2's literal scope ("counts `accepted_events` with same `(session_id, page_path)`; does not trust SDK boolean; extends PR#1; pure + dbtest; no collector touch")
- preserves PR#1's no-scoring boundary verbatim (every column factual; no `score`/`risk`/`classification`; no reason-code emission; no Lane A/B output; no Stage 0/1 worker; no customer-facing surface)
- uses additive `ALTER TABLE` + version bump pattern that the planning doc for PR#1 explicitly anticipated (*"future feature_version (v0.3+) may need new columns"*)
- uses neutral field name `refresh_loop_candidate` per Codex's PR#1 review correction
- specifies thresholds as **factual extraction thresholds, not scoring thresholds**, with explicit documentation discipline
- ignores SDK refresh-loop hints (default D-4 Option α) — server-derived is authoritative
- continues PR#1's forbidden-term sweep via `.patterns` (post-CF-2 shape)
- uses `to_regclass` + `information_schema.columns` presence guards in verification SQL so the file is safe to run pre-migration
- replaces CASCADE with explicit `DROP COLUMN IF EXISTS …` for rollback
- documents Hetzner-staging-only proof; no Render production work until A0 P-4 is resolved

**Pre-implementation checklist** (every box must be TRUE before Sprint 2 PR#2 code is written):

- [ ] Helen signs off on this planning document per A0 §0.7
- [ ] D-1 schema strategy confirmed: additive columns
- [ ] D-2 field name confirmed: `refresh_loop_candidate`
- [ ] D-3 thresholds (N, W, K) confirmed: (3, 10000ms, 1)
- [ ] D-4 SDK hint policy confirmed: ignore entirely (α)
- [ ] D-5 extractor modification path confirmed: modify existing
- [ ] D-6 verification SQL placement confirmed: new `09_*.sql` file (or append per Helen)
- [ ] D-7 version bump confirmed: `behavioural-features-v0.3` with `EXPECTED_FEATURE_COUNT = 13`
- [ ] No regressions in 1758 pure + 104 DB tests on the implementation branch
- [ ] No P-4 (Render production ops) work begins; PR#2 is local + Hetzner only

After Helen's written sign-off, Sprint 2 PR#2 implementation may begin on a feature branch in `buyerrecon-backend`. No production impact. No collector code change. No frontend change. No SDK / GTM / GA4 / LinkedIn / ThinSDK change. Pure derived-factual extension of the PR#1 behavioural layer.

**No code was implemented for this planning. No files were modified beyond this planning document itself. No commit was made.**

---

**End of planning document.**

Awaiting Helen's review and written sign-off per A0 §0.7 before PR#2 implementation begins.
