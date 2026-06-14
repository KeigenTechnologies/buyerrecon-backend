# Sprint 3 — Stage 0 auth/credential Step 2F Stage B — PR #199 Runtime-Binding Reconciliation (Inspection/Planning, Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2F_PR199_RUNTIME_BINDING_RECONCILIATION_PLANNING_ONLY`

This is a **reviewable, docs-only inspection/planning record**. It reconciles the PR
#199 production environment / runtime registry against the **Stage 0 runner
connection-source contract**, after Step 2F Stage B (PR #228) found the relevant
connection source parsed as `connection_source_category=database_url` with
`user_expected_category=app_or_collector` (`connection_components_result=user_category_unexpected`).

This PR is **inspection of tracked repo docs/source only** and **authorizes no
production command**: no secret inspection, no `.env.production` value read/print, no
psql/SQL, no database connection, no `.env.production` mutation, no env-var
create/change, no Stage 0, no Step 2E, no remediation. No real DSN, password, token,
host, port, IP, or URI appears in this document.

> Provenance: PR #199 production environment / runtime registry
> (`docs/ops/buyerrecon-production-environment-runtime-registry.md`); PR #226 Step 2E
> post-fix gate `auth_or_credential` persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`); PR #227 Step 2F persistent-auth
> localization plan (`c1b3dd2d8c311b9fd568b304841050630486d607`); PR #228 Step 2F Stage
> B connection-component evidence — user category unexpected
> (`STAGE0_AUTH_CREDENTIAL_STEP2F_STAGE_B_CONNECTION_COMPONENT_USER_CATEGORY_UNEXPECTED`).

---

## 1. Scope / Non-Authorization

- **Docs-only inspection/planning.** This PR inspects tracked repo docs/source to
  reconcile intent vs. behaviour; it changes nothing.
- It does **not** inspect or print raw secrets.
- It does **not** read or print `.env.production` values.
- It does **not** run psql/SQL.
- It does **not** connect to the database.
- It does **not** mutate `.env.production`.
- It does **not** create or change any env vars.
- It does **not** run Stage 0 or Step 2E.
- It does **not** perform any remediation.

---

## 2. Inspection Findings (tracked repo docs/source only; no secrets read)

> Method: read-only inspection of tracked docs and source. No `.env.production` value
> was read or printed; only **env-var names**, **role/database names**, and
> **doc/code citations** are recorded (all already non-secret in tracked files).

**Q1 — What did PR #199 actually record?**
The registry (`docs/ops/buyerrecon-production-environment-runtime-registry.md`)
**does document a Stage 0 runner-specific connection contract**: it names the
dedicated role `buyerrecon_stage0_runner`
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:60`) against database
`buyerrecon_production`, with a placeholder DSN template
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:77-78`) and custody
rules holding password/host/port as **placeholders only**
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:74,79-86`: §5 header,
password custody, host/port custody, "assemble the full DSN outside repo/logs"). It
**explicitly forbids** using the `.env.production` collector DSN directly and forbids
the `buyerrecon_prod_collector_app` role as the Stage 0 DSN
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:87-91`).

**Q2 — Did PR #199 define a runner-specific Stage 0 connection source?**
**Yes, as a documented contract** (role + database + custody rules:
`docs/ops/buyerrecon-production-environment-runtime-registry.md:60,74-91`). It is a
**documentation/custody contract**, not a wired runtime binding.

**Q3 — Did PR #199 only define production/runtime/app/collector source names?**
**No** — it goes beyond app/collector registry by naming the dedicated runner role and
its custody rules
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:60,74-91`). (So this
is **not** `registry_only_no_runner_binding`.)

**Q4 — What env-var names do current scripts/docs expect for the Stage 0 runner?**
The **Stage 0 worker code reads only `DATABASE_URL`**: `scripts/run-stage0-worker.ts:6`
(header comment "DATABASE_URL required; never printed");
`src/scoring/stage0/run-stage0-worker.ts:175` (`const databaseUrl = env.DATABASE_URL;`)
and `src/scoring/stage0/run-stage0-worker.ts:177` (throws "DATABASE_URL is required").
The worker does **not** read any runner-specific env (its other reads at
`src/scoring/stage0/run-stage0-worker.ts:180-216` are `WORKSPACE_ID` / `SITE_ID` /
`UNTIL` / `SINCE` / `SINCE_HOURS` / `STAGE0_VERSION`). `extract-stage0-inputs.ts` reads
no env directly (it takes a pool from the caller). The shared pool helper reads
`DATABASE_URL` at `src/db/client.ts:6` (`connectionString: process.env.DATABASE_URL`).

**Q5 — Is there a documented `STAGE0_RUNNER_DSN` or equivalent?**
**In docs only, not in worker code.** The PR #198-style psql gate diagnostic plan
**assembles `STAGE0_RUNNER_DSN` in-memory** from an `APPROVED_DB_SOURCE` custody
pointer for the diagnostic (`docs/sprint3-stage0-psql-gate-diagnostic-plan.md:8` names
`STAGE0_RUNNER_DSN`; `:76,78` derive host/port and assemble "in memory only … never
printed"; `:108-115` source from `APPROVED_DB_SOURCE`; `:124-125` assemble then unset
components), and never stores it as a runtime env var. The Stage 0 **worker** has
**no** `STAGE0_RUNNER_DSN` wiring (Q4: it reads `DATABASE_URL` only).

