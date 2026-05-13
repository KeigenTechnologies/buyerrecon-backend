/**
 * Sprint 2 PR#11b — POI Core Input Observer — pure mapper.
 *
 * Maps a raw `pg` row from `session_features` or
 * `session_behavioural_features_v0_2` into a
 * `BuildPoiCoreInputArgs` for the PR#10 adapter. Pure: no DB, no
 * HTTP, no clock, no `process.env`, no filesystem.
 *
 * The mapper does NOT throw on user-data validation failures. It
 * returns a tagged-union `MapperOutcome` the runner inspects. The
 * `RejectReason` taxonomy is PR#11a §5.1 verbatim (modulo PR#11b-
 * specific reasons).
 *
 * IMPORTANT (PR#11a §5.1 + PR#9a OD-7 + PR#11a §5.1 patch):
 *   Stage 0 exclusion is NOT a reject reason. A Stage-0-excluded
 *   source row builds a successful PoiCoreInput envelope with
 *   `stage0_excluded=true, poi_eligible=false`. Rejection happens
 *   only when source data is missing/invalid, when no privacy-safe
 *   page_path candidate exists, or when the PR#10 adapter validation
 *   throws.
 *
 * IMPORTANT (PR#10 contract):
 *   `derived_at` is sourced from the source row's `extracted_at` —
 *   the provenance timestamp that PR#11 / PR#1 wrote. The mapper does
 *   NOT call `Date.now()`, MUST NOT read the SELECT-time clock, MUST
 *   NOT invent a value. If `extracted_at` is null/invalid, the row
 *   is rejected with `MISSING_EXTRACTED_AT`.
 */

import {
  POI_CORE_INPUT_VERSION,
  POI_TYPE,
  type BuildPoiCoreInputArgs,
  type PoiEvidenceRef,
  type PoiSourceRow,
  type PoiStage0Context,
  type RawSurfaceObservation,
  type RouteRule,
} from '../poi-core/index.js';

import type {
  RejectReason,
  SessionBehaviouralFeaturesRowRaw,
  SessionFeaturesRowRaw,
  Stage0RowRaw,
} from './types.js';

/* --------------------------------------------------------------------------
 * MapperOutcome — internal mapper return type
 *
 * The mapper produces either a fully-formed adapter input or a
 * tagged rejection. The runner inspects the outcome and calls the
 * adapter only on `'ok'`.
 * ------------------------------------------------------------------------ */

export type MapperOutcome =
  | { readonly outcome: 'ok'; readonly input: BuildPoiCoreInputArgs }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

export type Stage0MapOutcome =
  | { readonly outcome: 'ok'; readonly stage0: PoiStage0Context }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function reject(reason: RejectReason, detail: string): MapperOutcome {
  return { outcome: 'rejected', reason, detail };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function coerceIdToString(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return String(v);
  // pg returns BIGINT/BIGSERIAL as strings by default; the number path
  // above only fires for INT columns or callers that have configured
  // a numeric type parser.
  return null;
}

function coerceSourceEventCount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Convert an `extracted_at` value (Date | string | null | undefined)
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

function nullableTimestampToIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return provenanceTimestampToIso(v);
}

/* --------------------------------------------------------------------------
 * Page path candidate selection
 *
 * For session_features: prefer `landing_page_path`, fall back to
 * `last_page_path`. Both columns are nullable in the schema. If both
 * are missing/null/empty, return null → row rejects with
 * `NO_PAGE_PATH_CANDIDATE`.
 *
 * The mapper does NOT reconstruct paths from any other source. It
 * does NOT invent POI keys. It does NOT read `accepted_events.raw` /
 * `canonical_jsonb`. PR#11a §6 + PR#9a §4.2 forbid that.
 * ------------------------------------------------------------------------ */

function pickPagePathCandidate(row: SessionFeaturesRowRaw): string | null {
  if (isNonEmptyString(row.landing_page_path)) return row.landing_page_path;
  if (isNonEmptyString(row.last_page_path))    return row.last_page_path;
  return null;
}

