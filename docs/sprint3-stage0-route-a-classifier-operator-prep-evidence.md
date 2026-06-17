# Sprint 3 — Stage 0 — Route A Live-Auth Classifier — Operator-Prep Evidence (PREP ONLY)

**Status:** `STAGE0_ROUTE_A_CLASSIFIER_OPERATOR_PREP_ONLY`

This is a **docs-only operator-prep evidence record**. It records that the Route A live-auth
category-only classifier command pack (per merged PR #286) has been **prepared as an
operator-only script** and **syntax-checked** — **no execution occurred**. This documents the
script's identity, safety properties, and the future operator transfer/verification procedure;
it is **not** an authorization to run it.

This PR **executes nothing** and **authorizes no** classifier execution, raw-output inspection,
psql/auth rerun, credential rotation, RB-ROTATE retry, custody write, Option A retry, Step 2E,
Stage 0, run-lock touch, grants, schema/data changes, source-selection change, Option B code
change, remediation, downstream runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F.
**No** raw psql/PostgreSQL output, raw error text, DSN, password, token, host, port, database
name, username, URL/URI, service-file contents, `.env.production` value, custody contents,
customer payload, or PII appears in this document.

> Provenance: PR #286 Route A classifier command-pack plan
> (`2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d`,
> `STAGE0_ROUTE_A_LIVE_AUTH_CATEGORY_CLASSIFIER_COMMAND_PACK_PLANNING_ONLY`); PR #285
> investigation plan (`2d985e5643136b78281c8c06742f5f6443f57349`); PR #284 Option A live-auth
> preflight AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`); PR #262
> revised classifier model (`155737d007dcf43c40eb4db43546705562c9424e`); PR #260 raw-leak
> incident to avoid (`257f87bdb7740eae47f63e141ba4648bc25af559`).

---

## 1. Prepared Artifact (identity)

```text
prepared_script_path=/tmp/buyerrecon-stage0-route-a-classifier.sh
prepared_script_sha256=3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a
syntax_status=SOURCE_SYNTAX_OK
pr286_merge_commit=2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d
```

> The script lives on the preparer's workstation under `/tmp` (a transient path); this record
> fixes its **SHA-256** so the production host can verify byte-identity before any future run.

---

## 2. Prep-Only Boundary (what did NOT happen)

- This is **operator-prep evidence only**.
- **No classifier execution occurred** (only `bash -n` syntax check ran).
- **No raw output was touched, read, pasted, inspected, transferred, classified, or
  committed.**
- **No** psql/auth rerun occurred.
- **No** credential rotation, custody write, Stage 0, run-lock touch, grants, schema/data
  changes, source-selection changes, remediation, downstream runtime, Lane/scoring/AMS/customer
  output, Gate 4E, or Gate 4F occurred.

---

## 3. Script Safety Properties (follows PR #286)

The prepared script:
- uses **code-from-stdin** (classifier code piped to `node -`);
- treats the raw input as a **data-only path** (`process.argv[2]`, read with `fs`) — **never**
  executed as code, **never** passed as argv content (**avoids the PR #260 raw-leak mode**);
- runs a **synthetic self-test first**, using **abstract category-token fixtures only**
  (`selftest-class-token::<class>`) — **no** PostgreSQL-like literal wording (addresses the
  PR #286 non-blocking note);
- only classifies the **real** withheld output **after** the self-test passes;
- emits an **allowlist-only** classifier result;
- emits **safe labels only**;
- **fails closed** to `unknown_auth_or_connection_failure`;
- prints **no** raw output, matched text, PostgreSQL error wording, connection components, DSN,
  or credentials.

**Allowlisted `classifier_result` values:**
```text
password_authentication_failed
role_missing_or_not_login
database_missing_or_not_allowed
pg_hba_or_network_policy
ssl_or_channel_policy
service_resolution_or_connection_target
unknown_auth_or_connection_failure
```

**Safe label set the script may print:**
```text
route_a_classifier_attempted
synthetic_self_test_passed
real_raw_output_classified
raw_output_printed=false
raw_output_committed=false
dsn_printed=false
connection_components_printed=false
classifier_result=<allowlisted_class>
classifier_result_safe
stage0_executed=false
run_lock_touched=false
credential_rotated=false
custody_written=false
persistent_db_effects=false
```

---

## 4. Future Operator Transfer / Verification (NOT authorization)

This procedure is **future operator-only** and does **not** authorize a run:
1. Transfer the raw file (bytes; not via this doc):
   `rsync -av --checksum --chmod=F600 /tmp/buyerrecon-stage0-route-a-classifier.sh OP_USER@PROD_HOST:/tmp/buyerrecon-stage0-route-a-classifier.sh`
2. On the production host, verify before any run:
   - `sha256_match=true` against
     `3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a`;
   - `syntax_check=pass` (`bash -n`).
3. **Run only under a fresh explicit Helen GO**, and only if both checks pass.

---

## 5. Run Preconditions & Operational Caveat

- `RB_RAW_OUTPUT_PATH` must point to a **retained chmod-600 withheld-capture** of the PR #284
  auth output. The script reads it as **data** (path), never printing its contents.
- **If no retained withheld capture exists, the classifier must fail closed and must NOT rerun
  auth.** The prepared script enforces this: it stops (fail closed) when `RB_RAW_OUTPUT_PATH`
  is unset, missing, or not chmod 600 — it does **not** attempt a psql/auth re-capture.
- **Operational caveat:** the PR #284 preflight withheld raw output to a chmod-600 temp and may
  have **removed** it. **If no retained capture exists, Route A cannot classify**, and the next
  move is to **re-plan** via either a **separately GO-gated raw-withheld re-capture** or
  **Route C role/connection-policy diagnostics** (booleans only). No re-capture or rerun is
  authorized here.

---

## 6. Important Correction (bounded interpretation)

- Route A **does not** prove the rotated credential authenticates.
- Route A **does not** prove live auth.
- Route A **does not** authorize Stage 0.
- Route A **only classifies** the already-withheld auth-failure **category** — and only **if a
  retained chmod-600 capture exists**. It is a diagnostic narrowing step, not a fix and not a
  readiness proof. `live_auth_proven` remains **false**; `auth_or_credential` remains unresolved
  at the live-auth level. **Stage 0 execution remains separately GO-gated.**

---

## 7. Required Next Step

1. **Codex review and merge** of this ops-prep evidence PR.
2. **Do not** run the classifier, touch the withheld output, rerun psql/auth, rotate
   credentials, write custody, run Stage 0, or touch the run-lock off this record.
3. When ready, **a fresh explicit Helen GO** authorizes **one** Route A classifier run (after
   the operator confirms a retained chmod-600 capture exists and the transfer/SHA/`bash -n`
   checks pass) → docs-only **classifier evidence PR** (safe class label only).
4. The resulting class steers a **separate planning PR** for Route B (custody/credential
   re-confirmation) or Route C (role/connection-policy diagnostics); `unknown_auth_or_connection_failure`
   → re-plan.
5. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false.**

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, **raw psql output, raw
PostgreSQL error text**, Node stack trace, or customer data. This is operator-prep
documentation only: it records the prepared script's path and **SHA-256**, its syntax status,
its PR #286-aligned safety properties (code-from-stdin, data-only raw path, synthetic
self-test with abstract fixtures, allowlist-only, safe-labels-only, fail-closed, PR #260 mode
avoided), and a **future** operator transfer/verification procedure — **no classifier ran**,
**no raw output was touched**, and **no** DSN/secret/connection value is recorded. The
allowlisted category tokens, the role name `buyerrecon_stage0_runner`, the env-var/key name
`STAGE0_RUNNER_DSN`, the run-time env-var name `RB_RAW_OUTPUT_PATH`, and the database name
`buyerrecon_production` are non-secret identifiers; the recorded SHA-256 / commit hashes are
public. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret identifiers / public git commit & script hashes — not secret or row
values.
