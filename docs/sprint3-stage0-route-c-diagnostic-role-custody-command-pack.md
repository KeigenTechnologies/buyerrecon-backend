# Stage0 Route C Diagnostic Role + Custody Command Pack

## Status

**Status:** `STAGE0_ROUTE_C_DIAGNOSTIC_ROLE_CUSTODY_COMMAND_PACK_REVIEW_ONLY`

- **Review-only.**
- **Docs-only.**
- This document **does not authorize execution**.
- This document **does not authorize Route C diagnostic execution**.
- This document **does not authorize SQL or psql**.
- This document **does not authorize** `CREATE ROLE`, `ALTER ROLE`, `GRANT`, `REVOKE`, DDL, DML,
  credential generation, credential rotation, custody write, secret-manager write, env mutation,
  `.env.production` inspection, DSN discovery, or connection-value retrieval.
- This document **does not authorize** Stage0, run-lock touch, workers, extractors, Lane/scoring,
  AMS runtime, customer output, Gate4E, or Gate4F.
- **Future execution requires a separate explicit scoped HELEN GO.**

This record is a reviewable **design** for a **future**, separately GO-gated procedure. It
executes nothing and changes nothing. **No** secret value, DSN, connection string, host, port, IP,
username, password, token, private key, `pg_hba` line, service detail, `.env.production` value,
custody content, role password/hash, customer payload, PII, raw PostgreSQL error text, or
connection component appears in this document.

---

## Evidence chain

- **PR #300** (`133409b36fc15ab9c0fdaa0f4ff7eadd325f5dba`): merged the Route C role /
  connection-policy diagnostic command pack.
- **PR #301** (`b5ca339e8e2d4231e81e736d8ab6cd728f4b4283`): recorded the pre-execution block —
  - `route_c_diagnostic_attempted=false`
  - `route_c_blocked_reason=approved_diagnostic_connection_unavailable`
  - `route_c_result=unknown`
  - no SQL/psql ran
  - no auth retry ran
  - no Route C diagnostic attempt executed
  - no Stage0
  - no run-lock touch
  - no DB mutation
  - no production connection value printed or stored
- **PR #302** (`6fc63239c9327be8ca005f438e65bfbcecdabbd1`): established the approved custody-source
  categories and confirmed that a future retry requires `approved_diagnostic_connection_available=true`,
  a non-`unknown` source category, value not printed, target role not used as the diagnostic
  connection, no custody-preflight SQL/psql/auth retry, and a fresh scoped Helen GO.

---

## Purpose

Define a **future** command pack to **create and custody a dedicated minimum-privilege diagnostic
role** for Route C catalog/metadata diagnostics.

The command pack must solve the PR #301 block: **the approved diagnostic/admin connection was
unavailable.** It must do this **without**:

- reusing the application primary connection;
- using `buyerrecon_stage0_runner` itself;
- searching the server for existing DSNs;
- printing connection values;
- exposing secret material;
- running the Route C diagnostic during role creation / custody setup.

---

## Proposed dedicated diagnostic role

Candidate role name: **`buyerrecon_route_c_diag`**.

- This is a **candidate** dedicated diagnostic role name.
- It must be **separate from** `buyerrecon_stage0_runner`.
- It must be **separate from** application / collector / runtime roles.
- It must be **`NOINHERIT`** unless a future review proves otherwise.
- It must **not** be `SUPERUSER`.
- It must **not** have `CREATEROLE`.
- It must **not** have `CREATEDB`.
- It must **not** have `REPLICATION`.
- It must **not** have `BYPASSRLS`.
- It must **not** own application tables.
- It must **not** have write privileges on application tables.
- It exists **only** to run the PR #300 catalog/metadata-only Route C diagnostic.

---

## Minimum privilege target

The future diagnostic role should have **only** the privileges needed to run the PR #300
diagnostic safely.

Candidate minimum privilege set:

- `LOGIN`
- `CONNECT` on the relevant production database
- metadata/catalog visibility sufficient for:
  - checking whether `buyerrecon_stage0_runner` exists;
  - checking whether `buyerrecon_stage0_runner` can login;
  - checking `VALID UNTIL` state;
  - checking connection-limit state;
  - checking `CONNECT` privilege;
  - checking required membership/grant categories, if safely queryable;
- optional `pg_read_all_stats` or equivalent **only if** required for connection-limit
  classification, and **only after** review.

Explicitly do **NOT** grant:

- `SUPERUSER`
- `CREATEROLE`
- `CREATEDB`
- `REPLICATION`
- `BYPASSRLS`
- table write privileges
- schema mutation privileges
- broad application data read privileges
- customer data read privileges
- owner privileges
- runtime/service role membership unless separately reviewed

If any diagnostic category would require broader privileges than this, classify it as **`unknown`**
rather than broadening the role.

---

## Candidate SQL design

