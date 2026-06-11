# Sprint 3 — Secret-Safe psql Gate Diagnostic / Classifier — Plan (Review-Only)

**Status:** `STAGE0_PSQL_GATE_DIAGNOSTIC_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **narrow,
secret-safe `psql` gate diagnostic / classifier** to understand **why the pre-run
`psql` DB/role/writable gate query fails** even though the full
`STAGE0_RUNNER_DSN` is now **structurally valid** (PR #196) — the failure
observed in PR #197.

This PR **executes nothing**: no production command, no `psql`, no SQL, no
Stage 0, no run-lock touch, no `.env.production` / secret change, no DB
role/grant/schema/deploy change, no downstream runtime. The candidate commands
below are **CANDIDATE ONLY — DO NOT RUN**. No real DSN, password, host, port,
token, or raw value appears in this document.

> Provenance: PR #189 Stage 0 execution GO command pack
> (`a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0`); PR #191 DSN structural-check plan
> (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #196 DSN structural preflight
> PASS (`c3a0cc151d66cb20e41135e10acc3def23fe0808`); PR #197 gate-query-failed
> evidence (`40a8291c722ba7fb5dc7edef45aacd9c7158838f`,
> `STAGE0_EXECUTION_BLOCKED_GATE_QUERY_FAILED_AFTER_DSN_STRUCTURAL_PASS`).

---

## 1. Context

PR #197 showed:

```text
stage0_runner_dsn_structural_check_pass=true
gate_raw_output_printed=false
stage0_exec_gate_pass=false
stop_line=stage0_exec_gate_failed_raw_output_withheld
failed_gate_label=gate_query_execution
stage0_command_run=false
run_lock_touched=false
```

Meaning: the **DSN structure is valid**, **Stage 0 did not run**, **run-lock was
not touched**, and the failure is now localized to the **`psql` gate-query
execution / connection layer**. The **exact cause is unknown** (raw output
withheld). **Possible broad classes** include auth failure, connectivity failure,
SSL requirement / SSL-mode issue, `pg_hba` / access-rule issue, password
mismatch, `psql` behaviour / URI handling, or another connection-layer issue —
**no specific cause is claimed without evidence.**

This plan adds a **secret-safe classifier** that narrows the failure to a **broad
class** without exposing any secret or raw output.

---

## 2. Planning-Only Boundary

This PR does **not**: run production commands; run `psql`; run SQL; run Stage 0;
touch run-lock; modify `.env.production`; modify secrets; change DB
roles/grants/schema/deploy; or run extractor / risk / POI / evidence snapshot /
Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F runtime.

---

## 3. Diagnostic Boundary

The future diagnostic must run **before run-lock and before Stage 0**. It must
**not** run `npm run stage0:run`, the Stage 0 worker, or any
extractor/risk/POI/scoring/downstream runtime. It must **not** print: full DSN,
password, token, host, port, raw `psql` output, raw `psql` error text, raw
database/user values, raw IDs, rows, or payload/customer data.

---

## 4. Input Handling (reuse PR #193–#196 posture)

The diagnostic reuses the **server-side hidden assembly** posture proven in
PR #195/#196:
- host/port derived **in memory** from the approved custody source;
- password supplied through a **hidden** prompt;
- full `STAGE0_RUNNER_DSN` assembled **in memory only**; **never** printed;
- all variables **`unset` on every path**.

It must preserve the **PR #191 structural checks before any `psql` attempt**:
loaded; no whitespace; scheme ok; parseable; expected user
(`buyerrecon_stage0_runner`); not collector app; expected database
(`buyerrecon_production`). If the structural check fails, it stops there (the
PR #191 path), never reaching the classifier.

---

## 5. Candidate Two-Stage Classifier — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for **one** secret-safe diagnostic run. Raw `psql` output → chmod-600
> temp, **never printed**; emits only broad allowlisted labels; fails closed;
> runs **no** Stage 0 and **never** touches the run-lock.

### 5a. Stage A — connection probe (`SELECT 1`; broad classify only)
```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
umask 077
cd /opt/buyerrecon-backend || { echo "stop_line=wrong_repo_path"; exit 3; }

# Repo / merge gates (names + booleans only):
git merge-base --is-ancestor 40a8291c722ba7fb5dc7edef45aacd9c7158838f HEAD && echo "pr197_merge_present=true" || { echo "stop_line=pr197_merge_missing"; exit 3; }
git merge-base --is-ancestor c3a0cc151d66cb20e41135e10acc3def23fe0808 HEAD && echo "pr196_merge_present=true" || { echo "stop_line=pr196_merge_missing"; exit 3; }

# (Assemble STAGE0_RUNNER_DSN in memory via PR #193–#196 posture; run the PR #191
#  structural check first; never print the DSN. On structural failure, stop on the
#  PR #191 path. Only structurally-valid DSN reaches Stage A.)
echo "stage0_runner_dsn_structural_check_pass=true"

