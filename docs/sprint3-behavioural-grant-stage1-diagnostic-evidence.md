# Sprint 3: Behavioural Output Grant — Stage 1 Diagnostic Evidence

**Status:** `BEHAVIOURAL_GRANT_DIAGNOSTIC_STAGE1_EVIDENCE_COMPLETE`

This is a **docs-only Stage 1 diagnostic evidence record**. It captures the
result of the read-only, transaction-rolled-back catalog/metadata diagnostic
planned in PR #142 and authorized by explicit Helen Stage 1 diagnostic GO.

This record **does not apply any fix**, **does not authorize GRANT/DML/DDL**,
**does not authorize extractor rerun**, and **does not authorize workers or
downstream runtime**. It records boolean / name / status facts only.

---

## 1. Authorization & Provenance

- PR #142 (Stage 1 diagnostic plan) was merged.
  - Merge commit: `1e069ba957764962064eeeb190bb9e6571b3b1fd`
  - It planned the Stage 1 read-only / transaction-rolled-back catalog and
    metadata diagnostic.
- Helen Stage 1 diagnostic GO was present:
  `HELEN BEHAVIOURAL GRANT DIAGNOSTIC STAGE 1 GO: run the planned Stage 1 read-only, transaction-rolled-back catalog/metadata diagnostic for public.session_behavioural_features_v0_2, booleans/names/status only. Test unqualified-vs-public-qualified relation resolution, runtime role/search_path/current_schema, table/column/sequence privileges, RLS, triggers, policies, and owner metadata. No row reads, no raw identifiers, no payload/customer data, no DSN/password/token output, no GRANT/DML/DDL, no extractor rerun, no worker, no downstream runtime, no Gate 4E, and no Gate 4F.`
- The diagnostic was run on production as **read-only only**, inside a
  `BEGIN; … ROLLBACK;` block.

---

## 2. Stage 1 Evidence (verbatim labelled output)

```text
BEGIN
ROLE_CONTEXT|session_user=buyerrecon_prod_collector_app|current_user=buyerrecon_prod_collector_app|current_role=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on|search_path="$user", public|current_schema=public
ROLE_ASSERTIONS|role_ok=true|database_ok=true|read_only_ok=true
RELATION_RESOLUTION|unqualified_regclass=session_behavioural_features_v0_2|public_regclass=session_behavioural_features_v0_2|unqualified_oid=17494|public_oid=17494|oid_equal=true
SBF_TABLE_PRIVILEGES|table_select=false|table_insert=true|table_update=true|table_delete=false|table_truncate=false|table_references=false|table_trigger=false
SBF_COLUMN_INSERT_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|feature_version=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|session_id=true|site_id=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true|workspace_id=true
SBF_COLUMN_UPDATE_PRIVILEGES|dwell_ms_before_first_action=true|extracted_at=true|feature_presence_map=true|feature_source_map=true|first_event_id=true|first_form_start_precedes_first_cta=true|first_seen_at=true|form_start_count_before_first_cta=true|form_submit_count_before_first_form_start=true|has_form_submit_without_prior_form_start=true|interaction_density_bucket=true|last_event_id=true|last_seen_at=true|max_events_per_second=true|missing_feature_count=true|ms_between_pageviews_p50=true|ms_from_consent_to_first_cta=true|pageview_burst_count_10s=true|refresh_loop_candidate=true|refresh_loop_count=true|refresh_loop_source=true|repeat_pageview_candidate_count=true|same_path_repeat_count=true|same_path_repeat_max_span_ms=true|same_path_repeat_median_delta_ms=true|same_path_repeat_min_delta_ms=true|scroll_depth_bucket_before_first_cta=true|source_event_count=true|source_event_id_max=true|source_event_id_min=true|sub_200ms_transition_count=true|valid_feature_count=true
SBF_COLUMN_SELECT_PRIVILEGES|behavioural_features_id=true|feature_version=true|session_id=true|site_id=true|workspace_id=true
SBF_SEQUENCE_PRIVILEGES|sequence=public.session_behavioural_features_v0_2_behavioural_features_id_seq|usage=true|select=false
SBF_CONFLICT_TARGET_SELECT_CHECK|workspace_id=true|site_id=true|session_id=true|feature_version=true
SBF_OWNER_RLS_METADATA|schema=public|table=session_behavioural_features_v0_2|owner=postgres|relrowsecurity=false|relforcerowsecurity=false
SBF_TRIGGER_METADATA|trigger_count=0|trigger_names=<none>
SBF_POLICY_METADATA|policy_count=0|policy_names=<none>
DIAGNOSTIC_ONLY|stage=1|no_row_reads=true|no_grant_dml_ddl=true|no_extractor_rerun=true|no_worker_run=true|no_downstream_runtime=true
ROLLBACK
no_secret_printed=true
no_customer_raw_data_printed=true
no_gate_4e=true
no_gate_4f=true
```

