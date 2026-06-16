# Sprint 3 — Stage 0 — Route B Credential/Custody Alignment Retry — Evidence (BLOCKED: operator confirmation failed; command MIS-ALIGNED with PR #270)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_RETRY_MISALIGNED_BLOCKED_OPERATOR_CONFIRMATION_FAILED`

This is a **docs-only evidence record**. The latest Route B credential/custody alignment
retry attempt at `/opt/buyerrecon-backend` reached the repo/current-tip preflight and the
non-secret custody-write preflight, reached the hidden-input prompts, and then **stopped
safely at the operator-confirmation stop-line** — **no mutation occurred** (no DB password
rotation, no custody write).

**However, this attempt was NOT the authorized PR #270 `RB-ROTATE` retry.** The executed
command **still expected the old long confirmation phrase**
(`ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN`) instead of the simple token
`RB-ROTATE` from merged PR #270, and it **referenced/checked PR #268** rather than explicitly
confirming the **PR #270 merge `9f437c04a51fbb7a94ccde9a55d18006ea29616e`**. It is therefore
recorded as a **blocked / no-mutation, mis-aligned** attempt and **must not** be treated as a
successful PR #270 `RB-ROTATE` retry.

**This is a safe blocked-execution record — it does NOT prove the credential correction
succeeded, does NOT prove auth readiness, does NOT authorize another retry, and does NOT
count as the PR #270-aligned retry.** This PR records safe **booleans/category tokens /
public commit hashes only** — no secret value, generated password, DSN, DSN component,
`.env.production` value, raw psql/PostgreSQL output, or the operator's typed confirmation
value.

> Target context: production path `/opt/buyerrecon-backend`; target role
> `buyerrecon_stage0_runner`; target custody file `/etc/buyerrecon/stage0-runner.env`; target
> custody key `STAGE0_RUNNER_DSN`.

> Provenance: PR #270 simple-confirmation-token plan (token `RB-ROTATE`)
> (`9f437c04a51fbb7a94ccde9a55d18006ea29616e`,
> `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_SIMPLE_CONFIRMATION_TOKEN_PLANNING_ONLY`); PR #269
> hardened Route B blocked at confirmation (`8e13aa8550dddb81c832537afa57161b5f29d058`);
> PR #268 confirmation-entry hardening plan (`a6e04e190ee52c7e2cb20dd10fe0eeb9ae401d86`);
> PR #265 revised Route B command-pack plan (`91973ec2777ff3bb5ed037002ce62268923b48a7`).

---

## 1. Authorization & Scope

- The merged, authorized plan (PR #270) was to use the **simple confirmation token
  `RB-ROTATE`** and to confirm the **PR #270 merge**.
- The actual executed command **did not** match that authorization (see §4). Its confirmation
  gate still expected the **old long phrase**, and it checked **PR #268** rather than the
  PR #270 merge.
- This did **not** authorize, and the run did **not** perform, a credential reset, password
  rotation, custody overwrite, psql/auth rerun, Option A preflight rerun, Step 2E, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual mis-aligned retry run)

```text
expected_path_ok=true
expected_branch_ok=true
working_tree_clean_before=true
current_tip_fast_forward_attempted=true
remote_fetch_attempted=true
remote_fetch_result=success
fast_forward_to_current_tip_possible=true
fast_forward_to_current_tip_applied=true
working_tree_clean=true
non_secret_custody_write_preflight_attempted=true
non_secret_custody_write_preflight_passed=true
secret_input_hidden=true
operator_confirmation_passed=false
operator_confirmation_length_matches=false
operator_confirmation_exact_match=false
db_rotation_attempted=false
db_rotation_applied=false
custody_write_attempted=false
custody_written=false
custody_file_exists=false
custody_file_owner_root=false
custody_file_chmod_600=false
custody_key_present=false
db_custody_in_sync=false
secret_cleared=true
hardened_revised_route_b_execution_result=blocked
stop_line=operator_confirmation_failed
hardened_revised_route_b_execution_completed=true
```

