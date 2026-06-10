# Sprint 3 — Dedicated Stage 0 Login-Role Path (PR #174 Option B) — Plan / Command-Pack (Review-Only)

**Status:** `STAGE0_DEDICATED_LOGIN_ROLE_PLANNING_ONLY`

This is a **reviewable, docs-only planning / command-pack record**. It defines a
**dedicated, least-privilege Stage 0 execution identity** so Stage 0 no longer
depends on ambiguous `buyerrecon_app` DSN custody.

This PR **executes nothing**: no production command, no SQL, no role creation, no
password set, no DSN create/change, no grant, no Stage 0. The candidate command
packs below are **CANDIDATE ONLY — DO NOT RUN**. No real password, DSN, token,
hostname, IP, raw ID, row value, or customer data appears in this record.

> Provenance: PR #174 Option B (`7beb316a08df3e2ad7ae878d720ed86b5dd7d746`,
> dedicated Stage 0 login-role path); PR #177 reviewed DSN command pack
> (`a5296d2575a7498e1952f28eefec705c0fb15a8e`); PR #178 blocked retry evidence
> (`466a5493e46d0f5a7ac855357819efbf3a025970`,
> `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_RETRY_BLOCKED`).

---

## 1. Decision Record

- **Helen selected Path B.** Stop trying to use the `buyerrecon_app` DSN; move to
  the **PR #174 Option B dedicated Stage 0 login-role path**.
- This is a **governance / custody decision** — **not** a Stage 0 runtime, code,
  or permission failure. The technical privilege/role work already succeeded
  (PR #167 read-source grants; PR #171 reachability PASS); the blocker was
  purely `buyerrecon_app` DSN custody/binding.

**Carry-forward:**
- PR #177 merge commit: `a5296d2575a7498e1952f28eefec705c0fb15a8e` (reviewed DSN
  command pack; **not run**).
- PR #178 merge commit: `466a5493e46d0f5a7ac855357819efbf3a025970` — gate-proof
  retry **blocked before attempt** because `on_production_host=false` and
  `app_dsn_present_in_env=false`.
- In PR #178: **no** DSN read, validator, `psql`, Stage 0, run-lock, SQL, grant,
  role change, DML/DDL, or downstream runtime occurred.

---

## 1a. Review History

- **First Codex review of PR #179: BLOCKED.**
- **Blocker:** the prior **membership-only** recommendation (make
  `buyerrecon_stage0_runner` a member of `buyerrecon_scoring_worker`) **violates
  the Stage-0-only boundary** — `buyerrecon_scoring_worker` is **not Stage-0-only**;
  it already holds **Risk / POI / POI-Sequence write surfaces** (table + sequence
  grants) per `migrations/013_risk_observations_v0_1.sql:165`,
  `migrations/014_poi_observations_v0_1.sql:243` (+ sequence 014:264), and
  `migrations/015_poi_sequence_observations_v0_1.sql:273` (+ sequence 015:289).
  Membership would inherit all of those.
- **Patch response (this commit):** the membership-only shape is
  **REJECTED / SUPERSEDED — DO NOT USE**; the **direct-grant, Stage-0-only** path
  is now the **only recommended** path (§2, §4a); the proof pack is expanded with
  explicit **negative privilege proofs** for Risk/POI/POI-Sequence tables **and**
  their sequences, plus membership-absence and ownership-absence checks (§5a); and
  matching stop-lines were added (§6).

---

## 2. Dedicated Role Design (least-privilege)

