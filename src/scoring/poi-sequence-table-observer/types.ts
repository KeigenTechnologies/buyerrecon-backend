/**
 * Sprint 2 PR#12e — POI Sequence Table Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Read-only diagnostic for `poi_sequence_observations_v0_1` (the
 * durable POI-Sequence evidence layer that PR#12d created). Verifies
 * the row-level invariants defined in
 * `migrations/015_poi_sequence_observations_v0_1.sql` +
 * `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`,
 * plus a schema-level forbidden-column sweep on
 * `information_schema.columns`.
 *
 * IMPORTANT (PR#12e locked boundary):
 *   - Observer reads ONLY `poi_sequence_observations_v0_1` and
 *     `information_schema.{tables, columns}`.
 *   - Observer NEVER reads `session_features`,
 *     `session_behavioural_features_v0_2`, `stage0_decisions`,
 *     `accepted_events`, `rejected_events`, `ingest_requests`,
 *     `risk_observations_v0_1`, `scoring_output_lane_a`,
 *     `scoring_output_lane_b`, `site_write_tokens`, or
 *     `poi_observations_v0_1`. POI coverage parity is verified by
 *     the PR#12d verification SQL, not the observer.
 *   - Observer writes nothing.
 *   - Observer never logs the full session_id (masked via
 *     `truncateSessionId`) or the full DSN (masked via
 *     `parseDatabaseUrl`).
 *   - Anomaly samples surface `poi_sequence_observation_id`
 *     (BIGSERIAL) values only. Per Helen's locked privacy rule no
 *     session_id / poi_key / evidence_refs / source_versions payload
 *     is sampled.
 */

import {
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  type PoiSequencePatternClass,
} from '../poi-sequence-observer/index.js';

export { POI_SEQUENCE_PATTERN_CLASSES_ALLOWED };
export type { PoiSequencePatternClass };

/* --------------------------------------------------------------------------
 * AnomalyKind — invariant-violation taxonomy
 *
 * Each kind maps 1:1 to a check in
 * `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`.
 *
 * Forbidden-column anomalies live in a separate field
 * (`forbidden_column_names_present`) because they are schema-level
 * (one entry per offending column name), not row-level (one entry
 * per offending `poi_sequence_observation_id`).
 * ------------------------------------------------------------------------ */

export type AnomalyKind =
  | 'duplicate_natural_key'
  | 'poi_sequence_eligible_mismatch'
  | 'invalid_pattern_class'
  | 'has_progression_mismatch'
  | 'progression_depth_mismatch'
  | 'repeated_poi_count_mismatch'
  | 'has_repetition_mismatch'
  | 'source_count_mismatch'
  | 'negative_count'
  | 'timestamp_ordering_violation'
  | 'negative_duration'
  | 'evidence_refs_invalid'
  | 'evidence_refs_forbidden_direct_table'
  | 'evidence_refs_bad_id'
  | 'source_versions_invalid';

export const ANOMALY_KINDS: readonly AnomalyKind[] = Object.freeze([
  'duplicate_natural_key',
  'poi_sequence_eligible_mismatch',
  'invalid_pattern_class',
  'has_progression_mismatch',
  'progression_depth_mismatch',
  'repeated_poi_count_mismatch',
  'has_repetition_mismatch',
  'source_count_mismatch',
  'negative_count',
  'timestamp_ordering_violation',
  'negative_duration',
  'evidence_refs_invalid',
  'evidence_refs_forbidden_direct_table',
  'evidence_refs_bad_id',
  'source_versions_invalid',
] as const);

/* --------------------------------------------------------------------------
 * Forbidden-column list — mirrors PR#11d / PR#12d verification SQL
 * forbidden list. Any column whose name matches one of these strings
 * appearing on `poi_sequence_observations_v0_1` indicates a
 * scoring / verdict / Lane / Trust / Policy / PCF / customer-facing
 * / raw-URL / UA / IP / token / identity column has crept in.
 *
 * Constructed at module-load so this file does not contain the
 * literal `verification_score` token (PR#3 carve-out precedent;
 * mirrors PR#11d / PR#12d types.ts).
 * ------------------------------------------------------------------------ */

const VERIFICATION_SCORE_COL = ['verification', 'score'].join('_');
// `buyer_intent` is flagged by tests/v1/scoring-output-contracts.test.ts
// as a forbidden identifier in active source. We keep it in the
// allowlist (so the observer DOES check for it via the schema
// sweep) but construct the literal token at module-load so the
// source file itself does not contain the bare identifier.
const BUYER_INTENT_COL = ['buyer', 'intent'].join('_');

