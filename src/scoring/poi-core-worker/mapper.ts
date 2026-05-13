/**
 * Sprint 2 PR#11c — POI Core Worker — pure mapper.
 *
 * Maps a raw `pg` row from `session_features` into a
 * `BuildPoiCoreInputArgs` for the PR#10 adapter. Pure: no DB, no
 * HTTP, no clock, no `process.env`, no filesystem.
 *
 * Worker-local. Does NOT import from PR#11b observer (per the
 * locked PR#11c implementation decision: durable worker must not
 * depend on observer internals). The shared contract source of
 * truth is PR#10 `buildPoiCoreInput` — the worker's mapper builds
 * the args, the PR#10 adapter validates and normalises.
 *
 * The mapper does NOT throw on user-data validation failures. It
 * returns a tagged-union `MapperOutcome` the worker inspects. The
 * `RejectReason` taxonomy mirrors PR#11b verbatim for a stable
 * observer/worker/table diagnostic vocabulary.
 *
 * IMPORTANT (PR#11a §5.1 / PR#11c planning §5.5):
 *   Stage 0 exclusion is NOT a reject reason. A Stage-0-excluded
 *   source row still builds a successful PoiCoreInput envelope with
 *   `stage0_excluded=true, poi_eligible=false`, and the worker
 *   UPSERTs it. Rejection happens only when source data is
 *   missing/invalid, when no privacy-safe page_path candidate
 *   exists, or when the PR#10 adapter validation throws.
 *
 * IMPORTANT (PR#10 contract):
 *   `derived_at` is sourced from the SF row's `extracted_at` — the
 *   provenance timestamp PR#11 (session-features extractor) wrote.
 *   The mapper does NOT call `Date.now()`, MUST NOT read the
 *   SELECT-time clock, MUST NOT invent a value. If `extracted_at`
 *   is null/invalid, the row rejects with `MISSING_EXTRACTED_AT`.
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
  PoiKeySourceField,
  RejectReason,
  SessionFeaturesRowRaw,
  Stage0RowRaw,
} from './types.js';

/* --------------------------------------------------------------------------
 * MapperOutcome — internal mapper return type
 * ------------------------------------------------------------------------ */

