# Sprint 3: Behavioural Stage 2b Terminal-Upsert — Command Pack (Review-Only Artifact)

**Status:** `STAGE2B_TERMINAL_UPSERT_COMMAND_PACK_REVIEW_ONLY`

## 1. Title & Status

- This is a **review-only** docs artifact. The command pack below is
  **CANDIDATE ONLY — DO NOT RUN** and is **not an execution GO**.
- It makes the future Stage 2b terminal-upsert reproduction command pack
  reviewable **inside the repo**. It executes nothing.

---

## 2. Why This Artifact Exists

- Codex **blocked** the prior Stage 2b review because the command pack existed
  only in chat, not as a reviewable artifact in the repo/workspace.
- This PR creates that reviewable docs-only command-pack artifact so Codex can
  review the exact future operator design.
- It still **does not authorize execution**.
- Execution still requires the exact future Helen GO phrase, issued **only**
  after this artifact is reviewed and merged:
  `HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO`

### Codex-required correction incorporated
Stage 2b intentionally performs a **rollback-contained, DML-shaped** upsert
attempt, so the JSONL must **not** claim `"no_grant_dml_ddl": true`. This
artifact uses the corrected wording instead (see §7):
`"no_grant_or_ddl": true`, `"dml_attempt_was_rollback_contained": true`,
`"no_persistent_dml": true`.

---

## 3. Source-Grounding (verified against merged base `707aef9`)

