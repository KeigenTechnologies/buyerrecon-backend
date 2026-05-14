/**
 * Sprint 2 PR#12e — POI Sequence Table Observer — parameterised SQL.
 *
 * Pure module. The runner (`runner.ts`) issues these against `pg`.
 * All queries use positional parameters; string concatenation of
 * user input into SQL is forbidden (zero occurrences).
 *
 * ALLOWED reads:
 *   - `poi_sequence_observations_v0_1`     (primary)
 *   - `information_schema.columns`         (schema-level forbidden-column sweep)
 *   - `information_schema.tables`          (table-presence check)
 *
 * FORBIDDEN reads (PR#12e locked boundary — static-source sweep
 * enforces; POI coverage parity belongs to PR#12d verification SQL):
 *   - `poi_observations_v0_1`
 *   - `session_features`, `session_behavioural_features_v0_2`
 *   - `stage0_decisions`
 *   - `accepted_events`, `rejected_events`, `ingest_requests`
 *   - `risk_observations_v0_1`
 *   - `scoring_output_lane_a`, `scoring_output_lane_b`
 *   - `site_write_tokens`
 *
 * FORBIDDEN writes: any DML (`INSERT/UPDATE/DELETE/TRUNCATE`) and any
 * DDL (`CREATE/ALTER/DROP/GRANT/REVOKE`). Observer is strictly
 * read-only.
 *
 * Common parameter shape for window+filter queries:
 *   $1 window_start (TIMESTAMPTZ)
 *   $2 window_end   (TIMESTAMPTZ)
 *   $3 workspace_id (TEXT or NULL)
 *   $4 site_id      (TEXT or NULL)
 * Anomaly sample queries add:
 *   $5 anomaly_sample_limit (INT)
 */

/* --------------------------------------------------------------------------
 * Table-presence + row-count
 * ------------------------------------------------------------------------ */

export const SELECT_TABLE_PRESENT_SQL = `
SELECT EXISTS (
  SELECT 1
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name   = 'poi_sequence_observations_v0_1'
) AS table_present
`;

export const SELECT_ROW_COUNT_SQL = `
SELECT COUNT(*)::bigint AS row_count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
`;

/* --------------------------------------------------------------------------
 * Forbidden-column sweep (schema-level).
 *
 * Param order:
 *   $1 forbidden_columns (TEXT[])
 *
 * Returns one row per offending column name; zero rows means the
 * v0.1 column shape holds.
 * ------------------------------------------------------------------------ */

export const SELECT_FORBIDDEN_COLUMNS_SQL = `
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'poi_sequence_observations_v0_1'
   AND column_name  = ANY($1::text[])
 ORDER BY column_name ASC
`;

/* --------------------------------------------------------------------------
 * Anomaly queries — split COUNT (authoritative) + SAMPLE (capped),
 * mirroring PR#11d v0.2 Codex-blocker pattern.
 * ------------------------------------------------------------------------ */

/* #1 — duplicate natural keys */
const DUPLICATE_NATURAL_KEY_PREDICATE = `
   AND (workspace_id, site_id, session_id,
        poi_sequence_version, poi_observation_version) IN (
     SELECT workspace_id, site_id, session_id,
            poi_sequence_version, poi_observation_version
       FROM poi_sequence_observations_v0_1
      WHERE derived_at >= $1
        AND derived_at <  $2
        AND ($3::text IS NULL OR workspace_id = $3)
        AND ($4::text IS NULL OR site_id      = $4)
      GROUP BY workspace_id, site_id, session_id,
               poi_sequence_version, poi_observation_version
     HAVING COUNT(*) > 1
   )`;

export const SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${DUPLICATE_NATURAL_KEY_PREDICATE}
`;

export const SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${DUPLICATE_NATURAL_KEY_PREDICATE}
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #2 — eligibility inverse mismatch */
export const SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND poi_sequence_eligible <> (NOT stage0_excluded)
`;

export const SELECT_POI_SEQUENCE_ELIGIBLE_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND poi_sequence_eligible <> (NOT stage0_excluded)
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #3 — invalid pattern class */
const INVALID_PATTERN_CLASS_PREDICATE = `
   AND poi_sequence_pattern_class NOT IN (
     'single_poi','repeated_same_poi','multi_poi_linear',
     'loop_or_backtrack','insufficient_temporal_data','unknown'
   )`;

export const SELECT_INVALID_PATTERN_CLASS_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${INVALID_PATTERN_CLASS_PREDICATE}
`;

export const SELECT_INVALID_PATTERN_CLASS_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${INVALID_PATTERN_CLASS_PREDICATE}
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #4 — has_progression mismatch */
export const SELECT_HAS_PROGRESSION_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND has_progression <> (unique_poi_count >= 2)
`;

