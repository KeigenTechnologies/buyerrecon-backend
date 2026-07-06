# CLAUDE.md — BuyerRecon backend

Guidance for working in this repository.

## Project Background

BuyerRecon backend is a TypeScript backend with strict production-safety, evidence, and governance boundaries. The `.claude/` files are the repository control plane for Claude Code: constants, glossary, and production-parameter rules must be read before related PR work.

## Stop-Lines (Mandatory)

- Do not run Stage0, SQL, psql, workers, extractors, deploys, runtime commands, production commands, Lane/scoring, AMS runtime, or customer-output actions unless the user gives an explicit scoped HELEN GO for that exact action.
- Do not inspect, print, transform, store, or reproduce secrets, DSN values, connection strings, hosts, ports, usernames, passwords, tokens, private keys, or connection components.
- Registry documents, glossary documents, production-parameter documents, evidence docs, and planning docs do not authorize execution.
- If a task appears to require production access, secret inspection, env mutation, credential rotation, SQL/psql, Stage0, worker/extractor execution, deploy, Lane/scoring, AMS runtime, or customer output, stop and request an explicit scoped GO.
- If scope is ambiguous, choose the safer docs-only / read-only interpretation and report the stop-line.

## Mandatory Reading Map

- For constants / project-unique literals: read `.claude/constants.md` and `config/constants.ts`.
- For project vocabulary: read `.claude/glossary.md`.
- For production parameters, DSN handling, custody, env-var names, roles, URLs, host/port questions, or Stage0 runner auth: read `.claude/production-parameters.md`.
- For current inventory state: read `docs/config-constants-inventory.md`.
- For candidate triage / pending Helen decisions: read `docs/config-constants-candidate-triage.md`.

## Configuration Discipline (Mandatory)

- All canonical environment names, role names, deployment paths, URLs, endpoint names, route
  names, database identifiers, secret/env-var names, ports, and stage/route vocabulary must be
  registered before reuse.
- Machine-consumed constants live in `config/constants.ts`.
- Human/Claude registry lives in `.claude/constants.md`.
- Do not invent aliases.
- Do not introduce raw literals for registered constants.
- Before writing code that uses a constant-like value, check `.claude/constants.md` and
  `config/constants.ts` first.
- If a value is missing, add it to both registry files before using it.
- Each PR must run `npm run check:constants` before completion.
- Inventory stays broad; `check:constants` guardrail stays narrow.
- `docs/config-constants-inventory.md` is current inventory state.
- `docs/config-constants-candidate-triage.md` is triage / pending decision state.
- Do not add high-noise env names or concept terms to forbidden literals without a dedicated reviewed PR.

## Project Vocabulary

- For canonical concept definitions (Stage0, Route A/B/C, Option A/B/C, `auth_or_credential`,
  `role_missing_or_not_login`, HELEN GO, run-lock, customer output, Lane A/B, AMS runtime,
  etc.), read `.claude/glossary.md`. It defines concepts only — it is not part of
  `check:constants` and authorizes no execution.

## Production Parameters

- Before any PR touching `DATABASE_URL`, `STAGE0_RUNNER_DSN`, `APP_DSN`, `ADMIN_DSN`,
  `RUNNER_DSN`, DSN custody, deployment env, database roles, production connection handling,
  Stage 0 runner auth, or host/port/URL handling, read `.claude/production-parameters.md`.
- This file is a decision/registry layer only. It does not authorize production execution or
  secret inspection.

## PR Completion Checklist

Before reporting completion:

- Confirm exact files changed.
- Confirm no out-of-scope files changed.
- Run `npm run check:constants`.
- Run `git diff --check`.
- Do not run test, build, typecheck, SQL, psql, Stage0, workers, extractors, deploys, runtime
  commands, production commands, Lane/scoring, AMS runtime, or customer-output actions unless
  explicitly requested and safe for the exact scoped task.
- Confirm no secrets or connection components were printed or stored.
- Confirm no runtime, production, SQL/psql, Stage0, worker/extractor, deploy, Lane/scoring, AMS
  runtime, or customer-output action occurred unless explicitly GO-authorized.
