# Sprint 2 PR#18r: Production DSN Establishment / Operator Secret-Binding Planning

> Docs-only planning. No secret is written, no env file is edited, no DB command is
> executed, no DSN value is recorded, no Gate 4A is re-attempted, and no Gate 4B /
> 4C / 4D / 4E work is approved by this PR.

---

## 1. Status / verdict

**PLANNING ONLY — production DSN establishment / operator secret-binding planning.**

- No secret written.
- No env file changed.
- No DB command executed.
- No DSN value handled (no read, no write, no print, no paste).
- No DB grants.
- No token provisioning.
- No secret rotation.
- No migrations.
- No `schema.sql` change.
- No `endpointUrl` re-flip.
- No production traffic.
- No `/var/www` edit.
- No Track A.
- No Playwright.
- No customer-facing output.
- No Lane A/B writer.
- No dashboard implementation.
- No AMS runtime bridge.
- No Pass 1 / Trust / Pass 2 runtime.
- No website ThinSDK production-mode activation.
- No production artifact/config mode flip.
- No Gate 4A re-execution.
- No Gate 4B / Gate 4C / Gate 4D / Gate 4E.

This PR records planning content only. Any concrete operator binding step must be carried out under a separate explicit Helen GO with its own scope, stop-lines, and proof closure.

Anchored governance phrases (per `docs/ops/cutover-hard-gates.md` §7) carry forward into the binding-execution PR, the follow-up DSN-category diagnostic re-run, the Gate 4A re-audit, and the final scoring / governance recap PR:

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

PR#18q / PR #49 diagnosed the root cause:

- **Verdict: BLOCKED — production DSN binding missing / fallback selected staging.**
- **Root cause: `fallback_selected_staging`.**

The categorical evidence in PR#18q established:

- `PRODUCTION_DATABASE_URL_present`: no
- `DATABASE_URL_present`: yes
- `dsn_loaded`: yes
- `fallback_used`: yes
- `db_name_category`: staging
- `production_name_match`: no
- `staging_name_match`: yes
- `current_user_category`: `buyerrecon_role`
- `cleanup_dsn_unset`: yes
- `cleanup_done`: yes

The operator audit shell did not have `PRODUCTION_DATABASE_URL` defined; the loader fell back to `DATABASE_URL`; that fallback DSN categorised as a staging database, not production. PR#18p's `production_db_category_unexpected` halt was therefore correct, and Gate 4A DB / role / grant / traffic / health branches were not run against staging under the guise of production.

A future Gate 4A re-audit needs a correctly-bound production DSN. PR#18r plans how that binding can be established safely, without printing or persisting the DSN value in any artifact, and without fallback to `DATABASE_URL`.

---

## 3. Desired future state

A future operator audit shell can load a production DSN safely from a dedicated production-only binding — typically `PRODUCTION_DATABASE_URL`, but the binding name itself can be chosen during the binding-execution PR as long as it is explicitly documented and is distinct from `DATABASE_URL`.

Rules the future state must satisfy:

- **No fallback to `DATABASE_URL` for the Gate 4A production DB branch.** If `PRODUCTION_DATABASE_URL` (or the chosen production-only binding) is absent, the audit fails closed and halts the DB branch without attempting any fallback.
- **No mixing of production and staging DSNs in the same shell.** If the staging `DATABASE_URL` is present in the same shell, the production audit must still resolve the production DSN exclusively via the production-only binding, never via the staging variable.
- **No DSN value is printed.** Not to terminal, not to log, not to PR comment, not to chat, not to repo, not to scratch file, not to screenshot, not to shell history.
- **No env dump.** No `env`, `printenv`, or `set` listing that exposes DSN values. Name-only presence checks (`test -n "${PRODUCTION_DATABASE_URL:-}"`) are permitted.
- **Categorical DB identification only.** After loading, the DB is identified via the safe category query (boolean `production_name_match`, `staging_name_match`, and a closed enum `db_name_category`), per PR#18q §3.B methodology.
- **Cleanup mandatory.** The DSN env vars are unset at the end of every audit shell session and the operator confirms the unset state categorically.

---

## 4. Secret-binding options (planning only)

The binding-execution PR must select **exactly one** of the options below (or document a hybrid with explicit operator approval). PR#18r endorses none of them; it surfaces tradeoffs so the binding-execution PR can choose under its own Helen GO.

