# Sprint 1 PR#5a — v1 collector contract foundation

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.5 + §2.6 + §2.7 + §2.8 + §2.9 + §3.PR#5
**Status:** new contract surface only — types, canonical §2.8 reason-code enum, hash helpers, validator-version constant, row-builder skeletons. **No validation logic, no orchestrator, no DB writes, no routes, no commit.**

> Filename keeps the `sprint2-pr5a-…` prefix for review-trail continuity with PR#1–PR#4 docs. Body content uses the canonical numbering: **Sprint 1 §3.PR#5a**, the first sub-PR of the §3.PR#5 split (PR#5a = contract; PR#5b = validation modules; PR#5c = orchestrator + row-builder bodies; routes land in §3.PR#7).

---

## Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement Track A backend bridge.
This PR does not implement Core AMS scoring.
This PR establishes the Track B v1 collector contract foundation only; validation and write-path wiring are deferred to PR#5b/PR#5c.
```

PR#5a is **Track B v1 contract foundation only.** No validation logic. No orchestrator. No DB writes. No routes. No legacy `/collect` changes. No Track A scoring. No Core AMS product code. No bot detection. No AI-agent detection. No production / live path.

---

## Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5a is the v1 collector contract surface. The future Track A backend bridge will read Track B evidence and write scoring outputs to a separate table; the bridge is **not** built here, and PR#5a introduces no scoring fields.

---

## Purpose

Establish the type contract surface that PR#5b (validation modules) and PR#5c (orchestrator + row-builder bodies) will import. Specifically:

- The canonical §2.8 reject-reason enum as a TypeScript string union.
- The §2.6 rejected-stage enum.
- TypeScript row shapes (`IngestRequestRow`, `AcceptedEventRow`, `RejectedEventRow`, `RequestResponse`, `OrchestratorOutput`, `RequestContext`, `ResolvedBoundary`, `AuthStatus`).
- Pure hash helpers (`sha256Hex`, `ipHash`).
- The pinned `VALIDATOR_VERSION` constant.
- Row-builder function-type aliases + stub implementations that throw "not implemented in PR#5a".

This is a small, reviewable foundation; no behaviour is wired up yet. PR#5b and PR#5c are blocked on the contract being stable.

---

## Files added

| File | Purpose |
|---|---|
| `src/collector/v1/reason-codes.ts` | `REASON_CODES` + `ReasonCode` (36 codes from §2.8) and `REJECTED_STAGES` + `RejectedStage` (7 stages from §2.6). Pure-data module — zero imports. |
| `src/collector/v1/types.ts` | TypeScript row shapes for `accepted_events`, `rejected_events`, `ingest_requests`; request/response types; `RequestContext`; `ResolvedBoundary`; `AuthStatus`. Type-only — zero runtime code. |
| `src/collector/v1/hash.ts` | `sha256Hex(input)` for content fingerprints; `ipHash(ip, workspaceId, pepper)` HMAC-SHA256 with workspace salting. Imports only `node:crypto`. |
| `src/collector/v1/row-builders.ts` | Function-type aliases (`BuildIngestRequestRow`, `BuildAcceptedEventRow`, `BuildRejectedEventRow`) + stub implementations that throw `PR5A_STUB_MESSAGE`. Real bodies land in PR#5c. |
| `src/collector/v1/index.ts` | Barrel export + `VALIDATOR_VERSION = 'buyerrecon-v1-validator-0.1'`. |
| `tests/v1/reason-codes.test.ts` | Enum completeness, uniqueness, lowercase format, no scoring codes, import discipline. |
| `tests/v1/hash.test.ts` | `sha256Hex` + `ipHash` properties (deterministic, workspace-salted, IPv6 normalisation, no raw IP echo, throws on empty). Import discipline. |
| `tests/v1/row-builders.test.ts` | Stub-throw assertions; barrel re-export checks; `VALIDATOR_VERSION` check; import discipline on `row-builders.ts` and `index.ts`. |
| `docs/sprint2-pr5a-v1-contract-foundation.md` | This document. |

---

## §2.8 reason-code list

Grouped for readability; the runtime tuple order is non-semantic.

| Group | Codes |
|---|---|
| Auth | `auth_invalid`, `auth_site_disabled`, `workspace_site_mismatch` |
| Envelope | `content_type_invalid`, `request_body_invalid_json`, `request_too_large`, `batch_too_large`, `batch_item_count_exceeded` |
| Schema | `schema_unknown`, `schema_version_unsupported`, `schema_version_malformed` |
| Identity / event | `event_name_invalid`, `event_type_invalid`, `event_origin_invalid` |
| Time | `occurred_at_missing`, `occurred_at_invalid`, `occurred_at_too_old`, `occurred_at_too_future` |
| Session | `session_id_missing`, `session_id_invalid` |
| Client event id | `client_event_id_missing`, `client_event_id_invalid` |
| Field-level | `missing_required_field`, `property_type_mismatch`, `property_not_allowed`, `context_not_allowed` |
| PII | `pii_email_detected`, `pii_phone_detected`, `pii_government_id_detected`, `pii_payment_detected`, `pii_credential_detected` |
| Consent | `consent_denied`, `consent_required_but_missing` |
| Debug | `debug_only_not_allowed` |
| Dedupe | `duplicate_client_event_id` |
| Internal | `internal_validation_error` |

**Total: 36 codes.** The reason-code → stage mapping is **deferred to PR#5b** alongside the orchestrator's stage handlers, where the routing decisions actually live.

---

## §2.6 rejected-stage list

`auth | envelope | validation | pii | boundary | dedupe | storage`

---

## `VALIDATOR_VERSION`

```
'buyerrecon-v1-validator-0.1'
```

Pinned in `src/collector/v1/index.ts` per Decision D11. Stamped onto every `accepted_events` row at write time (in PR#5c). Bumped manually when the validator pipeline materially changes — **not** auto-derived from `package.json` version. Tests assert the exact string.

---

## Hash helpers

### `sha256Hex(input: Buffer | string): string`

Plain SHA-256 of arbitrary bytes → 64-char lowercase hex. Used by PR#5c row-builders to compute `request_body_sha256` (request-level) and `payload_sha256` (per-event accepted) and `raw_payload_sha256` (per-event rejected). These are integrity proofs of payload bytes, not security-sensitive secrets — pepper is unnecessary.

### `ipHash(ip, workspaceId, pepper): string`

```
HMAC-SHA256(`${workspaceId}:${ip.toLowerCase().trim()}`, pepper)
```

Properties:
- Workspace-scoped: same IP in two workspaces produces two different hashes. Cross-workspace correlation is prevented.
- Pepper-rotation safe: changing the pepper invalidates prior matches.
- IPv6 normalised: case + whitespace differences canonicalise to the same hash.
- Raw IP is never returned.

**Pepper sourcing.** PR#5a accepts the pepper as a parameter; **no env reads**. The pepper is named `IP_HASH_PEPPER` (Decision A1 / D8) — kept distinct from `SITE_WRITE_TOKEN_PEPPER` so the two secrets can rotate independently. **PR#5a does not edit `.env.example`**; the env-var read lands in PR#5c (or in a thin route/config wrapper later). Until then, callers (e.g. tests) must supply the pepper directly.

---

## Row-builder skeleton policy

PR#5a fixes the function-type signatures the orchestrator (PR#5c) will call:

```ts
type BuildIngestRequestRow = (args: BuildIngestRequestRowArgs) => IngestRequestRow;
type BuildAcceptedEventRow = (...args) => AcceptedEventRow;
type BuildRejectedEventRow = (...args) => RejectedEventRow;
```

The exported runtime functions are **stubs that throw** `PR5A_STUB_MESSAGE` ("row-builders.ts: not implemented in PR#5a; lands in PR#5c"). Tests assert the throw. This:

- Makes accidental imports from PR#5b/c development fail loudly.
- Lets tests reference the function identifiers (e.g., for re-export checks).
- Locks in the public API surface so PR#5c only fills in bodies.

The concrete arg shapes for `buildAcceptedEventRow` / `buildRejectedEventRow` are deferred to PR#5c because they depend on PR#5b's per-event validation outputs (canonical_jsonb projection, normalised event envelope, etc.). The signature for `buildIngestRequestRow` is concrete in PR#5a because it doesn't depend on per-event validation.

---

## What PR#5a does NOT do

- **No validation rules** (R-2, R-3, R-5, R-6, R-9, R-10, R-11, R-12). Lands in PR#5b.
- **No PII regex**. Lands in PR#5b.
- **No consent-denied logic** (including the `consent_state_summary` forbidden-fields check). Lands in PR#5b.
- **No `canonical_jsonb` projection.** Lands in PR#5b per Decision D3.
- **No intra-batch dedupe** (`(workspace_id, site_id, client_event_id)` set). Lands in PR#5b.
- **No boundary wrapper** around PR#4's `assertPayloadBoundary`. Lands in PR#5b.
- **No orchestrator** (`runRequest(ctx, rawBody) → OrchestratorOutput`). Lands in PR#5c.
- **No row-builder bodies.** Lands in PR#5c.
- **No env-var read** (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`). Lands in PR#5c.
- **No SQL execution** / no `pool.query`. Lands in §3.PR#7 alongside route binding.
- **No HTTP route binding.** Lands in §3.PR#7.
- **No `/v1/event` or `/v1/batch`.** Lands in §3.PR#7.
- **No modification to `src/collector/routes.ts`** (legacy `/collect` route). Stays operational unchanged.
- **No modification to `src/collector/validate.ts`** (legacy validator). Stays in service for `/collect`.
- **No modification to `tests/validate.test.ts`.** Legacy validator tests keep passing.
- **No modification to `src/server.ts`.** No new route mounted.
- **No migration file change.** No `src/db/schema.sql` change.
- **No `.env.example` change.** `IP_HASH_PEPPER` is documented here in this PR doc only; the actual env-var entry lands when env wiring lands.
- **No bot detection / AI-agent detection / scoring fields** anywhere.
- **No imports from Track A or Core AMS.**

