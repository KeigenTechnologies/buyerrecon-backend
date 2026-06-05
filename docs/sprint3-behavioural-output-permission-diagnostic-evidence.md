# Sprint 3 - Behavioural Output Permission Diagnostic Evidence

> **DOCS-ONLY DIAGNOSTIC EVIDENCE RECORD. THIS PR DOES NOT FIX.**
> This document records the read-only permission diagnostic evidence
> for `public.session_behavioural_features_v0_2` after the behavioural
> extractor failure recorded in PR #131. This PR applies no grant,
> performs no DML/DDL, does not rerun the extractor, runs no workers,
> writes no Lane rows, creates no customer output, opens no Gate 4E,
> and invents no Gate 4F. No DSN, password, token, raw row, raw
> identifier, payload, or customer data is recorded here.

---

## 1. Status

- **Status:** `BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED`
- **Planning source:** PR #132
  (`BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_GO_PLANNING`,
  merge commit `8d64f70882c5de227e253cdad6779c8b226fd3fc`)
- **Failure source:** PR #131
  (`BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`,
  merge commit `e7718901a0c16a5d201412e145fb8c1f34e77698`)
- **Target object:** `public.session_behavioural_features_v0_2`
- **Diagnostic role:** `buyerrecon_prod_collector_app`
- **Diagnostic database:** `buyerrecon_production`

The diagnostic confirms a privilege gap on
`public.session_behavioural_features_v0_2` for the extractor's existing
upsert path. This explains the PR #131 extractor failure:

```text
permission denied for table session_behavioural_features_v0_2
```

This evidence PR does not apply the fix and does not authorize an
extractor rerun.

---

## 2. Terminal Artifact Handling

A garbled terminal paste fragment appeared before the valid labelled
diagnostic output. It is excluded from the evidence body and is not
used for interpretation.

The artifact contained no DSN, secret, raw row, raw identifier,
payload, or customer data. It does not affect the diagnostic status or
interpretation below.

---

## 3. Valid Diagnostic Evidence

The following labelled output is the valid read-only diagnostic
evidence:

```text
REPO_GATE|pr132_merge_present=true|merge_commit=8d64f70
APP_DSN_loaded=true
DB_GATE|db_name=buyerrecon_production
BEGIN
ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
ROLE_GATE_ASSERTIONS|role_ok=true|database_ok=true|read_only_ok=true
SBF_TABLE_GATE|schema=public|table=session_behavioural_features_v0_2|table_exists=true
SBF_SCHEMA_USAGE|public_usage=true
SBF_TABLE_PRIVILEGES|select=false|insert=false|update=false|delete=false|truncate=false|references=false|trigger=false
SBF_COLUMN_INSERT_PRIVILEGES|dwell_ms_before_first_action=false|extracted_at=false|feature_presence_map=false|feature_source_map=false|feature_version=false|first_event_id=false|first_form_start_precedes_first_cta=false|first_seen_at=false|form_start_count_before_first_cta=false|form_submit_count_before_first_form_start=false|has_form_submit_without_prior_form_start=false|interaction_density_bucket=false|last_event_id=false|last_seen_at=false|max_events_per_second=false|missing_feature_count=false|ms_between_pageviews_p50=false|ms_from_consent_to_first_cta=false|pageview_burst_count_10s=false|refresh_loop_candidate=false|refresh_loop_count=false|refresh_loop_source=false|repeat_pageview_candidate_count=false|same_path_repeat_count=false|same_path_repeat_max_span_ms=false|same_path_repeat_median_delta_ms=false|same_path_repeat_min_delta_ms=false|scroll_depth_bucket_before_first_cta=false|session_id=false|site_id=false|source_event_count=false|source_event_id_max=false|source_event_id_min=false|sub_200ms_transition_count=false|valid_feature_count=false|workspace_id=false
SBF_COLUMN_UPDATE_PRIVILEGES|dwell_ms_before_first_action=false|extracted_at=false|feature_presence_map=false|feature_source_map=false|first_event_id=false|first_form_start_precedes_first_cta=false|first_seen_at=false|form_start_count_before_first_cta=false|form_submit_count_before_first_form_start=false|has_form_submit_without_prior_form_start=false|interaction_density_bucket=false|last_event_id=false|last_seen_at=false|max_events_per_second=false|missing_feature_count=false|ms_between_pageviews_p50=false|ms_from_consent_to_first_cta=false|pageview_burst_count_10s=false|refresh_loop_candidate=false|refresh_loop_count=false|refresh_loop_source=false|repeat_pageview_candidate_count=false|same_path_repeat_count=false|same_path_repeat_max_span_ms=false|same_path_repeat_median_delta_ms=false|same_path_repeat_min_delta_ms=false|scroll_depth_bucket_before_first_cta=false|source_event_count=false|source_event_id_max=false|source_event_id_min=false|sub_200ms_transition_count=false|valid_feature_count=false
SBF_COLUMN_SELECT_PRIVILEGES|behavioural_features_id=false|feature_version=false|session_id=false|site_id=false|workspace_id=false
SBF_SEQUENCE_DEFAULTS|behavioural_features_id_default_sequence=public.session_behavioural_features_v0_2_behavioural_features_id_seq|sequence_usage=false|sequence_select=false
SBF_CONSTRAINT_METADATA|natural_key_present=true|conflict_target=workspace_id,site_id,session_id,feature_version
ROLLBACK
no_row_reads=true
no_secret_printed=true
no_grant_dml_ddl=true
no_extractor_rerun=true
no_worker_run=true
no_downstream_runtime=true
```

