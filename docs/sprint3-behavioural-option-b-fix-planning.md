# Sprint 3: Behavioural Output — Option B Permission-Fix Planning

**Status:** `BEHAVIOURAL_OPTION_B_FIX_PLANNING_ONLY`

This is a **docs-only planning record**. It plans the next step after the
Option A allowlisted diagnostic (PR #154) failed to identify the exact denied
object/column, and decides between (B1) one more tightened allowlist diagnostic
and (B2) least-privilege grant/fix planning with explicit risk acceptance.

This PR **executes nothing**: no diagnostic, no production command, no SQL, no
GRANT/DML/DDL, no grant/fix, no extractor rerun, no worker/downstream runtime,
no Gate 4E/4F. All candidates below are **candidate-only**; nothing is
authorized for execution.

---

## 1. Title & Status

- Title: Behavioural Output — Option B Permission-Fix Planning.
- Status: `BEHAVIOURAL_OPTION_B_FIX_PLANNING_ONLY`.
- Docs-only, no execution. This PR decides the next path; it does not run it.

---

## 2. Evidence Chain

- **PR #145 — Stage 2a** (read-only, **rolled back**): target table-level
  `SELECT=false`, `INSERT=true`, `UPDATE=true`; target column SELECT true for
  only 5/37, INSERT/UPDATE true for 37/37; sequence USAGE=true, SELECT=false.
  The `42703` probe error was a diagnostic query-shape limitation, and the
  follow-on `25P02` was transaction-abort fallout; **neither was extractor
  proof.**
- **PR #146** — source review found the upsert's obvious SELECT surfaces
  (conflict arbiter + RETURNING) already covered by the existing 5-column SELECT
  grant; `DO UPDATE SET` reads only `EXCLUDED.*`; **table-level SELECT is not
  automatically justified.**
- **PR #150 — Stage 2b**: full-source-shaped upsert reproduced `42501` /
  `aclcheck_error`; one rollback-contained DML-shaped attempt;
  `commit_used=false`; no persistent DML; structured
  `schema/table/column/constraint/detail/hint/where` fields absent.
- **PR #154 — Option A allowlisted diagnostic**: reproduced `42501` /
  `aclcheck_error`; raw message **not printed**; `message_allowlist_match=false`;
  `allowlisted_terms_found=[]`; **exact denied object/column still
  unidentified.**

---

## 3. Current Knowns / Unknowns

**Known:**
- The app role (`buyerrecon_prod_collector_app`) hits a permission denial
  (`42501` / `aclcheck_error`) on the full-source-shaped behavioural upsert,
  reproducibly (Stage 2b and Option A).
- Table-level INSERT/UPDATE and sequence USAGE appear **present** from prior
  probes (Stage 2a).
- The upsert's obvious SELECT surfaces (arbiter + RETURNING) appeared
  **covered** by the existing 5-column SELECT grant in source review (PR #146);
  `DO UPDATE SET` reads only `EXCLUDED.*`.

**Unknown:**
- the exact denied object;
- the exact denied column;
- the exact missing privilege;
- whether a narrower grant would fix it;
- whether table-level SELECT would fix it.

---

## 4. Decision Paths

### Path B1 — one more tightened allowlist diagnostic
- Adds one more diagnostic round.
- Could expand the allowlist **only** for safe, static PostgreSQL phrasing such
  as `for table`, `for relation`, `permission denied for`, `aclcheck`, plus the
  already-known object/column terms.
- **Still no raw message** (same redact-on-miss discipline).
- Still separately reviewed and GO-gated, one attempt, rollback-contained.
- **Benefit:** may localize the exact denied object before any grant.
- **Cost:** more PRs; may still return no-match.

### Path B2 — least-privilege grant/fix planning with explicit risk acceptance
- Accepts that the exact object/column was **not** exposed by structured fields
  or the allowlisted classifier.
- Plans candidate grants in **least-privilege order** (see §6).
- Requires **explicit risk acceptance** (see §8).
- Requires Codex review, explicit Helen GO, and a **post-fix proof** before any
  extractor rerun.
- **Benefit:** moves toward repair.
- **Risk:** could over-grant, or apply a no-op if the guessed surface is wrong.

---

## 5. Recommended Decision

- **Recommend Path B2** *if the team accepts the uncertainty* — multiple
  diagnostics (Stage 2a structured probes, Stage 2b structured fields, Option A
  allowlist) have already failed to localize the exact object/column, so further
  diagnostics have diminishing returns.
- **Path B1 remains available** if the team wants one final, safe localization
  attempt (tightened allowlist, still redact-on-miss) before committing to a
  risk-accepted grant.
- This PR does **not** choose for the team; it records the recommendation and
  requires an explicit choice at the next gated step (§10).

---

## 6. Candidate Least-Privilege Fix Ordering (candidate-only; none executed)

Ordered narrowest → broadest, for future review. **Nothing here is executed or
authorized.**

- **Candidate 1 (narrowest):** prove/adjust any **missing column-level SELECT**
  for columns actually touched by RETURNING / the conflict arbiter / the
  source-reviewed surfaces — **only if any remain missing**. (Per PR #146 the
  obvious 5 appear already granted, so this may be a no-op unless proof finds a
  specific additional column.)
- **Candidate 2:** **table-level SELECT** on
  `public.session_behavioural_features_v0_2` **only if explicitly
  risk-accepted** and justified as *likely required by PostgreSQL upsert
  privilege semantics despite source review*. Higher-risk; over-grants relative
  to current evidence.
- **Candidate 3:** **sequence privilege adjustment** only if later proof shows a
  sequence issue. Note: sequence USAGE was already true, and sequence
  SELECT=false was **not** shown relevant.
- **Candidate 4:** **schema/table privilege re-check** if future proof suggests
  a schema/table-level gap.
- **Avoid** broad grants beyond this table.
- **No** DELETE / TRUNCATE / REFERENCES / TRIGGER.
- **No** Lane / scoring / customer / AMS / Gate privileges.

---

## 7. Proposed Future Fix GO Chain

The future grant/fix chain (if B2 is chosen) must be:

1. **docs-only grant/fix command-pack PR** (candidate SQL fenced
   `CANDIDATE ONLY — DO NOT RUN`);
2. **Codex review**;
3. **explicit Helen GO**;
4. **one production grant/fix execution only** (operator-run, gated, DB/role
   verified, no DSN/secret printed);
5. **post-fix proof PR** using **booleans/counts only** — no row reads, no raw
   data;
6. **separate extractor rerun GO** only **after** the post-fix proof PR merges.

Any future rerun must be a separate operator session with all approved
stop-lines active.

---

## 8. Risk-Acceptance Template (for a future B2 fix PR)

To be included verbatim (and explicitly accepted by Helen) in any future B2
grant/fix PR:

> - "We accept that the exact denied object/column was not exposed by structured
>   fields or the allowlisted classifier."
> - "We are choosing the least-privilege candidate fix based on repeated
>   reproduction of `42501` on the full-source-shaped upsert and prior privilege
>   evidence."
> - "If post-fix proof or the extractor rerun fails, stop and record evidence;
>   do not stack ad-hoc grants."

---

## 9. What This PR Does Not Authorize

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

## 10. Next Gated Step

1. **Codex review and merge** of this docs-only planning PR.
2. Then **explicitly choose B1 or B2**:
   - **B1:** create a tightened-allowlist diagnostic plan/command-pack PR
     (still redact-on-miss, one attempt, GO-gated) → evidence PR.
   - **B2:** create a **grant/fix command-pack PR** (candidate-only) with the
     §8 risk-acceptance text → Codex review → explicit Helen GO → one execution
     → post-fix proof PR → separate extractor rerun GO.
3. **No execution before explicit Helen GO.** No grant/fix, diagnostic,
   extractor rerun, worker, or downstream runtime is authorized until that gated
   chain occurs.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, customer data, or any raw PostgreSQL error
message. All identifier references are column / object names, SQLSTATE /
allowlist-phrase concepts, or stop-line / boundary language only — not values.
