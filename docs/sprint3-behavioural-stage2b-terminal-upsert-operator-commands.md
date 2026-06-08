# Sprint 3: Behavioural Stage 2b Terminal-Upsert — Operator Commands (Review-Only)

**Status:** `STAGE2B_TERMINAL_UPSERT_OPERATOR_COMMANDS_REVIEW_ONLY`

This document contains a **manual operator command pack** for the
already-approved Stage 2b terminal-upsert reproduction. **Claude Code did not
and cannot execute these commands** (no production terminal access). Helen runs
them manually on the production host.

- GO issued (command-creation only by Claude Code):
  `HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO`
- This artifact authorizes **command creation only**. Manual production
  execution remains Helen-operated.
- The commands perform **exactly one** rollback-contained, full-source-shaped
  terminal-upsert attempt and emit **sanitized JSONL only** — no GRANT/ALTER/
  SET ROLE/DDL, no persistent DML, no COMMIT, no extractor/worker/downstream,
  no Lane/scoring/AMS/customer output, no Gate 4E/4F, no more than one attempt.

> Provenance: base `sprint2-architecture-contracts-d4cc2bf`; command-pack
> artifact `docs/sprint3-behavioural-stage2b-terminal-upsert-command-pack.md`
> merged via PR #148 at `b4818861c73ab0ad1d5c67d0e879c346e8d474e1`.

---

## 0. Pre-Flight Stop-Lines (abort before the upsert if ANY is true)

- source shape cannot be re-verified against HEAD (§1);
- the full **36** insert columns / **32** update assignments cannot be mirrored;
- synthetic values cannot safely satisfy the full source shape;
- more than one attempt would be required;
- the transaction cannot guarantee rollback;
- any `COMMIT` path exists;
- DSN / password / token would be printed;
- raw identifiers would be printed;
- raw row values would be printed (including RETURNING output);
- payload / customer data would be printed;
- a broad grant would be required first;
- extractor / worker / downstream runtime would run;
- Lane A/B, scoring, AMS Trust/Pass, customer output, Gate 4E, or Gate 4F would
  be touched.

If a stop-line trips, **do not run the upsert** — record a sanitized `BLOCKED`
evidence result (the script below emits `outcome:"blocked"` automatically when
it cannot construct the full-shape attempt) and open the evidence PR with that.

---

## 1. Step 1 — Re-verify source shape against HEAD (read-only)

Run these on the production host (or any checkout at the deployed commit) to
confirm the upsert shape still matches this pack **before** executing anything.
These print **column names / SQL structure only** — no data.

```bash
cd /opt/buyerrecon-backend

# 1a. Confirm the SQL constant and the single-query runner exist.
grep -n "export const EXTRACTION_SQL" scripts/extract-behavioural-features.ts
grep -n "pool.query(EXTRACTION_SQL, params)" scripts/extract-behavioural-features.ts

# 1b. Print the INSERT column block, the ON CONFLICT/RETURNING lines,
#     and confirm DO UPDATE SET uses EXCLUDED.* only.
sed -n '727,756p' scripts/extract-behavioural-features.ts     # 36 insert columns
sed -n '901,935p' scripts/extract-behavioural-features.ts     # arbiter, 32 SET=EXCLUDED.*, RETURNING

# 1c. Guard: there must be NO existing-target reads in DO UPDATE SET
#     (expect: every RHS is EXCLUDED.<col>). The next line should print nothing.
sed -n '902,934p' scripts/extract-behavioural-features.ts | grep -vE 'EXCLUDED' | grep -iE '= *[a-z_]+\.' || echo "OK: DO UPDATE SET reads EXCLUDED.* only"
```

**Expected (must match this pack):**
- target table `public.session_behavioural_features_v0_2`;
- conflict arbiter `workspace_id, site_id, session_id, feature_version`;
- 36 insert columns and 32 `EXCLUDED.*` update assignments (as embedded in the
  script below);
- returning `behavioural_features_id, workspace_id, site_id, session_id`.

If anything differs, **STOP** (pre-flight stop-line) and do not proceed.

---

## 2. Step 2 — Load the app DSN without printing it

```bash
cd /opt/buyerrecon-backend

# Load production env into the shell WITHOUT echoing it. `set -a` exports
# variables defined while sourcing; nothing is printed by sourcing.
set -a
. ./.env.production 2>/dev/null
set +a

# Bind the app DSN to APP_DSN for the script. NEVER echo it.
export APP_DSN="${DATABASE_URL:?DATABASE_URL not set in environment}"

# Sanity (prints only a boolean, never the value):
[ -n "$APP_DSN" ] && echo "APP_DSN loaded: true" || echo "APP_DSN loaded: false"
```

