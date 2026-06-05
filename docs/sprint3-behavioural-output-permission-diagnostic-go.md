# Sprint 3 - Behavioural Output Permission Diagnostic / Grant-Fix Planning (Docs-Only)

> **DOCS-ONLY PERMISSION DIAGNOSTIC AND GRANT-FIX PLANNING
> RECORD. THIS PR DOES NOT EXECUTE.** It plans the next step after
> the behavioural extractor failed with `permission denied for table
> session_behavioural_features_v0_2`. This PR runs no production
> command, runs no diagnostic, applies no grant, performs no
> DML/DDL, does not rerun the extractor, runs no workers, writes no
> Lane rows, creates no customer output, opens no Gate 4E, and
> invents no Gate 4F. No DSN, password, token, raw identifier,
> payload, or customer data is recorded here.

---

## 1. Status

- **Status:** `BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_GO_PLANNING`
- **Failure source:** PR #131
  (`BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`,
  merge commit `e7718901a0c16a5d201412e145fb8c1f34e77698`)
- **Failed table:** `public.session_behavioural_features_v0_2`
- **Failed role:** `buyerrecon_prod_collector_app`

The behavioural extractor failed because
`buyerrecon_prod_collector_app` lacks required privilege on
`public.session_behavioural_features_v0_2`. This PR only plans a
read-only permission diagnostic and the governance posture for any
later grant/fix. It does not fix the privilege gap and does not
authorize an extractor rerun.

---

## 2. Problem Statement

PR #131 recorded one production behavioural extractor attempt:

```text
DATABASE_URL="$APP_DSN" npm run extract:behavioural-features
```

The run exited with code `1`:

```text
permission denied for table session_behavioural_features_v0_2
```

The non-zero-exit stop-line triggered. No rerun was attempted. No
ad hoc grant, GRANT, DML, or DDL was run after the failure.

The next step is to determine the minimum privileges required by the
existing extractor's upsert path before proposing any fix.

---

## 3. Local Code / Schema Basis

Local repo inspection shows the existing extractor writes to
`session_behavioural_features_v0_2` using a single idempotent upsert:

```text
INSERT INTO session_behavioural_features_v0_2 (...)
ON CONFLICT (workspace_id, site_id, session_id, feature_version)
DO UPDATE SET ...
RETURNING behavioural_features_id, workspace_id, site_id, session_id
```

The table definition in `src/db/schema.sql` includes:

| Object | Detail |
| --- | --- |
| Table | `public.session_behavioural_features_v0_2` |
| Primary key | `behavioural_features_id BIGSERIAL PRIMARY KEY` |
| Natural key | `UNIQUE (workspace_id, site_id, session_id, feature_version)` |
| Extractor package command | `npm run extract:behavioural-features` |
| Extractor script | `scripts/extract-behavioural-features.ts` |

Because the extractor uses `INSERT ... ON CONFLICT DO UPDATE ...
RETURNING`, the diagnostic must not assume that a single table-level
privilege is sufficient. It must identify the precise missing table,
column, conflict-target, returning-column, and sequence/default
privileges needed by PostgreSQL for this upsert path.

---

## 4. Diagnostic Objective

The later operator diagnostic must determine exactly which privileges
are missing for `buyerrecon_prod_collector_app` on
`public.session_behavioural_features_v0_2`.

The diagnostic must check, safely and without row reads:

1. Role, database, and read-only transaction gate.
2. Schema usage on `public`.
3. Table-level privileges on
   `public.session_behavioural_features_v0_2`, including `SELECT`,
   `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and
   `TRIGGER`.
4. Column-level `INSERT` privilege for every column listed in the
   extractor's `INSERT INTO` target column list.
5. Column-level `UPDATE` privilege for every column assigned in the
   extractor's `ON CONFLICT DO UPDATE SET` clause.
6. Column-level `SELECT` privilege needed by PostgreSQL for
   `RETURNING behavioural_features_id, workspace_id, site_id,
   session_id` and any conflict/update semantics that require reads.
7. Sequence/default privilege for the `BIGSERIAL` primary key backing
   `behavioural_features_id`, if present.
8. The owner and privilege state of relevant indexes/constraints only
   as metadata, not by selecting data rows.

The diagnostic must not read table rows and must not print any
behavioural feature row data, raw accepted_events data, raw
identifiers, payloads, DSNs, secrets, or customer data.

---

## 5. Read-Only Diagnostic Plan

The following is a planned future operator diagnostic. It must not be
run by this PR. It must run only after this planning PR is reviewed
and merged.

```bash
set -euo pipefail

