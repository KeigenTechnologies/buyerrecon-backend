# Sprint 3 — Stage 0 — Runner DSN Source-of-Truth Verification — Evidence (BLOCKED: missing host/port provenance)

**Status:** `STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_VERIFICATION_BLOCKED_MISSING_DEPENDENCY`

This is a **docs-only evidence record**. Per the merged PR #277 plan, the operator transferred
the SHA-verified secret-safe verification script
`/tmp/buyerrecon-stage0-runner-dsn-sot-verify.sh` (raw file transfer) and ran it after
pre-run verification passed (`sha256_match=true`, `syntax_check=pass`). The script performed
**source-of-truth verification only** (read-only, registry-provenance based) and **failed
closed**: the complete Stage 0 runner DSN shape is **not yet derivable** because the database
**host/port source provenance is not present** (recorded as `source_commit=TBD`). **No
mutation occurred.**

**This is a safe, read-only verification record — it does NOT activate any registry entry,
does NOT prove the correct DSN, and does NOT authorize RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, or Stage 0.** This PR records safe
**booleans/category tokens / public commit hashes only** — no raw DSN, host, port, username,
password, database URL, `.env.production` value, connection string, custody contents, psql
output, or typed value.

> Pre-run integrity: `expected_sha256=efa2ca4e60186aef7f12af7b07fc36f6ea19682f4b16270662943bc6dacce3d0`,
> `actual_sha256=efa2ca4e60186aef7f12af7b07fc36f6ea19682f4b16270662943bc6dacce3d0`,
> `sha256_match=true`, `syntax_check=pass`.

> Provenance: PR #277 verification command-pack plan
> (`4dd1f0f08b1891ada117c285f25051eee12cd3d2`,
> `STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_VERIFICATION_COMMAND_PACK_PLANNING_ONLY`); PR #276
> registry-amendment plan (`b85234cd62f1358ad3ec5eeea7662a384791c746`); PR #275 canonical
> registry (`385b068db4a07a8738f64bed7361b8ff8a0c4ab7`); PR #274 custody-incomplete diagnostic
> (`b63f2b7b454609a36b1fe9f1c882ce562cee369d`); PR #195 host/port custody presence (host/port
> values never printed; exact merge commit not yet recorded in the registry).

---

## 1. Authorization & Pre-Run Verification

- GO: a fresh explicit Helen GO for **one** secret-safe Stage 0 runner DSN source-of-truth
  verification run per the merged PR #277 plan.
- The script was transferred by **raw file transfer** and verified before running:
  `sha256_match=true` (against `efa2ca4e…`), `syntax_check=pass`.
- The run is **read-only verification only** — it inspects registry provenance and emits safe
  labels; it performs **no** mutation, **no** psql/auth, and reads **no** `.env.production` or
  custody value.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual verification run)

```text
parameter_registry_doc_present=true
parameter_registry_block_present=true
head_contains_pr275_merge=true
head_contains_pr276_merge=true
head_contains_pr277_merge=true
stage0_dsn_dependency_blocked_before_verification=true
stage0_runner_role_source_present=true
stage0_runner_custody_file_source_present=true
stage0_runner_custody_key_source_present=true
database_scheme_source_present=true
database_host_source_present=false
database_port_source_present=false
database_name_source_present=true
credential_source_present=true
dsn_shape_contract_complete=true
approved_source_conflicts_detected=false
broken_custody_used_as_source=false
complete_stage0_runner_dsn_shape_derivable=false
operator_guess_required=true
raw_values_printed=false
verification_result=blocked_missing_dependency
stop_line=source_commit_tbd
verification_completed=true
```

---

## 3. Interpretation (bounded)

### 3.1 Registry gate baseline (passed)
The Production Parameter Registry is **present and parseable**
(`parameter_registry_doc_present=true`, `parameter_registry_block_present=true`); HEAD
contains the **PR #275 / #276 / #277** merges (`head_contains_pr275_merge=true`,
`head_contains_pr276_merge=true`, `head_contains_pr277_merge=true`); the Stage 0 runner DSN
dependency was read as **blocked before verification**
(`stage0_dsn_dependency_blocked_before_verification=true`) and the run did **not** change it.

