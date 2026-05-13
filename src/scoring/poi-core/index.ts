/**
 * Sprint 2 PR#10 — POI Core Input — module entry.
 *
 * Public re-exports for tests + future workers + future POI
 * observer. No DB. No HTTP. No process side effects on import.
 * The adapter is pure; any future worker that performs DB I/O
 * lives in its own file under this directory (out of PR#10 scope
 * per OD-2 / Option A).
 */

export {
  buildPoiCoreInput,
} from './adapter.js';

export {
  classifyOfferSurface,
  classifyReferrer,
  deriveRoutePattern,
  normalisePagePath,
  normaliseUtmCampaignClass,
  normaliseUtmMediumClass,
  normaliseUtmSourceClass,
  validateCtaId,
  validateFormId,
} from './normalise.js';

export {
  OFFER_SURFACE,
  OFFER_SURFACES_ALLOWED,
  POI_SURFACE_CLASS,
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPE,
  POI_TYPES_ALLOWED,
  REFERRER_CLASS,
  REFERRER_CLASSES_ALLOWED,
  type BuildPoiCoreInputArgs,
  type OfferSurfaceClass,
  type PoiContext,
  type PoiCoreInput,
  type PoiEvidenceRef,
  type PoiKey,
  type PoiObservation,
  type PoiSourceRow,
  type PoiSourceTable,
  type PoiStage0Context,
  type PoiSurfaceClass,
  type PoiType,
  type RawSurfaceObservation,
  type ReferrerClass,
  type RouteRule,
} from './types.js';

export {
  POI_CORE_INPUT_VERSION,
  type PoiInputVersion,
} from './version.js';