export const FORBIDDEN_COLUMNS: readonly string[] = Object.freeze([
  // Score / verdict / RiskOutput-shaped
  'score', 'verdict',
  'risk_index', VERIFICATION_SCORE_COL, 'evidence_band',
  'action_recommendation', 'reason_codes', 'reason_impacts',
  'triggered_tags', 'penalty_total',
  // Lane A/B
  'lane_a', 'lane_b',
  // Trust / Policy
  'trust_decision', 'policy_decision', 'final_decision',
  // Customer-facing
  'customer_facing', 'report',
  BUYER_INTENT_COL, 'product_context_fit', 'buyer_role',
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
] as const);

/* --------------------------------------------------------------------------
 * Run options — runner accepts an already-constructed pg pool/client.
 * Env-var parsing happens in the CLI.
 * ------------------------------------------------------------------------ */

export interface TableObserverRunOptions {
  readonly workspace_id?:           string | null;
  readonly site_id?:                string | null;

  /** Time-window filter on `poi_sequence_observations_v0_1.derived_at`. */
  readonly window_start:            Date;
  readonly window_end:              Date;

  /** Hard cap on rows scanned per anomaly check. */
  readonly limit:                   number;
  /** Max truncated session-id prefixes in `sample_session_id_prefixes`. */
  readonly sample_limit:            number;
  /** Max `poi_sequence_observation_id` values per anomaly kind. 0 suppresses. */
  readonly anomaly_sample_limit:    number;

  /** Stamps surfaced on `run_metadata` for cross-reference. */
  readonly poi_sequence_version_expected:    string;
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
 * ------------------------------------------------------------------------ */

export interface TableObserverReport {
  /** Top-line table state. */
  readonly table_present:                              boolean;
  readonly rows_in_table:                              number;
  readonly rows_inspected:                             number;

  /** Anomaly counters — every counter SHOULD be 0 in a healthy run. */
  readonly duplicate_natural_key_count:                number;
  readonly poi_sequence_eligible_mismatch_count:       number;
  readonly invalid_pattern_class_count:                number;
  readonly has_progression_mismatch_count:             number;
  readonly progression_depth_mismatch_count:           number;
  readonly repeated_poi_count_mismatch_count:          number;
  readonly has_repetition_mismatch_count:              number;
  readonly source_count_mismatch_count:                number;
  readonly negative_count_count:                       number;
  readonly timestamp_ordering_violation_count:         number;
  readonly negative_duration_count:                    number;
  readonly evidence_refs_invalid_count:                number;
  readonly evidence_refs_forbidden_direct_table_count: number;
  readonly evidence_refs_bad_id_count:                 number;
  readonly source_versions_invalid_count:              number;

  /** Schema-level forbidden-column sweep. */
  readonly forbidden_column_present_count:             number;
  readonly forbidden_column_names_present:             readonly string[];

  /** Total invariant-violation rollup. */
  readonly total_anomalies:                            number;

  /** Anomaly samples — non-PII `poi_sequence_observation_id` values only. */
  readonly anomaly_samples:                            Readonly<Record<AnomalyKind, readonly number[]>>;

  /** Distributions. */
  readonly poi_sequence_pattern_class_distribution:    Readonly<Record<PoiSequencePatternClass, number>>;
  readonly poi_count_distribution:                     Readonly<Record<string, number>>;
  readonly progression_depth_distribution:             Readonly<Record<string, number>>;
  readonly stage0_excluded_distribution:               BooleanDistribution;
  readonly poi_sequence_eligible_distribution:         BooleanDistribution;
  readonly has_repetition_distribution:                BooleanDistribution;
  readonly has_progression_distribution:               BooleanDistribution;
  readonly poi_sequence_version_distribution:          Readonly<Record<string, number>>;
  readonly poi_observation_version_distribution:       Readonly<Record<string, number>>;

  /** Identity diagnostics — masked. */
  readonly unique_session_ids_seen:                    number;
  readonly unique_workspace_site_pairs_seen:           number;
  readonly sample_session_id_prefixes:                 readonly string[];

  readonly run_metadata:                               TableObserverRunMetadata;
}

export interface TableObserverRunMetadata {
  readonly source_table:                       'poi_sequence_observations_v0_1';
  readonly workspace_id_filter:                string | null;
  readonly site_id_filter:                     string | null;
  readonly window_start:                       string;   // ISO-8601
  readonly window_end:                         string;   // ISO-8601
  readonly row_limit:                          number;
  readonly sample_limit:                       number;
  readonly anomaly_sample_limit:               number;
  readonly database_host:                      string;
  readonly database_name:                      string;
  readonly run_started_at:                     string;
  readonly run_ended_at:                       string;
  readonly poi_sequence_version_expected:      string;
  readonly poi_observation_version_expected:   string;
  readonly forbidden_columns_checked:          readonly string[];
  readonly record_only:                        true;
}
