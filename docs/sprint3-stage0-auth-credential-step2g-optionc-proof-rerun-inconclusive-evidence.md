# Sprint 3 — Stage 0 auth/credential Step 2G Option C — Proof Rerun — Evidence (INCONCLUSIVE: runner-source presence not provable without runtime custody source)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_PROOF_RERUN_INCONCLUSIVE_RUNNER_SOURCE_PRESENCE_NOT_PROVABLE`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2G OPTION C PROOF RERUN GO`, the operator re-ran the
Option C non-secret connection-source category proof (safe-label-only) using the merged
PR #232 command-pack, after PR #238 confirmed repo-state readiness
(`ready_for_fresh_go`). The proof **completed safely** but **could not prove approved
runner-source presence** without a runtime custody/source check →
`option_c_result=inconclusive`,
`stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source`.

**This is a bounded non-secret classification result — it does NOT make an approved
runner-source presence/absence finding, does NOT make a category finding, does NOT
select Option A or Option B, and does NOT prove credential validity, PostgreSQL
authentication, the raw PostgreSQL error, remediation, or Stage 0 readiness.** This PR
records safe **booleans/category tokens / public commit hashes only** — no secrets, DSN,
password, token, host, port, IP, URI, `.env.production` content, raw SQL/error text,
host/network details, or raw data.

