# Sprint 3 — Risk-Evidence Worker LOGIN Role Confirmation — Command Pack (Docs-Only)

**Status:** `RISK_WORKER_LOGIN_ROLE_CONFIRMATION_COMMAND_PACK_PLANNING_ONLY`

This is a **docs-only command-pack planning record**. It contains a reviewable,
**DO NOT RUN** draft of a read-only, local-admin catalog diagnostic that
confirms the actual **LOGIN** role which will execute the risk-evidence worker,
**before** `RISK_WORKER_ROLE=<confirmed role>` is supplied to the PR #320
post-Stage0 input-readiness proof.

This PR **executes nothing**: no production command, no SQL, no psql, no Step2E
rerun, no Stage0 rerun, no Route C, no worker / downstream extractor, no
Lane/scoring, no AMS runtime, no customer output, no Gate4E, no Gate4F, no
GRANT/DML/DDL, no role change. It **records a draft command pack only**.

> Provenance of current base: PR #320 merge
> `383ea40fd508cab0ecdeccdb21c47b493ca7b753` on
> `sprint2-architecture-contracts-d4cc2bf`.

---

## 1. Why this diagnostic exists

PR #320's proof requires `RISK_WORKER_ROLE=<confirmed role>`, but that role is
**unconfirmed**:

- The risk worker (`scripts/run-risk-evidence-worker.ts`, logic in
  `src/scoring/risk-evidence/worker.ts`) resolves its connection **only** from
  `DATABASE_URL`; no role name is embedded in source. `package.json` maps
  `risk-evidence:run` → the script and adds no role/DSN env name.
- `buyerrecon_scoring_worker` is documented as a **NOLOGIN group role** (granted
  *to* a login role), so it **cannot** be used directly as `RISK_WORKER_ROLE`.
- `.claude/constants.md` registers no risk/scoring worker **login** role; the
  production runtime registry documents an execution identity only for Stage 0
  (`buyerrecon_stage0_runner`).

The actual `RISK_WORKER_ROLE` must be a **LOGIN** role that either (a) is a
member of `buyerrecon_scoring_worker` and inherits the required privileges, or
(b) directly holds the required four privileges. This diagnostic confirms a
candidate login role read-only, **without inspecting, printing, or parsing any
DSN** — the role name is an operator-supplied non-secret identifier, not derived
from a connection string.

The worker's read/write contract (confirmed from source) defines the required
privileges:
- **reads (SELECT):** `stage0_decisions`, `session_behavioural_features_v0_2`;
- **writes (INSERT + UPDATE):** `risk_observations_v0_1`.

---

## 2. Command pack — **DO NOT RUN**

> **PLANNING ONLY. DO NOT RUN.** This block is illustrative and is **not**
> authorized by this PR. It contains **no** real connection values and parses
> **no** DSN. Running it requires its own separate explicit scoped **HELEN GO**.