---

## 3. Interpretation

- **Role verified:** `session_user`, `current_user`, and `current_role` all
  `buyerrecon_prod_collector_app`.
- **DB verified:** `buyerrecon_production`.
- **Read-only verified:** `transaction_read_only=on`.
- **Search path / schema:** `search_path="$user", public`; `current_schema=public`.
- **Relation resolution:** unqualified `session_behavioural_features_v0_2` and
  `public.session_behavioural_features_v0_2` resolve to the **same OID `17494`**
  (`oid_equal=true`).
- **Table privileges:** `table_select=false`, `table_insert=true`,
  `table_update=true`, `table_delete=false`, `table_truncate=false`,
  `table_references=false`, `table_trigger=false`.
- **Column INSERT privileges** are `true` for all checked extractor insert
  columns; **column UPDATE privileges** are `true` for all checked extractor
  update columns.
- **Limited SELECT privileges** are `true` for `behavioural_features_id`,
  `feature_version`, `session_id`, `site_id`, `workspace_id`.
- **Sequence:** `USAGE=true`, `SELECT=false`.
- **Conflict-target SELECT** privileges are `true` for `workspace_id`,
  `site_id`, `session_id`, `feature_version`.
- **Owner / RLS:** owner `postgres`; `relrowsecurity=false`;
  `relforcerowsecurity=false`.
- **Triggers:** `trigger_count=0`. **Policies:** `policy_count=0`.
- No row reads. No secrets. No GRANT/DML/DDL. No extractor rerun. No worker /
  downstream runtime. No Gate 4E / Gate 4F.

---

## 4. Careful Conclusion (evidence-backed, not over-claimed)

Based on this Stage 1 session, the following hypotheses from the PR #142 plan
appear **likely ruled out** — within the bounds of what catalog/metadata can
show:

- **H3 (search_path / schema / unqualified-vs-qualified mismatch):** likely
  ruled out — the unqualified and `public.`-qualified names resolve to the same
  OID (`17494`), `search_path` includes `public`, and `current_schema=public`.
- **H5 (RLS / policy / ownership):** likely ruled out by metadata —
  `relrowsecurity=false`, `relforcerowsecurity=false`, `policy_count=0`.
- **Trigger-path factor (part of H4):** likely ruled out — `trigger_count=0`.
- **H2 (runtime role mismatch):** not supported by this diagnostic — the role
  gates (`session_user` / `current_user` / `current_role`) all match the
  expected app role `buyerrecon_prod_collector_app`.

However:

- **The remaining permission issue is still not resolved.** This Stage 1
  session confirms the privilege/metadata state but did not reproduce the
  runtime failure.
- **Table-level SELECT remains `false`** and remains a **possible diagnostic
  direction** — but this PR does **not** claim table-level SELECT is the proven
  fix.
- Remaining open hypotheses include **H1** (this exact
  `ON CONFLICT … DO UPDATE … RETURNING` path may require table-level SELECT),
  **H4** (an adjacent relation/sequence/view touched at runtime beyond what was
  probed), **H6** (actual runtime SQL differs from the inspected source), and
  **H7** (error localization — before/during/after the upsert). These are not
  resolved by catalog/metadata alone.

No grant is proposed or applied by this evidence PR.

---

## 5. Non-Authorization

This Stage 1 diagnostic evidence PR does **not**:

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

All identifier references are column / object names, catalog-metadata facts
(OIDs, owner, counts, booleans), or stop-line language only — not business row
values. (The OID `17494` is a catalog object identifier for the table, not
customer or row data.)

### Non-evidence terminal paste artifact

A garbled terminal paste fragment appeared before the valid labelled output:

> `WITH rel AS ( echo "no_gate_4f=true"data_printed=true"eam_runtime=true';ddl=true|no_extractor_`

This is treated **only** as a terminal paste artifact. It is **not** included
as evidence beyond this note. It contained no DSN, secret, raw row, raw
identifier, payload, or customer data, and it does not affect the diagnostic
interpretation.

---

## 7. Next Required Step

1. A **separate diagnostic / planning PR** to take the next step — e.g. to
   localize the exact failing SQL / error path (H6 / H7) or to design a
   narrowly reviewed next diagnostic / candidate fix.
2. Any fix still requires: **Codex review**, **explicit Helen GO**, a
   **post-fix proof PR**, and a **new explicit extractor rerun GO** before any
   rerun.
3. No extractor rerun, grant, DML/DDL, worker, or downstream runtime is
   authorized until that chain is complete. Any future rerun must be a
   separate operator session with all approved stop-lines active.
