# Sprint 3 — Stage 0 — `auth_or_credential` Route B **Revised** Correction Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_REVISED_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only command-pack planning record**. Merged PR #264 planned the
Route B credential rotation + custody alignment. A proposed execution script was **reviewed
before execution and BLOCKED — it was not run**. This revises the command pack to fix the
blocking issues, **as planning only, not execution**.

This PR **executes nothing** and **authorizes no rotation / custody write / psql / reset /
remediation**: no credential reset, no password rotation, no custody overwrite, no DSN
read/print/parse, no generated-password print, no `.env.production` read/print, no psql/auth
rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no
source-selection change, no Option B code change, no grant/schema/data change, no
remediation, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password,
generated password, token, host, port, database, username, URI, IP, or service-file content
appears in this document.

> **Carry-forward (nothing executed):** no credential reset occurred; no password rotation
> occurred; no custody overwrite occurred; no psql/auth rerun occurred; no Option A
> preflight rerun occurred; no Step 2E occurred; no Stage 0 occurred. **Stage 0 remains
> separately GO-gated.**

> Provenance: PR #264 Route B command-pack plan
> (`ccaf514300e470718315676df69db4d676cd230d`,
> `STAGE0_STEP2G_AUTH_OR_CREDENTIAL_ROUTE_B_CORRECTION_COMMAND_PACK_PLANNING_ONLY`); PR #263
> credential/custody correction plan (`2db1b63d854ed3168a05f6b0ada41ecc72ca3364`); PR #262
> revised classifier classified `auth_or_credential`
> (`155737d007dcf43c40eb4db43546705562c9424e`); PR #258 Option A binding/auth preflight retry
> — auth failed, raw withheld (`73ffdc162aa870b71e8c08aedc3441efdba367f3`).

---

## 1. Status

`STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_REVISED_COMMAND_PACK_PLANNING_ONLY` — docs-only; revises
the Route B rotation + custody-alignment command pack after the first execution script was
blocked pre-run; authorizes/executes nothing.

---

## 2. Prior Blocked Command Review (issues recorded)

The proposed PR #264 execution script was blocked **before being run** for these reasons:

1. **Secrets passed via process argv to Python** — the new runner password and the full
   `STAGE0_RUNNER_DSN` were passed as argv. This violates the no-secret-exposure boundary
   because argv can be exposed through process inspection (`ps`/`/proc`), audit tooling,
   shell logging, crash/debug capture, or operator tooling.
2. **Secret-bearing SQL temp-file readability unsafe / non-deterministic** — a root-only
   temp dir/file was likely **unreadable by `sudo -u postgres`**; the plaintext SQL file
   **contained the password**; the execution-user/ownership model was not safe enough for a
   production mutation.
3. **DB rotation happened before custody write** — if DB rotation succeeded but the custody
   write/verification failed, DB and custody could be left **out of sync** — exactly the
   ambiguity Route B is meant to eliminate.
4. **Unguarded failures after mutation could exit without terminal safe labels** — e.g. an
   `install` failure under `set -e` could leave an **evidence gap after DB mutation**.
5. **Blocked handler emitted hard-coded false labels** — these could **contradict** true
   labels already emitted after partial progress; the revised command must track the
   **actual reached state**.
6. **Secret-bearing temp artifact approach needs stronger justification or replacement** —
   avoid a plaintext SQL file if possible; if any secret-bearing temp file remains, it must
   be root-only, never argv, execution-user compatible, and fully guarded.

---

## 3. Evidence Chain (PR #258 → #264)

- **PR #258:** Option A binding/auth preflight reached psql/auth and **failed**; raw output
  withheld.
- **PR #259:** initial category-only classifier plan.
- **PR #260:** first classifier attempt **blocked** — raw-output boundary violated.
- **PR #261:** revised classifier plan (code-from-stdin / data-only invocation + self-test
  gate).
- **PR #262:** revised classifier **safely classified** the failure as **`auth_or_credential`**.
- **PR #263:** credential/custody correction planning compared Options A/B/C; recommended
  **Route B** only if eliminating ambiguity is desired.
- **PR #264:** Route B command-pack plan (rotation + custody alignment); a proposed execution
  script was then **reviewed and blocked pre-run** (this revision addresses it).

---

## 4. Revised Design Principles

