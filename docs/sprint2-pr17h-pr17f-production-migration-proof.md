# BuyerRecon Sprint 2 PR#17h — PR#17f Production Migration / Operator Proof

Status: **docs-only proof closure**. No implementation. No DB access. No production commands. No secrets. No deployment. No cutover. No traffic.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `7b151d2` — PR#17g merged, "correct Lane A/B grant safety").

PR branch: `buyerrecon-sprint2-pr17h-record-pr17f-production-migration-proof`

---

## 1. Purpose

PR#17h records the **proof closure** for the PR#17f production migration / operator execution. It documents what was executed, what was verified, and what remains explicitly **not** done.

PR#17h itself is **docs-only**:

- PR#17h does not execute anything.
- PR#17h does not connect to any DB, host, or external system.
- PR#17h records proof from the already-executed PR#17f approved scope (gates 1–5 of PR#17f §2 satisfied; this PR is the §2 gate 6 closure artefact).
- PR#17h contains **no secrets, no raw token values, no token hashes, no token prefixes, no vault contents, no `DATABASE_URL`, no role passwords, no peppers, no private IPs, and no credentials of any kind**.

Anything in PR#17h that looks like a fact about production state is **a categorical recording** of what was observed at execution time, with sensitive values omitted or masked.

---

## 2. Approval boundary

PR#17f execution was authorised by Helen / user with the following verbatim final-GO message:

> "I approve executing PR#17f operator runbook now. Scope: production Sprint 2 DB / migrations / roles / tokens / verification only. No ThinLayer cutover. No Track A. No customer-facing output."

### Approved scope

- production Sprint 2 DB,
- migrations,
- roles,
- tokens,
- verification.

### Explicitly **not** approved

- ThinLayer `endpointUrl` cutover on any live site,
- any DNS change,
- Track A execution,
- Playwright execution,
- production traffic generation,
- customer-facing automated output,
- Render shutdown or modification,
- Render legacy data migration,
- all-site cutover,
- AMS runtime bridge,
- AMS Trust Core exposure,
- Pass 1 / Pass 2 implementation.

PR#17h's proof closure stays inside the approved scope and does not retroactively widen it.

---

## 3. Repository state

