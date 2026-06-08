# Sprint 3: Behavioural Grant Localization — Stage 2b Terminal-Upsert Reproduction Plan

**Status:** `STAGE2B_TERMINAL_UPSERT_REPRODUCTION_PLANNING_ONLY`

This is a **docs-only planning record**. It plans a future, tightly bounded
Stage 2b terminal-upsert reproduction to identify the **exact** failing
PostgreSQL operation/object using **structured error fields only**.

**This PR plans Stage 2b only; it does not run it.** No SQL, no production
command, no DB command, no Stage 2b execution, no GRANT/DML/DDL, no extractor
rerun, no worker, no downstream runtime. Any candidate operator design below is
**CANDIDATE ONLY — DO NOT RUN**.

---

## 1. Title & Status

- Title: Behavioural Grant Localization — Stage 2b Terminal-Upsert Reproduction Plan.
- Status: `STAGE2B_TERMINAL_UPSERT_REPRODUCTION_PLANNING_ONLY`.
- This PR is **planning only**. Stage 2b execution requires a separate explicit
  Helen GO **after** Codex review and merge of this plan.

---

## 2. Background / Evidence Chain

- **PR #145** (Stage 2a read-only localization evidence, merge
  `84df5c6ff18299813ebd7eeed4b4c7500a52eb02`) confirmed, read-only and rolled
  back, on `public.session_behavioural_features_v0_2`: table-level SELECT=false,
  INSERT=true, UPDATE=true; target column SELECT true for only 5/37, INSERT/
  UPDATE true for 37/37; sequence USAGE=true, SELECT=false. Its `42703`
  (query-shape / missing column) and follow-on `25P02` (transaction-abort
  fallout) were **diagnostic limitations, not extractor proof**.
- **PR #146** (target SELECT grant-fix planning, merge
  `aa9f46a87177c99d90f47ee04df389d047fe9610`) concluded via source review that
  the upsert's obvious SELECT-touching surfaces (conflict arbiter columns,
  RETURNING columns; `DO UPDATE SET` reads `EXCLUDED.*`) appear **already
  covered** by the existing 5-column SELECT grant — so a table-level SELECT
  grant may **over-grant**, and an obvious-column grant may be a **no-op**.

### Why Stage 2b is needed
- Stage 2a **localized a likely** permission gap but did **not prove** the exact
  failing object/operation.
- Because PR #146 showed the obvious target SELECT surfaces may already be
  covered, a blind table-level SELECT grant risks over-granting without proof.
- Stage 2b should produce **structured PostgreSQL error fields** from a
  terminal-upsert reproduction **before** any grant/fix is chosen, turning the
  "likely gap" into evidence about the exact denied operation/object/column.

---

## 3. Stage 2b Objective

- Reproduce the behavioural extractor's **terminal upsert shape** as closely as
  possible (the `INSERT … ON CONFLICT … DO UPDATE … RETURNING` statement).
- Run **exactly one** reproduction attempt.
- Capture **only structured PostgreSQL error metadata**:
  - SQLSTATE `code`
  - `severity`
  - `routine`
  - schema-field-present boolean
  - table-field-present boolean
  - column-field-present boolean
  - constraint-field-present boolean
  - detail-present / hint-present / where-present booleans
  - **message redacted**
- Capture structural **success/failure booleans only**.
- **No** raw row values. **No** raw identifiers. **No** `session_id` /
  `request_id` values. **No** payload / customer data. **No** DSN / password /
  token output.

---

## 4. Critical Write-Shaped Nature of Stage 2b

- Stage 2b is **write-shaped** because it reproduces an upsert (INSERT/UPDATE
  path), unlike the read-only Stage 2a.
- It must be **rollback-contained**:
  1. `BEGIN`
  2. optional local safety settings (e.g. `SET LOCAL statement_timeout`,
     `SET LOCAL idle_in_transaction_session_timeout`)
  3. **one** upsert-shaped attempt
  4. `ROLLBACK` (guaranteed; **no COMMIT**)
- It must **not** be run under a docs-only planning PR (including this one).
- It requires a **separate explicit Helen GO** after Codex review and merge of
  this planning PR.

---

## 5. Required Source-Grounding Before Execution

Before any Stage 2b execution, the operator must inspect source and identify
(the final execution script must be **source-grounded** before any GO):

- exact behavioural extractor function / file path;
- exact `INSERT … ON CONFLICT … DO UPDATE … RETURNING` statement shape;
- target table;
- conflict (arbiter) columns;
- insert columns;
- update columns;
- returning columns;
- whether the source SQL reads existing target-table values or only
  `EXCLUDED.*`;
- whether any triggers / defaults / constraints could require additional
  privileges.

> Placeholders may stand in below until the exact source lines are copied into
> the execution script, but the execution script must be fully source-grounded
> before any GO. (Prior read-only source review for context, to be re-verified
> at execution time: the statement is a single
> `INSERT … ON CONFLICT (<arbiter cols>) DO UPDATE SET … = EXCLUDED.<col> …
> RETURNING <id + arbiter cols>` executed as one `pool.query(...)`; `DO UPDATE
> SET` right-hand sides observed as `EXCLUDED.*` only. Re-confirm at execution
> time — do not assume.)

