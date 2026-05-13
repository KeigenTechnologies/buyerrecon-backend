/**
 * Sprint 2 PR#10 — POI Core Input — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * IMPORTANT (PR#9a §3 + §6):
 *   POI is a shared-core AMS primitive. The `PoiCoreInput` shape
 *   below is surface-centric ONLY — it carries no person /
 *   visitor / company / IP / device identity, no raw URL with
 *   query strings, no raw user_agent, no token / IP hash, no
 *   pepper / bearer / authorization header, no raw payload, no
 *   RiskOutput-shaped field, no Lane A/B output, no Policy /
 *   Trust output, no customer-facing rendered text.
 *
 *   No field name on `PoiCoreInput` may match any of those. The
 *   static-source sweep in `tests/v1/poi-core.test.ts` enforces
 *   this; the closed TypeScript shape below provides the
 *   compile-time guarantee.
 *
 * Helen sign-off OD-1..OD-8 (recorded in PR#9a):
 *   OD-1 POI is the next shared primitive after Risk.
 *   OD-2 Option A — contract-only first (this PR).
 *   OD-3 Allowed POI v0.1 surfaces: page_path, route, cta_id,
 *        form_id, offer_surface, referrer_class.
 *   OD-4 UTM is context only, never a POI key.
 *   OD-5 POI independent from Risk by default — risk_observations_v0_1
 *        is NOT a POI derivation input unless Helen explicitly opts in.
 *   OD-6 Pure contract/adapter proof; mirror PR#7b cadence.
 *   OD-7 Stage 0 context may flow as eligibility/provenance only;
 *        Stage 0 is NEVER itself a POI.
 *   OD-8 first-seen-in-session distinction deferred.
 */

import type { PoiInputVersion } from './version.js';

/* --------------------------------------------------------------------------
 * POI type taxonomy (PR#9a §3.2 + OD-3 + OD-4)
 *
 * Six allowed POI types in v0.1. UTM is NOT a POI type — UTM lives
 * in `PoiContext` (per OD-4). Person / visitor / company identity
 * are forbidden by hard exclusion (PR#9a §6).
 * ------------------------------------------------------------------------ */

export const POI_TYPE = {
  PAGE_PATH:      'page_path',
  ROUTE:          'route',
  CTA_ID:         'cta_id',
  FORM_ID:        'form_id',
  OFFER_SURFACE:  'offer_surface',
  REFERRER_CLASS: 'referrer_class',
} as const;

export type PoiType = (typeof POI_TYPE)[keyof typeof POI_TYPE];

export const POI_TYPES_ALLOWED: readonly PoiType[] = Object.freeze([
  POI_TYPE.PAGE_PATH,
  POI_TYPE.ROUTE,
  POI_TYPE.CTA_ID,
  POI_TYPE.FORM_ID,
  POI_TYPE.OFFER_SURFACE,
  POI_TYPE.REFERRER_CLASS,
]);

/**
 * Offer-surface classes — coarse labels for the `offer_surface` POI
 * type. The allowlist is intentionally short; product-specific
 * offer taxonomies (e.g. BuyerRecon's pricing/demo/trust pages)
 * map onto these classes via `normalise.classifyOfferSurface`.
 */
export const OFFER_SURFACE = {
  DEMO:    'offer.demo',
  PRICING: 'offer.pricing',
  TRUST:   'offer.trust',
  FOOTER:  'offer.footer',
} as const;

export type OfferSurfaceClass = (typeof OFFER_SURFACE)[keyof typeof OFFER_SURFACE];

export const OFFER_SURFACES_ALLOWED: readonly OfferSurfaceClass[] = Object.freeze([
  OFFER_SURFACE.DEMO,
  OFFER_SURFACE.PRICING,
  OFFER_SURFACE.TRUST,
  OFFER_SURFACE.FOOTER,
]);

/**
 * Referrer classes — coarse classifier for the raw referrer URL.
 * The raw referrer URL is NEVER persisted as a POI key. Only this
 * class label flows.
 */
