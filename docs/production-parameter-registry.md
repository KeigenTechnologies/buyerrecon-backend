# BuyerRecon — Production Parameter Registry (Executable Source-of-Truth + Execution Gate)

**Status:** `PRODUCTION_PARAMETER_REGISTRY_SEED_AND_EXECUTION_GATE_PLANNING_ONLY`

This is a **docs-only** record that establishes the **canonical, executable Production
Parameter Registry**: a machine-readable source-of-truth index for production-critical
parameters that future PRs must amend and future production command-packs must gate against
(fail closed) before execution. It is **seeded by PR #199** and applies immediately to the
blocked Stage 0 RB-ROTATE work.

This PR **executes nothing** and **authorizes no** production execution, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants,
schema/data changes, source-selection change, Option B code change, remediation, downstream
runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. It contains **no** raw
passwords, raw DSNs, raw tokens, private keys, raw `.env.production` values, raw connection
strings, host/port values, customer payloads, or PII.

> **Relationship to the existing PR #199 doc.** A *narrative* production registry already
> exists at `docs/ops/buyerrecon-production-environment-runtime-registry.md` (PR #199,
> merge `193cdc96bfabe9893b330910b36cf681db77a20a`). That doc is human-readable but **not
> machine-parseable** and is **not** an execution gate. This new document is the **canonical
> executable registry**: it carries the machine-readable
> `buyerrecon-production-parameter-registry-v1` block and the command-pack gate contract,
> and it **points back to PR #199 (and later PRs) as the source of truth** for each
> parameter. The PR #199 narrative doc remains a valid seed/reference; this file is the
> enforceable index. Exactly one new docs file is added.

---

## 1. Registry Purpose

- This registry is the **canonical source-of-truth index** for production-critical
  parameters.
- **PR #199 is the historical seed** (`docs/ops/buyerrecon-production-environment-runtime-registry.md`,
  merge `193cdc96bfabe9893b330910b36cf681db77a20a`).
- Later PRs that **introduce, discover, correct, supersede, or deprecate**
  production-critical parameters **must amend this registry** (see §5).
