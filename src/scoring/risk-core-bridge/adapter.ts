/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — pure adapter.
 *
 * Pure function. Same input → same envelope (byte-stable). No DB
 * access. No HTTP. No `Date.now()`. No `process.env` read. No file
 * I/O. No mutation of the input object.
 *
 * Implementation contract (PR#7a §11.2):
 *   1. Accept a fully-loaded `RiskCoreBridgeInput`.
 *   2. Produce a `RiskCoreBridgeEnvelope` matching PR#7a §6.1.
 *   3. Preserve evidence_refs verbatim (deep clone + freeze).
 *   4. Preserve source versions (observation_version, scoring_version,
 *      behavioural_feature_version).
 *   5. Preserve Stage 0 eligibility/context. Hard-excluded sessions
 *      surface as `eligible_for_buyer_motion_risk_core: false` (PR#7a
 *      §7 E-1).
 *   6. Carry ContextTags only as context/provenance (PR#7a §8).
 *   7. Be deterministic — no clock read in this pure function.
 *   8. Be versioned — `envelope_version` stamped from
 *      `RISK_CORE_BRIDGE_ENVELOPE_VERSION`.
 *   9. Pure tests cover shape, version, evidence_refs preservation,
 *      source-version preservation, eligibility, ContextTag
 *      carry-through, determinism, no Lane A/B writer, no forbidden
 *      keys.
 *
 * Hard absences (PR#7a §6.2):
 *   - No `risk_score`, `risk_index`, `verification_score`,
 *     `evidence_band`, `action_recommendation`, `reason_codes`,
 *     `reason_impacts`, `triggered_tags`, `penalty_total` fields on
 *     the envelope shape.
 *   - No Lane A / Lane B writer call.
 *   - No customer-facing language, no report rendering, no policy or
 *     trust decision.
 */

import {
  preserveContextTags,
  preserveEvidenceRefs,
  preserveVelocity,
  deepFreeze,
} from './evidence-map.js';
import type {
  EvidenceRef,
  RiskCoreBridgeEnvelope,
  RiskCoreBridgeInput,
} from './types.js';
import {
  BRIDGE_SOURCE_TABLE,
  RISK_CORE_BRIDGE_ENVELOPE_VERSION,
} from './version.js';
// PR#7a §8 + Codex blocker #1: bridge MUST reject ContextTags outside
// the Helen-signed D-13 enum. Import the PR#6 validator (single source
// of truth — `risk-evidence/context-tags.ts` is a pure sibling module
// with no I/O dependencies).
import { validateContextTag } from '../risk-evidence/context-tags.js';

/** PR#7a §5.3 / §5.2: the SBF provenance entry on `evidence_refs[]`. */
const SBF_PROVENANCE_TABLE = 'session_behavioural_features_v0_2';

/* --------------------------------------------------------------------------
 * Validators
 * ------------------------------------------------------------------------ */

function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`PR#7b bridge input invalid: ${field} must be a non-empty string (got ${JSON.stringify(value)})`);
  }
}

function requireFiniteRisk01(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
      || value > 1) {
    throw new Error(`PR#7b bridge input invalid: ${field} must be a finite number in [0, 1] (got ${JSON.stringify(value)})`);
  }
}

function requireNonNegativeInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
      || !Number.isInteger(value)) {
    throw new Error(`PR#7b bridge input invalid: ${field} must be a non-negative integer (got ${JSON.stringify(value)})`);
  }
}

function requireEvidenceRefsArray(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error(`PR#7b bridge input invalid: evidence_refs must be an array (got ${typeof value})`);
  }
  // Per PR#7a §5.3 ("verbatim copy") + PR#5/PR#6 lineage discipline,
  // the bridge requires at least one provenance entry. Empty arrays
  // are valid for upstream PR#6 rows that wrote no provenance, but
  // PR#7a §5.3 lists evidence_refs under "Required lineage" — so the
  // adapter refuses an empty array as a defensive guard against
  // lineage loss.
  if (value.length === 0) {
    throw new Error('PR#7b bridge input invalid: evidence_refs must contain at least one provenance entry');
  }
  for (const [i, ref] of value.entries()) {
    if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
      throw new Error(`PR#7b bridge input invalid: evidence_refs[${i}] must be an object`);
    }
    const t = (ref as Record<string, unknown>).table;
    if (typeof t !== 'string' || t.length === 0) {
      throw new Error(`PR#7b bridge input invalid: evidence_refs[${i}].table must be a non-empty string`);
    }
  }
}

