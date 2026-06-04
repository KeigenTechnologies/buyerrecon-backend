# Sprint 3 — `session_features` Grant Fix GO Planning (Docs-Only)

> **DOCS-ONLY GRANT FIX GO PLANNING RECORD. THIS PR DOES NOT
> EXECUTE.** It records Helen's reviewed candidate grant statements
> for the `session_features` privilege gap and defines the post-grant
> proof plan. The grants happen **only** in a later, separate operator
> session with explicit Helen GO after Codex review passes. This PR
> runs no commands, applies no grants, does not contact production,
> does not run the extractor, and does not open Gate 4E. No secrets,
> no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Status

- **Status:** `SESSION_FEATURES_GRANT_FIX_GO_PLANNING`
- **Planning source:** PR #112
  (`docs/sprint3-session-features-grant-fix-planning.md`, merged
  `2026-06-04T16:52:49Z`, commit `35e839fd753f3e51150357c8fc7292c2f21990dc`)
- **Diagnostic source:** PR #111
  (`SESSION_FEATURES_GRANT_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED`)

**Authorization granted by this PR (after Codex review passes and Helen explicitly confirms GO — merge alone is not the GO):**

- `grant_fix_go_planning_recorded=true`
- `helen_explicit_go_required_before_execution=true`
- `post_grant_proof_pr_required=true`
- `extractor_rerun_go_pr_required_after_proof=true`

**Still false (NOT authorized by this PR):**

- `grant_applied_by_this_pr=false`
- `extractor_authorised_by_this_pr=false`
- `worker_activation_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`

---

## 2. Helen GO statement

> **Grants may be applied in a later, separate operator session ONLY
> after:**
> 1. This PR has passed Codex review.
> 2. Helen explicitly states: **`HELEN SESSION_FEATURES GRANT GO:
>    apply the session_features grants now.`**
>
> **Merging this PR alone is not the GO.** The execution requires an
> explicit verbal/written GO from Helen in addition to the merge.

---

## 3. Repo-verified extractor write path

