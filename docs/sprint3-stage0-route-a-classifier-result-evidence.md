# Sprint 3 — Stage 0 — Route A Live-Auth Classifier — Result Evidence (role_missing_or_not_login)

**Status:** `STAGE0_ROUTE_A_CLASSIFIER_RESULT_ROLE_MISSING_OR_NOT_LOGIN`

This is a **docs-only evidence record**. Under an explicit Helen GO, the operator ran the
prepared Route A category-only classifier (SHA-256
`3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a`,
`classifier_sha256_match=true`, `classifier_syntax_check=pass`) **exactly once** on production,
against the retained (chmod-600) withheld auth-failure capture confirmed present by PR #290. The
synthetic self-test passed first, then the real withheld output was classified **without
printing raw output or matched text**. **Result: the allowlisted safe class
`classifier_result=role_missing_or_not_login`** (`classifier_result_safe=true`).

**This is a safe category-only classification — it does NOT print raw psql/PostgreSQL output,
does NOT prove live authentication, does NOT prove Stage 0 readiness, and does NOT authorize
Stage 0, Route B, Route C, or any downstream action.** It records safe **booleans/category
tokens / public hashes only** — no retained-capture path value, no raw output, no
DSN/credential/host/port/user/database/service detail, no `.env.production` value, no custody
contents.

> Provenance: PR #290 retained-capture presence-check PRESENT
> (`464ef735e85f39de79c60a3b2e675097a29ac37e`,
> `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_PRESENT`); PR #287 Route A classifier
> operator-prep (`4c5bfadcb3c36cace27b0b31229f3bfae5a625e0`); PR #286 Route A classifier plan
> (`2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d`); PR #284 Option A live-auth preflight
> AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`).

---

## 1. Authorization & Pre-Run Verification

- GO: explicit Helen GO for **exactly one** Route A classifier run.
- Classifier SHA-256:
  `3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a` (verified
  `classifier_sha256_match=true`, `classifier_syntax_check=pass` before running).
- The classifier is **category-only** (PR #261/#262 model: code-from-stdin, data-only raw path,
  synthetic self-test first, allowlist-only, fail-closed); it did **not** print raw output,
  rerun psql/auth, rotate credentials, write custody, or run Stage 0.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual classifier run)

```text
route_a_classifier_operator_session_started=true
current_branch=sprint2-architecture-contracts-d4cc2bf
fast_forward_success=true
pr290_merge_present=true
tracked_working_tree_clean=true
classifier_sha256_match=true
classifier_syntax_check=pass
route_a_classifier_attempted=true
synthetic_self_test_passed=true
real_raw_output_classified=true
raw_output_printed=false
raw_output_committed=false
dsn_printed=false
connection_components_printed=false
classifier_result=role_missing_or_not_login
classifier_result_safe=true
stage0_executed=false
run_lock_touched=false
credential_rotated=false
custody_written=false
persistent_db_effects=false
route_a_classifier_operator_session_completed=true
```

---

## 3. Interpretation (bounded)

- The Route A classifier **executed exactly once**; the **synthetic self-test passed**
  (`synthetic_self_test_passed=true`).
- The retained withheld output was **classified** (`real_raw_output_classified=true`) **without
  printing raw output or matched text** (`raw_output_printed=false`,
  `raw_output_committed=false`); **no DSN or connection components were printed**
  (`dsn_printed=false`, `connection_components_printed=false`).
- The classifier returned the **allowlisted safe class
  `role_missing_or_not_login`** (`classifier_result_safe=true`).
- **No** Stage 0 (`stage0_executed=false`); **run-lock not touched** (`run_lock_touched=false`);
  **no** credential rotation (`credential_rotated=false`); **no** custody write
  (`custody_written=false`); **no persistent DB effects** (`persistent_db_effects=false`).
- Phase-0 preconditions held: branch `sprint2-architecture-contracts-d4cc2bf`, fast-forward
  success, PR #290 merge present, tracked working tree clean, SHA match, syntax pass.

### 3.1 What this class means and steers (bounded)
- `role_missing_or_not_login` is the **safe failure family**: the auth failure is consistent
  with the runner **role not existing or not being permitted to log in** (e.g. a `LOGIN`
  attribute / role-existence / role-policy issue) — as opposed to a wrong-password
  (`password_authentication_failed`) class.
- **Bounded:** this is a category signal from the withheld output, **not** a proof of the exact
  role attribute, **not** a proof of live auth, **not** Stage 0 readiness, and **not**
  authorization for any action.
- **Routing:** this class steers the next planning step toward **Route C** (role /
  connection-policy diagnostics — booleans only: role existence, `LOGIN`, `VALID UNTIL`,
  connection limit, policy category), **not** Route B (password/custody correction).

---

## 4. What Did Not Happen

- No further classifier execution (this records the single authorized run).
- No raw psql/PostgreSQL output printed, committed, inspected, or pasted; no matched raw text.
- No retained-capture path value recorded.
- No DSN / connection components / host / port / user / database / service detail /
  `.env.production` value / custody contents / customer payload / PII recorded.
- No psql/auth rerun; no recapture.
- No credential rotation; no custody write; no RB-ROTATE retry.
- No Route B execution; no Route C execution.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes; no source-selection change; no Option B code change; no
  remediation.
- No downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E; no Gate 4F.

---

## 5. Verdict

- **CLASSIFIED (safe) — Route A classifier result is
  `classifier_result=role_missing_or_not_login`, `classifier_result_safe=true`**: self-test
  passed first, the retained withheld capture was classified category-only with raw output never
  printed, and exactly one allowlisted class was emitted.
- This is **not** a proof of the exact role attribute, **not** a proof of live auth, **not** a
  Stage 0 readiness proof, and **not** authorization for Route B/C, Step 2E, Stage 0, or any
  downstream action. `live_auth_proven` remains **false**.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run the classifier again, inspect/paste raw output, rerun psql/auth, rotate
   credentials, write custody, run Route B/C, run Step 2E, run Stage 0, or touch the run-lock
   off this record.
3. After this evidence PR is reviewed/merged, create a **separate docs-only Route C planning
   PR** for **role / connection-policy diagnostics** (booleans only — role existence, `LOGIN`,
   `VALID UNTIL`, connection limit, allowed-connection/SSL **category**; never raw `pg_hba`
   output, never raw host/port), since the class is `role_missing_or_not_login` (not a
   password/custody class → not Route B). Route C requires its own Codex review and a fresh
   explicit Helen GO.
4. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail,
**retained-capture path value**, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent value, raw
SQL, **raw psql output, raw PostgreSQL error text**, matched raw text, Node stack trace, or
customer data. The Route A classifier ran **category-only**: a synthetic self-test passed first,
then the retained chmod-600 withheld capture was read **as data** and classified to **one
allowlisted class** (`role_missing_or_not_login`) — **raw output was not printed**
(`raw_output_printed=false`), not committed (`raw_output_committed=false`), and no DSN /
connection components were printed (`dsn_printed=false`,
`connection_components_printed=false`). The class token, the env-var name `RB_RAW_OUTPUT_PATH`,
the classifier script SHA-256, the role name `buyerrecon_stage0_runner`, and the database name
`buyerrecon_production` are non-secret identifiers; the recorded SHA-256 / commit hashes are
public. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret identifiers / public git commit & script hashes — not secret or row values.
