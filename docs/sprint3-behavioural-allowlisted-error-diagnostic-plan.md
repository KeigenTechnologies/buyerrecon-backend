# Sprint 3: Behavioural Output — Allowlisted Error-Message Diagnostic Plan (Option A)

**Status:** `BEHAVIOURAL_ALLOWLISTED_ERROR_DIAGNOSTIC_PLANNING_ONLY`

This is a **docs-only planning record** for the **Option A** path recommended in
PR #151: a future, tightly-scoped diagnostic that classifies the PostgreSQL
`42501` error **message** safely — **without printing raw error text or
secrets** — because Stage 2b's structured fields did not expose the denied
object/column.

This PR runs **no** diagnostic, **no** production command, **no** SQL, applies
**no** GRANT/DML/DDL, runs **no** extractor rerun, and runs **no** worker or
downstream runtime. The design below is **planning only**; nothing is authorized
for execution.

---

## 1. Title & Status

- Title: Behavioural Output — Allowlisted Error-Message Diagnostic Plan (Option A).
- Status: `BEHAVIOURAL_ALLOWLISTED_ERROR_DIAGNOSTIC_PLANNING_ONLY`.
- This PR plans Option A only; it does not execute it and does not authorize a
  grant/fix.

---

## 2. Evidence Chain (PR #145–#151)

- **PR #145** — Stage 2a read-only localization, **rolled back**: target
  table-level `SELECT=false`, `INSERT=true`, `UPDATE=true`; target column SELECT
  true for only 5/37, INSERT/UPDATE true for 37/37; sequence USAGE=true,
  SELECT=false; unqualified vs `public.`-qualified resolve to the same OID. The
  `42703` probe error was a diagnostic query-shape limitation, and the follow-on
  `25P02` was transaction-abort fallout; neither was extractor proof.
- **PR #146** — obvious SELECT surfaces (conflict arbiter + RETURNING) appear
  already covered by the existing 5-column SELECT grant; `DO UPDATE SET` reads
  only `EXCLUDED.*`; table-level SELECT is **not** automatically justified.
- **PR #147 / #148 / #149** — Stage 2b plan, in-repo command-pack artifact, and
  manual operator commands (DSN narrowed to `DATABASE_URL` only).
- **PR #150** — Stage 2b terminal-upsert evidence: full-source-shaped upsert,
  `reached_postgres=true`, one attempt,
  `dml_attempt_was_rollback_contained=true`, `rolled_back=true`,
  `commit_used=false`, no persistent DML; outcome `42501` / `aclcheck_error`;
  structured `schema/table/column/constraint/detail/hint/where` fields were
  absent.
- **PR #151** — permission-fix decision plan
  (merge `f5311c5f8a4d4bbfe39383491035215fb498424a`): recommended **Option A
  first** (this diagnostic) before any grant/fix.

---

## 3. Why Another Diagnostic Is Being Considered

- Stage 2b's **structured error fields were empty**, so the denied
  object/column is not identifiable from structured metadata.
- **Raw grant guessing is risky:** PR #146 showed the obvious SELECT surfaces
  are already covered, so a blind table-level SELECT grant could over-grant
  without resolving the failure.
- PostgreSQL's `42501` **message text** frequently names the object (e.g.
  "permission denied for table …" / "… for sequence …"), but **raw message
  output is unsafe** unless it is allowlisted and redact-on-miss. Option A
  captures that signal safely.

---

## 4. Diagnostic Objective

- **One** rollback-contained, **full-source-shaped** terminal-upsert attempt
  (identical shape to Stage 2b: 36 insert columns, 32 `EXCLUDED.*` updates, same
  arbiter, same RETURNING).
- Capture **only an allowlisted classification** of the error message terms.
- **No raw message printing** under any circumstance.
- Output: sanitized booleans / SQLSTATE / routine / allowlist-match results
  only — no row values, identifiers, payloads, or secrets.

---

## 5. Allowlist Design

Only **static, known-safe** terms may ever be emitted. The candidate allowlist:

- `permission denied`
- `relation`
- `table`
- `column`
- `sequence`
- `schema`
- `session_behavioural_features_v0_2`
- **source-shape column names only** (the 36/32 columns already enumerated in
  the merged Stage 2b command pack)
- the **confirmed sequence name only if** source/DB inspection confirms it
  (e.g. the `behavioural_features_id` serial sequence) — otherwise omitted.

Classifier behavior:

- The classifier checks the raw message **in memory** against the allowlist and
  emits only which allowlisted terms matched (a bounded, static set) — it never
  writes the raw message to output/logs.
- **If any non-allowlisted content appears** in the message (or the message
  cannot be fully reconciled to the allowlist), emit **only**:
  - `message_redacted=true`
  - `message_allowlist_match=false`
  - **no raw message**
