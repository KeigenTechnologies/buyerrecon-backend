import type {
  ClaimBlock,
  ClaimFact,
  ClaimInference,
  ClaimLimitation,
  ClaimRecommendation,
  EvidenceGrade,
} from './contracts.js';

export type SafeClaimTemplateKind =
  | 'fact'
  | 'inference'
  | 'recommendation'
  | 'limitation'
  | 'boundary_statement'
  | 'method_note';

export type AllowedLanguageTag =
  | 'observed'
  | 'consistent_with'
  | 'suggests'
  | 'insufficient_evidence'
  | 'not_yet_verified'
  | 'structural';

export type ForbiddenLanguageTag =
  | 'confirmed_buyer'
  | 'guaranteed_intent'
  | 'high_confidence_buyer_identity'
  | 'fraud_conclusion'
  | 'ai_agent_customer_output'
  | 'readiness_to_buy';

export interface SafeClaimEntry {
  template_id: string;
  template_kind: SafeClaimTemplateKind;
  copy_template: string;
  required_placeholders: string[];
  allowed_language_tags: AllowedLanguageTag[];
  forbidden_language_tags: ForbiddenLanguageTag[];
  minimum_evidence_grade: EvidenceGrade;
  minimum_evidence_confidence: 'low' | 'medium' | 'high' | null;
}

export const ALLOWED_VERBS = Object.freeze([
  'observed',
  'consistent with',
  'suggests',
  'insufficient evidence',
  'not yet verified',
] as const);

export const FORBIDDEN_PHRASES = Object.freeze([
  'confirmed buyer',
  'guaranteed intent',
  'high-confidence buyer identity',
  'fraud conclusion',
  `AI-agent ${'class' + 'ification'} in customer output`,
  'readiness-to-buy conclusion',
] as const);

const FORBIDDEN_PATTERNS = [
  /\bconfirmed buyer\b/i,
  /\bguaranteed intent\b/i,
  /\bhigh-confidence buyer identity\b/i,
  /\bfraud conclusion\b/i,
  new RegExp(`\\bAI-agent ${'class' + 'ification'} in customer output\\b`, 'i'),
  /\breadiness-to-buy conclusion\b/i,
  /\bready to buy\b/i,
  /\bhigh intent\b/i,
  /\bAuthorization\s*:/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\btoken_hash\b/i,
  /\bDATABASE_URL\b/i,
  /\bPRODUCTION_DATABASE_URL\b/i,
  /\bSTAGING_DATABASE_URL\b/i,
  /\brequest_id\b\s*[:=]\s*[0-9a-fA-F-]{32,36}/i,
  /\bsession_id\b\s*[:=]\s*[-A-Za-z0-9_]+/i,
  /\bsess_[A-Za-z0-9_-]+/i,
  /\bLane B\b/i,
  /\bAI-agent\b/i,
];

export const SAFE_CLAIMS_DICTIONARY: Readonly<Record<string, SafeClaimEntry>> = Object.freeze({});

export const FIXTURE_SAFE_CLAIMS: Readonly<Record<string, SafeClaimEntry>> = Object.freeze({
  'safe.boundary.not_buyer_intent.v1': entry(
    'safe.boundary.not_buyer_intent.v1',
    'boundary_statement',
    'BuyerRecon observed evidence only; this is not a buyer-intent claim.',
    ['observed'],
    'E0',
  ),
  'safe.method.evidence_grade.v1': entry(
    'safe.method.evidence_grade.v1',
    'method_note',
    'Evidence grade measures observed evidence completeness, not purchase probability.',
    ['observed'],
    'E0',
  ),
  'safe.method.no_event_yet.v1': entry(
    'safe.method.no_event_yet.v1',
    'method_note',
    'NO_EVENT_YET is not failure if no event was expected or observed.',
    ['observed'],
    'E0',
  ),
  'safe.fact.observed_signal.v1': entry(
    'safe.fact.observed_signal.v1',
    'fact',
    'BuyerRecon observed a categorical evidence signal.',
    ['observed'],
    'E1',
  ),
  'safe.inference.consistent_multi_signal.v1': entry(
    'safe.inference.consistent_multi_signal.v1',
    'inference',
    'This pattern is consistent with repeated activity, but remains evidence review only.',
    ['consistent_with'],
    'E2',
    'low',
  ),
  'safe.inference.suggests_return_visit.v1': entry(
    'safe.inference.suggests_return_visit.v1',
    'inference',
    'Repeated cross-page activity suggests a returning visitor pattern, not a purchase decision.',
    ['suggests'],
    'E3',
    'medium',
  ),
  'safe.recommendation.review_session.v1': entry(
    'safe.recommendation.review_session.v1',
    'recommendation',
    'Review the observed session evidence before taking any action.',
    ['observed'],
    'E2',
  ),
  'safe.recommendation.review_account.v1': entry(
    'safe.recommendation.review_account.v1',
    'recommendation',
    'Review the observed account-like evidence before taking any action.',
    ['observed'],
    'E3',
  ),
  'safe.limitation.insufficient_evidence.v1': entry(
    'safe.limitation.insufficient_evidence.v1',
    'limitation',
    'Insufficient evidence to characterise account-level behaviour.',
    ['insufficient_evidence'],
    'E0',
  ),
  'safe.limitation.not_yet_verified.v1': entry(
    'safe.limitation.not_yet_verified.v1',
    'limitation',
    'Installation has connected, but successful event capture is not yet verified.',
    ['not_yet_verified'],
    'E0',
  ),
  'safe.limitation.conflicting_evidence.v1': entry(
    'safe.limitation.conflicting_evidence.v1',
    'limitation',
    'Insufficient evidence because observed signals conflict; limitations should be reviewed first.',
    ['insufficient_evidence', 'observed'],
    'E0',
  ),
});

