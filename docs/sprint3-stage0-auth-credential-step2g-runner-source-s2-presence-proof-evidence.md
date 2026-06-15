# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source S2 Presence Proof — Evidence (PRESENT)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_PRESENCE_PROOF_PRESENT`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE S2 PRESENCE PROOF GO`, the operator
ran the presence proof for the S2 custody source — checking **only file existence,
ownership, permissions, and key-name presence** for `/etc/buyerrecon/stage0-runner.env`.
The file exists, is owned/permissioned as expected, and the key name `STAGE0_RUNNER_DSN`
is present → `s2_presence_proof_result=present`, `stop_line=none`.

**This proves key-name/file/permission presence only — it does NOT prove the DSN value
is non-empty/correct/parseable, does NOT prove PostgreSQL authentication or credential
validity, is NOT a runtime binding or Option A/B selection, and does NOT prove
remediation or Stage 0 readiness.** This PR records safe **booleans/category tokens /
non-secret path & name identifiers / public commit hashes only** — no secret value, DSN,
password, token, host, port, IP, URI, `.env.production` content, raw SQL/error text, or
raw data.

> Provenance: PR #246 Step 2G runner-source S2 creation applied evidence
> (`7d71f309525a30cfe28e464c9697579c0daa4ecd`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_CREATION_APPLIED_KEY_PRESENT_VALUE_UNVERIFIED`);
> PR #245 S2 command-pack plan (`dc5a6cfcc4227d2fb03df72b82dd4507bbbe7f6d`); PR #244
> runner-source creation/custody plan (`3d0908fe72b7e69602e4d5d84058891a15b1188c`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2G RUNNER SOURCE S2 PRESENCE PROOF GO` — one
  presence proof: **file existence / ownership / permissions / key-name presence only**;
  value never read/printed/parsed; no DB connection; no secrets.
- This did **not** authorize an Option A/B decision, a runtime binding, a source-selection
  change, a Step 2E rerun, an authentication/psql gate, remediation, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual S2 presence proof)

```text
s2_presence_proof_attempted=true
custody_file_path=/etc/buyerrecon/stage0-runner.env
secret_value_printed=false
secret_value_read=false
secret_value_parsed=false
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
custody_file_exists=true
custody_owner_ok=true
custody_permissions_ok=true
stage0_runner_dsn_key_present=true
s2_presence_proof_result=present
stop_line=none
s2_presence_proof_completed=true
```

---

## 3. Interpretation (bounded)

- The **S2 presence proof completed** (`s2_presence_proof_attempted=true`,
  `s2_presence_proof_completed=true`) against the custody file path
  `/etc/buyerrecon/stage0-runner.env`.
- **The S2 file-based custody source exists** (`custody_file_exists=true`), is **owned by
  the expected owner** (`custody_owner_ok=true`) with **expected restrictive permissions**
  (`custody_permissions_ok=true`), and the **key name `STAGE0_RUNNER_DSN` is present**
  (`stage0_runner_dsn_key_present=true`).
- **No secret value was read, printed, parsed, validated, transformed, or exposed**
  (`secret_value_read=false`, `secret_value_printed=false`, `secret_value_parsed=false`,
  `dsn_parsing_performed=false`); **no** `.env.production` value read
  (`env_production_values_read=false`); no DB connection
  (`db_connection_attempted=false`); no psql/SQL (`psql_sql_invoked=false`).
- **Nothing was changed or executed:** no env mutation (`env_mutated=false`), no runtime
  binding (`runner_dsn_bound=false`), no source-selection change
  (`source_selection_changed=false`), no Option A/B selection (`option_a_selected=false`,
  `option_b_selected=false`), no Step 2E (`step2e_rerun=false`), no Stage 0
  (`stage0_executed=false`), no run-lock touch (`run_lock_touched=false`).
- **Result:** `present`, `stop_line=none`.
- **Bounded conclusion — this proves key-name/file/permission presence only.** It does
  **not** prove the DSN value is non-empty; does **not** prove the DSN value is correct;
  does **not** prove the DSN value is parseable; does **not** prove PostgreSQL
  authentication; does **not** prove credential validity; does **not** prove runtime
  binding; does **not** prove remediation; does **not** prove Stage 0 readiness.

This confirms the PR #246 creation artifact is **durably present and correctly
guarded** (exists, expected owner, restrictive permissions, key name present). Whether
the value authenticates remains a **separate, later, GO-gated** question — to be
approached only after Option A/B decision planning, and any authentication/psql gate
separately planned/reviewed/GO-gated (the value is **unverified by design**).

---

## 4. What Did Not Happen

- No proof the DSN value is non-empty/correct/parseable/authenticating.
- No Option A/B selection; no runtime binding; no runner DSN binding; no source-selection
  change.
- No secret value read/print/parse; no `.env.production` value read or printed.
- No DSN parsing; no host/port/IP/user/password/URI/component output.
- No DB connection; no psql/SQL.
- No env mutation; no password reset/rotation.
- No Step 2E rerun; no authentication/psql gate; no other proof in this PR.
- No Stage 0 execution; no `npm run stage0:run`.
- No run-lock touch.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network
  detail recorded.

---

## 5. Verdict

- **PRESENT — Step 2G runner-source S2 presence proof is
  `s2_presence_proof_result=present`, `stop_line=none`**: the S2 custody file exists, is
  owned/permissioned as expected, and the `STAGE0_RUNNER_DSN` key name is present; no
  secret value read/printed/parsed; no DB connection; nothing changed or executed.
- This is **not** a value-validity / credential / PostgreSQL-authentication proof,
  **not** a runtime binding, **not** an Option A/B selection, **not** remediation, and
  **not** a Stage 0 readiness proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run a Step 2E rerun, Stage 0, an Option A/B decision, a runtime binding, a
   source-selection change, or an authentication/psql gate off this evidence.
3. After this evidence PR is reviewed/merged, proceed to **docs-only Option A/B decision
   planning**:
   - **Option A:** runtime command-pack binding using the existing S2 custody source as
     the Stage 0 process source;
   - **Option B:** code-level source-selection change so Stage 0 reads `STAGE0_RUNNER_DSN`
     directly.
4. **Any authentication / psql gate remains separately planned, reviewed, and GO-gated**
   because the secret value remains **unverified by design**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
secret, raw secret-manager payload, `.env.production` content/value, bearer token,
AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address, hostname,
port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or customer data. The presence proof checked **file existence /
ownership / permissions / key-name presence only** — it **read/printed/parsed no secret
value** (`secret_value_read=false`, `secret_value_printed=false`,
`secret_value_parsed=false`, `dsn_parsing_performed=false`), read **no** `.env.production`
value, made **no** DB connection, and emitted **only** safe booleans / category tokens.
The custody **file path** (`/etc/buyerrecon/stage0-runner.env`) and **key name**
(`STAGE0_RUNNER_DSN`) are non-secret identifiers, not values; the value remains
**unverified by design**. (Per the PR #218 Codex note: "no secret used or exposed" is to
be read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / category tokens / non-secret path & name identifiers / public git
commit hashes — not secret or row values.
