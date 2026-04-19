import 'dotenv/config';
import { exportReplay } from '../src/replay/export.js';
import pool from '../src/db/client.js';

const args = process.argv.slice(2);
const siteIdx = args.indexOf('--site');
const startIdx = args.indexOf('--start');
const endIdx = args.indexOf('--end');
const outIdx = args.indexOf('--output');

const site = siteIdx >= 0 ? args[siteIdx + 1] : '';
const start = startIdx >= 0 ? args[startIdx + 1] : '';
const end = endIdx >= 0 ? args[endIdx + 1] : '';
const output = outIdx >= 0 ? args[outIdx + 1] : './replays';

if (!site || !start || !end) {
  console.error('Usage: --site <site_id> --start YYYY-MM-DD --end YYYY-MM-DD [--output dir]');
  process.exit(1);
}

(async () => {
  const result = await exportReplay(site, start, end, output);
  console.log(`Events: ${result.eventsPath}`);
  console.log(`Meta: ${result.metaPath}`);
  await pool.end();
})();
