# Sprint 3 — Stage 0 — Route A Retained-Capture Presence-Check — Evidence (PRESENT)

**Status:** `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_PRESENT`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 ROUTE A RETAINED-CAPTURE PRESENCE-CHECK GO`, the operator ran the prepared
stat-only presence-check script (SHA-256
`57c6a9887fc759e5cd2398f01fe3467d26380ceb1284881aac9f9ea67610dcc4`, `sha256_match=true`,
`syntax_check=pass`) **exactly once** on production. The check confirmed — **without reading
contents or printing the path** — that a **retained chmod-600 withheld capture is present**
(regular file, owned by current user, nonzero size). **Result: `presence_check_result=present`.**

**This is a metadata-only PRESENCE result — it does NOT read or classify the capture, does NOT
prove credential authentication, live auth, or Stage 0 readiness, and does NOT authorize Route
A/B/C, Step 2E, Stage 0, or any downstream action.** It only **unlocks eligibility** for a
**future, separately GO-gated** Route A classifier run. This PR records safe **booleans/category
tokens / public hashes only** — no retained-capture path value, no raw psql/PostgreSQL output,
no DSN/credential/host/port/user/database/service detail, no `.env.production` value, no
custody contents.

> Provenance: PR #289 presence-check operator-prep evidence
> (`3ecf436a34a60f99c91479f080222920cda5b800`,
> `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_OPERATOR_PREP_ONLY`); PR #288 presence-check
> plan (`a662b4b33edc342ab142cfa171c6e9519f66f01f`); PR #287 Route A classifier operator-prep
> (`4c5bfadcb3c36cace27b0b31229f3bfae5a625e0`); PR #286 Route A classifier plan
> (`2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d`); PR #284 Option A live-auth preflight
> AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`).

---

## 1. Authorization & Pre-Run Verification

- GO: `HELEN STAGE0 ROUTE A RETAINED-CAPTURE PRESENCE-CHECK GO` — exactly one stat-only
  presence check.
- Prepared script SHA-256:
  `57c6a9887fc759e5cd2398f01fe3467d26380ceb1284881aac9f9ea67610dcc4` (verified
  `sha256_match=true`, `syntax_check=pass` before running).
- The check is **stat-only**; it did **not** read contents, print the path, run the classifier,
  or run psql/auth.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual presence-check run)

```text
presence_check_operator_session_started=true
current_branch=sprint2-architecture-contracts-d4cc2bf
fast_forward_success=true
pr289_merge_present=true
tracked_working_tree_clean=true
sha256_match=true
syntax_check=pass
retained_capture_check_attempted=true
candidate_path_source_category=operator_supplied
candidate_path_value_printed=false
retained_capture_path_set=true
retained_capture_exists=true
retained_capture_is_regular_file=true
retained_capture_permissions_600=true
retained_capture_owner_current_user=true
retained_capture_size_nonzero=true
retained_capture_read=false
raw_output_printed=false
classifier_executed=false
psql_auth_rerun=false
stage0_executed=false
run_lock_touched=false
presence_check_result=present
presence_check_operator_session_completed=true
```

---

## 3. Interpretation (bounded)

- A retained withheld capture **is present** as a **regular chmod-600 file, owned by the
  current user, with nonzero size** (`retained_capture_exists=true`,
  `retained_capture_is_regular_file=true`, `retained_capture_permissions_600=true`,
  `retained_capture_owner_current_user=true`, `retained_capture_size_nonzero=true`).
- The retained capture was **not read** (`retained_capture_read=false`).
- The retained-capture **path value was not printed** (`candidate_path_value_printed=false`).
- **Raw output was not printed** (`raw_output_printed=false`).
- The **Route A classifier did not run** (`classifier_executed=false`).
- **psql/auth did not rerun** (`psql_auth_rerun=false`).
- **Stage 0 did not run** (`stage0_executed=false`); **run-lock not touched**
  (`run_lock_touched=false`).
- Phase-0 preconditions held: branch `sprint2-architecture-contracts-d4cc2bf`, fast-forward
  success, PR #289 merge present, tracked working tree clean, SHA match, syntax pass.

### 3.1 What this result does and does NOT do
- **Does:** confirm a retained capture exists with safe permissions/ownership/size — i.e. Route
  A now has something to classify; this **unlocks eligibility** for a future separately
  GO-gated Route A classifier run.
- **Does NOT:** classify the auth failure; prove credential authentication; prove live auth;
  prove Stage 0 readiness; authorize Route A execution, Route B, Route C, Step 2E, Stage 0, or
  any downstream action. `live_auth_proven` remains **false**; `auth_or_credential` remains
  unresolved at the live-auth level.

---

## 4. What Did Not Happen

- No Route A classifier run.
- No retained-capture contents read, inspected, pasted, copied, transferred, classified,
  checksummed, or committed.
- No retained-capture path value printed.
- No raw psql/PostgreSQL output printed.
- No psql/auth rerun; no recapture.
- No credential rotation; no custody write; no RB-ROTATE retry.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes; no source-selection change; no Option B code change; no
  remediation.
- No downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E; no Gate 4F.
- No DSN, password, token, host, port, user, database, service content, `.env.production`
  value, custody contents, customer payload, or PII recorded.

---

## 5. Verdict

- **PRESENT (safe; stat-only) — `presence_check_result=present`**: a retained chmod-600 withheld
  capture exists (regular file, current-user owner, nonzero size), confirmed by metadata only —
  contents not read, path not printed, classifier not run, no psql/auth, no Stage 0.
- This is **not** a classification, **not** a proof of auth/live-auth/Stage 0 readiness, and
  **not** authorization for any Route A/B/C, Step 2E, Stage 0, or downstream action — it only
  makes a **future separately GO-gated** Route A classifier run **eligible**.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run the Route A classifier, read/inspect the retained capture, rerun psql/auth,
   rotate credentials, write custody, run Step 2E, run Stage 0, or touch the run-lock off this
   record.
3. When ready, a **fresh explicit Helen GO** may authorize **exactly one** Route A classifier
   run (using the prepared, SHA-verified classifier script
   `3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a` with `RB_RAW_OUTPUT_PATH`
   set to the present retained capture; self-test first; allowlist-only; raw output never
   printed) → docs-only classifier evidence PR (safe class label only).
4. The resulting class steers a **separate planning PR** for Route B (custody/credential
   re-confirmation) or Route C (role/connection-policy diagnostics);
   `unknown_auth_or_connection_failure` → re-plan.
5. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail,
**retained-capture path value**, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent value, raw
SQL, **raw psql output, raw PostgreSQL error text**, Node stack trace, or customer data. The
presence check was **stat-only**: it confirmed existence / regular-file / chmod-600 /
current-user-owner / nonzero-size via metadata, **without reading the capture's contents**
(`retained_capture_read=false`), **without printing the path value**
(`candidate_path_value_printed=false`), **without running the classifier**
(`classifier_executed=false`), and **without any psql/auth rerun** (`psql_auth_rerun=false`).
The env-var name `RB_RAW_OUTPUT_PATH`, the recorded script SHA-256s, the result token `present`,
the role name `buyerrecon_stage0_runner`, and the database name `buyerrecon_production` are
non-secret identifiers; the recorded SHA-256 / commit hashes are public. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit & script hashes — not secret or row values.
