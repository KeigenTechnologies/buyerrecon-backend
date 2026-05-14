-- Sprint 2 PR#12d verification — poi_sequence_observations_v0_1 invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL / Hetzner staging only. NEVER
-- production. Mirrors the DB CHECK constraints defined in
-- migrations/015_poi_sequence_observations_v0_1.sql plus the
-- workflow-truth boundary from Helen OD-1..OD-14.
--
-- poi_sequence_observations_v0_1 is a durable POI-Sequence evidence
-- layer. Every row represents one in-session POI ordering record
-- derived from poi_observations_v0_1 by the PR#12d manual worker.
-- No scoring, no judgement, no customer-facing field. See
-- docs/sprint2-pr12c-poi-sequence-observations-table-worker-planning.md
-- (Helen-signed OD-1..OD-14).

-- 0. Table exists.
-- Expected: t (boolean true).
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name   = 'poi_sequence_observations_v0_1'
) AS table_present;
-- Expected: t.

-- 1. Natural-key uniqueness.
-- Expected: zero rows.
SELECT workspace_id, site_id, session_id,
       poi_sequence_version, poi_observation_version,
       COUNT(*)
  FROM poi_sequence_observations_v0_1
 GROUP BY workspace_id, site_id, session_id,
          poi_sequence_version, poi_observation_version
HAVING COUNT(*) > 1;
-- Expected: zero rows.

-- 2. poi_sequence_eligible MUST equal NOT stage0_excluded.
SELECT poi_sequence_observation_id, workspace_id, session_id,
       stage0_excluded, poi_sequence_eligible
  FROM poi_sequence_observations_v0_1
 WHERE poi_sequence_eligible <> (NOT stage0_excluded);
-- Expected: zero rows.

-- 3. poi_sequence_pattern_class enum.
SELECT poi_sequence_observation_id, poi_sequence_pattern_class
  FROM poi_sequence_observations_v0_1
 WHERE poi_sequence_pattern_class NOT IN (
   'single_poi','repeated_same_poi','multi_poi_linear',
   'loop_or_backtrack','insufficient_temporal_data','unknown'
 );
-- Expected: zero rows.

-- 4. has_progression = (unique_poi_count >= 2).
SELECT poi_sequence_observation_id, unique_poi_count, has_progression
  FROM poi_sequence_observations_v0_1
 WHERE has_progression <> (unique_poi_count >= 2);
-- Expected: zero rows.

-- 5. progression_depth = unique_poi_count.
SELECT poi_sequence_observation_id, unique_poi_count, progression_depth
  FROM poi_sequence_observations_v0_1
 WHERE progression_depth <> unique_poi_count;
-- Expected: zero rows.

-- 6. repeated_poi_count = poi_count - unique_poi_count.
SELECT poi_sequence_observation_id, poi_count, unique_poi_count, repeated_poi_count
  FROM poi_sequence_observations_v0_1
 WHERE repeated_poi_count <> (poi_count - unique_poi_count);
-- Expected: zero rows.

-- 7. has_repetition = (repeated_poi_count > 0).
SELECT poi_sequence_observation_id, repeated_poi_count, has_repetition
  FROM poi_sequence_observations_v0_1
 WHERE has_repetition <> (repeated_poi_count > 0);
-- Expected: zero rows.

-- 8. source_poi_observation_count = poi_count.
SELECT poi_sequence_observation_id, poi_count, source_poi_observation_count
  FROM poi_sequence_observations_v0_1
 WHERE source_poi_observation_count <> poi_count;
-- Expected: zero rows.

-- 9. Negative counts.
SELECT poi_sequence_observation_id, poi_count, unique_poi_count, repeated_poi_count
  FROM poi_sequence_observations_v0_1
 WHERE poi_count          < 1
    OR unique_poi_count   < 1
    OR unique_poi_count   > poi_count
    OR repeated_poi_count < 0;
-- Expected: zero rows.

-- 10. Timestamp ordering.
SELECT poi_sequence_observation_id, first_seen_at, last_seen_at,
       created_at, updated_at
  FROM poi_sequence_observations_v0_1
 WHERE (first_seen_at IS NOT NULL
        AND last_seen_at IS NOT NULL
        AND first_seen_at > last_seen_at)
    OR (created_at > updated_at);
-- Expected: zero rows.

-- 11. Negative duration.
SELECT poi_sequence_observation_id, duration_seconds
  FROM poi_sequence_observations_v0_1
 WHERE duration_seconds IS NOT NULL AND duration_seconds < 0;
-- Expected: zero rows.

-- 12. evidence_refs must be a non-empty JSONB array.
SELECT poi_sequence_observation_id, workspace_id, session_id,
       jsonb_typeof(evidence_refs) AS evidence_refs_type,
       jsonb_array_length(evidence_refs) AS evidence_refs_len
  FROM poi_sequence_observations_v0_1
 WHERE jsonb_typeof(evidence_refs) <> 'array'
    OR jsonb_array_length(evidence_refs) = 0;
