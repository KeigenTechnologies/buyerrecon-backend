# Sprint 3 — Stage 0 — Route B Simple Confirmation-Token Plan (Review-Only)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_SIMPLE_CONFIRMATION_TOKEN_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. PR #266, PR #267, and PR #269 all
recorded revised Route B execution attempts that stopped safely at the **same** stop-line
(`operator_confirmation_failed`). PR #268 added hardened confirmation diagnostics; PR #269
then showed `operator_confirmation_exact_match=false` **and**
`operator_confirmation_length_matches=false` — the entered confirmation was **not** the
required exact long line and **not even the same length**. The repeated blocker is now the
**confirmation-entry mechanism** itself, not the command-pack logic, the custody preflight,
the credential state, or Stage 0 readiness. This plans a **simpler strict non-secret
confirmation token** (`RB-ROTATE`) for the next retry — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no retry / rotation / custody write / psql /
reset / remediation**: no execution retry, no credential reset, no password rotation, no
custody overwrite, no DSN read/print/parse, no generated-password print, no `.env.production`
read/print, no psql/auth rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no
run-lock touch, no source-selection change, no Option B code change, no grant/schema/data
change, no remediation, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN,
password, generated password, token, host, port, database, username, URI, IP, or
service-file content appears in this document.

> Provenance: PR #269 hardened Route B execution blocked at operator confirmation
> (`8e13aa8550dddb81c832537afa57161b5f29d058`,
> `STAGE0_AUTH_OR_CREDENTIAL_HARDENED_REVISED_ROUTE_B_EXECUTION_BLOCKED_OPERATOR_CONFIRMATION_FAILED`);
> PR #268 confirmation-entry hardening plan (`a6e04e190ee52c7e2cb20dd10fe0eeb9ae401d86`);
> PR #267 Route B retry blocked (`dbaf7ca0808495bffc0fb014753732d4f1f5ae11`); PR #266 Route B
> blocked (`5921f5ae3751848cf4cd73eda75978a57a572c20`).

---

## 1. Status

`STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_SIMPLE_CONFIRMATION_TOKEN_PLANNING_ONLY` — docs-only;
designs a simpler strict non-secret confirmation token that preserves the human confirmation
gate; authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #266 / PR #267 / PR #269)

All three revised Route B execution attempts:
- passed repo / current-tip preflight;
- passed the **non-secret custody-write preflight before any DB rotation**;
- reached the **hidden-input** phase;
- **stopped before DB rotation** at `stop_line=operator_confirmation_failed`;
- performed **no** password rotation;
- performed **no** custody write;
- altered **no** role;
- caused **no** DB/custody drift;
- **cleared secrets**;
- printed **no** secret / raw / typed-value output.

PR #269 specifically recorded `operator_confirmation_exact_match=false` **and**
`operator_confirmation_length_matches=false`.

---

## 3. Problem Statement

Even with the PR #268 hardened plain-line prompt, the operator's entry **failed on both exact
match and length** — i.e. the long phrase
`ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN` is **error-prone to enter
manually** (length differences point to dropped/added characters or partial entry, not a
trailing nuance). The fix is **not** to weaken the gate but to make the confirmation token
**short and unambiguous** so an exact manual entry is realistic — while keeping the gate
**exactly as strict** (exact equality, no alternate wording).

---

## 4. Simple Confirmation-Token Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** confirmation
> step — **not** run here. All shapes are illustrative; no command is executed by this PR.

**Preserved invariants (non-negotiable):**
- **Keep the exact human confirmation gate** — it is **not** removed and **not** weakened.
- **Final pass condition remains exact string equality** (with at most a trailing
  carriage-return normalization).
- **Non-secret confirmation method only.**

**The change (length/ambiguity reduction only):**
- **Replace** the long confirmation phrase with a **short fixed non-secret token**:
  `RB-ROTATE`
  (`long_confirmation_string_replaced=true`).
- Accept **only exact equality** to `RB-ROTATE`, with **at most** a trailing carriage-return
  (`\r`) normalization (e.g. CRLF paste).
- **Do not** accept lowercase, extra spaces, quotes, punctuation, backticks, or alternative
  wording.
- **Never print the typed value.**

**Illustrative prompt shape (not run here):**

```text
To confirm the scoped runner rotation + custody update, type this exact token when prompted:
RB-ROTATE
```

Then read input (visible, non-secret), strip only a trailing `\r`, and compare for exact
equality to `RB-ROTATE`. Pass only on exact match.

> **Important:** `RB-ROTATE` is a **non-secret operational confirmation token**. It is **not**
> a password, DSN, credential, or auth material. It carries no secret value and gates only the
> human "yes, proceed" decision for the scoped rotation + custody update.

---

## 5. Safe Diagnostics (value never printed)

The confirmation step emits **only** these safe labels — **never** the entered value:

```text
operator_confirmation_passed=true|false
operator_confirmation_length_matches=true|false
operator_confirmation_exact_match=true|false
confirmation_token=RB-ROTATE
stop_line=operator_confirmation_failed|none
```

