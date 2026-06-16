# Sprint 3 — Stage 0 Step 2G — Option A Revised Auth-Failure Classifier Plan (Review-Only)

**Status:** `STAGE0_STEP2G_OPTION_A_REVISED_AUTH_FAILURE_CLASSIFIER_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. After the first Path A classifier
attempt violated the raw-output boundary (PR #260) by executing the withheld raw-output
file as code, this plans a **revised classifier** that **fixes the invocation** (code from
stdin; raw-output path as **data only**) and adds a **pre-execution self-test** that must
pass against a harmless synthetic file **before** the real raw-output file is touched.

This PR **executes nothing** and **authorizes no classifier run / raw inspection / psql /
reset / remediation**: no classifier rerun, no raw-output inspection/printing, no psql/auth
rerun, no credential reset, no password rotation, no custody-source overwrite, no Option A
preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no source-selection change, no
Option B code change, no `.env.production` read/print, no DSN parsing/component output, no
secret value read/print/parse/log/exposure, no runtime/downstream/Lane/scoring/AMS/customer
action. No real DSN, password, token, host, port, IP, URI, raw psql output, or PostgreSQL
error text appears in this document.

> Provenance: PR #260 auth-failure classifier blocked — raw-output boundary violated
> (`257f87bdb7740eae47f63e141ba4648bc25af559`,
> `STAGE0_STEP2G_OPTION_A_AUTH_FAILURE_CLASSIFIER_BLOCKED_RAW_OUTPUT_LEAKED`); PR #259
> auth-failure classification plan (`46df9c573b00ef6711fd42a7f51b4adf6deddf97`); PR #258
> Option A auth preflight retry — auth failed, raw withheld
> (`73ffdc162aa870b71e8c08aedc3441efdba367f3`).

---

## 1. Status

`STAGE0_STEP2G_OPTION_A_REVISED_AUTH_FAILURE_CLASSIFIER_PLANNING_ONLY` — docs-only;
designs the revised classifier + self-test only; authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #258 / #259 / #260)

- **PR #258:** Option A auth preflight reached psql/auth and **failed**; raw auth output
  originally **withheld/chmod 600**.
- **PR #259:** planned a **category-only** classifier (Path A).
- **PR #260:** first classifier attempt **blocked — raw-output boundary violated**; root
  cause an unsafe Node invocation that executed the raw-output file as code; classifier did
  not complete; **no valid category produced**; leaked content **not** reproduced in repo
  evidence.
- Exact auth-failure reason remains **unclassified by safe means**; **Stage 0 remains
  separately GO-gated**.

---

## 3. Root Cause of the Classifier Incident

The PR #260 classifier used an invocation that passed the **raw-output file path as the
script argument to Node**, so Node **executed the raw output as JavaScript** (printing it
and then erroring on a syntax error). The fix is structural: **Node must read the
classifier code from stdin**, and the **raw-output path must be a plain data argument** the
code opens and reads — **never** a path Node executes.

---

## 4. Revised Invocation Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** classifier —
> **not** executed here.

**Required safe pattern** (illustrative; not run here):

```text
node - "$RAW_OUT" <<'NODE'
# - tells Node to read CODE from stdin (the heredoc)
# process.argv[2] is "$RAW_OUT": a DATA path the code opens with fs and reads
# the raw file is NEVER executed as JavaScript
NODE
```

**Forbidden anti-pattern** (the PR #260 fault — never use):

```text
node "$RAW_OUT" <<'NODE'   # WRONG: Node executes $RAW_OUT as a script → raw output leaks
```

Principle: `-` = code from stdin; `"$RAW_OUT"` = argument/data path only; the code reads
`process.argv[2]` as the data file path; the raw file is never executed as code.

---

## 5. Pre-Execution Self-Test Design

Before touching the real raw-output file, a **self-test must run first against a harmless
synthetic temp file** and must **prove**:
- **Node executes classifier code from stdin** (the heredoc/stdin code ran, not the file);
- the **data-file path is treated only as data** (the synthetic file's contents are read,
  never executed — e.g. a synthetic file containing non-JS text does **not** error as code
  and is **not** printed);
- the classifier **emits only an allowlisted category token** for the synthetic input;
- **raw data is not printed** (the synthetic file's contents never appear in output).

**If the self-test fails, stop before touching the real raw-output file** (fail closed; no
real-file access). The **real classifier may run only after the self-test passes.**

> The synthetic temp file contains **harmless non-secret placeholder text only** — never a
> copy of the real raw output, never secret/DSN content.

---

## 6. Real Classifier Design

Only after a passing self-test:
- run the same safe invocation (`node - "$RAW_OUT" …`, code from stdin) against the **real**
  chmod-600 withheld raw-output file as a **data path**;
- read the file with `fs`, classify against the §7 allowlist using **non-secret signals
  only**, and emit **one allowlisted category token**;
- **never print** the raw file contents, raw psql/PostgreSQL text, DSN, host, port,
  database, username, password, IP, URI, or service-file content;
- **fail closed to `unknown_or_unclassified`** if classification is uncertain or would
  require raw disclosure.

---

## 7. Category Allowlist

```text
auth_or_credential
role_or_database
pg_hba_or_network_policy
ssl_or_connection_policy
service_file_shape_or_client_config
unknown_or_unclassified
```

Exactly **one** of these is emitted; anything else (or any uncertainty / raw-disclosure
requirement) → `unknown_or_unclassified`.

---

## 8. Stop-Lines

Abort (safe stop-line + non-zero exit; no value/raw emitted) if any of:
- the **self-test fails**;
- Node would **execute the raw-output file as code**;
- raw output would **print**;
- raw PostgreSQL/psql text would be **emitted**;
- the classifier would emit a **non-allowlisted category**;
- the classifier would require **DSN / host / port / database / username / password / IP /
  URI / service-file content** output;
- the classifier would require **`.env.production` read/print**;
- the classifier would require **another psql/auth attempt**;
- a **credential reset/rotation** would be needed;
- a **Step 2E / Stage 0 / run-lock / downstream** action would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 9. Safe Labels

```text
revised_classifier_planning_only=true
pr260_incident_carried_forward=true
previous_classifier_raw_boundary_violated=true
fixed_invocation_candidate_only=true
classifier_code_from_stdin_required=true
raw_output_path_data_only_required=true
pre_execution_self_test_required=true
classifier_rerun_authorized=false
raw_output_inspection_authorized=false
raw_output_print_authorized=false
credential_reset_authorized=false
option_a_preflight_rerun=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
remediation_authorized=false
```

> A future revised classifier run would additionally emit self-test + outcome booleans
> (e.g. `self_test_attempted`, `self_test_code_from_stdin_proven`,
> `self_test_data_only_proven`, `self_test_no_raw_print_proven`, `self_test_passed`,
> `raw_output_printed=false`, `auth_failure_category=<§7 token>`,
> `revised_classifier_result=<allowlisted>`) — safe tokens only; **no raw text**.

---

## 10. Non-Authorization

**This PR authorizes no:** classifier rerun; raw-output inspection; raw-output printing;
credential reset; password reset/rotation; custody-source overwrite; psql/auth rerun;
Option A preflight rerun; Step 2E; Stage 0; run-lock; remediation; source-selection
change; Option B code change; `.env.production` read/print; DSN parsing/component output;
secret value read/print/parse/log/exposure; runtime/downstream/Lane/scoring/AMS/customer
action.

**The revised classifier run (self-test then category-only classify) is a future,
separately-reviewed, separately GO-gated step.** **Stage 0 execution remains separately
GO-gated.**

---

## 11. Future Gated Sequence

1. **Merge** this docs-only revised classifier planning PR (after Codex review).
2. **Codex review.**
3. **Fresh explicit Helen GO** for **exactly one** revised classifier run.
4. **Run the self-test first** (against a harmless synthetic temp file).
5. **If the self-test passes, run the category-only classifier** over the real withheld
   raw-output file (data-only; one allowlisted token; fail closed to
   `unknown_or_unclassified`).
6. Docs-only **evidence PR** (safe labels only).
7. **Only after** that evidence → decide credential correction / Option A retry / Option B
   planning.
8. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, bearer
token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace, or customer data. This is a docs-only plan for
a **future** classifier that reads its **code from stdin** and treats the raw-output path
as **data only** (never executed), gated by a **pre-execution self-test** against a
harmless synthetic file, emitting **one allowlisted category token** and failing closed to
`unknown_or_unclassified`; it **runs no classifier**, inspects/prints **no** raw output,
runs **no** psql/auth, resets **no** credential, and records **no** DSN/secret/env value.
The illustrative invocation strings (`node - "$RAW_OUT" …` safe; `node "$RAW_OUT" …`
forbidden) are non-secret shell-shape examples, not data. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or recorded.")
All values above are safe labels / booleans / category tokens / non-secret shell-shape
examples / public git commit hashes — not secret or row values.
