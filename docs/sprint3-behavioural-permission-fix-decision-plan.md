# Sprint 3: Behavioural Output Permission-Fix — Decision Plan

**Status:** `BEHAVIOURAL_PERMISSION_FIX_DECISION_PLANNING_ONLY`

This is a **docs-only planning record**. It plans the next evidence-led step
after Stage 2b (PR #150) reproduced PostgreSQL permission error
`42501 / aclcheck_error` on the full-source-shaped terminal upsert **but did
not expose** structured object/column fields.

This PR runs **no** diagnostic, applies **no** GRANT/DML/DDL, runs **no**
production command, runs **no** extractor rerun, and runs **no** worker or
downstream runtime. Both options below are **planning only**; nothing is
authorized for execution.

---

## 1. Title & Status

- Title: Behavioural Output Permission-Fix — Decision Plan.
- Status: `BEHAVIOURAL_PERMISSION_FIX_DECISION_PLANNING_ONLY`.
- This PR compares two candidate next paths (A and B) and recommends, but does
  **not** choose or execute a final fix.

---

## 2. Evidence Chain (PR #145–#150)

- **PR #145** — Stage 2a read-only localization, **rolled back**: target
  table-level `SELECT=false`, `INSERT=true`, `UPDATE=true`; target column SELECT
  true for only 5/37, INSERT/UPDATE true for 37/37; sequence USAGE=true,
  SELECT=false; unqualified vs `public.`-qualified resolve to the same OID. The
  `42703` probe error was a diagnostic query-shape limitation, and the
  follow-on `25P02` was transaction-abort fallout; **neither `42703` nor
  `25P02` was extractor proof.**
- **PR #146** — target-SELECT grant-fix planning: source review found the
  upsert's obvious SELECT surfaces already covered by the existing 5-column
  SELECT grant (conflict arbiter + RETURNING), and `DO UPDATE SET` reads only
  `EXCLUDED.*`; so table-level SELECT is **not** automatically justified.
- **PR #147 / #148 / #149** — Stage 2b plan, in-repo command-pack artifact,
  and manual operator commands (DSN narrowed to `DATABASE_URL` only).
- **PR #150** — Stage 2b terminal-upsert evidence
  (merge `6a38cab3ff688a4e0e08594d89c98b39c68880b8`): full-source-shaped
  upsert, one attempt, rollback-contained, no COMMIT, no persistent DML;
  outcome `42501` / `aclcheck_error`; all structured
  `schema/table/column/constraint/detail/hint/where` fields absent.

---

## 3. What Stage 2b Proved

- A **permission denial on the write path is proven**: the full-source-shaped
  `INSERT … ON CONFLICT … DO UPDATE … RETURNING` (36 insert cols, 32
  `EXCLUDED.*` updates, same arbiter + RETURNING) reproducibly fails with
  PostgreSQL `42501` (`aclcheck_error`) under the app role
  `buyerrecon_prod_collector_app`.
- It is **not** an artifact of a reduced-column probe (the source-shape
  preflight passed) and **not** a transient/connection issue (PostgreSQL was
  reached, transaction started, then denied).

---

## 4. What Stage 2b Did NOT Prove

- The **exact denied object/column is not identified by structured fields** —
  `schema/table/column/constraint/detail/hint/where` were all absent, and the
  raw message was intentionally redacted.
- Therefore `42501` confirms *a* privilege denial but does **not** name *which*
  privilege on *which* object/column is missing.
- **Root cause must not be over-claimed.** In particular, given PR #146,
  table-level SELECT is **not** demonstrated to be the required fix; the
  obvious column SELECT/INSERT/UPDATE/sequence surfaces already appeared
  present in Stage 1/2a.

---

## 5. Option A — Tightly-Scoped Safe Error-Message Diagnostic (before any grant)

Because PostgreSQL's **structured** error fields were empty, the object/column
name (if any) would only be available in the **message text**. PostgreSQL's
`42501` message frequently names the object (e.g. "permission denied for table
…" or "… for sequence …"), so a **tightly-scoped, allowlisted** capture could
identify the exact denied object **without** exposing data.

**Design (planning only — not executed here):**
- One additional attempt, **rollback-contained** (`BEGIN … ROLLBACK`, no
  COMMIT), reproducing the same full-source-shaped upsert as Stage 2b.
- Capture the error message **only through an allowlist classifier** — never
  print the raw full message blindly.
- **Allowlist** (static, known tokens only) may include:
  `permission denied`, `relation`, `table`, `column`, `sequence`, `schema`,
  `session_behavioural_features_v0_2`, the known column names from the 36/32
  source shape, and the known sequence name **only if** source/DB inspection
  confirms it (e.g. the `behavioural_features_id` serial sequence).
- Classifier behavior:
  - emit which allowlisted tokens matched (booleans / token list), plus the
    SQLSTATE/severity/routine already captured in Stage 2b;
  - if the message contains **anything outside the allowlist**, emit only
    `message_redacted=true` and `message_allowlist_match=false` — **no raw
    message**;
  - never emit DSN, credentials, row values, raw identifiers, payloads, or
    customer data.

**Safety requirements (must hold at execution time):** separately reviewed;
explicit Helen GO; one attempt only; rollback-contained; allowlist-only output;
no raw message on allowlist miss; followed by a **docs-only evidence PR**.

**Pros:** turns `42501` into a precise object/column localization while staying
data-safe; prevents over-granting.
**Cons:** one more gated diagnostic step before any fix.

---

## 6. Option B — Least-Privilege Grant/Fix Candidate (evidence-led)

Plan candidate grant/fix paths **ordered least-privilege first**; do **not**
execute. Do **not** assume table-level SELECT is required.

Carried-forward constraints:
- **PR #146:** obvious SELECT surfaces (arbiter + RETURNING) already covered by
  the existing 5-column SELECT grant; `DO UPDATE SET` reads `EXCLUDED.*`.
- **PR #150:** full upsert still fails `42501 / aclcheck_error`; exact denied
  object/column not exposed.

**Candidate ordering (least-privilege first; all candidate-only):**
- **B1 — narrow column SELECT delta:** grant column-level SELECT on only a
  specific additional target column **if** evidence later identifies one
  (currently none identified → B1 is presently a no-op / unknown target).
- **B2 — sequence privilege delta:** if evidence implicates the
  `behavioural_features_id` sequence beyond the already-present USAGE, grant the
  minimal missing sequence privilege only (USAGE is already true; SELECT not
  shown needed).
- **B3 — other minimal object privilege:** if evidence implicates an adjacent
  object (e.g. a function/sequence/relation in the write path), grant the
  minimal privilege on exactly that object.
- **B4 — table-level SELECT (HIGHER-RISK):** only if evidence shows a
  table-wide SELECT requirement not reducible to specific columns. **Treated as
  higher-risk; over-grants relative to current evidence; requires explicit
  risk-acceptance.**

**Any future grant/fix requires:** Codex review; explicit Helen GO; a
**post-fix proof PR** with structural privilege **booleans/counts only**; and a
**separate extractor rerun GO after proof**.

> Note: with **no** exact object/column identified yet, B1–B3 lack a confirmed
> target and B4 is an evidence-light broad grant. Choosing Option B now means
> acting without knowing the precise denied object — see §7–§8.

---

## 7. Risk Comparison

| Dimension | Option A (diagnostic first) | Option B (grant/fix now) |
|---|---|---|
| Precision | Identifies exact denied object/column (if in allowlist) | Acts without exact object identified |
| Over-grant risk | Low (no grant yet) | Medium–High (esp. B4 table-level SELECT) |
| Data-exposure risk | Low (allowlist-only, redact-on-miss, rollback) | Low (no data; but privilege change is persistent once applied) |
| Steps to resolution | One more gated diagnostic, then targeted fix | Fewer steps, but risks wrong/broad fix and a re-do |
| Least-privilege alignment | High | High only for B1–B3 with a known target; B4 weak |
| Reversibility | N/A (read/observe only) | Grants are persistent; revert needs another change |

---

## 8. Recommendation

- **Do not choose a final fix in this PR.**
- **Recommend Option A first**: run the tightly-scoped, allowlisted
  error-message diagnostic to obtain proof of the exact denied object/column
  before any grant. This keeps the eventual fix precise and least-privilege.
- **If the team chooses Option B instead**, require a **very explicit
  risk-acceptance note** acknowledging that the exact denied object/column was
  **not** exposed by Stage 2b, and constrain the choice to the least-privilege
  candidate (B1–B3) wherever a target can be argued; **B4 (table-level SELECT)
  must carry a documented higher-risk acceptance** and is discouraged on
  current evidence.

---

## 9. What This PR Does Not Authorize

- no diagnostic execution (Option A is planned only);
- no grant/fix execution (Option B is candidate only);
- no SQL execution;
- no production command;
- no GRANT / DML / DDL;
- no extractor rerun;
- no worker / downstream runtime;
- no Lane A/B;
- no scoring runtime;
- no AMS Trust / Pass runtime;
- no customer output;
- no Gate 4E / Gate 4F.

---

## 10. Next Gated Step

1. **Codex review and merge** of this docs-only decision plan.
2. Then a **separate explicit Helen GO** for the chosen path:
   - **Option A:** a tightly-scoped, allowlisted, rollback-contained
     error-message diagnostic (one attempt) → docs-only evidence PR; or
   - **Option B:** a least-privilege grant/fix **planning** PR (candidate-only)
     → Codex review → explicit Helen GO → apply → **post-fix proof PR**
     (booleans/counts only) → **separate extractor rerun GO**.
3. No grant/fix, diagnostic, extractor rerun, worker, or downstream runtime is
   authorized until that gated step occurs. Any future rerun must be a separate
   operator session with all approved stop-lines active.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are column / object names, SQLSTATE/allowlist-token concepts, or
stop-line / boundary language only — not values.
