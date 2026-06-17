# Sprint 3 — Stage 0 — Route A Retained-Capture Presence-Check Plan (Review-Only)

**Status:** `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. Before any Route A classifier execution
can be GO-gated, we must first establish — **secret-safely and without reading anything** —
whether a **retained chmod-600 withheld capture** of the PR #284 auth output still exists
(the PR #284 preflight may have removed its chmod-600 temp). This plans a future
**presence-only check** — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no** presence-check execution, Route A classifier
execution, raw-output inspection, psql/auth rerun, recapture, credential rotation, RB-ROTATE
retry, custody write, Step 2E, Stage 0, run-lock touch, grants, schema/data changes,
source-selection change, Option B code change, remediation, downstream runtime,
Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. **No** raw psql/PostgreSQL output, raw
error text, DSN, password, token, host, port, username, database name, service-file content,
`.env.production` value, custody contents, customer payload, or PII appears in this document.

> Provenance: PR #287 Route A classifier operator-prep evidence
> (`4c5bfadcb3c36cace27b0b31229f3bfae5a625e0`,
> `STAGE0_ROUTE_A_CLASSIFIER_OPERATOR_PREP_ONLY`); PR #286 Route A classifier command-pack plan
> (`2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d`); PR #284 Option A live-auth preflight
> AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`). Prepared classifier
> script SHA-256 `3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a`
> (`SOURCE_SYNTAX_OK`).

---

## 1. Status & Purpose

`STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_PLANNING_ONLY` — docs-only; designs a future
**presence-only** check (file existence / type / permissions / owner / non-zero size — **never
contents**) to decide whether Route A can classify; authorizes/executes nothing.

Route A can classify **only if** a retained chmod-600 withheld capture exists. Route A does
**not** prove credential auth, live auth, or Stage 0 readiness — and neither does this
presence check.

---

## 2. Future Presence-Only Check — Hard Constraints

The future check must:
- **Not read** the retained capture (no contents access of any kind).
- **Not print** the retained-capture path value (treated as potentially sensitive — emit a
  source category only).
- **Not print** raw psql/PostgreSQL output.
- **Not classify** anything.
- **Not run** the Route A classifier.
- **Not run** psql/auth or recapture output.
- **Not inspect** raw contents.
- **Not copy, transfer, commit, or paste** raw output.
- **Not print** DSN, password, token, host, port, user, database, service content,
  `.env.production` value, custody contents, customer payload, or PII.

It is a **stat-only** check (existence, regular-file, permission bits, ownership, size>0) over
an **operator-supplied path** — it never opens the file for reading.

---

## 3. Allowed Safe Labels (future check output)

```text
retained_capture_check_attempted=true
candidate_path_source_category=operator_supplied|unknown
candidate_path_value_printed=false
retained_capture_path_set=true|false
retained_capture_exists=true|false
retained_capture_is_regular_file=true|false
retained_capture_permissions_600=true|false
retained_capture_owner_current_user=true|false
retained_capture_size_nonzero=true|false
retained_capture_read=false
raw_output_printed=false
classifier_executed=false
psql_auth_rerun=false
stage0_executed=false
run_lock_touched=false
presence_check_result=present|missing|invalid_permissions|invalid_type|unknown
```

> The path **value** is never printed — only `candidate_path_source_category` and the boolean
> stat results. `retained_capture_read=false`, `raw_output_printed=false`,
> `classifier_executed=false`, and `psql_auth_rerun=false` are invariants of a presence-only
> check.

### 3.1 Result mapping (illustrative; future check)
- `present` — path set, exists, is a regular file, permissions are `600`, owned by the current
  user, size non-zero.
- `missing` — path set but does not exist (e.g. PR #284 removed the temp), or path not set.
- `invalid_permissions` — exists but not `600` / not owned by the current user.
- `invalid_type` — exists but not a regular file.
- `unknown` — indeterminate (fail closed).

---

## 4. Stop-Lines

Abort (safe stop-line; presence-only labels emitted; no contents read/printed) if any of:
- the **PR #287 merge commit** `4c5bfadcb3c36cace27b0b31229f3bfae5a625e0` is **not present in
  local HEAD**;
- the working tree is **not clean** (except pre-existing untracked `deep-research-report*`
  files);
- the check would **read file contents**;
- the check would **print the path value**;
- the check would **print raw output or matched text**;
- the check would **run the classifier**;
- the check would **rerun psql/auth** (or recapture);
- the check would **touch Stage 0 / run-lock / downstream** action.

If a stop-line is hit, emit only the safe presence labels (or stop with no contents access),
and take no fix/retry without separate review/GO.

---

## 5. Route Decision After Presence Evidence

- If **`presence_check_result=present`** → a **separate fresh Helen GO** may authorize **one**
  Route A classifier execution (using the prepared, SHA-verified script; `RB_RAW_OUTPUT_PATH`
  set to the retained capture).
- If **`presence_check_result=missing`** (or `invalid_permissions` / `invalid_type` /
  `unknown`) → **Route A must not run.** Next planning is either a **separately GO-gated
  raw-withheld recapture** (a controlled, secret-safe single auth attempt that retains the
  output chmod-600) **or** **Route C** role/connection-policy diagnostics (booleans only).
- **This PR authorizes no presence-check execution and no Route A classifier execution.**

---

## 6. Future Gated Sequence

1. **Merge** this docs-only presence-check planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **one** presence-only check (stat-only; no contents read; no
  path-value print; safe labels only).
3. Docs-only **presence evidence PR** (safe labels only).
4. Based on `presence_check_result`:
   - `present` → fresh GO for **one** Route A classifier run → classifier evidence PR (safe
     class only) → Route B/C planning by class.
   - `missing`/invalid/`unknown` → re-plan (separately GO-gated recapture, or Route C).
5. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false** until
   live auth is genuinely proven.

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, **raw psql output, raw
PostgreSQL error text**, Node stack trace, or customer data. This is a docs-only plan for a
**future presence-only (stat-only) check** that determines whether a retained chmod-600
withheld capture exists — **without reading its contents, without printing its path value,
without running the classifier, and without any psql/auth rerun or recapture** — emitting only
safe boolean/metadata labels and `presence_check_result`. It **runs no check**, reads **no**
file, classifies **nothing**, and records **no** DSN/secret/host/port/custody value. The
env-var name `RB_RAW_OUTPUT_PATH`, the prepared script SHA-256, the allowlisted result tokens,
the role name `buyerrecon_stage0_runner`, and the database name `buyerrecon_production` are
non-secret identifiers; the recorded SHA-256 / commit hashes are public. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit & script hashes — not secret or row values.
