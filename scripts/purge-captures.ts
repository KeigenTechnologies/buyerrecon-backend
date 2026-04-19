import 'dotenv/config';
import pool from '../src/db/client.js';

(async () => {
  const result = await pool.query(`DELETE FROM probe_captures WHERE purge_after < NOW()`);
  console.log(`Purged ${result.rowCount} expired captures`);
  await pool.end();
})();
