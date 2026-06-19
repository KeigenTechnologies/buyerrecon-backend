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
