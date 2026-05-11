-- Sprint 2 PR#1 verification — session_behavioural_features_v0_2 invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render production
-- without explicit approval per Architecture Gate A0 P-4 (still blocking).
-- Mirrors the row-level assertions in
-- tests/v1/db/behavioural-features.dbtest.ts.
--
-- This table is a derived factual layer. Every row aggregates raw
-- accepted_events for one (workspace_id, site_id, session_id,
-- feature_version) tuple. NO scoring, NO classification, NO bot/AI-agent
-- taxonomy, NO reason-code emission. Refresh-loop server-side derivation
-- is DEFERRED to Sprint 2 PR#2.
--
-- Each query below is a standalone read-only SELECT. The first query is
-- a `to_regclass` presence guard: if it returns NULL, the table does not
-- exist yet (migration 009 not applied) — operator should skip the rest.

-- ----------------------------------------------------------------------------
-- 0. Presence guard (always safe to run)
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 009 has not been applied to this DB.
-- Skip every query below in that case.

SELECT to_regclass('public.session_behavioural_features_v0_2') AS regclass;

-- ============================================================================
-- The queries below are conditional on table presence. Operator inspects
-- query 0's output and runs queries 1-10 only if regclass IS NOT NULL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Natural-key uniqueness
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, feature_version, COUNT(*)
  FROM session_behavioural_features_v0_2
 GROUP BY workspace_id, site_id, session_id, feature_version
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 2. valid_feature_count + missing_feature_count = 12 (EXPECTED_FEATURE_COUNT_V0_2)
-- ----------------------------------------------------------------------------
-- Expected: zero rows. v0.2 tracks exactly 12 fields in
-- feature_presence_map / feature_source_map.

SELECT workspace_id, site_id, session_id, feature_version,
       valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE feature_version = 'behavioural-features-v0.2'
   AND valid_feature_count + missing_feature_count <> 12;

-- ----------------------------------------------------------------------------
-- 3. last_seen_at >= first_seen_at (duration non-negative)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, first_seen_at, last_seen_at
  FROM session_behavioural_features_v0_2
 WHERE first_seen_at IS NOT NULL
   AND last_seen_at  IS NOT NULL
   AND last_seen_at < first_seen_at;

-- ----------------------------------------------------------------------------
-- 4. Bucket enum validity (invariant SQL — NOT a DB CHECK constraint)
-- ----------------------------------------------------------------------------
-- v0.2 bucket boundaries. Future feature_versions may evolve buckets;
-- those rows would be visible here if the validator is rerun against a
-- mixed-version table.

SELECT workspace_id, site_id, session_id, interaction_density_bucket
  FROM session_behavioural_features_v0_2
 WHERE interaction_density_bucket IS NOT NULL
   AND interaction_density_bucket NOT IN ('0','1-2','3-5','6-10','>10');
-- Expected: zero rows for feature_version='behavioural-features-v0.2'.

SELECT workspace_id, site_id, session_id, scroll_depth_bucket_before_first_cta
  FROM session_behavioural_features_v0_2
 WHERE scroll_depth_bucket_before_first_cta IS NOT NULL
   AND scroll_depth_bucket_before_first_cta NOT IN
       ('0','1-25','26-50','51-75','76-100');
-- Expected: zero rows. (In v0.2 the column is always NULL.)

-- ----------------------------------------------------------------------------
-- 5. Boolean / count consistency for form_submit anomaly
-- ----------------------------------------------------------------------------
-- has_form_submit_without_prior_form_start is TRUE iff
-- form_submit_count_before_first_form_start > 0.
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       has_form_submit_without_prior_form_start,
       form_submit_count_before_first_form_start
  FROM session_behavioural_features_v0_2
 WHERE (    has_form_submit_without_prior_form_start  = TRUE
        AND form_submit_count_before_first_form_start = 0)
    OR (    has_form_submit_without_prior_form_start  = FALSE
        AND form_submit_count_before_first_form_start > 0);

-- ----------------------------------------------------------------------------
-- 6. source_event_count vs full-session accepted_events count
-- ----------------------------------------------------------------------------
-- Cross-table invariant: every behavioural_features row's
-- source_event_count must equal the full-session count of matching
-- v1 browser accepted_events for that (workspace_id, site_id, session_id).
-- Parameterise by a single boundary before running.
-- Expected: zero rows.