/**
 * PR#7a §5.2 + Codex blocker #2: `behavioural_feature_version` MUST be
 * sourced from `evidence_refs[].feature_version` on the row's
 * `session_behavioural_features_v0_2` provenance entry.
 *
 * The adapter MUST refuse to process a row where the SBF provenance
 * anchor is missing or where its `feature_version` does not match the
 * declared `input.behavioural_feature_version`. If multiple SBF
 * entries exist on `evidence_refs` (PR#6 evidence_refs is verbatim),
 * EVERY entry must agree — silent disagreement is a lineage break.
 */
function requireBehaviouralFeatureVersionLineage(
  evidenceRefs:    readonly EvidenceRef[],
  declaredVersion: string,
): void {
  const sbfRefs = evidenceRefs.filter((r) => r.table === SBF_PROVENANCE_TABLE);
  if (sbfRefs.length === 0) {
    throw new Error(
      `PR#7b bridge input invalid: evidence_refs must contain at least one ` +
      `${JSON.stringify(SBF_PROVENANCE_TABLE)} entry (the behavioural_feature_version lineage anchor — PR#7a §5.2)`,
    );
  }
  sbfRefs.forEach((ref, i) => {
    const fv = (ref as Record<string, unknown>).feature_version;
    if (typeof fv !== 'string' || fv.length === 0) {
      throw new Error(
        `PR#7b bridge input invalid: evidence_refs ${SBF_PROVENANCE_TABLE} entry #${i} is missing a non-empty feature_version (PR#7a §5.2 — lineage anchor)`,
      );
    }
    if (fv !== declaredVersion) {
      throw new Error(
        `PR#7b bridge input invalid: input.behavioural_feature_version ${JSON.stringify(declaredVersion)} ` +
        `must match evidence_refs ${SBF_PROVENANCE_TABLE} entry feature_version ${JSON.stringify(fv)} ` +
        `(PR#7a §5.2 — declared version must be sourced from the SBF provenance anchor)`,
      );
    }
  });
}

function requireVelocityRecord(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`PR#7b bridge input invalid: velocity must be a plain object`);
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`PR#7b bridge input invalid: velocity[${JSON.stringify(k)}] must be a finite number (got ${JSON.stringify(v)})`);
    }
  }
}

/**
 * PR#7a §8 + Codex blocker #1: every tag MUST be in the Helen-signed
 * D-13 enum. Tags outside the enum, tags in forbidden reason-code
 * namespaces (A_*, B_*, REVIEW_*, OBS_*, UX_*, RISK.*), and tags
 * matching `forbidden_codes.yml` patterns (BUYER_*, *_VERIFIED,
 * *_CONFIRMED, ...) all reject. The PR#6 `validateContextTag`
 * encodes all three checks.
 */
function requireContextTags(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error(`PR#7b bridge input invalid: context_tags must be an array (got ${typeof value})`);
  }
  for (const [i, t] of value.entries()) {
    if (typeof t !== 'string' || t.length === 0) {
      throw new Error(`PR#7b bridge input invalid: context_tags[${i}] must be a non-empty string`);
    }
    const issue = validateContextTag(t);
    if (issue !== null) {
      throw new Error(`PR#7b bridge input invalid: context_tags[${i}] — ${issue}`);
    }
  }
}

/* --------------------------------------------------------------------------
 * buildRiskCoreBridgeEnvelope — pure adapter
 *
 * Reads the input, validates required fields, derives Stage 0
 * eligibility, and assembles a deep-immutable envelope. The envelope
 * never shares object identity with the caller's input.
 * ------------------------------------------------------------------------ */

