# Sprint 3 — Stage 0 auth/credential Step 1C — Decision Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1C_DECISION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. With **Step 1A role metadata
clean** (PR #206) and the **full Step 1B grant boundary clean** (PRs #209–#213), it
records the **Step 1C decision point** and recommends the **next safe
investigation branch** for the remaining broad `auth_or_credential` psql gate
blocker (classified in PR #201).

This PR **executes nothing**: no production command, no `psql`, no SQL, no
raw-output inspection, no password/custody check, no `buyerrecon_stage0_runner`
password use, no psql login as the runner, no password reset, no credential
change, no role change, no GRANT/DML/DDL, no Stage 0, no run-lock touch, no
`.env.production` mutation, no runtime/deploy/downstream/customer action. No real
DSN, password, host, port, token, IP, or raw value appears in this document.

> Provenance: PR #201 psql gate diagnostic — broad `auth_or_credential`
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`,
> `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`); PR #202 auth/credential
> resolution plan (`4b1aa590aa8e32385c39e044d3cbcd5be9a20177`,
> `STAGE0_AUTH_CREDENTIAL_RESOLUTION_PLANNING_ONLY`); PR #206 Step 1A role metadata
> clean (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`); PR #208 sliced Step 1B
> adjustment plan (`03594c1f5a564307ef1ae634874d00c0bd6c7af9`); PR #209 Step 1B-A
> object presence clean/no-sequence (`caf53a3926963f4187fedddf883ed76c0a4997c0`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_A_OBJECT_PRESENCE_CLEAN_NO_SEQUENCE`); PR #210 Step
> 1B-B required table privileges clean
> (`94733aefd6b526ae39d9a64f034b3482c4434c9b`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_B_REQUIRED_TABLE_PRIVILEGES_CLEAN`); PR #211 Step
> 1B-C sequence not-applicable/no-sequence
> (`a60e1cf9b5ecf6b09bb3028be386d625c5777c29`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_C_SEQUENCE_NOT_APPLICABLE_NO_SEQUENCE`); PR #212
> Step 1B-D forbidden privileges absent
> (`7f2c112b9ba3c99bdd4ea42992585e237a70a934`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_D_FORBIDDEN_PRIVILEGES_ABSENT`); PR #213 Step 1B-E
> combined grant-boundary clean (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_E_GRANT_BOUNDARY_CLEAN`).

---

## 1. Decision Point

The remaining blocker from PR #201 is the broad `auth_or_credential` psql gate
failure for `buyerrecon_stage0_runner`. Two large branches of that surface have
now been **checked and found clean** for the Stage 0 scope:

- **Role usability — clean** (Step 1A, PR #206): `role_exists=true`,
  `role_can_login=true`, `role_validity_state=unbounded`,
  `role_has_no_superuser=true`, `role_has_no_createdb=true`,
  `role_has_no_createrole=true` → `role_metadata_clean`.
- **Checked grant boundary — clean** (Step 1B-A…1B-E, PRs #209–#213):
  - Step 1B-A object presence clean / no sequence;
  - Step 1B-B required table privileges clean;
  - Step 1B-C sequence not-applicable / no sequence;
  - Step 1B-D forbidden privileges absent;
  - Step 1B-E `required_grants_hold=true`, `forbidden_privileges_absent=true` →
    `grant_boundary_clean`.

**Decision:** with role metadata clean and the checked grant boundary clean,
decide the next safe branch for the still-unresolved `auth_or_credential` blocker.

**Bounded conclusion (recorded, not over-claimed):**
- Role usability has been **checked clean** for the Stage 0 scope.
- The checked grant boundary has been **checked clean** for the Stage 0 scope.
- These findings **point away from** role-missing, cannot-login, validity,
  forbidden-role-attribute, missing checked grants, or forbidden checked
  privileges as the cause of the PR #201 `auth_or_credential` blocker.
- The **remaining unresolved surface is the password/custody/credential path.**
- This does **not** prove password/custody as the exact root cause.
- This does **not** authorize a password reset, a credential change, a psql login
  as `buyerrecon_stage0_runner`, a Stage 0 retry, a run-lock touch, a DB mutation,
  a runtime action, or customer output.

---

## 2. Recommended Next Branch

- **Recommendation:** proceed to a **separately planned Step 2 password/custody
  verification path** as the next investigation branch.
- This is a **recommended next investigation branch, not proof of root cause.**
  The password/custody path is the **remaining unchecked surface**, not a proven
  cause; it is **not pre-judged**.
- Step 2 is investigation-first: prefer **custody-pointer validation and
  secret-safe operator confirmation** before any password reset is even
  considered.

---

## 3. Step 2 Planning Requirements

Any Step 2 password/custody verification work must:

1. Be its **own docs-only command-pack / planning PR** (separate from this Step 1C
   decision PR).
2. Receive **Codex review**.
3. Receive a **fresh explicit Helen GO** before any action.
4. **Never print** DSN / password / token / host / port / IP / raw PostgreSQL
   error text.
5. **Never store or expose** the `buyerrecon_stage0_runner` password.
6. **Prefer custody-pointer validation and secret-safe operator confirmation**
   (e.g. confirming the custody source resolves and the credential pointer is
   present/consistent) **before any password reset is considered.**
7. Treat **any password reset, if later needed, as a separately GO-gated step**
   that must **never print or store** the password.

---

## 4. Stop-Lines (preserved)

Abort (safe stop-line + non-zero exit) if any of:
- any raw secret or infrastructure value would be printed;
- any raw PostgreSQL error text would be printed;
- any password reset or credential change would be attempted **without** a
  separate reviewed plan and GO;
- any psql login as `buyerrecon_stage0_runner` would be attempted **without** a
  separate reviewed plan and GO;
- any GRANT / DML / DDL / role change would occur;
- Stage 0 or the run-lock would be touched;
- `.env.production` would be mutated;
- any runtime / downstream / Lane A·B / scoring / AMS / customer output / Gate 4E
  / Gate 4F would run.

If a stop-line is hit, withhold raw output, record the blocked state in a docs-only
evidence PR, and take no fix/retry without separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL** executed by this PR.
- No raw-output inspection.
- No `buyerrecon_stage0_runner` password use.
- No password reset.
- No credential change.
- No psql login as `buyerrecon_stage0_runner`.
- No role change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No runtime / deploy / downstream / customer action.

---

## 6. Evidence Requirements (for any future Step 2 action)

Every future Step 2 execution (separately GO-gated) must:
- emit **safe labels only**;
- **withhold raw output** (raw text → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no DSN/password/token/host/
  port/IP/raw PostgreSQL error text/customer/row data);
- be recorded in a **docs-only evidence PR after execution**;
- carry out **no retry or fix after a blocked result without separate review/GO.**

---

## 7. Explicit Non-Authorization

**Merging this Step 1C planning PR does not authorize** Step 2 execution, a
password/custody check, a password reset, a credential change, a psql login as
`buyerrecon_stage0_runner`, a Stage 0 retry, a run-lock touch, or a runtime action.
**Step 2 requires its own docs-only plan, Codex review, and a fresh explicit Helen
GO.** **Stage 0 execution remains separately GO-gated.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this Step 1C decision PR.
2. Prepare a **separately reviewed, secret-safe Step 2 password/custody
   verification plan** (a docs-only plan/command-pack) preferring custody-pointer
   validation and secret-safe operator confirmation, with raw output withheld and
   no secret printed/stored — then a **fresh explicit Helen GO** for **one** Step 2
   action, recorded in its own docs-only evidence PR.
3. **Any password reset**, if later needed, is a **separately GO-gated** step that
   must never print/store the password.
4. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. The recommended Step 2 path uses the **approved custody connection
only** (never the `buyerrecon_stage0_runner` login/password), prefers
custody-pointer validation, emits **safe labels only**, and withholds raw output.
All values above are safe labels / public git commit hashes / role / database
names — not secret or row values.
