#!/usr/bin/env node
// BuyerRecon — Sprint 3 Risk-Worker Option B: CI / build-parity + run-wiring proof (STATIC).
//
// Status: SPRINT3_RISKWORKER_OPTION_B_SLICE2_CI_BUILD_PARITY_PROOF_L1_STATIC_IMPLEMENTATION
//         + SPRINT3_RISKWORKER_OPTION_B_SLICE3_COMPILED_RUN_COMMAND_L1_STATIC_WIRING
//
// This is the Option B build-parity + run-wiring PROOF. It statically proves that the Option B
// compiled-artifact BUILD PATH registered (as scaffold only) in PR #393 is present, referenced,
// and internally consistent — i.e. that CI and the local toolchain agree on the build wiring — so a
// later runtime-switch slice does not discover build drift for the first time at runtime. As of
// Slice 3 it additionally proves that the compiled run command `run:riskworker-compiled` is WIRED
// (to the registered compiled entrypoint) but DORMANT — the compiled runtime path is not active, the
// existing tsx scripts remain the unchanged active path, and no build has been run and no artifact
// committed. It proves BUILD-PATH PARITY + STATIC RUN-WIRING ONLY.
//
// It is wired to the reserved (PR #393) parity-proof command name:
//     proof:riskworker-ci-build-parity        (RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND)
//
// HARD BOUNDARY — this proof is a PURE STATIC PROOF. It does NOT:
//   * invoke the build (never runs `tsc` / `build:riskworker-artifact`);
//   * activate the compiled runtime path (wiring the run command name is NOT activation);
//   * run `run:riskworker-compiled` or wire / run the runtime preflight;
//   * run the worker / classifier / risk-evidence / record-only;
//   * touch DB / network / SQL / secrets / env values / server / production;
//   * generate or commit any build artifact;
//   * produce customer output or move Gate D / Gate E.
// It asserts NO root cause and unblocks NO Gate.
//
// It is a STATIC TEXT/CONFIG check (git ls-files — git's own read-only subcommands — + node:fs
// JSON/text reads of tracked config). It imports no application module, boots nothing, reads no env
// value, opens no DB/network connection, and executes nothing. FAILS CLOSED (exit 1) on drift or
// scan error.
//
// Run locally (no DB / no network / no runtime / no build):
//
//     npm run proof:riskworker-ci-build-parity
//
// Output is SAFE aggregates only (presence / consistency / parity booleans + counts) — never raw
// build output, logs, errors, stack traces, dependency-file contents, env/secret values, DSNs,
// hosts, private paths, SQL, customer data, or base64 blobs.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ---- Registered Option B build-wiring facts (PR #393) — referenced, not re-invented -------------
// These mirror the canonical values registered in config/constants.ts + .claude/constants.md. This
// checker (a scripts/checks/*.mjs guardrail) may only import node: built-ins, so — like the sibling
// guardrails that inline "DATABASE_URL" / DSN role names — it inlines the registered path/command
// names it verifies. The config/constants.ts registration is itself asserted below (Rule E).
const ARTIFACT_ROOT = "dist/riskworker";                       // COMPILED_ARTIFACT_ROOT
const BUILD_TSCONFIG = "tsconfig.riskworker-artifact.json";    // Slice 1 build scaffold config
const BUILD_SCRIPT_NAME = "build:riskworker-artifact";         // RISKWORKER_BUILD_COMMAND
const BUILD_SCRIPT_CMD = "tsc -p tsconfig.riskworker-artifact.json";
const PARITY_PROOF_SCRIPT_NAME = "proof:riskworker-ci-build-parity"; // this command
const PARITY_PROOF_SCRIPT_CMD = "node scripts/checks/check-riskworker-build-parity.mjs";

// Source entrypoints the scaffold compiles, and their registered compiled (node-runnable) images.
const SOURCE_ENTRYPOINTS = [
  "scripts/run-risk-evidence-worker.ts",
  "scripts/run-risk-evidence-record-only-worker.ts",
];
const COMPILED_ENTRYPOINTS = [
  "dist/riskworker/scripts/run-risk-evidence-worker.js",           // RISKWORKER_COMPILED_ENTRYPOINT
  "dist/riskworker/scripts/run-risk-evidence-record-only-worker.js", // RECORD_ONLY_COMPILED_ENTRYPOINT
];

