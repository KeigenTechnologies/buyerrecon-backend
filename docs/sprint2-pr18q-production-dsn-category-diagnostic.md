# Sprint 2 PR#18q: Production DSN Category Diagnostic (Read-Only)

> Docs-only / read-only diagnostic. No production env, file, secret, DB, network, or
> /var/www change is performed by this PR. PR#18q records the diagnostic methodology,
> the categorical evidence collected by the operator (Helen) under explicit Helen GO,
> and the root-cause classification. PR#18q does not remediate; it forbids advancement
> past Gate 4A until a separate remediation PR establishes a production DSN binding
> and a follow-up Gate 4A re-audit produces a non-BLOCKED verdict.

---

## 1. Status / verdict

**Verdict: BLOCKED — production DSN binding missing / fallback selected staging.**

PR#18q opened in response to the PR#18p `production_db_category_unexpected` stop-line and has been completed with operator paste-back evidence. The diagnostic establishes the root cause: the production audit shell did not have `PRODUCTION_DATABASE_URL` defined, the operator loader fell back to `DATABASE_URL`, and that fallback DSN resolved to a staging database. The audit therefore correctly halted on the `production_db_category_unexpected` stop-line; no role/grant/count query was ever run against staging under the guise of production.

Gate 4B / Gate 4C / Gate 4D / Gate 4E remain forbidden. The Gate 4A production DB / role / grant / traffic branch must not be retried until a real production DSN source is established by a separate operator secret-binding PR and a follow-up Gate 4A re-audit produces a non-BLOCKED verdict.