cd /opt/buyerrecon-backend

export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN_loaded=true" || { echo "ERROR: APP_DSN not loaded - stop"; exit 1; }

DB_NAME="$(
  DATABASE_URL="$APP_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log(u.pathname.replace(/^\\//, ''));
"
)"

echo "db_name: ${DB_NAME}"
[ "$DB_NAME" = "buyerrecon_production" ] || { echo "ERROR: wrong database - stop"; exit 1; }

psql -v ON_ERROR_STOP=1 --no-password --tuples-only --no-align -d "$APP_DSN" <<'SQL'
BEGIN READ ONLY;

SELECT
  'ROLE_GATE'
  || '|' || current_user
  || '|' || current_database()
  || '|' || current_setting('transaction_read_only') AS role_gate;

SELECT
  'SCHEMA_USAGE'
  || '|public_usage=' || has_schema_privilege(current_user, 'public', 'USAGE')
  AS schema_usage;

SELECT
  'SBF_TABLE_PRIVS'
  || '|select=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'SELECT')
  || '|insert=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'INSERT')
  || '|update=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'UPDATE')
  || '|delete=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'DELETE')
  || '|truncate=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'TRUNCATE')
  || '|references=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'REFERENCES')
  || '|trigger=' || has_table_privilege(current_user, 'public.session_behavioural_features_v0_2', 'TRIGGER')
  AS sbf_table_privs;

SELECT
  'SBF_INSERT_COLS'
  || '|workspace_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'workspace_id', 'INSERT')
  || '|site_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'site_id', 'INSERT')
  || '|session_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'session_id', 'INSERT')
  || '|feature_version=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'feature_version', 'INSERT')
  || '|extracted_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'extracted_at', 'INSERT')
  || '|first_seen_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_seen_at', 'INSERT')
  || '|last_seen_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'last_seen_at', 'INSERT')
  || '|source_event_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_count', 'INSERT')
  || '|source_event_id_min=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_id_min', 'INSERT')
  || '|source_event_id_max=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_id_max', 'INSERT')
  || '|first_event_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_event_id', 'INSERT')
  || '|last_event_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'last_event_id', 'INSERT')
  || '|ms_from_consent_to_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'ms_from_consent_to_first_cta', 'INSERT')
  || '|dwell_ms_before_first_action=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'dwell_ms_before_first_action', 'INSERT')
  || '|first_form_start_precedes_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_form_start_precedes_first_cta', 'INSERT')
  || '|form_start_count_before_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'form_start_count_before_first_cta', 'INSERT')
  || '|has_form_submit_without_prior_form_start=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'has_form_submit_without_prior_form_start', 'INSERT')
  || '|form_submit_count_before_first_form_start=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'form_submit_count_before_first_form_start', 'INSERT')
  || '|ms_between_pageviews_p50=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'ms_between_pageviews_p50', 'INSERT')
  || '|pageview_burst_count_10s=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'pageview_burst_count_10s', 'INSERT')
  || '|max_events_per_second=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'max_events_per_second', 'INSERT')
  || '|sub_200ms_transition_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'sub_200ms_transition_count', 'INSERT')
  || '|interaction_density_bucket=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'interaction_density_bucket', 'INSERT')
  || '|scroll_depth_bucket_before_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'scroll_depth_bucket_before_first_cta', 'INSERT')
  || '|refresh_loop_candidate=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_candidate', 'INSERT')
  || '|refresh_loop_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_count', 'INSERT')
  || '|same_path_repeat_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_count', 'INSERT')
  || '|same_path_repeat_max_span_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_max_span_ms', 'INSERT')
  || '|same_path_repeat_min_delta_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_min_delta_ms', 'INSERT')
  || '|same_path_repeat_median_delta_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_median_delta_ms', 'INSERT')
  || '|repeat_pageview_candidate_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'repeat_pageview_candidate_count', 'INSERT')
  || '|refresh_loop_source=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_source', 'INSERT')
  || '|valid_feature_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'valid_feature_count', 'INSERT')
  || '|missing_feature_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'missing_feature_count', 'INSERT')
  || '|feature_presence_map=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'feature_presence_map', 'INSERT')
  || '|feature_source_map=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'feature_source_map', 'INSERT')
  AS sbf_insert_cols;

