# Sprint 3 — Stage 0 — `STAGE0_RUNNER_DSN` Custody Structure Diagnostic — Evidence (custody value structurally INCOMPLETE)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_RUNNER_DSN_CUSTODY_STRUCTURE_INCOMPLETE`

This is a **docs-only evidence record**. After the PR #273 merge (and **no** RB-ROTATE
execution), the operator ran a **safe, structure-only diagnostic** against the existing
custody file `/etc/buyerrecon/stage0-runner.env`. The diagnostic inspected **only whether the
existing `STAGE0_RUNNER_DSN` value is structurally complete** and printed **booleans only** —
it did **not** print the DSN value, password, host, port, username, database name, raw
connection string, or any custody contents.

**Finding: the `STAGE0_RUNNER_DSN` key exists, but its current value is NOT a complete
PostgreSQL URI** — it has no scheme, netloc, hostname, username, or password; it has only a
path-like component, and that path is **not** `/buyerrecon_production`. Therefore the operator
**must not** guess the DB host or construct a DSN manually from this value, and the **RB-ROTATE
retry must remain blocked** pending a separate DSN custody correction / source-of-truth plan.

**This is a safe structural diagnostic only — no RB-ROTATE execution, no confirmation token
entered, no password rotation, no custody write, no psql/auth rerun, no Stage 0 / run-lock.**
This PR records safe **booleans/category tokens / public commit hashes only**.

> Provenance: PR #273 RB-ROTATE retry cancelled at confirmation
> (`c2ab1742c7e16d5e0b69928fa4eac4883df90545`,
> `STAGE0_AUTH_OR_CREDENTIAL_RB_ROTATE_RETRY_OPERATOR_CANCELLED_BLOCKED`); PR #272 corrected
> PR #270-aligned RB-ROTATE command-pack plan
> (`0e36a7f848db4cf13cb16f8f3a44122560fccc75`); PR #270 simple-confirmation-token plan
> (`9f437c04a51fbb7a94ccde9a55d18006ea29616e`); PR #262 revised classifier classified
> `auth_or_credential` (`155737d007dcf43c40eb4db43546705562c9424e`).

---

## 1. Authorization & Scope

- This was a **safe structure-only diagnostic** of the existing custody file — **not** an
  RB-ROTATE execution. **No** confirmation token `RB-ROTATE` was entered.
- The diagnostic did **not** rotate any password, write/overwrite custody, run psql/auth,
  touch the run-lock, run Step 2E, or run Stage 0.
- The diagnostic printed **booleans only** about structural completeness of the existing
  `STAGE0_RUNNER_DSN` value; it did **not** print the value or any component.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual structure-only diagnostic)

```text
stage0_runner_dsn_key_present=true
stage0_runner_dsn_outer_single_quoted=false
stage0_runner_dsn_outer_double_quoted=false
stage0_runner_dsn_scheme_present=false
stage0_runner_dsn_netloc_present=false
stage0_runner_dsn_hostname_present=false
stage0_runner_dsn_username_present=false
stage0_runner_dsn_password_present=false
stage0_runner_dsn_path_present=true
stage0_runner_dsn_dbname_is_buyerrecon_production=false
stage0_runner_dsn_shape_complete=false
```

> **Note (booleans are structural only).** Every label above is a structural predicate over
> the existing value (presence/absence of URI parts), computed internally. **No** DSN value,
> password, host, port, username, database name, raw connection string, or custody content is
> revealed by these booleans.

---

## 3. Interpretation (bounded)

- The **`STAGE0_RUNNER_DSN` key exists** (`stage0_runner_dsn_key_present=true`).
- The current custody value is **not** a complete PostgreSQL URI
  (`stage0_runner_dsn_shape_complete=false`):
  - **no scheme** (`stage0_runner_dsn_scheme_present=false`),
  - **no netloc** (`stage0_runner_dsn_netloc_present=false`),
  - **no hostname** (`stage0_runner_dsn_hostname_present=false`),
  - **no username** (`stage0_runner_dsn_username_present=false`),
  - **no password** (`stage0_runner_dsn_password_present=false`).
- It **does** have a path-like component (`stage0_runner_dsn_path_present=true`), but that path
  is **not** `/buyerrecon_production`
  (`stage0_runner_dsn_dbname_is_buyerrecon_production=false`).