export const REFERRER_CLASS = {
  SEARCH:  'referrer.search',
  SOCIAL:  'referrer.social',
  EMAIL:   'referrer.email',
  DIRECT:  'referrer.direct',
  UNKNOWN: 'referrer.unknown',
} as const;

export type ReferrerClass = (typeof REFERRER_CLASS)[keyof typeof REFERRER_CLASS];

export const REFERRER_CLASSES_ALLOWED: readonly ReferrerClass[] = Object.freeze([
  REFERRER_CLASS.SEARCH,
  REFERRER_CLASS.SOCIAL,
  REFERRER_CLASS.EMAIL,
  REFERRER_CLASS.DIRECT,
  REFERRER_CLASS.UNKNOWN,
]);

/* --------------------------------------------------------------------------
 * POI surface-class allowlist (PR#10 Codex blocker #2)
 *
 * `poi_surface_class` is a coarse, privacy-safe label that can be
 * attached to a `PoiKey` to indicate the broad category of the
 * surface. The allowlist is finite — arbitrary caller-supplied
 * strings (raw URLs, secrets, identity-shaped values) are NOT
 * accepted. This closes a privacy gap where the original
 * `string | null` typing let any text flow into the serialised
 * envelope.
 *
 * Allowed labels are dotted lower-snake namespaces:
 *   - `page.*`     — coarse page categories
 *   - `cta.*`      — coarse CTA roles
 *   - `form.*`     — coarse form roles
 *   - `offer.*`    — coarse offer surfaces (mirrors OfferSurfaceClass)
 *   - `referrer.*` — coarse referrer-category marker
 *
 * Bumping this enum requires Helen sign-off + a PR#9a contract
 * revision (it is part of the public POI input shape).
 * ------------------------------------------------------------------------ */

export const POI_SURFACE_CLASS = {
  PAGE_GENERAL:    'page.general',
  PAGE_HOME:       'page.home',
  PAGE_PRICING:    'page.pricing',
  PAGE_DEMO:       'page.demo',
  PAGE_RESOURCES:  'page.resources',
  PAGE_TRUST:      'page.trust',
  CTA_PRIMARY:     'cta.primary',
  CTA_SECONDARY:   'cta.secondary',
  FORM_DEMO:       'form.demo',
  FORM_CONTACT:    'form.contact',
  OFFER_DEMO:      'offer.demo',
  OFFER_PRICING:   'offer.pricing',
  OFFER_TRUST:     'offer.trust',
  REFERRER_CLASS:  'referrer.class',
} as const;

export type PoiSurfaceClass = (typeof POI_SURFACE_CLASS)[keyof typeof POI_SURFACE_CLASS];

export const POI_SURFACE_CLASSES_ALLOWED: readonly PoiSurfaceClass[] = Object.freeze([
  POI_SURFACE_CLASS.PAGE_GENERAL,
  POI_SURFACE_CLASS.PAGE_HOME,
  POI_SURFACE_CLASS.PAGE_PRICING,
  POI_SURFACE_CLASS.PAGE_DEMO,
  POI_SURFACE_CLASS.PAGE_RESOURCES,
  POI_SURFACE_CLASS.PAGE_TRUST,
  POI_SURFACE_CLASS.CTA_PRIMARY,
  POI_SURFACE_CLASS.CTA_SECONDARY,
  POI_SURFACE_CLASS.FORM_DEMO,
  POI_SURFACE_CLASS.FORM_CONTACT,
  POI_SURFACE_CLASS.OFFER_DEMO,
  POI_SURFACE_CLASS.OFFER_PRICING,
  POI_SURFACE_CLASS.OFFER_TRUST,
  POI_SURFACE_CLASS.REFERRER_CLASS,
]);

/* --------------------------------------------------------------------------
 * PoiKey — the (type, normalised-key, optional surface_class) tuple
 *
 * `poi_key` is the normalised, privacy-safe key string. Query
 * strings stripped; routes collapsed to patterns; CTA/form IDs
 * allowlist-validated; referrer reduced to class.
 *
 * `poi_surface_class` is an optional coarse label the caller may
 * attach (PR#9a §5.4). It is OPTIONAL — the adapter does not
 * compute it; the caller supplies it (or null) when relevant.
 * ------------------------------------------------------------------------ */

