# Sprint 3: Behavioural Output — Option B Grant-Fix Post-Fix Proof

**Status:** `BEHAVIOURAL_OPTION_B_GRANT_FIX_EXECUTED_PROOF`

This is a **docs-only post-fix proof record**. It records that the approved
Option B least-privilege grant (a single-table SELECT grant) was executed on
production by Helen, and that the **post-fix privilege proof passed**.

**This proof does not claim the behavioural extractor is fixed.** It proves only
the grant/fix privilege state. The behavioural extractor rerun remains
**separately gated** and requires a new explicit rerun GO after this proof PR is
reviewed and merged.

This PR runs **no** additional production command, **no** SQL, **no** extra
GRANT/DML/DDL, **no** extractor rerun, and **no** worker/downstream runtime.

> Provenance: command-pack merged via PR #156 at
> `8189a698f55a82e4bf26134fb0c3905aade3cc19`.

---

## 1. Title & Status

- Title: Behavioural Output — Option B Grant-Fix Post-Fix Proof.
- Status: `BEHAVIOURAL_OPTION_B_GRANT_FIX_EXECUTED_PROOF`.
- One line: the approved single-table SELECT grant was applied; **post-fix
  privilege proof passed**; extractor rerun remains separately gated.

---

## 2. Authorization & Scope

- Command-pack artifact merged: PR #156
  (`8189a698f55a82e4bf26134fb0c3905aade3cc19`).
- Helen issued the GO: `HELEN BEHAVIOURAL OPTION B GRANT FIX GO`.
- Helen **manually executed** the approved single-table SELECT grant on
  production. Claude Code did not execute anything.
- No extractor rerun, worker/downstream runtime, Lane/scoring/AMS/customer
  output, Gate 4E, or Gate 4F was authorized or run.

---

## 3. Command Executed

```sql
GRANT SELECT ON TABLE public.session_behavioural_features_v0_2
  TO buyerrecon_prod_collector_app;
```

Execution context:
- database: `buyerrecon_production`
- `current_user`: `postgres`
- `current_role`: `postgres`
- transaction: `BEGIN` → preflight → grant → post-fix proof → `COMMIT`
- the grant **committed successfully**

Scope confirmation: SELECT-only; single target table
`public.session_behavioural_features_v0_2`; target role
`buyerrecon_prod_collector_app`; no schema/DB-wide grant; no other table; no
DELETE/TRUNCATE/REFERENCES/TRIGGER; no Lane/scoring/customer/AMS/Gate
privileges; no extractor rerun bundled.

---

## 4. Preflight Evidence (before the grant)

| probe | value |
|---|---|
| `table_select` | `false` |
| `table_insert` | `true` |
| `table_update` | `true` |
| `column_select_true_count` | `5` |
| `seq_usage` | `true` |
| `seq_select` | `false` |

Booleans/counts only — no row reads, no raw values.

---

## 5. Grant/Fix Execution Evidence

- Exactly **one** grant statement executed (the §3 command).
- Run inside a transaction: `BEGIN` → preflight → grant → post-fix proof →
  `COMMIT`.
- The grant **committed successfully** (this is the intended persistent
  privilege change — a deliberate, approved DDL `GRANT`, distinct from the
  rollback-contained diagnostics).

---

## 6. Post-Fix Proof Evidence (after the grant)

| probe | value |
|---|---|
| `table_select` | `true` |
| `table_insert` | `true` |
| `table_update` | `true` |
| `column_select_true_count` | `37` |
| `seq_usage` | `true` |
| `seq_select` | `false` |

Booleans/counts only — no row reads, no raw values.

---

## 7. Interpretation

- The approved **single-table SELECT grant was applied successfully**.
- The target app role `buyerrecon_prod_collector_app` now has **table-level
  SELECT** on `public.session_behavioural_features_v0_2`.
- **Column SELECT count increased from 5 to 37** (PostgreSQL reports the
  table-level SELECT through per-column privilege checks).
- **INSERT/UPDATE stayed `true`**.
- **Sequence USAGE stayed `true`**.
- **Sequence SELECT stayed `false`**, as expected and **not** proven necessary.
- **Post-fix privilege proof passed.**

Deliberately bounded:
- This proof **does not claim the behavioural extractor is fixed**. It proves
  only the grant/fix **privilege state**.
- Whether the extractor now passes is **unproven** and must be established by a
  separately-gated rerun (which this PR does **not** authorize).

---

## 8. What Did Not Run

- No additional production command by this PR.
- No SQL by this PR.
- No extra GRANT / DML / DDL by this PR (the single approved `GRANT SELECT` was
  executed by Helen under the GO, recorded here as evidence).
- No extractor rerun.
- No worker / downstream runtime.
- No Stage 0, risk worker, POI worker, evidence snapshot.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 9. Stop-Lines Observed

- Exactly one grant statement; SELECT-only; single target table; correct role.
- No grant beyond SELECT; no schema/DB-wide grant; no other table; no
  DELETE/TRUNCATE/REFERENCES/TRIGGER; no Lane/scoring/customer/AMS/Gate.
- Preflight and post-fix proof were **booleans/counts only** — no row reads, no
  raw values, no payload/customer data, no DSN/password/token.
- No extractor rerun; no worker/downstream runtime; no Gate 4E/4F.
- Risk-acceptance condition acknowledged: if a future extractor rerun fails,
  stop and record evidence; do **not** stack ad-hoc grants.

---

## 10. Next Gated Step

1. **Codex review and merge** of this docs-only proof PR.
2. The behavioural extractor rerun is **still not authorized**. A rerun requires
   a **new explicit extractor rerun GO** after this proof PR is reviewed and
   merged.
3. Any future rerun must be a separate operator session with all approved
   stop-lines active; if it fails, stop and record evidence — do not stack
   ad-hoc grants.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / table / column / sequence **names** or boolean/count proof
values — not business row values.