- **No password or DSN in argv** — ever, for any process.
- **No password or DSN in environment if avoidable**; if env is unavoidable, justify and
  tightly bound it (single process, never exported to children, cleared immediately).
- **Feed secret-bearing SQL to `sudo -u postgres psql` via stdin from a root-only process**
  — not via argv and not via a postgres-unreadable file.
- **Avoid persisting plaintext secret-bearing SQL files** where possible.
- **Preflight custody-write capability BEFORE DB rotation** using a harmless non-secret probe
  file / safe atomic-write test; **prove** target dir/file can be set to root:root chmod 600
  **before any irreversible DB rotation**.
- **Guard every command that can fail**; **emit terminal safe labels on every stop path**.
- **Track actual reached state in variables** — never hard-code `false` after partial
  progress.
- **Never print raw psql output**; withhold to a chmod-600 root-only file if needed.
- **Clear/unset secrets after use.**
- **Defer auth validation** to a later, separate Option A preflight GO.

---

## 5. Revised Command-Pack Shape — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** execution —
> **not** run here. All steps are illustrative shape only; no command is executed by this PR.

**Phase 0 — repo / base / preflight (no secrets):**
- Confirm `/opt/buyerrecon-backend`.
- Confirm branch `sprint2-architecture-contracts-d4cc2bf`.
- Fast-forward to current `origin` tip if needed.
- Confirm the **PR #264 merge `ccaf514300e470718315676df69db4d676cd230d`** is contained in
  HEAD.
- Confirm a clean working tree.
- Guard each check; stop with terminal safe labels if any fails.

**Phase 1 — non-secret custody-write preflight (before any DB rotation):**
- Create a **root-only temp file with harmless placeholder text** (no secret).
- Test the **atomic install path to a separate harmless PROBE path** — **not** the real
  custody file.
- Verify **root:root chmod 600** behavior on the probe.
- Remove the probe.
- **Stop before DB rotation if this fails** (custody write proven impossible ⇒ never mutate
  the DB).

**Phase 2 — hidden secret input (no argv, no echo):**
- `read -r -s` the **new password** (hidden); confirm hidden.
- `read -r -s` the **full matching `STAGE0_RUNNER_DSN`** (hidden); confirm hidden.
- **No argv secret; no echo; no DSN parsing/split/decode; no generated-password print.**
- Secrets live only in in-memory shell variables for the duration of the chain.

**Phase 3 — scoped DB rotation (runner role only):**
- Alter **only** `buyerrecon_stage0_runner` (no other role; no grants/schema/data changes;
  no psql/auth rerun).
- Feed the `ALTER ROLE … WITH PASSWORD <hidden>` SQL to `sudo -u postgres psql` **via stdin
  from a root-only process** (no argv secret, no postgres-unreadable file; avoid a persisted
  plaintext SQL file).
- **psql output withheld** (to a chmod-600 root-only file if needed); never printed.
- Command **guarded**; **terminal labels emitted** on success and on every failure path;
  record `db_rotation_applied` from the **actual** result.

**Phase 4 — custody write (root-only, atomic, chmod 600):**
- Write the matching `STAGE0_RUNNER_DSN` to `/etc/buyerrecon/stage0-runner.env` via a
  **root-only atomic write** (write temp → fsync → atomic rename), then **final root:root
  chmod 600**.
- **Verify key presence only** (that the key exists) — **never** print or read back the
  value or any component.
- Guarded; terminal labels emitted; record `custody_written` from the **actual** result.

**Phase 5 — cleanup / evidence:**
- **Clear/unset** all secret variables; remove any chmod-600 temp.
- Emit **safe labels only** (reflecting actual reached state).
- Produce a docs-only **correction evidence PR**.
- **No Option A preflight in the same step** — auth validation is a separate later GO.

---

## 6. Secret-Handling Model

- New password and `STAGE0_RUNNER_DSN` enter **only** via hidden `read -r -s` into in-memory
  variables — **never** argv, **never** echoed, **never** in shell history.
- **Never** print, parse, split, decode, or log the password, generated password, DSN, or any
  DSN component (username, password, host, port, database, URI, IP) or service-file content.
- **Never** read or print `.env.production`.
- Secret-bearing SQL is fed to psql via **stdin from a root-only process**; a persisted
  plaintext SQL file is **avoided**; if any secret-bearing temp file is unavoidable it must
  be **root-only, never argv, execution-user compatible, and fully guarded**, then removed.
