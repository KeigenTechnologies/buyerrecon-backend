# BuyerRecon Sprint 2 PR#17j — Production Collector Deployment / Operator Proof Runbook

Status: **runbook authoring is docs-only AND production collector service start is DEFERRED**. Authoring of PR#17j performs no execution. **Even after** Codex PASS, merge, and a Helen final GO, the production collector **service start is BLOCKED** until the `initDb()` startup-compatibility risk identified in §1.1 / §9.1 is closed by a separately approved PR or by a separately approved operator preflight. Until that closure, Helen's final GO may authorise **deployment-prerequisite preparation and preflight planning only** — not a production service start.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `dd42862` — PR#17i merged, "document schema baseline policy").

PR branch: `buyerrecon-sprint2-pr17j-production-collector-deployment-operator-proof`

---

## 1. Purpose

PR#17j defines the **operator runbook** for the Sprint 2 production collector deployment against the already-prepared production data plane (production DB, production collector login role, production `site_write_tokens`, production / staging separation — established by PR#17f and proved by PR#17h).

The runbook covers two kinds of work, with a hard boundary between them:

- **Deployment-prerequisite preparation and preflight planning** — currently approvable under a Helen final GO (subject to §2 gates). This includes: confirming all PR#17h prerequisites still hold, defining the chosen build/package strategy categorically, preparing the env-file shape (no values written to production yet), pre-staging rollback levers, and **planning an `initDb()` startup-compatibility preflight** (see §9.1, §12).
- **Production collector service start** (i.e. the actual `node dist/server.js` or `docker run` against the production data plane) — **BLOCKED in PR#17j**. See §1.1.

PR#17j also covers what the eventual successful deployment will need to verify when it does happen: service health (`GET /health`), log / secret scan, DB-target verification without DSN disclosure, zero-traffic preservation, rollback. These are documented as future verification posture, not as steps the operator may take under PR#17j alone.

### 1.1 Hard pre-execution gate — production collector service start is BLOCKED

**Production collector service start is not approved by PR#17j until the `initDb()` startup-compatibility risk is closed.**

The risk in precise terms:

