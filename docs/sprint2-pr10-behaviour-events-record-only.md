# Sprint 1 PR#10 — RECORD_ONLY behaviour events (`cta_click`, `form_start`, `form_submit`)

> **Hard-rule disclaimer.** Track B evidence-write only. RECORD_ONLY. NOT
> AMS scoring. NOT the AMS shared core. NOT a product adapter. NO score
> tables, NO session_scores, NO confidence_band, NO `risk_score` /
> `classification` / `recommended_action` / `bot_score` / `agent_score` /
> `is_bot` / `is_agent` / `ai_agent`. NO Track A. NO Core AMS. NO dashboard.
> NO production DB. NO production auto page-view collection. NO production
> auto behaviour collection. NO PII / no form field values / no email /
> phone / name / address / message body / free-text values. No commit, no
> push, no deploy unless Helen explicitly approves.

## 1. What PR#10 ships

PR#10 expands the v1 collector's accepted event coverage from `page_view`
only to three additional behaviour events, **without changing any
collector runtime code**. The existing validator / orchestrator /
row-builders / canonical projection are already event-name agnostic, so
PR#10 is purely additive tests + docs + a small read-only observation
report extension:

| Path | Status | Purpose |
|---|---|---|
| `tests/v1/behaviour-events-pr10.test.ts` | **new** | 26 tests covering validation, orchestrator end-to-end, row-builder raw-preservation, canonical 19-key invariance, PII negatives, HTTP route via createApp, payload_sha256 vs canonical-hash distinctness — all three new events. |
| `scripts/collector-observation-report.ts` | **modified** | Adds `loadEventTypeBreakdown` + renders a new "7b. Event type breakdown" section grouping by (`raw->>'event_name'`, `event_type`, `schema_key`). Grouped counts only — no per-event raw payload values rendered. |
| `docs/sprint2-pr9-collector-observation-report.md` | **modified** | Documents the new §7b. |
| `docs/sprint2-pr10-behaviour-events-record-only.md` | **new** | This doc. |

**Runtime collector source files NOT touched:** `src/collector/v1/{orchestrator,row-builders,routes,persistence,config,http-context,auth-route,index,validation,consent,pii,boundary,dedupe,canonical,payload-hash,stable-json,normalised-envelope,envelope,hash,reason-codes,stage-map,types}.ts`, `src/app.ts`, `src/server.ts`, `src/db/schema.sql`, `migrations/*`, `src/auth/workspace.ts`.

## 2. Why no runtime change is needed

The existing v1 validator (`validateEventCore`) is intentionally event-name
agnostic:

- `event_type` is the only constrained enum. Browser-origin admits
  `{ 'page', 'track' }` per `ALLOWED_TYPES_BY_ORIGIN`.
- `event_name`, `schema_key`, and `schema_version` are validated as
  non-empty strings (semver shape for `schema_version`).
- Everything else (PII gate, canonical projection, row-builders,
  persistence) is shape-driven, not event-name-driven.

The nearest existing browser admit value for `cta_click` / `form_start` /
`form_submit` is **`event_type='track'`** — the standard analytics
convention for user actions. The validator already admits this; PR#10
just exercises it.

## 3. Backend event contract

### 3.1 `cta_click`

| Field | Required | Value |
|---|---|---|
| `client_event_id` | yes | UUIDv4 or v7 |
| `event_name` | yes | `"cta_click"` |
| `event_type` | yes | `"track"` _(nearest admitted enum — see §2)_ |
| `event_origin` | yes | `"browser"` |
| `schema_key` | yes | `"br.cta"` |
| `schema_version` | yes | `"1.0.0"` |
| `occurred_at` | yes | ISO timestamp inside the validator's `(-24h, +5min)` window |
| `session_id` | yes (browser) | non-empty string |
| `anonymous_id` | yes (effective) | non-empty string |
| `page_url`, `page_path` | yes (effective) | strings |
| `consent_state`, `consent_source`, `tracking_mode`, `storage_mechanism` | yes (effective) | per existing PR#5b-2 admit sets |
| **Event-specific (raw JSONB only):** | | |
| `cta_id` | optional | static UI identifier (e.g. `"hero-book-demo"`) |
| `cta_label` | optional | **static UI label only** (e.g. `"Book a demo"`). NEVER user-entered text. |
| `cta_href` | optional | target URL |
| `cta_location` | optional | static section name (e.g. `"hero"`) |
| `cta_text_hash` | optional | 64-char hex hash of a **static UI label only** |
| `element_role` | optional | `"button"` / `"link"` / etc. |

### 3.2 `form_start`

Required base fields as above with `event_name="form_start"`,
`event_type="track"`, `schema_key="br.form"`.

