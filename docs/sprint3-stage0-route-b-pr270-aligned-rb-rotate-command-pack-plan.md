# Sprint 3 — Stage 0 — Route B PR #270-Aligned `RB-ROTATE` Retry Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_PR270_ALIGNED_RB_ROTATE_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only command-pack planning record**. PR #270 introduced the
simple confirmation token `RB-ROTATE`; PR #271 then recorded a Route B retry that was
**mis-aligned** with PR #270 (it expected the old long phrase and referenced PR #268 instead
of confirming the PR #270 merge), recorded as blocked/no-mutation
(`counts_as_pr270_rb_rotate_retry=false`). This plans **exactly one** corrected, **PR
#270-aligned** Route B credential-rotation + custody-alignment retry — **as planning only,
not execution**.

This PR **executes nothing** and **authorizes no execution / rotation / custody write / psql
/ reset / remediation**: no execution, no credential rotation, no custody write, no DSN
read/print/parse, no generated-password print, no `.env.production` read/print, no psql/auth
rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no run-lock touch, no
source-selection change, no Option B code change, no grant/schema/data change, no
remediation, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN, password,
generated password, token, host, port, database, username, URI, IP, or service-file content
appears in this document.

> Provenance: PR #271 mis-aligned Route B retry blocked/no-mutation evidence
> (`494cffd947c871c8dc99e48286b51e035d981740`,
> `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_RETRY_MISALIGNED_BLOCKED_OPERATOR_CONFIRMATION_FAILED`);
> PR #270 simple-confirmation-token plan (token `RB-ROTATE`)
> (`9f437c04a51fbb7a94ccde9a55d18006ea29616e`); PR #265 revised Route B command-pack plan
> (`91973ec2777ff3bb5ed037002ce62268923b48a7`).

---

## 1. Status

`STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_PR270_ALIGNED_RB_ROTATE_COMMAND_PACK_PLANNING_ONLY` —
docs-only; designs the corrected PR #270-aligned `RB-ROTATE` retry command pack;
authorizes/executes nothing.

---

## 2. Objective

Plan **exactly one** future corrected Route B credential rotation + custody alignment **retry**
for `buyerrecon_stage0_runner`, **aligned with PR #270**: the only accepted confirmation token
is `RB-ROTATE`, and Phase 0 must **explicitly confirm the PR #270 and PR #271 merges** and
**must not** reference PR #268 as the governing confirmation-token gate. The retry must remain
secret-safe and partial-state-safe (custody-write capability proven before any DB rotation,
DB rotation before custody write).

---

## 3. Phase 0 — Repo / Base Gates — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** execution —
> **not** run here. All shapes are illustrative.

- Production path **must be** `/opt/buyerrecon-backend`.
- Branch **must be** `sprint2-architecture-contracts-d4cc2bf`.
- Working tree **must be clean before execution**.
- **Fetch origin.**
- **Fast-forward** to the current `origin/sprint2-architecture-contracts-d4cc2bf` tip.
- **Confirm HEAD contains the PR #270 merge:** `9f437c04a51fbb7a94ccde9a55d18006ea29616e`.
- **Confirm HEAD contains the PR #271 merge:** `494cffd947c871c8dc99e48286b51e035d981740`.
- The command **must not** reference **PR #268** as the governing confirmation-token gate.
- Each gate is guarded; on any failure, stop with terminal safe labels (no mutation).

Safe Phase 0 labels (booleans/hashes only):
```text
expected_path_ok=true|false
expected_branch_ok=true|false
working_tree_clean_before=true|false
remote_fetch_attempted=true
remote_fetch_result=success|failure
fast_forward_to_current_tip_applied=true|false
head_contains_pr270_merge=true|false
head_contains_pr271_merge=true|false
governing_token_gate_is_pr270_rb_rotate=true
references_pr268_as_token_gate=false
```

---

## 4. Confirmation Token Requirement (PR #270-aligned)

- The **only** accepted operator confirmation token is: `RB-ROTATE`.
- **Exact equality required.**
- **Only trailing carriage-return (`\r`) normalization** is allowed.
- **Reject** lowercase, extra spaces, punctuation, quotes, backticks, alternate wording, the
  **old long phrase**, or **any multi-word phrase**.
