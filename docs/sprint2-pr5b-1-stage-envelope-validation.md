# Sprint 1 PR#5b-1 — stage-map + envelope + core event validation

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.6 + §2.7 + §2.8 + §2.9 (R-1, R-2, R-3, R-5, R-6, R-9, R-10, R-12) + §2.2 + §3.PR#5
**Status:** three pure modules + three pure-function test files + this doc. **No env reads, no DB writes, no routes, no commit.**

> Filename keeps the `sprint2-pr5b-…` prefix for review-trail continuity with PR#1–PR#5a docs. Body content uses the canonical numbering: **Sprint 1 §3.PR#5b-1**, the first sub-PR of the §3.PR#5b split (PR#5b-1 = stage-map + envelope + validation; PR#5b-2 = PII + consent + boundary + dedupe; PR#5b-3 = canonical projection + stable JSON + payload-hash helper).

---

## Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement Track A backend bridge.
This PR does not implement Core AMS scoring.
This PR does not implement routes or DB writes.
This PR only adds Track B pure stage-map, envelope, and core event validation modules for the v1 collector pipeline.
```

---

## Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5b-1 ships pure validation infrastructure that the future orchestrator (PR#5c) will consume. Zero scoring fields. Zero imports from Track A or Core AMS. The future Track A backend bridge will read Track B evidence and write scoring outputs to a separate table; **the bridge is not built here, and PR#5b-1 introduces no scoring logic**.

---

## Purpose

PR#5b-1 lands three pure modules that the orchestrator (§3.PR#5c) will compose into the full v1 collector pipeline:

1. **`stage-map.ts`** — exhaustive `Record<ReasonCode, RejectedStage>` so any §2.8 reason code can be tagged with the §2.6 stage at which it surfaced. Used by row-builders (PR#5c) when populating `rejected_events.rejected_stage`.
2. **`envelope.ts`** — request-envelope parser. Validates `Content-Type`, body size limits (R-6), and JSON envelope shape (§2.2). Returns parsed events or one of five §2.8 envelope reason codes.
3. **`validation.ts`** — per-event core validator. Implements R-2 / R-3 / R-5 / R-9 / R-10 / R-12 with deterministic first-reason precedence (Decision D3).

All three modules are **pure functions** — no DB, no env, no logging, no Express. Tests exercise each module in isolation.

---

## Files added

| File | Lines | Purpose |
|---|---|---|
| `src/collector/v1/stage-map.ts` | ~70 | Exhaustive `Record<ReasonCode, RejectedStage>` + `stageForReasonCode` helper |
| `src/collector/v1/envelope.ts` | ~125 | `parseEnvelope` + `isJsonContentType` + size/count limit constants |
| `src/collector/v1/validation.ts` | ~270 | `validateEventCore` + `validateEventTypeOrigin` + `detectClientEventIdFormat` |
| `tests/v1/stage-map.test.ts` | ~145 | Map completeness, per-group correctness, scope discipline |
| `tests/v1/envelope.test.ts` | ~250 | Content-type, size caps, batch shape & count, first-reason precedence |
| `tests/v1/validation.test.ts` | ~445 | UUID format detection, R-10 matrix, R-2/3/5/9/10/12 paths, first-reason precedence |
| `docs/sprint2-pr5b-1-stage-envelope-validation.md` | this | Review doc |

`src/collector/v1/index.ts` is **not** modified. Tests import the new modules from their own paths; the PR#5a barrel keeps its existing four-module re-export shape (so the PR#5a `index.ts` import-discipline test stays accurate).

---

## `stage-map.ts` — rules

`REASON_CODE_TO_STAGE: Record<ReasonCode, RejectedStage>` exhaustively covers all 36 §2.8 codes:

| Stage | Codes |
|---|---|
| **`auth`** | `auth_invalid`, `auth_site_disabled` |
| **`boundary`** | `workspace_site_mismatch` |
| **`envelope`** | `content_type_invalid`, `request_body_invalid_json`, `request_too_large`, `batch_too_large`, `batch_item_count_exceeded` |
| **`validation`** | `schema_unknown`, `schema_version_unsupported`, `schema_version_malformed`, `event_name_invalid`, `event_type_invalid`, `event_origin_invalid`, `occurred_at_missing`, `occurred_at_invalid`, `occurred_at_too_old`, `occurred_at_too_future`, `session_id_missing`, `session_id_invalid`, `client_event_id_missing`, `client_event_id_invalid`, `missing_required_field`, `property_type_mismatch`, `property_not_allowed`, `context_not_allowed`, `consent_denied`, `consent_required_but_missing`, `debug_only_not_allowed` |
| **`pii`** | `pii_email_detected`, `pii_phone_detected`, `pii_government_id_detected`, `pii_payment_detected`, `pii_credential_detected` |
| **`dedupe`** | `duplicate_client_event_id` |
| **`storage`** | `internal_validation_error` |

The TypeScript `Record<ReasonCode, RejectedStage>` declaration **fails at compile time** if any §2.8 code is omitted or any non-`ReasonCode` key is added. Tests cross-check completeness at runtime.

---

## `envelope.ts` — rules

| Constant | Value | Source |
|---|---|---|
| `V1_EVENT_MAX_BYTES` | `32 * 1024` | §2.9 R-6 single-event |
| `V1_BATCH_MAX_BYTES` | `512 * 1024` | §2.9 R-6 batch |
| `V1_BATCH_MAX_EVENTS` | `100` | §2.9 R-6 batch item count |

### `isJsonContentType(content_type)`

Returns true iff the base media type is `application/json`. Optional parameters (e.g. `; charset=utf-8`) are accepted; comparison is case-insensitive on the base media type. **Strict** — no `+json` suffix variants (`application/vnd.api+json`, `application/ld+json`) accepted.

### `parseEnvelope(input)` — deterministic check order (D3 first reason wins)

1. **Content-Type** — non-JSON → `content_type_invalid`.
2. **Size cap** — `/v1/event` over 32 KB → `request_too_large`; `/v1/batch` over 512 KB → `batch_too_large`. Bytes-on-the-wire (measured before decode/parse).
3. **JSON parse** — `JSON.parse` failure → `request_body_invalid_json`.
4. **Endpoint shape** —
   - `/v1/event`: body must be a plain JSON object (single event). Top-level array, primitive, or null → `request_body_invalid_json`.
   - `/v1/batch`: body must be a plain JSON object with `events: array`. Anything else → `request_body_invalid_json`.
5. **Batch item count** — `/v1/batch` with `events.length > 100` → `batch_item_count_exceeded`.

### Note on shape errors

§2.8 has no separate code for "valid JSON but wrong envelope shape". PR#5b-1 maps all such cases to `request_body_invalid_json` — the body is not a valid request body, even though `JSON.parse` succeeded. This matches the canonical enum without adding new reason codes.

### Empty batch is allowed

`/v1/batch` with `{events: []}` is **accepted** (returns `events.length === 0`). The orchestrator (PR#5c) will short-circuit on empty events: write the `ingest_requests` row with `expected_event_count = 0`, `accepted_count = 0`, `rejected_count = 0`, `reconciled_at = received_at`, `auth_status = 'ok'`, and respond ok.

---

## `validation.ts` — rules

### Type aliases

- `IdFormat = 'uuidv7' | 'uuidv4' | 'invalid'`
- `EventOrigin = 'browser' | 'server' | 'system'`
- `EventType = 'page' | 'track' | 'identify' | 'group' | 'system' | 'debug'`

### `detectClientEventIdFormat(value)` — R-9 admit set

Returns the first match from:
- `^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` → `'uuidv7'`
- `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` → `'uuidv4'`
- otherwise → `'invalid'`

Both regexes enforce the RFC 4122 variant nibble (`8 | 9 | a | b`) and the version nibble (`4` or `7`). UUIDv5 (version nibble 5) and any opaque / non-string / empty value all return `'invalid'`. Per Decision D4, this is strict — no v3, v5, v6, or v8 acceptance.

### `validateEventTypeOrigin(origin, eventType)` — R-10 matrix

Returns null on accept, else a §2.8 reason code:

| origin | type=page | type=track | type=identify | type=group | type=system | type=debug |
|---|---|---|---|---|---|---|
| `browser` | ✅ | ✅ | `event_type_invalid` | `event_type_invalid` | `event_type_invalid` | `event_type_invalid` |
| `server` | `event_type_invalid` | ✅ | ✅ | ✅ | ✅ | `event_type_invalid` |
| `system` | `event_type_invalid` | `event_type_invalid` | `event_type_invalid` | `event_type_invalid` | ✅ | ✅ |

`agent_ai`, `agent_human`, and any unknown origin → `event_origin_invalid`.

PR#5b-2/5c will distinguish the `system` admin / internal path; PR#5b-1 admits `(system, system)` and `(system, debug)` as the spec table shows.

### `validateEventCore(input)` — deterministic check order (D3)

Per Decision D3, **first deterministic reason wins**. The order is documented at each step; reviewers can verify by reading the source.

| Step | Check | Reason code on failure |
|---|---|---|
| 0 | event is a plain JSON object | `missing_required_field` |
| 1 | event_origin × event_type matrix (R-10) | `event_origin_invalid` or `event_type_invalid` |
| 2 | browser-origin requires non-empty session_id (R-3); other origins accept `null` or non-empty string | `session_id_missing` or `session_id_invalid` |
| 3 | event_name is a non-empty string (R-2) | `event_name_invalid` |
| 4 | schema_key is a non-empty string (R-2) | `schema_unknown` |
| 5 | schema_version is a 3-component semver string (R-2) | `schema_version_malformed` |
| 6 | client_event_id present + uuidv4/uuidv7 (R-9) | `client_event_id_missing` or `client_event_id_invalid` |
| 7 | occurred_at present + parseable + within `(-24h, +5min)` (R-5) | `occurred_at_missing`, `occurred_at_invalid`, `occurred_at_too_old`, `occurred_at_too_future` |
| 8 | payload `debug = true` rejected for site-write-token sources (R-12) | `debug_only_not_allowed` |

### `source_token_kind` parameter

`validateEventCore` accepts an optional `source_token_kind: 'site_write' | 'admin' | 'internal'` (defaults to `'site_write'`). Only `'site_write'` triggers R-12 rejection on `debug=true`. PR#5b-1's signature lets the future orchestrator (PR#5c) pass the right token kind without a global flag.

### `now_ms` parameter

Optional `now_ms` overrides the clock for deterministic occurred_at-window tests.

---

## What PR#5b-1 does NOT do

- **No PII regex.** §2.10 detection lands in PR#5b-2.
- **No consent-denied logic.** R-11 lands in PR#5b-2.
- **No `consent_state_summary` forbidden-fields check.** PR#5b-2 (default per Decision D8: `{ allowConsentStateSummary: false }`).
- **No boundary wrapper.** PR#5b-2 wraps PR#4's `assertPayloadBoundary` and maps to `workspace_site_mismatch`.
- **No intra-batch dedupe.** PR#5b-2 adds the `(workspace_id, site_id, client_event_id)` set check.
- **No `canonical_jsonb` projection.** PR#5b-3 implements the 19-field data-minimised projection per Decision D3.
- **No stable JSON / payload_sha256 helper.** PR#5b-3 (homegrown deterministic stringify per Decision D7).
- **No orchestrator** (`runRequest(ctx, rawBody)`). PR#5c.
- **No row-builder bodies** (the PR#5a stubs still throw `PR5A_STUB_MESSAGE`). PR#5c.
- **No env-var read** (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`). PR#5c.
- **No SQL execution / no `pool.query`.** Lands at route binding (§3.PR#7).
- **No HTTP route binding.** §3.PR#7.
- **No `/v1/event` or `/v1/batch`.** §3.PR#7.
- **No modification to `src/collector/routes.ts`** (legacy `/collect`). Stays operational unchanged.
- **No modification to `src/collector/validate.ts`** (legacy validator). Stays in service for `/collect`.
- **No modification to `tests/validate.test.ts`.** Legacy tests keep passing.
- **No migration / schema change.** `migrations/` and `src/db/schema.sql` are byte-identical to pre-PR#5b-1 state.
- **No `.env.example` change.** `IP_HASH_PEPPER` env-var entry stays deferred to PR#5c (per Decision D10).
- **No bot detection / AI-agent detection / scoring fields** anywhere.
- **No imports from Track A or Core AMS.**

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs the three new PR#5b-1 test files alongside the existing nine. All tests are pure — no DB connection, no network, no Playwright.

---

## Rollback plan

Migration-free, schema-free, route-free. Rollback is simply deleting the seven new files:

```bash
rm src/collector/v1/stage-map.ts
rm src/collector/v1/envelope.ts
rm src/collector/v1/validation.ts
rm tests/v1/stage-map.test.ts
rm tests/v1/envelope.test.ts
rm tests/v1/validation.test.ts
rm docs/sprint2-pr5b-1-stage-envelope-validation.md
```

- **No migration to revert.** PR#5b-1 does not touch `migrations/` or `src/db/schema.sql`.
- **No env-var to revert.** PR#5b-1 does not touch `.env.example`.
- **No route to revert.** PR#5b-1 does not touch `src/server.ts` or any `*/routes.ts`.
- **No legacy module changed.** `src/collector/{routes,validate}.ts`, `tests/validate.test.ts`, `src/auth/workspace.ts`, `src/db/`, `src/collector/v1/{reason-codes,types,hash,row-builders,index}.ts` all byte-identical to pre-PR#5b-1 state.
- **No application code yet imports from the new modules at runtime** — rollback cannot break any active code path.

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## Relationship to the three-part architecture

- **PR#5b-1 is Track B v1 validation infrastructure.** Pure functions only. No scoring.
- **PR#5b-1 is not Track A scoring.** Zero scoring fields. Zero imports from `/Users/admin/github/ams-qa-behaviour-tests`.
- **PR#5b-1 is not Core AMS product code.** Zero imports from `/github/keigentechnologies/ams`.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → §3.PR#5a (closed pending Codex) → **§3.PR#5b-1 (this)** → §3.PR#5b-2 (PII + consent + boundary + dedupe) → §3.PR#5b-3 (canonical projection + stable JSON + payload-hash) → §3.PR#5c (orchestrator + row-builder bodies) → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** the validators take all parameters as inputs. `process.env` is not accessed anywhere in PR#5b-1 source (verified by structural test).
- **No collector / route / validator runtime change:** legacy `/collect` continues to function unchanged. `tests/validate.test.ts` continues to pass unchanged.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change.**
- **No commit was created by this PR.** Working-tree changes only.

---

## Next — PR#5b-2

PII regex (§2.10) for email / phone / government_id / payment / credential — using conservative high-confidence patterns only (Decision D5 + D6: Luhn for payment, no broad global government-ID detection). Consent-denied logic (R-11). `consent_state_summary` forbidden-fields check (Decision D8: `{ allowConsentStateSummary: boolean }`, default false). Boundary wrapper around PR#4's `assertPayloadBoundary`. Intra-batch dedupe on `(workspace_id, site_id, client_event_id)`. **No route binding. No DB writes. No env-var read. No canonical projection (PR#5b-3) or payload-hash (PR#5b-3).** Out of scope for PR#5b-1 — do not start.