Script: `scripts/extract-session-features.ts` (Sprint 1 PR#11)

**Conflict key:** `ON CONFLICT (workspace_id, site_id, session_id, extraction_version)`

**DO UPDATE SET:** 20+ non-key columns — requires `UPDATE`.

**INSERT column list:** `workspace_id, site_id, session_id, extraction_version, extracted_at, first_seen_at, last_seen_at, session_duration_ms, source_event_id_min, source_event_id_max, first_event_id, last_event_id, source_event_count, page_view_count, cta_click_count, form_start_count, form_submit_count, unique_path_count, landing_page_url, landing_page_path, last_page_url, last_page_path, has_cta_click, has_form_start, has_form_submit, event_name_counts, schema_key_counts, consent_source_counts, canonical_key_count_min, canonical_key_count_max`

Note: `session_features_id` is **not** in the INSERT column list — it is auto-assigned by BIGSERIAL via `nextval()`.

**RETURNING clause:** `RETURNING session_features_id, workspace_id, site_id, session_id`

The extractor reads only `res.rowCount` from the RETURNING result — it does not iterate individual returned rows or read returned values in application code.

---

## 4. Reviewed candidate grant statements

### 4.1 App-role grants

```sql
-- REVIEWED CANDIDATE — DO NOT RUN UNTIL HELEN EXPLICIT GO + CODEX PASS
-- Apply only after this planning PR merges and Helen issues the GO statement in §2.

-- Table: SELECT / INSERT / UPDATE for the extractor upsert / RETURNING / ON CONFLICT path
GRANT SELECT, INSERT, UPDATE
ON TABLE public.session_features
TO buyerrecon_prod_collector_app;

-- Sequence: USAGE only — sufficient for BIGSERIAL nextval(); SELECT is NOT required
-- (extractor never calls currval() or lastval(); no explicit sequence read in extractor SQL)
GRANT USAGE
ON SEQUENCE public.session_features_session_features_id_seq
TO buyerrecon_prod_collector_app;
```

**Why each privilege is needed (tightened rationale):**

| Privilege | Rationale |
| --- | --- |
| `INSERT` | Extractor writes new session rows |
| `UPDATE` | `ON CONFLICT DO UPDATE SET` clause updates 20+ columns |
| `SELECT` | Required for `ON CONFLICT (workspace_id, site_id, session_id, extraction_version)` key resolution; required for `RETURNING session_features_id, workspace_id, site_id, session_id` |
| Sequence `USAGE` | Required for PostgreSQL `nextval()` on `BIGSERIAL session_features_id`; BIGSERIAL auto-increments on INSERT |
| Sequence `SELECT` | **Not required** — extractor never calls `currval()` or `lastval()`; omitted for least-privilege |

**Sequence name used:** `public.session_features_session_features_id_seq`
(confirmed by PR #111 diagnostic — old assumed name
`public.session_features_id_seq` does not exist and must not be used)

**No migration exists** that already grants these privileges — confirmed by searching all migration files; no `buyerrecon_prod_collector_app` grants to `session_features` were found.

### 4.2 Audit-role grants (re-evaluated; narrowed from PR #112 Option B1)

PR #112 Option B1 proposed column-scoped SELECT on
`session_features_id, extraction_version, extracted_at,
source_event_count, workspace_id, site_id`.

**Re-evaluation per carry-forward note from PR #112 Codex review:**
`workspace_id` and `site_id` are scoping identifiers. For the
audit evidence use case (`COUNT(*)` and `GROUP BY extraction_version`),
they are not needed. They are omitted here. `extracted_at` and
`source_event_count` are also omitted as not required for the
minimum evidence queries.

```sql
-- REVIEWED CANDIDATE — DO NOT RUN UNTIL HELEN EXPLICIT GO + CODEX PASS
-- Narrowed to the minimum columns required for COUNT(*) and GROUP BY extraction_version.
-- Omits: workspace_id, site_id, session_id, URL fields, JSONB maps, behavioral counts.

GRANT SELECT (session_features_id, extraction_version)
ON public.session_features
TO buyerrecon_prod_audit_readonly;
```

**Why these two columns:**
- `session_features_id` (PK, BIGSERIAL): already has column-level SELECT from PR #97. Allows `COUNT(*)`.
- `extraction_version` (TEXT, non-sensitive version stamp): allows `GROUP BY extraction_version` evidence queries.

**What this denies:** `session_id`, all URL fields, all JSONB maps, behavioral counts, `workspace_id`, `site_id`. Any query selecting these columns will fail with `permission denied for column <name>`.

**Table-level SELECT for audit role (Option C) is not proposed in this GO.** If future evidence needs require it, a separate risk-acceptance PR with explicit Helen GO and Codex review is required.

---

## 5. Post-grant proof requirements

After the grants are applied (separate operator session), a
post-grant proof PR must confirm:

### 5.1 App-role proof

```
has_table_privilege('buyerrecon_prod_collector_app', 'public.session_features', 'SELECT')  = true
has_table_privilege('buyerrecon_prod_collector_app', 'public.session_features', 'INSERT')  = true
has_table_privilege('buyerrecon_prod_collector_app', 'public.session_features', 'UPDATE')  = true
has_sequence_privilege('buyerrecon_prod_collector_app', 'public.session_features_session_features_id_seq', 'USAGE') = true
has_sequence_privilege('buyerrecon_prod_collector_app', 'public.session_features_session_features_id_seq', 'SELECT') = false  (expected — not granted)
```

### 5.2 Audit-role proof

```
has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'SELECT') = false  (table-level — expected not granted)
has_column_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'session_features_id', 'SELECT')  = true
has_column_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'extraction_version',  'SELECT')  = true
has_column_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'session_id',          'SELECT')  = false  (expected — not granted)
```

### 5.3 Additional checks

- No further privileges beyond those listed in §4 were granted.
- `session_features_session_features_id_seq` USAGE confirmed on app role.
- No extractor rerun occurred.
- No downstream worker ran.
- No customer output / Lane write / scoring runtime / AMS Trust-Pass activated.
- Lane A/B row counts remain `0/0`.

---

## 6. Stop-lines

| Stop-line | Action |
| --- | --- |
| Old sequence name `public.session_features_id_seq` appears in any executable or candidate GRANT | Stop |
| Any GRANT beyond the reviewed statements in §4 | Stop |
| Any audit grant exposing `session_id`, URL fields, or JSONB without separate explicit review | Stop |
| Any extractor rerun language | Stop |
| Any downstream worker run language | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |
| Any DSN / token / password / secret would be printed | Stop |
| Any raw `request_id` / `session_id` / payload / `canonical_jsonb` / IP hash / user agent / customer data would be printed | Stop |

---

## 7. Machine-readable block

```yaml
status: SESSION_FEATURES_GRANT_FIX_GO_PLANNING
planning_source: PR_112_SESSION_FEATURES_GRANT_FIX_PLANNING
pr112_merge_commit: 35e839fd753f3e51150357c8fc7292c2f21990dc
helen_explicit_go_required_before_execution: true
app_role: buyerrecon_prod_collector_app
table: public.session_features
real_sequence: public.session_features_session_features_id_seq
wrong_sequence_not_to_use: public.session_features_id_seq
app_role_table_grant: GRANT_SELECT_INSERT_UPDATE
app_role_sequence_grant: GRANT_USAGE_only
app_role_sequence_select_granted: false
app_role_sequence_select_rationale: not_required_extractor_never_calls_currval_or_lastval
audit_role: buyerrecon_prod_audit_readonly
audit_role_grant: GRANT_SELECT_session_features_id_extraction_version_column_only
audit_role_workspace_id_included: false
audit_role_site_id_included: false
audit_role_session_id_included: false
audit_role_table_level_select: false
no_existing_migration_covers_this: true
grant_applied_by_this_pr: false
extractor_authorised_by_this_pr: false
worker_activation_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
ams_trust_pass_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: helen_explicit_go_then_apply_section_4_grants_then_post_grant_proof_pr_then_extractor_go_pr
```

---

## 8. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- run the extractor or any other worker
- contact production or perform DB writes
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the reviewed candidate grant statements and proof plan.
Execution requires Helen's explicit GO in addition to this PR merging.

`next_step: helen_explicit_go_then_apply_section_4_grants_then_post_grant_proof_pr_then_extractor_go_pr`
