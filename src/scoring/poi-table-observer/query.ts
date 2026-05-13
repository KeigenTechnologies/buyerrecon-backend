/**
 * Sprint 2 PR#11d — POI Observations Table Observer — parameterised SQL.
 *
 * Pure module. The runner (`runner.ts`) issues these against `pg`. All
 * queries use positional parameters; string concatenation of user
 * input into SQL is forbidden (zero occurrences).
 *
 * ALLOWED reads:
 *   - `poi_observations_v0_1`              (primary)
 *   - `information_schema.columns`         (schema-level forbidden-column sweep)
 *   - `information_schema.tables`          (table-presence check)
 *
 * FORBIDDEN reads (PR#11d locked boundary — static-source sweep
 * enforces; source-vs-table parity belongs to operator psql):
 *   - `session_features`
 *   - `session_behavioural_features_v0_2`
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
 * Anomaly queries add:
 *   $5 sample_limit (INT)
 * Distribution queries omit $5.
 */

/* --------------------------------------------------------------------------
 * Table-presence + row-count + window scope
 * ------------------------------------------------------------------------ */

export const SELECT_TABLE_PRESENT_SQL = `
SELECT EXISTS (
  SELECT 1
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name   = 'poi_observations_v0_1'
) AS table_present
`;

export const SELECT_ROW_COUNT_SQL = `
SELECT COUNT(*)::bigint AS row_count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
`;

/* --------------------------------------------------------------------------
 * Forbidden-column sweep (schema-level)
 *
 * Param order:
 *   $1 forbidden_columns (TEXT[])
 *
 * Returns one row per offending column name. Zero rows means the
 * v0.1 column shape holds.
 * ------------------------------------------------------------------------ */

export const SELECT_FORBIDDEN_COLUMNS_SQL = `
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'poi_observations_v0_1'
   AND column_name  = ANY($1::text[])
 ORDER BY column_name ASC
`;

/* --------------------------------------------------------------------------
 * Anomaly queries — TWO queries per anomaly kind
 *
 * Per Codex blocker (PR#11d v0.2): anomaly counters MUST be
 * authoritative. The previous design returned offending IDs up to
 * a LIMIT and derived the counter from the returned array length,
 * which made the counter a lower bound when the LIMIT capped.
 *
 * Current design splits each anomaly check into:
 *   1. A COUNT(*) query that returns the authoritative total. NO
 *      LIMIT clause — the count is exact regardless of how many
 *      rows violate.
 *   2. A separate sample query that returns up to
 *      `OBS_ANOMALY_SAMPLE_LIMIT` offending poi_observation_id
 *      values for the operator's investigation aid. If
 *      `OBS_ANOMALY_SAMPLE_LIMIT=0` the runner skips this query
 *      entirely and the samples field is an empty array.
 *
 * The counter and the samples are now independent. Counters remain
 * authoritative even when samples are suppressed or capped below
 * the true anomaly count.
 *
 * Param order for COUNT queries (5 params):
 *   $1 window_start (TIMESTAMPTZ)
 *   $2 window_end   (TIMESTAMPTZ)
 *   $3 workspace_id (TEXT or NULL)
 *   $4 site_id      (TEXT or NULL)
 *
 * Param order for sample queries (5 params):
 *   $1..$4 same as COUNT, plus
 *   $5 anomaly_sample_limit (INT)
 * ------------------------------------------------------------------------ */

/**
 * Anomaly #1 — duplicate natural-key tuples (predicate fragment).
 *
 * Reusable filter shared by the COUNT and sample queries below.
 * Mirrors verification SQL check #1 verbatim.
 */
