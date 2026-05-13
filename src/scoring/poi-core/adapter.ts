/**
 * Sprint 2 PR#10 — POI Core Input — pure adapter.
 *
 * Pure function. Same input -> same output (byte-stable). No DB
 * access. No HTTP. No Date.now(). No process.env read. No file I/O.
 * No mutation of the input.
 *
 * Implementation contract (PR#9a §5.1 + PR#7b precedent):
 *   1. Accept a fully-loaded `BuildPoiCoreInputArgs`.
 *   2. Validate identity, source, evidence_refs, poi_type, version,
 *      derived_at, stage0 (if supplied).
 *   3. Normalise the requested POI field via `normalise.ts` helpers.
 *   4. Assemble a `PoiCoreInput` envelope matching the closed type
 *      in `types.ts`.
 *   5. Be deterministic - no clock read in this pure function.
 *   6. Be versioned - `poi_input_version` stamped from the caller's
 *      input which MUST equal `POI_CORE_INPUT_VERSION`.
 *
 * Hard absences (PR#9a §6):
 *   - No risk_index / verification_score / evidence_band /
 *     action_recommendation / reason_codes / reason_impacts /
 *     triggered_tags / penalty_total fields on the envelope shape.
 *   - No Lane A / Lane B / Policy / Trust / report / customer-facing
 *     fields.
 *   - No person_id / visitor_id / company_id / email_id / IP-org /
 *     hashed-identity fields.
 *   - No raw URL with query strings, no raw user_agent, no
 *     token_hash / ip_hash / pepper / bearer / authorization
 *     headers, no raw payload.
 */

import {
  classifyOfferSurface,
  classifyReferrer,
  deriveRoutePattern,
  normalisePagePath,
  validateCtaId,
  validateFormId,
} from './normalise.js';
import {
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPE,
  POI_TYPES_ALLOWED,
  type BuildPoiCoreInputArgs,
  type PoiContext,
  type PoiCoreInput,
  type PoiEvidenceRef,
  type PoiKey,
  type PoiSourceTable,
  type PoiSurfaceClass,
} from './types.js';
import { POI_CORE_INPUT_VERSION, type PoiInputVersion } from './version.js';

/* --------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------ */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function requireNonEmptyString(value: unknown, field: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`PR#10 POI core input invalid: ${field} must be a non-empty string (got ${JSON.stringify(value)})`);
  }
}

function requireNonNegativeInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
      || !Number.isInteger(value)) {
    throw new Error(`PR#10 POI core input invalid: ${field} must be a non-negative integer (got ${JSON.stringify(value)})`);
  }
}

const ALLOWED_SOURCE_TABLES: ReadonlySet<PoiSourceTable> = new Set<PoiSourceTable>([
  'session_features',
  'session_behavioural_features_v0_2',
]);

const ALLOWED_POI_TYPES_SET: ReadonlySet<string> = new Set(POI_TYPES_ALLOWED);

const ALLOWED_POI_SURFACE_CLASSES_SET: ReadonlySet<string> = new Set(POI_SURFACE_CLASSES_ALLOWED);

/* --------------------------------------------------------------------------
 * Evidence-refs allowlist + forbidden-key sweep (PR#10 Codex blocker #3)
 *
 * PR#9a §4.1 + §4.2 + §7.4 require POI evidence_refs to point at
 * derived / provenance rows only — never at raw-ledger tables or
 * personal-data carrying fields. The PR#10 default allowlist is the
 * intersection of the PR#9a §4.1 "allowed reads" list with the
 * OD-5 default (Risk excluded by default).
 *
 * Forbidden tables and forbidden keys below MUST cover every privacy-
 * sensitive surface PR#9a §6 enumerates. The recursive walker
 * rejects any nested occurrence as well — e.g.
 *   { table: 'session_features', meta: { user_agent: '...' } }
 * trips on `meta.user_agent` even though the top-level key is `meta`.
 * ------------------------------------------------------------------------ */

