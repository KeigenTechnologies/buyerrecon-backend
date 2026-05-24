# Sprint 2 PR#18ae — Source reconciliation decision record

> **Posture:** docs-only handoff. No code change. No bundle build.
> No `endpointUrl` flip. No production traffic. No canary. No
> `/var/www` read or write. No DB change. No customer output. No
> Lane writer. No runtime scoring. No AMS Trust / Pass 1 / Pass 2
> runtime. No live website artifact / config change. No secrets.
> No raw token, no Authorization header value, no DSN, no raw
> payload printed.

> **Verdict superseded:** an earlier draft of this PR recorded
> `BLOCKED_SOURCE_MISSING`. That conclusion was scoped to the
> backend repo only and is **withdrawn**. A read-only inspection
> of `buyerrecon-website` and `KeigenTechnologies/ams` (recorded
> in §3) located the deployed artifact and its source. The
> current verdict is **`BLOCKED_SOURCE_RECONCILIATION_REQUIRED`**
> (classification: **MIXED / NEEDS_DECISION**).

---

## 1. Status / verdict

**`BLOCKED_SOURCE_RECONCILIATION_REQUIRED`** — classification
**MIXED / NEEDS_DECISION**.

The ThinSDK / browser artifact is **not** globally missing. It is
simply not owned by the backend repo. The inspection in §3
established:

- The **backend repo is not the browser artifact source** — and
  correctly so. Nothing should be built or duplicated here.
- **`buyerrecon-website` owns the website-repo static artifact and
  the init/config**, and the deployed `thin-sdk.iife.js` is
  **already Sprint 2-capable** (it carries the
  `mode: 'sprint2_v1_event'` envelope path).
- **Canonical AMS `main` does not contain the Sprint 2 envelope
  source.** The capability that shipped into the website
  artifact was built from a side-clone, and the source commit is
  not on `main`.
- A **source-of-truth reconciliation decision** is therefore
  required before any compatibility patch or deploy. The blocker
  is not "no source" — it is "source exists but the canonical
  source-of-truth is not the thing that produced the deployed
  capability".

So the compatibility *capability* is present and the activation
path is likely a small config opt-in (§5), but PR#18ae cannot
proceed to a patch/deploy step until the AMS source-integrity
question is resolved (§6 step 1).

### 1.1 Why `BLOCKED_SOURCE_RECONCILIATION_REQUIRED` and not `BLOCKED_SOURCE_MISSING`

`BLOCKED_SOURCE_MISSING` asserts the source cannot be found.
That is now false: the deployed artifact is in
`buyerrecon-website/thinlayer/` and the SDK source tree is in
`KeigenTechnologies/ams` at `thin/packages/thin-sdk/src/`. The
real blocker is narrower and more specific: the **Sprint 2
envelope source** that produced the deployed capability is only
in the local side-clone `/Users/admin/github/keigentechnologies/ams-pr17v`
and is **not** on canonical AMS `main`. That is a reconciliation
problem, not an absence problem — hence the renamed verdict.

### 1.2 What this PR is and is not

- **Is:** a docs-only handoff that (a) records where the
  artifact and source actually live, (b) states that the
  compatibility capability already exists in the deployed
  artifact, and (c) defines the decision + sequence required
  before any patch/deploy.
- **Is not:** the bundle update itself, a website config change,
  an AMS merge, an artifact rebuild, or a deploy. No file outside
  this doc has been edited. No tests were added (no code
  changed). No artifact was built or hashed.

### 1.3 Carry-forward governance posture

