export const COLLECTOR_VERSION = process.env.COLLECTOR_VERSION ?? '1.0.0';

export const VALID_SITE_IDS = new Set([
  'buyerrecon_com',
  'keigen_co_uk',
  'fidcern_com',
  'realbuyergrowth_com',
  'timetopoint_com',
]);

export const TTP_SITE_ID = 'timetopoint_com';

export const VALID_EVENT_TYPES = new Set([
  'session_start',
  'page_state',
  'session_summary',
]);

export const VALID_SCHEMA_VERSION = 'thin.v2.0';

export const VALID_DWELL_BUCKETS = new Set([
  '<5s', '5-10s', '10-30s', '30-90s', '90-300s', '>300s',
]);

export const VALID_SCROLL_BUCKETS = new Set([
  '0', '1-25', '26-50', '51-75', '76-100',
]);

export const VALID_INTERACTION_BUCKETS = new Set([
  '0', '1-2', '3-5', '6-10', '>10',
]);

export const METRICS_VERSION = '1.0.0';
