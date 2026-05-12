-- Sprint 2 PR#5 verification — stage0_decisions invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging mirror. NEVER Render
-- production without explicit approval per Architecture Gate A0 P-4
-- (still blocking).
--
-- Empty-DB PASS: every anomaly query below returns 0 rows on an
-- empty freshly migrated DB. Presence + column-set + role-privilege
-- checks evaluate independently of row count.

-- ----------------------------------------------------------------------------
-- 0. Presence guard
-- ----------------------------------------------------------------------------
-- If `regclass` is NULL, migration 012 has not been applied.

SELECT to_regclass('public.stage0_decisions') AS regclass;

-- ----------------------------------------------------------------------------
-- 1. Expected column set
-- ----------------------------------------------------------------------------

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'stage0_decisions'
 ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. Natural-key uniqueness (5-column key per OD-10)
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT workspace_id, site_id, session_id, stage0_version, scoring_version,
       COUNT(*) AS dups
  FROM stage0_decisions
 GROUP BY workspace_id, site_id, session_id, stage0_version, scoring_version
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 3. record_only must always be TRUE
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT stage0_decision_id, workspace_id, site_id, session_id, record_only
  FROM stage0_decisions
 WHERE record_only IS DISTINCT FROM TRUE;

-- ----------------------------------------------------------------------------
-- 4. rule_id enum membership
-- ----------------------------------------------------------------------------
-- Expected: zero rows. The DB CHECK already enforces the enum, but a
-- belt-and-braces invariant SQL guards against constraint drift.

SELECT stage0_decision_id, workspace_id, site_id, session_id, rule_id
  FROM stage0_decisions
 WHERE rule_id NOT IN (
        'no_stage0_exclusion',
        'webdriver_global_present',
        'automation_globals_detected',
        'known_bot_ua_family',
        'scanner_or_probe_path',
        'impossible_request_frequency',
        'non_browser_runtime',
        'attack_like_request_pattern'
      );

-- ----------------------------------------------------------------------------
-- 5. excluded ↔ rule_id co-invariant
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT stage0_decision_id, workspace_id, site_id, session_id, excluded, rule_id
  FROM stage0_decisions
 WHERE (excluded = TRUE  AND rule_id = 'no_stage0_exclusion')
    OR (excluded = FALSE AND rule_id <> 'no_stage0_exclusion');

-- ----------------------------------------------------------------------------
-- 6. JSONB shape — rule_inputs is an object, evidence_refs is an array
-- ----------------------------------------------------------------------------
-- Expected: zero rows for each.

SELECT stage0_decision_id, jsonb_typeof(rule_inputs) AS typ
  FROM stage0_decisions
 WHERE jsonb_typeof(rule_inputs) <> 'object';

SELECT stage0_decision_id, jsonb_typeof(evidence_refs) AS typ
  FROM stage0_decisions
 WHERE jsonb_typeof(evidence_refs) <> 'array';

-- ----------------------------------------------------------------------------
-- 7. rule_inputs forbidden-key sweep (OD-11)
-- ----------------------------------------------------------------------------
-- Per OD-11 + PR#5 §6.6.2: rule_inputs MUST NOT contain raw UA /
-- token_hash / ip_hash / pepper / bearer / authorization / raw_payload
-- / raw_request_body / canonical_jsonb / raw_page_url keys, AND must
-- not contain matched_rules / ai_crawler_passthrough / zero_engagement
-- (added per Codex blocker fix — outside the Helen-signed OD-11
-- allowlist).
--
-- The SQL walks TOP-LEVEL keys only. PR#5 rule_inputs is a flat
-- object by construction (the adapter writes only scalar values from
-- the OD-11 allowlist), so top-level-key scanning is sufficient.
-- If a future PR introduces nested rule_inputs, this query must be
-- upgraded to use `jsonb_path_query` for recursive walking.
--
-- Expected: zero rows.

SELECT stage0_decision_id, workspace_id, site_id, session_id, k AS forbidden_key
  FROM stage0_decisions,
       LATERAL jsonb_object_keys(rule_inputs) AS k
 WHERE k IN (
        -- Privacy / auth secrets
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
        -- Codex blocker fix: outside the signed OD-11 allowlist
        'matched_rules',
        'ai_crawler_passthrough',
        'zero_engagement'
      );

-- ----------------------------------------------------------------------------
-- 8. source_event_count non-negative
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT stage0_decision_id, workspace_id, site_id, session_id, source_event_count
  FROM stage0_decisions
 WHERE source_event_count < 0;

