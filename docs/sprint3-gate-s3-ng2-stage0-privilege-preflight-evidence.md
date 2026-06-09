# Sprint 3 — Gate S3-NG2: Stage 0 Read-Only Privilege Preflight — Evidence (BLOCKED)

**Status:** `GATE_S3_NG2_STAGE0_PRIVILEGE_PREFLIGHT_BLOCKED_MISSING_PRIVILEGES`

This is a **docs-only evidence record**. It records the result of the
**read-only** Stage 0 role/privilege preflight authorized for `Gate S3-NG2`.
The **preflight command exited 0, but privilege readiness is blocked**: the
confirmed execution role is missing the required Stage 0 privileges, which
**triggered the stop-line**. **Stage 0 execution is not authorized.**

This PR applies **no** fix, authorizes **no** GRANT/DML/DDL, runs **no** SQL,
runs **no** Stage 0 execution, and recommends/applies **no** grant. It records
booleans/metadata only — no row values, identifiers, payloads, or secrets.

> Provenance: command pack merged via PR #162 at
> `242d561e5eafea3bf1d2b4f222c6a0abd51f8eb5`.

---

## 1. Title & Status

- Title: Gate S3-NG2 — Stage 0 Read-Only Privilege Preflight — Evidence (BLOCKED).
- Status: `GATE_S3_NG2_STAGE0_PRIVILEGE_PREFLIGHT_BLOCKED_MISSING_PRIVILEGES`.
- One line: preflight ran clean (exit 0), but required Stage 0 privileges are
  missing for the confirmed role → stop-line triggered → Stage 0 blocked.

---

## 2. Authorization & Scope

- Helen issued the GO:
  `HELEN GATE S3-NG2 STAGE0 READONLY PRIVILEGE PREFLIGHT GO`.
- The GO authorized **only** the read-only Stage 0 role/privilege preflight.
- It did **not** authorize Stage 0 execution, GRANTs, permission fixes,
  extractor rerun, risk/POI/evidence snapshot, Lane/scoring/AMS/customer output,
  Gate 4E, or Gate 4F.
- Helen ran the preflight manually. Claude Code did not execute anything.

---

## 3. Command-Pack Prerequisite (PR #162)

- Command pack merged: PR #162
  (`242d561e5eafea3bf1d2b4f222c6a0abd51f8eb5`, status
  `GATE_S3_NG2_STAGE0_COMMAND_PACK_REVIEW_ONLY`).
- The command pack required this read-only privilege preflight (for the
  confirmed execution role) before any Stage 0 execution, and made a failed /
  unconfirmed privilege preflight an explicit pre-execution stop-line.

---

## 4. Execution Summary

- Branch: `sprint2-architecture-contracts-d4cc2bf`.
- HEAD: `242d561e5eafea3bf1d2b4f222c6a0abd51f8eb5`.
- `APP_DSN_loaded=true`; `APP_DSN_unset=true` (loaded without printing; unset
  afterward).
- Log path:
  `/tmp/gate-s3-ng2-stage0-readonly-privilege-preflight-20260609T204636Z.log`.
- Preflight command exit code: `0`.

---

## 5. Source / Script Gate

- `stage0_run_script_present=true`.
- Expected command: `npm run stage0:run`.

---

## 6. DB / Read-Only Gate

- database: `buyerrecon_production`
- current_user: `buyerrecon_prod_collector_app`
- current_role: `buyerrecon_prod_collector_app`
- transaction_read_only: `on`
- `read_only_set=true`
- `rollback_used=true`
- `commit_used=false`

**Read-only transaction, rollback used, no COMMIT.**

---

## 7. Required Relation Gate

- `accepted_events_present=true`
- `ingest_requests_present=true`
- `stage0_decisions_present=true`

All required relations exist.

---

## 8. Privilege Preflight Result

Booleans only — for the confirmed role `buyerrecon_prod_collector_app`:

| privilege probe | result |
|---|---|
| `accepted_events_select` | `false` |
| `ingest_requests_select` | `false` |
| `stage0_insert` | `false` |
| `stage0_update` | `false` |
| `stage0_select_returning` | `false` |

All five required Stage 0 privileges are **missing** for this role.

---

## 9. Stop-Line Triggered

- The **preflight command exited 0, but privilege readiness is blocked.**
- **Missing required privileges triggered the stop-line** defined in the PR #162
  command pack ("failed read-only privilege preflight or unconfirmed required
  privilege").
- This is the pre-execution gate stop-line; Stage 0 must **not** run.

---

## 10. Interpretation

- The read-only preflight itself **completed successfully** (exit 0, read-only,
  rolled back, no COMMIT).
- The Stage 0 script exists and the required relations exist.
- The confirmed current execution role is `buyerrecon_prod_collector_app`.
- The required Stage 0 privileges are **missing** for that role
  (`accepted_events` SELECT, `ingest_requests` SELECT, `stage0_decisions`
  INSERT/UPDATE/SELECT).
- This is a **stop-line under PR #162**.
- **Stage 0 execution remains blocked and unauthorized.**
- **No ad hoc GRANT or permission fix is allowed from this evidence PR.**
- **The next step must be a separate privilege/role resolution planning PR, not
  a grant.**

> Note (carried forward, not over-claimed): the behavioural extractor ran as
> `buyerrecon_prod_collector_app` against its own target, but that does not
> imply this role holds Stage 0's required privileges — and the evidence here
> confirms it does not. The least-privilege fix path is a separate planning
> decision (which role, which exact privileges), not an assumption.

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
2. Then create a **separate docs-only privilege/role resolution planning PR for
   Stage 0** — **not** a grant. That future PR should decide the
   **least-privilege fix path** (which role, which exact privileges on
   `accepted_events` / `ingest_requests` / `stage0_decisions`) and require
   **Codex review + explicit Helen GO** before any privilege change.
3. **No ad hoc grant.** No Stage 0 execution until the privilege/role resolution
   is planned, reviewed, GO-approved, applied, and proofed — then a separate
   explicit Stage 0 GO is still required.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, privilege-probe
booleans, or stop-line / boundary language — not business row values. The DSN
was loaded from `DATABASE_URL` only and never printed; `APP_DSN` was unset.
