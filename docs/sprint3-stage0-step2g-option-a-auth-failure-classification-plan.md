# Sprint 3 — Stage 0 Step 2G — Option A Auth-Failure Classification Plan (Review-Only)

**Status:** `STAGE0_STEP2G_OPTION_A_AUTH_FAILURE_CLASSIFICATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. After the Option A binding/auth
preflight reached and executed the auth/psql gate and **failed with raw output withheld**
(PR #258), this plan compares the next safe discriminator: **Path A** (a safe allowlisted
non-secret auth-failure category classifier) vs **Path B** (a credential/custody
correction planning route) — and recommends one **only as planning, not execution**.

This PR **executes nothing** and **authorizes no classifier / raw inspection / psql / reset
/ remediation**: no classifier execution, no raw-output inspection/printing, no psql/auth
rerun, no credential reset, no password rotation, no custody-source overwrite, no Option A
preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no source-selection change, no
Option B code change, no `.env.production` read/print, no DSN parsing/component output, no
secret value read/print/parse/log/exposure, no runtime/downstream/Lane/scoring/AMS/customer
action. No real DSN, password, token, host, port, IP, URI, or raw PostgreSQL error text
appears in this document.

> Provenance: PR #258 Option A binding/auth preflight retry — auth failed, raw withheld
> (`73ffdc162aa870b71e8c08aedc3441efdba367f3`,
> `STAGE0_STEP2G_OPTION_A_BINDING_AUTH_PREFLIGHT_RETRY_AUTH_FAILED_RAW_WITHHELD`); PR #257
> mapping diagnostic accepted (`350360700231579890ef20f07fe441cd67d1e811`); PR #249 Option A
> command-pack plan (`76bff30d0912b00ee5338d4bdc83bbafccb4271e`); PR #218 Step 2C
> `auth_or_credential` (`92d568a6b7491500db4de1732c3b9015a0ddc14e`).

---

## 1. Status

`STAGE0_STEP2G_OPTION_A_AUTH_FAILURE_CLASSIFICATION_PLANNING_ONLY` — docs-only; compares
the two discriminator paths and recommends one; authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #258)

- Option A path **wired end-to-end**; current-tip fast-forward succeeded; S2 custody
  file/key/permissions passed; `stage0:run` mapping **accepted**.
- Runner source **loaded invocation-scoped**; `DATABASE_URL` **child-scoped**; runtime
  binding **performed for the auth preflight only**; auth/psql gate **executed**; psql SQL
  invocation occurred.
- **Result: `auth_failed`**, `stop_line=auth_psql_gate_failed_raw_output_withheld`.
- Raw output **withheld** and chmod 600; secret temp service file used and removed; DSN not
  in argv; secret value not printed/parsed; `.env.production` not read.
- No Stage 0/Step 2E/run-lock/remediation/Option B/source-selection change/downstream
  runtime occurred.

---

## 3. What Is Known

- The Option A wiring is correct enough to **reach and execute** the auth/psql gate (load →
  child-scoped bind → psql invocation).
- The **auth/psql gate failed** (`auth_failed`).
- Secret-safety held throughout (raw withheld, value never printed/parsed/argv-exposed,
  `.env.production` not read).

---

## 4. What Remains Unknown (because raw output was withheld)

- The **exact failure reason** is **not** known (`exact_failure_reason_known=false`).
- It is **not** known whether the cause is a wrong credential, a malformed DSN, a
  role/database mismatch, a pg_hba/network policy, an SSL/connection policy, a service-file
  shape / client-config issue, or another psql/auth category.
- Determining this safely requires either a **non-secret category signal** (Path A) or a
  **custody-correction route** (Path B) — **not** raw-output disclosure.

---

## 5. Path A — Safe Allowlisted Auth-Failure Classifier

A future classifier (separately GO-gated) **may** inspect **only a narrowly allowlisted,
non-secret error category** and:
- **must not** print raw PostgreSQL/psql output;
- **must not** reveal DSN, host, port, database, username, password, IP, URI, service-file
  content, or raw error text;
- emits **category labels only**, from this allowlist:
  ```text
  auth_or_credential
  role_or_database
  pg_hba_or_network_policy
  ssl_or_connection_policy
  service_file_shape_or_client_config
  unknown_or_unclassified
  ```
- **must fail closed** if classification is uncertain or would require raw-output
  disclosure (→ `unknown_or_unclassified`, no raw text).
- Practical note: it would map the already-captured (chmod-600, withheld) auth output to a
  category via an **allowlist of non-secret signals** without printing the output — and if
  it cannot do so without exposing raw text/secret-adjacent detail, it **stops**.

**Pros:** narrows the failure family with zero secret/raw exposure; reuses the
already-withheld output (no new psql/auth attempt if classification is purely over the
existing chmod-600 capture). **Cons:** only viable if a safe non-secret category signal is
actually extractable; otherwise it fails closed and Path B is required.

---

## 6. Path B — Credential/Custody Correction Planning Route

If safe classification **cannot** be done without raw text or secret-adjacent details, plan
a **separate credential/custody correction route**:
- may include a **secret-safe re-confirmation of the `STAGE0_RUNNER_DSN` custody source**
  (presence/authority/scope — **not** printing, parsing, or exposing the value);
- **no credential reset/rotation in this PR**;
- **no new DSN value handling in this PR**;
- any actual reset/rotation/custody overwrite would be its own separately-reviewed,
  GO-gated step that never prints/stores the value.

**Pros:** fail-safe when no non-secret classification is possible; addresses the most likely
remaining hypothesis (the custody value) without raw exposure. **Cons:** does not itself
identify the failure category; defers to a correction track.

---

## 7. Recommended Next Branch

- **Recommend Path A** **only if** the classifier can produce category labels **without
  exposing raw output or secret-adjacent details** (over the already-withheld chmod-600
  capture, fail-closed to `unknown_or_unclassified`).
- **Otherwise recommend Path B** (credential/custody correction planning, secret-safe
  re-confirmation only).
- This is a **planning recommendation, not an execution decision**: no classifier or
  correction runs here; the choice is finalized under the next GO.

---

## 8. Candidate Safe Labels

```text
auth_failure_classification_planning_only=true
pr258_auth_failed_evidence_carried_forward=true
raw_auth_output_withheld=true
exact_failure_reason_known=false
auth_classifier_candidate_only=true
raw_output_inspection_authorized=false
raw_output_print_authorized=false
credential_reset_authorized=false
password_rotation_authorized=false
option_a_preflight_rerun=false
psql_auth_rerun=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
remediation_authorized=false
```

> A future Path A classifier run would additionally emit one allowlisted category label
> (`auth_failure_category=<§5 allowlist value>`) plus `raw_output_printed=false` — safe
> tokens only; no raw text.

---

## 9. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- the classifier would **print raw PostgreSQL/psql output**;
- the classifier would **expose DSN, host, port, database, username, password, IP, URI, or
  service-file content**;
- the classifier would **require parsing secret values**;
- the classifier would **require `.env.production` read/print**;
- the classifier would **require another psql/auth attempt**;
- the classifier **cannot classify without raw text**;
- a **credential reset/rotation** would be needed;
- an **Option A preflight rerun** would occur;
- a **Step 2E / Stage 0 / run-lock / downstream** action would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked/`unknown` state
in a docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 10. Non-Authorization

**This PR authorizes no:** classifier execution; raw-output inspection; raw-output
printing; credential reset; password reset/rotation; custody-source overwrite; Option A
preflight rerun; psql/auth rerun; Step 2E; Stage 0; run-lock; remediation; source-selection
change; Option B code change; `.env.production` read/print; DSN parsing/component output;
secret value read/print/parse/log/exposure; runtime/downstream/Lane/scoring/AMS/customer
action.

**The chosen path (A or B) is a future, separately-reviewed, separately GO-gated step.**
**Stage 0 execution remains separately GO-gated.**

---

## 11. Future Gated Sequence

1. **Merge** this docs-only planning PR (after Codex review).
2. **Codex review.**
3. **Fresh explicit Helen GO** for **either**: a safe category-only auth-failure classifier
   (Path A), **or** a credential/custody correction planning step (Path B).
4. Docs-only **evidence PR** (safe labels only).
5. **Only after** that evidence → decide whether another Option A preflight, credential
   correction, or Option B planning is appropriate.
6. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, bearer token,
AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address, hostname,
port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or customer data. This is a docs-only plan comparing a safe
non-secret category classifier (Path A; category labels only; fail closed to
`unknown_or_unclassified`) and a secret-safe credential/custody correction route (Path B;
presence/authority/scope only, never the value); it **runs no classifier**, inspects/prints
**no** raw output, runs **no** psql/auth, resets/rotates **no** credential, overwrites **no**
custody source, and records **no** DSN/secret/env value. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or recorded.")
All values above are safe labels / booleans / category tokens / public git commit hashes —
not secret or row values.
