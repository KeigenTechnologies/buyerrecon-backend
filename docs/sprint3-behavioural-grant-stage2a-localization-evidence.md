# Sprint 3: Behavioural Output Grant — Stage 2a Read-Only Localization Evidence

**Status:** `STAGE2A_READ_ONLY_LOCALIZATION_EXECUTED_WITH_DIAGNOSTIC_QUERY_SHAPE_ERROR`

This is a **docs-only Stage 2a diagnostic evidence record**. It captures the
outcome of the **read-only, transaction-rolled-back** localization diagnostic
planned in PR #144 and authorized by explicit Helen Stage 2a GO.

This record applies **no** fix, authorizes **no** GRANT/DML/DDL, authorizes
**no** extractor rerun, and authorizes **no** worker or downstream runtime. It
records structural metadata, booleans, and aggregate counts only — no row
values.

---

## 1. Title & Status

- Title: Behavioural Output Grant — Stage 2a Read-Only Localization Evidence.
- Status: `STAGE2A_READ_ONLY_LOCALIZATION_EXECUTED_WITH_DIAGNOSTIC_QUERY_SHAPE_ERROR`.
- The Stage 2a read-only localization **executed**, connected to the database,
  ran read-only, and rolled back. It produced useful localization signal, plus
  a **diagnostic query-shape error** (see §6) that is a limitation of one
  diagnostic probe, **not** extractor evidence.

---

## 2. Authorization Source & Scope

- PR #144 (error-localization plan) was merged
  (`Merge PR #144: Sprint 3 behavioural grant error-localization plan`),
  planning Stage 2a read-only localization first.
- Helen gave explicit GO for **Stage 2a read-only localization only**:
  decomposition first; no writes; structural PostgreSQL error fields /
  booleans / aggregate counts only; no row values; no raw identifiers; no
  payload/customer data; no DSN/password/token output; no GRANT/DML/DDL; no
  extractor rerun; no worker; no downstream runtime; no Gate 4E; no Gate 4F.
- A **duplicate GO was pasted, but it is treated as one authorization only**
  (`duplicate_go_treated_as_single_run=true`). Exactly one Stage 2a run.

---

## 3. Operator Execution Summary

- Log path recorded by operator:
  `/tmp/buyerrecon_stage2a_behavioural_localization_20260608T174402Z.jsonl`
- Module guard: `pg_module_loaded=true`.
- Scope guards (all enforced):
  - `duplicate_go_treated_as_single_run=true`
  - `writes_allowed=false`
  - `grant_allowed=false`
  - `extractor_rerun_allowed=false`
  - `worker_allowed=false`
  - `downstream_runtime_allowed=false`
  - `gate_4e_allowed=false`
  - `gate_4f_allowed=false`
- Transaction: `transaction_read_only_on=true`; **rollback completed**.

---

## 4. Sanitized JSONL Evidence Summary

All values below are structural metadata / booleans / aggregate counts only.
No row values, identifiers, payloads, or customer data are included.

### Target table — `public.session_behavioural_features_v0_2`
- `schema_usage=true`, `target_exists=true`.
- Table-level privileges:
  - `SELECT=false`
  - `INSERT=true`
  - `UPDATE=true`
  - `DELETE=false`
  - `TRUNCATE=false`
  - `REFERENCES=false`
  - `TRIGGER=false`

### Target column privilege counts
- `column_count=37`
- `column_select_true_count=5`
- `column_insert_true_count=37`
- `column_update_true_count=37`

### Target constraints
- `constraint_count=33`
- `primary_key_count=1`
- `unique_count=1`
- `foreign_key_count=0`

### Target sequence privileges
- `serial_sequence_count=1`
- `sequence_usage_true_count=1`
- `sequence_select_true_count=0`

### Source relation privilege counts
- `source_relation_present_count=2`
- `source_table_select_true_count=1`

### Source column select counts
- `source_column_count=69`
- `source_column_select_true_count=44`

### Aggregate counts (counts only — no rows returned)
- `accepted_events_aggregate_count=9`
- `session_features_aggregate_count=1`

---

## 5. Interpretation / Localization Finding

- Stage 2a successfully connected to the database and confirmed **read-only**
  execution (`transaction_read_only_on=true`, rollback completed).
- The useful localization signal is:
  - target table-level **SELECT remains false**;
  - only **5 of 37** target columns have SELECT;
  - **INSERT and UPDATE are true for all 37** target columns;
  - sequence **USAGE is true** and sequence **SELECT is false**.
- This is **consistent with** the behavioural extractor continuing to fail with
  `permission denied for table session_behavioural_features_v0_2`, **especially
  if** its `INSERT … ON CONFLICT … DO UPDATE` path reads existing target table
  columns during conflict/update expressions and therefore needs SELECT on
  columns (or the table) beyond the current 5-column grant.
- **This is a localized likely remaining permission gap, not a proven root
  cause.** The structured-error evidence needed to prove which exact operation/
  object/column triggers the denial was **not** obtained in this Stage 2a run
  (the relevant probe hit a diagnostic query-shape error — see §6). Final root
  cause must wait for later structured error-field evidence.

---

## 6. Diagnostic Query-Shape Limitation

Two probe-level errors occurred. Both are **diagnostic limitations**, not
extractor evidence:

- **`candidate_join_aggregate_count`** returned a PostgreSQL error:
  - `code=42703`, `severity=ERROR`, `routine=errorMissingColumn`;
  - all schema/table/column/constraint/detail/hint/where fields absent/false;
  - message redacted.
  - **Interpretation:** a diagnostic **query-shape / missing-column** issue in
    the probe itself (`42703` = undefined_column), **not** evidence about the
    extractor or about target privileges.
- **`target_limit_zero_select_probe`** then returned:
  - `code=25P02` (in_failed_sql_transaction), `severity=ERROR`,
    `routine=exec_simple_query`.
  - **Interpretation:** caused **only** by the prior `42703` aborting the
    transaction. This probe's result must **not** be used as evidence about
    target SELECT — it never actually evaluated target SELECT.

Because of these probe limitations, Stage 2a did **not** capture the structured
error fields from the real extractor statement path. That remains for a later,
separately-authorized step.

---

## 7. Stop-Lines Observed

- `transaction_read_only_on=true`; rollback completed.
- `writes_allowed=false`, `grant_allowed=false`,
  `extractor_rerun_allowed=false`, `worker_allowed=false`,
  `downstream_runtime_allowed=false`, `gate_4e_allowed=false`,
  `gate_4f_allowed=false`.
- `duplicate_go_treated_as_single_run=true` (one authorization, one run).
- No secrets, DSN, password, or token printed.
- No row values, raw identifiers, session/request IDs, payloads, or customer
  data printed (counts/booleans/structural metadata only).

---

## 8. What Did Not Run

- No GRANT / DML / DDL.
- No extractor rerun.
- No worker.
- No downstream runtime.
- No Stage 0, risk worker, POI worker, evidence snapshot.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.
- No Stage 2b terminal-upsert reproduction (not authorized by this step).

---

## 9. Next Gated Step

Next safe step is **Codex review and merge of this docs-only evidence PR**. Any
follow-up grant/fix, additional diagnostic, Stage 2b terminal-upsert
reproduction, or behavioural extractor rerun requires a **separate explicit
Helen GO**.

Any future fix still requires: review, explicit Helen GO, a post-fix proof PR,
and a new explicit extractor rerun GO before any rerun. Any future rerun must
be a separate operator session with all approved stop-lines active.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column / object names, aggregate counts, structural
PostgreSQL error codes/fields, or stop-line language only — not values.
