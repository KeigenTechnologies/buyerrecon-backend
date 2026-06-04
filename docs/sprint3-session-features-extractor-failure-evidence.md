# Sprint 3 — Session Feature Extractor Failure Evidence (Docs-Only)

> **DOCS-ONLY FAILURE EVIDENCE RECORD.** This PR records the first
> attempted run of `scripts/extract-session-features.ts` under the
> PR #107 GO, which failed with `permission denied for table
> session_features`. It does not rerun the extractor, does not apply
> any grant, does not activate any worker, does not write to DB,
> does not contact production beyond the already-completed operator
> session described below, and does not open Gate 4E. No secrets,
> no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Verdict

**`SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`**

The extractor failed at first attempt with `permission denied for
table session_features`. No `session_features` rows were written.
The next step is a separate grant/role correction planning PR;
the extractor must not be rerun until that planning PR is reviewed
and an approved privilege fix is applied and proofed.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #106 | Merged — `FILTER_PRECHECK_PASS` |
| PR #107 | Merged — `SPRINT3_SESSION_FEATURES_EXTRACTOR_GO_PLANNING` |
| PR #107 merge commit | `5139242a17404fabdae51bc7f83e7aaf8727b384` |
| `session_features` rows | 0 — extractor did not write |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Extractor run attempt

### 3.1 Command summary (no secrets)

```
script:              scripts/extract-session-features.ts
npm_alias:           npm run extract:session-features
SINCE:               2026-06-02T21:14:34.000Z
EXTRACTION_VERSION:  session-features-v0.1
workspace_id_filter: (none)
site_id_filter:      (none)
DATABASE_URL:        loaded from .env.production; never printed
```

### 3.2 Extractor output

```
PR#11 session-features extractor — extraction failed: permission denied for table session_features
extractor_exit_code: 1
```

### 3.3 Exit code

`1` — failure.

### 3.4 Raw identifier log scan

```
RAW_IDENTIFIER_SCAN_CLEAN
```

No raw `request_id`, `session_id`, `canonical_jsonb`, `ip_hash`,
or `user_agent` values appeared in the extractor stdout / stderr.

---

## 4. Post-failure read-only audit evidence

A read-only audit transaction was run under
`buyerrecon_prod_audit_readonly` using explicit
`BEGIN READ ONLY ... ROLLBACK` (carry-forward from PR #106 — PGOPTIONS
does not reliably set `transaction_read_only` in this environment).

### 4.1 Raw output (categorical — no row-level content)

```
BEGIN
Q1_AUDIT_GATE|buyerrecon_prod_audit_readonly|buyerrecon_production|on|2026-06-04 15:43:27.319027
Q2_SESSION_FEATURES_TOTAL|0
ERROR:  permission denied for table session_features
ERROR:  current transaction is aborted, commands ignored until end of transaction block
ERROR:  current transaction is aborted, commands ignored until end of transaction block
ROLLBACK
```

### 4.2 Evidence summary

| Metric | Value |
| --- | --- |
| Audit role | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| `txn_read_only` | `on` |
| Timestamp | `2026-06-04 15:43:27.319027 UTC` |
| `session_features_total` before abort | **0** |
| Grouped-by-version evidence query | Failed — `permission denied for table session_features` |
| Downstream counts (Lane A/B, accepted_events) | Not completed — transaction aborted |

### 4.3 Interpretation

- The `buyerrecon_prod_audit_readonly` role successfully connected
  to `buyerrecon_production` in read-only mode.
- `session_features_total = 0` was returned before the transaction
  aborted — confirming the extractor wrote zero rows.
- The grouped `session_features` evidence query (`GROUP BY
  extraction_version`) failed with `permission denied for table
  session_features`, aborting the transaction. The audit role
  lacks `SELECT` on `session_features`.
- Because the transaction aborted, the downstream count checks
  (Lane A/B, bounded `accepted_events`) were not completed in
  this session.
- No further queries were run for this evidence PR.

---

## 5. Diagnosis

Two distinct permission gaps are now evident:

| Role | Table | Gap |
| --- | --- | --- |
| `buyerrecon_prod_collector_app` | `session_features` | `INSERT` / write permission absent (extractor exit 1) |
| `buyerrecon_prod_audit_readonly` | `session_features` | `SELECT` permission absent (evidence query aborted) |

The extractor failure (`permission denied for table session_features`
at exit code 1) indicates the production app role
(`buyerrecon_prod_collector_app`, loaded via `DATABASE_URL` from
`.env.production`) does not have `INSERT` (or equivalent write)
privilege on `public.session_features`.

This is analogous to the Gate 4C `accepted_events` blocker
(PR #84–#87): a missing production DB privilege prevented the
write path from succeeding.

---

## 6. Stop-lines — all confirmed not triggered (except the failure itself)

| Stop-line | Status |
| --- | --- |
| Wrong database / wrong role | Not triggered — `buyerrecon_production` confirmed |
| Raw identifier in extractor output | Not triggered — scan clean |
| Extractor writes outside `session_features` | Not triggered — zero rows written to any table |
| Lane A/B row count non-zero | Not confirmed (audit transaction aborted before check) |
| Scoring runtime / customer output activated | Not observed |
| Gate 4E opening / readiness language | Not observed |
| Gate 4F language | Not observed |
| Downstream worker run | Not triggered |

---

## 7. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |
| DML / DDL / GRANT manually executed | None |
| DB schema change | None |
| DB write | None |
| Grant applied | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` printed | No |
| Raw `session_id` printed | No |
| Raw payload printed | No |
| DSN or secret printed | No |
| Customer data printed | No |

