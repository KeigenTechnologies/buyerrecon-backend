# Sprint 3 — Stage 0 Privilege / Role Resolution Plan

**Status:** `STAGE0_PRIVILEGE_ROLE_RESOLUTION_PLANNING_ONLY`

This is a **docs-only planning record**. It plans the least-privilege Stage 0
role/privilege resolution path after the Gate S3-NG2 preflight (PR #163) found
the confirmed test role missing all required Stage 0 privileges.

This PR **applies no grants, runs no SQL, and authorizes no Stage 0 execution.**
Any candidate SQL is `CANDIDATE ONLY — DO NOT RUN`.

> Provenance: PR #162 Stage 0 command pack
> (`242d561e5eafea3bf1d2b4f222c6a0abd51f8eb5`); PR #163 preflight blocker
> evidence (`39288b2a53b8e7651b5707a30b5fdae3f7a2bdb6`).

---

## 1. Title & Status

- Title: Stage 0 Privilege / Role Resolution Plan.
- Status: `STAGE0_PRIVILEGE_ROLE_RESOLUTION_PLANNING_ONLY`.
- Planning only; evaluates role options and recommends a least-privilege path;
  authorizes no grant and no execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #162** — Gate S3-NG2 Stage 0 command pack (RECORD_ONLY worker;
  `npm run stage0:run`; sole write `stage0_decisions`; reads `accepted_events` +
  `ingest_requests`; PK `gen_random_uuid()` → no sequence).
- **PR #163** — Stage 0 read-only privilege preflight **BLOCKED**: preflight ran
  clean (exit 0, read-only, rolled back, no COMMIT), required relations present,
  but all five required privileges were **false** for the **confirmed test
  role** `buyerrecon_prod_collector_app`.

---

## 3. Current Blocker Evidence (from PR #163)

For confirmed test role `buyerrecon_prod_collector_app`:
- `accepted_events_select=false`
- `ingest_requests_select=false`
- `stage0_insert=false`
- `stage0_update=false`
- `stage0_select_returning=false`

The preflight tested the **collector app role**. The key question this plan
answers: **is the collector app role even the correct role for Stage 0?**

---

## 4. Stage 0 Source / Target Surface (recap, repo-grounded)

- Command: `npm run stage0:run` (RECORD_ONLY).
- Reads (real relations): `accepted_events`, `ingest_requests`.
- Sole write: `stage0_decisions` — idempotent
  `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
- PK `stage0_decision_id UUID DEFAULT gen_random_uuid()` → **no sequence
  privilege needed**.
- Does **not** touch Lane A/B, risk, POI, evidence snapshot, scoring output,
  AMS, customer output, or Gate surfaces.

---

## 5. Role Architecture Evidence (repo-grounded, read-only review)

Migrations define a **role-separated** posture (no `buyerrecon_prod_collector_app`
among the migration-managed roles):

- **`buyerrecon_scoring_worker`** — the scoring-stage **writer group role**
  (NOLOGIN; granted to a login role). **Migration 012 grants it the exact Stage
  0 write posture:**
  `GRANT SELECT, INSERT, UPDATE ON stage0_decisions TO buyerrecon_scoring_worker;`
  (mirrored for `risk_observations_v0_1`, etc.).
- **`buyerrecon_migrator`** — `GRANT ALL` (schema/DDL/migration owner).
- **`buyerrecon_internal_readonly`** — `GRANT SELECT` only (audit/read).
- **`buyerrecon_customer_api`** — explicitly **`REVOKE ALL` / revoked** from
  `stage0_decisions` (must not read/write Stage 0 output).
- **`buyerrecon_prod_collector_app`** — the **collector / extractor** app role
  (writes `accepted_events` and behavioural features). It is **not** the
  migration-intended Stage 0 writer.

**Implication:** Stage 0 (`src/scoring/stage0/…`) is a **scoring-stage worker**,
and migration 012 already routes its `stage0_decisions` writer privilege to
**`buyerrecon_scoring_worker`** — not to the collector app role. The preflight
failure is therefore consistent with **testing the wrong role**, not with a
missing grant on the right one (for the write target).

**Open evidence gap:** no migration was found granting **SELECT on
`accepted_events` / `ingest_requests` to `buyerrecon_scoring_worker`**. So the
scoring worker's **read-source** privileges are **unconfirmed** and must be
re-checked under the correct role before any grant.

---

## 6. Role Options Considered

| Option | Description | Assessment |
|---|---|---|
| **A** | Grant minimal Stage 0 privileges to `buyerrecon_prod_collector_app` | **Not recommended.** Over-grants the collector/extractor role and **contradicts migration 012**, which routes `stage0_decisions` writes to `buyerrecon_scoring_worker`. Blurs the role boundary (collector would gain scoring-stage write + Stage 0 read), reducing least-privilege separation. |
| **B** | Run Stage 0 under **`buyerrecon_scoring_worker`** (via a login role that is a member of it) | **Recommended.** Matches the migration-intended posture; `stage0_decisions` SELECT/INSERT/UPDATE are **already granted** to this role (migration 012). Keeps role separation intact. Requires (a) running under the correct role and (b) confirming/closing the read-source SELECT gap (§7). |
| **C** | Broad grant / schema-wide / DB-wide grant | **Reject.** Violates least-privilege; not needed; out of scope. |
| **D** | Run Stage 0 without resolving privileges | **Reject.** PR #163 stop-line; would fail `42501`-style permission denial; no ad-hoc bypass. |

---

## 7. Recommended Role Decision

**Recommend Option B — run Stage 0 as `buyerrecon_scoring_worker`** (through a
login role that is a member of that group), because:
- migration 012 already establishes `buyerrecon_scoring_worker` as the intended
  `stage0_decisions` writer (SELECT/INSERT/UPDATE);
- it preserves the established role separation (collector ≠ scoring worker);
- it avoids over-granting the collector app role (rejected Option A).

**Required confirmation before any grant (evidence-led, not assumed):** re-run
the **read-only privilege preflight as the scoring-worker login role** (the
correct role), checking:
- `stage0_decisions` INSERT/UPDATE/SELECT — **expected true** (migration 012);
- `accepted_events` SELECT and `ingest_requests` SELECT — **unknown; confirm.**

- If the read-source SELECTs are already **true**, **no grant is needed** — the
  blocker was simply the wrong role in PR #163; proceed (after GO) to Stage 0
  execution gating.
- If the read-source SELECTs are **false**, the least-privilege fix is a
  narrow grant of SELECT on those two read tables to `buyerrecon_scoring_worker`
  (§8), candidate-only.

---

## 8. Least-Privilege Grant Candidate (CANDIDATE ONLY — DO NOT RUN)

Applies **only if** the §7 re-preflight under `buyerrecon_scoring_worker` shows
the read-source SELECTs are missing. `stage0_decisions` privileges are **not**
re-granted here (already present per migration 012).

```sql
-- CANDIDATE ONLY — DO NOT RUN — requires re-preflight + Codex review + explicit Helen GO.
-- Close ONLY the read-source SELECT gap for the scoring worker, if confirmed missing:
GRANT SELECT ON TABLE public.accepted_events  TO buyerrecon_scoring_worker;
GRANT SELECT ON TABLE public.ingest_requests  TO buyerrecon_scoring_worker;
```

Required exact privileges for Stage 0 under the chosen role:
- `SELECT` on `accepted_events` (read source);
- `SELECT` on `ingest_requests` (read source);
- `INSERT` on `stage0_decisions` (already granted to scoring_worker);
- `UPDATE` on `stage0_decisions` (already granted);
- `SELECT` on `stage0_decisions` for `RETURNING` (already granted);
- **no sequence privilege** (PK uses `gen_random_uuid()`).

**Explicitly excluded** (least-privilege boundary):
- no `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- no schema-wide or database-wide grants;
- no Lane A/B, scoring-output, AMS, customer, or Gate privileges;
- no grant to `buyerrecon_customer_api` (must stay revoked on `stage0_decisions`);
- no column-level variant needed (table-level SELECT on the two read sources is
  the minimal correct unit here; column grants would not reduce risk for
  full-table reads).

