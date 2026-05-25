# ProductContextProfile v0.1 Configuration Contract

Status: CONTRACT LOCKED - docs-only.

This file locks the BuyerRecon / AMS ProductContextProfile v0.1
configuration model. It is an upstream configuration contract for
future Sprint 3 report surfaces, Sprint 4 governance/runtime planning,
and Sprint 5 internal learning/knob governance. It does not implement
runtime code, schema, database writes, ThinSDK API changes, AMS source,
endpoint configuration, customer output, scoring runtime, Lane writer,
AMS Trust / Pass runtime, or Gate 4C action.

## 1. Position In The Evidence Chain

The ProductContextProfile sits after durable evidence extraction and
before downstream fit observations, scoring, lanes, and reports.

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

Layer meanings:

| Layer | Meaning | Question answered |
| --- | --- | --- |
| `accepted_events` / `ingest_requests` | Collector ledger and accepted event record | Was the event received, authenticated, accepted, or rejected? |
| `session_features` | Basic session facts | What happened? |
| `session_behavioural_features` | Factual behaviour-pattern evidence | What pattern appeared? |
| Stage 0 exclusions | Record-only exclusion for obvious bad traffic from buyer scoring | Should this evidence be excluded from buyer-oriented scoring paths? |
| POI + Series behaviour | Durable product-observation and sequence evidence | Which meaningful surfaces and sequences appeared? |
| ProductContextProfile | Versioned configuration wrapper | How should this site and category be interpreted? |
| Product-Context Fit observation | Internal observation produced using profile + evidence versions | How does observed behaviour map to product-context semantics? |
| Downstream scoring / lanes / reports | Consumers only | What internal preview, lane, or report contract consumes the observation? |

Important boundary:

- `session_features` is not a product configuration source. It records
  basic facts.
- `session_behavioural_features` is not a product configuration source.
  It records factual behaviour patterns.
- Stage 0 is an exclusion layer, not a buyer scoring result.
- `scoring_output_lane_a` and `scoring_output_lane_b` are downstream
  classification/output tables. They are not ProductContextProfile
  configuration sources.

## 2. Long-Term Configuration Model

The long-term configuration sequence is locked as:

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

Meaning:

- Universal taxonomy defines product-surface semantics shared across
  categories.
- Category template v0.1 selects a reusable category pattern, such as
  B2B software, service agency, or high-ticket exporter.
- Buying-role lens v0.1 cuts across all categories and describes
  likely evaluation role evidence without making identity claims.
- Customer site mapping v0.1 translates customer-specific routes and
  labels into BuyerRecon standard semantics.
- ProductContextProfile v0.1 wraps the selected template, mapping,
  conversion goal, sales motion, lens versions, and effective dates.
- POI + Series behaviour supplies durable observed evidence.
- Product-Context Fit observation records the internal observation with
  exact versions.
- Human / outcome feedback produces cases and recurring patterns.
- Template / mapping v0.2 is created only after replay and shadow
  testing.

## 3. Cross-Cutting Dimensions

### 3.1 Buying-Role Lens

The buying-role lens cuts across all industry/category templates.

Required role families:

- `economic_buyer`
- `technical_evaluator`
- `risk_compliance_reviewer`
- `procurement_logistics`
- `operator_user`
- `unknown_or_ambiguous`

Possible wording aliases:

- technology / technical evaluator
- finance / procurement / commercial evaluator
- operations / user champion
- executive / economic buyer
- compliance / legal / security reviewer
- agency / partner

Hard rule:

Visitor role is evidence/category input, not a final identity claim.

Allowed wording:

```text
behaviour consistent with finance/procurement evaluation
```

Forbidden wording:

```text
this visitor is the CFO
```

### 3.2 Site Mapping / Site Expression Layer

The site mapping layer is a semantic adapter. It is not part of the
industry/category tree. It translates customer-specific routes, labels,
and site expressions into standard BuyerRecon semantics.

Examples:

| Customer route or expression | BuyerRecon semantic |
| --- | --- |
| `/customer-success` | `proof_validation` |
| `/work-with-us` | `conversion_action` |
| `/technical-specs` | `technical_evaluation` |
| `/export-services` | `logistics_validation` |
| `/pricing` | `commercial_evaluation` |
| `/demo` | `conversion_action` |
| `/security` | `risk_validation` |
| `/careers` | `excluded_low_intent` |

The site mapping layer can be customer-specific. The universal taxonomy
and category template must remain reusable.

## 4. ProductContextProfile v0.1 Fields

ProductContextProfile v0.1 is the outer configuration wrapper.

Required fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `product_context_profile_id` | yes | Stable profile identity |
| `product_context_profile_version` | yes | Version of this profile instance |
| `category_template` | yes | Selected reusable category template |
| `category_template_version` | yes | Version of the category template |
| `primary_conversion_goal` | yes | Primary business conversion goal |
| `sales_motion` | yes | Sales motion such as sales-led or self-serve |
| `site_mapping` | yes | Route/expression to standard semantics mapping |
| `site_mapping_version` | yes | Version of the site mapping |
| `excluded_mapping` | yes | Route/expression exclusions |
| `role_lens_enabled` | yes | Enabled buying-role lens families |
| `buying_role_lens_version` | yes | Version of buying-role lens semantics |
| `universal_surface_taxonomy_version` | yes | Version of universal taxonomy |
| `product_fit_rule_version` | yes | Rule version for fit observation |
| `active_from` | yes | Effective start timestamp or date |
| `active_to` | yes, nullable | Effective end timestamp or date |
| `superseded_by` | yes, nullable | Replacement profile version |
| `status` | yes | `draft`, `shadow`, `active`, or `deprecated` |
| `owner` | yes | Owning person or team |
| `approver` | yes, nullable until active | Approval owner for activation |

