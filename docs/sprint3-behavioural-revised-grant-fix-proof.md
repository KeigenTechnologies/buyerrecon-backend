# Sprint 3: Behavioural Output Revised Grant Fix — Post-Fix Proof

**Status:** `BEHAVIOURAL_REVISED_GRANT_FIX_PROOF_PASS`

This is a **docs-only post-fix proof record**. It records that the reviewed
revised grant fix planned in PR #139 was applied to
`public.session_behavioural_features_v0_2` for role
`buyerrecon_prod_collector_app` in `buyerrecon_production`, and that the
post-fix privilege state matches the intended least-privilege posture.

This proof PR **does not authorize an extractor rerun**. The next step after
this proof PR is reviewed and merged is a **separate explicit extractor rerun
GO**. This record runs no extractor, no worker, and no downstream runtime.

---

## 1. Authorization

- Helen revised grant fix GO was present:
  `HELEN BEHAVIOURAL REVISED GRANT FIX GO: apply the reviewed revised grant fix for public.session_behavioural_features_v0_2 to buyerrecon_prod_collector_app now. Apply only table-level INSERT and table-level UPDATE. Do not grant table-level SELECT. Do not grant sequence SELECT. Do not grant DELETE, TRUNCATE, REFERENCES, or TRIGGER. Do not rerun the extractor. Do not run workers, Stage 0, risk worker, POI worker, evidence snapshot, Lane preview, Lane writes, scoring runtime, AMS Trust/Pass runtime, customer output, Gate 4E, or Gate 4F.`

## 2. Planning Source

- PR #139 (revised grant-fix plan) was merged.
  - Merge commit: `4fe0d2dbd7e87d04f6d60652799b14183ff9b06d`
  - It planned the revised candidate: table-level INSERT + table-level
    UPDATE only; no table-level SELECT; no sequence SELECT; no
    DELETE/TRUNCATE/REFERENCES/TRIGGER; no Lane/scoring/customer/AMS/Gate
    privileges.

This proof records that the **reviewed PR #139 revised fix was applied**.

---

## 3. Revised Fix Execution Evidence

```text
REPO_GATE|pr139_merge_present=true|merge_commit=4fe0d2d
APP_DSN_loaded=true
DB_GATE|db_name=buyerrecon_production
ADMIN_GATE|current_user=postgres|current_database=buyerrecon_production|transaction_read_only=off
APP_ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
BEGIN
REVISED_FIX_GATE|current_user=postgres|current_database=buyerrecon_production
GRANT
GRANT
COMMIT
```

Interpretation of execution:

- Exactly **two** `GRANT` lines were produced, followed by `COMMIT`.
- Only **table-level INSERT** and **table-level UPDATE** were applied.
- **No** table-level SELECT was applied.
- **No** sequence SELECT was applied.
- **No** DELETE / TRUNCATE / REFERENCES / TRIGGER was applied.
- **No** extractor rerun occurred.
- **No** worker / downstream runtime occurred.

---

## 4. Post-Fix Proof Output

```text
BEGIN
POST_REVISED_FIX_ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
POST_REVISED_FIX_TABLE_PRIVILEGES|table_select=false|table_insert=true|table_update=true|table_delete=false|table_truncate=false|table_references=false|table_trigger=false
POST_REVISED_FIX_COLUMN_INSERT_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|feature_version=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|session_id=true|site_id=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true|workspace_id=true
POST_REVISED_FIX_COLUMN_UPDATE_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true
POST_REVISED_FIX_COLUMN_SELECT_PRIVILEGES|behavioural_features_id=true|feature_version=true|session_id=true|site_id=true|workspace_id=true
POST_REVISED_FIX_SEQUENCE_PRIVILEGES|sequence=public.session_behavioural_features_v0_2_behavioural_features_id_seq|usage=true|select=false
POST_REVISED_FIX_NO_ROW_READS|confirmed=true
ROLLBACK
no_row_reads=true
no_secret_printed=true
no_grant_dml_ddl_after_fix=true
no_extractor_rerun=true
no_worker_run=true
no_downstream_runtime=true
no_gate_4e=true
no_gate_4f=true
```

---

## 5. Interpretation (proof)

Post-fix proof ran as role `buyerrecon_prod_collector_app` in
`buyerrecon_production` under a **read-only** transaction
(`transaction_read_only=on`), wrapped in `BEGIN … ROLLBACK`.

- **Table-level INSERT is `true`.** ✅ (intended)
- **Table-level UPDATE is `true`.** ✅ (intended)
- **Table-level SELECT remains `false`.** ✅ (intended; not granted)
- **DELETE / TRUNCATE / REFERENCES / TRIGGER remain `false`.** ✅
- **Column-scoped INSERT privileges remain `true`** for all 36 extractor
  insert columns. ✅
- **Column-scoped UPDATE privileges remain `true`** for all 32
  `DO UPDATE SET` columns. ✅
- **Limited column SELECT privileges remain `true`** for
  `behavioural_features_id`, `feature_version`, `session_id`, `site_id`,
  `workspace_id`. ✅
- **Sequence USAGE remains `true`.** ✅
- **Sequence SELECT remains `false`.** ✅ (not granted)
- No row reads. No secrets. No GRANT/DML/DDL after the fix. No extractor
  rerun. No worker. No downstream runtime. No Gate 4E / Gate 4F.

The applied state exactly matches the reviewed PR #139 revised candidate:
the two new table-level grants (INSERT, UPDATE) are present, everything
excluded by the plan remains denied, and the previously proofed column-scoped
grants and sequence USAGE are preserved.

---

## 6. Boundary / Non-Authorization

This proof PR does **not** authorize:

- extractor rerun
- worker execution
- Stage 0, risk worker, POI worker, evidence snapshot
- Lane preview, Lane writes
- scoring runtime, AMS Trust/Pass runtime, customer output
- Gate 4E, Gate 4F
- any additional GRANT / DML / DDL
- any downstream runtime

No Lane / scoring / customer / AMS / Gate privilege was granted or is claimed.

---

## 7. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column names / boolean privilege facts / stop-line
language only — not values.

### Non-evidence terminal paste artifact

A garbled terminal paste fragment appeared before the valid proof output:

> `echo "no_gate_4f=true"ntime=true"true"rmed=true';seq_name, 'SELECT')::text, 'beh`

This is treated **only** as a terminal paste artifact. It is **not** included
as evidence beyond this note. It contained no DSN, secret, raw row, raw
identifier, payload, or customer data, and it did not affect the proof
interpretation.

---

## 8. Next Required Step

This proof PR alone does **not** authorize the behavioural extractor to run.

After this proof PR is reviewed and merged, a **separate explicit extractor
rerun GO** is still required before any rerun. Any future rerun must be a
separate operator session with all approved stop-lines active.
