# Sprint 3 — Stage 0 auth/credential Step 2G — Revised Option A Command-Pack: Mapping Diagnostic + Narrow Predicate Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_REVISED_COMMAND_PACK_MAPPING_DIAGNOSTIC_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **revised Option A
command pack** that adds a **safe mapping diagnostic phase** (before any runner-source
loading) and a **narrow, allowlisted `stage0:run` mapping predicate**, after the Option A
preflight blocked at `stage0_run_mapping_unexpected` (PR #254) and the reconciliation plan
(PR #255) classified the actual mapping as `tsx_or_node_wrapper_expected_entrypoint`.

This PR **executes nothing** and **authorizes no diagnostic / predicate change / preflight
/ binding / auth gate**: no command execution, no package-script execution, no Stage 0, no
Step 2E, no run-lock touch, no psql/SQL, no DB connection, no runtime binding, no runner
DSN binding, no auth/psql gate, no Option A preflight rerun, no mapping-predicate change,
no source-selection change, no Option B code change, no remediation. No real DSN, password,
token, host, port, IP, URI, or `.env.production` value appears in this document.

> Provenance: PR #255 `stage0:run` mapping reconciliation plan
> (`dee1ee03d20e3ab2937ad4570d648f71225c954c`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_STAGE0_RUN_MAPPING_RECONCILIATION_PLANNING_ONLY`);
> PR #254 Option A current-tip preflight blocked — mapping unexpected
> (`93de89c8822edd7da647221b467fdea3ffe7ca43`); PR #249 Option A runtime-binding
> command-pack plan (`76bff30d0912b00ee5338d4bdc83bbafccb4271e`).

---

## 1. Status

`STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_REVISED_COMMAND_PACK_MAPPING_DIAGNOSTIC_PLANNING_ONLY`
— docs-only; designs the revised command pack only; authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #254 / PR #255)

- **PR #254:** current-tip checkout sync succeeded; S2 custody gates passed; Option A
  preflight blocked at `stage0_run_mapping_verified=false`,
  `stop_line=stage0_run_mapping_unexpected`; runner DSN value not loaded/read/printed/
  parsed/validated/tested; no binding/auth/psql; no Step 2E/Stage 0.
- **PR #255:** safe tracked-file inspection found `package.json:13`
  `"stage0:run": "tsx scripts/run-stage0-worker.ts"`, target `scripts/run-stage0-worker.ts`
  (shebang `#!/usr/bin/env tsx`, `scripts/run-stage0-worker.ts:1`), classified
  `tsx_or_node_wrapper_expected_entrypoint`; hypothesis: the PR #249 predicate was too
  narrow.
- Value remains **unverified by design**; no runtime binding/auth/psql has succeeded;
  **Stage 0 remains separately GO-gated**.

---

## 3. Why the PR #249 Predicate Was Too Narrow

The PR #249 preflight verified `stage0:run` mapping with a predicate that did **not** accept
the **`tsx` wrapper shape** that the checkout actually uses (`tsx
scripts/run-stage0-worker.ts`). The script itself is the **expected tracked runner
entrypoint** — non-destructive and correct — so the failure was a **predicate gap**
(too-narrow accepted-shape set), **not** a wrong/destructive script. (Recorded as a
hypothesis to confirm under the revised diagnostic, not a proven predicate defect.) The fix
is to **broaden the predicate to a reviewed allowlist** that includes the `tsx`/`node`
wrapper shape **only** when its target is the expected tracked runner — while keeping the
predicate **narrow** (never "any `stage0:run` exists").

---

## 4. Revised Mapping Diagnostic Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** diagnostic —
> **not** executed here. It runs **before any runner-source loading** and inspects **only
> tracked repo metadata**; it emits **safe labels only**.

1. **Mapping diagnostic phase precedes runner-source loading** — it gates whether the
   Option A preflight may proceed; if the mapping is not an accepted allowlist shape, the
   diagnostic **fails closed** and the preflight does not advance.
2. **Inspect only tracked repo metadata:**
   - `package.json` (the `stage0:run` script key + its non-secret command string);
   - the **expected tracked Stage 0 runner entrypoint path** (e.g.
     `scripts/run-stage0-worker.ts`);
   - **safe `path:line` references** only.
3. **Must not run package scripts.**
4. **Must not run Stage 0.**
5. **Must not read or print** secrets, DSN values, `.env.production`, runtime env, customer
   data, payloads, request IDs, session IDs, raw SQL output, or psql output.
6. **Classify `stage0:run`** into the §5 allowlist (shape category + boolean).
7. **Emit safe labels only**; fail closed on `unexpected_or_unknown`.

---

## 5. Allowlist Categories

```text
direct_expected_entrypoint
npm_wrapper_expected_entrypoint
tsx_or_node_wrapper_expected_entrypoint
unexpected_or_unknown   # → fail closed
```

- **`direct_expected_entrypoint`** — `stage0:run` invokes the expected runner entrypoint
  directly, exact expected target.
- **`npm_wrapper_expected_entrypoint`** — an `npm`/`pnpm`-style wrapper resolving to the
  expected runner entrypoint.
- **`tsx_or_node_wrapper_expected_entrypoint`** — a `tsx`/`node` wrapper invoking the
  **expected tracked runner script** (the current shape: `tsx scripts/run-stage0-worker.ts`).
- **`unexpected_or_unknown`** — anything else → **fail closed**.

---

## 6. Candidate Revised Predicate

The revised predicate **may accept `tsx_or_node_wrapper_expected_entrypoint` only when ALL**
of:
- the package script **points to the expected tracked runner entrypoint**
  (`scripts/run-stage0-worker.ts`);
- the **target file exists as a tracked repo file**;
- the **target path is not unknown/destructive**;
- **no shell chaining / redirection / destructive command shape is present** (no `&&`,
  `;`, `|`, `>`/`>>`, `rm`, `curl|sh`, env-dump, or other unsafe wrapper).

It must likewise accept `direct_expected_entrypoint` / `npm_wrapper_expected_entrypoint`
**only** against the expected tracked runner entrypoint with the same safety conditions.
**Unknown or unreviewed shapes must fail closed.** The predicate must **never** accept
"any `stage0:run` exists".

---

## 7. Safe Labels

```text
revised_option_a_command_pack_planning_only=true
pr255_mapping_reconciliation_present=true
previous_stage0_run_mapping_verified=false
actual_stage0_run_classification=tsx_or_node_wrapper_expected_entrypoint
mapping_diagnostic_candidate_only=true
mapping_predicate_change_authorized=false
mapping_diagnostic_executed=false
option_a_preflight_rerun=false
runtime_binding_performed=false
runner_dsn_bound=false
auth_psql_gate_executed=false
psql_sql_invoked=false
source_selection_changed=false
option_b_code_changed=false
step2e_rerun=false
stage0_executed=false
run_lock_touched=false
```

> The future mapping diagnostic run will additionally emit its own outcome booleans (e.g.
> `package_json_inspected`, `stage0_run_shape_classification`,
> `target_runner_file_tracked`, `unsafe_command_shape_detected=false`,
> `mapping_diagnostic_result=<allowlisted>`), all safe tokens — **no raw values**.

---

## 8. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- the mapping diagnostic would require **executing `stage0:run`**;
- the package script shape is **unknown / unreviewed / destructive**;
- the package script contains **shell chaining, redirection, env dump, destructive command,
  or unsafe wrapper**;
- the **target runner file is missing or not tracked**;
- the **expected target path differs** from the reviewed entrypoint;
- a **secret / env / DSN value** would be read or printed;
- **`.env.production`** would be read or printed;
- **psql / SQL** would run;
- a **runtime binding** would occur;
- a **Stage 0 / Step 2E / run-lock / downstream** action would occur;
- the predicate would accept **"any `stage0:run` exists"**.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 9. Non-Authorization

**Merging this plan authorizes:**
- **no** mapping diagnostic run;
- **no** mapping-predicate change;
- **no** Option A preflight rerun;
- **no** runtime binding / runner DSN binding;
- **no** auth/psql gate;
- **no** source-selection change;
- **no** Option B code change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The mapping diagnostic run and any subsequent Option A binding/auth preflight are future,
separately-reviewed, separately GO-gated steps.** **Stage 0 execution remains separately
GO-gated.**

---

## 10. Future Gated Sequence

1. **Merge** this revised command-pack planning PR (after Codex review).
2. **Codex review.**
3. **Fresh explicit Helen GO** for the **mapping diagnostic only** (tracked-metadata
   classification; safe labels; fail closed on unknown).
4. Docs-only **evidence PR for the mapping diagnostic result** (safe labels only).
5. **Only if the diagnostic passes** (an accepted allowlist shape against the expected
   tracked runner) → create/run a **separately GO-gated Option A binding/auth preflight
   retry**.
6. **Stage 0 execution remains separately GO-gated.**

---

## 11. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or customer
data. This is a docs-only plan for a **future** mapping diagnostic that inspects **tracked
repo metadata only** (`package.json` `stage0:run` non-secret command string + expected
tracked runner entrypoint path + `path:line` references), **runs no package script**, **runs
no Stage 0**, **runs no psql/SQL**, reads **no** `.env.production` value, performs **no**
binding, and records **no** DSN/secret/env value. The revised predicate stays **narrow**
(reviewed allowlist; fail closed on unknown), never broad. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or recorded.")
All values above are safe labels / booleans / shape categories / env-var names / non-secret
script command string / `path:line` references / public git commit hashes — not secret or
row values.
