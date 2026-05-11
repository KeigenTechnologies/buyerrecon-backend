# Sprint 1 PR#8 — Real DB verification / reconciliation suite

> **Hard-rule disclaimer.** PR#8 is Track B (BuyerRecon Evidence Foundation)
> only. It is NOT Track A (AMS Behaviour QA scoring harness) and NOT Core AMS
> (the future productized scoring/report home). PR#8 introduces no bot
> detection, no AI-agent detection, no risk scoring, no classification, no
> recommended-action surface, no behavioural-quality scoring, no Track A
> imports, no Core AMS imports, no live site traffic, no Playwright, no
> production DB access. It is opt-in tests + verification SQL + docs.

## 1. Three-part architecture rule

- **Track B** records evidence. PR#8 verifies that the evidence ledger is
  actually correct end-to-end against a real Postgres.
- **Track A** experiments with scoring. PR#8 has zero Track A surface.
- **Core AMS** will later productize mature scoring/report modules. PR#8 has
  zero Core AMS surface.

## 2. What PR#8 ships

| Artifact | Purpose |
|---|---|
| `tests/v1/db/_setup.ts` | Shared opt-in DB test setup: pool, schema, migration 007, test boundary, real Express app factory. |
| `tests/v1/db/index-validity.dbtest.ts` | PR#6 `accepted_events_dedup` is created, unique, valid, partial. |
| `tests/v1/db/route-event.dbtest.ts` | POST /v1/event → real DB rows for valid / invalid / request-level reject / auth-reject paths. |
| `tests/v1/db/route-batch.dbtest.ts` | POST /v1/batch (flag on) for mixed / empty / non-object / oversize paths. |
| `tests/v1/db/reconciliation.dbtest.ts` | §2.12-equivalent reconciliation: `accepted_count + rejected_count = expected_event_count`; row-count joins. |
| `tests/v1/db/hash-invariants.dbtest.ts` | `request_body_sha256 = sha256Hex(raw bytes)`; `payload_sha256 ≠ payloadSha256(canonical_jsonb)`; `canonical_jsonb` has 19 keys; rejected `raw_payload_sha256 = payloadSha256(raw)`; duplicate-reclassified rows hash the raw event, not the accepted payload. |
| `tests/v1/db/duplicate-retry.dbtest.ts` | Sequential 3-retry + 5-retry proof: 1 accepted + N−1 duplicate-rejected, all HTTP 200. |
| `tests/v1/db/cors-preflight.dbtest.ts` | OPTIONS /v1/event and /v1/batch advertise `Authorization` in `Access-Control-Allow-Headers`. (No DB connection needed; ships in the opt-in suite so it can never be silently disabled.) |
| `tests/v1/db/last-used-at.dbtest.ts` | `site_write_tokens.last_used_at` flips from null to non-null within ≤5×100 ms after a successful auth. |
| `docs/sql/verification/{01..05}.sql` | Operator-runnable SQL references mirroring the test assertions. |
| `docs/sprint2-pr8-db-verification.md` | This file — runbook, RECORD_ONLY checklist, follow-ups, Codex checklist. |
| `package.json` | Adds `"test:db:v1": "vitest run --no-file-parallelism tests/v1/db/**/*.dbtest.ts"`. No new dependencies. |
| `.env.example` | Adds `TEST_DATABASE_URL` placeholder with "never production" warning. |

## 3. How to run

```bash
# Default test suite — pure, no DB required.
npm test

# Opt-in DB verification suite — requires a local/staging Postgres.
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/br_collector_test \
  npm run test:db:v1
```

- `npm test` continues to match `tests/**/*.test.ts` only. The `.dbtest.ts`
  extension keeps the DB tests out of the default include glob.
- `npm run test:db:v1` runs **only** the `.dbtest.ts` files, with
  `--no-file-parallelism` so the shared deterministic test boundary
  (`workspace_id = '__test_ws_pr8__'`) never sees overlapping writes from two
  parallel files.
- Missing `TEST_DATABASE_URL` when invoking the DB script → clear failure:
  `Error: PR#8 DB tests require TEST_DATABASE_URL — see docs/sprint2-pr8-db-verification.md`.

## 4. TEST_DATABASE_URL setup — never production

`.env.example` placeholder:

