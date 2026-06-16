# Sprint 3 — Stage 0 Step 2G — Option A Revised Auth-Failure Classifier — Evidence (CLASSIFIED: auth_or_credential)

**Status:** `STAGE0_STEP2G_OPTION_A_REVISED_AUTH_FAILURE_CLASSIFIER_CLASSIFIED_AUTH_OR_CREDENTIAL`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 STEP2G OPTION A REVISED AUTH FAILURE CLASSIFIER GO`, the operator ran the
revised PR #261 classifier at `/opt/buyerrecon-backend` (after a current-tip fast-forward
putting HEAD on the base tip incl. PR #261). The **pre-execution self-test passed first**
(code-from-stdin, data-path-only, allowlisted-token-only, no raw print); **only then** was
the real chmod-600 withheld raw-output file touched and **inspected for category only**.
The classifier emitted exactly one allowlisted token → `auth_failure_category=auth_or_credential`,
`revised_classifier_result=classified`, `stop_line=none`, with **raw output not printed**.

**This is a valid safe category-only classification — it does NOT expose raw
PostgreSQL/psql output or the exact error text, does NOT reveal DSN/host/port/database/
username/password/IP/URI/service-file content, does NOT prove the exact credential subcase,
and is NOT a Stage 0 readiness proof or Stage 0 execution.** This PR records safe
**booleans/category tokens / public commit hashes only** — no secret value, DSN, raw psql
output, or PostgreSQL error text.

> Provenance: PR #261 revised auth-failure classifier plan
> (`65161b21831f569a96b78c7f442afb5d9c5f38e3`,
> `STAGE0_STEP2G_OPTION_A_REVISED_AUTH_FAILURE_CLASSIFIER_PLANNING_ONLY`); PR #260
> classifier blocked — raw-output boundary violated
> (`257f87bdb7740eae47f63e141ba4648bc25af559`); PR #258 Option A auth preflight retry —
> auth failed, raw withheld (`73ffdc162aa870b71e8c08aedc3441efdba367f3`); PR #201 original
> broad `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).

---

## 1. Authorization

- GO: `HELEN STAGE0 STEP2G OPTION A REVISED AUTH FAILURE CLASSIFIER GO` — one revised
  classifier run per the PR #261 design (current-tip fast-forward; self-test first;
  category-only classify; raw output never printed; one allowlisted token; fail closed).
- This did **not** authorize a credential reset, password rotation, custody overwrite,
  remediation, Option A preflight rerun, psql/auth rerun, raw-output printing, Step 2E, or
  Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual revised classifier run)

```text
revised_auth_failure_classifier_attempted=true
raw_output_printed=false
secret_value_printed=false
secret_value_read=false
dsn_component_output=false
env_production_values_read=false
psql_auth_rerun=false
option_a_preflight_rerun=false
credential_reset_performed=false
password_rotation_performed=false
custody_source_overwritten=false
remediation_performed=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
source_selection_changed=false
option_b_code_changed=false
runtime_downstream_action=false
expected_path_ok=true
expected_branch_ok=true
working_tree_clean_before=true
current_tip_fast_forward_attempted=true
remote_fetch_attempted=true
remote_fetch_result=success
fast_forward_to_current_tip_possible=true
fast_forward_to_current_tip_applied=true
head_contains_remote_base_tip=true
head_contains_pr261_merge=true
working_tree_clean=true
self_test_attempted=true
self_test_code_from_stdin=true
self_test_data_path_only=true
self_test_allowlisted_token_only=true
self_test_raw_data_printed=false
self_test_result=pass
real_raw_output_touched=true
raw_auth_output_file_exists=true
raw_auth_output_chmod_600=true
raw_output_inspected_for_category_only=true
auth_failure_category=auth_or_credential
revised_classifier_result=classified
stop_line=none
revised_auth_failure_classifier_completed=true
```

---

## 3. Interpretation (bounded)

### 3.1 Phase 0 — current-tip fast-forward (succeeded)
Expected path/branch (`expected_path_ok=true`, `expected_branch_ok=true`); clean tree
(`working_tree_clean_before=true`, `working_tree_clean=true`); remote fetch success;
fast-forward possible and applied; local HEAD contains the **current remote base tip**
(`head_contains_remote_base_tip=true`) and the **PR #261 merge**
`65161b21831f569a96b78c7f442afb5d9c5f38e3` (`head_contains_pr261_merge=true`).