export const SELECT_HAS_PROGRESSION_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND has_progression <> (unique_poi_count >= 2)
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #5 — progression_depth mismatch */
export const SELECT_PROGRESSION_DEPTH_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND progression_depth <> unique_poi_count
`;

export const SELECT_PROGRESSION_DEPTH_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND progression_depth <> unique_poi_count
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #6 — repeated_poi_count mismatch */
export const SELECT_REPEATED_POI_COUNT_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND repeated_poi_count <> (poi_count - unique_poi_count)
`;

export const SELECT_REPEATED_POI_COUNT_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND repeated_poi_count <> (poi_count - unique_poi_count)
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #7 — has_repetition mismatch */
export const SELECT_HAS_REPETITION_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND has_repetition <> (repeated_poi_count > 0)
`;

export const SELECT_HAS_REPETITION_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND has_repetition <> (repeated_poi_count > 0)
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #8 — source_poi_observation_count ≠ poi_count */
export const SELECT_SOURCE_COUNT_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND source_poi_observation_count <> poi_count
`;

export const SELECT_SOURCE_COUNT_MISMATCH_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND source_poi_observation_count <> poi_count
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #9 — negative / out-of-range counts */
const NEGATIVE_COUNT_PREDICATE = `
   AND (poi_count          < 1
     OR unique_poi_count   < 1
     OR unique_poi_count   > poi_count
     OR repeated_poi_count < 0
     OR progression_depth  < 0)`;

export const SELECT_NEGATIVE_COUNT_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${NEGATIVE_COUNT_PREDICATE}
`;

export const SELECT_NEGATIVE_COUNT_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${NEGATIVE_COUNT_PREDICATE}
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #10 — timestamp ordering violations (NULL-safe) */
const TIMESTAMP_ORDERING_PREDICATE = `
   AND ((first_seen_at IS NOT NULL
         AND last_seen_at IS NOT NULL
         AND first_seen_at > last_seen_at)
     OR (created_at > updated_at))`;

export const SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${TIMESTAMP_ORDERING_PREDICATE}
`;

export const SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${TIMESTAMP_ORDERING_PREDICATE}
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #11 — negative duration */
export const SELECT_NEGATIVE_DURATION_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND duration_seconds IS NOT NULL
   AND duration_seconds < 0
`;

export const SELECT_NEGATIVE_DURATION_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND duration_seconds IS NOT NULL
   AND duration_seconds < 0
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #12 — evidence_refs invalid (not array or empty) */
export const SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (jsonb_typeof(evidence_refs) <> 'array'
        OR jsonb_array_length(evidence_refs) = 0)
`;

export const SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (jsonb_typeof(evidence_refs) <> 'array'
        OR jsonb_array_length(evidence_refs) = 0)
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #13 — evidence_refs forbidden direct table (OD-14 guard) */
const EVIDENCE_REFS_FORBIDDEN_TABLE_PREDICATE = `
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(s.evidence_refs) AS elem
      WHERE elem ->> 'table' IS DISTINCT FROM 'poi_observations_v0_1'
   )`;

export const SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1 s
 WHERE s.derived_at >= $1
   AND s.derived_at <  $2
   AND ($3::text IS NULL OR s.workspace_id = $3)
   AND ($4::text IS NULL OR s.site_id      = $4)
   AND jsonb_typeof(s.evidence_refs) = 'array'
   ${EVIDENCE_REFS_FORBIDDEN_TABLE_PREDICATE}
`;

export const SELECT_EVIDENCE_REFS_FORBIDDEN_DIRECT_TABLE_SAMPLE_SQL = `
SELECT s.poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1 s
 WHERE s.derived_at >= $1
   AND s.derived_at <  $2
   AND ($3::text IS NULL OR s.workspace_id = $3)
   AND ($4::text IS NULL OR s.site_id      = $4)
   AND jsonb_typeof(s.evidence_refs) = 'array'
   ${EVIDENCE_REFS_FORBIDDEN_TABLE_PREDICATE}
 ORDER BY s.poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #14 — evidence_refs entry has malformed poi_observation_id.
 *
 * A valid `poi_observation_id` MUST be a JSON number representing a
 * non-negative integer BIGSERIAL id. Rejects:
 *   - missing key (`elem -> 'poi_observation_id' IS NULL`)
 *   - wrong JSON type (`jsonb_typeof <> 'number'`)
 *   - negative number (`::numeric < 0`)
 *   - fractional number (`::numeric <> trunc(::numeric)`) — e.g. `1.5`
 *
 * The cast to `::numeric` is guarded by the `jsonb_typeof = 'number'`
 * predicate inside a nested `AND` so PostgreSQL cannot re-order the
 * cast ahead of the type check (defence in depth against optimizer
 * decisions that might evaluate the cast first).
 */
const EVIDENCE_REFS_BAD_ID_PREDICATE = `
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(s.evidence_refs) AS elem
      WHERE (elem -> 'poi_observation_id') IS NULL
         OR jsonb_typeof(elem -> 'poi_observation_id') <> 'number'
         OR (
           jsonb_typeof(elem -> 'poi_observation_id') = 'number'
           AND (
                (elem ->> 'poi_observation_id')::numeric < 0
             OR (elem ->> 'poi_observation_id')::numeric
                  <> trunc((elem ->> 'poi_observation_id')::numeric)
           )
         )
   )`;

