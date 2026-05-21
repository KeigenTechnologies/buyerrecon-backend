/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer (refresh) — public re-exports.
 *
 * Pure module. No DB on import. No process side effects.
 */

export {
  buildSessionCandidate,
  buildTimingBandDistribution,
  classifyTimingBand,
  computeConfidenceCap,
  countSyntheticFixtureRows,
  groupAcceptedEventsBySession,
  isSyntheticFixtureRow,
  isSyntheticFixtureTokenLabel,
  SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX,
  SYNTHETIC_FIXTURE_SITE_ID,
  SYNTHETIC_FIXTURE_TOKEN_LABELS,
  SYNTHETIC_FIXTURE_WORKSPACE_ID,
  truncateSessionId,
  type AcceptedGroupedSession,
  type AcceptedGroupResult,
  type CandidateBuildContext,
  type ConfidenceInputs,
  type RawAcceptedEventRow,
  type RawIngestRequestRow,
  type RawRejectedEventRow,
  type SyntheticFixtureRowProbe,
} from './mapper.js';

export {
  parseDatabaseUrl,
  renderMarkdown,
} from './report.js';

export {
  COUNT_POI_OBSERVATIONS_SQL,
  COUNT_POI_SEQUENCE_OBSERVATIONS_SQL,
  COUNT_RISK_OBSERVATIONS_SQL,
  COUNT_SCORING_OUTPUT_LANE_A_SQL,
  COUNT_SCORING_OUTPUT_LANE_B_SQL,
  COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL,
  COUNT_SESSION_FEATURES_SQL,
  SELECT_ACCEPTED_EVENTS_SQL,
  SELECT_INGEST_REQUESTS_SQL,
  SELECT_REJECTED_EVENTS_SQL,
  SELECT_SYNTHETIC_FIXTURE_TOKEN_LABELS_SQL,
  SELECT_TABLE_PRESENT_TO_REGCLASS_SQL,
} from './query.js';

export {
  runTimingProductContextObserver,
  type RunObserverArgs,
} from './runner.js';

export {
  AMS_RESERVED_NAMES_FORBIDDEN,
  AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN,
  ANOMALY_KINDS_ALLOWED,
  CONFIDENCE_CAP_POLICY_VERSION,
  CONFIDENCE_CAPS_ALLOWED,
  CONFIDENCE_REASONS_ALLOWED,
  emptyTimingBandDistribution,
  EXCLUSION_FLAGS_ALLOWED,
  FINAL_STATUSES_ALLOWED,
  OBSERVER_VERSION,
  PASS_FORWARD_CONTRACT_VERSION,
  PRODUCT_CONTEXT_CANDIDATES_ALLOWED,
  REPORT_VERSION,
  SYNTHETIC_EXCLUSION_RULE_VERSION,
  TIMING_BAND_THRESHOLDS_HOURS,
  TIMING_BAND_THRESHOLDS_VERSION,
  TIMING_BANDS_ALLOWED,
  type Anomaly,
  type AnomalyKind,
  type ConfidenceCap,
  type ConfidenceReason,
  type ExclusionFlag,
  type FinalStatus,
  type ObserverRunOptions,
  type ProductContextCandidate,
  type ProductContextSessionCandidate,
  type SourceCounts,
  type SourceTablesPresent,
  type SyntheticControlExclusion,
  type TimingBand,
  type TimingBandDistribution,
  type TimingProductContextObservationReport,
} from './types.js';
