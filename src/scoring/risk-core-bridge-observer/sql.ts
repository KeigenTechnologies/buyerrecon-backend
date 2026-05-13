/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — parameterised SQL.
 *
 * Pure module: returns SQL strings + parameter arrays. The runner
 * (`runner.ts`) actually issues these against `pg`. No DML, no DDL,
 * no Lane A/B reads, no raw-upstream reads.
 *
 * Allowed sources (PR#8a §6.1):
 *   - `risk_observations_v0_1`  — primary observer input
 *   - `stage0_decisions`         — optional side-read (eligibility / provenance)
 *
 * Forbidden sources (PR#8a §6.2):
 *   - accepted_events, rejected_events, ingest_requests
 *   - session_features
 *   - session_behavioural_features_v0_2  (the literal table name only
 *     appears in `evidence_refs` value matching, never in SQL FROM/JOIN)
 *   - scoring_output_lane_a, scoring_output_lane_b
 *
 * Every query below uses positional parameters ($1, $2, ...). String
 * concatenation of user input into SQL is forbidden (zero occurrences).
 */

/**
 * SELECT statement for the primary read against
 * `risk_observations_v0_1`. Filters by version stamps + optional
 * workspace/site + time window + hard limit.
 *
 * Param order (all required, even when filtering is optional —
 * unfilled filters pass NULL):
 *   $1 observation_version  (TEXT)
 *   $2 scoring_version      (TEXT)
 *   $3 workspace_id         (TEXT or NULL)
 *   $4 site_id              (TEXT or NULL)
 *   $5 window_start         (TIMESTAMPTZ)
 *   $6 window_end           (TIMESTAMPTZ)
 *   $7 limit                (INT)
 */
export const SELECT_RISK_OBSERVATIONS_SQL = `
SELECT
  risk_observation_id,
  workspace_id,
  site_id,
  session_id,
  observation_version,
  scoring_version,
  velocity,
  device_risk_01,
  network_risk_01,
  identity_risk_01,
  behavioural_risk_01,
  tags,
  evidence_refs,
  source_event_count,
  record_only,
  created_at
FROM risk_observations_v0_1
WHERE observation_version = $1
  AND scoring_version     = $2
  AND ($3::text IS NULL OR workspace_id = $3)
  AND ($4::text IS NULL OR site_id      = $4)
  AND created_at >= $5
  AND created_at <  $6
ORDER BY created_at ASC, risk_observation_id ASC
LIMIT $7
`;

/**
 * Path A — exact pointer lookup against `stage0_decisions` by PK.
 *
 * Param order:
 *   $1 stage0_decision_id (UUID/TEXT)
 *
 * Expected to return 0 or 1 rows (PK lookup). Zero rows means
 * dangling pointer → INVALID_STAGE0_CONTEXT per PR#8a §5.1.1.
 */
export const SELECT_STAGE0_BY_DECISION_ID_SQL = `
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
WHERE stage0_decision_id = $1::uuid
LIMIT 2
`;

/**
 * Path B — lineage fallback against `stage0_decisions` by
 * (workspace_id, site_id, session_id). Used only when no
 * `stage0_decision_id` pointer is present on
 * `risk_observations_v0_1.evidence_refs[]`.
 *
 * Param order:
 *   $1 workspace_id (TEXT)
 *   $2 site_id      (TEXT)
 *   $3 session_id   (TEXT)
 *
 * The LIMIT 2 lets the runner distinguish "exactly 1" from
 * "≥ 2" without scanning the whole row set — per PR#8a §5.1.1
 * the multi-row case must reject `INVALID_STAGE0_CONTEXT`.
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
 * Tests in `tests/v1/risk-core-bridge-observer.test.ts` grep this
 * file for forbidden patterns. The list below documents what is
 * intentionally allowed and what is intentionally forbidden.
 *
 *   ALLOWED FROM/JOIN: risk_observations_v0_1, stage0_decisions
 *   FORBIDDEN FROM/JOIN: accepted_events, rejected_events,
 *     ingest_requests, session_features,
 *     session_behavioural_features_v0_2,
 *     scoring_output_lane_a, scoring_output_lane_b
 *   FORBIDDEN STATEMENTS: INSERT, UPDATE, DELETE, TRUNCATE,
 *     CREATE, ALTER, DROP, GRANT, REVOKE
 * ------------------------------------------------------------------------ */
