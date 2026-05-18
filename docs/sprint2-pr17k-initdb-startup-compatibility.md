# BuyerRecon Sprint 2 PR#17k — Production initDb Startup-Compatibility Closure

Status: **minimal code + tests + docs**. No DB access, no production execution, no deployment, no DNS change, no ThinLayer cutover, no Track A, no traffic, no secrets. Closes the §1.1 / §9.1 BLOCKER recorded in PR#17j.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `527ec6c` — PR#17j merged, "add production collector deployment runbook").

PR branch: `buyerrecon-sprint2-pr17k-initdb-startup-compatibility`

---

## 1. Purpose

PR#17k closes the production collector service-start BLOCKER recorded in PR#17j §1.1 / §9.1 by adding an explicit production-safe skip for the runtime schema bootstrap path. After PR#17k:

- The production deployment runbook (PR#17j) is **unblocked** for Phase 1 service start, provided the production service env sets `SKIP_DB_INIT=true` and PR#17k is merged + proven.
- The production runtime role (`buyerrecon_prod_collector_app`) does **not** need DDL privileges — and PR#17k does not grant any. Runtime role privilege broadening remains explicitly prohibited (per PR#17f, PR#17g, PR#17h, PR#17j).
- The production schema lifecycle remains **operator-managed** via the `src/db/schema.sql` baseline (per PR#17i) followed by `migrations/002_*.sql` through `migrations/016_*.sql` (per PR#17f / PR#17g / PR#17h).

PR#17k is the smallest possible change that closes the BLOCKER: one helper added to `src/db/client.ts`, one guarded call site in `src/server.ts`, one new test file with pure helper + source-shape assertions, this docs file, and a patch to the PR#17j runbook to mark the BLOCKER closed.

---

## 2. Problem

Recorded in PR#17j §1.1 / §9.1:

- `src/server.ts:25-29` calls `initDb()` **before** the app binds and `listen()` returns.
- `initDb()` (in `src/db/client.ts:11-15` at PR#17j time) reads `src/db/schema.sql` and sends the **entire** file through `pool.query(schema)` against the configured `DATABASE_URL`.
- `src/db/schema.sql` contains DDL — `CREATE EXTENSION IF NOT EXISTS pgcrypto`, multiple `CREATE TABLE IF NOT EXISTS …`, multiple `CREATE INDEX IF NOT EXISTS …`, and other schema statements.
- The production runtime role is `buyerrecon_prod_collector_app`. Per PR#17h §13: non-superuser, no `createdb`, no `createrole`, no role memberships; per PR#17f §10 / §11 grant boundaries: runtime roles do **not** receive DDL.
- **Even idempotent `IF NOT EXISTS` DDL is not guaranteed to be a clean no-op under a least-privilege non-DDL role** — privilege checks (ownership, `CREATE` on schema, extension policy) can still fire depending on Postgres version and the deployed grant set.
- **Broadening the runtime role's privileges is prohibited.** PR#17j explicitly forbids granting DDL / `createdb` / `createrole` / superuser / DDL-group membership to `buyerrecon_prod_collector_app`. The fix may not live in privilege broadening.

---

## 3. Chosen solution

Add a **strict** env flag, `SKIP_DB_INIT`, that — when set to the exact literal string `"true"` — causes `src/server.ts:start()` to skip the `initDb()` call. The corresponding helper, `shouldSkipDbInit()`, lives in `src/db/client.ts` alongside `initDb()`.

```text
SKIP_DB_INIT env value      shouldSkipDbInit() result      initDb() runs?
─────────────────────────   ──────────────────────────     ───────────────
unset                       false                          yes (default)
"true"                      true                           no (skipped)
"false"                     false                          yes
"FALSE" / "False"           false                          yes
"TRUE"  / "True"            false                          yes (case-sensitive)
"1"                         false                          yes
"0"                         false                          yes
""                          false                          yes
"yes"                       false                          yes
" true " (with whitespace)  false                          yes
```

Design choices:

- **Default behavior is unchanged.** When `SKIP_DB_INIT` is unset, `shouldSkipDbInit()` returns `false` and `initDb()` runs exactly as before. Existing dev / test / staging behavior is unaffected.
- **Strict equality with the literal `"true"`** — not broad truthiness. This prevents an accidental skip from a malformed env value (e.g. someone setting `SKIP_DB_INIT=false` and expecting it to mean "do not skip"; or setting `SKIP_DB_INIT=1` and expecting it to mean "skip"). The only accepted value is the exact lowercase literal string `"true"`.
- **Skip path emits a single safe log line.** `console.log('Database schema bootstrap skipped by SKIP_DB_INIT=true')` — no env dump, no DSN, no DB name, no host, no port, no token, no pepper, no password, no private IP. The test suite asserts that the literal contains no DSN / token / pepper / password / RFC1918 substrings.
- **The skip path does not connect to the DB just to prove anything.** No diagnostic `SELECT current_database()` or similar is added — that would change the privilege surface and could leak DSN material into logs. Connection / target verification stays with the operator runbook (PR#17j §12) and is performed out-of-process from a vault DSN.
- **The skip path does not change routes, middleware, or collector behavior.** `createApp()` is called as before; `app.listen()` runs as before.
- **The production schema lifecycle remains operator-managed.** `src/db/schema.sql` is canonical (PR#17i); migrations `002–016` are applied by the operator runbook (PR#17f / PR#17g); future migrations land via future operator PRs. PR#17k does not add a new bootstrap path or a new schema source.

### Implementation (already applied in this PR)

```ts
// src/db/client.ts
export function shouldSkipDbInit(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.SKIP_DB_INIT === 'true';
}
```

```ts
// src/server.ts (inside start())
if (shouldSkipDbInit()) {
  console.log('Database schema bootstrap skipped by SKIP_DB_INIT=true');
} else {
  await initDb();
}
```

---

## 4. Safety boundaries

PR#17k authoring observed and preserved:

- **No DB access** in PR#17k authoring (only pure unit tests and source-shape assertions; the test suite does **not** open a Postgres connection).
- **No production commands.** No `psql`, no `systemctl`, no `docker`, no edge / DNS API calls.
- **No deployment.**
- **No DNS change.**
- **No ThinLayer cutover.**
- **No Track A execution.**
- **No Playwright.**
- **No production traffic.**
- **No customer-facing automated output.**
- **No runtime DDL grants.** PR#17k does not grant any privilege, does not create a role, does not add a role to any group, does not modify any grant. `buyerrecon_prod_collector_app` remains intentionally non-DDL.
- **No durable Lane A/B writers.** PR#17g's grant-safety state remains in force.
- **No secrets in the doc, repo, chat, or PR.** No `DATABASE_URL`, no raw tokens, no token hashes, no token prefixes, no peppers, no passwords, no private IPs, no certificate material, no vault contents.

---

## 5. Production deployment requirement

For the future production deployment PR (PR#17j-deploy / PR#17l per PR#17j §24):

- **`SKIP_DB_INIT=true` must be set in the production service env.** The operator places it via the approved vault / secret manager mechanism into `<PRODUCTION_ENV_FILE>` (mode 0600, deploy-user-owned, not in git). The value is the exact lowercase literal `true`.
- **The service must use `buyerrecon_prod_collector_app`.** No DDL grants are added; the role remains least-privilege.
- **The service must target `buyerrecon_production`.** Verified per PR#17j §12 (parallel one-shot `current_database()` / `current_user` check, DSN never printed).
- **Proof must show schema bootstrap was skipped** — by capturing the safe single-line log `Database schema bootstrap skipped by SKIP_DB_INIT=true` (or its absence-of-init-db evidence) without printing any other env value. No DSN, no token, no pepper, no password, no private IP in proof artefacts.
- **Proof must show health / logs / zero-traffic posture** per PR#17j §11 / §13 / §14.
- **PR#17j non-approvals are preserved**: no ThinLayer cutover, no DNS, no Track A, no Playwright, no live traffic, no customer-facing output, no Lane A/B writers, no AMS Trust Core, no Pass 1 / Pass 2.

If the production env does **not** set `SKIP_DB_INIT=true`, the runtime will attempt `initDb()` under `buyerrecon_prod_collector_app` and may fail — that failure is the §1.1 / §9.1 incident and must be handled per PR#17j §17 (no privilege broadening).

---

## 6. Tests

PR#17k adds `tests/db-client-skip-init.test.ts`. The tests follow the existing PR#8b `tests/v1/app-factory.test.ts` pattern (pure helper unit tests + source-shape regex assertions; no DB, no network, no env mutation, no import of `src/server.ts`). Categories:

- **`shouldSkipDbInit()` unit tests:** default unset → false; exact literal `"true"` → true; `"false"`, `"FALSE"`, `"TRUE"`, `"True"`, `"1"`, `"0"`, `""`, `"yes"`, `" true "` (whitespace) → false. Confirms strict equality and case-sensitivity. A `shouldSkipDbInit()` no-arg call also asserts the default-parameter path reads from `process.env`.
- **`src/server.ts` shape:** imports `shouldSkipDbInit` from `./db/client.js`; calls `shouldSkipDbInit()` before `initDb()`; both calls live inside the `start()` function. The skip log message contains no DSN / token / pepper / password / RFC1918-IP substrings.
- **`src/db/client.ts` shape:** exports a `function shouldSkipDbInit`; uses strict equality `=== 'true'` (not broad truthiness); does **not** introduce `GRANT`, `CREATE ROLE`, `ALTER ROLE`, or `SUPERUSER` text (i.e. no privilege broadening).

Tests are pure: they do not need a database, do not start an HTTP server, do not import the non-import-safe `src/server.ts` module. The tests run under the default `npm test`.

---

## 7. Acceptance criteria

- **Minimal code change** — `src/db/client.ts` (+13 lines: one helper + comment); `src/server.ts` (replace one `await initDb();` with a guarded `if (shouldSkipDbInit()) { … } else { await initDb(); }` block + import + comment); no other runtime / schema / route / middleware change.
- **Default behavior unchanged** — when `SKIP_DB_INIT` is unset or any value other than the exact string `"true"`, `initDb()` runs exactly as before.
- **Explicit production skip supported** — `SKIP_DB_INIT=true` skips runtime schema bootstrap; safe single-line log is emitted; no env dump.
- **No DB access** by PR#17k authoring (no migrations, no production commands, no DDL grants).
- **No secrets** in PR#17k authoring.
- **No customer-facing output** approved.
- **PR#17j docs updated** to mark the §1.1 / §9.1 BLOCKER closed by PR#17k and to switch the operator-runbook gating to "service start may proceed when production env sets `SKIP_DB_INIT=true` and PR#17k is merged/proven".
- **Tests / static checks pass** locally (`npm run check:scoring-contracts` PASS; `npx tsc --noEmit` PASS; the new test file's pure tests PASS; DB tests skipped per the same boundary that has governed prior PRs in this sequence).

---

## 8. Explicit non-goals

PR#17k does **not**:

- deploy the production collector,
- start the production service,
- modify production env,
- run any DB command (no `psql`, no migration run, no schema bootstrap, no diagnostic queries),
- create or rotate any secret,
- cut any ThinLayer `endpointUrl`,
- change DNS,
- run Track A,
- run Playwright,
- generate staging or production traffic,
- enable any customer-facing automated output,
- broaden `buyerrecon_prod_collector_app` privileges,
- grant DDL to the runtime role,
- alter the Lane A/B writer posture (PR#17g's grant safety remains in force),
- modify migrations `002_*.sql` through `016_*.sql`,
- modify `src/db/schema.sql` semantics (no DDL change; the §6 of `src/db/schema.sql` PR#17i header comment is unchanged).

---

## 9. Stop-the-line conditions

Stop and re-plan if any of the following appears in PR#17k:

- the helper accepts broad truthiness (e.g. `Boolean(env.SKIP_DB_INIT)`) or accepts values other than the exact literal `"true"`,
- the skip path includes a DSN / token / pepper / password / private IP in any log line,
- the skip path issues a DB query (even a "diagnostic" one),
- the skip path changes routes, middleware, collector behavior, or env reads other than `SKIP_DB_INIT`,
- the runtime role is broadened (DDL grant, `createdb`, `createrole`, superuser, DDL group membership) in code or docs,
- a migration is added / edited / removed,
- a production command is executed by PR#17k authoring,
- secrets, tokens, token hashes, token prefixes, DB URLs, passwords, peppers, private IPs, vault contents, or certificate material appear in any artefact.

---

End of PR#17k. **Minimal code + tests + docs. No production action. The PR#17j §1.1 / §9.1 BLOCKER is closed once PR#17k is merged and the production deployment PR (PR#17l) confirms `SKIP_DB_INIT=true` in the production env.**