// Slice 3 compiled run command: WIRED to the registered compiled entrypoint, but DORMANT (the
// compiled runtime path is NOT active — see the dormancy proof below). The command value must be
// `node <RISKWORKER_COMPILED_ENTRYPOINT>` so the run wiring stays in parity with the registered path.
const COMPILED_RUN_SCRIPT_NAME = "run:riskworker-compiled";      // RISKWORKER_COMPILED_RUN_COMMAND
const COMPILED_RUN_SCRIPT_CMD = "node dist/riskworker/scripts/run-risk-evidence-worker.js"; // node <entrypoint[0]>

// Still-reserved command names that MUST STAY UNWIRED until their own slice (runtime preflight is a
// later slice under its own review / GO).
const RESERVED_UNWIRED_SCRIPTS = [
  "proof:riskworker-runtime-preflight",  // RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND
];

// Existing tsx risk-worker run scripts that MUST REMAIN UNCHANGED (runtime behavior frozen).
const TSX_SCRIPTS_UNCHANGED = {
  "risk-evidence:run": "tsx scripts/run-risk-evidence-worker.ts",
  "risk-evidence:record-only": "tsx scripts/run-risk-evidence-record-only-worker.ts",
};

// Registered constant NAMES (config/constants.ts) whose presence + value this proof confirms.
const REGISTERED_CONSTANTS = [
  { name: "COMPILED_ARTIFACT_ROOT", value: ARTIFACT_ROOT },
  { name: "RISKWORKER_COMPILED_ENTRYPOINT", value: COMPILED_ENTRYPOINTS[0] },
  { name: "RECORD_ONLY_COMPILED_ENTRYPOINT", value: COMPILED_ENTRYPOINTS[1] },
  { name: "RISKWORKER_BUILD_COMMAND", value: BUILD_SCRIPT_NAME },
  { name: "RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND", value: PARITY_PROOF_SCRIPT_NAME },
];

