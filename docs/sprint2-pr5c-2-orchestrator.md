# Sprint 1 PR#5c-2 — v1 collector orchestrator

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.1 + §2.2 + §2.5 + §2.6 + §2.7 + §2.8 + §2.11 + §3.PR#5
**Status:** one new orchestrator module + one new test file + this doc. Narrow type widening on `BuildRejectedEventRowArgs.raw_event` (per Option A locked decision). **No orchestrator route binding, no DB writes, no env reads, no token lookup, no commit.**

> Filename uses the `sprint2-pr5c-2-…` prefix for review-trail continuity. Body content uses the canonical numbering: **Sprint 1 §3.PR#5c-2**, the second sub-PR of the §3.PR#5c split (PR#5c-1 = normalisedEnvelope + row-builder bodies; **PR#5c-2 = orchestrator composing the v1 pipeline**).

---

## 1. Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement Track A backend bridge.
This PR does not implement Core AMS scoring.
This PR does not implement routes, DB writes, or env reads.
This PR does not call resolveSiteWriteToken or any DB lookup.
This PR only adds the route-free orchestrator that composes Track B v1 helpers into a single runRequest entry point.
```

---

## 2. Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5c-2 composes PR#5a/5b-1/5b-2/5b-3/5c-1 helpers into a single `runRequest(input)` function. Zero scoring fields. Zero imports from Track A or Core AMS.

---

## 3. PR#5c-2 boundary

PR#5c-2 ships the **orchestrator only**. It is intentionally route-free, DB-free, and env-free so PR#7 can wire it to HTTP routes + SQL inserts + env loading in one focused change.

| In PR#5c-2 | Deferred to PR#7 |
|---|---|
| `runRequest(input): OrchestratorOutput` | HTTP route handlers (`/v1/event`, `/v1/batch`) |
| Compose pipeline: envelope → validation → PII → boundary → canonical → consent → dedupe → row-builders | `pool.query` for `INSERT INTO ingest_requests / accepted_events / rejected_events` |
| Inject `auth` as a pre-resolved input | Call `resolveSiteWriteToken` from `src/auth/workspace.ts` |
| Inject `config` (peppers, version strings, feature flag) | Read `process.env.SITE_WRITE_TOKEN_PEPPER` / `IP_HASH_PEPPER` / `COLLECTOR_VERSION` |
| Return `OrchestratorOutput` row candidates | Bind output to HTTP response body + status code |
| Throw `TypeError` on missing `ctx.ip` (no fake-IP fallback) | Catch the throw and respond 500 |
| `.env.example` unchanged | Add `IP_HASH_PEPPER` to `.env.example` |

---

## 4. Files added / modified

| File | Change | Lines |
|---|---|---|
| `src/collector/v1/orchestrator.ts` | **NEW** — `runRequest`, `interface RunRequestInput`, `interface CollectorConfig`, private helpers | ~430 |
| `tests/v1/orchestrator.test.ts` | **NEW** — request-level / event-level / batch / consent regression / scope discipline | ~530 |
| `src/collector/v1/row-builders.ts` | **NARROW TYPE WIDENING** — `BuildRejectedEventRowArgs.raw_event: Record<string, unknown>` → `unknown` (per Option A locked decision). Body unchanged. | +12 / −1 (header comment expanded) |
| `tests/v1/row-builders.test.ts` | **APPENDED** — 6 tests covering non-object fragment recording (number / null / string / array / no-empty-fallback / no-wrapper) | +~70 |
| `docs/sprint2-pr5c-2-orchestrator.md` | **NEW** — this document | ~300 |

**Not modified:** `src/collector/v1/index.ts` (barrel pinned at 4 PR#5a re-exports), `src/auth/workspace.ts`, `src/server.ts`, `src/collector/{routes,validate}.ts`, `tests/validate.test.ts`, `migrations/`, `src/db/schema.sql`, `.env.example`, every PR#5a / PR#5b / PR#5b-3 / PR#5c-1 helper module other than the narrow `row-builders.ts` type widening.

---

## 5. Injected auth contract

PR#5c-2 takes auth as a pre-resolved object. **It does NOT call `resolveSiteWriteToken`, `hashSiteWriteToken`, or any DB lookup.** PR#7 will resolve auth BEFORE invoking the orchestrator.

```ts
interface RunRequestInput {
  ctx: RequestContext;
  auth: {
    status: AuthStatus;                       // 'ok' | 'invalid_token' | 'site_disabled' | 'boundary_mismatch'
    resolved: ResolvedBoundary | null;        // non-null iff status === 'ok'
    reason_code: ReasonCode | null;           // §2.8 code populated when status !== 'ok'
  };
  config: CollectorConfig;
}
```

When `auth.status === 'ok'`, `auth.resolved` MUST be non-null. The orchestrator throws a `TypeError` if this contract is violated (cheap-and-loud detection of a PR#7 wiring bug).

When `auth.status !== 'ok'`, the orchestrator returns a request-level reject immediately — `accepted: []`, `rejected: []`, `response.results: []`, `expected_event_count: 0`. The `ingest_requests` row carries `auth_status`, `reject_reason_code`, `workspace_id: null`, `site_id: null`, and `reconciled_at = ctx.received_at`. HTTP status map: `invalid_token → 401`, `site_disabled → 403`, `boundary_mismatch → 403`.

---

## 6. CollectorConfig contract

```ts
interface CollectorConfig {
  collector_version: string;
  validator_version: string;
  event_contract_version: string;
  ip_hash_pepper: string;                     // PR#7 loads from process.env
  allow_consent_state_summary: boolean;       // per-site flag from site_configs
  now_ms?: number;                            // deterministic clock override for tests
}
```

**No `process.env` access inside `orchestrator.ts`.** Verified by structural scope-discipline test. PR#7's `loadCollectorConfig()` will read env once and pass the result to every `runRequest` invocation.

---

## 7. Pipeline order

### Phase 1 — Request-level (early-exit on failure)

1. **`ctx.ip` precondition.** Non-empty string required. Missing/empty → `TypeError` from `buildIngestRequestRow` propagates (no fake-IP fallback).
2. **Auth status gate.** If `auth.status !== 'ok'` → request-level reject. No `rejected_events` rows. HTTP map: `invalid_token→401`, `site_disabled→403`, `boundary_mismatch→403`.
3. **Contract assertion.** If `auth.status === 'ok'` but `auth.resolved === null` → `TypeError` (PR#7 wiring bug).
4. **Envelope parse.** `parseEnvelope({endpoint, content_type, raw_body_bytes})`. On failure → request-level reject. HTTP map: `content_type_invalid→415`, `request_body_invalid_json→400`, `request_too_large→413`, `batch_too_large→413`, `batch_item_count_exceeded→413`. No `rejected_events` rows.

### Phase 2 — Per-event loop (preserves input order)

`const seen = new Set<string>()`.

For `i = 0` to `events.length - 1`:

a. `bestEffort = extractBestEffortFields(raw)` — pure, never throws; returns all-null for non-object fragments.

b. **Validation gate.** `validateEventCore({event: raw, source_token_kind: 'site_write', now_ms})`. If `ok: false` → reject with the rule's reason code; `rejected_stage = stageForReasonCode(reason_code)`. Continue loop.

c. After validation: `raw` is guaranteed to be a plain object (validateEventCore's first guard rejects non-objects with `missing_required_field`). Locally narrowed to `rawObj: Record<string, unknown>`.

d. **PII gate.** `firstPiiReasonCode(rawObj)`. If non-null → reject with `rejected_stage = 'pii'`, `pii_hits_jsonb = { hits: scanForPii(rawObj) }`.

e. **Boundary gate (per-event).** `validatePayloadBoundary(resolved, rawObj)`. If `ok: false` → reject with `workspace_site_mismatch`, `rejected_stage = 'boundary'`.

f. **Canonical projection.** `canonical = buildCanonicalJsonb({validated, resolved, ctx, optional: extractOptionalForCanonical(rawObj)})`. Computed ONCE; passed to the consent gate.

g. **Consent gate.** `validateConsent({event: rawObj, canonical, config: {allowConsentStateSummary: config.allow_consent_state_summary}})`. If `ok: false` → reject with the consent reason code, `rejected_stage = stageForReasonCode(reason_code)` (typically `'validation'`).

h. **Intra-batch dedupe gate.** `key = makeDedupeKey(resolved.workspace_id, resolved.site_id, validated.client_event_id)`. If `seen.has(key)` → reject `duplicate_client_event_id`, `rejected_stage = 'dedupe'`. Else `seen.add(key)`.

i. **Accepted row build (wrapped in try/catch).** `buildAcceptedEventRow({ctx, resolved, validated, raw_event: rawObj, config})`. On success → push to `accepted`, push `{status:'accepted', client_event_id, reason_code: null}` to `results`. On thrown helper failure → reject with `internal_validation_error`, `rejected_stage = 'storage'`, `reason_detail = <error message>`.

### Phase 3 — Finalisation

5. Compute final counts: `expected = events.length`, `accepted_count = accepted.length`, `rejected_count = rejected.length`.
6. Compute `reconciled_at = new Date(config.now_ms ?? Date.now())`.
7. Build `ingest_requests` row with `auth_status: 'ok'`, `reject_reason_code: null`, `http_status: 200`.
8. Build `RequestResponse` with `results` in input order.
9. Return `OrchestratorOutput`: `{ingest_request, accepted, rejected, response, http_status: 200}`.

---

## 8. Request-level vs event-level rejection (the rule)

**Request-level rejections** create:
- one `ingest_requests` row (carries the rejection reason on `reject_reason_code`).
- **zero** `accepted_events` rows.
- **zero** `rejected_events` rows.

The proof of receipt lives on `ingest_requests.request_body_sha256`. Per §2.6 case table: whole-request failures do not spawn per-event rejected rows.

**Event-level rejections** create:
- one `ingest_requests` row (with `auth_status='ok'`, `reject_reason_code: null`).
- one `rejected_events` row per failed event.
- the batch continues — sibling events with different outcomes are processed independently.

| Failure | Layer | `accepted` | `rejected` | `ingest_request.reject_reason_code` | `http_status` |
|---|---|---|---|---|---|
| Invalid content-type | request | `[]` | `[]` | `'content_type_invalid'` | 415 |
| Malformed JSON | request | `[]` | `[]` | `'request_body_invalid_json'` | 400 |
| Body too large | request | `[]` | `[]` | `'request_too_large'` / `'batch_too_large'` | 413 |
| Batch item count > 100 | request | `[]` | `[]` | `'batch_item_count_exceeded'` | 413 |
| Auth invalid | request | `[]` | `[]` | `'auth_invalid'` (or whatever PR#7 passes) | 401 |
| Site disabled | request | `[]` | `[]` | `'auth_site_disabled'` | 403 |
| Validation rule fails | per-event | (siblings ok) | one row, `stage='validation'` | `null` | 200 |
| PII detected | per-event | (siblings ok) | one row, `stage='pii'`, `pii_hits_jsonb` set | `null` | 200 |
| Payload boundary mismatch | per-event | (siblings ok) | one row, `stage='boundary'` | `null` | 200 |
| Consent denied / buffer_only | per-event | (siblings ok) | one row, `stage='validation'` | `null` | 200 |
| Intra-batch duplicate | per-event | first ok | second row, `stage='dedupe'` | `null` | 200 |
| Helper failure during per-event row build | per-event | (siblings ok) | one row, `stage='storage'`, `reason='internal_validation_error'` | `null` | 200 |

---

## 9. `response.results` order

`response.results` length always equals `events.length` for parseable requests; equals 0 for request-level rejects. `response.results[i]` corresponds 1:1 to the `i`-th event from `parseEnvelope.events`:

- Accepted entry: `{status: 'accepted', client_event_id: validated.client_event_id, reason_code: null}`.
- Rejected entry: `{status: 'rejected', client_event_id: bestEffort.client_event_id ?? null, reason_code: <failure code>}`.

Tests verify `response.results.map(r => r.client_event_id)` matches `events[i].client_event_id` (with `null` when the input fragment lacked a parseable string client_event_id, e.g. for non-object fragments).

---

## 10. Consent preservation (PR#5b-2 contract)

The orchestrator calls `validateConsent` as-is with the canonical projection passed in:

```ts
const canonical = buildCanonicalJsonb({validated, resolved, ctx, optional});
const consentResult = validateConsent({
  event: rawObj,
  canonical,
  config: { allowConsentStateSummary: config.allow_consent_state_summary },
});
```

**Preserved invariants** (verified by existing 38 consent tests + new orchestrator-level integration tests):

1. `tracking_mode='buffer_only'` → `consent_required_but_missing` regardless of consent_state.
2. `consent_state !== 'denied'` → ok.
3. **Denied + `event_name='consent_state_summary'` that doesn't qualify the strict 5-field shape + opt-in → `consent_denied`** (PR#5b-2 narrow fix).
4. Denied + behavioural (`page`/`track`/`identify`/`group`) → `consent_denied`.
5. Denied + non-behavioural NOT named `consent_state_summary` → ok (downstream gates handle).
6. Forbidden-field check applies to BOTH event and canonical when canonical is supplied (PR#5b-2 Decision D9).

The orchestrator does NOT broaden any consent exception. `allow_consent_state_summary` is sourced from `config` (PR#7 injects it from per-site `site_configs`; default false).

---

## 11. Dedupe behaviour

- **Key:** `(workspace_id, site_id, client_event_id)` via `makeDedupeKey(...)`.
- **First occurrence:** added to `seen: Set<string>` and proceeds to row build.
- **Subsequent occurrences:** rejected with `duplicate_client_event_id`, `rejected_stage='dedupe'`.
- **Position in pipeline:** dedupe is the LAST gate before the row build. Validation / PII / boundary / consent failures DO NOT consume a dedupe slot. The orchestrator only adds to `seen` after all upstream gates pass.
- **Invalid client_event_id interaction:** `validateEventCore` rejects with `client_event_id_invalid` or `client_event_id_missing`. The orchestrator never reaches the dedupe step; the key is NOT added to `seen`.
- **Helper choice:** streaming `Set<string>` + `makeDedupeKey(...)` rather than `markIntraBatchDuplicates` — the streaming pattern integrates cleanly with validation-gated insertion.

---

## 12. Row-builder usage

### `buildIngestRequestRow`

Called **exactly once per request**:
- Request-level reject paths (`buildAuthRejectOutput` / `buildEnvelopeRejectOutput`) call it with counts = 0 and the appropriate `reject_reason_code` / `auth_status` / `http_status`.
- Per-event-loop completion path (final step) calls it with `auth_status='ok'`, `http_status=200`, `reject_reason_code=null`, and the final counts.

The builder computes `request_body_sha256 = sha256Hex(ctx.raw_body_bytes)` internally. The orchestrator passes `auth_status` and `reconciled_at` explicitly — neither is inferred inside the builder.

### `buildAcceptedEventRow`

Called only after the event passes EVERY upstream gate (validation, PII, boundary, consent, dedupe). The builder:
- Builds the normalised envelope via `buildAcceptedNormalisedEnvelope`.
- Builds `canonical_jsonb` via `buildCanonicalJsonb`.
- Computes `payload_sha256 = payloadSha256(normalisedEnvelope)` — **NOT** `payloadSha256(canonical_jsonb)`.

The orchestrator wraps the call in try/catch: a thrown helper failure (e.g. a `stableStringify` error on an unsupported value buried in `properties`) becomes a per-event reject with `reason_code='internal_validation_error'`, `rejected_stage='storage'`, `reason_detail=<error message>`. The batch continues.

### `buildRejectedEventRow`

Called only for parseable event-level failures. **Never called for whole-request failures.** The builder:
- Computes `raw_payload_sha256 = payloadSha256(raw_event)` directly — no empty-hash fallback.
- Stores `raw_event` verbatim into the legacy `raw` column.

**Type widening (Option A from PR#5c-2 plan):** `BuildRejectedEventRowArgs.raw_event` was widened from `Record<string, unknown>` to `unknown` to support non-object batch fragments. See §13.

---

## 13. Non-object batch fragments — Option A locked

### parseEnvelope guarantees

- **`/v1/event`:** the body must be a non-null, non-array object. `parseEnvelope` guarantees `events: [singleObject]` — one plain-object element.
- **`/v1/batch`:** the body must be `{events: array}`, but **array elements are NOT individually validated**. `parseEnvelope` may return `events: [42, null, "string", {...}, [1,2,3]]`.

### Decision: non-object fragments are event-level rejected rows (Option A)

For each non-object batch fragment at index `i`:
1. `extractBestEffortFields(raw)` returns all-null.
2. `validateEventCore({event: raw, ...})` rejects with `reason_code='missing_required_field'`, `rejected_stage='validation'`.
3. The orchestrator builds a `rejected_events` row via `buildRejectedEventRow`:
   - `raw = raw_event` (the primitive / null / array stored verbatim into the JSONB column).
   - `raw_payload_sha256 = payloadSha256(raw_event)` (hash of the actual fragment — **no wrapper, no empty-hash fallback**).
   - `best_effort` is all-null.
4. `response.results[i]` is `{status: 'rejected', client_event_id: null, reason_code: 'missing_required_field'}`.
5. The batch continues to the next event.

### What we explicitly do NOT do

- **No silent wrapping** into a sentinel object like `{_non_object: 42}` — that would change `raw_payload_sha256` semantics.
- **No tightening of `parseEnvelope`** to fail the whole batch on a single bad fragment — one bad event would tank 99 valid siblings.
- **No `raw as Record<string, unknown>` cast just to satisfy TypeScript** — the type widening represents reality.
- **No empty-hash fallback.** The hash is always over the actual fragment.

### Why this is safe

- `payloadSha256(primitive)` works for all JSON-valid values (strings, finite numbers, booleans, null, arrays, plain objects) via `stableStringify`. It only throws on values that JSON cannot represent in the first place (BigInt, NaN, Infinity, symbol, function, undefined, Map, Set, RegExp, Buffer, class instances) — none of which `JSON.parse` produces.
- The `raw` column on `rejected_events` is JSONB, which accepts any JSON value.

---

## 14. Non-goals

PR#5c-2 does NOT:

- Add HTTP route handlers / `/v1/event` / `/v1/batch` — PR#7.
- Run SQL (`pool.query` / `INSERT` / `UPDATE`) — PR#7.
- Read `process.env` — PR#7.
- Call `resolveSiteWriteToken` / `hashSiteWriteToken` — PR#7.
- Accept a `lookupByHash` callback — auth is fully injected.
- Touch `src/server.ts` or legacy `/collect` files.
- Modify `src/collector/v1/index.ts` (PR#5a barrel discipline preserved).
- Modify any PR#5a / PR#5b / PR#5b-3 / PR#5c-1 source module EXCEPT the narrow `BuildRejectedEventRowArgs.raw_event` type widening.
- Touch migrations / schema / `.env.example`.
- Introduce scoring / bot / AI-agent / risk-score / classification / recommended-action fields.
- Import from Track A or Core AMS.

---

## 15. Relationship to PR#7

PR#7's job is to put the orchestrator on the wire. Concretely:

1. **Read env** — `process.env.SITE_WRITE_TOKEN_PEPPER`, `process.env.IP_HASH_PEPPER`, `process.env.COLLECTOR_VERSION`, etc. Build a `CollectorConfig`.
2. **Add HTTP routes** — `POST /v1/event`, `POST /v1/batch`. Each handler:
   a. Captures `request_id = crypto.randomUUID()`, `received_at = new Date()`, `raw_body_bytes` from the request, etc., into a `RequestContext`.
   b. Resolves auth: `resolveSiteWriteToken(token, pepper, lookupByHash)`. Maps the result to `{status, resolved, reason_code}`.
   c. Invokes `runRequest({ctx, auth, config})`.
   d. INSERTs the `OrchestratorOutput.ingest_request` + `accepted[]` + `rejected[]` via `pool.query`. Wraps in a transaction.
   e. Sends `OrchestratorOutput.response` as the HTTP body with `OrchestratorOutput.http_status`.
3. **Best-effort `last_used_at` update** on the site write token after a successful auth.
4. **`.env.example`** — add `IP_HASH_PEPPER` entry alongside `SITE_WRITE_TOKEN_PEPPER`.
5. **Server wiring** — mount the two new routes on the existing Express `app`.

PR#5c-2 deliberately leaves all of this to PR#7. The HTTP layer is the only piece left.

---

## 16. Rollback plan

Migration-free, schema-free, route-free. Rollback:

1. Delete `src/collector/v1/orchestrator.ts`.
2. Delete `tests/v1/orchestrator.test.ts`.
3. Delete `docs/sprint2-pr5c-2-orchestrator.md`.
4. Revert `src/collector/v1/row-builders.ts` — `BuildRejectedEventRowArgs.raw_event: unknown` back to `Record<string, unknown>`.
5. Revert the 6 non-object fragment tests appended to `tests/v1/row-builders.test.ts`.

- **No migration to revert.**
- **No env-var to revert.**
- **No route to revert.**
- **No legacy module changed.**
- **`src/collector/v1/index.ts` unchanged** — barrel still has exactly 4 PR#5a re-exports.
- **No application code yet imports `runRequest`** at runtime — rollback cannot break any active code path.

---

## 17. Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## 18. Three-part architecture relationship

- **PR#5c-2 is Track B v1 orchestration.** Pure composition of existing pure helpers. No scoring.
- **PR#5c-2 is not Track A scoring.** Zero scoring fields. Zero imports from Track A.
- **PR#5c-2 is not Core AMS product code.** Zero imports from Core AMS.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → §3.PR#5a (closed pending Codex) → §3.PR#5b-1 (closed pending Codex) → §3.PR#5b-2 (PASS after consent fix) → §3.PR#5b-3 (PASS after symbol-key hardening) → §3.PR#5c-1 (PASS after evidence-semantics patch) → **§3.PR#5c-2 (this)** → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## 19. Codex review checklist

1. ☐ `tsc --noEmit` clean. `npm test` all passing.
2. ☐ `runRequest` accepts `auth` as injected input — does NOT call `resolveSiteWriteToken` and does NOT accept a `lookupByHash` callback.
3. ☐ No `process.env` access in `orchestrator.ts`.
4. ☐ No `from 'pg'` / `pool.query` / SQL strings.
5. ☐ No `from 'express'` / `Router(`.
6. ☐ No Track A / Core AMS path strings.
7. ☐ No scoring symbols.
8. ☐ `src/collector/v1/index.ts` byte-identical — exactly 4 PR#5a re-exports.
9. ☐ PR#5b-2 consent_state_summary deny-by-default behaviour preserved (38 existing consent tests pass + new orchestrator-level integration tests).
10. ☐ PR#5b-1 validation behaviour preserved.
11. ☐ PR#5b-3 hash invariants preserved: `payloadSha256(canonical) !== payloadSha256(normalisedEnvelope)`.
12. ☐ `traffic_class === 'unknown'` on every accepted row.
13. ☐ `debug_mode === false` on every accepted row.
14. ☐ Batch order preserved: `response.results[i].client_event_id` corresponds to `events[i].client_event_id` (or `null` when unparseable).
15. ☐ Request-level reject: `accepted: []`, `rejected: []`, `ingest_request.reject_reason_code` populated, no `rejected_events` rows.
16. ☐ Event-level reject: per-event `rejected[i]` rows, `http_status: 200`, batch continues.
17. ☐ Empty batch: `accepted: []`, `rejected: []`, `expected_event_count: 0`, `http_status: 200`.
18. ☐ Mixed batch: `accepted` + `rejected` both populated; counts reconcile to `expected_event_count`.
19. ☐ Auth-fail paths set `ingest_request.auth_status` correctly.
20. ☐ `reconciled_at` set on every `ingest_request` row.
21. ☐ `now_ms` injection works — tests pass with deterministic clock.
22. ☐ Per-event `payloadSha256` failure routed to `internal_validation_error` / `rejected_stage='storage'` (batch continues).
23. ☐ Dedupe runs AFTER validation / PII / boundary / consent. First occurrence wins.
24. ☐ Missing `ctx.ip` propagates `TypeError` (no fake-IP fallback).
25. ☐ Non-object batch fragments are event-level rejected rows with `reason_code='missing_required_field'`, `raw_payload_sha256 = payloadSha256(actual fragment)`, `raw` stored verbatim. **No wrapper, no empty-hash fallback.**

---

## 20. Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only.
- **No production:** no production website repo, GTM, GA4, LinkedIn pixel, ThinSDK, production endpoint, or production database touched.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** `process.env` not accessed anywhere in PR#5c-2 source.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change.**
- **No commit was created by this PR.** Working-tree changes only.
