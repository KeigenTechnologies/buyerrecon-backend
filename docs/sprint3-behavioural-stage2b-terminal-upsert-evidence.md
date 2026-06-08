# Sprint 3: Behavioural Stage 2b Terminal-Upsert — Reproduction Evidence

**Status:** `STAGE2B_TERMINAL_UPSERT_REPRODUCTION_EXECUTED_PERMISSION_ERROR_REPRODUCED`

This is a **docs-only evidence record**. It captures the result of the manual,
operator-run Stage 2b terminal-upsert reproduction. The reproduction reached
PostgreSQL, made **exactly one** full-source-shaped upsert attempt inside a
rollback-contained transaction, and **reproduced the permission error**
(`42501`) under the app role.

This PR applies **no** fix, authorizes **no** GRANT/DML/DDL, authorizes **no**
extractor rerun, and authorizes **no** worker or downstream runtime. It records
sanitized structured evidence only — no row values, identifiers, payloads, or
secrets.

---

## 1. Title & Status

- Title: Behavioural Stage 2b Terminal-Upsert — Reproduction Evidence.
- Status: `STAGE2B_TERMINAL_UPSERT_REPRODUCTION_EXECUTED_PERMISSION_ERROR_REPRODUCED`.
- Outcome in one line: **permission error reproduced on a full-source-shaped
  terminal upsert**; the exact denied object/column was **not** exposed by
  PostgreSQL structured fields.

---

## 2. Authorization & Scope

- Command-pack artifact merged: PR #148
  (`b4818861c73ab0ad1d5c67d0e879c346e8d474e1`).
- Manual operator commands merged: PR #149
  (`432168bab2fcfcb57db1db65ae8048fd178652be`).
- Helen issued the Stage 2b GO:
  `HELEN BEHAVIOURAL GRANT LOCALIZATION STAGE 2B TERMINAL UPSERT REPRODUCTION GO`
- Helen **manually** ran the operator commands **once** from the production
  terminal. Claude Code did not execute anything.
- No grant/fix, extractor rerun, worker, downstream runtime, or Gate 4E/4F was
  authorized or run.

---

## 3. Source-Shape Preflight (passed before execution)

The operator re-verified the upsert shape against HEAD before executing:

- `EXTRACTION_SQL` exists at `scripts/extract-behavioural-features.ts:281`.
- Runner uses `pool.query(EXTRACTION_SQL, params)` at
  `scripts/extract-behavioural-features.ts:964`.
- INSERT column block printed (36 insert columns).
- Conflict arbiter / 32 `EXCLUDED.*` update assignments / RETURNING block
  printed.
- `EXCLUDED`-only guard passed:
  `OK: DO UPDATE SET reads EXCLUDED.* only`

This confirms the executed attempt mirrored the **full** source shape (36
insert columns, 32 `EXCLUDED.*` updates, same arbiter
`workspace_id, site_id, session_id, feature_version`, same RETURNING
`behavioural_features_id, workspace_id, site_id, session_id`) — not a
reduced-column shape.

---

## 4. Operator Execution Summary

- Exactly **one** full-source-shaped terminal-upsert attempt.
- Run inside `BEGIN` with `SET LOCAL` safety timeouts; **unconditional
  `ROLLBACK`**; **no `COMMIT`**.
- Data approach: `synthetic_fixture` (synthetic, namespaced, non-real values
  bound as parameters; never printed).
- Log path recorded by operator:
  `/tmp/buyerrecon_stage2b_terminal_upsert_20260608T193223Z.jsonl`
- Cleanup: temp script shredded/removed; `APP_DSN` unset.

---

## 5. Sanitized JSONL Evidence (verbatim)

```json
{"stage":"2b","reached_postgres":true,"transaction_started":true,"rolled_back":true,"commit_used":false,"attempts":1,"outcome":"error","data_approach":"synthetic_fixture","no_row_values_printed":true,"no_secret_printed":true,"no_raw_identifier_printed":true,"no_grant_or_ddl":true,"dml_attempt_was_rollback_contained":true,"no_persistent_dml":true,"no_extractor_rerun":true,"no_worker_run":true,"no_downstream_runtime":true,"no_gate_4e":true,"no_gate_4f":true,"error":{"code":"42501","severity":"ERROR","routine":"aclcheck_error","schema_field_present":false,"table_field_present":false,"column_field_present":false,"constraint_field_present":false,"detail_present":false,"hint_present":false,"where_present":false,"message_redacted":true}}
```

