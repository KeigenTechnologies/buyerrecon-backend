#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase B / PR D: record-only contract gate characterization guardrail.
//
// Status: SPRINT3_5_PHASE_B_PR_D_RECORD_ONLY_CONTRACT_GATE_CHARACTERIZATION
//
// Records (allowlists) the CURRENT worker / record-only entrypoints and the record-only contract
// surfaces, and FAILS CLOSED (exit 1) on drift: a new/removed worker or record-only entrypoint, a
// record-only entrypoint missing its expected static markers, a contract surface missing its
// markers, a worker module missing the fail-closed startup gate, or an unexpected coupling between
// record-only worker code and customer-output / Gate / Lane / scoring / AMS surfaces.
//
// This is a STATIC TEXT check. It scans tracked source/package/config via `git ls-files` +
// `git grep` only. It does NOT execute workers, run risk-evidence / classifiers, import
// application modules, open a DB/network connection, load env, read secrets, read private captures
// (run.err / run.safe.out), or change runtime behavior. Static SHAPE only — no runtime proof, no
// inference from sealed captures.
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:record-only-gate
//
// Design notes:
//   * "Required marker" checks use fixed-string (git grep -F) presence within a specific file.
//   * "Forbidden import" checks anchor on from/import(/require( + quote (POSIX ERE, no \b), so
//     doc-comments are not matched.
//   * No new npm dependencies. Node built-ins + git, mirroring the sibling checks.
//   * The checker lives under scripts/checks/ and is outside every scan scope below (the entrypoint
//     globs are depth-2 scripts/run-*.ts / scripts/*record-only*.ts; this file is depth-3 .mjs),
//     so it cannot self-match.

import { spawnSync } from "node:child_process";

// ---- Worker entrypoint scripts (scripts/run-*-worker.ts), by class ---------------------------
const WORKER_ENTRYPOINTS = {
  "scripts/run-stage0-worker.ts": "STAGE0_WORKER",
  "scripts/run-risk-evidence-worker.ts": "RISK_EVIDENCE_WORKER",
  "scripts/run-risk-evidence-record-only-worker.ts": "RISK_EVIDENCE_RECORD_ONLY_WRAPPER",
  "scripts/run-poi-core-worker.ts": "POI_CORE_WORKER",
  "scripts/run-poi-sequence-worker.ts": "POI_SEQUENCE_WORKER",
};
// The single RECORD_ONLY entrypoint wrapper and its required static markers.
const RECORD_ONLY_ENTRYPOINT = "scripts/run-risk-evidence-record-only-worker.ts";
const RECORD_ONLY_ENTRYPOINT_MARKERS = [
  "RISK_EVIDENCE_RECORD_ONLY",
  "RISK_EVIDENCE_CAPTURE_MODE",
  "failClosed",
  "worker_execution_authorized=false",
];

// ---- src worker modules that MUST call the fail-closed startup contract gate ------------------
const SRC_WORKER_MODULES = [
  "src/scoring/poi-core-worker/worker.ts",
  "src/scoring/poi-sequence-worker/worker.ts",
  "src/scoring/risk-evidence/worker.ts",
  "src/scoring/stage0/run-stage0-worker.ts",
];
const STARTUP_GATE_MARKER = "assertScoringContractsOrThrow";

// ---- Record-only contract surfaces + required markers ----------------------------------------
const CONTRACT_SURFACES = {
  "src/scoring/contracts.ts": ["record_only", "automated_action_enabled", "assertScoringContractsOrThrow"],
  "src/scoring/risk-evidence/record-only.ts": [
    "RISK_EVIDENCE_RECORD_ONLY_ENV",
    "record_only_mode_ambiguous_fails_closed",
  ],
  "scoring/version.yml": ["status: record_only", "automated_action_enabled: false"],
};

// ---- Coupling boundaries ---------------------------------------------------------------------
const SPECIFIER_PREFIX =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"']";
// risk-evidence record-only code must NOT import customer-output / Lane-write surfaces.
const RECORD_ONLY_FORBIDDEN_IMPORT =
  SPECIFIER_PREFIX + "[^\"']*(reports/external|lane-ab-preview|scoring_output_lane)";
const RECORD_ONLY_SCOPE = [":(glob)src/scoring/risk-evidence/**", RECORD_ONLY_ENTRYPOINT];
// customer-output / Lane surfaces must NOT import worker entrypoints.
const OUTPUT_SURFACE_FORBIDDEN_IMPORT =
  SPECIFIER_PREFIX + "[^\"']*(run-[a-z0-9-]*worker|risk-evidence/worker|/worker\\.(js|ts))";
const OUTPUT_SURFACE_SCOPE = [":(glob)src/reports/external/**", ":(glob)src/lane-ab-preview/**"];

