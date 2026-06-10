# Sprint 3 — Stage 0 Admin-Custody Resolution Plan (before dedicated-role create/grant/proof retry)

**Status:** `STAGE0_ADMIN_CUSTODY_RESOLUTION_PLANNING_ONLY`

This is a **reviewable, docs-only planning / command-pack record**. It defines a
safe way to supply an **approved production admin / `CREATEROLE` connection** for
**exactly one** bounded create/grant/proof action for `buyerrecon_stage0_runner`
— **without reusing `.env.production`** and **without exposing secrets**.

This PR **executes nothing**: no admin connection use, no role creation, no
password set, no DSN create/change, no SQL, no grant, no Stage 0. The candidate
command pack below is **CANDIDATE ONLY — DO NOT RUN**. No real admin DSN,
password, token, hostname, IP, raw ID, row value, or customer data appears in
this record.

> Provenance: PR #179 dedicated login-role plan/command pack
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #180 local blocked evidence
> (`4da2cbe72d4fdd3aa35abb82aa1117decddf5f87`); PR #181 production-host blocked
> evidence (`5c397cbbf6dfff69d2d5b3d5bb9872bedbbcba36`,
> `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PROD_BLOCKED`).

---

## 1. Carry-Forward Evidence

- PR #179 merge commit: `5af3da6575521446d95adf0b82ed8044efa30a6b` (dedicated
  Stage 0 role plan / direct-grant command pack).
- PR #180 merge commit: `4da2cbe72d4fdd3aa35abb82aa1117decddf5f87` (local
  blocked evidence — not on production host).
- PR #181 merge commit: `5c397cbbf6dfff69d2d5b3d5bb9872bedbbcba36`, status
  `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PROD_BLOCKED`.
- PR #181 production-host facts (safe labels):
  - production host reached (`on_production_host=true`); DB reached
    (`db_expected=true`);
  - `.env.production` `DATABASE_URL` **loaded without printing**;
  - `.env.production` is **not** admin / `CREATEROLE`:
    `admin_role_createrole=false`, `admin_role_superuser=false`;
  - **no** role created, **no** grants applied, **no** proof connected, **no**
    Stage 0 command, **no** run-lock touch.

---

## 1a. Review History

- **First Codex review of PR #182: BLOCKED.**
- **Blocker:** the candidate operator flow's admin-capability gate was
  **comment-only** — it printed the `db_expected` / `admin_role_createrole` /
  `admin_role_superuser` probe labels but the "proceed only if … else stop / exit"
  decision was written as a comment, so a probe returning
  `admin_role_createrole=false` / `admin_role_superuser=false` could finish
  without emitting the stop-line or exiting non-zero.
- **Patch response (this commit):** the §4 candidate flow now **parses** the
  allowlisted boolean labels into shell variables (`DB_EXPECTED`,
  `ADMIN_CREATEROLE`, `ADMIN_SUPERUSER`) and **fails closed** — it proceeds to
  the bounded PR #179 create/grant/proof step **only if** `DB_EXPECTED=true`
  **and** (`ADMIN_CREATEROLE=true` **or** `ADMIN_SUPERUSER=true`), emitting
  `admin_capability_gate_pass=true`; otherwise it emits
  `admin_capability_gate_pass=false` +
  `stop_line=admin_connection_lacks_createrole_or_superuser`, removes the raw
  temp file, unsets `ADMIN_DSN`, and **exits non-zero** (`5`).

---

## 2. Decision

- **Do not retry with `.env.production`.** It **reaches the DB** but is **not** an
  admin / `CREATEROLE` connection (PR #181: `admin_role_createrole=false`,
  `admin_role_superuser=false`).
- A **separate admin-custody mechanism is required** before any
  create/grant/proof retry. This plan defines acceptable mechanisms; it does not
  itself supply or use one.

---

## 3. Allowed Admin-Custody Options (review only)

### Option A — secure admin connection on the production host
- Provide a **temporary or managed admin / `CREATEROLE` connection mechanism** on
  `/opt/buyerrecon-backend` (e.g. an admin DSN injected via a managed secret
  store or a short-lived admin credential).
