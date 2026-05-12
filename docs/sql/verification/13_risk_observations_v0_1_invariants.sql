-- Sprint 2 PR#6 verification — risk_observations_v0_1 invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render
-- production without explicit approval per Architecture Gate A0 P-4
-- (still blocking).
--
-- Operator-scoped queries (sections 14 + 17) use psql variables for
-- workspace + site. Safe run pattern (psql escapes the quoted values
-- with -v VAR='value' / :'VAR'):
--
--   psql "$DATABASE_URL" \
--     -v WORKSPACE_ID="<ws>" \
--     -v SITE_ID="<site>" \
--     -f docs/sql/verification/13_risk_observations_v0_1_invariants.sql
--
-- The empty-DB / global invariant queries (sections 0–13, 15, 16) do
-- not need the variables and run unconditionally.
--
-- Empty-DB PASS: every anomaly query below returns 0 rows on an
-- empty freshly migrated DB. Presence + column-set + role-privilege
-- checks evaluate independently of row count.

-- ----------------------------------------------------------------------------
-- 0. Presence guard
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 013 has not been applied.

SELECT to_regclass('public.risk_observations_v0_1') AS regclass;

-- ----------------------------------------------------------------------------
-- 1. Expected column set
-- ----------------------------------------------------------------------------

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'risk_observations_v0_1'
 ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. Natural-key uniqueness (5-column key per D-14)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, observation_version, scoring_version,
       COUNT(*) AS dups
  FROM risk_observations_v0_1
 GROUP BY workspace_id, site_id, session_id, observation_version, scoring_version
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 3. record_only must always be TRUE
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT risk_observation_id, workspace_id, site_id, session_id, record_only
  FROM risk_observations_v0_1
 WHERE record_only IS DISTINCT FROM TRUE;

-- ----------------------------------------------------------------------------
-- 4. behavioural_risk_01 / *_risk_01 range invariants
-- ----------------------------------------------------------------------------
-- Expected: zero rows for each. The DB CHECK already enforces [0,1];
-- the SQL is a belt-and-braces guard against constraint drift.

SELECT risk_observation_id, workspace_id, site_id, session_id, behavioural_risk_01
  FROM risk_observations_v0_1
 WHERE behavioural_risk_01 < 0 OR behavioural_risk_01 > 1;

SELECT risk_observation_id, workspace_id, site_id, session_id, device_risk_01
  FROM risk_observations_v0_1
 WHERE device_risk_01 < 0 OR device_risk_01 > 1;

SELECT risk_observation_id, workspace_id, site_id, session_id, network_risk_01
  FROM risk_observations_v0_1
 WHERE network_risk_01 < 0 OR network_risk_01 > 1;

SELECT risk_observation_id, workspace_id, site_id, session_id, identity_risk_01
  FROM risk_observations_v0_1
 WHERE identity_risk_01 < 0 OR identity_risk_01 > 1;

-- ----------------------------------------------------------------------------
-- 5. source_event_count non-negative
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT risk_observation_id, workspace_id, site_id, session_id, source_event_count
  FROM risk_observations_v0_1
 WHERE source_event_count < 0;

-- ----------------------------------------------------------------------------
-- 6. JSONB shape — velocity object, tags array, evidence_refs array
-- ----------------------------------------------------------------------------
-- Expected: zero rows for each.

SELECT risk_observation_id, jsonb_typeof(velocity) AS typ
  FROM risk_observations_v0_1
 WHERE jsonb_typeof(velocity) <> 'object';

SELECT risk_observation_id, jsonb_typeof(tags) AS typ
  FROM risk_observations_v0_1
 WHERE jsonb_typeof(tags) <> 'array';

SELECT risk_observation_id, jsonb_typeof(evidence_refs) AS typ
  FROM risk_observations_v0_1
 WHERE jsonb_typeof(evidence_refs) <> 'array';

-- ----------------------------------------------------------------------------
-- 7. tags — every element is a string in the allowed enum
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

WITH expanded AS (
  SELECT r.risk_observation_id, r.workspace_id, r.site_id, r.session_id,
         elem.value AS tag_value, jsonb_typeof(elem.value) AS tag_type
    FROM risk_observations_v0_1 r,
         LATERAL jsonb_array_elements(r.tags) AS elem(value)
)
SELECT risk_observation_id, workspace_id, site_id, session_id, tag_value
  FROM expanded
 WHERE tag_type <> 'string'
    OR (tag_value #>> '{}') NOT IN (
        'REFRESH_LOOP_CANDIDATE',
        'HIGH_REQUEST_BURST',
        'ZERO_FOREGROUND_TIME',
        'NO_MEANINGFUL_INTERACTION',
        'JS_NOT_EXECUTED',
        'SUB_200MS_TRANSITION_RUN',
        'BEHAVIOURAL_CADENCE_ANOMALY',
        'BYTESPIDER_PASSTHROUGH'
      );

-- ----------------------------------------------------------------------------
-- 8. tags — forbidden prefix sweep (no A_*, B_*, REVIEW_*, OBS_*, UX_*, RISK.*)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

