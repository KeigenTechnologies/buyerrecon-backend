# Sprint 1 PR#5c-1 — normalisedEnvelope + row-builder bodies

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.1 + §2.5 + §2.6 + §2.7 + §3.PR#5
**Status:** one new helper module + three row-builder bodies (replacing PR#5a stubs) + one new test file + one rewritten test file + this doc. **No orchestrator, no DB writes, no routes, no env reads, no commit.**

> Filename keeps the `sprint2-pr5c-1-…` prefix for review-trail continuity. Body content uses the canonical numbering: **Sprint 1 §3.PR#5c-1**, the first sub-PR of the §3.PR#5c split (**PR#5c-1 = normalisedEnvelope + row-builder bodies**; PR#5c-2 = orchestrator / pipeline composition).

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
This PR does not implement the orchestrator / runRequest / pipeline composition.
This PR only adds Track B pure normalised-envelope and row-builder body implementations for the v1 collector pipeline.
```

---

## 2. Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5c-1 ships pure helpers that PR#5c-2's orchestrator will compose. Zero scoring fields. Zero imports from Track A or Core AMS.

---

## 3. PR#5c-1 boundary — why PR#5c is split

The full §3.PR#5c surface (orchestrator + row-builder bodies + normalisedEnvelope) is too large for a single Codex review pass. PR#5c is split into two sub-PRs to keep each review focused:

- **PR#5c-1 (this)** — `normalised-envelope.ts` (new), `row-builders.ts` body rewrite, tests, doc. **No orchestrator.**
- **PR#5c-2 (next)** — `orchestrator.ts` (`runRequest`) composing PR#4 auth + PR#5b-1 envelope/validation + PR#5b-2 PII/consent/boundary/dedupe + PR#5b-3 canonical/payload-hash + PR#5c-1 normalisedEnvelope/row-builders. Tests, doc.

After PR#5c-2: PR#7 (route binding + SQL execution + env loading + `.env.example` update) wires the orchestrator to HTTP routes.

---

## 4. Files added / modified

| File | Change |
|---|---|
| `src/collector/v1/normalised-envelope.ts` | **NEW** — exports `NormalisedEnvelopeInput` + `NORMALISED_ENVELOPE_KEYS` + `buildAcceptedNormalisedEnvelope(input)` |
| `src/collector/v1/row-builders.ts` | **MODIFIED** — three stub bodies replaced with real implementations. Adds `LEGACY_*` sentinel constants. Concretises `BuildAcceptedEventRowArgs` / `BuildRejectedEventRowArgs` (replacing PR#5a's `(...args: readonly any[])` placeholders). Removes `PR5A_STUB_MESSAGE` (no more stubs). Adds `reconciled_at` and `auth_status` to `BuildIngestRequestRowArgs`. |
| `tests/v1/normalised-envelope.test.ts` | **NEW** — fixed-shape, null-policy, ISO timestamps, traffic_class/debug invariants, exclusion list, determinism, **`payloadSha256(normalisedEnvelope) ≠ payloadSha256(canonical_jsonb)`** |
| `tests/v1/row-builders.test.ts` | **REWRITTEN** — replaces PR#5a stub-throw assertions with real-body assertions; adds index.ts barrel-discipline regression. |
| `docs/sprint2-pr5c-1-normalised-envelope-row-builders.md` | **NEW** — this document |

**Files NOT modified:** `src/collector/v1/index.ts`, `validation.ts`, `consent.ts`, `pii.ts`, `boundary.ts`, `dedupe.ts`, `canonical.ts`, `payload-hash.ts`, `stable-json.ts`, `reason-codes.ts`, `types.ts`, `hash.ts`, `stage-map.ts`, `envelope.ts`; `src/auth/workspace.ts`; `src/server.ts`; `src/collector/{routes,validate}.ts`; `migrations/`; `src/db/schema.sql`; `.env.example`.

---

## 5. normalisedEnvelope vs canonical_jsonb

The single most important PR#5c distinction (per §2.5 line 168):

| Shape | Source | Keys | Includes `properties` / `context` / `page_*`? | Used as |
|---|---|---|---|---|
| **normalisedEnvelope** | `buildAcceptedNormalisedEnvelope(...)` | **36** (fixed allowlist) | ✅ yes (post-validation) | input to `payloadSha256` for `accepted_events.payload_sha256` |
| **canonical_jsonb** | `buildCanonicalJsonb(...)` | **19** (Decision D3) | ❌ no (data-minimised projection) | stored on `accepted_events.canonical_jsonb` |

**Critical rule (preserved from PR#5b-3 and re-asserted by PR#5c-1 tests):**

```
accepted_events.payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope(...))
accepted_events.canonical_jsonb = buildCanonicalJsonb(...)
```

`accepted_events.payload_sha256` is NEVER `payloadSha256(canonical_jsonb)`. The two shapes are deliberately distinct (§2.5 line 168: "after canonicalisation, before the canonical projection").

### The 36-key normalisedEnvelope allowlist

```
Server-stamped (per §2.1):
  request_id, received_at, workspace_id, site_id,
  validator_version, collector_version,
  id_format, traffic_class, size_bytes

