# Sprint 3 — Stage 0 auth/credential Step 2G Option C — Proof Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_PROOF_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It specifies the **design of a
future Option C proof command-pack** — a **non-secret connection-source category/boolean
proof** — per the PR #231 plan. The future proof must emit **only safe boolean/category
labels** and **fail closed** if classification would require reading or printing raw
values.

This PR **executes nothing** and **authorizes no proof run / no production command**:
no proof execution, no production command, no DB connection, no `psql`/SQL, no
`.env.production` value read/print, no raw DSN/password/token/host/port/IP output, no
env mutation, no runner DSN binding, no code/source-selection change, no password
reset/rotation, no Step 2E rerun, no Stage 0, no run-lock touch, no
runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password, token,
host, port, IP, or URI appears in this document.

> Provenance: PR #231 Step 2G Option C connection-source category proof plan
> (`6f4d103462c9dc1d59b7f124c8e16aef789fff66`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_CONNECTION_SOURCE_CATEGORY_PROOF_PLANNING_ONLY`);
> PR #230 remediation options (`b6d72b3ca033c62687cde1d8415a66e8d0440817`,
> Option C recommended); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `runner_binding_documented_but_not_proven_present`); PR #228 Stage B
> (`user_category_unexpected`); PR #227 localization plan
> (`c1b3dd2d8c311b9fd568b304841050630486d607`); PR #226 Step 2E gate persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`); PR #225 Step 2D rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`).

---

## 1. Evidence Carried Forward

- **PR #225** — Step 2D local-postgres-path runner password rotation **committed**.
- **PR #226** — Step 2E post-fix psql gate **still failed** broad `auth_or_credential`.
- **PR #227** — Step 2F persistent-auth localization plan.
- **PR #228** — Step 2F Stage B: `connection_source_category=database_url`,
  `user_expected_category=app_or_collector`, `connection_components_result=user_category_unexpected`.
- **PR #229** — reconciliation `runner_binding_documented_but_not_proven_present`:
  PR #199 documents `STAGE0_RUNNER_DSN`; inspected Stage 0 worker / shared pool path
  tied to `DATABASE_URL`.
- **PR #230** — recommended **Option C first**.
- **PR #231** — planned the Option C non-secret connection-source category proof.

**Bounded standing conclusion:** the persistent `auth_or_credential` is **strongly
consistent with** the Stage 0 path authenticating as the **app/collector** identity
rather than `buyerrecon_stage0_runner` — a **strongly supported hypothesis**, **not**
proof of the exact raw PostgreSQL error and **not** a remediation.

---

## 2. Future GO Phrase (placeholder — not issued by this PR)

A later, separately-reviewed proof run would require a fresh explicit Helen GO of the
form:

```text
HELEN STAGE0 AUTH CREDENTIAL STEP 2G OPTION C PROOF GO
```

> This placeholder documents the required gate only. **This PR does not issue, assume,
> or act on any GO**, and merging it issues no GO.

---

## 3. Command-Pack Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** proof —
> **not** executed here, and not runnable from this document. The proof is a
> **non-secret structural classifier**: it answers *which env-var name / source-selection
> path the Stage 0 worker/diagnostic uses, and which role-category that name maps to per
> the tracked registry contract* — entirely from **names, source-selection paths,
> presence booleans, and tracked code/docs contract references**, never from secret
> values.

**It MAY classify only by:**
- **env-var name** (which name the worker/diagnostic reads, e.g. `DATABASE_URL` vs
  `STAGE0_RUNNER_DSN` — the **name**, never its value);
- **source-selection path** (which code path / entrypoint selects the source);
- **presence booleans** (whether an approved runner source name is present/defined —
  presence only, never the value);
