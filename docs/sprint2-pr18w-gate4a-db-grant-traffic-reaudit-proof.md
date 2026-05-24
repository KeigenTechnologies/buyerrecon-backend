# Sprint 2 PR#18w: Gate 4A DB / Grant / Traffic Re-Audit Execution Proof

> Docs-only proof record. No execution is performed by this PR.
> The Gate 4A DB / grant / traffic re-audit recorded by this PR was carried out
> manually by the operator (Helen) on the production host under explicit Helen
> GO scoped to Gate 4A read-only DB / grant / traffic re-audit only. The
> categorical paste-back from that execution has been recorded into §3 of this
> doc.

---

## 1. Status / verdict

**Verdict: PASS_WITH_WARNINGS.**

Gate 4A DB / grant / traffic re-audit execution proof, recorded against the
dedicated production audit read-only credential created and proved in PR#18v /
PR #54.

`PASS_WITH_WARNINGS` rather than full `PASS` because production
`public.ingest_requests` carries **26 historical `/v1/event` rows** that
pre-existed this audit. Those rows are not unexplained new traffic: they are
already documented in `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
as the 26 HTTP `400` `request_body_invalid_json` rows produced by the ThinSDK ↔
Sprint 2 collector contract-shape mismatch on `2026-05-19`, were rejected at
the envelope-parse stage before any event-level validation could fire, did
**not** enter `public.accepted_events` (0 rows), did **not** enter
`public.rejected_events` (0 rows), and did **not** enter Lane A or Lane B
(both `0` rows). The PR#17s rule "Do not delete failed canary evidence rows"
is honoured by this audit: PR#18w does not delete, mutate, or annotate those
rows on the production cluster. The warning is recorded as a categorical
attestation only.

All §7 stop-lines are recorded as `no`. The single warning is
`historical_rejected_only_v1_event_rows_present=yes`, carried forward as the
sole `warnings_triggered` entry. The audit role's read-only posture, the
production DSN binding, the migration-016 Lane grant posture, the Lane A/B row
counts, and the §F audit-role-vs-Lane-DML check all match expected.

Scope boundaries (unchanged from staging):

- No `endpointUrl` re-flip.
- No production traffic generation.
- No HTTP call to the production collector by this audit.
- No `/var/www` edit.
- No production DB mutation.
- No DB grants (no broadening, no narrowing, no `GRANT`/`REVOKE`).
- No migrations.
- No `schema.sql` change.
- No env file edit.
- No credential rotation.
- No token provisioning.
- No customer-facing output (Pass 1 / Trust / Pass 2 / any customer-readable report).
- No Lane A/B writer.
- No runtime scoring.
- No Track A.
- No Playwright.
- No website ThinSDK production-mode activation.
- No production artifact/config mode flip.
- No Gate 4B / Gate 4C / Gate 4D / Gate 4E execution.

Anchored governance phrases (carried verbatim from PR#18o §7 and PR#18p §1):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this PR exists

The Gate 4A read-only production-readiness audit chain reached this PR through
the following recorded sequence (each verdict copied verbatim from the merged
proof on this PR's base, `sprint2-architecture-contracts-d4cc2bf`):

- **PR#18p / PR #48** — Gate 4A read-only audit execution proof. Verdict:
  **BLOCKED**. Stop-line: `production_db_category_unexpected`. The §5.F DB
  branch halted on the categorical `current_database()` query because the DSN
  available to the audit shell did not categorise as the intended production
  database. No `has_table_privilege(...)` query ran, no Lane row count query
  ran, no §5.G traffic query ran, and the eight migration-016 Lane grant safety
  booleans were left as `not_attempted`.
- **PR#18q / PR #49** — Production DSN category diagnostic. Verdict: BLOCKED.
  Root cause: `fallback_selected_staging`. The audit shell's DSN load path was
  falling back to the staging `DATABASE_URL` rather than a production-only
  binding.
- **PR#18r** — Production-only DSN binding plan. No execution. Required the
  audit to load `PRODUCTION_DATABASE_URL` from a root-only file and forbade
  `DATABASE_URL` fallback substitution.
- **PR#18s / PR #51** — Production DSN binding execution proof. Verdict:
  **BLOCKED**. Stop-line: `production_dsn_binding_unavailable`. No usable
  production-only DSN secret was recoverable from the operator's existing
  sources at that time.
- **PR#18t** — Authoritative production DSN recovery plan. Required reading the
  on-host PostgreSQL `pg_hba.conf` / role list / database list categorically
  without printing values, and forbade resetting `buyerrecon_prod_collector_app`
  or using `buyerrecon_migrator` as the audit DSN.
- **PR#18u / PR #53** — Authoritative production DSN recovery / creation
  execution proof. Verdict: **BLOCKED**. Stop-line: `existing_source_recovery_failed`.
  Recovery classification: `db_admin_reset_required`. Established that the
  production DB and roles exist but no usable production-only DSN secret was
  recoverable from existing sources, and explicitly required a **dedicated
  minimal read-only production audit credential** as the next step.
- **PR#18v / PR #54** — Dedicated production audit read-only credential
  execution proof. Verdict: **PASS**. Created the `buyerrecon_prod_audit_readonly`
  role on the production cluster with LOGIN capability; granted CONNECT on
  `buyerrecon_production`, USAGE on schema `public`, and SELECT on the five
  Gate 4A audit tables (`public.ingest_requests`, `public.accepted_events`,
  `public.rejected_events`, `public.scoring_output_lane_a`,
  `public.scoring_output_lane_b`); recorded that the role has no INSERT /
  UPDATE / DELETE on Lane A/B; stored the resulting DSN in
  `/root/buyerrecon-production-db.env` at mode `0600` owner `root:root`;
  recorded `PRODUCTION_DATABASE_URL_present=yes`, `DATABASE_URL_fallback_used=no`,
  `dsn_loaded_from_production_binding=yes`, `db_name_category=production`,
  `current_user_category=production_audit_readonly`, and `cleanup_done=yes`;
  recorded all five required Gate 4A table count-access checks as passing and
  the audit role's Lane A/B DML privileges as `S=true I=false U=false D=false`;
  did not reset `buyerrecon_prod_collector_app`, did not reset `buyerrecon_migrator`,
  and did not print any password or DSN.

PR#18w is the immediate downstream consequence of PR#18v's `PASS`. With a
dedicated read-only production audit credential now provably in place behind a
`0600`/`root:root` binding file with no `DATABASE_URL` fallback, the §5.F DB
branch of PR#18p can be re-run end-to-end against the correctly-categorised
production database, and §5.G / §5.J can run with that same read-only role. The
migration-016 Lane grant safety invariants left as `not_attempted` in PR#18p
can finally be converted into categorical booleans for the production cluster,
and the Sprint 2 traffic category of `ingest_requests.endpoint = '/v1/event'`,
`accepted_events`, and `rejected_events` can finally be recorded as count-only
categorical evidence.

PR#18w does **not** re-run the §5.C `/var/www` artifact branch (PR#18p §3.1
already recorded those four sha256 hashes and the static-artifact posture), the
§5.D `endpointUrl` category branch (PR#18p §3.2 already recorded
`render_legacy_collect`), or the §5.E rollback / backup branch (PR#18p §3.3
already recorded `backup_dir_present=yes`, `backup_artifact_present=yes`,
`rollback_doc_present=yes`, `rollback_artifact_exists=yes`). PR#18w is scoped
to the DB / grant / traffic branch only.

---

## 3. Evidence summary

All fields below are recorded verbatim from the operator's pasted execution
block. The audit was carried out on the production host using the dedicated
`buyerrecon_prod_audit_readonly` role + root-only DSN binding proved in PR#18v.
No raw row, no raw identifier, no payload, no header, no DSN value, and no
password was captured at any point.

### 3.1 Host / shell safety preflight (§A)

- `host_category`: `production`
- `operator_user_category`: `root`
- `shell_trace`: `off`
- `histfile_unset`: `yes`
- `umask_077`: `yes`

### 3.2 Production audit binding load (§B)

- `production_secret_file_exists`: `yes`
- `production_secret_file_mode_600`: `yes`
- `production_secret_file_owner_root_root`: `yes`
- `PRODUCTION_DATABASE_URL_present`: `yes`
- `DATABASE_URL_fallback_used`: `no`
- `dsn_loaded_from_production_binding`: `yes`

### 3.3 DB category check (§C)

- `db_name_category`: `production`
- `production_name_match`: `yes`
- `staging_name_match`: `no`
- `current_user_category`: `production_audit_readonly`

### 3.4 Table existence and required count access (§D)

- `tables_present_count`: `6` (the five required Gate 4A audit tables plus the optional `public.site_write_tokens`)
- `ingest_requests_count_access`: `yes`
- `accepted_events_count_access`: `yes`
- `rejected_events_count_access`: `yes`
- `lane_a_count_access`: `yes`
- `lane_b_count_access`: `yes`

### 3.5 Production Sprint 2 traffic counts (§E)

> Count-only. No raw `request_id`, `session_id`, payload, header, or row data.

- `ingest_requests_endpoint_v1_event_count`: `26`
- `ingest_requests_time_column_selected`: `received_at`
- `v1_event_first_seen_day`: `2026-05-19`
- `v1_event_last_seen_day`: `2026-05-19`
- `ingest_requests_category_columns`: `endpoint,http_status,reject_reason_code`
- `distribution_http_status`: `400: 26`
- `distribution_reject_reason_code`: `request_body_invalid_json: 26`
- `accepted_events_count`: `0`
- `rejected_events_count`: `0`
- `production_sprint2_traffic_observed`: `expected_historical_rejected_only`
- `production_sprint2_traffic_warning`: `historical_pr17s_request_body_invalid_json_rows_present`
- `lane_a_row_count`: `0`
- `lane_b_row_count`: `0`
- `lane_counts_category`: `both_zero`

The 26 `/v1/event` `ingest_requests` rows are documented in
`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` as the
ThinSDK ↔ Sprint 2 contract-shape mismatch evidence rows from
`2026-05-19`: every row carries `http_status=400` and
`reject_reason_code=request_body_invalid_json`, every row was rejected at the
envelope-parse stage before event-level validation could fire, and zero rows
propagated to `accepted_events`, `rejected_events`, or Lane A/B. PR#17s
recorded the rule "Do not delete failed canary evidence rows"; PR#18w honours
that rule by neither deleting, mutating, nor annotating those rows on the
production cluster. The audit's `ingest_requests` count query was count-only
against `endpoint = '/v1/event'`; no `request_id`, `session_id`, payload, or
header was captured.

### 3.6 Migration-016 grant posture check (§F)

> Recorded as `S=true/false I=true/false U=true/false D=true/false` per role
> per Lane, exactly as returned by the operator's `has_table_privilege(...)`
> queries (and, for `PUBLIC`, by the corrected `information_schema.table_privileges`
> query — see operator note below the table).

- `buyerrecon_migrator_scoring_output_lane_a`: `S=true I=true U=true D=true`
- `buyerrecon_migrator_scoring_output_lane_b`: `S=true I=true U=true D=true`
- `buyerrecon_internal_readonly_scoring_output_lane_a`: `S=true I=false U=false D=false`
- `buyerrecon_internal_readonly_scoring_output_lane_b`: `S=true I=false U=false D=false`
- `buyerrecon_customer_api_scoring_output_lane_a`: `S=false I=false U=false D=false`
- `buyerrecon_customer_api_scoring_output_lane_b`: `S=false I=false U=false D=false`
- `buyerrecon_scoring_worker_scoring_output_lane_a`: `S=false I=false U=false D=false`
- `buyerrecon_scoring_worker_scoring_output_lane_b`: `S=false I=false U=false D=false`
- `buyerrecon_prod_audit_readonly_scoring_output_lane_a`: `S=true I=false U=false D=false` (matches PR#18v §3.7)
- `buyerrecon_prod_audit_readonly_scoring_output_lane_b`: `S=true I=false U=false D=false` (matches PR#18v §3.7)
- `PUBLIC_scoring_output_lane_a`: `S=false I=false U=false D=false`
- `PUBLIC_scoring_output_lane_b`: `S=false I=false U=false D=false`

**Operator note (PUBLIC check correction).** The first `PUBLIC` check returned
the PostgreSQL error `role "PUBLIC" does not exist`, because `PUBLIC` is not a
normal role argument for `has_table_privilege(...)` in this context. The
operator re-ran the `PUBLIC` check using `information_schema.table_privileges`
filtered on the lane tables, which is the correct surface for the `PUBLIC`
grantee. The corrected result is recorded above:
`PUBLIC_scoring_output_lane_a: S=false I=false U=false D=false` and
`PUBLIC_scoring_output_lane_b: S=false I=false U=false D=false`. No grant was
changed by either query; both queries are read-only. The original
`has_table_privilege('PUBLIC', ...)` error is recorded here as procedural
context, not as a stop-line.

### 3.7 Cleanup (§H)

- `cleanup_dsn_unset`: `yes`
- `cleanup_done`: `yes`

The DSN that loaded into the audit shell was unset during cleanup. The
binding file `/root/buyerrecon-production-db.env` was **not** deleted (it is
PR#18v's persisted artifact). No production paths, no backups, no logs, no
repo files, and no `/var/www` files were removed during cleanup.

### 3.8 Secret-safety attestations

- `DSN_value_printed`: **no**
- `generated_password_printed`: **no**

No DSN value, generated password, `Authorization:` header, raw `request_id`,
raw `session_id`, raw payload, raw response body, env dump, private key /
cert body, vault content, shell-history line, or raw row was printed, echoed,
written to disk, or captured into the proof at any point during §A–§H.

---

## 4. DB category and binding assessment

Recorded against §3.2 and §3.3.

- **Production binding present**: `production_secret_file_exists=yes`,
  `production_secret_file_mode_600=yes`,
  `production_secret_file_owner_root_root=yes`. The root-only binding file
  established by PR#18v at `/root/buyerrecon-production-db.env` is intact at
  the expected ownership and mode.
- **No `DATABASE_URL` fallback**: `DATABASE_URL_fallback_used=no`. The PR#18r
  no-fallback rule was honoured end-to-end during this audit.
- **Production-only DSN loaded**: `PRODUCTION_DATABASE_URL_present=yes`,
  `dsn_loaded_from_production_binding=yes`. The DSN value was not printed.
- **Database categorises as production**: `db_name_category=production`,
  `production_name_match=yes`, `staging_name_match=no`. The PR#18o §5.F
  category rule recognised the connected database as production with no
  ambiguity. This closes the `production_db_category_unexpected` stop-line
  that BLOCKED PR#18p.
- **Connected role is the dedicated audit role**:
  `current_user_category=production_audit_readonly`. The connected user is
  `buyerrecon_prod_audit_readonly` (the role created and proved in PR#18v).
  No app/runtime role was connected; `buyerrecon_prod_collector_app` was not
  used; `buyerrecon_migrator` was not used as the audit DSN.

The DB / binding category branch of Gate 4A is non-`BLOCKED`.

---

## 5. Production traffic assessment

Recorded against §3.5.

- **`ingest_requests.endpoint = '/v1/event'` count**: `26`.
- **Time window**: `v1_event_first_seen_day=2026-05-19`,
  `v1_event_last_seen_day=2026-05-19`. All 26 rows landed on a single day
  (`2026-05-19`), recorded via `received_at`
  (`ingest_requests_time_column_selected=received_at`).
- **HTTP status distribution**: `400: 26`. Every one of the 26 rows is HTTP
  `400`.
- **Reject reason distribution**: `request_body_invalid_json: 26`. Every one
  of the 26 rows carries the same reject reason.
- **`accepted_events` count**: `0`. No row from the 26 ingest rows
  propagated into accepted events.
- **`rejected_events` count**: `0`. No row from the 26 ingest rows
  propagated into rejected events either; this is consistent with the
  PR#17s finding that `request_body_invalid_json` is an envelope-parse
  rejection that produces an `ingest_requests` row only and does **not**
  produce an `accepted_events` or `rejected_events` row.
- **Lane A row count**: `0`. **Lane B row count**: `0`.
  `lane_counts_category=both_zero`.

**Classification.** `production_sprint2_traffic_observed=expected_historical_rejected_only`.
The 26 rows are not unexplained Sprint 2 production traffic; they are the
documented historical evidence rows from
`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`. PR#17s §1
records: "The Sprint 2 `/v1/event` route accepts only a **single top-level
JSON object** … The 26 evidence rows in `ingest_requests` carry `auth_status=ok`
and `reject_reason_code=request_body_invalid_json`, which … means the request
body either parsed to a non-object (most likely a top-level JSON array) **or**
failed `JSON.parse` outright **or** sent a body whose envelope shape did not
match the strict `application/json` single-object contract." PR#17s §4
further records: "After the failure, `buyerrecon.com` ThinLayer `endpointUrl`
was rolled back to the Render legacy collector. The 26 `ingest_requests` rows
are preserved as categorical evidence. **Do not delete failed canary evidence
rows.**" PR#18w honours that rule: the audit's `ingest_requests` query was
count-only, no row was deleted, mutated, or annotated, and no
`request_id` / `session_id` / payload / header value was captured.

**Warning recorded.** `production_sprint2_traffic_warning=historical_pr17s_request_body_invalid_json_rows_present`.
This is carried into §7 as the sole `warnings_triggered` entry and is the
specific reason §1 records `PASS_WITH_WARNINGS` rather than full `PASS`.

**Stop-line not triggered.** `production_event_traffic_unexpected=no`. The 26
rows do **not** represent a positive delta beyond the Gate 3 baseline that
lacks explanation — they are explicitly explained by, and confined to the
window of, the PR#17s incident. The Gate 4A re-audit therefore classifies
them as expected-historical rather than unexpected-new.

---

## 6. Lane and grant assessment

Recorded against §3.5 (Lane row counts) and §3.6 (grant posture).

**Lane row counts.** `lane_a_row_count=0`, `lane_b_row_count=0`,
`lane_counts_category=both_zero`. No row exists in either Lane A or Lane B on
the production cluster. No Lane writer has run; no Lane output exists; no
customer-readable Lane artifact has been produced.

**Migration-016 grant posture (carried verbatim from §3.6).** The categorical
boolean shape required by PR#18o §5.F, migration 016
(`migrations/016_scoring_output_lane_grant_safety.sql`), and PR#18l Lane A/B
output governance is met for every checked role on both lane tables:

- `buyerrecon_migrator`: `S=true I=true U=true D=true` on both Lane A and Lane B — full privileges as required for migration-administering role.
- `buyerrecon_internal_readonly`: `S=true I=false U=false D=false` on both Lane A and Lane B — SELECT-only as required.
- `buyerrecon_customer_api`: `S=false I=false U=false D=false` on both Lane A and Lane B — no access, as required by the customer-API isolation rule.
- `buyerrecon_scoring_worker`: `S=false I=false U=false D=false` on both Lane A and Lane B — no access, as required by the scoring-worker isolation rule.
- `buyerrecon_prod_audit_readonly`: `S=true I=false U=false D=false` on both Lane A and Lane B — SELECT-only, matching the PR#18v §3.7 attestation.
- `PUBLIC`: `S=false I=false U=false D=false` on both Lane A and Lane B (recorded via the corrected `information_schema.table_privileges` query — see §3.6 operator note).

**Audit role does not have DML on Lane tables.** The audit role's INSERT,
UPDATE, DELETE on both Lane A and Lane B is `false`. The `audit_role_lane_dml_present`
stop-line is **not** triggered.

**No Lane writer activity observed.** The audit did not enable, exercise, or
simulate any Lane writer. The audit changed no grants. Migration 016 / PR#18l
Lane A/B output governance is converted from documented expectation to proven
categorical fact for the production cluster by this proof — closing the
`lane_grant_safety_pass=not_attempted` gap recorded in PR#18p §3.4.

---

## 7. Stop-line assessment

Each stop-line surface (carried from PR#18o §5.I and PR#18p §4), recorded
categorically from §3:

- `production_secret_file_missing`: **no**
- `production_secret_file_mode_not_600`: **no**
- `production_secret_file_owner_not_root_root`: **no**
- `production_binding_missing` (`PRODUCTION_DATABASE_URL_present=no`): **no**
- `fallback_used` (`DATABASE_URL_fallback_used != no`): **no**
- `db_category_not_production`: **no**
- `staging_name_match_unexpected`: **no**
- `wrong_current_user` (`current_user_category != production_audit_readonly`): **no**
- `required_count_access_failed` (any of the five required count_access values = no): **no**
- `production_sprint2_traffic_unexpected`: **no** — the 26 `/v1/event` `ingest_requests` rows are documented historical evidence from PR#17s (single-day window `2026-05-19`, `http_status=400` × 26, `reject_reason_code=request_body_invalid_json` × 26, no propagation to `accepted_events` or `rejected_events`), not new unexplained Sprint 2 traffic.
- `historical_rejected_only_v1_event_rows_present`: **yes** — recorded as a categorical warning (not a stop-line). This is the sole `warnings_triggered` entry and is the specific reason §1 records `PASS_WITH_WARNINGS` rather than full `PASS`.
- `lane_counts_non_zero`: **no** (`lane_a_row_count=0`, `lane_b_row_count=0`).
- `customer_api_lane_access_present`: **no** (`buyerrecon_customer_api` is `S=false I=false U=false D=false` on both Lane A and Lane B).
- `scoring_worker_lane_access_present`: **no** (`buyerrecon_scoring_worker` is `S=false I=false U=false D=false` on both Lane A and Lane B).
- `audit_role_lane_dml_present`: **no** (`buyerrecon_prod_audit_readonly` has `I=false U=false D=false` on both Lane A and Lane B; SELECT is permitted by design per PR#18v).
- `public_lane_access_present`: **no** (PUBLIC is `S=false I=false U=false D=false` on both Lane A and Lane B, recorded via the corrected `information_schema.table_privileges` query).
- `secret_printed`: **no** (`DSN_value_printed=no`, `generated_password_printed=no`; no `Authorization:` header, raw `request_id`, raw `session_id`, raw payload, raw response body, env dump, private key / cert body, vault content, shell-history line, or raw row was captured during §A–§H).
- `operator_uncertain`: **no**

`stop_lines_triggered`: **none**.

`warnings_triggered`: **`historical_rejected_only_v1_event_rows_present`**.

No stop-line is triggered. One categorical warning is carried forward to §8
and §12.

---

## 8. Impact on next gates

Recorded against §1's `PASS_WITH_WARNINGS` verdict and §7's `stop_lines_triggered=none`
+ `warnings_triggered=historical_rejected_only_v1_event_rows_present`:

- **Gate 4A DB / grant / traffic branch blocker is closed.** The
  `production_db_category_unexpected` stop-line that BLOCKED PR#18p is
  resolved by §4 of this proof. The eight `not_attempted` migration-016 Lane
  grant safety booleans recorded as unknown in PR#18p §3.4 are converted to
  categorical facts in §3.6 / §6 of this proof.
- **Gate 4A overall is non-`BLOCKED` on its DB / grant / traffic branch.**
  The §5.C website / artifact posture, §5.D `endpointUrl` category
  (`render_legacy_collect`), and §5.E rollback / backup posture recorded in
  PR#18p §3.1, §3.2, and §3.3 remain accepted; if any of those underlying
  artifacts have changed since PR#18p was recorded, a separate light-touch
  re-confirmation PR (not this PR) would be required.
- **Gate 4B planning / artifact-config check may be considered separately**
  under its own Helen GO. PR#18w does not authorise Gate 4B execution; it
  removes the DB / grant / traffic blocker that previously prevented Gate 4B
  consideration from advancing.
- **Gate 4C `endpointUrl` re-flip remains unapproved.** Re-flipping the
  `buyerrecon.com` ThinLayer `endpointUrl` to `/v1/event` requires its own
  separate Helen GO, its own rollback plan, its own stop-lines, and its own
  proof record. PR#18w does not approve, sequence, or pre-authorise any
  re-flip.
- **Gate 4D organic observation remains unapproved.**
- **Gate 4E Track A / Playwright work remains unapproved.**
- **The warning is carried forward.** The `historical_rejected_only_v1_event_rows_present`
  warning, the 26-row count, the single-day window (`2026-05-19`), and the
  PR#17s reference are carried verbatim into §12 (final recap requirement)
  and must be carried into the final scoring / governance recap PR. Any Gate
  4C canary planning that contemplates re-flipping `endpointUrl` to
  `/v1/event` must explicitly reference these 26 historical rows as the
  prior-incident baseline, must not delete them, and must plan its
  diff-from-baseline traffic count accordingly.
- **Final scoring / governance recap PR remains required** before any
  production-cutover readiness claim. PR#18w is one input to that recap; it
  is not the recap itself.

---

## 9. Boundaries

PR#18w explicitly does **not** approve any of the following. Each requires its
own explicit Helen GO scoped to that specific work:

- no further Gate 4A execution by PR#18w beyond the DB / grant / traffic
  re-audit recorded here,
- no `endpointUrl` re-flip,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no production DB mutation,
- no production token provisioning,
- no DB grants (no broadening, no narrowing, no `GRANT`/`REVOKE`),
- no migrations,
- no `schema.sql` change,
- no env file edit,
- no credential rotation,
- no app/runtime credential reset,
- no `buyerrecon_prod_collector_app` reset,
- no `buyerrecon_migrator` reset,
- no Lane A/B writer,
- no customer-facing output (Pass 1 / Trust / Pass 2 / any customer-readable report),
- no dashboard implementation,
- no AMS runtime bridge,
- no runtime scoring,
- no Track A,
- no Playwright,
- no website ThinSDK production-mode activation,
- no production artifact/config mode flip,
- no Gate 4B execution,
- no Gate 4B planning advancement beyond what PR#18m and PR#18n already approved,
- no Gate 4C execution,
- no Gate 4D execution,
- no Gate 4E execution,
- no secret printing (DSN value, generated password, DB username/password pair, `Authorization:` header, raw `request_id`, raw payload, raw response body, full `session_id`, env dump, private key / cert body, vault content, shell history, raw row data).

---

## 10. Operator command set (as executed)

The following command set is the verbatim §A–§H operator package that Helen
ran on the production host to produce the §3 categorical fields. All commands
are read-only against production (with the single exception that §F requires
`sudo -u postgres` for the `has_table_privilege(...)` queries that need
admin-category access; those queries are likewise read-only and never mutate).

> **Operator-only invariants throughout:** no `SELECT *`, no raw rows, no
> payloads, no IDs, no DSN printing, no password printing, no
> `INSERT`/`UPDATE`/`DELETE`/`GRANT`/`REVOKE`/`ALTER`/`CREATE`/`DROP`/`TRUNCATE`,
> no `\password`, no `\copy`, no `\!`, no `\o`, no HTTP call to the production
> collector, no `/var/www` edit.

### A. Shell safety

```
set +x
unset HISTFILE
umask 077

