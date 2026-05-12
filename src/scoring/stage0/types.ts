/**
 * Sprint 2 PR#5 — Stage 0 type contract.
 *
 * Track B (BuyerRecon Evidence Foundation). Pure TypeScript types
 * shared between the SQL extractor, the pure evaluator, and the DB
 * worker. No DB import here. No runtime side effects.
 */

/**
 * Stage 0 rule identifier enum. Values mirror the upstream Track A
 * rule names plus the sentinel for non-excluded sessions.
 *
 * IMPORTANT: this is a Stage-0-specific identifier set. It is NOT a
 * reason_code from `scoring/reason_code_dictionary.yml`. PR#4's
 * `validateRuleReferences` is NOT invoked on these values.
 */
export type Stage0RuleId =
  | 'no_stage0_exclusion'
  | 'webdriver_global_present'
  | 'automation_globals_detected'
  | 'known_bot_ua_family'
  | 'scanner_or_probe_path'
  | 'impossible_request_frequency'
  | 'non_browser_runtime'
  | 'attack_like_request_pattern';

export const STAGE0_RULE_IDS: readonly Stage0RuleId[] = [
  'no_stage0_exclusion',
  'webdriver_global_present',
  'automation_globals_detected',
  'known_bot_ua_family',
  'scanner_or_probe_path',
  'impossible_request_frequency',
  'non_browser_runtime',
  'attack_like_request_pattern',
];

/**
 * Stage0Input is the BuyerRecon-side shape that the SQL extractor
 * produces. It is converted to the upstream `SessionEvidence` shape
 * by the BuyerRecon adapter (see evaluate-stage0.ts) before being
 * passed to the vendored Track A evaluator.
 *
 * Privacy boundary (per OD-11): the raw user_agent (HTTP header
 * value) is consumed only during the extractor's UA→family
 * normalisation and MUST NOT appear in any persisted column. The
 * field below — `userAgentFamily` — is the normalised label only.
 */
export interface Stage0Input {
  workspaceId:                   string;
  siteId:                        string;
  sessionId:                     string;

  /**
   * Normalised user-agent family label, derived from the raw UA on
   * `ingest_requests.user_agent` via the heuristic in
   * `extract-stage0-inputs.ts`. Examples: `'curl'`, `'wget'`,
   * `'python_requests'`, `'headless_chrome'`, `'bytespider'`,
   * `'gptbot'`, `'browser'` (catch-all for normal browsers).
   *
   * The BuyerRecon adapter applies the P-11 AI-crawler taxonomy
   * correction by mapping declared AI / search crawlers (e.g.
   * `'bytespider'`) to `null` BEFORE the vendored evaluator runs, so
   * the `known_bot_ua_family` rule does not fire on them.
   */
  userAgentFamily:               string | null;

  /**
   * page_view path list aggregated from accepted_events.
   * Path values only — never full URLs. Order is event order
   * (received_at ASC, event_id ASC) for determinism.
   */
  pathsVisited:                  string[];

  /**
   * Max events-per-second observed for the session (Stage 0 rule
   * `impossible_request_frequency` fires at >= 20).
   */
  maxEventsPerSecondSameBrowser: number;

  /**
   * Same-path consecutive page_view count within the session, used
   * for the `attack_like_request_pattern` rule (>=3 + zero engagement).
   */
  pathLoopCount10m:              number;

  /**
   * TRUE iff the session contains no `cta_click` / `form_start` /
   * `form_submit` events. Used by `attack_like_request_pattern`.
   */
  zeroEngagementAcrossSession:   boolean;

  /**
   * Total accepted_events count for the session (recorded on the row
   * as `source_event_count` for provenance/replay).
   */
  sourceEventCount:              number;

  /**
   * Evidence references back to the factual layer (for replay).
   * Each entry is `{ table, primary_key }`. PR#5 emits at most a
   * compact set (typically just `{ table: 'accepted_events', range:
   * [first_event_id, last_event_id] }`) — never raw payload values.
   */
  evidenceRefs:                  Array<{ table: string; [k: string]: unknown }>;
}

/**
 * Stage0Output is the verdict the evaluator returns. Shape is the
 * BuyerRecon-side projection; Stage 1 envelope fields from the
 * upstream are discarded.
 */
export interface Stage0Output {
  excluded:      boolean;
  ruleId:        Stage0RuleId;
  /**
   * Minimised inputs object persisted to `stage0_decisions.rule_inputs`.
   *
   * Helen-signed OD-11 allowlist (the ONLY keys PR#5 may persist):
   *   - matched_rule_id           — mirrors the top-level rule_id
   *   - user_agent_family         — normalised family label (never raw UA)
   *   - matched_family            — set only when known_bot_ua_family fires
   *   - ua_source                 — provenance label, e.g. 'ingest_requests'
   *   - path_pattern_matched      — canonical path string when probe-path fires
   *   - events_per_second         — request-signal number
   *   - path_loop_count           — request-signal number
   *   - signal_confidence_bucket  — optional upstream confidence ('high')
   *
   * Forbidden persisted keys (HARD; swept by tests + verification SQL):
   *   raw_user_agent, user_agent (raw), token_hash, ip_hash, pepper,
   *   bearer, authorization, raw_payload, raw_request_body,
   *   request_body, canonical_jsonb, raw_page_url, matched_rules
   *   (array form), ai_crawler_passthrough, zero_engagement.
   *
   * The AI-crawler / Bytespider P-11 carve-out is INTERNAL pre-eval
   * logic; it never produces a persisted boolean. Lane B declared-agent
   * facts are re-derived by the future PR#3b Lane B observer.
   */
  ruleInputs:    Record<string, unknown>;
  evidenceRefs:  Array<{ table: string; [k: string]: unknown }>;
}

/**
 * The full row shape inserted into `stage0_decisions`. The DB worker
 * builds this from a Stage0Input + Stage0Output + the scoring contract
 * versions; the migration's CHECK constraints enforce the shape at
 * the DB layer.
 */
export interface Stage0DecisionRow {
  workspace_id:        string;
  site_id:             string;
  session_id:          string;
  stage0_version:      string;
  scoring_version:     string;
  excluded:            boolean;
  rule_id:             Stage0RuleId;
  rule_inputs:         Record<string, unknown>;
  evidence_refs:       Array<{ table: string; [k: string]: unknown }>;
  record_only:         true;
  source_event_count:  number;
}
