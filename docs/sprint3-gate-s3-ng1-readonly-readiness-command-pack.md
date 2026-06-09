# Sprint 3 — Gate S3-NG1: Read-Only Downstream Readiness Snapshot — Command Pack (Review-Only)

**Status:** `GATE_S3_NG1_READONLY_READINESS_COMMAND_PACK_REVIEW_ONLY`

This is a **reviewable, docs-only command pack** for a future **read-only**
downstream readiness snapshot (`Gate S3-NG1`), recommended by PR #159 as the
next smallest safe gate after the behavioural extractor rerun passed.

This PR is **planning / review only**. It **executes nothing** and is **not**
the execution proof. The future snapshot uses **metadata / booleans / counts
only** — no row values, no raw identifiers, no payload/customer data, no
secrets, no writes, no GRANT/DML/DDL, no runtime workers. Future execution
requires Codex review + merge of this PR **and** a separate explicit Helen GO.

> Provenance: PR #157 Option B grant-fix proof
> (`68f23ec2a7170358ec2e7f99be735992348ee192`); PR #158 behavioural extractor
> rerun PASS (`c04281230323b8b9dc273766f262c3a3a8418278`); PR #159 next-gate
> decision plan (`03f0ba7008b8077f9a5eea028a23401195d0bd32`).

---

## 1. Title & Status

- Title: Gate S3-NG1 — Read-Only Downstream Readiness Snapshot — Command Pack.
- Status: `GATE_S3_NG1_READONLY_READINESS_COMMAND_PACK_REVIEW_ONLY`.
- Planning/review only; not the execution proof; authorizes no execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #157** — Option B grant-fix proof merged (table-level SELECT granted on
  `public.session_behavioural_features_v0_2`; post-fix privilege proof passed).
- **PR #158** — behavioural extractor rerun PASS
  (`feature_version=behavioural-features-v0.3`, `rows_upserted=1`,
  `exit_code=0`; prior `42501 / aclcheck_error` blocker resolved for that rerun
  only).
- **PR #159** — next-gate decision plan recommended `Gate S3-NG1: read-only
  downstream readiness snapshot` (rejected: run-next-worker-directly, broad
  pipeline GO, unnecessary rerun).

---

## 3. Purpose & Bounded Scope

- **Purpose:** determine the **smallest safe next runtime candidate** after
  behavioural extractor success, using **metadata / booleans / counts only**.
- **Bounded scope:** read-only inventory. It does **not** prove downstream
  runtime correctness; it only inventories structural readiness so the next
  gate can be chosen on evidence.
- It does **not** authorize any worker/downstream runtime, write, grant, or
  Gate 4E/4F.

---

## 4. Future Operator Authorization Required

The snapshot is **not** authorized by this PR. Future execution requires **all**
of:
1. **Codex review** of this command pack;
2. **merge** of this docs-only PR;
3. a **separate explicit Helen GO** for the read-only snapshot;
4. one manual, Helen-operated, read-only execution; then a docs-only evidence
   PR.

---

## 5. Planned Command-Pack Outline (categories A–I)

- **A. Local repo / source gates** — confirm branch/base/commit.
- **B. Secret-safe DSN loading** — `DATABASE_URL`-only parse into `APP_DSN`,
  never printed.
- **C. DB role / database / read-only gates** — names + `transaction_read_only`.
- **D. Script presence inventory** — `package.json` script names + `scripts/`
  files (names/booleans only).
- **E. Table / relation existence inventory** — `to_regclass(...)` booleans.
- **F. Privilege booleans** — `has_table_privilege` /
  `has_column_privilege` / `has_sequence_privilege` (booleans only).
- **G. Aggregate-count-only readiness checks** — `count(*)` / `EXISTS` only,
  no row values.
- **H. Blocker / warning carry-forward checklist** — from earlier docs.
- **I. Final recommendation template** — next smallest runtime gate.

All of §5 is **planning** — the snippets in §7 are `CANDIDATE ONLY — DO NOT
RUN`.

---

## 6. Read-Only Transaction Posture

The future snapshot must run inside a **read-only, rolled-back** transaction:

```text
BEGIN;
  SET LOCAL transaction_read_only = on;        -- hard read-only guard
  SET LOCAL statement_timeout = '15s';
  SET LOCAL idle_in_transaction_session_timeout = '15s';
  -- (only metadata / has_*_privilege / count(*) / EXISTS / to_regclass probes)