> Provenance: PR #238 Step 2G Option C rerun repo-sync preflight ready evidence
> (`3921800fafa05de2df5560d9f988f2aedd84b7fe`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_RERUN_REPO_SYNC_PREFLIGHT_READY_FOR_FRESH_GO`);
> PR #237 checkout fast-forward applied (`21f4d5b628ff8a1933a32480c51b72092704d780`); PR
> #233 first Option C proof inconclusive (`937f9db16cfd63faaf70380d7d2b309e396236a2`);
> PR #232 Option C proof command-pack plan (merged GitHub,
> `5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `runner_binding_documented_but_not_proven_present`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2G OPTION C PROOF RERUN GO` — one
  safe-label-only Option C proof rerun via the merged PR #232 command-pack; non-secret
  classification only; raw output withheld; no DB connection; no secrets.
- This did **not** authorize Option A/B selection, a Step 2E rerun, remediation, another
  proof, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Option C proof rerun)

```text
option_c_proof_attempted=true
proof_scope=stage0_step2g_option_c_connection_source_category
proof_basis=env_var_name_source_selection_path_presence_booleans_tracked_code_docs_only
db_connection_attempted=false
psql_sql_invoked=false
raw_value_printed=false
env_mutated=false
code_changed=false
stage0_executed=false
run_lock_touched=false
step2e_rerun=false
runtime_downstream_action=false
dsn_contents_parsed=false
env_production_values_read=false
source_values_printed=false
host_port_ip_printed=false
runner_dsn_bound=false
source_selection_changed=false
option_c_command_pack_plan_present=true
approved_runner_source_present=unknown
approved_runner_source_category=unknown
stage0_runner_env_name_documented=true
runtime_default_source_category=database_url
stage0_worker_effective_source_category=app_or_collector
extract_stage0_inputs_direct_env_reads=false
option_c_result=inconclusive
stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source
raw_value_access_required=false
option_c_proof_completed=true
```

---

## 3. Interpretation (bounded)

- The **Option C proof rerun completed safely** (`option_c_proof_attempted=true`,
  `option_c_proof_completed=true`) under scope
  `proof_scope=stage0_step2g_option_c_connection_source_category`, with
  `proof_basis=env_var_name_source_selection_path_presence_booleans_tracked_code_docs_only`,
  and the PR #232 command-pack present
  (`option_c_command_pack_plan_present=true`).
- **What it confirmed (non-secret, structural):**
  - the **runner env name is documented** (`stage0_runner_env_name_documented=true`);
  - the tracked **runtime default source category is `database_url`**
    (`runtime_default_source_category=database_url`);
  - the tracked **Stage 0 worker effective source category is `app_or_collector`**
    (`stage0_worker_effective_source_category=app_or_collector`);
  - **`extract-stage0-inputs.ts` does not directly read env**
    (`extract_stage0_inputs_direct_env_reads=false`) — it receives its pool from
    caller-side source selection.
- **What it could not prove:** whether an **approved runner source is present**
  (`approved_runner_source_present=unknown`,
  `approved_runner_source_category=unknown`) — this cannot be established **without a
  runtime custody/source check**, which is **out of scope** for a non-secret
  classification. Hence `option_c_result=inconclusive`,
  `stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source`.
- **No raw-value access was required or taken**
  (`raw_value_access_required=false`, `raw_value_printed=false`): no DSN parsing
  (`dsn_contents_parsed=false`), no `.env.production` value read
  (`env_production_values_read=false`), no source values printed
  (`source_values_printed=false`), no host/port/IP printed
  (`host_port_ip_printed=false`); no DB connection (`db_connection_attempted=false`);
  no psql/SQL (`psql_sql_invoked=false`).
- **Nothing was changed or executed:** `env_mutated=false`, `code_changed=false`,
  `runner_dsn_bound=false`, `source_selection_changed=false`, `stage0_executed=false`,
  `run_lock_touched=false`, `step2e_rerun=false`, `runtime_downstream_action=false`.
- This is a **bounded non-secret classification result.** It:
  - makes **no** approved runner-source presence/absence finding;
  - makes **no** approved runner-source category finding;
  - makes **no** Option A/B selection;
  - proves **no** credential validity;
  - proves **no** PostgreSQL authentication;
  - proves **no** exact raw PostgreSQL error;
  - proves **no** remediation;
  - proves **no** Stage 0 readiness, and is **not** a Stage 0 execution.

The structural side is consistent with the PR #228/#229 picture (the tracked worker
path classifies as the app/collector category, `DATABASE_URL`), but the **decisive**
question — does an **approved runner source actually exist** to bind to — is **not
provable by non-secret classification alone**; it needs a separate **secret-safe custody
/ source-presence** mechanism. **Option A vs Option B must not be chosen** until
runner-source presence is proven or explicitly ruled out.

---

## 4. What Did Not Happen

- No approved runner-source presence/absence finding; no category finding (both
  `unknown`).
- No Option A/B selection.
- No DB connection; no psql/SQL.
- No `.env.production` value read or printed; no DSN parsing; no source values printed;
  no host/port/IP printed.
- No raw DSN / password / token / host / port / IP / URI output.
- No env mutation; no runner DSN binding; no code/source-selection change.
- No password reset/rotation.
- No Step 2E rerun; no other proof in this PR.
- No Stage 0 execution; no `npm run stage0:run`.
- No run-lock touch.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network
  detail recorded.

---

## 5. Verdict

- **INCONCLUSIVE — Step 2G Option C proof rerun is `option_c_result=inconclusive`,
  `stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source`**:
  the proof completed safely and confirmed the documented runner env name plus the
  tracked `database_url` / `app_or_collector` worker source-selection classification
  (and that `extract-stage0-inputs.ts` reads no env directly), but **could not prove
  approved runner-source presence** without a runtime custody/source check; no
  secret/raw value exposed; nothing connected, changed, or executed.
- This is **not** a runner-source presence/absence proof, **not** a category finding,
  **not** an Option A/B selection, **not** a credential/auth/exact-raw-error proof,
  **not** remediation, and **not** a Stage 0 readiness proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run a Step 2E rerun, Stage 0, remediation, or another proof off this
   evidence; **do not** choose Option A or Option B yet.
3. Create a **docs-only custody / source-presence resolution plan** to determine whether
   an approved `STAGE0_RUNNER_DSN` source exists through a **secret-safe custody
   mechanism** — **without** printing values, parsing DSNs, connecting to the DB, or
   changing runtime binding — then Codex review and a fresh explicit Helen GO.
4. **Do not choose Option A (command-pack runtime binding) or Option B (code-level
   source selection)** until runner-source presence is **proven or explicitly ruled
   out**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. The proof classified **by
env-var name / source-selection path / presence booleans / tracked code-docs contract
references only** — it **parsed no DSN contents** (`dsn_contents_parsed=false`), read
**no** `.env.production` value (`env_production_values_read=false`), printed **no** source
value / host / port / IP, made **no** DB connection, and required **no** raw-value access
(`raw_value_access_required=false`); where presence could not be classified without raw
values it **failed closed to `inconclusive`** rather than reading/printing. (Per the PR
#218 Codex note: "no secret used or exposed" is to be read as "no secret value exposed,
printed, or recorded.") All values above are safe labels / booleans / category tokens /
env-var names / role / database names / public git commit hashes — not secret or row
values.
