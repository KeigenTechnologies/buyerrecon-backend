# Sprint 3 — Post-Stage0 Downstream-Input Readiness Aggregate Proof — Command Pack (Docs-Only)

**Status:** `POST_STAGE0_INPUT_READINESS_PROOF_COMMAND_PACK_PLANNING_ONLY`

This is a **docs-only command-pack planning record**. It contains a reviewable,
**DO NOT RUN** draft of the read-only, local-admin aggregate/boolean proof
recommended by PR #319 (`POST_STEP2E_NEXT_DOWNSTREAM_READINESS_PLANNING_ONLY`).

This PR **executes nothing**: no production command, no SQL, no psql, no Step2E
rerun, no Stage0 rerun, no Route C, no worker / downstream extractor, no
Lane/scoring, no AMS runtime, no customer output, no Gate4E, no Gate4F, no
GRANT/DML/DDL, no role change. It **records a draft command pack only**.

> Provenance of current base: PR #319 merge
> `d8ae477fe512c1e1284301063579b854210c51a4` on
> `sprint2-architecture-contracts-d4cc2bf`.

---

## 1. Proof target

After `STAGE0_EXECUTION_PASS` (Stage 0 exited 0, but `stage0_decisions` output
was not aggregate-proven — mirroring Step2E's `db_mutation_executed=unknown`),
the **next runtime candidate** is the risk-evidence worker
(`scripts/run-risk-evidence-worker.ts`, logic in
`src/scoring/risk-evidence/worker.ts`). Its contract, confirmed from source:

- **reads (SELECT):** `stage0_decisions`, `session_behavioural_features_v0_2`
  (`FROM stage0_decisions JOIN session_behavioural_features_v0_2`);
- **writes (INSERT + UPDATE):** `risk_observations_v0_1`
  (`INSERT INTO … ON CONFLICT … DO UPDATE`).

The proof converts the one unproven dependency link into an aggregate/boolean
fact — **without running any worker** — by checking, read-only over the **local
PostgreSQL admin path** (`sudo -u postgres`, **not** the collector DSN, **not** a
worker DSN), in a `BEGIN READ ONLY … ROLLBACK` envelope:

1. `stage0_decisions` table presence + aggregate `COUNT(*)` only;
2. write-target `risk_observations_v0_1` presence;
3. exactly the **four** privilege booleans the worker requires;
4. re-confirmation of the Step2E output counts.

It emits **safe labels only** (presence booleans, counts, `has_table_privilege`
booleans). No rows, payloads, identifiers, or secrets.

---

## 2. Command pack — **DO NOT RUN**

> **PLANNING ONLY. DO NOT RUN.** This block is illustrative and is **not**
> authorized by this PR. It contains **no** real connection values. Running it
> requires its own separate explicit scoped **HELEN GO**.

```bash
#!/usr/bin/env bash
# ============================================================================
# DRAFT COMMAND PACK — post-Stage0 downstream-input readiness aggregate proof
# PLANNING / DRAFT ONLY. DO NOT RUN without a separate scoped HELEN GO.
# Read-only. Local PostgreSQL admin path (sudo -u postgres). No worker. No grant.
# Emits safe labels only (booleans / counts). No raw rows. No secrets.
# ============================================================================
set -Eeuo pipefail

# ---- Production repo path --------------------------------------------------
cd /opt/buyerrecon-backend

# ---- Operator-supplied, NEVER printed -------------------------------------
# RISK_WORKER_ROLE: the CONFIRMED login role the risk-evidence worker uses.
#   NOTE: not registered in .claude/constants.md. Documented CANDIDATE only is
#   'buyerrecon_scoring_worker' (PR#6 / Stage0 scoring-preflight docs) — NOT
#   treated as fact. Operator MUST confirm the real role before running.
RISK_WORKER_ROLE="${RISK_WORKER_ROLE:-}"

# ---- Stop-line: correct base (must contain PR #319 merge) ------------------
PR319_MERGE="d8ae477fe512c1e1284301063579b854210c51a4"
if ! git merge-base --is-ancestor "$PR319_MERGE" HEAD 2>/dev/null; then
  echo "STOP_LINE=wrong_base pr319_merge_present=false"; exit 2
fi
echo "pr319_merge_present=true"

# ---- Stop-line: dirty tracked tree ----------------------------------------
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "STOP_LINE=dirty_tracked_tree tracked_working_tree_clean=false"; exit 2
fi
echo "tracked_working_tree_clean=true"

# ---- Stop-line: role not confirmed (fail closed) --------------------------
if [ -z "$RISK_WORKER_ROLE" ]; then
  echo "STOP_LINE=next_worker_role_unconfirmed"
  echo "risk_worker_role_present=unknown"
  exit 2
fi

# ---- Stop-line: role shape invalid (safe PG identifier only) --------------
# Reject anything not [a-z0-9_], any leading digit, or empty. Blocks quotes,
# spaces, semicolons, dollar signs, hyphens, and SQL/shell metacharacters.
case "$RISK_WORKER_ROLE" in
  *[!a-z0-9_]* | [0-9]* | "")
    echo "STOP_LINE=next_worker_role_invalid"
    echo "risk_worker_role_present=unknown"
    exit 2
    ;;
esac

# ---- Private temp dir (0700); stdout/stderr captured, stderr NEVER printed -
TMPDIR_PROOF="$(mktemp -d)"
chmod 700 "$TMPDIR_PROOF"
trap 'rm -rf "$TMPDIR_PROOF"' EXIT

# ---- Read-only aggregate/boolean proof (single RO txn, ROLLBACK) ----------
# Proven local-admin path: sudo -u postgres (independent of operator Unix user).
# -A -t guarantees clean label-only stdout. Role passed via -v (NOT interpolated
# into the SQL body). Heredoc is quoted to block shell expansion.
if ! sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 \
      -v risk_worker_role="$RISK_WORKER_ROLE" \
      -d buyerrecon_production \
      > "$TMPDIR_PROOF/proof.safe.out" \
      2> "$TMPDIR_PROOF/proof.err" <<'SQL'
\set role :risk_worker_role

BEGIN READ ONLY;

SELECT 'proof_execution_path=local_postgres_admin';
SELECT 'transaction_read_only=true';

-- presence: stage0_decisions  (label true/false + explicit branching var)
SELECT 'stage0_decisions_table_present=' ||
       CASE WHEN to_regclass('public.stage0_decisions') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT CASE WHEN to_regclass('public.stage0_decisions') IS NOT NULL
            THEN 'true' ELSE 'false' END AS s0_present \gset

-- presence: session_behavioural_features_v0_2
SELECT 'session_behavioural_features_table_present=' ||
       CASE WHEN to_regclass('public.session_behavioural_features_v0_2') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT CASE WHEN to_regclass('public.session_behavioural_features_v0_2') IS NOT NULL
            THEN 'true' ELSE 'false' END AS sbf_present \gset

-- presence: session_features
SELECT 'session_features_table_present=' ||
       CASE WHEN to_regclass('public.session_features') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT CASE WHEN to_regclass('public.session_features') IS NOT NULL
            THEN 'true' ELSE 'false' END AS sf_present \gset

-- presence: write target risk_observations_v0_1
SELECT 'risk_observations_table_present=' ||
       CASE WHEN to_regclass('public.risk_observations_v0_1') IS NOT NULL THEN 'true' ELSE 'false' END;
SELECT CASE WHEN to_regclass('public.risk_observations_v0_1') IS NOT NULL
            THEN 'true' ELSE 'false' END AS ro_present \gset

-- role presence: explicit true/false (never psql t/f)
SELECT 'risk_worker_role_present=' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') THEN 'true' ELSE 'false' END;
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role')
            THEN 'true' ELSE 'false' END AS role_present \gset

-- aggregate count ONLY (no rows, no WHERE on identifiers)
\if :s0_present
  SELECT 'stage0_decisions_aggregate_count=' || count(*)::text FROM public.stage0_decisions;
  SELECT 'stage0_decisions_populated='       || (count(*) > 0)::text FROM public.stage0_decisions;
\else
  SELECT 'stage0_decisions_aggregate_count=0';
  SELECT 'stage0_decisions_populated=false';
\endif

-- re-confirm Step2E outputs (counts only)
\if :sbf_present
  SELECT 'session_behavioural_features_row_count=' || count(*)::text FROM public.session_behavioural_features_v0_2;
\else
  SELECT 'session_behavioural_features_row_count=0';
\endif
\if :sf_present
  SELECT 'session_features_aggregate_count=' || count(*)::text FROM public.session_features;
\else
  SELECT 'session_features_aggregate_count=0';
\endif

-- next-worker privilege booleans — EXACTLY the 4 required, guarded by
-- role + table presence (missing -> 'unknown', never a raw error)
\if :role_present
  \if :s0_present
    SELECT 'risk_worker_stage0_decisions_select_privilege=' || has_table_privilege(:'role','public.stage0_decisions','SELECT')::text;
  \else
    SELECT 'risk_worker_stage0_decisions_select_privilege=unknown';
  \endif
  \if :sbf_present
    SELECT 'risk_worker_session_behavioural_features_select_privilege=' || has_table_privilege(:'role','public.session_behavioural_features_v0_2','SELECT')::text;
  \else
    SELECT 'risk_worker_session_behavioural_features_select_privilege=unknown';
  \endif
  \if :ro_present
    SELECT 'risk_worker_risk_observations_insert_privilege=' || has_table_privilege(:'role','public.risk_observations_v0_1','INSERT')::text;
    SELECT 'risk_worker_risk_observations_update_privilege=' || has_table_privilege(:'role','public.risk_observations_v0_1','UPDATE')::text;
  \else
    SELECT 'risk_worker_risk_observations_insert_privilege=unknown';
    SELECT 'risk_worker_risk_observations_update_privilege=unknown';
  \endif
\else
  SELECT 'risk_worker_stage0_decisions_select_privilege=unknown';
  SELECT 'risk_worker_session_behavioural_features_select_privilege=unknown';
  SELECT 'risk_worker_risk_observations_insert_privilege=unknown';
  SELECT 'risk_worker_risk_observations_update_privilege=unknown';
\endif

ROLLBACK;
SQL
then
  echo "STOP_LINE=proof_error_suppressed"
  echo "post_stage0_input_readiness_proof_result=blocked_or_failed"
  rm -rf "$TMPDIR_PROOF"
  exit 3
fi

# ---- Emit ONLY the safe stdout labels (never proof.err) -------------------
cat "$TMPDIR_PROOF/proof.safe.out"

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
echo "collector_dsn_used=false"

# ---- Final result label ----------------------------------------------------
echo "post_stage0_input_readiness_proof_result=pass"
```

---

## 3. Expected PASS labels

When the proof passes, the risk-evidence worker becomes a **candidate** (it is
**not** run by this proof):

```text
pr319_merge_present=true
tracked_working_tree_clean=true
proof_execution_path=local_postgres_admin
transaction_read_only=true
stage0_decisions_table_present=true
session_behavioural_features_table_present=true
session_features_table_present=true
risk_observations_table_present=true
risk_worker_role_present=true
stage0_decisions_aggregate_count=<N>        # N >= 1
stage0_decisions_populated=true
session_behavioural_features_row_count=1
session_features_aggregate_count=1
risk_worker_stage0_decisions_select_privilege=true
risk_worker_session_behavioural_features_select_privilege=true
risk_worker_risk_observations_insert_privilege=true
risk_worker_risk_observations_update_privilege=true
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
collector_dsn_used=false
post_stage0_input_readiness_proof_result=pass
```

---

## 4. Blocking labels / stop-lines

Any of these means the risk-evidence worker is **not input-ready** → stop:

```text
STOP_LINE=wrong_base                       pr319_merge_present=false
STOP_LINE=dirty_tracked_tree               tracked_working_tree_clean=false
STOP_LINE=next_worker_role_unconfirmed     risk_worker_role_present=unknown
STOP_LINE=next_worker_role_invalid         risk_worker_role_present=unknown
STOP_LINE=proof_error_suppressed           post_stage0_input_readiness_proof_result=blocked_or_failed

stage0_decisions_table_present=false                       # input table missing
stage0_decisions_aggregate_count=0 / stage0_decisions_populated=false   # not populated
risk_observations_table_present=false                      # write target missing
risk_worker_role_present=false                             # role does not exist
risk_worker_stage0_decisions_select_privilege=false|unknown
risk_worker_session_behavioural_features_select_privilege=false|unknown
risk_worker_risk_observations_insert_privilege=false|unknown
risk_worker_risk_observations_update_privilege=false|unknown
```

A privilege/presence gap is **not** fixed by this proof — it feeds a **separate**
planning + review + scoped-GO decision (never bundled here; **no grants**). A
missing/zero `stage0_decisions` points back to a Stage 0 output investigation,
not a forward worker run.

---

## 5. Remaining ambiguity — `RISK_WORKER_ROLE` identity

- `scripts/run-risk-evidence-worker.ts` connects via `DATABASE_URL` only — the
  **source pins no role name**.
- `.claude/constants.md` registers only `buyerrecon_app`,
  `buyerrecon_prod_collector_app`, `buyerrecon_production`, and
  `buyerrecon_stage0_runner`. **No risk/scoring worker role is registered.**
- `buyerrecon_scoring_worker` is named in docs (PR#6 / Stage0 scoring-preflight)
  as the intended scoring-side writer, but the executed Stage 0 identity was
  `buyerrecon_stage0_runner`. **`buyerrecon_scoring_worker` is therefore a
  candidate only — not a confirmed fact.**
- The pack is **operator-confirmed and not hardcoded**: `RISK_WORKER_ROLE` must
  be supplied; empty → `next_worker_role_unconfirmed`; wrong shape →
  `next_worker_role_invalid`; non-existent role → `risk_worker_role_present=false`.
  The eventual GO must state the confirmed role. If that role is a new
  identifier, **registering it in `.claude/constants.md` is its own separate
  reviewed change** — not part of this read-only proof, and not a grant.
- Secondary, out-of-scope ambiguity: whether production
  `session_behavioural_features_v0_2.feature_version` matches the worker's
  default `behavioural-features-v0.3` filter affects whether the worker *finds
  candidate rows at runtime*, not input/privilege readiness — it belongs to the
  later worker-run GO.

---

## 6. Boundaries / non-authorization

- **This PR does not run the command.** It is a docs-only command-pack draft.
- **Running it requires a separate scoped HELEN GO.**
- **Even a PASS only makes the risk-evidence worker a candidate; it does not run
  the worker.** The worker run is its own separate, independently gated decision.
- This PR / pack uses the **local PostgreSQL admin path only** — no collector
  DSN, no worker DSN.
- This PR / pack authorizes **no** grant or role change, **no** Step2E rerun,
  **no** Stage0 rerun, **no** Route C rerun, **no** worker / downstream
  extractor run, **no** Lane/scoring, **no** AMS runtime, **no** customer
  output, **no** Gate4E, and **no** Gate4F.

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, DSN URI,
connection string, raw secret-manager payload, service-file content,
`.env.production` content/value, token, private key, IP address, host value,
port value, real URI, login source, **raw `pg_hba` lines**, raw `accepted_events`
payload, raw `canonical_jsonb`, real `session_id` / `request_id` / user
identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, raw stdout/stderr, or env-var value. The
draft pack captures stdout to a private `0700` temp directory and **emits only
safe `label=value` lines**; stderr is captured to a separate file that is
**never printed** and is removed on exit. The table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `session_features`, `risk_observations_v0_1`),
the role names (`buyerrecon_prod_collector_app`, `buyerrecon_scoring_worker`,
`buyerrecon_stage0_runner`), the script / module paths, the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** repository / role / public-git
identifiers. All values above are safe labels / booleans / counts / category
tokens / non-secret identifiers / a public git commit hash — not secret or row
values. **This PR runs nothing.**