```env
# Sprint 1 PR#8 — DB verification only. Local/staging test DB only.
# NEVER production. Must NOT equal DATABASE_URL.
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/br_collector_test
```

Safety guards in `_setup.ts` `assertNotProduction()`:

1. Refuse if `TEST_DATABASE_URL === DATABASE_URL`.
2. Refuse if the URL contains `prod` (case-insensitive).
3. Allow `localhost` / `127.0.0.1` unconditionally.
4. Allow URLs that contain `test` or `staging` in any case.
5. Require explicit `ALLOW_STAGING_DB=true` for any other URL.

These are conservative best-effort checks. They are **not** airtight — the
operator is the primary safeguard. Production DBs must have their `DATABASE_URL`
clearly named.

## 5. Schema setup behaviour

`_setup.ts` `bootstrapTestDb(pool)` runs once per test file (`beforeAll`):

1. `assertNotProduction(TEST_DATABASE_URL)` — refuse to proceed if it looks
   production-shaped.
2. `ensureSchema(pool)` — runs `src/db/schema.sql` (idempotent — every
   `CREATE … IF NOT EXISTS`).
3. `applyMigration007(pool)` — runs
   `migrations/007_accepted_events_dedup_index.sql` as a single-statement
   `pool.query()`. The pg simple-query protocol is used (no implicit
   transaction wrapper), so `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS`
   succeeds. Idempotent.
4. `verifyAcceptedEventsDedupValid(pool)` — refuses to run tests if the
   index is in `indisvalid = false` state (a prior failed CONCURRENTLY
   build). Recovery: `DROP INDEX CONCURRENTLY IF EXISTS accepted_events_dedup`
   then retry.
5. `cleanupTestBoundary(pool)` — `DELETE` rows under
   `workspace_id = '__test_ws_pr8__'` from accepted/rejected/ingest tables
   and the test token rows.
6. `seedTestToken(pool)` — `INSERT` an active site_write_token row keyed by
   the deterministic `TEST_TOKEN_ID`.

`beforeEach` re-runs `cleanupTestBoundary` + `seedTestToken` so each test
starts clean. `afterAll` calls `pool.end()`.

## 6. Verification matrix

| # | Concern | Test file |
|---|---|---|
| 1 | `accepted_events_dedup` exists, unique, indisvalid=true | `index-validity.dbtest.ts` |
| 2 | Columns + partial WHERE as PR#6 specified | `index-validity.dbtest.ts` |
| 3 | Legacy `idx_accepted_dedup_client_event` still present | `index-validity.dbtest.ts` |
| 4 | `schema.sql` does NOT carry `accepted_events_dedup` | `index-validity.dbtest.ts` |
| 5 | Valid /v1/event → 1 ingest + 1 accepted, HTTP 200 | `route-event.dbtest.ts` |
| 6 | Invalid event → 1 ingest + 0 accepted + 1 rejected, HTTP 200 | `route-event.dbtest.ts` |
| 7 | Invalid JSON → 400, ingest only, body sha stored | `route-event.dbtest.ts` |
| 8 | Bad Content-Type → 415, ingest only | `route-event.dbtest.ts` |
| 9 | Missing/invalid token → 401, ingest only, auth_status=invalid_token | `route-event.dbtest.ts` |
| 10 | Disabled token → 403, ingest only, auth_status=site_disabled | `route-event.dbtest.ts` |
| 11 | Mixed /v1/batch → 1 ingest + N accepted + M rejected, HTTP 200 | `route-batch.dbtest.ts` |
| 12 | Empty /v1/batch → ingest only with expected_event_count=0 | `route-batch.dbtest.ts` |
| 13 | Non-object fragments (Option A) → rejected + raw verbatim + raw_payload_sha256 = payloadSha256(fragment) | `route-batch.dbtest.ts` |
| 14 | Over 100 events → 413, ingest only, `batch_item_count_exceeded` | `route-batch.dbtest.ts` |
| 15 | Reconciled ingest: `accepted_count + rejected_count = expected_event_count` | `reconciliation.dbtest.ts` |
| 16 | Row-count joins: accepted/rejected counts match ledger | `reconciliation.dbtest.ts` |
| 17 | `reconciled_at` non-null on every parseable request | `reconciliation.dbtest.ts` |
| 18 | `request_body_sha256 = sha256Hex(raw bytes)` for known body | `hash-invariants.dbtest.ts` |
| 19 | `accepted_events.payload_sha256` present, 64 hex chars | `hash-invariants.dbtest.ts` |
| 20 | `accepted_events.canonical_jsonb` present + exactly 19 keys | `hash-invariants.dbtest.ts` |
| 21 | `payload_sha256 ≠ payloadSha256(canonical_jsonb)` — distinct shapes | `hash-invariants.dbtest.ts` |
| 22 | `rejected_events.raw_payload_sha256 = payloadSha256(raw)` | `hash-invariants.dbtest.ts` |
| 23 | Duplicate-reclassified row hashes raw event, NOT accepted payload_sha256 | `hash-invariants.dbtest.ts` |
| 24 | 3-retry sequential: 1 accepted + 2 duplicate rejected, all HTTP 200 | `duplicate-retry.dbtest.ts` |
| 25 | 5-retry sequential: 1 accepted + 4 duplicate rejected, all HTTP 200 | `duplicate-retry.dbtest.ts` |
| 26 | No accepted-row duplicates by triple anywhere in the test boundary | `duplicate-retry.dbtest.ts` |
| 27 | OPTIONS /v1/event allows `Authorization` header | `cors-preflight.dbtest.ts` |
| 28 | OPTIONS /v1/batch allows `Authorization` header | `cors-preflight.dbtest.ts` |
| 29 | `site_write_tokens.last_used_at` flips non-null within 500 ms | `last-used-at.dbtest.ts` |

