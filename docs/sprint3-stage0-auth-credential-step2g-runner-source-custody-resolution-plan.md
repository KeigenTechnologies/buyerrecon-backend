# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source Custody / Presence Resolution Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_RESOLUTION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans how to determine whether
an **approved `STAGE0_RUNNER_DSN` source exists** through a **secret-safe custody /
presence mechanism** — **without exposing values or changing runtime binding** — after
PR #239's Option C proof rerun returned `inconclusive`
(`stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source`).

This PR **executes nothing** and **authorizes no proof / production command**: no
source-value printing, no `.env.production` value read/print, no DSN parsing, no DB
connection, no `psql`/SQL, no env mutation, no runner DSN binding, no source-selection
code change, no password reset/rotation, no Step 2E rerun, no Stage 0, no run-lock
touch, no runtime/downstream/Lane/scoring/AMS/customer action, **and no Option A/B
selection**. No real DSN, password, token, host, port, IP, or URI appears in this
document.

> Provenance: PR #239 Step 2G Option C proof rerun inconclusive evidence
> (`05c81f3e77e3b865935c2618f1f811955813f610`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_PROOF_RERUN_INCONCLUSIVE_RUNNER_SOURCE_PRESENCE_NOT_PROVABLE`);
> PR #232 Option C proof command-pack plan (merged GitHub,
> `5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`,
> `runner_binding_documented_but_not_proven_present`).

---

## 1. Evidence Carried Forward (from PR #239)

- Option C proof rerun **completed safely** on the corrected repo base.
- Runner env name is **documented**: `stage0_runner_env_name_documented=true`.
- Tracked **runtime default source category** remains `database_url`:
  `runtime_default_source_category=database_url`.
- Tracked **Stage 0 worker effective source category** remains `app_or_collector`:
  `stage0_worker_effective_source_category=app_or_collector`.
- `extract-stage0-inputs.ts` is **not** the direct env selector:
  `extract_stage0_inputs_direct_env_reads=false`.
- **Approved runner-source presence remains unknown:**
  `approved_runner_source_present=unknown`, `approved_runner_source_category=unknown`.
- Result: `option_c_result=inconclusive`,
  `stop_line=approved_runner_source_presence_not_provable_without_runtime_custody_source`.

**Bounded standing conclusion:** the worker source-selection structurally classifies as
the **app/collector** category, but **whether an approved runner source exists to bind
to is unproven** — answerable only by a **secret-safe custody/presence** mechanism, not
by non-secret classification. **Option A/B must not be chosen** until presence is proven
or ruled out.

---

## 2. Custody-Resolution Options (compared; none executed or selected here)

### Option 1 — custody pointer / operator assertion
Prove via an **approved non-secret custody pointer** or an **operator-controlled
secret-store key name** that a runner source exists — **without printing or reading the
value**.
- **Pros:** strongest separation of presence from value; no runtime contact; aligns with
  the established custody discipline.
- **Cons:** depends on an authoritative custody pointer / operator attestation being
  available and unambiguous.

### Option 2 — env-name presence in a controlled shell
Check **only whether `STAGE0_RUNNER_DSN` is present by name** in a controlled runtime
shell — **without reading or printing the value** (name/defined-presence boolean only).
- **Pros:** directly tests the runtime env the worker would read; boolean-only.
- **Cons:** must guarantee value is never echoed/expanded/logged; presence-by-name only,
  not authority.

### Option 3 — deployment / secret-manager metadata
Use **non-secret metadata** from the deployment platform or secret manager showing the
**key exists** — **without exposing value, host, port, username, password, URI, or DSN
components**.
- **Pros:** authoritative existence signal from the platform; no runtime shell needed.
- **Cons:** must confirm the metadata view itself never returns secret material.

### Option 4 — decide source missing
If **no approved custody path can prove source presence without raw-value access**,
record `approved_runner_source_present=unknown|false` and route to a
**source-creation / binding planning PR** — **still no runtime change**.
- **Pros:** fail-closed; avoids forcing a value read to get an answer.
- **Cons:** defers the answer to a creation/custody track.

---

## 3. Allowed Proofs

A future custody-resolution run (separately GO-gated) may:
- read an **approved non-secret custody pointer / secret-store key NAME** (name/presence
  only);
- check **env-var NAME presence** (`STAGE0_RUNNER_DSN` defined? boolean only) in a
  controlled shell **without** expanding/echoing/logging the value;
- read **deployment / secret-manager existence metadata** that returns **no** secret
  material;
- emit **only** the §5 safe labels.

---

## 4. Forbidden Proofs / Actions

The future custody-resolution run **must not**:
- print any source value;
- read or print any `.env.production` value;
- parse DSN contents (no splitting a connection string into fields);
- print host / port / IP / username / password / URI / DSN components;
- connect to the DB or run psql/SQL;
- mutate env or bind a runner DSN;
- change source-selection code;
- reset/rotate a password;
- run Step 2E, Stage 0, run-lock, or any runtime/downstream/customer action;
- select Option A or Option B.

---

## 5. Required Safe Labels (for the future custody-resolution run)

```text
custody_resolution_planning_only=true
approved_runner_source_presence_target=STAGE0_RUNNER_DSN
approved_runner_source_present=unknown
approved_runner_source_category=unknown
raw_value_access_allowed=false
dsn_parsing_allowed=false
db_connection_allowed=false
runner_dsn_binding_authorized=false
source_selection_change_authorized=false
option_a_selected=false
option_b_selected=false
stage0_executed=false
```

> The future run will additionally set its own outcome booleans (e.g.
> `custody_resolution_attempted`, `custody_pointer_present`,
> `env_name_present_by_name`, `secret_manager_key_exists`,
> `custody_resolution_result=<allowlisted>`), all safe booleans/tokens — **no raw
> values**, and **fail closed** if presence cannot be established without raw-value
> access.

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any source value / `.env.production` value / host / port / IP / username / password /
  URI / DSN component would be printed or read;
- any DSN-content parsing would occur;
- any DB connection / psql / SQL would occur;
- any env mutation / runner DSN binding / source-selection change would occur;
- any password reset/rotation, Step 2E, Stage 0, run-lock, or runtime/downstream action
  would occur;
- any Option A/B selection would be made;
- presence cannot be established **without** raw-value access (→ record
  `approved_runner_source_present=unknown`, route per §7, no value read).

If a stop-line is hit, withhold all secret/raw output, record the blocked/unknown state
in a docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Decision Mapping

From the future custody-resolution result:
- **Presence proven** by a secret-safe custody pointer / metadata / env-name presence →
  later **Option A/B decision planning may proceed** (each separately reviewed +
  GO-gated).
- **Absence proven** → later **source-creation / custody planning** required (no runtime
  change).
- **Still unknown** → **refine the custody plan**; **do not choose Option A/B**.
- **No path** authorizes Step 2E, Stage 0, remediation, or runtime binding.

**No decision branch is executed by this PR.**

---

## 8. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No proof execution.
- No source-value printing.
- No `.env.production` value read/print.
- No DSN parsing.
- No DB connection.
- No psql/SQL.
- No env mutation.
- No runner DSN binding.
- No source-selection code change.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0.
- No run-lock.
- No runtime/downstream/Lane/scoring/AMS/customer action.
- No Option A/B selection.

---

## 9. Non-Authorization

**Merging this plan authorizes:**
- **no** custody-resolution run;
- **no** Option A/B selection;
- **no** source-creation/binding;
- **no** env mutation / runner DSN binding / source-selection change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The custody-resolution run is a future, separately-reviewed, separately GO-gated step**
requiring its own docs-only plan/command-pack, Codex review, and a fresh explicit Helen
GO. **Stage 0 execution remains separately GO-gated.**

---

## 10. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen selects a custody-resolution option (1/2/3)** and issues a **fresh explicit
   GO** for **one** secret-safe custody-resolution run (safe labels only; no value
   read/print; fail closed to `unknown` if presence needs raw-value access).
3. Docs-only **custody-resolution evidence PR** (safe labels only).
4. **Per §7 mapping** → if presence proven, Option A/B decision planning (separately
   reviewed + GO-gated); if absent, source-creation/custody planning; if unknown,
   refine.
5. **Stage 0 execution remains separately GO-gated.**

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
to determine **presence/authority by custody pointer / env-name / metadata only** — it
**reads/prints no value**, **parses no DSN**, makes **no** DB connection, changes **no**
runtime binding, and **selects no Option A/B**; if presence cannot be established without
raw-value access, the future run **fails closed to `unknown`**. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / option names / env-var names /
role / database names / public git commit hashes — not secret or row values.
