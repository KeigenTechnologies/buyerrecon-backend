# Sprint 3 — Stage 0 psql Gate Diagnostic — Result Evidence (auth_or_credential)

**Status:** `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`

This is a **docs-only evidence record**. It captures the result of the **actual
operator-run** PR #198 secret-safe psql gate diagnostic on
`/opt/buyerrecon-backend`. `psql` was invoked; the **pre-run gate query did not
pass**; raw `psql` output was **withheld**; and the broad classifier result is
**`auth_or_credential`**.

**This is a diagnostic result — NOT a Stage 0 execution.** Stage 0 did not run,
the run-lock was not touched, and no fix/retry was attempted. This PR changes no
roles/grants, runs no SQL, and records **safe labels only** — no secrets, DSN,
host, port, password, raw PostgreSQL error text, or raw data.

> Provenance: PR #198 secret-safe psql gate diagnostic plan
> (`274a99c828888494f3ba326959ab1051aeef18b5`); PR #199 runtime registry
> (`193cdc96bfabe9893b330910b36cf681db77a20a`); PR #200 blocked evidence
> (`72c929801faea7a8080c095e994a2cbc08426992`). Production checkout synced to
> HEAD `72c929801faea7a8080c095e994a2cbc08426992` before the real diagnostic.

---

## 1. Authorization

- GO: `HELEN STAGE0 PSQL GATE DIAGNOSTIC GO` — run **exactly one** secret-safe
  psql gate diagnostic per the merged PR #198 plan, before run-lock and before
  Stage 0, safe labels only (incl. broad `psql_gate_failure_class`), raw output
  withheld.
- This did **not** authorize Stage 0 execution, a fix, or a retry.
- The operator ran the diagnostic manually on the production host. Claude Code
  did not execute anything.

---

## 2. Safe Labels (from the actual diagnostic)

```text
stage0_psql_gate_diagnostic_attempted=true
diagnostic_scope=pr198_secret_safe_psql_gate_env_custody_derived
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
raw_output_withheld=true
on_production_host=true
merge_274a99c_present=true
merge_193cdc9_present=true
merge_72c9298_present=true
diagnostic_plan_doc_present=true
approved_source_present=true
host_component_present=true
port_component_present=true
runner_secret_present=true
psql_invoked=true
psql_gate_query_pass=false
raw_psql_output_printed=false
psql_gate_classifier_pass=true
psql_gate_failure_class=auth_or_credential
```

---

## 3. Interpretation — Diagnostic Result (auth_or_credential)

The diagnostic ran end-to-end and **classified** the failure safely:
- it was the **actual operator-run** PR #198 diagnostic on the production host
  (`on_production_host=true`); the required merges and plan doc were present;
- the **approved custody source, host/port components, and runner secret were all
  present** (`approved_source_present=true`, `host_component_present=true`,
  `port_component_present=true`, `runner_secret_present=true`) — so the input was
  complete (unlike the structural blocks of PR #190/#192);
- **`psql` was invoked** (`psql_invoked=true`);
- the **gate query did not pass** (`psql_gate_query_pass=false`);
- **raw `psql` output was withheld** (`raw_output_withheld=true`,
  `raw_psql_output_printed=false`);
- the **classifier succeeded** (`psql_gate_classifier_pass=true`) and resolved the
  failure to the **broad class `auth_or_credential`**.

**Bounded cause (not over-claimed):** the broad class is **`auth_or_credential`**.
The exact root cause is **not proven** because raw output was intentionally
withheld — it **may** be a password mismatch, a role-auth issue, a role
existence/usability issue, or another credential/auth-layer issue. It is **not**
classified as connectivity, and **not** classified as SSL/`pg_hba`.

This narrows the PR #197 gate-query failure (then unclassified) to the
**auth/credential layer** specifically — a meaningful, secret-safe localization.

---

## 4. What Did Not Happen

- No Stage 0 execution; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No GRANT / DML / DDL.
- No role / grant / schema / deploy / runtime / downstream change.
- No extractor / risk / POI / evidence snapshot runtime.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- **No fix was attempted** after the diagnostic.
- **No retry was attempted** after the diagnostic.
- No raw `psql` output, DSN, password, token, host, port, IP, raw PostgreSQL
  error text, customer data, row values, UUIDs, `request_id`, `session_id`,
  payloads, or `canonical_jsonb` printed.

---

## 5. Verdict

- **`STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`** — the psql gate query
  failed and was classified to the broad **`auth_or_credential`** class, with raw
  output withheld and no secret exposed. The DSN/host/port/secret were all
  present and the connection layer reached `psql`; the failure is in the
  **auth/credential** layer.
- This is **not** a Stage 0 execution, **not** a connectivity failure, **not** an
  SSL/`pg_hba` failure, and **not** a proven specific root cause.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not run any fix, password reset, role change, GRANT, DML, DDL, Stage 0
   retry, or runtime action** off the back of this diagnostic without separate
   review and a fresh explicit GO.
3. The `auth_or_credential` class should inform a **separately planned,
   secret-safe** next step (e.g. confirm the `buyerrecon_stage0_runner` password
   custody / role login usability via an approved, GO-gated, secret-safe check) —
   itself a docs-only plan first, then GO-gated.
4. **Stage 0 execution remains separately GO-gated** and is not authorized by this
   evidence.

---

## 7. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw PostgreSQL error text, or customer
data. The diagnostic withheld raw `psql` output (`raw_output_withheld=true`,
`raw_psql_output_printed=false`) and classified to a **broad** class only. All
values above are safe labels / booleans / public git commit hashes / a broad
classifier token (`auth_or_credential`) / role / database names — not secret or
row values.
