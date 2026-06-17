# Sprint 3 — Stage 0 — Route A Live-Auth Category-Only Classifier Command-Pack Plan (Review-Only)

**Status:** `STAGE0_ROUTE_A_LIVE_AUTH_CATEGORY_CLASSIFIER_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. Per the merged PR #285 investigation
plan (Route A recommended first), this designs a **future one-shot, category-only classifier
command pack** over the **already-withheld** raw psql/PostgreSQL auth-failure output — to
classify the failure **family** into a safe allowlisted category **without printing raw
output** — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no** classifier execution, raw-output
inspection, psql/auth rerun, credential rotation, RB-ROTATE retry, custody write, Option A
retry, Step 2E, Stage 0, run-lock touch, grants, schema changes, data reads/writes,
source-selection change, Option B code change, remediation, downstream runtime,
Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. **No** raw psql/PostgreSQL output, raw
error text, DSN, password, token, host, port, database name, username, URL/URI, service-file
contents, `.env.production` value, custody contents, customer payload, or PII appears in this
document.

> Provenance: PR #285 live-auth failure investigation plan
> (`2d985e5643136b78281c8c06742f5f6443f57349`,
> `STAGE0_LIVE_AUTH_FAILURE_INVESTIGATION_PLANNING_ONLY`); PR #284 Option A live-auth preflight
> AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`); PR #262 revised
> classifier model (`155737d007dcf43c40eb4db43546705562c9424e`); PR #260 raw-output-leak
> incident to avoid (`257f87bdb7740eae47f63e141ba4648bc25af559`).

---

## 1. Status

`STAGE0_ROUTE_A_LIVE_AUTH_CATEGORY_CLASSIFIER_COMMAND_PACK_PLANNING_ONLY` — docs-only; designs
the Route A classifier command pack; authorizes/executes nothing.

---

## 2. Evidence Chain

- **PR #284** (`f710696b20278d406f0b5f5a457ac7b81ccb5664`): Option A live-auth preflight
  **AUTH_FAILED** with raw psql/PostgreSQL output **withheld** (`psql_auth_succeeded=false`,
  `live_auth_preflight_result=auth_failed`, `stop_line=psql_auth_failed_raw_withheld`;
  conservatively recorded as two identical read-only invocations; no Stage 0 / run-lock /
  schema / data / grant / custody / credential / runtime effects).
- **PR #285** (`2d985e5643136b78281c8c06742f5f6443f57349`): investigation plan; **Route A
  recommended first**.
- **Current state:** **live auth failed**, raw output **remains withheld**, **exact subcase
  remains unknown**, `live_auth_proven=false`, `auth_or_credential` unresolved at the live-auth
  level. **Stage 0 execution remains separately GO-gated.**
- This plan is the **next recommended Route A step only** — a category-only classifier; it does
  **not** fix the issue, prove live auth, or authorize Route B/C.

---

## 3. Purpose

Define a **future one-shot category-only classifier** command pack that reads the
**already-withheld** raw psql/PostgreSQL auth output (chmod-600, captured by the PR #284
preflight) and emits **only a safe allowlisted category label** describing the failure family
— **never** the raw output, raw error text, or any connection component.

---

## 4. Hard Safety Requirements

The future command pack (and this PR) must guarantee:
- **No** raw psql/PostgreSQL output printed.
- **No** DSN, password, token, host, port, database name, username, URL, URI, service-file
  contents, `.env.production` value, custody contents, customer payload, or PII printed.
- **No** raw output copied into this (or any) doc.
- **No** raw output committed to the repo.
- **No** raw output passed through shell **argv**.
- **No** execution in this PR.
- **No** psql/auth rerun.
- **No** raw-output inspection beyond the future bounded classifier action (allowlisted,
  non-printing).
- **No** credential rotation.
- **No** custody write.
- **No** Stage 0.
- **No** run-lock touch.
- **No** grants, schema changes, data reads, data writes, source-selection changes, Option B
  code change, remediation, downstream runtime, Lane/scoring/AMS/customer output, Gate 4E, or
  Gate 4F.

---

## 5. Command-Pack Design (CANDIDATE ONLY — DO NOT RUN)

> Design contract for a **future, separately-reviewed, separately GO-gated** classifier —
> **not** run here. Follows the PR #261/#262 revised-classifier model; the PR #260 incident
> (executing the raw-output file as code, leaking raw text) **must not recur**.