SELECT
  'SBF_UPDATE_COLS'
  || '|extracted_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'extracted_at', 'UPDATE')
  || '|first_seen_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_seen_at', 'UPDATE')
  || '|last_seen_at=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'last_seen_at', 'UPDATE')
  || '|source_event_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_count', 'UPDATE')
  || '|source_event_id_min=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_id_min', 'UPDATE')
  || '|source_event_id_max=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'source_event_id_max', 'UPDATE')
  || '|first_event_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_event_id', 'UPDATE')
  || '|last_event_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'last_event_id', 'UPDATE')
  || '|ms_from_consent_to_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'ms_from_consent_to_first_cta', 'UPDATE')
  || '|dwell_ms_before_first_action=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'dwell_ms_before_first_action', 'UPDATE')
  || '|first_form_start_precedes_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'first_form_start_precedes_first_cta', 'UPDATE')
  || '|form_start_count_before_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'form_start_count_before_first_cta', 'UPDATE')
  || '|has_form_submit_without_prior_form_start=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'has_form_submit_without_prior_form_start', 'UPDATE')
  || '|form_submit_count_before_first_form_start=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'form_submit_count_before_first_form_start', 'UPDATE')
  || '|ms_between_pageviews_p50=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'ms_between_pageviews_p50', 'UPDATE')
  || '|pageview_burst_count_10s=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'pageview_burst_count_10s', 'UPDATE')
  || '|max_events_per_second=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'max_events_per_second', 'UPDATE')
  || '|sub_200ms_transition_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'sub_200ms_transition_count', 'UPDATE')
  || '|interaction_density_bucket=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'interaction_density_bucket', 'UPDATE')
  || '|scroll_depth_bucket_before_first_cta=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'scroll_depth_bucket_before_first_cta', 'UPDATE')
  || '|refresh_loop_candidate=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_candidate', 'UPDATE')
  || '|refresh_loop_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_count', 'UPDATE')
  || '|same_path_repeat_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_count', 'UPDATE')
  || '|same_path_repeat_max_span_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_max_span_ms', 'UPDATE')
  || '|same_path_repeat_min_delta_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_min_delta_ms', 'UPDATE')
  || '|same_path_repeat_median_delta_ms=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'same_path_repeat_median_delta_ms', 'UPDATE')
  || '|repeat_pageview_candidate_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'repeat_pageview_candidate_count', 'UPDATE')
  || '|refresh_loop_source=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'refresh_loop_source', 'UPDATE')
  || '|valid_feature_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'valid_feature_count', 'UPDATE')
  || '|missing_feature_count=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'missing_feature_count', 'UPDATE')
  || '|feature_presence_map=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'feature_presence_map', 'UPDATE')
  || '|feature_source_map=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'feature_source_map', 'UPDATE')
  AS sbf_update_cols;

SELECT
  'SBF_RETURNING_SELECT_COLS'
  || '|behavioural_features_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'behavioural_features_id', 'SELECT')
  || '|workspace_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'workspace_id', 'SELECT')
  || '|site_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'site_id', 'SELECT')
  || '|session_id=' || has_column_privilege(current_user, 'public.session_behavioural_features_v0_2', 'session_id', 'SELECT')
  AS sbf_returning_select_cols;

SELECT
  'SBF_IDENTITY_SEQUENCE'
  || '|sequence_name=' || COALESCE(pg_get_serial_sequence('public.session_behavioural_features_v0_2', 'behavioural_features_id'), '<none>')
  AS sbf_identity_sequence;

SELECT
  'SBF_SEQUENCE_PRIVS'
  || '|usage=' || COALESCE(has_sequence_privilege(current_user, pg_get_serial_sequence('public.session_behavioural_features_v0_2', 'behavioural_features_id'), 'USAGE')::text, 'n/a')
  || '|select=' || COALESCE(has_sequence_privilege(current_user, pg_get_serial_sequence('public.session_behavioural_features_v0_2', 'behavioural_features_id'), 'SELECT')::text, 'n/a')
  AS sbf_sequence_privs;