SELECT sbf.workspace_id, sbf.site_id, sbf.session_id,
       sbf.source_event_count AS sbf_count,
       (
         SELECT COUNT(*)::int
           FROM accepted_events ae
          WHERE ae.workspace_id = sbf.workspace_id
            AND ae.site_id      = sbf.site_id
            AND ae.session_id   = sbf.session_id
            AND ae.event_contract_version = 'event-contract-v0.1'
            AND ae.event_origin = 'browser'
            AND ae.session_id  <> '__server__'
       ) AS accepted_actual
  FROM session_behavioural_features_v0_2 sbf
 WHERE sbf.workspace_id    = '<WORKSPACE_ID>'
   AND sbf.site_id         = '<SITE_ID>'
   AND sbf.feature_version = 'behavioural-features-v0.2'
   AND sbf.source_event_count <> (
         SELECT COUNT(*)::int
           FROM accepted_events ae
          WHERE ae.workspace_id = sbf.workspace_id
            AND ae.site_id      = sbf.site_id
            AND ae.session_id   = sbf.session_id
            AND ae.event_contract_version = 'event-contract-v0.1'
            AND ae.event_origin = 'browser'
            AND ae.session_id  <> '__server__'
       );

-- ----------------------------------------------------------------------------
-- 7. JSONB shape sanity for feature_presence_map and feature_source_map
-- ----------------------------------------------------------------------------
-- Both must be JSONB objects.
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id,
       jsonb_typeof(feature_presence_map) AS presence_type,
       jsonb_typeof(feature_source_map)   AS source_type
  FROM session_behavioural_features_v0_2
 WHERE jsonb_typeof(feature_presence_map) <> 'object'
    OR jsonb_typeof(feature_source_map)   <> 'object';

-- ----------------------------------------------------------------------------
-- 8. Non-negative counts and durations
-- ----------------------------------------------------------------------------
-- The DB CHECK constraints already guard most of these, but the SQL is
-- belt-and-braces for the BIGINT duration fields (no DB CHECK).
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id
  FROM session_behavioural_features_v0_2
 WHERE source_event_count                            < 0
    OR valid_feature_count                           < 0
    OR missing_feature_count                         < 0
    OR pageview_burst_count_10s                      < 0
    OR max_events_per_second                         < 0
    OR sub_200ms_transition_count                    < 0
    OR form_start_count_before_first_cta             < 0
    OR form_submit_count_before_first_form_start     < 0
    OR (ms_from_consent_to_first_cta IS NOT NULL  AND ms_from_consent_to_first_cta  < 0)
    OR (dwell_ms_before_first_action IS NOT NULL  AND dwell_ms_before_first_action  < 0)
    OR (ms_between_pageviews_p50     IS NOT NULL  AND ms_between_pageviews_p50      < 0);

-- ----------------------------------------------------------------------------
-- 9. NO scoring / judgement columns present
-- ----------------------------------------------------------------------------
-- Expected: zero rows. v0.2 is a factual layer; no scoring fields exist.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'session_behavioural_features_v0_2'
   AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed)';

-- ----------------------------------------------------------------------------
-- 10. Latest 20 rows for one boundary — human inspection
-- ----------------------------------------------------------------------------
-- Parameterise <WORKSPACE_ID> and <SITE_ID> before running.

SELECT session_id,
       first_seen_at, last_seen_at, source_event_count,
       ms_from_consent_to_first_cta,
       dwell_ms_before_first_action,
       first_form_start_precedes_first_cta,
       form_start_count_before_first_cta,
       has_form_submit_without_prior_form_start,
       form_submit_count_before_first_form_start,
       ms_between_pageviews_p50,
       pageview_burst_count_10s,
       max_events_per_second,
       sub_200ms_transition_count,
       interaction_density_bucket,
       scroll_depth_bucket_before_first_cta,
       valid_feature_count, missing_feature_count,
       feature_presence_map, feature_source_map
  FROM session_behavioural_features_v0_2
 WHERE workspace_id    = '<WORKSPACE_ID>'
   AND site_id         = '<SITE_ID>'
   AND feature_version = 'behavioural-features-v0.2'
 ORDER BY last_seen_at DESC NULLS LAST, session_id ASC
 LIMIT 20;
