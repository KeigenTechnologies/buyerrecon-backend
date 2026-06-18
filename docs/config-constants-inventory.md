# BuyerRecon — Configuration Constants Inventory (Registry/Guardrail)

> **Status refresh (post-PR #294).** The constants-discipline registry + guardrail were
> introduced by **PR #293**; **PR #294** (`6abe7b6ea2cf0474e7f0c68ce474ef018508e0cd`) then
> cleared the final known source violation, and **`npm run check:constants` now passes on the
> base branch** (`sprint2-architecture-contracts-d4cc2bf`). See §3. This doc is the living
> inventory and reflects that current state.

**Origin (PR #293) was a registry/guardrail PR only.** It added a constants registry
(`config/constants.ts`), a human/Claude registry (`.claude/constants.md`), a local guardrail
(`scripts/check-no-raw-constants.mjs` → `npm run check:constants`), and this inventory.
**No glossary** is created here (`.claude/glossary.md` is deferred to a separate follow-up PR).
**PR #293 itself performed no source replacement;** the only flagged source occurrence (a
**comment** in `src/db/client.ts`) was subsequently resolved by **PR #294** (comment-only —
no import/tsconfig/runtime change). Any further broad migration of the candidate terms (§4)
remains a future, per-file effort pending Helen review.

It changes **no runtime behavior**, no schema/migrations/deploy/env/secrets, and ran
**no** production command, SQL, psql, Stage 0, worker, extractor, or deploy. No secret
values were printed or inspected (only env-var **names** and non-secret identifiers are
registered).

> Inventory captured against base `sprint2-architecture-contracts-d4cc2bf` at
> `e84f8775cfef24ea2e08dfe62fee37558dca7e9a`, over tracked `*.ts`, `*.js`, `*.md`,
> `*.json` (excluding `node_modules` / `.git`).

---

## 1. Method

- **Inventory grep (reporting) stays BROAD:** `git grep -E` over `*.ts *.js *.md *.json`,
  tracked files only — scans everything for visibility (§2).
- **Guardrail enforcement (`npm run check:constants`) stays NARROW:** it FAILS (exit 1) only
  on the **four project-unique literals** — `buyerrecon_production`,
  `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`, `/opt/buyerrecon-backend` —
  searched via `git grep -F` over **source code only** (`*.ts *.tsx *.js *.jsx *.mjs *.cjs`),
  exempting the registry/guardrail files.
- **NOT fail conditions (inventory-only, candidate / pending Helen review):** `RouteA`,
  `RouteB`, `RouteC`, `Stage0`, `STAGE0`, `DATABASE_URL`, `STAGE0_RUNNER_DSN`, and any
  `postgres://` / `postgresql://` / DSN-style connection strings. These are reported here only
  (§4, §6, §6.1); they never fail the guardrail in this PR.
- **Scope decision (important):** the guardrail enforces over **source code**, not markdown.
  The vast majority of literal hits are in `docs/*.md` evidence/prose (which legitimately
  reference role names and cannot be replaced by TS constants). Enforcing over docs would be
  noisy and non-actionable; the inventory still reports the markdown corpus below for
  visibility.

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

## 3. Guardrail status (RESOLVED — passes on base after PR #294)

`npm run check:constants` (NARROW: four project-unique literals; source-code scope) —
**PASSES (exit 0)** on the base branch as of PR #294
(`6abe7b6ea2cf0474e7f0c68ce474ef018508e0cd`). Current grouped result:

| Literal (fail condition) | occurrences | files |
|---|---:|---:|
| `buyerrecon_production` | 0 | 0 (docs-only) |
| `buyerrecon_prod_collector_app` | 0 | 0 |
| `buyerrecon_stage0_runner` | 0 | 0 (docs-only) |
| `/opt/buyerrecon-backend` | 0 | 0 (docs-only) |
| **Total** | **0** | **0** |

