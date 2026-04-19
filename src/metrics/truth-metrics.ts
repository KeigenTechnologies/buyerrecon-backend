import pool from '../db/client.js';
import { VALID_SITE_IDS, METRICS_VERSION } from '../constants.js';

export async function computeMetrics(date: string) {
  for (const siteId of VALID_SITE_IDS) {
    const accepted = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(DISTINCT session_id) as sessions,
              COUNT(DISTINCT browser_id) as subjects
       FROM accepted_events
       WHERE site_id = $1 AND received_at::date = $2::date`,
      [siteId, date],
    );

    const eventTypes = await pool.query(
      `SELECT event_type, COUNT(*) as count
       FROM accepted_events
       WHERE site_id = $1 AND received_at::date = $2::date
       GROUP BY event_type`,
      [siteId, date],
    );

    const rejected = await pool.query(
      `SELECT COUNT(*) as total FROM rejected_events
       WHERE site_id = $1 AND received_at::date = $2::date`,
      [siteId, date],
    );

    const rejectReasons = await pool.query(
      `SELECT unnest(reason_codes) as reason, COUNT(*) as count
       FROM rejected_events
       WHERE site_id = $1 AND received_at::date = $2::date
       GROUP BY reason ORDER BY count DESC`,
      [siteId, date],
    );

    const mismatch = await pool.query(
      `SELECT COUNT(*) as count FROM (
         SELECT session_id,
                bool_or(event_type = 'session_start') as has_start,
                bool_or(event_type = 'session_summary') as has_summary
         FROM accepted_events
         WHERE site_id = $1 AND received_at::date = $2::date
         GROUP BY session_id
         HAVING bool_or(event_type = 'session_start') != bool_or(event_type = 'session_summary')
       ) sub`,
      [siteId, date],
    );

    const unknownBuckets = await pool.query(
      `SELECT COUNT(*) as count FROM rejected_events
       WHERE site_id = $1 AND received_at::date = $2::date
       AND 'UNKNOWN_BUCKET_VALUE' = ANY(reason_codes)`,
      [siteId, date],
    );

    const acceptedCount = parseInt(accepted.rows[0]?.total ?? '0', 10);
    const rejectedCount = parseInt(rejected.rows[0]?.total ?? '0', 10);
    const total = acceptedCount + rejectedCount;

    const typeCountsObj: Record<string, number> = {};
    for (const r of eventTypes.rows) typeCountsObj[r.event_type] = parseInt(r.count, 10);

    const reasonCountsObj: Record<string, number> = {};
    for (const r of rejectReasons.rows) reasonCountsObj[r.reason] = parseInt(r.count, 10);

    await pool.query(
      `INSERT INTO truth_metrics
       (site_id, metric_date, metrics_version, events_received, events_accepted, events_rejected,
        reject_rate, distinct_sessions, distinct_subjects, event_type_counts, reject_reason_counts,
        summary_start_mismatch, unknown_bucket_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (site_id, metric_date, metrics_version) DO UPDATE
       SET events_received=$4, events_accepted=$5, events_rejected=$6, reject_rate=$7,
           distinct_sessions=$8, distinct_subjects=$9, event_type_counts=$10, reject_reason_counts=$11,
           summary_start_mismatch=$12, unknown_bucket_count=$13, computed_at=NOW()`,
      [
        siteId, date, METRICS_VERSION, total, acceptedCount, rejectedCount,
        total > 0 ? rejectedCount / total : 0,
        parseInt(accepted.rows[0]?.sessions ?? '0', 10),
        parseInt(accepted.rows[0]?.subjects ?? '0', 10),
        JSON.stringify(typeCountsObj), JSON.stringify(reasonCountsObj),
        parseInt(mismatch.rows[0]?.count ?? '0', 10),
        parseInt(unknownBuckets.rows[0]?.count ?? '0', 10),
      ],
    );

    console.log(`${siteId} ${date}: accepted=${acceptedCount} rejected=${rejectedCount}`);
  }
}
