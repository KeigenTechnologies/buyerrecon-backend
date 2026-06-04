# Sprint 3 — `session_features` Grant / Role Correction Diagnostic Planning (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC PLANNING RECORD.** This PR plans the
> read-only privilege diagnostic for the `session_features`
> production permission gap recorded in PR #108. It does not apply
> any grant, does not run the extractor, does not change schema,
> does not contact production, does not activate any worker or
> customer output, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id`.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #107 | Merged — `SPRINT3_SESSION_FEATURES_EXTRACTOR_GO_PLANNING` |
| PR #108 | Merged — `SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED` |
| PR #108 merge commit | `92953aed442a244bf5683929942f5c879b427fc0` |
| `session_features` rows | 0 — extractor did not write |
| Extractor failure | `permission denied for table session_features` at exit code 1 |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Extractor rerun | Not authorized — requires new GO after privilege fix and proof |

---

## 2. Problem statement

The session feature extractor (`scripts/extract-session-features.ts`)
connected to `buyerrecon_production` using `DATABASE_URL` from
`.env.production` and failed at the `INSERT … ON CONFLICT … DO UPDATE`
upsert into `public.session_features` with:

```
permission denied for table session_features
```

The post-failure audit session (`buyerrecon_prod_audit_readonly`)
also failed with `permission denied for table session_features` when
attempting a grouped SELECT on `session_features`.

Two distinct privilege gaps are evident:

| Role | Table | Observed gap |
| --- | --- | --- |
| App role (via `DATABASE_URL`) | `public.session_features` | Lacks INSERT / UPDATE (and possibly sequence USAGE) |
| `buyerrecon_prod_audit_readonly` | `public.session_features` | Lacks table-level SELECT (PR #97 Option B granted only column-level SELECT on `session_features_id`) |

---

## 3. Repo-verified context

### 3.1 `session_features` table — sequence and schema

Migration `008_session_features.sql` defines:

```sql
CREATE TABLE IF NOT EXISTS session_features (
  session_features_id  BIGSERIAL PRIMARY KEY,
  workspace_id         TEXT NOT NULL,
  site_id              TEXT NOT NULL,
  session_id           TEXT NOT NULL,
  ...
);
```

`BIGSERIAL` generates a sequence: `public.session_features_id_seq`.

The extractor's `INSERT … ON CONFLICT DO UPDATE` path therefore
requires:

- `INSERT` on `public.session_features`
- `UPDATE` on `public.session_features` (for the conflict update clause)
- `USAGE` on `public.session_features_id_seq` (to advance the sequence on insert)
- Potentially `SELECT` on `public.session_features` for the `RETURNING session_features_id, workspace_id, site_id, session_id` clause (confirmed from `EXTRACTION_SQL` in `scripts/extract-session-features.ts`)

### 3.2 Migration 016 scope

`migrations/016_scoring_output_lane_grant_safety.sql` explicitly
excludes `session_features` from its scope (lines 58–65). It does
not grant or revoke any privilege on `session_features`.

### 3.3 PR#17f production migration runbook

The PR#17f runbook (`docs/sprint2-pr17f-production-migration-operator-runbook.md`,
line 311) lists `session_features` as:

```
INSERT/UPDATE on owning worker only | SELECT | none in PR#17f scope
```

No explicit `GRANT … ON session_features TO buyerrecon_prod_collector_app`
was included in the PR#17f production migration scope or subsequent
production migration proof docs. This suggests the production
`session_features` write grants were intended but not yet applied —
the same pattern as the `accepted_events` blocker in PR #84.

### 3.4 PR #97 Option B and `buyerrecon_prod_audit_readonly`

PR #97 (`GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS`) granted:

```sql
GRANT SELECT (session_features_id) ON public.session_features
  TO buyerrecon_prod_audit_readonly;
```

This is a **column-level** SELECT on the PK column only. It is
sufficient for `COUNT(*)` readiness checks but insufficient for
`SELECT … GROUP BY extraction_version` or other column-selecting
queries. That explains why the post-failure grouped evidence query
also hit `permission denied`.

---

## 4. Diagnostic questions to answer

The following questions must be answered by a later read-only
diagnostic operator session. **This PR does not execute that session.**

| # | Question |
| --- | --- |
| 1 | Which role does `DATABASE_URL` in `.env.production` connect as? Confirm without printing the DSN. |
| 2 | Does that app role have `INSERT` on `public.session_features`? |
| 3 | Does that app role have `UPDATE` on `public.session_features`? |
| 4 | Does that app role have `SELECT` on `public.session_features`? (Needed for `RETURNING` clause.) |
| 5 | Does that app role have `USAGE` on `public.session_features_id_seq`? (Needed to advance the PK sequence on insert.) |
| 6 | Does that app role have `USAGE` on `schema public`? |
| 7 | Does `buyerrecon_prod_audit_readonly` have table-level `SELECT` on `public.session_features`? (Currently only column-level `SELECT (session_features_id)` from PR #97.) |
| 8 | Who owns `public.session_features`? Is it the migrator role, or a different owner? |
| 9 | Are there any RLS policies or triggers on `session_features`? |
| 10 | Is the failure definitely from the INSERT path (write) rather than a missing sequence USAGE or schema USAGE? |

---

## 5. Planned read-only diagnostic queries

These queries are **for a future operator session only**. This PR
does not run them. All must run inside an explicit
`BEGIN READ ONLY ... ROLLBACK` block (carry-forward from PR #106 —
PGOPTIONS `transaction_read_only=on` did not take effect in that
session).

### 5.1 Confirm app role identity (without printing DSN)

```bash
# Load app DSN silently; confirm DB name only
node -e "const u=new URL(process.env.DATABASE_URL); console.log('db_name:',u.pathname.replace(/^\//,''));"
```

Then connect and run Q1:

```sql
BEGIN READ ONLY;
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;
ROLLBACK;
```

### 5.2 App role privilege check on `session_features` and sequence

```sql
BEGIN READ ONLY;
SELECT
  has_table_privilege(current_user, 'public.session_features', 'SELECT')  AS sf_select,
  has_table_privilege(current_user, 'public.session_features', 'INSERT')  AS sf_insert,
  has_table_privilege(current_user, 'public.session_features', 'UPDATE')  AS sf_update,
  has_sequence_privilege(current_user, 'public.session_features_id_seq', 'USAGE')   AS seq_usage,
  has_sequence_privilege(current_user, 'public.session_features_id_seq', 'SELECT')  AS seq_select,
  has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage;
