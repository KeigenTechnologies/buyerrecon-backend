# BuyerRecon Sprint 2 PR#17s — ThinSDK ↔ Sprint 2 Collector Contract-Shape Inspection

Status: **docs-only inspection report (Gate 1 — Static Contract Diff)**. No implementation. No code change. No repo config change. No migration. No `schema.sql` change. No `.env*` change. No Nginx / systemd / DB command. No production command. No `curl` / `psql` / `nginx` / `systemctl` invocation by PR#17s. No service restart. No endpointUrl re-flip. No DB mutation. No write smoke. No Track A. No Playwright. No customer-facing output. No Lane A/B writer. No AMS Trust Core exposure. No Pass 1 / Pass 2. No raw payloads. No raw tokens. No DSNs, passwords, peppers, certificate / private-key material, private IPs, host bodies, or token hashes.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `b0cd353` — "Add cutover hard gates operational standard (#23)").

PR branch: `buyerrecon-sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection`

Mandatory reference: **`docs/ops/cutover-hard-gates.md`** (merged as GitHub PR #23). PR#17s is primarily **Gate 1 — Static Contract Diff** under that standard. It also prepares requirements for **Gate 2** (controlled fixture dry-run) and **Gate 3** (runtime privilege simulation) but does not execute any production cutover work.

---

## 1. Status / verdict

**Inspection complete. Primary contract mismatch identified with high confidence.**

The Sprint 2 `/v1/event` route accepts only a **single top-level JSON object** (not an array) with `Content-Type: application/json`, with `workspace_id` and `site_id` derived from a bearer-token lookup on `site_write_tokens` (not from the body). The 26 evidence rows in `ingest_requests` carry `auth_status=ok` and `reject_reason_code=request_body_invalid_json`, which — given the collector's parser structure inspected below — means the request body either parsed to a non-object (most likely a top-level JSON array) **or** failed `JSON.parse` outright **or** sent a body whose envelope shape did not match the strict `application/json` single-object contract. The Content-Type cannot have been an outright mismatch (that would have surfaced as `content_type_invalid` → HTTP 415, not `request_body_invalid_json` → HTTP 400) — so the rejection is **inside the parsed-JSON-but-wrong-shape branch** or **inside `JSON.parse` itself**.

Sprint 2 also exposes a `/v1/batch` route, but it is **feature-flagged off by default** (`ENABLE_V1_BATCH=false`) and expects a `{ "events": [ … ] }` **object wrapper around the array**, not a raw top-level array. There is no current Nginx route for `/v1/batch` on `buyerrecon.com` (PR#17o only routed `/v1/event`).

**Recommended next implementation path: Option A (ThinSDK adapter update)** per PR#17r §8 / §9. Rationale, alternatives, and proof gates are recorded in §11 and §12 below.

PR#17s itself authorises no execution. It records what was inspected, what was found, what mismatches are plausible, and what proof gates must close before any endpointUrl re-flip.

> **Route readiness is not end-to-end readiness.**
> **EndpointUrl update is not event-capture proof.**
> **Health check is not event-contract proof.**
> **400 means request reached collector but failed contract/validation.**

---

## 2. Scope and references

### 2.1 What PR#17s is

A Gate 1 Static Contract Diff (per `docs/ops/cutover-hard-gates.md` §3) comparing:

- **A** — what the live `buyerrecon.com` ThinSDK currently emits (categorical, inferred from repo and from PR#17p / PR#17q evidence — see §5),
- **B** — what the Sprint 2 `/v1/event` route currently accepts (read directly from the merged source on the base branch — see §6),
- **C** — what `/v1/batch` would accept if enabled and routed (see §7),
- **D** — what the legacy `/collect` route accepted on Render (read from the legacy route still in the repo — see §8),
- **E** — which implementation path to recommend (see §11).

### 2.2 Mandatory references

- `docs/ops/cutover-hard-gates.md` — the operational standard. PR#17s is a Gate 1 execution.
- `docs/sprint2-pr17r-thinsdk-sprint2-collector-contract-alignment-planning.md` — the planning PR that named the options (A / B / C / D), the hypotheses (H1–H11), and the proof gates. PR#17s carries that work forward as discriminating Gate 1.
- `docs/sprint2-pr17p-buyerrecon-com-thinlayer-endpoint-proof.md` — the endpointUrl-flip proof (PR#17p §5 diff).
- `docs/sprint2-pr17o-buyerrecon-com-nginx-canary-route-proof.md` — the Nginx route proof (PR#17o §5 / §8).
- PR#17q (out-of-band operational): the minimal column-level grant fix (`SELECT (request_id)` on `ingest_requests`, `SELECT (event_id)` on `accepted_events`).

### 2.3 Scope

Docs-only. No production command was run by PR#17s. No source-tree code change. No repo-config change. No migration. No `schema.sql` / `.env*` / Nginx / systemd / DB / build change. No fetch of any production file content into chat, repo, or any artefact. No traffic generation.

---

## 3. Incident summary

The `buyerrecon.com` first-site canary sequence (PR#17l → PR#17m → PR#17n → PR#17o → PR#17p, plus out-of-band PR#17q grant fix, plus a separately-approved controlled human browser page-load post-PR#17q) established categorically:

| Layer | Status |
|---|---|
| `buyerrecon-production-collector.service` on `127.0.0.1:3073` | `active`; `/health` returns `status=ok` |
| Nginx `location = /v1/event` route on `buyerrecon.com` | proven by PR#17o, still in place |
| TLS / HTTP termination on `buyerrecon.com` | proven by PR#17o effective-config table |
| Browser → Nginx → collector path | proven by post-PR#17q POSTs reaching the collector with HTTP `400` (collector-emitted), not Nginx `502`/`504` |
| Production token auth path | proven (`auth_status=ok`, `site_write_tokens_used=1`) |
| Production DB write to `ingest_requests` | proven (`ingest_requests=26`) |
| Sprint 2 envelope validation | **failed** (`accepted_events=0`, `rejected_events=0`, `reject_reason_code=request_body_invalid_json` × 26) |

After the failure, `buyerrecon.com` ThinLayer `endpointUrl` was rolled back to the Render legacy collector. The 26 `ingest_requests` rows are preserved as categorical evidence. **Do not delete failed canary evidence rows.**

PR#17s's job is to identify the categorical contract mismatch causing the `request_body_invalid_json` outcome and recommend the next implementation path without generating any further production traffic.

---

## 4. Current rollback posture

PR#17s does not change the posture. The posture in force at the moment PR#17s is written:

- **`buyerrecon.com` ThinLayer `endpointUrl` = `https://buyerrecon-backend.onrender.com/collect`** (Render legacy collector). The site is on the legacy capture path.
- **The Sprint 2 production collector on `buyerrecon.com`** is up and idle with respect to live `buyerrecon.com` ThinLayer traffic. PR#17o's Nginx route stays as deployed.
- **PR#17q's column-level grants stand.** Table-wide `SELECT` on `ingest_requests` and `accepted_events` remains `false`. Lane A/B `SELECT` remains `false`. No `SUPERUSER` / `CREATEDB` / `CREATEROLE`. No broadening.
- **The 26 `ingest_requests` evidence rows are preserved.** They are categorical evidence of the `request_body_invalid_json` rejection pattern.
- **`br-probe-init.js` remains on Render `apiBase`.** Probe-side traffic continues to land on Render legacy as before.
- **No Track A, no Playwright, no synthetic write smoke, no Lane A/B writer, no Trust Core exposure, no Pass 1 / Pass 2.**

Rollback to Render legacy is the steady state and remains the one-step revert target throughout any downstream implementation PR (per `docs/ops/cutover-hard-gates.md` §6 PR D → PR E sequencing and PR#17r §11.7).

---

## 5. ThinSDK emitted contract shape (from inspectable surfaces)

### 5.1 Limitation up front

The live ThinSDK / ThinLayer assets on `buyerrecon.com` are **not present in this repo**. They live exclusively at `/var/www/buyerrecon.com/html/thinlayer/*` on the production host:

- `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js`
- `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
- `/var/www/buyerrecon.com/html/thinlayer/buyerrecon-adapter.iife.js` (presence not confirmed by PR#17s)
- `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js`

PR#17s did **not** authorise reading those files into chat, repo, or any artefact, and did not run any production command to fetch them. The repo contains no `public/`, `static/`, `assets/`, `client/`, or `thinlayer/` directory carrying these bundles; `find` and `grep` for `thin-sdk*`, `*.iife.js`, `br-thinlayer-init*`, `br-probe-init*` against the working tree return nothing other than backend probe routes (`dist/probe/routes.js` is the *collector's* probe route, not the client SDK).

Therefore §5.2 below is **inferred categorically** from:

1. The legacy `/collect` route shape (§8, which is what ThinSDK was originally designed for),
2. The collector's evidence rows (`auth_status=ok`, `reject_reason_code=request_body_invalid_json`, HTTP `400`, `site_write_tokens_used=1`, `ingest_requests=26`),
3. PR#17r's hypothesis enumeration (H1–H11), and
4. What the collector parser's failure surface tells us by elimination (see §10 hypothesis ranking).

**This inferred shape is the input to Gate 1 — Static Contract Diff.** Any downstream implementation PR (Gate 2 dry-run, Gate 3 runtime privilege simulation) must confirm the inferred shape against the actual ThinSDK bundle on the production host, under a controlled non-production fixture or under an explicit Helen GO to read the bundle categorically. PR#17s does not authorise that read.

### 5.2 Inferred current ThinSDK shape (categorical)

| Surface | Inferred categorical value | Inference basis |
|---|---|---|
| Transport URL (pre-rollback) | `https://buyerrecon.com/v1/event` (PR#17p flipped to this; now rolled back to `https://buyerrecon-backend.onrender.com/collect`) | PR#17p §5 diff proof |
| HTTP method | `POST` | PR#17p §7 Nginx access log shape (`POST /v1/event`) |
| Transport mechanism | Most likely `navigator.sendBeacon(url, blob)`, with possible fallback to `fetch(url, { method: 'POST', body, keepalive: true })` | Standard ThinSDK / ThinLayer pattern; not confirmed from production host source by PR#17s |
| `Content-Type` actually shipped | Plausibly `application/json` or `application/json; charset=utf-8` — because Sprint 2's `parseEnvelope` reads the body without first emitting `content_type_invalid` (that would have produced HTTP `415`, not the observed `400`). However the exact header value is **not confirmed** by PR#17s — `sendBeacon` ships the **Blob's `type` field** as `Content-Type`, and the actual Blob construction in the ThinSDK bundle is the canonical source of truth | Sprint 2 reason-code taxonomy (§6.5); collector returned `400 request_body_invalid_json`, not `415 content_type_invalid` |
| Top-level JSON type emitted | **Most likely a JSON array** `[event1, event2, …]` — the legacy `/collect` shape (see §8). A primitive (`null`, number, string) or a `{ … }` object missing required fields are also possible but less likely given that the legacy `/collect` route the SDK was originally designed against required an array | §8 legacy route shape; collector's `request_body_invalid_json` triggers (§6.7 paths 2 and 3) match an array-at-`/v1/event` rejection |
| Approximate event field names | Legacy `/collect` field set per `src/collector/validate.ts:102–218`: `event_type` (legacy taxonomy: `session_start` / `page_state` / `session_summary` / `page_view` / `cta_click` / `form_start` / `form_submit` / `generate_lead`), `event_schema_version`, `consent_signal`, `site_id`, `anon_session_id`, `anon_browser_id`, `hostname`, `client_timestamp_ms` (or `occurred_at` / `timestamp` as a number), `client_event_id` (conditionally required for new-canonical event types; not constrained to UUID), `page_view_id`, `previous_page_view_id`, `event_sequence_index`, `event_contract_version`, plus per-event-type fields (`path` for `page_view`; `cta_id` / `cta_label_bucket` / `href_category` for `cta_click`; `form_id` / `submit_outcome` for `form_*`; `lead_type` / `source_kind` / `source_page_view_id` for `generate_lead`). **None of these overlap** with the Sprint 2 canonical field set (`event_type` enum, `event_origin`, `event_name`, `schema_key`, `schema_version`, `client_event_id` UUID, `occurred_at`, `session_id`). However if the ThinSDK is on a more recent build, it may already emit Sprint 2 field names but still wrapped in a top-level array | `src/collector/routes.ts:1–73`; `src/collector/validate.ts:102–218`; `tests/validate.test.ts`; this is exactly what PR#17r H1 / H3 named |
| Schema version stamp | Likely `thin.v2.0` or similar — not confirmed from production host source by PR#17s | Standard ThinSDK / ThinLayer pattern |
| `workspace_id` in body | Inferred **absent** — the post-PR#17q rows correctly carry `workspace_id=keigen_prod_ws`, which is the **token-bound** value, suggesting the body did not need to supply it (or the body's value is being overridden by token binding regardless) | Sprint 2 token-binding (§6.6); `ingest_requests.workspace_id` carries the token-bound value |
| `site_id` in body | Inferred **absent** for the same reason — `ingest_requests.site_id = buyerrecon_com` is the token-bound value | Sprint 2 token-binding (§6.6) |
| Auth header | `Authorization: Bearer <production token>` — supplied by Nginx via PR#17o's root-only token snippet, not by ThinSDK; OR by the ThinSDK if it reads a public site-write token from `br-thinlayer-init.js`. The fact that `auth_status=ok` means the bearer-token lookup succeeded against `site_write_tokens` (Sprint 2 §6.6) | PR#17o §6 token-snippet handling; Sprint 2 auth-route source |
| Consent fields | Plausibly emitted in some envelope-level form (legacy ThinLayer included `consent` / `tracking_mode` semantics), but **not** confirmed by PR#17s — and Sprint 2 expects consent fields **per event** inside the event object (§6.4) | PR#17r §6.6 H6 |
| Batch behaviour | Likely on — ThinSDK typically buffers events client-side and flushes a batch via `sendBeacon` | Standard ThinLayer pattern; consistent with the inferred top-level array |

The single dominant inference: **ThinSDK is emitting a top-level JSON array** to `/v1/event`. Every other categorical surface (transport, content-type, field names) is plausible-but-unconfirmed and must be verified by the downstream implementation PR against the actual bundle on the production host (under controlled non-production conditions, per `docs/ops/cutover-hard-gates.md` §3.2: "If the **exact** browser body is unknown, **stop**. Inspect with a controlled non-production fixture …").

---

## 6. Sprint 2 `/v1/event` expected contract shape (from current source)

All file paths below are relative to the repo root. All findings are categorical and rely on the source merged on the base branch (`b0cd353`).

### 6.1 Route mount and body parser

- **Route:** `POST /v1/event`, mounted at `src/collector/v1/routes.ts:75` via the `createV1Router()` factory.
- **Body parser:** A **route-scoped `express.raw({ type: '*/*', limit: '1mb' })`** is mounted on the v1 router **before** the route handler (per `src/app.ts:83–98` middleware order). The raw Buffer is then parsed by `parseEnvelope()` inside the handler.
- **Global `express.json({ limit: '100kb' })`** is mounted **after** the v1 router (`src/app.ts:100`), so it does not intercept v1 traffic.
- **`strict` flag** on the raw parser: not set (defaults to false). The `type: '*/*'` matcher means **any Content-Type** (including missing or malformed) reaches `parseEnvelope` — the route deliberately captures the raw body so it can emit a categorical reason code for content-type mismatch instead of letting Express short-circuit.

### 6.2 Accepted Content-Type

- **Accepted (categorical):** `application/json` (case-insensitive), with optional charset parameter (`; charset=utf-8`, `; charset=UTF-8`, etc.). Other `+json` suffix variants (e.g. `application/vnd.api+json`) are **rejected**.
- **Rejected:** null / empty / `text/plain` / `application/x-www-form-urlencoded` / `multipart/form-data` / any non-`application/json` base media type. Rejection emits `reject_reason_code = content_type_invalid` and HTTP `415` (not `400`).
- **Implication:** Because the post-PR#17q rows show `http_status=400` and `reject_reason_code=request_body_invalid_json` (not `415` / `content_type_invalid`), the Content-Type was accepted. This eliminates the strict Content-Type-mismatch sub-case of PR#17r §6 H2 / H9 as the immediate cause. (It does **not** eliminate `sendBeacon` content-type concerns in general; see §10.)

### 6.3 Top-level body shape required

- **`/v1/event`** accepts a **single JSON object** at the top level. Arrays, `null`, and primitives (number, string, boolean) → `reject_reason_code = request_body_invalid_json`, HTTP `400`.
- **`/v1/batch`** (if enabled — see §7) accepts an **object** whose `events` field is an **array** (`{ "events": [ … ] }`). A top-level array, or an object without `events`, or `events` not being an array → `reject_reason_code = request_body_invalid_json`, HTTP `400`.

### 6.4 Event-object fields (extracted and validated per event)

The collector does **not** enforce a fixed required-key envelope at the top level. Instead, each event object is parsed through `validateEventCore()`, which extracts and validates these fields:

| Field | Required? | Type / format | Notes |
|---|---|---|---|
| `event_type` | **required** | string in `{ page, track, identify, group, system, debug }` | `event_type_invalid` if missing/empty/unknown (`src/collector/v1/validation.ts:105–124`) |
| `event_origin` | **required** | string in `{ browser, server, system }`; must agree with `event_type` matrix | `event_origin_invalid` (`src/collector/v1/validation.ts:105–124`) |
| `session_id` | **required** for `event_origin=browser`; optional for server/system but if present must be non-empty string | string | `session_id_missing` (browser) / `session_id_invalid` (non-browser non-empty path) (`src/collector/v1/validation.ts:193–209`) |
| `event_name` | **required** | non-empty string | **`event_name_invalid`** if missing or empty (`src/collector/v1/validation.ts:211–215`, `tests/v1/validation.test.ts`) |
| `schema_key` | **required** | non-empty string | **`schema_unknown`** if missing or empty (`src/collector/v1/validation.ts:217–222`, `tests/v1/validation.test.ts`) |
| `schema_version` | **required** | three-component semver string (`/^\d+\.\d+\.\d+$/`) | **`schema_version_malformed`** if missing or non-semver (`src/collector/v1/validation.ts:224–228`, `tests/v1/validation.test.ts`) |
| `client_event_id` | **required** | UUIDv4 or UUIDv7 (RFC 4122 variant, strict regex) | **`client_event_id_missing`** if absent / null / empty; **`client_event_id_invalid`** if present but not UUIDv4/UUIDv7 (`src/collector/v1/validation.ts:230–238`, `tests/v1/validation.test.ts`) |
| `occurred_at` | **required** | ISO-8601 string or epoch-ms number; window `[now − 24h, now + 5min]` | `occurred_at_missing` / `_invalid` / `_too_old` / `_too_future` (`src/collector/v1/validation.ts:240–263`) |
| `debug` | optional | boolean | `debug_only_not_allowed` if `debug=true` on a `site_write` token source (`src/collector/v1/validation.ts:265–268`) |
| `session_seq`, `consent_state`, `consent_source`, `consent_updated_at`, `tracking_mode`, `storage_mechanism` | optional (handled outside `validateEventCore` per the deferred R-11 / PII / consent stages; `src/collector/v1/validation.ts:1–23` deferred-scope comment) | string / enum / ISO / number depending on field | per-stage reject codes (`consent_*`, `pii_*`) when those stages fire |

The required set above is taken **verbatim from the deterministic check order documented at `src/collector/v1/validation.ts:163–175`** ("Step 1 → Step 8") and confirmed against `tests/v1/validation.test.ts`. **`event_name`, `schema_key`, `schema_version`, and `client_event_id` are not optional.** A missing or empty value for any of them produces a categorical per-event reject code (`event_name_invalid` / `schema_unknown` / `schema_version_malformed` / `client_event_id_missing`) — these are first-win, so an event that omits e.g. `event_name` never reaches the `schema_key`, `schema_version`, or `client_event_id` checks.

### 6.5 Reject-reason taxonomy (categorical)

The collector emits exactly one `reject_reason_code` per request (first-win ordering). Codes seen on the failure path inspected:

- **`content_type_invalid`** → HTTP `415`, ingest row only.
- **`request_body_invalid_json`** → HTTP `400`, ingest row only. **Three triggering branches**:
  1. `JSON.parse()` exception (malformed JSON in the raw Buffer).
  2. `/v1/event` body parses to a non-object top level (array, null, primitive).
  3. `/v1/batch` body parses but is not an object, or its `events` field is not an array.
- `request_too_large` → HTTP `400` / `413`, ingest row only.
- `batch_too_large`, `batch_item_count_exceeded` → ingest row only.
- Per-event reject codes (`missing_required_field`, `event_type_invalid`, `event_origin_invalid`, `occurred_at_*`, `session_id_*`, `client_event_id_*`, `schema_*`, `pii_*`, `consent_*`, `duplicate_client_event_id`, `internal_validation_error`, etc.) → these land in `rejected_events`, not `ingest_requests`.

The observed evidence (`reject_reason_code=request_body_invalid_json`, `accepted_events=0`, `rejected_events=0`, `ingest_requests=26`) means **every one of the 26 requests was rejected at the envelope-parse stage before any event-level validation could fire**. This is consistent with branch 1 (JSON.parse exception) or branch 2 (top-level array at `/v1/event`); §10 ranks them.

### 6.6 Auth contract

- **Header:** `Authorization: Bearer <token>` (case-insensitive scheme, case-sensitive token). Other schemes (Basic, Digest), or no header, → `auth_invalid`.
- **Token lookup:** Hash the token via `hashSiteWriteToken(token, pepper)`, then `SELECT token_id, workspace_id, site_id, disabled_at FROM site_write_tokens WHERE token_hash = $1 LIMIT 1` (only these four columns are read).
- **Outcomes (`auth_status`):**
  - `ok` — row found, `disabled_at IS NULL`, boundary check passes.
  - `invalid_token` — no row.
  - `site_disabled` — row found, `disabled_at IS NOT NULL`.
  - `boundary_mismatch` — workspace/site claim in body does not match token binding (deferred).
- **`workspace_id` and `site_id` source of truth:** the **token binding**, not the body. Whatever the body claims is overridden / ignored at this layer.
- **Persistence:** `ingest_requests.auth_status` carries the categorical outcome; the observed rows show `auth_status=ok` × 26, confirming the production token bound to `buyerrecon_com` validated cleanly.

### 6.7 Persistence flow

Per-request, inside a single transaction (`src/collector/v1/persistence.ts`):

1. Always insert one row into `ingest_requests` (carries `request_id`, `auth_status`, `http_status`, `reject_reason_code` if any, `workspace_id`, `site_id`, `endpoint`, `collector_version`, `request_body_sha256`, accepted/rejected counts).
2. For each event that passes validation + consent + boundary + dedup: insert into `accepted_events` (`event_id` populated, `event_contract_version` set from config).
3. For each event that fails any stage: insert into `rejected_events` with the per-event reject reason code.
4. Envelope-level rejects (bad JSON, bad content-type, size cap, batch shape) write **only** the `ingest_requests` row — no `accepted_events`, no `rejected_events`.

The observed evidence (`ingest_requests=26`, `accepted_events=0`, `rejected_events=0`) is exactly the envelope-level reject signature.

### 6.8 Schema / contract version

- Collector tags each `accepted_events` row with `event_contract_version` from `CollectorConfig` (loaded at startup; deterministic per deployment).
- Production collector version stamp visible in `ingest_requests.collector_version = buyerrecon-backend-sprint2-pr17m` (PR#17m / PR#17n deployment).

### 6.9 Test coverage observed

Tests under `tests/v1/`:

- `tests/v1/routes.test.ts` — happy-path `/v1/event` with a valid event → HTTP 200, ingest + accepted rows.
- `tests/v1/routes.test.ts` — malformed JSON (`"{not json}"`) → HTTP 400, `request_body_invalid_json`, ingest only.
- `tests/v1/routes.test.ts` — wrong Content-Type (`text/plain`) → HTTP 415, `content_type_invalid`, ingest only.
- `tests/v1/envelope.test.ts` — top-level array `[1,2,3]` to `/v1/event` → `request_body_invalid_json`. **This is the smoking-gun test for H1 from PR#17r.**
- `tests/v1/db/route-batch.dbtest.ts` — batch with mixed valid/invalid events → HTTP 200, mixed accepted/rejected.
- `tests/v1/routes.test.ts` — `/v1/batch` with `ENABLE_V1_BATCH=false` → HTTP 404, `v1_batch_disabled`, no DB writes.
- `tests/v1/routes.test.ts` — missing `Authorization` → HTTP 401, `auth_invalid`.
- `tests/v1/routes.test.ts` — disabled token → HTTP 403, `auth_site_disabled`.

The envelope-test "top-level array → `request_body_invalid_json`" case is direct categorical evidence that PR#17r H1 (array vs object) is the dominant explanation for the 26 post-PR#17q ingest rows.

---

## 7. `/v1/batch` inspection

| Surface | Finding | Evidence (file:line) |
|---|---|---|
| Route file | **Exists.** `POST /v1/batch` is registered. | `src/collector/v1/routes.ts:90–98` |
| Feature flag | **Gated by `ENABLE_V1_BATCH` env var.** Read by `loadV1ConfigFromEnv()`. Default: `false`. Only the literal string `"true"` enables; `"1"`, `"TRUE"`, undefined are all `false`. | `src/collector/v1/config.ts:60–61` |
| Mount behaviour when flag is off | Route is registered but handler returns HTTP `404` with body `{ error: 'v1_batch_disabled' }` and **does not call `runRequest`** — no DB writes. | `src/collector/v1/routes.ts:90–98` |
| Mount behaviour when flag is on | Same orchestrator path as `/v1/event`, with batch-shape envelope parsing. | `src/collector/v1/routes.ts:90–98` |
| Auth | **Same as `/v1/event`** — bearer token in `Authorization` header, identical token-lookup against `site_write_tokens`. | `src/collector/v1/auth-route.ts:46–107` |
| Body shape required | `{ "events": [event1, event2, …] }` — object wrapper around an `events` array. A top-level array is **rejected** as `request_body_invalid_json`. | `src/collector/v1/envelope.ts:97–112` |
| Size limits | Outer transport cap `1mb` (raw parser); inner contract caps `512 KB` body and `100` items per batch (`batch_too_large`, `batch_item_count_exceeded`). | `src/collector/v1/envelope.ts`, `src/collector/v1/routes.ts` |
| Persistence | Writes to `ingest_requests` (one row per POST), `accepted_events` (per-event), `rejected_events` (per-event) — same tables as `/v1/event`. | `src/collector/v1/persistence.ts` |
| Tests | `tests/v1/db/route-batch.dbtest.ts` (happy path + mixed events), `tests/v1/routes.test.ts` (flag-off and auth cases). | tests/v1/ |
| Production env var | Whether `ENABLE_V1_BATCH=true` is set in the production collector's process environment is **not** confirmed by PR#17s (would require reading the systemd unit's `Environment=` lines or the `.env` file on the production host — out of scope). The default behaviour without that env var is **disabled**. | n/a |
| Nginx route for `/v1/batch` | **Not present.** PR#17o only added `location = /v1/event`. There is no `location = /v1/batch` on `buyerrecon.com` — a new route would be required if Option B were chosen. | PR#17o §5 / §8 |

**Implication for Option B (PR#17r §8):** `/v1/batch` exists, is tested, and uses the same auth contract as `/v1/event`. However, it requires:

1. Setting `ENABLE_V1_BATCH=true` in the production collector's environment (a config change requiring its own GO).
2. Adding `location = /v1/batch` to the Nginx config on `buyerrecon.com` (a Gate-4-PR-A-equivalent route-readiness step requiring its own GO).
3. The ThinSDK still must wrap its array as `{ "events": [ … ] }` — it cannot point a raw top-level array at `/v1/batch` either. So Option B does **not** save the ThinSDK-side change; it merely moves it.

For these reasons, §11 below does not recommend Option B as the lowest-cost path.

---

## 8. Legacy `/collect` route comparison

| Surface | Legacy `/collect` (Render legacy + repo) | Sprint 2 `/v1/event` |
|---|---|---|
| Route file | `src/collector/routes.ts:1–73` (still present in the repo for Render-side parity) | `src/collector/v1/routes.ts:75` |
| Mount status in this collector | Mounted at `src/app.ts:106` after the v1 router | Mounted at `src/app.ts:83–98` before global JSON parser |
| Top-level body shape | **Top-level JSON array** `[event1, event2, …]` (no envelope wrapper) | **Single JSON object** (`/v1/event`) or `{ events: [] }` (`/v1/batch`) |
| Body parser | Relies on global `express.json({ limit: '100kb' })` mounted at `src/app.ts:100` | Route-scoped `express.raw({ type: '*/*', limit: '1mb' })` followed by `parseEnvelope` |
| Content-Type behaviour | Whatever `express.json()` defaults accept (silently parses `application/json`; silently skips non-JSON — no explicit rejection surface) | Strict: only `application/json` (with optional charset); everything else → `content_type_invalid` (HTTP `415`) |
| Auth | **None.** No `Authorization` header is required; the legacy collector is open. | Bearer token mandatory; `auth_invalid` / `auth_site_disabled` / `boundary_mismatch` outcomes |
| `workspace_id` source | Not populated (legacy schema has no `workspace_id` column on `accepted_events`) | Token binding |
| `site_id` source | Implicit / per-deployment | Token binding |
| `ingest_requests` row | **Not written** — legacy route has no per-request observability surface | Always written |
| `accepted_events.event_id` strategy | Conflict-suppressed insert on `(site_id, session_id, client_event_id)` | Conflict-suppressed insert on `(workspace_id, site_id, client_event_id)` |
| `event_contract_version` | Single constant | Per-event from client (or default from config) |
| Reject reason taxonomy | Free-form string array (legacy) | Single `ReasonCode` enum (41 distinct values; §6.5) |

### 8.1 Why the current ThinSDK "worked" on Render legacy but fails on Sprint 2

Render legacy:

- Accepts a top-level array.
- Has no auth.
- Has no envelope-shape strictness.
- Silently swallows content-type mismatches.

Sprint 2 `/v1/event`:

- Rejects arrays at the top level (`request_body_invalid_json`).
- Requires `application/json` Content-Type strictly.
- Requires a single JSON object envelope.
- Requires (different) per-event field names and value types.

The single dominant contract difference is **array-at-top-level vs single-object-at-top-level**. The auth and `workspace_id`/`site_id` differences are already absorbed by the token-binding (post-PR#17q ingest rows correctly carry `workspace_id=keigen_prod_ws`, `site_id=buyerrecon_com`, `auth_status=ok` — none of those were the failure cause).

### 8.2 Migration boundary

Render legacy remains the **rollback target** only. PR#17s does not propose migrating Render. The legacy `/collect` route's continued existence in the repo is for backwards-compatibility on Render-side parity, not for Sprint 2 production use.

---

## 9. Mismatch table

| Surface | ThinSDK current (inferred) | Sprint 2 `/v1/event` expects | Match? | Evidence source | Risk if mismatched |
|---|---|---|---|---|---|
| URL (transport target) | `/v1/event` (when flipped) | `/v1/event` | ✅ match | PR#17p §5 diff | n/a |
| HTTP method | `POST` | `POST` | ✅ match | PR#17p §7 access log | n/a |
| Content-Type | Plausibly `application/json` (or `application/json; charset=utf-8`); exact value not confirmed | `application/json` (+ optional charset) | ⚠️ plausible match; not confirmed | Collector returned `400 request_body_invalid_json`, not `415 content_type_invalid` (§6.5) | If wrong → `content_type_invalid` (HTTP `415`); not observed → not the immediate cause |
| Top-level JSON type | **Most likely JSON array** `[ … ]` (legacy `/collect` shape) | **Single JSON object** `{ … }` | ❌ **mismatch (primary cause)** | §6.3, §6.5 path 2; envelope test `[1,2,3] → request_body_invalid_json` | `request_body_invalid_json`, HTTP `400`, ingest only — **exactly what was observed** |
| Event-object field names | Legacy `/collect` field set per `src/collector/validate.ts:102–218` and `tests/validate.test.ts`: `event_type`, `event_schema_version`, `consent_signal`, `site_id`, `anon_session_id`, `anon_browser_id`, `hostname`, `client_timestamp_ms` (or `occurred_at` / `timestamp` as a number), `client_event_id`, `page_view_id`, `previous_page_view_id`, `event_sequence_index`, `event_contract_version`, plus per-event-type fields (`path` for `page_view`; `cta_id` / `cta_label_bucket` / `href_category` / `click_offset_ms` for `cta_click`; `form_id` / `submit_outcome` for `form_*`; `lead_type` / `source_kind` / `source_page_view_id` for `generate_lead`); legacy event-type taxonomy `{ session_start, page_state, session_summary, page_view, cta_click, form_start, form_submit, generate_lead }`. ThinSDK may emit some subset of these inside the top-level array. | Sprint 2 canonical (`src/collector/v1/validation.ts:163–175`): **all required** — `event_type` (page \| track \| identify \| group \| system \| debug), `event_origin` (browser \| server \| system), `event_name`, `schema_key`, `schema_version` (semver), `client_event_id` (UUIDv4 or UUIDv7), `occurred_at` (ISO-8601 or epoch-ms); plus required `session_id` for browser-origin events. The Sprint 2 event-type taxonomy and field names **do not overlap** with the legacy set (above). | ❌ **mismatch (secondary, will surface only after H1 is fixed)** | §6.4; cannot observe per-event behaviour until the array is unwrapped to a single object | If wrong → first-win per-event reject in `rejected_events`: `event_type_invalid` / `event_origin_invalid` / `session_id_missing` / `event_name_invalid` / `schema_unknown` / `schema_version_malformed` / `client_event_id_missing` / `client_event_id_invalid` / `occurred_at_*`. **A ThinSDK adapter that fixes only array-vs-object but keeps legacy field names will move the failure from envelope-level `ingest_requests` rejection (`request_body_invalid_json`) to per-event `rejected_events` rejection.** |
| `site_id` source | Not in body (token-bound) | **Not in body** — token-bound (§6.6) | ✅ match (by design — token overrides body) | `ingest_requests.site_id = buyerrecon_com` confirmed | n/a |
| `workspace_id` source | Not in body (token-bound) | **Not in body** — token-bound (§6.6) | ✅ match | `ingest_requests.workspace_id = keigen_prod_ws` confirmed | n/a |
| Auth header | `Authorization: Bearer <production token>` (supplied either by ThinSDK or by Nginx token snippet) | `Authorization: Bearer <token>` (§6.6) | ✅ match | `auth_status = ok`, `site_write_tokens_used = 1` confirmed | n/a |
| Single vs batch endpoint | Likely batched (array via `sendBeacon`) | `/v1/event` is single-event; `/v1/batch` exists but feature-flagged off and expects `{ events: [] }` wrapper, not raw array (§7) | ❌ mismatch — array transport vs single-event endpoint | §7 batch findings; §8 legacy shape | `request_body_invalid_json` (observed) |
| Consent fields (per event) | Legacy `/collect` carries `consent_signal` as a per-event field (must equal `'granted'`, otherwise rejected with `CONSENT_NOT_GRANTED`; `src/collector/validate.ts:131–133`) | Sprint 2 expects per-event consent fields (`consent_state`, `consent_source`, `consent_updated_at`) handled outside `validateEventCore` (deferred per `src/collector/v1/validation.ts:1–23`). Sprint 2 does **not** read a `consent_signal` field; the legacy boolean-style "granted/denied" semantics are not Sprint 2's contract. | ❌ **mismatch** | §6.4; `src/collector/validate.ts:131–133` | If wrong → `consent_required_but_missing` / `consent_denied` — per-event rejection at the consent stage, not the observed envelope-level failure |
| Session ID field | Legacy `/collect` requires `anon_session_id` as a non-empty string (`src/collector/validate.ts:141–146`); the legacy path also accepts `session_id` references in PII-redaction contexts (`src/collector/validate.ts:21–28` `STRUCTURAL_ID_KEYS`), but the canonical field name on the legacy contract is `anon_session_id`. | Sprint 2 requires `session_id` (different field name) as a non-empty string for browser-origin events (`src/collector/v1/validation.ts:193–209`). | ❌ **mismatch** (legacy `anon_session_id` vs Sprint 2 `session_id`) | §6.4; `src/collector/validate.ts:141–146` | If field name is wrong / absent for a browser-origin event → `session_id_missing` per-event reject |
| Browser ID / client_event_id | Legacy `/collect` carries `anon_browser_id` (required string), `anon_session_id` (required string), and a conditionally-required `client_event_id` (only required for new canonical event types — see `src/collector/validate.ts:178–192`). Format is **not constrained to UUID** on the legacy path. | Sprint 2 `/v1/event` requires `client_event_id` **on every event**, strict UUIDv4 or UUIDv7 (§6.4; `src/collector/v1/validation.ts:230–238`). `anon_browser_id` and `anon_session_id` are **not** Sprint 2 field names; Sprint 2 uses `session_id` and does not have a `browser_id` envelope field. | ❌ **mismatch** | §6.4 | If `client_event_id` is missing → `client_event_id_missing`; if present but not UUIDv4/v7 → `client_event_id_invalid`. Legacy `anon_browser_id` and `anon_session_id` would simply be ignored by Sprint 2's validator (they fail the matrix at the `session_id` requirement for browser-origin events). |
| Timestamp field name and type | Legacy `/collect` accepts any of `client_timestamp_ms` / `occurred_at` / `timestamp` **as a numeric epoch-ms integer** (`src/collector/validate.ts:155–168`). Stale window is 90 days; future window is 5 minutes. | Sprint 2 expects `occurred_at` as **either** ISO-8601 string **or** epoch-ms number, window `[now − 24h, now + 5min]` (`src/collector/v1/validation.ts:240–263`). | ❌ **mismatch** (legacy three-field-name fallback + 90-day stale window vs Sprint 2 single field + 24-hour stale window) | §6.4; `src/collector/validate.ts:155–168` | If field absent or non-numeric/non-ISO → `occurred_at_missing` / `occurred_at_invalid` per-event reject; if epoch is more than 24h old → `occurred_at_too_old` (legacy-90d-old events would reject under Sprint 2) |
| Event type field name | Legacy `/collect` reads `event_type` (field name matches Sprint 2's) but the legacy **enum** is `session_start` / `page_state` / `session_summary` / `page_view` / `cta_click` / `form_start` / `form_submit` / `generate_lead` (`src/collector/validate.ts:121–125`; `VALID_EVENT_TYPES` constant). | Sprint 2 expects `event_type` ∈ `{ page, track, identify, group, system, debug }` (`src/collector/v1/validation.ts:45–52`). | ❌ **mismatch** (field name matches; enum values do not overlap) | §6.4; `src/collector/v1/validation.ts:45–52` | If legacy value (e.g. `page_view`) is sent → `event_type_invalid` per-event reject |
| Event origin field name | Legacy `/collect` has **no `event_origin` field** — origin is implicit from the legacy `event_type` taxonomy (`src/collector/validate.ts` lists no `event_origin` read). | Sprint 2 requires `event_origin` ∈ `{ browser, server, system }` (`src/collector/v1/validation.ts:39–43`). | ❌ **mismatch** | §6.4 | If missing → `event_origin_invalid` per-event reject (first-win) |
| Accepted-event contract version | Stamped by collector, not by client | Stamped by collector from `CollectorConfig.event_contract_version` (§6.8) | ✅ match (collector-controlled) | §6.8 | n/a |
| Error outcome if mismatched | n/a (this column documents the outcome shape) | `ingest_requests` row written; `accepted_events` / `rejected_events` written conditionally on which stage rejected (§6.7) | n/a | §6.7 | Observed: `ingest_requests=26`, `accepted_events=0`, `rejected_events=0`, `reject_reason_code=request_body_invalid_json` — **envelope-stage reject** |

The "❌ mismatch (primary cause)" row (top-level JSON type) is the categorical mismatch that explains the 26 envelope-stage rejections (`request_body_invalid_json` × 26 against `ingest_requests` with no `accepted_events` / `rejected_events`). The "❌ mismatch (secondary…)" rows — event-object field names, consent field names, browser/session/client_event_id field names, timestamp shape, event-type enum, event-origin field — are categorical mismatches grounded in `src/collector/v1/validation.ts` + `src/collector/validate.ts` + `tests/validate.test.ts` that would surface **only after** the envelope mismatch is fixed (i.e. they are the "second wave" of issues that will appear once ThinSDK emits a single object and gets past `request_body_invalid_json`). All `❓ unknown` markers from the prior draft have been replaced with categorical ❌ mismatches now that source-accurate field names from both sides have been confirmed. **A ThinSDK adapter that fixes only array-vs-object but keeps legacy field names will not unblock the canary** — it will move the failure from envelope-level `ingest_requests` rejection (`request_body_invalid_json`) to per-event `rejected_events` rejection. Option A must reconcile both layers simultaneously.

---

## 10. Hypothesis ranking

Each hypothesis is mapped to PR#17r §6 (H1–H11), then scored on **likelihood** (based on collector source and 26-row evidence), **evidence** (categorical signal from §6), **how to prove without production traffic** (Gate 1 / Gate 2 path), and **fix path** (which §8 / §11 option).

### 10.1 Primary cause (highest confidence)

**H1 — ThinSDK emits a top-level JSON array; Sprint 2 `/v1/event` expects a single JSON object.**

- **Likelihood:** **HIGH (dominant)**.
- **Evidence:**
  - The collector's `parseEnvelope` returns `request_body_invalid_json` exactly when the body parses to a non-object at `/v1/event` (§6.5 branch 2).
  - The envelope test `tests/v1/envelope.test.ts` proves a top-level array `[1,2,3]` triggers `request_body_invalid_json` — **exact match for the observed reason code**.
  - The legacy `/collect` route (§8) accepts a top-level array, and ThinSDK was originally designed for that route. The most likely explanation for the observed failure is that ThinSDK is still emitting the legacy array shape.
  - The 26 ingest rows are uniform (`reject_reason_code=request_body_invalid_json` × 26, `auth_status=ok` × 26) — consistent with a single dominant cause, not a mixed failure pattern.
- **How to prove without production traffic:** Read the ThinSDK bundle on the production host under a controlled non-production fixture (Gate 1 source-shape inspection). Run a `JSON.parse` on the categorical body shape (no raw payload) and observe whether it is an array. **No production traffic needed.**
- **Fix path:** **Option A** — update `thin-sdk.iife.js` / `br-thinlayer-init.js` to emit a single object envelope. (Option B is plausible only if ThinSDK is also updated to wrap as `{ events: [ … ] }` — same cost on the client side; see §7 for the additional Nginx + env-flag work.)

### 10.2 Plausible secondary cause (if H1 disproven)

**H2 — `JSON.parse()` exception (malformed JSON in the raw Buffer).**

- **Likelihood:** **LOW–MEDIUM**. The post-PR#17q ingest rows all reached the parser (auth passed, content-type passed, body wrote to `ingest_requests`), but `parseEnvelope` distinguishes "JSON.parse threw" from "JSON parsed but wrong shape" and emits the **same** reject reason for both branches (§6.5 branches 1 and 2). The two are not separable from the reject-reason alone.
- **Evidence:** Categorical only — the reject reason `request_body_invalid_json` covers both. H2 would require the body to be malformed JSON (truncated, embedded control characters, BOM with strict-mode parser, etc.).
- **How to prove without production traffic:** Capture the categorical structure of one ThinSDK emission against a local non-production fixture (no production data); pipe through `JSON.parse` and observe whether it throws. If it throws → H2. If it succeeds → H1 or further.
- **Fix path:** Option A (ThinSDK update) or Option C (server-side adapter that handles known legacy malformations).

### 10.3 Other plausible causes (likely eliminated by evidence, kept for completeness)

| ID | Hypothesis | Likelihood | Why ranked here | Proof method (no production traffic) | Fix path |
|---|---|---|---|---|---|
| **H3** | Beacon Blob with non-JSON `Content-Type` (`text/plain`, `application/x-www-form-urlencoded`) | **LOW (likely eliminated)** | Would have surfaced as `content_type_invalid` / HTTP `415`, not the observed `request_body_invalid_json` / `400`. The parser explicitly rejects non-`application/json` Content-Types **before** `JSON.parse` runs (§6.2). | Inspect Blob construction in `thin-sdk.iife.js` against a fixture; observe `blob.type`. | If found → Option A (set `type: 'application/json'`). |
| **H4** | Body-parser content-type strictness (charset mismatch) | **LOW (likely eliminated)** | `parseEnvelope` accepts optional charset parameters (`; charset=utf-8`); only a non-`application/json` base media type triggers rejection (§6.2). | Inspect the exact `Content-Type` header value sent by ThinSDK against a non-production fixture. | Option A if needed. |
| **H5** | Double-encoded JSON (`JSON.stringify(JSON.stringify(event))`) | **LOW** | Would parse to a JSON **string** at the top level, which Sprint 2 `/v1/event` would reject as `request_body_invalid_json` (non-object). Possible but unusual ThinSDK bug. | Categorical body-shape inspection via a local fixture; observe top-level type. | Option A. |
| **H6** | Empty / undefined body on a fallback transport path | **LOW–MEDIUM** | If `sendBeacon` returns `false` and the fallback `fetch` ships an empty body, `JSON.parse("")` throws → `request_body_invalid_json`. The 26 uniform rows suggest this is not the dominant path (which would mix outcomes), but cannot be fully eliminated. | Inspect ThinSDK fallback logic against a non-production fixture; trigger the fallback deliberately. | Option A. |
| **H7** | Malformed / partial body (network truncation) | **VERY LOW** | Would not produce 26 uniformly-shaped rejects. Network truncation is non-deterministic; the evidence is too consistent. | n/a — eliminated by uniformity. | n/a |
| **H8** | Legacy envelope wrapping (top-level object but with legacy `/collect` field names — `event_type` legacy enum, `event_schema_version`, `consent_signal`, `site_id`, `anon_session_id`, `anon_browser_id`, `client_timestamp_ms`, `client_event_id` non-UUID, `page_view_id`, etc. per `src/collector/validate.ts:102–218`) | **MEDIUM (secondary mismatch)** | If ThinSDK emits a single object but with legacy field names, the envelope parses successfully but per-event `validateEventCore` (`src/collector/v1/validation.ts:176–282`) fails on the first-win check — and per-event failures land in `rejected_events`, **not** `ingest_requests` with `request_body_invalid_json`. Therefore H8 is **not** the cause of the 26-row pattern, but it is the **next wave** of mismatches that will surface once H1 is fixed (see §9 ❌ rows). | Compare ThinSDK field names to Sprint 2 §6.4 field names via fixture. | Option A. |
| **H9** | Wrong endpoint chosen (`/v1/event` when ThinSDK should hit `/v1/batch`) | **LOW–MEDIUM** | If ThinSDK emits an array, `/v1/batch` would accept it only if wrapped as `{ events: [ … ] }` (§7). So H9 collapses into H1 + a downstream Nginx/env-flag GO. | §7 batch-route inspection completed. | **Option B** (only if the additional GOs are accepted). |
| **H10** | Charset / body-parser edge case (UTF-16 BOM, gzip-without-Content-Encoding, etc.) | **VERY LOW** | Parser is permissive on charset suffix; gzip body without `Content-Encoding` would land in `parseEnvelope` as a Buffer whose `JSON.parse` throws → reduces to H2. | Inspect `Content-Encoding` and BOM behaviour against a fixture. | Option A. |
| **H11** | Consent-gated shell envelope (ThinSDK emits `{ consent: …, payload: … }` shell that Sprint 2 does not unwrap) | **LOW** | The envelope would still parse to an object; Sprint 2 would attempt per-event validation on the wrong field set → per-event reject, not envelope reject. Not the observed pattern. | Inspect ThinSDK envelope structure against a fixture. | Option A or Option C. |

### 10.4 Ranking summary

| Rank | Hypothesis | Confidence | Evidence weight |
|---|---|---|---|
| 1 | H1 (array vs object) | HIGH | Direct envelope-test match; uniform 26-row pattern; legacy `/collect` shape |
| 2 | H2 (JSON.parse exception) | LOW–MEDIUM | Same reject code as H1; not separable from reason alone |
| 3 | H6 (empty body on fallback) | LOW–MEDIUM | Would produce mixed pattern, not uniform 26 |
| 4 | H8 (legacy envelope field names) | secondary mismatch — will surface **after** H1 is fixed | per-event reject taxonomy, not envelope |
| 5 | H9 (use `/v1/batch`) | LOW–MEDIUM | requires same client-side change + additional Nginx + env-flag GOs |
| 6–11 | H3, H4, H5, H7, H10, H11 | LOW–VERY LOW | mostly eliminated by reject-code mapping |

**Conclusion:** Source-surface inspection in §6 + the envelope test directly equating "top-level array → `request_body_invalid_json`" make H1 the dominant cause. Confirming H1 (and ruling out H2 + H6) requires only a **Gate 1 categorical inspection of the ThinSDK bundle against a controlled non-production fixture** — no production traffic, no endpointUrl re-flip, no DB action. That is the next PR's scope.

---

## 11. Recommended next implementation path

### 11.1 Recommendation

**Option A — Update ThinSDK / adapter output to the Sprint 2 `/v1/event` shape.**

Specifically: modify `thin-sdk.iife.js` (and any `br-thinlayer-init.js` / `buyerrecon-adapter.iife.js` collaborators) so that the browser transport emits a **single JSON object per POST** matching the Sprint 2 envelope shape established in §6.4 (`event_type`, `event_origin`, `occurred_at`, `session_id`, etc.), with `Content-Type: application/json`, via `navigator.sendBeacon` with a `Blob` whose `type` is `'application/json'` (and a `fetch` fallback that explicitly sets the header).

### 11.2 Rationale

- **Strict server contract preserved.** Sprint 2 does not bend its envelope schema to legacy clients; one canonical shape across all five ThinLayer sites.
- **One-time frontend cost.** Once `thin-sdk.iife.js` is updated, every future site cutover converges on the same canonical shape. Multi-site rollout becomes a coordinated bundle update, not a per-site server adapter.
- **No new server-side route.** Option B requires both a ThinSDK client update **and** an `ENABLE_V1_BATCH=true` env change **and** a new `location = /v1/batch` Nginx route (per §7). Option A is strictly cheaper on the server side.
- **No risk of permanent compatibility shim.** Option C (server-side adapter) carries the long-term risk of becoming a load-bearing fallback that ages into the codebase. Option A retires the legacy shape at the source.
- **Eliminates the secondary mismatches early.** §9 "❌ mismatch (secondary…)" rows — legacy event-type enum (`page_view` / `cta_click` / `form_*` / `generate_lead` vs Sprint 2 `{page, track, identify, group, system, debug}`), legacy timestamp field names (`client_timestamp_ms` / `timestamp` vs Sprint 2's single `occurred_at`), legacy session/browser fields (`anon_session_id` / `anon_browser_id` vs Sprint 2 `session_id`), legacy `client_event_id` non-UUID format vs Sprint 2 strict UUIDv4 / UUIDv7, legacy `consent_signal` vs Sprint 2 `consent_state` / `consent_source` / `consent_updated_at`, missing-from-legacy `event_origin` / `event_name` / `schema_key` / `schema_version` — will all surface in `rejected_events` after H1 is fixed. **A ThinSDK adapter that fixes only array-vs-object will not unblock the canary** (the failure surface only moves from envelope to per-event); Option A's bundle update is the only natural moment to address all of them simultaneously. Reference: `src/collector/v1/validation.ts:163–175` (Sprint 2 required check order) and `src/collector/validate.ts:102–218` + `tests/validate.test.ts` (legacy field shape).

### 11.3 Why not Option B (`/v1/batch`)

- The route exists, has tests, and uses the same auth contract. But it is feature-flagged off by default and is **not currently routed by Nginx on `buyerrecon.com`** (PR#17o only routed `/v1/event`).
- Pointing ThinSDK at `/v1/batch` still requires the client to wrap the array as `{ "events": [ … ] }` (raw arrays are also rejected by `/v1/batch`). So Option B does not avoid the client-side bundle update.
- Option B therefore costs Option A's work **plus** (a) an env-flag change requiring its own GO, (b) a new Nginx route requiring its own GO, and (c) a new Gate-4-PR-A route-readiness proof for `/v1/batch` on `buyerrecon.com`.
- Option B remains **available** if Helen's review prefers preserving ThinSDK's batch transport semantics; PR#17s does not eliminate it.

### 11.4 Why not Option C (server-side adapter)

- A `POST /v1/event-legacy` (or content-type-conditional branch inside `/v1/event`) that accepts the legacy shape and maps it to the canonical envelope would unblock the canary without per-site bundle updates.
- However, every Sprint 2 boundary that PR#17r §10 / `docs/ops/cutover-hard-gates.md` §3.3 names (no legacy-leniency drift, no permanent fallback, strict envelope schema) becomes weaker the longer the adapter lives.
- Option C requires its own retirement plan from day one, plus its own minimal-grant audit (any new SQL it runs), plus the same `client_event_id`-format reconciliation Option A does. Net work: higher than Option A unless the bundle-update friction is prohibitive.
- Option C remains **available** if §11.7 surfaces a frontend-rebuild blocker.

### 11.5 Why not Option D (stay on Render legacy)

- Option D is the current rollback posture (§4) and remains the steady state until Option A / B / C is proven.
- Option D does **not** itself unblock the Sprint 2 production canary; it is the safe pause state, not a solution.

### 11.6 Suggested next-PR sequencing under `docs/ops/cutover-hard-gates.md`

1. **PR#17t (proposed)** — Gate 1 confirmation: read the ThinSDK bundle categorically against a controlled non-production fixture (e.g. a local page or staging host loading the same bundle against a sandbox collector). Produce a docs-only artefact that confirms H1 (or surfaces another cause), without ever pointing live `buyerrecon.com` traffic at Sprint 2.
2. **PR#17u (proposed)** — Option A implementation: update `thin-sdk.iife.js` / `br-thinlayer-init.js` to emit the Sprint 2 shape. Includes unit tests against a mocked `navigator.sendBeacon` asserting body shape, content-type, and headers byte-for-byte against a canonical fixture (per PR#17r §11.1 / `cutover-hard-gates.md` §6.1 PR-A-equivalent for client). **No production deployment by this PR.**
3. **PR#17v (proposed)** — Gate 2 controlled fixture dry-run: run the updated bundle against a staging Sprint 2 collector instance with a non-customer fixture payload. Capture categorical evidence (`http_status=200`, `accepted_events` delta, `rejected_events` reject reasons). **No production traffic.**
4. **PR#17w (proposed)** — Gate 3 runtime privilege simulation: exercise the same code path against a disposable / staging DB role whose grants exactly mirror `buyerrecon_prod_collector_app`'s PR#17q steady-state matrix. Confirm no `storage_failure`, no `permission denied`, no grant broadening (per PR#17r §11.4 / `cutover-hard-gates.md` §5).
5. **PR#17x (proposed)** — Gate 4 PR B execution: under explicit Helen GO, deploy the updated bundle to the production host, leaving `endpointUrl` unchanged. Confirms the bundle is served correctly and `br-thinlayer-init.js` literal still resolves to Render legacy.
6. **PR#17y (proposed)** — Gate 4 PR C execution: under a separate explicit Helen GO, re-flip `endpointUrl` to the Sprint 2 path and observe one controlled human page-load. Expected: HTTP `200`, `accepted_events` increment, no `request_body_invalid_json`.
7. **PR#17z (proposed)** — Gate 4 PR D execution: passive organic observation; record `NO_EVENT_YET` if no organic event occurs (per cutover hard-gates §6.4).

**NO_EVENT_YET is not failure if no event was expected or observed.**

PR#17s does **not** authorise any of the above. It records the sequence so Helen can size the work and choose which steps to fold into a single PR (if any) vs which to keep separate.

---

## 12. Required proof gates before re-flip

Before any future endpointUrl re-flip on `buyerrecon.com`, the downstream implementation PR(s) must close every gate in this list. Each gate is named directly in `docs/ops/cutover-hard-gates.md`; cross-references are explicit.

1. **Gate 1 — Static Contract Diff** (`cutover-hard-gates.md` §3). PR#17s is the current execution. A follow-up confirmation against the actual ThinSDK bundle (the PR#17t step above) closes Gate 1 categorically.
2. **Gate 2 — Production-role dry-run without live traffic** (`cutover-hard-gates.md` §4). Run the updated bundle against a staging or local Sprint 2 collector with a controlled non-customer fixture. Capture categorical HTTP status, ingest delta, accepted/rejected delta. **No production traffic.** **Do not delete failed canary evidence rows** from any earlier proof window.
3. **Gate 3 — Runtime privilege simulation** (`cutover-hard-gates.md` §5; PR#17r §11.4). Exercise the actual SQL path under either the real production least-privilege runtime role (separate GO required) or a disposable / staging DB role mirroring `buyerrecon_prod_collector_app`'s PR#17q steady-state grant matrix. Confirm no `storage_failure`, no `permission denied`, no missing privileges for `WHERE` / `RETURNING` / `ON CONFLICT` / column-level `SELECT`, no table-wide `SELECT`, no Lane A/B grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`. **Do not broaden grants to make a proof pass.**
4. **Gate 4 — Separate route readiness from traffic cutover** (`cutover-hard-gates.md` §6). Stage execution: PR A (route readiness — already proven by PR#17o) → PR B (bundle deploy, no endpointUrl change) → PR C (endpointUrl re-flip + controlled event proof) → PR D (passive organic observation) → PR E (Track A, only after PR D closes cleanly).
5. **Explicit Helen GO before any endpointUrl re-flip.** No prior PR (PR#17l → PR#17q → PR#17r → PR#17s → any of the proposed PR#17t–PR#17z) pre-authorises a re-flip. Each step requires its own GO scoped to the specific work.
6. **Rollback to Render legacy retained throughout.** Restoring `endpointUrl` to `https://buyerrecon-backend.onrender.com/collect` remains the one-step revert at every gate from §2 (Gate 2 fixture) onward.

---

## 13. Non-goals / boundaries

PR#17s explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **endpointUrl re-flip** on `buyerrecon.com` (or any other site).
- **Nginx change** (no new `location`, no route deletion, no snippet edit, no `nginx -t`, no `systemctl reload`).
- **DNS change** (no zone edit, no CNAME flip).
- **DB grants** (no `GRANT` / `REVOKE`; no broadening of `buyerrecon_prod_collector_app`; no Lane A/B / derived-table / DDL / `SUPERUSER` / `CREATEDB` / `CREATEROLE`).
- **Production command execution** (no `nginx`, `systemctl`, `psql`, `curl` against production, `node` against production, or any shell action on the production host).
- **Raw payload read / copy.** No raw request body, no raw ThinSDK bundle content, no raw token snippet, no raw secret material is copied to chat, repo, PR comment, CI log, or any captured artefact by PR#17s.
- **Evidence-row deletion.** The 26 `ingest_requests` evidence rows from the post-PR#17q controlled page-load are preserved and must not be deleted.
- **Write smoke** (no `POST /v1/event`, no `POST /v1/batch`, no synthetic event generator).
- **Track A.**
- **Playwright.**
- **Customer-facing output** (no Pass 1 / Trust / Pass 2 artefact; no customer-readable report).
- **Lane A/B writer** (`scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-row).
- **AMS Trust Core exposure** through BuyerRecon.
- **Pass 1 / Pass 2 implementation.**
- **Render migration.** Render legacy collector remains the rollback target and is not migrated by PR#17s or any downstream PR.

---

## 14. Open decisions for Helen

PR#17s records the following decision surface explicitly. None of these are pre-decided.

1. **Confirm Option A as the implementation track.** Or override to Option B (with the additional Nginx + env-flag GOs), Option C (with the retirement plan), or Option D (extended rollback posture).
2. **Should PR#17t (Gate 1 categorical bundle inspection) be a separate PR, or folded into the implementation PR?** Separate PR preserves the audit trail of "what ThinSDK actually emits" as a docs-only artefact; folded PR is faster but couples discovery and execution.
3. **Where does the ThinSDK source live?** `thin-sdk.iife.js` is a compiled IIFE — is it built from a maintained source tree (and if so, where), or is it hand-edited on the production host? This decision shapes whether Option A is a build-pipeline change or a host-edit.
4. **Five-site coordination.** Once the bundle is updated, the same bundle (or coordinated bundles) needs to land on `buyerrecon.com`, `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk` — but only `buyerrecon.com` has a Sprint 2 collector route in production today. Is the bundle rollout coupled to the per-site Nginx + endpointUrl cutover, or is the bundle pushed everywhere first and the endpoint flipped per site?
5. **Are the PR#17q column-level grants the steady state for the runtime role?** Reaffirm yes — `request_id` / `event_id` `SELECT` grants are runtime-only for the collector write path; proof-observer queries continue to use the read-only operator path (per PR#17r §7.5 / §13 Q6 and `cutover-hard-gates.md` §5).
6. **Schema field reconciliation.** The §9 ❓ rows (legacy field names, timestamp formats, `client_event_id` UUID requirement, `event_origin` enum, `session_id` requirement for browser events) need a single coordinated reconciliation. Should that reconciliation be part of the same Option-A bundle update, or split into a follow-up PR?
7. **`/v1/batch` enablement.** Keep it disabled (current default) unless / until a deliberate decision to support batched ingestion is made. PR#17s does not recommend enabling it for buyerrecon.com under Option A.

---

## 15. Appendix: inspected files and limitations

### 15.1 Repo files inspected (categorically)

All file paths relative to `/Users/admin/github/buyerrecon-backend`:

- `docs/ops/cutover-hard-gates.md` — operational standard (mandatory reference).
- `docs/sprint2-pr17r-thinsdk-sprint2-collector-contract-alignment-planning.md` — PR#17r planning.
- `docs/sprint2-pr17p-buyerrecon-com-thinlayer-endpoint-proof.md` — PR#17p endpointUrl-flip proof.
- `docs/sprint2-pr17o-buyerrecon-com-nginx-canary-route-proof.md` — PR#17o Nginx route proof.
- `src/app.ts` — application entry, middleware order, v1 router mount.
- `src/server.ts` — server bootstrap (not separately inspected; entry through `app.ts`).
- `src/collector/v1/routes.ts` — `/v1/event` and `/v1/batch` route definitions.
- `src/collector/v1/orchestrator.ts` — end-to-end event-handling orchestration.
- `src/collector/v1/validation.ts` — envelope and event-core validation rules.
- `src/collector/v1/envelope.ts` — envelope parser, content-type rules, top-level shape rules.
- `src/collector/v1/types.ts` — type declarations for envelope, validation errors, reject-reason taxonomy.
- `src/collector/v1/persistence.ts` — `ingest_requests` / `accepted_events` / `rejected_events` write paths.
- `src/collector/v1/auth-route.ts` — bearer-token extraction and `site_write_tokens` lookup.
- `src/collector/v1/config.ts` — `loadV1ConfigFromEnv()`, `ENABLE_V1_BATCH` flag, `event_contract_version` plumbing.
- `src/collector/v1/reason-codes.ts` — full reject-reason taxonomy.
- `src/collector/v1/canonical.ts` — canonical event-row builder.
- `src/collector/routes.ts` — legacy `/collect` route.
- `tests/v1/routes.test.ts` — `/v1/event` and `/v1/batch` happy-path and reject-path tests.
- `tests/v1/envelope.test.ts` — envelope-shape tests (including the array-at-`/v1/event` smoking-gun test).
- `tests/v1/db/route-batch.dbtest.ts` — batch DB-write tests under `ENABLE_V1_BATCH=true`.

### 15.2 Production-host files NOT inspected

The following are referenced for completeness but were **not** read by PR#17s (production-host files; reading them was out of PR#17s's GO scope):

- `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js`
- `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
- `/var/www/buyerrecon.com/html/thinlayer/buyerrecon-adapter.iife.js` (presence not confirmed)
- `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js`
- The production collector's process environment (e.g. whether `ENABLE_V1_BATCH=true` is set).
- The production host's Nginx `sites-enabled/buyerrecon.com` config (beyond what PR#17o §5 / §8 records categorically).
- The production DB's privilege matrix beyond what PR#17q §3.2 records categorically.

### 15.3 Limitations

- **§5 ThinSDK shape is inferred, not observed.** The dominant inference (top-level JSON array) is grounded in (a) the legacy `/collect` shape the bundle was originally designed for, (b) the collector's envelope-test which directly equates that shape to the observed reason code, and (c) the uniform 26-row reject pattern. Confirming the inference requires reading the bundle categorically against a controlled non-production fixture under a separate GO (PR#17t in §11.6).
- **§9 ❓ rows are unknowns until §5 is confirmed.** The "second wave" of mismatches (field names, timestamp formats, UUID requirement, etc.) cannot be ranked or fixed until the envelope-level mismatch is resolved.
- **No SQL was run** against any production DB by PR#17s. All evidence values (`ingest_requests=26`, `accepted_events=0`, `rejected_events=0`, `site_write_tokens_used=1`, `auth_status=ok`, `reject_reason_code=request_body_invalid_json`, `workspace_id=keigen_prod_ws`, `site_id=buyerrecon_com`, `collector_version=buyerrecon-backend-sprint2-pr17m`) are taken from PR#17r §4 / PR#17p §3 / PR#17q evidence as categorical inputs to PR#17s, not as PR#17s's own observations.

### 15.4 Closing posture

- **PR#17s is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection, no production command.
- **No raw payloads, raw tokens, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or vault contents** appear anywhere in this doc.
- **Production posture after PR#17s:** unchanged from §4. `buyerrecon-production-collector.service` `active` on `PORT=3073`; `nginx.service` `active` with the PR#17o `location = /v1/event` route; `buyerrecon.com` ThinLayer `endpointUrl` on Render legacy; `br-probe-init.js` on Render `apiBase`; production event tables at `ingest_requests=26` / `accepted_events=0` / `rejected_events=0` / `site_write_tokens_used=1` (evidence preserved); Lane A/B at `0` rows; PR#17g grant safety intact; PR#17q column-level grants intact; staging service untouched; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.

End of PR#17s. **Gate 1 — Static Contract Diff complete. Recommendation: Option A. Awaiting Helen's decision before any downstream implementation PR.**