---

## 9. Proof Requirements After Any Future Grant

A separate **post-grant proof PR** (after its own GO) must record, booleans/
counts only:
- the exact command(s) executed;
- pre/post privilege booleans for `buyerrecon_scoring_worker`:
  `accepted_events` SELECT, `ingest_requests` SELECT (false→true if granted),
  and `stage0_decisions` INSERT/UPDATE/SELECT (confirmed true);
- confirmation that **no** DELETE/TRUNCATE/REFERENCES/TRIGGER, schema/DB-wide,
  Lane/scoring/AMS/customer/Gate privileges were added;
- confirmation `buyerrecon_customer_api` remains revoked on `stage0_decisions`;
- read-only proof transaction (or the grant transaction) gates; no row reads, no
  raw data, no secrets.

---

## 10. Stop-Lines

- no grant applied by this PR;
- no Stage 0 execution by this PR;
- do not grant Stage 0 privileges to `buyerrecon_prod_collector_app` (Option A
  rejected) without explicit, separately-justified re-decision;
- do not broaden beyond SELECT on the two read sources (no DELETE/TRUNCATE/
  REFERENCES/TRIGGER, no schema/DB-wide, no Lane/scoring/AMS/customer/Gate);
- do not re-grant `stage0_decisions` to `customer_api`;
- do not run any grant before the §7 re-preflight under the correct role,
  Codex review, and explicit Helen GO;
- stop and record evidence on any unexpected role membership, privilege, or
  permission error; no ad-hoc grants.

---

## 11. Explicit Non-Authorization

This PR is **docs-only / planning-only** and authorizes **none** of:
- no production command; no SQL; no GRANT/DML/DDL; no permission fix;
- no Stage 0 execution; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F.

---

## 12. Next Step After This PR

1. **Codex review and merge** of this planning PR.
2. **Re-run the read-only privilege preflight as `buyerrecon_scoring_worker`**
   (its own read-only gate / GO) to confirm read-source SELECT status and the
   already-expected `stage0_decisions` privileges.
3. If a grant is needed (read-source SELECT missing): create a **grant/fix
   command-pack PR** (the §8 candidate) → **Codex review** → **separate explicit
   Helen GO** → **one grant/fix execution only** → **post-grant proof PR**.
4. Only after the proof passes does a **separate explicit Stage 0 execution GO**
   become available (then the Gate S3-NG2 command pack runs under the confirmed
   `buyerrecon_scoring_worker` login role).
5. **No ad-hoc grant. No Stage 0 execution until the chain completes.**

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, candidate SQL
structure, or stop-line / boundary language — not row values. The candidate SQL
is fenced `CANDIDATE ONLY — DO NOT RUN` and is not executed by this PR.
