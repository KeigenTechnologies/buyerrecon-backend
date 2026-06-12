# Sprint 3 — Stage 0 auth/credential Step 1B-B — Required Table Privileges — Evidence (CLEAN)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_B_REQUIRED_TABLE_PRIVILEGES_CLEAN`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1B-B REQUIRED TABLE PRIVILEGES PREFLIGHT GO`,
the operator ran the corrected PR #208 **Step 1B-B** required-table-privileges
slice on production. The output **matched the Step 1B-B safe allowlist shape**:
the required `SELECT`/`INSERT`/`UPDATE` privileges **hold** for
`buyerrecon_stage0_runner` →
`step1b_b_required_table_privileges_result=required_table_privileges_clean`.

**This is a required-table-privileges finding only — NOT a sequence/forbidden
check, NOT the Step 1B-E combined decision, NOT a Stage 0 execution, and NOT a
password/custody root-cause proof.** This PR changes no roles/grants, runs no
SQL, and records safe **booleans only** — no secrets, DSN, password, raw
SQL/error text, host/network details, or raw data.

> Provenance: PR #206 Step 1A role metadata clean evidence
> (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`); PR #208 corrected sliced
> Step 1B query/command adjustment plan
> (`03594c1f5a564307ef1ae634874d00c0bd6c7af9`); PR #209 Step 1B-A object-presence
> clean/no-sequence evidence (`caf53a3926963f4187fedddf883ed76c0a4997c0`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_A_OBJECT_PRESENCE_CLEAN_NO_SEQUENCE`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1B-B REQUIRED TABLE PRIVILEGES PREFLIGHT
  GO` — exactly **one** corrected PR #208 Step 1B-B required-table-privileges
  check; approved custody connection only; **no** runner password; **no** login
  as `buyerrecon_stage0_runner`; raw output withheld; allowlist booleans only.
- This did **not** authorize Step 1B-C/D/E, a fix, password/custody action, role
  change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 1B-B attempt)

```text
accepted_events_select_hold=true
ingest_requests_select_hold=true
stage0_decisions_select_hold=true
stage0_decisions_insert_hold=true
stage0_decisions_update_hold=true
step1b_b_required_table_privileges_result=required_table_privileges_clean
```

---

## 3. Interpretation (bounded)

- The corrected **Step 1B-B required-table-privileges preflight ran**, and the
  output **matched the Step 1B-B safe allowlist shape**.
- **Required table privileges hold for `buyerrecon_stage0_runner`:**
  - `accepted_events` **SELECT** holds;
  - `ingest_requests` **SELECT** holds;
  - `stage0_decisions` **SELECT** holds;
  - `stage0_decisions` **INSERT** holds;
  - `stage0_decisions` **UPDATE** holds.
- **Step 1B-B result:** `required_table_privileges_clean`.
- This is a **required-table-privileges finding only.** It:
  - does **not** prove sequence privileges (Step 1B-C);
  - does **not** prove forbidden privileges are absent (Step 1B-D);
  - does **not** complete the Step 1B-E combined grant-boundary decision;
  - does **not** prove a password/custody cause.

This confirms — **for the required table privileges only** — that the role holds
the proven Stage 0 grant set; it does **not** by itself explain the PR #201
`auth_or_credential` blocker, and no broader inference is drawn here.

---

## 4. What Did Not Happen

- No Step 1B-C; no Step 1B-D; no Step 1B-E.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No `buyerrecon_stage0_runner` password used.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset; no role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- Raw SQL / PostgreSQL output withheld.
- No DSN / password / token / host / port / IP printed; no SSH banner, IP
  addresses, local IPs, or host/network details recorded.

---

## 5. Verdict

- **CLEAN — Step 1B-B required table privileges are
  `required_table_privileges_clean`**: `accepted_events`/`ingest_requests`
  SELECT and `stage0_decisions` SELECT/INSERT/UPDATE all hold for
  `buyerrecon_stage0_runner`; allowlist shape matched; raw output withheld; no
  secret used or exposed.
- This is **not** a Step 1B-C/D/E result, **not** the combined grant-boundary
  decision, **not** a Stage 0 execution, and **not** a password/custody
  root-cause proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 1B-C/D/E, inspect raw output, reset a password, change a
   role, run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 1B-C** (sequence privileges) — given PR #209
   `object_presence_clean_no_sequence`, can be recorded as **no-sequence / n/a**
   for `stage0_decisions` — still requires its **own fresh explicit Helen GO** and
   its own docs-only evidence PR.
4. **Step 1B-D** (forbidden privileges absent) then **Step 1B-E** (combined
   decision after A–D) — each separately GO-gated, each with its own evidence PR.
5. **Step 1C** decision (password custody/reset vs role usability) only after the
   full Step 1B picture — its own plan + Codex review + GO. **Do not pre-judge.**
6. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), hostname, port value, SSH banner,
host/network detail, raw payload, `canonical_jsonb` payload, `accepted_events`
row data, raw behavioural row data, real `session_id` / `request_id` value,
user-agent value, raw SQL or raw PostgreSQL error text, or customer data. Step
1B-B used the **approved custody connection only** (no `buyerrecon_stage0_runner`
password; no login as that role); raw SQL output was withheld; only the
**allowlisted required-table-privilege booleans** were emitted. All values above
are safe labels / booleans / public git commit hashes / role / database /
relation names — not secret or row values.
