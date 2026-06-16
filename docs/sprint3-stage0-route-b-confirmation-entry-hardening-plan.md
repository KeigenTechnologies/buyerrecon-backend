# Sprint 3 — Stage 0 — Route B Confirmation-Entry Hardening Plan (Review-Only)

**Status:** `STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_CONFIRMATION_ENTRY_HARDENING_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. PR #266 and PR #267 both recorded
revised Route B execution attempts that stopped safely at the **same** stop-line
(`operator_confirmation_failed`) — twice. The blocker is now consistently the **final
confirmation-entry control**, not the Route B command-pack preflight or the custody-write
preflight. This plans a **tiny confirmation-entry hardening** so the next retry can avoid
ambiguity **without weakening the safety gate** — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no retry / rotation / custody write / psql /
reset / remediation**: no execution retry, no credential reset, no password rotation, no
custody overwrite, no DSN read/print/parse, no generated-password print, no `.env.production`
read/print, no psql/auth rerun, no Option A preflight rerun, no Step 2E, no Stage 0, no
run-lock touch, no source-selection change, no Option B code change, no grant/schema/data
change, no remediation, no runtime/downstream/Lane/scoring/AMS/customer action. No real DSN,
password, generated password, token, host, port, database, username, URI, IP, or
service-file content appears in this document.

> Provenance: PR #267 Route B retry blocked at operator confirmation
> (`dbaf7ca0808495bffc0fb014753732d4f1f5ae11`,
> `STAGE0_AUTH_OR_CREDENTIAL_REVISED_ROUTE_B_EXECUTION_RETRY_BLOCKED_OPERATOR_CONFIRMATION_FAILED`);
> PR #266 Route B blocked at operator confirmation
> (`5921f5ae3751848cf4cd73eda75978a57a572c20`); PR #265 revised Route B command-pack plan
> (`91973ec2777ff3bb5ed037002ce62268923b48a7`).

---

## 1. Status

`STAGE0_AUTH_OR_CREDENTIAL_ROUTE_B_CONFIRMATION_ENTRY_HARDENING_PLANNING_ONLY` — docs-only;
designs a tiny confirmation-entry hardening that preserves the exact human confirmation gate;
authorizes/executes nothing.

---

## 2. Evidence Carried Forward (PR #266 / PR #267)

Both revised Route B execution attempts:
- passed repo / path / branch / current-tip preflight;
- passed the **non-secret custody-write preflight before any DB rotation**;
- reached the **hidden-input** phase;
- **stopped before DB rotation** at `stop_line=operator_confirmation_failed`;
- performed **no** password rotation;
- performed **no** custody write;
- altered **no** role;
- caused **no** DB/custody drift;
- **cleared secrets**;
- printed **no** secret/raw output.

---

## 3. The Repeated Stop-Line Problem

The blocker is **consistently the final confirmation-entry control** — the operator-typed
confirmation string did not exactly equal the expected value, **twice in a row**. Everything
earlier in the chain (preflights, hidden input) works. This is an **entry/format ambiguity**
at the confirmation prompt, not a logic fault and not a safety-gate failure. The hardening
must make the **exact required string easy to enter correctly** while keeping the gate
**exactly as strict**.

---

## 4. Confirmation-Entry Hardening Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** confirmation
> step — **not** run here. All shapes are illustrative; no command is executed by this PR.

**Preserved invariants (non-negotiable):**
- **Keep the exact human confirmation gate** — it is **not** removed and **not** weakened.
- **Do not lower the safety standard.**
- **Final pass condition remains exact string equality** to:
  `ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN`
- The **confirmation string itself is unchanged** (`confirmation_string_changed=false`).
- **Non-secret confirmation method only** — the confirmation string is a non-secret control
  token; no password, DSN, generated secret, or `.env.production` is involved.

**Hardening (candidate, reduces entry ambiguity only):**
1. **Print the exact required confirmation string on its own plain terminal line**
   immediately before the prompt — via a plain `printf` line (not markdown), so there are no
   backticks/quotes/formatting characters to accidentally copy.
2. **Ask the operator to copy/paste exactly** from that plain `printf` output line.
3. **Normalize only a trailing carriage return** (`\r`) if present (e.g. CRLF paste) before
   comparison — but **do not** allow extra spaces, case changes, punctuation, quotes,
   backticks, or alternate wording. Nothing else is trimmed or transformed.
4. Compare with **exact equality** to the expected string; pass only on exact match.

**Illustrative prompt shape (not run here):**

```text
To confirm, copy/paste the next line exactly when prompted:
ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN
```

Then read input (visible, non-secret), strip only a trailing `\r`, and compare for exact
equality. **Never print the entered value.**

---

## 5. Safe Diagnostics (on failure; value never printed)

On a confirmation **failure**, emit **only** these safe labels — **never** the entered value:

```text
operator_confirmation_passed=false
operator_confirmation_length_matches=true|false
operator_confirmation_exact_match=false
stop_line=operator_confirmation_failed
```

- `operator_confirmation_length_matches` compares **lengths only** (a cheap hint at
  trailing-space / truncation / extra-character issues) — it does **not** reveal the typed
  value.
- **Optionally** `operator_confirmation_sha256_matches=true|false` **only if** it hashes the
  entered value **internally** and prints **neither** the typed value **nor** the expected
  hash — it emits just the boolean. If that cannot be guaranteed, omit it.
- On **success**, the existing flow proceeds to the (separately GO-gated) hidden-input /
  rotation phases unchanged.

These diagnostics help the operator self-correct (e.g. "length mismatch ⇒ a stray space")
**without** ever echoing what was typed.

---

## 6. Stop-Lines

Abort (safe stop-line; no value/raw emitted) if any of:
- the confirmation gate would be **removed or weakened**;
- the **exact-equality** final pass condition would be relaxed (beyond stripping a single
  trailing `\r`);
- the **confirmation string would be changed**;
- the **entered confirmation value would be printed** (in any form);
- the **expected SHA-256** (if used) would be printed, or the typed value would be hashed in
  a way that prints it;
- any **secret / password / DSN / generated secret / `.env.production`** would be involved in
  the confirmation method;
- any **psql/auth, custody write, or DB rotation** would occur in this hardening work;
- any **Step 2E / Stage 0 / run-lock / source-selection / Option B code change / remediation
  / downstream** action would occur.

If a stop-line is hit, make no change, record the blocked state in a docs-only evidence PR
(safe labels only), and take no fix/retry without separate review/GO.

---

## 7. Safe Labels

```text
confirmation_entry_hardening_planning_only=true
prior_confirmation_failure_count=2
confirmation_gate_preserved=true
confirmation_string_changed=false
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

