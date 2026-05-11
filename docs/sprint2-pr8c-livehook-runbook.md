# Sprint 1 PR#8c-LiveHook — buyerrecon.com RECORD_ONLY live-hook operator runbook

> **Hard-rule disclaimer.** This is an **operator runbook only**. It contains
> no real secrets, no real database URLs, no raw tokens. Every concrete value
> the operator must supply appears as `<ANGLE_BRACKET_PLACEHOLDER>` and is
> intended to be substituted at runtime on the operator's host.
>
> Track B evidence-write path only. NOT Track A. NOT Core AMS. No scoring,
> no bot logic, no AI-agent logic, no `risk_score` / `classification` /
> `recommended_action` / `bot_score` / `agent_score` / `is_bot` / `is_agent` /
> `ai_agent` work. No bad-traffic tests. No live ads. No `STRESS_PARALLEL`
> 50-way concurrency. No dashboard / admin / debug API. No deploy unless
> explicitly approved.
>
> **Real page views remain disabled** until every check in §8 (Stop gate)
> passes and Helen explicitly says "open page views".

## 0. What this runbook does (and does NOT do)

| Goal | In scope here |
|---|---|
| Insert one `site_write_tokens` row for buyerrecon.com in **staging or production** (Helen's choice) | ✅ |
| Generate a raw site-write token locally on Helen's host **without writing it to this repo** | ✅ |
| Store the raw token only in the chosen secret manager / environment variable | ✅ |
| Wire the buyerrecon.com SDK to POST **one synthetic event** in RECORD_ONLY mode | ✅ |
| Verify the DB evidence trail end-to-end (ingest + accepted + reconciliation + last_used_at) | ✅ |
| Provide a kill switch that disables the token immediately | ✅ |
| Open **real** buyerrecon.com page views | ❌ — explicitly gated by §8 |
| Deploy the backend | ❌ — separate Helen approval |
| Run real-traffic experiments / Track A / scoring | ❌ — separate program |
| Touch this repo's app code | ❌ — doc-only |

## 1. Required staging/prod inputs (Helen must supply before running anything below)

The operator (Helen or a delegate) supplies these values **on the host that
will run the commands** — never paste them into this repo, never commit them,
never echo them into a chat that's logged.

| Symbol | Meaning | Where it lives | Example shape (NOT a real value) |
|---|---|---|---|
| `<TARGET_ENV>` | `staging` or `production` | Helen's typed choice | `staging` |
| `<TARGET_DATABASE_URL>` | Postgres connection string for the target collector DB | secret manager / shell env on operator host | `postgresql://<USER>:<PW>@<HOST>:5432/<DB>?sslmode=require` |
| `<TARGET_BACKEND_URL>` | Reachable base URL of the deployed buyerrecon-backend | DNS / hosting console | `https://<staging-backend-host>` |
| `<TARGET_SECRET_MANAGER>` | Where the raw site-write token + peppers live | one of: Fly secrets, 1Password, AWS Secrets Manager, GCP Secret Manager, Doppler, etc. | `fly secrets` |
| `<SITE_WRITE_TOKEN_PEPPER>` | 32-byte hex HMAC pepper, already set on the target backend | secret manager → backend env | `<64 hex chars>` |
| `<IP_HASH_PEPPER>` | 32-byte hex HMAC pepper, already set on the target backend | secret manager → backend env | `<64 hex chars>` |
| `<WORKSPACE_ID>` | Workspace boundary for the live hook | Helen's choice | `buyerrecon_live_ws` (recommended) |
| `<SITE_ID>` | The site identifier | constant | `buyerrecon_com` |
| `<TOKEN_LABEL>` | Human-readable label on the token row | constant for this runbook | `buyerrecon.com RECORD_ONLY live hook` |
| `<TOKEN_ID>` | Fresh UUID for the new `site_write_tokens` row | generated below (§3) | a UUIDv4 |
| `<BR_COLLECTOR_ENDPOINT>` | Full `/v1/event` URL | `<TARGET_BACKEND_URL>/v1/event` | — |
| `<RAW_TOKEN>` | The site-write bearer token | generated below (§3); **never written to repo, DB, logs, chat, or docs** | (held only in secret manager) |
| `<TOKEN_HASH>` | HMAC-SHA256(`<RAW_TOKEN>`, `<SITE_WRITE_TOKEN_PEPPER>`) | inserted into DB; printed once during generation | 64 hex chars |

Helen confirms before proceeding:

- [ ] `<TARGET_ENV>` chosen (`staging` is the default; `production` requires explicit ack).
- [ ] `<TARGET_DATABASE_URL>` reachable from the operator host with `psql`.
- [ ] `<TARGET_BACKEND_URL>` deployed, `/health` returns `{ status: 'ok', ... }`.
- [ ] `<SITE_WRITE_TOKEN_PEPPER>` and `<IP_HASH_PEPPER>` already set on the
      target backend env (same pepper must be used to hash the token below).
- [ ] `<TARGET_SECRET_MANAGER>` chosen.
- [ ] The buyerrecon.com frontend / SDK location is known and editable.

## 2. Pre-flight check on the target DB (read-only)

Before inserting anything, confirm no conflicting row already exists for the
target workspace + site.

```bash
psql "<TARGET_DATABASE_URL>" <<'SQL'
SELECT token_id, workspace_id, site_id, label, disabled_at, last_used_at, created_at
  FROM site_write_tokens
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = 'buyerrecon_com'
 ORDER BY created_at DESC;
SQL
```

Decision matrix:

| Result | Action |
|---|---|
| Zero rows | Proceed to §3. |
| One active row (`disabled_at IS NULL`) | **STOP and ask Helen.** Options: (a) disable the existing row first via §7 then create a new row, or (b) reuse the existing row (recover its raw token from secret manager — do not re-issue). Do not silently overwrite. |
| Multiple active rows | **STOP and ask Helen.** Indicates prior inconsistency; needs explicit cleanup before live-hook proceeds. |
| All rows already disabled | Proceed to §3 (new active row is fine). |

## 3. Generate raw token + hash locally — never echoed into this repo

The operator runs the generator **on their own host**. There are two modes.
**Option B is preferred** because the raw token never reaches the operator's
terminal display. Use Option A only when the chosen secret manager has no
CLI that accepts a piped value on stdin.

> ⚠️ **Universal rules — both modes.**
> - Substitute `<SITE_WRITE_TOKEN_PEPPER>` with the value already set on
>   the target backend. Read it from the secret manager into the local
>   shell env **only for the lifetime of this command**, then `unset` it.
> - Never write the pepper into a file inside this repo.
> - Never redirect this command's output to a file inside this repo.
> - Never paste the output into a chat or ticket that is retained or
>   indexed.
> - The raw token must never appear in: this repo, any committed file, any
>   DB column, any log line, any docs, any chat transcript, any retained
>   file on disk.

### Option B — preferred: direct pipe into secret-manager CLI (no terminal display)

The generator sends the **raw token to stdout** and the **operator-visible
identifiers (token_id, token_hash) to stderr**. A pipe to the secret
manager's CLI consumes stdout without the raw token ever rendering in the
terminal. The operator reads `token_id` + `token_hash` from stderr (or from
the same stream by reading the second-to-last lines) and proceeds to §4.

```bash
# Generator — emits RAW TOKEN on stdout (piped onward), identifiers on stderr.
# Substitute <SITE_WRITE_TOKEN_PEPPER> only for the lifetime of this command.
SITE_WRITE_TOKEN_PEPPER="<SITE_WRITE_TOKEN_PEPPER>" \
node --input-type=module -e '
  import { randomBytes, randomUUID, createHmac } from "crypto";
  const pepper = process.env.SITE_WRITE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    console.error("ERROR: SITE_WRITE_TOKEN_PEPPER missing or too short");
    process.exit(1);
  }
  const rawToken  = randomBytes(32).toString("hex");
  const tokenId   = randomUUID();
  const tokenHash = createHmac("sha256", pepper).update(rawToken).digest("hex");
  // Raw token → stdout (consumed by the pipe; never displayed).
  process.stdout.write(rawToken);
  // Operator-visible identifiers → stderr (safe to display).
  console.error("token_id   =", tokenId);
  console.error("token_hash =", tokenHash);
' 2> >(tee /dev/tty) | <SECRET_MANAGER_PIPE_SINK>
unset SITE_WRITE_TOKEN_PEPPER
```

Substitute `<SECRET_MANAGER_PIPE_SINK>` with whichever CLI the operator
uses. All examples below are **pseudocode placeholders** — the operator
verifies syntax against the current vendor docs and substitutes
`<backend-app>` / `<vault>` etc. for their own deployment.

```bash
# Fly secrets — reads stdin when value is `-`.
fly secrets set BR_SITE_WRITE_TOKEN_LIVE_HOOK=- --app <backend-app>

# 1Password CLI — reads stdin when field value is `-`.
op item create --category=apicredential \
  --title="BR live hook token" --vault="<vault>" credential[password]=-

# AWS Secrets Manager — reads stdin via file:///dev/stdin.
aws secretsmanager create-secret \
  --name br/livehook/site-write-token --secret-string file:///dev/stdin

# GCP Secret Manager — reads stdin via --data-file=-.
gcloud secrets create br-livehook-site-write-token --data-file=-

# Doppler — reads stdin when value is empty / via `doppler secrets set`.
doppler secrets set BR_SITE_WRITE_TOKEN_LIVE_HOOK
```

**After the pipe completes:**

1. Confirm the secret manager reports success (its CLI prints a confirmation
   on its own stderr/stdout — that's fine; only the raw token is sensitive).
2. From the generator's stderr, capture **`token_id`** and **`token_hash`**.
   These two values are NOT secret — `token_hash` is what gets inserted into
   the public DB column, and `token_id` is a public row identifier.
3. Run `unset SITE_WRITE_TOKEN_PEPPER` (the snippet above already includes
   this) and close any history file the shell maintains for the session if
   you typed the pepper inline. Prefer `read -s SITE_WRITE_TOKEN_PEPPER` or
   sourcing from the secret manager so the pepper never enters shell history.

The raw token is now in the secret manager and **nowhere else**. The
operator's terminal never displayed it.

### Option A — fallback: manual private-terminal mode (no secret-manager CLI on host)

Only use this mode when the operator host has no working stdin-capable CLI
for the chosen secret manager. The raw token will be displayed **once** on
the operator's terminal (stderr); the operator must copy it directly into
the secret manager's web UI / paste prompt, then clear scrollback and close
the terminal.

```bash
# Generator — emits identifiers + RAW TOKEN to stderr behind a clear marker.
# Substitute <SITE_WRITE_TOKEN_PEPPER> only for the lifetime of this command.
SITE_WRITE_TOKEN_PEPPER="<SITE_WRITE_TOKEN_PEPPER>" \
node --input-type=module -e '
  import { randomBytes, randomUUID, createHmac } from "crypto";
  const pepper = process.env.SITE_WRITE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    console.error("ERROR: SITE_WRITE_TOKEN_PEPPER missing or too short");
    process.exit(1);
  }
  const rawToken  = randomBytes(32).toString("hex");
  const tokenId   = randomUUID();
  const tokenHash = createHmac("sha256", pepper).update(rawToken).digest("hex");
  // Identifiers — safe to log.
  console.log("token_id   =", tokenId);
  console.log("token_hash =", tokenHash);
  // Raw token — shown ONCE on stderr behind a marker. Operator must copy
  // immediately into the secret manager and then clear scrollback.
  // The script does NOT write to disk.
  console.error("");
  console.error("=== RAW TOKEN — copy now into secret manager, then clear scrollback ===");
  console.error(rawToken);
  console.error("=== END RAW TOKEN ===");
'
unset SITE_WRITE_TOKEN_PEPPER
```

**Mandatory steps immediately after running the Option A generator:**

1. **Copy the raw token** from the marker block in stderr directly into the
   secret manager (e.g. via the vendor's web UI) under a clear name such as
   `BR_SITE_WRITE_TOKEN_LIVE_HOOK`.
2. **Clear the terminal scrollback.** macOS Terminal / iTerm: ⌘K. Linux
   gnome-terminal: Ctrl+Shift+K. Generic POSIX:
   `printf "\033c"` or `reset`. Then close the terminal window.
3. **Wipe shell history for this session** if the pepper or any sensitive
   value was typed inline. Examples:
   - bash/zsh: `history -c && history -w` then close the shell; or start
     the session with `unset HISTFILE` / `HISTFILE=/dev/null` *before*
     typing secrets.
4. **Capture `token_id` and `token_hash`** from stdout — these are NOT
   secret and go into the §4 INSERT.

**Option A invariants — must hold in every Option A run.**

- ✅ The raw token is displayed exactly once on the operator's private
  terminal stderr, then the scrollback is cleared.
- ✅ The raw token is written to the secret manager only.
- ✅ The raw token is **never** written to this repo, the DB, docs, logs,
  retained chat transcripts, terminal recording tools, or any file on disk.
- ✅ The pepper is not echoed and is `unset` immediately after the
  generator returns.
- ✅ `token_id` and `token_hash` are kept (they are public row identifiers,
  not secrets) and copied into the §4 INSERT.

## 4. Insert one site_write_tokens row (live boundary)

Substitute `<TOKEN_ID>` and `<TOKEN_HASH>` from §3. The raw token does NOT
appear in this SQL.

```bash
psql "<TARGET_DATABASE_URL>" <<'SQL'
INSERT INTO site_write_tokens
  (token_id, token_hash, workspace_id, site_id, label,
   created_at, disabled_at, last_used_at)
VALUES
  ('<TOKEN_ID>',
   '<TOKEN_HASH>',
   '<WORKSPACE_ID>',
   'buyerrecon_com',
   'buyerrecon.com RECORD_ONLY live hook',
   NOW(), NULL, NULL);
SQL
```

Verify the insert:

```bash
psql "<TARGET_DATABASE_URL>" <<'SQL'
SELECT token_id, workspace_id, site_id, label, disabled_at, last_used_at
  FROM site_write_tokens
 WHERE token_id = '<TOKEN_ID>';
SQL
```

Expected: exactly one row with `disabled_at = NULL`, `last_used_at = NULL`.

## 5. Backend / SDK env setup (no app-code changes in this repo)

### 5.1 Target backend env (verify, do not re-roll peppers)

On the **target backend** (Fly app / container / pod), the operator confirms
these env vars are already set. If they are NOT set, **STOP** — re-rolling the
pepper invalidates every existing `token_hash` and is out of scope for this
runbook.

| Env var | Required | Value source |
|---|---|---|
| `DATABASE_URL` | yes | secret manager → backend env (points at `<TARGET_DATABASE_URL>`) |
| `SITE_WRITE_TOKEN_PEPPER` | yes — must equal the pepper used in §3 | secret manager → backend env |
| `IP_HASH_PEPPER` | yes | secret manager → backend env |
| `ENABLE_V1_BATCH` | `false` | secret manager → backend env |
| `ALLOW_CONSENT_STATE_SUMMARY` | `false` (unless already explicitly enabled) | secret manager → backend env |
| `COLLECTOR_VERSION` | set | secret manager → backend env |
| `ALLOWED_ORIGINS` | includes `https://buyerrecon.com,https://www.buyerrecon.com` | secret manager → backend env |

Verify backend health:

```bash
curl -fsS "<TARGET_BACKEND_URL>/health"
# Expected: HTTP 200, body {"status":"ok","timestamp":"<ISO timestamp>"}
```

### 5.2 buyerrecon.com frontend / SDK env (synthetic-only)

The buyerrecon.com page source is **not in this repo** (`buyerrecon-backend`
is the collector only). The frontend / static-site repo or hosting console
exposes the following knobs. Configure them in the static site's env / build
config — never in `buyerrecon-backend`.

| Var | Value | Purpose |
|---|---|---|
| `BR_COLLECTOR_ENDPOINT` | `<TARGET_BACKEND_URL>/v1/event` | where the SDK POSTs |
| `BR_SITE_WRITE_TOKEN` | the raw token from secret manager (§3) | bearer credential |
| `BR_SITE_ID` | `buyerrecon_com` | site identifier (server overrides anyway) |
| `BR_RECORD_ONLY` | `true` | semantic flag — RECORD_ONLY mode |
| `BR_SYNTHETIC_ONLY` | `true` | **synthetic-only mode** — emit ONLY when manually invoked |

Reminders for the frontend SDK wrapper:

- **No automatic page-load emission.** The SDK fires `POST /v1/event` ONLY
  when manually triggered (e.g. by clicking a hidden dev button or via a
  console call). Real page views remain dark until §8 passes.
- **No PII collection.** The payload contains only the v1 schema fields
  listed in §6.
- **No third-party calls.** The SDK posts to `<BR_COLLECTOR_ENDPOINT>` and
  nothing else.
- **No retry loop.** A single synthetic POST per manual trigger.
- **No raw token in client-side bundle.** If the frontend is fully static,
  the token must be injected at build/deploy time from the secret manager,
  not committed to the repo. If exposing the token to the browser is
  unacceptable, the SDK should POST to a same-origin server route that
  proxies the call and attaches the bearer server-side. (Decision for
  Helen — out of scope for this runbook.)

### 5.3 Synthetic-only payload shape

The SDK builds **exactly** this shape for the single synthetic event:

```json
{
  "client_event_id": "<crypto.randomUUID() at trigger time>",
  "event_name": "page_view",
  "event_type": "page",
  "event_origin": "browser",
  "schema_key": "br.page",
  "schema_version": "1.0.0",
  "occurred_at": "<ISO timestamp at trigger time>",
  "session_id": "br_live_synthetic_session_001",
  "anonymous_id": "br_live_synthetic_anon_001",
  "page_url": "https://buyerrecon.com/",
  "page_path": "/",
  "consent_state": "granted",
  "consent_source": "record_only_synthetic",
  "tracking_mode": "full",
  "storage_mechanism": "cookie"
}
```

Notes:

- **`client_event_id` MUST be a fresh UUIDv4.** Do not use the all-same-digit
  patterns (`33333333-…`, `66666666-…`) — they trigger PII payment-card
  detection. The smoke proved a `randomUUID()` value works cleanly.
- `event_origin = browser` is the correct enum for a real browser-emitted
  event. The collector pins `traffic_class = unknown` for Sprint 1.
- `consent_source = record_only_synthetic` makes the synthetic-only intent
  legible in the stored row.

## 6. Send one synthetic event

The simplest way to send the synthetic event from a console / curl — the
operator runs this **once** with substitutions:

```bash
# Pull RAW_TOKEN from the secret manager into this process's env only.
# Example using Fly secrets (pseudocode — substitute for chosen tool):
#   export RAW_TOKEN="$(fly ssh console --app <backend-app> -C 'cat /run/secrets/BR_SITE_WRITE_TOKEN_LIVE_HOOK')"
# Or, on the operator host, read from the secret manager directly.
# DO NOT paste the raw token into this shell command literally — substitute
# via env so it never appears in shell history.

CLIENT_EVENT_ID="$(uuidgen)"
OCCURRED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"

curl -sS -X POST "<BR_COLLECTOR_ENDPOINT>" \
  -H "content-type: application/json" \
  -H "authorization: Bearer ${RAW_TOKEN}" \
  --data @- <<JSON
{
  "client_event_id": "${CLIENT_EVENT_ID}",
  "event_name": "page_view",
  "event_type": "page",
  "event_origin": "browser",
  "schema_key": "br.page",
  "schema_version": "1.0.0",
  "occurred_at": "${OCCURRED_AT}",
  "session_id": "br_live_synthetic_session_001",
  "anonymous_id": "br_live_synthetic_anon_001",
  "page_url": "https://buyerrecon.com/",
  "page_path": "/",
  "consent_state": "granted",
  "consent_source": "record_only_synthetic",
  "tracking_mode": "full",
  "storage_mechanism": "cookie"
}
JSON

# Immediately:
unset RAW_TOKEN
```

**Expected response:**

- HTTP `200`
- JSON body with:
  - `expected_event_count: 1`
  - `accepted_count: 1`
  - `rejected_count: 0`
  - `results: [{ "status": "accepted", "client_event_id": "<CLIENT_EVENT_ID>", "reason_code": null }]`
  - `request_id: <UUID>` — **save this for §7 verification.**

**If HTTP is not 200:**

1. **DO NOT retry repeatedly.**
2. **DO NOT enable real page views.**
3. Capture only: HTTP status, response `request_id`, response `error` /
   `reason_code`. Never log the raw token.
4. Common failure modes:
   - `401` `auth_invalid` → token hash in DB does not match HMAC(raw, pepper). Re-check that `<SITE_WRITE_TOKEN_PEPPER>` on the backend equals the value used in §3.
   - `403` `auth_site_disabled` → the token row was disabled. Check `site_write_tokens.disabled_at`.
   - `415` `content_type_invalid` → curl did not send `content-type: application/json`.
   - `400` `request_body_invalid_json` → JSON was malformed.
   - `500` `collector_misconfigured` → backend missing `IP_HASH_PEPPER` or upstream IP unresolved.
   - `500` `storage_failure` → DB write failed; consult backend logs.

## 7. DB verification SQL (read-only)

Substitute `<TOKEN_ID>`, `<WORKSPACE_ID>`, and `<REQUEST_ID>` from §6's
response. None of these reveal the raw token.

### 7.1 ingest_requests

```sql
SELECT request_id, workspace_id, site_id, endpoint, http_status,
       auth_status, reject_reason_code, expected_event_count,
       accepted_count, rejected_count, reconciled_at,
       request_body_sha256, LENGTH(request_body_sha256) AS sha_len
  FROM ingest_requests
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = 'buyerrecon_com'
 ORDER BY received_at DESC
 LIMIT 5;
```

Expected latest row:

- `endpoint = '/v1/event'`
- `http_status = 200`
- `auth_status = 'ok'`
- `reject_reason_code = NULL`
- `expected_event_count = 1`
- `accepted_count = 1`
- `rejected_count = 0`
- `reconciled_at IS NOT NULL`
- `sha_len = 64`

### 7.2 accepted_events

```sql
SELECT event_id, request_id, workspace_id, site_id, client_event_id,
       event_type, schema_key, schema_version, event_origin,
       traffic_class, payload_sha256, LENGTH(payload_sha256) AS sha_len,
       canonical_jsonb IS NULL                              AS canonical_missing,
       jsonb_typeof(canonical_jsonb)                        AS canonical_type,
       (SELECT COUNT(*)::int FROM jsonb_object_keys(canonical_jsonb)) AS canonical_key_count,
       debug_mode
  FROM accepted_events
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = 'buyerrecon_com'
 ORDER BY received_at DESC
 LIMIT 5;
```

Expected latest row:

- `client_event_id` matches the value sent in §6
- `payload_sha256` `sha_len = 64`
- `canonical_missing = false`, `canonical_type = 'object'`
- `canonical_key_count = 19`
- `debug_mode = false`
- `traffic_class = 'unknown'`

### 7.3 rejected_events (for that request_id)

```sql
SELECT COUNT(*)::int AS rejected_count
  FROM rejected_events
 WHERE request_id = '<REQUEST_ID>';
```

Expected: `rejected_count = 0`.

### 7.4 Reconciliation invariant

```sql
SELECT COUNT(*)::int AS violations
  FROM ingest_requests
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = 'buyerrecon_com'
   AND reconciled_at IS NOT NULL
   AND accepted_count + rejected_count <> expected_event_count;
```

Expected: `violations = 0`.

### 7.5 Row-count join skew

```sql
SELECT COUNT(*)::int AS skew
  FROM (
    SELECT ir.request_id
      FROM ingest_requests ir
      LEFT JOIN (
        SELECT request_id, COUNT(*)::int AS cnt
          FROM accepted_events
         WHERE workspace_id = '<WORKSPACE_ID>'
         GROUP BY request_id
      ) a ON a.request_id = ir.request_id
      LEFT JOIN (
        SELECT request_id, COUNT(*)::int AS cnt
          FROM rejected_events
         WHERE workspace_id = '<WORKSPACE_ID>'
         GROUP BY request_id
      ) r ON r.request_id = ir.request_id
     WHERE ir.workspace_id = '<WORKSPACE_ID>'
       AND ir.site_id      = 'buyerrecon_com'
       AND (ir.accepted_count <> COALESCE(a.cnt, 0)
            OR ir.rejected_count <> COALESCE(r.cnt, 0))
  ) sk;
```

Expected: `skew = 0`.

### 7.6 last_used_at

```sql
SELECT token_id, workspace_id, site_id, disabled_at, last_used_at
  FROM site_write_tokens
 WHERE token_id = '<TOKEN_ID>';
```

Expected:

- `disabled_at IS NULL`
- `last_used_at IS NOT NULL` (set by the best-effort touch after the §6
  request — may take up to a few hundred ms to appear; re-run if null)

## 8. Stop gate before opening real page views

Real `buyerrecon.com` page-view emission stays disabled until **every** box
below is ticked. If any check fails, **stop, fix, and re-run §6 + §7**. Do
not flip on real page views to debug.

- [ ] `<TARGET_ENV>` confirmed by Helen.
- [ ] `<TARGET_DATABASE_URL>` and `<TARGET_BACKEND_URL>` set on the operator
      host; `/health` returns 200.
- [ ] `<SITE_WRITE_TOKEN_PEPPER>` and `<IP_HASH_PEPPER>` confirmed already
      set on the target backend; no pepper re-roll happened during this
      runbook.
- [ ] `site_write_tokens` row for `<TOKEN_ID>` exists with `disabled_at IS
      NULL`; raw token lives only in `<TARGET_SECRET_MANAGER>`.
- [ ] §6 synthetic event returned HTTP 200 with the expected JSON body.
- [ ] §7.1 ingest row matches every expected value.
- [ ] §7.2 accepted row matches every expected value (including
      `canonical_key_count = 19`).
- [ ] §7.3 rejected count = 0.
- [ ] §7.4 reconciliation violations = 0.
- [ ] §7.5 row-count join skew = 0.
- [ ] §7.6 `last_used_at` is non-null and `disabled_at` is null.
- [ ] No raw token has been committed, logged, written to the repo, or
      printed in any artefact retained beyond the operator's local
      scrollback.
- [ ] Backend logs since the synthetic event contain no `storage_failure` /
      `auth_lookup_failure` / `collector_misconfigured` entries.
- [ ] Helen has explicitly typed "open page views" with reference to
      `<TOKEN_ID>` and `<WORKSPACE_ID>`.

Only after **all** boxes are ticked may the frontend SDK be re-configured to
emit on real page loads (`BR_SYNTHETIC_ONLY=false`). That is a separate
PR / change, not part of this runbook.

## 9. Kill switch

Use this SQL to disable the live token immediately. After running, every
subsequent `/v1/event` request with that bearer is handled as a normal
request-level auth rejection:

- HTTP status is **`403`**.
- The orchestrator emits `auth_status = 'site_disabled'` and
  `reject_reason_code = 'auth_site_disabled'` on the persisted
  `ingest_requests` row.
- The HTTP response body is the **normal orchestrator response shape** for a
  site-disabled rejection (per PR#5c-2 `buildAuthRejectOutput`):

  ```json
  {
    "request_id": "<UUID>",
    "expected_event_count": 0,
    "accepted_count": 0,
    "rejected_count": 0,
    "results": []
  }
  ```

  It is **NOT** `{ "error": "auth_site_disabled" }` and it is **NOT**
  `{ "error": "auth_lookup_failure" }`.
- **`auth_lookup_failure` is a separate code reserved for DB lookup
  failure** (i.e. the route's `try/catch` around `resolveAuthForRunRequest`
  in `src/collector/v1/routes.ts`). A disabled token does NOT trigger that
  path — the lookup itself succeeds and simply returns a row with
  `disabled_at IS NOT NULL`.
- Each such request writes **exactly one `ingest_requests` row** (with
  `auth_status = 'site_disabled'`, `reject_reason_code =
  'auth_site_disabled'`, `http_status = 403`, `expected_event_count = 0`,
  `accepted_count = 0`, `rejected_count = 0`, `reconciled_at` set to
  `received_at`). It writes **no `accepted_events` rows and no
  `rejected_events` rows** — the rejection happens at the auth gate before
  per-event work begins, per the locked PR#5c-2 request-level reject
  semantics.

```sql
UPDATE site_write_tokens
   SET disabled_at = NOW()
 WHERE token_id = '<TOKEN_ID>';
```

To re-enable later (with explicit Helen ack):

```sql
UPDATE site_write_tokens
   SET disabled_at = NULL
 WHERE token_id = '<TOKEN_ID>';
```

To **permanently retire** the token (rotation; out of scope here but
documented for completeness):

```sql
-- 1. Disable the old token.
UPDATE site_write_tokens SET disabled_at = NOW() WHERE token_id = '<OLD_TOKEN_ID>';
-- 2. Generate a new raw token + hash per §3.
-- 3. Insert a new row per §4 with a fresh <NEW_TOKEN_ID>.
-- 4. Update the secret manager with the new raw token.
-- 5. Delete the old raw token from the secret manager.
-- 6. Verify the new token via §6 + §7.
```

## 10. What this runbook does NOT touch

- ✅ No app code changes in `buyerrecon-backend` (this doc is the only
  artefact added).
- ✅ No schema changes, no migrations.
- ✅ No `src/collector/v1/index.ts` barrel change.
- ✅ No PR#5 helper / orchestrator / row-builders / PII / validation /
  consent / dedupe / canonical / payload-hash / stable-json /
  normalised-envelope / envelope / hash / stage-map / types touched.
- ✅ No Track A imports / no Core AMS imports.
- ✅ No scoring / bot / AI-agent / `risk_score` / `classification` /
  `recommended_action` / `bot_score` / `agent_score` / `is_bot` /
  `is_agent` / `ai_agent` work.
- ✅ No bad-traffic harness.
- ✅ No `STRESS_PARALLEL` / 50-way concurrency.
- ✅ No dashboard / admin / debug API.
- ✅ No deploy (deploy is a separate Helen-approved step).
- ✅ No real page views opened. No live SDK on auto-emit.
- ✅ No raw token / pepper / `DATABASE_URL` literal in this doc.

## 11. Operator checklist (one screen)

```
□ Helen chose <TARGET_ENV>: staging | production
□ <TARGET_DATABASE_URL> reachable from operator host (psql opens)
□ <TARGET_BACKEND_URL>/health returns 200
□ <SITE_WRITE_TOKEN_PEPPER>, <IP_HASH_PEPPER> set on backend
□ Pre-flight §2: no conflicting existing row (or Helen acked the action)
□ §3 generated <TOKEN_ID> + <TOKEN_HASH>; raw token written to <TARGET_SECRET_MANAGER>; scrollback cleared
□ §4 INSERT site_write_tokens succeeded; one row visible with disabled_at=NULL
□ §5.2 frontend env knobs set: BR_RECORD_ONLY=true, BR_SYNTHETIC_ONLY=true
□ §6 synthetic POST returned HTTP 200; <REQUEST_ID> captured
□ §7.1 ingest_requests latest row matches all expected values
□ §7.2 accepted_events latest row matches all expected values (19 canonical keys)
□ §7.3 rejected_events for <REQUEST_ID> = 0
□ §7.4 reconciliation violations = 0
□ §7.5 row-count join skew = 0
□ §7.6 last_used_at non-null, disabled_at null
□ Backend logs: no storage_failure / auth_lookup_failure / collector_misconfigured
□ Helen explicit "open page views" — pending
```

When all boxes are ticked AND Helen acks: a separate change re-configures
the buyerrecon.com SDK to `BR_SYNTHETIC_ONLY=false` (real page views). That
change is **NOT** in this runbook.
