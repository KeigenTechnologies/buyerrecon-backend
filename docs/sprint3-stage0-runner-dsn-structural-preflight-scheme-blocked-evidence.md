# Sprint 3 — `STAGE0_RUNNER_DSN` Structural Preflight — Blocked on Unexpected Scheme (Evidence)

**Status:** `STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_BLOCKED_UNEXPECTED_SCHEME`

This is a **docs-only evidence record**. Helen issued the explicit
`STAGE0_RUNNER_DSN STRUCTURAL PREFLIGHT GO`, the production checkout was synced to
PR #191, and the secret-safe DSN structural preflight **blocked before `psql`,
run-lock, or Stage 0** because the hidden value did **not** have an expected
PostgreSQL URI scheme.

This is a **DSN structural preflight block — not a Stage 0 execution failure.**
No psql connection ran, the run-lock was not touched, and Stage 0 did not run.
This PR changes no roles/grants, runs no SQL, and records safe labels only — no
secrets, DSN, passwords, or raw data.

> Provenance: PR #191 `STAGE0_RUNNER_DSN` structural-check plan
> (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`,
> `STAGE0_RUNNER_DSN_STRUCTURAL_CHECK_PLANNING_ONLY`); PR #190 pre-run
> gate-query-failed evidence (`5d8c667fdee9b5bf2e40fce6f652273e5f8d5287`).

---

## 1. Authorization

- Helen issued the explicit **`STAGE0_RUNNER_DSN STRUCTURAL PREFLIGHT GO`** for
  exactly one secret-safe DSN structural preflight (PR #191 command pack).
- This did **not** authorize Stage 0 execution or a Stage 0 retry.
- The operator ran the preflight manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_START
on_production_host=true
repo_head=4139b12a14ec89b3d3e82a8e1cc83210916b4f96
pr191_merge_present=true
stage0_runner_dsn_loaded=true
stage0_runner_dsn_printed=false
stage0_runner_dsn_no_whitespace=true
stage0_runner_dsn_scheme_ok=false
stage0_runner_dsn_structural_check_pass=false
stop_line=stage0_runner_dsn_structural_check_failed
failed_dsn_check=dsn_scheme_unexpected
stage0_command_run=false
run_lock_touched=false
STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_BLOCKED
```

---

## 3. Interpretation

The preflight ran and **failed closed at the scheme check** — **before** `psql`,
run-lock, and Stage 0:
- production host was reached (`on_production_host=true`);
- repo head was `4139b12a14ec89b3d3e82a8e1cc83210916b4f96`;
- PR #191 merge was present (`pr191_merge_present=true`);
- hidden `STAGE0_RUNNER_DSN` input was received
  (`stage0_runner_dsn_loaded=true`) and **not printed**
  (`stage0_runner_dsn_printed=false`);
- no whitespace / paste artifact was detected
  (`stage0_runner_dsn_no_whitespace=true`);
- the **expected DSN scheme check failed** (`stage0_runner_dsn_scheme_ok=false`);
- the structural check **failed closed**:
  - `stage0_runner_dsn_structural_check_pass=false`;
  - `stop_line=stage0_runner_dsn_structural_check_failed`;
  - `failed_dsn_check=dsn_scheme_unexpected`;
- the Stage 0 command did **not** run (`stage0_command_run=false`);
- the run-lock was **not** touched (`run_lock_touched=false`).

This is the PR #191 structural check **working as designed** — it caught a
malformed DSN scheme safely, before any connection attempt.

---

## 4. Possible Cause (not over-claimed)

The hidden value **likely was not a full PostgreSQL URI DSN** — it may have been
password-only or otherwise non-URI input. **Do not over-claim:** the only proven
fact is that the value **did not start with `postgres://` or `postgresql://`**
(`stage0_runner_dsn_scheme_ok=false`, `failed_dsn_check=dsn_scheme_unexpected`).
The structural check stopped at the scheme gate before the user/db/connection
checks, so nothing further about the value is known or recorded.

---

## 5. Terminal Artifact Note

The terminal transcript included a visible shell/display fragment before the safe
labels. It is treated as a **terminal paste/display artifact**, not evidence of
another command or secret exposure, unless actual raw secret/output is present.
Nothing that could include secret material is quoted or expanded here
(`stage0_runner_dsn_printed=false`).

---

## 6. What Did Not Happen

- No `psql` connection / classifier ran; no raw `psql` output existed or printed.
- No run-lock touch (`run_lock_touched=false`).
- No Stage 0 command execution; no `npm run stage0:run`; no Stage 0 runtime.
- No Stage 0 parser result; no Stage 0 writes.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot runtime.
- No Lane A/B preview or writer.
- No scoring runtime; no AMS Trust/Pass runtime.
- No customer output; no Gate 4E; no Gate 4F.
- No DB role / grant / schema / deploy change.
- No DSN / password / token printed.
- No raw IDs / raw rows / payload / customer data printed.

---

## 7. Verdict

- **BLOCKED — stopped at the DSN structural scheme check, before psql, run-lock,
  and Stage 0.** No connection was attempted; no DB change occurred.
- The dedicated identity `buyerrecon_stage0_runner` remains as proven by PR #188;
  this preflight simply rejected a DSN value with an unexpected scheme.

---

## 8. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not rerun Stage 0.**
3. Before another DSN preflight, create or use a **safe full-DSN construction /
   custody step** — the value must be a **full PostgreSQL URI**, structurally of
   the form:
   `postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
   **Do not paste the real DSN into chat, logs, or repo.**
4. A future retry must still be **separately GO-gated** and must preserve the
   **PR #191 boundaries**: secret-safe hidden DSN; no DSN/password/token
   printing; structural check before `psql`; optional classifier raw output
   withheld; no run-lock; no Stage 0; docs-only evidence PR afterward.
5. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The hidden DSN was loaded
but **never printed** (`stage0_runner_dsn_printed=false`). The
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
line is a **structural placeholder template** — `<PASSWORD>` / `<HOST>` /
`<PORT>` are literal placeholders, **not** values. All other values are **safe
labels / booleans / a public git commit hash / a stop-line token / role /
database names** — not secret or row values.
