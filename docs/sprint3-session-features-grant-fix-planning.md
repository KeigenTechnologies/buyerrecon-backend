# Sprint 3 — `session_features` Grant Fix Planning (Docs-Only)

> **DOCS-ONLY GRANT FIX PLANNING RECORD.** This PR plans the
> least-privilege grant fix for the `session_features` privilege gap
> confirmed in PR #111. It does not apply any grant, does not run the
> extractor, does not change schema, does not contact production, and
> does not open Gate 4E. No secrets, no raw payloads, no raw
> `request_id` / `session_id`.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #111 | Merged — `SESSION_FEATURES_GRANT_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED` |
| PR #111 merge commit | `ac1266a` (base at planning time) |
| `session_features` rows | 0 — extractor has not written |
| Privilege gap | `buyerrecon_prod_collector_app` lacks SELECT / INSERT / UPDATE on `session_features` and USAGE / SELECT on sequence |
| Audit gap | `buyerrecon_prod_audit_readonly` lacks table-level SELECT on `session_features` |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Extractor rerun | Not authorized — requires new GO after fix and proof |

---

## 2. Repo-verified extractor write path

From `scripts/extract-session-features.ts` (confirmed from source):

**Conflict key:** `ON CONFLICT (workspace_id, site_id, session_id, extraction_version)`

**DO UPDATE SET:** updates 20+ non-key columns on conflict — requires `UPDATE`.

**RETURNING clause:** `RETURNING session_features_id, workspace_id, site_id, session_id`

**Privilege requirements derived from source:**

| Privilege | Why needed |
| --- | --- |
| `INSERT` on `session_features` | To write new session rows |
| `UPDATE` on `session_features` | `ON CONFLICT DO UPDATE SET` clause |
| `SELECT` on `session_features` | `RETURNING session_features_id, workspace_id, site_id, session_id`; `ON CONFLICT` key resolution |
| `USAGE` on `session_features_session_features_id_seq` | To advance the `BIGSERIAL` PK on each INSERT |
| `SELECT` on `session_features_session_features_id_seq` | To read the current sequence value (`currval`) if needed by the runtime |

**Real sequence name** (confirmed by PR #111 diagnostic — the assumed
name `public.session_features_id_seq` does not exist):

```
public.session_features_session_features_id_seq
```

---

## 3. Proposed app-role fix (candidate — DO NOT RUN)

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Reviewed and applied only after this planning PR merges and Helen issues explicit GO.

GRANT SELECT, INSERT, UPDATE ON TABLE public.session_features
  TO buyerrecon_prod_collector_app;

GRANT USAGE, SELECT ON SEQUENCE public.session_features_session_features_id_seq
  TO buyerrecon_prod_collector_app;
```

**Why table-level SELECT (not column-scoped) for the app role:**

The `RETURNING` clause returns `session_id`, `workspace_id`,
`site_id` — which are also the conflict key columns. PostgreSQL
requires `SELECT` on all columns listed in `RETURNING` and on the
columns used in `ON CONFLICT` evaluation. Because the extractor
already writes `session_id` into the table and reads it back via
`RETURNING`, the app role operationally controls these values during
the write session. Table-level `SELECT` is therefore the pragmatic
approach for this role. A column-scoped alternative is discussed
in §4.

**This grant does not give the app role broader read access than
is required by the extractor's own write path.**

---

## 4. Audit-role evidence strategy (sensitive column risk analysis)

`public.session_features` contains the following sensitive or
semi-sensitive columns that make a blanket table-level `SELECT`
grant to `buyerrecon_prod_audit_readonly` higher risk than the
app-role grant:

| Column | Sensitivity |
| --- | --- |
| `session_id` | Session identifier — must not be exposed to audit queries unless explicitly approved |
| `landing_page_url`, `last_page_url` | URL paths — may contain query-string identifiers |
| `landing_page_path`, `last_page_path` | Paths — lower risk but still quasi-identifying |
| `event_name_counts`, `schema_key_counts`, `consent_source_counts` | JSONB aggregate maps — lower risk but contain event taxonomy |
| `workspace_id`, `site_id` | Workspace / site keys — not customer PII but scoping identifiers |

For the audit evidence use case (confirming `session_features` row
counts and `extraction_version` distribution), the required queries
are:

```sql
-- These queries do NOT need session_id, URL fields, or JSONB content:
SELECT COUNT(*) FROM public.session_features;
SELECT extraction_version, COUNT(*) FROM public.session_features GROUP BY extraction_version;
```

**Preferred Option B1 — Column-scoped SELECT on non-sensitive columns:**

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT (session_features_id, extraction_version, extracted_at,
              source_event_count, workspace_id, site_id)
  ON public.session_features
  TO buyerrecon_prod_audit_readonly;
```

