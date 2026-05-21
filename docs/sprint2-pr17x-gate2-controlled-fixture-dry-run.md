# BuyerRecon Sprint 2 PR#17x — Gate 2 Controlled Fixture Dry-Run (Staging-Only)

Status: **operator runbook executed end-to-end against the Hetzner staging host. Verdict: PASS — Gate 2 controlled fixture acceptance only. See §9.1.4 for the Attempt 3 audit trail.**

PR#17x is the Gate 2 step under `docs/ops/cutover-hard-gates.md`: a controlled non-customer fixture dry-run against a **staging** Sprint 2 collector, using the artefact contract established by AMS PR#17v (merged) and the website-side artefact update from PR#17w (merged). It proves — under non-production conditions only — that:

1. The fetch-equivalent Sprint 2 body shape produced by the PR#17v mapper (replicated here as a `curl --data-binary` POST, not an actual `FetchTransport` execution) is accepted by the staging Sprint 2 `/v1/event` parser through staging token auth and — if a staging DB is available — staging DB write/read verification. Whether the staging endpoint sits behind Nginx is operator-confirmable; PR#17x does not assert that hop unless §7.3 / §8.3 confirm it.
2. The staging collector's runtime DB role (mirroring the PR#17q grant matrix) can execute the actual SQL path without `permission denied` or `storage_failure`.
3. No production endpoint is contacted, no production token is used, no production DB is touched, no `/var/www` file is edited.

PR#17x's Gate 2 controlled fixture dry-run has now been **executed end-to-end** by Helen-as-operator on the Hetzner staging host (Attempt 3, 2026-05-21) under explicit Helen GO. Preflight §6.1–§6.6 passed categorically with no STOP, §7 returned HTTP `200` against the staging `/v1/event` endpoint, and §8 deterministic DB verification confirmed `ingest +1 / accepted +1 / rejected +0` against the bound `GATE2_REQUEST_ID` with `auth_status = ok`, `http_status = 200`, `reject_reason_code = NULL`, and `endpoint = /v1/event`. Staging Lane A/B counts remained at `0` / `0`. The PASS verdict is recorded against §10.1 (Gate 2 PASS criteria) only; it does **not** approve any subsequent gate, production action, customer-facing surface, or Lane A/B writer (see §11 and the hard-boundary block immediately below).

**Execution-attempt log:** §9.1 records each Helen-approved execution attempt. **Attempt 1** (2026-05-20) was blocked at preflight §6.2 because the Claude Code session had no `GATE2_*` env vars provisioned. **Attempt 2** (2026-05-20) was blocked at preflight §6.2 because the operator's shell had no `GATE2_SITE_WRITE_TOKEN`. A **token-provisioning preflight** (2026-05-20) recorded the staging token-provisioning prerequisites and produced the §15 appendix. **Attempt 3** (2026-05-21) executed §15.4 → §6 → §7 → §8 manually by Helen-as-operator on the Hetzner staging host under explicit Helen GO and returned **PASS** for Gate 2 controlled fixture acceptance only. The categorical audit trails are at §9.1.1 (Attempt 1), §9.1.2 (Attempt 2), §9.1.3 (token-provisioning preflight), and §9.1.4 (Attempt 3 — PASS).

> **Gate 2 fixture acceptance is not production deploy.**
> **EndpointUrl update is not event-capture proof.**
> **No endpointUrl re-flip is approved by PR#17x.**
> **No production traffic is approved by PR#17x.**
> **Do not delete failed canary evidence rows.**
> **Do not broaden grants to make a proof pass.**
> **Route readiness is not end-to-end readiness.**
> **Staging acceptance is not customer-facing output.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `de1a148` — "Sprint 2 PR#17u: record host ThinLayer hash proof (#26)").

PR branch: `buyerrecon-sprint2-pr17x-gate2-attempt3-execution`

---

## 1. Status / verdict

**PASS — Gate 2 controlled fixture acceptance only.**

Attempt 3 (2026-05-21) executed the runbook end-to-end on the Hetzner staging host under explicit Helen GO. Preflight §6.1–§6.6 passed categorically with no STOP, §7 returned HTTP `200` with a token-clean response, and §8 deterministic verification confirmed `ingest +1 / accepted +1 / rejected +0`, exactly one row returned for the bound `GATE2_REQUEST_ID`, `auth_status = ok`, `http_status = 200`, `reject_reason_code = NULL`, `endpoint = /v1/event`, and staging Lane A/B counts unchanged at `0` / `0`. No production endpoint was contacted, no production DB was queried, no `/var/www` file was edited, no DB grant was changed, no `endpointUrl` was re-flipped, no Track A / Playwright run was triggered, no customer-facing output was produced, and no raw token / Authorization header / `request_id` UUID value / raw response body / DSN / pepper / `token_hash` was printed. The PASS verdict is scoped to §10.1 (Gate 2 PASS criteria) only.

The transition criteria are recorded in §10 below. The §9.1.4 entry is the categorical audit trail for Attempt 3.

### What is in scope of this PASS verdict

