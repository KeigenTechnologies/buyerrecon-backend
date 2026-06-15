# Sprint 3 — Stage 0 auth/credential Step 2G — Option A `stage0:run` Mapping Reconciliation Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_STAGE0_RUN_MAPPING_RECONCILIATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans how to **safely inspect and
reconcile the `stage0:run` mapping verification** used by the Option A command pack, after
the Option A preflight (PR #254) blocked at `stage0_run_mapping_unexpected` even though the
sync gap was cleared and the S2 custody gates passed.

This PR **executes nothing** and **authorizes no mapping change / preflight / binding /
auth gate**: no production command execution, no preflight rerun, no psql/auth, no runtime
binding, no source-selection change, no Option B code change, no package-script execution,
no Step 2E, no Stage 0, no run-lock touch, no remediation. No real DSN, password, token,
host, port, IP, URI, or `.env.production` value appears in this document.

> Provenance: PR #254 Option A current-tip preflight blocked — `stage0:run` mapping
> unexpected (`93de89c8822edd7da647221b467fdea3ffe7ca43`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_CURRENT_TIP_PREFLIGHT_BLOCKED_STAGE0_RUN_MAPPING_UNEXPECTED`);
> PR #249 Option A runtime-binding command-pack plan
> (`76bff30d0912b00ee5338d4bdc83bbafccb4271e`); PR #247 S2 presence proof
> (`609fa182a732961cf87c86a6dbe2d23d8dbe5c15`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`).

---

## 1. Status

`STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_STAGE0_RUN_MAPPING_RECONCILIATION_PLANNING_ONLY` —
docs-only; safe repo inspection + plan only; authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #254)

- Current-tip fast-forward **cleared the checkout sync gap**; local HEAD contained the
  remote base tip and PR #249–#253 merges.
- S2 custody file **existed**; owner/permissions **expected**; `STAGE0_RUNNER_DSN` key
  **present**.
- Option A preflight **blocked** at `stage0_run_mapping_verified=false`,
  `stop_line=stage0_run_mapping_unexpected`.
- The runner DSN value was **not** loaded/read/printed/parsed/validated/tested; **no**
  `DATABASE_URL` child-scoped binding; **no** runtime binding; **no** auth/psql gate; **no**
  Step 2E/Stage 0.

---

## 3. Current Mapping-Predicate Problem

The PR #254 evidence proved only that the **existing predicate returned false**
(`stage0_run_mapping_verified=false`) — i.e. the PR #249 command-pack's expected
`stage0:run` mapping did **not** match the checkout's current script mapping. It did **not**
record what the current mapping is.

**Safe repo inspection (non-secret; this PR):** the current mapping is, at
`package.json:13`:
```text
"stage0:run": "tsx scripts/run-stage0-worker.ts"
```
i.e. a **tsx wrapper entrypoint** that invokes the tracked script
`scripts/run-stage0-worker.ts` (which itself begins with `#!/usr/bin/env tsx` —
`scripts/run-stage0-worker.ts:1`). This is a **non-secret script shape** (a script command
string; no DSN/secret/env value). **The likely cause of the mismatch** is that the PR #249
predicate expected a narrower/different shape (e.g. a direct `node …` invocation or an
exact string) and did not account for the `tsx scripts/run-stage0-worker.ts` wrapper — so
the predicate, not the script, is what needs reconciling. **This is recorded as a
hypothesis to confirm under the revised diagnostic, not a proven predicate defect.**

---

## 4. Safe Package-Script Inspection Plan

The reconciliation diagnostic (this PR's inspection, and the future revised command-pack)
may:
- inspect **`package.json` script key names and safe script shape** (e.g. `package.json:13`
  `stage0:run`), recording the **non-secret script command string** only;
- inspect the **Stage 0 worker / entrypoint by filename/path and safe high-level shape**
  (`scripts/run-stage0-worker.ts:1` shebang; `src/scoring/stage0/run-stage0-worker.ts`
  reads `env.DATABASE_URL` per PR #229), recording **path/line references only**;
- **not** print/record raw secret values, DSN strings, environment values,
  host/port/IP, credentials, payloads, request IDs, session IDs, or customer data;
- **not** run package scripts; **not** run Stage 0; **not** run psql/SQL.

---

## 5. Candidate Accepted Mapping Shapes (allowlist — NOT "any stage0:run exists")

**Principle: do NOT accept "any `stage0:run` exists".** Use an allowlist of reviewed,
non-destructive, expected Stage 0 script shapes only. Distinguish at least:

- **`direct_expected_entrypoint`** — `stage0:run` invokes the expected runner entrypoint
  directly (e.g. `node <expected built entrypoint>`), exact expected target.
- **`npm_wrapper_expected_entrypoint`** — `stage0:run` is an `npm`/`pnpm`-style wrapper that
  resolves to the expected runner entrypoint.
- **`tsx_or_node_wrapper_expected_entrypoint`** — `stage0:run` is a `tsx`/`node` wrapper
  invoking the **expected tracked script** (the **current** shape: `tsx
  scripts/run-stage0-worker.ts`, `package.json:13`).
- **`unexpected_or_unknown`** — anything not matching an allowlisted expected shape, or
  pointing at an unknown/destructive path → **fail closed**.

The **current** mapping classifies as **`tsx_or_node_wrapper_expected_entrypoint`** (per
§3), targeting the expected tracked runner script — a **known, non-destructive** shape.

---

## 6. Candidate Revised Predicate Design

The revised predicate (future command-pack; **not** changed here) should:
- **classify** the current `stage0:run` mapping shape against the §5 allowlist;
- **accept only** known safe shapes (`direct_expected_entrypoint` /
  `npm_wrapper_expected_entrypoint` / `tsx_or_node_wrapper_expected_entrypoint`) **whose
  target is the expected tracked runner script**;
- **fail closed** on `unexpected_or_unknown` (unknown shape, unexpected target, or
  destructive path) — emit a stop-line, do not proceed;
- emit **safe labels only** (shape category + boolean), **never** the raw script value
  beyond the reviewed non-secret command string, and **never** any DSN/secret/env value;
- remain **narrow** — it must not become a broad/unreviewed "exists" check.

---

## 7. Option A Auth-Preflight Path After Mapping Reconciliation

Once the mapping predicate is reconciled (allowlist accepts the verified current shape):
- the Option A binding/auth preflight proceeds **only under a separate fresh GO**, per the
  PR #249 secret-safe shape (invocation-scoped hidden load of `STAGE0_RUNNER_DSN` →
  child-scoped `DATABASE_URL` bind → auth/psql gate), value never printed/parsed, raw
  output withheld, no Stage 0;
- **alternatively**, if review prefers, a **different non-runtime auth-preflight path** may
  be designed (its own plan) instead of binding via `DATABASE_URL`.
- **No auth-preflight runs in this PR or as part of the mapping diagnostic** — it is a
  separate, GO-gated step.

---

## 8. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- the actual script shape cannot be inspected without exposing secrets;
- any secret / env / DSN value would be printed;
- any package script would be executed;
- Stage 0 would run;
- psql / SQL would run;
- the mapping predicate would become broad / unreviewed;
- `stage0:run` points to an unknown or destructive path;
- a source-selection code change would be required;
- a runtime binding would occur;
- a Step 2E / Stage 0 / run-lock / downstream action would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 9. Safe Labels

```text
mapping_reconciliation_planning_only=true
pr254_evidence_carried_forward=true
stage0_run_mapping_previous_predicate_failed=true
actual_stage0_run_value_recorded=true
actual_stage0_run_value_classification=tsx_or_node_wrapper_expected_entrypoint
mapping_predicate_change_authorized=false
option_a_preflight_rerun=false
runtime_binding_performed=false
auth_psql_gate_executed=false
source_selection_changed=false
option_b_code_changed=false
step2e_rerun=false
stage0_executed=false
run_lock_touched=false
```

> Note on `actual_stage0_run_value_recorded=true`: the recorded value is the **non-secret
> script command string** `tsx scripts/run-stage0-worker.ts` (`package.json:13`) — a
> reviewed, explicitly-bounded **script shape**, **not** a DSN/secret/env value. No raw
> secret/runtime value was recorded.

---

## 10. Non-Authorization

**Merging this plan authorizes:**
- **no** mapping-predicate change;
- **no** Option A preflight rerun;
- **no** runtime binding;
- **no** auth/psql gate;
- **no** source-selection change;
- **no** Option B code change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The revised command-pack / mapping-predicate change and any auth-preflight are future,
separately-reviewed, separately GO-gated steps.** **Stage 0 execution remains separately
GO-gated.**

---

## 11. Next Gated Step

1. **Codex review and merge** of this mapping-reconciliation planning PR.
2. **Revised Option A command-pack plan** (docs-only) implementing the §5/§6 mapping
   diagnostic + allowlist predicate (classify shape, accept only known safe shapes, fail
   closed on unknown) — then Codex review and a **fresh explicit Helen GO** for the mapping
   diagnostic + (separately) the Option A binding/auth preflight.
3. Docs-only **evidence PRs** for each GO-gated step (safe labels only).
4. **Only after** a clean mapping classification + a passing auth-preflight → decide whether
   Step 2E/Stage 0 planning continues, or fall back to Option B.
5. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or customer
data. The inspection read **tracked repo files only** — recording the **non-secret
`stage0:run` script command string** (`package.json:13`: `tsx scripts/run-stage0-worker.ts`)
and a `path:line` shebang reference (`scripts/run-stage0-worker.ts:1`); it **ran no package
script**, **ran no Stage 0**, **ran no psql/SQL**, read **no** `.env.production` value, and
recorded **no** DSN/secret/env value. The proposed revised predicate stays **narrow**
(allowlist of reviewed safe shapes; fail closed on unknown), never broad. (Per the PR #218
Codex note: "no secret used or exposed" is to be read as "no secret value exposed, printed,
or recorded.") All values above are safe labels / booleans / shape categories / env-var
names / non-secret script command string / `path:line` references / public git commit
hashes — not secret or row values.
