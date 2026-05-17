/**
 * Sprint 2 PR#16b — Lane A / Lane B Evidence Review preview observer
 * — public re-exports.
 *
 * Read-only. No DB writes. No durable Lane-A / Lane-B writer.
 * No customer-facing automated scoring. No AMS runtime bridge.
 */

export {
  buildLaneABPreview,
} from './preview.js';

export {
  renderLaneABPreviewMarkdown,
} from './report.js';

export {
  LANE_AB_PREVIEW_VERSION,
  type CustomerWordingRails,
  type InternalOnlyRails,
  type LaneABPreviewBoundary,
  type LaneABPreviewReport,
  type LaneAObservation,
  type LaneAObservationFamily,
  type LaneAPreview,
  type LaneBObservation,
  type LaneBObservationFamily,
  type LaneBPreview,
  type SourceAvailabilityRow,
  type SourceAvailabilitySummary,
  type TrackAReadinessNote,
} from './types.js';
