/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — public re-exports.
 *
 * No DB. No HTTP. No process side effects on import. The runner
 * accepts an already-constructed pg client.
 */

export {
  classifyAdapterError,
  extractStage0Pointers,
  isPlausibleUuid,
  mapRiskObservationRow,
  mapStage0Row,
  validateEvidenceRefsShape,
  type EvidenceRefsShapeResult,
  type Stage0PointerResult,
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
  runRiskCoreBridgeObserver,
  type RunObserverArgs,
  type StubClient,
  type StubQueryFn,
} from './runner.js';

export {
  SELECT_RISK_OBSERVATIONS_SQL,
  SELECT_STAGE0_BY_DECISION_ID_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
} from './sql.js';

export {
  REJECT_REASONS,
  type EvidenceRef,
  type MapperOutcome,
  type ObserverReport,
  type ObserverRowResult,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type RejectReason,
  type RiskObservationRowRaw,
  type Stage0RowRaw,
} from './types.js';