- Used **only** for the bounded PR #179 create/grant/proof action.
- **Never** committed, printed, logged, or stored in repo files.
- **Removed / unset after use** (session-scoped; no persistence in
  `.env.production` or any file).

### Option B — DBA / operator executes directly
- The DBA / operator runs the **PR #179 direct-grant command pack** using an
  **approved admin connection** under their own custody.
- Returns **only safe labels / booleans and exit status** — **no** secrets or
  raw connection details.

**No automatic choice.** Choose A or B only if Helen / admin has already decided;
if unresolved, this plan records the decision as **UNRESOLVED** and no retry is
authorized until it is made.

> Current decision state: **UNRESOLVED** — pending Helen / admin selection of
> Option A or Option B.

---

## 4. Candidate Operator Flow — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for **one** bounded admin-custody create/grant/proof action, run by
> the operator on the production host with an approved admin mechanism. Emits
> **safe labels/booleans only**; never prints admin DSN/password/token/host/IP/
> raw data.

```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
cd /opt/buyerrecon-backend

# (0) Repo / chain gates (names + booleans only):
[ "$(pwd)" = "/opt/buyerrecon-backend" ] && echo "on_production_host=true" || { echo "on_production_host=false"; exit 3; }
echo "repo_head=$(git rev-parse HEAD)"
git merge-base --is-ancestor 5af3da6575521446d95adf0b82ed8044efa30a6b HEAD && echo "pr179_merge_present=true" || { echo "pr179_merge_present=false"; exit 3; }
git merge-base --is-ancestor 5c397cbbf6dfff69d2d5b3d5bb9872bedbbcba36 HEAD && echo "pr181_merge_present=true" || { echo "pr181_merge_present=false"; exit 3; }
[ -f docs/sprint3-stage0-dedicated-login-role-plan.md ] && echo "command_pack_doc_present=true" || { echo "command_pack_doc_present=false"; exit 3; }

# (1) Approved ADMIN connection supplied secret-safe (NOT .env.production; never printed):
#     ADMIN_DSN is injected by the approved admin mechanism into the env only.
[ -n "${ADMIN_DSN:-}" ] && echo "admin_dsn_loaded_without_printing=true" || { echo "admin_dsn_loaded_without_printing=false"; exit 2; }

# (2) Admin-capability gate (safe labels only; raw psql output -> chmod-600 temp, never printed):
RAW="$(mktemp /tmp/bapp-admin-probe-raw.XXXXXX)"; chmod 600 "$RAW"
trap 'rm -f "$RAW"; unset ADMIN_DSN' EXIT INT TERM
if PGCONNECT_TIMEOUT=8 psql "$ADMIN_DSN" --no-psqlrc --set ON_ERROR_STOP=1 \
     -v ON_ERROR_STOP=1 > "$RAW" 2>&1 <<'SQL'
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SELECT 'db_expected|'           || (current_database() = 'buyerrecon_production')::text;
SELECT 'admin_role_createrole|' || (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user)::text;
SELECT 'admin_role_superuser|'  || (SELECT rolsuper      FROM pg_roles WHERE rolname = current_user)::text;
SQL
then admin_probe_ok=true; else admin_probe_ok=false; fi
echo "admin_probe_ok=${admin_probe_ok}"
echo "raw_output_printed=false"   # RAW is parsed for the 3 allowlisted labels only; never cat/tee'd
[ "${admin_probe_ok}" = "true" ] || { echo "admin_capability_gate_pass=false"; echo "stop_line=admin_probe_failed"; rm -f "$RAW"; unset ADMIN_DSN; exit 4; }

# (3) EXECUTABLE admin-capability gate — parse allowlisted booleans; fail closed.
#     (No raw connection text printed; only the parsed boolean values are used.)
DB_EXPECTED="$(grep -E '^db_expected\|'           "$RAW" | tail -n1 | cut -d'|' -f2)"
ADMIN_CREATEROLE="$(grep -E '^admin_role_createrole\|' "$RAW" | tail -n1 | cut -d'|' -f2)"
ADMIN_SUPERUSER="$(grep -E '^admin_role_superuser\|'  "$RAW" | tail -n1 | cut -d'|' -f2)"

if [ "$DB_EXPECTED" = "true" ] && { [ "$ADMIN_CREATEROLE" = "true" ] || [ "$ADMIN_SUPERUSER" = "true" ]; }; then
  echo "admin_capability_gate_pass=true"
else
  echo "admin_capability_gate_pass=false"
  echo "stop_line=admin_connection_lacks_createrole_or_superuser"
  rm -f "$RAW"; unset ADMIN_DSN
  exit 5                                 # fail closed: do NOT proceed to create/grant/proof
fi

# (4) ONLY THEN (admin_capability_gate_pass=true) run the PR #179 direct-grant command pack (§4a of the dedicated-role plan):
#     CREATE ROLE buyerrecon_stage0_runner (safe attrs; password via secure admin mechanism, never printed)
#     + SELECT accepted_events / SELECT ingest_requests / SELECT,INSERT,UPDATE stage0_decisions
#     + positive + negative privilege proof (booleans only). No membership, no sequence, no schema-wide,
#     no ownership, no Risk/POI/POI-seq/Lane/scoring/AMS/customer/Gate grants. No Stage 0; no run-lock.
#     Emit safe labels only; residue-scan raw output; fail closed.

# trap removes RAW and unsets ADMIN_DSN on exit.
```

