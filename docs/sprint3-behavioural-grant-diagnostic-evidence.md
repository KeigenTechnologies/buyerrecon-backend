# Sprint 3: Behavioural Output Grant — Diagnostic Evidence

**Status:** `BEHAVIOURAL_GRANT_DIAGNOSTIC_EVIDENCE_COMPLETE`

This is a **docs-only diagnostic evidence record**. It captures the result
of the read-only, transaction-rolled-back catalog privilege probes planned
in PR #137 and authorized by explicit Helen diagnostic GO.

This record **does not apply any fix**, **does not authorize GRANT/DML/DDL**,
**does not authorize extractor rerun**, and **does not authorize workers or
downstream runtime**. It records boolean privilege facts only.

---

## 1. Authorization & Provenance

- PR #137 (diagnostic plan) was merged.
  - Merge commit: `56f9ebde4900067a4f48ac5f8d1306f478d79313`
  - It planned read-only catalog privilege probes to explain why the
    PR #134 / PR #135 grant fix still did not satisfy the extractor path.
- Helen diagnostic GO was present:
  `HELEN BEHAVIOURAL GRANT DIAGNOSTIC GO: run the planned read-only, transaction-rolled-back catalog privilege probes for public.session_behavioural_features_v0_2, booleans only, no row reads, no extractor rerun, no worker, no GRANT/DML/DDL, no downstream runtime, no customer/raw data output, no Gate 4E, and no Gate 4F.`
- The diagnostic was run on production as **read-only only**, inside a
  `BEGIN; … ROLLBACK;` block.

---

## 2. Diagnostic Evidence (verbatim labelled output)

```text
REPO_GATE|pr137_merge_present=true|merge_commit=56f9ebd
APP_DSN_loaded=true
DB_GATE|db_name=buyerrecon_production
BEGIN
ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
ROLE_GATE_ASSERTIONS|role_ok=true|database_ok=true|read_only_ok=true
SBF_TABLE_PRIVILEGES|table_select=false|table_insert=false|table_update=false|table_delete=false|table_truncate=false|table_references=false|table_trigger=false
SBF_COLUMN_INSERT_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|feature_version=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|session_id=true|site_id=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true|workspace_id=true
SBF_COLUMN_UPDATE_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true
SBF_COLUMN_SELECT_PRIVILEGES|behavioural_features_id=true|feature_version=true|session_id=true|site_id=true|workspace_id=true
SBF_SEQUENCE_PRIVILEGES|sequence=public.session_behavioural_features_v0_2_behavioural_features_id_seq|usage=true|select=false
SBF_CONFLICT_TARGET_SELECT_CHECK|workspace_id=true|site_id=true|session_id=true|feature_version=true
DIAGNOSTIC_ONLY|no_row_reads=true|no_grant_dml_ddl=true|no_extractor_rerun=true|no_worker_run=true|no_downstream_runtime=true
ROLLBACK
no_secret_printed=true
no_customer_raw_data_printed=true
no_gate_4e=true
no_gate_4f=true
```

---

## 3. Interpretation

- **Production DB verified:** `buyerrecon_production`.
- **App role verified:** `buyerrecon_prod_collector_app`.
- **Transaction read-only verified:** `on`.
- **Table-level privileges remain false** on
  `public.session_behavioural_features_v0_2`:
  `table_select=false`, `table_insert=false`, `table_update=false`,
  `table_delete=false`, `table_truncate=false`, `table_references=false`,
  `table_trigger=false`.
- **Column-scoped INSERT privileges are true** for all checked extractor
  insert columns (the 36 columns the extractor INSERT writes).
- **Column-scoped UPDATE privileges are true** for all checked extractor
  update columns (the 32 columns in the `DO UPDATE SET` clause).
- **Limited SELECT privileges are true** for: `behavioural_features_id`,
  `feature_version`, `session_id`, `site_id`, `workspace_id`.
- **Conflict-target SELECT privileges are true** for: `workspace_id`,
  `site_id`, `session_id`, `feature_version`.
- **Sequence privileges:** `USAGE=true`, `SELECT=false` on
  `public.session_behavioural_features_v0_2_behavioural_features_id_seq`.
- No row reads. No secrets. No GRANT/DML/DDL. No extractor rerun. No worker /
  downstream runtime. No Gate 4E / Gate 4F.

---

## 4. Conclusion (evidence-backed, not over-claimed)

- The evidence **confirms** the PR #134 / PR #135 column-scoped INSERT and
  UPDATE grants and the sequence `USAGE` grant are present, and that the
  proofed limited SELECT and conflict-target SELECT privileges are present.
- The evidence **confirms** table-level `SELECT` / `INSERT` / `UPDATE` (and
  `DELETE` / `TRUNCATE` / `REFERENCES` / `TRIGGER`) remain false.
- This means the earlier "incomplete column coverage" hypotheses (PR #137
  H1 / H2) are **not** supported: at the catalog level the role already holds
  column-scoped INSERT/UPDATE across the full extractor column set, plus the
  needed SELECT and sequence `USAGE`.
- Yet the authorized rerun (PR #136) still failed with
  `permission denied for table session_behavioural_features_v0_2`.
- **Next evidence-backed planning direction:** investigate a revised fix that
  may require **table-level `INSERT` and/or `UPDATE`** for this PostgreSQL
  `INSERT … ON CONFLICT … DO UPDATE … RETURNING` upsert path, given that full
  column-scoped grants did not satisfy it at runtime.

> This direction is **not** stated as fully proven. The catalog probes
> establish the current privilege state and rule out missing column grants;
> they do not by themselves prove the precise runtime cause. The revised
> grant-fix planning PR should confirm the exact requirement (e.g. via a
> planned, separately-authorized, rolled-back write-path reproduction) before
> any grant is proposed for execution.

No grant is proposed or executed in this evidence PR.

---

## 5. Non-Authorization

This diagnostic evidence PR does **not**:

- apply any fix,
- authorize any GRANT / DML / DDL,
- authorize extractor rerun,
- authorize workers or downstream runtime,
- authorize Stage 0, risk worker, POI worker, evidence snapshot, Lane
  preview, Lane writes, scoring runtime, AMS Trust/Pass runtime, customer
  output, Gate 4E, or Gate 4F.

---

## 6. Safety / Raw-Data Boundary

This record contains:

- No raw `accepted_events` rows.
- No raw behavioural rows.
- No raw identifiers, `session_id` / `request_id` values, or payloads.
- No DSN URI, password, bearer token, or API token values.
- No customer data.

All identifier references are column names / boolean privilege facts /
stop-line language only — not values.

### Non-evidence terminal paste artifacts

Garbled shell paste fragments appeared before the valid labelled output:

> `"; exit 1; } = "buyerrecon_production" ] || { echo "ERROR: wrong database - stop`
>
> `echo "no_gate_4f=true"data_printed=true"ime=true';ddl=true|no_extractor_rerun=tr`

These are treated **only** as terminal paste artifacts. They are **not**
included as evidence beyond this note. They contained no DSN, secret, raw
row, raw identifier, payload, or customer data, and they do not affect the
diagnostic interpretation.

---

## 7. Next Required Step

1. Prepare a **separate revised grant-fix planning PR** that uses this
   evidence to scope the minimal additional privilege (candidate-only).
2. Any revised fix requires: **Codex review**, **explicit Helen GO**, a
   **post-fix proof PR**, and a **new explicit extractor rerun GO** before
   any rerun.
3. No extractor rerun, grant, DML/DDL, worker, or downstream runtime is
   authorized until that chain is complete. Any future rerun must be a
   separate operator session with all approved stop-lines active.