const DUPLICATE_NATURAL_KEY_PREDICATE = `
   AND (workspace_id, site_id, session_id, poi_type, poi_key,
        poi_input_version, poi_observation_version, extraction_version) IN (
     SELECT workspace_id, site_id, session_id, poi_type, poi_key,
            poi_input_version, poi_observation_version, extraction_version
       FROM poi_observations_v0_1
      WHERE derived_at >= $1
        AND derived_at <  $2
        AND ($3::text IS NULL OR workspace_id = $3)
        AND ($4::text IS NULL OR site_id      = $4)
      GROUP BY workspace_id, site_id, session_id, poi_type, poi_key,
               poi_input_version, poi_observation_version, extraction_version
     HAVING COUNT(*) > 1
   )`;

export const SELECT_DUPLICATE_NATURAL_KEY_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${DUPLICATE_NATURAL_KEY_PREDICATE}
`;

export const SELECT_DUPLICATE_NATURAL_KEY_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${DUPLICATE_NATURAL_KEY_PREDICATE}
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #2 — poi_eligible mismatch with NOT stage0_excluded. */
export const SELECT_POI_ELIGIBLE_MISMATCH_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND poi_eligible <> (NOT stage0_excluded)
`;

export const SELECT_POI_ELIGIBLE_MISMATCH_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND poi_eligible <> (NOT stage0_excluded)
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #3 — evidence_refs invalid (not array or empty). */
export const SELECT_EVIDENCE_REFS_INVALID_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (jsonb_typeof(evidence_refs) <> 'array'
        OR jsonb_array_length(evidence_refs) = 0)
`;

export const SELECT_EVIDENCE_REFS_INVALID_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (jsonb_typeof(evidence_refs) <> 'array'
        OR jsonb_array_length(evidence_refs) = 0)
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #4 — source_versions not a JSONB object. */
export const SELECT_SOURCE_VERSIONS_INVALID_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND jsonb_typeof(source_versions) <> 'object'
`;

export const SELECT_SOURCE_VERSIONS_INVALID_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND jsonb_typeof(source_versions) <> 'object'
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #5 — v0.1 hard-coded enum violations. */
const V0_1_ENUM_VIOLATION_PREDICATE = `
   AND (poi_type            <> 'page_path'
        OR source_table     <> 'session_features'
        OR poi_key_source_field NOT IN ('landing_page_path', 'last_page_path')
        OR record_only      IS NOT TRUE)`;

export const SELECT_V0_1_ENUM_VIOLATION_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${V0_1_ENUM_VIOLATION_PREDICATE}
`;

export const SELECT_V0_1_ENUM_VIOLATION_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${V0_1_ENUM_VIOLATION_PREDICATE}
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #6 — source_event_count negative. */
export const SELECT_NEGATIVE_SOURCE_EVENT_COUNT_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND source_event_count < 0
`;

export const SELECT_NEGATIVE_SOURCE_EVENT_COUNT_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND source_event_count < 0
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #7 — timestamp ordering violation. */
const TIMESTAMP_ORDERING_PREDICATE = `
   AND ((first_seen_at IS NOT NULL
         AND last_seen_at IS NOT NULL
         AND first_seen_at > last_seen_at)
        OR created_at > updated_at)`;

export const SELECT_TIMESTAMP_ORDERING_VIOLATION_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${TIMESTAMP_ORDERING_PREDICATE}
`;

export const SELECT_TIMESTAMP_ORDERING_VIOLATION_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${TIMESTAMP_ORDERING_PREDICATE}
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #8 — poi_key contains a raw URL query/fragment marker. */
export const SELECT_POI_KEY_UNSAFE_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (poi_key LIKE '%?%' OR poi_key LIKE '%#%')
`;

export const SELECT_POI_KEY_UNSAFE_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND (poi_key LIKE '%?%' OR poi_key LIKE '%#%')
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/** Anomaly #13 — evidence_refs forbidden-key substring scan. */
const EVIDENCE_REFS_FORBIDDEN_KEY_PREDICATE = `
   AND evidence_refs::text ~* '"(raw_payload|payload|canonical_jsonb|page_url|full_url|url_query|user_agent|ua|ip_hash|token_hash|authorization|bearer|cookie|pepper|person_id|visitor_id|company_id|account_id|email|phone)"'`;