- **Gate 4B artifact / config / rollback re-audit:** non-`BLOCKED`
  (PR#18aa PASS, on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip execution:** still unapproved /
  **`BLOCKED_PENDING_COMPATIBILITY_PLAN`** per PR#18ac. PR#18ae
  does not change this.
- **Gate 4D organic observation:** unapproved.
- **PR#18ab governance locks:** all eleven flags remain `false` /
  `[]` (carried verbatim in §9 below).

---

## 2. Why PR#18ae exists

PR#18ae is the next sub-step in the compatibility-plan path
opened by PR#18ac §6.2 and confirmed by PR#18ad. The path is:

1. **PR#18ac (merged, #63).** Planned Gate 4C as
   `PLANNING_ONLY` / `BLOCKED_PENDING_COMPATIBILITY_PLAN`. The
   on-host bundle
   `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
   remains at sha256 `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
   — the same bundle lineage that produced the 26 historical
   HTTP `400` `request_body_invalid_json` rows on `2026-05-19`
   (PR#17s, PR#18w §3.5).
2. **PR#18ad (merged, #65).** Confirmed the static contract gap:
   `/v1/event` requires a single top-level JSON object; arrays,
   `{ events: [...] }`, primitives, and `null` are rejected;
   `Content-Type` must be JSON-compatible; the eight required
   browser event fields are `event_name`, `schema_key`,
   `schema_version`, `client_event_id`, `event_type`,
   `event_origin`, `occurred_at`, browser `session_id`. PR#18ad
   recorded that the website/artifact source was **not in the
   backend repo** — but it did **not** authorise inspection of
   the website/AMS repos, so it recorded the (A)-side rows as
   `source_missing` / `unknown_not_proven`.
3. **PR#18ae (this PR).** Was scoped by PR#18ac §6.2 step 2 as
   the Option A compatibility fix. Its first action was source
   discovery. An earlier draft, limited to the backend repo,
   concluded `BLOCKED_SOURCE_MISSING`. A subsequent **read-only
   inspection of `buyerrecon-website` and AMS** (this revision,
   §3) found the deployed artifact and source — so the verdict
   is revised to `BLOCKED_SOURCE_RECONCILIATION_REQUIRED`. The
   key correction: the source is **not** globally missing; it is
   split across repos and the canonical AMS source-of-truth is
   out of sync with the deployed capability.
4. **PR#18af (planned).** Staging fixture dry-run. Now gated
   behind two prerequisites (§6): an AMS source-reconciliation
   decision, then an approved website config/artifact patch.
5. **PR#18ag … PR#18ai (planned, unapproved).** Staging soak,
   canary scope, Gate 4C `endpointUrl` flip. None in scope for
   PR#18ae; none approved.

**`endpointUrl` remains unchanged in PR#18ae.** The production
endpoint category remains `render_legacy_collect`. Production
`/v1/event` remains inactive.

---

## 3. Source discovery

### 3.1 Method and boundary

All checks were **read-only**. No production host was read, no
live artifact fetched, no `/var/www` access, no `curl` to any
collector, no edit to any repo. The backend worktree
(`/Users/admin/github/buyerrecon-backend-pr18ae-clean`, base
`origin/sprint2-architecture-contracts-d4cc2bf` HEAD `25dcd58`)
was confirmed to contain no browser artifact source (no
`*-init.{js,ts}`, no `*.iife.js`, no `index.html`, no bundler
config, no `FetchTransport` / `endpointUrl` references). The
inspection then extended — under a separately scoped read-only
task — to `buyerrecon-website` and `KeigenTechnologies/ams`.

### 3.2 `buyerrecon-website` — deployed artifact + init/config (FOUND)

Repo: `/Users/admin/github/buyerrecon-website`, branch
`buyerrecon-pr17w-update-thinlayer-artifacts-from-ams-pr17v`.

Exact files found in `thinlayer/`:

- `thin-sdk.iife.js` — the built SDK (29069 B; updated 20 May).
  **Sprint 2-capable** (carries the `sprint2_v1_event` envelope
  path; see §4).
- `br-thinlayer-init.js` — the **website-owned init/config
  source** that wires the SDK (this is patchable in the website
  repo; see §5).
- `buyerrecon-adapter.iife.js` — built adapter.
- `br-probe-init.js`, `br-probe.iife.js` — built probe artifacts.

All **five** scripts are loaded **site-wide** (~103 HTML pages
reference `thinlayer/thin-sdk.iife.js`, `…/br-thinlayer-init.js`,
`…/buyerrecon-adapter.iife.js`, `…/br-probe-init.js`,
`…/br-probe.iife.js` via `<script defer>` tags).

The website repo has **no `package.json` and no bundler config**
(no vite/rollup/webpack/esbuild/tsup). It therefore holds the
**built SDK, not the SDK source** — it cannot rebuild
`thin-sdk.iife.js` itself. The init/config file
(`br-thinlayer-init.js`) is the only ThinSDK-related **source**
in this repo, and it is editable here.

Provenance doc found:
`buyerrecon-website/docs/pr17w-thinlayer-artifact-update-from-ams-pr17v.md`.
It records that `thin-sdk.iife.js` was copied byte-for-byte from
an AMS PR#17v build (AMS commit `13d49003c7ee7602df67049e019dfde483116f0f`,
built via `tsup`, output sha256
`048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`),
and that PR#17w was an **artifact update only — no deploy, no
`endpointUrl` flip, no Sprint 2 mode activation**.

### 3.3 `KeigenTechnologies/ams` — SDK source owner (SPLIT / UNRECONCILED)

AMS is the upstream SDK source and build owner: the ThinSDK
source tree is at `thin/packages/thin-sdk/src/` and is built
with `tsup`. **However:**

- **Canonical AMS `main`** (`/Users/admin/github/keigentechnologies/ams`,
  HEAD `9bf4cc9`) defines `TransportMode = 'mock' | 'beacon' |
  'fetch'` and its `createTransport` switch handles only those
  three. It contains **no `sprint2-envelope.ts`** and **no
  `sprint2_v1_event`** token anywhere in `thin/`. The PR#17v
  commit `13d4900` is **not an ancestor of `main` HEAD and is
  not present in the canonical clone at all**.
- The **`feat/thin-layer-v1`** branch in AMS also lacks the
  Sprint 2 envelope source.
- The **side-clone `/Users/admin/github/keigentechnologies/ams-pr17v`**
  **does** contain `thin/packages/thin-sdk/src/sprint2-envelope.ts`
  and the `sprint2_v1_event` token across `types.ts`,
  `transport.ts`, and `index.ts`. This side-clone (at commit
  `13d4900`) is the **only** source location of the Sprint 2
  capability that shipped into the deployed website artifact.

**Source-integrity risk:** the deployed Sprint 2-capable
artifact has **no maintained source-of-truth on canonical AMS
`main`**. A rebuild from current `main` would **lose** the
Sprint 2 envelope capability. This is the core reason for the
`BLOCKED_SOURCE_RECONCILIATION_REQUIRED` verdict.

---

## 4. Payload / transport finding (from the deployed artifact)

Established by reading the deployed `thin-sdk.iife.js` and the
`br-thinlayer-init.js` config (no payloads dumped; pattern-level
inspection only):

- **Configured transport: `fetch` / `FetchTransport`.**
  `br-thinlayer-init.js` calls `ThinSDK.init({ transport: 'fetch',
  … })`. `sendBeacon` / `BeaconTransport` exist in the artifact
  but are **not** the configured path.
- **`Content-Type: application/json`** is set on the POST; the
  fetch is issued with **`keepalive: true`**.
- **Current mode defaults to `legacy_array`.** The init does not
  pass a `mode` option, so the SDK's FetchTransport resolves
  `options?.mode ?? 'legacy_array'`.
- **Legacy mode emits a top-level array** — the SDK stringifies
  the whole queue (`JSON.stringify(this.queue.splice(0))`). This
  top-level-array body is exactly the shape the Sprint 2
  collector rejects as `request_body_invalid_json` (the 26-row
  incident, §8).
- **`sprint2_v1_event` mode emits a single object per event** —
  the SDK maps each queued event through the envelope mapper and
  stringifies one object (`for (…) { JSON.stringify(envelope(r)) }`).
  In this mode the emitted body satisfies the Sprint 2
  single-top-level-object contract and carries all eight required
  fields (`event_name`, `schema_key`, `schema_version`,
  `client_event_id`, `event_type`, `event_origin`, `occurred_at`,
  browser `session_id`).

So the deployed artifact already **can** emit the Sprint 2 shape;
it is gated behind the `mode` option, which the live init does
not set.

---

## 5. Endpoint finding + compatibility result

### 5.1 Endpoint finding

- The **active `endpointUrl` remains the Render legacy
  `/collect`**: `br-thinlayer-init.js` declares
  `endpointUrl: 'https://buyerrecon-backend.onrender.com/collect'`.
- **No `/v1/event` string is wired in the live config.** The
  Sprint 2 endpoint is not referenced by any active init file.
- **`endpointUrl` must not be flipped in PR#18ae.** Production
  `/v1/event` remains inactive.
- **Gate 4C remains unapproved.**

### 5.2 Compatibility result (supersedes "no compatibility patch possible")

The earlier draft's "no compatibility patch possible — source
missing" is **withdrawn**. The corrected result:

- **The compatibility capability is present in the deployed
  artifact.** `thin-sdk.iife.js` already implements the Sprint 2
  envelope (`sprint2_v1_event`) that emits a single Sprint 2
  object with all eight required fields over `FetchTransport`
  with `Content-Type: application/json`.
- **Activation is likely a `mode`/config opt-in**, not an SDK
  rewrite: adding `mode: 'sprint2_v1_event'` to the website's
  `ThinSDK.init({…})` call in `br-thinlayer-init.js`.
- **But the source-of-truth is not reconciled.** The canonical
  AMS `main` lacks the Sprint 2 envelope source (§3.3), so the
  deployed capability has no maintained upstream. Patching the
  website config to activate a capability whose source is
  orphaned would lock in a maintenance/audit gap.
- **Therefore: do not patch and do not deploy** until the source
  reconciliation decision in §6 step 1 is made.

PR#18ae makes **no** change to the website config, the AMS source,
or the deployed artifact. It records the capability and the
blocker only.

---

## 6. Next steps (revised path)

The previous draft pointed directly to PR#18af (staging fixture
dry-run). That is now **deferred** behind two prerequisites:

### Step 1 — AMS source reconciliation decision (REQUIRED FIRST)

Resolve the source-of-truth for the Sprint 2 envelope. Options:

- **Merge / restore** the PR#17v Sprint 2 envelope source
  (`sprint2-envelope.ts` + the `sprint2_v1_event` mode in
  `types.ts` / `transport.ts` / `index.ts`) from
  `/Users/admin/github/keigentechnologies/ams-pr17v` (commit
  `13d4900`) into canonical `KeigenTechnologies/ams` `main`; **or**
- **Document a different official source-of-truth** for the
  deployed capability and record why canonical `main` does not
  hold it.

Until this is done, the deployed Sprint 2 capability has no
maintained source and must not be activated.

### Step 2 — Website config / artifact patch (only after step 1, only under approved sequence)

- Add `mode: 'sprint2_v1_event'` to the website's
  `br-thinlayer-init.js` `ThinSDK.init({…})` call **only under an
  approved sequence**.
- **Preserve `endpointUrl`** (legacy `/collect`) until the Gate 4C
  decision — **or** perform the **mode + endpoint flip together**
  if it is proven that the legacy `/collect` collector cannot
  accept Sprint 2 single-object bodies (i.e. enabling Sprint 2
  mode while still pointing at `/collect` would itself break
  capture). This sequencing question must be answered explicitly
  before any change; see §7.