> Do **not** run `echo "$APP_DSN"`, `env`, `set`, `psql "$APP_DSN"`, or any
> command that would print the DSN, host, user, or password.

---

## 3. Step 3 — Write the rollback-contained Stage 2b script

The single-quoted heredoc (`<<'NODE'`) prevents the shell from expanding
`$1..$36` / `${...}`. The script connects as the same app role (via `APP_DSN`),
runs **one** full-source-shaped upsert inside a transaction, **always rolls
back**, never commits, and prints **only** sanitized JSONL.

```bash
cat > /tmp/stage2b-terminal-upsert.js <<'NODE'
'use strict';
// CANDIDATE / OPERATOR SCRIPT — Stage 2b terminal-upsert reproduction.
// One attempt. Rollback only. No COMMIT. Sanitized JSONL only.
// No DSN/secret/row-values/identifiers printed.
const pg = require('pg');

function emit(o) { process.stdout.write(JSON.stringify(o) + '\n'); }

(async () => {
  const ev = {
    stage: '2b',
    reached_postgres: false,
    transaction_started: false,
    rolled_back: false,
    commit_used: false,
    attempts: 0,
    outcome: 'blocked',
    data_approach: 'synthetic_fixture',
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

  // Synthetic, fake, namespaced fixture values — NEVER printed.
  // Cannot collide with real customer identifiers. Bound as $1..$36.
  const TS = new Date().toISOString();
  const params = [
    'stage2b-synth-workspace',            //  1 workspace_id            text   (arbiter)
    'stage2b-synth-site',                 //  2 site_id                 text   (arbiter)
    'stage2b-synth-session',              //  3 session_id              text   (arbiter)
    'stage2b-synth-feature-version',      //  4 feature_version         text   (arbiter)
    TS,                                   //  5 extracted_at            timestamptz NOT NULL
    null,                                 //  6 first_seen_at           timestamptz
    null,                                 //  7 last_seen_at            timestamptz
    0,                                    //  8 source_event_count      int  NOT NULL >=0
    null,                                 //  9 source_event_id_min     bigint
    null,                                 // 10 source_event_id_max     bigint
    null,                                 // 11 first_event_id          bigint
    null,                                 // 12 last_event_id           bigint
    null,                                 // 13 ms_from_consent_to_first_cta   bigint
    null,                                 // 14 dwell_ms_before_first_action   bigint
    null,                                 // 15 first_form_start_precedes_first_cta  boolean
    0,                                    // 16 form_start_count_before_first_cta    int NOT NULL >=0
    false,                                // 17 has_form_submit_without_prior_form_start boolean NOT NULL
    0,                                    // 18 form_submit_count_before_first_form_start int NOT NULL >=0
    null,                                 // 19 ms_between_pageviews_p50  bigint
    0,                                    // 20 pageview_burst_count_10s  int NOT NULL >=0
    0,                                    // 21 max_events_per_second     int NOT NULL >=0
    0,                                    // 22 sub_200ms_transition_count int NOT NULL >=0
    null,                                 // 23 interaction_density_bucket text
    null,                                 // 24 scroll_depth_bucket_before_first_cta text
    null,                                 // 25 refresh_loop_candidate    boolean
    0,                                    // 26 refresh_loop_count        int NOT NULL >=0
    0,                                    // 27 same_path_repeat_count    int NOT NULL >=0
    null,                                 // 28 same_path_repeat_max_span_ms    bigint
    null,                                 // 29 same_path_repeat_min_delta_ms   bigint
    null,                                 // 30 same_path_repeat_median_delta_ms bigint
    0,                                    // 31 repeat_pageview_candidate_count int NOT NULL >=0
    null,                                 // 32 refresh_loop_source       text
    0,                                    // 33 valid_feature_count       int NOT NULL >=0
    0,                                    // 34 missing_feature_count     int NOT NULL >=0
    '{}',                                 // 35 feature_presence_map      jsonb NOT NULL
    '{}',                                 // 36 feature_source_map        jsonb NOT NULL
  ];
  if (params.length !== 36) { ev.blocked_reason = 'param_count_mismatch'; emit(ev); process.exit(1); }

  // Full-source-shaped upsert: 36 insert columns, 32 EXCLUDED.* updates,
  // same arbiter + returning. Reduced-column upsert is forbidden.
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
      ev.outcome = 'success';   // unexpected, but still rolled back below
      ev.dml_attempt_was_rollback_contained = true;
    } catch (e) {
      ev.outcome = 'error';
      ev.dml_attempt_was_rollback_contained = true;
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
        message_redacted: true,   // raw message intentionally never emitted
      };
    }
  } catch (connErr) {
    if (!ev.reached_postgres) ev.blocked_reason = 'connection_failed';
    ev.outcome = ev.reached_postgres ? 'error' : 'blocked';
  } finally {
    try { await client.query('ROLLBACK'); ev.rolled_back = true; } catch (_) { /* aborted/closed */ }
    try { await client.end(); } catch (_) {}
  }
  ev.commit_used = false;       // invariant: no COMMIT anywhere in this script
  emit(ev);
  process.exit(0);
})();
NODE
```

