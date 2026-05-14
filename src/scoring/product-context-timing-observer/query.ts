/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — SQL constants.
 *
 * Pure module. Read-only. SELECT only.
 *
 * ALLOWED reads:
 *   - `poi_observations_v0_1`              (primary)
 *   - `poi_sequence_observations_v0_1`     (primary)
 *   - `information_schema.tables`          (presence)
 *   - `information_schema.columns`         (required-column readiness)
 *
 * FORBIDDEN reads (enforced by static-source sweep):
 *   - `accepted_events`, `rejected_events`, `ingest_requests`
 *   - `session_features`, `session_behavioural_features_v0_2`
 *   - `stage0_decisions`
 *   - `risk_observations_v0_1`
 *   - `scoring_output_lane_a`, `scoring_output_lane_b`
 *   - `site_write_tokens`
 *
 * FORBIDDEN writes: all DML / DDL / GRANT / REVOKE.
 */

/* --------------------------------------------------------------------------
 * Table-presence probes
 * ------------------------------------------------------------------------ */

export const SELECT_POI_TABLE_PRESENT_SQL = `
SELECT EXISTS (
  SELECT 1
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name   = 'poi_observations_v0_1'
) AS present
`;

export const SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL = `
SELECT EXISTS (
  SELECT 1
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name   = 'poi_sequence_observations_v0_1'
) AS present
`;

/* --------------------------------------------------------------------------
 * Column-presence probes — required-column readiness.
 *
 * Param $1 = table_name (text)
 * Returns existing column names; the runner diffs against the
 * `REQUIRED_*_COLUMNS` allowlist.
 * ------------------------------------------------------------------------ */

export const SELECT_TABLE_COLUMNS_SQL = `
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = $1
 ORDER BY column_name ASC
`;

/* --------------------------------------------------------------------------
 * Primary fetches — bounded by workspace_id + site_id + derived_at
 * window + LIMIT.
 *
 * Param order (both primary queries share it):
 *   $1 window_start (timestamptz)
 *   $2 window_end   (timestamptz)
 *   $3 workspace_id (text — required, not NULL-able here)
 *   $4 site_id      (text — required, not NULL-able here)
 *   $5 row limit    (int)
 *
 * Ordering: (session_id, first_seen_at NULLS LAST, observation id ASC).
 * ------------------------------------------------------------------------ */

export const SELECT_POI_ROWS_SQL = `
SELECT
  poi_observation_id,
  workspace_id,
  site_id,
  session_id,
  poi_type,
  poi_key,
  poi_input_version,
  poi_observation_version,
  first_seen_at,
  last_seen_at,
  stage0_excluded,
  poi_eligible
FROM poi_observations_v0_1
WHERE derived_at >= $1
  AND derived_at <  $2
  AND workspace_id = $3
  AND site_id      = $4
ORDER BY session_id ASC,
         first_seen_at ASC NULLS LAST,
         poi_observation_id ASC
LIMIT $5
`;

export const SELECT_POI_SEQUENCE_ROWS_SQL = `
SELECT
  poi_sequence_observation_id,
  workspace_id,
  site_id,
  session_id,
  poi_sequence_version,
  poi_observation_version,
  poi_count,
  unique_poi_count,
  has_progression,
  has_repetition,
  progression_depth,
  poi_sequence_pattern_class,
  first_seen_at,
  last_seen_at,
  duration_seconds,
  stage0_excluded,
  poi_sequence_eligible,
  evidence_refs
FROM poi_sequence_observations_v0_1
WHERE derived_at >= $1
  AND derived_at <  $2
  AND workspace_id = $3
  AND site_id      = $4
ORDER BY session_id ASC,
         first_seen_at ASC NULLS LAST,
         poi_sequence_observation_id ASC
LIMIT $5
`;
