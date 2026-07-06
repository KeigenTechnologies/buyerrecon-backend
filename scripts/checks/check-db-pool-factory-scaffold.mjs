#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase C2: shared DB pool factory guardrail (single-importer migration).
//
// Status: SPRINT3_5_PHASE_C2_LOW_RISK_CLI_OBSERVATION_POOL_FACTORY_MIGRATION
//
// (Command name kept as check:db-pool-factory-scaffold for continuity across C1 -> C2.)
//
// Statically proves the src/db/pool-factory.ts factory is wired to EXACTLY ONE low-risk CLI
// observation path and to nothing else, and FAILS CLOSED (exit 1) on drift or scan error:
//   - factory file exists
//   - factory has EXACTLY ONE runtime importer, and it is the allowlisted migrated CLI
//     (scripts/poi-table-observation-report.ts)
//   - no worker / risk-evidence / record-only / customer-output / observer-module importer
//   - package.json does not invoke the factory module directly
//   - factory reads NO env (no `process.env`) and references no connection-source env name
//   - factory introduces NO role-scoped DSN name
//   - factory imports only the pg driver (no application-module / relative import)
//
// This is a STATIC TEXT check (git ls-files + git grep — git's own grep, not the ugrep-aliased
// shell `grep`). It does NOT import application modules, open a DB/network connection, load env,
// read secrets, run any worker/classifier/risk-evidence, read private captures, or change behavior.
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:db-pool-factory-scaffold
//
// Note: this file deliberately avoids the literal database-constructor and connection-env-read
// tokens so the sibling check:pg-pool-construction (which scans scripts/) is not tripped.

import { spawnSync } from "node:child_process";

const FACTORY = "src/db/pool-factory.ts";
const SELF = "scripts/checks/check-db-pool-factory-scaffold.mjs";
// The single allowed runtime importer for Phase C2 (the migrated low-risk CLI observation path).
const ALLOWED_IMPORTERS = ["scripts/poi-table-observation-report.ts"];

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
function fileHasEre(file, pattern) {
  const res = spawnSync("git", ["grep", "-nE", "--", pattern, file], { encoding: "utf8" });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git grep -E failed on ${file} (status=${res.status}): ${(res.stderr || "").trim()}`);
}
function pathOf(line) {
  return line.split(":", 1)[0];
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// Surfaces that must NEVER import the factory (worker / risk-evidence / record-only / customer-output).
function isForbiddenImporter(p) {
  return (
    /(^|\/)run-[a-z0-9-]*worker\.ts$/.test(p) ||
    p.startsWith("src/scoring/risk-evidence/") ||
    p.includes("record-only") ||
    p.startsWith("src/reports/external/") ||
    p.startsWith("src/lane-ab-preview/") ||
    /^src\/scoring\/[^/]*-observer\//.test(p) ||
    /(^|\/)worker\.ts$/.test(p)
  );
}

// ---- Rule 1: factory exists ------------------------------------------------------------------
const factoryTracked = git(["ls-files", "--", FACTORY]);
if (factoryTracked.length === 0) fail(`factory file missing: ${FACTORY}`);

// ---- Rule 2: exactly one importer, and it is the allowlisted migrated CLI --------------------
const IMPORTER_RE =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"'][^\"']*pool-factory";
const importerLines = git([
  "grep", "-nE", IMPORTER_RE, "--",
  "src", "scripts",
  `:(exclude)${FACTORY}`,
  `:(exclude)${SELF}`,
]);
const importerFiles = [...new Set(importerLines.map(pathOf))];
if (importerFiles.length !== 1) {
  fail(`factory must have exactly ONE importer; found ${importerFiles.length}: ${importerFiles.join(", ") || "(none)"}`);
}
for (const p of importerFiles) {
  if (ALLOWED_IMPORTERS.includes(p) === false) fail(`factory imported by a non-allowlisted path: ${p}`);
  if (isForbiddenImporter(p)) fail(`factory imported by a forbidden surface (worker/risk-evidence/record-only/customer-output/observer): ${p}`);
}
// package.json must not invoke the factory module directly.
for (const line of git(["grep", "-nF", "--", "db/pool-factory", "package.json"])) {
  fail(`package.json references the factory module directly: ${line}`);
}

// ---- Rules 3-5: factory is env-free, DSN-neutral, and imports only the driver -----------------
if (factoryTracked.length > 0) {
  if (fileHasFixed(FACTORY, "process.env")) fail(`factory reads env (must be env-free; caller passes the connection string)`);
  if (fileHasFixed(FACTORY, "DATABASE_URL")) fail(`factory references the connection-source env name (must be absent)`);
  for (const dsn of ["APP_DSN", "ADMIN_DSN", "RUNNER_DSN", "STAGE0_RUNNER_DSN"]) {
    if (fileHasFixed(FACTORY, dsn)) fail(`factory introduces a role-scoped DSN name (${dsn}); role/DSN behavior must be unchanged`);
  }
  // Only the pg driver may be imported — no application-module / relative import.
  if (fileHasEre(FACTORY, "from[[:space:]]+[\"']\\.\\.?/")) {
    fail(`factory imports an application module (relative import); only the pg driver is allowed`);
  }
}

// ---- Characterization report -----------------------------------------------------------------
console.log(`Shared DB pool factory: ${FACTORY}`);
console.log(`  tracked: ${factoryTracked.length > 0 ? "yes" : "NO"}`);
console.log(`  runtime importers (must be exactly 1): ${importerFiles.length}${importerFiles.length ? " -> " + importerFiles.join(", ") : ""}`);
console.log(`  env-free / DSN-neutral / driver-only import: asserted`);
console.log("");
console.log("Companion proof: check:pg-pool-construction allowlists this single construction site");
console.log("(one CLI observation site migrated from poi-table to the factory; workers unchanged/frozen).");
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
console.log("  - Further migrations (C2 additional CLI paths) — each is its own separately-approved slice.");
console.log("  - Worker-path migration (C3) — frozen until separate approval; workers keep inline construction.");
console.log("  - Role-scoped connection binding — a future, separately-approved change; not proposed here.");
console.log("");

if (violations > 0) {
  console.error(`check:db-pool-factory-scaffold FAILED — ${violations} factory wiring invariant issue(s).`);
  process.exit(1);
}
console.log(
  "check:db-pool-factory-scaffold OK — factory wired to exactly one low-risk CLI importer; env-free, DSN-neutral, driver-only; no worker/risk-evidence/record-only/customer-output importer.",
);
console.log(
  "Scope: static text scan (git ls-files + git grep) of tracked src/ + scripts/; no DB/network/runtime; no module execution.",
);
