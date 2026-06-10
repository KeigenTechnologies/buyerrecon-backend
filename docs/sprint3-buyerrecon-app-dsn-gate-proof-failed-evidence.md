# Sprint 3 — `buyerrecon_app` DSN Gate Proof — Failed Before Proof SQL (Evidence)

**Status:** `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_FAILED_INVALID_DSN_INPUT`

This is a **docs-only evidence record**. It records that the authorized
`buyerrecon_app` DSN gate-proof attempt **failed before the proof SQL ran**: the
pasted value was **not accepted as a valid PostgreSQL connection string**, so
`psql` fell back to local socket / default OS-user behaviour and tried role
`root`. **The proof did not pass; no proof identity was established.**

This is a **DSN input / custody / format issue — not a Stage 0 runtime failure,
not a permission failure inside Stage 0, and not evidence that Stage 0 code is
broken.** This PR changes no DSN, edits no secret, mutates no `.env.production`,
changes no roles, runs no SQL, and reruns nothing. It records booleans / gate
facts only — no secrets, DSN, passwords, or raw data.

> Provenance: PR #175 gate-proof plan
> (`5c4b182e4f91ed25b07bba0a27cadecd6551ca10`,
> `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: `buyerrecon_app` DSN Gate Proof — Failed Before Proof SQL (Evidence).
- Status: `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_FAILED_INVALID_DSN_INPUT`.
- One line: `psql` failed to connect **before** the proof SQL (fell back to role
  `root` via local socket) → the pasted value was not a valid `buyerrecon_app`
  DSN; the proof did **not** pass.

---

## 2. Authorization & Scope

- Helen issued the GO: `HELEN BUYERRECON_APP DSN GATE PROOF GO`.
- The GO authorized **exactly one** secret-safe `buyerrecon_app` DSN
  role/database gate proof **only**.
- It did **not** authorize Stage 0 execution.
- Helen ran the attempt manually. Claude Code did not execute anything.

---

## 3. PR #175 Prerequisite

- PR #175 (`buyerrecon_app` DSN gate-proof plan) merged
  (`5c4b182e4f91ed25b07bba0a27cadecd6551ca10`). It defined a secret-safe,
  read-only role/database gate proof (pre-proof writable session gate + protected
  read-only proof transaction), with the DSN loaded without printing and no
  Stage 0 command.

---

## 4. Attempt Summary

- Production host context was reached.
- Repo path: `/opt/buyerrecon-backend`.
- HEAD matched the expected PR #175 merge:
  `5c4b182e4f91ed25b07bba0a27cadecd6551ca10`.
- `stage0:run` script present; maps to `tsx scripts/run-stage0-worker.ts`.
- Hidden DSN prompt reached:
  `Paste approved buyerrecon_app DSN now. Input will be hidden.`
- DSN loaded without printing: `dsn_loaded_without_printing=true`.
- Gate-proof start marker printed:
  `=== BUYERRECON_APP_DSN_GATE_PROOF_START ===`.

---

## 5. Failure Detail (before proof SQL)

- `psql` failed **before** executing the proof SQL:
  `psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL: role "root" does not exist`
- Log path: `/tmp/buyerrecon-app-dsn-gate-proof-20260610T105309Z.log`.
- Gate-proof exit code: `2`.
- Secret/raw sweep on the run output: `forbidden_pattern_count=0`.

The `FATAL: role "root" does not exist` / local-socket fallback indicates `psql`
ignored the intended connection string and used the **local socket + default OS
user (`root`)** — i.e. the pasted value was **not accepted as a full PostgreSQL
DSN / connection string** for `buyerrecon_app`.

---

## 6. Proof Booleans (not established)

The proof SQL did **not** run, so none of the required gate facts were
established:
- `current_user=buyerrecon_app` — **not established**;
- `current_database=buyerrecon_production` — **not established**;
- `gate_transaction_read_only=off` — **not established**;
- `proof_transaction_read_only=on` — **not established**.

---

## 7. Interpretation

- **The proof did not pass.**
- `psql` **fell back to local socket / default OS-user behaviour**, attempting
  role `root`.
- This indicates the provided value was **not accepted as a valid full
  PostgreSQL DSN / connection string** for `buyerrecon_app`.
- This is a **DSN input / custody / format issue** — **not** a Stage 0 runtime
  failure, **not** a permission failure inside Stage 0, and **not** evidence that
  Stage 0 code is broken.
- No Stage 0 command ran; no role change; no grant; no SQL fix; no downstream
  runtime.
- The DSN was loaded without printing and the secret sweep found
  `forbidden_pattern_count=0` — the failure exposed no secret.

---

## 8. What Did Not Run

- No `npm run stage0:run`; no Stage 0 worker.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot.
- No Lane A/B preview or writes.
- No scoring runtime; no AMS Trust/Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.
- No role change; no `ALTER ROLE`; no `GRANT role TO role`.
- No GRANT/DML/DDL.
- No `.env.production` mutation; no secret edit.

---

## 9. Required Next Step

1. **Do not retry the DSN gate proof yet.**
2. **Codex review and merge** of this evidence PR.
3. Then create a **separate docs-only resolution planning / command-pack patch
   PR before another proof attempt.** That PR should make the secret-safe DSN
   handoff **less error-prone** — e.g.:
   - require a **reviewed DSN custody path** for `buyerrecon_app`; and/or
   - add a **safer preflight that fails before `psql`** if the input is not a
     full PostgreSQL DSN / connection string (e.g. a structural check for a
     `postgres://`/`postgresql://`-shaped value) **without printing the DSN**.
4. **Alternatively**, choose **PR #174 Option B** — the dedicated Stage 0 login
   role path — if `buyerrecon_app` DSN custody remains unavailable or unclear.
5. **No Stage 0 rerun** is authorized; a Stage 0 execution GO remains
   unavailable until a `buyerrecon_app` (or approved dedicated role) gate proof
   passes and a separate explicit Stage 0 execution GO is given.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / evidence-only** and authorizes **none** of:
- no production command; no SQL; no DSN change; no secret edit; no
  `.env.production` mutation; no diagnostic rerun;
- no role change; no `ALTER ROLE`; no `GRANT role TO role`; no GRANT/DML/DDL; no
  permission fix; no grant;
- no Stage 0 rerun; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F; no downstream runtime.

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The pasted DSN was
loaded without printing and is **not** in this record (the run's own sweep:
`forbidden_pattern_count=0`). All identifier references are role / database /
relation names, env-var names, SQL identifiers, the standard local PostgreSQL
socket path quoted from the verbatim `psql` error
(`/var/run/postgresql/.s.PGSQL.5432`, a default socket path — not a host, secret,
or credential), the masked `tsx scripts/run-stage0-worker.ts` mapping, or
stop-line / boundary language — not secret or row values.
