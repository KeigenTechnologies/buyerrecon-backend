import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function initDb(): Promise<void> {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}

// Sprint 2 PR#17k — production-safe skip for runtime schema bootstrap.
//
// Returns true only when SKIP_DB_INIT is the exact literal string "true".
// Strict equality (not broad truthiness) is intentional: it prevents
// "false", "FALSE", "0", "" or any other accidental value from disabling
// schema bootstrap. The skip path lets production deployments avoid
// running schema.sql DDL through a least-privilege runtime role
// (e.g. buyerrecon_prod_collector_app) when the production schema
// lifecycle is operator-managed (PR#17f baseline + migrations 002–016
// per PR#17h proof). See docs/sprint2-pr17k-initdb-startup-compatibility.md.
export function shouldSkipDbInit(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.SKIP_DB_INIT === 'true';
}

export default pool;
