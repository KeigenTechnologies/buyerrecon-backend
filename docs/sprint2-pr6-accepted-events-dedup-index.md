# Sprint 1 PR#6 — `accepted_events` cross-request dedupe unique index

> **Hard-rule disclaimer.** This PR is Track B (BuyerRecon Evidence Foundation)
> only. It is NOT Track A (AMS Behaviour QA scoring harness) and NOT Core AMS
> (the future productized scoring/report home). PR#6 introduces no bot
> detection, no AI-agent detection, no risk scoring, no classification, no
> recommended-action surface, no behavioural-quality scoring, and no Track A
> imports. It adds one Postgres unique index and the read-only preflight SQL
> + tests + docs that go with it. Nothing else.

## 1. Three-part architecture rule

Track B records evidence. Track A experiments with scoring. Core AMS later
productizes mature scoring/report modules.

PR#6 lives entirely on the Track B evidence-ledger side. It enforces uniqueness
on a row already written by the (future) Track B collector, so duplicates
cannot pollute the evidence ledger. It does not introduce any scoring surface
and does not import Track A or Core AMS.

## 2. Why PR#6 exists

PR#5b-2 / PR#5c-2 (the Track B v1 collector orchestrator) implement
**intra-batch dedupe only**:
`src/collector/v1/dedupe.ts` walks the events in a single request body, keys
each event by `(workspace_id, site_id, client_event_id)`, and rejects every
event after the first as `duplicate_client_event_id`.

What that does **not** cover:

- The same SDK retries the same event in a **second HTTP request**.
- The orchestrator runs once per request and starts with an empty `Map`.
- Without a database constraint, both requests will write an `accepted_events`
  row with the same `(workspace_id, site_id, client_event_id)` tuple.

PR#6 closes that gap at the database boundary.

## 3. Intra-batch dedupe vs cross-request DB dedupe

| Concern | PR#5b-2 / PR#5c-2 (intra-batch) | PR#6 (cross-request, this PR) |
|---|---|---|
| Where it runs | App-layer, inside one `runRequest` call | Postgres, on every INSERT |
| Scope | Events that travel together in one HTTP body | Events in any pair of HTTP requests, ever |
| Mechanism | In-memory `Map` keyed on the triple | Partial UNIQUE INDEX on the same triple |
| Failure surface | `RejectedEventRow` with `reason_code='duplicate_client_event_id'` | `INSERT` raises Postgres SQLSTATE `23505` — PR#7 maps that to the same reason code |
| PR#5b-2/PR#5c-2 dependency | Already shipped (closed) | Adds the DB-side enforcement under it |

## 4. The index

```
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS accepted_events_dedup
  ON accepted_events (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL;
```

- **Name:** `accepted_events_dedup`
- **Table:** `accepted_events`
- **Columns (order):** `(workspace_id, site_id, client_event_id)`
- **Uniqueness:** UNIQUE
- **Build mode:** `CONCURRENTLY`
- **Idempotent:** `IF NOT EXISTS`
- **Partial WHERE:** all three columns `IS NOT NULL`

## 5. Why a partial unique index

- `workspace_id` and `client_event_id` are still **NULLABLE** on
  `accepted_events` per the §3.PR#2 deferral (NOT NULL promotion lands after
  collector backfill in §3.PR#5+).
- The orchestrator's intra-batch dedupe skips dedupe entirely when
  `client_event_id` is missing / null / empty
  (`src/collector/v1/dedupe.ts:57-58`). The partial WHERE matches that gate
  exactly.
- The partial WHERE excludes **all legacy pre-PR#5 rows** (their
  `workspace_id` is NULL) so they cannot collide with v1 collector writes
  and do not bloat the index.
- The legacy partial unique index
  `idx_accepted_dedup_client_event` on `(site_id, session_id, client_event_id)`
  uses the same partial-index pattern; PR#6 is consistent with it.

## 6. Why `CREATE INDEX CONCURRENTLY`

`CREATE INDEX` (non-concurrent) takes an `ACCESS EXCLUSIVE` lock on the table
for the duration of the build. On a live `accepted_events` table that would
block all inserts (the entire collector write path) for as long as the index
takes to build.

`CONCURRENTLY` builds the index without blocking writes. It pays for that with
extra bookkeeping and a slightly slower build, which is acceptable because
this index is built once per environment.

## 7. Why a unique index only — not an attached named constraint

