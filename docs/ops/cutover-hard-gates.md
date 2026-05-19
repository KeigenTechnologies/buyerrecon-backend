# Cutover Hard Gates

> Operational standard for endpoint / collector / SDK / proxy / production cutovers.
> Reusable across ChatGPT, Claude Code, Codex, and human operators.
> This doc records lessons from `buyerrecon.com` PR#17d → PR#17q so future cutovers do not confuse **route readiness** with **end-to-end compatibility**.

---

## 1. Status and Scope

- This is an **operational standard**, not an approval to act.
- It applies to:
  - `endpointUrl` changes on a live site (ThinLayer / ThinSDK / any client SDK),
  - production collector changes (deployment, restart, replacement),
  - SDK transport changes (`navigator.sendBeacon`, `fetch keepalive`, batching, content-type),
  - Nginx / proxy route cutovers (new `location`, new upstream, new vhost),
  - production collector migrations (legacy → Sprint 2 path, Render → Hetzner, etc.),
  - any future site canary cutover for `buyerrecon.com`, `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`, or any later site.
- This doc **does not approve any execution by itself**. It does not unlock DNS, Nginx, systemd, DB grants, SDK rebuilds, traffic generation, or customer-facing output.
- Each future cutover still requires an **explicit Helen GO** scoped to that specific step.
- Every future cutover prompt for ChatGPT / Claude Code / Codex / a human operator must reference this doc by name and state which Gate (§3–§6) is being executed.

---

## 2. Core Principle

> **Route readiness is not end-to-end readiness.**

A successful Nginx route, a `200 OK` health endpoint, a green `systemctl is-active`, or a clean `nginx -t` proves only that **one layer is available**. It does **not** prove:

- client payload compatibility (does the SDK's actual body shape parse on the target collector?),
- token / auth path compatibility (does the production token, with its exact binding, validate on the target route?),
- runtime DB privileges (can the runtime role execute the actual SQL the route runs, including `WHERE`, `RETURNING`, `ON CONFLICT`, `UPDATE`, and any sequence / column-level requirements?),
- accepted / rejected event persistence (do rows actually land in `accepted_events` / `rejected_events` with the right `workspace_id`, `site_id`, reject reason, and ledger linkage?),
- downstream extraction (do observers, Lane A/B preview, and any other downstream surface read the new rows correctly?),
- customer-safe output readiness (Pass 1 / Trust / Pass 2 gates and Lane A/B writer postures).

A cutover that "looks healthy" can still be silently broken. The Gates below force each layer to prove itself **separately**, before any layer's failure can be masked by another layer's success.

---

## 3. Gate 1 — Static Contract Diff

**Purpose:** Eliminate payload-shape mismatches before any traffic flows.

### 3.1 Questions to answer before any endpointUrl or traffic cutover

- What body does the current client SDK send?
- Is it a JSON object, a JSON array, a batch payload, a legacy envelope, the Sprint 2 envelope, a `Blob`, plain text, or `FormData`?
- What `Content-Type` does the browser actually send? (Note: `navigator.sendBeacon(url, blob)` sends the **blob's** `type` as `Content-Type` — `application/json` is **not** automatic.)
- Does `navigator.sendBeacon()` alter the body / content-type semantics vs `fetch(..., { keepalive: true })`?
- What exact body shape does the target collector route expect at the parser level (before envelope validation)?
- Is the target route single-event (`/v1/event`) or batch-event (`/v1/batch`)?
- Does the route expect auth in headers (e.g. `X-Site-Write-Token`), in the body, or in both?
- Does the client provide every field the target route requires (`workspace_id`, `site_id`, `event_id`, `event_type`, `occurred_at`, `payload`, etc.) with the right **type** (string vs number, UUID vs free-form, ISO-8601 vs epoch-ms)?
- Could the target collector parser classify the body as `request_body_invalid_json` — i.e. does the parser distinguish "not JSON" from "JSON but wrong shape", or does it collapse both into one reject reason?

### 3.2 Acceptance criteria

- A **written table** comparing client-emitted shape vs collector-expected shape, key by key, value-type by value-type, `Content-Type` by `Content-Type`. Categorical only — **no raw payloads** in the table.
- **No `endpointUrl` change** until every row of the table is either an explicit match or an explicitly handled adapter / contract bridge.
- If the **exact** browser body is unknown, **stop**. Inspect with a controlled non-production fixture (e.g. a local page or a staging host loading the same SDK bundle against a sandbox collector), and re-build the table from observed bytes.

### 3.3 Anti-patterns

- "It worked on Render legacy" — proves only that the legacy parser was lenient, not that the new parser will accept the same body.
- "The SDK is JSON-based, so it must work" — `navigator.sendBeacon` ships blobs whose effective `Content-Type` and shape depend on construction details inside the SDK build.
- "We'll just point endpointUrl and watch the rows" — the rows arrive too late; rejection lands in `ingest_requests` with `request_body_invalid_json` and looks like a healthy ingest path until you inspect reason codes.

---

## 4. Gate 2 — Production-Role Dry Run Without Live Traffic

**Purpose:** Verify the real code path end-to-end **before** any real site cutover, using a controlled fixture rather than live customer traffic.

### 4.1 What the fixture must prove

Every dimension of the fixture must match production:

- same **DB role class** (the runtime collector role, not a superuser observer role),
- same **collector route** (`/v1/event`, `/v1/batch`, or whichever route the cutover targets),
- same **auth mechanism and binding semantics**. Any real production token use requires its own explicit GO and must remain secret-safe; otherwise use a token-equivalent fixture.
- same **SQL path** (the exact statements the route runs, including `INSERT`, `UPDATE`, `RETURNING`, `ON CONFLICT`, sequence `nextval`),
- same **payload body shape** (the exact JSON or blob the SDK emits — confirmed by Gate 1),
- same **headers / content-type** (including the `Content-Type` actually shipped by `sendBeacon`),
- same **persistence path** (`ingest_requests` → `accepted_events` or `rejected_events` → any downstream observer).

### 4.2 Rules

- Use staging, a local production-like DB instance, or an explicitly approved operator fixture.
- **Do not** use raw customer data. Fixtures must be synthetic or approved replay.
- **Do not** use Track A unless explicitly approved by its own GO.
- **Do not** use Playwright unless explicitly approved by its own GO.
- **Do not** treat `/health` (or `200 OK` on a root path) as proof of event compatibility.
- **Do not** treat Nginx route existence as proof of collector contract compatibility.
- **Do not** generate live traffic from a customer-facing site to "see what happens".

### 4.3 Acceptance criteria

- Controlled fixture produces the **expected HTTP status** for each shape of input (success path, validation-reject path, auth-reject path).
- If the input is **expected to accept**: `accepted_events` (or the intended ledger rows) appear with the expected `workspace_id`, `site_id`, `event_type`, and any other categorical fields.
- If the input is **expected to reject**: `rejected_events` (or `ingest_requests` rejection rows) carry the **intended reject reason code**, not a `storage_failure` and not a parser failure that masks a deeper issue.
- **No unexpected `500`** at any point. A `500` indicates either runtime privilege failure, exception in code, or unhandled state — all of which are stop-line conditions (§8) until diagnosed.

---

## 5. Gate 3 — Runtime Privilege Simulation

**Purpose:** Verify the runtime role can execute the **actual** SQL path the route runs — before production live traffic exposes a missing privilege as a `500`.

### 5.1 What to verify for a collector runtime role (template, e.g. `buyerrecon_prod_collector_app`)

At minimum, verify the runtime role can execute:

- **token lookup on `site_write_tokens`** (whatever columns the `WHERE`/`SELECT` actually reads),
- **`ingest_requests` insert**,
- **`ingest_requests` update by `request_id`** (requires column-level `SELECT (request_id)` on `ingest_requests` for the `WHERE` clause in some PostgreSQL versions / patterns),
- **accepted event insert** into `accepted_events`,
- **accepted event `RETURNING event_id`** if the route uses `RETURNING` (column-level `SELECT (event_id)` is required for `RETURNING` on a column the role cannot otherwise see),
- **rejected event insert** into `rejected_events`,
- **`site_write_tokens.last_used_at` update**,
- **required sequence `USAGE`** for any `nextval`-based default,
- **required column-level `SELECT`** for every `WHERE`, `RETURNING`, or `ON CONFLICT` predicate.

### 5.2 Important constraints

- **Do not** solve runtime failures with broad grants. Diagnose the exact missing privilege, then grant only that.
- Prefer **column-level grants** over table-wide `SELECT` wherever PostgreSQL allows.
- **No Lane A/B grants.** `scoring_output_lane_a` / `scoring_output_lane_b` remain `0` `SELECT`/`INSERT`/`UPDATE` for the collector runtime role.
- **No derived-table grants** (no `SELECT` on observer-only or analytics-only tables).
- **No DDL privileges** (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`) for the runtime role.
- **No `SUPERUSER`, `CREATEDB`, or `CREATEROLE`.**
- If the route uses `ON CONFLICT`, `WHERE`, or `RETURNING`, **explicitly check** whether PostgreSQL requires column-level `SELECT` on the referenced columns — this is the failure class behind `permission denied for table …` `500`s that route-readiness checks cannot detect.

### 5.3 Acceptance criteria

- A **categorical privilege matrix** filled in before cutover. One row per SQL statement the route runs; one column per privilege class (`INSERT`, `UPDATE`, column-level `SELECT`, sequence `USAGE`).
- **Minimal grants only.** Every grant must be necessary for a specific statement; no "while we're at it" grants.
- **No broad role elevation.** No table-wide `SELECT` if column-level is sufficient. No table-wide `INSERT`/`UPDATE` for tables the route never writes.
- **Any grant mutation requires explicit Helen GO and a proof closure PR** recording the exact `GRANT` / `REVOKE` statements, the resulting `has_column_privilege` / `has_table_privilege` checks, and confirmation that no broader privilege landed accidentally.

---

## 6. Gate 4 — Separate Route Readiness From Traffic Cutover

**Purpose:** Force each layer of the cutover to prove itself in its own PR with its own GO and its own proof closure. No single PR is allowed to claim "the cutover works" — that claim is the product of an ordered sequence below.

### 6.1 PR A — Route Readiness

**Proves:**

- service running (`systemctl is-active <collector>` returns `active`),
- route exists (`nginx -t` clean, `location` block present in effective config),
- proxy target correct (`proxy_pass` points at the right local upstream),
- token snippet / auth path present (root-only snippet, mode `0600`, included only inside the target `location`),
- health passes (`/health` on the upstream returns `status=ok`),
- **no event traffic generated** during the proof.

**Does not prove:**

- browser payload compatibility,
- accepted event persistence,
- live canary success.

### 6.2 PR B — Client Endpoint Change

**Proves:**

- `endpointUrl` changed in the live client init file (e.g. `br-thinlayer-init.js`),
- backup of the original file exists on disk with an unambiguous timestamped name,
- pre/post literal counts invert (old endpoint count `1 → 0`, new endpoint count `0 → 1`),
- page health remains good (`curl -I <site>` returns `200`),
- **no write smoke** unless separately approved by its own GO.

**Does not prove:**

- first event captured (unless an event is actually observed in DB — and even then, observation belongs in PR D).

### 6.3 PR C — Controlled Event Proof

**Proves:**

- exactly one controlled human page-load (or one approved fixture event) reaches the collector,
- **no Track A** unless explicitly approved by its own GO,
- **no Playwright** unless explicitly approved by its own GO,
- HTTP status matches expectation (typically `200` or `2xx` for accept; `4xx` for shaped reject; **never** `5xx`),
- expected DB rows appear (`ingest_requests` increments, `accepted_events` or `rejected_events` increment as expected, `site_write_tokens.last_used_at` bumps),
- **no `500`**,
- **no contract mismatch** (no `request_body_invalid_json` and no other `request_body_*` reason on a path expected to succeed).

### 6.4 PR D — Passive Organic Observation

**Proves:**

- normal organic traffic is or is not arriving,
- categorical record of `NO_EVENT_YET` if no organic event occurs during the window,
- the doc **does not overclaim success** without an observed event,
- the doc **does not call `NO_EVENT_YET` a failure** when no event was expected within the window.

### 6.5 PR E — Track A

- **Only after** PR A → PR D have passed cleanly.
- Track A remains separately labelled and requires its own explicit GO.
- Track A does not subsume any earlier gate; it adds adversarial / replay / shape coverage **on top of** them.

### 6.6 Why the split matters

If PR A's "route readiness" claim is folded into the same artefact as PR C's "event captured" claim, a runtime privilege failure (Gate 3 failure) reads as "the cutover broke" instead of "the route is fine but the runtime role is missing a privilege". Separate PRs make the failure surface diagnosable instead of blending into a generic regression.

---

## 7. Required Language

Every future proof doc and every future cutover prompt must include the following standard phrases **verbatim** where applicable:

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "`400` means request reached collector but failed contract / validation; preserve evidence and inspect contract."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

These phrases are not decorative. They flatten implicit assumptions into explicit assertions so a reviewer (human or model) can verify them line by line.

---

## 8. Stop-Line Conditions

If **any** of the following occur, **stop** and either **rollback** to the prior steady state or **pause** the cutover under an explicit operator decision. Do not "push through" any of these by adjusting scope, grants, or boundaries on the fly.

- HTTP `500` from the collector during a live canary.
- Collector journal `kind: storage_failure`.
- Collector journal or DB error `permission denied for table …` (or any `permission denied`).
- `reject_reason_code = request_body_invalid_json` during an endpoint cutover (especially with `auth_status=ok` and rows landing in `ingest_requests`).
- Token-auth failure (`auth_status != ok`, missing token, mis-bound token).
- Wrong `workspace_id` / `site_id` observed in any row (e.g. staging IDs appearing in production rows, or a `site_id` from the wrong site landing under a token bound to another site).
- Lane A/B rows (`scoring_output_lane_a` / `scoring_output_lane_b`) unexpectedly created.
- Any raw secret (token, token prefix / suffix, token hash, pepper, DSN, password, certificate / private-key material, private IP, host body) printed to terminal, chat, repo, PR comment, CI log, or any captured artefact.
- Any raw payload, raw customer data, or raw request body printed, pasted, committed, or copied into proof artefacts (including chat, terminal output, repo files, PR comments, CI logs, screenshots, or any captured proof window). Categorical summaries are permitted; raw bodies are not.
- DB grants needed beyond the approved minimal matrix (the answer is "stop and re-approve the matrix", not "grant more").
- **Operator uncertainty.** If the operator (human or model) is not categorically sure of the next step, stop. Ask. Do not act on partial confidence.

---

## 9. Proof Closure Requirements

Every proof closure PR derived from this standard must record:

- **What was proven** — the categorical claims the proof establishes (e.g. "route shape verified", "token auth path validated", "first organic event observed").
- **What was not proven** — the claims this proof does not unlock (e.g. "this proof does not authorise broader canary", "this proof does not unlock Lane A/B writer").
- **Exact scope** — the named PR step (PR A / B / C / D / E per §6, or a named sub-step).
- **Exact boundaries** — the "What did not happen" list (DNS, Nginx, systemd, DB mutation, Track A, Playwright, write smoke, customer-facing output, Lane A/B writer, AMS Trust, Pass 1 / Pass 2, secret printing, etc.).
- **Rollback state** — the one-step revert path and any preserved backup file paths.
- **Event counts** — categorical `ingest_requests`, `accepted_events`, `rejected_events`, `site_write_tokens_used`, and any per-site projections, before and after.
- **Auth status categories** — `auth_status=ok` or the exact non-`ok` category.
- **Reject reason categories** — `reject_reason_code` distribution (e.g. `request_body_invalid_json: 26`, `validation_workspace_mismatch: 0`).
- **Traffic source** — whether traffic was operator-generated (controlled human page-load, fixture, approved synthetic) or passive organic.
- **Expectation** — whether `accepted_events` / `rejected_events` rows were expected to appear during the proof window (so a `0` reading can be classified as expected vs unexpected).
- **Customer-facing output posture** — explicit categorical confirmation that no customer-facing output was generated, no Pass 1 / Pass 2 artefact was emitted, no Lane A/B row was written, no AMS Trust Core surface was exposed.
- **Payload redaction posture** — confirm no raw payloads, no raw customer data, and no raw request bodies were captured, pasted, committed, or included in proof artefacts. Categorical structure (key names, value types, batch/single, content-type, reason codes, row counts) is permitted; raw bodies are not.

A proof closure that omits any of these dimensions is incomplete by this standard. Reviewers (human or model) are required to flag the omission rather than approve the closure.

---

## 10. Non-Goals

This standard **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- DNS changes,
- ThinLayer / ThinSDK changes (`br-thinlayer-init.js`, `thin-sdk.iife.js`, `br-probe-init.js`, or any bundled SDK asset),
- Nginx reloads, route additions, route deletions, vhost edits, or snippet edits,
- DB grants (no broadening, no narrowing, no `GRANT` / `REVOKE` by this standard),
- write smoke (no `POST /v1/event`, no `POST /v1/batch`, no synthetic event generator),
- Track A,
- Playwright,
- customer-facing output (Pass 1 / Trust / Pass 2 / any customer-readable report),
- Lane A/B writers (`scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-row by default),
- AMS Trust Core exposure through BuyerRecon,
- Pass 1 / Pass 2 implementation.

This standard names them so they cannot drift into a cutover prompt as implicit permission.

---

## 11. Ownership

- This doc lives at `docs/ops/cutover-hard-gates.md` and is the canonical reference for ChatGPT, Claude Code, Codex, and human operators working on production cutover steps.
- **Every future cutover prompt must reference this doc by name** (path or full title) and **state which Gate is being executed** (Gate 1 / Gate 2 / Gate 3 / Gate 4 → PR A / B / C / D / E).
- A cutover prompt that does not name its Gate is incomplete by this standard. The model or operator receiving such a prompt must ask which Gate is in scope before acting.
- Changes to this standard require an explicit Helen GO and their own docs PR. Drift in this standard would silently weaken every future cutover; it is itself a stop-line surface.

---

End of `cutover-hard-gates.md`. **Operational standard. Docs-only. Approves no execution.**