-- ----------------------------------------------------------------------------
-- 9. NO forbidden columns on stage0_decisions
-- ----------------------------------------------------------------------------
-- Expected: zero rows.

SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'stage0_decisions'
   AND column_name IN (
        'verification_score',
        'evidence_band',
        'action_recommendation',
        'reason_codes',
        'risk_score',
        'classification',
        'confidence_band',
        'is_bot',
        'is_agent',
        'ai_agent',
        'buyer_intent',
        'lead_quality',
        'recommended_action'
      );

-- ----------------------------------------------------------------------------
-- 10. Hard-Rule-I parity — customer-API role has zero SELECT
-- ----------------------------------------------------------------------------
-- Expected: allowed = FALSE.

SELECT has_table_privilege(
         'buyerrecon_customer_api'::name,
         'stage0_decisions'::regclass,
         'SELECT'::text
       ) AS allowed_for_customer_api;

-- Belt-and-braces: customer-API holds zero INSERT / UPDATE / DELETE.
SELECT
  has_table_privilege('buyerrecon_customer_api'::name, 'stage0_decisions'::regclass, 'INSERT'::text) AS allowed_insert,
  has_table_privilege('buyerrecon_customer_api'::name, 'stage0_decisions'::regclass, 'UPDATE'::text) AS allowed_update,
  has_table_privilege('buyerrecon_customer_api'::name, 'stage0_decisions'::regclass, 'DELETE'::text) AS allowed_delete;
-- Expected: all three FALSE.

-- Symmetric expectations for scorer/readonly (informational):
SELECT
  has_table_privilege('buyerrecon_scoring_worker'::name,    'stage0_decisions'::regclass, 'SELECT'::text) AS scoring_worker_select,
  has_table_privilege('buyerrecon_scoring_worker'::name,    'stage0_decisions'::regclass, 'INSERT'::text) AS scoring_worker_insert,
  has_table_privilege('buyerrecon_internal_readonly'::name, 'stage0_decisions'::regclass, 'SELECT'::text) AS readonly_select;
-- Expected: scoring_worker_select=t, scoring_worker_insert=t, readonly_select=t.

-- ----------------------------------------------------------------------------
-- 11. PR#5 produced zero Lane A / Lane B writes (cross-table invariant)
-- ----------------------------------------------------------------------------
-- This invariant SQL is a *belt-and-braces* check. PR#5 source contains
-- no `INSERT INTO scoring_output_lane_a` / `_b` (verified by pure tests),
-- so the production-side proof is rows on stage0_decisions WITHOUT a
-- corresponding row on the Lane tables for the same (workspace, site,
-- session, scoring_version). Operator scopes the query per workspace
-- using the placeholder below.

SELECT
  (SELECT COUNT(*)::int FROM stage0_decisions       WHERE workspace_id = '<WORKSPACE_ID>') AS stage0_rows,
  (SELECT COUNT(*)::int FROM scoring_output_lane_a  WHERE workspace_id = '<WORKSPACE_ID>') AS lane_a_rows,
  (SELECT COUNT(*)::int FROM scoring_output_lane_b  WHERE workspace_id = '<WORKSPACE_ID>') AS lane_b_rows;
-- Expected: stage0_rows >= 0; lane_a_rows AND lane_b_rows are PR#6 / PR#3b's
-- responsibility — PR#5 itself contributes nothing to them.

-- ----------------------------------------------------------------------------
-- 12. stage0_decisions summary — counts by rule_id (operator-facing)
-- ----------------------------------------------------------------------------

SELECT rule_id, excluded, COUNT(*)::int AS rows
  FROM stage0_decisions
 GROUP BY rule_id, excluded
 ORDER BY rule_id;

-- ----------------------------------------------------------------------------
-- 13. Latest 20 rows for one boundary — human inspection
-- ----------------------------------------------------------------------------
-- Parameterise <WORKSPACE_ID>, <SITE_ID>. Returns 0 rows on an empty
-- freshly migrated DB. No raw secrets are projected.

SELECT stage0_decision_id,
       session_id,
       stage0_version,
       scoring_version,
       excluded,
       rule_id,
       source_event_count,
       rule_inputs,
       evidence_refs,
       record_only,
       created_at, updated_at
  FROM stage0_decisions
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
 ORDER BY created_at DESC NULLS LAST, stage0_decision_id ASC
 LIMIT 20;
