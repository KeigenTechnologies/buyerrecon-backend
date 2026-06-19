# Production Parameter Registry Decision Plan

> Project-level **decision/registry layer** for production parameters (env-var names, custody
> source labels, production identifiers, URLs/host:port). It exists so future Claude / Codex /
> operator work does not have to infer production-parameter meanings from scattered PR evidence.
> It is **docs-only**: it changes no runtime behavior, no enforcement, no constants, no secrets,
> no deployment, and no code. Companion to `.claude/constants.md` (machine/registry literals) and
> `.claude/glossary.md` (concept vocabulary).

## Status

- **Status: PLANNING / REGISTRY ONLY.**
- This document is a governance decision layer.
- It does **not** contain secrets.
- It does **not** authorize production execution.
- It does **not** override explicit Helen GO.
- It does **not** override PR evidence.
- It does **not** override `.claude/constants.md` or `.claude/glossary.md`.
- It does **not** participate in `check:constants`.

## Hard secret boundary

- **Never** print, store, inspect, transform, or reproduce DSN values.
- **Never** print, store, inspect, transform, or reproduce `postgres://` or `postgresql://`
  connection strings.
- **Never** print, store, inspect, transform, or reproduce hosts, ports, usernames, passwords,
  tokens, private keys, connection components, or secret-shaped values.
- Future diagnostics may report **only** safe labels, counts, boolean presence checks, source
  category, file category, and non-secret env-var **names**.
- If raw values are required to proceed, **stop** and require a separate secret-safe plan.

## Parameter classes

### 1. Runtime environment variable names

- **Meaning:** Names that application/runtime code may reference as `process.env.X`.
- **Examples:** `DATABASE_URL`, `STAGE0_RUNNER_DSN`, `APP_DSN`, `ADMIN_DSN`, `RUNNER_DSN`.
- **Status:** `PENDING_HELEN_REVIEW` for the canonical naming set.
- **Boundary:** Env-var **names** may be documented; env-var **values** must never be documented.

### 2. Custody source labels

- **Meaning:** Non-secret labels describing where a secret is held or supplied from.
- **Examples:** controlled shell, deployment metadata, secret manager, operator hidden input.
- **Status:** `PENDING_HELEN_REVIEW` unless already established by merged evidence.
- **Boundary:** Custody source labels are **not** DSN values.

### 3. Secret values

- **Meaning:** Actual DSN values, passwords, tokens, hosts, ports, users, connection components,
  private keys, or secret-shaped values.
- **Status:** `FORBIDDEN_IN_REPO_DOCS_AND_OUTPUTS`.
- **Boundary:** Must never be printed or committed.

### 4. Production identifiers

- **Meaning:** Non-secret production names such as environment name, DB role name, deployment
  path, service identifier.
- **Examples:** Use only values already registered in `config/constants.ts` / `.claude/constants.md`.
- **Status:** Already governed by the constants registry and `check:constants` where applicable.

### 5. URLs / endpoints / host-port references

- **Meaning:** Public URLs, local URLs, endpoint paths, host:port shaped references.
- **Status:** `PENDING_HELEN_REVIEW` for the canonical URL set and whether any host:port belongs
  in code.
- **Boundary:** Do not reproduce production host/port or connection details.

## Canonical naming decisions pending Helen review

> Names only — **no raw host, port, URL, or DSN values appear in this table.**

| Candidate name | Class | Current recommendation | Forbidden guardrail? | Helen approval required | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | Runtime env-var name | Standard env name; may be valid `process.env` reference | No | Yes | Do not forbid by grep |
| `STAGE0_RUNNER_DSN` | Runtime env-var name / Stage 0 runner DSN handle | Candidate canonical Stage 0 runner env name | No | Yes | Name allowed; value forbidden |
| `APP_DSN` | Runtime env-var name candidate | Candidate short app DSN name | No | Yes | Pending canonical naming decision |
| `ADMIN_DSN` | Runtime env-var name candidate | Candidate admin DSN name | No | Yes | Pending canonical naming decision |
| `RUNNER_DSN` | Runtime env-var name candidate | Candidate generic runner DSN name | No | Yes | Pending whether too ambiguous |
| DSN custody source | Custody source label | Should be tracked by safe source labels, not values | No | Yes | Source label only |
| Canonical URL set | URL/endpoint governance | Pending review | No | Yes | Do not include secret endpoints |
| Host:port in code | Runtime/config boundary | Pending review; likely avoid unless local test/dev fixture | No | Yes | No production host/port values in docs |

## Decision rules for future PRs

- If a PR touches production connection handling, it must state which **parameter class** it
  touches.
- If it touches env-var **names** only, it may cite names but must not cite values.
- If it touches **custody**, it may cite safe source categories but not secret values.
- If it needs a **new env-var name**, mark it `PENDING_HELEN_REVIEW` unless already approved in
  this document.
- If it needs a **new project-unique non-secret literal**, update `config/constants.ts` and
  `.claude/constants.md` in a separate scoped PR.
- If it needs a **new concept term**, update `.claude/glossary.md` in a separate scoped PR.
- **Never** add DSN values, host/port values, passwords, tokens, or connection components to docs
  or code comments.
- Do **not** add high-noise env names such as `DATABASE_URL` or `STAGE0_RUNNER_DSN` to the
  forbidden-literal guardrail.
- **Guardrail remains narrow; inventory remains broad.**

## Does NOT authorize

This document does **NOT** authorize:

- production command execution
- SQL or psql
- Stage 0 execution
- worker or extractor execution
- deploys
- env mutation
- secret reads
- password rotation
- credential changes
- Lane/scoring/AMS runtime
- customer output

## Open decisions for Helen

1. Is `STAGE0_RUNNER_DSN` the canonical Stage 0 runner env-var name?
2. Should `APP_DSN` / `ADMIN_DSN` / `RUNNER_DSN` remain valid names, or be deprecated in favor of
   more explicit names?
3. What safe custody source labels should be canonical?
4. Should any URL/endpoint set be canonicalized later?
5. Should host:port ever be allowed in source code outside local tests?
6. Should there be a later machine check for raw DSN/connection strings that reports only file
   paths/categories, never values?