- Gate 2 controlled fixture acceptance against the staging Sprint 2 `/v1/event` endpoint, executed end-to-end on Attempt 3 (§9.1.4).
- Preflight §6.1–§6.6 satisfied with no STOP (env-var presence, endpoint safety, fixture body assertions, token-shape sanity, staging-class DSN sanity).
- §7 staging POST returned HTTP `200` with token-clean response; a deterministic `request_id` was extracted into `GATE2_REQUEST_ID` for §8 binding (UUID value never printed).
- §8 staging DB verification confirmed `ingest +1 / accepted +1 / rejected +0`, with `auth_status = ok`, `http_status = 200`, `reject_reason_code = NULL`, `endpoint = /v1/event` for the bound `GATE2_REQUEST_ID`.
- Staging Lane A/B counts observed at `0` / `0` (no Lane A/B writer enabled by PR#17x).
- Operator-side cleanup: `/tmp/pr17x_gate2_token_export.sh` shredded / removed, fixture file removed, response file removed, `GATE2_SITE_WRITE_TOKEN` env unset.
- Docs-only runbook with §1–§15 populated remains the canonical operator artefact; the §9.1.4 entry is the live audit trail.

### What is NOT in scope of this PASS verdict

- No production endpoint was contacted; `https://buyerrecon.com/v1/event` and `https://buyerrecon-backend.onrender.com/collect` remain untouched by PR#17x.
- No production DB was queried; the 26 production `ingest_requests` evidence rows from the post-PR#17q canary remain preserved.
- No bundle deploy to any production host. No `/var/www` edit.
- No `endpointUrl` re-flip on `buyerrecon.com`; ThinLayer `endpointUrl` remains on Render legacy.
- No website ThinSDK activation of `sprint2_v1_event` mode; no `buyerrecon.com` production artefact / config mode flip. (The staging Sprint 2 `/v1/event` POST in Attempt 3 was a controlled non-customer fixture against the staging collector, not a production-side ThinSDK mode activation; the latter remains a Gate 4 PR C step gated by its own explicit Helen GO per §12.)
- No DB grant change. PR#17q column-level grants on `buyerrecon_prod_collector_app` stand untouched.
- No Nginx / systemctl / DNS change.
- No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust Core exposure, no Pass 1 implementation, no Pass 2 implementation.
- **The Gate 2 PASS does not pre-authorise Gate 3, Gate 4 PR B / PR C / PR D / PR E, or any future transport-selection change. Each remains separately gated by its own explicit Helen GO (§12).**

---

## 2. Scope and hard-gate references

### 2.1 What PR#17x is

A Gate 2 — Production-Role Dry Run (per `docs/ops/cutover-hard-gates.md` §4). The dry-run uses a controlled non-customer fixture body against a **staging** Sprint 2 collector and a **staging** DB role whose grant matrix mirrors `buyerrecon_prod_collector_app`'s PR#17q steady state.

### 2.2 What PR#17x is not

- Not Gate 3 (runtime privilege simulation — overlaps in spirit but Gate 3 is the dedicated production-equivalent role test recorded separately).
- Not Gate 4 PR B (bundle deploy to production host) or any later Gate 4 PR.
- Not a production deploy.
- Not a Sprint 2 mode activation in any production init file.
- Not a `curl` against `https://buyerrecon.com/v1/event` (the production same-origin Nginx route added by PR#17o).
- Not a `curl` against `https://buyerrecon-backend.onrender.com/collect` (the Render legacy collector, still the live capture path).
- Not a Track A invocation, Playwright run, or customer-facing output.

### 2.3 Mandatory reference compliance

- `docs/ops/cutover-hard-gates.md` — operational standard. Gate 2 §4 acceptance criteria honoured below.
- `docs/sprint2-pr17s-thinsdk-sprint2-collector-contract-shape-inspection.md` — Gate 1 Static Contract Diff.
- `docs/sprint2-pr17t-live-thinsdk-shape-confirmation.md` — Gate 1 local snapshot confirmation.
- `docs/sprint2-pr17u-host-thinlayer-hash-crosscheck.md` — Gate 1 host-side hash proof.
- AMS `thin/docs/pr17v-sprint2-option-a.md` — implementation source-of-truth.
- buyerrecon-website `docs/pr17w-thinlayer-artifact-update-from-ams-pr17v.md` — artefact update record.
- Backend contract: `src/collector/v1/routes.ts`, `src/collector/v1/envelope.ts`, `src/collector/v1/validation.ts`, `src/collector/v1/types.ts`, `src/collector/v1/persistence.ts`, `tests/v1/envelope.test.ts`, `tests/v1/validation.test.ts`.

---

## 3. Inputs and provenance

| Item | Value / source |
|---|---|
| Backend repo | `KeigenTechnologies/buyerrecon-backend` (this repo) |
| Backend base branch | `sprint2-architecture-contracts-d4cc2bf` at `de1a148` ("Sprint 2 PR#17u: record host ThinLayer hash proof (#26)") |
| AMS source commit | `13d49003c7ee7602df67049e019dfde483116f0f` ("Sprint 2 PR#17v: add ThinSDK Sprint 2 envelope mode (#8)") on `KeigenTechnologies/ams` `main` |
| AMS mapper file | `thin/packages/thin-sdk/src/sprint2-envelope.ts` (exports `toSprint2EventEnvelope`, `mapLegacyEventTypeToSprint2`, `SPRINT2_SCHEMA_KEY`, `SPRINT2_SCHEMA_VERSION`, `SPRINT2_EVENT_ORIGIN`) |
| Website artefact (PR#17w) | `thinlayer/thin-sdk.iife.js` sha256 `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`; byte-identical to the AMS PR#17v build output |
| Live production endpoint (NOT used by PR#17x) | `https://buyerrecon-backend.onrender.com/collect` (Render legacy — rollback target) |
| Sprint 2 production path (NOT used by PR#17x) | `https://buyerrecon.com/v1/event` (Nginx route added by PR#17o — proven by PR#17u host hash check; currently idle for ThinLayer traffic per PR#17p rollback) |
| Production DB (NOT touched by PR#17x) | `buyerrecon_production` on Hetzner under runtime role `buyerrecon_prod_collector_app` with PR#17q column-level grants |
| Staging endpoint | **TBD by operator** — provided via `GATE2_COLLECTOR_URL` env var |
| Staging write token | **TBD by operator** — provided via `GATE2_SITE_WRITE_TOKEN` env var; never printed |
| Staging DB | **TBD by operator** — provided via `GATE2_DATABASE_URL` env var (optional; only used if §8 verification queries are run) |
| Claude Code env at runbook authoring time | All five `GATE2_*` env vars: **MISSING** (categorical check) |

---

## 4. Staging-only safety controls

The runbook fail-closes **before** issuing any HTTP request or DB query if any of the following conditions hold. These are non-negotiable and copied verbatim from Helen's GO + the task brief.

### 4.1 Endpoint safety (must all be true to proceed)

- `GATE2_COLLECTOR_URL` must be set and non-empty.
- `GATE2_COLLECTOR_URL` must **not** contain the substring `https://buyerrecon.com/v1/event` (that is the production Sprint 2 path).
- `GATE2_COLLECTOR_URL` must **not** contain the substring `buyerrecon-backend.onrender.com/collect` (that is the Render legacy production collector).
- `GATE2_COLLECTOR_URL` must contain a clear staging identifier — preferred patterns: `collector-staging.`, `staging.`, `.staging.`, `localhost`, `127.0.0.1`, or a private RFC1918 host explicitly approved by Helen.
- `GATE2_COLLECTOR_URL` must end with the path `/v1/event` (single-event endpoint — Option A; not `/v1/batch`).

### 4.2 Token safety

- `GATE2_SITE_WRITE_TOKEN` must be set and non-empty.
- The token value must **never** be printed, echoed, logged, included in a curl command line (use a header file or `--header @file` pattern), pasted into chat, committed to this repo, captured in CI logs, or recorded in any §9 result block.
- The token's first/last bytes, length, hash, or fingerprint must not be recorded anywhere. PR#17u's PR#17m operator hygiene posture applies to staging too.
- The token must be a staging-issued token; production tokens are out of scope and disqualified from this PR.

### 4.2.1 Placeholder / sentinel-value rule (treat as MISSING and BLOCKED)

The following sentinel patterns must be **treated as MISSING** wherever they appear in `GATE2_*` env vars, and the corresponding fail-closed gate must fire as if the variable were empty:

| Variable | Sentinel patterns (case-insensitive, exact or `*` substring match) treated as MISSING |
|---|---|
| `GATE2_SITE_WRITE_TOKEN` | empty string · `PASTE_STAGING_TOKEN_HERE` · `TODO` · `CHANGEME` · `change-me` · `placeholder` · `REPLACE_ME` · `xxx` · `xxxx` · any value starting with `<` and ending with `>` (e.g. `<token>`) · any value beginning with `EXAMPLE_` |
| `GATE2_DATABASE_URL` | empty string · `PASTE_STAGING_DATABASE_URL_HERE` · `TODO` · `CHANGEME` · `placeholder` · `postgres://example…` · any URL whose host contains `example.com` |
| `GATE2_COLLECTOR_URL` | empty string · `PASTE_STAGING_URL_HERE` · `TODO` · `CHANGEME` · `placeholder` · any URL whose host contains `example.com` |
| `GATE2_WORKSPACE_ID` / `GATE2_SITE_ID` | empty string · `PASTE_STAGING_WORKSPACE_ID_HERE` / `PASTE_STAGING_SITE_ID_HERE` · `TODO` · `CHANGEME` · `placeholder` |

If any `GATE2_*` value matches a sentinel pattern, the runbook treats it as MISSING for all downstream §6.2 / §6.6 / §8.0 / §7 / §8 gating. The §9.1.N audit-log entry records `MISSING (sentinel)` for that variable, so the audit trail is honest about why the value was rejected without revealing what the sentinel literal was.

Concretely:

- If `GATE2_SITE_WRITE_TOKEN = "PASTE_STAGING_TOKEN_HERE"` (or any other sentinel), §6.2 treats `GATE2_SITE_WRITE_TOKEN` as MISSING and fail-closes — no POST, no token-shape check (§6.5 cannot exempt a sentinel).
- If `GATE2_DATABASE_URL = "PASTE_STAGING_DATABASE_URL_HERE"` (or any other sentinel), §8.0 treats it as MISSING and §8 is skipped entirely — no DB query.

This prevents an operator from accidentally proceeding with a copy-pasted placeholder that would otherwise pass an `is-non-empty` check.

### 4.3 DB safety (optional verification step)

- `GATE2_DATABASE_URL` is optional. If set, it must clearly identify a staging database (e.g. db_name contains `staging`, `_test`, or a known staging name; host is `localhost` / `127.0.0.1` / a known staging host). If the DSN appears production-like in any way, do **not** run §8.
- Any SQL run by §8 is **read-only**. No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT`, or `REVOKE`.
- DB queries return only categorical counts and a single auth_status / reject_reason_code value for the inserted row. No raw event-body content is selected.

### 4.4 Fixture body safety

- The fixture body must be **a single JSON object** at the top level (verified by JSON-parse before POST).
- The body must **not** be a JSON array.
- The body must **not** contain an `events` field (no `/v1/batch` wrapper).
- The body must contain all 8 backend-required fields (§5).
- The body must contain no token, no `Authorization` header value, no DSN, no password, no IP address, no email, no full URL with query, no raw localStorage / sessionStorage dump, no PII.

### 4.5 Output safety

- Any §9 result entry that would print a raw token, raw payload body, or raw DSN must instead print a categorical / redacted summary (e.g. `auth_status=ok`, `http_status=200`, `accepted_events delta = +1`).
- If the staging collector returns a response body containing a token or other sensitive material, capture only the HTTP status and the categorical reject_reason_code (if any).

### 4.6 Stop-line conditions (per `docs/ops/cutover-hard-gates.md` §8)

Stop immediately and report **BLOCKED** (or **FAIL** if the request reached the collector but was rejected) if any of:

- HTTP `500` from the staging collector.
- Collector journal `kind: storage_failure`.
- Collector journal or DB error `permission denied for table …` (or any `permission denied`).
- `reject_reason_code = request_body_invalid_json` against a body that the fixture asserted is a well-formed Sprint 2 envelope.
- `auth_status != ok` for a request with a non-empty staging token.
- Wrong `workspace_id` / `site_id` observed in the inserted row (e.g. production IDs appearing on a staging request).
- Lane A/B rows (`scoring_output_lane_a` / `scoring_output_lane_b`) unexpectedly created.
- Any raw secret printed in operator output or captured artefact.
- DB grants needed beyond the staging role's pre-approved matrix (the answer is "stop and re-approve the matrix", not "grant more").

---

## 5. Fixture body contract

The fixture is a **single non-customer JSON object** byte-shape-equivalent to `toSprint2EventEnvelope(legacyEvent)` for a synthetic `page_view`-shaped legacy event. It is constructed inline by the operator (no large bundle vendored into backend; no AMS source imported here). Everything below is checked-in / authored content — no PII, no tokens, no secrets.

### 5.1 Fixture body (canonical example)

```json
{
  "event_name": "page_view",
  "schema_key": "buyerrecon.thinlayer.event",
  "schema_version": "1.0.0",
  "client_event_id": "<OPERATOR-GENERATES-UUIDv4-OR-UUIDv7-AT-RUNTIME>",
  "event_type": "page",
  "event_origin": "browser",
  "occurred_at": "<OPERATOR-INSERTS-CURRENT-ISO-8601-AT-RUNTIME>",
  "session_id": "ses_gate2_pr17x_fixture",
  "path": "/gate2-fixture",
  "hostname": "gate2-fixture.test",
  "consent_state": "granted",
  "adapter_id": "buyerrecon_web",
  "adapter_version": "1.0.0",
  "legacy_event_type": "page_view"
}
```

The two `<OPERATOR-...>` placeholders are filled at runtime by the operator. Suggested resolution:

- `client_event_id` — `uuidgen | tr 'A-Z' 'a-z'` (POSIX `uuidgen` returns RFC 4122 v4 by default on macOS; on Linux use `cat /proc/sys/kernel/random/uuid`).
- `occurred_at` — `date -u +'%Y-%m-%dT%H:%M:%S.000Z'`. Must be inside the backend's `[now − 24h, now + 5min]` window (per backend `src/collector/v1/validation.ts:74–76`).

### 5.2 Required-field contract (cross-checked against backend `validateEventCore`)

| Sprint 2 required field | Fixture value | Backend check (validation.ts:163–175) |
|---|---|---|
| `event_name` | `"page_view"` (non-empty string) | Step 3 — `event_name_invalid` if missing/empty |
| `schema_key` | `"buyerrecon.thinlayer.event"` (non-empty string) | Step 4 — `schema_unknown` if missing/empty |
| `schema_version` | `"1.0.0"` (three-component semver) | Step 5 — `schema_version_malformed` if non-semver |
| `client_event_id` | runtime UUIDv4 or UUIDv7 | Step 6 — `client_event_id_missing` / `_invalid` |
| `event_type` | `"page"` (admit set for browser origin: page \| track) | Step 1 — `event_type_invalid` if not admitted |
| `event_origin` | `"browser"` | Step 1 — `event_origin_invalid` if not admitted |
| `occurred_at` | runtime ISO-8601 string inside `[now−24h, now+5min]` | Step 7 — `occurred_at_missing` / `_invalid` / `_too_old` / `_too_future` |
| `session_id` | `"ses_gate2_pr17x_fixture"` (non-empty string for browser origin) | Step 2 — `session_id_missing` if empty / absent |

Safe extras tolerated by the backend: `path`, `hostname`, `consent_state`, `adapter_id`, `adapter_version`, `legacy_event_type`. These match the AMS PR#17v mapper's safe-extras allowlist (see `thin/packages/thin-sdk/src/sprint2-envelope.ts` `Sprint2EventEnvelope` interface).

### 5.3 What the fixture body must NOT contain

- `workspace_id` — backend derives it from token binding; body value is ignored / would create boundary mismatch (per backend `src/collector/v1/auth-route.ts`).
- `site_id` — same as `workspace_id`.
- `Authorization`, `Bearer`, or any auth header value (auth is supplied via header, not body).
- `token`, `secret`, `password`, `pepper`, `dsn`, `apikey`, `api_key`.
- Email addresses, phone numbers, IP addresses, names, full URLs with query strings.
- Raw localStorage / sessionStorage dumps, raw cookies.
- `events` field (would convert the body into a `/v1/batch`-shaped wrapper).

### 5.4 Byte-shape correspondence with AMS PR#17v mapper

The above body is byte-shape-equivalent to `toSprint2EventEnvelope(legacyEvent)` called with a synthetic `PageViewEvent`-shaped legacy `ThinEvent` where:

- `legacyEvent.event_id` → `client_event_id` (same UUIDv4)
- `legacyEvent.event_type = 'page_view'` → `event_type='page'`, `event_name='page_view'` (per `mapLegacyEventTypeToSprint2`)
- `legacyEvent.client_timestamp_ms` → `occurred_at` (ISO string)
- `legacyEvent.anon_session_id` → `session_id`
- `legacyEvent.consent_signal` → `consent_state`
- `legacyEvent.path` / `.hostname` / `.adapter_id` / `.adapter_version` → identical key names in Sprint 2 envelope

If an operator wishes to regenerate the fixture directly from the AMS code, they can do so in a checked-out `KeigenTechnologies/ams` working tree by running `toSprint2EventEnvelope` against a constructed legacy event. PR#17x does not vendor that code into backend; the canonical fixture above is sufficient.

---

## 6. Preflight checks

Run these in the operator's shell before any §7 POST. Each is fail-closed; any check that does not match its expected state aborts the runbook.

### 6.1 Branch + repo state

```bash
cd <buyerrecon-backend clone>
git branch --show-current
# Expected for Attempt 3 proof branch: buyerrecon-sprint2-pr17x-gate2-attempt3-execution

git status --short --untracked-files=all
# Expected: this docs file shows as " A" or "M"; nothing else outside docs/.

git diff --check
# Expected: clean (no whitespace/conflict issues)
```

### 6.2 Environment-variable presence (no values printed)

```bash
for v in GATE2_COLLECTOR_URL GATE2_SITE_WRITE_TOKEN GATE2_WORKSPACE_ID GATE2_SITE_ID GATE2_DATABASE_URL; do
  val="${!v}"
  if [ -n "$val" ]; then echo "$v: PRESENT"; else echo "$v: MISSING"; fi
done
```

Required minimum (per Helen's GO):

- `GATE2_COLLECTOR_URL` = `PRESENT`
- `GATE2_SITE_WRITE_TOKEN` = `PRESENT`

If either is missing → **STOP, verdict remains BLOCKED.**

### 6.3 Endpoint safety check (no value printed)

```bash
# All three checks must pass (yes/no outputs only).
{
  echo "url contains buyerrecon.com/v1/event (must be: no): $(
    case "${GATE2_COLLECTOR_URL}" in
      *"https://buyerrecon.com/v1/event"*) echo "yes — STOP";;
      *) echo "no";;
    esac
  )"
  echo "url contains Render legacy /collect (must be: no): $(
    case "${GATE2_COLLECTOR_URL}" in
      *"buyerrecon-backend.onrender.com/collect"*) echo "yes — STOP";;
      *) echo "no";;
    esac
  )"
  echo "url ends with /v1/event (must be: yes): $(
    case "${GATE2_COLLECTOR_URL}" in
      *"/v1/event") echo "yes";;
      *) echo "no — STOP";;
    esac
  )"
  echo "url contains staging marker (must be: yes): $(
    case "${GATE2_COLLECTOR_URL}" in
      *staging*|*localhost*|*127.0.0.1*) echo "yes";;
      *) echo "no — STOP unless Helen explicitly approves the non-staging non-production target";;
    esac
  )"
}
```

If any check yields `STOP` → **STOP, verdict remains BLOCKED.**

### 6.4 Fixture body assertions (no token, no production identifier)

```bash
python3 - <<'PY'
import json, sys
body = json.loads(open("/tmp/pr17x-fixture.json").read())