### 4.1 Example YAML

```yaml
product_context_profile_id: acme-product-context
product_context_profile_version: acme-product-context-v0.4
category_template: b2b_software_v0.1
category_template_version: b2b_software_v0.1
primary_conversion_goal: demo_request
sales_motion: sales_led

universal_surface_taxonomy_version: universal_surface_taxonomy_v0.1
buying_role_lens_version: buying_role_lens_v0.1
product_fit_rule_version: product_fit_rules_v0.1

site_mapping_version: site_mapping_acme_v0.2
site_mapping:
  "/pricing": commercial_evaluation
  "/demo": conversion_action
  "/security": risk_validation

excluded_mapping:
  "/careers": excluded_low_intent

role_lens_enabled:
  - economic_buyer
  - technical_evaluator
  - risk_compliance_reviewer

active_from: 2026-05-25
active_to: null
superseded_by: null
status: active
owner: product-context-owner
approver: helen
```

## 5. Versioning Requirements

Every production Product-Context Fit observation must record the exact
versions used.

Required version fields:

- `universal_surface_taxonomy_version`
- `buying_role_lens_version`
- `category_template_version`
- `site_mapping_version`
- `product_context_profile_version`
- `product_fit_model_version`
- `product_fit_rule_version`

`product_fit_model_version` is intentionally recorded at
observation/evaluation time rather than as a static
ProductContextProfile wrapper field, because the same
ProductContextProfile may be replayed or shadow-evaluated under
different product-fit model versions.

Purpose:

- replay
- explainability
- comparison
- rollback
- audit

Example:

If `/solutions` was mapped to `education_research` in v0.1 and to
`commercial_evaluation` in v0.2, old observations must remain
explainable under v0.1. They must not be silently rewritten.

## 6. Feedback Loop And Template Evolution

Template and mapping evolution is locked as:

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

For `b2b_service_agency_v0.1`:

```yaml
site_mapping_examples:
  "/team": brand_trust
  "/process": proof_validation
  "/about-founder": brand_trust
```

Only promote to v0.2 after replay testing. A recurring pattern is
necessary but not sufficient. The replay test and shadow run must be
recorded before activation.

## 7. Anti-Patterns / Forbidden Design

The following are forbidden:

- customer-private scoring code
- customer-private if/else logic
- customer-private model
- hardcoding customer-specific semantics into ThinSDK
- hardcoding BuyerRecon product-owned meanings into shared AMS core
- turning visitor-role evidence into identity claims
- silent mutation of old observations after template updates

Correct model:

```text
customer A = b2b_software_v0.1 + site_mapping_A_v0.2
customer B = b2b_service_agency_v0.1 + site_mapping_B_v0.1
customer C = high_ticket_exporter_v0.1 + site_mapping_C_v0.3
```

Customers differ through:

- template selection
- site mapping
- primary conversion goal
- small configuration overrides

Customers do not differ through:

- private scoring code
- private if/else
- private custom model

## 8. AMS / ThinSDK Public API Implication

This contract does not implement a new ThinSDK API.

It defines the configuration model that any future AMS / ThinSDK public
API must respect:

- ThinSDK should collect standardized events and configuration keys.
- AMS / BuyerRecon product adapters should interpret those events and
  keys through ProductContextProfile.
- ThinSDK must not become a random analytics SDK.
- Product-owned meanings belong in ProductContextProfile, not in
  shared AMS core.
- Customer-specific site expressions belong in site mapping, not in
  ThinSDK runtime code.

## 9. Relationship To Current PRs

This contract is an upstream dependency before further activation work.

It explicitly does not:

- modify PR#20 / PR#21 / PR#22
- activate report surfaces
- activate governance runtime
- activate internal learning
- activate scoring runtime
- activate Lane writers
- activate AMS Trust / Pass runtime
- approve Gate 4C action
- change endpoint configuration
- change ThinSDK runtime behaviour
- change AMS source
- change website artifacts

PR#20 / PR#21 / PR#22 may reference this contract in future work, but
that later work remains separately gated.

## 10. Validation And Review Checklist

This contract is acceptable only if:

- the PR is docs-only
- exactly the contract and lock-record docs change
- no code, tests, package files, migrations, schema, DB scripts,
  website files, AMS source files, ThinSDK runtime, endpoint config,
  deploy/runtime config, customer output, scoring runtime, Lane writer,
  AMS Trust / Pass runtime, Gate 4C action, or PR#20 / PR#21 / PR#22
  runtime activation is introduced
- all required ProductContextProfile fields are present
- all required version fields are present
- the buying-role lens keeps role evidence separate from identity claims
- site mapping is treated as a semantic adapter
- old observations are not silently mutated after template updates
- the feedback loop requires replay and shadow run before active version
- the forbidden customer-private design paths remain forbidden

End of ProductContextProfile v0.1 configuration contract.