- Custody file `/etc/buyerrecon/stage0-runner.env` ends up **root:root, chmod 600**.
- Any raw psql output is **withheld** (chmod-600 root-only file) and never printed.
- Secrets are **cleared/unset** after use.
- Evidence uses **safe booleans / category labels only**.

---

## 7. Partial-State Prevention Strategy

- **Custody-write capability is proven first** (Phase 1 probe) **before** any irreversible DB
  rotation — if custody cannot be written safely, the DB is **never** mutated, so DB and
  custody cannot drift out of sync.
- DB rotation (Phase 3) runs **only after** Phase 1 proves custody is writable; custody write
  (Phase 4) follows immediately.
- Every phase records its **actual reached state** in variables; if Phase 4 fails after
  Phase 3 succeeded, the evidence records the **true** partial state
  (`db_rotation_applied=true`, `custody_written=false`, `db_custody_in_sync=false`,
  `stop_line=…`) so the out-of-sync condition is **explicit, never hidden** — and remediation
  of that specific partial state is its own separately-GO-gated step.

---

## 8. Failure-Label / State-Tracking Strategy

- **Every command that can fail is guarded**; `set -e` is not relied upon to produce
  evidence.
- A **terminal safe-label block is emitted on every exit path** (success and each stop-line),
  so there is **no evidence gap after a DB mutation**.
