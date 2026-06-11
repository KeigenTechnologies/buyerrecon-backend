# Sprint 3 — `STAGE0_RUNNER_DSN` Structural Preflight Retry (Server-Side Hidden Assembly) — Evidence (PASS)

**Status:** `STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_PASS`

This is a **docs-only evidence record**. Helen issued the explicit
`STAGE0_RUNNER_DSN STRUCTURAL PREFLIGHT RETRY GO WITH SERVER-SIDE HIDDEN
ASSEMBLY`, the production checkout was synced to PR #195, and the secret-safe
**server-side hidden assembly + structural preflight passed**. This proves the
full **in-memory** Stage 0 runner DSN structure is valid for the PR #191
structural checks.

**This is a DSN structural preflight PASS only — it is NOT Stage 0 execution and
does NOT authorize Stage 0 execution.** This PR changes no roles/grants, runs no
SQL, and records safe **booleans only** — no secrets, DSN, host, port, password,
or raw data.

> Provenance: PR #191 DSN structural-check plan
> (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #193 DSN custody/construction
> plan (`18575a53043363aa6825903b10b4d5ffb5a480f1`); PR #195 host/port custody
> PASS evidence (`4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036`,
> `STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_PASS`); PR #189 Stage 0 execution GO
> command pack (`a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0`).

---

## 1. Authorization

- Helen issued the explicit
  `STAGE0_RUNNER_DSN STRUCTURAL PREFLIGHT RETRY GO WITH SERVER-SIDE HIDDEN
  ASSEMBLY` for exactly one preflight retry using the PR #191 Option B
  (server-side hidden assembly) path.
- This did **not** authorize Stage 0 execution.
- The operator ran the preflight manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the successful production output)

```text
STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_RETRY_START
on_production_host=true
repo_head=4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036
pr195_merge_present=true
approved_source_present=true
source_dsn_printed=false
stage0_dsn_printed=false
password_received=true
password_printed=false
host_component_present=true
port_component_present=true
stage0_runner_dsn_loaded=true
stage0_runner_dsn_no_whitespace=true
stage0_runner_dsn_scheme_ok=true
stage0_runner_dsn_parseable=true
stage0_runner_dsn_user_expected=true
stage0_runner_dsn_not_collector_app=true
stage0_runner_dsn_db_expected=true
stage0_runner_dsn_structural_check_pass=true
stage0_command_run=false
run_lock_touched=false
STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_RETRY_DONE
```

---

## 3. Interpretation — PASS (DSN structural preflight only)

The preflight ran and **passed**, emitting **booleans only**:
- production host was reached (`on_production_host=true`);
- repo head was `4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036`;
- PR #195 merge was present (`pr195_merge_present=true`);
- approved source material was present (`approved_source_present=true`);
- the **source DSN was not printed** (`source_dsn_printed=false`);
- the **Stage 0 DSN was not printed** (`stage0_dsn_printed=false`);
- the **password was received through a hidden prompt and not printed**
  (`password_received=true`, `password_printed=false`);
- the **host component was present** (`host_component_present=true`);
- the **port component was present** (`port_component_present=true`);
- the **full Stage 0 runner DSN was assembled in memory only**
  (`stage0_runner_dsn_loaded=true`);
- the structural check **passed** —
  - no whitespace (`stage0_runner_dsn_no_whitespace=true`);
  - expected scheme (`stage0_runner_dsn_scheme_ok=true`);
  - parseable (`stage0_runner_dsn_parseable=true`);
  - expected user `buyerrecon_stage0_runner`
    (`stage0_runner_dsn_user_expected=true`);
  - not the collector app (`stage0_runner_dsn_not_collector_app=true`);
  - expected database `buyerrecon_production`
    (`stage0_runner_dsn_db_expected=true`);
  - overall `stage0_runner_dsn_structural_check_pass=true`;
- the Stage 0 command did **not** run (`stage0_command_run=false`);
- the run-lock was **not** touched (`run_lock_touched=false`).

**This is a DSN structural preflight PASS only.** It proves the assembled DSN is
**structurally** valid for the PR #191 checks. It is **not** a DB
connectivity/auth proof, **not** a Stage 0 execution, and **not** Stage 0
authorization.

---

## 4. What Did Not Happen

- No real host printed; no real port printed.
- No source DSN printed; no Stage 0 DSN printed.
- No password / token printed.
- No `psql` connection; no SQL.
- No run-lock touch (`run_lock_touched=false`).
- No Stage 0 command execution; no `npm run stage0:run`; no Stage 0 runtime.
- No Stage 0 parser result; no Stage 0 writes.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot runtime.
- No Lane A/B preview or writer.
- No scoring runtime; no AMS Trust/Pass runtime.
- No customer output; no Gate 4E; no Gate 4F.
- No DB role / grant / schema / deploy change.
- No raw IDs / raw rows / payload / customer data printed.

---

## 5. Accidental Duplicate Fragment Note (harmless post-pass artifact)

After the successful preflight, the operator reconnected and accidentally
pasted/reran a partial duplicate command from `~` rather than
`/opt/buyerrecon-backend`. It **stopped immediately at the wrong-path guard**:

```text
STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_RETRY_START
on_production_host=false
repo_head=
stage0_runner_dsn_structural_check_pass=false
stop_line=wrong_repo_path
```

This is a **harmless post-pass terminal/operator artifact**, recorded **only** to
explain the visible transcript tail:
- it is **not** part of the successful preflight proof above;
- **no** DSN prompt was reached;
- **no** DSN / password / host / port was printed;
- **no** `psql`; **no** run-lock; **no** Stage 0 command; **no** downstream
  runtime.

It must **not** be treated as a second Stage 0 preflight result and must **not**
be over-claimed — the wrong-path guard fired exactly as designed and the fragment
produced no DSN handling at all.

---

## 6. Verdict

- **PASS — DSN structural preflight (server-side hidden assembly).** The full
  in-memory `STAGE0_RUNNER_DSN` is structurally valid for the PR #191 checks; no
  values were printed; no Stage 0 ran; no run-lock was touched. The trailing
  wrong-path fragment is a harmless artifact, not a second result.

---

## 7. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Stage 0 execution is still not automatically authorized.**
3. **Only after this clean DSN structural preflight PASS is merged** may Helen
   issue a **separate explicit Stage 0 execution GO**, following the **PR #189**
   command pack:
   - exact command-mapping gate;
   - DB / role / writable gate;
   - run-lock only **after** gates pass;
   - **one execution only**;
   - runtime output captured to a chmod-600 temp;
   - exact, fail-closed success parser;
   - raw output withheld;
   - docs-only Stage 0 execution evidence PR afterward.
4. **Stage 0 execution remains separately GO-gated.**

---

## 8. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. The full DSN was
assembled **in memory only** and **never printed**
(`stage0_dsn_printed=false`); the password was received hidden and never printed
(`password_printed=false`); the source DSN, host, and port were never printed.
All values above are safe labels / booleans / a public git commit hash / role /
database names — not secret or row values.
