# Sprint 3 - Behavioural Output Grant-Fix Planning

> **DOCS-ONLY GRANT-FIX PLANNING RECORD. THIS PR DOES NOT
> EXECUTE.** This document plans a least-privilege candidate fix for
> the `public.session_behavioural_features_v0_2` permission gap
> confirmed by PR #133 after the extractor failure recorded by PR
> #131. This PR runs no production command, applies no GRANT,
> performs no DML/DDL, does not rerun the extractor, runs no workers,
> writes no Lane rows, creates no customer output, opens no Gate 4E,
> and invents no Gate 4F. No DSN, password, token, raw row, raw
> identifier, payload, or customer data is recorded here.

---

## 1. Status

- **Status:** `BEHAVIOURAL_OUTPUT_GRANT_FIX_PLANNING`
- **Failure evidence:** PR #131
  (`BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`,
  merge commit `e7718901a0c16a5d201412e145fb8c1f34e77698`)
- **Permission diagnostic evidence:** PR #133
  (`BEHAVIOURAL_OUTPUT_PERMISSION_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED`,
  merge commit `a9b71ef9c89f918a8c787f0e98f222f13d511d64`)
- **Target table:** `public.session_behavioural_features_v0_2`
- **Target role:** `buyerrecon_prod_collector_app`

PR #131 recorded the behavioural extractor failure:

```text
permission denied for table session_behavioural_features_v0_2
```

PR #133 confirmed the role, schema, and table exist, and confirmed a
privilege gap for the app role on
`public.session_behavioural_features_v0_2`.

This PR is planning only. It does not fix the privilege gap and does
not authorize an extractor rerun.

---

## 2. Evidence Basis

The PR #133 diagnostic confirmed:

| Evidence | Result |
| --- | --- |
| Database | `buyerrecon_production` |
| Role | `buyerrecon_prod_collector_app` |
| Transaction mode | `read_only=on` |
| Target table exists | `true` |
| Public schema usage | `true` |
| Natural key present | `true` |
| Natural key columns | `workspace_id,site_id,session_id,feature_version` |
| Table-level `SELECT` | `false` |
| Table-level `INSERT` | `false` |
| Table-level `UPDATE` | `false` |
| Checked column-level `INSERT` privileges | `false` |
| Checked column-level `UPDATE` privileges | `false` |
| Checked returning/provenance `SELECT` privileges | `false` |
| Sequence `USAGE` | `false` |
| Sequence `SELECT` | `false` |

The diagnostic also confirmed:

- no row reads
- no secrets printed
- no GRANT, DML, or DDL run
- no extractor rerun
- no worker run
- no downstream runtime

---

## 3. Extractor Path Basis

Local repo inspection shows the existing extractor uses a single
idempotent upsert:

```text
INSERT INTO session_behavioural_features_v0_2 (...)
ON CONFLICT (workspace_id, site_id, session_id, feature_version)
DO UPDATE SET ...
RETURNING behavioural_features_id, workspace_id, site_id, session_id
```

The natural key is:

```text
workspace_id,site_id,session_id,feature_version
```

The target sequence backing the `BIGSERIAL` primary key is:

```text
public.session_behavioural_features_v0_2_behavioural_features_id_seq
```

The candidate fix must be based on this exact path and must not grant
unrelated privileges.

---

## 4. Least-Privilege Design

Candidate posture:

1. **Schema usage:** no change proposed. PR #133 already showed
   `public_usage=true`.
2. **Table-wide grants:** avoid table-wide `SELECT`, `INSERT`, and
   `UPDATE` unless PostgreSQL behavior or a later reviewed proof shows
   column-scoped privileges are insufficient for this exact upsert.
3. **Column-level `INSERT`:** grant only the columns named in the
   extractor's `INSERT INTO` target list.
4. **Column-level `UPDATE`:** grant only the columns assigned by the
   extractor's `ON CONFLICT DO UPDATE SET` clause.
5. **Column-level `SELECT`:** grant only the columns needed for
   `RETURNING` and conflict/provenance semantics:
   `behavioural_features_id`, `workspace_id`, `site_id`,
   `session_id`, and `feature_version`.
6. **Sequence privilege:** grant sequence `USAGE` only for the
   `BIGSERIAL` default/`nextval` path.
7. **Sequence `SELECT`:** do not grant. The extractor does not call
   `currval`, does not select from the sequence, and returns
   `behavioural_features_id` through table `RETURNING`, which is
   covered by column-level `SELECT`.
8. **Denied privileges:** do not grant `DELETE`, `TRUNCATE`,
   `REFERENCES`, or `TRIGGER`.
9. **External surfaces:** do not grant Lane, scoring, customer-output,
   AMS, Gate 4E, or Gate 4F privileges.

If future proof demonstrates PostgreSQL requires a table-wide
`INSERT`, `UPDATE`, `SELECT`, or sequence `SELECT` grant for this path,
that must be handled by a revised planning/review cycle. It must not
be added ad hoc during an operator session.

---

## 5. Candidate SQL

The following SQL is a candidate plan only.

