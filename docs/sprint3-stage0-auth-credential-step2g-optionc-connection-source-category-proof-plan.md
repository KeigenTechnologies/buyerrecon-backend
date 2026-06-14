# Sprint 3 — Stage 0 auth/credential Step 2G Option C — Non-Secret Connection-Source Category Proof Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_CONNECTION_SOURCE_CATEGORY_PROOF_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **future non-secret
connection-source category/boolean proof** that can determine whether the **approved
Stage 0 runner source exists and can be selected** — **without** exposing secrets,
connecting to the DB, or changing runtime behaviour — as the **Option C smallest safe
gate** recommended by PR #230, before any Option A/B remediation, Step 2E rerun, or
Stage 0 execution.

This PR **executes nothing** and **authorizes no proof run / no production command**:
no proof execution, no production command, no DB connection, no `psql`/SQL, no
`.env.production` value read/print, no raw DSN/password/token/host/port/IP output, no
env mutation, no runner DSN binding, no code/source-selection change, no password
reset/rotation, no Step 2E rerun, no Stage 0, no run-lock touch, no
runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password, token,
host, port, IP, or URI appears in this document.

> Provenance: PR #230 Step 2G runner connection-source remediation plan
> (`b6d72b3ca033c62687cde1d8415a66e8d0440817`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_CONNECTION_SOURCE_REMEDIATION_PLANNING_ONLY`,
> `remediation_plan_result=option_c_recommended_smallest_safe_gate`); PR #229
> reconciliation (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `runner_binding_documented_but_not_proven_present`); PR #228 Stage B
> (`user_category_unexpected`); PR #227 localization plan
> (`c1b3dd2d8c311b9fd568b304841050630486d607`); PR #226 Step 2E gate persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`); PR #225 Step 2D rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`).

---

## 1. Objective

The future Option C proof must prove **only non-secret source category / selection
facts**:
- whether an **approved runner source is present** and what **category** it resolves to;
- whether the **runtime default source** and the **Stage 0 worker effective source**
  resolve to the `stage0_runner` category or the `app_or_collector` category.

It must **not**:
- prove **credential validity** (no password/secret correctness check);
- prove **PostgreSQL authentication** (no DB connection / no auth attempt);
- perform **any runtime remediation** (no env/binding/source-selection change).

This converts the PR #228/#229 **hypothesis** (Stage 0 path tied to the app/collector
`DATABASE_URL` rather than `buyerrecon_stage0_runner`) into a **non-secret proof or
refutation**, and decides which later remediation (Option A vs B) is warranted.

---

## 2. Allowed Outputs (boolean/category labels only — no raw values)

```text
approved_runner_source_present=true|false
approved_runner_source_category=stage0_runner|app_or_collector|missing|unknown
runtime_default_source_category=database_url|stage0_runner|unknown
stage0_worker_effective_source_category=stage0_runner|app_or_collector|unknown
option_c_result=runner_source_available_but_not_bound|runner_source_missing|runtime_already_runner_bound|inconclusive
```

Plus the safe scope/guard booleans (e.g. `option_c_proof_attempted`,
`db_connection_attempted=false`, `psql_sql_invoked=false`,
`raw_value_printed=false`, `env_mutated=false`, `code_changed=false`,
`stage0_executed=false`). **No raw values of any kind.**

---

## 3. Forbidden Outputs

The proof must **never** output / print / record:
- a DSN URI or connection string;
- a password / credential / token;
- a host / port / IP;
- `.env.production` content (values);
- raw SQL / psql / PostgreSQL output;
- customer data, UUIDs, `request_id`, `session_id`, payloads, or `canonical_jsonb`.

Only **category tokens and booleans** from §2 are permitted.

---

## 4. Safe Proof Design (for the future, separately GO-gated proof)

> This is a **design contract** for a later, separately-reviewed, separately GO-gated
> proof — **not** executed here. When later planned/run it must:

- inspect **only source names / categories / booleans** (e.g. classify which env-var
  name a source maps to, and which role-category that source name corresponds to per
  the registry contract) — **in memory / structural classification only**;
