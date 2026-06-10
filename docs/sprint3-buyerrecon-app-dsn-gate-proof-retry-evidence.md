# Sprint 3 — `buyerrecon_app` DSN Gate-Proof Retry — Evidence (BLOCKED before hidden DSN input)

**Status:** `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_RETRY_BLOCKED`

This is a **docs-only evidence record**. The authorized one-shot gate-proof retry
**stopped at preflight, before any hidden DSN input**, because the execution
environment available here is **not the production host** and the approved
`buyerrecon_app` DSN custody (PR #177 §3 Option A1/A2) is **not resolved/held in
this environment**. **No DSN was read, no `psql` ran, no proof was attempted, and
nothing was fabricated.**

This PR changes no DSN, edits no secret, mutates no `.env.production`, changes no
roles, runs no SQL, and runs no Stage 0. It records safe labels / preflight facts
only — no secrets, DSN, passwords, or raw data.

> Provenance: PR #177 reviewed command pack
> (`a5296d2575a7498e1952f28eefec705c0fb15a8e`,
> `STAGE0_BUYERRECON_APP_DSN_HANDOFF_STRUCTURAL_CHECK_PLANNING_ONLY`).

---

## 1. Authorization

- Exact GO phrase: `HELEN BUYERRECON_APP DSN GATE PROOF RETRY GO`.
- Scope authorized: exactly **one** `buyerrecon_app` DSN custody/shape validation
  + protected gate-proof attempt, using the PR #177 reviewed command pack.
- The GO did **not** authorize Stage 0 execution.

---

## 2. Repo / Chain Preflight (verifiable facts)

- Intended production host repo path: `/opt/buyerrecon-backend`.
- Base branch: `sprint2-architecture-contracts-d4cc2bf`.
- Required PR #177 merge commit: `a5296d2575a7498e1952f28eefec705c0fb15a8e`.
- Reviewed command-pack doc:
  `docs/sprint3-buyerrecon-app-dsn-handoff-structural-check-plan.md`.

Preflight results (this environment):
- `pr177_merge_present=true` — PR #177 merge commit is an ancestor of the base.
- `command_pack_doc_present=true` — the reviewed command-pack doc is present.
- `stage0_run_maps_to=tsx scripts/run-stage0-worker.ts` — present; **not
  executed**.
- `on_production_host=false` — the working environment is **not**
  `/opt/buyerrecon-backend`.
- `app_dsn_present_in_env=false` — no approved `buyerrecon_app` DSN is held in
  this environment (and Claude Code must not request/handle that production
  secret).

---

## 3. Blocking Reason (preflight stop, before hidden DSN input)

The retry stopped at **preflight requirement #7** (DSN custody must be a resolved
A1/A2 path; otherwise stop before hidden DSN input). Two independent blockers:

1. **No production-host access.** This environment is not the production host
   `/opt/buyerrecon-backend`; Claude Code has no production terminal access and
   does not execute production commands. (Consistent with the entire prior
   chain — every gate-proof / execution attempt was run manually by the operator;
   Claude Code recorded evidence only.)
2. **DSN custody unresolved here.** The approved `buyerrecon_app` DSN (PR #177 §3
   Option A1 managed custody, or A2 one-off secret-safe handoff) is **not held /
   not confirmed** in this environment. Per PR #177 §3, **unresolved DSN custody
   is a stop-line**.

Because preflight #7 fails, the flow **stops before the hidden DSN prompt** — no
`read -r -s APP_DSN`, no validator run, no `psql`. This is the reviewed
command pack's fail-closed behaviour applied at preflight.

---

## 4. Proof State (safe labels)

- `dsn_custody_resolved=false`
- `reached_hidden_dsn_prompt=false`
- `dsn_read=false`
- `dsn_structural_validation_run=false`
- `psql_proof_ran=false`
- `psql_connect_or_proof_ok=n/a` (psql not invoked)
- `residue_check_run=n/a` (no raw output produced; nothing to scan)
- `forbidden_pattern_count=0`
- `raw_temp_created=false`
- `raw_temp_removed=n/a` (no raw temp file created)
- Log path: none (no proof run; no log produced).
- Exit state: stopped at preflight (before DSN input); no proof exit code.

None of the expected success labels (`dsn_shape_valid=true`, … ,
`proof_user_expected|true`, `psql_connect_or_proof_ok=true`,
`residue_check_pass=true`) were produced, because the proof was **not** run.

---

## 5. Proof Verdict

- **BLOCKED — proof not attempted.** The `buyerrecon_app` DSN gate proof did
  **not** pass and did **not** fail at the SQL/connection layer; it was **not
  run**, because preflight stopped before hidden DSN input (no production-host
  access + unresolved DSN custody).
- This is **not** a Stage 0 runtime failure, **not** a permission failure inside
  Stage 0, and **not** evidence that Stage 0 code or the PR #177 command pack is
  broken. The command pack's fail-closed posture held: no DSN was handled and no
  raw output could leak.

---

## 6. Explicit Confirmations (what did not happen)

- No Stage 0 command ran; `npm run stage0:run` not reached.
- No run-lock touch.
- No DSN / password / token printed (none was read).
- No raw IDs / raw row values / payload / customer data printed.
- No DSN change.
- No secret edit.
- No `.env.production` mutation.
- No SQL executed (no proof `SELECT`s; no other SQL).
- No grant; no role change; no `ALTER ROLE`; no `GRANT role TO role`; no
  DML/DDL.
- No extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.
- No raw `psql` stdout/stderr printed (psql not invoked).
- No raw hostname / IP / user / URL / DSN components printed.

---

## 7. Required Next Step

1. **Codex review and merge** of this blocked evidence PR.
2. **Resolve the DSN custody / execution path** (a decision for Helen/admin),
   choosing one of:
   - **PR #177 §3 Option A1/A2** — make the approved `buyerrecon_app` DSN
     available **on the production host** to the operator who runs the reviewed
     command pack there (Claude Code does not handle the DSN), then re-issue a
     fresh one-shot gate-proof retry GO; **or**
   - **PR #174 Option B** — the dedicated Stage 0 login-role path (command-pack →
     Codex review → explicit Helen GO → role change → post-change proof).
3. The gate-proof retry must be **run by the operator on the production host**
   `/opt/buyerrecon-backend` (not by Claude Code), using the PR #177 reviewed
   command pack; its safe labels are then recorded in a docs-only evidence PR.
4. **No Stage 0 rerun** is authorized; a Stage 0 execution GO remains unavailable
   until a `buyerrecon_app` (or approved dedicated role) gate proof **passes** and
   a **separate explicit Stage 0 execution GO** is given.

---

## 8. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. No DSN was read in this
attempt. All identifier references are role / database / relation names, env-var
names, SQL identifiers, the masked `tsx scripts/run-stage0-worker.ts` mapping, or
stop-line / boundary language — not secret or row values.
