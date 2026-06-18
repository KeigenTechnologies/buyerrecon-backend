# BuyerRecon — Constants Registry (Human / Claude)

This is the human-readable companion to `config/constants.ts`. Every canonical
environment name, role name, deployment path, env-var/secret name, Stage 0
route/label, URL/endpoint, port, and other canonical literal must be registered
here **before reuse**. Do not invent aliases. Mark uncertain values as
`PENDING_REVIEW` instead of guessing.

- Machine-consumed constants: `config/constants.ts`
- Guardrail: `npm run check:constants` (enforced over source code; see
  `scripts/check-no-raw-constants.mjs`)

(A project glossary is intentionally **not** part of this PR; it is a separate follow-up.
Sources of truth here are `config/constants.ts` and this file only.)

"Allowed files" below means: the symbol's **raw literal value** may appear directly
only in the listed registry/guardrail files; **source code** must import the symbol
from `config/constants.ts` instead of hard-coding the literal.

Registry/guardrail files where these literals are always allowed:
`config/constants.ts`, `.claude/constants.md`,
`scripts/check-no-raw-constants.mjs`, `docs/config-constants-inventory.md`.

**Guardrail enforcement scope (this PR):** `npm run check:constants` **fails** only on the
four project-unique literals — `buyerrecon_production`, `buyerrecon_prod_collector_app`,
`buyerrecon_stage0_runner`, `/opt/buyerrecon-backend`. The remaining registered symbols below
(`STAGE0_ROUTE_A/B/C`, `STAGE0_LABEL`, `STAGE0_ENV_PREFIX`, `DATABASE_URL_ENV`,
`STAGE0_RUNNER_DSN_ENV`) are **registered but not yet enforced** — they are tracked as
candidates pending Helen review in `docs/config-constants-inventory.md`.

---

## Environments

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `PRODUCTION_ENV` | `buyerrecon_production` | Canonical production environment / DB name identifier | registry files; import from `config/constants.ts` in code | No `prod`, `production`, `br_prod`, `buyerrecon-prod`, or ad-hoc spellings. (This identifier is also the production database name.) |

## Database roles

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `PRODUCTION_DB_ROLE_COLLECTOR_APP` | `buyerrecon_prod_collector_app` | Production collector application DB role (bound to `DATABASE_URL`); NOT the Stage 0 runner | registry files; import in code | No `collector_app`, `prod_collector`, `buyerrecon_app`. Never use as the Stage 0 DSN role. |
| `STAGE0_RUNNER_ROLE` | `buyerrecon_stage0_runner` | Dedicated least-privilege Stage 0 runner DB role | registry files; import in code | No `stage0_runner`, `runner`, `br_stage0`. Distinct from the collector role. |

## Deployment paths

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `PRODUCTION_CHECKOUT_PATH` | `/opt/buyerrecon-backend` | Production host repo checkout path | registry files; import in code | No `/opt/buyerrecon`, `~/buyerrecon-backend`, relative variants. |

## Environment variable names / secret names

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `DATABASE_URL_ENV` | `DATABASE_URL` | Env-var name for the collector application DSN | registry files; import in code | The **name** is registered; the **value** is a secret and must never be printed/committed. No `DB_URL`, `DATABASE_DSN`. |
| `STAGE0_RUNNER_DSN_ENV` | `STAGE0_RUNNER_DSN` | Env-var / custody key name for the Stage 0 runner DSN | registry files; import in code | Name only; value is a secret (custody file `/etc/buyerrecon/stage0-runner.env`, PENDING_REVIEW below). No `RUNNER_DSN`, `STAGE0_DSN`. |
| `STAGE0_ENV_PREFIX` | `STAGE0` | Canonical prefix for Stage 0 env-var names | registry files; import in code | Use the prefix consistently; do not coin `STG0`, `S0`. |

## Stage 0 route labels

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `STAGE0_ROUTE_A` | `RouteA` | Stage 0 correction/diagnostic Route A label | registry files; import in code | No `route_a`, `route-a`, `A`. Registered, not yet guardrail-enforced. |
| `STAGE0_ROUTE_B` | `RouteB` | Stage 0 correction/diagnostic Route B label | registry files; import in code | No `route_b`, `route-b`, `B`. Registered, not yet guardrail-enforced. |
| `STAGE0_ROUTE_C` | `RouteC` | Stage 0 correction/diagnostic Route C label | registry files; import in code | No `route_c`, `route-c`, `C`. Registered, not yet guardrail-enforced. |
| `STAGE0_LABEL` | `Stage0` | Canonical Stage 0 label | registry files; import in code | No `stage 0`, `stage-0`, `S0`, `stage_zero`. |

## URLs / endpoints

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| _PENDING_REVIEW_ | `PENDING_REVIEW` | Production / canary / endpoint URLs (the inventory found URL-shaped strings across docs/tests/config; canonical set not yet established) | — | Do not register a URL constant until the canonical value is confirmed by Helen. Until then, no URL constants exist. |

## Ports

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| _PENDING_REVIEW_ | `PENDING_REVIEW` | Canonical service/DB ports (port-shaped tokens and `localhost`/`127.0.0.1` appear in tests/docs; production DB port is custody-only and must never be hard-coded) | — | Do not register a port constant from a guess. Production host/port remain custody-only (never in repo). `5432` appears only as a negative "do not assume" example in docs. |

## Other canonical literals pending review

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| _PENDING_REVIEW_ | `STAGE0_RUNNER_DSN` custody file path | Custody file is `/etc/buyerrecon/stage0-runner.env` (root:root, chmod 600) per the production parameter registry; not yet promoted to a code constant | — | Path is non-secret but its **contents** are a secret DSN. Promote to a constant only if code needs it; never print contents. |
| _PENDING_REVIEW_ | `APP_DSN` / `ADMIN_DSN` / `RUNNER_DSN` naming | The inventory found `*_DSN` naming variants across docs/tests; canonical set beyond `STAGE0_RUNNER_DSN_ENV` / `DATABASE_URL_ENV` is not yet established | — | Register only after Helen confirms canonical DSN env-var names; do not coin new ones. |
| _PENDING_REVIEW_ | run-lock path | A Stage 0 run-lock path is referenced in ops docs but its canonical value is `TBD` in the production parameter registry | — | Do not register until resolved. |
