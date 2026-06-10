# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof — Evidence (BLOCKED: no production access)

**Status:** `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_BLOCKED`

This is a **docs-only evidence record**. The authorized one-shot bounded action
(**create + grant + prove** the dedicated Stage 0 login role
`buyerrecon_stage0_runner`) **was not performed from this environment**, because
this environment is **not the production host** and has **no admin database
connection and no secure admin/password mechanism**. **No role was created, no
grant ran, no proof connected, and nothing was fabricated.**

This PR creates no role, sets no password, applies no grant, runs no SQL/DDL/DML,
and runs no Stage 0. It records safe labels / preflight facts only — no secrets,
password, DSN, or raw data.

> Provenance: PR #179 dedicated login-role plan / command pack
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`,
> `STAGE0_DEDICATED_LOGIN_ROLE_PLANNING_ONLY`).

---

## 1. Authorization

- Exact GO phrase: `HELEN STAGE0 DEDICATED ROLE CREATE-GRANT-PROOF GO`.
- Scope authorized: exactly **one** bounded production operator action — create
  `buyerrecon_stage0_runner` (safe attributes), apply the PR #179 direct-grant
  set, and prove it (positive + negative privilege proofs).
- The GO did **not** authorize Stage 0 execution.

---

## 2. Preflight (verifiable facts)

- Required PR #179 merge commit: `5af3da6575521446d95adf0b82ed8044efa30a6b`.
- Reviewed command-pack doc:
  `docs/sprint3-stage0-dedicated-login-role-plan.md`.

Preflight results (this environment):
- `pr179_merge_present=true` — PR #179 merge commit is an ancestor of the base.
- `command_pack_doc_present=true` — the reviewed command-pack doc is present.
- `on_production_host=false` — this environment is **not** the production host
  `/opt/buyerrecon-backend`.
- `pg_admin_conn_env_present=false` — **no** admin database connection is
  available here.
- `stage0_runner_pw_present=false` — **no** secure admin/password mechanism is
  available here (and Claude Code must not request/handle that secret).

---

## 3. Blocking Reason

The action requires a **privileged production operation** — `CREATE ROLE` +
`GRANT` against `buyerrecon_production`, with the dedicated role's password
supplied via the **secure admin mechanism** — followed by a proof connection.
Two independent blockers prevent doing this from here:

1. **No production-host access.** This environment is not
   `/opt/buyerrecon-backend`; Claude Code has no production terminal access and
   does not execute production DDL/grants. (Consistent with the entire prior
   chain — privileged operator actions are run **by the operator on the host**;
   Claude Code records evidence only.)
2. **No admin connection / no secure password mechanism.** There is no
   superuser/`CREATEROLE` admin database connection and no secure password
   mechanism in this environment; `CREATE ROLE … PASSWORD …` and the grants
   cannot be run, and must not be simulated.

Per the PR #179 command pack and its stop-lines, the action **stops** rather
than improvising — no role created, no grant, no proof connection, no fabricated
labels.

---

## 4. Action State (safe labels)

- `role_created=false`
- `grants_applied=false`
- `proof_connected=false`
- `role_exists_proven=n/a` (no admin connection to query the catalog)
- `positive_privileges_proven=n/a`
- `negative_privileges_proven=n/a`
- `password_set=false`
- `password_or_dsn_printed=false`
- Log path: none (no operator action ran; no log produced).
- Exit state: stopped at preflight (before any DDL/grant/connection).

None of the expected proof labels were produced — neither the positive Stage 0
privilege checks (`role_exists`, `priv_accepted_events_select`,
`priv_stage0_insert`, …) nor the negative absence checks
(`forbidden_risk_*`, `forbidden_poi_*`, `not_member_scoring_worker`,
`owns_no_tables`, …) — because the action was **not** run.

---

## 5. Verdict

- **BLOCKED — action not performed.** The dedicated role
  `buyerrecon_stage0_runner` was **not** created, granted, or proven from this
  environment.
- This is **not** a Stage 0 runtime/permission/code failure and **not** a PR #179
  command-pack failure. The command pack's posture held: no role/grant was
  improvised, no password/secret was handled, and no proof labels were
  fabricated.

---

## 6. Explicit Confirmations (what did not happen)

- No role created; no `CREATE ROLE`.
- No password set / changed (no secure mechanism touched).
- No DSN created / changed.
- No grant applied (none of the PR #179 direct-grant set, and nothing beyond it).
- No membership in `buyerrecon_scoring_worker` granted.
- No SQL / DDL / DML executed.
- No Stage 0 command; no run-lock touch.
- No password / DSN / token printed; no hostname / IP / raw IDs / raw row values
  / payload / customer data printed.
- No extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 7. Required Next Step

1. **Codex review and merge** of this blocked evidence PR.
2. The bounded create/grant/proof must be **run by the operator on the
   production host** `/opt/buyerrecon-backend` (not by Claude Code), using the
   merged PR #179 command pack: `CREATE ROLE buyerrecon_stage0_runner` (safe
   attributes; password via the secure admin mechanism, never printed) + the
   direct-grant set + the positive/negative privilege proof — emitting **safe
   labels/booleans only**.
3. Record the operator's safe-label output in a **docs-only evidence PR**
   (PASS if positive privileges present and all negative-absence checks hold;
   BLOCKED otherwise). If the operator hands the safe labels back, this evidence
   record can be produced from that actual output.
4. **Only if the dedicated-role proof passes** may Helen issue a **separate Stage
   0 execution GO**. No Stage 0 rerun is authorized until then.

---

## 8. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. No password/secret was
read or handled in this attempt. All identifier references are role / database /
relation / sequence names, env-var names, SQL identifiers, or stop-line /
boundary language — not secret or row values.
