# Sprint 2 PR#18ad: Gate 1 Static Contract Diff Confirmation

> Docs-only static-inspection proof. No code change. No production
> command. No `/var/www` change. No `endpointUrl` re-flip. No canary.
> No production traffic generation. No `curl` to the production
> collector. No browser / live traffic. No DB write. No DB grant. No
> migration. No `schema.sql` change. No Nginx reload. No `systemctl`.
> No DNS change. No Track A. No Playwright. No customer output. No
> Lane writer. No runtime scoring. No AMS Trust / Pass 1 / Pass 2
> runtime. No website artifact / config activation. No secrets. No
> raw tokens. No raw payloads printed.

---

## 1. Status / verdict

**Verdict: PASS.**

PR#18ad is the **Gate 1 static contract diff confirmation** (per
PR#18ac §6.2 step 1 / PR#17s §11.6). Its scope is strictly:
record, against repo-local sources only, the categorical static
diff between

- **(A)** the current BuyerRecon website ThinSDK / init emitted
  browser payload shape, and
- **(B)** the Sprint 2 backend `/v1/event` collector required
  browser event contract.

PR#18ad's `PASS` verdict means **the static mismatch is recorded
clearly enough to drive PR#18ae's bundle-update plan**. It does
**not** mean the bundle has been fixed; it does **not** unblock
Gate 4C execution; it does **not** authorise any traffic, flip,
canary, or artifact change.

### 1.1 Why `PASS` and not `PASS_WITH_WARNINGS`

The §6 static diff table identifies every required Sprint 2
field, marks every position with one of the four allowed states
(`match`, `mismatch`, `unknown_not_proven`, `source_missing`),
and never asserts compatibility on the side of (A) without
evidence. That is the success criterion PR#18ac §6.2 step 1 sets:
"identify exactly which fields / shape / transport in the bundle
must change". Recording an `unknown_not_proven` row is a valid
identification — it tells PR#18ae what it must prove.

### 1.2 What this PR is NOT

- **NOT** a runtime test. No `fetch` or `sendBeacon` call is
  executed against any collector by this PR.
- **NOT** an unblock of Gate 4C. Per PR#18ac §1, Gate 4C
  execution remains **`BLOCKED_PENDING_COMPATIBILITY_PLAN`**;
  PR#18ad confirms the block is correct, then defines what
  PR#18ae must do to lift it.
- **NOT** an inspection of the website / artifact repository.
  Helen's working-tree discipline requires the static
  inspection to use **repo-local sources only**. If a row in the
  static diff cannot be answered from this backend repo, it is
  recorded as `source_missing` or `unknown_not_proven`; PR#18ae
  is responsible for closing those rows under its own scope.
- **NOT** a runtime / production query. No `psql` against
  production, no `curl` against any endpoint, no `/var/www`
  read, no `sha256sum` against any live artifact.

### 1.3 Carry-forward governance posture

