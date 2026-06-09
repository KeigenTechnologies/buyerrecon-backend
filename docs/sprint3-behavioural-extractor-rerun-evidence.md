# Sprint 3: Behavioural Features Extractor Rerun — PASS Evidence (After Option B Grant-Fix)

**Status:** `BEHAVIOURAL_EXTRACTOR_RERUN_PASS_AFTER_OPTION_B_GRANT_FIX`

This is a **docs-only evidence record**. It records that, after the Option B
grant-fix proof (PR #157), Helen ran **exactly one** behavioural features
extractor rerun under explicit GO, and the **behavioural extractor rerun
passed** (`exit code 0`, `rows upserted=1`).

This PR runs **no** additional production command, **no** SQL, **no** additional
GRANT/DML/DDL, **no** worker/downstream runtime, **no** Lane/scoring/AMS/customer
output, and **no** Gate 4E/4F. It records evidence only.

> Provenance: Option B grant-fix proof merged via PR #157 at
> `68f23ec2a7170358ec2e7f99be735992348ee192`.

---

## 1. Title & Status

- Title: Behavioural Features Extractor Rerun — PASS Evidence (After Option B
  Grant-Fix).
- Status: `BEHAVIOURAL_EXTRACTOR_RERUN_PASS_AFTER_OPTION_B_GRANT_FIX`.
- One line: the behavioural extractor rerun **passed**; `rows upserted=1`.

---

## 2. Authorization & Scope

- Upstream proof merged: PR #157 (Option B grant-fix proof,
  `68f23ec2a7170358ec2e7f99be735992348ee192`).
- Helen issued the GO: `HELEN BEHAVIOURAL EXTRACTOR RERUN GO`.
- The GO authorized **exactly one** behavioural extractor rerun only.
- Helen ran the rerun manually. Claude Code did not execute anything.
- No worker/downstream runtime, Lane/scoring/AMS/customer output, Gate 4E, or
  Gate 4F was authorized or run.

---

## 3. Pre-Run Gates (passed)

- Repo synced to `sprint2-architecture-contracts-d4cc2bf`.
- Script gate: `extract:behavioural-features` present in `package.json`.
- `APP_DSN` loaded **without printing the value**: `APP_DSN_loaded=true`.
- Role / database gate:
  - `current_user=buyerrecon_prod_collector_app`
  - `current_database=buyerrecon_production`
  - `transaction_read_only=off`
  - `role_ok=true`
  - `database_ok=true`

---

## 4. Command Executed

```bash
DATABASE_URL="$APP_DSN" npm run extract:behavioural-features
```

Exactly one rerun was executed (the GO authorized exactly one).

---

## 5. Extractor Output Summary

- Package script:
  - `buyerrecon-backend@1.0.0 extract:behavioural-features`
  - `tsx scripts/extract-behavioural-features.ts`
- Summary:
  - feature_version: `behavioural-features-v0.3`
  - workspace_id filter: `(none)`
  - site_id filter: `(none)`
  - candidate window: `2026-06-02T14:43:10.079Z → 2026-06-09T14:43:10.079Z`
  - database_url: masked as `postgresql://<user:****>@127.0.0.1:5432/<db>`
  - rows upserted: `1`
- Log path: `/tmp/behavioural-extractor-rerun-20260609T144309Z.log`
- Exit code: `0`

> Note: the `database_url` value above is the extractor's **masked** output
> exactly as emitted (credentials redacted as `<user:****>`); it is not a raw
> DSN and contains no secret. The host shown is loopback.

---

## 6. Result / Interpretation

- The **behavioural extractor rerun passed** (`exit code 0`).
- **rows upserted=1.**
- **This proves the behavioural extractor rerun passed after the Option B
  grant-fix** — the prior permission blocker (`42501 / aclcheck_error`) was
  resolved for this rerun.
- Bounded claims (deliberately limited):
  - This does **not** claim the whole downstream pipeline is fixed.
  - This does **not** claim downstream workers, Lane A/B, scoring, AMS
    Trust/Pass, customer output, Gate 4E, or Gate 4F were exercised.
  - This does **not** claim broader system readiness beyond this single
    behavioural extractor rerun.

---

## 7. What Did Not Run

- No additional production command by this PR.
- No SQL by this PR.
- No additional GRANT / DML / DDL.
- No worker / downstream runtime.
- No Stage 0, risk worker, POI worker, evidence snapshot.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 8. Stop-Lines Observed

- Exactly **one** rerun (the GO authorized exactly one); no re-run.
- Pre-run role/database gates verified (`buyerrecon_prod_collector_app` in
  `buyerrecon_production`).
- `APP_DSN` loaded without printing; `APP_DSN` was unset afterward.
- `database_url` shown only in **masked** form; no secret, raw row, raw
  identifier, payload, or customer data emitted.
- No worker/downstream runtime; no Lane/scoring/AMS/customer output; no
  Gate 4E/4F.
- Session note: after the run, the shell ran `exit "$EXIT_CODE"` with exit code
  `0`, which closed the SSH connection. **This is not a failure** — it reflects
  the successful (`0`) exit.

---

## 9. Next Gated Step

1. **Codex review and merge** of this docs-only evidence PR.
2. This evidence authorizes **no** next runtime. Any downstream step (workers,
   Stage 0, risk/POI workers, evidence snapshot, Lane A/B, scoring runtime, AMS
   Trust/Pass runtime, customer output, Gate 4E, Gate 4F) requires its **own
   separate explicit GO** and its own gating.
3. Any future behavioural extractor rerun likewise requires a separate explicit
   rerun GO and must be a separate operator session with all approved stop-lines
   active.

---

## Safety / Raw-Data Boundary

This record contains no raw DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value,
user-agent value, or customer data. The only connection string shown is the
extractor's **masked** `database_url` output (`postgresql://<user:****>@127.0.0.1:5432/<db>`)
exactly as emitted — credentials redacted, loopback host, no database name. All
other identifier references are role / table / column / version / feature names
or boolean/count/exit-code evidence values — not business row values.
