# Sprint 3: Behavioural Output — Option B Grant-Fix Command Pack (Review-Only)

**Status:** `BEHAVIOURAL_OPTION_B_GRANT_FIX_COMMAND_PACK_REVIEW_ONLY`

This document is a **reviewable, docs-only grant/fix command pack** for the
Option B least-privilege permission fix, chosen per the PR #155 decision plan
after repeated `42501 / aclcheck_error` reproduction on the full-source-shaped
behavioural upsert, **with explicit risk acceptance** because the exact denied
object/column was not exposed.

This PR **runs no SQL and applies no grant**. The candidate SQL below is
**`CANDIDATE ONLY — DO NOT RUN`**. Claude Code does not execute it; future
execution is manual, Helen-operated, and separately GO-gated.

> Provenance: base `sprint2-architecture-contracts-d4cc2bf`; Option B decision
> plan merged via PR #155 at `da1c62f4f90dd61a8f5d47ac32fdd2da3d38f9eb`.

---

## 1. Risk Acceptance (verbatim)

> "We accept that the exact denied object/column was not exposed by PostgreSQL
> structured fields or by the allowlisted classifier. We are choosing the
> least-privilege candidate fix based on repeated `42501 / aclcheck_error`
> reproduction on the full-source-shaped behavioural upsert and prior privilege
> evidence. If post-fix proof or extractor rerun fails, we will stop and record
> evidence; we will not stack ad-hoc grants."

This is a **risk-accepted candidate**, **not** a proven exact-object fix.

---

## 2. Evidence Carried Forward

- **PR #145 — Stage 2a** (read-only, **rolled back**): target table-level
  `SELECT=false`, `INSERT=true`, `UPDATE=true`; target column SELECT true for
  only 5/37, INSERT/UPDATE true for 37/37; sequence USAGE=true, SELECT=false;
  `42703` was a query-shape limitation, follow-on `25P02` was transaction-abort
  fallout; **neither was extractor proof.**
- **PR #146** — obvious SELECT surfaces (arbiter + RETURNING) appear already
  covered by the existing 5-column SELECT grant; `DO UPDATE SET` reads only
  `EXCLUDED.*`; **table-level SELECT not automatically justified.**
- **PR #150 — Stage 2b** — full-source-shaped terminal upsert reproduced
  `42501 / aclcheck_error`; one rollback-contained DML-shaped attempt; no
  COMMIT; no persistent DML; structured fields absent.
- **PR #154 — Option A** — allowlisted diagnostic reproduced
  `42501 / aclcheck_error`; raw message not printed;
  `message_allowlist_match=false`; `allowlisted_terms_found=[]`; **exact denied
  object/column still unidentified.**
- **PR #155** — B2 allowed **only** with explicit uncertainty/risk acceptance;
  **do not stack ad-hoc grants** if proof/rerun fails.

---

## 3. Candidate Fix Selection (one candidate for the first attempt)

Per the PR #155 least-privilege order, this pack selects **one** candidate for
the first fix attempt:

```sql
-- CANDIDATE ONLY — DO NOT RUN
GRANT SELECT ON TABLE public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;
```

**Rationale:**
- Column-level obvious SELECT surfaces appear **already covered**, so a narrow
  obvious-column grant would likely be a **no-op** (PR #146).
- The full-source-shaped upsert **repeatedly** fails with `42501`
  (PR #150, PR #154).
- Table-level SELECT on **this one target table** is broader than ideal, but is
  **bounded to the single target table**.
- **No** DELETE / TRUNCATE / REFERENCES / TRIGGER.
- **No** schema-wide grant.
- **No** Lane / scoring / customer / AMS / Gate privileges.
- **No** extractor rerun included.

This is a **risk-accepted candidate**, not a proven exact-object fix.

---

## 4. Future Execution Gate

The candidate SQL is **not** authorized to run by this PR. Future execution
requires **all** of:

1. **Codex review** of this command pack;
2. **merge** of this docs-only PR;
3. **exact Helen GO** for execution;
4. **one production grant/fix execution only** (manual, Helen-operated; DB/role
   gates verified; no DSN/secret printed).

---

## 5. Preflight Commands (structural context only — booleans/counts, no rows)

> CANDIDATE ONLY — DO NOT RUN. Run as a superuser/owner role authorized to grant
> (e.g. `postgres`), inside the gated session. Prints only names/booleans/counts.

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Identity / DB gate (names only):
SELECT current_database() AS db, current_user AS cur_user, current_role AS cur_role;

-- Target-role table privilege booleans (no rows):
SELECT
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'SELECT') AS table_select,
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'INSERT') AS table_insert,
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'UPDATE') AS table_update;

-- Column SELECT count for the target role (count only, no values):
SELECT count(*) AS column_select_true_count
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'session_behavioural_features_v0_2'
  AND has_column_privilege('buyerrecon_prod_collector_app',
        'public.session_behavioural_features_v0_2', c.column_name, 'SELECT');

