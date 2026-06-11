# Sprint 3 — Safe Full `STAGE0_RUNNER_DSN` Construction / Custody — Plan (Review-Only)

**Status:** `STAGE0_RUNNER_DSN_CUSTODY_CONSTRUCTION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **safe way for
the operator to construct and supply** the full `STAGE0_RUNNER_DSN` PostgreSQL
URI for `buyerrecon_stage0_runner`, **before retrying the PR #191 structural
preflight** — after the previous preflight failed safely on an unexpected scheme
(PR #192).

This PR **executes nothing**: no production command, no SQL, no `psql`, no
Stage 0, no run-lock touch, no `.env.production` / secret change, no DB
role/grant/schema/deploy change, no downstream runtime. **No real DSN, host,
password, port, or token value appears in this document.**

> Provenance: PR #188 dedicated role proof PASS
> (`57d8732fd248bae34a3b7a239953a445ae9617d6`); PR #189 Stage 0 execution GO
> command pack (`a1aa41a49653c7e36fbfe9760d73ad5feff4c4f0`); PR #191 DSN
> structural-check plan (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #192
> unexpected-scheme blocked evidence
> (`182558f80b3de0b397b390b3850312654389ae57`,
> `STAGE0_RUNNER_DSN_STRUCTURAL_PREFLIGHT_BLOCKED_UNEXPECTED_SCHEME`).

---

## 1. Context / Carry-Forward

The previous DSN structural preflight (PR #192) failed safely with:

```text
stage0_runner_dsn_loaded=true
stage0_runner_dsn_printed=false
stage0_runner_dsn_no_whitespace=true
stage0_runner_dsn_scheme_ok=false
stage0_runner_dsn_structural_check_pass=false
stop_line=stage0_runner_dsn_structural_check_failed
failed_dsn_check=dsn_scheme_unexpected
stage0_command_run=false
run_lock_touched=false
```

The **only proven fact** is that the hidden value **did not start with
`postgres://` or `postgresql://`**. The **likely** operator issue is that a
**password-only or otherwise non-URI value** was supplied — but this is a
hypothesis, **not over-claimed**. The fix is a safe way to construct and supply
the **full** URI.

**Required future DSN — structural template (placeholders only):**

`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`

`<PASSWORD>` / `<HOST>` / `<PORT>` are **literal placeholders** — never real
values, never printed, never committed.

---

## 2. Planning-Only Boundary

This PR does **not**: run production commands; run SQL; run `psql`; run Stage 0;
touch run-lock; modify `.env.production`; modify secrets; change DB
roles/grants/schema/deploy; or run extractor / risk / POI / evidence snapshot /
Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F runtime. It only
records a reviewed construction/custody method.

---

## 3. Safe DSN Construction Options

The operator constructs the full URI **without printing it**. Prefer one:

### Option A — local password-manager construction (recommended, simplest)
- The operator assembles the full PostgreSQL URI **inside a password manager /
  secure note** (offline of the terminal).
- During the next preflight, the value is **copied once** and pasted into the
  **hidden** prompt only.
- The DSN is **never** pasted into chat / logs / repo / terminal echo. The
  password-manager entry stays in the operator's custody.

### Option B — server-side hidden assembly (no value printed)
- The operator enters **only the secret components** (password; and host/port if
  not already in approved custody) through **hidden prompts** (`read -r -s`).
- The shell **assembles `STAGE0_RUNNER_DSN` in memory** from the fixed parts
  (`postgresql://` + `buyerrecon_stage0_runner` + secret password + custody
  host/port + `buyerrecon_production`).
- The shell prints **only structural booleans** (e.g. `dsn_assembled=true`),
  **never** any value or component.
- `STAGE0_RUNNER_DSN` (and any component vars) are **`unset` on every path**.

### Option C — root-only temp-file custody (only if needed; more complex)
- Use **only** if A/B are not workable. The temp file **must** be `chmod 600`,
  created with `umask 077`.
- It **must** be deleted by a `trap` on **every** path (EXIT/INT/TERM).
- Its contents **must never** be printed (`cat`/`tee`/echo forbidden).
- Treated as the **last resort** due to higher exposure surface.

In all options: the value is supplied to the PR #191 preflight via a **hidden**
input, and the preflight's structural check validates it (scheme / parseable /
user / not-collector / db / no-whitespace) before any `psql`.

---

## 4. Required DSN Components

The full DSN must include **exactly**:
- **scheme:** `postgresql://` (or `postgres://`);
- **user:** `buyerrecon_stage0_runner`;
- **password:** the password created for `buyerrecon_stage0_runner` during the
  dedicated-role create/grant/proof (PR #188) — held in operator custody, never
  printed/committed;
- **host:** taken from **approved production DB custody**, **not guessed**;
- **port:** taken from **approved production DB custody**, **not guessed**;
- **database:** `buyerrecon_production`.

The plan does **not** print or guess the real host / port / password. If the
host/port are not in approved custody, that is a **stop-line** — do not improvise.

---

## 5. Guardrails (forbidden)

The construction must **forbid**:
- using **only the password** as `STAGE0_RUNNER_DSN` (the PR #192 failure mode);
- using the `.env.production` collector-app DSN;
- using `buyerrecon_prod_collector_app`;
- using `buyerrecon_app`;
- using a **superuser / admin / `postgres`** DSN;
- pasting the DSN into chat / logs / repo;
- echoing / printing the DSN or any component;
- storing the DSN in committed files;
- weakening any **PR #191** (structural check) or **PR #189** (execution gate)
  boundary.

The PR #191 structural check independently enforces several of these
(`user_expected == buyerrecon_stage0_runner`, `not_collector_app`,
`db_expected == buyerrecon_production`, scheme/whitespace) — this plan ensures the
**input** is constructed correctly so those checks pass legitimately, not by
weakening them.

---

## 6. Future Preflight Sequence

1. **Codex review and merge** of this custody/construction plan (before any
   retry).
2. **Helen issues a fresh explicit GO** for **exactly one** DSN structural
   preflight retry.
3. Production checkout **syncs to the latest merge**.
4. Operator **supplies the full DSN secret-safely** (Option A/B/C above; never
   printed/committed).
5. Run **only** the **PR #191** structural preflight (+ optional classifier, raw
   output withheld).
6. **Record safe labels** in a **docs-only evidence PR**.
7. **Only if the DSN preflight is clean** should a **separate Stage 0 execution
   GO** be considered — and that still requires the full **PR #189** gated flow
   and its own evidence PR.
8. **Stage 0 execution remains separately GO-gated.**

---

## 7. Non-Authorizations

This PR does **not** authorize:
- DSN construction execution; preflight run; Stage 0 execution/retry; run-lock
  touch;
- production command; SQL; `psql`;
- secret / `.env.production` change; DB role / grant / schema / deploy change;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 8. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. The
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
line is a **structural placeholder template** — `<PASSWORD>` / `<HOST>` /
`<PORT>` are literal placeholders, **not** values. `postgres://` / `postgresql://`
appear only as scheme tokens; `buyerrecon_stage0_runner` /
`buyerrecon_prod_collector_app` / `buyerrecon_app` / `buyerrecon_production` are
role / database names. All other values are safe labels / public git commit
hashes / boundary language — not secret or row values.
