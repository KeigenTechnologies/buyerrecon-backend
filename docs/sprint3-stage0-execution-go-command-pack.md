# Sprint 3 — Stage 0 Execution GO — Command Pack / GO-Preparation (Review-Only)

**Status:** `STAGE0_EXECUTION_GO_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only command-pack / GO-preparation record**. It
prepares **exactly one** future Stage 0 execution under the proven dedicated
role `buyerrecon_stage0_runner`.

This PR **executes nothing**: no Stage 0 run, no run-lock touch, no production
command, no SQL (beyond the read-only local source review already done), no
secret/`.env.production` change, no DB role/grant change, no downstream runtime.
The candidate commands below are **CANDIDATE ONLY — DO NOT RUN**. This PR does
**not** authorize Stage 0 — a **separate explicit Helen Stage 0 execution GO** is
required after this pack is reviewed and merged.

> Provenance: PR #188 dedicated-role create/grant/proof **PASS**
> (`57d8732fd248bae34a3b7a239953a445ae9617d6`,
> `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PASS`); execution-gate posture from
> PR #172 §9 (carried forward, identity updated to `buyerrecon_stage0_runner`);
> secret-safe DSN handling from PR #177 / #185.

---

## 0. Prior Command-Pack Check

- No **post-#188 dedicated-role** Stage 0 execution command pack exists yet.
- PR #172 §8 recorded execution conditions, but for the **now-superseded**
  `buyerrecon_app` identity (Option A); the execution identity is now the
  dedicated role `buyerrecon_stage0_runner` (PRs #179/#188). PR #172 §9 stop-line
  *posture* is carried forward here with the identity corrected.
- Therefore this PR **creates** the dedicated-role execution command pack rather
  than reusing a stale one.

---

## 1. Source-Grounded Command Identification (read-only review)

From the current repo (base `sprint2-architecture-contracts-d4cc2bf` @ PR #188):
- `package.json` → `"stage0:run": "tsx scripts/run-stage0-worker.ts"` — the exact
  Stage 0 command is **`npm run stage0:run`** (no other path; not guessed).
- `scripts/run-stage0-worker.ts` reads env: **`DATABASE_URL`** (required; **never
  printed** — masked to host/db via `maskUrl`), optional `WORKSPACE_ID`,
  `SITE_ID`, `SINCE_HOURS` (default 168), `SINCE`, `UNTIL`, `STAGE0_VERSION`
  (default `stage0-hard-exclusion-v0.2`).
- Worker writes **only** `stage0_decisions` (upsert) and reads
  `accepted_events` + `ingest_requests` — exactly the privileges proven for
  `buyerrecon_stage0_runner` in PR #188.
- **Native output is already masked**: a `PASS` summary with masked `database`
  (host/db only), `stage0_version`, `scoring_version`, `window`, and counts
  (`upserted_rows` / `excluded` / `non_excluded`). The runner header guarantees
  it **never prints raw UA / token / IP / payload / `canonical_jsonb`**.
- **No `RUN_LOCK` in code** — the "run lock" is an **operator-side one-execution
  guard** (a sentinel file the operator creates), not a runner feature; this pack
  defines it for one-execution-only semantics.

---

## 2. Production Host & Repo Sync

- Production host path: **`/opt/buyerrecon-backend`**.
- Required server repo sync to the **PR #188 merge commit**:
  **`57d8732fd248bae34a3b7a239953a445ae9617d6`** (HEAD must equal / contain it).

---

## 3. Execution Identity & Database Gate

Before the Stage 0 command, a **read-only** gate must prove:
- expected database: **`buyerrecon_production`**;
- expected role (`current_user`): **`buyerrecon_stage0_runner`**;
- session is **writable** (`transaction_read_only = off`) so the upsert can write
  `stage0_decisions` — while the gate query itself performs **no** write.

The DSN for `buyerrecon_stage0_runner` is supplied **secret-safe** (PR #177/#185
posture): provided into a temporary env var (e.g. `STAGE0_RUNNER_DSN`) via the
secure operator/admin mechanism, **never** printed, committed, logged, or written
to `.env.production`; `unset` after the run.

---

## 4. Candidate Command Pack — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a **separate explicit
> Helen Stage 0 execution GO**. One execution only. Emits safe labels; never
> prints the DSN or raw `psql` output.

### 4a. Gates + read-only identity/DB proof (no Stage 0 yet)
```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
umask 077
cd /opt/buyerrecon-backend || { echo "stop_line=wrong_repo_path"; exit 3; }
[ "$(pwd)" = "/opt/buyerrecon-backend" ] && echo "on_production_host=true" || { echo "stop_line=wrong_repo_path"; exit 3; }

