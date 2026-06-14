# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source Custody Option 2 — Evidence (env name MISSING in controlled shell)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_OPTION2_ENV_NAME_MISSING`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE CUSTODY OPTION 2 GO`, the operator
ran the PR #240 **Option 2** check (env-name presence in a controlled shell,
safe-label-only) at `/opt/buyerrecon-backend`. The check **completed safely** and found
that **`STAGE0_RUNNER_DSN` was not present by name** in the controlled shell →
`custody_resolution_result=runner_source_missing`,
`stop_line=stage0_runner_dsn_env_name_not_present_in_controlled_shell`.

**This proves only Option 2 shell-presence absence — it does NOT prove global absence
across all custody systems / deployment metadata / secret manager / other runtime
injection paths, does NOT select Option A or Option B, and does NOT prove credential
validity, PostgreSQL authentication, the raw PostgreSQL error, remediation, or Stage 0
readiness.** This PR records safe **booleans/category tokens / public commit hashes
only** — no secrets, DSN, password, token, host, port, IP, URI, `.env.production`
content, raw SQL/error text, host/network details, or raw data.

> Provenance: PR #240 Step 2G runner-source custody resolution plan
> (`228a827d375eba6de81afb75beafd93dba6c4d4e`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_RESOLUTION_PLANNING_ONLY`); PR
> #239 Option C proof rerun inconclusive
> (`05c81f3e77e3b865935c2618f1f811955813f610`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `runner_binding_documented_but_not_proven_present`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE CUSTODY OPTION 2 GO` — one
  safe-label-only Option 2 env-name presence check in the controlled shell; name/presence
  only; **no** value read/print; no DSN parsing; no DB connection; no secrets.
- This did **not** authorize Option A/B selection, Option 3, source-creation/binding, a
  Step 2E rerun, remediation, another proof, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Option 2 check)

```text
custody_resolution_attempted=true
custody_resolution_option=option_2_env_name_presence_controlled_shell
approved_runner_source_presence_target=STAGE0_RUNNER_DSN
raw_value_printed=false
raw_value_read=false
dsn_parsing_performed=false
env_production_values_read=false
db_connection_attempted=false
psql_sql_invoked=false
env_mutated=false
runner_dsn_bound=false
source_selection_changed=false
option_a_selected=false
option_b_selected=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
runtime_downstream_action=false
approved_runner_source_present=false
approved_runner_source_category=missing
custody_resolution_result=runner_source_missing
stop_line=stage0_runner_dsn_env_name_not_present_in_controlled_shell
custody_resolution_completed=true
```

---

## 3. Interpretation (bounded)

- The **Option 2 custody check completed safely** (`custody_resolution_attempted=true`,
  `custody_resolution_completed=true`) under
  `custody_resolution_option=option_2_env_name_presence_controlled_shell`, targeting
  `approved_runner_source_presence_target=STAGE0_RUNNER_DSN`.
- **`STAGE0_RUNNER_DSN` was not present by name** in the controlled shell:
  `approved_runner_source_present=false`, `approved_runner_source_category=missing`,
  `custody_resolution_result=runner_source_missing`,
  `stop_line=stage0_runner_dsn_env_name_not_present_in_controlled_shell`.
- **No value was read, printed, parsed, transformed, validated, or inspected**
  (`raw_value_read=false`, `raw_value_printed=false`, `dsn_parsing_performed=false`,
  `env_production_values_read=false`); no DB connection
  (`db_connection_attempted=false`); no psql/SQL (`psql_sql_invoked=false`).
- **Scope of this finding (precise):** this proves **only Option 2 shell-presence
  absence** — that the `STAGE0_RUNNER_DSN` env name is not defined in the controlled
  shell tested. It:
  - does **not** prove **global absence** across all custody systems, deployment
    metadata, secret manager, or other runtime injection paths;
  - does **not** select Option A or Option B (`option_a_selected=false`,
    `option_b_selected=false`);
  - does **not** prove credential validity, PostgreSQL authentication, the exact raw
    PostgreSQL error, remediation, or Stage 0 readiness.
- **Nothing was changed or executed:** `env_mutated=false`, `runner_dsn_bound=false`,
  `source_selection_changed=false`, `stage0_executed=false`, `step2e_rerun=false`,
  `run_lock_touched=false`, `runtime_downstream_action=false`.

This is consistent with the PR #239 structural picture (the worker effective source is
the app/collector category, `DATABASE_URL`) and now adds one concrete custody fact: in
the controlled shell, the dedicated `STAGE0_RUNNER_DSN` name is **not** present. Whether
an approved runner source exists via **another** custody path (Option 3 deployment /
secret-manager metadata) is **still open** and must be separately determined before any
source-creation or Option A/B decision.

---

## 4. What Did Not Happen

- No global-absence claim across custody systems / deployment metadata / secret manager
  / other injection paths.
- No Option A/B selection; no Option 3 run; no source-creation/binding.
- No `.env.production` value read or printed.
- No DSN parsing; no host/port/IP/user/password/URI/component output.
- No DB connection; no psql/SQL.
- No env mutation; no runner DSN binding; no source-selection change.
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

- **MISSING (Option 2 shell-presence) — Step 2G runner-source custody Option 2 is
  `custody_resolution_result=runner_source_missing`,
  `stop_line=stage0_runner_dsn_env_name_not_present_in_controlled_shell`**: the
  `STAGE0_RUNNER_DSN` env name is not present by name in the controlled shell; no value
  read/printed/parsed; no DB connection; nothing changed or executed.
- This is **not** a global-absence proof, **not** an Option A/B selection, **not** a
  credential/auth/exact-raw-error proof, **not** remediation, and **not** a Stage 0
  readiness proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** select Option A/B, run a Step 2E rerun, run Stage 0, perform remediation,
   bind a runner DSN, change source-selection, or run another proof off this evidence.
3. After this evidence PR is reviewed/merged, choose whether to:
   - **(a)** run the **Option 3 deployment / secret-manager metadata** check (if
     available) — secret-safe, existence-metadata only, separately GO-gated; **or**
   - **(b)** plan **source-creation / custody** if no approved custody path exists —
     separately reviewed and GO-gated.
4. **Do not select Option A/B** until approved runner-source presence is **proven** or
   **global absence is explicitly established by reviewed evidence**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. The Option 2 check tested
**env-var name presence only** in the controlled shell — it **read/printed/parsed no
value** (`raw_value_read=false`, `raw_value_printed=false`,
`dsn_parsing_performed=false`), read **no** `.env.production` value, made **no** DB
connection, and emitted **only** safe booleans / category tokens. The
`runner_source_missing` result is an **Option 2 shell-presence** finding, **not** a
global-absence claim. (Per the PR #218 Codex note: "no secret used or exposed" is to be
read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / category tokens / env-var names / role / database names / public git
commit hashes — not secret or row values.
