# Sprint 2 PR#18ac: Gate 4C Endpoint Flip / Canary Planning

> Docs-only planning record. No execution by this PR. No `endpointUrl`
> re-flip. No canary. No production traffic generation. No `/var/www`
> edit. No DB write. No DB grant. No Nginx reload. No `systemctl`. No
> DNS change. No customer output. No Lane writer. No runtime scoring.
> No AMS Trust / Pass 1 / Pass 2 runtime. No website ThinSDK
> production-mode activation. No production artifact / config mode
> flip. No secrets.

---

## 1. Status / verdict

**Verdict: PLANNING_ONLY — Gate 4C not approved, no production execution.**

**Gate 4C execution readiness sub-status: `BLOCKED_PENDING_COMPATIBILITY_PLAN`.**

PR#18ac plans the Gate 4C `endpointUrl` re-flip / canary in the
narrow sense required by `docs/ops/cutover-hard-gates.md` §6.2 PR B
("Client Endpoint Change") + §6.3 PR C ("Controlled Event Proof"),
but it records categorically — at the planning stage — that the
**ThinSDK ↔ Sprint 2 `/v1/event` contract-shape compatibility
required to make the re-flip succeed has not yet been proven**. The
26 HTTP `400` `request_body_invalid_json` rows from `2026-05-19`
(PR#17s, carried forward in PR#18w / PR#18ab) are direct categorical
evidence that the bundle currently deployed on
`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
(`sha256=9b0e4530…cc2efda0` per PR#18p §3.1, re-confirmed at PR#18x
§3.1, PR#18y §6, PR#18z §6.2, PR#18z §6.6, PR#18aa §5.4) emits a
body shape that the Sprint 2 `/v1/event` collector rejects at the
envelope-parse stage before any event-level validation can fire.

Because the on-host bundle hash has not changed since the PR#17s
incident (PR#18aa §5.4 re-confirmed all four baseline hashes match
character-for-character), **PR#18ac records Gate 4C execution as
`BLOCKED_PENDING_COMPATIBILITY_PLAN`**. Section §6 enumerates the
compatibility-plan sub-steps that must be closed under their own
Helen GO before Gate 4C execution may be unblocked.

PR#18ac is therefore a planning-only artefact that:

- defines the **shape** of the future Gate 4C planning surface
  (§4 / §5 / §7 / §8 / §9 / §10 / §11 / §12 / §13),
- records the **specific blocker** that prevents Gate 4C execution
  today (§5 / §6),
- enumerates the **compatibility-plan path forward** referenced by
  PR#17s §11 / §11.6 (§6),
- carries the **PR#18ab governance locks** verbatim (§14),
- carries the **PR#17s / PR#18w 26-row warning** verbatim (§15),
- defines the **non-goals** explicitly (§16) and the **acceptance
  criteria** for this planning PR itself (§17).

PR#18ac does **not** authorise any Gate 4C work. Each precondition
in §6 / §8 / §13 requires its own explicit Helen GO scoped to that
sub-step.

Anchored governance phrases (carried verbatim from
`docs/ops/cutover-hard-gates.md` §7):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why Gate 4C planning exists

Three predecessor merges open the planning surface for Gate 4C
(while explicitly **not** opening the execution surface):

- **PR#18aa / PR #59** — Gate 4B re-audit after rollback
  reconstitution. Verdict: **PASS**. The rollback-posture blocker
  recorded in PR#18y is categorically lifted. The Gate 4B blocker
  stack from PR#18p → PR#18y → PR#18z → PR#18aa is closed.
  Artifact and endpoint posture are clean:
  `endpointUrl_category=render_legacy_collect`,
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no`. The canonical rollback root
  `/root/buyerrecon-rollback/` and the timestamped bundle
  `buyerrecon-gate4b-rollback-20260524T115806Z` are provably present
  and intact on the production host.
- **PR#18ab / PR #60** — Final scoring / governance recap. Verdict:
  **GOVERNANCE_RECAP_ONLY**. Records the eleven `*_allowed=false` /
  `allowed_customer_language=[]` governance locks; records the
  PR#17s 26-row warning; records the seven still-unsatisfied
  Gate 4C preconditions (out of eight; only rollback-first is
  satisfied); records the Gate 4C planning surface.
- **PR#18z / PR #58** — Rollback reconstitution PASS, satisfying the
  rollback-first Gate 4C precondition.

With Gate 4B non-`BLOCKED` and the governance recap merged, **Gate
4C planning** may proceed (this PR). **Gate 4C execution** still
requires:

1. an explicit Helen GO for Gate 4C scoped narrowly to the
   `endpointUrl` re-flip and nothing else (the other seven §8
   preconditions),
2. **plus** a compatibility plan that proves the ThinSDK bundle
   shape now matches the Sprint 2 `/v1/event` collector contract
   (the §6 compatibility-plan path).

The second requirement is the new blocker that PR#18ac surfaces.
The first six predecessor PRs (PR#18v / w / x / y / z / aa) all
addressed credential, DB grant, artifact-integrity, and rollback
posture; none of them touched the ThinSDK bundle's emitted body
shape. The PR#17s diagnosis of contract-shape mismatch remains
unfixed.

---

## 3. Current known production state

Carried forward from the merged PR#18aa / PR#18z / PR#18w / PR#18x
/ PR#17s evidence on base:

### 3.1 Endpoint posture

- `endpointUrl_category`: `render_legacy_collect`.
- `br-thinlayer-init.js /collect count`: `1` (per PR#18aa §5.5;
  matches PR#18p §3.2 baseline).
- `br-thinlayer-init.js /v1/event count`: `0`.
- Other three artifacts: both `/collect` and `/v1/event` counts = `0`.
- `render_collect_legacy_present`: `yes`.
- `sprint2_endpoint_config_present`: `no`.
- `both_collect_and_v1event_present`: `no`.

Live `endpointUrl` (per PR#17s §4): the `br-thinlayer-init.js`
literal points at the Render legacy collector
`https://buyerrecon-backend.onrender.com/collect`. The Sprint 2
production collector on `buyerrecon.com` (Nginx-routed by PR#17o)
is **up and idle with respect to live `buyerrecon.com` ThinLayer
traffic**.

### 3.2 Bundle hash baselines

All four sha256 values still match the PR#18p §3.1 baseline at
PR#18aa §5.4:

- `br-thinlayer-init.js`: `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
- `thin-sdk.iife.js`: `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`
- `br-probe-init.js`: `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`
- `index.html`: `30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`

These are the **PR#17s-era** hashes. No artifact has been updated
since PR#17s recorded the contract-shape mismatch.

### 3.3 Rollback posture

- `/root/buyerrecon-rollback/` exists at mode `0700`, owner
  `root:root`.
- Latest bundle: `buyerrecon-gate4b-rollback-20260524T115806Z` —
  mode `0700`, owner `root:root`.
- Four bundle artifacts present at mode `0600`, owner `root:root`.
- `MANIFEST.txt`, `LIVE-HASHES-AT-CAPTURE.txt`,
  `ROLLBACK-PROCEDURE.md` all present at mode `0600`, owner
  `root:root`.
- `bundle_intact=yes` via `( cd "$LATEST_BUNDLE" && sha256sum -c
  MANIFEST.txt >/dev/null 2>&1 )`.
- All four per-file `_backup_matches_live=yes`.

### 3.4 Gate posture

- Gate 4A DB / grant / traffic re-audit: **non-`BLOCKED`**
  (PR#18w PASS_WITH_WARNINGS).
- Gate 4B artifact / config / rollback re-audit: **non-`BLOCKED`**
  (PR#18aa PASS).
- Gate 4C `endpointUrl` re-flip: **unapproved** (§8 / §16).
- Gate 4D organic observation: **unapproved**.
- Gate 4E Track A / Playwright: **unapproved**.

### 3.5 PR#17s / PR#18w 26-row warning

Preserved. See §15 for the full carry-forward.

---

## 4. Exact target file(s)

### 4.1 Primary expected target

`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`

This is the **only** file that PR#18x §4.5 identifies as carrying
the `/collect` literal at PR#18aa execution time
(`br_thinlayer_init.js /collect count = 1`; all other artifacts both
`/collect` and `/v1/event` counts = `0`). A Gate 4C re-flip's
file-diff plan, if and when it is opened, would in the simplest
case modify only this file.

### 4.2 Non-targets unless proven otherwise

The following three files **must remain byte-identical** to the
PR#18p / PR#18x / PR#18y / PR#18z / PR#18aa baseline during any
future Gate 4C execution window:

- `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js` —
  sha256 `7098d648…c53538d1` must hold pre and post.
- `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js` —
  sha256 `09d68188…17060f84` must hold pre and post.
- `/var/www/buyerrecon.com/html/index.html` — sha256
  `30b46c12…3810965c` must hold pre and post.

Any drift in any of these three "unchanged" files during a Gate 4C
window is a stop-line
(`unchanged_artifact_hash_drift` / `unauthorised_file_changed`).

### 4.3 Caveat — primary target might be insufficient on its own

**The §6 compatibility-plan path will likely require a bundle-level
update to `thin-sdk.iife.js` as well**, per PR#17s §11.1: "modify
`thin-sdk.iife.js` (and any `br-thinlayer-init.js` /
`buyerrecon-adapter.iife.js` collaborators) so that the browser
transport emits a **single JSON object per POST** matching the
Sprint 2 envelope shape". If that path is taken,
`thin-sdk.iife.js` becomes a **second** Gate 4C target file and the
§4.2 list above narrows to two files (`br-probe-init.js`,
`index.html`). The Gate 4C planning PR opened **after** the
compatibility plan closes must re-identify the target file list
against the bundle state at that time; this PR does not
pre-authorise either single-file or two-file shape.

### 4.4 Boundary

**Gate 4C must not touch any non-target file unless a later
compatibility proof shows it is necessary and Helen explicitly
approves.** No `cp`, `mv`, `rm`, `chmod`, `chown`, `ln -s`, `rsync`
against any `/var/www/` path other than the target(s). No symlink
change. No Nginx config edit. No `systemctl` action.

---

## 5. Exact intended endpoint change

### 5.1 Categorical change

| From | To |
|---|---|
| `render_legacy_collect` | `sprint2_v1_event` |

This category change is recorded as a label; the literal endpoint
strings are recorded in §5.2 as planning material. No raw secret,
no DSN, no token, no `Authorization:` header value appears in this
or any subsequent §5 / §6 / §7 / §8 / §9 / §10 / §11 / §12 / §13
content.

### 5.2 Literal endpoint strings (planning identifiers, non-secret)

The two literal URLs that the §4.1 target file must transition
between are publicly-observable values (the legacy URL is already
the literal that `grep -c '/collect'` returned `1` against in
PR#18p §3.2 / PR#18aa §5.5; the Sprint 2 URL is already routed by
Nginx per PR#17o on `buyerrecon.com`):

- **Pre-change literal (Render legacy `/collect`):**
  `https://buyerrecon-backend.onrender.com/collect`
- **Post-change literal (Sprint 2 `/v1/event` on `buyerrecon.com`):**
  `https://buyerrecon.com/v1/event`

Both URLs are operational endpoints, not secrets. The exact string
form in the JavaScript source (single vs double quotes, leading
whitespace, etc.) must be re-confirmed by a Gate 4C planning PR
that runs **read-only** against the live target file at execution
time, since this PR is not authorised to print artifact contents.

### 5.3 Token / auth binding semantics

- **No new token issuance is planned by Gate 4C.** The Sprint 2
  `/v1/event` route's auth contract is `site_write` per PR#17s
  §6.6; the production site-write token for `buyerrecon.com` was
  issued under PR#17m / PR#17o and persisted root-only at
  `/root/buyerrecon-pr17m-new-site-write-tokens-20260519T143703Z.txt`
  (mode `0600`, owner `root:root`).
- **No token value is printed by PR#18ac.** No
  `Authorization:` header value, no bearer token, no token hash, no
  partial token string.
- **Whether the ThinSDK bundle currently embeds or fetches the
  site-write token is a compatibility-plan question** (§6); PR#17s
  §6.6 records `auth_status=ok` × 26 in the historical evidence
  rows, meaning the bundle did authenticate successfully at the
  Nginx route layer on `2026-05-19`. But the rows were then
  rejected at the envelope-parse stage. So the auth binding
  worked; the body shape did not.

### 5.4 Config-only vs bundle replacement

This is the **central open question** that the §6 compatibility
plan must answer:

- **Config-only path** (`legacy /collect` → `sprint2 /v1/event`,
  but ThinSDK still emits the legacy body shape): would reproduce
  the PR#17s 26-row pattern. Forbidden by Gate 4C stop-lines
  (§12).
- **Bundle-replacement path** (update `thin-sdk.iife.js` and / or
  `br-thinlayer-init.js` to emit the Sprint 2 envelope shape per
  PR#17s §11.1, **then** flip `endpointUrl`): the path PR#17s
  §11.6 sketches. PR#18ac does not authorise this work, only
  sequences it as the §6 compatibility-plan path.

### 5.5 ThinSDK ↔ Sprint 2 collector field-shape compatibility

**Not proven at PR#18ac merge time.** Categorical evidence against
compatibility:

- PR#17s §10 ranked H1 (top-level JSON array at `/v1/event`) as
  the most likely root cause of the 26 HTTP 400
  `request_body_invalid_json` rejections, and H1's smoking-gun
  test exists at `tests/v1/envelope.test.ts` ("top-level array
  `[1,2,3]` to `/v1/event` → `request_body_invalid_json`").
- The `br-thinlayer-init.js` sha256 at PR#18aa §5.4
  (`9b0e4530…cc2efda0`) is identical to the sha256 in force when
  the 26 rows landed on `2026-05-19`. No frontend change has been
  shipped since.
- PR#17s §6.3 records the Sprint 2 `/v1/event` route accepts
  **only** a single top-level JSON object — arrays, `null`,
  primitives all reject as `request_body_invalid_json`.

### 5.6 Gate 4C execution status: `BLOCKED_PENDING_COMPATIBILITY_PLAN`

Because §5.5 records that field-shape compatibility is unproven
and the existing categorical evidence (the 26 rows) strongly
suggests it is **broken** in the bundle currently deployed:

> **PR#18ac marks Gate 4C execution as
> `BLOCKED_PENDING_COMPATIBILITY_PLAN`.** Gate 4C may not be
> executed until the §6 compatibility plan closes — under its own
> Helen GO — with categorical evidence that the bundle now emits a
> body shape the Sprint 2 collector accepts.

This is a **stronger** finding than "Gate 4C remains unapproved":
even if a Gate 4C Helen GO were issued today, executing the
re-flip against the current bundle is predicted by PR#17s §10 /
§6.5 to produce another batch of HTTP 400
`request_body_invalid_json` rows. That outcome would be a
regression (`request_body_invalid_json_observed_post_flip`
stop-line, §12) and would require immediate rollback per the §9
plan.

---

## 6. ThinSDK / collector contract compatibility plan

### 6.1 Required proof before Gate 4C may be unblocked

Before Gate 4C execution may be considered (let alone executed), a
**Compatibility Plan PR** under its own explicit Helen GO must
record categorically:

- **Exact expected payload envelope shape** matching Sprint 2
  `/v1/event` per PR#17s §6.3 / §6.4. The proof must record the
  full required Sprint 2 browser event shape, not a partial
  subset:

  Envelope rules:
  - **Single top-level JSON object** per POST, **not** a top-level
    JSON array, `null`, or other primitive (PR#17s §6.3,
    `tests/v1/envelope.test.ts` smoking-gun case). A top-level
    array reproduces the PR#17s `request_body_invalid_json`
    branch 2.
  - **`Content-Type: application/json`** (or
    `application/json; charset=utf-8`). A different Content-Type
    rejects as `content_type_invalid` (HTTP `415`).

  Required event-object fields (per `validateEventCore()`
  deterministic Step 1 → Step 8 order at
  `src/collector/v1/validation.ts:163–175`; first-win):
  - **`event_name`** — non-empty string. Missing / empty →
    `event_name_invalid` per-event reject.
  - **`schema_key`** — non-empty string. Missing / empty →
    `schema_unknown` per-event reject.
  - **`schema_version`** — three-component semver string matching
    `/^\d+\.\d+\.\d+$/`. Missing / non-semver →
    `schema_version_malformed` per-event reject.
  - **`client_event_id`** — UUIDv4 or UUIDv7 (RFC 4122 variant,
    strict regex). Absent / null / empty →
    `client_event_id_missing`; present but not UUIDv4/UUIDv7 →
    `client_event_id_invalid`.
  - **`event_type`** — string in
    `{page, track, identify, group, system, debug}`. Missing /
    empty / unknown → `event_type_invalid`.
  - **`event_origin`** — string in `{browser, server, system}`,
    must agree with the `event_type` matrix. Missing / mismatched
    → `event_origin_invalid`.
  - **`occurred_at`** — ISO-8601 string or epoch-ms number within
    `[now − 24h, now + 5min]`. Missing / invalid / out-of-window
    → `occurred_at_missing` / `_invalid` / `_too_old` /
    `_too_future`.
  - **`session_id`** — required for `event_origin = "browser"`
    (the production canary path) as a non-empty string. Missing
    → `session_id_missing`. (Optional for server / system event
    origins, but non-empty if present.)

  Proof-invalidity clause:
  - **A compatibility proof that omits any one of the eight
    required validator fields above (or that violates the
    single-top-level-object / Content-Type envelope rules) is
    categorically invalid.** PR#17s §6.4 records that
    "`event_name`, `schema_key`, `schema_version`, and
    `client_event_id` are not optional"; the validator's
    first-win ordering means an event missing `event_name` never
    even reaches the `schema_key` / `schema_version` /
    `client_event_id` checks, so a proof that exercises only
    `event_type` / `event_origin` / `occurred_at` / `session_id`
    cannot establish compatibility for the downstream fields.

  Secret-safety clause: no raw payload body is printed in the
  proof — only the categorical shape description (field names,
  types, and required-vs-optional status) plus a non-secret
  fixture-style example with placeholder values (e.g.
  `"event_type": "page"`, `"client_event_id":
  "00000000-0000-7000-8000-000000000000"`-style sentinel UUIDv7)
  if needed.

  Gate 4C execution status clause: **Gate 4C remains
  `BLOCKED_PENDING_COMPATIBILITY_PLAN` until this full Sprint 2
  browser event shape is proven against the configured production
  transport path (see §6.2 step 2 PR#18ae for the test-shape
  requirement)** — that is, until the Compatibility Plan PR
  records that all eight required validator fields, both
  envelope rules, and the production-configured transport path
  together produce an `accepted_events` row on a staging Sprint 2
  collector (PR#18af) and on the production cluster's controlled
  canary window (PR#18ai).

- **Exact endpoint path** on `buyerrecon.com` (`/v1/event`).
- **Exact HTTP method** (`POST`).
- **Exact Content-Type** (`application/json`, recorded as the
  envelope-rule attestation above).
- **Token / auth binding semantics** confirmed: the bundle binds
  the production `site_write` token for `buyerrecon.com` at
  runtime per PR#17o; the proof records `auth_status=ok` is
  reachable. No raw token printed. No `Authorization:` header
  value printed.
- **Canary proof fields** for the Sprint 2-shape probe (described
  in §11 below), capturing `ingest_requests` delta,
  `accepted_events` delta, `rejected_events` reject reasons.

### 6.2 Compatibility-plan sub-steps (PR-by-PR sequence)

Adapted from PR#17s §11.6 to the current PR# numbering, the
compatibility-plan path forward is:

1. **PR#18ad (proposed) — Gate 1 static contract diff confirmation.**
   Read the existing `thin-sdk.iife.js` / `br-thinlayer-init.js`
   bundle categorically against the Sprint 2 `/v1/event` contract.
   Produce a docs-only proof that H1 (or another cause) is the
   confirmed mismatch; identify exactly which fields / shape /
   transport in the bundle must change. **No production deployment.
   No production traffic.** Read-only inspection only
   (`sha256sum`, bounded `grep -c`, or local-only bundle
   inspection on a non-prod machine).

2. **PR#18ae (proposed) — Option A implementation.** Update
   `thin-sdk.iife.js` (and / or `br-thinlayer-init.js`) to emit
   the Sprint 2 envelope shape per PR#17s §11.1. Unit tests must
   exercise the **configured BuyerRecon runtime transport path**
   — currently the fetch-based path (`FetchTransport` /
   `fetch()`-based POST) — and assert byte-for-byte against a
   canonical fixture:

   - **Configured transport: FetchTransport (fetch-based POST).**
     The known BuyerRecon production transport binding is the
     fetch-based path; tests must exercise that path explicitly
     (not a parallel `navigator.sendBeacon` mock). A test that
     passes against `navigator.sendBeacon` while production
     remains configured for `FetchTransport` would constitute a
     **false compatibility proof** — the fetch path's body
     serialisation, header semantics, and keepalive behaviour are
     not guaranteed equivalent to `sendBeacon`'s Blob-wrapped
     transport, and only the actually-configured path's evidence
     can satisfy the Gate 4C compatibility gate.
   - **`keepalive: true` if applicable.** If the production
     FetchTransport binding uses `keepalive: true` (e.g. for
     page-unload survival), the test fixture must set the same
     flag and assert it on the captured `RequestInit`.
   - **`Content-Type: application/json`** (or a charset-compatible
     equivalent such as `application/json; charset=utf-8`).
     Assert exactly on the outgoing `Content-Type` header; reject
     any other value.
   - **`JSON.stringify` of one single Sprint 2 event object.** The
     request body must serialise to a **single top-level JSON
     object** (per §6.1 envelope rules), produced via
     `JSON.stringify(eventObject)` over an object whose required
     fields match the §6.1 full required Sprint 2 browser event
     shape (`event_name`, `schema_key`, `schema_version`,
     `client_event_id`, `event_type`, `event_origin`,
     `occurred_at`, `session_id`). A top-level array body, a
     wrapped `{ events: [...] }` body (which would belong to
     `/v1/batch`, not `/v1/event`), or a serialised primitive is
     a test failure.
   - **Full required Sprint 2 browser event shape from §6.1.**
     The fixture must populate every one of the eight required
     validator fields with a value that passes
     `validateEventCore()` Step 1 → Step 8 (per
     `src/collector/v1/validation.ts:163–175`). No partial
     fixtures.

   **`BeaconTransport` / `navigator.sendBeacon` posture.** If the
   PR#18ae test surface still mentions `navigator.sendBeacon` at
   all, the mention must be **labelled as secondary /
   non-configured**, used only to document the alternative
   transport's behavioural differences (e.g. the `Blob.type`
   field carrying Content-Type per PR#17s §5.2). A `sendBeacon`
   test alone does **not** satisfy the Gate 4C compatibility gate
   unless a later PR explicitly changes the configured production
   transport binding from `FetchTransport` to `BeaconTransport`
   under its own Helen GO. PR#18ac does not authorise such a
   transport change.

   **No production deployment by this PR.**

3. **PR#18af (proposed) — Gate 2 controlled fixture dry-run.** Run
   the updated bundle against a **staging** Sprint 2 collector
   instance with a non-customer fixture payload. Capture
   categorical evidence (`http_status=200`, `accepted_events`
   delta, `rejected_events` reject reasons). **No production
   traffic.**

4. **PR#18ag (proposed) — Gate 3 runtime privilege simulation.**
   Exercise the same code path against a disposable / staging DB
   role whose grants exactly mirror the production runtime role's
   PR#17q steady-state matrix. Confirm no `storage_failure`, no
   `permission denied`, no grant broadening. **Do not broaden
   grants to make a proof pass.**

5. **PR#18ah (proposed) — Gate 4 PR B execution.** Under explicit
   Helen GO, deploy the updated bundle to the production host,
   **leaving `endpointUrl` unchanged** (`/collect` still). Confirm
   the bundle is served correctly and `br-thinlayer-init.js`
   literal still resolves to Render legacy. This is a
   bundle-deploy step, not an endpoint flip.

6. **PR#18ai (proposed) — Gate 4 PR C execution = Gate 4C
   `endpointUrl` re-flip.** Under a **separate** explicit Helen
   GO, re-flip `endpointUrl` to the Sprint 2 path and observe one
   controlled human page-load. Expected: HTTP `200`,
   `accepted_events` increment, no `request_body_invalid_json`.
   This is the step PR#18ac plans the surface of.

7. **PR#18aj (proposed) — Gate 4 PR D execution = passive organic
   observation.** Record `NO_EVENT_YET` if no organic event
   occurs during the window. `NO_EVENT_YET` is **not** failure if
   no event was expected within the window.

PR#18ac does **not** authorise any of PR#18ad → PR#18aj. PR#18ac
records the sequence so a future planning chain can size and
sequence the work.

### 6.3 If compatibility cannot be proven

If the §6.2 sequence stalls — for example, if the Option A bundle
update is prohibitively expensive at the frontend layer — Option B
(`/v1/batch` route, PR#17s §11.3) and Option C (server-side
adapter, PR#17s §11.4) remain available under their own Helen
GOs. PR#18ac does not select between them. Option D ("stay on
Render legacy") is the current steady state (PR#17s §4) and
remains the safe pause state if no path closes.

### 6.4 Pattern-recurrence stop-line is mandatory

Whatever path the compatibility plan takes, the eventual Gate 4C
execution PR (per §6.2 step 6) **must** enumerate
`request_body_invalid_json_observed_post_flip` as a hard
stop-line. A single recurrence of the PR#17s pattern on a path
that should have succeeded is a regression, not noise, and forces
an immediate rollback per §9.

---

## 7. Exact pre-change hash plan

Before any future Gate 4C execution may proceed, a `sha256sum` of
all four live static artifacts must be captured and compared to
the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6 / PR#18z §6.2 / PR#18aa
§5.4 baseline:

| Artifact | Expected baseline sha256 |
|---|---|
| `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |
| `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js` | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |
| `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js` | `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` |
| `/var/www/buyerrecon.com/html/index.html` | `30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c` |

### 7.1 Pre-flip gating

**If any current hash differs from the baseline before execution
begins, stop.** This indicates the bundle has been updated
out-of-band (per §6.2 step 5 or by some other process), and the
Gate 4C planning PR opened **after** that update must re-record
the baseline before proceeding.

### 7.2 No content printed

`sha256sum` emits only `<hash>  <path>` per line. No artifact
content is printed at any time. No `cat`, `head`, `tail`, or
`diff` of artifact contents is permitted in the Gate 4C execution
PR.

---

## 8. Exact post-change hash plan

After any future Gate 4C target-file modification:

- **Changed target file** (currently expected to be
  `br-thinlayer-init.js`, possibly also `thin-sdk.iife.js`
  depending on §6 compatibility-plan outcome) — its new sha256
  must be:
  - **pre-recorded** in the Gate 4C planning sub-PR (so the
    operator knows the exact expected post-flip hash before
    executing),
  - **captured** by the Gate 4C execution PR immediately after
    the write,
  - **identical** to the pre-recorded planning value.
- **Unchanged non-target files** must remain byte-identical to
  the baseline. Each non-target sha256 must equal its §7 baseline
  both pre and post. Any drift is the
  `unchanged_artifact_hash_drift` stop-line (§12).
- **Post-change hash table** in the Gate 4C execution proof must
  record every artifact's `before` value, `after` value, and
  `match_planned_post_hash=yes|no` boolean.
- **No raw file contents printed.** No secrets printed.

---

## 9. Rollback plan

### 9.1 Rollback posture (carried from PR#18z / PR#18aa)

- Rollback root: `/root/buyerrecon-rollback/` exists, mode
  `0700`, owner `root:root`.
- Latest bundle: `buyerrecon-gate4b-rollback-20260524T115806Z`
  (mode `0700`, owner `root:root`). Contains byte-identical
  copies of the four live static artifacts at mode `0600` owner
  `root:root`, plus `MANIFEST.txt` (relative-filename
  `sha256sum`) and `LIVE-HASHES-AT-CAPTURE.txt` (absolute-path
  `sha256sum`).
- `bundle_intact=yes` via `( cd "$LATEST_BUNDLE" && sha256sum -c
  MANIFEST.txt >/dev/null 2>&1 )` (PR#18z §6, PR#18aa §5.6).
- All four per-file `_backup_matches_live=yes` (PR#18z §6.6,
  PR#18aa §5.6).
- `ROLLBACK-PROCEDURE.md` exists at
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` (mode
  `0600`, owner `root:root`), records the rollback runbook
  including:
  - "How to find the most recent bundle" (the
    `ls -1dt … | head -n 1` pattern with `${LATEST_BUNDLE%/}`
    trailing-slash strip),
  - "How to verify the bundle is intact" (the `sha256sum -c
    MANIFEST.txt` block),
  - "How to restore" (the pre-restore `stat -c '%a %U:%G %n'`
    step plus the per-file `install` block),
  - "How to verify after restore" (per-file sha256 equality +
    the `/collect` and `/v1/event` count re-checks).

**Important Gate 4C subtlety.** If the §6 compatibility plan
delivers an updated bundle deployed via PR#18ah (§6.2 step 5),
the rollback bundle from PR#18z captures the
**pre-compatibility-plan** artifact state. A Gate 4C re-flip
executed against a **post-compatibility-plan** bundle would
therefore need either:

- a **new** rollback bundle captured **after** the bundle update
  (e.g. PR#18ah produces a fresh `buyerrecon-gate4b-rollback-<UTC>`
  via the PR#18z §A–§I command shape against the new live
  state), or
- a **two-stage** rollback (first restore `br-thinlayer-init.js`
  to point at `/collect` again from a fresh single-file backup;
  then optionally restore the full bundle to the
  pre-compatibility-plan state if the compatibility-plan bundle
  itself proves problematic).

PR#18ac flags this; the Gate 4C planning sub-PR opened **after**
the compatibility plan closes must explicitly choose between the
two options and record the chosen rollback procedure source.

### 9.2 Rollback trigger conditions

A Gate 4C execution PR's rollback must trigger immediately on
**any** of the §12 stop-lines:

- pre-change hash mismatch,
- target file unclear,
- write would touch non-target file,
- endpoint category after change unknown,
- both `/collect` and `/v1/event` active unexpectedly,
- Sprint 2 collector rejects payload with
  `request_body_invalid_json`,
- accepted / rejected / ingest counts cannot be read,
- Lane A / B rows change unexpectedly,
- any customer output appears,
- any scoring / runtime output appears,
- any secret printed,
- any production traffic scope exceeds canary,
- rollback bundle missing,
- rollback integrity fails,
- operator uncertain.

### 9.3 Rollback verification fields

After rollback, the execution proof must record:

- exact target file restored,
- post-rollback sha256 of the target file matches the pre-flip
  baseline (or, in the post-compatibility-plan case, matches the
  recorded post-PR#18ah baseline),
- post-rollback sha256 of the three non-target files unchanged
  from baseline,
- `endpointUrl_category` restored to `render_legacy_collect`,
- `br-thinlayer-init.js /collect count` restored to `1`,
- `br-thinlayer-init.js /v1/event count` restored to `0`,
- `sprint2_endpoint_config_present` restored to `no`,
- `both_collect_and_v1event_present` is `no`,
- `bundle_intact=yes` still holds for the source bundle used,
- no customer output appeared,
- no scoring / runtime activation occurred,
- no secrets printed,
- final verdict: `ROLLED_BACK` per §11.

### 9.4 No rollback execution by this PR

PR#18ac does not execute rollback. The rollback procedure exists
on the production host (PR#18z), is documented in
`ROLLBACK-PROCEDURE.md`, and would only be executed in response
to a Gate 4C stop-line trigger under that PR's own Helen GO.

---

## 10. Canary scope

### 10.1 Narrow definition

The Gate 4C canary, if and when authorised, is scoped to:

- **One site only:** `buyerrecon.com`.
- **One endpoint path only:** `/v1/event` on the Sprint 2
  collector routed by Nginx per PR#17o.
- **One short observation window:** typically minutes to ~1 hour;
  the exact bound to be recorded in the Gate 4C execution PR.
- **No broad production rollout:** no other ThinLayer site, no
  other ThinLayer surface.
- **No customer-facing output:** none of the §14 governance
  locks is permitted to flip.
- **No dashboards / customer reports:** no surface change visible
  to customers.
- **No scoring / runtime activation:** no AMS Trust runtime, no
  Pass 1 runtime, no Pass 2 runtime, no Lane A / B writer.
- **No Lane A / B writer:** explicit reaffirmation of
  `lane_write_allowed=false`.
- **No Track A replay unless separately approved.** PR#17e Track
  A staging canary plan exists as a separate artefact; it is not
  invoked by Gate 4C.
- **Immediate rollback if any stop-line triggers** (§9.2).

### 10.2 Canary traffic categories

The Gate 4C execution PR must explicitly choose **one** of the
following canary traffic categories, and explicitly reject the
others under its own Helen GO:

- **Passive organic only** — the canary observes whatever organic
  traffic happens to arrive at `buyerrecon.com` during the
  window. `NO_EVENT_YET` is the expected outcome if no organic
  event occurs and is **not** a failure.
- **Synthetic operator-generated** — the operator performs a
  single controlled human page-load against `buyerrecon.com`
  (e.g. a one-tab browser visit) and observes the resulting
  `ingest_requests` row, the `accepted_events` row, and the page
  health response. This requires a separate explicit approval
  and an exact command plan, since it generates one event.
- **Controlled single-page test** — equivalent to synthetic
  operator-generated but more tightly scoped (e.g. a private /
  incognito browser window with a controlled Referer, no Lane
  writer activity, no return-visitor handling). Also requires
  separate explicit approval and exact command plan.

The Gate 4C execution PR must **not** invoke Track A, must
**not** invoke Playwright, must **not** generate write-smoke
traffic that exceeds the chosen canary category.

### 10.3 Canary success criteria (per category)

- **Passive organic.** Success = at least one `accepted_events`
  row is added during the window, attributable to the canary,
  with no `request_body_invalid_json`; or, if no organic event
  occurs, the recorded outcome is `NO_EVENT_YET` (not a failure).
- **Synthetic operator-generated.** Success = the operator's one
  controlled page-load produces exactly one `ingest_requests`
  increment with HTTP `200`, exactly one `accepted_events`
  increment, zero `rejected_events` increments, zero
  `request_body_invalid_json` increments, and zero Lane A / B
  increments.
- **Controlled single-page test.** Same as synthetic operator
  except the page-load is scoped to a controlled session
  identifier the operator records categorically (not the raw
  `session_id` value).

In every category, a **single occurrence of
`request_body_invalid_json` on a path that should have succeeded**
is a stop-line, not noise (§12).

---

## 11. Gate 4C proof fields

A future Gate 4C execution proof must record at minimum (all
values categorical; no raw payloads, no raw identifiers, no
secrets):

- **Operator identity category** (e.g. `root`, `web_admin`) — not
  personal data, not username.
- **Start timestamp** (UTC, ISO 8601-like format e.g.
  `YYYYMMDDTHHMMSSZ`).
- **Target file(s)** — exact path(s) from §4.1 / §4.3.
- **Before hashes** — sha256 per artifact (the four §7 baselines,
  unless compatibility-plan has updated them).
- **Exact change category** — `render_legacy_collect →
  sprint2_v1_event` per §5.1.
- **After hashes** — sha256 per artifact (target file new value;
  non-target files unchanged).
- **Endpoint category after change** —
  `endpointUrl_category=sprint2_v1_event` (or
  `render_legacy_collect` if rolled back).
- **Canary scope** — one of the three categories from §10.2.
- **`ingest_requests` count before / after.**
- **`accepted_events` count before / after.**
- **`rejected_events` count before / after.**
- **Any HTTP `400` `request_body_invalid_json` recurrence**
  (count and time window).
- **Lane A row count before / after** (must be `0` / `0` unless
  separately approved — §14).
- **Lane B row count before / after** (same).
- **Rollback bundle identity** —
  `buyerrecon-gate4b-rollback-20260524T115806Z` (or the
  post-compatibility-plan bundle identity, if PR#18ah produced a
  fresh one).
- **Rollback not needed / rollback executed** — boolean.
- **`no secret printed`** — attestation.
- **`no customer output`** — attestation.
- **`no scoring / runtime activation`** — attestation.
- **`no Lane writer`** — attestation.
- **Final verdict** — one of: `PASS`, `PASS_WITH_WARNINGS`,
  `ROLLED_BACK`, `BLOCKED`.

The Gate 4C execution proof structure must mirror PR#18p /
PR#18w / PR#18y / PR#18z / PR#18aa categorical evidence shapes.

---

## 12. Gate 4C stop-lines

A future Gate 4C execution PR must enumerate at minimum the
following stop-lines, plus any specific to its canary category.
Any single triggered stop-line forces an immediate rollback per
§9 and a `ROLLED_BACK` or `BLOCKED` verdict.

- **`pre_change_hash_mismatch`** — any §7 baseline value drifts
  before execution.
- **`target_file_unclear`** — the target file list cannot be
  categorically resolved against the live bundle state.
- **`write_would_touch_non_target_file`** — any planned
  `install` / `cp` / `mv` / `chmod` / `chown` / `ln -s` would
  touch a file outside the target list.
- **`endpoint_category_after_change_unknown`** — post-flip §E
  bounded `grep -c` produces an unclassifiable result.
- **`both_collect_and_v1event_active_unexpectedly`** — both
  literals appear non-zero in `br-thinlayer-init.js` (or any
  artifact) without the planning PR explicitly authorising a
  two-endpoint window.
- **`request_body_invalid_json_observed_post_flip`** — a single
  recurrence of the PR#17s pattern after the flip. Hard stop.
  Rollback immediately.
- **`accepted_rejected_ingest_counts_unreadable`** — the DB
  read-only queries from §13 cannot be executed (likely
  `production_audit_readonly` credential drift, PR#18v / PR#18w
  surface).
- **`lane_ab_rows_change_unexpectedly`** — Lane A or Lane B row
  count is no longer `0` at any point during the canary window,
  without a separately approved Lane writer PR.
- **`customer_output_observed`** — any customer-facing surface
  (website, dashboard, report, API response, sales material,
  marketing copy) reflects scoring / classification / decision
  content during the canary window.
- **`scoring_runtime_output_observed`** — any AMS Trust runtime
  output, Pass 1 runtime output, or Pass 2 runtime output
  appears.
- **`secret_printed`** — any DSN, password, `Authorization:`
  header value, bearer token, raw `request_id`, raw `session_id`,
  raw payload, raw response body, env dump, private key / cert
  body, vault content, shell history, or raw row surfaces.
- **`production_traffic_scope_exceeds_canary`** — traffic
  generated exceeds the §10.2 chosen canary category (e.g.
  Playwright invocation, Track A invocation, multi-page test).
- **`rollback_bundle_missing`** — `latest_bundle_found=no` at
  rollback trigger time.
- **`rollback_integrity_fails`** — `bundle_intact=no` at rollback
  trigger time.
- **`operator_uncertain`** — operator cannot categorically
  confirm any required value.

---

## 13. DB observation posture

### 13.1 Read-only only

If Gate 4C execution is later approved, DB observation must be
**read-only only** using the `buyerrecon_prod_audit_readonly`
credential established in PR#18v / PR#18w, bound at
`/root/buyerrecon-production-db.env` (mode `0600`, owner
`root:root`) with no `DATABASE_URL` fallback.

### 13.2 Required count queries

Required per-side reads (all `COUNT(*)`-only; no `SELECT *`, no
raw row body, no identifier):

- `SELECT COUNT(*) FROM public.ingest_requests WHERE endpoint =
  '/v1/event';` — before and after.
- `SELECT COUNT(*) FROM public.accepted_events;` — before and
  after.
- `SELECT COUNT(*) FROM public.rejected_events;` — before and
  after.
- `SELECT COUNT(*) FROM public.scoring_output_lane_a;` — before
  and after (expect `0` / `0`).
- `SELECT COUNT(*) FROM public.scoring_output_lane_b;` — before
  and after (expect `0` / `0`).
- `SELECT COUNT(*) FROM public.ingest_requests WHERE endpoint =
  '/v1/event' AND reject_reason_code = 'request_body_invalid_json';`
  — before and after (any positive delta after the flip is a
  stop-line, §12).

### 13.3 Optional first / last seen timestamps

If needed for window framing, time-window reads emit only
`MIN(received_at)::date` / `MAX(received_at)::date` per the
PR#18w §3.5 pattern; no raw `received_at` value is captured.

### 13.4 Forbidden

- **No raw payload printed.** No body content from any
  `ingest_requests` row.
- **No raw `request_id` printed.** No UUID values surface.
- **No raw `session_id` printed.** No session identifier
  surfaces.
- **No mutation** of the 26 historical PR#17s rows. No `UPDATE`,
  `DELETE`, or annotation against rows where
  `endpoint='/v1/event'` and
  `reject_reason_code='request_body_invalid_json'` and the time
  window matches `2026-05-19`.
- **No new DB grant.** No `GRANT` / `REVOKE` against any role.
- **No migration.** No `schema.sql` change.

### 13.5 Audit trail

The Gate 4C execution PR's evidence summary must record the
verbatim `current_user` category as `production_audit_readonly`
(per PR#18v / PR#18w pattern), confirming the read-only role was
used.

---

## 14. Scoring / output locks carried forward

Repeated verbatim from PR#18ab §9 — these locks remain in force
through and after Gate 4C, unchanged by Gate 4C execution success
or failure. Only a separate scoring / governance / output PR may
amend them.

```
customer_claim_allowed=false
customer_visibility_allowed=false
lane_output_allowed=false
lane_write_allowed=false
runtime_scoring_allowed=false
ams_trust_runtime_allowed=false
pass1_runtime_allowed=false
pass2_runtime_allowed=false
dashboard_customer_output_allowed=false
sales_claim_upgrade_allowed=false
allowed_customer_language=[]
```

### 14.1 Persistence under Gate 4C outcomes

- **If Gate 4C `PASS`** — `accepted_events` increments cleanly,
  no `request_body_invalid_json`. This is **evidence-capture
  proof only**. The §14 locks remain in force. No customer-facing
  scoring / output may be activated by the Gate 4C execution PR.
- **If Gate 4C `PASS_WITH_WARNINGS`** — same as PASS; the
  warning recorded must not amend any §14 lock.
- **If Gate 4C `ROLLED_BACK`** — the canary failed; the live
  state is back to `render_legacy_collect`. §14 locks unchanged.
- **If Gate 4C `BLOCKED`** — the canary did not run. §14 locks
  unchanged.

In **no** Gate 4C outcome may any `*_allowed=false` lock flip to
`true` without a separate scoring / governance / output PR under
its own explicit Helen GO.

---

## 15. Historical 26-row warning carry-forward

Repeated verbatim from PR#17s / PR#18w / PR#18ab §4 — these 26
rows remain preserved as categorical evidence.

- **Count:** `ingest_requests_endpoint_v1_event_count = 26` on
  the production cluster.
- **Window:** `v1_event_first_seen_day = 2026-05-19`,
  `v1_event_last_seen_day = 2026-05-19`.
- **Status distribution:** `distribution_http_status = 400: 26`.
- **Reason distribution:** `distribution_reject_reason_code =
  request_body_invalid_json: 26`.
- **Downstream propagation:** `accepted_events_count = 0`,
  `rejected_events_count = 0`, `lane_a_row_count = 0`,
  `lane_b_row_count = 0`.
- **Origin:** ThinSDK ↔ Sprint 2 `/v1/event` contract-shape
  mismatch documented in PR#17s.
- **Preservation rule:** "**Do not delete, mutate, annotate, or
  normalise these rows.**" The on-host
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` `## Do-not
  rules` section independently records the same rule (PR#18z §G).

### 15.1 Specific Gate 4C watch

A Gate 4C execution PR (or any compatibility-plan PR per §6.2)
**must specifically watch for recurrence** of this exact pattern:

- `endpoint = '/v1/event'`,
- `http_status = 400`,
- `reject_reason_code = 'request_body_invalid_json'`,
- new rows in the canary window (delta from the 26-row baseline).

If a single new row matching this pattern appears after the flip,
the canary has reproduced the PR#17s failure mode and must roll
back immediately
(`request_body_invalid_json_observed_post_flip` stop-line, §12).

### 15.2 Canary measurement rule

Canary success on `ingest_requests` is measured as **delta from
the 26-row baseline**, not as absolute count. A clean canary's
`ingest_requests_endpoint_v1_event_count` will be `26 + N` where
`N` is the number of canary events generated — and `N` will be
`0` for passive organic with no event arriving (`NO_EVENT_YET`),
`1` for a single synthetic operator-generated event, or `1` for
a controlled single-page test.

---

## 16. Non-goals

PR#18ac explicitly does **not** approve any of the following.
Each requires its own explicit Helen GO scoped to that specific
work:

- no production execution of any kind,
- no `endpointUrl` re-flip,
- no canary (passive organic, synthetic, or controlled),
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane
  report / dashboard / API response / sales material / marketing
  copy / language upgrade),
- no scoring activation (Pass 1 / Trust / Pass 2 / AMS bridge /
  customer-decision surface),
- no Lane A / Lane B writer,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no production-cutover readiness claim,
- no `buyerrecon.com` production `/v1/event` call by PR#18ac,
- no Render `/collect` call by PR#18ac,
- no `/var/www` edit,
- no symlink change,
- no `nginx -s reload`, no `systemctl` action, no service
  restart,
- no DNS change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no
  `buyerrecon_migrator` reset, no production token provisioning,
- no Track A,
- no Playwright,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw
  `request_id`, raw `session_id`, raw payload, raw response
  body, env dump, private key / cert body, vault content, shell
  history, raw row data).

---

## 17. Acceptance criteria

PR#18ac is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes:
  `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md`. No
  code, no scripts, no tests, no package files, no migrations,
  no `schema.sql`, no env files, no systemd / Nginx files, no
  AMS source, no website artifacts, no production config, no DB
  grant files change.
- **Gate 4C remains unapproved.** §1 verdict `PLANNING_ONLY`; §1
  execution sub-status `BLOCKED_PENDING_COMPATIBILITY_PLAN`;
  §6 / §8 / §16 all restate non-approval.
- **Execution status `BLOCKED_PENDING_COMPATIBILITY_PLAN`.** §1,
  §5.6, §6.1 all record the sub-status verbatim.
- **Exact target file identified or explicit blocker recorded.**
  §4 identifies the primary target
  (`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`)
  and §4.3 records that `thin-sdk.iife.js` may become a secondary
  target depending on the §6 compatibility-plan outcome.
- **Exact endpoint change category defined.** §5.1 records
  `render_legacy_collect → sprint2_v1_event`; §5.2 records the
  two literal endpoint URLs (publicly observable, non-secret).
- **Full Sprint 2 browser event compatibility plan included.**
  §6.1 enumerates all eight required validator fields
  (`event_name`, `schema_key`, `schema_version`,
  `client_event_id`, `event_type`, `event_origin`, `occurred_at`,
  `session_id`) plus the envelope rules (single top-level JSON
  object, `Content-Type: application/json`) plus the
  proof-invalidity clause and the Gate 4C status clause.
- **FetchTransport configured path required.** §6.2 step 2
  (PR#18ae) explicitly requires the configured fetch-based
  transport path with `keepalive: true` if applicable,
  `Content-Type: application/json`, `JSON.stringify` of one
  Sprint 2 event object, and the full §6.1 eight-field shape.
- **sendBeacon labelled secondary / non-configured.** §6.2 step
  2's `BeaconTransport` paragraph labels any sendBeacon mention
  as secondary / non-configured and explicitly states a
  `sendBeacon`-only test is a false compatibility proof unless a
  later PR explicitly changes the configured production transport
  binding from FetchTransport to BeaconTransport under its own
  Helen GO.
- **Exact hash plan defined.** §7 records the four §3.2 baseline
  sha256 values; §8 records the pre / post / unchanged
  requirements.
- **Canary scope defined.** §10 records the three canary
  categories (passive organic, synthetic, controlled
  single-page) and forbids Track A / Playwright / multi-page /
  customer output.
- **Stop-lines defined.** §12 enumerates 15 stop-lines.
- **Proof fields defined.** §11 enumerates the required Gate 4C
  execution proof fields.
- **Rollback plan references PR#18z / PR#18aa evidence.** §9
  carries the PR#18z bundle identity, the
  `ROLLBACK-PROCEDURE.md` location, and the bundle-intact verify
  shape forward.
- **Scoring / output locks carried forward.** §14 records all
  eleven `*_allowed=false` / `allowed_customer_language=[]`
  locks from PR#18ab §9 verbatim.
- **26-row warning carried forward.** §15 records the PR#17s /
  PR#18w warning verbatim with the do-not-delete / do-not-mutate
  / do-not-annotate / do-not-normalise rule and the Gate 4C
  recurrence watch.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside §5 / §6 / §13 / §16
  forbiddance lists; no leaked value.
- **No runtime / config changes.** PR#18ac is purely a docs-only
  planning artefact; it touches no code, no config, no DB, no
  website artifact, no route, no collector, no scoring worker,
  no Lane writer, no AMS bridge / runtime, no dashboard, no
  customer output, no production infrastructure.

---

## 18. Files planned to change

### 18.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` | NEW | 1309 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

### 18.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#18ac does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any
way. No commands of any kind are executed against the production
host.

---

End of PR#18ac. **Gate 4C endpoint flip / canary planning.
Verdict: PLANNING_ONLY — Gate 4C not approved, no production
execution. Gate 4C execution readiness sub-status:
BLOCKED_PENDING_COMPATIBILITY_PLAN. Carries forward the merged
Gate 4A / Gate 4B evidence chain (PR#18v PASS, PR#18w
PASS_WITH_WARNINGS, PR#18x PLANNING / CHECK ONLY, PR#18y
BLOCKED → PR#18z PASS → PR#18aa PASS, PR#18ab
GOVERNANCE_RECAP_ONLY). Defines the primary target file
(`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`)
and the three non-target files (`thin-sdk.iife.js`,
`br-probe-init.js`, `index.html`) with the caveat that
`thin-sdk.iife.js` may become a secondary target if the §6
compatibility plan requires a bundle-level update per PR#17s
§11.1. Defines the categorical endpoint change
`render_legacy_collect → sprint2_v1_event` (literal URLs
`https://buyerrecon-backend.onrender.com/collect` →
`https://buyerrecon.com/v1/event`, both publicly observable and
non-secret). Defines the full required Sprint 2 browser event
shape at §6.1: single top-level JSON object, Content-Type
application/json, plus the eight required validator fields
(event_name, schema_key, schema_version three-component semver,
client_event_id UUIDv4/UUIDv7, event_type, event_origin,
occurred_at, session_id) with proof-invalidity clause and Gate 4C
status clause. Defines the configured production transport path
at §6.2 as FetchTransport / fetch-based POST with keepalive if
applicable, Content-Type application/json, JSON.stringify of one
single Sprint 2 event object, and the full §6.1 eight-field
shape; sendBeacon / BeaconTransport labelled secondary /
non-configured with explicit false-compatibility-proof warning
unless a later PR explicitly changes the configured production
transport binding under its own Helen GO. Defines the exact
pre-change hash table (four baselines: br-thinlayer-init.js
`9b0e4530…cc2efda0`, thin-sdk.iife.js `7098d648…c53538d1`,
br-probe-init.js `09d68188…17060f84`, index.html
`30b46c12…3810965c`) and the post-change hash requirements
(changed target file new sha256 must be pre-recorded and
verified; unchanged non-target files must remain byte-identical
to baseline). Defines the rollback plan referencing the PR#18z
bundle `buyerrecon-gate4b-rollback-20260524T115806Z`, the on-host
`ROLLBACK-PROCEDURE.md`, the `sha256sum -c MANIFEST.txt`
bundle-intact verify, and the pre-restore `stat -c '%a %U:%G
%n'` step. Defines the canary scope as one of three narrow
categories (passive organic, synthetic operator-generated,
controlled single-page test) on one site (`buyerrecon.com`) one
endpoint (`/v1/event`) one short window, forbidding Track A,
Playwright, multi-page test, customer output, and runtime
scoring activation. Defines fifteen stop-lines including
`request_body_invalid_json_observed_post_flip` (a single
recurrence of the PR#17s pattern is a hard stop). Defines the
Gate 4C execution proof fields (operator identity category,
timestamps, target file(s), before / after hashes, endpoint
category, canary scope, ingest / accepted / rejected counts
before / after, Lane A / B row counts before / after, rollback
bundle identity, no-secret-printed attestation,
no-customer-output attestation,
no-scoring-runtime-activation attestation, no-Lane-writer
attestation, final verdict PASS / PASS_WITH_WARNINGS /
ROLLED_BACK / BLOCKED). Defines the read-only DB observation
posture (production_audit_readonly credential only, count-only
queries, no raw payloads / request_ids / session_ids, no
mutation of the 26 historical PR#17s rows). Carries the PR#18ab
governance locks forward verbatim (`customer_claim_allowed=false`,
`customer_visibility_allowed=false`, `lane_output_allowed=false`,
`lane_write_allowed=false`, `runtime_scoring_allowed=false`,
`ams_trust_runtime_allowed=false`, `pass1_runtime_allowed=false`,
`pass2_runtime_allowed=false`,
`dashboard_customer_output_allowed=false`,
`sales_claim_upgrade_allowed=false`,
`allowed_customer_language=[]`). Carries the PR#17s / PR#18w
26-row warning forward verbatim with do-not-delete /
do-not-mutate / do-not-annotate / do-not-normalise rule and a
Gate-4C-specific recurrence watch. Records the §6
compatibility-plan path forward (PR#18ad Gate 1 contract diff →
PR#18ae Option A bundle update → PR#18af Gate 2 staging fixture
dry-run → PR#18ag Gate 3 runtime privilege simulation → PR#18ah
Gate 4 PR B bundle deploy → PR#18ai Gate 4 PR C `endpointUrl`
re-flip = Gate 4C → PR#18aj Gate 4 PR D passive organic
observation), each step requiring its own explicit Helen GO.
The repo change is docs-only. No code, scripts, tests, package
files, migrations, `schema.sql`, env files, systemd / Nginx
files, AMS source, website artifacts, production config, or DB
grant files modified in the repo. No production-host write, no
production-host read, no HTTP call, no command execution of any
kind is performed by PR#18ac. No `endpointUrl` re-flip, no Gate
4C approval, no Gate 4C canary, no production traffic
generation, no `buyerrecon.com` production `/v1/event` call, no
Render `/collect` call, no `/var/www` edit, no symlink change,
no `nginx -s reload`, no `systemctl` action, no service
restart, no DNS change, no DB write, no DB grant, no migration,
no `schema.sql` change, no env file edit, no credential
rotation, no `buyerrecon_prod_collector_app` reset, no
`buyerrecon_migrator` reset, no production token provisioning,
no Lane A / B writer, no runtime scoring, no AMS Trust runtime,
no Pass 1 runtime, no Pass 2 runtime, no customer-facing output,
no dashboard implementation, no AMS bridge activation, no Track
A, no Playwright, no website ThinSDK production-mode activation,
no production artifact / config mode flip, no Gate 4D
observation, no Gate 4E Track A / Playwright work, no deletion /
mutation / annotation / normalisation of the 26 historical
PR#17s rows on the production cluster, no customer-facing
language upgrade, and no secret printing are approved by
PR#18ac. Any future PR#18ad / PR#18ae / PR#18af / PR#18ag /
PR#18ah / PR#18ai / PR#18aj compatibility-plan PR, Gate 4C
execution PR, Gate 4D observation PR, Gate 4E Track A /
Playwright PR, scoring / governance / output PR, Lane A / B
writer PR, AMS bridge / runtime PR, Pass 1 / Trust / Pass 2
runtime PR, dashboard PR, customer-facing report PR,
customer-facing claim / marketing / sales material PR,
issue-fix PR, runtime PR, or final cutover-readiness claim PR
remains separately gated by its own explicit Helen GO.**
