export function validateCapturePayload(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'invalid body' };
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string' || !b.email.includes('@')) return { valid: false, error: 'invalid email' };
  if (typeof b.site_id !== 'string') return { valid: false, error: 'missing site_id' };
  if (typeof b.session_id !== 'string') return { valid: false, error: 'missing session_id' };
  if (typeof b.asset_key !== 'string') return { valid: false, error: 'missing asset_key' };
  if (typeof b.trigger_score !== 'number') return { valid: false, error: 'missing trigger_score' };
  if (typeof b.config_version !== 'string') return { valid: false, error: 'missing config_version' };
  if (typeof b.probe_version !== 'string') return { valid: false, error: 'missing probe_version' };
  return { valid: true };
}