/* --------------------------------------------------------------------------
 * Stage 0 row → PoiStage0Context
 *
 * Mirrors PR#10 `PoiStage0Context` shape verbatim. Used by the runner
 * after the (workspace, site, session) side-read returns 1 row. Any
 * shape problem (missing field, wrong type, `record_only !== true`)
 * is reported as `INVALID_STAGE0_CONTEXT`.
 * ------------------------------------------------------------------------ */

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
 * Evidence refs builder
 *
 * PR#11b BUILDS evidence_refs from the source row identity (and the
 * Stage 0 row when present). PR#11b does NOT read the source row's
 * own evidence_refs JSONB — the SQL in `sql.ts` does not SELECT any
 * JSONB column from the source tables.
 *
 * Each ref points back at a row in the PR#11a OD-2 allowlist:
 *   - `session_features` / `session_behavioural_features_v0_2`
 *     (primary POI source)
 *   - `stage0_decisions` (side-read; optional)
 *
 * No forbidden keys ever land in the built evidence_refs (the PR#10
 * adapter's recursive forbidden-key sweep would throw if they did —
 * defence in depth).
 * ------------------------------------------------------------------------ */

function buildEvidenceRefs(
  sourceTable:    'session_features' | 'session_behavioural_features_v0_2',
  sourceRowId:    string,
  sourceVersion:  string,
  stage0:         PoiStage0Context | null,
): readonly PoiEvidenceRef[] {
  const refs: PoiEvidenceRef[] = [];
  if (sourceTable === 'session_features') {
    refs.push({ table: 'session_features', source_row_id: sourceRowId, extraction_version: sourceVersion });
  } else {
    refs.push({ table: 'session_behavioural_features_v0_2', source_row_id: sourceRowId, feature_version: sourceVersion });
  }
  if (stage0 !== null) {
    refs.push({
      table:              'stage0_decisions',
      stage0_decision_id: stage0.stage0_decision_id,
      stage0_version:     stage0.stage0_version,
      rule_id:            stage0.rule_id,
    });
  }
  return refs;
}

/* --------------------------------------------------------------------------
 * RawSurfaceObservation builder for page_path POI type
 *
 * PR#11b hard-codes `poi_type = 'page_path'`. The only `raw_surface`
 * field that matters for this POI type is `raw_page_path`. All other
 * fields are null — the PR#10 adapter only normalises the field
 * matching the requested poi_type.
 *
 * `route_rules` is an empty array (PR#11b does not derive routes).
 * `poi_surface_class` is null (PR#11b does not classify surface;
 * future PR may tag it).
 * ------------------------------------------------------------------------ */

const EMPTY_ROUTE_RULES: readonly RouteRule[] = Object.freeze([]);

function buildRawSurfaceForPagePath(rawPagePath: string): RawSurfaceObservation {
  return {
    raw_page_path:      rawPagePath,
    raw_referrer:       null,
    cta_id:             null,
    form_id:            null,
    raw_offer_surface:  null,
    route_rules:        EMPTY_ROUTE_RULES,
    poi_surface_class:  null,
  };
}

/* --------------------------------------------------------------------------
 * Main row mappers
 *
 * Input:  raw pg row (SF or SBF) + the resolved Stage 0 context (or null)
 *         + observer-supplied versions
 * Output: MapperOutcome — either a `BuildPoiCoreInputArgs` ready for
 *         `buildPoiCoreInput(...)` or a tagged rejection.
 * ------------------------------------------------------------------------ */

export interface MapRowCommon {
  readonly poi_input_version:  string;
  readonly scoring_version:    string;
}

