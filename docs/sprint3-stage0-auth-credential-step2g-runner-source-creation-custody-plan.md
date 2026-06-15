# Sprint 3 — Stage 0 auth/credential Step 2G — `STAGE0_RUNNER_DSN` Source-Creation / Custody Path Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CREATION_CUSTODY_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans how an **approved
`STAGE0_RUNNER_DSN` custody/source path** would be established — **without creating,
binding, generating, printing, parsing, or using any secret yet** — after the custody
probes left runner-source presence unproven (Option 2 absent in the controlled shell,
PR #241; Option 3 metadata inconclusive — source unavailable, PR #243).

This PR **executes nothing** and **authorizes no source creation / binding / secret
generation / proof run**: no source creation, no source binding, no secret generation,
no value print/read, no `.env.production` read/print, no DSN parsing, no DB connection,
no `psql`/SQL, no env mutation, no runner DSN binding, no source-selection code change,
no Option A/B selection, no password reset/rotation, no Step 2E rerun, no Stage 0, no
run-lock touch, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN,
password, token, host, port, IP, or URI appears in this document.

> Provenance: PR #243 Step 2G Option 3 metadata inconclusive evidence
> (`564063f292e3b90a3373e14559aa1805ee9794e0`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_OPTION3_METADATA_INCONCLUSIVE`);
> PR #241 Option 2 env-name missing (`1c885d0e65e98cbb6f6a8f4628b82660fac6e115`); PR #240
> custody resolution plan (`228a827d375eba6de81afb75beafd93dba6c4d4e`); PR #239 Option C
> proof rerun inconclusive (`05c81f3e77e3b865935c2618f1f811955813f610`); PR #229
> reconciliation (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`).

---

## 1. Evidence Carried Forward

- Worker source-selection structurally resolves to `DATABASE_URL` / `app_or_collector`
  (PR #239/#229).
- Intended runner source name documented: `STAGE0_RUNNER_DSN`.
- **Option 2** controlled-shell check: `STAGE0_RUNNER_DSN` **missing in that shell**
  (PR #241) — bounded, not global.
- **Option 3** generic deployment/secret-manager metadata: **inconclusive** — no approved
  key-name-only metadata source available (PR #243).
- **Runner-source presence remains unproven; global absence not fully established.**
- **Option A/B remains deferred; Stage 0 remains blocked and separately GO-gated.**

---

## 2. Objective

Plan how an **approved runner-specific source named `STAGE0_RUNNER_DSN`** would be
**created, stored, and later proven by metadata/presence only** — such that **no secret
value ever appears** in the repo, terminal output, docs, logs, or evidence. This plan
**designs the path only**; it creates/stores/binds nothing.

---

## 3. Required Custody Properties

- **source name:** `STAGE0_RUNNER_DSN`
- **intended DB role category:** `buyerrecon_stage0_runner`
- **intended database:** `buyerrecon_production`
- **safe custody owner / location:** to be **selected later** (one of §4's options),
  under its own review + GO
- **key-name-only proof required after creation** (presence/metadata only)
- **no raw value exposure** at any step (creation, storage, proof, evidence)

---

## 4. Options to Compare (none selected or executed here)

### Option S1 — approved deployment secret manager
Create/store `STAGE0_RUNNER_DSN` in an **approved deployment secret manager**, then a
**key-name-only metadata proof** (existence only).
- **Pros:** platform-managed custody; existence provable by metadata without value
  exposure; aligns with Option 3's intended (but unavailable) metadata surface.
- **Cons:** requires an approved secret-manager surface to exist and be reachable for
  proof.

### Option S2 — controlled server-side secret source
Create/store in a **controlled server-side secret source**, then an **env-name presence
proof** (name present, value never read).
- **Pros:** directly feeds the runtime env the worker would read; presence provable in
  the controlled shell (the Option 2 surface).
- **Cons:** server-side custody discipline must guarantee the value is never echoed/
  logged; presence-by-name only, not platform-authoritative.

### Option S3 — operator-held one-time secret handoff
**Operator-held one-time secret handoff** into approved runtime custody, then a
**metadata/presence proof**.
- **Pros:** minimal standing exposure; operator controls the handoff; provable by
  presence/metadata afterward.
- **Cons:** one-time-handoff procedure must be secret-safe (hidden input, no echo, no
  log); depends on an approved runtime custody target.

### Option S4 — none acceptable → design new dedicated custody mechanism
If **none of S1–S3 are acceptable**, **stop** and design a **new dedicated custody
mechanism** (its own separate plan).
- **Pros:** fail-safe; avoids forcing an unsafe custody path.
- **Cons:** defers creation to a custody-design track.

---

## 5. Required Future Gates (for any creation path)

1. a **source-creation command-pack plan** (docs-only);
2. **Codex review**;
3. a **fresh explicit Helen GO**;
4. a **source-creation evidence PR** (safe labels only; secret never printed/stored in
   repo);
5. a **metadata/presence proof PR** (key-name/existence only);
6. **only then** Option A/B decision planning.

---

## 6. Safe Labels (for this plan / future creation evidence)

```text
runner_source_creation_planning_only=true
target_source_name=STAGE0_RUNNER_DSN
target_role_category=buyerrecon_stage0_runner
target_database=buyerrecon_production
source_created=false
source_bound=false
secret_value_printed=false
secret_value_read=false
dsn_parsing_performed=false
db_connection_attempted=false
psql_sql_invoked=false
option_a_selected=false
option_b_selected=false
stage0_executed=false
```

---

## 7. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- any **raw value** would be printed/read;
- any **`.env.production` value** read/print;
- any **DSN parsing**;
- any **DB connection / psql** required;
- any **source binding or runtime env mutation**;
- any **code / source-selection change**;
- any **Option A/B selection**;
- any **Step 2E / Stage 0 / runtime** action.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 8. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No source creation.
- No source binding.
- No secret generation.
- No value print/read.
- No `.env.production` read/print.
- No DSN parsing.
- No DB connection.
- No psql/SQL.
- No env mutation.
- No runner DSN binding.
- No source-selection code change.
- No Option A/B selection.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0.
- No run-lock.
- No runtime/downstream/Lane/scoring/AMS/customer action.

---

## 9. Decision Mapping

- **A source-creation path (S1/S2/S3) is selected and reviewed** → a **separate GO for
  creation only** (its own command-pack plan + Codex review + GO).
- **After creation proof** → a **metadata/presence proof** (key-name/existence only).
- **After presence proof** → **Option A/B decision planning** (each separately reviewed +
  GO-gated).
- **If no custody path is acceptable (S4)** → **stop and escalate custody design**.
- **No path** authorizes remediation, runtime binding, or Stage 0 here.

**No decision branch is executed by this PR.**

---

## 10. Non-Authorization

**Merging this plan authorizes:**
- **no** source creation;
- **no** binding;
- **no** secret generation;
- **no** proof run;
- **no** Option A/B decision;
- **no** Step 2E rerun;
- **and no** Stage 0.

**Any creation path is a future, separately-reviewed, separately GO-gated step**
requiring its own docs-only command-pack plan, Codex review, and a fresh explicit Helen
GO. **Stage 0 execution remains separately GO-gated.**

---

## 11. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen selects a custody-creation option (S1/S2/S3)** — or **S4 escalate** — and a
   **fresh explicit GO** initiates a docs-only **source-creation command-pack plan**
   (still no creation/binding without its own review + GO).
3. **Source-creation evidence PR** → **metadata/presence proof PR** (key-name/existence
   only) → **Option A/B decision planning**.
4. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, generated secret, raw
secret-manager payload, `.env.production` content/value, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value, URI,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or
customer data. This is a docs-only plan for how an approved `STAGE0_RUNNER_DSN` source
**would** be created/stored and **later proven by metadata/presence only** — it
**creates/binds/generates nothing**, reads/prints **no** value, parses **no** DSN, makes
**no** DB connection, changes **no** runtime binding, and **selects no Option A/B**; the
intended source name / role category / database are non-secret identifiers, and any
future secret value is handled secret-safely and **never** printed/stored in repo, docs,
logs, or evidence. (Per the PR #218 Codex note: "no secret used or exposed" is to be
read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / option names / env-var names / role / database names / public git
commit hashes — not secret or row values.
