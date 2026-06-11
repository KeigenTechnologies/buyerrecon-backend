# Sprint 3 — Production DB Host/Port Custody Discovery for `STAGE0_RUNNER_DSN` — Plan (Review-Only)

**Status:** `STAGE0_RUNNER_DSN_HOST_PORT_CUSTODY_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. The operator holds the
`buyerrecon_stage0_runner` password (from PR #188) but **does not know the
production DB `<HOST>` / `<PORT>`** needed to construct the full
`STAGE0_RUNNER_DSN`. This plan covers how to **safely obtain or derive `<HOST>`
and `<PORT>` from approved production DB custody** — **without printing or
committing any real host, port, DSN, password, token, or credential value.**

This PR **executes nothing**: no production command, no SQL, no `psql`, no
Stage 0, no run-lock touch, no secret read/print, no `.env.production` / secret
change, no DB role/grant/schema/deploy change, no downstream runtime. **No real
host, port, DSN, password, or token value appears in this document.**

> Provenance: PR #191 DSN structural-check plan
> (`4139b12a14ec89b3d3e82a8e1cc83210916b4f96`); PR #192 unexpected-scheme blocked
> evidence (`182558f80b3de0b397b390b3850312654389ae57`); PR #193 DSN
> custody/construction plan (`18575a53043363aa6825903b10b4d5ffb5a480f1`,
> `STAGE0_RUNNER_DSN_CUSTODY_CONSTRUCTION_PLANNING_ONLY`).

---

## 1. Context

PR #193 established the required full DSN structural template (placeholders
only):

`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`

The operator has `<PASSWORD>` in custody but **lacks `<HOST>` and `<PORT>`**.
This plan provides **safe ways to obtain them from approved custody** so the full
URI can be assembled secret-safely (per PR #193) before the PR #191 structural
preflight retry. `<HOST>` / `<PORT>` are **literal placeholders** here — never
real values.

---

## 2. Planning-Only Boundary

This PR does **not**: run production commands; run SQL; run `psql`; run Stage 0;
touch run-lock; read or print secrets; modify `.env.production`; modify secrets;
change DB roles/grants/schema/deploy; or run extractor / risk / POI / evidence
snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F
runtime. It only records a reviewed host/port custody-discovery method.

---

## 3. Safe Host/Port Custody Options

The operator obtains `<HOST>` / `<PORT>` **without printing them**. Prefer one:

### Option A — approved secret manager / infrastructure custody (recommended)
- The operator retrieves `<HOST>` / `<PORT>` from the **approved production DB
  secret** or **infrastructure dashboard** (the authoritative custody source).
- They are used **only** inside local secure construction (per PR #193 Option A
  password-manager assembly, or Option B in-memory assembly).
- Real values are **not** pasted into chat / logs / repo / terminal echo.

### Option B — derive host/port from an existing approved production DB DSN (no values printed)
- **Only if** an existing DSN is an **approved custody source** (e.g. an approved
  managed secret). **Do not** use the collector-app DSN as the Stage 0 DSN.
- Extract **only** `<HOST>` / `<PORT>` into **hidden / in-memory** variables; the
  source DSN is read hidden and never printed.
- Print **only safe booleans**, e.g.:
  - `host_component_present=true`
  - `port_component_present=true`
  - `source_dsn_printed=false`
  - `stage0_dsn_printed=false`
- **Never** print the raw host / port / DSN / password / token. Unset all
  variables on every path.

> Candidate boolean-only extraction shape — **CANDIDATE ONLY — DO NOT RUN**:
> read the approved source DSN hidden; in a Node heredoc parse `new URL()` and
> emit only `host_component_present` / `port_component_present` (booleans), never
> the values; then unset. This derives presence only — the operator still
> assembles the Stage 0 DSN via PR #193 without echoing components.

### Option C — operator manually constructs the full URI outside repo/logs
- `<HOST>` / `<PORT>` are copied into a **password manager / secure note**.
- The full `STAGE0_RUNNER_DSN` is **assembled there** (PR #193 Option A).
- The full DSN is pasted **only** into the **hidden** PR #191 preflight prompt —
  never into chat / logs / repo.

---

## 4. Guardrails (forbidden)

The host/port discovery must **forbid**:
- **guessing the host**;
- **guessing the port**;
- assuming **`localhost`**;
- assuming **`5432`** unless verified from approved custody;
- using a **password-only** value as `STAGE0_RUNNER_DSN`;
- using the `.env.production` **collector-app DSN** directly as
  `STAGE0_RUNNER_DSN`;
- using `buyerrecon_prod_collector_app`;
- using `buyerrecon_app`;
- using a **superuser / admin / `postgres`** DSN;
- pasting host / port / DSN into chat / logs / repo;
- echoing or printing secrets (host / port / DSN / password / token);
- **weakening any PR #191** (structural check) or **PR #189** (execution gate)
  boundary.

If `<HOST>` / `<PORT>` cannot be obtained from an **approved custody source**,
that is a **stop-line** — do **not** improvise, guess, or default.

---

## 5. Future Sequence

After this plan is **reviewed and merged**:
1. If a host/port custody/derivation **step** is needed, **Helen issues a fresh
   explicit GO** for **one** such step (Option B-style), whose evidence records
   **only safe booleans** (`host_component_present` / `port_component_present` /
   `source_dsn_printed=false` / `stage0_dsn_printed=false`) — **never values** —
   in a docs-only evidence PR.
2. The operator assembles the full `STAGE0_RUNNER_DSN` secret-safely (PR #193).
3. **Helen issues a fresh explicit GO** for **exactly one** PR #191 DSN
   structural preflight retry.
4. Safe-label preflight result recorded in a docs-only evidence PR.
5. **Only after a clean DSN structural preflight** should a **separate Stage 0
   execution GO** be considered (which still requires the full PR #189 gated flow
   and its own evidence PR).
6. **Stage 0 execution remains separately GO-gated.**

---

## 6. Non-Authorizations

This PR does **not** authorize:
- host/port discovery execution; DSN construction; DSN preflight; Stage 0
  execution/retry; run-lock touch;
- production command; SQL; `psql`; secret read/print;
- secret / `.env.production` change; DB role / grant / schema / deploy change;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. `<HOST>` / `<PORT>` /
`<PASSWORD>` are **literal placeholders**, not values. `5432` and `localhost`
appear only as **forbidden-assumption** examples in the guardrails — not as
asserted production values. `postgres://` / `postgresql://` are scheme tokens;
`buyerrecon_stage0_runner` / `buyerrecon_prod_collector_app` / `buyerrecon_app` /
`buyerrecon_production` are role / database names. All other values are safe
labels / booleans / public git commit hashes / boundary language — not secret or
row values.