export function mapSessionFeaturesRow(
  row:     SessionFeaturesRowRaw,
  stage0:  PoiStage0Context | null,
  common:  MapRowCommon,
): MapperOutcome {
  // ---- Identity validation --------------------------------------------
  const sourceRowId = coerceIdToString(row.session_features_id);
  if (sourceRowId === null) {
    return reject('MISSING_REQUIRED_ID', 'session_features_id missing or invalid');
  }
  if (!isNonEmptyString(row.workspace_id)) return reject('MISSING_REQUIRED_ID', 'workspace_id missing or empty');
  if (!isNonEmptyString(row.site_id))      return reject('MISSING_REQUIRED_ID', 'site_id missing or empty');
  if (!isNonEmptyString(row.session_id))   return reject('MISSING_REQUIRED_ID', 'session_id missing or empty');

  // ---- Version validation ---------------------------------------------
  if (!isNonEmptyString(row.extraction_version)) {
    return reject('MISSING_REQUIRED_ID', 'session_features.extraction_version missing or empty');
  }

  // ---- source_event_count ----------------------------------------------
  const sourceEventCount = coerceSourceEventCount(row.source_event_count);
  if (sourceEventCount === null) {
    return reject('MISSING_REQUIRED_ID', `session_features.source_event_count is not a non-negative integer (got ${describeValue(row.source_event_count)})`);
  }

  // ---- Provenance timestamps -------------------------------------------
  const derivedAt = provenanceTimestampToIso(row.extracted_at);
  if (derivedAt === null) {
    return reject('MISSING_EXTRACTED_AT', 'session_features.extracted_at is null / missing / not a valid timestamp; observer MUST NOT invent derived_at');
  }
  const firstSeenAt = nullableTimestampToIso(row.first_seen_at);
  const lastSeenAt  = nullableTimestampToIso(row.last_seen_at);

  // ---- Page path candidate (PR#11b hard-coded poi_type = page_path) ----
  const rawPagePath = pickPagePathCandidate(row);
  if (rawPagePath === null) {
    return reject('NO_PAGE_PATH_CANDIDATE', 'session_features row has neither landing_page_path nor last_page_path; observer MUST NOT reconstruct paths from accepted_events or other raw-ledger sources');
  }

  // ---- Assemble PoiSourceRow + BuildPoiCoreInputArgs -------------------
  const evidenceRefs = buildEvidenceRefs('session_features', sourceRowId, row.extraction_version, stage0);

  const sourceRow: PoiSourceRow = {
    source_table:                'session_features',
    source_row_id:               sourceRowId,
    workspace_id:                row.workspace_id,
    site_id:                     row.site_id,
    session_id:                  row.session_id,
    source_event_count:          sourceEventCount,
    evidence_refs:               evidenceRefs,
    first_seen_at:               firstSeenAt,
    last_seen_at:                lastSeenAt,
    behavioural_feature_version: null,   // SF rows do not carry a feature_version
  };

  const input: BuildPoiCoreInputArgs = {
    source_row:        sourceRow,
    raw_surface:       buildRawSurfaceForPagePath(rawPagePath),
    poi_type:          POI_TYPE.PAGE_PATH,
    derived_at:        derivedAt,
    scoring_version:   common.scoring_version,
    poi_input_version: POI_CORE_INPUT_VERSION,
    ...(stage0 !== null ? { stage0 } : {}),
  };
  // `common.poi_input_version` is validated by the runner before this
  // call (and re-validated by the PR#10 adapter against the frozen
  // POI_CORE_INPUT_VERSION constant — defence in depth).
  void common.poi_input_version;

  return { outcome: 'ok', input };
}