### 3.2 Phase 1 — self-test (passed first)
The self-test ran first (`self_test_attempted=true`) and **passed** (`self_test_result=pass`),
proving: **code from stdin** (`self_test_code_from_stdin=true`), **data-path-only** handling
(`self_test_data_path_only=true`), **allowlisted-token-only** output
(`self_test_allowlisted_token_only=true`), and **no raw data printed**
(`self_test_raw_data_printed=false`). This is the guard that the PR #260 incident lacked.

### 3.3 Phase 2 — real classification (category only)
**Only after the self-test passed** was the real file touched (`real_raw_output_touched=true`):
the raw-output file existed and was chmod 600 (`raw_auth_output_file_exists=true`,
`raw_auth_output_chmod_600=true`); it was **inspected for category only**
(`raw_output_inspected_for_category_only=true`) with **raw output not printed**
(`raw_output_printed=false`), no secret value printed/read
(`secret_value_printed=false`, `secret_value_read=false`), no DSN component output
(`dsn_component_output=false`), no `.env.production` read
(`env_production_values_read=false`).
- The classifier emitted exactly one allowlisted token:
  **`auth_failure_category=auth_or_credential`** → `revised_classifier_result=classified`,
  `stop_line=none`.

### 3.4 Bounded conclusion
- This is a **valid safe category-only classification**.
- The PR #258 auth failure is classified as **`auth_or_credential`**.
- It does **not** expose raw PostgreSQL/psql output or the exact raw error text.
- It does **not** reveal DSN, host, port, database, username, password, IP, URI, or
  service-file content.
- It does **not** prove the exact credential fault — **not** whether the issue is a wrong
  password, wrong user, wrong DSN value, missing role, or another auth/credential subcase.
- It does **not** authorize credential reset, password rotation, custody overwrite,
  remediation, Option A rerun, Step 2E, or Stage 0.
- It does **not** prove Stage 0 readiness; it does **not** execute Stage 0.

The classifier redesign worked: the failed-auth category is now safely established as
**`auth_or_credential`** — converging with the original PR #201 broad classification, but
now via a **correctly-bound runner** (not the collector identity) and via a **safe
self-test-gated** classifier (not the PR #260 leak). The next step is a separately-reviewed
**credential/custody correction plan** for the `auth_or_credential` category, secret-safe.

---

## 4. What Did Not Happen

- No raw-output printing; no raw psql/PostgreSQL text or error text exposed; no Node
  stack trace.
- No secret value read/print/parse; no DSN component output; no `.env.production`
  read/print.
- No psql/auth rerun; no Option A preflight rerun.
- No credential reset; no password rotation; no custody-source overwrite; no remediation.
- No classifier rerun beyond the one authorized run.
- No Step 2E rerun.
- No Stage 0 execution; no `npm run stage0:run`.
- No run-lock touch.
- No source-selection change; no Option B code change.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network
  detail recorded.

---

## 5. Verdict

- **CLASSIFIED (safe) — Step 2G Option A revised auth-failure classifier is
  `auth_failure_category=auth_or_credential`, `revised_classifier_result=classified`,
  `stop_line=none`**: self-test passed first (code-from-stdin, data-only, allowlisted-token,
  no-raw-print), then the real chmod-600 withheld file was inspected for category only and
  classified as `auth_or_credential`, with raw output never printed and no secret exposed.
- This is **not** a proof of the exact credential subcase, **not** authorization for any
  credential/remediation action, **not** a Stage 0 readiness proof, and **not** a Stage 0
  execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun the classifier, print raw output, reset credentials, rotate a
   password, overwrite the custody source, rerun psql/auth, run an Option A preflight, run
   Step 2E, run Stage 0, touch the run-lock, change source selection, implement Option B, or
   perform remediation off this evidence.
3. After this evidence PR is reviewed/merged, create a **separate docs-only
   credential/custody correction planning PR** deciding how to safely resolve the
   `auth_or_credential` category **without exposing secrets** — it may plan **secret-safe
   validation/correction of the `STAGE0_RUNNER_DSN` custody source** (presence/authority/
   scope only; **never** printing, parsing, or exposing the value). No credential reset,
   password rotation, custody overwrite, Option A rerun, Step 2E, or Stage 0 without
   separate planning/review/GO.
4. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, bearer
token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace, or customer data. The revised classifier ran a
**self-test first** (proving code-from-stdin, data-only handling, allowlisted-token output,
no raw print), then inspected the real chmod-600 withheld file **for category only** —
**raw output was not printed** (`raw_output_printed=false`), no secret value was
read/printed, no DSN component was output, and no `.env.production` value was read; the only
classification emitted is the allowlisted category token `auth_or_credential`, **not** raw
error text. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no
secret value exposed, printed, or recorded.") All values above are safe labels / booleans /
category tokens / public git commit hashes — not secret or row values.