---

## 6. Candidate Execution Design — CANDIDATE ONLY — DO NOT RUN

This is a **high-level** operator design, not runnable production SQL. The
future execution should:

- load the production app DSN **without printing it**;
- confirm the DB target **structurally** without printing secrets;
- connect **as the same app role that failed** (the extractor's app role);
- set safe local timeouts;
- `BEGIN` a transaction;
- execute **one** terminal-upsert-shaped reproduction using a **safe data
  approach** (see §7) that does **not** reveal raw values;
- **catch and sanitize** PostgreSQL error fields (structured metadata only);
- `ROLLBACK`;
- emit **JSONL only** (booleans / structural error fields / counts);
- **stop immediately** on any secret / raw-data exposure.

```text
CANDIDATE ONLY — DO NOT RUN — illustrative control flow, not executable here
# requires: Codex review + merge of this plan, then explicit Helen GO
BEGIN
  SET LOCAL statement_timeout = <small>
  SET LOCAL idle_in_transaction_session_timeout = <small>
  <one upsert-shaped attempt, source-grounded, safe data per §7>
ROLLBACK
# on any error: capture {code, severity, routine, *_field_present booleans},
#   redact message, emit JSONL, never print row values or secrets
```

No actual values, UUIDs, session IDs, request IDs, payloads, customer data,
token values, DSN, hostnames, or IPs appear in this document.

---

## 7. Data-Safety Design

The plan requires **one** of these safe data approaches:

- **Preferred — synthetic fixture values:** values that cannot collide with
  real customer identifiers and are rollback-contained, **if** the schema and
  constraints permit (FKs were observed as 0 in Stage 2a, which is favorable —
  re-verify at execution time).
- **Alternative — source-derived values used internally only:** source-derived
  values may be used **inside** the SQL but **never printed**; output must
  remain aggregate / boolean / error-field only.
- **If safe value construction is not possible:** Stage 2b must **stop before
  running** and record a **blocked evidence PR** rather than risk exposing or
  writing unsafe data.

The objective is the privilege **error class**, not row content — so a synthetic
or non-printed value that merely exercises the upsert privilege path is
sufficient, and `ROLLBACK` guarantees no persistence.

---

## 8. Stop-Lines

Stage 2b execution must **stop** if:

- DSN / password / token would be printed;
- raw `session_id` or `request_id` would be printed;
- payload / customer data would be printed;
- raw row values would be emitted;
- more than one upsert attempt would be needed;
- a transaction cannot be guaranteed rollback-contained;
- the operator cannot verify the exact source upsert shape;
- the script would require a broad grant first;
- the script would run extractor / worker / downstream runtime;
- the script would touch Lane A/B, scoring, AMS Trust/Pass, customer output,
  Gate 4E, or Gate 4F.

---

## 9. What This PR Does Not Authorize

This planning PR does **not** authorize:

- Stage 2b execution;
- SQL execution;
- production commands;
- GRANT/DML/DDL outside the future rollback-contained upsert attempt (and even
  that requires a separate explicit GO);
- any grant / fix;
- extractor rerun;
- worker / downstream runtime;
- Lane A/B;
- scoring runtime;
- AMS Trust / Pass runtime;
- customer output;
- Gate 4E / Gate 4F.

---

## 10. Future GO Phrase (do not execute)

The exact future GO phrase for execution is:

`HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO`

After Codex review / merge of this plan, that phrase would authorize **only**:

- **one** rollback-contained Stage 2b terminal-upsert reproduction;
- structured PostgreSQL error fields / booleans only;
- **no** raw values / customer data / secrets;
- **no** grant / fix;
- **no** extractor rerun;
- **no** worker / downstream / Gate 4E / Gate 4F.

This document does **not** execute that phrase.

---

## 11. Expected Evidence PR After Execution

After a future Stage 2b run, a separate **docs-only evidence PR** must record:

- whether the reproduction reached PostgreSQL;
- that the transaction started and **rolled back**;
- that exactly **one** attempt occurred;
- sanitized structured error fields, or sanitized success/failure booleans;
- interpretation of the **exact failing object/operation** if PostgreSQL
  provides the fields;
- **no** raw values / secrets;
- **no** grant / fix / extractor / worker / downstream / Gate 4E / Gate 4F.

---

## 12. Next Gated Step

1. **Codex narrow review** of this docs-only planning PR.
2. **Merge** the docs-only planning PR.
3. Then a **separate explicit Helen GO** for Stage 2b execution, if accepted.

No grant, SQL, diagnostic, Stage 2b run, extractor rerun, worker, or downstream
runtime is authorized until that gated step occurs.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column / object names, SQL-shape concepts, structured
PostgreSQL error-field names, or stop-line language only — not values.
