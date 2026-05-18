# BuyerRecon Sprint 2 PR#17f — Production Migration / Operator Runbook

Status: **execution-approved operator runbook, but execution is gated**. Authoring of PR#17f is **docs-only**; the runbook below may be executed by the operator **only after** this PR is reviewed, merged, *and* Helen records the explicit "final GO" message described in §2.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `434e9fa` — PR#17e merged, "plan Track A unlabelled proof").

PR branch: `buyerrecon-sprint2-pr17f-production-migration-operator-runbook`

---

## 1. Purpose

PR#17f defines the **execution-approved operator runbook** for preparing the Sprint 2 production data plane:

- creating or confirming the Sprint 2 production database identity,
- applying the **existing repo migrations** (`migrations/002_*.sql` through `migrations/016_*.sql`, where `016_scoring_output_lane_grant_safety.sql` is the Sprint 2 PR#17g Lane A/B grant-safety correction; see §7) to that production DB,
- creating or confirming the production DB roles, with least-privilege grants,
- creating or confirming production **workspace/site rows** for the five live sites,
- provisioning production **`site_write_tokens`** for those sites, with all raw token material held only in the approved operator vault,
- placing production **secrets** in the approved deployment/operator secret store,
- verifying schema/migration status, role/grant posture, and workspace/site/token metadata safely,
- preserving the **rollback / revocation** path and producing a **proof closure report**.

PR#17f is **not** a planning-only PR. Once merged and once Helen records the §2 final GO, the operator is authorised to execute exactly this runbook against the production data plane.

PR#17f is also explicit about what it does **not** do, ever:

- it does **not** execute anything during authoring or review,
- it does **not** cut any ThinLayer `endpointUrl` on any live site (`buyerrecon.com` included),
- it does **not** change DNS,
- it does **not** generate production traffic,
- it does **not** run Track A,
- it does **not** run Playwright,
- it does **not** deploy the Sprint 2 collector service in a way that takes live ThinLayer traffic,
- it does **not** enable any customer-facing automated output,
- it does **not** approve durable Lane A/B writers, an AMS runtime bridge, AMS Trust Core exposure, or Pass 1 / Pass 2 implementation,
- it does **not** treat the staging DB as production,
- it does **not** treat the Render legacy DB as the Sprint 2 canonical production DB.

Anything in PR#17f that resembles an instruction is a **runbook step the operator may execute only after the §2 gates are satisfied**.

---

## 2. Execution status and approval gates

PR#17f's execution status is governed by six sequential gates. The runbook is not executable until **all** of gates 1–4 have been satisfied; gate 5 is the execution; gate 6 is the closure.

1. **Draft runbook PR created.** This document is committed to the PR branch `buyerrecon-sprint2-pr17f-production-migration-operator-runbook`.
2. **Codex review PASS.** PR#17f passes a narrow review against the constraints in §28 (and against the PR#17a–PR#17e architectural posture).
3. **PR merged.** The PR is merged into `sprint2-architecture-contracts-d4cc2bf`.
4. **Helen final GO recorded.** Helen records the explicit final-GO message (see expected wording below) in a place that is part of the durable record of this execution (PR comment, issue, runbook log entry). Until this message is recorded **verbatim or in unambiguous equivalent form**, the runbook is not executable.
5. **Operator executes runbook** exactly as written in this document, against the named production target, recording each step's outcome.
6. **Proof closure PR / report created** (per §21), summarising what was executed and what was verified.

Governing rules:

- **Merge alone is not enough to execute.** Helen's final GO is the gate that distinguishes "runbook is canonical" from "runbook may run now".
- **Helen's final GO must explicitly state target and allowed scope.** A general "go ahead" or "looks good" is **not** a final GO; ambiguous wording is a stop-the-line condition (§25).
- **If the GO is ambiguous, do not execute.** Ask for an explicit GO message in the expected shape below.

**Expected Helen final-GO wording (verbatim, or unambiguous equivalent):**

> "I approve executing PR#17f operator runbook now. Scope: production Sprint 2 DB / migrations / roles / tokens / verification only. No ThinLayer cutover. No Track A. No customer-facing output."

If the recorded GO message diverges from the scope above (for example: it adds "and cut `buyerrecon.com` over"), the operator must stop and request an explicit, scope-correct GO message. The operator may not broaden scope beyond what the final-GO message authorises.

---

## 3. Inputs from PR#17a / PR#17b / PR#17c / PR#17d / PR#17e

PR#17a, PR#17b, PR#17c, PR#17d, and PR#17e are merged and govern PR#17f:

- **Render legacy remains archive / fallback.** `https://buyerrecon-backend.onrender.com/collect` and the legacy Render Postgres remain live, untouched, and available as rollback. Render legacy data is not force-migrated. (PR#17a §2, §4, §10.)
- **Sprint 2 schema is the canonical future** for BuyerRecon evidence. (PR#17a §4.)
- **A production collector endpoint is planned** (e.g. placeholder `collector.buyerrecon.com`); PR#17f does **not** cut over to it. (PR#17b §4, §5, §8, §9.)
- **Production DB / roles / workspaces / `site_write_tokens` must be separate from staging** and separate from Render legacy at name, host, credentials, role grants, workspace/site rows, and token level. The Hetzner staging DB is not promoted; the Render legacy DB is not made canonical. (PR#17b §6; PR#17c §4, §6, §8, §9, §11, §12.)
- **`buyerrecon.com` remains the first future canary site.** All five live site identities may be provisioned in PR#17f (if Helen's GO authorises), but no cutover happens here. (PR#17a §11; PR#17c §8; PR#17d §4.)
- **PR#17d governs the future `buyerrecon.com` canary endpoint cutover runbook.** PR#17f does not execute PR#17d.
- **PR#17e governs the future Track A unlabelled `B_analytics_only` proof.** PR#17f does not execute PR#17e.
- **Track A labels remain private run-log only** and never appear in URL, UTM, dataLayer, cookies, storage, backend payload, headers, user agent, GA4, marketing tags, accepted/rejected events, ingest_requests, logs, Evidence Snapshot, Lane A/B preview, reports, tokens, or workspace/site IDs.
- **Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.** Internal Evidence Snapshot and Lane A/B preview remain internal-only. (PR#17a §6.5, §8, §9.)

PR#17f inherits these constraints and does not relax any of them.

---

## 4. Non-goals

PR#17f explicitly does **not** approve and does **not** perform any of the following — ever, regardless of merge or GO state:

- ThinLayer `endpointUrl` cutover on any live site,
- any DNS change (`collector.buyerrecon.com` or otherwise),
- Render shutdown or any modification of the Render legacy backend or DB,
- production traffic generation (organic, synthetic, or programmatic),
- Track A execution,
- Playwright execution,
- enabling any customer-facing automated output,
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output,
- implementation of Pass 1 or Pass 2 governance,
- all-site cutover,
- migration of Render legacy historical data into the Sprint 2 production DB.

Anything in this list that is later required is delivered in a separate, explicitly-scoped PR (see §27).

---

## 5. Operator scope

After gates 1–4 in §2 are satisfied, the operator executing PR#17f's runbook **may**:

- create or confirm the Sprint 2 production DB identity (per §6),
- apply the **existing repo migrations** (`migrations/002_*.sql` through `migrations/016_*.sql`, with `016_scoring_output_lane_grant_safety.sql` required to land the PR#17g Lane A/B grant-safety correction before the production migration phase is considered complete) to the production DB, **in numeric order** (per §7, §8),
- create or confirm the production DB roles (per §10),
- apply least-privilege grants to those roles (per §11),
- create or confirm the production workspace / site rows for the five live sites (per §12),
- provision production `site_write_tokens` for those sites, with raw material held only in the approved operator vault (per §13),
- place production secrets in the approved deployment / operator secret store (per §14),
- verify migration status and that the **exact deployed table names** match the migrations (per §17),
- verify role / grant posture (per §17),
- verify workspace / site / token metadata safely (no raw token material exposed; per §17),
- run **DB-only verification** (no live traffic, no browser, no ThinLayer); **live or collector smoke is deferred to PR#17g / PR#17h** (per §18),
- produce the proof closure report (per §21).

After gates 1–4, the operator **must not**:

- change any website `endpointUrl`,
- deploy the Sprint 2 collector service in a configuration that takes live ThinLayer traffic (env / secrets placement is permitted *only* as preparation, never as service cutover),
- send any browser traffic,
- run Track A,
- run Playwright,
- enable any customer-facing automated output.

If a task is not enumerated in this section, the operator does not perform it under PR#17f.

---

## 6. Production DB identity

Constraints on the production DB:

- **Production DB must be separate from `buyerrecon_staging`.** Distinct database name, distinct credentials, distinct connection target.
- **Production DB must not be the Render legacy DB.** Render legacy Postgres remains read-only archive/fallback; it is not promoted, re-tagged, or extended into Sprint 2 canonical use.
- **DB name may be referenced in this doc as a placeholder only** — e.g. `<PRODUCTION_DB_NAME>` or `buyerrecon_production`. The actual production DB name, host, port, user, password, private IP, and DSN do **not** appear in this doc, in chat, in PR comments, or in terminal transcripts. They live only in the approved operator vault and on the operator's controlled machine.
- **Production DB is a separate evidence ledger** from staging and from Render legacy. Rows in production are not interchangeable with rows in staging or in Render legacy. No automated cross-environment write paths exist.

### Operator verification categories

Performed by the operator **only after merge + Helen final GO**, with all output masked before any artefact is committed to repo/chat/PR:

- **DB name check** — confirms the connected DB matches `<PRODUCTION_DB_NAME>` and is not `buyerrecon_staging`.
- **DB host / isolation check (masked)** — confirms the connected host matches the approved production host category, recorded only as a masked/categorical reference in the proof report.
- **Current database check** — confirms `current_database()` returns the expected production identifier.
- **Staging DB absence check** — confirms staging credentials / DSN cannot resolve from the production-tagged operator session.
- **Render legacy separation check** — confirms Render legacy host is not the target of any PR#17f operation.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**, against the production target):

```
# Verify identity. Replace placeholders by retrieving values from the approved operator vault.
# Do not paste real values into repo/chat/PR.
psql "<MASKED_DATABASE_URL>" -c "select current_database(), current_user, inet_server_addr() is not null as has_server_addr;"
```

The operator records the textual outcome **after masking** any host/IP/user material; only categorical PASS/FAIL goes into the proof report.

---

## 7. Migration source and order

Constraints on migration sources:

- **Only migrations already present in the repo may be applied.** No new migration files are added in PR#17f. No edits to existing migrations.
- **No modification of `schema.sql`** in PR#17f (and at the time of writing this runbook, no `schema.sql` file exists at the repo root; the canonical schema is defined by the `migrations/` directory).
- **The current canonical migration order is the numeric file order in `migrations/`** at the moment PR#17f is merged. As of authoring this runbook, that order is:

  1. `migrations/002_event_contract_v2.sql`
  2. `migrations/003_ingest_requests.sql`
  3. `migrations/004_accepted_events_evidence_columns.sql`
  4. `migrations/005_rejected_events_evidence_columns.sql`
  5. `migrations/006_site_write_tokens.sql`
  6. `migrations/007_accepted_events_dedup_index.sql`
  7. `migrations/008_session_features.sql`
  8. `migrations/009_session_behavioural_features_v0_2.sql`
  9. `migrations/010_session_behavioural_features_v0_2_refresh_loop.sql`
  10. `migrations/011_scoring_output_lanes.sql`
  11. `migrations/012_stage0_decisions.sql`
  12. `migrations/013_risk_observations_v0_1.sql`
  13. `migrations/014_poi_observations_v0_1.sql`
  14. `migrations/015_poi_sequence_observations_v0_1.sql`
  15. `migrations/016_scoring_output_lane_grant_safety.sql` *(Sprint 2 PR#17g — Lane A/B grant-safety correction)*

  The operator re-verifies the order at execution time against the merged state of `migrations/` and applies whatever is present in numeric order. Any migration not listed above that exists at execution time (because additional approved migrations were merged after PR#17g) is applied in its own numeric position.

  **About migration `016_scoring_output_lane_grant_safety.sql` (PR#17g):** migration `011_scoring_output_lanes.sql` grants `SELECT, INSERT, UPDATE` on `scoring_output_lane_a` and `scoring_output_lane_b` to `buyerrecon_scoring_worker`. Those grants constitute durable Lane A/B writer privileges, which PR#17f §11 and §22 explicitly forbid. Migration 016 is the **safety correction** that:

  - `REVOKE ALL` on `scoring_output_lane_a` and `scoring_output_lane_b` from `buyerrecon_scoring_worker`,
  - re-asserts (idempotently) `GRANT ALL` to `buyerrecon_migrator` for future approved DDL,
  - re-asserts (idempotently) `GRANT SELECT` to `buyerrecon_internal_readonly` for internal verification / preview only,
  - re-asserts (idempotently) `REVOKE ALL` from `buyerrecon_customer_api` as defence-in-depth,
  - includes post-migration `has_table_privilege` assertions that fail the migration if `buyerrecon_scoring_worker` still has any of `SELECT/INSERT/UPDATE/DELETE` on either lane table, if `buyerrecon_customer_api` has `SELECT` on either lane table, if `buyerrecon_internal_readonly` is missing `SELECT` on either lane table, or if `buyerrecon_internal_readonly` has any of `INSERT/UPDATE/DELETE` on either lane table.

  PR#17f execution **must apply migration 016 after migration 015** before the production migration phase is considered complete. The production migration phase is **not** considered complete if 016 has not been applied — the production DB would otherwise carry the migration-011 durable Lane A/B writer grant that PR#17f forbids. **Durable Lane A/B writers remain deferred to a later explicitly approved output-gate PR** (not PR#17g, not PR#17f). PR#17g does not introduce a Lane A/B writer; it removes one that the migration-011 carry-over would otherwise install.
- **Migration status must be captured before and after.** "Before" snapshot is taken **immediately** prior to applying any migration; "after" snapshot is taken once the last migration in the approved order has been applied (or, on failure, immediately after the failure).
- **Schema drift check is required before applying migrations.** The operator inspects the production DB to confirm it is in the expected pre-migration state: no unexpected pre-existing Sprint 2 tables, no foreign objects from a non-canonical migration, no half-applied migration leftover from another environment.
- **If any migration fails, stop immediately.** Do not partially continue. Do not attempt to "skip" a failed migration. Do not edit a migration mid-flight. Record the failed migration filename, the failure message (masked of any secret-like content), the line/object on which it failed (if visible), and the database state observed at failure.
- **Record failed migration state and rollback / recovery decision** in the proof report; do not proceed to subsequent migrations or to role/grant/token steps until Helen reviews the failure and records a follow-up decision.

Important reaffirmations:

- **Use exact existing migration filenames and order.** Do not invent migrations.
- **Do not edit migrations** during execution (no `sed`, no manual SQL splicing).
- **Do not modify `schema.sql`** (and do not create one in PR#17f).

---

## 8. Migration execution phase

This phase is labelled:

> **RUN ONLY AFTER MERGE + HELEN FINAL GO.**

Sequential steps (the operator follows them in order; on any failure or anomaly, stop and follow §19 / §20):

1. **Confirm the DB target is production and not staging.** Re-verify §6 checks immediately before any migration is applied.
2. **Confirm the Render legacy DB is not the target.** Render legacy host must not appear in the active connection.
3. **Confirm the migration operator role.** The connected role must be the **migrator role** (per §10), not the collector writer role, not the worker role, and not a superuser if at all avoidable per local policy.
4. **Snapshot migration status before.** Capture which Sprint 2 tables and indexes already exist (typically: none, on a fresh production DB) and record categorically in the proof report. No raw object DDL is required; presence/absence is enough.
5. **Run schema drift check.** Confirm there are no unexpected pre-existing Sprint 2 objects in the production DB. If any are found, **stop**.
6. **Apply migrations in the approved numeric order** from §7. The operator runs each migration file as a single atomic application (each migration file's `BEGIN`/`COMMIT` is the unit of atomicity per its own internal structure).
7. **Snapshot migration status after.** Capture which Sprint 2 tables and indexes now exist; confirm presence of the expected canonical surface (see §11 for the canonical surface list).
8. **Verify expected tables exist.** Use the exact deployed names (see §9), including `session_behavioural_features_v0_2` from `009_session_behavioural_features_v0_2.sql` and the `_v0_1` observation tables.
9. **Verify no unexpected tables are missing.** Cross-reference against the migration list in §7.
10. **Stop and report if any anomaly.** Anomaly here includes: missing expected table, unexpected extra table, drift between the migration that should have run and the actual columns on disk, or any non-zero exit from a migration application command.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Apply each migration file in numeric order. Replace placeholders from the operator vault.
# Run one file at a time, capture stdout/stderr, mask any secret-like content, and record outcome.
psql "<MASKED_DATABASE_URL>" -v ON_ERROR_STOP=1 -f migrations/002_event_contract_v2.sql
psql "<MASKED_DATABASE_URL>" -v ON_ERROR_STOP=1 -f migrations/003_ingest_requests.sql
# ... continue in numeric order through migrations/015_poi_sequence_observations_v0_1.sql,
# then apply migrations/016_scoring_output_lane_grant_safety.sql (PR#17g Lane A/B grant-safety
# correction) before considering the migration phase complete ...
```

- `<MASKED_DATABASE_URL>` is sourced from the approved operator vault. It is **not** pasted into repo, chat, PR, or terminal transcripts that are shared.
- `-v ON_ERROR_STOP=1` is recommended so the operator gets immediate failure on any error — the runbook requires immediate stop on failure.
- The operator may use a different migration mechanism (e.g. a chosen migration runner) so long as the **applied set** matches `migrations/002_*.sql` through the highest-numbered migration present at execution time, **in numeric order**, and the resulting state is verified per §17. Whatever mechanism is used, no migration file is edited and no migration is invented.

---

## 9. Exact table / version naming discipline

The proof report must use **exact deployed table names**, not generic descriptions. In particular:

- `session_behavioural_features_v0_2` (from `migrations/009_session_behavioural_features_v0_2.sql`) is the deployed table name; the proof report does **not** use a generic `session_behavioural_features` label where the versioned name applies.
- `_v0_1` observation tables (from `migrations/013_*.sql`, `migrations/014_*.sql`, `migrations/015_*.sql`) appear under their versioned names; the proof report does not flatten the version.
- If, at execution time, table names in the production DB differ from the names assumed in this runbook (because additional approved migrations have been merged), the proof report records the **actual deployed names**, not the names assumed at authoring time.
- **Evidence Snapshot** and **Lane A/B preview** are currently **observer outputs** (read-only over the canonical evidence surface). The proof report does **not** imply they have durable writer tables of their own; if a future PR introduces such tables, that PR names them explicitly and updates this discipline.

---

## 10. Production role model

Role families to be created or confirmed by the runbook (categories only — **no role passwords, no connection strings, no real role names tied to credentials in this doc**):

- **Migrator role** — used only during migration application; revoked from interactive use after migration. Has the elevated grants required to alter schema.
- **Collector writer role** — used by the Sprint 2 production collector service when it later runs against production traffic. Has write access only to the ledger surface the collector needs at runtime.
- **Feature / scoring worker role** — used by downstream feature extractors, Stage 0 record-only worker, and observation workers. Reads from the ledger surface; writes to feature/observation surfaces it owns. The runbook supports **splitting** worker grants by actual ownership where the production deployment chooses to do so (see §11).
- **Internal readonly / observer role** — read-only, used by Evidence Snapshot and Lane A/B preview observers, and by internal review tooling.
- **Customer / API read role** *(only if later needed)* — not created by PR#17f unless Helen's GO explicitly includes it; this role is otherwise deferred.
- **Backup / operator role** *(if needed)* — used by backup, monitoring, and operator tooling. Scope is whatever is required for backup/restore and health-checks, no application read/write.

Governing constraints:

- **No superuser app role.** The collector and the workers never run as superuser. Superuser usage is restricted to one-off operator activity, recorded in the operator runbook.
- **No shared staging role in production.** Role names, passwords, and connection strings are distinct between staging and production.
- **Role passwords, connection strings, and DSNs do not appear in this doc, in PR comments, in chat, or in committed terminal transcripts.**
- **Roles are production-only** — they have no cross-environment grants.
- **Grants are least-privilege** — see §11.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
-- Create or confirm each role family. Replace placeholders from the operator vault.
-- Do not paste real role names or passwords into repo/chat/PR.
CREATE ROLE <MIGRATOR_ROLE>           LOGIN PASSWORD '<MIGRATOR_PASSWORD>';
CREATE ROLE <COLLECTOR_WRITER_ROLE>   LOGIN PASSWORD '<COLLECTOR_PASSWORD>';
CREATE ROLE <FEATURE_WORKER_ROLE>     LOGIN PASSWORD '<FEATURE_PASSWORD>';
CREATE ROLE <INTERNAL_READONLY_ROLE>  LOGIN PASSWORD '<INTERNAL_READONLY_PASSWORD>';
-- Backup/operator role and customer/API read role are created only if explicitly authorised.
```

All credentials are retrieved from the approved operator vault. If a real credential appears in any artefact destined for the repo/chat/PR, the operator stops and follows §20.

---

## 11. Grant boundary plan

Table access boundaries by role family (planning level; the operator finalises the **exact** `GRANT … ON … TO …` set at execution time, using exact deployed table names per §9):

| Surface (exact deployed name) | Migrator | Collector writer | Feature / scoring worker (split by owner if applicable) | Internal readonly / observer | Customer / API read (only if later approved) | Backup / operator |
|---|---|---|---|---|---|---|
| `ingest_requests` | DDL | INSERT | SELECT | SELECT | none in PR#17f scope | backup/restore scope only |
| `accepted_events` | DDL | INSERT | SELECT | SELECT | none in PR#17f scope | backup/restore scope only |
| `rejected_events` | DDL | INSERT | SELECT | SELECT | none in PR#17f scope | backup/restore scope only |
| `site_write_tokens` (from `006_site_write_tokens.sql`) | DDL | SELECT (token validation) | SELECT (metadata only as needed) | SELECT (metadata only) | none in PR#17f scope | backup/restore scope only |
| `session_features` | DDL | none | INSERT/UPDATE on owning worker only | SELECT | none in PR#17f scope | backup/restore scope only |
| `session_behavioural_features_v0_2` | DDL | none | INSERT/UPDATE on owning worker only | SELECT | none in PR#17f scope | backup/restore scope only |
| Refresh-loop derivation on `session_behavioural_features_v0_2` (from `010_*.sql`) | DDL | none | INSERT/UPDATE on owning worker only | SELECT | none in PR#17f scope | backup/restore scope only |
| `scoring_output_lane_a` / `scoring_output_lane_b` (from `011_scoring_output_lanes.sql`) | DDL during migration only | none | **none in PR#17f scope** | SELECT (if needed for verification / internal preview) | none in PR#17f scope — Lane B / claim-confidence / Trust Core surfaces remain internal | backup/restore scope only |
| Stage 0 decisions (from `012_stage0_decisions.sql`) | DDL | none | INSERT (record-only) | SELECT | none in PR#17f scope | backup/restore scope only |
| `risk_observations_v0_1` | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17f scope | backup/restore scope only |
| `poi_observations_v0_1` | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17f scope | backup/restore scope only |
| `poi_sequence_observations_v0_1` | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17f scope | backup/restore scope only |
| Product-context / timing-window / ProductFeatures candidate observation tables (where present at execution time) | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17f scope | backup/restore scope only |
| Evidence Snapshot observer reads | n/a (read-only observer, no durable writer) | none | none | SELECT | none in PR#17f scope | backup/restore scope only |
| Lane A/B preview observer reads | n/a (read-only observer, no durable writer) | none | none | SELECT | none in PR#17f scope | backup/restore scope only |

Governing constraints:

- **The collector writer role writes only the collector ledger tables it needs at runtime** (`ingest_requests`, `accepted_events`, `rejected_events`). It does not write to feature, observation, Snapshot, or Lane A/B surfaces. It has `SELECT` on `site_write_tokens` only insofar as the deployed token-validation path requires it; this is reviewed at execution time against the actual code path.
- **Downstream feature / scoring worker grants are split by actual ownership.** A single broad worker role with mutation rights over unrelated derived tables is **not approved**. If the production deployment uses multiple worker processes (Stage 0, risk observation, POI observation, POI sequence observation, scoring output lanes, etc.), each gets the narrowest grant set required by its job. The operator records the chosen split in the proof report.
- **The internal readonly / observer role reads** the canonical evidence surface for Evidence Snapshot and Lane A/B preview internal validation. It does not write.
- **The customer / API read role is not created in PR#17f's default scope.** If Helen's final GO explicitly authorises its creation, the operator may create it — but its grants must not include Lane B, internal claim-confidence, Trust Core, AMS runtime bridge, or any future output-gate surface. A customer/API read role can only be useful once Pass 1 / Trust / Pass 2 are designed; PR#17f does not pre-grant against those surfaces.
- **No durable Lane A/B writers are approved.** Lane A/B remains a read-only preview. **Any future writer to `scoring_output_lane_a` / `scoring_output_lane_b` is deferred to a later explicitly approved output-gate PR. PR#17f does not approve durable Lane A/B writers.** The migrator role applies `011_scoring_output_lanes.sql` so the surfaces exist for future use, but no role under PR#17f receives `INSERT` / `UPDATE` / `DELETE` on `scoring_output_lane_a` or `scoring_output_lane_b`; the internal readonly / observer role may hold `SELECT` only if needed for verification or internal preview, and that `SELECT` does not constitute output approval.

---

## 12. Workspace and site identity provisioning

Production workspace / site identities to be provisioned or confirmed (only if Helen's final GO covers them):

- `buyerrecon.com`
- `realbuyergrowth.com`
- `timetopoint.com`
- `fidcern.com`
- `keigen.co.uk`

### 12.1 Identity surface in the current migration set

PR#17f must align with what the **approved migration set actually defines**. In `migrations/002_*.sql` through `migrations/016_*.sql`, there is **no dedicated workspace table** and **no dedicated site table**. Workspace / site identity is represented by **server-side `workspace_id` and `site_id` text values stored as metadata columns on `site_write_tokens`** (from `migrations/006_site_write_tokens.sql`).

Concretely, the `site_write_tokens` table carries:

- `token_id` (UUID primary key),
- `token_hash` (HMAC-SHA256 of the raw token with the server-side pepper; **raw token is never stored**),
- `workspace_id` (text),
- `site_id` (text),
- `label` (admin-friendly description),
- `created_at`,
- `disabled_at` (NULL = active; soft-delete sentinel),
- `last_used_at`.

This is the **canonical identity surface** for production workspace / site under the current migration set. Workspace and site identifiers are server-stamped from token-validation on the collector; they are never payload-trusted.

### 12.2 What PR#17f does and does not provision

- **PR#17f does not create dedicated workspace or site tables**, because no such tables exist in the approved migration set (`migrations/002_*.sql` through `migrations/016_*.sql`).
- **The operator must not `INSERT INTO <WORKSPACE_TABLE>` or `INSERT INTO <SITE_TABLE>`** as part of PR#17f execution. Doing so would invent surfaces the migration set has not approved, which is forbidden by §7 ("do not invent migrations", "do not modify `schema.sql`") and §25 stop-the-line.
- **Workspace and site identity is provisioned via the `site_write_tokens` identity-metadata path** (per §13). When the operator provisions a production token for a site (per Helen's final GO), the corresponding `workspace_id` and `site_id` values are written as columns on the `site_write_tokens` row for that token. This is how production identity becomes resolvable server-side.
- **If a later approved migration introduces dedicated workspace / site tables**, the operator handles those tables under that later migration's own runbook, not under PR#17f. The placeholder template below is gated explicitly on that condition.

### 12.3 Constraints

- **`buyerrecon.com` remains the first future canary site.** PR#17f may provision identity metadata for all five live sites to keep operator work coherent, but **provisioning identity metadata is not cutover** — no ThinLayer `endpointUrl` is changed by PR#17f for any site.
- **No staging workspace / site identity is reused.** Production `workspace_id` and `site_id` values are provisioned fresh and are distinct from staging.
- **`workspace_id` / `site_id` are resolved server-side.** The collector resolves them from the validated `site_write_token` (the row matched by `token_hash` lookup), not from any client-supplied identifier. The runbook does not introduce any client-supplied workspace_id surface.
- **Client-supplied `workspace_id` is not trusted.**
- **Mapping must be auditable.** The proof report records the production `workspace_id → site_id → hostname` mapping for each provisioned site at **metadata level** (presence, association, active/disabled status, safe timestamps / revocation fields). Categorical references are sufficient; raw values do not need to appear in the report.
- **No Track A labels in workspace / site IDs.** `workspace_id` and `site_id` values do not encode any QA/test/bot/synthetic/adversary marker.
- **No raw token material in the report.** The report describes the `site_write_tokens` identity row at metadata level only: per §13, no raw token, no token hash, no token prefix, no derived token material.

### 12.4 Default execution path — identity via `site_write_tokens` metadata

For the current `migrations/002_*.sql` through `migrations/016_*.sql` set, identity provisioning happens **as part of `site_write_tokens` provisioning in §13**, not as a separate workspace/site table operation. The operator:

1. selects production `workspace_id` and `site_id` text values (per Helen's final GO scope; values held in the operator vault, never pasted into repo/chat/PR),
2. generates each raw token locally and places it in the vault,
3. computes the server-side `token_hash` per the deployed token-hash strategy (HMAC-SHA256 of the raw token with the `SITE_WRITE_TOKEN_PEPPER`),
4. inserts the `site_write_tokens` row with the chosen `workspace_id`, `site_id`, and `token_hash` (plus `label`, `created_at`; `disabled_at` left NULL on active rows),
5. records categorical mapping outcomes in the proof report.

The actual `INSERT` template lives in §13 (`site_write_tokens` provisioning) and is gated **RUN ONLY AFTER MERGE + HELEN FINAL GO**.

### 12.5 Conditional template — only if dedicated workspace/site tables exist from an approved migration at execution time

The template below is **not** executed under the current `migrations/002_*.sql` through `migrations/016_*.sql` set. It is included only as a guarded placeholder for a hypothetical future state in which a later approved migration has introduced dedicated workspace and site tables.

```
-- CONDITIONAL: execute ONLY IF, at execution time, a later approved migration has
-- introduced dedicated workspace/site tables. Under migrations/002–016 as approved
-- at PR#17f authoring time, these tables do NOT exist and these inserts MUST NOT run.
-- Replace placeholders from the operator vault; no real values in repo/chat/PR.

-- INSERT INTO <WORKSPACE_TABLE> (<workspace_id_column>, <name_column>, <created_at_column>)
--        VALUES (<WORKSPACE_ID>, '<WORKSPACE_NAME>', now())
--        ON CONFLICT DO NOTHING;
--
-- INSERT INTO <SITE_TABLE> (<site_id_column>, <workspace_id_column>, <hostname_column>, <created_at_column>)
--        VALUES (<SITE_ID>, <WORKSPACE_ID>, 'buyerrecon.com', now())
--        ON CONFLICT DO NOTHING;
```

The template is commented out so it cannot be copy-pasted into a live shell by accident. If a future migration genuinely introduces these tables, that migration's own runbook PR approves and uncomments the equivalent steps; PR#17f itself does not.

The operator does **not** invent a workspace/site table that does not exist in the approved migration set.

---

## 13. `site_write_tokens` provisioning

Constraints (planning level enforced at execution):

- **Production tokens may be created only after merge + Helen final GO.**
- **Raw tokens are generated by the operator using the approved method.** The approved method does not write raw tokens to disk in any repo location; raw tokens land directly in the approved secret manager / operator vault.
- **Raw tokens are stored only in the approved secret manager / operator vault.** Per-site distribution is performed via that vault, not via repo/chat/PR.
- **The DB stores only the permitted server-side representation.** Per `migrations/006_site_write_tokens.sql`, the deployed schema's column set determines what is stored — typically a one-way hash and metadata (issued-at, label, workspace/site reference, revocation state). The exact stored columns are confirmed against the deployed schema at execution time.
- **PR, docs, logs, chat, terminal transcripts must not include raw token, token hash, token prefix, or any derived token material.** Even a partial prefix is forbidden.
- **The proof report may report only safe metadata:**
  - count of tokens created per site,
  - site association (workspace_id / site_id at categorical level),
  - active / disabled status,
  - created / disabled timestamps where these are not considered sensitive,
  - revocation field values where these are not considered sensitive.
- **Token validation outcome may be reported (PASS / FAIL).** Raw token material may not be reported. The proof report's validation outcome line is a categorical PASS/FAIL, not a token echo.
- **Token rotation and disablement path** must be verified as available before any future cutover. The operator confirms the schema's revocation/disablement column exists (per `006_site_write_tokens.sql`) and that a rotation procedure (issue new → roll over → revoke old) is documented in the operator vault, even if the rotation is not exercised during PR#17f execution.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**, against the exact column set defined by `migrations/006_site_write_tokens.sql` as currently deployed):

The deployed `site_write_tokens` schema (from `migrations/006_site_write_tokens.sql`) is:

- `token_id` — UUID primary key, defaulted server-side,
- `token_hash` — `TEXT NOT NULL UNIQUE`, computed by the operator's local tool as HMAC-SHA256(raw_token, `SITE_WRITE_TOKEN_PEPPER`); **raw token is never stored**,
- `workspace_id` — `TEXT NOT NULL`,
- `site_id` — `TEXT NOT NULL`,
- `label` — optional admin-friendly free-form description,
- `created_at` — `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `disabled_at` — `TIMESTAMPTZ`, NULL on active rows (soft-delete sentinel),
- `last_used_at` — `TIMESTAMPTZ`, written by the collector at runtime; **left at its default (NULL) at provisioning time**.

Note the deployed schema has **no `issued_at` column** and **no `active` boolean** — active/disabled state is inferred from `disabled_at IS NULL`. The runbook must therefore use `created_at` and `disabled_at`, **not** invented `issued_at` / `active` columns.

```
-- Insert one site_write_tokens row per site authorised by Helen's final GO.
-- The raw token NEVER enters this template; the operator's local tool generates
-- the raw token, places it in the approved operator vault, and computes the
-- server-side token_hash = HMAC-SHA256(raw_token, SITE_WRITE_TOKEN_PEPPER).
-- <TOKEN_HASH_FROM_OPERATOR_LOCAL_TOOL> is a PLACEHOLDER and must NEVER be
-- pasted into PR / chat / proof output / terminal transcripts destined for
-- repo or sharing. Replace placeholders from the operator vault at execution
-- time and mask any output before recording.
INSERT INTO site_write_tokens (
  token_hash,
  workspace_id,
  site_id,
  label,
  created_at,
  disabled_at
)
VALUES (
  <TOKEN_HASH_FROM_OPERATOR_LOCAL_TOOL>,
  <WORKSPACE_ID>,
  <SITE_ID>,
  <SAFE_LABEL>,
  now(),
  NULL
);
-- token_id is omitted from the column list so the server-side
-- gen_random_uuid() default is used. last_used_at is omitted so it
-- remains NULL until the collector writes it on first successful use.
-- Repeat per site (buyerrecon.com first canary; the four other live sites
-- only if Helen's final GO authorises) using a freshly generated raw token
-- per site, with its own server-side token_hash. No reuse across sites.
-- The raw token is delivered to ThinLayer config via the approved secret
-- distribution path, never via this runbook and never via repo/chat/PR.
```

Operator verification after insertion (categorical PASS/FAIL only; no token material in output):

- confirm one new row per authorised site,
- confirm each row's `workspace_id` and `site_id` match the authorised mapping (mapping recorded at metadata level in the proof report),
- confirm each row's `disabled_at IS NULL` (active state inferred from `disabled_at`, not from any `active` column),
- confirm `created_at` is recent,
- confirm `last_used_at` is NULL (collector has not yet validated the token, which is correct — PR#17f does not generate traffic).

The proof report **may** show only safe metadata derived from the deployed columns:

- count of rows per site,
- site association (`workspace_id` / `site_id` at categorical level),
- active/disabled status inferred from `disabled_at`,
- `created_at` / `disabled_at` timestamps where these are not considered sensitive,
- `label` text where it is itself safe.

The proof report **must not** include `token_hash` values, raw token values, token prefixes, derived token material, `SITE_WRITE_TOKEN_PEPPER`, `DATABASE_URL`, private IPs, or any other credential material. If any such material appears in any artefact destined for repo, chat, PR, or proof output, the operator stops, follows §20 incident path, and rotates per the vault's procedure.

---

## 14. Secret placement

Production secret categories (categories only — **no values for any category appear in this doc**):

- `DATABASE_URL` — production DB DSN.
- DB role credentials — passwords for the role families in §10.
- `SITE_WRITE_TOKEN_PEPPER` (or equivalent, if applicable to the chosen token hash mechanism).
- `IP_HASH_PEPPER` (if applicable to the IP-hashing path used by the collector or workers).
- Production `site_write_tokens` — per-site raw tokens (per §13), held in the vault.
- Logging / observability credentials (if applicable to any external log sink or metrics backend).
- Collector public base URL (if it is treated as sensitive at execution time; otherwise categorical).

Governing constraints:

- **No secrets in repo, chat, or PR.** No `.env` committed. No `.env.example` containing real values. No production secret pasted into terminal transcripts destined for chat / issue / PR.
- **Terminal output must mask secrets.** Tools that print DSNs (e.g. `psql` connection echo) are configured or piped to mask secret-bearing fragments before any output is recorded in a shareable artefact.
- **Proof report must mask secrets.** Categorical references only.
- **If a secret appears in any output destined for repo / chat / PR, stop** and follow §20 incident path: rotate the leaked secret per the vault's procedure, record the incident, and notify Helen before resuming.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Place production secrets into the approved deployment / operator secret store.
# The exact mechanism is whatever the deployment uses; the runbook does not
# pin a vault product or CLI here. Replace placeholders from the vault.
<VAULT_TOOL> set DATABASE_URL                "<MASKED_DATABASE_URL>"
<VAULT_TOOL> set MIGRATOR_PASSWORD           "<MIGRATOR_PASSWORD>"
<VAULT_TOOL> set COLLECTOR_PASSWORD          "<COLLECTOR_PASSWORD>"
<VAULT_TOOL> set FEATURE_PASSWORD            "<FEATURE_PASSWORD>"
<VAULT_TOOL> set INTERNAL_READONLY_PASSWORD  "<INTERNAL_READONLY_PASSWORD>"
<VAULT_TOOL> set SITE_WRITE_TOKEN_PEPPER     "<SITE_WRITE_TOKEN_PEPPER>"
# Per-site raw tokens are placed by the same approved mechanism, never via this runbook directly.
```

The operator confirms placement by retrieving and re-checking presence (existence only, not value) before proceeding.

---

## 15. Production / staging separation verification

After secret placement and migration, the operator runs the following separation checks. Each is categorical PASS/FAIL in the proof report.

- **DB name differs.** Production DB is not `buyerrecon_staging` and not the Render legacy DB.
- **DB host / isolation differs**, or isolation is explicitly documented and enforced.
- **Roles differ.** Production role names and passwords are distinct from staging.
- **Workspace / site IDs differ** for the same hostnames.
- **Tokens differ.** Staging `site_write_tokens` are not accepted in production.
- **Collector base URL differs.** Production collector hostname is not any staging collector hostname.
- **Logs identify production safely.** Log entries are tagged with environment in a way that cannot be confused with staging.
- **Staging token is rejected by production.** A staging-issued token, if attempted, fails validation against the production collector configuration.
- **Production token is rejected by staging.** Symmetric check.
- **Environment guard prevents staging DB in production.** The collector / migrator refuses to operate if its `DATABASE_URL` resolves to a staging DB while it is configured as production (or equivalent guard, finalised at execution time per the deployed code path).
- **Proof must not expose token material.** Outcomes are categorical PASS/FAIL only; no token, hash, or prefix is included.

---

## 16. Render legacy separation verification

- **Render legacy endpoint** (`https://buyerrecon-backend.onrender.com/collect`) **and Render legacy DB remain archive / fallback.**
- **PR#17f does not shut down Render.**
- **PR#17f does not migrate Render legacy historical data** into the Sprint 2 production DB.
- **PR#17f does not make the Render legacy DB the Sprint 2 canonical DB.**
- **An optional future adapter / report** for Render legacy data may be planned in a separate PR. PR#17f does not approve or scope such an adapter.

The proof report records a categorical confirmation that:

- the Render legacy host was not the target of any DB / role / token / secret operation in this execution,
- no data was lifted from Render legacy into the Sprint 2 production DB,
- the Render legacy endpoint remains reachable (a categorical reachability check is permitted; no live ThinLayer traffic is generated).

---

## 17. Verification phase

This phase is labelled:

> **RUN ONLY AFTER MERGE + HELEN FINAL GO.**

Verifications (each is categorical PASS/FAIL with masked output in the proof report):

- **Migration status verified.** The production DB is at the expected Sprint 2 canonical schema revision per §7 / §8; no drift.
- **Expected tables exist.** Including (using exact deployed names):
  - `ingest_requests` (from `003_ingest_requests.sql`),
  - `accepted_events` and its evidence columns (from `004_*.sql`),
  - `rejected_events` and its evidence columns (from `005_*.sql`),
  - `site_write_tokens` (from `006_*.sql`),
  - `accepted_events` dedup index (from `007_*.sql`),
  - `session_features` (from `008_*.sql`),
  - `session_behavioural_features_v0_2` (from `009_*.sql`),
  - refresh-loop derivation columns on `session_behavioural_features_v0_2` (from `010_*.sql`),
  - scoring output lanes surfaces (from `011_*.sql`),
  - Stage 0 decisions (from `012_*.sql`),
  - `risk_observations_v0_1` (from `013_*.sql`),
  - `poi_observations_v0_1` (from `014_*.sql`),
  - `poi_sequence_observations_v0_1` (from `015_*.sql`),
  - PR#17g Lane A/B grant-safety correction applied (from `016_scoring_output_lane_grant_safety.sql`) — no new tables; verifies via the grant checks below,
  - plus any additional approved migrations merged after PR#17g at execution time.
- **Schema version / migration records captured.** Categorical record of "all expected migrations applied, including 016".
- **Role memberships checked.** Production role families exist; staging roles are not present in the production DB.
- **Table privileges checked.** Each role family's grants match §11; no broader grants than required.
- **Lane A/B grant boundary verified (PR#17g).** Categorical PASS confirmation that:
  - `buyerrecon_scoring_worker` has **no** `SELECT`, `INSERT`, `UPDATE`, or `DELETE` on `scoring_output_lane_a` or `scoring_output_lane_b`,
  - `buyerrecon_customer_api` has **no** `SELECT` on `scoring_output_lane_a` or `scoring_output_lane_b`,
  - `buyerrecon_internal_readonly` has `SELECT` on both lane tables and **no** `INSERT`/`UPDATE`/`DELETE` on either,
  - `buyerrecon_migrator` retains `ALL` on both lane tables for future approved DDL.
  Migration 016's own post-migration assertions raise `EXCEPTION` if any of the above is wrong; this verification step re-confirms the post-migration state categorically and records PASS / FAIL in the proof report. **No durable Lane A/B writer may be granted under PR#17f / PR#17g.**
- **Workspace / site rows checked.** Each authorised site has a workspace_id / site_id row; mapping is auditable.
- **Token safe metadata checked.** Per §13: counts, site association at categorical level, active/disabled status, created/disabled timestamps where safe. **No raw token / hash / prefix exposed.**
- **Collector ledger tables available.** `ingest_requests`, `accepted_events`, `rejected_events` exist and are writable by the collector writer role and readable by the internal readonly role.
- **Exact versioned table names recorded.** Per §9 — proof uses the deployed names.
- **Forbidden-secret scan of proof output.** The proof report (and any captured logs) are scanned for raw secrets, raw tokens, token prefixes/hashes, DB URLs, private IPs, role passwords, and PII. If any is found, **stop** and follow §20.
- **Staging / production confusion check.** Per §15.
- **No customer-facing output surfaces enabled.** No customer-visible automated artefact is produced; no Lane B / Trust Core / AMS runtime bridge / Pass 1 / Pass 2 surface is exposed.

Command template (placeholders only; **RUN ONLY AFTER MERGE + HELEN FINAL GO**):

```
# Verification queries against the production DB. Replace placeholders from the vault.
# Mask any secret/host material before recording outcome.
psql "<MASKED_DATABASE_URL>" -c "
  select table_schema, table_name
    from information_schema.tables
   where table_schema = 'public'
   order by table_name;
"
psql "<MASKED_DATABASE_URL>" -c "
  select grantee, privilege_type, table_name
    from information_schema.role_table_grants
   where table_schema = 'public'
   order by grantee, table_name, privilege_type;
"
```

The operator records categorical outcomes only.

---

## 18. Optional controlled ledger smoke

PR#17f's chosen posture: **defer live / collector smoke to PR#17g or PR#17h**.

Reasoning:

- A live ledger smoke that exercises the collector against `ingest_requests` / `accepted_events` requires either:
  - generating real or simulated browser traffic (which is out of scope per §4 and per PR#17e), or
  - running the collector against synthetic ledger writes that mimic live traffic shape (which is closer to deployment proof and belongs in PR#17g / PR#17h).
- PR#17f's value is in **schema, roles, workspace/site, token metadata, and secret placement** — these can be verified entirely without live traffic.

Therefore, in PR#17f execution:

- **No browser traffic.**
- **No ThinLayer traffic.**
- **No Track A.**
- **No production website traffic.**
- **No collector cutover.**
- Verification queries are **DB-only** and **read-only** (information_schema, role grants, presence/absence of expected tables, token metadata).
- Any ledger smoke that simulates live traffic — even synthetically — is **deferred to PR#17g or PR#17h** under its own explicit approval.

If, at execution time, Helen wishes to include a narrow DB-only controlled smoke (e.g. a single hand-crafted insert into `ingest_requests` followed by an immediate categorical read), that must be authorised by an updated final-GO message that names the smoke explicitly. The default posture of PR#17f remains "no ledger smoke, defer to PR#17g / PR#17h".

---

## 19. Rollback / revocation plan

If any failure, anomaly, or §25 stop-the-line condition fires during execution, the operator follows the relevant rollback / revocation path below. **No destructive rollback of the evidence ledger is performed without explicit Helen approval.**

- **Failed migration stop procedure.** Stop applying further migrations immediately. Record the failed migration filename, masked failure message, and observed DB state. Do not partially continue. Do not edit the migration. Open a follow-up decision item.
- **Role revocation.** A role whose grants turn out to be broader than §11 intends is `REVOKE`-d down to least privilege immediately. A role that was created in error is `DROP`-ped only after confirming it has no dependencies on other production objects; if dependencies exist, the role is locked (`ALTER ROLE … NOLOGIN`) and a follow-up cleanup PR is opened.
- **Token disablement.** A token whose distribution is suspected of being compromised is marked disabled per the deployed `site_write_tokens` revocation field (per `006_site_write_tokens.sql`). The operator confirms at the collector layer that the disabled token no longer validates.
- **Secret rollback / rotation.** A leaked secret is rotated per the vault's procedure; the old value is invalidated; the new value is placed in the vault; the operator confirms the production service references the new value before considering the rotation complete.
- **DB access lockdown.** If the operator is uncertain about the integrity of access, the migrator role is locked (`NOLOGIN`) and any production-facing role suspected of compromise is locked similarly; production capture continues via the Render legacy collector and Render legacy DB while the situation is reviewed.
- **Evidence ledger preservation.** `ingest_requests`, `accepted_events`, `rejected_events`, feature/observation surfaces are **not** truncated or dropped during rollback. The ledger remains intact for forensics.
- **Render legacy fallback unaffected.** Any Sprint 2 production rollback / revocation does not touch the Render legacy collector or DB.
- **Evidence gap report.** If partial execution occurred, the operator produces an evidence gap report covering which steps completed, which did not, and what (if anything) needs further attention; the report is included in the §21 proof closure.

---

## 20. Incident path

The following are incidents — on any occurrence, the operator stops, preserves evidence, notifies Helen, does not continue, records the incident, and rotates / revokes if needed.

- **Real secret / token / token hash leaked** into repo, chat, PR, terminal transcript, or any externally-visible artefact.
- **Wrong DB targeted** — e.g. a verification ran against staging while labelled production.
- **Staging DB targeted** during a step that should have been against production (or vice versa).
- **Render legacy DB targeted** during a step that should have been against the Sprint 2 production DB.
- **Migration failed** (see §19 failed-migration stop procedure).
- **Role grant too broad** — a grant turns out to exceed §11.
- **Token material exposed** anywhere (raw token, hash, prefix).
- **Track A label appears** in any production DB row, log, observability surface, or proof artefact.
- **Customer-facing output enabled** — any customer-visible automated artefact is produced.
- **Operator uncertainty** — the operator is not confident the runbook is proceeding sanely.

Standard response per incident: **stop, preserve evidence, notify Helen, do not continue, record the incident, rotate or revoke if needed.** The operator does not "ride it out" or "try once more".

---

## 21. Proof report format

The execution operator produces a proof closure report with the following fields. Categorical values only; **no raw secrets, no raw tokens, no token hashes/prefixes, no DB URLs, no private IPs, no PII, no raw event payloads.**

- **Execution approval reference** — the merged PR (`PR#17f`), Helen's recorded final-GO message (timestamp and location of the message; no quoting of any sensitive content).
- **Operator** — identifier of the human who executed the runbook.
- **Start / end time.**
- **Target DB category (masked)** — e.g. "Sprint 2 production Postgres (placeholder name `buyerrecon_production`)" — no DSN, no host, no port, no user.
- **Migration before / after status** — list of expected migrations and categorical PASS for each; failure recorded per §7.
- **Exact deployed table names** — including `session_behavioural_features_v0_2`, `risk_observations_v0_1`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`, and any additional approved migrations merged after PR#17f at execution time.
- **Role families created / confirmed** — categorical names of role families (per §10), no role passwords.
- **Grant summary** — categorical confirmation per §11 boundaries; no listing of grants that would expose role identities tied to credentials.
- **Workspace / site mapping summary** — counts and categorical confirmation that all authorised sites have rows; mapping at metadata level.
- **Token metadata summary only** — counts per site, active/disabled status, created/disabled timestamps where safe; **no raw token / hash / prefix**.
- **Secret placement confirmation with no values** — categorical PASS for each §14 category.
- **Production / staging separation result** — PASS / FAIL per §15 check.
- **Render legacy separation result** — PASS / FAIL per §16.
- **Verification checks pass / fail** — per §17.
- **Anomalies** — any non-PASS observation, with categorical description (no raw secret content).
- **Rollback / revocation readiness** — confirmation that §19 paths are available and pre-staged.
- **No customer-facing output confirmation** — categorical PASS that no customer-visible automated artefact was produced.
- **Next recommended PR** — see §27.

The report is committed in a closure PR or recorded in a runbook log entry per Helen's direction. The closure PR / log entry references PR#17f.

---

## 22. Output-gate restrictions

- **PR#17f does not create customer-facing output.**
- **PR#17f does not approve customer-facing automated scores.**
- **No durable Lane A/B writers** are introduced; Lane A/B remains a read-only preview.
- **No Lane B exposure.** Lane B internal hypotheses stay internal.
- **No AMS Trust Core output** exposure through BuyerRecon.
- **No AMS runtime bridge.** PR#14 ProductFeatures bridge candidate remains record-only.
- **No Pass 1 / Pass 2 implementation.**
- **Evidence Snapshot and Lane A/B preview remain internal-only.**

---

## 23. Relationship to PR#17d and PR#17e

- **PR#17d** is the future `buyerrecon.com` canary endpoint cutover runbook (planning). It defines how live ThinLayer traffic for `buyerrecon.com` is later moved from the Render legacy collector to the Sprint 2 production collector.
- **PR#17e** is the future Track A unlabelled `B_analytics_only` proof plan (planning). It defines how a single narrow proof run is later executed against the Sprint 2 staging collector first, then optionally against the `buyerrecon.com` canary collector under separately approved gates.
- **PR#17f prepares the production data plane** that PR#17d's and PR#17e's later execution PRs depend on: the Sprint 2 production DB, the canonical schema, the role families, the workspace/site rows, the `site_write_tokens`, and the placed secrets.
- **PR#17f does not execute PR#17d.** No ThinLayer `endpointUrl` is cut.
- **PR#17f does not execute PR#17e.** No Track A run is performed.
- **PR#17f does not cut endpoint or run Track A.**

PR#17d and PR#17e remain governed by their own future execution PRs.

---

## 24. Success criteria

After execution (gate 5), PR#17f is considered successful if **all** of the following hold:

- The **production DB exists** and is demonstrably separate from `buyerrecon_staging` and from the Render legacy DB.
- The **existing migrations** (`migrations/002_*.sql` through `migrations/016_*.sql`, plus any additional approved migrations merged after PR#17f at execution time) have been **applied successfully and in numeric order**.
- The **exact deployed table names** are verified in the production DB (per §9 and §17).
- **Roles** are created / confirmed with **least-privilege** grants per §10 and §11.
- **Grants** are verified per §11; no broader grants than required.
- **Workspace / site identities** exist for each site authorised by Helen's final GO (defaulting to all five live sites).
- **`site_write_tokens`** are provisioned safely; raw token material lives only in the vault.
- **Secrets** are placed outside repo / chat / PR.
- **No secrets are exposed** in any artefact captured by the runbook.
- **Production / staging separation** is verified per §15.
- **Render fallback** remains unaffected per §16.
- **No customer-facing output** is enabled.
- **Proof report** is created per §21 and references PR#17f.

If any item above is not satisfied, PR#17f's execution is not a success; the operator either follows §19 / §20 or escalates per Helen's direction.

---

## 25. Stop-the-line conditions

Stop and re-plan if any of the following appears at any point during authoring, review, or execution of PR#17f:

- **Helen final GO is missing or ambiguous** (the recorded GO message does not match the §2 expected wording or unambiguous equivalent),
- **Real secrets, tokens, token hashes, token prefixes, DB URLs, role passwords, peppers, private IPs, or credential-bearing env values** appear in docs / chat / terminal transcripts / PR comments,
- **The target DB cannot be proven production and separate from staging** at execution time,
- **The Render legacy DB is targeted** by any step,
- **Migration order is unclear** (e.g. the deployed `migrations/` directory has gaps or non-numeric ordering that the operator cannot resolve against the §7 ordering rule),
- **A migration fails** during application,
- **Schema drift is unexplained** before or after migration application,
- **A role grant is broader than planned** in §11,
- **Token material is exposed** in any artefact destined for repo / chat / PR / shared terminal,
- **A staging token works in production**, or a **production token works in staging**,
- **Workspace / site mapping is ambiguous** at execution time,
- **Track A labels appear** in any production DB row, log, observability surface, proof artefact, token metadata, or workspace/site row,
- **Customer-facing output is enabled** (or its approval is requested) during PR#17f's execution,
- **Operator uncertainty exists** about whether the runbook is proceeding sanely.

Stop-the-line means: do not continue, follow §19 / §20, and request a follow-up decision from Helen before any further action.

---

## 26. What PR#17f explicitly does not approve

PR#17f explicitly does **not** approve any of the following:

- execution of any runbook step **before** gates 1–4 in §2 are satisfied (draft PR created → Codex review PASS → merged → Helen final GO recorded),
- ThinLayer `endpointUrl` cutover on any live site,
- any DNS change,
- production collector **traffic** cutover (env / secrets placement is permitted *only* as preparation, never as service cutover),
- Track A execution,
- Playwright execution,
- enabling any customer-facing automated output,
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output,
- implementation of Pass 1 or Pass 2 governance,
- Render shutdown,
- migration of Render legacy historical data into the Sprint 2 production DB,
- all-site ThinLayer cutover (cutting more than `buyerrecon.com`, or cutting `buyerrecon.com` together with others, is reserved for later approved cutover PRs).

These remain for explicitly-scoped successor PRs.

---

## 27. Recommended next PRs

PR#17f recommends the following successor PRs, each tightly scoped:

- **PR#17f-proof (or PR#17g) — Proof closure** after operator execution. Records the §21 proof report and any anomalies.
- **PR#17g or PR#17h — Actual Sprint 2 production collector deployment / operator proof** (if not covered by PR#17f's secret-placement preparation). Deploys the Sprint 2 collector service against the production data plane prepared by PR#17f, without taking live ThinLayer traffic yet.
- **PR#17h or later — `buyerrecon.com` canary endpoint cutover execution** following PR#17d's runbook, only if Helen explicitly approves with the corresponding final-GO message.
- **PR#17i or later — Track A `B_analytics_only` execution proof** following PR#17e's plan, only if Helen explicitly approves with the corresponding final-GO message. Order vs. canary cutover decided in that PR.
- **Later — Low-dwell / refresh-loop / adversarial CTA Track A plans**, only after `B_analytics_only` proof passes and is reviewed.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 28. Acceptance criteria

PR#17f is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17f-production-migration-operator-runbook.md`,
- the document's **execution-approved status is clearly stated as "after merge + Helen final GO only"** (§1, §2),
- **no execution occurs during PR creation** — no DB connection, no role / token / secret creation or rotation, no migration run, no deploy, no DNS change, no `endpointUrl` change, no Render / Hetzner / AMS / Track A touch, no traffic generation, no Playwright,
- **no code / schema / runtime changes** — no edits under `src/`, `scripts/`, `migrations/`, `package.json`, tests, or any non-`docs/` file,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no token prefixes, no role passwords, no peppers, no private IPs, no certificate material,
- **production / staging separation is explicit** (§6, §10, §11, §15),
- **Render legacy separation is explicit** (§6, §16),
- **migration order / proof posture is included** (§7, §8, §17), referencing the existing `migrations/002_*.sql` through `migrations/016_*.sql` set without inventing or editing migrations,
- **role / grant posture is included** (§10, §11), with worker grants split by ownership and no durable Lane A/B writers,
- **site / token provisioning posture is included** (§12, §13), with no raw token material in the doc,
- **exact table naming discipline is included** (§9), naming `session_behavioural_features_v0_2` and the `_v0_1` observation tables,
- **rollback / revocation is included** (§19, §20),
- **proof report format is included** (§21),
- **output-gate restrictions are included** (§22),
- **no endpoint cutover or Track A execution is approved** (§4, §23, §26).

---

End of PR#17f runbook authoring. **Authoring is docs-only. Execution is gated on merge + Helen final GO.**