# Branch/head + PR #188 presence:
echo "repo_head=$(git rev-parse HEAD)"
git merge-base --is-ancestor 57d8732fd248bae34a3b7a239953a445ae9617d6 HEAD \
  && echo "pr188_merge_present=true" || { echo "stop_line=pr188_merge_missing"; exit 3; }

# (A) FAIL-CLOSED source-command mapping check — BEFORE any DSN load / run-lock / Stage 0.
#     Exact parse of package.json (Node, not bare grep); require stage0:run == "tsx scripts/run-stage0-worker.ts".
if node -e 'const s=require("./package.json").scripts||{}; process.exit(s["stage0:run"]==="tsx scripts/run-stage0-worker.ts"?0:1)'; then
  echo "stage0_command_mapping_ok=true"
else
  echo "stage0_command_mapping_ok=false"
  echo "stop_line=stage0_command_mapping_mismatch"
  exit 3                                    # stop before DSN load / run-lock / Stage 0
fi

# One-execution guard (operator-side run lock). Stop if a prior Stage 0 already ran:
RUN_LOCK=/opt/buyerrecon-backend/.stage0_run.lock
[ -e "$RUN_LOCK" ] && { echo "stop_line=run_lock_already_touched"; exit 4; } || echo "run_lock_clear=true"

# DSN supplied secret-safe (NOT .env.production; never printed):
[ -n "${STAGE0_RUNNER_DSN:-}" ] && echo "dsn_loaded_without_printing=true" || { echo "stop_line=dsn_missing"; exit 2; }

# Read-only identity/DB gate -> raw to chmod-600 temp; emit only allowlisted booleans:
RAW="$(mktemp /tmp/stage0-exec-gate.XXXXXX)"; chmod 600 "$RAW"
trap 'rm -f "$RAW"; unset STAGE0_RUNNER_DSN' EXIT INT TERM
PGCONNECT_TIMEOUT=8 psql "$STAGE0_RUNNER_DSN" --no-psqlrc -v ON_ERROR_STOP=1 > "$RAW" 2>&1 <<'SQL'
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
BEGIN;
  SET LOCAL transaction_read_only = on;     -- gate query writes nothing
  SELECT 'gate_db_expected|'   || (current_database() = 'buyerrecon_production')::text;
  SELECT 'gate_user_expected|' || (current_user = 'buyerrecon_stage0_runner')::text;
  SELECT 'gate_session_writable|' || (current_setting('default_transaction_read_only') = 'off')::text;
ROLLBACK;
SQL
echo "gate_raw_output_printed=false"

# (B) Parse allowlisted booleans; EMIT each individually; fail closed on missing/ambiguous/false.
GATE_DB="$(grep -E '^gate_db_expected\|'       "$RAW" | tail -n1 | cut -d'|' -f2)"
GATE_USER="$(grep -E '^gate_user_expected\|'   "$RAW" | tail -n1 | cut -d'|' -f2)"
GATE_WRITABLE="$(grep -E '^gate_session_writable\|' "$RAW" | tail -n1 | cut -d'|' -f2)"

gate_fail() {                               # name only; never the raw value/line
  echo "gate_db_expected=${GATE_DB:-<missing>}"
  echo "gate_user_expected=${GATE_USER:-<missing>}"
  echo "gate_session_writable=${GATE_WRITABLE:-<missing>}"
  echo "stage0_exec_gate_pass=false"
  echo "stop_line=stage0_exec_gate_failed"
  echo "failed_gate_label=$1"
  rm -f "$RAW"; unset STAGE0_RUNNER_DSN
  exit 5
}
[ "$GATE_DB" = "true" ]       || gate_fail gate_db_expected
[ "$GATE_USER" = "true" ]     || gate_fail gate_user_expected
[ "$GATE_WRITABLE" = "true" ] || gate_fail gate_session_writable

# All gates passed -> emit each individual safe boolean (true):
echo "gate_db_expected=true"
echo "gate_user_expected=true"
echo "gate_session_writable=true"
echo "stage0_exec_gate_pass=true"
```

### 4b. The one reviewed Stage 0 command (only after 4a passes AND a separate GO)
```bash
# CANDIDATE ONLY — DO NOT RUN — exactly ONE execution, only after §4a gate pass + separate Helen GO.
echo "stage0_exec_start=true"

# Runtime output -> chmod-600 temp ONLY; npm/tsx stdout+stderr are NEVER printed directly
# (raw stderr on failure could carry connection details).
RUNOUT="$(mktemp /tmp/stage0-run-out.XXXXXX)"; chmod 600 "$RUNOUT"
trap 'rm -f "$RAW" "$RUNOUT"; unset STAGE0_RUNNER_DSN' EXIT INT TERM

touch "$RUN_LOCK"; echo "run_lock_touched=true"      # one-execution guard set immediately before the run

DATABASE_URL="$STAGE0_RUNNER_DSN" npm run stage0:run > "$RUNOUT" 2>&1   # exact reviewed command; output captured, not printed
STAGE0_RC=$?
unset STAGE0_RUNNER_DSN
echo "stage0_command_run=true"

