# Sprint 3 — Stage 0 — Runner DSN Source-of-Truth Verification Command-Pack Plan (Review-Only)

**Status:** `STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_VERIFICATION_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans **exactly one** future
**secret-safe operator verification command pack** that checks whether the Stage 0 runner DSN
**source-of-truth dependencies** can be moved from `blocked` → `verified active` in the
canonical Production Parameter Registry (`docs/production-parameter-registry.md`) — **without
printing raw values and without operator guessing**. It is **planning only, not execution**.

This PR **executes nothing** and **authorizes no** RB-ROTATE retry, credential rotation,
custody write, psql/auth rerun, Option A rerun, Step 2E, Stage 0, run-lock touch, grants,
schema/data changes, source-selection change, Option B code change, remediation, downstream
runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F. No raw DSN, host, port,
username, password, `.env.production` value, connection string, or custody contents appears
here.

> Provenance: PR #276 registry-amendment plan (Appendix A)
> (`b85234cd62f1358ad3ec5eeea7662a384791c746`,
> `STAGE0_RUNNER_DSN_REGISTRY_AMENDMENT_PLANNING_ONLY`); PR #275 canonical executable registry
> (`385b068db4a07a8738f64bed7361b8ff8a0c4ab7`); PR #274 custody-value-incomplete diagnostic
> (`b63f2b7b454609a36b1fe9f1c882ce562cee369d`); PR #199 seed
> (`193cdc96bfabe9893b330910b36cf681db77a20a`).

> **Where the result lands.** This is a separate planning doc (not an edit to the registry).
> If the future verification passes, the resulting **executable amendment must update
> `docs/production-parameter-registry.md`** (its `buyerrecon-production-parameter-registry-v1`
> block) before any RB-ROTATE retry. This plan does **not** itself activate any registry
> entry.

---

## 1. Status

`STAGE0_RUNNER_DSN_SOURCE_OF_TRUTH_VERIFICATION_COMMAND_PACK_PLANNING_ONLY` — docs-only;
designs the verification command pack; authorizes/executes nothing.

---

## 2. Registry Gate Baseline (the future pack must confirm first)

- Production path is `/opt/buyerrecon-backend`.
- Branch is `sprint2-architecture-contracts-d4cc2bf`.
- Fetch origin and **fast-forward to the current origin tip**.
- HEAD contains the **PR #275 merge** `385b068db4a07a8738f64bed7361b8ff8a0c4ab7`.
- HEAD contains the **PR #276 merge** `b85234cd62f1358ad3ec5eeea7662a384791c746`.
- `docs/production-parameter-registry.md` **exists**.
- The `buyerrecon-production-parameter-registry-v1` block **exists** and parses.
- The Stage 0 DSN dependency is **currently blocked** before verification
  (`prod.stage0.runner.custody.file` = `current_status=blocked`); the pack **reads** this
  state, it does **not** change it.

Each baseline check is guarded; on any failure the pack stops with terminal safe labels
(no verification of secret-adjacent material).

---

## 3. Verification Candidates (approved; inspected secret-safely)

The future operator command may inspect **only** these, and **only** in a secret-safe way:

| candidate | permitted use | constraint |
|---|---|---|
| Production Parameter Registry entries | read non-secret category/shape/custody-pointer/provenance | parse v1 block; never derive a value from it |
| PR #199 seed references | scheme, db name, role, DSN shape, host/port custody pointer | non-secret; cite `source_commit` |
| PR #195 host/port category provenance | confirm host/port **presence** in approved custody | **booleans only; never print host/port** |
| merged production environment/runtime registry docs | structural/custody narrative source | non-secret; structure/custody only |
| approved custody/source metadata | confirm approved location holds a complete value | presence/authority booleans only |
| `.env.production` | **local** operator-derived source **only** | **never printed/committed/parsed into output** |
| read-only PostgreSQL metadata | only if needed, **only as booleans/categories** | no rows, no DSN, no host/port, read-only |
| `/etc/buyerrecon/stage0-runner.env` | **only** as known-broken evidence (PR #274) | **never** treated as source of truth |

---

## 4. Required Checks (determined without printing raw values)

The future command must determine, as **booleans/categories only**:

- database **scheme** shape available;
- database **host** source available (presence in approved custody);
- database **port** source available (presence in approved custody);
- database **name** source available;
- Stage 0 **runner role** source available;
- custody **file path** source available;
- custody **key** source available;
- **complete DSN shape derivable locally** (from approved sources, in memory, never printed);
- derivation **does not require operator guessing**;
- **broken custody is not used as the only source**;
- **no raw secrets or raw connection values printed**.

---

## 5. Required Safe Labels

```text
parameter_registry_doc_present=true|false
parameter_registry_block_present=true|false
head_contains_pr275_merge=true|false
head_contains_pr276_merge=true|false
stage0_runner_role_source_present=true|false
stage0_runner_custody_file_source_present=true|false
stage0_runner_custody_key_source_present=true|false
database_scheme_source_present=true|false
database_host_source_present=true|false
database_port_source_present=true|false
database_name_source_present=true|false
approved_source_conflicts_detected=true|false
broken_custody_used_as_source=true|false
complete_stage0_runner_dsn_shape_derivable=true|false
operator_guess_required=true|false
raw_values_printed=false
verification_result=<verified_active_candidate|blocked_missing_dependency>
stop_line=<none_or_safe_stop_line>
```

---

## 6. Stop-Lines

Abort (safe stop-line + terminal safe labels; no raw value emitted) on at least:

- `parameter_registry_doc_missing`
- `parameter_registry_block_missing`
- `missing_pr275_merge`
- `missing_pr276_merge`
- `required_parameter_missing`
- `required_parameter_not_active_or_not_verifiable`
- `source_commit_tbd`
- `approved_source_conflict`
- `database_scheme_source_missing`
- `database_host_source_missing`
- `database_port_source_missing`
- `database_name_source_missing`
- `stage0_runner_role_source_missing`
- `custody_source_missing`
- `only_broken_custody_available`
- `operator_guess_required`
- `raw_value_would_be_printed`
- `unsupported_dsn_shape`

If a stop-line is hit, withhold all secret/raw output, record the blocked/missing-dependency
state in a docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Output Boundary

The future command must output **only safe booleans/categories**. It must **not** print:
- raw DSN;
- host;
- port;
- username;
- password;
- raw database URL;
- `.env.production` value;
- raw connection string;
- raw custody contents;
- psql raw output;
- customer/payload data.

Any local derivation of a complete DSN happens **in memory only** and is verified by a
**shape boolean** (e.g. `complete_stage0_runner_dsn_shape_derivable=true`) — the value itself
is never printed, parsed into output, or persisted.

---

## 8. Result Handling

- **If verification passes:** this plan still does **not** activate any registry entry. It
  only authorizes a **future docs-only evidence/amendment PR** to update
  `docs/production-parameter-registry.md` (move the verified required parameters to
  `current_status=active` with concrete `source_pr`/`source_commit`/`source_doc_path`,
  complete `shape_contract`, `validation_method`, `stop_line_if_missing`, and safe notes).
- **If verification fails:** the evidence PR records the **exact missing dependency** and
  leaves RB-ROTATE **blocked**.
- **No command** in this track rotates credentials or writes custody. RB-ROTATE remains
  separately GO-gated and stays blocked until the registry shows the required Stage 0 DSN
  parameters `verified active`.

---

## 9. Explicit Non-Authorization

**This PR authorizes no:** RB-ROTATE retry; credential rotation; custody write; psql/auth
rerun; Option A rerun; Step 2E; Stage 0; run-lock touch; grants; schema/data changes;
source-selection change; Option B code change; remediation; downstream runtime;
Lane/scoring/AMS/customer output; Gate 4E; Gate 4F.

**The verification command pack run is a future, separately-reviewed, separately GO-gated
step;** any resulting registry activation is a separate docs-only amendment PR. **Stage 0
execution remains separately GO-gated; RB-ROTATE remains blocked.**

---

## 10. Future Gated Sequence

1. **Merge** this docs-only verification command-pack planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **one** secret-safe verification run (registry gate
   baseline → approved-candidate checks → safe labels only).
3. Docs-only **evidence PR** recording the safe labels (verified-active candidate, or exact
   missing dependency).
4. If verified: a docs-only **registry amendment PR** updates
   `docs/production-parameter-registry.md` (required Stage 0 DSN parameters → `active`, no
   `TBD`, no broken-custody dependency).
5. Only then may a new **PR #270-aligned RB-ROTATE retry** be GO-gated (its
   `parameter_registry_gate` will pass).
6. **Stage 0 execution remains separately GO-gated.**

---

## 11. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
**host value, port value**, real URI, SSH banner, login source, host/network detail, raw
payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw PostgreSQL
error text, Node stack trace, or customer data. This is a docs-only plan for a **future**
secret-safe verification command pack that confirms the registry gate baseline, inspects
**only** approved source-of-truth candidates, and determines **as booleans/categories only**
whether the complete `STAGE0_RUNNER_DSN` is **locally derivable from approved sources without
operator guessing** — never printing the DSN or any component, never reading
`.env.production` into output, never treating the known-broken custody value as source of
truth, and **never** activating a registry entry by itself (a separate docs-only amendment PR
does that, only on verified evidence). The DSN shape
`postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
referenced from the registry uses literal placeholders, not values. (Per the PR #218 Codex
note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret
identifiers / public git commit hashes — not secret or row values.