WITH expanded AS (
  SELECT r.risk_observation_id, r.workspace_id, r.site_id, r.session_id,
         (elem.value #>> '{}') AS tag_text
    FROM risk_observations_v0_1 r,
         LATERAL jsonb_array_elements(r.tags) AS elem(value)
)
SELECT risk_observation_id, workspace_id, site_id, session_id, tag_text
  FROM expanded
 WHERE tag_text ~ '^(A_|B_|REVIEW_|OBS_|UX_)'
    OR tag_text LIKE 'RISK.%'
    OR tag_text ~ '_(CONFIRMED|VERIFIED|CERTAIN|DETECTED|IDENTIFIED)$'
    OR tag_text ~ '^(BUYER_|INTENT_|REAL_BUYER_|A_REAL_BUYER_)';

-- ----------------------------------------------------------------------------
-- 9. tags — cardinality cap (max 16 per session)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT risk_observation_id, workspace_id, site_id, session_id,
       jsonb_array_length(tags) AS tag_count
  FROM risk_observations_v0_1
 WHERE jsonb_array_length(tags) > 16;

-- ----------------------------------------------------------------------------
-- 10. velocity / evidence_refs — forbidden-key sweep (PR#5 OD-11 parity)
-- ----------------------------------------------------------------------------
-- Expected: zero rows for each.

SELECT risk_observation_id, workspace_id, site_id, session_id,
       k AS forbidden_key
  FROM risk_observations_v0_1,
       LATERAL jsonb_object_keys(velocity) AS k
 WHERE k IN (
        'raw_user_agent',
        'user_agent',
        'token_hash',
        'ip_hash',
        'pepper',
        'bearer_token',
        'bearer',
        'authorization',
        'Authorization',
        'raw_payload',
        'raw_request_body',
        'request_body',
        'canonical_jsonb',
        'raw_page_url',
        'page_url'
      );

WITH ev AS (
  SELECT r.risk_observation_id, r.workspace_id, r.site_id, r.session_id,
         elem.value AS ev_obj
    FROM risk_observations_v0_1 r,
         LATERAL jsonb_array_elements(r.evidence_refs) AS elem(value)
)
SELECT risk_observation_id, workspace_id, site_id, session_id, k AS forbidden_key
  FROM ev,
       LATERAL jsonb_object_keys(ev_obj) AS k
 WHERE jsonb_typeof(ev_obj) = 'object'
   AND k IN (
        'raw_user_agent',
        'user_agent',
        'token_hash',
        'ip_hash',
        'pepper',
        'bearer_token',
        'bearer',
        'authorization',
        'Authorization',
        'raw_payload',
        'raw_request_body',
        'request_body',
        'canonical_jsonb',
        'raw_page_url',
        'page_url'
      );

-- ----------------------------------------------------------------------------
-- 11. NO forbidden columns on risk_observations_v0_1
-- ----------------------------------------------------------------------------
-- Expected: zero rows. These columns are AMS Risk Core RiskOutput /
-- Policy Pass 1 / ProductDecision territory — they MUST NOT appear
-- on PR#6's evidence-layer table.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'risk_observations_v0_1'
   AND column_name IN (
        'risk_index',
        'verification_score',
        'evidence_band',
        'action_recommendation',
        'reason_codes',
        'reason_impacts',
        'triggered_tags',
        'penalty_total',
        'risk_score',
        'classification',
        'confidence_band',
        'is_bot',
        'is_agent',
        'ai_agent',
        'buyer_intent',
        'lead_quality',
        'recommended_action',
        'final_decision',
        'trust_decision',
        'policy_decision'
      );

-- ----------------------------------------------------------------------------
-- 12. Hard-Rule-I parity — customer-API role has zero SELECT
-- ----------------------------------------------------------------------------
-- Expected: allowed = FALSE.

SELECT has_table_privilege(
         'buyerrecon_customer_api'::name,
         'risk_observations_v0_1'::regclass,
         'SELECT'::text
       ) AS allowed_for_customer_api;

-- Belt-and-braces: customer-API holds zero INSERT / UPDATE / DELETE.
SELECT
  has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'INSERT'::text) AS allowed_insert,
  has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'UPDATE'::text) AS allowed_update,
  has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'DELETE'::text) AS allowed_delete;
-- Expected: all three FALSE.

-- Symmetric expectations for scorer/readonly (informational):
SELECT
  has_table_privilege('buyerrecon_scoring_worker'::name,    'risk_observations_v0_1'::regclass, 'SELECT'::text) AS scoring_worker_select,
  has_table_privilege('buyerrecon_scoring_worker'::name,    'risk_observations_v0_1'::regclass, 'INSERT'::text) AS scoring_worker_insert,
  has_table_privilege('buyerrecon_scoring_worker'::name,    'risk_observations_v0_1'::regclass, 'UPDATE'::text) AS scoring_worker_update,
  has_table_privilege('buyerrecon_internal_readonly'::name, 'risk_observations_v0_1'::regclass, 'SELECT'::text) AS readonly_select;
-- Expected: scoring_worker_*=t, readonly_select=t.

