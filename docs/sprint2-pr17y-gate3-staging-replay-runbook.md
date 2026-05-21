# BuyerRecon Sprint 2 PR#17y — Gate 3 Staging Evidence Replay / Multi-Fixture Acceptance Runbook (Staging-Only Planning)

Status: **docs-only planning runbook. Verdict: PLANNING ONLY — Gate 3 not executed.**

PR#17y is the planning artefact for Gate 3 — a staging-only evidence replay / multi-fixture acceptance gate that defines, *in advance of any execution*, how the Sprint 2 collector should be exercised under a small, deterministic set of synthetic browser-event fixtures to confirm:

1. The staging `/v1/event` endpoint accepts more than one controlled fixture shape under staging token auth.
2. Accepted / rejected / ingest staging-DB row deltas move exactly as planned per fixture.
3. `request_id`, `auth_status`, `http_status`, `reject_reason_code`, `endpoint`, `workspace_id`, and `site_id` are recorded correctly for every fixture under categorical-only inspection.
4. Invalid fixtures are rejected safely and categorically (no parser crash, no `storage_failure`, no per-event `permission denied`).
5. The collector continues to preserve raw-secret safety and no-customer-output boundaries throughout multi-fixture exercise.
6. The resulting evidence is stable enough to *prepare* (not approve) a later Gate 4 / website ThinSDK activation planning step.

PR#17y is a **planning document only**. It defines the gate; it does not execute it. Gate 3 execution requires its own separate Helen GO under the §4 acceptance criteria and §5 stop-line conditions documented here.

> **Gate 2 PASS (PR #30) is prerequisite evidence, not approval for Gate 3 execution.**
> **Gate 3 execution requires separate Helen GO.**
> **No production `endpointUrl` re-flip is approved by PR#17y.**
> **No production traffic is approved by PR#17y.**
> **No website ThinSDK activation is approved by PR#17y.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust / Pass 1 / Pass 2 is approved by PR#17y.**
> **Do not delete preserved evidence rows.**
> **Do not broaden grants to make a future Gate 3 proof pass.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `a77f2d7` — "Sprint 2 PR#17x: record Gate 2 Attempt 3 proof (#30)").

PR branch: `buyerrecon-sprint2-pr17y-gate3-staging-replay-runbook`

Mandatory reference compliance:

