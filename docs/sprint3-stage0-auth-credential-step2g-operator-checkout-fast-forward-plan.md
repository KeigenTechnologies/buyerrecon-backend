# Sprint 3 — Stage 0 auth/credential Step 2G — Operator Checkout Fast-Forward / Sync Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPERATOR_CHECKOUT_FAST_FORWARD_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **safe path to advance
the operator checkout `HEAD`** so it **contains the required merged PRs (#232/#233/#234/
#235)** before any Option C proof rerun — after PR #235 found
`repo_sync_preflight_result=not_ready`,
`stop_line=target_commits_not_contained_in_head` (commits known locally, but `HEAD` not
advanced to include them).

This PR **executes nothing** and **authorizes no checkout update / sync / production
command**: no actual fetch/pull/reset/checkout/fast-forward, no proof rerun, no
production command execution, no DB connection, no `psql`/SQL, no `.env.production`
read/print, no raw DSN/password/token/host/port/IP output, no env mutation, no runner
DSN binding, no code/source-selection change, no password reset/rotation, no Step 2E
rerun, no Stage 0, no run-lock/runtime/downstream/Lane/scoring/AMS/customer action. No
real DSN, password, token, host, port, IP, or URI appears in this document.

> Provenance: PR #235 Step 2G Option C rerun repo-sync preflight not-ready evidence
> (`22d32a3a5776e221f6eb7d0ea344eabd6fe0216d`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_RERUN_REPO_SYNC_PREFLIGHT_NOT_READY_HEAD_NOT_CONTAINING_TARGETS`);
> PR #234 rerun repo-sync preflight plan
> (`9c65aa9ae16f4a6fa78bf170c4f58d8f265fa12b`); PR #233 Option C proof inconclusive
> evidence (`937f9db16cfd63faaf70380d7d2b309e396236a2`); PR #232 Option C proof
> command-pack plan (merged GitHub, `5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`).

---

## 1. Objective

Safely advance the operator checkout `HEAD` (at `/opt/buyerrecon-backend`, branch
`sprint2-architecture-contracts-d4cc2bf`) so it **contains the required merged PRs** —
PR #232 (`5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`), PR #233
(`937f9db16cfd63faaf70380d7d2b309e396236a2`), PR #234
(`9c65aa9ae16f4a6fa78bf170c4f58d8f265fa12b`), PR #235
(`22d32a3a5776e221f6eb7d0ea344eabd6fe0216d`) — by a **fast-forward-only** update, with
**no force/reset, no branch switch, no merge, no file edits**. This is a **Git
checkout-state operation only**; it proves/affects no source-category, credential, or
Stage 0 readiness.

---

## 2. Future Safe Command-Pack — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** checkout
> fast-forward — **not** executed here. It performs **at most one fast-forward-only**
> advance of the current branch to its already-fetched remote tip, gated by the §3
> preflight, and **does not** run the Option C proof in the same step.

### 2.1 Preflight gates (all must hold before any update)
- expected path `/opt/buyerrecon-backend`;
- expected branch `sprint2-architecture-contracts-d4cc2bf`;
- exactly **one** expected remote;
- **clean working tree**;
- target **remote branch known** (already fetched);
- target **remote `HEAD` contains PR #232/#233/#234/#235**;
- **no untracked safety-sensitive files** staged or touched (e.g. `.env*`, local report
  dumps, secret files).

### 2.2 Update strategy
- **prefer fast-forward-only** update (e.g. `git merge --ff-only` / `git pull --ff-only`
  semantics);
- **no force reset** (`--hard` / `git reset` forbidden);
- **no arbitrary checkout**;
- **no branch switch**;
- **no merge conflict resolution** (if not fast-forwardable → stop, do not merge);
- **no editing files**;
- **no staging/committing**;
- **no running tests/build/runtime after update** unless separately GO-gated.

---

## 3. Safe Labels (for the future checkout update, when separately planned/run)

```text
checkout_update_plan_status=planning_only
expected_path=/opt/buyerrecon-backend
expected_branch=sprint2-architecture-contracts-d4cc2bf
fast_forward_only_required=true
force_reset_allowed=false
branch_switch_allowed=false
proof_rerun_authorized=false
stage0_executed=false
```

> Plus the future run's own result/guard booleans (e.g.
> `checkout_fast_forward_attempted`, `expected_path_confirmed`,
> `expected_branch_confirmed`, `working_tree_clean`,
> `remote_target_contains_targets`, `fast_forward_possible`,
> `head_now_contains_targets`, `checkout_update_result=<allowlisted>`), all safe
> booleans/tokens — no raw values.

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- **wrong path**;
- **wrong branch**;
- **dirty working tree**;
- **unexpected remote count**;
- **target remote branch missing**;
- **remote target does not contain PR #232/#233/#234/#235**;
- **fast-forward not possible**;
- any need for **reset / force / merge conflict resolution**;
- any request to **rerun the Option C proof in the same step**;
- any **DB / psql / env / Stage 0 / runtime** action.

If a stop-line is hit, perform no update, withhold all secret/raw output, record the
blocked state in a docs-only evidence PR (safe labels only), and take no fix/retry
without separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No actual fetch/pull/reset/checkout/fast-forward.
- No proof rerun.
- No production command execution.
- No DB connection.
- No psql/SQL.
- No `.env.production` read/print.
- No raw DSN/password/token/host/port/IP output.
- No env mutation.
- No runner DSN binding.
- No code/source-selection change.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0.
- No run-lock / runtime / downstream / Lane / scoring / AMS / customer action.

---

## 6. Next-Step Mapping

- **If this plan merges** → the user may issue a **fresh explicit Helen GO** for
  **exactly one** checkout fast-forward / update attempt (fast-forward-only; §3/§4
  gates).
- **After the update attempt** → create a docs-only **evidence PR** (safe labels only;
  e.g. `head_now_contains_targets`, `checkout_update_result`).
- **Only after a later repo-state preflight returns `ready_for_fresh_go`** may Helen
  issue a fresh **Option C proof GO** (still safe-label-only, fail closed to
  `inconclusive`).

**No decision branch is executed by this PR.**

---

## 7. Non-Authorization

**Merging this plan authorizes:**
- **no** checkout update;
- **no** fast-forward;
- **no** proof rerun;
- **no** repo-state preflight rerun;
- **no** remediation;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The checkout fast-forward is a future, separately-reviewed, separately GO-gated step**
requiring a fresh explicit Helen GO. **Stage 0 execution remains separately GO-gated.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Fresh explicit Helen GO** for **one** checkout fast-forward / update attempt
   (fast-forward-only; §3 preflight gates; §4 stop-lines; safe labels only).
3. Docs-only **checkout-update evidence PR** (safe labels only).
4. **Re-run the repo-state preflight** (its own GO) → if `ready_for_fresh_go`, a
   separate fresh **Option C proof GO**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
for a **future** fast-forward-only Git checkout update; it **executes no
fetch/pull/reset/checkout/fast-forward**, reads/prints **no** `.env.production` value,
makes **no** DB connection, and defines **Git/checkout-state booleans, an expected path
and branch name, and public git commit hashes only**. (Per the PR #218 Codex note: "no
secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / path & branch names / public
git commit hashes — not secret or row values.
