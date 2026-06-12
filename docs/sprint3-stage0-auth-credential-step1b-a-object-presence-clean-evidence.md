# Sprint 3 — Stage 0 auth/credential Step 1B-A — Object-Presence Preflight — Evidence (CLEAN, no sequence)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_A_OBJECT_PRESENCE_CLEAN_NO_SEQUENCE`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 1B-A OBJECT PRESENCE PREFLIGHT GO`, the
operator ran the corrected PR #208 **Step 1B-A** object-presence slice on
production. The output **matched the Step 1B-A safe allowlist shape**: the three
read/write relations are present, and **no `stage0_decisions` owned sequence was
detected** → `step1b_a_object_presence_result=object_presence_clean_no_sequence`.

**This is an object-presence finding only — NOT a grant/privilege check, NOT a
Stage 0 execution, and NOT a password/custody root-cause proof.** This PR changes
no roles/grants, runs no SQL, and records safe **booleans only** — no secrets,
DSN, password, raw SQL/error text, or raw data.

> Provenance: PR #206 Step 1A role metadata clean evidence
> (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`); PR #207 original Step 1B
> grant-boundary blocked evidence (`333064965e6d5dd9121a113ae49f0ade531f0197`);
> PR #208 corrected sliced Step 1B query/command adjustment plan
> (`03594c1f5a564307ef1ae634874d00c0bd6c7af9`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_QUERY_ADJUSTMENT_PLANNING_ONLY`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 1B-A OBJECT PRESENCE PREFLIGHT GO` —
  exactly **one** corrected PR #208 Step 1B-A object/sequence presence check;
  approved custody connection only; **no** runner password; **no** login as
  `buyerrecon_stage0_runner`; raw output withheld; allowlist booleans only.
- This did **not** authorize Step 1B-B/C/D/E, a fix, password/custody action,
  role change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 1B-A attempt)

```text
accepted_events_relation_present=true
ingest_requests_relation_present=true
stage0_decisions_relation_present=true
stage0_decisions_sequence_present=false
step1b_a_object_presence_result=object_presence_clean_no_sequence
```

---

## 3. Interpretation (bounded)

- The corrected **Step 1B-A object-presence preflight ran**, and the output
  **matched the Step 1B-A safe allowlist shape**.
- **Object presence:**
  - `accepted_events` relation is **present**;
  - `ingest_requests` relation is **present**;
  - `stage0_decisions` relation is **present**;
  - a `stage0_decisions` **owned sequence was not detected**
    (`stage0_decisions_sequence_present=false`).
- **Step 1B-A result:** `object_presence_clean_no_sequence`.
- This is an **object-presence finding only.** It:
  - does **not** prove `required_grants_hold`;
  - does **not** prove `forbidden_privileges_absent`;
  - does **not** infer that required grants are missing;
  - does **not** infer that forbidden privileges are present;
  - does **not** prove a password/custody cause.

**Note (consistent with — not a new claim):** the absence of a `stage0_decisions`
owned sequence is consistent with the existing schema, where the
`stage0_decisions` primary key is `gen_random_uuid()` (migration 012) rather than
a serial/sequence default. This is recorded only as context; the **planned Step
1B-C sequence-privilege slice** can therefore be treated as **not-applicable /
no-sequence** when it is later separately GO-gated, rather than expecting a
sequence privilege to exist.

---

## 4. What Did Not Happen

- No Step 1B-B; no Step 1B-C; no Step 1B-D; no Step 1B-E.
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
- No DSN / password / token / host / port / IP printed.

---

## 5. Verdict

- **CLEAN (no sequence) — Step 1B-A object presence is
  `object_presence_clean_no_sequence`**: `accepted_events` / `ingest_requests` /
  `stage0_decisions` relations present; no `stage0_decisions` owned sequence;
  allowlist shape matched; raw output withheld; no secret used or exposed.
- This is **not** a Step 1B-B/C/D/E result, **not** a grant/privilege finding,
  **not** a Stage 0 execution, and **not** a password/custody root-cause proof.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 1B-B/C/D/E, inspect raw output, reset a password, change a
   role, run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 1B-B** (required table privileges — `accepted_events_select_hold` /
   `ingest_requests_select_hold` / `stage0_decisions_select/insert/update_hold`)
   requires its **own fresh explicit Helen GO** and its own docs-only evidence PR
   (catalog booleans only; approved custody connection; no runner password/login;
   raw output withheld).
4. **Step 1B-C** (sequence privileges) can later be recorded as **no-sequence /
   n/a** for `stage0_decisions` given §3 — still separately GO-gated.
5. **Step 1B-D** then **Step 1B-E** combined decision, each separately GO-gated.
6. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Step 1B-A used the **approved custody connection only** (no
`buyerrecon_stage0_runner` password; no login as that role); raw SQL output was
withheld; only the **allowlisted object-presence booleans** were emitted. All
values above are safe labels / booleans / public git commit hashes / role /
database / relation names — not secret or row values.
