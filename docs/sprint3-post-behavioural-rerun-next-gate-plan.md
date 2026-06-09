# Sprint 3 — Post-Behavioural Rerun Next-Gate Decision Plan

**Status:** `POST_BEHAVIOURAL_RERUN_NEXT_GATE_DECISION_PLANNING_ONLY`

This is a **docs-only planning / decision record**. It defines the **next
smallest safe gate** after the behavioural extractor rerun passed (PR #158), to
prevent an accidental leap from "extractor passed" to "pipeline / customer
readiness."

This PR **executes nothing**: no production command, no SQL, no runtime, no
extractor rerun, no worker/downstream, no Lane/scoring/AMS/customer output, no
Gate 4E/4F, no GRANT/DML/DDL.

---

## 1. Status

Status: `POST_BEHAVIOURAL_RERUN_NEXT_GATE_DECISION_PLANNING_ONLY`. Planning
only; recommends the next gate; authorizes no execution.

---

## 2. Inputs / Proven State

- **PR #157** — Option B grant-fix proof merged
  (`68f23ec2a7170358ec2e7f99be735992348ee192`,
  status `BEHAVIOURAL_OPTION_B_GRANT_FIX_EXECUTED_PROOF`): table-level SELECT
  granted on `public.session_behavioural_features_v0_2` to
  `buyerrecon_prod_collector_app`; post-fix privilege proof passed
  (table_select true; column SELECT 5→37; INSERT/UPDATE/sequence USAGE
  unchanged; sequence SELECT false).
- **PR #158** — behavioural extractor rerun PASS evidence merged
  (`c04281230323b8b9dc273766f262c3a3a8418278`,
  status `BEHAVIOURAL_EXTRACTOR_RERUN_PASS_AFTER_OPTION_B_GRANT_FIX`):
  - `feature_version=behavioural-features-v0.3`
  - `rows_upserted=1`
  - `exit_code=0`
  - app role verified in `buyerrecon_production`
  - prior `session_behavioural_features_v0_2` permission denied
    (`42501 / aclcheck_error`) blocker resolved **for this rerun only**.

---

## 3. Bounded Interpretation

- The **behavioural extractor rerun passed**.
- This does **not** prove downstream readiness.
- This does **not** prove Stage 0 / risk / POI / evidence snapshot / Lane A/B /
  scoring / AMS Trust/Pass / customer-output readiness.
- This does **not** authorize any runtime.

The proven scope is exactly: one behavioural extractor rerun succeeded after the
Option B grant-fix. Nothing broader.

---

## 4. What Remains Unproven

- Stage 0 readiness;
- risk worker readiness;
- POI worker readiness;
- evidence snapshot readiness;
- Lane A/B preview readiness;
- scoring runtime readiness;
- AMS Trust/Pass runtime readiness;
- customer output readiness;
- Gate 4E / Gate 4F readiness;
- downstream privilege sufficiency (for the next worker role(s));
- downstream script / config / input readiness.

---

## 5. Candidate Next Gates

- **Option A — read-only downstream readiness snapshot first** *(recommended)*:
  a future, separately-GO'd, read-only snapshot using booleans/counts/metadata
  only to inventory downstream readiness before any write/runtime.
- **Option B — run the next worker directly** *(rejected / not recommended)*:
  downstream readiness is unproven; running a worker now risks acting on an
  unverified state.
- **Option C — create a broad pipeline execution GO** *(rejected / not
  allowed)*: would collapse multiple gates into one and defeat evidence-led
  sequencing.
- **Option D — rerun the extractor again** *(not needed)*: the rerun already
  passed; a further rerun is unnecessary unless separately justified.

---

## 6. Recommended Decision

**Choose Option A — `Gate S3-NG1: read-only downstream readiness snapshot`.**

Rationale:
- preserves evidence-led sequencing;
- avoids jumping from extractor success to pipeline success;
- can identify the **smallest next runtime candidate** (e.g. whether Stage 0,
  risk, POI, evidence snapshot, or another preflight should come first);
- keeps all future writes separately gated.

This PR records the decision; it does **not** execute the snapshot.

---

## 7. Future Snapshot Scope — Planning Only (`Gate S3-NG1`)

The future read-only snapshot (separate GO required) may inspect, at planning
level only:
- behavioural feature output existence/counts by `feature_version`;
- expected target/source tables presence;
- table/column privilege booleans for the next worker role(s), if known;
- whether required scripts are present;
- whether required observer/evidence-snapshot scripts exist;
- whether Stage 0 / risk / POI / evidence-snapshot inputs appear structurally
  present;
- whether any known warning/blocker remains from earlier docs;
- whether the next execution candidate should be Stage 0, risk, POI, evidence
  snapshot, or another preflight.

Allowed future snapshot categories (hard constraints):
- **metadata only**; **booleans/counts only**;
- **no** row values; **no** raw identifiers; **no** payload/customer data;
- **no** secrets; **no** writes; **no** GRANT/DML/DDL; **no** runtime workers.

This PR does **not** run the snapshot.

---

## 8. Future Snapshot Evidence Requirements

The future `Gate S3-NG1` proof (after its own GO) should record:
- branch / base / commit;
- role / database gates;
- read-only transaction gate;
- script presence checks;
- table/column/sequence privilege booleans if applicable;
- source/target table existence;
- aggregate counts only;
- stop-line results;
- a recommendation for the next smallest execution gate.

All booleans/counts/metadata only — no row values, identifiers, payloads,
secrets.

---

## 9. Stop-Lines

The future snapshot (and this PR) must stop / must never do:
- any write attempt;
- any row value printed;
- any raw identifier printed;
- any payload/customer data printed;
- any DSN/password/token printed;
- any GRANT/DML/DDL;
- any worker/downstream runtime;
- any Lane/scoring/AMS/customer output;
- any Gate 4E/4F action;
- any attempt to bundle multiple runtime steps;
- any attempt to treat extractor PASS as pipeline readiness.

---

## 10. Explicit Non-Authorization

This PR is **docs-only** and authorizes **none** of the following:
- no production command;
- no SQL;
- no runtime;
- no extractor rerun;
- no worker / downstream runtime;
- no Stage 0 / risk worker / POI worker / evidence snapshot / Lane A/B /
  scoring runtime / AMS Trust/Pass runtime / customer output / Gate 4E /
  Gate 4F;
- no grant / fix; no GRANT/DML/DDL.

---

## 11. Next Step After This PR

After **Codex review and merge** of this planning PR, the next action is a
**separate command-pack / GO PR** for
`Gate S3-NG1: read-only downstream readiness snapshot` — **not** execution.
Execution of the snapshot requires its own separate explicit Helen GO; any
downstream worker/runtime requires its own separate planning, review, and
explicit GO after the snapshot evidence is reviewed.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / table / column / version / gate names or planning concepts
— not business row values.
