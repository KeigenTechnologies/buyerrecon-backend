# Sprint 3 — Stage 0 Read-Source SELECT Grant — Post-Grant Proof

**Status:** `STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS`

This is a **docs-only post-grant proof record**. It records that the **exact two
approved** read-source SELECT grants were executed by Helen on production, and
that the post-grant proof passed: the Stage 0 read-source SELECT gap is resolved
for `buyerrecon_scoring_worker`, with no broad privileges granted.

This PR runs **no** additional production command, **no** SQL, **no** additional
GRANT/DML/DDL, **no** Stage 0 execution, and **no** downstream runtime. It
records booleans/metadata only — no row values, identifiers, payloads, or
secrets.

> Provenance: command pack merged via PR #166 at
> `7b4e13c9bcb1e4c4de107887fd41a896d9604801`.

---

## 1. Title & Status

- Title: Stage 0 Read-Source SELECT Grant — Post-Grant Proof.
- Status: `STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS`.
- One line: the exact two approved grants were applied successfully; read-source
  SELECT gap resolved; Stage 0 execution still unauthorized.

---

## 2. Authorization & Scope

- Helen issued the GO: `HELEN STAGE0 READ-SOURCE SELECT GRANT GO`.
- The GO authorized **exactly one grant execution only** — the two
  `GRANT SELECT` statements in §6.
- It did **not** authorize Stage 0 execution, downstream runtime,
  Lane/scoring/AMS/customer output, Gate 4E/4F, or any ad-hoc grant.
- Helen executed the grant manually. Claude Code did not execute anything.

---

## 3. PR #166 Command-Pack Prerequisite

- Command pack merged: PR #166
  (`7b4e13c9bcb1e4c4de107887fd41a896d9604801`, status
  `STAGE0_READ_SOURCE_SELECT_GRANT_COMMAND_PACK_REVIEW_ONLY`), which fixed the
  read-source SELECT gap with exactly two `GRANT SELECT` statements and excluded
  all broader privileges.

---

## 4. Execution Summary

- Branch: `sprint2-architecture-contracts-d4cc2bf`.
- HEAD: `7b4e13c9bcb1e4c4de107887fd41a896d9604801`.
- Database: `buyerrecon_production`.
- Grantor `current_user`: `postgres`; `current_role`: `postgres`.
- Log path: `/tmp/stage0-read-source-select-grant-20260609T214013Z.log`.
- Grant command exit code: `0`.
- Transaction committed: **yes** (this is the intended, approved persistent
  grant).

Role existence:
- `scoring_worker_role_exists=true`
- `scoring_worker_can_login=false`

---

## 5. Pre-Grant Proof

Booleans only — for role `buyerrecon_scoring_worker`:
- `accepted_events_select=false`
- `ingest_requests_select=false`
- `stage0_insert=true`
- `stage0_update=true`
- `stage0_select_returning=true`

---

## 6. Exact Grants Executed

```sql
GRANT SELECT ON TABLE public.accepted_events TO buyerrecon_scoring_worker;
GRANT SELECT ON TABLE public.ingest_requests TO buyerrecon_scoring_worker;
```

Exactly these two statements — nothing more.

---

## 7. Post-Grant Proof

Booleans only — for role `buyerrecon_scoring_worker`:
- `accepted_events_select=true` (false → true)
- `ingest_requests_select=true` (false → true)
- `stage0_insert=true` (unchanged)
- `stage0_update=true` (unchanged)
- `stage0_select_returning=true` (unchanged)

---

## 8. Broad Privilege Negative Proof

Confirming no broad privileges were granted (all remain false):
- `accepted_events_delete=false`
- `ingest_requests_delete=false`
- `stage0_delete=false`
- `stage0_truncate=false`
- `stage0_references=false`
- `stage0_trigger=false`

---

## 9. Interpretation

- The **exact two approved grants were applied successfully** (exit 0,
  committed).
- The **Stage 0 read-source SELECT gap is resolved for
  `buyerrecon_scoring_worker`** (`accepted_events` SELECT and `ingest_requests`
  SELECT now true).
- Stage 0 **write-side privileges remained true** (`stage0_decisions`
  INSERT/UPDATE/SELECT unchanged); **no `stage0_decisions` grant was added**.
- **`buyerrecon_scoring_worker` remains NOLOGIN.**
- **No broad privileges were granted** (DELETE/TRUNCATE/REFERENCES/TRIGGER all
  false; no schema/DB-wide; no Lane/scoring/AMS/customer/Gate).
- **No Stage 0 execution occurred. No downstream runtime occurred.**
- This **proves the grant/fix only; it does not prove Stage 0 execution
  success.**
- The **login/member-role path remains unresolved before Stage 0 execution.**

---

## 10. What Did Not Run

- No additional production command by this PR.
- No SQL by this PR.
- No additional GRANT / DML / DDL; no permission fix.
- No Stage 0 execution.
- No extractor rerun.
- No risk worker / POI worker / evidence snapshot execution.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 11. Stop-Lines Observed

- Exactly the two approved `GRANT SELECT` statements; nothing beyond SELECT on
  the two read sources.
- No `stage0_decisions` grant added; no schema/DB-wide grant; no
  DELETE/TRUNCATE/REFERENCES/TRIGGER; no Lane/scoring/AMS/customer/Gate.
- Broad-privilege negative proof confirms no over-grant.
- `buyerrecon_scoring_worker` remains NOLOGIN (no login-capability change).
- No row values, raw identifiers, payload/customer data, or secrets printed; no
  DSN/password/token printed.
- No Stage 0 execution; no downstream runtime; no Gate 4E/4F.

---

## 12. Next Gated Step

1. **Codex review and merge** of this docs-only proof PR.
2. Then create a **separate docs-only login/member-role path planning PR or
   diagnostic** (unless an already-reviewed path exists), because
   `buyerrecon_scoring_worker` is NOLOGIN and cannot run Stage 0 directly.
3. Stage 0 execution still requires, in order:
   1. login/member-role path **resolved and proofed**;
   2. a **separate explicit Stage 0 execution GO**;
   3. **one** manual Stage 0 execution;
   4. a **docs-only Stage 0 execution evidence PR**.
4. **No ad-hoc grant. Stage 0 execution remains unauthorized** until the chain
   completes.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, SQL identifiers,
privilege-probe booleans, or stop-line / boundary language — not row values. No
DSN/secret was printed during the grant.