Only safe status lines and boolean privilege results are recorded.
There are no row values.

---

## 4. Interpretation

The diagnostic confirms:

| Check | Result |
| --- | --- |
| PR #132 merge present on production checkout | `true` |
| Production DB | `buyerrecon_production` |
| App role | `buyerrecon_prod_collector_app` |
| Transaction read-only | `on` |
| Target table exists | `true` |
| Public schema usage | `true` |
| Natural key metadata present | `true` |
| Conflict target | `workspace_id,site_id,session_id,feature_version` |
| Table-level `SELECT` | `false` |
| Table-level `INSERT` | `false` |
| Table-level `UPDATE` | `false` |
| Sequence exists | `public.session_behavioural_features_v0_2_behavioural_features_id_seq` |
| Sequence `USAGE` | `false` |
| Sequence `SELECT` | `false` |

All checked extractor `INSERT` target columns returned `false`.

All checked extractor `UPDATE` assignment columns returned `false`.

The checked `RETURNING` / provenance / conflict-path `SELECT` columns
returned `false`:

- `behavioural_features_id`
- `workspace_id`
- `site_id`
- `session_id`
- `feature_version`

This confirms the app role lacks the table, column, and sequence
privileges needed to complete the extractor's existing
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` path.

---

## 5. Safety Confirmation

The diagnostic evidence confirms:

- no row reads
- no secrets printed
- no GRANT, DML, or DDL run
- no extractor rerun
- no worker run
- no downstream runtime

This PR records evidence only. It does not apply a fix and does not
authorize a fix.

---

## 6. Boundary / Non-Authorization

This PR does **not** authorize:

- any GRANT
- any DML or DDL
- extractor rerun
- worker execution
- Stage 0
- risk worker
- POI worker
- evidence snapshot
- Lane preview
- Lane writes
- customer output
- scoring runtime
- AMS Trust / Pass runtime
- Gate 4E
- Gate 4F

No downstream path is opened by this evidence record.

---

## 7. Required Next Step

The next required step is a separate grant-fix planning PR.

That grant-fix planning PR must:

1. Use this diagnostic evidence.
2. Re-check the existing extractor code path.
3. Propose a least-privilege candidate fix only.
4. Avoid broad table privilege unless justified by PostgreSQL behavior
   and the extractor's exact upsert requirements.
5. Avoid customer-output, Lane, scoring, AMS, Gate 4E, and Gate 4F
   authorization.

Applying any fix requires a separate explicit Helen GO after review.

After any fix is applied, a separate post-fix proof PR is required
before any extractor rerun GO.

The extractor must not be rerun until:

1. this diagnostic evidence PR is reviewed and merged
2. a grant-fix planning PR is reviewed
3. Helen gives explicit GO to apply the fix
4. the fix is applied
5. post-fix proof is recorded and reviewed
6. a new explicit extractor rerun GO is given

Only then may one extractor rerun attempt occur.

---

## 8. Machine-Readable Block

```yaml
status: BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED
planning_source_pr: 132
planning_merge_commit: 8d64f70882c5de227e253cdad6779c8b226fd3fc
failure_source_pr: 131
failure_merge_commit: e7718901a0c16a5d201412e145fb8c1f34e77698
target_table: public.session_behavioural_features_v0_2
diagnostic_database: buyerrecon_production
diagnostic_role: buyerrecon_prod_collector_app
transaction_read_only: on
table_exists: true
public_schema_usage: true
natural_key_present: true
conflict_target: workspace_id,site_id,session_id,feature_version
table_select: false
table_insert: false
table_update: false
table_delete: false
table_truncate: false
table_references: false
table_trigger: false
all_checked_insert_columns: false
all_checked_update_columns: false
returning_select_behavioural_features_id: false
returning_select_workspace_id: false
returning_select_site_id: false
returning_select_session_id: false
returning_select_feature_version: false
identity_sequence: public.session_behavioural_features_v0_2_behavioural_features_id_seq
sequence_usage: false
sequence_select: false
diagnostic_only: true
grant_applied_by_this_pr: false
grant_authorised_by_this_pr: false
dml_ddl_run_by_this_pr: false
extractor_rerun_by_this_pr: false
extractor_rerun_authorised_by_this_pr: false
worker_run_by_this_pr: false
downstream_runtime_by_this_pr: false
row_reads: false
secret_output: false
raw_customer_data_output: false
next_step: separate_grant_fix_planning_pr
explicit_helen_go_required_before_fix: true
post_fix_proof_required_before_rerun_go: true
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
```

---

## 9. Secret / Raw Data Boundary

This document contains no DSN, password, token, raw row values,
customer data, raw accepted_events payloads, raw identifiers, raw
`session_id` values, or raw `request_id` values.

References to `session_id` are column names in privilege evidence,
not session identifier values.
