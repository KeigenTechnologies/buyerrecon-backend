# Sprint 3 ProductContextProfile Contract Lock

Status: CONTRACT_LOCK_ONLY - docs-only.

This PR locks `docs/contracts/product-context-profile-v0.1.md` as the
BuyerRecon / AMS ProductContextProfile v0.1 configuration contract.
It creates no runtime path and does not activate any Sprint 3, Sprint
4, or Sprint 5 surface.

## 1. Purpose

Later PR lines such as PR#20 / PR#21 / PR#22 discuss report surfaces,
governance/runtime, and internal learning. Before those paths can move
toward activation, BuyerRecon needs a durable upstream contract for the
ProductContextProfile configuration structure.

This PR locks that contract.

## 2. Files

| File | Purpose |
| --- | --- |
| `docs/contracts/product-context-profile-v0.1.md` | Durable v0.1 configuration contract |
| `docs/sprint3-product-context-profile-contract-lock.md` | Sprint lock record and boundary statement |

## 3. Locked Model

The contract locks the evidence chain position:

```text
accepted_events / ingest_requests
-> session_features
-> session_behavioural_features
-> Stage 0 exclusions
-> POI + Series behaviour
-> ProductContextProfile
-> Product-Context Fit observation
-> downstream scoring / lanes / reports
```

It also locks the long-term configuration sequence:

```text
Universal taxonomy
-> Category template v0.1
-> Buying-role lens v0.1
-> Customer site mapping v0.1
-> ProductContextProfile v0.1
-> POI + Series behaviour
-> Product-Context Fit observation
-> Human / outcome feedback
-> Template / mapping v0.2
```

## 4. Cross-Cutting Configuration Layers

The contract locks two cross-cutting layers.

### 4.1 Buying-role lens

Required role families:

- `economic_buyer`
- `technical_evaluator`
- `risk_compliance_reviewer`
- `procurement_logistics`
- `operator_user`
- `unknown_or_ambiguous`

Visitor role remains evidence/category input. It is not a final
identity claim.

Allowed wording:

```text
behaviour consistent with finance/procurement evaluation
```

Forbidden wording:

```text
this visitor is the CFO
```

### 4.2 Site mapping

Site mapping is a semantic adapter. It translates customer-specific
routes, labels, and expressions into BuyerRecon standard semantics.

Examples:

- `/customer-success` -> `proof_validation`
- `/work-with-us` -> `conversion_action`
- `/technical-specs` -> `technical_evaluation`
- `/export-services` -> `logistics_validation`
- `/pricing` -> `commercial_evaluation`
- `/demo` -> `conversion_action`
- `/security` -> `risk_validation`
- `/careers` -> `excluded_low_intent`

## 5. ProductContextProfile Fields Locked

The contract requires:

- `product_context_profile_id`
- `product_context_profile_version`
- `category_template`
- `category_template_version`
- `primary_conversion_goal`
- `sales_motion`
- `site_mapping`
- `site_mapping_version`
- `excluded_mapping`
- `role_lens_enabled`
- `buying_role_lens_version`
- `universal_surface_taxonomy_version`
- `product_fit_rule_version`
- `active_from`
- `active_to`
- `superseded_by`
- `status`
- `owner`
- `approver`

Allowed `status` values:

- `draft`
- `shadow`
- `active`
- `deprecated`

## 6. Versioning Lock

Every production Product-Context Fit observation must record:

- `universal_surface_taxonomy_version`
- `buying_role_lens_version`
- `category_template_version`
- `site_mapping_version`
- `product_context_profile_version`
- `product_fit_model_version`
- `product_fit_rule_version`

These fields are required for replay, explainability, comparison,
rollback, and audit.

Old observations must remain explainable under their original versions.
They must not be silently rewritten after a template or mapping update.

## 7. Feedback Loop Lock

The contract locks the template evolution path:

```text
real outcome / human review
-> case
-> FP/FN classification
-> recurring pattern
-> proposed template change
-> replay test
-> new template version
-> shadow run
-> active version
```

Promotion from v0.1 to v0.2 requires replay testing and shadow run
evidence.

## 8. Forbidden Design Paths

The contract forbids:

- customer-private scoring code
- customer-private if/else logic
- customer-private model
- hardcoding customer-specific semantics into ThinSDK
- hardcoding BuyerRecon product-owned meanings into shared AMS core
- turning visitor-role evidence into identity claims
- silent mutation of old observations after template updates

Correct differentiation between customers happens through template
selection, site mapping, primary conversion goal, and small
configuration overrides.

## 9. AMS / ThinSDK Boundary

This PR does not implement a new ThinSDK API.

The contract says future AMS / ThinSDK public APIs must respect the
ProductContextProfile model:

- ThinSDK collects standardized events and configuration keys.
- AMS / BuyerRecon product adapters interpret them through
  ProductContextProfile.
- ThinSDK must not become a random analytics SDK.

## 10. Relationship To PR#20 / PR#21 / PR#22

This PR does not modify PR#20 / PR#21 / PR#22.

It does not activate:

- report surfaces
- governance runtime
- internal learning
- report runtime
- scoring runtime
- Lane writers
- AMS Trust / Pass runtime
- Gate 4C action
- endpoint configuration
- ThinSDK runtime behaviour
- customer output

It should be treated as an upstream contract dependency before further
Sprint 3 / Sprint 4 / Sprint 5 activation.

## 11. Hard Scope Confirmation

This PR is docs-only.

It changes no:

- code
- tests
- package files
- migrations or schema
- DB scripts
- website files
- AMS source files
- ThinSDK runtime
- endpoint config
- deploy/runtime config
- customer output
- scoring runtime
- Lane writer
- AMS Trust / Pass runtime
- Gate 4C action
- PR#20 / PR#21 / PR#22 runtime activation

End of Sprint 3 ProductContextProfile contract lock.
