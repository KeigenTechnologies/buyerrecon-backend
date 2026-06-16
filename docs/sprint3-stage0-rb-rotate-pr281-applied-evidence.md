# Sprint 3 — Stage 0 — PR #281-Aware PR #270-Aligned RB-ROTATE — Evidence (APPLIED)

**Status:** `STAGE0_RB_ROTATE_PR281_APPLIED_CREDENTIAL_ROTATED_AND_CUSTODY_CORRECTED`

This is a **docs-only evidence record**. Under the GO `HELEN PR281-AWARE RB-ROTATE EXECUTION
GO`, the operator ran the SHA-verified PR #281-aware RB-ROTATE operator script
(`/tmp/buyerrecon-rb-rotate-pr281-operator.sh`, expected SHA-256
`a33c6761d99c4d875499fbb5bd07624c133db5a1a92e3aecb330521bfbb5529a`) on production as a single
RB-ROTATE retry. The run **succeeded**: Phase 0 passed (all nine merges contained), the PR
#281 §6.2 derivation-axis registry gate passed, the corrected complete `STAGE0_RUNNER_DSN` was
**derived locally without printing**, the operator entered the exact token `RB-ROTATE`, only
`buyerrecon_stage0_runner` was rotated, and the corrected custody value was written to
`/etc/buyerrecon/stage0-runner.env` (key `STAGE0_RUNNER_DSN`, root:root, chmod 600).
`execution_result=applied`, `stop_line=none`.

**This evidence proves a successful RB-ROTATE credential rotation + corrected custody write —
it does NOT prove live authentication, does NOT authorize Stage 0, and is NOT a Stage 0
readiness proof.** This PR records safe **booleans/category tokens / public commit hashes
only** — no raw DSN, host, port, username, password, database URL, `.env.production` value,
connection string, custody contents, psql output, or typed confirmation value.

> Provenance: PR #281 source-of-truth derivation activation
> (`1d69ff3a41ee1e47cc41326667a1c342cde614c5`,
> `PRODUCTION_PARAMETER_REGISTRY_STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_ACTIVATION_ONLY`); PR #280
> verified-active candidate (`3b010d731b0abb92806c3a105b428b481b39c94c`); PR #279 host/port
> provenance (`c96bbc7b51a0284ca2c23059de4ccf36f752a8e6`); PR #272 corrected RB-ROTATE
> command-pack plan (`0e36a7f848db4cf13cb16f8f3a44122560fccc75`); PR #270 simple-token plan
> (`9f437c04a51fbb7a94ccde9a55d18006ea29616e`).

---

## 1. Authorization & Pre-Run Verification

- GO: `HELEN PR281-AWARE RB-ROTATE EXECUTION GO` — exactly one PR #281-aware, PR #270-aligned
  Route B RB-ROTATE retry.
- The script was transferred by **raw file transfer** and verified before running
  (`sha256_match=true` against `a33c6761…`, `syntax_check=pass`).
- The operator ran the action manually on the production host as root. Claude Code did not
  execute anything.
- This did **not** authorize, and the run did **not** perform, a psql/auth rerun, an Option A
  preflight rerun, Step 2E, or Stage 0.

---

## 2. Safe Labels (from the actual RB-ROTATE run)

```text
expected_path_ok=true
expected_branch_ok=true
working_tree_clean_before=true
remote_fetch_attempted=true
remote_fetch_result=success
fast_forward_to_current_tip_applied=true
working_tree_clean=true
head_contains_pr270_merge=true
head_contains_pr271_merge=true
head_contains_pr272_merge=true
head_contains_pr275_merge=true
head_contains_pr276_merge=true
head_contains_pr277_merge=true
head_contains_pr279_merge=true
head_contains_pr280_merge=true
head_contains_pr281_merge=true
parameter_registry_doc_present=true
parameter_registry_block_present=true
rb_rotate_derivation_gate_passed=true
source_of_truth_derivation_verified_active=true
complete_stage0_runner_dsn_shape_derivable=true
operator_guess_required=false
broken_custody_used_as_source=false
raw_values_printed=false
non_secret_custody_write_preflight_attempted=true
non_secret_custody_write_preflight_passed=true
secret_input_hidden=true
password_reentry_match=true
corrected_dsn_derived_locally=true
corrected_dsn_printed=false
operator_confirmation_passed=true
operator_confirmation_exact_match=true
operator_confirmation_length_matches=true
operator_confirmation_token_source=pr270_rb_rotate
target_role=buyerrecon_stage0_runner
only_target_role_altered=true
grant_schema_data_change=false
db_rotation_attempted=true
db_rotation_applied=true
raw_psql_output_printed=false
custody_write_attempted=true
custody_written=true
custody_file_exists=true
custody_file_owner_root=true
custody_file_chmod_600=true
custody_key_present=true
db_custody_in_sync=true
secret_cleared=true
execution_result=applied
stop_line=none
execution_completed=true
```

---

## 3. Interpretation (bounded)