---

## `IP_HASH_PEPPER` — deferred env-var note

PR#5a does **not** read `process.env`. The pepper is supplied by the caller as a parameter. The future env var is **`IP_HASH_PEPPER`** (separate from `SITE_WRITE_TOKEN_PEPPER` for independent rotation). Loading happens in **PR#5c** (or in a route/config wrapper later); `.env.example` will be updated at that point. Until then:

- Tests inject a deterministic test pepper (e.g. `'0'.repeat(64)`).
- Callers in development environments must supply the pepper themselves.
- **No raw IP is ever persisted** — production deployments without `IP_HASH_PEPPER` configured will not be able to compute `ip_hash` and the route layer (PR#7) will treat the missing pepper as a server config error.

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs the three new PR#5a test files alongside the existing six. All tests are pure — no DB connection, no network, no Playwright.

---

## Rollback plan

Migration-free, schema-free, route-free. Rollback is simply deleting the nine new files:

```bash
rm -rf src/collector/v1/
rm -rf tests/v1/
rm docs/sprint2-pr5a-v1-contract-foundation.md
```

- **No migration to revert.** PR#5a does not touch `migrations/` or `src/db/schema.sql`.
- **No env-var to revert.** PR#5a does not touch `.env.example`.
- **No route to revert.** PR#5a does not touch `src/server.ts` or any `*/routes.ts`.
- **No legacy module changed.** `src/collector/{routes,validate}.ts`, `tests/validate.test.ts`, `src/auth/workspace.ts`, and the entire `src/db/` directory are byte-identical to pre-PR#5a state.
- **No application code yet imports from `src/collector/v1/`** at runtime — rollback cannot break any active code path.

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## Relationship to the three-part architecture

- **PR#5a is Track B v1 contract foundation.** Type definitions + reason codes + hash helpers + row-builder skeletons.
- **PR#5a is not Track A scoring.** Zero scoring fields. Zero imports from `/Users/admin/github/ams-qa-behaviour-tests`.
- **PR#5a is not Core AMS product code.** Zero imports from `/github/keigentechnologies/ams`. PR#5a is intentionally Track-B-only — when scoring is mature enough to be productized, it will live in Core AMS as a separate package and consume Track B evidence through the future Track A → Core AMS bridge.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → **§3.PR#5a (this)** → §3.PR#5b (validation modules) → §3.PR#5c (orchestrator + row-builder bodies) → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK file touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** the helpers take the pepper as a parameter. `process.env` is not accessed anywhere in PR#5a's source (verified by structural test).
- **No collector / route / validator runtime change:** legacy `/collect` continues to function unchanged. `tests/validate.test.ts` continues to pass unchanged.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change:** `migrations/` and `src/db/schema.sql` are byte-identical to pre-PR#5a state.
- **No commit was created by this PR.** Working-tree changes only.

---

## Next — PR#5b

Pure validation modules: `envelope.ts`, `validation.ts`, `pii.ts`, `consent.ts`, `boundary.ts`, `dedupe.ts`, `canonical.ts`. Per-event validation rules R-2 / R-3 / R-5 / R-6 / R-9 / R-10 / R-11 / R-12. PII regex set per §2.10. Consent-denied + `consent_state_summary` forbidden-fields per R-11. Intra-batch dedupe on `(workspace_id, site_id, client_event_id)`. Canonical-JSONB projection per Decision D3. **No route binding. No DB writes. No env-var read.** Out of scope for PR#5a — do not start.