Attaching the index as a named constraint requires
`ALTER TABLE accepted_events ADD CONSTRAINT accepted_events_dedup UNIQUE USING INDEX accepted_events_dedup;`
which takes `ACCESS EXCLUSIVE` to attach — that re-introduces exactly the
write-blocking lock we used `CONCURRENTLY` to avoid.

PostgreSQL enforces uniqueness identically whether the constraint is named
via `pg_constraint` or whether the unique index alone enforces it. The only
externally visible difference is whether the name appears in
`information_schema.table_constraints`. The collector raises the same
SQLSTATE `23505` either way.

Track B's existing legacy `idx_accepted_dedup_client_event` is also
unique-index-only, so PR#6 is consistent with the repo precedent.

## 8. Duplicate preflight runbook

Before applying the migration:

```bash
psql "$DATABASE_URL" -f docs/sql/preflight/007_accepted_events_dedup_duplicates.sql
```

**Expected:** zero rows.

If the preflight returns rows, **STOP**. Do **not** apply the migration.
Triage manually. PR#6 is intentionally **detection-only** — it does not
auto-delete duplicate rows. Track B is the evidence ledger; silent deletion
of `accepted_events` rows by an automated migration violates the
evidence-preservation invariant. Remediation is a deliberate operator
decision, not part of this PR.

Why no auto-delete:

1. `accepted_events` rows are evidence. They must not be discarded without
   explicit operator awareness.
2. A failed CREATE INDEX CONCURRENTLY leaves the index in `INVALID` state.
   Automatic remediation that ran "delete then build" inside a migration
   would be unrecoverable on rollback.
3. With PR#5 collector not yet wired to routes, preflight is expected to
   return zero rows on first application — auto-delete would be solving a
   problem that does not exist.

## 9. Applying the migration

```bash
psql "$DATABASE_URL" -f migrations/007_accepted_events_dedup_index.sql
```

Notes:

- Apply via **standalone `psql -f`**. Do **not** route this through
  `initDb()` / `src/db/schema.sql`. That path runs the file as a
  multi-statement `pool.query`, which Postgres treats as an implicit
  transaction block. `CREATE INDEX CONCURRENTLY` is rejected inside a
  transaction block (`CREATE INDEX CONCURRENTLY cannot run inside a
  transaction block`).
- Do **not** wrap the file in `BEGIN; … COMMIT;`. The migration is one DDL
  statement plus comments.
- Schedule during a **low-traffic window**. `CONCURRENTLY` is online but a
  long-running build can interact with vacuum / replica lag on
  production-sized tables.
- Verify after apply:
  ```sql
  SELECT indexname, indexdef
  FROM   pg_indexes
  WHERE  schemaname = 'public'
    AND  indexname = 'accepted_events_dedup';
  -- and
  SELECT indexrelid::regclass, indisvalid
  FROM   pg_index
  WHERE  indexrelid = 'public.accepted_events_dedup'::regclass;
  ```
  `indisvalid` must be `true`. If it is `false`, the build failed midway —
  run the rollback below and re-apply.

## 10. Rollback runbook

```bash
psql "$DATABASE_URL" -c "DROP INDEX CONCURRENTLY IF EXISTS accepted_events_dedup;"
```

Notes:

- Like the forward migration, the `DROP` must also run **outside a
  transaction block**.
- Rollback is safe in every state: if the index never existed, `IF EXISTS`
  no-ops. If the index is `INVALID` (failed build), the drop succeeds and
  clears the slot so a re-apply can proceed.
- **No app-code rollback is required.** PR#6 changes no application code.
  After rollback, the orchestrator's intra-batch dedupe still works; only
  cross-request retries lose DB-side guarding.
- The legacy `idx_accepted_dedup_client_event` partial unique index is
  **not touched** by this rollback.

## 11. Operational warning

**Do not run this migration on production without:**

1. Running the duplicate preflight first and confirming zero rows.
2. A scheduled migration window.
3. Confirmation that the migration is being applied via standalone
   `psql -f`, not folded into `schema.sql` / `initDb()`.

The preflight + the standalone-application rule are operator obligations.
This PR cannot enforce them in code.

## 12. Why `src/db/schema.sql` is not modified

`src/db/schema.sql` is loaded by `src/db/client.ts:11-15` `initDb()` and
applied as a single multi-statement `pool.query(schema)`. Postgres rejects
`CREATE INDEX CONCURRENTLY` inside a multi-statement / implicit-transaction
batch. Therefore the index cannot be added to `schema.sql` without breaking
boot.

