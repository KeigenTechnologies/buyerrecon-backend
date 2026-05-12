-- Sprint 2 PR#3 verification — scoring_output_lane_b invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render
-- production without explicit approval per Architecture Gate A0 P-4
-- (still blocking).
--
-- Empty-DB PASS: PR#3 ships NO writer, so the table is empty on every
-- freshly migrated environment. Every anomaly query below trivially
-- returns 0 rows on an empty table. The presence + column-set + Hard
-- Rule I role privilege check evaluate independently of row count.

-- ----------------------------------------------------------------------------
-- 0. Presence guard
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 011 has not been applied. Skip 1-9.

SELECT to_regclass('public.scoring_output_lane_b') AS regclass;

-- ----------------------------------------------------------------------------
-- 1. Expected column set
-- ----------------------------------------------------------------------------
-- Returns one row per expected column. Operator confirms the set.

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_b'
 ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. verification_method enum (CHECK constraint backstop)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_b_id, workspace_id, site_id, session_id,
       verification_method
  FROM scoring_output_lane_b
 WHERE verification_method NOT IN
       ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none');

-- ----------------------------------------------------------------------------
-- 3. verification_method_strength MUST be NULL for every v1 row
-- ----------------------------------------------------------------------------
-- Reserved-not-emitted per signal-truth-v0.1 §11 + OD-6. Enforced at DB
-- layer via CHECK; this is a belt-and-braces invariant.
-- Expected: zero rows.

SELECT scoring_output_lane_b_id, workspace_id, site_id, session_id,
       verification_method_strength
  FROM scoring_output_lane_b
 WHERE verification_method_strength IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. reason_codes JSONB shape
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_b_id, workspace_id, site_id, session_id,
       jsonb_typeof(reason_codes) AS typ
  FROM scoring_output_lane_b
 WHERE jsonb_typeof(reason_codes) <> 'array';

-- ----------------------------------------------------------------------------
-- 5. evidence_refs JSONB shape
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT scoring_output_lane_b_id, workspace_id, site_id, session_id,
       jsonb_typeof(evidence_refs) AS typ
  FROM scoring_output_lane_b
 WHERE jsonb_typeof(evidence_refs) <> 'array';

-- ----------------------------------------------------------------------------
-- 6. Natural-key uniqueness
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, scoring_version, COUNT(*)
  FROM scoring_output_lane_b
 GROUP BY workspace_id, site_id, session_id, scoring_version
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 7. NO judgement-shaped column names; NO verification_score (Lane B is observation, not score)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_b'
   AND column_name ~ '(risk_score|buyer_score|intent_score|bot_score|human_score|fraud_score|verification_score|classification|recommended_action|confidence_band|is_bot|is_agent|ai_agent|is_human|buyer_intent|lead_quality|company_enrichment|ip_enrichment|verified|confirmed)';

-- ----------------------------------------------------------------------------
-- 8. NO `reason_code` (singular) column — only `reason_codes` (plural)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'scoring_output_lane_b'
   AND column_name = 'reason_code';

-- ----------------------------------------------------------------------------
-- 9. Hard Rule I: customer-facing role has ZERO SELECT on Lane B
-- ----------------------------------------------------------------------------
-- The single load-bearing post-migration invariant.
-- Expected: 'allowed' = FALSE.

SELECT has_table_privilege(
         'buyerrecon_customer_api'::name,
         'scoring_output_lane_b'::regclass,
         'SELECT'::text
       ) AS allowed_for_customer_api;

-- Belt-and-braces: customer-facing role has zero INSERT / UPDATE / DELETE either.
SELECT
  has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'INSERT'::text) AS allowed_insert,
  has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'UPDATE'::text) AS allowed_update,
  has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'DELETE'::text) AS allowed_delete;
-- Expected: all three FALSE.

-- Symmetric expectations for the scorer/readonly roles (informational):
SELECT
  has_table_privilege('buyerrecon_scoring_worker'::name,    'scoring_output_lane_b'::regclass, 'SELECT'::text) AS scoring_worker_select,
  has_table_privilege('buyerrecon_scoring_worker'::name,    'scoring_output_lane_b'::regclass, 'INSERT'::text) AS scoring_worker_insert,
  has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) AS readonly_select;
-- Expected: scoring_worker_select=t, scoring_worker_insert=t, readonly_select=t.

-- ----------------------------------------------------------------------------
-- 10. Latest 20 rows for one boundary — human inspection (optional)
-- ----------------------------------------------------------------------------
-- Parameterise <WORKSPACE_ID>, <SITE_ID> before running. Returns 0 rows
-- on an empty freshly-migrated DB — that is expected for PR#3 (no writer).

SELECT scoring_output_lane_b_id,
       session_id,
       scoring_version,
       agent_family,
       verification_method, verification_method_strength,
       reason_codes,
       evidence_refs,
       record_only,
       created_at, updated_at
  FROM scoring_output_lane_b
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
 ORDER BY created_at DESC NULLS LAST, scoring_output_lane_b_id ASC
 LIMIT 20;
