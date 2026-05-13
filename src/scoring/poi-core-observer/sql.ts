/**
 * Sprint 2 PR#11b — POI Core Input Observer — parameterised SQL.
 *
 * Pure module: returns SQL strings. The runner (`runner.ts`) actually
 * issues these against `pg`. No DML, no DDL, no Lane A/B reads, no
 * raw-upstream reads.
 *
 * Allowed sources (PR#11a §5.1 / OD-2):
 *   - `session_features`                      — primary POI source
 *   - `session_behavioural_features_v0_2`     — primary POI source
 *   - `stage0_decisions`                       — side-read only (eligibility/provenance)
 *
 * Forbidden sources (PR#11a OD-3 / §6 / §11):
 *   - accepted_events, rejected_events, ingest_requests
 *   - risk_observations_v0_1
 *   - scoring_output_lane_a, scoring_output_lane_b
 *   - site_write_tokens
 *
 * Every query below uses positional parameters ($1, $2, ...). String
 * concatenation of user input into SQL is forbidden (zero occurrences).
 */

/**
 * SELECT against `session_features`. Filters by optional
 * extraction_version + optional workspace/site + time window + hard
 * limit.
 *
 * Param order:
 *   $1 extraction_version  (TEXT or NULL)
 *   $2 workspace_id        (TEXT or NULL)
 *   $3 site_id             (TEXT or NULL)
 *   $4 window_start        (TIMESTAMPTZ)
 *   $5 window_end          (TIMESTAMPTZ)
 *   $6 limit               (INT)
 */
export const SELECT_SESSION_FEATURES_SQL = `
SELECT
  session_features_id,
  workspace_id,
  site_id,
  session_id,
  extraction_version,
  extracted_at,
  first_seen_at,
  last_seen_at,
  source_event_count,
  landing_page_path,
  last_page_path
FROM session_features
WHERE ($1::text IS NULL OR extraction_version = $1)
  AND ($2::text IS NULL OR workspace_id       = $2)
  AND ($3::text IS NULL OR site_id            = $3)
  AND extracted_at >= $4
  AND extracted_at <  $5
ORDER BY extracted_at ASC, session_features_id ASC
LIMIT $6
`;

/**
 * SELECT against `session_behavioural_features_v0_2`. Filters by
 * optional feature_version + optional workspace/site + time window +
 * hard limit.
 *
 * Param order:
 *   $1 feature_version  (TEXT or NULL)
 *   $2 workspace_id     (TEXT or NULL)
 *   $3 site_id          (TEXT or NULL)
 *   $4 window_start     (TIMESTAMPTZ)
 *   $5 window_end       (TIMESTAMPTZ)
 *   $6 limit            (INT)
 *
 * NOTE: This SELECT does NOT read any path / cta / form / offer /
 * referrer columns because the SBF schema does not carry any. SBF
 * rows will naturally row-level reject as NO_PAGE_PATH_CANDIDATE
 * inside the mapper — that is a deliberate PR#11b diagnostic finding
 * (PR#11a §6 observer-first rationale: surface which primary source
 * table can produce valid POI envelopes today).
 */
export const SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL = `
SELECT
  behavioural_features_id,
  workspace_id,
  site_id,
  session_id,
  feature_version,
  extracted_at,
  first_seen_at,
  last_seen_at,
  source_event_count
FROM session_behavioural_features_v0_2
WHERE ($1::text IS NULL OR feature_version = $1)
  AND ($2::text IS NULL OR workspace_id    = $2)
  AND ($3::text IS NULL OR site_id         = $3)
  AND extracted_at >= $4
  AND extracted_at <  $5
ORDER BY extracted_at ASC, behavioural_features_id ASC
LIMIT $6
`;

/**
 * Stage 0 side-read by lineage (workspace_id, site_id, session_id).
 *
 * Param order:
 *   $1 workspace_id (TEXT)
 *   $2 site_id      (TEXT)
 *   $3 session_id   (TEXT)
 *
 * The LIMIT 2 lets the runner distinguish "exactly 1" from "≥ 2"
 * without scanning the whole row set — per PR#8b §5.1.1 precedent
 * the multi-row case must reject INVALID_STAGE0_CONTEXT (the
 * observer MUST NOT guess which Stage 0 row to consume).
 *
 * Stage 0 is side-read ONLY. It is never the primary source_table.
 * Per PR#11a OD-2, the Stage 0 row may populate `stage0_excluded`,
 * `poi_eligible`, and a single `evidence_refs` entry — and nothing
 * else.
 */
export const SELECT_STAGE0_BY_LINEAGE_SQL = `
SELECT
  stage0_decision_id,
  workspace_id,
  site_id,
  session_id,
  stage0_version,
  excluded,
  rule_id,
  record_only
FROM stage0_decisions
WHERE workspace_id = $1
  AND site_id      = $2
  AND session_id   = $3
LIMIT 2
`;

/* --------------------------------------------------------------------------
 * Static-source assertions (compile-time + test-time)
 *
 * Tests in `tests/v1/poi-core-observer.test.ts` grep this file for
 * forbidden patterns. The list below documents what is intentionally
 * allowed and what is intentionally forbidden.
 *
 *   ALLOWED FROM/JOIN:
 *     session_features,
 *     session_behavioural_features_v0_2,
 *     stage0_decisions
 *   FORBIDDEN FROM/JOIN:
 *     accepted_events, rejected_events, ingest_requests,
 *     risk_observations_v0_1,
 *     scoring_output_lane_a, scoring_output_lane_b,
 *     site_write_tokens
 *   FORBIDDEN STATEMENTS:
 *     INSERT, UPDATE, DELETE, TRUNCATE,
 *     CREATE, ALTER, DROP, GRANT, REVOKE
 * ------------------------------------------------------------------------ */
