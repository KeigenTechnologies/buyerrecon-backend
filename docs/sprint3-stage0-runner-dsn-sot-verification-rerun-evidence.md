# Sprint 3 — Stage 0 — Runner DSN Source-of-Truth Verification Re-Run — Evidence (PASS: verified-active candidate)

**Status:** `STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_VERIFICATION_VERIFIED_ACTIVE_CANDIDATE`

This is a **docs-only evidence record**. After PR #279 recorded concrete PR #195 host/port
provenance into the registry, the operator **re-ran** the PR #277 secret-safe Stage 0 runner
DSN source-of-truth verification script on production. The run was **verification only**
(read-only, registry-provenance based) and **passed**: with host/port source provenance now
present, the **complete Stage 0 runner DSN shape is derivable locally from approved sources
without operator guessing** — `verification_result=verified_active_candidate`, `stop_line=none`.
**No mutation occurred.**

**This is a safe, read-only verification PASS — it does NOT activate any registry entry, does
NOT prove the actual DSN value, and does NOT authorize RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, or Stage 0.** This PR records safe
**booleans/category tokens / public commit hashes only** — no raw DSN, host, port, username,
password, database URL, `.env.production` value, connection string, custody contents, psql
output, or typed value.

> Provenance: PR #279 host/port provenance amendment
> (`c96bbc7b51a0284ca2c23059de4ccf36f752a8e6`,
> `PRODUCTION_PARAMETER_REGISTRY_HOST_PORT_PROVENANCE_AMENDMENT_ONLY`); PR #278 prior
> verification blocked-missing-dependency (`1cdb512568d89984e48dfac09cbd09e0b834386d`); PR #277
> verification command-pack plan (`4dd1f0f08b1891ada117c285f25051eee12cd3d2`); PR #276
> registry-amendment plan (`b85234cd62f1358ad3ec5eeea7662a384791c746`); PR #275 canonical
> registry (`385b068db4a07a8738f64bed7361b8ff8a0c4ab7`); PR #195 host/port custody PASS
> (`4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036`).

---

## 1. Authorization & Pre-Run Verification

- GO: `HELEN STAGE0 RUNNER DSN SOURCE-OF-TRUTH VERIFICATION RE-RUN GO` — exactly one
  secret-safe re-run of the PR #277 verification script.
- The script (`/tmp/buyerrecon-stage0-runner-dsn-sot-verify.sh`, expected SHA-256
  `efa2ca4e60186aef7f12af7b07fc36f6ea19682f4b16270662943bc6dacce3d0`) was verified before
  running (`sha256_match=true`, `syntax_check=pass`) and its Phase 0 fast-forwarded to the
  current base tip `c96bbc7b51a0284ca2c23059de4ccf36f752a8e6` (which contains the PR #279
  host/port provenance amendment).
- The run is **read-only verification only** — it inspects registry provenance and emits safe
  labels; it performs **no** mutation, **no** psql/auth, and reads **no** `.env.production` or
  custody value.
- The operator ran the action manually on the production host. Claude Code did not execute
  anything.

---

