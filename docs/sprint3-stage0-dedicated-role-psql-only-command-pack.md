# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof — psql-only Operator-Safe Command Pack (Review-Only)

**Status:** `STAGE0_DEDICATED_ROLE_PSQL_ONLY_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only command-correction record**. It **replaces the
fragile Node SQL-generation / heredoc path** that failed in PR #184
(`SyntaxError: Unexpected end of input`) with a **psql-only, operator-safe**
command pack for **exactly one future bounded create/grant/proof retry** of the
dedicated Stage 0 login role `buyerrecon_stage0_runner`.

This PR **executes nothing**: no corrected command run, no password use, no role
creation, no grant, no SQL, no Stage 0. The candidate command pack below is
**CANDIDATE ONLY — DO NOT RUN**. No real password, DSN, token, hostname, IP, raw
ID, row value, or customer data appears in this record.

> Provenance: PR #179 dedicated role plan/direct-grant set
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #182 admin-custody resolution
> (`e31a8fb9449151e5312ae1600f5fb59b96839ef6`); PR #183 password-mismatch
> evidence (`8d647c74232e86c79b1e8645af3d17de444f0e10`); PR #184 Node-syntax
> blocked evidence (`0e335a2b015ad4ec61c8f813f6f66a60899d8bfe`).

---

## 1. Carry-Forward Evidence

- PR #179 merge `5af3da6575521446d95adf0b82ed8044efa30a6b` — dedicated role plan;
  source-grounded **direct-grant** set (no membership/sequence/schema-wide/
  ownership/Risk/POI/Lane/scoring/AMS/customer/Gate grants).
- PR #182 merge `e31a8fb9449151e5312ae1600f5fb59b96839ef6` — admin-custody
  resolution (Option A secure admin connection; `.env.production` barred as
  admin).
- PR #183 merge `8d647c74232e86c79b1e8645af3d17de444f0e10` — password-mismatch
  blocked (fail-closed before any DB change).
- PR #184 merge `0e335a2b015ad4ec61c8f813f6f66a60899d8bfe` — Node-syntax blocked.

**PR #184 conclusion (carried forward):**
- **Do not retry the same Node heredoc command as-is.**
- The retry hit `SyntaxError: Unexpected end of input`.
- Misleading success labels (`create_grant_proof_ok`/`role_created`/
  `grants_applied`) were **superseded**.
- Authoritative catalog check proved `role_exists=false`, intended privileges
  false, no Stage 0 command, no run-lock touch.

---

## 1a. Review History

- **First Codex review of PR #185: BLOCKED.**
- **Blocker 1:** the catalog-backed success gate was **comment-only** — the live
  candidate block did not parse/gate the proof labels; it only echoed
  `stage0_command_run` / `run_lock_touched` / `raw_output_printed`.
- **Blocker 2:** the **PR #182 / PR #183 merge gates were missing** — the flow
  checked only PR #179 and PR #184.
- **Patch response (this commit):** the candidate now checks **all four**
  prerequisite merges (PR #179 / #182 / #183 / #184) **before** any password
  prompt or psql execution, each with a distinct stop-line + non-zero exit (§3a);
  and the §3c success gate is now **executable and fail-closed** —
  `label_value` / `require_label` parse the §3b proof output and emit
  `role_created=true` / `grants_applied=true` / `create_grant_proof_ok=true`
  **only after** every required positive is true and every forbidden label is
  false; otherwise it emits `create_grant_proof_ok=false` /
  `stop_line=catalog_proof_failed` / `failed_label=<name>`, removes temp files,
  unsets the password variables, and exits non-zero.

---

## 2. Correction Summary

- **Avoid Node template generation entirely** — psql-only / reviewed shell.
- **Operator-safe password handling** — hidden double entry, fail-closed on
  empty/mismatch, secret never printed, password only via a chmod-600 temp psql
  variable file removed on trap.
- **psql-only SQL execution** via `sudo -u postgres psql -d buyerrecon_production
  -v ON_ERROR_STOP=1`.
- **Catalog-backed proof before any success label** — `role_created=true` /
  `grants_applied=true` / `create_grant_proof_ok=true` emitted **only after** the
  catalog proof confirms role exists + required positive privileges true +
  forbidden negatives false + not-member + owns-no-tables.

---

## 3. Candidate Command Pack — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for **one** corrected psql-only Option A retry, run by the operator on
> the production host. Emits **allowlisted proof labels only**; never prints the
> password or raw `psql` output.

### 3a. Guarded shell + operator-safe password (psql-only; fail closed)
```bash
# CANDIDATE ONLY — DO NOT RUN
set -o pipefail
umask 077                                    # any temp file is created 0600
cd /opt/buyerrecon-backend || { echo "stop_line=wrong_repo_path"; exit 3; }

