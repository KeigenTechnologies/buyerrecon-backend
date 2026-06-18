# BuyerRecon — Configuration Constants Inventory (Registry/Guardrail PR)

**This is a registry/guardrail PR only.** It adds a constants registry
(`config/constants.ts`), human/Claude registries (`.claude/constants.md`,
`.claude/glossary.md`), a local guardrail (`scripts/check-no-raw-constants.mjs` →
`npm run check:constants`), and this inventory. **No source replacement was performed
in this PR** — existing files are intentionally NOT yet migrated to use the constants;
that happens in follow-up PRs, file-by-file.

It changes **no runtime behavior**, no schema/migrations/deploy/env/secrets, and ran
**no** production command, SQL, psql, Stage 0, worker, extractor, or deploy. No secret
values were printed or inspected (only env-var **names** and non-secret identifiers are
registered).

> Inventory captured against base `sprint2-architecture-contracts-d4cc2bf` at
> `e84f8775cfef24ea2e08dfe62fee37558dca7e9a`, over tracked `*.ts`, `*.js`, `*.md`,
> `*.json` (excluding `node_modules` / `.git`).

---

## 1. Method

- Inventory grep (reporting): `git grep -E` over `*.ts *.js *.md *.json`, tracked files
  only.
- Guardrail enforcement (`npm run check:constants`): `git grep -F` over **source code only**
  (`*.ts *.tsx *.js *.jsx *.mjs *.cjs`), exempting the registry/guardrail files.
- **Scope decision (important):** the guardrail enforces over **source code**, not markdown.
  The vast majority of registered-literal hits are in `docs/*.md` evidence/prose (which
  legitimately reference role names and cannot be replaced by TS constants). Enforcing over
  docs would be noisy and non-actionable; the inventory still reports the markdown corpus
  below for visibility.

---

## 2. Total matches by category (reporting grep; tracked files)

| Category pattern | files | hits |
|---|---:|---:|
| `buyerrecon_` | 303 | 2262 |
| `/opt/` | 90 | 156 |
| `https?://` | 64 | 591 |
| `localhost` | 17 | 40 |
| `127.0.0.1` | 33 | 77 |
| `:[0-9]{3,5}` (port-shaped) | 51 | 200 |
| `Stage0` | 50 | 315 |
| `STAGE0` | 170 | 893 |
| `DATABASE_URL` | 159 | 799 |
| `APP_DSN` | 39 | 147 |
| `ADMIN_DSN` | 4 | 12 |
| `RUNNER_DSN` | 50 | 263 |

### 2.1 Registered forbidden literals — total hits (all tracked `*.ts/*.js/*.md/*.json`)

| Literal | total hits | in `.md` (docs/prose) | in code (`.ts/.js`) |
|---|---:|---:|---:|
| `buyerrecon_production` | 352 | ~ majority | (see §3) |
| `buyerrecon_prod_collector_app` | 470 | ~ majority | 1 |
| `buyerrecon_stage0_runner` | 375 | ~ majority | 0 (code) |
| `/opt/buyerrecon-backend` | 155 | ~ majority | 0 (code) |
| `STAGE0_RUNNER_DSN` | 262 | ~ majority | 0 (code) |
| `DATABASE_URL` | 799 | ~ majority | 111 |
| `RouteA` | 0 | 0 | 0 |
| `RouteB` | 0 | 0 | 0 |
| `RouteC` | 0 | 0 | 0 |

- Of the six high-volume literals combined: **2166 hits in `*.md`** vs **112 in `*.ts`** — i.e.
  the registered literals are overwhelmingly **documentation/evidence**, not code.
- By top-level directory (files containing the six literals): `docs/` 276, `scripts/` 17,
  `tests/` 14, `src/` 10.
- `RouteA/RouteB/RouteC` currently have **zero** occurrences anywhere — they are registered
  proactively (route vocabulary) so future code uses the constants from the outset.

---

## 3. Guardrail first-run result (expected current-state failure)

`npm run check:constants` (source-code scope) — **FAILED (exit 1)**, as expected for a
registry/guardrail-first PR. Grouped result:

| Literal | occurrences | files |
|---|---:|---:|
| `buyerrecon_prod_collector_app` | 1 | 1 (`src/db/client.ts`) |
| `DATABASE_URL` | 111 | 41 |
| (all others) | 0 | 0 |
| **Total** | **112** | **41 (union)** |

