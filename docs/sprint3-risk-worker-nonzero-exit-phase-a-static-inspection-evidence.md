# Sprint 3 risk-worker nonzero-exit Phase A static inspection evidence

Status: RISK_WORKER_NONZERO_EXIT_PHASE_A_STATIC_INSPECTION_EVIDENCE

## Scope

This is docs-only evidence for Phase A static source inspection after PR #332.

No production command, SQL, psql, DB mutation, worker rerun, runtime classifier, source/config fix, DSN edit, secret-file edit, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action occurred.

## Context

- Base branch: sprint2-architecture-contracts-d4cc2bf
- Required base: 7bff20105539b79ff97fd2cca781e60467f1a0a9
- PR #332 planned the safe diagnostic command pack.
- PR #331 recorded the first internal risk-worker run blocked at worker_exit_nonzero.
- This evidence does not diagnose the runtime failure cause.
- This evidence does not classify private worker output.
- This evidence does not read run.safe.out or run.err.

## Safe labels

- risk_worker_nonzero_exit_diagnostic_attempted=true
- pr332_merge_present=true
- tracked_working_tree_clean=true
- diagnostic_scope=phase_a_static_source_inspection
- static_source_inspection_completed=true
- package_script_present=true
- runner_file_present=true
- worker_source_present=true
- command_shape_expected=true
- record_only_guard_present=true
- database_url_expected_by_worker=true
- risk_worker_role_expected=buyerrecon_risk_worker
- raw_worker_stdout_printed=false
- raw_worker_stderr_printed=false
- run_safe_out_copied_to_evidence=false
- run_err_copied_to_evidence=false
- diagnostic_classifier_used=false
- diagnostic_category=unknown_or_unclassified
- diagnostic_result=classified
- worker_rerun_executed=false
- db_mutation_executed=false
- sql_or_psql_executed=false
- role_or_grant_change_executed=false
- source_or_config_change_executed=false
- secret_file_created_or_edited=false
- lane_scoring_executed=false
- ams_runtime_executed=false
- customer_output_executed=false
- gate4e_executed=false
- gate4f_executed=false
- dsn_printed=false
- credential_printed=false
- host_port_printed=false
- env_file_value_printed=false
- raw_postgres_error_printed=false
- pg_hba_printed=false
- raw_customer_payload_printed=false
- raw_accepted_events_payload_printed=false
- raw_canonical_jsonb_printed=false
- raw_request_or_session_identifier_printed=false

## Interpretation

Phase A static source inspection completed.

The existing command shape is:

`npm run risk-evidence:run` → `tsx scripts/run-risk-evidence-worker.ts`

The static inspection confirms only repo/source shape. It does not classify the runtime nonzero exit. The runtime cause remains unknown unless a later separately GO-gated classifier runs.

Any Phase B runtime classifier, fix, rerun, Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F action requires a later separate explicit Helen GO.
