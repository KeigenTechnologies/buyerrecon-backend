# Sprint 2 PR#18t: Authoritative Production DSN Recovery / Creation Planning

> Docs-only planning. No secret is recovered, no DSN is created or rotated, no env
> file is edited, no DB command is executed, no DSN value is handled, no Gate 4A
> re-audit is attempted, and no Gate 4B / 4C / 4D / 4E work is approved by this PR.

---

## 1. Status / verdict

**PLANNING ONLY — authoritative production DSN recovery / creation planning.**

- No secret recovered.
- No DSN created or rotated.
- No env file edited.
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
- No Gate 4A re-audit.
- No Gate 4B / Gate 4C / Gate 4D / Gate 4E.

This PR records planning content only. Any concrete recovery, creation, rotation, or binding step must be carried out under a separate explicit Helen GO with its own scope, stop-lines, and proof closure.

Anchored governance phrases (per `docs/ops/cutover-hard-gates.md` §7) carry forward into the recovery-execution PR, the re-run PR#18s binding proof, the DSN-category diagnostic re-run, the Gate 4A re-audit, and the final scoring / governance recap PR:

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this PR exists

The blocked chain leading to PR#18t:

- **PR#18p / PR #48** — Gate 4A read-only audit execution proof. Verdict: BLOCKED. Stop-line: `production_db_category_unexpected`. The audit shell loaded a DSN that did not categorise as the intended production DB.
- **PR#18q / PR #49** — Production DSN category diagnostic. Verdict: BLOCKED — production DSN binding missing / fallback selected staging. Root cause: `fallback_selected_staging`.
- **PR#18r / PR #50** — Production DSN establishment / operator secret-binding planning. Defined three binding options and the fail-closed no-fallback-to-`DATABASE_URL` rule.
- **PR#18s / PR #51** — Production DSN binding execution proof. Verdict: BLOCKED. Stop-line: `production_dsn_binding_unavailable`. The production host had no production-only DSN binding source at any candidate location (`/root/buyerrecon-production-db.env` absent, no `PRODUCTION_DATABASE_URL` name in `/opt/buyerrecon-backend/.env`, no candidate file under `/root` or `/opt`). The operator correctly refused to fall back to `DATABASE_URL`. Only `DATABASE_URL` exists, and it is staging.

Therefore the **authoritative production DSN must be recovered or created** before any future PR#18s re-run, before any Gate 4A DB / grant / traffic re-audit, and before any Gate 4B / 4C / 4D / 4E work can proceed.

PR#18t is the planning PR for that recovery. It does **not** execute recovery; it defines the source hierarchy, the decision tree, the future operator procedure, the future categorical proof fields, the stop-lines, and the follow-up sequence so the recovery-execution PR can be designed against a clear spec.

---

## 3. Authoritative DSN source hierarchy

The recovery-execution PR (a separate later PR with its own explicit Helen GO) must consult sources in **this approved order**, stopping at the first source that yields an authoritative production DSN. The DSN value itself must never be printed, pasted, or persisted in any artifact during consultation.

1. **Existing secure password manager / vault entry** previously created for the BuyerRecon production database. This is the canonical source if it exists. The recovery PR must record categorical presence only (`password_manager_entry_exists=yes|no`), never the entry's value or surrounding metadata that could be sensitive.
2. **Hetzner / Postgres operator records from PR#17 production-DB setup.** See `docs/sprint2-pr17c-production-db-role-token-plan.md` for the recorded plan, and `docs/sprint2-pr17m-production-secret-recovery-rotation-runbook.md` for the existing secret-recovery / rotation methodology. The recovery PR may consult these documents for source-of-truth context; it must not paste any operator-record secret value into chat, repo, or proof.
3. **Root-only server secret file**, if such a file already exists at a location not enumerated by PR#18s and is confirmed safe (mode `0600`, owner `root:root`, never committed, never sourced by anything other than the operator audit shell). The recovery PR must record `root_only_file_exists=yes|no` and posture booleans without printing the file body.
4. **DB-admin-assisted credential creation or reset**, if no existing source above yields a recoverable DSN. This is the last resort and requires a **separately approved DB-admin procedure PR** with its own Helen GO. PR#18t does not authorise this step; §6 below records what such a future PR must contain.

The recovery PR must select **exactly one** source from this hierarchy as the authoritative source for the production DSN it will bind. Mixing sources is forbidden (e.g. partially restoring a username from one source and a password from another).

**Explicitly forbidden sources** (must never be used, regardless of operator pressure):

