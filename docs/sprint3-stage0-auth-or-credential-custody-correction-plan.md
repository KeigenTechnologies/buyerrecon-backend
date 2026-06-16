# Sprint 3 — Stage 0 Step 2G — `auth_or_credential` Custody Correction Plan (Review-Only)

**Status:** `STAGE0_STEP2G_AUTH_OR_CREDENTIAL_CUSTODY_CORRECTION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. After PR #262 safely classified the
Option A auth failure as **`auth_or_credential`**, this plans a **secret-safe correction
path** for the `STAGE0_RUNNER_DSN` custody/source problem — **without printing, parsing,
exposing, or logging the value** — comparing options A/B/C and recommending one **as
planning only, not execution**.

This PR **executes nothing** and **authorizes no correction / reset / rotation / overwrite
/ rerun**: no credential reset, no password rotation, no custody-source overwrite, no DSN
read/print/parse, no generated-password print, no `.env.production` read/print, no
psql/auth rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no
source-selection change, no Option B code change, no remediation, no
runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password, token, host,
port, IP, URI, or `.env.production` value appears in this document.

> Provenance: PR #262 revised auth-failure classifier — classified `auth_or_credential`
> (`155737d007dcf43c40eb4db43546705562c9424e`,
> `STAGE0_STEP2G_OPTION_A_REVISED_AUTH_FAILURE_CLASSIFIER_CLASSIFIED_AUTH_OR_CREDENTIAL`);
> PR #261 revised classifier plan (`65161b21831f569a96b78c7f442afb5d9c5f38e3`); PR #258
> Option A auth preflight retry — auth failed, raw withheld
> (`73ffdc162aa870b71e8c08aedc3441efdba367f3`); PR #201 original broad `auth_or_credential`
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).

---

## 1. Status

`STAGE0_STEP2G_AUTH_OR_CREDENTIAL_CUSTODY_CORRECTION_PLANNING_ONLY` — docs-only; compares
correction options and recommends one; authorizes/executes nothing.

---

## 2. Evidence Chain (PR #258 → #262)

- **PR #258:** Option A binding/auth preflight reached psql/auth and **failed**; raw output
  withheld.
- **PR #259:** initial category-only classifier plan.
- **PR #260:** first classifier attempt **blocked** — raw-output boundary violated.
- **PR #261:** revised classifier plan (code-from-stdin / data-only invocation + self-test
  gate).
- **PR #262:** revised classifier **succeeded safely** — self-test passed; real chmod-600
  withheld raw output inspected category-only; result
  `auth_failure_category=auth_or_credential`, `revised_classifier_result=classified`,
  `stop_line=none`.

---

## 3. Current Known / Unknown Facts

**Known:**
- The dedicated runner path is wired far enough to **reach PostgreSQL auth**.
- The failure is **safely classified** in the `auth_or_credential` family.
- Secret-safety held throughout (raw withheld; value never printed/parsed/argv-exposed).

**Unknown:**
- The **exact subcase** is **not** proven (`exact_credential_subcase_known=false`).
- It is **not** known whether the cause is a wrong password, wrong user, wrong DSN value,
  missing role, bad service file, or credential invalidity beyond the category.

---

## 4. Bounded Conclusion from `auth_or_credential`

The category narrows the problem to the **credential/custody** surface for
`buyerrecon_stage0_runner` — but **does not** identify which subcase. The correction must
therefore be **secret-safe** and **not pre-judge** the subcase: it should make the custody
value **trustworthy and aligned with the DB role**, then re-prove via the existing Option A
auth preflight under a separate GO. This plan does **not** claim wrong password / wrong user
/ wrong DSN value / missing role / bad service file / credential invalidity beyond category,
does **not** claim Stage 0 readiness, and does **not** authorize Stage 0.

---

## 5. Correction Options (compared; none selected or executed)

### Option A — custody re-confirmation / value-replacement without rotation
- Re-confirm the **intended custody authority and source of truth**.
- **Re-enter or replace `STAGE0_RUNNER_DSN`** from the trusted operator-held value **without
  printing it** (hidden prompt / root-only file write).
- Validate **only** later, by a safe structural/auth gate under a separate GO.
- **No** value echo, DSN component output, or host/port/db/user/password output.
- **Pros:** lower-impact; no DB-side change; fast if the operator can confidently re-supply
  the intended value. **Cons:** if the DB password itself is wrong/unknown, re-supplying the
  custody value alone won't resolve auth.

### Option B — separately GO-gated credential rotation
- Generate/assign a **fresh password** for `buyerrecon_stage0_runner` under a **separate
  admin-custody GO**.
- Update the custody source to match the new generated value via **hidden input or
  root-only file write**.
- **Never** print the generated password or DSN.
- Follow with a **separate proof/evidence PR**.
- Requires **explicit GO** for rotation **and** custody overwrite.
- **Pros:** eliminates ambiguity by aligning the DB password and the custody source in one
  controlled, secret-safe chain. **Cons:** higher-impact (DB-side `ALTER ROLE` + custody
  overwrite); needs admin authority; two coordinated secret-safe writes.

### Option C — dedicated DBA/admin handoff
- A **DBA/operator with correct authority** sets the runner credential and the custody
  value.
- Evidence records **only safe labels** (action completed; custody source present;
  permissions correct; no raw value exposed).
- Follow with a **separate Option A binding/auth preflight rerun GO**.
- **Pros:** authority-correct; offloads the privileged step to the right owner. **Cons:**
  depends on DBA/operator availability and a clean handoff contract.

---

## 6. Recommended Path

- **Prefer Option B** **only if** we want to **eliminate ambiguity** by aligning the DB
  password and the custody source in one controlled, secret-safe chain.
- **Otherwise Option A** may be **lower-impact** if Helen can **confidently re-supply** the
  intended value.
- (Option C remains available where DBA/admin authority is the cleanest owner of the
  privileged step.)
- This is a **planning recommendation, not an execution decision**: no correction runs here;
  the route is finalized under the next GO.

---

## 7. Secret-Handling Rules (binding on any future correction)

- **Never** print, parse, decode, split, or log `STAGE0_RUNNER_DSN`.
- **Never** print a password or generated password.
- **Never** print DSN components: username, password, host, port, database, URI, IP, or
  service-file content.
- **Never** read or print `.env.production`.
- Use **hidden prompt, root-only temp file, or root-only custody file only**.
- The **root-only custody file must remain `chmod 600`**.
- Evidence must use **booleans / category labels only**.

---

## 8. Stop-Lines

Abort (safe stop-line + non-zero exit; no value/raw emitted) if any of:
- any raw DSN / password / URI / component would be printed;
- any `.env.production` value would be read or printed;
- any command would parse or echo DSN components;
- any generated password would be displayed;
- any credential reset/rotation would occur **without explicit separate GO**;
- any custody overwrite would occur **without explicit separate GO**;
- any psql/auth rerun would occur in the planning PR;
- any Option A preflight rerun would occur in the planning PR;
- any Step 2E, Stage 0, run-lock, remediation, source-selection / Option B code change, or
  downstream runtime would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate review/GO.

---

## 9. Safe Labels

```text
auth_or_credential_classification_carried_forward=true
exact_credential_subcase_known=false
custody_correction_planning_only=true
credential_reset_authorized=false
password_rotation_authorized=false
custody_overwrite_authorized=false
stage0_executed=false
step2e_rerun=false
option_a_preflight_rerun=false
psql_auth_rerun=false
raw_secret_output_allowed=false
dsn_component_output_allowed=false
env_production_read_allowed=false
remediation_authorized=false
```

---

## 10. Non-Authorization

**This PR authorizes no:** credential reset; password rotation; custody-source overwrite;
DSN read/print/parse; generated-password print; `.env.production` read/print; psql/auth
rerun; Option A preflight rerun; Step 2E; Stage 0; run-lock; source-selection change;
Option B code change; remediation; runtime/downstream/Lane/scoring/AMS/customer action.

**The chosen correction route (A/B/C) is a future, separately-reviewed, separately
GO-gated step** (and any rotation/custody overwrite is itself separately GO-gated and never
prints/stores the value). **Stage 0 execution remains separately GO-gated.**

---

## 11. Future Gated Sequence

1. **Merge** this docs-only planning PR (after Codex review).
2. **Choose the correction route** (A / B / C).
3. **Fresh explicit Helen GO** for the selected correction route.
4. **Execute the correction with secret-safe handling only** (hidden prompt / root-only
   file; never print/parse/log the value; custody file chmod 600).
5. Docs-only **correction evidence PR** (safe labels only).
6. **Fresh GO** for an **Option A binding/auth preflight rerun**.
7. Docs-only **evidence PR** for that rerun.
8. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
9. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
comparing secret-safe correction routes for the `auth_or_credential` category; every future
route handles the credential **only** via hidden prompt / root-only file (chmod 600),
**never** printing/parsing/logging the value or any DSN component, **never** reading/printing
`.env.production`, and records **booleans/category labels only**. The role name
`buyerrecon_stage0_runner`, the env-var name `STAGE0_RUNNER_DSN`, and option identifiers are
non-secret. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no
secret value exposed, printed, or recorded.") All values above are safe labels / booleans /
option names / env-var & role names / public git commit hashes — not secret or row values.