echo "shell_trace: $([[ "$-" == *x* ]] && echo on || echo off)"
echo "histfile_unset: $([ -z "${HISTFILE:-}" ] && echo yes || echo no)"
echo "umask_077: $(umask | grep -q 0077 && echo yes || echo check_manually)"
hostname
whoami
```

Paste-back into §3.1:

- `host_category`: <production|staging|local|unknown>
- `operator_user_category`: <root|postgres_admin|unexpected>
- `shell_trace`: <on|off>
- `histfile_unset`: <yes|no>
- `umask_077`: <yes|no>

Stop immediately if `host_category` is not `production`.

### B. Load production audit binding

```
set +x

if [ -f /root/buyerrecon-production-db.env ]; then
  echo "production_secret_file_exists: yes"
else
  echo "production_secret_file_exists: no"
  exit 1
fi

echo "production_secret_file_mode_600: $([ "$(stat -c '%a' /root/buyerrecon-production-db.env 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "production_secret_file_owner_root_root: $([ "$(stat -c '%U:%G' /root/buyerrecon-production-db.env 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

source /root/buyerrecon-production-db.env
export DATABASE_URL="$PRODUCTION_DATABASE_URL"

echo "PRODUCTION_DATABASE_URL_present: $([ -n "${PRODUCTION_DATABASE_URL:-}" ] && echo yes || echo no)"
echo "DATABASE_URL_fallback_used: no"
echo "dsn_loaded_from_production_binding: $([ -n "${DATABASE_URL:-}" ] && echo yes || echo no)"
```

Paste-back into §3.2.

### C. DB category check

```
echo "db_name_category: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT CASE
      WHEN current_database() ILIKE '%prod%' OR current_database() ILIKE '%production%' THEN 'production'
      WHEN current_database() ILIKE '%staging%' THEN 'staging'
      ELSE 'other'
    END;
  " 2>/dev/null
)"

echo "production_name_match: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT CASE
      WHEN current_database() ILIKE '%prod%' OR current_database() ILIKE '%production%' THEN 'yes'
      ELSE 'no'
    END;
  " 2>/dev/null
)"

