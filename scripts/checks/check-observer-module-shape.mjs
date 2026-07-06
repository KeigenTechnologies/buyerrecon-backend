#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase B / PR C: observer module shape characterization guardrail.
//
// Status: SPRINT3_5_PHASE_B_PR_C_OBSERVER_MODULE_SHAPE_CHARACTERIZATION
//
// Records (allowlists) the CURRENT observer-module family and its structural shape / boundaries,
// and FAILS CLOSED (exit 1) on drift: a missing observer, a new observer-like module outside the
// allowlist, a missing shape file, or a forbidden import / customer-output marker in an observer.
//
// This is a STATIC TEXT check. It scans tracked source via `git ls-files` + `git grep` only. It
// does NOT execute observer modules, import application modules, open a DB/network connection, run
// a worker/classifier, load env, read secrets, or generate customer output. It does NOT refactor,
// deduplicate, or extract shared helpers (characterize-only; Phase D would refactor, separately).
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:observer-shape
//
// Design notes:
//   * Two DISTINCT families are characterized (categorized carefully to avoid overclaiming):
//       1. OBSERVER MODULES  — src/scoring/*-observer/ (the near-identical family from PR #360).
//          Enforced strictly: shape presence + no worker/persistence/customer-output imports +
//          no write-SQL / external-report markers.
//       2. REPORT SCRIPTS    — scripts/*-report.ts (observation/preview/collector CLI drivers).
//          These are NOT observer modules; they legitimately construct read pools (see PR B) and
//          may import internal preview modules (e.g. lane-ab-preview). Enforced narrowly: they
//          must not import the external customer-output generator (src/reports/external).
//   * git grep uses POSIX ERE (no `\b`). Import matches anchor on `from`/`import(`/`require(` +
//     quote, so doc-comments are not matched.
//   * No new npm dependencies. Node built-ins + git, mirroring the sibling checks.
//   * The checker file lives under scripts/checks/ and is outside every scan scope below, so it
//     cannot self-match.

import { spawnSync } from "node:child_process";

// ---- Family 1: OBSERVER MODULES (src/scoring/<name>-observer) --------------------------------
// Each entry is the observer directory name + a class label. All share the invariant shape files.
const OBSERVER_MODULES = {
  "poi-core-observer": "POI_CORE",
  "poi-sequence-observer": "POI_SEQUENCE",
  "poi-sequence-table-observer": "POI_SEQUENCE_TABLE",
  "poi-table-observer": "POI_TABLE",
  "product-context-timing-observer": "PRODUCT_CONTEXT_TIMING",
  "product-features-bridge-candidate-observer": "PRODUCT_FEATURES_BRIDGE_CANDIDATE",
  "risk-core-bridge-observer": "RISK_CORE_BRIDGE",
  "timing-product-context-observer": "TIMING_PRODUCT_CONTEXT",
};
// Invariant structural markers present in every observer module today.
const REQUIRED_SHAPE_FILES = ["index.ts", "report.ts", "runner.ts", "types.ts"];

// ---- Family 2: REPORT SCRIPTS (scripts/<name>-report.ts) -------------------------------------
// Categorized; these are CLI drivers, NOT observer modules.
const REPORT_SCRIPTS = {
  "scripts/poi-core-input-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/poi-sequence-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/poi-sequence-table-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/poi-table-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/product-context-timing-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/product-features-bridge-candidate-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/risk-core-bridge-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/timing-product-context-observation-report.ts": "OBSERVATION_REPORT",
  "scripts/lane-ab-preview-report.ts": "PREVIEW_REPORT",
  "scripts/evidence-review-snapshot-report.ts": "EVIDENCE_REVIEW_SNAPSHOT",
  "scripts/collector-observation-report.ts": "COLLECTOR_OBSERVATION",
};

// ---- Forbidden edges (POSIX ERE; no \b) ------------------------------------------------------
const SPECIFIER_PREFIX =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"']";
// Observer modules must not import worker execution, persistence, or customer-output surfaces.
const OBSERVER_FORBIDDEN_IMPORT =
  SPECIFIER_PREFIX +
  "[^\"']*(run-[a-z0-9-]*worker|/worker\\.(js|ts)|worker\\.js|/persistence|reports/external|lane-ab-preview)";
// Observer modules must not contain write-SQL or external customer-report generation markers.
const OBSERVER_FORBIDDEN_MARKER =
  "INSERT INTO|UPSERT|DELETE FROM|UPDATE[[:space:]]+[a-z_]+[[:space:]]+SET|renderReportMarkdown|buildReportSnapshot|EXTERNAL_REPORT";