---

## 6. Interpretation

- Stage 2b **reached PostgreSQL** (`reached_postgres=true`).
- The transaction **started** (`transaction_started=true`).
- **Exactly one** full-source-shaped terminal-upsert attempt was made
  (`attempts=1`).
- The attempt was **rollback-contained** (`dml_attempt_was_rollback_contained=true`,
  `no_persistent_dml=true`).
- **`ROLLBACK` completed** (`rolled_back=true`); **no `COMMIT`** was used
  (`commit_used=false`).
- The outcome **reproduced PostgreSQL permission error `42501`**
  (`severity=ERROR`), with `routine=aclcheck_error`.
- This **proves the full-source-shaped terminal upsert still hits a permission
  error under the app role** — it is not an artifact of a reduced-column probe
  (the source-shape preflight passed).
- **`42501` / `aclcheck_error`** is PostgreSQL's privilege-denied path,
  consistent with the persistent extractor failure
  `permission denied for table session_behavioural_features_v0_2`.

Framing (deliberately not over-claimed):

- "**permission error reproduced on full-source-shaped terminal upsert**";
- "**exact denied object/column not exposed by PostgreSQL structured fields**";
- "**supports a permission-fix path, but the fix must remain evidence-led and
  least-privilege**".

---

## 7. Limitations

- PostgreSQL did **not** expose structured `schema` / `table` / `column` /
  `constraint` fields for this error (`*_field_present=false` for all), and
  `detail` / `hint` / `where` were absent. The raw message was intentionally
  redacted (`message_redacted=true`).
- Therefore the **exact denied object/column is still not identified by
  structured fields**. `42501` confirms a privilege denial occurred on this
  path but does not, by itself, name which privilege/object/column is missing.
- **Do not over-claim the exact root cause.** The earlier source review showed
  the upsert's obvious SELECT surfaces (arbiter, RETURNING) are already covered
  by the existing 5-column SELECT grant and `DO UPDATE SET` reads only
  `EXCLUDED.*`; so the precise missing privilege remains to be pinned down by a
  later evidence-led step before any grant is proposed.

---

## 8. What Did Not Run

- No GRANT / DML / DDL (the single upsert attempt was rollback-contained; no
  persistent DML).
- No grant / fix.
- No extractor rerun.
- No worker.
- No downstream runtime.
- No Stage 0, risk worker, POI worker, evidence snapshot.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 9. Stop-Lines Observed

- Exactly one attempt (`attempts=1`); no re-run.
- Rollback-contained; `rolled_back=true`; `commit_used=false`;
  `no_persistent_dml=true`.
- `no_grant_or_ddl=true`.
- `no_secret_printed=true`, `no_row_values_printed=true`,
  `no_raw_identifier_printed=true` (no DSN/credential/row/identifier output).
- `no_extractor_rerun=true`, `no_worker_run=true`, `no_downstream_runtime=true`.
- `no_gate_4e=true`, `no_gate_4f=true`.
- Cleanup completed: temp script shredded/removed; `APP_DSN` unset.

---

## 10. Next Gated Step

1. **Codex review and merge** of this docs-only evidence PR.
2. Any future **grant/fix** requires a **separate planning / review / explicit
   Helen GO** (evidence-led, least-privilege; no table-level SELECT presumed).
3. Any **extractor rerun** requires a **post-fix proof PR** and a **separate
   explicit extractor rerun GO**.
4. **No grant/fix or rerun is authorized by this evidence PR.** Any future
   rerun must be a separate operator session with all approved stop-lines
   active.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. `session_id`,
`request_id`, `workspace_id`, `site_id` appear only as **column names** in the
source-shape description; all evidence values are sanitized booleans /
structured PostgreSQL error fields (`code`, `severity`, `routine`, present-
booleans) only — not business row values.
