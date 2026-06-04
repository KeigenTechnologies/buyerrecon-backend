# Sprint 3 — `session_features` Grant Diagnostic Evidence (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC EVIDENCE RECORD.** This PR records the
> results of the read-only `session_features` privilege diagnostic
> session authorized by PR #110. It does not apply any grant, does
> not run the extractor, does not change schema, does not contact
> production beyond the already-completed operator session described
> below, and does not open Gate 4E. No secrets, no raw payloads, no
> raw `request_id` / `session_id`.

---

## 1. Verdict

**`SESSION_FEATURES_GRANT_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED`**

The diagnostic confirmed: the production app role
(`buyerrecon_prod_collector_app`) has schema USAGE on `public` but
holds **no** SELECT, INSERT, or UPDATE privilege on
`public.session_features`, and **no** USAGE or SELECT privilege on
the sequence `public.session_features_session_features_id_seq`.
The failure cause is a privilege gap — not RLS, triggers, the wrong
database, or the wrong app role. No fix was applied by this diagnostic
session; a separate grant-fix planning PR is required.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #109 | Merged — `SESSION_FEATURES_GRANT_DIAGNOSTIC_PLANNING` |
| PR #110 | Merged — `SESSION_FEATURES_GRANT_DIAGNOSTIC_GO_RECORDED` |
| PR #110 merge commit | `1949c660b76c9957b18c53aff4f0265d14d603cb` |
| `session_features` rows | 0 — extractor still has not written |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Session A — App role diagnostic results

All queries ran inside `BEGIN READ ONLY ... ROLLBACK`.

### 3.1 DB host / name (node output)

```
db_host: 127.0.0.1:5432
db_name: buyerrecon_production
```

### 3.2 Role / database / read-only confirmation (A1)

```
A1_ROLE_DB_READONLY|buyerrecon_prod_collector_app|buyerrecon_production|on|2026-06-04 16:22:00.076979
```

