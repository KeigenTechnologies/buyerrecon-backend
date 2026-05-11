-- Sprint 1 PR#11 verification — session_features invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors the assertions in tests/v1/db/session-features.dbtest.ts.
--
-- session_features is a derived factual layer. Every row aggregates raw
-- accepted_events for one (workspace_id, site_id, session_id, extraction_version)
-- tuple. No scoring, no classification, no bot/AI-agent taxonomy.

-- 1. Row presence and natural-key uniqueness.
-- Expected: no duplicates on the natural key.
SELECT workspace_id, site_id, session_id, extraction_version, COUNT(*)
  FROM session_features
 GROUP BY workspace_id, site_id, session_id, extraction_version
HAVING COUNT(*) > 1;
-- Expected: zero rows.

-- 2. canonical_key_count invariant for v1 events.
-- Expected: every row reports min = max = 19 (canonical_jsonb is the
-- 19-key projection per §2.5 line 168 contract).
SELECT workspace_id, site_id, session_id, extraction_version,
       canonical_key_count_min, canonical_key_count_max
  FROM session_features
 WHERE canonical_key_count_min IS NOT NULL
   AND (canonical_key_count_min <> 19 OR canonical_key_count_max <> 19);
-- Expected: zero rows.

-- 3. has_* flags consistent with counts.
SELECT workspace_id, session_id, has_cta_click, cta_click_count
  FROM session_features
 WHERE (has_cta_click = TRUE  AND cta_click_count = 0)
    OR (has_cta_click = FALSE AND cta_click_count > 0);
-- Expected: zero rows.

SELECT workspace_id, session_id, has_form_start, form_start_count
  FROM session_features
 WHERE (has_form_start = TRUE  AND form_start_count = 0)
    OR (has_form_start = FALSE AND form_start_count > 0);
-- Expected: zero rows.

SELECT workspace_id, session_id, has_form_submit, form_submit_count
  FROM session_features
 WHERE (has_form_submit = TRUE  AND form_submit_count = 0)
    OR (has_form_submit = FALSE AND form_submit_count > 0);
-- Expected: zero rows.

-- 4. source_event_count = sum of event_name_counts values (within v1 admit set).
-- Looser invariant: source_event_count >= sum of the four known event_name
-- counts. Equal when every event in the session had a known event_name.
SELECT workspace_id, session_id,
       source_event_count,
       page_view_count + cta_click_count + form_start_count + form_submit_count AS known_sum
  FROM session_features
 WHERE source_event_count < page_view_count + cta_click_count + form_start_count + form_submit_count;
-- Expected: zero rows.

-- 5. session_duration_ms = (last_seen_at - first_seen_at) in milliseconds.
SELECT workspace_id, session_id,
       session_duration_ms,
       (EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) * 1000)::bigint AS computed_duration_ms
  FROM session_features
 WHERE session_duration_ms <> (EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) * 1000)::bigint;
-- Expected: zero rows.

-- 6. landing/last event_id consistency.
-- first_event_id should be the row with first_seen_at; last_event_id the row
-- with last_seen_at. The extractor uses ROW_NUMBER with (received_at, event_id)
-- tie-break, so first_event_id ≤ last_event_id whenever they're both set.
SELECT workspace_id, session_id, first_event_id, last_event_id
  FROM session_features
 WHERE first_event_id IS NOT NULL AND last_event_id IS NOT NULL
   AND first_event_id > last_event_id;
-- Expected: zero rows.

-- 7. JSONB shape sanity.
SELECT workspace_id, session_id,
       jsonb_typeof(event_name_counts)     AS event_name_counts_type,
       jsonb_typeof(schema_key_counts)     AS schema_key_counts_type,
       jsonb_typeof(consent_source_counts) AS consent_source_counts_type
  FROM session_features
 WHERE jsonb_typeof(event_name_counts)     <> 'object'
    OR jsonb_typeof(schema_key_counts)     <> 'object'
    OR jsonb_typeof(consent_source_counts) <> 'object';
-- Expected: zero rows.

-- 8. Cross-table sanity — session_features.source_event_count should equal
-- the count of matching v1 browser accepted_events for that session.
-- (Parameterise by a single boundary before running.)
SELECT sf.workspace_id, sf.site_id, sf.session_id,
       sf.source_event_count,
       (
         SELECT COUNT(*)::int
           FROM accepted_events ae
          WHERE ae.workspace_id = sf.workspace_id
            AND ae.site_id      = sf.site_id
            AND ae.session_id   = sf.session_id
            AND ae.event_contract_version = 'event-contract-v0.1'
            AND ae.event_origin = 'browser'
            AND ae.session_id  <> '__server__'
       ) AS accepted_actual
  FROM session_features sf
 WHERE sf.workspace_id = '<WORKSPACE_ID>'
   AND sf.site_id      = '<SITE_ID>'
   AND sf.extraction_version = 'session-features-v0.1'
   AND sf.source_event_count <> (
         SELECT COUNT(*)::int
           FROM accepted_events ae
          WHERE ae.workspace_id = sf.workspace_id
            AND ae.site_id      = sf.site_id
            AND ae.session_id   = sf.session_id
            AND ae.event_contract_version = 'event-contract-v0.1'
            AND ae.event_origin = 'browser'
            AND ae.session_id  <> '__server__'
       );
-- Expected: zero rows.

-- 9. Latest 20 session_features rows for one boundary — for human inspection.
SELECT session_id,
       first_seen_at,
       last_seen_at,
       session_duration_ms,
       source_event_count,
       page_view_count, cta_click_count, form_start_count, form_submit_count,
       unique_path_count,
       landing_page_path, last_page_path,
       event_name_counts
  FROM session_features
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
   AND extraction_version = 'session-features-v0.1'
 ORDER BY last_seen_at DESC
 LIMIT 20;
