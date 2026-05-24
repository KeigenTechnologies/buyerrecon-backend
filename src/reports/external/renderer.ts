import type {
  AccountEvidenceCard,
  ClaimBlock,
  ClaimLimitation,
  ClaimRecommendation,
  EvidenceGrade,
  ReportSnapshot,
  SessionEvidenceCard,
} from './contracts.js';
import { FIXTURE_SAFE_CLAIMS, sanitizeCustomerText } from './safe-claims.js';

export function renderReportMarkdown(snapshot: ReportSnapshot): string {
  const out: string[] = [];
  out.push('# BuyerRecon Evidence Review');
  out.push('');
  out.push('Local fixture/report-contract MVP only. Not production activation. Not customer-output activation.');
  out.push('');
  out.push('## System status');
  out.push('');
  out.push(`- Installation status: ${safe(snapshot.system_status.installation_status)}`);
  out.push(`- First-value state: ${safe(snapshot.system_status.first_value_state)}`);
  out.push(`- Collector reachability: ${safe(snapshot.system_status.collector_reachability)}`);
  out.push(`- Last event observed: ${safe(snapshot.system_status.last_event_at ?? 'none')}`);
  out.push('');
  out.push('## First-value evidence');
  out.push('');
  out.push(`- Activity count: ${snapshot.first_value_evidence.past_30min_activity_count}`);
  if (snapshot.is_no_event_yet) {
    out.push('- NO_EVENT_YET is not failure if no event was expected or observed.');
  }
  out.push('- BuyerRecon observed evidence only; this is not a buyer-intent claim.');
  out.push('');
  out.push('## Session evidence');
  out.push('');
  if (snapshot.session_evidence_cards.length === 0) {
    out.push('- No session evidence cards are present for this window.');
  } else {
    for (const card of snapshot.session_evidence_cards) {
      renderSessionCard(
        out,
        card,
        snapshot.flags_snapshot.show_evidence_grade,
        snapshot.flags_snapshot.show_recommendations,
      );
    }
  }
  out.push('');
  out.push('## Account evidence');
  out.push('');
  if (!snapshot.flags_snapshot.show_account_inference) {
    out.push('- Account inference rendering is disabled by feature flag.');
  }
  if (snapshot.account_evidence_cards.length === 0) {
    out.push('- No account evidence cards are present for this window.');
  } else {
    for (const card of snapshot.account_evidence_cards) {
      renderAccountCard(
        out,
        card,
        snapshot.flags_snapshot.show_evidence_grade,
        snapshot.flags_snapshot.show_recommendations,
      );
    }
  }
  out.push('');
  out.push('## Buyer-motion timeline');
  out.push('');
  if (snapshot.buyer_motion_timeline.length === 0) {
    out.push('- No timeline nodes are present for this window.');
  } else {
    for (const node of snapshot.buyer_motion_timeline) {
      out.push(`- ${safe(node.occurred_at)} — ${safe(node.node_kind)}`);
    }
  }
  out.push('');
  out.push('## Limitations');
  out.push('');
  renderLimitations(out, snapshot.limitations);
  out.push('');
  out.push('## Recommended next steps');
  out.push('');
  if (!snapshot.flags_snapshot.show_recommendations) {
    out.push('- Recommendations are suppressed by feature flag.');
  } else {
    renderRecommendations(out, snapshot.recommended_next_steps);
  }
  out.push('');
  out.push('## Method note');
  out.push('');
  out.push('- Evidence grade measures observed evidence completeness, not purchase probability.');
  out.push('- Evidence shown here is categorical, redacted, and template-bound.');
  out.push('- No raw request IDs, raw session IDs, payloads, secrets, or internal Lane B labels are rendered.');
  out.push('');
  out.push('## Governance boundary');
  out.push('');
  out.push('- PR#18ab locks remain in force: no runtime scoring, no Lane writer, no customer claim upgrade.');
  out.push('- Gate 4C remains unapproved; this report renderer does not flip endpointUrl or generate production traffic.');
  return out.map(safeLine).join('\n');
}

function renderSessionCard(
  out: string[],
  card: SessionEvidenceCard,
  showGrade: boolean,
  showRecommendations: boolean,
): void {
  out.push(`### Session ${safe(card.session_ref)}`);
  if (showGrade) out.push(`- Evidence grade: ${gradeLabel(card.evidence_grade)}`);
  renderClaimBlock(out, card.claim_block, true, showRecommendations);
  if (card.conflicting_evidence) {
    out.push('- Limitation priority: observed signals conflict; review limitations before interpreting activity.');
  }
}

function renderAccountCard(
  out: string[],
  card: AccountEvidenceCard,
  showGrade: boolean,
  showRecommendations: boolean,
): void {
  out.push(`### Account ${safe(card.account_ref)}`);
  out.push(`- Sessions observed: ${card.session_count}`);
  if (showGrade) out.push(`- Evidence grade: ${gradeLabel(card.evidence_grade)}`);
  renderClaimBlock(out, card.claim_block, card.account_inference_visible, showRecommendations);
}

function renderClaimBlock(
  out: string[],
  block: ClaimBlock,
  renderInferences: boolean,
  renderRecommendationsEnabled: boolean,
): void {
  out.push('- Facts:');
  if (block.facts.length === 0) out.push('  - No facts available.');
  for (const fact of block.facts) out.push(`  - ${safe(fact.category)}`);
  out.push('- Inferences:');
  if (!renderInferences || block.inferences.length === 0) {
    out.push('  - Inferences suppressed or unavailable.');
  } else {
    for (const inference of block.inferences) {
      out.push(`  - ${templateText(inference.template_id)} Evidence confidence: ${safe(inference.evidence_confidence)}.`);
    }
  }
  out.push('- Recommendations:');
  if (!renderRecommendationsEnabled) {
    out.push('  - Recommendations suppressed by feature flag.');
  } else if (block.recommendations.length === 0) {
    out.push('  - No recommendations available.');
  }
  for (const recommendation of block.recommendations) {
    if (!renderRecommendationsEnabled || recommendation.auto_action_allowed !== false) continue;
    out.push(`  - ${templateText(recommendation.template_id)}`);
  }
  out.push('- Limitations:');
  if (block.limitations.length === 0) out.push('  - No additional limitations recorded.');
  for (const limitation of block.limitations) out.push(`  - ${templateText(limitation.template_id)}`);
}

function renderLimitations(out: string[], limitations: ClaimLimitation[]): void {
  if (limitations.length === 0) {
    out.push('- No additional limitations recorded.');
    return;
  }
  for (const limitation of limitations) out.push(`- ${templateText(limitation.template_id)}`);
}

function renderRecommendations(out: string[], recommendations: ClaimRecommendation[]): void {
  if (recommendations.length === 0) {
    out.push('- No recommendations available.');
    return;
  }
  for (const recommendation of recommendations) {
    if (recommendation.auto_action_allowed === false) out.push(`- ${templateText(recommendation.template_id)}`);
  }
}

function templateText(templateId: string): string {
  return safe(FIXTURE_SAFE_CLAIMS[templateId]?.copy_template ?? 'Insufficient evidence to render this template.');
}

function gradeLabel(grade: EvidenceGrade): string {
  return `${grade} observed evidence completeness`;
}

function safe(value: string): string {
  return sanitizeCustomerText(value);
}

function safeLine(value: string): string {
  return sanitizeCustomerText(value);
}