- `session_features_id`: BIGSERIAL PK (already has column-level
  SELECT from PR #97). Needed for `COUNT(*)`.
- `extraction_version`: Version stamp — non-sensitive; needed for
  `GROUP BY extraction_version` evidence.
- `extracted_at`, `source_event_count`: Timing and count metadata —
  non-sensitive; useful for evidence quality checks.
- `workspace_id`, `site_id`: Scoping keys — lower risk; allows
  filtered counts per workspace/site if needed.

**What this denies:** `session_id`, URL fields, JSONB maps, and
behavioral count columns remain inaccessible. A query attempting
`SELECT session_id FROM session_features` would fail with
`permission denied for column session_id` — protecting the session
identifier at the grant layer.

**Preferred Option B2 — Count-only SECURITY DEFINER function (stronger, more design-heavy):**

Create a dedicated SECURITY DEFINER function or view that exposes
only aggregate counts. This prevents any row-level access entirely.
Not created by this planning PR but listed as the stronger option
if audit-role column-level grants are judged insufficient.

**Option C — Table-level SELECT for audit role (higher risk, requires explicit justification):**

```sql
-- CANDIDATE ONLY — HIGH RISK — DO NOT RUN WITHOUT EXPLICIT REVIEW
GRANT SELECT ON TABLE public.session_features
  TO buyerrecon_prod_audit_readonly;
```

This would expose `session_id`, URL fields, and JSONB content to
any query run under the audit role. It relies entirely on query
discipline and redaction rules to prevent sensitive column exposure.
**This option requires explicit Helen GO and Codex risk acceptance
before being applied. Option B1 is strongly preferred.**

**Recommendation:** Use Option B1 (column-scoped SELECT) for the
audit role. Apply Option C only if Option B1 is proven insufficient
for evidence needs and a separate risk acceptance PR is merged.

---

## 5. Required follow-up sequence

| Step | Status |
| --- | --- |
| a. Grant-fix planning PR | **This PR** |
| b. Codex narrow review | Pending |
| c. Separate grant-fix operator GO PR (app-role grants; audit-role grant option chosen and documented) | Not yet done — gated on (b) |
| d. Helen explicit GO before any production GRANT | Required |
| e. Execute only the reviewed grant statements | Not yet done — gated on (d) |
| f. Post-grant proof PR | Not yet done — must confirm app-role and audit-role privileges and correct sequence name |
| g. New extractor rerun GO PR | Not yet done — gated on (f) |
| h. Extractor rerun only after GO is reviewed/merged | Not yet done |
| i. Post-extractor evidence PR | Not yet done — before any downstream worker |

---

## 6. Stop-lines

| Stop-line | Action |
| --- | --- |
| Any production SQL is executed by this planning PR | Stop |
| Any GRANT appears as executable rather than `-- CANDIDATE ONLY — DO NOT RUN` | Stop |
| Old sequence name `public.session_features_id_seq` appears outside the historical wrong-assumption context | Stop |
| Any audit table-level SELECT (Option C) proposed without a risk note | Stop |
| Any extractor rerun language appears | Stop |
| Any downstream worker run language appears | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening / readiness / auto-advance language | Stop |
| Gate 4F language | Stop |
| Any DSN / token / password / secret would be printed | Stop |
| Any raw `request_id` / `session_id` / payload / `canonical_jsonb` / IP hash / user agent / customer data would be printed | Stop |

---

## 7. Machine-readable block

```yaml
status: SESSION_FEATURES_GRANT_FIX_PLANNING
diagnostic_source: PR_111_SESSION_FEATURES_GRANT_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED
app_role: buyerrecon_prod_collector_app
database: buyerrecon_production
table: public.session_features
real_sequence: public.session_features_session_features_id_seq
wrong_assumed_sequence: public.session_features_id_seq
candidate_app_role_table_grant: GRANT_SELECT_INSERT_UPDATE_ON_session_features
candidate_app_role_sequence_grant: GRANT_USAGE_SELECT_ON_session_features_session_features_id_seq
preferred_audit_role_option: B1_column_scoped_select_non_sensitive_columns
audit_option_b1_columns:
  - session_features_id
  - extraction_version
  - extracted_at
  - source_event_count
  - workspace_id
  - site_id
audit_option_c_risk: higher_requires_explicit_risk_acceptance
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_by_this_pr: false
lane_write_by_this_pr: false
scoring_runtime_by_this_pr: false
ams_trust_pass_by_this_pr: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: grant_fix_operator_go_pr_then_helen_go_then_execute_grants_then_proof_pr_then_extractor_go_pr
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

It records the grant-fix planning only.

`next_step: grant_fix_operator_go_pr_then_helen_go_then_execute_grants_then_proof_pr_then_extractor_go_pr`
