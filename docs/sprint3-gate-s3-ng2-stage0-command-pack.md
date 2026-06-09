# Sprint 3 — Gate S3-NG2: Stage 0 Worker Command Pack (Review-Only)

**Status:** `GATE_S3_NG2_STAGE0_COMMAND_PACK_REVIEW_ONLY`

This is a **reviewable, docs-only command pack** for a future **Stage 0 worker**
execution gate (`Gate S3-NG2`), the next smallest runtime candidate recommended
by the merged Gate S3-NG1 readiness evidence (PR #161).

This PR is **planning / review only**. It **executes nothing** and is **not** a
Stage 0 run. Future Stage 0 execution requires Codex review + merge of this PR
**and** a separate explicit Helen GO, then one manual operator execution, then a
docs-only Stage 0 evidence PR.

> Provenance: PR #158 behavioural extractor rerun PASS
> (`c04281230323b8b9dc273766f262c3a3a8418278`); PR #159 next-gate decision
> (`03f0ba7008b8077f9a5eea028a23401195d0bd32`); PR #160 S3-NG1 command pack
> (`c5fda8579d793b0339c120448c6df00875ea9006`); PR #161 S3-NG1 readiness PASS
> (`fcae4d812dd8baa4797a4416684ba35108b374dd`).

---

## 1. Title & Status

- Title: Gate S3-NG2 — Stage 0 Worker Command Pack.
- Status: `GATE_S3_NG2_STAGE0_COMMAND_PACK_REVIEW_ONLY`.
- Planning/review only; not a Stage 0 run; authorizes no execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #158** — behavioural extractor rerun PASS (`rows_upserted=1`,
  `behavioural-features-v0.3`).
- **PR #159** — next-gate decision plan (recommended a read-only readiness
  snapshot first, then the smallest next runtime candidate).
- **PR #160** — Gate S3-NG1 read-only readiness command pack.
- **PR #161** — Gate S3-NG1 readiness snapshot **PASS**: all checked scripts and
  relations present (incl. `stage0_decisions`, `accepted_events`); behavioural
  output exists; privilege booleans **skipped** (`next_worker_role_not_confirmed`).

---

## 3. Purpose & Bounded Scope

- **Purpose:** define a reviewed, one-shot Stage 0 worker execution gate.
- **Bounded scope:** Stage 0 is a **RECORD_ONLY** worker. It records Stage 0
  decisions only; it does **not** run risk/POI/evidence-snapshot/Lane/scoring/
  AMS/customer-output steps, and this gate authorizes none of them.
- This PR authorizes **no** execution, grant, or downstream runtime.

---

## 4. Repo-Grounded Stage 0 Command Discovery

Grounded by read-only inspection of the merged base:

- **npm command:** `stage0:run` → `tsx scripts/run-stage0-worker.ts`
  (`package.json`). Candidate command is **`npm run stage0:run`** — confirmed
  from `package.json`, not assumed.
- **CLI runner:** `scripts/run-stage0-worker.ts` — imports
  `parseStage0EnvOptions` / `runStage0Worker` from
  `src/scoring/stage0/run-stage0-worker.ts`.
- **Connection:** `new pg.Pool({ connectionString: DATABASE_URL })`; the runner
  **masks** output to host/database only and documents "never prints raw UA /
  token / IP / payload / canonical_jsonb".
- **Env (read-only inspection of the header):**
  - `DATABASE_URL` (required; never printed);
  - `WORKSPACE_ID`, `SITE_ID` (optional filters);
  - `SINCE_HOURS` (default 168), `SINCE`, `UNTIL` (window controls);
  - `STAGE0_VERSION` (default `stage0-hard-exclusion-v0.2`).
- **Execution role:** **NOT yet confirmed.** The role is whatever the supplied
  `DATABASE_URL`/`APP_DSN` resolves to. PR #161 deliberately skipped privilege
  booleans because `next_worker_role_not_confirmed`. The role **must be
  confirmed at review/preflight** (see §6) and **must not be assumed** to be
  `buyerrecon_prod_collector_app` without a privilege preflight.

---

## 5. Stage 0 Source / Target Surface (read-only inspection)