export const SELECT_EVIDENCE_REFS_BAD_ID_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1 s
 WHERE s.derived_at >= $1
   AND s.derived_at <  $2
   AND ($3::text IS NULL OR s.workspace_id = $3)
   AND ($4::text IS NULL OR s.site_id      = $4)
   AND jsonb_typeof(s.evidence_refs) = 'array'
   ${EVIDENCE_REFS_BAD_ID_PREDICATE}
`;

export const SELECT_EVIDENCE_REFS_BAD_ID_SAMPLE_SQL = `
SELECT s.poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1 s
 WHERE s.derived_at >= $1
   AND s.derived_at <  $2
   AND ($3::text IS NULL OR s.workspace_id = $3)
   AND ($4::text IS NULL OR s.site_id      = $4)
   AND jsonb_typeof(s.evidence_refs) = 'array'
   ${EVIDENCE_REFS_BAD_ID_PREDICATE}
 ORDER BY s.poi_sequence_observation_id ASC
 LIMIT $5
`;

/* #15 — source_versions not a JSONB object */
export const SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND jsonb_typeof(source_versions) <> 'object'
`;

export const SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL = `
SELECT poi_sequence_observation_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND jsonb_typeof(source_versions) <> 'object'
 ORDER BY poi_sequence_observation_id ASC
 LIMIT $5
`;

/* --------------------------------------------------------------------------
 * Distribution queries (4 params: window + workspace/site filters)
 *
 * Each returns rows of (bucket, count). The aggregator folds them.
 * ------------------------------------------------------------------------ */

export const SELECT_POI_SEQUENCE_PATTERN_CLASS_DISTRIBUTION_SQL = `
SELECT poi_sequence_pattern_class AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_sequence_pattern_class
 ORDER BY poi_sequence_pattern_class
`;

const POI_COUNT_BUCKET_EXPR = `
  CASE
    WHEN poi_count <= 0  THEN '0'
    WHEN poi_count = 1   THEN '1'
    WHEN poi_count = 2   THEN '2'
    WHEN poi_count <= 5  THEN '3..5'
    WHEN poi_count <= 10 THEN '6..10'
    ELSE '11+'
  END`;

export const SELECT_POI_COUNT_DISTRIBUTION_SQL = `
SELECT ${POI_COUNT_BUCKET_EXPR} AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY 1
 ORDER BY 1
`;

const PROGRESSION_DEPTH_BUCKET_EXPR = `
  CASE
    WHEN progression_depth <= 0  THEN '0'
    WHEN progression_depth = 1   THEN '1'
    WHEN progression_depth = 2   THEN '2'
    WHEN progression_depth <= 5  THEN '3..5'
    WHEN progression_depth <= 10 THEN '6..10'
    ELSE '11+'
  END`;

export const SELECT_PROGRESSION_DEPTH_DISTRIBUTION_SQL = `
SELECT ${PROGRESSION_DEPTH_BUCKET_EXPR} AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY 1
 ORDER BY 1
`;

export const SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL = `
SELECT stage0_excluded AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY stage0_excluded
 ORDER BY stage0_excluded
`;

export const SELECT_POI_SEQUENCE_ELIGIBLE_DISTRIBUTION_SQL = `
SELECT poi_sequence_eligible AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_sequence_eligible
 ORDER BY poi_sequence_eligible
`;

export const SELECT_HAS_REPETITION_DISTRIBUTION_SQL = `
SELECT has_repetition AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY has_repetition
 ORDER BY has_repetition
`;

export const SELECT_HAS_PROGRESSION_DISTRIBUTION_SQL = `
SELECT has_progression AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY has_progression
 ORDER BY has_progression
`;

export const SELECT_POI_SEQUENCE_VERSION_DISTRIBUTION_SQL = `
SELECT poi_sequence_version AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_sequence_version
 ORDER BY poi_sequence_version
`;

export const SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL = `
SELECT poi_observation_version AS bucket, COUNT(*)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_observation_version
 ORDER BY poi_observation_version
`;

/* --------------------------------------------------------------------------
 * Identity diagnostics
 * ------------------------------------------------------------------------ */

export const SELECT_UNIQUE_SESSION_IDS_SQL = `
SELECT COUNT(DISTINCT session_id)::bigint AS count
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
`;

export const SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM (
    SELECT DISTINCT workspace_id, site_id
      FROM poi_sequence_observations_v0_1
     WHERE derived_at >= $1
       AND derived_at <  $2
       AND ($3::text IS NULL OR workspace_id = $3)
       AND ($4::text IS NULL OR site_id      = $4)
  ) sub
`;

export const SELECT_SAMPLE_SESSION_IDS_SQL = `
SELECT DISTINCT session_id
  FROM poi_sequence_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 ORDER BY session_id
 LIMIT $5
`;