```bash
#!/usr/bin/env bash
# ============================================================================
# DRAFT COMMAND PACK — risk-evidence worker LOGIN role confirmation diagnostic
# PLANNING / DRAFT ONLY. DO NOT RUN without a separate scoped HELEN GO.
# Read-only catalog check. Local PostgreSQL admin path (sudo -u postgres).
# No worker. No grant. Booleans only. No rows. No DSN. No secrets.
# ============================================================================
set -Eeuo pipefail

# ---- Production repo path --------------------------------------------------
cd /opt/buyerrecon-backend

# ---- Operator-supplied, NEVER printed -------------------------------------
# CANDIDATE_RISK_WORKER_LOGIN_ROLE: the candidate LOGIN role (non-secret
#   identifier) the operator believes the risk worker will connect as. This is
#   an attested role NAME only — it is NOT derived from any DSN. NOLOGIN group
#   roles (e.g. buyerrecon_scoring_worker) are expected to FAIL the can_login
#   check and must not be accepted as the runtime login role.
CANDIDATE_RISK_WORKER_LOGIN_ROLE="${CANDIDATE_RISK_WORKER_LOGIN_ROLE:-}"

echo "risk_worker_role_confirmation_attempted=true"

# ---- Stop-line: correct base (must contain PR #320 merge) ------------------
PR320_MERGE="383ea40fd508cab0ecdeccdb21c47b493ca7b753"
if ! git merge-base --is-ancestor "$PR320_MERGE" HEAD 2>/dev/null; then
  echo "STOP_LINE=wrong_base pr320_merge_present=false"
  echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
  exit 2
fi
echo "pr320_merge_present=true"

# ---- Stop-line: dirty tracked tree ----------------------------------------
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "STOP_LINE=dirty_tracked_tree tracked_working_tree_clean=false"
  echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
  exit 2
fi
echo "tracked_working_tree_clean=true"

# ---- Stop-line: candidate role missing (fail closed) ----------------------
if [ -z "$CANDIDATE_RISK_WORKER_LOGIN_ROLE" ]; then
  echo "candidate_role_supplied=false"
  echo "STOP_LINE=candidate_role_missing"
  echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
  exit 2
fi
echo "candidate_role_supplied=true"

# ---- Stop-line: candidate role shape invalid ------------------------------
# Safe PostgreSQL identifier only: [a-z0-9_], no leading digit, no spaces, no
# punctuation, no quotes, no shell/SQL metacharacters.
case "$CANDIDATE_RISK_WORKER_LOGIN_ROLE" in
  *[!a-z0-9_]* | [0-9]* | "")
    echo "candidate_role_shape_valid=false"
    echo "STOP_LINE=candidate_role_invalid_shape"
    echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
    exit 2
    ;;
esac
echo "candidate_role_shape_valid=true"

# ---- Private temp dir (0700); stdout/stderr captured, stderr NEVER printed -
TMPDIR_PROOF="$(mktemp -d)"
chmod 700 "$TMPDIR_PROOF"
trap 'rm -rf "$TMPDIR_PROOF"' EXIT

# ---- Read-only catalog diagnostic (single RO txn, ROLLBACK) ----------------
# Proven local-admin path: sudo -u postgres (independent of operator Unix user).
# -A -t -> clean label-only stdout. Role passed via -v (NOT interpolated into
# the SQL body). Heredoc is quoted to block shell expansion. No DSN is read.
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 \
      -v candidate_role="$CANDIDATE_RISK_WORKER_LOGIN_ROLE" \
      -d buyerrecon_production \
      > "$TMPDIR_PROOF/proof.safe.out" \
      2> "$TMPDIR_PROOF/proof.err" <<'SQL'
\set role :candidate_role

BEGIN READ ONLY;

-- role existence + can-login (explicit true/false; never psql t/f)
SELECT 'candidate_role_exists=' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') THEN 'true' ELSE 'false' END;
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role')
            THEN 'true' ELSE 'false' END AS role_present \gset

\if :role_present
  SELECT 'candidate_role_can_login=' ||
         CASE WHEN rolcanlogin THEN 'true' ELSE 'false' END
    FROM pg_roles WHERE rolname = :'role';
  -- membership in the NOLOGIN group buyerrecon_scoring_worker (evidence only)
  SELECT 'candidate_role_is_member_of_buyerrecon_scoring_worker=' ||
         CASE WHEN pg_has_role(:'role','buyerrecon_scoring_worker','MEMBER') THEN 'true' ELSE 'false' END;
  -- required privilege booleans (has_table_privilege honors inheritance)
  SELECT 'candidate_role_stage0_decisions_select_privilege=' ||
         has_table_privilege(:'role','public.stage0_decisions','SELECT')::text;
  SELECT 'candidate_role_session_behavioural_features_select_privilege=' ||
         has_table_privilege(:'role','public.session_behavioural_features_v0_2','SELECT')::text;
  SELECT 'candidate_role_risk_observations_insert_privilege=' ||
         has_table_privilege(:'role','public.risk_observations_v0_1','INSERT')::text;
  SELECT 'candidate_role_risk_observations_update_privilege=' ||
         has_table_privilege(:'role','public.risk_observations_v0_1','UPDATE')::text;
\else
  SELECT 'candidate_role_can_login=unknown';
  SELECT 'candidate_role_is_member_of_buyerrecon_scoring_worker=unknown';
  SELECT 'candidate_role_stage0_decisions_select_privilege=unknown';
  SELECT 'candidate_role_session_behavioural_features_select_privilege=unknown';
  SELECT 'candidate_role_risk_observations_insert_privilege=unknown';
  SELECT 'candidate_role_risk_observations_update_privilege=unknown';
\endif

ROLLBACK;
SQL
then
  echo "STOP_LINE=confirmation_error_suppressed"
  echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
  rm -rf "$TMPDIR_PROOF"
  exit 3
fi

# ---- Emit ONLY the safe stdout labels (never proof.err) -------------------
cat "$TMPDIR_PROOF/proof.safe.out"

# ---- Confirmation gate: re-derive result from the captured safe labels -----
# psql can exit 0 while proof.safe.out holds blocking facts. Confirm ONLY if all
# required conditions hold. Reads proof.safe.out (safe labels) only; never
# proof.err, never raw rows.
require_true() {
  local key="$1"
  if ! grep -qx "${key}=true" "$TMPDIR_PROOF/proof.safe.out"; then
    echo "risk_worker_role_confirmation_blocked_reason=missing_or_false_${key}"
    return 1
  fi
}

CONFIRMED=true
for key in \
  "candidate_role_exists" \
  "candidate_role_can_login" \
  "candidate_role_stage0_decisions_select_privilege" \
  "candidate_role_session_behavioural_features_select_privilege" \
  "candidate_role_risk_observations_insert_privilege" \
  "candidate_role_risk_observations_update_privilege" ; do
  require_true "$key" || CONFIRMED=false
done

# ---- Explicit guard labels (static; this pack mutated nothing) ------------
echo "db_mutation_executed=false"
echo "stage0_rerun_executed=false"
echo "step2e_rerun_executed=false"
echo "worker_executed=false"
echo "downstream_extractors_executed=false"
echo "lane_scoring_executed=false"
echo "ams_runtime_executed=false"
echo "customer_output_executed=false"
echo "gate4e_executed=false"
echo "gate4f_executed=false"
echo "grants_or_role_changes_executed=false"
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

# ---- Final result label (gated on the confirmation validation above) ------
if [ "$CONFIRMED" = true ]; then
  echo "risk_worker_login_role_confirmation_result=confirmed"
else
  echo "risk_worker_login_role_confirmation_result=unconfirmed_or_blocked"
fi
```