## PR Test-Layering Delivery Requirements

> Governance addition — `SPRINT3_5_CLAUDE_TEST_LAYERING_DELIVERY_REQUIREMENTS`. Process/config only;
> authorizes no execution (see **Non-Authorization** at the end of this section).

Every PR must classify its validation scope before implementation.

### Test / Validation Layers

Use these layers consistently:

- **L1 — Pure logic / static / unit validation**
  - No DB.
  - No network.
  - No server.
  - No production data.
  - No env/secret reads.
  - No application boot unless explicitly justified.
  - No worker/classifier/risk-evidence execution.
  - No Lane/scoring/AMS/customer-output generation.
  - No Gate4E/Gate4F.
  - Should be fully automated through npm scripts or unit tests.
  - Examples: constants checks, static boundary / import / coupling / topology checks, shape checks,
    pure helper tests, schema/contract text checks.

- **L2 — Integration / contract validation in non-production only**
  - May test module interaction, API contract, or DB behavior only against mock, fixture, or test database.
  - Must not use production credentials, production data, private captures, or live server.
  - Must be automated once the test environment is defined.
  - If a PR needs L2 but no safe test environment exists, the PR must document that gap and remain L1/static-only.

- **L3 — Production verification**
  - Touches production server, production DB, production credentials, real captures, real workers, deploys, Gate actions, or customer-output surfaces.
  - Requires explicit human authorization / GO.
  - Must be separately planned.
  - Must be narrowly scoped.
  - Must produce safe labels / evidence only.
  - Must not be hidden inside a normal code PR.

### Required PR Author Output

Every PR report must include:

1. **Layer classification**
   - L1 only / L1+L2 / L3 required.
   - If L3 is required, state why L1/L2 cannot prove the claim.

2. **Automated validation commands**
   - List exact commands run.
   - Prefer npm scripts.
   - Example:
     - `npm run check:constants`
     - `npm run check:static-boundaries`
     - `npm run check:pg-pool-construction`
     - `npm run check:observer-shape`
     - `npm run check:record-only-gate`
     - `npm run check:customer-output-boundary`
     - `npm run check:db-pool-factory-scaffold`

3. **Forbidden-action confirmation**
   - Confirm whether the PR did or did not:
     - access server
     - run production commands
     - connect to DB/network
     - read env/secrets
     - execute workers/classifiers/risk-evidence
     - read private captures / run.err / run.safe.out
     - generate Lane/scoring/AMS/customer output
     - execute Gate4E/Gate4F
     - change runtime behavior

4. **Manual validation requirement**
   - State whether any human/manual validation remains.
   - If yes, classify it as:
     - architecture judgment
     - merge authorization
     - L3 production authorization
     - L3 result interpretation

5. **No silent escalation**
   - A PR that starts as L1/static may not silently perform L2 or L3 actions.
   - Any DB/network/server/runtime/customer-output/Gate action requires a separate planning PR and explicit GO.

### BuyerRecon Current Baseline

The current safe static guardrail bundle is:

```bash
npm run check:constants
npm run check:static-boundaries
npm run check:pg-pool-construction
npm run check:observer-shape
npm run check:record-only-gate
npm run check:customer-output-boundary
npm run check:db-pool-factory-scaffold
```

### CI Enforcement (current)

- `static-guardrails` (GitHub Actions) is now **enforced by the repository ruleset** on PRs targeting
  `sprint2-architecture-contracts-d4cc2bf`: a pull request is required, `required_approvals: 0`, the
  `static-guardrails` status check must pass, force pushes are blocked, deletions are restricted, and the
  bypass list is empty.
- Passing `static-guardrails` proves the **L1 / static** bundle only. It does **not** prove runtime
  behavior, DB role binding, worker behavior, customer-output behavior, Gate behavior, L2, or L3.

### Non-Authorization

These requirements are **process/config only**. They do **not** authorize: L3 execution; production access;
DB/network tests; worker/classifier/risk-evidence execution; customer-output generation; Gate4E/Gate4F;
deploy; secret/env reads; or refactor. Any such action requires its **own separate planning PR and explicit
GO**, and must never be silently escalated inside a code PR.
