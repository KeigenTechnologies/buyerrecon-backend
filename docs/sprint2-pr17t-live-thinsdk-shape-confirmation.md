# BuyerRecon Sprint 2 PR#17t — Live ThinSDK / Static-Site Emitted Shape Confirmation (Gate 1)

Status: **docs-only Gate 1 confirmation report**. No implementation. No code change. No repo-config change. No migration. No `schema.sql` change. No `.env*` change. No Nginx / systemd / DB command. No production command. No `curl`, `psql`, `wrk`, `ab`, `node`-against-production, or service action by PR#17t. No `endpointUrl` re-flip. No DB mutation. No DB query. No DB grant change. No write smoke. No Track A. No Playwright. No browser traffic generation. No edit to any file under `/var/www`. No copy of any production-host bundle into this repo. No customer-facing output. No Lane A/B writer. No AMS Trust Core exposure. No Pass 1 / Pass 2. **No raw payloads, raw tokens, token prefixes/suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `41b39cf` — "Sprint 2 PR#17s: inspect ThinSDK collector contract shape (#24)").

PR branch: `buyerrecon-sprint2-pr17t-live-thinsdk-shape-confirmation`

Mandatory references:
- `docs/ops/cutover-hard-gates.md` — operational standard. PR#17t is a Gate 1 — Static Contract Diff confirmation.
- `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` — PR#17s inspection report; PR#17t closes the §5 "ThinSDK shape is inferred, not observed" limitation against actual bundle source where it is locally available.
- `docs/sprint2-pr17r-thinsdk-sprint2-collector-contract-alignment-planning.md` — PR#17r planning, hypotheses H1–H11, options A–D.

---

## 1. Status / verdict

**H1 from PR#17s is directly confirmed by source inspection of the BuyerRecon website's `production-live-20260508` snapshot. Static-site ThinSDK at this snapshot emits a top-level JSON array with the legacy `/collect` envelope shape and zero Sprint 2 required fields.**

The dominant cause of the 26 post-PR#17q `request_body_invalid_json` rejections recorded in PR#17p / PR#17s is now categorically grounded in the bundle source. The `thin-sdk.iife.js` bundle defines two transport classes — `BeaconTransport` (alias `D`) and `FetchTransport` (alias `F`) — and `br-thinlayer-init.js` selects the fetch transport explicitly (`transport: 'fetch'`, line 75). The `createTransport` factory routes that string to `new FetchTransport(endpointUrl, batchConfig)`, so the **configured live runtime path on `buyerrecon.com` is fetch-only**: `FetchTransport.flush()` calls `JSON.stringify(<queue array>)` and ships the resulting top-level JSON array via `fetch(endpointUrl, { method: "POST", body: t, headers: { "Content-Type": "application/json" }, keepalive: true })`. The configured path does **not** construct a `Blob` and does **not** call `navigator.sendBeacon`. (`BeaconTransport` is present in the bundle and would also serialise the queue as a top-level array, but it is not selected by the inspected init config.) Sprint 2 `/v1/event` rejects top-level arrays at the parser stage (`src/collector/v1/envelope.ts:97–112` + `tests/v1/envelope.test.ts` array-of-3 → `request_body_invalid_json`).

Beyond the array-vs-object envelope mismatch, **every Sprint 2 required event field is absent** from the live bundle: zero occurrences of `event_name`, `schema_key`, `schema_version`, `event_origin`, `occurred_at`, `client_event_id`, `page_view_id`, or `workspace_id` across `thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, or `br-thinlayer-init.js`. The live envelope uses the legacy field set (`event_schema_version`, `event_type` legacy taxonomy, `client_timestamp_ms`, `consent_signal`, `anon_session_id`, `anon_browser_id`, `site_id`, `path`, `hostname`, `adapter_id`, `adapter_version`, plus adapter-context fields).

PR#17t is **Gate 1 only**: a categorical, read-only inspection. **Static bundle shape confirmation is not write-smoke approval.** **No endpointUrl re-flip is approved by PR#17t.** The current safe posture — `buyerrecon.com` ThinLayer `endpointUrl` rolled back to Render legacy (`https://buyerrecon-backend.onrender.com/collect`) — remains in force. The 26 `ingest_requests` evidence rows are preserved. PR#17q column-level grants stand.

**Recommended next implementation path: Option A** (ThinSDK / adapter update to emit Sprint 2 `/v1/event` shape and required per-event fields), per PR#17s §11.1. Rationale and proof-gate sequencing are in §12 and §13.

> **Route readiness is not end-to-end readiness.**
> **EndpointUrl update is not event-capture proof.**
> **Health check is not event-contract proof.**
> **Static bundle shape confirmation is not write-smoke approval.**
> **400 means request reached collector but failed contract/validation.**
> **Do not delete failed canary evidence rows.**
> **Do not broaden grants to make a proof pass.**
> **No endpointUrl re-flip is approved by PR#17t.**

---

## 2. Scope and hard-gate references

### 2.1 What PR#17t is

A Gate 1 Static Contract Diff confirmation (per `docs/ops/cutover-hard-gates.md` §3) closing the PR#17s §5.1 limitation that "live ThinSDK / ThinLayer assets on `buyerrecon.com` are not present in this [collector] repo." PR#17t inspects the **source-of-truth website repo** (`/Users/admin/github/buyerrecon-website` on the local environment) containing the actual ThinLayer bundle files, on the production-live snapshot branch `production-live-20260508`.

### 2.2 What PR#17t is not

- Not Gate 2 (controlled fixture dry-run against staging collector).
- Not Gate 3 (runtime privilege simulation under production-equivalent least-privilege role).
- Not Gate 4 (route readiness, bundle deploy, endpointUrl re-flip, controlled event proof, passive organic observation, Track A) — all of those remain future-gated, each requiring its own explicit Helen GO.
- Not a write-smoke. No HTTP request was issued by PR#17t against any production or staging surface.
- Not a host-side bundle hash check. The actual `/var/www/buyerrecon.com/html/thinlayer/*` files on the production Hetzner host were **not** inspected by PR#17t (see §3.2). PR#17t inspects the website repo's `production-live-20260508` snapshot as a high-confidence proxy and explicitly names the host-side hash cross-check as a remaining verification step (§13.1, §16.2).

### 2.3 Mandatory reference compliance

- `cutover-hard-gates.md` §3 (Gate 1 — Static Contract Diff): PR#17t produces the categorical written comparison table (§7–§10) called for in §3.2 of the standard, with no raw payloads.
- `cutover-hard-gates.md` §3.2 ("If the **exact** browser body is unknown, **stop**. Inspect with a controlled non-production fixture …"): PR#17t inspects the bundle source rather than running any controlled fixture; the inspection is read-only and produces categorical findings only.
- `cutover-hard-gates.md` §6 PR sequencing: PR#17t is the docs-only artefact preceding any Gate 1 fixture run or Gate 2 dry-run; both remain future-gated.
- `cutover-hard-gates.md` §8 stop-line conditions: PR#17t triggers no stop-line condition (no `500`, no `storage_failure`, no `permission denied`, no token print, no grant broadening).

---

