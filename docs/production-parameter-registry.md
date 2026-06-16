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
last_verified_at=2026-06-11
notes=URI scheme only; not a secret

parameter_id=prod.database.host.category
parameter_name=Database host category
category=database_host_category
environment=production
sensitivity_level=sensitive
raw_value_allowed_in_docs=false
safe_representation=category_only_custody_presence_confirmed
source_pr=195
source_commit=TBD
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=approved_production_db_custody_source
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=category_only
validation_method=presence_boolean_from_approved_custody_never_printed
stop_line_if_missing=required_parameter_missing
last_verified_at=unknown
notes=value never in docs; PR199 §5 presence confirmed by PR195; do not guess host; source_commit TBD pending PR195 merge-commit lookup

parameter_id=prod.database.port.category
parameter_name=Database port category
category=database_port_category
environment=production
sensitivity_level=sensitive
raw_value_allowed_in_docs=false
safe_representation=category_only_custody_presence_confirmed
source_pr=195
source_commit=TBD
source_doc_path=docs/ops/buyerrecon-production-environment-runtime-registry.md
current_status=active
supersedes=none
superseded_by=none
custody_location=approved_production_db_custody_source
custody_key=none
required_for=stage0_runner_dsn_construction
shape_contract=category_only
validation_method=presence_boolean_from_approved_custody_never_printed
stop_line_if_missing=required_parameter_missing
last_verified_at=unknown
notes=value never in docs; do not assume 5432 unless approved custody verifies; source_commit TBD pending PR195 merge-commit lookup

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
last_verified_at=2026-06-11
notes=non-secret database name

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
last_verified_at=2026-06-11
notes=role created/granted/proven PR188; least-privilege per PR199 §4

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
current_status=blocked
supersedes=none
superseded_by=none
custody_location=/etc/buyerrecon/stage0-runner.env
custody_key=STAGE0_RUNNER_DSN
required_for=rb_rotate_gate,stage0_runtime_binding
shape_contract=partial
validation_method=structure_only_diagnostic_booleans_never_print_value
stop_line_if_missing=parameter_only_available_from_broken_custody
last_verified_at=2026-06-16
notes=custody file path seeded by PR199 (193cdc96); blocked finding established by PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) structure diagnostic: existing value structurally INCOMPLETE (no scheme/netloc/host/user/password; path present but not /buyerrecon_production); blocked pending DSN custody correction/source-of-truth plan

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
notes=key name is non-secret; key-name seeded by PR199 (193cdc96); PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) confirmed the key is present but its value is structurally incomplete

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
notes=<PASSWORD>/<HOST>/<PORT> are literal placeholders; assemble outside repo/logs; never the collector/app/admin DSN; never a guessed host/port; PR274 (merge b63f2b7b454609a36b1fe9f1c882ce562cee369d) proved the current custody value does NOT satisfy this shape (incomplete) — this entry defines the required shape, not the current custody value

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
sufficient `shape_contract`).

---

## 6. Future Command-Pack Gate Contract

Every future production command-pack PR must include a **`parameter_registry_gate`** that
runs **before** execution and must:

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

Current Stage 0 parameter status in the registry:

| parameter_id | current_status | shape_contract | source |
|---|---|---|---|
| `prod.stage0.runner.role` | active | complete | PR #199 (PR #188) |
| `prod.stage0.runner.custody.file` | **blocked** | partial | PR #199 seed; **blocked finding PR #274** (`b63f2b7b…`) |
| `prod.stage0.runner.custody.key` | active | complete | PR #199 seed; PR #274 (`b63f2b7b…`) value-incomplete finding |
| `prod.stage0.runner.dsn.shape` | active | complete | PR #199 §5; PR #274 (`b63f2b7b…`) custody-mismatch finding |
| `prod.database.scheme.category` | active | complete | PR #199 |
| `prod.database.host.category` | active | category_only | PR #195 (presence) |
| `prod.database.port.category` | active | category_only | PR #195 (presence) |
| `prod.database.name.category` | active | complete | PR #199 |

**Blocking condition:** `prod.stage0.runner.custody.file` is `current_status=blocked`
because the **PR #274 structure diagnostic** (merged into
`sprint2-architecture-contracts-d4cc2bf` at
`b63f2b7b454609a36b1fe9f1c882ce562cee369d`,
`docs/sprint3-stage0-runner-dsn-custody-structure-diagnostic-evidence.md`) found the existing
`STAGE0_RUNNER_DSN` value structurally **incomplete** (broken custody). PR #274 proves only
that the current custody value is incomplete; it does **not** prove the correct DSN and does
**not** authorize an RB-ROTATE retry, credential rotation, custody write, psql/auth rerun,
Option A rerun, Step 2E, Stage 0, run-lock, grants, schema/data changes, source-selection
change, Option B code change, remediation, or downstream runtime. The shape contract, scheme,
db name, and role are known; the **host/port are category-only (custody presence via PR #195,
values never in docs)**. Until a **DSN custody correction / source-of-truth plan** moves the
runner DSN custody to a verified, complete, active state (constructing/verifying the full DSN
from approved custody **without guessing host, port, username, database name, or URI shape**),
any RB-ROTATE retry must **fail closed** at the registry gate with
`stop_line=parameter_only_available_from_broken_custody`.

> Note: `prod.database.host.category` / `prod.database.port.category` carry `source_commit=TBD`
> pending a follow-up to record PR #195's exact merge commit; that lookup is required before
> an execution gate relies on those parameters' `source_commit` containment.

---

## 10. Example Future Shell Gate (illustrative — DOES NOT RUN HERE)

> Non-executing, safe pseudo-code showing how a future command-pack would check the registry
> without printing raw values. Not a production execution script.

```text
# CANDIDATE ONLY — illustrative; not executed by this PR
REG="docs/production-parameter-registry.md"
[ -f "$REG" ] || { echo "stop_line=parameter_registry_doc_missing"; exit 1; }
# extract the fenced block to a temp (no raw secrets are present in it by policy)
awk '/^```buyerrecon-production-parameter-registry-v1$/{f=1;next}/^```$/{f=0}f' "$REG" > "$BLK"
grep -q '^registry_version=1$' "$BLK" || { echo "stop_line=parameter_registry_version_unsupported"; exit 1; }
SEED="$(awk -F= '/^registry_seed_commit=/{print $2}' "$BLK")"
git merge-base --is-ancestor "$SEED" HEAD || { echo "stop_line=parameter_registry_seed_commit_missing"; exit 1; }
# for each required parameter_id: confirm present + current_status=active + shape sufficient
for id in prod.stage0.runner.role prod.stage0.runner.custody.file prod.stage0.runner.dsn.shape; do
  rec="$(awk -v id="$id" 'BEGIN{RS=""} $0 ~ ("parameter_id=" id "(\n|$)")' "$BLK")"
  [ -n "$rec" ] || { echo "stop_line=required_parameter_missing"; exit 1; }
  printf '%s\n' "$rec" | grep -q '^current_status=active$' || { echo "stop_line=required_parameter_not_active"; exit 1; }
done
echo "parameter_registry_raw_values_printed=false"
echo "parameter_registry_gate_result=pass"
echo "stop_line=none"
```

(For the current Stage 0 state this gate would emit
`parameter_registry_gate_result=blocked`,
`stop_line=parameter_only_available_from_broken_custody`, because
`prod.stage0.runner.custody.file` is `current_status=blocked`.)

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
