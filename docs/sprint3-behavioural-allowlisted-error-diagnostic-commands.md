# Sprint 3: Behavioural Allowlisted Error-Message Diagnostic — Operator Commands (Review-Only)

**Status:** `BEHAVIOURAL_ALLOWLISTED_ERROR_DIAGNOSTIC_COMMANDS_REVIEW_ONLY`

This document contains a **manual operator command pack** for the Option A
allowlisted PostgreSQL error-message diagnostic planned in PR #152. **Claude
Code did not and cannot execute these commands** (no production terminal
access). Helen runs them manually on the production host after review/merge and
a separate explicit GO.

- The diagnostic reproduces the **full-source-shaped** Stage 2b terminal upsert
  **exactly once**, rollback-contained, and classifies the PostgreSQL error
  **message** against a static allowlist **in memory only** — it **never prints
  the raw message**.
- This PR is **docs-only and review-only**. It executes nothing and authorizes
  no diagnostic, grant/fix, SQL, GRANT/DML/DDL, extractor rerun, worker/
  downstream runtime, Lane/scoring/AMS/customer output, or Gate 4E/4F.

> Provenance: base `sprint2-architecture-contracts-d4cc2bf`; Option A plan
> merged via PR #152 at `44219d20f99a30131acb5f19e406b97afcf41777`; reuses the
> Stage 2b command-pack shape (PR #148) and the `DATABASE_URL`-only DSN parse
> (PR #149).

---

## 0. Pre-Flight Stop-Lines (abort before the upsert if ANY is true)

- a raw error message would be printed;
- the message classifier cannot guarantee redaction;
- non-allowlisted content would be emitted;
- the source shape cannot be re-verified against HEAD;
- the full source shape cannot be mirrored;
- synthetic values cannot satisfy the full shape;
- more than one attempt would be required;
- rollback cannot be guaranteed;
- any `COMMIT` path exists;
- DSN / password / token would be printed;
- raw identifiers would be printed;
- raw row values would be printed;
- payload / customer data would be printed;
- hostname / IP / UUID / cloud token would be printed;
- a grant/fix would be required first;
- extractor / worker / downstream runtime would run;
- Lane / scoring / AMS / customer output would be touched;
- Gate 4E or Gate 4F would be touched.

If a stop-line trips, **do not run the upsert** — the script emits a sanitized
`blocked` result, and the operator records it in the evidence PR.

---

## 1. Step 1 — Re-verify source shape against HEAD (read-only)

```bash
cd /opt/buyerrecon-backend

# Confirm the SQL constant + single-query runner exist.
grep -n "export const EXTRACTION_SQL" scripts/extract-behavioural-features.ts
grep -n "pool.query(EXTRACTION_SQL, params)" scripts/extract-behavioural-features.ts

# Print the INSERT column block, the ON CONFLICT/RETURNING lines, and confirm
# DO UPDATE SET uses EXCLUDED.* only (prints column names / structure only).
sed -n '727,756p' scripts/extract-behavioural-features.ts     # 36 insert columns
sed -n '901,935p' scripts/extract-behavioural-features.ts     # arbiter, 32 SET=EXCLUDED.*, RETURNING
sed -n '902,934p' scripts/extract-behavioural-features.ts | grep -vE 'EXCLUDED' | grep -iE '= *[a-z_]+\.' || echo "OK: DO UPDATE SET reads EXCLUDED.* only"
```

Expected (must match this pack): target `public.session_behavioural_features_v0_2`;
arbiter `workspace_id, site_id, session_id, feature_version`; 36 insert columns;
32 `EXCLUDED.*` updates; returning
`behavioural_features_id, workspace_id, site_id, session_id`. If anything
differs, **STOP** (pre-flight stop-line).

---

## 2. Step 2 — Load only DATABASE_URL into APP_DSN (narrow parser, never printed)

Operator hygiene (required): run in a **fresh / ephemeral shell**; do not run
`env`, `set`, `export -p`, or shell history dumps; `unset APP_DSN` on completion
(Step 5).

```bash
cd /opt/buyerrecon-backend

# Parse ONLY the DATABASE_URL line from .env.production into APP_DSN.
# No other variables are sourced or exported. The value is never printed.
APP_DSN="$(
  python3 - <<'PY'
from pathlib import Path

p = Path(".env.production")
value = ""

for line in p.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    key, val = s.split("=", 1)
    if key.strip() == "DATABASE_URL":
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        value = val
        break

print(value, end="")
PY
)"

if [ -z "${APP_DSN:-}" ]; then
  echo '{"stage":"allowlisted_error_diagnostic","outcome":"blocked","blocked_reason":"database_url_not_loaded","message_redacted":true}'
  exit 1
fi

export APP_DSN
[ -n "${APP_DSN:-}" ] && echo "APP_DSN loaded: true" || echo "APP_DSN loaded: false"
```

> Do **not** run `echo "$APP_DSN"`, `env`, `set`, `psql "$APP_DSN"`, or any
> command that would print the DSN, host, user, password, or parsed connection
> details. Only `DATABASE_URL` is loaded; no other secret is sourced/exported.

---

## 3. Step 3 — Write the allowlisted-classifier diagnostic script

The single-quoted heredoc (`<<'NODE'`) prevents shell expansion of `$1..$36`.
The script connects as the same app role, runs **one** full-source-shaped upsert
inside a transaction, **always rolls back**, never commits, classifies the error
message **in memory** against a static allowlist, and prints **only** sanitized
JSONL — never the raw message.

```bash
cat > /tmp/stage2b-allowlisted-error.js <<'NODE'
'use strict';
// CANDIDATE / OPERATOR SCRIPT — allowlisted error-message diagnostic.
// One attempt. Rollback only. No COMMIT. Sanitized JSONL only.
// Raw error message is classified IN MEMORY and NEVER printed.
const pg = require('pg');

function emit(o) { process.stdout.write(JSON.stringify(o) + '\n'); }

// Static allowlist — known-safe object/privilege words + source-shape column
// names. NO values. The sequence name is included because it is a known static
// identifier derived from the BIGSERIAL column (re-confirm via source/DB
// inspection at execution time; if unconfirmed, leave it out — never print it).
const STATIC_TERMS = [
  'permission denied', 'relation', 'table', 'column', 'sequence', 'schema',
  'session_behavioural_features_v0_2',
  'session_behavioural_features_v0_2_behavioural_features_id_seq',
];
const COLUMN_TERMS = [
  'behavioural_features_id',
  'workspace_id','site_id','session_id','feature_version','extracted_at',
  'first_seen_at','last_seen_at','source_event_count','source_event_id_min',
  'source_event_id_max','first_event_id','last_event_id',
  'ms_from_consent_to_first_cta','dwell_ms_before_first_action',
  'first_form_start_precedes_first_cta','form_start_count_before_first_cta',
  'has_form_submit_without_prior_form_start',
  'form_submit_count_before_first_form_start','ms_between_pageviews_p50',
  'pageview_burst_count_10s','max_events_per_second','sub_200ms_transition_count',
  'interaction_density_bucket','scroll_depth_bucket_before_first_cta',
  'refresh_loop_candidate','refresh_loop_count','same_path_repeat_count',
  'same_path_repeat_max_span_ms','same_path_repeat_min_delta_ms',
  'same_path_repeat_median_delta_ms','repeat_pageview_candidate_count',
  'refresh_loop_source','valid_feature_count','missing_feature_count',
  'feature_presence_map','feature_source_map',
];
const ALLOWLIST = STATIC_TERMS.concat(COLUMN_TERMS);

// Classify the raw message IN MEMORY only. Never returns or prints raw text.
// Returns { match: bool, terms: [...] } where terms are drawn ONLY from the
// allowlist. If anything in the message is not reducible to allowlist tokens,
// match=false and terms=[] (redact-on-uncertainty).
function classify(rawMessage) {
  if (typeof rawMessage !== 'string' || rawMessage.length === 0) {
    return { match: false, terms: [] };
  }
  const norm = rawMessage.toLowerCase();
  const found = [];
  for (const term of ALLOWLIST) {
    if (norm.includes(term.toLowerCase())) found.push(term);
  }
  if (found.length === 0) return { match: false, terms: [] };
  // Conservative residue check: remove matched allowlist tokens and common
  // punctuation/quotes/whitespace; if anything substantive remains, the message
  // carries non-allowlisted content -> redact (match=false, terms=[]).
  let residue = norm;
  for (const t of found) residue = residue.split(t.toLowerCase()).join(' ');
  residue = residue.replace(/[\s"'`.,:;()\[\]{}<>\/\\-]+/g, ' ').trim();
  if (residue.length > 0) return { match: false, terms: [] };
  return { match: true, terms: found };
}