**Resolved:** the single source occurrence flagged when this registry/guardrail first landed
(PR #293) was `buyerrecon_prod_collector_app` in a **code comment** in `src/db/client.ts`.
**PR #294 cleared the final known source violation** by rewording that comment to reference
the canonical symbol `PRODUCTION_DB_ROLE_COLLECTOR_APP` (pointing to `config/constants.ts`) —
a comment-only change, with no import/tsconfig/runtime change (a real import was not viable
because `config/` is outside `tsconfig` `rootDir: "src"` and there is no path alias). With
that merged, `src/db/client.ts` is **no longer a violation**, and the four enforced
project-unique literals now have **zero** source-code occurrences outside the registry files.

> Historical note: when first introduced (PR #293), the guardrail failed by design with **1**
> source occurrence (`buyerrecon_prod_collector_app` in `src/db/client.ts`); that is now
> resolved by PR #294. An earlier (broad) draft of the guardrail would also have failed on
> `DATABASE_URL` (111 occurrences / 41 files) and the route/Stage0/DSN-name terms; per the
> narrowing decision those are **no longer fail conditions** and are tracked as candidates
> (§4, §6) only.

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

## 5. Candidate glossary terms (for a SEPARATE follow-up PR)

> A project glossary is intentionally **NOT created in this PR**. `.claude/glossary.md` is out
> of scope here and is deferred to a separate follow-up PR. The terms below are recorded as
> candidates only.

Candidate vocabulary: `Stage0`, `RouteA`, `RouteB`, `RouteC`, `Option A`, `Option B`,
`Option C`, `auth_or_credential`, `role_missing_or_not_login`, `HELEN GO`, `run-lock`,
`customer output`, `Lane A/B`, `AMS runtime`. Additional recurring terms seen across docs:
`Option A binding/auth preflight`, `Step2E`, `Gate 4E` / `Gate 4F`, `RB-ROTATE`,
`STAGE0_RUNNER_DSN` custody/source-of-truth, `production parameter registry`.

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

### 6.1 Raw DSN / connection strings (inventory-only; NO secret values recorded)

`postgres://` / `postgresql://` connection strings exist in the repo. They are **inventory-only
candidates pending Helen review** and are **never** a guardrail fail condition. **No secret or
password values from inside any connection string were printed, copied, or stored** — only the
fact that raw DSN strings exist and their file locations (counts) are recorded:

| metric | value |
|---|---:|
| files containing a `postgres(ql)://` string (`*.ts/*.js/*.md/*.json`) | 47 |
| total occurrences | 81 |
| of which in `docs/` (prose/evidence) | 36 files |
| of which in `tests/` | 11 files |
| in source/test code globs (`*.ts/...`) | 12 files |

- Many such strings are placeholder/shape-only DSNs (e.g. `postgresql://<role>:<PASSWORD>@<HOST>:<PORT>/<db>`)
  in docs; some are local test DSNs. **This inventory records presence + location only**; it
  does **not** reproduce any DSN line, host, port, user, or password.
- Action (deferred): Helen review to decide which (if any) DSN handling belongs behind
  constants vs. custody; no change in this PR.

---

## 7. Explicit statements

- **No source replacement was performed in the original registry PR (PR #293).** That PR added
  the registry/guardrail/inventory only; the one source occurrence it flagged was later
  resolved by **PR #294** (comment-only — see §3).
- **The registry/guardrail itself adds** `config/constants.ts`, the human/Claude registry
  `.claude/constants.md`, the local `npm run check:constants` guardrail, and this inventory.
  **No glossary** is created (`.claude/glossary.md` is deferred to a separate follow-up PR).
- The guardrail is **narrow**: it fails only on the four project-unique literals
  (`buyerrecon_production`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`,
  `/opt/buyerrecon-backend`). It first landed (PR #293) failing by design on **1** source
  occurrence (`buyerrecon_prod_collector_app` in `src/db/client.ts`); **PR #294 resolved it**,
  and `npm run check:constants` now **passes on base** with **0** source violations (§3).
- All other terms (`RouteA/B/C`, `Stage0`, `STAGE0`, `DATABASE_URL`, `STAGE0_RUNNER_DSN`) and
  raw DSN/connection strings are **inventory-only candidates pending Helen review**, never fail
  conditions.
- **No runtime behavior changed**; no schema/migration/deploy/env/secret change; **no**
  production command, SQL, psql, Stage 0, worker, extractor, deploy, env mutation, or secret
  inspection occurred. **No secret/password values were printed or stored** — only non-secret
  identifiers, env-var **names**, and DSN presence/locations are recorded.