---

## 3. Required diagnostic labels

```text
risk_worker_role_confirmation_attempted=true
pr320_merge_present=true
tracked_working_tree_clean=true
candidate_role_supplied=true|false
candidate_role_shape_valid=true|false
candidate_role_exists=true|false
candidate_role_can_login=true|false|unknown
candidate_role_is_member_of_buyerrecon_scoring_worker=true|false|unknown
candidate_role_stage0_decisions_select_privilege=true|false|unknown
candidate_role_session_behavioural_features_select_privilege=true|false|unknown
candidate_role_risk_observations_insert_privilege=true|false|unknown
candidate_role_risk_observations_update_privilege=true|false|unknown
risk_worker_login_role_confirmation_result=confirmed|unconfirmed_or_blocked
db_mutation_executed=false
stage0_rerun_executed=false
step2e_rerun_executed=false
worker_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
grants_or_role_changes_executed=false
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

## 4. Confirmation rule

The candidate role is **confirmed** only if **all** of these hold:

```text
candidate_role_exists=true
candidate_role_can_login=true
candidate_role_stage0_decisions_select_privilege=true
candidate_role_session_behavioural_features_select_privilege=true
candidate_role_risk_observations_insert_privilege=true
candidate_role_risk_observations_update_privilege=true
```

→ `risk_worker_login_role_confirmation_result=confirmed`. Otherwise the result is
`unconfirmed_or_blocked`, with one or more
`risk_worker_role_confirmation_blocked_reason=missing_or_false_<key>` labels.

**Membership note:** `candidate_role_is_member_of_buyerrecon_scoring_worker=true`
is useful evidence (it explains *how* the four privileges are inherited) but is
**not required** if the four `has_table_privilege` checks are already `true`.

**NOLOGIN note:** `buyerrecon_scoring_worker` is a **NOLOGIN group role** and must
**not** be accepted as the runtime login role. It is expected to fail
`candidate_role_can_login` (i.e. `=false`), which correctly forces
`unconfirmed_or_blocked`. The required confirmation is a real **LOGIN** role that
inherits or directly holds the four privileges.

---

## 5. Stop-lines

Pre-`psql` stop-lines `exit` early; post-`psql` conditions are caught by the
confirmation gate over `proof.safe.out` (never `proof.err`):

```text
STOP_LINE=wrong_base                    pr320_merge_present=false
STOP_LINE=dirty_tracked_tree            tracked_working_tree_clean=false
STOP_LINE=candidate_role_missing        candidate_role_supplied=false
STOP_LINE=candidate_role_invalid_shape  candidate_role_shape_valid=false
STOP_LINE=confirmation_error_suppressed risk_worker_login_role_confirmation_result=unconfirmed_or_blocked

