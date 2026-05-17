/**
 * Sprint 2 PR#15a — Evidence Review Snapshot Observer — public re-exports.
 *
 * Read-only. No DB writes. No customer-facing automated scoring.
 */

export {
  parseDatabaseUrl,
  runEvidenceReviewSnapshot,
  type PgQueryable,
  type RunSnapshotArgs,
} from './runner.js';

export {
  renderEvidenceReviewSnapshotMarkdown,
} from './report.js';

export {
  EMAIL_SHAPE_RE,
  FORBIDDEN_FIELD_NAMES,
  stripQueryString,
  truncateSessionId,
  URL_WITH_QUERY_STRING_RE,
} from './sanitize.js';

export {
  buildCountSql,
  SNAPSHOT_TABLES,
  SQL_STAGE0_ELIGIBLE_COUNT,
  SQL_STAGE0_EXCLUDED_COUNT,
  SQL_TABLE_EXISTS,
  type TableSpec,
} from './sql.js';

export {
  SNAPSHOT_OBSERVER_VERSION,
  type EvidenceChainSummary,
  type EvidenceGaps,
  type EvidenceReviewSnapshotReport,
  type FounderNotesPrompt,
  type LaneACandidates,
  type LaneBInternal,
  type ReadinessAssessment,
  type ReadinessBucket,
  type SnapshotBoundary,
  type SnapshotRunOptions,
  type SourceAvailabilityBlock,
  type TableAvailability,
} from './types.js';