- `docs/ops/cutover-hard-gates.md` — operational standard.
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 controlled fixture acceptance runbook (PR #30, merged at `a77f2d7`). The PR#17y runbook reuses PR#17x's preflight / fail-closed / categorical-evidence patterns wherever they apply.

---

## 1. Status / verdict

**PLANNING ONLY — Gate 3 not executed.**

- Gate 2 PASS (PR #30, merge commit `a77f2d7`) is **prerequisite evidence**, not approval for Gate 3 execution.
- Gate 3 execution requires **separate Helen GO**, with its own categorical preflight (§4) and stop-line gates (§5).
- On future execution under Helen GO, the verdict transitions to one of: `PASS` / `PASS WITH NON-BLOCKING NOTES` / `BLOCKED` / `FAIL`. The transition criteria are recorded in §4 (PASS) and §5 (STOP-LINE) below.

### What is in scope of this PLANNING ONLY state

- Docs-only planning runbook with §1–§9 populated.
- Definition of the Gate 3 fixture set characteristics (§2 / §4 / §8.OD-1).
- Categorical PASS criteria (§4) and stop-line conditions (§5) for future execution.
- Evidence-capture rules: categorical-only fields, never-record items (§6).
- Proposed future operator execution sequence (§7), marked as **FUTURE — requires separate Helen GO** at every step.
- Open decisions for Helen review (§8).

### What is NOT in scope of this PLANNING ONLY state

- No staging POST.
- No staging DB query.
- No production action of any kind.
- No token provisioning, no token hash, no pepper read.
- No fixture body bytes shipped against any live endpoint.
- No website ThinSDK activation.
- No bundle deploy to any host.
- No `endpointUrl` re-flip anywhere.
- No `mode: 'sprint2_v1_event'` activation in any production init.
- The 26 production `ingest_requests` evidence rows from the post-PR#17q canary remain preserved.
- PR#17q column-level grants remain the runtime steady state.

---

## 2. Boundary

PR#17y is **staging-only, synthetic-only, planning-only**. The following hard boundaries apply to PR#17y itself and to any future Gate 3 execution that this runbook describes:

- **Staging only.** No production endpoint contacted. No `curl` / browser visit / synthetic generator against `https://buyerrecon.com/v1/event` (production Nginx route) or `https://buyerrecon-backend.onrender.com/collect` (Render legacy collector).
- **Synthetic fixtures only.** All fixtures generated locally; no recorded customer payload, no production identifier, no PII.
- **No production DB.** No `psql` against `buyerrecon_production`. No SELECT / INSERT / UPDATE / DELETE / TRUNCATE / ALTER / CREATE / DROP / GRANT / REVOKE against any production database. The 26 production `ingest_requests` evidence rows remain preserved untouched.
- **No production token.** Gate 3 must use a staging-issued token bound to (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`) following the PR#17x §15 operator-only safe provisioning pattern.
- **No production `SITE_WRITE_TOKEN_PEPPER`.** Pepper used must be the staging collector's pepper, never production's.
- **No `endpointUrl` re-flip.** `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy throughout PR#17y planning and any future Gate 3 execution.
- **No `/var/www` edit.** The Hetzner host's `/var/www/buyerrecon.com/html/thinlayer/*.js` files remain at PR#17u-confirmed hashes.
- **No Render `/collect` replacement.** Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.
- **No DB grant changes.** PR#17q column-level grants on `buyerrecon_prod_collector_app` stand untouched. Staging role grants are exercised as-is; no broadening to "make a proof pass".
- **No Nginx / systemctl / DNS change.**
- **No Track A invocation.**
- **No Playwright run.**
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.
- **No Lane A/B writer.** Staging Lane A/B counts must remain `0` / `0` unless OD-1 / OD-3 later schedules a non-zero expected count under explicit Helen approval.
- **No AMS Trust Core exposure.**
- **No Pass 1 / Pass 2 implementation.**
- **No website ThinSDK production activation.**
- **No production artefact / config mode flip.** No `mode: 'sprint2_v1_event'` activation in any production init.
- **No secrets in any artefact.** No raw token, token prefix / suffix, token length value, token_id, token_hash, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private key, certificate body, env dump, or vault content appears anywhere in this doc, in any future Gate 3 audit-log entry, in `/tmp/pr17y-*` operator files (which any future runbook will scrub), in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17y.

---

## 3. Gate 2 evidence carried forward

Categorical summary of PR #30 (merged at `a77f2d7`, base `sprint2-architecture-contracts-d4cc2bf`). Source: `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` §9.1.4 (Attempt 3 — PASS). No secrets, no `request_id` UUID value, no fixture body bytes, no DSN are surfaced by this summary.

| Item | Value |
|---|---|
| PR | #30 |
| Merge commit | `a77f2d7da5e69b5c1fb999c1a077a99884497aa9` (squash-merge) |
| Base branch (post-merge HEAD) | `sprint2-architecture-contracts-d4cc2bf` at `a77f2d7` |
| Verdict | **PASS — Gate 2 controlled fixture acceptance only.** |
| Scope of PASS | One controlled non-customer fixture posted to the staging Sprint 2 `/v1/event` collector via staging token auth (no production endpoint, no production DB, no production token). |
| §6 preflight | **PASS** (env-var presence, endpoint safety, fixture body assertions, token-shape sanity, staging-class DSN sanity all PASS with no STOP). |
| §7 HTTP status | **200** (HTTP status class: 2xx). |
| §7 response redaction | **token-clean**. Authorization header never printed. Raw response body never printed. |
| §7.3 `request_id` extraction | **yes** (UUID value never printed). |
| §8.1 → §8.2 pre / post deltas | `ingest +1` · `accepted +1` · `rejected +0`. |
| §8.3 row lookup (bound by extracted `request_id`) | rows returned: **1** · `auth_status = ok` · `http_status = 200` · `reject_reason_code IS NULL` · `endpoint = /v1/event` · `workspace_id` matched the bound staging identifier · `site_id` matched. UUID and payload content never surfaced beyond these categorical fields. |
| §8.5 staging Lane A/B counts | `lane_a_count = 0` · `lane_b_count = 0`. |
| Cleanup | token export file shredded / removed · fixture file removed · response file removed · `GATE2_SITE_WRITE_TOKEN` env unset. |
| Production safety | No production endpoint contacted. No production DB queried. The 26 production `ingest_requests` canary evidence rows remain preserved. PR#17q column-level grants on `buyerrecon_prod_collector_app` remain the runtime steady state. No `/var/www` edit. No `endpointUrl` re-flip. No Nginx / systemctl / DNS change. |
| What Gate 2 PASS does NOT approve | Gate 3 execution, Gate 4, production `endpointUrl` re-flip, buyerrecon.com production `/v1/event` traffic, Render `/collect` replacement, `/var/www` edit, DB grant changes, Track A, Playwright, customer-facing output, Lane A/B writers, AMS Trust, Pass 1, Pass 2, website ThinSDK production activation, production artefact / config mode flip. |

---

## 4. Gate 3 acceptance criteria

All of the following must hold (categorical) for a future Gate 3 execution to record a PASS verdict:

- **Preflight PASS.** Every preflight check in §7 (steps 1–4) returns its expected categorical value with no STOP: branch sanity OK; env-var presence (`GATE3_COLLECTOR_URL`, `GATE3_SITE_WRITE_TOKEN`, `GATE3_WORKSPACE_ID`, `GATE3_SITE_ID`, and optionally `GATE3_DATABASE_URL`) all SET on the variables required to proceed; sentinel-value rule (analogous to PR#17x §4.2.1) passes on every required variable.
- **Endpoint safety PASS.** `GATE3_COLLECTOR_URL` is staging-class and ends in `/v1/event`; it is not `https://buyerrecon.com/v1/event` and not `https://buyerrecon-backend.onrender.com/collect`.
- **Staging DB shape PASS.** `GATE3_DATABASE_URL` (if provided for §7 steps 5 / 9 / 10 verification) is classified staging-class; no production-shape DSN tokens (`buyerrecon_production`, `prod`, `production`) appear in the DSN.
- **Token source safe.** The Gate 3 token is provisioned via the PR#17x §15 operator-only pattern (or equivalent staging-only path) and handed off via a `chmod 600` `/tmp/pr17y_gate3_token_export.sh` (or equivalent) file. Raw token never printed; token length value never printed; token_hash never printed.
- **Fixture set synthetic-only.** Every fixture in the executed set is locally generated; contains no recorded customer payload; uses synthetic identifiers; is bound to the staging workspace / site pair. Body byte-shape is verified at preflight against `validateEventCore` requirements (analogous to PR#17x §5.2).
- **Per-fixture HTTP status class matches plan.** Each fixture's expected status class (`2xx` / `4xx`) is declared in advance per OD-1; the observed HTTP status class equals the planned status class for every fixture.
- **Aggregate accepted / rejected / ingest deltas match plan.** The planned per-fixture and aggregate deltas (e.g. for a four-fixture plan with two valid and two invalid envelope-stage rejects: `ingest +4 / accepted +2 / rejected +2`) match the observed deltas exactly, with no extra rows.
- **Per-request row lookup deterministic.** For every fixture whose `request_id` was extracted from the §7 step-8 response, the §7 step-10 bound `psql -v` lookup returns exactly one row whose categorical fields match the fixture's plan: `workspace_id` equals `GATE3_WORKSPACE_ID`, `site_id` equals `GATE3_SITE_ID`, `endpoint = /v1/event`, `auth_status` is `ok` for accepted fixtures, `http_status` matches the planned numeric value, `reject_reason_code` is the planned category string for invalid fixtures and `NULL` for accepted ones.
- **Lane A/B writer activity = 0.** Lane A/B counts remain `0` / `0` for every fixture (no Lane A/B write is planned by Gate 3 under OD-1's current proposal; any non-zero delta is a stop-line condition per §5).
- **No customer output.** No Pass 1 / Trust / Pass 2 output is produced by Gate 3 execution.
- **No raw secret printed.** No raw token, token_hash, token prefix / suffix, length value, token_id, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private-key body, or certificate body appears in any operator-visible output, captured artefact, commit message, PR comment, CI log, or chat.
- **Cleanup completed.** Token export file shredded; fixture file(s) removed; response file(s) removed; `GATE3_SITE_WRITE_TOKEN` env unset; no `/tmp/pr17y-*` residue.

### 4.1 PASS WITH NON-BLOCKING NOTES criteria

PASS criteria are met **except** one of:

- Staging Lane A/B count is non-zero from pre-existing staging fixture data unrelated to PR#17y (no regression introduced by Gate 3).
- Staging collector version is older than the production-deployed staging version (informational only).
- A fixture's `request_id` was extracted but the optional §7 step-10 row lookup could not run because `GATE3_DATABASE_URL` was deliberately not provided; the §7 HTTP outcome carries the verdict for that fixture.

### 4.2 BLOCKED criteria

Any preflight fail-closed precondition triggers BLOCKED. Additionally:

- Any required env var missing.
- Endpoint-safety STOP.
- DSN sanity STOP for any §7 step-10 attempt.
- §7 step-6 HTTP returns `401` / `403` / `404` / `5xx` for any fixture (token rejected, route missing, collector failure).
- §7 step-10 row lookup returns zero rows for an accepted-class fixture's `request_id` (the request_id did not reach this DB or did not match the staging boundary).

### 4.3 FAIL criteria

- §7 step-6 HTTP for an accepted-class fixture returns `400` / `415` with a categorical reject reason — fixture is malformed in a way preflight did not catch; **do not retry against staging without amending the fixture**.
- §7 step-6 returns `200` for an accepted-class fixture but `reject_reason_code` is non-null at the per-event stage with a reject code that contradicts the fixture's plan.
- §7 step-10 row lookup for an accepted-class fixture shows `auth_status != 'ok'` despite §7 step-6 returning `200`.

---

## 5. Gate 3 stop-line conditions

Any of the following aborts Gate 3 immediately. **Do not retry without amending the runbook and obtaining a fresh Helen GO.**

- **Production-shaped URL.** `GATE3_COLLECTOR_URL` matches any of: `https://buyerrecon.com`, `https://buyerrecon-backend.onrender.com`, any URL not ending in `/v1/event`, or any URL whose host lacks a staging marker.
- **Production-shaped DSN.** `GATE3_DATABASE_URL` matches `buyerrecon_production`, `prod`, `production`, or any DSN whose database name / host is not categorically staging.
- **Render `/collect` reference.** Any reference to `https://buyerrecon-backend.onrender.com/collect` in any fixture body, any command, or any header file.
- **buyerrecon.com production endpoint reference.** Any reference to `https://buyerrecon.com/v1/event` in any fixture body or any operator command.
- **Token export missing or unsafe mode.** `/tmp/pr17y_gate3_token_export.sh` absent, or file mode not `600`, or contents do not satisfy the §6 categorical sanity check (`GATE3_SITE_WRITE_TOKEN` non-empty with length-bucket OK and no value printed).
- **Raw secret printed.** Any operator-visible print of a token, token_hash, token prefix / suffix, length value, token_id, pepper, DSN, Authorization header, or `request_id` UUID value.
- **Response contains token-like material.** The §7 step-7 redaction grep (pattern set analogous to PR#17x §7.2: `Bearer`, `token`, `secret`, `pepper`, `password`, `api[_-]?key`, `BEGIN PRIVATE KEY`, `BEGIN CERTIFICATE`) matches any response body. Record only the categorical `reject_reason_code` / `auth_status` / `http_status` fields and STOP.
- **HTTP 5xx from staging collector.** Any 5xx response — collector failure. Abort, record categorical evidence, do not retry against staging.
- **Unexpected accepted / rejected / ingest deltas.** Observed deltas do not match the planned per-fixture or aggregate counts.
- **DB row mismatch.** Per-request row lookup returns zero rows, multiple rows, or rows whose categorical fields do not match the fixture's plan (`workspace_id` / `site_id` / `endpoint` / `auth_status` / `http_status` / `reject_reason_code`).
- **Lane A/B writer activity.** Any non-zero Lane A/B delta — Gate 3 plans zero Lane A/B writes under OD-1's current proposal; a non-zero observation is unplanned and aborts.
- **Any customer-facing output.** Any Pass 1 / Trust / Pass 2 surface emitted by Gate 3 execution.
- **Any production artefact / config edit.** Any change under `/var/www`, any `endpointUrl` re-flip, any `mode: 'sprint2_v1_event'` activation in production init, any Nginx / systemctl / DNS change, any AMS source change, any website artefact change, any production config change.

---

## 6. Evidence capture rules

Gate 3 execution and any future audit-log entry record **only categorical fields**. The exhaustive permitted set (per fixture and aggregate) is:

- HTTP status class (`1xx` / `2xx` / `3xx` / `4xx` / `5xx`) and the numeric `http_status` (e.g. `200`, `400`, `415`).
- `curl` exit-code class.
- `request_id` extracted (`yes` / `no`) — UUID value **never** printed.
- `ingest_delta` (integer count).
- `accepted_delta` (integer count).
- `rejected_delta` (integer count).
- `auth_status` (category: `ok` / `unauthorized` / `forbidden` / `error` / other categorical string from the collector contract).
- `reject_reason_code` (category string from the collector contract, e.g. `request_body_invalid_json`, `content_type_invalid`, `event_type_invalid`, `schema_version_malformed`, `client_event_id_invalid`, `occurred_at_too_old`; or `null` for accepted fixtures).
- `endpoint` match (`yes` if equals `/v1/event`, otherwise the categorical mismatch reason).
- `workspace_id` match (`yes` / `no`; value not echoed beyond the planned staging identifier).
- `site_id` match (`yes` / `no`).
- `response_redaction_check` (`token-clean` / `FLAGGED`).
- `fixture_file_removed` (`yes` / `no`).
- `response_file_removed` (`yes` / `no`).
- `token_export_file_shredded` (`yes` / `no`).
- `GATE3_SITE_WRITE_TOKEN_env_unset` (`yes` / `no`).
- `lane_a_count`, `lane_b_count` (integer counts at staging; expected `0` / `0`).
- Boundary affirmations (binary `yes` / `no` per item in §2).

### 6.1 Never-record items

The following must **never** appear in this doc, in any future Gate 3 audit-log entry, in `/tmp/pr17y-*` operator files (which the future runbook will scrub), in any commit message, any PR comment, any CI log, or any artefact derived from PR#17y:

- Raw token.
- `token_hash`.
- Token prefix / suffix / length value.
- `token_id`.
- Pepper / `SITE_WRITE_TOKEN_PEPPER` value.
- DSN (raw value).
- Authorization header (constructed value).
- `request_id` UUID value.
- Raw request body (bytes of any fixture body).
- Raw response body.
- Private-key or certificate body.
- Env dump.
- Vault content.

---

## 7. Proposed execution sequence (FUTURE — not executable today)

Every step below is **FUTURE — requires separate Helen GO** before any operator-side execution. PR#17y does not authorise execution of any step in this section. The numbering reflects the operational order a future Gate 3 execution runbook (e.g. a hypothetical PR#17z execution PR) would adopt.

1. **Branch sanity.** Operator confirms the working tree is on the Gate 3 execution branch (TBD when that branch is created); `git status` shows no untracked production-config / `/var/www` / Nginx / AMS / website / production-init file modifications. **FUTURE — requires separate Helen GO.**
2. **Env presence (categorical only).** Operator confirms `GATE3_COLLECTOR_URL`, `GATE3_SITE_WRITE_TOKEN`, `GATE3_WORKSPACE_ID`, `GATE3_SITE_ID` are SET; `GATE3_DATABASE_URL` is SET if step-5 / step-9 / step-10 verification is desired. No env values are printed. The sentinel-value rule (analogous to PR#17x §4.2.1) is applied to every required variable. **FUTURE — requires separate Helen GO.**
3. **Endpoint safety.** Operator confirms `GATE3_COLLECTOR_URL` ends in `/v1/event` and is staging-class; not production. Token-bearing operations are constructed via a `chmod 600` header file (analogous to PR#17x §7.1), never via shell command-line interpolation. **FUTURE — requires separate Helen GO.**
4. **Fixture generation.** Operator generates the OD-1 fixture set locally; fixtures are synthetic-only, bound to (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`), no production identifier present, no real customer payload. Each fixture's expected categorical outcome (HTTP status class, expected `reject_reason_code` category or `NULL`, expected per-fixture ingest / accepted / rejected delta) is declared in advance per OD-1. **FUTURE — requires separate Helen GO.**
5. **Pre-counts.** Operator captures staging-DB pre-counts for `ingest_requests`, `accepted_events`, `rejected_events` bound by (`workspace_id`, `site_id`) using heredoc-style `psql -v` bound-variable substitution (matching the corrected PR#17x §8 shape) — read-only; no SELECT of secret columns. **FUTURE — requires separate Helen GO.**
6. **One POST per fixture.** Operator POSTs each fixture sequentially against the staging `/v1/event` endpoint using the step-3 header file; each response is captured to a temp file under `/tmp/pr17y-fixture-<n>-response.json`. **FUTURE — requires separate Helen GO.**
7. **Response redaction scan.** For every response file, operator runs the §6.1 redaction grep before reading the file content; if any pattern matches, record only HTTP status / `reject_reason_code` / `auth_status` and STOP (per §5). **FUTURE — requires separate Helen GO.**
8. **`request_id` extraction (`yes` / `no` per fixture).** Operator extracts the response `request_id` UUID into a per-fixture session variable (e.g. `GATE3_REQUEST_ID_n`) without printing the UUID; only the categorical yes / no presence is recorded. **FUTURE — requires separate Helen GO.**
9. **Post-counts.** Operator re-runs the step-5 pre-count query and computes the per-fixture and aggregate deltas. **FUTURE — requires separate Helen GO.**
10. **Row lookup.** For each fixture whose `request_id` was extracted, operator runs the §8.3-analogue bound `psql -v` deterministic lookup to confirm the categorical fields against the fixture's plan. **FUTURE — requires separate Helen GO.**
11. **Lane A/B count check.** Operator records staging `lane_a_count` and `lane_b_count` (expected `0` / `0` under OD-1's current proposal). **FUTURE — requires separate Helen GO.**
12. **Cleanup.** Operator `shred -u /tmp/pr17y_gate3_token_export.sh` (with `rm -f` fallback for macOS / BSD), `rm /tmp/pr17y-fixture-*.json`, `rm /tmp/pr17y-response-*.json`, `unset GATE3_SITE_WRITE_TOKEN`. No `/tmp/pr17y-*` residue. **FUTURE — requires separate Helen GO.**
13. **Audit-log entry.** Operator appends a categorical-only entry (analogous to PR#17x §9.1.4) to the future Gate 3 execution PR's audit log. No raw token / token_hash / pepper / DSN / Authorization header / `request_id` UUID / raw payload / raw response body / private-key / certificate / env dump / vault content appears in that entry, in the diff, in chat, in commit messages, or in any artefact derived from the attempt. **FUTURE — requires separate Helen GO.**

---

## 8. Open decisions

The following decisions are recorded for Helen's review before Gate 3 execution is scheduled. None is pre-decided by PR#17y.

- **OD-1.** Exact fixture set count and shape. Initial proposal: four fixtures —
  - (a) one valid `page_view` fixture (expected `2xx`, `accepted +1`, `reject_reason_code NULL`);
  - (b) one valid CTA / click / `track` fixture, **if the current `src/collector/v1/validation.ts` / `tests/v1/validation.test.ts` contract admits it under Sprint 2 envelope shape** (expected `2xx`);
  - (c) one invalid missing-required-field fixture (expected `4xx` envelope-stage reject OR `2xx` per-event reject with a known `reject_reason_code` category — see OD-3);
  - (d) one invalid wrapper-shape `{ events: [...] }` fixture (expected `4xx` `request_body_invalid_json` OR `2xx` per-event reject, because Sprint 2 expects a single-object envelope — also see OD-3).

  Final fixture count and per-fixture expected categorical outcomes are determined by Helen + Codex review of the collector contract before execution.

- **OD-2.** Duplicate `client_event_id` replay fixture in scope or deferred. The collector's current behaviour for a duplicate `client_event_id` (per-event reject category, idempotent accept, or other) is not locked from PR#17x evidence alone. **Deferred unless Helen locks duplicate semantics from the existing collector contract before inclusion.**

- **OD-3.** Whether invalid fixtures should expect HTTP `4xx` with an `ingest_requests` row only (envelope-stage reject), or HTTP `2xx` with a `rejected_events` row (per-event reject), based on the current Sprint 2 collector contract in `src/collector/v1/routes.ts` / `src/collector/v1/envelope.ts` / `src/collector/v1/validation.ts` / `src/collector/v1/types.ts`. Each fixture's expected delta plan under OD-1 depends on this classification. Final classification is determined per fixture via a docs-only inspection of the validation path (no execution).

- **OD-4.** Whether Gate 3 should remain a manual operator runbook (analogous to PR#17x §6–§8 + §15) or use a committed dry-run script (e.g. `scripts/gate3-staging-replay.ts`) later. If a script is desired, it requires its own separate PR with its own Codex review, its own tests, and explicit Helen GO; **PR#17y commits no script**.

- **OD-5.** Whether Gate 3 PASS is prerequisite to a future Gate 4 website ThinSDK activation **planning** PR (not Gate 4 execution; planning only). Default proposal: Gate 3 PASS is prerequisite for Gate 4 planning; Gate 4 execution remains separately gated by its own Helen GO under `docs/ops/cutover-hard-gates.md`.

- **OD-6.** Whether Track A remains deferred until after Gate 3 PASS, or whether Track A invocation needs its own separate "Gate 3b — Track A under controlled fixture replay" plan. Default proposal: Track A remains deferred; Gate 3b (Track A) is a future, separately-planned gate, not bundled into PR#17y or any near-term Gate 3 execution PR.

---

## 9. Non-goals

PR#17y explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No Timing / Product Context scoring.** No scoring contract / loader / runtime implementation by PR#17y.
- **No Pass 1 implementation.** Pass 1 remains future-gated.
- **No Trust implementation.** AMS Trust Core remains future-gated.
- **No Pass 2 implementation.** Pass 2 remains future-gated.
- **No Lane A/B output writer.** Production Lane A/B `0`-row posture from PR#17g / PR#17q grant safety is carried forward without being re-queried by PR#17y or any future Gate 3 execution.
- **No knobs / dashboard.** No operator-facing knob, no dashboard surface added by PR#17y.
- **No Track A.** Track A remains gated under PR#17e (or successor); not invoked by PR#17y or any future Gate 3 execution under the current OD-6 default.
- **No Playwright.** No headless / programmatic browser run.
- **No production ThinSDK activation.** No `endpointUrl` re-flip on `buyerrecon.com`; no `mode: 'sprint2_v1_event'` activation in any production init.
- **No production traffic.** No `curl` against production endpoints, no browser visit, no synthetic event generator against production.
- **No production DB.** No `psql` against `buyerrecon_production`. The 26 production `ingest_requests` evidence rows remain preserved.
- **No DB grant changes.** PR#17q column-level grants on `buyerrecon_prod_collector_app` remain the runtime steady state.
- **No customer-facing output.** No Pass 1 / Trust / Pass 2 surface emitted; no customer-visible event produced.
- **No backend or AMS source change in this PR.** PR#17y is the Gate 3 planning artefact only; no `src/`, no AMS source, no website artefact, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file is touched.
- **No secrets in any artefact.** No raw token, token prefix / suffix, token length value, token_id, token_hash, pepper, DSN, password, certificate / private-key material, private IP, or raw customer data appears anywhere in this doc, in any future Gate 3 audit-log entry, in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17y.

---

End of PR#17y. **Verdict: PLANNING ONLY — Gate 3 not executed. Gate 2 PASS (PR #30) is prerequisite evidence, not approval for Gate 3 execution. Gate 3 execution requires its own separate Helen GO under the §4 acceptance criteria and §5 stop-line conditions documented here; no production traffic, no production `endpointUrl` re-flip, no website ThinSDK activation, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no AMS Trust, no Pass 1, no Pass 2, and no production artefact / config mode flip is approved by PR#17y.**
