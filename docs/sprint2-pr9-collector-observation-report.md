# Sprint 1 PR#9 — Collector Observation Report (read-only evidence view)

> **Hard-rule disclaimer.** PR#9 is a **read-only operator report** over the
> Track B collector DB. It is **NOT** Track A scoring. It is **NOT** the AMS
> shared core. It is **NOT** a dashboard. It introduces no scoring, no bot
> detection, no AI-agent detection, no `risk_score` / `classification` /
> `recommended_action` / `bot_score` / `agent_score` / `is_bot` / `is_agent`
> / `ai_agent` surfaces. It performs no DB writes, no schema changes, no
> migrations. It never reads or prints `token_hash`, `SITE_WRITE_TOKEN_PEPPER`,
> `IP_HASH_PEPPER`, raw bearer tokens, `DATABASE_URL` (literal), IP hashes,
> or user agents. No deploy, no commit, no push.

## 1. What this is for

After the buyerrecon.com RECORD_ONLY live hook lands its first events into
the staging collector DB, the operator needs a quick, structured "is the
evidence healthy?" report. This report answers:

- Is the collector receiving the requests it should?
- Are evidence-quality invariants (sha256 lengths, canonical_jsonb 19-key
  shape) holding?
- Do the §2.7 reconciliation invariants still hold over a recent window?
- Is the active site_write_token enabled and being touched on auth?
- Are there rejected events worth triaging (and if so, by which reason
  code and stage)?

It is the **observation layer between raw collector evidence and any
future AMS scoring**. Scoring is explicitly out of scope. This report only
reads what the collector wrote.

## 2. What it ships

| Path | Purpose |
|---|---|
| `scripts/collector-observation-report.ts` | Read-only Node script. Connects to `DATABASE_URL`, runs ~10 read-only SELECTs scoped by `(WORKSPACE_ID, SITE_ID)` and a window (default last 24 h, override via `OBS_WINDOW_HOURS`), and prints a markdown report. Exits `0` for PASS/WATCH, `1` for BLOCK. |
| `package.json` | New script: `"observe:collector": "tsx scripts/collector-observation-report.ts"`. |
| `docs/sprint2-pr9-collector-observation-report.md` | This doc. |

**Files NOT touched:** the v1 collector code (`src/collector/v1/**`), the app
factory (`src/app.ts`, `src/server.ts`), persistence, routes, schema
(`src/db/schema.sql`), migrations, the v1 barrel (`src/collector/v1/index.ts`),
PR#5 helpers (PII, validation, consent, dedupe, canonical, payload-hash,
stable-json, normalised-envelope, envelope, hash, stage-map, types), auth
(`src/auth/workspace.ts`), `.env.example`, and `vitest.db.config.ts`.

## 3. Required env

