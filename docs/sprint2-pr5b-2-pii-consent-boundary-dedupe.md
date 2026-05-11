# Sprint 1 PR#5b-2 — PII + consent + boundary + intra-batch dedupe

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.8 + §2.9 (R-11) + §2.10 + §2.11 + §2.12 + §3.PR#5
**Status:** four pure modules + four pure-function test files + this doc. **No env reads, no DB writes, no routes, no orchestrator, no row-builder bodies, no commit.**

> Filename keeps the `sprint2-pr5b-…` prefix for review-trail continuity. Body content uses the canonical numbering: **Sprint 1 §3.PR#5b-2**, the second sub-PR of the §3.PR#5b split (PR#5b-1 = stage-map + envelope + core validation; **PR#5b-2 = PII + consent + boundary + dedupe**; PR#5b-3 = canonical projection + stable JSON + payload-hash helper).

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
This PR only adds Track B pure PII, consent, boundary, and intra-batch dedupe modules for the v1 collector pipeline.
```

---

## Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#5b-2 ships pure validation infrastructure that the future orchestrator (PR#5c) will consume. Zero scoring fields. Zero imports from Track A or Core AMS.

---

## Purpose

Four modules, each independently consumable by the orchestrator:

1. **`pii.ts`** — regex-only PII detection per §2.10. Five kinds (email / phone / government_id / payment / credential), structural-key exemption for low-confidence detectors, Luhn-gated payment, paths reported without raw values.
2. **`consent.ts`** — R-11 consent-denied gate. Rejects denied behavioural events (`page` / `track` / `identify` / `group`); rejects `tracking_mode='buffer_only'` unconditionally; admits the strict `consent_state_summary` exception only when per-site config opts in.
3. **`boundary.ts`** — thin v1-namespace wrapper around PR#4's `assertPayloadBoundary`. Defensive `unknown` payload typing.
4. **`dedupe.ts`** — intra-batch duplicate detection on `(workspace_id, site_id, client_event_id)`. Cross-request dedupe defers to §3.PR#6.

All four are **pure functions** — no DB, no env, no logging, no Express, no network. Each module is tested in isolation.

---

## Files added

| File | Lines | Purpose |
|---|---|---|
| `src/collector/v1/pii.ts` | ~250 | PII regex set, STRUCTURAL_ID_KEYS, scanForPii, firstPiiReasonCode, passesLuhn |
| `src/collector/v1/consent.ts` | ~140 | R-11 gate with consent_state_summary exception + forbidden-fields check |
| `src/collector/v1/boundary.ts` | ~50 | Thin wrapper around PR#4 assertPayloadBoundary |
| `src/collector/v1/dedupe.ts` | ~70 | Intra-batch dedupe by (workspace_id, site_id, client_event_id) |
| `tests/v1/pii.test.ts` | ~400 | Per-kind positives + negatives + structural exemption + path + safety + determinism |
| `tests/v1/consent.test.ts` | ~250 | Denied paths, buffer_only, exception qualification, forbidden-field per kind, optional canonical pass |
| `tests/v1/boundary.test.ts` | ~120 | Pass-through cases, mismatch cases, result safety, import discipline |
| `tests/v1/dedupe.test.ts` | ~180 | Key shape, duplicate detection, missing-id pass-through, output preservation |
| `docs/sprint2-pr5b-2-pii-consent-boundary-dedupe.md` | this | Review doc |

`src/collector/v1/index.ts` is **not** modified (locked by PR#5a's barrel-discipline test). Tests import the new modules from their own paths.

---

## `pii.ts` — strategy

### Regex set per kind (Decisions D1, D2, D3)

| Kind | Pattern | Notes |
|---|---|---|
| `email` | `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/` | Same shape as legacy `validate.ts` for `/collect` parity. |
| `phone` | `/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/` + digit-density ≥ 7 | Decision D3: keep legacy shape. |
| `government_id` (US SSN) | `/\b\d{3}-\d{2}-\d{4}\b/` strict | Bare 9-digit numbers are NOT flagged. |
| `government_id` (UK NI) | `/\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/` | Strict prefix admit set + 6 digits + suffix A-D. |
| `payment` | `(?:\d[ -]?){12,18}\d` candidate match → strip non-digits → length 13–19 → **Luhn-check** | Only Luhn-passing sequences flag. 13-digit non-cards (e.g. `1234567890123`) fail Luhn → no FP. |
| `credential` (private key) | `/-----BEGIN [A-Z ]+PRIVATE KEY-----/` | Covers RSA / DSA / EC / OPENSSH / ENCRYPTED. |
| `credential` (AWS) | `/\bAKIA[0-9A-Z]{16}\b/` | |
| `credential` (GitHub) | `/\bgh[opsu]_[A-Za-z0-9_]{36,}\b/` | ghp_ / gho_ / ghs_ / ghu_. |
| `credential` (Slack) | `/\bxox[bpas]-[A-Za-z0-9-]+\b/` | xoxb / xoxp / xoxa / xoxs. |
| `credential` (Google API key) | `/\bAIza[A-Za-z0-9_-]{35}\b/` | |

### False-positive guardrails

1. **`STRUCTURAL_ID_KEYS` exemption** (Decision D4) — values under any structural key (and the entire sub-tree below it) are exempt from low-confidence email/phone scanning. The set is the v1-aligned union of legacy `validate.ts` + PR#1–PR#4 column names + v1 contract names. **High-confidence detectors (credential / government_id / payment) STILL run** under structural-exempt sub-trees because their patterns rarely collide with structural ID values.
2. **UUIDs are letter-bearing** (hex `0-9a-f`) — `PHONE_RE` does not match canonical UUID strings. Tested explicitly.
3. **ISO timestamps** lack a terminal 3–4 digit group → `PHONE_RE` does not match. Tested.
4. **Short numeric IDs (< 7 digits)** filtered by phone digit-density floor. Tested.
5. **Known phone limitation** — a free-text contiguous 7+ digit numeric ID may FP. Mitigation: structural-key exemption catches the most common cases. Documented in `pii.ts` source comment.
6. **Per Decision D5, no PII_KEYS key-name rejection** — PR#5b-2 is regex-only on values. Defense-in-depth key-name layer can be added later.

### `PiiHit` safety guarantee

`PiiHit` carries **only** `kind`, `reason_code`, and `path`. The matched string, sample, excerpt, or surrounding text is **never** included. Tests assert this with canary values: `JSON.stringify(hits)` does not contain the matched value bytes.

### `firstPiiReasonCode` determinism (Decision D6)

Returns the first hit by **traversal order** (depth-first, keys in insertion order, array indices ascending). Within a single string, multiple kinds are reported in canonical detector order: credential → government_id → payment → email → phone. No severity tiebreak across paths — first-by-traversal wins.

### Path format

Dot + bracket notation: `data.user.email`, `events[3].context.notes`, `payload.batch[0].properties.contact`. Root-level string match has empty-string path. Keys containing dots (rare in event JSON) are not escaped — documented limitation.

---

## `consent.ts` — strategy

### Decision order (D3 first-reason discipline)

1. `tracking_mode === 'buffer_only'` → `consent_required_but_missing` (regardless of `consent_state`).
2. `consent_state !== 'denied'` → `{ ok: true }` (gate is permissive when not denied).
3. **consent_state_summary exception** (Decision D7):
   - Strict 5-field shape: `event_origin='system'`, `event_type='system'`, `event_name='consent_state_summary'`, `tracking_mode='disabled'`, `storage_mechanism ∈ {none, memory}`.
   - **AND** `config.allowConsentStateSummary === true`.
   - If qualifies AND no forbidden fields on event → `{ ok: true }`.
   - If qualifies AND forbidden fields on event OR canonical → `consent_denied`.
4. **Denied consent_state_summary by name that did NOT qualify above** → `consent_denied`. The spec admits the summary ONLY in the strict-shape + opt-in form; a denied event using the summary name without qualifying (config disabled, wrong shape, malformed storage_mechanism, etc.) is rejected by deny-by-default. This step makes the §2.11 admit set the only path through the gate for the summary name.
5. Denied + `event_type ∈ {page, track, identify, group}` → `consent_denied`.
6. Otherwise (denied + non-behavioural that is NOT named `consent_state_summary`) → `{ ok: true }` (downstream gates such as the R-10 origin/type matrix and R-12 debug rule handle any further rejection on this shape).

### Forbidden fields (Decisions D7 + D8)

```
anonymous_id, user_id, company_id,
session_id, session_seq,
page_url, page_path, page_referrer, page_title,
properties (when non-empty object),
context  (when non-empty object)
```

`properties: {}` is allowed. `properties: { foo: 1 }` is rejected. Same for `context`.

### Optional canonical pass (Decision D9)

`validateConsent` accepts an optional `canonical?: Record<string, unknown> | null`. When the orchestrator (PR#5c) supplies the canonical projection (PR#5b-3), forbidden-field check applies to **both** event and canonical. If canonical is absent, only the inbound event is checked.

### Default config

`{ allowConsentStateSummary: false }` — deny by default. Per-site opt-in is sourced from `site_configs` JSON by the orchestrator in PR#7+.

---

## `boundary.ts` — strategy

Thin wrapper that delegates to PR#4's `assertPayloadBoundary`. The v1-namespace symbol exists so PR#5c orchestrator imports a consistent surface across all v1 validation modules.

### Decision D10 — defensive `unknown` payload typing

`PayloadBoundaryFields = { workspace_id?: unknown; site_id?: unknown }`. The wrapper's TypeScript signature accepts `unknown` values and casts to PR#4's narrower `string | null` type at the call site. PR#4's helper guards every payload field with a runtime `typeof === 'string'` check, so non-string values pass through harmlessly (treated as not-present).

### Behaviour

| Input | Result |
|---|---|
| payload undefined / null / `{}` | `{ ok: true }` |
| payload field matches resolved | `{ ok: true }` |
| payload field is null / non-string | `{ ok: true }` (treated as not-present) |
| payload field is a string and differs from resolved | `{ ok: false, reason_code: 'workspace_site_mismatch' }` |

Result **never** echoes payload-side workspace/site values.

---

## `dedupe.ts` — strategy

### Key shape

`(workspace_id, site_id, client_event_id)` — joined with NUL byte separators. NUL bytes cannot appear in JSON strings, so the joined key is collision-safe regardless of identifier contents.

### Behaviour

- **First occurrence** of a key → `{ duplicate: false, reason_code: null }`.
- **Subsequent occurrences** of the same key → `{ duplicate: true, reason_code: 'duplicate_client_event_id' }`.
- **Missing / null / empty `client_event_id`** → `{ duplicate: false, reason_code: null }` (PR#5b-1 R-9 is the gate for that condition; double-rejecting would muddy the reason-code surface).
- **Output length === input length.** Indexes preserved 1:1.

### Cross-request dedupe is OUT of scope

Cross-request dedupe lands as a DB UNIQUE INDEX in §3.PR#6.

---

## What PR#5b-2 does NOT do

- **No `canonical_jsonb` projection** — PR#5b-3 implements the 19-field data-minimised projection per Decision D3 (PR#5 plan).
- **No stable JSON / `payload_sha256` helper** — PR#5b-3 (homegrown deterministic stringify per Decision D7).
- **No orchestrator** (`runRequest(ctx, rawBody)`) — PR#5c.
- **No row-builder bodies** — PR#5c (the PR#5a stubs still throw `PR5A_STUB_MESSAGE`).
- **No env-var read** — PR#5c.
- **No SQL execution** — lands at route binding (§3.PR#7).
- **No HTTP route binding** — §3.PR#7.
- **No `/v1/event` or `/v1/batch`** — §3.PR#7.
- **No `last_used_at` update** on `site_write_tokens` — PR#5c.
- **No PII_KEYS key-name rejection** — Decision D5 (regex-only in PR#5b-2).
- **No modification to `src/collector/{routes,validate}.ts`** (legacy `/collect` route).
- **No modification to `tests/validate.test.ts`** (legacy validator tests).
- **No modification to `src/collector/v1/index.ts`** (PR#5a barrel).
- **No migration / schema / `.env.example` change.**
- **No bot detection / AI-agent detection / scoring fields** anywhere.
- **No imports from Track A or Core AMS.**

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

---

## Rollback plan

Migration-free, schema-free, route-free. Rollback deletes the nine new files:

```bash
rm src/collector/v1/pii.ts
rm src/collector/v1/consent.ts
rm src/collector/v1/boundary.ts
rm src/collector/v1/dedupe.ts
rm tests/v1/pii.test.ts
rm tests/v1/consent.test.ts
rm tests/v1/boundary.test.ts
rm tests/v1/dedupe.test.ts
rm docs/sprint2-pr5b-2-pii-consent-boundary-dedupe.md
```

- No migration. No schema change. No env-var change.
- `src/collector/v1/{reason-codes,types,hash,row-builders,index,stage-map,envelope,validation}.ts` — byte-identical to pre-PR#5b-2 state.
- `src/auth/workspace.ts` — byte-identical (PR#5b-2's boundary wrapper imports it; doesn't modify it).
- `src/collector/{routes,validate}.ts` — byte-identical.
- No application code yet imports from the new modules at runtime — rollback cannot break any active code path.

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## Relationship to the three-part architecture

- **PR#5b-2 is Track B v1 validation infrastructure.** Pure functions only. No scoring.
- **PR#5b-2 is not Track A scoring.** Zero scoring fields. Zero imports from `/Users/admin/github/ams-qa-behaviour-tests`.
- **PR#5b-2 is not Core AMS product code.** Zero imports from `/github/keigentechnologies/ams`.
- **Dependency chain:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → §3.PR#3 (CLOSED) → §3.PR#4 (CLOSED) → §3.PR#5a (closed pending Codex) → §3.PR#5b-1 (closed pending Codex) → **§3.PR#5b-2 (this)** → §3.PR#5b-3 (canonical projection + stable JSON + payload_sha256 helper) → §3.PR#5c (orchestrator + row-builder bodies) → §3.PR#7 (route binding + SQL execution) → §3.PR#8 (verification suite) → §3.PR#9 (admin debug API) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo, GTM, GA4, LinkedIn pixel, ThinSDK, production endpoint, or production database touched.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS` not set. No Playwright. No network call. No DB connection.
- **No env reads:** `process.env` is not accessed anywhere in PR#5b-2 source (verified by structural test on every module).
- **No collector / route / validator runtime change.** Legacy `/collect` continues to function unchanged.
- **No `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` schema change.**
- **No commit was created by this PR.** Working-tree changes only.

---

## Next — PR#5b-3

Canonical projection + stable JSON + payload_sha256 helper:

- **`canonical.ts`** — 19-field data-minimised projection per Decision D3 (`request_id`, `workspace_id`, `site_id`, `client_event_id`, `event_name`, `event_type`, `event_origin`, `occurred_at`, `received_at`, `schema_key`, `schema_version`, `id_format`, `traffic_class`, `session_id`, `session_seq`, `consent_state`, `consent_source`, `tracking_mode`, `storage_mechanism`). Drops raw `properties`, raw `context`, free-text fields, URL query strings (Decision D9).
- **`stable-json.ts`** — homegrown deterministic stringify (Decision D7, no new dependency). Key-sorted, predictable separators. Document possible RFC 8785 migration later.
- **`payload-sha256.ts`** — per-event hash helper. Feeds `canonicalise(event) → stableStringify → sha256Hex`.

**No route binding. No DB writes. No env-var read. No orchestrator.** Out of scope for PR#5b-2 — do not start.
