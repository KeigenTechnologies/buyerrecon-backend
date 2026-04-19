export const DEFAULT_CONFIG_272 = {
  analysis_window_days: 30,
  min_eligible_sessions: 200,
  min_valid_event_rate: 0.70,
};

export const DEFAULT_CONFIG_750 = {
  enabled: false,
  legal_mode: 'disabled' as const,
  trigger_threshold: 0.68,
  confidence_floor: 0.50,
  eligible_page_groups: ['pricing', 'product'],
  excluded_paths: ['/legal', '/thank-you'],
  cooldown_hours: 72,
  max_fire_per_session: 1,
  daily_budget: 20,
  bootstrap: { min_runtime_days: 14, min_eligible_sessions: 500 },
  fire_rate: {
    auto_raise_pct: 5, auto_raise_window_days: 7,
    auto_disable_pct: 8, auto_disable_window_days: 7,
    circuit_breaker_pct: 10,
  },
  dismiss_rate: { raise_at_pct: 70, window_days: 14 },
  asset_key: 'buyer_checklist_v1',
  asset_url: '/assets/downloads/buyer-checklist.pdf',
  modal_copy: {
    headline: 'Before you go — grab the buyer checklist',
    body: 'A 1-page guide covering the 5 things most B2B buyers miss during evaluation.',
    cta_text: 'Get the checklist',
    dismiss_text: 'No thanks',
  },
  kill_switch: false,
  debug_mode: false,
  event_logging_verbosity: 'normal' as const,
  probe_version: '1.0.0',
};