- **Gate 4B artifact / config / rollback re-audit:** **non-`BLOCKED`**
  (PR#18aa PASS, recorded on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip execution:** **still unapproved /
  `BLOCKED_PENDING_COMPATIBILITY_PLAN`** per PR#18ac.
- **Gate 4D organic observation:** unapproved.
- **Gate 4E Track A / Playwright:** unapproved.
- **PR#17s / PR#18w 26-row historical warning preserved.** See
  §7.

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

## 2. Why PR#18ad exists

PR#18ac / PR #63 records Gate 4C execution as
`BLOCKED_PENDING_COMPATIBILITY_PLAN` because the on-host bundle
`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
remains at sha256 `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` —
the same bundle lineage that produced the 26 historical HTTP `400`
`request_body_invalid_json` rows on `2026-05-19` (PR#17s,
PR#18w §3.5). PR#18ac §6.2 step 1 then defines this PR as the
**Gate 1 static contract diff confirmation** that must precede
any bundle update, staging dry-run, runtime simulation, endpoint
flip, or canary.

PR#18ad's job is to:

1. **Confirm exactly why the current bundle cannot be flipped
   directly to `/v1/event`.** This is a static-inspection answer,
   not a runtime test.
2. **Identify which fields / shape / transport in the bundle
   must change.** From repo-local sources, with `unknown_not_proven`
   / `source_missing` recorded honestly for every position that
   cannot be inspected without the website / artifact repo.
3. **Define the inputs PR#18ae (Option A bundle update) needs.**
   PR#18ae is the next sub-step in the compatibility-plan path
   (PR#18ac §6.2 step 2); it can only proceed if PR#18ad records
   the diff cleanly.

PR#18ad does **not** itself implement Option A, does **not** run
a staging fixture (that is PR#18af), does **not** deploy the
updated bundle (PR#18ah), does **not** flip the endpoint
(PR#18ai), and does **not** observe organic traffic (PR#18aj).

---

## 3. Source inputs reviewed

PR#18ad uses **repo-local sources only**. No production query,
no `/var/www/` read, no HTTP call.

### 3.1 Backend validator + tests (Sprint 2 contract source of truth)

The backend-side required contract is derivable in full from
this repo:

- **`src/collector/v1/validation.ts`** — `validateEventCore()`
  function (Steps 1 → 8) and supporting type-origin matrix +
  semver regex + UUIDv4/v7 detector. Present in repo; lines
  176–268 cover the deterministic check order.
- **`tests/v1/validation.test.ts`** — exhaustive validator
  fixtures asserting per-field reject codes (`event_origin_invalid`,
  `event_type_invalid`, `session_id_missing`,
  `session_id_invalid`, `event_name_invalid`, `schema_unknown`,
  `schema_version_malformed`, `client_event_id_missing`,
  `client_event_id_invalid`, `occurred_at_*`).
- **`tests/v1/envelope.test.ts`** — envelope-level reject tests
  including the smoking-gun case at line 106:
  > "rejects /v1/event body that is a JSON array (envelope shape)
  > → request_body_invalid_json"
  plus null-body, primitive-body, malformed-JSON branches, and
  Content-Type variants.

### 3.2 Website / artifact source (NOT in this repo)

The current production ThinSDK / init source is **not** present
in this backend repo. Checked locations:

- Repo root: no `thin-sdk*`, `br-thinlayer*`, or `br-probe*`
  file.
- No `thinlayer/`, `thinsdk/`, `thin-sdk/`, `website/`, or
  `client/` directory.

**Recorded:**

- `source_missing_for_static_bundle_inspection`: **`yes`**.

Per Helen's working-tree discipline: "do not guess". PR#18ad
records this gap honestly. **PR#18ae must inspect the website /
artifact repository (or a controlled local checkout of the
production-host static artifact source) under its own approved
scope.** PR#18ad does not authorise that inspection — it
identifies it as a precondition.

### 3.3 Governance context (carried, not re-inspected)

- `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` —
  PR#18ac planning baseline. Recorded the
  `BLOCKED_PENDING_COMPATIBILITY_PLAN` sub-status and the
  PR#18ad → PR#18aj sub-step sequence in §6.2. PR#18ad implements
  step 1 of that sequence.
- `docs/sprint2-pr18ab-final-scoring-governance-recap.md` — the
  eleven `*_allowed=false` governance locks (carried in §11
  here).
- `docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md`
  §3.5 — the 26-row historical warning (carried in §7 here).
- `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` —
  the prior ThinSDK contract-shape inspection. PR#17s §5 / §8 /
  §10 inspected the bundle at the time of the 26-row incident;
  PR#18ad does **not** re-inspect the bundle (the source is not
  in this repo), and instead records `unknown_not_proven` /
  `source_missing` for every (A)-side row.

---

## 4. Sprint 2 `/v1/event` required browser event contract

This section records the full required browser event shape,
derived directly from `src/collector/v1/validation.ts` + the
backend test fixtures.

### 4.1 Envelope

- **Single top-level JSON object.** `validateEventCore()` at
  `src/collector/v1/validation.ts:180` rejects any non-object or
  array (`Array.isArray(input.event)` → `missing_required_field`
  per-event reject). The route-level envelope parser additionally
  rejects top-level arrays, `null`, and primitives at `/v1/event`
  with `request_body_invalid_json` (see `tests/v1/envelope.test.ts`
  lines 106 / 115 / 124).
- **Not a top-level array.** A top-level JSON array `[event1,
  event2, …]` (legacy `/collect` shape) is the explicit
  smoking-gun reject case.
- **Not `{events: [...]}` either.** That wrapper belongs to
  `/v1/batch`, not `/v1/event`. PR#17s §7 records that
  `/v1/batch` is feature-flagged off and not Nginx-routed on
  `buyerrecon.com`.
- **Not a primitive / `null`.** Both reject as
  `request_body_invalid_json` per `tests/v1/envelope.test.ts`
  lines 115 / 124.
- **Content-Type:** `application/json` or compatible JSON
  content type (`isJsonContentType()` accepts plain
  `application/json` and `application/json; charset=utf-8` —
  `tests/v1/envelope.test.ts` lines 34 / 38). Any other
  Content-Type rejects as `content_type_invalid` → HTTP `415`.

### 4.2 Required event-object fields

Derived from `validateEventCore()` deterministic Step 1 → Step 8
order at `src/collector/v1/validation.ts:163–175` and confirmed
against `tests/v1/validation.test.ts` per-step reject fixtures:

| # | Field | Type / format | Reject code on absence / wrong value |
|---|---|---|---|
| 1 | `event_origin` | one of `{browser, server, system}`; must agree with `event_type` matrix | `event_origin_invalid` / `event_type_invalid` |
| 2 | `event_type` | one of `{page, track, identify, group, system, debug}`; matrix-consistent with `event_origin` | `event_type_invalid` |
| 3 | `session_id` | **required** for `event_origin === "browser"`; non-empty string; optional for server/system but non-empty if present | `session_id_missing` (browser) / `session_id_invalid` (server/system non-empty path) |
| 4 | `event_name` | non-empty string | `event_name_invalid` |
| 5 | `schema_key` | non-empty string | `schema_unknown` |
| 6 | `schema_version` | three-component semver matching `/^\d+\.\d+\.\d+$/` | `schema_version_malformed` |
| 7 | `client_event_id` | UUIDv4 or UUIDv7 (RFC 4122 variant, strict regex) | `client_event_id_missing` / `client_event_id_invalid` |
| 8 | `occurred_at` | ISO-8601 string OR epoch-ms number; window `[now − 24h, now + 5min]` | `occurred_at_missing` / `_invalid` / `_too_old` / `_too_future` |

### 4.3 Known constraints

- **`occurred_at` valid window:** `[now − 24h, now + 5min]`.
  Validation occurs against `Date.now()` (or `now_ms` override
  for deterministic tests).
- **`event_origin = "browser"` requirement:** browser-origin
  events **must** carry a non-empty string `session_id`.
- **`session_id` required for browser origin:** strict; missing
  / empty → `session_id_missing`.
- **Workspace / site binding derived from token / auth, not
  client truth.** PR#17s §6.6 records: "the **token binding**
  is the source of truth for `workspace_id` and `site_id`;
  whatever the body claims is overridden / ignored". The
  validator does **not** read `workspace_id` / `site_id` from
  the event object; those values come from the
  `site_write_tokens` row keyed by the token hash.
- **First-win reject ordering.** An event missing `event_name`
  never even reaches the `schema_key` / `schema_version` /
  `client_event_id` checks (PR#17s §6.4).

### 4.4 What `/v1/event` does NOT require

For completeness, the validator does **not** require:

- A top-level wrapper object with an `events: [...]` key (that's
  `/v1/batch`).
- `workspace_id` / `site_id` in the body (auth-derived).
- `client_timestamp_ms`, `timestamp`, `anon_session_id`,
  `anon_browser_id`, `client_event_id` as non-UUID, or
  `consent_signal` (legacy `/collect` field names per PR#17s
  §9 mismatch table).

---

## 5. Current ThinSDK / init emitted shape (static evidence)

This section records what can be proven statically from
**repo-local sources only**. The website / artifact source is
**not** in this repo (§3.2), so most rows are
`static_source_not_found` or `unknown_not_proven`. The only
shape evidence available locally is:

- **Endpoint posture** (from PR#18p §3.2 + PR#18aa §5.5
  production-host `grep -c` counts; carried forward by reference,
  not re-inspected): `br-thinlayer-init.js /collect count = 1`,
  `/v1/event count = 0`; the live bundle still points at the
  Render legacy `/collect` collector.
- **Bundle integrity** (from PR#18aa §5.4): all four artifact
  sha256 hashes match the PR#17s-era baseline; the bundle has
  not changed since the 26-row incident.

For everything below, the answer to "what does the emitted
payload look like?" cannot be proven from this repo alone:

| Static-side row | Status (from this repo) |
|---|---|
| Top-level object vs top-level array | `unknown_not_proven` — bundle source not in repo; PR#17s §10 ranks H1 (top-level array) as most likely cause of 26-row incident but the bundle is not re-inspectable here |
| Content-Type emitted at runtime | `unknown_not_proven` — depends on transport configuration in the bundle; not visible from backend repo |
| Transport: FetchTransport / fetch vs BeaconTransport / sendBeacon | `unknown_not_proven` — bundle source not in repo |
| `JSON.stringify` behaviour (single object vs array vs primitive) | `unknown_not_proven` — bundle source not in repo |
| `event_name` present in emitted payload | `static_source_not_found` |
| `schema_key` present in emitted payload | `static_source_not_found` |
| `schema_version` present + semver format | `static_source_not_found` |
| `client_event_id` present + UUIDv4/v7 format | `static_source_not_found` |
| `event_type` present + valid enum | `static_source_not_found` |
| `event_origin` present + valid enum | `static_source_not_found` |
| `occurred_at` present + format | `static_source_not_found` |
| `session_id` present + non-empty | `static_source_not_found` |
| Payload field names — legacy vs Sprint 2 | `unknown_not_proven` — PR#17s §9 prior-inspection mismatch table is a strong indicator that legacy names (`client_timestamp_ms`, `anon_session_id`, etc.) are still present, but the current bundle is not re-inspectable from this repo |
| `endpointUrl` currently points to Render legacy `/collect` | **`match`** — proven by PR#18p §3.2 + PR#18aa §5.5 (`br-thinlayer-init.js /collect count = 1`, `/v1/event count = 0`) carried forward |
| `/v1/event` inactive on the website | **`match`** — proven by PR#18aa §5.5 `sprint2_endpoint_config_present = no`, `both_collect_and_v1event_present = no` carried forward |

### 5.1 What "static_source_not_found" means

The ThinSDK bundle source (`thin-sdk.iife.js`,
`br-thinlayer-init.js`, `br-probe-init.js`) is the input that
produces the emitted browser payload. That source is **not in
this backend repo**. Without access to it (or a fresh static
read of the on-host bundle, which PR#18ad does not authorise),
the emitted shape can only be inferred indirectly:

- PR#17s §5 conducted a prior static inspection of the bundle
  against the same hash; its findings are documentary evidence
  but are **not** a fresh PR#18ad inspection.
- The 26 historical rows themselves are runtime evidence that
  the emitted shape was rejected by `/v1/event` at the envelope
  parse stage — strongly consistent with a top-level array
  shape (H1) — but again, not a static-source inspection.

PR#18ad records these as `unknown_not_proven` / `static_source_not_found`
because Gate-1's job is to identify exactly what PR#18ae must
inspect under its own scope. **Recording an unknown is a valid
Gate 1 outcome.**

### 5.2 What can be inferred (but not asserted)

Three indirect inferences exist; they are recorded here as
**informational only**, not as Gate-1 conclusions:

1. **H1 (top-level array) is plausible.** PR#17s §10 ranks
   H1 highest; the smoking-gun test
   (`tests/v1/envelope.test.ts:106`) shows top-level array →
   `request_body_invalid_json`; the 26 rows match exactly that
   reject code. But the bundle's emission is not re-inspected
   here.
2. **Legacy field names are plausible.** PR#17s §8 / §9
   recorded a legacy field set incompatible with Sprint 2.
   PR#18ad cannot re-inspect, so the field-name set is
   `unknown_not_proven`.
3. **Bundle has not changed since the 26-row incident.**
   PR#18aa §5.4's four sha256 hashes match PR#17s-era; bundle
   contents are byte-identical to the bundle that produced the
   26 rows. This is the strongest indirect evidence that
   whatever shape the bundle emits today is the same shape that
   was rejected on `2026-05-19`.

PR#18ae must convert these inferences into direct static
findings (or refute them) under its own scope.

---

## 6. Static diff table

The five-column diff table required by Helen's spec. Each row's
status is one of `match`, `mismatch`, `unknown_not_proven`,
`source_missing`. Evidence sources are repo-local references.

| Sprint 2 required contract | Current ThinSDK / init static evidence | Status | Evidence source | PR#18ae required fix / proof |
|---|---|---|---|---|
| **Single top-level JSON object** (not array, not `{events:[]}`, not primitive, not `null`) | bundle source not in this repo; 26-row incident strongly suggests top-level array | `unknown_not_proven` (likely `mismatch` per PR#17s §10 H1) | `src/collector/v1/validation.ts:180`; `tests/v1/envelope.test.ts:106`; PR#17s §10 | PR#18ae must statically inspect the emit-path in `thin-sdk.iife.js` / `br-thinlayer-init.js` (or successor) and prove the body is a single JSON object via `JSON.stringify(eventObject)`; unit test must assert against the canonical fixture |
| **`Content-Type: application/json`** (or `…; charset=utf-8`) | bundle source not in this repo; transport's request-init not visible | `unknown_not_proven` | `src/collector/v1/validation.ts` route layer; `tests/v1/envelope.test.ts:34, 38` | PR#18ae must assert the outgoing `Content-Type` header against the canonical fixture; reject any other value |
| **Transport: configured FetchTransport** (per PR#18ac §6.2 step 2) | bundle source not in this repo; configured transport binding not visible | `unknown_not_proven` | `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` §6.2 step 2 | PR#18ae must exercise the configured FetchTransport / `fetch()`-based POST path explicitly (not a `sendBeacon` mock). A `sendBeacon`-only proof is a **false compatibility proof** (PR#18ac §6.2 step 2) |
| **`JSON.stringify` of one single Sprint 2 event object** (not an array body, not `{events:[...]}`) | bundle source not in this repo | `unknown_not_proven` | `tests/v1/envelope.test.ts:106` smoking-gun | PR#18ae fixture must serialise to a single top-level object via `JSON.stringify(eventObject)`; a top-level array or wrapped object is a test failure |
| `event_name` — non-empty string | bundle source not in this repo; PR#17s §9 mismatch table is indicative but not re-proven here | `static_source_not_found` | `src/collector/v1/validation.ts:211–215`; `tests/v1/validation.test.ts` | PR#18ae must set `event_name` to a non-empty string in the canonical fixture; rejection code on absence is `event_name_invalid` |
| `schema_key` — non-empty string | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:217–222` | PR#18ae must set `schema_key` to a non-empty string |
| `schema_version` — three-component semver | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:224–228`; `SEMVER_RE` | PR#18ae must set `schema_version` matching `/^\d+\.\d+\.\d+$/` |
| `client_event_id` — UUIDv4 or UUIDv7 | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:230–238`; `detectClientEventIdFormat()` | PR#18ae must generate / pass through a UUIDv4 or UUIDv7; non-UUID rejects with `client_event_id_invalid` |
| `event_type` — string in `{page, track, identify, group, system, debug}`, matrix-consistent with `event_origin` | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:105–124`; `ALLOWED_TYPES_BY_ORIGIN` | PR#18ae must set a valid `event_type` matching the canonical browser-origin matrix entry |
| `event_origin` — string in `{browser, server, system}`, matrix-consistent | bundle source not in this repo (production canary expects `"browser"`) | `static_source_not_found` | `src/collector/v1/validation.ts:105–124`; `VALID_EVENT_ORIGINS` | PR#18ae must set `event_origin = "browser"` for ThinSDK-originated events |
| `occurred_at` — ISO-8601 string or epoch-ms number within `[now − 24h, now + 5min]` | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:240–263` | PR#18ae must emit a valid `occurred_at` at send time |
| `session_id` — non-empty string (mandatory for browser origin) | bundle source not in this repo | `static_source_not_found` | `src/collector/v1/validation.ts:193–209` | PR#18ae must emit a non-empty `session_id` for browser-origin events; absence → `session_id_missing` |
| `endpointUrl_category` — currently `render_legacy_collect`; must remain so until Gate 4C | `br-thinlayer-init.js /collect count = 1`, `/v1/event count = 0`; production posture unchanged | **`match`** | PR#18p §3.2; PR#18aa §5.5 (carried forward) | No change in PR#18ae; PR#18ae must keep `endpointUrl` pointed at the Render legacy `/collect` URL while the bundle update lands (PR#18ah deploys the updated bundle; PR#18ai re-flips later) |
| Token / auth binding posture — `site_write` token; `workspace_id` / `site_id` derived from token, not body | bundle source not in this repo; PR#17o + PR#17s §6.6 indicate the bundle's auth binding worked correctly at the 26-row time (`auth_status=ok` × 26) | `unknown_not_proven` for emit path; **`match`** for auth-derivation rule on the server side | `src/collector/v1/validation.ts` (auth-derived workspace / site); PR#17s §6.6 | PR#18ae must preserve the existing site-write token binding for `buyerrecon.com`; no token regeneration in this sub-step |

### 6.1 Aggregate diff outcome

- **`match`:** 2 rows (`endpointUrl_category`, server-side
  token/auth derivation rule).
- **`mismatch`:** 0 rows recorded with certainty from repo-local
  sources alone. (PR#17s §10 indicates H1 / legacy-field-names
  / wrong-shape are highly likely mismatches; PR#18ad does not
  promote inference to mismatch without direct static
  evidence.)
- **`unknown_not_proven`:** 5 rows (envelope shape, Content-Type,
  transport binding, JSON.stringify behaviour, payload-field-name
  set, emit-path token binding inspection).
- **`source_missing`:** 8 rows (each of the eight required
  event-object fields).

**PR#18ad's static-diff outcome:** the on-this-repo evidence is
insufficient by itself to declare any field-level `mismatch` —
but it is fully sufficient to identify that the bundle source
**must** be statically inspected by PR#18ae before any
endpoint-flip work proceeds. The known matches are the two
already-`match`-ed surface rules; everything else is
PR#18ae-scope.

---

## 7. H1 historical failure confirmation

PR#18ad carries the PR#17s / PR#18w 26-row warning forward
verbatim:

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
- **Preservation rule:** "**Do not delete, mutate, annotate, or
  normalise these rows.**" The on-host
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` `## Do-not
  rules` section independently records the same rule (PR#18z
  §G).

### 7.1 H1 support status from repo-local static sources

- **PR#17s §10 ranks H1** (top-level JSON array at `/v1/event`)
  as the most likely cause of the 26 rejections.
- **PR#18ac §5.5** records that the production
  `br-thinlayer-init.js` sha256 (`9b0e4530…cc2efda0`) is
  **identical** to the bundle in force on `2026-05-19`.
- **PR#18aa §5.4** re-confirms all four artifact hashes match
  baseline; the bundle has not changed.

PR#18ad's static-source determination on H1:

| Statement | Repo-local static support |
|---|---|
| The Sprint 2 `/v1/event` collector rejects a top-level JSON array with `request_body_invalid_json` | **Fully supported.** `tests/v1/envelope.test.ts:106` is the smoking-gun test; `src/collector/v1/validation.ts:180` is the validator hard-stop. |
| The current bundle emits a top-level JSON array | **Not directly inspectable from this repo.** Bundle source not present (§3.2 / §5). PR#17s §10 prior inspection ranked this most likely; PR#18aa hash comparison shows the bundle has not changed since; but PR#18ad does **not** re-inspect the emitted shape. |
| Therefore flipping `endpointUrl` against the current bundle would reproduce the 26-row failure mode | **Partially supported.** The implication holds **if** the bundle emits a top-level array; PR#17s §10's ranking + PR#18aa's bundle-hash continuity together make this the most defensible prediction, but the prediction's first conjunct (the bundle emits an array) is not fully proven from this repo alone. |

### 7.2 Conclusion for §7

PR#18ad confirms: **the backend-side rejection mechanism is
proven directly from repo sources; the bundle-side emission
mechanism is not directly proven from repo sources but is
strongly supported by PR#17s § 10 + PR#18aa hash continuity.**
PR#18ae must convert "strongly supported by indirect evidence"
into "directly proven by static inspection of the bundle source"
before PR#18ah deploys an updated bundle or PR#18ai flips the
endpoint.

The 26 rows themselves remain preserved and must continue to be
preserved by every downstream PR (do-not-delete / do-not-mutate /
do-not-annotate / do-not-normalise).

---

## 8. Transport proof requirement

PR#18ac §6.2 step 2 already records this requirement; PR#18ad
restates it for unambiguous propagation forward:

- **Gate 4C compatibility must be proven against the configured
  FetchTransport / fetch path.** That is the production transport
  binding for BuyerRecon's ThinSDK.
- **`sendBeacon` / `BeaconTransport` is secondary / non-configured.**
  It exists as an alternative-transport surface but is not the
  configured production path.
- **A `sendBeacon`-only proof is invalid.** Per PR#18ac §6.2
  step 2: "A test that passes against `navigator.sendBeacon`
  while production remains configured for `FetchTransport`
  would constitute a **false compatibility proof** — the fetch
  path's body serialisation, header semantics, and keepalive
  behaviour are not guaranteed equivalent to `sendBeacon`'s
  Blob-wrapped transport, and only the actually-configured
  path's evidence can satisfy the Gate 4C compatibility gate."
- **Transport-binding change requires its own Helen GO.** If a
  later PR proposes that production should switch from
  `FetchTransport` to `BeaconTransport`, that change is itself a
  separate governance action, not a side-effect of PR#18ae.
  PR#18ad does **not** authorise such a transport change.

---

## 9. PR#18ae Option A requirements

Based on the §6 static diff, PR#18ae (Option A bundle update —
PR#18ac §6.2 step 2) **must**:

1. **Update bundle / artifact generation so the emitted payload
   is a single Sprint 2 event object** matching §4 envelope
   rules (single top-level JSON object; not array; not
   `{events:[...]}`; not primitive; not `null`).
2. **Use the configured FetchTransport path** (per §8 above).
   The test surface must exercise the configured transport
   explicitly; no parallel `sendBeacon` mock substituting for it.
3. **Set `Content-Type: application/json`** on the outgoing
   request (or `application/json; charset=utf-8`).
4. **`JSON.stringify` one event object.** The serialised body
   is exactly one top-level object; no array body, no wrapped
   `{events:[...]}` body, no serialised primitive.
5. **Include all eight required validator fields** (§4.2):
   `event_origin`, `event_type`, `session_id` (mandatory for
   browser origin), `event_name`, `schema_key`, `schema_version`
   (three-component semver), `client_event_id` (UUIDv4 /
   UUIDv7), `occurred_at`.
6. **Preserve the token / auth binding.** The site-write token
   for `buyerrecon.com` remains intact; no token regeneration
   or rotation in PR#18ae.
7. **Keep `endpointUrl` unchanged** during the bundle update.
   PR#18ae lands the new bundle while the live `endpointUrl`
   still points at the Render legacy `/collect` URL. PR#18ah
   deploys the updated bundle; PR#18ai is the later
   `endpointUrl` re-flip.
8. **Keep production `/v1/event` inactive** until later
   Gate 4C (PR#18ai). PR#18ae does not generate any production
   traffic against `/v1/event`.
9. **Include tests proving the emitted object passes the
   backend validator.** The canonical fixture must exercise
   `validateEventCore()` end-to-end against the canonical
   payload and assert `ok: true` (or use the published mock if
   that's the project's convention).
10. **Include tests proving no top-level array or
    `{events:[...]}` wrapper is emitted.** Snapshot or
    byte-for-byte assertion against the canonical fixture.
11. **Include no raw token or secret in test output.** No
    `Authorization:` header value, no bearer token, no raw
    `request_id`, no raw `session_id`, no raw payload body
    printed in any test output, snapshot, or CI log.

PR#18ae must **not**:

- deploy the updated bundle to production (that is PR#18ah's
  scope),
- flip `endpointUrl` (that is PR#18ai's scope),
- generate any production traffic,
- modify the production bundle's runtime alias,
- write to the database,
- change the production token,
- print any secret or raw payload.

---

## 10. Gate posture after PR#18ad

- **Gate 4C remains unapproved.** PR#18ad does not lift the
  PR#18ac `BLOCKED_PENDING_COMPATIBILITY_PLAN` sub-status; it
  confirms the block is correct and identifies what PR#18ae
  must do to lift it.
- **Execution remains blocked.** No endpoint flip, no canary,
  no production traffic, no `/var/www` edit, no DB change.
- **PR#18ad only confirms the static diff.** Recording matches /
  unknowns / source-missings against repo-local evidence is the
  complete scope.
- **Next step is PR#18ae — Option A bundle update.** PR#18ae
  must satisfy §9 above and inspect the website / artifact
  source under its own approved scope.
- **PR#18af staging fixture dry-run must happen after PR#18ae.**
  Per PR#18ac §6.2 step 3. PR#18af runs the updated bundle
  against a staging Sprint 2 collector instance.
- **No endpoint flip before PR#18ai.** Per PR#18ac §6.2 step 6.
  PR#18ah (bundle deploy with `endpointUrl` unchanged) is the
  intermediate production step; PR#18ai is the `endpointUrl`
  re-flip with controlled canary.

### 10.1 Compatibility-plan progress after PR#18ad

| Sub-step | Status after PR#18ad |
|---|---|
| PR#18ad — Gate 1 static contract diff confirmation | **PASS (this PR)** |
| PR#18ae — Option A bundle update | not yet opened |
| PR#18af — Gate 2 staging fixture dry-run | not yet opened |
| PR#18ag — Gate 3 runtime privilege simulation | not yet opened |
| PR#18ah — Gate 4 PR B bundle deploy (`endpointUrl` unchanged) | not yet opened |
| PR#18ai — Gate 4 PR C `endpointUrl` re-flip = Gate 4C | not yet opened |
| PR#18aj — Gate 4 PR D passive organic observation | not yet opened |

Each remaining sub-step requires its own explicit Helen GO.

---

## 11. Governance locks carried forward

The eleven PR#18ab §9 locks remain in force through and after
PR#18ad. PR#18ad flips none.

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

Each subsequent compatibility-plan PR (PR#18ae through PR#18aj)
must independently restate this set.

---

## 12. Non-goals

PR#18ad explicitly does **not** approve any of the following.
Each requires its own explicit Helen GO scoped to that specific
work:

- no code,
- no bundle update,
- no `endpointUrl` re-flip,
- no canary,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no `/var/www` edit,
- no symlink change,
- no `nginx -s reload`, no `systemctl` action, no service
  restart,
- no DNS change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no
  `buyerrecon_migrator` reset, no production token provisioning,
- no Track A invocation, no Playwright run,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no live website artifact / config change,
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane
  report / dashboard / API response / sales material /
  marketing copy / language upgrade),
- no runtime scoring,
- no Lane A / Lane B writer activation,
- no AMS Trust runtime,
- no Pass 1 runtime,
- no Pass 2 runtime,
- no Gate 4C execution, no Gate 4D observation, no Gate 4E
  Track A / Playwright work,
- no flipping of any PR#18ab §9 lock,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw
  `request_id`, raw `session_id`, raw payload, raw response
  body, env dump, private key / cert body, vault content, shell
  history, raw row data),
- no raw token printed,
- no raw payload printed.

---

## 13. Acceptance criteria

PR#18ad is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes:
  `docs/sprint2-pr18ad-gate1-contract-diff-confirmation.md`. No
  code, no scripts, no tests, no package files, no migrations,
  no `schema.sql`, no env files, no systemd / Nginx files, no
  AMS source, no website artifacts, no production config, no
  DB grant files change.
- **Static contract diff recorded.** §6 table records every
  required Sprint 2 contract row, the current static evidence
  from repo-local sources, the categorical status, the evidence
  source, and the PR#18ae required fix / proof.
- **Full Sprint 2 required shape recorded.** §4 enumerates the
  envelope rules + eight required event-object fields + the
  known constraints + what `/v1/event` does *not* require.
- **Current ThinSDK / static shape recorded or unknowns
  explicitly flagged.** §5 records `source_missing_for_static_bundle_inspection=yes`
  for the bundle source and marks each field-level row as
  `unknown_not_proven` or `static_source_not_found`.
- **Mismatch / unknowns clearly identified.** §6 aggregate at
  §6.1: 2 matches, 0 confirmed mismatches, 5 unknowns, 8
  source-missings.
- **PR#18ae requirements defined.** §9 enumerates 11 must-do
  items plus a must-not-do list.
- **H1 26-row warning carried forward.** §7 records the warning
  verbatim and assesses H1 support status from repo-local
  static sources.
- **FetchTransport requirement preserved.** §8 restates the
  configured-transport rule from PR#18ac §6.2 step 2.
- **sendBeacon-only proof invalid.** §8 restates this
  explicitly.
- **Gate 4C remains unapproved.** §10 confirms the
  `BLOCKED_PENDING_COMPATIBILITY_PLAN` sub-status remains in
  force.
- **PR#18ab locks preserved.** §11 carries all eleven
  `*_allowed=false` / `allowed_customer_language=[]` locks
  verbatim.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside forbiddance lists; no
  leaked value.
- **No runtime changes.** PR#18ad is purely a static-inspection
  artefact.

---

## 14. Files planned to change

### 14.1 Repo (this PR, docs-only, path-restricted)

| Path | Action | Lines |
|---|---|---|
| `docs/sprint2-pr18ad-gate1-contract-diff-confirmation.md` | NEW | 841 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

PR#18ad is **path-restricted** to the single new file above. If
the following appear in the working tree from prior tasks, they
remain **excluded** from PR#18ad's diff via `git diff --name-only
-- <this-file>` path restriction:

- `docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md` (now
  merged on base; not in diff anyway),
- `docs/engineering/pr19c-sprint4-governance-runtime-handoff.md`
  (intent-to-add carry-over from prior task),
- `docs/engineering/pr19d-sprint5-internal-learning-knob-handoff.md`
  (intent-to-add carry-over from prior task),
- `deep-research-report (23).md` through `(26).md` (untracked).

### 14.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#18ad does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any
way. No commands of any kind are executed against the production
host.

---

End of PR#18ad. **Gate 1 static contract diff confirmation.
Verdict: PASS. The Sprint 2 `/v1/event` required browser event
contract is recorded in full from repo-local sources
(`src/collector/v1/validation.ts` Steps 1 → 8; `tests/v1/
validation.test.ts`; `tests/v1/envelope.test.ts`): envelope must
be a single top-level JSON object (not array, not `{events:[...]}`,
not primitive, not `null`) with `Content-Type: application/json`
or compatible; eight required event-object fields (event_origin
in {browser, server, system}, event_type matrix-consistent in
{page, track, identify, group, system, debug}, session_id
mandatory for browser origin, event_name non-empty,
schema_key non-empty, schema_version three-component semver,
client_event_id UUIDv4/UUIDv7, occurred_at within
[now - 24h, now + 5min]); workspace_id / site_id derived from
token / auth, not body claim. The current ThinSDK / init source
is NOT present in this backend repo
(source_missing_for_static_bundle_inspection=yes); §5 records
unknown_not_proven for envelope shape / Content-Type / transport
/ JSON.stringify behaviour / each of the eight required-field
positions / payload-field-name set / emit-path token binding;
§5 records match for endpointUrl currently being
render_legacy_collect and /v1/event being inactive (proven by
PR#18p §3.2 + PR#18aa §5.5 carried forward) and for the
server-side auth-derivation rule. §6 static diff table:
2 matches, 0 confirmed mismatches from repo-local evidence
alone, 5 unknown_not_proven, 8 source_missing. §7 confirms the
backend-side rejection mechanism for top-level arrays at
/v1/event is fully proven (tests/v1/envelope.test.ts:106 +
src/collector/v1/validation.ts:180); the bundle-side emission
of a top-level array is not directly inspectable from this repo
but is strongly supported by PR#17s §10 H1 ranking + PR#18aa
bundle-hash continuity (br-thinlayer-init.js
9b0e4530…cc2efda0 unchanged since the 26-row incident).
§8 restates the configured-FetchTransport requirement and the
sendBeacon-only-proof-is-invalid rule from PR#18ac §6.2 step 2.
§9 enumerates 11 PR#18ae must-do requirements (single JSON
object body, FetchTransport, Content-Type application/json,
JSON.stringify one object, all eight required fields, preserve
token binding, keep endpointUrl unchanged, keep /v1/event
inactive, backend-validator-passing fixture test, no-top-level-
array test, no raw token / secret in test output) plus a
must-not-do list (no production deploy, no endpoint flip, no
production traffic, no runtime alias change, no DB write, no
token regeneration, no secret printing). §10 confirms Gate 4C
remains unapproved / BLOCKED_PENDING_COMPATIBILITY_PLAN; next
step is PR#18ae; no endpoint flip before PR#18ai. The 26
historical PR#17s rows on the production cluster remain
preserved and must not be deleted, mutated, annotated, or
normalised away. The eleven PR#18ab §9 governance locks remain
in force. The repo change is docs-only. PR#18ad is path-
restricted to the single new file
docs/sprint2-pr18ad-gate1-contract-diff-confirmation.md;
docs/sprint2-pr18ac-gate4c-endpoint-canary-planning.md (merged),
docs/engineering/pr19c-sprint4-governance-runtime-handoff.md
(intent-to-add carry-over), docs/engineering/
pr19d-sprint5-internal-learning-knob-handoff.md (intent-to-add
carry-over), and root deep-research-report (23..26).md files
(untracked) are all excluded from PR#18ad's diff. No code,
scripts, tests, package files, migrations, schema.sql, env
files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files modified in the repo. No
production-host write, no production-host read, no HTTP call,
no command execution of any kind is performed by PR#18ad. No
`endpointUrl` re-flip, no Gate 4C approval, no Gate 4C canary,
no production traffic generation, no `buyerrecon.com` production
`/v1/event` call, no Render `/collect` call, no `/var/www` edit,
no symlink change, no `nginx -s reload`, no `systemctl` action,
no service restart, no DNS change, no DB write, no DB grant,
no migration, no `schema.sql` change, no env file edit, no
credential rotation, no `buyerrecon_prod_collector_app` reset,
no `buyerrecon_migrator` reset, no production token
provisioning, no Lane A / B writer, no runtime scoring, no AMS
Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no
customer-facing output, no dashboard implementation, no AMS
bridge activation, no Track A, no Playwright, no website
ThinSDK production-mode activation, no production artifact /
config mode flip, no Gate 4D observation, no Gate 4E Track A /
Playwright work, no deletion / mutation / annotation /
normalisation of the 26 historical PR#17s rows on the
production cluster, no customer-facing language upgrade, no
raw token printed, no raw payload printed, and no secret
printing are approved by PR#18ad. Any future PR#18ae (Option A
bundle update) PR, PR#18af (Gate 2 staging fixture dry-run)
PR, PR#18ag (Gate 3 runtime privilege simulation) PR, PR#18ah
(Gate 4 PR B bundle deploy) PR, PR#18ai (Gate 4 PR C
`endpointUrl` re-flip = Gate 4C) PR, PR#18aj (Gate 4 PR D
passive organic observation) PR, Gate 4D observation PR,
Gate 4E Track A / Playwright PR, scoring / governance / output
lock-amendment PR, Lane A / B writer PR, AMS bridge / runtime
PR, Pass 1 / Trust / Pass 2 runtime PR, dashboard PR,
customer-facing report PR, customer-facing claim / marketing /
sales material PR, issue-fix PR, runtime PR, or final
cutover-readiness claim PR remains separately gated by its
own explicit Helen GO.**
