import 'dotenv/config';
import { computeMetrics } from '../src/metrics/truth-metrics.js';
import pool from '../src/db/client.js';

const args = process.argv.slice(2);
const dateIdx = args.indexOf('--date');
const rangeIdx = args.indexOf('--range');

(async () => {
  if (dateIdx >= 0) {
    await computeMetrics(args[dateIdx + 1]);
  } else if (rangeIdx >= 0) {
    const start = new Date(args[rangeIdx + 1]);
    const end = new Date(args[rangeIdx + 2]);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      await computeMetrics(d.toISOString().split('T')[0]);
    }
  } else {
    await computeMetrics(new Date().toISOString().split('T')[0]);
  }
  await pool.end();
})();