### Option A — server-side application `.env` key

Pattern: add `PRODUCTION_DATABASE_URL=...` to the existing production application env file (e.g. `/opt/buyerrecon-backend/.env` or equivalent), alongside the existing `DATABASE_URL` entry.

Tradeoffs:

- **Pros**: single env source; consistent with how the production collector already reads env; restart picks it up under existing systemd unit `EnvironmentFile=` semantics.
- **Cons**: the env file now holds a second long-lived secret; any future operator audit shell that sources this file inherits production privileges by default; risk of accidental wider exposure if other tooling sources the same file.
- **Required posture**: file ownership and mode must match the existing production secret posture (e.g. `root:root` or the documented operator user, `chmod 600`). The binding-execution PR must record the exact ownership/mode invariants and prove them in a categorical posture check without printing the file contents.

This option requires explicit Helen GO and a secret-safe procedure: no `cat`/`head`/`tail` of the env file, no `env` dump after sourcing, no DSN value in any proof artifact.

### Option B — root-only separate secret file

Pattern: place `PRODUCTION_DATABASE_URL=...` in a dedicated operator-only secret file (e.g. `/root/buyerrecon-production-db.env`, or an operator-specific path under the operator's home), mode `0600`, owned by the operator user. Source only from the operator audit shell; never source from the application unit.

Tradeoffs:

- **Pros**: cleanly separates one-off audit access from the application's persistent env; reduces the surface area for accidental sourcing by other tooling; easy to revoke (remove the file) without touching the application env.
- **Cons**: the binding-execution PR must add an operator runbook step to source the file; the file's existence, location, and lifecycle must be documented categorically in the binding-execution PR.
- **Required posture**: `chmod 600`; owner = operator user (recorded as a category, not a name if the name is sensitive); never committed to git; never copied to a paste-able location; explicit cleanup step removes the file when the audit shell session ends, if the binding-execution PR chooses ephemeral file mode.

Suitable for one-off Gate 4A audit work; can also be made persistent if the binding-execution PR documents the ownership/mode invariants.

### Option C — external secret manager / password manager

Pattern: store `PRODUCTION_DATABASE_URL` in an external secret manager (vault, 1Password, or the team's existing secret store). The operator copies the value into the audit shell via the manager's secret-injection mechanism (e.g. `op run`, `vault read -field=...` into a shell `export` without echo, or a manual paste into a `read -s` prompt).

Tradeoffs:

- **Pros**: no on-disk secret file; central audit trail in the secret manager; standard practice for organisations already running a secret manager.
- **Cons**: harder to reproduce a Gate 4A audit without documenting the exact secret-manager category and command shape; depends on operator discipline to never echo the value; requires a secret-manager CLI to be present on the host.
- **Required posture**: the binding-execution PR must document the secret-manager category, the exact command shape (without secret values), the fail-closed behaviour if the manager is unavailable, and the cleanup step.

PR#18r does not implement any option. The binding-execution PR selects one and proves it categorically.

---

## 5. Required future operator procedure

After the binding-execution PR is merged and the binding is in place, the future operator audit shell must follow this procedure end-to-end. PR#18r records the procedure as planning text only; the binding-execution PR or a subsequent re-audit PR will execute it.

```
# Step 1 — shell posture (mandatory; no exceptions).
set +x
unset HISTFILE
umask 077

# Step 2 — load PRODUCTION_DATABASE_URL only, from the binding chosen by the binding-execution PR.
# Examples by option (not all valid; the binding-execution PR picks one):
#   Option A: source /opt/buyerrecon-backend/.env
#   Option B: source /root/buyerrecon-production-db.env
#   Option C: export PRODUCTION_DATABASE_URL="$(<external_secret_manager_command_without_echo>)"
# The DSN value must never be printed, echoed, or written to a paste-able location.

# Step 3 — fail closed if PRODUCTION_DATABASE_URL is absent. No fallback.
test -n "${PRODUCTION_DATABASE_URL:-}" || { echo production_dsn_missing=yes; return 1; }

# Step 4 — never use DATABASE_URL for the production DB branch.
# The PR#18o §5.F runbook expects DATABASE_URL as the connection var. Bind it from
# PRODUCTION_DATABASE_URL after the presence check above succeeds; do not fallback the other way.
export DATABASE_URL="$PRODUCTION_DATABASE_URL"

# Step 5 — run the PR#18o §5.F → §5.J category-only queries against the loaded DSN.
# psql commands are listed in the merged PR#18o runbook; they are read-only,
# return booleans/counts only, and never print DSN or raw row data.

# Step 6 — cleanup. Mandatory; no exceptions.
unset DATABASE_URL
unset PRODUCTION_DATABASE_URL
unset PGPASSWORD
unset PGSERVICE
unset PGPASSFILE
test -z "${DATABASE_URL:-}" && echo cleanup_dsn_unset=yes || echo cleanup_dsn_unset=no
test -z "${PRODUCTION_DATABASE_URL:-}" && echo cleanup_production_dsn_unset=yes || echo cleanup_production_dsn_unset=no
```

Hard constraints on the future operator procedure:

- the DSN value never appears in shell history, terminal scrollback, logs, screenshots, or proof artifacts;
- if `PRODUCTION_DATABASE_URL` is absent, the audit fails closed; no fallback is attempted;
- `DATABASE_URL` (staging) must never be used to satisfy the production DB branch;
- cleanup is mandatory and the cleanup booleans are required in the future re-audit's evidence block.

---

## 6. Category checks after binding

The future re-audit's DSN-category diagnostic re-run (modelled on PR#18q §3) must paste back **only categorical fields**:

- `PRODUCTION_DATABASE_URL_present`: `<yes|no>`
- `DATABASE_URL_present`: `<yes|no>` (informational only; not used to satisfy the production DB branch)
- `fallback_used`: `no` (required; if any field other than `no` is reported, the audit halts)
- `dsn_loaded`: `<yes|no>`
- `db_name_category`: `<production|staging|other|unknown>`
- `production_name_match`: `<yes|no>`
- `staging_name_match`: `<yes|no>`
- `current_user_category`: `<expected_migrator|expected_internal_readonly|buyerrecon_role|other|unknown>`
- `cleanup_done`: `<yes|no>`

The raw database name and raw user name are recorded **only** if the binding-execution PR or the operator explicitly approves them as category-safe (i.e. documented public labels, not secret-bearing). Default behaviour is to record category labels only.

No `SELECT *`, no DML, no DDL, no GRANT/REVOKE/TRUNCATE, no `\password`, no `\copy`, no `\!`, no `\o`.

---

## 7. Stop-lines

The future binding-execution PR and the follow-up Gate 4A DSN-category diagnostic re-run must halt and record a categorical `BLOCKED` result if any of the following is true:

- `PRODUCTION_DATABASE_URL` is absent on the operator audit shell at the moment §5.F would be attempted.
- The loader would have to fall back to `DATABASE_URL` to satisfy the production DB branch.
- `db_name_category != production` after the category-only query runs.
- `staging_name_match=yes` after the category-only query runs.
- The DSN value (in any form: full string, prefix, suffix, length, hash) is printed at any point — terminal, log, paste-back, screenshot, scratch file, repo, PR comment, CI log, shell history.
- An `env` / `printenv` / `set` dump exposes DSN values during the procedure.
- `current_user_category` is `unexpected` or `unknown` after the category-only query.
- Any command in the operator procedure would mutate the DB (DML/DDL/GRANT/REVOKE/TRUNCATE/`\copy` write/`\!` shell-out write).
- The operator is not categorically certain of the next step at any point in the procedure.
- Any binding-option posture invariant (ownership, mode, location, lifecycle) cannot be confirmed read-only and categorically.

Stop-line handling must be fail-closed: record the categorical `BLOCKED` result, do not "push through" by softening the rule, and resolve the gap in a separate issue-fix PR before Gate 4A re-audit proceeds.

---

## 8. Follow-up sequence

After PR#18r is merged, the chain to a non-BLOCKED Gate 4A verdict is:

1. **Operator secret-binding execution PR** (separate, with its own Helen GO). Selects one of §4's options, establishes the `PRODUCTION_DATABASE_URL` (or chosen production-only) binding, records the posture invariants categorically, and proves no DSN value was printed or persisted in any proof artifact.
2. **DSN-category diagnostic re-run** modelled on PR#18q §3. Re-runs the categorical evidence collection against the newly-bound shell. Verdict must be PASS (`PRODUCTION_DATABASE_URL_present=yes`, `fallback_used=no`, `db_name_category=production`, `production_name_match=yes`, `staging_name_match=no`, `cleanup_done=yes`). If still BLOCKED, return to a remediation PR; do not proceed.
3. **Gate 4A DB / grant / traffic re-audit**. Re-runs PR#18o §5.F → §5.J against the production DSN. Verdict must be non-BLOCKED (`PASS` or `PASS_WITH_WARNINGS` permitted only on §5.G or §5.H non-critical surfaces; §5.F must produce categorical booleans, not `not_attempted`). Migration 016 Lane grant safety invariants are converted from documented expectation to proven categorical fact in this step.
4. **Gate 4B planning / no-deploy artifact/config bundle check**, only after step 3's non-BLOCKED verdict. Separately gated.
5. **Gate 4C controlled canary activation**, only after Gate 4B passes. Separately gated. The earliest sub-gate that could consider any `endpointUrl` re-flip.
6. **Gate 4D organic observation** and **Gate 4E Track A / Playwright**, each separately gated and later.
7. **Final scoring / governance recap PR**, before any production-cutover readiness claim.

No step above is approved by PR#18r alone.

---

## 9. Non-goals

PR#18r explicitly does **not** approve any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- no secret creation in any form,
- no env file edit (no append, no in-place rewrite, no new env file),
- no secret rotation,
- no token provisioning,
- no DB writes (no DML, no DDL, no GRANT/REVOKE/TRUNCATE),
- no DB grants (no broadening, no narrowing),
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
- no Gate 4A re-execution by PR#18r (the §5 procedure is a future operator command set, not executed by this PR),
- no Gate 4B execution,
- no Gate 4B planning advancement,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no inline selection of one §4 option (the binding-execution PR selects),
- no DSN-value handling of any kind,
- no secrets or sensitive values recorded in any artifact derived from PR#18r.

Carry-forward governance locks (verbatim, from PR#18o §6 and §8, PR#18p §5, PR#18q §5):

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

Migration 016 Lane grant safety status: still `unknown` after PR#18p / PR#18q / PR#18r. Convert in the follow-up Gate 4A re-audit (step 3 of §8) before any Gate 4B execution or Gate 4C consideration.

---

## 10. Acceptance criteria

- Docs-only. Sole change is `docs/sprint2-pr18r-production-dsn-secret-binding-planning.md`.
- No secrets present anywhere in the doc. No DSN value, no DB username/password, no token, no hash, no pepper, no Authorization header, no request_id, no session_id, no payload, no response body, no env dump, no vault content, no shell history, no private key, no certificate.
- §4 documents the production DSN binding options (Option A server-side `.env` key, Option B root-only separate secret file, Option C external secret manager) without endorsing any.
- §3 and §7 define the **no-fallback-to-`DATABASE_URL`** rule for the future Gate 4A production DB branch.
- §5 defines the future operator procedure as fail-closed if `PRODUCTION_DATABASE_URL` is absent.
- §8 lays out the follow-up sequence end-to-end through the final scoring / governance recap PR.
- Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E remain forbidden by PR#18r.
- The final scoring / governance recap PR requirement is preserved.

---

End of PR#18r. **Production DSN establishment / operator secret-binding planning. Docs-only. No secret written, no env file changed, no DB command executed, no DSN value handled, no Gate 4A re-execution, no Gate 4B / Gate 4C / Gate 4D / Gate 4E approved. The future Gate 4A production DB branch must load `PRODUCTION_DATABASE_URL` from a dedicated production-only binding (selected by the separate binding-execution PR from §4 options), fail closed if that binding is absent, and never fall back to `DATABASE_URL`. Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E remain forbidden until the binding-execution PR, the DSN-category diagnostic re-run, and the Gate 4A DB/grant/traffic re-audit each complete with non-BLOCKED verdicts. No DB writes, no migrations, no `schema.sql` change, no DB grants, no env file edit, no secret rotation, no token provisioning, no `endpointUrl` re-flip, no production traffic, no `/var/www` edit, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18r. Any operator secret-binding execution PR, DSN-category diagnostic re-run PR, Gate 4A re-audit PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or final scoring / governance recap PR remains separately gated by its own explicit Helen GO.**
