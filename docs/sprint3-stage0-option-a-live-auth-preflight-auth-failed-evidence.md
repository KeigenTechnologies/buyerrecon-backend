# Sprint 3 — Stage 0 — Option A Runner Live-Auth Preflight — Evidence (AUTH_FAILED, raw withheld)

**Status:** `STAGE0_OPTION_A_LIVE_AUTH_PREFLIGHT_AUTH_FAILED_RAW_WITHHELD`

This is a **docs-only evidence record**. Under the GO
`HELEN OPTION A STAGE0 RUNNER LIVE-AUTH PREFLIGHT GO`, the operator ran the SHA-verified
non-argv Option A live-auth preflight script (active SHA
`82c023868083212efa8c1e10964dd904fcaab3f1c8c2b1d2539ebae736bc5c39`,
`sha256_match=true`, `syntax_check=pass`) on production. Phase 0 and the registry/custody
preconditions passed, a non-argv (`PGSERVICEFILE`) connection method was used, and **exactly
one** read-only psql/auth preflight was attempted as `buyerrecon_stage0_runner` — which
**failed** with raw output withheld. **Result: `live_auth_preflight_result=auth_failed`,
`stop_line=psql_auth_failed_raw_withheld`.**

**This records a live-auth FAILURE with raw output withheld — it does NOT inspect or expose
raw psql/PostgreSQL output, does NOT prove the exact failure subcase, and does NOT authorize
any rerun, remediation, credential action, or Stage 0.** This PR records safe
**booleans/category tokens / public commit hashes only** — no secret value, DSN, host, port,
username (beyond the approved role identifier), password, `.env.production` value, connection
string, custody contents, or raw psql output.

> Provenance: PR #283 custody value corrected/verified
> (`5033d0157f5191708074f92ab30a273cd3193cfa`,
> `PRODUCTION_PARAMETER_REGISTRY_STAGE0_RUNNER_CUSTODY_VALUE_CORRECTED_AMENDMENT_ONLY`);
> PR #282 RB-ROTATE applied (`dadb458bde5e7de0e980749829f11e9308920f91`); PR #281 source-of-truth
> derivation activation (`1d69ff3a41ee1e47cc41326667a1c342cde614c5`); PR #262 revised classifier
> classified `auth_or_credential` (`155737d007dcf43c40eb4db43546705562c9424e`).

---

## 1. Authorization & Pre-Run Verification

- GO: `HELEN OPTION A STAGE0 RUNNER LIVE-AUTH PREFLIGHT GO` — exactly one live-auth preflight.
- Active script SHA: `82c023868083212efa8c1e10964dd904fcaab3f1c8c2b1d2539ebae736bc5c39`
  (verified `sha256_match=true`, `syntax_check=pass` before the GO).
- Superseded script SHA: `5273d1525cdcfe8e9c40819bc69fe2e007534c73db0f3c25499c096e35665181`
  — superseded because it passed the DSN via argv (`psql -d "$dsn"`); **not run**.
- Scope was **live-auth preflight only** (read-only). The run did **not** rotate credentials,
  write custody, run Stage 0, or touch the run-lock.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Duplicate-Run Handling (transparency)

- Claude Code observed **one** safe-label set for this preflight and has **no** terminal
  history or operator note indicating a second actual invocation.
- Recorded accordingly:
  ```text
  preflight_invocation_count=1
  duplicate_invocation=false
  output_pasted_twice=not_determinable_by_claude_code
  ```
- This is **not** concealment: if the operator actually invoked the preflight **twice**, that
  must be corrected in a follow-up note recording `preflight_invocation_count=2`,
  `duplicate_invocation=true`, `duplicate_invocation_result_same=true` — noting both were
  read-only auth preflight attempts with raw output withheld and **no** Stage 0 / run-lock /
  data / schema / grant / downstream action. Absent any such evidence, this record reflects a
  single observed invocation.

---

## 3. Safe Labels (from the actual preflight run)

```text
expected_path_ok=true
expected_branch_ok=true
working_tree_clean_before=true
remote_fetch_attempted=true
remote_fetch_result=success
fast_forward_to_current_tip_applied=true
working_tree_clean=true
head_contains_pr282_merge=true
head_contains_pr283_merge=true
parameter_registry_doc_present=true
registry_custody_corrected=true
registry_live_auth_proven_false=true
custody_file_exists=true
custody_file_owner_root=true
custody_file_chmod_600=true
custody_key_present=true
custody_value_shape_complete=true
custody_value_printed=false
raw_values_printed=false
previous_script_sha_superseded=true
previous_script_not_run=true
non_argv_connection_method=true
dsn_passed_on_argv=false
psql_command_uses_service_name_only=true
temp_service_file_created=true
temp_service_file_chmod_600=true
temp_service_file_removed=true
psql_auth_attempted=true
psql_auth_succeeded=false
raw_psql_output_printed=false
auth_user_expected_match=false
auth_database_expected_match=false
transaction_read_only_enforced=false
live_auth_preflight_result=auth_failed
stop_line=psql_auth_failed_raw_withheld
execution_completed=true
stage0_executed=false
run_lock_touched=false
```

---

## 4. Interpretation (bounded)

### 4.1 Phase 0 + preconditions (passed)
Expected path/branch; clean tree before and after; remote fetch success; current-tip
fast-forward applied; HEAD contains the PR #282 and PR #283 merges; registry doc present; the
registry preconditions passed (`registry_custody_corrected=true`,
`registry_live_auth_proven_false=true`).