assert isinstance(body, dict), "Fixture must be a top-level object"
assert not isinstance(body, list), "Fixture must not be an array"
assert "events" not in body, "Fixture must not contain { events: [...] } wrapper"

required = ["event_name","schema_key","schema_version","client_event_id",
            "event_type","event_origin","occurred_at","session_id"]
for k in required:
    v = body.get(k, None)
    assert isinstance(v, str) and len(v) > 0, f"Missing or empty required field: {k}"

import re
assert re.match(r"^\d+\.\d+\.\d+$", body["schema_version"]), "schema_version not semver"
uuid_re = r"^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
assert re.match(uuid_re, body["client_event_id"], re.I), "client_event_id not UUIDv4/v7"
assert body["event_origin"] == "browser", "event_origin must be 'browser'"
assert body["event_type"] in {"page","track"}, "event_type must be admitted for browser origin"

# Forbidden keys / sensitive material check
for k in ["workspace_id","site_id","Authorization","authorization","token","secret","password","pepper","dsn","apikey","api_key"]:
    assert k not in body, f"Forbidden key in fixture: {k}"

print("Fixture preflight: PASS")
PY
```

If any assertion fails → **STOP, verdict remains BLOCKED**, fix the fixture, re-run.

### 6.5 Token-shape sanity check (no value printed)

```bash
# Length-bucket check only — do NOT print or echo the token.
if [ -z "${GATE2_SITE_WRITE_TOKEN}" ]; then
  echo "token: MISSING — STOP"
elif [ ${#GATE2_SITE_WRITE_TOKEN} -lt 16 ]; then
  echo "token: length below sanity threshold — STOP, likely a placeholder"
else
  echo "token: present, length-bucket OK"
fi
```

The token value is never printed. Length-bucket is sufficient for sanity.

### 6.6 Production-DSN sanity check on `GATE2_DATABASE_URL` (if set)

If `GATE2_DATABASE_URL` is set, run the following yes/no check (the DSN value itself is never printed):

```bash
case "${GATE2_DATABASE_URL}" in
  *"buyerrecon_production"*|*"prod"*|*"production"*) echo "DSN appears production-like — STOP §8";;
  *"staging"*|*"_test"*|*"localhost"*|*"127.0.0.1"*) echo "DSN appears staging-shaped: OK";;
  *) echo "DSN unclassified — STOP §8 unless Helen explicitly approves";;
esac
```

If the DSN is production-like or unclassified → **STOP §8 only**, but §7 may still proceed if §6.1–§6.5 passed.

---

## 7. Controlled staging POST plan

**One single fixture event.** **One single POST.** **Staging only.** **No retry.** **No batch.** **No production endpoint.**

### 7.1 POST command (operator-runnable; no token printed)

Write the token to a temporary header file so it never appears in shell history or process arguments:

```bash
umask 077
TOKEN_HEADER_FILE=$(mktemp /tmp/pr17x-token-header.XXXXXX)
printf 'Authorization: Bearer %s\r\n' "${GATE2_SITE_WRITE_TOKEN}" > "${TOKEN_HEADER_FILE}"

curl -sS -o /tmp/pr17x-response.json -w 'HTTP %{http_code}\n' \
     -X POST "${GATE2_COLLECTOR_URL}" \
     -H 'Content-Type: application/json' \
     -H @"${TOKEN_HEADER_FILE}" \
     --data-binary @/tmp/pr17x-fixture.json

# Immediately scrub the header file so the token does not linger on disk.
shred -u "${TOKEN_HEADER_FILE}" 2>/dev/null || rm -f "${TOKEN_HEADER_FILE}"
```

Categorical post-checks:

- `curl` exit code is captured by the operator's shell `$?`; non-zero means a transport-layer failure (DNS, TLS, refused, timeout). Record the categorical class only, not the message.
- The `HTTP %{http_code}\n` writes only the integer status — no body, no headers.
- `/tmp/pr17x-response.json` holds the response body. **Before reading it**, run §7.2 redaction check.

### 7.2 Response redaction check

```bash
# Reject any response that contains token-like material before reading it.
if grep -qE '(Bearer|token|secret|pepper|password|api[_-]?key|BEGIN PRIVATE KEY|BEGIN CERTIFICATE)' /tmp/pr17x-response.json; then
  echo "response contains token-like material — DO NOT cat; redact before recording"
else
  echo "response is token-clean; safe to record categorical fields"
