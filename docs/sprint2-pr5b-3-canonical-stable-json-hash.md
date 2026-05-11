# Sprint 1 PR#5b-3 — canonical_jsonb projection + stable JSON + payload hash

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.5 (`canonical_jsonb`, `payload_sha256`) + §3.PR#5
**Status:** three pure modules + three pure-function test files + this doc. **No env reads, no DB writes, no routes, no orchestrator, no row-builder bodies, no commit.**

> Filename keeps the `sprint2-pr5b-…` prefix for review-trail continuity. Body content uses the canonical numbering: **Sprint 1 §3.PR#5b-3**, the third sub-PR of the §3.PR#5b split (PR#5b-1 = stage-map + envelope + core validation; PR#5b-2 = PII + consent + boundary + dedupe; **PR#5b-3 = canonical projection + stable JSON + payload hash**).

---

## 1. Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement Track A backend bridge.
This PR does not implement Core AMS scoring.
This PR does not implement routes or DB writes.
This PR only adds Track B pure canonical projection, stable JSON, and payload hash helpers for the v1 collector pipeline.
```

---

## 2. Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5b-3 ships pure helper infrastructure that the future orchestrator (PR#5c) will compose. Zero scoring fields. Zero imports from Track A or Core AMS.

---

## 3. Purpose

Three pure helpers that the orchestrator (§3.PR#5c) will compose into the v1 collector write path:

1. **`stable-json.ts`** — deterministic JSON stringify. Two structurally-equal values produce identical output strings regardless of object-key insertion order. Required so SHA-256 digests are reproducible.
2. **`payload-hash.ts`** — generic SHA-256 helper that composes `sha256Hex(stableStringify(value))`. Used by PR#5c to compute the per-event hashes stored on `accepted_events.payload_sha256`, `rejected_events.raw_payload_sha256`, and other content-fingerprint columns.
3. **`canonical.ts`** — data-minimised projection per §2.5 + Decision D3. Always emits exactly 19 keys; unavailable optional fields are emitted as `null`; `traffic_class` defaults to `'unknown'` (Sprint 1, Decision #13). Output goes into `accepted_events.canonical_jsonb` as durable evidence (NOT covered by the 90-day raw-payload purge).

All three are **pure functions** — no DB, no env, no logging, no Express, no network, no `Date.now()`. The orchestrator (PR#5c) composes them.

---

## 4. Files added

| File | Lines | Purpose |
|---|---|---|
| `src/collector/v1/stable-json.ts` | ~135 | `stableStringify(value)` — recursive key-sorted, deterministic output, strict type policy |
| `src/collector/v1/payload-hash.ts` | ~50 | `payloadSha256(value)` — `sha256Hex(stableStringify(value))` one-liner |
| `src/collector/v1/canonical.ts` | ~95 | `buildCanonicalJsonb(input)` — 19-key projection, ISO timestamps, null-policy for optionals |
| `tests/v1/stable-json.test.ts` | ~210 | Key-sort, primitives, allowed/rejected types, circular detection, scope discipline |
| `tests/v1/payload-hash.test.ts` | ~130 | Determinism, format, equality with `sha256Hex(stableStringify(...))`, error propagation, scope discipline |
| `tests/v1/canonical.test.ts` | ~250 | Output shape, null-policy, ISO timestamps, exclusion list, input non-mutation, scope discipline |
| `docs/sprint2-pr5b-3-canonical-stable-json-hash.md` | this | Review doc |

`src/collector/v1/index.ts` is **not** modified — preserves the PR#5a barrel-discipline test that pins exactly 4 re-exports.

---

## 5. `canonical_jsonb` — exact 19-key projection

The output of `buildCanonicalJsonb(input)` always has **exactly** these 19 keys:

```
request_id, workspace_id, site_id,
client_event_id, event_name, event_type, event_origin,
occurred_at, received_at,
schema_key, schema_version, id_format, traffic_class,
session_id, session_seq,
consent_state, consent_source, tracking_mode, storage_mechanism
```

Field policy:

| Output key | Source | Type | Default |
|---|---|---|---|
| `request_id` | `ctx.request_id` | string | required (server-stamped by middleware in PR#7) |
| `workspace_id` | `resolved.workspace_id` | string | required (PR#4 auth boundary) |
| `site_id` | `resolved.site_id` | string | required (PR#4 auth boundary) |
| `client_event_id` | `validated.client_event_id` | string | required (R-9 admit set: uuidv4 or uuidv7) |
| `event_name` | `validated.event_name` | string | required (R-2) |
| `event_type` | `validated.event_type` | string | required (R-10 admit set) |
| `event_origin` | `validated.event_origin` | string | required (R-10 admit set) |
| `occurred_at` | `validated.occurred_at.toISOString()` | string (ISO 8601) | required (R-5 window) |
| `received_at` | `ctx.received_at.toISOString()` | string (ISO 8601) | required (server-stamped) |
| `schema_key` | `validated.schema_key` | string | required (R-2) |
| `schema_version` | `validated.schema_version` | string | required (R-2 semver shape) |
| `id_format` | `validated.id_format` | string | required (uuidv4 or uuidv7) |
| `traffic_class` | `optional.traffic_class` | string | **`'unknown'`** when absent / null (Sprint 1 / Decision #13) |
| `session_id` | `validated.session_id` | string \| null | `null` for server-origin events |
| `session_seq` | `optional.session_seq` | number \| null | `null` when absent |
| `consent_state` | `optional.consent_state` | string \| null | `null` when absent |
| `consent_source` | `optional.consent_source` | string \| null | `null` when absent |
| `tracking_mode` | `optional.tracking_mode` | string \| null | `null` when absent |
| `storage_mechanism` | `optional.storage_mechanism` | string \| null | `null` when absent |

---

## 6. Null policy for unavailable optional fields

PR#5b-3 always emits the 19 keys. Unavailable optional fields are emitted as `null` (not omitted). The resulting object has stable shape regardless of how many of the optional fields the inbound event supplied.

This differs from a JSON-Schema "omit unknown" convention. The reason: storing the canonical_jsonb under a JSONB column with predictable shape simplifies downstream readers — every row carries the same field set.

`traffic_class` is the single exception: it defaults to `'unknown'` (string) per Decision #13 rather than `null`. Sprint 1 never emits any other `traffic_class` value on `canonical_jsonb`.

---

## 7. ISO timestamp policy

`occurred_at` and `received_at` are emitted as ISO 8601 strings via `Date.prototype.toISOString()`:

```
2026-05-10T12:00:00.000Z
```

Always UTC, always millisecond-precise, never numeric. Rationale: durability across DB drivers, no timezone ambiguity, human-readable, `JSON.stringify`-compatible. PR#5c row-builders write the string into `canonical_jsonb` directly.

---

## 8. Exclusion list — never appears on canonical_jsonb

The projection MUST NEVER emit any of these keys, even if the inbound event payload supplies them:

```
properties, context,
page_url, page_path, page_referrer, page_title,
user_id, company_id, anonymous_id, browser_id,
email, phone, name, address,
ip, user_agent, ip_hash,
debug, debug_mode,
raw, payload_jsonb, payload_sha256,
accepted_at, validator_version, sent_at,
risk_score, classification, recommended_action,
behavioural_score, behavior_score,
bot_score, agent_score, is_bot, is_agent
```

The structured `CanonicalJsonbInput` (per `canonical.ts`) reads only the typed sub-fields it knows about, so attacker-controlled extra keys on the source structures cannot leak into the projection. Tests assert this explicitly with both `Object.keys` and `JSON.stringify` canary checks.

The projection deliberately does NOT call:
- PII validation (PR#5b-2)
- consent validation (PR#5b-2)
- boundary validation (PR#5b-2 / PR#4)
- dedupe (PR#5b-2)

Those run **upstream** in the orchestrator's order. PR#5b-3 is a pure projection layer.

---

## 9. Stable JSON deterministic rules (`stable-json.ts`)

`stableStringify(value)` returns a JSON-compatible string with:

- **Recursive object key sort.** `Object.keys(obj).sort()` (lexicographic, ASCII-ordered) before serialisation; applied to every nested object. `{b:1, a:2}` and `{a:2, b:1}` produce identical output.
- **Array order preservation.** Arrays serialised in input index order (no sort).
- **No whitespace.** No replacer hook. No indentation.
- **Primitives** serialised via `JSON.stringify` for proper escaping. `-0` serialised as `0`.
- **`Date`** converted via `toISOString()` (matches `JSON.stringify`'s default `toJSON()` path).
- **Circular detection** via `WeakSet` path tracking. Sibling references to the same object are NOT considered circular.

---

## 10. Rejected unsupported values

`stableStringify` throws `TypeError` on:

| Input | Where |
|---|---|
| `undefined` | top level, object value, array element |
| `function` | anywhere |
| `symbol` | anywhere |
| `BigInt` | anywhere |
| `NaN` | anywhere |
| `Infinity`, `-Infinity` | anywhere |
| invalid `Date` (NaN time) | anywhere |
| `Map`, `Set`, `RegExp`, `Buffer` | anywhere |
| class instance / non-plain object | anywhere |
| circular reference | anywhere |
| symbol-keyed object properties | anywhere — `Object.keys()` does not enumerate symbol keys, so without this guard a symbol-keyed property would be silently omitted before hashing, breaking the evidence-hash invariant. |

Rationale: hash-determinism requires every accepted input to round-trip through `stableStringify` to a single canonical string. Throwing surfaces unsupported values at the boundary instead of producing silent ambiguity.

---

## 11. Payload hash rule (`payload-hash.ts`)

```
payloadSha256(value) = sha256Hex(stableStringify(value))
```

- **Algorithm:** SHA-256 (delegated to PR#5a's `sha256Hex` — no new crypto code introduced in PR#5b-3).
- **Output:** raw 64-char lowercase hex. **No** `sha256:` prefix.
- **Input source:** caller's responsibility — `payloadSha256` is generic; PR#5c orchestrator decides which exact shape to feed for each call site.
- **No `Date.now()`** / no runtime side effects. Two calls with identical input return identical output across any time delta.
- **Errors** from `stableStringify` (BigInt, NaN, undefined, Map, circular, etc.) propagate unchanged. The caller sees a single deterministic failure surface for unsupported inputs.

---

## 12. Distinction — `canonical_jsonb` ≠ `accepted_events.payload_sha256` input

This is **the most important nuance** of PR#5b-3:

> `canonical_jsonb` (built by `canonical.ts`) is the **data-minimised durable projection** — 19 specific keys for long-lived defensible evidence.
>
> `accepted_events.payload_sha256` (per handoff §2.5 line 168) is the SHA-256 of the **individual normalised event envelope** — *"after canonicalisation, before the canonical projection"*. The hashed shape is **broader** than `canonical_jsonb` (server-stamped envelope fields per §2.1 included), and is **not** the data-minimised projection.

PR#5b-3 keeps these two shapes deliberately separate. `canonical.ts` produces the data-minimised projection only. `payload-hash.ts` is generic — it does NOT decide which shape to hash. PR#5c orchestrator passes the appropriate shape to each helper:

- `accepted_events.payload_sha256` ← `payloadSha256(normalisedEnvelope)` where `normalisedEnvelope` is the post-validation, pre-projection envelope.
- `accepted_events.canonical_jsonb` ← `buildCanonicalJsonb({validated, resolved, ctx, optional})`.
- `rejected_events.raw_payload_sha256` ← `payloadSha256(rejectedEventEnvelope)` per §2.6 case table.
- `ingest_requests.request_body_sha256` ← `sha256Hex(rawBodyBuffer)` directly (Buffer input; PR#5a's `sha256Hex` handles this without `payloadSha256`).

Misusing `payloadSha256(canonical_jsonb)` for the `payload_sha256` column would **lose** server-stamped envelope fields from the hash and break §2.5 conformance. PR#5c must wire each call site separately.

---

## 13. Non-goals

PR#5b-3 does **NOT** include:

- **No orchestrator** (`runRequest`) — PR#5c.
- **No row-builder bodies** — PR#5a stubs still throw `PR5A_STUB_MESSAGE`; PR#5c lands the bodies.
- **No DB writes / SQL** — PR#7 wires `pool.query` calls into route handlers.
- **No HTTP route binding / `/v1/event` / `/v1/batch`** — PR#7.
- **No env reads** (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`) — PR#5c.
- **No accepted_events / rejected_events insert/update logic** — PR#7.
- **No collector endpoint wiring** — PR#7.
- **No scoring / bot / AI-agent / risk-score / classification / recommended-action fields** — out of Sprint 1 scope (handoff §1 + §4.1).
- **No production / live RECORD_ONLY path / Playwright / network call.**
- **No Track A or Core AMS imports.**
- **No legacy `/collect` change** (`src/collector/{routes,validate}.ts` byte-identical).
- **No `src/collector/v1/index.ts` change** — PR#5a barrel-discipline test continues to pin 4 re-exports.
- **No migration / schema / `.env.example` change.**

