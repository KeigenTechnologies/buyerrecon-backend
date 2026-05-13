/**
 * Sprint 2 PR#11b — POI Core Input Observer — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import. The runner
 * accepts an already-constructed pg client.
 */

export {
  classifyAdapterError,
  describeValue,
  mapSessionBehaviouralFeaturesRow,
  mapSessionFeaturesRow,
  mapStage0Row,
  type MapRowCommon,
  type MapperOutcome,
  type Stage0MapOutcome,
} from './mapper.js';

export {
  aggregateReport,
  parseDatabaseUrl,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
} from './report.js';

export {
  makeStubClient,
  processRowForTest,
  runPoiCoreInputObserver,
  type RunObserverArgs,
  type StubClient,
  type StubQueryFn,
} from './runner.js';

export {
  SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL,
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
} from './sql.js';

export {
  REJECT_REASONS,
  type ObserverReport,
  type ObserverRowResult,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type RejectReason,
  type SessionBehaviouralFeaturesRowRaw,
  type SessionFeaturesRowRaw,
  type Stage0RowRaw,
} from './types.js';
