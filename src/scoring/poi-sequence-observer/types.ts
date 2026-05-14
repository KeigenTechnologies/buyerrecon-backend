/**
 * Sprint 2 PR#12b — POI Sequence Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Read-only diagnostic over `poi_observations_v0_1` (the durable POI
 * evidence layer PR#11c created). Groups POI rows by
 * (workspace_id, site_id, session_id) and derives in-memory POI
 * Sequence facts: pattern class (single_poi / repeated_same_poi /
 * multi_poi_linear / loop_or_backtrack / insufficient_temporal_data
 * / unknown), poi_count, unique_poi_count, first/last POI, duration,
 * Stage 0 carry-through.
 *
 * IMPORTANT (PR#12b locked boundary — see
 * docs/architecture/buyerrecon-workflow-locked-v0.1.md §4C + §9):
 *   - Observer reads ONLY `poi_observations_v0_1` and
 *     `information_schema.tables` (table-presence check).
 *   - Observer NEVER reads `session_features`,
 *     `session_behavioural_features_v0_2`, `stage0_decisions`,
 *     `accepted_events`, `rejected_events`, `ingest_requests`,
 *     `risk_observations_v0_1`, `scoring_output_lane_a`,
 *     `scoring_output_lane_b`, or `site_write_tokens`. Source-vs-table
 *     comparison is out of scope here.
 *   - Observer writes nothing.
 *   - Observer emits NO score, NO verdict, NO reason codes, NO
 *     customer-facing field, NO Policy / Trust / Product-Context-Fit
 *     output. POI Sequence is evidence/feature-observation only.
 *   - POI Sequence is in-session POI ordering — NOT AMS Series Core
 *     (cross-session continuity). See workflow truth file §10 + §23
 *     for the reserved AMS Series-name guard.
 *   - Observer never logs the full session_id (masked via
 *     `truncateSessionId`) or the full DSN (masked via
 *     `parseDatabaseUrl`).
 */

import type { PoiType } from '../poi-core/index.js';

/* --------------------------------------------------------------------------
 * Version constant — frozen literal for PR#12b v0.1
 *
 * Stamped on every PoiSequenceRecord the observer builds. Future bumps
 * require an explicit contract amendment with Helen sign-off.
 * ------------------------------------------------------------------------ */

export const POI_SEQUENCE_VERSION = 'poi-sequence-v0.1' as const;
export type PoiSequenceVersion = typeof POI_SEQUENCE_VERSION;

/* --------------------------------------------------------------------------
 * Pattern taxonomy — v0.1
 *
 * `single_poi`                  : exactly one POI row for the session
 * `repeated_same_poi`           : poi_count >= 2 AND unique_poi_count == 1
 * `multi_poi_linear`            : unique_poi_count >= 2 AND no repeats
 * `loop_or_backtrack`           : unique_poi_count >= 2 AND at least one repeat
 * `insufficient_temporal_data`  : timestamps missing / inconsistent
 * `unknown`                     : fallback; MUST stay 0 in healthy runs
 * ------------------------------------------------------------------------ */

export const POI_SEQUENCE_PATTERN_CLASS = Object.freeze({
  single_poi:                 'single_poi',
  repeated_same_poi:          'repeated_same_poi',
  multi_poi_linear:           'multi_poi_linear',
  loop_or_backtrack:          'loop_or_backtrack',
  insufficient_temporal_data: 'insufficient_temporal_data',
  unknown:                    'unknown',
} as const);

export type PoiSequencePatternClass =
  | 'single_poi'
  | 'repeated_same_poi'
  | 'multi_poi_linear'
  | 'loop_or_backtrack'
  | 'insufficient_temporal_data'
  | 'unknown';

export const POI_SEQUENCE_PATTERN_CLASSES_ALLOWED: readonly PoiSequencePatternClass[] = Object.freeze([
  'single_poi',
  'repeated_same_poi',
  'multi_poi_linear',
  'loop_or_backtrack',
  'insufficient_temporal_data',
  'unknown',
] as const);

/* --------------------------------------------------------------------------
 * AnomalyKind — PR#12b invariant-violation taxonomy
 *
 * Each kind is observable from `poi_observations_v0_1` rows alone.
 * IDs only in anomaly samples (poi_observation_id BIGSERIAL); per
 * Helen's locked privacy rule no session_id / poi_key / evidence_refs
 * are surfaced.
 *
 * NOTE: `insufficient_temporal_data` and `unknown_pattern` are
 * pattern-classification edge cases that also count as anomalies for
 * the run-level health rollup.
 * ------------------------------------------------------------------------ */

