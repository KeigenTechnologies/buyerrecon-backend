/**
 * Sprint 2 PR#12d — POI Sequence Worker — SQL constants.
 *
 * Read scope: `poi_observations_v0_1` ONLY (no JOINs).
 * Write scope: `poi_sequence_observations_v0_1` ONLY (via UPSERT).
 *
 * No DDL. No TRUNCATE. No GRANT/REVOKE. No CREATE/ALTER/DROP. The
 * static-source sweep in tests/v1/poi-sequence-worker.test.ts
 * enforces this.
 */

/* --------------------------------------------------------------------------
 * SELECT — same shape as the PR#12b observer query, plus a row LIMIT.
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
 * together with deterministic BIGSERIAL tie-break.
 * ------------------------------------------------------------------------ */

export const SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL = `
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
    stage0_rule_id,
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

/* --------------------------------------------------------------------------
 * UPSERT — INSERT ... ON CONFLICT (natural key) DO UPDATE
 *
 * Natural key: (workspace_id, site_id, session_id,
 *               poi_sequence_version, poi_observation_version).
 *
 * On conflict: every non-key column is overwritten and `updated_at`
 * is bumped to NOW(). The `inserted` flag in the RETURNING clause
 * uses the `xmax = 0` PostgreSQL idiom (mirrors PR#11c worker).
 *
 * Param positions $1..$24:
 *   $1  workspace_id                   text
 *   $2  site_id                        text
 *   $3  session_id                     text
 *   $4  poi_sequence_version           text   ('poi-sequence-v0.1')
 *   $5  poi_observation_version        text
 *   $6  poi_count                      int
 *   $7  unique_poi_count               int
 *   $8  first_poi_type                 text
 *   $9  first_poi_key                  text
 *   $10 last_poi_type                  text
 *   $11 last_poi_key                   text
 *   $12 first_seen_at                  timestamptz  (nullable)
 *   $13 last_seen_at                   timestamptz  (nullable)
 *   $14 duration_seconds               int          (nullable)
 *   $15 repeated_poi_count             int
 *   $16 has_repetition                 bool
 *   $17 has_progression                bool
 *   $18 progression_depth              int
 *   $19 poi_sequence_pattern_class     text
 *   $20 stage0_excluded                bool
 *   $21 poi_sequence_eligible          bool  (= NOT stage0_excluded; defence in depth)
 *   $22 stage0_rule_id                 text  (nullable)
 *   $23 evidence_refs                  jsonb (stringified array of direct POI refs)
 *   $24 source_versions                jsonb (stringified object)
 *   $25 source_poi_observation_count   int   (= poi_count; CHECK)
 *   $26 source_min_poi_observation_id  bigint (nullable)
 *   $27 source_max_poi_observation_id  bigint (nullable)
 *   $28 derived_at                     timestamptz
 *
 * Total positional params: 28.
 * ------------------------------------------------------------------------ */

export const UPSERT_POI_SEQUENCE_OBSERVATION_SQL = `
  INSERT INTO poi_sequence_observations_v0_1 (
    workspace_id,
    site_id,
    session_id,
    poi_sequence_version,
    poi_observation_version,
    poi_count,
    unique_poi_count,
    first_poi_type,
    first_poi_key,
    last_poi_type,
    last_poi_key,
    first_seen_at,
    last_seen_at,
    duration_seconds,
    repeated_poi_count,
    has_repetition,
    has_progression,
    progression_depth,
    poi_sequence_pattern_class,
    stage0_excluded,
    poi_sequence_eligible,
    stage0_rule_id,
    evidence_refs,
    source_versions,
    source_poi_observation_count,
    source_min_poi_observation_id,
    source_max_poi_observation_id,
    derived_at
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7,
    $8, $9, $10, $11,
    $12, $13, $14,
    $15, $16, $17, $18, $19,
    $20, $21, $22,
    $23::jsonb, $24::jsonb,
    $25, $26, $27,
    $28
  )
  ON CONFLICT ON CONSTRAINT poi_seq_obs_v0_1_natural_key DO UPDATE SET
    poi_count                       = EXCLUDED.poi_count,
    unique_poi_count                = EXCLUDED.unique_poi_count,
    first_poi_type                  = EXCLUDED.first_poi_type,
    first_poi_key                   = EXCLUDED.first_poi_key,
    last_poi_type                   = EXCLUDED.last_poi_type,
    last_poi_key                    = EXCLUDED.last_poi_key,
    first_seen_at                   = EXCLUDED.first_seen_at,
    last_seen_at                    = EXCLUDED.last_seen_at,
    duration_seconds                = EXCLUDED.duration_seconds,
    repeated_poi_count              = EXCLUDED.repeated_poi_count,
    has_repetition                  = EXCLUDED.has_repetition,
    has_progression                 = EXCLUDED.has_progression,
    progression_depth               = EXCLUDED.progression_depth,
    poi_sequence_pattern_class      = EXCLUDED.poi_sequence_pattern_class,
    stage0_excluded                 = EXCLUDED.stage0_excluded,
    poi_sequence_eligible           = EXCLUDED.poi_sequence_eligible,
    stage0_rule_id                  = EXCLUDED.stage0_rule_id,
    evidence_refs                   = EXCLUDED.evidence_refs,
    source_versions                 = EXCLUDED.source_versions,
    source_poi_observation_count    = EXCLUDED.source_poi_observation_count,
    source_min_poi_observation_id   = EXCLUDED.source_min_poi_observation_id,
    source_max_poi_observation_id   = EXCLUDED.source_max_poi_observation_id,
    derived_at                      = EXCLUDED.derived_at,
    updated_at                      = NOW()
  RETURNING
    poi_sequence_observation_id,
    (xmax = 0) AS inserted
`;
