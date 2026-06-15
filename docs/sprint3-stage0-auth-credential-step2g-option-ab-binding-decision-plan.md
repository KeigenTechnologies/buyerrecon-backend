# Sprint 3 — Stage 0 auth/credential Step 2G — Option A/B Runner-Source Binding Decision Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_AB_BINDING_DECISION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It compares **how Stage 0 should use
the S2 custody source** (`/etc/buyerrecon/stage0-runner.env`, key `STAGE0_RUNNER_DSN`,
present and correctly guarded per PR #247, value unverified by design) — **Option A
(runtime command-pack binding)** vs **Option B (code-level source-selection change)** —
and **recommends Option A as the smallest safe next planning branch (planning only, not
execution)**.

This PR **executes nothing** and **authorizes no binding / code change / auth gate**: no
Option A execution, no Option B code change, no runtime binding, no source-selection
change, no secret value read/print, no `.env.production` read/print, no DSN parsing, no
DB connection, no `psql`/SQL, no authentication gate, no Step 2E rerun, no Stage 0, no
run-lock touch, no runtime/downstream/Lane/scoring/AMS/customer action, **and no Option
A/B execution authorization**. No real DSN, password, token, host, port, IP, or URI
appears in this document.

> Provenance: PR #247 Step 2G S2 presence proof present
> (`609fa182a732961cf87c86a6dbe2d23d8dbe5c15`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_S2_PRESENCE_PROOF_PRESENT`); PR #246 S2
> creation applied (`7d71f309525a30cfe28e464c9697579c0daa4ecd`); PR #245 S2 command-pack
> plan (`dc5a6cfcc4227d2fb03df72b82dd4507bbbe7f6d`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`).

---

## 1. Evidence Carried Forward (PR #247)

- S2 file-based custody source **exists**: `/etc/buyerrecon/stage0-runner.env`.
- **Expected owner/permissions** present (`root:root`, `600`).
- Key **`STAGE0_RUNNER_DSN` present**.
- **Secret value remains unread and unverified by design.**
- Worker/source-selection **structurally still points to `DATABASE_URL` /
  `app_or_collector`** (PR #239/#229).
- **No runtime binding** has occurred; **no authentication/psql proof**; **no Step 2E
  rerun**; **no Stage 0**; **Option A/B remains unselected**.

---

## 2. Option A — Runtime Command-Pack Binding (analysis)

- **Shape:** use the existing S2 custody source **only for the future Stage 0 process
  invocation** — source/load the key into the Stage 0 invocation environment in a scoped
  way (e.g. binding the runner source into the Stage 0 process's connection at runtime),
  **without changing code**.
- **Persistence:** **no persistent source-selection code change.**
- **Review surface:** **smaller** (no code diff; a command-pack + evidence).
- **Pros:** can **prove binding/auth behaviour with no code change**; reversible; keeps
  Option B available if Option A proves unsafe/brittle/rejected.
- **Cons / care required:** the command-pack must be designed to **avoid value printing,
  logging, parsing, or leaking** (hidden load only; the value never transits a printable
  buffer / argv / log); runtime-discipline dependent.
- **Auth gate:** a **future auth/psql gate is still separately planned/reviewed/GO-gated
  before Stage 0** (the value is unverified by design).

---

## 3. Option B — Code-Level Source-Selection Change (analysis)

- **Shape:** modify the Stage 0 worker / source-selection to **read `STAGE0_RUNNER_DSN`
  directly**, **failing closed if missing** (instead of the ambient `DATABASE_URL`
  collector category).
- **Persistence:** a **real, persistent code change** to the source-selection path.
- **Review surface:** **larger** — it is a real code change requiring **tests,
  source-diff review, and a separate Codex review** before any execution.
- **Pros:** **cleaner long-term architecture**; structural guarantee that Stage 0 cannot
  silently use the collector `DATABASE_URL`; aligns the worker with the PR #199 /
  diagnostic-plan contract.
- **Cons:** larger blast radius and review burden; should not be undertaken before a
  cheaper proof (Option A) establishes the binding/auth behaviour, to avoid coding
  against an unverified assumption.
- **Auth gate:** a **future auth/psql gate is still separately planned/reviewed/GO-gated
  before Stage 0**.

---

## 4. Recommendation & Rationale

**Recommend Option A as the smallest safe next planning branch — planning only, not
execution** — because:
- the **S2 source exists but its value remains unverified** (PR #246/#247);
- **Option A can prove binding/auth behaviour with no code change** (smallest surface,
  reversible);
- **Option B should remain available** if Option A is unsafe, brittle, or rejected after
  proof.

This is a **recommended next planning branch, not an execution decision**: no binding or
code change is selected/authorized here, and Option B is explicitly kept open.

---

## 5. Risks & Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any **secret value** would print/read;
- any **DSN parsing** required before an auth-gate plan;
- any **`.env.production` value** read/print;
- any **DB / psql** before an auth-gate GO;
- any **runtime binding without command-pack review**;
- any **source-selection code change without an Option B PR**;
- any **Step 2E / Stage 0 / run-lock / runtime** action.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 6. Safe Labels

```text
option_ab_decision_planning_only=true
s2_custody_source_present=true
s2_secret_value_verified=false
option_a_runtime_binding_recommended=true
option_b_code_change_deferred=true
option_a_executed=false
option_b_executed=false
runtime_binding_authorized=false
source_selection_change_authorized=false
auth_psql_gate_authorized=false
step2e_rerun=false
stage0_executed=false
```

---

## 7. Future Gate Sequence

1. **Merge** this Option A/B decision planning PR (after Codex review).
2. Create an **Option A runtime-binding command-pack planning PR** (docs-only).
3. **Codex review.**
4. **Fresh explicit Helen GO** for an **Option A binding/auth preflight only**.
5. **Evidence PR.**
6. **Only then** decide whether **Step 2E / Stage 0** planning may continue (or whether
   to fall back to **Option B**, which would be its own separately-reviewed code-change
   PR with tests + source-diff + Codex review).

---

## 8. Non-Authorization

**Merging this plan authorizes:**
- **no** Option A execution;
- **no** Option B code change;
- **no** runtime binding;
- **no** source-selection change;
- **no** authentication/psql gate;
- **no** Step 2E rerun;
- **and no** Stage 0.

**Any Option A binding command-pack or Option B code change is a future,
separately-reviewed, separately GO-gated step.** **Stage 0 execution remains separately
GO-gated.**

---

## 9. Next Gated Step

1. **Codex review and merge** of this Option A/B decision planning PR.
2. **Option A runtime-binding command-pack planning PR** (docs-only; secret-safe;
   hidden-load only; no value print/parse) → Codex review → fresh explicit Helen GO for
   an Option A binding/auth preflight only → evidence PR.
3. **Only after** that evidence → decide whether Step 2E/Stage 0 planning continues, or
   fall back to **Option B** (separately-reviewed code change).
4. **Stage 0 execution remains separately GO-gated.**

---

## 10. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, generated secret, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or
customer data. This is a docs-only decision plan comparing Option A (runtime
command-pack binding) and Option B (code-level source-selection change); it **selects no
execution**, changes **no** code, performs **no** runtime binding, reads/prints **no**
value, parses **no** DSN, and makes **no** DB connection; the recommendation of Option A
is **planning only**, with Option B kept open. The custody **file path**
(`/etc/buyerrecon/stage0-runner.env`) and **key name** (`STAGE0_RUNNER_DSN`) are
non-secret identifiers; the secret value remains **unverified by design**. (Per the PR
#218 Codex note: "no secret used or exposed" is to be read as "no secret value exposed,
printed, or recorded.") All values above are safe labels / booleans / option names /
non-secret path & name identifiers / public git commit hashes — not secret or row
values.
