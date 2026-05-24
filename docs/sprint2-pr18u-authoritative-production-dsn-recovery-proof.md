# Sprint 2 PR#18u: Authoritative Production DSN Recovery / Creation Execution Proof

> Docs-only proof record. No production env, file, secret, DB, network, or
> /var/www change is performed by this PR. The recovery investigation this PR
> records was carried out manually by the operator (Helen) under explicit Helen GO
> scoped to authoritative production DSN recovery / creation proof only.

---

## 1. Status / verdict

**Verdict: BLOCKED.**

Authoritative production DSN recovery / creation execution proof. No authoritative production-only DSN secret was recoverable from existing sources. No DSN value was loaded, handled, printed, or persisted. No DB mutation was performed. No `ALTER ROLE`, no `CREATE ROLE`, no `GRANT`, no credential reset, no fallback to `DATABASE_URL`.

- No `endpointUrl` re-flip.
- No production activation.
- No production traffic creation.
- No customer-facing output.
- No Lane A/B writer activity.
- No `/var/www` edit.
- No production DB mutation.
- No production token provisioning.
- No DB grants.
- No migrations.
- No `schema.sql` change.
- No Track A.
- No Playwright.
- No website ThinSDK production-mode activation.
- No production artifact/config mode flip.
- No Gate 4A re-audit (remains separate later PR).
- No Gate 4B / Gate 4C / Gate 4D / Gate 4E (remain forbidden).

Anchored governance phrases (per `docs/ops/cutover-hard-gates.md` §7) carry forward into PR#18v (dedicated read-only audit credential), the re-run PR#18s binding proof, the DSN-category diagnostic re-run, the Gate 4A re-audit, and the final scoring / governance recap PR:

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this PR exists

The blocked chain leading to PR#18u:

- **PR#18p / PR #48** — Gate 4A read-only audit execution proof. Verdict: BLOCKED. Stop-line: `production_db_category_unexpected`.
- **PR#18q / PR #49** — Production DSN category diagnostic. Verdict: BLOCKED. Root cause: `fallback_selected_staging`.
- **PR#18r / PR #50** — Production DSN establishment / operator secret-binding planning. Defined three binding options and the fail-closed no-fallback-to-`DATABASE_URL` rule.
- **PR#18s / PR #51** — Production DSN binding execution proof. Verdict: BLOCKED. Stop-line: `production_dsn_binding_unavailable`.
- **PR#18t / PR #52** — Authoritative production DSN recovery / creation planning. Defined the source hierarchy, the closed recovery decision-tree enum, the future operator procedure, the future proof schema, and the stop-lines.

PR#18u is the recovery-execution PR planned by PR#18t §9 step 1. Its scope was to consult the §3 source hierarchy (password manager / operator records / existing root-only secret file / DB-admin reset) and identify an authoritative production DSN that PR#18v / PR#18s re-run can bind. PR#18u does **not** advance the Gate 4A re-audit, Gate 4B planning advancement, Gate 4C, Gate 4D, Gate 4E, or any customer-facing surface.

---

## 3. Evidence summary

The categorical evidence below is recorded verbatim from the operator's paste-back. No DSN value, no role password, no DB host, no DB port, no connection string, no token, no hash, no pepper, no Authorization header, no request_id, no session_id, no payload, no response body, no env dump, no vault content, no shell history, no private key, no certificate appears in PR#18u.

### 3.1 Production DB and role presence

- `production_db_exists`: **yes** (`buyerrecon_production` exists on the production Postgres cluster).
- `buyerrecon_staging_db_exists`: **yes** (`buyerrecon_staging` exists on the same cluster; categorical confirmation only, no DSN bound).
- Required roles present on the production cluster:
  - `buyerrecon_migrator`: exists
  - `buyerrecon_internal_readonly`: exists
  - `buyerrecon_customer_api`: exists
  - `buyerrecon_scoring_worker`: exists
  - `buyerrecon_prod_collector_app`: exists
- All five expected roles are present. No role is missing. No role creation, alteration, deletion, or grant change was performed by PR#18u.

### 3.2 Login capability and operator credential holdings