From `src/scoring/stage0/run-stage0-worker.ts` and
`src/scoring/stage0/extract-stage0-inputs.ts`:

- **Sole write target:** `stage0_decisions` — a single idempotent upsert:
  `INSERT INTO stage0_decisions ( workspace_id, site_id, session_id,
  stage0_version, scoring_version, excluded, rule_id, rule_inputs,
  evidence_refs, record_only, source_event_count ) VALUES (…, TRUE, …)
  ON CONFLICT (workspace_id, site_id, session_id, stage0_version,
  scoring_version) DO UPDATE SET … updated_at = now()
  RETURNING stage0_decision_id, excluded, rule_id`.
  - `record_only` is written `TRUE` (RECORD_ONLY).
  - PK `stage0_decision_id UUID DEFAULT gen_random_uuid()` (function default —
    **no sequence**); natural-key UNIQUE
    `(workspace_id, site_id, session_id, stage0_version, scoring_version)`;
    CHECK constraints on `rule_id` enum and `excluded`-iff-`rule_id`.
- **Read source tables (real relations):** `accepted_events` and
  `ingest_requests` (LEFT JOIN). All other names in the SQL
  (`candidate_sessions`, `session_events`, `pageview_*`, `eps_max`, …) are
  **CTEs derived from `accepted_events`**, not tables.