| Event-specific (raw JSONB only) | Notes |
|---|---|
| `form_id` | static form identifier |
| `form_name` | static form name (e.g. `"contact_us"`) |
| `form_location` | section / position (`"footer"`) |
| `form_action_path` | path the form posts to (e.g. `"/contact"`) |
| `form_method` | `"POST"` / `"GET"` |

`form_start` is a focus / first-touch marker. **No field names with personal
semantics** (`email`, `name`, `phone`, `message`). **No field values.** **No
free text.**

### 3.3 `form_submit`

Same base as `form_start` with `event_name="form_submit"`. Adds:

| Event-specific (raw JSONB only) | Allowed values |
|---|---|
| `submit_result` | `"attempted" \| "blocked_client_side" \| "success_visible" \| "unknown"` |

`form_submit` is an event marker only. **No submitted values. No hidden
values. No email / phone / name / address / message body / free text.**

## 4. PII forbidden list (applies to ALL three events)

The PII gate (`src/collector/v1/pii.ts`) already scans the raw event's
string values for:

- `pii_email_detected` — literal email patterns
- `pii_phone_detected` — 13+ digit run that smells like a phone
- `pii_credential_detected` — private keys, AWS AKIA, GitHub tokens, Slack
  bot tokens, Google API keys
- `pii_payment_detected` — Luhn-passing 13-19 digit runs
- `pii_government_id_detected` — US SSN, UK NI patterns

PR#10 tests prove all five kinds still fire on the new event shapes
(`tests/v1/behaviour-events-pr10.test.ts` §5).

**Forbidden in any raw field value, including event-specific fields:**

- Email addresses (`user@example.com`)
- Phone numbers (`+1 415 555 0199`)
- Card numbers (any 13-19 digit run that passes Luhn)
- SSNs / NI numbers
- API keys / private keys
- User-entered free text (form field values, search queries, message
  bodies, addresses, names)

**Allowed in raw field values:**

- Static UI labels (`"Book a demo"`, `"Get started"`)
- Static section IDs (`"hero"`, `"footer"`, `"contact-us"`)
- URL paths the SDK already knows (`"/contact"`)
- HTTP methods (`"POST"`, `"GET"`)

## 5. Example payloads (placeholders only — no real production data)

### 5.1 `cta_click`

```json
{
  "client_event_id": "11111111-1111-4111-8111-111111111111",
  "event_name": "cta_click",
  "event_type": "track",
  "event_origin": "browser",
  "schema_key": "br.cta",
  "schema_version": "1.0.0",
  "occurred_at": "<ISO timestamp, fresh — fixture uses Date.now()-60_000>",
  "session_id": "<sdk session>",
  "anonymous_id": "<sdk anonymous>",
  "page_url": "https://buyerrecon.com/pricing",
  "page_path": "/pricing",
  "consent_state": "granted",
  "consent_source": "cmp",
  "tracking_mode": "full",
  "storage_mechanism": "cookie",
  "cta_id": "hero-book-demo",
  "cta_label": "Book a demo",
  "cta_href": "https://buyerrecon.com/contact",
  "cta_location": "hero",
  "element_role": "button"
}
```

### 5.2 `form_start`

```json
{
  "client_event_id": "22222222-2222-4222-8222-222222222222",
  "event_name": "form_start",
  "event_type": "track",
  "event_origin": "browser",
  "schema_key": "br.form",
  "schema_version": "1.0.0",
  "occurred_at": "<ISO timestamp, fresh>",
  "session_id": "<sdk session>",
  "anonymous_id": "<sdk anonymous>",
  "page_url": "https://buyerrecon.com/contact",
  "page_path": "/contact",
  "consent_state": "granted",
  "consent_source": "cmp",
  "tracking_mode": "full",
  "storage_mechanism": "cookie",
  "form_id": "contact-us",
  "form_name": "contact_us",
  "form_location": "footer",
  "form_action_path": "/contact",
  "form_method": "POST"
}
```

### 5.3 `form_submit`

```json
{
  "client_event_id": "44444444-4444-4444-8444-444444444444",
  "event_name": "form_submit",
  "event_type": "track",
  "event_origin": "browser",
  "schema_key": "br.form",
  "schema_version": "1.0.0",
  "occurred_at": "<ISO timestamp, fresh>",
  "session_id": "<sdk session>",
  "anonymous_id": "<sdk anonymous>",
  "page_url": "https://buyerrecon.com/contact",
  "page_path": "/contact",
  "consent_state": "granted",
  "consent_source": "cmp",
  "tracking_mode": "full",
  "storage_mechanism": "cookie",
  "form_id": "contact-us",
  "form_name": "contact_us",
  "form_location": "footer",
  "form_action_path": "/contact",
  "form_method": "POST",
  "submit_result": "success_visible"
}
```

## 6. curl smoke against `/v1/event` (placeholders only)

