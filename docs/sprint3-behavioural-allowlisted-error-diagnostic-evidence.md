# Sprint 3: Behavioural Allowlisted Error-Message Diagnostic — Evidence

**Status:** `BEHAVIOURAL_ALLOWLISTED_ERROR_DIAGNOSTIC_EXECUTED_NO_ALLOWLIST_MATCH`

This is a **docs-only evidence record**. It captures the result of the manual,
operator-run **Option A** allowlisted PostgreSQL error-message diagnostic. The
diagnostic reached PostgreSQL, made **exactly one** full-source-shaped upsert
attempt (rollback-contained), reproduced the permission error class (`42501` /
`aclcheck_error`), and — because the error message did not reduce cleanly to the
static allowlist — returned **no allowlist match** without printing the raw
message.

This PR applies **no** fix, authorizes **no** GRANT/DML/DDL, authorizes **no**
extractor rerun, and authorizes **no** worker or downstream runtime. It records
sanitized structured evidence only — no raw message, row values, identifiers,
payloads, or secrets.

---

## 1. Title & Status

- Title: Behavioural Allowlisted Error-Message Diagnostic — Evidence.
- Status: `BEHAVIOURAL_ALLOWLISTED_ERROR_DIAGNOSTIC_EXECUTED_NO_ALLOWLIST_MATCH`.
- One line: the permission error class reproduced (`42501` / `aclcheck_error`),
  but the allowlist classifier returned `message_allowlist_match=false` and
  `allowlisted_terms_found=[]`, so the exact denied object/column is **still not
  identified**.

---

## 2. Authorization & Scope

- Command-pack/operator-command artifact merged: PR #153
  (`8a959ebfbfe4749a0012b2e1029201d4c1d4eba9`).
- Helen issued the diagnostic GO:
  `HELEN BEHAVIOURAL ALLOWLISTED ERROR DIAGNOSTIC GO`
- Helen **manually** ran the allowlisted diagnostic **once** from the production
  host. Claude Code did not execute anything.
- No grant/fix, extractor rerun, worker, downstream runtime, or Gate 4E/4F was
  authorized or run.

---

## 3. Operator Execution Summary

- Exactly **one** full-source-shaped terminal-upsert attempt (36 insert
  columns, 32 `EXCLUDED.*` updates, same arbiter + RETURNING).
- Run inside `BEGIN` with `SET LOCAL` safety timeouts; **unconditional
  `ROLLBACK`**; **no `COMMIT`**.
- Data approach: `synthetic_fixture` (synthetic, namespaced, non-real values
  bound as parameters; never printed).
- Error message classified **in memory** against the static allowlist; raw
  message **never printed**.
- Log path recorded by operator:
  `/tmp/buyerrecon_allowlisted_error_diag_20260608T210548Z.jsonl`
- Cleanup: temp script cleanup command ran; `APP_DSN` cleanup command ran.

---

## 4. Sanitized JSONL Evidence (verbatim)

```json
{"stage":"allowlisted_error_diagnostic","reached_postgres":true,"transaction_started":true,"rolled_back":true,"commit_used":false,"attempts":1,"outcome":"error","data_approach":"synthetic_fixture","no_raw_message_printed":true,"no_row_values_printed":true,"no_secret_printed":true,"no_raw_identifier_printed":true,"no_grant_or_ddl":true,"dml_attempt_was_rollback_contained":true,"no_persistent_dml":true,"no_extractor_rerun":true,"no_worker_run":true,"no_downstream_runtime":true,"no_gate_4e":true,"no_gate_4f":true,"error":{"code":"42501","severity":"ERROR","routine":"aclcheck_error","schema_field_present":false,"table_field_present":false,"column_field_present":false,"constraint_field_present":false,"detail_present":false,"hint_present":false,"where_present":false,"message_redacted":true,"message_allowlist_match":false,"allowlisted_terms_found":[]}}
```

---

## 5. Interpretation

