# Sprint 3 — Stage 0 Step 2G — `auth_or_credential` Route B Correction Command-Pack Plan (Review-Only)

**Status:** `STAGE0_STEP2G_AUTH_OR_CREDENTIAL_ROUTE_B_CORRECTION_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only command-pack planning record**. After merged PR #263
compared correction Options A/B/C and recommended **Route B** (a separately GO-gated,
secret-safe credential rotation + custody alignment) *only if eliminating ambiguity is
desired*, this plans the **controlled Route B chain** that aligns the PostgreSQL password
for `buyerrecon_stage0_runner`, the custody file `/etc/buyerrecon/stage0-runner.env`, and
the custody key `STAGE0_RUNNER_DSN` — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no rotation / custody write / psql / reset /
remediation**: no credential reset, no password rotation, no custody overwrite, no DSN
read/print/parse, no generated-password print, no `.env.production` read/print, no psql/auth
rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no
source-selection change, no Option B code change, no grant/schema/data change, no
remediation, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password,
generated password, token, host, port, database, username, URI, IP, or service-file content
appears in this document.

> Provenance: PR #263 credential/custody correction plan
> (`2db1b63d854ed3168a05f6b0ada41ecc72ca3364`,
> `STAGE0_STEP2G_AUTH_OR_CREDENTIAL_CUSTODY_CORRECTION_PLANNING_ONLY`); PR #262 revised
> classifier classified `auth_or_credential`
> (`155737d007dcf43c40eb4db43546705562c9424e`); PR #258 Option A binding/auth preflight
> retry — auth failed, raw withheld (`73ffdc162aa870b71e8c08aedc3441efdba367f3`); PR #201
> original broad `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).

---

## 1. Status

`STAGE0_STEP2G_AUTH_OR_CREDENTIAL_ROUTE_B_CORRECTION_COMMAND_PACK_PLANNING_ONLY` — docs-only;
designs the Route B rotation + custody-alignment command pack only; authorizes/executes
nothing.

---

## 2. Evidence Chain (PR #258 → #263)

- **PR #258:** Option A binding/auth preflight reached psql/auth and **failed**; raw output
  withheld.
- **PR #259:** initial category-only classifier plan.
- **PR #260:** first classifier attempt **blocked** — raw-output boundary violated.
- **PR #261:** revised classifier plan (code-from-stdin / data-only invocation + self-test
  gate).
- **PR #262:** revised classifier **safely classified** the failure as **`auth_or_credential`**.
- **PR #263:** credential/custody correction planning compared Options A/B/C and
  **recommended Route B only if eliminating ambiguity is desired** (else Option A may be
  lower-impact if the intended value can be confidently re-supplied).

---

## 3. Route B Objective

Plan a **separately GO-gated, secret-safe correction chain** that **aligns**:

1. the **PostgreSQL password** for `buyerrecon_stage0_runner`;
2. the **custody file** `/etc/buyerrecon/stage0-runner.env`;
3. the **custody key** `STAGE0_RUNNER_DSN`.

The goal is to **eliminate the ambiguity** in the `auth_or_credential` category by setting a
fresh runner credential **and** writing the matching custody DSN in **one controlled,
secret-safe chain** — so that the DB-side password and the custody source of truth are known
to agree, **without ever printing, parsing, or exposing** the value. This does **not** claim
the prior value was wrong, nor identify the exact subcase; it **removes** the ambiguity by
re-establishing a known-aligned pair.

---

## 4. Planned Custody / Credential Alignment Flow — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** execution —
> **not** run here. All steps are illustrative shape only; no command is executed by this PR.

**Phase 0 — environment preflight (no secrets):**
- Confirm expected repo / path / branch / current base tip at `/opt/buyerrecon-backend`
  (current-tip fast-forward if needed so HEAD contains this merged plan).
- Confirm clean working tree.
- Confirm admin/rotation authority is available (e.g. local `sudo -u postgres` path, per the
  established local-postgres admin authority) — **no** DSN, no `.env.production`.

