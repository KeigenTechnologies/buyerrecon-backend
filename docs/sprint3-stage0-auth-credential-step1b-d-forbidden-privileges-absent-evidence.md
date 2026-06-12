# Sprint 3 — Stage 0 auth/credential Step 1B-D — Forbidden Privileges Absent — Evidence (CLEAN)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_D_FORBIDDEN_PRIVILEGES_ABSENT`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1B-D FORBIDDEN PRIVILEGES ABSENT PREFLIGHT GO`,
the operator ran the corrected PR #208 **Step 1B-D** forbidden-privileges-absent
slice on production. The output **matched the Step 1B-D safe allowlist shape**:
the forbidden schema-create / write / destructive privileges are **absent** for
`buyerrecon_stage0_runner` →
`step1b_d_forbidden_privileges_result=forbidden_privileges_absent`.

**This is a forbidden-privileges-absence finding only — NOT the Step 1B-E combined
grant-boundary decision, NOT a Stage 0 execution, and NOT a password/custody
root-cause proof.** This PR changes no roles/grants, runs no SQL, and records safe
**booleans only** — no secrets, DSN, password, raw SQL/error text, host/network
details, or raw data.

> Provenance: PR #208 corrected sliced Step 1B query/command adjustment plan
> (`03594c1f5a564307ef1ae634874d00c0bd6c7af9`); PR #209 Step 1B-A object-presence
> clean/no-sequence evidence (`caf53a3926963f4187fedddf883ed76c0a4997c0`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_A_OBJECT_PRESENCE_CLEAN_NO_SEQUENCE`); PR #210
> Step 1B-B required-table-privileges clean evidence
> (`94733aefd6b526ae39d9a64f034b3482c4434c9b`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_B_REQUIRED_TABLE_PRIVILEGES_CLEAN`); PR #211 Step
> 1B-C sequence-not-applicable/no-sequence evidence
> (`a60e1cf9b5ecf6b09bb3028be386d625c5777c29`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_C_SEQUENCE_NOT_APPLICABLE_NO_SEQUENCE`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1B-D FORBIDDEN PRIVILEGES ABSENT PREFLIGHT
  GO` — exactly **one** corrected PR #208 Step 1B-D forbidden-privileges-absent
  check; approved custody connection only; **no** runner password; **no** login as
  `buyerrecon_stage0_runner`; raw output withheld; allowlist booleans only.
- This did **not** authorize Step 1B-E, a fix, password/custody action, role
  change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 1B-D attempt)

```text
public_schema_create_absent=true
accepted_events_write_privileges_absent=true
ingest_requests_write_privileges_absent=true
stage0_decisions_destructive_privileges_absent=true
step1b_d_forbidden_privileges_result=forbidden_privileges_absent
```

---

## 3. Interpretation (bounded)

- The corrected **Step 1B-D forbidden-privileges-absent preflight ran**, and the
  output **matched the Step 1B-D safe allowlist shape**.
- **Forbidden privileges are absent for `buyerrecon_stage0_runner`:**
  - `public` schema **CREATE** privilege is **absent**
    (`public_schema_create_absent=true`);
  - `accepted_events` forbidden **write** privileges are **absent**
    (`accepted_events_write_privileges_absent=true`);
  - `ingest_requests` forbidden **write** privileges are **absent**
    (`ingest_requests_write_privileges_absent=true`);
  - `stage0_decisions` **destructive** privileges are **absent**
    (`stage0_decisions_destructive_privileges_absent=true`).
- **Step 1B-D result:** `forbidden_privileges_absent`.
- This is a **forbidden-privileges-absence finding only.** It:
  - does **not** complete the Step 1B-E combined grant-boundary decision;
  - does **not** prove a password/custody cause.

This confirms — **for the forbidden-privileges side only** — that the role does
not hold the disallowed schema-create / write / destructive privileges; it does
**not** by itself explain the PR #201 `auth_or_credential` blocker, and no broader
inference is drawn here.

---

## 4. What Did Not Happen

- No Step 1B-E.
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
  addresses, local IPs, IPv6 addresses, or host/network details recorded.

---

## 5. Verdict

- **CLEAN — Step 1B-D forbidden privileges are `forbidden_privileges_absent`**:
  `public` schema CREATE absent; `accepted_events` / `ingest_requests` forbidden
  write privileges absent; `stage0_decisions` destructive privileges absent — all
  for `buyerrecon_stage0_runner`; allowlist shape matched; raw output withheld; no
  secret used or exposed.
- This is **not** the Step 1B-E combined grant-boundary decision, **not** a Stage 0
  execution, and **not** a password/custody root-cause proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 1B-E, inspect raw output, reset a password, change a role,
   run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 1B-E** (combined grant-boundary decision after A–D — `required_grants_hold`
   / `forbidden_privileges_absent` / `step1b_grant_boundary_result`) requires its
   **own fresh explicit Helen GO** and its own docs-only evidence PR (recombining
   the A–D results only; approved custody connection; no runner password/login;
   raw output withheld).
4. **Step 1C** decision (password custody/reset vs role usability) only after the
   full Step 1B picture — its own plan + Codex review + GO. **Do not pre-judge.**
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value,
SSH banner, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Step 1B-D used the **approved custody connection only** (no
`buyerrecon_stage0_runner` password; no login as that role); raw SQL output was
withheld; only the **allowlisted forbidden-privileges-absence booleans** were
emitted. All values above are safe labels / booleans / public git commit hashes /
role / database / relation names — not secret or row values.
