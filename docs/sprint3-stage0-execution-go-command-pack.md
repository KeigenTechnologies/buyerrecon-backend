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
grep -n '"stage0:run"' package.json   # expect: tsx scripts/run-stage0-worker.ts

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
GATE_DB="$(grep -E '^gate_db_expected\|' "$RAW" | tail -n1 | cut -d'|' -f2)"
GATE_USER="$(grep -E '^gate_user_expected\|' "$RAW" | tail -n1 | cut -d'|' -f2)"
GATE_WRITABLE="$(grep -E '^gate_session_writable\|' "$RAW" | tail -n1 | cut -d'|' -f2)"
[ "$GATE_DB" = "true" ]       || { echo "stop_line=expected_db_mismatch"; exit 5; }
[ "$GATE_USER" = "true" ]     || { echo "stop_line=expected_role_mismatch"; exit 5; }
[ "$GATE_WRITABLE" = "true" ] || { echo "stop_line=readwrite_posture_mismatch"; exit 5; }
echo "stage0_exec_gate_pass=true"
```

### 4b. The one reviewed Stage 0 command (only after 4a passes AND a separate GO)
```bash
# CANDIDATE ONLY — DO NOT RUN — exactly ONE execution, only after §4a gate pass + separate Helen GO.
echo "stage0_exec_start=true"
touch "$RUN_LOCK"; echo "run_lock_touched=true"      # one-execution guard set immediately before the run

DATABASE_URL="$STAGE0_RUNNER_DSN" npm run stage0:run  # exact reviewed command (package.json stage0:run)
STAGE0_RC=$?

unset STAGE0_RUNNER_DSN
if [ "$STAGE0_RC" -eq 0 ]; then
  echo "stage0_command_run=true"
  echo "stage0_exit_code=0"
  # Native PASS summary is already masked (host/db only + counts; no raw UA/token/IP/payload/jsonb).
  # Capture ONLY the masked summary fields for evidence: database(masked), stage0_version,
  # scoring_version, window, upserted_rows, excluded, non_excluded.
else
  echo "stage0_command_run=true"
  echo "stage0_exit_code=$STAGE0_RC"
  echo "stop_line=stage0_command_failed"               # withhold raw error if it could carry connection details
fi
echo "stage0_exec_done=true"
```

The command is run **once**. The `RUN_LOCK` sentinel prevents a second run (§4a
aborts on `run_lock_already_touched`).

---

## 5. Safe Labels (emit before & after)

**Before (gate):** `on_production_host`, `repo_head`, `pr188_merge_present`,
`run_lock_clear`, `dsn_loaded_without_printing`, `gate_db_expected`,
`gate_user_expected`, `gate_session_writable`, `gate_raw_output_printed=false`,
`stage0_exec_gate_pass`.

**After (run):** `run_lock_touched`, `stage0_command_run`, `stage0_exit_code`,
and the **masked** summary fields (`database` host/db only, `stage0_version`,
`scoring_version`, `window`, `upserted_rows`, `excluded`, `non_excluded`),
`stage0_exec_done`.

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
- the exact Stage 0 command cannot be identified from `package.json` /
  `scripts/run-stage0-worker.ts`;
- the command would run more than once;
- the run lock is already touched / unexpected prior Stage 0 state
  (`run_lock_already_touched`);
- any downstream runtime would be bundled (extractor / risk / POI / evidence
  snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F);
- any raw IDs / raw rows / payload / customer data would be printed;
- any result is ambiguous (`stage0_command_failed` or unparseable summary →
  record blocked, do not re-run without a fresh GO).

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