- **Does NOT write** to `scoring_output_lane_a` / `scoring_output_lane_b`,
  `risk_observations_v0_1`, `poi_observations_v0_1`,
  `poi_sequence_observations_v0_1`, `session_features`,
  `session_behavioural_features_v0_2`, or any customer-output/report artifact.
  (The source explicitly comments: "No `INSERT INTO scoring_output_lane_a` /
  `_b`.")

| Surface | Relation | Access |
|---|---|---|
| Read | `accepted_events` | SELECT |
| Read | `ingest_requests` | SELECT |
| Write | `stage0_decisions` | INSERT + UPDATE (upsert), RETURNING |

---

## 6. Required Privilege Preflight Plan (read-only; booleans only)

**Lesson carried forward:** the behavioural saga (#136–#158) showed an
unconfirmed privilege gap can block a worker. So Stage 0 must run a **read-only
privilege preflight** for the **confirmed execution role** (`<stage0_role>`,
to be confirmed at review — do **not** assume) **before** any execution:

```sql
-- CANDIDATE ONLY — DO NOT RUN — booleans only; confirm <stage0_role> at review.
SELECT
  has_table_privilege('<stage0_role>', 'public.accepted_events',  'SELECT') AS accepted_events_select,
  has_table_privilege('<stage0_role>', 'public.ingest_requests',  'SELECT') AS ingest_requests_select,
  has_table_privilege('<stage0_role>', 'public.stage0_decisions', 'INSERT') AS stage0_insert,
  has_table_privilege('<stage0_role>', 'public.stage0_decisions', 'UPDATE') AS stage0_update,
  has_table_privilege('<stage0_role>', 'public.stage0_decisions', 'SELECT') AS stage0_select; -- RETURNING
```

- The upsert needs **INSERT + UPDATE** on `stage0_decisions`, and the
  `RETURNING` needs **SELECT** on the returned columns (or table).
- PK uses `gen_random_uuid()` (no sequence) → **no sequence privilege** needed.
- If any required privilege is **false**, **STOP** — do not run Stage 0; record
  a blocked/diagnostic note and route any grant through the separate
  plan→review→GO→proof chain (no ad-hoc grants).

This preflight is **planning only** here; it would run read-only under its own
gate before the Stage 0 execution.

---

## 7. Secret-Safe DSN Loading Plan

```bash
# CANDIDATE ONLY — DO NOT RUN — parse ONLY DATABASE_URL into APP_DSN; never echo it.
cd /opt/buyerrecon-backend
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

- Only `DATABASE_URL` is parsed into `APP_DSN`; no other secret sourced/exported.
- Never `echo "$APP_DSN"`, `env`, `set`, `export -p`, or print parsed connection
  details. Run in a fresh/ephemeral shell; `unset APP_DSN` afterward.
- The runner itself masks DB output to host/database only.

---

## 8. Candidate Execution Command — CANDIDATE ONLY / DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO. **Exactly one** execution; **exact command only**; no extra grants;
> no ad-hoc fixes; no bundling with any other worker/runtime.

```bash
# CANDIDATE ONLY — DO NOT RUN
# Preconditions: privilege preflight (§6) all true for the confirmed role;
#                DSN loaded per §7; separate explicit Helen GO issued.
cd /opt/buyerrecon-backend
DATABASE_URL="$APP_DSN" npm run stage0:run
# Optional documented env (set only if intended; defaults exist):
#   WORKSPACE_ID=<filter> SITE_ID=<filter> SINCE_HOURS=168 \
#   STAGE0_VERSION=stage0-hard-exclusion-v0.2
# Capture the masked PASS summary + exit code to a log path; then: unset APP_DSN
```

Expected PASS summary fields (masked; counts only): `database` (host/db only),
`stage0_version`, `scoring_version`, `window`, `upserted_rows`, `excluded`,
`non_excluded`. No row values, raw identifiers, payloads, or secrets.

---

## 9. Post-Run Evidence Requirements (future Stage 0 evidence PR)

After a future execution (its own GO), a separate **docs-only Stage 0 evidence
PR** must record:
- branch / base / commit;
- Helen GO phrase; exactly one execution;
- DSN loaded without printing; `APP_DSN` unset;
- exit code; masked database (host/db only);
- `stage0_version`, `scoring_version`, window;
- `upserted_rows`, `excluded`, `non_excluded` (counts only);
- confirmation that the **only** write target was `stage0_decisions`
  (`record_only=TRUE`);
- privilege-preflight booleans (from §6) for the confirmed role;
- stop-line confirmations;
- bounded interpretation (Stage 0 RECORD_ONLY ran; does not prove
  risk/POI/Lane/scoring/AMS/customer/Gate readiness);
- a recommendation for the next smallest gate.

No row values, raw identifiers, `session_id`/`request_id` values,
`canonical_jsonb` values, payloads, customer data, or secrets.

---

## 10. Stop-Lines (future Stage 0 execution)

Stop / never:
- run more than one Stage 0 execution; deviate from the exact command;
- apply any extra grant or ad-hoc fix (route grants through the separate chain);
- bundle with risk / POI / evidence snapshot / Lane / scoring / AMS / customer
  output;
- proceed on any permission error or unexpected error — stop and record;
- print raw row values, raw IDs, `session_id`/`request_id` values,
  `canonical_jsonb` values, payload/customer data, or secrets;
- print the DSN / password / token, hostnames beyond the runner's masked output,
  IPs, UUIDs, or cloud tokens;
- write to anything other than `stage0_decisions`;
- run any GRANT/DML/DDL outside the worker's own `stage0_decisions` upsert;
- touch Gate 4E / Gate 4F.

---

## 11. Explicit Non-Authorization

This PR is **docs-only** and authorizes **none** of:
- no Stage 0 execution;
- no production command; no SQL;
- no worker / downstream runtime;
- no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes;
- no scoring runtime; no AMS Trust/Pass runtime; no customer output;
- no Gate 4E / Gate 4F;
- no GRANT / DML / DDL; no permission fix.

---

## 12. Next Step After This PR

1. **Codex review** of this command pack.
2. **Merge** this docs-only PR.
3. **Confirm the Stage 0 execution role** and run the §6 read-only privilege
   preflight (its own read-only gate); if any privilege is missing, route it
   through the separate plan→review→GO→proof chain (no ad-hoc grants).
4. **Separate explicit Helen GO** for Stage 0.
5. **One** manual, operator-run Stage 0 execution (exact command only).
6. **Docs-only Stage 0 evidence PR** (counts/booleans/masked only).
7. The next downstream worker/runtime then requires its **own** separate
   planning, review, and explicit GO.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. `session_id`,
`request_id`, `canonical_jsonb`, payload, and customer appear only as
column/object names or stop-line / boundary language. All SQL/shell is fenced
`CANDIDATE ONLY — DO NOT RUN`, emits booleans/counts/masked output only; the DSN
is parsed from `DATABASE_URL` only and never printed; `<stage0_role>` is a
placeholder to be confirmed at review, not an assumed value.
