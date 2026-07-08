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
| `RISK_WORKER_ROLE` | `buyerrecon_risk_worker` | Dedicated least-privilege risk-evidence worker DB **LOGIN** role; the intended `RISK_WORKER_ROLE` runtime identity (non-secret name only) | registry files; import in code | No `risk_worker`, `buyerrecon_app`. **Not** `buyerrecon_scoring_worker` (that is a NOLOGIN group). Separate from collector and Stage 0 roles. Registered, not yet guardrail-enforced. See "Production non-secret runtime role candidates" below. |

## Production non-secret runtime role candidates

**Status:** `RISK_WORKER_ROLE_REGISTERED_DOC_ONLY`

- `RISK_WORKER_ROLE=buyerrecon_risk_worker` — the intended production risk-evidence
  worker LOGIN identity. **This is a non-secret role name only.**
- **Provenance:** PR #323 planned the dedicated role path; PR #324 merged the
  command-pack planning; PR #325 recorded the create/grant/proof PASS.
- **Proof status (from PR #325):** `buyerrecon_risk_worker` exists; can login; is
  **not** superuser; does **not** have `CREATEDB`, `CREATEROLE`, `REPLICATION`, or
  `BYPASSRLS`; and holds exactly the four proven minimal privileges:
  - `SELECT` on `public.stage0_decisions`
  - `SELECT` on `public.session_behavioural_features_v0_2`
  - `INSERT` on `public.risk_observations_v0_1`
  - `UPDATE` on `public.risk_observations_v0_1`
- **Boundary:** this registration contains and implies **no** password, DSN, host,
  port, env value, or connection string. It does **not** authorize running the risk
  worker, executing the PR #321 confirmation diagnostic or the PR #320
  input-readiness proof, or any Lane/scoring, AMS runtime, customer output, Gate4E,
  or Gate4F action. Any proof or runtime use of `buyerrecon_risk_worker` still
  requires its own separate scoped Helen GO.

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

## Risk-worker Option B — compiled build artifact / compiled runtime path

| Symbol | Value | Meaning | Allowed files | Forbidden aliases / notes |
|---|---|---|---|---|
| `COMPILED_ARTIFACT_ROOT` | `dist/riskworker` | Root directory for Option B compiled risk-worker artifacts; a dedicated subtree under the already-gitignored `dist/` (kept separate from the server build output `dist/server.js`) | registry files; import in code | Non-secret path. No `build/`, `out/`, or bare `dist/` for the risk-worker artifact subtree. Registered, not yet guardrail-enforced. |
| `RISKWORKER_COMPILED_ENTRYPOINT` | `dist/riskworker/scripts/run-risk-evidence-worker.js` | Compiled (`node`-runnable) form of the risk-evidence worker entrypoint | registry files; import in code | Non-secret path. The compiled runtime path is **not active** in Slice 1; the `tsx scripts/run-risk-evidence-worker.ts` script is unchanged. Registered, not yet guardrail-enforced. |
| `RECORD_ONLY_COMPILED_ENTRYPOINT` | `dist/riskworker/scripts/run-risk-evidence-record-only-worker.js` | Compiled form of the distinct record-only worker wrapper entrypoint | registry files; import in code | Non-secret path. Not active in Slice 1; the `tsx` record-only script is unchanged. Registered, not yet guardrail-enforced. |
| `RISKWORKER_BUILD_COMMAND` | `build:riskworker-artifact` | Name of the static, build-only npm script that compiles the risk-worker entrypoints into `COMPILED_ARTIFACT_ROOT` (via `tsconfig.riskworker-artifact.json`) | registry files; import in code | Build-only (`tsc`); runs no worker/DB/network/customer-output. Additive; does not change existing scripts. Registered, not yet guardrail-enforced. |
| `RISKWORKER_COMPILED_RUN_COMMAND` | `run:riskworker-compiled` | **RESERVED** name for the future compiled-runtime run script (runtime switch) | registry files; import in code | **Not wired in Slice 1** (no package script). Wiring the compiled runtime path is a later slice under its own review/GO. Registered, not yet guardrail-enforced. |
| `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND` | `proof:riskworker-runtime-preflight` | **RESERVED** name for the future runtime preflight proof command | registry files; import in code | **Not wired in Slice 1.** L3 preflight belongs to a later slice under a separate exact GO. Registered, not yet guardrail-enforced. |
| `RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND` | `proof:riskworker-ci-build-parity` | **RESERVED** name for the future CI/build parity proof command (Option C) | registry files; import in code | **Not wired in Slice 1.** Parity proof belongs to a later slice. Registered, not yet guardrail-enforced. |

## Risk-worker Option B compiled-artifact scaffold status

**Status:** `RISKWORKER_OPTION_B_SLICE1_CONSTANTS_AND_BUILD_SCAFFOLD_L1_STATIC`

- **Provenance:** Preferred architecture chosen in PR #389 (Option B: compiled build artifact /
  compiled runtime path); design in PR #390; constants registry planning in PR #391; Slice 1
  planning in PR #392. This entry is the **first-use registration** for Slice 1.
- **Scope of Slice 1 (this registration):** register the constants above **and** introduce a minimal
  static build scaffold (`tsconfig.riskworker-artifact.json` + the `build:riskworker-artifact` npm
  script) that makes compiled-artifact creation *possible*. It is **build-scaffold only**.
- **Boundary:** Slice 1 changes **no runtime behavior**. The compiled runtime path is **not active**;
  the existing `tsx` risk-worker run scripts (`risk-evidence:run`, `risk-evidence:record-only`) are
  unchanged; the `RUN` / `PREFLIGHT` / `PARITY` command names are reserved-not-wired. The scaffold
  build is **not run** in the registering PR and emits only into the gitignored `dist/`; no generated
  artifact is committed. Slice 1 executes no worker/classifier/risk-evidence/record-only, performs no
  DB/network/SQL, generates no customer output, moves no Gate D/E, and claims no root cause. The
  sealed risk-worker state (`runtime_dependency_or_build_failure`; `blocked_none_not_classified`;
  `build_surface` / `unknown_build_surface` / `structurally_expected_dual_signal`;
  `runtime_cause_inference=false`) is unchanged and **unblocks no Gate**. Wiring the compiled runtime
  path (RUN), the preflight proof, and the parity proof are later slices under their own review and,
  where server/runtime is touched, a separate exact GO.

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