```sql
-- CANDIDATE ONLY - DO NOT RUN.
-- Requires Codex review plus explicit Helen GO before execution.
-- Not executed by this PR.
-- Intended database: buyerrecon_production.
-- Intended role: buyerrecon_prod_collector_app.

-- No schema grant proposed because PR #133 showed public_usage=true.
-- No table-wide SELECT/INSERT/UPDATE grant proposed in this candidate.
-- No DELETE/TRUNCATE/REFERENCES/TRIGGER grant proposed.
-- No sequence SELECT grant proposed.

GRANT INSERT (
  workspace_id,
  site_id,
  session_id,
  feature_version,
  extracted_at,
  first_seen_at,
  last_seen_at,
  source_event_count,
  source_event_id_min,
  source_event_id_max,
  first_event_id,
  last_event_id,
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
) ON TABLE public.session_behavioural_features_v0_2
TO buyerrecon_prod_collector_app;

GRANT UPDATE (
  extracted_at,
  first_seen_at,
  last_seen_at,
  source_event_count,
  source_event_id_min,
  source_event_id_max,
  first_event_id,
  last_event_id,
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
) ON TABLE public.session_behavioural_features_v0_2
TO buyerrecon_prod_collector_app;

GRANT SELECT (
  behavioural_features_id,
  workspace_id,
  site_id,
  session_id,
  feature_version
) ON TABLE public.session_behavioural_features_v0_2
TO buyerrecon_prod_collector_app;

GRANT USAGE
ON SEQUENCE public.session_behavioural_features_v0_2_behavioural_features_id_seq
TO buyerrecon_prod_collector_app;
```

This SQL must not be run from this PR.

---

## 6. Future Fix Execution Preconditions

Before any fix is applied:

1. This planning PR must be reviewed and merged.
2. The candidate SQL must pass narrow review.
3. Helen must provide a separate explicit GO to apply the fix.
4. The operator session must verify:
   - production DB is `buyerrecon_production`
   - role target is `buyerrecon_prod_collector_app`
   - DSN/password/token are not printed
   - no extractor command is attempted
   - no worker command is attempted
   - no Lane/scoring/customer/AMS/Gate command is attempted
5. Any deviation requires stopping and returning to review.

This PR itself satisfies none of those execution steps.

---

## 7. Post-Fix Proof Requirements

After any future fix is applied, a separate docs-only post-fix proof
PR is required before any extractor rerun GO.

That proof PR must show safe boolean/status evidence only:

1. The intended grants were applied.
2. No broad unrelated privileges were introduced.
3. The app role has exactly the needed table/column/sequence
   privileges for the extractor upsert path.
4. Column-level `INSERT` is true only for extractor insert columns.
5. Column-level `UPDATE` is true only for extractor update columns.
6. Column-level `SELECT` is true only for returning/provenance/conflict
   columns.
7. Sequence `USAGE` is true.
8. Sequence `SELECT` remains false unless a separately reviewed plan
   justified it.
9. No `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege was
   granted.
10. No Lane, scoring, customer-output, AMS, Gate 4E, or Gate 4F
    privilege was granted.
11. No extractor rerun occurred in the proof PR.
12. No raw data, row values, DSNs, passwords, or tokens were printed.

The proof PR must not select row data and must not run workers.

---

## 8. Rerun Gating

No extractor rerun may occur until:

1. this grant-fix planning PR is reviewed and merged
2. explicit Helen GO to apply the fix is given
3. the fix is applied
4. a post-fix proof PR is reviewed and merged
5. a new explicit extractor rerun GO is given

Only then may one extractor rerun attempt occur.

---

## 9. Boundary / Non-Authorization

This PR does **not** authorize:

- grant execution
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
- GRANT, DML, or DDL by this PR

No downstream path is opened by this planning record.

---

## 10. Machine-Readable Block

```yaml
status: BEHAVIOURAL_OUTPUT_GRANT_FIX_PLANNING
failure_source_pr: 131
failure_merge_commit: e7718901a0c16a5d201412e145fb8c1f34e77698
diagnostic_source_pr: 133
diagnostic_merge_commit: a9b71ef9c89f918a8c787f0e98f222f13d511d64
target_table: public.session_behavioural_features_v0_2
target_role: buyerrecon_prod_collector_app
candidate_only: true
candidate_sql_executed_by_this_pr: false
production_command_run_by_this_pr: false
grant_applied_by_this_pr: false
dml_ddl_run_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_run_by_this_pr: false
schema_usage_change_proposed: false
table_wide_select_proposed: false
table_wide_insert_proposed: false
table_wide_update_proposed: false
delete_truncate_references_trigger_proposed: false
sequence_usage_proposed: true
sequence_select_proposed: false
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
next_step: codex_review_then_explicit_helen_go_before_any_fix
```

---

## 11. Secret / Raw Data Boundary

This document contains no DSN, password, token, raw row values,
customer data, raw accepted_events payloads, raw identifiers, raw
`session_id` values, or raw `request_id` values.

References to `session_id` are column names only.
