# Sprint 3 — `session_features` Grant Fix Proof (Docs-Only)

> **DOCS-ONLY POST-GRANT PROOF RECORD.** This PR records the
> execution of the `session_features` grant fix authorized by
> PR #113 and Helen's explicit GO. It does not rerun the extractor,
> does not activate any worker, does not write to DB, does not
> contact production beyond the already-completed operator session
> described below, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id`.

---

## 1. Proof verdict

**`SESSION_FEATURES_GRANT_FIX_PROOF_PASS`**

All three reviewed grant statements were applied and confirmed.
App role has table SELECT / INSERT / UPDATE and sequence USAGE.
Audit role has column-level SELECT on `session_features_id` and
`extraction_version` only. `session_id` and table-level SELECT
remain denied for the audit role.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #112 | Merged — `SESSION_FEATURES_GRANT_FIX_PLANNING` |
| PR #113 | Merged — `SESSION_FEATURES_GRANT_FIX_GO_PLANNING` |
| PR #113 merge commit | `6ed4ec2` (base at proof time) |
| `session_features` rows | 0 — extractor still not run |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Helen GO

Helen issued the explicit GO phrase required by PR #113 §2:

> **`HELEN SESSION_FEATURES GRANT GO: apply the session_features grants now.`**

---

## 4. Grant execution

### 4.1 Grants applied

The following three reviewed grant statements were applied exactly
as specified in PR #113 §4:

```sql
GRANT SELECT, INSERT, UPDATE
ON TABLE public.session_features
TO buyerrecon_prod_collector_app;

GRANT USAGE
ON SEQUENCE public.session_features_session_features_id_seq
TO buyerrecon_prod_collector_app;

GRANT SELECT (session_features_id, extraction_version)
ON TABLE public.session_features
TO buyerrecon_prod_audit_readonly;
```

Note: the old wrong sequence name `public.session_features_id_seq`
was not used. The correct sequence
`public.session_features_session_features_id_seq` was used.

### 4.2 Grant execution output

```
BEGIN
GRANT
GRANT
GRANT
COMMIT
```

Three `GRANT` responses, all succeeded. Transaction committed.

---

## 5. Post-grant proof

The proof session ran inside an explicit `BEGIN READ ONLY ... ROLLBACK`
block. No DML, DDL, or further GRANTs were executed during the proof.

### 5.1 Proof session output (categorical — no raw identifiers)

```
BEGIN
P1_ADMIN_READONLY|postgres|buyerrecon_production|on|2026-06-04 17:07:21.673974
P2_APP_TABLE_PRIVS|t|t|t
P3_APP_SEQUENCE_PRIVS|t|f
P4_AUDIT_COLUMN_PRIVS|t|t
P5_AUDIT_DENIED_RAW_COLUMNS|f
P6_AUDIT_TABLE_SELECT|f
ROLLBACK
```

### 5.2 Proof summary

| Check | Label | Value |
| --- | --- | --- |
| Proof role / DB / `txn_read_only` / timestamp (P1) | `P1_ADMIN_READONLY` | `postgres \| buyerrecon_production \| on \| 2026-06-04 17:07:21.673974 UTC` |
| App role table `SELECT` / `INSERT` / `UPDATE` (P2) | `P2_APP_TABLE_PRIVS` | `t \| t \| t` ✓ |
| App role sequence `USAGE` / `SELECT` (P3) | `P3_APP_SEQUENCE_PRIVS` | `t \| f` ✓ — USAGE granted; SELECT intentionally not granted |
| Audit role column SELECT on `session_features_id` / `extraction_version` (P4) | `P4_AUDIT_COLUMN_PRIVS` | `t \| t` ✓ |
| Audit role `session_id` column SELECT remains denied (P5) | `P5_AUDIT_DENIED_RAW_COLUMNS` | `f` ✓ — raw session identifier access denied |
| Audit role table-level SELECT remains denied (P6) | `P6_AUDIT_TABLE_SELECT` | `f` ✓ — table-level SELECT intentionally not granted |

---

## 6. Interpretation

- **`buyerrecon_prod_collector_app`** now holds `SELECT`, `INSERT`,
  `UPDATE` on `public.session_features` — covering the extractor
  upsert / `ON CONFLICT DO UPDATE` / `RETURNING` path.
- **`buyerrecon_prod_collector_app`** holds `USAGE` on
  `public.session_features_session_features_id_seq` — covering the
  `BIGSERIAL` `nextval()` call on INSERT. Sequence `SELECT` was
  intentionally omitted (extractor never calls `currval()` or
  `lastval()`).
- **`buyerrecon_prod_audit_readonly`** holds column-level `SELECT`
  on `session_features_id` (PK) and `extraction_version` (version
  stamp). This allows `COUNT(*)` and `GROUP BY extraction_version`
  evidence queries.
- **`session_id`** column SELECT remains `false` for the audit role —
  the session identifier is protected at the grant layer, not only
  by query discipline.
- **Table-level SELECT** for `buyerrecon_prod_audit_readonly` remains
  `false` — no raw row access to `session_id`, URL fields, or JSONB
  maps.

---

## 7. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |
| Additional GRANT beyond reviewed statements | None |
| DML / DDL during proof | None |
| Schema / migration change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` / `session_id` / IP hash / user agent / payload printed | No |
| DSN or secret printed | No |

---

## 8. Next step

The grant fix is confirmed. The next separately gated step is a
**new session feature extractor rerun GO PR** — the same pattern
as PR #107 (first extractor GO). The extractor must not be rerun
until a new GO PR is reviewed and merged.

The new extractor GO PR must:
- Reference this proof PR as evidence that privileges are in place.
- Specify `SINCE=2026-06-02T21:14:34.000Z` (same window as prior attempts).
- Confirm that only `session_features` will be written.
- Require a post-run evidence PR before any downstream worker is authorized.

**No extractor rerun is authorized by this proof PR.**

---

## 9. Machine-readable block

```yaml
status: SESSION_FEATURES_GRANT_FIX_PROOF_PASS
go_source: PR_113_SESSION_FEATURES_GRANT_FIX_GO_PLANNING
pr113_merge_commit: 6ed4ec2
helen_go_phrase: HELEN SESSION_FEATURES GRANT GO apply the session_features grants now
grant_execution_output: BEGIN_GRANT_GRANT_GRANT_COMMIT
grants_applied:
  - GRANT SELECT INSERT UPDATE ON session_features TO buyerrecon_prod_collector_app
  - GRANT USAGE ON session_features_session_features_id_seq TO buyerrecon_prod_collector_app
  - GRANT SELECT session_features_id extraction_version ON session_features TO buyerrecon_prod_audit_readonly
wrong_sequence_used: false
p2_app_table_select: true
p2_app_table_insert: true
p2_app_table_update: true
p3_app_seq_usage: true
p3_app_seq_select: false
p4_audit_col_session_features_id_select: true
p4_audit_col_extraction_version_select: true
p5_audit_session_id_denied: true
p6_audit_table_select: false
proof_txn_read_only: on
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: new_session_features_extractor_rerun_go_pr_then_extractor_run_then_evidence_pr
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any further DB grant or change privileges
- run the extractor or any other worker
- contact production or perform DB writes beyond the already-completed session
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the `session_features` grant fix proof only.

`next_step: new_session_features_extractor_rerun_go_pr_then_extractor_run_then_evidence_pr`
