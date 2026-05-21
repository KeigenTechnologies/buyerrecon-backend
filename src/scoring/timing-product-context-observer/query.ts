/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer — SQL constants.
 *
 * Pure module. Read-only. SELECT only.
 *
 * ALLOWED reads (a strict superset of PR#13b's source set, per PR#18b §3):
 *   - `public.accepted_events`                          (primary)
 *   - `public.ingest_requests`                          (primary)
 *   - `public.rejected_events`                          (primary)
 *   - `public.session_features`                         (optional)
 *   - `public.session_behavioural_features_v0_2`        (optional)
 *   - `public.poi_observations_v0_1`                    (optional)
 *   - `public.poi_sequence_observations_v0_1`           (optional)
 *   - `public.risk_observations_v0_1`                   (optional)
 *   - `public.site_write_tokens`                        (label-only)
 *   - `public.scoring_output_lane_a`                    (count-only, expected 0)
 *   - `public.scoring_output_lane_b`                    (count-only, expected 0)
 *
 * FORBIDDEN: every DML / DDL verb (INSERT, UPDATE, DELETE, TRUNCATE,
 * ALTER, CREATE, DROP, GRANT, REVOKE). Enforced by the static-source
 * sweep in the PR#18c test suite. Counts of Lane A/B rows are read for
 * anomaly detection only — the observer is not a Lane A/B writer.
 *
 * All primary SELECTs are bounded by:
 *   - (`workspace_id`, `site_id`) — the staging or commercial boundary
 *   - `[window_start, window_end)` — exclusive upper bound
 *   - LIMIT — bounded fetch size
 */

/* --------------------------------------------------------------------------
 * Table-presence probes via `to_regclass`. Tolerant of optional sources.
 * ------------------------------------------------------------------------ */

export const SELECT_TABLE_PRESENT_TO_REGCLASS_SQL = `
SELECT to_regclass($1) IS NOT NULL AS present
`;

/* --------------------------------------------------------------------------
 * Primary accepted_events fetch.
 *
 * Param order:
 *   $1 window_start (timestamptz, inclusive)
 *   $2 window_end   (timestamptz, exclusive)
 *   $3 workspace_id (text)
 *   $4 site_id      (text)
 *   $5 limit        (int)
 *
 * Columns chosen are categorical / structural only — no payload,
 * no canonical_jsonb, no request_id UUID output beyond the joined
 * value used internally for grouping (UUID values are never surfaced
 * in the report; only categorical evidence_refs counts are emitted).
 * ------------------------------------------------------------------------ */

export const SELECT_ACCEPTED_EVENTS_SQL = `
SELECT
  request_id,
  workspace_id,
  site_id,
  session_id,
  schema_key,
  schema_version,
  event_origin,
  event_type,
  received_at
FROM public.accepted_events
WHERE received_at >= $1
  AND received_at <  $2
  AND workspace_id = $3
  AND site_id      = $4
ORDER BY received_at ASC
LIMIT $5
`;

/* --------------------------------------------------------------------------
 * Primary ingest_requests fetch — categorical fields only.
 * ------------------------------------------------------------------------ */

export const SELECT_INGEST_REQUESTS_SQL = `
SELECT
  request_id,
  workspace_id,
  site_id,
  endpoint,
  http_status,
  auth_status,
  reject_reason_code,
  received_at,
  expected_event_count,
  accepted_count,
  rejected_count
FROM public.ingest_requests
WHERE received_at >= $1
  AND received_at <  $2
  AND workspace_id = $3
  AND site_id      = $4
ORDER BY received_at ASC
LIMIT $5
`;

/* --------------------------------------------------------------------------
 * Primary rejected_events fetch — categorical reason fields only.
 * ------------------------------------------------------------------------ */

export const SELECT_REJECTED_EVENTS_SQL = `
SELECT
  request_id,
  workspace_id,
  site_id,
  schema_key,
  schema_version,
  event_type,
  rejected_stage,
  reason_code,
  received_at
FROM public.rejected_events
WHERE received_at >= $1
  AND received_at <  $2
  AND workspace_id = $3
  AND site_id      = $4
ORDER BY received_at ASC
LIMIT $5
`;

/* --------------------------------------------------------------------------
 * Optional source counts (window-bounded, count-only).
 *
 * Each query is gated by a prior presence probe; missing optional
 * tables degrade to count=0 without failing the run.
 *
 * Param order: $1 window_start, $2 window_end, $3 workspace_id, $4 site_id.
 * ------------------------------------------------------------------------ */

export const COUNT_SESSION_FEATURES_SQL = `
SELECT count(*)::bigint AS n
  FROM public.session_features
 WHERE workspace_id = $3
   AND site_id      = $4
   AND last_seen_at >= $1
   AND last_seen_at <  $2
`;

export const COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL = `
SELECT count(*)::bigint AS n
  FROM public.session_behavioural_features_v0_2
 WHERE workspace_id = $3
   AND site_id      = $4
   AND last_seen_at >= $1
   AND last_seen_at <  $2
`;

export const COUNT_POI_OBSERVATIONS_SQL = `
SELECT count(*)::bigint AS n
  FROM public.poi_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND derived_at   >= $1
   AND derived_at   <  $2
`;

export const COUNT_POI_SEQUENCE_OBSERVATIONS_SQL = `
SELECT count(*)::bigint AS n
  FROM public.poi_sequence_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND derived_at   >= $1
   AND derived_at   <  $2
`;

export const COUNT_RISK_OBSERVATIONS_SQL = `
SELECT count(*)::bigint AS n
  FROM public.risk_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND derived_at   >= $1
   AND derived_at   <  $2
`;

/* --------------------------------------------------------------------------
 * Lane A/B anomaly counts (PR#18b §9.3 / §9.4 expectation: 0 / 0).
 *
 * Param order: $1 workspace_id, $2 site_id.
 * ------------------------------------------------------------------------ */

export const COUNT_SCORING_OUTPUT_LANE_A_SQL = `
SELECT count(*)::bigint AS n
  FROM public.scoring_output_lane_a
 WHERE workspace_id = $1
   AND site_id      = $2
`;

export const COUNT_SCORING_OUTPUT_LANE_B_SQL = `
SELECT count(*)::bigint AS n
  FROM public.scoring_output_lane_b
 WHERE workspace_id = $1
   AND site_id      = $2
`;

/* --------------------------------------------------------------------------
 * Synthetic-fixture token labels (categorical only — label column only,
 * never token_hash / token_id / pepper / DSN).
 *
 * Param order: $1 workspace_id, $2 site_id.
 * ------------------------------------------------------------------------ */

export const SELECT_SYNTHETIC_FIXTURE_TOKEN_LABELS_SQL = `
SELECT label
  FROM public.site_write_tokens
 WHERE workspace_id = $1
   AND site_id      = $2
   AND label = ANY($3::text[])
`;