ROLLBACK;
SQL
```

The later diagnostic evidence PR must record only these status and
boolean lines. It must not include row data.

---

## 6. Safety Boundaries

| Boundary | Requirement |
| --- | --- |
| Diagnostic mode | Read-only first |
| Transaction wrapper | `BEGIN READ ONLY; ... ROLLBACK;` |
| Error handling | `psql -v ON_ERROR_STOP=1` |
| DSN/password/token printing | Forbidden |
| Row reads / customer data | Forbidden |
| Extractor run | Forbidden |
| Worker run | Forbidden |
| GRANT/DML/DDL in this PR | Forbidden |
| Stage 0 / risk / POI / evidence snapshot | Forbidden |
| Lane preview / Lane writes | Forbidden |
| Scoring / AMS / customer output | Forbidden |
| Gate 4E / Gate 4F | Not opened / not invented |

Stop immediately if the diagnostic would print secrets, raw data, row
data, raw identifiers, customer data, or if any command attempts to
rerun the extractor or apply a grant/fix.

---

## 7. Candidate Fix Posture

Any candidate GRANT must be labelled candidate only and must be
based on diagnostic evidence. This PR does not authorize any grant.

Fix posture:

1. Prefer the least privilege needed by the existing extractor path.
2. Do not assume broad table-wide privileges unless PostgreSQL
   behavior and the extractor's `INSERT ... ON CONFLICT DO UPDATE ...
   RETURNING` path require them.
3. Consider table, column, conflict-target, returning-column, and
   sequence/default privileges separately.
4. Do not authorize customer-output, Lane, scoring, AMS, Gate 4E, or
   Gate 4F activity.
5. Require a separate explicit Helen GO before applying any fix.
6. Require a separate post-fix proof PR before any extractor rerun GO.

No candidate grant should be executed from this planning PR.

---

## 8. Required Sequence

The required sequence from here is:

1. **PR #132 planning / diagnostic GO** - this PR.
2. **Operator diagnostic session** - read-only privilege diagnostic
   only.
3. **Diagnostic evidence PR** - docs-only evidence from the diagnostic.
4. **Grant-fix planning PR if needed** - candidate-only, least
   privilege.
5. **Explicit Helen GO to apply fix** - separate from merge.
6. **Post-fix proof PR** - proves exact privilege change and no broad
   privilege expansion.
7. **New explicit extractor rerun GO** - separate GO after proof.
8. **Only then one rerun attempt** - no direct rerun before all prior
   steps pass.

---

## 9. Machine-Readable Block

```yaml
status: BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_GO_PLANNING
failure_source_pr: 131
failure_status: BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED
failure_table: public.session_behavioural_features_v0_2
failure_role: buyerrecon_prod_collector_app
failure_message: permission_denied_for_table_session_behavioural_features_v0_2
diagnostic_run_by_this_pr: false
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_run_by_this_pr: false
production_command_run_by_this_pr: false
read_only_diagnostic_required_first: true
begin_read_only_rollback_required: true
psql_on_error_stop_required: true
no_row_reads_required: true
no_secret_output_required: true
candidate_grants_must_be_candidate_only: true
least_privilege_required: true
explicit_helen_go_required_before_fix: true
post_fix_proof_pr_required: true
new_extractor_rerun_go_required: true
stage0_authorised_by_this_pr: false
risk_worker_authorised_by_this_pr: false
poi_worker_authorised_by_this_pr: false
evidence_snapshot_authorised_by_this_pr: false
lane_preview_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
next_step: read_only_permission_diagnostic_then_evidence_pr
```

---

## 10. Hard Boundaries

This PR does **not**:

- run the permission diagnostic
- apply any grant or fix
- rerun the behavioural extractor
- run workers
- run Stage 0
- run risk worker
- run POI worker
- run evidence snapshot
- run Lane preview
- write Lane A/B
- run scoring runtime
- run AMS Trust / Pass runtime
- create customer output
- open Gate 4E
- invent Gate 4F
- change backend code, scripts, package files, migrations, schema,
  env files, deployment files, website files, AMS files, runtime
  files, worker files, Lane/scoring files, or customer-output
  artifacts
- reproduce DSNs, passwords, tokens, raw UUIDs, raw identifiers,
  raw `session_id` values, raw `request_id` values, IP addresses,
  user agents, raw rows, accepted_events row data, raw payloads,
  canonical_jsonb payloads, or customer data

It records behavioural output permission diagnostic and grant-fix
planning only.