---

## 8. Next step

The extractor must **not** be rerun until the `session_features`
write privilege gap is diagnosed and fixed. The required sequence:

1. Separate `session_features` grant diagnostic / planning PR —
   characterize exactly which privilege `buyerrecon_prod_collector_app`
   is missing on `public.session_features` (INSERT, or INSERT +
   SELECT for the RETURNING path, or sequence privilege).
2. Separate grant fix PR — reviewed before any privilege is applied.
3. Post-grant proof PR — confirm the privilege is in place.
4. A separate `session_features` audit-readonly SELECT grant
   planning PR — to allow the evidence audit query to complete.
5. New extractor GO PR after privileges are confirmed.
6. New extractor run under the new GO.

No grant, no rerun, and no downstream worker run is authorized by
this evidence PR.

---

## 9. Machine-readable block

```yaml
status: SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED
go_source: PR_107_SPRINT3_SESSION_FEATURES_EXTRACTOR_GO_PLANNING
pr107_merge_commit: 5139242a17404fabdae51bc7f83e7aaf8727b384
script: scripts/extract-session-features.ts
extractor_exit_code: 1
failure_message: permission denied for table session_features
raw_identifier_scan: CLEAN
session_features_rows_written: 0
session_features_total_observed_pre_abort: 0
audit_role: buyerrecon_prod_audit_readonly
audit_db: buyerrecon_production
audit_txn_read_only: on
audit_grouped_query_failed: true
audit_grouped_query_error: permission denied for table session_features
downstream_counts_completed: false
app_role_session_features_insert: unknown_likely_missing
audit_role_session_features_select: missing
extractor_rerun_by_this_pr: false
grant_applied_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: session_features_grant_diagnostic_pr_then_fix_pr_then_proof_then_new_extractor_go
```

---

## 10. Hard boundaries

This PR does **not**:
- rerun the extractor or any other worker
- apply any DB grant or change privileges
- contact production or perform DB writes
- change backend code, packages, migrations, or schema
- deploy or activate any worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the session feature extractor failure evidence only.

`next_step: session_features_grant_diagnostic_pr_then_fix_pr_then_proof_then_new_extractor_go`
