# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source S2 (Controlled Server-Side Source) Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. Under the PR #244 custody plan,
**S2 (controlled server-side source)** is the **selected planning path** for creating a
custody source named `STAGE0_RUNNER_DSN`. This PR plans **how that source would be
created/stored and later proven by env-name presence only** — **without printing,
reading, parsing, validating, or exposing the secret value**.

This PR **executes nothing** and **authorizes no source creation / secret handoff /
binding / proof run**: no source creation, no source binding, no secret generation, no
secret value read/print, no `.env.production` read/print, no DSN parsing, no
host/port/IP/user/password/URI/component output, no DB connection, no `psql`/SQL, no env
mutation, no runner DSN binding, no source-selection code change, no Option A/B
selection, no password reset/rotation, no Step 2E rerun, no Stage 0, no run-lock touch,
no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password, token,
host, port, IP, or URI appears in this document.

> Provenance: PR #244 runner-source creation/custody plan
> (`3d0908fe72b7e69602e4d5d84058891a15b1188c`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CREATION_CUSTODY_PLANNING_ONLY`); PR #243
> Option 3 metadata inconclusive (`564063f292e3b90a3373e14559aa1805ee9794e0`); PR #241
> Option 2 env-name missing (`1c885d0e65e98cbb6f6a8f4628b82660fac6e115`); PR #239 Option C
> proof rerun inconclusive (`05c81f3e77e3b865935c2618f1f811955813f610`).

---

## 1. Objective

- Plan a **controlled server-side custody source** for `STAGE0_RUNNER_DSN` (S2).
- **Preserve secret value confidentiality** throughout creation, storage, and proof.
- Define a later **metadata / env-name-only proof path** (presence only, value never
  read/printed).
- **Avoid runtime binding** until a later, separately-reviewed GO (this plan binds
  nothing).

> Selecting S2 here is a **planning-path selection**, not an Option A/B (runtime-binding
> vs code-level source-selection) decision — Option A/B remains deferred until
> runner-source presence is proven by the later env-name presence proof.

---

## 2. Required Properties

- **key/source name:** `STAGE0_RUNNER_DSN`
- **intended role category:** `buyerrecon_stage0_runner`
- **intended database:** `buyerrecon_production`
- **custody location:** **selected later** (under its own review + GO)
- **file/secret owner:** **selected later**
- **permissions target:** **selected later** — e.g. root-owned / least-readable
- **proof after creation:** **key-name / env-name presence only**
- **no raw value** in repo, docs, terminal output, logs, or evidence

---

## 3. Command-Pack Shape — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** S2
> source-creation execution — **not** executed here. The secret value is handled **only**
> via hidden input / approved handoff and is **never** printed, echoed, read back,
> parsed, validated by content, logged, committed, or recorded.

1. **Preflight path and branch checks** (expected path / branch; booleans only).
2. **Clean working-tree check** (no uncommitted/untracked changes disturbed).
3. **Chosen custody-location check** (the selected server-side location is present and
   writable as intended; location identity by category, not value).
4. **Fail closed if any existing file/source would be overwritten** without an explicit
   GO (no clobber).
5. **Hidden input or approved secret handoff only** — `read -r -s`-style; **never**
   echoing/expanding/logging the value; assembled/stored in memory or written directly to
   the custody target without transiting a printable buffer.
6. **chmod / owner controls** if a file-based custody source is later selected (e.g.
   `chmod 600` / root-owned / least-readable) — set **before or atomically with** the
   write.
7. **Post-creation proof limited to key-name / env-name presence only** (does the name
   exist? boolean — value never read).
8. **No runtime process binding in the same step.**
9. **No Step 2E or Stage 0 in the same step.**

---

## 4. Safe Labels (for this plan / future S2 creation evidence)

```text
runner_source_creation_command_pack_planning_only=true
selected_custody_path=S2_controlled_server_side_source
target_source_name=STAGE0_RUNNER_DSN
target_role_category=buyerrecon_stage0_runner
target_database=buyerrecon_production
source_created=false
source_bound=false
secret_generated=false
secret_value_printed=false
secret_value_read=false
dsn_parsing_performed=false
db_connection_attempted=false
psql_sql_invoked=false
option_a_selected=false
option_b_selected=false
stage0_executed=false
```

> The future S2 creation run will additionally set its own outcome booleans (e.g.
> `expected_path_confirmed`, `working_tree_clean`, `custody_location_ok`,
> `overwrite_risk=false`, `permissions_enforced`, `hidden_input_received`,
> `source_created=true|false`, `env_name_presence_proven=true|false|unknown`,
> `s2_creation_result=<allowlisted>`), all safe booleans/tokens — **no raw values**, and
> **fail closed** rather than print/read a value to force a result.

---

## 5. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- a **raw value** would be printed/read;
- a **`.env.production` value** read/print;
- **DSN parsing** required;
- **DB / psql** required;
- the **custody location is unclear**;
- there is **overwrite risk** (an existing file/source would be clobbered without GO);
- **permissions cannot be enforced** (chmod/owner controls cannot be applied);
- **source binding or runtime env mutation** requested;
- a **code / source-selection change** requested;
- an **Option A/B selection** requested;
- a **Step 2E / Stage 0 / runtime** action requested.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 6. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No source creation.
- No source binding.
- No secret generation.
- No secret value read/print.
- No `.env.production` read/print.
- No DSN parsing.
- No host/port/IP/user/password/URI/component output.
- No DB connection.
- No psql/SQL.
- No env mutation.
- No runner DSN binding.
- No source-selection code change.
- No Option A/B selection.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0.
- No run-lock.
- No runtime/downstream/Lane/scoring/AMS/customer action.

---

## 7. Future Gate Sequence

1. **Merge** this planning PR (after Codex review).
2. **Codex review** of the planning content (this PR).
3. **Fresh explicit Helen GO** for **exactly one** S2 source-creation command-pack
   execution (hidden input only; secret never printed/read/stored in repo; safe labels
   only).
4. **Source-creation evidence PR** (safe labels only; no raw value).
5. **Env-name presence proof PR** (key-name/env-name presence only).
6. **Only after the presence proof** → **Option A/B decision planning** (each separately
   reviewed + GO-gated).

---

## 8. Non-Authorization

**Merging this plan authorizes:**
- **no** source creation;
- **no** secret handoff;
- **no** binding;
- **no** proof run;
- **no** Option A/B decision;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The S2 source-creation command-pack execution is a future, separately-reviewed,
separately GO-gated step** requiring a fresh explicit Helen GO. **Stage 0 execution
remains separately GO-gated.**

---

## 9. Next Gated Step

1. **Codex review and merge** of this S2 command-pack planning PR.
2. **Fresh explicit Helen GO** for **one** S2 source-creation execution (per §3 shape;
   §5 stop-lines; §4 labels).
3. Docs-only **source-creation evidence PR** → **env-name presence proof PR**.
4. **Only after presence proof** → Option A/B decision planning.
5. **Stage 0 execution remains separately GO-gated.**

---

## 10. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, generated secret, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or
customer data. This is a docs-only plan for **how** a controlled server-side
`STAGE0_RUNNER_DSN` source **would** be created/stored and **later proven by env-name
presence only** — it **creates/binds/generates nothing**, handles any future secret value
**only via hidden input / approved handoff** (never printed/read/parsed/logged/committed),
makes **no** DB connection, changes **no** runtime binding, and **selects no Option A/B**.
The source name / role category / database are non-secret identifiers. (Per the PR #218
Codex note: "no secret used or exposed" is to be read as "no secret value exposed,
printed, or recorded.") All values above are safe labels / booleans / path-category /
env-var names / role / database names / public git commit hashes — not secret or row
values.
