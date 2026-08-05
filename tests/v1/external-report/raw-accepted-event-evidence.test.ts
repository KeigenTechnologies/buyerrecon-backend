import { describe, expect, it } from 'vitest';

import {
  buildFullSessionRawEvidence,
  readRawAcceptedEventEvidence,
  resolveSemanticEvent,
  type GoldenSessionDbClient,
  type RawAcceptedEventRow,
} from '../../../src/reports/external/session-evidence-atoms.js';

// ---------------------------------------------------------------------------
// PRODUCTION-SHAPED fixture: the real Golden Session wire shape, not synthetic
// already-normalised rows.
//
// Every row carries event_name="unknown" (the canonical "not populated"
// sentinel), the semantic type in legacy_event_type, the transport sentinel
// "track" in event_type, and the route in raw.path with raw.page_path ABSENT.
//
// Route steps come from semantic page_view events only, so session_start,
// page_state and form_start rows contribute no route step even though several
// of them share a path with a genuine page view.

export const GOLDEN_SESSION_RAW_EVENTS: ReadonlyArray<RawAcceptedEventRow> = Object.freeze([
  { event_id: 51, received_at: '2026-07-24T19:40:00.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'session_start', path: '/en', page_path: null },
  { event_id: 52, received_at: '2026-07-24T19:40:01.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en', page_path: null },
  { event_id: 53, received_at: '2026-07-24T19:40:12.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en/product', page_path: null },
  { event_id: 54, received_at: '2026-07-24T19:40:20.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'cta_click', path: '/en/product', page_path: null },
  { event_id: 55, received_at: '2026-07-24T19:40:31.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 56, received_at: '2026-07-24T19:40:44.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_state', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 57, received_at: '2026-07-24T19:40:52.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'form_start', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 58, received_at: '2026-07-24T19:41:03.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_state', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 59, received_at: '2026-07-24T19:41:15.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en', page_path: null },
]);

export const EXPECTED_ROUTE = Object.freeze([
  '/en',
  '/en/product',
  '/en/buyer-motion-evidence-report',
  '/en',
]);

const row = (over: Partial<RawAcceptedEventRow>): RawAcceptedEventRow => ({
  event_id: 99,
  received_at: '2026-07-24T19:40:00.000Z',
  event_type: 'track',
  event_name: null,
  legacy_event_type: null,
  path: null,
  page_path: null,
  ...over,
});

// ---------------------------------------------------------------------------
// Canonical route projection

describe('canonical route projection', () => {
  it('recognises raw.path as the primary route source', () => {
    expect(resolveSemanticEvent(row({ path: '/en/product' })).page_path).toBe('/en/product');
  });

  it('keeps raw.page_path as a working fallback', () => {
    expect(resolveSemanticEvent(row({ path: null, page_path: '/legacy' })).page_path).toBe('/legacy');
  });

  it('prefers raw.path when both are present', () => {
    const resolved = resolveSemanticEvent(row({ path: '/primary', page_path: '/legacy' }));
    expect(resolved.page_path).toBe('/primary');
  });

  it('treats an empty raw.path as absent and falls back to raw.page_path', () => {
    expect(resolveSemanticEvent(row({ path: '', page_path: '/legacy' })).page_path).toBe('/legacy');
  });

  it('treats both empty as no route at all', () => {
    expect(resolveSemanticEvent(row({ path: '', page_path: '' })).page_path).toBeNull();
    expect(resolveSemanticEvent(row({})).page_path).toBeNull();
  });

  it('never substitutes an unrelated field for the route', () => {
    const resolved = resolveSemanticEvent(
      row({ path: null, page_path: null, event_name: 'page_view' }) as RawAcceptedEventRow,
    );
    expect(resolved.page_path).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Canonical semantic event-type resolution

describe('canonical semantic event-type resolution', () => {
  it('falls back to legacy_event_type when event_name is the literal "unknown"', () => {
    const resolved = resolveSemanticEvent(row({ event_name: 'unknown', legacy_event_type: 'page_view' }));
    expect(resolved.semantic_event_type).toBe('page_view');
    expect(resolved.semantic_source).toBe('legacy_event_type');
  });

  it('falls back to legacy_event_type when event_name is null', () => {
    const resolved = resolveSemanticEvent(row({ event_name: null, legacy_event_type: 'form_start' }));
    expect(resolved.semantic_event_type).toBe('form_start');
    expect(resolved.semantic_source).toBe('legacy_event_type');
  });

  it('falls back to legacy_event_type when event_name is the empty string', () => {
    const resolved = resolveSemanticEvent(row({ event_name: '', legacy_event_type: 'cta_click' }));
    expect(resolved.semantic_event_type).toBe('cta_click');
    expect(resolved.semantic_source).toBe('legacy_event_type');
  });

  it('keeps a populated semantic event_name authoritative', () => {
    const resolved = resolveSemanticEvent(row({ event_name: 'page_view', legacy_event_type: 'form_start' }));
    expect(resolved.semantic_event_type).toBe('page_view');
    expect(resolved.semantic_source).toBe('event_name');
  });

  it('matches the "unknown" sentinel case-sensitively, exactly as the canonical SQL does', () => {
    // Canonical: NULLIF(raw->>'event_name', 'unknown') — case-SENSITIVE. So
    // "UNKNOWN" is not the sentinel and is taken at face value. Documented here
    // rather than normalised, to avoid inventing a rule the canonical SQL lacks.
    const upper = resolveSemanticEvent(row({ event_name: 'UNKNOWN', legacy_event_type: 'page_view' }));
    expect(upper.semantic_event_type).toBe('UNKNOWN');
    expect(upper.semantic_source).toBe('event_name');
    // ...and since it is not 'page_view', it contributes no route step.
    expect(buildFullSessionRawEvidence([row({ event_name: 'UNKNOWN', legacy_event_type: 'page_view', path: '/en' })]).route_progression).toEqual([]);
  });

  it('never lets the transport event_type stand in for the semantic type', () => {
    // "track" is transport, not semantics: with no usable event_name and no
    // legacy_event_type the row is unresolved, and it must never override a
    // legacy_event_type that IS present.
    expect(resolveSemanticEvent(row({ event_type: 'track' })).semantic_event_type).toBeNull();
    expect(resolveSemanticEvent(row({ event_type: 'track' })).semantic_source).toBe('unresolved');

    const withLegacy = resolveSemanticEvent(row({ event_type: 'track', legacy_event_type: 'page_view' }));
    expect(withLegacy.semantic_event_type).toBe('page_view');
    expect(withLegacy.semantic_source).toBe('legacy_event_type');

    // Even a non-sentinel transport value is not a semantic source.
    expect(resolveSemanticEvent(row({ event_type: 'page_view' })).semantic_event_type).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Production-shaped full-session evidence

describe('full-session raw evidence from production-shaped events', () => {
  const evidence = buildFullSessionRawEvidence(GOLDEN_SESSION_RAW_EVENTS);

  it('derives the exact four-step route', () => {
    expect(evidence.route_progression).toEqual([...EXPECTED_ROUTE]);
  });

  it('does not add duplicate steps for non-route events sharing a path', () => {
    // 55 page_view, 56 page_state, 57 form_start and 58 page_state all sit on
    // the report path; only the page_view contributes a step.
    expect(evidence.route_progression.filter((p) => p === '/en/buyer-motion-evidence-report')).toHaveLength(1);
    expect(evidence.route_progression).toHaveLength(4);
  });

  it('derives event-57 form start, no submit, and abandonment', () => {
    expect(evidence.form_evidence).toEqual({
      form_start_event_id: 57,
      form_started: true,
      form_submit: false,
      form_abandon_after_start: true,
    });
  });

  it('keeps every supporting event id in canonical order', () => {
    expect(evidence.source_event_ids).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59]);
    expect(evidence.event_count).toBe(9);
  });

  it('attributes semantics truthfully to legacy_event_type, not to event_name', () => {
    expect(evidence.semantic_source_counts).toEqual({
      event_name: 0,
      legacy_event_type: 9,
      unresolved: 0,
    });
  });

  it('does not modify the source rows', () => {
    const before = JSON.stringify(GOLDEN_SESSION_RAW_EVENTS);
    buildFullSessionRawEvidence(GOLDEN_SESSION_RAW_EVENTS);
    expect(JSON.stringify(GOLDEN_SESSION_RAW_EVENTS)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// The read itself

describe('raw accepted-event read', () => {
  it('projects raw.path and raw.page_path, SELECT-only, scoped, ordered, bounded', async () => {
    const seen: Array<{ text: string; values: ReadonlyArray<string> }> = [];
    const db: GoldenSessionDbClient = {
      query: async (text: string, values: ReadonlyArray<string>) => {
        seen.push({ text, values });
        return { rows: [] };
      },
    };
    await readRawAcceptedEventEvidence(db, {
      workspace_id: 'buyerrecon_staging_ws',
      project_id: 'proj',
      site_id: 'buyerrecon_com',
      session_id: 'ses_x0vrbqik',
      window_start: '2026-07-24T00:00:00Z',
      window_end: '2026-07-24T23:59:59Z',
    });
    const q = seen[0];
    expect(q.text).toMatch(/raw->>'path' AS path/);
    expect(q.text).toMatch(/raw->>'page_path' AS page_path/);
    expect(q.text).toMatch(/raw->>'legacy_event_type' AS legacy_event_type/);
    expect(q.text.trimStart().startsWith('SELECT')).toBe(true);
    expect(/\b(INSERT|UPDATE|DELETE|UPSERT|COPY|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(q.text)).toBe(false);
    expect(q.text).toMatch(/workspace_id = \$1/);
    expect(q.text).toMatch(/site_id = \$2/);
    expect(q.text).toMatch(/session_id = \$3/);
    expect(q.text).toMatch(/ORDER BY received_at ASC, event_id ASC/);
    expect(q.text).toMatch(/LIMIT \d+/);
    expect(q.values.slice(0, 3)).toEqual(['buyerrecon_staging_ws', 'buyerrecon_com', 'ses_x0vrbqik']);
  });
});
