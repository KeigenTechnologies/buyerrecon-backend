# Sprint 1 PR#4 — workspace/site auth resolution layer

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §1 Decision #4 + §2.1 + §2.2 + §2.7 + §2.8 + §2.9 + §3.PR#4 + §3 invariants + §4.1 #5
**Status:** additive migration + schema-append + new pure auth module + structural smoke + pure-function unit tests + this doc + `.env.example` entry. **No collector wiring, no production migration run, no live tests, no commit.**

> Note on filename. Keeps the `sprint2-pr4-…` prefix for review-trail continuity with the PR#1 / PR#2 / PR#3 docs. Body content uses the canonical numbering: **Sprint 1 §3.PR#4** (the fourth migration of the Sprint 1 PR sequence).

---

## Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement collector routes.
This PR only prepares workspace/site auth resolution for future collector/database evidence.
```

---

## Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#4 is Track B evidence/security foundation. It is **not** Track A scoring and **not** Core AMS product code. The future bridge (Track B evidence → adapter → Core AMS scoring → RECORD_ONLY scoring/report output) is **not** built here.

---

## Purpose

Per handoff §3.PR#4 and §1 Decision #4: establish the auth-derived workspace/site boundary. The collector (wired in §3.PR#5) will resolve `workspace_id` and `site_id` from a site write token presented in the `Authorization` header, server-stamp those values onto every accepted/rejected/ingest_requests row, and reject any payload-side `workspace_id` / `site_id` that disagrees with the resolved values.

The §3 invariant: **workspace boundary is auth-derived, never payload-trusted.** PR#4 ships the table that backs this invariant plus a pure resolution helper. Collector wiring lands in PR#5.

---

## Token-hash strategy — HMAC-SHA256 with server pepper

```
token_hash = HMAC-SHA256(raw_token, SITE_WRITE_TOKEN_PEPPER)
```

**Why HMAC + pepper, not plain SHA-256.** Tokens are high-entropy by construction, so brute-forcing a single guessed token is infeasible regardless. The real threat is **DB leak → offline matching against a corpus of known-issued tokens** (e.g. tokens that leaked into log lines, CI fixtures, customer emails). Plain SHA-256 doesn't defend against that — pepper does. With the pepper held in env / secrets manager (never in DB), an attacker who steals only the database cannot match a stolen `token_hash` to any candidate raw token.

**Why no per-row salt.** Per-row salt protects low-entropy inputs (passwords). Tokens are already high-entropy unique strings, so per-row salt buys nothing the pepper doesn't already provide and breaks O(1) indexed lookup-by-hash. The pepper acts as a single global "salt" that's secure precisely because tokens are unique by issuance.

**Why raw token is never stored.** A leaked DB containing raw tokens is immediately catastrophic — every site write privilege is compromised. Storing only the HMAC means a leaked DB requires the additional pepper to weaponise, and rotation costs are bounded (re-issue tokens, do not need to refresh DB rows the same day).

**Pepper management.**
- Env var: `SITE_WRITE_TOKEN_PEPPER`
- Recommended length: ≥ 32 random bytes hex-encoded (64 hex chars)
- Generation: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Documented in `.env.example` (added in this PR)
- The PR#4 helper takes the pepper as a **parameter** (matching `encryptEmail(email, keyHex)` convention), so tests inject a deterministic test pepper without touching env. The thin `process.env.SITE_WRITE_TOKEN_PEPPER` read happens in PR#5 at the collector wiring site.
- **Loss of pepper requires re-issuing every site write token.** Document this for ops.

**Why not reuse `hashEmail`.** `src/probe/encrypt.ts`'s `hashEmail` lowercases + trims its input (correct for emails). Write tokens are case-sensitive opaque strings — normalising them silently loses entropy and produces false matches. The new helper is in a parallel-shape module (`src/auth/workspace.ts`) but does NOT call `hashEmail`.

---

## Table design — `site_write_tokens`

```sql
CREATE TABLE IF NOT EXISTS site_write_tokens (
  token_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      TEXT NOT NULL UNIQUE,                    -- HMAC-SHA256(raw_token, pepper)
  workspace_id    TEXT NOT NULL,
  site_id         TEXT NOT NULL,
  label           TEXT,                                    -- admin-friendly free-form description
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at     TIMESTAMPTZ,                             -- soft-delete sentinel; NULL = active
  last_used_at    TIMESTAMPTZ                              -- touched by PR#5+ collector
);

CREATE INDEX IF NOT EXISTS site_write_tokens_workspace_site
  ON site_write_tokens (workspace_id, site_id);

CREATE INDEX IF NOT EXISTS site_write_tokens_active
  ON site_write_tokens (token_hash) WHERE disabled_at IS NULL;
