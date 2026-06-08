# Sprint 3: Behavioural Output Grant Fix — Revised Plan (Candidate)

**Status:** `BEHAVIOURAL_GRANT_REVISED_PLAN_CANDIDATE_ONLY`

This is a **docs-only revised grant-fix planning record**. It proposes a
revised least-privilege candidate for granting the behavioural features
extractor write access to `public.session_behavioural_features_v0_2`, based
on the diagnostic evidence merged in PR #138.

This PR is **planning only**. It applies **no** GRANT, runs **no** DML/DDL,
runs **no** production command, runs **no** extractor rerun, and runs **no**
worker or downstream runtime. All SQL below is **candidate only — do not
run**. Nothing here is authorized for execution.

---

## 1. Problem & Evidence Basis

- **PR #136** (merge `1a18bb579e329e603e97bb0b56505bc5164d97eb`): the single
  authorized extractor rerun failed with
  `permission denied for table session_behavioural_features_v0_2`
  (`extractor_exit_code=1`).
- **PR #138** (merge `4e7259a6f4ffd0e1df47cdd376a7c4de0440855f`): read-only,
  transaction-rolled-back catalog privilege probes confirmed, as role
  `buyerrecon_prod_collector_app` in `buyerrecon_production`:
  - Column-scoped **INSERT** grants present for all 36 extractor insert columns.
  - Column-scoped **UPDATE** grants present for all 32 `DO UPDATE SET` columns.
  - Limited **SELECT** present for `behavioural_features_id`, `feature_version`,
    `session_id`, `site_id`, `workspace_id` (covers RETURNING + conflict-target).
  - Sequence `USAGE=true`, sequence `SELECT=false`.
  - Table-level `SELECT/INSERT/UPDATE` (and `DELETE/TRUNCATE/REFERENCES/TRIGGER`)
    all remain **false**.

So the column-scoped grants and sequence USAGE are present, yet the extractor
still failed at runtime. PR #138 made **table-level INSERT/UPDATE** the next
evidence-backed planning direction to investigate — **without** claiming it
is the proven final cause.

This planning PR carries that framing forward: it proposes a candidate to
**verify**, not a confirmed root-cause fix. It does not fix or rerun anything.

---

## 2. What Is Proven vs Hypothesis vs Candidate Posture

To keep the justification honest, the three layers are kept separate:

### 2a. Proven by PR #138 (evidence)
- The role holds complete column-scoped INSERT/UPDATE across the extractor's
  column set, the needed limited SELECT, and sequence USAGE.