---

## 14. Rollback plan

Migration-free, schema-free, route-free. Rollback deletes the seven new files:

```bash
rm src/collector/v1/stable-json.ts
rm src/collector/v1/payload-hash.ts
rm src/collector/v1/canonical.ts
rm tests/v1/stable-json.test.ts
rm tests/v1/payload-hash.test.ts
rm tests/v1/canonical.test.ts
rm docs/sprint2-pr5b-3-canonical-stable-json-hash.md
```

- **No migration to revert.** PR#5b-3 does not touch `migrations/` or `src/db/schema.sql`.
- **No env-var to revert.** PR#5b-3 does not touch `.env.example`.
- **No route to revert.** PR#5b-3 does not touch `src/server.ts` or any `*/routes.ts`.
- **No legacy module changed.** `src/collector/{routes,validate}.ts`, `tests/validate.test.ts`, `src/auth/workspace.ts`, all PR#5a / PR#5b-1 / PR#5b-2 modules byte-identical.
- **No application code yet imports from the new modules at runtime** — rollback cannot break any active code path.
- **PR#5a barrel discipline** continues to pass: `src/collector/v1/index.ts` unchanged, still re-exports exactly the four PR#5a sub-modules.

---

## 15. Test commands and expected results

```bash
cd /Users/admin/github/buyerrecon-backend
npx tsc --noEmit       # expected: clean exit
npm test               # expected: all previous 523 tests pass + new PR#5b-3 tests
```

