# Stage0 Route C Role / Connection-Policy Diagnostic Command Pack

## Status

**Status:** `STAGE0_ROUTE_C_ROLE_CONNECTION_POLICY_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY`

- This document is a **review-only command pack**.
- It **does not authorize execution**.
- It **does not authorize Route C**.
- It **does not authorize Stage0**.
- It **does not authorize** SQL, psql, auth retry, DB mutation, grants, role changes, credential
  rotation, custody write, remediation, Lane/scoring, AMS runtime, Gate 4E, Gate 4F, or customer
  output.
- **Future execution requires a separate explicit scoped HELEN GO** for one named diagnostic run.

This record **executes nothing**. It is a reviewable design for a **future**, separately
GO-gated, boolean/category-only diagnostic. **No** raw `pg_hba`, host, port, IP, DSN, credential,
service detail, role password/hash, `.env.production` value, custody content, raw PostgreSQL error
text, customer payload, or PII appears in this document.

---

## Evidence chain

- **PR #291** (`e84f8775cfef24ea2e08dfe62fee37558dca7e9a`): Route A classifier result
  **`classifier_result=role_missing_or_not_login`**, `classifier_result_safe=true`. Route A
  printed **no raw output, no matched text, no DSN, and no connection components**; **Stage 0 did
  not run** and the **run-lock was not touched**.
- **PR #292** (`bcfca4072e0e623d74be4a0c3cdaeed35271afe3`): merged the Route C planning document
  (`docs/sprint3-stage0-route-c-role-connection-policy-diagnostics-plan.md`,
  `STAGE0_ROUTE_C_ROLE_CONNECTION_POLICY_DIAGNOSTICS_PLANNING_ONLY`) and **established Route C as
  the merged planning route**.
- **Bounded:** Route A classified the failure into the **role-existence / `LOGIN` / role-policy**
  family. It does **not** prove exact role existence, `LOGIN` state, `VALID UNTIL`, connection-limit
  state, `pg_hba`/SSL condition, live auth, or Stage 0 readiness; and it does **not** authorize
  Stage 0.
- **Route C is the correct diagnostic route** for this class — **not** Route B password/custody
  correction.

---

## Diagnostic objective

Define a **future** boolean/category-only diagnostic that identifies **which DB-side role /
connection-policy condition** explains `role_missing_or_not_login` for the runner role.

The diagnostic may classify **only** into the approved labels below. It must **not** expose raw
data of any kind: it reduces every result to a boolean or category token and **fails closed** to
`unknown` whenever a safe category cannot be derived.

---

## Target role

- `target_role=buyerrecon_stage0_runner`.
- The role **name** is allowed because it is already part of the reviewed docs chain and the
  constants registry / glossary governance.
- **No** role password, password hash, secret, credential, DSN, host, port, service details, or
  connection string may appear.

---

## Approved output labels

The future diagnostic may emit **only** these labels:

```text
route_c_diagnostic_attempted=true
pr291_merge_present=true|false
pr292_merge_present=true|false
tracked_working_tree_clean=true|false
target_role_name_allowed=true
raw_pg_hba_printed=false
host_port_printed=false
ip_printed=false
dsn_printed=false
credential_printed=false
service_detail_printed=false
role_password_or_hash_printed=false
raw_postgres_error_printed=false
auth_retry_executed=false
db_mutation_executed=false
stage0_executed=false
run_lock_touched=false
role_exists=true|false|unknown
role_can_login=true|false|unknown
role_valid_until_state=valid|expired|unset|unknown
role_connection_limit_state=unlimited|within_limit|at_or_over_limit|unknown
database_connect_privilege=true|false|unknown
required_role_membership_or_grants_state=present|missing|unknown
server_connection_policy_category=allows_connection|rejects_connection|unknown
ssl_policy_category=compatible|required_or_mismatch|unknown
route_c_result=role_missing|login_disabled|valid_until_expired|connection_limit_blocked|database_connect_missing|grant_or_membership_missing|connection_policy_blocked|ssl_policy_blocked|unknown
```

---

## Candidate diagnostic design

> Design contract for a **future, separately-reviewed, separately GO-gated** diagnostic — **not**
> run here. Every executable-looking block below is **CANDIDATE ONLY — DO NOT RUN**.