export interface PoiKey {
  readonly poi_type:           PoiType;
  readonly poi_key:            string;
  readonly poi_surface_class:  PoiSurfaceClass | null;
}

/* --------------------------------------------------------------------------
 * Evidence ref (verbatim mirror — same shape as PR#7b)
 *
 * The future POI observer will preserve evidence_refs verbatim
 * through to whichever downstream consumer reads them. The bridge
 * adapter does NOT rewrite, deduplicate, or summarise evidence_refs.
 * ------------------------------------------------------------------------ */

export interface PoiEvidenceRef {
  readonly table: string;
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * PoiContext — non-key context fields (PR#9a OD-4)
 *
 * UTM lives here, NOT in PoiKey. The Series / Trust / Policy layers
 * downstream may read `poi_context` for cohort grouping without it
 * ever affecting the POI key itself.
 *
 * Every field is optional + nullable; the adapter does not invent
 * values. If the caller supplies a UTM value, it MUST be normalised
 * via `normalise.normaliseUtmCampaignClass` first.
 * ------------------------------------------------------------------------ */

export interface PoiContext {
  readonly utm_campaign_class:  string | null;
  readonly utm_source_class:    string | null;
  readonly utm_medium_class:    string | null;
}

/* --------------------------------------------------------------------------
 * PoiStage0Context — eligibility / provenance carry-through (OD-7)
 *
 * Stage 0 context may flow into `eligibility` only. Stage 0 is NOT
 * itself a POI. `rule_id` is carried for auditing; it never becomes
 * a reason_code or a scoring feature.
 * ------------------------------------------------------------------------ */

export interface PoiStage0Context {
  readonly stage0_decision_id:  string;
  readonly stage0_version:      string;
  readonly excluded:            boolean;
  readonly rule_id:             string;
  readonly record_only:         true;
}

/* --------------------------------------------------------------------------
 * Source row shape (PR#9a §4.1 — derived layers only)
 *
 * POI v0.1 reads from derived layers, not from raw event ledger.
 * PR#9a §4.1 lists `session_features` (PR#11) and
 * `session_behavioural_features_v0_2` (PR#1 + PR#2) as the default
 * allowed sources. `risk_observations_v0_1` (PR#6) is CONDITIONAL —
 * only allowed if Helen selects the OD-5 Risk-as-input path; under
 * the default it is observer/join context, NOT a POI derivation input.
 *
 * The literal union below reflects the DEFAULT OD-5 path:
 * Risk is NOT in the list. If Helen opts in to OD-5 Risk path, a
 * future contract revision adds `'risk_observations_v0_1'`.
 * ------------------------------------------------------------------------ */

export type PoiSourceTable =
  | 'session_features'
  | 'session_behavioural_features_v0_2';

export interface PoiSourceRow {
  readonly source_table:               PoiSourceTable;
  readonly source_row_id:              string;
  readonly workspace_id:               string;
  readonly site_id:                    string;
  readonly session_id:                 string;
  readonly source_event_count:         number;
  readonly evidence_refs:              readonly PoiEvidenceRef[];
  readonly first_seen_at:              string | null;     // ISO-8601 (caller-supplied)
  readonly last_seen_at:               string | null;     // ISO-8601 (caller-supplied)
  readonly behavioural_feature_version: string | null;    // present when source_table is SBF
}

/* --------------------------------------------------------------------------
 * Route rules — caller-supplied collapse patterns
 *
 * Each rule replaces a regex group with a named placeholder. For
 * example, `{ pattern: /\/users\/\d+/, replacement: '/users/:id' }`
 * collapses `/users/12345` to `/users/:id`.
 *
 * Caller controls the route taxonomy; the adapter does not invent
 * collapses on its own.
 * ------------------------------------------------------------------------ */

export interface RouteRule {
  readonly pattern:     RegExp;
  readonly replacement: string;
}

/* --------------------------------------------------------------------------
 * RawSurfaceObservation — what the caller observed about the surface
 *
 * The caller (a future PR#11 worker, or a unit test) extracts these
 * fields from upstream rows. The adapter normalises the field
 * matching `poi_type` into the `poi_key`. Every field is optional
 * + nullable; the adapter rejects with INVALID_POI_KEY if the
 * field needed for the requested `poi_type` is missing or fails
 * normalisation.
 *
 * No raw URL with query strings, no raw user_agent, no IP, no
 * cookie. The caller is responsible for not handing these in.
 * ------------------------------------------------------------------------ */

export interface RawSurfaceObservation {
  readonly raw_page_path:    string | null;
  readonly raw_referrer:     string | null;
  readonly cta_id:           string | null;
  readonly form_id:           string | null;
  readonly raw_offer_surface: string | null;
  readonly route_rules:       readonly RouteRule[];
  /**
   * Optional coarse surface class. MUST be one of
   * `PoiSurfaceClass` (page.* / cta.* / form.* / offer.* /
   * referrer.class) when set. Arbitrary strings are rejected by
   * the adapter (Codex blocker #2).
   */
  readonly poi_surface_class: PoiSurfaceClass | null;
}

/* --------------------------------------------------------------------------
 * BuildPoiCoreInputArgs — the adapter's single input
 *
 * The adapter accepts one call per (session, poi_type) pair. A
 * future worker that emits multiple POIs per session iterates over
 * the desired POI types and calls the adapter once per type.
 * ------------------------------------------------------------------------ */

export interface BuildPoiCoreInputArgs {
  readonly source_row:        PoiSourceRow;
  readonly raw_surface:       RawSurfaceObservation;
  readonly poi_type:          PoiType;
  readonly derived_at:        string;             // ISO-8601 — caller-supplied; NEVER Date.now()
  readonly scoring_version:   string;
  readonly poi_input_version: PoiInputVersion;    // MUST equal POI_CORE_INPUT_VERSION
  readonly stage0?:           PoiStage0Context;
  readonly poi_context?:      PoiContext;
}

/* --------------------------------------------------------------------------
 * PoiCoreInput — the public contract output
 *
 * Closed type: no field name on this shape may match a forbidden
 * concept (RiskOutput / Policy / Trust / Lane A/B / identity /
 * customer-facing / raw URL / raw UA / token / pepper / etc.).
 * ------------------------------------------------------------------------ */

export interface PoiCoreInput {
  readonly poi_input_version:           PoiInputVersion;
  readonly workspace_id:                string;
  readonly site_id:                     string;
  readonly session_id:                  string;

  readonly source_identity: {
    readonly source_table:              PoiSourceTable;
    readonly source_row_id:             string;
  };

  readonly source_versions: {
    readonly poi_input_version:           PoiInputVersion;
    readonly scoring_version:             string;
    readonly behavioural_feature_version: string | null;
    readonly stage0_version:              string | null;
  };

  readonly poi:                         PoiKey;
  readonly poi_context:                 PoiContext;

  readonly evidence_refs:               readonly PoiEvidenceRef[];

  readonly eligibility: {
    readonly stage0_excluded:           boolean;
    readonly stage0_rule_id:            string | null;
    readonly poi_eligible:              boolean;
  };

  readonly provenance: {
    readonly source_event_count:        number;
    readonly record_only:               true;
    readonly derived_at:                string;     // ISO-8601, caller-injected
    readonly first_seen_at:             string | null;
    readonly last_seen_at:              string | null;
  };
}

/* --------------------------------------------------------------------------
 * PoiObservation — collection wrapper (in-memory only)
 *
 * Wraps multiple PoiCoreInput values produced from one session.
 * Not persisted in PR#10 (per PR#9a Option A). A future PR#11 may
 * persist these to `poi_observations_v0_1` if Helen chooses Option B.
 * ------------------------------------------------------------------------ */

export interface PoiObservation {
  readonly inputs: readonly PoiCoreInput[];
}
