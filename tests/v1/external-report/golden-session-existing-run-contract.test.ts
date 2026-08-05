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

const atomsSrc = readFileSync('src/reports/external/session-evidence-atoms.ts', 'utf8');
const packageSrc = readFileSync('src/reports/external/golden-session-package.ts', 'utf8');
const entrypointCode = stripComments(entrypoint);
const moduleCode = stripComments(moduleSrc);

describe('golden-session entrypoint — existing-run mode cannot invoke AMS', () => {
  it('spawns AMS from exactly one place', () => {
    expect(entrypointCode.match(/execFile\(/g) ?? []).toHaveLength(1);
    expect(entrypointCode.match(/await dependencies\.runAmsOnce\(/g) ?? []).toHaveLength(1);
  });

  it('calls runAmsOnce only inside the fresh_ams branch', () => {
    const freshBranch = entrypointCode.indexOf("args.amsInput.mode === 'fresh_ams'");
    const elseBranch = entrypointCode.indexOf('} else {', freshBranch);
    const callSite = entrypointCode.indexOf('await dependencies.runAmsOnce(');
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

  it('raises a reconciliation failure BEFORE any package is constructed', () => {
    // A decision mismatch must abort before the report exists, not after.
    const reconcileCall = entrypointCode.indexOf('reconcilePersistedAmsRun(');
    const raise = entrypointCode.indexOf("failStage('ams_run_reconciliation_failed'");
    const buildPackage = entrypointCode.indexOf('buildGoldenSessionPackage(');
    const writeArtifacts = entrypointCode.indexOf('fileSystem.writeFileSync(', buildPackage);
    expect(reconcileCall).toBeGreaterThan(0);
    expect(raise).toBeGreaterThan(reconcileCall);
    expect(buildPackage).toBeGreaterThan(raise);
    expect(writeArtifacts).toBeGreaterThan(buildPackage);
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
      'cryptographic_linkage=',
      'embedded_run_linkage=',
      'cross_source_linkage=',
      'decision_authority=',
      'operator_decision_expectation_supplied=',
      'operator_decision_expectation_matched=',
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

  it('locks every linkage boundary to a literal non-overclaiming value', () => {
    expect(moduleCode).toMatch(/export const CRYPTOGRAPHIC_LINKAGE = false as const;/);
    expect(moduleCode).toMatch(/export const EMBEDDED_RUN_LINKAGE = false as const;/);
    expect(moduleCode).toMatch(
      /export const CROSS_SOURCE_LINKAGE = 'consistency_linkage' as const;/,
    );
    expect(moduleCode).toMatch(/readonly cryptographic_linkage:\s*false;/);
    expect(moduleCode).toMatch(/readonly embedded_run_linkage:\s*false;/);
    expect(moduleCode).toMatch(
      /readonly cross_source_linkage:\s*typeof CROSS_SOURCE_LINKAGE;/,
    );
    expect(moduleCode).not.toMatch(/cryptographic_linkage:\s*true/);
    expect(moduleCode).not.toMatch(/embedded_run_linkage:\s*true/);
    expect(moduleCode).not.toMatch(/CROSS_SOURCE_LINKAGE = '(?:cryptographic|embedded)'/);
  });

  it('creates the selected output directory on the shared artifact-write path', () => {
    const buildPackage = entrypointCode.indexOf('buildGoldenSessionPackage(');
    const sharedMkdir = entrypointCode.indexOf(
      'fileSystem.mkdirSync(args.output, { recursive: true })',
      buildPackage,
    );
    const firstWrite = entrypointCode.indexOf('fileSystem.writeFileSync(', buildPackage);
    expect(sharedMkdir).toBeGreaterThan(buildPackage);
    expect(sharedMkdir).toBeLessThan(firstWrite);
    expect(entrypointCode.match(/fileSystem\.mkdirSync\(args\.output,/g) ?? []).toHaveLength(1);
  });

  it('populates the reported decision from the validated Golden JSON, not from CLI args', () => {
    // The package is built from the validated artifact...
    expect(entrypointCode).toMatch(/buildGoldenSessionPackage\(\{[^}]*ams:\s*validation\.result/);
    // ...and the reported decision is read back off the built package.
    expect(entrypointCode).toMatch(/authoritative_final_decision=\$\{pkg\.ams_authoritative\.authoritative_final_decision\}/);
    // The operator expectation never becomes the reported or packaged decision.
    expect(entrypointCode).not.toMatch(/authoritative_final_decision=\$\{args/);
    expect(entrypointCode).not.toMatch(/authoritative_final_decision:\s*args\./);
    expect(entrypointCode).not.toMatch(/ams:\s*args\./);
    // Its ONLY appearance is the comparison-only expectation assignment: two
    // textual occurrences (the field name and the arg it reads), one statement.
    expect(entrypointCode.match(/expected_final_decision/g) ?? []).toHaveLength(2);
    expect(
      entrypointCode.match(/expected_final_decision:\s*args\.amsInput\.expected_final_decision/g) ?? [],
    ).toHaveLength(1);
  });

  it('resolves the actual decision only from the artifact, never from the expectation', () => {
    // The resolver takes exactly one argument — the artifact decision — so it is
    // structurally unable to fall back to an operator-supplied value.
    expect(moduleCode).toMatch(
      /export function resolveGoldenJsonFinalDecision\(\s*artifactFinalDecision: unknown,?\s*\)/,
    );
    const body = moduleCode.slice(
      moduleCode.indexOf('export function resolveGoldenJsonFinalDecision('),
    );
    const fnBody = body.slice(0, body.indexOf('\n}\n') + 3);
    expect(fnBody).not.toMatch(/expected_final_decision|expectation|operator/i);
    // Authority is a literal, not a computed or configurable value.
    expect(moduleCode).toMatch(/export const GOLDEN_JSON_DECISION_AUTHORITY = 'golden_json' as const;/);
    expect(moduleCode).not.toMatch(/decision_authority:\s*'operator'/);
    expect(moduleCode).not.toMatch(/decision_authority:\s*string/);
  });

  it('keeps --ams-final-decision out of the required existing-run flag set', () => {
    expect(moduleCode).toMatch(
      /AMS_EXISTING_RUN_REQUIRED_FLAGS = Object\.freeze\(\[\s*'--ams-golden-json',\s*'--ams-run-id',\s*\] as const\)/,
    );
    expect(moduleCode).toMatch(
      /AMS_EXISTING_RUN_OPTIONAL_FLAGS = Object\.freeze\(\['--ams-final-decision'\] as const\)/,
    );
    // The all-or-nothing check must cover the REQUIRED set only.
    expect(moduleCode).toMatch(
      /AMS_EXISTING_RUN_REQUIRED_FLAGS\.filter\(\(f\) => values\.has\(f\) === false\)/,
    );
    expect(moduleCode).not.toMatch(
      /presentExisting\.length !== AMS_EXISTING_RUN_FLAGS\.length/,
    );
  });

  it('does not emit any prohibited decision claim', () => {
    const combined = `${entrypointCode}\n${moduleCode}`;
    for (const forbidden of [
      'operator_final_decision_verified',
      'requested_action_validated_hold',
      'golden_json_embedded_run_id=true',
      'decision_authority=operator',
    ]) {
      expect(combined, `must not emit: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('scopes every accepted-events query by workspace, site and session', () => {
    // Static guard: a future edit that drops workspace_id would silently pool
    // two workspaces' events into one session's evidence and provenance.
    const atoms = stripComments(atomsSrc);
    const queries = atoms.match(/FROM accepted_events[\s\S]{0,400}?(?=`)/g) ?? [];
    expect(queries.length).toBeGreaterThanOrEqual(2);
    for (const q of queries) {
      expect(q, `accepted_events query must scope workspace_id: ${q.slice(0, 80)}`).toMatch(/workspace_id = \$1/);
      expect(q).toMatch(/site_id = \$2/);
      expect(q).toMatch(/session_id = \$3/);
    }
    // The id-sequence read must preserve canonical ordering.
    expect(atoms).toMatch(/ORDER BY received_at ASC, event_id ASC/);
  });

  it('makes no Policy Pass 2 authority claim in customer output', () => {
    const pkg = stripComments(packageSrc);
    expect(pkg).not.toMatch(/Policy Pass 2 final decision/);
    expect(pkg).not.toMatch(/sole final authority/i);
    expect(pkg).toMatch(/Authoritative AMS final decision/);
    expect(pkg).toMatch(/FINAL_DECISION_AUTHORITY = 'authoritative_ams_result' as const;/);
  });

  it('validates all three provenance sources independently before comparing them', () => {
    // Each source is validated on its own terms; agreement alone is not validity.
    expect(moduleCode).toMatch(/validateSourceEventIdSequence\(\s*input\.golden_source_event_ids/);
    expect(moduleCode).toMatch(/validateSourceEventIdSequence\(\s*input\.card_source_event_ids/);
    expect(moduleCode).toMatch(/validateSourceEventIdSequence\(\s*input\.accepted_event_ids/);
    // ...and all three pairwise comparisons are required.
    for (const reason of [
      'golden_json_and_persisted_card_source_event_ids_differ',
      'golden_json_and_accepted_events_source_event_ids_differ',
      'persisted_card_and_accepted_events_source_event_ids_differ',
    ]) {
      expect(moduleCode, `missing comparison: ${reason}`).toContain(reason);
    }
    // The entrypoint must supply the independent third source and candidates.
    expect(entrypointCode).toMatch(/readAcceptedEventIdSequence\(db, identity\)/);
    expect(entrypointCode).toMatch(/readRunCandidatesForSubject\(/);
  });

  it('passes exact session and workspace identity into Golden JSON validation', () => {
    expect(entrypointCode).toMatch(/session_id:\s*args\.session/);
    expect(entrypointCode).toMatch(/workspace_id:\s*args\.workspace/);
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
