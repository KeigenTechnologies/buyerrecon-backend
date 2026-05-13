/**
 * Sprint 2 PR#11c — POI Core Worker — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import. The worker
 * accepts an already-constructed pg client.
 */

export {
  classifyAdapterError,
  describeValue,
  mapSessionFeaturesRowToArgs,
  mapStage0Row,
  pickPagePathCandidate,
  type MapRowCommon,
  type MapperOutcome,
  type Stage0MapOutcome,
} from './mapper.js';

export {
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
  UPSERT_POI_OBSERVATION_SQL,
} from './query.js';

export {
  buildUpsertParams,
  type BuildUpsertParamsArgs,
} from './upsert.js';

export {
  aggregateReport,
  makeStubClient,
  parseDatabaseUrl,
  parsePoiCoreWorkerEnvOptions,
  processRowForTest,
  runPoiCoreWorker,
  truncateSessionId,
  type AggregateInputs,
  type RunWorkerArgs,
  type StubClient,
  type StubQueryFn,
  type WorkerEnvOpts,
} from './worker.js';

export {
  POI_KEY_SOURCE_FIELDS_ALLOWED,
  POI_OBSERVATION_VERSION_DEFAULT,
  REJECT_REASONS,
  type PoiKeySourceField,
  type PoiObservationVersion,
  type RejectReason,
  type SessionFeaturesRowRaw,
  type Stage0RowRaw,
  type UpsertAction,
  type WorkerReport,
  type WorkerRowResult,
  type WorkerRunMetadata,
  type WorkerRunOptions,
} from './types.js';
