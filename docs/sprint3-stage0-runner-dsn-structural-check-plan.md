# Sprint 3 — `STAGE0_RUNNER_DSN` Safer Handoff + Structural Check — Plan / Command Pack (Review-Only)

**Status:** `STAGE0_RUNNER_DSN_STRUCTURAL_CHECK_PLANNING_ONLY`

This is a **reviewable, docs-only planning / command-pack record**. It prepares a
**bounded, secret-safe preflight** for the hidden `STAGE0_RUNNER_DSN` — to
distinguish **empty / malformed / wrong-user / wrong-database / paste-artifact**
DSN issues **before** reaching the PR #189 role/database gate — after the first
Stage 0 execution attempt failed at the gate query (PR #190).

This PR **executes nothing**: no Stage 0 rerun, no run-lock touch, no production
command, no SQL, no DB mutation, no secret / `.env.production` change, no role /
grant change, no downstream runtime. The candidate commands below are **CANDIDATE
ONLY — DO NOT RUN**. No real DSN, password, token, hostname, IP, raw ID, row
value, or customer data appears in this record.

> Provenance: PR #188 dedicated role proof PASS
> (`57d8732fd248bae34a3b7a239953a445ae9617d6`); PR #189 Stage 0 execution GO
> command pack (`a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0`); PR #190 pre-run
> gate-query-failed evidence (`5d8c667fdee9b5bf2e40fce6f652273e5f8d5287`,
> `STAGE0_EXECUTION_BLOCKED_PRE_RUN_GATE_QUERY_FAILED`).

---

## 1. Context / Carry-Forward

The first Stage 0 execution GO attempt after PR #189 stopped **before** run-lock
and **before** Stage 0 with (PR #190 safe labels):

```text
stage0_runner_dsn_loaded=true
stage0_runner_dsn_printed=false
gate_raw_output_printed=false
stage0_exec_gate_pass=false
stop_line=stage0_exec_gate_failed_raw_output_withheld
failed_gate_label=gate_query_execution
```

Cause is **unknown** (raw `psql` output intentionally withheld); a possible DSN
handoff / input / format / auth / connectivity issue is **not proven**. This pack
adds a **pre-`psql` structural check** so the most common, classifiable DSN-input
problems are caught **safely and early**, before the existing gate.

---

## 2. Purpose & Bounded Scope

- **Purpose:** a secret-safe `STAGE0_RUNNER_DSN` preflight that emits only safe
  booleans, distinguishing structural DSN problems before the PR #189 gate.
- **Bounded scope:** structural string checks (no value printed) + an **optional**
  connection classifier that suppresses raw output and emits only broad
  category labels.
- It is a **preflight before** the PR #189 retry — **not** a Stage 0 run, and it
  **does not** touch run-lock or relax any PR #189 boundary.

---

## 3. Structural DSN Checks (before any `psql`) — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO. Checks only **structural** properties of the hidden DSN; the value is
> **never** printed; emits safe booleans only; fails closed before any `psql`,
> run-lock, or Stage 0.

```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
umask 077
cd /opt/buyerrecon-backend || { echo "stop_line=wrong_repo_path"; exit 3; }

# Repo / merge gates (names+booleans only):
git merge-base --is-ancestor 5d8c667fdee9b5bf2e40fce6f652273e5f8d5287 HEAD && echo "pr190_merge_present=true" || { echo "stop_line=pr190_merge_missing"; exit 3; }
git merge-base --is-ancestor a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0 HEAD && echo "pr189_merge_present=true" || { echo "stop_line=pr189_merge_missing"; exit 3; }

# Read DSN hidden; never echoed:
read -r -s STAGE0_RUNNER_DSN; echo
echo "stage0_runner_dsn_printed=false"
[ -n "${STAGE0_RUNNER_DSN:-}" ] && echo "stage0_runner_dsn_loaded=true" \
  || { echo "stage0_runner_dsn_loaded=false"; echo "stage0_runner_dsn_structural_check_pass=false"; echo "stop_line=stage0_runner_dsn_structural_check_failed"; echo "failed_dsn_check=dsn_missing"; exit 2; }

# Structural validation in a Node heredoc. The hidden DSN is passed via a ONE-SHOT
# env assignment on the same command so the child process actually receives it
# (a bare shell var is NOT exported). Prints BOOLEANS ONLY; never prints the DSN
# or any component (host/user/password/db/query/URL/error text).
STAGE0_RUNNER_DSN="$STAGE0_RUNNER_DSN" node - <<'NODE'
'use strict';
const raw = process.env.STAGE0_RUNNER_DSN || '';
function out(k,v){ console.log(k + '=' + v); }
function fail(label){ out('stage0_runner_dsn_structural_check_pass','false'); console.log('stop_line=stage0_runner_dsn_structural_check_failed'); console.log('failed_dsn_check='+label); process.exit(9); }
if (raw.length === 0) fail('dsn_missing');
if (/\s/.test(raw)) fail('whitespace_or_paste_artifact');              // newline/space/paste artifact
if (!/^postgres(ql)?:\/\//.test(raw)) fail('bad_scheme');
let u; try { u = new URL(raw); } catch { fail('dsn_unparseable'); }    // never print raw parse error
out('stage0_runner_dsn_parseable','true');
if (!(u.protocol === 'postgres:' || u.protocol === 'postgresql:')) fail('bad_protocol');
const userExpected = (u.username === 'buyerrecon_stage0_runner');      // compare only; never print username
const notCollector = (u.username !== 'buyerrecon_prod_collector_app'); // must NOT be the collector identity
const db = (u.pathname || '').replace(/^\//,'');
const dbExpected = (db === 'buyerrecon_production');                   // compare only; never print db name
out('stage0_runner_dsn_scheme_ok','true');
out('stage0_runner_dsn_user_expected', String(userExpected));
out('stage0_runner_dsn_not_collector_app', String(notCollector));
out('stage0_runner_dsn_db_expected', String(dbExpected));
out('stage0_runner_dsn_no_whitespace','true');
if (!userExpected)  fail('user_not_stage0_runner');
if (!notCollector)  fail('collector_app_dsn_suspected');
if (!dbExpected)    fail('db_not_buyerrecon_production');
out('stage0_runner_dsn_structural_check_pass','true');
NODE
STRUCT_RC=$?

# (The pack also asserts the DSN is not the .env.production value without reading that file's
#  secret: compare only a structural fingerprint, never print either value. If it cannot be
#  asserted safely, fail closed: failed_dsn_check=dotenv_production_dsn_suspected.)

unset STAGE0_RUNNER_DSN                       # DSN unset after the preflight (always)
[ "$STRUCT_RC" -eq 0 ] || exit "$STRUCT_RC"   # fail closed before psql / run-lock / Stage 0
echo "stage0_runner_dsn_structural_preflight_done=true"
```

**Safe booleans emitted** (examples): `stage0_runner_dsn_loaded=true`,
`stage0_runner_dsn_printed=false`, `stage0_runner_dsn_parseable=true`,
`stage0_runner_dsn_scheme_ok=true`, `stage0_runner_dsn_user_expected=true`,
`stage0_runner_dsn_not_collector_app=true`, `stage0_runner_dsn_db_expected=true`,
`stage0_runner_dsn_no_whitespace=true`,
`stage0_runner_dsn_structural_check_pass=true`. On failure: only
`stage0_runner_dsn_structural_check_pass=false`,
`stop_line=stage0_runner_dsn_structural_check_failed`,
`failed_dsn_check=<label>` (e.g. `dsn_missing`, `whitespace_or_paste_artifact`,
`bad_scheme`, `dsn_unparseable`, `bad_protocol`, `user_not_stage0_runner`,
`collector_app_dsn_suspected`, `db_not_buyerrecon_production`).

The DSN value, host, username, password, database name, query string, URL, and
any parse-error text are **never** printed. The DSN is **unset** after the
preflight on every path.

---

## 4. Optional Connection-Classifier Preflight — CANDIDATE ONLY — DO NOT RUN

> Optional and only if the reviewed plan includes a connection attempt. It must
> still **suppress raw output** and emit only **broad classified** labels — no
> host/user/db/password/DSN/error text.

```bash
# CANDIDATE ONLY — DO NOT RUN — self-contained broad connectivity/auth classification; raw output withheld.
# Run ONLY after §3 structural check passed. This block reads its own hidden DSN and fails closed.
set -o pipefail
umask 077
RAW="$(mktemp /tmp/stage0-dsn-classify.XXXXXX)"; chmod 600 "$RAW"
trap 'rm -f "$RAW"; unset STAGE0_RUNNER_DSN' EXIT INT TERM

# Read hidden DSN again (self-contained); never echoed; require non-empty; fail closed if missing:
read -r -s STAGE0_RUNNER_DSN; echo
echo "stage0_runner_dsn_printed=false"
if [ -n "${STAGE0_RUNNER_DSN:-}" ]; then
  echo "stage0_runner_dsn_loaded=true"
else
  echo "stage0_runner_dsn_loaded=false"
  echo "stop_line=stage0_runner_dsn_missing"
  rm -f "$RAW"; unset STAGE0_RUNNER_DSN       # unset on every path (even when empty)
  exit 2
fi

# psql with stdout+stderr -> RAW (chmod 600); raw output NEVER printed:
if PGCONNECT_TIMEOUT=8 psql "$STAGE0_RUNNER_DSN" --no-psqlrc -v ON_ERROR_STOP=1 \
     -c 'SELECT 1' > "$RAW" 2>&1; then
  echo "stage0_runner_dsn_connectivity_check_pass=true"
  echo "stage0_runner_dsn_raw_output_printed=false"
  rm -f "$RAW"; unset STAGE0_RUNNER_DSN
  exit 0                                      # success path returns 0
else
  # Broad category only — never parse/print the raw error text, host, user, db, or DSN.
  echo "stage0_runner_dsn_connectivity_check_pass=false"
  echo "stage0_runner_dsn_auth_or_connectivity_failed=true"
  echo "stage0_runner_dsn_raw_output_printed=false"
  echo "stop_line=stage0_runner_dsn_connectivity_check_failed_raw_output_withheld"
  rm -f "$RAW"; unset STAGE0_RUNNER_DSN
  exit 4                                      # FAIL CLOSED: classifier failure exits non-zero
fi
```

- Allowed labels: `stage0_runner_dsn_connectivity_check_pass=true|false`,
  `stage0_runner_dsn_auth_or_connectivity_failed=true`,
  `stage0_runner_dsn_raw_output_printed=false`.
- If classification cannot be made safely (e.g. raw output cannot be confined),
  fail closed with
  `stop_line=stage0_runner_dsn_connectivity_check_failed_raw_output_withheld`.
- This classifier intentionally **cannot** distinguish fine-grained causes; it
  only narrows to "structural-ok but connect/auth failed" vs "connect ok",
  without exposing any secret/raw detail.

---

## 5. Integration With PR #189 (preflight, not a relaxation)

This structural check is a **preflight before** retrying the PR #189 Stage 0
execution command pack. A future retry must still **preserve all PR #189
boundaries**:
- exact command-mapping gate (`stage0_command_mapping_ok`);
- DB / role / writable gate
  (`gate_db_expected` / `gate_user_expected` / `gate_session_writable`);
- run-lock touched **only after** gates pass;
- **one execution only**;
- runtime stdout/stderr captured to a chmod-600 temp;
- exact, fail-closed success parser;
- raw output withheld;
- docs-only Stage 0 execution evidence PR afterward.

This pack adds an **earlier** safety stage; it does **not** remove or weaken any
PR #189 gate, and it does **not** authorize a retry.

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- wrong repo path (`wrong_repo_path`);
- missing PR #190 merge (`pr190_merge_missing`);
- missing PR #189 merge (`pr189_merge_missing`);
- DSN missing (`failed_dsn_check=dsn_missing`);
- the DSN would be printed (never emit the value — abort the printing path);
- malformed DSN (`bad_scheme` / `bad_protocol` / `dsn_unparseable`);
- wrong role/user indicator (`user_not_stage0_runner`);
- collector-app DSN suspected (`collector_app_dsn_suspected`);
- whitespace / newline / paste artifact suspected
  (`whitespace_or_paste_artifact`);
- `.env.production` DSN suspected (`dotenv_production_dsn_suspected`);
- wrong database (`db_not_buyerrecon_production`);
- raw `psql` output would be printed;
- ambiguous classification
  (`stage0_runner_dsn_connectivity_check_failed_raw_output_withheld`);
- any attempt to touch run-lock;
- any attempt to run Stage 0;
- any downstream runtime would be bundled (extractor / risk / POI / evidence
  snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F).

If a stop-line is hit, remove temp files, `unset STAGE0_RUNNER_DSN`, and record
the blocked state in a docs-only evidence PR before any further action.

---

## 7. Non-Authorizations

This PR does **not** authorize:
- Stage 0 execution or rerun; run-lock touch;
- production command; SQL; DB mutation;
- secret / `.env.production` change; DB role / grant change;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 8. Next Gated Step

1. Open this docs-only plan / command-pack PR.
2. **Codex narrow review** (before any merge or retry).
3. **Merge if PASS.**
4. **Helen issues a separate explicit GO** for **one** secret-safe
   `STAGE0_RUNNER_DSN` structural-check (and optional classifier) preflight.
5. Operator runs only that bounded preflight on production; returns **safe
   booleans only**; docs-only evidence PR.
6. **Only if the DSN preflight is clean** does a retry of the **PR #189** Stage 0
   execution flow proceed — and that retry still needs its **own separate
   explicit Stage 0 execution GO** and its own docs-only evidence PR.
7. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The candidate preflight
reads the DSN hidden, compares structural properties only, emits **booleans /
labels only**, never prints the DSN or any component or raw `psql` output, and
`unset`s the DSN on every path. `postgres://` / `postgresql://` appear only as
structural scheme tokens; `buyerrecon_stage0_runner` /
`buyerrecon_prod_collector_app` / `buyerrecon_production` are role / database
names used for structural comparison — not values. All other values are safe
labels / public git commit hashes / boundary language.