| Field | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` |
| `current_database()` | `buyerrecon_production` |
| `txn_read_only` | `on` |
| Timestamp | `2026-06-04 16:22:00.076979 UTC` |

### 3.3 Schema USAGE (A2)

```
A2_SCHEMA_USAGE|t
```

App role has `USAGE` on schema `public`. Schema access is not the blocker.

### 3.4 `session_features` table privileges (A3)

```
A3_SESSION_FEATURES_TABLE_PRIVS|f|f|f
```

| Privilege | Value |
| --- | --- |
| `SELECT` on `public.session_features` | **false** |
| `INSERT` on `public.session_features` | **false** |
| `UPDATE` on `public.session_features` | **false** |

The app role has **no** table privileges on `session_features`.

### 3.5 Sequence name correction and privileges (A4)

The initial session attempt assumed the sequence was named
`public.session_features_id_seq` (following the `accepted_events`
pattern used in PR #87). That sequence does not exist in production
and caused that `BEGIN READ ONLY ... ROLLBACK` block to abort.

A corrected sequence discovery query found the real sequence name:

```
BEGIN
A4_SEQUENCE_NAME|public.session_features_session_features_id_seq
A4_SEQUENCE_PRIVS|public.session_features_session_features_id_seq|f|f
ROLLBACK
```

**Actual sequence name:** `public.session_features_session_features_id_seq`

This is the standard PostgreSQL BIGSERIAL naming convention:
`<table_name>_<column_name>_seq`.

| Privilege | Value |
| --- | --- |
| `USAGE` on `public.session_features_session_features_id_seq` | **false** |
| `SELECT` on `public.session_features_session_features_id_seq` | **false** |

The app role has **no** sequence privileges.

### 3.6 Table owner (A5)

```
A5_TABLE_OWNER|postgres
```

`public.session_features` is owned by `postgres` (the superuser /
migrator owner). Privileges must be explicitly granted to
`buyerrecon_prod_collector_app`.

### 3.7 Sequence owner (A6)

```
A6_SEQUENCE_OWNER|postgres
```

`public.session_features_session_features_id_seq` is owned by
`postgres`. Sequence privileges must also be explicitly granted.

### 3.8 RLS state (A7)

```
A7_RLS_STATE|f|f
```

| Flag | Value |
| --- | --- |
| `relrowsecurity` | false |
| `relforcerowsecurity` | false |

RLS is not enabled. Not a blocker.

### 3.9 Trigger count (A8)

```
A8_TRIGGER_COUNT|0
```

No triggers on `session_features`. Not a blocker.

---

## 4. Session B — Audit role diagnostic results

All queries ran inside `BEGIN READ ONLY ... ROLLBACK`.

```
AUDIT_DSN loaded
BEGIN
B1_AUDIT_ROLE_DB_READONLY|buyerrecon_prod_audit_readonly|buyerrecon_production|on|2026-06-04 16:25:07.257125
B2_AUDIT_TABLE_PRIVS|f|f
B3_AUDIT_COLUMN_PRIVS|t
B4_AUDIT_SCHEMA_USAGE|t
ROLLBACK
```

| Check | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_audit_readonly` |
| `current_database()` | `buyerrecon_production` |
| `txn_read_only` | `on` |
| Timestamp | `2026-06-04 16:25:07.257125 UTC` |
| `SELECT` on `public.session_features` (table-level) | **false** |
| `INSERT` on `public.session_features` (table-level) | false |
| Column-level `SELECT` on `session_features_id` (PR #97 grant) | **true** |
| `USAGE` on schema `public` | true |

The audit role has the column-level `SELECT (session_features_id)`
grant from PR #97 but lacks table-level `SELECT` on
`session_features`. This explains why the post-failure grouped
evidence query (`GROUP BY extraction_version`) in PR #108 also
hit `permission denied`.

---

## 5. Diagnostic summary

| Finding | Detail |
| --- | --- |
| App role | `buyerrecon_prod_collector_app` — correct role |
| Database | `buyerrecon_production` — correct database |
| Schema USAGE | true — not the blocker |
| App role table SELECT | **false** |
| App role table INSERT | **false** |
| App role table UPDATE | **false** |
| App role sequence USAGE | **false** |
| App role sequence SELECT | **false** |
| Real sequence name | `public.session_features_session_features_id_seq` |
| Table owner | `postgres` |
| Sequence owner | `postgres` |
| RLS | false / false — not a blocker |
| Trigger count | 0 — not a blocker |
| Audit role table SELECT | **false** |
| Audit role column SELECT on `session_features_id` | true (PR #97 grant in force) |
| Audit role schema USAGE | true |
| Root cause | **Privilege gap** — no table or sequence grants to `buyerrecon_prod_collector_app` or `buyerrecon_prod_audit_readonly` on `session_features` |

---

## 6. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| GRANT / DDL / DML executed | None |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |
| Schema / migration change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| DSN / secret / token printed | No |
| Raw `request_id` printed | No |
| Raw `session_id` printed | No |
| Raw payload printed | No |
| Customer data printed | No |

---

## 7. Next step

This evidence PR **does not apply a fix**. The next separately gated
step is a **`session_features` grant-fix planning PR** that
documents and reviews the minimal privilege grants before any
operator applies them. Based on this diagnostic, the likely
least-privilege fix candidates are:

**For `buyerrecon_prod_collector_app`** (extractor write path):

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT, INSERT, UPDATE ON public.session_features
  TO buyerrecon_prod_collector_app;
GRANT USAGE, SELECT ON public.session_features_session_features_id_seq
  TO buyerrecon_prod_collector_app;
```

- `SELECT` is included because the extractor's `RETURNING
  session_features_id, workspace_id, site_id, session_id` clause
  and the `ON CONFLICT DO UPDATE` path likely require it.
- `USAGE` is required to advance the BIGSERIAL sequence on INSERT.
- `SELECT` on the sequence is required so the extractor can read
  the current sequence value if needed.

**For `buyerrecon_prod_audit_readonly`** (evidence counts):

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT ON public.session_features
  TO buyerrecon_prod_audit_readonly;
```

- Table-level SELECT allows `COUNT(*)`, `GROUP BY`, and other
  aggregate evidence queries.
- Raw identifier columns (`session_id`, URL fields, JSONB) remain
  protected by query discipline and the redaction rules in PR #109.

No grant is applied by this PR. Each candidate requires a separate
grant-fix PR with Helen GO and Codex review, followed by a
post-grant proof PR, before any extractor rerun GO is issued.

---

## 8. Machine-readable block

```yaml
status: SESSION_FEATURES_GRANT_DIAGNOSTIC_COMPLETE_PRIVILEGE_GAP_CONFIRMED
go_source: PR_110_SESSION_FEATURES_GRANT_DIAGNOSTIC_GO_RECORDED
pr110_merge_commit: 1949c660b76c9957b18c53aff4f0265d14d603cb
app_role: buyerrecon_prod_collector_app
database: buyerrecon_production
app_role_txn_read_only: on
app_role_schema_usage: true
app_role_sf_select: false
app_role_sf_insert: false
app_role_sf_update: false
assumed_sequence_name: public.session_features_id_seq
assumed_sequence_exists: false
real_sequence_name: public.session_features_session_features_id_seq
app_role_seq_usage: false
app_role_seq_select: false
table_owner: postgres
sequence_owner: postgres
rls_enabled: false
trigger_count: 0
audit_role: buyerrecon_prod_audit_readonly
audit_role_sf_table_select: false
audit_role_sf_col_id_select: true
audit_role_schema_usage: true
root_cause: privilege_gap_no_table_or_sequence_grants
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: session_features_grant_fix_planning_pr_then_fix_pr_then_proof_pr_then_new_extractor_go
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

It records the `session_features` grant diagnostic results only.

`next_step: session_features_grant_fix_planning_pr_then_fix_pr_then_proof_pr_then_new_extractor_go`