> A future hardened confirmation step would additionally emit, on outcome,
> `operator_confirmation_passed=true|false`, `operator_confirmation_length_matches=true|false`,
> `operator_confirmation_exact_match=true|false` (and optionally
> `operator_confirmation_sha256_matches=true|false`) plus `stop_line=…` — safe tokens only;
> **the entered value and any expected hash are never printed**.

---

## 8. Non-Authorization

**This PR authorizes no:** execution retry; credential reset; password rotation; custody
overwrite; DSN read/print/parse; generated-password print; `.env.production` read/print;
psql/auth rerun; Option A preflight rerun; Step 2E; Stage 0; run-lock; source-selection
change; Option B code change; grant/schema/data change; remediation;
runtime/downstream/Lane/scoring/AMS/customer action.

**The hardened confirmation step is a property of a future, separately-reviewed, separately
GO-gated revised Route B execution retry** — it changes only how the confirmation string is
presented/diagnosed, never the gate's strictness. **Stage 0 execution remains separately
GO-gated.**

---

## 9. Future Gated Sequence

1. **Merge** this docs-only confirmation-entry hardening planning PR (after Codex review).
2. **Codex review.**
3. **Fresh explicit Helen GO** for **one** revised Route B execution **retry** incorporating
   the hardened confirmation step (plain `printf` line; copy/paste; exact equality; trailing
   `\r` strip only; safe failure diagnostics; value never printed).
4. On the production host, run the standard Phase 0 → Phase 5 chain (current-tip fast-forward
   so HEAD contains this merge; non-secret custody-write preflight before DB rotation; hidden
   secret input; hardened confirmation; scoped rotation for `buyerrecon_stage0_runner` only;
   root-only chmod-600 custody write; cleanup).
5. Docs-only **execution evidence PR** (safe labels only).
6. After that evidence is reviewed/merged, require a **fresh GO** for an **Option A
   binding/auth preflight rerun** → docs-only evidence PR.
7. **Only if auth passes** → plan **Step 2E / Stage 0** separately.
8. **Stage 0 execution remains separately GO-gated.**

---

## 10. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, generated
password, raw secret-manager payload, service-file content, `.env.production` content/value,
bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or Node stack trace, or customer data. This is a docs-only plan for a
**tiny confirmation-entry hardening** that **preserves the exact human confirmation gate and
its exact-equality pass condition** (stripping only a single trailing carriage return),
**changes the confirmation string in no way**, presents the required non-secret control
string on a plain `printf` line for copy/paste, and emits **only safe booleans** on failure
(`operator_confirmation_passed`, `operator_confirmation_length_matches`,
`operator_confirmation_exact_match`, optionally `operator_confirmation_sha256_matches`,
`stop_line`) — **never** printing the entered value or any expected hash; it **runs no
confirmation step**, performs **no** psql/auth, **no** custody write, **no** DB rotation, and
records **no** DSN/secret/env value. The required confirmation string
`ROTATE buyerrecon_stage0_runner AND UPDATE STAGE0_RUNNER_DSN`, the role name
`buyerrecon_stage0_runner`, the custody-file path `/etc/buyerrecon/stage0-runner.env`, and
the env-var/key name `STAGE0_RUNNER_DSN` are non-secret control tokens, not secret values.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / category
tokens / non-secret control strings / public git commit hashes — not secret or row values.
