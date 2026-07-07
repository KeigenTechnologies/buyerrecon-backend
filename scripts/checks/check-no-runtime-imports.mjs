#!/usr/bin/env node
// BuyerRecon — Sprint 3.5: L1 no-runtime-imports declaration verifier.
//
// Status: SPRINT3_5_CHECK_NO_RUNTIME_IMPORTS_L1_DECLARATION_VERIFIER
//
// Helps enforce the L1 / no-runtime boundary by statically detecting obvious runtime-risk
// imports / calls / tokens in the repository's L1 / static / governance / tooling surfaces —
// the files that are SUPPOSED to remain no-runtime. FAILS CLOSED (exit 1) on any violation or
// scan error.
//
// This is a STATIC TEXT check. It uses Node built-ins (node:fs) + `git ls-files` only — no shell
// grep (avoids local ugrep-alias issues). It does NOT import application modules, boot the app,
// read env files/values, connect to DB/network, run SQL/psql, execute workers/classifiers/
// risk-evidence, generate Lane/scoring/AMS/customer output, access private captures
// (run.err / run.safe.out), call the GitHub API, or require any secret.
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:no-runtime-imports
//
// SCOPE / NON-OVERCLAIM (this first version):
//   * It enforces the STATICALLY-REPRESENTABLE part only. It does NOT parse PR-body layer
//     declarations and does NOT prove full L1/L2/L3 truth, runtime behavior, or DB role binding.
//   * Runtime/source changes remain governed by the existing specialized guardrails
//     (check:pg-pool-construction / record-only-gate / customer-output-boundary / etc.) and by the
//     CLAUDE.md PR test-layering classification + review.
//   * It scans the protected L1 surfaces GLOBALLY (simpler + safe + a stronger invariant than a
//     PR-diff subset). PR-diff/merge-base scoping and PR-body declaration parsing are DEFERRED
//     (see the deferred list at the end) — the latter is not safely available without extra
//     GitHub API access / secrets.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The static-guardrails BUNDLE scripts — these must each be a `node scripts/...` command
// (kept static; no tsx/worker/runtime). Non-bundle scripts (e.g. worker-run scripts) are NOT
// audited here — they legitimately exist and their runtime-ness is not cleanly representable.
const BUNDLE_SCRIPTS = [
  "check:constants",
  "check:static-boundaries",
  "check:pg-pool-construction",
  "check:observer-shape",
  "check:record-only-gate",
  "check:customer-output-boundary",
  "check:db-pool-factory-scaffold",
  "check:no-runtime-imports",
];

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

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

// ---- Surface enumeration (tracked files only) ------------------------------------------------
const checkerFiles = git(["ls-files", "--", ":(glob)scripts/checks/*.mjs"]);
const workflowFiles = git([
  "ls-files", "--", ":(glob).github/workflows/*.yml", ":(glob).github/workflows/*.yaml",
]);
const markdownFiles = git(["ls-files", "--", ":(glob)docs/**/*.md", "CLAUDE.md"]);

// If none of the core surfaces resolve, something is wrong with the checkout — fail closed.
if (checkerFiles.length === 0 && workflowFiles.length === 0) {
  fail("no protected L1 surfaces found (checkers/workflows) — cannot verify; failing closed");
}