- the staging `DATABASE_URL` (PR#18q proved it categorises as staging),
- guessing a DSN from host or database names ("it's probably `buyerrecon_prod` on port 5432"),
- extracting a DSN candidate from shell history,
- searching production or staging logs for accidentally-leaked secrets,
- copying a DSN into chat (Slack, GitHub PR comments, screen-share text),
- committing a DSN to the repo (even temporarily, even in a "draft" PR, even encoded),
- using Render legacy `/collect` collector secrets for Sprint 2 production DB without independent verification that they apply to the Sprint 2 production DB (they generally do not).

---

## 4. Recovery decision tree

The recovery-execution PR must select exactly one categorical outcome from the closed enum below, based on what the operator finds when consulting §3's source hierarchy:

- **`existing_secret_found`** — a non-staging production DSN exists in the password manager / vault, operator records, or a confirmed root-only file. The DSN is recoverable without DB-admin intervention. **Next action**: proceed to a separate re-run of PR#18s binding execution proof using the recovered DSN as the binding source. The recovery PR records only categorical proof; the DSN value never appears.
- **`production_db_exists_but_secret_missing`** — the production database exists (categorically confirmed by an operator with appropriate access, without printing identifiers or running runtime queries), but the secret for the runtime role is no longer recoverable. **Next action**: plan a credential-reset / new-secret-creation PR (separate, with its own Helen GO; see §6).
- **`production_db_user_missing`** — the production database exists but the expected runtime role / user does not. **Next action**: plan a DB role/user restore PR per the existing PR#17c plan (`docs/sprint2-pr17c-production-db-role-token-plan.md`), then re-attempt §4 from the top.
- **`production_db_unknown`** — operator cannot categorically confirm whether the production database exists. **Next action**: read-only inspection of the production DB setup documentation and host state (no DSN load, no `psql`, no env edit), recorded in a docs-only investigation PR. Do **not** proceed to creation until the DB's existence is positively categorised.
- **`secret_source_ambiguous`** — multiple candidate sources exist and the operator cannot identify the authoritative one. **Next action**: **stop**. Require explicit Helen confirmation of which source is authoritative before proceeding. Do not invent precedence rules on the fly.
- **`recovery_blocked`** — the operator cannot recover or create a production DSN under PR#18t's planning constraints (e.g. organisational access issues, missing DB-admin authority). **Next action**: **stop**. No Gate 4A re-audit. The Sprint 2 chain remains paused at this point until the access issue is resolved in a separate organisational/operational PR.

The recovery PR must categorise its outcome **before** taking any action that could mutate state. If the outcome is `secret_source_ambiguous` or `recovery_blocked`, the recovery PR exits without any execution.

---

## 5. Future safe operator recovery procedure

Planning only. Future execution requires explicit Helen GO scoped to the recovery-execution PR.

The procedure the recovery-execution PR must follow:

- `set +x` (command-echo off).
- `unset HISTFILE` (no shell history capture during recovery).
- `umask 077` (operator-only file mode for any incidental file).
- Search candidate sources by **file name / entry name only**, never by value. Examples of safe checks:
  - `ls -ld /root/buyerrecon-production-db.env` (presence only).
  - `grep -c '^PRODUCTION_DATABASE_URL=' /opt/buyerrecon-backend/.env` (name-only count).
  - password-manager / vault entry listing by **name** (e.g. `op item list --tags buyerrecon`), never by value.
- Query password manager / vault manually in the operator's secret-manager UI, **not in chat**, **not in screen-share text**, **not in screenshots that include the value**.
- Verify a candidate DSN privately (operator's secret-manager UI or operator's local read of a `read -s` paste). Never echo the candidate DSN.
- If creating a new credential is required (outcome `production_db_exists_but_secret_missing`), use the separate DB-admin PR / runbook defined in §6 — **not** PR#18t, **not** inline.
- Once the authoritative DSN is identified or created, store it **only** in the approved production binding path:
  - preferred: `/root/buyerrecon-production-db.env` with `chmod 600`, owner `root:root` (per PR#18r §4 Option B), or
  - the operator's chosen production-only binding from PR#18r §4 if Option A or Option C is selected by the recovery PR.
- Produce only categorical proof (see §7). No DSN value ever appears in the proof, chat, repo, PR comment, CI log, screenshot, or shell history.

If at any point the procedure would require typing or echoing the DSN value into a place the operator cannot guarantee is private, **stop**.

---

## 6. If DSN must be created / reset

If §4's outcome is `production_db_exists_but_secret_missing`, the recovery flow requires DB-admin-assisted credential creation or rotation. PR#18t **does not authorise** this step and does **not** include the mutating commands. The future credential-reset PR must:

- require its own explicit Helen GO scoped specifically to DB-admin credential creation/rotation,
- identify the DB-admin operator (category, not name if name is sensitive),
- categorically confirm the production DB exists and is the intended target (without printing DB names if they are sensitive),
- run only the minimum DDL necessary to create or rotate the runtime role's credential (e.g. `ALTER ROLE … PASSWORD …` via a read-`-s` paste flow that never echoes the password), per the methodology in `docs/sprint2-pr17c-production-db-role-token-plan.md` and `docs/sprint2-pr17m-production-secret-recovery-rotation-runbook.md`,
- store the new DSN **only** in the approved production binding (root-only file or secret manager); never in the repo, never in shell history, never in chat,
- if rotating, revoke the prior credential after the new one is verified working, recording the revocation categorically (`prior_credential_revoked=yes|no`),
- verify that no staging binding is used by the recovery shell at any point,
- produce categorical proof (see §7),
- never print password / DSN / hash / connection string.

PR#18t includes the bullet structure above as a planning placeholder; the actual mutating commands belong only in the future credential-reset PR under its own gated scope.

---

## 7. Future recovery / creation proof fields (closed schema)

A future recovery / creation proof PR must paste back **only** the following categorical fields. Raw DSN values, DB/user names, passwords, host, port, connection strings, and any sensitive metadata are forbidden:

- `authoritative_source_type`: `<password_manager|operator_record|root_secret_file|db_admin_reset|unknown>`
- `existing_secret_found`: `<yes|no>`
- `production_db_exists`: `<yes|no|unknown>`
- `production_db_user_exists`: `<yes|no|unknown>`
- `secret_recovered_or_created`: `<yes|no>`
- `secret_stored_in_binding_path`: `<yes|no>`
- `binding_path_category`: `<root_only_operator_secret_file|password_manager|external_secret_manager|other>`
- `file_mode_600`: `<yes|no|not_applicable>`
- `file_owner_root_root`: `<yes|no|not_applicable>`
- `fallback_to_DATABASE_URL`: **`no`** (required; if any other value, halt)
- `DSN_value_printed`: **`no`** (required; if any other value, halt and treat as secret-exposure stop-line)
- `prior_credential_revoked`: `<yes|no|not_applicable>` (only present if §6 credential-reset path was taken)
- `cleanup_done`: `<yes|no>`

The proof may additionally include a brief categorical narrative selecting one §4 outcome and identifying which §3 source-hierarchy step was authoritative. No raw values appear in that narrative.

---

## 8. Stop-lines

The recovery-execution PR (and any DB-admin credential-reset sub-PR) must halt and record a categorical `BLOCKED` result if any of the following is true:

- only `DATABASE_URL` is available as a DSN source (PR#18q proved it is staging).
- a candidate DSN, on category-only inspection, categorises as staging.
- the source is ambiguous (multiple candidate sources, no clear precedence).
- the DSN value appears at any moment in terminal output, paste-back, chat, screenshot, PR comment, CI log, scratch file, repo, or shell history.
- an `env` / `printenv` / `set` dump exposes DSN values during the procedure.
- shell history captures any secret (the operator must verify `unset HISTFILE` before the recovery shell touches any secret-bearing input).
- the operator cannot identify an authoritative source from §3.
- a DB-admin mutation would be required and there is no explicit Helen GO for the credential-reset sub-PR.
- any file permission on a file-based secret is broader than `0600`, or the owner is not the approved category.
- the operator is not categorically certain of the next step at any point in the procedure.

Stop-line handling must be fail-closed: record the categorical `BLOCKED` result, do not "push through" by softening any rule, and resolve the gap in a separate issue-fix PR before the recovery chain proceeds.

---

## 9. Follow-up sequence

After PR#18t is merged, the chain to a non-BLOCKED Gate 4A verdict is:

1. **Production DSN recovery / creation execution PR** (separate, with its own Helen GO). Consults §3 source hierarchy, classifies the outcome per §4, follows §5 procedure (and §6 if creation/reset is required), and produces a §7 categorical proof. PR#17m's recovery/rotation runbook is the relevant existing reference; PR#17c is the relevant DB role/token plan.
2. **Re-run PR#18s binding execution proof** against the recovered or newly-created production DSN. Verdict must be PASS (file mode `0600`, owner `root:root`, `PRODUCTION_DATABASE_URL_present=yes`, `DATABASE_URL_fallback_used=no`, `dsn_loaded_from_production_binding=yes`, `db_name_category=production`, `production_name_match=yes`, `staging_name_match=no`, `cleanup_done=yes`).
3. **DSN-category diagnostic re-run** (PR#18q methodology). Verdict must be PASS.
4. **Gate 4A DB / grant / traffic re-audit** (PR#18o §5.F → §5.J methodology). Verdict must be non-BLOCKED. Migration 016 Lane grant safety invariants are converted from documented expectation to proven categorical fact in this step.
5. **Gate 4B planning advancement** and **Gate 4B no-deploy artifact/config bundle check**, only after step 4's non-BLOCKED verdict. Separately gated.
6. **Gate 4C controlled canary activation**, only after Gate 4B passes. Separately gated. The earliest sub-gate that could consider any `endpointUrl` re-flip.
7. **Gate 4D organic observation** and **Gate 4E Track A / Playwright**, each separately gated and later.
8. **Final scoring / governance recap PR**, before any production-cutover readiness claim.

No step above is approved by PR#18t alone.

---

## 10. Non-goals

PR#18t explicitly does **not** approve any of the following. Each requires its own explicit Helen GO scoped to that specific work:

- no secret recovery execution,
- no DSN creation,
- no credential rotation,
- no env file edit (no append, no in-place rewrite, no new env file written by PR#18t),
- no DB writes (no DML, no DDL, no GRANT/REVOKE/TRUNCATE),
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
- no Gate 4A re-execution by PR#18t,
- no Gate 4B execution,
- no Gate 4B planning advancement,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no DSN-value handling of any kind by PR#18t,
- no fallback to `DATABASE_URL` for the production binding (rule preserved from PR#18r),
- no secrets or sensitive values recorded in any artifact derived from PR#18t.

Carry-forward governance locks (verbatim, from PR#18o §6 and §8, PR#18p §5, PR#18q §5, PR#18r §9):

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

Migration 016 Lane grant safety status: still `unknown` after PR#18p / PR#18q / PR#18r / PR#18s / PR#18t. Convert in the follow-up Gate 4A re-audit (step 4 of §9) before any Gate 4B execution or Gate 4C consideration.

---

## 11. Acceptance criteria

- Docs-only. Sole change is `docs/sprint2-pr18t-authoritative-production-dsn-recovery-planning.md`.
- No secrets anywhere in the doc. No DSN value, no DB username/password, no token, no hash, no pepper, no Authorization header, no request_id, no session_id, no payload, no response body, no env dump, no vault content, no shell history, no private key, no certificate, no host/port that would reveal secret context.
- §3 documents the authoritative DSN source hierarchy in approved order, with explicit forbidden sources.
- §4 records the closed recovery decision-tree enum with mapped next actions.
- §3 / §5 / §6 / §8 / §10 preserve the **no-fallback-to-`DATABASE_URL`** rule established by PR#18q / PR#18r and confirmed by PR#18s.
- §8 records the stop-lines, fail-closed.
- §9 records the follow-up sequence end-to-end through the final scoring / governance recap PR.
- Gate 4A re-audit, Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E all remain forbidden by PR#18t.
- The final scoring / governance recap PR requirement is preserved.

---

End of PR#18t. **Authoritative production DSN recovery / creation planning. Docs-only. No secret recovered, no DSN created or rotated, no env file edited, no DB command executed, no DSN value handled, no Gate 4A re-audit, and no Gate 4B / Gate 4C / Gate 4D / Gate 4E approved. The future recovery-execution PR must consult the §3 source hierarchy in order, classify the outcome per the §4 closed enum, follow the §5 procedure (and the §6 credential-reset sub-PR if creation is required), produce only the §7 categorical proof fields, honour the §8 stop-lines, and never use `DATABASE_URL` as a fallback. Gate 4B execution, Gate 4B planning advancement, Gate 4C, Gate 4D, and Gate 4E remain forbidden until the recovery-execution PR, a re-run of PR#18s binding-execution proof, the DSN-category diagnostic re-run, and the Gate 4A DB/grant/traffic re-audit each complete with non-BLOCKED verdicts. No DB writes, no migrations, no `schema.sql` change, no DB grants, no env file edit, no secret recovery execution, no DSN creation, no credential rotation, no token provisioning, no `endpointUrl` re-flip, no production traffic, no `/var/www` edit, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18t. Any production-DSN recovery / creation PR, DB-admin credential-reset PR, re-run PR#18s binding-execution PR, DSN-category diagnostic re-run PR, Gate 4A re-audit PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or final scoring / governance recap PR remains separately gated by its own explicit Helen GO.**
