# Stage0 Route C Approved Diagnostic Connection Custody Plan

## Status

**Status:** `STAGE0_ROUTE_C_APPROVED_DIAGNOSTIC_CONNECTION_CUSTODY_PLANNING_ONLY`

- **Planning-only.**
- **Docs-only.**
- This document **does not authorize Route C execution**.
- This document **does not authorize** SQL, psql, auth retry, Stage0, DB mutation, credential
  rotation, custody write, secret inspection, DSN discovery, `.env.production` inspection, or
  connection-value retrieval.
- This document **does not authorize fixing or remediating anything**.
- **Future execution requires a separate explicit scoped HELEN GO.**

This record defines **safe custody/availability requirements** only. It obtains nothing, inspects
nothing, and changes no custody. **No** secret value, DSN, connection string, host, port, IP,
username, password, token, private key, `pg_hba` line, service detail, `.env.production` value,
custody content, role password/hash, customer payload, PII, or raw PostgreSQL error text appears
in this document.

---

## Evidence chain

- **PR #291** (`e84f8775cfef24ea2e08dfe62fee37558dca7e9a`): Route A classifier result
  `classifier_result=role_missing_or_not_login`, `classifier_result_safe=true`.
- **PR #292** (`bcfca4072e0e623d74be4a0c3cdaeed35271afe3`): merged the Route C planning document.
- **PR #300** (`133409b36fc15ab9c0fdaa0f4ff7eadd325f5dba`): merged the Route C role /
  connection-policy diagnostic command pack.
- **PR #301** (`b5ca339e8e2d4231e81e736d8ab6cd728f4b4283`): recorded the pre-execution block —
  - `route_c_diagnostic_attempted=false`
  - `route_c_blocked_reason=approved_diagnostic_connection_unavailable`
  - `route_c_result=unknown`
  - no SQL/psql ran
  - no auth retry ran
  - no Route C attempt executed
  - no Stage0
  - no run-lock touch
  - no DB mutation
  - no production connection value printed or stored

---

## Purpose

Define **safe custody / availability requirements** for a future approved diagnostic/admin
connection used **only** for the Route C catalog/metadata diagnostic from PR #300.

This document answers:

- **What kind of connection is needed?**
- **How can it be supplied safely?**
- **What must never be printed or inspected?**
- **What preflight labels prove availability without exposing the value?**
- **What future GO is required before using it?**

---

## Required connection class

- The future diagnostic requires an **approved diagnostic/admin connection** capable of the
  **catalog/metadata-only read checks** needed by PR #300.
- The connection **must not be the target role being diagnosed**.
- The connection **must not be `buyerrecon_stage0_runner`**.
- The connection **must not require printing or exposing the DSN**.
- The connection **must be supplied only through an approved custody path**.
- The connection **value itself must remain hidden** at all times.

---

## Approved custody-source categories

Allowed custody-source categories — **labels only, no values**:

- `approved_operator_hidden_input`
- `approved_secret_manager_reference`
- `approved_controlled_shell_variable`
- `approved_deployment_metadata_reference`
- `approved_admin_custody_handoff`

For **each** category:

- Values **must never be printed**.
- Values **must never be copied into docs**.
- Values **must never be echoed**.
- Values **must never be committed**.
- Values **must never be inspected** for host/port/user/password.
- **Only boolean presence / category labels may be emitted.**

---

## Disallowed custody methods

The following are **forbidden**:

- Searching the server for a DSN value.
- Printing environment values.
- `cat`/`grep` of `.env.production` or secret files.
- Echoing `DATABASE_URL`, `ADMIN_DSN`, `APP_DSN`, `STAGE0_RUNNER_DSN`, `RUNNER_DSN`, or any
  DSN-like variable (the **names** may be referenced; the **values** must never be echoed).
- Printing host, port, username, password, token, service detail, or connection component.
- Inspecting `pg_hba` raw lines.
- Copying a connection string into chat, docs, shell history, git, issue/PR body, or evidence
  file.
- Using `buyerrecon_stage0_runner` itself for the diagnostic connection.
- Running psql / auth retry merely to test a guessed connection.
- Guessing / defaulting host / port / user / database.

---

## Safe availability proof labels

A future custody-availability proof may emit **only** labels like:

```text
approved_diagnostic_connection_available=true|false
approved_diagnostic_connection_source_category=approved_operator_hidden_input|approved_secret_manager_reference|approved_controlled_shell_variable|approved_deployment_metadata_reference|approved_admin_custody_handoff|unknown
approved_connection_value_printed=false
host_port_printed=false
dsn_printed=false
credential_printed=false
service_detail_printed=false
env_file_inspected=false
custody_contents_printed=false
connection_components_inspected=false
target_role_used_as_diagnostic_connection=false
auth_retry_executed=false
psql_executed=false
sql_executed=false
route_c_diagnostic_executed=false
stage0_executed=false
run_lock_touched=false
```