const ALLOWED_EVIDENCE_REF_TABLES: ReadonlySet<string> = new Set<string>([
  'session_features',
  'session_behavioural_features_v0_2',
  'stage0_decisions',
]);

const FORBIDDEN_EVIDENCE_REF_KEYS: ReadonlySet<string> = new Set<string>([
  // Raw / payload surfaces
  'raw_payload',
  'payload',
  'canonical_jsonb',
  'page_url',
  'full_url',
  'url_query',
  'query',
  // Identity-correlation surfaces
  'user_agent',
  'ua',
  'ip',
  'ip_hash',
  'token_hash',
  'authorization',
  'Authorization',
  'bearer',
  'auth',
  'cookie',
  'pepper',
  // Person / company / contact identity
  'person_id',
  'visitor_id',
  'company_id',
  'account_id',
  'email',
  'phone',
]);

function assertNoForbiddenEvidenceKeys(value: unknown, path: string): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoForbiddenEvidenceKeys(v, `${path}[${i}]`));
    return;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_EVIDENCE_REF_KEYS.has(k)) {
      throw new Error(`PR#10 POI core input invalid: evidence_refs ${path}.${k} is a forbidden key (privacy / lineage rule)`);
    }
    assertNoForbiddenEvidenceKeys((value as Record<string, unknown>)[k], `${path}.${k}`);
  }
}

const EMPTY_POI_CONTEXT: PoiContext = Object.freeze({
  utm_campaign_class: null,
  utm_source_class:   null,
  utm_medium_class:   null,
});

/* --------------------------------------------------------------------------
 * Evidence refs verbatim shape validation
 *
 * Mirrors PR#8b shape validation: each entry must be a plain object
 * with a non-empty `table` field. Empty arrays are forbidden — POI
 * provenance is mandatory.
 * ------------------------------------------------------------------------ */

function validateEvidenceRefs(raw: unknown): readonly PoiEvidenceRef[] {
  if (!Array.isArray(raw)) {
    throw new Error('PR#10 POI core input invalid: evidence_refs must be an array');
  }
  if (raw.length === 0) {
    throw new Error('PR#10 POI core input invalid: evidence_refs must contain at least one provenance entry');
  }
  for (const [i, ref] of raw.entries()) {
    if (!isPlainObject(ref)) {
      throw new Error(`PR#10 POI core input invalid: evidence_refs[${i}] is not a plain object`);
    }
    const table = (ref as Record<string, unknown>).table;
    if (!isNonEmptyString(table)) {
      throw new Error(`PR#10 POI core input invalid: evidence_refs[${i}].table must be a non-empty string`);
    }
    // Codex blocker #3 — evidence_refs allowlist:
    if (!ALLOWED_EVIDENCE_REF_TABLES.has(table)) {
      throw new Error(
        `PR#10 POI core input invalid: evidence_refs[${i}].table ${JSON.stringify(table)} is not in the PR#10 default allowlist ` +
        `(session_features / session_behavioural_features_v0_2 / stage0_decisions). ` +
        `Raw-ledger tables (accepted_events / rejected_events / ingest_requests) and risk_observations_v0_1 ` +
        `(per OD-5 default) are explicitly rejected.`
      );
    }
    // Codex blocker #3 — recursive forbidden-key sweep:
    assertNoForbiddenEvidenceKeys(ref, `evidence_refs[${i}]`);
  }
  return raw as readonly PoiEvidenceRef[];
}

/* --------------------------------------------------------------------------
 * POI key normalisation per `poi_type`
 *
 * Returns either a valid `PoiKey` or throws INVALID_POI_KEY-style
 * error. The adapter calls this once per request — the requested
 * `poi_type` selects which raw_surface field is normalised.
 * ------------------------------------------------------------------------ */

