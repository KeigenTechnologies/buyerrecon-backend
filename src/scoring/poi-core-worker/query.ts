/**
 * Sprint 2 PR#11c — POI Core Worker — parameterised SQL.
 *
 * Pure module. The worker (`worker.ts`) actually issues these against
 * `pg`. All queries use positional parameters; string concatenation
 * of user input into SQL is forbidden (zero occurrences).
 *
 * Allowed sources (PR#11c planning §5.2 / OD-5):
 *   - `session_features`  — primary POI source (SELECT)
 *   - `stage0_decisions`  — side-read only (SELECT by lineage)
 *
 * Allowed sink:
 *   - `poi_observations_v0_1` — single INSERT … ON CONFLICT DO UPDATE
 *
 * Forbidden sources (PR#11c planning §5.2 / OD-3):
 *   - `session_behavioural_features_v0_2` (PR#11c v0.1 does not read SBF)
 *   - `accepted_events`, `rejected_events`, `ingest_requests`
 *   - `risk_observations_v0_1`
 *   - `scoring_output_lane_a`, `scoring_output_lane_b`
 *   - `site_write_tokens`
 *
 * Forbidden writes:
 *   - any table other than `poi_observations_v0_1`
 *   - any `INSERT/UPDATE/DELETE` on `scoring_output_lane_a` or `_b`
 *
 * Static-source assertions in `tests/v1/poi-core-worker.test.ts` grep
 * this file for the forbidden patterns above.
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
 *
 * The column list mirrors PR#11b's `SELECT_SESSION_FEATURES_SQL`
 * verbatim — same fields, same order — so the worker can re-use the
 * same SF-row mapper shape.
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
 * Stage 0 side-read by lineage (workspace_id, site_id, session_id).
 *
 * Param order:
 *   $1 workspace_id (TEXT)
 *   $2 site_id      (TEXT)
 *   $3 session_id   (TEXT)
 *
 * LIMIT 2 lets the runner distinguish "exactly 1" from "≥ 2" — the
 * multi-row case rejects INVALID_STAGE0_CONTEXT (the worker MUST NOT
 * guess which Stage 0 row to consume).
 *
 * Stage 0 is side-read ONLY. Per PR#11c planning OD-2 / OD-8 the
 * Stage 0 row may populate `stage0_excluded`, `poi_eligible`,
 * `stage0_rule_id`, and one evidence_refs entry — and nothing else.
 * It NEVER becomes the primary `source_table`, POI key, POI context,
 * scoring reason, customer-facing reason code, downstream judgement,
 * Policy/Trust reason, report language, or Product-Context-Fit input.
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

/**
 * UPSERT against `poi_observations_v0_1`.
 *
 * Idempotent. Re-running over the same SF window with the same
 * envelope produces the same row count. `ON CONFLICT DO UPDATE`
 * always sets `updated_at = NOW()` per PR#11c planning OD-6.1.
 *
 * The `RETURNING (xmax = 0) AS inserted` is the PostgreSQL idiom for
 * "was this an INSERT (xmax = 0) or a conflict-UPDATE (xmax != 0)?"
 * The worker uses it to increment rows_inserted vs rows_updated.
 *
 * Param order (21 positional params; `record_only` is hard-coded TRUE
 * in VALUES per PR#6 precedent):
 *   $1  workspace_id              TEXT
 *   $2  site_id                   TEXT
 *   $3  session_id                TEXT
 *   $4  poi_type                  TEXT       — v0.1: always 'page_path'
 *   $5  poi_key                   TEXT       — PR#10-normalised
 *   $6  poi_surface_class         TEXT       — nullable; finite enum when set
 *   $7  poi_input_version         TEXT       — = POI_CORE_INPUT_VERSION
 *   $8  poi_observation_version   TEXT       — = POI_OBSERVATION_VERSION_DEFAULT
 *   $9  extraction_version        TEXT       — SF row's extraction_version
 *  $10  evidence_refs             JSONB      — non-empty array (DB CHECK)
 *  $11  source_table              TEXT       — v0.1: always 'session_features'
 *  $12  source_row_id             TEXT
 *  $13  source_event_count        INT
 *  $14  poi_key_source_field      TEXT       — 'landing_page_path' | 'last_page_path'
 *  $15  source_versions           JSONB      — forward-compat versions map
 *  $16  stage0_excluded           BOOLEAN
 *  $17  poi_eligible              BOOLEAN    — MUST equal NOT stage0_excluded
 *  $18  stage0_rule_id            TEXT       — nullable; provenance-only
 *  $19  first_seen_at             TIMESTAMPTZ — nullable
 *  $20  last_seen_at              TIMESTAMPTZ — nullable
 *  $21  derived_at                TIMESTAMPTZ — NOT NULL; from SF.extracted_at
 *
 * The ON CONFLICT key is the 8-column natural key (per OD-3).
 * `source_table`, `created_at`, and `record_only` are intentionally
 * NOT in the UPDATE list (CHECK-pinned / DB-managed / literal).
 */
export const UPSERT_POI_OBSERVATION_SQL = `
INSERT INTO poi_observations_v0_1 (
  workspace_id,
  site_id,
  session_id,
  poi_type,
  poi_key,
  poi_surface_class,
  poi_input_version,
  poi_observation_version,
  extraction_version,
  evidence_refs,
  source_table,
  source_row_id,
  source_event_count,
  poi_key_source_field,
  source_versions,
  stage0_excluded,
  poi_eligible,
  stage0_rule_id,
  first_seen_at,
  last_seen_at,
  derived_at,
  record_only
) VALUES (
  $1, $2, $3, $4, $5,
  $6, $7, $8, $9,
  $10::jsonb,
  $11, $12, $13, $14,
  $15::jsonb,
  $16, $17, $18,
  $19, $20, $21,
  TRUE
)
ON CONFLICT (workspace_id, site_id, session_id, poi_type, poi_key,
             poi_input_version, poi_observation_version, extraction_version)
DO UPDATE SET
  poi_surface_class       = EXCLUDED.poi_surface_class,
  evidence_refs           = EXCLUDED.evidence_refs,
  source_row_id           = EXCLUDED.source_row_id,
  source_event_count      = EXCLUDED.source_event_count,
  poi_key_source_field    = EXCLUDED.poi_key_source_field,
  source_versions         = EXCLUDED.source_versions,
  stage0_excluded         = EXCLUDED.stage0_excluded,
  poi_eligible            = EXCLUDED.poi_eligible,
  stage0_rule_id          = EXCLUDED.stage0_rule_id,
  first_seen_at           = EXCLUDED.first_seen_at,
  last_seen_at            = EXCLUDED.last_seen_at,
  derived_at              = EXCLUDED.derived_at,
  updated_at              = NOW()
RETURNING poi_observation_id, (xmax = 0) AS inserted
`;
