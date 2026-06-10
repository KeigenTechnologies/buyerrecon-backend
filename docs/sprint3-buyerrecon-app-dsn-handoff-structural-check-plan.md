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

## 2a. Codex Review Status

- **First Codex review: BLOCKED** — the candidate `psql "$APP_DSN"` path could
  still print raw connection / auth / DNS failure details (hostname / IP / user /
  URL / DSN components); the residue check was only a commented placeholder and
  too narrow; the validator read like a placeholder
  (`node scripts-or-inline-validator`).
- **First patch (commit `5d5907d`)** fixed raw-`psql` suppression (chmod-600 raw
  temp file; raw output never printed) and the inline `node - <<'NODE'`
  validator, and changed proof SQL to booleans-only.
- **Second Codex re-review: still BLOCKED** — the residue scan existed as shell
  code but was **not wired into the main candidate flow** (the flow still had
  narrative comments like "Run the §5e classifier here" / "Build SAFE log…"); the
  psql-failure path emitted sanitized labels but did not clearly run the residue
  check and terminate non-zero; and on `forbidden_pattern_count > 0` the check
  removed `SAFE` and printed a stop-line but did **not** explicitly `exit`
  non-zero / fail closed.
- **This patch wires the residue scan into the live candidate flow and makes the
  forbidden-residue and psql-failure paths fail closed**, by:
  - **defining functions up front** (`emit_safe`, `cleanup`, `residue_scan`,
    `finalize_or_fail`) and **calling them directly** in the main flow — no
    "run §5e here" / "build SAFE log here" comments remain (§5a);
  - **suppressing raw `psql` stdout/stderr** — both streams redirected to a
    `chmod 600` raw temp file, **never** printed/`tee`/`cat` (§5a/§5d);
  - **psql-failure path is explicit** — emits only the sanitized labels, runs
    `finalize_or_fail`, removes `RAW`, unsets `APP_DSN`, and **`exit 4`** (§5a);
  - **success path scans before finalizing** — extracts only allowlisted
    `key|value` labels into `SAFE`, runs `finalize_or_fail`, and **`exit 6`** if
    residue is found, else `exit 0` (§5a);
  - **forbidden residue fails closed** — `finalize_or_fail` emits
    `residue_check_pass=false` / `forbidden_pattern_count=<n>` /
    `STOP_LINE: forbidden residue detected; safe log withheld`, removes `SAFE`,
    and returns non-zero so the flow exits non-zero (§5a/§5e);
  - **inline validator preserved** (booleans-only; never prints raw
    DSN/components/parse errors) (§5a/§5b);
  - **proof SQL preserved** as labelled `key|value` booleans only (§5c).

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

