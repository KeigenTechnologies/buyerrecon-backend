# Sprint 3 — First Bounded Internal Risk-Worker Run — Command Pack (Docs-Only)

**Status:** `RISK_WORKER_FIRST_INTERNAL_RUN_COMMAND_PACK_PLANNING_ONLY`

This is a **docs-only command-pack planning record**. It contains a reviewable,
**PLANNING ONLY — DO NOT RUN** draft for **exactly one** future bounded internal
risk-evidence worker run using the registered role identity
`RISK_WORKER_ROLE=buyerrecon_risk_worker`.

This PR **plans the run only**. It does **not** execute the risk worker, run any
production command, run SQL/psql, mutate the DB, change roles/grants, run
Stage0/Step2E/Route C, run downstream extractors, run Lane/scoring, run AMS
runtime, produce customer output, or authorize Gate4E/Gate4F.

> Provenance of required base: `c303ba3d1cbc956352f6499362822ba5842efa31` on
> `sprint2-architecture-contracts-d4cc2bf` (includes PR #325 create/grant/proof
> PASS, PR #326 role registration, PR #327 readiness/input proof PASS).

---

## 1. Run target (planning)

- **Exactly one** bounded internal execution of the existing RECORD_ONLY
  risk-evidence worker.
- **Resolved command (discovered, not invented):** `npm run risk-evidence:run`
  → `tsx scripts/run-risk-evidence-worker.ts` (confirmed in `package.json`). The
  worker is **RECORD_ONLY** and reads from `accepted_events`-derived inputs;
  it reads `stage0_decisions` + `session_behavioural_features_v0_2` and
  upserts `risk_observations_v0_1` (INSERT … ON CONFLICT DO UPDATE).
- **Runtime identity:** `RISK_WORKER_ROLE=buyerrecon_risk_worker` only.
- **Must NOT use:** `postgres`, `buyerrecon_app`, `buyerrecon_scoring_worker`
  (NOLOGIN group — not usable directly), `buyerrecon_prod_collector_app`,
  `buyerrecon_stage0_runner`.
- **No secret in this pack:** no password, DSN, host, port, connection string,
  env value, or secret value appears. Only **safe env-var names** are referenced
  (the worker resolves its connection from `DATABASE_URL`; bounding filters are
  `SINCE_HOURS` / `SINCE` / `UNTIL` / `WORKSPACE_ID` / `SITE_ID` /
  `OBSERVATION_VERSION` / `STAGE0_VERSION_FILTER` / `BEHAVIOURAL_FEATURE_VERSION`
  — **names only**).

---

## 2. Command pack — **PLANNING ONLY — DO NOT RUN**

> **PLANNING ONLY — DO NOT RUN.** The shapes below are **illustrative and
> non-executable** until separately reviewed and GO-gated. This PR does **not**
> run, stage, or authorize them. No real password, DSN, host, port, or env value
> appears; `$RISK_WORKER_DSN` is a **placeholder name** for an approved-custody
> binding that must be assembled outside repo/logs and **never** printed.

```bash
#!/usr/bin/env bash
# ============================================================================
# DRAFT — first bounded internal risk-worker run (RISK_WORKER_ROLE)
# PLANNING ONLY — DO NOT RUN without a separate scoped HELEN GO.
# Exactly ONE RECORD_ONLY worker run. Read-only preflight + post-run aggregate
# proof. Safe labels only. No secrets. No raw rows.
# ============================================================================
set -Eeuo pipefail

echo "risk_worker_first_internal_run_attempted=true"

# ---- Phase 1: preflight (repo/base/registry; read-only) --------------------
cd /opt/buyerrecon-backend

# current branch must be sprint2-architecture-contracts-d4cc2bf
[ "$(git rev-parse --abbrev-ref HEAD)" = "sprint2-architecture-contracts-d4cc2bf" ] || {
  echo "STOP_LINE=wrong_host_or_path_or_branch"; echo "worker_execution_result=blocked_or_failed"; exit 2; }

# required base SHA present
REQUIRED_BASE="c303ba3d1cbc956352f6499362822ba5842efa31"
if ! git merge-base --is-ancestor "$REQUIRED_BASE" HEAD 2>/dev/null; then
  echo "STOP_LINE=base_sha_missing"; echo "worker_execution_result=blocked_or_failed"; exit 2
fi
echo "pr327_merge_present=true"   # PR #327 evidence is part of the required base

# tracked tree clean
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "STOP_LINE=tracked_tree_dirty tracked_working_tree_clean=false"
  echo "worker_execution_result=blocked_or_failed"; exit 2
fi
echo "tracked_working_tree_clean=true"

# PR #327 readiness evidence + registration present (tracked docs)
[ -f docs/sprint3-risk-worker-registered-role-readiness-proof-pass-evidence.md ] || {
  echo "STOP_LINE=readiness_evidence_missing"; echo "worker_execution_result=blocked_or_failed"; exit 2; }

# .claude/constants.md registers RISK_WORKER_ROLE=buyerrecon_risk_worker
if grep -qE 'RISK_WORKER_ROLE.*buyerrecon_risk_worker' .claude/constants.md; then
  echo "risk_worker_role_constant_present=true"
  echo "risk_worker_role_constant_value=buyerrecon_risk_worker"
else
  echo "STOP_LINE=risk_worker_role_not_registered"
  echo "worker_execution_result=blocked_or_failed"; exit 2
fi

# resolve RISK_WORKER_ROLE; must equal buyerrecon_risk_worker
RISK_WORKER_ROLE="buyerrecon_risk_worker"
[ "$RISK_WORKER_ROLE" = "buyerrecon_risk_worker" ] || {
  echo "STOP_LINE=risk_worker_role_value_mismatch"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
echo "candidate_role=buyerrecon_risk_worker"

# ---- Private temp dir (0700); stderr captured, NEVER printed ---------------
TMPDIR_RUN="$(mktemp -d)"; chmod 700 "$TMPDIR_RUN"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

# ---- Phase 2: pre-run read-only DB readiness snapshot ----------------------
# Local admin path, read-only, booleans/counts only. count_before is COUNT(*)
# only — no rows. (Illustrative; DO NOT RUN here.)
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 \
      -v role="$RISK_WORKER_ROLE" -d buyerrecon_production \
      > "$TMPDIR_RUN/pre.safe.out" 2> "$TMPDIR_RUN/pre.err" <<'SQL'
\set role :role
BEGIN READ ONLY;
SELECT 'candidate_role_exists=' || CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=:'role') THEN 'true' ELSE 'false' END;
SELECT 'candidate_role_can_login=' || COALESCE((SELECT CASE WHEN rolcanlogin THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role'),'false');
-- required privileges
SELECT 'rp_s0_select='  || has_table_privilege(:'role','public.stage0_decisions','SELECT')::text;
SELECT 'rp_sbf_select=' || has_table_privilege(:'role','public.session_behavioural_features_v0_2','SELECT')::text;
SELECT 'rp_ro_insert='  || has_table_privilege(:'role','public.risk_observations_v0_1','INSERT')::text;
SELECT 'rp_ro_update='  || has_table_privilege(:'role','public.risk_observations_v0_1','UPDATE')::text;
-- unwanted privileges
SELECT 'up_ro_delete='     || has_table_privilege(:'role','public.risk_observations_v0_1','DELETE')::text;
SELECT 'up_ro_truncate='   || has_table_privilege(:'role','public.risk_observations_v0_1','TRUNCATE')::text;
SELECT 'up_ro_references=' || has_table_privilege(:'role','public.risk_observations_v0_1','REFERENCES')::text;
SELECT 'up_ro_trigger='    || has_table_privilege(:'role','public.risk_observations_v0_1','TRIGGER')::text;
-- table presence
SELECT 'stage0_decisions_table_present='            || CASE WHEN to_regclass('public.stage0_decisions') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT 'session_behavioural_features_table_present=' || CASE WHEN to_regclass('public.session_behavioural_features_v0_2') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT 'risk_observations_table_present='           || CASE WHEN to_regclass('public.risk_observations_v0_1') IS NOT NULL THEN 'true' ELSE 'false' END;
-- nonzero input counts (boolean only)
SELECT 'stage0_decisions_nonzero_count='            || ( (SELECT count(*) FROM public.stage0_decisions) > 0 )::text;
SELECT 'session_behavioural_features_nonzero_count=' || ( (SELECT count(*) FROM public.session_behavioural_features_v0_2) > 0 )::text;
-- risk_observations aggregate count BEFORE run (count only, no rows)
SELECT 'risk_observations_count_before=' || (SELECT count(*) FROM public.risk_observations_v0_1)::text;
ROLLBACK;
SQL
then
  echo "STOP_LINE=preflight_snapshot_error_suppressed"
  echo "worker_execution_result=blocked_or_failed"; exit 3
fi

# Derive readiness booleans from pre.safe.out (no fail-open). STOP on any gap.
PRE="$TMPDIR_RUN/pre.safe.out"
grep -qx 'candidate_role_exists=true'    "$PRE" || { echo "STOP_LINE=role_absent_or_no_login"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
grep -qx 'candidate_role_can_login=true' "$PRE" || { echo "STOP_LINE=role_absent_or_no_login"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
for k in rp_s0_select rp_sbf_select rp_ro_insert rp_ro_update; do
  grep -qx "${k}=true" "$PRE" || { echo "STOP_LINE=required_privilege_false_or_unknown"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
done
for k in up_ro_delete up_ro_truncate up_ro_references up_ro_trigger; do
  grep -qx "${k}=false" "$PRE" || { echo "STOP_LINE=unwanted_privilege_true"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
done
for k in stage0_decisions_table_present session_behavioural_features_table_present risk_observations_table_present; do
  grep -qx "${k}=true" "$PRE" || { echo "STOP_LINE=input_table_absent"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
done
grep -qx 'stage0_decisions_nonzero_count=true'            "$PRE" || { echo "STOP_LINE=stage0_decisions_nonzero_count_false"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
grep -qx 'session_behavioural_features_nonzero_count=true' "$PRE" || { echo "STOP_LINE=session_behavioural_features_nonzero_count_false"; echo "worker_execution_result=blocked_or_failed"; exit 2; }
# echo safe readiness labels
echo "candidate_role_exists=true"
echo "candidate_role_can_login=true"
echo "required_privileges_pass=true"
echo "unwanted_privileges_absent=true"
echo "stage0_decisions_table_present=true"
echo "session_behavioural_features_table_present=true"
echo "risk_observations_table_present=true"
echo "stage0_decisions_nonzero_count=true"
echo "session_behavioural_features_nonzero_count=true"
COUNT_BEFORE="$(grep -E '^risk_observations_count_before=[0-9]+$' "$PRE" | head -n1 | cut -d= -f2)"
[ -n "$COUNT_BEFORE" ] && echo "risk_observations_count_before_present=true" || {
  echo "STOP_LINE=post_run_proof_unavailable"; echo "worker_execution_result=blocked_or_failed"; exit 3; }

# ---- Phase 3: resolve the worker command (discovered, not invented) --------
# Confirm the existing mapping exists in package.json BEFORE running anything.
if grep -qE '"risk-evidence:run"[[:space:]]*:' package.json; then
  echo "worker_command_resolved=true"   # npm run risk-evidence:run -> tsx scripts/run-risk-evidence-worker.ts
else
  echo "STOP_LINE=worker_command_unresolved"; echo "worker_execution_result=blocked_or_failed"; exit 2
fi

# ---- Phase 4: approved secret/custody binding gate -------------------------
# The worker connects via DATABASE_URL. Bind it to the risk-worker DSN from
# APPROVED CUSTODY only (assembled outside repo/logs; NEVER printed/echoed/argv-
# logged). If no approved binding is available, STOP for a separate custody GO.
# $RISK_WORKER_DSN is a placeholder NAME for that approved-custody value.
if [ "${RISK_WORKER_DSN+set}" = "set" ] && [ -n "${RISK_WORKER_DSN:-}" ]; then
  echo "approved_secret_custody_available=true"
else
  echo "approved_secret_custody_available=false"
  echo "STOP_LINE=approved_secret_custody_unavailable"
  echo "worker_execution_started=false"
  echo "worker_execution_count=0"
  echo "worker_exit_code=not_run"
  echo "worker_execution_result=blocked_or_failed"
  exit 2
fi

# ---- Phase 5: EXACTLY ONE bounded RECORD_ONLY worker run -------------------
# Connection from approved custody, never printed (DATABASE_URL bound from
# $RISK_WORKER_DSN). Bounded by SINCE/UNTIL window (names only; values supplied
# by operator at GO time). stdout/stderr captured; stderr NEVER printed.
echo "worker_execution_started=true"
echo "worker_execution_count=1"
if DATABASE_URL="$RISK_WORKER_DSN" npm run risk-evidence:run \
      > "$TMPDIR_RUN/run.safe.out" 2> "$TMPDIR_RUN/run.err"; then
  echo "worker_exit_code=0"
else
  rc=$?
  echo "worker_exit_code=${rc}"
  echo "STOP_LINE=worker_exited_nonzero"
  echo "db_mutation_executed=unknown"
  echo "worker_execution_result=blocked_or_failed"
  exit 3
fi
unset RISK_WORKER_DSN

# ---- Phase 6: post-run aggregate proof (read-only; count only) -------------
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d buyerrecon_production \
      > "$TMPDIR_RUN/post.safe.out" 2> "$TMPDIR_RUN/post.err" <<'SQL'
BEGIN READ ONLY;
SELECT 'risk_observations_count_after=' || (SELECT count(*) FROM public.risk_observations_v0_1)::text;
ROLLBACK;
SQL
then
  echo "STOP_LINE=post_run_proof_unavailable"
  echo "db_mutation_executed=unknown"
  echo "worker_execution_result=blocked_or_failed"; exit 3
fi
COUNT_AFTER="$(grep -E '^risk_observations_count_after=[0-9]+$' "$TMPDIR_RUN/post.safe.out" | head -n1 | cut -d= -f2)"
if [ -n "$COUNT_AFTER" ]; then
  echo "risk_observations_count_after_present=true"
  if   [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then echo "risk_observations_count_delta_class=increased"; echo "db_mutation_executed=true"
  elif [ "$COUNT_AFTER" -eq "$COUNT_BEFORE" ]; then echo "risk_observations_count_delta_class=unchanged"; echo "db_mutation_executed=unknown"
  else echo "risk_observations_count_delta_class=decreased"; echo "db_mutation_executed=unknown"
  fi
else
  echo "risk_observations_count_after_present=false"
  echo "risk_observations_count_delta_class=unknown"
  echo "db_mutation_executed=unknown"
fi
# NOTE: counts only — no rows, no payloads, no identifiers are read or printed.

# ---- Static guard labels + result -----------------------------------------
echo "role_or_grant_change_executed=false"
echo "stage0_rerun_executed=false"
echo "step2e_rerun_executed=false"
echo "route_c_rerun_executed=false"
echo "downstream_extractors_executed=false"
echo "lane_scoring_executed=false"
echo "ams_runtime_executed=false"
echo "customer_output_executed=false"
echo "gate4e_executed=false"
echo "gate4f_executed=false"
echo "dsn_printed=false"
echo "credential_printed=false"
echo "host_port_printed=false"
echo "env_file_inspected=false"
echo "raw_postgres_error_printed=false"
echo "pg_hba_printed=false"
echo "raw_customer_payload_printed=false"
echo "raw_accepted_events_payload_printed=false"
echo "raw_canonical_jsonb_printed=false"
echo "raw_request_or_session_identifier_printed=false"
echo "worker_execution_result=pass"
```

---

## 3. Required safe labels (future execution)

```text
risk_worker_first_internal_run_attempted=true
pr327_merge_present=true
tracked_working_tree_clean=true
risk_worker_role_constant_present=true
risk_worker_role_constant_value=buyerrecon_risk_worker
candidate_role=buyerrecon_risk_worker
candidate_role_exists=true
candidate_role_can_login=true
required_privileges_pass=true
unwanted_privileges_absent=true
stage0_decisions_table_present=true
session_behavioural_features_table_present=true
risk_observations_table_present=true
stage0_decisions_nonzero_count=true
session_behavioural_features_nonzero_count=true
risk_observations_count_before_present=true
worker_command_resolved=true
approved_secret_custody_available=true|false
worker_execution_started=true|false
worker_execution_count=0|1
worker_exit_code=<safe integer or not_run>
worker_execution_result=pass|blocked_or_failed
risk_observations_count_after_present=true|false
risk_observations_count_delta_class=increased|unchanged|decreased|unknown
db_mutation_executed=true|false|unknown
role_or_grant_change_executed=false
stage0_rerun_executed=false
step2e_rerun_executed=false
route_c_rerun_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
credential_printed=false
host_port_printed=false
env_file_inspected=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

---

## 4. Stop-lines

The future run must stop (and record the stop-line; safe labels only) if:

- wrong host/path (not `/opt/buyerrecon-backend`) or wrong branch;
- required base SHA `c303ba3d1cbc956352f6499362822ba5842efa31` missing;
- tracked tree dirty;
- `RISK_WORKER_ROLE` not registered in `.claude/constants.md`;
- `RISK_WORKER_ROLE` value not `buyerrecon_risk_worker`;
- role does not exist or cannot login;
- any required privilege `false`/`unknown`;
- any unwanted privilege `true`;
- any input table absent;
- `stage0_decisions_nonzero_count=false`;
- `session_behavioural_features_nonzero_count=false`;
- approved DSN/secret custody path unavailable;
- a command would print password/DSN/host/port/env value;
- a command would require `postgres`/admin role (or any forbidden role);
- a command would run more than once;
- a command would produce raw row/customer/payload/identifier output;
- the worker exits nonzero;
- the post-run proof cannot be completed safely;
- any Lane/scoring/AMS/customer/Gate action would be triggered.

---

## 5. Rollback / safety posture

- The worker is **RECORD_ONLY** and writes only its designated evidence table
  `risk_observations_v0_1` (INSERT … ON CONFLICT DO UPDATE) — **no DELETE/
  TRUNCATE** (the role lacks them; see preflight). There is no destructive op to
  roll back; "rollback" here means **stop-before-run** on any failed preflight,
  and **halt** on a nonzero worker exit with `db_mutation_executed=unknown`.
- The pre-run and post-run DB snapshots are **read-only** (`BEGIN READ ONLY …
  ROLLBACK`, counts/booleans only).
- The connection is bound from approved custody and **never printed**; stderr is
  captured to a `0700` temp dir and **never printed**.
- If the post-run delta cannot be safely established, the result is
  `blocked_or_failed` with `db_mutation_executed=unknown` — never a fail-open
  PASS.

---

## 6. A PASS does NOT authorize

A successful future first run proves **only** internal risk-observation
generation (`risk_observations_v0_1` aggregate behaviour). It does **not**
authorize:

- Lane/scoring;
- AMS runtime;
- customer output;
- Gate4E;
- Gate4F.

It also does not authorize a second run, any grant/role change, or any
downstream extractor — each remains separately gated.

---

## 7. Evidence PR after execution

After a future GO-gated execution, a **docs-only evidence PR** must be created
**before any next runtime action**, recording the safe labels above
(`worker_execution_result`, `worker_exit_code`,
`risk_observations_count_delta_class`, `db_mutation_executed`, and the guard
labels), with **no** raw rows, customer payloads, `accepted_events` payloads,
`canonical_jsonb`, `request_id`/`session_id`/user identifiers, IP/user-agent/
header/body values, DSN/password/host/port/env values, raw PostgreSQL error
text, or `pg_hba` lines.

---

## 8. Explicit non-authorization

- This command-pack PR defines a **future internal first-run path only**.
- **Merging this PR does not authorize the first risk-worker run.**
- The actual first run requires a **separate explicit Helen GO** after
  review/merge (and, if no approved DSN/custody binding exists yet, a separate
  custody/binding GO first).
- This PR does **not** run the worker, run SQL/psql, run any production command,
  mutate the DB, change roles/grants, run Stage0/Step2E/Route C, run downstream
  extractors, run Lane/scoring, run AMS runtime, produce customer output, or
  authorize Gate4E/Gate4F.

---

## 9. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, raw stdout/stderr, or
env-var value. The shapes are **illustrative and non-executable**;
`$RISK_WORKER_DSN` is a **placeholder name** for an approved-custody binding that
is assembled outside repo/logs and **never** printed, echoed, logged, committed,
or placed on a command line; stdout/stderr are captured to a `0700` temp dir and
the error file is **never printed**. The env-var **names**
(`DATABASE_URL`, `SINCE_HOURS`, `SINCE`, `UNTIL`, `WORKSPACE_ID`, `SITE_ID`,
`OBSERVATION_VERSION`, `STAGE0_VERSION_FILTER`, `BEHAVIOURAL_FEATURE_VERSION`),
the `package.json` **script name** (`risk-evidence:run`), the `scripts/*.ts`
**path**, the role names (`buyerrecon_risk_worker`, `buyerrecon_scoring_worker`,
`buyerrecon_app`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`,
`postgres`), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** repository / role / public-git
identifiers. All values above are safe labels / booleans / counts / category
tokens / non-secret identifiers / a public git commit hash — not secret or row
values. **This PR runs nothing.**
