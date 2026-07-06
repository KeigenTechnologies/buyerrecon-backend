# Sprint 3.5 — Static Guardrail Bundle CI (Planning-Only)

**Status:** `SPRINT3_5_STATIC_GUARDRAIL_BUNDLE_CI_PLANNING_ONLY`

## 1. Scope

This is a **docs-only planning record**. It plans adding **GitHub Actions CI** that runs the
existing **static guardrail bundle** on pull requests. **No workflow is implemented in this PR**,
no source/package/script changes, no runtime, and no branch-protection change. Planning only.

**Base:** `sprint2-architecture-contracts-d4cc2bf` @ `e67dc1bccc8a0a6815d46c89cd8ded31a8e7ec89`.

**Risk-worker sealed state (preserved, not inferred):**

```text
diagnostic_category (broad, PR #350) = runtime_dependency_or_build_failure   [unchanged]
final subclassifier retry result     = blocked / none_not_classified          [unchanged]
likely_failure_surface               = unknown                                [unchanged]
runtime_cause_exact_line             = unknown
```

---

## 2. Current State

- The **static guardrail bundle** exists as local npm scripts (Phase B set + Phase C1 scaffold check).
- All checks are **L1 / static / no-runtime**: `git ls-files` + `git grep` text scans; no DB, no
  network, no secrets, no app boot, no worker, no customer output, no Gate.
- **Current validation is local/manual** — each PR runs the bundle by hand in the local workflow.
- **No CI implementation exists in this PR** (this document is planning only).

---

## 3. Enforcement Tier Definitions (L1 / L2 / L3)

- **L1 — static / no-runtime.** No DB, no network, no secrets, no app boot, no worker/classifier,
  no customer output, no Gate. The seven guardrails below are all L1. This is the ONLY tier the
  planned CI runs.
- **L2 — non-production integration.** Mocks / synthetic fixtures / a disposable test DB only; **no**
  production credentials, **no** production data, **no** production server, **no** private captures.
  Not in scope for this CI; planned separately later.
- **L3 — production / server / real DB / real credentials / worker / deploy / customer-output / Gate.**
  Requires its **own** separate planning PR and an **explicit GO**. Never run by this CI.

---

## 4. Target Future Workflow (implementation deferred)

A single GitHub Actions workflow under `.github/workflows/` that:

- triggers on **`pull_request`** targeting `sprint2-architecture-contracts-d4cc2bf`,
- **checks out** the repository,
- **sets up Node** (matching the repo toolchain),
- **installs dependencies** the existing safe, reproducible way — **`npm ci`** (a
  `package-lock.json` is present), no build/postinstall beyond what the repo already defines,
- **runs the seven static npm checks** (§5),
- uses **no secrets**, **no DB/network/runtime services**, **no server access**, **no app boot**,
  and generates **no customer-output / Gate action**.

The job is a pure L1 gate: green means all static guardrails passed; red means one failed.

---

## 5. Required CI Commands

```text
npm run check:constants
npm run check:static-boundaries
npm run check:pg-pool-construction
npm run check:observer-shape
npm run check:record-only-gate
npm run check:customer-output-boundary
npm run check:db-pool-factory-scaffold
```

All seven are L1 static scans. The workflow runs exactly this bundle — nothing broader.

> Install caveat (for the implementation PR to verify): `npm ci` runs the repo's install as-is. The
> guardrails themselves need only Node built-ins + `git` and do not require built native binaries;
> if any package postinstall is unnecessary for the checks, the implementation PR may scope the
> install accordingly — but must not add dependencies or change the lockfile without separate review.

---

## 6. Required-Status-Check Governance Step

- A GitHub Actions workflow **alone is advisory** — it shows red/green but does not block merges
  until branch protection marks it **required**.
- After the workflow implementation PR merges and the workflow **runs green once**, a **manual
  GitHub repo-settings action** is required: set the workflow/job as a **REQUIRED status check** for
  `sprint2-architecture-contracts-d4cc2bf`.
- This **repo-settings action is not part of any code PR** (it is a settings change in the GitHub UI/API).
- **Until branch protection is updated, CI is visible but not an enforced merge gate.**
- **Required-check activation needs separate human authorization** (it is not performed or authorized
  by this planning PR or by the future implementation PR).

---

## 7. Safety Constraints (for the future workflow)

```text
workflow must not define secrets
workflow must not read env secrets
workflow must not run DB/network tests
workflow must not run workers/classifiers/risk-evidence
workflow must not run deploy
workflow must not generate Lane/scoring/AMS/customer output
workflow must not execute Gate4E/Gate4F
workflow must not access private captures or run.err/run.safe.out
```

---

## 8. Implementation-PR Boundary (future)

- The future implementation PR may add **one** workflow file under `.github/workflows/`.
- **No** source/runtime behavior changes.
- **No** package dependency additions unless separately justified.
- **No** lockfile changes unless required and reviewed.
- **No** production credentials.
- **No** broad build/test expansion beyond the static guardrail bundle (the seven L1 checks only —
  not `npm run build`, `npm test`, `test:db:v1`, or any worker/DB path).

---

## 9. Why This Comes Before `check:no-runtime-imports`

- The existing **seven** checks should be **automatically enforced first**.
- Otherwise any new check (e.g. `check:no-runtime-imports`) still relies on **local/manual** execution
  and adds governance surface without an enforcement mechanism.
- **CI turns the guardrails into merge-visible red/green status.**
- **Branch protection turns red/green status into a real merge gate.**
- Sequencing CI + required-check first makes every subsequent guardrail enforce automatically the
  moment it is added to the bundle.

---

## 10. Future Follow-Ups (each its own PR / action)

1. Implement the GitHub Actions workflow (one file under `.github/workflows/`).
2. Manually enable the **required status check** in branch protection after the first green run
   (separate human authorization).
3. Add `check:no-runtime-imports` / an L1 declaration verifier **after** CI exists, folding it into
   the bundle so CI enforces it automatically.
4. Add an **L3 planning PR template**.
5. Add a **forbidden-action tier taxonomy** (L1/L2/L3 mapping of actions).
6. Plan an **L2 synthetic fixture / test environment** later (mocks / disposable test DB; no production).

---

## 11. Negative-Action Ledger (this PR)

```text
source_or_package_or_script_changed=false
workflow_implemented=false
runtime_command_executed=false
server_access=false
db_or_network_or_sql_psql=false
env_or_secret_read_or_edit=false
worker_or_classifier_or_risk_evidence_run=false
deploy=false
lane_scoring_ams_customer_output=false
gate4e_or_gate4f=false
private_capture_or_run_err_run_safe_out_access=false
phase_c_implementation_or_refactor=false
```

This PR adds exactly one docs file and performs only read-only static validation.

---

## 12. Safety / Raw-Data Boundary

This document contains no secrets, DSNs, connection strings, env values, private capture
paths/pointers, raw runtime output, exact error lines, stack traces, SQL results, DB/customer data,
base64 blobs, or generated customer output. All identifiers are public command names, workflow
concepts, status labels, and public git commit hashes. It is docs-only planning and authorizes no
workflow implementation, no branch-protection change, and no execution. The risk-worker sealed state
is preserved unchanged.
