# Sprint 3 — `buyerrecon_app` DSN Handoff + Pre-`psql` Structural Check — Command-Pack / Plan (Review-Only)

**Status:** `STAGE0_BUYERRECON_APP_DSN_HANDOFF_STRUCTURAL_CHECK_PLANNING_ONLY`

This is a **reviewable, docs-only planning / command-pack record**. It designs a
**safer retry path** for the `buyerrecon_app` DSN gate proof by preventing
blank, partial, malformed, or mis-pasted DSN input from ever reaching `psql`
(the PR #176 failure mode), **without printing the DSN**.

This PR **executes nothing**: no production command, no SQL, no DSN change, no
secret edit, no `.env.production` mutation, no role change, no gate-proof retry,
no Stage 0. The candidate command pack below is **CANDIDATE ONLY — DO NOT RUN**.
This PR does **not** claim the `buyerrecon_app` DSN proof has passed.

> Provenance: PR #175 gate-proof plan (semantics carried forward); PR #176
> failed evidence (`0f15fd3ebd14155792a0b7f9b82652d4c81b1175`,
> `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_FAILED_INVALID_DSN_INPUT`).

---

## 1. Purpose

Design a safer retry path for the `buyerrecon_app` DSN gate proof by preventing
**blank, partial, malformed, or incorrectly pasted DSN input** from reaching
`psql`. In PR #176, `psql` fell back to the local socket / default OS user
(`FATAL: role "root" does not exist`) **because the pasted value was not a usable
full PostgreSQL connection string**. This plan adds a **pre-`psql` structural
check that fails closed** on bad input, emitting only safe booleans/labels.

---

## 2. Carry-Forward Evidence (PR #176)

- PR #176 merged at commit `0f15fd3ebd14155792a0b7f9b82652d4c81b1175`.
- Failed proof log path: `/tmp/buyerrecon-app-dsn-gate-proof-20260610T105309Z.log`.
- Exit code `2`.
- **Failure occurred before proof SQL.**
- `dsn_loaded_without_printing=true`.
- `forbidden_pattern_count=0` (no secret exposed).
- `psql` fell back to local socket / default OS role
  (`FATAL: role "root" does not exist`), proving the provided DSN was **not**
  successfully passed as a full PostgreSQL connection string.

---

## 3. Required Custody Decision (before retry)

Exactly one of the following must be resolved **before** any retry; **unresolved
DSN custody is a stop-line**:

- **Option A1 — reviewed managed custody path** for a correct `buyerrecon_app`
  DSN (a managed secret location that holds the full connection URI; load
  secret-safe; never printed).
- **Option A2 — one-off secret-safe handoff** of a **full `buyerrecon_app`
  PostgreSQL connection URI** (Helen/admin provides it into a temporary env var
  on the host without printing; no persistent `.env.production` mutation).
- **Option B — abandon the `buyerrecon_app` DSN path** and return to the PR #174
  **dedicated Stage 0 login-role** path (if the `buyerrecon_app` DSN custody is
  unavailable, unclear, or not acceptable).

This plan does **not** choose automatically. The choice depends on whether a
correct `buyerrecon_app` DSN custody path is known/acceptable — a custody
question for Helen to confirm. If it is not, prefer **Option B**.

---

## 4. Pre-`psql` Structural-Check Requirements

The candidate retry command pack must validate the DSN **before any `psql`
call** and **fail closed** if any condition fails. The check must:
- read the DSN **without echoing** it;
- **never print** DSN / password / token / hostname / username / query string /
  full URL;
- **reject empty input**;
- **reject** strings not beginning with `postgres://` or `postgresql://`;
- **parse with a safe parser** (Node `new URL(...)` or equivalent);
- require the **protocol** is PostgreSQL (`postgres:` / `postgresql:`);
- require a **hostname** exists;
- require a **username** exists;
- require a **database path** exists;
- require the **database name equals `buyerrecon_production`**;
- require the **username equals `buyerrecon_app`**, emitting only a
  boolean/labelled result (not the raw username);
- **reject whitespace / newline corruption** (the parsed value must be a single
  clean token);
- **fail before `psql`** if any structural validation fails;
- emit **only safe booleans / labels**, e.g.
  `dsn_shape_valid=true|false`, `dsn_db_expected=true|false`,
  `dsn_user_expected=true|false`;
- **never emit** the raw DSN, hostname, username, password, query string, or URL.

---

## 5. Candidate Command Pack — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for exactly one gate-proof retry. Reads the DSN hidden; validates
> structurally before `psql`; fails closed; emits booleans/labels only; runs no
> Stage 0.

### 5a. Guarded shell flow
```bash
# CANDIDATE ONLY — DO NOT RUN
cd /opt/buyerrecon-backend

# Gate: HEAD + PR #176 presence + stage0:run mapping (names only)
git rev-parse HEAD                                   # expect reviewed merged commit
git merge-base --is-ancestor 0f15fd3ebd14155792a0b7f9b82652d4c81b1175 HEAD \
  && echo "pr176_present=true" || { echo "pr176_present=false"; exit 3; }
grep -n '"stage0:run"' package.json                  # expect: tsx scripts/run-stage0-worker.ts

# Read DSN hidden; never echoed; in-shell only (no file write):
read -r -s APP_DSN; echo
[ -n "${APP_DSN:-}" ] && echo "dsn_nonempty=true" || { echo "dsn_nonempty=false"; unset APP_DSN; exit 2; }
export APP_DSN

# Structural validation BEFORE psql (fails closed; booleans/labels only):
APP_DSN="$APP_DSN" node scripts-or-inline-validator   # see §5b; prints dsn_shape_valid / dsn_db_expected / dsn_user_expected
VALID_RC=$?
if [ "$VALID_RC" -ne 0 ]; then
  echo "dsn_structural_validation=failed; stopping before psql"
  unset APP_DSN
  exit "$VALID_RC"
fi

# Only if structural validation passed: run the protected gate proof (§5c):
PGCONNECT_TIMEOUT=8 psql "$APP_DSN" \
  --no-psqlrc --set ON_ERROR_STOP=1 \
  -f /tmp/buyerrecon-app-dsn-gate-proof.sql \
  | tee "/tmp/buyerrecon-app-dsn-gate-proof-$(date -u +%Y%m%dT%H%M%SZ).log"

unset APP_DSN

# Secret residue check on the log (booleans only):
# grep -Eqi 'postgres(ql)?://|password=|:[^@/]*@' "<log>" && echo "log_secret_residue=true" || echo "log_secret_residue=false"
```

### 5b. Structural validator (Node; reads env, prints booleans only)
```javascript
// CANDIDATE ONLY — DO NOT RUN — emits booleans/labels only; never prints DSN components.
'use strict';
const raw = process.env.APP_DSN || '';
function fail(label){ console.log('dsn_shape_valid=false'); console.log('reason='+label); process.exit(4); }
if (raw.length === 0) fail('empty');
if (/\s/.test(raw)) fail('whitespace_or_newline');                 // reject corruption
if (!/^postgres(ql)?:\/\//.test(raw)) fail('bad_scheme');
let u;
try { u = new URL(raw); } catch { fail('unparseable'); }
if (!(u.protocol === 'postgres:' || u.protocol === 'postgresql:')) fail('bad_protocol');
if (!u.hostname) fail('no_host');
if (!u.username) fail('no_user');
const db = (u.pathname || '').replace(/^\//, '');
if (!db) fail('no_db');
const dbExpected   = db === 'buyerrecon_production';
const userExpected = u.username === 'buyerrecon_app';               // compare only; never print username
console.log('dsn_shape_valid=true');
console.log('dsn_db_expected=' + dbExpected);                       // boolean only
console.log('dsn_user_expected=' + userExpected);                   // boolean only
process.exit(dbExpected && userExpected ? 0 : 5);                   // fail closed on mismatch
```

### 5c. Protected gate-proof SQL (preserves PR #175 semantics)
```sql
-- CANDIDATE ONLY — DO NOT RUN — /tmp/buyerrecon-app-dsn-gate-proof.sql
-- (1) Pre-proof writable session/default gate (OUTSIDE any read-only block):
\echo '=== PRE_PROOF_WRITABLE_SESSION_GATE ==='
SELECT
  current_user AS gate_current_user,                                    -- expect: buyerrecon_app
  current_database() AS gate_database,                                  -- expect: buyerrecon_production
  current_setting('transaction_read_only') AS gate_transaction_read_only,           -- expect: off
  current_setting('default_transaction_read_only') AS gate_default_transaction_read_only; -- expect: off

-- (2) Protected read-only proof transaction (ROLLBACK; no write; no Stage 0):
\echo '=== READ_ONLY_PROOF_TRANSACTION ==='
BEGIN;
SET LOCAL transaction_read_only = on;
SELECT
  current_user AS proof_current_user,                                  -- expect: buyerrecon_app
  current_database() AS proof_database,                                -- expect: buyerrecon_production
  current_setting('transaction_read_only') AS proof_transaction_read_only,           -- expect: on
  current_setting('default_transaction_read_only') AS proof_default_transaction_read_only; -- expect: off
ROLLBACK;
```

Notes: `psql "$APP_DSN"` is passed the connection string **explicitly** so it
cannot silently fall back to local socket / default OS user (the PR #176 mode);
`ON_ERROR_STOP=1` halts on first error; `PGCONNECT_TIMEOUT` bounds the connect;
the proof runs **no** `npm run stage0:run` and performs **no** write
(`ROLLBACK`).

---

## 6. Stop-Lines

Abort the retry if any of the following:
- base branch or HEAD mismatch;
- PR #176 merge commit `0f15fd3ebd14155792a0b7f9b82652d4c81b1175` not present;
- DSN custody unresolved (§3 not decided);
- DSN missing / empty;
- DSN fails structural validation (`dsn_shape_valid=false`);
- the DSN parser emits any raw component (DSN/host/user/password/query/URL);
- the DSN validation log contains secret-shaped material;
- parsed database is not `buyerrecon_production` (`dsn_db_expected=false`);
- parsed user is not `buyerrecon_app` (`dsn_user_expected=false`);
- `psql` attempts a local socket / default OS role;
- proof `current_user` is not `buyerrecon_app`;
- proof `current_database` is not `buyerrecon_production`;
- the pre-proof writable gate is not established
  (`gate_transaction_read_only` not `off`);
- the proof transaction is not read-only (`proof_transaction_read_only` not
  `on`);
- any DSN / password / token / raw IDs / raw row values / payload / customer
  data appear;
- any SQL beyond the proof `SELECT`s is required;
- any `.env.production` mutation is required;
- any Stage 0 command would run;
- any run-lock touch would occur;
- any downstream extractor / risk / POI / evidence snapshot / Lane / scoring /
  AMS / customer output / Gate 4E / Gate 4F action would occur.

If any stop-line is hit, record the blocked state in a docs-only evidence PR
before further action.

---

## 7. Explicit Non-Authorizations

This PR does **not** authorize:
- gate-proof retry;
- Stage 0 rerun;
- DSN change;
- secret edit;
- `.env.production` mutation;
- SQL execution;
- role change;
- grant;
- DML / DDL;
- extractor / risk / POI / evidence snapshot / Lane / scoring / AMS / customer
  output / Gate 4E / Gate 4F runtime.

---

## 8. Next-Step Rule

After this PR is reviewed and merged, **Helen must give a new explicit GO for
exactly one gate-proof retry** using the reviewed command pack (and after the §3
custody decision). The retry produces a **docs-only gate-proof evidence PR**.
**Only if that gate proof passes** does a separate explicit Stage 0 execution GO
become available. This PR does **not** claim the `buyerrecon_app` DSN proof has
passed — it is planning / command-pack only.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / database / relation names, env-var names, SQL identifiers,
the DSN-scheme tokens `postgres://` / `postgresql://` used **only** as structural
shape checks (not values), the masked `tsx scripts/run-stage0-worker.ts`
mapping, or stop-line / boundary language. The candidate validator and proof
emit **booleans / labels only** and never print the DSN or any of its
components; the DSN is read hidden and never committed.