- **Code from stdin; raw input as data only.** The classifier code is read by the interpreter
  from **stdin** (heredoc), and the withheld raw-output file path is passed as a **data
  argument** that the code **opens and reads** — it is **never** executed as code, and its
  contents are **never** printed.
  - Safe shape (illustrative): `node - "$RAW_OUT" <<'NODE' … NODE` (code from stdin; `$RAW_OUT`
    is a data path). **Forbidden:** `node "$RAW_OUT" <<'NODE'` (executes raw file as code —
    the PR #260 fault).
- **Synthetic self-test first.** Before touching the real withheld output, the classifier runs
  a **self-test against synthetic fixture text** covering representative classes (e.g. a
  synthetic "password authentication failed" line, a synthetic "no pg_hba.conf entry" line, a
  synthetic SSL-required line, a synthetic role/database line, a synthetic connection-target
  line, and an unmatched line) and must prove: code-ran-from-stdin, data-only handling
  (synthetic file read, never executed/printed), allowlisted-label-only output, and no raw
  fixture text printed. **If the self-test fails, stop before touching the real file** (fail
  closed).
- **Real classification only after self-test passes.** Read the real withheld output **only if
  it still exists and is chmod 600**, classify against the §6 allowlist using **non-secret
  pattern signals only**, and emit **exactly one** allowlisted category label.
- **Allowlist only.** If no allowlist pattern matches (or classification is uncertain or would
  require raw disclosure), emit **`unknown_auth_or_connection_failure`**.
- **Output discipline.** Emit **category labels only**; **never** emit the matched raw text;
  **never** emit PostgreSQL error wording; **never** emit connection components
  (DSN/host/port/user/database/URI/service-file content). **Fail closed** on any uncertainty.

---

## 6. Allowlisted Category Outputs

```text
password_authentication_failed
role_missing_or_not_login
database_missing_or_not_allowed
pg_hba_or_network_policy
ssl_or_channel_policy
service_resolution_or_connection_target
unknown_auth_or_connection_failure
```

Exactly **one** of these is emitted; anything else (or any uncertainty / raw-disclosure
requirement) → `unknown_auth_or_connection_failure`.

---

## 7. Required Safe Labels (future execution evidence)

```text
route_a_classifier_attempted=true
synthetic_self_test_passed=true|false
real_raw_output_classified=true|false
raw_output_printed=false
raw_output_committed=false
dsn_printed=false
connection_components_printed=false
classifier_result=<allowlisted_class>
classifier_result_safe=true|false
stage0_executed=false
run_lock_touched=false
credential_rotated=false
custody_written=false
persistent_db_effects=false
```

> A future run additionally emits the boolean self-test proofs (code-from-stdin, data-only,
> allowlisted-token-only, no-raw-print) and a `stop_line` token — safe tokens only; **no raw
> text**.

---

## 8. Stop-Lines

Abort (safe stop-line + non-zero exit; no raw/secret emitted) if any of:
- the **PR #285 merge commit** `2d985e5643136b78281c8c06742f5f6443f57349` is **not present in
  local HEAD**;
- the working tree is **not clean** (except pre-existing untracked `deep-research-report*`
  files);
- the **synthetic self-test fails**;
- the classifier would **print raw output or matched raw text**;
- the classifier output is **not allowlisted**;
- raw output would be **committed or copied into docs**;
- any **DSN / credential / host / port / user / database / service content** would be printed;
- the command path would **rerun psql/auth**;
- a **Stage 0 / run-lock / downstream** action would be touched.

If a stop-line is hit, withhold all raw/secret output, record the blocked state in a docs-only
evidence PR (safe labels only), and take no fix/retry without separate review/GO.

---

## 9. Route Sequencing

- Route A **only classifies** the already-withheld auth-failure category.
- It does **not** fix the issue.
- It does **not** prove live auth.
- It does **not** authorize Route B (custody/credential re-confirmation) or Route C
  (role/connection-policy diagnostics).
- **After** the Route A evidence is reviewed/merged, a **separate planning PR** chooses Route B
  or Route C **based on the safe classifier category** (e.g. `password_authentication_failed` →
  Route B; `pg_hba_or_network_policy` / `ssl_or_channel_policy` / `role_missing_or_not_login` →
  Route C; `unknown_auth_or_connection_failure` → re-plan). **Stage 0 remains separately
  GO-gated.**

---

## 10. Future Gated Sequence

1. **Merge** this docs-only Route A classifier command-pack planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **one** Route A classifier run (current-tip fast-forward;
   self-test first; classify the withheld output only if it exists chmod 600; allowlisted
   label only; fail closed).
3. Docs-only **classifier evidence PR** (safe class label only; no raw output).
4. **Separate planning PR** chooses Route B or Route C based on the class.
5. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false** until
   live auth is genuinely proven.

---

## 11. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, **raw psql output, raw
PostgreSQL error text**, Node stack trace, or customer data. This is a docs-only plan for a
**future** category-only classifier that reads its **code from stdin** and treats the
withheld raw-output path as **data only** (never executed — avoiding the PR #260 fault), gated
by a **synthetic self-test** that must pass before the real file is touched, emitting **one
allowlisted category label** (§6) and failing closed to `unknown_auth_or_connection_failure`;
it **runs no classifier**, inspects/prints **no** raw output, runs **no** psql/auth, rotates
**no** credential, writes **no** custody, and records **no** DSN/secret/connection value. The
illustrative invocation strings (`node - "$RAW_OUT" …` safe; `node "$RAW_OUT" …` forbidden)
are non-secret shell-shape examples, not data. The allowlisted category tokens, the role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, the
env-var/key name `STAGE0_RUNNER_DSN`, and the database name `buyerrecon_production` are
non-secret identifiers. (Per the PR #218 Codex note: "no secret used or exposed" is to be read
as "no secret value exposed, printed, or recorded.") All values above are safe labels /
booleans / category tokens / non-secret shell-shape examples / public git commit hashes — not
secret or row values.
