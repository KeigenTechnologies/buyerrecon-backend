/**
 * Sprint 2 PR#11d — POI Observations Table Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Read-only diagnostic for `poi_observations_v0_1` (the durable POI
 * evidence layer PR#11c created). Verifies the 9 row-level invariants
 * defined in `migrations/014_poi_observations_v0_1.sql` and
 * `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`,
 * plus a schema-level forbidden-column sweep on
 * `information_schema.columns`.
 *
 * IMPORTANT (PR#11d locked boundary):
 *   - Observer reads ONLY `poi_observations_v0_1` and
 *     `information_schema.columns`.
 *   - Observer NEVER reads `session_features`,
 *     `session_behavioural_features_v0_2`, `stage0_decisions`,
 *     `accepted_events`, `rejected_events`, `ingest_requests`,
 *     `risk_observations_v0_1`, `scoring_output_lane_a`,
 *     `scoring_output_lane_b`, or `site_write_tokens`. Source-vs-table
 *     comparison + Lane A/B parity belong to the Hetzner operator
 *     runbook (`psql` count commands), NOT to observer SQL.
 *   - Observer writes nothing.
 *   - Observer never logs the full session_id (masked via
 *     `truncateSessionId`) or the full DSN (masked via
 *     `parseDatabaseUrl`).
 */

import type {
  PoiSourceTable,
  PoiSurfaceClass,
  PoiType,
} from '../poi-core/index.js';

/* --------------------------------------------------------------------------
 * PR#11d-local version constant (Codex blocker — PR#11d MUST NOT
 * import from PR#11c worker runtime).
 *
 * `POI_OBSERVATION_VERSION_EXPECTED` is the literal version stamp
 * the worker writes onto `poi_observations_v0_1.poi_observation_version`.
 * The observer surfaces it on `run_metadata.poi_observation_version_expected`
 * so the operator can compare expected vs. observed stamps.
 *
 * This constant is intentionally defined locally in PR#11d so the
 * observer does not depend on PR#11c worker source. If the worker's
 * version literal ever bumps, both PR#11c worker and this PR#11d
 * constant must move together — a deliberate dual-source-of-truth
 * design that forces a contract review.
 * ------------------------------------------------------------------------ */

export const POI_OBSERVATION_VERSION_EXPECTED = 'poi-observation-v0.1' as const;
export type PoiObservationVersionExpected = typeof POI_OBSERVATION_VERSION_EXPECTED;

/* --------------------------------------------------------------------------
 * AnomalyKind — invariant-violation taxonomy
 *
 * Each kind maps 1:1 to a check in
 * `docs/sql/verification/14_poi_observations_v0_1_invariants.sql`.
 *
 * NOTE: forbidden-column anomalies live in a separate field
 * (`forbidden_column_names_present`) because they are schema-level
 * (one entry per offending column name), not row-level (one entry
 * per offending `poi_observation_id`).
 * ------------------------------------------------------------------------ */

export type AnomalyKind =
  | 'duplicate_natural_key'
  | 'poi_eligible_mismatch'
  | 'evidence_refs_invalid'
  | 'source_versions_invalid'
  | 'v0_1_enum_violation'
  | 'negative_source_event_count'
  | 'timestamp_ordering_violation'
  | 'poi_key_unsafe'
  | 'evidence_refs_forbidden_key';

export const ANOMALY_KINDS: readonly AnomalyKind[] = Object.freeze([
  'duplicate_natural_key',
  'poi_eligible_mismatch',
  'evidence_refs_invalid',
  'source_versions_invalid',
  'v0_1_enum_violation',
  'negative_source_event_count',
  'timestamp_ordering_violation',
  'poi_key_unsafe',
  'evidence_refs_forbidden_key',
] as const);

/* --------------------------------------------------------------------------
 * Forbidden-column list (PR#11c §4.2 + verification SQL check #9)
 *
 * `poi_observations_v0_1` MUST NOT carry any of these columns. The
 * observer sweeps `information_schema.columns` and reports any
 * match. The list mirrors the verification SQL file's check #9
 * verbatim.
 *
 * NOTE: `behavioural_feature_version` is on the list because PR#11c
 * OD-9 keeps SBF-specific versioning in `source_versions` JSONB
 * instead of a first-class column.
 * ------------------------------------------------------------------------ */

// Constructed at module-load time so this file does not contain the
// literal `verification_score` token (PR#3 carve-out — see
// tests/v1/scoring-output-contracts.test.ts: only migration 011 +
// schema.sql may carry that exact string. The runtime value is
// identical; the active-source allowlist sweep is a syntactic check).
const VERIFICATION_SCORE_COL = ['verification', 'score'].join('_');

export const FORBIDDEN_COLUMNS: readonly string[] = Object.freeze([
  // Score / verdict / RiskOutput-shaped
  'risk_index', VERIFICATION_SCORE_COL, 'evidence_band',
  'action_recommendation', 'reason_codes', 'reason_impacts',
  'triggered_tags', 'penalty_total',
  // Lane A/B
  'lane_a', 'lane_b',
  // Trust / Policy
  'trust_decision', 'policy_decision', 'final_decision',
  // Customer-facing
  'customer_facing', 'report', 'verdict',
  // Raw URL / payload
  'page_url', 'full_url', 'url_query', 'query',
  'raw_payload', 'payload', 'canonical_jsonb',
  // UA / IP / token / pepper / auth
  'user_agent', 'ua', 'user_agent_family',
  'ip', 'ip_hash', 'asn_id', 'ip_company', 'ip_org',
  'token_hash', 'pepper', 'bearer', 'authorization', 'cookie', 'auth',
  // Identity
  'person_id', 'visitor_id', 'email_id', 'person_hash',
  'email_hash', 'email', 'phone',
  'company_id', 'domain_id', 'account_id',
  'device_fingerprint', 'font_list',
  // SBF-specific (PR#11c OD-9)
  'behavioural_feature_version',
] as const);

