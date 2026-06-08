# Sprint 3 - Behavioural Output Grant Fix Proof

> **DOCS-ONLY POST-FIX PROOF RECORD. THIS PR DOES NOT RERUN THE
> EXTRACTOR.** This document records the production proof for the
> reviewed least-privilege grant fix on
> `public.session_behavioural_features_v0_2`. This PR runs no
> production command, applies no grant, performs no DML/DDL, does not
> rerun the extractor, runs no workers, writes no Lane rows, creates
> no customer output, opens no Gate 4E, and invents no Gate 4F. No
> DSN, password, token, raw row, raw identifier, payload, or customer
> data is recorded here.

---

## 1. Status

- **Status:** `BEHAVIOURAL_OUTPUT_GRANT_FIX_APPLIED_PROOF_PASS`
- **Planning source:** PR #134
  (`BEHAVIOURAL_OUTPUT_GRANT_FIX_PLANNING`,
  merge commit `bfdcb0274edabc12d6c54a150eec01a7b7204f97`)
- **Failure source:** PR #131
  (`BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`,
  merge commit `e7718901a0c16a5d201412e145fb8c1f34e77698`)
- **Target table:** `public.session_behavioural_features_v0_2`
- **Target role:** `buyerrecon_prod_collector_app`
- **Production DB:** `buyerrecon_production`

Helen GO was present:

```text
HELEN BEHAVIOURAL OUTPUT GRANT FIX GO: apply the reviewed least-privilege grant fix for public.session_behavioural_features_v0_2 to buyerrecon_prod_collector_app now
```

The reviewed PR #134 least-privilege grant fix was applied and
proofed. This proof PR does not authorize extractor rerun. The next
step after review and merge is a separate explicit extractor rerun GO.

---

## 2. Pre-Fix Gates

The operator session recorded safe pre-fix gates:

```text
REPO_GATE|pr134_merge_present=true|merge_commit=bfdcb02
APP_DSN_loaded=true
DB_GATE|db_name=buyerrecon_production
ADMIN_GATE|current_user=postgres|current_database=buyerrecon_production|transaction_read_only=off
APP_ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
```

Interpretation:

- PR #134 merge was present on the production checkout.
- App DSN was loaded without printing the DSN.
- Production DB was verified as `buyerrecon_production`.
- The grant execution role was `postgres`.
- The app role gate verified `buyerrecon_prod_collector_app` against
  `buyerrecon_production` in a read-only app-role check.

---

## 3. Grant Execution Evidence

The grant execution output was:

```text
BEGIN
FIX_GATE|current_user=postgres|current_database=buyerrecon_production
GRANT
GRANT
GRANT
GRANT
COMMIT
```

Interpretation:

1. The reviewed least-privilege fix was applied.
2. Four grant statements were applied:
   - column-scoped `INSERT`
   - column-scoped `UPDATE`
   - limited column-scoped `SELECT`
   - sequence `USAGE`
3. No table-wide `SELECT`, `INSERT`, or `UPDATE` grant was applied.
4. No sequence `SELECT` grant was applied.
5. No `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` grant was
   applied.
6. No Lane, scoring, customer-output, AMS, Gate 4E, or Gate 4F
   privilege was applied.
7. No extractor rerun was performed.

---

## 4. Terminal Artifact Handling

A garbled terminal paste fragment appeared before the valid labelled
post-fix proof output. It is excluded from the evidence body and is
not used for interpretation.

The artifact contained no DSN, secret, raw row, raw identifier,
payload, or customer data. It did not affect the proof interpretation.

---

## 5. Post-Fix Proof Evidence

The post-fix proof was run as `buyerrecon_prod_collector_app` in
`buyerrecon_production` under a read-only proof transaction.

Valid labelled proof output:

```text
BEGIN
POST_FIX_ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
POST_FIX_TABLE_PRIVILEGES|select=false|insert=false|update=false|delete=false|truncate=false|references=false|trigger=false
POST_FIX_COLUMN_INSERT_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|feature_version=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|session_id=true|site_id=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true|workspace_id=true
POST_FIX_COLUMN_UPDATE_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true
POST_FIX_COLUMN_SELECT_PRIVILEGES|behavioural_features_id=true|feature_version=true|session_id=true|site_id=true|workspace_id=true
POST_FIX_SEQUENCE_PRIVILEGES|sequence=public.session_behavioural_features_v0_2_behavioural_features_id_seq|usage=true|select=false
POST_FIX_NO_ROW_READS|confirmed=true
ROLLBACK
no_row_reads=true
no_secret_printed=true
no_grant_dml_ddl_after_fix=true
no_extractor_rerun=true
no_worker_run=true
no_downstream_runtime=true
```

