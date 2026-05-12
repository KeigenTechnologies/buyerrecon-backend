-- Sprint 2 PR#2 verification — refresh-loop / repeated-pageview invariants
-- on session_behavioural_features_v0_2 (v0.3 feature_version).
--
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render production
-- without explicit approval per Architecture Gate A0 P-4 (still blocking).
-- Mirrors the row-level assertions in
-- tests/v1/db/behavioural-features.dbtest.ts (PR#2 sections).
--
-- This is a FACTUAL invariant suite. NO scoring, NO classification, NO
-- judgement, NO reason-code emission. Refresh-loop columns are factual
-- candidate flags derived under fixed extraction thresholds (D-3):
--   N (REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS) = 3
--   W (REFRESH_LOOP_MAX_SPAN_MS)                = 10000
--   K (REFRESH_LOOP_MAX_ACTIONS_BETWEEN)         = 1
--
-- Each query below is a standalone read-only SELECT. Queries 0 and 1 are
-- presence guards — if either returns no row, the relevant column(s)
-- do not exist and the rest of the suite should be skipped.

-- ----------------------------------------------------------------------------
-- 0. Table presence guard
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 009 has not been applied to this DB.
-- Skip every query below in that case.

SELECT to_regclass('public.session_behavioural_features_v0_2') AS regclass;

-- ----------------------------------------------------------------------------
-- 1. PR#2 columns presence guard
-- ----------------------------------------------------------------------------
-- If ANY of the 8 PR#2 columns is missing, migration 010 has not been
-- applied. The expected count is 8 rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'session_behavioural_features_v0_2'
   AND column_name IN (
        'refresh_loop_candidate',
        'refresh_loop_count',
        'same_path_repeat_count',
        'same_path_repeat_max_span_ms',
        'same_path_repeat_min_delta_ms',
        'same_path_repeat_median_delta_ms',
        'repeat_pageview_candidate_count',
        'refresh_loop_source'
      )
 ORDER BY column_name;
-- Expected: 8 rows (one per column).

-- ============================================================================
-- Queries 2–10 are conditional on queries 0 and 1 succeeding. Operator
-- inspects those outputs and runs 2–10 only when both guards are green.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. v0.3 valid + missing = 13 (EXPECTED_FEATURE_COUNT_V0_3)
-- ----------------------------------------------------------------------------
-- v0.3 rows track 13 fields in feature_presence_map / feature_source_map
-- (12 v0.2 fields + refresh_loop_candidate). Expected: zero rows.

SELECT workspace_id, site_id, session_id, feature_version,
       valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE feature_version = 'behavioural-features-v0.3'
   AND valid_feature_count + missing_feature_count <> 13;

-- ----------------------------------------------------------------------------
-- 3. v0.2 baseline rows still satisfy 12 (regression guard)
-- ----------------------------------------------------------------------------
-- PR#2 must not corrupt v0.2 baseline rows. Expected: zero rows.

SELECT workspace_id, site_id, session_id, feature_version,
       valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE feature_version = 'behavioural-features-v0.2'
   AND valid_feature_count + missing_feature_count <> 12;

-- ----------------------------------------------------------------------------
-- 4. refresh_loop_candidate ↔ same_path_repeat_count invariant
-- ----------------------------------------------------------------------------
-- If refresh_loop_candidate = TRUE, the session contains at least one
-- same-path run with run_length >= N=3 (which forces
-- same_path_repeat_count >= 3 by construction; same_path_repeat_count is
-- MAX(run_length) per session).
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       refresh_loop_candidate, refresh_loop_count,
       same_path_repeat_count
  FROM session_behavioural_features_v0_2
 WHERE refresh_loop_candidate IS TRUE
   AND same_path_repeat_count < 3;

-- ----------------------------------------------------------------------------
-- 5. refresh_loop_count ↔ repeat_pageview_candidate_count invariant
-- ----------------------------------------------------------------------------
-- Each candidate streak contributes >= N=3 page_views to
-- repeat_pageview_candidate_count. So:
--   refresh_loop_count > 0 ==> repeat_pageview_candidate_count >= refresh_loop_count * 3
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       refresh_loop_count, repeat_pageview_candidate_count,
       refresh_loop_count * 3 AS required_min_candidate_pvs
  FROM session_behavioural_features_v0_2
 WHERE refresh_loop_count > 0
   AND repeat_pageview_candidate_count < refresh_loop_count * 3;

-- ----------------------------------------------------------------------------
-- 6. refresh_loop_candidate ↔ refresh_loop_count consistency
-- ----------------------------------------------------------------------------
-- refresh_loop_candidate is defined as (refresh_loop_count > 0).
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       refresh_loop_candidate, refresh_loop_count
  FROM session_behavioural_features_v0_2
 WHERE refresh_loop_candidate IS NOT NULL
   AND (
        (refresh_loop_candidate IS TRUE  AND refresh_loop_count = 0)
     OR (refresh_loop_candidate IS FALSE AND refresh_loop_count > 0)
   );

-- ----------------------------------------------------------------------------
-- 7. Span / delta non-negativity (no DB CHECK on BIGINT durations)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       same_path_repeat_max_span_ms,
       same_path_repeat_min_delta_ms,
       same_path_repeat_median_delta_ms
  FROM session_behavioural_features_v0_2
 WHERE (same_path_repeat_max_span_ms    IS NOT NULL AND same_path_repeat_max_span_ms    < 0)
    OR (same_path_repeat_min_delta_ms   IS NOT NULL AND same_path_repeat_min_delta_ms   < 0)
    OR (same_path_repeat_median_delta_ms IS NOT NULL AND same_path_repeat_median_delta_ms < 0);

-- ----------------------------------------------------------------------------
-- 8. refresh_loop_source enum (invariant SQL — NOT a DB CHECK constraint)
-- ----------------------------------------------------------------------------
-- PR#2 active output emits only 'server_derived' (D-4 Option alpha).
-- Future versions may introduce additional source values (e.g. 'replayed_from_evidence');
-- this query lists rows that fall outside the current PR#2 enum.
-- Expected: zero rows for PR#2-extracted v0.3 rows.

SELECT workspace_id, site_id, session_id, refresh_loop_source
  FROM session_behavioural_features_v0_2
 WHERE feature_version = 'behavioural-features-v0.3'
   AND refresh_loop_source IS NOT NULL
   AND refresh_loop_source <> 'server_derived';

-- ----------------------------------------------------------------------------
-- 9. NO judgement-implying refresh_loop_observed column
-- ----------------------------------------------------------------------------
-- D-2: the column name MUST be `refresh_loop_candidate` (factual marker),
-- never `refresh_loop_observed` (judgement implication).
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'session_behavioural_features_v0_2'
   AND column_name = 'refresh_loop_observed';

-- ----------------------------------------------------------------------------
-- 10. NO scoring / classification / agent columns alongside PR#2
-- ----------------------------------------------------------------------------
-- Belt-and-braces sweep — PR#2 must not introduce any judgement,
-- classification, or agent taxonomy alongside the factual columns.
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'session_behavioural_features_v0_2'
   AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed)';

-- ----------------------------------------------------------------------------
-- 11. Latest 20 v0.3 rows for one boundary — human inspection
-- ----------------------------------------------------------------------------
-- Parameterise <WORKSPACE_ID> and <SITE_ID> before running.

SELECT session_id,
       first_seen_at, last_seen_at, source_event_count,
       refresh_loop_candidate,
       refresh_loop_count,
       same_path_repeat_count,
       same_path_repeat_max_span_ms,
       same_path_repeat_min_delta_ms,
       same_path_repeat_median_delta_ms,
       repeat_pageview_candidate_count,
       refresh_loop_source,
       valid_feature_count, missing_feature_count
  FROM session_behavioural_features_v0_2
 WHERE workspace_id    = '<WORKSPACE_ID>'
   AND site_id         = '<SITE_ID>'
   AND feature_version = 'behavioural-features-v0.3'
 ORDER BY last_seen_at DESC NULLS LAST, session_id ASC
 LIMIT 20;