if [ "$STAGE0_RC" -ne 0 ]; then
  # FAILURE: emit safe failure labels only; raw runtime output withheld.
  echo "stage0_command_exit_code=$STAGE0_RC"
  echo "stage0_command_failed=true"
  echo "raw_runtime_output_printed=false"
  echo "stop_line=stage0_command_failed_raw_output_withheld"
  rm -f "$RUNOUT"
  exit 6
fi

# SUCCESS: EXACT, FAIL-CLOSED parse of ONLY the allowlisted masked PASS fields.
# Runner labels (from scripts/run-stage0-worker.ts): "stage0 worker — PASS",
#   stage0_version:, scoring_version:, upserted_rows:, excluded:, non_excluded:.
# Anchored '^[[:space:]]*' patterns ensure 'excluded:' does NOT match 'non_excluded:'.

parse_fail() {                               # field name only; raw output NEVER printed
  echo "stage0_result_parse_ok=false"
  echo "raw_runtime_output_printed=false"
  echo "stop_line=stage0_result_parse_failed_raw_output_withheld"
  echo "failed_parse_field=$1"
  rm -f "$RAW" "$RUNOUT"; unset STAGE0_RUNNER_DSN
  exit 7
}
val_after() { grep -E "$1" "$RUNOUT" | sed -E "s/$1[[:space:]]*//"; }   # value after an anchored label

# Each field must match EXACTLY ONE anchored line, be non-empty, and well-formed.
[ "$(grep -cE 'stage0 worker — PASS' "$RUNOUT")" -eq 1 ] || parse_fail pass_marker

[ "$(grep -cE '^[[:space:]]*stage0_version:'  "$RUNOUT")" -eq 1 ] || parse_fail stage0_version
[ "$(grep -cE '^[[:space:]]*scoring_version:' "$RUNOUT")" -eq 1 ] || parse_fail scoring_version
[ "$(grep -cE '^[[:space:]]*upserted_rows:'   "$RUNOUT")" -eq 1 ] || parse_fail upserted_rows
[ "$(grep -cE '^[[:space:]]*excluded:'        "$RUNOUT")" -eq 1 ] || parse_fail excluded_rows
[ "$(grep -cE '^[[:space:]]*non_excluded:'    "$RUNOUT")" -eq 1 ] || parse_fail non_excluded_rows

S0_VERSION="$(val_after '^[[:space:]]*stage0_version:')"
SC_VERSION="$(val_after '^[[:space:]]*scoring_version:')"
UPSERTED="$(val_after '^[[:space:]]*upserted_rows:')"
EXCLUDED="$(val_after '^[[:space:]]*excluded:')"
NONEXCL="$(val_after '^[[:space:]]*non_excluded:')"

# Versions: non-empty + safe-char allowlist; counts: non-empty + numeric.
printf '%s' "$S0_VERSION" | grep -qE '^[A-Za-z0-9._:-]+$' || parse_fail stage0_version
printf '%s' "$SC_VERSION" | grep -qE '^[A-Za-z0-9._:-]+$' || parse_fail scoring_version
printf '%s' "$UPSERTED"   | grep -qE '^[0-9]+$'           || parse_fail upserted_rows
printf '%s' "$EXCLUDED"   | grep -qE '^[0-9]+$'           || parse_fail excluded_rows
printf '%s' "$NONEXCL"    | grep -qE '^[0-9]+$'           || parse_fail non_excluded_rows

