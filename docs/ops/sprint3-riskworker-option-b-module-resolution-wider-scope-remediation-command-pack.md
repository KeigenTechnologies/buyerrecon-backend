# Sprint 3 — Riskworker Option B — Module Resolution Wider/Different-Scope Remediation: Planning Command-Pack

## Classification

- **Type:** Command pack (planning only).
- **Authorizes execution:** No.
- **Model:** Model B — exact wider/different-scope source/config file names are
  **deferred** and must be named in a future exact scoped GO before any
  inspection or patch.

This document plans a possible **next** remediation strategy for the Riskworker
Option B `module_resolution_surface` after the fail-closed outcome recorded in
the merged blocked-evidence record (PR #413). It defines strategy, inspection
boundaries, allowed-file model, forbidden outputs, validation limits, stop
labels, and exact-GO requirements. **It changes no source, config, or package
file and authorizes no action of any kind.**

## Prior state (context, not an authorization)

- The narrow named-file remediation attempt was executed **exactly once** under
  the PR #412 command-pack and **failed closed** (PR #413 blocked evidence):
  `remediation_status=fail_closed`, `selected_patch_family=none`,
  `safe_patch_selected=false`, `changed_file_count=0`.
- The expected import/export boundary patch pattern was **not present** within
  the previously allowed patch scope.
- `module_resolution_surface` remains a **safe surface label only** — not a
  root-cause inference.
- Gate D/E remain `blocked_where_dependent`.

## Why a wider/different scope may be warranted

The narrow patch scope (`scripts/run-risk-evidence-worker.ts`,
`src/scoring/risk-evidence/worker.ts`) yielded no safe boundary edit. A future
attempt may need a **different or wider** but still explicitly named file scope.
This command-pack does **not** select that scope; it defines how such a scope
would be proposed, bounded, and validated under a separate exact GO.

## Next remediation strategy (planned, not executed)

1. Begin from a fresh base that includes the merged PR #413 blocked-evidence
   commit.
2. Under a separate exact scoped GO, name an explicit, minimal inspection-file
   set and an explicit, minimal patch-file set (see "Allowed-file model").
3. Perform **aggregate-only** boundary analysis: count import/export
   specifiers, resolution targets, and contract mentions. No raw output, no
   excerpts.
4. Select at most one deterministic, reversible boundary patch family only if
   the aggregate signal clearly supports it; otherwise stop fail-closed.
5. Record a new blocked-evidence or applied-evidence doc using safe aggregate
   fields only. Any actual patch requires its own explicit patch permission.

## Inspection boundaries

- Inspection is limited to the files **explicitly named** in the future exact
  GO. No traversal outside the named set.
- Read for **aggregate structure only** (counts, presence booleans). Do not read
  for, retain, or emit file contents.
- No build artifacts, generated files, logs, evidence stores, or custody stores
  are in scope for inspection.
- No runtime, worker, classifier, DB, network, or SQL surface is inspected.

## Allowed-file model (deferred — Model B)

- Exact wider/different-scope inspection and patch file names are **not fixed
  here**. They must be enumerated in the future exact GO.
- Candidate categories that a future GO **may** name (illustrative only; naming
  here confers no permission):
  - one module-resolution config surface (e.g. a tsconfig-family or
    package-manifest field surface),
  - one runner entrypoint surface,
  - one worker module-boundary surface,
  - one build-parity contract/check surface (inspection-only unless explicitly
    named as patchable).
- The future GO must separately list:
  - `exact_allowed_inspection_files` (named),
  - `exact_allowed_patch_files` (named, a subset of inspection files),
  - and an explicit statement that files not named are out of scope.

## Forbidden outputs (hard limits)

The following must never be inspected, printed, recorded, or committed under this
plan or any GO derived from it:

- raw build output, raw parity output, raw runtime output,
- exact error strings, stack traces,
- source excerpts, dependency file contents,
- secrets, DSNs, hosts, private file paths, base64 blobs,
- evidence paths, custody paths,
- generated artifacts, customer data, customer output.

Only **safe aggregate counts, presence booleans, and surface labels** may be
recorded.

## Validation limits

Allowed validation only:

- `git status`, `git diff --check`, file-list inspection, and static guardrails,
- **only** where they do not build, run, touch runtime/server/DB/network/SQL, or
  inspect any forbidden raw output.

Explicitly not permitted as validation: build invocation, parity proof,
compiled run, worker/classifier/record-only rerun, higher-disclosure diagnostic
rerun.

## Stop labels

A future attempt must stop and record fail-closed under any of:

- `wider_remediation_no_named_go` — no separate exact scoped GO provided.
- `wider_remediation_scope_not_named` — inspection/patch files not explicitly
  named.
- `wider_remediation_no_safe_patch_selected` — aggregate signal does not support
  a safe deterministic patch family.
- `wider_remediation_forbidden_output_required` — proceeding would require
  inspecting/printing any forbidden output.
- `wider_remediation_build_or_parity_required_unauthorized` — a safe patch could
  not be validated without unauthorized build/parity.
- `wider_remediation_scope_exceeds_named_files` — analysis would require files
  outside the named set.

On any stop label: change zero files, infer no root cause, keep
`module_resolution_surface` a surface label only, and leave Gate D/E
`blocked_where_dependent`.

## Exact-GO requirements (all mandatory before any inspection or patch)

1. This wider-scope command-pack reviewed and merged.
2. A separate **exact scoped GO** for the wider/different scope.
3. `exact_allowed_inspection_files` named.
4. `exact_allowed_patch_files` named.
5. Explicit patch permission.
6. Explicit build/parity authorization status if applicable
   (`build_authorized`, `parity_authorized`), defaulting to `false`.
7. Raw-output inspection remains forbidden.
8. Safe output only.

## Authorization boundary (what this PR does NOT do)

This PR authorizes **no**:

- source/config/package/patch change,
- build, parity proof, compiled run,
- runtime or server touch,
- worker rerun, classifier rerun, record-only rerun,
- higher-disclosure diagnostic rerun, Step B/C rerun, remediation rerun,
- DB/network/SQL action,
- production or customer-output/scoring/downstream action,
- Gate D/E movement.

## Gate status

- `gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`
- This document records planning only. `module_resolution_surface` remains a
  safe surface label, not a root-cause inference.
