/**
 * AMS Stage 0 — Hard-exclusion decision library (pure function, RECORD_ONLY).
 *
 * Product principle:
 *   AMS does not score every bot. Obvious high-confidence bot traffic is
 *   excluded BEFORE buyer-motion scoring. This module implements only the
 *   Stage 0 deterministic exclusion gate. Stage 1 behavioural scoring is
 *   intentionally unimplemented in this turn.
 *
 * Inputs:
 *   evaluate(evidence) where `evidence` is a SessionEvidence object whose
 *   shape is:
 *     {
 *       sessionId:      string,
 *       deterministic:  { webdriverFlag, automationGlobals, userAgentBotFamily,
 *                         nonBrowserRuntime, ... },
 *       requestSignals: { pathsVisited, maxEventsPerSecondSameBrowser,
 *                         pathLoopCount10m, zeroEngagementAcrossSession, ... }
 *     }
 *
 * Output:
 *   The two-stage decision JSON contract with Stage 1 fields nulled.
 *
 * Safety contract (verified by tests):
 *   - The engine NEVER reads a profile name from the evidence object.
 *   - The engine NEVER reads QA/test/synthetic/harness labels.
 *   - Missing signals do NOT fake an exclusion — they pass through to Stage 1.
 *   - Only HIGH-confidence rules trigger exclusion. Medium / low signals are
 *     deliberately left for Stage 1 (not yet implemented).
 */

'use strict';

const SCHEMA_VERSION = 1;

/* Probe / scanner path signatures — explicit allowlist of paths that are
   not part of any AMS-tracked site's surface. Matching one is a definitive
   non-buyer signal. */
const PROBE_PATH_PATTERNS = [
  /\/wp-admin\b/i, /\/wp-login\.php\b/i, /\/wp-content\b/i, /\/wp-includes\b/i,
  /\/xmlrpc\.php\b/i, /\/phpmyadmin\b/i, /\/admin\/login\b/i,
  /\/\.env\b/i, /\/\.git\//i, /\/\.svn\//i, /\/\.aws\//i, /\/\.htaccess\b/i,
  /\/server-status\b/i, /\/console\b/i, /\/_profiler\b/i, /\/cgi-bin\b/i,
  /\/config\.php\b/i
];

/* Bot UA family allowlist. The engine never sees raw UA strings; the upstream
   signal extractor maps to one of these normalised family labels. */
const KNOWN_BOT_UA_FAMILIES = new Set([
  'curl', 'wget', 'python_requests', 'go_http_client', 'java_http_client',
  'libwww_perl', 'phantomjs', 'headless_chrome', 'headless_firefox',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'bytespider', 'petalbot'
]);

const HIGH_VOLUME_REQUESTS_PER_SECOND_THRESHOLD = 20;
const PATH_LOOP_COUNT_THRESHOLD = 3;

/* Forbidden tokens — used by tests to verify the engine ignores QA/test/
   synthetic/harness labels. The lib itself never reads these, but the tests
   sweep the rule registry to ensure no label leaks into rule names. */
const FORBIDDEN_TOKENS = [
  'qa', 'test', 'synthetic', 'bot_label', 'adversary',
  'behaviour_qa', 'ams_qa', 'bad_traffic_qa', 'fixture', 'profile_name'
];

/**
 * Rule registry. Each rule is a pure function:
 *   (deterministic, requestSignals) => { reasonCode, confidence } | null
 *
 * Confidence vocabulary:
 *   - 'high'   — triggers Stage 0 exclusion. Single deterministic indicator
 *                or a deterministic-lock combination of indicators.
 *   - 'medium' — passes through to Stage 1. Logged but does not exclude.
 *   - 'low'    — passes through to Stage 1.
 */