| Item | Finding | Location |
|---|---|---|
| File / SQL constant | `EXTRACTION_SQL` template literal | `scripts/extract-behavioural-features.ts:281` |
| Insert statement | `INSERT INTO session_behavioural_features_v0_2 ( … )` | `scripts/extract-behavioural-features.ts:727` |
| Conflict / update / returning | `ON CONFLICT … DO UPDATE SET … RETURNING` | `:901`, `:902`, `:935` |
| Runner executing it | `runExtraction()` → `await pool.query(EXTRACTION_SQL, params)` | `:947`, `:964` |
| Target table | `session_behavioural_features_v0_2` (unqualified; resolves to `public.` — Stage 2a `oid_equal=true`) | `:727` |
| Statement shape | single `INSERT … SELECT … ON CONFLICT … DO UPDATE SET … RETURNING` executed as one `pool.query` | `:727`–`:935`, `:964` |
| Conflict arbiter columns | `workspace_id, site_id, session_id, feature_version` | `:901` |
| Identity / sequence | `behavioural_features_id BIGSERIAL PRIMARY KEY` → sequence `nextval` default; needs sequence **USAGE** (already true) | `migrations/009_session_behavioural_features_v0_2.sql:46` |
| DO UPDATE reads existing rows? | **No** — every assignment RHS is `EXCLUDED.<col>`; **no** existing target-row reads | `:902`–`:934` (verified) |
| Constraints | PK (identity) + 1 UNIQUE natural key `(workspace_id, site_id, session_id, feature_version)` + numeric non-negativity CHECKs only | `migrations/009_…sql:46,98-119` |
| Arbiter column types | `workspace_id, site_id, session_id, feature_version` all `TEXT NOT NULL` | `migrations/009_…sql:49-54` |
| Triggers / FK / RLS | none / none / disabled (Stage 2a: `trigger_count=0`, `foreign_key_count=0`, `relrowsecurity=false`, `relforcerowsecurity=false`) | Stage 2a evidence (PR #145); grep: no `CREATE TRIGGER` |

### Full insert column list — 36 columns (identity `behavioural_features_id` excluded)
```text
workspace_id, site_id, session_id, feature_version, extracted_at,
first_seen_at, last_seen_at,
source_event_count, source_event_id_min, source_event_id_max,
first_event_id, last_event_id,
ms_from_consent_to_first_cta,
dwell_ms_before_first_action,
first_form_start_precedes_first_cta,
form_start_count_before_first_cta,
has_form_submit_without_prior_form_start,
form_submit_count_before_first_form_start,
ms_between_pageviews_p50,
pageview_burst_count_10s,
max_events_per_second,
sub_200ms_transition_count,
interaction_density_bucket,
scroll_depth_bucket_before_first_cta,
refresh_loop_candidate,
refresh_loop_count,
same_path_repeat_count,
same_path_repeat_max_span_ms,
same_path_repeat_min_delta_ms,
same_path_repeat_median_delta_ms,
repeat_pageview_candidate_count,
refresh_loop_source,
valid_feature_count,
missing_feature_count,
feature_presence_map,
feature_source_map
```

### Full update assignment list — 32 assignments (all `EXCLUDED.*`; the 36 insert columns minus the 4 arbiter columns)
```text
extracted_at                              = EXCLUDED.extracted_at
first_seen_at                             = EXCLUDED.first_seen_at
last_seen_at                              = EXCLUDED.last_seen_at
source_event_count                        = EXCLUDED.source_event_count
source_event_id_min                       = EXCLUDED.source_event_id_min
source_event_id_max                       = EXCLUDED.source_event_id_max
first_event_id                            = EXCLUDED.first_event_id
last_event_id                             = EXCLUDED.last_event_id
ms_from_consent_to_first_cta              = EXCLUDED.ms_from_consent_to_first_cta
dwell_ms_before_first_action              = EXCLUDED.dwell_ms_before_first_action
first_form_start_precedes_first_cta       = EXCLUDED.first_form_start_precedes_first_cta
form_start_count_before_first_cta         = EXCLUDED.form_start_count_before_first_cta
has_form_submit_without_prior_form_start  = EXCLUDED.has_form_submit_without_prior_form_start
form_submit_count_before_first_form_start = EXCLUDED.form_submit_count_before_first_form_start
ms_between_pageviews_p50                  = EXCLUDED.ms_between_pageviews_p50
pageview_burst_count_10s                  = EXCLUDED.pageview_burst_count_10s
max_events_per_second                     = EXCLUDED.max_events_per_second
sub_200ms_transition_count                = EXCLUDED.sub_200ms_transition_count
interaction_density_bucket                = EXCLUDED.interaction_density_bucket
scroll_depth_bucket_before_first_cta      = EXCLUDED.scroll_depth_bucket_before_first_cta
refresh_loop_candidate                    = EXCLUDED.refresh_loop_candidate
refresh_loop_count                        = EXCLUDED.refresh_loop_count
same_path_repeat_count                    = EXCLUDED.same_path_repeat_count
same_path_repeat_max_span_ms              = EXCLUDED.same_path_repeat_max_span_ms
same_path_repeat_min_delta_ms             = EXCLUDED.same_path_repeat_min_delta_ms
same_path_repeat_median_delta_ms          = EXCLUDED.same_path_repeat_median_delta_ms
repeat_pageview_candidate_count           = EXCLUDED.repeat_pageview_candidate_count
refresh_loop_source                       = EXCLUDED.refresh_loop_source
valid_feature_count                       = EXCLUDED.valid_feature_count
missing_feature_count                     = EXCLUDED.missing_feature_count
feature_presence_map                      = EXCLUDED.feature_presence_map
feature_source_map                        = EXCLUDED.feature_source_map
```

### Returning columns
```text
behavioural_features_id, workspace_id, site_id, session_id
```

> Privilege note (carried, not asserted as root cause): arbiter + RETURNING
> columns are within the already-granted 5 SELECT columns; `DO UPDATE SET`
> reads no existing rows; no triggers/FK/RLS; sequence USAGE present. Stage 2b
> exists to capture the **structured error fields** that reveal what is actually
> denied.

---

## 4. Future Command-Pack Design

> ## CANDIDATE ONLY — DO NOT RUN
> Not an execution GO. Requires Codex review + merge of this artifact, then the
> exact Helen Stage 2b GO phrase. No real values, no DSN, no password/token, no
> hostnames/IPs, no UUIDs, no raw `session_id`/`request_id`, no payload/customer
> data, no raw row values, no broad-grant path, no `COMMIT`.

```bash
# CANDIDATE ONLY — DO NOT RUN
# Preconditions: (1) Codex PASS on this artifact, (2) merge, (3) explicit GO:
#   HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO
# (4) re-verify §3 source shape against HEAD at execution time.
#
# Connection:
#   - Load the same app DSN the extractor uses (e.g. $APP_DSN); NEVER print it.
#   - Connect as the SAME app role that failed (buyerrecon_prod_collector_app).
#   - No \conninfo, no echo of DSN/host/credentials, no shell-outs.
```

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- One full-source-shaped upsert attempt; structured-error capture only;
-- ROLLBACK unconditional; NO COMMIT. Values are SYNTHETIC bind params (see §6),
-- supplied via the driver and NEVER printed.
BEGIN;
  SET LOCAL statement_timeout = '5s';
  SET LOCAL idle_in_transaction_session_timeout = '5s';
  SET LOCAL lock_timeout = '2s';

  INSERT INTO session_behavioural_features_v0_2 (
    workspace_id, site_id, session_id, feature_version, extracted_at,
    first_seen_at, last_seen_at,
    source_event_count, source_event_id_min, source_event_id_max,
    first_event_id, last_event_id,
    ms_from_consent_to_first_cta,
    dwell_ms_before_first_action,
    first_form_start_precedes_first_cta,
    form_start_count_before_first_cta,
    has_form_submit_without_prior_form_start,
    form_submit_count_before_first_form_start,
    ms_between_pageviews_p50,
    pageview_burst_count_10s,
    max_events_per_second,
    sub_200ms_transition_count,
    interaction_density_bucket,
    scroll_depth_bucket_before_first_cta,
    refresh_loop_candidate,
    refresh_loop_count,
    same_path_repeat_count,
    same_path_repeat_max_span_ms,
    same_path_repeat_min_delta_ms,
    same_path_repeat_median_delta_ms,
    repeat_pageview_candidate_count,
    refresh_loop_source,
    valid_feature_count,
    missing_feature_count,
    feature_presence_map,
    feature_source_map
  )
  VALUES (
    -- 36 bind parameters $1..$36, SYNTHETIC values only (see §6), never printed.
    -- TEXT arbiter cols ($1..$4) use namespaced fake sentinels; numeric cols
    -- satisfy non-negativity CHECKs; jsonb maps use '{}'::jsonb; timestamps NOW().
    $1, $2, $3, $4, $5,
    $6, $7,
    $8, $9, $10,
    $11, $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21,
    $22,
    $23,
    $24,
    $25,
    $26,
    $27,
    $28,
    $29,
    $30,
    $31,
    $32,
    $33,
    $34,
    $35,
    $36
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
  RETURNING behavioural_features_id, workspace_id, site_id, session_id;
ROLLBACK;
```

```text
# CANDIDATE ONLY — DO NOT RUN — driver pseudocode (sanitized output only)
connect(app_dsn)            # never print dsn; same app role as extractor
begin()
try:
  set_local timeouts (statement / idle_in_transaction / lock)
  execute(one full-shape upsert above, synthetic bind params $1..$36)  # never print params
  outcome = "success"       # unexpected but possible; still rolled back
except PgError as e:
  outcome = "error"
  record only: e.code, e.severity, e.routine,
               present-booleans for e.schema/e.table/e.column/e.constraint/
               e.detail/e.hint/e.where ; message_redacted = true
finally:
  rollback()                # unconditional; NEVER commit
  emit_jsonl(sanitized schema per §7)   # booleans / structural error fields only
# Abort immediately on any secret/raw-data exposure risk (see §8).
```

---

## 5. Full-Shape Fidelity Requirement

- The Stage 2b attempt **must mirror the full extractor terminal upsert shape**:
  - full **36** insert columns,
  - full **32** update assignments,
  - the **same** conflict arbiter `(workspace_id, site_id, session_id, feature_version)`,
  - the **same** returning columns `(behavioural_features_id, workspace_id, site_id, session_id)`.
- A **reduced-column upsert is a stop-line** — it can exercise a **different**
  privilege surface and produce a misleading result.
- The future driver must **build from the verified source shape** (re-read at
  execution time), **not** from a hand-trimmed subset.

---

## 6. Data Approach

- **Preferred — safe synthetic fixtures** (feasible: arbiter cols are `TEXT`,
  no FK, CHECKs are numeric `>= 0` only):
  - synthetic values only; **namespaced fake sentinels** (not real-looking);
  - **not printed**; rollback-contained;
  - must satisfy column types and constraints (TEXT arbiter; numeric `>= 0`;
    `jsonb` maps `'{}'::jsonb`; timestamps `NOW()`);
  - if a full-shape synthetic construction is **not** possible, **stop** and
    record a **BLOCKED** evidence PR instead.
- **Alternative — source-derived values used internally only:** may be used
  **inside** the SQL but **never printed**; output stays aggregate / boolean /
  error-field only. If internal source-derived values would risk exposure,
  **stop**.

---

## 7. JSONL Evidence Schema (corrected DML wording)

> Do **not** include `"no_grant_dml_ddl": true`. Stage 2b runs a
> rollback-contained DML-shaped attempt; use the corrected fields below.

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

(For an unexpected `success` outcome, `outcome` becomes `"success"` and the
`error` object may be omitted; `rolled_back=true` and `commit_used=false` still
hold.)

---

## 8. Stop-Lines (abort future execution if ANY is true)

- the source shape cannot be re-verified at execution time;
- the full **36 / 32** shape cannot be mirrored;
- synthetic values cannot safely satisfy the full source shape;
- more than one attempt would be required;
- the transaction cannot guarantee rollback;
- any `COMMIT` path exists;
- DSN / password / token would be printed;
- raw identifiers would be printed;
- raw row values would be printed (including RETURNING output values);
- payload / customer data would be printed;
- a broad grant would be required first;
- extractor / worker / downstream runtime would run;
- Lane A/B, scoring, AMS Trust/Pass, customer output, Gate 4E, or Gate 4F would
  be touched.

---

## 9. What This PR Does Not Authorize

- no Stage 2b execution;
- no SQL execution;
- no production command;
- no GRANT / DML / DDL execution;
- no grant / fix;
- no extractor rerun;
- no worker / downstream runtime;
- no Lane A/B;
- no scoring runtime;
- no AMS Trust / Pass runtime;
- no customer output;
- no Gate 4E / Gate 4F.

---

## 10. Next Step

1. **Codex narrow review** of this command-pack artifact PR.
2. **Merge only if PASS.**
3. Only after merge may Helen issue the exact Stage 2b GO phrase
   (`HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO`).
4. Execution must produce a **separate docs-only evidence PR** (per the §7
   schema; sanitized; no raw values/secrets).

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
`session_id` / `request_id` / `workspace_id` / `site_id` references are
**column names** or stop-line / boundary language only — never values. SQL bind
parameters are shown as positional placeholders (`$1`..`$36`) with no literals.
