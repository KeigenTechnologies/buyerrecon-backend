/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * IMPORTANT (PR#8a §1):
 *   The observer is a read-only internal engineering diagnostic. It
 *   is NOT Policy Pass 1, NOT scoring_output_lane_a, NOT a Lane A/B
 *   writer, NOT a RiskOutput emitter, NOT a Trust output, NOT a
 *   product-fit / timing output, NOT a customer-facing report, NOT
 *   an envelope persistence layer. The shapes below carry that
 *   restriction structurally — no field on `ObserverReport` may
 *   match any of those concerns.
 *
 * Helen sign-off OD-1..OD-8 (recorded in PR#8a):
 *   OD-1 read-only observer
 *   OD-2 runs before Policy Pass 1
 *   OD-3 reads only risk_observations_v0_1 + optional stage0_decisions
 *   OD-4 no accepted_events / SBF / session_features reads in v0
 *   OD-5 production runs require explicit Helen unlock
 *   OD-6 truncated session IDs only
 *   OD-7 reject labels are observer diagnostics only (NOT product reason codes)
 *   OD-8 no envelope persistence
 */

import type {
  EvidenceRef,
  RiskCoreBridgeEnvelope,
} from '../risk-core-bridge/index.js';

/* --------------------------------------------------------------------------
 * RejectReason — observer diagnostic taxonomy (PR#8a §8)
 *
 * Internal labels. NOT product reason codes, NOT Lane A/B codes, NOT
 * `reason_code_dictionary.yml` entries. They appear only in the
 * engineering report.
 * ------------------------------------------------------------------------ */

export type RejectReason =
  | 'MISSING_REQUIRED_ID'
  | 'MISSING_EVIDENCE_REFS'
  | 'MISSING_SBF_EVIDENCE_REF'
  | 'MISSING_SBF_FEATURE_VERSION'
  | 'BEHAVIOURAL_FEATURE_VERSION_MISMATCH'
  | 'MISSING_DERIVED_AT'
  | 'INVALID_CONTEXT_TAG'
  | 'INVALID_RISK_VALUE'
  | 'INVALID_STAGE0_CONTEXT'
  | 'ADAPTER_VALIDATION_ERROR'
  | 'UNEXPECTED_ERROR';

export const REJECT_REASONS: readonly RejectReason[] = Object.freeze([
  'MISSING_REQUIRED_ID',
  'MISSING_EVIDENCE_REFS',
  'MISSING_SBF_EVIDENCE_REF',
  'MISSING_SBF_FEATURE_VERSION',
  'BEHAVIOURAL_FEATURE_VERSION_MISMATCH',
  'MISSING_DERIVED_AT',
  'INVALID_CONTEXT_TAG',
  'INVALID_RISK_VALUE',
  'INVALID_STAGE0_CONTEXT',
  'ADAPTER_VALIDATION_ERROR',
  'UNEXPECTED_ERROR',
] as const);

/* --------------------------------------------------------------------------
 * RiskObservationRowRaw — pg row shape (NUMERIC may arrive as string)
 *
 * Mirrors `risk_observations_v0_1` columns as the `pg` library
 * returns them. NUMERIC(4,3) columns arrive as JavaScript strings by
 * default (e.g. `'0.250'`); JSONB arrives as parsed JS values;
 * TIMESTAMPTZ arrives as `Date`; BOOLEAN arrives as boolean.
 *
 * The mapper (`mapper.ts`) is responsible for parsing the NUMERIC
 * strings to finite numbers and rejecting anything non-finite or
 * out of `[0, 1]`. See PR#8a §7.3 for the discipline.
 * ------------------------------------------------------------------------ */

export interface RiskObservationRowRaw {
  readonly risk_observation_id:    unknown;
  readonly workspace_id:           unknown;
  readonly site_id:                unknown;
  readonly session_id:             unknown;
  readonly observation_version:    unknown;
  readonly scoring_version:        unknown;
  readonly velocity:               unknown;
  readonly device_risk_01:         unknown;
  readonly network_risk_01:        unknown;
  readonly identity_risk_01:       unknown;
  readonly behavioural_risk_01:    unknown;
  readonly tags:                   unknown;
  readonly evidence_refs:          unknown;
  readonly source_event_count:    unknown;
  readonly record_only:            unknown;
  readonly created_at:             unknown;
  // `updated_at` is intentionally NOT in the read view — the mapper
  // never consumes it (Codex/Claude cleanup #4).
}

/* --------------------------------------------------------------------------
 * Stage0RowRaw — pg row shape for the optional side-read
 *
 * Mirrors `stage0_decisions` columns the observer needs for
 * eligibility / provenance per PR#8a §5.1.1. The observer reads only
 * the fields below; it does NOT pull `rule_inputs`, `evidence_refs`,
 * `source_event_count`, or any other column.
 * ------------------------------------------------------------------------ */

export interface Stage0RowRaw {
  readonly stage0_decision_id:  unknown;
  readonly workspace_id:        unknown;
  readonly site_id:             unknown;
  readonly session_id:          unknown;
  readonly stage0_version:      unknown;
  readonly excluded:            unknown;
  readonly rule_id:             unknown;
  readonly record_only:         unknown;
}

/* --------------------------------------------------------------------------
 * ObserverRunOptions — caller-supplied configuration
 *
 * The runner accepts an already-constructed pg pool/client. Env-var
 * parsing happens in the CLI script; the runner is pure of process
 * env reads.
 * ------------------------------------------------------------------------ */

export interface ObserverRunOptions {
  /** PR#6 row filter. Required — operator chooses which version to test. */
  readonly observation_version:  string;
  /** PR#4 contract stamp. Required — must match a real `scoring/version.yml`. */
  readonly scoring_version:      string;

  readonly workspace_id?:        string | null;
  readonly site_id?:             string | null;

  /** Time-window filter on `risk_observations_v0_1.created_at`. */
  readonly window_start:         Date;
  readonly window_end:           Date;

  /** Hard cap on rows scanned per run. */
  readonly limit:                number;
  /** Max truncated session IDs in `sample_session_id_prefixes`. */
  readonly sample_limit:         number;
}

/* --------------------------------------------------------------------------
 * ObserverRowResult — internal per-row outcome (NOT in the public report)
 *
 * The runner produces one of these per scanned row, then the report
 * aggregator turns them into counts + distributions. Envelopes are
 * discarded after the aggregator inspects them (PR#8a OD-8 — no
 * persistence).
 * ------------------------------------------------------------------------ */

export type ObserverRowResult =
  | { readonly outcome: 'envelope_built'; readonly envelope: RiskCoreBridgeEnvelope; readonly session_id: string }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly session_id: string | null; readonly detail: string };

/* --------------------------------------------------------------------------
 * ObserverReport — the public report shape
 *
 * Matches PR#8a §5.3 verbatim. JSON-serialisable. No secrets, no full
 * session IDs (truncated only — see §9 masking rule), no raw payload.
 * ------------------------------------------------------------------------ */

export interface ObserverReport {
  readonly rows_scanned:                              number;
  readonly envelopes_built:                           number;
  readonly rejects:                                   number;
  readonly reject_reasons:                            Readonly<Record<RejectReason, number>>;
  readonly behavioural_feature_version_distribution:  Readonly<Record<string, number>>;
  readonly missing_sbf_evidence_ref_count:            number;
  readonly context_tag_distribution:                  Readonly<Record<string, number>>;
  readonly stage0_excluded_count:                     number;
  readonly eligible_for_buyer_motion_risk_core_count: number;
  readonly sample_session_id_prefixes:                readonly string[];
  readonly run_metadata:                              ObserverRunMetadata;
}

export interface ObserverRunMetadata {
  readonly observation_version:        string;
  readonly scoring_version:            string;
  readonly window_start:               string;  // ISO-8601
  readonly window_end:                 string;  // ISO-8601
  readonly database_host:              string;
  readonly database_name:              string;
  readonly run_started_at:             string;  // ISO-8601 — observer wall-clock; NEVER flows to RiskCoreBridgeInput.derived_at
  readonly run_ended_at:               string;  // ISO-8601 — observer wall-clock; NEVER flows to RiskCoreBridgeInput.derived_at
  readonly source_table:               'risk_observations_v0_1';
  readonly bridge_envelope_version:    string;
}

/* --------------------------------------------------------------------------
 * MapperOutcome — internal mapper return type
 *
 * The mapper does NOT throw on user-data errors (those are observer
 * diagnostics, not crashes). It returns a tagged union the runner
 * inspects.
 * ------------------------------------------------------------------------ */

import type { RiskCoreBridgeInput } from '../risk-core-bridge/index.js';

export type MapperOutcome =
  | { readonly outcome: 'ok'; readonly input: RiskCoreBridgeInput }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

/* --------------------------------------------------------------------------
 * Re-exports for tests that want the EvidenceRef shape
 * ------------------------------------------------------------------------ */

export type { EvidenceRef };
