# BuyerRecon Sprint 2 PR#17n — Production Collector Deployment Proof Closure

Status: **docs-only proof closure for PR#17l execution**. No code changes. No package changes. No migrations. No `schema.sql` changes. No `.env*` changes. No systemd changes. No DB commands run by PR#17n. No service start / restart by PR#17n. No DNS / ThinLayer / Track A / Playwright / live traffic / customer-facing output by PR#17n.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `e545c12` — PR#17m merged, "add production secret recovery runbook").

PR branch: `buyerrecon-sprint2-pr17n-production-collector-deployment-proof-closure`

---

## 1. Status / verdict

**PASS.** PR#17l Phase 1 service deployment executed successfully on the production host under the active §2 Helen final-GO scope after PR#17m closed the PR#17l env-readiness blocker. All twelve PR#17l Phase 1 verification points were observed; all "what did not happen" non-events held; no secret material crossed into shareable artefacts.

PR#17n records the proof. PR#17l is **complete** for the deployment scope defined by its active §2 final-GO wording. ThinLayer cutover, DNS change, Track A execution, Playwright execution, live customer / collector event traffic, and customer-facing output remain **out of scope** and **future-gated** as before.

---

## 2. Scope of proof

PR#17n records what PR#17l execution actually achieved, anchored to a known server HEAD and a known active Helen final-GO scope:

- **Server HEAD at execution:** `e545c1288c2fb4303cf28de5d6981460803cc2a7` (= `Sprint 2 PR#17m: add production secret recovery runbook (#18)`).
- **Active Helen final-GO scope at execution** (per PR#17l §2):
  > "I approve executing PR#17l operator runbook now. Scope: production collector deployment / health / logging / DB-target verification only, with `SKIP_DB_INIT=true`. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live production traffic generation. No customer-facing output."
- **What this proof closure covers:**
  - PR#17m prerequisite closure (§3),
  - production service identity (§4),
  - env-readiness proof (§5),
  - startup proof (§6),
  - health proof (§7),
  - DB-target proof (§8),
  - zero-event proof (§9),
  - secret-safety proof (§10),
  - what did **not** happen (§11),
  - remaining gates / next steps (§12).
- **What this proof closure does NOT cover (and PR#17l execution did NOT perform):**
  - ThinLayer endpointUrl cutover on any live site,
  - DNS change of any kind,
  - Track A execution,
  - Playwright execution,
  - live customer or collector event traffic,
  - collector write smoke,
  - customer-facing automated output,
  - durable Lane A/B writers,
  - AMS runtime bridge,
  - AMS Trust Core exposure,
  - Pass 1 / Pass 2 implementation,
  - staging env reuse,
  - Render touch,
  - privilege broadening for `buyerrecon_prod_collector_app` beyond the separately-approved PR#17m DB password rotation.

PR#17n itself is **docs-only**. PR#17n does not run any DB command, does not start / restart / enable / disable any systemd unit, does not write any `.env*` file, does not touch any secret. It records what the operator already observed during PR#17l execution.

---

## 3. PR#17m prerequisite closure

PR#17m completed before PR#17l execution resumed; all PR#17m categorical fields passed:

| Field | Result |
|---|---|
| DB password rotation for `buyerrecon_prod_collector_app` | PASS |
| `.env.production` created with mode `0600` | PASS |
| `DATABASE_URL` points to `buyerrecon_production` as `buyerrecon_prod_collector_app` | PASS |
| `SITE_WRITE_TOKEN_PEPPER` established | PASS |
| `IP_HASH_PEPPER` established | PASS |
| 5 unused production `site_write_tokens` replaced under PR#17m labels | PASS |
| zero-event posture preserved through PR#17m | PASS |

Notes carried into PR#17n redaction posture:

- The raw production `site_write_tokens` are stored privately by Helen via the approved secure record-keeping process. **They are not included in this doc, in chat, in PR comments, in repo files, or in any captured proof output.** Token metadata is recorded in §9 only at the categorical level (`count`, `active`, `last_used_at` posture).
- The PR#17m DB password rotation was performed **only** under PR#17m's separately-approved GO scope (Branch B DB-password sub-path), not under PR#17l's GO. PR#17l execution treated the rotation as a closed prerequisite, not as something to be repeated.
- PR#17m's recovery / rotation work satisfied the §11 four-condition handoff: every §8.1 check PASS (including `UNRESOLVED_PLACEHOLDERS_absent: PASS`), §8.2 DB URL parse PASS, no secret values printed.

PR#17l Phase 1 resumed from PR#17l §10 step 5 once §11 of PR#17m handed off cleanly.

---

## 4. Production service identity

Recorded categorically; no secret values, no private IPs, no DSN content.

- **Systemd unit name:** `buyerrecon-production-collector.service`
- **Unit file path:** `/etc/systemd/system/buyerrecon-production-collector.service`
- **Env file path:** `/opt/buyerrecon-backend/.env.production`
- **Env file mode:** `0600`, owner per PR#17m placement (root or deploy user; categorical reference only)
- **Service status:** `active/running`
- **Service enablement:** `disabled` (intentional — service does not auto-start on boot; start/stop is operator-controlled)
- **Bind port:** `3073` (chosen per PR#17l §6; `3071` is staging backend `buyerrecon-backend.service`; `3072` is `buyerrecon-synthetic-proxy`; `3073` was free)
- **Health URL:** `http://127.0.0.1:3073/health` (internal only; no public DNS, no edge / CDN routing introduced by PR#17l)
- **Runtime:** `node dist/server.js` per `package.json` `start` script
- **Repo HEAD at deploy time:** `e545c1288c2fb4303cf28de5d6981460803cc2a7`
- **Build version env (recorded in process env):** `COLLECTOR_VERSION=buyerrecon-backend-sprint2-pr17l`
- **Staging service (`buyerrecon-backend.service` on `PORT=3071`):** **untouched** by PR#17l / PR#17m / PR#17n. Staging continues to run as-is; no env, unit, or process state was modified.

---

## 5. Env readiness proof

Per PR#17m §8.1 + §11 four-condition handoff. All categorical, no secret values:

| Check | Result |
|---|---|
| `NODE_ENV_production` | PASS |
| `PORT_3073` | PASS |
| `SKIP_DB_INIT_exact_true` | PASS |
| `ENABLE_V1_BATCH_true` | PASS |
| `ALLOWED_ORIGINS_ready` | PASS |
| `DATABASE_URL_ready` | PASS |
| `SITE_WRITE_TOKEN_PEPPER_ready` (+ length sanity) | PASS |
| `IP_HASH_PEPPER_ready` (+ length sanity) | PASS |
| `UNRESOLVED_PLACEHOLDERS_absent` | PASS |

PR#17m §8.2 DB URL parse:

- `db_name_PASS` — DB name resolved to `buyerrecon_production`.
- `db_user_PASS` — DB user resolved to `buyerrecon_prod_collector_app`.
- `host_category` — `local-postgres` (categorical only; no host / IP / port printed).

PR#17m §8.6 secret scan over the captured env-readiness window: `secret_scan_PASS`.

All four §11 PR#17m handoff conditions held simultaneously. The operator returned to PR#17l Phase 1 §10 step 5.

---

## 6. Startup proof

After PR#17l §10 steps 5–6 (install / build artifact via existing `npm run build` → `tsc`; start the production collector service via the chosen process manager), the operator observed the following at the running process level. **All values categorical; no DSN, no password, no pepper, no token, no private IP.**

### 6.1 Process env

| Variable | Process state |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3073` |
| `SKIP_DB_INIT` | `true` (exact lowercase literal) |
| `DATABASE_URL_present_in_process` | `YES` (value never printed) |
| `SITE_WRITE_TOKEN_PEPPER_present_in_process` | `YES` (value never printed) |
| `IP_HASH_PEPPER_present_in_process` | `YES` (value never printed) |

### 6.2 Listening socket

A single Node process is listening on `*:3073` (categorical observation; PID, owning user, and bind interface recorded internally on the production host, not copied into this doc).

### 6.3 PR#17k safe skip log line

The expected PR#17k safe single-line log was observed at startup:

```
Database schema bootstrap skipped by SKIP_DB_INIT=true
```

This confirms:

- `shouldSkipDbInit()` returned `true` against the process env (strict equality with the exact literal `"true"` per PR#17k `src/db/client.ts`),
- `await initDb()` was **not** called,
- no DDL was attempted by `buyerrecon_prod_collector_app` at startup,
- the §1.1 / §9.1 historical BLOCKER closed by PR#17k holds in production.

### 6.4 Service listen log line

Immediately after the skip line, the expected startup log was observed:

```
br-collector listening on :3073
```

This confirms `app.listen(PORT, ...)` was called and bound successfully on the chosen production port.

No additional env-bearing or secret-bearing lines were observed at startup. The §1.1 closure is in force for the running production process.

---

## 7. Health proof

After the service was confirmed running:

- **Endpoint hit:** `GET http://127.0.0.1:3073/health` (internal, non-public host; the `<HEALTH_URL>` of PR#17l §6).
- **HTTP status:** `200 OK`.
- **Response body shape:**

  ```
  { "status": "ok", "timestamp": "<ISO8601>" }
  ```

  (The actual ISO8601 timestamp is not copied into this proof; categorical observation only.)
- **Disclosure check:** the response contained **no** env value, **no** `DATABASE_URL`, **no** token, **no** pepper, **no** role name, **no** private IP, **no** host port. Matches the shape shipped in `src/app.ts` per PR#17l §11.
- **Side-effects:** none. `/health` does not write to `ingest_requests` / `accepted_events` / `rejected_events`; the §9 zero-event posture below confirms it.

Categorical PASS.

---

## 8. DB target proof

Per PR#17l §12 (and PR#17m §8.2 categorical parser). All recorded categorically:

- **`db_name`** parsed from the process env `DATABASE_URL` segment: `buyerrecon_production` → **PASS**.
- **`db_user`** parsed from the process env `DATABASE_URL` segment: `buyerrecon_prod_collector_app` → **PASS**.
- **`host_category`** parsed from the process env `DATABASE_URL` segment: `local-postgres` (the production Postgres instance reachable on the production host loopback). The raw host token / IP / port is **not** printed.
- **Negative check:** the resolved DB name is **not** `buyerrecon_staging`; the resolved DB user is **not** `buyerrecon_app`. Production / staging separation per PR#17h §12 and PR#17l §8 remains correct.
- **Render-legacy check:** the resolved host does **not** point at the Render legacy collector / Render legacy DB. Render legacy remains untouched.
- **DSN never printed.** The DSN appears only in `/opt/buyerrecon-backend/.env.production` (mode `0600`) and in the running process's env block (not echoed). No partial DSN appears in this doc, in chat, in PR comments, or in logs.

Categorical PASS.

---

## 9. Zero-event proof

Recorded immediately after service start, via the PR#17m §8.4 approved read-only operator verification path (not via `buyerrecon_prod_collector_app`; see §10.1 below). All counts:

| Surface | Count |
|---|---|
| `accepted_events` | 0 |
| `rejected_events` | 0 |
| `ingest_requests` | 0 |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |
| `site_write_tokens` (active) | 5 (matches PR#17m token re-creation) |
| `site_write_tokens_used` (i.e. `count(*) filter (where last_used_at is not null)`) | 0 |

Implications:

- Service start **did not** generate any ingest event, accepted event, or rejected event.
- Service start **did not** trigger any token validation (no `last_used_at` was bumped).
- Lane A/B tables remain empty — the PR#17g grant safety still prevents any non-migrator role from writing, and the collector role has no Lane A/B grants under PR#17m's continued posture.
- The five `site_write_tokens` rows established under PR#17m labels remain active and unused.

Categorical PASS for "deployment introduced no traffic."

---

## 10. Secret-safety proof

### 10.1 Approved read-only operator verification path

Per PR#17m §8.4 (post-Blocker-2 fix), the zero-event verification in §9 was run under the **approved production read-only / operator verification path** — **not** under `buyerrecon_prod_collector_app`. The collector runtime role retained its least-privilege, no-event-SELECT posture; no privilege broadening was performed to enable verification.

The PR#17m DB-password rotation for `buyerrecon_prod_collector_app` (under PR#17m Branch B GO) is the **only** approved change to that role's credential surface in this sequence. Its grants remain those documented in PR#17h §13 and PR#17l §12; no DDL was granted, no `createdb`, no `createrole`, no superuser, no DDL group membership.

### 10.2 No secret values in this doc

- **No raw `DATABASE_URL`** (full or partial).
- **No raw password** for `buyerrecon_prod_collector_app` (or any other role).
- **No raw `SITE_WRITE_TOKEN_PEPPER`** value.
- **No raw `IP_HASH_PEPPER`** value.
- **No raw `site_write_tokens` row content** — no `token_id`, no `token_hash`, no token prefix / suffix, no raw token. The five raw tokens generated under PR#17m are held privately by Helen via the approved secure record-keeping process; they are referenced only as "5 active tokens under PR#17m labels".
- **No private IPs.**
- **No certificate or private-key material.**
- **No vault file contents.**
- **No `.env.production` body** is reproduced here; only categorical env-readiness fields per §5.
- **No process env dump.** §6.1 reproduces the categorical `*_present_in_process=YES` / fixed-value pairs only.

### 10.3 Log / secret scan posture

The captured proof window was scanned per PR#17l §13 / PR#17m §8.6 forbidden-pattern grep (DSN substrings, `postgres://`, `DATABASE_URL=`, `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, `password=`, `token=`, `Bearer …`, 64-hex hashes, `BEGIN PRIVATE KEY`, `BEGIN CERTIFICATE`, RFC1918 IP ranges, vault paths). Result: **`secret_scan_PASS`** across the startup / health / DB-target / zero-event windows.

### 10.4 Local safety cleanup on the production host

To prevent any accidental future commit of production secret files from the server-side working tree, the operator added the following entries to `/opt/buyerrecon-backend/.git/info/exclude`:

- `.env.production`
- `.env.production.bak.*`

After the addition, `git status --short` on the production host **no longer surfaces** those production secret env files. Important accuracy notes:

- The repo `.gitignore` was **not** modified by PR#17n; the local exclude is operator-side only on the production host and is **not** part of any commit.
- The repo `.gitignore` currently ignores **exact `.env`**, but does **not** ignore `.env.production` (nor its `.env.production.bak.*` siblings). The earlier draft of this paragraph claimed `.env*` was broadly gitignored in repo by `.gitignore` and existing patterns — that claim was **inaccurate** and has been removed.
- The protection recorded here is therefore **host-local only**: it stops accidental `git add` of those files from the production host's working tree on that host. It does **not** confer any repo-wide protection.
- The repo `.gitignore` **must not be relied on** to ignore `.env.production` (or any other non-exact `.env*` variant).
- If repo-wide protection for `.env.production` is desired, it must be handled by a **future repo-hygiene PR** that explicitly adds the pattern(s) to `.gitignore`; PR#17n does **not** make that change and does **not** claim that protection.

---

## 11. What did not happen

PR#17l execution and PR#17n closure record the following non-events. **None of these occurred at any point during execution.**

- **No ThinLayer cutover.** No live site's `endpointUrl` was changed. `buyerrecon.com`, `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, and `keigen.co.uk` continue to post to the Render legacy collector exactly as before.
- **No DNS change.** No `collector.buyerrecon.com` record created or modified. No CNAME flip. No edge / CDN cutover. The production collector is reachable only on the internal `127.0.0.1:3073` loopback at the time of this proof.
- **No Track A.** The Track A repo (`/Users/admin/github/ams-qa-behaviour-tests`) was not touched. No Track A scenario was executed against any environment.
- **No Playwright.** No headless browser run.
- **No live customer or collector event traffic.** Zero `ingest_requests`, zero `accepted_events`, zero `rejected_events` (§9). No external HTTP request was issued to the collector beyond the internal `127.0.0.1:3073/health` probe (which is non-event-generating per §7).
- **No collector write smoke.** No synthetic ingestion was performed to exercise the write path.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.
- **No durable Lane A/B writer.** `scoring_output_lane_a` / `scoring_output_lane_b` remain at 0 rows. PR#17g grant safety holds (`buyerrecon_scoring_worker` has no `SELECT` / `INSERT` / `UPDATE` / `DELETE` on either lane table; `buyerrecon_customer_api` has no `SELECT`; `buyerrecon_internal_readonly` has `SELECT` only; `buyerrecon_migrator` retains `ALL`).
- **No AMS Trust Core output** exposure through BuyerRecon. PR#14 ProductFeatures bridge candidate remains record-only.
- **No AMS runtime bridge.**
- **No Pass 1 / Pass 2 implementation.**
- **No staging env reuse.** The production service did not read `/opt/buyerrecon-backend/.env` (staging); it reads `/opt/buyerrecon-backend/.env.production` only. `buyerrecon-backend.service` (staging) remained running on `PORT=3071` with `DB=buyerrecon_staging`, untouched.
- **No Render touch.** Render legacy collector (`https://buyerrecon-backend.onrender.com/collect`) and Render legacy DB remain live as fallback / archive, exactly as PR#17a §10 / PR#17h §16 specified. The PR#17l execution did not authenticate to Render, did not modify Render, and did not migrate any Render row into `buyerrecon_production`.
- **No privilege broadening for `buyerrecon_prod_collector_app`** beyond the separately-approved PR#17m DB password rotation. No DDL grant, no `createdb`, no `createrole`, no superuser, no DDL group membership.
- **No raw secrets, tokens, token hashes, peppers, DSNs, passwords, private IPs, or certificate material** anywhere in this doc, in chat, in PR comments, in repo files, or in captured proof output. Secret material from PR#17m / PR#17l lives in the following places (none of which are this doc):
  - the approved vault / Helen's private secure record-keeping process (DB password rotated under PR#17m; raw `site_write_tokens` written under PR#17m labels held privately by Helen, plus a temporary root-only token file on the production host),
  - the running production process env on the production host, which is never echoed,
  - **`/opt/buyerrecon-backend/.env.production` on the production host** — a local secret-bearing file at mode `0600`, owned per PR#17m placement, protected from accidental `git add` by the §10.4 host-local `.git/info/exclude` entries (and explicitly not protected by the repo-wide `.gitignore`, per §10.4).
  None of the above values appear in this doc.

---

## 12. Remaining gates / next steps

PR#17l deployment is complete within its active GO scope. The following gates remain future, each requiring its own explicit Helen final-GO message scoped to the named work.

1. **`buyerrecon.com` canary endpoint cutover execution** (PR#17d runbook).
   - Live ThinLayer `endpointUrl` flip from the Render legacy collector to the now-running Sprint 2 production collector for `buyerrecon.com` only, with per-site smoke + observer proof + rollback check per PR#17d §11.
   - **Gated** on a separate explicit Helen final-GO message scoped to PR#17d.
   - Other live sites (`realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`) follow one at a time only after `buyerrecon.com` canary proof closes successfully.

2. **Track A unlabelled `B_analytics_only` execution proof** (PR#17e plan).
   - Narrow unlabelled `B_analytics_only` proof against the Sprint 2 staging/canary collector first, then optionally against the `buyerrecon.com` canary path once PR#17d cutover is in force.
   - **Gated** on a separate explicit Helen final-GO message scoped to PR#17e.

3. **Low-dwell / refresh-loop / adversarial CTA Track A plans.**
   - Only after the first `B_analytics_only` proof passes and is reviewed.

4. **Output-gate planning before any customer-facing automated output** (independent planning track; can run in parallel with the above):
   - Pass 1 eligibility planning,
   - Trust Core bridge planning (AMS Trust Core output remains future-gated),
   - Pass 2 customer-safe projection planning,
   - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

5. **Operational follow-ups carried forward:**
   - `dist/db/schema.sql` repo-hygiene (PR#17h §18 item 1 / PR#17i policy): the Dockerfile `COPY src/db/schema.sql dist/db/schema.sql` continues to handle runtime hydration; no further repo change required, but operators must continue to baseline only from `src/db/schema.sql` (per PR#17i).
   - Enabling `buyerrecon-production-collector.service` at boot (`systemctl enable`) is a future operational choice; it is **not** approved by PR#17l / PR#17n. Today the service is `disabled` so an unexpected reboot does not start it; an explicit operator decision (under its own GO) is required before changing this.

PR#17n itself does not perform any of the above. PR#17n records that PR#17l deployment is complete and that the listed gates remain future.

---

## Closing notes

- **PR#17n is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no DB connection by PR#17n, no service action by PR#17n, no DNS change, no ThinLayer change, no Track A, no Playwright, no traffic generation, no customer-facing output.
- **No secrets** appear anywhere in this doc.
- **Production service remains running** on the production host (`buyerrecon-production-collector.service` `active/running`, `disabled` for auto-start, `PORT=3073`) after the proof was captured. The next time service state changes, it will be under a separate explicit operator action with its own GO.

End of PR#17n. **Docs only. Verdict: PASS.**