Carry-forward boundaries (unchanged from PR#18p):

- No `endpointUrl` re-flip.
- No production activation.
- No production traffic creation.
- No `buyerrecon.com` production `/v1/event` call.
- No Render `/collect` call.
- No `/var/www` edit.
- No production DB mutation.
- No production token provisioning.
- No DB grants.
- No migrations.
- No `schema.sql` change.
- No Track A.
- No Playwright.
- No customer-facing output.
- No Lane A/B writer.
- No dashboard implementation.
- No AMS runtime bridge.
- No Pass 1 / Trust / Pass 2 runtime.
- No website ThinSDK production-mode activation.
- No production artifact/config mode flip.
- No env file edit.
- No secret rotation.

Anchored governance phrases (per `docs/ops/cutover-hard-gates.md` §7) carry into the remediation PR and any follow-up Gate 4A re-audit:

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this PR exists

PR#18p / PR #48 recorded the Gate 4A read-only audit execution proof with:

- **Verdict: BLOCKED.**
- **Stop-line triggered: `production_db_category_unexpected`.**

In the §5.F DB branch of the PR#18o runbook, the operator loaded a DSN into the audit shell from an out-of-band secret source (the DSN value was not printed). The audit then ran the categorical `current_database()` query. The category of the connected database returned **unexpected** — that is, the DSN that loaded did not categorise as the intended production DB. The audit halted the DB branch immediately, leaving these PR#18p §3.4 fields `not_attempted`:

- `lane_grant_safety_pass`
- `buyerrecon_migrator_all`
- `buyerrecon_internal_readonly_select_only`
- `buyerrecon_customer_api_no_access`
- `buyerrecon_scoring_worker_no_lane_access`
- `public_no_lane_access`
- `lane_counts_category`

Downstream, §5.G traffic counts (`ingest_requests_endpoint_v1_event_count`, `accepted_events_count`, `rejected_events_count`) and §5.H health check (`health_check_status_class`) were also `not_attempted`.

The PR#18p closing block forbids Gate 4B / 4C / 4D / 4E execution until "a separate diagnostic/fix PR resolves the DSN category mismatch and a follow-up Gate 4A re-audit produces a non-BLOCKED verdict." PR#18q is that separate diagnostic PR — its scope is to identify why the loaded DSN did not categorise as production, without printing the DSN or any other secret.

PR#18q does **not** authorise:

- changing any env file,
- rotating any secret,
- mutating any DB row,
- granting any privilege,
- running any migration,
- editing `schema.sql`,
- re-flipping `endpointUrl`,
- creating production traffic,
- executing Gate 4A again,
- executing Gate 4B / 4C / 4D / 4E,
- emitting any customer-facing output.

---

## 3. Diagnostic methodology and operator brief

The diagnostic answered four categorical questions (A–D) using only read-only operator commands. The operator brief below is the methodology Helen executed. PR#18q records the categorical evidence Helen pasted back; the operator brief itself is preserved so future re-audits and the final recap PR can verify the methodology.

### Operator shell prerequisites (executed before §3.A)

```
set +x
unset HISTFILE
umask 077
```

Confirmed before execution:

- command-echo off,
- shell history capture off,
- umask `077`,
- the operator was on the explicitly-named production/web host category (same host class as PR#18p),
- the operator shell was single-use, not parallel, not long-running automation,
- categorical outputs only; no DSN value, no token, no payload, no identifier was pasted back.

### §3.A — Which env var was loaded?

Inspect the **presence** of candidate DSN env vars on the operator's audit shell **and** in the recorded production env source. Do **not** print values. Do **not** `cat` the env file. Do **not** dump `env`.

```
# Presence in the operator audit shell.
test -n "${PRODUCTION_DATABASE_URL:-}" && echo PRODUCTION_DATABASE_URL_in_shell=yes || echo PRODUCTION_DATABASE_URL_in_shell=no
test -n "${DATABASE_URL:-}"            && echo DATABASE_URL_in_shell=yes            || echo DATABASE_URL_in_shell=no

# Presence as a variable name (not value) in the recorded production env file.
grep -c '^PRODUCTION_DATABASE_URL='  <recorded_production_env_file_path> 2>/dev/null || echo 0
grep -c '^DATABASE_URL='             <recorded_production_env_file_path> 2>/dev/null || echo 0

# Operator loader source category — name only.
echo operator_loader_source_category=<vault|secret_store|env_file|other|unknown>
```

Forbidden: printing any DSN value, `cat`/`head`/`tail`/`less`/`more` of the env file, `env`/`printenv`/`set` dumps, copying the env file to a paste-able location.

### §3.B — What category does the connected DB identify as?

The operator loaded the DSN from the available env var (without printing it), ran a category-only `psql` query that produced only booleans and a closed enum category, then unset the DSN immediately.

Forbidden during §3.B: `SELECT *`, any DML/DDL/GRANT/REVOKE/TRUNCATE, any `\password`, `\copy`, `\!`, `\o`, continuing past `dsn_loaded=no`.

### §3.C — What source created the mismatch?

Combine §3.A and §3.B booleans into the root-cause classification (see §4).

### §3.D — What next action is required?

Map the root-cause classification to one of the closed follow-up actions (see §5).

### Cleanup (executed after §3.B)

```
unset DATABASE_URL
unset PRODUCTION_DATABASE_URL
unset PGPASSWORD
unset PGSERVICE
unset PGPASSFILE
rm -f "<operator_scratch_report_path>"
test -z "${DATABASE_URL:-}" && echo cleanup_dsn_unset=yes || echo cleanup_dsn_unset=no
test ! -f "<operator_scratch_report_path>" && echo cleanup_scratch_removed=yes || echo cleanup_scratch_removed=no
```

No `/var/www` file, backup, log, or repo file was removed during cleanup.

---

## 3.x Evidence collected

The categorical evidence below is recorded verbatim from the operator's pasted execution block. No DSN value, raw DB name, raw user name, token, hash, pepper, header, request_id, session_id, payload, response body, env dump, vault content, shell history, private key, or certificate appears in PR#18q.

### 3.x.1 §3.A — env-var presence

- `PRODUCTION_DATABASE_URL_present`: no
- `DATABASE_URL_present`: yes
- `fallback_used`: yes (operator loader fell back from `PRODUCTION_DATABASE_URL` to `DATABASE_URL`)
- `dsn_value_printed_anywhere`: no

### 3.x.2 §3.B — DB category

- `dsn_loaded`: yes (the fallback DSN loaded into the audit shell without printing)
- `production_name_match`: no
- `staging_name_match`: yes
- `db_name_category`: **staging**
- `current_user_category`: `buyerrecon_role` (operator-reported categorical label; recorded as paste-back, not inferred)
- No raw database name was printed.
- No raw user name was printed.
- No DSN value was printed.

### 3.x.3 Cleanup

- `cleanup_dsn_unset`: yes
- `cleanup_done`: yes
- No `/var/www` file, backup, log, or repo file was removed during cleanup.

### 3.x.4 What this evidence proves and does not prove

Proves:

- `PRODUCTION_DATABASE_URL` was **absent** on the audit shell at execution time.
- The operator loader **selected the `DATABASE_URL` fallback**.
- That fallback DSN resolved to a **staging** database, not production.
- The PR#18p audit therefore halted on `production_db_category_unexpected` correctly; no role/grant/count query was run against staging under the guise of production.

Does **not** prove:

- whether a `PRODUCTION_DATABASE_URL` exists in any other source (vault, secret store, alternate env file) and was simply not bound into the operator audit shell.
- whether production DB roles, grants, Lane counts, or Sprint 2 traffic counts satisfy migration 016 invariants — those PR#18p §3.4 / §3.5 fields remain `not_attempted` and must be re-attempted in a follow-up Gate 4A re-audit **only after a production DSN is established**.
- whether any other env binding (token, pepper, host) is correctly configured for production — this diagnostic is scoped to the DSN category mismatch only.

---

## 4. Root-cause classification (closed enum)

**Selected: `fallback_selected_staging`.**

The operator audit shell did not have `PRODUCTION_DATABASE_URL` set. The loader fell back to `DATABASE_URL`, and that fallback DSN pointed at a staging database (categorical: `db_name_category=staging`, `staging_name_match=yes`, `production_name_match=no`).

Negative discriminators (explicitly **not** the root cause):

- **Not** `category_rule_too_strict` — the PR#18o §5.F category rule correctly detected staging as not-production. The rule did its job. The mismatch is in the env binding, not in the rule.
- **Not** `db_name_convention_unexpected_but_safe` — the DB the fallback resolved to is staging, not a production DB hidden behind an unconventional name.
- **Not** `dsn_points_to_unknown` — the DB is positively identified as staging (`staging_name_match=yes`), not as an unknown / unclassifiable target.
- **Not** `wrong_env_var_selected` — the operator did not pick the wrong env var by mistake; `PRODUCTION_DATABASE_URL` simply did not exist on the audit shell, forcing the loader's fallback path.
- **Not** `dsn_points_to_staging` (no fallback) — this label is reserved for cases where a single non-fallback DSN was loaded and pointed at staging. Here a fallback was used; that nuance is captured by `fallback_selected_staging`.
- **Not** `unable_to_determine` — the evidence is sufficient to classify the root cause.

---

## 5. Required follow-up (closed set)

Two follow-up actions are selected; a third is always required:

- **Selected: `fix_env_secret_binding`** — open a separate operator secret-binding PR that establishes a `PRODUCTION_DATABASE_URL` binding for the production audit shell. The actual binding work happens under a separate PR with its own scope, stop-lines, and proof closure. PR#18q does not inline-edit any env file, does not rotate any secret, and does not provision any token.
- **Selected: `rerun_gate4a_db_grant_traffic_branch`** — only after the operator secret-binding PR is merged and proven. The follow-up Gate 4A re-audit must re-run §5.F → §5.J of the merged PR#18o runbook against the real production DSN, with the same secret-safety boundaries, and must record a non-BLOCKED verdict.
- **Always-required: `keep_gate4b_gate4c_blocked`** — Gate 4B execution, Gate 4C, Gate 4D, and Gate 4E remain forbidden until the follow-up Gate 4A re-audit produces a non-BLOCKED verdict. Gate 4B planning advancement is also forbidden by PR#18q.

Critical safety constraint:

- **Do not run production grant checks or traffic counts using the fallback `DATABASE_URL`** because that DSN is staging. Any future Gate 4A re-audit must verify `PRODUCTION_DATABASE_URL_present=yes` (or otherwise establish that the loaded DSN is production-category) **before** running any §5.F role/grant/count query, any §5.G traffic count, or any §5.H health check.

The final scoring / governance recap PR remains required before any production-cutover readiness claim. The recap PR must carry forward, verbatim:

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

The recap PR must also carry forward:

- the PR#18p `production_db_category_unexpected` stop-line,
- the PR#18q diagnostic outcome (`fallback_selected_staging`),
- the operator secret-binding PR outcome,
- the follow-up Gate 4A re-audit outcome,
- migration 016 Lane grant safety status — still `unknown` after PR#18p; convert in the follow-up Gate 4A re-audit before any Gate 4B execution or Gate 4C consideration,
- Gate 4A / 4B / 4C / 4D outcomes once recorded.

No production-cutover readiness claim may rely on PR#18q alone.

---

## 6. Boundaries

PR#18q explicitly does **not** approve any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- no DB writes (no DML, no DDL, no GRANT/REVOKE/TRUNCATE),
- no migrations,
- no `schema.sql` change,
- no DB grants (no broadening, no narrowing),
- no env file edit,
- no secret rotation,
- no token provisioning,
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
- no Gate 4A re-execution by PR#18q (the §3 operator brief is the methodology Helen executed; PR#18q does not re-run it),
- no Gate 4B execution,
- no Gate 4B planning advancement,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no inline DSN-value diagnosis (DSN must never be printed),
- no production grant checks or traffic counts via the fallback `DATABASE_URL` (it is staging),
- no secrets or sensitive values recorded in any artifact derived from PR#18q.

---

End of PR#18q. **Production DSN category diagnostic (read-only). Verdict: BLOCKED — production DSN binding missing / fallback selected staging. Root cause: `fallback_selected_staging`. Required follow-up: separate operator secret-binding PR establishing `PRODUCTION_DATABASE_URL`, then a follow-up Gate 4A re-audit of the §5.F → §5.J branch against the real production DSN. Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E remain forbidden. No DB writes, no migrations, no `schema.sql` change, no DB grants, no env file edit, no secret rotation, no token provisioning, no `endpointUrl` re-flip, no production traffic, no `/var/www` edit, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18q. Any operator secret-binding PR, Gate 4A re-audit PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or final scoring / governance recap PR remains separately gated by its own explicit Helen GO.**
