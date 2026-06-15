# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source S2 Creation — Evidence (APPLIED: key present, value unverified by design)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_CREATION_APPLIED_KEY_PRESENT_VALUE_UNVERIFIED`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE S2 CREATION GO`, the operator ran
the PR #245 S2 controlled-server-side source-creation command-pack at
`/opt/buyerrecon-backend`. It **created a file-based custody source** at the custody
file path `/etc/buyerrecon/stage0-runner.env` containing the key name
`STAGE0_RUNNER_DSN`, owned `root:root` with `600` permissions — **with the secret value
intentionally never printed, read back, parsed, validated, transformed, or exposed** →
`s2_source_creation_result=created`, `stage0_runner_dsn_key_present=true`.

**This proves the S2 custody source was created and the key name is present — it does
NOT prove the value is non-empty/correct/parseable/able to authenticate, is NOT a
runtime binding, is NOT an Option A/B selection, and does NOT prove credential validity,
PostgreSQL authentication, the raw PostgreSQL error, remediation, or Stage 0 readiness.**
This PR records safe **booleans/category tokens / non-secret path & name identifiers /
public commit hashes only** — no secret value, DSN, password, token, host, port, IP,
URI, `.env.production` content, raw SQL/error text, or raw data.

> Provenance: PR #245 Step 2G runner-source S2 command-pack plan
> (`dc5a6cfcc4227d2fb03df72b82dd4507bbbe7f6d`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_COMMAND_PACK_PLANNING_ONLY`); PR #244
> runner-source creation/custody plan (`3d0908fe72b7e69602e4d5d84058891a15b1188c`); PR
> #241 Option 2 env-name missing (`1c885d0e65e98cbb6f6a8f4628b82660fac6e115`); PR #239
> Option C proof rerun inconclusive (`05c81f3e77e3b865935c2618f1f811955813f610`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE S2 CREATION GO` — exactly **one**
  PR #245 S2 controlled-server-side source-creation; hidden input only; secret never
  printed/read/parsed/logged/stored-in-repo; post-creation **env-name presence only**;
  no runtime binding; no Step 2E / Stage 0.
- This did **not** authorize a runtime binding, source-selection change, Option A/B
  selection, a Step 2E rerun, remediation, another proof, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels — Creation Command

```text
s2_source_creation_attempted=true
target_source_name=STAGE0_RUNNER_DSN
target_role_category=buyerrecon_stage0_runner
target_database=buyerrecon_production
source_bound=false
runner_dsn_bound=false
source_selection_changed=false
option_a_selected=false
option_b_selected=false
db_connection_attempted=false
psql_sql_invoked=false
step2e_rerun=false
stage0_executed=false
run_lock_touched=false
runtime_downstream_action=false
env_production_values_read=false
secret_value_printed=false
secret_value_logged=false
secret_value_parsed=false
dsn_parsing_performed=false
host_port_ip_printed=false
expected_path_ok=true
expected_branch_ok=true
working_tree_clean=true
custody_location_checked=true
overwrite_risk_detected=false
hidden_input_used=true
custody_owner_ok=true
custody_permissions_ok=true
post_creation_env_name_presence=true
source_created=true
s2_source_creation_result=created
stop_line=none
raw_value_printed=false
s2_source_creation_completed=true
```

## 2.1 Safe Labels — Follow-up Status Check

```text
s2_source_creation_status_check_attempted=true
secret_value_printed=false
secret_value_read=false
dsn_parsing_performed=false
db_connection_attempted=false
psql_sql_invoked=false
stage0_executed=false
custody_file_exists=true
custody_owner_ok=true
custody_permissions_ok=true
stage0_runner_dsn_key_present=true
status_check_completed=true
```

---

## 3. Interpretation (bounded)

- The **S2 creation command completed** (`s2_source_creation_attempted=true`,
  `s2_source_creation_completed=true`) and **created a file-based custody source** at the
  custody file path `/etc/buyerrecon/stage0-runner.env`
  (`source_created=true`, `s2_source_creation_result=created`, `stop_line=none`).
- **Custody controls in place:** the source is owned `root:root` with `600` permissions
  (`custody_owner_ok=true`, `custody_permissions_ok=true`), the custody location was
  checked (`custody_location_checked=true`), and **no overwrite risk** was detected
  (`overwrite_risk_detected=false`).
- The **key name `STAGE0_RUNNER_DSN` is present** (`post_creation_env_name_presence=true`;
  follow-up status check `custody_file_exists=true`, `stage0_runner_dsn_key_present=true`).
- The **secret value was handled via hidden input only** (`hidden_input_used=true`) and
  was **never printed, logged, read back, parsed, or validated**
  (`secret_value_printed=false`, `secret_value_logged=false`, `secret_value_parsed=false`,
  `secret_value_read=false`, `dsn_parsing_performed=false`,
  `host_port_ip_printed=false`, `raw_value_printed=false`); **no** `.env.production`
  value read (`env_production_values_read=false`).
- **Nothing was bound or executed beyond creating the isolated custody source:** no
  runtime/source binding (`source_bound=false`, `runner_dsn_bound=false`), no
  source-selection change (`source_selection_changed=false`), no Option A/B selection
  (`option_a_selected=false`, `option_b_selected=false`), no DB connection
  (`db_connection_attempted=false`), no psql/SQL (`psql_sql_invoked=false`), no Step 2E
  (`step2e_rerun=false`), no Stage 0 (`stage0_executed=false`), no run-lock touch
  (`run_lock_touched=false`).
- **Because the value was intentionally not read or validated, this evidence does NOT
  prove the value is non-empty, correct, parseable, or able to authenticate.**
- **Safe conclusion:** the S2 custody source is **created and the key name is present**;
  the **secret value remains unverified by design**.
- It:
  - proves **no** credential validity;
  - proves **no** PostgreSQL authentication;
  - proves **no** exact raw PostgreSQL error;
  - proves **no** runtime binding;
  - makes **no** Option A/B selection;
  - proves **no** remediation;
  - proves **no** Stage 0 readiness, and is **not** a Stage 0 execution.

This is the first Step 2G action that **created state** — an isolated, root-owned,
`600`-permission custody file holding the `STAGE0_RUNNER_DSN` key. Whether that key's
value authenticates is a **separate, later, GO-gated** question (a future env-name/key
presence proof, then Option A/B decision planning, then any authentication/psql gate).

---

## 4. What Did Not Happen

- No proof the secret value is non-empty/correct/parseable/authenticating.
- No runtime binding; no runner DSN binding; no source-selection change.
- No Option A/B selection.
- No secret value print/read; no secret value logged/parsed.
- No DSN parsing; no host/port/IP/user/password/URI/component output.
- No `.env.production` value read or printed.
- No DB connection; no psql/SQL.
- No env mutation beyond creating the isolated custody source.
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

- **APPLIED (key present, value unverified by design) — Step 2G runner-source S2 creation
  is `s2_source_creation_result=created`, `stop_line=none`**: an isolated file-based
  custody source was created (`root:root`, `600`) holding the `STAGE0_RUNNER_DSN` key
  (present), via hidden input only, with the secret value never printed/read/parsed/
  validated; no DB connection; no binding; nothing executed beyond the custody-source
  creation.
- This is **not** a value-validity / credential / PostgreSQL-authentication proof,
  **not** a runtime binding, **not** an Option A/B selection, **not** remediation, and
  **not** a Stage 0 readiness proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run a Step 2E rerun, Stage 0, an Option A/B selection, a runtime binding, a
   source-selection change, or another proof off this evidence.
3. After this evidence PR is reviewed/merged, perform a **separately reviewed and
   separately GO-gated env-name / key-name presence proof only** (presence/existence
   only; value never read).
4. **Do not** run Step 2E or Stage 0 until later **Option A/B decision planning** and a
   separate GO. Because the secret value remains **unverified by design**, any future
   authentication / psql gate must be **separately planned, reviewed, and GO-gated**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
secret, raw secret-manager payload, `.env.production` content/value, bearer token,
AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address, hostname,
port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or customer data. The S2 creation handled the secret value **via
hidden input only** and **never** printed/read/parsed/logged it
(`secret_value_printed=false`, `secret_value_read=false`, `secret_value_logged=false`,
`secret_value_parsed=false`, `raw_value_printed=false`); post-creation verification was
**env-name presence only** (`stage0_runner_dsn_key_present=true`), so the value remains
**unverified by design**. The custody **file path** (`/etc/buyerrecon/stage0-runner.env`),
**source name** (`STAGE0_RUNNER_DSN`), **role category** (`buyerrecon_stage0_runner`),
and **database** (`buyerrecon_production`) are non-secret identifiers, not values. (Per
the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret path & name identifiers / public git commit hashes — not secret or
row values.
