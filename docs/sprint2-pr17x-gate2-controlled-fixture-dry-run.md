# BuyerRecon Sprint 2 PR#17x — Gate 2 Controlled Fixture Dry-Run (Staging-Only)

Status: **docs-only operator runbook. Verdict: BLOCKED — awaiting staging operator inputs.**

PR#17x is the Gate 2 step under `docs/ops/cutover-hard-gates.md`: a controlled non-customer fixture dry-run against a **staging** Sprint 2 collector, using the artefact contract established by AMS PR#17v (merged) and the website-side artefact update from PR#17w (merged). It proves — under non-production conditions only — that:

1. The fetch-equivalent Sprint 2 body shape produced by the PR#17v mapper (replicated here as a `curl --data-binary` POST, not an actual `FetchTransport` execution) is accepted by the staging Sprint 2 `/v1/event` parser through staging token auth and — if a staging DB is available — staging DB write/read verification. Whether the staging endpoint sits behind Nginx is operator-confirmable; PR#17x does not assert that hop unless §7.3 / §8.3 confirm it.
2. The staging collector's runtime DB role (mirroring the PR#17q grant matrix) can execute the actual SQL path without `permission denied` or `storage_failure`.
3. No production endpoint is contacted, no production token is used, no production DB is touched, no `/var/www` file is edited.

PR#17x is currently **BLOCKED** because no `GATE2_*` staging environment variables are configured in this Claude Code session. The runbook is published as a docs-only artefact with **fully filled-in pre-flight preconditions, fixture body, staging POST plan, and verification queries**, ready for an operator to execute under explicit Helen GO once staging credentials are available.

> **Gate 2 fixture acceptance is not production deploy.**
> **EndpointUrl update is not event-capture proof.**
> **No endpointUrl re-flip is approved by PR#17x.**
> **No production traffic is approved by PR#17x.**
> **Do not delete failed canary evidence rows.**
> **Do not broaden grants to make a proof pass.**
> **Route readiness is not end-to-end readiness.**
> **Staging acceptance is not customer-facing output.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `de1a148` — "Sprint 2 PR#17u: record host ThinLayer hash proof (#26)").

PR branch: `buyerrecon-sprint2-pr17x-gate2-controlled-fixture-dry-run`

---

## 1. Status / verdict

**BLOCKED — awaiting staging operator inputs.**

This Claude Code session has **no `GATE2_*` environment variables set**. Per Helen's GO and the task brief's hard-stop lines, PR#17x must not invent a result, must not hit production, must not use production token/endpoint/DB, and must not deploy. The doc is therefore published as a runbook that will transition to one of the four approved verdict states (`PASS` / `PASS WITH NON-BLOCKING NOTES` / `BLOCKED` / `FAIL`) once a staging-environment operator executes it under explicit Helen GO.

The transition criteria are recorded in §10 below.

### What is in scope of this BLOCKED state

- Docs-only runbook with §1–§14 fully populated.
- Fixture body shape categorically defined in §5 (byte-shape-equivalent to AMS PR#17v mapper output).
- Fail-closed preconditions enumerated in §4 / §6.
- Staging POST plan in §7.
- Staging DB verification plan in §8.
- No script committed in this PR; if a fixture script is later useful, it will be added in an amendment under its own Codex review and explicit Helen GO. Until then, the §7 and §8 commands are intended for operator execution from a shell where the staging env vars resolve.

### What is NOT in scope of this BLOCKED state

- No staging POST has been issued.
- No staging DB query has been run.
- No production action of any kind.
- No bundle deploy to any host.
- No endpointUrl re-flip anywhere.
- No `mode: 'sprint2_v1_event'` activation in any production init.
- The 26 `ingest_requests` evidence rows from the post-PR#17q canary remain preserved.
- PR#17q column-level grants stand untouched.

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
# Expected: buyerrecon-sprint2-pr17x-gate2-controlled-fixture-dry-run

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

End of PR#17x. **Verdict: BLOCKED — awaiting staging operator inputs. Runbook §6–§8 is ready for execution under explicit Helen GO with staging `GATE2_COLLECTOR_URL` and `GATE2_SITE_WRITE_TOKEN` (and optionally `GATE2_DATABASE_URL`). Once executed, the verdict transitions per §10.**