Identity (validated):
  client_event_id, event_name, event_type, event_origin

Schema (validated):
  schema_key, schema_version

Time (validated):
  occurred_at

Identity / join (raw_event):
  anonymous_id, user_id, company_id,
  session_id, session_seq, session_started_at, session_last_seen_at

Consent (raw_event):
  consent_state, consent_source, consent_updated_at,
  pre_consent_mode, tracking_mode, storage_mechanism

Page (raw_event):
  page_url, page_path, page_referrer, page_title

Containers (raw_event):
  properties, context

Debug:
  debug
```

### Exclusion list (NEVER on normalisedEnvelope)

```
canonical_jsonb, payload_sha256,
accepted_at, payload_purged_at,
ip_hash, user_agent, raw IP,
risk_score, classification, recommended_action,
behavioural_score, bot_score, agent_score, is_bot, is_agent
```

### Field policy

- **Null policy for unavailable optionals:** always emit the key with `null` value. The output shape is fixed at 36 keys regardless of which optionals the SDK populates. Parallel to `canonical_jsonb`'s null policy.
- **ISO timestamps:** `validated.occurred_at` (Date) → `toISOString()`. `ctx.received_at` (Date) → `toISOString()`. Date-shaped raw_event strings (`session_started_at`, `session_last_seen_at`, `consent_updated_at`) routed through `Date.parse → toISOString` so input formatting variants (e.g. `'2026-05-09T10:00:00Z'` vs `'2026-05-09T10:00:00.000Z'`) produce the same hash output.
- **`traffic_class` always `'unknown'`** (Decision #13). Even when raw_event tries to set it, the output is `'unknown'`.
- **`debug` always `false`** for accepted-event writes (R-12 already rejected `debug=true` upstream; this is a defense-in-depth invariant).
- **`size_bytes`** is `Buffer.byteLength(stableStringify(raw_event), 'utf8')` — NOT `JSON.stringify(raw_event)`. The byte length is independent of object-key insertion order.

---

## 6. accepted_events.payload_sha256 computation

```
payload_sha256 = payloadSha256(buildAcceptedNormalisedEnvelope({validated, resolved, ctx, raw_event, config}))
```

- `payloadSha256` from PR#5b-3 — computes `sha256Hex(stableStringify(value))`.
- Input is the 36-key normalised envelope, NOT the 19-key canonical projection.
- Output is 64-char lowercase hex.
- Deterministic across runs (no `Date.now()`, no env reads, no runtime side effects).

---

## 7. accepted_events.canonical_jsonb computation

```
canonical_jsonb = buildCanonicalJsonb({validated, resolved, ctx, optional})
```

- `buildCanonicalJsonb` from PR#5b-3 — returns the 19-key data-minimised projection.
- The `optional` parameter is extracted from `raw_event` inside `buildAcceptedEventRow` via type guards. Six fields: `session_seq`, `traffic_class` (always `'unknown'`), `consent_state`, `consent_source`, `tracking_mode`, `storage_mechanism`.

---

## 8. rejected_events.raw_payload_sha256 computation

```
raw_payload_sha256 = payloadSha256(raw_event)
```

- `raw_event` is the individual rejected event envelope as parsed from the wire (per §2.6 case table — "parseable batch fragment with one invalid event").
- The PR#5b-3 contract on `payloadSha256` propagates errors on unsupported values (BigInt, NaN, undefined, etc.) — there is **no silent empty-hash fallback**. If `payloadSha256(raw_event)` throws, the orchestrator (PR#5c-2) handles it.
- **`buildRejectedEventRow` is ONLY called for per-event rejections.** Whole-request unparseable failures do NOT create a `rejected_events` row — the proof lives on `ingest_requests.request_body_sha256` only (§2.6 case table).

---

## 9. ingest_requests.request_body_sha256 computation

```
request_body_sha256 = sha256Hex(ctx.raw_body_bytes)
```

- `sha256Hex` from PR#5a — directly hashes the `Buffer` of raw HTTP request body bytes.
- **Not** `payloadSha256` — the request body is opaque bytes, not a JSON value to canonicalise.

---

## 10. Legacy NOT NULL shim policy

The live `accepted_events` schema (post-PR#1–PR#3) carries some NOT NULL columns from the legacy contract that have no exact v1-contract source. PR#5c-1 supplies documented sentinel values for these columns so the row builder produces a complete `AcceptedEventRow` ready for insertion. These sentinels are NOT evidence claims — they explicitly mark "the SDK did not supply this value and the schema does not yet allow NULL here". A future schema PR may relax the NOT NULL constraints and drop these shims.

| Column | Sentinel | When applied |
|---|---|---|
| `accepted_events.session_id` (legacy NOT NULL) | `__server__` | When `validated.session_id === null` (e.g. server-origin events without a session per R-3) |
| `accepted_events.browser_id` (legacy NOT NULL) | `__server__` | When `raw_event.anonymous_id` is missing or non-string |
| `accepted_events.hostname` (legacy NOT NULL) | `__unknown_host__` | When neither `raw_event.hostname` nor a parseable `raw_event.page_url.host` is available |
| `ingest_requests.ip_hash` workspace salt | `__unauth__` | When auth failed and `resolved === null`; the IP hash uses this sentinel as the workspace salt to satisfy the §2.7 NOT NULL invariant on `ip_hash` |

Exported as constants from `row-builders.ts`: `LEGACY_SESSION_ID_SENTINEL`, `LEGACY_BROWSER_ID_SENTINEL`, `LEGACY_HOSTNAME_SENTINEL`, `UNAUTH_WORKSPACE_SENTINEL`. Tests assert each value.

`buildIngestRequestRow` and `buildAcceptedEventRow` **throw `TypeError`** when `ctx.ip` is null/empty — there is NO fake-IP fallback. The caller (PR#5c-2 orchestrator, then PR#7 route layer) must resolve a client IP before invoking the builder. Faking `0.0.0.0` would silently corrupt the per-IP request-rate evidence.

---

## 11. Missing-evidence policy (PR#2 consent / tracking / storage fields)

**Missing fields are recorded as `null`, NOT as invented defaults.**

The `accepted_events` PR#2 evidence columns for consent / tracking / storage state are pre-cutover nullable in the live DB schema. Until the SDK contract + DB tighten to NOT NULL (a future post-cutover PR), PR#5c-1 records the literal "the SDK did not supply this field" with `null`:

| Field | Policy when SDK supplies a value | Policy when SDK supplies nothing |
|---|---|---|
| `consent_state` | pass through (admit set per §2.11: `granted` / `denied` / `unknown` / `partial`) | **`null`** — do not invent `'unknown'` |
| `consent_source` | pass through (admit set: `cmp` / `sdk` / `server` / `inferred`) | **`null`** — do not invent `'inferred'` |
| `tracking_mode` | pass through (admit set: `full` / `session_only` / `anonymous_only` / `disabled`) | **`null`** — do not invent `'full'` |
| `storage_mechanism` | pass through (admit set: `cookie` / `session_storage` / `memory` / `none`) | **`null`** — do not invent `'none'` |
| `pre_consent_mode` | pass through (boolean) | **`null`** — do not invent `false` |
| `consent_updated_at` | parse ISO string → `Date` | `null` |

**Rationale.** Inventing defaults like `'full'` / `'none'` / `false` would silently turn "field absent" into an evidence claim — for example, a row reading `tracking_mode = 'full'` and `storage_mechanism = 'cookie'` is materially different in audit/replay from a row reading `tracking_mode = null` and `storage_mechanism = null`. Evidence Foundation must distinguish "the SDK explicitly stated full tracking with cookie storage" from "the SDK was silent on tracking and storage". `null` is the only honest representation of the latter.

**§2.5 target.** The §2.5 spec lists these fields as `NOT NULL`. The §3.PR#2 migration rule defers DB-level NOT NULL enforcement until post-cutover backfill is verified. PR#5c-1 represents the current (transition) state. A future post-cutover PR will:
1. tighten the SDK contract so events always carry these fields,
2. add `NOT NULL` to the DB columns,
3. tighten the `AcceptedEventRow` TypeScript type back to non-null, and
4. remove the `null` allowance from `row-builders.ts`.

`AcceptedEventRow` type fields were narrowly widened to `string | null` (or `boolean | null`) in `src/collector/v1/types.ts` to reflect the current pre-cutover state.

**Legacy NOT NULL shims remain** (these are NOT evidence claims about the SDK; they are documented sentinels marking "the live DB column does not yet allow NULL"):
- `accepted_events.session_id` ← `__server__` when `validated.session_id` is null
- `accepted_events.browser_id` ← `__server__` when `raw_event.anonymous_id` is missing
- `accepted_events.hostname` ← `__unknown_host__` when neither `raw_event.hostname` nor a parseable `raw_event.page_url.host` is available
- `ingest_requests.ip_hash` workspace salt ← `__unauth__` when auth failed and `resolved === null`

These four are the ONLY remaining sentinels in PR#5c-1's row-builders. Every other "missing" field is recorded as `null`.

---

## 12. row-builder contracts

### `buildIngestRequestRow(args: BuildIngestRequestRowArgs): IngestRequestRow`

- `request_body_sha256 = sha256Hex(ctx.raw_body_bytes)` (bytes, not JSON value).
- `ip_hash = ipHash(ctx.ip, resolved?.workspace_id ?? '__unauth__', ip_hash_pepper)`.
- Counts and `reconciled_at` from `args`.
- `auth_status` from `args` (NOT inferred from `reject_reason_code` — the orchestrator passes it explicitly).
- `collector_version` from `args`.
- **Throws `TypeError`** when `ctx.ip` is null/empty.
- Does NOT: read env, query DB, resolve tokens, call `payloadSha256` for `request_body_sha256`, introduce scoring fields.

### `buildAcceptedEventRow(args: BuildAcceptedEventRowArgs): AcceptedEventRow`

- `normalisedEnvelope = buildAcceptedNormalisedEnvelope({validated, resolved, ctx, raw_event, config})`.
- `payload_sha256 = payloadSha256(normalisedEnvelope)`. **NOT** `payloadSha256(canonical_jsonb)`.
- `canonical_jsonb = buildCanonicalJsonb({validated, resolved, ctx, optional})`.
- `ip_hash = ipHash(ctx.ip, resolved.workspace_id, config.ip_hash_pepper)`.
- `raw = raw_event` (original parsed JSON verbatim into the legacy `raw` column).
- `traffic_class = 'unknown'`. `debug_mode = false`. `payload_purged_at = null`.
- Legacy compatibility shims for `session_id`, `browser_id`, `hostname`.
- Compatibility defaults for `consent_state`, `consent_source`, `tracking_mode`, `storage_mechanism`, `pre_consent_mode`.
- **Throws `TypeError`** when `ctx.ip` is null/empty.
- Does NOT: hash canonical_jsonb, generate `accepted_at`, read env, query DB, run validation, introduce scoring/bot/AI-agent fields.

### `buildRejectedEventRow(args: BuildRejectedEventRowArgs): RejectedEventRow`

- `raw_payload_sha256 = payloadSha256(raw_event)` (the individual rejected event envelope).
- `reason_codes = [reason_code]` (dual-write per PR#3 transition).
- `rejected_stage` from `args`.
- `rejected_at = ctx.received_at`. `received_at = ctx.received_at`.
- `debug_mode = false`. `sample_visible_to_admin = true`.
- `size_bytes = Buffer.byteLength(stableStringify(raw_event), 'utf8')`.
- Best-effort fields (`client_event_id`, `id_format`, `event_name`, `event_type`, `schema_key`, `schema_version`) propagate from `args.best_effort` (any may be null).
- Errors from `payloadSha256` propagate — **no silent empty-hash fallback**.
- Does NOT: create rows for whole-request unparseable failures (orchestrator enforces), use `sha256Hex("")` as fallback, query DB, read env, run validation.

---

## 13. Non-goals

PR#5c-1 does NOT:

- Implement the orchestrator / `runRequest` / pipeline composition (PR#5c-2).
- Add DB writes or SQL execution (PR#7).
- Add HTTP route handlers (PR#7).
- Read `process.env` (PR#7 config-injects).
- Resolve auth tokens (PR#5c-2 wires PR#4's helper; PR#7 supplies the DB lookup callback).
- Introduce scoring / bot / AI-agent / risk-score fields.
- Touch Track A or Core AMS.
- Modify the PR#5a `src/collector/v1/index.ts` barrel (still 4 re-exports).
- Modify migrations / schema / `.env.example`.

---

## 14. Relationship to PR#5c-2 and PR#7

- **PR#5c-2**: implements `runRequest(input): OrchestratorOutput` composing PR#4 auth + PR#5b-1 envelope/validation + PR#5b-2 PII/consent/boundary/dedupe + PR#5b-3 canonical/payload-hash + PR#5c-1 normalisedEnvelope/row-builders. Tests, doc. Still no DB / no routes / no env reads — `runRequest` takes a `CollectorConfig` object and a `lookupByHash` callback as parameters.
- **PR#7**: route binding + SQL execution + env loading (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER` from `process.env`) + `.env.example` update. PR#7 mounts `/v1/event` and `/v1/batch` routes that call `runRequest` and `pool.query`-insert the returned row candidates.