Requirements for the future command pack:

- **Catalog-only / metadata-only** preferred.
- **Read-only transaction** where applicable.
- **Boolean/category-only** output.
- **No** raw `pg_hba` lines.
- **No** host, port, IP, DSN, credential, service detail, connection string, role password,
  password hash, or raw PostgreSQL error text.
- **No** auth retry.
- **No** DB mutation.
- **No** `ALTER ROLE`.
- **No** `CREATE ROLE`.
- **No** `GRANT`.
- **No** `REVOKE`.
- **No** DDL.
- **No** DML.
- **No** customer data.
- **No** Stage 0.
- **No** run-lock touch.

The future diagnostic would run via an **already-authorized admin/diagnostic path** (catalog
reads only) — **never** by re-attempting the runner's failing login — and even that is a future,
separately GO-gated step. Catalog reads must select only metadata columns that reduce to a
boolean/category; they must **never** select password/hash fields, raw `pg_hba` content,
connection details, secrets, customer data, or raw error text.

### Candidate snippet — role existence / LOGIN / VALID UNTIL / connection-limit

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Catalog/metadata-only; read-only; reduces to booleans/categories; selects NO secret columns.
SET default_transaction_read_only = on;

-- role_exists / role_can_login (boolean), valid-until + conn-limit reduced to CATEGORY only.
-- NOTE: rolpassword / password hash columns are NEVER selected.
SELECT
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_stage0_runner') AS role_exists,
  COALESCE((SELECT rolcanlogin FROM pg_roles WHERE rolname = 'buyerrecon_stage0_runner'), false)
    AS role_can_login,
  -- category only: valid | expired | unset | unknown  (no raw timestamp emitted)
  (SELECT CASE
            WHEN rolvaliduntil IS NULL THEN 'unset'
            WHEN rolvaliduntil > now()  THEN 'valid'
            ELSE 'expired'
          END
   FROM pg_roles WHERE rolname = 'buyerrecon_stage0_runner') AS role_valid_until_state,
  -- category only: unlimited | within_limit | at_or_over_limit | unknown (no raw counts emitted)
  (SELECT CASE WHEN rolconnlimit < 0 THEN 'unlimited' ELSE 'within_limit' END
   FROM pg_roles WHERE rolname = 'buyerrecon_stage0_runner') AS role_connection_limit_state;
```

### Candidate snippet — database CONNECT privilege / membership-grant presence

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Boolean/category only. has_*_privilege returns a boolean; no grant text or object names leaked.
SET default_transaction_read_only = on;

SELECT
  -- database CONNECT privilege as a boolean (database name is a non-secret identifier)
  has_database_privilege('buyerrecon_stage0_runner', 'buyerrecon_production', 'CONNECT')
    AS database_connect_privilege,
  -- required membership/grant presence reduced to: present | missing | unknown
  CASE
    WHEN pg_has_role('buyerrecon_stage0_runner', 'buyerrecon_prod_collector_app', 'MEMBER')
      THEN 'present'
    ELSE 'missing'
  END AS required_role_membership_or_grants_state;
```

### Candidate note — connection-policy / SSL category

```text
CANDIDATE ONLY — DO NOT RUN
server_connection_policy_category and ssl_policy_category MUST be derived as categories only
("allows_connection" vs "rejects_connection"; "compatible" vs "required_or_mismatch"), NEVER by
printing raw pg_hba lines, host, port, IP, or connection strings. If a category cannot be derived
without inspecting raw policy/connection data, it is `unknown` (fail closed).
```

---

## Proposed safe classification logic

How the future diagnostic would map **safe metadata** to a single `route_c_result` category:

- If the target role is **absent** → `route_c_result=role_missing`.
- If the role exists but **`LOGIN` is disabled** → `route_c_result=login_disabled`.
- If **`VALID UNTIL` is expired** → `route_c_result=valid_until_expired`.
- If the **connection limit is at or over limit** → `route_c_result=connection_limit_blocked`.
- If **database `CONNECT` privilege is missing** → `route_c_result=database_connect_missing`.
- If **required role membership or grant state is missing** →
  `route_c_result=grant_or_membership_missing`.