The repo's existing convention is the same — migrations 003–006 are applied
via psql out-of-band, not through `schema.sql`. PR#6 follows that convention.

When PR#7 lands and the v1 collector is wired live, a future hardening PR
may rebuild `schema.sql` from migrations for fresh-env bootstrap; that
rebuild path will need to omit `CONCURRENTLY` (acceptable for an empty
table during initial setup) or use a separate post-init script. Either way,
that work is **not** PR#6.

## 13. Relationship to PR#7

PR#7 introduces the first real `INSERT INTO accepted_events` behind the
orchestrator's `OrchestratorOutput` shape.

- **Why PR#7 needs PR#6:** without the unique index, two HTTP requests
  carrying the same `(workspace_id, site_id, client_event_id)` from an SDK
  retry would land two accepted rows. PR#5c-2's intra-batch dedupe cannot
  see across requests.
- **What PR#7 must add:** the insert path must catch Postgres SQLSTATE
  `23505` (`unique_violation`) on the `accepted_events_dedup` constraint
  name (or, equivalently, on the
  `(workspace_id, site_id, client_event_id)` index) and map it to a
  `rejected_events` row with
  `reason_code = 'duplicate_client_event_id'` (per handoff §2.9 R-7 and
  §2.12 check #3). The reason code already exists in the orchestrator's
  enum (`src/collector/v1/dedupe.ts:27`); PR#7 must reuse it for the
  cross-request path.
- **Two reasonable insert shapes** (PR#7 will choose):
  1. `INSERT … ON CONFLICT … DO NOTHING RETURNING …` — branch on
     `RETURNING` row count to detect the conflict, then write the rejected
     row.
  2. Plain `INSERT` inside a `try/catch`, branch on `err.code === '23505'`
     and `err.constraint === 'accepted_events_dedup'`, then write the
     rejected row.
- **Do not pre-empt PR#7 in this PR.** No insert logic, no error mapping,
  no route binding lives here.

## 14. PR#7 must handle `23505` / `accepted_events_dedup` conflict carefully

When PR#7 maps the conflict, it must:

- Match on the specific index name `accepted_events_dedup` (and/or
  SQLSTATE `23505`). Do **not** swallow every `23505` — the legacy
  `idx_accepted_dedup_client_event` partial unique index on
  `(site_id, session_id, client_event_id)` is still in place and raises the
  same SQLSTATE; PR#7 should treat both as `duplicate_client_event_id`
  rejections, but it must distinguish them from unrelated unique violations
  (none currently expected on the v1 write path).
- Reconcile `ingest_requests.accepted_count` and `rejected_count` correctly:
  a conflict means the event flips from accepted → rejected, so PR#7's
  reconciliation logic must count the row exactly once.
- Preserve idempotency: a second retry must return HTTP 200 with the same
  rejection reason code, not a 5xx.

These are PR#7 obligations. PR#6 only creates the index they hang off.

## 15. Relationship to PR#8

PR#8 ships the SQL verification suite (§3.PR#8). It is the contractual home
for the real-DB invariants this index supports:

- Handoff §2.12 verification check #3 — duplicate retry → exactly one
  accepted row.
- Handoff §4.1 acceptance #8 — UNIQUE constraint in place and rejects
  duplicate writes.
- Handoff §2.9 R-7 — `duplicate_client_event_id` reason-code chain.

## 16. PR#8 owns real DB duplicate retry verification

PR#8 verification suite must prove against a real DB session with PR#7
routes live:

- 50 SDK retries of the same `client_event_id` → **exactly one** row in
  `accepted_events` for the triple.
- The other 49 either return `status='accepted'` for the existing row
  (idempotent reuse) or `status='rejected'` with
  `reason_code='duplicate_client_event_id'` (per §2.9 R-7).
- `accepted_count + rejected_count` reconciles against `ingest_requests`
  row counts.
- `pg_index.indisvalid` is `true` for `accepted_events_dedup`.
- Rows actually persisted in DB match `OrchestratorOutput.accepted_event_rows`
  and `OrchestratorOutput.rejected_event_rows`.

PR#6 contains no real-DB tests because:

- The vitest suite is pure-function with no DB harness.
- PR#7 routes are not yet wired, so a real-DB concurrent-load test cannot be
  driven end-to-end from this PR.
- The PR#8 verification suite is the contractual home for these invariants.

## 17. What PR#6 does NOT do

- No HTTP routes.
- No `INSERT` / `INSERT … ON CONFLICT` implementation.
- No env loader.
- No token lookup.
- No changes to `src/collector/v1/orchestrator.ts`.
- No changes to `src/collector/v1/row-builders.ts`.
- No changes to `src/collector/v1/index.ts` barrel.
- No changes to `src/collector/v1/dedupe.ts` (or any PR#5 helper module).
- No changes to `src/auth/workspace.ts`.
- No changes to `src/server.ts`, `src/collector/routes.ts`, `src/db/client.ts`,
  `src/db/schema.sql`.
- No changes to `.env.example`.
- No changes to migrations 002–006.
- No Track A imports.
- No Core AMS imports.
- No bot / AI-agent / risk-score / classification / recommended-action
  surface.
- No production migration execution.
- No deployment.
- No auto-delete of duplicate rows.
- No real-DB concurrent-load test (lives in PR#8).
- No PR#7 conflict-handling implementation.

## 18. Tests run

- `npx tsc --noEmit` — PASS (no TypeScript changes in this PR).
- `npm test` — all prior tests still pass; new
  `tests/accepted-events-pr6-dedup-index.test.ts` adds file/text-level
  assertions covering migration shape, preflight read-only contract, scope
  discipline, and barrel pinning.

## 19. Codex review checklist

1. ✅ Exactly one new migration file: `migrations/007_accepted_events_dedup_index.sql`.
2. ✅ Exactly one active `CREATE` statement in the migration; it is
   `CREATE UNIQUE INDEX CONCURRENTLY`.
3. ✅ Index name is exactly `accepted_events_dedup`.
4. ✅ Target table is `accepted_events`.
5. ✅ Column order is exactly `(workspace_id, site_id, client_event_id)`.
6. ✅ `IF NOT EXISTS` present.
7. ✅ Partial WHERE present, gates all three columns as `IS NOT NULL`.
8. ✅ No active `BEGIN` / `COMMIT` / `ROLLBACK` / `START TRANSACTION` in the
   migration file.
9. ✅ No active `DELETE` / `UPDATE` / `INSERT` / `ALTER TABLE` / `TRUNCATE` /
   `DROP` in the migration file (rollback `DROP` appears only in line
   comments).
10. ✅ Rollback SQL `DROP INDEX CONCURRENTLY IF EXISTS accepted_events_dedup`
    is present in the migration's commented footer.
11. ✅ Preflight SQL exists at
    `docs/sql/preflight/007_accepted_events_dedup_duplicates.sql`, groups on
    `(workspace_id, site_id, client_event_id)`, has `HAVING COUNT(*) > 1`,
    is read-only (no `DELETE` / `UPDATE` / `INSERT` / `TRUNCATE` / `ALTER` /
    `DROP` / `CREATE`).
12. ✅ PR doc exists at
    `docs/sprint2-pr6-accepted-events-dedup-index.md` and covers
    runbook, PR#7 dependency, PR#8 deferral, operational warning.
13. ✅ No diff in `src/collector/v1/orchestrator.ts`,
    `src/collector/v1/row-builders.ts`, `src/collector/v1/index.ts`,
    `src/collector/v1/dedupe.ts`, any other `src/collector/v1/*.ts`,
    `src/auth/workspace.ts`, `src/server.ts`, `src/collector/routes.ts`,
    `src/db/client.ts`, `src/db/schema.sql`, `.env.example`, or migrations
    002–006.
14. ✅ Barrel `src/collector/v1/index.ts` still has exactly 4 `export *`
    re-export lines (PR#5a discipline preserved).
15. ✅ No Track A imports (`ams-qa-behaviour-tests`), no Core AMS imports
    (`/github/keigentechnologies/ams`) in any new file.
16. ✅ No scoring / bot / AI-agent / `risk_score` / `classification` /
    `recommended_action` / `agent_score` strings in active SQL of any new
    file.
17. ✅ `schema.sql` does not carry `accepted_events_dedup`.
18. ✅ Legacy `idx_accepted_dedup_client_event` partial unique index is
    untouched and still present in `schema.sql`.
19. ✅ `npx tsc --noEmit` passes.
20. ✅ `npm test` passes (761 prior + new PR#6 tests).
21. ✅ No live DB migration was executed. No commit. No push. No deploy.