-- Sequence USAGE/SELECT booleans (no rows):
SELECT
  has_sequence_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2_behavioural_features_id_seq', 'USAGE') AS seq_usage,
  has_sequence_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2_behavioural_features_id_seq', 'SELECT') AS seq_select;
```

Expected preflight (from prior evidence): `table_select=false`,
`table_insert=true`, `table_update=true`, `column_select_true_count=5`,
`seq_usage=true`, `seq_select=false`. **No row reads; no raw values.**

---

## 6. Candidate Fix SQL

> CANDIDATE ONLY — DO NOT RUN — requires Codex review + merge + exact Helen GO.
> One execution only. Wrap in a transaction; the operator decides COMMIT only
> under the explicit GO; otherwise ROLLBACK.

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Target role: buyerrecon_prod_collector_app
-- Target table: public.session_behavioural_features_v0_2 (single table only)
GRANT SELECT ON TABLE public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;
```

Intentionally **not** included: any privilege beyond SELECT; any table other
than the single target; DELETE/TRUNCATE/REFERENCES/TRIGGER; schema-wide grants;
sequence SELECT (not shown required); Lane/scoring/customer/AMS/Gate
privileges; any extractor rerun.

---

## 7. Post-Fix Proof Commands (booleans/counts only — no rows)

> CANDIDATE ONLY — DO NOT RUN. Re-run §5 after the grant, as the proof, and
> confirm the intended deltas. Emit booleans/counts only.

```sql
-- CANDIDATE ONLY — DO NOT RUN — post-fix proof (re-uses §5 probes)
SELECT
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'SELECT') AS table_select,   -- expect: true
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'INSERT') AS table_insert,   -- expect: true (unchanged)
  has_table_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2', 'UPDATE') AS table_update;   -- expect: true (unchanged)

SELECT count(*) AS column_select_true_count
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'session_behavioural_features_v0_2'
  AND has_column_privilege('buyerrecon_prod_collector_app',
        'public.session_behavioural_features_v0_2', c.column_name, 'SELECT');  -- expect: 37/37

SELECT
  has_sequence_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2_behavioural_features_id_seq', 'USAGE') AS seq_usage,   -- expect: true (unchanged)
  has_sequence_privilege('buyerrecon_prod_collector_app',
    'public.session_behavioural_features_v0_2_behavioural_features_id_seq', 'SELECT') AS seq_select;  -- expect: false (unchanged)
```

Expected post-fix:
- table-level SELECT boolean becomes **true**;
- column SELECT count becomes **37/37** (PostgreSQL reports table-level SELECT
  through per-column privilege checks);
- INSERT/UPDATE remain **true**;
- sequence USAGE remains **true**;
- sequence SELECT remains **false** (not required unless separately proven).

**Proof must be booleans/counts only — no row values, no payload/customer data,
no raw identifiers, no DSN/password/token. No extractor rerun in the proof.**

---

## 8. Post-Fix Evidence PR Requirements

After a future execution, a separate **docs-only proof PR** must record:

- the exact command executed (the §6 `GRANT SELECT … ` line);
- pre/post privilege **booleans/counts** (the §5 / §7 deltas);
- **no** row values; **no** secrets; **no** raw identifiers;
- **no** extractor rerun;
- **no** worker / downstream / Gate 4E / Gate 4F.

---

## 9. Stop-Lines (abort before execution if ANY is true)

- the target role is not `buyerrecon_prod_collector_app`;
- the target table is not exactly `public.session_behavioural_features_v0_2`;
- the command would grant beyond `SELECT`;
- the command would grant beyond the single target table;
- the command would grant DELETE / TRUNCATE / REFERENCES / TRIGGER;
- the command would touch schema-wide privileges;
- the command would touch Lane / scoring / customer / AMS / Gate privileges;
- the command would print DSN / password / token;
- the command would read rows or payload / customer data;
- the command would run extractor / worker / downstream runtime.

If any stop-line trips, **do not execute** — record a sanitized blocked
evidence note instead.

---

## 10. What This PR Does Not Authorize

- no production command;
- no SQL execution;
- no GRANT execution;
- no extractor rerun;
- no worker / downstream runtime;
- no Lane A/B;
- no scoring runtime;
- no AMS Trust / Pass runtime;
- no customer output;
- no Gate 4E / Gate 4F.

---

## 11. Next Gated Step

1. **Codex review** of this command pack.
2. **Merge** this docs-only PR.
3. **Exact Helen GO** for execution.
4. **One** production grant/fix execution (manual, Helen-operated).
5. **Post-fix proof PR** (booleans/counts only).
6. **Separate extractor rerun GO** only **after** the post-fix proof PR merges.

If post-fix proof or the extractor rerun fails, **stop and record evidence; do
not stack ad-hoc grants.**

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / table / column / sequence **names**, candidate SQL
structure, or boolean/count probe concepts — not row values. The candidate SQL
is fenced `CANDIDATE ONLY — DO NOT RUN` and is not executed by this PR.
