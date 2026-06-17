# Sprint 3 — Stage 0 — Live-Auth Failure Investigation Plan (Review-Only)

**Status:** `STAGE0_LIVE_AUTH_FAILURE_INVESTIGATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. After PR #284 recorded the Option A
live-auth preflight as **AUTH_FAILED (raw withheld)**, this compares **secret-safe
investigation routes** for the unresolved live-auth-level `auth_or_credential` failure and
recommends the **first** next route — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no** classifier execution, raw-output
inspection, psql/auth rerun, credential rotation, RB-ROTATE retry, custody write, Option A
retry, Step 2E, Stage 0, run-lock touch, grants, schema/data changes, source-selection
change, Option B code change, remediation, downstream runtime, Lane/scoring/AMS/customer
output, Gate 4E, or Gate 4F. No raw psql/PostgreSQL output, raw error text, DSN, host, port,
username (beyond the approved role identifier), database name beyond the approved identifier,
password, token, custody contents, customer payload, or PII appears in this document.

> Provenance: PR #284 Option A live-auth preflight AUTH_FAILED
> (`f710696b20278d406f0b5f5a457ac7b81ccb5664`,
> `STAGE0_OPTION_A_LIVE_AUTH_PREFLIGHT_AUTH_FAILED_RAW_WITHHELD`); PR #283 custody value
> corrected/verified (`5033d0157f5191708074f92ab30a273cd3193cfa`); PR #282 RB-ROTATE applied
> (`dadb458bde5e7de0e980749829f11e9308920f91`); PR #262 revised classifier classified
> `auth_or_credential` (`155737d007dcf43c40eb4db43546705562c9424e`).

---

## 1. State of Truth After PR #284

- The custody value is **structurally corrected/verified** (PR #282 rewrite; PR #283 registry
  amendment).
- The **source-of-truth derivation** path is **verified-active** (PR #280/#281).
- **Live authentication FAILED** at the Option A preflight (PR #284): `psql_auth_succeeded=false`,
  `live_auth_preflight_result=auth_failed`, `stop_line=psql_auth_failed_raw_withheld`.
- **`live_auth_proven=false`** in the registry.
- The original **`auth_or_credential` remains unresolved at the live-auth level**.
- The **exact subcase is unknown** because the raw psql/PostgreSQL output remains **withheld**
  (chmod-600, never printed/inspected). The PR #284 `auth_user_expected_match=false` /
  `auth_database_expected_match=false` / `transaction_read_only_enforced=false` are
  **unconfirmed** (auth did not complete) — **not** assertions about user/database/read-only.

### PR #284 carry-forward evidence

PR #284 merge `f710696b20278d406f0b5f5a457ac7b81ccb5664` recorded the Option A
live-auth preflight evidence used by this plan:

```text
active_option_a_live_auth_preflight_script_sha=82c023868083212efa8c1e10964dd904fcaab3f1c8c2b1d2539ebae736bc5c39
superseded_script_sha=5273d1525cdcfe8e9c40819bc69fe2e007534c73db0f3c25499c096e35665181
previous_script_not_run=true
non_argv_connection_method=true
dsn_passed_on_argv=false
psql_command_uses_service_name_only=true
psql_auth_attempted=true
psql_auth_succeeded=false
raw_psql_output_printed=false
live_auth_preflight_result=auth_failed
stop_line=psql_auth_failed_raw_withheld
preflight_invocation_count=2
duplicate_invocation=true
duplicate_invocation_result_same=true
stage0_executed=false
run_lock_touched=false
```

The superseded script passed the DSN via argv / `psql -d "$dsn"` and was not run. PR #284
conservatively recorded two identical read-only live-auth preflight invocations because the
operator transcript showed two command/output blocks; both produced the same safe-label result.
Neither invocation printed raw values or raw psql/PostgreSQL output.

PR #284 created no persistent runtime or data-plane effects: no Stage 0 execution, no run-lock
touch, no schema changes, no data reads, no grants, no custody write, no credential rotation,
and no runtime/downstream action. The registry custody correction remains recorded from PR #283,
`live_auth_proven=false` remains the current registry state, and the original `auth_or_credential`
finding remains unresolved at the live-auth level.

---

## 2. Candidate Investigation Routes (compared; none executed)

### Route A — Category-only classifier over the already-withheld raw psql output
- **Purpose:** classify the failure **family** without printing raw error text.
- **Candidate safe classes (allowlist):**
  ```text
  password_auth_failed
  pg_hba_rejected
  ssl_required_or_ssl_mismatch
  service_file_parse_error
  role_not_found
  role_login_disabled
  database_not_found
  network_or_socket_failure
  unknown_auth_or_connection_failure
  ```
- **Constraints:** allowlisted pattern matching **only**; **self-test first** on synthetic
  fixture text; **never** print raw psql output; **never** print DSN, host, port, user,
  database name, password, token, custody contents, or raw error; emit **safe class labels
  only**.
- **Pros:** least invasive; reuses already-withheld evidence; no credential/custody mutation;
  no auth rerun; no raw-output print; narrows which deeper route (password/custody,
  pg_hba/SSL, service-file formatting, role/database, or network) to pursue next.
- **Cons:** only as good as the allowlist; if it cannot classify safely it must fail closed to
  `unknown_auth_or_connection_failure` (then Route B/C may be needed).

### Route B — Custody/credential re-confirmation route
- **Purpose:** determine whether the **DB password** and the **URL-encoded custody DSN
  password** are aligned (a plausible failure mode: an encoding/escaping mismatch between the
  `ALTER ROLE` password and the DSN-embedded, URL-encoded password).
- **Constraints:** must **not** print or compare raw passwords in output; must **not** expose
  hashes unless a specific hashing approach is explicitly planned and reviewed as safe.
- **Risk:** **higher** — it touches secret-material logic.
- **Sequencing:** **should not be first** unless Route A is inconclusive or points toward a
  password mismatch (`password_auth_failed`).

### Route C — Role / connection-policy diagnostic route
- **Purpose:** **booleans-only** checks for role `LOGIN`, `VALID UNTIL`, connection limit,
  expected role existence, and possibly allowed connection-policy / SSL **category**.
- **Constraints:** must avoid raw `pg_hba` output and raw host/port; booleans/category labels
  only.
- **Sequencing:** useful **if Route A points toward** role / pg_hba / SSL policy; **separately
  GO-gated** (it implies a privileged read of role attributes / policy).

### Route D — Blind rerun / remediation — **REJECTED as next step**
- **No** blind rerun; **no** credential rotation; **no** custody write; **no** raw-output
  inspection; **no** remediation before classification/planning. Repeating the failed auth or
  mutating credentials/custody before we know the subcase would risk masking the cause and
  drifting state.

---

## 3. Recommended Next Route

**Recommend Route A — the category-only classifier first.** Rationale:
- least invasive;
- uses the already-withheld evidence (no new auth attempt);
- no credential/custody mutation;
- no auth rerun;
- no raw-output print;
- it **narrows** whether to pursue password/custody (Route B), pg_hba/SSL or role policy
  (Route C), service-file formatting, role/database, or a network path next.

This is a **planning recommendation, not an execution decision**: no classifier runs here;
the route is finalized under the next GO, and any Route B/C step is separately reviewed and
GO-gated.

---

## 4. Future Command-Pack Requirements for Route A (planning only; no runnable command here)

A future Route A command-pack PR must:
- **self-test the classifier on synthetic fixture messages** before touching the withheld raw
  output;
- **fail closed** if the synthetic self-test fails (no real-file access);
- read the withheld raw output **only if it still exists and is chmod 600**;
- classify using the **allowlisted categories only** (§2 Route A list);
- print **category labels only**;
- **never** print raw psql/PostgreSQL text;
- **never** print DSN / host / port / user / database / password / custody contents;
- delete/retain temp files according to a **pre-approved evidence policy**;
- make **no** DB connection unless separately authorized;
- perform **no** psql/auth rerun;
- perform **no** raw inspection (beyond the allowlisted, non-printing classification);
- perform **no** credential rotation;
- perform **no** custody write;
- run **no** Stage 0.

> Note: the safe pattern is the PR #261/#262 self-test-gated, code-from-stdin / data-only,
> allowlisted-token-only classifier model — proven to classify a withheld auth failure into a
> safe category without leaking raw text. (The PR #260 incident — executing the raw-output
> file as code — must not recur; code from stdin, raw path as data only.)

---

## 5. Non-Authorization

**This PR authorizes no:** classifier execution; raw-output inspection; psql/auth rerun;
credential rotation; RB-ROTATE retry; custody write; Option A retry; Step 2E; Stage 0;
run-lock touch; grants; schema/data changes; source-selection change; Option B code change;
remediation; downstream runtime; Lane/scoring/AMS/customer output; Gate 4E; Gate 4F.

**The chosen route (A, then possibly B/C) is a future, separately-reviewed, separately
GO-gated step.** **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains
false.**

---

## 6. Future Gated Sequence

1. **Merge** this docs-only investigation planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **Route A** — a docs-only command-pack plan for the
   category-only classifier (self-test-gated, allowlisted, no raw print), then a separate GO
   to run it.
3. Docs-only **classifier evidence PR** (safe class label only).
4. Based on the class: if `password_auth_failed` → plan **Route B** (custody/credential
   re-confirmation, secret-safe); if `pg_hba_rejected` / `ssl_*` / `role_*` → plan **Route C**
   (role/connection-policy diagnostics, booleans only); if `unknown_auth_or_connection_failure`
   → re-plan. Each is separately reviewed and GO-gated.
5. Only once live auth is genuinely proven (`live_auth_proven=true`) may Step 2E / Stage 0 be
   planned separately.
6. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, **raw psql output, raw
PostgreSQL error text**, Node stack trace, or customer data. This is a docs-only plan
comparing secret-safe investigation routes for the live-auth `auth_or_credential` failure;
the recommended Route A is a **category-only classifier** (self-test-gated, allowlisted, raw
output never printed) over the already-withheld chmod-600 capture, Route B (custody/credential
re-confirmation) and Route C (role/connection-policy diagnostics, booleans only) are
secret-safe and separately GO-gated, and Route D (blind rerun/remediation) is rejected. It
**runs no classifier**, inspects/prints **no** raw output, runs **no** psql/auth, rotates
**no** credential, writes **no** custody, and records **no** DSN/secret/host/port/custody
value. The candidate class tokens (`password_auth_failed`, `pg_hba_rejected`,
`ssl_required_or_ssl_mismatch`, `service_file_parse_error`, `role_not_found`,
`role_login_disabled`, `database_not_found`, `network_or_socket_failure`,
`unknown_auth_or_connection_failure`), the role name `buyerrecon_stage0_runner`, the
custody-file path `/etc/buyerrecon/stage0-runner.env`, the env-var/key name
`STAGE0_RUNNER_DSN`, and the database name `buyerrecon_production` are non-secret identifiers.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret identifiers / public git commit hashes — not secret or row values.