**Phase 1 — generate/input the new runner secret (never printed):**
- Either **generate** a fresh strong password into an **in-memory shell variable only**, or
  accept it via **hidden input** (`read -r -s`) — **never echoed, never written to history,
  never logged**.
- The value lives only in a shell variable / process env for the duration of the chain; it
  is **never** printed, parsed, split, decoded, or persisted to any readable location.

**Phase 2 — scoped PostgreSQL password rotation (runner role only):**
- Apply `ALTER ROLE buyerrecon_stage0_runner WITH PASSWORD <hidden>` for **that role only**,
  via the admin authority, passing the secret **without** placing it in argv or printing it
  (hidden-variable / stdin handling).
- **No** other role altered; **no** grant/schema/table/data change; **no** DML/DDL beyond the
  scoped password rotation.
- Any raw psql output is **withheld** to a chmod-600 temp and **not** printed.

**Phase 3 — custody file write (root-only, chmod 600):**
- Assemble the matching DSN **in memory only** (using the same secret) and write
  `STAGE0_RUNNER_DSN=<assembled, never printed>` to `/etc/buyerrecon/stage0-runner.env`.
- The file must be **root-owned** and **`chmod 600`** after the write.
- The DSN and its components are **never** printed, echoed, parsed, split, or logged; the
  write is verified by **presence/permissions/ownership category checks only**, not by
  reading back the value.

**Phase 4 — safe-label emission:**
- Emit **booleans / category labels only** (see §8) — no value, no component, no raw output.
- Clear the in-memory secret variable; remove any chmod-600 temp.

> Validation that the rotation actually fixed auth is **NOT** part of Route B execution — it
> is a **separate, later, GO-gated Option A binding/auth preflight rerun** (§10).

---

## 5. Secret-Handling Rules (binding on the future Route B execution)

- **Never** print, parse, split, decode, or log `STAGE0_RUNNER_DSN`, the password, or the
  generated password.
- **Never** print DSN components: username, password, host, port, database, URI, IP, or
  service-file content.
- **Never** read or print `.env.production`.
- Generate/input the secret via **hidden input / in-memory variable only**; never place it in
  argv or shell history.
- The custody file `/etc/buyerrecon/stage0-runner.env` must remain **root-owned** and
  **`chmod 600`**.
- Any raw psql/PostgreSQL output is **withheld** (chmod-600 temp, then removed) — never
  printed.
- Evidence must use **safe booleans / category labels only**.

---

## 6. Operator Input Rules

- The new runner secret is supplied **only** by generation-into-memory or **hidden prompt**
  (`read -r -s`); the operator **never** types it where it echoes, and Claude Code **never**
  sees, requests, stores, or records it.
- The operator confirms environment/authority via **safe yes/no answers** only.
- The operator pastes back **only safe labels / category tokens** — never the value, never a
  DSN component, never raw psql output.
- If any operator-input confirmation step fails, **stop** (fail closed) — no rotation, no
  custody write.

---

## 7. Stop-Lines

Abort (safe stop-line + non-zero exit; no value/raw emitted) if any of:
- any secret would be printed;
- any generated password would be printed;
- any DSN component would be printed or parsed;
- any `.env.production` value would be read or printed;
- any role other than `buyerrecon_stage0_runner` would be altered;
- any grant / schema / table / data action would occur;
- any psql/auth rerun would occur **during planning**;
- any Option A preflight rerun would occur **during planning**;
- any Step 2E, Stage 0, run-lock, source-selection change, Option B code change,
  remediation, or downstream runtime would occur;
- the custody file would **not** end up root-owned / chmod 600;
- operator input confirmation fails.

If a stop-line is hit, withhold all secret/raw output, leave credential + custody unchanged
where safe, record the blocked state in a docs-only evidence PR (safe labels only), and take
no fix/retry without separate review/GO.

---

## 8. Safe Labels

```text
route_b_correction_planning_only=true
auth_or_credential_classification_carried_forward=true
exact_credential_subcase_known=false
target_role=buyerrecon_stage0_runner
target_custody_file=/etc/buyerrecon/stage0-runner.env
target_custody_key=STAGE0_RUNNER_DSN
credential_rotation_authorized=false
custody_overwrite_authorized=false
secret_value_print_allowed=false
dsn_component_output_allowed=false
env_production_read_allowed=false
psql_auth_rerun=false
option_a_preflight_rerun=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
remediation_authorized=false
```

