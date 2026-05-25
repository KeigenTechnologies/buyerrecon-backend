# Sprint 3 PR#20 — ProductContextProfile v0.1 report alignment note

Status: DOCS-ONLY ALIGNMENT NOTE. No code change. No report
activation. No customer output. No safe-claim change. No Lane
writer or scoring runtime change.

This note aligns the PR#20 external report MVP
(`src/reports/external/*`, `tests/v1/external-report/*`, merged via
#64) with the ProductContextProfile v0.1 contract
(`docs/contracts/product-context-profile-v0.1.md`, locked via PR #76,
merged at base `0f98967`). It records a forward requirement; it does
not implement it.

## 1. Current state

- PR#20 is a **locked-off** MVP scaffold. It does not activate
  production customer output, does not flip any PR#18ab §9 lock, and
  does not approve report auto-send.
- The report code already carries version IDs such as
  `score_version_id`, `rule_version_id`, `model_version_id`, and
  `knob_version_id` (see `src/reports/external/contracts.ts`).
- The report code already enforces safe-claim constraints
  (`src/reports/external/safe-claims.ts`: denylisted
  identity-style claims, `validateClaimBlock`, `sanitizeCustomerText`)
  and restates PR#18ab locks in rendered output
  (`src/reports/external/renderer.ts`).

## 2. Forward requirement (before any production activation)

Before any **production Product-Context Fit observation** or
**customer-facing report output** is activated, the report /
fit-observation contract must additionally carry the
ProductContextProfile §6 version stamps:

- `product_context_profile_version`
- `category_template_version`
- `site_mapping_version`
- `buying_role_lens_version`
- `universal_surface_taxonomy_version`
- `product_fit_model_version`
- `product_fit_rule_version`

These are required by the contract for replay, explainability,
comparison, rollback, and audit. `product_fit_model_version` is
observation/evaluation-level (per PR #76), not a static
ProductContextProfile wrapper field — the report must record the
model version used at observation time, not assume a profile-fixed
value.

## 3. Boundary

- This patch is **docs-only**. It does **not** change
  `src/reports/external/contracts.ts` or any other code.
- The PCP-specific version-stamp fields are a **code-impacting**
  change deferred to a separate, separately-approved pre-activation
  PR (its own Helen GO + Codex review).
- This note does **not** activate reports, does **not** authorize
  customer output, does **not** alter safe claims, and does **not**
  change Lane writers or scoring runtime.
