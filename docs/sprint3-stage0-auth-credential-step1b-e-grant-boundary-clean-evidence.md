# Sprint 3 — Stage 0 auth/credential Step 1B-E — Combined Grant-Boundary Decision — Evidence (CLEAN)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_E_GRANT_BOUNDARY_CLEAN`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1B-E COMBINED GRANT BOUNDARY DECISION GO`, the
operator ran the corrected PR #208 **Step 1B-E** combined grant-boundary decision
on production, recombining the Step 1B-A…1B-D slice results. The output **matched
the Step 1B-E safe allowlist shape**: required grants hold and forbidden
privileges are absent for `buyerrecon_stage0_runner` →
`step1b_grant_boundary_result=grant_boundary_clean`.

**This completes the Step 1B grant-boundary evidence chain for the checked Stage 0
scope — but it is a grant-boundary finding only: NOT a password/custody
root-cause proof, and NOT a Stage 0 execution.** This PR changes no roles/grants,
runs no SQL, and records safe **booleans only** — no secrets, DSN, password, raw
SQL/error text, host/network details, or raw data.

> Provenance: PR #208 corrected sliced Step 1B query/command adjustment plan
> (`03594c1f5a564307ef1ae634874d00c0bd6c7af9`); PR #209 Step 1B-A object-presence
> clean/no-sequence evidence (`caf53a3926963f4187fedddf883ed76c0a4997c0`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_A_OBJECT_PRESENCE_CLEAN_NO_SEQUENCE`); PR #210
> Step 1B-B required-table-privileges clean evidence
> (`94733aefd6b526ae39d9a64f034b3482c4434c9b`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_B_REQUIRED_TABLE_PRIVILEGES_CLEAN`); PR #211 Step
> 1B-C sequence-not-applicable/no-sequence evidence
> (`a60e1cf9b5ecf6b09bb3028be386d625c5777c29`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_C_SEQUENCE_NOT_APPLICABLE_NO_SEQUENCE`); PR #212
> Step 1B-D forbidden-privileges-absent evidence
> (`7f2c112b9ba3c99bdd4ea42992585e237a70a934`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_D_FORBIDDEN_PRIVILEGES_ABSENT`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1B-E COMBINED GRANT BOUNDARY DECISION GO`
  — exactly **one** corrected PR #208 Step 1B-E combined grant-boundary decision
  (recombining A–D); approved custody connection only; **no** runner password;
  **no** login as `buyerrecon_stage0_runner`; raw output withheld; allowlist
  booleans only.
- This did **not** authorize Step 1C, a fix, password/custody action, credential
  change, role change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 1B-E attempt)

```text
required_grants_hold=true
forbidden_privileges_absent=true
step1b_grant_boundary_result=grant_boundary_clean
```

---

## 3. Interpretation (bounded)

- The corrected **Step 1B-E combined grant-boundary decision ran**, and the output
  **matched the Step 1B-E safe allowlist shape**.
- **Combined grant-boundary verdict for `buyerrecon_stage0_runner`:**
  - `required_grants_hold=true`;
  - `forbidden_privileges_absent=true`.
- **Step 1B-E result:** `grant_boundary_clean`.
- This **completes the Step 1B grant-boundary evidence chain**, recombining the
  prior slices:
  - Step 1B-A object presence clean / no-sequence (PR #209);
  - Step 1B-B required table privileges clean (PR #210);
  - Step 1B-C sequence not-applicable / no-sequence (PR #211);
  - Step 1B-D forbidden privileges absent (PR #212).
- **The role/grant boundary is clean for the checked Stage 0 scope.** It:
  - does **not** prove password/custody as the exact root cause;
  - does **not** authorize password reset, credential change, role change,
    GRANT/DML/DDL, Stage 0 retry, run-lock touch, or runtime action.

With Step 1A role metadata clean (PR #206) and the full Step 1B grant boundary now
clean, the role-usability and grant sides have been checked and found clean for
the Stage 0 scope. This **narrows** the remaining investigation surface but does
**not by itself prove** the PR #201 `auth_or_credential` cause; the password /
custody path is **not pre-judged** and requires its own Step 1C planning, review,
and a fresh GO before any action.

---

## 4. What Did Not Happen

- No Step 1C.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No `buyerrecon_stage0_runner` password used.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset; no credential change; no role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- Raw SQL / PostgreSQL output withheld.
- No DSN / password / token / host / port / IP printed; no SSH banner, IP
  addresses, local IPs, IPv6 addresses, login source, or host/network details
  recorded.

---

## 5. Verdict

- **CLEAN — Step 1B-E combined grant boundary is `grant_boundary_clean`**:
  `required_grants_hold=true` and `forbidden_privileges_absent=true` for
  `buyerrecon_stage0_runner`; the Step 1B-A…1B-D chain is recombined; allowlist
  shape matched; raw output withheld; no secret used or exposed.
- This is **not** a password/custody root-cause proof and **not** a Stage 0
  execution. It **completes the Step 1B grant-boundary chain** only.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 1C, inspect raw output, reset a password, change a
   credential, change a role, run GRANT/DML/DDL, run Stage 0, touch the run-lock,
   or run any runtime/downstream/customer action off this evidence.
3. **Step 1C** decision (password custody/reset vs role usability) — now that Step
   1A role metadata is clean (PR #206) and the full Step 1B grant boundary is clean
   (PRs #209–#212 + this PR) — requires its **own plan + Codex review + fresh
   explicit Helen GO**. **Do not pre-judge** the password/custody cause.
4. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Step 1B-E used the **approved custody connection only** (no
`buyerrecon_stage0_runner` password; no login as that role); raw SQL output was
withheld; only the **allowlisted combined grant-boundary booleans** were emitted.
All values above are safe labels / booleans / public git commit hashes / role /
database / relation names — not secret or row values.