fi
```

If the response contains token-like material, record only the HTTP status, the `reject_reason_code` field (if present), and `auth_status` (if present), and explicitly note in §9 that the body was redacted.

### 7.3 Extract `request_id` for deterministic §8 verification

The staging collector's `/v1/event` response body carries a `request_id` UUID. Export it as a session variable so §8 can filter the DB lookup by that exact row. **Do not** export the token, do not export any payload field, and do not let the export step print anything other than a redacted yes/no.

```bash
# Extract request_id (UUIDv4) only — refuse any non-UUID value so a malformed
# or token-bearing response cannot leak into the variable.
GATE2_REQUEST_ID=$(python3 -c '
import json, sys, re
try:
    body = json.load(open("/tmp/pr17x-response.json"))
except Exception:
    sys.exit(0)
rid = body.get("request_id", "") if isinstance(body, dict) else ""
if isinstance(rid, str) and re.match(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    rid, re.I):
    print(rid)
')
if [ -n "${GATE2_REQUEST_ID}" ]; then
  echo "request_id: extracted (length-bucket OK; UUID-shaped)"
  export GATE2_REQUEST_ID
else
  echo "request_id: NOT EXTRACTED — staging collector response did not carry a UUID-shaped request_id; §8 will be skipped"
fi
```

If `GATE2_REQUEST_ID` is not extracted, §8 fail-closes (per §8.0 below) and the verdict is determined by the §7 HTTP outcome alone.

### 7.4 Expected categorical outcomes

| HTTP status | `reject_reason_code` (response body) | Interpretation |
|---|---|---|
| `200` | absent | **PASS** — staging collector accepted the Sprint 2 envelope; verify §8 row delta |
| `200` with `accepted_count=0, rejected_count=1` | per-event reject code (e.g. `event_type_invalid`) | **FAIL** — fixture is structurally valid but per-event validation rejected; record reason, do not retry |
| `400` | `request_body_invalid_json` | **FAIL** — envelope parser rejected; fixture is malformed in some way the §6.4 assertions did not catch. Inspect fixture body, do not retry against staging. |
| `401` / `403` | `auth_invalid` / `auth_site_disabled` | **BLOCKED** — staging token rejected. Do not retry with any other token. Check with Helen / operator. |
| `404` | n/a | **BLOCKED** — staging route not configured. Check `GATE2_COLLECTOR_URL`. |
| `415` | `content_type_invalid` | **FAIL** — Content-Type mis-set; check the `curl -H 'Content-Type: application/json'` header. Backend orchestrator maps `content_type_invalid` to HTTP `415` (not `400`); this is the canonical status code per backend `src/collector/v1/routes.ts`. |
| `5xx` | any / none | **BLOCKED + stop-line condition** — staging collector internal failure. Do not retry. Inspect collector logs out-of-band. |

---

## 8. Staging verification plan (optional; staging DB only)

### 8.0 Fail-closed preconditions (all four required to run any §8 query)

§8 is gated on **all four** of the following being present at runtime. If any is missing, **skip §8 entirely** and let the §7 HTTP outcome carry the verdict; the PR's overall verdict stays BLOCKED for the DB-verification dimension but the §7 outcome can still PASS / FAIL / BLOCKED for the envelope-acceptance dimension.

| Required env var | Why |
|---|---|
| `GATE2_DATABASE_URL` | the staging DSN. §6.6 must have returned `OK` (DSN appears staging-shaped). |
| `GATE2_WORKSPACE_ID` | the staging workspace identifier expected for this request (derived from the token binding). Without it, the row lookup cannot be filtered safely. |
| `GATE2_SITE_ID` | the staging site identifier expected for this request. Same reasoning as `GATE2_WORKSPACE_ID`. |
| `GATE2_REQUEST_ID` | the UUID extracted from the §7 staging collector response (§7.3). Without it, the row lookup is non-deterministic and could pick an unrelated recent staging row. |

```bash
# Run this gate before any §8 query. Categorical only.
{
  for v in GATE2_DATABASE_URL GATE2_WORKSPACE_ID GATE2_SITE_ID GATE2_REQUEST_ID; do
    val="${!v}"
    if [ -n "$val" ]; then echo "$v: PRESENT"; else echo "$v: MISSING — STOP §8"; fi
  done
}
```

If any line reports `STOP §8`, **do not run any §8.1 / §8.2 / §8.3 / §8.4 query**.

All `psql` invocations in §8 use **`psql -v <name>=<value>` bound variables** to bind the staging workspace / site / request identifiers into the SQL. These behave like compile-time `:'name'` substitutions in the query text and **do not** rely on `current_setting(...)` (which is a server-side `SET app.…` mechanism `\set` does not populate; that was the wrong pattern). No identifier is ever interpolated by shell concatenation, and no identifier value is printed.

> Note on `\set` / `current_setting`: an earlier draft of this runbook suggested setting workspace / site identifiers via psql's `\set` and reading them via `current_setting('app.staging_…', true)`. That is **incorrect** — `\set` is a psql-client variable mechanism (`:'name'` substitution in the query text), while `current_setting(...)` reads a **server-side GUC** that is set by `SET app.staging_… = '…'` or `set_config(...)`. The two do not interoperate. PR#17x uses the psql-client `-v` mechanism exclusively, with `:'…'` quoted-substitution in the SQL.

### 8.1 Pre-counts (run before the §7 POST, or recompute via post-counts − 1)

```bash
psql "${GATE2_DATABASE_URL}" -tA \
  -v gate2_workspace="${GATE2_WORKSPACE_ID}" \
  -v gate2_site="${GATE2_SITE_ID}" \
  -c "
SELECT
  (SELECT count(*) FROM public.ingest_requests
     WHERE workspace_id = :'gate2_workspace'
       AND site_id      = :'gate2_site') AS ingest_pre,
  (SELECT count(*) FROM public.accepted_events
     WHERE workspace_id = :'gate2_workspace'
       AND site_id      = :'gate2_site') AS accepted_pre,
  (SELECT count(*) FROM public.rejected_events
     WHERE workspace_id = :'gate2_workspace'
       AND site_id      = :'gate2_site') AS rejected_pre;
"
```

The query returns three integers in a single row. Categorical only — workspace / site identifier values are never printed by `psql -tA`.

### 8.2 Post-counts (after the §7 POST and §7.3 request_id extraction)

Re-run the §8.1 query immediately after the POST. Expected delta against the pre-counts (or the operator can compute the deltas as `post − pre`):

- `ingest_pre → ingest_post` = `+1`
- `accepted_pre → accepted_post` = `+1`
- `rejected_pre → rejected_post` = `+0`

If `accepted_pre → accepted_post` = `+0` AND `rejected_pre → rejected_post` = `+1`, the request was accepted at the envelope stage but rejected per-event. Record the reject reason from §8.3 — do not retry.

### 8.3 Auth status + reject reason for the inserted row (deterministic lookup by `request_id`)

```bash
# Identify the inserted row by the request_id UUID extracted in §7.3.
# All identifiers bound via psql -v; no shell interpolation; no token printed.
psql "${GATE2_DATABASE_URL}" -tA \
  -v gate2_request_id="${GATE2_REQUEST_ID}" \
  -v gate2_workspace="${GATE2_WORKSPACE_ID}" \
  -v gate2_site="${GATE2_SITE_ID}" \
  -c "
SELECT request_id, auth_status, http_status, reject_reason_code,
       workspace_id, site_id, endpoint, collector_version
FROM public.ingest_requests
WHERE request_id   = :'gate2_request_id'::uuid
  AND workspace_id = :'gate2_workspace'
  AND site_id      = :'gate2_site'
  AND endpoint     = '/v1/event';
"
```

Notes:

- The query filters on `request_id` first, which is the primary deterministic key for this POST. The additional `workspace_id` / `site_id` / `endpoint` clauses are belt-and-braces — they guarantee that if the bound `GATE2_REQUEST_ID` is ever wrong, the row will simply not match (zero rows returned) rather than picking a different recent row.
- The query uses `received_at` implicitly via the row identity, **not** `created_at`. (An earlier draft referenced `created_at`, which is not the column the backend's `ingest_requests` schema uses for request arrival time — the canonical column is `received_at`.)
- The query is read-only. No raw payload columns (`request_body_sha256` is fine; `raw` / `body` columns are NOT selected).

Categorical expected result for a PASS:

- exactly **one row returned**
- `auth_status = 'ok'`
- `http_status = 200`
- `reject_reason_code IS NULL`
- `workspace_id` equals `GATE2_WORKSPACE_ID` (staging boundary expected from the token)
- `site_id` equals `GATE2_SITE_ID`
- `endpoint = '/v1/event'`
- `collector_version` matches whatever staging collector is running (e.g. `buyerrecon-backend-sprint2-pr17m` or a newer staging build)

If zero rows return, the request_id did not reach this DB or did not match the staging boundary — record categorically and mark §8 as BLOCKED (not FAIL) until the operator resolves the staging environment.

### 8.4 Accepted-event verification (optional, deterministic via `request_id` join)

If the operator wants to confirm the `accepted_events` row that resulted from this specific request, the join uses the same `request_id` (or, alternatively, a `gate2_client_event_id` bound variable derived from the fixture body):

```bash
psql "${GATE2_DATABASE_URL}" -tA \
  -v gate2_request_id="${GATE2_REQUEST_ID}" \
  -v gate2_workspace="${GATE2_WORKSPACE_ID}" \
  -v gate2_site="${GATE2_SITE_ID}" \
  -c "
SELECT ae.event_id, ae.event_contract_version
FROM public.accepted_events ae
JOIN public.ingest_requests ir ON ir.request_id = ae.request_id
WHERE ir.request_id   = :'gate2_request_id'::uuid
  AND ir.workspace_id = :'gate2_workspace'
  AND ir.site_id      = :'gate2_site';
"
```

If the `accepted_events` table does not carry a `request_id` foreign key in this staging schema, the operator may instead filter `accepted_events` directly by `(workspace_id, site_id, client_event_id)` using a fifth bound variable `gate2_client_event_id="${GATE2_CLIENT_EVENT_ID}"` that is the UUID written into the §5.1 fixture body. Either approach is deterministic and never selects raw payload columns.

### 8.5 Lane A/B grant safety re-affirmation

```bash
# Read-only count on the STAGING DB only. PR#17x performs no production DB
# access. Staging may pre-exist with non-zero counts from prior fixtures; any
# non-zero value is recorded for Helen's review but does not block — it is
# unrelated to PR#17v / 17w / 17x. The production Lane A/B `0`-row posture
# is carried forward from PR#17g / PR#17q grant safety and is NOT queried here.
psql "${GATE2_DATABASE_URL}" -tA -c "
SELECT
  (SELECT count(*) FROM public.scoring_output_lane_a) AS lane_a_count,
  (SELECT count(*) FROM public.scoring_output_lane_b) AS lane_b_count;
"
```

Within PR#17x's staging-only verification scope: record the staging Lane A/B counts as observed. If non-zero, record the value and flag for Helen's review only — non-zero on staging is **not** a regression caused by PR#17x and PR#17x makes no claim about whether production Lane A/B counts are `0` (PR#17x does not query the production DB; production Lane A/B grant-safety posture is carried forward from PR#17g / PR#17q without being re-verified here).

### 8.6 No production DB query

Under no circumstance does any §8 query touch `buyerrecon_production` or any production-named DB. The §6.6 DSN sanity check and the §8.0 fail-closed precondition are the gating controls.

---

## 9. Execution results

**Section is BLOCKED. No staging POST or DB verification has been run by Claude Code in this session.**

| Item | Value |
|---|---|
| Preflight §6.1–§6.6 result | **NOT EXECUTED** — `GATE2_COLLECTOR_URL` and `GATE2_SITE_WRITE_TOKEN` both `MISSING` in this session |
| §7 POST HTTP status | **NOT EXECUTED** |
| §7 response `reject_reason_code` | **NOT EXECUTED** |
| §8.0 fail-closed precondition gate (all four env vars: `GATE2_DATABASE_URL`, `GATE2_WORKSPACE_ID`, `GATE2_SITE_ID`, `GATE2_REQUEST_ID`) | **NOT EXECUTED** — all four `GATE2_*` missing |
| §8.1 pre-counts | **NOT EXECUTED** |
| §8.2 post-counts | **NOT EXECUTED** |
| §8.3 `auth_status` / `http_status` for inserted row (deterministic lookup by `request_id`) | **NOT EXECUTED** |
| §8.4 accepted-event verification (optional, deterministic via `request_id` join) | **NOT EXECUTED** |
| §8.5 Lane A/B grant safety re-affirmation | **NOT EXECUTED** (carried forward from PR#17g grant-safety posture: production Lane A/B rows remain `0`; staging unchanged) |

The operator runs §6 → §7 → §8 under explicit Helen GO and appends results into this section (or amends this PR with an additional commit). The verdict in §1 transitions to PASS / PASS WITH NON-BLOCKING NOTES / FAIL accordingly.

### 9.1 Execution-attempt log

This subsection logs each Helen-approved execution attempt against this runbook. Each attempt records the categorical preflight outcome and, if execution proceeded, the categorical §7 / §8 results. No raw token, no raw payload, no raw response body is recorded — only categorical fields permitted by the §4.5 output-safety rule.

#### 9.1.1 Attempt 1 — 2026-05-20 (Claude Code session under explicit Helen GO for PR#17x execution)

| Item | Value |
|---|---|
| Attempting branch | `buyerrecon-sprint2-pr17x-gate2-controlled-fixture-execution` (created from `sprint2-architecture-contracts-d4cc2bf` at `6da2d96` — PR#17x merged) |
| §6.2 env-var presence (categorical only, no values printed) | `GATE2_COLLECTOR_URL`: **MISSING** · `GATE2_SITE_WRITE_TOKEN`: **MISSING** · `GATE2_DATABASE_URL`: **MISSING** · `GATE2_WORKSPACE_ID`: **MISSING** · `GATE2_SITE_ID`: **MISSING** |
| §6.2 minimum-env required to proceed to §7 (`GATE2_COLLECTOR_URL` + `GATE2_SITE_WRITE_TOKEN`) | **FAIL** — both required env vars missing |
| §6.3 endpoint safety check | **NOT REACHED** (skipped because §6.2 failed) |
| §6.4 fixture body assertions | **NOT REACHED** |
| §6.5 token-shape sanity check | **NOT REACHED** |
| §6.6 DSN sanity check | **NOT REACHED** |
| §7 controlled staging POST | **NOT EXECUTED** — preflight §6.2 blocked it at the first gate; no HTTP request was issued |
| §7.1 `curl` invocation | **NOT EXECUTED** |
| §7.2 response redaction check | **NOT EXECUTED** |
| §7.3 `request_id` extraction | **NOT REACHED** — no response to parse |
| §7.4 expected categorical outcomes | **NOT REACHED** |
| §8 staging DB verification (all four required env vars) | **NOT EXECUTED** — `GATE2_DATABASE_URL`, `GATE2_WORKSPACE_ID`, `GATE2_SITE_ID` all missing; `GATE2_REQUEST_ID` could not be derived because §7 did not run |
| §8.1 pre-counts | **NOT EXECUTED** |
| §8.2 post-counts | **NOT EXECUTED** |
| §8.3 deterministic row lookup | **NOT EXECUTED** |
| §8.4 accepted-event verification | **NOT EXECUTED** |
| §8.5 Lane A/B staging counts | **NOT EXECUTED** (staging not queried; production posture for Lane A/B carried forward from PR#17g / PR#17q without being re-queried — PR#17x makes no production-DB claim) |
| Attempt 1 verdict | **BLOCKED — staging execution not run** |
| Categorical reason | The Claude Code session under which this execution attempt was made did not have any `GATE2_*` env var provisioned. Per §6.2 / §8.0 fail-closed preconditions and Helen's GO ("Do not execute POST if: `GATE2_COLLECTOR_URL` is missing"), no HTTP request was issued, no DB query was run, no token was read, no production action was taken. At the time of Attempt 1, the runbook in §1 / §10.3 therefore remained BLOCKED — awaiting staging operator inputs (PR#17x has since transitioned to PASS via Attempt 3 — see §9.1.4 and §1). |
| Boundary affirmations for Attempt 1 | No production deploy. No `/var/www` edit. No `endpointUrl` re-flip. No production traffic. No production DB query. No DB grant change. No Nginx / systemctl / DNS change. No Track A. No Playwright. No customer-facing output. No Lane A/B writer. No AMS Trust / Pass 1 / Pass 2. The 26 production `ingest_requests` canary evidence rows remain preserved. PR#17q column-level grants remain the runtime steady state. **Gate 2 fixture acceptance has not passed.** |

#### 9.1.2 Attempt 2 — 2026-05-20 (manual operator preflight after switching to `buyerrecon-backend`)

| Item | Value |
|---|---|
| Attempting context | Helen-as-operator ran a manual preflight inside the `buyerrecon-backend` working tree on this branch, with partial env-var provisioning. The runbook's audit log captures the operator's reported preflight state verbatim — no shell session of Claude Code performed the §6 / §7 / §8 commands. |
| §6.2 env-var presence (operator-reported, categorical only, no values printed) | `GATE2_COLLECTOR_URL`: **SET** · `GATE2_SITE_WRITE_TOKEN`: **MISSING** · `GATE2_DATABASE_URL`: **MISSING** · `GATE2_WORKSPACE_ID`: **SET** · `GATE2_SITE_ID`: **SET** |
| §6.2 minimum-env required to proceed to §7 (`GATE2_COLLECTOR_URL` AND `GATE2_SITE_WRITE_TOKEN`) | **FAIL** — `GATE2_SITE_WRITE_TOKEN` is missing; the bearer-token slot is unfilled, so no authenticated POST can be constructed |
| §6.3 endpoint safety check | **NOT REACHED** (skipped because §6.2 failed). `GATE2_COLLECTOR_URL` presence alone is not sufficient to advance — a URL without a paired token cannot be POSTed against and §6.2 fails closed before any URL pattern checks would even run. |
| §6.4 fixture body assertions | **NOT REACHED** |
| §6.5 token-shape sanity check | **NOT REACHED** (no token to inspect; length-bucket check is moot when the variable is empty) |
| §6.6 DSN sanity check | **NOT REACHED** (no `GATE2_DATABASE_URL` to classify; §8 would be skipped even if §7 had run) |
| §7 controlled staging POST | **NOT EXECUTED** — preflight §6.2 blocked it; no `curl`, no HTTP request, no token read, no body shipped, no temporary header file created |
| §7.3 `request_id` extraction | **NOT REACHED** — no response to parse |
| §8 staging DB verification | **NOT EXECUTED** — §8.0 four-env fail-closed gate triggers on missing `GATE2_DATABASE_URL`; `GATE2_REQUEST_ID` could not be derived because §7 did not run; even though `GATE2_WORKSPACE_ID` and `GATE2_SITE_ID` are SET, all four of `{GATE2_DATABASE_URL, GATE2_WORKSPACE_ID, GATE2_SITE_ID, GATE2_REQUEST_ID}` are required by §8.0 and not all four are present |
| §8.1 pre-counts / §8.2 post-counts / §8.3 deterministic row lookup / §8.4 accepted-event verification / §8.5 Lane A/B staging counts | all **NOT EXECUTED** |
| Attempt 2 verdict | **BLOCKED — staging execution not run** |
| Categorical reason | `GATE2_SITE_WRITE_TOKEN` is missing in the operator's shell. Per §6.2 / Helen's GO ("Do not execute POST if: `GATE2_SITE_WRITE_TOKEN` is missing"), the fail-closed gate fired before any §6.3 / §7 / §8 step could run. The doc records this attempt as a no-op preflight so the audit trail is complete. |
| Next required input | a **real staging-only `GATE2_SITE_WRITE_TOKEN`** (issued for the staging Sprint 2 collector — must be **staging-issued**, not a production token, not a placeholder, not a literal like `PASTE_STAGING_TOKEN_HERE` / `TODO` / `CHANGEME`; see §4.2.1 placeholder rule). |
| Optional input | a staging-only `GATE2_DATABASE_URL` if §8 DB verification is desired (otherwise §7 HTTP outcome alone carries the verdict). If `GATE2_DATABASE_URL` is set to a placeholder literal, §4.2.1 / §8.0 treats it as MISSING and skips §8. |
| Boundary affirmations for Attempt 2 | No production deploy. No `/var/www` edit. No `endpointUrl` re-flip. No production traffic. No production DB query. No staging DB query (skipped at §8.0). No DB grant change. No Nginx / systemctl / DNS change. No Track A. No Playwright. No customer-facing output. No Lane A/B writer. No AMS Trust / Pass 1 / Pass 2. The 26 production `ingest_requests` canary evidence rows remain preserved. PR#17q column-level grants remain the runtime steady state. **Gate 2 fixture acceptance has not passed.** |

#### 9.1.3 Token provisioning preflight — 2026-05-20 (BLOCKED at fail-closed Step 3)

This is **not** an execution attempt against the §7 / §8 runbook — it is a precursor recording the categorical state of the **staging site-write token provisioning pre-condition** that Attempt 2 identified as the missing input. The findings are docs-only; no DB mutation, no token generation, no production action.

| Item | Value |
|---|---|
| Repo state | branch `buyerrecon-sprint2-pr17x-gate2-controlled-fixture-execution`, base `6da2d96` (PR#17x merged as #27) |
| Source mechanism (auth hash path) | `hashSiteWriteToken(token, pepper) = HMAC-SHA256(token, pepper).hex()` — defined at `src/auth/workspace.ts:36–44`, called by the collector at `src/collector/v1/auth-route.ts:84`. Pepper is read from the env var `SITE_WRITE_TOKEN_PEPPER`. |
| `site_write_tokens` table shape | `src/db/schema.sql:311–320` — columns `token_id UUID PK`, `token_hash TEXT NOT NULL UNIQUE`, `workspace_id TEXT NOT NULL`, `site_id TEXT NOT NULL`, `label TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `disabled_at TIMESTAMPTZ`, `last_used_at TIMESTAMPTZ`. Active-row index on `(token_hash) WHERE disabled_at IS NULL`. |
| Existing token-creation script in repo (`scripts/*.ts`) | **NOT FOUND.** `find scripts -name "*token*"` returns empty. No npm `package.json` script for token creation. PR#17m runbook explicitly states "No token creation" (it's a docs-only secret-recovery runbook); PR#17c is planning-only. Token provisioning has historically been an operator-run ad-hoc SQL pattern using the exported `hashSiteWriteToken` primitive — no checked-in mechanised script exists. |
| Raw-token recoverability from DB | **NOT RECOVERABLE.** The `token_hash` column stores only HMAC-SHA256 output; raw tokens are never persisted. If an existing staging token's raw value is not in an external secret store, it cannot be recovered — a new staging token must be provisioned. |
| Step 2 env-var presence (Claude Code session at this time, categorical only, no values) | `DATABASE_URL`: **MISSING** · `TEST_DATABASE_URL`: **MISSING** · `STAGING_DATABASE_URL`: **MISSING** · `SITE_WRITE_TOKEN_PEPPER`: **MISSING** · `IP_HASH_PEPPER`: **MISSING** · `GATE2_DATABASE_URL`: **MISSING** · `GATE2_WORKSPACE_ID`: **MISSING** · `GATE2_SITE_ID`: **MISSING** · `GATE2_COLLECTOR_URL`: **MISSING** · `GATE2_SITE_WRITE_TOKEN`: **MISSING** |
| Step 3 fail-closed checks | **FAIL on multiple axes:** (1) no staging DB URL available — `STAGING_DATABASE_URL` and `GATE2_DATABASE_URL` both MISSING; (2) no token pepper available — `SITE_WRITE_TOKEN_PEPPER` MISSING, so the HMAC hash that the collector's auth-route would later compute against the candidate token cannot be replicated; (3) no checked-in token-creation script exists — writing one ad-hoc would introduce a new code path not reviewed by the same chain that approved PR#17v / PR#17w. |
| Step 4 token-recovery check | **NOT EXECUTED** — Step 3 fail-closed gate must pass first; without a DB URL the recovery query cannot run. The task brief also notes that even if recovery surfaced a row, the raw token is not in DB (`token_hash` is one-way), so recovery alone cannot produce `GATE2_SITE_WRITE_TOKEN`. |
| Step 5 token creation | **NOT EXECUTED.** No DB mutation. No raw token generated. No `token_hash` computed. No `INSERT INTO site_write_tokens` issued. No `/tmp` export file created. |
| Step 6 categorical post-creation verification | **NOT EXECUTED** (no creation occurred). |
| Token-provisioning verdict | **BLOCKED — staging token provisioning prerequisites missing.** |
| Categorical reason | Three independent fail-closed gates fired: (a) no staging DB access in this session, (b) no `SITE_WRITE_TOKEN_PEPPER` in this session, (c) no canonical token-creation script in the repo. Per Step 3 of the task brief and Helen's GO, the correct action is to **STOP, not mutate the DB, and provide a safe manual operator runbook** — recorded as a new appendix §15 below — for an authorised operator with staging access to provision the token outside this Claude Code session. |
| Boundary affirmations for this preflight | No production DB. No production token. No production `SITE_WRITE_TOKEN_PEPPER` read or referenced. No `buyerrecon.com` production traffic. No Render legacy `/collect` call. No `INSERT` / `UPDATE` / `DELETE` / `GRANT` / `REVOKE` against any DB. No `/var/www` edit. No Nginx / systemctl / DNS change. No Track A. No Playwright. No customer-facing output. No Lane A/B writer. No AMS Trust / Pass 1 / Pass 2. The 26 production `ingest_requests` canary evidence rows remain preserved. PR#17q column-level grants remain the runtime steady state. No raw token, no `token_hash`, no pepper, no DSN appears anywhere in this entry, in the diff, in chat, in commit messages, or in any captured artefact derived from this preflight. |
| Next required operator action | An authorised operator with staging access executes the §15 appendix runbook (or equivalent operator-side procedure) to provision one staging-only `site_write_tokens` row bound to (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`, `label = pr17x_gate2_fixture`) and hand the raw token off via a `chmod 600` `/tmp/pr17x_gate2_token_export.sh` file. The operator then sources that file in the Gate 2 execution shell and re-runs §6 → §7 → §8 of this runbook (Attempt 3 will log to a new §9.1.4 entry). |

#### 9.1.4 Attempt 3 — 2026-05-21 (Helen-as-operator end-to-end execution on the Hetzner staging host — PASS)

This is the Gate 2 — Production-Role Dry Run execution against the staging Sprint 2 `/v1/event` collector, run manually by Helen-as-operator on the Hetzner staging host (`/opt/buyerrecon-backend`) under explicit Helen GO. No Claude Code session executed any §6 / §7 / §8 shell command, no `curl` against production, no `psql` against production. This entry records the categorical evidence reported by the operator after execution. No raw token, no `token_hash`, no token prefix / suffix, no token length value, no `token_id`, no pepper, no DSN, no Authorization header, no `request_id` UUID value, no raw payload, no raw response body, no private-key or certificate body, no env dump, and no vault content appears in this entry, in the diff, in chat, in commit messages, or in any artefact derived from this attempt.

| Item | Value |
|---|---|
| Attempting context | Helen-as-operator ran §15.4 → §6 → §7 → §8 manually on the Hetzner staging host with the staging Sprint 2 collector reachable at the §15.4 hand-off URL (staging collector URL ending in `/v1/event`). Heredoc-style `psql -v` bound-variable substitution was used per §8 (no broken `psql -c ... :'var'` shape). Claude Code did not execute any §6 / §7 / §8 command in this attempt. |
| Repo / host posture | Repo path present at `/opt/buyerrecon-backend`: **yes** · remote host: `hetzner_staging` · `/tmp/pr17x_gate2_token_export.sh` exists: **yes** · export file mode: **600** |
| §15.4 token hand-off | `GATE2_SITE_WRITE_TOKEN`: **PRESENT** · token length-bucket sanity: **OK** (no length value printed) · token / `token_hash` / token prefix / token suffix / `token_id` / pepper / Authorization header: **NOT PRINTED** |
| §6.2 env-var presence (categorical only, no values printed) | `GATE2_COLLECTOR_URL`: **SET** · `GATE2_SITE_WRITE_TOKEN`: **SET** · `GATE2_DATABASE_URL`: **SET** (staging-class DSN shape; DSN value never printed) · `GATE2_WORKSPACE_ID`: **SET** (= `buyerrecon_staging_ws`) · `GATE2_SITE_ID`: **SET** (= `buyerrecon_com`) |
| §6.3 endpoint safety check | **PASS** — `GATE2_COLLECTOR_URL` is the staging collector URL ending in `/v1/event`; production-endpoint check returned: **no** (i.e. URL is not `https://buyerrecon.com/v1/event` and not `https://buyerrecon-backend.onrender.com/collect`). |
| §6.4 fixture body assertions | **PASS** — no token in body, no production identifier, all 8 backend-required fields present (per §5.2). |
| §6.5 token-shape sanity check | **PASS** — length-bucket OK; token value never printed. |
| §6.6 DSN sanity check | **PASS** — DSN appears staging-class (DSN value never printed). |
| Overall preflight result (§6.1–§6.6) | **PASS** |
| Fixture preflight | **PASS** |
| §8.1 staging DB pre-counts (bound to `GATE2_WORKSPACE_ID` / `GATE2_SITE_ID`) | `ingest_pre = 16` · `accepted_pre = 16` · `rejected_pre = 0` |
| §7 controlled staging POST | `curl` exit-code class: **0** · HTTP status: **200** (HTTP status class: **2xx**) · response redaction check: **token-clean** · Authorization header printed: **no** · raw response body printed: **no** |
| §7.3 `request_id` extraction | **EXTRACTED — yes** (UUID-shaped `request_id` captured into `GATE2_REQUEST_ID` for §8 binding; UUID value never printed). |
| §8.2 staging DB post-counts and deltas (bound to `GATE2_WORKSPACE_ID` / `GATE2_SITE_ID`) | `ingest_delta = +1` · `accepted_delta = +1` · `rejected_delta = +0` |
| §8.3 deterministic row lookup (bound by `GATE2_REQUEST_ID`, heredoc-style `psql -v`) | rows returned: **1** · `auth_status = ok` · `http_status = 200` · `reject_reason_code IS NULL` · `endpoint = /v1/event` · workspace_id matched `GATE2_WORKSPACE_ID` · site_id matched `GATE2_SITE_ID` · UUID and row payload content never printed beyond these categorical fields. |
| §8.4 accepted-event verification | **PASS** (deterministic via `request_id` join; categorical confirmation only — no payload columns selected). |
| §8.5 staging Lane A/B counts | `lane_a_count = 0` · `lane_b_count = 0` (no Lane A/B writer enabled by PR#17x; staging Lane A/B posture unchanged). |
| Operator-side cleanup | `/tmp/pr17x_gate2_token_export.sh`: **removed** · fixture file: **removed** · `/tmp/pr17x-response.json`: **removed** · `GATE2_SITE_WRITE_TOKEN` env: **unset** |
| §10.1 PASS criteria coverage | **All categorical conditions met:** §6 preflight PASS with no STOP; §7 HTTP `200`; §7 response carried no `reject_reason_code`; §8.0 four-env precondition satisfied; §8.1→§8.2 deltas = `+1 / +1 / +0`; §8.3 deterministic single-row lookup with `auth_status = ok`, `http_status = 200`, `reject_reason_code` NULL, `endpoint = /v1/event`, workspace_id / site_id bound to expected values; §8.5 staging Lane A/B unchanged at `0` / `0`; no raw secret printed anywhere; no production endpoint contacted; no production DB queried. |
| Attempt 3 verdict | **PASS — Gate 2 controlled fixture acceptance only.** |
| Categorical reason | The staging Sprint 2 `/v1/event` collector accepted the PR#17v-shape Sprint 2 envelope under staging token auth, the staging DB persisted the corresponding `ingest_requests` row at `auth_status = ok` / `http_status = 200` / `reject_reason_code = NULL` / `endpoint = /v1/event`, and the deterministic `request_id`-bound lookup returned exactly one row whose categorical fields match the staging boundary identifiers (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`). The end-to-end §6 → §7 → §8 chain therefore satisfies the §10.1 PASS criteria. |
| Boundary affirmations for Attempt 3 | production_touched: **no** · render_collect_called: **no** · endpoint_reflip: **no** · /var/www edit: **no** · DB grants changed: **no** · Track A run: **no** · Playwright run: **no** · customer-facing output: **no** · raw_token_printed: **no** · authorization_header_printed: **no** · request_id_value_printed: **no** · raw_response_body_printed: **no**. No `curl` against `https://buyerrecon.com/v1/event`. No `curl` against `https://buyerrecon-backend.onrender.com/collect`. No production DB query; the 26 production `ingest_requests` evidence rows from the post-PR#17q canary remain preserved. No Nginx / systemctl / DNS change. No AMS Trust / Pass 1 / Pass 2. No Lane A/B writer enabled. PR#17q column-level grants on `buyerrecon_prod_collector_app` remain the runtime steady state. |
| Scope of this PASS | **§10.1 Gate 2 controlled fixture acceptance only.** Does **not** approve: production `endpointUrl` re-flip, production traffic, Track A, Playwright, customer-facing output, Lane A/B writers, AMS Trust Core exposure, Pass 1 implementation, or Pass 2 implementation. Each subsequent gate (Gate 3 runtime privilege simulation; Gate 4 PR B bundle deploy; Gate 4 PR C `endpointUrl` re-flip + `mode: 'sprint2_v1_event'` activation; Gate 4 PR D organic observation; Gate 4 PR E Track A; any future transport-selection change) remains separately gated by its own explicit Helen GO per §12. |
| Next required Helen GO | Authorisation to advance to Gate 3 (runtime privilege simulation per `docs/ops/cutover-hard-gates.md` §5) with its own scoped runbook, fail-closed preconditions, and audit trail. |

Subsequent execution attempts (under operator-provisioned staging env or via an authorised operator running §6 → §7 → §8 directly) append their own `9.1.N` block to this log, preserving the audit trail.

---

## 10. Interpretation

### 10.1 PASS criteria

All of the following must hold (categorical):

- §6 preflight: every check returned its expected value with **no STOP**.
- §7 HTTP status: `200`.
- §7 response: no `reject_reason_code` (or `reject_reason_code = NULL`).
- §8.0: all four required env vars present, DSN passes §6.6 sanity, `GATE2_REQUEST_ID` was extracted from the §7 response.
- §8.1 → §8.2 deltas (if §8 was run): `ingest +1`, `accepted +1`, `rejected +0`.
- §8.3: exactly one row returned for the bound `GATE2_REQUEST_ID`; `auth_status = 'ok'`, `http_status = 200`, `reject_reason_code IS NULL`, `workspace_id` equals `GATE2_WORKSPACE_ID`, `site_id` equals `GATE2_SITE_ID`, `endpoint = '/v1/event'`.
- §8.5: staging Lane A/B counts recorded; production posture carried forward from PR#17g / PR#17q (no production DB access is part of PR#17x).
- No raw secret printed anywhere.
- No production endpoint contacted.
- No production DB queried.

### 10.2 PASS WITH NON-BLOCKING NOTES criteria

PASS criteria are met **except** one of:

- §8.5 staging Lane A/B count is non-zero (pre-existing staging fixture data; no regression introduced by PR#17x).
- §7 response body included an unexpected non-secret extra field that did not affect acceptance.
- Staging collector version is older than the production-deployed staging version (informational only).

### 10.3 BLOCKED criteria

Any §6 fail-closed precondition triggers BLOCKED. Additionally:

- `GATE2_COLLECTOR_URL` or `GATE2_SITE_WRITE_TOKEN` is missing.
- §6.3 endpoint safety: any "STOP" outcome.
- §6.6 DSN sanity (for the optional §8): "STOP §8" → §8 is skipped; if §7 also cannot run, the whole PR remains BLOCKED.
- §7 HTTP returns `401` / `403` / `404` / `5xx` (token rejected, route missing, collector failure).
- §8.0 fail-closed precondition skips §8 (any of `GATE2_DATABASE_URL` / `GATE2_WORKSPACE_ID` / `GATE2_SITE_ID` / `GATE2_REQUEST_ID` missing, or `GATE2_REQUEST_ID` could not be extracted from the §7 response in §7.3).
- §8.3 deterministic lookup returns **zero rows** for the bound `GATE2_REQUEST_ID` (the request_id did not reach this DB, did not match the staging boundary, or the binding mismatch needs operator investigation). Zero-row return is BLOCKED, **not FAIL** — per §8.3 the operator resolves the staging environment before retrying. The verdict can only escalate to FAIL when a row IS returned and that row deterministically proves a rejection (per-event reject code, or non-`ok` auth_status).

### 10.4 FAIL criteria

- §7 HTTP returns `400` (e.g. `request_body_invalid_json`, `request_too_large`) or `415` (`content_type_invalid`) with a categorical reject reason. `content_type_invalid` maps to HTTP `415` per backend `src/collector/v1/routes.ts`; `request_body_invalid_json` maps to HTTP `400`.
- §7 returns `200` but `reject_reason_code` is non-null at the per-event stage (e.g. `event_type_invalid`, `schema_version_malformed`, `client_event_id_invalid`, `occurred_at_too_old`).
- §8.3 shows `auth_status != 'ok'` despite §7 returning `200`. (Zero-row return from the §8.3 deterministic lookup is **BLOCKED**, not FAIL — see §10.3, §8.3. FAIL is reserved for cases where the staging request reached the collector and the staging DB row deterministically proves a rejection: per-event reject code captured against the bound `GATE2_REQUEST_ID`, or a non-`ok` auth_status on that exact row.)

In any FAIL state, record the categorical reject reason in §9 and **do not retry against staging** without first amending the fixture or coordinating with Helen. **Do not broaden grants to make a proof pass.** **Do not delete failed canary evidence rows.**

---

## 11. Non-goals / hard boundaries

PR#17x explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No production deploy.** No bundle copy to any production host. No file edit under `/var/www`. No `ssh` / `scp` / `rsync` to production. The Hetzner host's `/var/www/buyerrecon.com/html/thinlayer/*.js` files remain at PR#17u-confirmed hashes.
- **No endpointUrl re-flip.** `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy. No production `mode: 'sprint2_v1_event'` activation. **No endpointUrl re-flip is approved by PR#17x.**
- **No production traffic.** No `curl` against `https://buyerrecon.com/v1/event`, no `curl` against `https://buyerrecon-backend.onrender.com/collect`, no browser visit to buyerrecon.com, no automated browser, no Playwright against production, no synthetic event generator against production. **No production traffic is approved by PR#17x.**
- **No production DB.** No `psql` against `buyerrecon_production`. No SELECT / INSERT / UPDATE / DELETE / TRUNCATE / ALTER / CREATE / DROP / GRANT / REVOKE against any production database. The 26 `ingest_requests` evidence rows from the post-PR#17q canary failure are preserved untouched.
- **No DB grant changes.** PR#17q column-level grants on `buyerrecon_prod_collector_app` remain the runtime steady state. The staging role's grants are exercised as-is; no broadening to "make the proof pass". **Do not broaden grants to make a proof pass.**
- **No Nginx change.** PR#17o's `location = /v1/event` route + root-only token snippet remain as deployed. No `nginx -t`, no `systemctl reload nginx`.
- **No systemctl action.** `buyerrecon-production-collector.service` remains `active` on `PORT=3073`.
- **No DNS change.**
- **No Track A.** Track A remains gated under PR#17e (or successor) — not invoked here.
- **No Playwright.** No headless / programmatic browser run.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated. **Staging acceptance is not customer-facing output.**
- **No Lane A/B writer.** PR#17x does not enable any Lane A/B writer. The production Lane A/B `0`-row posture from PR#17g / PR#17q grant safety is carried forward without being re-queried here. Staging Lane A/B counts (if `GATE2_DATABASE_URL` is provided and the §8.5 query runs) are recorded as observed and are not modified by PR#17x.
- **No AMS Trust Core exposure.**
- **No Pass 1 / Pass 2 implementation.**
- **No backend or AMS source change in this PR.** PR#17x is the staging dry-run artefact only; the implementation already landed in AMS PR#17v + website PR#17w.
- **No evidence-row deletion.** The 26 production `ingest_requests` rows are preserved.
- **No secrets in any artefact.** No raw token, token prefix / suffix, token hash, pepper, DSN, password, certificate / private-key material, private IP, or raw customer data appears anywhere in this doc, in `/tmp/pr17x-*` files (which are scrubbed by the runbook), in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17x.

---

## 12. Required next gates

Each step remains separately gated by its own explicit Helen GO. PR#17x does not pre-authorise any of them.

1. **Gate 3 — Runtime privilege simulation** (`docs/ops/cutover-hard-gates.md` §5). Exercise the staging collector's actual SQL path under a disposable / staging DB role whose grants mirror `buyerrecon_prod_collector_app`'s PR#17q steady-state matrix exactly. Confirm no `storage_failure`, no `permission denied`, no grant broadening. Requires its own Helen GO.
2. **Gate 4 PR B** — bundle deploy from buyerrecon-website's `thinlayer/` to production host `/var/www/buyerrecon.com/html/thinlayer/`, with `endpointUrl` still on Render legacy. Requires its own Helen GO.
3. **Gate 4 PR C** — flip `endpointUrl` to `https://buyerrecon.com/v1/event` AND add `mode: 'sprint2_v1_event'` to the production init's `ThinSDK.init({...})` options. Observe one controlled human page-load. Requires its own Helen GO.
4. **Gate 4 PR D** — passive organic observation. `NO_EVENT_YET` is not failure if no event was expected.
5. **Gate 4 PR E** — Track A (only after PR D closes cleanly).
6. **Optional future transport-selection change** — switching `transport: 'beacon'` or adding sendBeacon fallback to FetchTransport. Separate PR with its own Gate 1 / Gate 2 proofs.

The Render legacy collector remains the one-step rollback target throughout.

---

## 13. Open decisions for Helen

PR#17x records the following decisions for Helen's review. None are pre-decided.

1. **Authorise §7 execution.** Provide the `GATE2_COLLECTOR_URL` and `GATE2_SITE_WRITE_TOKEN` env vars in a Claude Code session that has approved staging access, OR delegate execution to a human operator who runs §6 → §7 → §8 from a staging shell.
2. **Authorise §8.** Provide `GATE2_DATABASE_URL` if pre/post-count + auth-status verification is desired. If not provided, §7's HTTP outcome carries the verdict alone.
3. **Confirm staging URL shape.** Helen confirms the staging endpoint is something like `https://collector-staging.buyerrecon.com/v1/event` or a localhost / 127.0.0.1 instance. If the staging URL does not contain a clearly-staging marker, §6.3 stops; Helen may amend the runbook to accept a known non-staging non-production host explicitly.
4. **Confirm staging boundary identifiers.** If `GATE2_WORKSPACE_ID` / `GATE2_SITE_ID` are useful for §8 verification, Helen confirms the expected values.
5. **Optional fixture script.** PR#17x is published as docs-only. If a TypeScript / Node.js fixture script (e.g. `scripts/gate2-thinsdk-sprint2-fixture.ts`) would be useful for repeatability, it can be added in an amendment under its own Codex review and explicit Helen GO. The script would implement the §6–§8 logic with the same fail-closed preconditions; it would not change the docs content materially.
6. **Codex review path under BLOCKED.** Codex can review the runbook as-is for boundary correctness and required-language coverage. The PASS / FAIL verdict is operator-determined post-execution.

---

## 14. Appendix: redacted commands and outputs

### 14.1 Commands run by Claude Code in this session

| Command | Purpose | Reached production? |
|---|---|---|
| `cd /Users/admin/github/buyerrecon-backend && git fetch origin` | Sync backend base | No — origin is GitHub, not production |
| `git checkout sprint2-architecture-contracts-d4cc2bf && git pull --ff-only` | Fast-forward base | No |
| `git checkout -b buyerrecon-sprint2-pr17x-gate2-controlled-fixture-dry-run sprint2-architecture-contracts-d4cc2bf` | Create PR branch | No |
| `for v in GATE2_*; do val="${!v}"; if [ -n "$val" ]; then echo "$v: PRESENT"; else echo "$v: MISSING"; fi; done` | Check env var presence (no values printed) | No — local env check only |

**No `curl`, no `psql`, no `nginx`, no `systemctl`, no `ssh`, no `scp`, no `rsync`, no DB connection, no production-host file read or write, no traffic generation, no Playwright, no Track A, no `/var/www` edit was executed by Claude Code at any point.**

### 14.2 Commands the operator runs (per §6–§8)

These are the operator-runbook commands. **They are not run by Claude Code in this session.** Each is documented as a self-contained step in §6 / §7 / §8 above, with token-bearing operations using a temporary header file that is `shred`-ed immediately after the POST.

### 14.3 Closing posture

- **PR#17x is docs-only as of this commit.** Exactly one new file under `docs/`: this runbook.
- **No code change. No `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file. No backend or AMS source change. No buyerrecon-website file.** PR#17v's AMS source and PR#17w's website artefact remain the upstream sources of the Sprint 2 capability; PR#17x consumes them via a staging fixture POST only.
- **No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data** appear anywhere in this doc.
- **Production posture during the BLOCKED state:** unchanged from PR#17w §11.3. `buyerrecon-production-collector.service` `active` on `PORT=3073`; `nginx.service` `active` with PR#17o's `location = /v1/event` route; `buyerrecon.com` ThinLayer `endpointUrl` on Render legacy `https://buyerrecon-backend.onrender.com/collect`; `br-probe-init.js` on Render `apiBase`; production event tables at `ingest_requests=26` / `accepted_events=0` / `rejected_events=0` / `site_write_tokens_used=1` (PR#17u-confirmed evidence preserved); Lane A/B at `0` rows; PR#17g grant safety intact; PR#17q column-level grants intact; staging service untouched; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.

---

## 15. Appendix: safe staging token provisioning runbook (operator-only)

**This appendix is invoked when §9.1.3 records the token-provisioning preflight as BLOCKED.** It defines the manual operator pattern for provisioning **one** staging-only `site_write_tokens` row bound to (`workspace_id = buyerrecon_staging_ws`, `site_id = buyerrecon_com`, `label = pr17x_gate2_fixture`) and handing off the raw token to the Gate 2 execution shell without ever printing it.

**Operator-only.** This runbook is not for Claude Code execution. It is for an authorised operator in a shell that already has staging access (staging `DATABASE_URL` and staging `SITE_WRITE_TOKEN_PEPPER` provisioned by the staging deploy's secret-management process). The procedure performs **one** staging DB insert and writes the raw token to a local-only `chmod 600` file in `/tmp/`.

### 15.1 Fail-closed preconditions (every line must pass before any DB mutation)

The operator runs the §15.2 step-by-step **only if every check below passes**. If any check fails, STOP. Do not mutate the DB. Re-engage Helen.

```bash
# All checks are categorical only. Never echo a value of any of these vars.

# 1. STAGING DB URL must be set and clearly staging — not production.
[ -n "${STAGING_DATABASE_URL}" ] || { echo "FAIL: STAGING_DATABASE_URL missing"; exit 1; }
case "${STAGING_DATABASE_URL}" in
  *buyerrecon_production*|*"_prod"*|*"prod_collector"*) echo "FAIL: DSN appears production-like — STOP"; exit 1;;
  *staging*|*"_test"*|*localhost*|*127.0.0.1*)          : ;;
  *)                                                    echo "FAIL: DSN not clearly staging — STOP"; exit 1;;
esac

# 2. Token pepper must be set under the CANONICAL runtime env-var name
#    `SITE_WRITE_TOKEN_PEPPER`. This is the name the app actually reads at
#    `src/collector/v1/config.ts` (env.SITE_WRITE_TOKEN_PEPPER) and that
#    `src/app.ts` passes through to the v1 router / auth-route path, which
#    calls `hashSiteWriteToken(token, pepper)` at `src/auth/workspace.ts:36`.
#
#    The operator's secret manager may expose a *staging-specific* secret
#    name (e.g. `STAGING_SITE_WRITE_TOKEN_PEPPER`) — if so, the operator
#    MUST first confirm locally that the staging-named secret's value is
#    the exact value the staging collector loads as `SITE_WRITE_TOKEN_PEPPER`,
#    then rename it into the canonical env slot before running this runbook:
#
#        export SITE_WRITE_TOKEN_PEPPER="${STAGING_SITE_WRITE_TOKEN_PEPPER}"
#
#    Do NOT use production's `SITE_WRITE_TOKEN_PEPPER` here.
[ -n "${SITE_WRITE_TOKEN_PEPPER}" ] || { echo "FAIL: SITE_WRITE_TOKEN_PEPPER missing (the canonical runtime env-var name); export it from your staging-pepper secret before continuing"; exit 1; }

# 3. Workspace + site boundary must be exact strings.
WORKSPACE_ID="buyerrecon_staging_ws"
SITE_ID="buyerrecon_com"
LABEL="pr17x_gate2_fixture"

echo "preflight: OK (staging DSN classified, pepper present, boundary fixed)"
```

If any line prints `FAIL`, the operator stops here. **No DB mutation.** **No token generation.**

### 15.2 One-shot provisioning command (all token-bearing operations in-memory, never echoed)

```bash
# Generate the raw token: 32 cryptographically strong bytes, hex-encoded (64-char string).
# The variable RAW_TOKEN is set in-memory only — NEVER echoed, NEVER printed.
RAW_TOKEN=$(openssl rand -hex 32)

# Compute the HMAC-SHA256 hash via the canonical exported function from
# `src/auth/workspace.ts`, invoked inline via the LOCAL tsx binary so neither
# the token nor the pepper crosses argv, and so no package-manager network
# / install behavior runs while secrets are live in env.
#
# Fail-closed precondition: a local `tsx` MUST already be installed (via the
# repo's `npm install`). `npx -y` / `npm exec` / any auto-install path is
# explicitly forbidden here — it would fetch and execute package-manager
# tooling at the same moment the raw token and pepper sit in this process's
# environment, expanding the trust boundary of the secret-bearing step.
[ -x ./node_modules/.bin/tsx ] || { unset RAW_TOKEN; echo "FAIL: local tsx missing; do not use npx auto-install for secret-bearing hashing — run \`npm install\` first, then retry"; exit 1; }

TOKEN_HASH=$(
  RAW_TOKEN="${RAW_TOKEN}" \
  PEPPER="${SITE_WRITE_TOKEN_PEPPER}" \
  ./node_modules/.bin/tsx -e '
    import { hashSiteWriteToken } from "./src/auth/workspace";
    const t = process.env.RAW_TOKEN || "";
    const p = process.env.PEPPER || "";
    if (!t || !p) { process.stderr.write("missing inputs\n"); process.exit(2); }
    process.stdout.write(hashSiteWriteToken(t, p));
  '
)
[ -n "${TOKEN_HASH}" ] || { unset RAW_TOKEN TOKEN_HASH; echo "FAIL: hash not computed"; exit 1; }

# Insert the row into site_write_tokens via psql -v bound variables.
# The raw token is NEVER passed to psql. Only the hash is.
psql "${STAGING_DATABASE_URL}" -tA \
  -v token_hash="${TOKEN_HASH}" \
  -v workspace="${WORKSPACE_ID}" \
  -v site="${SITE_ID}" \
  -v label="${LABEL}" \
  -c "
INSERT INTO public.site_write_tokens (token_hash, workspace_id, site_id, label)
VALUES (:'token_hash', :'workspace', :'site', :'label')
RETURNING token_id;
" >/dev/null
INSERT_RC=$?

# Clear the hash from memory immediately after insert. The hash is not a secret
# in the same way the token is, but no need to keep it around.
unset TOKEN_HASH

if [ "${INSERT_RC}" != "0" ]; then
  unset RAW_TOKEN
  echo "FAIL: insert failed (rc=${INSERT_RC}). No row created."
  exit 1
fi

# Hand off the raw token via a chmod 600 /tmp file — outside git, outside chat,
# outside terminal history. The file's only consumer is the Gate 2 execution
# shell, which sources it once and then shreds it.
EXPORT_FILE=/tmp/pr17x_gate2_token_export.sh
umask 077
printf 'export GATE2_SITE_WRITE_TOKEN=%q\n' "${RAW_TOKEN}" > "${EXPORT_FILE}"
chmod 600 "${EXPORT_FILE}"

# Wipe the in-memory copy.
unset RAW_TOKEN

# Categorical confirmation only — never echo file contents.
echo "token provisioning: COMPLETE"
echo "export file:       ${EXPORT_FILE}"
echo "export file mode:  $(stat -c '%a' "${EXPORT_FILE}" 2>/dev/null || stat -f '%Lp' "${EXPORT_FILE}")"
echo "raw token printed: no"
echo "token_hash printed: no"
echo "pepper printed:    no"
echo "DSN printed:       no"
```

### 15.3 Categorical post-creation verification (read-only, no token data selected)

```bash
psql "${STAGING_DATABASE_URL}" -tA \
  -v workspace="${WORKSPACE_ID}" \
  -v site="${SITE_ID}" \
  -v label="${LABEL}" \
  -c "
SELECT count(*) AS active_token_rows
FROM public.site_write_tokens
WHERE workspace_id = :'workspace'
  AND site_id      = :'site'
  AND label        = :'label'
  AND disabled_at IS NULL;
"
```

Expected output: a single integer `1` (the row just created).

**Do NOT** `SELECT token_hash`. **Do NOT** `SELECT *`. **Do NOT** dump raw payload columns. The only safe column to surface from `site_write_tokens` is `count(*)` and metadata booleans like `(disabled_at IS NULL)`.

### 15.4 Hand-off + Gate 2 execution

The operator opens (or re-uses) a Gate 2 execution shell, sets the other Attempt 2 SETs, sources the export file, and runs §6 → §7 → §8:

```bash
# In the Gate 2 execution shell:
export GATE2_COLLECTOR_URL='<staging collector URL ending in /v1/event>'
export GATE2_WORKSPACE_ID='buyerrecon_staging_ws'
export GATE2_SITE_ID='buyerrecon_com'
# (optionally) export GATE2_DATABASE_URL='<staging DSN, clearly staging>'
source /tmp/pr17x_gate2_token_export.sh   # populates GATE2_SITE_WRITE_TOKEN

# Now §6 → §7 → §8 of this runbook is runnable. Attempt 3 will log to §9.1.4.
```

### 15.5 After Gate 2 — shred the export file

```bash
shred -u /tmp/pr17x_gate2_token_export.sh 2>/dev/null || rm -f /tmp/pr17x_gate2_token_export.sh
unset GATE2_SITE_WRITE_TOKEN
```

The `shred -u` invocation overwrites the file before unlinking it (GNU coreutils); the `rm -f` fallback handles macOS / BSD shells. After this step, the raw token exists only in the operator's shell history if the operator typed it manually — which §15.2 explicitly avoids by using `openssl rand` + `printf '%q'` only.

### 15.6 What §15 explicitly forbids

- **No production DB.** §15.1 fail-closes on production-like DSN patterns.
- **No production token.** The newly-generated token is bound to `buyerrecon_staging_ws` / `buyerrecon_com` on the staging DB only.
- **No production `SITE_WRITE_TOKEN_PEPPER`.** §15.2 reads from the canonical env-var name `SITE_WRITE_TOKEN_PEPPER` (the same name `src/collector/v1/config.ts` reads and `src/app.ts` passes to the v1 auth path). The operator's secret manager may expose the staging value under a staging-specific name (e.g. `STAGING_SITE_WRITE_TOKEN_PEPPER`); if so, the operator MUST rename it into the canonical env slot (`export SITE_WRITE_TOKEN_PEPPER="${STAGING_SITE_WRITE_TOKEN_PEPPER}"`) **only after confirming locally** that the staging-named secret's value is the exact value the staging collector loads as `SITE_WRITE_TOKEN_PEPPER`. The pepper value used must be the staging collector's pepper, never production's. The canonical runtime variable name remains `SITE_WRITE_TOKEN_PEPPER`.
- **No raw token in commits / docs / chat / terminal output.** §15.2 uses `printf '%q'` to write the token to a `chmod 600` file and `unset RAW_TOKEN` immediately after. The final report from §15.2 is categorical only.
- **No `token_hash` printed or committed.** §15.2 captures the hash into a shell var, passes it to `psql -v`, then `unset`s it.
- **No DSN echoed.** All `psql` invocations use `"${STAGING_DATABASE_URL}"` directly without shell-trace.
- **No DB grant change.** §15.2 only INSERTs into `site_write_tokens`. No `GRANT` / `REVOKE`. The operator's staging role must already have INSERT privilege on `site_write_tokens` — if not, this is a Helen-GO precondition before running §15, not an opportunity to broaden grants ad-hoc.
- **No production traffic.** §15 contains no `curl`, no HTTP request, no Render-legacy call.
- **No `/var/www` edit.** §15 is filesystem-local to the operator's shell.
- **No Nginx / systemctl / DNS / Track A / Playwright.** None.
- **No customer-facing output. No Lane A/B writer. No AMS Trust / Pass 1 / Pass 2.**
- **The 26 production `ingest_requests` canary evidence rows remain preserved.** §15 does not touch any production DB.

### 15.7 Why no `scripts/create-site-write-token.ts` is committed in PR#17x

PR#17x is explicitly scoped to docs-only (per §2.2 / §11). Introducing a code-path script for token creation would (a) require its own Codex / Helen review for the secret-handling pattern, (b) require its own test coverage in `tests/`, (c) belong in a separate PR with that scope. The §15.2 / §15.3 inline pattern uses the **already-checked-in primitive** `hashSiteWriteToken` from `src/auth/workspace.ts:36` (PR#4 / Sprint 1) via the **locally-installed** `./node_modules/.bin/tsx` binary (gated by an `[ -x ./node_modules/.bin/tsx ]` fail-closed check), which is a one-shot evaluation that does not commit any new code path to the repo and does not invoke any package-manager network / auto-install path while secrets are in env. `npx -y` / `npm exec` / any auto-install pattern is explicitly forbidden in §15.2 — if local `tsx` is not installed, the operator runs `npm install` *before* secrets enter the shell, then retries §15.2. If a hardened, reviewed token-creation script is desired for future re-use, that is a separate PR (proposed e.g. `scripts/create-staging-site-write-token.ts` with its own tests and Codex review); for this PR the inline pattern is the boundary.

---

End of PR#17x. **Verdict: PASS — Gate 2 controlled fixture acceptance only. Attempt 3 satisfied §10.1; no production deploy, endpointUrl re-flip, Gate 3, Gate 4, Track A, Playwright, customer-facing output, Lane A/B writer, AMS Trust, Pass 1, or Pass 2 is approved by this proof.**