- It is **not** outer-quoted (`stage0_runner_dsn_outer_single_quoted=false`,
  `stage0_runner_dsn_outer_double_quoted=false`).

### 3.1 Why this matters
- This is a concrete, secret-safe explanation consistent with the long-standing
  `auth_or_credential` family: if the runner connection source is **structurally incomplete**
  (no scheme/host/user/password), a worker reading it cannot authenticate as
  `buyerrecon_stage0_runner` — which is exactly the kind of fault that would surface as an
  auth/credential failure.
- **The operator must NOT** guess the DB host, port, username, or database name, or construct
  a DSN manually from this incomplete value. Doing so would be unverified guessing of
  connection details.
- The **RB-ROTATE retry must remain blocked**: rotating the DB password and writing a custody
  DSN is only safe once the **correct, complete DSN source-of-truth** is established. Writing a
  guessed/incomplete DSN would re-introduce the very ambiguity Route B exists to eliminate.

### 3.2 Bounded conclusion
- This diagnostic establishes, secret-safely, that the **existing custody value is structurally
  incomplete** and is **not** a usable `buyerrecon_production` PostgreSQL URI.
- It does **not** reveal the value or any component.
- It does **not** prove what the correct DSN should be; it only proves the **current** one is
  not complete.
- It does **not** authorize credential rotation, custody write, psql/auth rerun, Option A
  rerun, Step 2E, or Stage 0.

---

## 4. What Did Not Happen

- No RB-ROTATE execution; no confirmation token entered.
- No PostgreSQL password rotation; no role altered.
- No custody write or overwrite.
- No psql/auth rerun; no Option A preflight rerun.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grant/schema/table/data change.
- No source-selection change; no Option B code change.
- No runtime / downstream / Lane A/B / scoring / AMS / customer output; no Gate 4E; no
  Gate 4F.
- No DSN value, password, DSN component, host, port, username, database name, raw connection
  string, raw custody contents, raw PostgreSQL/psql output, or hidden typed value printed.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 5. Verdict

- **CUSTODY VALUE STRUCTURALLY INCOMPLETE (safe diagnostic) —
  `stage0_runner_dsn_shape_complete=false`**: the `STAGE0_RUNNER_DSN` key exists, but its
  current value is not a complete PostgreSQL URI (no scheme/netloc/hostname/username/password;
  path present but not `/buyerrecon_production`).
- This is **not** a value/secret disclosure, **not** a proof of the correct DSN, **not**
  authorization for any rotation/custody/psql action, and **not** a Stage 0 readiness proof.
- The **RB-ROTATE retry remains blocked** pending a separate DSN custody correction /
  source-of-truth plan.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** guess the DB host/port/username/database, construct a DSN manually from the
   incomplete value, run another RB-ROTATE retry, rotate the password, write/overwrite
   custody, rerun psql/auth, run an Option A preflight, run Step 2E, run Stage 0, touch the
   run-lock, or perform remediation off this evidence.
3. After this evidence PR is reviewed/merged, create a **separate docs-only DSN custody
   correction / source-of-truth plan** that establishes the **correct, complete**
   `STAGE0_RUNNER_DSN` for `buyerrecon_stage0_runner` (a verified source of truth — never a
   guessed/constructed value), secret-safe (presence/structure/authority only; never printing,
   parsing, or exposing the value). Only after that plan is reviewed/merged may a new
   RB-ROTATE retry be GO-gated.
4. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, Node stack trace, or the operator's typed hidden value, or customer
data. The diagnostic was **structure-only**: it computed boolean predicates over the existing
`STAGE0_RUNNER_DSN` value (presence/absence of URI scheme, netloc, hostname, username,
password, path, outer quoting, and whether the dbname equals `buyerrecon_production`) and
printed **only those booleans** — it did **not** print, parse into output, echo, or log the
value or any DSN component, and it did **not** rotate, write, or connect. The role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, the
env-var/key name `STAGE0_RUNNER_DSN`, and the non-secret reference token
`buyerrecon_production` (a database-name identifier used only in a structural comparison, not a
secret) are non-secret control identifiers. (Per the PR #218 Codex note: "no secret used or
exposed" is to be read as "no secret value exposed, printed, or recorded.") All values above
are safe labels / booleans / category tokens / non-secret identifiers / public git commit
hashes — not secret or row values.