- **tracked code/docs contract references** (e.g. the PR #199 registry mapping of a
  source name to a role category; the worker's `env.DATABASE_URL` read).

**Sketch of safe steps (illustrative; each must hold the boundaries in §5/§6):**
1. Confirm scope/host/branch-head and that the PR #231/#199 reference docs are present
   (booleans only).
2. Determine the **Stage 0 worker effective source NAME** by reading tracked source
   (`src/scoring/stage0/run-stage0-worker.ts`, `src/db/client.ts`) — name only.
3. Determine whether an **approved runner source NAME** (e.g. `STAGE0_RUNNER_DSN`) is
   **present/defined** — **presence boolean only**, never reading its value.
4. Map each source **name** to a **role category** via the tracked registry contract
   (PR #199) — `stage0_runner` vs `app_or_collector` — a **name→category** mapping, not
   a value inspection.
5. Emit the §4 labels and the §6-governed `option_c_result`; withhold any incidental raw
   text to a `chmod 600` temp and never print it.

---

## 4. Allowed Labels (safe boolean/category labels only — no raw values)

```text
option_c_proof_attempted=true
approved_runner_source_present=true|false|unknown
approved_runner_source_category=stage0_runner|app_or_collector|missing|unknown
runtime_default_source_category=database_url|stage0_runner|unknown
stage0_worker_effective_source_category=stage0_runner|app_or_collector|unknown
db_connection_attempted=false
psql_sql_invoked=false
raw_value_printed=false
env_mutated=false
code_changed=false
stage0_executed=false
option_c_result=runner_source_available_but_not_bound|runner_source_missing|runtime_already_runner_bound|inconclusive
```

---

## 5. Forbidden Actions / Outputs

The future proof command-pack **must not**:
- parse DSN contents (no reading/splitting a connection string into fields);
- print source values;
- print host / port / IP;
- infer category by exposing secret material;
- read or print `.env.production` values;
- connect to the DB;
- run psql / SQL;
- mutate env / runtime;
- bind a runner DSN;
- change code / source-selection.

Only the §4 category tokens / booleans are permitted as output.

---

## 6. Stop-Lines (fail-closed)

The future proof must **fail closed** (safe stop-line; no raw value emitted) if any of:
- **classification would require raw value access** → emit
  `option_c_result=inconclusive` and stop (do **not** read/print to force a
  classification);
- a **DB connection / `psql` / SQL** would be required → stop;
- a **`.env.production` value** would need to be read/printed → stop;
- an **env / runtime / source-selection mutation** would be required → stop;
- any **secret/raw value** (DSN/password/token/host/port/IP/URI) would be printed →
  stop;
- **Stage 0 / run-lock / downstream** action would occur → stop.

If a stop-line is hit, withhold all secret/raw output, record the blocked/inconclusive
state in a docs-only evidence PR (safe labels only), and take no fix/retry without
separate review/GO.

---

## 7. Decision Mapping

From the future `option_c_result`:
- **`runner_source_available_but_not_bound`** → later **Option A / Option B** planning;
  **no remediation now** (each separately reviewed + GO-gated).
- **`runner_source_missing`** → **custody / env-source resolution** planning.
- **`runtime_already_runner_bound`** → **Step 2E rerun** planning may be appropriate —
  still separately reviewed and GO-gated.
- **`inconclusive`** → **refine the proof plan**; **no remediation**.

**No decision branch is executed by this PR.**

---

## 8. Safety Boundaries (this planning PR)

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

## 9. Non-Authorization

**Merging this plan authorizes:**
- **no** proof run;
- **no** Option A/B remediation;
- **no** env binding;
- **no** source-selection change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The Option C proof command-pack run is a future, separately-reviewed, separately
GO-gated step** requiring a fresh explicit Helen GO (§2) and recorded in its own
docs-only evidence PR. **Stage 0 execution remains separately GO-gated.**

---

## 10. Next Gated Step

1. **Codex review and merge** of this command-pack planning PR.
2. **Fresh explicit Helen GO** (§2) for **one** Option C proof run (secret-safe,
   fail-closed, §4 labels only; no secrets, no DB connection).
3. Docs-only **Option C proof evidence PR** (safe labels only).
4. **Decision per §7** → the appropriate separately-reviewed, GO-gated next plan.
5. **Step 2E rerun** only if/when a proven-correct runner binding exists — under a fresh
   GO.
6. **Stage 0 execution remains separately GO-gated** (only after a clean Step 2E and a
   separate Stage 0 GO).

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
for a **future** non-secret source-category proof command-pack; it **executes no proof**,
reads/prints **no** `.env.production` value, makes **no** DB connection, and defines
**category tokens / booleans / env-var names / source-selection paths / role / database
names only** — classification is by **name and contract mapping**, never by reading
secret values; if classification cannot be done without raw values, the future proof
fails closed as `option_c_result=inconclusive`. (Per the PR #218 Codex note: "no secret
used or exposed" is to be read as "no secret value exposed, printed, or recorded.") All
values above are safe labels / booleans / category tokens / env-var names / role /
database names / public git commit hashes — not secret or row values.
