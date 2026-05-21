# BuyerRecon Sprint 2 PR#17z — Gate 3 Staging Evidence Replay / Multi-Fixture Acceptance Proof (Staging-Only Execution)

Status: **operator runbook executed end-to-end against the Hetzner staging host. Verdict: PASS — Gate 3 staging-only, DB-backed, multi-fixture acceptance only. See §4 for the categorical audit trail.**

PR#17z is the Gate 3 execution record under `docs/ops/cutover-hard-gates.md`: a staging-only, DB-backed, multi-fixture proof that exercises the Sprint 2 `/v1/event` collector against a deterministic synthetic fixture set defined by the PR#17y planning runbook (`docs/sprint2-pr17y-gate3-staging-replay-runbook.md`). It confirms — under non-production conditions only — that:

1. The staging `/v1/event` endpoint accepts more than one controlled fixture shape under staging token auth.
2. Accepted / rejected / ingest staging-DB row deltas moved exactly as planned per fixture, with per-`request_id` row lookups deterministic.
3. `request_id`, `auth_status`, `http_status`, `reject_reason_code`, `endpoint`, `workspace_id`, and `site_id` were recorded correctly for every fixture under categorical-only inspection.
4. Invalid fixtures were rejected safely and categorically (one validation-stage reject, one envelope-stage reject) with no parser crash, no `storage_failure`, no per-event `permission denied`.
5. The collector preserved raw-secret safety and no-customer-output boundaries throughout the multi-fixture exercise.
6. The Gate 3 PASS is **staging-only and DB-backed**, scoped strictly to the §10.1 PR#17y / §4 PR#17z acceptance criteria — it does **not** approve Gate 4, production `endpointUrl` re-flip, production traffic, Track A, Playwright, customer-facing output, Lane A/B writer, AMS Trust, Pass 1, Pass 2, or website ThinSDK production activation.

> **Gate 2 PASS (PR #30) and Gate 3 PLANNING (PR #31) are prerequisite evidence, not approval for any downstream gate.**
> **Gate 3 PASS approves Gate 3 acceptance only; each subsequent gate requires its own explicit Helen GO.**
> **No production `endpointUrl` re-flip is approved by PR#17z.**
> **No production traffic is approved by PR#17z.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#17z; no production artefact / config mode flip is approved by PR#17z.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust / Pass 1 / Pass 2 is approved by PR#17z.**
> **Do not delete preserved evidence rows.**
> **Do not broaden grants to make a future gate pass.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `9a0c94b` — "Sprint 2 PR#17y: plan Gate 3 staging replay (#31)").

PR branch: `buyerrecon-sprint2-pr17z-gate3-execution`

Mandatory reference compliance:

- `docs/ops/cutover-hard-gates.md` — operational standard.
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 controlled fixture acceptance runbook (PR #30, merged at `a77f2d7`).
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 planning runbook (PR #31, merged at `9a0c94b`). The §4 acceptance criteria and §5 stop-line conditions defined by PR#17y are the criteria PR#17z's execution evidence is measured against.

---

## 1. Status / verdict

**PASS — Gate 3 staging-only, DB-backed, multi-fixture acceptance only.**

Helen-as-operator executed the Gate 3 four-fixture runbook end-to-end on the Hetzner staging host under explicit Helen GO. Preflight tooling, endpoint safety, env-var presence, and staging-class DSN checks all passed. The CTE-form token INSERT returned exactly one inserted row; the separate count-only active-token verification returned exactly one active row for label `pr17z_gate3_fixture`. Four controlled POSTs against the staging Sprint 2 `/v1/event` endpoint produced the expected per-fixture HTTP outcomes; aggregate `ingest_requests`, `accepted_events`, and `rejected_events` deltas matched the PR#17y plan exactly (`+4 / +2 / +1`); per-`request_id` row lookups confirmed `workspace_id`, `site_id`, `endpoint`, `auth_status`, `http_status`, and `reject_reason_code` for every fixture; the F3 validation-stage reject's `reason_code` and `rejected_stage` matched plan; the F4 envelope-stage reject produced zero `accepted_events` and zero `rejected_events` rows as expected. Staging Lane A/B counts (`public.scoring_output_lane_a`, `public.scoring_output_lane_b`) remained at `0` / `0`. Operator-side cleanup completed — header file shredded, token export file shredded, fixture and response files removed, env vars unset, no `/tmp/pr17z-*` residue.

No production endpoint was contacted; no production DB was queried; no `/var/www` file was edited; no DB grant was changed; no `endpointUrl` was re-flipped; no Track A / Playwright / customer-facing output / Lane A/B writer / AMS Trust / Pass 1 / Pass 2 / Timing / Product Context runtime / knobs / dashboard / website ThinSDK production activation / production artefact / config mode flip was triggered; no raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw request body / raw response body / private-key / certificate body / env dump / vault content / shell history extract was printed in any artefact, in chat, in any commit message, or in any operator-visible output.

The PASS verdict is scoped to PR#17y §4 (Gate 3 PASS criteria) only. The transition criteria for future gates are recorded in PR#17y §8 (Open Decisions) and `docs/ops/cutover-hard-gates.md`.

### What is in scope of this PASS verdict

- Gate 3 staging evidence replay / multi-fixture acceptance against the staging Sprint 2 `/v1/event` endpoint, executed end-to-end on the Hetzner staging host.
- Preflight (tooling, endpoint safety, env presence, staging-class DSN) PASS with no STOP.
- Token provisioning under PR#17x §15 operator-only pattern, CTE INSERT returning `inserted_rows_count = 1`, separate active-row count `= 1` for label `pr17z_gate3_fixture`.
- Four controlled POSTs (F1 / F2 / F3 / F4) with per-fixture response redaction `token-clean` and per-fixture `request_id` extraction (UUID values never printed).
- DB-backed aggregate delta verification: `ingest +4 / accepted +2 / rejected +1`.
- Per-fixture deterministic row lookups (ingest_requests + accepted_events + rejected_events bound by `request_id`).
- F3 validation-stage reject detail confirmed (`reason_code = event_name_invalid`, `rejected_stage = validation`).
- F4 envelope-stage reject detail confirmed (`http_status = 400`, `reject_reason_code = request_body_invalid_json`, `accepted_events = 0`, `rejected_events = 0` for the bound `request_id`).
- Staging Lane A/B counts unchanged at `0` / `0` (canonical tables `public.scoring_output_lane_a` and `public.scoring_output_lane_b`).
- Operator-side cleanup complete: header file shredded, token export file shredded, fixture and response files removed, env vars unset, no residue.

### What is NOT in scope of this PASS verdict

- No production endpoint contacted; `https://buyerrecon.com/v1/event` and `https://buyerrecon-backend.onrender.com/collect` remain untouched by PR#17z.
- No production DB queried; the 26 production `ingest_requests` evidence rows from the post-PR#17q canary remain preserved.
- No bundle deploy to any production host. No `/var/www` edit.
- No `endpointUrl` re-flip on `buyerrecon.com`; ThinLayer `endpointUrl` remains on Render legacy.
- No website ThinSDK activation of `sprint2_v1_event` mode; no production artefact / config mode flip.
- No DB grant change. PR#17q column-level grants on `buyerrecon_prod_collector_app` and PR#17f / PR#17q Lane A/B grant safety stand untouched.
- No Nginx / systemctl / DNS change.
- No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust Core exposure, no Pass 1 implementation, no Pass 2 implementation.
- No Timing / Product Context runtime, no knobs / dashboard.
- No Gate 4 work.
- **Gate 3 PASS does not pre-authorise Gate 4 PR B (bundle deploy), Gate 4 PR C (`endpointUrl` re-flip + `mode: 'sprint2_v1_event'` activation), Gate 4 PR D (organic observation), Gate 4 PR E (Track A), or any future transport-selection change. Each remains separately gated by its own explicit Helen GO per PR#17y §8 OD-5 and `docs/ops/cutover-hard-gates.md`.**

---

## 2. Boundary

PR#17z honoured the staging-only / synthetic-only / DB-backed-verdict boundary defined by PR#17y §2. The following hard boundaries applied to the execution and are reaffirmed for the audit record:

- Staging only. No `curl` / browser visit / synthetic generator against `https://buyerrecon.com/v1/event` (production Nginx route) or `https://buyerrecon-backend.onrender.com/collect` (Render legacy collector).
- Synthetic fixtures only. All four fixture bodies generated locally; no recorded customer payload, no production identifier, no PII; no `workspace_id` / `site_id` / `token` / `Authorization` / `secret` / `pepper` / `dsn` field in any fixture body.
- No production DB; no `psql` against `buyerrecon_production`.
- No production token; the Gate 3 token was provisioned under PR#17x §15 operator-only safe pattern bound to (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`, `label = pr17z_gate3_fixture`).
- No production `SITE_WRITE_TOKEN_PEPPER` read; only the staging deploy's secret-managed staging pepper was used.
- No `endpointUrl` re-flip on `buyerrecon.com`; ThinLayer `endpointUrl` remained on Render legacy throughout PR#17z execution.
- No `/var/www` edit; Hetzner host's `/var/www/buyerrecon.com/html/thinlayer/*.js` files remained at PR#17u-confirmed hashes.
- No Render `/collect` replacement; Render legacy collector remained the live capture path for ThinLayer traffic on all five canary sites.
- No DB grant changes; PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety remained untouched.
- No Nginx / systemctl / DNS change.
- No Track A invocation; no Playwright run; no customer-facing output; no Lane A/B writer; no AMS Trust Core exposure; no Pass 1 / Pass 2 implementation; no Timing / Product Context runtime; no knobs / dashboard; no website ThinSDK production activation; no production artefact / config mode flip; no Gate 4 work.

---

## 3. Evidence chain carried forward

PR#17z's PASS rests on the following prerequisite evidence; this proof does not re-litigate or re-execute those gates.

| Predecessor | What it established | Reference |
|---|---|---|
| PR#17x Gate 2 (PR #30, merged at `a77f2d7`) | Controlled fixture acceptance: one staging fixture posted to `/v1/event`, HTTP 200, `ingest +1 / accepted +1 / rejected +0`, `auth_status=ok`, `reject_reason_code IS NULL`, Lane A/B `0` / `0`. | `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` §9.1.4 |
| PR#17y Gate 3 planning (PR #31, merged at `9a0c94b`) | Locked the Gate 3 fixture set (OD-1: F1 / F2 / F3 / F4), the four-fixture acceptance criteria (§4), the stop-line conditions (§5), the categorical-only evidence rules (§6), the future execution sequence (§7), and the canonical Lane A/B table identifiers (`public.scoring_output_lane_a`, `public.scoring_output_lane_b`). | `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` |

No production endpoint, no production DB, no production token, no production pepper, no `request_id` UUID value, no raw payload, no raw response body, no DSN was surfaced by this evidence chain.

---

## 4. Categorical execution evidence

The operator's Hetzner staging shell executed the v4 operator script under explicit Helen GO. Categorical evidence reported by the operator, recorded here without inference or addition.

### 4.1 Preflight + environment

| Item | Value |
|---|---|
| Execution context | Helen-as-operator on Hetzner staging host (`/opt/buyerrecon-backend`); Claude Code did not run any `curl` / `psql` / SSH / fixture POST / token provisioning command during execution. |
| `endpoint_safety` | **PASS** (exact-equality match on the allowed staging URL ending in `/v1/event`; not the exact production URL; not Render `/collect`) |
| `preflight_result` | **PASS** |
| Token export file (`/tmp/pr17z_gate3_token_export.sh`) | created with mode `600`; raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header **not printed** at any step |
| `header_file_mode` | **600** |

### 4.2 Token provisioning (PR#17x §15 pattern, label = `pr17z_gate3_fixture`)

| Item | Value |
|---|---|
| `inserted_rows_count` (CTE INSERT … RETURNING 1 → count) | **1** |
| `active_token_rows_count(label=pr17z_gate3_fixture)` (separate count-only query) | **1** |

### 4.3 Fixture files

| Item | Value |
|---|---|
| `fixture_files_created` | **yes** (four synthetic fixture bodies, locally generated; bound to staging workspace / site via auth only; no `workspace_id` / `site_id` / `token` / `Authorization` / `secret` / `pepper` / `dsn` field in any body; mode 600) |

### 4.4 DB pre-counts (bound by `workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`)

| Table | Pre-count |
|---|---|
| `public.ingest_requests` | **17** |
| `public.accepted_events` | **17** |
| `public.rejected_events` | **0** |

### 4.5 Per-fixture POST + response observations

Per-fixture HTTP outcomes captured by the operator. `curl` exit code class `0` for every fixture. Response redaction grep returned `token-clean` for every fixture. `request_id` extracted (`yes`) for every fixture; UUID values never printed.

| Fixture | Expected HTTP class | Observed HTTP status | `request_id` extracted | Response redaction |
|---|---|---|---|---|
| **F1** valid `browser/page` page_view | `2xx` | **200** | **yes** | **token-clean** |
| **F2** valid `browser/track` cta_click | `2xx` | **200** | **yes** | **token-clean** |
| **F3** validation-stage reject (missing `event_name`) | `2xx` | **200** | **yes** | **token-clean** |
| **F4** envelope-stage reject (top-level JSON array) | `4xx` | **400** | **yes** | **token-clean** |

### 4.6 DB post-counts and aggregate deltas

| Table | Pre | Post | Delta |
|---|---|---|---|
| `public.ingest_requests` | 17 | **21** | **+4** |
| `public.accepted_events` | 17 | **19** | **+2** |
| `public.rejected_events` | 0 | **1** | **+1** |

All three aggregate deltas matched the PR#17y plan exactly (`+4 / +2 / +1`).

### 4.7 Per-fixture deterministic row verification (bound by extracted `request_id`)

| Fixture | `ingest_requests` row | `accepted_events` rows | `rejected_events` rows | Categorical verdict |
|---|---|---|---|---|
| **F1** | 1 row · `auth_status=ok` · `http_status=200` · `reject_reason_code IS NULL` · `endpoint=/v1/event` · `workspace_id` / `site_id` match | **1** | **0** | **ACCEPTED** |
| **F2** | 1 row · `auth_status=ok` · `http_status=200` · `reject_reason_code IS NULL` · `endpoint=/v1/event` · `workspace_id` / `site_id` match | **1** | **0** | **ACCEPTED** |
| **F3** | 1 row · `auth_status=ok` · `http_status=200` · `reject_reason_code IS NULL` (request level) · `endpoint=/v1/event` · `workspace_id` / `site_id` match | **0** | **1** · `reason_code='event_name_invalid'` · `rejected_stage='validation'` | **VALIDATION-REJECT** |
| **F4** | 1 row · `auth_status=ok` · `http_status=400` · `reject_reason_code='request_body_invalid_json'` · `endpoint=/v1/event` · `workspace_id` / `site_id` match | **0** | **0** | **ENVELOPE-REJECT** |

### 4.8 Staging Lane A/B count check (canonical table identifiers)

| Table | Count |
|---|---|
| `public.scoring_output_lane_a` (filtered by `workspace_id = buyerrecon_staging_ws` AND `site_id = buyerrecon_com`) | **0** |
| `public.scoring_output_lane_b` (filtered by `workspace_id = buyerrecon_staging_ws` AND `site_id = buyerrecon_com`) | **0** |

Lane A/B posture unchanged. No Lane A/B writer activity triggered by Gate 3.

### 4.9 Secret-safety affirmations (every item reported `no` by the operator)

| Forbidden item | Printed? |
|---|---|
| raw token | **no** |
| `token_hash` | **no** |
| pepper / `SITE_WRITE_TOKEN_PEPPER` value | **no** |
| DSN value | **no** |
| Authorization header | **no** |
| `request_id` UUID value | **no** |
| raw request body | **no** |
| raw response body | **no** |

---

## 5. Cleanup evidence

| Item | Value |
|---|---|
| `fixture_files_removed` | **yes** |
| `response_files_removed` | **yes** |
| `header_file_shredded` | **yes** (`/tmp/pr17z-header-file`) |
| `token_export_file_shredded` | **yes** (`/tmp/pr17z_gate3_token_export.sh`) |
| `gate3_site_write_token_env_unset` | **yes** |
| `site_write_token_pepper_env_unset` | **yes** |
| `gate3_database_url_env_unset` | **yes** |
| `/tmp` residue | **none** |

---

## 6. Boundary affirmations (Gate 3 execution and proof record)

- No production endpoint contacted. No `curl` against `https://buyerrecon.com/v1/event`. No `curl` against `https://buyerrecon-backend.onrender.com/collect`.
- No production DB / token / pepper. No `psql` against `buyerrecon_production`. The 26 production `ingest_requests` canary evidence rows remain preserved.
- No `/var/www` edit. No `endpointUrl` re-flip on `buyerrecon.com`. ThinLayer `endpointUrl` remains on Render legacy.
- No Render `/collect` replacement; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.
- No DB grant change. PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety untouched.
- No Nginx / systemctl / DNS change.
- No Track A invocation. No Playwright run. No customer-facing output. No Lane A/B writer. No AMS Trust Core exposure. No Pass 1 implementation. No Pass 2 implementation.
- No Timing / Product Context scoring runtime. No knobs / dashboard.
- No website ThinSDK activation of `sprint2_v1_event` mode. No production artefact / config mode flip.
- No Gate 4 work.
- No raw token, `token_hash`, token prefix / suffix, length value, `token_id`, pepper, DSN, Authorization header, `request_id` UUID value, raw request body, raw response body, private-key body, certificate body, env dump, vault content, or shell-history extract appears in this doc, in the diff, in chat, in any commit message, in CI logs, or in any artefact derived from PR#17z.

---

## 7. What Gate 3 PASS does NOT approve

Gate 3 PASS is **staging-only and DB-backed**. The PASS verdict is scoped strictly to PR#17y §4 acceptance criteria for the four-fixture set defined in PR#17y §8 OD-1. PR#17z explicitly does **not** approve any of the following — each requires its own explicit Helen GO scoped to that specific work:

- **No Gate 4** of any kind. Gate 4 PR B (bundle deploy from buyerrecon-website's `thinlayer/` to the production host), Gate 4 PR C (`endpointUrl` re-flip to `https://buyerrecon.com/v1/event` + `mode: 'sprint2_v1_event'` activation in the production init), Gate 4 PR D (organic observation), and Gate 4 PR E (Track A) all remain separately gated.
- **No production `endpointUrl` re-flip.** `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy.
- **No production traffic.** No `curl` / browser visit / synthetic generator against any production endpoint is approved.
- **No website ThinSDK production activation.** No `mode: 'sprint2_v1_event'` activation in any production init. No production artefact / config mode flip.
- **No Track A.** Track A remains gated under PR#17e (or successor); not invoked by PR#17z and not approved as a follow-on action.
- **No Playwright.** No headless / programmatic browser run is approved.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.
- **No Lane A/B writer.** Staging Lane A/B counts remained at `0` / `0`; production Lane A/B `0`-row posture from PR#17g / PR#17q grant safety is carried forward without being re-queried.
- **No AMS Trust Core exposure.**
- **No Pass 1 / Pass 2 implementation.**
- **No Timing / Product Context scoring runtime, no knobs / dashboard.**
- **No DB grant change.** PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety remain the runtime steady state; no broadening to "make a future gate pass".
- **No `/var/www`, no Nginx / systemctl / DNS, no AMS source change, no website artefact change, no production config change.**

---

End of PR#17z. **Verdict: PASS — Gate 3 staging-only, DB-backed, multi-fixture acceptance only. PR#17x Gate 2 PASS (PR #30) and PR#17y Gate 3 planning (PR #31) are prerequisite evidence. Gate 3 PASS does not approve Gate 4, production `endpointUrl` re-flip, production traffic, Track A, Playwright, customer output, Lane A/B writer, AMS Trust, Pass 1, Pass 2, website ThinSDK production activation, or production artefact / config mode flip. Each subsequent gate requires its own separate Helen GO under `docs/ops/cutover-hard-gates.md`.**