### Step 3 — PR#18af staging fixture dry-run (only after steps 1 + 2)

Only after source reconciliation **and** an approved website
patch may PR#18af proceed: a staging fixture dry-run asserting a
real bundle-emitted Sprint 2 payload satisfies the §-PR#18ad
contract end-to-end against a staging `/v1/event`. PR#18af is not
authorised by PR#18ae.

---

## 7. Stop-lines / risks

- **Do not flip `endpointUrl`** to `/v1/event` in PR#18ae. Gate 4C
  unapproved.
- **Do not touch production `/var/www`** or any host file. The
  PR#17w artifact update was explicitly no-deploy; the production
  host bundle is unchanged and the Sprint 2-capable
  `thin-sdk.iife.js` lives only in the website repo working tree,
  not (by virtue of PR#17w) on the production host.
- **Do not duplicate or rebuild ThinSDK in the backend repo.** The
  backend is correctly not the artifact source.
- **Do not rebuild from canonical AMS `main` until the Sprint 2
  source is reconciled** (§3.3) — a rebuild from `main` would lose
  the Sprint 2 envelope capability.
- **Do not enable `sprint2_v1_event` mode while still pointing at
  `/collect`** unless legacy `/collect` compatibility with Sprint 2
  single-object bodies is first proven. Enabling Sprint 2 mode
  against the legacy endpoint could change what `/collect`
  receives and break capture.
- **Do not deploy** any artifact or config change as part of
  PR#18ae.
- No canary, no production traffic, no `curl` to any production
  collector, no browser/live traffic, no DB action.

---

## 8. PR#17s / PR#18w 26-row historical warning (carried)

Carried forward verbatim from PR#18ad §7 (which carried it from
PR#18w §3.5 and PR#17s):

- **26 historical `/v1/event` rows** exist in
  `ingest_requests_ledger` from `2026-05-19`.
- All 26 are HTTP `400` `request_body_invalid_json`.
- `accepted_events = 0` across all 26.
- `rejected_events = 0` across all 26 (the validator failed at
  body-parse, before per-event accounting).
- Lane A / Lane B rows produced from these 26 = **0**.
- **Do not delete** any of the 26 rows.
- **Do not mutate** any field on any of the 26 rows.
- **Do not annotate** any of the 26 rows (no flag column flip,
  no audit-status update).
- **Do not normalise** any of the 26 rows (no late re-parse, no
  retroactive reshape into a Sprint 2 event).

These 26 rows are the empirical anchor that the production
bundle's emitted shape (legacy top-level array; §4) is
incompatible with `/v1/event`. They must remain on disk,
untouched, as the historical proof set that justified Gate 4C's
`BLOCKED_PENDING_COMPATIBILITY_PLAN` posture.

---

## 9. Governance locks (carried from PR#18ab)

All flags **remain `false` / `[]`**. PR#18ae does not change any
lock. Carried verbatim:

| Lock | Value |
|---|---|
| `customer_claim_allowed` | `false` |
| `customer_visibility_allowed` | `false` |
| `lane_output_allowed` | `false` |
| `lane_write_allowed` | `false` |
| `runtime_scoring_allowed` | `false` |
| `ams_trust_runtime_allowed` | `false` |
| `pass1_runtime_allowed` | `false` |
| `pass2_runtime_allowed` | `false` |
| `dashboard_customer_output_allowed` | `false` |
| `sales_claim_upgrade_allowed` | `false` |
| `allowed_customer_language` | `[]` |

These locks remain the governance ceiling for every PR in the
PR#18ae → PR#18ai (Gate 4C flip) path. None flip as a side-effect
of a bundle update or mode opt-in; each has its own explicit gate.

---

## 10. Non-goals (explicit)

PR#18ae **does not**:

- Flip `endpointUrl` to `/v1/event`. Production endpoint category
  remains `render_legacy_collect`.
- Enable `sprint2_v1_event` mode in the website config.
- Merge, restore, or change any AMS source (the §6 step-1
  reconciliation is a decision to be made, not an action taken
  here).
- Build, rebuild, deploy, or hash any artifact.
- Run any canary or generate any production traffic (no `curl`,
  no browser session, no synthetic agent against any collector).
- Change any DB row. No DDL. No `INSERT` / `UPDATE` / `DELETE`
  against `ingest_requests_ledger`, the 26 historical rows, or
  any other table. No migration. No `schema.sql` change. No DB
  grant change.
- Produce any customer output, dashboard surface, or external
  report.
- Activate any runtime scoring, Pass 1, Pass 2, AMS Trust
  runtime, or Lane writer.
- Change any live website artifact, config, or host file. No
  `/var/www/` edit. No Nginx reload. No `systemctl`. No DNS change.
- Print or commit raw tokens, `Authorization` header values,
  DSNs, or raw payload bodies. None appear in this PR's diff.

---

## 11. Acceptance criteria

PR#18ae is accepted as `BLOCKED_SOURCE_RECONCILIATION_REQUIRED`
(MIXED / NEEDS_DECISION) iff all of the following hold:

- [x] The withdrawn `BLOCKED_SOURCE_MISSING` verdict is explicitly
      superseded (§1, header note).
- [x] Source discovery records the deployed artifact + init/config
      in `buyerrecon-website` (§3.2) and the SDK source ownership +
      reconciliation gap in AMS (§3.3).
- [x] The deployed artifact is recorded as Sprint 2-capable, with
      the `legacy_array` vs `sprint2_v1_event` emission difference
      and the FetchTransport / `application/json` / `keepalive`
      facts (§4).
- [x] The active `endpointUrl` is recorded as legacy `/collect`,
      no `/v1/event` wired, and the no-flip rule restated (§5.1).
- [x] The compatibility result is "capability present, activation
      is a config opt-in, but source not reconciled — do not
      patch/deploy until the decision is made" (§5.2).
- [x] The next-step path is revised to: (1) AMS source
      reconciliation decision, (2) approved website config/artifact
      patch, (3) PR#18af — in that order (§6).
- [x] The source-integrity risk (rebuild from canonical `main`
      loses Sprint 2 capability) is recorded (§3.3, §7).
- [x] Gate 4C remains unapproved and
      `BLOCKED_PENDING_COMPATIBILITY_PLAN` (§1.3, §5.1).
- [x] No code changed; no tests run (none applicable); no artifact
      built; no website/AMS edit made.
- [x] No secrets, raw tokens, `Authorization` values, DSNs, or raw
      payloads anywhere in this PR.
- [x] No production changes of any kind (§10).
- [x] The PR#17s / PR#18w 26-row warning is carried verbatim (§8).
- [x] All eleven PR#18ab governance locks are carried verbatim as
      `false` / `[]` (§9).

---

## 12. Handoff: what the next-approved work must do

1. **Make the AMS source-reconciliation decision (§6 step 1).**
   Either merge/restore the PR#17v Sprint 2 envelope source from
   `ams-pr17v` (commit `13d4900`) into canonical
   `KeigenTechnologies/ams` `main`, or formally designate and
   document a different source-of-truth. Record which, and the
   resulting canonical commit, in that work's proof doc.
2. **Confirm the `/collect`-vs-`/v1/event` sequencing question
   (§5.2, §6 step 2, §7).** Determine whether the legacy
   `/collect` collector can accept Sprint 2 single-object bodies.
   If not, the mode opt-in and the endpoint flip must be done
   **together** (and the flip is Gate 4C — separately approved).
3. **Patch the website init (`br-thinlayer-init.js`) only under an
   approved sequence:** add `mode: 'sprint2_v1_event'`, preserve
   `endpointUrl` unless the flip is jointly approved, preserve
   auth/token binding (server-derived; no client-truth shift; no
   secret printed).
4. **Rebuild + re-verify the artifact from the reconciled source,
   not from a side-clone.** Record local-build artifact sha256s.
   Do not deploy.
5. **Then PR#18af** — staging fixture dry-run. Not before steps
   1–4.
6. **Carry forward §7, §8, §9, §10 verbatim.** Update only what
   genuinely changes (the reconciliation outcome, the actual
   config patch, the staging proof).

PR#18ae closes here as `BLOCKED_SOURCE_RECONCILIATION_REQUIRED`.