Only safe status lines and boolean privilege results are recorded.
There are no row values.

---

## 6. Proof Interpretation

The post-fix proof confirms:

| Check | Result |
| --- | --- |
| App role | `buyerrecon_prod_collector_app` |
| Production DB | `buyerrecon_production` |
| Transaction read-only | `on` |
| Table-wide `SELECT` | `false` |
| Table-wide `INSERT` | `false` |
| Table-wide `UPDATE` | `false` |
| Table-wide `DELETE` | `false` |
| Table-wide `TRUNCATE` | `false` |
| Table-wide `REFERENCES` | `false` |
| Table-wide `TRIGGER` | `false` |
| Intended column `INSERT` privileges | `true` |
| Intended column `UPDATE` privileges | `true` |
| Limited column `SELECT` privileges | `true` |
| Sequence `USAGE` | `true` |
| Sequence `SELECT` | `false` |
| Row reads | `false` |
| Extractor rerun | `false` |
| Worker run | `false` |
| Downstream runtime | `false` |

The intended limited `SELECT` columns are true:

- `behavioural_features_id`
- `feature_version`
- `session_id`
- `site_id`
- `workspace_id`

The proof confirms no broad table-level privilege expansion. It also
confirms the sequence `USAGE` privilege needed for the
`BIGSERIAL`/`nextval` path while preserving sequence `SELECT=false`.

---

## 7. Safety Confirmation

The proof confirms:

- no row reads
- no secrets printed
- no GRANT, DML, or DDL after the fix
- no extractor rerun
- no worker run
- no downstream runtime
- no Lane, scoring, customer-output, AMS, Gate 4E, or Gate 4F
  privileges

This PR records proof only. It does not authorize extractor rerun.

---

## 8. Boundary / Non-Authorization

This PR does **not** authorize:

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
- additional GRANT, DML, or DDL

No downstream path is opened by this proof record.

---

## 9. Next Step

The next step after this proof PR is reviewed and merged is a separate
explicit extractor rerun GO.

This proof PR alone does not authorize the behavioural extractor to
run.

Any future rerun must be a separate operator session with all approved stop-lines active.

---

## 10. Machine-Readable Block

```yaml
status: BEHAVIOURAL_OUTPUT_GRANT_FIX_APPLIED_PROOF_PASS
helen_go_phrase: "HELEN BEHAVIOURAL OUTPUT GRANT FIX GO: apply the reviewed least-privilege grant fix for public.session_behavioural_features_v0_2 to buyerrecon_prod_collector_app now"
planning_source_pr: 134
planning_merge_commit: bfdcb0274edabc12d6c54a150eec01a7b7204f97
target_table: public.session_behavioural_features_v0_2
target_role: buyerrecon_prod_collector_app
production_database: buyerrecon_production
grant_execution_role: postgres
grant_execution_committed: true
grant_statement_count: 4
column_insert_grant_applied: true
column_update_grant_applied: true
limited_column_select_grant_applied: true
sequence_usage_grant_applied: true
table_wide_select: false
table_wide_insert: false
table_wide_update: false
table_wide_delete: false
table_wide_truncate: false
table_wide_references: false
table_wide_trigger: false
sequence_usage: true
sequence_select: false
limited_select_behavioural_features_id: true
limited_select_feature_version: true
limited_select_session_id: true
limited_select_site_id: true
limited_select_workspace_id: true
post_fix_proof_role: buyerrecon_prod_collector_app
post_fix_proof_read_only: true
row_reads: false
secret_output: false
grant_dml_ddl_after_fix: false
extractor_rerun_by_this_pr: false
extractor_rerun_authorised_by_this_pr: false
worker_run_by_this_pr: false
downstream_runtime_by_this_pr: false
lane_scoring_customer_ams_gate_privileges_applied: false
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
next_step: separate_explicit_extractor_rerun_go
```

---

## 11. Secret / Raw Data Boundary

This document contains no DSN, password, token, raw row values,
customer data, raw accepted_events payloads, raw identifiers, raw
`session_id` values, or raw `request_id` values.

References to `session_id` are column names in privilege evidence,
not session identifier values.
