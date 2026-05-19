# BuyerRecon Sprint 2 PR#17r — ThinSDK ↔ Sprint 2 Collector Payload Contract Alignment Planning

Status: **planning / docs-only**. No implementation. No code change. No repo config change. No migration. No `schema.sql` change. No `.env*` change. No Nginx / systemd / DB command. No production command. No Track A. No Playwright. No write smoke. No customer-facing output. No Lane A/B writer. No AMS Trust Core exposure. No Pass 1 / Pass 2. No raw payloads, raw tokens, DSNs, passwords, peppers, private keys, or token hashes.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `1aed585` — PR#17p / GitHub PR #21 merged, "record buyerrecon.com ThinLayer endpoint proof").

PR branch: `buyerrecon-sprint2-pr17r-thinsdk-sprint2-collector-contract-alignment-planning`

---

## 1. Status / verdict

**Planning only. No execution. No code. No production action.**

The `buyerrecon.com` first-site canary sequence (PR#17l → PR#17m → PR#17n → PR#17o → PR#17p, plus the out-of-band PR#17q DB grants fix and a controlled post-PR#17q human browser page-load) reached a categorical waypoint: the Sprint 2 production collector now receives `POST /v1/event` requests from the live ThinLayer in the browser, the production token authenticates, the Nginx route is correct, and the production DB write to `ingest_requests` works. The remaining failure is **payload shape**, recorded by the collector as `reject_reason_code=request_body_invalid_json`. This is a transport / contract mismatch between the ThinSDK browser transport and the Sprint 2 collector's `/v1/event` parser — **not** a DB-grant issue, **not** an Nginx-route issue, **not** a token-auth issue, and **not** a service-health issue.

PR#17r records the problem, names the source surfaces to inspect, lays out four solution options (A–D) with trade-offs, recommends an implementation path, and defines the proof gates that must close before any future endpointUrl re-flip is approved. PR#17r itself does **not** authorise any implementation, any source-surface read on production, any DB action, any Nginx action, any endpointUrl change, any controlled or organic page-load, or any traffic generation. The current safety posture is: `buyerrecon.com` ThinLayer `endpointUrl` is rolled back to the Render legacy collector pending PR#17r's downstream implementation PR.

---

## 2. Problem statement

After PR#17p flipped `buyerrecon.com` ThinLayer `endpointUrl` from the Render legacy collector to the Sprint 2 production path `https://buyerrecon.com/v1/event`, and after PR#17q minimally granted column-level `SELECT` on `request_id` (in `ingest_requests`) and `event_id` (in `accepted_events`) to `buyerrecon_prod_collector_app`, a controlled human browser page-load on `buyerrecon.com`:

- successfully loaded `/thinlayer/thin-sdk.iife.js` and `/thinlayer/br-thinlayer-init.js`,
- successfully POSTed to `https://buyerrecon.com/v1/event`,
- successfully traversed Nginx and reached the Sprint 2 production collector on `127.0.0.1:3073`,
- successfully passed production token authentication (`auth_status=ok`, `site_write_tokens_used=1`),
- successfully wrote to `ingest_requests` (the row counter went from `0` to `26` across the page-load window),

but **every request was rejected** with `http_status=400` and `reject_reason_code=request_body_invalid_json`. Zero rows landed in `accepted_events`. Zero rows landed in `rejected_events`. Zero scoring output rows landed (Lane A/B remain `0`-row, per PR#17g grant safety).

The categorical conclusion: the Sprint 2 `/v1/event` parser is rejecting the ThinSDK transport's body shape **before** it reaches the event-validation stage. This is a payload contract mismatch — the ThinSDK is emitting JSON that the Sprint 2 collector does not recognise as a well-formed event envelope. The legacy Render `/collect` endpoint evidently accepted that shape; the Sprint 2 `/v1/event` endpoint does not. PR#17r's job is to plan the alignment without rushing to code.

---

## 3. Timeline of PR#17p / PR#17q canary attempts

Recorded chronologically; categorical only. No raw payloads, no raw tokens, no token hashes, no DSNs, no passwords, no peppers, no private-key material, no host bodies, no private IPs appear below.

### 3.1 PR#17p first attempt (pre-grant fix)

- PR#17p flipped `endpointUrl` from `https://buyerrecon-backend.onrender.com/collect` to `https://buyerrecon.com/v1/event` (per PR#17p §5 diff proof).
- Initial passive 20-tick observation window (PR#17p §8): `NO_EVENT_YET` — no organic visitor emitted a consented ThinLayer event during the window.
- A separately-approved Helen GO authorised a single controlled human browser page-load on `buyerrecon.com` to surface a first event.
- Browser loaded:
  - `/thinlayer/thin-sdk.iife.js`
  - `/thinlayer/br-thinlayer-init.js`
- Browser POSTed to `/v1/event`.
- Nginx access log surface: multiple `POST /v1/event` → `HTTP 500`.
- Collector journal surface (categorical):
  - `kind: storage_failure`
  - `message: permission denied for table ingest_requests`
- Production DB stayed at `0` rows on every event table.
- Decision: **rollback** `endpointUrl` to Render legacy.
- `endpointUrl` rolled back. The Sprint 2 path stopped receiving traffic.

### 3.2 PR#17q minimal grant fix (out-of-band operational)

- Approved Helen GO scoped strictly to a minimum DB grant fix on `buyerrecon_prod_collector_app`.
- Executed grants on the production DB:
  - `GRANT SELECT (request_id) ON public.ingest_requests TO buyerrecon_prod_collector_app`
  - `GRANT SELECT (event_id) ON public.accepted_events TO buyerrecon_prod_collector_app`
- Verified categorically:
  - `ingest_requests.request_id_SELECT=true`
  - `accepted_events.event_id_SELECT=true`
  - Table-wide `SELECT` on `ingest_requests` and `accepted_events` remains **false** (no broadening).
  - Lane A/B `SELECT` remains **false** (PR#17g grant safety preserved).
  - No `SUPERUSER`, no `CREATEDB`, no `CREATEROLE` was granted.
  - `endpointUrl` remained rolled back to Render legacy during the grant fix.
  - Production DB still at `0` event rows at the moment the grants completed.
- The grant fix resolved the `HTTP 500` storage-failure path observed in §3.1.

### 3.3 PR#17p second attempt (post-grant fix)

- A separately-approved Helen GO authorised re-flipping `endpointUrl` to `https://buyerrecon.com/v1/event` for a single controlled human browser page-load.
- `endpointUrl` re-flipped to the Sprint 2 path.
- Controlled human browser page-load executed (same one-person, one-browser shape as §3.1).
- Browser emitted events.
- Nginx access log surface: `POST /v1/event` returned **`HTTP 400`** (not `500`).
- Production DB rows after the page-load window:
  - `ingest_requests = 26`
  - `accepted_events = 0`
  - `rejected_events = 0`
  - `site_write_tokens_used = 1`
- Categorical ingest query (no raw bodies — keys + categorical values only):
  - `http_status = 400`
  - `auth_status = ok`
  - `reject_reason_code = request_body_invalid_json`
  - `endpoint = /v1/event`
  - `workspace_id = keigen_prod_ws`
  - `site_id = buyerrecon_com`
  - `collector_version = buyerrecon-backend-sprint2-pr17m`
- Decision: **rollback** `endpointUrl` to Render legacy pending PR#17r contract alignment.
- `endpointUrl` rolled back. Current steady-state for `buyerrecon.com` ThinLayer is the Render legacy collector.

---

## 4. Evidence summary

| Surface | Pre-PR#17q | Post-PR#17q controlled page-load | Current (after rollback) |
|---|---|---|---|
| `endpointUrl` on `buyerrecon.com` | `https://buyerrecon.com/v1/event` then rolled back | `https://buyerrecon.com/v1/event` (transient) | `https://buyerrecon-backend.onrender.com/collect` (Render legacy) |
| Nginx access log shape | `POST /v1/event` → `500` (× multiple) | `POST /v1/event` → `400` (× 26 categorical) | n/a (no Sprint 2 traffic) |
| Collector journal failure kind | `storage_failure` (`permission denied for table ingest_requests`) | n/a — auth + DB write path now healthy; rejection happens in parser | n/a |
| `ingest_requests` row count | `0` | `26` | `26` (preserved — see §5 / §10) |
| `accepted_events` row count | `0` | `0` | `0` |
| `rejected_events` row count | `0` | `0` | `0` |
| `site_write_tokens_used` | `0` | `1` | `1` (preserved) |
| Lane A row count | `0` | `0` | `0` |
| Lane B row count | `0` | `0` | `0` |
| Token-auth path exercised | no | yes (`auth_status=ok`) | n/a |
| Reject reason | n/a (request died at DB write) | `request_body_invalid_json` | n/a |
| Production collector version | `buyerrecon-backend-sprint2-pr17m` | `buyerrecon-backend-sprint2-pr17m` | `buyerrecon-backend-sprint2-pr17m` |

Implications:

- **Auth works.** `auth_status=ok` and `site_write_tokens_used=1` prove the production token bound to `site_id=buyerrecon_com` was validated server-side.
- **Nginx route works.** `POST /v1/event` requests reached the collector; `HTTP 500` then `HTTP 400` were emitted by the collector, not by Nginx as upstream-unreachable surfaces.
- **DB write works.** `ingest_requests` went from `0` to `26` — `INSERT` succeeded under the PR#17q-restored column-level grant.
- **Event-shape validation fails.** Every one of the 26 requests was rejected with `reject_reason_code=request_body_invalid_json` before reaching the event-validation stage. The categorical signal: the parser cannot decode the body as a well-formed JSON event envelope. This is a contract mismatch between the ThinSDK transport and the Sprint 2 `/v1/event` parser.
- **No accepted or rejected events.** Because the body never parsed, the collector never reached the `accepted_events` / `rejected_events` decision; both remain `0` rows. PR#17g Lane A/B grant safety holds.

---

## 5. Current safety posture

PR#17r is planning-only and does **not** alter the posture. The posture in force at the moment PR#17r is written:

- **`buyerrecon.com` ThinLayer `endpointUrl` is rolled back to the Render legacy collector** (`https://buyerrecon-backend.onrender.com/collect`). No Sprint 2 traffic is being emitted from the live site.
- **The 26 `ingest_requests` rows from the post-PR#17q controlled page-load are preserved.** They are categorical evidence of the rejection pattern and must not be deleted. Any future fix is validated against the categorical pattern they record, not by re-running history.
- **PR#17q's column-level grants stand.** Table-wide `SELECT` on `ingest_requests` and `accepted_events` remains `false`. Lane A/B `SELECT` remains `false`. No `SUPERUSER` / `CREATEDB` / `CREATEROLE`. No broadening.
- **PR#17o's Nginx route stands.** `location = /v1/event` → `proxy_pass http://127.0.0.1:3073/v1/event` with the root-only PR#17m production token snippet, Host header `buyerrecon.com`. No new Nginx work is anticipated by PR#17r.
- **Production collector service stands.** `buyerrecon-production-collector.service` remains `active` on `PORT=3073`. PR#17r does not authorise restart, reconfiguration, or redeploy.
- **`br-probe-init.js` remains on Render `apiBase`.** Probe-side traffic is out of PR#17r scope.
- **No Track A, no Playwright, no synthetic write smoke, no Lane A/B writer, no Trust Core exposure, no Pass 1 / Pass 2.**
- **No secrets in any artefact.** No raw payload bodies, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, or private IPs appear in this doc or in any PR#17r artefact.

---

## 6. Hypotheses for contract mismatch

PR#17r records candidate hypotheses to be confirmed (or eliminated) by the source-surface inspection planned in §7. None of these are assertions; they are the directions the contract-alignment work will investigate. Each will be either confirmed or excluded by reading source — no production traffic is required to discriminate among them.

### H1 — ThinSDK emits a JSON **array** batch; Sprint 2 `/v1/event` expects a single JSON **object** envelope

Likely if the ThinSDK transport accumulates events into a buffer flushed as a batch (commonly via `navigator.sendBeacon`). If the Sprint 2 `/v1/event` parser calls `JSON.parse` and then validates against an envelope schema that requires keys at the top level (e.g. `event_id`, `site_id`, `event_type`, `payload`), an array would deserialise to a JavaScript array, fail object-shape validation, and surface as `request_body_invalid_json` if the validator reports "not a recognisable envelope" with that reason code.

### H2 — `navigator.sendBeacon` is sending a `Blob` whose effective `Content-Type` differs from what the collector parser inspects

`navigator.sendBeacon(endpointUrl, blob)` sends the blob with the blob's `type` as the `Content-Type` header. If the ThinSDK constructs the blob with `type: 'text/plain'` or `'application/x-www-form-urlencoded'` (common Beacon patterns), but the collector parser short-circuits on `Content-Type !== 'application/json'` and returns `request_body_invalid_json` without actually attempting `JSON.parse`, every request would be rejected even if the body is well-formed JSON.

### H3 — ThinSDK envelope key set differs from Sprint 2 envelope key set

If ThinSDK emits a legacy envelope with key names matching the Render legacy `/collect` collector (e.g. `event`, `site`, `ts`, `props`) and Sprint 2 expects Sprint 2 contract keys (e.g. `event_id`, `site_id`, `event_type`, `occurred_at`, `payload`, `workspace_id`), the body is well-formed JSON but fails envelope-shape validation. The reason code depends on how the parser distinguishes "JSON-but-wrong-shape" from "not-JSON". If it returns `request_body_invalid_json` for both classes, H3 is plausible.

### H4 — ThinSDK emits a `keepalive: true` `fetch` with a body shape the parser doesn't recognise

If the ThinSDK has a code path that falls back from `sendBeacon` to `fetch(endpointUrl, { method: 'POST', body, keepalive: true })` and the body is a serialised legacy shape (or a `URLSearchParams` form-encoded blob), Sprint 2's parser would behave the same as H2 / H3.

### H5 — ThinSDK posts plaintext (e.g. CSV or newline-delimited) to a route Render legacy interpreted leniently

Less likely given ThinSDK is described as `thin-sdk.iife.js`, but worth excluding by source read. If the Render `/collect` route consumed any-content-type bodies as opaque blobs and post-processed them server-side, ThinSDK might be emitting a non-JSON body shape that the Sprint 2 parser correctly rejects.

### H6 — Sprint 2 collector requires `workspace_id` / `site_id` in body, but ThinSDK only sends those via token-bound headers

If Sprint 2's `/v1/event` envelope schema mandates `workspace_id` and `site_id` in the JSON body (independent of the token-derived authentication context), and ThinSDK only carries them as headers / via the token binding, the body fails schema validation. The categorical evidence (`workspace_id=keigen_prod_ws`, `site_id=buyerrecon_com` recorded in `ingest_requests`) is consistent with both possibilities — the values may be derived from token-binding even if the body lacked them.

### H7 — Sprint 2 collector requires a strict JSON envelope shape (string-typed `event_id` UUID, ISO timestamp, etc.) and ThinSDK supplies different types

If ThinSDK emits epoch-ms timestamps where Sprint 2 expects ISO-8601, or a numeric event-id where Sprint 2 expects a UUID, the parser may reject as `request_body_invalid_json` if the validator collapses all envelope-parse failures into that single reason code.

These hypotheses cover the **primary likely surfaces** (transport mechanism, content-type, envelope keys, value types, batch-vs-single shape); downstream source inspection (§7) may add further hypotheses. H1 and H2 are the highest-prior plausibility given the ThinSDK + Beacon + IIFE pattern.

Additional plausible hypotheses to keep on the table during the source-surface inspection:

- **H8 — Double-encoded JSON.** The ThinSDK may stringify an event object once into a JSON string, then wrap that string as the body of a second JSON envelope (or as the `value` of a form field), causing the Sprint 2 parser to see a JSON string where it expects a JSON object.
- **H9 — Charset / body-parser edge case.** The blob or fetch body may be sent with a `Content-Type` that includes a charset directive (e.g. `application/json; charset=utf-8`) or with an encoding the body-parser middleware short-circuits on (UTF-16 BOM, gzip-compressed body without a declared `Content-Encoding`, etc.). Some Express/`body-parser` configurations reject such bodies with the same `request_body_invalid_json` reason code.
- **H10 — Body-size / parser-limit behaviour.** Large batched payloads may exceed the body-parser's default size limit, surfacing as a parser rejection rather than a clear "request entity too large" error depending on how the route maps parser exceptions to reason codes.
- **H11 — Empty / undefined body on one transport path.** A fallback transport (e.g. when `sendBeacon` returns `false` and the SDK silently retries via `fetch`) may emit a request with an empty body or with `undefined` serialised as the body, which the strict parser classifies as `request_body_invalid_json`.

Source-surface inspection (§7) is expected either to confirm one of H1–H11 or to surface a further hypothesis not yet listed. Either outcome resolves the contract mismatch.

---

## 7. Source surfaces to inspect

PR#17r names the surfaces that the downstream implementation work will inspect. PR#17r does **not** authorise reading any production file content into chat, into the repo, or into any artefact — production source-surface reads are read-only and stay on the production host until a categorical (non-payload, non-secret) summary is needed.

### 7.1 Frontend transport (production host, read-only)

- `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js`
  - The compiled ThinSDK bundle that the live page loads.
  - Read for: transport mechanism (`navigator.sendBeacon` vs `fetch`), batch behaviour (single vs array), `Blob` construction (`new Blob([body], { type: ... })`), `Content-Type` header behaviour, envelope key set, value type formatting (timestamps, IDs), `keepalive` flag, retry behaviour.
  - **Do not** copy raw bundle contents into chat or into this repo. Summarise categorically (e.g. "transport=sendBeacon, batch=true, content_type=text/plain") for downstream PRs.
- `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
  - The page's ThinLayer initialiser (the file PR#17p flipped).
  - Read for: any envelope key overrides, batch-size / flush-interval configuration, consent-gate behaviour, secondary endpoints, error reporting, version stamp.
  - PR#17p already records its `endpointUrl` shape; PR#17r treats it as the second surface to align.

### 7.2 Sprint 2 collector parser (repo, read-only)

- `src/app.ts`
  - Application bootstrap — confirms which router handles `/v1/event` and what body-parsing middleware is applied.
- `src/collector/v1/routes.ts`
  - The `/v1/event` route definition. Read for: HTTP method binding, request body parsing (`express.json()` strict mode, custom parser, raw-body extraction), content-type gating, error-mapping to `reject_reason_code` values.
- `src/collector/v1/orchestrator.ts`
  - The end-to-end orchestration of a `/v1/event` request (parse → validate → persist to `ingest_requests` → validate envelope → persist to `accepted_events` / `rejected_events`).
- `src/collector/v1/validation.ts`
  - Envelope validation rules. Read for: which fields are mandatory, which value formats are accepted (string vs number, UUID vs free-form, ISO vs epoch-ms), and which validation failures map to `request_body_invalid_json` vs more granular reason codes.
- `src/collector/v1/envelope.ts`
  - The canonical event-envelope type and the parser that turns a parsed JSON body into an envelope.
- `src/collector/v1/types.ts`
  - Type declarations for the envelope, validation errors, and reject-reason taxonomy.

### 7.3 Legacy collector route (repo, read-only, if present)

- `src/collector/routes.ts`
  - If the legacy `/collect` route still exists in repo (e.g. for backwards-compatibility on Render), reading it reveals the exact body shape that ThinSDK was designed for. That is the highest-value comparison point for diagnosing H3 and H6.

### 7.4 Batch endpoint support (repo, read-only)

- Any `/v1/batch` route file (search the same `src/collector/v1/*` tree for `batch`).
- Any feature flag named `ENABLE_V1_BATCH` (search `src/config/*`, `src/env/*`, or `.env.*.example`).
- If a production-ready batch route already exists with the right auth and persistence, Option B (§8) becomes a clean choice. If not, Option B has more work behind it.

### 7.5 What inspection must categorically avoid

- **No raw payload bodies.** Inspection summarises categorical structure (key names, types, batch/single, content-type) only.
- **No raw token material.** The token-snippet file and the saved PR#17m token file remain root-only on the production host and are not read for PR#17r's purposes.
- **No DSN / pepper / password / private IP / certificate body.** None of these surfaces are necessary to diagnose the contract mismatch.
- **No SELECT into production DB beyond what PR#17q already authorised, and no conflation of runtime grants with proof-observer queries.** PR#17q's column-level grants for `request_id` on `ingest_requests` and `event_id` on `accepted_events` are the **current runtime steady-state grants for `buyerrecon_prod_collector_app`'s collector write path only** — they exist so the route's `INSERT` / `UPDATE` / `RETURNING` / `ON CONFLICT` SQL completes without `permission denied`. They are **not** the channel for categorical row-count, auth-status, reject-reason, or workspace/site proof-observer queries. Those proof-observer queries must use the **approved read-only operator verification path** (PR#17m §8.4 Blocker-2 fix / PR#17h §13 — an operator role that holds the necessary `SELECT` privileges and is **not** `buyerrecon_prod_collector_app`). The collector runtime role must **not** be broadened to support proof-observer queries. Any new runtime grant that a downstream implementation PR shows to be necessary for the write path itself must be separately justified, minimal (column-level wherever possible), and approved by its own explicit Helen GO before any endpointUrl re-flip (see §11.4).

---

## 8. Solution options A–D

Each option is recorded with explicit pros, cons, and the proof gates it would require. PR#17r recommends one (§9) but does not eliminate the others — they remain available if Helen's review changes the prioritisation.

### Option A — ThinSDK adapter update (frontend change)

Change `thin-sdk.iife.js` and/or `br-thinlayer-init.js` so that the browser transport emits the exact Sprint 2 `/v1/event` envelope shape. Concretely, after source inspection (§7) identifies the divergence, modify the ThinSDK build to:

- emit a single JSON object envelope (not an array), if H1 is confirmed,
- set the `Blob` `type` (or `fetch` `Content-Type`) to `application/json`, if H2 is confirmed,
- rename envelope keys / re-shape value types to match Sprint 2 contract, if H3 / H6 / H7 are confirmed,
- preserve `navigator.sendBeacon` semantics (best-effort, no response-body inspection),
- preserve consent-gate behaviour, version stamping, and graceful fallback.

**Pros:**

- Keeps the Sprint 2 collector contract strict and canonical — the server-side envelope schema does not bend to legacy clients.
- Avoids server-side adapter code that could weaken contract semantics.
- One-time frontend change; thereafter all ThinSDK-emitting sites converge on the same canonical shape as they cut over.
- No new code path on the production collector.
- No new Nginx / systemd / DB surface.

**Cons:**

- Requires modifying production-host frontend asset files (`/var/www/buyerrecon.com/html/thinlayer/*`).
- Requires a careful per-browser smoke (real `navigator.sendBeacon` semantics differ from headless / programmatic checks).
- Requires rebuild + re-deploy discipline for the ThinSDK bundle if it is sourced from a build pipeline (vs hand-edited on the host).
- Multi-site rollout coordination: once ThinSDK is updated, all five canary sites should be on the updated bundle before any other endpointUrl flip.

**Required proof gates:**

- Local unit tests for the new ThinSDK transport that mock `navigator.sendBeacon` and assert the emitted body shape, content-type, and headers byte-by-byte (no real network).
- A controlled, **non-production** fixture-page test (e.g. on a staging host or local file URL) that exercises the live ThinSDK bundle against a local Sprint 2 collector instance and confirms the parser accepts the body.
- Categorical evidence that the produced bundle does not embed any token / secret / DSN.
- Explicit Helen GO before any production-host write of the new ThinSDK bundle.
- A separately approved endpointUrl re-flip GO after the bundle update.

### Option B — Use `/v1/batch` if ThinSDK currently emits arrays

If §7.4 inspection reveals that the Sprint 2 collector already exposes a production-ready `/v1/batch` endpoint, and §7.1 inspection confirms ThinSDK emits a JSON array batch, the alignment becomes: point `endpointUrl` at the batch route instead of the single-event route.

**Pros:**

- Minimal client change — only `endpointUrl` flips (from `/v1/event` to `/v1/batch`).
- Preserves ThinSDK's existing batching behaviour, which is operationally desirable for high-traffic sites.
- No code change on the ThinSDK bundle.

**Cons:**

- Only works if `/v1/batch` exists, is production-ready, has the same auth contract as `/v1/event`, persists into `ingest_requests` / `accepted_events` / `rejected_events` consistently, and is wired to the same Nginx route shape (a new Nginx route for `/v1/batch` may be required, which is **out of scope** for PR#17r and would need its own GO).
- The PR#17q column-level grants may not cover whatever per-row persistence shape the batch endpoint emits — additional minimal grants may be required.
- If `/v1/batch` does not exist or is not production-ready, Option B collapses into "build a batch endpoint", which is a much larger scope than PR#17r.

**Required proof gates:**

- §7.4 inspection confirms `/v1/batch` exists in repo and is shipped in the production collector binary.
- A read-only review of the batch route's auth contract, persistence path, and DB-grant requirements.
- A new Nginx route, if required, gated under its own GO and recorded under a follow-up PR.
- Local unit tests for the batch route's parser against the exact body shape ThinSDK currently emits.
- Categorical confirmation that the batch route does not introduce a new failure surface (e.g. partial-batch acceptance with no rejection-row trail).
- Explicit Helen GO before any endpointUrl re-flip.

### Option C — Add a narrow compatibility adapter route

Add a new server-side route — e.g. `POST /v1/event-legacy` or a content-type-conditional branch inside `/v1/event` — that accepts the current ThinSDK body shape and maps it into the canonical Sprint 2 event envelope before handing it to the validator.

**Pros:**

- Bridges five live ThinLayer sites onto the Sprint 2 collector without per-site frontend rebuilds.
- Lets each site cut over on its own timeline without coordinated bundle updates.
- The adapter is a transparent shim: the canonical envelope schema remains strict, and the adapter's mapping is auditable.

**Cons:**

- Adds code to the production collector — a new code path requires its own test discipline, its own grant surface (the adapter persists the same `ingest_requests` row), and its own observability.
- Risks "soft contract drift" if the adapter ages into a permanent fallback rather than a migration bridge.
- Must be carefully gated to prevent malformed legacy bodies from short-circuiting the canonical validator.
- Requires a deprecation plan (when does the adapter route get removed? after which sites are on the new bundle?).

**Required proof gates:**

- Local unit tests for the adapter's mapping function (legacy shape → canonical envelope), with table-driven coverage of every envelope key and value type.
- Source-shape tests proving no raw secret leakage in the adapter's logging / error paths.
- A staging dry-run with a controlled, non-customer fixture payload (no real customer data, no real ThinSDK bundle traffic).
- A retirement plan in repo documenting when the adapter route gets removed.
- Explicit Helen GO before merging the adapter, and a second GO before any endpointUrl re-flip.

### Option D — Do nothing / stay on Render legacy until contract bridge is ready

Keep `buyerrecon.com` ThinLayer `endpointUrl` on the Render legacy collector indefinitely until one of A / B / C is built, tested, and approved.

**Pros:**

- Zero risk to the live site — `buyerrecon.com` continues to capture events on the Render path as it has for the entire canary sequence to date.
- Preserves PR#17q's minimal grant fix and PR#17o's Nginx route as latent assets ready for re-activation when one of A / B / C lands.
- No code, no Nginx, no DNS, no systemd, no DB action required.

**Cons:**

- The Sprint 2 production collector remains unable to receive real `buyerrecon.com` events.
- Delays Sprint 2 production canary milestone.
- Render legacy collector remains the single point of capture for ThinLayer events from all five sites.

**Required proof gates:**

- None to remain on Option D itself — Option D *is* the rollback posture.
- Option D becomes the steady state until one of A / B / C is approved and proven.

---

## 9. Recommended next implementation path

**Recommendation: read source (§7) first, then most likely Option A (ThinSDK adapter update).**

The recommended sequence:

1. **Read source first, code last.** Inspect §7.1 (frontend transport) and §7.2 (Sprint 2 parser) categorically. The categorical comparison — emitted shape vs accepted shape — discriminates H1–H11 (and any additional hypothesis surfaced by inspection) without writing a line of code or generating a single new event. This step closes within a single planning PR's worth of effort and should be the next PR (e.g. PR#17s) under its own GO.
2. **Confirm or eliminate Option B.** While reading §7.2, also read §7.4. If `/v1/batch` is production-ready and the ThinSDK body shape is a JSON array, Option B becomes the lowest-cost path. If not, Option B is shelved (it can be re-opened if Sprint 2 later adds a batch endpoint).
3. **Default to Option A unless §7.4 changes the picture.** Option A keeps the Sprint 2 contract strict and avoids a permanent server-side compatibility shim. The ThinSDK rebuild is a one-time cost that benefits every future site cutover.
4. **Hold Option C in reserve.** If the source inspection reveals that the per-site frontend rebuild has high friction (e.g. the bundle is not from a maintained build pipeline, or a multi-site simultaneous flip is operationally too risky), Option C re-enters as a fallback. Its retirement plan must be on the table from day one.
5. **Stay on Option D until A / B / C is proven.** While source reading and implementation happen, `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy. The Sprint 2 production collector continues to serve only the PR#17o Nginx route at zero live traffic.

PR#17r does **not** authorise execution of any of the above. The recommendation is what PR#17r proposes for Helen's review.

---

## 10. Non-goals / boundaries

The following are explicitly **out of scope** for PR#17r and for any downstream PR until that PR carries its own explicit Helen GO scoped to the named work. PR#17r names them to make the boundary categorical.

- **No raw payload exposure.** No raw request bodies (full or truncated) appear in this doc, in chat, in repo files, in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17r.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 / customer-readable reports remain future-gated.
- **No scoring.** No Lane A / Lane B writer is built, enabled, or extended by PR#17r or by any downstream PR until customer-facing output gates are designed.
- **No Lane A/B writes.** `scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-row. PR#17g grant safety preserved.
- **No Trust Core / Pass 1 / Pass 2.** Independent track; not unlocked by contract alignment.
- **No Track A replay.** Track A scenarios remain gated under PR#17e (or its successor) and are not invoked as part of PR#17r's implementation.
- **No broad Nginx changes.** The PR#17o `location = /v1/event` route stays as deployed. If Option B requires a `/v1/batch` route, that is a separate PR with its own GO.
- **No DNS changes.** The `buyerrecon.com` zone is not edited under PR#17r or its downstream PRs.
- **No DB grant broadening.** PR#17q's column-level grants are the steady state. No table-wide `SELECT`, no Lane A/B `SELECT`, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`, no `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `GRANT` / `REVOKE` by PR#17r.
- **No Render migration.** Render legacy collector remains the steady-state target for `buyerrecon.com` ThinLayer traffic during planning and implementation.
- **No deletion of failed canary evidence rows.** The 26 `ingest_requests` rows recorded in §4 are preserved (per PR#17h ledger preservation). They are categorical evidence of the contract mismatch and remain part of the audit trail.
- **No secrets in any artefact.** No raw token, token prefix / suffix, token hash, pepper, DSN, password, certificate / private-key material, private IP, host body, vault content, or any equivalent appears in PR#17r-derived files, chat, PR comments, or CI logs.
- **No write smoke.** No `POST /v1/event` and no `POST /v1/batch` (if it exists) is issued by PR#17r or its downstream PRs against production until the contract alignment is proven in a non-production fixture (§11).
- **No production commands by PR#17r authoring.** PR#17r is docs-only.

---

## 11. Required proof gates (for downstream implementation PRs)

Before any future endpointUrl re-flip on `buyerrecon.com` is approved, the downstream implementation PR(s) must close each of the following gates. PR#17r records the gates here so they cannot be quietly skipped.

### 11.1 Local / unit tests for payload mapper or endpoint route

- For Option A: unit tests for the new ThinSDK transport, mocking `navigator.sendBeacon`, asserting the emitted body shape (byte-for-byte against a canonical fixture), the content-type, the headers, the URL, and the consent-gate behaviour. Coverage of: single-event happy path, batched-event happy path (if batching is preserved), consent-blocked path, transport-failure path.
- For Option B: unit tests for the `/v1/batch` route's parser against the exact body shape ThinSDK emits, with table-driven coverage of every envelope key, value type, batch size, and error path.
- For Option C: unit tests for the adapter's legacy-shape → canonical-envelope mapping function, with table-driven coverage of every envelope key, value type, content-type, batch shape, and error path. Plus tests asserting the adapter route returns the same reason-code taxonomy as the canonical `/v1/event` route.

### 11.2 Source-shape tests proving no raw secret leakage

- No token, token prefix / suffix, pepper, DSN, password, private IP, certificate / private-key material is bundled into the ThinSDK build output (Option A) or emitted in the adapter's logging / error paths (Option C).
- A forbidden-pattern grep (the same family used in PR#17o §6 / PR#17m operator hygiene) is run over the produced artefact and the test must fail if any forbidden pattern matches.

### 11.3 Production / staging dry-run with a controlled fixture

- The downstream PR runs the new transport (or batch route, or adapter route) against a local or staging Sprint 2 collector instance using a **controlled non-customer fixture payload**. No real ThinSDK bundle traffic from a customer-facing site is generated as part of the dry-run.
- The dry-run captures categorical evidence: `http_status`, `reject_reason_code` (must be absent on the happy path), `ingest_requests` row delta, `accepted_events` row delta, `rejected_events` row delta. No raw bodies are captured.
- The dry-run does not touch production unless explicitly gated by a separate Helen GO; the default dry-run target is local or staging.

### 11.4 Runtime privilege simulation / production-role dry-run

This gate is a hard precondition to §11.5 (Helen GO before reapplying endpointUrl). It exists because the PR#17p → PR#17q sequence revealed that route readiness and fixture parsing can both pass while the **runtime DB role** still lacks a privilege required by the actual SQL path — surfacing as `HTTP 500` + `storage_failure` + `permission denied for table …` only when live browser traffic exercises the path. This gate forces that failure surface to be ruled out before any endpointUrl re-flip.

The chosen path — Option A, B, or C from §8 — must be exercised against either:

- **the real production least-privilege runtime role / grant matrix**, only where explicitly approved by a separate Helen GO scoped to that exercise, **or**
- **a disposable / staging DB role whose grants exactly mirror `buyerrecon_prod_collector_app`'s current PR#17q steady-state grant matrix** (column-level `SELECT (request_id)` on `ingest_requests`, column-level `SELECT (event_id)` on `accepted_events`, plus the existing `INSERT` / `UPDATE` / sequence `USAGE` shape; no broadening of any kind).

The dry-run must categorically check, with read-only operator observation (not by SELECT under the runtime role):

- **No `storage_failure`** — the collector journal records no row of `kind: storage_failure` during the dry-run window.
- **No `permission denied`** — neither the collector journal nor the DB error log records any `permission denied for table …` (or any other `permission denied …`).
- **No missing privileges for `WHERE`, `RETURNING`, `ON CONFLICT`, or column-level `SELECT`** — every SQL statement the route runs completes; in particular, any `UPDATE … WHERE request_id = $1`, any `INSERT … RETURNING event_id`, and any `INSERT … ON CONFLICT (…) DO UPDATE` path is exercised at least once.
- **No table-wide `SELECT`** granted to the runtime role to "make the dry-run pass". Table-wide `SELECT` on `ingest_requests`, `accepted_events`, `rejected_events`, or `site_write_tokens` is forbidden by this gate.
- **No Lane A/B grants** granted to the runtime role. `scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-privilege for the collector runtime role (PR#17g grant safety preserved).
- **No derived-table grants** (no `SELECT` on observer-only or analytics-only tables granted to the runtime role).
- **No `SUPERUSER`, `CREATEDB`, or `CREATEROLE`** granted, and no DDL privileges (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`) granted to the runtime role.
- **Any new minimal grant** that the dry-run reveals as necessary (e.g. a previously unknown column-level `SELECT` for an `ON CONFLICT` predicate) must be requested through its **own separate explicit Helen GO** before the endpointUrl re-flip. The grant request must name the exact `GRANT` statement, the exact SQL clause that requires it, and the resulting `has_column_privilege` / `has_table_privilege` matrix delta. The endpointUrl re-flip GO does **not** subsume a grant-mutation GO.

The dry-run produces a docs-only proof closure (its own PR) recording the categorical privilege matrix exercised, the categorical absence of `storage_failure` and `permission denied`, and the categorical absence of any unauthorised grant mutation during the exercise. Only after that proof closure can §11.5 fire.

### 11.5 Explicit Helen GO before reapplying endpointUrl

- The endpointUrl re-flip on `buyerrecon.com` from Render legacy to `https://buyerrecon.com/v1/event` (or `/v1/batch`, etc.) requires its own explicit Helen GO message naming the implementation PR that closed gates 11.1–11.4.
- No downstream PR is permitted to assume PR#17r or any prior PR pre-authorises the re-flip.

### 11.6 First-event observation only after contract alignment proof

- After the re-flip, the next gate is observation of a first real organic `buyerrecon.com` event whose envelope passes the parser, lands in `accepted_events`, and emits no `request_body_invalid_json` (or any other `request_body_*`) reject reason.
- This observation is recorded under its own proof PR (analogous to PR#17p's role for the endpointUrl flip).
- Until this observation lands cleanly, the canary stays in the watch state — no broader cutover, no Track A, no Playwright, no write smoke.

### 11.7 Rollback remains Render legacy

- The default rollback target at every gate from 11.3 onward is the Render legacy collector. Restoring `endpointUrl` to `https://buyerrecon-backend.onrender.com/collect` is the one-step rollback path and must remain functional throughout the contract-alignment work.

---

## 12. Rollback / pause posture

PR#17r is docs-only and does not execute any rollback. The rollback / pause posture in force at the moment PR#17r is written:

- **`buyerrecon.com` ThinLayer `endpointUrl` is on Render legacy** (`https://buyerrecon-backend.onrender.com/collect`). This is the pause state for the Sprint 2 canary on `buyerrecon.com` and remains the rollback target throughout PR#17r's downstream implementation work.
- **The Sprint 2 production collector is up but idle** with respect to `buyerrecon.com`. PR#17o's Nginx route stays as deployed. The collector continues to listen on `127.0.0.1:3073` with PR#17q's column-level grants on `buyerrecon_prod_collector_app`. No live traffic reaches it from `buyerrecon.com`.
- **`br-probe-init.js` remains on Render `apiBase`.** Probe-side traffic continues to land on Render legacy as before.
- **The 26 `ingest_requests` rows from the post-PR#17q controlled page-load are preserved** as categorical evidence (per PR#17h §16 ledger preservation). They are read-only artefacts for the downstream contract-alignment PR.
- **All other PR#17 boundaries hold:** PR#17g Lane A/B grant safety, PR#17h ledger preservation, PR#17m operator hygiene, PR#17m secret recovery posture, PR#17n collector deployment posture, PR#17o Nginx route hygiene, PR#17p endpointUrl-flip rollback path. None of these are weakened by PR#17r.

If a future operator decision (under its own explicit Helen GO) requires further pausing (e.g. removing the PR#17o Nginx route entirely while the contract bridge is built), that pause is a separate PR with its own scope, its own proof, and its own rollback path. PR#17r does **not** pre-approve any such pause.

---

## 13. Open decisions for Helen

The following decisions are open and require Helen's input before any downstream implementation PR is opened. PR#17r records them so the decision surface is explicit.

1. **Which option (A / B / C / D) becomes the implementation track?** PR#17r recommends A by default, B if §7.4 inspection finds a production-ready `/v1/batch`, and C only if frontend rebuild friction is prohibitive. D remains the steady state until A / B / C is approved.
2. **Is the source-inspection step itself a separate PR (e.g. PR#17s) or part of the implementation PR?** A separate read-only inspection PR has the advantage that it produces a docs-only artefact (categorical comparison of ThinSDK shape vs Sprint 2 parser shape) that informs the implementation PR without committing to code. A combined PR is faster but couples discovery and execution.
3. **If Option A is chosen, where does the new ThinSDK bundle live?** Is `thin-sdk.iife.js` hand-edited on the production host or built from a maintained source tree? If the latter, the source tree's location and CI must be identified before the implementation PR begins.
4. **If Option C is chosen, what is the retirement timeline for the adapter route?** The adapter must not become a permanent fallback. A retirement gate (e.g. "remove the adapter once all five canary sites are on the new ThinSDK bundle") should be part of the same implementation PR.
5. **Is `buyerrecon.com` still the first canary site, or has the failed first attempt changed the order?** PR#17a's site-by-site cutover order remains `buyerrecon.com → realbuyergrowth.com → timetopoint.com → fidcern.com → keigen.co.uk`. The 26-row rejection pattern is a `buyerrecon.com`-only observation; the contract mismatch is presumed to be common to all five sites (they share ThinSDK), so the fix lands once and unlocks the cutover for all five. Helen may choose to re-order based on traffic volume or operational risk.
6. **Are the PR#17q column-level grants the steady state for the runtime role, or do they extend?** The current `request_id` (on `ingest_requests`) and `event_id` (on `accepted_events`) `SELECT` grants are the **runtime steady-state grants for `buyerrecon_prod_collector_app`'s collector write path only** — they exist so the route's `INSERT` / `UPDATE` / `RETURNING` / `ON CONFLICT` SQL completes without `permission denied`. They are **not** the channel for proof-observer queries; categorical row-count, auth-status, reject-reason, and workspace/site proof queries use the approved read-only operator verification path (PR#17m §8.4 Blocker-2 fix / PR#17h §13), which holds its own `SELECT` privileges and is **not** `buyerrecon_prod_collector_app`. The collector runtime role must **not** be broadened to support proof-observer queries. If a downstream implementation PR shows that the runtime write path itself needs an additional minimal grant (for example, a column-level `SELECT` on an `ON CONFLICT` predicate that turns out to require it), that grant requires its own separate, justified, minimal, explicit Helen GO before any endpointUrl re-flip (see §11.4). Finer-grained proof-observer observability (for example `SELECT (workspace_id, site_id) ON public.ingest_requests`) is an operator-role question and a separate decision from the runtime role's grants.
7. **Confirmation that no PR#17r artefact is to be deployed.** PR#17r is docs-only by definition; no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file, no ThinSDK bundle is touched by PR#17r. Helen's explicit confirmation that this scope is correct closes the planning PR.

---

## Closing notes

- **PR#17r is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection by PR#17r, no service action by PR#17r, no production-host action by PR#17r.
- **No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, or vault contents** appear anywhere in this doc.
- **Production posture after PR#17r:** `buyerrecon-production-collector.service` `active` on `PORT=3073`; `nginx.service` `active` with the PR#17o `location = /v1/event` route; `buyerrecon.com` ThinLayer `endpointUrl` rolled back to Render legacy (`https://buyerrecon-backend.onrender.com/collect`); `br-probe-init.js` on Render `apiBase`; `ingest_requests = 26` preserved as evidence; `accepted_events = 0`; `rejected_events = 0`; `site_write_tokens_used = 1` preserved; Lane A/B at `0` rows; PR#17g grant safety intact; PR#17q column-level grants intact; staging service untouched; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.

End of PR#17r. **Planning only. No execution. No code. Awaiting Helen's decision on Options A / B / C / D before any downstream implementation PR.**
