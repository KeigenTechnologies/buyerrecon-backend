# Sprint 1 PR#7 — `/v1/event` + `/v1/batch` routes, env loader, transactional persistence

> **Hard-rule disclaimer.** PR#7 is Track B (BuyerRecon Evidence Foundation)
> only. It is NOT Track A (AMS Behaviour QA scoring harness) and NOT Core AMS
> (the future productized scoring/report home). PR#7 introduces no bot
> detection, no AI-agent detection, no risk scoring, no classification, no
> recommended-action surface, no behavioural-quality scoring, no Track A
> imports, no Core AMS imports. It mounts two HTTP routes, loads two env-only
> secrets, and wires real DB inserts behind the existing PR#5c-2 `runRequest`
> orchestrator. Nothing else.

## 1. Three-part architecture rule

- **Track B** records evidence. PR#7 is the evidence write path.
- **Track A** experiments with scoring. PR#7 does not import or depend on it.
- **Core AMS** will later productize mature scoring/report modules. PR#7 does
  not import or depend on it.

PR#7 follows the same scope rule as every prior Track B PR — Track B owns the
write/evidence side; scoring lives elsewhere.

## 2. Route contract

| Method | Path | Purpose | Body limit (contract) | Outer transport cap |
|---|---|---|---|---|
| POST | `/v1/event` | single accepted/rejected event | 32 KB (parseEnvelope) | 1 MB (`express.raw`) |
| POST | `/v1/batch` | ≤100 events; feature-flagged | 512 KB (parseEnvelope) | 1 MB (`express.raw`) |

- `/v1/event` is always on.
- `/v1/batch` is gated by `ENABLE_V1_BATCH`. When the flag is `!== 'true'`,
  the route returns **HTTP 404 with `{ "error": "v1_batch_disabled" }`**;
  `runRequest` is NOT called and **NO DB writes happen**.
- Route file: `src/collector/v1/routes.ts` exports a `createV1Router(deps)`
  factory. Mounted in `src/server.ts` BEFORE the global
  `app.use(express.json({ limit: '100kb' }))` so the route-scoped
  `express.raw({ type: '*/*', limit: '1mb' })` middleware captures the exact
  body bytes before any other parser can.
- Legacy `/collect`, `/config/*`, `/probe/*` routes are **unchanged** and
  continue to use the global JSON parser.

## 3. Raw body capture strategy

- `express.raw({ type: '*/*', limit: '1mb' })` is route-scoped on the v1
  router. Sets `req.body` to the exact wire `Buffer`.
- `'*/*'` covers malformed `Content-Type`s so the orchestrator can emit
  `content_type_invalid` itself (the ledger row is still written).
- `'1mb'` is the outer transport ceiling. The 32 KB / 512 KB / 100-event
  contract limits are enforced inside `parseEnvelope` so oversized in-near-miss
  requests still produce a `request_too_large` / `batch_too_large` ingest row.
- `RequestContext.raw_body_bytes = req.body` — never reconstructed from
  parsed JSON. `ingest_requests.request_body_sha256 = sha256Hex(raw_body_bytes)`
  is byte-accurate.
- Invalid JSON still preserves the raw bytes: orchestrator returns
  `request_body_invalid_json` (HTTP 400), persistence writes exactly one
  `ingest_requests` row, no event rows.