## 2. Safe Labels (from the actual verification re-run)

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
database_host_source_present=true
database_port_source_present=true
database_name_source_present=true
credential_source_present=true
dsn_shape_contract_complete=true
approved_source_conflicts_detected=false
broken_custody_used_as_source=false
complete_stage0_runner_dsn_shape_derivable=true
operator_guess_required=false
raw_values_printed=false
verification_result=verified_active_candidate
stop_line=none
verification_completed=true
```

---

## 3. Interpretation (bounded)

### 3.1 Registry gate baseline (passed)
The Production Parameter Registry document and machine-readable block are present
(`parameter_registry_doc_present=true`, `parameter_registry_block_present=true`); HEAD
contains the PR #275 / #276 / #277 merges. The Stage 0 DSN dependency was read as **blocked
before verification** (`stage0_dsn_dependency_blocked_before_verification=true`) — as expected
— and the run did **not** change it.

### 3.2 All source-of-truth components now present
With the PR #279 amendment in HEAD, every required component now has a present, non-`TBD`
source: **runner role, custody file, custody key, database scheme, database host, database
port, database name, credential source**, and a **complete DSN shape contract**
(`dsn_shape_contract_complete=true`). The previously-missing dependency (host/port) is now
`database_host_source_present=true` / `database_port_source_present=true`.

### 3.3 Complete DSN shape derivable without guessing
- `complete_stage0_runner_dsn_shape_derivable=true` and `operator_guess_required=false`: the
  full `STAGE0_RUNNER_DSN` is **derivable locally from approved sources** with **no operator
  guessing**.
- `approved_source_conflicts_detected=false`; the **known-broken custody was not used as a
  source** (`broken_custody_used_as_source=false`); **no raw values were printed**
  (`raw_values_printed=false`).

### 3.4 PASS outcome
- `verification_result=verified_active_candidate`, `stop_line=none`,
  `verification_completed=true`.

### 3.5 Bounded conclusion
- The verification ran safely and read-only; the registry gate baseline passed and **all**
  source-of-truth components are now present.
- The complete runner DSN shape is derivable from approved sources without guessing — a
  **verified-active candidate**.
- This **does not** activate any registry entry, **does not** prove the actual DSN value, and
  **does not** authorize any rotation/custody/psql/Stage 0 action.
- It **supports** a future docs-only **registry activation amendment** moving the required
  Stage 0 runner DSN dependencies from blocked to verified active.

---

## 4. What Did Not Happen

- No registry activation (this PR records evidence only).
- No RB-ROTATE retry; no credential rotation; no custody write/overwrite.
- No psql/auth rerun; no Option A preflight rerun.
- No Step 2E; no Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No grants; no schema/data changes.
- No source-selection change; no Option B code change.
- No remediation; no downstream runtime / Lane / scoring / AMS / customer output; no Gate 4E;
  no Gate 4F.
- No raw DSN, host, port, username, password, database URL, `.env.production` value, raw
  connection string, raw custody contents, psql raw output, customer/payload data, or typed
  value printed.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network detail
  recorded.

---

## 5. Verdict

- **PASS (verified-active candidate) — Stage 0 runner DSN source-of-truth verification re-run
  is `verification_result=verified_active_candidate`, `stop_line=none`**: after the PR #279
  host/port provenance amendment, all source-of-truth components are present, the complete
  runner DSN shape is derivable from approved sources without operator guessing, broken custody
  was not used, and no raw values were printed.
- This is **not** a registry activation, **not** a proof of the actual DSN value, **not**
  authorization for any rotation/custody/psql/Stage 0 action, and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run RB-ROTATE, rotate the credential, write/overwrite custody, rerun psql/auth,
   run an Option A preflight, run Step 2E, run Stage 0, touch the run-lock, or perform
   remediation off this evidence.
3. After this evidence PR is reviewed/merged, create a **docs-only registry activation
   amendment** updating `docs/production-parameter-registry.md` so the required Stage 0 runner
   DSN dependencies become **verified active** (consistent with this PASS), with concrete
   provenance and no `TBD` / broken-custody dependency.
4. **Only after** that activation amendment is reviewed/merged may a **PR #270-aligned
   RB-ROTATE retry** be GO-gated.
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
determined, **as booleans only**, that the complete `STAGE0_RUNNER_DSN` shape is **derivable
locally from approved sources without operator guessing** — it did **not** read
`.env.production`, did **not** read the known-broken custody value, did **not** run psql, and
**did not print** any DSN/host/port/username/password/URL/connection-string/custody-content/
typed value (`raw_values_printed=false`). The host/port **values** remain in approved custody;
the registry holds category/provenance only. The DSN shape
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
referenced from the registry uses literal placeholders, not values. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit hashes — not secret or row values.
