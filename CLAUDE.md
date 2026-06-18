# CLAUDE.md — BuyerRecon backend

Guidance for working in this repository.

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

## Project Vocabulary

- For canonical concept definitions (Stage0, Route A/B/C, Option A/B/C, `auth_or_credential`,
  `role_missing_or_not_login`, HELEN GO, run-lock, customer output, Lane A/B, AMS runtime,
  etc.), read `.claude/glossary.md`. It defines concepts only — it is not part of
  `check:constants` and authorizes no execution.