**Mis-alignment labels (recorded for this attempt):**

```text
command_aligned_with_pr270=false
confirmation_token_expected_by_command=long_phrase_not_rb_rotate
pr270_merge_explicitly_confirmed_by_command=false
pr268_referenced_by_command=true
counts_as_pr270_rb_rotate_retry=false
```

> **Clarifying note (label semantics).** The labels `custody_file_exists=false`,
> `custody_file_owner_root=false`, `custody_file_chmod_600=false`, `custody_key_present=false`,
> and `db_custody_in_sync=false` mean **this run never reached the custody-write phase** —
> they are **not** claims that a pre-existing custody file is absent or misconfigured. The
> diagnostics `operator_confirmation_length_matches=false` /
> `operator_confirmation_exact_match=false` are computed **internally**; the operator's typed
> value is **never** printed. The mis-alignment labels are this evidence record's annotation of
> the discrepancy in §4, expressed as safe booleans/tokens.

---

## 3. Interpretation (bounded)

### 3.1 Phase 0 — repo / base / preflight (passed)
Expected path/branch (`expected_path_ok=true`, `expected_branch_ok=true`); clean tree before
and after (`working_tree_clean_before=true`, `working_tree_clean=true`); remote fetch
success; current-tip fast-forward possible and applied.

### 3.2 Phase 1 — non-secret custody-write preflight (passed, before any DB rotation)
The non-secret custody-write preflight **ran and passed**
(`non_secret_custody_write_preflight_attempted=true`,
`non_secret_custody_write_preflight_passed=true`) — proving custody-write capability **before**
any irreversible DB rotation, as the PR #265 partial-state-prevention design requires.

### 3.3 Phase 2 — hidden input + confirmation (reached; confirmation failed)
The hidden-input prompts were reached with **input hidden** (`secret_input_hidden=true`). The
confirmation **failed** (`operator_confirmation_passed=false`,
`operator_confirmation_exact_match=false`, `operator_confirmation_length_matches=false`) →
`stop_line=operator_confirmation_failed`, stopping **before any DB rotation**.

### 3.4 Phases 3–4 — NOT reached (no mutation)
- **No DB rotation** attempted or applied (`db_rotation_attempted=false`,
  `db_rotation_applied=false`); **no role altered**; **no grant/schema/data change**.
- **No custody write** attempted or performed (`custody_write_attempted=false`,
  `custody_written=false`); **no custody overwrite**.
- **DB and custody therefore cannot have drifted.**

### 3.5 Phase 5 — cleanup (clean)
Secrets were **cleared** (`secret_cleared=true`); **no secret value, generated password, DSN
value, DSN component, `.env.production` value, raw psql/PostgreSQL output, or typed
confirmation value was printed**. The execution **completed** as a clean blocked stop
(`hardened_revised_route_b_execution_completed=true`,
`hardened_revised_route_b_execution_result=blocked`).

---

## 4. Critical Discrepancy (command mis-aligned with PR #270)

This attempt is **not** the authorized PR #270 retry. Two concrete mismatches:

1. **Wrong confirmation token.** The merged PR #270 plan authorizes the **simple token
   `RB-ROTATE`** as the confirmation. The **executed command still expected the old long
   phrase** `ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN`
   (`confirmation_token_expected_by_command=long_phrase_not_rb_rotate`). So the operator
   could not have passed with `RB-ROTATE`, and the failure here does **not** test the PR #270
   change.
2. **Wrong merge reference.** The command **referenced/checked PR #268**
   (`pr268_referenced_by_command=true`) rather than **explicitly confirming the PR #270 merge**
   `9f437c04a51fbb7a94ccde9a55d18006ea29616e`
   (`pr270_merge_explicitly_confirmed_by_command=false`).