function validatePoiSurfaceClass(raw: unknown): PoiSurfaceClass | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw new Error(`PR#10 POI core input invalid: poi_surface_class must be a PoiSurfaceClass string or null (got ${typeof raw})`);
  }
  if (raw.length === 0) return null;
  // Codex blocker #2 — strict enum allowlist. Arbitrary text
  // (raw URLs, secrets, identity strings, query strings, labels
  // with whitespace, etc.) is rejected by virtue of not appearing
  // in the allowlist. Defence-in-depth: also reject explicit
  // privacy markers inside otherwise-allowed values (cannot happen
  // with the current allowlist but kept for future-bump safety).
  if (!ALLOWED_POI_SURFACE_CLASSES_SET.has(raw)) {
    throw new Error(
      `PR#10 POI core input invalid: poi_surface_class ${JSON.stringify(raw)} is not in POI_SURFACE_CLASSES_ALLOWED ` +
      `(page.* / cta.* / form.* / offer.* / referrer.class). ` +
      `Arbitrary URLs / labels / identity strings are rejected.`
    );
  }
  return raw as PoiSurfaceClass;
}

function buildPoiKey(args: BuildPoiCoreInputArgs): PoiKey {
  const surface_class_or_null = validatePoiSurfaceClass(args.raw_surface.poi_surface_class);

  switch (args.poi_type) {
    case POI_TYPE.PAGE_PATH: {
      const path = normalisePagePath(args.raw_surface.raw_page_path);
      if (path === null) {
        throw new Error(`PR#10 POI core input invalid: page_path normalisation rejected raw_page_path (got ${JSON.stringify(args.raw_surface.raw_page_path)})`);
      }
      return Object.freeze({ poi_type: POI_TYPE.PAGE_PATH, poi_key: path, poi_surface_class: surface_class_or_null });
    }
    case POI_TYPE.ROUTE: {
      const path = normalisePagePath(args.raw_surface.raw_page_path);
      if (path === null) {
        throw new Error(`PR#10 POI core input invalid: route normalisation rejected raw_page_path (got ${JSON.stringify(args.raw_surface.raw_page_path)})`);
      }
      const route = deriveRoutePattern(path, args.raw_surface.route_rules);
      if (route === null || route.length === 0) {
        throw new Error('PR#10 POI core input invalid: route derivation produced an empty key');
      }
      return Object.freeze({ poi_type: POI_TYPE.ROUTE, poi_key: route, poi_surface_class: surface_class_or_null });
    }
    case POI_TYPE.CTA_ID: {
      const cta = validateCtaId(args.raw_surface.cta_id);
      if (cta === null) {
        throw new Error(`PR#10 POI core input invalid: cta_id failed allowlist validation (got ${JSON.stringify(args.raw_surface.cta_id)})`);
      }
      return Object.freeze({ poi_type: POI_TYPE.CTA_ID, poi_key: cta, poi_surface_class: surface_class_or_null });
    }
    case POI_TYPE.FORM_ID: {
      const form = validateFormId(args.raw_surface.form_id);
      if (form === null) {
        throw new Error(`PR#10 POI core input invalid: form_id failed allowlist validation (got ${JSON.stringify(args.raw_surface.form_id)})`);
      }
      return Object.freeze({ poi_type: POI_TYPE.FORM_ID, poi_key: form, poi_surface_class: surface_class_or_null });
    }
    case POI_TYPE.OFFER_SURFACE: {
      const offer = classifyOfferSurface(args.raw_surface.raw_offer_surface);
      if (offer === null) {
        throw new Error(`PR#10 POI core input invalid: offer_surface mapper rejected raw_offer_surface (got ${JSON.stringify(args.raw_surface.raw_offer_surface)}) — value is not in the OFFER_SURFACES_ALLOWED set`);
      }
      return Object.freeze({ poi_type: POI_TYPE.OFFER_SURFACE, poi_key: offer, poi_surface_class: surface_class_or_null });
    }
    case POI_TYPE.REFERRER_CLASS: {
      const ref = classifyReferrer(args.raw_surface.raw_referrer);
      // classifyReferrer always returns a valid class (never null), so
      // no need to reject here. The raw referrer URL is NEVER returned.
      return Object.freeze({ poi_type: POI_TYPE.REFERRER_CLASS, poi_key: ref, poi_surface_class: surface_class_or_null });
    }
  }
  // Exhaustive switch — TypeScript narrows this branch as unreachable,
  // but include a defensive throw for runtime safety against future
  // enum extensions.
  throw new Error(`PR#10 POI core input invalid: unhandled poi_type ${JSON.stringify(args.poi_type)}`);
}