**Role name: `buyerrecon_stage0_runner`.**
- **Provenance / naming:** no prior merged doc assigned a concrete name to the
  dedicated role — PR #174 Option B referenced it only by **membership**
  ("a dedicated Stage 0 login role, member of `buyerrecon_scoring_worker`
  only"). `buyerrecon_stage0_runner` is introduced here as a new, non-conflicting
  name consistent with the existing `buyerrecon_*` convention. If review prefers
  a different name, rename consistently before the grant operator session.

**Role attributes (least-privilege):**
- **LOGIN** — yes (it must connect via a dedicated DSN to run Stage 0); login is
  the *only* reason it differs from the NOLOGIN group role.
- **NOSUPERUSER**, **NOCREATEDB**, **NOCREATEROLE**, **NOREPLICATION**,
  **NOBYPASSRLS**.
- **Not owner** of any application table.
- **Dedicated to Stage 0 only** — not reused for collector, extractor, risk
  worker, POI worker, Lane A/B, scoring, AMS Trust/Pass, customer output, Gate
  4E, or Gate 4F.

**Privilege strategy:**

- **Recommended path — direct-grant, Stage-0-only.** Grant **only** the exact
  Stage 0 privileges (§3) **directly** to `buyerrecon_stage0_runner`, with **no
  group membership**:
  - `SELECT` on `accepted_events`;
  - `SELECT` on `ingest_requests`;
  - `SELECT, INSERT, UPDATE` on `stage0_decisions`;
  - **no sequence privileges** unless a future source review proves a sequence is
    required (today the PK is `gen_random_uuid()` — none needed);
  - **no** Risk / POI / POI-Sequence / Lane / scoring / AMS / customer-output
    privileges; no schema-wide grants; no table ownership.
  This keeps the dedicated role strictly Stage-0-only and independent of any
  broader group role.

- **REJECTED / SUPERSEDED — DO NOT USE — membership in
  `buyerrecon_scoring_worker`.** A prior draft recommended making
  `buyerrecon_stage0_runner` a member of `buyerrecon_scoring_worker`. **This is
  rejected** because `buyerrecon_scoring_worker` is **not Stage-0-only** — it
  already holds **Risk / POI / POI-Sequence write surfaces** (current repo
  evidence):
  - `migrations/013_risk_observations_v0_1.sql:165` —
    `GRANT SELECT, INSERT, UPDATE ON risk_observations_v0_1 TO
    buyerrecon_scoring_worker`;
  - `migrations/014_poi_observations_v0_1.sql:243` —
    `GRANT SELECT, INSERT, UPDATE ON poi_observations_v0_1 TO
    buyerrecon_scoring_worker` **plus** `GRANT USAGE, SELECT, UPDATE ON SEQUENCE
    poi_observations_v0_1_poi_observation_id_seq TO buyerrecon_scoring_worker`
    (014:264);
  - `migrations/015_poi_sequence_observations_v0_1.sql:273` —
    `GRANT SELECT, INSERT, UPDATE ON poi_sequence_observations_v0_1 TO
    buyerrecon_scoring_worker` **plus** the sequence grant
    `... poi_sequence_observations_v0_1_poi_sequence_observation_id_seq ...`
    (015:289).
  Granting membership would **inherit** all of these — violating the
  Stage-0-only boundary. Therefore the membership-only shape is **not used**;
  the direct-grant path above is the only recommended path.

The recommended role carries **only** the Stage 0 source/target privileges and
**nothing broader**.

---

## 3. Required Source Review Before Grant (local repo only; no production SQL)

Source review performed on this branch (base
`sprint2-architecture-contracts-d4cc2bf`). Findings ground the grant set:

- **`package.json`** → `"stage0:run": "tsx scripts/run-stage0-worker.ts"`.
- **`scripts/run-stage0-worker.ts`** → thin CLI; opens a `pg.Pool` from
  `DATABASE_URL` (masked to host/db only; never printed) and calls
  `runStage0Worker`.
- **`src/scoring/stage0/run-stage0-worker.ts`** → the write path
  (`UPSERT_SQL`):
  `INSERT INTO stage0_decisions (workspace_id, site_id, session_id,
  stage0_version, scoring_version, excluded, rule_id, rule_inputs,
  evidence_refs, record_only, source_event_count) VALUES (…)
  ON CONFLICT (workspace_id, site_id, session_id, stage0_version,
  scoring_version) DO UPDATE SET … updated_at = now()
  RETURNING stage0_decision_id, excluded, rule_id`.
- **`src/scoring/stage0/extract-stage0-inputs.ts`** → the read path: `SELECT …
  FROM accepted_events …` and a `LEFT JOIN ingest_requests …` (other names —
  `candidate_sessions`, `session_events`, etc. — are **CTEs / derived**, not base
  relations).
- **`migrations/012_stage0_decisions.sql`** → `stage0_decisions.stage0_decision_id
  UUID PRIMARY KEY DEFAULT gen_random_uuid()` (**no sequence**), and existing
  grants: `GRANT SELECT, INSERT, UPDATE ON stage0_decisions TO
  buyerrecon_scoring_worker` (+ `GRANT ALL … TO buyerrecon_migrator`, `SELECT …
  TO buyerrecon_internal_readonly`).

**Resulting required relations / operations (source-grounded):**

| Relation | Operation(s) | Source | Status |
|---|---|---|---|
| `accepted_events` | `SELECT` | `extract-stage0-inputs.ts` | VERIFIED (also PR #167 proof) |
| `ingest_requests` | `SELECT` | `extract-stage0-inputs.ts` (LEFT JOIN) | VERIFIED (also PR #167 proof) |
| `stage0_decisions` | `SELECT`, `INSERT`, `UPDATE` | `run-stage0-worker.ts` UPSERT + RETURNING | VERIFIED (matches migration 012) |
| sequence (any) | `USAGE` | — | **NOT REQUIRED** — PK is `gen_random_uuid()`, no sequence default |
| schema-wide / other tables | — | — | **NOT REQUIRED** — `CANDIDATE — VERIFY BEFORE GRANT` if ever proposed |

No column-level narrowing is asserted here. The `buyerrecon_scoring_worker`
group-role grants are intentionally **not inherited** because that role includes
non-Stage-0 Risk/POI/POI-sequence surfaces. The recommended path remains
direct grants only: `accepted_events` `SELECT`, `ingest_requests` `SELECT`, and
`stage0_decisions` `SELECT/INSERT/UPDATE`. The membership-only shape remains
**rejected / superseded — do not use**. Any deviation (e.g. column-level grants)
is `CANDIDATE — VERIFY BEFORE GRANT`.

---

## 4. Candidate Command Pack (role + grants) — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for **one** bounded create/grant operator action. The password is
> supplied through a secure admin mechanism and **never** written in docs/logs.

### 4a. Recommended shape — direct least-privilege grants (no membership)
```sql
-- CANDIDATE ONLY — DO NOT RUN
-- Dedicated, Stage-0-only login role; password supplied securely by the admin
-- mechanism (NOT in this doc). Direct grants only — NO group membership, so it
-- cannot inherit Risk/POI/POI-Sequence surfaces held by buyerrecon_scoring_worker.
CREATE ROLE buyerrecon_stage0_runner
  LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'STAGE0_RUNNER_PW';            -- value injected by admin tooling; never echoed/committed

GRANT SELECT                  ON TABLE public.accepted_events  TO buyerrecon_stage0_runner;
GRANT SELECT                  ON TABLE public.ingest_requests  TO buyerrecon_stage0_runner;
GRANT SELECT, INSERT, UPDATE  ON TABLE public.stage0_decisions TO buyerrecon_stage0_runner;
-- No sequence USAGE (PK is gen_random_uuid()). No schema-wide grants. No ownership.
-- No grants to collector/extractor/risk/POI/POI-sequence/Lane/scoring/AMS/customer/Gate paths.
-- No GRANT buyerrecon_scoring_worker TO buyerrecon_stage0_runner.
```

### 4b. REJECTED / SUPERSEDED — DO NOT USE — membership-only shape
```sql
-- REJECTED / SUPERSEDED — DO NOT USE — DO NOT RUN
-- Reason: buyerrecon_scoring_worker is NOT Stage-0-only — it holds Risk/POI/
-- POI-Sequence table+sequence grants (migrations 013:165, 014:243/264, 015:273/289).
-- Granting membership would inherit those non-Stage-0 surfaces, violating the
-- Stage-0-only boundary. Retained for audit trail only; use §4a instead.
--
--   GRANT buyerrecon_scoring_worker TO buyerrecon_stage0_runner;   -- DO NOT USE
```

The password is **never** placed in this doc, the repo, logs, or any artifact;
it is supplied at run time via the secure admin mechanism (e.g. a psql
`\set STAGE0_RUNNER_PW` from a protected source, or managed-secret injection).

---

## 5. Dedicated-Role Proof Command Pack — CANDIDATE ONLY — DO NOT RUN

> Establishes only safe labels/booleans; no Stage 0 command; no run-lock touch.
> Prefer **metadata** privilege checks (`has_table_privilege`,
> `has_column_privilege`, `has_sequence_privilege`) over live DML.

### 5a. Catalog / privilege proof (any admin connection; read-only; booleans only)
```sql
-- CANDIDATE ONLY — DO NOT RUN — booleans/labels only; no DML.
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

SELECT 'role_exists|'        || EXISTS (SELECT 1 FROM pg_roles WHERE rolname='buyerrecon_stage0_runner')::text;
SELECT 'role_can_login|'     || COALESCE((SELECT rolcanlogin   FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;
SELECT 'role_is_superuser|'  || COALESCE((SELECT rolsuper      FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;  -- expect false
SELECT 'role_createdb|'      || COALESCE((SELECT rolcreatedb   FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;  -- expect false
SELECT 'role_createrole|'    || COALESCE((SELECT rolcreaterole FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;  -- expect false
SELECT 'role_replication|'   || COALESCE((SELECT rolreplication FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text; -- expect false
SELECT 'role_bypassrls|'     || COALESCE((SELECT rolbypassrls  FROM pg_roles WHERE rolname='buyerrecon_stage0_runner'),false)::text;  -- expect false

-- Required Stage 0 privileges present (metadata checks; expect true):
SELECT 'priv_accepted_events_select|'  || has_table_privilege('buyerrecon_stage0_runner','public.accepted_events','SELECT')::text;
SELECT 'priv_ingest_requests_select|'  || has_table_privilege('buyerrecon_stage0_runner','public.ingest_requests','SELECT')::text;
SELECT 'priv_stage0_select|'           || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','SELECT')::text;
SELECT 'priv_stage0_insert|'           || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','INSERT')::text;
SELECT 'priv_stage0_update|'           || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','UPDATE')::text;

-- Membership absence (expect false): must NOT be a member of buyerrecon_scoring_worker
SELECT 'not_member_scoring_worker|'    || (NOT pg_has_role('buyerrecon_stage0_runner','buyerrecon_scoring_worker','MEMBER'))::text;

-- NEGATIVE PROOF — non-Stage-0 inherited/broader privileges ABSENT (all expect false):
-- Risk surface (migration 013):
SELECT 'forbidden_risk_select|'        || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','SELECT')::text;
SELECT 'forbidden_risk_insert|'        || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','INSERT')::text;
SELECT 'forbidden_risk_update|'        || has_table_privilege('buyerrecon_stage0_runner','public.risk_observations_v0_1','UPDATE')::text;
-- POI surface (migration 014) + its sequence:
SELECT 'forbidden_poi_select|'         || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','SELECT')::text;
SELECT 'forbidden_poi_insert|'         || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','INSERT')::text;
SELECT 'forbidden_poi_update|'         || has_table_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1','UPDATE')::text;
SELECT 'forbidden_poi_seq_usage|'      || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','USAGE')::text;
SELECT 'forbidden_poi_seq_select|'     || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','SELECT')::text;
SELECT 'forbidden_poi_seq_update|'     || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_observations_v0_1_poi_observation_id_seq','UPDATE')::text;
-- POI-Sequence surface (migration 015) + its sequence:
SELECT 'forbidden_poiseq_select|'      || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','SELECT')::text;
SELECT 'forbidden_poiseq_insert|'      || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','INSERT')::text;
SELECT 'forbidden_poiseq_update|'      || has_table_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1','UPDATE')::text;
SELECT 'forbidden_poiseq_seq_usage|'   || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','USAGE')::text;
SELECT 'forbidden_poiseq_seq_select|'  || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','SELECT')::text;
SELECT 'forbidden_poiseq_seq_update|'  || has_sequence_privilege('buyerrecon_stage0_runner','public.poi_sequence_observations_v0_1_poi_sequence_observation_id_seq','UPDATE')::text;
-- Stage 0 target hard-delete + Lane / scoring-output customer-visible surfaces:
SELECT 'forbidden_stage0_delete|'      || has_table_privilege('buyerrecon_stage0_runner','public.stage0_decisions','DELETE')::text;
SELECT 'forbidden_lane_a_any|'         || has_table_privilege('buyerrecon_stage0_runner','public.scoring_output_lane_a','INSERT')::text;
SELECT 'forbidden_lane_b_any|'         || has_table_privilege('buyerrecon_stage0_runner','public.scoring_output_lane_b','INSERT')::text;

-- Ownership absence (expect 0 rows / false): role owns no application tables
SELECT 'owns_no_tables|' || (NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
  WHERE r.rolname = 'buyerrecon_stage0_runner' AND c.relkind IN ('r','p')
))::text;
```

If any `forbidden_*` label is `true`, or `not_member_scoring_worker` /
`owns_no_tables` is `false`, the proof **fails** and the role must not be used
for Stage 0 until corrected.

### 5b. Dedicated-DSN identity gate (only if a connect proof is required)

If a proof must connect **as** `buyerrecon_stage0_runner` via its dedicated DSN,
reuse the **PR #177 reviewed DSN handling** verbatim in principle:
- hidden DSN input (`read -r -s`); **no DSN printing**;
- inline structural validator requiring **`user==buyerrecon_stage0_runner`** and
  **`db==buyerrecon_production`** (booleans only) **before** `psql`;
- raw `psql` stdout/stderr → chmod-600 temp file, **never** printed;
- wired residue scan on all paths; **fail closed**;
- safe labels only: `current_user_expected|true`, `current_db_expected|true`,
  `session_readonly_off|true`; **no** Stage 0 command; **no** run-lock touch;
- **no DML** beyond an explicitly-reviewed, rollback-contained probe (prefer the
  §5a metadata checks instead).

---

## 6. Stop-Lines

Abort if any of the following:
- PR #178 merge commit `466a5493e46d0f5a7ac855357819efbf3a025970` not present;
- source-review of Stage 0 SQL needs incomplete (relations/operations not
  grounded in current code);
- dedicated role name ambiguous / conflicts with an existing role;
- password / DSN custody for the dedicated role unresolved;
- any real secret (password / DSN / token) would need to be committed or printed;
- **any membership in `buyerrecon_scoring_worker` is proposed for
  `buyerrecon_stage0_runner`** (rejected — that group is not Stage-0-only);
- **`buyerrecon_stage0_runner` inherits any non-Stage-0 privilege** (via any
  membership or default ACL);
- **any Risk table privilege** (`risk_observations_v0_1`) is present;
- **any POI table or sequence privilege** (`poi_observations_v0_1` /
  `poi_observations_v0_1_poi_observation_id_seq`) is present;
- **any POI-Sequence table or sequence privilege**
  (`poi_sequence_observations_v0_1` /
  `poi_sequence_observations_v0_1_poi_sequence_observation_id_seq`) is present;
- any Lane / scoring / AMS / customer-output privilege is present;
- candidate grants exceed the Stage 0 required relations (§3);
- broad schema-wide / extra-table grants proposed without justification;
- any sequence grant is proposed without proving Stage 0 needs it (today: none —
  PK is `gen_random_uuid()`);
- the role would be SUPERUSER / CREATEDB / CREATEROLE / REPLICATION / BYPASSRLS
  / a table owner;
- the proof cannot establish the expected `current_user` / `current_database`;
- **the proof cannot establish negative privilege absence** (any `forbidden_*`
  label is `true`, or `not_member_scoring_worker` / `owns_no_tables` is `false`);
- the proof would print raw DSN / password / token / host / IP / user / row data;
- a Stage 0 command would run **before** the dedicated-role proof passes;
- the run lock would be touched;
- any extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F action would occur.

If a stop-line is hit, record the blocked state in a docs-only evidence PR before
further action.

---

## 7. Explicit Non-Authorizations

This PR does **not** authorize:
- creating the role;
- setting / changing any password;
- creating / changing any DSN;
- SQL execution;
- grants;
- role changes;
- DML / DDL;
- Stage 0 execution;
- run-lock touch;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

---

## 8. Next Gated Sequence

1. Open this docs-only planning / command-pack PR.
2. **Codex narrow review** (planning safety, source grounding, least-privilege
   posture, secret-safety).
3. **Merge if PASS.**
4. **Helen explicit GO** for **exactly one** bounded dedicated-role
   creation/grant/proof operator action.
5. Run **only** that bounded action on production (operator on the host; password
   via secure admin mechanism; never printed).
6. Create a **docs-only evidence PR** (safe labels/booleans only).
7. **Only if the dedicated-role proof passes**, Helen may issue a **separate
   Stage 0 execution GO** (then the §5b-style dedicated-DSN gate + one Stage 0
   gated run + evidence PR).

---

## Safety / Raw-Data Boundary

This record contains no real password, DSN URI, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The `:'STAGE0_RUNNER_PW'`
placeholder is a psql variable reference for an admin-injected value — **not** a
secret. All identifier references are role / database / relation / column names,
SQL identifiers, env-var names, the masked `tsx scripts/run-stage0-worker.ts`
mapping, or stop-line / boundary language — not secret or row values. Any
dedicated-role password/DSN is supplied via the secure admin mechanism and never
committed or printed.