The operator runs these on the staging host **once each** to confirm the
backend admits each event. The raw token comes from the live-hook secret
manager per the PR#8c runbook; never echo it inline.

```bash
# Pull RAW_TOKEN from the secret manager into the process env only.
# DO NOT echo the token. DO NOT redirect to a file in this repo.

for SCHEMA in cta form-start form-submit; do
  CLIENT_EVENT_ID="$(uuidgen)"
  OCCURRED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
  case "$SCHEMA" in
    cta)
      BODY="$(cat <<JSON
{"client_event_id":"$CLIENT_EVENT_ID","event_name":"cta_click","event_type":"track","event_origin":"browser","schema_key":"br.cta","schema_version":"1.0.0","occurred_at":"$OCCURRED_AT","session_id":"br_synth_sess","anonymous_id":"br_synth_anon","page_url":"https://buyerrecon.com/pricing","page_path":"/pricing","consent_state":"granted","consent_source":"record_only_synthetic","tracking_mode":"full","storage_mechanism":"cookie","cta_id":"hero-book-demo","cta_label":"Book a demo","cta_href":"https://buyerrecon.com/contact","cta_location":"hero","element_role":"button"}
JSON
)"
      ;;
    form-start)
      BODY="$(cat <<JSON
{"client_event_id":"$CLIENT_EVENT_ID","event_name":"form_start","event_type":"track","event_origin":"browser","schema_key":"br.form","schema_version":"1.0.0","occurred_at":"$OCCURRED_AT","session_id":"br_synth_sess","anonymous_id":"br_synth_anon","page_url":"https://buyerrecon.com/contact","page_path":"/contact","consent_state":"granted","consent_source":"record_only_synthetic","tracking_mode":"full","storage_mechanism":"cookie","form_id":"contact-us","form_name":"contact_us","form_location":"footer","form_action_path":"/contact","form_method":"POST"}
JSON
)"
      ;;
    form-submit)
      BODY="$(cat <<JSON
{"client_event_id":"$CLIENT_EVENT_ID","event_name":"form_submit","event_type":"track","event_origin":"browser","schema_key":"br.form","schema_version":"1.0.0","occurred_at":"$OCCURRED_AT","session_id":"br_synth_sess","anonymous_id":"br_synth_anon","page_url":"https://buyerrecon.com/contact","page_path":"/contact","consent_state":"granted","consent_source":"record_only_synthetic","tracking_mode":"full","storage_mechanism":"cookie","form_id":"contact-us","form_name":"contact_us","form_location":"footer","form_action_path":"/contact","form_method":"POST","submit_result":"success_visible"}
JSON
)"
      ;;
  esac
  curl -sS -X POST "<TARGET_BACKEND_URL>/v1/event" \
    -H "content-type: application/json" \
    -H "authorization: Bearer ${RAW_TOKEN}" \
    --data "$BODY"
done

unset RAW_TOKEN
```

**Expected for each:** HTTP `200`, response body with `accepted_count: 1`,
`rejected_count: 0`, `results: [{ status: "accepted", ... }]`.

## 7. DB verification SQL

Substitute `<WORKSPACE_ID>` and `<SITE_ID>` from the staging meta env.

### 7.1 Per-event-type accepted counts

```sql
SELECT raw->>'event_name'   AS event_name,
       event_type           AS event_type,
       schema_key           AS schema_key,
       COUNT(*)::int        AS accepted_rows,
       MIN(received_at)     AS first_seen,
       MAX(received_at)     AS last_seen
  FROM accepted_events
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
   AND received_at >= NOW() - INTERVAL '24 hours'
 GROUP BY raw->>'event_name', event_type, schema_key
 ORDER BY accepted_rows DESC;
```

Expected after the synthetic smokes in §6: one row per event_name with
`accepted_rows = 1`, all `event_type = 'track'` for the three new events,
`schema_key` `br.cta` for `cta_click` and `br.form` for both form events.

### 7.2 Event-specific raw fields preserved (cta_click sample)

```sql
SELECT event_id,
       raw->>'event_name'    AS event_name,
       raw->>'cta_id'        AS cta_id,
       raw->>'cta_label'     AS cta_label,
       raw->>'cta_location'  AS cta_location,
       raw->>'element_role'  AS element_role
  FROM accepted_events
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
   AND raw->>'event_name' = 'cta_click'
 ORDER BY received_at DESC
 LIMIT 5;
```

### 7.3 Canonical projection stays 19 keys (regardless of event_name)

```sql
SELECT event_id,
       raw->>'event_name'                                                   AS event_name,
       (SELECT COUNT(*)::int FROM jsonb_object_keys(canonical_jsonb))       AS canonical_key_count
  FROM accepted_events
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
   AND received_at >= NOW() - INTERVAL '24 hours'
 ORDER BY received_at DESC
 LIMIT 20;
```

Expected: every row reports `canonical_key_count = 19`.

