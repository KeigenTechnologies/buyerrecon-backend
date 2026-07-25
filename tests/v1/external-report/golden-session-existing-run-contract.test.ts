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

  it('reports every verification fact separately in the existing-run block', () => {
    // The reporting block is rendered from one typed metadata object in the
    // module, so the emitted key literals live there. Each must remain present.
    for (const key of [
      'ams_run_id=',
      'persisted_provenance_verified=',
      'golden_json_decision_verified=',
      'persisted_final_decision_verified=',
      'persisted_final_decision_unavailable_by_schema=',
      'golden_json_embedded_run_id=',
    ]) {
      expect(moduleCode, `metadata key: ${key}`).toContain(key);
    }
    // ...and the entrypoint renders them, inside the existing_run branch only.
    const branch = entrypointCode.indexOf("args.amsInput.mode === 'existing_run'", entrypointCode.indexOf('run-golden-session OK'));
    const renderCall = entrypointCode.indexOf('renderExistingRunReportMetadata(');
    expect(branch).toBeGreaterThan(0);
    expect(renderCall).toBeGreaterThan(branch);
    expect(entrypointCode).toMatch(/buildExistingRunReportMetadata\(/);
  });

  it('locks golden_json_embedded_run_id to the literal false', () => {
    // Declared as a literal-typed schema fact, not a mutable boolean, so a
    // build that tried to report `true` fails type checking.
    expect(moduleCode).toMatch(/export const GOLDEN_JSON_EMBEDDED_RUN_ID = false as const;/);
    expect(moduleCode).toMatch(/readonly golden_json_embedded_run_id:\s*false;/);
    // Never true, and never a claim that the artifact asserted or verified one.
    expect(moduleCode).not.toMatch(/golden_json_embedded_run_id=true/);
    expect(moduleCode).not.toMatch(/golden_json_embedded_run_id:\s*true/);
    expect(moduleCode).not.toMatch(/golden_json_run_id_verified/);
    expect(entrypointCode).not.toMatch(/golden_json_embedded_run_id=true/);
    // The field is not typed as a plain boolean, which would unlock `true`.
    expect(moduleCode).not.toMatch(/golden_json_embedded_run_id:\s*boolean/);
  });

  it('never emits a persisted final-decision value', () => {
    // Only the `_verified` and `_unavailable_by_schema` suffixed keys may
    // appear. A bare `persisted_final_decision=` — e.g. `=HOLD` — must never be
    // emitted, because the canonical schema persists no decision field.
    const combined = `${entrypointCode}\n${moduleCode}`;
    expect(combined).not.toMatch(/persisted_final_decision=/);
    const emittedKeys = [...new Set(combined.match(/persisted_final_decision[A-Za-z_]*(?==)/g) ?? [])].sort();
    expect(emittedKeys).toEqual([
      'persisted_final_decision_unavailable_by_schema',
      'persisted_final_decision_verified',
    ]);
  });

  it('never maps a product action to a final decision', () => {
    // No literal or computed bridge from the persisted product proposal to the
    // policy decision domain anywhere in the module.
    expect(moduleCode).not.toMatch(/suppress/);
    expect(moduleCode).not.toMatch(/RequestedAction[\s\S]{0,80}?(HOLD|ALLOW|DENY|REVIEW)/);
    expect(moduleCode).not.toMatch(/(HOLD|ALLOW|DENY|REVIEW)[\s\S]{0,80}?RequestedAction/);

    // The single sanctioned persisted-decision accessor is hard-wired to null.
    expect(moduleCode).toMatch(
      /export function persistedFinalDecision\([^)]*\):\s*null\s*\{\s*return null;\s*\}/,
    );

    // The decision reason code names the golden JSON as the authority, and no
    // persisted-decision reason code exists.
    expect(moduleCode).toMatch(/golden_json_final_decision_mismatch/);
    expect(moduleCode).not.toMatch(/'persisted_final_decision_mismatch'/);
  });

  it('performs no database write in the existing-run module', () => {
    expect(/\b(INSERT|UPDATE\s|DELETE|UPSERT|TRUNCATE|COPY)\b/i.test(moduleCode)).toBe(false);
    expect(moduleCode).toMatch(/FROM replay_runs/);
    expect(moduleCode).toMatch(/FROM replay_evidence_cards/);
  });
});