# (0) repo + merge gates (names/booleans only):
[ "$(pwd)" = "/opt/buyerrecon-backend" ] && echo "on_production_host=true" || { echo "on_production_host=false"; exit 3; }
echo "repo_head=$(git rev-parse HEAD)"
git merge-base --is-ancestor 5af3da6575521446d95adf0b82ed8044efa30a6b HEAD && echo "pr179_merge_present=true" || { echo "stop_line=pr179_merge_missing"; exit 3; }
git merge-base --is-ancestor e31a8fb9449151e5312ae1600f5fb59b96839ef6 HEAD && echo "pr182_merge_present=true" || { echo "stop_line=pr182_merge_missing"; exit 3; }
git merge-base --is-ancestor 8d647c74232e86c79b1e8645af3d17de444f0e10 HEAD && echo "pr183_merge_present=true" || { echo "stop_line=pr183_merge_missing"; exit 3; }
git merge-base --is-ancestor 0e335a2b015ad4ec61c8f813f6f66a60899d8bfe HEAD && echo "pr184_merge_present=true" || { echo "stop_line=pr184_merge_missing"; exit 3; }
[ -f docs/sprint3-stage0-dedicated-login-role-plan.md ] && echo "command_pack_doc_present=true" || { echo "stop_line=command_pack_doc_missing"; exit 3; }

# (1) temp psql var file (0600) + trap cleanup; password & temp file NEVER printed:
PWFILE="$(mktemp /tmp/bapp-stage0-pw.XXXXXX)"; chmod 600 "$PWFILE"
RAW="$(mktemp /tmp/bapp-stage0-raw.XXXXXX)";   chmod 600 "$RAW"
cleanup(){ rm -f "$PWFILE" "$RAW" 2>/dev/null; unset PW1 PW2; echo "temp_files_removed=true"; }
trap cleanup EXIT INT TERM

# (2) hidden double password entry; fail closed on empty/mismatch; never echoed:
read -r -s -p "New buyerrecon_stage0_runner password: " PW1; echo
read -r -s -p "Confirm password: "                     PW2; echo
echo "password_received=true"; echo "password_printed=false"
[ -n "$PW1" ] || { echo "password_confirmed=false"; echo "stop_line=password_empty"; exit 2; }
[ "$PW1" = "$PW2" ] || { echo "password_confirmed=false"; echo "stop_line=stage0_runner_password_mismatch"; exit 2; }
echo "password_confirmed=true"

# Write ONLY a psql variable assignment to the 0600 temp file (value never printed):
printf "\\set STAGE0_RUNNER_PW '%s'\n" "$PW1" > "$PWFILE"
unset PW1 PW2                                 # drop plaintext from the shell asap

# (3) psql-only create + grant (NO Node). Raw output -> RAW (0600), never printed:
if sudo -u postgres psql -d buyerrecon_production -v ON_ERROR_STOP=1 \
     --no-psqlrc -f "$PWFILE" -f - > "$RAW" 2>&1 <<'SQL'
\set ON_ERROR_STOP on
CREATE ROLE buyerrecon_stage0_runner
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'STAGE0_RUNNER_PW';
GRANT SELECT                 ON TABLE public.accepted_events  TO buyerrecon_stage0_runner;
GRANT SELECT                 ON TABLE public.ingest_requests  TO buyerrecon_stage0_runner;
GRANT SELECT, INSERT, UPDATE ON TABLE public.stage0_decisions TO buyerrecon_stage0_runner;
SQL
then ddl_ok=true; else ddl_ok=false; fi
rm -f "$PWFILE"                               # remove password temp immediately after use

if [ "$ddl_ok" != "true" ]; then
  echo "create_grant_proof_ok=false"
  echo "stop_line=psql_create_grant_failed"   # raw errors withheld (may contain connection details)
  exit 5
fi
# NOTE: do NOT emit role_created/grants_applied here — only after §3b catalog proof.
```

### 3b. Catalog-backed proof (separate psql; booleans only; gates success)
```sql
-- CANDIDATE ONLY — DO NOT RUN — run via: sudo -u postgres psql -d buyerrecon_production
--   -v ON_ERROR_STOP=1 --no-psqlrc -f <this> > "$RAW2" 2>&1   (then parse allowlisted labels)
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