Consequences:
- `command_aligned_with_pr270=false`, `counts_as_pr270_rb_rotate_retry=false`.
- This run is a **blocked / no-mutation** attempt only; it **does not** validate or invalidate
  the PR #270 `RB-ROTATE` mechanism.
- The PR #270-aligned retry **still needs to be run** with the corrected command pack.

> Note: the prior `operator_confirmation_failed` results (PR #266/#267/#269) and this one all
> remain **safe, no-mutation** stops. The new information here is purely that **the command
> under test was not the PR #270-aligned one**, so this attempt must not be counted toward the
> `RB-ROTATE` retry.

---

## 5. What Did Not Happen

- No PostgreSQL password rotation attempted; no role altered.
- No custody write attempted; no custody overwrite.
- No psql/auth rerun; no Option A preflight rerun.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grant/schema/table/data change.
- No source-selection change; no Option B code change.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E; no
  Gate 4F.
- No secret, generated password, DSN value, DSN component, `.env.production` value, raw
  PostgreSQL/psql output, or operator-typed confirmation value printed.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 6. Verdict

- **BLOCKED (safe; mis-aligned) — Route B retry is
  `hardened_revised_route_b_execution_result=blocked`,
  `stop_line=operator_confirmation_failed`**: preflights passed, hidden input was reached, and
  the run stopped before any DB rotation or custody write, with **no mutation**, secrets
  cleared, and **no secret/raw/typed-value output printed**.
- **This is NOT the authorized PR #270 `RB-ROTATE` retry** (`command_aligned_with_pr270=false`,
  `counts_as_pr270_rb_rotate_retry=false`): the executed command expected the **old long
  phrase** and referenced **PR #268** rather than confirming the **PR #270 merge
  `9f437c04a51fbb7a94ccde9a55d18006ea29616e`**.
- This is **not** a proof of credential correction, **not** a proof of auth readiness, **not**
  authorization for another retry / Option A preflight / Step 2E / Stage 0, and **not** a
  Stage 0 execution.

---

## 7. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run another retry, rotate the password, overwrite the custody source, rerun
   psql/auth, run an Option A preflight, run Step 2E, run Stage 0, touch the run-lock, or
   perform remediation off this evidence.
3. After this evidence PR is reviewed/merged, **prepare a corrected PR #270-aligned Route B
   retry command pack / GO** that:
   - uses **only** the simple confirmation token `RB-ROTATE` (exact equality; trailing-`\r`
     normalization only; reject lowercase/extra spaces/punctuation/quotes/backticks/alternate
     wording; never print the typed value); **and**
   - **explicitly confirms the PR #270 merge `9f437c04a51fbb7a94ccde9a55d18006ea29616e`** in
     Phase 0 (current-tip fast-forward so HEAD contains it), **not** PR #268.
   Then it runs the standard secret-safe Phase 0 → Phase 5 chain and produces a docs-only
   correction evidence PR.
4. **Stage 0 execution remains separately GO-gated.**

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, Node stack trace, or the operator's typed confirmation value, or
customer data. The Route B retry reached **hidden secret input** (`secret_input_hidden=true`)
and then **stopped at the operator-confirmation stop-line** before any DB rotation or custody
write; the confirmation diagnostics are computed **internally** and the **typed value is never
printed**. No secret value, generated password, DSN value, DSN component, or `.env.production`
value was printed/parsed/logged; no raw psql/PostgreSQL output was emitted; **secrets were
cleared** (`secret_cleared=true`). The critical discrepancy recorded here is purely an
operational mis-alignment (the executed command expected the old long phrase and referenced
PR #268 rather than confirming the PR #270 merge); the confirmation tokens
`RB-ROTATE` and `ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN`, the role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, and the
env-var/key name `STAGE0_RUNNER_DSN` are non-secret control tokens, not secret values. (Per the
PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value exposed,
printed, or recorded.") All values above are safe labels / booleans / category tokens /
non-secret control strings / public git commit hashes — not secret or row values.
