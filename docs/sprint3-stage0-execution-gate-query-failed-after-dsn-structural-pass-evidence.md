# Sprint 3 — Stage 0 Execution — Blocked at Pre-Run Gate Query (after DSN Structural PASS) — Evidence

**Status:** `STAGE0_EXECUTION_BLOCKED_GATE_QUERY_FAILED_AFTER_DSN_STRUCTURAL_PASS`

This is a **docs-only evidence record**. Helen issued the explicit Stage 0
execution GO after the PR #196 DSN structural preflight PASS. The operator ran
the PR #189-style execution flow with **server-side hidden DSN assembly**; the
**DSN structural checks passed**, but the **pre-run `psql` DB/role/writable gate
query failed** — **before run-lock and before Stage 0**. **Raw gate output was
intentionally withheld.**

**This is not a Stage 0 runtime failure.** Stage 0 did not run; the run-lock was
not touched. This PR changes no roles/grants, runs no SQL, and records safe
**booleans only** — no secrets, DSN, host, port, password, or raw data.

> Provenance: PR #196 DSN structural preflight PASS
> (`c3a0cc151d66cb20e41135e10acc3def23fe0808`,
> `STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_PASS`); PR #191 DSN structural-check
> plan (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #189 Stage 0 execution GO
> command pack (`a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0`); PR #190 first
> gate-query-failed evidence (`5d8c667fdee9b5bf2e40fce6f652273e5f8d5287`).

---

## 1. Authorization

- Helen issued the explicit **Stage 0 execution GO** (after PR #196) for exactly
  one bounded execution under `buyerrecon_stage0_runner`, using the PR #189-style
  flow with server-side hidden DSN assembly.
- The operator ran the flow manually on the production host. Claude Code did not
  execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_EXECUTION_START
on_production_host=true
repo_head=c3a0cc151d66cb20e41135e10acc3def23fe0808
pr196_merge_present=true
stage0_command_mapping_ok=true
run_lock_preexisting=false
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
gate_raw_output_printed=false
stage0_exec_gate_pass=false
stop_line=stage0_exec_gate_failed_raw_output_withheld
failed_gate_label=gate_query_execution
stage0_command_run=false
run_lock_touched=false
```

---

## 3. Interpretation

The flow advanced **further than before** (the DSN is now structurally valid),
then **failed closed at the pre-run gate query** — **before** run-lock and
**before** Stage 0:
- production host was reached (`on_production_host=true`);
- repo head was `c3a0cc151d66cb20e41135e10acc3def23fe0808`;
- PR #196 merge was present (`pr196_merge_present=true`);
- the exact Stage 0 command-mapping gate **passed**
  (`stage0_command_mapping_ok=true`);
- run-lock did **not** preexist (`run_lock_preexisting=false`);
- approved source material was present (`approved_source_present=true`);
- the **source DSN was not printed** (`source_dsn_printed=false`); the **Stage 0
  DSN was not printed** (`stage0_dsn_printed=false`);
- the **password was received through a hidden prompt and not printed**
  (`password_received=true`, `password_printed=false`);
- the **host and port components were present** (`host_component_present=true`,
  `port_component_present=true`);
- the **full Stage 0 runner DSN was assembled in memory only**
  (`stage0_runner_dsn_loaded=true`);
- the **DSN structural checks passed** — no whitespace, expected scheme,
  parseable, expected user `buyerrecon_stage0_runner`, not collector app,
  expected database `buyerrecon_production`, overall
  `stage0_runner_dsn_structural_check_pass=true`;
- raw `psql` gate output was **not printed** (`gate_raw_output_printed=false`);
- the **pre-run DB/role/writable gate query failed before** the booleans could be
  proven:
  - `stage0_exec_gate_pass=false`;
  - `stop_line=stage0_exec_gate_failed_raw_output_withheld`;
  - `failed_gate_label=gate_query_execution`;
- the Stage 0 command did **not** run (`stage0_command_run=false`);
- the run-lock was **not** touched (`run_lock_touched=false`).

**This is not a Stage 0 runtime failure** — Stage 0 never started. It is a
**pre-run gate-query failure that occurs *after* the DSN is structurally valid**,
caught by the PR #189 fail-closed posture before any write or run-lock touch.

---

## 4. Bounded Cause Statement (not over-claimed)

- The **previous DSN structural issue is resolved** — the assembled DSN passed the
  PR #191 structural checks (`stage0_runner_dsn_structural_check_pass=true`).
- The **new remaining failure is the `psql` gate-query execution itself**
  (`failed_gate_label=gate_query_execution`). The **exact cause is unknown**
  because raw `psql` output was **intentionally withheld**.
- **Possible categories** include auth, connectivity, SSL, `pg_hba`, password
  mismatch, or `psql` connection behaviour — **but do not claim any specific
  cause without evidence.** The only proven fact is that the gate query did not
  execute to produce the expected DB/role/writable booleans.

This is a **distinct, narrower** failure than the PR #190/#192 DSN-input
problems: the input is now structurally correct; the connection/gate-query layer
is what failed.

---

## 5. What Did Not Happen

- No run-lock touch.
- No Stage 0 command execution; no `npm run stage0:run`; no Stage 0 runtime.
- No Stage 0 parser result; no Stage 0 writes.
- No `psql` raw output printed.
- No source DSN printed; no Stage 0 DSN printed.
- No password / token printed; no host / port printed.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot runtime.
- No Lane A/B preview or writer.
- No scoring runtime; no AMS Trust/Pass runtime.
- No customer output; no Gate 4E; no Gate 4F.
- No DB role / grant / schema / deploy change.
- No raw IDs / raw rows / payload / customer data printed.

---

## 6. Terminal Artifact Note

The terminal transcript included a visible shell/display fragment before the safe
labels. It is treated as a **terminal paste/display artifact**, not evidence of
another command or secret exposure, unless actual raw secret/output is present.
Nothing that could include secret material is quoted or expanded here
(`source_dsn_printed=false`, `stage0_dsn_printed=false`, `password_printed=false`,
`gate_raw_output_printed=false`).

---

## 7. Verdict

- **BLOCKED — stopped at the pre-run gate query (after DSN structural PASS),
  before run-lock and before Stage 0.** No connection booleans were proven; no DB
  change occurred; the one execution was not consumed.
- The dedicated identity `buyerrecon_stage0_runner` and the structurally-valid
  DSN remain as proven; the remaining gap is the **gate-query / connection
  layer**.

---

## 8. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not directly rerun Stage 0.**
3. Prepare a **narrow, secret-safe `psql` gate diagnostic / classifier plan** that
   can distinguish **broad failure classes** (e.g. connectivity vs auth vs
   SSL/`pg_hba`) **without printing raw `psql` output or secrets** — remaining
   **before** run-lock and **before** Stage 0, emitting **only safe labels**.
4. Any future Stage 0 retry remains **separately GO-gated** and must preserve the
   **PR #189** boundaries: exact mapping gate; DSN structural check;
   DB/role/writable gate; run-lock only **after** gates pass; one execution only;
   runtime output captured (chmod-600 temp); raw output withheld; docs-only
   evidence PR afterward.
5. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. The full DSN was
assembled **in memory only** and **never printed** (`stage0_dsn_printed=false`);
the password was received hidden and never printed (`password_printed=false`); the
source DSN, host, and port were never printed; raw `psql` gate output was
**withheld** (`gate_raw_output_printed=false`). All values above are safe labels /
booleans / a public git commit hash / a stop-line token / role / database names —
not secret or row values.