### 4.2 Custody + non-argv connection (clean)
The custody file exists, is root-owned, chmod 600, the key is present, and the DSN **shape**
is complete (`custody_value_shape_complete=true`) — all verified **without printing** the DSN
or any component (`custody_value_printed=false`, `raw_values_printed=false`). A **non-argv**
connection method was used (`non_argv_connection_method=true`, `dsn_passed_on_argv=false`,
`psql_command_uses_service_name_only=true`); the temp service file was created chmod 600 and
removed (`temp_service_file_created=true`, `temp_service_file_chmod_600=true`,
`temp_service_file_removed=true`). The superseded argv-DSN script was **not** run
(`previous_script_sha_superseded=true`, `previous_script_not_run=true`).

### 4.3 Auth preflight (FAILED, raw withheld)
Exactly one read-only auth preflight was attempted (`psql_auth_attempted=true`) and **did not
succeed** (`psql_auth_succeeded=false`); raw psql/PostgreSQL output was **withheld**
(`raw_psql_output_printed=false`). Result: `live_auth_preflight_result=auth_failed`,
`stop_line=psql_auth_failed_raw_withheld`.

### 4.4 The false booleans are UNCONFIRMED, not assertions
Because authentication did **not** succeed, the post-connection checks never returned a
trustworthy row, so `auth_user_expected_match=false`, `auth_database_expected_match=false`,
and `transaction_read_only_enforced=false` are **unconfirmed** — they must **not** be read as
proof of a wrong user, wrong database, or a read-only-enforcement failure. They are simply
"not confirmed because the connection/auth did not complete."

### 4.5 Bounded conclusion
- Phase 0, registry preconditions, custody file checks, and DSN shape all passed; the
  connection method was non-argv and secret-safe; the superseded script was not run.
- The **live authentication attempt failed** with raw output withheld.
- The exact failure subcase is **not** established here (no raw inspection) — it remains in the
  `auth_or_credential` family at the live-auth level.
- **The original `auth_or_credential` remains unresolved at the live-auth level.** The registry
  current-custody correction (PR #282/#283) remains recorded, but **`live_auth_proven` remains
  false**.
- This does **not** authorize any rerun, raw-output inspection, credential action, RB-ROTATE
  retry, custody write, Option A retry, Step 2E, Stage 0, or remediation.

---

## 5. What Did Not Happen

- No preflight rerun (this records the single observed run); no Option A retry.
- No raw psql/PostgreSQL output inspected, printed, or exposed.
- No secret/custody value read into output; no DSN/host/port/username(beyond role)/password
  printed; no `.env.production` read/print.
- No credential rotation; no RB-ROTATE retry; no custody write/overwrite.
- No psql/auth retry beyond the single attempt.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes (the attempt was read-only and did not complete).
- No source-selection change; no Option B code change; no remediation.
- No downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E; no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 6. Verdict

- **AUTH_FAILED (raw withheld) — Option A live-auth preflight is
  `live_auth_preflight_result=auth_failed`, `stop_line=psql_auth_failed_raw_withheld`**: Phase 0
  / registry / custody / shape / non-argv connection all passed, but the single read-only
  psql/auth attempt as `buyerrecon_stage0_runner` failed with raw output withheld.
- This is **not** a valid live-auth proof, **not** an exact-subcase determination, **not**
  authorization for any rerun/remediation/credential action, and **not** a Stage 0 execution.
  `live_auth_proven` remains **false**.

---

## 7. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun the preflight, inspect raw output, rotate credentials, run RB-ROTATE,
   write custody, retry psql/auth, run an Option A retry, run Step 2E, run Stage 0, touch the
   run-lock, or perform remediation off this evidence.
3. After this evidence PR is reviewed/merged, the next gated move is a **separate docs-only
   planning PR** to decide how to safely investigate the live-auth failure within the
   `auth_or_credential` family — secret-safe (e.g. a category-only classifier over the
   already-withheld raw output, or a custody/credential re-confirmation route) — each requiring
   its own Codex review and a fresh explicit Helen GO. No raw-output inspection, credential
   action, or rerun without separate planning/review/GO.
4. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false.**

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
**host value, port value**, real URI, SSH banner, login source, host/network detail, raw
payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw PostgreSQL
error text, Node stack trace, or customer data. The preflight ran a **single read-only**
auth attempt using a **non-argv** connection method (a chmod-600 `PGSERVICEFILE` under a
chmod-700 temp dir, removed on exit; only the non-secret service name on argv); it **withheld**
raw psql/PostgreSQL output (`raw_psql_output_printed=false`), did **not** print the DSN or any
component (`custody_value_printed=false`, `raw_values_printed=false`), and the superseded
argv-DSN script was **not** run. The unconfirmed `auth_user_expected_match=false` /
`auth_database_expected_match=false` / `transaction_read_only_enforced=false` reflect that auth
did not complete — not assertions about user/database/read-only state. The role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, the
env-var/key name `STAGE0_RUNNER_DSN`, the database name `buyerrecon_production`, and the
service name `stage0_auth_preflight` are non-secret identifiers. (Per the PR #218 Codex note:
"no secret used or exposed" is to be read as "no secret value exposed, printed, or recorded.")
All values above are safe labels / booleans / category tokens / non-secret identifiers /
public git commit hashes — not secret or row values.
