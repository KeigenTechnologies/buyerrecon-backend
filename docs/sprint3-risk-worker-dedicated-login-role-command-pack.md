# Sprint 3 — Dedicated Minimal Risk-Worker LOGIN Role — Create / Grant / Proof Command Pack (Docs-Only)

**Status:** `RISK_WORKER_DEDICATED_LOGIN_ROLE_COMMAND_PACK_PLANNING_ONLY`

This is a **docs-only command-pack planning record**. It contains a reviewable,
**PLANNING ONLY — DO NOT RUN** draft of a future, separately GO-gated sequence to
(1) create the dedicated LOGIN role `buyerrecon_risk_worker` with a hidden
password, (2) apply only the four minimal **direct** table grants the
risk-evidence worker needs, and (3) prove the result with safe labels only.

This PR **executes nothing**: it does **not** create the role, set/rotate a
password, apply a grant, mutate the DB, run SQL/psql, run the PR #321 diagnostic,
run the PR #320 proof, run the risk worker, run Stage0/Step2E/Route C, run
Lane/scoring, run AMS runtime, produce customer output, or authorize Gate4E /
Gate4F.

> Provenance of current base: PR #323 merge
> `39637d285040b005565532c31eff5a9ba81e11a2` on
> `sprint2-architecture-contracts-d4cc2bf` (status
> `RISK_WORKER_DEDICATED_LOGIN_ROLE_PLANNING_ONLY`).

---

## 1. Future role target (planning)

- **Role name:** `buyerrecon_risk_worker` (candidate identifier; official only if
  a later reviewed change registers it — see §8).
- **Role type:** `LOGIN`, **non-superuser**.
- **Must NOT have:** `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`.
- **Must NOT own** application tables.
- **Must NOT be:** `postgres`, `buyerrecon_scoring_worker`, `buyerrecon_app`,
  `buyerrecon_prod_collector_app`, or `buyerrecon_stage0_runner`.

