# BuyerRecon Sprint 2 PR#17i — Schema Baseline Hygiene / src-dist Schema Policy

Status: **repo hygiene only**. No DB access. No production execution. No deployment. No DNS change. No ThinLayer cutover. No Track A. No traffic. No secrets. No runtime behaviour change beyond a comment-only header at the top of `src/db/schema.sql`.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `74a9532` — PR#17h merged, "record PR17f production migration proof").

PR branch: `buyerrecon-sprint2-pr17i-schema-baseline-hygiene`

---

## 1. Purpose

PR#17i closes the stale-`dist/db/schema.sql` follow-up that PR#17h recorded as item 1 of its §18 known follow-ups. It does so by codifying the canonical-schema policy in repo:

- **`src/db/schema.sql` is canonical** for operator / production baseline use and for test / dev `initDb()` bootstrap.
- **`dist/db/schema.sql` is a Docker build artifact**, not an independent source of truth, and is **gitignored** (it has never been tracked in this repo's git history).
- Any local `dist/db/schema.sql` on an operator machine is a possibly-stale build leftover and must not be used as a production baseline.

PR#17i does not modify migrations, does not connect to any DB, does not perform any production action, and does not change runtime behaviour beyond a SQL comment-only header.

---

## 2. Background from PR#17f / PR#17h

PR#17h §7 recorded an execution-time discovery during PR#17f production baseline preparation:

- `buyerrecon_production` was initially empty.
- `migrations/002_event_contract_v2.sql` and `migrations/004_accepted_events_evidence_columns.sql` depend on `accepted_events` already existing.
- `migrations/005_rejected_events_evidence_columns.sql` depends on `rejected_events` already existing.
- There is no `schema.sql` at the repo root.
- Two schema files were observed on the operator's machine:
  - `src/db/schema.sql` — 903 lines, current consolidated schema including the Sprint 2 tables (`accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features`, `session_behavioural_features_v0_2`, `scoring_output_lane_a`, `scoring_output_lane_b`, `stage0_decisions`, `risk_observations_v0_1`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`),
  - `dist/db/schema.sql` — 312 lines, **stale** — only reached `site_write_tokens` and lacked later Sprint 2 tables.
- A disposable dry-run proved `src/db/schema.sql` baseline + `migrations/002–016` produced the expected canonical state.
- Helen / user **explicitly approved** using `src/db/schema.sql` as the production baseline.
- `dist/db/schema.sql` was **not** used for the production baseline.

PR#17h flagged the stale `dist/db/schema.sql` as a future repo-hygiene item (PR#17h §18 item 1). PR#17i is that hygiene PR.

---

## 3. Investigation findings (Sprint 2 PR#17i)

PR#17i investigation confirms why the operator's local `dist/db/schema.sql` went stale and why the canonical-schema picture is unambiguous in the repo:

- **`dist/` is gitignored.** `.gitignore` line 2 contains `dist/`. The `dist/` tree is therefore not tracked in this repo.
- **`dist/db/schema.sql` has never been in git history.** `git log --all --oneline -- dist/db/schema.sql` returns empty output: there is no commit anywhere in this repository's history that introduces `dist/db/schema.sql`. The stale file PR#17h observed was on the operator's local machine only.
- **`tsconfig.json` excludes `dist`** and emits `src/` → `dist/` as `.js` only. `tsc` does not emit `.sql`. Nothing in `npm run build` (which is `tsc`) writes `dist/db/schema.sql`.
- **The Dockerfile is what produces `dist/db/schema.sql`.** The runtime stage of the multi-stage `Dockerfile` performs:

  ```
  FROM node:20-slim AS builder
  ...
  RUN npx tsc

  FROM node:20-slim
  ...
  COPY --from=builder /app/dist dist/
  COPY src/db/schema.sql dist/db/schema.sql
  ```

  i.e. the runtime image is hydrated by copying `src/db/schema.sql` into `dist/db/schema.sql` so the compiled `dist/db/client.js` can find it co-located at runtime. This `COPY` runs on every Docker build; a fresh image always carries an up-to-date `dist/db/schema.sql`.
- **Runtime path:** `src/db/client.ts` defines `initDb()` which reads `join(__dirname, 'schema.sql')`. When TypeScript is compiled, `__dirname` resolves at runtime to `dist/db/`, so `initDb()` reads `dist/db/schema.sql` inside the running container. The Dockerfile's `COPY` ensures that file is fresh per build; it is never expected to be hand-maintained.
- **Why Helen's local copy was stale.** The operator's local `dist/db/schema.sql` was a leftover from a prior local Docker build (or local copy) performed before later Sprint 2 schema additions landed in `src/db/schema.sql`. Because `dist/` is gitignored, that local file does not roll forward when `src/db/schema.sql` changes; it only refreshes on a fresh `docker build` (or manual `cp`). Hence the 312-line vs 903-line gap.
- **Repository references treat `src/db/schema.sql` as canonical.** Multiple test, runtime, and docs references name `src/db/schema.sql` as the canonical schema; for example:
  - `src/db/client.ts:11-15` `initDb()` reads `schema.sql` co-located with `client.ts` source (and with `client.js` in the runtime image).
  - `tests/v1/db/_setup.ts:11,158` applies `src/db/schema.sql` to the test DB.
  - `tests/v1/scoring-output-contracts.lint.test.ts:257` comments `src/db/schema.sql — canonical schema`.
  - Multiple PR docs (`sprint2-pr1-*`, `sprint2-pr6-*`, `sprint2-pr8-*`, etc.) refer to `src/db/schema.sql` as the canonical mirror appended by each PR.
  - `docs/architecture/ARCHITECTURE_GATE_A0.md:883` explicitly documents the Dockerfile `COPY src/db/schema.sql dist/db/schema.sql`.

These findings rule out Option A (committing `dist/db/schema.sql`) and Option C (removing `dist/db/schema.sql` from the repo). They make Option B (docs-only canonical policy) the correct and only safe choice.

---

## 4. Canonical schema policy

This section is the policy that PR#17i adds to the repo:

1. **`src/db/schema.sql` is the canonical schema baseline.** It is the single source of truth for:
   - operator / production baseline application (e.g. when bringing up a new `buyerrecon_production` or `buyerrecon_staging` DB, the operator applies `src/db/schema.sql` first, then applies `migrations/002_*.sql` through the highest-numbered approved migration in numeric order);
   - test and dev bootstrap via `initDb()` (`src/db/client.ts`) and `tests/v1/db/_setup.ts`.
2. **Migrations under `migrations/` are the ordered evolution path.** They are applied **after** the `src/db/schema.sql` baseline. As of PR#17g merge, the production-approved migration set is `migrations/002_*.sql` through `migrations/016_*.sql` (15 files), with `016_scoring_output_lane_grant_safety.sql` required to land the PR#17g Lane A/B grant-safety correction before the production migration phase is considered complete (per the PR#17f runbook §7 as updated by PR#17g).
3. **`dist/db/schema.sql` is NOT a source of truth.** It is purely a build artifact produced by the Dockerfile's `COPY src/db/schema.sql dist/db/schema.sql` step so the runtime container's `dist/db/client.js` can read it co-located via `join(__dirname, 'schema.sql')`. It is **gitignored** (`.gitignore` line 2: `dist/`) and is not tracked in this repo's git history.
4. **Any local `dist/db/schema.sql` on an operator's machine is a possibly-stale build leftover.** It does not roll forward when `src/db/schema.sql` changes; it only refreshes on a fresh `docker build` (or a manual `cp src/db/schema.sql dist/db/schema.sql`).
5. **Operators must always baseline from `src/db/schema.sql`.** They must never use a local `dist/db/schema.sql` as the production baseline. The cleanest way to remove stale local `dist/db/schema.sql` files is to delete the local `dist/` tree (`rm -rf dist`) before the next build; the next `tsc` / Docker build will recreate `dist/` afresh.
6. **Future runtime-image hydration is the Dockerfile's job.** No repo PR should commit `dist/db/schema.sql`, because: it would violate `.gitignore`, it would dual-source the schema, and it would inevitably drift from `src/db/schema.sql` between updates.

This policy is also surfaced in-source via a SQL comment-only header at the top of `src/db/schema.sql` (added by PR#17i) so operators reading the schema file directly see the policy without needing to find this docs file first.

---

## 5. What changed in PR#17i

PR#17i is **Option B** (docs-only canonical policy), refined to add a single comment-only marker at the top of the canonical schema file. Concretely:

1. **`docs/sprint2-pr17i-schema-baseline-hygiene.md`** (new) — this file. Records the full policy and the PR#17h follow-up closure.
2. **`src/db/schema.sql`** — added a 14-line SQL-comment-only header (above the existing `Truth Pipeline schema per spec v1.1` line) naming the file as the canonical schema source, naming `dist/db/schema.sql` as a Docker build artifact, and pointing readers at this docs file. **No DDL was changed; no `CREATE TABLE`, `CREATE INDEX`, `GRANT`, `REVOKE`, function, type, role, or extension declaration was added, modified, or removed.**

PR#17i did **not**:

- copy `src/db/schema.sql` to `dist/db/schema.sql` (Option A) — would violate `.gitignore`, dual-source the schema, and re-create the drift problem on the next `src/` edit;
- remove `dist/db/schema.sql` from the repo (Option C) — nothing to remove; the file is not in git history and is only a local Docker / build artifact;
- modify any migration under `migrations/`;
- modify the Dockerfile, `tsconfig.json`, `package.json`, scripts, tests, or runtime code;
- connect to any DB;
- perform any production action.

---

## 6. Verification

PR#17i is verified at repo level only — no DB access, no production commands, no deployment, no traffic.

### 6.1 Canonical-schema file hashes / sizes

For the record:

- `src/db/schema.sql` (after PR#17i's comment-only header):
  - the schema header now contains the PR#17i canonical-source comment; the body (every line from `-- UUID generation:` onwards) is byte-identical to its pre-PR#17i content.
- `dist/db/schema.sql` (build artifact, gitignored):
  - **not part of this PR**. May or may not exist on any operator's machine. If present, it should be regarded as a possibly-stale Docker build leftover, not as a baseline source. The cleanest reset is `rm -rf dist` followed by a fresh `tsc` / Docker build.

PR#17i deliberately does **not** attempt to fix any operator's local `dist/db/schema.sql`. That file is outside the repo's scope.

### 6.2 No dangerous operations introduced

- No new SQL DDL.
- No new migrations.
- No DB connection.
- No production commands.
- No deployment.
- No DNS change.
- No ThinLayer `endpointUrl` change.
- No Track A run.
- No Playwright run.
- No traffic generated.
- No new secrets, role passwords, DB URLs, tokens, token hashes, token prefixes, vault contents, private IPs, or peppers.

### 6.3 Static checks

- `npm run check:scoring-contracts` — runs the local-only scoring-contract static checker (the script's own docstring confirms "No DB. No HTTP. No production-specific behaviour.").
- `npx tsc --noEmit` — local-only type check; does not require DB or network.
- DB tests (`vitest run --config vitest.db.config.ts`, i.e. `npm run test:db:v1`) are explicitly **skipped** by PR#17i because they require `TEST_DATABASE_URL` and would touch a database; PR#17i's hard boundary forbids any DB access.

The expected outcome is: both `npm run check:scoring-contracts` and `npx tsc --noEmit` pass with no errors. Any failure observed at validation time is recorded in the PR description and investigated before merge.

---

## 7. Non-goals

PR#17i explicitly does **not** approve and does **not** perform any of the following:

- DB changes,
- production commands,
- migration application (any environment),
- deployment,
- DNS change,
- ThinLayer `endpointUrl` cutover,
- Track A execution,
- Playwright execution,
- production traffic generation,
- customer-facing automated output,
- durable Lane A/B writers (PR#17g remains the canonical Lane A/B grant-safety enforcement),
- AMS runtime bridge,
- AMS Trust Core output exposure,
- Pass 1 / Pass 2 implementation,
- modification of `dist/db/schema.sql` (in repo or on any operator machine),
- modification of the Dockerfile, `tsconfig.json`, `package.json`, scripts, tests, or runtime code.

---

## 8. Acceptance criteria

PR#17i is accepted if and only if:

- the **schema baseline policy is clear and codified** in `src/db/schema.sql` (header comment) and in this docs file (`docs/sprint2-pr17i-schema-baseline-hygiene.md`),
- the **PR#17h stale-`dist/db/schema.sql` follow-up is closed** by documenting that `dist/db/schema.sql` is a gitignored Docker build artifact and must not be used as a baseline,
- **no production action** was taken by PR#17i,
- **no secrets** appear in PR#17i,
- **no DB access** was performed by PR#17i,
- **tests / static checks pass** at PR#17i validation (`npm run check:scoring-contracts` PASS; `npx tsc --noEmit` PASS; DB tests skipped per §6.3),
- **no migrations were added or modified** by PR#17i,
- **no runtime code was modified** by PR#17i (the change to `src/db/schema.sql` is a SQL-comment-only header; SQL comments do not affect `pool.query(schema)` execution).

---

## 9. Stop-the-line conditions

Stop and re-plan if any of the following appears at PR#17i authoring, review, or merge:

- `src/db/schema.sql` is modified beyond a comment-only header,
- `dist/db/schema.sql` is added to git or otherwise committed,
- a migration is added, edited, or removed under `migrations/`,
- a DB connection is opened by anything PR#17i runs,
- a production command is executed,
- secrets, tokens, token hashes, token prefixes, DB URLs, passwords, peppers, vault contents, or private IPs appear in any artefact,
- the Dockerfile's `COPY src/db/schema.sql dist/db/schema.sql` is removed or altered (which would change runtime image hydration semantics, out of PR#17i scope),
- runtime code under `src/` (beyond `src/db/schema.sql`'s comment header) is modified.

---

End of PR#17i hygiene closure. **Docs and one comment-only header. No execution. No DB access. No secrets.**
