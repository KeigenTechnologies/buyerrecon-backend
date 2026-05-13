/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — pure mapper.
 *
 * Maps a raw `pg` row from `risk_observations_v0_1` into a
 * `RiskCoreBridgeInput` for the PR#7b adapter. Pure: no DB, no
 * HTTP, no clock, no `process.env`, no filesystem.
 *
 * The mapper does NOT throw on user-data validation failures. It
 * returns a tagged-union `MapperOutcome` the runner inspects. The
 * `RejectReason` taxonomy is PR#8a §8 verbatim.
 *
 * IMPORTANT (PR#8a §7.3):
 *   pg returns NUMERIC columns as JavaScript strings by default.
 *   This mapper parses each `*_risk_01` string to a finite number
 *   and rejects anything that is not in `[0, 1]`. No clamp, no
 *   round, no default — see §7.2 strictness rule.
 *
 * IMPORTANT (PR#8a §7):
 *   `derived_at` is sourced from the row's `created_at` (the
 *   provenance timestamp PR#6 wrote). The mapper does NOT call
 *   `Date.now()`, MUST NOT read the SELECT-time clock, MUST NOT
 *   invent a value. If `created_at` is null/invalid, the row is
 *   rejected with `MISSING_DERIVED_AT`.
 */

import type {
  BridgeStage0Context,
  EvidenceRef,
  RiskCoreBridgeInput,
} from '../risk-core-bridge/index.js';
import type {
  MapperOutcome,
  RejectReason,
  RiskObservationRowRaw,
  Stage0RowRaw,
} from './types.js';

/**
 * The lineage-anchor table name PR#6 records in
 * `risk_observations_v0_1.evidence_refs[].table` for the
 * session_behavioural_features_v0_2 entry. This literal is the ONLY
 * place in PR#8b active source where the SBF table name appears —
 * it is used to MATCH the evidence_ref entry, never as a SQL
 * FROM/JOIN target. The observer never reads
 * `session_behavioural_features_v0_2` directly (PR#8a §6.2).
 */
const SBF_PROVENANCE_TABLE = 'session_behavioural_features_v0_2';
const STAGE0_PROVENANCE_TABLE = 'stage0_decisions';

/**
 * Conservative UUID regex used to pre-validate
 * `stage0_decision_id` evidence_refs pointers before the runner
 * issues `$1::uuid`. The check exists so a malformed lineage value
 * (e.g. `'not-a-uuid'`, a number, a partial string) becomes
 * `INVALID_STAGE0_CONTEXT` at the data-shape layer, not a
 * PostgreSQL `22P02 invalid_text_representation` cast error
 * (which would propagate as a SQL-path failure and exit the
 * observer with code 2 — wasteful, since this is really a data
 * problem).
 *
 * Accepts the 8-4-4-4-12 hex format with case-insensitive digits.
 * Deliberately does NOT enforce the version-digit nibble — pg
 * accepts any UUID, so any 8-4-4-4-12 hex is "plausible enough"
 * for the cast to succeed.
 */
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isPlausibleUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

/* --------------------------------------------------------------------------
 * Evidence refs SHAPE validator (shared by processRow + the mapper).
 *
 * Codex re-review fix: after the broad try/catch removal that closed
 * the SQL-failure-propagation blocker, malformed
 * `risk_observations_v0_1.evidence_refs` values (e.g. `[null]`,
 * `["bad"]`) could cause `extractStage0Pointers` to throw a JS
 * TypeError reading `.table` on a non-object. With no surrounding
 * catch, that throw would propagate to the CLI as exit 2 — but it
 * is a data-shape problem, not a SQL/connection failure. PR#8a §7.2
 * requires data-shape errors to be reported as row-level rejects.
 *
 * The fix: validate evidence_refs SHAPE explicitly at two sites:
 *   - inside processRow, BEFORE the Stage 0 lookup runs
 *   - inside mapRiskObservationRow (preserves the mapper's
 *     standalone validation contract)
 *
 * Both sites call this single helper for a single source of truth.
 * ------------------------------------------------------------------------ */

export type EvidenceRefsShapeResult =
  | { readonly outcome: 'ok'; readonly evidenceRefs: readonly EvidenceRef[] }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

export function validateEvidenceRefsShape(raw: unknown): EvidenceRefsShapeResult {
  if (!Array.isArray(raw)) {
    return {
      outcome: 'rejected',
      reason:  'MISSING_EVIDENCE_REFS',
      detail:  'evidence_refs is null or not an array',
    };
  }
  if (raw.length === 0) {
    return {
      outcome: 'rejected',
      reason:  'MISSING_EVIDENCE_REFS',
      detail:  'evidence_refs is empty',
    };
  }
  for (const [i, ref] of raw.entries()) {
    if (!isPlainObject(ref)) {
      return {
        outcome: 'rejected',
        reason:  'MISSING_EVIDENCE_REFS',
        detail:  `evidence_refs[${i}] is not a plain object`,
      };
    }
    if (!isNonEmptyString((ref as Record<string, unknown>).table)) {
      return {
        outcome: 'rejected',
        reason:  'MISSING_EVIDENCE_REFS',
        detail:  `evidence_refs[${i}].table missing or empty`,
      };
    }
  }
  return { outcome: 'ok', evidenceRefs: raw as readonly EvidenceRef[] };
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function reject(reason: RejectReason, detail: string): MapperOutcome {
  return { outcome: 'rejected', reason, detail };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Parse a NUMERIC value into a finite number in `[0, 1]`. Accepts
 * either a JS number (pg with a custom type parser) or a string (pg
 * default). Returns the parsed value on success, or `null` on any
 * failure. The caller maps `null` to `INVALID_RISK_VALUE`.
 *
 * Rejection cases:
 *   - undefined, null
 *   - non-finite number (NaN, Infinity, -Infinity)
 *   - non-numeric string (empty string, 'NaN', 'abc')
 *   - parsed number outside [0, 1]
 */
function parseNumeric01(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    if (v.length === 0) return null;
    n = Number(v);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

/**
 * Parse a velocity value (entry inside the JSONB record). Stricter
 * than NUMERIC parsing — entries must be JS numbers per PR#7a §6.1
 * `Record<string, number>`. pg returns JSONB as already-parsed JS
 * values so number-typed entries should arrive natively; numeric
 * strings are accepted as a defence-in-depth fallback if the
 * upstream writer ever stores a stringified number.
 */
function parseVelocityValue(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    if (v.length === 0) return null;
    n = Number(v);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Convert a `created_at` value (Date | string | null | undefined)
 * to an ISO-8601 string. pg returns TIMESTAMPTZ as `Date`; a string
 * is accepted defensively. Returns `null` on any failure path.
 */
function provenanceTimestampToIso(v: unknown): string | null {
  if (v instanceof Date) {
    const t = v.getTime();
    if (!Number.isFinite(t)) return null;
    return v.toISOString();
  }
  if (typeof v === 'string' && v.length > 0) {
    const ms = Date.parse(v);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Behavioural-feature-version lineage anchor
 *
 * Finds the `session_behavioural_features_v0_2` entries on
 * `evidence_refs[]` and derives the authoritative
 * `behavioural_feature_version`. See PR#8a §5.1.1 / §7 / §8 for the
 * rules.
 * ------------------------------------------------------------------------ */

interface BfvOk {
  readonly outcome: 'ok';
  readonly behavioural_feature_version: string;
}
interface BfvReject {
  readonly outcome: 'rejected';
  readonly reason: RejectReason;
  readonly detail: string;
}
type BfvResult = BfvOk | BfvReject;

function resolveBehaviouralFeatureVersion(evidenceRefs: readonly EvidenceRef[]): BfvResult {
  const sbfEntries = evidenceRefs.filter((r) => r.table === SBF_PROVENANCE_TABLE);
  if (sbfEntries.length === 0) {
    return {
      outcome: 'rejected',
      reason: 'MISSING_SBF_EVIDENCE_REF',
      detail: `evidence_refs[] contains no entry for ${SBF_PROVENANCE_TABLE}`,
    };
  }
  const versions: string[] = [];
  for (const [i, ref] of sbfEntries.entries()) {
    const fv = (ref as Record<string, unknown>).feature_version;
    if (!isNonEmptyString(fv)) {
      return {
        outcome: 'rejected',
        reason: 'MISSING_SBF_FEATURE_VERSION',
        detail: `evidence_refs ${SBF_PROVENANCE_TABLE} entry #${i} has missing/empty feature_version`,
      };
    }
    versions.push(fv);
  }
  const unique = new Set(versions);
  if (unique.size !== 1) {
    return {
      outcome: 'rejected',
      reason: 'BEHAVIOURAL_FEATURE_VERSION_MISMATCH',
      detail: `evidence_refs ${SBF_PROVENANCE_TABLE} entries disagree on feature_version (saw ${[...unique].map((v) => JSON.stringify(v)).join(', ')})`,
    };
  }
  return { outcome: 'ok', behavioural_feature_version: versions[0]! };
}

/* --------------------------------------------------------------------------
 * Stage 0 evidence_refs pointer extraction
 *
 * Per PR#8a §5.1.1 Path A — find all `stage0_decisions` entries on
 * `evidence_refs[]`. The runner uses the result to decide between
 * Path A (one pointer → PK lookup) and Path B (no pointer → lineage
 * lookup). Multiple pointers is an immediate `INVALID_STAGE0_CONTEXT`.
 *
 * Exported for the runner; pure.
 * ------------------------------------------------------------------------ */

export interface Stage0PointerResult {
  readonly pointers: readonly string[];  // stage0_decision_id strings
}

export function extractStage0Pointers(evidenceRefs: readonly EvidenceRef[]): Stage0PointerResult {
  const out: string[] = [];
  // Defensive iteration (Codex re-review fix): if a caller passes a
  // malformed `evidence_refs` array (e.g. `[null]`, `["bad"]`,
  // numeric entries), skip the bad entries rather than throwing a
  // TypeError reading `.table` on a non-object. The runner's
  // pre-guard in `processRow` already rejects malformed
  // evidence_refs as row-level MISSING_EVIDENCE_REFS before this is
  // called, but defence-in-depth keeps this helper safe for any
  // future caller (tests, future workers, etc.).
  for (const ref of evidenceRefs) {
    if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) continue;
    const refObj = ref as Record<string, unknown>;
    if (refObj['table'] !== STAGE0_PROVENANCE_TABLE) continue;
    const id = refObj['stage0_decision_id'];
    if (isNonEmptyString(id)) out.push(id);
  }
  return { pointers: Object.freeze(out) };
}

/* --------------------------------------------------------------------------
 * Stage 0 row → BridgeStage0Context
 *
 * Dedicated discriminated union (NOT the MapperOutcome union) so the
 * runner can narrow on `stage0Row.outcome === 'ok'` and access the
 * non-optional `stage0` field directly.
 * ------------------------------------------------------------------------ */

export type Stage0MapOutcome =
  | { readonly outcome: 'ok'; readonly stage0: BridgeStage0Context }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

export function mapStage0Row(row: Stage0RowRaw): Stage0MapOutcome {
  if (!isNonEmptyString(row.stage0_decision_id)) {
    return { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT', detail: 'stage0_decision_id missing or empty on stage0_decisions row' };
  }
  if (!isNonEmptyString(row.stage0_version)) {
    return { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT', detail: 'stage0_version missing or empty' };
  }
  if (typeof row.excluded !== 'boolean') {
    return { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT', detail: 'excluded is not a boolean' };
  }
  if (!isNonEmptyString(row.rule_id)) {
    return { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT', detail: 'rule_id missing or empty' };
  }
  if (row.record_only !== true) {
    return { outcome: 'rejected', reason: 'INVALID_STAGE0_CONTEXT', detail: 'record_only is not the literal `true`' };
  }
  return {
    outcome: 'ok',
    stage0: {
      stage0_decision_id: row.stage0_decision_id,
      stage0_version:     row.stage0_version,
      excluded:           row.excluded,
      rule_id:            row.rule_id,
      record_only:        true,
    },
  };
}

/* --------------------------------------------------------------------------
 * Main row mapper
 *
 * Input:  one raw PR#6 row + the resolved Stage 0 context (or null)
 * Output: MapperOutcome — either a valid `RiskCoreBridgeInput` or a
 *         tagged rejection.
 * ------------------------------------------------------------------------ */

export function mapRiskObservationRow(
  row:    RiskObservationRowRaw,
  stage0: BridgeStage0Context | null,
): MapperOutcome {
  // ---- Identity validation ----------------------------------------------
  if (!isNonEmptyString(row.risk_observation_id)) {
    return reject('MISSING_REQUIRED_ID', 'risk_observation_id missing or empty');
  }
  if (!isNonEmptyString(row.workspace_id)) {
    return reject('MISSING_REQUIRED_ID', 'workspace_id missing or empty');
  }
  if (!isNonEmptyString(row.site_id)) {
    return reject('MISSING_REQUIRED_ID', 'site_id missing or empty');
  }
  if (!isNonEmptyString(row.session_id)) {
    return reject('MISSING_REQUIRED_ID', 'session_id missing or empty');
  }

  // ---- Version validation -----------------------------------------------
  if (!isNonEmptyString(row.observation_version)) {
    return reject('MISSING_REQUIRED_ID', 'observation_version missing or empty');
  }
  if (!isNonEmptyString(row.scoring_version)) {
    return reject('MISSING_REQUIRED_ID', 'scoring_version missing or empty');
  }

  // ---- Evidence refs verbatim copy (shared shape validator) ------------
  const refsShape = validateEvidenceRefsShape(row.evidence_refs);
  if (refsShape.outcome === 'rejected') {
    return reject(refsShape.reason, refsShape.detail);
  }
  const evidenceRefs = refsShape.evidenceRefs;

  // ---- Behavioural feature version (SBF anchor) -------------------------
  const bfv = resolveBehaviouralFeatureVersion(evidenceRefs);
  if (bfv.outcome === 'rejected') {
    return reject(bfv.reason, bfv.detail);
  }

  // ---- NUMERIC parsing (PR#8a §7.3) -------------------------------------
  const device_risk_01 = parseNumeric01(row.device_risk_01);
  if (device_risk_01 === null) {
    return reject('INVALID_RISK_VALUE', `device_risk_01 (${describeRiskValue(row.device_risk_01)}) is not a finite number in [0, 1]`);
  }
  const network_risk_01 = parseNumeric01(row.network_risk_01);
  if (network_risk_01 === null) {
    return reject('INVALID_RISK_VALUE', `network_risk_01 (${describeRiskValue(row.network_risk_01)}) is not a finite number in [0, 1]`);
  }
  const identity_risk_01 = parseNumeric01(row.identity_risk_01);
  if (identity_risk_01 === null) {
    return reject('INVALID_RISK_VALUE', `identity_risk_01 (${describeRiskValue(row.identity_risk_01)}) is not a finite number in [0, 1]`);
  }
  const behavioural_risk_01 = parseNumeric01(row.behavioural_risk_01);
  if (behavioural_risk_01 === null) {
    return reject('INVALID_RISK_VALUE', `behavioural_risk_01 (${describeRiskValue(row.behavioural_risk_01)}) is not a finite number in [0, 1]`);
  }

  // ---- Velocity --------------------------------------------------------
  if (!isPlainObject(row.velocity)) {
    return reject('INVALID_RISK_VALUE', 'velocity is not a plain object');
  }
  const velocity: Record<string, number> = {};
  for (const k of Object.keys(row.velocity)) {
    const v = parseVelocityValue((row.velocity as Record<string, unknown>)[k]);
    if (v === null) {
      return reject('INVALID_RISK_VALUE', `velocity[${JSON.stringify(k)}] is not a finite number`);
    }
    velocity[k] = v;
  }

  // ---- Context tags ----------------------------------------------------
  if (!Array.isArray(row.tags)) {
    return reject('INVALID_CONTEXT_TAG', 'tags is null or not an array');
  }
  const context_tags: string[] = [];
  for (const [i, t] of row.tags.entries()) {
    if (typeof t !== 'string' || t.length === 0) {
      return reject('INVALID_CONTEXT_TAG', `tags[${i}] is not a non-empty string`);
    }
    context_tags.push(t);
  }

  // ---- source_event_count ----------------------------------------------
  let source_event_count: number;
  if (typeof row.source_event_count === 'number'
      && Number.isFinite(row.source_event_count)
      && Number.isInteger(row.source_event_count)
      && row.source_event_count >= 0) {
    source_event_count = row.source_event_count;
  } else if (typeof row.source_event_count === 'string') {
    const n = Number(row.source_event_count);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      source_event_count = n;
    } else {
      return reject('INVALID_RISK_VALUE', `source_event_count (${describeRiskValue(row.source_event_count)}) is not a non-negative integer`);
    }
  } else {
    return reject('INVALID_RISK_VALUE', `source_event_count (${describeRiskValue(row.source_event_count)}) is not a non-negative integer`);
  }

  // ---- record_only literal ---------------------------------------------
  if (row.record_only !== true) {
    return reject('ADAPTER_VALIDATION_ERROR', 'record_only is not the literal `true`');
  }

  // ---- derived_at from created_at (PR#8a §7 Patch 2) -------------------
  const derived_at = provenanceTimestampToIso(row.created_at);
  if (derived_at === null) {
    return reject('MISSING_DERIVED_AT', 'risk_observations_v0_1.created_at is null / missing / not a valid timestamp; observer MUST NOT invent derived_at');
  }

  // ---- Assemble RiskCoreBridgeInput -------------------------------------
  const input: RiskCoreBridgeInput = {
    risk_observation_id:         row.risk_observation_id,
    workspace_id:                row.workspace_id,
    site_id:                     row.site_id,
    session_id:                  row.session_id,
    observation_version:         row.observation_version,
    scoring_version:             row.scoring_version,
    behavioural_feature_version: bfv.behavioural_feature_version,
    velocity,
    device_risk_01,
    network_risk_01,
    identity_risk_01,
    behavioural_risk_01,
    context_tags,
    evidence_refs:               evidenceRefs,
    source_event_count,
    record_only:                 true,
    ...(stage0 !== null ? { stage0 } : {}),
    derived_at,
  };

  // `stage0` is already inside `input.stage0` when supplied; the
  // top-level `stage0` field on MapperOutcome was redundant and is
  // intentionally NOT echoed here (Codex/Claude cleanup #3).
  return { outcome: 'ok', input };
}

function describeRiskValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  return typeof v;
}

/* --------------------------------------------------------------------------
 * Adapter-error string-match table (PR#8a §8)
 *
 * The PR#7b adapter throws Error with descriptive messages. The
 * observer never modifies the adapter; instead it pattern-matches
 * thrown messages onto the diagnostic taxonomy. The keys below
 * mirror the exact substrings the adapter uses, so future adapter
 * message tweaks need to be reflected here.
 * ------------------------------------------------------------------------ */

const ADAPTER_ERROR_PATTERNS: ReadonlyArray<[RegExp, RejectReason]> = [
  // Lineage anchor messages
  [/must contain at least one "session_behavioural_features_v0_2" entry/, 'MISSING_SBF_EVIDENCE_REF'],
  [/missing a non-empty feature_version/, 'MISSING_SBF_FEATURE_VERSION'],
  [/must match evidence_refs session_behavioural_features_v0_2 entry feature_version/, 'BEHAVIOURAL_FEATURE_VERSION_MISMATCH'],
  // Identity / version
  [/risk_observation_id|workspace_id|site_id|session_id|observation_version|scoring_version|behavioural_feature_version/, 'MISSING_REQUIRED_ID'],
  // Risk values
  [/must be a finite number in \[0, 1\]/, 'INVALID_RISK_VALUE'],
  [/velocity\[.+\] must be a finite number/, 'INVALID_RISK_VALUE'],
  [/velocity must be a plain object/, 'INVALID_RISK_VALUE'],
  // Context tags
  [/context_tags\[\d+\]/, 'INVALID_CONTEXT_TAG'],
  [/cardinality exceeded/, 'INVALID_CONTEXT_TAG'],
  [/ContextTag/, 'INVALID_CONTEXT_TAG'],
  // Stage 0
  [/stage0\./, 'INVALID_STAGE0_CONTEXT'],
  // derived_at
  [/derived_at/, 'MISSING_DERIVED_AT'],
  // Evidence refs
  [/evidence_refs/, 'MISSING_EVIDENCE_REFS'],
  // record_only literal
  [/record_only/, 'ADAPTER_VALIDATION_ERROR'],
];

export function classifyAdapterError(message: string): RejectReason {
  for (const [pat, reason] of ADAPTER_ERROR_PATTERNS) {
    if (pat.test(message)) return reason;
  }
  return 'ADAPTER_VALIDATION_ERROR';
}