export function buildRiskCoreBridgeEnvelope(
  input: RiskCoreBridgeInput,
): RiskCoreBridgeEnvelope {
  // ---- Identity validation (PR#7a §5.3) ---------------------------------
  requireNonEmptyString(input.risk_observation_id,    'risk_observation_id');
  requireNonEmptyString(input.workspace_id,           'workspace_id');
  requireNonEmptyString(input.site_id,                'site_id');
  requireNonEmptyString(input.session_id,             'session_id');

  // ---- Version validation (PR#7a §5.2 — all three MUST be present) -----
  requireNonEmptyString(input.observation_version,            'observation_version');
  requireNonEmptyString(input.scoring_version,                'scoring_version');
  requireNonEmptyString(input.behavioural_feature_version,    'behavioural_feature_version');

  // ---- Risk feature validation (PR#7a §6.1 — all in [0, 1]) ------------
  requireFiniteRisk01(input.device_risk_01,        'device_risk_01');
  requireFiniteRisk01(input.network_risk_01,       'network_risk_01');
  requireFiniteRisk01(input.identity_risk_01,      'identity_risk_01');
  requireFiniteRisk01(input.behavioural_risk_01,   'behavioural_risk_01');
  requireVelocityRecord(input.velocity);
  requireContextTags(input.context_tags);

  // ---- Lineage validation (PR#7a §5.3) -----------------------------------
  requireEvidenceRefsArray(input.evidence_refs);
  // PR#7a §5.2 + Codex blocker #2: cross-check the declared
  // behavioural_feature_version against the SBF provenance anchor.
  requireBehaviouralFeatureVersionLineage(input.evidence_refs, input.behavioural_feature_version);
  requireNonNegativeInteger(input.source_event_count, 'source_event_count');
  if (input.record_only !== true) {
    throw new Error('PR#7b bridge input invalid: record_only must be the literal `true`');
  }

  // ---- derived_at validation --------------------------------------------
  requireNonEmptyString(input.derived_at, 'derived_at');

  // ---- Stage 0 read-only side-channel (PR#7a §5 + §7) -------------------
  const stage0 = input.stage0;
  if (stage0 !== undefined) {
    requireNonEmptyString(stage0.stage0_decision_id, 'stage0.stage0_decision_id');
    requireNonEmptyString(stage0.stage0_version,     'stage0.stage0_version');
    requireNonEmptyString(stage0.rule_id,            'stage0.rule_id');
    if (typeof stage0.excluded !== 'boolean') {
      throw new Error('PR#7b bridge input invalid: stage0.excluded must be a boolean');
    }
    if (stage0.record_only !== true) {
      throw new Error('PR#7b bridge input invalid: stage0.record_only must be the literal `true`');
    }
  }

  // ---- Eligibility derivation (PR#7a §7) --------------------------------
  // Buyer-motion eligibility: FALSE iff Stage 0 said the session is
  // hard-excluded. Stage 0 absent → eligible (the bridge assumes
  // upstream filtering, but the field surfaces honestly).
  const stage0_excluded = stage0 !== undefined && stage0.excluded === true;
  const eligible_for_buyer_motion_risk_core = !stage0_excluded;

  // ---- Assemble envelope (verbatim provenance + cloned features) ---------
  const envelope: RiskCoreBridgeEnvelope = {
    envelope_version: RISK_CORE_BRIDGE_ENVELOPE_VERSION,
    workspace_id:     input.workspace_id,
    site_id:          input.site_id,
    session_id:       input.session_id,
    source_table:     BRIDGE_SOURCE_TABLE,
    source_identity: deepFreeze({
      risk_observation_id: input.risk_observation_id,
    }),
    source_versions: deepFreeze({
      observation_version:         input.observation_version,
      scoring_version:             input.scoring_version,
      behavioural_feature_version: input.behavioural_feature_version,
      stage0_version:              stage0 !== undefined ? stage0.stage0_version : null,
    }),
    evidence_refs:    preserveEvidenceRefs(input.evidence_refs),
    normalized_risk_features: deepFreeze({
      velocity:             preserveVelocity(input.velocity),
      device_risk_01:       input.device_risk_01,
      network_risk_01:      input.network_risk_01,
      identity_risk_01:     input.identity_risk_01,
      behavioural_risk_01:  input.behavioural_risk_01,
    }),
    context_tags:     preserveContextTags(input.context_tags),
    eligibility: deepFreeze({
      stage0_excluded,
      stage0_rule_id: stage0 !== undefined ? stage0.rule_id : null,
      bridge_eligible: true as const,
      eligible_for_buyer_motion_risk_core,
    }),
    provenance: deepFreeze({
      risk_observation_id: input.risk_observation_id,
      source_event_count:  input.source_event_count,
      record_only:         true as const,
      derived_at:          input.derived_at,
    }),
  };
  return deepFreeze(envelope);
}

/* --------------------------------------------------------------------------
 * Note on defence-in-depth forbidden-key audit
 *
 * The envelope's TypeScript shape in `types.ts` is the structural
 * contract — the compiler rejects any field a future PR might try to
 * add that would violate PR#7a §6.2 ("NOT a final risk score / NOT a
 * RiskOutput / NOT a Lane A row / ..."). A runtime walker is *not*
 * implemented here on purpose:
 *
 *   - It would have to enumerate the forbidden field names as string
 *     literals in this active source file, which collides with the
 *     PR#3 generic-score-shaped-identifier sweep (which scans
 *     `src/scoring/**` for those exact tokens).
 *
 *   - The corresponding runtime audit lives in the test file
 *     (`tests/v1/risk-core-bridge.test.ts`) where the denylist + the
 *     walker can carry literal token names without colliding with the
 *     PR#3 sweep (which excludes `tests/`).
 *
 *   - The static type contract is the load-bearing guarantee; the
 *     test-side runtime walker is the belt-and-braces audit.
 * ------------------------------------------------------------------------ */