echo "staging_name_match: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT CASE WHEN current_database() ILIKE '%staging%' THEN 'yes' ELSE 'no' END;
  " 2>/dev/null
)"

echo "current_user_category: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT CASE
      WHEN current_user = 'buyerrecon_prod_audit_readonly' THEN 'production_audit_readonly'
      WHEN current_user ILIKE '%buyerrecon%' THEN 'buyerrecon_role'
      ELSE 'other'
    END;
  " 2>/dev/null
)"
```

Paste-back into §3.3.

### D. Table existence and required count access

```
echo "tables_present_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM (
      VALUES
        ('accepted_events'),
        ('ingest_requests'),
        ('rejected_events'),
        ('scoring_output_lane_a'),
        ('scoring_output_lane_b'),
        ('site_write_tokens')
    ) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  " 2>/dev/null
)"

psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "SELECT 'ingest_requests_count_access: ' || CASE WHEN COUNT(*) >= 0 THEN 'yes' ELSE 'no' END FROM public.ingest_requests;" 2>/dev/null
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "SELECT 'accepted_events_count_access: ' || CASE WHEN COUNT(*) >= 0 THEN 'yes' ELSE 'no' END FROM public.accepted_events;" 2>/dev/null
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "SELECT 'rejected_events_count_access: ' || CASE WHEN COUNT(*) >= 0 THEN 'yes' ELSE 'no' END FROM public.rejected_events;" 2>/dev/null
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "SELECT 'lane_a_count_access: ' || CASE WHEN COUNT(*) >= 0 THEN 'yes' ELSE 'no' END FROM public.scoring_output_lane_a;" 2>/dev/null
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "SELECT 'lane_b_count_access: ' || CASE WHEN COUNT(*) >= 0 THEN 'yes' ELSE 'no' END FROM public.scoring_output_lane_b;" 2>/dev/null
```

Paste-back into §3.4.

### E. Production Sprint 2 traffic counts (count-only)

All §E queries are read-only, category/count-only against
`public.ingest_requests`, `public.accepted_events`, `public.rejected_events`,
`public.scoring_output_lane_a`, and `public.scoring_output_lane_b`. Forbidden
in this section: any `SELECT *`, any query that returns a row body, raw
`request_id`, raw `session_id`, raw payload, raw header, raw timestamp,
token, hash, or DSN; any `INSERT`/`UPDATE`/`DELETE`/`GRANT`/`REVOKE`/`ALTER`/
`CREATE`/`DROP`/`TRUNCATE`; any `\password`, `\copy`, `\!`, `\o`; any HTTP
call to the production collector; any traffic generation.

**E.1 `/v1/event` total count**

```
echo "ingest_requests_endpoint_v1_event_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM public.ingest_requests
    WHERE endpoint = '/v1/event';
  " 2>/dev/null
)"
```

**E.2 `/v1/event` time-window provenance**

The audit explicitly selects `received_at` as the time column used to compute
the first/last seen day for `endpoint = '/v1/event'` rows. Only the date
component is emitted; no raw timestamp is captured. `MIN(...)::date` and
`MAX(...)::date` return one date value each; `COALESCE(..., 'none')` ensures
the empty-table case yields `none` rather than an empty string.

```
echo "ingest_requests_time_column_selected: received_at"

