#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase B / PR E: customer-output boundary characterization guardrail.
//
// Status: SPRINT3_5_PHASE_B_PR_E_CUSTOMER_OUTPUT_BOUNDARY_CHARACTERIZATION
//
// Records (allowlists) the CURRENT customer-output generation surface (src/reports/external/) and
// FAILS CLOSED (exit 1) if that surface grows outside the allowlist, if worker / risk-evidence /
// record-only / observer / report / preview code imports the customer-output generator, if the
// generator imports a worker/risk-evidence/record-only entrypoint, if a Gate4E/Gate4F code artifact
// appears (outside the guardrail scripts that merely name them in notes), or on a scan error.
//
// This is a STATIC TEXT check. It scans tracked source/config via `git ls-files` + `git grep` only
// (git's own grep, POSIX ERE — not the ugrep-aliased shell `grep`). It does NOT generate customer
// output, run Lane/scoring/AMS/Gate code, execute workers/classifiers/risk-evidence, import
// application modules, open a DB/network connection, load env, read secrets, read private captures
// (run.err / run.safe.out), or change runtime behavior. Static BOUNDARY only — no runtime proof, no
// Gate4E/4F execution, no AMS runtime assertion, no inference from sealed captures.
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:customer-output-boundary
//
// Design notes:
//   * src/reports/external/ is the customer-output GENERATION surface (external report snapshot +
//     renderer + safe-claims). Per the PR #360 audit it is observer-only / UNWIRED (no importers).
//   * src/lane-ab-preview/ is an INTERNAL preview surface (NOT customer-facing) and the scripts/
//     *report*.ts / *preview*.ts are INTERNAL report drivers — characterized, and also required not
//     to import the external customer-output generator.
//   * Import matches anchor on from/import(/require( + quote (no \b, which git-grep ERE lacks), so
//     doc-comments are not matched.
//   * No new npm dependencies. Node built-ins + git, mirroring the sibling checks. The checker lives
//     under scripts/checks/ and is outside every scan scope (Gate scan explicitly excludes it), so
//     it cannot self-match.

import { spawnSync } from "node:child_process";

// ---- Customer-output GENERATION surface (allowlist) ------------------------------------------
const CUSTOMER_OUTPUT_FILES = [
  "src/reports/external/builders.ts",
  "src/reports/external/contracts.ts",
  "src/reports/external/fixtures.ts",
  "src/reports/external/golden-session-package.ts",
  "src/reports/external/index.ts",
  "src/reports/external/renderer.ts",
  "src/reports/external/safe-claims.ts",
  "src/reports/external/session-evidence-atoms.ts",
];
// Golden Session v0.1: the ONE internal-only generator driver allowed to import the
// generation surface. It is excluded from the non-generator scan below and instead
// held to the generator's own no-worker/no-risk-evidence/no-record-only import rule.
const GENERATOR_DRIVER_FILES = ["scripts/run-golden-session.ts"];
// Internal (NOT customer-facing) preview surface — characterized only.
const INTERNAL_PREVIEW_FILES = [
  "src/lane-ab-preview/index.ts",
  "src/lane-ab-preview/preview.ts",
  "src/lane-ab-preview/report.ts",
  "src/lane-ab-preview/types.ts",
];

// ---- POSIX ERE (no \b) -----------------------------------------------------------------------
const SPECIFIER_PREFIX =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"']";
// Non-generator surfaces must NOT import the external customer-output generator.
const FORBIDDEN_IMPORT_EXTERNAL = SPECIFIER_PREFIX + "[^\"']*(reports/external)";
// The generator must NOT import worker / risk-evidence / record-only entrypoints.
const GENERATOR_FORBIDDEN_IMPORT =
  SPECIFIER_PREFIX + "[^\"']*(run-[a-z0-9-]*worker|risk-evidence/worker|/worker\\.(js|ts)|record-only)";

// Scopes that must not import the customer-output generator (everything except the generator itself).
const NON_GENERATOR_SCOPES = [
  ":(glob)src/scoring/**",
  ":(glob)src/lane-ab-preview/**",
  ":(glob)scripts/run-*-worker.ts",
  ":(glob)scripts/*report*.ts",
  ":(glob)scripts/*preview*.ts",
  // Golden Session v0.1 driver: allowed to import the generator, so excluded here;
  // it is covered by GENERATOR_SCOPE (rule 3) instead. Every other prohibition stands.
  ":(exclude)scripts/run-golden-session.ts",
];
const GENERATOR_SCOPE = [
  ":(glob)src/reports/external/**",
  ":(glob)scripts/run-golden-session.ts",
];