`last_used_at` failure must not block event capture — that property is
already locked by the fake-pool test in `tests/v1/persistence.test.ts`
(`touchTokenLastUsedAt — swallows errors silently`). PR#8 does not retest it
against a real DB.

## 7. One-site RECORD_ONLY readiness checklist

Use this immediately after `npm run test:db:v1` is green and before sending
the first real SDK traffic. **Helen-gated** — do not run live traffic without
explicit approval.

1. **Backend URL ready.**
   - Local: `http://127.0.0.1:3000/v1/event`.
   - Staging: TBD by Helen — confirm before traffic.

2. **Site token exists.** Operator inserts a row into `site_write_tokens` for
   the chosen workspace + site:

   ```sql
   -- Replace <hmac-hex> with HMAC-SHA256(real_token, SITE_WRITE_TOKEN_PEPPER).
   INSERT INTO site_write_tokens
     (token_id, token_hash, workspace_id, site_id, label, created_at, disabled_at, last_used_at)
   VALUES (gen_random_uuid(), '<hmac-hex>', 'ws_real', 'site_real',
           'first-site RECORD_ONLY token', NOW(), NULL, NULL);
   ```

   The raw token never lands in the DB. Generate it once with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
   record it in the secrets manager, hash it with the same pepper the
   collector boots with.

3. **Which test site receives SDK traffic first?** TBD — Helen picks one of
   `buyerrecon_com / keigen_co_uk / fidcern_com / realbuyergrowth_com /
   timetopoint_com`. Default recommendation: `timetopoint_com` (most active
   per recent commits).

4. **DB queries proving the evidence trail.** Run, parameterised by the real
   workspace_id / site_id:
   - `docs/sql/verification/01_index_validity.sql`
   - `docs/sql/verification/02_reconciliation.sql`
   - `docs/sql/verification/03_hash_invariants.sql`
   - `docs/sql/verification/04_duplicate_retry.sql`
   - `docs/sql/verification/05_last_used_at.sql`

5. **Rollback / disable switch.** To immediately stop a misbehaving SDK:

   ```sql
   UPDATE site_write_tokens SET disabled_at = NOW() WHERE token_id = $1;
   ```

   Subsequent requests with that bearer return HTTP 403
   `auth_site_disabled` and write only the ingest_request row. Also
   available: `ENABLE_V1_BATCH=false` to disable batch ingest without
   touching `/v1/event`.

## 8. PR#8b / remaining follow-ups

These items are **out of scope for PR#8** and listed here for the next
planning cycle:

- **50-retry concurrent stress.** PR#8 caps at 5 sequential retries.
  A 50-retry concurrent test exposes real Postgres race conditions but needs
  realistic latency (staging DB, or Postgres-in-Docker in CI). Recommended
  home: PR#8b.