> Note: the script contains **no** `COMMIT`, **no** `GRANT`/`ALTER`/`SET ROLE`/
> `CREATE`/`DROP`, and never logs the DSN, bind values, or RETURNING rows. The
> only synthetic literals are the namespaced `stage2b-synth-*` fixtures, which
> are fake and never printed.

---

## 4. Step 4 — Execute exactly once and capture sanitized JSONL

```bash
cd /opt/buyerrecon-backend
# Uses the repo's node_modules (pg). One run only. Capture JSONL to a file.
LOG="/tmp/buyerrecon_stage2b_terminal_upsert_$(date -u +%Y%m%dT%H%M%SZ).jsonl"
node /tmp/stage2b-terminal-upsert.js | tee "$LOG"
echo "stage2b_log_path: $LOG"
```

- Run this **once**. Do not re-run (one-attempt stop-line).
- The output is a single JSONL object (sanitized). The DSN is never printed.

---

## 5. Step 5 — Clean up the temp script (no persistent change)

```bash
shred -u /tmp/stage2b-terminal-upsert.js 2>/dev/null || rm -f /tmp/stage2b-terminal-upsert.js
unset APP_DSN
```

No persistent DB change is made (transaction rolled back); the temp script is
removed and the DSN is unset from the shell.

---

## 6. Expected JSONL Evidence Fields

```json
{
  "stage": "2b",
  "reached_postgres": true,
  "transaction_started": true,
  "rolled_back": true,
  "commit_used": false,
  "attempts": 1,
  "outcome": "error",
  "error": {
    "code": "<SQLSTATE>",
    "severity": "<severity>",
    "routine": "<routine>",
    "schema_field_present": false,
    "table_field_present": false,
    "column_field_present": false,
    "constraint_field_present": false,
    "detail_present": false,
    "hint_present": false,
    "where_present": false,
    "message_redacted": true
  },
  "data_approach": "synthetic_fixture",
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

- `"no_grant_dml_ddl"` is **not** used (Codex correction): Stage 2b is a
  rollback-contained DML-shaped attempt, recorded via `no_grant_or_ddl`,
  `dml_attempt_was_rollback_contained`, and `no_persistent_dml`.
- For a `blocked` outcome the object includes `outcome:"blocked"` and a
  `blocked_reason`, with `attempts:0` and no real values.

---

## 7. What These Commands Authorize / Do Not Authorize

**Authorize (manual, Helen-operated):** source-shape re-verification; load app
DSN without printing it; connect as the same app role; `BEGIN`; the three
`SET LOCAL` timeouts; exactly one full-source-shaped terminal-upsert attempt;
unconditional `ROLLBACK`; sanitized JSONL only; then a separate docs-only
evidence PR.

**Do NOT authorize:** `GRANT`, `ALTER`, `SET ROLE`, broad-grant path,
persistent DML, DDL, extractor rerun, worker, downstream runtime, Lane A/B,
scoring runtime, AMS Trust/Pass runtime, customer output, Gate 4E, Gate 4F, or
more than one upsert attempt.

---

## 8. After Execution — Required Evidence PR

Record the sanitized JSONL (and the log path) in a **separate docs-only
evidence PR**, including the interpretation of the exact failing object/
operation if PostgreSQL provided the structured fields. **No** raw values,
secrets, identifiers, payloads, or customer data. **No** grant/fix/extractor/
worker/downstream/Gate 4E/4F.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. `session_id`,
`request_id`, `workspace_id`, `site_id` appear only as **column names** or
**synthetic fake fixtures** (`stage2b-synth-*`, never printed). SQL bind values
are positional placeholders (`$1..$36`); the DSN is read from the environment
and never echoed.