export function mapSessionBehaviouralFeaturesRow(
  row:     SessionBehaviouralFeaturesRowRaw,
  stage0:  PoiStage0Context | null,
  common:  MapRowCommon,
): MapperOutcome {
  // ---- Identity validation --------------------------------------------
  const sourceRowId = coerceIdToString(row.behavioural_features_id);
  if (sourceRowId === null) {
    return reject('MISSING_REQUIRED_ID', 'behavioural_features_id missing or invalid');
  }
  if (!isNonEmptyString(row.workspace_id)) return reject('MISSING_REQUIRED_ID', 'workspace_id missing or empty');
  if (!isNonEmptyString(row.site_id))      return reject('MISSING_REQUIRED_ID', 'site_id missing or empty');
  if (!isNonEmptyString(row.session_id))   return reject('MISSING_REQUIRED_ID', 'session_id missing or empty');

  // ---- Version validation ---------------------------------------------
  if (!isNonEmptyString(row.feature_version)) {
    return reject('MISSING_REQUIRED_ID', 'session_behavioural_features_v0_2.feature_version missing or empty');
  }

  // ---- Provenance timestamp (used to surface as detail; SBF will
  // reject below anyway, but we keep the validation order parallel
  // to SF so the diagnostic taxonomy stays consistent) --------------
  if (provenanceTimestampToIso(row.extracted_at) === null) {
    return reject('MISSING_EXTRACTED_AT', 'session_behavioural_features_v0_2.extracted_at is null / missing / not a valid timestamp; observer MUST NOT invent derived_at');
  }

  // ---- PR#11b deliberate diagnostic finding ----------------------------
  // The SBF schema carries NO path / cta / form / offer / referrer
  // columns. PR#11b's hard-coded poi_type = 'page_path' therefore has
  // no privacy-safe candidate to feed the PR#10 adapter. The
  // observer rejects with NO_PAGE_PATH_CANDIDATE — this is the
  // observer-first signal PR#11a §6 describes: SBF is not a viable
  // primary POI source for page_path under the current schema.
  //
  // The observer MUST NOT:
  //   - reconstruct a path from accepted_events (raw ledger forbidden)
  //   - join session_features inline (different primary source row;
  //     PR#11a says one observer attempt PER primary-source row)
  //   - invent a synthetic POI key
  //
  // The reject path still consumes the Stage 0 side-read above so the
  // operator can confirm Stage 0 reachability was attempted; the
  // stage0 context is intentionally unused below.
  void stage0;
  void sourceRowId;
  void common;

  return reject(
    'NO_PAGE_PATH_CANDIDATE',
    `session_behavioural_features_v0_2 row has no privacy-safe page_path candidate (SBF schema carries no path / cta / form / offer / referrer columns; observer MUST NOT reconstruct paths from accepted_events)`,
  );
}

/* --------------------------------------------------------------------------
 * Adapter-error string-match table
 *
 * The PR#10 adapter throws Error with descriptive messages. The
 * observer never modifies the adapter; instead it pattern-matches
 * thrown messages onto the diagnostic taxonomy. Keys mirror the exact
 * substrings PR#10 adapter uses, so future adapter message tweaks
 * need to be reflected here.
 * ------------------------------------------------------------------------ */

const ADAPTER_ERROR_PATTERNS: ReadonlyArray<[RegExp, RejectReason]> = [
  // Page-path normalisation rejection (Codex blocker #1 / #4 + general)
  [/page_path normalisation rejected raw_page_path/, 'INVALID_PAGE_PATH'],
  [/route normalisation rejected raw_page_path/,     'INVALID_PAGE_PATH'],
  // Evidence_refs lineage validation rejection
  // (PR#10 adapter prefixes every evidence_refs error with the literal
  // string "evidence_refs". Checked BEFORE the identity matcher so a
  // forbidden-key error mentioning e.g. `account_id` does not bleed
  // into MISSING_REQUIRED_ID. The detail string is NEVER serialised
  // into the report — only the count surfaces.)
  [/evidence_refs/, 'EVIDENCE_REF_REJECT'],
  // Identity / version
  [/workspace_id|site_id|session_id|source_row\.source_row_id|source_row\.workspace_id|source_row\.site_id|source_row\.session_id/, 'MISSING_REQUIRED_ID'],
  [/scoring_version|poi_input_version|derived_at/, 'MISSING_REQUIRED_ID'],
  // Stage 0 context
  [/^PR#10 POI core input invalid: stage0\./, 'INVALID_STAGE0_CONTEXT'],
];

export function classifyAdapterError(message: string): RejectReason {
  for (const [pat, reason] of ADAPTER_ERROR_PATTERNS) {
    if (pat.test(message)) return reason;
  }
  return 'ADAPTER_VALIDATION_ERROR';
}

/* --------------------------------------------------------------------------
 * Re-exports for tests + runner
 * ------------------------------------------------------------------------ */

function describeValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  return typeof v;
}

export { describeValue };
