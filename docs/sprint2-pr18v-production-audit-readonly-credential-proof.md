# Sprint 2 PR#18v: Dedicated Production Audit Read-Only Credential Execution Proof

> Docs-only proof record. No `/var/www` change, no `endpointUrl` re-flip, no
> production traffic, no Gate 4A re-audit, and no Gate 4B / 4C / 4D / 4E work
> are performed by this PR. The credential-creation and binding work this PR
> records was carried out manually by the operator (Helen) under explicit
> Helen GO scoped to dedicated production audit read-only credential creation
> / binding proof only.

---

## 1. Status / verdict

**Verdict: PASS.**

Dedicated production audit read-only credential proof.

- No Gate 4A re-audit.
- No `endpointUrl` re-flip.
- No production traffic generation.
- No customer-facing output.
- No Lane A/B writer activity.
- No `/var/www` edit.
- No `buyerrecon_prod_collector_app` reset.
- No `buyerrecon_migrator` reset.
- No app / runtime credential change.
- No INSERT / UPDATE / DELETE grants on any table.
- No ownership change.
- No migrations.
- No `schema.sql` change.
- No Track A.
- No Playwright.
- No website ThinSDK production-mode activation.
- No production artifact/config mode flip.
- No Gate 4B / Gate 4C / Gate 4D / Gate 4E (remain forbidden).

Anchored governance phrases (per `docs/ops/cutover-hard-gates.md` §7) carry forward into the PR#18s binding-proof confirmation step, the DSN-category diagnostic re-run (if required), the Gate 4A DB/grant/traffic re-audit, and the final scoring / governance recap PR:

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this PR exists

The blocked chain leading to PR#18v:

- **PR#18p / PR #48** — Gate 4A read-only audit execution proof. Verdict: BLOCKED. Stop-line: `production_db_category_unexpected`.
- **PR#18q / PR #49** — Production DSN category diagnostic. Verdict: BLOCKED. Root cause: `fallback_selected_staging`.
- **PR#18r / PR #50** — Production DSN establishment / operator secret-binding planning. Defined the fail-closed no-fallback-to-`DATABASE_URL` rule and the three binding-option taxonomy.
- **PR#18s / PR #51** — Production DSN binding execution proof. Verdict: BLOCKED. Stop-line: `production_dsn_binding_unavailable`.
- **PR#18t / PR #52** — Authoritative production DSN recovery / creation planning. Defined the source hierarchy and the closed recovery decision-tree enum.
- **PR#18u / PR #53** — Authoritative production DSN recovery / creation execution proof. Verdict: BLOCKED. Stop-line: `existing_source_recovery_failed`. Recovery classification: `db_admin_reset_required`. Showed that the production DB and roles exist but no usable production-only DSN secret was recoverable from existing sources; explicitly forbade resetting `buyerrecon_prod_collector_app`, forbade using `buyerrecon_migrator` for audit, and required a dedicated minimal-read-only production audit credential next.

PR#18v is that dedicated credential PR. Its scope was to create the `buyerrecon_prod_audit_readonly` role on the production cluster, grant only the SELECT permissions Gate 4A §5.F → §5.J needs, store the resulting DSN in `/root/buyerrecon-production-db.env` (mode `0600`, owner `root:root`), and verify the binding categorically without ever printing the password or DSN value. PR#18v does **not** advance the Gate 4A DB/grant/traffic re-audit, Gate 4B planning advancement, Gate 4C, Gate 4D, Gate 4E, or any customer-facing surface.

---

## 3. Execution evidence

The categorical evidence below is recorded verbatim from the operator's paste-back. No DSN value, no generated password, no role password, no DB host, no DB port, no connection string, no token, no hash, no pepper, no Authorization header, no request_id, no session_id, no payload, no response body, no env dump, no vault content, no shell history, no private key, no certificate appears in PR#18v.

### 3.1 Shell posture

- `host_category`: production
- `operator_user_category`: root / postgres_admin
- `shell_trace`: off (no `set -x` echo)
- `histfile_unset`: yes (no shell-history capture)
- `umask_077`: yes (operator-only file mode in effect)

### 3.2 DB-admin preflight

- `buyerrecon_production_db_exists`: yes
- `buyerrecon_staging_db_exists`: yes (categorical confirmation only; no DSN bound)
- `audit_role_exists_before`: no

### 3.3 Audit role creation