## 4. Env / config contract

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SITE_WRITE_TOKEN_PEPPER` | yes | — | HMAC pepper for `hashSiteWriteToken` (auth lookup). |
| `IP_HASH_PEPPER` | yes | — | HMAC pepper for `ipHash` (IP anonymisation). Distinct from auth pepper. |
| `ENABLE_V1_BATCH` | no | `false` | `/v1/batch` feature flag. Only literal `'true'` enables. |
| `ALLOW_CONSENT_STATE_SUMMARY` | no | `false` | Opt-in for `consent_state_summary` in `canonical_jsonb`. Only literal `'true'` enables. |

Constants (NOT env-loaded by `loadV1ConfigFromEnv`):

- `collector_version` ← `src/constants.ts` `COLLECTOR_VERSION`.
- `validator_version` ← `src/collector/v1/index.ts` `VALIDATOR_VERSION` (Decision D11 lock).
- `event_contract_version` ← `src/constants.ts` `CANONICAL_CONTRACT_VERSION = 'event-contract-v0.1'`.

Loader behaviour (`src/collector/v1/config.ts`):

- Throws on missing or empty `SITE_WRITE_TOKEN_PEPPER` / `IP_HASH_PEPPER`.
- `process.env` is read **only** in this loader. `runRequest` and all PR#5
  helpers never read env.
- Loaded once at app boot in `src/server.ts`. The frozen result is closed
  over by `createV1Router`.
- Test secrets are obvious placeholders (`'test-ip-pepper-1'` etc.). No real
  secrets in tests or docs.
- `.env.example` carries placeholder values with comments explaining how to
  generate real ones (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

## 5. Auth lookup contract

- Header: `Authorization: Bearer <token>`. Scheme matched case-insensitively.
- `extractBearerToken` returns `null` for missing / malformed / non-Bearer /
  empty / multi-part headers. `null` → orchestrator emits `auth_invalid`.
- Token hashing: `hashSiteWriteToken(token, SITE_WRITE_TOKEN_PEPPER)` (HMAC).
- DB lookup: `SELECT token_id, workspace_id, site_id, disabled_at FROM site_write_tokens WHERE token_hash = $1 LIMIT 1`.
- **Prefetch adapter pattern**: the async lookup runs in `auth-route.ts`,
  then a sync closure (`() => prefetchedRow`) is passed to the existing
  pure `resolveSiteWriteToken` (from `src/auth/workspace.ts`). PR#4 module
  stays frozen.
- Active row → `{ status: 'ok', resolved: {token_id, workspace_id, site_id}, reason_code: null }`.
- Disabled row → `{ status: 'site_disabled', resolved: null, reason_code: 'auth_site_disabled' }`.
- Unknown / lookup-miss → `{ status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' }`.
- DB throw → caught by the route handler and mapped to HTTP 500
  `{ request_id, error: 'auth_lookup_failure' }`. No `ingest_requests` row
  is written (we never reached the transaction).
- `last_used_at` update: best-effort, fire-and-forget, **outside** the main
  transaction. Errors swallowed by `touchTokenLastUsedAt`.

## 6. DB transaction contract

One transaction per request (`src/collector/v1/persistence.ts`):

1. `BEGIN`
2. `INSERT INTO ingest_requests` (initial `accepted_count=0`, `rejected_count=0`,
   `reconciled_at=null`; `http_status` set to `output.http_status`).
3. Per-row `INSERT INTO accepted_events … ON CONFLICT (workspace_id, site_id, client_event_id) WHERE … DO NOTHING RETURNING event_id`.
   - `rowCount === 0` → PR#6 partial index hit → reclassify (see §7).
   - Throws with `code === '23505'`, `constraint === 'idx_accepted_dedup_client_event'` → legacy index hit → also reclassify.
   - Throws with `code === '23505'`, unknown `constraint` → ROLLBACK + rethrow.
   - Any other throw → ROLLBACK + rethrow.
4. `INSERT INTO rejected_events` for `[...output.rejected, ...reclassified]`.
   Any throw → ROLLBACK + rethrow.
5. `UPDATE ingest_requests SET accepted_count = $1, rejected_count = $2, reconciled_at = $3, http_status = $4 WHERE request_id = $5` with the **final post-rebucketing** counts.
6. `COMMIT`.
7. Best-effort `UPDATE site_write_tokens SET last_used_at = NOW() WHERE token_id = $1` (outside main transaction).

Parameter shapes:

- All SQL uses positional `$N` parameters. No string interpolation.
- JSONB columns (`accepted_events.raw`, `accepted_events.canonical_jsonb`,
  `rejected_events.raw`, `rejected_events.schema_errors_jsonb`,
  `rejected_events.pii_hits_jsonb`) pass as JS objects/arrays. **Never
  pre-stringified** — pg encodes JSONB internally; pre-stringifying
  double-encodes.
- `Date` columns pass as `Date` instances. Never ISO strings.
- `rejected_events.reason_codes TEXT[]` passes as JS array.

Client acquisition:

- `client = await pool.connect()`. `try { … BEGIN/COMMIT/ROLLBACK … } finally { client.release(); }`.

## 7. `accepted_events_dedup` conflict handling (PR#6 carry-forward)

`accepted_events_dedup` is a partial UNIQUE INDEX on
`(workspace_id, site_id, client_event_id)` with predicate "all three IS NOT NULL"
(PR#6 migration 007).

PR#7 handles conflict cleanly without 5xx:

- **Primary path:** `INSERT … ON CONFLICT (cols) WHERE … DO NOTHING RETURNING event_id`.
  PG silently swallows the conflict; rowCount is 0; no exception unwinds.
- **Legacy fallback:** legacy `idx_accepted_dedup_client_event` is a different
  triple; `ON CONFLICT` cannot match it, so a 23505 is thrown. The persistence
  `try/catch` checks `err.code === '23505' && err.constraint` against both
  index names and reclassifies on either.
- **Reclassification:** the accepted candidate becomes a `RejectedEventRow` with:
  - `reason_code = 'duplicate_client_event_id'`
  - `rejected_stage = 'dedupe'`
  - `raw = accepted.raw` (the original event fragment)
  - `raw_payload_sha256 = payloadSha256(accepted.raw)` — **NOT** reusing
    `accepted.payload_sha256` (which hashes the normalised envelope; different
    shape per §2.5 line 168 contract).
  - `size_bytes = Buffer.byteLength(stableStringify(accepted.raw), 'utf8')`
  - `reason_codes = ['duplicate_client_event_id']` (dual-write per PR#3)
  - `workspace_id`, `site_id`, `client_event_id`, `schema_*`, `event_type`,
    `id_format` copied from the accepted candidate.
- **Response rebucketing:** the corresponding `response.results` entry flips
  from `{status:'accepted'}` → `{status:'rejected', reason_code:'duplicate_client_event_id'}`.
- **Count reconciliation:** the final `UPDATE ingest_requests` writes
  `accepted_count = (accepted rows actually inserted)` and
  `rejected_count = (original rejected + reclassified)`. Sum is unchanged so
  the §2.7 invariant holds.
- **Unknown 23505 constraint:** ROLLBACK and rethrow. Defence in depth.

**Critical guarantee:** an SDK cross-request retry hitting the unique index
NEVER produces a raw 500. The response is HTTP 200 with one of:
- `{ status: 'accepted', reason_code: null }` if the dedup gate didn't fire
  (e.g. a benign new event), or
- `{ status: 'rejected', reason_code: 'duplicate_client_event_id' }` for the
  retried duplicate.

## 8. Row-to-SQL mapping

Row object keys map 1:1 to column names. All `IngestRequestRow`,
`AcceptedEventRow`, and `RejectedEventRow` fields are populated by the PR#5
row-builders before reaching persistence; PR#7 forwards them verbatim.

- `ingest_requests` (17 columns) — including `request_body_sha256`,
  `ip_hash`, `expected_event_count`, `auth_status`, `reject_reason_code`.
- `accepted_events` (37 columns including legacy NOT NULL shims like
  `hostname='__unknown_host__'`, `session_id='__server__'`, `browser_id='__server__'`).
- `rejected_events` (23 columns including dual-write `reason_codes[]` mirror
  of `reason_code`).

## 9. HTTP response contract

| Path | Outcome | Status | Body |
|---|---|---|---|
| `/v1/event`, `/v1/batch` | success (any parseable mix) | 200 | `output.response` post-rebucketing |
| `/v1/event`, `/v1/batch` | auth invalid | 401 | `output.response` (empty results) |
| `/v1/event`, `/v1/batch` | site disabled / boundary mismatch | 403 | as above |
| `/v1/event`, `/v1/batch` | invalid JSON | 400 | as above |
| `/v1/event` | body > 32 KB | 413 | as above |
| `/v1/batch` | body > 512 KB or > 100 events | 413 | as above |
| `/v1/event`, `/v1/batch` | non-JSON Content-Type | 415 | as above |
| `/v1/batch` | feature flag off | 404 | `{ "error": "v1_batch_disabled" }` |
| any | missing IP | 500 | `{ request_id, error: 'collector_misconfigured' }` |
| any | auth lookup DB throw | 500 | `{ request_id, error: 'auth_lookup_failure' }` |
| any | persistence throw (non-conflict) | 500 | `{ request_id, error: 'storage_failure' }` |

Safe-enum error codes only. No raw payloads, no token hashes, no env names,
no PG details, no stack traces.

## 10. Security / privacy / compliance

- Raw token is discarded after `hashSiteWriteToken`. Never stored or logged.
- `Authorization` header never logged. Logger receives only
  `{ request_id, kind, message }` and `message` is derived from
  `err.message` only — not from full error objects or stack traces.
- `site_write_tokens.token_hash` is HMAC(`token`, `SITE_WRITE_TOKEN_PEPPER`).
  Raw token never enters DB.
- `ingest_requests.ip_hash` uses HMAC(`ip`, `workspace_id`, `IP_HASH_PEPPER`).
  Raw IP never stored.
- Missing IP → HTTP 500 `collector_misconfigured`. **Never faked** to
  `0.0.0.0` / `unknown` / any sentinel. Faking would silently corrupt
  per-IP request-rate evidence.
- PII handling: orchestrator PII gate rejects events with PII into
  `rejected_events`. Accepted-path `canonical_jsonb` is data-minimised.
- Rejected `raw` may carry PII fragments — retention/admin visibility rules
  are PR#9 concerns, not PR#7.
- `debug_mode = false` always for site-token writes (row-builders enforce).
- CORS: `Authorization` and `authorization` added to `allowedHeaders` so
  browser SDKs can send the bearer token cross-origin. `ALLOWED_ORIGINS`
  allow-list is preserved.
- Rate limiting: out of scope for PR#7. Deferred to ops layer.
- Body size limits: outer `express.raw({limit:'1mb'})`; inner contract limits
  by `parseEnvelope` (32 KB / 512 KB / 100 events).
- Transaction rollback safety: ROLLBACK on any non-conflict error; tests
  assert ROLLBACK fires on simulated insert failure.

## 11. Relationship to PR#8

PR#7 ships (fake-pool tests):

- Routes wired and respond.
- Env loader exists and throws at boot on missing peppers.
- Auth lookup wired with prefetch adapter.
- Transaction insert functions exist and ROLLBACK on non-conflict errors.
- `accepted_events_dedup` conflict handling implemented + unit-tested with
  simulated 23505.

PR#8 must still prove (against a real DB):

- §2.12 reconciliation queries: `accepted_count + rejected_count =
  expected_event_count` observed in DB rows.
- Real-DB cross-request retry: 50 SDK retries of the same `client_event_id`
  → exactly 1 row in `accepted_events`; 49 rows in `rejected_events` with
  `reason_code='duplicate_client_event_id'`.
- `pg_index.indisvalid = true` for `accepted_events_dedup`.
- Stored payload hashes match `sha256Hex(raw bytes)` etc. from the wire.
- Raw purge / retention behaviour (`payload_purged_at`) if in scope.
- One-site RECORD_ONLY smoke proof; multi-site smoke proof.

## 12. Rollback plan

To roll back PR#7:

1. Delete `src/collector/v1/{config,http-context,auth-route,persistence,routes}.ts`.
2. Delete `tests/v1/{config,http-context,auth-route,persistence,persistence-conflict,routes,scope-pr7}.test.ts`.
3. Delete `docs/sprint2-pr7-routes-sql-env.md`.
4. Revert `src/server.ts` to remove v1 router import / mount and the
   `Authorization` CORS header addition.
5. Revert `.env.example` to drop `IP_HASH_PEPPER`, `ENABLE_V1_BATCH`,
   `ALLOW_CONSENT_STATE_SUMMARY`.
6. No schema rollback needed — PR#7 adds no migrations.
7. Verify legacy `/collect`, `/health`, `/config/*`, `/probe/*` still work
   and `npm test` returns to the pre-PR#7 baseline.

PR#6's `accepted_events_dedup` index is a separate PR with its own rollback.
Without PR#7 routes, the index has nothing to fire against; harmless.

## 13. Codex review checklist

1. ✅ `src/collector/v1/routes.ts` exports `createV1Router(deps)`.
2. ✅ Route-scoped `express.raw({type:'*/*', limit:'1mb'})` is the first
   middleware on the v1 router.
3. ✅ `src/server.ts` mounts the v1 router **before**
   `app.use(express.json(...))`.
4. ✅ `src/server.ts` CORS `allowedHeaders` includes `'Authorization'` and
   `'authorization'`.
5. ✅ `RequestContext.raw_body_bytes` is the exact `req.body` Buffer; no
   reconstruction.
6. ✅ `request_body_sha256` parameter on the INSERT equals
   `sha256Hex(req.body)`.
7. ✅ `loadV1ConfigFromEnv` throws on missing/empty `SITE_WRITE_TOKEN_PEPPER`
   or `IP_HASH_PEPPER`.
8. ✅ `process.env` is read only inside `loadV1ConfigFromEnv` (and existing
   `src/constants.ts` / `src/server.ts` boot code).
9. ✅ Bearer extraction handles missing / empty / non-Bearer / malformed
   → `auth_invalid`.
10. ✅ Auth lookup SELECT queries `site_write_tokens WHERE token_hash = $1 LIMIT 1`.
11. ✅ Prefetch-adapter pattern: sync `resolveSiteWriteToken` called with a
    closed-over prefetched row. `src/auth/workspace.ts` unchanged.
12. ✅ Single `BEGIN` and `COMMIT` (or `ROLLBACK`) per request.
13. ✅ Accepted INSERT uses
    `ON CONFLICT (workspace_id, site_id, client_event_id) WHERE … DO NOTHING RETURNING event_id`.
14. ✅ `rowCount === 0` reclassifies as `duplicate_client_event_id` rejected.
15. ✅ Legacy `idx_accepted_dedup_client_event` 23505 caught via try/catch
    and also reclassified.
16. ✅ Unknown 23505 constraint → ROLLBACK + rethrow → 500.
17. ✅ JSONB parameters passed as JS objects, never strings.
18. ✅ `Date` parameters passed as `Date` instances.
19. ✅ `reason_codes` passed as JS array.
20. ✅ `last_used_at` UPDATE outside main transaction; never fails the
    response.
21. ✅ HTTP response body equals final persisted outcome (post-rebucketing).
22. ✅ Missing IP → 500 `collector_misconfigured`; no fake IP injected.
23. ✅ Error responses include `request_id` + fixed-enum error code only.
24. ✅ `Authorization` header never logged.
25. ✅ Raw token discarded after `hashSiteWriteToken`.
26. ✅ `/v1/batch` returns HTTP 404 `{ error: "v1_batch_disabled" }` and
    writes NO DB rows when `ENABLE_V1_BATCH !== 'true'`.
27. ✅ `src/collector/v1/index.ts` barrel still has exactly 4 `export *`
    lines.
28. ✅ No new file imports Track A or Core AMS paths.
29. ✅ No `risk_score` / `classification` / `recommended_action` / bot /
    AI-agent identifiers in active code.
30. ✅ No Playwright import; no production URL in tests.
31. ✅ `.env.example` placeholders only — no real secrets.
32. ✅ `npx tsc --noEmit` passes.
33. ✅ `npm test` passes — all prior tests still pass; new PR#7 tests pass.
34. ✅ Migration 007 is not re-applied; no live DB write of any kind during
    tests.
35. ✅ Legacy `/collect`, `/config/*`, `/probe/*`, `/health` still work
    (their tests still pass).
36. ✅ `src/db/schema.sql`, `src/collector/v1/orchestrator.ts`, row-builders,
    and all PR#5/PR#6 helper modules are unchanged.
37. ✅ Reconciliation invariant
    `final_response.accepted_count + final_response.rejected_count ===
    output.ingest_request.expected_event_count` holds in every persistence test.
38. ✅ No commit, no push, no deploy.
