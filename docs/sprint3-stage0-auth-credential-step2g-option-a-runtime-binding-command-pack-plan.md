# Sprint 3 — Stage 0 auth/credential Step 2G — Option A Runtime-Binding Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_RUNTIME_BINDING_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It designs the **future Option A
runtime-binding command pack** — how the existing S2 custody source
(`/etc/buyerrecon/stage0-runner.env`, key `STAGE0_RUNNER_DSN`, present and guarded per
PR #247, value unverified by design) would be **bound to one future Stage 0
binding/auth preflight invocation, with no code change** — recommended (planning only)
by PR #248.

This PR **executes nothing** and **authorizes no binding / auth gate / code change**: no
Option A execution, no runtime binding, no runner DSN binding, no authentication/psql
gate, no DB connection, no `psql`/SQL, no source-selection change, no Option B code
change, no secret value read/print/parse/log/expose, no `.env.production` read/print, no
Step 2E rerun, no Stage 0, no run-lock touch, no remediation, no runtime/downstream/
Lane/scoring/AMS/customer action. No real DSN, password, token, host, port, IP, or URI
appears in this document.

> Provenance: PR #248 Option A/B binding decision plan
> (`6aa74be2b1e6b6eebe963be2a2f44e8669e829dd`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_AB_BINDING_DECISION_PLANNING_ONLY`); PR #247 S2
> presence proof present (`609fa182a732961cf87c86a6dbe2d23d8dbe5c15`); PR #246 S2 creation
> applied (`7d71f309525a30cfe28e464c9697579c0daa4ecd`); PR #245 S2 command-pack plan
> (`dc5a6cfcc4227d2fb03df72b82dd4507bbbe7f6d`).

---

## 1. Status

`STAGE0_AUTH_CREDENTIAL_STEP2G_OPTION_A_RUNTIME_BINDING_COMMAND_PACK_PLANNING_ONLY` —
docs-only; designs the candidate command pack only; authorizes and executes nothing.

---

## 2. Evidence Carried Forward (PR #248 / #247)

- S2 custody source **exists**: `/etc/buyerrecon/stage0-runner.env`.
- Key **`STAGE0_RUNNER_DSN` present**; expected **owner/permissions proven** (`root:root`,
  `600`).
- **Secret value remains unread and unverified by design.**
- **Option A recommended** as the smallest safe next planning branch (PR #248); **Option
  B remains the deferred fallback** (code change).
- **No runtime binding**, **no authentication/psql gate**, **no Step 2E rerun**, **no
  Stage 0** has occurred.

---

## 3. Option A Command-Pack Purpose

Design (planning only) how a **future, separately GO-gated** Option A run would:
- use the existing S2 custody file **only for one future Stage 0 binding/auth preflight**;
- load `STAGE0_RUNNER_DSN` into the future Stage 0 process environment in an
  **invocation-scoped** way;
- bind it to the process as `DATABASE_URL` **only inside that future command
  invocation**, **if** that is the required current Stage 0 source path;
- **not** change code; **not** persistently mutate `.env.production`; **not**
  print/read/parse/log/expose the secret value;
- **not** run in this PR.

---

## 4. Candidate Command-Pack Design

> **CANDIDATE ONLY — DO NOT RUN.** The following is a design sketch for review, **not** a
> runnable command and **not** authorization to run anything. The secret value is loaded
> **only** into an invocation-scoped shell variable and is **never** printed, echoed,
> `cat`/`grep`/`env`/`printenv`-ed, parsed, logged, or placed where it could leak; all
> variables are unset on every exit path.

```bash
# CANDIDATE ONLY — DO NOT RUN
# (illustrative shape; a real run is separately reviewed + GO-gated)

set -eu            # NOTE: never set -x (would echo the secret)

# --- §6 preflight gates (booleans only; abort/fail-closed on any mismatch) ---
#  - confirm repo path /opt/buyerrecon-backend
#  - confirm branch/base contains the PR #248 merge
#  - confirm working tree clean
#  - confirm custody file exists, owner expected, permissions expected
#  - confirm key name STAGE0_RUNNER_DSN present (name only; value never read)
#  - confirm `stage0:run` mapping matches expected BEFORE any binding

# --- invocation-scoped hidden load (value never printed) ---
# Source the custody file in a subshell scope so the value lives only here:
# (no echo; no set -x; value never emitted)
set -a
. /etc/buyerrecon/stage0-runner.env      # defines STAGE0_RUNNER_DSN in-scope only
set +a
[ -n "${STAGE0_RUNNER_DSN:-}" ] || { echo "stop_line=stage0_runner_dsn_empty"; exit 2; }
echo "runner_source_loaded=true"          # boolean only — never the value

# --- bind to the Stage 0 source path for ONE future preflight invocation ONLY ---
# If the current Stage 0 source path is DATABASE_URL, bind invocation-scoped:
#   DATABASE_URL="$STAGE0_RUNNER_DSN" <future binding/auth preflight command>
# (value passed in-memory to the child env only; never printed; prefer env over argv
#  so the DSN does not appear in process argv/`ps`)

# --- always unset on every exit path ---
trap 'unset STAGE0_RUNNER_DSN DATABASE_URL 2>/dev/null || true' EXIT INT TERM
```

> The actual **binding/auth preflight command** is **out of scope for this plan** and is
> a **separate, GO-gated** step; this sketch shows only the **secret-safe load + scoped
> bind shape**, not an auth/psql gate.

---

## 5. Secret-Safety Discipline

The future Option A run **must**:
- use **no `set -x`**;
- **never echo** the value;
- **never print env** (`env` / `printenv` / `set` dumps forbidden);
- produce **no `env` / `printenv` / `cat` / `grep` output of the value**;
- perform **no DSN parsing**;
- output **no host / port / IP / user / password / component**;
- **avoid exposing the DSN in process argv** where possible (prefer env-to-child over
  argv);
- use the value **only inside an invocation-scoped shell variable**;
- **unset variables on all exits** (`trap ... EXIT INT TERM`);
- if any future auth preflight produces raw output, that output goes to a **`chmod 600`
  temp** and is **withheld** unless an allowlist explicitly permits a safe label.

---

## 6. Preflight Gates (all must hold before any future binding)

- repo path is `/opt/buyerrecon-backend`;
- branch/base **contains the PR #248 merge**;
- **working tree clean**;
- **custody file exists**;
- **owner is expected** (`root:root`);
- **permissions are expected** (`600`);
- **key name `STAGE0_RUNNER_DSN` is present** (name only; value never read);
- **`stage0:run` mapping verified** (matches expected) **before any future binding**.

---

## 7. Stop-Lines (fail-closed)

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- **missing custody file**;
- **owner / permissions not expected**;
- **key missing**;
- the **source value would need to be printed / read / parsed**;
- the command would **expose the DSN in argv / logs**;
- **`.env.production` would be read / printed**;
- **`stage0:run` mapping differs** from expected;
- any **DB / psql before an explicit auth-gate GO**;
- any **Step 2E / Stage 0 / run-lock / runtime** action before a separate GO.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 8. Future Proof / Evidence Labels (for the Option A binding/auth preflight, when GO-gated)

> The future GO-gated run will emit safe booleans/tokens only — **no raw values** — e.g.:

```text
option_a_binding_preflight_attempted=true
repo_path_ok=true|false
base_contains_pr248=true|false
working_tree_clean=true|false
custody_file_exists=true|false
custody_owner_ok=true|false
custody_permissions_ok=true|false
stage0_runner_dsn_key_present=true|false
stage0_run_mapping_ok=true|false
runner_source_loaded=true|false
dsn_value_printed=false
dsn_in_argv=false
env_production_values_read=false
auth_psql_gate_executed=false
stage0_executed=false
option_a_binding_preflight_result=<allowlisted>
stop_line=<none|...>
```

---

## 9. Safe Labels (this plan)

```text
option_a_command_pack_planning_only=true
s2_custody_source_present=true
s2_secret_value_verified=false
option_a_runtime_binding_recommended=true
option_a_command_pack_candidate_only=true
option_a_executed=false
runtime_binding_performed=false
runner_dsn_bound=false
auth_psql_gate_executed=false
db_connection_attempted=false
psql_sql_invoked=false
source_selection_changed=false
option_b_code_changed=false
step2e_rerun=false
stage0_executed=false
run_lock_touched=false
```

---

## 10. Non-Authorization

**This PR plans the command pack only.** It must not (and does not) perform: Option A
execution, runtime binding, an authentication/psql gate, a DB connection, psql/SQL, a
Step 2E rerun, Stage 0, a run-lock touch, a source-selection change, an Option B code
change, remediation, or a downstream runtime action.

**Merging this plan authorizes none of the above.** The Option A binding/auth preflight
is a **future, separately-reviewed, separately GO-gated** step requiring its own Codex
review and a fresh explicit Helen GO. **Stage 0 execution remains separately GO-gated.**

---

## 11. Next Gated Step

1. **Codex review** of this command-pack planning PR, then **merge**.
2. **Fresh explicit Helen GO** for **one** Option A binding/auth preflight only
   (secret-safe per §5; preflight gates §6; stop-lines §7; safe labels §8).
3. Docs-only **Option A binding/auth preflight evidence PR** (safe labels only).
4. **Only then** decide whether **Step 2E / Stage 0** planning can continue, or whether
   to **fall back to Option B** (its own separately-reviewed code-change PR with tests +
   source-diff + Codex review).
5. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, generated secret, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or
customer data. The candidate command-pack (CANDIDATE ONLY — DO NOT RUN) loads the secret
**only** into an invocation-scoped shell variable, **never** prints/echoes/`cat`/`grep`/
`env`/`printenv`/parses/logs it, prefers env-to-child over argv, and unsets on every
exit; any future auth-preflight raw output goes to a `chmod 600` temp and is withheld.
The custody **file path** (`/etc/buyerrecon/stage0-runner.env`), **key name**
(`STAGE0_RUNNER_DSN`), and the variable name `DATABASE_URL` are non-secret identifiers,
not values; the value remains **unverified by design**. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / non-secret path & name
identifiers / public git commit hashes — not secret or row values.