## 3. Files inspected and access posture

### 3.1 What was accessible (and inspected)

The BuyerRecon website source-of-truth repo is locally cloned at `/Users/admin/github/buyerrecon-website` and currently checked out on branch `production-live-20260508` at HEAD `c477657` ("Add BuyerRecon refresh-loop telemetry signal"). The `thinlayer/` directory contains the actual deployed bundle files. All five files were inspected read-only on this branch:

| File | Path | Size (bytes) | mtime (local) | sha256 | Notes |
|---|---|---|---|---|---|
| `thin-sdk.iife.js` | `/Users/admin/github/buyerrecon-website/thinlayer/thin-sdk.iife.js` | 25984 | 2026-05-08T21:14:09Z | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` | Minified IIFE; safe to hash (no secrets bundled). |
| `br-thinlayer-init.js` | `/Users/admin/github/buyerrecon-website/thinlayer/br-thinlayer-init.js` | 4255 | 2026-05-08T21:14:09Z | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` | Per-site init/config script; **no token-like value present** (see §9.2). Safe to hash. |
| `buyerrecon-adapter.iife.js` | `/Users/admin/github/buyerrecon-website/thinlayer/buyerrecon-adapter.iife.js` | 47544 | 2026-05-08T21:14:09Z | `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a` | Minified IIFE; contains context-classification logic (CTA / form / page groups). Safe to hash. |
| `br-probe-init.js` | `/Users/admin/github/buyerrecon-website/thinlayer/br-probe-init.js` | 1351 | 2026-05-08T21:14:09Z | `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` | Probe init (separate concern from ThinLayer; documented for completeness). Safe to hash. |
| `br-probe.iife.js` | `/Users/admin/github/buyerrecon-website/thinlayer/br-probe.iife.js` | 9420 | 2026-05-08T21:14:09Z | `339921e603aface0df8fb620309519bc44fe84e0833bb7bcce063da84c2e5dd9` | Probe bundle; not in the task's listed file set but adjacent. Hashed for completeness. |

All file metadata captured via `stat -f%z` (size), `stat -f%Sm` (mtime), `shasum -a 256` (hash). **No raw bundle bytes were copied into this repo, into chat, or into any PR#17t artefact** — the files remain in the buyerrecon-website working tree.

### 3.2 What was NOT accessible

