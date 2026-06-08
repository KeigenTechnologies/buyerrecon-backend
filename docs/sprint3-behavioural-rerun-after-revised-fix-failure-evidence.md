# Sprint 3: Behavioural Features Extractor Rerun After Revised Fix — Failure Evidence

**Status:** `BEHAVIOURAL_FEATURES_RERUN_AFTER_REVISED_FIX_FAILED_PERMISSION_DENIED_SBF`

This document records evidence that exactly one production behavioural
features extractor rerun was attempted under explicit operator GO **after**
the revised grant fix (PR #140) added table-level INSERT and UPDATE, and that
the rerun **still failed** with `permission denied` and triggered the
non-zero-exit stop-line. This is a **failed rerun attempt, not a PASS**.

This is a docs-only evidence record. No downstream runtime was authorized or
run.

---

## 1. Authorization

- Helen rerun GO was present (explicit extractor rerun GO after the revised
  grant-fix proof).
- This rerun was conducted as a **separate operator session with all approved
  stop-lines active**.

## 2. Upstream proof record

- PR #140 (revised grant-fix proof) was merged.
  - Merge commit: `c92ddd110b4c05e345afb17893b44b3bd5e68f38`
  - Proof showed: table-level INSERT=true, table-level UPDATE=true,
    table-level SELECT=false, sequence USAGE=true, sequence SELECT=false,
    and column-scoped INSERT/UPDATE/SELECT preserved.

---

## 3. Pre-Rerun Gates (passed)

```text
REPO_GATE|pr140_merge_present=true|merge_commit=c92ddd1
PACKAGE_GATE|extract_behavioural_features_script_present=true
APP_DSN_loaded=true
DB_GATE|db_name=buyerrecon_production
PRE_RERUN_ROLE_GATE|current_user=buyerrecon_prod_collector_app|current_database=buyerrecon_production|transaction_read_only=on
PRE_RERUN_SBF_TABLE_PRIVILEGES|table_select=false|table_insert=true|table_update=true
```

Confirmed before the rerun:

- **Table-level INSERT was `true`.**
- **Table-level UPDATE was `true`.**
- **Table-level SELECT remained `false`.**

---

## 4. Rerun Attempt (exactly one)

- Exactly **one** extractor rerun command was attempted.
- Exact command:
  `npm run extract:behavioural-features`
- Invocation form:

  ```bash
  DATABASE_URL="$APP_DSN" npm run extract:behavioural-features
  ```

- Log path:
  `/tmp/behavioural-extractor-rerun-after-revised-fix-20260608T163356Z.log`

### Observed result

- Exit code: `1`

```text
extractor_exit_code=1
=== extractor safe output tail ===

> buyerrecon-backend@1.0.0 extract:behavioural-features
> tsx scripts/extract-behavioural-features.ts

Sprint 2 PR#1+PR#2 behavioural-features extractor —extraction failed: permission denied for table session_behavioural_features_v0_2
ERROR: extractor exited non-zero - stop
```

- Failure: `permission denied for table session_behavioural_features_v0_2`
- Stop-line triggered: **non-zero extractor exit**.

---

## 5. Stop-Line Compliance After Failure

After the failed rerun:

- No rerun after failure — the extractor was **not** run again.
- No ad hoc grant was applied.
- No GRANT / DML / DDL was run after failure.
- No worker was run.
- No Stage 0.
- No risk worker.
- No POI worker.
- No evidence snapshot.
- No Lane preview / Lane write.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E.
- No Gate 4F.
- No downstream runtime was authorized or run.

---

## 6. Safety / Raw-Data Boundary

This evidence record contains:

- No raw `accepted_events` rows.
- No raw identifiers.
- No `session_id` / `request_id` values.
- No payloads.
- No secrets (no DSN URI, password, bearer token, or API token values).
- No customer data.

All references to identifiers, rows, payloads, or customer data are
column-name / stop-line / safety-boundary language only, not values.

### Non-evidence terminal paste artifact

A garbled terminal paste fragment appeared around the safety-scan block:

> `echo "no_gate_4f=true"s_runtime=true"found - stop"`

This is treated **only** as a terminal paste artifact. It is **not** included
as evidence beyond this note. It contained no DSN, secret, raw row, raw
identifier, payload, or customer data, and it does not affect the failure
interpretation.

---

## 7. Interpretation

- The revised grant fix (PR #140) successfully added table-level INSERT and
  table-level UPDATE (confirmed true in the pre-rerun gate), while table-level
  SELECT remained false.
- Despite table-level INSERT and UPDATE now being true, the extractor rerun
  **still failed** with `permission denied for table
  session_behavioural_features_v0_2`.
- This means the PR #139 / PR #140 hypothesis (that missing table-level
  INSERT/UPDATE was the blocker) is **not** sufficient to explain the failure.
  The remaining privilege difference observed is that table-level **SELECT**
  is still false — but this is a **new direction to diagnose**, not a proven
  cause, and no table-level SELECT grant is proposed or applied here.

---

## 8. Next Required Step

This evidence PR records the failed rerun only. It does **not** authorize any
further runtime.

The next required step is:

- A **separate diagnostic / planning PR** to explain why permission is still
  denied after table-level INSERT and UPDATE are true.
- **No table-level SELECT grant** unless separately planned, reviewed,
  explicitly GO-approved, and proofed.
- **No extractor rerun** until that diagnostic / fix / proof chain is reviewed
  and a **new explicit rerun GO** is given.

Any future rerun must be a separate operator session with all approved
stop-lines active.
