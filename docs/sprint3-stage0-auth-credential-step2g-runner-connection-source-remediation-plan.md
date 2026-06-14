# Sprint 3 — Stage 0 auth/credential Step 2G — Runner Connection-Source Remediation Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_CONNECTION_SOURCE_REMEDIATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans the **smallest safe path
to make the Stage 0 runner connection-source binding explicit and provable** —
**before** any Step 2E rerun or Stage 0 execution — after PR #229 reconciliation found
`runner_binding_documented_but_not_proven_present`: PR #199 documents a runner-specific
`STAGE0_RUNNER_DSN` contract, but the inspected Stage 0 worker / shared pool path is
tied to `DATABASE_URL` / the app-or-collector category.

This PR **executes nothing** and **authorizes no production command**: no code change,
no `.env.production` value read/print, no production command, no DB connection, no
`psql`/SQL, no diagnostic rerun, no password reset/rotation, no env mutation, no runner
DSN binding, no source-selection code change, no Step 2E rerun, no Stage 0, no run-lock
touch, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password,
token, host, port, IP, or URI appears in this document.

> Provenance: PR #229 Step 2F runtime-binding reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `STAGE0_AUTH_CREDENTIAL_STEP2F_PR199_RUNTIME_BINDING_RECONCILIATION_PLANNING_ONLY`,
> `reconciliation_result=runner_binding_documented_but_not_proven_present`); PR #228
> Step 2F Stage B connection-component evidence
> (`STAGE0_AUTH_CREDENTIAL_STEP2F_STAGE_B_CONNECTION_COMPONENT_USER_CATEGORY_UNEXPECTED`);
> PR #227 Step 2F localization plan (`c1b3dd2d8c311b9fd568b304841050630486d607`); PR
> #226 Step 2E post-fix gate `auth_or_credential` persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`); PR #225 Step 2D rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`).

---

## 1. Evidence Carried Forward

- **PR #225** — Step 2D local-postgres-path runner password rotation **committed**
  (`rotation_committed`).
- **PR #226** — Step 2E post-fix psql gate **still failed** broad `auth_or_credential`
  (`gate_failed_raw_output_withheld`).
- **PR #227** — Step 2F persistent-auth localization plan (six unproven hypotheses).
- **PR #228** — Step 2F Stage B: `connection_source_category=database_url`,
  `user_expected_category=app_or_collector`,
  `connection_components_result=user_category_unexpected`.
- **PR #229** — citation-backed reconciliation:
  `runner_binding_documented_but_not_proven_present` — PR #199 documents a
  runner-specific `STAGE0_RUNNER_DSN` contract, but the inspected Stage 0 worker /
  shared pool path reads `DATABASE_URL` (app/collector category).

**Bounded standing conclusion:** the persistent `auth_or_credential` is **strongly
consistent with** the Stage 0 path authenticating as the **app/collector** identity
rather than `buyerrecon_stage0_runner`. This is a **strongly supported hypothesis**,
**not** proof of the exact raw PostgreSQL error and **not** a final remediation.

---

## 2. Problem Statement (what remediation must achieve)

Make the **Stage 0 runner connection-source binding explicit and provable** so that the
Stage 0 execution/diagnostic path authenticates **as** `buyerrecon_stage0_runner` (the
PR #199-documented contract) rather than the ambient `DATABASE_URL` collector category
— **and prove it with a non-secret category check before** any Step 2E rerun or Stage 0
execution.

---

## 3. Option Comparison (no option is implemented here)

### Option A — command-pack binding (runtime-only, no code change)
For the **future Stage 0 execution process only**, pass the **approved runner
connection source** into the process as `DATABASE_URL` (e.g.
`DATABASE_URL="$APPROVED_RUNNER_SOURCE" npm run stage0:run`), with **preflight
non-secret category checks** (confirm the bound source resolves to the
`buyerrecon_stage0_runner` category, not app/collector) and **fail-closed** behaviour
if the category is wrong/absent.
- **Pros:** no code change; smallest code-surface; reversible; uses the worker's
  existing `DATABASE_URL` read (`src/scoring/stage0/run-stage0-worker.ts:175`).
- **Cons:** binding is **operator/runtime-discipline** dependent (the wrong source can
  still be passed); relies on preflight checks rather than a structural code guarantee;
  ambient `DATABASE_URL` collision risk remains if the env is already set.

### Option B — code-level source selection (structural, code change)
Change the Stage 0 worker entrypoint / source-selection to read **`STAGE0_RUNNER_DSN`
directly** and **fail closed if absent**, instead of relying on ambient `DATABASE_URL`.
- **Pros:** structural guarantee that Stage 0 cannot silently use the collector
  `DATABASE_URL`; aligns the worker with the PR #199 / diagnostic-plan contract
  (`STAGE0_RUNNER_DSN`); durable.
- **Cons:** **code change** (`scripts/run-stage0-worker.ts`,
  `src/scoring/stage0/run-stage0-worker.ts`, possibly `src/db/client.ts`) — larger
  review surface; needs tests; must itself be GO-gated and Codex-reviewed; should be
  preceded by a non-secret proof (Option C) to avoid coding against an unproven
  assumption.

### Option C — pre-remediation non-secret proof (smallest, no code/config/env binding)
**Before any code/config/env binding**, add a **non-secret connection-source category
proof** that verifies the **selected source category** (does the would-be Stage 0
source resolve to the `buyerrecon_stage0_runner` category vs. app/collector?) **without
printing secrets and without connecting to the DB** — purely an in-memory category/
boolean check, extending the Step 2F Stage B shape.
- **Pros:** **smallest safe step**; no code/config/env change; no DB connection; no
  secret exposure; directly converts the PR #228/#229 *hypothesis* into a *proof* (or
  refutes it) and tells us **which** of Option A / Option B is actually warranted.