**Q6 — Current safe source-selection order in the diagnostic command/spec?**
The **diagnostic spec** sources from `APPROVED_DB_SOURCE`
(`docs/sprint3-stage0-psql-gate-diagnostic-plan.md:108-109`) and **fails closed (no
fallback to `DATABASE_URL`)** if that custody source / its components are absent
(`docs/sprint3-stage0-psql-gate-diagnostic-plan.md:114-115`, stop-lines with `exit 3`).
The **worker**, by contrast, has no such selection — it reads `DATABASE_URL` as its
only source (`src/scoring/stage0/run-stage0-worker.ts:175,177`; `src/db/client.ts:6`).

**Q7 — Does the current path fall back to `DATABASE_URL` when the runner-specific
source is absent?**
For the **diagnostic spec: no** (documented fail-closed, no fallback —
`docs/sprint3-stage0-psql-gate-diagnostic-plan.md:114-115`). For the **Stage 0 worker:
effectively yes / worse** — there is **no runner-specific source wired at all**, so the
worker's only source is `DATABASE_URL` (`src/scoring/stage0/run-stage0-worker.ts:175`;
`src/db/client.ts:6`), which is the **collector** category. Tracked evidence associates
`DATABASE_URL` / the operator's `APP_DSN` with `buyerrecon_prod_collector_app`
(`docs/sprint3-stage0-execution-identity-dsn-resolution-plan.md:49`
[`current_user=buyerrecon_prod_collector_app`], `:76`, `:161`, and the
`DATABASE_URL="$APP_DSN" npm run stage0:run` example at `:217`), the **collector
runtime role** (`docs/ops/cutover-hard-gates.md:111`) — **not**
`buyerrecon_stage0_runner` — which the registry explicitly forbids for Stage 0
(`docs/ops/buyerrecon-production-environment-runtime-registry.md:87-91`).

### 2.1 Exact Citations (verified against current repo line numbers)

> Line numbers verified by `grep -n` on the current checkout of branch
> `buyerrecon-sprint3-stage0-auth-credential-step2f-stageb-pr199-runtime-binding-reconciliation-plan`.
> Not reproduced from memory.

| Claim | Citation(s) |
|---|---|
| PR #199 documents a runner-specific Stage 0 connection contract / custody (dedicated role `buyerrecon_stage0_runner`, db `buyerrecon_production`, placeholder DSN template, custody rules, collector-DSN/role forbidden) | `docs/ops/buyerrecon-production-environment-runtime-registry.md:60`, `:74`, `:77-78`, `:79-86`, `:87-91` |
| `STAGE0_RUNNER_DSN` is the documented runner connection env name | `docs/sprint3-stage0-psql-gate-diagnostic-plan.md:8`, `:124` |
| PR #198-style psql gate diagnostic assembles `STAGE0_RUNNER_DSN` **in memory** / never prints raw secrets (hidden input, in-memory assembly, chmod-600 temp) | `docs/sprint3-stage0-psql-gate-diagnostic-plan.md:76`, `:78`, `:108-109`, `:118`, `:124-125`, `:158-159`, `:381-382` |
| Diagnostic fails closed with **no fallback to `DATABASE_URL`** if the approved source/components are absent | `docs/sprint3-stage0-psql-gate-diagnostic-plan.md:114-115` |
| Current Stage 0 worker / shared pool source path reads `DATABASE_URL` (no runner-specific env) | `scripts/run-stage0-worker.ts:6`; `src/scoring/stage0/run-stage0-worker.ts:175`, `:177`; `src/db/client.ts:6` |
| `extract-stage0-inputs.ts` reads no env directly (pool passed by caller) | `src/scoring/stage0/extract-stage0-inputs.ts` (no `process.env` / `DATABASE_URL` reads) |
| Current worker source-selection depends on `DATABASE_URL`, which is the **collector** category (`buyerrecon_prod_collector_app`), not a proven runner-specific runtime binding | `src/scoring/stage0/run-stage0-worker.ts:175`; `src/db/client.ts:6`; `docs/sprint3-stage0-execution-identity-dsn-resolution-plan.md:49`, `:76`, `:161`, `:217`; `docs/ops/cutover-hard-gates.md:111` |

---

## 3. Explicit Distinctions (intent vs. behaviour)

- **Registry documentation** — PR #199 §5: documents the runner role + custody rules
  (intent). ✔ present.
- **Secret custody** — password-manager / server-side hidden assembly; never in repo
  (intent). ✔ documented; not proven bound in production by this inspection.
- **Runtime app DSN** — `DATABASE_URL` read by the shared pool / app runtime.
- **Collector DSN** — `.env.production` collector DSN → `buyerrecon_prod_collector_app`.
- **Stage 0 runner execution identity** — the dedicated role `buyerrecon_stage0_runner`
  (intended Stage 0 identity).