- `buyerrecon_internal_readonly_can_login`: **no** (the role exists but cannot be used to log in; this is consistent with PR#18r §4 / PR#18t §3 expectations for a `NOLOGIN` readonly role that wasn't provisioned for direct shell access).
- `buyerrecon_prod_collector_app_can_login`: **yes** (the runtime collector role is `LOGIN`-capable).
- `attempted_buyerrecon_prod_collector_app_password_validation`: **failed** — the operator does **not** hold the `buyerrecon_prod_collector_app` role password.
- `operator_holds_general_admin_db_access`: **yes** (operator has general/admin DB access via a separate mechanism, e.g. `postgres` superuser via the local admin socket — categorical only, no DSN printed).
- `operator_holds_buyerrecon_prod_collector_app_password`: **no**.
- No password value, hash, prefix, suffix, or length was printed at any point during the validation attempt.

### 3.3 Recovery outcome

- `existing_secret_found`: **no** — no authoritative production-only DSN secret was recoverable from any of the PR#18t §3 source hierarchy candidates (password manager / operator records / existing root-only secret file).
- `secret_recovered_or_created`: **no** — no DSN was recovered, and no creation/reset was attempted because PR#18u's Helen GO did not include DB-admin credential mutation.
- `usable_production_only_dsn_recovered`: **no**.
- `secret_stored_in_binding_path`: **no** — no binding file was created during PR#18u; `/root/buyerrecon-production-db.env` was not written by this PR.
- `fallback_to_DATABASE_URL`: **no** — the PR#18r rule was honoured; the staging `DATABASE_URL` was not used as a substitute despite the production-only source being unavailable.
- `DSN_value_printed`: **no**.
- `generated_password_printed`: **no** (no password was generated; no generation step ran).
- `env_dump_emitted`: **no**.

### 3.4 No DB mutation occurred

PR#18u performed strictly **read-only** introspection on the production cluster. The following classes of action were **not** attempted:

- `ALTER ROLE`: not run.
- `CREATE ROLE`: not run.
- `DROP ROLE`: not run.
- `GRANT` (any form): not run.
- `REVOKE` (any form): not run.
- credential reset (any role): not run.
- credential rotation (any role): not run.
- migrations: not run.
- `schema.sql` change: not performed.
- DML on any table (INSERT/UPDATE/DELETE/TRUNCATE/`\copy` write): not run.
- DDL on any table or index: not run.
- `\password`, `\copy`, `\!`, `\o`: not used.

### 3.5 Cleanup

- `cleanup_done`: **yes**. No DSN was ever loaded into a shell variable during PR#18u, so no `DATABASE_URL` / `PRODUCTION_DATABASE_URL` / `PGPASSWORD` / `PGSERVICE` / `PGPASSFILE` unset was required for secret material specifically. The operator confirmed no sensitive variables remained loaded after the investigation. No file was removed during cleanup.

### 3.6 What this evidence proves and does not prove

Proves:

- The production database (`buyerrecon_production`) exists on the production Postgres cluster.
- All five expected roles exist on the production cluster, including `buyerrecon_internal_readonly` and `buyerrecon_prod_collector_app`.
- `buyerrecon_internal_readonly` is `NOLOGIN` or otherwise cannot be used for direct audit shell access.
- `buyerrecon_prod_collector_app` is `LOGIN`-capable, but the operator does not hold its password.
- The operator's general/admin DB access does not constitute a safe production-only DSN secret suitable for binding under PR#18r's rules.
- No authoritative production-only DSN secret was recoverable from the PR#18t §3 source hierarchy.
- No DSN value, role password, or sensitive metadata was printed, pasted, or persisted in any artifact during the investigation.

Does **not** prove:

- whether `buyerrecon_prod_collector_app`'s password could be reset safely (PR#18u did not attempt; that path was deliberately rejected per Helen's decision in PR#18v's Context — "Do not reset `buyerrecon_prod_collector_app`. Do not use `buyerrecon_migrator` for audit. Create a dedicated production read-only audit/login role.").
- whether production DB roles/grants satisfy migration 016 invariants — that remains `unknown` for production and must be proven in the future Gate 4A re-audit after a safe audit credential is in place.
- whether Lane A/B row counts are zero on production — also `not_attempted`.
- whether Sprint 2 production traffic counts are at the recorded Gate 3 baseline — also `not_attempted`.

---

## 4. Recovery assessment

- **Source category**: `unavailable` for direct existing-source recovery. The PR#18t §3 source hierarchy yielded no usable authoritative DSN: password manager / vault entry not found; operator records did not contain a usable production-only DSN; no pre-existing root-only secret file at any candidate path; operator did not hold the `buyerrecon_prod_collector_app` runtime password.
- **Whether secret was found**: no.
- **Whether secret was recovered/created**: no. Creation/rotation was not attempted because PR#18u's Helen GO did not include DB-admin credential mutation.
- **DSN value excluded from all artifacts**: yes. No DSN value, no role password, no host, no port, no connection string appears anywhere in this proof or in the operator's paste-back.
- **Binding path created or pending**: no binding file was created by PR#18u. `/root/buyerrecon-production-db.env` was not written. Binding remains pending until a dedicated audit credential exists (PR#18v) and is bound by a separate proof (re-run PR#18s).
- **Category check happened**: no. No DSN was loaded into the shell, so no `current_database()` / `current_user` category query was issued by PR#18u.

The single observed outcome is **`existing_source_recovery_failed`** — a precondition failure on the source hierarchy, not a binding-mechanics failure, not a category-rule failure, not a DB-existence or role-existence failure. The follow-up classification, per PR#18t §4 / PR#18u brief §6 closed enum, is **`db_admin_reset_required`**: a dedicated production read-only audit credential must be created under a separate explicitly-approved DB-admin scope.

This is **not**:

- a production DB missing issue (PR#18u proved `production_db_exists=yes`),
- a role missing issue (PR#18u proved all five expected roles exist),
- a category-rule too-strict issue (no category check ran),
- a fallback-misuse issue (the no-fallback-to-`DATABASE_URL` rule was honoured).

---

## 5. Impact on next steps

PR#18u's `BLOCKED` verdict has the following effects on the gate chain:

- **PR#18v** — create / enable a dedicated minimal-read-only production audit/login credential — is now the required next step. Preferred role name: `buyerrecon_prod_audit_readonly`. The credential must be granted only the SELECT permissions Gate 4A §5.F → §5.J needs (`public.ingest_requests`, `public.accepted_events`, `public.rejected_events`, `public.scoring_output_lane_a`, `public.scoring_output_lane_b`). The DSN must be stored in a root-only binding (`/root/buyerrecon-production-db.env`, mode `0600`, owner `root:root`) and the DSN value must never be printed.
- **PR#18s re-run** — production DSN binding execution proof against the new audit credential — runs after PR#18v completes with PASS.
- **DSN-category diagnostic re-run** (PR#18q methodology) — runs after the PR#18s re-run completes with PASS.
- **Gate 4A DB / grant / traffic re-audit** — runs after the DSN-category diagnostic re-run completes with PASS. Verdict must be non-BLOCKED. Migration 016 Lane grant safety invariants are converted from documented expectation to proven categorical fact in this step.
- **Gate 4B execution** and **Gate 4B planning advancement**: **remain forbidden** until the Gate 4A re-audit produces a non-BLOCKED verdict.
- **Gate 4C controlled canary activation**: **remains forbidden**. No `endpointUrl` re-flip is approved.
- **Gate 4D organic observation**: **remains forbidden**.
- **Gate 4E Track A / Playwright**: **remains forbidden**.

Constraints PR#18v must honour (from PR#18r / PR#18t / PR#18u):

- Do **not** reset `buyerrecon_prod_collector_app`.
- Do **not** use `buyerrecon_migrator` as the audit role.
- Do **not** grant INSERT / UPDATE / DELETE on any table.
- Do **not** grant access to `scoring_output_lane_a` / `scoring_output_lane_b` writes; SELECT is permitted and required for the Gate 4A re-audit Lane row-count check.
- Do **not** print the generated password.
- Do **not** print the resulting DSN.
- Do **not** fall back to `DATABASE_URL` in any subsequent binding/load step.
- Do **not** edit any app/runtime env file.
- Do **not** rotate any runtime app credential.
- Do **not** advance Gate 4A re-audit, Gate 4B, Gate 4C, Gate 4D, or Gate 4E.

The final scoring / governance recap PR remains required before any production-cutover readiness claim. Governance locks carried forward (verbatim, from PR#18o §6 and §8, PR#18p §5, PR#18q §5, PR#18r §9, PR#18s §5, PR#18t §10):

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

The recap PR must also carry forward:

- the PR#18p `production_db_category_unexpected` stop-line,
- the PR#18q `fallback_selected_staging` diagnosis,
- the PR#18r planning rule (no fallback to `DATABASE_URL`),
- the PR#18s `production_dsn_binding_unavailable` stop-line,
- the PR#18t recovery planning,
- the PR#18u `existing_source_recovery_failed` stop-line recorded here, classified as `db_admin_reset_required`,
- the PR#18v outcome (when produced),
- the re-run PR#18s binding-execution proof outcome,
- the DSN-category diagnostic re-run outcome,
- the Gate 4A re-audit outcome,
- migration 016 Lane grant safety status — still `unknown` after PR#18u; convert in the follow-up Gate 4A re-audit before any Gate 4B execution or Gate 4C consideration,
- Gate 4A / 4B / 4C / 4D outcomes once recorded.

No production-cutover readiness claim may rely on PR#18u alone.

---

## 6. Boundaries

PR#18u explicitly does **not** approve any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- no DSN value recorded in any artifact,
- no role password recorded in any artifact,
- no env file edit,
- no secret creation completed (no DSN bound; no password generated; no file written),
- no DB mutation (no `ALTER ROLE`, no `CREATE ROLE`, no `DROP ROLE`, no `GRANT`, no `REVOKE`, no DDL, no DML),
- no credential rotation (any role),
- no DB grants (no broadening, no narrowing),
- no token provisioning,
- no migrations,
- no `schema.sql` change,
- no `endpointUrl` re-flip,
- no production traffic creation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no Track A,
- no Playwright,
- no customer-facing output,
- no Lane A/B writer,
- no dashboard implementation,
- no AMS runtime bridge,
- no Pass 1 / Trust / Pass 2 runtime,
- no website ThinSDK production-mode activation,
- no production artifact/config mode flip,
- no Gate 4A re-audit,
- no Gate 4B execution,
- no Gate 4B planning advancement,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no use of `buyerrecon_prod_collector_app` password (operator does not hold it; PR#18u did not attempt reset),
- no use of `buyerrecon_migrator` for audit purposes,
- no use of operator general/admin DB access as a substitute for a safe production-only DSN,
- no fallback to `DATABASE_URL` (PR#18r rule preserved),
- no secrets or sensitive values recorded in any artifact derived from PR#18u.

---

End of PR#18u. **Authoritative production DSN recovery / creation execution proof. Verdict: BLOCKED. Stop-line triggered: `existing_source_recovery_failed`. Recovery classification: `db_admin_reset_required`. The production DB exists, all five expected roles exist, `buyerrecon_internal_readonly` cannot login, `buyerrecon_prod_collector_app` can login but the operator does not hold its password, and no authoritative production-only DSN secret was recoverable from any PR#18t §3 source. No DSN value, no role password, no env file body was printed, pasted, or persisted in any artifact. No DB mutation, no `ALTER ROLE`, no `CREATE ROLE`, no `GRANT`, no credential reset was performed. No fallback to `DATABASE_URL` was used. The required next step is PR#18v: create / enable a dedicated minimal-read-only production audit credential (preferred role name `buyerrecon_prod_audit_readonly`), grant only the SELECT permissions Gate 4A needs, store the DSN in `/root/buyerrecon-production-db.env` at mode `0600` owner `root:root`, and never print the password or DSN. After PR#18v, re-run PR#18s binding-execution proof, then re-run the DSN-category diagnostic, then run the Gate 4A DB/grant/traffic re-audit. Gate 4A re-audit, Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E all remain forbidden until the Gate 4A re-audit produces a non-BLOCKED verdict. No DB writes, no migrations, no `schema.sql` change, no DB grants, no env file edit, no secret creation completed, no secret rotation, no token provisioning, no `endpointUrl` re-flip, no production traffic, no `/var/www` edit, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18u. Any PR#18v credential-creation PR, re-run PR#18s binding-execution PR, DSN-category diagnostic re-run PR, Gate 4A re-audit PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or final scoring / governance recap PR remains separately gated by its own explicit Helen GO.**