- `audit_role_exists_after`: yes
- `audit_role_can_login`: yes
- `audit_role_created_or_rotated`: **created** (the role did not exist before PR#18v; a fresh role was created, not a rotation of a pre-existing one)
- `audit_role_name`: `buyerrecon_prod_audit_readonly`

The role's password was generated into a shell variable via `openssl rand -base64 48`, consumed by the role-creation `psql` heredoc and by the binding-file write, and then `unset`. The password was never echoed, never `cat`'d, never written to shell history, never pasted, never screenshotted, and never persisted anywhere except as the password portion of the DSN inside the root-only binding file (which itself is at mode `0600` owner `root:root`; see §3.4).

### 3.4 Binding file posture (root-only secret file)

- `production_secret_file_created`: yes
- `production_secret_file_path_category`: `root_only_operator_secret_file` (file at `/root/buyerrecon-production-db.env`)
- `production_secret_file_mode_600`: yes
- `production_secret_file_owner_root_root`: yes

No `cat`/`head`/`tail` of the binding file was performed. The file body was never printed or copied to a paste-able location.

### 3.5 DSN load and category verification

- `PRODUCTION_DATABASE_URL_present`: yes
- `DATABASE_URL_fallback_used`: no (PR#18r rule honoured end-to-end; the staging `DATABASE_URL` was not used as a substitute at any point)
- `dsn_loaded_from_production_binding`: yes
- `db_name_category`: production
- `production_name_match`: yes
- `staging_name_match`: no
- `current_user_category`: `production_audit_readonly` (the connected user is `buyerrecon_prod_audit_readonly`, recorded by category, not as a raw row)

### 3.6 Required SELECT access proof (Gate 4A audit tables)

Count-only access checks issued by the new audit role, using the loaded DSN:

- `ingest_requests_count_access`: yes
- `accepted_events_count_access`: yes
- `rejected_events_count_access`: yes
- `lane_a_count_access`: yes
- `lane_b_count_access`: yes

The audit role can satisfy the Gate 4A §5.F → §5.G read-only count and presence checks for all five required tables. No raw row, payload, identifier, or header was returned by any query.

### 3.7 Lane A/B DML privilege proof

Per-privilege booleans for the audit role on the Lane A/B writer-protected tables, via `sudo -u postgres has_table_privilege(...)`:

- `audit_role_lane_a`: `S=true I=false U=false D=false`
- `audit_role_lane_b`: `S=true I=false U=false D=false`

`S=true` is required for Gate 4A's Lane row-count check. `I=false`, `U=false`, `D=false` confirm the audit role has **no** writer capability against the Lane A/B tables — migration 016 / PR#18l Lane grant-safety posture for writer-class operations is preserved end-to-end for the new role.

### 3.8 Cleanup

- `cleanup_dsn_unset`: yes (`DATABASE_URL` and `PRODUCTION_DATABASE_URL` unset from the session shell after verification)
- `cleanup_done`: yes
- The binding file at `/root/buyerrecon-production-db.env` was **not** removed — it persists as the production-only secret source for future Gate 4A re-audit work. Only ephemeral session shell variables were unset.

### 3.9 Secret-exclusion verification

- `DSN_value_printed`: no
- `generated_password_printed`: no

**Clarification on password absence**: the generated role password was *intentionally never printed*. It was generated into a transient shell variable via `openssl rand -base64 48`, consumed by the role-creation `psql` heredoc, used to construct the DSN inside the binding-file write (via a Python heredoc with proper percent-encoding via `urllib.parse.quote`), and then `unset` immediately. Password absence from terminal output and from any paste-back is the *expected and required* state, not an oversight. The connection-proof evidence in §3.5 / §3.6 / §3.7 is fully categorical: the binding loaded successfully, connected to the production database, satisfied the §3.6 count-access checks, and produced the §3.7 SELECT-only privilege booleans.

---

## 4. Credential and binding assessment

- **Role created or rotated**: **created**. Prior state: role did not exist on the production cluster (`audit_role_exists_before=no`). Post state: role exists and is `LOGIN`-capable (`audit_role_exists_after=yes`, `audit_role_can_login=yes`).
- **Binding file created**: **yes**, at `/root/buyerrecon-production-db.env`.
- **File mode / owner**: mode `0600`, owner `root:root`. Posture matches PR#18r §4 Option B requirements exactly.
- **Production category**: **matched**. `db_name_category=production`, `production_name_match=yes`, `staging_name_match=no`. The PR#18o §5.F category rule recognised the connected database as production with no ambiguity.
- **Fallback disabled**: **yes**. `DATABASE_URL_fallback_used=no` throughout. The PR#18r no-fallback-to-`DATABASE_URL` rule was honoured by the binding file's content (production DSN loaded via `PRODUCTION_DATABASE_URL` only) and by the load step (`DATABASE_URL` was re-exported *from* `PRODUCTION_DATABASE_URL` after the presence check succeeded, never from the staging fallback).
- **Required table SELECT access**: **yes** on all five Gate 4A tables (`public.ingest_requests`, `public.accepted_events`, `public.rejected_events`, `public.scoring_output_lane_a`, `public.scoring_output_lane_b`).
- **Lane A/B DML privileges**: **false** for INSERT / UPDATE / DELETE on both `scoring_output_lane_a` and `scoring_output_lane_b`. The audit role cannot write Lane output. SELECT remains `true` to enable the Gate 4A Lane row-count check only.
- **No password / DSN printed**: confirmed. Both `DSN_value_printed=no` and `generated_password_printed=no`. See §3.9 for the methodology that achieves this.
- **No collateral mutation**: PR#18v did **not** alter `buyerrecon_prod_collector_app` (runtime collector role left as-is), did **not** alter `buyerrecon_migrator` (migration admin role left as-is), did **not** alter existing Lane writer grants on any other role (migration 016 / PR#18l posture for `buyerrecon_migrator`, `buyerrecon_internal_readonly`, `buyerrecon_customer_api`, `buyerrecon_scoring_worker`, and `PUBLIC` is preserved on the existing roles; PR#18v only added grants to the new `buyerrecon_prod_audit_readonly` role).

The credential and binding now satisfy the prerequisites that the Gate 4A DB/grant/traffic re-audit requires from the PR#18o §5.F runbook §B / §F operator-procedure steps.

---

## 5. Impact on next steps

PR#18v's `PASS` verdict has the following effects on the gate chain:

- **PR#18s binding-proof status**: this PR explicitly records every PR#18s binding-proof field (`production_secret_file_created=yes`, `production_secret_file_path_category=root_only_operator_secret_file`, `production_secret_file_mode_600=yes`, `production_secret_file_owner_root_root=yes`, `PRODUCTION_DATABASE_URL_present=yes`, `DATABASE_URL_fallback_used=no`, `dsn_loaded_from_production_binding=yes`, `db_name_category=production`, `production_name_match=yes`, `staging_name_match=no`, `cleanup_done=yes`, `DSN_value_printed=no`). PR#18s can therefore be considered **satisfied by this proof** without a separate re-run. If preferred for audit-trail clarity, a short PR#18s re-confirmation PR may still be opened; that PR would be a no-execution docs-only confirmation of the fields recorded here, not a re-binding.
- **PR#18q-style DSN-category diagnostic re-run**: the diagnostic's `PASS` criteria (`PRODUCTION_DATABASE_URL_present=yes`, `fallback_used=no`, `db_name_category=production`, `production_name_match=yes`, `staging_name_match=no`, `cleanup_done=yes`) are all satisfied by this proof's §3.5 evidence. A separate diagnostic re-run is optional for audit-trail clarity; the categorical evidence already exists.
- **Gate 4A DB / grant / traffic re-audit**: **remains a separate later PR**. PR#18v has prepared the credential and binding; the re-audit itself must run the PR#18o §5.F → §5.J methodology against the new binding under its own explicit Helen GO and produce its own proof closure. PR#18v does not run the re-audit.
- **Gate 4B execution and Gate 4B planning advancement**: **remain forbidden** until the Gate 4A re-audit produces a non-BLOCKED verdict.
- **Gate 4C controlled canary activation**: **remains forbidden**. No `endpointUrl` re-flip is approved.
- **Gate 4D organic observation**: **remains forbidden**.
- **Gate 4E Track A / Playwright**: **remains forbidden**.

Required follow-up sequence (none authorised by PR#18v alone; each step requires its own explicit Helen GO):

1. **(Optional) PR#18s binding-proof re-confirmation PR** — docs-only, recording that the §3.4 / §3.5 fields recorded here are sufficient for the binding-proof closure, or running a short re-confirmation script that re-loads the binding and re-records the same categorical fields.
2. **(Optional) PR#18q-style DSN-category diagnostic re-run PR** — docs-only confirmation that §3.5 fields satisfy the diagnostic's PASS criteria.
3. **Gate 4A DB / grant / traffic re-audit PR** (PR#18o §5.F → §5.J methodology). Verdict must be non-BLOCKED. Migration 016 Lane grant safety invariants are converted from documented expectation to proven categorical fact in this step (the `buyerrecon_prod_audit_readonly` role's SELECT-only posture on Lane A/B is already verified by §3.7 here; the re-audit additionally verifies that `buyerrecon_migrator`, `buyerrecon_internal_readonly`, `buyerrecon_customer_api`, `buyerrecon_scoring_worker`, and `PUBLIC` retain their migration-016 posture, per PR#18o §5.F).
4. **Gate 4B planning advancement** and **Gate 4B no-deploy artifact/config bundle check**, only after step 3's non-BLOCKED verdict. Separately gated.
5. **Gate 4C controlled canary activation**, only after Gate 4B passes. Separately gated. Earliest sub-gate that could consider any `endpointUrl` re-flip.
6. **Gate 4D organic observation** and **Gate 4E Track A / Playwright**, each separately gated and later.
7. **Final scoring / governance recap PR**, before any production-cutover readiness claim.

The recap PR must carry forward, verbatim:

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
- the PR#18u `existing_source_recovery_failed` stop-line and `db_admin_reset_required` classification,
- the PR#18v `PASS` verdict recorded here, including the `buyerrecon_prod_audit_readonly` role and the `/root/buyerrecon-production-db.env` binding posture,
- the Gate 4A re-audit outcome,
- migration 016 Lane grant safety status — partially observed for `buyerrecon_prod_audit_readonly` here (SELECT-only on Lane A/B); the full migration-016 conversion for the other four roles + `PUBLIC` remains to be proven in the Gate 4A re-audit,
- Gate 4A / 4B / 4C / 4D outcomes once recorded.

No production-cutover readiness claim may rely on PR#18v alone.

---

## 6. Boundaries

PR#18v explicitly does **not** approve any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- no `endpointUrl` re-flip,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no production DB mutation beyond the narrow scope explicitly approved by Helen GO for PR#18v (create the `buyerrecon_prod_audit_readonly` role; grant `CONNECT` / `USAGE` / `SELECT` only on the five Gate 4A tables; create the root-only binding file),
- no `buyerrecon_prod_collector_app` reset,
- no `buyerrecon_migrator` reset,
- no app/runtime credential reset of any role,
- no INSERT / UPDATE / DELETE / ALL / ownership grants on any table,
- no migrations,
- no `schema.sql` change,
- no token provisioning,
- no `/opt/buyerrecon-backend/.env` edit,
- no other env file edit,
- no Track A,
- no Playwright,
- no customer-facing output,
- no Lane A/B writer activation,
- no dashboard implementation,
- no AMS runtime bridge,
- no Pass 1 / Trust / Pass 2 runtime,
- no website ThinSDK production-mode activation,
- no production artifact/config mode flip,
- no Gate 4A re-audit by PR#18v,
- no Gate 4B execution,
- no Gate 4B planning advancement,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no DSN-value or password printing in any artifact derived from PR#18v,
- no fallback to `DATABASE_URL` for any future production-side load (rule preserved from PR#18r and PR#18u).

---

End of PR#18v. **Dedicated production audit read-only credential execution proof. Verdict: PASS. Role `buyerrecon_prod_audit_readonly` created on the production cluster with LOGIN capability; granted CONNECT on `buyerrecon_production`, USAGE on schema `public`, and SELECT on the five Gate 4A audit tables (`public.ingest_requests`, `public.accepted_events`, `public.rejected_events`, `public.scoring_output_lane_a`, `public.scoring_output_lane_b`); no INSERT / UPDATE / DELETE on Lane A/B; DSN stored in `/root/buyerrecon-production-db.env` at mode `0600` owner `root:root`; `PRODUCTION_DATABASE_URL_present=yes`; `DATABASE_URL_fallback_used=no`; `dsn_loaded_from_production_binding=yes`; `db_name_category=production`; `current_user_category=production_audit_readonly`; all five required count_access checks pass; Lane A/B privileges `S=true I=false U=false D=false`; cleanup complete; no password or DSN printed in any artifact. `buyerrecon_prod_collector_app` and `buyerrecon_migrator` were not reset. The Gate 4A DB/grant/traffic re-audit remains a separate later PR under its own explicit Helen GO. Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E remain forbidden until the Gate 4A re-audit produces a non-BLOCKED verdict. No DB writes beyond the scoped grants, no migrations, no `schema.sql` change, no env file edit, no app/runtime credential reset, no `endpointUrl` re-flip, no production traffic, no `/var/www` edit, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18v. Any optional PR#18s re-confirmation PR, optional DSN-category diagnostic re-run PR, Gate 4A re-audit PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or final scoring / governance recap PR remains separately gated by its own explicit Helen GO.**