-- Expected: zero rows.

-- 13. evidence_refs[].table MUST equal 'poi_observations_v0_1' for EVERY
-- entry (Helen OD-14: direct POI refs only; lower-layer lineage is
-- transitive through the referenced POI rows).
SELECT s.poi_sequence_observation_id,
       elem ->> 'table' AS forbidden_direct_table_value
  FROM poi_sequence_observations_v0_1 s,
       LATERAL jsonb_array_elements(s.evidence_refs) AS elem
 WHERE elem ->> 'table' IS DISTINCT FROM 'poi_observations_v0_1';
-- Expected: zero rows. Any row indicates the worker copied a
-- lower-layer ref (session_features, session_behavioural_features_v0_2,
-- stage0_decisions, or other) instead of the direct POI row ref.

-- 14. evidence_refs[].poi_observation_id MUST be a non-negative integer
-- (defence in depth — the worker upsert builder rejects malformed
-- entries before SQL).
SELECT s.poi_sequence_observation_id,
       elem -> 'poi_observation_id' AS bad_id
  FROM poi_sequence_observations_v0_1 s,
       LATERAL jsonb_array_elements(s.evidence_refs) AS elem
 WHERE (elem -> 'poi_observation_id') IS NULL
    OR jsonb_typeof(elem -> 'poi_observation_id') <> 'number'
    OR (elem ->> 'poi_observation_id')::bigint < 0;
-- Expected: zero rows.

-- 15. source_versions must be a JSONB object.
SELECT poi_sequence_observation_id,
       jsonb_typeof(source_versions) AS source_versions_type
  FROM poi_sequence_observations_v0_1
 WHERE jsonb_typeof(source_versions) <> 'object';
-- Expected: zero rows.

-- 16. Forbidden-column sweep (negative space). Any of these column
-- names appearing on poi_sequence_observations_v0_1 indicates a
-- forbidden scoring / verdict / Lane / Trust / Policy / PCF /
-- customer-facing / raw-URL / UA / IP / token / identity column
-- has been introduced. Mirrors the PR#11d FORBIDDEN_COLUMNS list.
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'poi_sequence_observations_v0_1'
   AND column_name IN (
     'risk_index','verification_score','evidence_band',
     'action_recommendation','reason_codes','reason_impacts',
     'triggered_tags','penalty_total',
     'lane_a','lane_b',
     'trust_decision','policy_decision','final_decision',
     'customer_facing','report','verdict',
     'buyer_intent','product_context_fit','buyer_role',
     'page_url','full_url','url_query','query',
     'raw_payload','payload','canonical_jsonb',
     'user_agent','ua','user_agent_family',
     'ip','ip_hash','asn_id','ip_company','ip_org',
     'token_hash','pepper','bearer','authorization','cookie','auth',
     'person_id','visitor_id','email_id','person_hash',
     'email_hash','email','phone',
     'company_id','domain_id','account_id',
     'device_fingerprint','font_list'
   );
-- Expected: zero rows.

-- 17. Lane A / Lane B parity (RECORD_ONLY; the PR#12d worker MUST NOT
-- touch lane tables). Run pre/post counts in the runbook and compare.
SELECT 'scoring_output_lane_a' AS t, COUNT(*) AS row_count
  FROM scoring_output_lane_a
UNION ALL
SELECT 'scoring_output_lane_b' AS t, COUNT(*) AS row_count
  FROM scoring_output_lane_b;
-- Expected: row_count values unchanged across pre-run vs post-run.

-- 18. POI row coverage parity — every distinct
-- (workspace_id, site_id, session_id) appearing on
-- poi_observations_v0_1 within the worker window MUST also appear
-- exactly once on poi_sequence_observations_v0_1 with matching
-- poi_observation_version (idempotency check).
SELECT poi_src.workspace_id, poi_src.site_id, poi_src.session_id
  FROM (
    SELECT DISTINCT workspace_id, site_id, session_id, poi_observation_version
      FROM poi_observations_v0_1
  ) poi_src
  LEFT JOIN poi_sequence_observations_v0_1 seq
    ON  seq.workspace_id            = poi_src.workspace_id
    AND seq.site_id                 = poi_src.site_id
    AND seq.session_id              = poi_src.session_id
    AND seq.poi_observation_version = poi_src.poi_observation_version
 WHERE seq.poi_sequence_observation_id IS NULL;
-- Expected: zero rows — every POI session has a corresponding
-- POI Sequence record. Non-zero indicates the worker did not cover
-- the full window (legitimate when running with WINDOW filters) OR
-- a per-row reject occurred (inspect the worker report's
-- reject_reasons counter).
