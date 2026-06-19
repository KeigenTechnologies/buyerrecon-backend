# BuyerRecon — Project Glossary (Canonical Vocabulary)

Second governance layer (concept vocabulary), complementing the constants registry
(`config/constants.ts` + `.claude/constants.md`). Purpose: reduce **concept drift** across
PRs, docs, Claude, Codex review, and operator reports by fixing canonical meanings.

## Governance rules (read first)

- This glossary is for **concept definitions only**.
- It **does not authorize production execution**.
- It **does not override PR evidence** (a merged evidence PR is the source of truth for what
  happened).
- It **does not override the constants registry** (`config/constants.ts` /
  `.claude/constants.md` govern literals).
- Definitions are **state summaries, not commands**.
- New definitions are **append-only** unless explicitly superseding old wording.
- If a definition changes materially, mark the prior wording **Superseded** instead of
  silently rewriting history.
- Uncertain terms must be marked **PENDING_HELEN_REVIEW** (do not guess).
- **Do not invent operational permissions.**
- **Do not** treat the glossary's presence as permission to run Stage 0, SQL, psql, workers,
  extractors, Lane/scoring, AMS runtime, deploys, or customer output.

> Not enforced by `check:constants`: this glossary is **not** part of the constants guardrail
> and adds **no** fail conditions. It grants **no** execution authorization. Authorization
> comes only from explicit Helen GOs and the gated process.

Each entry: **Canonical name · Meaning · Does NOT authorize · Forbidden aliases / drift risks ·
Current status · Review status (CONFIRMED | PENDING_HELEN_REVIEW)**.

---

## Stage0

- **Meaning:** The first scoring stage (`Stage0` / `STAGE0`), run via `npm run stage0:run`
  (`tsx scripts/run-stage0-worker.ts`) under the dedicated runner role.
- **Does NOT authorize:** running Stage 0. Stage 0 execution is **separately GO-gated**.
- **Forbidden aliases / drift:** `stage 0`, `stage-0`, `S0`, `stage_zero`. Use `Stage0` /
  `STAGE0`.
- **Current status:** Stage 0 execution remains separately GO-gated; not run.
- **Review status:** CONFIRMED.

## Route A

- **Meaning:** The category-only **classifier** route over the already-withheld auth-failure
  output (classifies the failure family secret-safely; no raw output printed).
- **Does NOT authorize:** fixing anything, proving live auth, or Stage 0 readiness — it only
  classifies.
- **Forbidden aliases / drift:** `route_a`, `route-a`, `A`, "the classifier route" as a
  rename. Use `Route A` / `RouteA`.
