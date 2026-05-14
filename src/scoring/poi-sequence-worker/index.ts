/**
 * Sprint 2 PR#12d — POI Sequence Worker — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import. The runner
 * accepts an already-constructed pg client.
 */

export {
  aggregateReport,
  makeStubClient,
  parseDatabaseUrl,
  parsePoiSequenceWorkerEnvOptions,
  runPoiSequenceWorker,
  truncateSessionId,
  type AggregateInputs,
  type RunWorkerArgs,
  type StubClient,
  type StubQueryFn,
  type WorkerEnvOpts,
} from './worker.js';

export {
  buildDurableSequenceRecord,
  buildSequenceRecord,
  groupRowsBySession,
  type DurableSequenceRow,
  type GroupedRows,
  type MapperOutcome,
} from './mapper.js';

export {
  buildUpsertParams,
} from './upsert.js';

export {
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL,
  UPSERT_POI_SEQUENCE_OBSERVATION_SQL,
} from './query.js';

export {
  POI_OBSERVATIONS_TABLE_VERSION_DEFAULT,
  POI_SEQUENCE_VERSION,
  REJECT_REASONS,
  type PoiObservationRowRaw,
  type PoiObservationsTableVersion,
  type PoiSequencePatternClass,
  type RejectReason,
  type UpsertAction,
  type WorkerReport,
  type WorkerRowResult,
  type WorkerRowRejected,
  type WorkerRowUpserted,
  type WorkerRunMetadata,
  type WorkerRunOptions,
} from './types.js';