/* --------------------------------------------------------------------------
 * Stage 0 context validation
 * ------------------------------------------------------------------------ */

function validateStage0Context(args: BuildPoiCoreInputArgs): void {
  if (args.stage0 === undefined) return;
  const s = args.stage0;
  requireNonEmptyString(s.stage0_decision_id, 'stage0.stage0_decision_id');
  requireNonEmptyString(s.stage0_version,     'stage0.stage0_version');
  requireNonEmptyString(s.rule_id,            'stage0.rule_id');
  if (typeof s.excluded !== 'boolean') {
    throw new Error('PR#10 POI core input invalid: stage0.excluded must be a boolean');
  }
  if (s.record_only !== true) {
    throw new Error('PR#10 POI core input invalid: stage0.record_only must be the literal `true`');
  }
}

/* --------------------------------------------------------------------------
 * POI context (UTM) shape validation
 *
 * UTM fields are caller-supplied. Each field is optional + nullable.
 * If supplied, each must already have been normalised by the caller
 * via `normalise.normaliseUtmCampaignClass` (allowlist-shape regex).
 * The adapter re-validates each field as a defence-in-depth measure.
 * ------------------------------------------------------------------------ */

const UTM_CLASS_VALIDATION_REGEX = /^[a-z0-9._-]{1,64}$/;

function validateAndFreezeContext(supplied: PoiContext | undefined): PoiContext {
  if (supplied === undefined) return EMPTY_POI_CONTEXT;
  const mutable: Record<string, string | null> = {
    utm_campaign_class: null,
    utm_source_class:   null,
    utm_medium_class:   null,
  };
  for (const k of ['utm_campaign_class', 'utm_source_class', 'utm_medium_class'] as const) {
    const v = supplied[k];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string') {
      throw new Error(`PR#10 POI core input invalid: poi_context.${k} must be a string or null (got ${typeof v})`);
    }
    if (!UTM_CLASS_VALIDATION_REGEX.test(v)) {
      throw new Error(`PR#10 POI core input invalid: poi_context.${k} (${JSON.stringify(v)}) must match the allowlist shape /^[a-z0-9._-]{1,64}$/`);
    }
    mutable[k] = v;
  }
  return Object.freeze(mutable as unknown as PoiContext);
}

/* --------------------------------------------------------------------------
 * Evidence refs deep clone (verbatim preservation)
 *
 * Per PR#9a §7.4, evidence_refs are preserved verbatim. We clone
 * them so the envelope cannot leak a writable reference back into
 * the caller's input.
 * ------------------------------------------------------------------------ */

function jsonClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(jsonClone) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>)) {
    out[k] = jsonClone((value as Record<string, unknown>)[k]);
  }
  return out as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const v of value) deepFreeze(v);
    return Object.freeze(value);
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return Object.freeze(value);
}

function preserveEvidenceRefs(refs: readonly PoiEvidenceRef[]): readonly PoiEvidenceRef[] {
  return deepFreeze(refs.map((r) => jsonClone(r) as PoiEvidenceRef));
}

/* --------------------------------------------------------------------------
 * buildPoiCoreInput — public adapter
 *
 * Pure. Validates every required field, normalises the POI key,
 * assembles a deep-frozen `PoiCoreInput` envelope, returns it.
 * ------------------------------------------------------------------------ */