- **Execution base after PR#17g merge:** `sprint2-architecture-contracts-d4cc2bf` at `7b151d2`.
- **PR#17f merge commit:** `21ea5f2` ("Sprint 2 PR#17f: add production migration operator runbook (#11)").
- **PR#17g merge commit:** `7b151d2` ("Sprint 2 PR#17g: correct Lane A/B grant safety (#12)").
- **Migration set present at execution time (after PR#17g merge):** `migrations/002_*.sql` through `migrations/016_*.sql` (15 files in numeric order).
- **Migration 016 present:** `migrations/016_scoring_output_lane_grant_safety.sql`.
- **Local static check passed at execution time:** `npm run check:scoring-contracts` → `Scoring contracts check PASS` (the check is declared by its own header as "No DB. No HTTP. No production-specific behaviour.").

No production secrets, no env values, and no `DATABASE_URL` appear in this section.

---

## 4. Stop-the-line event before execution

A stop-the-line event was triggered before any production DB action was taken:

- PR#17f execution preparation entered Phase 2 (local manifest review).
- The local manifest showed that `migrations/011_scoring_output_lanes.sql` grants `SELECT, INSERT, UPDATE` on `scoring_output_lane_a` and `scoring_output_lane_b` to `buyerrecon_scoring_worker`.
- That grant constitutes a **durable Lane A/B writer privilege**, which directly conflicts with PR#17f's "no durable Lane A/B writers" boundary (PR#17f §11 grant boundary plan; §22 output-gate restrictions).
- PR#17f execution was **paused before any production DB action**.
- **No production DB had been touched at the time of the stop.** No connection had been opened to a production target. No DDL, no DML, no role / token / secret operation had been performed against production.
- PR#17g was created to fix the conflict before production execution continued.

This proof records: no production state existed at the time of the stop that needed unwinding; the stop was preventive.

---

## 5. PR#17g correction summary

PR#17g closed the stop-the-line gap and was merged at `7b151d2`. PR#17g's effects:

- **Added `migrations/016_scoring_output_lane_grant_safety.sql`** — a grants-only migration that:
  - revokes all access from `buyerrecon_scoring_worker` on `scoring_output_lane_a` and `scoring_output_lane_b`, removing the unapproved durable Lane A/B writer privilege,
  - preserves `buyerrecon_migrator` `ALL` on both lane tables for future approved DDL (idempotent re-grant),
  - preserves `buyerrecon_internal_readonly` `SELECT` on both lane tables for internal verification / preview only (idempotent re-grant),
  - re-affirms `REVOKE ALL` for `buyerrecon_customer_api` on both lane tables as defence-in-depth,
  - includes post-migration `has_table_privilege` assertions that fail the migration on any policy violation.
- **Updated the PR#17f runbook** so the production migration set is `002–016` (entry 15 added in §7; success/acceptance/verification sections updated to reference 016).
- Established that **durable Lane A/B writers remain deferred** to a later explicitly approved output-gate PR (not PR#17g, not PR#17f).

PR#17g made the production migration phase safe to resume within PR#17f's approved scope.

---

## 6. Production DB creation proof

After PR#17g merge and base sync, the production DB was created within the PR#17f approved scope. Categorical observations only — no host, port, `DATABASE_URL`, password, or private IP appears below.

- **Production DB created:** `buyerrecon_production`.
- **Owner:** `postgres`.
- **`buyerrecon_app` `CONNECT` on `buyerrecon_production`:** false (after lockdown).
- **`PUBLIC` `CONNECT` on `buyerrecon_production`:** false (after lockdown).
- **Initial state:** `buyerrecon_production` had **zero public tables** before baseline.
- **Extensions present after baseline:** `pgcrypto`, `plpgsql`.

The production DB host, port, connection string, role passwords, and any private IPs are **not** recorded here; they live only in the approved operator vault.

---

## 7. Baseline schema decision

At execution time, an order-of-operations gap was observed in the existing migration set:

- `migrations/002_event_contract_v2.sql` and `migrations/004_accepted_events_evidence_columns.sql` depend on `accepted_events` already existing.
- `migrations/005_rejected_events_evidence_columns.sql` depends on `rejected_events` already existing.
- `buyerrecon_production` was initially empty (zero public tables).
- The repo contains **no `schema.sql` at the repo root**.
- Two schema files exist under the source/dist tree:
  - `src/db/schema.sql`
  - `dist/db/schema.sql`
- **`src/db/schema.sql` and `dist/db/schema.sql` differed:**
  - `src/db/schema.sql`: 903 lines, current consolidated schema, including (in addition to ledger tables) `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features`, `session_behavioural_features_v0_2`, `scoring_output_lane_a`, `scoring_output_lane_b`, `stage0_decisions`, `risk_observations_v0_1`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`.
  - `dist/db/schema.sql`: 312 lines, **stale** — it only reached `site_write_tokens` and lacked later Sprint 2 tables.

### Decision recorded

- A disposable dry-run proved that `src/db/schema.sql` baseline followed by `migrations/002_*.sql` through `migrations/016_*.sql` produces the expected canonical schema state (see §8).
- **Helen / user explicitly approved using `src/db/schema.sql` as the production baseline** before applying migrations `002–016`.
- `dist/db/schema.sql` was **not used** for the production baseline.

### Follow-up

- `dist/db/schema.sql` appears stale relative to `src/db/schema.sql` and should be **regenerated, removed, or documented** in a future repo-hygiene PR.
- **PR#17h does not modify `dist/db/schema.sql`.** (Carried forward as item 1 in §18.)

---

## 8. Disposable dry-run proof

Before any production action, a disposable dry-run was performed:

- A disposable dry-run DB was created.
- `src/db/schema.sql` baseline was applied successfully against the dry-run DB.
- Migrations `002–016` were applied successfully against the dry-run DB.
- Migrations were **accidentally run twice** in the dry-run and remained **idempotent** — the second pass produced expected "already exists, skipping" notices and no error.
- The dry-run produced **19 public tables** in the dry-run DB.
- Dry-run Lane A/B grant safety passed:
  - `buyerrecon_scoring_worker` had **no** `SELECT` / `INSERT` / `UPDATE` on `scoring_output_lane_a` or `scoring_output_lane_b`.
  - `buyerrecon_internal_readonly` had `SELECT` on both lane tables.
  - `buyerrecon_customer_api` had **no** `SELECT` on either lane table.
- The disposable dry-run DB was **removed** after proof.

No secrets, no `DATABASE_URL`, and no token material were captured by the dry-run output.

---

## 9. Production baseline proof

After dry-run success and Helen's explicit baseline approval, the production baseline was applied:

- **Target DB confirmed before baseline:**
  - `current_database()` = `buyerrecon_production`,
  - `current_user` = `postgres`.
- `buyerrecon_production` had **zero public tables** before baseline.
- `src/db/schema.sql` baseline was applied successfully.
- **After baseline:**
  - **19 public tables present.**
  - Extensions present: `pgcrypto`, `plpgsql`.

### The 19 production public tables after baseline

- `accepted_events`
- `ingest_requests`
- `poi_observations_v0_1`
- `poi_sequence_observations_v0_1`
- `probe_captures`
- `probe_decisions`
- `rejected_events`
- `replay_evidence_cards`
- `replay_runs`
- `risk_observations_v0_1`
- `scoring_output_lane_a`
- `scoring_output_lane_b`
- `session_behavioural_features_v0_2`
- `session_features`
- `site_configs`
- `site_write_tokens`
- `stage0_decisions`
- `trust_state`
- `truth_metrics`

---

## 10. Production migration proof

After successful baseline, migrations `002–016` were applied to `buyerrecon_production`:

- Migrations `002_*.sql` through `016_*.sql` applied **successfully** to `buyerrecon_production`, in numeric order, after baseline.
- **The migration phase was considered complete only after** `migrations/016_scoring_output_lane_grant_safety.sql` had been applied — per PR#17f §7 as updated by PR#17g.
- Production table inventory **remained 19 tables** after migrations (no new tables introduced by the migration pass beyond what the baseline already produced).
- **No event data was inserted by migrations.** Migrations are schema and grants only.
- **No production traffic was generated.**

Migration output included expected **"already exists, skipping"** notices for tables that the consolidated `src/db/schema.sql` baseline had created before migrations were applied. These notices are **expected and non-blocking** under the baseline-then-migrations strategy — they confirm the migration files are idempotent against a baseline that already contains the consolidated schema.

---

## 11. Lane A/B grant safety proof

Final production proof of the PR#17g safety correction, observed against `buyerrecon_production`:

- `buyerrecon_scoring_worker` had **no** `SELECT` / `INSERT` / `UPDATE` / `DELETE` on `scoring_output_lane_a`.
- `buyerrecon_scoring_worker` had **no** `SELECT` / `INSERT` / `UPDATE` / `DELETE` on `scoring_output_lane_b`.
- `buyerrecon_internal_readonly` had `SELECT` on both lane tables.
- `buyerrecon_internal_readonly` had **no** `INSERT` on either lane table.
- `buyerrecon_customer_api` had **no** `SELECT` on either lane table.
- `scoring_output_lane_a` row count: **0**.
- `scoring_output_lane_b` row count: **0**.

State carried forward:

- **Durable Lane A/B writers were not introduced** by PR#17f execution or by PR#17g.
- **Lane A/B remains internal / read-only preview only.**
- **Any future Lane A/B writer requires a later explicitly approved output-gate PR** (Pass 1 / Trust / Pass 2 sequence, per PR#17a §6.5 / §8 / §9).

---

## 12. Production / staging separation proof

Observed at execution time against the production and staging targets, recorded categorically (no `DATABASE_URL`, no host, no password):

- `buyerrecon_app` can `CONNECT` to `buyerrecon_staging`: **true**.
- `buyerrecon_app` can `CONNECT` to `buyerrecon_production`: **false**.
- `buyerrecon_prod_collector_app` can `CONNECT` to `buyerrecon_production`: **true**.
- `buyerrecon_prod_collector_app` can `CONNECT` to `buyerrecon_staging`: **false**.
- `PUBLIC` `CONNECT` on `buyerrecon_staging`: **false** (after fix).
- `PUBLIC` `CONNECT` on `buyerrecon_production`: **false**.

### Staging ACL fix

- `buyerrecon_staging` initially allowed `PUBLIC` `CONNECT`.
- This was fixed by **revoking `PUBLIC` `CONNECT` on `buyerrecon_staging`** while preserving `buyerrecon_app` staging access.
- **No data was changed** by this ACL fix — it is a privilege change only.

The staging/production cross-connection matrix above confirms that the production collector role cannot reach staging and the staging application role cannot reach production, satisfying PR#17f §11 / §15 production/staging separation requirements.

---

## 13. Production collector role proof

A new production collector login role was created during PR#17f execution:

- **Role:** `buyerrecon_prod_collector_app`.
- `rolcanlogin`: **true**.
- `rolinherit`: **true**.
- `rolsuper`: **false**.
- `rolcreatedb`: **false**.
- `rolcreaterole`: **false**.
- **No production-specific roles existed before this** — `buyerrecon_prod_collector_app` is the first.
- `buyerrecon_prod_collector_app` has **no role memberships** (it does not inherit from any group role).

### Production table privilege posture for `buyerrecon_prod_collector_app`

- `accepted_events`: `INSERT` **true**, `SELECT` false, `UPDATE` false, `DELETE` false.
- `rejected_events`: `INSERT` **true**, `SELECT` false, `UPDATE` false, `DELETE` false.
- `ingest_requests`: `INSERT` **true**, `UPDATE` **true**, `SELECT` false, `DELETE` false.
- `site_write_tokens`: `SELECT` **true**, `UPDATE` **true**, `INSERT` false, `DELETE` false.
- `scoring_output_lane_a`: all **false**.
- `scoring_output_lane_b`: all **false**.

### Secret handling

- Password was set **interactively** by the operator.
- **Password value is not recorded** in this proof, in the runbook, in the repo, in chat, or in any artefact destined for sharing.
- **`DATABASE_URL` is not recorded** in this proof.

The role's grant posture confirms: write-only on the ledger surfaces it needs (`accepted_events`, `rejected_events`, `ingest_requests`), `SELECT` on `site_write_tokens` for token validation plus `UPDATE` for `last_used_at` writes, and **zero access** to `scoring_output_lane_a` / `scoring_output_lane_b` — consistent with PR#17f §11 / §22 and PR#17g.

---

## 14. Site write token proof

### Approved mapping

- **`workspace_id`:** `keigen_prod_ws`.
- **`site_id` values:**
  - `buyerrecon_com`
  - `realbuyergrowth_com`
  - `timetopoint_com`
  - `fidcern_com`
  - `keigen_co_uk`

### Provisioning

- `SITE_WRITE_TOKEN_PEPPER` was **present** in the production env; only its **length** was shown (no value, no prefix).
- Existing `site_write_tokens` rows before provisioning: **0**.
- **5 production `site_write_tokens` were inserted**, one per `site_id`.
- **Raw tokens were written to a root-only local vault file.**
- **Raw tokens were not printed** at the terminal or in any captured artefact.
- **Token hashes were not printed.**
- **No token prefixes were printed.**
- Proof output included **safe metadata only**.

### Safe metadata observed

- **5 token rows.**
- **5 distinct token hashes** (no collisions).
- Token hash length min / max = **64** (consistent with hex-encoded SHA-256).
- All hashes appeared as SHA-256 hex (length and character set check only; the values themselves are not recorded).
- All tokens **active** (`disabled_at IS NULL`).
- All `last_used_at` **NULL** (the production collector has not yet validated any token; consistent with the "no production traffic" boundary, see §15).
- All site rows mapped to `workspace_id = keigen_prod_ws`.
- **Labels (admin-friendly only):**
  - `prod:buyerrecon_com:pr17f`
  - `prod:fidcern_com:pr17f`
  - `prod:keigen_co_uk:pr17f`
  - `prod:realbuyergrowth_com:pr17f`
  - `prod:timetopoint_com:pr17f`

### Vault file posture

- File is **root-owned**.
- File mode is **600** (read/write by owner only; no group or other access).
- **Contents are not printed in this proof.**
- The file path is described categorically as a **root-only local vault copy**; no absolute path or directory hierarchy is recorded here.

The raw token material lives only in the approved operator vault; this proof carries only safe metadata.

---

## 15. Zero-traffic proof

Final production row counts after PR#17f execution within the approved scope:

- `accepted_events`: **0**.
- `rejected_events`: **0**.
- `ingest_requests`: **0**.
- `scoring_output_lane_a`: **0**.
- `scoring_output_lane_b`: **0**.
- `site_write_tokens`: **5** (per §14).

State explicitly:

- **No ThinLayer cutover occurred.** No live site's `endpointUrl` was changed.
- **No Track A ran.** The Track A repo was not touched; no Track A scenario was executed in any environment.
- **No Playwright ran.**
- **No production traffic was generated.**
- **No customer-facing output was enabled.**

The zero-row state on the ledger and lane tables, combined with the all-NULL `last_used_at` on `site_write_tokens`, is consistent with: production DB / migration / role / token / verification work was performed within the PR#17f approved scope; no traffic-shaped activity was performed.

---

## 16. Secrets and redaction proof

This proof document contains:

- **No raw token values.**
- **No token hashes.**
- **No token prefixes.**
- **No `DATABASE_URL`.**
- **No role passwords.**
- **No `SITE_WRITE_TOKEN_PEPPER` value** (only its presence and length were observed at execution time; not recorded here).
- **No `IP_HASH_PEPPER` value.**
- **No private IPs.**
- **No vault file contents.**
- **No `.env` values.**
- **No host / port / DSN material.**

Future sharing of the vault file contents is **prohibited** outside the approved secret manager / operator vault process. The vault file remains root-only, mode 600, on the operator-controlled machine.

---

## 17. What was not done

- **No ThinLayer `endpointUrl` cutover** on any live site (`buyerrecon.com` included).
- **No DNS change** (no `collector.buyerrecon.com` record creation or modification).
- **No production collector service deployment** (env / secrets placement happened only insofar as PR#17f §14 secret-placement preparation requires; no service was taken to live ThinLayer traffic).
- **No production traffic generation.**
- **No Track A execution** in any environment.
- **No Playwright execution.**
- **No Render shutdown.** Render legacy collector and Render legacy Postgres remain live and untouched as archive / fallback.
- **No Render legacy data migration.** No row was lifted from Render legacy to `buyerrecon_production`.
- **No customer-facing automated output.**
- **No durable Lane A/B writer** (PR#17g safety correction in place; §11 of this proof confirms).
- **No AMS runtime bridge.**
- **No AMS Trust Core exposure** through BuyerRecon.
- **No Pass 1 / Pass 2 implementation.**
- **No all-site cutover** (no site was cut; `buyerrecon.com` canary cutover remains future, governed by PR#17d's runbook under a future explicit GO).

---

## 18. Known follow-ups

1. **`dist/db/schema.sql` appears stale** relative to `src/db/schema.sql` (312 lines vs 903 lines; `dist` lacks later Sprint 2 tables). A future repo-hygiene PR should regenerate, remove, or document the `dist` schema policy.
2. **Future PR for the actual production collector deployment / operator proof.** The production collector role (`buyerrecon_prod_collector_app`) and DB exist; the service that uses them in production has not been deployed under live ThinLayer traffic. A future PR scopes that deployment with its own approval gate.
3. **Future PR for `buyerrecon.com` canary endpoint cutover execution** following PR#17d's runbook — only if Helen explicitly approves with the corresponding final-GO message.
4. **Future PR for Track A `B_analytics_only` execution proof** following PR#17e's plan — only if Helen explicitly approves with the corresponding final-GO message.
5. **Future output-gate planning before any customer-facing automated output:**
   - Pass 1 eligibility planning,
   - Trust Core bridge planning,
   - Pass 2 customer-safe projection planning.
6. **Future low-dwell / refresh-loop / adversarial CTA Track A plans** — only after the first `B_analytics_only` proof passes and is reviewed.

---

## 19. Final status

**PR#17f execution within the approved scope is complete.**

### Completed (within PR#17f approved scope)

- **Production DB created** (`buyerrecon_production`, owner `postgres`, `PUBLIC CONNECT` revoked, `buyerrecon_app CONNECT` revoked).
- **Baseline schema applied** (`src/db/schema.sql` per Helen's explicit approval; dry-run proofed first).
- **Migrations 002–016 applied** in numeric order (PR#17g's `016_scoring_output_lane_grant_safety.sql` included before considering the migration phase complete).
- **Production collector login role created** (`buyerrecon_prod_collector_app`, non-superuser, no role memberships, write-only on ledger ingestion surfaces, no access to scoring lanes).
- **Production / staging DB separation verified** (cross-connection matrix; `PUBLIC CONNECT` revoked on both DBs; staging ACL fix applied without data change).
- **`site_write_tokens` provisioned** for the 5 live sites under `workspace_id = keigen_prod_ws` with safe metadata observed; raw tokens in root-only mode-600 vault.
- **Metadata-only verification passed** across role grants, table privileges, Lane A/B grant boundary, and token metadata.
- **Lane A/B writer grant blocker closed** (PR#17g's migration 016 produced the expected post-migration grant state on production).

### Not completed / not approved by PR#17f execution

- **Cutover** (no ThinLayer `endpointUrl` change on any live site).
- **Deployment** (no production collector service brought up to take live traffic).
- **Traffic** (zero rows across `ingest_requests` / `accepted_events` / `rejected_events` / `scoring_output_lane_a` / `scoring_output_lane_b`; all `site_write_tokens.last_used_at` NULL).
- **Track A** (no scenario executed in any environment).
- **Customer-facing output** (Pass 1 / Trust / Pass 2 remain unimplemented and future-gated).

---

## 20. Acceptance criteria

PR#17h is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17h-pr17f-production-migration-proof.md`,
- the document is **proof closure only** (no plan, no runbook authoring beyond what PR#17f / PR#17g already merged),
- **no commands are executed by PR#17h authoring** — no DB access, no production action, no Render / Hetzner / AMS / Track A touch, no Playwright, no traffic,
- **no DB access by PR#17h authoring,**
- **no secrets** appear in the doc — no raw tokens, no token hashes, no token prefixes, no vault contents, no `DATABASE_URL`, no role passwords, no peppers, no private IPs, no `.env` values, no host / port material,
- **no production changes** are made by PR#17h (production state was already established by PR#17f execution; PR#17h only records it),
- the doc **records PR#17f execution proof accurately** (DB creation, baseline, migrations, role, separation, tokens, zero-traffic posture),
- the doc **records PR#17g correction and `016_scoring_output_lane_grant_safety.sql`** as the closing of the Lane A/B writer-grant blocker,
- the doc **records the `src/db/schema.sql` baseline decision** (with Helen's explicit approval, dry-run proof, and the deliberate non-use of `dist/db/schema.sql` for the baseline),
- the doc **records the `dist/db/schema.sql` stale follow-up** as a repo-hygiene item for a later PR,
- the doc **records: no cutover, no Track A, no customer-facing output** as the explicit non-events of PR#17f execution.

---

End of PR#17h proof closure. **Docs only. No execution. No DB access. No secrets.**