- **Cons:** does not itself remediate (by design) — it is the gate that decides the
  remediation shape.
- **Framing (important):** Option C is a **future, separately-reviewed, separately
  GO-gated** non-secret proof — it is **not** executed or authorized by this planning
  PR. When later planned, it may specify **source-category / boolean checks only** and
  **must not** authorize reading `.env.production` values, connecting to the DB,
  printing secrets, binding a runner DSN, or changing runtime source selection. It
  requires its **own docs-only plan, Codex review, and fresh explicit Helen GO**.

---

## 4. Recommended Smallest Safe Next Gate

**Recommend Option C first** — a docs-only **Step 2G non-secret connection-source
category proof plan**, then (under its own fresh GO) a safe-label-only proof that the
intended Stage 0 runner source resolves to the `buyerrecon_stage0_runner` category
(not app/collector), **without** secrets or a DB connection.

- **Why C before A/B:** the binding gap is currently a **strongly supported hypothesis**
  (PR #228/#229), not a proof. Option C proves/refutes it at **zero code/config/env
  risk**, and its result determines the correct remediation:
  - if the proof shows a **correct runner source is available but not bound** → **Option
    A** (runtime command-pack binding) is the smaller fix;
  - if the proof shows **no reliable way to bind without code** (ambient `DATABASE_URL`
    keeps winning) → **Option B** (code-level `STAGE0_RUNNER_DSN` source selection) is
    warranted, as its own separately-reviewed, GO-gated code change.
- **No remediation (A or B) is recommended for execution in this PR.** Only the
  **Option C proof plan** is the next gate.

---

## 5. Candidate Safe Labels (for the recommended Option C proof, when later planned/run)

```text
step2g_runner_connection_source_remediation_plan_created=true
diagnostic_scope=step2g_runner_connection_source_remediation
prior_step2d_rotation_committed=true
prior_step2e_auth_or_credential_persisted=true
prior_step2f_stageb_user_category_unexpected=true
prior_pr229_runner_binding_documented_not_proven=true
recommended_next_gate=option_c_non_secret_source_category_proof
code_changed=false
env_mutated=false
runner_dsn_bound=false
db_connection_attempted=false
psql_sql_invoked=false
password_reset_or_rotation_attempted=false
step2e_rerun=false
stage0_executed=false
run_lock_touched=false
raw_secret_values_printed=false
env_production_values_printed=false
dsn_password_host_port_ip_uri_printed=false
remediation_plan_result=option_c_recommended_smallest_safe_gate
```

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any DSN / password / token / host / port / IP / URI would be printed or recorded;
- any `.env.production` value would be read or printed;
- any code / script / package / schema / migration / `.env` / deploy file would be
  changed;
- any env var would be mutated or any runner DSN would be bound;
- any source-selection code would be changed;
- a DB connection would be opened, or psql / SQL would run;
- a diagnostic rerun, password reset/rotation, Step 2E rerun, or Stage 0 would occur;
- the run-lock would be touched;
- any runtime / downstream / Lane A·B / scoring / AMS / customer output / Gate 4E /
  Gate 4F would run.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Safety Boundaries (this planning PR)

- **Docs-only planning.** No code change.
- No `.env.production` value read/print.
- No production command.
- No DB connection.
- No psql/SQL.
- No diagnostic rerun.
- No password reset/rotation.
- No env mutation.
- No runner DSN binding.
- No source-selection code change.
- No Step 2E rerun.
- No Stage 0 execution.
- No run-lock touch.
- No runtime / downstream / Lane / scoring / AMS / customer action.

---

## 8. Explicit Non-Authorization

**Merging this plan authorizes:**
- **no** env change;
- **no** runner DSN binding;
- **no** code change;
- **no** diagnostic rerun;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The recommended Option C non-secret source-category proof requires its own docs-only
plan, Codex review, and a fresh explicit Helen GO.** Any later Option A (command-pack
binding) or Option B (code-level source selection) likewise requires its **own**
docs-only plan / command-pack, Codex review, and fresh explicit Helen GO — and Option B,
being a code change, is a larger separately-reviewed surface. **Stage 0 execution
remains separately GO-gated.**

---

## 9. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Step 2G Option C** — a docs-only **non-secret connection-source category proof
   plan**, then (own fresh GO) the safe-label-only proof (no secrets, no DB connection).
3. Based on the Option C result: a **separately reviewed, GO-gated** Option A
   (command-pack runtime binding) **or** Option B (code-level `STAGE0_RUNNER_DSN` source
   selection) remediation.
4. After a proven-correct runner binding: a **Step 2E rerun** under a fresh GO.
5. **Stage 0 execution remains separately GO-gated** (only after a clean Step 2E and a
   separate Stage 0 GO).

---

## 10. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only
remediation plan that compares options and recommends the smallest safe next gate; it
**implements no remediation**, reads/prints **no** `.env.production` value, makes **no**
DB connection, and emits **safe labels / option names / role / database / env-var names
only**. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no
secret value exposed, printed, or recorded.") All values above are safe labels /
booleans / option names / public git commit hashes / role / database / env-var names —
not secret or row values.