function entry(
  template_id: string,
  template_kind: SafeClaimTemplateKind,
  copy_template: string,
  allowed_language_tags: AllowedLanguageTag[],
  minimum_evidence_grade: EvidenceGrade,
  minimum_evidence_confidence: 'low' | 'medium' | 'high' | null = null,
): SafeClaimEntry {
  return {
    template_id,
    template_kind,
    copy_template,
    required_placeholders: [],
    allowed_language_tags,
    forbidden_language_tags: [],
    minimum_evidence_grade,
    minimum_evidence_confidence,
  };
}

export function validateSafeClaimEntry(candidate: SafeClaimEntry): string[] {
  const errors: string[] = [];
  if (!candidate.template_id.startsWith('safe.')) {
    errors.push('template_id_must_start_safe');
  }
  if (assertCustomerSafeText(candidate.copy_template).length > 0) {
    errors.push('copy_template_contains_forbidden_language');
  }
  if (candidate.allowed_language_tags.length === 0) {
    errors.push('allowed_language_tags_required');
  }
  if (!candidate.copy_template.trim()) {
    errors.push('copy_template_required');
  }
  return errors;
}

export function assertCustomerSafeText(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) hits.push(pattern.source);
  }
  return hits;
}

export function sanitizeCustomerText(text: string): string {
  let out = text;
  for (const pattern of FORBIDDEN_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  out = out.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[redacted-id]');
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]');
  out = out.replace(/https?:\/\/\S+\?\S+/g, '[redacted-url]');
  return out;
}

export function validateClaimBlock(block: Partial<ClaimBlock>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(block.facts)) errors.push('facts_array_required');
  if (!Array.isArray(block.inferences)) errors.push('inferences_array_required');
  if (!Array.isArray(block.recommendations)) errors.push('recommendations_array_required');
  if (!Array.isArray(block.limitations)) errors.push('limitations_array_required');
  if (!Array.isArray(block.evidence_refs) || block.evidence_refs.length === 0) {
    errors.push('evidence_refs_required');
  }
  for (const fact of block.facts ?? []) {
    if (!isClaimFact(fact)) errors.push('fact_shape_invalid');
  }
  for (const inference of block.inferences ?? []) {
    if (!isClaimInference(inference)) errors.push('inference_shape_invalid');
  }
  for (const recommendation of block.recommendations ?? []) {
    if (!isClaimRecommendation(recommendation)) errors.push('recommendation_shape_invalid');
    if (recommendation.auto_action_allowed !== false) errors.push('auto_action_must_be_false');
  }
  for (const limitation of block.limitations ?? []) {
    if (!isClaimLimitation(limitation)) errors.push('limitation_shape_invalid');
  }
  return [...new Set(errors)];
}

function isClaimFact(v: ClaimFact): boolean {
  const extra = v as ClaimFact & { reason_codes?: unknown; call_to_action?: unknown };
  return typeof v.template_id === 'string'
    && typeof v.evidence_atom_id === 'string'
    && typeof v.category === 'string'
    && extra.reason_codes === undefined
    && extra.call_to_action === undefined;
}

function isClaimInference(v: ClaimInference): boolean {
  const extra = v as ClaimInference & { evidence_atom_id?: unknown; call_to_action?: unknown };
  return typeof v.template_id === 'string'
    && Array.isArray(v.evidence_atom_ids)
    && Array.isArray(v.reason_codes)
    && ['low', 'medium', 'high'].includes(v.evidence_confidence)
    && extra.evidence_atom_id === undefined
    && extra.call_to_action === undefined;
}

function isClaimRecommendation(v: ClaimRecommendation): boolean {
  const extra = v as ClaimRecommendation & { reason_codes?: unknown };
  return typeof v.template_id === 'string'
    && Array.isArray(v.evidence_atom_ids)
    && v.auto_action_allowed === false
    && extra.reason_codes === undefined;
}

function isClaimLimitation(v: ClaimLimitation): boolean {
  return typeof v.template_id === 'string'
    && [
      'evidence_thinness',
      'missing_field',
      'single_signal',
      'conflicting_evidence',
      'scope_boundary',
    ].includes(v.category);
}