const DEFERRED = [
  "Runtime enforcement proof — this check confirms the STATIC gate markers only; it does not and " +
    "cannot prove the record-only gate blocks writes at runtime (no worker/classifier execution here).",
  "Gate4E / Gate4F and AMS-runtime coupling — no code artifacts exist for these in-repo, so there " +
    "is no import edge to assert; their separation is procedural/governance, not statically representable.",
  "Sealed risk-worker runtime cause — out of scope; not read, not inferred " +
    "(runtime_dependency_or_build_failure / blocked / none_not_classified / likely_failure_surface=unknown preserved).",
];

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return [];
  throw new Error(`git ${args.join(" ")} failed (status=${res.status}): ${(res.stderr || "").trim()}`);
}
function fileHasFixed(file, marker) {
  const res = spawnSync("git", ["grep", "-nF", "--", marker, file], { encoding: "utf8" });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git grep -F failed on ${file} (status=${res.status}): ${(res.stderr || "").trim()}`);
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// ---- Rule 1: worker-entrypoint presence + drift ----------------------------------------------
const workerEntrypointsOnDisk = new Set(git(["ls-files", "--", ":(glob)scripts/run-*-worker.ts"]));
for (const p of Object.keys(WORKER_ENTRYPOINTS)) {
  if (workerEntrypointsOnDisk.has(p) === false) fail(`expected worker entrypoint missing: ${p}`);
}
for (const p of workerEntrypointsOnDisk) {
  if (Object.prototype.hasOwnProperty.call(WORKER_ENTRYPOINTS, p) === false) {
    fail(`new worker entrypoint outside allowlist: ${p}`);
  }
}

// ---- Rule 2: record-only entrypoint drift + required markers ---------------------------------
const recordOnlyEntrypointsOnDisk = new Set(git(["ls-files", "--", ":(glob)scripts/*record-only*.ts"]));
for (const p of recordOnlyEntrypointsOnDisk) {
  if (p !== RECORD_ONLY_ENTRYPOINT) fail(`new record-only entrypoint outside allowlist: ${p}`);
}
if (recordOnlyEntrypointsOnDisk.has(RECORD_ONLY_ENTRYPOINT) === false) {
  fail(`record-only entrypoint missing: ${RECORD_ONLY_ENTRYPOINT}`);
} else {
  for (const m of RECORD_ONLY_ENTRYPOINT_MARKERS) {
    if (fileHasFixed(RECORD_ONLY_ENTRYPOINT, m) === false) {
      fail(`record-only entrypoint lacks expected marker "${m}": ${RECORD_ONLY_ENTRYPOINT}`);
    }
  }
}

// ---- Rule 3: contract surfaces present + required markers ------------------------------------
const tracked = new Set(git(["ls-files", "--", "src", "scoring"]));
for (const [file, markers] of Object.entries(CONTRACT_SURFACES)) {
  if (tracked.has(file) === false) {
    fail(`contract surface missing: ${file}`);
    continue;
  }
  for (const m of markers) {
    if (fileHasFixed(file, m) === false) fail(`contract surface ${file} lacks marker "${m}"`);
  }
}

// ---- Rule 4: src worker modules call the fail-closed startup gate -----------------------------
for (const file of SRC_WORKER_MODULES) {
  if (tracked.has(file) === false) {
    fail(`expected src worker module missing: ${file}`);
  } else if (fileHasFixed(file, STARTUP_GATE_MARKER) === false) {
    fail(`worker module ${file} does not call ${STARTUP_GATE_MARKER} (fail-closed startup gate)`);
  }
}

// ---- Rule 5: record-only code must not import customer-output / Lane surfaces -----------------
for (const line of git(["grep", "-nE", RECORD_ONLY_FORBIDDEN_IMPORT, "--", ...RECORD_ONLY_SCOPE])) {
  fail(`record-only code imports customer-output/Lane surface: ${line}`);
}
// ---- Rule 6: customer-output / Lane surfaces must not import worker entrypoints ---------------
for (const line of git(["grep", "-nE", OUTPUT_SURFACE_FORBIDDEN_IMPORT, "--", ...OUTPUT_SURFACE_SCOPE])) {
  fail(`customer-output/Lane surface imports a worker entrypoint: ${line}`);
}

// ---- Characterization report -----------------------------------------------------------------
console.log("Worker entrypoints (allowed, by class):");
for (const [p, cls] of Object.entries(WORKER_ENTRYPOINTS)) console.log(`  ${cls.padEnd(34)} ${p}`);
console.log("");
console.log(`Record-only entrypoint: ${RECORD_ONLY_ENTRYPOINT}`);
console.log(`  required markers present: ${RECORD_ONLY_ENTRYPOINT_MARKERS.join(", ")}`);
console.log("");
console.log("Record-only contract surfaces (allowed, with required markers):");
for (const file of Object.keys(CONTRACT_SURFACES)) console.log(`  ${file}`);
console.log("");
console.log(`Src worker modules asserting the fail-closed gate (${STARTUP_GATE_MARKER}):`);
for (const file of SRC_WORKER_MODULES) console.log(`  ${file}`);
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
for (const d of DEFERRED) console.log(`  - ${d}`);
console.log("");

if (violations > 0) {
  console.error(`check:record-only-gate FAILED — ${violations} record-only/worker gate drift issue(s).`);
  process.exit(1);
}
console.log(
  "check:record-only-gate OK — worker/record-only entrypoints allowlisted; contract markers + fail-closed gate present; no record-only<->customer-output/Lane coupling.",
);
console.log(
  "Scope: static text scan (git ls-files + git grep) of tracked src/ + scripts/ + scoring/; no DB/network/runtime; no module execution; no capture read.",
);
