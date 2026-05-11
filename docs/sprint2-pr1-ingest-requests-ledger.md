# Sprint 1 PR#1 — `ingest_requests` ledger (additive, new table only)

**Date:** 2026-05-09
**Repo:** `buyerrecon-backend`
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md`, §2.7 + §3.PR#1
**Status:** additive migration + schema-append + structural smoke tests + reconciliation SQL + this doc. **No collector wiring, no production migration run, no live tests, no commit.**

> Note on filename. This doc keeps the prior filename `sprint2-pr1-ingest-requests-ledger.md` for continuity with earlier review correspondence. The canonical handoff numbers this PR as **Sprint 1 §3.PR#1** (the first migration of the Sprint 1 PR sequence). Body content uses the canonical numbering.

---

## Purpose of `ingest_requests`

Per §2.7: *"Per-request reconciliation table. Every collector request lands a row before any per-event work. Without this, 'did we explain every event?' cannot be answered."*

Once wired, the ledger backs the evidence claim:

> Every collector request can be explained by `expected_event_count`, `accepted_count`, `rejected_count`, and (for request-level rejections) `reject_reason_code` — with the SHA-256 of the raw HTTP body recorded as proof on `request_body_sha256`, even when the body was unparseable.

PR#1 introduces the table and its indexes. **No application code yet writes to it.** The collector write-path wiring lands in §3.PR#5.

---

## Table fields (per §2.7)

| Field | Type | Nullability | Notes |
|---|---|---|---|
| `request_id` | `UUID` | **PK** (no DB default) | collector generates the UUID at request start |
| `received_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | server timestamp |
| `workspace_id` | `TEXT` | nullable | auth-derived in §3.PR#4 |
| `site_id` | `TEXT` | nullable | auth-derived in §3.PR#4 |
| `endpoint` | `TEXT` | NOT NULL | `/v1/event` \| `/v1/batch` |
| `http_status` | `INT` | nullable | 200, 400, 413, 401, 403, 415, 429, 500 |
| `size_bytes` | `INT` | NOT NULL | bytes received on the wire |
| `user_agent` | `TEXT` | nullable | |
| `ip_hash` | `TEXT` | NOT NULL | workspace-salted; raw IP never stored |
| `request_body_sha256` | `TEXT` | NOT NULL | SHA-256 of the FULL HTTP request body. Distinct from `accepted_events.payload_sha256` (per-event) and `rejected_events.raw_payload_sha256` (per-rejected-event). Always set, even on unparseable bodies — this is the only proof when the body cannot be parsed. |
| `expected_event_count` | `INT` | NOT NULL (no default) | `1` for `/v1/event`; `events.length` for `/v1/batch`; `0` when rejected pre-parse |
| `accepted_count` | `INT` | NOT NULL, default `0` | |
| `rejected_count` | `INT` | NOT NULL, default `0` | |
| `reconciled_at` | `TIMESTAMPTZ` | nullable | set once `accepted + rejected = expected`. For request-level rejection, set in the same code path as the rejection response |
| `auth_status` | `TEXT` | NOT NULL | `ok` \| `invalid_token` \| `site_disabled` \| `boundary_mismatch` (DB CHECK enum deferred per §2.9 closing note) |
| `reject_reason_code` | `TEXT` | nullable | populated only when whole request rejected before per-event work |
| `collector_version` | `TEXT` | NOT NULL | |

**Indexes:**
- `ingest_requests_workspace_received` on `(workspace_id, site_id, received_at)`
- `ingest_requests_unreconciled` on `(received_at) WHERE reconciled_at IS NULL` (partial)

