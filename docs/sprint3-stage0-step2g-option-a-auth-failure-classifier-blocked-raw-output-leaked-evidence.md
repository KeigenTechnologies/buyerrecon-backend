# Sprint 3 — Stage 0 Step 2G — Option A Auth-Failure Classifier — Evidence (BLOCKED: raw-output boundary violated)

**Status:** `STAGE0_STEP2G_OPTION_A_AUTH_FAILURE_CLASSIFIER_BLOCKED_RAW_OUTPUT_LEAKED`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 STEP2G OPTION A AUTH FAILURE CATEGORY CLASSIFIER GO`, the operator ran the
Path A category-only classifier over the already-withheld chmod-600 PR #258 raw auth
output. **The classifier implementation was unsafe and violated the raw-output boundary:
the command exposed raw psql/PostgreSQL error text (and a Node stack trace) to the
terminal, then failed without producing a valid classification.** The run is therefore
recorded as **blocked / raw-output boundary violated** — **not** a valid classification.

**This is a blocked-safety-incident record only — it does NOT establish a valid
auth-failure category, and it does NOT authorize using the leaked output to proceed.**
This PR records safe **booleans/category tokens / a sanitized incident description only** —
it does **not** quote the leaked raw psql/PostgreSQL text, does **not** include the Node
stack trace verbatim, and contains no secret value, DSN, host, port, IP, URI, or
`.env.production` content.

> Provenance: PR #259 Option A auth-failure classification plan
> (`46df9c573b00ef6711fd42a7f51b4adf6deddf97`,
> `STAGE0_STEP2G_OPTION_A_AUTH_FAILURE_CLASSIFICATION_PLANNING_ONLY`); PR #258 Option A
> auth preflight retry — auth failed, raw withheld
> (`73ffdc162aa870b71e8c08aedc3441efdba367f3`); PR #249 Option A command-pack plan
> (`76bff30d0912b00ee5338d4bdc83bbafccb4271e`).

---

## 1. Authorization & Intended Scope

- GO: `HELEN STAGE0 STEP2G OPTION A AUTH FAILURE CATEGORY CLASSIFIER GO` — a **safe
  category-only classifier** intended to operate **only** on the already-withheld
  chmod-600 PR #258 raw auth output, emit **one allowlisted category token only**, and
  **not** print raw PostgreSQL/psql output, expose DSN/host/port/database/username/
  password/IP/URI/service-file content/raw error text, rerun psql/auth, or run Option A
  preflight / Step 2E / Stage 0.
- **The actual run violated that scope** (see §3) and is **not** a valid classification.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels Observed Before Failure

```text
auth_failure_classifier_attempted=true
raw_output_printed=false   # SUPERSEDED — see §3/§4: actual terminal output contradicted this guard
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
head_contains_pr259_merge=true
working_tree_clean=true
raw_auth_output_file_exists=true
raw_auth_output_chmod_600=true
```

> **Important:** the `raw_output_printed=false` label above is a **pre-failure guard that
> was contradicted by the actual run** (§3). It is retained here only to show the guard the
> classifier *claimed*; the **corrected** state is `raw_output_printed=true` /
> `raw_output_boundary_violated=true` (§4). Do **not** read the `false` guard as the
> outcome.

---

## 3. Observed Failure (sanitized — no verbatim leak)

- The classifier command used an **unsafe Node invocation shape** (conceptually
  `node "$RAW_OUT" <<'NODE' …`), which caused **Node to execute the withheld raw psql
  output file as JavaScript** instead of running the intended classifier script **over**
  it as data.
- As a result, **raw psql/PostgreSQL error text was printed to the terminal/chat**, and
  **Node then failed with a JavaScript syntax error and a stack trace**.
- The classifier **did not complete**; **no allowlisted category token was safely
  emitted**; the run **must not** be treated as a valid classification.

**Sanitized record only:** this evidence states *that* raw psql/PostgreSQL text and a Node
stack trace were exposed in the operator terminal — it does **not** reproduce that text or
the stack trace here, and quotes **no** raw line. No raw line is referenced verbatim; only
this sanitized description is recorded.

---

## 4. Corrected Boundary State

```text
raw_output_printed=true
raw_output_boundary_violated=true
auth_failure_classifier_result=blocked_raw_output_leaked
auth_failure_category=none_not_validly_classified
classifier_completed=false
stop_line=auth_failure_classifier_raw_output_boundary_violated
leaked_content_categories=raw_psql_postgres_error_text,node_stack_trace
leaked_content_reproduced_in_evidence=false
```

- Because the actual run printed raw output, the pre-failure `raw_output_printed=false`
  guard (§2) is **superseded**; the corrected state is `raw_output_printed=true`,
  `raw_output_boundary_violated=true`.
- **Do not** record `auth_failure_classifier_result=classified`.
- **Do not** record any normal `auth_failure_category` (e.g. `auth_or_credential`) as a
  valid classifier result — the category is `none_not_validly_classified`.
- **Do not** use the leaked raw output to proceed directly to remediation.

---

## 5. Interpretation (bounded)

- The classifier **attempt was made** (`auth_failure_classifier_attempted=true`).
- The **raw auth output file existed and was chmod 600 before the classifier step**
  (`raw_auth_output_file_exists=true`, `raw_auth_output_chmod_600=true`).
- The **classifier implementation was unsafe** — it executed the raw output file as code,
  thereby **exposing raw psql output** (and a Node stack trace).
- It does **not** prove a valid auth-failure category.
- It does **not** authorize credential reset, custody overwrite, Option A rerun,
  psql/auth rerun, Step 2E, Stage 0, remediation, or Option B.
- It does **not** prove Stage 0 readiness; it does **not** execute Stage 0.
- The fault is in the **classifier invocation shape**, not in the underlying auth question;
  the leaked output must **not** be used as a shortcut to a category or a fix. The exact
  auth-failure category remains **unestablished by any safe means**.

---

## 6. What Did Not Happen (boundaries preserved despite the failure)

- No psql/auth rerun; no Option A preflight rerun.
- No credential reset; no password rotation; no custody-source overwrite.
- No remediation.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No source-selection change; no Option B code change.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- The leaked raw psql/PostgreSQL text and Node stack trace are **not** reproduced,
  quoted, or referenced verbatim in this evidence; no secret value, DSN, host, port, IP,
  URI, or `.env.production` content is recorded here.

---

## 7. Verdict

- **BLOCKED (raw-output boundary violated) — Step 2G Option A auth-failure classifier is
  `auth_failure_classifier_result=blocked_raw_output_leaked`,
  `stop_line=auth_failure_classifier_raw_output_boundary_violated`**: an unsafe Node
  invocation executed the withheld raw auth-output file as code, exposing raw
  psql/PostgreSQL text and a Node stack trace, then failing without a valid category;
  `auth_failure_category=none_not_validly_classified`.
- This is **not** a valid classification, **not** authorization to use the leaked output,
  **not** a remediation, and **not** a Stage 0 readiness proof. The corrected boundary
  state is `raw_output_printed=true` / `raw_output_boundary_violated=true`.

---

## 8. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** rerun the classifier, inspect or print raw output, reset credentials, rotate
   a password, overwrite the custody source, rerun psql/auth, run an Option A preflight,
   run Step 2E, run Stage 0, touch the run-lock, change source selection, implement Option
   B, or perform remediation off this evidence.
3. After this evidence PR is reviewed/merged, create a **separate docs-only revised
   classifier plan** that **fixes the classifier invocation** and adds a **pre-execution
   self-test** proving Node reads classifier code **from stdin** and treats the raw-output
   path **only as data** (never executing it). The revised plan must be **Codex-reviewed**
   and require a **fresh explicit Helen GO** before any classifier rerun.
4. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, bearer
token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, **raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace** — and **no** customer data. The classifier
run **did** expose raw psql/PostgreSQL text and a Node stack trace **in the operator
terminal** (the incident this record documents), but that leaked content is **not**
reproduced, quoted, or referenced verbatim here — only **sanitized category labels**
(`leaked_content_categories=raw_psql_postgres_error_text,node_stack_trace`,
`leaked_content_reproduced_in_evidence=false`) are recorded. The corrected boundary state
is `raw_output_printed=true` / `raw_output_boundary_violated=true`; the pre-failure
`raw_output_printed=false` guard is superseded. (Per the PR #218 Codex note: "no secret
used or exposed" is to be read as "no secret value exposed, printed, or recorded" **in this
evidence record** — the terminal leak is documented in sanitized form, not reproduced.) All
values above are safe labels / booleans / category tokens / public git commit hashes — not
secret or row values.