**Default grant model (Option B — direct minimal grants):** the four privileges
in §5 only; **no** `buyerrecon_scoring_worker` membership unless the group's exact
non-overbroad alignment is separately proven (per PR #323 §5).

The risk-evidence worker's contract (`src/scoring/risk-evidence/worker.ts`):
reads `stage0_decisions` + `session_behavioural_features_v0_2`; writes
`risk_observations_v0_1` (INSERT … ON CONFLICT DO UPDATE).

---

## 2. Command pack — **PLANNING ONLY — DO NOT RUN**

> **PLANNING ONLY — DO NOT RUN.** The shapes below are **illustrative and
> non-executable** until separately reviewed and GO-gated. This PR does **not**
> run, stage, or authorize them. No real password, DSN, host, port, or env value
> appears. **The pack deliberately contains no password literal and no password
> shell variable**: the role is created **without** a password, and the password
> is set **only** via the interactive psql `\password` meta-command (operator
> types it at the prompt). A password must **never** be rendered into SQL text,
> printed, echoed, stored in a shell variable, written to repo/logs, passed via
> argv, or passed via env.

```bash
#!/usr/bin/env bash
# ============================================================================
# DRAFT — create + grant + prove dedicated minimal risk-worker LOGIN role
# PLANNING ONLY — DO NOT RUN without a separate scoped HELEN GO.
# Local PostgreSQL admin path. Creates ONE role + 4 direct grants only.
# Emits safe labels only. No password printed. No DSN. No raw rows.
# ============================================================================
set -Eeuo pipefail

echo "risk_worker_role_create_attempted=true"

# ---- Phase 1: repo/base preflight -----------------------------------------
cd /opt/buyerrecon-backend

PR323_MERGE="39637d285040b005565532c31eff5a9ba81e11a2"
if ! git merge-base --is-ancestor "$PR323_MERGE" HEAD 2>/dev/null; then
  echo "STOP_LINE=pr323_merge_not_present pr323_merge_present=false"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 2
fi
echo "pr323_merge_present=true"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "STOP_LINE=dirty_tracked_tree tracked_working_tree_clean=false"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 2
fi
echo "tracked_working_tree_clean=true"
echo "candidate_role=buyerrecon_risk_worker"

# ---- Password handling: NONE in this script -------------------------------
# This pack sets NO password. There is intentionally no password shell variable,
# no hidden-prompt-into-variable, and no password literal in any SQL text. The
# password is set later by the operator via the interactive psql \password
# meta-command (Phase A, manual step) — never by this automation.

# ---- Private temp dir (0700); stderr captured, NEVER printed ---------------
TMPDIR_PROOF="$(mktemp -d)"; chmod 700 "$TMPDIR_PROOF"
trap 'rm -rf "$TMPDIR_PROOF"' EXIT

# ---- Phase 3: preflight existing role state (read-only) --------------------
# If the role already exists, prove its attributes BEFORE any change. Stop if it
# exists with unexpected attributes / is overprivileged / cannot be safely reused.
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d buyerrecon_production \
      > "$TMPDIR_PROOF/pre.safe.out" 2> "$TMPDIR_PROOF/pre.err" <<'SQL'
BEGIN READ ONLY;
SELECT 'pre_role_exists=' ||
       CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname='buyerrecon_risk_worker') THEN 'true' ELSE 'false' END;
SELECT 'pre_role_superuser=' || COALESCE((SELECT CASE WHEN rolsuper THEN 'true' ELSE 'false' END
         FROM pg_roles WHERE rolname='buyerrecon_risk_worker'),'na');
SELECT 'pre_role_canlogin=' || COALESCE((SELECT CASE WHEN rolcanlogin THEN 'true' ELSE 'false' END
         FROM pg_roles WHERE rolname='buyerrecon_risk_worker'),'na');
ROLLBACK;
SQL
then
  echo "STOP_LINE=preflight_error_suppressed"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 3
fi
cat "$TMPDIR_PROOF/pre.safe.out"
# Operator/gate must STOP here if pre_role_exists=true with unexpected attributes
# (e.g. pre_role_superuser=true) — do not proceed to create/alter an unexpected role.

# ---- Phase A: create role WITHOUT any password literal ---------------------
# NO PASSWORD clause. The SQL text contains no password and no password variable.
# CREATE ROLE defaults to NOBYPASSRLS, so NOBYPASSRLS is stated explicitly for
# clarity rather than via a later ALTER. ON_ERROR_STOP aborts; stderr withheld.
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d buyerrecon_production \
      > "$TMPDIR_PROOF/createA.safe.out" 2> "$TMPDIR_PROOF/createA.err" <<'SQL'
CREATE ROLE buyerrecon_risk_worker
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;
SQL
then
  echo "candidate_role_created=false"
  echo "STOP_LINE=role_create_error_suppressed"
  echo "db_mutation_executed=unknown"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 3
fi
echo "candidate_role_created=true"

# ---- Phase A (manual, interactive): set the password via \password ---------
# OPERATOR-MANUAL STEP — NOT automated, NO password in SQL text, NO variable.
# The operator opens an interactive admin psql session and runs the \password
# meta-command; psql prompts for the password (hidden), hashes it client-side,
# and transmits only the SCRAM-hashed verifier (never the cleartext) in the
# role-alter it issues. The cleartext is never placed in SQL text by the
# operator. The operator types the password at the prompt only; it must NOT be
# pasted into shell text, argv, env, or logs.
#
#   sudo -u postgres psql -X -d buyerrecon_production
#   -- then, inside the interactive psql session:
#   \password buyerrecon_risk_worker
#   -- (psql prompts: "Enter new password:" / "Enter it again:")
#   \q
#
# If the interactive \password path is unavailable or not acceptable, STOP and
# escalate to a separately reviewed password-custody plan. Do NOT fall back to
# any mechanism that renders the raw password into SQL text, argv, env, a shell
# variable, repo, or logs.

# ---- Phase B: direct minimal grants (exactly four; no DELETE/TRUNCATE/etc.) -
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d buyerrecon_production \
      > "$TMPDIR_PROOF/grantB.safe.out" 2> "$TMPDIR_PROOF/grantB.err" <<'SQL'
GRANT SELECT ON TABLE public.stage0_decisions                 TO buyerrecon_risk_worker;
GRANT SELECT ON TABLE public.session_behavioural_features_v0_2 TO buyerrecon_risk_worker;
GRANT INSERT ON TABLE public.risk_observations_v0_1            TO buyerrecon_risk_worker;
GRANT UPDATE ON TABLE public.risk_observations_v0_1            TO buyerrecon_risk_worker;
SQL
then
  echo "STOP_LINE=grant_error_suppressed"
  echo "db_mutation_executed=true"
  echo "grants_or_role_changes_executed=dedicated_risk_worker_only"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 3
fi

# ---- Phase C: proof (read-only; booleans only) -----------------------------
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d buyerrecon_production \
      > "$TMPDIR_PROOF/proof.safe.out" 2> "$TMPDIR_PROOF/proof.err" <<'SQL'
\set role 'buyerrecon_risk_worker'
BEGIN READ ONLY;

SELECT 'candidate_role_exists_after=' ||
       CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=:'role') THEN 'true' ELSE 'false' END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=:'role') THEN 'true' ELSE 'false' END AS rp \gset

\if :rp
  SELECT 'candidate_role_can_login_after='  || CASE WHEN rolcanlogin   THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'candidate_role_superuser_after='  || CASE WHEN rolsuper      THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'candidate_role_createdb_after='   || CASE WHEN rolcreatedb   THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'candidate_role_createrole_after=' || CASE WHEN rolcreaterole THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'candidate_role_replication_after='|| CASE WHEN rolreplication THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'candidate_role_bypassrls_after='  || CASE WHEN rolbypassrls  THEN 'true' ELSE 'false' END FROM pg_roles WHERE rolname=:'role';
  SELECT 'risk_worker_stage0_decisions_select_privilege_after='            || has_table_privilege(:'role','public.stage0_decisions','SELECT')::text;
  SELECT 'risk_worker_session_behavioural_features_select_privilege_after=' || has_table_privilege(:'role','public.session_behavioural_features_v0_2','SELECT')::text;
  SELECT 'risk_worker_risk_observations_insert_privilege_after='           || has_table_privilege(:'role','public.risk_observations_v0_1','INSERT')::text;
  SELECT 'risk_worker_risk_observations_update_privilege_after='           || has_table_privilege(:'role','public.risk_observations_v0_1','UPDATE')::text;
  SELECT 'risk_worker_unwanted_delete_privilege_after='     || has_table_privilege(:'role','public.risk_observations_v0_1','DELETE')::text;
  SELECT 'risk_worker_unwanted_truncate_privilege_after='   || has_table_privilege(:'role','public.risk_observations_v0_1','TRUNCATE')::text;
  SELECT 'risk_worker_unwanted_references_privilege_after=' || has_table_privilege(:'role','public.risk_observations_v0_1','REFERENCES')::text;
  SELECT 'risk_worker_unwanted_trigger_privilege_after='    || has_table_privilege(:'role','public.risk_observations_v0_1','TRIGGER')::text;
\else
  SELECT 'candidate_role_can_login_after=unknown';
  SELECT 'candidate_role_superuser_after=unknown';
  SELECT 'candidate_role_createdb_after=unknown';
  SELECT 'candidate_role_createrole_after=unknown';
  SELECT 'candidate_role_replication_after=unknown';
  SELECT 'candidate_role_bypassrls_after=unknown';
  SELECT 'risk_worker_stage0_decisions_select_privilege_after=unknown';
  SELECT 'risk_worker_session_behavioural_features_select_privilege_after=unknown';
  SELECT 'risk_worker_risk_observations_insert_privilege_after=unknown';
  SELECT 'risk_worker_risk_observations_update_privilege_after=unknown';
  SELECT 'risk_worker_unwanted_delete_privilege_after=unknown';
  SELECT 'risk_worker_unwanted_truncate_privilege_after=unknown';
  SELECT 'risk_worker_unwanted_references_privilege_after=unknown';
  SELECT 'risk_worker_unwanted_trigger_privilege_after=unknown';
\endif

ROLLBACK;
SQL
then
  echo "STOP_LINE=proof_error_suppressed"
  echo "db_mutation_executed=true"
  echo "grants_or_role_changes_executed=dedicated_risk_worker_only"
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"; exit 3
fi
cat "$TMPDIR_PROOF/proof.safe.out"

# ---- Static mutation/guard labels -----------------------------------------
echo "db_mutation_executed=true"
echo "grants_or_role_changes_executed=dedicated_risk_worker_only"
echo "worker_executed=false"
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

# ---- Phase C (cont.): readiness gate (re-derive PASS from proof.safe.out) --
# psql exit 0 is NOT sufficient. PASS only if all required conditions hold.
SAFE="$TMPDIR_PROOF/proof.safe.out"
need_true()  { grep -qx "$1=true"  "$SAFE" || { echo "dedicated_risk_worker_role_blocked_reason=missing_or_false_${1}"; return 1; }; }
need_false() { grep -qx "$1=false" "$SAFE" || { echo "dedicated_risk_worker_role_blocked_reason=unwanted_or_unknown_${1}"; return 1; }; }

READY=true
need_true  candidate_role_exists_after                                       || READY=false
need_true  candidate_role_can_login_after                                    || READY=false
need_false candidate_role_superuser_after                                    || READY=false
need_false candidate_role_createdb_after                                     || READY=false
need_false candidate_role_createrole_after                                   || READY=false
need_false candidate_role_replication_after                                  || READY=false
need_false candidate_role_bypassrls_after                                    || READY=false
need_true  risk_worker_stage0_decisions_select_privilege_after               || READY=false
need_true  risk_worker_session_behavioural_features_select_privilege_after   || READY=false
need_true  risk_worker_risk_observations_insert_privilege_after              || READY=false
need_true  risk_worker_risk_observations_update_privilege_after              || READY=false
need_false risk_worker_unwanted_delete_privilege_after                       || READY=false
need_false risk_worker_unwanted_truncate_privilege_after                     || READY=false
need_false risk_worker_unwanted_references_privilege_after                   || READY=false
need_false risk_worker_unwanted_trigger_privilege_after                      || READY=false

if [ "$READY" = true ]; then
  echo "dedicated_risk_worker_role_proof_result=pass"
else
  echo "dedicated_risk_worker_role_proof_result=blocked_or_failed"
fi
```

---

## 3. Expected PASS labels

```text
risk_worker_role_create_attempted=true
pr323_merge_present=true
tracked_working_tree_clean=true
candidate_role=buyerrecon_risk_worker
candidate_role_created=true
candidate_role_exists_after=true
candidate_role_can_login_after=true
candidate_role_superuser_after=false
candidate_role_createdb_after=false
candidate_role_createrole_after=false
candidate_role_replication_after=false
candidate_role_bypassrls_after=false
risk_worker_stage0_decisions_select_privilege_after=true
risk_worker_session_behavioural_features_select_privilege_after=true
risk_worker_risk_observations_insert_privilege_after=true
risk_worker_risk_observations_update_privilege_after=true
risk_worker_unwanted_delete_privilege_after=false
risk_worker_unwanted_truncate_privilege_after=false
risk_worker_unwanted_references_privilege_after=false
risk_worker_unwanted_trigger_privilege_after=false
db_mutation_executed=true
grants_or_role_changes_executed=dedicated_risk_worker_only
worker_executed=false
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
dedicated_risk_worker_role_proof_result=pass
```

---

## 4. Blocking labels / readiness gate

PASS is **not** emitted on `psql` exit 0 alone — the §2 readiness gate re-derives
the result from `proof.safe.out`. Any of the following → `blocked_or_failed`:

```text
STOP_LINE=pr323_merge_not_present
STOP_LINE=dirty_tracked_tree
STOP_LINE=preflight_error_suppressed
STOP_LINE=role_create_error_suppressed
STOP_LINE=grant_error_suppressed
STOP_LINE=proof_error_suppressed
STOP_LINE=interactive_password_path_unavailable
STOP_LINE=raw_password_would_be_needed_by_automation

candidate_role_exists_after=false|unknown
candidate_role_can_login_after=false|unknown
candidate_role_superuser_after=true|unknown
candidate_role_createdb_after=true|unknown
candidate_role_createrole_after=true|unknown
candidate_role_replication_after=true|unknown
candidate_role_bypassrls_after=true|unknown
risk_worker_stage0_decisions_select_privilege_after=false|unknown
risk_worker_session_behavioural_features_select_privilege_after=false|unknown
risk_worker_risk_observations_insert_privilege_after=false|unknown
risk_worker_risk_observations_update_privilege_after=false|unknown
risk_worker_unwanted_delete_privilege_after=true|unknown
risk_worker_unwanted_truncate_privilege_after=true|unknown
risk_worker_unwanted_references_privilege_after=true|unknown
risk_worker_unwanted_trigger_privilege_after=true|unknown
```

Each failure also emits a key-only `dedicated_risk_worker_role_blocked_reason=…`
label (no values).

---

## 5. Default future grants (exact four) and exclusions

```text
GRANT SELECT ON TABLE public.stage0_decisions                 TO buyerrecon_risk_worker;
GRANT SELECT ON TABLE public.session_behavioural_features_v0_2 TO buyerrecon_risk_worker;
GRANT INSERT ON TABLE public.risk_observations_v0_1            TO buyerrecon_risk_worker;
GRANT UPDATE ON TABLE public.risk_observations_v0_1            TO buyerrecon_risk_worker;
```

**Excluded (must NOT be granted):** DELETE, TRUNCATE, REFERENCES, TRIGGER,
ownership, SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, broad
schema grants, broad table grants, customer-output permissions, Lane/scoring
runtime permissions beyond this risk worker, Gate4E/Gate4F authorization.

---

## 6. Sequence / identity caveat

- **Do not grant sequence privileges by default.**
- If `risk_observations_v0_1` uses a serial/identity column whose `INSERT`
  requires sequence `USAGE`, that is a **single, narrowly-scoped** item to
  **prove first** (read-only) and grant only if proven necessary — never a broad
  sequence grant, never `ALL ON ALL SEQUENCES`.
- This command-pack adds **no** sequence grant. If the proof shows INSERT fails
  for want of sequence USAGE, that is its own separate narrowly-planned + GO-gated
  step.

---

## 7. Stop-lines

The future command-pack (and this plan) must stop if:

- PR #323 merge not present; dirty tracked tree;
- the role already exists with **unexpected attributes** (e.g. superuser /
  overprivileged) or cannot be safely reused;
- role creation fails; any proof query fails;
- any required privilege is `false`/`unknown`;
- any disallowed privilege is `true`;
- the role is superuser or has `CREATEDB`/`CREATEROLE`/`REPLICATION`/`BYPASSRLS`;
- a password **would be rendered into SQL text**;
- a password **would be stored in a shell variable, argv, env, repo, logs, or
  output**;
- the **interactive password-setting path (`\password`) is unavailable** or not
  acceptable;
- a **raw password would be needed by automation** (i.e. any non-interactive
  password mechanism);
- a password would otherwise be printed or logged;
- a DSN/env/host/port value would be needed;
- a raw PostgreSQL error would be printed; `pg_hba` would be printed;
- any raw row/payload/identifier would be needed;
- any worker execution is implied;
- any customer-output / Gate4E / Gate4F / Lane / scoring authorization is implied.

On any stop-line: halt and record it (safe labels only); do not proceed.

---

## 8. Constants / runtime-registry planning

If the role is created and proven, a **later separate** reviewed PR **may** update:

- `.claude/constants.md` (register `buyerrecon_risk_worker` as a non-secret role
  identifier);
- the production runtime registry docs
  (`docs/ops/buyerrecon-production-environment-runtime-registry.md`);
- any DSN custody / runtime-binding docs (structure / custody only).

**This command-pack PR must not update those files** unless explicitly requested,
and must include **no real DSN values** — only placeholders / structure. Any DSN
binding for the new role is assembled in approved custody outside repo/logs and
never printed.

---

## 9. Evidence PR after future execution

After a successful future GO-gated execution, a short **docs-only evidence PR**
should record:

- the creation / grant / proof labels (booleans / category tokens only);
- `worker_executed=false`; no customer output; no Gate4E/Gate4F;
- `grants_or_role_changes_executed=dedicated_risk_worker_only`;
- no secrets / raw values (no password, DSN, host, port, env, raw PG error,
  `pg_hba`, payload, `canonical_jsonb`, or request/session/user identifier).

That evidence PR is its own separate docs-only change; it records an already-run,
GO-scoped action and authorizes nothing further. Supplying
`buyerrecon_risk_worker` as `RISK_WORKER_ROLE` to the PR #321 confirmation
diagnostic and then the PR #320 proof each remain separately GO-gated, and even a
PASS only makes the risk-evidence worker a candidate (it does not run the worker).

---

## 10. Explicit non-authorization

This PR is **docs-only** and authorizes **none** of the following:

- It does **not** create the role.
- It does **not** set or rotate a password.
- It does **not** apply grants.
- It does **not** mutate the DB.
- It does **not** run SQL or psql.
- It does **not** run the PR #321 confirmation diagnostic.
- It does **not** run the PR #320 input-readiness proof.
- It does **not** run the risk worker.
- It does **not** run Stage0 or Step2E.
- It does **not** run Lane/scoring.
- It does **not** run AMS runtime.
- It does **not** produce customer output.
- It does **not** authorize Gate4E or Gate4F.

**Running the future command-pack requires a separate scoped Helen GO.**

---

## 11. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, or env-var value. The SQL /
shell shapes are **illustrative and non-executable**.

**Password handling (raw-password avoidance).** This command-pack **intentionally
avoids raw password SQL interpolation**: it contains **no password literal and no
password shell variable**, and the `CREATE ROLE` shape has **no `PASSWORD`
clause**. Password setting must use the **interactive psql `\password`
meta-command** (which hashes the password client-side and never places the
cleartext in SQL text) **or another separately reviewed custody mechanism that
likewise does not render the raw password into SQL text**. If interactive
`\password` is unavailable or not acceptable, **execution must stop** and a
**separate password-custody plan must be reviewed**. The password must **never**
be printed, logged, stored, committed, passed in argv, passed in env, stored in a
shell variable, or embedded into SQL text. The role names (`buyerrecon_risk_worker`,
`buyerrecon_scoring_worker`, `buyerrecon_app`, `buyerrecon_prod_collector_app`,
`buyerrecon_stage0_runner`, `postgres`), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), the module
path, and the recorded commit hash are **non-secret** database / repository /
public-git identifiers. All values above are safe labels / booleans / category
tokens / non-secret identifiers / a public git commit hash — not secret or row
values. **This PR runs nothing.**
