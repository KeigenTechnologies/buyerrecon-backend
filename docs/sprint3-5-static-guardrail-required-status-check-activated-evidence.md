# Sprint 3.5 — Static Guardrail Required Status Check — Activation Evidence

**Status:** `SPRINT3_5_STATIC_GUARDRAIL_REQUIRED_STATUS_CHECK_ACTIVATED_EVIDENCE`

## 1. Scope

This is a **docs-only evidence record**. It records that a **human operator manually configured the
repository ruleset / branch protection** to make the `static-guardrails` GitHub Actions status check
**required** for the target branch. **This PR performs no repo-settings change**, changes no workflow
file, source, package script, or branch protection, and authorizes no runtime / refactor / DB /
customer-output / Gate action. The repo-settings action already happened **manually, outside git**;
this document records it (operator-attested).

**Base:** `sprint2-architecture-contracts-d4cc2bf` @ `55c56255f1c9e23a11a2e33efcc81d928f6cbd10`.

**Risk-worker sealed state (preserved, not inferred):**

```text
diagnostic_category (broad, PR #350) = runtime_dependency_or_build_failure   [unchanged]
final subclassifier retry result     = blocked / none_not_classified          [unchanged]
likely_failure_surface               = unknown                                [unchanged]
runtime_cause_exact_line             = unknown
```

---

## 2. Preconditions

- **PR #373 merged** — GitHub Actions static guardrail workflow added
  (merge commit `55c56255f1c9e23a11a2e33efcc81d928f6cbd10`).
- **Workflow file exists on base:** `.github/workflows/static-guardrails.yml`.
- **Status-check / job name:** `static-guardrails`.
- **Trigger:** `pull_request` targeting `sprint2-architecture-contracts-d4cc2bf`.
- **Previous state (before manual activation):** `static-guardrails` was **advisory** — visible
  red/green only; it did **not** block merges.

---

## 3. Manual Activation Evidence (operator-attested)

The following GitHub repository ruleset / branch-protection settings were configured by a human
operator and observed in the GitHub UI. They are recorded here as **operator-attested evidence**;
this PR did not read or modify repo settings via API.

```text
target_branch: sprint2-architecture-contracts-d4cc2bf
ruleset_enforcement_status: Active
required_status_check: static-guardrails
require_status_checks_to_pass: enabled
require_pull_request_before_merging: enabled (operator-confirmed)
block_force_pushes: enabled
restrict_deletions: enabled
bypass_list: empty (operator-confirmed)
```

Items marked **(operator-confirmed)** are recorded as attested by the operator; they were not
independently re-verified by this docs-only PR.

---

## 4. Result

- `static-guardrails` is now **intended to be a required merge gate** for
  `sprint2-architecture-contracts-d4cc2bf`.
- PRs targeting that branch **should require `static-guardrails` to pass before merge**.
- This **upgrades the guardrail bundle from advisory CI to an enforced merge gate**, subject to
  GitHub ruleset behavior and any operator-configured bypass (recorded as empty above).

---

## 5. Guardrail Bundle (enforced by the workflow)

The `static-guardrails` job runs exactly these seven L1 / static checks:

```text
npm run check:constants
npm run check:static-boundaries
npm run check:pg-pool-construction
npm run check:observer-shape
npm run check:record-only-gate
npm run check:customer-output-boundary
npm run check:db-pool-factory-scaffold
```

All seven are static `git ls-files` + `git grep` text scans — no DB, no network, no secrets, no app
boot, no worker, no customer output, no Gate.

---

## 6. What This Proves

- The repository **ruleset / branch protection was configured by a human operator**.
- **`static-guardrails` is selected as a required status check** for the target branch.
- **Ruleset enforcement is Active** for `sprint2-architecture-contracts-d4cc2bf` (operator-attested).

---

## 7. What This Does NOT Prove

- **No runtime behavior proof** — the checks are static; nothing was executed here.
- **No DB / network proof.**
- **No worker / classifier / risk-evidence proof.**
- **No customer-output / Gate proof.**
- **No L2 test environment** (mocks / fixtures / disposable test DB) exists yet.
- **No L3 production validation.**
- **No future PR has yet demonstrated merge blocking** after this activation, unless separately tested
  (see §11).

---

## 8. Negative-Action Ledger (this PR)

```text
workflow_changed=false
branch_protection_changed_by_this_pr=false
source_or_package_or_script_or_checker_changed=false
claude_md_changed=false
dependency_or_lockfile_changed=false
runtime_command_executed=false
server_access=false
db_or_network_or_sql_psql=false
env_or_secret_read_or_edit=false
worker_or_classifier_or_risk_evidence_run=false
deploy=false
lane_scoring_ams_customer_output=false
gate4e_or_gate4f=false
private_capture_access=false
refactor=false
phase_c_worker_migration=false
```

This PR adds exactly one docs file and performs only read-only static validation.

---

## 9. Next-Step Recommendation

1. Optionally create a **tiny test PR** later to verify the merge-blocking behavior directly (e.g. a
   trivial change that fails one guardrail), if desired.
2. **Do not start `check:no-runtime-imports`** until this evidence PR is reviewed / merged.
3. The **`CLAUDE.md` test-layering addition remains separate** and should **not** be included here; it
   belongs in its own dedicated PR.

---

## 10. Safety / Raw-Data Boundary

This document contains no secrets, DSNs, connection strings, env values, private capture
paths/pointers, raw runtime output, exact error lines, stack traces, SQL results, DB/customer data,
base64 blobs, or generated customer output. All identifiers are public command names, workflow /
ruleset concepts, status labels, and public git commit hashes. It is docs-only evidence: it makes no
repo-settings change, no branch-protection change, and no execution. The risk-worker sealed state is
preserved unchanged.
