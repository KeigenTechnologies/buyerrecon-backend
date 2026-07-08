# Sprint 3 — Risk-Worker Option B Slice 2 (CI / Build Parity Proof) — Implementation Note

> **L1 / static implementation note.** Records the outcome of the Slice 2 CI / build-parity proof
> wiring planned in PR #394. Safe labels only (presence / consistency / parity booleans + counts) —
> **no** raw logs, raw build output, exact errors, stack traces, dependency-file contents, env values,
> SQL results, customer data, secrets, DSNs, hosts, private paths, or base64 blobs.
>
> **Authorizes nothing further.** This slice adds a **static** proof and its CI wiring only. It does
> **not** activate the compiled runtime path, does **not** wire/run `run:riskworker-compiled`, does
> **not** wire runtime preflight, runs **no** build, generates/commits **no** artifact, executes **no**
> worker/classifier/risk-evidence/record-only, touches **no** DB/network/SQL/secret/server/production,
> produces **no** customer output, and moves **no** Gate D/E. The build is **never invoked** by the
> proof.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE2_CI_BUILD_PARITY_PROOF_L1_STATIC_IMPLEMENTATION`

**Layer:** L1 (static). No exact GO required (per PR #394 §18 — static/CI-only, touches no
server/runtime/secret).

---

## 1. What this slice does

Implements the **preferred static shape** from PR #394 §6: a static `check:*`-family guardrail that
verifies the Option B compiled-artifact **build path** (registered as scaffold-only in PR #393) is
**present, referenced, and internally consistent** — i.e. that CI and the local toolchain agree on the
build wiring — **without invoking the build**. It is wired into the existing static-guardrail bundle so
CI proves it on every PR.

The proof proves **build-path parity only**. It proves **no** runtime behavior, **no** DB role binding,
**no** worker/classifier/risk-evidence behavior, **no** customer-output behavior, and **no** Gate
behavior. It asserts **no** root cause and unblocks **no** Gate.

---

## 2. Changed files (exactly)

| File | Change | Notes |
|---|---|---|
| `scripts/checks/check-riskworker-build-parity.mjs` | added | Static proof (git `ls-files` + `node:fs` reads). Never invokes the build. |
| `package.json` | modified | Adds `proof:riskworker-ci-build-parity` → `node scripts/checks/check-riskworker-build-parity.mjs`. No other script changed; no dependency/lockfile change. |
| `scripts/checks/check-no-runtime-imports.mjs` | modified | Adds `proof:riskworker-ci-build-parity` to the enforced `BUNDLE_SCRIPTS` (the guardrail bundle grows from 8 → 9). |
| `.github/workflows/static-guardrails.yml` | modified | Adds one `run: npm run proof:riskworker-ci-build-parity` step, identical in shape to the existing guardrail steps. No new services, secrets, databases, env, or runtime commands. |
| `docs/ops/sprint3-riskworker-option-b-slice2-ci-build-parity-proof-impl-note.md` | added | This note. |

No `.claude/constants.md` / `config/constants.ts` edit was needed: the proof **references** the
already-registered Option B names from PR #393 (see §4) and introduces **no** new constant-like
literal. No new dependency, no lockfile change, no runtime source change.

---

## 3. Command wired (already-registered reserved name)

The proof is wired to the reserved command name registered in PR #393:

```
proof:riskworker-ci-build-parity   (RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND)
```

The two other reserved names remain **UNWIRED** (Slice 2 must not wire them, and the proof asserts they
stay unwired):

```
run:riskworker-compiled              (RISKWORKER_COMPILED_RUN_COMMAND)          — compiled runtime path: NOT activated
proof:riskworker-runtime-preflight   (RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND) — runtime preflight: NOT wired
```

---

## 4. What the proof statically asserts

- **Rule A** — the build scaffold config `tsconfig.riskworker-artifact.json` is present, `extends`
  `./tsconfig.json` (base-toolchain parity), emits into the registered artifact root, does not set
  `noEmit:true`, and `include`s the two risk-worker source entrypoints.
- **Rule B** — `build:riskworker-artifact` is wired exactly to `tsc -p tsconfig.riskworker-artifact.json`
  (build ↔ scaffold parity).
- **Rule C** — the parity-proof command is self-wired as a static `node scripts/...` command.
- **Rule D** — reserved `run:riskworker-compiled` / `proof:riskworker-runtime-preflight` stay UNWIRED;
  existing tsx scripts `risk-evidence:run` / `risk-evidence:record-only` remain byte-identical.
- **Rule E** — the registered Option B constants are present + consistent in `config/constants.ts`.
- **Rule F** — entrypoint parity: each registered compiled path is the artifact-root image of its
  source entrypoint (`source.ts` → `<artifact-root>/source.js`), and each source entrypoint is tracked.
- **Rule G** — no generated artifact is committed under the artifact root (proof-only slice).

The proof **fails closed** (exit 1) on any drift or scan error.

---

## 5. Safe signals emitted (illustrative shape — booleans/counts only)

```yaml
build_wiring_present: true
build_command_registered: true
artifact_root_registered: true
compiled_entrypoint_registered: true
build_path_internally_consistent: true
ci_local_build_parity_ok: true
compiled_runtime_path_active: false   # stays false in Slice 2
run_command_wired: false              # stays false in Slice 2
tsx_scripts_unchanged: true
registered_constants_referenced_count: 5
build_wiring_checks_passed_count: <int>
build_wiring_checks_failed_count: 0
build_surface_label: build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

These are derived-safe aggregates. No raw content is emitted (see the forbidden-outputs list in
PR #394 §9).

---

## 6. Validation (this PR)

Static bundle (all green) plus the new proof, all L1/static, no build/runtime/DB/network/secret:

- `git diff --check`
- `npm run check:constants`
- `npm run check:static-boundaries`
- `npm run check:pg-pool-construction`
- `npm run check:observer-shape`
- `npm run check:record-only-gate`
- `npm run check:customer-output-boundary`
- `npm run check:db-pool-factory-scaffold`
- `npm run check:no-runtime-imports`
- `npm run proof:riskworker-ci-build-parity`  (static-only; executes no build/worker/DB/network)

CI: `static-guardrails` (GitHub Actions) now runs the proof as an additional bundle step (no new
services/secrets/databases/runtime commands added to the workflow).

---

## 7. Boundaries preserved

- Runtime behavior **unchanged**: compiled runtime path **not active**; `run:riskworker-compiled` and
  runtime preflight **not wired**; existing tsx risk-worker scripts unchanged; build **not run**; **no**
  artifact generated or committed.
- **No** worker/classifier/risk-evidence/record-only execution; **no** SQL/psql; **no** DB/network; **no**
  production access; **no** secret/env read; **no** deploy; **no** customer output; **no** Gate D/E
  movement; **no** refactor; **no** Phase C migration; **no** dependency/lockfile change.
- Sealed state preserved (unchanged): `runtime_dependency_or_build_failure`;
  `blocked_none_not_classified`; `build_surface` / `unknown_build_surface` /
  `structurally_expected_dual_signal`; `runtime_cause_inference=false`. **Unblocks no Gate.**
- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation. This slice does not unblock them.

---

_End of implementation note. L1/static. Proves build-path parity only; authorizes no implementation
beyond this proof + its CI wiring, no build execution, no artifact generation, no runtime/server touch,
no worker/risk-evidence/record-only execution, no customer output, no Gate D/E movement, and no
root-cause inference. Sealed state preserved._
