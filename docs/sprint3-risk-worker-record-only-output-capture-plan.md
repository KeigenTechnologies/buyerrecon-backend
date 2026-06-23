# Sprint 3 — Risk-Worker Fresh RECORD_ONLY Output Capture — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_OUTPUT_CAPTURE_PLANNING_ONLY`

This is a **docs-only planning record**. It defines a future, **separately
GO-gated** fresh bounded RECORD_ONLY risk-worker run whose **only** purpose is to
re-establish captured-output custody — a fresh private `run.err` + `run.safe.out`
pair — after the prior pair was not found (PR #334).

This PR **plans only**. It does **not** run the risk worker, run any classifier,
read/search/copy/inspect any old raw `run.err`/`run.safe.out`, run SQL/psql,
apply any fix, edit any source/config/runtime/DSN/secret file, mutate the DB,
install tools, or run Lane/scoring/AMS/customer output/Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=16f42f1130b9d3efba5ea7c960e8c2dfdb6302b2
```

---

## 2. Carry-forward evidence (from merged PRs)

```text
first risk-worker run:        worker_exit_code=1
Phase A static inspection:    diagnostic_result=inconclusive          (PR #333)
Phase B output-pair locator:  runtime_output_pair_count=0             (PR #334)
Phase B classifier:           classifier_execution_attempted=false    (PR #334)
runtime cause:                unknown_or_unclassified
```

The runtime cause of the nonzero exit **remains unknown**. The prior captured
output pair was not found, so Phase B classification could not proceed. This plan
addresses **only** re-establishing the captured-output custody — it does **not**
classify or claim a cause.

---

## 3. Explicit non-authorization

This planning PR does **NOT** authorize:

- a worker rerun;
- classifier execution;
- raw output reading;
- SQL/psql;
- DB mutation;
- source/config/secret/runtime changes;
- fixes / remediation;
- Lane/scoring/AMS/customer output/Gate4E/Gate4F.

Merging this PR changes no runtime/enforcement behavior and authorizes no
execution.

---

## 4. Future GO phrase (placeholder)

```text
HELEN RISK WORKER RECORD_ONLY OUTPUT CAPTURE GO: run exactly one bounded
RECORD_ONLY risk-worker capture to re-establish private run.err and run.safe.out
custody, no classifier, no raw output printing, no SQL/psql, no fix, no
Lane/scoring/AMS/customer/Gate4E/F.
```

> **PLACEHOLDER ONLY — NOT ACTIVE UNTIL EXPLICITLY GIVEN LATER.** The phrase above
> is recorded for planning continuity only; it grants nothing until issued as a
> fresh, explicit, scoped Helen GO.

---

## 5. Candidate command-pack design

> **CANDIDATE ONLY — DO NOT RUN FROM THIS DOCUMENT.** Illustrative shape for a
> future, separately GO-gated capture. Not authorized by this PR. No secret value
> appears; connection comes from approved custody and is never printed.

### 5.1 Preflight (read-only; fail-closed)

- Production path is `/opt/buyerrecon-backend`.
- Current branch is `sprint2-architecture-contracts-d4cc2bf`.
- HEAD contains the trusted base `16f42f1130b9d3efba5ea7c960e8c2dfdb6302b2`
  (`git merge-base --is-ancestor … HEAD`).
- Working tree clean (`git status --porcelain --untracked-files=no` empty).
- Required secret custody present (`/etc/buyerrecon/risk-worker.env` key
  `RISK_WORKER_DSN`) — **key presence only; the secret value is never printed,
  parsed, or transformed**.
- RECORD_ONLY mode only (confirm the RECORD_ONLY posture before running).
- Exactly-one-run guard (the capture runs the worker command **at most once**;
  abort if a run has already occurred this invocation).

### 5.2 Private output custody

- Create a **new private temp directory** (e.g. `mktemp -d`), `chmod 700`.
- Capture stdout → `run.safe.out` and stderr → `run.err` inside it, each
  `chmod 600`.
- Emit **safe labels only** — do **not** print the temp directory path if it
  encodes sensitive structure; report only existence booleans.
- **Do not read the raw files after capture** (custody booleans only).

### 5.3 Runtime

- Run **exactly one** risk-worker RECORD_ONLY command — **only if** the reviewed
  command path is identified from existing merged docs/source (do not invent a
  command). The reviewed mapping referenced by prior merged planning is
  `npm run risk-evidence:run` → `tsx scripts/run-risk-evidence-worker.ts`; the
  future capture must re-confirm this from current repo artifacts at run time.
- **If the exact reviewed command path cannot be confirmed from existing repo
  artifacts, future execution must stop before running.**
- Bind the connection from approved custody (`DATABASE_URL="$RISK_WORKER_DSN"`)
  inside the controlled shell; never print it.
- Capture stdout/stderr to the private files (§5.2).
- Emit **only** these safe labels:

```text
worker_command_invoked=true|false
worker_exit_code=<numeric only>
run_err_created=true|false
run_safe_out_created=true|false
raw_output_printed=false
raw_output_read_after_capture=false
classifier_execution_attempted=false
sql_psql_executed=false
fix_executed=false
lane_scoring_ams_customer_gate_executed=false
```

### 5.4 Post-run

- **Do not classify in the same run.**
- Create a **separate docs-only evidence PR** after the capture (custody booleans
  + numeric exit code only; no raw output).
- **Only after** that evidence is reviewed/merged may a **new classifier GO** be
  considered (its own separate, reviewed, GO-gated step).

---

## 6. Stop-lines

The future capture (and this plan) must stop if:

- wrong host / path / branch / base;
- dirty working tree;
- missing secret custody (no `RISK_WORKER_DSN` key);
- the reviewed command path is **not proven** from existing repo artifacts;
- the worker is **not** in RECORD_ONLY mode;
- the output files are **not created exactly once** (zero, partial, or a second
  run);
- raw output would need to be **printed**;
- any **SQL/psql / fix / downstream / Gate** action would be required;
- there is **any ambiguity** about whether the run would write customer-visible
  output.

On any stop-line: halt before running and record the stop-line (safe labels
only); do not proceed.

---

## 7. Safety invariants

- Raw output **remains private** (captured to `0600` files in a `0700` dir;
  never printed or read back).
- The **classifier is not run during capture** (capture and classification are
  separate, separately GO-gated steps).
- Capture evidence records **file-existence / custody booleans only** (plus the
  numeric exit code) — never raw lines.
- The future classifier must be **separate, reviewed, and GO-gated**.
- **No customer-visible output** is produced.
- **No runtime cause is claimed** by this planning PR.

---

## 8. Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, **raw
`pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, **raw psql output, raw PostgreSQL error text**, **worker
stdout/stderr**, or `run.safe.out` / `run.err` contents. This plan reads no old
captured output and copies none; any future capture keeps `run.err` /
`run.safe.out` as **private temp data** and records **only** custody booleans and
a numeric exit code. `RISK_WORKER_DSN` and `DATABASE_URL` appear as **env-var
names only**; the custody path `/etc/buyerrecon/risk-worker.env` is a **non-secret
path** whose contents are never read or shown. The `package.json` script name
(`risk-evidence:run`), the `scripts/*.ts` path, the role name
(`buyerrecon_risk_worker`), the database name (`buyerrecon_production`), the repo
path (`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
identifiers. All values above are safe labels / booleans / a numeric exit code /
category tokens / non-secret identifiers / a public git commit hash — not secret
or row values. **This PR runs nothing.**
