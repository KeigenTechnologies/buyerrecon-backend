# Step2E Sanitized Behavioural-Extractor Rerun PASS

## Status

**Status:** `STEP2E_SANITIZED_RERUN_PASS`

- **Evidence-only.** **Docs-only.**
- After PR #316 closed and proofed the `accepted_events` SELECT gap, a fresh scoped
  `HELEN STEP2E SANITIZED RERUN GO` authorized **exactly one** sanitized Step2E command
  (`extract:behavioural-features = tsx scripts/extract-behavioural-features.ts`) under the correct
  collector/extractor identity `buyerrecon_prod_collector_app`, with `SINCE` supplied.
- The command **exited 0** (`step2e_failure_category=none`). stdout/stderr were captured to temp
  files, **not printed**, and the temp files were **removed**.
- No Stage0 rerun; no Route C rerun; no grant; no downstream extractor; no Lane/scoring; no AMS
  runtime; no customer output; no Gate4E; no Gate4F.
- **No** raw stdout, raw stderr, password, DSN, host, port, connection string, env value, raw
  PostgreSQL error text, `pg_hba` raw line, raw `accepted_events` payload, raw `canonical_jsonb`,
  customer payload, PII, `request_id`, `session_id`, user identifier, IP, user-agent, header, or
  body value appears in this document.

This PR **records** an already-run, GO-scoped sanitized Step2E rerun that exited 0. **This PR reruns
nothing**, grants nothing, runs no post-run proof, and authorizes no downstream action.

---

## Evidence chain

- **PR #316** (`fc6a22f0f02aa90c6580dd758d298837afdbc572`): recorded
  `STEP2E_ACCEPTED_EVENTS_SELECT_GRANT_PROOF_PASS` — the `accepted_events` SELECT gap was granted and
  proofed (`accepted_events_select_privilege_after=true`); collector auth and behavioural/session
  privileges were already proofed; `stage0_decisions` SELECT remained false and was not required by
  Step2E.
- A fresh scoped `HELEN STEP2E SANITIZED RERUN GO` authorized exactly one sanitized Step2E command
  under the correct identity with `SINCE` supplied.

Reviewed Step2E command (confirmed by static discovery; non-secret repo identifier):

```text
extract:behavioural-features = tsx scripts/extract-behavioural-features.ts
```

Executed command shape (safe token form; the actual `COLLECTOR_EXTRACTOR_DSN` value and the literal
`SINCE` timestamp value were bound from current-shell variables and were **never printed, echoed,
committed, or stored** in this record):

```text
DATABASE_URL="$COLLECTOR_EXTRACTOR_DSN" SINCE="$SINCE" npm run extract:behavioural-features
```

---

## Evidence labels

```text
step2e_sanitized_rerun_attempted=true
pr316_merge_present=true
tracked_working_tree_clean=true
step2e_command_present=true
since_env_present=true
collector_extractor_dsn_available=true
step2e_rerun_executed=true
step2e_exit_code=0
step2e_failure_category=none
step2e_sanitized_rerun_result=pass
db_mutation_executed=unknown
stage0_rerun_executed=false
route_c_rerun_executed=false
grants_or_role_changes_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
host_port_printed=false
credential_printed=false
env_file_inspected=false
raw_stdout_printed=false
raw_stderr_printed=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

---

## Interpretation

- The **sanitized Step2E behavioural-extractor rerun passed** after the `accepted_events` SELECT gap
  was fixed and proofed (`step2e_rerun_executed=true`, `step2e_exit_code=0`,
  `step2e_failure_category=none`, `step2e_sanitized_rerun_result=pass`).
- The prior blockers were resolved **in order**:
  1. **Correct identity restored** to `buyerrecon_prod_collector_app` rather than the Stage0 runner.
  2. **Collector password / DSN mismatch resolved** and auth proofed.
  3. **`SINCE` supplied** (`since_env_present=true`).
  4. **`accepted_events` SELECT granted and proofed**.
- The **Step2E command itself exited 0**.
- `db_mutation_executed` is recorded as **`unknown`** because raw output and row-level details were
  **intentionally not printed**, and **this evidence PR does not perform a post-run aggregate
  proof**.
- This **PASS does not by itself prove customer-output readiness**.
- This **PASS does not authorize Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F**.
- **No Stage0 rerun, Route C rerun, grant, downstream extractor, Lane/scoring, AMS runtime, customer
  output, Gate4E, or Gate4F action occurred.**
- **No secret / raw / customer / request / session / IP / header / body / stdout / stderr values
  were printed.**
- The **next valid action after review/merge is a separate sanitized post-run aggregate proof, if
  required**, using **counts / booleans only and no raw row data** — under its own separate explicit
  scoped Helen GO.

---

## Anti-regression note

- The repeated earlier failures were **not** a global `CLAUDE.md` issue.
- They were caused by **missing Step2E execution-profile / preflight enforcement** — specifically:
  intended identity, required env, required privileges, prohibited identities, and grant boundaries.
- **Do not add noisy per-run evidence to `CLAUDE.md`.**
- Future prevention should be handled by a **Step2E execution profile / preflight contract that
  fails closed** before the extractor command is allowed to run (asserting the correct identity,
  required env such as `SINCE`, required privileges, prohibited identities, and grant boundaries).
  That contract is a **separate reviewed change**, not part of this evidence PR.

---

## Does NOT authorize

This PR does **NOT** authorize: another Step2E rerun, a Stage0 rerun, a Route C rerun, a post-run
aggregate proof (which requires its own GO), any GRANT/REVOKE or role change, DB mutation, credential
rotation, custody rewrite, DSN discovery, host/port discovery, `.env.production` inspection,
`pg_hba` inspection, workers, downstream extractors, Lane/scoring, AMS runtime, customer output,
Gate4E, Gate4F, deploy, or runtime command. Any post-run proof or downstream action requires its own
separate explicit scoped Helen GO.

---

## Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated password, DSN URI,
connection string, raw secret-manager payload, service-file content, `.env.production`
content/value, token, private key, IP address, host value, port value, real URI, login source,
**raw `pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row data, **raw psql
output, raw PostgreSQL error text**, **raw stdout/stderr** of the command, the literal `SINCE`
timestamp value, or env-var value. The captured stdout/stderr were written to temp files, **not
printed**, and the temp files were **removed**; only the safe `exit 0` / `pass` labels are recorded.
The collector DSN was constructed internally in shell from a hidden password and was **never
printed**; the literal `SINCE` value was supplied from a current-shell variable and is **not
printed** here (only `since_env_present=true` is recorded). The `package.json` **script name**, the
`scripts/*.ts` **file path**, the **env-var names** (`DATABASE_URL`, `SINCE`), and the **role name**
(`buyerrecon_prod_collector_app`) shown are non-secret repository / role identifiers; the recorded
commit hash is **public**. All values above are safe labels / booleans / category tokens / non-secret
identifiers / a public git commit hash — not secret or row values. **This PR runs nothing.**