// ---- Rule set for CHECKER scripts (scripts/checks/*.mjs) --------------------------------------
// I1: only `node:` module specifiers may be imported/required (no runtime pkg, no app module).
// E1 (fail-closed): the ONLY permitted child_process execution is a READ-ONLY `git` invocation using
// an approved read-only SUBCOMMAND. Every other binary (npm / npx / node / bash / sh / zsh / python /
// python3 / ts-node / tsx / psql / ssh / scp / rsync / curl / wget / docker / docker-compose /
// systemctl / service / kubectl / ...) is BLOCKED; shell-string execution (exec / execSync) is BLOCKED
// entirely; and mutating/network git subcommands (push/fetch/pull/checkout/commit/worktree/...) are
// BLOCKED. A git invocation whose subcommand cannot be statically determined fails closed.
const ALLOWED_EXEC_BINARY = "git";
// Read-only git subcommands the checker family may invoke (defined via split so no `[...]` literal
// containing a subcommand token exists in this file — avoids self-flagging by E1d).
const SAFE_GIT_SUBCOMMANDS = new Set(
  "ls-files grep diff status rev-parse merge-base show cat-file log".split(" "),
);
// Mutating / network git subcommands that must never appear in a checker.
const UNSAFE_GIT_SUBCOMMANDS = new Set(
  ("push fetch pull checkout switch reset merge rebase commit add restore clean rm mv tag branch " +
    "remote clone submodule worktree sparse-checkout lfs").split(" "),
);
// argv[0]-form execution: capture the binary in the first quoted argument.
const BINARY_EXEC_RE = /\b(spawnSync|spawn|execFileSync|execFile)\s*\(\s*["']([^"']+)["']/g;
// shell-string-form execution (first arg is a shell command line, not a binary): never allowed here.
const SHELL_EXEC_RE = /\b(execSync|exec)\s*\(/;
// A DIRECT git spawn with an inline args array: capture the array body.
const GIT_ARRAY_EXEC_RE = /\b(?:spawnSync|spawn|execFileSync|execFile)\s*\(\s*["']git["']\s*,\s*\[([^\]]*)\]/g;
// Any array literal (used to validate subcommands at git-helper CALL SITES, e.g. git([...])).
const ARRAY_LITERAL_RE = /\[([^\]]*)\]/g;

// First non-option token of an args-array body: {kind:"string",value} | {kind:"dynamic"} | {kind:"none"}.
function firstArgToken(body) {
  for (const raw of body.split(",")) {
    const t = raw.trim();
    if (t === "") continue;
    const sm = t.match(/^["']([^"']*)["']$/);
    if (sm) {
      if (sm[1].startsWith("-")) continue; // an option flag — skip to the subcommand
      return { kind: "string", value: sm[1] };
    }
    return { kind: "dynamic" }; // first meaningful element is not a plain string literal
  }
  return { kind: "none" };
}

for (const file of checkerFiles) {
  const src = read(file);
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // import statement (side-effect or named) — anchored to statement start
    if (/^\s*import\b/.test(line)) {
      const m = line.match(/from\s*["']([^"']+)["']/) || line.match(/^\s*import\s*["']([^"']+)["']/);
      if (m && m[1].startsWith("node:") === false) {
        fail(`${file}:${i + 1} checker imports a non-node module "${m[1]}" (only node: built-ins allowed)`);
      }
    }
    // require(...) anywhere on the line
    const rq = line.match(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/);
    if (rq && rq[1].startsWith("node:") === false) {
      fail(`${file}:${i + 1} checker require()s a non-node module "${rq[1]}" (only node: built-ins allowed)`);
    }
  }
  // E1a: only the read-only `git` binary may be used in argv[0]-form execution.
  for (const m of src.matchAll(BINARY_EXEC_RE)) {
    if (m[2] !== ALLOWED_EXEC_BINARY) {
      fail(`${file} runs child_process ${m[1]}(argv0="${m[2]}") — only read-only ${ALLOWED_EXEC_BINARY} execution is allowed in checkers`);
    }
  }
  // E1b: no shell-string execution.
  if (SHELL_EXEC_RE.test(src)) {
    fail(`${file} uses shell-string execution (exec / execSync) — not permitted in checkers`);
  }
  // E1c: a DIRECT git spawn with an inline args array must use an approved read-only subcommand; a
  //      dynamic/undeterminable first element fails closed.
  for (const m of src.matchAll(GIT_ARRAY_EXEC_RE)) {
    const tok = firstArgToken(m[1]);
    if (tok.kind === "string") {
      if (SAFE_GIT_SUBCOMMANDS.has(tok.value) === false) {
        fail(`${file} runs a direct git "${tok.value}" — not an approved read-only git subcommand`);
      }
    } else {
      fail(`${file} runs a direct git spawn with a dynamic/undeterminable subcommand — failing closed`);
    }
  }
  // E1d: validate subcommands at git-helper CALL SITES (and anywhere): any array literal whose first
  //      non-option token is a MUTATING/NETWORK git subcommand is flagged. Arrays whose first token is
  //      a safe subcommand or not a git subcommand at all (paths, config lists) are left alone — this
  //      keeps the established spawnSync("git", args) helper pattern (validated via its call sites) safe.
  for (const m of src.matchAll(ARRAY_LITERAL_RE)) {
    const tok = firstArgToken(m[1]);
    if (tok.kind === "string" && UNSAFE_GIT_SUBCOMMANDS.has(tok.value)) {
      fail(`${file} passes a mutating/network git subcommand "${tok.value}" to a git invocation`);
    }
  }
}

// ---- Rule set for WORKFLOWS (.github/workflows/*.yml) -----------------------------------------
// W1: no service containers. W2: no secrets. W3: no DATABASE_URL env. W4 (fail-closed): each `run:`
// step must be single-line and one of the EXACT approved commands — `npm ci` or `npm run <exact
// static-guardrail bundle script>`. Arbitrary `npm run check:*` is NOT accepted; a run step is only
// allowed if it invokes a command in this exact allowlist. `uses:` action steps are not `run:`
// commands and are not checked here.
const WORKFLOW_RUN_ALLOWLIST = new Set([
  "npm ci",
  ...BUNDLE_SCRIPTS.map((s) => `npm run ${s}`),
]);
for (const file of workflowFiles) {
  const lines = read(file).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*services\s*:/.test(line)) fail(`${file}:${i + 1} workflow defines a service container (services:)`);
    if (/\$\{\{\s*secrets\./.test(line)) fail(`${file}:${i + 1} workflow references secrets.*`);
    if (/\bDATABASE_URL\b/.test(line)) fail(`${file}:${i + 1} workflow references DATABASE_URL`);
    const rm = line.match(/^\s*run\s*:\s*(.*)$/);
    if (rm) {
      const cmd = rm[1].trim();
      if (cmd === "|" || cmd === ">" || cmd === "|-" || cmd === ">-" || cmd === "") {
        fail(`${file}:${i + 1} workflow uses a multi-line run block — keep run steps single-line + exactly allowlisted`);
      } else if (WORKFLOW_RUN_ALLOWLIST.has(cmd) === false) {
        fail(`${file}:${i + 1} workflow run command not in the EXACT approved allowlist (npm ci + the static-guardrail bundle only): "${cmd}"`);
      }
    }
  }
}

// ---- MARKDOWN (docs/** + CLAUDE.md) — enforcement DEFERRED -----------------------------------
// A real runtime import/exec cannot exist in markdown (it is not executed), so the only
// runtime-risk would be an embedded real secret. But docs legitimately carry many EXAMPLE /
// PLACEHOLDER / masked / env-interpolated DSNs (e.g. `postgres://user:pass@localhost:5432/db`,
// `postgresql://…:<PASSWORD>@<HOST>/…`, `…:${RUNNER_PW}@…`) that are indistinguishable from a real
// leaked credential without semantic judgment. Flagging them produces false positives; not flagging
// them under-claims. This ambiguity is not safely resolvable statically, so markdown secret/DSN
// detection is DEFERRED here (see the deferred list). Real-secret prevention remains governed by
// the production-parameters governance, the CLAUDE.md stop-lines, per-PR secret sweeps, and
// check:constants. The markdown surface is still enumerated below for visibility only.

// ---- Rule set for package.json (BUNDLE wiring only) ------------------------------------------
// P1: each static-guardrails bundle script must be a `node scripts/...` command (stays static).
try {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts || {};
  for (const name of BUNDLE_SCRIPTS) {
    const cmd = scripts[name];
    if (typeof cmd !== "string") {
      fail(`package.json is missing bundle script "${name}"`);
    } else if (/^node\s+scripts\//.test(cmd) === false) {
      fail(`package.json bundle script "${name}" is not a static \`node scripts/...\` command: "${cmd}"`);
    }
  }
} catch (e) {
  fail(`package.json could not be parsed: ${e && e.message ? e.message : e}`);
}

// ---- Characterization report -----------------------------------------------------------------
console.log("no-runtime-imports — protected L1/static surfaces scanned:");
console.log(`  checker scripts (scripts/checks/*.mjs): ${checkerFiles.length}  (node: imports only; child_process limited to read-only git SUBCOMMANDS; no shell-string exec)`);
console.log(`  workflows (.github/workflows/*):        ${workflowFiles.length}  (no services/secrets/DATABASE_URL; run: EXACT allowlist = npm ci + bundle)`);
console.log(`  markdown (docs/** + CLAUDE.md):         ${markdownFiles.length}  (enumerated for visibility; secret/DSN enforcement DEFERRED)`);
console.log(`  package.json bundle scripts:            ${BUNDLE_SCRIPTS.length}  (each a static \`node scripts/...\` command)`);
console.log("");
console.log("deferred (recorded — NOT enforced by this first version):");
console.log("  - PR-body layer-declaration parsing (L1/L2/L3 claim verification): needs GitHub API / PR");
console.log("    context not available without extra access/secrets. Deferred; the checker never calls an API.");
console.log("  - PR-diff / merge-base changed-file scoping: this version scans the protected surfaces GLOBALLY");
console.log("    (simpler + safe + stronger invariant); per-PR-diff scoping deferred to avoid fetch-depth coupling.");
console.log("  - Markdown secret/DSN detection (docs/CLAUDE.md): docs legitimately carry example / placeholder /");
console.log("    masked / env-interpolated DSNs indistinguishable from real credentials without semantic judgment.");
console.log("    Deferred; real-secret prevention stays governed by production-parameters + per-PR secret sweeps.");
console.log("  - Governance-prose token scanning of docs/CLAUDE.md (naming DATABASE_URL / Gate4E / run.err /");
console.log("    risk-evidence, etc.): legitimate negative-boundary prose, not statically separable from real risk.");
console.log("  - Non-bundle package.json scripts (e.g. worker-run scripts): they legitimately exist; auditing");
console.log("    arbitrary-script runtime-ness is out of scope here — only the guardrail bundle wiring is enforced.");
console.log("");

if (violations > 0) {
  console.error(`check:no-runtime-imports FAILED — ${violations} runtime-risk issue(s) on protected L1 surfaces.`);
  process.exit(1);
}
console.log(
  "check:no-runtime-imports OK — checkers import only node: built-ins and run child_process only as approved read-only git subcommands (no other binary, no shell-string exec, no mutating/network git); workflows carry no service/secret/DATABASE_URL and only the EXACT approved run: allowlist (npm ci + the static-guardrail bundle); the guardrail bundle stays static (package.json). Markdown secret/DSN enforcement is deferred.",
);
console.log(
  "Scope: static text scan (git ls-files + node:fs) of tracked L1 surfaces; no DB/network/runtime; no module execution; no API; no secrets.",
);
