/**
 * Sprint 2 PR#15a — Evidence Review Snapshot — read-only SQL.
 *
 * Every query is SELECT-only. No INSERT, UPDATE, DELETE, or DDL.
 * Each per-table count query is wrapped by the runner in a
 * try/catch that falls back to "row_count: null, note: ..." if
 * the table is missing or its columns don't match the expected
 * shape. Missing tables NEVER crash the observer.
 *
 * Table-existence is checked via `to_regclass($1)` which returns
 * NULL when the table is absent. The check is parameterised so a
 * malformed table name can never appear as a SQL injection vector
 * (and the names below are static constants anyway).
 */

/**
 * Catalogue of every table the snapshot inspects. Each entry
 * carries its own time column so window-filtered counts use the
 * right index.
 */
export interface TableSpec {
  readonly name:    string;
  readonly timeCol: string;
}

export const SNAPSHOT_TABLES: readonly TableSpec[] = Object.freeze([
  { name: 'accepted_events',                   timeCol: 'received_at'  },
  { name: 'rejected_events',                   timeCol: 'received_at'  },
  { name: 'ingest_requests',                   timeCol: 'received_at'  },
  { name: 'session_features',                  timeCol: 'last_seen_at' },
  { name: 'session_behavioural_features_v0_2', timeCol: 'extracted_at' },
  { name: 'stage0_decisions',                  timeCol: 'created_at'   },
  { name: 'risk_observations_v0_1',            timeCol: 'created_at'   },
  { name: 'poi_observations_v0_1',             timeCol: 'created_at'   },
  { name: 'poi_sequence_observations_v0_1',    timeCol: 'created_at'   },
]);

/** `to_regclass` returns NULL when the table is absent — no exception. */
export const SQL_TABLE_EXISTS = `SELECT to_regclass($1) IS NOT NULL AS exists`;

/**
 * Build the workspace/site/window-filtered count SQL for a table.
 *
 * Why a builder, not a constant: each table has its own
 * `timeCol`. We inline both the table name AND the timeCol from
 * the static SNAPSHOT_TABLES catalogue above. Neither comes from
 * user input — so the string-interpolation is safe — but we still
 * guard against unexpected callers by validating the name with
 * `SAFE_IDENT_RE` before interpolation.
 *
 * Workspace_id is filtered with `=`; on tables where the column
 * is nullable, NULL rows are excluded (correct: only count rows
 * tagged with this workspace). Site_id is filtered with `=` on
 * all tables. Time is filtered with `>= $3 AND < $4`.
 */
const SAFE_IDENT_RE = /^[a-z_][a-z0-9_]*$/;

export function buildCountSql(table: TableSpec): string {
  if (!SAFE_IDENT_RE.test(table.name)) {
    throw new Error(`unsafe table name: ${JSON.stringify(table.name)}`);
  }
  if (!SAFE_IDENT_RE.test(table.timeCol)) {
    throw new Error(`unsafe time column: ${JSON.stringify(table.timeCol)}`);
  }
  return `
    SELECT COUNT(*)::bigint AS n
    FROM ${table.name}
    WHERE workspace_id = $1
      AND site_id      = $2
      AND ${table.timeCol} >= $3
      AND ${table.timeCol} <  $4
  `;
}

/**
 * Stage-0 exclusion count — Lane-A-candidate input.
 *
 * `stage0_decisions.excluded BOOLEAN` is the canonical
 * exclusion flag. The count is restricted to the window.
 */
export const SQL_STAGE0_EXCLUDED_COUNT = `
  SELECT COUNT(*)::bigint AS n
  FROM stage0_decisions
  WHERE workspace_id = $1
    AND site_id      = $2
    AND created_at  >= $3
    AND created_at   < $4
    AND excluded     IS TRUE
`;

/**
 * Stage-0 eligible (NOT excluded) count — Lane-B-internal input.
 */
export const SQL_STAGE0_ELIGIBLE_COUNT = `
  SELECT COUNT(*)::bigint AS n
  FROM stage0_decisions
  WHERE workspace_id = $1
    AND site_id      = $2
    AND created_at  >= $3
    AND created_at   < $4
    AND excluded     IS FALSE
`;