**Reconciliation invariant** (§2.7):
```
For every row, accepted_count + rejected_count = expected_event_count
once reconciled_at IS NOT NULL.
```
Per §2.7 this invariant is enforced by the §2.12 SQL verification suite (scheduled by §3.PR#8) — **not** as a table CHECK constraint. PR#1 deliberately does not add one. See §2.9 closing note ("DB CHECK promotion deferred to Sprint 2+").

---

## What this PR does

1. Adds `migrations/003_ingest_requests.sql`. Creates the table (idempotent `IF NOT EXISTS`), two indexes (one partial). No existing table is altered.
2. Appends the same DDL to `src/db/schema.sql` so fresh `initDb()` installs include the table.
3. Adds reconciliation SQL `docs/sql/reconciliation/001_ingest_requests_reconciliation.sql` — internal-count check using `reconciled_at IS NOT NULL` as the §2.7 gate, with a TODO block carrying the runnable cross-table JOIN that becomes valid after §3.PR#2 / §3.PR#3.
4. Adds Vitest structural smoke tests `tests/ingest-requests.test.ts`. Pure-text-level (no DB connection) per existing repo convention.
5. Adds this document.

---

## What this PR does NOT do (per §3.PR#1 + §4.1 "Out of scope for Task 1")

- **Does NOT wire the collector to write `ingest_requests` rows** — that is §3.PR#5.
- **Does NOT add `request_id` to `accepted_events` / `rejected_events`** — that is §3.PR#2 / §3.PR#3.
- **Does NOT introduce auth-derived `workspace_id` / `site_id` resolution** — that is §3.PR#4.
- **Does NOT introduce per-stage validators or the §2.8 canonical reason-code enum** — that is §3.PR#5.
- **Does NOT add the `(workspace_id, site_id, client_event_id)` unique index** — that is §3.PR#6.
- **Does NOT add `/v1/event` or `/v1/batch` routes** — that is §3.PR#7.
- **Does NOT wire the §2.12 SQL verification suite** — that is §3.PR#8.
- **Does NOT add the admin debug API** — that is §3.PR#9.
- **Does NOT implement bot detection, AI-agent classification, gzip support, historical-import endpoint, customer-facing replay UI, customer-facing live event stream, external schema registry microservice, or destination routing** (§4.1 Out-of-scope clause).
- **Does NOT enforce the reconciliation invariant as a DB CHECK constraint** (§2.7 places enforcement on the §2.12 SQL suite; §2.9 defers DB CHECK promotion).
- **Does NOT promote any DB CHECK enum** (e.g. on `auth_status`) — same §2.9 deferral.
- **Does NOT touch production website repos, GTM, GA4, LinkedIn, ThinSDK, or any production endpoint.**
- **Does NOT touch the local AMS QA harness at `/Users/admin/github/ams-qa-behaviour-tests`.**

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs `tests/ingest-requests.test.ts` alongside the existing `tests/validate.test.ts` and `tests/encrypt.test.ts`. The new tests are pure-text-level smoke tests — no Postgres connection.

To verify the migration end-to-end against a **local dev** Postgres (do **not** point `$DATABASE_URL` at production):

```bash
psql "$DATABASE_URL" -f migrations/003_ingest_requests.sql
psql "$DATABASE_URL" -c '\d ingest_requests'
psql "$DATABASE_URL" -f docs/sql/reconciliation/001_ingest_requests_reconciliation.sql
```

The `\d ingest_requests` output should match §2.7 exactly, including the `request_body_sha256` column. The reconciliation query returns zero rows on an empty / healthy table.

---

## Rollback plan

Migration is strictly additive — it only creates a new table and two indexes. Rollback is one `DROP TABLE`:

```sql
DROP INDEX IF EXISTS ingest_requests_unreconciled;
DROP INDEX IF EXISTS ingest_requests_workspace_received;
DROP TABLE IF EXISTS ingest_requests;
```

To roll back the schema-append in `src/db/schema.sql`, revert the `-- 10. Ingest requests ledger (Sprint 1 PR#1, per handoff §2.7).` block at the tail.

To roll back the smoke tests / reconciliation SQL / docs, simply delete the four new files. None are referenced from production code.

**No existing accepted_events / rejected_events data is changed by this PR — rollback cannot affect them.** No application code yet writes to `ingest_requests`, so rollback cannot break a runtime path.

---

## Next PRs (per §3 commit list)

| PR | Scope | Touches |
|---|---|---|
| **§3.PR#2** | Augment `accepted_events` with v1 evidence columns (additive ALTERs, incl. `request_id UUID` initially nullable) | `accepted_events` |
| **§3.PR#3** | Augment `rejected_events` with `reason_code` + `request_id` + stage / detail / hash columns; preserve `reason_codes[]` for back-compat | `rejected_events` |
| **§3.PR#4** | Workspace resolution layer + `site_write_tokens` table | new auth module + new table |
| **§3.PR#5** | Wire collector to per-stage validators; write `ingest_requests` first, then per-event accepted/rejected; canonical §2.8 reason-code enum | `src/collector/*` |
| **§3.PR#6** | Unique constraint on `(workspace_id, site_id, client_event_id)` | `accepted_events` |
| **§3.PR#7** | Add `/v1/event` + `/v1/batch` (batch behind feature flag) | `src/collector/routes.ts` |
| **§3.PR#8** | Wire §2.12 SQL verification suite as scheduled job + `verification_violations` | new metrics module + new table |
| **§3.PR#9** | Admin-only debug API + `admin_debug_audit_log` | new admin routes + new table |

PR#1 is intentionally narrow so each subsequent PR can be reviewed in isolation.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. The local AMS QA harness was not opened, read for editing, or modified.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK file touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS=true` is never set. No Playwright, no network call.
- **No collector / route / validator code** modified anywhere under `src/collector/*` or `src/routes/*`.
- **No CHECK constraint** introduced by this migration (per §2.7 + §2.9). The reconciliation invariant is the §2.12 SQL suite's responsibility (§3.PR#8).
- **No bot / AI-agent claim** anywhere in this PR. Disclaimers in source comments are explicit.
- **No commit was created by this PR.** Working tree changes only; `git status` will show the new files until the maintainer reviews and commits.