(async () => {
  const ev = {
    stage: 'allowlisted_error_diagnostic',
    reached_postgres: false,
    transaction_started: false,
    rolled_back: false,
    commit_used: false,
    attempts: 0,
    outcome: 'blocked',
    data_approach: 'synthetic_fixture',
    no_raw_message_printed: true,
    no_row_values_printed: true,
    no_secret_printed: true,
    no_raw_identifier_printed: true,
    no_grant_or_ddl: true,
    dml_attempt_was_rollback_contained: false,
    no_persistent_dml: true,
    no_extractor_rerun: true,
    no_worker_run: true,
    no_downstream_runtime: true,
    no_gate_4e: true,
    no_gate_4f: true,
  };

  const dsn = process.env.APP_DSN || process.env.DATABASE_URL;
  if (!dsn) { ev.blocked_reason = 'no_dsn_in_env'; emit(ev); process.exit(1); }

  // Synthetic, fake, namespaced fixtures — NEVER printed. Bound as $1..$36.
  const TS = new Date().toISOString();
  const params = [
    'stage2b-synth-workspace', 'stage2b-synth-site', 'stage2b-synth-session',
    'stage2b-synth-feature-version', TS,
    null, null,
    0, null, null,
    null, null,
    null, null,
    null, 0,
    false, 0,
    null, 0, 0,
    0, null, null,
    null, 0, 0,
    null, null, null,
    0, null,
    0, 0, '{}', '{}',
  ];
  if (params.length !== 36) { ev.blocked_reason = 'param_count_mismatch'; emit(ev); process.exit(1); }

  const sql = `
INSERT INTO public.session_behavioural_features_v0_2 (
  workspace_id, site_id, session_id, feature_version, extracted_at,
  first_seen_at, last_seen_at,
  source_event_count, source_event_id_min, source_event_id_max,
  first_event_id, last_event_id,
  ms_from_consent_to_first_cta, dwell_ms_before_first_action,
  first_form_start_precedes_first_cta, form_start_count_before_first_cta,
  has_form_submit_without_prior_form_start, form_submit_count_before_first_form_start,
  ms_between_pageviews_p50, pageview_burst_count_10s, max_events_per_second,
  sub_200ms_transition_count, interaction_density_bucket, scroll_depth_bucket_before_first_cta,
  refresh_loop_candidate, refresh_loop_count, same_path_repeat_count,
  same_path_repeat_max_span_ms, same_path_repeat_min_delta_ms, same_path_repeat_median_delta_ms,
  repeat_pageview_candidate_count, refresh_loop_source,
  valid_feature_count, missing_feature_count, feature_presence_map, feature_source_map
)
VALUES (
  $1::text, $2::text, $3::text, $4::text, $5::timestamptz,
  $6::timestamptz, $7::timestamptz,
  $8::int, $9::bigint, $10::bigint,
  $11::bigint, $12::bigint,
  $13::bigint, $14::bigint,
  $15::boolean, $16::int,
  $17::boolean, $18::int,
  $19::bigint, $20::int, $21::int,
  $22::int, $23::text, $24::text,
  $25::boolean, $26::int, $27::int,
  $28::bigint, $29::bigint, $30::bigint,
  $31::int, $32::text,
  $33::int, $34::int, $35::jsonb, $36::jsonb
)
ON CONFLICT (workspace_id, site_id, session_id, feature_version)
DO UPDATE SET
  extracted_at                              = EXCLUDED.extracted_at,
  first_seen_at                             = EXCLUDED.first_seen_at,
  last_seen_at                              = EXCLUDED.last_seen_at,
  source_event_count                        = EXCLUDED.source_event_count,
  source_event_id_min                       = EXCLUDED.source_event_id_min,
  source_event_id_max                       = EXCLUDED.source_event_id_max,
  first_event_id                            = EXCLUDED.first_event_id,
  last_event_id                             = EXCLUDED.last_event_id,
  ms_from_consent_to_first_cta              = EXCLUDED.ms_from_consent_to_first_cta,
  dwell_ms_before_first_action              = EXCLUDED.dwell_ms_before_first_action,
  first_form_start_precedes_first_cta       = EXCLUDED.first_form_start_precedes_first_cta,
  form_start_count_before_first_cta         = EXCLUDED.form_start_count_before_first_cta,
  has_form_submit_without_prior_form_start  = EXCLUDED.has_form_submit_without_prior_form_start,
  form_submit_count_before_first_form_start = EXCLUDED.form_submit_count_before_first_form_start,
  ms_between_pageviews_p50                  = EXCLUDED.ms_between_pageviews_p50,
  pageview_burst_count_10s                  = EXCLUDED.pageview_burst_count_10s,
  max_events_per_second                     = EXCLUDED.max_events_per_second,
  sub_200ms_transition_count                = EXCLUDED.sub_200ms_transition_count,
  interaction_density_bucket                = EXCLUDED.interaction_density_bucket,
  scroll_depth_bucket_before_first_cta      = EXCLUDED.scroll_depth_bucket_before_first_cta,
  refresh_loop_candidate                    = EXCLUDED.refresh_loop_candidate,
  refresh_loop_count                        = EXCLUDED.refresh_loop_count,
  same_path_repeat_count                    = EXCLUDED.same_path_repeat_count,
  same_path_repeat_max_span_ms              = EXCLUDED.same_path_repeat_max_span_ms,
  same_path_repeat_min_delta_ms             = EXCLUDED.same_path_repeat_min_delta_ms,
  same_path_repeat_median_delta_ms          = EXCLUDED.same_path_repeat_median_delta_ms,
  repeat_pageview_candidate_count           = EXCLUDED.repeat_pageview_candidate_count,
  refresh_loop_source                       = EXCLUDED.refresh_loop_source,
  valid_feature_count                       = EXCLUDED.valid_feature_count,
  missing_feature_count                     = EXCLUDED.missing_feature_count,
  feature_presence_map                      = EXCLUDED.feature_presence_map,
  feature_source_map                        = EXCLUDED.feature_source_map
RETURNING behavioural_features_id, workspace_id, site_id, session_id`;

  const client = new pg.Client({ connectionString: dsn });
  try {
    await client.connect();
    ev.reached_postgres = true;
    await client.query('BEGIN');
    ev.transaction_started = true;
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    ev.attempts = 1;
    try {
      const res = await client.query({ text: sql, values: params });
      void res;                 // NEVER print returned rows
      ev.outcome = 'success';
      ev.dml_attempt_was_rollback_contained = true;
      ev.error = null;
    } catch (e) {
      ev.outcome = 'error';
      ev.dml_attempt_was_rollback_contained = true;
      const cls = classify(e && e.message);   // in memory only; raw never printed
      ev.error = {
        code: e && e.code ? String(e.code) : null,
        severity: e && e.severity ? String(e.severity) : null,
        routine: e && e.routine ? String(e.routine) : null,
        schema_field_present: !!(e && e.schema),
        table_field_present: !!(e && e.table),
        column_field_present: !!(e && e.column),
        constraint_field_present: !!(e && e.constraint),
        detail_present: !!(e && e.detail),
        hint_present: !!(e && e.hint),
        where_present: !!(e && e.where),
        message_redacted: true,                       // raw message never emitted
        message_allowlist_match: cls.match,
        allowlisted_terms_found: cls.match ? cls.terms : [],
      };
    }
  } catch (connErr) {
    if (!ev.reached_postgres) ev.blocked_reason = 'connection_failed';
    ev.outcome = ev.reached_postgres ? 'error' : 'blocked';
  } finally {
    try { await client.query('ROLLBACK'); ev.rolled_back = true; } catch (_) {}
    try { await client.end(); } catch (_) {}
  }
  ev.commit_used = false;       // invariant: no COMMIT anywhere
  emit(ev);
  process.exit(0);
})();
NODE
```

> The script contains **no** `COMMIT`, **no** `GRANT`/`ALTER`/`SET ROLE`/`CREATE`/
> `DROP`, and never logs the DSN, bind values, RETURNING rows, or the raw error
> message. The classifier runs **in memory** and emits only allowlist tokens (or
> redacts).

---

## 4. Step 4 — Execute exactly once and capture sanitized JSONL

```bash
cd /opt/buyerrecon-backend
LOG="/tmp/buyerrecon_allowlisted_error_diag_$(date -u +%Y%m%dT%H%M%SZ).jsonl"
node /tmp/stage2b-allowlisted-error.js | tee "$LOG"
echo "allowlisted_error_diag_log_path: $LOG"
```

- Run this **once**. Do not re-run (one-attempt stop-line).
- The output is a single sanitized JSONL object. The DSN and raw message are
  never printed.

---

## 5. Step 5 — Clean up (no persistent change)

```bash
shred -u /tmp/stage2b-allowlisted-error.js 2>/dev/null || rm -f /tmp/stage2b-allowlisted-error.js
unset APP_DSN
```

No persistent DB change (transaction rolled back); temp script removed; DSN
unset.

---

## 6. Expected Sanitized JSONL

```json
{
  "stage": "allowlisted_error_diagnostic",
  "reached_postgres": true,
  "transaction_started": true,
  "rolled_back": true,
  "commit_used": false,
  "attempts": 1,
  "outcome": "error",
  "error": {
    "code": "42501",
    "severity": "ERROR",
    "routine": "aclcheck_error",
    "schema_field_present": false,
    "table_field_present": false,
    "column_field_present": false,
    "constraint_field_present": false,
    "detail_present": false,
    "hint_present": false,
    "where_present": false,
    "message_redacted": true,
    "message_allowlist_match": false,
    "allowlisted_terms_found": []
  },
  "no_raw_message_printed": true,
  "no_row_values_printed": true,
  "no_secret_printed": true,
  "no_raw_identifier_printed": true,
  "no_grant_or_ddl": true,
  "dml_attempt_was_rollback_contained": true,
  "no_persistent_dml": true,
  "no_extractor_rerun": true,
  "no_worker_run": true,
  "no_downstream_runtime": true,
  "no_gate_4e": true,
  "no_gate_4f": true
}
```

- If only allowlisted terms are detected: `message_allowlist_match=true` and
  `allowlisted_terms_found=[...]` (tokens drawn only from the static allowlist),
  with `message_redacted=true` still held and **no raw message** ever printed.
- If any non-allowlisted content or uncertainty: `message_allowlist_match=false`,
  `allowlisted_terms_found=[]`, `message_redacted=true`, no raw message.
- For a `blocked` outcome: `outcome:"blocked"` + `blocked_reason`, `attempts:0`.
- DML wording uses `no_grant_or_ddl` / `dml_attempt_was_rollback_contained` /
  `no_persistent_dml`; the misleading `no_grant_dml_ddl` field is **not** used.

---

## 7. What These Commands Authorize / Do Not Authorize

**Authorize (manual, Helen-operated, after review/merge + separate explicit
GO):** source-shape re-verification; load app DSN via `DATABASE_URL`-only parse
without printing it; connect as the same app role; `BEGIN`; the three `SET LOCAL`
timeouts; exactly one full-source-shaped upsert attempt; in-memory allowlist
classification; unconditional `ROLLBACK`; sanitized JSONL only; then a separate
docs-only evidence PR.

**Do NOT authorize:** raw message printing; `GRANT`/`ALTER`/`SET ROLE`/broad
grant; persistent DML; DDL; grant/fix; extractor rerun; worker/downstream
runtime; Lane A/B; scoring runtime; AMS Trust/Pass runtime; customer output;
Gate 4E/Gate 4F; more than one attempt.

---

## 8. After Execution — Required Evidence PR

Record the sanitized JSONL (and the log path) in a **separate docs-only evidence
PR**, with the allowlisted classification interpretation. **No** raw message,
values, secrets, identifiers, payloads, or customer data. **No** grant/fix/
extractor/worker/downstream/Gate 4E/4F.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. `session_id`,
`request_id`, `workspace_id`, `site_id` appear only as **column names** /
**allowlist tokens** / **synthetic fake fixtures** (`stage2b-synth-*`, never
printed). SQL bind values are positional placeholders (`$1..$36`); the DSN is
read from the environment and never echoed; the raw PostgreSQL error message is
classified in memory and never printed.