- The allowlist contains **no values** — only static object/privilege words and
  known schema identifiers (column/object names), never row data.

---

## 6. Data Safety

The future diagnostic must never output:

- DSN / password / token;
- raw row values;
- raw identifiers;
- payload / customer data;
- raw `session_id` / `request_id`;
- hostname / IP / UUID / cloud token.

Synthetic, namespaced fixtures (as in the Stage 2b pack) are bound as
parameters and never printed; the DSN is loaded via the `DATABASE_URL`-only
parse (per PR #149) and never echoed.

---

## 7. Execution Shape (future only)

- **Future only** — not executed by this PR.
- Requires a **separate explicit Helen GO**.
- **One attempt only**, **full-source-shaped** upsert only (re-verified against
  HEAD before execution; reduced-column shape is a stop-line).
- Transaction discipline:
  - `BEGIN`
  - `SET LOCAL statement_timeout`, `SET LOCAL idle_in_transaction_session_timeout`,
    `SET LOCAL lock_timeout`
  - **one** attempt
  - **unconditional `ROLLBACK`**
  - **no `COMMIT`**
- DSN loaded via `DATABASE_URL`-only parse into `APP_DSN`; run in a fresh/
  ephemeral shell; never echo secrets; `unset APP_DSN` on completion.

---

## 8. Expected Sanitized JSONL Fields

```json
{
  "stage": "2b-allowlisted-error-classification",
  "reached_postgres": true,
  "transaction_started": true,
  "rolled_back": true,
  "commit_used": false,
  "attempts": 1,
  "outcome": "error",
  "error": {
    "code": "42501",
    "severity": "ERROR",
    "routine": "aclcheck_error",
    "schema_field_present": false,
    "table_field_present": false,
    "column_field_present": false,
    "constraint_field_present": false,
    "detail_present": false,
    "hint_present": false,
    "where_present": false
  },
  "message_redacted": true,
  "message_allowlist_match": false,
  "allowlisted_terms_found": [],
  "no_raw_message_printed": true,
  "no_secret_printed": true,
  "no_row_values_printed": true,
  "no_raw_identifier_printed": true,
  "no_persistent_dml": true,
  "dml_attempt_was_rollback_contained": true,
  "no_grant_or_ddl": true,
  "no_extractor_rerun": true,
  "no_worker_run": true,
  "no_downstream_runtime": true,
  "no_gate_4e": true,
  "no_gate_4f": true
}
```

- `allowlisted_terms_found` is emitted **only** when `message_allowlist_match`
  is `true` and every matched term is in the static allowlist; otherwise it is
  `[]` and `message_redacted=true`.
- The corrected DML wording is retained (`no_grant_or_ddl`,
  `dml_attempt_was_rollback_contained`, `no_persistent_dml`); the misleading
  `no_grant_dml_ddl` field is **not** used.

---

## 9. Stop-Lines (abort before/within execution if ANY is true)

- a raw message would be printed;
- the message contains non-allowlisted content and the script cannot suppress
  it (must redact and emit `message_allowlist_match=false` instead);
- the source shape cannot be re-verified against HEAD;
- the full source shape cannot be mirrored;
- more than one attempt would be required;
- rollback cannot be guaranteed;
- any `COMMIT` path exists;
- a grant/fix would be required first;
- extractor / worker / downstream runtime would run;
- Lane/scoring/AMS/customer output would be touched;
- Gate 4E or Gate 4F would be touched;
- hostname / IP / UUID / cloud token would be printed;
- DSN / secret / raw identifier / row value / payload / customer data would be
  exposed.

If a stop-line trips, do not run the attempt — emit a sanitized `blocked`
result and record it in the evidence PR.

---

## 10. What This PR Does Not Authorize

- no diagnostic execution;
- no production command;
- no SQL;
- no GRANT / DML / DDL;
- no grant / fix;
- no extractor rerun;
- no worker / downstream runtime;
- no Lane A/B;
- no scoring runtime;
- no AMS Trust / Pass runtime;
- no customer output;
- no Gate 4E / Gate 4F.

---

## 11. Next Gated Step

1. **Codex review and merge** of this docs-only planning PR.
2. Then, if needed, a **command-pack / operator-command PR** implementing the
   allowlisted classifier (reviewed in-repo, as with Stage 2b).
3. Then a **separate explicit Helen GO** for one execution.
4. Then a **docs-only evidence PR** recording the sanitized JSONL and the
   allowlisted classification.

No diagnostic, grant/fix, extractor rerun, worker, or downstream runtime is
authorized until that gated chain occurs. Any future rerun remains separately
gated after a post-fix proof.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are column / object names, SQLSTATE / allowlist-term concepts, or
stop-line / boundary language only — not values.