> Every block below is **CANDIDATE ONLY — DO NOT RUN**, for a future separately-GO-gated
> role-custody setup step only.

Candidate SQL must:

- avoid selecting password/hash columns;
- avoid `pg_hba` inspection;
- avoid raw connection strings;
- avoid host/port/DSN/service details;
- avoid customer data;
- avoid DML against application data;
- be limited to role creation / grant setup only;
- be executed only in a **future separately GO-gated** role-custody setup step.

```sql
-- CANDIDATE ONLY — DO NOT RUN
BEGIN;

CREATE ROLE buyerrecon_route_c_diag
  LOGIN
  NOINHERIT
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

COMMENT ON ROLE buyerrecon_route_c_diag IS
  'Dedicated minimum-privilege Route C catalog/metadata diagnostic role; no application data writes; no customer output.';

GRANT CONNECT ON DATABASE <DATABASE_NAME_PLACEHOLDER> TO buyerrecon_route_c_diag;

-- Optional only if reviewed as required:
-- GRANT pg_read_all_stats TO buyerrecon_route_c_diag;

COMMIT;
```

Important:

- Use a **placeholder only** for the database name (`<DATABASE_NAME_PLACEHOLDER>`).
- Do **not** include a real database name if it would reveal production connection details beyond
  already-registered public identifiers.
- Do **not** include passwords.
- Do **not** include host/port/DSN.
- Do **not** include `ALTER ROLE ... PASSWORD` in a printed command unless it uses a **non-printed
  hidden variable placeholder** and is explicitly marked candidate-only.

---

## Password / secret generation design

Future **design only** — nothing is generated, set, or stored here.

Allowed future patterns:

1. Admin/operator generates the password **locally** using a secret-safe method that **does not
   print it**.
2. Password is supplied to psql through a **hidden variable** or **secret-manager injection**.
3. Password **never** appears in shell output, shell history, docs, PR body, logs, evidence files,
   or chat.
4. Password is **never** pasted into this document.
5. Connection string is assembled **only inside an approved custody tool or hidden local shell
   context** and is **never** printed.

Disallowed:

- echoing the password;
- printing the DSN;
- storing the password in git;
- writing the password to `.env.production`;
- writing the password to docs;
- writing the password to shell history;
- copying the password or DSN into chat;
- using an existing application DSN as a shortcut;
- reading existing `.env.production` to derive host/port/user/database;
- guessing host/port/user/database.

---

## Approved custody write design

Future custody storage may use one of the PR #302 categories:

- `approved_secret_manager_reference`
- `approved_admin_custody_handoff`
- `approved_operator_hidden_input`
- `approved_controlled_shell_variable`
- `approved_deployment_metadata_reference`

For persistent custody, **preferred category: `approved_secret_manager_reference`**.

This command pack:

- does **not** name a real secret path unless already approved;
- does **not** write a secret now;
- requires a **separate scoped HELEN GO** for any future secret-manager write;
- requires that any secret-manager command be **reviewed to ensure it does not echo the value**.

Evidence may record **only**:

```text
custody_write_attempted=true|false
custody_source_category=approved_secret_manager_reference|approved_admin_custody_handoff|approved_operator_hidden_input|approved_controlled_shell_variable|approved_deployment_metadata_reference|unknown
custody_value_printed=false
secret_manager_reference_printed=false   # unless the reference NAME is explicitly approved as non-secret
dsn_printed=false
host_port_printed=false
credential_printed=false
```

---

## Candidate shell design

> Every block below is **CANDIDATE ONLY — DO NOT RUN**.

Shell design may show only **safe patterns**: a hidden read for secret input; writing to a secret
manager through stdin / environment injection **without echo**; immediate unset of secret-bearing
variables; output of **boolean labels only**.

- Do **not** include any command that prints or `cat`s env files.
- Do **not** include any command that echoes secret variables.
- Do **not** include any command that `grep`s `.env.production`.
- Do **not** include any command that prints host/port/DSN/user/password.

```bash
# CANDIDATE ONLY — DO NOT RUN
read -rsp 'Paste generated diagnostic role password: ' ROUTE_C_DIAG_PASSWORD; echo
echo 'diagnostic_password_loaded=true'

# Secret-manager write command placeholder.
# Must be replaced by a reviewed secret-manager command that consumes the secret via stdin/env
# without printing. DO NOT RUN until reviewed and GO-gated.

unset ROUTE_C_DIAG_PASSWORD
echo 'diagnostic_password_unset=true'
```

There is **no** standard safe secret-manager CLI pattern established in this repository for this
purpose yet, so the secret-manager write command is left as a **placeholder** and marked
**PENDING_HELEN_REVIEW**; it must not be invented or run here.

---

## Approved proof labels for future execution

Labels for a future role/custody setup step:

```text
route_c_diag_role_setup_attempted=true
pr300_merge_present=true|false
pr301_merge_present=true|false
pr302_merge_present=true|false
tracked_working_tree_clean=true|false
diagnostic_role_name=buyerrecon_route_c_diag
diagnostic_role_created=true|false|unknown
diagnostic_role_can_login=true|false|unknown
diagnostic_role_superuser=false
diagnostic_role_createrole=false
diagnostic_role_createdb=false
diagnostic_role_replication=false
diagnostic_role_bypassrls=false
diagnostic_role_table_write_privileges=false|unknown
diagnostic_role_customer_data_read_privileges=false|unknown
diagnostic_role_connect_privilege=true|false|unknown
diagnostic_role_pg_read_all_stats=granted|not_granted|unknown
password_printed=false
password_hash_printed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
connection_components_printed=false
env_file_inspected=false
custody_write_attempted=true|false
custody_write_succeeded=true|false|unknown
custody_source_category=approved_secret_manager_reference|approved_admin_custody_handoff|approved_operator_hidden_input|approved_controlled_shell_variable|approved_deployment_metadata_reference|unknown
custody_value_printed=false
db_mutation_executed=true|false
stage0_executed=false
run_lock_touched=false
route_c_diagnostic_executed=false
route_c_diag_role_setup_result=created_and_custodied|created_not_custodied|already_exists_verified|blocked|unknown
```

> Note: because role creation is a DB mutation, future execution labels may include
> `db_mutation_executed=true` **only inside the separately GO-gated role/custody setup execution**.
> **This command-pack PR itself must not mutate the DB.**

---

## Future execution stop-lines

Future role/custody setup must **stop** if:

- the **PR #300 merge** is not present;
- the **PR #301 merge** is not present;
- the **PR #302 merge** is not present;
- the working tree is **dirty** (except pre-existing untracked `deep-research-report*` files);
- the **approved admin/owner DB connection** for role creation is unavailable;
- any command would **print** password, password hash, DSN, host, port, username, credential,
  connection components, `.env.production` values, custody contents, `pg_hba` raw lines, customer
  payload, PII, or raw PostgreSQL error text;
- any command would **use an existing application DSN** as a shortcut;
- any command would **use `buyerrecon_stage0_runner`** as the diagnostic role connection;
- any command would **grant** `SUPERUSER`, `CREATEROLE`, `CREATEDB`, `REPLICATION`, `BYPASSRLS`,
  broad app-data read, table write, or owner privileges;
- any command would **touch Stage0 or the run-lock**;
- any command would **execute the Route C diagnostic** as part of role/custody setup;
- any command would **run** workers, extractors, deploys, runtime, Lane/scoring, AMS runtime,
  Gate4E, Gate4F, or customer output;
- any proof output **cannot be reduced to approved labels**.

---

## Route decision after future role/custody setup

- If the role is **created and custody is written safely**, the next step is a **custody
  availability proof**.
- If the role **exists but privileges differ**, **re-plan** before correction.
- If the **custody write is blocked**, Route C **remains blocked**.
- If **role creation is blocked**, **re-plan**.
- If **secret-safety cannot be preserved**, **stop**.
- **No Route C diagnostic rerun is authorized by this PR.**

---

## Does NOT authorize

This PR does **NOT** authorize:

- role creation
- role alteration
- role password setting
- grants
- revokes
- secret generation
- secret manager write
- custody write
- DB mutation
- SQL
- psql
- Route C diagnostic
- Route C retry
- Stage0
- run-lock touch
- auth retry
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
- Secret/raw sweep finds **no** raw `pg_hba`, host, port, IP, DSN value, credential, service
  details, connection string, role password/hash, `.env.production` value, custody content,
  customer payload, PII, raw PostgreSQL error text, env-var values, token/private-key patterns, or
  DSN URI patterns.
- High-entropy matches are **public commit hashes only**, if any.
- `check:constants` passes.
- `git diff --check` passes.
- Working tree is clean after commit/push (except pre-existing untracked `deep-research-report*`
  files).

---

## Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, bearer token, raw token, private key, raw UUID, IP address (public or local), IPv6
address, host value, port value, real URI, login source, host/network detail, **raw `pg_hba`
lines**, raw payload, customer row data, real `session_id` / `request_id` value, **raw psql output,
raw PostgreSQL error text**, env-var value, or customer data. The role names
`buyerrecon_route_c_diag` (candidate) and `buyerrecon_stage0_runner` are **non-secret identifiers**;
the database name is shown only as the placeholder `<DATABASE_NAME_PLACEHOLDER>`; the recorded
commit hashes are **public**. All candidate SQL/shell blocks are marked **CANDIDATE ONLY — DO NOT
RUN**. All values above are safe labels / booleans / category tokens / non-secret identifiers /
public git commit hashes — not secret or row values. This command pack creates no role, sets no
password, writes no custody, and runs nothing.