- **The actual production-deployed bundle at `/var/www/buyerrecon.com/html/thinlayer/*`** on the Hetzner host was **not inspected** by PR#17t. That path does not exist on the local environment (`ls /var/www` returns `No such file or directory`). A host-side `sha256sum /var/www/buyerrecon.com/html/thinlayer/*.js` cross-check against the §3.1 hashes is a separate read-only step that requires production host access under its own GO (see §13.1).
- **The production collector process environment** (whether `ENABLE_V1_BATCH=true`, the collector's actual `event_contract_version` config, etc.) — not inspected by PR#17t.
- **The production Nginx config beyond what PR#17o §5 / §8 recorded** — not re-inspected.
- **The production DB** — no `psql`, no query, no read of any kind. Evidence values from PR#17p / PR#17q / PR#17s are quoted categorically as inputs, not re-observed.

### 3.3 Why the local snapshot is a strong (but not perfect) proxy

- The branch name `production-live-20260508` and the consistent mtime of 2026-05-08T21:14:09Z across all five files indicate a coordinated production snapshot taken on that date.
- The `endpointUrl` literal in `br-thinlayer-init.js` at the inspected HEAD is `https://buyerrecon-backend.onrender.com/collect` — exactly the current rollback state documented in PR#17p §4 / PR#17s §4. This is consistent with the production host's current ThinLayer init file *after* PR#17p's rollback (PR#17p flipped the endpoint then rolled back to Render legacy on the production host; the website repo snapshot here pre-dates PR#17p).
- The bundle files themselves (`thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, `br-probe-init.js`, `br-probe.iife.js`) are **transport-and-shape implementations**, not config — they emit whatever shape is compiled into them. PR#17p only edited `br-thinlayer-init.js`'s `endpointUrl` literal; the four bundle files were not in PR#17p's scope. Therefore the bundle files in the §3.1 snapshot are a high-confidence proxy for the bundles on the production host today, modulo a host-side hash check (§13.1).

---

## 4. Current rollback / endpoint posture

PR#17t does **not** alter the posture. The posture in force at the moment PR#17t is written:

- **`buyerrecon.com` ThinLayer `endpointUrl` = `https://buyerrecon-backend.onrender.com/collect`** (Render legacy collector). Confirmed by the literal at `br-thinlayer-init.js:76` of the snapshot inspected.
- **The Sprint 2 production collector on Hetzner** remains `active` on `127.0.0.1:3073`. PR#17o's Nginx `location = /v1/event` route stays as deployed.
- **PR#17q column-level grants** stand. No broadening of `buyerrecon_prod_collector_app`. Lane A/B grant safety intact.
- **The 26 `ingest_requests` evidence rows** (`auth_status=ok`, `http_status=400`, `reject_reason_code=request_body_invalid_json`, `workspace_id=keigen_prod_ws`, `site_id=buyerrecon_com`) are preserved.
- **`br-probe-init.js` configures `apiBase: 'https://buyerrecon-backend.onrender.com'`** (probe-side traffic remains on Render legacy; out of PR#17t's contract-alignment scope).
- No Track A, no Playwright, no synthetic write smoke, no Lane A/B writer, no Trust Core exposure, no Pass 1 / Pass 2.

Rollback to Render legacy is the steady state and remains the one-step revert target throughout any downstream implementation PR (per `cutover-hard-gates.md` §6 sequencing).

---

## 5. Static script wiring

### 5.1 Initialisation flow (categorical, from `br-thinlayer-init.js`)

The init file is wrapped in an IIFE that runs on page load. Inspected lines (file is 118 lines total):

1. **Lines 1–9 (header docblock):** declares `Schema: thin.v2.0`, `Transport: beacon (events sent to buyerrecon-backend.onrender.com)`, `Adapter: buyerrecon_web (SDK + adapter — only site with adapter)`. Names consent gate `window.buyerreconConsent.check()` and a kill switch (`window.__BR_THIN_DISABLED`).
2. **Lines 10–20 (IIFE entry):** opens `(function () { 'use strict'; …`; checks for the kill switch; checks for `legal` paths (regex `LEGAL_PATH_PATTERNS = [/^\/legal(\/|$)/]`); returns early if the page is a legal page.
3. **Line 21 (SITE_CONFIG opens):** `var SITE_CONFIG = { … }`. Declares `site_id: 'buyerrecon_com'`, `adapter_id: 'buyerrecon_web'`, `adapter_version: '1.0.0'`, plus route normalisation (`strip_query`, `strip_hash`, `trailing_slash_policy: 'remove'`), `allowlisted_query_keys`, `sensitive_query_key_denylist`, `page_groups`, `cta_selectors`, `form_selectors`, `ga4_policy`, `whitepaper_gate`, etc. **No token-like value appears in `SITE_CONFIG` or anywhere in `br-thinlayer-init.js`** (see §9.2).
4. **Lines 70–72 (start guard):** `if (window.__brThinStarted) return; window.__brThinStarted = true;` — single-init guard.
5. **Lines 73–84 (ThinSDK.init call):**
   ```
   var collector = ThinSDK.init({
     siteId: SITE_CONFIG.site_id,                                  // 'buyerrecon_com'
     transport: 'fetch',                                           // selects FetchTransport
     endpointUrl: 'https://buyerrecon-backend.onrender.com/collect',  // Render legacy
     jurisdictionHint: 'uk',
     consentSignal: function () { return … 'granted' : 'pending'; },
     ga4DetectMode: SITE_CONFIG.ga4_policy.detect_mode,
     samplingRate: 1.0
   });
   ```
6. **Lines 86–87 (adapter wiring):**
   ```
   var adapter = new BuyerReconAdapter.BuyerReconAdapter(SITE_CONFIG);
   collector.setAdapter(adapter);
   ```
7. **Line 89 (start):** `collector.start();`

### 5.2 HTML inclusion order

PR#17t did **not** inspect every page's HTML to confirm script-tag ordering (the website repo has many HTML files; categorical confirmation that `thin-sdk.iife.js` is loaded before `buyerrecon-adapter.iife.js` before `br-thinlayer-init.js` was not exhaustively checked). The init file presumes globals `ThinSDK`, `BuyerReconAdapter`, `buyerreconConsent`, and (separately) `BRProbe` — so the page must load `thin-sdk.iife.js` and `buyerrecon-adapter.iife.js` before `br-thinlayer-init.js`. This is a configuration assumption inside the bundle, not a PR#17t observation.

### 5.3 Probe-side wiring (out of scope but documented)

`br-probe-init.js` (33 lines, listed in §3.1) initialises a separate probe via `BRProbe.init({ siteId: 'buyerrecon_com', apiBase: 'https://buyerrecon-backend.onrender.com', pageGroup: … })`. The probe path is a distinct concern from the ThinLayer event-emission path that PR#17t is investigating. Probe-side traffic continues to land on Render legacy and is not affected by PR#17t.

---

## 6. Transport and Content-Type

### 6.1 Transport class enumeration (from `thin-sdk.iife.js`)

The bundle exports (categorical, from the IIFE's `__esModule` registration):
- `BeaconTransport` (alias `D`).
- `FetchTransport` (alias `F`).
- `MockTransport` (alias `E`).
- `createTransport` (alias `L`).

The init config (§5.1 line 75) passes `transport: 'fetch'` — selecting `FetchTransport` at runtime.

### 6.2 Transport classes and configured runtime path (categorical, decoded from minified bundle)

`thin-sdk.iife.js` defines **two distinct transport classes**, each with its own `flush()` method. The `createTransport` factory (`function L(n, e, t)` in the minified bundle) selects between them by string:

```javascript
function createTransport(kind, endpointUrl, batchConfig) {
  switch (kind) {
    case "mock":   return new MockTransport();
    case "beacon": return new BeaconTransport(endpointUrl, batchConfig);
    case "fetch":  return new FetchTransport(endpointUrl, batchConfig);
    default:       return new MockTransport();
  }
}
```

`br-thinlayer-init.js` line 75 passes `transport: 'fetch'`, so the **configured runtime path is `FetchTransport`**.

#### 6.2.1 FetchTransport.flush() — the configured runtime path

Decoded categorical structure (the path actually used by `buyerrecon.com`):

```javascript
// FetchTransport (configured)
flush() {
  if (this.queue.length === 0) return;
  let e = this.queue.splice(0),               // e is an Array of queued events
      t = JSON.stringify(e);                  // t is a string serialisation of that ARRAY
  fetch(this.endpointUrl, {
    method: "POST",
    body: t,
    headers: { "Content-Type": "application/json" },
    keepalive: true
  }).catch(() => {});
}
```

`FetchTransport` does **not** construct a `Blob` and does **not** call `navigator.sendBeacon`. There is no Beacon/fetch fallback chain on this path — `fetch` is the only mechanism.

#### 6.2.2 BeaconTransport.flush() — present in bundle, NOT selected by current init

Decoded categorical structure for `BeaconTransport`, included for completeness:

```javascript
// BeaconTransport (bundle-available; NOT selected by br-thinlayer-init.js)
flush() {
  if (this.queue.length === 0) return;
  let e = this.queue.splice(0),
      t = JSON.stringify(e),                  // also a top-level ARRAY serialisation
      r = new Blob([t], { type: "application/json" });
  typeof navigator !== "undefined"
    && navigator.sendBeacon
    && navigator.sendBeacon(this.endpointUrl, r)
  || typeof fetch !== "undefined"
    && fetch(this.endpointUrl, {
         method: "POST",
         body: t,
         headers: { "Content-Type": "application/json" },
         keepalive: true
       }).catch(() => {});
}
```

`BeaconTransport` would also emit a top-level JSON array body, but it is **not the configured `buyerrecon.com` runtime path** under the inspected init file. Inspecting it here only documents that **both** transport implementations available in the bundle would produce the same top-level-array body shape — switching the init to `transport: 'beacon'` would not change the array-vs-object outcome.

#### 6.2.3 Categorical observations (configured FetchTransport runtime path)

| Aspect | Categorical value | Source |
|---|---|---|
| Configured runtime transport | `FetchTransport` (selected by `br-thinlayer-init.js:75` via `transport: 'fetch'`) | `thin-sdk.iife.js` `createTransport`; `br-thinlayer-init.js:75` |
| Transport mechanism on the configured path | `fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })` | `thin-sdk.iife.js` (decoded `FetchTransport.flush`) |
| `Blob` use on the configured path | **None.** `FetchTransport` does not construct a Blob. | same |
| `navigator.sendBeacon` use on the configured path | **None.** `FetchTransport` does not call `sendBeacon`. | same |
| Body construction | `JSON.stringify(<queue array>)` — queue is drained as a JavaScript array | same |
| `Content-Type` shipped | `application/json` (explicit `headers` map; no charset suffix) | same |
| `keepalive` | `true` | same |
| Charset suffix | Not set (the parser accepts the no-charset form per `src/collector/v1/envelope.ts:64–71`) | same |
| Empty-body guard | `if (this.queue.length === 0) return;` — no flush on empty queue | same |
| Batch semantics | Yes — the queue accumulates events client-side and is flushed as a batch | same |
| `BeaconTransport` runtime status | Bundle-available, **not selected by current init config** — switching to it would not change the array-body shape | same |

### 6.3 What this means for Sprint 2 `/v1/event`

The transport's `Content-Type: application/json` is **accepted** by Sprint 2's envelope parser (per `src/collector/v1/envelope.ts:64–71`, which accepts `application/json` with optional charset). This is consistent with the observed `auth_status=ok` × 26 and `reject_reason_code=request_body_invalid_json` × 26 — the request reached the parser (Content-Type was acceptable, auth passed, body wrote to `ingest_requests`), and the parser rejected at the top-level-shape check.

PR#17s H3 / H4 / H9 / H10 (Content-Type or charset issues) are **eliminated** as the primary cause: the live bundle ships exactly `application/json` with no charset suffix and no surprising body-parser dependency.

---

## 7. Body construction and top-level JSON shape

### 7.1 Top-level body shape (categorical)

**The live ThinSDK emits a top-level JSON ARRAY.**

Direct evidence from `thin-sdk.iife.js` (categorical decode, §6.2):

- `flush()` calls `let e = this.queue.splice(0)` — drains the entire queue into a JavaScript Array.
- `let t = JSON.stringify(e)` — serialises that Array; the resulting string starts with `[` and ends with `]`.
- That serialised array is the body sent to `fetch(this.endpointUrl, { method: "POST", body: t, headers: { "Content-Type": "application/json" }, keepalive: true })` on the **configured runtime path** (`FetchTransport`, selected by `br-thinlayer-init.js:75` via `transport: 'fetch'`). The configured path does not use `navigator.sendBeacon` or `Blob`. (`BeaconTransport` is present in the bundle and would emit the same top-level array via `sendBeacon` + Blob, but is not selected by the current init config — see §6.2.2.)

### 7.2 No `{ events: [...] }` wrapper

Confirmed by exhaustive search across the three bundle files:

| Pattern | thin-sdk.iife.js | buyerrecon-adapter.iife.js | br-thinlayer-init.js |
|---|---|---|---|
| `"events":` (the `/v1/batch` wrapper key) | 0 occurrences | 0 occurrences | 0 occurrences |
| Any object-wrapping construct around the queue | (none observed in the decoded `flush()` path) | (adapter does not modify transport body) | (init does not modify transport body) |

The bundle does **not** wrap as `{ "events": [ … ] }`. A raw top-level array is the only emitted body shape.

### 7.3 Implication for `/v1/event` parsing

`src/collector/v1/envelope.ts:97–112` rejects any top-level array sent to `/v1/event` with `reject_reason_code = request_body_invalid_json` and HTTP `400`. This is precisely what the 26 evidence rows record. **H1 is directly confirmed.**

### 7.4 Implication for `/v1/batch` parsing

`src/collector/v1/envelope.ts:106–112` also rejects a raw top-level array sent to `/v1/batch` (it expects `{ events: [ … ] }`). So pointing the same bundle at `/v1/batch` (Option B) would **also** fail with `request_body_invalid_json` — the bundle must change either way.

### 7.5 No double-encoding

The body is `JSON.stringify(queueArray)` — a single stringify call. There is no `JSON.stringify(JSON.stringify(...))` and no string-typed body wrapping. PR#17s H5 (double-encoded JSON) is **eliminated**.

### 7.6 No empty / undefined fallback body

The transport's empty-queue guard (`if (this.queue.length === 0) return;`) prevents an empty-body request from being issued. PR#17s H6 (empty body on a fallback transport path) is **eliminated** for this transport implementation.

### 7.7 No consent-gated shell envelope

The collector emits events only when sampled in AND consent is granted (`send(e) { this.sampledIn && H() && this.transport.send(e); }`, where `H()` checks `f() === "granted"`). There is no "consent-pending shell" event with a different shape. PR#17s H11 is **eliminated**.

---

## 8. Field-shape observation

### 8.1 Live ThinSDK envelope shape (categorical, decoded from `thin-sdk.iife.js`)

The collector class's `envelope(event_type, client_timestamp_ms, path)` function returns the following object per event (categorical, decoded):

```
{
  event_schema_version:           "thin.v2.0",           // legacy field name
  event_type:                     <legacy taxonomy>,     // see §8.2
  client_timestamp_ms:            <number, epoch-ms>,
  collector_timestamp_ms:         <number, epoch-ms>,
  consent_signal:                 <"granted" | "pending">,
  jurisdiction_hint:              "uk" (from init),
  site_id:                        "buyerrecon_com",
  hostname:                       <window.location.hostname>,
  path:                           <normalized path>,
  anon_session_id:                <session id>,
  anon_browser_id:                <browser id>,
  ga4_present:                    <boolean>,
  ga4_measurement_id_present:     <boolean>,
  adapter_id:                     "buyerrecon_web",
  adapter_version:                "1.0.0"
}
```

Additional fields added per event type (categorical, decoded): `source_context`, `session_continuity`, `client_envelope`, `adapter_context` (CTA / form / page groups via the adapter), `engagement_proxy`, `velocity_and_repetition`. Adapter-context fields are prefixed `adapter_*` (e.g. `adapter_cta_group`, `adapter_form_group`, `adapter_page_group`, `adapter_progress_stage`, `adapter_value_path_seen`).

### 8.2 Event-type taxonomy (legacy, NOT Sprint 2)

The collector's `emit*` methods produce the following event types (categorical, from the bundle):

- `session_start`
- `page_state`
- `session_summary`
- (per emit methods observed) `form_submit`, `form_start`, `cta_click`, `page_view`, `generate_lead`-style emissions (full mapping in the adapter).

This taxonomy matches `src/collector/validate.ts:121–125` (legacy `/collect` valid event types `{ session_start, page_state, session_summary, page_view, cta_click, form_start, form_submit, generate_lead }`) and does **not** overlap with Sprint 2's `{ page, track, identify, group, system, debug }` (`src/collector/v1/validation.ts:45–52`).

### 8.3 Sprint 2 required fields — absence matrix

Exhaustive count of Sprint 2 required field names across all three bundle files:

| Sprint 2 required field | thin-sdk.iife.js | buyerrecon-adapter.iife.js | br-thinlayer-init.js | Total |
|---|---|---|---|---|
| `event_name` | 0 | 0 | 0 | **0** |
| `schema_key` | 0 | 0 | 0 | **0** |
| `schema_version` (Sprint 2's exact key, distinct from legacy `event_schema_version`) | 0 | 0 | 0 | **0** |
| `event_origin` | 0 | 0 | 0 | **0** |
| `occurred_at` | 0 | 0 | 0 | **0** |
| `client_event_id` | 0 | 0 | 0 | **0** |
| `page_view_id` | 0 | 0 | 0 | **0** |
| `workspace_id` | 0 | 0 | 0 | **0** |

**Every Sprint 2 required event field is missing from the live bundle.** The bundle uses the legacy field names instead:

| Sprint 2 required (missing) | Legacy field present in bundle | Count (across all files) |
|---|---|---|
| `event_origin` | (no equivalent — origin is implicit from legacy `event_type`) | n/a |
| `event_name` | (no equivalent — the legacy contract uses `event_type` alone) | n/a |
| `schema_key` | (no equivalent in legacy contract) | n/a |
| `schema_version` | `event_schema_version` (legacy field name) | 2 |
| `client_event_id` | (not emitted by SDK envelope; legacy `/collect` makes it conditionally required for new-canonical event types only) | 0 |
| `occurred_at` | `client_timestamp_ms` (also `collector_timestamp_ms`) | 2 |
| `session_id` (Sprint 2) | `anon_session_id` (legacy) | 2 |
| `workspace_id` | (absent — Sprint 2 derives it from token binding; legacy has no equivalent) | 0 |

### 8.4 Schema version stamp

The bundle declares `var I = "thin.v2.0";` and emits it under the legacy key `event_schema_version`. Sprint 2 expects the field name `schema_version` with a three-component semver (`/^\d+\.\d+\.\d+$/`, per `src/collector/v1/validation.ts:71–72`). `"thin.v2.0"` is **not** a three-component semver — it would also fail Sprint 2's `schema_version_malformed` check even if the field name were corrected (because of the `thin.` prefix and the `v2.0` two-component suffix).

### 8.5 Adapter contribution

`buyerrecon-adapter.iife.js` adds **context** (CTA / form / page groups, dwell / scroll / interaction buckets, source context) via `adapter_cta_group`, `adapter_form_group`, `adapter_page_group`, `adapter_progress_stage`, `adapter_value_path_seen`. The adapter does **not** add any Sprint 2 required field. It does **not** modify the transport body. It does **not** wrap events in a Sprint 2 envelope.

---

## 9. Auth / token-binding observation (redacted)

### 9.1 Client-side auth header presence

Exhaustive search across all three bundle files for client-side auth header names and bearer-token patterns:

| Pattern | thin-sdk.iife.js | buyerrecon-adapter.iife.js | br-thinlayer-init.js |
|---|---|---|---|
| `Authorization` | 0 | 0 | 0 |
| `Bearer` | 0 | 0 | 0 |
| `X-Site-Write-Token` | 0 | 0 | 0 |
| Any `X-*` custom header | 0 | 0 | 0 |

**The live ThinSDK does not attach any auth header to the outgoing request.** The bundle ships a body and a `Content-Type: application/json` header, and that's it.

### 9.2 Token-like config presence

Exhaustive search for `token` / `writeToken` / `siteWriteToken` / `apiKey` / `api_key` / `secret` / `Bearer` / `Authorization` substrings in `br-thinlayer-init.js`:

- One match found at `br-thinlayer-init.js:34` — the literal string `'token'` inside the `sensitive_query_key_denylist` array (a SDK feature that strips `?token=…` from page URLs before emission, to prevent leaked tokens in query strings). **This is a redaction-list entry, not a stored token.**
- **Zero occurrences** of any stored token, token prefix / suffix, token hash, raw secret, DSN, password, pepper, certificate / private-key material, or private IP in any of the inspected files.
- **Redaction posture: passed.** Nothing in the bundle would have been printed, pasted, copied, committed, or included in any PR#17t artefact even if not actively redacted.

### 9.3 How the 26 evidence rows passed `auth_status=ok`

Because the client emits no auth header, the only way the post-PR#17q POSTs could have shown `auth_status=ok` with `site_write_tokens_used=1` is that **Nginx injected the production token snippet on the server side** per PR#17o §6 (`location = /v1/event` includes `/etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf`, which adds the `Authorization: Bearer …` header upstream). This was already documented in PR#17o; PR#17t now confirms categorically that the client is **dependent on Nginx-side token injection** — the ThinSDK does not (and currently cannot) authenticate to `/v1/event` on its own.

**Implication for any downstream Option A implementation:** the ThinSDK bundle update can omit the token from the client (preserving the Nginx-side injection model), OR can add a header. The current rollback posture continues to use Nginx-side injection.

### 9.4 What was NOT printed

No raw token value, no token prefix / suffix, no token hash, no token length, no token byte-distribution, no pepper, no DSN, no password, no certificate body, no private IP, no host body, no raw payload, no raw customer data appears anywhere in this doc, in chat, in repo files, in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17t.

---

## 10. Comparison to PR#17s hypotheses

For each PR#17s hypothesis (H1–H11), PR#17t records whether the live bundle inspection **confirms**, **weakens**, or **eliminates** it.

| ID | PR#17s hypothesis | PR#17t verdict | Source citation |
|---|---|---|---|
| **H1** | ThinSDK emits a top-level JSON array; Sprint 2 `/v1/event` expects a single JSON object | **CONFIRMED — direct.** On the configured runtime path (`FetchTransport`, selected by `br-thinlayer-init.js:75` via `transport: 'fetch'`), `flush()` calls `JSON.stringify(<queue array>)` and ships the result via `fetch(endpointUrl, { method: 'POST', body: t, headers: { 'Content-Type': 'application/json' }, keepalive: true })`. (The bundle-available `BeaconTransport` would also emit a top-level array but is not selected by current init.) | §6.2.1, §7.1 |
| **H2** | `JSON.parse()` exception (malformed JSON in the raw Buffer) | **Eliminated as primary.** The bundle constructs well-formed JSON via `JSON.stringify` — the resulting string parses cleanly; `JSON.parse` succeeds and returns an Array, which is then rejected at the top-level-shape check. | §7.1, §7.5 |
| **H3** | Beacon Blob with non-JSON `Content-Type` (`text/plain`, etc.) | **Eliminated.** The configured runtime path is `FetchTransport`, which does not construct a Blob and does not call `sendBeacon`; it sets `Content-Type: application/json` explicitly on the `fetch` call. (The bundle-available `BeaconTransport` does construct `new Blob([t], { type: "application/json" })`, but it is not selected by current init — and even if it were, the explicit Blob `type` would carry the correct `Content-Type`.) | §6.2.1 / §6.2.2 |
| **H4** | Body-parser content-type strictness (charset mismatch) | **Eliminated.** No charset suffix is shipped; the parser accepts the no-charset form. | §6.3 |
| **H5** | Double-encoded JSON | **Eliminated.** `JSON.stringify` is called exactly once on the queue. | §7.5 |
| **H6** | Empty / undefined body on a fallback transport path | **Eliminated.** `if (this.queue.length === 0) return;` guard prevents empty-queue flushes. | §7.6 |
| **H7** | Malformed / partial body (network truncation) | **Eliminated.** Bundle construction is deterministic; truncation would not produce uniform 26-row pattern. | n/a (consistent with PR#17s §10.3) |
| **H8** | Legacy envelope wrapping (top-level object but with legacy field names) | **Confirmed as the second-wave mismatch.** The bundle emits the legacy envelope shape (`event_schema_version`, `client_timestamp_ms`, `consent_signal`, `anon_session_id`, `anon_browser_id`, legacy `event_type` taxonomy, etc.) — not the Sprint 2 envelope. This is the second-wave failure that would surface once H1 is fixed: per-event rejection on `event_name_invalid` / `schema_unknown` / `schema_version_malformed` / `client_event_id_missing` / `event_origin_invalid` / `event_type_invalid`. | §8.1, §8.2, §8.3 |
| **H9** | Wrong endpoint chosen (`/v1/event` when ThinSDK should hit `/v1/batch`) | **Eliminated as a "free" fix.** Pointing the same bundle at `/v1/batch` would still fail: `/v1/batch` expects `{ events: [...] }` (object wrapper), not a raw top-level array. Bundle must change either way. Option B remains theoretically available but does not avoid the client-side update. | §7.4 |
| **H10** | Charset / body-parser edge case (UTF-16 BOM, gzip-without-`Content-Encoding`, etc.) | **Eliminated.** No charset suffix, no compression header, no BOM. | §6.2 |
| **H11** | Consent-gated shell envelope | **Eliminated.** Consent gate is a boolean check (`H()`) that prevents emission entirely when consent is not granted — there is no "shell" event with a different shape. | §7.7 |

---

## 11. H1 confirmation status

**H1 is CONFIRMED.** Direct source evidence (§6.2.1, §7.1) shows the live ThinSDK at the `production-live-20260508` snapshot emits a top-level JSON array via the **configured `FetchTransport` runtime path** (selected by `br-thinlayer-init.js:75` via `transport: 'fetch'`): `JSON.stringify(<queue array>)` sent through `fetch(endpointUrl, { method: 'POST', body: t, headers: { 'Content-Type': 'application/json' }, keepalive: true })`. The configured path does not use `navigator.sendBeacon` or `Blob`. The bundle-available `BeaconTransport` would also emit a top-level array but is not the selected runtime path under the inspected init (§6.2.2). Sprint 2 `/v1/event` rejects top-level arrays at the parser stage (`src/collector/v1/envelope.ts:97–112`). The 26 `request_body_invalid_json` evidence rows from PR#17p / PR#17q are categorically explained by this mismatch.

**H8 is ALSO CONFIRMED as the second-wave mismatch** that will surface once H1 is fixed: the bundle uses the legacy envelope field set (no `event_name`, `schema_key`, `schema_version`, `event_origin`, `occurred_at`, `client_event_id`, `workspace_id`) — every Sprint 2 required field is absent (§8.3). A naive adapter that fixes only the array-vs-object envelope but keeps legacy field names would move the failure from envelope-stage (`request_body_invalid_json` in `ingest_requests`) to per-event (`event_name_invalid` / `schema_unknown` / `schema_version_malformed` / `client_event_id_missing` / `event_origin_invalid` / `event_type_invalid` in `rejected_events`).

**All other hypotheses (H2–H7, H9–H11) are eliminated** as primary causes (§10). No further hypothesis surfaced during the inspection.

The PR#17s §15.3 limitation — "§5 ThinSDK shape is inferred, not observed" — is now closed against the `production-live-20260508` website-repo snapshot. The remaining residual gap is the host-side hash cross-check (§13.1) confirming the deployed bundle on `/var/www/buyerrecon.com/html/thinlayer/*` is byte-identical to the §3.1 hashes.

---

## 12. Recommended next implementation path

### 12.1 Recommendation

**Option A — Update ThinSDK / adapter output to the Sprint 2 `/v1/event` shape.** Per PR#17r §8 and PR#17s §11.

### 12.2 Concrete scope of the Option A bundle update

The update must reconcile **both** the envelope mismatch and the second-wave field-name mismatch in a single coordinated change. Concretely, the bundle update must:

1. **Change the transport `flush()` shape** from `JSON.stringify(<queue array>)` to one of:
   - `JSON.stringify(<single event object>)` per POST (one event per HTTP request — simplest; matches `/v1/event` directly), **or**
   - `JSON.stringify({ events: <queue array> })` per POST (preserves batch transport; requires `/v1/batch` + `ENABLE_V1_BATCH=true` + new Nginx route — Option B path).

2. **Rebuild the per-event envelope** so each event object emitted carries Sprint 2's required field names with valid types:
   - `event_type` ∈ `{ page, track, identify, group, system, debug }` — map legacy `session_start` / `page_state` / `session_summary` / `page_view` / `cta_click` / `form_start` / `form_submit` / `generate_lead` to Sprint 2 enum values.
   - `event_origin` ∈ `{ browser, server, system }` — emit `"browser"` for the ThinSDK path.
   - `event_name` — non-empty string (e.g. the legacy `event_type` value, or a per-event-name string).
   - `schema_key` — non-empty string.
   - `schema_version` — three-component semver (e.g. `"2.0.0"`), **not** `"thin.v2.0"`.
   - `client_event_id` — UUIDv4 or UUIDv7 (the SDK must generate one per event; legacy bundle does not).
   - `occurred_at` — ISO-8601 string OR epoch-ms number (current `client_timestamp_ms` is reusable directly).
   - `session_id` — non-empty string for browser-origin events (rename legacy `anon_session_id` to `session_id`).
   - All other current envelope fields (hostname, path, ga4_*, adapter_*, consent_state*, jurisdiction_hint, etc.) may continue to be emitted as additional fields — Sprint 2's validator extracts only the required set and tolerates extra fields.

3. **Preserve the consent gate, sampling gate, and adapter wiring** — none of these are causes of the current failure, and changing them is out of Option A's scope.

4. **Preserve the configured `FetchTransport` runtime path** — `fetch(endpointUrl, { method: 'POST', body: …, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})` — best-effort fire-and-forget on the keepalive flag, no response-body inspection by the SDK. Switching to `BeaconTransport` (or adding `navigator.sendBeacon` as a fallback to `FetchTransport`) is **optional future transport work** and is not part of Option A's contract-alignment scope; if a later PR intentionally changes transport selection, that PR must carry its own Gate 1 / Gate 2 proofs for the new transport.

5. **Coordinate with the Nginx-side token injection model** — PR#17o's token snippet remains in force. The ThinSDK does not need to add an `Authorization` header itself; the token is added upstream by Nginx. This stays unchanged for `buyerrecon.com`.

### 12.3 Why not Option B (`/v1/batch`)

Per PR#17s §11.3 and PR#17t §7.4: pointing the same bundle at `/v1/batch` requires the client to wrap as `{ events: [...] }`, plus an `ENABLE_V1_BATCH=true` env-flag change (separate GO), plus a new `location = /v1/batch` Nginx route (separate GO + Gate 4 PR A proof). Option B does **not** avoid the client-side change; it only moves it. Option A is strictly cheaper on the server side.

Option B remains **theoretically available** but PR#17t does not recommend it.

### 12.4 Why not Option C (server-side adapter)

Per PR#17s §11.4: a server-side `POST /v1/event-legacy` adapter could accept the legacy shape and map it to the canonical Sprint 2 envelope. But the bundle update is needed anyway (to surface `client_event_id` as a UUID — the legacy bundle emits no `client_event_id` at all; the adapter would have to synthesize one server-side, which weakens the audit trail). Option C also requires a retirement plan from day one. Net work: higher than Option A unless the bundle-update friction is prohibitive.

Option C remains **theoretically available** but PR#17t does not recommend it.

### 12.5 Why not Option D (stay on Render legacy)

Per PR#17s §11.5: Option D is the current rollback posture, not a solution. It remains the steady state until Option A is proven through gates.

### 12.6 Suggested downstream PR sequence (under `cutover-hard-gates.md` §6)

Each step requires its own explicit Helen GO. None of the steps below are pre-authorised by PR#17t.

1. **PR#17u (proposed)** — Option A implementation: update `thin-sdk.iife.js` and `br-thinlayer-init.js` (and any adapter contract changes) to emit the Sprint 2 envelope. Includes unit tests against a mocked `fetch` asserting byte-for-byte the new `FetchTransport.flush()` body shape, `Content-Type: application/json`, `keepalive: true`, and headers — i.e. tests for the configured `transport: 'fetch'` runtime path. Tests for `BeaconTransport` (mocked `navigator.sendBeacon`) are **bundle-available but not configured live path**: they may be retained for transport-class coverage but should be clearly labelled as not on the `buyerrecon.com` runtime path under the current init. Any deliberate transport-selection change (e.g. switching to `transport: 'beacon'` or adding a `sendBeacon` fallback to `FetchTransport`) is **optional future work** with its own Gate 1 / Gate 2 proofs. No production deployment by this PR.
2. **PR#17v (proposed)** — Gate 2 controlled fixture dry-run against a staging Sprint 2 collector instance. No production traffic.
3. **PR#17w (proposed)** — Gate 3 runtime privilege simulation under a disposable / staging DB role mirroring `buyerrecon_prod_collector_app`'s PR#17q steady-state grant matrix. Confirm no `storage_failure`, no `permission denied`, no grant broadening, no Lane A/B grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`.
4. **PR#17x (proposed)** — Gate 4 PR B execution: deploy the updated bundle to the production host on `buyerrecon.com`, leaving `endpointUrl` on Render legacy. Confirms the bundle is served correctly.
5. **PR#17y (proposed)** — Gate 4 PR C execution: under a separate explicit Helen GO, re-flip `endpointUrl` to `https://buyerrecon.com/v1/event` and observe **one** controlled human page-load. Expected: HTTP 200, `accepted_events` increment, no `request_body_invalid_json`, no per-event reject reasons.
6. **PR#17z (proposed)** — Gate 4 PR D execution: passive organic observation window. **NO_EVENT_YET is not failure if no event was expected or observed.**
7. Track A (Gate 4 PR E) remains gated under PR#17e (or successor); not invoked by any of the above.

---

## 13. Required proof gates before any endpointUrl re-flip

Before any `endpointUrl` re-flip on `buyerrecon.com`, the downstream implementation PR(s) must close every gate. Each is named in `docs/ops/cutover-hard-gates.md`; cross-references explicit.

### 13.1 Host-side bundle hash cross-check (PR#17t residual)

A read-only host-side check is required to confirm the bundles at `/var/www/buyerrecon.com/html/thinlayer/*.js` are byte-identical to the §3.1 hashes. Suggested categorical commands (NOT to be run by PR#17t; documented for the host-side step):

```
$ sha256sum /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js
$ sha256sum /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js
$ sha256sum /var/www/buyerrecon.com/html/thinlayer/buyerrecon-adapter.iife.js
$ sha256sum /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js
```

Expected results:
- `thin-sdk.iife.js` → `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`
- `buyerrecon-adapter.iife.js` → `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a`
- `br-probe-init.js` → `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`
- `br-thinlayer-init.js` → expected to **differ** from the §3.1 hash if PR#17p's endpointUrl flip-and-rollback edited the file on the production host without a re-deploy of the website repo. The host-side file's only difference should be the `endpointUrl` literal; the remaining 117 lines are expected to match. A categorical diff (no token print) under a separate GO can confirm.

If the host-side hashes match §3.1, the inference in this report is confirmed. If they diverge, the downstream PR must re-run §6–§8 against the actual host-side bundle before any re-flip.

### 13.2 Other gates (per `cutover-hard-gates.md`)

1. **Gate 1 — Static Contract Diff** (`cutover-hard-gates.md` §3): PR#17t is the current execution. §13.1 closes the residual host-side hash check.
2. **Gate 2 — Production-role dry-run without live traffic** (`cutover-hard-gates.md` §4): run the updated bundle against a staging or local Sprint 2 collector with a controlled non-customer fixture. No production traffic. **Do not delete failed canary evidence rows** from any earlier proof window.
3. **Gate 3 — Runtime privilege simulation** (`cutover-hard-gates.md` §5; PR#17r §11.4): exercise the actual SQL path under a disposable / staging DB role mirroring `buyerrecon_prod_collector_app`'s PR#17q steady-state grant matrix. No `storage_failure`, no `permission denied`, no table-wide `SELECT`, no Lane A/B grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`. **Do not broaden grants to make a proof pass.**
4. **Gate 4 — Separate route readiness from traffic cutover** (`cutover-hard-gates.md` §6): PR A → PR B → PR C → PR D → PR E sequence, each with its own GO.
5. **Explicit Helen GO before any endpointUrl re-flip.** **No endpointUrl re-flip is approved by PR#17t.**
6. **Rollback to Render legacy retained.** Restoring `endpointUrl` to `https://buyerrecon-backend.onrender.com/collect` remains the one-step revert at every gate.

---

## 14. Non-goals / boundaries

PR#17t explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **`endpointUrl` re-flip** on `buyerrecon.com` (or any other site). No endpointUrl re-flip is approved by PR#17t.
- **Nginx change** (no new `location`, no route deletion, no snippet edit, no `nginx -t`, no `systemctl reload nginx`).
- **DNS change.**
- **systemd change** (no service start, stop, restart, enable, disable; no `daemon-reload`; no unit edit).
- **DB action** (no `psql`, no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT`, `REVOKE`; no SELECT against any production DB).
- **DB grant change** (PR#17q's column-level grants stand; no broadening, no Lane A/B grants, no derived-table grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`).
- **Write smoke** (no `POST /v1/event`, no `POST /v1/batch`, no `POST /collect`, no `curl -X POST` against any production endpoint, no synthetic event generator).
- **`curl` against production** (no `curl -I`, no `curl -X GET`, no any-method curl against any production endpoint or production-host process).
- **Browser traffic generation** (no human page-load, no controlled browser visit, no automated browser, no Playwright, no headless run, no any client-side traffic generation against production).
- **Track A.**
- **Playwright.**
- **File edit under `/var/www`.** PR#17t makes no change to any file on any production host.
- **Copy of production bundles into the repo.** The buyerrecon-website source files inspected by PR#17t remain in the buyerrecon-website working tree; nothing was copied into `buyerrecon-backend`.
- **Commit of raw production bundles** to any repo. PR#17t's only commit (when authorised) is this single docs file.
- **Customer-facing output** (Pass 1 / Trust / Pass 2).
- **Lane A/B writer** (`scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-row).
- **AMS Trust Core exposure** through BuyerRecon.
- **Pass 1 / Pass 2 implementation.**
- **Render migration.** Render legacy collector remains the rollback target and is not migrated by PR#17t or any downstream PR.
- **Evidence-row deletion.** The 26 `ingest_requests` evidence rows are preserved.
- **Secrets in any artefact.** No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data appear anywhere in this doc, in chat, in repo files, in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17t.

---

## 15. Open decisions for Helen

PR#17t records the following decisions for Helen's review. None are pre-decided.

1. **Confirm Option A as the implementation track.** Or override to Option B (with the additional Nginx + env-flag GOs), Option C (with the retirement plan), or Option D (extended rollback posture).
2. **Host-side hash check (§13.1).** Authorise a separate read-only host-side `sha256sum` over `/var/www/buyerrecon.com/html/thinlayer/*.js` to confirm byte-equality with §3.1. Categorical-only; no host-side write; no service action.
3. **Where the Option A bundle update lands.** The `production-live-20260508` branch in the buyerrecon-website repo is the current snapshot. Option A's downstream PR will need to update `thin-sdk.iife.js`, `br-thinlayer-init.js`, and possibly `buyerrecon-adapter.iife.js`. Helen confirms the bundle source-of-truth branch and the deployment mechanism (is there an auto-deploy from a CI branch to `/var/www`, or is it a manual `scp` / `rsync`?).
4. **Five-site coordination.** Once the bundle is updated for `buyerrecon.com`, the same bundle (or coordinated bundles) needs to land on `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`. PR#17t did not inspect those sites' bundles. They may or may not share the same shape. Inspecting them is a separate Gate 1 confirmation under its own GO.
5. **Token model.** The current Nginx-side token-injection model (PR#17o §6) is preserved by Option A — the client emits no auth header. Helen confirms this remains the steady-state model post-cutover, or specifies a future migration to client-side auth.
6. **Schema version value.** Sprint 2 expects three-component semver. The bundle currently emits `"thin.v2.0"`. Helen confirms the target Sprint 2 `schema_version` value for `buyerrecon.com` events (e.g. `"2.0.0"`, `"1.0.0"`, etc.) and whether `schema_key` should be e.g. `"buyerrecon_web"` / `"thin_event_v2"`.
7. **`client_event_id` generation.** The legacy bundle does not emit `client_event_id`. The Option A update must add UUIDv4 or UUIDv7 generation client-side. Helen confirms the UUID flavour preference (UUIDv7 has time-ordering benefits; UUIDv4 is simpler).
8. **`event_type` enum mapping.** Helen confirms the mapping from legacy taxonomy (`page_view`, `cta_click`, `form_start`, `form_submit`, `generate_lead`, `session_start`, `page_state`, `session_summary`) to Sprint 2 enum (`{ page, track, identify, group, system, debug }`). One plausible mapping: `page_view` → `page`; `cta_click` / `form_start` / `form_submit` / `generate_lead` → `track`; `session_start` / `page_state` / `session_summary` → `track` or `system`. The mapping is Helen's call.
9. **Adapter context fields.** The current adapter emits `adapter_*` context fields. These are tolerated by Sprint 2 as extra fields (the validator extracts only required fields and ignores the rest). Helen confirms whether these should be retained, renamed, or migrated to a structured `payload` / `properties` envelope in the Option A update.

---

## 16. Appendix: redacted inspection commands and limitations

### 16.1 Inspection commands run (all read-only; no production action)

All commands executed locally on the macOS developer environment; none against any production host, production endpoint, or production DB. None modified any file in any working tree (read-only inspection).

| Command (categorical shape; arguments redacted where they contain unredacted file content cited above) | Purpose |
|---|---|
| `cd /Users/admin/github/buyerrecon-website && git branch --show-current && git log -1 --oneline` | Identify website-repo branch and HEAD. |
| `ls -la thinlayer/` (in website repo) | File inventory + sizes + mtimes. |
| `stat -f%z <file>; stat -f%Sm -t '%Y-%m-%dT%H:%M:%SZ' <file>; shasum -a 256 <file>` | Categorical metadata + hash for each of the five inspected files. |
| `grep -nE 'Schema\|Transport\|Adapter\|endpointUrl\|siteId\|consentSignal\|samplingRate' br-thinlayer-init.js` | Locate config keys (no values printed). |
| `grep -i 'token\|writeToken\|Bearer\|apiKey' br-thinlayer-init.js` | Confirm no stored token present. Single hit confirmed to be the `'token'` redaction-list entry (line 34). |
| `sed -n '1,12p' br-thinlayer-init.js; sed -n '70,90p' br-thinlayer-init.js` | Read header docblock + init wiring block (no token-bearing lines in this range). |
| `sed -n '15,50p' br-thinlayer-init.js` | Read `SITE_CONFIG` block (no token in `SITE_CONFIG`). |
| `grep -nE 'sendBeacon\|new Blob\|application/json\|keepalive\|JSON\.stringify\|events:' thin-sdk.iife.js` | Locate transport / body-construction patterns. |
| `grep -oE '(.{120})navigator\.sendBeacon\(.{120}' thin-sdk.iife.js` | Read the categorical structure around `sendBeacon` invocation (decoded shape, no raw payload). |
| `grep -oE '\b<field-name>\b' <file>` (per Sprint 2 / legacy field name) | Field-presence count matrix (§8.3, §9.1, §9.2). |
| `head -3 buyerrecon-adapter.iife.js | head -c 500` | Adapter bundle preamble (IIFE shell only). |
| `grep -oE '\b[a-z_][a-z0-9_]+:' buyerrecon-adapter.iife.js | sort -u | head -80` | Adapter vocabulary enumeration. |

**No `curl`, `psql`, `nginx`, `systemctl`, `node`, `npm`, or any process that would touch a production endpoint, production-host process, or production DB was executed.** No production-host file was read.

### 16.2 Limitations

- **§3.1 hashes are of the buyerrecon-website source-of-truth repo at `production-live-20260508`, not of the actual `/var/www/buyerrecon.com/html/thinlayer/*` files on the production host.** A host-side `sha256sum` cross-check is the §13.1 residual step.
- The `br-thinlayer-init.js` file on the production host **is expected to differ** from the §3.1 hash because PR#17p edited the `endpointUrl` literal directly on the host (then rolled it back to the same Render-legacy literal). The remaining 117 lines should match.
- The other four bundle files (`thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, `br-probe-init.js`, `br-probe.iife.js`) are **expected to match** §3.1 byte-for-byte, unless an out-of-band deploy occurred between 2026-05-08 and now.
- HTML script-tag ordering on individual pages was not exhaustively inspected (§5.2). The bundle source assumes `ThinSDK` / `BuyerReconAdapter` / `buyerreconConsent` globals are loaded before `br-thinlayer-init.js`.
- PR#17t did not inspect the four other canary sites' bundles (`realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`). Their shape is a separate Gate 1 confirmation (§15.4).

### 16.3 Closing posture

- **PR#17t is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection, no production command, no production-host file read, no edit to any file under `/var/www`, no copy of any production bundle into this repo.
- **No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data** appear anywhere in this doc.
- **Production posture after PR#17t:** unchanged from §4. `buyerrecon-production-collector.service` `active` on `PORT=3073`; `nginx.service` `active` with the PR#17o `location = /v1/event` route; `buyerrecon.com` ThinLayer `endpointUrl` on Render legacy (`https://buyerrecon-backend.onrender.com/collect`); `br-probe-init.js` on Render `apiBase`; production event tables at `ingest_requests=26` / `accepted_events=0` / `rejected_events=0` / `site_write_tokens_used=1` (evidence preserved); Lane A/B at `0` rows; PR#17g grant safety intact; PR#17q column-level grants intact; staging service untouched; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.

End of PR#17t. **Gate 1 — Static Contract Diff confirmation complete. H1 directly confirmed. H8 confirmed as the second-wave mismatch. Recommendation: Option A. Awaiting Helen's decision before any downstream implementation PR. No endpointUrl re-flip is approved by PR#17t.**