Top source files to migrate (by `DATABASE_URL` count): `tests/v1/db/_setup.ts` (10),
`scripts/collector-observation-report.ts` (7),
`tests/v1/stage0-record-only-worker.test.ts` (6),
`scripts/poi-sequence-observation-report.ts` (5),
`scripts/poi-sequence-table-observation-report.ts` (5), then a long tail of
`scripts/*observation-report.ts`, `scripts/run-*-worker.ts`, `scripts/extract-*.ts`,
`src/scoring/**/worker.ts`, `src/db/client.ts`, `src/reports/external/safe-claims.ts`,
`src/evidence-review-snapshot/sanitize.ts`, and `tests/**`.

**This failure is expected and is the current-state evidence.** Do **not** fix these in this
PR. Follow-up PRs should replace literals **file-by-file** (e.g. `process.env.DATABASE_URL` →
`process.env[DATABASE_URL_ENV]`, importing from `config/constants.ts`), each re-running
`npm run check:constants`.

---

## 4. Candidate constants

**Registered now** (clearly canonical; present in the inventory):
`PRODUCTION_ENV`, `PRODUCTION_DB_ROLE_COLLECTOR_APP`, `STAGE0_RUNNER_ROLE`,
`PRODUCTION_CHECKOUT_PATH`, `STAGE0_ROUTE_A/B/C`, `STAGE0_LABEL`, `STAGE0_ENV_PREFIX`,
`DATABASE_URL_ENV`, `STAGE0_RUNNER_DSN_ENV` (see `config/constants.ts`).

**Candidates seen in inventory but NOT registered yet (need confirmation):**
- DSN env-var naming variants: `APP_DSN` (147), `ADMIN_DSN` (12), `RUNNER_DSN` (263) — confirm
  canonical names before coining constants.
- URL/endpoint constants (`https?://` 591 hits) — no canonical URL set established.
- Port / host constants (`localhost`, `127.0.0.1`, port-shaped tokens) — production host/port
  are custody-only and must not be hard-coded; `5432` appears only as a negative example.
- Stage 0 run-lock path — referenced in ops docs, canonical value `TBD`.
- Stage 0 runner custody file path `/etc/buyerrecon/stage0-runner.env` — non-secret path,
  secret contents; promote to a constant only if code needs it.

---

## 5. Candidate glossary terms

Registered in `.claude/glossary.md`: `Stage0`, `RouteA`, `RouteB`, `RouteC`, `Option A`,
`Option B`, `Option C`, `auth_or_credential`, `role_missing_or_not_login`, `HELEN GO`,
`run-lock`, `customer output`, `Lane A/B`, `AMS runtime`.

Additional recurring terms worth a future glossary pass (seen across docs): `Option A
binding/auth preflight`, `Step2E`, `Gate 4E` / `Gate 4F`, `RB-ROTATE`, `STAGE0_RUNNER_DSN`
custody/source-of-truth, `production parameter registry`.

---

## 6. Values needing Helen review

- Canonical **URL/endpoint** set (production / canary / API) — `PENDING_REVIEW`.
- Canonical **DSN env-var names** beyond `DATABASE_URL` / `STAGE0_RUNNER_DSN`
  (`APP_DSN`/`ADMIN_DSN`/`RUNNER_DSN`) — `PENDING_REVIEW`.
- Canonical **ports** / whether any host:port belongs in code at all (production DB host/port
  are custody-only) — `PENDING_REVIEW`.
- Stage 0 **run-lock** path — `PENDING_REVIEW` (`TBD` in the production parameter registry).
- Whether the runner **custody file path** should be promoted to a code constant —
  `PENDING_REVIEW`.

---

## 7. Explicit statements

- **No source replacement was performed in this PR.** Existing files still contain their
  current raw literals; none were rewritten to use the new constants.
- **This is a registry/guardrail PR only.** It adds the constants registry, the human/Claude
  registry + glossary, the local `npm run check:constants` guardrail, and this inventory.
- The guardrail's first run **fails by design** (112 source occurrences, 41 files) and that
  failure is recorded here as current-state evidence; follow-up PRs migrate literals
  file-by-file.
- **No runtime behavior changed**; no schema/migration/deploy/env/secret change; **no**
  production command, SQL, psql, Stage 0, worker, extractor, deploy, env mutation, or secret
  inspection occurred. Only non-secret identifiers and env-var **names** are registered.