- **Current status:** Run once; classified `role_missing_or_not_login` (PR #291).
- **Review status:** CONFIRMED.

## Route B

- **Meaning:** The **custody/credential re-confirmation** route (e.g. checking DB password vs
  custody DSN alignment), secret-safe.
- **Does NOT authorize:** credential rotation, custody write, or any mutation by itself;
  diagnostic and separately GO-gated.
- **Forbidden aliases / drift:** `route_b`, `route-b`, `B`, "password route". Use `Route B` /
  `RouteB`.
- **Current status:** Not selected (Route A pointed to Route C, not Route B).
- **Review status:** CONFIRMED.

## Route C

- **Meaning:** The **role / connection-policy diagnostics** route (booleans/categories only:
  role existence, LOGIN, VALID UNTIL, connection limit, connect privilege, connection/SSL
  policy category).
- **Does NOT authorize:** altering roles/grants/policy, raw `pg_hba`/host/port disclosure, or
  any fix; diagnostic and separately GO-gated.
- **Forbidden aliases / drift:** `route_c`, `route-c`, `C`, "policy route". Use `Route C` /
  `RouteC`.
- **Current status:** Recommended next route after PR #291; Route C planning is proposed in
  open PR #292 and is not authoritative until reviewed/merged; not yet run.
- **Review status:** CONFIRMED.

## Option A

- **Meaning:** The binding/auth path that loads the runner DSN and performs the live-auth
  preflight as the Stage 0 runner.
- **Does NOT authorize:** Stage 0, Step 2E, or remediation; a passing/failing preflight is
  evidence only. Each run is separately GO-gated.
- **Forbidden aliases / drift:** `OptA`, `option-a`, "binding route". Use `Option A`.
- **Current status:** Last run AUTH_FAILED, raw withheld (PR #284); `live_auth_proven=false`.
- **Review status:** CONFIRMED.

## Option B

- **Meaning:** A separately GO-gated **credential rotation + custody alignment** correction
  route (rotate the runner password and write the matching custody DSN, secret-safe).
- **Does NOT authorize:** execution by itself; rotation/custody write require a fresh explicit
  GO and never print/store the secret value.
- **Forbidden aliases / drift:** `OptB`, `option-b`, "rotation route" as a rename. Use
  `Option B`.
- **Current status:** An RB-ROTATE rotation+custody-write was applied (PR #282); live auth not
  yet proven.
- **Review status:** CONFIRMED.

## Option C

- **Meaning:** A DBA/admin-handoff correction route (an authorized operator sets the runner
  credential/custody), evidence recorded as safe labels only.
- **Does NOT authorize:** execution by itself; the handoff and any follow-up are separately
  GO-gated.
- **Forbidden aliases / drift:** `OptC`, `option-c`. Use `Option C`.
- **Current status:** Not used.
- **Review status:** CONFIRMED.

## auth_or_credential

- **Meaning:** The safe failure-classification family for a Stage 0 psql/auth failure
  (authentication/credential category), used without exposing raw error text.
- **Does NOT authorize:** any credential action, rotation, or Stage 0; it is a category label,
  not a fix or readiness proof.
- **Forbidden aliases / drift:** `auth/credential`, `auth-or-cred`, `credential_error`. Use
  `auth_or_credential` verbatim.
- **Current status:** Unresolved at the live-auth level; narrowed by Route A to
  `role_missing_or_not_login`.
- **Review status:** CONFIRMED.

## role_missing_or_not_login

- **Meaning:** The Route A allowlisted class indicating the failure is consistent with the
  runner role not existing or not being permitted to log in (role-existence / LOGIN /
  role-policy family).
- **Does NOT authorize:** any role change, GRANT, or proof of exact role state; it steers
  toward Route C diagnostics only.
- **Forbidden aliases / drift:** `role_missing`, `no_login`; note `login_disabled` is a
  distinct Route C `route_c_result` value. Use `role_missing_or_not_login` verbatim.
- **Current status:** Route A classifier result of record (PR #291).
- **Review status:** CONFIRMED.

## HELEN GO

- **Meaning:** An explicit, scoped authorization issued by Helen for exactly one named action,
  with stated bounds.
- **Does NOT authorize:** anything beyond its exact stated scope; approval of one step never
  extends to the next, to reruns, or to Stage 0.
- **Forbidden aliases / drift:** `GO`, "Helen approved", implied/standing GO. A GO must be
  explicit and per-action.
- **Current status:** Governance convention in continuous use.
- **Review status:** CONFIRMED.

## run-lock

- **Meaning:** The Stage 0 run-lock guarding single execution.
- **Does NOT authorize:** touching, creating, deleting, acquiring, releasing, bypassing, or
  mutating run-lock state; no current step touches the run-lock, and doing so is separately gated.
- **Forbidden aliases / drift:** `runlock`, `lock file`, ad-hoc lock paths.
- **Current status:** Concept known. **Canonical run-lock path: PENDING_HELEN_REVIEW** (tracked
  as `TBD` in the production parameter registry; resolve before any use).
- **Review status:** CONFIRMED (concept); canonical path **PENDING_HELEN_REVIEW**.

## customer output

- **Meaning:** Customer-facing report / output produced by downstream scoring (Lane/AMS), the
  end artifact — distinct from internal evidence/diagnostics.
- **Does NOT authorize:** producing it; current Stage 0 auth-investigation work emits none and
  authorizes none. Customer output is downstream of Stage 0 readiness.
- **Forbidden aliases / drift:** `customer report`, `customer-facing output` used to blur
  internal evidence vs. customer artifacts. Never put customer/row data in evidence docs.
- **Current status:** None produced; not authorized.
- **Review status:** CONFIRMED.

## Lane A/B

- **Meaning:** BuyerRecon downstream **scoring/output lane** concepts (`Lane A` / `Lane B`) in
  the scoring pipeline, beyond Stage 0. The **precise A-vs-B distinction is not crisply defined
  in current repo docs** (referenced e.g. by a lane-ab preview report).
- **Refinement (glossary follow-up):** clarified that `Lane A/B` denotes BuyerRecon
  scoring/output lane concepts, and that glossary presence does **not** authorize lane writes,
  scoring runtime, customer output, or production execution. The A-vs-B semantics remain
  unresolved; this is a clarification, not a material change of meaning.
- **Does NOT authorize:** running lanes, lane writes, scoring runtime, AMS, customer output,
  production execution, or any Lane A/B / Gate 4E / Gate 4F action; all out of scope for Stage 0
  auth investigation and separately gated.
- **Forbidden aliases / drift:** `LaneA/LaneB`, `lane-a`, `lanes`. Use `Lane A` / `Lane B`.
- **Current status:** Out of scope for current work; not run.
- **Review status:** PENDING_HELEN_REVIEW (precise A-vs-B semantics not safely known from
  current docs).

## AMS runtime

- **Meaning:** The downstream/related **"AMS" scoring-output runtime boundary** that consumes
  scoring results — an external/related runtime distinct from the Stage 0 worker runtime. The
  **exact expansion/definition of "AMS" is not safely established in current repo docs.**
- **Refinement (glossary follow-up):** clarified that AMS runtime is an external/related runtime
  boundary, and that glossary presence does **not** authorize AMS Trust/Pass runtime, integration
  execution, customer output, or deploy. The acronym expansion remains unresolved; this is a
  clarification, not a material change of meaning.
- **Does NOT authorize:** invoking AMS, AMS Trust/Pass runtime, integration execution, downstream
  runtime, customer output, or deploy; none of the current Stage 0 steps touch AMS.
- **Forbidden aliases / drift:** `AMS`, `ams-runtime`, "the runtime" generically. Keep "AMS
  runtime" distinct from the Stage 0 worker runtime.
- **Current status:** Out of scope for current work; not invoked.
- **Review status:** PENDING_HELEN_REVIEW (acronym expansion / precise definition not safely
  known).

## Step2E

- **Meaning:** A post-fix diagnostic/checkpoint label in the Stage 0 auth/credential
  investigation sequence (referenced alongside Option A as a separately-gated follow-up step).
  Exact definition is not safely established in current repo docs.
- **Does NOT authorize:** diagnostic execution, psql, SQL, Stage 0, credential changes, env
  mutation, or production access; it is a label, not a command.
- **Forbidden aliases / drift:** `Step 2E`, `step2e`, `2E`, "the post-fix step" as a rename. Use
  `Step2E`.
- **Current status:** Out of scope for current work; not run.
- **Review status:** PENDING_HELEN_REVIEW (exact definition not safely known from current docs).

## Gate 4E / Gate 4F

- **Meaning:** Named process/checkpoint gate labels (`Gate 4E`, `Gate 4F`) referenced in the
  downstream Lane/scoring context. Their exact definitions and pass/fail criteria are not safely
  established in current repo docs.
- **Does NOT authorize:** gate execution, customer output, Lane/scoring, AMS runtime, deploy, or
  any production action; they are labels, not commands.
- **Forbidden aliases / drift:** `Gate4E`, `gate-4e`, `4E`, `Gate4F`, `gate-4f`, `4F`. Use
  `Gate 4E` / `Gate 4F`.
- **Current status:** Out of scope for current work; not run.
- **Review status:** PENDING_HELEN_REVIEW (exact definitions not safely known from current docs).

## RB-ROTATE

- **Meaning:** An operator confirmation token/label used in the Route B credential-rotation
  command-pack context (associated with the Option B rotation+custody-write evidence trail, PR
  #282). Exact semantics are not safely established in current repo docs.
- **Does NOT authorize:** credential rotation, password reset, custody write, secret read,
  SQL/psql, or any production action; it is a label, not a command, and never a stored/printed
  secret value.
- **Forbidden aliases / drift:** `RB_ROTATE`, `rb-rotate`, `ROTATE`. Use `RB-ROTATE`.
- **Current status:** Historical evidence reference (PR #282); not re-run.
- **Review status:** PENDING_HELEN_REVIEW (exact semantics not safely known from current docs).

## Option A binding/auth preflight

- **Meaning:** The preflight check path for Stage 0 runner binding/auth classification (the
  live-auth preflight described under `Option A`); it is **not** Stage 0 execution. Exact
  standalone semantics are not safely established in current repo docs.
- **Does NOT authorize:** runner source loading, DSN binding, psql/auth rerun, Stage 0, env
  mutation, remediation, or any production action; a passing/failing preflight is evidence only.
- **Forbidden aliases / drift:** `Option A preflight`, `binding preflight`, "the preflight"
  generically. Keep distinct from Stage 0 execution and from `Option A` the route concept.
- **Current status:** Out of scope for current work; not run. See `Option A` (CONFIRMED) for the
  route concept this preflight belongs to.
- **Review status:** PENDING_HELEN_REVIEW (exact standalone semantics not safely known from
  current docs).

## constants guardrail

- **Meaning:** The local check `npm run check:constants` (`scripts/check-no-raw-constants.mjs`)
  that fails when a registered **project-unique** literal appears raw in **source code** rather
  than imported from `config/constants.ts`.
- **Does NOT authorize:** anything operational; it is a lint-style local check, not CI and not
  a permission. It does **not** include glossary terms.
- **Forbidden aliases / drift:** "the linter", "CI check" (there is no CI). Use "constants
  guardrail" / `check:constants`.
- **Current status:** Enforces exactly four project-unique literals
  (`buyerrecon_production`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`,
  `/opt/buyerrecon-backend`); **passes on base** (PR #293 introduced, PR #294 cleared the last
  violation).
- **Review status:** CONFIRMED.

## broad inventory / narrow guardrail

- **Meaning:** The deliberate split: the **inventory** (`docs/config-constants-inventory.md`)
  scans broadly (`*.ts/*.js/*.md/*.json`) for visibility, while the **guardrail** enforces
  narrowly (only the four project-unique literals, over source-code globs). Generic vocabulary
  / env-var-name terms and DSN/connection strings are inventory-only candidates, never fail
  conditions.
- **Does NOT authorize:** broadening enforcement without review; promoting a candidate to a
  fail condition is a separate, reviewed decision.
- **Forbidden aliases / drift:** treating every inventory hit as a violation; conflating
  "candidate" with "enforced".
- **Current status:** Established by PR #293; reaffirmed by PR #295.
- **Review status:** CONFIRMED.

---

## Pending Helen review (summary)

- **Lane A/B** — precise A-vs-B semantics.
- **AMS runtime** — acronym expansion / precise definition.
- **run-lock** — canonical run-lock path (`TBD` in the production parameter registry).
- **Step2E** — exact definition.
- **Gate 4E / Gate 4F** — exact definitions / pass-fail criteria.
- **RB-ROTATE** — exact semantics.
- **Option A binding/auth preflight** — exact standalone semantics.

All other terms above are CONFIRMED from current repo docs/evidence. This glossary defines
concepts only; it is not part of `check:constants` and authorizes no execution.