ROLLBACK;                                       -- no COMMIT; no writes
```

No `COMMIT`; no DML/DDL; any write attempt is a stop-line (§9).

---

## 7. Proposed Checks, Grouped by Category — CANDIDATE ONLY — DO NOT RUN

> These are illustrative, read-only probes for review. They emit
> names/booleans/counts only — **no row values, no raw identifiers, no
> payload/customer data**.

### A. Local repo / source gates (shell)
```bash
# CANDIDATE ONLY — DO NOT RUN
cd /opt/buyerrecon-backend
git rev-parse --abbrev-ref HEAD          # expect: sprint2-architecture-contracts-d4cc2bf (or the snapshot branch)
git rev-parse HEAD                        # commit gate
git status --porcelain | head            # expect clean / no unexpected changes
```

### B. Secret-safe DSN loading (shell; never prints the value)
```bash
# CANDIDATE ONLY — DO NOT RUN — parse ONLY DATABASE_URL into APP_DSN; never echo it.
APP_DSN="$(python3 - <<'PY'
from pathlib import Path
v=""
for line in Path(".env.production").read_text().splitlines():
    s=line.strip()
    if not s or s.startswith("#") or "=" not in s: continue
    k,val=s.split("=",1)
    if k.strip()=="DATABASE_URL":
        val=val.strip()
        if len(val)>=2 and val[0]==val[-1] and val[0] in ("'",'"'): val=val[1:-1]
        v=val; break
print(v,end="")
PY
)"
[ -n "${APP_DSN:-}" ] && echo "APP_DSN loaded: true" || { echo "APP_DSN loaded: false"; }
export APP_DSN
# cleanup at end: unset APP_DSN
```

### C. DB role / database / read-only gates (SQL)
```sql
-- CANDIDATE ONLY — DO NOT RUN
SELECT current_database() AS db, current_user AS cur_user, current_role AS cur_role,
       current_setting('transaction_read_only') AS read_only;
```

### D. Script presence inventory (shell; names/booleans only)
```bash
# CANDIDATE ONLY — DO NOT RUN — presence booleans only, no file contents.
for s in \
  scripts/extract-behavioural-features.ts \
  scripts/extract-session-features.ts \
  scripts/run-stage0-worker.ts \
  scripts/run-risk-evidence-worker.ts \
  scripts/run-poi-core-worker.ts \
  scripts/run-poi-sequence-worker.ts \
  scripts/evidence-review-snapshot-report.ts \
  scripts/lane-ab-preview-report.ts \
  scripts/check-scoring-contracts.ts ; do
  [ -f "$s" ] && echo "present: $s" || echo "absent:  $s"
done
# npm script names only (no execution):
grep -oE '"[a-z0-9:_-]+": *"[^"]*"' package.json | grep -oE '^"[a-z0-9:_-]+"' | tr -d '"' | sort -u
```

### E. Table / relation existence inventory (SQL; booleans only)
```sql
-- CANDIDATE ONLY — DO NOT RUN — existence booleans only (to_regclass returns NULL if absent)
SELECT
  (to_regclass('public.accepted_events') IS NOT NULL)                    AS accepted_events_present,
  (to_regclass('public.session_features') IS NOT NULL)                   AS session_features_present,
  (to_regclass('public.session_behavioural_features_v0_2') IS NOT NULL)  AS behavioural_features_present,
  (to_regclass('public.stage0_decisions') IS NOT NULL)                   AS stage0_decisions_present,
  (to_regclass('public.risk_observations_v0_1') IS NOT NULL)             AS risk_observations_present,
  (to_regclass('public.poi_observations_v0_1') IS NOT NULL)              AS poi_observations_present,
  (to_regclass('public.poi_sequence_observations_v0_1') IS NOT NULL)     AS poi_sequence_observations_present,
  (to_regclass('public.scoring_output_lane_a') IS NOT NULL)              AS scoring_output_lane_a_present,
  (to_regclass('public.scoring_output_lane_b') IS NOT NULL)              AS scoring_output_lane_b_present;