| Var | Required | Default | Source |
|---|---|---|---|
| `DATABASE_URL` | yes | — | `.env` on the staging host (Helen's secret manager) |
| `WORKSPACE_ID` | yes | — | `/root/buyerrecon_staging_site_token_meta.env` |
| `SITE_ID` | yes | — | same file |
| `OBS_WINDOW_HOURS` | no | `24` | inline `export OBS_WINDOW_HOURS=...` |

Any missing required env var → script exits `1` with a clear message.
Failure to connect to the DB → exits `1` with the message and no partial
report.

## 4. How to run (staging host)

```bash
cd /opt/buyerrecon-backend
set -a
source .env
source /root/buyerrecon_staging_site_token_meta.env
set +a
npm run observe:collector
# Optional: widen the window to 7 days for backfill inspection.
OBS_WINDOW_HOURS=168 npm run observe:collector
```

The script prints the report to stdout. Pipe to a file if you want a
durable record (the report contains no secrets):

```bash
npm run observe:collector > /tmp/br-observe-$(date -u +%Y%m%dT%H%M%SZ).md
```

## 5. Report sections

The report renders these sections, in order:

1. **Boundary** — `workspace_id`, `site_id`, observation window, `checked_at`,
   `database_url` (masked).
2. **Ingest summary** — total / ok / error counts; first_seen + last_seen.
3. **Accepted / rejected summary** — counts plus a `(reason_code,
   rejected_stage)` breakdown table.
4. **Evidence quality** — `request_body_sha256` length-64 completeness,
   `payload_sha256` length-64 completeness, `canonical_jsonb` presence,
   19-key vs malformed counts.
5. **Reconciliation health** — `accepted+rejected ≠ expected` violations,
   ledger join skew between `ingest_requests` and `accepted_events`
   / `rejected_events`, unreconciled rows.
6. **Source breakdown** — group by `raw->>'consent_source'` over
   `accepted_events`.
7. **Page URL breakdown** — group by `raw->>'page_url'` over
   `accepted_events`, top 25 by rows.
7b. **Event type breakdown** _(added by PR#10)_ — group by
   (`raw->>'event_name'`, `event_type`, `schema_key`) over `accepted_events`
   in the window. Top 50 by rows. Grouped counts only — no per-event raw
   payload fields are rendered. Lets the operator see at a glance whether
   `page_view`, `cta_click`, `form_start`, and `form_submit` are arriving
   in the expected proportions before adding more RECORD_ONLY event types.
8. **Latest accepted events** — most recent 10 rows: `received_at`,
   `request_id`, `client_event_id`, `page_url`, `consent_source`,
   `event_type`, `schema_key`, `canonical_key_count`.
9. **Token health** — `token_id`, `disabled_at`, `last_used_at`,
   `created_at`. **`token_hash` is intentionally NEVER selected.**
9b. **Session features summary** _(added by PR#12)_ — derived-layer
    factual aggregates from the PR#11 `session_features` table. Selected by
    `last_seen_at` within the observation window; source-event-count
    mismatch validated against the FULL-SESSION accepted_events count.
    Paths only (no URLs); `session_id` truncated to 8 chars + ellipsis. New
    env knobs (all optional): `OBS_SESSION_FEATURES_VERSION` (default
    `session-features-v0.1`), `OBS_SESSION_FEATURES_MAX_LAG_HOURS` (default
    `24`), `OBS_REQUIRE_SESSION_FEATURES` (default off; literal `"true"`
    promotes a missing `session_features` table from no-impact to WATCH).
    No scoring, no classification, no bot/AI-agent surface. Full details in
    `docs/sprint2-pr12-session-features-observation.md`.
10. **Final observation status** — `PASS` / `WATCH` / `BLOCK` with explicit
    reason list. PR#12 contributions are merged into this status via the
    existing `decide()` function; BLOCK precedence over WATCH unchanged.
11. **Recommendation** — one-line phrase derived from the status.

## 6. PASS / WATCH / BLOCK decision

The script computes a status from the queried evidence:

### BLOCK if any of:

- `error ingest rows > 0` (any `auth_status <> 'ok'` OR
  `reject_reason_code IS NOT NULL` in window)
- `reconciliation violations > 0`
  (`accepted_count + rejected_count <> expected_event_count` on reconciled
  ingest rows)
- `ledger join skew > 0` (`ingest_requests` count column doesn't match
  actual `accepted_events` / `rejected_events` row count for that
  `request_id`)
- `unreconciled ingest rows > 0` (`reconciled_at IS NULL`) in window
- `canonical malformed rows > 0` (`canonical_jsonb IS NULL` OR
  `canonical_key_count <> 19`)
- accepted rows with malformed `payload_sha256` (length ≠ 64) > 0
- ingest rows with malformed `request_body_sha256` (length ≠ 64) > 0
- no `site_write_tokens` row at all for the boundary
- the most-recently-created token's `disabled_at IS NOT NULL` (i.e. the
  current active token has been killed)

### WATCH if no BLOCK but any of:

- `rejected events > 0` in window
- `total ingest rows = 0` in window (no data to evaluate; not safe to
  claim PASS)
- the active token's `last_used_at IS NULL` despite accepted events
  existing in window
- the active token's `last_used_at` is older than the window start (stale)

### PASS

All BLOCK and WATCH conditions clear.

### Recommendation phrasing

| Status | Recommendation |
|---|---|
| PASS | `Collector healthy. Ready to add next RECORD_ONLY event types.` |
| WATCH | `Collector readable observation has warnings. Fix before event expansion.` |
| BLOCK | `Collector blocked. Do not expand.` |

### Exit codes

| Status | Exit code |
|---|---|
| PASS | 0 |
| WATCH | 0 |
| BLOCK | 1 |

## 7. Privacy / safety guarantees

- ✅ **Strictly read-only.** Every query is a `SELECT`. No `INSERT` /
  `UPDATE` / `DELETE` / `BEGIN` / `COMMIT` / DDL anywhere.
- ✅ **No `token_hash` ever SELECTed.** Section 9 SELECTs only `token_id`,
  `disabled_at`, `last_used_at`, `created_at` — no auth material crosses
  the script's surface.
- ✅ **No raw bearer token.** The script never has access to one and never
  asks for one.
- ✅ **No peppers.** `SITE_WRITE_TOKEN_PEPPER` and `IP_HASH_PEPPER` are
  never read or printed by this script.
- ✅ **No IP hashes.** `ingest_requests.ip_hash` is never SELECTed.
- ✅ **No user agents.** `ingest_requests.user_agent` is never SELECTed.
- ✅ **`DATABASE_URL` masked.** The Boundary section prints only the
  protocol and host; userinfo and DB name are masked.
- ✅ **Bounded blast radius.** Every query is parameterised on
  `(WORKSPACE_ID, SITE_ID)` so even if the script were pointed at a DB
  containing other tenants, only the chosen boundary's rows are touched.

## 8. Operator runbook

### Routine check (post-deploy of new RECORD_ONLY event types)

```bash
cd /opt/buyerrecon-backend
set -a
source .env
source /root/buyerrecon_staging_site_token_meta.env
set +a
npm run observe:collector
```

Read the **status** line at the end:

- **PASS** → safe to flip the next RECORD_ONLY event type into the SDK.
- **WATCH** → review the WATCH reasons. Common causes:
  - rejected events suggest a malformed payload from the SDK — inspect §3
    breakdown for `reason_code` / `rejected_stage`.
  - stale `last_used_at` means no auth touch in the window — confirm the
    SDK is actually sending traffic with the live token.
  - `total ingest = 0` — the SDK isn't reaching the collector (check
    `BR_COLLECTOR_ENDPOINT`, network path, CORS).
- **BLOCK** → do NOT expand event types. Investigate the listed BLOCK
  reasons before any further change.

### Backfill inspection

```bash
OBS_WINDOW_HOURS=168 npm run observe:collector   # last 7 days
OBS_WINDOW_HOURS=720 npm run observe:collector   # last 30 days
```

### After kill-switch use

If the operator hit the kill switch (`UPDATE site_write_tokens SET
disabled_at = NOW() WHERE token_id = …`), this report will surface
**BLOCK** with reason `active token disabled_at = <timestamp>`. That is the
expected state. The block clears only after a fresh token row is created
per §3 of the PR#8c-LiveHook runbook.

## 9. Rollback

If the report itself needs to be removed:

1. Delete `scripts/collector-observation-report.ts`.
2. Revert `package.json` to drop the `observe:collector` script line.
3. Delete this doc.

No schema rollback, no migration rollback, no runtime rollback — PR#9
touches none of those.

## 10. Codex review checklist

1. ✅ `scripts/collector-observation-report.ts` contains no `INSERT` /
   `UPDATE` / `DELETE` / DDL / `BEGIN` / `COMMIT`.
2. ✅ The script never SELECTs `token_hash`, `ip_hash`, or `user_agent`.
3. ✅ The script never prints `DATABASE_URL`, `SITE_WRITE_TOKEN_PEPPER`,
   `IP_HASH_PEPPER`, or any raw bearer token.
4. ✅ All queries are parameterised on `WORKSPACE_ID` and `SITE_ID`.
5. ✅ Missing `DATABASE_URL` / `WORKSPACE_ID` / `SITE_ID` exits 1 with a
   clear message and no partial report.
6. ✅ Exit code is 1 if and only if the decided status is `BLOCK`.
7. ✅ No new runtime dependencies in `package.json` (`pg`, `dotenv`, `tsx`
   already present).
8. ✅ `npx tsc --noEmit` is clean.
9. ✅ `unset TEST_DATABASE_URL; npm test` still passes 1165/1165 — the
   script is not picked up by vitest (lives under `scripts/`, not `tests/`,
   filename doesn't end in `.test.ts`).
10. ✅ No changes to: `src/collector/v1/**`, `src/app.ts`, `src/server.ts`,
    `src/db/**`, `migrations/**`, `src/auth/**`, `src/collector/v1/index.ts`
    barrel, `.env.example`, `vitest.db.config.ts`.
11. ✅ No Track A imports (`ams-qa-behaviour-tests`). No Core AMS imports
    (`keigentechnologies/ams`).
12. ✅ No scoring / bot / AI-agent / `risk_score` / `classification` /
    `recommended_action` / `bot_score` / `agent_score` / `is_bot` /
    `is_agent` / `ai_agent` identifiers anywhere in PR#9 files.
13. ✅ No Playwright. No production URL in script source.
14. ✅ No commit, no push, no deploy.
