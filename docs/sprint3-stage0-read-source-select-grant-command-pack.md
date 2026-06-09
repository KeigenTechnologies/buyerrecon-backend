# Sprint 3 — Stage 0 Read-Source SELECT Grant — Command Pack (Review-Only)

**Status:** `STAGE0_READ_SOURCE_SELECT_GRANT_COMMAND_PACK_REVIEW_ONLY`

This is a **reviewable, docs-only command pack** for the **minimal** Stage 0
read-source SELECT grant: `SELECT` on `accepted_events` and `ingest_requests`
for `buyerrecon_scoring_worker` — the one remaining gap confirmed by PR #165.

This PR is **review-only**. It **executes no grant and runs no SQL**. The
candidate SQL is **`CANDIDATE ONLY — DO NOT RUN`**. Future execution requires
Codex review + merge of this PR **and** a separate explicit Helen GO, then one
grant execution, then a post-grant proof PR.

> Provenance: PR #164 Stage 0 privilege/role resolution plan
> (`7ffff23088a1c5fe2e3845515d6f53c0a5948a49`); PR #165 scoring-worker preflight
> blocker (`d0617b8b1b8fffbfa1c4799ee708f54db17705dc`).

---

## 1. Title & Status

- Title: Stage 0 Read-Source SELECT Grant — Command Pack.
- Status: `STAGE0_READ_SOURCE_SELECT_GRANT_COMMAND_PACK_REVIEW_ONLY`.
- Review-only; not a grant execution; authorizes nothing.

---

## 2. Inputs / Prerequisite Chain

- **PR #164 — merged:**
  - merge commit: `7ffff23088a1c5fe2e3845515d6f53c0a5948a49`
  - status: `STAGE0_PRIVILEGE_ROLE_RESOLUTION_PLANNING_ONLY`
  - outcome: selected `buyerrecon_scoring_worker` as the intended Stage 0 worker
    role (Option B) and required correct-role preflight before any grant.
- **PR #165 — merged:**
  - merge commit: `d0617b8b1b8fffbfa1c4799ee708f54db17705dc`
  - status: `STAGE0_SCORING_WORKER_PREFLIGHT_BLOCKED_READ_SOURCE_SELECT_MISSING`
  - outcome: proved `stage0_decisions` privileges true for
    `buyerrecon_scoring_worker` (role exists, NOLOGIN), while `accepted_events`
    and `ingest_requests` SELECT remain missing.

---

## 3. Current Proven Blocker (from PR #165)

For role `buyerrecon_scoring_worker` (via `SET ROLE`, read-only, rolled back):
- `accepted_events_select=false` ← blocker
- `ingest_requests_select=false` ← blocker
- `stage0_insert=true` (already sufficient)
- `stage0_update=true` (already sufficient)
- `stage0_select_returning=true` (already sufficient)
- role exists; `scoring_worker_can_login=false` (NOLOGIN).

---

## 4. Grant / Fix Objective

Close **only** the read-source SELECT gap so the Stage 0 worker (running as
`buyerrecon_scoring_worker` via a login member) can read its sources. Nothing
else. `stage0_decisions` privileges are **already true** and are **not**
re-granted here. The login/member-role path is a **separate** decision (this
grant does not change login capability).

---

## 5. Candidate Grant SQL — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO. **One** grant execution only; **exact statements only**.

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Minimal Stage 0 read-source SELECT grant for the scoring worker.
GRANT SELECT ON TABLE public.accepted_events TO buyerrecon_scoring_worker;
GRANT SELECT ON TABLE public.ingest_requests TO buyerrecon_scoring_worker;
```

**Explicitly NOT included** (must not appear in the executed grant):
- any `stage0_decisions` grant (already true — `INSERT`/`UPDATE`/`SELECT`);
- any schema-wide grant; any database-wide grant;
- `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- any Lane / scoring / AMS / customer / Gate privilege;
- any change to login capability / role membership;
- any Stage 0 execution command.

---

## 6. Pre-Grant Verification Requirements (read-only; booleans only)