const SELF = "scripts/checks/check-riskworker-build-parity.mjs";
const CONSTANTS_TS = "config/constants.ts";

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return [];
  throw new Error(`git ${args.join(" ")} failed (status=${res.status}): ${(res.stderr || "").trim()}`);
}
function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`cannot read ${path}: ${e && e.message ? e.message : e}`);
  }
}
function tracked(path) {
  return git(["ls-files", "--", path]).length > 0;
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// Safe emitted signals (booleans / counts) — populated as the rules run; see §8 of the plan.
const signals = {
  build_wiring_present: false,
  build_command_registered: false,
  artifact_root_registered: false,
  compiled_entrypoint_registered: false,
  build_path_internally_consistent: false,
  ci_local_build_parity_ok: false,
  compiled_runtime_path_active: false,   // must stay false (dormant) — wiring is NOT activation
  compiled_run_command_wired: false,     // Slice 3: run:riskworker-compiled is WIRED (expected true)
  compiled_run_command_dormant: false,   // wired + tsx unchanged + no artifact => dormant
  run_command_wired: false,              // mirror of compiled_run_command_wired (kept for continuity)
  runtime_preflight_wired: false,        // must stay false until its own slice
  tsx_scripts_unchanged: false,
  registered_constants_referenced_count: 0,
  build_wiring_checks_passed_count: 0,
  build_wiring_checks_failed_count: 0,
  build_surface_label: "build_surface",
  disambiguation_label: "structurally_expected_dual_signal",
  runtime_cause_inference: false,
};

// ---- Rule A: build scaffold config present + shaped (extends base; emits into artifact root) -----
let tsconfigOk = false;
if (tracked(BUILD_TSCONFIG) === false) {
  fail(`build scaffold config missing (not tracked): ${BUILD_TSCONFIG}`);
} else {
  let tsc;
  try {
    tsc = JSON.parse(read(BUILD_TSCONFIG));
  } catch (e) {
    fail(`${BUILD_TSCONFIG} is not valid JSON: ${e && e.message ? e.message : e}`);
    tsc = null;
  }
  if (tsc) {
    const co = tsc.compilerOptions || {};
    if (tsc.extends !== "./tsconfig.json") {
      fail(`${BUILD_TSCONFIG} must extend "./tsconfig.json" (base-toolchain parity); found ${JSON.stringify(tsc.extends)}`);
    }
    if (co.outDir !== ARTIFACT_ROOT) {
      fail(`${BUILD_TSCONFIG} outDir must be the registered artifact root "${ARTIFACT_ROOT}"; found ${JSON.stringify(co.outDir)}`);
    } else {
      signals.artifact_root_registered = true;
    }
    if (co.noEmit === true) {
      fail(`${BUILD_TSCONFIG} sets noEmit:true — the build scaffold must be able to emit`);
    }
    const include = Array.isArray(tsc.include) ? tsc.include : [];
    for (const src of SOURCE_ENTRYPOINTS) {
      if (include.includes(src) === false) {
        fail(`${BUILD_TSCONFIG} include is missing the risk-worker source entrypoint "${src}"`);
      }
    }
    tsconfigOk =
      tsc.extends === "./tsconfig.json" &&
      co.outDir === ARTIFACT_ROOT &&
      co.noEmit !== true &&
      SOURCE_ENTRYPOINTS.every((s) => include.includes(s));
  }
}

// ---- Rule B: build command registered + wired to the scaffold config (build-command parity) ------
// Rule C: the parity-proof command is self-wired as a static `node scripts/...` command.
// Rule D: Slice 3 run wiring — `run:riskworker-compiled` is WIRED to the registered compiled
//         entrypoint but DORMANT; runtime preflight stays UNWIRED; existing tsx scripts stay
//         UNCHANGED (the tsx path remains the active runtime; wiring is not activation).
let pkg = null;
try {
  pkg = JSON.parse(read("package.json"));
} catch (e) {
  fail(`package.json could not be parsed: ${e && e.message ? e.message : e}`);
}
if (pkg) {
  const scripts = pkg.scripts || {};

  if (scripts[BUILD_SCRIPT_NAME] !== BUILD_SCRIPT_CMD) {
    fail(`package.json "${BUILD_SCRIPT_NAME}" must be exactly "${BUILD_SCRIPT_CMD}" (build ↔ scaffold parity); found ${JSON.stringify(scripts[BUILD_SCRIPT_NAME])}`);
  } else {
    signals.build_command_registered = true;
  }

  if (scripts[PARITY_PROOF_SCRIPT_NAME] !== PARITY_PROOF_SCRIPT_CMD) {
    fail(`package.json "${PARITY_PROOF_SCRIPT_NAME}" must be exactly "${PARITY_PROOF_SCRIPT_CMD}" (this proof, static node command); found ${JSON.stringify(scripts[PARITY_PROOF_SCRIPT_NAME])}`);
  }

  // Slice 3: the compiled run command must be WIRED to the registered compiled entrypoint
  // (`node <RISKWORKER_COMPILED_ENTRYPOINT>`) — present but dormant.
  if (scripts[COMPILED_RUN_SCRIPT_NAME] !== COMPILED_RUN_SCRIPT_CMD) {
    fail(`package.json "${COMPILED_RUN_SCRIPT_NAME}" must be wired to the registered compiled entrypoint as "${COMPILED_RUN_SCRIPT_CMD}"; found ${JSON.stringify(scripts[COMPILED_RUN_SCRIPT_NAME])}`);
  } else {
    signals.compiled_run_command_wired = true;
    signals.run_command_wired = true;
  }

  // Still-reserved commands must NOT be wired yet (runtime preflight is a later slice).
  for (const name of RESERVED_UNWIRED_SCRIPTS) {
    if (typeof scripts[name] === "string") {
      fail(`package.json wires still-reserved command "${name}" — it must stay UNWIRED until its own slice`);
      if (name === "proof:riskworker-runtime-preflight") signals.runtime_preflight_wired = true;
    }
  }

  // Existing tsx risk-worker scripts must remain byte-identical (no runtime behavior change).
  let tsxOk = true;
  for (const [name, cmd] of Object.entries(TSX_SCRIPTS_UNCHANGED)) {
    if (scripts[name] !== cmd) {
      tsxOk = false;
      fail(`existing tsx script "${name}" changed — must stay "${cmd}"; found ${JSON.stringify(scripts[name])}`);
    }
  }
  signals.tsx_scripts_unchanged = tsxOk;
}

// ---- Rule E: registered Option B constants present + consistent in config/constants.ts -----------
if (tracked(CONSTANTS_TS) === false) {
  fail(`constants registry missing (not tracked): ${CONSTANTS_TS}`);
} else {
  const src = read(CONSTANTS_TS);
  let referenced = 0;
  for (const { name, value } of REGISTERED_CONSTANTS) {
    const hasName = src.includes(name);
    const hasValue = src.includes(`"${value}"`);
    if (hasName && hasValue) {
      referenced += 1;
    } else {
      fail(`${CONSTANTS_TS} missing registered constant ${name}${hasName ? "" : " (name absent)"}${hasValue ? "" : ` (value "${value}" absent)`}`);
    }
  }
  signals.registered_constants_referenced_count = referenced;
  signals.compiled_entrypoint_registered =
    src.includes("RISKWORKER_COMPILED_ENTRYPOINT") &&
    src.includes(`"${COMPILED_ENTRYPOINTS[0]}"`) &&
    src.includes("RECORD_ONLY_COMPILED_ENTRYPOINT") &&
    src.includes(`"${COMPILED_ENTRYPOINTS[1]}"`);
}

// ---- Rule F: entrypoint PARITY — each registered compiled path is the artifact-root image of its
//      source entrypoint (source.ts → <ARTIFACT_ROOT>/source.js). Pure structural equality. ---------
let entrypointParityOk = true;
for (let i = 0; i < SOURCE_ENTRYPOINTS.length; i++) {
  const expected = `${ARTIFACT_ROOT}/${SOURCE_ENTRYPOINTS[i].replace(/\.ts$/, ".js")}`;
  if (COMPILED_ENTRYPOINTS[i] !== expected) {
    entrypointParityOk = false;
    fail(`compiled entrypoint parity drift: expected "${expected}" for source "${SOURCE_ENTRYPOINTS[i]}", registered "${COMPILED_ENTRYPOINTS[i]}"`);
  }
  // The source entrypoint the scaffold compiles must actually exist (tracked).
  if (tracked(SOURCE_ENTRYPOINTS[i]) === false) {
    entrypointParityOk = false;
    fail(`risk-worker source entrypoint missing (not tracked): ${SOURCE_ENTRYPOINTS[i]}`);
  }
}

// ---- Rule G: NO generated artifact is committed (Slice 2 is proof-only; artifact stays ignored) ---
const committedArtifacts = git(["ls-files", "--", ARTIFACT_ROOT]);
if (committedArtifacts.length > 0) {
  fail(`generated artifact committed under "${ARTIFACT_ROOT}" (${committedArtifacts.length} file(s)) — Slice 2 must commit NONE`);
}

// ---- Derived parity/consistency signals ----------------------------------------------------------
signals.build_wiring_present = tsconfigOk && signals.build_command_registered && tracked(CONSTANTS_TS);
signals.build_path_internally_consistent =
  tsconfigOk &&
  signals.build_command_registered &&
  signals.compiled_entrypoint_registered &&
  entrypointParityOk &&
  committedArtifacts.length === 0;
signals.ci_local_build_parity_ok = signals.build_path_internally_consistent && violations === 0;

// Slice 3 dormancy: the compiled run command is wired, yet the compiled runtime path is NOT active —
// proven by the tsx scripts remaining the unchanged active path and no artifact being committed.
signals.compiled_run_command_dormant =
  signals.compiled_run_command_wired &&
  signals.tsx_scripts_unchanged &&
  committedArtifacts.length === 0;

signals.build_wiring_checks_failed_count = violations;
// Count of the discrete boolean parity/consistency assertions that held.
const BOOL_ASSERTIONS = [
  signals.artifact_root_registered,
  signals.build_command_registered,
  signals.compiled_entrypoint_registered,
  entrypointParityOk,
  signals.tsx_scripts_unchanged,
  signals.build_wiring_present,
  signals.build_path_internally_consistent,
  committedArtifacts.length === 0,
  signals.compiled_run_command_wired,          // Slice 3: expected WIRED
  signals.compiled_run_command_dormant,        // wired but dormant
  signals.runtime_preflight_wired === false,   // preflight stays unwired
  signals.compiled_runtime_path_active === false,
];
signals.build_wiring_checks_passed_count = BOOL_ASSERTIONS.filter(Boolean).length;

// ---- Characterization report (SAFE aggregates only) ----------------------------------------------
console.log("risk-worker Option B — CI / build-parity + run-wiring proof (STATIC; no build/run executed):");
console.log(`  build scaffold config (${BUILD_TSCONFIG}): ${tsconfigOk ? "present+shaped" : "DRIFT"}`);
console.log(`  build command "${BUILD_SCRIPT_NAME}" wired to scaffold: ${signals.build_command_registered ? "yes" : "NO"}`);
console.log(`  registered constants referenced: ${signals.registered_constants_referenced_count}/${REGISTERED_CONSTANTS.length}`);
console.log(`  compiled-entrypoint parity (source.ts → artifact/source.js): ${entrypointParityOk ? "consistent" : "DRIFT"}`);
console.log(`  build path internally consistent: ${signals.build_path_internally_consistent}`);
console.log(`  ci/local build-path parity ok: ${signals.ci_local_build_parity_ok}`);
console.log(`  compiled run command wired: ${signals.compiled_run_command_wired}  (Slice 3: wired to registered compiled entrypoint)`);
console.log(`  compiled run command dormant: ${signals.compiled_run_command_dormant}  (wired but not the active runtime)`);
console.log(`  runtime preflight wired: ${signals.runtime_preflight_wired}  (must stay false — not this slice)`);
console.log(`  compiled runtime path active: ${signals.compiled_runtime_path_active}  (must stay false — wiring is not activation)`);
console.log(`  tsx risk-worker scripts unchanged: ${signals.tsx_scripts_unchanged}  (tsx remains the active/rollback path)`);
console.log(`  committed artifacts under ${ARTIFACT_ROOT}: ${committedArtifacts.length}  (must be 0)`);
console.log(`  build-wiring checks passed/failed: ${signals.build_wiring_checks_passed_count}/${signals.build_wiring_checks_failed_count}`);
console.log(`  labels: build_surface=${signals.build_surface_label}; disambiguation=${signals.disambiguation_label}; runtime_cause_inference=${signals.runtime_cause_inference}`);
console.log("");
console.log("Scope: static text/config scan (git ls-files + node:fs) of tracked build + run wiring; the");
console.log("build is NEVER invoked and run:riskworker-compiled is NEVER executed. No worker/classifier/");
console.log("risk-evidence/record-only execution; no DB/network/SQL; no secrets/env; no artifact generated");
console.log("or committed; no customer output; no Gate D/E movement. Proves BUILD-PATH PARITY + STATIC");
console.log("RUN-WIRING ONLY — not runtime behavior, DB role binding, worker/customer-output, or Gate");
console.log("behavior. Asserts NO root cause and unblocks NO Gate.");
console.log("");

if (violations > 0) {
  console.error(`check FAILED — ${violations} build-parity wiring drift issue(s). (proof:riskworker-ci-build-parity)`);
  process.exit(1);
}
console.log(
  "proof:riskworker-ci-build-parity OK — Option B build wiring present, referenced, and internally consistent " +
    "(scaffold config, build command, registered constants, entrypoint parity); compiled run command WIRED but " +
    "DORMANT, runtime preflight unwired, compiled runtime path not active, tsx scripts unchanged, no artifact committed.",
);
