#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase C1: DB pool factory SCAFFOLD guardrail (no runtime use).
//
// Status: SPRINT3_5_PHASE_C1_DB_POOL_FACTORY_SCAFFOLD_NO_RUNTIME_USE
//
// Statically proves the src/db/pool-factory.ts scaffold is INERT and UNWIRED, and FAILS CLOSED
// (exit 1) if any invariant breaks or on a scan error:
//   - scaffold file exists
//   - scaffold has ZERO importers across runtime source / workers / report / observer /
//     customer-output / Gate / Lane / AMS surfaces / package scripts
//   - scaffold references no env read (no `process.env`), and no connection-source env name
//   - scaffold constructs no database pool/client, runs no SQL, imports no module
//   - no existing construction site was migrated (scaffold has no importers and no construction)
//
// This is a STATIC TEXT check. It scans tracked source via `git ls-files` + `git grep` only
// (git's own grep, not the ugrep-aliased shell `grep`). It does NOT import application modules,
// open a DB/network connection, load env, read secrets, run any worker/classifier/risk-evidence,
// read private captures, or change runtime behavior.
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:db-pool-factory-scaffold
//
// Note: this file deliberately avoids the literal database-constructor and connection-env-read
// tokens so that the sibling check:pg-pool-construction (which scans scripts/) is not tripped.

import { spawnSync } from "node:child_process";

const SCAFFOLD = "src/db/pool-factory.ts";
const SELF = "scripts/checks/check-db-pool-factory-scaffold.mjs";

function git(args) {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return [];
  throw new Error(`git ${args.join(" ")} failed (status=${res.status}): ${(res.stderr || "").trim()}`);
}
// Fixed-string presence within a single file.
function fileHasFixed(file, marker) {
  const res = spawnSync("git", ["grep", "-nF", "--", marker, file], { encoding: "utf8" });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git grep -F failed on ${file} (status=${res.status}): ${(res.stderr || "").trim()}`);
}
// ERE presence within a single file.
function fileHasEre(file, pattern) {
  const res = spawnSync("git", ["grep", "-nE", "--", pattern, file], { encoding: "utf8" });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git grep -E failed on ${file} (status=${res.status}): ${(res.stderr || "").trim()}`);
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// ---- Rule 1: scaffold exists -----------------------------------------------------------------
const scaffoldTracked = git(["ls-files", "--", SCAFFOLD]);
if (scaffoldTracked.length === 0) {
  fail(`scaffold file missing: ${SCAFFOLD}`);
}

// ---- Rule 2: scaffold has ZERO importers (unwired) -------------------------------------------
// Any from/import(/require( specifier that resolves to the scaffold module, anywhere in src/ or
// scripts/, excluding the scaffold itself and this checker.
const IMPORTER_RE =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"'][^\"']*pool-factory";
const importers = git([
  "grep", "-nE", IMPORTER_RE, "--",
  "src", "scripts",
  `:(exclude)${SCAFFOLD}`,
  `:(exclude)${SELF}`,
]);
for (const line of importers) fail(`scaffold is imported (must be unwired): ${line}`);
// Package scripts must not reference the scaffold module path either.
for (const line of git(["grep", "-nF", "--", "db/pool-factory", "package.json"])) {
  fail(`package.json references the scaffold module (must be unwired): ${line}`);
}

// ---- Rules 3-7: scaffold is inert (only if it exists) ----------------------------------------
if (scaffoldTracked.length > 0) {
  // 3. no env read
  if (fileHasFixed(SCAFFOLD, "process.env")) fail(`scaffold references process.env (must be env-free)`);
  // 4. no connection-source env name
  if (fileHasFixed(SCAFFOLD, "DATABASE_URL")) fail(`scaffold references the connection-source env name (must be absent)`);
  // 5. no database pool/client construction (escaped pattern; matches new [pg.]Pool / [pg.]Client)
  if (fileHasEre(SCAFFOLD, "new[[:space:]]+(pg\\.)?(Pool|Client)")) {
    fail(`scaffold constructs a database pool/client (must construct none)`);
  }
  // 6. no imports / re-exports / requires
  if (fileHasEre(SCAFFOLD, "(^|[[:space:]])import[[:space:]]|[[:space:]]from[[:space:]]+[\"']|require[[:space:]]*\\(")) {
    fail(`scaffold imports a module (must be import-free)`);
  }
  // 7. no SQL
  if (fileHasEre(SCAFFOLD, "INSERT INTO|DELETE FROM|UPDATE[[:space:]]+[a-zA-Z_]+[[:space:]]+SET|SELECT[[:space:]].*FROM")) {
    fail(`scaffold contains SQL (must run none)`);
  }
}

// ---- Characterization report -----------------------------------------------------------------
console.log(`DB pool factory scaffold: ${SCAFFOLD}`);
console.log(`  tracked: ${scaffoldTracked.length > 0 ? "yes" : "NO"}`);
console.log(`  importers (must be 0): ${importers.length}`);
console.log(`  contains DB client construction: no (asserted)`);
console.log(`  env-free / import-free / SQL-free: asserted`);
console.log("");
console.log("Companion proof: check:pg-pool-construction proves the existing construction topology");
console.log("(15 pool + 3 client + 18 DATABASE_URL-read sites) is unchanged and unmigrated.");
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
console.log("  - Factory wiring / call-site migration — Phase C2+; not implemented and not authorized here.");
console.log("  - Role-scoped connection binding — a future, separately-approved change; not proposed here.");
console.log("");

if (violations > 0) {
  console.error(`check:db-pool-factory-scaffold FAILED — ${violations} scaffold invariant issue(s).`);
  process.exit(1);
}
console.log(
  "check:db-pool-factory-scaffold OK — scaffold present, unwired (0 importers), env-free, import-free, SQL-free, constructs no DB client; no existing construction site migrated.",
);
console.log(
  "Scope: static text scan (git ls-files + git grep) of tracked src/ + scripts/; no DB/network/runtime; no module execution.",
);