RAW="$(mktemp /tmp/stage0-psql-gate-classify.XXXXXX)"; chmod 600 "$RAW"
trap 'rm -f "$RAW"; unset STAGE0_RUNNER_DSN' EXIT INT TERM

echo "psql_gate_classifier_attempted=true"
if PGCONNECT_TIMEOUT=8 psql "$STAGE0_RUNNER_DSN" --no-psqlrc -v ON_ERROR_STOP=1 \
     -c 'SELECT 1' > "$RAW" 2>&1; then
  CONNA_OK=true
else
  CONNA_OK=false
fi
echo "psql_gate_classifier_raw_output_printed=false"   # RAW never cat/tee/printed

# Broad, allowlisted classification ONLY (no raw error text, host, user, db, DSN):
if [ "$CONNA_OK" != "true" ]; then
  # Count-only, allowlisted classification of broad failure class. Never print matches.
  if   grep -qiE 'password|authentication|role .* does not exist' "$RAW"; then CLASS=auth_or_connectivity
  elif grep -qiE 'ssl|pg_hba|no pg_hba|not permitted' "$RAW";              then CLASS=ssl_or_pg_hba_possible
  elif grep -qiE 'could not connect|timeout|connection refused|host'  "$RAW"; then CLASS=auth_or_connectivity
  else CLASS=connection_layer_unknown
  fi
  echo "psql_gate_classifier_pass=false"
  echo "psql_gate_failure_class=$CLASS"
  echo "stop_line=psql_gate_classifier_failed_raw_output_withheld"
  rm -f "$RAW"; unset STAGE0_RUNNER_DSN
  exit 5
fi
# Stage A succeeded -> proceed to Stage B.
```

> Classification reads only the chmod-600 RAW file with **count-only** greps and
> maps to a **broad allowlisted class** (`auth_or_connectivity`,
> `ssl_or_pg_hba_possible`, `connection_layer_unknown`). It **never** prints the
> matched lines or any raw component. If the class cannot be resolved
> unambiguously, the operator emits `psql_gate_failure_class=connection_layer_unknown`
> (or fails closed per §6).

### 5b. Stage B — gate booleans (only if Stage A succeeded)
```bash
# CANDIDATE ONLY — DO NOT RUN — run the existing gate booleans; emit booleans only.
RAW2="$(mktemp /tmp/stage0-psql-gateb.XXXXXX)"; chmod 600 "$RAW2"
trap 'rm -f "$RAW" "$RAW2"; unset STAGE0_RUNNER_DSN' EXIT INT TERM
PGCONNECT_TIMEOUT=8 psql "$STAGE0_RUNNER_DSN" --no-psqlrc -v ON_ERROR_STOP=1 > "$RAW2" 2>&1 <<'SQL'
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
BEGIN;
  SET LOCAL transaction_read_only = on;     -- gate query writes nothing
  SELECT 'gate_db_expected|'      || (current_database() = 'buyerrecon_production')::text;
  SELECT 'gate_user_expected|'    || (current_user = 'buyerrecon_stage0_runner')::text;
  SELECT 'gate_session_writable|' || (current_setting('default_transaction_read_only') = 'off')::text;