> A future Route B execution would additionally emit outcome booleans (e.g.
> `new_secret_generated_or_input=true`, `secret_printed=false`, `password_rotation_applied=…`,
> `only_runner_role_altered=true`, `custody_file_written=…`, `custody_file_root_owned=…`,
> `custody_file_chmod_600=…`, `dsn_component_output=false`, `raw_psql_output_printed=false`,
> `stop_line=…`) — safe tokens only; **no value, no component, no raw text**.

---

## 9. Non-Authorization

**This PR authorizes no:** credential reset; password rotation; custody overwrite; DSN
read/print/parse; generated-password print; `.env.production` read/print; psql/auth rerun;
Option A preflight rerun; Step 2E; Stage 0; run-lock; source-selection change; Option B code
change; grant/schema/data change; remediation; runtime/downstream/Lane/scoring/AMS/customer
action.

**The Route B execution (rotation + custody alignment) is a future, separately-reviewed,
separately GO-gated step** that never prints/stores the value. **Stage 0 execution remains
separately GO-gated.**

---

## 10. Future Gated Sequence

1. **Merge** this docs-only Route B command-pack planning PR (after Codex review).
2. **Codex review.**
3. **Fresh explicit Helen GO** for **one** controlled rotation + custody alignment.
4. On the production host, confirm expected **repo / path / branch / current base** and a
   **clean tree**.
5. **Generate/input** the new runner credential using **hidden input only** (never printed).
6. Apply the **scoped PostgreSQL password rotation** for **`buyerrecon_stage0_runner` only**.
7. **Write/update** `/etc/buyerrecon/stage0-runner.env` with a matching `STAGE0_RUNNER_DSN`
   using **root-only, chmod 600** handling.
8. **Emit safe labels only.**
9. Create a docs-only **correction evidence PR**.
10. After that evidence is reviewed/merged, require a **fresh GO** for an **Option A
    binding/auth preflight rerun** → docs-only evidence PR.
11. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
12. **Stage 0 execution remains separately GO-gated.**

---

## 11. Evidence PR Requirements (for the future Route B execution)

The post-execution evidence PR must:
- be **docs-only**, exactly one new evidence file;
- record **safe booleans / category labels only** (per §8 + outcome booleans);
- contain **no** DSN, password, generated password, DSN component, `.env.production` value,
  raw psql/PostgreSQL output, Node stack trace, or customer/row data;
- confirm **only `buyerrecon_stage0_runner`** was altered and **no** grant/schema/data change
  occurred;
- confirm the custody file ended up **root-owned + chmod 600**, verified by
  **presence/permissions/ownership category checks only** (not by reading the value back);
- record `stop_line` (`none` or the tripped guard);
- explicitly state it does **not** prove auth passes (that is the later Option A preflight
  rerun) and does **not** authorize Step 2E or Stage 0;
- reaffirm **Stage 0 execution remains separately GO-gated**.

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace, or customer data. This is a docs-only plan for a
**future** Route B chain that generates/inputs the runner secret via **hidden input /
in-memory variable only**, applies a **scoped `ALTER ROLE buyerrecon_stage0_runner`**
rotation, and writes a matching `STAGE0_RUNNER_DSN` to a **root-only, chmod-600** custody
file — **never** printing/parsing/splitting/decoding/logging the value or any DSN component,
**never** reading/printing `.env.production`, withholding any raw psql output to a chmod-600
temp, and recording **booleans/category labels only**; it **runs no rotation**, **writes no
custody value**, **runs no psql/auth**, and **changes no grant/schema/data**. The role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, the
env-var/key name `STAGE0_RUNNER_DSN`, and the illustrative `ALTER ROLE … WITH PASSWORD
<hidden>` shape are non-secret. (Per the PR #218 Codex note: "no secret used or exposed" is
to be read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / category tokens / non-secret command-shape examples / role & path & key
names / public git commit hashes — not secret or row values.