### 3.1 Phase 0 — repo / base / merge containment (passed)
Expected path/branch; clean tree before and after; remote fetch success; current-tip
fast-forward applied; HEAD contains **all nine** required merges (PR
#270/#271/#272/#275/#276/#277/#279/#280/#281).

### 3.2 Registry gate — PR #281 §6.2 derivation axis (passed)
The registry doc and `buyerrecon-production-parameter-registry-v1` block are present; the
**derivation-axis** gate passed (`rb_rotate_derivation_gate_passed=true`,
`source_of_truth_derivation_verified_active=true`,
`complete_stage0_runner_dsn_shape_derivable=true`, `operator_guess_required=false`,
`broken_custody_used_as_source=false`) — i.e. the corrected complete DSN was derivable from
approved sources **without guessing**, and the (then-blocked) current custody value did **not**
block RB-ROTATE.

### 3.3 Secret-safe derivation + confirmation
The corrected DSN was **derived locally and not printed** (`corrected_dsn_derived_locally=true`,
`corrected_dsn_printed=false`, `raw_values_printed=false`); hidden password input with re-entry
match (`secret_input_hidden=true`, `password_reentry_match=true`); operator confirmation passed
with the **exact** PR #270 token (`operator_confirmation_passed=true`,
`operator_confirmation_exact_match=true`, `operator_confirmation_length_matches=true`,
`operator_confirmation_token_source=pr270_rb_rotate`).

### 3.4 Scoped rotation + corrected custody write (applied)
- **Only** `buyerrecon_stage0_runner` was altered (`target_role=buyerrecon_stage0_runner`,
  `only_target_role_altered=true`); **no** grant/schema/data change
  (`grant_schema_data_change=false`); raw psql output withheld (`raw_psql_output_printed=false`).
- DB rotation **attempted and applied** (`db_rotation_attempted=true`,
  `db_rotation_applied=true`).
- After the non-secret custody-write preflight passed, the corrected custody value was
  **written** (`custody_write_attempted=true`, `custody_written=true`); the custody file
  **exists**, is **root-owned**, **chmod 600**, and **contains the required key**
  (`custody_file_exists=true`, `custody_file_owner_root=true`, `custody_file_chmod_600=true`,
  `custody_key_present=true`).
- DB and custody recorded **in sync** by the script (`db_custody_in_sync=true`); secrets
  cleared (`secret_cleared=true`).
- `execution_result=applied`, `stop_line=none`, `execution_completed=true`.

### 3.5 Bounded conclusion
- RB-ROTATE **succeeded**: the runner credential was rotated and the corrected custody value
  was written, secret-safely (no raw values printed; only the runner role altered).
- This **does not** prove **live authentication** — no psql/auth attempt was made in this run.
- It **does not** authorize Stage 0 and is **not** a Stage 0 readiness proof.
- `db_custody_in_sync=true` reflects that both the rotation and the corrected custody write
  completed in the same controlled chain — **not** an authentication test.

---

## 4. What Did Not Happen

- No further RB-ROTATE retry (this records the single authorized run).
- No psql/auth rerun; no Option A preflight rerun; **no live-auth test**.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes (no DML/DDL beyond the scoped `ALTER ROLE`).
- No other role altered.
- No source-selection change; no Option B code change; no remediation.
- No downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E; no Gate 4F.
- No raw DSN, host, port, username, password, database URL, `.env.production` value, raw
  connection string, custody contents, psql raw output, customer/payload data, or typed
  confirmation value printed.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 5. Verdict

- **APPLIED — PR #281-aware RB-ROTATE is `execution_result=applied`, `stop_line=none`**:
  Phase 0 + the PR #281 §6.2 derivation gate passed; the corrected DSN was derived locally
  without printing; the exact `RB-ROTATE` token was entered; only `buyerrecon_stage0_runner`
  was rotated; and the corrected custody value was written root:root chmod-600 with the
  required key — DB/custody in sync, secrets cleared, no raw values printed.
- This is **not** a proof of live authentication, **not** authorization for Stage 0, and
  **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run another RB-ROTATE, rotate again, overwrite custody, rerun psql/auth, run an
   Option A preflight, run Step 2E, run Stage 0, touch the run-lock, or perform remediation off
   this evidence.
3. After this evidence PR is reviewed/merged, create a **docs-only registry amendment** to mark
   the **current** Stage 0 runner custody value as **corrected/verified from this RB-ROTATE
   evidence** (i.e. move `prod.stage0.runner.custody.file` `current_custody_value_status` from
   `broken_until_rewritten_by_rb_rotate` to a corrected/verified state, citing this evidence
   PR) — secret-safe, no raw values.
4. After that amendment is reviewed/merged, a **separately GO-gated Option A binding/auth
   preflight rerun** may prove **live auth**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
**host value, port value**, real URI, SSH banner, login source, host/network detail, raw
payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw PostgreSQL
error text, Node stack trace, or the operator's typed confirmation value, or customer data.
The RB-ROTATE run **derived the corrected DSN locally and did not print it**
(`corrected_dsn_derived_locally=true`, `corrected_dsn_printed=false`,
`raw_values_printed=false`); host/port were taken from the approved source **in-memory only**
(never printed), the broken custody value was **not** used as a source
(`broken_custody_used_as_source=false`), the new password was entered via **hidden input**
(`secret_input_hidden=true`) and **never printed**, raw psql output was **withheld**
(`raw_psql_output_printed=false`), the corrected custody file is **root:root chmod 600** and
its contents were **not** printed (verified by presence/permissions/ownership/key booleans
only), and **secrets were cleared** (`secret_cleared=true`). The role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, the
env-var/key name `STAGE0_RUNNER_DSN`, and the non-secret token `RB-ROTATE` are not secret
values. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret identifiers / public git commit hashes — not secret or row values.