- Table-level SELECT/INSERT/UPDATE are false.
- The rerun (PR #136) nonetheless failed `permission denied for table …`.

### 2b. Hypothesis / planning direction (NOT proven)
- In standard PostgreSQL, **column-level INSERT/UPDATE privileges are normally
  sufficient** for an `INSERT … ON CONFLICT … DO UPDATE … RETURNING` statement
  whose `DO UPDATE SET` right-hand sides are all `EXCLUDED.*` (no reads of
  existing row values). That is why the persistent failure *despite* complete
  column coverage is **anomalous** and not yet fully explained.
- The leading evidence-backed direction is therefore that this path may
  require **table-level INSERT and/or UPDATE** in this environment. This is a
  **candidate to verify**, not a definitive cause. Other possibilities not
  yet excluded (to be checked during verification) include: a runtime/grant
  state mismatch versus the catalog probe, default-privilege interactions, or
  a column the runtime statement touches that was outside the probe set.
- **Table-level SELECT is *not* currently justified.** RETURNING reads only
  columns already covered by the limited column SELECT, and the conflict
  arbiter columns are likewise covered; the `DO UPDATE SET` clause reads no
  existing row values. Absent new evidence, table-level SELECT is **excluded**
  from the candidate (see §4).

### 2c. Candidate posture (this PR)
- Add only the **minimum likely-missing table-level privileges** (INSERT,
  UPDATE) needed for the existing extractor path.
- **Keep** existing column-scoped INSERT/UPDATE/SELECT grants.
- **Keep** sequence USAGE; **keep** sequence SELECT denied.
- **Do not** grant DELETE/TRUNCATE/REFERENCES/TRIGGER.
- **Do not** grant any Lane/scoring/customer/AMS/Gate privilege.
- This posture is candidate-only and must be verified by a post-fix proof.

---

## 3. Revised Least-Privilege Candidate Design

Target table: `public.session_behavioural_features_v0_2`
Target role: `buyerrecon_prod_collector_app`
Target database: `buyerrecon_production`

| Privilege | Current (PR #138) | Candidate | Rationale |
|---|---|---|---|
| Column INSERT (36 cols) | present | **keep** | already proven present; extractor writes these |
| Column UPDATE (32 cols) | present | **keep** | already proven present; conflict path updates these |
| Column SELECT (5 cols) | present | **keep** | covers RETURNING + conflict-target |
| Table INSERT | false | **add (candidate)** | minimal escalation to test the table-level hypothesis for the upsert path |
| Table UPDATE | false | **add (candidate)** | minimal escalation for the `ON CONFLICT DO UPDATE` branch |
| Table SELECT | false | **do not add** | not justified by current evidence (RETURNING/arbiter already covered; SET reads no existing values) |
| Sequence USAGE | true | **keep** | required for `nextval` default on `behavioural_features_id` |
| Sequence SELECT | false | **keep denied** | not needed (no `currval`/`lastval`/sequence relation read) |
| DELETE / TRUNCATE / REFERENCES / TRIGGER | false | **do not add** | not used by the extractor path |
| Lane / scoring / customer / AMS / Gate | n/a | **do not add** | out of scope; not part of this write path |

Net change proposed by the candidate: **table-level INSERT + table-level
UPDATE only.** Everything else is unchanged. This is the smallest escalation
consistent with the PR #138 direction.

---

## 4. Candidate SQL Posture

> **CANDIDATE ONLY — DO NOT RUN**
> **requires Codex review + explicit Helen GO before execution**
> **not executed by this PR**

```sql
-- CANDIDATE ONLY — DO NOT RUN
-- requires Codex review + explicit Helen GO before execution
-- not executed by this PR
-- Target DB: buyerrecon_production  | Target role: buyerrecon_prod_collector_app
-- Wrap in BEGIN; verify role/db gates; COMMIT only under explicit GO.

GRANT INSERT ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;

GRANT UPDATE ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;

-- Intentionally NOT included (not justified by current evidence):
--   GRANT SELECT ON public.session_behavioural_features_v0_2 ...   (excluded)
--   GRANT SELECT ON <sequence> ...                                 (excluded)
--   GRANT DELETE / TRUNCATE / REFERENCES / TRIGGER ...             (excluded)
--   any Lane / scoring / customer / AMS / Gate privilege           (excluded)
-- Existing column-scoped INSERT/UPDATE/SELECT and sequence USAGE are kept as-is.
```

If — and only if — a separately-authorized verification step shows table-level
SELECT is genuinely required (e.g. a live, rolled-back write-path reproduction
that fails specifically on SELECT after INSERT/UPDATE are granted), a revised
candidate may add `GRANT SELECT` with that evidence cited. It is excluded here.

---

## 5. Future Execution Gates (before any fix is applied)

All of the following must hold before the candidate is executed:

1. This revised grant-fix planning PR reviewed and merged.
2. Codex narrow review returns PASS.
3. Explicit Helen GO to apply the revised fix.
4. DB verified as `buyerrecon_production` (gate before any statement).
5. Target role verified as `buyerrecon_prod_collector_app`.
6. No DSN / password / token printed at any point.
7. No extractor command run during the fix.
8. No worker / downstream command run during the fix.

The fix, when authorized, runs as a separate operator session wrapped in an
explicit transaction with the role/DB gates active.

---

## 6. Post-Fix Proof Requirements (separate proof PR)

A separate proof PR must record, as role `buyerrecon_prod_collector_app` in
`buyerrecon_production`:

- Intended revised grants applied (the candidate INSERT/UPDATE).
- Table-level INSERT status = as intended.
- Table-level UPDATE status = as intended.
- Table-level SELECT status = as intended (expected to remain false unless
  separately justified and approved).
- Sequence SELECT remains denied unless intentionally justified.
- No DELETE / TRUNCATE / REFERENCES / TRIGGER granted.
- No Lane / scoring / customer / AMS / Gate privilege granted.
- No extractor rerun in the proof PR.
- No raw rows / no secrets printed (booleans and column names only).

---

## 7. Rerun Gating

No extractor rerun until **all** of the following are complete, in order:

1. This revised grant-fix planning PR reviewed / merged.
2. Explicit Helen GO to apply the revised fix.
3. Revised fix applied.
4. Post-fix proof PR reviewed / merged.
5. New explicit extractor rerun GO.

Any future rerun must be a separate operator session with all approved
stop-lines active.

---

## 8. Boundaries / Non-Authorization

This PR does **not** authorize:

- grant execution (the §4 candidate SQL is not approved to run)
- extractor rerun
- worker execution
- Stage 0
- risk worker
- POI worker
- evidence snapshot
- Lane preview / Lane write
- customer output
- scoring runtime
- AMS Trust / Pass runtime
- Gate 4E
- Gate 4F
- any GRANT / DML / DDL
- any downstream runtime

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column names / privilege facts / stop-line language
only — not values.