ROLLBACK;
```

### 5.3 `buyerrecon_prod_audit_readonly` privilege check (from audit session)

```sql
BEGIN READ ONLY;
SELECT
  has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'SELECT')  AS sf_select,
  has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'INSERT')  AS sf_insert,
  has_sequence_privilege('buyerrecon_prod_audit_readonly', 'public.session_features_id_seq', 'USAGE') AS seq_usage;
ROLLBACK;
```

### 5.4 Table owner and RLS / trigger check

```sql
BEGIN READ ONLY;
SELECT tableowner
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'session_features';

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'session_features'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'session_features';

SELECT COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'session_features';
ROLLBACK;
```

---

## 6. Candidate minimal fix options

These are candidates only. **No grant is applied by this planning
PR.** The final approach must be selected after the §5 diagnostic
confirms the exact gap.

**Option A — Full table-level grants to `buyerrecon_prod_collector_app`:**

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT, INSERT, UPDATE ON public.session_features
  TO buyerrecon_prod_collector_app;
GRANT USAGE, SELECT ON public.session_features_id_seq
  TO buyerrecon_prod_collector_app;
```

- Sufficient for the extractor's INSERT/RETURNING/ON CONFLICT path.
- `SELECT` is included because the extractor's `RETURNING
  session_features_id, workspace_id, site_id, session_id` clause
  likely requires it, and `ON CONFLICT DO UPDATE` may also need
  table-level `SELECT` to evaluate the conflict key.

**Option B — Add table-level `SELECT` to `buyerrecon_prod_audit_readonly`:**

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT ON public.session_features
  TO buyerrecon_prod_audit_readonly;
```

- Allows complete post-run evidence queries (grouped counts by
  `extraction_version`, etc.)
- Needed in addition to Option A for the audit role.

Each candidate requires:
- A separate grant-fix PR with Helen GO and Codex review
- A post-grant privilege snapshot proof PR
- A new extractor GO PR before any rerun

---

## 7. Future sequence

| Step | Status |
| --- | --- |
| a. This diagnostic planning PR | **This PR** |
| b. Codex review and merge | Pending |
| c. Diagnostic operator session (read-only; §5 queries) | Not yet done — requires separate operator GO |
| d. Post-diagnostic evidence PR | Not yet done |
| e. Grant-fix PR (after diagnostic confirms gap) | Not yet done |
| f. Post-grant proof PR | Not yet done |
| g. Audit-readonly SELECT grant for `session_features` | Not yet done |
| h. New session feature extractor GO PR | Not yet done |
| i. New extractor run | Not yet done |

---

## 8. Machine-readable block

```yaml
status: SESSION_FEATURES_GRANT_DIAGNOSTIC_PLANNING
failure_source: PR_108_SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED
pr108_merge_commit: 92953aed442a244bf5683929942f5c879b427fc0
failure_message: permission denied for table session_features
known_sequence: public.session_features_id_seq
migration_016_covers_session_features: false
pr17f_explicit_session_features_grant_to_app_role: not_found
pr97_audit_role_session_features_grant: column_level_select_session_features_id_only
candidate_fix_a: GRANT_SELECT_INSERT_UPDATE_ON_session_features_TO_app_role
candidate_fix_b: GRANT_SELECT_ON_session_features_TO_audit_readonly
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_by_this_pr: false
lane_write_by_this_pr: false
scoring_runtime_by_this_pr: false
ams_trust_pass_by_this_pr: false
gate_4e_opened: false
gate_4f_invented: false
next_step: diagnostic_operator_go_pr_then_diagnostic_session_then_evidence_pr_then_grant_fix_pr_then_proof_then_new_extractor_go
```

---

## 9. Hard boundaries

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

It records the diagnostic planning only.

`next_step: diagnostic_operator_go_pr_then_diagnostic_session_then_evidence_pr_then_grant_fix_pr_then_proof_then_new_extractor_go`