Vitest runs the three new PR#5b-3 test files alongside the existing 16 test files. All tests are pure — no DB connection, no network, no Playwright.

The exact post-PR test count is recorded in the conversation's "Final report" section.

---

## 16. Relationship to PR#5c

PR#5c is the orchestrator + row-builder PR. It will:

1. Read env vars (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`).
2. Compose the v1 collector pipeline: auth → envelope → dedupe → validation → pii → consent → boundary → build rows.
3. Build the per-call-site shapes:
   - `normalisedEnvelope` for `payloadSha256(...)` → `accepted_events.payload_sha256`
   - `canonical_jsonb` via `buildCanonicalJsonb({validated, resolved, ctx, optional})` → `accepted_events.canonical_jsonb`
   - rejected event envelope for `payloadSha256(...)` → `rejected_events.raw_payload_sha256`
4. Implement the row-builder bodies that PR#5a left as stubs.
5. Construct the `ingest_requests` row with `request_body_sha256 = sha256Hex(rawBodyBuffer)` (using PR#5a `sha256Hex` directly, since the input is a Buffer).

PR#5b-3's three helpers are the foundation PR#5c composes. PR#5b-3 deliberately ships no row-building, no orchestration, no env wiring — only the deterministic primitives.

PR#7 then binds the orchestrator output to HTTP route handlers and runs `pool.query` for the actual `INSERT` statements.

---

## Three-part architecture relationship

- **PR#5b-3 is Track B v1 evidence helpers.** Pure functions only. No scoring.
- **PR#5b-3 is not Track A scoring.** Zero scoring fields. Zero imports from Track A.
- **PR#5b-3 is not Core AMS product code.** Zero imports from Core AMS.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → §3.PR#5a (closed pending Codex) → §3.PR#5b-1 (closed pending Codex) → §3.PR#5b-2 (PASS after consent fix) → **§3.PR#5b-3 (this)** → §3.PR#5c (orchestrator + row-builder bodies + env wiring) → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo, GTM, GA4, LinkedIn pixel, ThinSDK, production endpoint, or production database touched.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** `process.env` is not accessed anywhere in PR#5b-3 source (verified by structural test on every module).
- **No collector / route / validator runtime change.** Legacy `/collect` continues to function unchanged.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change.**
- **No commit was created by this PR.** Working-tree changes only.