export const SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_COUNT_SQL = `
SELECT COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${EVIDENCE_REFS_FORBIDDEN_KEY_PREDICATE}
`;

export const SELECT_EVIDENCE_REFS_FORBIDDEN_KEY_SAMPLE_SQL = `
SELECT poi_observation_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   ${EVIDENCE_REFS_FORBIDDEN_KEY_PREDICATE}
 ORDER BY poi_observation_id ASC
 LIMIT $5
`;

/* --------------------------------------------------------------------------
 * Distribution queries — group-by counters
 *
 * Param order:
 *   $1 window_start (TIMESTAMPTZ)
 *   $2 window_end   (TIMESTAMPTZ)
 *   $3 workspace_id (TEXT or NULL)
 *   $4 site_id      (TEXT or NULL)
 *
 * Each returns rows of the shape `{ <bucket>: TEXT|BOOLEAN, count: BIGINT }`
 * which the aggregator folds into a `Record<bucket, number>`.
 * ------------------------------------------------------------------------ */

export const SELECT_POI_TYPE_DISTRIBUTION_SQL = `
SELECT poi_type AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_type
`;

export const SELECT_POI_SURFACE_CLASS_DISTRIBUTION_SQL = `
SELECT poi_surface_class AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
   AND poi_surface_class IS NOT NULL
 GROUP BY poi_surface_class
`;

export const SELECT_SOURCE_TABLE_DISTRIBUTION_SQL = `
SELECT source_table AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY source_table
`;

export const SELECT_POI_KEY_SOURCE_FIELD_DISTRIBUTION_SQL = `
SELECT poi_key_source_field AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_key_source_field
`;

export const SELECT_STAGE0_EXCLUDED_DISTRIBUTION_SQL = `
SELECT stage0_excluded AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY stage0_excluded
`;

export const SELECT_POI_ELIGIBLE_DISTRIBUTION_SQL = `
SELECT poi_eligible AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_eligible
`;

export const SELECT_EXTRACTION_VERSION_DISTRIBUTION_SQL = `
SELECT extraction_version AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY extraction_version
`;

export const SELECT_POI_INPUT_VERSION_DISTRIBUTION_SQL = `
SELECT poi_input_version AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_input_version
`;

export const SELECT_POI_OBSERVATION_VERSION_DISTRIBUTION_SQL = `
SELECT poi_observation_version AS bucket, COUNT(*)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 GROUP BY poi_observation_version
`;

/* --------------------------------------------------------------------------
 * Identity diagnostics — distinct counts + masked sample
 * ------------------------------------------------------------------------ */

export const SELECT_UNIQUE_SESSION_IDS_SQL = `
SELECT COUNT(DISTINCT session_id)::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
`;

export const SELECT_UNIQUE_WORKSPACE_SITE_PAIRS_SQL = `
SELECT COUNT(DISTINCT (workspace_id, site_id))::bigint AS count
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
`;

/**
 * Sample session IDs (most recent N in the window). The runner
 * masks each via `truncateSessionId` before placing on the report —
 * the raw `session_id` is NEVER serialised.
 *
 * Param order:
 *   $1 window_start (TIMESTAMPTZ)
 *   $2 window_end   (TIMESTAMPTZ)
 *   $3 workspace_id (TEXT or NULL)
 *   $4 site_id      (TEXT or NULL)
 *   $5 sample_limit (INT)
 */
export const SELECT_SAMPLE_SESSION_IDS_SQL = `
SELECT session_id
  FROM poi_observations_v0_1
 WHERE derived_at >= $1
   AND derived_at <  $2
   AND ($3::text IS NULL OR workspace_id = $3)
   AND ($4::text IS NULL OR site_id      = $4)
 ORDER BY derived_at DESC, poi_observation_id DESC
 LIMIT $5
`;
