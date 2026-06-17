# Sprint 3 — Stage 0 — Route A Retained-Capture Presence-Check — Operator-Prep Evidence (PREP ONLY)

**Status:** `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_OPERATOR_PREP_ONLY`

This is a **docs-only operator-prep evidence record**. It records that the retained-capture
**presence-check** command pack (per merged PR #288) has been **prepared as an operator-only
script** and **syntax-checked** — **no execution occurred**. This documents the script's
identity, stat-only safety properties, and the future operator transfer/verification procedure;
it is **not** an authorization to run it.

This PR **executes nothing** and **authorizes no** presence-check execution, Route A classifier
execution, raw-output inspection, psql/auth rerun, recapture, credential rotation, RB-ROTATE
retry, custody write, Step 2E, Stage 0, run-lock touch, grants, schema/data changes,
source-selection change, Option B code change, remediation, downstream runtime,
Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. **No** raw psql/PostgreSQL output, raw
error text, DSN, password, token, host, port, database name, username, URL/URI, service-file
contents, `.env.production` value, custody contents, candidate path value, customer payload, or
PII appears in this document.

> Provenance: PR #288 retained-capture presence-check plan
> (`a662b4b33edc342ab142cfa171c6e9519f66f01f`,
> `STAGE0_ROUTE_A_RETAINED_CAPTURE_PRESENCE_CHECK_PLANNING_ONLY`); PR #287 Route A classifier
> operator-prep evidence (`4c5bfadcb3c36cace27b0b31229f3bfae5a625e0`); PR #286 Route A
> classifier command-pack plan (`2cd6a74cac38867bc0b7f326f1ac5abfcc02a29d`); PR #284 Option A
> live-auth preflight AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`).

---

## 1. Prepared Artifact (identity)

```text
prepared_presence_check_script_path=/tmp/buyerrecon-stage0-route-a-retained-capture-presence-check.sh
prepared_presence_check_script_sha256=57c6a9887fc759e5cd2398f01fe3467d26380ceb1284881aac9f9ea67610dcc4
syntax_status=SOURCE_SYNTAX_OK
pr288_merge_commit=a662b4b33edc342ab142cfa171c6e9519f66f01f
related_route_a_classifier_script_sha256=3f95c8f703cc1d6e783d3aa30ad340b59e3d37430dcc199994815bfe8226990a
```

> The script lives on the preparer's workstation under `/tmp`; this record fixes its
> **SHA-256** so the production host can verify byte-identity before any future run.

---

## 2. Prep-Only Boundary (what did NOT happen)

- This is **operator-prep evidence only**.
- **No presence check execution occurred** (only `bash -n` syntax check ran).
- **No retained capture was touched, read, pasted, inspected, copied, transferred, classified,
  checksummed, or committed.**
- **No candidate path value was printed.**
- **No file contents were read.**
- **No Route A classifier was run.**
- **No** psql/auth rerun or recapture occurred.
- **No** credential rotation, custody write, Stage 0, run-lock touch, grants, schema/data
  changes, source-selection changes, remediation, downstream runtime, Lane/scoring/AMS/customer
  output, Gate 4E, or Gate 4F occurred.

---

## 3. Script Safety Properties (follows PR #288)

The prepared script:
- takes an **operator-supplied path only at future runtime** (env `RB_RAW_OUTPUT_PATH`);
- treats the path as **data only**;
- performs **stat-only metadata checks**;
- **never prints the path value**;
- **never reads file contents**;
- **never invokes the classifier**;
- **never invokes psql/auth**;
- emits **safe labels only**;
- exhibits **fail-closed** behavior.

### 3.1 Checks performed (metadata only)
- path variable set / unset;
- exists / missing;
- regular file / not a regular file;
- chmod `600`;
- current-user owner;
- nonzero size.

### 3.2 Banned content-read commands are ABSENT (verified)
The script contains **no** content-reading of the retained capture:
- no `cat`;
- no `head`;
- no `tail`;
- no `grep` over the retained capture;
- no `sed` over the retained capture;
- no `awk` over the retained-capture contents;
- no `strings`;
- no checksum over the retained capture;
- no classifier invocation.

(Verified by inspection: it uses only `stat -c '%a'/'%u'/'%s'` and `[ -e ]` / `[ -f ]` on the
path; the `git status --porcelain | grep -v deep-research-report` usage operates on git status
output, **not** on the retained capture.)

---

## 4. Safe Output Labels (the only labels the script prints)

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

---

## 5. Result Mapping

- `present` — **only if** the path is set, exists, is a regular file, chmod `600`, owned by the
  current user, **and** size > 0.
- `missing` — path is unset or the file is absent.
- `invalid_type` — path exists but is **not** a regular file.
- `invalid_permissions` — permissions are not `600` or owner is not the current user.
- `unknown` — unexpected stat/metadata failure.

### 5.1 Deliberate fail-closed treatment of a valid-but-empty file
PR #288 defines no safe `empty` category. The prepared script therefore treats a **valid-but-
empty** retained capture (set + exists + regular file + chmod 600 + current-user owner, but
**size == 0**) as **`unknown`** rather than `present` — i.e. it **fails closed** (Route A must
not run on an empty capture). **Codex should verify this is acceptable, or request a patch** to
add a distinct category if a more specific label is preferred.

---

## 6. Future Operator Transfer / Verification (NOT authorization)

This procedure is **future operator-only** and does **not** authorize a run:
1. Transfer the raw file (bytes; not via this doc):
   `rsync -av --checksum --chmod=F600 /tmp/buyerrecon-stage0-route-a-retained-capture-presence-check.sh OP_USER@PROD_HOST:/tmp/buyerrecon-stage0-route-a-retained-capture-presence-check.sh`
2. On the production host, verify before any run:
   - `sha256_match=true` against
     `57c6a9887fc759e5cd2398f01fe3467d26380ceb1284881aac9f9ea67610dcc4`;
   - `syntax_check=pass` (`bash -n`).

---

## 7. Future Execution Prerequisites

- a **fresh explicit Helen GO** is required;
- `sha256_match=true` required;
- `syntax_check=pass` required;
- `RB_RAW_OUTPUT_PATH` must be set to the candidate retained-capture path;
- the presence check must remain **stat-only** and must **not** read or print contents/path.

---

## 8. Route Decision After Presence Evidence

- If **`presence_check_result=present`** → only a **separate future Helen GO** may authorize
  **one** Route A classifier execution.
- If **`presence_check_result=missing`** / `invalid_permissions` / `invalid_type` / `unknown`
  → **Route A must not run**, and the next path must be **re-planned** via either a **separately
  GO-gated raw-withheld recapture** or **Route C** role/connection-policy diagnostics.

---

## 9. Non-Authorization

This PR authorizes no presence-check execution, Route A classifier execution, raw-output
inspection, psql/auth rerun, recapture, credential rotation, RB-ROTATE retry, custody write,
Step 2E, Stage 0, run-lock touch, grants, schema/data changes, source-selection change,
Option B code change, remediation, downstream runtime, Lane/scoring/AMS/customer output,
Gate 4E, or Gate 4F. **Stage 0 execution remains separately GO-gated; `live_auth_proven`
remains false.**

---

## 10. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
host value, port value, real URI, SSH banner, login source, host/network detail, **candidate
path value**, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL, **raw
psql output, raw PostgreSQL error text**, Node stack trace, or customer data. This is
operator-prep documentation only: it records the prepared presence-check script's path and
**SHA-256**, its syntax status, its PR #288-aligned stat-only safety properties (operator-
supplied path treated as data only, metadata-only checks, no path-value print, no content read,
no classifier/psql invocation, safe-labels-only, fail-closed), its result mapping (including the
deliberate fail-closed `unknown` for a valid-but-empty capture), and a **future** operator
transfer/verification procedure — **no presence check ran**, **no retained capture was
touched**, **no path value was printed**, and **no** DSN/secret/connection value is recorded.
The env-var name `RB_RAW_OUTPUT_PATH`, the recorded SHA-256s, the allowlisted result tokens,
the role name `buyerrecon_stage0_runner`, and the database name `buyerrecon_production` are
non-secret identifiers; the recorded SHA-256 / commit hashes are public. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit & script hashes — not secret or row values.