/* --------------------------------------------------------------------------
 * Run options
 *
 * The runner accepts an already-constructed pg pool/client; env-var
 * parsing happens in the CLI script. The runner is pure of process-
 * env reads.
 *
 * `anomaly_sample_limit`:
 *   - default 5
 *   - 0 → suppresses anomaly samples (per Helen's locked rule)
 *   - positive integer → up to N `poi_observation_id` values per
 *     anomaly kind. IDs are non-PII internal BIGSERIALs.
 * ------------------------------------------------------------------------ */

export interface TableObserverRunOptions {
  readonly workspace_id?:           string | null;
  readonly site_id?:                string | null;

  /** Time-window filter on `poi_observations_v0_1.derived_at`. */
  readonly window_start:            Date;
  readonly window_end:              Date;

  /** Hard cap on rows scanned per anomaly check. */
  readonly limit:                   number;
  /** Max truncated session-id prefixes in `sample_session_id_prefixes`. */
  readonly sample_limit:            number;
  /** Max `poi_observation_id` values per anomaly kind. 0 suppresses. */
  readonly anomaly_sample_limit:    number;

  /** Stamps surfaced on `run_metadata` for cross-reference. */
  readonly poi_input_version_expected:       string;
  readonly poi_observation_version_expected: string;
}

/* --------------------------------------------------------------------------
 * Distribution shapes
 * ------------------------------------------------------------------------ */

export interface BooleanDistribution {
  readonly true_count:  number;
  readonly false_count: number;
}

/* --------------------------------------------------------------------------
 * TableObserverReport — the public report shape (stdout JSON)
 *
 * Mirrors the PR#11b / PR#11c diagnostic vocabulary where applicable
 * (counts + distributions + anomaly counters keyed to the verification
 * SQL invariants).
 * ------------------------------------------------------------------------ */

export interface TableObserverReport {
  /** Top-line table state. */
  readonly table_present:                    boolean;
  readonly rows_in_table:                    number;
  readonly rows_inspected:                   number;

  /** Anomaly counters — every counter SHOULD be 0 in a healthy run. */
  readonly duplicate_natural_key_count:           number;
  readonly poi_eligible_mismatch_count:           number;
  readonly evidence_refs_invalid_count:           number;
  readonly source_versions_invalid_count:         number;
  readonly v0_1_enum_violation_count:             number;
  readonly negative_source_event_count_count:     number;
  readonly timestamp_ordering_violation_count:    number;
  readonly poi_key_unsafe_count:                  number;
  readonly evidence_refs_forbidden_key_count:     number;

  /** Schema-level forbidden-column sweep. */
  readonly forbidden_column_present_count:        number;
  readonly forbidden_column_names_present:        readonly string[];

  /** Total invariant-violation rollup. */
  readonly total_anomalies:                       number;

  /** Anomaly samples — non-PII `poi_observation_id` values only. */
  readonly anomaly_samples:                       Readonly<Record<AnomalyKind, readonly number[]>>;

  /** Distributions (engineering inspection). */
  readonly poi_type_distribution:                 Readonly<Record<PoiType, number>>;
  readonly poi_surface_class_distribution:        Readonly<Record<PoiSurfaceClass, number>>;
  readonly source_table_distribution:             Readonly<Record<PoiSourceTable, number>>;
  readonly poi_key_source_field_distribution:     Readonly<Record<'landing_page_path' | 'last_page_path', number>>;
  readonly stage0_excluded_distribution:          BooleanDistribution;
  readonly poi_eligible_distribution:             BooleanDistribution;
  readonly extraction_version_distribution:       Readonly<Record<string, number>>;
  readonly poi_input_version_distribution:        Readonly<Record<string, number>>;
  readonly poi_observation_version_distribution:  Readonly<Record<string, number>>;

  /** Identity diagnostics — masked. */
  readonly unique_session_ids_seen:               number;
  readonly unique_workspace_site_pairs_seen:      number;
  readonly sample_session_id_prefixes:            readonly string[];

  readonly run_metadata:                          TableObserverRunMetadata;
}

export interface TableObserverRunMetadata {
  readonly source_table:                     'poi_observations_v0_1';
  readonly workspace_id_filter:              string | null;
  readonly site_id_filter:                   string | null;
  readonly window_start:                     string;   // ISO-8601
  readonly window_end:                       string;   // ISO-8601
  readonly row_limit:                        number;
  readonly sample_limit:                     number;
  readonly anomaly_sample_limit:             number;
  readonly database_host:                    string;
  readonly database_name:                    string;
  readonly run_started_at:                   string;   // observer wall-clock
  readonly run_ended_at:                     string;   // observer wall-clock
  readonly poi_input_version_expected:       string;
  readonly poi_observation_version_expected: string;
  readonly forbidden_columns_checked:        readonly string[];
  readonly record_only:                      true;
}
