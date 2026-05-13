-- Sprint 2 PR#11c verification — poi_observations_v0_1 invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL / Hetzner staging only. NEVER
-- production. Mirrors the worker-side assertions in
-- tests/v1/poi-core-worker.test.ts + the DB CHECK constraints
-- defined in migrations/014_poi_observations_v0_1.sql.
--
-- poi_observations_v0_1 is a durable POI evidence layer. Every row
-- represents one successful `page_path` POI envelope built from a
-- `session_features` row by the PR#11c worker. No scoring, no
-- judgement, no customer-facing field. See
-- docs/sprint2-pr11c-poi-observations-table-worker-planning.md.

-- 1. Natural-key uniqueness.
-- Expected: zero rows (the UNIQUE constraint enforces this; this
-- check is defence-in-depth and should never return rows unless
-- the constraint is somehow disabled).
SELECT workspace_id, site_id, session_id, poi_type, poi_key,
       poi_input_version, poi_observation_version, extraction_version,
       COUNT(*)
  FROM poi_observations_v0_1
 GROUP BY workspace_id, site_id, session_id, poi_type, poi_key,
          poi_input_version, poi_observation_version, extraction_version
HAVING COUNT(*) > 1;
-- Expected: zero rows.

-- 2. poi_eligible MUST equal NOT stage0_excluded.
-- The DB CHECK constraint enforces this; the check below is
-- defence-in-depth.
SELECT poi_observation_id, workspace_id, session_id,
       stage0_excluded, poi_eligible
  FROM poi_observations_v0_1
 WHERE poi_eligible <> (NOT stage0_excluded);
-- Expected: zero rows.

-- 3. evidence_refs must be a non-empty JSONB array.
SELECT poi_observation_id, workspace_id, session_id,
       jsonb_typeof(evidence_refs) AS evidence_refs_type,
       jsonb_array_length(evidence_refs) AS evidence_refs_len
  FROM poi_observations_v0_1
 WHERE jsonb_typeof(evidence_refs) <> 'array'
    OR jsonb_array_length(evidence_refs) = 0;
-- Expected: zero rows.

-- 4. source_versions must be a JSONB object.
SELECT poi_observation_id, workspace_id, session_id,
       jsonb_typeof(source_versions) AS source_versions_type
  FROM poi_observations_v0_1
 WHERE jsonb_typeof(source_versions) <> 'object';
-- Expected: zero rows.

-- 5. v0.1 hard-coded enum constraints (DB CHECK defence-in-depth).
SELECT poi_observation_id, poi_type, source_table, poi_key_source_field,
       record_only
  FROM poi_observations_v0_1
 WHERE poi_type            <> 'page_path'
    OR source_table        <> 'session_features'
    OR poi_key_source_field NOT IN ('landing_page_path', 'last_page_path')
    OR record_only          IS NOT TRUE;
-- Expected: zero rows.

-- 6. source_event_count non-negative.
SELECT poi_observation_id, source_event_count
  FROM poi_observations_v0_1
 WHERE source_event_count < 0;
-- Expected: zero rows.

-- 7. Timestamp ordering.
SELECT poi_observation_id, first_seen_at, last_seen_at,
       created_at, updated_at
  FROM poi_observations_v0_1
 WHERE (first_seen_at IS NOT NULL
        AND last_seen_at IS NOT NULL
        AND first_seen_at > last_seen_at)
    OR (created_at > updated_at);
-- Expected: zero rows.

-- 8. poi_key must never contain a raw URL query string.
SELECT poi_observation_id, workspace_id, session_id, poi_key
  FROM poi_observations_v0_1
 WHERE poi_key LIKE '%?%'
    OR poi_key LIKE '%#%';
-- Expected: zero rows.