### 3.2 Present source-of-truth components
Present with concrete (non-`TBD`) provenance: the **Stage 0 runner role**, **custody file
path**, **custody key**, **database scheme**, **database name**, **credential source**, and a
**complete DSN shape contract** (`dsn_shape_contract_complete=true`). No approved-source
conflicts (`approved_source_conflicts_detected=false`); the **known-broken custody was not
used as a source** (`broken_custody_used_as_source=false`); **no raw values were printed**
(`raw_values_printed=false`).

### 3.3 The missing dependency (host/port provenance)
- **`database_host_source_present=false`** and **`database_port_source_present=false`**: the
  registry's host/port category entries carry `source_commit=TBD` (PR #195's exact
  provenance is not yet recorded), so their source is **not registry-verifiable**.
- Consequently the **complete Stage 0 runner DSN shape is not derivable**
  (`complete_stage0_runner_dsn_shape_derivable=false`), and deriving host/port would require
  **operator guessing** (`operator_guess_required=true`) — which is forbidden.

### 3.4 Correct fail-closed outcome
- The verification **correctly failed closed**: `verification_result=blocked_missing_dependency`,
  `stop_line=source_commit_tbd`, `verification_completed=true`.
- **RB-ROTATE remains blocked** until the database host/port source provenance is registered
  with concrete non-`TBD` source commits and the required Stage 0 DSN dependency becomes
  **verified active**.

### 3.5 Bounded conclusion
- The verification ran safely and read-only; the registry gate baseline passed.
- Most source-of-truth components are present; the **only** missing dependency is **host/port
  source provenance** (`source_commit=TBD`).
- It does **not** activate any registry entry, **not** prove the correct DSN, and **not**
  authorize any rotation/custody/psql/Stage 0 action.

---

## 4. What Did Not Happen

- No RB-ROTATE retry; no credential rotation; no custody write/overwrite.
- No psql/auth rerun; no Option A preflight rerun.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes.
- No source-selection change; no Option B code change.
- No remediation; no downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No registry entry activated or otherwise mutated.
- No raw DSN, host, port, username, password, database URL, `.env.production` value, raw
  connection string, raw custody contents, psql raw output, customer/payload data, or typed
  value printed.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 5. Verdict

- **BLOCKED (safe; missing dependency) — Stage 0 runner DSN source-of-truth verification is
  `verification_result=blocked_missing_dependency`, `stop_line=source_commit_tbd`**: the
  registry gate baseline passed and most components are present, but the database **host/port
  source provenance is not present** (`source_commit=TBD`), so the complete DSN shape is not
  derivable without operator guessing, and the run correctly failed closed.
- This is **not** a registry activation, **not** a proof of the correct DSN, **not**
  authorization for any rotation/custody/psql/Stage 0 action, and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** activate registry entries off this evidence, run RB-ROTATE, rotate the
   credential, write/overwrite custody, rerun psql/auth, run an Option A preflight, run
   Step 2E, run Stage 0, touch the run-lock, or perform remediation.
3. After this evidence PR is reviewed/merged, create a **registry amendment / source-provenance
   PR** to resolve the **database host/port source provenance** — likely by recording the
   exact **PR #195** merge/source evidence **if it is the approved source** — updating
   `docs/production-parameter-registry.md` so `prod.database.host.category` /
   `prod.database.port.category` carry **concrete non-`TBD` `source_commit`** values, **without
   printing raw host/port values**. Re-run the verification afterward.
4. Only once verification reports
   `complete_stage0_runner_dsn_shape_derivable=true` / `operator_guess_required=false` /
   `verification_result=verified_active_candidate` may a new PR #270-aligned RB-ROTATE retry be
   GO-gated.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
**host value, port value**, real URI, SSH banner, login source, host/network detail, raw
payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw PostgreSQL
error text, Node stack trace, or customer data. The verification ran **read-only** over
registry provenance: it confirmed the registry gate baseline and component-source presence and
determined, **as booleans only**, that the complete `STAGE0_RUNNER_DSN` shape is **not yet
derivable** because host/port source provenance is `TBD` — it did **not** read
`.env.production`, did **not** read the known-broken custody value, did **not** run psql, and
**did not print** any DSN/host/port/username/password/URL/connection-string/custody-content/
typed value (`raw_values_printed=false`). The DSN shape
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
referenced from the registry uses literal placeholders, not values. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit hashes — not secret or row values.
