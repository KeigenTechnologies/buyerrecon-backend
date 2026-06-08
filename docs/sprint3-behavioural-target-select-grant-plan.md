# Sprint 3: Behavioural Target SELECT Grant Fix — Planning (Candidate)

**Status:** `BEHAVIOURAL_TARGET_SELECT_GRANT_FIX_PLANNING_ONLY`

This is a **docs-only planning record**. It plans, but does **not** execute, a
least-privilege grant/fix candidate for the **localized likely remaining
permission gap** on `public.session_behavioural_features_v0_2`, based on the
Stage 2a evidence merged in PR #145.

This PR applies **no** fix, runs **no** SQL, runs **no** production command,
runs **no** diagnostic, runs **no** extractor rerun, runs **no** Stage 2b
reproduction, and runs **no** worker or downstream runtime. All options below
are **candidate only**. Nothing here is authorized for execution.

---

## 1. Current Evidence Summary (from PR #145)

Stage 2a (PR #145, merge `84df5c6ff18299813ebd7eeed4b4c7500a52eb02`) ran
read-only and rolled back, with no GRANT/DML/DDL, extractor rerun, worker,
downstream runtime, Gate 4E, or Gate 4F. It recorded, for
`public.session_behavioural_features_v0_2`:

- Target table exists.
- Table-level privileges: `SELECT=false`, `INSERT=true`, `UPDATE=true`,
  `DELETE=false`, `TRUNCATE=false`, `REFERENCES=false`, `TRIGGER=false`.
- Target columns: `column_count=37`, `column_select_true_count=5`,
  `column_insert_true_count=37`, `column_update_true_count=37`.
- Sequence: `serial_sequence_count=1`, `sequence_usage_true_count=1`,
  `sequence_select_true_count=0`.
- Source relations: `source_relation_present_count=2`,
  `source_table_select_true_count=1`; source columns
  `source_column_count=69`, `source_column_select_true_count=44`.
- Aggregates (counts only): `accepted_events_aggregate_count=9`,
  `session_features_aggregate_count=1`.
- **Diagnostic limitation:** `candidate_join_aggregate_count` failed with
  `42703` / `errorMissingColumn` due to diagnostic **query shape**; the
  follow-on `25P02` was transaction-abort fallout. **Neither is extractor
  evidence**, and Stage 2a did **not** capture structured error fields from the
  real extractor statement path.

---

## 2. Status of the Finding: Localized Likely Gap, Not Proven Root Cause

The current finding is a **"localized likely remaining permission gap,"**
**not** a proven root cause. Stage 2a confirmed the privilege state but did not
reproduce or localize the extractor's actual `permission denied`. Any candidate
below is therefore offered for planning, with a strong preference for obtaining
**structured error-field proof** before changing permissions (see §5).

---

## 3. Why Target SELECT Is the Leading Candidate

The leading (not proven) direction is a SELECT-side gap on the target:

- Table-level `SELECT=false` on the target.
- Only **5 of 37** target columns have SELECT, while **INSERT/UPDATE are true
  for all 37**, and sequence **USAGE is already true**.
- The extractor failure remains
  `permission denied for table session_behavioural_features_v0_2`, and the
  earlier table-level INSERT/UPDATE fix (PR #140) did not resolve it.
- An `INSERT … ON CONFLICT … DO UPDATE … RETURNING` path **may** require
  reading existing target columns depending on the SQL expressions / RETURNING
  / conflict path — so a SELECT requirement beyond the current 5 columns is
  plausible.

### Important honesty check from source review (read-only)
A read-only review of `scripts/extract-behavioural-features.ts` shows the
target upsert's **apparent** SELECT-touching surfaces are **already covered**
by the 5 granted SELECT columns:

- **Conflict arbiter:** `ON CONFLICT (workspace_id, site_id, session_id, feature_version)`.
- **RETURNING:** `behavioural_features_id, workspace_id, site_id, session_id`.
- **`DO UPDATE SET`:** every right-hand side is `EXCLUDED.*` (the proposed row);
  it reads **no** existing target-row values.

The 5 currently-granted SELECT columns (`behavioural_features_id`,
`feature_version`, `session_id`, `site_id`, `workspace_id`) **already include
all** arbiter and RETURNING columns. So the obvious column-level SELECT needs
appear **already satisfied**, which means:

- the remaining gap is **not** an obviously-missing specific column from the
  inspected statement, and
- granting table-level SELECT (Option A) might **over-grant** without a proven
  need, while a narrow column grant (Option B) might be a **no-op** unless the
  proof identifies a specific additional column or object.

This strengthens the case for getting structured error-field proof first
(Option C) rather than guessing. Do **not** treat table-level SELECT as
required on current evidence.

---

## 4. Candidate Fix Options (candidate-only; none applied)

> All SQL below is illustrative and **CANDIDATE ONLY — DO NOT RUN**. No grant is
> executed or authorized by this PR.

### Option A — table-level SELECT (broadest)
```sql
-- CANDIDATE ONLY — DO NOT RUN — requires Codex review + explicit Helen GO
GRANT SELECT ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;
```
- Pros: guaranteed to cover any SELECT requirement of the upsert path.
- Cons: **over-grants** relative to current evidence (RETURNING/arbiter already
  covered; SET reads nothing). Least aligned with least-privilege.

### Option B — column-level SELECT on exact upsert path columns (narrow)
```sql
-- CANDIDATE ONLY — DO NOT RUN — requires Codex review + explicit Helen GO
-- Columns identified from source as SELECT-touching by the upsert path.
-- NOTE: these 5 already have SELECT per Stage 2a, so this may be a no-op
-- unless structured-error proof identifies a DIFFERENT specific column.
GRANT SELECT (behavioural_features_id, feature_version, session_id, site_id, workspace_id)
  ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;
```
- Pros: least-privilege; maintainable if exact columns are knowable from source.
- Cons: per source review the obvious columns are **already granted**, so this
  likely does not change anything unless proof reveals an additional column.

### Option C — Stage 2b terminal-upsert reproduction first (proof before grant)
- Perform the planned, separately-GO'd, **rollback-contained** Stage 2b
  terminal-upsert reproduction to capture the **structured PostgreSQL error
  fields** (`code`, `position`, `schema`, `table`, `column`, `constraint`,
  `where`, `routine`) — booleans / structural metadata only, no row values — to
  identify the **exact** denied operation/object/column before any grant.
- Pros: turns the "likely gap" into proven evidence; prevents over-granting
  (Option A) and no-op grants (Option B).
- Cons: requires one more separately-authorized diagnostic step.

---

## 5. Recommended Safe Preferred Path

Given that source review shows the upsert's obvious SELECT needs are **already
satisfied** by the existing 5-column grant, the evidence does **not** yet
justify Option A or pinpoint a column for Option B. Therefore:

- **Preferred: Option C** — run the Stage 2b terminal-upsert reproduction first
  to obtain exact structured error-field proof of which operation/object/column
  is denied. This avoids over-granting and resolves the ambiguity.
- **Then, evidence-led:** if Stage 2b proves a specific additional column is
  required, apply **Option B** scoped to exactly that column. Only if Stage 2b
  proves a table-wide SELECT requirement (e.g. a planner/path behavior not
  reducible to specific columns) should **Option A** be considered.
- **Avoid overclaiming** that Option A is required. It is a fallback, justified
  only by proof.

(If the team prefers to act without Stage 2b, Option B scoped to source-known
columns is the least-privilege choice — but note it may be a no-op given the
current grants, so Option C is still recommended first.)

---

## 6. Proposed Post-Fix Proof Plan (for whichever grant is later chosen)

If/when a grant is later applied under explicit GO, a separate **read-only
privilege proof PR** must record (booleans/counts only):

- table-level SELECT/INSERT/UPDATE (and DELETE/TRUNCATE/REFERENCES/TRIGGER)
  booleans — confirming the intended SELECT change and that nothing else moved;
- target column SELECT/INSERT/UPDATE true-counts (e.g. SELECT-true count moves
  from 5 to the intended value);
- sequence USAGE/SELECT booleans (USAGE stays true, SELECT stays false unless
  separately justified);
- role/database/read-only gates; `ROLLBACK`.
- **No row values, no raw identifiers, no payload/customer data, no
  DSN/password/token output.**

---

## 7. Proposed Future Extractor Rerun Gate

- **Extractor rerun is NOT authorized by this planning PR.**
- A rerun requires: the chosen path executed under explicit Helen GO, a
  **post-fix proof PR merged**, and a **separate explicit Helen GO** for the
  rerun.
- Any future rerun must be a separate operator session with all approved
  stop-lines active.

---

## 8. Stop-Lines

The following must never occur outside an explicit future GO, and never in this
PR:

- any DSN / password / token output;
- any raw `session_id` / `request_id`;
- any payload / customer data;
- any GRANT / DML / DDL outside an explicit future GO;
- any extractor rerun;
- any worker / downstream runtime;
- any Lane / scoring / AMS / customer output;
- any Gate 4E / Gate 4F.

---

## 9. What This PR Does Not Authorize

- no grant / fix execution;
- no SQL execution;
- no production command;
- no extractor rerun;
- no Stage 2b reproduction;
- no worker / downstream runtime;
- no Gate 4E / Gate 4F.

---

## 10. Next Gated Step

1. **Codex review and merge** of this docs-only planning PR.
2. Then a **separate explicit Helen GO** for the chosen path — either the
   grant/fix (Option B/A, evidence-led) or the **Stage 2b** diagnostic
   (Option C, preferred).

No grant, SQL, diagnostic, extractor rerun, worker, or downstream runtime is
authorized until that gated step occurs.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column / object names, candidate SQL structure, or
stop-line language only — not values.
