# BuyerRecon Sprint 2 PR#17l — Production Collector Deployment / Operator Proof

Status: **execution-approved operator runbook, but execution is gated**. Authoring of PR#17l is **docs-only**. The runbook below may be executed by the operator **only after** this PR is reviewed (Codex PASS), merged, *and* Helen records the explicit "final GO" message described in §2 — which **must** include the `SKIP_DB_INIT=true` confirmation.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `46540ce` — PR#17k merged, "add initDb startup compatibility").

PR branch: `buyerrecon-sprint2-pr17l-production-collector-deployment-proof`

---

## 1. Purpose

PR#17l defines the **execution-approved operator runbook / proof** for starting the Sprint 2 production collector service against the already-prepared production data plane (production DB, production collector login role, production `site_write_tokens`, production / staging separation — established by PR#17f, proved by PR#17h, with PR#17g's Lane A/B grant safety in force and PR#17k's `SKIP_DB_INIT=true` guard available).

Concretely, PR#17l execution (after the §2 gates close) will:

- build / package the Sprint 2 collector for production using existing repo build primitives (`npm run build` → `tsc`; `npm start` → `node dist/server.js`),
- configure the production environment from approved vault / secret manager values, including the mandatory `SKIP_DB_INIT=true` (exact literal) so runtime schema bootstrap is skipped,
- start the production service on the approved production host so it connects to `buyerrecon_production` as `buyerrecon_prod_collector_app`,
- verify service health (`GET /health`),
- verify service logs (no secret / DSN / token / pepper / private-IP disclosure),
- verify the DB target is `buyerrecon_production` (and **not** `buyerrecon_staging`, **not** Render legacy) **without printing the DB URL**,
- verify zero-traffic preservation across `ingest_requests` / `accepted_events` / `rejected_events` / `scoring_output_lane_a` / `scoring_output_lane_b` / `site_write_tokens` (the latter remains at 5 with all `last_used_at` NULL),
- re-confirm the Lane A/B no-writer posture (PR#17g grant safety),
- produce a deployment / operator proof report consistent with the redaction posture of PR#17f / PR#17h / PR#17i / PR#17j / PR#17k.

PR#17l is **not** a planning-only PR. Once merged and once Helen records the §2 final GO, the operator is authorised to execute exactly this runbook.

PR#17l is also explicit about what it does **not** do, ever, regardless of merge or GO state:

- it does **not** execute anything during authoring or review,
- it does **not** cut any ThinLayer `endpointUrl` on any live site (`buyerrecon.com` included),
- it does **not** change live site traffic,
- it does **not** change DNS,
- it does **not** generate browser / live production traffic,
- it does **not** run Track A,
- it does **not** run Playwright,
- it does **not** enable any customer-facing automated output,
- it does **not** approve durable Lane A/B writers, an AMS runtime bridge, AMS Trust Core exposure, or Pass 1 / Pass 2 implementation,
- it does **not** broaden `buyerrecon_prod_collector_app` privileges (no DDL grant, no `createdb`, no `createrole`, no superuser, no DDL group membership),
- it does **not** treat the staging DB as production,
- it does **not** treat the Render legacy DB as the Sprint 2 canonical production DB.

Anything in PR#17l that resembles an instruction is a **runbook step the operator may execute only after the §2 gates are satisfied**.

---

## 2. Execution status and approval gates

PR#17l's execution status is governed by six sequential gates. The runbook is not executable until **all** of gates 1–4 have been satisfied; gate 5 is the execution; gate 6 is the closure.

1. **Draft PR created.** This document is committed to the PR branch `buyerrecon-sprint2-pr17l-production-collector-deployment-proof`.
2. **Codex review PASS.** PR#17l passes a narrow review against the constraints in §25 (and against the PR#17a–PR#17k architectural posture).
3. **PR merged.** The PR is merged into `sprint2-architecture-contracts-d4cc2bf`.
4. **Helen final GO recorded.** Helen records the explicit final-GO message (see expected wording below) in a durable place attached to this execution (PR comment, issue, runbook log entry). Until this message is recorded **verbatim or in unambiguous equivalent form, and explicitly includes `SKIP_DB_INIT=true`**, the runbook is not executable.
5. **Operator executes runbook** exactly as written in this document, against the named production target, recording each step's outcome.
6. **Proof closure PR / report created** (per §18), summarising what was executed and what was verified.

**Expected Helen final-GO wording (verbatim, or unambiguous equivalent):**

> "I approve executing PR#17l operator runbook now. Scope: production collector deployment / health / logging / DB-target verification only, with `SKIP_DB_INIT=true`. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live production traffic generation. No customer-facing output."

Governing rules:

- **Merge alone is not enough to execute.** Helen's final GO is the gate that distinguishes "runbook is canonical" from "runbook may run now".
- **The GO must explicitly include `SKIP_DB_INIT=true`.** A GO that omits this confirmation is a §22 stop-the-line — the §1.1 / §9.1 closure of PR#17j is conditional on this env value being set.
- **If the GO is ambiguous, do not execute.** Ask for an explicit GO message in the expected shape above.
- **If the GO omits any of the no-cutover / no-DNS / no-Track-A / no-Playwright / no-traffic / no-customer-output constraints, do not execute.** Each of these constraints carries forward from PR#17j and must be present in the active GO.
- The operator may not broaden scope beyond what the final-GO message authorises.

---

## 3. Inputs from PR#17f–PR#17k

PR#17f, PR#17g, PR#17h, PR#17i, PR#17j, and PR#17k are merged and govern PR#17l:

- **PR#17f — Production DB / migrations / roles / tokens execution** (`21ea5f2`). Execution-approved; executed under Helen final GO within scope (DB / migrations / roles / tokens / verification only). Produced `buyerrecon_production`, applied `src/db/schema.sql` baseline + `migrations/002_*.sql` through `migrations/015_*.sql`, created `buyerrecon_prod_collector_app`, provisioned 5 `site_write_tokens` under `workspace_id = keigen_prod_ws`.
- **PR#17g — Lane A/B grant safety correction** (`7b151d2`). `migrations/016_scoring_output_lane_grant_safety.sql` removes the durable Lane A/B writer privilege that migration 011 would otherwise have carried over; no durable Lane A/B writer is approved.
- **PR#17h — PR#17f production migration / operator proof** (`74a9532`). Records production DB created, baseline + migrations 002–016 applied, separation verified, 5 tokens provisioned, zero-traffic proof passed, no ThinLayer cutover, no Track A, no customer-facing output.
- **PR#17i — Schema baseline policy** (`dd42862`). `src/db/schema.sql` is canonical; `dist/db/schema.sql` is a gitignored Docker build artifact, never an independent source of truth. Operators always baseline from `src/db/schema.sql`.
- **PR#17j — Production collector deployment runbook** (`527ec6c`). Service start was deferred under PR#17j due to the `initDb()` startup-compatibility risk; PR#17k closed that risk (Path A).
- **PR#17k — `initDb()` startup-compatibility closure** (`46540ce`). Added `shouldSkipDbInit(env = process.env): boolean` to `src/db/client.ts` with **strict equality** to the exact literal `"true"`; guarded the `await initDb()` call in `src/server.ts:start()`; default behaviour unchanged. Production deployment must set `SKIP_DB_INIT=true` so runtime schema bootstrap is skipped. Runtime schema bootstrap remains disabled in production; `buyerrecon_prod_collector_app` must not receive DDL privileges.

PR#17l inherits all of these constraints and does not relax any of them.

---

## 4. Current production prerequisites

The runbook may be executed only if **every** prerequisite below is true at execution time. They are the proved state from PR#17f / PR#17h plus PR#17g / PR#17k closure, re-confirmed before deployment.

- `buyerrecon_production` exists.
- `src/db/schema.sql` baseline has been applied (per PR#17i canonical policy).
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
  - `site_write_tokens` = 5,
  - `site_write_tokens.last_used_at` = NULL for all five rows.
- Lane A/B writer grant safety (PR#17g) holds: `buyerrecon_scoring_worker` has no `SELECT` / `INSERT` / `UPDATE` / `DELETE` on either lane table; `buyerrecon_customer_api` has no `SELECT` on either lane table; `buyerrecon_internal_readonly` has `SELECT` and no `INSERT` / `UPDATE` / `DELETE` on either lane table; `buyerrecon_migrator` retains `ALL`.
- **PR#17k merged** (`46540ce`), so `shouldSkipDbInit()` exists in `src/db/client.ts` and `src/server.ts:start()` honours `SKIP_DB_INIT=true`.
- No ThinLayer cutover has happened on any live site.
- No Track A has run.
- No customer-facing output has been enabled.

If any prerequisite has changed since PR#17h closure (other than as documented by an intervening explicitly-approved PR), the operator stops and re-aligns before deployment.

---

## 5. Non-goals

PR#17l explicitly does **not** approve and does **not** perform any of the following — regardless of merge / GO state:

- ThinLayer `endpointUrl` cutover on any live site,
- DNS change (no `collector.buyerrecon.com` record creation / modification, no zone edit, no edge / CDN cutover),
- `buyerrecon.com` canary endpoint cutover (PR#17d governs that, not PR#17l),
- all-site cutover,
- Track A execution (PR#17e governs that, not PR#17l),
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
- implementation of Pass 1 or Pass 2 governance,
- broadening `buyerrecon_prod_collector_app` privileges (no DDL grant, no `createdb`, no `createrole`, no superuser, no DDL group membership).

---

## 6. Deployment target

The target is specified categorically here; actual values are confirmed at execution time and **masked** in the proof report. **No real private IPs, no DB URLs, no raw secrets, no certificate material, no credential-bearing values appear in this doc.**

- **Approved production host:** referenced as `<PRODUCTION_HOST>` (placeholder). The same host class established by PR#17f for the production data plane is preferred; deviation requires Helen's explicit GO.
- **Production app directory:** referenced as `<PRODUCTION_APP_DIR>` (placeholder). A dedicated, deploy-user-owned, release-versioned directory layout is preferred so rollback is a pointer flip rather than a re-clone.
- **Service / process manager:** referenced as `<PRODUCTION_PROCESS_MANAGER>` (placeholder). The repo provides Node entrypoints (`npm start` → `node dist/server.js`) and a multi-stage `Dockerfile`. The chosen process manager (e.g. `systemd`, `docker run` under a supervisor, `pm2`) follows existing host practice; PR#17l does not pin one.
- **Service name:** `<PRODUCTION_SERVICE_NAME>` (placeholder; e.g. `br-collector-prod`).
- **Production env file path:** `<PRODUCTION_ENV_FILE>` (placeholder). The file is **root-owned-or-deploy-user-owned, mode 0600**, **not** in git, **not** in chat, **not** in the proof report.
- **Log source:** `<LOG_SOURCE>` (placeholder; e.g. `journalctl -u <PRODUCTION_SERVICE_NAME>`, `docker logs <PRODUCTION_SERVICE_NAME>`, or file-path logs depending on host practice).
- **Service port:** `<PRODUCTION_PORT>` (placeholder; default is `PORT = 3000` per `src/server.ts:20`).
- **Health URL:** `<HEALTH_URL>` (placeholder). `GET /health` returns `{ status: "ok", timestamp: "<ISO8601>" }` per `src/app.ts:102`.
- **Build / deploy strategy:** chosen at execution time (Strategy A or B in §9), both compatible with PR#17i schema policy and PR#17k `SKIP_DB_INIT=true` requirement.

No real value above appears in this doc; all are placeholders. Final values must be **masked** in the proof artefact (categorical references only).

---

## 7. Required environment categories

The Sprint 2 production collector reads its env at startup. Required env categories (categories only — **no values for any category appear in this doc**):

- **`DATABASE_URL`** — production DSN for `buyerrecon_production`, using `buyerrecon_prod_collector_app`. Sourced from the approved vault. Never staging. Never Render legacy. Never committed.
- **`SKIP_DB_INIT`** — **must be set to the exact literal `true` (lowercase)** so the PR#17k guard (`shouldSkipDbInit()` in `src/db/client.ts`) skips runtime schema bootstrap. Any other value (including unset, `"false"`, `"FALSE"`, `"TRUE"`, `"True"`, `"1"`, `"0"`, `""`, `"yes"`, `" true "` with whitespace) will cause `await initDb()` to run and the production runtime role to attempt DDL — which is the §22 stop-the-line.
- **`SITE_WRITE_TOKEN_PEPPER`** — pepper used by token-validation (HMAC-SHA256 of raw token with this pepper produces `token_hash` per `migrations/006_site_write_tokens.sql`). Sourced from the approved vault.
- **`IP_HASH_PEPPER`** — pepper used by any IP-hashing path. Sourced from the approved vault.
- **`NODE_ENV`** — set to `production`.
- **`PORT`** — service bind port (default 3000 in code).
- **`ALLOWED_ORIGINS`** — explicit CORS allow-list (e.g. the five live site origins per `.env.example`).
- **`COLLECTOR_VERSION`** — current collector build / version string (per `.env.example`).
- **Logging configuration** — log level, structured format, retention, redaction policy if applicable.

Governing constraints:

- Secrets come from the **approved vault / secret manager**, never from the repo, chat, PR, terminal transcripts destined for sharing, or this docs file.
- The env file lives **outside the git tree** with **restrictive permissions** (mode `0600`, owned by the deploy user or root per the chosen process manager).
- The proof report may show only **masked category status** per env var:
  - `set` / `missing`,
  - for peppers and any key-shaped secret: byte/character length only (no value, no prefix),
  - for `DATABASE_URL`: the **database name** extracted from the URL (e.g. `buyerrecon_production`) without the full URL, user, password, host, or port,
  - for `DATABASE_URL`: the **DB user** name only (e.g. `buyerrecon_prod_collector_app`) without the password,
  - for `DATABASE_URL`: the **host category** only (e.g. "approved production Postgres host") without the private IP / hostname / port,
  - for `SKIP_DB_INIT`: confirmed `set` and **equal to the exact literal `true`** (not the value of any other env).

Any leakage of a real value into a proof artefact is a §17 incident.

---

## 8. Pre-execution checks

Performed by the operator immediately before deployment (these run after gates 1–4 are satisfied; they are read-only and produce no production change):

- **Repo HEAD equals the approved merged PR#17l base.** The operator confirms the checkout matches the merge commit of PR#17l at the time of GO.
- **Working tree is clean.** No uncommitted local changes.
- **PR#17k is merged** (the `shouldSkipDbInit()` helper exists in `src/db/client.ts`; `src/server.ts:start()` honours `SKIP_DB_INIT=true`). Source-shape spot check is acceptable — no DB connection required.
- **`SKIP_DB_INIT=true` is included in the planned production env** (`<PRODUCTION_ENV_FILE>`). Categorical PASS / FAIL recorded; value never echoed.
- **Production DB target exists.** `current_database() = buyerrecon_production` from a separate read-only verification session using the vault DSN; DSN never printed.
- **Production / staging separation remains correct** (the four cross-connection checks from §4 still pass; `PUBLIC CONNECT` remains revoked on both DBs).
- **`buyerrecon_prod_collector_app`** can connect to production and not to staging.
- **`buyerrecon_app`** can connect to staging and not to production.
- **`site_write_tokens` metadata** is intact: 5 active rows (`disabled_at IS NULL`), all `last_used_at IS NULL`, matching PR#17h §14.
- **Row counts** `accepted_events = 0`, `rejected_events = 0`, `ingest_requests = 0`, `scoring_output_lane_a = 0`, `scoring_output_lane_b = 0` before deployment.
- **Lane A/B no-writer safety still holds** (PR#17g grant matrix in §15 below).
- **No ThinLayer `endpointUrl` change** has been performed or is planned for PR#17l execution.
- **No DNS change** has been performed or is planned for PR#17l execution.
- **No Track A run** has occurred or is planned for PR#17l execution.

Each check is recorded categorically (PASS / FAIL) in the proof report.

---

## 9. Build / deploy strategy

PR#17l authoring inspected the repo to pin deploy primitives without inventing any:

- **`package.json` scripts:**
  - `"build": "tsc"` — compiles `src/` → `dist/` per `tsconfig.json` (`outDir: dist`, `rootDir: src`).
  - `"start": "node dist/server.js"` — runs the compiled entrypoint.
  - `"dev"` is dev-only and **not** used for production.
- **`Dockerfile` (multi-stage):**
  - Builder stage: `npm ci`, `COPY src/`, `RUN npx tsc`.
  - Runtime stage: `npm ci --omit=dev`, `COPY --from=builder /app/dist dist/`, `COPY src/db/schema.sql dist/db/schema.sql` (per PR#17i: `src/db/schema.sql` is canonical, `dist/db/schema.sql` is a build artifact hydrated from `src/`, never an independent source of truth).
  - Runtime command: `CMD ["node", "dist/server.js"]`.
- **`src/server.ts:start()` boot contract (post-PR#17k):**
  - `loadV1ConfigFromEnv()` runs inside `start()` and fail-fasts on missing `SITE_WRITE_TOKEN_PEPPER` / `IP_HASH_PEPPER`.
  - `shouldSkipDbInit()` checks `process.env.SKIP_DB_INIT === 'true'` (strict equality with the exact literal lowercase `true`).
    - If `true`: emits the single safe log line `Database schema bootstrap skipped by SKIP_DB_INIT=true` and **does not** call `initDb()`.
    - Otherwise: calls `await initDb()`, which would run `src/db/schema.sql` DDL through `pool.query` against the configured `DATABASE_URL` — the §1.1 / §9.1 risk that production deployment must avoid by setting `SKIP_DB_INIT=true`.
  - On success: `createApp({ pool, v1Loaded, allowed_origins })` is constructed and bound to `PORT`.

### Chosen strategy (template only — operator confirms at execution time)

- **Strategy A — Node + process manager.** Operator: builds (`npm ci --omit=dev` + `npm run build`) on the build host (or on production host per established practice), publishes the build artifact to `<PRODUCTION_APP_DIR>/releases/<release-id>/`, flips a `current` symlink, restarts `<PRODUCTION_SERVICE_NAME>` via `<PRODUCTION_PROCESS_MANAGER>` so it runs `node dist/server.js` with `<PRODUCTION_ENV_FILE>` (which **must** include `SKIP_DB_INIT=true`).
- **Strategy B — Docker image.** Operator: builds the production image via the repo's `Dockerfile`, pushes to the approved registry (no public registry that would expose images), pulls on the production host, runs as a non-root user with `<PRODUCTION_ENV_FILE>` mounted or `--env-file` referenced. `<PRODUCTION_ENV_FILE>` **must** include `SKIP_DB_INIT=true`.

Both strategies must satisfy:

- **build does not embed secrets** (env is read at process startup, not baked into the image / artifact),
- **build does not run DB migrations or production commands** (the repo `build` is `tsc` only),
- **build does not connect to the DB**,
- **production service env must set `SKIP_DB_INIT=true`** before service start,
- **the runtime role must not receive DDL privileges** (no `GRANT … TO buyerrecon_prod_collector_app` for any DDL surface; no membership in a DDL group role),
- **`dist/db/schema.sql` is the build's freshly-copied artifact from `src/db/schema.sql`** (per PR#17i; do not commit a `dist/db/schema.sql`; do not edit it in place).

---

## 10. Service deployment phase

This phase is labelled:

> **RUN ONLY AFTER MERGE + HELEN FINAL GO.**

Sequential steps (the operator follows them in order; on any failure or anomaly, stop and follow §16 / §17):

1. **Confirm pre-execution checks (§8).** All PASS. If any FAIL, stop.
2. **Retrieve secrets from the approved vault without printing.** Secrets land directly into `<PRODUCTION_ENV_FILE>` via the vault tool; no value is echoed to stdout or to shell history.
3. **Write or update `<PRODUCTION_ENV_FILE>` outside git with restrictive permissions** (mode `0600` or equivalent). Ownership is the deploy user (or root if the chosen process manager requires).
4. **Verify the env file contains `SKIP_DB_INIT=true` (exact literal) without printing other secrets.** Categorical PASS / FAIL recorded; e.g. `grep -c '^SKIP_DB_INIT=true$' <PRODUCTION_ENV_FILE>` returning `1`. The operator does **not** dump the env file.
5. **Install / build the production artifact** using the chosen strategy from §9. No env is interpolated into the artifact; no real secret appears in build logs.
6. **Start or restart the production collector service** via the chosen process manager.
7. **Verify service process is running.** Categorical PASS / FAIL (process present, expected user, expected start time).
8. **Verify the safe skip log** — the PR#17k single line:
   > `Database schema bootstrap skipped by SKIP_DB_INIT=true`
   is present in the service's startup log. Categorical PASS / FAIL. If the line is **absent** (i.e. `initDb()` ran), that is a §17 incident and §22 stop-the-line.
9. **Verify logs contain no secrets** (§13).
10. **Verify health endpoint (§11).**
11. **Verify DB target is `buyerrecon_production` / `buyerrecon_prod_collector_app` without printing the DSN (§12).**
12. **Verify zero-traffic row counts (§14).**

### Command templates (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**)

Strategy A (Node + process manager) skeleton:

```
# All secrets sourced from the approved operator vault; never paste raw values.
<VAULT_TOOL> render --to-file <PRODUCTION_ENV_FILE> --owner <DEPLOY_USER> --mode 0600
ls -l <PRODUCTION_ENV_FILE>                                 # confirm owner / mode 0600
git ls-files | grep -F "$(basename <PRODUCTION_ENV_FILE>)" || echo "env file not in git (expected)"

# Confirm SKIP_DB_INIT=true (exact literal) without dumping the file.
grep -c '^SKIP_DB_INIT=true$' <PRODUCTION_ENV_FILE>          # expect 1

cd <PRODUCTION_APP_DIR>/releases/<RELEASE_ID>
npm ci --omit=dev
npm run build                                               # tsc; no DB action

# Restart the supervised service. The process manager loads <PRODUCTION_ENV_FILE>.
<PRODUCTION_PROCESS_MANAGER> restart <PRODUCTION_SERVICE_NAME>
<PRODUCTION_PROCESS_MANAGER> status <PRODUCTION_SERVICE_NAME>

# Confirm the PR#17k safe skip log line.
<LOG_SOURCE> | grep -F 'Database schema bootstrap skipped by SKIP_DB_INIT=true' | head -n 1
```

Strategy B (Docker) skeleton:

```
docker build -t <PRODUCTION_IMAGE_REF> .
docker push <PRODUCTION_IMAGE_REF>
docker pull <PRODUCTION_IMAGE_REF>

# <PRODUCTION_ENV_FILE> must include SKIP_DB_INIT=true; verify before run:
grep -c '^SKIP_DB_INIT=true$' <PRODUCTION_ENV_FILE>          # expect 1

docker run --detach \
  --name <PRODUCTION_SERVICE_NAME> \
  --user <NON_ROOT_UID>:<NON_ROOT_GID> \
  --env-file <PRODUCTION_ENV_FILE> \
  --publish <COLLECTOR_BIND_ADDRESS>:<PRODUCTION_PORT>:3000 \
  <PRODUCTION_IMAGE_REF>

docker ps --filter "name=<PRODUCTION_SERVICE_NAME>"
docker logs <PRODUCTION_SERVICE_NAME> 2>&1 \
  | grep -F 'Database schema bootstrap skipped by SKIP_DB_INIT=true' \
  | head -n 1
```

**No command in this doc contains a real DATABASE_URL, a real pepper, a real token, a real password, a real private IP, or a real registry credential.**

---

## 11. Health endpoint proof

After service start, verify the health endpoint:

- **Endpoint:** `<HEALTH_URL>` resolves to `GET /health` on the production collector.
- **Expected status:** HTTP `200` with body `{ status: "ok", timestamp: "<ISO8601>" }` (per `src/app.ts:102`).
- **The response must not expose secrets, DB URL, tokens, peppers, role names tied to credentials, or private IPs.** The endpoint shipped in `src/app.ts` discloses none of these; if a later code change adds disclosure, **stop** and follow §17.
- **The health check must not create collector event rows.** `/health` does not write to `ingest_requests` / `accepted_events` / `rejected_events`; confirm against §14 zero-traffic posture.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Use an internal hostname (non-public) appropriate to the host. Mask any host/IP detail in the recorded proof.
curl -fsS <HEALTH_URL>
# Expected: {"status":"ok","timestamp":"<ISO8601>"}
```

The operator records categorical PASS / FAIL only; the raw `<HEALTH_URL>` is masked in the proof report.

---

## 12. DB target verification proof

The operator must prove the collector connects to `buyerrecon_production` (via `buyerrecon_prod_collector_app`) and **not** to `buyerrecon_staging` and **not** to Render legacy — **without printing the `DATABASE_URL`**.

Safe verification techniques:

- **Parse the service env `DATABASE_URL` locally without printing the full URL.** From `<PRODUCTION_ENV_FILE>` (read by the operator on the production host, not committed), extract only the **DB name** segment of the DSN and the **DB user** segment. Output to the proof report is categorical: `db_name = buyerrecon_production`, `db_user = buyerrecon_prod_collector_app`, host category masked, password not shown.
- **Verify production / staging separation remains correct** by running the four cross-connection checks from §4 / §8.
- **Optional one-shot `current_database()` / `current_user` check** is allowed only if it does not print the DSN or the password — i.e. the operator runs a parallel read-only `psql` session sourced from the vault DSN, captures only the two text fields, masks the DSN, and records categorical PASS / FAIL.

### Default: no collector write smoke in PR#17l

- **PR#17l does not require any `INSERT` into `ingest_requests` / `accepted_events` / `rejected_events` / `scoring_output_lane_a` / `scoring_output_lane_b`** to prove the DB target.
- **No collector write smoke is approved in PR#17l.** Any future write smoke is gated by a separately approved PR / GO.

---

## 13. Log and secret scan proof

After service startup, the operator inspects logs from a sample window:

- **Startup success line** is present (categorical: process started, listening on `<PRODUCTION_PORT>`).
- **PR#17k safe skip line is present:** `Database schema bootstrap skipped by SKIP_DB_INIT=true`.
- **No `DATABASE_URL` / DSN material** printed anywhere in the captured logs.
- **No `postgres://`** substrings printed in the captured logs.
- **No raw passwords** printed (the strings `password=`, `pass=` followed by value, or any plaintext password).
- **No raw tokens** printed (the strings `token=`, `Authorization: Bearer …`, or any base64 / hex token material).
- **No token hashes or other 64-hex / 32-byte material** that could be a token hash, pepper, or key.
- **No `SITE_WRITE_TOKEN_PEPPER`** value or known length-64 hex material printed.
- **No `IP_HASH_PEPPER`** value printed.
- **No private IP patterns** printed in the **shared** proof. (Internal logs may carry private IPs for diagnostics; what crosses into the proof report is masked.) RFC1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- **No certificate / private key material** printed (`BEGIN CERTIFICATE`, `BEGIN RSA PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`, etc.).
- **No vault path contents** printed.
- **No PII** printed (no email, no full address, no payload bodies with identity).
- **No Track A markers** (no QA / test / bot / synthetic / adversary string).
- **No AMS Trust Core output** printed.

The proof report carries only **safe summaries** (line counts, categorical "no secret pattern matched", explicit named-pattern PASS / FAIL). If any secret-like material is found in logs, **stop** and follow §17.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Inspect a sample window from the service logs; the raw window stays local.
# Run a forbidden-pattern scan over the captured snippet, e.g.:
grep -E '(postgres://|DATABASE_URL=|SITE_WRITE_TOKEN_PEPPER|IP_HASH_PEPPER|PROBE_ENCRYPTION_KEY|password=|token=|Bearer\s+[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|BEGIN CERTIFICATE|10\.[0-9]+\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' <CAPTURED_LOG_SAMPLE> \
  && { echo "BLOCKER: forbidden pattern in logs"; exit 1; } \
  || echo "log scan PASS"
```

The operator captures `<CAPTURED_LOG_SAMPLE>` as a transient artefact on the operator's machine only; it does **not** enter the repo, the proof report, or chat.

---

## 14. Zero-traffic preservation proof

The operator records production row counts **before** and **after** the service start:

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

- **`accepted_events` / `rejected_events` / `ingest_requests` remain 0** — PR#17l does not generate traffic.
- **`site_write_tokens` remains 5.** PR#17l does not insert, update, disable, or revoke any token.
- **Lane A/B tables remain 0.** PR#17g grant safety prevents any non-migrator role from writing; the collector role has no Lane A/B grants.
- **`last_used_at` remains NULL** for all five tokens — no collector auth traffic is generated by PR#17l.

Any deviation is a §17 incident.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**, run from a parallel vault DSN session with output masked):

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

## 15. Lane A/B no-writer proof

The operator re-verifies the PR#17g grant-safety state on the production DB after service start:

- `buyerrecon_scoring_worker` has **no** `SELECT` / `INSERT` / `UPDATE` / `DELETE` on `scoring_output_lane_a`.
- `buyerrecon_scoring_worker` has **no** `SELECT` / `INSERT` / `UPDATE` / `DELETE` on `scoring_output_lane_b`.
- `buyerrecon_internal_readonly` has `SELECT` (only if needed for internal verification / preview) on both lane tables and **no** `INSERT` / `UPDATE` / `DELETE`.
- `buyerrecon_customer_api` has **no** `SELECT` on either lane table.
- `scoring_output_lane_a` row count: **0**.
- `scoring_output_lane_b` row count: **0**.

Categorical PASS / FAIL in the proof report. If any grant has drifted from the PR#17g state, **stop** and follow §17.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
psql "<MASKED_DATABASE_URL>" -At -c "
  select grantee, privilege_type, table_name
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('scoring_output_lane_a','scoring_output_lane_b')
   order by grantee, table_name, privilege_type;
"
```

---

## 16. Rollback plan

Rollback is performed by the operator at first sign of trouble; it is reversible and non-destructive:

- **Stop the service** via the chosen process manager (`<PRODUCTION_PROCESS_MANAGER> stop <PRODUCTION_SERVICE_NAME>`).
- **Restore the previous service config** if one exists (e.g. flip the `current` release symlink back, restore the prior `<PRODUCTION_ENV_FILE>` from the vault). **If this is the first deployment of this service, the acceptable rollback state is simply "service is stopped"** — the production DB and tokens remain intact for the next attempt.
- **Do not delete `buyerrecon_production`.** The DB and its contents stay intact.
- **Do not delete evidence ledgers.** `ingest_requests`, `accepted_events`, `rejected_events` are not truncated or dropped. (They are zero anyway under §14 zero-traffic posture.)
- **Do not disable `site_write_tokens`** unless a secret exposure occurs (in which case follow §17 token-revocation path).
- **If a secret leaks**, rotate / revoke the affected secret per the vault's procedure; record the incident in the proof report.
- **Do not broaden `buyerrecon_prod_collector_app` privileges as a rollback workaround.** If service start failed because the runtime tried `initDb()` (i.e. `SKIP_DB_INIT=true` was not set), the response is to fix the env file (set the exact literal `true`) and re-attempt — **not** to grant DDL to the runtime role.
- **Render legacy remains unaffected.** Render legacy collector and Render legacy DB continue to be the live capture / archive surface; nothing PR#17l does touches Render.

After rollback, the operator records the rollback in the proof report (§18) and opens a follow-up issue / PR before any retry.

---

## 17. Incident path

The following are incidents — on any occurrence, the operator stops, preserves evidence, notifies Helen, does not continue, rolls back the service if needed, rotates / revokes if a secret is involved, and creates a follow-up issue / PR.

- **Service points to staging DB** (the DSN resolves to `buyerrecon_staging`).
- **Service cannot connect to production DB.**
- **`SKIP_DB_INIT` is missing or not the exact literal `true`** in `<PRODUCTION_ENV_FILE>` after service start.
- **`initDb()` appears to run** at service startup (e.g. `pool.query(<schema>)` activity observed, or a DDL-related error from the runtime role). Treat as conflated schema-and-privilege incident; **do not broaden role grants**; fix `SKIP_DB_INIT` and re-attempt.
- **PR#17k safe skip log line is absent** from the service startup logs while the service is otherwise running.
- **Service logs a secret** (DSN, password, raw token, token hash / prefix, pepper, private IP in shared proof, certificate / private-key material, vault path contents).
- **Health endpoint exposes sensitive info** (anything beyond `status` / `timestamp` as currently shipped).
- **`accepted_events` / `rejected_events` / `ingest_requests` row count changes unexpectedly** during PR#17l default-scope execution (these should stay 0).
- **`site_write_tokens.last_used_at` changes unexpectedly** (no token should validate during PR#17l default scope).
- **Lane A/B table receives rows** (PR#17g grant safety should prevent this; any deviation is a serious incident).
- **Customer-facing output appears** (Pass 1 / Trust / Pass 2 are unimplemented — there must be no customer-visible automated artefact).
- **Operator uncertainty** about whether the runbook is proceeding sanely.

Standard response: **stop, preserve evidence, notify Helen, do not continue, record the incident, rotate / revoke if needed, open a follow-up issue / PR before any retry.**

---

## 18. Proof report format

Proof fields (categorical values only; **no raw secrets, no DSN, no tokens, no hashes, no prefixes, no peppers, no private IPs, no certificate material, no PII, no raw log bodies**):

- **Execution approval reference** — the merged PR (`PR#17l`), Helen's recorded final-GO message (timestamp and location of the message; no quoting of any sensitive content; confirmed the GO included `SKIP_DB_INIT=true`).
- **Operator** — identifier of the human who executed the runbook.
- **Start / end time.**
- **Repo HEAD** at execution time (the merge commit hash of PR#17l).
- **Service name** (`<PRODUCTION_SERVICE_NAME>` placeholder name resolved to the actual name).
- **Deployment strategy** — A (Node + process manager) or B (Docker), per §9; one chosen.
- **`SKIP_DB_INIT=true` confirmed** — categorical PASS confirming `grep -c '^SKIP_DB_INIT=true$' <PRODUCTION_ENV_FILE>` returned `1`.
- **Environment categories set / missing** — per §7 proof posture (set / missing per category; length only for peppers; DB name / DB user only from `DATABASE_URL`; host category only; `SKIP_DB_INIT` is `set / equal to "true"`).
- **DB target (masked)** — `db_name = buyerrecon_production`, `db_user = buyerrecon_prod_collector_app`, host category masked.
- **Production / staging separation result** — PASS / FAIL per §4 / §8 / §12 checks.
- **Safe skip log observed** — categorical PASS: the literal line `Database schema bootstrap skipped by SKIP_DB_INIT=true` was present at startup. Recorded as a count (`1`) not as a copied log body.
- **Health endpoint result** — PASS / FAIL per §11.
- **Log / secret scan result** — PASS / FAIL per §13.
- **Row counts before / after** — per §14 (a single integer per surface; deviation flagged).
- **`site_write_tokens` metadata count / `last_used_at` posture** — categorical: "5 rows, all `disabled_at IS NULL`, all `last_used_at IS NULL`".
- **Lane A/B no-writer posture** — categorical PASS per §15.
- **Anomalies** — any non-PASS observation, with categorical description.
- **Rollback readiness** — confirmation that §16 paths are available and pre-staged.
- **Explicit non-events** (all PASS — none occurred):
  - **no ThinLayer cutover**,
  - **no DNS change**,
  - **no Track A**,
  - **no Playwright**,
  - **no production traffic**,
  - **no customer-facing output**.

The proof report is committed as `PR#17l-proof` (or `PR#17m`) per §24.

---

## 19. Output-gate restrictions

- **PR#17l does not create customer-facing output.**
- **PR#17l does not approve customer-facing automated scores.**
- **No durable Lane A/B writers** — PR#17g grant-safety remains in force; PR#17l does not change it.
- **No Lane B exposure.** Lane B internal hypotheses stay internal.
- **No AMS Trust Core output** exposure through BuyerRecon.
- **No AMS runtime bridge.** PR#14 ProductFeatures bridge candidate remains record-only.
- **No Pass 1 / Pass 2 implementation.**
- **Evidence Snapshot and Lane A/B preview remain internal-only.**

---

## 20. Relationship to PR#17d and PR#17e

- **PR#17l deploys / starts the collector service only.** It does not cut endpoint, does not run Track A, does not produce customer-visible artefacts.
- **PR#17d governs future `buyerrecon.com` canary endpoint cutover.** PR#17d's runbook is the canonical procedure for moving live ThinLayer traffic to the Sprint 2 production collector. PR#17l does not execute PR#17d.
- **PR#17e governs future Track A unlabelled `B_analytics_only` proof.** PR#17e's plan is the canonical procedure for a narrow unlabelled programmatic proof. PR#17l does not execute PR#17e.
- **PR#17l does not cut endpoint and does not run Track A.**

---

## 21. Success criteria

After execution within the §2 GO scope, PR#17l is considered successful if **all** of the following hold:

- **Production collector service is running** (`<PRODUCTION_SERVICE_NAME>` is up, non-root user, restart-on-failure configured per host practice).
- **`SKIP_DB_INIT=true` confirmed** in `<PRODUCTION_ENV_FILE>` (exact literal lowercase `true`).
- **PR#17k safe skip log line observed** at startup (`Database schema bootstrap skipped by SKIP_DB_INIT=true`).
- **Health endpoint passes** (`GET /health` returns the expected shape per §11).
- **DB target is `buyerrecon_production`** (per §12 verification, without DSN disclosure).
- **DB user is `buyerrecon_prod_collector_app`** (per §12 verification, without password disclosure).
- **Logs contain no secrets / DSNs / tokens / hashes / prefixes / peppers / private IPs / certificate material** (per §13).
- **No staging DB target.**
- **Row counts preserved at zero** for `accepted_events` / `rejected_events` / `ingest_requests` / `scoring_output_lane_a` / `scoring_output_lane_b` (per §14).
- **`site_write_tokens` remains 5** and `last_used_at` remains NULL for all five rows.
- **No Lane A/B writes** (per PR#17g; row counts remain 0; grant matrix unchanged per §15).
- **No customer-facing output.**
- **Rollback path documented and confirmed available** (per §16).
- **Proof report created** (per §18).

If any item is not satisfied, PR#17l's execution is not a success; the operator either follows §16 / §17 or escalates per Helen's direction.

---

## 22. Stop-the-line conditions

Stop and re-plan if any of the following appears at any point during authoring, review, or execution of PR#17l:

- **Helen final GO is missing or ambiguous** (recorded GO message does not match the §2 expected wording or unambiguous equivalent).
- **GO omits `SKIP_DB_INIT=true`** or any of the no-cutover / no-DNS / no-Track-A / no-Playwright / no-traffic / no-customer-output constraints.
- **Repo HEAD is not the approved base** at execution time.
- **`SKIP_DB_INIT` is not the exact literal `true`** in `<PRODUCTION_ENV_FILE>`.
- **`initDb()` appears to run** at service startup despite `SKIP_DB_INIT=true` being expected (PR#17k guard regression).
- **PR#17k safe skip log line is absent** from startup logs.
- **Service target DB cannot be proven as `buyerrecon_production`** (or DSN handling at execution time would require printing the DSN).
- **Service points to `buyerrecon_staging`** or to Render legacy.
- **Service uses the wrong DB user** (anything other than `buyerrecon_prod_collector_app`).
- **Any secret appears in shared logs / proof / terminal transcripts destined for sharing.**
- **Health endpoint exposes sensitive info** (env, DSN, token, role, private IP).
- **Deployment requires DNS or ThinLayer change** (PR#17l default scope excludes these).
- **Deployment generates traffic** (PR#17l default scope is zero-traffic).
- **Track A is proposed** as part of PR#17l (Track A is PR#17e's scope under its own GO).
- **`accepted_events` / `rejected_events` / `ingest_requests` row counts change unexpectedly** during default-scope execution.
- **`site_write_tokens.last_used_at` changes** during default-scope execution.
- **Lane A/B table receives rows.**
- **Customer-facing output appears.**
- **Proposed broadening of `buyerrecon_prod_collector_app` privileges** (DDL grant, `createdb`, `createrole`, superuser, DDL group membership) as a workaround for any operational issue.
- **Operator uncertainty exists** about whether the runbook is proceeding sanely.

Stop-the-line means: do not continue, follow §16 / §17, and request a follow-up decision from Helen before any further action.

---

## 23. What PR#17l explicitly does not approve

PR#17l explicitly does **not** approve any of the following:

- execution of any runbook step **before** gates 1–4 in §2 are satisfied (draft PR → Codex review PASS → merged → Helen final GO recorded with `SKIP_DB_INIT=true`),
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
- implementation of Pass 1 or Pass 2 governance,
- broadening `buyerrecon_prod_collector_app` privileges (no DDL grant, no `createdb`, no `createrole`, no superuser, no DDL group membership).

These remain for explicitly-scoped successor PRs.

---

## 24. Recommended next PRs

PR#17l recommends the following successor PRs, each tightly scoped:

- **PR#17l-proof (or PR#17m) — Proof closure** after PR#17l operator execution. Records the §18 proof report and any anomalies. Produced only if execution is performed under Helen's GO.
- **Future `buyerrecon.com` canary endpoint cutover execution** following PR#17d's runbook — only after PR#17l-proof / PR#17m records a successful deployment, and only if Helen explicitly approves with the corresponding final-GO message.
- **Future Track A `B_analytics_only` execution proof** following PR#17e's plan — only if Helen explicitly approves with the corresponding final-GO message.
- **Future low-dwell / refresh-loop / adversarial CTA Track A plans** — only after the first `B_analytics_only` proof passes and is reviewed.
- **Future output-gate planning** (separate PR sequences):
  - Pass 1 eligibility planning,
  - Trust Core bridge planning,
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 25. Acceptance criteria

PR#17l is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17l-production-collector-deployment-proof.md`,
- the document's **execution-approved status is clearly stated as "after Codex PASS + merge + Helen final GO only"** (§1, §2),
- **no execution occurs during PR authoring** — no DB connection, no role / token / secret creation or rotation, no migration run, no deploy, no DNS change, no `endpointUrl` change, no Render / Hetzner / AMS / Track A / Playwright touch, no traffic generation,
- **`SKIP_DB_INIT=true` is mandatory for the production service env** and is explicitly named in §1, §2, §7, §8, §10, §17, §21, §22, §23,
- the **proof requires the PR#17k safe skip log line** (`Database schema bootstrap skipped by SKIP_DB_INIT=true`) per §10 / §13 / §18 / §21,
- the **proof requires the health endpoint** (per §11),
- the **proof requires DB target verification** without DSN disclosure (per §12),
- the **proof requires zero-traffic preservation** (per §14),
- the **proof requires log / secret scan** (per §13),
- **no cutover** is approved,
- **no DNS** change is approved,
- **no Track A** is approved,
- **no traffic** is approved,
- **no customer-facing output** is approved,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no token prefixes, no role passwords, no peppers, no private IPs, no certificate material,
- **output-gate restrictions are included** (§19).

---

End of PR#17l runbook authoring. **Authoring is docs-only. Execution is gated on Codex PASS + merge + Helen final GO that includes `SKIP_DB_INIT=true`.**