### 5a. Guarded shell flow (self-contained; sanitized; fail-closed)
```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
cd /opt/buyerrecon-backend

# --- file handles ---
RAW="$(mktemp /tmp/bapp-dsn-proof-raw.XXXXXX)"; chmod 600 "$RAW"   # raw psql output (NEVER printed)
SAFE="/tmp/buyerrecon-app-dsn-gate-proof-$(date -u +%Y%m%dT%H%M%SZ).log"  # safe log: sanitized labels only

# --- functions (defined up front; called by the main flow) ---
emit_safe(){ printf '%s\n' "$1" | tee -a "$SAFE"; }                # write ONE sanitized label to terminal + safe log

cleanup(){
  rm -f "$RAW" 2>/dev/null && echo "raw_temp_removed=true" || echo "raw_temp_removed=false"
  unset APP_DSN
}
trap cleanup EXIT INT TERM

# residue_scan: count-only over a file; NEVER prints matched lines. Echoes an integer count.
residue_scan(){
  local f="$1"
  [ -f "$f" ] || { echo 0; return; }
  grep -Eic \
    'postgres(ql)?://|://[^ ]*:[^ ]*@|[?&](password|sslmode|user)=|password[=:]|secret|token|bearer|[A-Za-z0-9._-]+:[0-9]{2,5}/|([0-9]{1,3}\.){3}[0-9]{1,3}' \
    "$f" 2>/dev/null || echo 0
}

# finalize_or_fail: run residue scan over RAW + SAFE; fail closed (exit non-zero) if anything found.
finalize_or_fail(){
  local raw_hits safe_hits forbidden
  raw_hits="$(residue_scan "$RAW")"; safe_hits="$(residue_scan "$SAFE")"
  forbidden=$(( raw_hits + safe_hits ))
  if [ "$forbidden" -eq 0 ]; then
    emit_safe "residue_check_pass=true"
    emit_safe "forbidden_pattern_count=0"
    return 0
  fi
  emit_safe "residue_check_pass=false"
  emit_safe "forbidden_pattern_count=${forbidden}"        # count only; matching lines NEVER printed
  emit_safe "STOP_LINE: forbidden residue detected; safe log withheld"
  rm -f "$SAFE" 2>/dev/null                                # withhold safe log
  return 1
}

# --- (0) gates: HEAD + PR #176 presence + stage0:run mapping (names only) ---
git rev-parse HEAD                                          # expect reviewed merged commit
git merge-base --is-ancestor 0f15fd3ebd14155792a0b7f9b82652d4c81b1175 HEAD \
  && emit_safe "pr176_present=true" || { emit_safe "pr176_present=false"; exit 3; }
grep -n '"stage0:run"' package.json                        # expect: tsx scripts/run-stage0-worker.ts

# --- (1) read DSN hidden; never echoed; in-shell only ---
read -r -s APP_DSN; echo
[ -n "${APP_DSN:-}" ] && emit_safe "dsn_nonempty=true" || { emit_safe "dsn_nonempty=false"; exit 2; }
export APP_DSN

# --- (2) structural validation BEFORE psql (inline node; booleans only; fail closed) ---
node - <<'NODE' | tee -a "$SAFE"
'use strict';
const raw = process.env.APP_DSN || '';
function out(k,v){ console.log(k + '=' + v); }
function fail(){ out('dsn_shape_valid','false'); process.exit(4); }   // no reason text; no raw components
if (raw.length === 0) fail();
if (/\s/.test(raw)) fail();                                           // reject whitespace/newline corruption
if (!/^postgres(ql)?:\/\//.test(raw)) fail();                        // require scheme
let u; try { u = new URL(raw); } catch { fail(); }                   // never print raw parse error
const protoOk = (u.protocol === 'postgres:' || u.protocol === 'postgresql:');
const hostOk  = !!u.hostname;
const userOk  = !!u.username;
const db      = (u.pathname || '').replace(/^\//, '');
const dbOk    = !!db;
const dbExpected   = db === 'buyerrecon_production';
const userExpected = u.username === 'buyerrecon_app';                 // compare only; never print username
out('dsn_shape_valid', String(protoOk && hostOk && userOk && dbOk));
out('dsn_protocol_expected', String(protoOk));
out('dsn_host_present', String(hostOk));
out('dsn_user_present', String(userOk));
out('dsn_db_present', String(dbOk));
out('dsn_db_expected', String(dbExpected));
out('dsn_user_expected', String(userExpected));
process.exit(protoOk && hostOk && userOk && dbOk && dbExpected && userExpected ? 0 : 5);
NODE
VALID_RC="${PIPESTATUS[0]}"
if [ "$VALID_RC" -ne 0 ]; then
  emit_safe "dsn_structural_validation=failed"
  finalize_or_fail || true        # scan SAFE before exit (raw not yet created by psql)
  exit "$VALID_RC"                 # trap cleanup removes RAW + unsets APP_DSN
fi
emit_safe "dsn_structural_validation=passed"

# --- (3) sanitized psql execution: BOTH stdout+stderr -> RAW (chmod 600); never printed ---
if PGCONNECT_TIMEOUT=8 psql "$APP_DSN" \
     --no-psqlrc --set ON_ERROR_STOP=1 \
     -f /tmp/buyerrecon-app-dsn-gate-proof.sql > "$RAW" 2>&1; then
  PSQL_OK=true
else
  PSQL_OK=false
fi

# --- (4) FAILURE path: sanitized labels, residue scan, fail closed ---
if [ "$PSQL_OK" != "true" ]; then
  emit_safe "psql_connect_or_proof_ok=false"
  emit_safe "psql_raw_output_captured=true"
  emit_safe "psql_raw_output_printed=false"
  emit_safe "STOP_LINE: psql failed; raw output withheld"   # raw (may hold host/IP/user/URL) NEVER printed
  finalize_or_fail || true                                  # residue scan still runs on RAW + SAFE
  exit 4                                                     # fail closed; trap removes RAW + unsets APP_DSN
fi

# --- (5) SUCCESS path: scan BEFORE finalizing; extract only allowlisted key|value labels ---
emit_safe "psql_connect_or_proof_ok=true"
# Extract only the allowlisted proof labels from RAW into SAFE (no raw connection text):
grep -E '^(db_expected|user_expected|session_readonly_off|default_readonly_off|proof_transaction_readonly_on|proof_db_expected|proof_user_expected)\|' \
  "$RAW" | tee -a "$SAFE" >/dev/null
if ! finalize_or_fail; then
  exit 6                                                     # forbidden residue -> fail closed (SAFE already withheld)
fi
emit_safe "gate_proof_safe_log=$SAFE"
exit 0                                                       # trap removes RAW + unsets APP_DSN
```

### 5b. Structural validator (inline `node` heredoc; booleans/labels only)

The validator is the inline `node - <<'NODE' … NODE` block embedded in §5a. It
reads `APP_DSN` **from the environment only**, never prints the DSN or any
component (host/user/password/query/URL/port) or raw parse-error text, and emits
**only** these static labels, exiting non-zero on any failure:
`dsn_shape_valid`, `dsn_protocol_expected`, `dsn_host_present`,
`dsn_user_present`, `dsn_db_present`, `dsn_db_expected`, `dsn_user_expected`.