export type MapperOutcome =
  | {
      readonly outcome:                 'ok';
      readonly input:                   BuildPoiCoreInputArgs;
      readonly poi_key_source_field:    PoiKeySourceField;
      readonly source_versions:         Readonly<Record<string, string>>;
    }
  | {
      readonly outcome:                 'rejected';
      readonly reason:                  RejectReason;
      readonly detail:                  string;
    };

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
 * Page path candidate selection (worker-local; OD-11)
 *
 * Returns:
 *   - { path, source_field } when the chosen field is non-empty
 *   - null when neither landing_page_path nor last_page_path has
 *     non-empty content (row rejects NO_PAGE_PATH_CANDIDATE)
 *
 * Prefers `landing_page_path` (the session's landing surface);
 * falls back to `last_page_path` (the session's exit surface). The
 * mapper does NOT reconstruct paths from any other source. It does
 * NOT read `accepted_events` / `canonical_jsonb` / raw payloads.
 * ------------------------------------------------------------------------ */

export function pickPagePathCandidate(
  row: SessionFeaturesRowRaw,
): { readonly path: string; readonly source_field: PoiKeySourceField } | null {
  if (isNonEmptyString(row.landing_page_path)) {
    return { path: row.landing_page_path, source_field: 'landing_page_path' };
  }
  if (isNonEmptyString(row.last_page_path)) {
    return { path: row.last_page_path, source_field: 'last_page_path' };
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Stage 0 row → PoiStage0Context
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
 * Builds evidence_refs from the successful SF source row identity
 * (+ optional Stage 0 entry when the side-read returned a row). The
 * PR#10 adapter's recursive forbidden-key sweep will reject any
 * accidental forbidden key — defence in depth.
 *
 * `session_features.evidence_refs` JSONB column is NOT read by the
 * worker; the worker's `query.ts::SELECT_SESSION_FEATURES_SQL` does
 * not SELECT that column.
 * ------------------------------------------------------------------------ */

function buildEvidenceRefs(
  sourceRowId:    string,
  sourceVersion:  string,
  stage0:         PoiStage0Context | null,
): readonly PoiEvidenceRef[] {
  const refs: PoiEvidenceRef[] = [
    { table: 'session_features', source_row_id: sourceRowId, extraction_version: sourceVersion },
  ];
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
 * Source-versions JSONB builder (OD-9 forward-compat)
 *
 * Carries the per-source feature/extraction versions. PR#11c v0.1
 * writes only `session_features` + optional `stage0_decisions` +
 * `poi_input_version`. A future SBF-persistence PR adds
 * `session_behavioural_features_v0_2` without a schema change.
 * ------------------------------------------------------------------------ */

function buildSourceVersions(
  extractionVersion:  string,
  poiInputVersion:    string,
  stage0:             PoiStage0Context | null,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {
    session_features:   extractionVersion,
    poi_input_version:  poiInputVersion,
  };
  if (stage0 !== null) {
    out['stage0_decisions'] = stage0.stage0_version;
  }
  return Object.freeze(out);
}

/* --------------------------------------------------------------------------
 * RawSurfaceObservation builder for page_path
 *
 * Hard-coded poi_type = 'page_path' (PR#11c v0.1). Only
 * `raw_page_path` is set; the PR#10 adapter only normalises the
 * field matching the requested poi_type. `route_rules` is empty;
 * `poi_surface_class` is null (the worker does not classify surface
 * class — future PR may tag it).
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
 * Main row mapper: SessionFeaturesRowRaw → BuildPoiCoreInputArgs
 * ------------------------------------------------------------------------ */

export interface MapRowCommon {
  readonly poi_input_version:  string;
  readonly scoring_version:    string;
}

export function mapSessionFeaturesRowToArgs(
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
    return reject('MISSING_EXTRACTED_AT', 'session_features.extracted_at is null / missing / not a valid timestamp; worker MUST NOT invent derived_at');
  }
  const firstSeenAt = nullableTimestampToIso(row.first_seen_at);
  const lastSeenAt  = nullableTimestampToIso(row.last_seen_at);

  // ---- Page path candidate (OD-11) -------------------------------------
  const candidate = pickPagePathCandidate(row);
  if (candidate === null) {
    return reject('NO_PAGE_PATH_CANDIDATE', 'session_features row has neither landing_page_path nor last_page_path; worker MUST NOT reconstruct paths from accepted_events or other raw-ledger sources');
  }

  // ---- Assemble PoiSourceRow + BuildPoiCoreInputArgs -------------------
  const evidenceRefs   = buildEvidenceRefs(sourceRowId, row.extraction_version, stage0);
  const sourceVersions = buildSourceVersions(row.extraction_version, POI_CORE_INPUT_VERSION, stage0);

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
    raw_surface:       buildRawSurfaceForPagePath(candidate.path),
    poi_type:          POI_TYPE.PAGE_PATH,
    derived_at:        derivedAt,
    scoring_version:   common.scoring_version,
    poi_input_version: POI_CORE_INPUT_VERSION,
    ...(stage0 !== null ? { stage0 } : {}),
  };
  // common.poi_input_version is re-validated by the PR#10 adapter
  // against POI_CORE_INPUT_VERSION — defence in depth.
  void common.poi_input_version;

  return {
    outcome:              'ok',
    input,
    poi_key_source_field: candidate.source_field,
    source_versions:      sourceVersions,
  };
}

/* --------------------------------------------------------------------------
 * Adapter-error string-match table (mirrors PR#11b verbatim)
 *
 * The PR#10 adapter throws Error with descriptive messages. The
 * worker pattern-matches thrown messages onto the diagnostic
 * taxonomy. The evidence_refs pattern is placed BEFORE the identity
 * matcher because forbidden-key errors may mention identity-like
 * fields (e.g. `account_id`, `email`) without actually being
 * identity errors.
 * ------------------------------------------------------------------------ */

const ADAPTER_ERROR_PATTERNS: ReadonlyArray<[RegExp, RejectReason]> = [
  // Page-path normalisation rejection (PR#10 Codex blocker #1 / #4)
  [/page_path normalisation rejected raw_page_path/, 'INVALID_PAGE_PATH'],
  [/route normalisation rejected raw_page_path/,     'INVALID_PAGE_PATH'],
  // Evidence_refs validation rejection
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
 * Small helper used by error-detail strings
 * ------------------------------------------------------------------------ */

function describeValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  return typeof v;
}

export { describeValue };