-- 9. Forbidden-column sweep on information_schema.columns.
-- These columns MUST NOT exist on poi_observations_v0_1. Returns one
-- row per offending column name (zero rows = invariant holds).
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'poi_observations_v0_1'
   AND column_name IN (
     -- Score / verdict / RiskOutput-shaped
     'risk_index', 'verification_score', 'evidence_band',
     'action_recommendation', 'reason_codes', 'reason_impacts',
     'triggered_tags', 'penalty_total',
     -- Lane A/B
     'lane_a', 'lane_b',
     -- Trust / Policy
     'trust_decision', 'policy_decision', 'final_decision',
     -- Customer-facing
     'customer_facing', 'report', 'verdict',
     -- Raw URL / payload
     'page_url', 'full_url', 'url_query', 'query',
     'raw_payload', 'payload', 'canonical_jsonb',
     -- UA / IP / token / pepper / auth
     'user_agent', 'ua', 'user_agent_family',
     'ip', 'ip_hash', 'asn_id', 'ip_company', 'ip_org',
     'token_hash', 'pepper', 'bearer', 'authorization', 'cookie', 'auth',
     -- Identity
     'person_id', 'visitor_id', 'email_id', 'person_hash',
     'email_hash', 'email', 'phone',
     'company_id', 'domain_id', 'account_id',
     'device_fingerprint', 'font_list',
     -- SBF-specific (OD-9 — kept in source_versions JSONB instead)
     'behavioural_feature_version'
   );
-- Expected: zero rows.

-- 10. Lane A/B parity (sanity check from the same verification file).
-- The PR#11c worker must NOT write to Lane A or Lane B. The counts
-- below should both equal what they were before the worker ran;
-- this query just surfaces the current count for operator review.
SELECT 'scoring_output_lane_a' AS table_name, COUNT(*) AS row_count
  FROM scoring_output_lane_a
UNION ALL
SELECT 'scoring_output_lane_b',               COUNT(*)
  FROM scoring_output_lane_b;
-- Expected: counts equal to the PRE-worker baseline.

-- 11. Stage 0 carry-through distribution (engineering inspection).
-- Surfaces how many rows landed with stage0_excluded=TRUE vs FALSE,
-- broken down by workspace_id/site_id. PR#11d table observer reads
-- this distribution back to the operator.
SELECT workspace_id, site_id,
       stage0_excluded,
       COUNT(*) AS row_count
  FROM poi_observations_v0_1
 GROUP BY workspace_id, site_id, stage0_excluded
 ORDER BY workspace_id, site_id, stage0_excluded;
-- Expected: non-empty (after a worker run); stage0_excluded=TRUE rows
-- must have poi_eligible=FALSE (verified by check #2).

-- 12. poi_key_source_field distribution.
SELECT workspace_id, site_id,
       poi_key_source_field,
       COUNT(*) AS row_count
  FROM poi_observations_v0_1
 GROUP BY workspace_id, site_id, poi_key_source_field
 ORDER BY workspace_id, site_id, poi_key_source_field;
-- Expected: non-empty after a worker run; values restricted to
-- 'landing_page_path' / 'last_page_path' (verified by check #5).

-- 13. evidence_refs lineage spot-check (defensive substring scan).
-- The PR#10 adapter's recursive forbidden-key sweep already rejects
-- these at envelope-build time, and the DB CHECK rejects empty
-- arrays. The check below scans the serialised JSONB for any
-- forbidden field-name token. Returns offending rows.
SELECT poi_observation_id, workspace_id, session_id,
       evidence_refs::text AS evidence_refs_text
  FROM poi_observations_v0_1
 WHERE evidence_refs::text ~* '"(raw_payload|payload|canonical_jsonb|page_url|full_url|url_query|user_agent|ua|ip_hash|token_hash|authorization|bearer|cookie|pepper|person_id|visitor_id|company_id|account_id|email|phone)"';
-- Expected: zero rows.

-- 14. Latest 20 rows for one boundary — for human inspection.
SELECT poi_observation_id,
       session_id,
       poi_type, poi_key, poi_surface_class,
       poi_input_version, poi_observation_version, extraction_version,
       source_table, source_row_id, poi_key_source_field,
       stage0_excluded, poi_eligible, stage0_rule_id,
       first_seen_at, last_seen_at, derived_at,
       created_at, updated_at
  FROM poi_observations_v0_1
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
 ORDER BY derived_at DESC, poi_observation_id DESC
 LIMIT 20;