### 7.4 Reconciliation invariant — still holds across all event types

```sql
SELECT COUNT(*)::int AS violations
  FROM ingest_requests
 WHERE workspace_id = '<WORKSPACE_ID>'
   AND site_id      = '<SITE_ID>'
   AND received_at >= NOW() - INTERVAL '24 hours'
   AND reconciled_at IS NOT NULL
   AND accepted_count + rejected_count <> expected_event_count;
```

Expected: `violations = 0`.

## 8. PR#9 observation report — new event_name breakdown

After landing PR#10 + sending the three synthetic events to staging, run:

```bash
cd /opt/buyerrecon-backend
set -a
source .env
source /root/buyerrecon_staging_site_token_meta.env
set +a
npm run observe:collector
```

The report now contains section **7b. Event type breakdown** with grouped
counts by `(event_name, event_type, schema_key)`. After the three synthetic
events you should see four rows (counting the existing `page_view` row),
all with `event_type='page'` or `event_type='track'`. The §10 status should
remain `PASS` if the reconciliation/canonical/sha invariants hold.

## 9. Stop gate before any real production auto behaviour collection

Real production auto behaviour collection (auto-firing of `cta_click` /
`form_start` / `form_submit` on every real visitor interaction) stays
disabled until:

- [ ] PR#10 tests are green in CI.
- [ ] Operator has run the §6 synthetic smokes against staging once per
      event and received HTTP 200 + `accepted_count=1` each.
- [ ] §7 DB SQL confirms each event is stored verbatim in raw, canonical
      remains 19 keys, reconciliation invariants hold.
- [ ] PR#9 observation report shows the new event_name breakdown with the
      expected counts, status `PASS`.
- [ ] No backend logs show `storage_failure` / `auth_lookup_failure` /
      `collector_misconfigured` since the synthetic smokes.
- [ ] Helen has explicitly approved opening behaviour-event auto-emit on
      buyerrecon.com.

Only after every box is ticked does the buyerrecon.com SDK flip from
RECORD_ONLY synthetic-only mode to actually emitting these events on real
user interactions — and that flip is a **separate change** (not part of
PR#10).

## 10. What PR#10 explicitly does NOT do

- ✅ No new admit values in `validation.ts` event_type enum. The new
  events use the existing `'track'` admit value for browser origin.
- ✅ No changes to `canonical.ts`. The 19-key canonical projection is
  identical for all event types.
- ✅ No changes to `normalised-envelope.ts`. The 36-key normalised
  envelope is identical for all event types. Event-specific fields land
  only in `raw`.
- ✅ No new DB columns, no new indexes, no new migrations.
- ✅ No scoring fields. No `risk_score` / `classification` /
  `recommended_action` / `bot_score` / `agent_score` / `is_bot` /
  `is_agent` / `ai_agent` identifier in PR#10 active code.
- ✅ No Track A imports. No Core AMS imports. No Playwright.
- ✅ No production DB connections. No production auto collection.
- ✅ No commit. No push. No deploy.

## 11. Codex review checklist

1. ✅ No runtime source under `src/**` was modified by PR#10.
2. ✅ `src/collector/v1/index.ts` barrel still has exactly 4 `export *`
   lines (existing scope-test continues to enforce).
3. ✅ `tests/v1/behaviour-events-pr10.test.ts` covers: validation accept
   for all three events, validation reject for `event_type='interaction'`
   and `'form'` (not in admit set), validation reject for empty
   event_name / schema_key, orchestrator end-to-end accept, row-builder
   raw-preservation, canonical 19-key invariance + canonical does NOT
   include cta_*/form_*, PII negatives (email / phone / Luhn payment),
   HTTP route via createApp accepts each, payload_sha256 ≠ canonical-hash.
4. ✅ Test fixtures use dynamic `occurred_at` (`Date.now() - 60_000`)
   to stay inside the validator's R-5 window.
5. ✅ Tests use synthetic UUIDs verified Luhn-safe (no all-3s or
   all-6s patterns).
6. ✅ `scripts/collector-observation-report.ts` adds §7b event-type
   breakdown with grouped counts only — no per-event raw payload fields
   rendered.
7. ✅ Observation script still SELECTs no `token_hash`, no `ip_hash`, no
   `user_agent`, no DATABASE_URL literal output, no peppers.
8. ✅ Observation script remains read-only — no DML / DDL / BEGIN / COMMIT.
9. ✅ `npx tsc --noEmit` is clean.
10. ✅ `unset TEST_DATABASE_URL; npm test` passes — count increases by
    the number of new PR#10 tests (~26).
11. ✅ `TEST_DATABASE_URL=… npm run test:db:v1` still passes 44 / 1
    skipped (unchanged — PR#10 adds no DB tests).
12. ✅ No commit, no push, no deploy.