Before any grant (its own gate), confirm:
- **branch / base / HEAD** match the reviewed command-pack state;
- **role existence** for `buyerrecon_scoring_worker` (`rolname` present);
- `stage0_decisions` privileges **remain true** (`stage0_insert`,
  `stage0_update`, `stage0_select_returning`);
- `accepted_events_select=false` (gap still present);
- `ingest_requests_select=false` (gap still present);
- **no sequence privilege is required** for `stage0_decisions` (PK uses
  `gen_random_uuid()` — confirmed; no sequence in the path);
- **no login/member execution path is being changed** by this grant
  (`buyerrecon_scoring_worker` stays NOLOGIN; membership unchanged).

If any precondition fails (e.g. the gap is already closed, or a privilege drifted),
**STOP** and record evidence — do not run an unnecessary or broadened grant.

---

## 7. Grant Execution Requirements (future GO)

When authorized (separate explicit Helen GO):
- run as a role authorized to grant (e.g. `buyerrecon_migrator` / owner / a
  superuser per ops posture) — confirmed at review, not assumed;
- execute **exactly** the two `GRANT SELECT` statements in §5 — nothing more;
- **one** grant execution only; no ad-hoc additions;
- DSN loaded secret-safe (`DATABASE_URL`-only parse; never printed); `APP_DSN`
  unset afterward;
- capture only the grant command tags / booleans; print no row values,
  identifiers, payloads, or secrets.

---

## 8. Post-Grant Proof Requirements

A separate **post-grant proof PR** must record (booleans only, for
`buyerrecon_scoring_worker`):
- `accepted_events_select=true` (false → true);
- `ingest_requests_select=true` (false → true);
- `stage0_insert=true`, `stage0_update=true`, `stage0_select_returning=true`
  (unchanged);
- `buyerrecon_scoring_worker` **remains `NOLOGIN`** unless a separate
  login/member-role plan is reviewed and approved;
- **no broader privileges granted** (spot-check: no DELETE/TRUNCATE/REFERENCES/
  TRIGGER; no schema/DB-wide; no Lane/scoring/AMS/customer/Gate; no
  `stage0_decisions` change; `customer_api` still revoked on `stage0_decisions`);
- **no Stage 0 execution**;
- read-only/rolled-back proof gates; no row values, raw identifiers, payloads,
  or secrets.

---

## 9. Stop-Lines

Abort the future grant / proof chain if any is true:
- wrong branch, base, or HEAD commit for the reviewed state;
- wrong role (not `buyerrecon_scoring_worker`);
- `buyerrecon_scoring_worker` missing;
- the proposed grant includes anything beyond `SELECT` on `accepted_events` and
  `ingest_requests`;
- any `stage0_decisions` grant is included without new proof;
- any schema-wide or database-wide grant;
- any `DELETE` / `TRUNCATE` / `REFERENCES` / `TRIGGER`;
- any Lane / scoring / AMS / customer / Gate privilege;
- any Stage 0 execution is attempted;
- any ad-hoc grant / fix;
- any raw row values, raw identifiers, payload/customer data, or secrets are
  printed;
- any DSN / password / token is printed.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / review-only** and authorizes **none** of:
- no production command; no SQL; no GRANT/DML/DDL; no permission fix;
- no Stage 0 execution; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F.

---

## 11. Next Step After This PR

1. **Codex review** of this command pack.
2. **Merge** this docs-only PR.
3. **Separate explicit Helen GO** before any grant.
4. **One** grant execution only (the §5 two `GRANT SELECT` statements).
5. **Post-grant proof PR** (booleans only, per §8).
6. **Separate login/member-role resolution** if still needed (the scoring
   worker is NOLOGIN).
7. **Separate explicit Stage 0 execution GO** — only after the grant proof
   passes and the login/member-role path is resolved.

**No ad-hoc grant. No Stage 0 execution until the chain completes.**

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, SQL identifiers, or
stop-line / boundary language — not row values. The candidate SQL is fenced
`CANDIDATE ONLY — DO NOT RUN`; any future DSN is parsed from `DATABASE_URL` only
and never printed.