```

### F. Privilege booleans (SQL; for the next worker role(s) if known)
```sql
-- CANDIDATE ONLY — DO NOT RUN — booleans only; substitute the actual next-worker role at review time.
-- Example shape (role name to be confirmed during review; do NOT assume):
SELECT
  has_table_privilege('<next_worker_role>', 'public.session_behavioural_features_v0_2', 'SELECT') AS sbf_select,
  has_table_privilege('<next_worker_role>', 'public.stage0_decisions', 'INSERT')                  AS stage0_insert_if_applicable;
-- (Only checks privileges that the chosen next gate would actually need; no broad enumeration.)
```

### G. Aggregate-count-only readiness checks (SQL; counts/EXISTS only)
```sql
-- CANDIDATE ONLY — DO NOT RUN — counts only; NO row values, NO identifiers selected.
SELECT
  (SELECT count(*) FROM public.session_behavioural_features_v0_2
     WHERE feature_version = 'behavioural-features-v0.3')      AS sbf_v0_3_row_count,
  (SELECT count(DISTINCT feature_version)
     FROM public.session_behavioural_features_v0_2)            AS sbf_feature_version_count;
-- Optional EXISTS-style readiness (boolean), e.g.:
SELECT EXISTS (SELECT 1 FROM public.session_behavioural_features_v0_2) AS sbf_has_any_rows;
```

### H. Blocker / warning carry-forward checklist (prose)
- Confirm no unresolved blocker remains from earlier docs (e.g. the now-resolved
  `42501 / aclcheck_error` on `session_behavioural_features_v0_2`).
- Confirm no new permission/grant gap is implied for the chosen next worker
  role.
- Confirm scope still excludes Lane/scoring/AMS/customer output and Gate 4E/4F.

### I. Final recommendation template (prose)
- "Based on read-only readiness, the smallest next runtime candidate is
  `<Stage 0 | risk worker | POI worker | evidence snapshot | another preflight>`."
- "That candidate requires its own separate planning, review, and explicit
  Helen GO before any execution."

---

## 8. Expected Evidence Format (for the future snapshot proof PR)

A future `Gate S3-NG1` proof PR (after its own GO) should record, booleans/
counts/metadata only:
- branch / base / commit;
- role / database gates + `transaction_read_only=on`;
- script presence booleans;
- table/relation existence booleans;
- privilege booleans (for the confirmed next-worker role only);
- aggregate counts (e.g. `sbf_v0_3_row_count`);
- blocker/warning checklist results;
- a recommendation for the next smallest execution gate;
- `ROLLBACK` confirmation; stop-line confirmations.

No row values, identifiers, payloads, secrets.

---

## 9. Stop-Lines

The future snapshot must **stop** / must never:
- attempt any write; reach any `COMMIT` path;
- print any row value;
- print any raw identifier, raw `session_id`, or raw `request_id`;
- print any `canonical_jsonb` value or payload/customer data;
- print any DSN / password / token;
- run any GRANT / DML / DDL;
- run the extractor or any worker / downstream runtime;
- execute Stage 0 / risk worker / POI worker / evidence snapshot;
- touch Lane A/B preview or writes, scoring runtime, AMS Trust/Pass runtime,
  customer output, Gate 4E, or Gate 4F;
- bundle multiple runtime steps;
- treat readiness inventory as authorization to run anything.

---

## 10. Explicit Non-Authorization

This PR is **docs-only** and authorizes **none** of:
- no snapshot execution;
- no production command;
- no SQL;
- no writes; no GRANT/DML/DDL;
- no extractor rerun;
- no worker / downstream runtime;
- no Stage 0 / risk worker / POI worker / evidence snapshot;
- no Lane A/B preview or writes;
- no scoring runtime;
- no AMS Trust / Pass runtime;
- no customer output;
- no Gate 4E / Gate 4F.

---

## 11. Next Step After This PR

1. **Codex review** of this command pack.
2. **Merge** this docs-only PR.
3. **Separate explicit Helen GO** for the read-only snapshot.
4. **One** manual, Helen-operated, read-only snapshot execution.
5. **Docs-only `Gate S3-NG1` evidence PR** (booleans/counts/metadata only) with
   the recommendation for the next smallest runtime gate.
6. The chosen next worker/runtime then requires its **own** separate planning,
   review, and explicit GO.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. `session_id`,
`request_id`, `canonical_jsonb`, payload, and customer appear only as
column/object names or stop-line / boundary language. All SQL is fenced
`CANDIDATE ONLY — DO NOT RUN` and emits names/booleans/counts only; the DSN is
parsed from `DATABASE_URL` only and never printed.
