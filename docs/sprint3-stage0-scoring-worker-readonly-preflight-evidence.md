# Sprint 3 — Gate S3-NG2: Stage 0 Correct-Role Read-Only Privilege Preflight (`buyerrecon_scoring_worker`) — Evidence (BLOCKED)

**Status:** `STAGE0_SCORING_WORKER_PREFLIGHT_BLOCKED_READ_SOURCE_SELECT_MISSING`

This is a **docs-only evidence record**. It records the result of the
**correct-role** read-only Stage 0 privilege preflight for
`buyerrecon_scoring_worker` (the migration-intended Stage 0 writer per PR #164).
The **preflight exit code was 0, but read-source SELECT readiness is blocked**:
`stage0_decisions` write-side privileges are already true, while SELECT on the
two read sources is missing.

This PR applies **no** grant, **no** permission fix, runs **no** SQL, and
authorizes **no** Stage 0 execution. It records booleans/metadata only — no row
values, identifiers, payloads, or secrets.

> Provenance: PR #164 Stage 0 privilege/role resolution plan
> (`7ffff23088a1c5fe2e3845515d6f53c0a5948a49`, status
> `STAGE0_PRIVILEGE_ROLE_RESOLUTION_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: Gate S3-NG2 — Stage 0 Correct-Role Read-Only Privilege Preflight
  (`buyerrecon_scoring_worker`) — Evidence (BLOCKED).
- Status: `STAGE0_SCORING_WORKER_PREFLIGHT_BLOCKED_READ_SOURCE_SELECT_MISSING`.
- One line: correct-role preflight ran clean (exit 0); `stage0_decisions`
  write-side privileges already true; **remaining blocker is SELECT on
  `accepted_events` and `ingest_requests` for `buyerrecon_scoring_worker`**.

---

## 2. Authorization & Scope

- Helen issued the GO:
  `HELEN GATE S3-NG2 STAGE0 SCORING_WORKER READONLY PREFLIGHT GO`.
- The GO authorized **only** the correct-role read-only Stage 0 privilege
  preflight for `buyerrecon_scoring_worker`.
- It did **not** authorize any grant, SQL fix, Stage 0 execution, extractor
  rerun, worker/downstream runtime, Lane/scoring/AMS/customer output, Gate 4E,
  or Gate 4F.
- Helen ran the preflight manually. Claude Code did not execute anything.

---

## 3. PR #164 Prerequisite

- PR #164 (Stage 0 privilege/role resolution plan) merged
  (`7ffff23088a1c5fe2e3845515d6f53c0a5948a49`). It recommended **Option B** —
  run Stage 0 as `buyerrecon_scoring_worker` (the migration-012-intended Stage 0
  writer) — and flagged the read-source SELECT privileges as the unconfirmed gap
  to verify under the correct role before any grant. This preflight closes that
  verification.

---

## 4. Execution Summary

- Branch: `sprint2-architecture-contracts-d4cc2bf`.
- HEAD: `7ffff23088a1c5fe2e3845515d6f53c0a5948a49`.
- Script gate: `stage0_run_script_present=true`; expected command
  `npm run stage0:run`.
- Log path:
  `/tmp/gate-s3-ng2-stage0-scoring-worker-readonly-preflight-20260609T211645Z.log`.
- Preflight exit code: `0`.

---

## 5. Role Existence Gate

- `scoring_worker_role_exists=true`
- `scoring_worker_can_login=false`

`buyerrecon_scoring_worker` exists but **cannot login directly**
(`rolcanlogin=false`) — it is a NOLOGIN group role; future Stage 0 execution
needs an appropriate **login/member-role path**.

---

## 6. DB / Read-Only Gate

- database: `buyerrecon_production`
- session_user: `postgres`
- current_user: `buyerrecon_scoring_worker`
- current_role: `buyerrecon_scoring_worker`
- transaction_read_only: `on`
- `SET ROLE buyerrecon_scoring_worker` succeeded inside the read-only preflight
- rollback used
- no COMMIT

The preflight assumed the correct role via `SET ROLE` (session_user `postgres`)
inside a **read-only transaction, rollback used, no COMMIT**.

---

## 7. Required Relation Gate

- `accepted_events_present=true`
- `ingest_requests_present=true`
- `stage0_decisions_present=true`

All required relations exist.

---

## 8. Privilege Preflight Result

Booleans only — for role `buyerrecon_scoring_worker`:

| privilege probe | result |
|---|---|
| `accepted_events_select` | `false` |
| `ingest_requests_select` | `false` |
| `stage0_insert` | `true` |
| `stage0_update` | `true` |
| `stage0_select_returning` | `true` |

---

## 9. Interpretation

- The correct-role preflight **completed successfully** (exit 0, read-only,
  rolled back, no COMMIT).
- `buyerrecon_scoring_worker` is **confirmed as an existing role**.
- `buyerrecon_scoring_worker` is **not a login role** (`rolcanlogin=false`), so
  **future Stage 0 execution needs an appropriate login/member-role path** (a
  login role that is a member of `buyerrecon_scoring_worker`).
- **`stage0_decisions` write-side privileges are already true** and sufficient
  for the Stage 0 upsert path: INSERT=true, UPDATE=true, SELECT/RETURNING=true.
- **The remaining blocker is SELECT on `accepted_events` and `ingest_requests`
  for `buyerrecon_scoring_worker`** (both false).
- This **confirms the narrow remaining blocker predicted by PR #164**.
- **The preflight exit code was 0, but read-source SELECT readiness is blocked.**
- This is a **pre-execution blocker, not a Stage 0 runtime failure**.
- Stage 0 did not run. No grant was applied. No permission fix was applied.
- **The next step is a separate grant command-pack PR, not a grant.**

---

## 10. Stop-Line Triggered

- Read-source SELECT privileges for `buyerrecon_scoring_worker` are missing
  (`accepted_events_select=false`, `ingest_requests_select=false`) → the
  pre-execution privilege stop-line from PR #162 / PR #164 is triggered.
- Stage 0 must **not** run until those read-source privileges are resolved
  (planned → reviewed → GO → granted → proofed) under the correct role, and a
  separate explicit Stage 0 execution GO is given.
- No ad-hoc grant; no permission fix from this evidence PR.

---

## 11. What Did Not Run

- No Stage 0 execution.
- No production command by this PR.
- No SQL by this PR.
- No GRANT / DML / DDL; no permission fix.
- No extractor rerun.
- No risk worker / POI worker / evidence snapshot execution.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 12. Next Gated Step

1. **Codex review and merge** of this docs-only evidence PR.
2. Then create a **separate docs-only Stage 0 read-source SELECT grant
   command-pack PR** — **not** a grant. That future command pack should be
   limited to:
   - `GRANT SELECT ON TABLE public.accepted_events TO buyerrecon_scoring_worker;`
   - `GRANT SELECT ON TABLE public.ingest_requests TO buyerrecon_scoring_worker;`
   (`CANDIDATE ONLY — DO NOT RUN`), applied **only** after Codex review and
   explicit Helen GO.
3. It must **not** grant: `stage0_decisions` privileges (already true);
   schema-wide grants; database-wide grants; DELETE/TRUNCATE/REFERENCES/TRIGGER;
   Lane/scoring/AMS/customer/Gate privileges.
4. After any grant: a **post-grant proof PR** (booleans only), and the
   **login/member-role path** for `buyerrecon_scoring_worker` must be resolved.
5. **No ad-hoc grant. No Stage 0 execution** until the grant is planned,
   reviewed, GO-approved, applied, proofed, and a separate explicit Stage 0
   execution GO is given.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, privilege-probe
booleans, or stop-line / boundary language — not row values. The preflight ran
read-only (rollback, no COMMIT); no DSN/secret was printed.