SELECT 'db_expected|'        || (current_database() = 'buyerrecon_production')::text;
SELECT 'role_exists|'        || EXISTS (SELECT 1 FROM pg_roles WHERE rolname='buyerrecon_stage0_runner')::text;
SELECT 'role_can_login|'     || COALESCE((SELECT rolcanlogin    FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_is_superuser|'  || COALESCE((SELECT rolsuper       FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_createdb|'      || COALESCE((SELECT rolcreatedb    FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_createrole|'    || COALESCE((SELECT rolcreaterole  FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_replication|'   || COALESCE((SELECT rolreplication FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_bypassrls|'     || COALESCE((SELECT rolbypassrls   FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;

-- Positive Stage 0 privileges (expect true):
SELECT 'priv_accepted_events_select|' || has_table_privilege('buyerrecon_stage0_runner','public.accepted_events','SELECT')::text;
SELECT 'priv_ingest_requests_select|' || has_table_privilege('buyerrecon_stage0_runner','public.ingest_requests','SELECT')::text;
SELECT 'priv_stage0_select|'          || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','SELECT')::text;
SELECT 'priv_stage0_insert|'          || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','INSERT')::text;
SELECT 'priv_stage0_update|'          || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','UPDATE')::text;

-- Membership absence (expect true):
SELECT 'not_member_scoring_worker|'   || (NOT pg_has_role('buyerrecon_stage0_runner','buyerrecon_scoring_worker','MEMBER'))::text;

-- Negative privileges (all expect false):
SELECT 'forbidden_risk_select|'       || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','SELECT')::text;
SELECT 'forbidden_risk_insert|'       || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','INSERT')::text;
SELECT 'forbidden_risk_update|'       || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','UPDATE')::text;
SELECT 'forbidden_poi_select|'        || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','SELECT')::text;
SELECT 'forbidden_poi_insert|'        || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','INSERT')::text;
SELECT 'forbidden_poi_update|'        || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','UPDATE')::text;
SELECT 'forbidden_poi_seq_usage|'     || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','USAGE')::text;
SELECT 'forbidden_poi_seq_select|'    || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','SELECT')::text;
SELECT 'forbidden_poi_seq_update|'    || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','UPDATE')::text;
SELECT 'forbidden_poiseq_select|'     || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','SELECT')::text;
SELECT 'forbidden_poiseq_insert|'     || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','INSERT')::text;
SELECT 'forbidden_poiseq_update|'     || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','UPDATE')::text;
SELECT 'forbidden_poiseq_seq_usage|'  || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','USAGE')::text;
SELECT 'forbidden_poiseq_seq_select|' || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','SELECT')::text;
SELECT 'forbidden_poiseq_seq_update|' || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','UPDATE')::text;
SELECT 'forbidden_stage0_delete|'     || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','DELETE')::text;
SELECT 'forbidden_lane_a_any|'        || has_table_privilege('buyerrecon_stage0_runner','public.scoring_output_lane_a','INSERT')::text;
SELECT 'forbidden_lane_b_any|'        || has_table_privilege('buyerrecon_stage0_runner','public.scoring_output_lane_b','INSERT')::text;

-- Ownership absence (expect true):
SELECT 'owns_no_tables|' || (NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
  WHERE r.rolname = 'buyerrecon_stage0_runner' AND c.relkind IN ('r','p')
))::text;
```

### 3c. Executable catalog-gated success (only after §3b proof; fail closed)
```bash
# CANDIDATE ONLY — DO NOT RUN
# PROOF_RAW = the §3b output file (chmod 600). Parse ONLY allowlisted labels; never print raw psql output.

label_value() {                              # echo the value of one allowlisted "name|value" label
  grep -E "^$1\|" "$PROOF_RAW" | tail -n1 | cut -d'|' -f2
}
require_label() {                            # fail closed unless label == expected
  name="$1"; expected="$2"; actual="$(label_value "$name")"
  if [ "$actual" != "$expected" ]; then
    echo "create_grant_proof_ok=false"
    echo "stop_line=catalog_proof_failed"
    echo "failed_label=$name"               # name only; never the raw line/value context
    return 1
  fi
}

gate_ok=true

# Required POSITIVE labels (exact expected values):
require_label db_expected               true  || gate_ok=false
require_label role_exists               true  || gate_ok=false
require_label role_can_login            true  || gate_ok=false
require_label role_is_superuser         false || gate_ok=false
require_label role_createdb             false || gate_ok=false
require_label role_createrole           false || gate_ok=false
require_label role_replication          false || gate_ok=false
require_label role_bypassrls            false || gate_ok=false
require_label priv_accepted_events_select true || gate_ok=false
require_label priv_ingest_requests_select true || gate_ok=false
require_label priv_stage0_select        true  || gate_ok=false
require_label priv_stage0_insert        true  || gate_ok=false
require_label priv_stage0_update        true  || gate_ok=false
require_label not_member_scoring_worker true  || gate_ok=false
require_label owns_no_tables            true  || gate_ok=false

# Required FORBIDDEN labels (all must be false):
for f in forbidden_risk_select forbidden_risk_insert forbidden_risk_update \
         forbidden_poi_select forbidden_poi_insert forbidden_poi_update \
         forbidden_poi_seq_usage forbidden_poi_seq_select forbidden_poi_seq_update \
         forbidden_poiseq_select forbidden_poiseq_insert forbidden_poiseq_update \
         forbidden_poiseq_seq_usage forbidden_poiseq_seq_select forbidden_poiseq_seq_update \
         forbidden_stage0_delete forbidden_lane_a_any forbidden_lane_b_any; do
  require_label "$f" false || gate_ok=false
done

if [ "$gate_ok" != "true" ]; then
  # any failed_label / stop_line=catalog_proof_failed already emitted by require_label
  echo "create_grant_proof_ok=false"
  rm -f "$PWFILE" "$RAW" "$PROOF_RAW" 2>/dev/null; unset PW1 PW2
  exit 6                                      # fail closed — NO success labels emitted
fi

# All positives true AND all forbidden false -> emit success labels (ONLY here):
echo "role_created=true"
echo "grants_applied=true"
echo "create_grant_proof_ok=true"
echo "stage0_command_run=false"
echo "run_lock_touched=false"
echo "raw_output_printed=false"
```

---

## 4. Failure Paths (fail closed)

Stop closed — emit **only** a safe stop-line, **no** success labels, remove temp
files, unset password variables, run **no** Stage 0 — if any of:
- repo path is wrong (`stop_line=wrong_repo_path`);
- required merges missing — PR #179 / #182 / #183 / #184 (`pr179_merge_missing` /
  `pr182_merge_missing` / `pr183_merge_missing` / `pr184_merge_missing`), each a
  distinct stop-line with non-zero exit **before** any password prompt or psql
  execution;
- command-pack doc missing;
- password empty (`password_empty`) or mismatch
  (`stage0_runner_password_mismatch`);
- psql create/grant exits non-zero (`psql_create_grant_failed`);
- catalog proof does not produce all expected labels, OR any required positive is
  false, OR any forbidden negative is true, OR `not_member_scoring_worker` /
  `owns_no_tables` is false (`catalog_proof_failed`).

`role_created=true` / `grants_applied=true` / `create_grant_proof_ok=true` are
emitted **only** by §3c after the §3b catalog proof fully passes.

---

## 5. Raw Output Handling

- Both create/grant (§3a) and proof (§3b) send raw `psql` stdout/stderr to a
  `chmod 600` temp file; the flow prints **only allowlisted proof labels** parsed
  from it.
- **Never** `cat` / `tee` / print raw `psql` output or errors (they may contain
  connection details / secrets).
- Password temp file and raw temp files are removed by the `trap` on every path;
  `password_printed=false`, `raw_output_printed=false`.

---

## 6. Non-Authorizations

This PR does **not** authorize:
- running the corrected command;
- password use;
- role creation;
- grants;
- SQL execution;
- DML / DDL;
- Stage 0 execution;
- run-lock touch;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 7. Next Gated Sequence

1. Open this docs-only command-correction PR.
2. **Codex narrow review.**
3. **Merge if PASS.**
4. **Helen issues a fresh explicit GO** for **exactly one** corrected psql-only
   Option A create/grant/proof retry.
5. Operator runs it **on production** (psql-only; operator-safe password; safe
   labels only).
6. **Docs-only evidence PR** records the safe-label result.
7. **Only if the proof passes** (all required positives true + all forbidden
   negatives false) may Helen issue a **separate Stage 0 execution GO**. Stage 0
   execution remains separately GO-gated.

---

## 8. Safety / Raw-Data Boundary

This record contains no real password, DSN URI, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The `:'STAGE0_RUNNER_PW'`
placeholder is a psql variable reference for an operator-entered value written
only to a chmod-600 temp file and removed on trap — **not** a secret in this doc.
All identifier references are role / database / relation / sequence / column
names, env-var names, SQL identifiers, the masked
`tsx scripts/run-stage0-worker.ts` mapping, public git commit hashes, or
stop-line / boundary language — not secret or row values.
