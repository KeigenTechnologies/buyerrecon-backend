import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function initDb(): Promise<void> {
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}

export default pool;