export type AnomalyKind =
  | 'unknown_pattern'
  | 'insufficient_temporal_data'
  | 'invalid_evidence_refs'
  | 'invalid_source_versions'
  | 'forbidden_source_table'
  | 'forbidden_key_present';

export const ANOMALY_KINDS: readonly AnomalyKind[] = Object.freeze([
  'unknown_pattern',
  'insufficient_temporal_data',
  'invalid_evidence_refs',
  'invalid_source_versions',
  'forbidden_source_table',
  'forbidden_key_present',
] as const);

/* --------------------------------------------------------------------------
 * Allowed source_table for POI evidence rows.
 *
 * Pinned to `session_features` for v0.1 (matches the migration 014
 * CHECK constraint `poi_obs_v0_1_source_table_v0_1`). Future PRs may
 * widen this list; until then any POI row whose `source_table` is
 * anything else trips the `forbidden_source_table` anomaly.
 * ------------------------------------------------------------------------ */

export const ALLOWED_POI_SOURCE_TABLES: readonly string[] = Object.freeze([
  'session_features',
] as const);

/* --------------------------------------------------------------------------
 * Allowed evidence_refs source_table values
 *
 * The PR#11c worker writes evidence_refs entries that reference the
 * primary source row (session_features) and optionally the Stage 0
 * side-read (stage0_decisions). A future SBF side-read may add
 * `session_behavioural_features_v0_2`. Any other source_table inside
 * evidence_refs is treated as `invalid_evidence_refs`.
 * ------------------------------------------------------------------------ */

export const ALLOWED_EVIDENCE_REF_SOURCE_TABLES: readonly string[] = Object.freeze([
  'session_features',
  'session_behavioural_features_v0_2',
  'stage0_decisions',
] as const);

/* --------------------------------------------------------------------------
 * Forbidden key names — recursive sweep over evidence_refs / source_versions
 *
 * Mirrors PR#11d FORBIDDEN_COLUMNS but applied to JSONB content (not
 * SQL columns). Any of these names appearing as a JSON key anywhere
 * inside `evidence_refs` or `source_versions` trips the
 * `forbidden_key_present` anomaly.
 *
 * Constructed at module-load time so this file does not contain the
 * literal `verification_score` token (PR#3 carve-out; mirrors
 * PR#11d/types.ts precedent).
 * ------------------------------------------------------------------------ */

const VERIFICATION_SCORE_KEY = ['verification', 'score'].join('_');

export const FORBIDDEN_REF_KEYS: readonly string[] = Object.freeze([
  // Score / verdict / RiskOutput-shaped
  'risk_index', VERIFICATION_SCORE_KEY, 'evidence_band',
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
] as const);

/* --------------------------------------------------------------------------
 * Run options — runner accepts an already-constructed pg pool/client.
 * Env-var parsing happens in the CLI. The runner is pure of process-
 * env reads (mirrors PR#11d precedent).
 * ------------------------------------------------------------------------ */

export interface ObserverRunOptions {
  readonly workspace_id?:           string | null;
  readonly site_id?:                string | null;

  /** Time-window filter on `poi_observations_v0_1.derived_at`. */
  readonly window_start:            Date;
  readonly window_end:              Date;

  /** Hard cap on rows scanned. */
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
 * Internal — single POI row shape coming back from the SELECT.
 *
 * This is the runner's intermediate row type. NOT a public contract.
 * Field names match the column names from
 * `migrations/014_poi_observations_v0_1.sql`.
 *
 * `evidence_refs` and `source_versions` are JSONB columns; pg returns
 * them as already-parsed JS values (object/array/scalar). The runner
 * does NOT trust their shape — validation happens in the mapper /
 * report aggregator.
 * ------------------------------------------------------------------------ */

export interface PoiObservationRowRaw {
  readonly poi_observation_id:       unknown; // BIGSERIAL — coerced to number downstream
  readonly workspace_id:             unknown;
  readonly site_id:                  unknown;
  readonly session_id:               unknown;
  readonly poi_type:                 unknown;
  readonly poi_key:                  unknown;
  readonly poi_input_version:        unknown;
  readonly poi_observation_version:  unknown;
  readonly extraction_version:       unknown;
  readonly evidence_refs:            unknown;
  readonly source_versions:          unknown;
  readonly source_table:             unknown;
  readonly stage0_excluded:          unknown;
  readonly poi_eligible:             unknown;
  readonly first_seen_at:            unknown;
  readonly last_seen_at:             unknown;
  readonly derived_at:               unknown;
}

/* --------------------------------------------------------------------------
 * Per-session POI Sequence record (in-memory only — never persisted)
 * ------------------------------------------------------------------------ */

export interface PoiSequenceRecord {
  readonly poi_sequence_version:         PoiSequenceVersion;