- **Not valid production-parameter authority:** chat memory, assistant memory, Claude recap,
  operator recollection, server hostname, inferred defaults, old prompts, and **broken
  custody values** (e.g. the structurally-incomplete `STAGE0_RUNNER_DSN` recorded by the
  PR #274 diagnostic). Authority comes only from this registry pointing to a verified
  source PR/custody.

---

## 2. Production-Critical Parameter Categories

At minimum the registry tracks:

- production host identity category
- production repo path
- production branch
- database scheme category
- database host category
- database port category
- database name category
- PostgreSQL role names
- credential source category
- custody file paths
- custody key names
- environment variable names
- systemd unit names
- endpoint URL categories
- auth/token binding categories
- runtime binding / source-selection rules
- operator-only script paths
- run-lock paths
- safety gate names
- PR merge commits establishing or amending each parameter

---

## 3. Executable Registry Block

> Parse rule for future tooling: the header lines appear once; each parameter is a
> blank-line-separated record beginning with `parameter_id=`. Simple `awk`/`grep` over the
> fenced block is sufficient. `TBD` is allowed **only** where PR #199 or a later doc must be
> inspected in a follow-up amendment; `TBD` is **not** acceptable for any parameter required
> by an imminent execution.

```buyerrecon-production-parameter-registry-v1
registry_version=1
registry_status=active
registry_seed_pr=199
registry_seed_commit=193cdc96bfabe9893b330910b36cf681db77a20a
registry_doc_path=docs/production-parameter-registry.md

parameter_id=prod.repo.name
parameter_name=Production repository name
category=production_host_identity
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=buyerrecon-backend
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=parameter_registry_gate
shape_contract=complete
validation_method=string_equals_buyerrecon-backend
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-11
notes=non-secret repo identifier

parameter_id=prod.repo.path
parameter_name=Production host repo path
category=production_repo_path
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=/opt/buyerrecon-backend
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=parameter_registry_gate,stage0_phase0_gate
shape_contract=complete
validation_method=test_-d_path_and_string_equals
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-11
notes=non-secret host path

parameter_id=prod.branch
parameter_name=Production base branch
category=production_branch
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=sprint2-architecture-contracts-d4cc2bf
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=parameter_registry_gate,stage0_phase0_gate
shape_contract=complete
validation_method=git_rev-parse_abbrev_ref_equals
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-11
notes=non-secret branch name

parameter_id=prod.database.scheme.category
parameter_name=Database scheme category
category=database_scheme_category
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=postgresql
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=complete
validation_method=string_equals_postgresql
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-16
notes=URI scheme only; not a secret
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.database.host.category
parameter_name=Database host category
category=database_host_category
environment=production
sensitivity_level=sensitive
raw_value_allowed_in_docs=false
safe_representation=category_only / approved_source_contains_host_component
source_pr=195
source_commit=4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036
source_doc_path=docs/sprint3-stage0-runner-dsn-host-port-custody-pass-evidence.md
current_status=active
supersedes=none
superseded_by=none
custody_location=approved_production_db_custody_source
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=category_only
validation_method=safe_boolean_host_component_present_true_from_approved_custody_never_printed
stop_line_if_missing=database_host_source_missing
last_verified_at=2026-06-11
notes=NO raw host recorded or printed; provenance is the PR195 host/port custody PASS (merge 4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036) which confirmed approved source contains the host component (host_component_present=true, host_port_custody_check_pass=true); value remains in approved custody and is derived locally without printing; do not guess host
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.database.port.category
parameter_name=Database port category
category=database_port_category
environment=production
sensitivity_level=sensitive
raw_value_allowed_in_docs=false
safe_representation=category_only / approved_source_contains_port_component
source_pr=195
source_commit=4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036
source_doc_path=docs/sprint3-stage0-runner-dsn-host-port-custody-pass-evidence.md
current_status=active
supersedes=none
superseded_by=none
custody_location=approved_production_db_custody_source
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=category_only
validation_method=safe_boolean_port_component_present_true_from_approved_custody_never_printed
stop_line_if_missing=database_port_source_missing
last_verified_at=2026-06-11
notes=NO raw port recorded or printed; provenance is the PR195 host/port custody PASS (merge 4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036) which confirmed approved source contains the port component (port_component_present=true, host_port_custody_check_pass=true); value remains in approved custody and is derived locally without printing; do not assume 5432 unless approved custody verifies
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.database.name.category
parameter_name=Database name
category=database_name_category
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=buyerrecon_production
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=complete
validation_method=string_equals_buyerrecon_production
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-16
notes=non-secret database name
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.stage0.runner.role
parameter_name=Stage 0 dedicated runner role
category=postgresql_role_names
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=buyerrecon_stage0_runner
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=stage0_runner_dsn_construction,rb_rotate_gate
shape_contract=complete
validation_method=string_equals_buyerrecon_stage0_runner
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-16
notes=role created/granted/proven PR188; least-privilege per PR199 §4
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.stage0.runner.credential.source
parameter_name=Stage 0 runner credential source category
category=credential_source_category
environment=production
sensitivity_level=secret
raw_value_allowed_in_docs=false
safe_representation=operator_held_approved_secret_custody
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=operator_held_approved_secret_custody
custody_key=none
required_for=rb_rotate_gate
shape_contract=category_only
validation_method=operator_attests_custody_never_printed
stop_line_if_missing=raw_secret_would_be_printed
last_verified_at=unknown
notes=password created for runner during PR188 proof; never printed/committed

parameter_id=prod.stage0.runner.custody.file
parameter_name=Stage 0 runner custody file path
category=custody_file_paths
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=/etc/buyerrecon/stage0-runner.env
source_pr=274
source_commit=b63f2b7b454609a36b1fe9f1c882ce562cee369d
source_doc_path=docs/sprint3-stage0-runner-dsn-custody-structure-diagnostic-evidence.md
seed_pr=199
seed_commit=193cdc96bfabe9893b330910b36cf681db77a20a
current_status=active
supersedes=none
superseded_by=none
custody_location=/etc/buyerrecon/stage0-runner.env
custody_key=STAGE0_RUNNER_DSN
required_for=rb_rotate_gate,stage0_runtime_binding
shape_contract=complete
validation_method=pr282_rb_rotate_evidence_booleans_custody_written_true__custody_file_exists_owner_root_chmod_600_true__custody_key_present_true__db_custody_in_sync_true__never_print_value
stop_line_if_missing=custody_value_not_corrected_or_verified
last_verified_at=2026-06-16
notes=custody file path seeded by PR199 (193cdc96). HISTORICAL: the prior physical custody value was BROKEN per PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) structure diagnostic (structurally INCOMPLETE). The source-of-truth DERIVATION PATH was verified-active per PR280/PR281. The current physical custody value was REWRITTEN by the PR282 (merge dadb458bde5e7de0e980749829f11e9308920f91) RB-ROTATE and is now CORRECTED/VERIFIED by evidence labels (custody_written=true, custody_file_exists=true, custody_file_owner_root=true, custody_file_chmod_600=true, custody_key_present=true, db_custody_in_sync=true, db_rotation_applied=true, corrected_dsn_derived_locally=true, corrected_dsn_printed=false, raw_values_printed=false). NOTE: live authentication is NOT proven by PR282 (no psql/auth attempt occurred); db_custody_in_sync means the rotation and corrected custody write completed in the same controlled chain, NOT an auth test. Live auth still requires a separately GO-gated Option A binding/auth preflight rerun; Step2E/Stage0 remain separately GO-gated.
source_of_truth_derivation_status=verified_active
current_custody_value_status=corrected_by_pr282_rb_rotate_evidence
live_auth_proven=false
future_custody_write_required=false
historical_broken_value_pr=274
historical_broken_value_commit=b63f2b7b454609a36b1fe9f1c882ce562cee369d
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c
correction_pr=282
correction_commit=dadb458bde5e7de0e980749829f11e9308920f91
correction_doc_path=docs/sprint3-stage0-rb-rotate-pr281-applied-evidence.md
derivation_validation_method=pr280_complete_stage0_runner_dsn_shape_derivable_true__operator_guess_required_false__raw_values_printed_false

parameter_id=prod.stage0.runner.custody.key
parameter_name=Stage 0 runner custody key name
category=custody_key_names
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=STAGE0_RUNNER_DSN
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=/etc/buyerrecon/stage0-runner.env
custody_key=STAGE0_RUNNER_DSN
required_for=rb_rotate_gate,stage0_runtime_binding
shape_contract=complete
validation_method=grep_key_present_never_print_value
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-16
finding_pr=274
finding_commit=b63f2b7b454609a36b1fe9f1c882ce562cee369d
finding_doc_path=docs/sprint3-stage0-runner-dsn-custody-structure-diagnostic-evidence.md
notes=key name is non-secret; key-name seeded by PR199 (193cdc96); PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) historically confirmed the key present but its value structurally incomplete; PR282 (merge dadb458bde5e7de0e980749829f11e9308920f91) RB-ROTATE rewrote the value — the key is present with a corrected/verified value (custody_key_present=true, custody_written=true) — value never printed; live auth not yet proven
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c

parameter_id=prod.stage0.runner.dsn.shape
parameter_name=Stage 0 runner DSN shape contract
category=runtime_binding_source_selection_rules
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=rb_rotate_gate,stage0_runner_dsn_construction
shape_contract=complete
validation_method=structure_match_placeholders_only_never_real_values
stop_line_if_missing=parameter_shape_incomplete
last_verified_at=2026-06-16
finding_pr=274
finding_commit=b63f2b7b454609a36b1fe9f1c882ce562cee369d
finding_doc_path=docs/sprint3-stage0-runner-dsn-custody-structure-diagnostic-evidence.md
notes=<PASSWORD>/<HOST>/<PORT> are literal placeholders; assemble outside repo/logs; never the collector/app/admin DSN; never a guessed host/port; this entry defines the required shape, not the current custody value; PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) historically proved the prior custody value did NOT satisfy this shape; PR280 (merge 3b010d731b0abb92806c3a105b428b481b39c94c) verified this shape is derivable from approved sources without guessing; PR282 (merge dadb458bde5e7de0e980749829f11e9308920f91) RB-ROTATE wrote a corrected custody value derived to this shape (corrected_dsn_derived_locally=true, corrected_dsn_printed=false) — live auth not yet proven
source_of_truth_derivation_status=verified_active
derivation_evidence_pr=280
derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c
derivation_validation_method=pr280_complete_stage0_runner_dsn_shape_derivable_true__operator_guess_required_false__raw_values_printed_false

parameter_id=prod.stage0.command.map
parameter_name=Stage 0 command mapping
category=runtime_binding_source_selection_rules
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=stage0:run==tsx scripts/run-stage0-worker.ts
source_pr=199
source_commit=193cdc96bfabe9893b330910b36cf681db77a20a
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=stage0_command_mapping_gate
shape_contract=complete
validation_method=exact_command_mapping_gate_fail_closed_on_mismatch
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-11
notes=confirm mapping before any Stage 0 execution

parameter_id=prod.stage0.runner.operator.script
parameter_name=RB-ROTATE operator-only script path
category=operator_only_script_paths
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=/tmp/buyerrecon-rb-rotate-operator.sh
source_pr=272
source_commit=0e36a7f848db4cf13cb16f8f3a44122560fccc75
source_doc_path=docs/sprint3-stage0-route-b-pr270-aligned-rb-rotate-command-pack-plan.md
current_status=active
supersedes=none
superseded_by=none
custody_location=operator_workstation_then_transferred_sha_verified
custody_key=none
required_for=rb_rotate_gate
shape_contract=complete
validation_method=sha256_match_and_bash_n_pass_before_run
stop_line_if_missing=required_parameter_missing
last_verified_at=2026-06-16
notes=PR272-aligned RB-ROTATE command pack; transfer raw + sha256 verify; expected sha256 recorded in transfer procedure

parameter_id=prod.runlock.path
parameter_name=Stage 0 run-lock path
category=run_lock_paths
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=TBD
source_pr=TBD
source_commit=TBD
source_doc_path=TBD
current_status=unknown
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=stage0_execution_gate
shape_contract=unknown
validation_method=inspect_pr199_and_cutover_hard_gates_in_followup
stop_line_if_missing=required_parameter_missing
last_verified_at=unknown
notes=not required for RB-ROTATE custody correction; must be resolved before Stage 0 execution

parameter_id=prod.systemd.unit
parameter_name=Production systemd unit name(s)
category=systemd_unit_names
environment=production
sensitivity_level=public
raw_value_allowed_in_docs=true
safe_representation=TBD
source_pr=TBD
source_commit=TBD
source_doc_path=TBD
current_status=unknown
supersedes=none
superseded_by=none
custody_location=none
custody_key=none
required_for=none
shape_contract=unknown
validation_method=inspect_pr199_and_deployment_docs_in_followup
stop_line_if_missing=required_parameter_missing
last_verified_at=unknown
notes=resolve via follow-up registry-amendment PR if needed for execution

parameter_id=prod.endpoint.url.category
parameter_name=Production endpoint URL category
category=endpoint_url_categories
environment=production
sensitivity_level=sensitive
raw_value_allowed_in_docs=false
safe_representation=TBD
source_pr=TBD
source_commit=TBD
source_doc_path=TBD
current_status=unknown
supersedes=none
superseded_by=none
custody_location=approved_custody_source
custody_key=none
required_for=none
shape_contract=unknown
validation_method=category_only_never_print_in_followup
stop_line_if_missing=required_parameter_missing
last_verified_at=unknown
notes=not required for RB-ROTATE; resolve via follow-up amendment
```

---

## 4. Secret-Safety

- The registry must **not** contain raw passwords, raw DSNs, raw tokens, private keys, raw
  `.env.production` values, raw connection strings, **host/port values**, customer payloads,
  or PII.
- Sensitive production values are represented **only** by category, custody path, key name,
  shape contract, and local derivation method (`sensitivity_level`, `custody_location`,
  `custody_key`, `shape_contract`, `validation_method`).
- If a future command needs raw values, it must **derive them locally from the approved
  source path without printing them** (hidden in-memory assembly; never echoed/committed).

---

## 5. Registry Amendment Rule

Any future PR that **introduces, discovers, corrects, supersedes, deprecates, or depends
on** a production-critical parameter must either:

- **update this registry in the same PR**, if that PR is docs-only and safe; or
- **create a separate docs-only registry-amendment PR** before any execution uses that
  parameter.

A future **execution GO must fail closed** if any required parameter is not present and
`current_status=active` in the registry (with no conflicting active parameter and a
sufficient `shape_contract`) — **except** for PR #270-aligned RB-ROTATE, which uses the
two-axis gate semantics below (see the supersession note).

> **Supersession note (Stage 0 runner DSN RB-ROTATE only).** For Stage 0 runner DSN
> RB-ROTATE only, PR #281 two-axis gate semantics supersede earlier prose that required all
> Stage 0 DSN-related entries to be `current_status=active`. The physical custody value
> remains blocked until rewritten; the source-of-truth derivation path is the activatable
> dependency for RB-ROTATE.

---

## 6. Future Command-Pack Gate Contract

There are **two** gate variants. The standard variant applies to executions that **consume an
existing parameter value**; the **RB-ROTATE derivation variant** applies to a PR #270-aligned
RB-ROTATE whose purpose is to **construct a corrected value and write it** (so it must not be
blocked merely because a prior custody value was broken — rewriting it is what RB-ROTATE does;
as of PR #282 the current custody value is recorded corrected/verified — see §9 / Appendix D).

### 6.1 Standard `parameter_registry_gate` (value-consuming executions)

Every such command-pack PR must include a **`parameter_registry_gate`** that runs **before**
execution and must:

1. Confirm current branch is `sprint2-architecture-contracts-d4cc2bf`.
2. Fetch origin and fast-forward to the current tip.
3. Confirm the registry doc exists at the canonical path
   (`docs/production-parameter-registry.md`).
4. Confirm HEAD contains the registry **seed/amendment merge commits** required for the
   parameters used (e.g. `registry_seed_commit`, plus each used parameter's `source_commit`).
5. Parse the fenced `buyerrecon-production-parameter-registry-v1` block.
6. Confirm every **required `parameter_id`** is present.
7. Confirm every required parameter has `current_status=active`.
8. Confirm **no conflicting active parameter** exists for the same `category` + `environment`.
9. Confirm `shape_contract` is **sufficient** for the planned execution.
10. Emit **safe labels only** (§7); never print raw values.

> If an execution depends on the **current physical custody value already being correct**
> (e.g. Stage 0 runtime binding that consumes `STAGE0_RUNNER_DSN`), it must still require the
> custody value to be `current_status=active` / verified — which only happens **after** an
> RB-ROTATE write **and** a later evidence PR verifies it. This standard variant stays
> conservative and is **not** superseded.

### 6.2 RB-ROTATE derivation `parameter_registry_gate` (PR #270-aligned RB-ROTATE only)

For a PR #270-aligned RB-ROTATE — which derives the corrected DSN locally, rotates the
credential, and **writes** the corrected custody value — the gate runs steps 1–6 and 8 above,
and then instead of requiring `current_status=active` on the custody value, it must confirm
the **source-of-truth derivation axis**:

- `source_of_truth_derivation_status=verified_active` on every required Stage 0 DSN dependency;
- `complete_stage0_runner_dsn_shape_derivable=true`;
- `operator_guess_required=false`;
- `raw_values_printed=false`;
- **no** required derivation dependency has `source_commit=TBD`;
- **no** approved-source conflict exists;
- **broken custody is not used as a source** (`broken_custody_used_as_source=false`);
- `prod.stage0.runner.custody.file` **may remain `current_status=blocked`**
  (`current_custody_value_status=broken_until_rewritten_by_rb_rotate`) — this does **not**
  block RB-ROTATE, because RB-ROTATE is what rewrites that value.

This variant authorizes RB-ROTATE **only** to derive (without printing), rotate the credential,
and write the corrected custody value, then produce evidence. It does **not** authorize, and
the gate does **not** assert, live-auth success or Stage 0 readiness (those remain separately
gated). Emit **safe labels only**; never print raw values.

---

## 7. Required Safe Labels (future command packs)

```text
parameter_registry_doc_present=true|false
parameter_registry_version=<n>
parameter_registry_status_active=true|false
parameter_registry_seed_commit_present=true|false
parameter_registry_required_ids_present=true|false
parameter_registry_required_ids_active=true|false
parameter_registry_conflicts_detected=true|false
parameter_registry_shape_contract_pass=true|false
parameter_registry_raw_values_printed=false
parameter_registry_gate_result=<pass|blocked>
stop_line=<none_or_safe_stop_line>
```

---

## 8. Stop-Lines

Fail closed (safe stop-line + non-zero exit; no raw values emitted) on at least:

- `parameter_registry_doc_missing`
- `parameter_registry_block_missing`
- `parameter_registry_version_unsupported`
- `parameter_registry_seed_commit_missing`
- `required_parameter_missing`
- `required_parameter_not_active`
- `required_parameter_superseded`
- `conflicting_active_parameters`
- `parameter_shape_incomplete`
- `parameter_source_commit_missing`
- `raw_secret_would_be_printed`
- `parameter_only_available_from_broken_custody`
- `operator_guess_required`

---

## 9. Immediate Stage 0 / RB-ROTATE Application

**No further RB-ROTATE retry may proceed** until the Stage 0 runner DSN dependency is
represented in this registry with enough **active source-of-truth structure** to **construct
or verify** the complete `STAGE0_RUNNER_DSN` **without operator guessing**.

Current Stage 0 parameter status in the registry (current-value axis corrected by the PR #282
RB-ROTATE — see Appendix D; derivation axis activated by PR #280/#281 — see Appendix C):

| parameter_id | current_status | source_of_truth_derivation | shape_contract | source |
|---|---|---|---|---|
| `prod.stage0.runner.role` | active | verified_active | complete | PR #199 (PR #188); PR #280 |
| `prod.stage0.runner.custody.file` | **active (current value corrected)** | **verified_active (derivation)** | complete | PR #199 seed; PR #274 historical broken (`b63f2b7b…`); PR #280 derivation (`3b010d73…`); **PR #282 correction (`dadb458b…`)** |
| `prod.stage0.runner.custody.key` | active | verified_active | complete | PR #199 seed; PR #274 (`b63f2b7b…`); PR #280; PR #282 (`dadb458b…`) |
| `prod.stage0.runner.dsn.shape` | active | verified_active | complete | PR #199 §5; PR #274 (`b63f2b7b…`); PR #280 (`3b010d73…`); PR #282 (`dadb458b…`) |
| `prod.database.scheme.category` | active | verified_active | complete | PR #199; PR #280 |
| `prod.database.host.category` | active | verified_active | category_only | PR #195 (`4de1b1f1…`, host_component_present); PR #280 |
| `prod.database.port.category` | active | verified_active | category_only | PR #195 (`4de1b1f1…`, port_component_present); PR #280 |
| `prod.database.name.category` | active | verified_active | complete | PR #199; PR #280 |

**Two-axis model (do not conflate).**
- **`current_status` / `current_custody_value_status`** tracks the *current physical custody
  value*. For `prod.stage0.runner.custody.file` this is now
  **`active` / `corrected_by_pr282_rb_rotate_evidence`** — the PR #282 RB-ROTATE rewrote the
  value, and it is recorded corrected/verified by evidence labels (`custody_written=true`,
  `custody_file_exists=true`, `custody_file_owner_root=true`, `custody_file_chmod_600=true`,
  `custody_key_present=true`, `db_custody_in_sync=true`). The prior `broken` state was the
  PR #274 historical finding, now superseded by the PR #282 rewrite.
- **`source_of_truth_derivation_status`** tracks whether a *corrected complete DSN can be
  constructed from approved sources without guessing*. PR #280/#281 verified this is
  **`verified_active`** (`complete_stage0_runner_dsn_shape_derivable=true`,
  `operator_guess_required=false`, `raw_values_printed=false`).
- **Live authentication is a THIRD, still-open axis** (`live_auth_proven=false`): PR #282 made
  **no** psql/auth attempt. `db_custody_in_sync=true` means the rotation and corrected custody
  write completed in one controlled chain — **not** an auth test.

**Status (updated by PR #282).** The current custody value is now **corrected/verified** for
value-consuming registry gates, and the derivation axis remains verified-active. The prior
fail-closed `stop_line=parameter_only_available_from_broken_custody` **no longer applies** (the
value was rewritten by PR #282). **However, live authentication is NOT yet proven** — a
separately GO-gated **Option A binding/auth preflight rerun** is required before any value is
relied upon for Stage 0 runtime, and **Step 2E / Stage 0 remain separately GO-gated.**

> Note (resolved): `prod.database.host.category` / `prod.database.port.category` now carry
> concrete provenance `source_commit=4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036`
> (PR #195 host/port custody PASS,
> `docs/sprint3-stage0-runner-dsn-host-port-custody-pass-evidence.md`,
> `host_component_present=true` / `port_component_present=true`) — the prior `TBD` is
> resolved. The host/port **values** remain in approved custody and are **never** recorded or
> printed; the registry holds category/provenance only. See Appendix B for the amendment note.

---

## 10. Example Future Shell Gate (illustrative — DOES NOT RUN HERE)

> Non-executing, safe pseudo-code showing how a future command-pack would check the registry
> without printing raw values. Not a production execution script.

```text
# CANDIDATE ONLY — illustrative; not executed by this PR
# RB-ROTATE derivation variant (§6.2): checks the source-of-truth DERIVATION axis,
# NOT current_status=active on the (still-blocked) custody value.
REG="docs/production-parameter-registry.md"
[ -f "$REG" ] || { echo "stop_line=parameter_registry_doc_missing"; exit 1; }
# extract the fenced block to a temp (no raw secrets are present in it by policy)
awk '/^```buyerrecon-production-parameter-registry-v1$/{f=1;next}/^```$/{f=0}f' "$REG" > "$BLK"
grep -q '^registry_version=1$' "$BLK" || { echo "stop_line=parameter_registry_version_unsupported"; exit 1; }
SEED="$(awk -F= '/^registry_seed_commit=/{print $2}' "$BLK")"
git merge-base --is-ancestor "$SEED" HEAD || { echo "stop_line=parameter_registry_seed_commit_missing"; exit 1; }
# for each required Stage0 DSN dependency: confirm present + derivation verified-active + non-TBD source
for id in prod.stage0.runner.role prod.stage0.runner.custody.file prod.stage0.runner.custody.key \
          prod.stage0.runner.dsn.shape prod.database.scheme.category prod.database.host.category \
          prod.database.port.category prod.database.name.category; do
  rec="$(awk -v id="$id" 'BEGIN{RS=""} $0 ~ ("parameter_id=" id "(\n|$)")' "$BLK")"
  [ -n "$rec" ] || { echo "stop_line=required_parameter_missing"; exit 1; }
  printf '%s\n' "$rec" | grep -q '^source_of_truth_derivation_status=verified_active$' \
    || { echo "stop_line=derivation_not_verified_active"; exit 1; }
  printf '%s\n' "$rec" | grep -q '^source_commit=TBD$' && { echo "stop_line=source_commit_tbd"; exit 1; }
done
# NOTE: prod.stage0.runner.custody.file may be current_status=blocked here — that is the
# current physical value RB-ROTATE rewrites; it does NOT block the RB-ROTATE derivation gate.
echo "parameter_registry_raw_values_printed=false"
echo "parameter_registry_gate_result=pass"
echo "stop_line=none"
```

(After the PR #281 activation, the RB-ROTATE derivation gate emits
`parameter_registry_gate_result=pass` / `stop_line=none` because every required Stage 0 DSN
dependency is `source_of_truth_derivation_status=verified_active` with non-`TBD` provenance —
even though `prod.stage0.runner.custody.file` remains `current_status=blocked` for its current
physical value. A **standard** value-consuming gate (§6.1) would still treat that `blocked`
custody value as not-yet-usable until RB-ROTATE writes it and a later evidence PR verifies it.)

---

## 11. Explicit Non-Authorization

**This PR authorizes no:** production execution; credential rotation; custody write; psql/auth
rerun; Option A rerun; Step 2E; Stage 0; run-lock touch; grants; schema/data changes;
source-selection change; Option B code change; remediation; downstream runtime;
Lane/scoring/AMS/customer output; Gate 4E; Gate 4F. **Stage 0 execution remains separately
GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
**host value, port value**, URI with real host, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural
row data, real `session_id` / `request_id` value, user-agent value, raw SQL, raw psql
output, raw PostgreSQL error text, Node stack trace, or customer data. The registry records
**only** non-secret identifiers (repo, branch, host path, scheme, database name, role name,
custody file path, custody key name, env-var names, DSN **shape with literal placeholders**,
command mapping, operator-script path) and, for sensitive items, **category + custody pointer
+ shape contract + local derivation method only** — never the value. The DSN shape
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production` uses
literal placeholders, not values. (Per the PR #218 Codex note: "no secret used or exposed" is
to be read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / category tokens / non-secret identifiers / public git commit hashes —
not secret or row values.

---

# Appendix A — Stage 0 Runner DSN Source-of-Truth Registry-Amendment Plan (Planning Only)

**Appendix status:** `STAGE0_RUNNER_DSN_REGISTRY_AMENDMENT_PLANNING_ONLY`

This appendix is **planning only**. It does **not** change any parameter `current_status` in
the machine-readable `buyerrecon-production-parameter-registry-v1` block above (the Stage 0
runner DSN dependency remains `blocked`), and it **executes nothing**. It plans a **future
docs-only amendment** that could move the Stage 0 runner DSN dependency from `blocked` →
`verified active`, **or** prove exactly which source-of-truth dependency remains missing. The
final executable amendment **must update this same canonical registry**
(`docs/production-parameter-registry.md`) — including the v1 block — **before** any RB-ROTATE
retry. This appendix authorizes **no** RB-ROTATE retry, credential rotation, custody write,
psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants, schema/data
changes, source-selection change, Option B code change, remediation, downstream runtime,
Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. No raw secret, DSN, host, port,
username, password, `.env.production` value, or connection string appears here.

> Provenance: PR #275 establishes this registry
> (`385b068db4a07a8738f64bed7361b8ff8a0c4ab7`); PR #274 proved the existing custody value
> incomplete (`b63f2b7b454609a36b1fe9f1c882ce562cee369d`); PR #199 seed
> (`193cdc96bfabe9893b330910b36cf681db77a20a`).

## A.1 Current Registry Baseline (must be confirmed before amending)

A future amendment/gate must first confirm:
- the current base tip contains the **PR #275 merge** `385b068db4a07a8738f64bed7361b8ff8a0c4ab7`;
- `docs/production-parameter-registry.md` **exists**;
- the `buyerrecon-production-parameter-registry-v1` block **exists** and parses
  (`registry_version=1`, `registry_status=active`, `registry_seed_commit=193cdc96…`);
- current Stage 0 runner DSN-related status (as recorded in the v1 block above):
  - `prod.stage0.runner.custody.file` → **`current_status=blocked`** (incomplete custody
    value; finding PR #274 `b63f2b7b…`);
  - `prod.stage0.runner.dsn.shape` → shape is defined but **not yet usable for execution**
    because the custody value does not satisfy it;
  - therefore any RB-ROTATE retry must **fail closed** at
    `stop_line=parameter_only_available_from_broken_custody`.

## A.2 Source-of-Truth Discovery Candidates (safe; no raw values)

Candidates to establish the missing **complete** DSN structure, **without printing raw
secrets** — each must resolve to a registry entry with verified provenance, not a guess:

| candidate | use | secret-safety constraint |
|---|---|---|
| PR #199 seed registry entries | scheme, db name, role, DSN shape, host/port custody pointer | already non-secret; cite `source_commit` |
| PR #195 host/port category provenance | confirm host/port **presence** in approved custody | booleans only; **never** print host/port; record exact PR #195 merge commit (currently `TBD`) |
| merged production environment/runtime registry doc (`docs/ops/buyerrecon-production-environment-runtime-registry.md`) | structural/custody narrative source | non-secret; structure/custody only |
| approved custody source metadata | confirm the approved location holds a complete value | presence/authority booleans only; never read value into docs |
| `.env.production` | **only** as a local operator-derived source | **never printed/committed/parsed into output**; local in-memory derivation only |
| PostgreSQL local metadata | only if **read-only and secret-safe** | booleans/categories only; no rows, no DSN, no host/port |
| `/etc/buyerrecon/stage0-runner.env` | **only** as broken-evidence (PR #274), **not** source of truth | never treated as authority |

> Rule: a candidate becomes a registry source only when it yields a **verified** value or a
> **verifiable presence/shape**, recorded as category/shape/custody-pointer — never the raw
> value.

## A.3 Required Parameters to Move Active

The amendment must drive these to `current_status=active` **only when verified** (else leave
`blocked`/`unknown` and record exactly what is missing):

- `prod.stage0.runner.role`
- `prod.stage0.runner.custody.file`
- `prod.stage0.runner.custody.key`
- `prod.stage0.runner.dsn.shape`
- `prod.database.scheme.category`
- `prod.database.host.category`
- `prod.database.port.category`
- `prod.database.name.category`

## A.4 Amendment Strategy (future docs-only edit to this file)

For each required parameter, the future amendment updates its v1-block record with:
- `current_status=active` **only if verified from an approved source-of-truth** (otherwise
  keep `blocked`/`unknown` and state the missing dependency);
- `source_pr`, `source_commit`, `source_doc_path` (concrete merged provenance; **no** `TBD`
  for any parameter required by the imminent RB-ROTATE);
- `shape_contract` (must be `complete` for the params RB-ROTATE constructs/verifies);
- `validation_method` (the secret-safe check a command-pack runs — booleans only);
- `stop_line_if_missing`;
- safe `notes`;
- **no** raw secret / DSN / host / port / username / password value printed.

The amendment is **docs-only** and updates **this canonical registry**. If it cannot verify a
parameter safely, it records the parameter as still-blocked with the precise missing
dependency — it does **not** guess.

## A.5 Future Executable Gate (before any RB-ROTATE retry)

> **Superseded by PR #281 two-axis semantics (RB-ROTATE only).** This list originally said
> "every required Stage 0 DSN parameter must be `current_status=active`." For Stage 0 runner
> DSN **RB-ROTATE only**, that is replaced by the §6.2 two-axis gate: the **current physical
> custody value may remain `blocked`** (`current_custody_value_status=broken_until_rewritten_by_rb_rotate`),
> while the **source-of-truth derivation axis must be verified-active**. RB-ROTATE is allowed
> only to derive the corrected DSN (without printing), rotate the credential, and **write** the
> corrected custody value — **not** to claim live auth or Stage 0 readiness.

A future RB-ROTATE `parameter_registry_gate` (in the command-pack, before password input / DB
rotation) must:
- fast-forward to the current base tip;
- confirm HEAD contains the registry **seed + amendment merge commits** required;
- parse the `buyerrecon-production-parameter-registry-v1` block;
- assert **every required Stage 0 DSN parameter** (§A.3) is present and
  **`source_of_truth_derivation_status=verified_active`** (the **current physical custody
  value** for `prod.stage0.runner.custody.file` may remain `current_status=blocked` — RB-ROTATE
  is what rewrites it);
- assert `complete_stage0_runner_dsn_shape_derivable=true`, `operator_guess_required=false`,
  `raw_values_printed=false`;
- assert their `shape_contract` is **complete** (or category-only as approved for host/port);
- assert **no** required derivation dependency has `source_commit=TBD`;
- assert **broken custody is not used as a source** (`broken_custody_used_as_source=false`);
- assert **no** conflicting active parameter for the same category/environment;
- emit **safe labels only**;
- **stop before any password input or DB rotation** if any check fails
  (`parameter_registry_gate_result=blocked`).

> Non-RB-ROTATE executions that **consume** the custody value (e.g. Stage 0 runtime binding)
> stay conservative: they must still require the custody value `current_status=active` /
> verified, which only holds **after** an RB-ROTATE write and a later evidence PR.

Illustrative safe labels: `amendment_required_ids_active=true|false`,
`amendment_no_tbd_source_commits=true|false`,
`amendment_no_broken_custody_dependency=true|false`,
`amendment_shape_contracts_complete=true|false`,
`parameter_registry_gate_result=<pass|blocked>`, `stop_line=<none_or_safe_stop_line>`.

## A.6 Secret-Safe Local Derivation

If an approved source-of-truth requires local raw values, future operator commands must
**derive them locally without printing** any of: raw DSN, host, port, username, password,
`.env.production` value, raw connection string, or custody contents. The **only** output is
booleans / categories / shape checks (e.g. `dsn_shape_complete=true|false`,
`host_present_in_approved_custody=true|false`) — never the value or any component.

## A.7 Explicit Blockers (RB-ROTATE stays blocked if any hold)

- any required parameter is **missing**;
- any required parameter is `blocked`, `unknown`, `TBD`, `superseded`, or **conflicting**;
- host / port / db / user **cannot be derived from an approved source**;
- the existing **broken custody** is the only source;
- **operator guessing** would be required;
- **raw secrets would need to be printed**.

In any of these cases the gate fails closed (no password input, no DB rotation) and the state
is recorded in a docs-only evidence PR (safe labels only).

## A.8 Non-Authorization

This appendix authorizes **no** RB-ROTATE retry, credential rotation, custody write, psql/auth
rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants, schema/data changes,
source-selection change, Option B code change, remediation, downstream runtime,
Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. The **executable amendment** is a
future, separately-reviewed, separately GO-gated docs-only edit to this canonical registry;
**Stage 0 execution remains separately GO-gated.**

## A.9 Appendix Safety / Raw-Data Boundary

This appendix contains no secret value, DSN URI, connection string, raw password, raw
secret-manager payload, service-file content, `.env.production` content/value, token, raw
UUID, IP address, IPv6 address, **host value, port value**, real URI, SSH banner, login
source, host/network detail, raw payload, `canonical_jsonb` payload, row data, real
`session_id`/`request_id`, raw SQL, raw psql output, or customer data. It plans a future
docs-only amendment that records only category / shape-contract / custody-pointer / verified
provenance per parameter, derives any raw values **locally without printing**, and **keeps
RB-ROTATE blocked** until every required Stage 0 DSN parameter is verified `active` with
complete shape and concrete (non-`TBD`) provenance. (Per the PR #218 Codex note: "no secret
used or exposed" is to be read as "no secret value exposed, printed, or recorded.") All values
above are safe labels / booleans / category tokens / non-secret identifiers / public git
commit hashes — not secret or row values.

---

# Appendix B — Amendment: Host/Port Source Provenance (PR #195)

**Amendment status:** `PRODUCTION_PARAMETER_REGISTRY_HOST_PORT_PROVENANCE_AMENDMENT_ONLY`

- **What this amendment did:** replaced `source_commit=TBD` on
  `prod.database.host.category` and `prod.database.port.category` with concrete provenance
  from the merged **PR #195** host/port custody PASS:
  - `source_pr=195`
  - `source_commit=4de1b1f1ae7ebb2e9adb3be5564e8e58cfa6e036`
  - `source_doc_path=docs/sprint3-stage0-runner-dsn-host-port-custody-pass-evidence.md`
- **Why:** PR #278 showed the host/port source provenance was the **remaining missing
  dependency** (`verification_result=blocked_missing_dependency`, `stop_line=source_commit_tbd`).
  PR #195 supplies the approved host/port custody PASS provenance
  (`approved_source_present=true`, `host_component_present=true`, `port_component_present=true`,
  `host_port_custody_check_pass=true`) — category/provenance evidence only; **no raw host,
  port, DSN, or custody value is recorded or printed**.
- **Scope of this amendment:**
  - It **only** resolves host/port source provenance.
  - It does **not** by itself re-run the source-of-truth verification.
  - It does **not** by itself authorize an RB-ROTATE retry.
- **Preserved blocked status:** `prod.stage0.runner.custody.file` **remains
  `current_status=blocked`** (PR #274: the existing custody value is structurally incomplete);
  this amendment does **not** touch the runner DSN custody value, the `dsn.shape` entry, or
  any other parameter. The existing broken custody value remains evidence-only, never a source.
- **Expected next step:** **re-run the Stage 0 runner DSN source-of-truth verification** (the
  PR #277 command pack). Only a `verification_result=verified_active_candidate` outcome
  (host/port now provenanced, complete shape derivable, no operator guessing) may then unblock
  a separately-GO-gated PR #270-aligned RB-ROTATE retry. **RB-ROTATE is not authorized by this
  amendment.**

**Non-authorization.** This amendment authorizes no RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants,
schema/data changes, source-selection change, Option B code change, remediation, downstream
runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. **Stage 0 execution remains
separately GO-gated.**

**Appendix B safety boundary.** No raw host, raw port, raw DSN, username, password, token,
`.env.production` value, source DSN, Stage 0 DSN, raw connection string, custody contents,
psql raw output, customer payload, or PII appears in this amendment. The host/port entries
remain `sensitivity_level=sensitive` / `raw_value_allowed_in_docs=false` / category-only; the
values stay in approved custody and are derived locally without printing when a future command
needs them. All values recorded are safe labels / booleans / category tokens / non-secret
identifiers / public git PR & commit references — not secret or row values.

---

# Appendix C — Activation: Stage 0 Runner DSN Source-of-Truth Derivation (PR #280)

**Amendment status:** `PRODUCTION_PARAMETER_REGISTRY_STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_ACTIVATION_ONLY`

- **What this amendment did:** added a `source_of_truth_derivation_status=verified_active`
  marker (plus `derivation_evidence_pr=280` /
  `derivation_evidence_commit=3b010d731b0abb92806c3a105b428b481b39c94c`) to the eight required
  Stage 0 runner DSN dependency entries, and added
  `current_custody_value_status=broken_until_rewritten_by_rb_rotate` /
  `future_custody_write_required=true` to `prod.stage0.runner.custody.file`. It updated the §9
  status model to a **two-axis** view (current-value vs. derivation).
- **Why:** PR #280 (merge `3b010d731b0abb92806c3a105b428b481b39c94c`) recorded the
  source-of-truth verification PASS — `complete_stage0_runner_dsn_shape_derivable=true`,
  `operator_guess_required=false`, `verification_result=verified_active_candidate`,
  `stop_line=none`, `raw_values_printed=false` — after PR #279
  (`c96bbc7b51a0284ca2c23059de4ccf36f752a8e6`) supplied host/port provenance from PR #195.
- **Explicitly NOT claimed (modeling requirement):**
  - The **current** `/etc/buyerrecon/stage0-runner.env` value is **NOT** corrected by this
    amendment; it remains **broken** per PR #274 (`b63f2b7b454609a36b1fe9f1c882ce562cee369d`)
    until a future RB-ROTATE write replaces it. `prod.stage0.runner.custody.file` stays
    `current_status=blocked`.
  - **Live authentication has NOT been tested or passed.** Source-of-truth derivability is not
    auth success.
  - The actual raw DSN value is **not** recorded or printed anywhere.
- **What this enables:** a future **PR #270-aligned RB-ROTATE retry may be GO-gated** for DSN
  source-of-truth derivability. RB-ROTATE must still: derive the corrected complete DSN
  **locally without printing raw values**, rotate the Stage 0 runner credential, **write** the
  corrected custody value, then produce evidence — and it must **not** run Stage 0, **not** run
  psql/auth rerun unless separately GO-gated, and **not** claim live auth passed.
- **Provenance used:** PR #199 (`193cdc96…`) seed; PR #195 (`4de1b1f1…`) host/port; PR #274
  (`b63f2b7b…`) historical broken current-value; PR #279 (`c96bbc7b…`) host/port provenance
  amendment; PR #280 (`3b010d73…`) verified-active source-of-truth candidate evidence.

**Non-authorization.** This amendment authorizes no RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants,
schema/data changes, source-selection change, Option B code change, remediation, downstream
runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. It only amends registry state
so a later PR #270-aligned RB-ROTATE retry may be GO-gated. **Stage 0 execution remains
separately GO-gated.**

**Appendix C safety boundary.** No raw DSN, raw host, raw port, password, token,
`.env.production` value, raw database URL, raw connection string, custody contents, psql raw
output, customer payload, or PII appears in this amendment; sensitive host/port stay
`sensitivity_level=sensitive` / `raw_value_allowed_in_docs=false` / category-only, with values
remaining in approved custody and derived locally without printing. At the time of Appendix C
the registry did **not** say the current custody file value was already corrected (that came
later via PR #282 — **see Appendix D**, which supersedes this Appendix-C statement for the
current-value axis). All values recorded are safe labels / booleans / category tokens /
non-secret identifiers / public git PR & commit references — not secret or row values.

---

# Appendix D — Correction: Current Stage 0 Runner Custody Value (PR #282)

**Amendment status:** `PRODUCTION_PARAMETER_REGISTRY_STAGE0_RUNNER_CUSTODY_VALUE_CORRECTED_AMENDMENT_ONLY`

- **What this amendment did:** updated the **current-value axis** of
  `prod.stage0.runner.custody.file` to reflect the PR #282 RB-ROTATE:
  - `current_status` `blocked` → **`active`**;
  - `current_custody_value_status` `broken_until_rewritten_by_rb_rotate` →
    **`corrected_by_pr282_rb_rotate_evidence`**;
  - `future_custody_write_required` `true` → **`false`**;
  - added `correction_pr=282`,
    `correction_commit=dadb458bde5e7de0e980749829f11e9308920f91`,
    `correction_doc_path=docs/sprint3-stage0-rb-rotate-pr281-applied-evidence.md`,
    `live_auth_proven=false`, and `historical_broken_value_pr=274` /
    `historical_broken_value_commit=b63f2b7b454609a36b1fe9f1c882ce562cee369d`;
  - updated `shape_contract` `partial` → `complete`, `validation_method` to the PR #282
    evidence booleans, and `stop_line_if_missing` to `custody_value_not_corrected_or_verified`.
  - Updated the custody.key and dsn.shape notes and the §9 status table/two-axis model
    accordingly.
- **Evidence cited (PR #282, merge `dadb458bde5e7de0e980749829f11e9308920f91`,
  `docs/sprint3-stage0-rb-rotate-pr281-applied-evidence.md`):** `db_rotation_applied=true`,
  `custody_written=true`, `custody_file_exists=true`, `custody_file_owner_root=true`,
  `custody_file_chmod_600=true`, `custody_key_present=true`, `db_custody_in_sync=true`,
  `execution_result=applied`, `stop_line=none`, `corrected_dsn_derived_locally=true`,
  `corrected_dsn_printed=false`, `raw_values_printed=false`.
- **Preserved history:** PR #274 (`b63f2b7b…`) remains the historical broken-value finding;
  PR #280/#281 remain the source-of-truth derivation activation. The prior `broken` state is
  superseded by the PR #282 rewrite, not erased.
- **Explicitly NOT claimed (bounded interpretation):**
  - **Live authentication is NOT proven** (`live_auth_proven=false`): PR #282 made **no**
    psql/auth attempt; `db_custody_in_sync=true` is a same-chain completion fact, not an auth
    test.
  - **Stage 0 readiness is NOT claimed**; no psql/auth test occurred.
  - Live auth still requires a **separately GO-gated Option A binding/auth preflight rerun**;
    **Step 2E / Stage 0 remain separately GO-gated.**
- **Effect on gates:** value-consuming gates (§6.1) may now treat the custody value as
  corrected/verified; the prior `stop_line=parameter_only_available_from_broken_custody` no
  longer applies. This does **not** authorize any execution.

**Non-authorization.** This amendment authorizes no RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants,
schema/data changes, source-selection change, Option B code change, remediation, downstream
runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. It only updates registry state
based on PR #282 evidence. **Stage 0 execution remains separately GO-gated.**

**Appendix D safety boundary.** No raw DSN, raw host, raw port, password, token,
`.env.production` value, raw database URL, raw connection string, custody contents, psql raw
output, customer payload, or PII appears in this amendment; the correction is recorded by
booleans / category tokens / non-secret path & key names / public git PR & commit references
only, and live authentication is explicitly not claimed.
