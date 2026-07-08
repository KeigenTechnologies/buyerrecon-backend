# Sprint 3 — Risk-Worker Option B Slice 3 (Compiled Run Command) — L1/static Wiring Implementation Note

> **L1 / static implementation note.** Records the outcome of the Slice 3 **package-script wiring**
> planned in PR #396 (Slice 3 planning). This slice **wires the reserved compiled run command name
> only** — it does **not** execute it. Safe labels only — **no** raw logs, raw build/worker output,
> exact errors, stack traces, dependency-file contents, env values, SQL results, customer data,
> secrets, DSNs, hosts, private paths, or base64 blobs.
>
> **Authorizes nothing further.** This is **pure wiring**: adding the `run:riskworker-compiled` script
> text (and updating the static proof to attest it is wired-but-dormant). It does **not** execute the
> build, does **not** execute `run:riskworker-compiled`, does **not** activate the compiled runtime
> path, does **not** wire runtime preflight, runs **no** worker/classifier/risk-evidence/record-only,
> touches **no** server/runtime/DB/network/SQL/secret/production, generates/commits **no** artifact,
> produces **no** customer output, and moves **no** Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE3_COMPILED_RUN_COMMAND_L1_STATIC_WIRING`

**Layer:** L1 (static). Per PR #396 §11, **pure package-script wiring that executes nothing and leaves
every existing command running exactly as before is L1/static** — no exact GO required. Executing the
build, activating/running the compiled path, touching server/runtime, or changing worker behavior would
be **L3** (separate planning + exact GO); **none** of that happens here.

---

## 1. What this slice does

Wires the reserved compiled run command registered in PR #393:

```
run:riskworker-compiled = node dist/riskworker/scripts/run-risk-evidence-worker.js
```

- `run:riskworker-compiled` is the reserved name `RISKWORKER_COMPILED_RUN_COMMAND`.
- Its target `dist/riskworker/scripts/run-risk-evidence-worker.js` is the already-registered
  `RISKWORKER_COMPILED_ENTRYPOINT` (PR #393). **No new constant/literal is introduced**, so no registry
  edit is required.

The command is **wired but dormant**: it is a script definition only. It is **not executed**, it is
**not** the default/authorized runtime, and the existing `tsx` scripts remain the active path (and the
rollback path). Adding a script definition does not change how any *existing* command runs.

---

## 2. Changed files (exactly 3)

| File | Change | Notes |
|---|---|---|
| `package.json` | modified | Adds exactly one script: `run:riskworker-compiled` → `node dist/riskworker/scripts/run-risk-evidence-worker.js`. No existing script modified or removed. No dependency/lockfile change. |
| `scripts/checks/check-riskworker-build-parity.mjs` | modified | Updates the static proof: `run:riskworker-compiled` is now asserted **WIRED** to the registered compiled entrypoint but **DORMANT** (tsx unchanged + no artifact ⇒ dormant); `proof:riskworker-runtime-preflight` still asserted **UNWIRED**; compiled runtime path still asserted **not active**. |
| `docs/ops/sprint3-riskworker-option-b-slice3-compiled-run-command-l1-static-wiring-impl-note.md` | added | This note. |

**No workflow change** (no new bundle script added — the existing `proof:riskworker-ci-build-parity`
bundle member simply now attests the run wiring). **No `.claude/constants.md` / `config/constants.ts`
edit** (references already-registered names). **No dependency/lockfile change. No new checker file.**

---

## 3. Static proof of "wired but dormant"

`proof:riskworker-ci-build-parity` (the existing bundle guardrail) now statically attests:

- `compiled_run_command_wired: true` — `run:riskworker-compiled` equals `node <compiled entrypoint>`.
- `compiled_run_command_dormant: true` — derived from: compiled run command wired **and** tsx scripts
  unchanged **and** zero committed artifacts.
- `compiled_runtime_path_active: false` — wiring the command name is **not** activation.
- `runtime_preflight_wired: false` — the runtime preflight command stays unwired.
- `tsx_scripts_unchanged: true` — `risk-evidence:run` and `risk-evidence:record-only` remain
  byte-identical; the tsx path remains the active/rollback runtime.
- Build wiring unchanged: `build_command_registered: true`; `build_path_internally_consistent: true`;
  `registered_constants_referenced_count: 5/5`; committed artifacts = 0.

The proof **fails closed** on any drift and **never** invokes the build or runs `run:riskworker-compiled`.

---

## 4. Required confirmations

- `risk-evidence:run` remains **unchanged** (`tsx scripts/run-risk-evidence-worker.ts`).
- `risk-evidence:record-only` remains **unchanged** (`tsx scripts/run-risk-evidence-record-only-worker.ts`).
- `build:riskworker-artifact` remains **unchanged and unexecuted**.
- `run:riskworker-compiled` is **added but not executed**.
- Compiled runtime path remains **dormant** (not active, not default, not authorized).
- **No generated artifact committed** (`dist/riskworker/` stays gitignored; 0 tracked).
- `proof:riskworker-ci-build-parity` remains **green**.
- `static-guardrails` remains **green**.
- **Gate D/E remain blocked** where dependent.

---

## 5. Validation (this PR)

Static bundle + parity/run-wiring proof (all green), all L1/static, no build/run/worker/DB/network/secret:

- `git diff --check`
- `npm run check:constants`
- `npm run check:static-boundaries`
- `npm run check:pg-pool-construction`
- `npm run check:observer-shape`
- `npm run check:record-only-gate`
- `npm run check:customer-output-boundary`
- `npm run check:db-pool-factory-scaffold`
- `npm run check:no-runtime-imports`
- `npm run proof:riskworker-ci-build-parity`

**Not run** (out of scope, would be L3): `npm run build:riskworker-artifact`,
`npm run run:riskworker-compiled`, and any worker/classifier/risk-evidence/record-only command.

---

## 6. Boundaries preserved

- Runtime behavior **unchanged**: compiled runtime path **not active**; `run:riskworker-compiled` added
  but **not executed**; runtime preflight **not wired**; build **not run**; **no** artifact
  generated/committed; existing tsx risk-worker scripts unchanged.
- **No** worker/classifier/risk-evidence/record-only execution; **no** SQL/psql; **no** DB/network; **no**
  production access; **no** server/runtime touch; **no** secret/env read; **no** deploy; **no** customer
  output; **no** Gate D/E movement; **no** refactor; **no** Phase C migration; **no** dependency/lockfile
  change.
- Sealed state preserved (unchanged): `runtime_dependency_or_build_failure`;
  `blocked_none_not_classified`; `build_surface` / `unknown_build_surface` /
  `structurally_expected_dual_signal`; `runtime_cause_inference=false`. **Unblocks no Gate.**
- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.

---

## 7. Rollback

Revert this PR: remove the `run:riskworker-compiled` script and revert the checker change. Because the
wiring switches no runtime and commits no artifact, rollback carries no runtime-behavior risk; the tsx
scripts remain the active path throughout.

---

_End of implementation note. L1/static wiring only. The compiled run command is wired but dormant;
authorizes no build execution, no compiled-run execution, no runtime activation, no runtime/server
touch, no worker/risk-evidence/record-only execution, no customer output, no Gate D/E movement, and no
root-cause inference. Any build execution, compiled-run activation, server/runtime touch, or
worker-behavior change is L3 and requires separate planning plus exact GO. Sealed state preserved._