const DEFERRED = [
  "Lane A/B write coupling — enforced at the Postgres grant layer (migrations/016); there is no " +
    "in-code Lane writer, and the table name appears pervasively in schema DDL, 'forbidden-writes' " +
    "comments, and count-only read checks, so it is not a statically-representable code boundary here.",
  "Gate4E / Gate4F — no in-repo code artifacts (procedural/governance gates). This check asserts " +
    "their ABSENCE from code (outside the guardrail notes); it does not execute or prove any gate.",
  "AMS runtime coupling — AMS is not a runtime dependency; there is no import edge to assert.",
  "Runtime customer-output-generation proof — static boundary only; no execution, no generated output.",
  "Sealed risk-worker runtime cause — out of scope; not read, not inferred " +
    "(runtime_dependency_or_build_failure / blocked / none_not_classified / likely_failure_surface=unknown preserved).",
];

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return [];
  throw new Error(`git ${args.join(" ")} failed (status=${res.status}): ${(res.stderr || "").trim()}`);
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// ---- Rule 1: customer-output surface presence + drift ----------------------------------------
const externalOnDisk = new Set(git(["ls-files", "--", ":(glob)src/reports/external/**"]));
const allow = new Set(CUSTOMER_OUTPUT_FILES);
for (const f of CUSTOMER_OUTPUT_FILES) {
  if (externalOnDisk.has(f) === false) fail(`expected customer-output surface file missing: ${f}`);
}
for (const f of externalOnDisk) {
  if (allow.has(f) === false) fail(`new customer-output generation surface outside allowlist: ${f}`);
}

// ---- Rule 2: non-generator surfaces must not import the customer-output generator ------------
for (const line of git(["grep", "-nE", FORBIDDEN_IMPORT_EXTERNAL, "--", ...NON_GENERATOR_SCOPES])) {
  fail(`non-generator surface imports customer-output generator (reports/external): ${line}`);
}

// ---- Rule 3: generator must not import worker/risk-evidence/record-only entrypoints ----------
for (const line of git(["grep", "-nE", GENERATOR_FORBIDDEN_IMPORT, "--", ...GENERATOR_SCOPE])) {
  fail(`customer-output generator imports a worker/risk-evidence/record-only entrypoint: ${line}`);
}

// ---- Rule 4: no Gate4E/Gate4F code artifact (outside guardrail notes) ------------------------
const GATE_SCAN_SCOPE = ["src", "scripts", "scoring", ":(exclude,glob)scripts/checks/**"];
for (const gate of ["Gate4E", "Gate4F"]) {
  for (const line of git(["grep", "-nF", "--", gate, ...GATE_SCAN_SCOPE])) {
    fail(`Gate4E/Gate4F code artifact appeared without explicit characterization: ${line}`);
  }
}

// ---- Characterization report -----------------------------------------------------------------
console.log("Customer-output GENERATION surface (allowed) — src/reports/external/:");
for (const f of CUSTOMER_OUTPUT_FILES) console.log(`  ${f}`);
const importers = git(["grep", "-lE", SPECIFIER_PREFIX + "[^\"']*(reports/external)", "--", ...NON_GENERATOR_SCOPES]);
console.log(`  external importers among non-generator surfaces: ${importers.length} (expected 0 — surface is unwired)`);
console.log("");
console.log("Golden Session v0.1 internal-only generator driver (allowed generator importer):");
for (const f of GENERATOR_DRIVER_FILES) console.log(`  ${f}`);
console.log("");
console.log("Internal (NOT customer-facing) preview surface — src/lane-ab-preview/:");
for (const f of INTERNAL_PREVIEW_FILES) console.log(`  ${f}`);
console.log("");
console.log("Internal report/preview CLI drivers (scripts/*report*.ts, *preview*.ts):");
for (const f of git(["ls-files", "--", ":(glob)scripts/*report*.ts", ":(glob)scripts/*preview*.ts"])) {
  console.log(`  ${f}`);
}
console.log("");
console.log("Gate4E/Gate4F code artifacts (outside guardrail notes): none (procedural/governance)");
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
for (const d of DEFERRED) console.log(`  - ${d}`);
console.log("");

if (violations > 0) {
  console.error(`check:customer-output-boundary FAILED — ${violations} customer-output boundary issue(s).`);
  process.exit(1);
}
console.log(
  "check:customer-output-boundary OK — customer-output generator allowlisted and unwired; no coupling to worker/risk-evidence/record-only/observer/report/preview; no Gate4E/4F code artifacts.",
);
console.log(
  "Scope: static text scan (git ls-files + git grep) of tracked src/ + scripts/ + scoring/; no DB/network/runtime; no module execution; no capture read; no customer output generated.",
);