candidate_role_exists=false                                   # role does not exist
candidate_role_can_login=false|unknown                       # cannot login (NOLOGIN/group)
candidate_role_stage0_decisions_select_privilege=false|unknown
candidate_role_session_behavioural_features_select_privilege=false|unknown
candidate_role_risk_observations_insert_privilege=false|unknown
candidate_role_risk_observations_update_privilege=false|unknown
```

Any of these → the candidate is **not** a confirmed runtime login role → stop;
do not supply it to the PR #320 proof.

---

## 6. Explicit non-authorization

- **This PR does not confirm the role by itself** — it records a draft
  diagnostic only.
- **This PR does not run the diagnostic.**
- **This PR does not run the PR #320 proof.**
- **This PR does not run the risk worker.**
- **This PR does not run Stage 0 or Step2E.**
- **This PR does not apply grants or role changes.**
- **This PR does not authorize Lane/scoring, AMS runtime, customer output,
  Gate4E, or Gate4F.**
- If the candidate role is missing or lacks privileges, **any fix requires
  separate planning + review + scoped GO** (and any grant/role change is its own
  reviewed change — never bundled here, and not derived from this read-only
  diagnostic). Registering a newly-confirmed login role in `.claude/constants.md`
  is likewise its own separate reviewed change.
- Running the diagnostic requires a **separate scoped HELEN GO**. A `confirmed`
  result only yields a value to supply as `RISK_WORKER_ROLE` to the PR #320
  proof — which itself still requires its own separate scoped GO and, even on
  PASS, only makes the risk-evidence worker a candidate (it does not run it).

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, DSN URI,
connection string, raw secret-manager payload, service-file content,
`.env.production` content/value, token, private key, IP address, host value,
port value, real URI, login source, **raw `pg_hba` lines**, raw `accepted_events`
payload, raw `canonical_jsonb`, real `session_id` / `request_id` / user
identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, raw stdout/stderr, or env-var value. The
draft diagnostic **parses no DSN** — the candidate role is an operator-supplied
non-secret identifier passed via `-v`, never derived from a connection string.
It captures stdout to a private `0700` temp directory and **emits only safe
`label=value` lines** (booleans / category tokens); stderr is captured to a
separate file that is **never printed** and is removed on exit. The table names
(`stage0_decisions`, `session_behavioural_features_v0_2`,
`risk_observations_v0_1`), the role names (`buyerrecon_scoring_worker`,
`buyerrecon_stage0_runner`, `buyerrecon_prod_collector_app`), the script / module
paths, the database name (`buyerrecon_production`), the repo path
(`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
repository / role / public-git identifiers. All values above are safe labels /
booleans / category tokens / non-secret identifiers / a public git commit hash —
not secret or row values. **This PR runs nothing.**
