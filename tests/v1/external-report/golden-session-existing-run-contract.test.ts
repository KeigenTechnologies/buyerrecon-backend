import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// Static source contract: the canonical Golden Session entrypoint must be
// structurally incapable of executing AMS when existing-run mode is selected.
// This complements the behavioural unit tests by pinning the call graph itself.

const entrypoint = readFileSync('scripts/run-golden-session.ts', 'utf8');
const moduleSrc = readFileSync('src/reports/external/ams-existing-run.ts', 'utf8');

/** Strip comments so assertions target executable code, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const entrypointCode = stripComments(entrypoint);
const moduleCode = stripComments(moduleSrc);

describe('golden-session entrypoint — existing-run mode cannot invoke AMS', () => {
  it('spawns AMS from exactly one place', () => {
    expect(entrypointCode.match(/execFile\(/g) ?? []).toHaveLength(1);
    expect(entrypointCode.match(/await runAmsOnce\(/g) ?? []).toHaveLength(1);
  });

  it('calls runAmsOnce only inside the fresh_ams branch', () => {
    const freshBranch = entrypointCode.indexOf("args.amsInput.mode === 'fresh_ams'");
    const elseBranch = entrypointCode.indexOf('} else {', freshBranch);
    const callSite = entrypointCode.indexOf('await runAmsOnce(');
    expect(freshBranch).toBeGreaterThan(0);
    expect(elseBranch).toBeGreaterThan(freshBranch);
    expect(callSite).toBeGreaterThan(freshBranch);
    expect(callSite).toBeLessThan(elseBranch);
  });

  it('types runAmsOnce to accept only the fresh_ams variant', () => {
    expect(entrypointCode).toMatch(
      /fresh:\s*Extract<AmsInputMode,\s*\{\s*mode:\s*'fresh_ams'\s*\}>/,
    );
  });

  it('declares no binary or db-url field on the existing_run variant', () => {
    const from = moduleCode.indexOf("mode: 'existing_run'");
    const variantBlock = moduleCode.slice(from, moduleCode.indexOf('};', from));
    expect(variantBlock).not.toMatch(/ams_bin/);
    expect(variantBlock).not.toMatch(/ams_db_url/);
  });

  it('reads the operator-supplied artifact on the existing-run path', () => {
    expect(entrypointCode).toMatch(/existing\.ams_golden_json_path/);
  });

  it('still rejects unknown flags and allowlists the existing-run flags', () => {
    expect(entrypointCode).toMatch(/unknown_flag_/);
    expect(entrypointCode).toMatch(/\.\.\.AMS_EXISTING_RUN_FLAGS/);
  });

  it('reconciles against persistence and can fail closed', () => {
    expect(entrypointCode).toMatch(/readPersistedAmsRunRows\(/);
    expect(entrypointCode).toMatch(/reconcilePersistedAmsRun\(/);
    expect(entrypointCode).toMatch(/ams_run_reconciliation_failed/);
  });

  it('emits structured mode metadata', () => {
    expect(entrypointCode).toMatch(/ams_input_mode=/);
    expect(entrypointCode).toMatch(/ams_invoked=/);
  });

  it('performs no database write in the existing-run module', () => {
    expect(/\b(INSERT|UPDATE\s|DELETE|UPSERT|TRUNCATE|COPY)\b/i.test(moduleCode)).toBe(false);
    expect(moduleCode).toMatch(/FROM replay_runs/);
    expect(moduleCode).toMatch(/FROM replay_evidence_cards/);
  });
});