- **App-factory refactor for `src/server.ts` module-time env loading.**
  Today `src/server.ts:25` runs `loadV1ConfigFromEnv()` at module import. The
  PR#8 test app bypasses this by importing `createV1Router` directly, but a
  proper fix moves the loader call inside `start()` (or a new `createApp()`
  factory). Recommended home: PR#8b or PR#8c.
- **One-site RECORD_ONLY smoke.** Use the §7 checklist. Helen-gated.
- **Multi-site RECORD_ONLY smoke.** After the one-site path is green.
- **Admin / debug API.** §3.PR#9 — out of Sprint 1 Phase 1 scope.

## 9. Rollback plan

If PR#8 needs to be reverted:

1. Delete `tests/v1/db/` (entire directory).
2. Delete `docs/sql/verification/`.
3. Delete `docs/sprint2-pr8-db-verification.md`.
4. Revert `package.json` to remove the `test:db:v1` script.
5. Revert `.env.example` to drop the `TEST_DATABASE_URL` placeholder.
6. **No schema change** — PR#8 does not modify `src/db/schema.sql`.
7. **No app code change** — PR#8 does not modify any `src/**` file.
8. Verify `npm test` still returns the prior count (1144 / 1144 or current
   baseline) and `npx tsc --noEmit` is clean.

The test DB retains `accepted_events_dedup` after PR#8 setup runs — that is
benign because PR#6 considers the index part of the canonical target schema.
Test rows under `'__test_ws_pr8__'` can be cleaned manually with the same
DELETE statements `cleanupTestBoundary` runs.

## 10. Codex review checklist

After implementation, Codex (or human reviewer) confirms:

1. ✅ `npm test` still passes without `TEST_DATABASE_URL`. No `.dbtest.ts`
   files are executed.
2. ✅ `npm run test:db:v1` passes against `TEST_DATABASE_URL` pointing at a
   local/staging test DB (operator verifies).
3. ✅ `npm run test:db:v1` fails with a clear `TEST_DATABASE_URL`-required
   message when the env var is missing.
4. ✅ `src/collector/v1/{orchestrator,row-builders,index,routes,persistence,config,http-context,auth-route}.ts`
   and all PR#5 helpers are **unchanged**.
5. ✅ `src/db/schema.sql`, `src/db/client.ts`, `migrations/*` are unchanged.
6. ✅ `src/server.ts` is unchanged.
7. ✅ `src/auth/workspace.ts` is unchanged.
8. ✅ `src/collector/v1/index.ts` barrel still has exactly 4 `export * from`
   lines.
9. ✅ No new file imports `ams-qa-behaviour-tests` or `keigentechnologies/ams`.
10. ✅ No new file contains `risk_score` / `classification` /
    `recommended_action` / `bot_score` / `agent_score` / `behavioural_score`
    / `behavior_score` / `is_bot` / `is_agent` / `ai_agent` in active code.
11. ✅ No Playwright import. No production URL in any `.dbtest.ts`.
12. ✅ `assertNotProduction` rejects `TEST_DATABASE_URL === DATABASE_URL` and
    URLs containing `'prod'`.
13. ✅ Test boundary uses `workspace_id = '__test_ws_pr8__'`,
    `site_id = '__test_site_pr8__'` everywhere; tokens use fixed UUIDs.
14. ✅ `beforeEach` cleans the test boundary; `afterAll` calls `pool.end()`.
15. ✅ `applyMigration007` runs the migration as a single-statement
    `pool.query` (no transaction wrapper, no multi-statement).
16. ✅ Index validity asserts `indisvalid = true` and the partial WHERE.
17. ✅ Reconciliation invariant: `accepted_count + rejected_count =
    expected_event_count` holds for every reconciled ingest row.
18. ✅ Hash invariants: `request_body_sha256`, `payload_sha256` vs
    `payloadSha256(canonical_jsonb)`, `raw_payload_sha256` all verified.
19. ✅ 3-retry and 5-retry duplicate proofs produce exactly 1 accepted +
    N−1 duplicate-rejected; all HTTP 200; no 5xx.
20. ✅ CORS preflight allows `Authorization` for both routes.
21. ✅ `last_used_at` polls non-null within ≤500 ms.
22. ✅ `.env.example` placeholder uses no real secret.
23. ✅ `package.json` has the new `test:db:v1` script and no new
    dependencies.
24. ✅ No commit, no push, no deploy.
