# Sprint 3 — `STAGE0_RUNNER_DSN` Host/Port Custody Step — Evidence (PASS)

**Status:** `STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_PASS`

This is a **docs-only evidence record**. Helen issued the explicit
`STAGE0_RUNNER_DSN HOST/PORT CUSTODY GO`, the production checkout was synced to
PR #194, and the host/port custody step **confirmed that approved source material
contains the host and port components** needed to construct the full
`STAGE0_RUNNER_DSN` — **without printing host, port, source DSN, Stage 0 DSN,
password, or token**.

**This is a host/port custody PASS — NOT a DSN structural preflight PASS, and NOT
a Stage 0 execution.** This PR changes no roles/grants, runs no SQL, and records
safe **booleans only** — no secrets, DSN, host, port, passwords, or raw data.

> Provenance: PR #191 DSN structural-check plan
> (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #193 DSN custody/construction
> plan (`18575a53043363aa6825903b10b4d5ffb5a480f1`); PR #194 host/port custody
> plan (`4f84942d8e745ac3e4dcf4f6941503785dfccf44`,
> `STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_PLANNING_ONLY`).

---

## 1. Authorization

- Helen issued the explicit **`STAGE0_RUNNER_DSN HOST/PORT CUSTODY GO`** for
  exactly one host/port custody step (PR #194 plan).
- This did **not** authorize DSN construction, a DSN structural preflight, or
  Stage 0 execution.
- The operator ran the step manually on the production host. Claude Code did not
  execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_START
on_production_host=true
repo_head=4f84942d8e745ac3e4dcf4f6941503785dfccf44
pr194_merge_present=true
approved_source_present=true
source_dsn_printed=false
stage0_dsn_printed=false
host_component_present=true
port_component_present=true
host_port_custody_check_pass=true
stage0_command_run=false
run_lock_touched=false
STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_DONE
```

---

## 3. Interpretation — PASS (host/port custody only)

The custody step ran and **passed**, emitting **booleans only**:
- production host was reached (`on_production_host=true`);
- repo head was `4f84942d8e745ac3e4dcf4f6941503785dfccf44`;
- PR #194 merge was present (`pr194_merge_present=true`);
- approved source material was present (`approved_source_present=true`);
- the **source DSN was not printed** (`source_dsn_printed=false`);
- the **Stage 0 DSN was not printed** (`stage0_dsn_printed=false`);
- the **host component was present** (`host_component_present=true`);
- the **port component was present** (`port_component_present=true`);
- the **host/port custody check passed** (`host_port_custody_check_pass=true`);
- the Stage 0 command did **not** run (`stage0_command_run=false`);
- the run-lock was **not** touched (`run_lock_touched=false`).

**This is a host/port custody PASS only** — it confirms the approved source
contains the host/port components. It is **not** a DSN structural preflight PASS
(PR #191), **not** a full-DSN assembly, and **not** a Stage 0 execution or
authorization.

---

## 4. Important Boundary

The step used existing production environment material **only as an approved
custody source for the host/port components**. It **did not**:
- use the collector-app DSN as `STAGE0_RUNNER_DSN`;
- construct or print the Stage 0 DSN;
- authorize Stage 0 execution.

Only presence booleans were derived; **no host, port, source DSN, or Stage 0 DSN
value was printed**.

---

## 5. Terminal Artifact Note

The terminal transcript included a visible shell/display fragment before the safe
labels. It is treated as a **terminal paste/display artifact**, not evidence of
another command or secret exposure, unless actual raw secret/output is present.
Nothing that could include secret material is quoted or expanded here
(`source_dsn_printed=false`, `stage0_dsn_printed=false`).

---

## 6. What Did Not Happen

- No host value printed; no port value printed.
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

## 7. Verdict

- **PASS — host/port custody confirmed (booleans only).** The approved source
  contains the host and port components needed to construct the full
  `STAGE0_RUNNER_DSN`; no values were printed; no Stage 0 ran; no run-lock was
  touched.

---

## 8. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. The operator may then **assemble the full `STAGE0_RUNNER_DSN` secret-safely**
   under **PR #193** (password-manager / hidden in-memory assembly). The full URI
   must be structurally:
   `postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
   **Do not paste the real DSN into chat, logs, or repo.**
3. **Helen must issue a separate explicit GO** for **exactly one** PR #191 DSN
   structural preflight retry → docs-only evidence PR.
4. **Only after a clean DSN structural preflight** should a **separate Stage 0
   execution GO** be considered (which still requires the full PR #189 gated flow
   and its own evidence PR).
5. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. The custody step
derived **presence booleans only**; the source DSN and Stage 0 DSN were **never
printed** (`source_dsn_printed=false`, `stage0_dsn_printed=false`), and no host or
port value was emitted. The
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
line is a **structural placeholder template** — `<PASSWORD>` / `<HOST>` /
`<PORT>` are literal placeholders, not values. All other values are safe labels /
booleans / a public git commit hash / role / database names — not secret or row
values.