- **Stage 0 runner connection-source binding** — the wiring that would make the Stage 0
  worker/diagnostic actually authenticate **as** `buyerrecon_stage0_runner`. **This is
  the gap:** documented in the registry/diagnostic plan, but the worker reads
  `DATABASE_URL` (collector category), consistent with Stage B's
  `user_category_unexpected`.

---

## 4. Reconciliation (why Step 2F Stage B saw app/collector)

The Step 2F Stage B finding (`connection_source_category=database_url`,
`user_expected_category=app_or_collector`) is **consistent with** the inspection: the
operative Stage 0 connection source resolves to `DATABASE_URL`, which is bound to the
**collector** category role, **not** the dedicated `buyerrecon_stage0_runner`. This is a
**strong candidate explanation** for why the Step 2D runner-password rotation (PR #225)
did **not** clear the Step 2E gate (PR #226): if the operative path authenticates as the
collector identity, rotating the **runner** password cannot change that path's auth
outcome. This remains a **binding/contract reconciliation finding** — it does **not**
prove the exact raw PostgreSQL error and does **not** itself remediate anything.

---

## 5. Candidate Safe Labels

```text
pr199_runtime_binding_reconciliation_attempted=true
pr199_inspected=true
pr199_contains_runner_specific_connection_contract=true
pr199_contains_only_runtime_or_app_registry=false
stage0_runner_connection_env_name_documented=true
stage0_runner_connection_env_name=STAGE0_RUNNER_DSN
current_source_selection_falls_back_to_database_url=true
database_url_is_app_or_collector_category=true
raw_secret_values_printed=false
env_production_values_printed=false
psql_sql_invoked=false
stage0_executed=false
reconciliation_result=runner_binding_documented_but_not_proven_present
```

> Note on `stage0_runner_connection_env_name=STAGE0_RUNNER_DSN`: this is the
> **documented** runner-specific connection name (assembled in-memory by the diagnostic
> plan from `APPROVED_DB_SOURCE`). The **Stage 0 worker code does not read it** — the
> worker reads `DATABASE_URL` only. `current_source_selection_falls_back_to_database_url=true`
> records the **worker** path (its only source is `DATABASE_URL`); the **diagnostic
> spec** itself is documented fail-closed with no fallback.

---

## 6. Allowlisted Result Values

```text
runner_binding_missing
runner_binding_documented_but_not_proven_present
runner_binding_present_in_docs
registry_only_no_runner_binding
blocked_insufficient_repo_evidence
```

**Selected: `runner_binding_documented_but_not_proven_present`** — the registry/diagnostic
plan document a runner-specific contract and a `STAGE0_RUNNER_DSN` in-memory assembly,
but the Stage 0 worker reads only `DATABASE_URL` (collector category) and no production
runner binding is proven present by this inspection.

---

## 7. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any DSN / password / token / host / port / IP / URI would be printed;
- any `.env.production` value would be printed;
- any raw secret would be inspected or copied;
- psql / SQL would run;
- Stage 0 would run;
- any env var would be changed;
- any remediation would be attempted.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 8. Next-Step Framing (no remediation authorized by this PR)

- Given the finding **`runner_binding_documented_but_not_proven_present`** with the
  worker reading `DATABASE_URL` (collector category):
  - **If the runner binding is missing in the operative path** (as indicated): the next
    PR should be a **Stage 0 runner connection-source contract / remediation plan** —
    wiring the Stage 0 worker/diagnostic to authenticate **as**
    `buyerrecon_stage0_runner` (e.g. a runner-specific connection env / source-selection
    that does **not** resolve to the collector `DATABASE_URL`), secret-safe and
    fail-closed.
  - **If a runner binding exists in docs but is absent in production:** the next PR
    should be a **safe production binding proof/plan** (confirm, via safe labels, that
    the operative Stage 0 path authenticates as the runner before any Stage 0).
  - **If the source-selection fallback is wrong:** the next PR should **fix/plan the
    source-selection order** so the Stage 0 path never falls back to the collector
    `DATABASE_URL`.
- **No remediation is authorized by this PR.** Any change to connection source, env
  binding, runner DSN, command-pack, source-selection order, or Stage 0 execution
  requires its **own Codex review and a fresh explicit Helen GO**.
- **Stage 0 execution remains separately GO-gated.**

---

## 9. Explicit Non-Authorization

**Merging this inspection/planning PR does not authorize** any env change, any
`.env.production` mutation, any runner-DSN creation/binding, any source-selection code
change, any diagnostic, any password reset/rotation, any Step 2E rerun, or Stage 0.
**Any remediation requires its own docs-only plan, Codex review, and a fresh explicit
Helen GO.** **Stage 0 execution remains separately GO-gated.**

---

## 10. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. The inspection read
**tracked repo docs/source only** — recording **env-var names**, **role/database names**,
and **doc/code citations** that are already non-secret in tracked files; **no
`.env.production` value was read or printed** and **no database connection was made**.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans /
categories / env-var names / role / database names / public references — not secret or
row values.