- **Never print** the typed confirmation value.
- Emit **only** these safe booleans/tokens:
  ```text
  operator_confirmation_passed=true|false
  operator_confirmation_length_matches=true|false
  operator_confirmation_exact_match=true|false
  operator_confirmation_token_source=pr270_rb_rotate
  ```
- Pass only when the entry exactly equals `RB-ROTATE` (after stripping at most one trailing
  `\r`); on any other input, fail closed with `stop_line=operator_confirmation_failed`.

> `RB-ROTATE` is a **non-secret operational confirmation token** (not a password/DSN/
> credential/auth material). Recording `operator_confirmation_token_source=pr270_rb_rotate`
> ties this gate explicitly to PR #270, not PR #268.

---

## 5. Secret Handling

- **Hidden input only** for the new password and the **complete** `STAGE0_RUNNER_DSN`
  (`read -r -s` into in-memory variables; never argv; never echoed; never in shell history).
- **Require password re-entry match** before confirmation (enter twice; compare in memory;
  mismatch ⇒ stop).
- **Require custody DSN re-entry match** before confirmation (enter twice; compare in memory;
  mismatch ⇒ stop).
- **Never print** the password, generated password, DSN, DSN components, host, port,
  username, database name, raw connection string, or raw custody contents.
- **Do not parse/echo DSN components.**
- **No argv secrets.**
- **Clear secret variables on every path** (success and every stop-line).

Safe secret-handling labels (booleans only):
```text
secret_input_hidden=true
password_reentry_match=true|false
custody_dsn_reentry_match=true|false
dsn_component_output=false
secret_value_printed=false
secret_cleared=true
```

---

## 6. Phase 1 — Non-Secret Custody-Write Preflight (before DB rotation)

- Validate `/etc/buyerrecon` directory availability and **root-write ability** using a
  **non-secret probe file only** (harmless placeholder; not the real custody file; not a
  secret).
- Do this **before** any DB rotation.
- Prove the probe can be set **root:root, chmod 600**, then remove it.
- **If the preflight fails, stop before DB rotation** (custody-write proven impossible ⇒
  never mutate the DB).
- Emit **only** safe booleans.

Safe Phase 1 labels (booleans only):
```text
non_secret_custody_write_preflight_attempted=true
non_secret_custody_write_preflight_passed=true|false
```

---

## 7. Phase 3 — Scoped PostgreSQL Password Rotation (runner role only)

- Scope **only** to target role `buyerrecon_stage0_runner`.
- **No other role changes.**
- **No grants.**
- **No schema changes.**
- **No data DML.**
- Feed the `ALTER ROLE buyerrecon_stage0_runner WITH PASSWORD <hidden>` SQL to
  `sudo -u postgres psql` **via stdin from a root-only process** (no argv secret; no
  persisted plaintext SQL file).
- **Raw psql/PostgreSQL output withheld** (chmod-600 root-only temp if needed; never printed).
- Emit **only** safe booleans and broad labels.

Safe Phase 3 labels (booleans/tokens only):
```text
target_role=buyerrecon_stage0_runner
only_target_role_altered=true|false
grant_schema_data_change=false
db_rotation_attempted=true|false
db_rotation_applied=true|false
raw_psql_output_printed=false
```

---

## 8. Phase 4 — Root-Only Atomic Custody Write (after successful DB rotation)

- Write `/etc/buyerrecon/stage0-runner.env` **only after a successful DB rotation**.
- Key **must be** `STAGE0_RUNNER_DSN`.
- File must be **root-owned** and **chmod 600** (atomic write: temp → fsync → rename → chmod).
- **No custody contents printed** (verify by **presence/permissions/ownership** category
  checks only — key presence only; never read back the value).
- Emit **only** these safe booleans:
  ```text
  custody_write_attempted=true|false
  custody_written=true|false
  custody_file_exists=true|false
  custody_file_owner_root=true|false
  custody_file_chmod_600=true|false
  custody_key_present=true|false
  db_custody_in_sync=true|false
  ```

> Partial-state safety: because Phase 1 proved custody-write capability before Phase 3, a
> Phase 4 failure after a successful Phase 3 is recorded as the **true** partial state
> (`db_rotation_applied=true`, `custody_written=false`, `db_custody_in_sync=false`,
> `stop_line=…`) — never hidden; its remediation is its own separately-GO-gated step.

