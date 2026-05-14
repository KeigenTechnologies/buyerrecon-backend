/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import.
 */

export {
  buildSessionPreview,
  classifyActionabilityBand,
  classifyUniversalSurface,
  emptyActionabilityDist,
  emptyUniversalSurfaceDist,
  groupBySession,
  isExcludedSurface,
  isKnownSurface,
  truncateSessionId as mapperTruncateSessionId,
  type GroupedRows,
  type SessionPreview,
} from './mapper.js';

export {
  parseDatabaseUrl,
  renderMarkdown,
  truncateSessionId,
} from './report.js';

export {
  decideProductContextTimingCliExitCode,
  makeStubClient,
  runProductContextTimingObserver,
  type CliExitDecision,
  type RunObserverArgs,
  type StubClient,
  type StubQueryFn,
} from './runner.js';

export { isValidEvidenceRefs } from './mapper.js';

export {
  SELECT_POI_ROWS_SQL,
  SELECT_POI_SEQUENCE_ROWS_SQL,
  SELECT_POI_SEQUENCE_TABLE_PRESENT_SQL,
  SELECT_POI_TABLE_PRESENT_SQL,
  SELECT_TABLE_COLUMNS_SQL,
} from './query.js';

export {
  ACTIONABILITY_BANDS_ALLOWED,
  BUYING_ROLE_LENS_VERSION,
  CATEGORY_TEMPLATES_ALLOWED,
  CATEGORY_TEMPLATE_VERSION,
  DEFAULT_CATEGORY_TEMPLATE,
  DEFAULT_PRIMARY_CONVERSION_GOAL,
  DEFAULT_SALES_MOTION,
  EVIDENCE_PREVIEW_REJECT_REASONS,
  EXCLUDED_MAPPING_VERSION,
  EXCLUDED_SURFACES,
  FRESHNESS_DECAY_MODEL_VERSION,
  OBSERVER_VERSION,
  PRIMARY_CONVERSION_GOALS_ALLOWED,
  PRODUCT_CONTEXT_PROFILE_VERSION,
  REQUIRED_POI_COLUMNS,
  REQUIRED_POI_SEQUENCE_COLUMNS,
  SALES_MOTIONS_ALLOWED,
  SITE_MAPPING_VERSION,
  TIMING_THRESHOLDS_BY_SALES_MOTION,
  TIMING_WINDOW_MODEL_VERSION,
  UNIVERSAL_SURFACES_ALLOWED,
  UNIVERSAL_SURFACE_TAXONOMY_VERSION,
  type ActionabilityBand,
  type AmsAlignedJsonPreviewBlock,
  type AmsAlignedJsonPreviewSample,
  type BoundaryBlock,
  type CategoryTemplate,
  type EvidencePreviewRejectReason,
  type EvidenceQualityBlock,
  type ObserverReport,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type PcfReasonToken,
  type PoiRowRaw,
  type PoiSequenceRowRaw,
  type PrimaryConversionGoal,
  type ProductContextPreviewBlock,
  type ReadOnlyProofBlock,
  type SalesMotion,
  type SourceReadinessBlock,
  type SourceScanBlock,
  type TimingActionabilityBlock,
  type TimingThresholdsHours,
  type UniversalSurface,
} from './types.js';