# All fields exist, unambiguous (exactly one line each), non-empty, well-formed -> success.
echo "stage0_command_exit_code=0"
echo "stage0_result_parse_ok=true"
echo "raw_runtime_output_printed=false"
echo "stage0_pass=true"
echo "stage0_version=$S0_VERSION"
echo "scoring_version=$SC_VERSION"
echo "upserted_rows=$UPSERTED"
echo "excluded_rows=$EXCLUDED"
echo "non_excluded_rows=$NONEXCL"
echo "stage0_command_run=true"
echo "run_lock_touched=true"
rm -f "$RUNOUT"
echo "stage0_exec_done=true"
```

The command is run **once**. Runtime stdout/stderr go **only** to the chmod-600
`RUNOUT` temp (never printed); on success only the allowlisted masked PASS fields
are emitted, on non-zero exit only safe failure labels, and if the expected safe
fields cannot be parsed it fails closed (`stage0_result_parse_failed_raw_output_withheld`).
The `RUN_LOCK` sentinel prevents a second run (§4a aborts on
`run_lock_already_touched`); temp files are removed on exit.

---

## 5. Safe Labels (emit before & after)

**Before (gate):** `on_production_host`, `repo_head`, `pr188_merge_present`,
`stage0_command_mapping_ok`, `run_lock_clear`, `dsn_loaded_without_printing`,
`gate_raw_output_printed=false`, the **individual** gate booleans
`gate_db_expected` / `gate_user_expected` / `gate_session_writable`, and
`stage0_exec_gate_pass`.

**After (run):** `run_lock_touched`, `stage0_command_run`,
`stage0_command_exit_code`, `raw_runtime_output_printed=false`,
`stage0_result_parse_ok`, `stage0_pass`, and the **masked** summary fields
(`stage0_version`, `scoring_version`, `upserted_rows`, `excluded_rows`,
`non_excluded_rows`), `stage0_exec_done`. (On failure: `stage0_command_failed`
and the relevant `stop_line` only.)

**Never** emit: DSN, password, token, raw hostname/IP, raw `session_id` /
`request_id`, `canonical_jsonb`, raw rows, payload, or customer data.

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; do not run / do not continue) if any of:
- wrong repo path (`wrong_repo_path`);
- wrong branch / head, or PR #188 merge missing (`pr188_merge_missing`);
- DSN missing (`dsn_missing`);
- a password / DSN / token would be printed or stored;
- expected DB mismatch (`expected_db_mismatch` — not `buyerrecon_production`);
- expected role mismatch (`expected_role_mismatch` — not
  `buyerrecon_stage0_runner`);
- transaction / read-write posture mismatch (`readwrite_posture_mismatch` —
  session not writable for the upsert);
- the exact Stage 0 command cannot be identified, or the `package.json`
  `stage0:run` mapping is not exactly `tsx scripts/run-stage0-worker.ts`
  (`stage0_command_mapping_mismatch` — fail closed **before** DSN load / run-lock
  / Stage 0);
- any pre-run gate label is missing / ambiguous / false
  (`stage0_exec_gate_failed` with `failed_gate_label=<…>`);
- the command would run more than once;
- the run lock is already touched / unexpected prior Stage 0 state
  (`run_lock_already_touched`);
- Stage 0 runtime stdout/stderr is not fully captured to the chmod-600 temp, or
  raw runtime output would be printed;
- the Stage 0 command exits non-zero
  (`stage0_command_failed_raw_output_withheld`);
- the expected safe PASS-summary fields cannot be parsed from the captured output
  (`stage0_result_parse_failed_raw_output_withheld`);
- any downstream runtime would be bundled (extractor / risk / POI / evidence
  snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F);
- any raw IDs / raw rows / payload / customer data would be printed;
- any result is ambiguous (record blocked, do not re-run without a fresh GO).

If a stop-line is hit, remove temp files, `unset STAGE0_RUNNER_DSN`, and record
the blocked state in a docs-only evidence PR before any further action.

---

## 7. One-Execution-Only Semantics

- The `RUN_LOCK` sentinel (`/opt/buyerrecon-backend/.stage0_run.lock`) is checked
  **before** the run (abort if present) and created **immediately before** the
  single `npm run stage0:run`.
- A second invocation aborts at §4a with `run_lock_already_touched`.
- This GO authorizes **exactly one** Stage 0 execution; any further run requires a
  **new** explicit GO.

---

## 8. Stage 0 Evidence PR Requirements

After the one execution (whatever the outcome), a **docs-only Stage 0 execution
evidence PR** must record:
- the before/after safe labels (§5), `stage0_exit_code`, and the **masked**
  PASS summary fields only;
- `run_lock_touched=true`, one-execution confirmation;
- PASS (exit 0 + masked summary) **or** BLOCKED/failed (non-zero / ambiguous);
- explicit confirmation: no DSN/password/token/raw rows/payload/customer data
  printed; no downstream runtime bundled.

---

## 9. Non-Authorizations

This PR does **not** authorize:
- Stage 0 execution; run-lock touch;
- production command; SQL execution; DSN/secret/`.env.production` change;
- DB role/grant change;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 10. Next Gated Step

1. Open this docs-only command-pack PR.
2. **Codex narrow review.**
3. **Merge if PASS.**
4. **Helen issues a separate explicit Stage 0 execution GO.**
5. Operator runs **exactly one** Stage 0 execution on production per §4 (gate →
   one `npm run stage0:run` under `buyerrecon_stage0_runner`; secret-safe DSN;
   safe labels only).
6. **Docs-only Stage 0 execution evidence PR** (§8).
7. Any further Stage 0 run requires a **new** explicit GO.

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The Stage 0 DSN is loaded
secret-safe into `STAGE0_RUNNER_DSN` and never printed/committed; raw `psql` gate
output goes to a chmod-600 temp and is parsed for allowlisted booleans only. All
values shown are **safe labels / booleans / public git commit hashes / role /
database / relation names / the masked `DATABASE_URL="$STAGE0_RUNNER_DSN" npm run
stage0:run` command** — not secret or row values.
