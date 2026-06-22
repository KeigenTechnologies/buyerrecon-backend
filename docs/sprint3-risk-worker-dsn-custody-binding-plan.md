# Sprint 3 — RISK_WORKER_DSN Custody / Binding — Planning (Docs-Only)

**Status:** `RISK_WORKER_DSN_CUSTODY_BINDING_PLANNING_ONLY`

This is a **docs-only planning record**. It defines the **approved custody /
binding shape** for `RISK_WORKER_DSN` — the secret connection value the first
bounded internal risk-worker run (planned in PR #328) will need — and the future
proof labels and stop-lines. It plans custody/binding **only**.

This PR **executes nothing** and **handles no secret value**: it does **not**
create/write/read/print/parse/validate/transform any DSN value, does **not**
create or edit any secret file, does **not** run the risk worker, run production
commands, run SQL/psql, mutate the DB, change roles/grants, run
Stage0/Step2E/Route C, run downstream extractors, run Lane/scoring, run AMS
runtime, produce customer output, or authorize Gate4E/Gate4F.

> Provenance of required base: `135a2ba8ae2ec0750c8295f011653a6666da6ede` on
> `sprint2-architecture-contracts-d4cc2bf` (includes PR #325 create/grant/proof
> PASS, PR #326 role registration, PR #327 readiness PASS, PR #328 first-run
> command-pack planning).

---

## 1. Secret-handling rules for `RISK_WORKER_DSN`

- `RISK_WORKER_DSN` **is a secret value.** It must **never** be committed,
  printed, echoed, logged, passed in argv, pasted into chat, rendered into docs,
  or exposed in terminal output.
- **Only the env-var NAME `RISK_WORKER_DSN`** may appear in docs/commands — never
  its value, and never any host, port, username, password, database name, URI,
  or DSN component derived from it.
- The value will be **bound to `DATABASE_URL` only inside the future worker
  execution shell**, because the existing risk-worker command
  (`npm run risk-evidence:run` → `tsx scripts/run-risk-evidence-worker.ts`, per
  PR #328) connects via `DATABASE_URL`.
- `DATABASE_URL` must receive the **risk-worker DSN** — **not** the collector,
  Stage0, `postgres`, `buyerrecon_app`, or any admin DSN.
- `buyerrecon_risk_worker` is the **intended runtime DB role identity** for the
  worker (registered, registered-not-enforced, per PR #326; readiness-proven per
  PR #327).
- **This PR does not prove the DSN exists** and **does not authorize execution.**
- A **future separate GO** must prove **only** custody source/key **presence**
  and **safe binding shape** — never the value — before the first run.

---

## 2. Allowed custody source categories (planning)

The future custody source must be exactly one of:

| Category | Meaning |
| --- | --- |
| `root_only_env_file` | A root-owned (or approved-service-owned) env file, mode `0600` or stricter, holding the `RISK_WORKER_DSN` line. |
| `approved_secret_manager_reference` | A reference/key into an approved secret manager that resolves the value at runtime without printing it. |
| `operator_hidden_input` | A hidden interactive prompt where the operator supplies the value (never echoed). |
| `controlled_runtime_shell_variable` | A value already present in a controlled runtime shell environment (not from repo/logs), exported only for the single command. |

---

## 3. Preferred future source (if no stronger existing source exists)

**Preferred:** `root_only_env_file`.

- **Candidate path (non-secret path; value not included):**
  `/etc/buyerrecon/risk-worker.env`
  (mirrors the existing Stage 0 custody pattern `/etc/buyerrecon/stage0-runner.env`).
- **Required file properties for the future proof (presence/metadata only):**
  - `file_exists=true`
  - owner `root` or approved service owner
  - permissions `0600` or stricter
  - contains the **key name** `RISK_WORKER_DSN`
  - value **not** printed
  - value **not** parsed
  - value **not** transformed
  - value **not** checksummed
  - value **not** length-checked
  - value **not** component-checked
  - value **not** DSN-validated in any way that reveals host / user / db / port

The future proof confirms **key presence and file metadata only** — never the
value, never any component.

---

## 4. Future execution binding shape (plan only — DO NOT RUN)

> **PLANNING ONLY — DO NOT RUN.** Illustrative shape; not authorized by this PR.
> No value appears here; `RISK_WORKER_DSN` / `DATABASE_URL` are **names** only.

Ordered shape for a future, separately GO-gated execution shell:

1. Enter a controlled shell with **tracing OFF** (`set +x`); ensure no shell
   history/echo of the value.
2. **Source** the approved custody source **without printing it** (e.g. source
   the root-only env file; or resolve the secret-manager reference; or take a
   hidden prompt) — the value enters the environment, never stdout/logs.
3. Confirm `RISK_WORKER_DSN` is present by **key existence only**
   (e.g. `[ "${RISK_WORKER_DSN+set}" = "set" ] && [ -n "${RISK_WORKER_DSN:-}" ]`)
   — never echo or parse the value.
4. **Bind** for the single command only: `DATABASE_URL="$RISK_WORKER_DSN"`
   (binding done inline for the one command; value never printed).
5. Run **exactly one** already-planned worker command from PR #328
   (`npm run risk-evidence:run`).
6. Redirect worker stdout/stderr to **private temp files** (`0700` dir); the
   error file is never printed.
7. **Do not copy `run.safe.out` into evidence.**
8. **Unset** `RISK_WORKER_DSN` and `DATABASE_URL` **immediately** after the
   command (on every exit path).
9. Evidence may record **only** safe labels, the worker exit code, aggregate
   counts, and guard labels.

This pack plans the shape; it does not run it, source any file, or read any
value.

---

## 5. Required future custody proof labels

```text
risk_worker_dsn_custody_binding_attempted=true
pr328_merge_present=true
tracked_working_tree_clean=true
risk_worker_dsn_source_category=root_only_env_file|approved_secret_manager_reference|operator_hidden_input|controlled_runtime_shell_variable|unknown
risk_worker_dsn_key_present=true|false
risk_worker_dsn_value_printed=false
risk_worker_dsn_value_parsed=false
risk_worker_dsn_value_transformed=false
risk_worker_dsn_value_stored_in_repo=false
risk_worker_dsn_value_passed_in_argv=false
risk_worker_dsn_value_logged=false
database_url_binding_planned=true
database_url_binding_uses_risk_worker_dsn=true
database_url_binding_value_printed=false
approved_secret_custody_available=true|false
risk_worker_dsn_custody_binding_result=pass|blocked_or_failed
worker_executed=false
db_mutation_executed=false
role_or_grant_change_executed=false
stage0_rerun_executed=false
step2e_rerun_executed=false
route_c_rerun_executed=false
downstream_extractors_executed=false
lane_scoring_executed=false
ams_runtime_executed=false
customer_output_executed=false
gate4e_executed=false
gate4f_executed=false
dsn_printed=false
credential_printed=false
host_port_printed=false
env_file_value_printed=false
raw_postgres_error_printed=false
pg_hba_printed=false
raw_customer_payload_printed=false
raw_accepted_events_payload_printed=false
raw_canonical_jsonb_printed=false
raw_request_or_session_identifier_printed=false
```

Note: the custody/binding proof itself sets `worker_executed=false` — it proves
**custody presence + binding shape only** and does **not** run the worker. The
worker run is the separate, later GO (PR #328 path).

---

## 6. Stop-lines

The future custody/binding proof (and this plan) must stop if:

- PR #328 merge not present;
- tracked tree dirty;
- `RISK_WORKER_ROLE` not registered as `buyerrecon_risk_worker`;
- no approved custody source is available;
- proving key presence would require **printing or parsing** the DSN value;
- the DSN value would need to be **typed into shell command text**;
- the DSN value would be **passed in argv**;
- the DSN value would be **written into repo, docs, logs, temp output, PR text,
  or chat**;
- the `DATABASE_URL` binding would use the **collector, Stage0, `postgres`,
  `buyerrecon_app`, or admin DSN**;
- any **host, port, username, password, database name, URI, or DSN component**
  would be printed;
- any **worker execution** would occur;
- any **SQL/psql, DB mutation, role/grant change, Lane/scoring, AMS, customer
  output, Gate4E, or Gate4F** would occur.

On any stop-line: halt and record it (safe labels only); do not proceed.

---

## 7. Interpretation / non-authorization

- This PR **only plans custody/binding**.
- **Merging this PR does not prove custody is available.**
- **Merging this PR does not authorize the first risk-worker run.**
- A future **custody/binding proof** requires a **separate explicit Helen GO**
  (it proves source/key presence + safe binding shape only — never the value).
- A future **first risk-worker run** requires a **later separate explicit Helen
  GO** after the custody/binding proof passes (the PR #328 path).
- **No** Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F is
  authorized by this plan.

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` or `risk-worker.env` content/value, token, private
key, IP address, host value, port value, real URI, login source, **raw `pg_hba`
lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real `session_id`
/ `request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, raw stdout/stderr, or
env-var value. `RISK_WORKER_DSN` and `DATABASE_URL` appear as **env-var names
only**; no value is created, read, parsed, transformed, validated, or printed.
The candidate custody path `/etc/buyerrecon/risk-worker.env` is a **non-secret
path** (its **contents** are a secret and are never read or shown here). The
`package.json` **script name** (`risk-evidence:run`), the `scripts/*.ts`
**path**, the role names (`buyerrecon_risk_worker`, `buyerrecon_app`,
`buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`, `postgres`), the
table names (`stage0_decisions`, `session_behavioural_features_v0_2`,
`risk_observations_v0_1`), the database name (`buyerrecon_production`), the repo
path (`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
repository / role / path / public-git identifiers. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
