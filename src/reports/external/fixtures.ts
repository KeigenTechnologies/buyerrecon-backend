import { EXTERNAL_REPORT_SCHEMA_VERSION, type EvidenceAtom } from './contracts.js';
import type { ExternalReportInput } from './builders.js';

const base = {
  workspace_id: 'workspace_demo',
  project_id: 'project_demo',
  site_id: 'buyerrecon.example',
  generated_at: '2026-05-24T12:00:00Z',
  window_start: '2026-05-24T11:30:00Z',
  window_end: '2026-05-24T12:00:00Z',
  window_kind: 'first_value' as const,
};

export const EXTERNAL_REPORT_FIXTURES: Readonly<Record<string, ExternalReportInput>> = Object.freeze({
  empty_state: {
    ...base,
    snapshot_id: 'snapshot_empty_state',
    collector_reachability: 'unknown',
    ingest_request_count: 0,
    accepted_event_count: 0,
    sessions: [],
  },
  connected_no_data: {
    ...base,
    snapshot_id: 'snapshot_connected_no_data',
    collector_reachability: 'reachable',
    ingest_request_count: 0,
    accepted_event_count: 0,
    sessions: [],
  },
  single_session: {
    ...base,
    snapshot_id: 'snapshot_single_session',
    collector_reachability: 'reachable',
    ingest_request_count: 3,
    accepted_event_count: 3,
    sessions: [{
      session_ref: 'session_display_alpha',
      session_started_at: '2026-05-24T11:45:00Z',
      session_ended_at: '2026-05-24T11:55:00Z',
      atoms: [
        atom('atom_single_navigation', 'navigation', 'pricing_page', 'E2'),
        atom('atom_single_visibility', 'visibility', 'visible', 'E2'),
        atom('atom_single_dwell', 'dwell', 'medium_duration', 'E2', 42000),
      ],
    }],
  },
  weak_account_evidence: {
    ...base,
    snapshot_id: 'snapshot_weak_account',
    collector_reachability: 'reachable',
    ingest_request_count: 4,
    accepted_event_count: 4,
    sessions: [
      {
        session_ref: 'session_display_beta',
        session_started_at: '2026-05-24T10:10:00Z',
        session_ended_at: '2026-05-24T10:12:00Z',
        atoms: [atom('atom_weak_a', 'navigation', 'home_page', 'E1')],
      },
      {
        session_ref: 'session_display_gamma',
        session_started_at: '2026-05-24T11:10:00Z',
        session_ended_at: '2026-05-24T11:12:00Z',
        atoms: [atom('atom_weak_b', 'navigation', 'pricing_page', 'E1')],
      },
    ],
    accounts: [{
      account_ref: 'account_display_beta',
      first_seen_at: '2026-05-24T10:10:00Z',
      last_seen_at: '2026-05-24T11:12:00Z',
      sessions: [],
    }],
  },
  repeated_account_pattern: {
    ...base,
    snapshot_id: 'snapshot_repeated_account',
    collector_reachability: 'reachable',
    ingest_request_count: 15,
    accepted_event_count: 15,
    sessions: Array.from({ length: 5 }, (_, i) => ({
      session_ref: `session_display_repeat_${i + 1}`,
      session_started_at: `2026-05-2${i}T10:00:00Z`,
      session_ended_at: `2026-05-2${i}T10:08:00Z`,
      atoms: [
        atom(`atom_repeat_${i}_nav`, 'navigation', 'product_page', 'E2'),
        atom(`atom_repeat_${i}_visibility`, 'visibility', 'visible', 'E2'),
        atom(`atom_repeat_${i}_auth`, 'auth', 'anonymous_ok', 'E2'),
        atom(`atom_repeat_${i}_dwell`, 'dwell', 'long_duration', 'E2', 86000),
      ],
    })),
    accounts: [{
      account_ref: 'account_display_repeat',
      first_seen_at: '2026-05-20T10:00:00Z',
      last_seen_at: '2026-05-24T10:08:00Z',
      sessions: [],
    }],
  },
  conflicting_evidence: {
    ...base,
    snapshot_id: 'snapshot_conflicting',
    collector_reachability: 'reachable',
    ingest_request_count: 3,
    accepted_event_count: 3,
    sessions: [{
      session_ref: 'session_display_conflict',
      session_started_at: '2026-05-24T11:45:00Z',
      session_ended_at: '2026-05-24T11:48:00Z',
      conflicting_evidence: true,
      atoms: [
        atom('atom_conflict_navigation', 'navigation', 'many_pages', 'E2'),
        atom('atom_conflict_visibility', 'visibility', 'hidden', 'E2'),
        atom('atom_conflict_dwell', 'dwell', 'long_background_duration', 'E2', 120000),
      ],
    }],
  },
});

function atom(
  atom_id: string,
  category: string,
  facet: string,
  evidence_grade: EvidenceAtom['evidence_grade'],
  numeric_value: number | null = null,
): EvidenceAtom {
  return {
    atom_id,
    workspace_id: base.workspace_id,
    project_id: base.project_id,
    site_id: base.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    source_type: 'thinlayer_event',
    source_ref: `source_${atom_id}`,
    observed_at: base.generated_at,
    recorded_at: base.generated_at,
    category,
    facet,
    numeric_value,
    evidence_grade,
    is_complete: true,
    null_fields: [],
    ingest_reason_codes: ['accepted'],
  };
}