Expected safe labels (admin-capable case): `db_expected=true`,
`admin_role_createrole=true` **or** `admin_role_superuser=true`,
`admin_probe_ok=true`, `raw_output_printed=false` → then the PR #179
create/grant/proof labels. If admin capability is false, emit
`stop_line=admin_connection_lacks_createrole_or_superuser` and exit non-zero.

---

## 5. Stop-Lines

Abort if any of the following:
- **`.env.production` is used as the admin connection** (it is not admin /
  `CREATEROLE`);
- the admin connection **cannot prove `CREATEROLE` or superuser**
  (`admin_role_createrole=false` AND `admin_role_superuser=false`);
- any admin **DSN / password / token would be printed or stored** (committed,
  logged, or written to a repo file);
- the admin connection **target DB is not `buyerrecon_production`**
  (`db_expected=false`);
- the command **differs from the PR #179 direct-grant command pack**;
- **any membership in `buyerrecon_scoring_worker`** is proposed for
  `buyerrecon_stage0_runner`;
- **any sequence / schema-wide / ownership / Risk / POI / POI-Sequence / Lane /
  scoring / AMS / customer / Gate grant** is proposed;
- **any Stage 0 command** would run;
- **any run-lock touch** would occur;
- raw `psql` output / raw IDs / row values / payload / customer data would be
  printed.

If a stop-line is hit, record the blocked state in a docs-only evidence PR before
further action.

---

## 6. Non-Authorizations

This PR does **not** authorize:
- admin connection use;
- role creation;
- password set / change;
- DSN create / change;
- SQL execution;
- grants;
- role changes;
- DML / DDL;
- Stage 0 execution;
- run-lock touch;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 7. Next Gated Sequence

1. Open this docs-only admin-custody resolution plan.
2. **Codex review.**
3. **Merge if PASS.**
4. **Helen issues explicit GO** for **one** bounded admin-custody
   create/grant/proof action (after choosing Option A or Option B).
5. Operator runs it **on production** using the **approved admin mechanism**
   (never `.env.production`; secret-safe; safe labels only).
6. **Docs-only evidence PR** records the safe-label result.
7. **Only if the proof passes** (positive Stage 0 privileges present + all
   negative-absence checks hold) may Helen issue a **separate Stage 0 execution
   GO**.

---

## 8. Safety / Raw-Data Boundary

This record contains no admin DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The candidate flow loads
any admin DSN from an approved secret-safe mechanism into the env only
(`ADMIN_DSN`), parses raw `psql` output for **allowlisted booleans only**, never
prints it, and unsets/removes it on exit. All values shown are **safe labels /
booleans / public git commit hashes / role-attribute and gate facts / a stop-line
token** — not secret or row values.
