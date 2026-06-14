# Sprint 3 — Stage 0 auth/credential Step 2G Option C — Rerun Repo-Sync / Preflight Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_RERUN_REPO_SYNC_PREFLIGHT_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **safe repo-sync /
preflight path** to bring the operator checkout to a state that **contains PR #232 and
PR #233** before any future Option C proof rerun — after the first Option C proof failed
closed (`option_c_result=inconclusive`, `stop_line=approved_pr232_merge_not_present`)
because the local `/opt/buyerrecon-backend` checkout did not contain/recognize the
approved PR #232 merge commit (a **local-checkout sync gap**; PR #232 is `MERGED` on
GitHub).

This PR **executes nothing** and **authorizes no sync / rerun / production command**:
no sync/fetch/pull/reset/checkout execution, no proof rerun, no production command
beyond planning text, no DB connection, no `psql`/SQL, no `.env.production` value
read/print, no raw DSN/password/token/host/port/IP output, no env mutation, no runner
DSN binding, no code/source-selection change, no password reset/rotation, no Step 2E
rerun, no Stage 0, no run-lock touch, no runtime/downstream/Lane/scoring/AMS/customer
action. No real DSN, password, token, host, port, IP, or URI appears in this document.

> Provenance: PR #233 Step 2G Option C proof inconclusive evidence
> (`937f9db16cfd63faaf70380d7d2b309e396236a2`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_OPTIONC_PROOF_EXECUTED_INCONCLUSIVE_PR232_MERGE_NOT_PRESENT`);
> PR #232 Option C proof command-pack plan (merged GitHub,
> `5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`); PR #231 Option C category proof plan
> (`6f4d103462c9dc1d59b7f124c8e16aef789fff66`); PR #230 remediation options
> (`b6d72b3ca033c62687cde1d8415a66e8d0440817`); PR #229 reconciliation
> (`2a1b1fd12e893db2b7ac8d83d92ed47812108d11`).

---

## 1. Preflight Objective

- Ensure the **local operator checkout contains the approved base commits** — in
  particular the **PR #232** (`5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`) and **PR #233**
  (`937f9db16cfd63faaf70380d7d2b309e396236a2`) merges — before any future Option C proof
  rerun.
- Prove **only Git / repo state** (which commits are known locally; what HEAD contains;
  working-tree cleanliness). It does **not** prove source-category, credential validity,
  PostgreSQL authentication, or Stage 0 readiness.
- This converts the prior `approved_pr232_merge_not_present` local-sync gap into a
  **checked precondition** so a future Option C rerun does not fail closed on sync again.

---

## 2. Safe Repo-State Labels (for the future preflight, when separately planned/run)

```text
repo_sync_preflight_attempted=true
target_base_sha=937f9db16cfd63faaf70380d7d2b309e396236a2
pr232_merge_known_locally=true|false
pr233_merge_known_locally=true|false
head_contains_pr232=true|false
head_contains_pr233=true|false
working_tree_clean=true|false
proof_rerun_authorized=false
stage0_executed=false
repo_sync_preflight_result=ready_for_fresh_go|not_ready|inconclusive
```

> `target_base_sha=937f9db16cfd63faaf70380d7d2b309e396236a2` is the PR #233 merge
> commit (current base head); `pr232` = `5de683a5caeca3b4f90bee7c8353461ba7b0ad8c`. These
> are **public git commit hashes**, not secrets.

---

## 3. Safe Command-Pack Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** preflight —
> **not** executed here. It inspects **Git / repo state only**, emits the §2 labels, and
> **does not** run the Option C proof in the same step.

1. **Check current branch** (confirm the operator is on the intended base/work branch;
   booleans only — no secret content).
2. **Check remotes** (confirm the expected `origin` is configured; name/URL-presence
   only — no credentials printed).
3. **Fetch metadata** — **only if separately GO-authorized** (a metadata `git fetch`
   to learn the approved commits); this plan does **not** authorize the fetch.
4. **Verify target commits are known locally** — `pr232_merge_known_locally`,
   `pr233_merge_known_locally` (e.g. `git cat-file -e <sha>` / `git rev-parse --verify`
   style existence checks — boolean results only).
5. **Verify HEAD contains PR #232 and PR #233** — `head_contains_pr232`,
   `head_contains_pr233` (e.g. `git merge-base --is-ancestor <sha> HEAD` style — boolean
   results only).
6. **Verify working-tree status** — `working_tree_clean` (e.g. `git status --porcelain`
   emptiness — boolean only; do **not** print file contents).
7. **Emit `repo_sync_preflight_result`** per §6 mapping. **Do not run the Option C proof
   in the same step** unless a **fresh explicit Helen GO** says so.

**No actual sync/fetch/pull/reset/checkout is performed by this PR**, and the future
preflight performs **at most** a metadata `git fetch` and only **if separately
GO-authorized**.

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- the **working tree is dirty** (uncommitted/untracked changes that could be disturbed);
- the operator is on the **wrong branch**;
- **target commits are still unknown locally** after the (GO-authorized) metadata fetch;
- **PR #232 or PR #233 is not contained in HEAD**;
- any **untracked safety-sensitive files** are present that could be accidentally staged
  (e.g. local report dumps, `.env*`, secret files);
- any request to **run the Option C proof without a fresh Helen GO**;
- any secret/raw value (DSN/password/token/host/port/IP/URI) would be printed;
- any `.env.production` value read/print, env mutation, DB connection, psql/SQL, Stage 0,
  run-lock, or runtime/downstream action would occur.

If a stop-line is hit, withhold all secret/raw output, record the blocked/`not_ready`
state in a docs-only evidence PR (safe labels only), and take no fix/retry without
separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No sync/fetch/pull/reset/checkout execution.
- No proof rerun.
- No production command beyond planning text.
- No DB connection.
- No psql/SQL.
- No `.env.production` value read/print.
- No raw DSN/password/token/host/port/IP output.
- No env mutation.
- No runner DSN binding.
- No code/source-selection change.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0 execution.
- No run-lock touch.
- No runtime/downstream/Lane/scoring/AMS/customer action.

---

## 6. Next-Step Mapping

From the future `repo_sync_preflight_result`:
- **`ready_for_fresh_go`** (working tree clean, correct branch, PR #232 + PR #233
  contained in HEAD) → the user **may issue a fresh explicit Helen GO** for the Option C
  proof rerun (still safe-label-only, fail closed to `inconclusive`).
- **`not_ready`** (a stop-line condition such as missing commits or dirty tree) → create
  a docs-only **evidence PR** and **resolve the repo-state issue** before any rerun (no
  proof run).
- **`inconclusive`** → **refine the preflight plan**; no rerun.

**No decision branch is executed by this PR.**

---

## 7. Non-Authorization

**Merging this plan authorizes:**
- **no** repo sync (no fetch/pull/reset/checkout);
- **no** proof rerun;
- **no** Option C execution;
- **no** remediation;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The repo-sync preflight is a future, separately-reviewed, separately GO-gated step**
(and the metadata fetch within it is itself GO-gated). The Option C proof rerun likewise
requires its **own fresh explicit Helen GO**. **Stage 0 execution remains separately
GO-gated.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this preflight planning PR.
2. **Fresh explicit Helen GO** for **one** repo-sync preflight run (Git/repo-state checks
   only; metadata fetch only if that GO authorizes it; §2 labels only).
3. Docs-only **preflight evidence PR** (safe labels only).
4. **Per §6 mapping** → if `ready_for_fresh_go`, a separate fresh GO for the Option C
   proof rerun; if `not_ready`/`inconclusive`, resolve/refine first.
5. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL,
raw psql output, raw PostgreSQL error text, or customer data. This is a docs-only plan
for a **future** Git/repo-state preflight; it **executes no sync/fetch/proof**,
reads/prints **no** `.env.production` value, makes **no** DB connection, and defines
**Git/repo-state booleans, a target base SHA, and public git commit hashes only**. (Per
the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / public
git commit hashes / branch / repo-state references — not secret or row values.