export function buildPoiCoreInput(args: BuildPoiCoreInputArgs): PoiCoreInput {
  // ---- Version validation (must match the frozen constant) -------------
  if (args.poi_input_version !== POI_CORE_INPUT_VERSION) {
    throw new Error(`PR#10 POI core input invalid: poi_input_version ${JSON.stringify(args.poi_input_version)} does not match POI_CORE_INPUT_VERSION ${JSON.stringify(POI_CORE_INPUT_VERSION)}`);
  }
  const poi_input_version: PoiInputVersion = args.poi_input_version;

  requireNonEmptyString(args.scoring_version, 'scoring_version');
  requireNonEmptyString(args.derived_at,      'derived_at');

  // ---- POI type allowlist ----------------------------------------------
  if (!ALLOWED_POI_TYPES_SET.has(args.poi_type)) {
    throw new Error(`PR#10 POI core input invalid: poi_type ${JSON.stringify(args.poi_type)} is not in the Helen-signed OD-3 allowlist`);
  }

  // ---- Source row identity ---------------------------------------------
  const src = args.source_row;
  if (!ALLOWED_SOURCE_TABLES.has(src.source_table)) {
    throw new Error(`PR#10 POI core input invalid: source_row.source_table ${JSON.stringify(src.source_table)} is not in the default allowlist (session_features / session_behavioural_features_v0_2). Risk-as-input requires explicit OD-5 opt-in.`);
  }
  requireNonEmptyString(src.source_row_id, 'source_row.source_row_id');
  requireNonEmptyString(src.workspace_id,  'source_row.workspace_id');
  requireNonEmptyString(src.site_id,       'source_row.site_id');
  requireNonEmptyString(src.session_id,    'source_row.session_id');
  requireNonNegativeInteger(src.source_event_count, 'source_row.source_event_count');
  if (src.first_seen_at !== null && !isNonEmptyString(src.first_seen_at)) {
    throw new Error('PR#10 POI core input invalid: source_row.first_seen_at must be a non-empty string or null');
  }
  if (src.last_seen_at !== null && !isNonEmptyString(src.last_seen_at)) {
    throw new Error('PR#10 POI core input invalid: source_row.last_seen_at must be a non-empty string or null');
  }
  if (src.behavioural_feature_version !== null && !isNonEmptyString(src.behavioural_feature_version)) {
    throw new Error('PR#10 POI core input invalid: source_row.behavioural_feature_version must be a non-empty string or null');
  }

  // ---- Evidence refs verbatim shape ------------------------------------
  const evidenceRefs = validateEvidenceRefs(src.evidence_refs);

  // ---- Stage 0 (optional) ----------------------------------------------
  validateStage0Context(args);

  // ---- POI context (UTM) -----------------------------------------------
  const poi_context = validateAndFreezeContext(args.poi_context);

  // ---- POI key normalisation -------------------------------------------
  const poi = buildPoiKey(args);

  // ---- Eligibility derivation (PR#9a OD-7) ------------------------------
  // POI is emitted for audit even when Stage 0 is excluded; the
  // eligibility flag carries the "should this POI flow into buyer-
  // motion scoring?" signal. Mirrors PR#7b's eligibility shape.
  const stage0_excluded = args.stage0 !== undefined && args.stage0.excluded === true;
  const poi_eligible = !stage0_excluded;

  const envelope: PoiCoreInput = {
    poi_input_version,
    workspace_id: src.workspace_id,
    site_id:      src.site_id,
    session_id:   src.session_id,
    source_identity: deepFreeze({
      source_table:   src.source_table,
      source_row_id:  src.source_row_id,
    }),
    source_versions: deepFreeze({
      poi_input_version,
      scoring_version:             args.scoring_version,
      behavioural_feature_version: src.behavioural_feature_version,
      stage0_version:              args.stage0 !== undefined ? args.stage0.stage0_version : null,
    }),
    poi,
    poi_context,
    evidence_refs: preserveEvidenceRefs(evidenceRefs),
    eligibility: deepFreeze({
      stage0_excluded,
      stage0_rule_id: args.stage0 !== undefined ? args.stage0.rule_id : null,
      poi_eligible,
    }),
    provenance: deepFreeze({
      source_event_count: src.source_event_count,
      record_only:        true as const,
      derived_at:         args.derived_at,
      first_seen_at:      src.first_seen_at,
      last_seen_at:       src.last_seen_at,
    }),
  };

  return deepFreeze(envelope);
}
