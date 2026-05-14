/**
 * Sprint 2 PR#12b — POI Sequence Observer — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import. The runner
 * accepts an already-constructed pg client.
 */

export {
  aggregateReport,
  parseDatabaseUrl,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
  type AnomalySampleId,
} from './report.js';

export {
  buildSequenceRecord,
  classifyPattern,
  groupRowsBySession,
  hasForbiddenKeyRecursive,
  isValidEvidenceRefs,
  isValidSourceVersions,
  type GroupedRows,
} from './mapper.js';

export {
  makeStubClient,
  runPoiSequenceObserver,
  type RunObserverArgs,
  type StubClient,
  type StubQueryFn,
} from './runner.js';

export {
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL,
  SELECT_TABLE_PRESENT_SQL,
} from './query.js';

export {
  ALLOWED_EVIDENCE_REF_SOURCE_TABLES,
  ALLOWED_POI_SOURCE_TABLES,
  ANOMALY_KINDS,
  FORBIDDEN_REF_KEYS,
  POI_SEQUENCE_PATTERN_CLASS,
  POI_SEQUENCE_PATTERN_CLASSES_ALLOWED,
  POI_SEQUENCE_VERSION,
  type AnomalyKind,
  type BooleanDistribution,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type PoiObservationRowRaw,
  type PoiSequenceObserverReport,
  type PoiSequencePatternClass,
  type PoiSequenceRecord,
  type PoiSequenceVersion,
} from './types.js';
