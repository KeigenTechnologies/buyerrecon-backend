# Sprint 3 — Post-Step2E Next Downstream-Readiness Decision Plan (Docs-Only)

**Status:** `POST_STEP2E_NEXT_DOWNSTREAM_READINESS_PLANNING_ONLY`

This is a **docs-only planning / decision record**. It answers one question:

> What is the next **smallest safe downstream-readiness proof** after the Step2E
> aggregate proof PASS, **before** any customer-visible output or Gate4E/Gate4F
> step?

This PR **executes nothing**: no production command, no SQL, no psql, no
runtime, no Step2E rerun, no Stage0 rerun, no Route C, no worker / downstream
extractor, no Lane/scoring, no AMS runtime, no customer output, no Gate4E, no
Gate4F, no GRANT/DML/DDL, no role change. It records a decision and a *proposed*
future command-pack shape that is explicitly marked **DO NOT RUN**.

> Provenance of current base: PR #318 merge
> `fc280f383e17efea6354e2bd9c09195fd0425cfa` on
> `sprint2-architecture-contracts-d4cc2bf`.

---

## 1. Current proven state

| Item | Source | Proven fact (aggregate/boolean only) |
| --- | --- | --- |
| Step2E behavioural rerun | PR #317 (`STEP2E_SANITIZED_RERUN_PASS`) | `step2e_exit_code=0`, `step2e_failure_category=none`, `step2e_sanitized_rerun_result=pass`; `db_mutation_executed=unknown` (raw output intentionally not printed) |
| Step2E post-run aggregate proof | PR #318 (`STEP2E_POSTRUN_ADMIN_AGGREGATE_PROOF_PASS`) | `proof_execution_path=local_postgres_admin`, `transaction_read_only=true`, `db_mutation_executed=false` for the proof |
| `session_behavioural_features_v0_2` | PR #318 | present; `session_behavioural_features_row_count=1` |
| `session_features` | PR #318 | present; `session_features_aggregate_count=1` |
| `accepted_events` | PR #318 | present; `accepted_events_aggregate_count=12` |
| Collector required privileges | PR #318 | `accepted_events` SELECT, `session_behavioural_features_v0_2` SELECT/INSERT/UPDATE, `session_features` SELECT all `true` |
| No-stage0-grant boundary | PR #318 | `collector_stage0_decisions_select_privilege=false` (intact) |
| Stage 0 execution | `STAGE0_EXECUTION_PASS` evidence (PRs #306–#308 chain) | one Stage 0 command exited 0 under `buyerrecon_stage0_runner`; **`stage0_decisions` output NOT aggregate-proven** |
| Stage 0 read-source SELECT | `STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS` (PR #166) | read-source SELECT gap was resolved for `buyerrecon_scoring_worker` at that time |

**Bounded interpretation:** Step2E feature outputs exist at **aggregate/count
level only**. That is the *entire* proven scope of PR #317 + PR #318. Nothing
about customer-output readiness, downstream-worker readiness, or Gate readiness
is proven by it.

---

## 2. What is still not proven

- Whether Stage 0's output table `stage0_decisions` is **present and populated**
  at aggregate level after the recorded `STAGE0_EXECUTION_PASS` (Stage 0 exited
  0, but — exactly like Step2E's `db_mutation_executed=unknown` — its row-level
  result was not printed and has not been aggregate-proven).
- Whether the **immediate downstream consumers of Step2E output** have their
  *inputs* ready. Per the activation sequence (see §4), the workers that consume
  `session_behavioural_features_v0_2` / `session_features` also depend on
  `stage0_decisions`:
  - risk evidence worker reads `stage0_decisions` + `session_behavioural_features_v0_2`;
  - POI core worker reads `session_features` + `stage0_decisions`.
- Whether the **next consuming worker role** holds the required SELECT (read
  sources) and INSERT/UPDATE (write target) privilege booleans.
- Downstream **script / config / input** structural readiness for the next
  worker.
- Risk / POI / evidence-snapshot readiness.
- Lane A/B preview readiness; scoring runtime readiness; AMS Trust/Pass runtime
  readiness.
- Customer-output readiness.
- Gate4E / Gate4F readiness.

---

## 3. Why not Gate4E/Gate4F yet

- **Gate4E** is the separate Track A / Playwright gate, and **Gate4F is not
  invented** (it has been explicitly left undefined in every prior planning
  record). Both sit far past the worker-evidence layer.
- Between the current proven state and any customer-visible output there are
  multiple **unproven** layers: Stage 0 output presence → risk / POI evidence
  workers → evidence snapshot → report contract → safe-claims governance → Lane
  governance → Gate 4A/4B/4C/4D production-activation track. None of these are
  proven by an extractor PASS plus a feature-table aggregate proof.
- The governance locks remain in force and must not be relaxed: `lane_write_allowed=false`,
  `customer_visibility_allowed=false`, `customer_claim_allowed=false`,
  `lane_output_allowed=false`, Lane A/B counts `0/0`, empty safe-claims
  dictionary. Opening Gate4E/4F now would collapse several independently gated
  proofs into one and defeat evidence-led sequencing.
- Therefore Gate4E/Gate4F are **out of scope** for the next step. The next step
  must be the *smallest* read-only proof that advances readiness by exactly one
  link in the dependency chain.

---

## 4. Candidate next proof options

Dependency context (consumers of Step2E output need `stage0_decisions`):

```
Step2E output (PROVEN at aggregate level: behavioural=1, session_features=1)
  │
  ├── Stage 0 output `stage0_decisions`  ← executed PASS, presence NOT aggregate-proven
  │
  ├── risk evidence worker   (reads stage0_decisions + session_behavioural_features_v0_2)
  ├── POI core / sequence    (reads session_features + stage0_decisions)
  │
  ├── evidence snapshot (read-only)
  └── report / Lane governance / Gate 4A–4E … (much later, separately gated)
```

| Option | Shape | Verdict |
| --- | --- | --- |
| **A. Stage 0 output + next-consumer readiness aggregate/boolean proof** (read-only, local-admin path; mirrors PR #318 one stage downstream) | Confirm `stage0_decisions` present + aggregate count; confirm next consuming worker role privilege booleans; re-confirm Step2E output counts unchanged. No worker run. | **Recommended** — smallest reversible, observable, read-only step that closes the exact unproven link gating the next worker. |
| B. Run the risk evidence worker directly | Execute `scripts/run-risk-evidence-worker.ts`. | **Rejected** — its input `stage0_decisions` presence is unproven and its role privileges unverified; this is runtime on an unverified state. |
| C. Re-run Stage 0 | Re-execute the Stage 0 worker. | **Rejected** — Stage 0 already recorded `STAGE0_EXECUTION_PASS`; a rerun is unjustified runtime, not a proof. |
| D. Jump to Lane/scoring / customer output / Gate4E/4F | Activate downstream output. | **Rejected** — many unproven layers in between; violates §3 and the governance locks. |
| E. Privilege-booleans-only re-confirmation (no `stage0_decisions` count) | Re-confirm Step2E output counts + next-consumer privilege booleans only. | **Acceptable fallback** if local-admin aggregate read of `stage0_decisions` is constrained; provides less forward progress than Option A. |

---

## 5. Recommended next smallest safe proof

**Choose Option A — a read-only, local-admin-path, aggregate/boolean
post-Stage0 downstream-input readiness proof**, gated by its own separate
explicit Helen GO.

This is the direct analog of PR #318 (`STEP2E_POSTRUN_ADMIN_AGGREGATE_PROOF_PASS`)
applied **one stage downstream**. It is the smallest reversible / observable /
read-only path that converts the next unproven dependency link into an aggregate
fact, **without running any worker**.

Rationale:
- It preserves evidence-led sequencing — it advances readiness by exactly one
  link (Stage 0 output presence + next-consumer privilege readiness).
- It is **read-only** and **reversible** (read-only transaction, rollback, no
  COMMIT, local-admin path, not the collector DSN, not a worker DSN runtime).
- It emits **booleans / counts / category labels only** — no row data, no
  identifiers, no payloads.
- It does **not** authorize or perform any worker, grant, or customer output.

What must be proven next (aggregate/boolean only — no row values):
- `stage0_decisions_table_present` (boolean).
- `stage0_decisions_aggregate_count` (count only; presence/populated signal).
- `session_behavioural_features_row_count`, `session_features_aggregate_count`,
  `accepted_events_aggregate_count` re-confirmed unchanged (counts only).
- Next consuming worker role **privilege booleans** via `has_table_privilege`:
  - SELECT on its read sources (`stage0_decisions`,
    `session_behavioural_features_v0_2` for the risk worker; `session_features`,
    `stage0_decisions` for the POI worker);
  - INSERT/UPDATE on its write target (`risk_observations_v0_1` /
    `poi_observations_v0_1`).
- Governance-lock confirmation (static): Lane A/B counts remain `0/0`;
  `lane_write_allowed=false`; `customer_visibility_allowed=false`.

**Recorded ambiguity (and the safer choice taken):** older planning
(`sprint3-worker-activation-evidence-snapshot-planning.md`) lists Stage 0 as
reading `session_features`, while later resolution (PR #164 /
`STAGE0_SCORING_WORKER_PREFLIGHT_BLOCKED_READ_SOURCE_SELECT_MISSING` and the
`STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS` proof) treats Stage 0 read sources
as `accepted_events` + `ingest_requests`, and the executed identity in
`STAGE0_EXECUTION_PASS` is `buyerrecon_stage0_runner` rather than
`buyerrecon_scoring_worker`. Because of this unresolved role/read-source
ambiguity, the recommended next proof is deliberately the **smaller, safer
read-only aggregate/boolean snapshot** (Option A) that *observes* presence and
privilege booleans only. It does **not** assert, recommend, or apply any grant
or role change; if a privilege gap is observed, resolving it is a **separate**
planning + review + GO step, never bundled into this proof.

---

## 6. Proposed future command-pack shape — **DO NOT RUN**

> **PLANNING ONLY. DO NOT RUN.** The block below is an illustrative *shape* for
> a future, separately-reviewed, separately-GO'd read-only proof. It is **not**
> authorized by this PR, contains **no** real connection values, and must not be
> executed here. Execution requires its own explicit scoped Helen GO.

Shape (categorical description, not an executable artifact):

- **Path:** local PostgreSQL admin, read-only — **not** the collector DSN and
  **not** a worker runtime DSN. The connection value is never printed.
- **Transaction:** a single `BEGIN; SET TRANSACTION READ ONLY; … ROLLBACK;`
  envelope — no COMMIT, no write.
- **Checks (booleans / counts / labels only):**
  - table-presence booleans for `stage0_decisions` and the Step2E output tables;
  - `COUNT(*)` aggregates only (no row content, no `WHERE` on identifiers);
  - `has_table_privilege(role, table, 'SELECT'|'INSERT'|'UPDATE')` booleans for
    the next consuming worker role on its read sources and write target;
  - static governance-lock confirmations.
- **Emission:** safe labels only — e.g.
  `stage0_decisions_table_present=…`, `stage0_decisions_aggregate_count=…`,
  `<role>_<table>_select_privilege=…`, `lane_a_row_count=0`, `lane_b_row_count=0`,
  `proof_execution_path=local_postgres_admin`, `transaction_read_only=true`,
  `db_mutation_executed=false`.
- **Forbidden in the future pack:** any row value, raw identifier, payload,
  `canonical_jsonb`, `request_id` / `session_id`, IP, user agent, header, body,
  DSN, host, port, env value, credential, raw PostgreSQL error text, or
  `pg_hba` line; any GRANT/DML/DDL; any worker / extractor / Stage0 / Route C
  run; any Lane/scoring/AMS/customer output; any Gate4E/Gate4F action.

This PR does **not** run, stage, or authorize the block above.

---

## 7. Stop-lines

The future proof (and this PR) must stop / must never do:

- any write attempt; any COMMIT; any GRANT/DML/DDL; any role change;
- any worker / downstream extractor / Stage0 / Route C / Step2E run or rerun;
- any Lane/scoring run; any AMS runtime; any customer-visible output;
- any Gate4E opening, Gate4F invention, or readiness/auto-advance language;
- any row value, raw identifier, payload, `canonical_jsonb`, `request_id` /
  `session_id`, IP, user agent, header, body value printed;
- any DSN, host, port, env value, credential, raw PostgreSQL error, or `pg_hba`
  line printed;
- any bundling of multiple runtime steps into one;
- any treatment of a Step2E aggregate PASS (or a future Stage 0 aggregate PASS)
  as pipeline or customer-output readiness.

If any stop-line would be crossed, halt and record the stop-line instead.

---

## 8. Explicit non-authorization statement

This PR is **docs-only** and authorizes **none** of the following:

- no production command; no SQL; no psql; no runtime;
- no Step2E rerun; no Stage0 rerun; no Route C rerun;
- no worker / downstream extractor run;
- no Lane/scoring; no AMS runtime; no customer output;
- no Gate4E; no Gate4F;
- no GRANT/REVOKE, DML, DDL, role change, or any DB mutation;
- no DSN / host / port / env / secret inspection or printing.

The recommended next proof (Option A), and any downstream worker/runtime, each
require their **own** separate planning, review, and explicit scoped Helen GO.
This record changes **no** current boundary and relaxes **no** governance lock.

---

## 9. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, raw stdout/stderr, or
env-var value. The table names (`accepted_events`, `ingest_requests`,
`session_behavioural_features_v0_2`, `session_features`, `stage0_decisions`,
`risk_observations_v0_1`, `poi_observations_v0_1`), the role names
(`buyerrecon_prod_collector_app`, `buyerrecon_scoring_worker`,
`buyerrecon_stage0_runner`), the script path references, and the recorded commit
hashes are **non-secret** repository / role / public-git identifiers. All values
above are safe labels / booleans / counts / category tokens / non-secret
identifiers / public git commit hashes — not secret or row values. **This PR
runs nothing.**

---

## 10. Next-step recommendation

After **review and merge** of this planning PR, the next action is a **separate
command-pack / GO PR** for the **read-only, local-admin-path, aggregate/boolean
post-Stage0 downstream-input readiness proof (Option A)** — **not** execution.
That proof:

- requires its own explicit scoped Helen GO;
- runs read-only (rollback, no COMMIT), via the local-admin path, not the
  collector DSN and not a worker runtime DSN;
- emits booleans / counts / category labels only;
- proves `stage0_decisions` presence + aggregate count and the next consuming
  worker's privilege booleans, re-confirming Step2E output counts;
- authorizes **no** worker, grant, role change, Lane/scoring, AMS runtime,
  customer output, Gate4E, or Gate4F.

Any worker activation, grant, downstream runtime, or Gate step after that proof
requires its **own** separate planning, review, and explicit scoped Helen GO,
reviewed against the evidence the proof records.