ROLLBACK;
SQL
G_DB="$(grep -E '^gate_db_expected\|'      "$RAW2" | tail -n1 | cut -d'|' -f2)"
G_USER="$(grep -E '^gate_user_expected\|'  "$RAW2" | tail -n1 | cut -d'|' -f2)"
G_WR="$(grep -E '^gate_session_writable\|' "$RAW2" | tail -n1 | cut -d'|' -f2)"
gateb_fail(){ echo "gate_db_expected=${G_DB:-<missing>}"; echo "gate_user_expected=${G_USER:-<missing>}"; echo "gate_session_writable=${G_WR:-<missing>}"; echo "psql_gate_classifier_pass=false"; echo "psql_gate_failure_class=gate_query_success_but_unexpected_labels"; echo "stop_line=psql_gate_classifier_failed_raw_output_withheld"; echo "failed_gate_label=$1"; rm -f "$RAW" "$RAW2"; unset STAGE0_RUNNER_DSN; exit 6; }
[ "$G_DB" = "true" ]   || gateb_fail gate_db_expected
[ "$G_USER" = "true" ] || gateb_fail gate_user_expected
[ "$G_WR" = "true" ]   || gateb_fail gate_session_writable
echo "gate_db_expected=true"; echo "gate_user_expected=true"; echo "gate_session_writable=true"
echo "psql_gate_classifier_pass=true"
echo "psql_gate_failure_class=gate_query_success"
rm -f "$RAW" "$RAW2"; unset STAGE0_RUNNER_DSN
exit 0
```

Stage B runs **only** the existing gate booleans (expected DB / expected user /
writable session), emits **only** those booleans, fails closed if any is
missing/ambiguous/false, and **never** prints raw DB/user values.

---

## 6. Classifier / Exit-Code Behaviour (fail closed)

- The classifier **exits non-zero** on any failure/blocked classification, and
  **exits zero only** on clean diagnostic success (Stage A connect ok **and**
  Stage B gate booleans all true). Failure paths emit safe stop-lines and
  **never** fall through to `exit 0`.
- Allowed broad labels (examples; exact set fixed at review):
  `psql_gate_classifier_raw_output_printed=false`,
  `psql_gate_classifier_attempted=true`,
  `psql_gate_classifier_pass=true|false`,
  `psql_gate_failure_class=auth_or_connectivity`,
  `psql_gate_failure_class=ssl_or_pg_hba_possible`,
  `psql_gate_failure_class=connection_layer_unknown`,
  `psql_gate_failure_class=gate_query_success_but_unexpected_labels`,
  `psql_gate_failure_class=gate_query_success`.
- If classification is **ambiguous**, fail closed with:
  `psql_gate_classifier_pass=false` /
  `stop_line=psql_gate_classifier_ambiguous_raw_output_withheld`.

---

## 7. Evidence Labels (for the future diagnostic evidence PR)

Booleans / labels only — **no real values**:

```text
on_production_host=true
repo_head=<public_sha>
pr197_merge_present=true
pr196_merge_present=true
approved_source_present=true
source_dsn_printed=false
stage0_dsn_printed=false
password_received=true
password_printed=false
host_component_present=true
port_component_present=true
stage0_runner_dsn_structural_check_pass=true
psql_gate_classifier_raw_output_printed=false
psql_gate_classifier_attempted=true
psql_gate_classifier_pass=true|false
psql_gate_failure_class=<allowlisted_class>
stage0_command_run=false
run_lock_touched=false
```

---

## 8. Integration With PR #189 (preflight, not a relaxation)

This diagnostic is a **preflight before** any future Stage 0 retry. A future
Stage 0 retry must still follow the **PR #189** boundaries:
- exact command-mapping gate;
- DSN structural check;
- DB/role/writable gate;
- run-lock only **after** gates pass;
- one execution only;
- runtime output captured to a chmod-600 temp;
- exact, fail-closed success parser;
- raw output withheld;
- docs-only evidence PR afterward.

The diagnostic does **not** weaken any PR #189/#191 gate and does **not**
authorize a retry; it only **classifies** the connection-layer failure safely.

---

## 9. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- wrong repo path (`wrong_repo_path`);
- missing PR #197 merge (`pr197_merge_missing`);
- missing PR #196 merge (`pr196_merge_missing`);
- missing approved source material;
- missing hidden password;
- the DSN would be printed;
- raw `psql` output would be printed;
- classifier ambiguous
  (`psql_gate_classifier_ambiguous_raw_output_withheld`);
- psql classifier failed
  (`psql_gate_classifier_failed_raw_output_withheld`);
- gate booleans missing / ambiguous / false (`failed_gate_label=<name>`);
- any attempt to touch run-lock;
- any attempt to run Stage 0;
- any downstream runtime would be bundled (extractor / risk / POI / evidence
  snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F).

If a stop-line is hit, remove temp files, `unset STAGE0_RUNNER_DSN`, and record
the blocked state in a docs-only evidence PR before any further action.

---

## 10. Non-Authorizations

This PR does **not** authorize:
- diagnostic execution; psql; SQL; Stage 0 execution/retry; run-lock touch;
- production command; secret / `.env.production` change; DB role / grant / schema
  / deploy change;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 11. Next Gated Step

1. Open this docs-only diagnostic plan PR.
2. **Codex narrow review** (before any merge or diagnostic GO).
3. **Merge if PASS.**
4. **Helen issues a separate explicit GO** for **one** secret-safe psql gate
   diagnostic run.
5. Operator runs only that bounded diagnostic on production; returns **safe
   labels only**; docs-only evidence PR.
6. The classified broad failure class informs the next fix (e.g. SSL-mode /
   `pg_hba` / credential correction) — itself separately planned and GO-gated.
7. **Only after a clean gate diagnostic + fix** should a **separate Stage 0
   execution GO** be considered (still under the full PR #189 flow).
8. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. The candidate
diagnostic assembles the DSN **in memory only** and **never** prints it; raw
`psql` stdout/stderr go to a chmod-600 temp and are **classified count-only into
broad labels**, never printed; the DSN is `unset` on every path. `<public_sha>`
is a placeholder for a public git commit hash. `buyerrecon_stage0_runner` /
`buyerrecon_production` are role / database names used for gate comparison. All
other values are safe labels / booleans / boundary language — not secret or row
values.
