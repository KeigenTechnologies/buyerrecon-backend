/**
 * Sprint 2 PR#12b — POI Sequence Observer — SQL constants.
 *
 * Read-only. SELECT only. NO writes / NO DDL / NO transaction
 * mutation. Reads exactly two locations:
 *   - `poi_observations_v0_1`  (primary; window-filtered rows)
 *   - `information_schema.tables` (table-presence check)
 *
 * The query is intentionally a single SELECT — grouping by
 * (workspace_id, site_id, session_id) happens in-memory in the
 * mapper. SQL-side GROUP BY would force a JOIN-like rollup and
 * lose per-row identity needed for anomaly samples.
 */

/* --------------------------------------------------------------------------
 * Table-presence check
 *
 * Mirrors PR#11d's pattern: when the table does not exist (fresh
 * environment / migration not applied) the runner returns an early
 * empty report instead of crashing on a "relation does not exist"
 * error.
 * ------------------------------------------------------------------------ */

export const SELECT_TABLE_PRESENT_SQL = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'poi_observations_v0_1'
  ) AS table_present
`;

/* --------------------------------------------------------------------------
 * Main POI observations fetch — bounded by workspace_id, site_id,
 * derived_at window, and a row LIMIT.
 *
 * Parameters:
 *   $1 = window_start (timestamptz)
 *   $2 = window_end   (timestamptz)
 *   $3 = workspace_id (text, NULL → no filter)
 *   $4 = site_id      (text, NULL → no filter)
 *   $5 = row limit    (int)
 *
 * Ordering: (workspace_id, site_id, session_id, first_seen_at NULLS
 * LAST, poi_observation_id). This puts every session's POI rows
 * together and within a session sorts them chronologically with a
 * deterministic BIGSERIAL tie-break.
 * ------------------------------------------------------------------------ */

export const SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL = `
  SELECT
    poi_observation_id,
    workspace_id,
    site_id,
    session_id,
    poi_type,
    poi_key,
    poi_input_version,
    poi_observation_version,
    extraction_version,
    evidence_refs,
    source_versions,
    source_table,
    stage0_excluded,
    poi_eligible,
    first_seen_at,
    last_seen_at,
    derived_at
  FROM poi_observations_v0_1
  WHERE derived_at >= $1
    AND derived_at <  $2
    AND ($3::text IS NULL OR workspace_id = $3)
    AND ($4::text IS NULL OR site_id      = $4)
  ORDER BY workspace_id ASC,
           site_id      ASC,
           session_id   ASC,
           first_seen_at ASC NULLS LAST,
           poi_observation_id ASC
  LIMIT $5
`;