- The allowlisted diagnostic **reached PostgreSQL** (`reached_postgres=true`).
- The transaction **started** (`transaction_started=true`).
- **Exactly one** full-source-shaped, DML-shaped upsert attempt occurred
  (`attempts=1`).
- It was **rollback-contained** (`dml_attempt_was_rollback_contained=true`,
  `no_persistent_dml=true`).
- **`ROLLBACK` completed** (`rolled_back=true`); **no `COMMIT`** was used
  (`commit_used=false`).
- The **same permission error class reproduced**: SQLSTATE `42501`,
  `severity=ERROR`, `routine=aclcheck_error` — consistent with the persistent
  extractor failure and with Stage 2b (PR #150).
- Structured `schema/table/column/constraint/detail/hint/where` fields were
  **absent**.
- The raw PostgreSQL error message was **not printed**
  (`no_raw_message_printed=true`, `message_redacted=true`).
- The allowlist classifier returned **`message_allowlist_match=false`** and
  **`allowlisted_terms_found=[]`**.

---

## 6. Limitation / No Allowlist Match

- Because the classifier found **no clean allowlist match** (it redacts on any
  non-allowlisted residue or uncertainty), the diagnostic **did not identify the
  exact denied object/column**.
- This is a **safe-by-design outcome**: the classifier preferred redaction over
  emitting anything outside the static allowlist. It does **not** mean the
  message lacked an object name — only that the message could not be reduced
  cleanly to allowlisted tokens, so nothing was emitted.
- **Do not over-claim root cause.** The finding remains:
  - permission denial **reproduced** on the full-source-shaped upsert path
    (`42501` / `aclcheck_error`);
  - the **exact missing privilege / denied object / denied column is still
    unidentified**;
  - any grant/fix must remain **evidence-led and least-privilege**, or require
    **explicit risk acceptance** (per the PR #151 decision plan).

---

## 7. What Did Not Run

- No GRANT / DDL; one DML-shaped upsert attempt occurred, was rollback-contained,
  and produced no persistent DML.
- No grant / fix.
- No extractor rerun.
- No worker.
- No downstream runtime.
- No Stage 0, risk worker, POI worker, evidence snapshot.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 8. Stop-Lines Observed

- Exactly one attempt (`attempts=1`); no re-run.
- Rollback-contained; `rolled_back=true`; `commit_used=false`;
  `no_persistent_dml=true`; `dml_attempt_was_rollback_contained=true`.
- `no_grant_or_ddl=true`.
- `no_raw_message_printed=true`; `message_redacted=true`;
  `message_allowlist_match=false`; `allowlisted_terms_found=[]` (redact-on-miss).
- `no_secret_printed=true`, `no_row_values_printed=true`,
  `no_raw_identifier_printed=true`.
- `no_extractor_rerun=true`, `no_worker_run=true`, `no_downstream_runtime=true`.
- `no_gate_4e=true`, `no_gate_4f=true`.
- Cleanup completed: temp script cleanup ran; `APP_DSN` cleanup ran.

---

## 9. Next Gated Step

1. **Codex review and merge** of this docs-only evidence PR.
2. Because Option A **did not identify** the denied object/column, decide
   whether to proceed with **Option B least-privilege fix planning** — with
   **explicit risk acceptance** (since the exact object/column was not exposed),
   per the PR #151 decision plan.
3. Any future **grant/fix** requires separate planning / review / **explicit
   Helen GO**.
4. Any **extractor rerun** requires a **post-fix proof PR** and a **separate
   explicit extractor rerun GO**.
5. No grant/fix or rerun is authorized by this evidence PR. Any future rerun
   must be a separate operator session with all approved stop-lines active.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, customer data, or any raw PostgreSQL error
message. All identifier references are column / object names or stop-line /
boundary language only; all evidence values are sanitized booleans / structured
PostgreSQL error fields (`code`, `severity`, `routine`, present-booleans,
allowlist-match booleans) — not business row values.