- `operator_confirmation_length_matches` compares **lengths only** (a cheap hint at a
  stray/dropped character) — it does **not** reveal the typed value.
- `confirmation_token=RB-ROTATE` records the **non-secret** token in effect (not a secret).
- On **success** (`operator_confirmation_passed=true`, `operator_confirmation_exact_match=true`,
  `stop_line=none`), the existing flow proceeds to the (separately GO-gated) scoped rotation +
  custody write phases unchanged.

---

## 6. Stop-Lines

Abort (safe stop-line; no value/raw emitted) if any of:
- the confirmation gate would be **removed or weakened**;
- an **alternate token** would be accepted (anything other than exact `RB-ROTATE`);
- **lowercase / extra spaces / punctuation / quotes / backticks** would be accepted;
- the **typed value would be printed** (in any form);
- any **secret / password / DSN / generated password** would be printed;
- **`.env.production`** would be read or printed;
- any **credential reset / password rotation / custody overwrite** would occur **in this
  planning PR**;
- any **psql/auth rerun** would occur;
- any **Option A preflight rerun** would occur;
- any **Step 2E / Stage 0 / run-lock / source-selection change / Option B code change /
  remediation / downstream** action would occur.

If a stop-line is hit, make no change, record the blocked state in a docs-only evidence PR
(safe labels only), and take no fix/retry without separate review/GO.

---

## 7. Safe Labels

```text
simple_confirmation_token_planning_only=true
prior_confirmation_failure_count=3
confirmation_gate_preserved=true
long_confirmation_string_replaced=true
simple_confirmation_token=RB-ROTATE
confirmation_exact_match_required=true
operator_confirmation_value_print_allowed=false
credential_rotation_authorized=false
custody_overwrite_authorized=false
psql_auth_rerun=false
option_a_preflight_rerun=false
stage0_executed=false
step2e_rerun=false
run_lock_touched=false
remediation_authorized=false
```

> A future Route B retry using `RB-ROTATE` would additionally emit, on outcome,
> `operator_confirmation_passed=true|false`, `operator_confirmation_length_matches=true|false`,
> `operator_confirmation_exact_match=true|false`, `confirmation_token=RB-ROTATE`, and
> `stop_line=operator_confirmation_failed|none` — safe tokens only; **the entered value is
> never printed**.

---

## 8. Non-Authorization

**This PR authorizes no:** execution retry; credential reset; password rotation; custody
overwrite; DSN read/print/parse; generated-password print; `.env.production` read/print;
psql/auth rerun; Option A preflight rerun; Step 2E; Stage 0; run-lock; source-selection
change; Option B code change; grant/schema/data change; remediation;
runtime/downstream/Lane/scoring/AMS/customer action.

**The simplified confirmation token is a property of a future, separately-reviewed, separately
GO-gated revised Route B execution retry** — it changes only the confirmation token's
length/shape, never the gate's strictness. **Stage 0 execution remains separately GO-gated.**

---

## 9. Future Gated Sequence

1. **Merge** this docs-only simple-confirmation-token planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **one** Route B execution **retry** using token
   `RB-ROTATE`.
3. The retry runs the standard secret-safe **Phase 0 → Phase 5** chain (current-tip
   fast-forward so HEAD contains this merge; non-secret custody-write preflight before DB
   rotation; hidden secret input; `RB-ROTATE` confirmation with exact equality + safe
   diagnostics; scoped rotation for `buyerrecon_stage0_runner` only; root-only chmod-600
   custody write; cleanup).
4. Docs-only **correction evidence PR** (safe labels only).
5. After the correction evidence merges, a **separately gated** **Option A binding/auth
   preflight rerun** → docs-only evidence PR.
6. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
7. **Stage 0 execution remains separately GO-gated.**

---

## 10. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, Node stack trace, or the operator's typed confirmation value, or
customer data. This is a docs-only plan to **replace the long confirmation phrase with a short
fixed non-secret token `RB-ROTATE`** while **preserving the exact human confirmation gate and
its exact-equality pass condition** (stripping only a single trailing carriage return),
**rejecting** lowercase / extra spaces / punctuation / quotes / backticks / alternate wording,
and emitting **only safe booleans** (`operator_confirmation_passed`,
`operator_confirmation_length_matches`, `operator_confirmation_exact_match`,
`confirmation_token=RB-ROTATE`, `stop_line`) — **never** printing the entered value; it **runs
no confirmation step**, performs **no** psql/auth, **no** custody write, **no** DB rotation,
and records **no** DSN/secret/env value. `RB-ROTATE` is a **non-secret operational
confirmation token** (not a password/DSN/credential/auth material); the role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, and the
env-var/key name `STAGE0_RUNNER_DSN` are likewise non-secret control tokens. (Per the PR #218
Codex note: "no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / non-secret control
strings / public git commit hashes — not secret or row values.