const RULES = [
  {
    name: 'webdriver_global_present',
    fn(det) {
      if (det.webdriverFlag === true) {
        return { reasonCode: 'webdriver_global_present', confidence: 'high' };
      }
      return null;
    }
  },
  {
    name: 'automation_globals_detected',
    fn(det) {
      if (Array.isArray(det.automationGlobals) && det.automationGlobals.length > 0) {
        return { reasonCode: 'automation_globals_detected', confidence: 'high' };
      }
      return null;
    }
  },
  {
    name: 'known_bot_ua_family',
    fn(det) {
      if (typeof det.userAgentBotFamily === 'string' &&
          KNOWN_BOT_UA_FAMILIES.has(det.userAgentBotFamily)) {
        return { reasonCode: 'known_bot_ua_family', confidence: 'high' };
      }
      return null;
    }
  },
  {
    name: 'scanner_or_probe_path',
    fn(_det, req) {
      const paths = (req && Array.isArray(req.pathsVisited)) ? req.pathsVisited : [];
      for (const p of paths) {
        if (typeof p !== 'string') continue;
        for (const re of PROBE_PATH_PATTERNS) {
          if (re.test(p)) {
            return { reasonCode: 'scanner_or_probe_path', confidence: 'high' };
          }
        }
      }
      return null;
    }
  },
  {
    name: 'impossible_request_frequency',
    fn(_det, req) {
      const r = (req && typeof req.maxEventsPerSecondSameBrowser === 'number')
        ? req.maxEventsPerSecondSameBrowser : 0;
      if (r >= HIGH_VOLUME_REQUESTS_PER_SECOND_THRESHOLD) {
        return { reasonCode: 'impossible_request_frequency', confidence: 'high' };
      }
      return null;
    }
  },
  {
    /* Composite high-confidence flag set by the upstream signal extractor
       when a stack of weak hints converges (zero plugins + missing chrome
       object + abnormal screen + no localStorage support, etc.). The lib
       does NOT re-derive this from raw fingerprint inputs — it trusts the
       single boolean. Producing this flag is the upstream's responsibility. */
    name: 'non_browser_runtime',
    fn(det) {
      if (det.nonBrowserRuntime === true) {
        return { reasonCode: 'non_browser_runtime', confidence: 'high' };
      }
      return null;
    }
  },
  {
    name: 'attack_like_request_pattern',
    fn(_det, req) {
      const loopCount = (req && typeof req.pathLoopCount10m === 'number')
        ? req.pathLoopCount10m : 0;
      const zeroEngagement = req && req.zeroEngagementAcrossSession === true;
      if (loopCount >= PATH_LOOP_COUNT_THRESHOLD && zeroEngagement) {
        return { reasonCode: 'attack_like_request_pattern', confidence: 'high' };
      }
      return null;
    }
  }
];

function evaluate(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('SessionEvidence object required');
  }
  const det = evidence.deterministic || {};
  const req = evidence.requestSignals || {};

  const hits = [];
  for (const rule of RULES) {
    const hit = rule.fn(det, req);
    if (hit) hits.push(hit);
  }

  const highHits = hits.filter(h => h.confidence === 'high');
  const excluded = highHits.length > 0;
  const reasonCodes = highHits.map(h => h.reasonCode);

  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: evidence.sessionId || null,
    recordOnly: true,
    stage0HardExclusion: {
      excluded,
      confidence: excluded ? 'high' : null,
      reasonCodes,
      recommendedAction: excluded ? 'exclude_record_only' : 'allow_to_scoring'
    },
    stage1BehaviourScore: {
      eligibleForScoring: !excluded,
      /* Stage 1 deliberately not implemented in this turn. Explicit nulls
         so consumers cannot accidentally treat a missing field as a score. */
      riskScore: null,
      classification: null,
      reasonCodes: [],
      recommendedAction: null,
      evidence: [],
      missingSignals: excluded ? [] : ['stage1_not_yet_implemented']
    },
    decisionSummary: {
      finalRecordOnlyDecision: excluded ? 'exclude' : 'not_yet_evaluated',
      why: excluded
        ? reasonCodes.map(c => `Stage 0: ${c}`)
        : ['Stage 0 cleared. Stage 1 scoring not yet implemented.']
    }
  };
}

module.exports = {
  evaluate,
  RULES,
  SCHEMA_VERSION,
  KNOWN_BOT_UA_FAMILIES,
  PROBE_PATH_PATTERNS,
  HIGH_VOLUME_REQUESTS_PER_SECOND_THRESHOLD,
  PATH_LOOP_COUNT_THRESHOLD,
  FORBIDDEN_TOKENS
};
