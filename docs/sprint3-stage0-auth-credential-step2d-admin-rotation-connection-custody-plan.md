# Sprint 3 — Stage 0 auth/credential Step 2D — Admin/Rotation Connection Custody Resolution Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2D_ADMIN_ROTATION_CONNECTION_CUSTODY_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans **how to identify the
approved admin/rotation connection through the proper custody/admin process** —
**without exposing or recording** any DSN, password, host, port, IP, token, URI, or
raw infrastructure detail — after **Step 2D** (PR #220) blocked before SQL because
the operator did not have/know the approved admin/rotation connection.

This PR **executes nothing** and **authorizes no production command**: no `psql`, no
SQL, no database connection, no password read/use/reset/change, no credential
rotation, no custody value update, no Step 2D rerun, no Step 2E, no Stage 0, no
run-lock touch, no `.env.production` mutation, no runtime/deploy/downstream/customer
action. No real DSN, password, host, port, IP, token, URI, or raw value appears in
this document.

> Provenance: PR #220 Step 2D password rotation blocked — admin connection missing
> (`66fcdbd4a657b40df1b59a270eef4efb60c878a1`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_PASSWORD_ROTATION_BLOCKED_ADMIN_DSN_UNKNOWN`); built
> on PR #219 Step 2D command-pack plan
> (`8ea9ece4438b45356b6a00e4039a751a534522e4`) and PR #218 Step 2C
> `auth_or_credential` reproduced (`92d568a6b7491500db4de1732c3b9015a0ddc14e`).

---

## 1. Planning-Only / No Authorization

- **This is planning-only.** Merging it **authorizes no production command** and no
  database action of any kind.
- It designs the custody-resolution process and the safe evidence contract; it runs
  nothing.
- The operator performs any future custody-resolution steps manually, out of band,
  under a separate fresh GO. Claude Code executes nothing.

---

## 2. Definition — "Approved Admin/Rotation Connection"

The approved admin/rotation connection:

- **Must** be an **administrator / owner-level database connection** capable of
  executing the scoped password rotation for `buyerrecon_stage0_runner`.
- **Must not** be `buyerrecon_stage0_runner` itself.
- **Must not** be a collector / app / runtime DSN **unless** separately **proven and
  approved** as an admin/rotation connection.
- **Must not** be **guessed, reconstructed, inferred from docs, copied from PR #199**
  (or any registry/evidence doc), or **extracted from `.env.production`**.

---

## 3. Allowed Custody Sources

The approved admin/rotation connection may be obtained **only** from:

- an **approved password manager / secret store**;
- an **approved infrastructure / admin console**;
- an **approved DBA / operator handoff**;
- an **existing documented internal custody pointer** **only if it explicitly refers
  to admin/rotation authority**.

In all cases: **no raw value is recorded** in the repo or in any evidence — only the
fact that an approved source was identified and its authority confirmed (safe labels
only).

---

## 4. Forbidden Sources

The connection **must not** be sourced from any of:

- **PR #199** or any registry / evidence doc used as a secret source;
- **`.env.production`**;
- the **app DSN**;
- the **runner DSN** (`buyerrecon_stage0_runner`);
- the **collector DSN**;
- **guessed connection strings**;
- **terminal history**;
- **screenshots / pastes containing secret values**.

If the only available source is one of the above, the process **stops** (stop-line)
— no substitution, no guess.

---

## 5. Safe Confirmation Labels (for a future custody-resolution evidence PR)

> Allowlist only. Booleans/tokens — **never** a DSN, password, host, port, IP, token,
> URI, or raw value.

```text
admin_rotation_connection_custody_resolution_attempted=true
approved_admin_rotation_connection_source_identified=true/false
approved_admin_rotation_connection_authority_confirmed=true/false
approved_admin_rotation_connection_value_printed=false
approved_admin_rotation_connection_value_recorded=false
approved_admin_rotation_connection_value_committed=false
source_is_not_runner_dsn=true/false
source_is_not_app_or_collector_dsn=true/false
source_is_not_pr199_or_evidence_doc=true/false
source_is_not_env_production=true/false
step2d_rerun_authorized=false
psql_sql_invoked=false
password_reset_attempted=false
credential_rotation_attempted=false
stage0_executed=false
admin_rotation_connection_custody_result=<allowlisted result>
```

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any DSN / password / token / host / port / IP / URI would be printed or recorded;
- the source is **ambiguous**;
- the source is **`.env.production`**;
- the source is **PR #199 or any evidence / registry doc** rather than a secret
  manager / admin custody source;
- the source appears to be a **runner / app / collector DSN**;
- the operator **cannot confirm admin/rotation authority**;
- any command would **connect to the database or run SQL**;
- any **password reset / rotation** would occur;
- any **Step 2D rerun, Step 2E, Stage 0, run-lock, or runtime/downstream/customer
  action** would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL / database connection** executed by this PR.
- No DSN / password read / use / reset / change.
- No credential rotation.
- No custody value update.
- No Step 2D rerun.
- No Step 2E.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No runtime / deploy / downstream / customer action.

---

## 8. Evidence Requirements (for any future custody-resolution action)

Every future custody-resolution execution (separately GO-gated) must:
- emit **safe labels only** (the §5 allowlist; never a DSN/password/raw value);
- **withhold raw output** (any raw text → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no DSN/password/token/host/
  port/IP/URI/raw error text/customer/row data);
- be recorded in a **docs-only evidence PR after execution**;
- carry out **no Step 2D rerun / Step 2E / Stage 0** off the custody evidence without
  separate review/GO.

---

## 9. Explicit Non-Authorization

**Merging this custody plan does not authorize:**
- a Step 2D rerun;
- any psql / SQL;
- a password reset or credential rotation;
- a custody value update;
- Step 2E;
- Stage 0.

**Any future Step 2D rerun requires a fresh explicit Helen GO** (and a proper
approved admin/rotation connection in custody first). **Stage 0 execution remains
separately GO-gated.**

---

## 10. Next Gated Step

1. **Codex review and merge** of this custody plan.
2. **Operator identifies the approved admin/rotation connection** through an allowed
   custody source (§3), out of band, **recording no raw value** — then a docs-only
   **custody-resolution evidence PR** (safe labels only per §5) under a **fresh
   explicit Helen GO**.
3. Only after a confirmed approved admin/rotation connection in custody, a **revised
   Step 2D execution plan or a rerun** of the PR #219 command-pack — separately
   reviewed and under a **fresh explicit Helen GO** (secret-safe, fail-closed, hidden
   input only, password never printed/stored).
4. **Step 2E** (one post-fix PR #198-style diagnostic rerun) only after a successful,
   reviewed/merged Step 2D rotation and a fresh GO.
5. **Stage 0 execution remains separately GO-gated** (only after a later clean
   post-fix psql gate diagnostic and a separate Stage 0 GO).

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, admin/rotation connection string, raw password,
hidden password, `.env.production` content, bearer token, AWS/OpenAI-style token,
raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, terminal input / history value, host/network detail, raw
payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural row
data, real `session_id` / `request_id` value, user-agent value, raw SQL, raw psql
output, raw PostgreSQL error text, or customer data. The custody-resolution process
identifies the approved admin/rotation connection **by source and authority only**
(an approved secret manager / admin console / DBA handoff / authority-scoped custody
pointer), **never recording its value**, and emits **safe allowlist labels only**.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans /
public git commit hashes / role / database names — not secret or row values.