---

## Future preflight sequence

A future preflight sequence that is **labels-only** and **does not touch values**:

1. Confirm **PR #300 merge is present**.
2. Confirm **PR #301 merge is present**.
3. Confirm the **working tree is clean** (except pre-existing untracked `deep-research-report*`
   files).
4. Confirm the **command-pack file exists**
   (`docs/sprint3-stage0-route-c-role-connection-policy-diagnostic-command-pack.md`).
5. Confirm an **approved custody source exists by category only**.
6. Confirm **no value has been printed**.
7. Confirm the **target role is not being used** as the diagnostic/admin connection.
8. Confirm **future execution still requires a fresh explicit scoped HELEN GO**.

> Do **not** include commands that print values. Do **not** include commands that read
> `.env.production`. Do **not** include commands that run psql.

---

## Future Route C retry conditions

A future Route C diagnostic retry may **only** be considered if **all** are true:

- `approved_diagnostic_connection_available=true`
- `approved_diagnostic_connection_source_category` is **not** `unknown`
- `approved_connection_value_printed=false`
- `dsn_printed=false`
- `host_port_printed=false`
- `credential_printed=false`
- `target_role_used_as_diagnostic_connection=false`
- `auth_retry_executed=false` during custody preflight
- `psql_executed=false` during custody preflight
- `sql_executed=false` during custody preflight
- a **fresh explicit scoped HELEN GO** is issued for exactly **one** Route C diagnostic attempt
  under PR #300

---

## Does NOT authorize

This PR does **NOT** authorize:

- Route C execution
- Route C retry
- SQL
- psql
- auth retry
- Stage0
- run-lock touch
- DB mutation
- role creation
- role alteration
- grants or revokes
- credential rotation
- custody write
- custody value retrieval
- `.env.production` inspection
- DSN discovery
- host/port discovery
- `pg_hba` inspection
- Route B
- Step2E
- remediation
- workers/extractors
- deploy
- runtime command
- Lane/scoring
- AMS runtime
- customer output
- Gate4E
- Gate4F

---

## Route decision after custody plan

- If a **valid approved custody source exists**, a future **fresh scoped Helen GO** may authorize
  **one** Route C diagnostic attempt using PR #300.
- If **no approved custody source exists**, Route C **remains blocked**.
- If a custody source exists **but would require printing or inspecting values**, Route C
  **remains blocked** and custody **must be redesigned**.
- If the **target role would be used** as the diagnostic connection, Route C **remains blocked**.
- **No diagnostic rerun is authorized by this PR.**

---

## Validation

Safe validation run for this docs-only PR (and only these):

- `npm run check:constants`
- `git diff --check`
- changed file list check (exactly one added docs file)
- secret/raw sweep over the new doc
- high-entropy sweep over the new doc

**Not** run: `npm test` / `npm run test`, `npx tsc --noEmit`, `npm run build`, `npm run lint`,
SQL, psql, Route C, Stage0, auth retry, workers, extractors, deploys, runtime commands, production
commands, Lane/scoring, AMS runtime, customer-output actions.

Validation expectations:

- Changed file list shows **exactly one added docs file**.
- Secret/raw sweep finds **no** raw `pg_hba`, host, port, IP, DSN, credential, service details,
  connection string, role password/hash, `.env.production` value, custody content, customer
  payload, PII, raw PostgreSQL error text, or env-var values.
- High-entropy matches are **public commit hashes only**, if any.
- `check:constants` passes.
- `git diff --check` passes.
- Working tree is clean after commit/push (except pre-existing untracked `deep-research-report*`
  files).

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, bearer token, raw token, raw UUID, IP address (public or local), IPv6 address, host
value, port value, real URI, login source, host/network detail, **raw `pg_hba` lines**, raw
payload, customer row data, real `session_id` / `request_id` value, **raw psql output, raw
PostgreSQL error text**, env-var value, or customer data. The role name `buyerrecon_stage0_runner`
and the DSN environment-variable **names** referenced above (`DATABASE_URL`, `ADMIN_DSN`,
`APP_DSN`, `STAGE0_RUNNER_DSN`, `RUNNER_DSN`) are **non-secret identifiers / variable names** —
**no** value of any of them is read, printed, inferred, decoded, or stored. The recorded commit
hashes are **public**. All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit hashes — not secret or row values. This plan obtains no connection,
changes no custody, and validates no credential.