- **fail closed** if any raw value (DSN/password/host/port/IP/URI/`.env.production`
  value) would need to be printed or recorded;
- **fail closed** if the proof would require a **DB connection** or `psql`/SQL;
- **fail closed** if the proof would **mutate** env / runtime / source-selection / code;
- emit **only** the §2 allowlisted category/boolean labels;
- withhold any raw output (any incidental raw text → `chmod 600` temp; never printed);
- record results in a **docs-only evidence PR** after the run.

**Category classification is by source NAME / contract mapping, not by reading secret
values** — e.g. "the Stage 0 worker's effective source is the `DATABASE_URL` env name,
which the registry maps to the `app_or_collector` role category" is a **non-secret
structural fact**, established without reading the `DATABASE_URL` value.

**Strict classification limits (required):** the future Option C proof is limited to
non-secret classification by **env-var name**, **source-selection path** (which env
name the worker/diagnostic reads), and **presence booleans** only. It **must not**:
- parse DSN contents (it does **not** read/split a connection string into fields);
- print source values;
- print host / port / IP;
- infer category by exposing or inspecting any secret material.
**If the proof cannot classify the source without reading or printing raw values, it
must fail closed as `option_c_result=inconclusive`** (emit the inconclusive label, no
raw value, non-zero exit) rather than read/print to force a classification.

---

## 5. Decision Mapping

From the future `option_c_result`:
- **`runner_source_available_but_not_bound`** (runner source exists, but the worker
  still resolves to the app/collector category) → later **Option A or Option B**
  remediation planning required (each separately reviewed + GO-gated).
- **`runner_source_missing`** (no approved runner source resolvable) →
  **custody/env-source resolution** planning required (no remediation yet).
- **`runtime_already_runner_bound`** (the worker already resolves to the `stage0_runner`
  category) → **Step 2E rerun** planning may become appropriate — still separately
  reviewed and GO-gated.
- **`inconclusive`** → **refine the diagnostic plan**; **no remediation**.

**No decision branch is executed by this PR** — these are the documented next-gate
mappings only.

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any secret / raw value exposure risk (DSN/password/token/host/port/IP/URI);
- any DB connection / `psql` / SQL requirement;
- any `.env.production` value print/read;
- any env mutation;
- any code / runtime / source-selection change;
- any Stage 0 / run-lock / downstream action.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No proof execution.
- No production command.
- No DB connection.
- No psql/SQL.
- No `.env.production` value read/print.
- No raw DSN/password/token/host/port/IP output.
- No env mutation.
- No runner DSN binding.
- No code/source-selection change.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0 execution.
- No run-lock touch.
- No runtime/downstream/Lane/scoring/AMS/customer action.

---

## 8. Non-Authorization

**Merging this plan authorizes:**
- **no** proof run;
- **no** Option A/B remediation;
- **no** env binding;
- **no** source-selection change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The Option C non-secret category proof is a future, separately-reviewed, separately
GO-gated step** requiring its **own docs-only plan/command-pack, Codex review, and a
fresh explicit Helen GO** before any execution. **Stage 0 execution remains separately
GO-gated.**

---

## 9. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Option C proof command-pack** — a docs-only, secret-safe, fail-closed command-pack
   that emits only the §2 category/boolean labels (no secrets, no DB connection), then
   (own fresh GO) the proof run recorded in a docs-only evidence PR.
3. **Decision per §5** → the appropriate separately-reviewed, GO-gated next plan
   (Option A / Option B / custody resolution / refined diagnostic).
4. **Step 2E rerun** only if/when a proven-correct runner binding exists — under a fresh
   GO.
5. **Stage 0 execution remains separately GO-gated** (only after a clean Step 2E and a
   separate Stage 0 GO).

---

## 10. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
for a **future** non-secret source-category proof; it **executes no proof**, reads/prints
**no** `.env.production` value, makes **no** DB connection, and defines **category
tokens / booleans / env-var names / role / database names only**. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / env-var
names / role / database names / public git commit hashes — not secret or row values.