---

## 15. Rollback plan

Migration-free, schema-free, route-free. Rollback:

1. Delete `src/collector/v1/normalised-envelope.ts`.
2. Delete `tests/v1/normalised-envelope.test.ts`.
3. Delete `docs/sprint2-pr5c-1-normalised-envelope-row-builders.md`.
4. Revert `src/collector/v1/row-builders.ts` to the PR#5a stub version (three exports throwing `PR5A_STUB_MESSAGE`).
5. Revert `tests/v1/row-builders.test.ts` to the PR#5a version (16 stub-throw assertions + barrel discipline test).

- **No migration to revert.**
- **No env-var to revert.**
- **No route to revert.**
- **No legacy module changed.** `src/collector/{routes,validate}.ts`, `tests/validate.test.ts`, `src/auth/workspace.ts`, all PR#5a / PR#5b-1 / PR#5b-2 / PR#5b-3 modules byte-identical.
- **`src/collector/v1/index.ts` unchanged** — still 4 PR#5a re-exports.
- **No application code yet imports the new modules at runtime** — rollback cannot break any active code path.

---

## 16. Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## 17. Three-part architecture relationship

- **PR#5c-1 is Track B v1 row-builder infrastructure.** Pure functions only. No scoring.
- **PR#5c-1 is not Track A scoring.** Zero scoring fields. Zero imports from Track A.
- **PR#5c-1 is not Core AMS product code.** Zero imports from Core AMS.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → §3.PR#5a (closed pending Codex) → §3.PR#5b-1 (closed pending Codex) → §3.PR#5b-2 (PASS after consent fix) → §3.PR#5b-3 (PASS after symbol-key hardening) → **§3.PR#5c-1 (this)** → §3.PR#5c-2 (orchestrator) → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## 18. Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo, GTM, GA4, LinkedIn pixel, ThinSDK, production endpoint, or production database touched.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** `process.env` is not accessed anywhere in PR#5c-1 source (verified by structural test on every new / modified module).
- **No collector / route / validator runtime change.** Legacy `/collect` continues to function unchanged.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change.**
- **No commit was created by this PR.** Working-tree changes only.
