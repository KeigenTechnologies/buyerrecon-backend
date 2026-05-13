/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — input + output type contract.
 *
 * Pure module. No DB import. No runtime side effects. Mirrors the
 * shape frozen in PR#7a §6.1 (RiskCoreBridgeEnvelope) and PR#7a §5
 * (input contract).
 *
 * IMPORTANT (PR#7a §6.2):
 *   The envelope is the AMS Risk Core *input* envelope. It is NOT:
 *     - a final risk score, RiskIndex, or scoring number
 *     - a RiskOutput
 *     - a `scoring_output_lane_a` row
 *     - a Lane A row / Lane B row
 *     - a Policy Pass 1 / Policy Pass 2 / Trust Core output
 *     - a Trust decision, runtime decision, or final policy verdict
 *     - a `verification_score`, `evidence_band`, or `action_recommendation`
 *     - a `reason_codes` / `reason_impacts` / `triggered_tags` /
 *       `penalty_total` payload
 *     - a customer-facing judgement, report language, or marketing copy
 *
 *   No field name on `RiskCoreBridgeEnvelope` may match any of those.
 *   The static-source sweep in tests/v1/risk-core-bridge.test.ts
 *   enforces this.
 */

import type { BridgeSourceTable } from './version.js';

/* --------------------------------------------------------------------------
 * Evidence reference
 *
 * Verbatim mirror of `risk_observations_v0_1.evidence_refs[]` entries.
 * PR#6 writes objects of the shape
 *   { table: 'session_behavioural_features_v0_2', behavioural_features_id, feature_version }
 * or
 *   { table: 'stage0_decisions', stage0_decision_id, rule_id }
 * — but the bridge MUST treat them as opaque records (PR#7a §5.3
 * "verbatim copy through to the output envelope; the bridge does NOT
 * rewrite, deduplicate, or summarise evidence_refs").
 * ------------------------------------------------------------------------ */

export interface EvidenceRef {
  readonly table: string;
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * Stage 0 read-only side-channel input
 *
 * PR#7a §5: `risk_observations_v0_1` is the primary source. The only
 * permitted side-read is a read-only lookup against `stage0_decisions`
 * for eligibility/provenance. This type represents the side-channel
 * payload already loaded by the caller (the worker in a future
 * refactor). The bridge adapter performs zero I/O — the caller is
 * responsible for fetching the Stage 0 row.
 *
 * Rules (PR#7a §7):
 *   - Stage 0 is NOT a scoring source.
 *   - Stage 0 context flows into `eligibility` only.
 *   - Stage 0 `rule_id` does NOT become a risk feature or reason code.
 *   - Hard-excluded sessions MUST NOT be treated as buyer-motion
 *     scoring inputs (the eligibility flag below records this).
 * ------------------------------------------------------------------------ */

export interface BridgeStage0Context {
  readonly stage0_decision_id:  string;
  readonly stage0_version:      string;
  readonly excluded:            boolean;
  readonly rule_id:             string;
  readonly record_only:         true;
}

/* --------------------------------------------------------------------------
 * Bridge input
 *
 * The pure adapter accepts a single, fully-loaded input object. The
 * caller (a future worker, or a unit test) is responsible for reading
 * the PR#6 row + the optional Stage 0 side-channel and assembling
 * this shape. The adapter does NOT touch the DB.
 *
 * Required version fields (PR#7a §5.2): observation_version,
 * scoring_version, behavioural_feature_version. All three MUST be
 * non-empty strings; the adapter refuses to build an envelope when
 * any is missing.
 * ------------------------------------------------------------------------ */

export interface RiskCoreBridgeInput {
  // --- Source identity (PR#7a §5.3) ---------------------------------------
  readonly risk_observation_id:    string;
  readonly workspace_id:           string;
  readonly site_id:                string;
  readonly session_id:             string;

  // --- Required source versions (PR#7a §5.2) ------------------------------
  readonly observation_version:        string;
  readonly scoring_version:            string;
  readonly behavioural_feature_version: string;

  // --- Normalized risk features (PR#6 RiskInputs-compat) ------------------
  // Mirrors `risk_observations_v0_1` columns. All `*_risk_01` are [0, 1].
  // None of these is a "score" — they are normalised INPUT FEATURES.
  readonly velocity:               Readonly<Record<string, number>>;
  readonly device_risk_01:         number;
  readonly network_risk_01:        number;
  readonly identity_risk_01:       number;
  readonly behavioural_risk_01:    number;

  // --- ContextTags (PR#6 D-13 enum; PR#7a §8) -----------------------------
  readonly context_tags:           readonly string[];

  // --- Lineage (PR#7a §5.3 — verbatim) ------------------------------------
  readonly evidence_refs:          readonly EvidenceRef[];
  readonly source_event_count:     number;

  // --- Frozen provenance literal (PR#6 / PR#7a §6.1) ----------------------
  readonly record_only:            true;

  // --- Optional Stage 0 read-only side-channel (PR#7a §5 + §7) ------------
  readonly stage0?:                BridgeStage0Context;

  // --- Caller-injected timestamp ------------------------------------------
  // PR#7a §11.2 #7: "No Date.now() in the pure adapter (the worker is
  // responsible for stamping `derived_at`)." ISO-8601 string for
  // determinism + cross-process serialisation.
  readonly derived_at:             string;
}

/* --------------------------------------------------------------------------
 * RiskCoreBridgeEnvelope — output
 *
 * Frozen per PR#7a §6.1. Every field below maps directly to the
 * conceptual shape in that section.
 *
 * Eligibility carries two flags:
 *
 *   - `bridge_eligible` — frozen `true` literal per PR#7a §6.1 wording
 *     ("frozen literal; sessions failing eligibility are not emitted").
 *     The adapter is the structural builder; the SELECT-time filter
 *     in a future worker is the real emission gate. The literal makes
 *     downstream consumers' shape checks predictable.
 *
 *   - `eligible_for_buyer_motion_risk_core` — derived semantic flag:
 *     `false` iff `stage0.excluded === true` (PR#7a §7 E-1 "Stage 0
 *     hard-excluded sessions MUST NOT be treated as buyer-motion
 *     scoring inputs"); `true` otherwise. Downstream callers that
 *     route envelopes into Risk Core read this flag.
 * ------------------------------------------------------------------------ */

export interface RiskCoreBridgeEnvelope {
  readonly envelope_version:       string;
  readonly workspace_id:           string;
  readonly site_id:                string;
  readonly session_id:             string;

  readonly source_table:           BridgeSourceTable;
  readonly source_identity: {
    readonly risk_observation_id:  string;
  };
  readonly source_versions: {
    readonly observation_version:        string;
    readonly scoring_version:            string;
    readonly behavioural_feature_version: string;
    readonly stage0_version:             string | null;
  };

  readonly evidence_refs:          readonly EvidenceRef[];

  readonly normalized_risk_features: {
    readonly velocity:             Readonly<Record<string, number>>;
    readonly device_risk_01:       number;
    readonly network_risk_01:      number;
    readonly identity_risk_01:     number;
    readonly behavioural_risk_01:  number;
  };

  readonly context_tags:           readonly string[];

  readonly eligibility: {
    readonly stage0_excluded:                          boolean;
    readonly stage0_rule_id:                           string | null;
    readonly bridge_eligible:                          true;
    readonly eligible_for_buyer_motion_risk_core:      boolean;
  };

  readonly provenance: {
    readonly risk_observation_id:  string;
    readonly source_event_count:   number;
    readonly record_only:          true;
    readonly derived_at:           string;
  };
}