---

## 9. Stop-Lines

Abort (safe stop-line + terminal safe labels for the **actual** reached state; no value/raw
emitted) if any of:
- wrong path;
- wrong branch;
- dirty working tree;
- cannot fast-forward to current tip;
- HEAD does **not** contain the PR #270 merge `9f437c04a51fbb7a94ccde9a55d18006ea29616e`;
- HEAD does **not** contain the PR #271 merge `494cffd947c871c8dc99e48286b51e035d981740`;
- the command references **PR #268** as the governing token gate;
- the confirmation token is **not exactly** `RB-ROTATE`;
- the **old long phrase** is accepted or expected;
- a secret would be printed;
- a DSN component would be printed;
- raw psql/PostgreSQL output would be printed;
- custody contents would be printed;
- the non-secret custody preflight fails;
- password entries mismatch;
- custody DSN entries mismatch;
- the target role is **not** `buyerrecon_stage0_runner`;
- any grant/schema/data mutation would occur;
- any Stage 0 / run-lock / downstream action would occur.

If a stop-line is hit, withhold all secret/raw output, clear secrets, emit terminal safe
labels for the actual reached state, record the blocked state in a docs-only evidence PR
(safe labels only), and take no fix/retry without separate review/GO.

---

## 10. Explicit Non-Authorization

**This PR authorizes no:** execution; credential rotation; custody write; DSN
read/print/parse; generated-password print; `.env.production` read/print; psql/auth rerun;
Option A preflight rerun; Step 2E; Stage 0; run-lock touch; source-selection change; Option B
code change; grant/schema/data change; remediation; runtime/downstream/Lane/scoring/AMS/
customer action.

**The corrected PR #270-aligned `RB-ROTATE` retry execution is a future, separately-reviewed,
separately GO-gated step** that never prints/stores the value. **Stage 0 execution remains
separately GO-gated.**

---

## 11. Next Step / Future Gated Sequence

1. **Codex narrow review** of this docs-only plan PR.
2. Only after **PASS and merge** may Helen issue a **fresh explicit execution GO** for **one**
   corrected PR #270-aligned `RB-ROTATE` retry.
3. On the production host, run the standard secret-safe **Phase 0 → Phase 5** chain with the
   PR #270-aligned confirmation (`RB-ROTATE` only) and the **PR #270 + PR #271 merge
   confirmations** in Phase 0 (not PR #268).
4. Docs-only **correction evidence PR** (safe labels only; including the actual reached state).
5. After the correction evidence merges, a **separately gated** **Option A binding/auth
   preflight rerun** → docs-only evidence PR.
6. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
7. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, Node stack trace, or the operator's typed confirmation value, or
customer data. This is a docs-only plan for a **future** corrected Route B chain that gates
on the **non-secret token `RB-ROTATE`** (exact equality; trailing-`\r` only; reject
lowercase / extra spaces / punctuation / quotes / backticks / alternate wording / old long
phrase / any multi-word phrase; never print the typed value), **explicitly confirms the PR
#270 and PR #271 merges** in Phase 0 (and **does not** reference PR #268 as the token gate),
takes the new password + complete `STAGE0_RUNNER_DSN` via **hidden input with re-entry match
only** (never argv, never echoed), **preflights custody-write capability with a non-secret
probe before any DB rotation**, applies a **scoped `ALTER ROLE buyerrecon_stage0_runner`**
only (no other role/grant/schema/data), writes a matching `STAGE0_RUNNER_DSN` to a **root:root
chmod-600** custody file (verifying key presence only), withholds raw psql output, and clears
secrets on every path — it **runs no rotation**, **writes no custody value**, **runs no
psql/auth**, and **changes no grant/schema/data**. The confirmation tokens `RB-ROTATE` and
the old long phrase, the role name `buyerrecon_stage0_runner`, the custody-file path
`/etc/buyerrecon/stage0-runner.env`, the env-var/key name `STAGE0_RUNNER_DSN`, and the
illustrative `ALTER ROLE … WITH PASSWORD <hidden>` shape are non-secret control tokens, not
secret values. (Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no
secret value exposed, printed, or recorded.") All values above are safe labels / booleans /
category tokens / non-secret control strings / public git commit hashes — not secret or row
values.
