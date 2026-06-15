# Sprint 3 — Stage 0 Step 2G — Option A Current-Tip Fast-Forward + Binding/Auth Preflight Retry — Evidence (AUTH FAILED, raw withheld)

**Status:** `STAGE0_STEP2G_OPTION_A_BINDING_AUTH_PREFLIGHT_RETRY_AUTH_FAILED_RAW_WITHHELD`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 STEP2G OPTION A CURRENT-TIP FAST-FORWARD PLUS BINDING AUTH PREFLIGHT RETRY
GO`, the operator (Phase 0) fast-forwarded the production checkout at
`/opt/buyerrecon-backend` to the current remote base tip (HEAD now contains PR #249/#256/
#257), then (Phase 1) ran the Option A binding/auth preflight. All preflight gates passed,
the runner source was loaded invocation-scoped, `DATABASE_URL` was child-scoped, runtime
binding was performed **for the auth preflight only**, and the **auth/psql gate executed
and failed** → `option_a_binding_preflight_retry_result=auth_failed`,
`stop_line=auth_psql_gate_failed_raw_output_withheld`. Raw auth output was **withheld**
(chmod 600); the secret temp service file was used and then removed.

**This proves Option A reached and executed the auth/psql gate and that the gate failed —
it does NOT prove the exact failure reason (raw output withheld), and is NOT a Stage 0
readiness proof or a Stage 0 execution.** This PR records safe **booleans/category tokens
/ non-secret path & name identifiers / public commit hashes only** — no secret value, DSN,
password, token, host, port, IP, URI, `.env.production` content, raw SQL / psql /
PostgreSQL error text, or raw data.

> Provenance: PR #257 Option A mapping diagnostic accepted
> (`350360700231579890ef20f07fe441cd67d1e811`,
> `STAGE0_STEP2G_OPTION_A_MAPPING_DIAGNOSTIC_ACCEPTED`); PR #256 revised command-pack
> mapping diagnostic plan (`a46cb506bdbaf56257b986722f705dc860f06f4f`); PR #249 Option A
> runtime-binding command-pack plan (`76bff30d0912b00ee5338d4bdc83bbafccb4271e`); PR #247 S2
> presence proof (`609fa182a732961cf87c86a6dbe2d23d8dbe5c15`); PR #218 Step 2C
> `auth_or_credential` (`92d568a6b7491500db4de1732c3b9015a0ddc14e`).

---

## 1. Authorization

- GO: `HELEN STAGE0 STEP2G OPTION A CURRENT-TIP FAST-FORWARD PLUS BINDING AUTH PREFLIGHT
  RETRY GO` — one current-tip fast-forward (Phase 0) plus one Option A binding/auth
  preflight retry (Phase 1) per the PR #249 command-pack and the accepted mapping;
  secret-safe; value never printed/parsed; raw output withheld; **no** Stage 0.
- This did **not** authorize another preflight, raw-output inspection, a credential reset,
  a Step 2E rerun, remediation, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual run)

```text
current_tip_fast_forward_attempted=true
dsn_in_argv=false
secret_value_printed=false
secret_value_parsed=false
env_dump_performed=false
env_production_values_read=false
persistent_env_mutation=false
password_reset_rotation=false
remediation_performed=false
source_selection_changed=false
option_b_code_changed=false
mapping_predicate_changed=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
runtime_downstream_action=false
expected_path_ok=true
expected_branch_ok=true
working_tree_clean_before=true
remote_fetch_attempted=true
remote_fetch_result=success
fast_forward_to_current_tip_possible=true
fast_forward_to_current_tip_applied=true
head_contains_remote_base_tip=true
head_contains_pr249_merge=true
head_contains_pr256_merge=true
head_contains_pr257_merge=true
working_tree_clean_after_fast_forward=true
option_a_binding_auth_preflight_retry_attempted=true
custody_file_exists=true
custody_owner_ok=true
custody_permissions_ok=true
stage0_runner_dsn_key_present=true
stage0_run_mapping_accepted=true
stage0_run_shape_classification=tsx_or_node_wrapper_expected_entrypoint
runner_source_loaded=true
secret_temp_service_file_used=true
database_url_child_scoped=true
runtime_binding_performed=true
auth_psql_gate_executed=true
psql_sql_invoked=true
secret_temp_service_file_removed=true
option_a_binding_preflight_retry_result=auth_failed
stop_line=auth_psql_gate_failed_raw_output_withheld
raw_auth_output_withheld=true
raw_auth_output_chmod_600=true
current_tip_fast_forward_plus_preflight_completed=true
```

---

## 3. Interpretation (bounded)

### 3.1 Phase 0 — current-tip fast-forward (succeeded)
Expected path/branch (`expected_path_ok=true`, `expected_branch_ok=true`); clean tree
before/after (`working_tree_clean_before=true`,
`working_tree_clean_after_fast_forward=true`); remote fetch success
(`remote_fetch_result=success`); fast-forward possible and applied
(`fast_forward_to_current_tip_applied=true`); local HEAD contains the **current remote
base tip** and **PR #249/#256/#257** merges. The sync gap stayed cleared.

### 3.2 Phase 1 — Option A binding/auth preflight (executed; gate FAILED)
- **All preflight gates passed:** custody file exists (`custody_file_exists=true`),
  expected owner/permissions (`custody_owner_ok=true`, `custody_permissions_ok=true`),
  `STAGE0_RUNNER_DSN` key present (`stage0_runner_dsn_key_present=true`), and the
  `stage0:run` mapping accepted as `tsx_or_node_wrapper_expected_entrypoint`
  (`stage0_run_mapping_accepted=true`).
- **The runner source was loaded invocation-scoped** (`runner_source_loaded=true`) via a
  secret temp service file (`secret_temp_service_file_used=true`); **`DATABASE_URL` was
  child-scoped** (`database_url_child_scoped=true`) and **runtime binding was performed for
  the auth preflight only** (`runtime_binding_performed=true`).
- **The auth/psql gate executed** (`auth_psql_gate_executed=true`, `psql_sql_invoked=true`)
  and **failed** → `option_a_binding_preflight_retry_result=auth_failed`,
  `stop_line=auth_psql_gate_failed_raw_output_withheld`.
- **Raw auth output was withheld** (`raw_auth_output_withheld=true`,
  `raw_auth_output_chmod_600=true`); the **secret temp service file was removed**
  (`secret_temp_service_file_removed=true`).
- **Secret-safety held throughout:** DSN not in argv (`dsn_in_argv=false`); secret value
  not printed/parsed (`secret_value_printed=false`, `secret_value_parsed=false`); no env
  dump (`env_dump_performed=false`); no `.env.production` read
  (`env_production_values_read=false`).
- **Nothing beyond the auth-preflight occurred:** no Stage 0 (`stage0_executed=false`), no
  Step 2E (`step2e_rerun=false`), no run-lock touch (`run_lock_touched=false`), no
  persistent env mutation (`persistent_env_mutation=false`), no password reset/rotation
  (`password_reset_rotation=false`), no source-selection change
  (`source_selection_changed=false`), no Option B code change
  (`option_b_code_changed=false`), no mapping-predicate change
  (`mapping_predicate_changed=false`), no remediation (`remediation_performed=false`), no
  runtime/downstream action (`runtime_downstream_action=false`).

### 3.3 Bounded conclusion
- This **proves Option A reached the binding/auth gate**.
- This **proves child-scoped runtime binding worked far enough to invoke psql**.
- This **proves the auth/psql gate failed**.
- This does **not** prove the exact failure reason, because **raw output was withheld**.
- This does **not** prove whether the issue is a wrong credential, malformed DSN,
  role/database mismatch, network/SSL/pg_hba, service-file shape, or another psql/auth
  category.
- This does **not** prove Stage 0 readiness.
- This does **not** execute Stage 0.
- This does **not** authorize remediation.

The Option A path is now **fully exercised end-to-end** for the first time: every gate up
to and including the auth/psql attempt ran, and the attempt **failed with the reason
deliberately unexposed**. The next step is a separately-reviewed plan to **classify the
failure category safely** (non-secret error-category fields only) or to route to
credential/custody correction — **not** a credential or Stage 0 action.

---

## 4. What Did Not Happen

- No proof of the exact auth-failure reason (raw output withheld).
- No another preflight; no raw-output inspection; no raw SQL/psql/PostgreSQL output in
  chat.
- No credential reset; no password reset/rotation; no remediation.
- No persistent env mutation; no source-selection change; no Option B code change; no
  mapping-predicate change.
- No `.env.production` value read/print; no DSN parsing/component output; no secret value
  read/print/parse/log/exposure.
- No Stage 0 execution; no `npm run stage0:run`.
- No Step 2E rerun.
- No run-lock touch.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network
  detail recorded.

---

## 5. Verdict

- **AUTH FAILED (raw withheld) — Step 2G Option A binding/auth preflight retry is
  `option_a_binding_preflight_retry_result=auth_failed`,
  `stop_line=auth_psql_gate_failed_raw_output_withheld`**: Phase 0 current-tip
  fast-forward cleared the sync gap; Phase 1 passed all preflight gates, loaded the runner
  source invocation-scoped, child-scoped `DATABASE_URL`, performed runtime binding for the
  auth preflight only, executed the auth/psql gate, and the gate **failed** with raw output
  withheld (chmod 600) and the secret temp service file removed.
- This is **not** a proof of the exact failure reason, **not** a Stage 0 readiness proof,
  **not** a remediation, and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun the preflight, inspect raw output, reset credentials, run psql/auth
   again, perform remediation, run Step 2E, run Stage 0, touch the run-lock, change source
   selection, implement Option B, or perform any downstream runtime action off this
   evidence.
3. After this evidence PR is reviewed/merged, create a **separate docs-only auth-failure
   classification plan** deciding whether a **safe allowlisted classifier** can inspect
   **only non-secret PostgreSQL/psql error-category fields** (e.g. an `auth_or_credential`
   vs `ssl_or_pg_hba` vs `role_or_database` category, no raw text) — or whether the next
   path should be **credential/custody correction** — each separately reviewed and
   GO-gated.
4. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, bearer
token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or customer data. The auth preflight handled the runner source via
an **invocation-scoped secret temp service file** that was **removed**
(`secret_temp_service_file_used=true`, `secret_temp_service_file_removed=true`); the secret
value was **never printed/parsed** (`secret_value_printed=false`,
`secret_value_parsed=false`), **not in argv** (`dsn_in_argv=false`), and **no**
`.env.production` value was read; the auth/psql gate's **raw output was withheld and
chmod-600** (`raw_auth_output_withheld=true`, `raw_auth_output_chmod_600=true`), so the
**exact failure reason is not exposed or recorded**. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or recorded.")
All values above are safe labels / booleans / category tokens / non-secret path & name
identifiers / public git commit hashes — not secret or row values.