- State variables are initialized to a safe default and **updated to reflect actual
  progress**; the blocked/stop handler emits the **tracked** values — it **never** hard-codes
  `false` for a step that already succeeded (fixing prior blocker #5).
- Labels reflect what **actually** happened (e.g. `db_rotation_applied`, `custody_written`,
  `db_custody_in_sync`, `secrets_cleared`, `stop_line`) — booleans/tokens only, no value, no
  raw output.

---

## 9. Stop-Lines

Abort (safe stop-line + terminal safe labels reflecting actual state; no value/raw emitted)
if any of:
- any secret would pass through **argv**;
- any secret would **print**;
- any **generated password** would print;
- any **DSN component** would print / parse / split / decode / log;
- **`.env.production`** would be read or printed;
- **custody-write capability cannot be safely preflighted before DB rotation** (Phase 1
  fails);
- any role **other than `buyerrecon_stage0_runner`** would be altered;
- any **grant / schema / table / data** action would occur;
- any **unguarded post-mutation command** would remain;
- **terminal safe labels could be skipped** on any path;
- the **blocked handler would emit hard-coded false labels after partial progress**;
- a **psql/auth rerun** would occur;
- an **Option A preflight rerun** would occur;
- a **Step 2E / Stage 0 / run-lock / source-selection change / Option B code change /
  remediation / downstream runtime** would occur.

If a stop-line is hit, withhold all secret/raw output, emit terminal safe labels for the
**actual** reached state, record the blocked state in a docs-only evidence PR (safe labels
only), and take no fix/retry without separate review/GO.

---

## 10. Safe Labels

```text
revised_route_b_command_pack_planning_only=true
prior_route_b_execution_script_run=false
prior_route_b_execution_script_blocked=true
argv_secret_exposure_blocker_carried_forward=true
partial_state_risk_blocker_carried_forward=true
non_secret_custody_write_preflight_required=true
actual_state_tracking_required=true
terminal_safe_labels_required=true
credential_rotation_authorized=false
custody_overwrite_authorized=false
psql_auth_rerun=false
option_a_preflight_rerun=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
remediation_authorized=false
```

> A future revised Route B execution would additionally emit outcome booleans (e.g.
> `custody_write_preflight_passed`, `secret_input_hidden=true`, `secret_in_argv=false`,
> `db_rotation_applied`, `only_runner_role_altered=true`, `grant_schema_data_changed=false`,
> `custody_written`, `custody_file_root_owned`, `custody_file_chmod_600`,
> `db_custody_in_sync`, `raw_psql_output_printed=false`, `secrets_cleared=true`,
> `terminal_labels_emitted=true`, `stop_line=…`) — safe tokens only; **no value, no
> component, no raw text**.

---

## 11. Non-Authorization

**This PR authorizes no:** credential reset; password rotation; custody overwrite; DSN
read/print/parse; generated-password print; `.env.production` read/print; psql/auth rerun;
Option A preflight rerun; Step 2E; Stage 0; run-lock; source-selection change; Option B code
change; grant/schema/data change; remediation; runtime/downstream/Lane/scoring/AMS/customer
action.

**The revised Route B execution (preflight → rotation → custody alignment) is a future,
separately-reviewed, separately GO-gated step** that never prints/stores the value.
**Stage 0 execution remains separately GO-gated.**

---

## 12. Future Gated Sequence

1. **Merge** this docs-only revised Route B command-pack planning PR (after Codex review).
2. **Fresh Codex review.**
3. **Fresh explicit Helen GO** for **one** controlled revised Route B execution.
4. On the production host, run **Phase 0** (repo / branch / current base / PR #264 merge /
   clean tree).
5. Run **Phase 1** non-secret custody-write preflight; **stop before DB rotation if it
   fails**.
6. Run **Phase 2** hidden secret input (no argv, no echo).
7. Run **Phase 3** scoped rotation for `buyerrecon_stage0_runner` only (psql via stdin;
   output withheld; guarded).
8. Run **Phase 4** root-only atomic custody write + final root:root chmod 600; verify key
   presence only.
9. Run **Phase 5** clear secrets; emit safe labels; create docs-only **correction evidence
   PR**.
10. After that evidence is reviewed/merged, require a **fresh GO** for an **Option A
    binding/auth preflight rerun** → docs-only evidence PR.
11. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
12. **Stage 0 execution remains separately GO-gated.**

---

## 13. Evidence PR Requirements (for the future revised Route B execution)

The post-execution evidence PR must:
- be **docs-only**, exactly one new evidence file;
- record **safe booleans / category labels only** (per §10 + outcome booleans), reflecting
  the **actual reached state** (never hard-coded `false` after partial progress);
- contain **no** DSN, password, generated password, DSN component, `.env.production` value,
  raw psql/PostgreSQL output, Node stack trace, UUID, request_id, session_id, payload,
  `canonical_jsonb`, or customer/row data;
- confirm **no secret in argv**, **secret input hidden**, and **secrets cleared**;
- confirm **only `buyerrecon_stage0_runner`** was altered and **no** grant/schema/data change
  occurred;
- confirm custody-write capability was **preflighted before** DB rotation;
- record `db_rotation_applied`, `custody_written`, and **`db_custody_in_sync`** explicitly —
  including the **true partial state** if any phase failed after a mutation;
- confirm the custody file ended up **root:root + chmod 600**, verified by
  **presence/permissions/ownership category checks only** (key presence only; value never
  read back);
- confirm **terminal safe labels were emitted on the actual exit path**;
- record `stop_line` (`none` or the tripped guard);
- explicitly state it does **not** prove auth passes (that is the later Option A preflight
  rerun) and does **not** authorize Step 2E or Stage 0;
- reaffirm **Stage 0 execution remains separately GO-gated**.

---

## 14. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace, or customer data. This is a docs-only **revised**
plan for a **future** Route B chain that takes the runner secret + `STAGE0_RUNNER_DSN` via
**hidden input only** (never argv, never env if avoidable, never echoed), feeds secret-bearing
SQL to `sudo -u postgres psql` **via stdin from a root-only process** (avoiding a persisted
plaintext SQL file), **preflights custody-write capability with a non-secret probe before any
DB rotation**, applies a **scoped `ALTER ROLE buyerrecon_stage0_runner`** only, writes a
matching `STAGE0_RUNNER_DSN` to a **root:root chmod-600** custody file (verifying key presence
only), **guards every command, emits terminal safe labels on every path, tracks actual
reached state, withholds raw psql output, and clears secrets** — it **runs no rotation**,
**writes no custody value**, **runs no psql/auth**, and **changes no grant/schema/data**. The
role name `buyerrecon_stage0_runner`, the custody-file path
`/etc/buyerrecon/stage0-runner.env`, the env-var/key name `STAGE0_RUNNER_DSN`, and the
illustrative `ALTER ROLE … WITH PASSWORD <hidden>` shape are non-secret. (Per the PR #218
Codex note: "no secret used or exposed" is to be read as "no secret value exposed, printed,
or recorded.") All values above are safe labels / booleans / category tokens / non-secret
command-shape examples / role & path & key names / public git commit hashes — not secret or
row values.