echo "v1_event_first_seen_day: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COALESCE(to_char(MIN(received_at)::date, 'YYYY-MM-DD'), 'none')
    FROM public.ingest_requests
    WHERE endpoint = '/v1/event';
  " 2>/dev/null
)"

echo "v1_event_last_seen_day: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COALESCE(to_char(MAX(received_at)::date, 'YYYY-MM-DD'), 'none')
    FROM public.ingest_requests
    WHERE endpoint = '/v1/event';
  " 2>/dev/null
)"
```

**E.3 `/v1/event` `http_status` distribution (grouped count only)**

Grouped count by `http_status` for `endpoint = '/v1/event'`. The query
returns one row per distinct status code, with the format `<status>: <count>`.
No `request_id`, `session_id`, payload, header, or row body is selected.
`COALESCE(http_status::text, 'null')` ensures a `NULL` status surfaces as the
literal token `null` rather than an empty cell.

```
echo "distribution_http_status:"
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
  SELECT COALESCE(http_status::text, 'null') || ': ' || COUNT(*)
  FROM public.ingest_requests
  WHERE endpoint = '/v1/event'
  GROUP BY COALESCE(http_status::text, 'null')
  ORDER BY COUNT(*) DESC, COALESCE(http_status::text, 'null');
" 2>/dev/null
```

**E.4 `/v1/event` `reject_reason_code` distribution (grouped count only)**

Grouped count by `reject_reason_code` for `endpoint = '/v1/event'`. Same
shape as §E.3: one row per distinct reason code, `<reason>: <count>`, with
`NULL` surfaced as the literal `null`. No raw row, no identifier, no payload.

```
echo "distribution_reject_reason_code:"
psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
  SELECT COALESCE(reject_reason_code::text, 'null') || ': ' || COUNT(*)
  FROM public.ingest_requests
  WHERE endpoint = '/v1/event'
  GROUP BY COALESCE(reject_reason_code::text, 'null')
  ORDER BY COUNT(*) DESC, COALESCE(reject_reason_code::text, 'null');