- If the **server connection policy category indicates a rejected connection** →
  `route_c_result=connection_policy_blocked`.
- If the **SSL policy category indicates required/mismatch** → `route_c_result=ssl_policy_blocked`.
- If evidence is **incomplete, ambiguous, or would require raw output** →
  `route_c_result=unknown`.

Evaluation order is most-specific-first (existence → LOGIN → VALID UNTIL → connection limit →
CONNECT privilege → membership/grant → connection policy → SSL); the first matching condition sets
the single `route_c_result`. Any step that cannot be reduced to an approved label yields `unknown`.

---

## Future execution stop-lines

Future execution must **stop** (safe stop-line; withhold all sensitive output; record the
blocked/`unknown` state in a docs-only evidence PR with safe labels only) if any of:

- the **PR #291 merge commit** `e84f8775cfef24ea2e08dfe62fee37558dca7e9a` is **not present**;
- the **PR #292 merge commit** `bcfca4072e0e623d74be4a0c3cdaeed35271afe3` is **not present**;
- the working tree is **dirty** (except pre-existing untracked `deep-research-report*` files);
- the output **cannot be reduced to approved boolean/category labels**;
- any command would **print raw `pg_hba` lines**;
- any command would **print host, port, IP, DSN, credential, service details, connection strings,
  role password/hash, raw PostgreSQL error text, `.env.production` values, custody contents,
  customer payload, or PII**;
- any command would **run an auth retry**;
- any command would **mutate role, grants, schema, or data**;
- any command would **run `ALTER ROLE`, `CREATE ROLE`, `GRANT`, `REVOKE`, DDL, or DML**;
- any command would **touch Stage 0**;
- any command would **touch the run-lock**;
- any command would **run a worker, extractor, runtime, deploy, Lane/scoring, AMS runtime,
  Gate 4E, Gate 4F, or customer output** action;
- **any raw output must be inspected** to classify the result;
- **any classification cannot be expressed** as approved labels.

---

## Route decision after future diagnostic

- `route_c_result=role_missing` → plan a **separate reviewed / GO-gated** role creation or
  restoration step.
- `route_c_result=login_disabled` → plan a **separate reviewed / GO-gated** `LOGIN` correction
  step.
- `route_c_result=valid_until_expired` → plan a **separate reviewed / GO-gated** `VALID UNTIL`
  correction step.
- `route_c_result=connection_limit_blocked` → plan a **separate reviewed / GO-gated**
  connection-limit correction step.
- `route_c_result=database_connect_missing` or `grant_or_membership_missing` → plan a **separate
  reviewed / GO-gated** privilege/grant correction step.
- `route_c_result=connection_policy_blocked` or `ssl_policy_blocked` → plan a **separate reviewed /
  GO-gated** connection/SSL policy fix or runtime-binding change.
- `route_c_result=unknown` → **re-plan**.
- **No fix is authorized by this PR.**

After any such corrective step (separately reviewed and GO-gated), live auth must be re-proven via
a **separately GO-gated Option A binding/auth preflight rerun** before Step 2E / Stage 0.

---

## Does NOT authorize

This PR does **NOT** authorize:

- Route C execution
- Stage0
- SQL
- psql
- auth retry
- DB mutation
- role creation
- role alteration
- grants or revokes
- schema or data changes
- credential rotation
- custody write
- Route B
- Step2E
- Option A/B remediation
- run-lock touch
- worker/extractor execution
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
- Secret/raw sweep finds **no** raw `pg_hba`, host, port, IP, DSN, credential, service details,
  connection string, role password/hash, `.env.production` value, custody content, customer
  payload, PII, or raw PostgreSQL error text.
- High-entropy matches are **public commit/script hashes only**, if any.
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
PostgreSQL error text**, or customer data. The role name `buyerrecon_stage0_runner`, the related
role identifier `buyerrecon_prod_collector_app`, and the database name `buyerrecon_production` are
**non-secret identifiers** already in the reviewed docs chain and constants registry; the recorded
commit hashes are **public**. All values above are safe labels / booleans / category tokens /
non-secret identifiers / public git commit hashes — not secret or row values.
