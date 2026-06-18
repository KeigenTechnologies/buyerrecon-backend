# BuyerRecon — Project Glossary (Canonical Vocabulary)

Canonical meanings for recurring operational vocabulary. This glossary fixes
terminology so it is not re-spelled or re-scoped (drift). It records **meaning** and
**what each term does NOT authorize** — it introduces **no new operational
permissions**. Authorizations come only from explicit Helen GOs and the gated process,
never from this file.

See also: `.claude/constants.md` (registered literals) and `config/constants.ts`
(machine-consumed constants).

---

## Stage0

- **Meaning:** The first scoring stage (`Stage0` / `STAGE0`), run via `npm run stage0:run`
  (`tsx scripts/run-stage0-worker.ts`) under the dedicated runner role.
- **Does NOT authorize:** running Stage 0. Stage 0 execution is **separately GO-gated** and
  is not authorized by any registry/glossary/planning artifact.
- **Forbidden aliases / drift:** `stage 0`, `stage-0`, `S0`, `stage_zero`. Use `Stage0` /
  `STAGE0` per `config/constants.ts`.

## RouteA

- **Meaning:** The category-only **classifier** route over the already-withheld auth-failure
  output (classifies the failure family secret-safely; no raw output printed).
- **Does NOT authorize:** fixing anything, proving live auth, or Stage 0 readiness; it only
  classifies.
- **Forbidden aliases / drift:** `route_a`, `route-a`, `A`, "the classifier route" as a
  rename. Use `RouteA`.

## RouteB

- **Meaning:** The **custody/credential re-confirmation** route (e.g. checking DB password vs
  custody DSN alignment), secret-safe.
- **Does NOT authorize:** credential rotation, custody write, or any mutation by itself; it is
  diagnostic and separately GO-gated.
- **Forbidden aliases / drift:** `route_b`, `route-b`, `B`, "password route". Use `RouteB`.

## RouteC

- **Meaning:** The **role / connection-policy diagnostics** route (booleans/categories only:
  role existence, LOGIN, VALID UNTIL, connection limit, connect privilege, connection/SSL
  policy category).
- **Does NOT authorize:** altering roles/grants/policy, raw `pg_hba`/host/port disclosure, or
  any fix; it is diagnostic and separately GO-gated.
- **Forbidden aliases / drift:** `route_c`, `route-c`, `C`, "policy route". Use `RouteC`.

## Option A

- **Meaning:** The binding/auth path that loads the runner DSN and performs the live-auth
  preflight as the Stage 0 runner.
- **Does NOT authorize:** Stage 0, Step 2E, or remediation; a passing/failing preflight is
  evidence only. Each run is separately GO-gated.
- **Forbidden aliases / drift:** `OptA`, `option-a`, "binding route". Use `Option A`.

## Option B

- **Meaning:** A separately GO-gated **credential rotation + custody alignment** correction
  route (rotate the runner password and write the matching custody DSN, secret-safe).
- **Does NOT authorize:** execution by itself; rotation/custody write require a fresh explicit
  GO and never print/store the secret value.
- **Forbidden aliases / drift:** `OptB`, `option-b`, "rotation route" as a rename. Use
  `Option B`.

## Option C

- **Meaning:** A DBA/admin-handoff correction route (an authorized operator sets the runner
  credential/custody), evidence recorded as safe labels only.
- **Does NOT authorize:** execution by itself; the handoff and any follow-up are separately
  GO-gated.
- **Forbidden aliases / drift:** `OptC`, `option-c`. Use `Option C`.

## auth_or_credential

- **Meaning:** The safe failure-classification family for a Stage 0 psql/auth failure
  (authentication/credential category), used without exposing raw error text.
- **Does NOT authorize:** any credential action, rotation, or Stage 0; it is a category label,
  not a fix or a readiness proof.
- **Forbidden aliases / drift:** `auth/credential`, `auth-or-cred`, `credential_error`. Use
  `auth_or_credential` verbatim.

## role_missing_or_not_login

- **Meaning:** The RouteA allowlisted class indicating the failure is consistent with the
  runner role not existing or not being permitted to log in (role-existence / LOGIN /
  role-policy family).
- **Does NOT authorize:** any role change, GRANT, or proof of exact role state; it steers
  toward RouteC diagnostics only.
- **Forbidden aliases / drift:** `role_missing`, `no_login`, `login_disabled` (the latter is a
  distinct RouteC `route_c_result` value). Use `role_missing_or_not_login` verbatim.

## HELEN GO

- **Meaning:** An explicit, scoped authorization issued by Helen for exactly one named action
  (e.g. a specific preflight/classifier/diagnostic/merge), with stated bounds.
- **Does NOT authorize:** anything beyond its exact stated scope; approval of one step never
  extends to the next, to reruns, or to Stage 0.
- **Forbidden aliases / drift:** `GO`, "Helen approved", implied/standing GO. A GO must be
  explicit and per-action.

## run-lock

- **Meaning:** The Stage 0 run-lock guarding single execution (its canonical path is `TBD` in
  the production parameter registry).
- **Does NOT authorize:** touching/acquiring/releasing it; no current step touches the
  run-lock, and doing so is separately gated.
- **Forbidden aliases / drift:** `runlock`, `lock file`, ad-hoc lock paths. Resolve the
  canonical path before any use.

## customer output

- **Meaning:** Customer-facing report / output produced by downstream scoring (Lane/AMS), the
  end artifact — distinct from internal evidence/diagnostics.
- **Does NOT authorize:** producing it; current Stage 0 auth-investigation work emits none and
  authorizes none. Customer output is downstream of Stage 0 readiness.
- **Forbidden aliases / drift:** `customer report`, `customer-facing output` used to blur
  internal evidence vs. customer artifacts. Keep them distinct; never put customer/row data in
  evidence docs.

## Lane A/B

- **Meaning:** Downstream scoring lanes (Lane A / Lane B) in the scoring pipeline, beyond
  Stage 0.
- **Does NOT authorize:** running lanes, scoring, AMS, or any Lane A/B / Gate 4E / Gate 4F
  action; all are out of scope for Stage 0 auth investigation and separately gated.
- **Forbidden aliases / drift:** `LaneA/LaneB`, `lane-a`, `lanes`. Use `Lane A` / `Lane B`.

## AMS runtime

- **Meaning:** The downstream AMS (scoring/output) runtime that consumes scoring results.
- **Does NOT authorize:** invoking AMS, downstream runtime, or customer output; none of the
  current Stage 0 steps touch AMS.
- **Forbidden aliases / drift:** `AMS`, `ams-runtime`, "the runtime" generically. Keep "AMS
  runtime" distinct from Stage 0 worker runtime.