" 2>/dev/null
```

**E.5 Accepted / rejected / Lane row counts**

```
echo "accepted_events_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM public.accepted_events;
  " 2>/dev/null
)"

echo "rejected_events_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM public.rejected_events;
  " 2>/dev/null
)"

echo "lane_a_row_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM public.scoring_output_lane_a;
  " 2>/dev/null
)"

echo "lane_b_row_count: $(
  psql "$DATABASE_URL" --no-psqlrc --quiet -tA -c "
    SELECT COUNT(*) FROM public.scoring_output_lane_b;
  " 2>/dev/null
)"
```

Classification (operator-recorded):

- `production_sprint2_traffic_observed`: `none` if all three of
  `ingest_requests_endpoint_v1_event_count`, `accepted_events_count`,
  `rejected_events_count` are `0`.
- `production_sprint2_traffic_observed`: **`expected_historical_rejected_only`**
  is permitted **only** when **every one** of the following holds:
  - `ingest_requests_endpoint_v1_event_count = 26`,
  - `ingest_requests_time_column_selected = received_at`,
  - `v1_event_first_seen_day = 2026-05-19`,
  - `v1_event_last_seen_day = 2026-05-19`,
  - `distribution_http_status` includes exactly `400: 26` (and no other key with a non-zero count),
  - `distribution_reject_reason_code` includes exactly `request_body_invalid_json: 26` (and no other key with a non-zero count),
  - `accepted_events_count = 0`,
  - `rejected_events_count = 0`,
  - `lane_a_row_count = 0`,
  - `lane_b_row_count = 0`,
  - the PR#17s historical baseline
    (`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`) is
    referenced in §1, §5, §7, §8, and §12 of this proof,
  - **no row** in `public.ingest_requests`, `public.accepted_events`,
    `public.rejected_events`, `public.scoring_output_lane_a`, or
    `public.scoring_output_lane_b` is **deleted, mutated, or annotated** by
    this audit. The §E queries are read-only count/category queries; no DML
    is run.

  If any of the above conditions fails — for example, the count is not 26, or
  the day window expands beyond `2026-05-19`, or a new `http_status` /
  `reject_reason_code` key appears — `expected_historical_rejected_only` is
  **not** permitted and `production_sprint2_traffic_observed` must be
  recorded as `unexpected`, with `production_event_traffic_unexpected=yes`
  in §7.

- `production_sprint2_traffic_observed`: `unexpected` in every other case
  where positive counts exist without a matching documented baseline and
  without an authorised Gate 4C canary record.
- `lane_counts_category`: `both_zero` if `lane_a_row_count=0` and
  `lane_b_row_count=0`; `non_zero` if either is `>0`.

Paste-back into §3.5.

### F. Grant posture checks for migration-016 roles

Run as postgres admin:

```
for role in buyerrecon_migrator buyerrecon_internal_readonly buyerrecon_customer_api buyerrecon_scoring_worker buyerrecon_prod_audit_readonly PUBLIC; do
  for lane in scoring_output_lane_a scoring_output_lane_b; do
    sudo -u postgres psql -d buyerrecon_production -tAc "
      SELECT '${role}_${lane}: S=' ||
             has_table_privilege('${role}', 'public.${lane}', 'SELECT') ||
             ' I=' || has_table_privilege('${role}', 'public.${lane}', 'INSERT') ||
             ' U=' || has_table_privilege('${role}', 'public.${lane}', 'UPDATE') ||
             ' D=' || has_table_privilege('${role}', 'public.${lane}', 'DELETE');
    "
  done