  /** Identity boundary — surfaced ONLY in masked form on report output. */
  readonly workspace_id:                 string;
  readonly site_id:                      string;
  readonly session_id:                   string;

  /** Carry-through stamps (used to detect version drift across rows). */
  readonly poi_input_versions:           readonly string[];
  readonly poi_observation_versions:     readonly string[];
  readonly extraction_versions:          readonly string[];

  /** Sequence facts. */
  readonly poi_count:                    number;
  readonly unique_poi_count:             number;
  readonly first_poi_type:               PoiType | null;
  readonly first_poi_key_present:        boolean;
  readonly last_poi_type:                PoiType | null;
  readonly last_poi_key_present:         boolean;
  readonly first_seen_at:                string | null;  // ISO-8601
  readonly last_seen_at:                 string | null;  // ISO-8601
  readonly duration_seconds:             number;
  readonly repeated_poi_count:           number;
  readonly has_repetition:               boolean;
  readonly has_progression:              boolean;
  readonly progression_depth:            number;
  readonly poi_sequence_pattern_class:   PoiSequencePatternClass;

  /** Stage 0 carry-through (NOT a fresh Stage 0 decision). */
  readonly stage0_excluded:              boolean;
  readonly poi_sequence_eligible:        boolean;

  /** Evidence summary — POI observation IDs only (count + sample). */
  readonly evidence_refs_count:          number;

  /** Per-record anomaly flags (mirror the run-level rollup). */
  readonly anomaly_invalid_evidence_refs:    number;
  readonly anomaly_invalid_source_versions:  number;
  readonly anomaly_forbidden_source_table:   number;
  readonly anomaly_forbidden_key_present:    number;
}

/* --------------------------------------------------------------------------
 * Public report shape — what the runner emits to stdout (JSON)
 * ------------------------------------------------------------------------ */

export interface PoiSequenceObserverReport {
  /** Top-line POI rows seen + sequences built. */
  readonly rows_scanned:                          number;
  readonly sessions_seen:                         number;
  readonly poi_sequences_built:                   number;
  readonly unique_session_ids_seen:               number;
  readonly unique_workspace_site_pairs_seen:      number;

  /** Distribution over the 6 pattern classes. */
  readonly poi_sequence_pattern_class_distribution:
    Readonly<Record<PoiSequencePatternClass, number>>;

  /** poi_count_distribution — bucketed (1, 2, 3..5, 6..10, 11+). */
  readonly poi_count_distribution:                Readonly<Record<string, number>>;
  /** progression_depth_distribution — bucketed (1, 2, 3..5, 6..10, 11+). */
  readonly progression_depth_distribution:        Readonly<Record<string, number>>;

  /** Stage 0 / eligibility booleans. */
  readonly stage0_excluded_distribution:          BooleanDistribution;
  readonly poi_sequence_eligible_distribution:    BooleanDistribution;
  readonly has_repetition_distribution:           BooleanDistribution;
  readonly has_progression_distribution:          BooleanDistribution;

  /** Carry-through version stamps. */
  readonly poi_input_version_distribution:        Readonly<Record<string, number>>;
  readonly poi_observation_version_distribution:  Readonly<Record<string, number>>;

  /** Anomaly counters — every counter SHOULD be 0 in a healthy run. */
  readonly unknown_pattern_count:                 number;
  readonly insufficient_temporal_data_count:      number;
  readonly invalid_evidence_refs_count:           number;
  readonly invalid_source_versions_count:         number;
  readonly forbidden_source_table_count:          number;
  readonly forbidden_key_present_count:           number;
  readonly total_anomalies:                       number;

  /** Anomaly samples — non-PII `poi_observation_id` values only. */
  readonly anomaly_samples:                       Readonly<Record<AnomalyKind, readonly number[]>>;

  /** Identity diagnostics — session_ids masked, never raw. */
  readonly sample_session_id_prefixes:            readonly string[];

  readonly run_metadata:                          ObserverRunMetadata;
}

export interface ObserverRunMetadata {
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
  readonly run_started_at:                   string;
  readonly run_ended_at:                     string;
  readonly poi_sequence_version:             PoiSequenceVersion;
  readonly poi_input_version_expected:       string;
  readonly poi_observation_version_expected: string;
  readonly forbidden_ref_keys_checked:       readonly string[];
  readonly record_only:                      true;
}
