# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof — Evidence (PASS)

**Status:** `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PASS`

This is a **docs-only evidence record**. The corrected psql-only **Option A**
command path (PR #185) **successfully** created the dedicated Stage 0 login role
`buyerrecon_stage0_runner`, applied **only** the reviewed narrow direct grants,
and **passed catalog proof** (positive privileges present, all forbidden
privileges absent, no membership, no ownership).

**This PR records only the create/grant/proof result. It does NOT authorize or
record Stage 0 execution.** A separate explicit Stage 0 execution GO is still
required. This PR changes no roles, runs no SQL, and records safe labels only —
no secrets, password, DSN, or raw data.

> Provenance: PR #179 dedicated role direct-grant plan
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #182 admin-custody resolution
> (`e31a8fb9449151e5312ae1600f5fb59b96839ef6`); PR #185 psql-only command pack
> (`77b520ae3a30f71880d101004504dea01e1239a4`); prior blocked attempts
> PR #183 / #184 / #186 / #187. Proof-run repo head:
> `09704fcfabdeb8136fb17798601bd8169e9074b8` (includes PR #187 merge).

---

## 1. Authorization

- Admin-custody **Option A** create/grant/proof (retry 3), using the corrected
  psql-only command pack (PR #185), for exactly **one** bounded action for
  `buyerrecon_stage0_runner`.
- This did **not** authorize Stage 0 execution.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_ADMIN_CUSTODY_OPTION_A_PSQL_ONLY_CREATE_GRANT_PROOF_RETRY3_START
on_production_host=true
repo_head=09704fcfabdeb8136fb17798601bd8169e9074b8
pr179_merge_present=true
pr182_merge_present=true
pr183_merge_present=true
pr184_merge_present=true
pr185_merge_present=true
pr186_merge_present=true
pr187_merge_present=true
psql_only_command_pack_present=true
password_received=true
password_confirmed=true
password_printed=false
create_grant_sql_ok=true
raw_output_printed=false
db_expected|true
role_exists|true
role_can_login|true
role_is_superuser|false
role_createdb|false
role_createrole|false
role_replication|false
role_bypassrls|false
priv_accepted_events_select|true
priv_ingest_requests_select|true
priv_stage0_select|true
priv_stage0_insert|true
priv_stage0_update|true
not_member_scoring_worker|true
forbidden_risk_select|false
forbidden_risk_insert|false
forbidden_risk_update|false
forbidden_poi_select|false
forbidden_poi_insert|false
forbidden_poi_update|false
forbidden_poi_seq_usage|false
forbidden_poi_seq_select|false
forbidden_poi_seq_update|false
forbidden_poiseq_select|false
forbidden_poiseq_insert|false
forbidden_poiseq_update|false
forbidden_poiseq_seq_usage|false
forbidden_poiseq_seq_select|false
forbidden_poiseq_seq_update|false
forbidden_stage0_delete|false
forbidden_lane_a_any|false
forbidden_lane_b_any|false
owns_no_tables|true
role_created=true
grants_applied=true
create_grant_proof_ok=true
stage0_command_run=false
run_lock_touched=false
raw_temp_removed=true
STAGE0_ADMIN_CUSTODY_OPTION_A_PSQL_ONLY_CREATE_GRANT_PROOF_RETRY3_DONE
```

---

## 3. Interpretation — PASS

This is a **proof pass for the dedicated Stage 0 role setup**:
- production host was reached (`on_production_host=true`);
- repo head was `09704fcfabdeb8136fb17798601bd8169e9074b8`;
- **all merge gates present** — PR #179, #182, #183, #184, #185, #186, #187;
- corrected psql-only command pack present;
- hidden password was **received and confirmed** (`password_received=true`,
  `password_confirmed=true`); **password not printed** (`password_printed=false`);
- **create/grant SQL completed** (`create_grant_sql_ok=true`); **raw SQL output
  not printed** (`raw_output_printed=false`);
- **catalog proof ran and passed** (`db_expected|true`).

**Role state:**
- `role_exists|true`; `role_can_login|true`;
- safe role attributes — **not** superuser / createdb / createrole / replication
  / bypassrls (all `|false`).

**Allowed privileges present (true):**
- `SELECT` on `public.accepted_events`;
- `SELECT` on `public.ingest_requests`;
- `SELECT`, `INSERT`, `UPDATE` on `public.stage0_decisions`.

**Boundary holds (all forbidden absent / membership / ownership):**
- **not** a member of `buyerrecon_scoring_worker` (`not_member_scoring_worker|true`);
- forbidden **Risk** privileges `|false`;
- forbidden **POI** table privileges `|false`; forbidden **POI sequence**
  privileges `|false`;
- forbidden **POI-sequence** table privileges `|false`; forbidden **POI-sequence
  sequence** privileges `|false`;
- forbidden `stage0_decisions` **DELETE** `|false`;
- forbidden **Lane A/B** INSERT `|false`;
- **owns no tables** (`owns_no_tables|true`).

**Outcome flags:**
- `role_created=true`; `grants_applied=true`; `create_grant_proof_ok=true`;
- `stage0_command_run=false`; `run_lock_touched=false`;
- `raw_temp_removed=true`.

The dedicated Stage 0 execution identity now exists with **exactly** the reviewed
least-privilege grants and **nothing broader**.

---

## 4. What Did Not Happen

- No Stage 0 execution.
- No run-lock touch.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot runtime.
- No Lane A/B preview or writer.
- No scoring runtime; no AMS Trust/Pass runtime.
- No customer output; no Gate 4E; no Gate 4F.
- No sequence grants; no schema-wide grants; no ownership transfer.
- No `buyerrecon_scoring_worker` membership.
- No Risk / POI / Lane / scoring / AMS grants.
- No password value printed; no DSN / token / raw hostname / IP / raw IDs / raw
  rows / payload / customer data printed.

---

## 5. Terminal Artifact Note

The pasted terminal transcript included a small shell/display fragment before the
safe output line. The safe labels show the command reached the reviewed psql-only
path and completed proof successfully (`…RETRY3_START` → `…RETRY3_DONE`,
`create_grant_proof_ok=true`). The fragment is treated as a **terminal paste /
display artifact** — **not** evidence of any additional command or secret
exposure (`password_printed=false`, `raw_output_printed=false`,
`raw_temp_removed=true`) — unless actual raw output later suggests otherwise.

---

## 6. Next Gated Step

- After this proof-pass evidence PR is reviewed and merged, **Stage 0 execution
  is still not automatically authorized.**
- **Helen must issue a separate explicit Stage 0 execution GO** before any
  `npm run stage0:run` or any run-lock-touching action.
- The dedicated identity `buyerrecon_stage0_runner` is now available for that
  future, separately-GO'd Stage 0 run (which must itself be secret-safe,
  one-execution, role/database-gated, and recorded in its own docs-only evidence
  PR).

---

## 7. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The password was received
and confirmed but **never printed** (`password_printed=false`); raw `psql` output
was withheld (`raw_output_printed=false`) and the raw temp file removed
(`raw_temp_removed=true`). All values above are **safe labels / booleans / a
public git commit hash / role / relation / sequence / column names** — not secret
or row values.