done
```

Expected (per migration 016 + PR#18l + PR#18v §3.7):

- `buyerrecon_migrator`: `S=t I=t U=t D=t` on both Lane A and Lane B.
- `buyerrecon_internal_readonly`: `S=t I=f U=f D=f` on both Lane A and Lane B.
- `buyerrecon_customer_api`: `S=f I=f U=f D=f` on both Lane A and Lane B.
- `buyerrecon_scoring_worker`: `S=f I=f U=f D=f` on both Lane A and Lane B.
- `buyerrecon_prod_audit_readonly`: `S=t I=f U=f D=f` on both Lane A and Lane B.
- `PUBLIC`: `S=f I=f U=f D=f` on both Lane A and Lane B.

Paste-back into §3.6.

### G. Stop-line evaluation

After §A–§F complete, evaluate every stop-line in §7. Any single triggered
stop-line forces `BLOCKED` per §6.

### H. Cleanup

```
unset DATABASE_URL
unset PRODUCTION_DATABASE_URL
unset PGPASSWORD
unset PGSERVICE
unset PGPASSFILE

echo "cleanup_dsn_unset: $([ -z "${DATABASE_URL:-}" ] && [ -z "${PRODUCTION_DATABASE_URL:-}" ] && echo yes || echo no)"
echo "cleanup_done: yes"
```

Do **not** delete `/root/buyerrecon-production-db.env`. The binding file is
PR#18v's persisted artifact; cleanup is scoped to operator-shell variables
only.

Paste-back into §3.7.

---

## 11. Verdict classification rule (applied to this proof in §1)

§1 records one of:

**PASS** only if all of the following hold:

- `production_secret_file_exists=yes`
- `production_secret_file_mode_600=yes`
- `production_secret_file_owner_root_root=yes`
- `PRODUCTION_DATABASE_URL_present=yes`
- `DATABASE_URL_fallback_used=no`
- `dsn_loaded_from_production_binding=yes`
- `db_name_category=production`
- `production_name_match=yes`
- `staging_name_match=no`
- `current_user_category=production_audit_readonly`
- all five required count_access values are `yes`
- `ingest_requests_endpoint_v1_event_count=0`
- `accepted_events_count=0`
- `rejected_events_count=0`
- `production_sprint2_traffic_observed=none`
- `lane_a_row_count=0`
- `lane_b_row_count=0`
- `lane_counts_category=both_zero`
- migration-016 grant posture holds exactly as listed in §F
- `cleanup_done=yes`
- no secrets printed during the audit
- no warning is carried in `warnings_triggered`

**PASS_WITH_WARNINGS** is permitted when, in addition to all stop-lines being
`no`, one or more of the following warning conditions is recorded:

- the optional `public.site_write_tokens` table is absent
  (`tables_present_count=5` instead of `6`) but all five required Gate 4A
  audit tables are present and every required count_access value is `yes`,
- some non-critical health check (not part of this PR's scope) remains
  `not_attempted`,
- **`production_sprint2_traffic_observed=expected_historical_rejected_only`**
  — permitted only when **every one** of the following provenance conditions
  holds (the same gate enforced in §10.E classification rules; provenance
  comes from §10.E.1–§10.E.5 commands):
  - `ingest_requests_endpoint_v1_event_count = 26`,
  - `ingest_requests_time_column_selected = received_at`,
  - `v1_event_first_seen_day = 2026-05-19`,
  - `v1_event_last_seen_day = 2026-05-19`,
  - `distribution_http_status` includes exactly `400: 26` (and no other key with a non-zero count),
  - `distribution_reject_reason_code` includes exactly `request_body_invalid_json: 26` (and no other key with a non-zero count),
  - `accepted_events_count = 0`,
  - `rejected_events_count = 0`,
  - `lane_a_row_count = 0`,
  - `lane_b_row_count = 0`,
  - the PR#17s historical baseline
    (`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`) is
    explicitly referenced in §1, §5, §7, §8, and §12 of this proof,
  - **no row** in `public.ingest_requests`, `public.accepted_events`,
    `public.rejected_events`, `public.scoring_output_lane_a`, or
    `public.scoring_output_lane_b` is **deleted, mutated, or annotated** by
    this audit.

  When every one of the above holds,
  `production_sprint2_traffic_unexpected` is recorded as `no`, the warning
  `historical_rejected_only_v1_event_rows_present=yes` is carried in
  `warnings_triggered`, and §1 may record `PASS_WITH_WARNINGS`. If any one
  of the conditions fails, this warrant does **not** apply and
  `production_sprint2_traffic_observed` must be recorded as `unexpected`,
  forcing a stop-line (`production_event_traffic_unexpected=yes`) and a
  `BLOCKED` verdict.

The third PASS_WITH_WARNINGS warrant is the one applied to this proof in §1.

**BLOCKED** is required if any §7 stop-line is triggered.

---

## 12. Final recap requirement

A final scoring / governance recap PR remains required after Gate 4
implementation/preflight and any issue-fix PRs, before any production-cutover
readiness claim. PR#18w is one input to that recap; it is not the recap
itself.

The recap PR must carry forward, verbatim:

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

The recap PR must also carry forward, explicitly:

- the PR#18v `PASS` verdict for the dedicated `buyerrecon_prod_audit_readonly`
  credential and the root-only production DSN binding,
- the PR#18w **`PASS_WITH_WARNINGS`** verdict, the `stop_lines_triggered=none`
  result, and the single `warnings_triggered=historical_rejected_only_v1_event_rows_present`
  entry,
- the 26-row count, the single-day window `2026-05-19`, the `http_status=400` × 26
  distribution, the `reject_reason_code=request_body_invalid_json` × 26
  distribution, and the PR#17s reference (`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`)
  for the historical-rejected-only `/v1/event` `ingest_requests` rows,
- the converted migration-016 Lane grant safety status recorded in §3.6 / §6
  of this proof (now categorical facts for the production cluster, not
  expectations),
- the §5.C / §5.D / §5.E recorded posture from PR#18p (artifact set,
  `endpointUrl_category=render_legacy_collect`, rollback / backup posture),
- Gate 4B / 4C / 4D outcomes once recorded,
- the rollback posture and any further open warnings.

Any Gate 4C canary planning that contemplates re-flipping `endpointUrl` to
`/v1/event` must explicitly reference the PR#17s 26-row historical baseline
recorded by this proof and must not delete those rows.

No production-cutover readiness claim may rely on PR#18w alone.

---

End of PR#18w. **Gate 4A DB / grant / traffic re-audit execution proof.
Verdict: PASS_WITH_WARNINGS. Stop-lines triggered: none. Warnings triggered:
`historical_rejected_only_v1_event_rows_present` (26 HTTP `400`
`request_body_invalid_json` `/v1/event` `ingest_requests` rows from
`2026-05-19`, documented in
`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`, with zero
propagation to `accepted_events`, `rejected_events`, or Lane A/B; not deleted,
not mutated, not annotated by this audit). DB / binding / category / count /
Lane-row / migration-016 grant posture all match expected:
`production_secret_file_exists=yes`,
`production_secret_file_mode_600=yes`,
`production_secret_file_owner_root_root=yes`,
`PRODUCTION_DATABASE_URL_present=yes`, `DATABASE_URL_fallback_used=no`,
`dsn_loaded_from_production_binding=yes`, `db_name_category=production`,
`production_name_match=yes`, `staging_name_match=no`,
`current_user_category=production_audit_readonly`, `tables_present_count=6`,
all five required count_access values `yes`, `accepted_events_count=0`,
`rejected_events_count=0`, `lane_a_row_count=0`, `lane_b_row_count=0`,
`lane_counts_category=both_zero`, `buyerrecon_migrator` full S/I/U/D on both
Lane A and Lane B, `buyerrecon_internal_readonly` SELECT-only on both,
`buyerrecon_customer_api` no access on either, `buyerrecon_scoring_worker` no
access on either, `buyerrecon_prod_audit_readonly` SELECT-only on both
(matching PR#18v §3.7), `PUBLIC` no access on either (via corrected
`information_schema.table_privileges` query), `cleanup_done=yes`,
`DSN_value_printed=no`, `generated_password_printed=no`. Gate 4A DB / grant
/ traffic branch is non-`BLOCKED`. Gate 4B planning / artifact-config check
may be considered separately under its own Helen GO. Gate 4C `endpointUrl`
re-flip remains unapproved and requires its own Helen GO, rollback plan,
stop-lines, and proof record. Gate 4D and Gate 4E remain unapproved. No
production DB mutation, no DB grants, no migrations, no `schema.sql` change,
no env file edit, no credential rotation, no `buyerrecon_prod_collector_app`
reset, no `buyerrecon_migrator` reset, no `endpointUrl` re-flip, no
`buyerrecon.com` production `/v1/event` call, no Render `/collect` call, no
`/var/www` edit, no production traffic generation, no production token
provisioning, no Lane A/B writer, no customer-facing output, no dashboard
implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no
runtime scoring, no Track A, no Playwright, no website ThinSDK production
activation, no production artifact or config mode flip, and no Gate 4B / Gate
4C / Gate 4D / Gate 4E execution are approved by PR#18w. Any future Gate 4B
artifact/config PR, Gate 4C canary PR (which must reference the PR#17s 26-row
baseline recorded here), Gate 4D observation PR, Gate 4E Track A / Playwright
PR, issue-fix PR, final scoring / governance recap PR, runtime PR, or
customer-surface PR remains separately gated by its own explicit Helen GO.**