```

**Decisions:**
- **`token_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`** — follows `replay_runs.run_id` repo convention. `pgcrypto` is already loaded by `src/db/schema.sql`.
- **`token_hash TEXT NOT NULL UNIQUE`** — global uniqueness (no token may collide across workspaces). The UNIQUE creates an automatic index used for the hot-path `SELECT … WHERE token_hash = $1`.
- **`workspace_id NOT NULL`, `site_id NOT NULL`** — auth-derived boundary requires both. Mismatched payload values become `workspace_site_mismatch` per §4.1 #5.
- **`label TEXT` (nullable)** — admin-friendly description. Free-form. Optional.
- **`disabled_at TIMESTAMPTZ` (nullable)** — soft-delete sentinel; `NULL = active`. Active-tokens scans use the partial index.
- **`last_used_at TIMESTAMPTZ` (nullable)** — touched by PR#5+ collector when the token successfully resolves. **PR#4 helper does NOT write to it** (pure-function constraint).
- **No FK** — repo uses FKs only for `replay_evidence_cards → replay_runs`. Workspace/site canonical tables don't exist; the textual `workspace_id` / `site_id` are stable identifiers in their own right.
- **No DB CHECK enums** — same §2.9 closing-note deferral applied throughout PR#1–PR#3.

---

## Auth helper — `src/auth/workspace.ts`

Pure functions only. No DB connection. No env-var read. No logging.

| Function | Signature | Purpose |
|---|---|---|
| `hashSiteWriteToken` | `(token: string, pepper: string) => string` | Return HMAC-SHA256 of `(token, pepper)` as a 64-char hex digest. Throws on empty inputs. |
| `constantTimeHexEqual` | `(a: string, b: string) => boolean` | Constant-time hex comparison guard. Returns false on length mismatch (does not throw). |
| `resolveSiteWriteToken` | `(token, pepper, lookupByHash) => ResolveResult` | Resolve raw token to `(workspace_id, site_id, token_id)` via the caller's `lookupByHash` callback. |
| `assertPayloadBoundary` | `(resolved, payload?) => BoundaryResult` | Verify payload-side `workspace_id` / `site_id` (if present) match the auth-derived values. |

### Reason-code mapping (per §2.8)

| Result | Returned by | When |
|---|---|---|
| `auth_invalid` | `resolveSiteWriteToken` | Missing token, empty token, unknown token, or pepper missing |
| `auth_site_disabled` | `resolveSiteWriteToken` | Token row exists but `disabled_at IS NOT NULL` |
| `workspace_site_mismatch` | `assertPayloadBoundary` | Payload `workspace_id` differs from resolved, OR payload `site_id` differs from resolved |

### Boundary rules (per §1 Decision #4 + §3 invariant + §4.1 #5)

- `workspace_id` and `site_id` are **resolved from the site write token**. They are **never trusted from payload**.
- The collector (PR#5) will **stamp resolved values** onto every accepted/rejected/ingest_requests row.
- `assertPayloadBoundary` exists only to detect a sender that has supplied conflicting payload values — that is a `workspace_site_mismatch` reject (§4.1 #5: "Site-A write token submitting payload-side `site_id='B'` is rejected with HTTP 403 + `workspace_site_mismatch`").
- Payload missing both `workspace_id` and `site_id` is **OK** — the server stamps the resolved values. Most well-behaved SDKs will not send these fields.
- `assertPayloadBoundary` **never returns payload-side values** to the caller. It returns either `{ ok: true }` or `{ ok: false, reason_code: 'workspace_site_mismatch' }`.

### What the helper does NOT do

- **Does not connect to a DB.** The caller passes a `lookupByHash` callback that performs the SQL.
- **Does not read env vars.** The caller passes the pepper as a parameter.
- **Does not update `last_used_at`.** PR#5 wires that.
- **Does not log.** The caller decides what to log (§3.PR#9 admin debug logs are also separate).
- **Does not throw on auth failure.** Auth failures are returned as `{ ok: false, reason_code }` so the caller can stamp the right `auth_status` on `ingest_requests`.

---

## What this PR does

1. Adds `migrations/006_site_write_tokens.sql` — `CREATE TABLE site_write_tokens` per §3.PR#4 + two `CREATE INDEX IF NOT EXISTS`. Idempotent. No FK. No CHECK. No raw-token column.
2. Updates `src/db/schema.sql` — appends a `-- 11. Site write tokens` block matching the migration. No other table changed.
3. Adds `src/auth/workspace.ts` — the four pure functions described above.
4. Updates `.env.example` — adds `SITE_WRITE_TOKEN_PEPPER` with the same generation hint pattern as `PROBE_ENCRYPTION_KEY`.
5. Adds `tests/workspace-auth-pr4.test.ts` — 12 migration/schema structural tests + 1 env-example test + 28 helper unit tests + 11 scope-discipline tests.
6. Adds this document.

---

## What this PR does NOT do

- **Does NOT modify `accepted_events` / `rejected_events` / `ingest_requests`.** All three remain at PR#1–PR#3 closed state.
- **Does NOT wire the collector** (`src/collector/{routes,validate}.ts`). That is §3.PR#5.
- **Does NOT add `/v1/event` or `/v1/batch`.** That is §3.PR#7.
- **Does NOT update `last_used_at` on token use.** Helper is pure; collector wires that in §3.PR#5.
- **Does NOT introduce a token-rotation flow, revocation API, or admin endpoint to mint new tokens.** Those are operational surfaces that belong in the admin tooling (out of Sprint 1 scope; §3.PR#9 covers admin debug retrieval only).
- **Does NOT add a workspace or site canonical table** (e.g. `workspaces`, `sites`). The textual `workspace_id` / `site_id` are stable identifiers; canonical workspace/site tables are deferred indefinitely (none of the Sprint 1 PRs require them).
- **Does NOT introduce Track A scoring fields.** No `risk_score`, `classification`, `recommended_action`, `behavioural_score`, `bot_score`, `agent_score`. Track B Sprint 1 has no scoring surface.
- **Does NOT introduce bot detection or AI-agent detection.** Out-of-scope per §4.1 Task 1.
- **Does NOT touch production website repos, GTM, GA4, LinkedIn, ThinSDK, the report renderer, the Track A harness, or Core AMS.**
- **Does NOT build the future Track A backend bridge or any Core AMS scoring package.**

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs `tests/workspace-auth-pr4.test.ts` alongside the existing test files. All tests are pure (no DB connection, no network, no Playwright).

To verify the migration end-to-end against a **local dev** Postgres (do **not** point `$DATABASE_URL` at production):

```bash
psql "$DATABASE_URL" -f migrations/006_site_write_tokens.sql
psql "$DATABASE_URL" -c '\d site_write_tokens'
```

`\d site_write_tokens` should show all 8 columns + the two indexes + the implicit unique index on `token_hash`.

---

## Rollback plan

Migration is strictly additive. Rollback drops the two indexes and the table:

```sql
DROP INDEX IF EXISTS site_write_tokens_active;
DROP INDEX IF EXISTS site_write_tokens_workspace_site;
DROP TABLE IF EXISTS site_write_tokens;
```

To roll back the schema-append in `src/db/schema.sql`, revert the `-- 11. Site write tokens (Sprint 1 PR#4, …)` block.
To roll back the auth helper, delete `src/auth/workspace.ts` (and the empty `src/auth/` directory).
To roll back the `.env.example` change, revert the `SITE_WRITE_TOKEN_PEPPER` lines.
To roll back the test file and doc, delete them.

**No FK references this table** — rollback cannot affect any other schema.
**No application code yet reads or writes site_write_tokens at runtime** — collector wiring lands in §3.PR#5. Rollback cannot break a runtime path.
**`accepted_events`, `rejected_events`, `ingest_requests`** are not touched by PR#4 — rollback cannot affect them.

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## Relationship to the three-part architecture

- **PR#4 is Track B evidence/security foundation** — additive table + pure auth helper. No scoring.
- **PR#4 is not Track A scoring.** The auth helper has zero imports from `/Users/admin/github/ams-qa-behaviour-tests` and adds no scoring fields.
- **PR#4 is not Core AMS product code.** No imports from `/github/keigentechnologies/ams`. No move of harness code into Core AMS.
- **Track A scoring remains a local harness** until a later, explicitly scoped bridge PR.
- **Future direction (not built here):** Track B DB evidence → adapter / bridge → Core AMS scoring package → RECORD_ONLY scoring/report output (stored in a separate table, never overwriting evidence rows).
- **Dependency chain to Track A Sprint 2:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → **§3.PR#4 (this)** → §3.PR#5 (collector wiring) → §3.PR#7 (`/v1/*` routes) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK file touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS=true` never set. No Playwright, no network call, no DB connection.
- **No collector / route / validator / metrics code** modified anywhere under `src/`. The only `src/` additions are `src/auth/workspace.ts` (new pure module) and the schema.sql append.
- **No `accepted_events` / `rejected_events` / `ingest_requests` change** — verified by structural smoke tests in the PR#4 test file.
- **No raw-token column anywhere** — verified by both migration-side and schema.sql-side negative assertions.
- **No Track A scoring surface introduced** — verified by structural smoke tests on the migration, the helper module, and the doc.
- **No commit was created by this PR.** Working-tree changes only.

---

## Next PR — §3.PR#5

Collector envelope + per-stage validators + canonical reason-code enum. Wires the actual `Authorization`-header read, calls `resolveSiteWriteToken` and `assertPayloadBoundary` from this PR, writes `ingest_requests` first (with `auth_status` populated), then per-event accepted/rejected. Lands the `validator_version` stamp on every accepted row. **Out of scope for PR#4 — do not start.**