-- ----------------------------------------------------------------------------
-- 13. Stage 0 eligibility invariant — every risk_observations_v0_1 row
--     must have a matching stage0_decisions row with excluded = FALSE
--     for the same (workspace, site, session).
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT r.risk_observation_id, r.workspace_id, r.site_id, r.session_id
  FROM risk_observations_v0_1 r
 WHERE NOT EXISTS (
   SELECT 1 FROM stage0_decisions s
    WHERE s.workspace_id = r.workspace_id
      AND s.site_id      = r.site_id
      AND s.session_id   = r.session_id
      AND s.excluded     = FALSE
 );

-- ----------------------------------------------------------------------------
-- 14. PR#6 produced zero Lane A / Lane B writes (cross-table diagnostic)
-- ----------------------------------------------------------------------------
-- This invariant SQL is a *belt-and-braces* check. PR#6 source contains
-- no `INSERT INTO scoring_output_lane_a` / `_b` (verified by pure tests),
-- so the production-side diagnostic is the row counts staying constant
-- before/after a PR#6 worker run. Operator scopes the query per workspace
-- via the psql variable WORKSPACE_ID (see run pattern at top of file).

SELECT
  (SELECT COUNT(*)::int FROM risk_observations_v0_1 WHERE workspace_id = :'WORKSPACE_ID') AS risk_obs_rows,
  (SELECT COUNT(*)::int FROM scoring_output_lane_a  WHERE workspace_id = :'WORKSPACE_ID') AS lane_a_rows,
  (SELECT COUNT(*)::int FROM scoring_output_lane_b  WHERE workspace_id = :'WORKSPACE_ID') AS lane_b_rows;
-- Expected: risk_obs_rows >= 0; lane_a_rows AND lane_b_rows are PR#6 / PR#3b's
-- responsibility — PR#6 itself contributes nothing to them.

-- ----------------------------------------------------------------------------
-- 15. BYTESPIDER_PASSTHROUGH discipline (Codex non-blocking note #2)
-- ----------------------------------------------------------------------------
-- For every risk_observations_v0_1 row carrying BYTESPIDER_PASSTHROUGH:
--   - the matching stage0_decisions row's `excluded` MUST be FALSE
--     (PR#5 allowed the session through),
--   - the matching session must NOT appear in scoring_output_lane_b.
-- Expected: zero rows for each.

WITH passthrough AS (
  SELECT r.workspace_id, r.site_id, r.session_id, r.risk_observation_id
    FROM risk_observations_v0_1 r
   WHERE EXISTS (
     SELECT 1 FROM jsonb_array_elements_text(r.tags) AS t(v)
      WHERE t.v = 'BYTESPIDER_PASSTHROUGH'
   )
)
SELECT p.risk_observation_id, p.workspace_id, p.site_id, p.session_id
  FROM passthrough p
 WHERE NOT EXISTS (
   SELECT 1 FROM stage0_decisions s
    WHERE s.workspace_id = p.workspace_id
      AND s.site_id      = p.site_id
      AND s.session_id   = p.session_id
      AND s.excluded     = FALSE
 );

WITH passthrough AS (
  SELECT r.workspace_id, r.site_id, r.session_id, r.risk_observation_id
    FROM risk_observations_v0_1 r
   WHERE EXISTS (
     SELECT 1 FROM jsonb_array_elements_text(r.tags) AS t(v)
      WHERE t.v = 'BYTESPIDER_PASSTHROUGH'
   )
)
SELECT p.risk_observation_id, p.workspace_id, p.site_id, p.session_id
  FROM passthrough p
  JOIN scoring_output_lane_b b
    ON  b.workspace_id = p.workspace_id
    AND b.site_id      = p.site_id
    AND b.session_id   = p.session_id;

-- ----------------------------------------------------------------------------
-- 16. risk_observations_v0_1 summary — operator-facing
-- ----------------------------------------------------------------------------

SELECT observation_version, scoring_version,
       COUNT(*)::int AS rows,
       MIN(behavioural_risk_01)::numeric(4,3) AS min_br01,
       MAX(behavioural_risk_01)::numeric(4,3) AS max_br01,
       AVG(behavioural_risk_01)::numeric(5,4) AS avg_br01
  FROM risk_observations_v0_1
 GROUP BY observation_version, scoring_version
 ORDER BY observation_version, scoring_version;

-- ----------------------------------------------------------------------------
-- 17. Latest 20 rows for one boundary — human inspection
-- ----------------------------------------------------------------------------
-- Operator-scoped via psql variables WORKSPACE_ID + SITE_ID (see run
-- pattern at top of file). Returns 0 rows on an empty freshly migrated
-- DB. No raw secrets are projected.

SELECT risk_observation_id,
       session_id,
       observation_version,
       scoring_version,
       behavioural_risk_01,
       device_risk_01,
       network_risk_01,
       identity_risk_01,
       velocity,
       tags,
       source_event_count,
       evidence_refs,
       record_only,
       created_at, updated_at
  FROM risk_observations_v0_1
 WHERE workspace_id = :'WORKSPACE_ID'
   AND site_id      = :'SITE_ID'
 ORDER BY created_at DESC NULLS LAST, risk_observation_id ASC
 LIMIT 20;