// Report scripts must not import the EXTERNAL customer-output generator (internal preview is fine).
const REPORT_FORBIDDEN_IMPORT = SPECIFIER_PREFIX + "[^\"']*(reports/external)";

const DEFERRED = [
  "product-context-timing-observer vs timing-product-context-observer — near-mirror names " +
    "(audit open-Q #2). Both allowlisted as distinct; the naming/ownership question is not resolved here.",
  "Observer dedup / template extraction — a Phase D refactor, out of scope for this characterize-only PR.",
  "Deep semantic equivalence of observer mappers/queries — not statically representable; only " +
    "structural shape + import/output boundaries are characterized here.",
];

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return []; // git grep / ls-files: no match
  throw new Error(`git ${args.join(" ")} failed (status=${res.status}): ${(res.stderr || "").trim()}`);
}
function pathOf(line) {
  return line.split(":", 1)[0];
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// ---- Rule 1: observer-module presence + drift ------------------------------------------------
const observerDirsOnDisk = new Set(
  git(["ls-files", "--", ":(glob)src/scoring/*-observer/**"]).map((f) =>
    f.replace(/^(src\/scoring\/[^/]*-observer)\/.*$/, "$1"),
  ),
);
// Missing (disappeared) observers
for (const name of Object.keys(OBSERVER_MODULES)) {
  if (observerDirsOnDisk.has(`src/scoring/${name}`) === false) {
    fail(`expected observer module missing: src/scoring/${name}`);
  }
}
// New observer-like modules outside the allowlist
for (const dir of observerDirsOnDisk) {
  const name = dir.replace(/^src\/scoring\//, "");
  if (Object.prototype.hasOwnProperty.call(OBSERVER_MODULES, name) === false) {
    fail(`new observer-like module outside allowlist: ${dir}`);
  }
}

// ---- Rule 2: observer shape files present ----------------------------------------------------
for (const name of Object.keys(OBSERVER_MODULES)) {
  const present = new Set(git(["ls-files", "--", `:(glob)src/scoring/${name}/*`]));
  for (const f of REQUIRED_SHAPE_FILES) {
    if (present.has(`src/scoring/${name}/${f}`) === false) {
      fail(`observer ${name} missing required shape file: ${f}`);
    }
  }
}

// ---- Rule 3: observer forbidden imports + markers --------------------------------------------
const OBSERVER_SCOPE = [":(glob)src/scoring/*-observer/**"];
for (const line of git(["grep", "-nE", OBSERVER_FORBIDDEN_IMPORT, "--", ...OBSERVER_SCOPE])) {
  fail(`observer forbidden import (worker/persistence/customer-output): ${line}`);
}
for (const line of git(["grep", "-nE", OBSERVER_FORBIDDEN_MARKER, "--", ...OBSERVER_SCOPE])) {
  fail(`observer forbidden marker (write-SQL / external-report): ${line}`);
}

// ---- Rule 4: report-script presence + drift + forbidden external-output import ----------------
const reportScriptsOnDisk = new Set(git(["ls-files", "--", ":(glob)scripts/*-report.ts"]));
for (const p of Object.keys(REPORT_SCRIPTS)) {
  if (reportScriptsOnDisk.has(p) === false) fail(`expected report script missing: ${p}`);
}
for (const p of reportScriptsOnDisk) {
  if (Object.prototype.hasOwnProperty.call(REPORT_SCRIPTS, p) === false) {
    fail(`new report script outside allowlist: ${p}`);
  }
}
for (const line of git(["grep", "-nE", REPORT_FORBIDDEN_IMPORT, "--", ":(glob)scripts/*-report.ts"])) {
  fail(`report script imports external customer-output generator: ${line}`);
}

// ---- Characterization report -----------------------------------------------------------------
console.log("Observer modules (allowed, by class):");
for (const [name, cls] of Object.entries(OBSERVER_MODULES)) {
  console.log(`  ${cls.padEnd(32)} src/scoring/${name}`);
}
console.log("");
console.log("Report/observation scripts (allowed, by class):");
for (const [p, cls] of Object.entries(REPORT_SCRIPTS)) {
  console.log(`  ${cls.padEnd(26)} ${p}`);
}
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
for (const d of DEFERRED) console.log(`  - ${d}`);
console.log("");

if (violations > 0) {
  console.error(`check:observer-shape FAILED — ${violations} observer-shape drift/boundary issue(s).`);
  process.exit(1);
}
console.log(
  "check:observer-shape OK — observer modules present with expected shape; no forbidden imports/markers; report scripts within allowlist.",
);
console.log(
  "Scope: static text scan (git ls-files + git grep) of tracked src/ + scripts/; no DB/network/runtime; no module execution.",
);