- `src/server.ts:25-29` calls `initDb()` before binding the app and before `app.listen(PORT, …)` returns.
- `initDb()` (defined in `src/db/client.ts:11-15`) reads `src/db/schema.sql` and sends the whole file through `pool.query(schema)` against `process.env.DATABASE_URL`.
- `src/db/schema.sql` contains DDL — `CREATE EXTENSION IF NOT EXISTS pgcrypto`, multiple `CREATE TABLE IF NOT EXISTS`, multiple `CREATE INDEX IF NOT EXISTS`, and other schema statements.
- The production runtime role is `buyerrecon_prod_collector_app`, which is **intentionally non-DDL** (PR#17h §13 records `rolsuper = false`, `rolcreatedb = false`, `rolcreaterole = false`, no role memberships; PR#17f §10 / §11 grant boundaries deny DDL to runtime roles).
- **Idempotent DDL such as `CREATE EXTENSION IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` may still require ownership / `CREATE` schema privileges depending on the deployed Postgres version and the existing object ownership.** Even when the target object already exists, some PostgreSQL paths still perform privilege checks; behaviour is not guaranteed to be a clean no-op under a least-privilege non-DDL role.
- **PR#17j must therefore not "start the service to see what happens".** A startup failure on `initDb()` against `buyerrecon_prod_collector_app` is not an ordinary schema-drift signal once the operator has tried to start production; it conflates schema-state and privilege-state in a way that can mask real issues, and an unsuccessful boot leaks restart noise and operator-fix temptation into the production change window.

Therefore PR#17j **defers production service start** until **one** of the following resolution paths (see §24) closes the risk:

- **Path A — Code/runbook PR that gates or bypasses runtime `initDb()` for production** (for example, a code change that makes `initDb()` a no-op when an env flag like `SKIP_INIT_DB=1` is set, or that runs schema bootstrap only when the connected role is a migrator). Approved separately, with its own review.
- **Path B — Operator preflight that proves `initDb()` startup succeeds under `buyerrecon_prod_collector_app` without new privileges and without writes**, performed outside production traffic and recorded in its own proof PR. The preflight must demonstrate clean idempotent execution of every DDL statement in `src/db/schema.sql` under exactly the deployed runtime role with the deployed grants.
- **Path C — Deployment strategy that starts the service using a safe startup path that does not execute schema bootstrap under the runtime role** (for example, ahead-of-time schema bootstrap by the migrator role, with the runtime service started against a build whose `initDb()` is not invoked).

Until Path A, B, or C is closed by a separately approved PR or preflight, **the only execution PR#17j authorises is deployment-prerequisite preparation and preflight planning** (§10 phase 0).

PR#17j is also explicit about what it does **not** do, ever, regardless of merge or GO state:

- it does **not** execute anything during authoring or review,
- it does **not** cut any ThinLayer `endpointUrl` on any live site (`buyerrecon.com` included),
- it does **not** change live site traffic,
- it does **not** change DNS,
- it does **not** run Track A,
- it does **not** run Playwright,
- it does **not** generate browser / live production traffic,
- it does **not** enable any customer-facing automated output,
- it does **not** approve durable Lane A/B writers, an AMS runtime bridge, AMS Trust Core exposure, or Pass 1 / Pass 2 implementation,
- it does **not** treat the staging DB as production,
- it does **not** treat the Render legacy DB as the Sprint 2 canonical production DB.

Anything in PR#17j that resembles an instruction is a **runbook step the operator may execute only after the §2 gates are satisfied**.

---

## 2. Execution status and approval gates

PR#17j's execution status is governed by six sequential gates. The runbook is not executable until **all** of gates 1–4 have been satisfied; gate 5 is the execution; gate 6 is the closure.

1. **Draft runbook PR created.** This document is committed to the PR branch `buyerrecon-sprint2-pr17j-production-collector-deployment-operator-proof`.
2. **Codex review PASS.** PR#17j passes a narrow review against the constraints in §25 (and against the PR#17a–PR#17i architectural posture).
3. **PR merged.** The PR is merged into `sprint2-architecture-contracts-d4cc2bf`.
4. **Helen final GO recorded.** Helen records the explicit final-GO message (see expected wording below) in a durable place attached to this execution (PR comment, issue, runbook log entry). Until this message is recorded **verbatim or in unambiguous equivalent form**, the runbook is not executable.
5. **Operator executes runbook** exactly as written in this document, against the named production target, recording each step's outcome.
6. **Proof closure PR / report created** (per §18), summarising what was executed and what was verified.

Governing rules:

- **Merge alone is not enough to execute.** Helen's final GO is the gate that distinguishes "runbook is canonical" from "runbook may run now".
- **Helen's final GO must explicitly state target and allowed scope.** A general "go ahead" or "looks good" is **not** a final GO; ambiguous wording is a stop-the-line condition (§22).
- **If the GO is ambiguous, do not execute.** Ask for an explicit GO message in the expected shape below.

**Expected Helen final-GO wording while the §1.1 `initDb()` gate remains OPEN (verbatim, or unambiguous equivalent):**

> "I approve executing PR#17j operator runbook now. Scope: deployment-prerequisite preparation and `initDb()` startup-compatibility preflight planning only. No production collector service start. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live production traffic generation. No customer-facing output."

**Expected Helen final-GO wording once the §1.1 `initDb()` gate has been CLOSED by a separately approved Path A / B / C (per §24):**

> "I approve executing PR#17j operator runbook now. Scope: production collector deployment / health / logging / DB-target verification only. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live production traffic generation. No customer-facing output."

Until the §1.1 gate is closed by a separately approved PR or preflight, the second wording above must **not** be issued; even if issued, the operator must stop and request the gate-aware first wording. The operator may not broaden scope beyond what the final-GO message authorises.

If the recorded GO message diverges from one of the two scopes above (for example: it adds "and cut `buyerrecon.com` over"), the operator must stop and request an explicit, scope-correct GO message.

---

## 3. Inputs from PR#17a–PR#17i

PR#17a, PR#17b, PR#17c, PR#17d, PR#17e, PR#17f, PR#17g, PR#17h, and PR#17i are merged and govern PR#17j:

- **PR#17a — Production cutover / output-gate architecture** (`881739c`). Render legacy remains archive/fallback. Sprint 2 schema is canonical. Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.
- **PR#17b — Production collector deployment planning** (`9b50a5d`). Future collector endpoint shape (placeholder `collector.buyerrecon.com`); production DB / hosting / TLS / health / rollback posture. Planning only at that time.
- **PR#17c — Production DB / role / token plan** (`0713037`). Production DB separate from `buyerrecon_staging` and Render legacy; role families; `site_write_tokens` posture; no values in repo / chat.
- **PR#17d — `buyerrecon.com` canary endpoint cutover runbook** (`bfbf25c`). Not executed; remains future, governed by its own explicit GO.
- **PR#17e — Track A unlabelled `B_analytics_only` proof plan** (`434e9fa`). Not executed; remains future, governed by its own explicit GO.
- **PR#17f — Production migration / operator runbook** (`21ea5f2`). Execution-approved; executed under Helen final GO within scope (DB / migrations / roles / tokens / verification only).
- **PR#17g — Lane A/B grant safety correction** (`7b151d2`). `migrations/016_scoring_output_lane_grant_safety.sql` removes the durable Lane A/B writer privilege that migration 011 would otherwise have carried over; no durable Lane A/B writer is approved.
- **PR#17h — PR#17f production migration / operator proof** (`74a9532`). Records production DB created, baseline + migrations 002–016 applied, `buyerrecon_prod_collector_app` created, separation verified, 5 `site_write_tokens` provisioned under `workspace_id = keigen_prod_ws`, zero-traffic proof passed, no ThinLayer cutover, no Track A, no customer-facing output.
- **PR#17i — Schema baseline policy** (`dd42862`). `src/db/schema.sql` is canonical; `dist/db/schema.sql` is a gitignored Docker build artifact, never an independent source of truth. Operators always baseline from `src/db/schema.sql`.

PR#17j inherits all of these constraints and does not relax any of them.

---

## 4. Current production data-plane prerequisites

The runbook may be executed only if **every** prerequisite below is true at execution time. They are the proved state from PR#17f / PR#17h, re-confirmed before deployment.

- `buyerrecon_production` exists.
- `src/db/schema.sql` baseline has been applied.
- Migrations `002_*.sql` through `016_*.sql` have been applied, in numeric order, including `016_scoring_output_lane_grant_safety.sql`.
- `buyerrecon_prod_collector_app` exists with the role posture from PR#17h §13 (`rolcanlogin = true`, `rolinherit = true`, `rolsuper = false`, `rolcreatedb = false`, `rolcreaterole = false`, no role memberships).
- Production / staging connection separation verified:
  - `buyerrecon_prod_collector_app` can `CONNECT` to `buyerrecon_production`,
  - `buyerrecon_prod_collector_app` cannot `CONNECT` to `buyerrecon_staging`,
  - `buyerrecon_app` can `CONNECT` to `buyerrecon_staging`,
  - `buyerrecon_app` cannot `CONNECT` to `buyerrecon_production`,
  - `PUBLIC` `CONNECT` is revoked on both DBs.
- `site_write_tokens` exists with 5 rows, all active (`disabled_at IS NULL`), under `workspace_id = keigen_prod_ws`, for `site_id ∈ { buyerrecon_com, realbuyergrowth_com, timetopoint_com, fidcern_com, keigen_co_uk }`.
- Row counts before deployment:
  - `accepted_events` = 0,
  - `rejected_events` = 0,
  - `ingest_requests` = 0,
  - `scoring_output_lane_a` = 0,
  - `scoring_output_lane_b` = 0,
  - `site_write_tokens` = 5.
- Lane A/B writer grant safety (PR#17g) holds: `buyerrecon_scoring_worker` has no `SELECT` / `INSERT` / `UPDATE` / `DELETE` on either lane table; `buyerrecon_customer_api` has no `SELECT` on either lane table; `buyerrecon_internal_readonly` has `SELECT` and no `INSERT` / `UPDATE` / `DELETE` on either lane table; `buyerrecon_migrator` retains `ALL`.
- No ThinLayer cutover has happened on any live site.
- No Track A has run.
- No customer-facing output has been enabled.

If any prerequisite has changed since PR#17h closure (other than as documented by an intervening explicitly-approved PR), the operator stops and re-aligns before deployment.

---

## 5. Non-goals

PR#17j explicitly does **not** approve and does **not** perform any of the following — regardless of merge / GO state:

- ThinLayer `endpointUrl` cutover on any live site,
- DNS change (no `collector.buyerrecon.com` record creation / modification, no zone edit, no edge / CDN cutover),
- `buyerrecon.com` canary endpoint cutover (PR#17d governs that, not PR#17j),
- all-site cutover,
- Track A execution (PR#17e governs that, not PR#17j),
- Playwright execution,
- browser / live production traffic generation,
- Render shutdown or modification,
- Render legacy data migration,
- DB creation,
- migration execution against any DB,
- role creation,
- token creation,
- token rotation,
- customer-facing automated output (reports, actions, scores),
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output through BuyerRecon,
- implementation of Pass 1 or Pass 2 governance.

Anything in this list that is later required is delivered in a separate, explicitly-scoped PR (see §24).

---

## 6. Deployment target definition

The target is specified categorically here; actual values are confirmed at execution time and **masked** in the proof report. **No real private IPs, no DB URLs, no raw secrets, no live credential values appear in this doc.**

- **Approved production host:** referenced as `<PRODUCTION_HOST>` (placeholder). The same host class established by PR#17f for the production data plane is preferred; deviation requires Helen's explicit GO.
- **Production app directory:** referenced as `<PRODUCTION_APP_DIR>` (placeholder). A dedicated, deploy-user-owned, release-versioned directory layout is preferred so rollback is a pointer flip rather than a re-clone.
- **Production service name:** referenced as `<PRODUCTION_SERVICE_NAME>` (placeholder). The operator records the actual service name (e.g. `br-collector-prod`) in the proof report.
- **Production runtime process manager:** referenced as `<PRODUCTION_PROCESS_MANAGER>` (placeholder). The repo provides Node entrypoints (`npm start` → `node dist/server.js`) and a multi-stage `Dockerfile`. The chosen process manager (e.g. `systemd`, `docker run` under a supervisor, `pm2`) is the existing host practice; PR#17j does not pin one. Whatever is chosen, it must:
  - run as a non-root deploy user,
  - read its env from a root-owned-or-deploy-user-owned secrets file (mode 600), not from a shared shell history,
  - restart on failure,
  - emit structured logs.
- **Production log location:** referenced as `<PRODUCTION_LOG_PATH>` (placeholder). Log retention and rotation policy must exist (decision deferred to host practice).
- **Production health endpoint:** the repo exposes `GET /health` (returns `{ status: "ok", timestamp: "<ISO8601>" }` per `src/app.ts:102`). The publicly-accessed health URL is referenced as `<HEALTH_URL>` (placeholder). The health endpoint exposes **no env**, **no DB URL**, **no token**, **no role**, **no private IP**.
- **Production collector bind address / port:** the repo defaults to `PORT = 3000` (`src/server.ts:20`). The operator may override via env. The actual bind address and port at execution time are referenced as `<COLLECTOR_BIND_ADDRESS>` and `<COLLECTOR_PORT>` (placeholders).
- **Public exposure status:** PR#17j brings the collector up against the production data plane. **Public ThinLayer-facing exposure is out of scope for PR#17j** — the collector must not be wired into live ThinLayer traffic during PR#17j execution (no DNS pointing live `buyerrecon.com` at this service). The collector may be reachable internally (e.g. via a non-public hostname / private network) for the §11 health proof; public exposure is the subject of a separate later PR after Helen's explicit GO. Final exposure values are confirmed at execution time and recorded categorically in the proof report.

No real value above appears in this doc; all are placeholders. Final values must be **masked** in the proof artefact (categorical references only).

---

## 7. Environment and secret requirements

The Sprint 2 production collector reads its env at startup. Required env categories (categories only — **no values for any category appear in this doc**):

- **`DATABASE_URL`** — production DSN for `buyerrecon_production`, using `buyerrecon_prod_collector_app`. Sourced from the approved vault. Never staging. Never Render legacy. Never committed.
- **`SITE_WRITE_TOKEN_PEPPER`** — pepper used by token-validation (HMAC-SHA256 of raw token with this pepper produces `token_hash` per `migrations/006_site_write_tokens.sql`). Sourced from the approved vault.
- **`IP_HASH_PEPPER`** — pepper used by any IP-hashing path. Sourced from the approved vault.
- **`NODE_ENV`** — set to `production`.
- **`ALLOWED_ORIGINS`** — explicit CORS allow-list (e.g. the five live site origins per `.env.example`). The operator confirms the production list at execution time without copying any secret value into this proof.
- **`COLLECTOR_VERSION`** — current collector build / version string (per `.env.example`; e.g. `1.0.0` or the deployed value). Recorded in the proof report for observability traceability.
- **`PORT`** — service bind port (default 3000 in code).
- **Process-manager env file path** — referenced as `<PRODUCTION_ENV_FILE>` (placeholder). The file is **root-owned-or-deploy-user-owned, mode 600**, **not** in git, **not** in chat, **not** in the proof report.

### Secret sourcing posture

- All secrets come from the **approved vault / secret manager**, never from the repo, chat, PR, terminal transcripts destined for sharing, or this docs file.
- The vault values for production secrets are the same approved values produced under PR#17f Helen GO; PR#17j does not rotate them.
- **`PROBE_ENCRYPTION_KEY`** (per `.env.example`) is a separate category; if the production collector deployment requires it, the operator sources it from the vault the same way. PR#17j does not pin its presence; the operator confirms during execution.

### Proof posture for env

Proof may show only **masked category status** per env var:

- `set` / `missing`,
- for peppers and `PROBE_ENCRYPTION_KEY`: byte/character length only (no value, no prefix),
- for `DATABASE_URL`: the **database name** extracted from the URL (e.g. `buyerrecon_production`) without the full URL, user, password, host, or port,
- for `DATABASE_URL`: the **DB user** name only (e.g. `buyerrecon_prod_collector_app`) without the password,
- for `DATABASE_URL`: the **host category** only (e.g. "approved production Postgres host") without the private IP / hostname / port.

Any leakage of a real value into a proof artefact is a §17 incident.

---

## 8. Pre-execution checks

Performed by the operator immediately before deployment (these run after gates 1–4 are satisfied; they are read-only and produce no production change):

- **Repo HEAD equals the approved merged PR#17j base.** The operator confirms the checkout matches the merge commit of PR#17j at the time of GO.
- **Working tree is clean.** No uncommitted local changes.
- **Production DB target exists.** `current_database() = buyerrecon_production` from a verification session.
- **Production / staging separation remains correct** (the four cross-connection checks from §4 still pass).
- **`buyerrecon_prod_collector_app`** can connect to production and not to staging.
- **`buyerrecon_app`** can connect to staging and not to production.
- **`site_write_tokens` metadata** is intact: 5 active rows, `last_used_at IS NULL` for all five, matching PR#17h §14 (no token has yet been validated — consistent with "no collector deployment yet").
- **Row counts** `accepted_events = 0`, `rejected_events = 0`, `ingest_requests = 0`, `scoring_output_lane_a = 0`, `scoring_output_lane_b = 0` before deployment.
- **Lane A/B writer grant safety** (PR#17g) still holds.
- **No live endpoint cutover** has occurred since PR#17h closure.
- **No Track A execution** in this phase.

Each check is recorded categorically (PASS / FAIL) in the proof report.

---

## 9. Build / package strategy

PR#17j authoring inspected the repo to pin a deploy primitive without inventing one:

- **`package.json` scripts:**
  - `"build": "tsc"` — compiles `src/` → `dist/` per `tsconfig.json` (`outDir: dist`, `rootDir: src`).
  - `"start": "node dist/server.js"` — runs the compiled entrypoint.
  - `"dev": "tsx watch src/server.ts"` — dev-only; **not** used for production.
- **`Dockerfile` (multi-stage):**
  - Builder stage: `npm ci`, `COPY src/`, `RUN npx tsc`.
  - Runtime stage: `npm ci --omit=dev`, `COPY --from=builder /app/dist dist/`, `COPY src/db/schema.sql dist/db/schema.sql` (per PR#17i: `src/db/schema.sql` is canonical, `dist/db/schema.sql` is a build artifact hydrated from `src/`, never an independent source of truth).
  - Runtime command: `CMD ["node", "dist/server.js"]`.
- **`src/server.ts` boot contract:**
  - `import 'dotenv/config'` populates `process.env` from `.env` (if present).
  - `loadV1ConfigFromEnv()` runs inside `start()` and **fail-fasts on missing required peppers** (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`).
  - `initDb()` runs at startup — this **executes `src/db/schema.sql` as a `pool.query`** against the configured `DATABASE_URL`. **See §1.1 and §9.1: this behaviour is the reason PR#17j BLOCKS production service start until the compatibility risk is closed.** The schema is idempotent in shape (`CREATE … IF NOT EXISTS`), but idempotent DDL can still require privileges under a least-privilege non-DDL runtime role; PR#17j does not authorise the operator to "start the service to see what happens".
  - On success: `createApp({ pool, v1Loaded, allowed_origins })` is constructed and bound to `PORT`.
  - On failure: `start().catch` logs the error and `process.exit(1)`. Logs must not include raw env values.

### 9.1 `initDb()` startup-compatibility risk (BLOCKER for production service start)

This sub-section formally records the risk that gates production service start under PR#17j (and refers back to §1.1):

- `src/server.ts:25-29` calls `await initDb()` before `app.listen(PORT, …)` runs.
- `initDb()` (defined in `src/db/client.ts:11-15`) reads `join(__dirname, 'schema.sql')` and sends the **entire file** through `pool.query(schema)`.
- `src/db/schema.sql` (canonical per PR#17i) contains DDL — `CREATE EXTENSION IF NOT EXISTS pgcrypto`, multiple `CREATE TABLE IF NOT EXISTS …`, multiple `CREATE INDEX IF NOT EXISTS …`, and other schema statements.
- Production runtime role: `buyerrecon_prod_collector_app`. Per PR#17h §13: non-superuser, no `createdb`, no `createrole`, no role memberships; per PR#17f §10 / §11 grant boundaries: runtime roles do **not** receive DDL.
- **Even `IF NOT EXISTS` DDL is not guaranteed to be a clean no-op under a least-privilege non-DDL role.** Depending on Postgres version, schema ownership, and the precise grant set, some `IF NOT EXISTS` paths still perform privilege checks (for example, `CREATE EXTENSION IF NOT EXISTS` may require superuser or specific extension-grant policy; `CREATE TABLE IF NOT EXISTS` may interact with default privileges or table-ownership ACLs). Behaviour under `buyerrecon_prod_collector_app` is **not proven** and must not be assumed.
- Therefore the BLOCKER (per §1.1):
  - PR#17j does **not** approve broadening `buyerrecon_prod_collector_app` privileges (no DDL grants, no membership in a DDL group role).
  - PR#17j does **not** approve giving DDL grants to the runtime collector role under any circumstances.
  - PR#17j does **not** approve service start if `initDb()` still runs under `buyerrecon_prod_collector_app` and compatibility has not been proven.
  - PR#17j does **not** treat an `initDb()` failure as ordinary "schema drift" — the failure mode here mixes schema state with role-privilege state, and "drift" framing would invite the wrong fix (broadening the role).
  - PR#17j does **not** authorise "start the service to see what happens".

Resolution paths (see §24 for the corresponding next-PR slots):

- **Path A — Code/runbook PR that gates or bypasses runtime `initDb()` for production.** Examples: an env-flag-driven skip (`SKIP_INIT_DB`), or making `initDb()` conditional on connected role, or relocating schema bootstrap to an explicit migrator-only entrypoint. Requires its own review and merge.
- **Path B — Operator preflight that proves `initDb()` startup succeeds under `buyerrecon_prod_collector_app` without new privileges and without writes.** Performed outside production traffic; recorded in its own proof PR. Must exercise every DDL statement in `src/db/schema.sql` as the deployed runtime role with the deployed grants, and demonstrate clean idempotent execution.
- **Path C — Deployment strategy that starts the service using a safe startup path that does not execute schema bootstrap under the runtime role.** Example: schema bootstrap is performed ahead of time by the migrator role; the runtime service is started against a build whose `initDb()` is not invoked (either via flag or via a startup wrapper).

The §10 service deployment phase, the §11 health check, the §12 DB target verification (insofar as it depends on a running service), the §13 log/secret scan (insofar as it depends on a running service), and the §14 zero-traffic post-deployment check all remain **DEFERRED** until Path A, B, or C is closed.

### Chosen strategy (template only — operator confirms at execution time)

The runbook does **not** pin one strategy; the operator uses whichever of the two existing primitives is consistent with the production host's existing practice. **Until §1.1 / §9.1 is closed, neither strategy may be used to start the production service.** Both strategies remain available to support deployment-prerequisite preparation (e.g. confirming the build path, validating the env-file shape) without process start.

- **Strategy A — Node + process manager.** Operator: builds (`npm ci --omit=dev` + `npm run build`) on the build host (or on production host if that is the established practice), publishes the build artifact to `<PRODUCTION_APP_DIR>/releases/<release-id>/`, flips a `current` symlink, restarts `<PRODUCTION_SERVICE_NAME>` via `<PRODUCTION_PROCESS_MANAGER>` so it runs `node dist/server.js` with the production env file `<PRODUCTION_ENV_FILE>`. **Service start step is BLOCKED under PR#17j until §1.1 / §9.1 closure.**
- **Strategy B — Docker image.** Operator: builds the production image via the repo's `Dockerfile`, pushes to the approved registry (no public registry that would expose images), pulls on the production host, runs as a non-root user with `<PRODUCTION_ENV_FILE>` mounted or `--env-file` referenced. **`docker run` against the production data plane is BLOCKED under PR#17j until §1.1 / §9.1 closure.**

Both strategies must satisfy:

- **build does not run DB migrations or production commands** (the repo `build` is `tsc` only — confirmed),
- **build does not embed secrets** (env is read at process startup, not baked into the image / artifact),
- **no real DATABASE_URL or pepper value lands in any build artifact or build log**,
- **`dist/db/schema.sql` is always the build's freshly-copied artifact from `src/db/schema.sql`** (per PR#17i; do not commit a `dist/db/schema.sql`; do not edit it in place),
- **neither strategy starts the production service while §1.1 / §9.1 is OPEN.**

---

## 10. Service deployment phase

### Phase 0 — Deployment-prerequisite preparation and preflight planning (allowed under PR#17j)

This phase is labelled:

> **RUN ONLY AFTER MERGE + HELEN FINAL GO (gate-aware GO per §2).**

The §1.1 / §9.1 BLOCKER does **not** prevent the operator from completing the steps below; none of them start the production collector process or generate traffic. Their purpose is to ensure that when (and only when) the §1.1 BLOCKER is closed in a future PR, the actual deployment can proceed cleanly.

1. **Confirm pre-execution checks (§8).** All PASS. If any FAIL, stop.
2. **Re-affirm the §1.1 BLOCKER is still OPEN** (i.e. no Path A / B / C closure PR has merged yet). If it is closed, switch to the corresponding closure PR's runbook (it supersedes Phase 1 here) and do not proceed under the open-gate scope.
3. **Retrieve secrets from the approved vault without printing.** Secrets land directly into `<PRODUCTION_ENV_FILE>` via the vault tool; no value is echoed to stdout or to shell history.
4. **Write or update `<PRODUCTION_ENV_FILE>` with correct permissions.** Ownership is the deploy user (or root if the chosen process manager requires); permission is `0600`. The file is **not** in any git working tree.
5. **Confirm `<PRODUCTION_ENV_FILE>` is not in git.** `git ls-files | grep -F <PRODUCTION_ENV_FILE>` returns empty (and the file is outside the repo tree anyway).
6. **Install / build the production artifact** using the chosen strategy from §9. No env is interpolated into the artifact; no real secret appears in build logs. **Do not start the process.**
7. **Confirm the build artefact's `initDb()` invocation path is unchanged** (i.e. the runtime still calls `initDb()` at startup). This is a categorical PASS / FAIL recording; it is the verification that §1.1 / §9.1 still applies. If a Path A code change has shipped before PR#17j execution, the operator references that change's runbook instead.
8. **Pre-stage rollback levers** (per §16) so they are ready for the day Phase 1 is unblocked.
9. **Outline the `initDb()` startup-compatibility preflight plan** (Path B candidate): which non-production target will host the preflight, which exact role and grant set will be used, which DDL statements will be exercised, what categorical PASS / FAIL output is expected, and how the preflight will avoid any write to `accepted_events` / `rejected_events` / `ingest_requests` / `scoring_output_lane_a` / `scoring_output_lane_b`. The plan is recorded in the proof report; the preflight itself is **not** executed under PR#17j (it requires its own approved successor PR — see §24).

### Phase 1 — Production collector service start (BLOCKED under PR#17j)

> **DEFERRED. RUN ONLY AFTER (a) merge + Helen final GO, AND (b) the §1.1 / §9.1 `initDb()` startup-compatibility BLOCKER is closed by a separately approved Path A / B / C PR or preflight.**

While the BLOCKER is OPEN, the operator may not perform any of the steps below under PR#17j. They are documented here so the eventual deployment PR (the successor that runs after §1.1 closure) can reference exactly the verification posture this runbook expects.

1. **Start or restart the production collector service** via the chosen process manager — **BLOCKED**.
2. **Verify service process is running** (categorical PASS / FAIL: process present, expected user, expected start time) — **BLOCKED**.
3. **Verify logs have no secrets** (§13) — **BLOCKED**.
4. **Verify health endpoint (§11)** — **BLOCKED**.
5. **Verify service DB target is `buyerrecon_production` without printing the DB URL (§12)** — **BLOCKED** (insofar as it depends on a running service; the parallel one-shot DB introspection variant of §12 remains available under Phase 0 because it does not require the service to be running).

The operator does not execute any step of Phase 1 under PR#17j. If the operator finds themselves about to run a Phase 1 step under PR#17j scope, that is a §22 stop-the-line.

### Command templates (placeholders only; **the `restart`/`docker run` steps below are Phase 1 — BLOCKED under PR#17j until §1.1 / §9.1 closure**)

The build / env / artefact-staging parts of these templates are Phase 0 (allowed under PR#17j with a gate-aware GO per §2). The service-start parts are Phase 1 (DEFERRED).

Strategy A (Node + process manager) skeleton:

```
# All secrets sourced from the approved operator vault; never paste raw values.
<VAULT_TOOL> render --to-file <PRODUCTION_ENV_FILE> --owner <DEPLOY_USER> --mode 0600
ls -l <PRODUCTION_ENV_FILE>                # confirm owner / mode 0600
git ls-files | grep -F "$(basename <PRODUCTION_ENV_FILE>)" || echo "env file not in git (expected)"

cd <PRODUCTION_APP_DIR>/releases/<RELEASE_ID>
npm ci --omit=dev
npm run build                              # tsc; no DB action

# Restart the supervised service. The process manager loads <PRODUCTION_ENV_FILE>.
<PRODUCTION_PROCESS_MANAGER> restart <PRODUCTION_SERVICE_NAME>

# Confirm it is up.
<PRODUCTION_PROCESS_MANAGER> status <PRODUCTION_SERVICE_NAME>
```

Strategy B (Docker) skeleton:

```
# Build (on build host or production host, per established practice).
docker build -t <PRODUCTION_IMAGE_REF> .

# Push / pull via the approved registry (no public registry).
docker push <PRODUCTION_IMAGE_REF>
docker pull <PRODUCTION_IMAGE_REF>

# Run as non-root, with the env file mounted via --env-file.
docker run --detach \
  --name <PRODUCTION_SERVICE_NAME> \
  --user <NON_ROOT_UID>:<NON_ROOT_GID> \
  --env-file <PRODUCTION_ENV_FILE> \
  --publish <COLLECTOR_BIND_ADDRESS>:<COLLECTOR_PORT>:3000 \
  <PRODUCTION_IMAGE_REF>

docker ps --filter "name=<PRODUCTION_SERVICE_NAME>"
```

**No command in this doc contains a real DATABASE_URL, a real pepper, a real token, a real password, a real private IP, or a real registry credential.**

---

## 11. Health check proof

After service start, verify the health endpoint:

- **Endpoint:** `<HEALTH_URL>` resolves to `GET /health` on the production collector.
- **Expected status:** HTTP `200` with body `{ status: "ok", timestamp: "<ISO8601>" }` (per `src/app.ts:102`).
- **The response must not expose secrets, DB URL, tokens, peppers, role names tied to credentials, or private IPs.** The endpoint shipped in `src/app.ts` discloses none of these; if a later code change adds disclosure, **stop** and follow §17.
- **The response should identify environment safely** if such a field is added in a future PR (e.g. a literal `"environment": "production"` string with no infrastructure detail). PR#17j does not add such a field; the operator records the response shape as-shipped.
- **The health proof must not generate collector events.** `/health` does not write to `ingest_requests` / `accepted_events` / `rejected_events`; confirm against §14 zero-traffic posture.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Use an internal hostname (non-public) appropriate to the host. Mask any
# host/IP detail in the recorded proof.
curl -fsS <HEALTH_URL>
# Expected: {"status":"ok","timestamp":"<ISO8601>"}
```

The operator records categorical PASS / FAIL only; the raw `<HEALTH_URL>` is masked in the proof report.

---

## 12. DB target verification proof

The operator must prove the collector connects to `buyerrecon_production` (via `buyerrecon_prod_collector_app`) and **not** to `buyerrecon_staging` and **not** to Render legacy — **without printing the `DATABASE_URL`**.

Safe verification techniques. **Important: techniques that require the collector service to be running are Phase 1 and are BLOCKED under PR#17j until §1.1 / §9.1 closure. The parallel one-shot DB-introspection technique below is Phase 0 and is allowed under PR#17j.**

- **(Phase 0 — allowed.) Parallel one-shot DB introspection.** The operator runs a separate, read-only one-shot DB session (outside the collector process) using the same vault DSN: `select current_database(), current_user;` and records categorical PASS / FAIL with the DSN never printed. This is read-only, does **not** require the collector to be running, and does **not** generate collector events. Under PR#17j this is the primary technique for proving the production vault DSN resolves to `buyerrecon_production` as `buyerrecon_prod_collector_app`.
- **(Phase 0 — allowed.) Env-file inspection on the production host** (per §7): a process-tree or env-dump that shows variable **names only** (e.g. `systemctl cat <PRODUCTION_SERVICE_NAME> | grep -E '^Environment(File)?=' | sed 's/=.*$/=…masked…/'`) — confirms `<PRODUCTION_ENV_FILE>` is wired into the unit definition without revealing values. Does not require the service to be running.
- **(Phase 1 — BLOCKED.) Read the env of a running service process.** If, after §1.1 closure, the service is running, the operator may inspect the running process env (`systemctl show <PRODUCTION_SERVICE_NAME>` / `docker inspect <PRODUCTION_SERVICE_NAME>`) to confirm `DATABASE_URL` is set — values masked. **Not available under PR#17j scope while the service start is BLOCKED.**
- **(Phase 1 — BLOCKED.) Parse a structured startup log line.** Available only once §1.1 closure and Phase 1 service start have produced startup logs.
- **(Phase 0 — allowed.) Cross-check the negative case:** the parallel one-shot DB introspection above confirms the resolved DB name is `buyerrecon_production`, not `buyerrecon_staging`. Combined with the production / staging connection separation matrix from PR#17h §12 (re-confirmed in §8), this proves the DSN cannot accidentally land on staging.

### Default: no collector write smoke in PR#17j

- **PR#17j does not require any `INSERT` into `ingest_requests` / `accepted_events` / `rejected_events` / `scoring_output_lane_a` / `scoring_output_lane_b`** to prove the DB target.
- **No collector write smoke is approved in PR#17j.** Any future write smoke is gated by a separately approved PR / GO (see §15).

---

## 13. Log and secret scan proof

After the service starts, the operator inspects logs from a sample window:

- **Startup success line** is present (categorical: process started, listening on `<COLLECTOR_PORT>`).
- **No `DATABASE_URL` printed** anywhere in the captured logs.
- **No raw tokens** printed.
- **No token hashes / prefixes** printed.
- **No peppers** (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, `PROBE_ENCRYPTION_KEY`) printed.
- **No role passwords** printed.
- **No private IPs** printed in the **shared** proof. (Internal logs may carry private IPs for diagnostics; what crosses into the proof report is masked.)
- **No PII** printed (no email, no full address, no payload bodies with identity).
- **No Track A markers** (no QA / test / bot / synthetic / adversary string).
- **No AMS Trust Core output** printed.

The proof report carries only **safe summaries** (line counts, categorical "no secret pattern matched", explicit named-pattern PASS / FAIL). If any secret-like material is found in logs, **stop** and follow §17.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Inspect a sample window from the service logs; mask any captured output.
# The exact log access mechanism depends on <PRODUCTION_PROCESS_MANAGER>.
# Run a forbidden-pattern scan over the captured snippet, e.g.:
grep -E '(postgres://|SITE_WRITE_TOKEN_PEPPER|IP_HASH_PEPPER|PROBE_ENCRYPTION_KEY|password=|token=|hash=[a-f0-9]{16,}|10\.[0-9]+\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' <CAPTURED_LOG_SAMPLE> \
  && { echo "BLOCKER: forbidden pattern in logs"; exit 1; } \
  || echo "log scan PASS"
```

The operator captures `<CAPTURED_LOG_SAMPLE>` as a transient artefact on the operator's machine only; it does **not** enter the repo, the proof report, or chat.

---

## 14. Zero-traffic preservation

The operator records production row counts **before** and **after** the deployment phase:

| Surface | Expected before | Expected after |
|---|---|---|
| `accepted_events` | 0 | 0 |
| `rejected_events` | 0 | 0 |
| `ingest_requests` | 0 | 0 |
| `scoring_output_lane_a` | 0 | 0 |
| `scoring_output_lane_b` | 0 | 0 |
| `site_write_tokens` | 5 | 5 |
| `site_write_tokens.last_used_at` (all rows) | NULL | NULL |

Constraints:

- **`accepted_events` / `rejected_events` / `ingest_requests` remain 0** unless a separately approved internal controlled smoke (§15) is explicitly included in Helen's final-GO scope. PR#17j default scope excludes any smoke.
- **`site_write_tokens` remains 5.** PR#17j does not insert, update, disable, or revoke any token.
- **Lane A/B tables remain 0.** The PR#17g grant-safety state prevents any non-migrator role from writing; the collector role has no Lane A/B grants.
- **`last_used_at` remains NULL** for all five tokens if no collector auth traffic has occurred. PR#17j does not generate auth traffic.

Any deviation is a §17 incident.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**, run from the production-tagged vault DSN, with output masked):

```
psql "<MASKED_DATABASE_URL>" -At -c "
  select
    (select count(*) from accepted_events)       as accepted_events,
    (select count(*) from rejected_events)       as rejected_events,
    (select count(*) from ingest_requests)       as ingest_requests,
    (select count(*) from scoring_output_lane_a) as scoring_output_lane_a,
    (select count(*) from scoring_output_lane_b) as scoring_output_lane_b,
    (select count(*) from site_write_tokens)     as site_write_tokens,
    (select count(*) from site_write_tokens where last_used_at is not null) as tokens_used;
"
```

---

## 15. Optional internal controlled smoke posture

**Default posture: no smoke in PR#17j.**

- **No collector write smoke** is approved in PR#17j default scope.
- **No browser traffic.**
- **No ThinLayer traffic.**
- **No Track A** (deferred to PR#17e under separate explicit GO).
- **No production website traffic.**
- **No live customer path.**

If a future, narrowly-scoped internal controlled smoke is desired, it must be the subject of a separate explicit GO message (or an updated final-GO that names the smoke explicitly). PR#17j does not pre-approve any such smoke; introducing one without an explicit GO is a §22 stop-the-line.

---

## 16. Rollback plan

Rollback is performed by the operator at first sign of trouble; it is reversible and non-destructive.

**Phase 0 default state.** While the §1.1 / §9.1 BLOCKER is OPEN, the production collector service is **not running**. The default rollback state for PR#17j is therefore "service is not running, no traffic, no Lane A/B writes, no ledger writes" — already the desired state — so Phase 0 rollback is mostly an env / artefact rollback rather than a service-stop. Concretely:

- **Phase 0 rollback steps (allowed under PR#17j):**
  - Remove or vault-overwrite any `<PRODUCTION_ENV_FILE>` that was staged (mode 600, root/deploy-user-owned) if the staging itself proved problematic.
  - Drop any pre-staged build artefact from `<PRODUCTION_APP_DIR>/releases/<release-id>/` if it should not persist.
  - Confirm the production collector service is **not** running.
  - Confirm row counts per §14 are unchanged.
- **Phase 1 rollback steps (DEFERRED with Phase 1):** the steps below describe the rollback the successor (post-§1.1-closure) deployment PR will follow. They are not invoked under PR#17j scope.
  - **Stop the service** via the chosen process manager (`<PRODUCTION_PROCESS_MANAGER> stop <PRODUCTION_SERVICE_NAME>`).
  - **Restore the previous service config** if one exists (e.g. flip the `current` release symlink back, restore the prior `<PRODUCTION_ENV_FILE>` from the vault; if no prior config exists — this is the first deployment of this service — the rollback is simply "service is not running").
  - **Remove or disable public exposure** if needed (e.g. revoke any DNS / firewall opening — note PR#17j default scope already excludes live ThinLayer-facing exposure).

Regardless of phase:

- **Do not delete the production DB.** `buyerrecon_production` and its contents stay intact.
- **Do not delete evidence ledgers.** `ingest_requests`, `accepted_events`, `rejected_events` are not truncated or dropped. (They are zero anyway under §14 zero-traffic posture.)
- **Do not disable `site_write_tokens`** unless a secret exposure occurs (in which case follow §17 token-revocation path).
- **If a secret leaks**, rotate / revoke the affected secret per the vault's procedure; record the incident in the proof report.
- **Do not broaden `buyerrecon_prod_collector_app` privileges as a rollback workaround.** If a Phase 1 rollback was triggered by an `initDb()` failure (in a future, post-§1.1-closure execution), the response is to roll back, not to grant DDL to the runtime role.
- **Render legacy remains unaffected.** Render legacy collector and Render legacy DB continue to be the live capture / archive surface; nothing PR#17j does touches Render.

After rollback, the operator records the rollback in the proof report (§18) and opens a follow-up issue / PR before any retry.

---

## 17. Incident path

The following are incidents — on any occurrence, the operator stops, preserves evidence, notifies Helen, does not continue, rolls back the service if needed, rotates / revokes if a secret is involved, and creates a follow-up issue / PR.

- **Service uses staging DB** (the DSN resolves to `buyerrecon_staging`).
- **Service cannot connect to production DB.**
- **Service logs a secret** (DSN, password, raw token, token hash / prefix, pepper, private IP in shared proof).
- **Health endpoint exposes sensitive info** (anything beyond `status` / `timestamp` as currently shipped).
- **`accepted_events` / `rejected_events` / `ingest_requests` row count changes unexpectedly** during PR#17j default-scope execution (these should stay 0 — see §14).
- **`site_write_tokens.last_used_at` changes unexpectedly** (no token should validate during PR#17j default scope).
- **Lane A/B table receives rows** (Lane A/B writer grant safety from PR#17g is supposed to prevent this; any deviation is a serious incident).
- **Customer-facing output appears** (Pass 1 / Trust / Pass 2 are unimplemented — there must be no customer-visible automated artefact).
- **`initDb()` failure observed on a future Phase 1 service start** (see §1.1 / §9.1). Treat as a **conflated schema-and-privilege incident**, *not* as ordinary schema drift. **Do not broaden `buyerrecon_prod_collector_app` privileges. Do not grant DDL to the runtime role.** Roll back, record the incident, and route the fix through a Path A / B / C closure PR (per §1.1 / §24).
- **Proposed broadening of `buyerrecon_prod_collector_app` privileges** (DDL grant, `createdb`, `createrole`, superuser, addition to a DDL group role) as a "quick fix" for an `initDb()` failure or any other operational issue. Stop and re-plan; the fix never lives in privilege-broadening.
- **Attempted Phase 1 service start while §1.1 / §9.1 is OPEN.** Stop immediately. Do not start the service "to see what happens" (per §1.1 / §9.1).
- **Operator uncertainty** about whether the runbook is proceeding sanely.

Standard response: **stop, preserve, notify Helen, do not continue, record the incident, rotate / revoke if needed.**

---

## 18. Proof report format

Proof fields (categorical values only; **no raw secrets, no DSN, no tokens, no hashes, no prefixes, no peppers, no private IPs, no PII, no raw log bodies**):

- **Execution approval reference** — the merged PR (`PR#17j`), Helen's recorded final-GO message (timestamp and location of the message; no quoting of any sensitive content).
- **Operator** — identifier of the human who executed the runbook.
- **Start / end time.**
- **Repo HEAD** at execution time (the merge commit hash of PR#17j).
- **Service name** (`<PRODUCTION_SERVICE_NAME>` placeholder name resolved to the actual name).
- **Deployment strategy** — A (Node + process manager) or B (Docker), per §9; one chosen.
- **Environment categories set / missing** — per §7 proof posture (set / missing per category; length only for peppers; DB name / DB user only from `DATABASE_URL`; host category only).
- **DB target category (masked)** — "Sprint 2 production Postgres, database `buyerrecon_production`, user `buyerrecon_prod_collector_app`". No DSN, no host, no port.
- **Production / staging separation result** — PASS / FAIL per §4 / §8 / §12 checks.
- **Health endpoint result** — PASS / FAIL per §11.
- **Log / secret scan result** — PASS / FAIL per §13.
- **Row counts before / after** — per §14 (a single integer per surface; deviation flagged).
- **`site_write_tokens` metadata count / `last_used_at` posture** — categorical: "5 rows, all `disabled_at IS NULL`, all `last_used_at IS NULL`" (or the actual observed values, masked).
- **Lane A/B no-writer posture** — categorical PASS confirmation that `scoring_output_lane_a` / `scoring_output_lane_b` have zero rows and that PR#17g grant-safety still holds.
- **Anomalies** — any non-PASS observation, with categorical description.
- **Rollback readiness** — confirmation that §16 paths are available and pre-staged.
- **Explicit non-events** (all PASS — none occurred):
  - **no ThinLayer cutover**,
  - **no DNS change**,
  - **no Track A**,
  - **no Playwright**,
  - **no traffic generation**,
  - **no customer-facing output**.

The proof report is committed as `PR#17j-proof` (or `PR#17k`) per §24.

---

## 19. Output-gate restrictions

- **PR#17j does not create customer-facing output.**
- **PR#17j does not approve customer-facing automated scores.**
- **No durable Lane A/B writers** — PR#17g grant-safety remains in force; PR#17j does not change it.
- **No Lane B exposure.** Lane B internal hypotheses stay internal.
- **No AMS Trust Core output** exposure through BuyerRecon.
- **No AMS runtime bridge.** PR#14 ProductFeatures bridge candidate remains record-only.
- **No Pass 1 / Pass 2 implementation.**
- **Evidence Snapshot and Lane A/B preview remain internal-only.**

---

## 20. Relationship to PR#17d and PR#17e

- **PR#17j covers deployment-prerequisite preparation and preflight planning only; production service start is deferred** until §1.1 / §9.1 closure. It does not cut endpoint, does not run Track A, does not produce customer-visible artefacts.
- **PR#17d governs future `buyerrecon.com` canary endpoint cutover.** PR#17d's runbook is the canonical procedure for moving live ThinLayer traffic to the Sprint 2 production collector. PR#17j does not execute PR#17d.
- **PR#17e governs future Track A unlabelled `B_analytics_only` proof.** PR#17e's plan is the canonical procedure for a narrow unlabelled programmatic proof. PR#17j does not execute PR#17e.
- **PR#17j does not cut endpoint and does not run Track A.**

---

## 21. Success criteria

PR#17j's success criteria are scoped to the BLOCKED posture described in §1.1 / §9.1. While the §1.1 / §9.1 BLOCKER is OPEN, PR#17j is considered successful if **all** of the following hold:

- **The runbook captures deployment prerequisites** (PR#17h state re-affirmed per §8; build / package strategy chosen categorically per §9; env-file shape and vault sourcing posture per §7; rollback levers pre-staged per §16).
- **The `initDb()` startup-compatibility risk is explicitly identified** (per §1.1 and §9.1) and acknowledged in any proof artefact PR#17j produces.
- **Production collector service start is deferred** (Phase 1 in §10 is not executed) until §1.1 / §9.1 is closed by a separately approved Path A / B / C PR or operator preflight.
- **No runtime role privilege broadening** (no DDL grant, no `createdb` / `createrole` / superuser, no DDL group membership for `buyerrecon_prod_collector_app`).
- **No deployment execution approved yet** — Phase 1 service start remains a future activity governed by a successor PR.
- **Zero-traffic counts preserved** (per §14 — production rows on `ingest_requests` / `accepted_events` / `rejected_events` / `scoring_output_lane_a` / `scoring_output_lane_b` remain 0; `site_write_tokens` remains 5; all `last_used_at` remain NULL).
- **No Lane A/B writes** (per PR#17g; row counts remain 0).
- **No customer-facing output.**
- **Rollback path documented and confirmed available** for both Phase 0 (env / artefact rollback) and Phase 1 (service stop / config restore — pre-staged but not exercised under PR#17j) per §16.
- **Proof report created** (per §18) with the BLOCKED posture, the chosen Path A / B / C candidate for closure, and PR#17j's Phase 0 outcomes only.

**After the §1.1 / §9.1 BLOCKER is closed by a separately approved Path A / B / C PR (per §24), the *successor* deployment PR — not PR#17j itself — will additionally verify:** production collector service is running (non-root, restart-on-failure); `GET /health` returns the expected shape (§11); service target is `buyerrecon_production` via running-service introspection (§12 Phase 1 variants); logs contain no secrets / tokens / hashes / prefixes / peppers / DSNs / private IPs (§13); no staging DB target; zero-traffic counts preserved post-start; no Lane A/B writes; no customer-facing output; rollback path exercised in test if appropriate; proof closure for the deployment.

If any item in the BLOCKED-posture criteria above is not satisfied, PR#17j's execution is not a success; the operator either follows §16 / §17 or escalates per Helen's direction.

---

## 22. Stop-the-line conditions

Stop and re-plan if any of the following appears at any point during authoring, review, or execution of PR#17j:

- **Helen final GO is missing or ambiguous** (recorded GO message does not match the §2 expected wording or unambiguous equivalent).
- **Repo HEAD is not the approved base** at execution time.
- **Service target DB cannot be proven as `buyerrecon_production`** (or DSN handling at execution time would require printing the DSN).
- **Service points to `buyerrecon_staging`** or to Render legacy.
- **Any secret appears in shared logs / proof / terminal transcripts destined for sharing.**
- **Health endpoint exposes sensitive info** (env, DSN, token, role, private IP).
- **Deployment requires DNS or ThinLayer change** (PR#17j default scope excludes these; introducing one without explicit GO is a stop).
- **Deployment generates traffic** without explicit approval (PR#17j default scope is zero-traffic).
- **Track A is proposed** as part of PR#17j (Track A is PR#17e's scope under its own GO).
- **`accepted_events` / `rejected_events` / `ingest_requests` row counts change unexpectedly** during default-scope execution.
- **Lane A/B table receives rows.**
- **Customer-facing output appears.**
- **Attempted Phase 1 production service start while the §1.1 / §9.1 BLOCKER is OPEN** (per §10 Phase 1: BLOCKED under PR#17j).
- **`initDb()` failure on a future Phase 1 service start** (per §1.1 / §9.1 / §17). Treat as conflated schema-and-privilege incident; **do not broaden role grants**; route the fix through a Path A / B / C closure PR.
- **Proposed broadening of `buyerrecon_prod_collector_app` privileges** (DDL grant, `createdb`, `createrole`, superuser, DDL group membership) as a workaround for any operational issue.
- **`SKIP_INIT_DB` / Path A / Path C wiring is proposed inline as part of PR#17j** without a separate approved code PR. PR#17j is docs-only and does not ship code changes; any Path A / C closure must come via its own approved PR.
- **Operator uncertainty exists** about whether the runbook is proceeding sanely.

Stop-the-line means: do not continue, follow §16 / §17, and request a follow-up decision from Helen before any further action.

---

## 23. What PR#17j explicitly does not approve

PR#17j explicitly does **not** approve any of the following:

- execution of any runbook step **before** gates 1–4 in §2 are satisfied (draft PR → Codex review PASS → merged → Helen final GO recorded),
- **production collector service start (Phase 1 in §10) while the §1.1 / §9.1 `initDb()` startup-compatibility BLOCKER is OPEN**,
- **broadening `buyerrecon_prod_collector_app` privileges** in any form (DDL grant, `createdb`, `createrole`, superuser, DDL group membership) — neither as a fix for an `initDb()` failure nor for any other reason,
- **granting DDL to the runtime collector role** under any circumstances,
- **starting the service "to see what happens"** under PR#17j scope (the only authorised paths to a Phase 1 start are via §1.1 Path A / B / C closure PRs),
- **treating an `initDb()` failure as ordinary schema drift** after attempting a Phase 1 start; the response is rollback + Path A / B / C closure, not privilege broadening,
- ThinLayer `endpointUrl` cutover on any live site,
- any DNS change,
- `buyerrecon.com` canary cutover,
- all-site cutover,
- Track A execution,
- Playwright execution,
- browser / live production traffic generation,
- DB creation,
- migration execution,
- role creation,
- token creation,
- token rotation,
- Render shutdown,
- Render legacy data migration,
- customer-facing automated output,
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output,
- implementation of Pass 1 or Pass 2 governance.

These remain for explicitly-scoped successor PRs.

---

## 24. Recommended next PRs

PR#17j recommends the following successor PRs, each tightly scoped:

- **PR#17j-1 (or PR#17k) — Production `initDb()` startup-compatibility closure** (the §1.1 / §9.1 BLOCKER). This PR must close the BLOCKER via **one** of the §1.1 paths:
  - **Path A** — a small code change that gates or bypasses runtime `initDb()` for production (e.g. `SKIP_INIT_DB` env flag, role-aware bootstrap, or a separate migrator-only entrypoint). Requires its own review.
  - **Path B** — an operator preflight proof that `initDb()` startup succeeds under `buyerrecon_prod_collector_app` without new privileges and without writes, performed outside production and recorded in its own proof PR.
  - **Path C** — a deployment strategy / runbook change that starts the production service via a safe startup path that does not execute schema bootstrap under the runtime role.
  Until this PR (or an equivalent) merges, PR#17j Phase 1 (production service start) remains DEFERRED.
- **PR#17j-deploy (or PR#17l) — Actual production collector deployment and operator proof.** Only after PR#17j-1 / PR#17k closes the §1.1 BLOCKER. Executes Phase 1 of §10 and records the running-service variants of §11, §12, §13, §14. Only if Helen explicitly approves with the corresponding final-GO message (the second wording in §2).
- **PR#17j-proof (or another suitable slot) — PR#17j Phase 0 proof closure** if Helen authorises Phase 0 (preparation / preflight planning only) execution before §1.1 closure. Records the §18 fields scoped to BLOCKED posture.
- **Future `buyerrecon.com` canary endpoint cutover execution** following PR#17d's runbook — only after Phase 1 is successfully completed in PR#17j-deploy, and only if Helen explicitly approves with the corresponding final-GO message.
- **Future Track A `B_analytics_only` execution proof** following PR#17e's plan — only if Helen explicitly approves with the corresponding final-GO message.
- **Future low-dwell / refresh-loop / adversarial CTA Track A plans** — only after the first `B_analytics_only` proof passes and is reviewed.
- **Future output-gate planning** (separate PR sequences):
  - Pass 1 eligibility planning,
  - Trust Core bridge planning,
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 25. Acceptance criteria

PR#17j is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17j-production-collector-deployment-operator-proof.md`,
- the document's **status is clearly stated as "runbook authoring is docs-only AND production collector service start is DEFERRED"** (top-of-doc status line; §1 / §1.1 / §2),
- the **`initDb()` startup-compatibility risk is explicitly identified** in §1.1 / §9.1, with the precise mechanics (`src/server.ts:25-29` → `initDb()` → `src/db/schema.sql` → `pool.query` against `buyerrecon_prod_collector_app`) and the explicit statement that idempotent DDL is not guaranteed to be a clean no-op under a least-privilege non-DDL role,
- **production collector service start is gated as DEFERRED / BLOCKED** until §1.1 / §9.1 closure via a separately approved Path A / B / C PR or preflight (per §10 Phase 1 / §24),
- **no runtime role privilege broadening** is approved (no DDL grant, no `createdb` / `createrole` / superuser, no DDL group membership for `buyerrecon_prod_collector_app`) — §1.1, §9.1, §17, §22, §23,
- **no deployment execution is approved yet** — the only Phase 0 work Helen's final GO may authorise is deployment-prerequisite preparation and preflight planning (per §2 first GO wording, §10 Phase 0),
- **no execution occurs during PR authoring** — no DB connection, no role / token / secret creation or rotation, no migration run, no deploy, no DNS change, no `endpointUrl` change, no Render / Hetzner / AMS / Track A / Playwright touch, no traffic generation,
- **no code / runtime / schema changes** — no edits under `src/`, `scripts/`, `migrations/`, `package.json`, tests, or any non-`docs/` file,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no token prefixes, no role passwords, no peppers, no private IPs, no certificate material,
- the deployment runbook includes **DB target verification** without DSN disclosure (§12), with the Phase 0 (parallel one-shot introspection) and Phase 1 (running-service introspection) variants clearly separated,
- **zero-traffic preservation is included** (§14),
- **log / secret scan is included** (§13),
- **rollback is included** (§16), with Phase 0 (env / artefact rollback) and Phase 1 (service stop / config restore — DEFERRED) variants clearly separated,
- **output-gate restrictions are included** (§19),
- **no cutover or Track A execution is approved** (§5, §20, §23),
- **recommended next PRs include the `initDb()` closure PR before the actual deployment proof PR** (§24 — PR#17j-1 / PR#17k for closure; PR#17j-deploy / PR#17l for the actual deployment).

---

End of PR#17j runbook authoring. **Authoring is docs-only. Production collector service start is DEFERRED until the §1.1 / §9.1 `initDb()` startup-compatibility BLOCKER is closed by a separately approved PR or preflight.**
