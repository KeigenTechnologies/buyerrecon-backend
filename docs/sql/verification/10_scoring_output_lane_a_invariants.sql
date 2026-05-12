-- Sprint 2 PR#3 verification — scoring_output_lane_a invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render
-- production without explicit approval per Architecture Gate A0 P-4
-- (still blocking).
--
-- Empty-DB PASS: PR#3 ships NO writer, so the table is empty on every
-- freshly migrated environment. Every anomaly query below trivially
-- returns 0 rows on an empty table. The presence + column-set + role
-- privilege checks evaluate independently of row count.

-- ----------------------------------------------------------------------------
-- 0. Presence guard
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 011 has not been applied. Skip 1-9.

SELECT to_regclass('public.scoring_output_lane_a') AS regclass;

-- ----------------------------------------------------------------------------
-- 1. Expected column set
-- ----------------------------------------------------------------------------
-- Returns one row per expected column. Operator confirms the set is
-- the full 15 columns from migration 011.

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_a'
 ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. Hard Rule A regression: evidence_band ∈ {low, medium}
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_a_id, workspace_id, site_id, session_id,
       scoring_version, evidence_band
  FROM scoring_output_lane_a
 WHERE evidence_band NOT IN ('low','medium');

-- ----------------------------------------------------------------------------
-- 3. Hard Rule B regression: action_recommendation ∈ {record_only, review}
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_a_id, workspace_id, site_id, session_id,
       scoring_version, action_recommendation
  FROM scoring_output_lane_a
 WHERE action_recommendation NOT IN ('record_only','review');

-- ----------------------------------------------------------------------------
-- 4. verification_score range guard
-- ----------------------------------------------------------------------------
-- Expected: zero rows. (CHECK constraint already enforces 0..99; this is
-- a belt-and-braces invariant SQL.)

SELECT scoring_output_lane_a_id, workspace_id, site_id, session_id,
       verification_score
  FROM scoring_output_lane_a
 WHERE verification_score < 0 OR verification_score > 99;

-- ----------------------------------------------------------------------------
-- 5. reason_codes JSONB shape
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_a_id, workspace_id, site_id, session_id,
       jsonb_typeof(reason_codes) AS typ
  FROM scoring_output_lane_a
 WHERE jsonb_typeof(reason_codes) <> 'array';

-- ----------------------------------------------------------------------------
-- 6. evidence_refs JSONB shape
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_a_id, workspace_id, site_id, session_id,
       jsonb_typeof(evidence_refs) AS typ
  FROM scoring_output_lane_a
 WHERE jsonb_typeof(evidence_refs) <> 'array';

-- ----------------------------------------------------------------------------
-- 7. Natural-key uniqueness
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, scoring_version, COUNT(*)
  FROM scoring_output_lane_a
 GROUP BY workspace_id, site_id, session_id, scoring_version
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 8. NO judgement-shaped column names beyond the allowed PR#3 carve-out
-- ----------------------------------------------------------------------------
-- The single allowed score-shaped column is `verification_score`
-- (Hard Rule A canonical contract column). Generic score-shaped names
-- must NOT exist on this table.
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_a'
   AND column_name ~ '(risk_score|buyer_score|intent_score|bot_score|human_score|fraud_score|classification|recommended_action|confidence_band|is_bot|is_agent|ai_agent|is_human|buyer_intent|lead_quality|company_enrichment|ip_enrichment|verified|confirmed)';

-- ----------------------------------------------------------------------------
-- 9. NO `reason_code` (singular) column — only `reason_codes` (plural)
-- ----------------------------------------------------------------------------
-- Expected: zero rows. (The plural column `reason_codes` is allowed.)

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_a'
   AND column_name = 'reason_code';

-- ----------------------------------------------------------------------------
-- 10. Role privilege — OD-7 baseline (customer-facing zero direct SELECT)
-- ----------------------------------------------------------------------------
-- OD-7 deferred the redacted Lane A customer-facing view; in PR#3 the
-- customer-facing role MUST have zero direct SELECT on the raw table.
-- Expected: 'allowed' = FALSE.

SELECT has_table_privilege(
         'buyerrecon_customer_api'::name,
         'scoring_output_lane_a'::regclass,
         'SELECT'::text
       ) AS allowed_for_customer_api;

-- Symmetric expectations (informational):
SELECT
  has_table_privilege('buyerrecon_scoring_worker'::name,    'scoring_output_lane_a'::regclass, 'SELECT'::text) AS scoring_worker_select,
  has_table_privilege('buyerrecon_scoring_worker'::name,    'scoring_output_lane_a'::regclass, 'INSERT'::text) AS scoring_worker_insert,
  has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_a'::regclass, 'SELECT'::text) AS readonly_select;
-- Expected: scoring_worker_select=t, scoring_worker_insert=t, readonly_select=t.

-- ----------------------------------------------------------------------------
-- 11. Latest 20 rows for one boundary — human inspection (optional)
-- ----------------------------------------------------------------------------
-- Parameterise <WORKSPACE_ID>, <SITE_ID> before running. Returns 0 rows
-- on an empty freshly-migrated DB — that is expected for PR#3 (no writer).

SELECT scoring_output_lane_a_id,
       session_id,
       scoring_version,
       verification_score, evidence_band, action_recommendation,
       reason_codes,
       evidence_refs,
       knob_version_id,
       record_only,
       created_at, updated_at
  FROM scoring_output_lane_a
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
 ORDER BY created_at DESC NULLS LAST, scoring_output_lane_a_id ASC
 LIMIT 20;