### 5c. Protected gate-proof SQL (booleans/static labels only; preserves PR #175 semantics)
```sql
-- CANDIDATE ONLY — DO NOT RUN — /tmp/buyerrecon-app-dsn-gate-proof.sql
-- Emits ONLY labelled booleans (key|value). No raw current_user / current_database /
-- role name / hostname / row value / id / payload / customer data is printed.
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

-- (1) Pre-proof writable session/default gate (OUTSIDE any read-only block):
\echo '=== PRE_PROOF_WRITABLE_SESSION_GATE ==='
SELECT 'db_expected|'             || (current_database() = 'buyerrecon_production')::text;     -- expect: db_expected|true
SELECT 'user_expected|'           || (current_user = 'buyerrecon_app')::text;                  -- expect: user_expected|true
SELECT 'session_readonly_off|'    || (current_setting('transaction_read_only') = 'off')::text; -- expect: session_readonly_off|true
SELECT 'default_readonly_off|'    || (current_setting('default_transaction_read_only') = 'off')::text; -- expect: default_readonly_off|true

-- (2) Protected read-only proof transaction (ROLLBACK; no write; no Stage 0):
\echo '=== READ_ONLY_PROOF_TRANSACTION ==='
BEGIN;
SET LOCAL transaction_read_only = on;
SELECT 'proof_transaction_readonly_on|' || (current_setting('transaction_read_only') = 'on')::text;   -- expect: proof_transaction_readonly_on|true
SELECT 'proof_db_expected|'             || (current_database() = 'buyerrecon_production')::text;       -- expect: proof_db_expected|true
SELECT 'proof_user_expected|'           || (current_user = 'buyerrecon_app')::text;                   -- expect: proof_user_expected|true
ROLLBACK;
```

Note: the proof emits **labelled booleans only** (e.g. `db_expected|true`,
`proof_transaction_readonly_on|true`) — it never selects raw `current_user` /
`current_database` values. `psql "$APP_DSN"` is passed the connection string
**explicitly** so it cannot silently fall back to local socket / default OS user
(the PR #176 mode); `ON_ERROR_STOP=1` halts on first error; `PGCONNECT_TIMEOUT`
bounds the connect; the proof runs **no** `npm run stage0:run` and performs
**no** write (`ROLLBACK`).

### 5d. Sanitized failure / label-extraction behaviour (as wired in §5a)

The §5a flow implements both paths directly (no narrative placeholders):
- **psql success** (step 5): emits `psql_connect_or_proof_ok=true`, then
  extracts **only** the allowlisted `key|value` proof labels
  (`db_expected|…`, `user_expected|…`, `session_readonly_off|…`,
  `default_readonly_off|…`, `proof_transaction_readonly_on|…`,
  `proof_db_expected|…`, `proof_user_expected|…`) from `RAW` into `SAFE` via a
  fixed `grep -E '^(…)\|'` allowlist — never copying raw connection text — then
  calls `finalize_or_fail` and exits non-zero (`6`) if residue is found, else
  exits `0`.
- **psql failure** (step 4): emits **only** `psql_connect_or_proof_ok=false`,
  `psql_raw_output_captured=true`, `psql_raw_output_printed=false`, and
  `STOP_LINE: psql failed; raw output withheld`; **never** `cat`/`tee`/prints
  `RAW` (which can contain hostname/IP/user/URL/DSN fragments); runs
  `finalize_or_fail`; then **`exit 4`** (fail closed).
- `APP_DSN` is unset and `RAW` is removed by the `trap cleanup` on every exit
  (`raw_temp_removed=true`).

### 5e. Operational residue check (as wired in §5a)

The residue check is the `residue_scan()` + `finalize_or_fail()` pair defined at
the top of §5a and **called by the main flow** on every path (validation-fail,
psql-fail, psql-success) **before** any output is considered safe. It:
- runs over the **actual captured raw psql output** (`RAW`) **and** the `SAFE`
  log;
- **counts only** (DSN-scheme+authority, credential/secret/token patterns, URI
  authority fragments, query strings, host:port, and IP-shaped leakage) and
  **never prints matching lines**;
- emits only `residue_check_pass=true|false` and
  `forbidden_pattern_count=<count>`;
- **fails closed**: on `forbidden_pattern_count > 0` it withholds (`rm -f`) the
  `SAFE` log, emits `STOP_LINE: forbidden residue detected; safe log withheld`,
  and the main flow **exits non-zero** (`6`).

If a known forbidden raw value is available at run time, the operator adds it to
the `residue_scan` pattern set (still count-only, never printed).

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
- proof `user_expected` is not `true` (proof identity is not `buyerrecon_app`);
- proof `db_expected` / `proof_db_expected` is not `true` (not
  `buyerrecon_production`);
- the pre-proof writable gate is not established (`session_readonly_off` not
  `true`, i.e. session `transaction_read_only` not `off`);
- the proof transaction is not read-only (`proof_transaction_readonly_on` not
  `true`);
- `psql` stdout/stderr is not fully redirected to the raw temp file;
- raw `psql` output is printed to the terminal or written into the safe log;
- the residue check is not executed;
- the residue check detects forbidden material (`residue_check_pass=false` /
  `forbidden_pattern_count` > 0);
- the raw temp file cannot be removed (`raw_temp_removed=false`);
- any `psql` connection / auth / DNS error text would be emitted;
- the validator prints raw parse errors or raw URL components;
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
