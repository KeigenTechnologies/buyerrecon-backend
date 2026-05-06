const BASE = {
  event_schema_version: 'thin.v2.0',
  event_contract_version: 'event-contract-v0.1',
  consent_signal: 'granted',
  site_id: 'buyerrecon_com',
  hostname: 'buyerrecon.com',
  path: '/en/',
  anon_session_id: 'ses_test_001',
  anon_browser_id: 'brw_test_001',
  client_timestamp_ms: Date.now(),
  ga4_present: true,
  ga4_measurement_id_present: true,
  adapter_id: 'test_adapter',
  adapter_version: '1.0.0',
};

export const sessionStart = {
  ...BASE,
  event_type: 'session_start',
  client_event_id: 'evt_ss_001',
  source_context: {
    referrer_present: false,
    referrer_class: 'direct',
    utm_present: false,
    campaign_id_seen: null,
    landing_path: '/en/',
  },
  session_continuity: {
    first_seen_at_ms: Date.now() - 86400000,
    return_gap_bucket: '1-7d',
    repeat_session_count_7d: 2,
  },
  client_envelope: {
    ua_family: 'chrome',
    os_family: 'macos',
    device_class: 'desktop',
    screen_bucket: 'lg',
    lang_tz_coarse: 'en-GB|Europe/London',
    connection_type_coarse: 'wifi_like',
  },
};

export const pageView = {
  ...BASE,
  event_type: 'page_view',
  client_event_id: 'evt_pv_001',
  page_view_id: 'pvid_001',
  page_index_in_session: 0,
  ms_since_session_start: 0,
  ms_since_last_page_view: null,
  referrer_type: 'external',
};

export const pageState = {
  ...BASE,
  event_type: 'page_state',
  client_event_id: 'evt_ps_001',
  page_view_id: 'pvid_001',
  engagement_proxy: {
    dwell_bucket: '30-90s',
    scroll_depth_bucket: '51-75',
    interaction_density_bucket: '3-5',
    tab_visible_ratio: 0.95,
    tab_switch_count: 1,
    heartbeat_active_ratio: 0.8,
    dwell_ms: 45000,
    scroll_depth_pct: 68,
    interaction_count: 4,
  },
  velocity_and_repetition: {
    attempt_count_10m: 1,
    attempt_count_1h: 1,
    same_origin_repeat_count_1h: 0,
    path_loop_count_10m: 0,
  },
};

export const ctaClick = {
  ...BASE,
  event_type: 'cta_click',
  client_event_id: 'evt_cc_001',
  page_view_id: 'pvid_001',
  cta_id: 'get_my_buyer_motion_report',
  href_category: 'internal_evidence_page',
  click_offset_ms: 12500,
  cta_location: 'hero_primary',
  cta_text_truncated_safe: 'Get my buyer motion report',
};

export const formStart = {
  ...BASE,
  event_type: 'form_start',
  client_event_id: 'evt_fs_001',
  page_view_id: 'pvid_002',
  path: '/en/buyer-motion-evidence-report/',
  form_id: 'buyer_motion_report_form',
  ms_since_page_load: 5000,
  ms_since_session_start: 25000,
};

export const formSubmit = {
  ...BASE,
  event_type: 'form_submit',
  client_event_id: 'evt_fsub_001',
  page_view_id: 'pvid_002',
  path: '/en/buyer-motion-evidence-report/',
  form_id: 'buyer_motion_report_form',
  submit_outcome: 'success',
  ms_since_session_start: 85000,
  ms_since_form_start: 60000,
};

export const generateLead = {
  ...BASE,
  event_type: 'generate_lead',
  client_event_id: 'evt_gl_001',
  page_view_id: 'pvid_003',
  path: '/en/thank-you/',
  lead_type: 'buyer_motion_evidence_report',
  source_kind: 'form_success',
  source_page_view_id: 'pvid_002',
  form_id: 'buyer_motion_report_form',
  ms_since_session_start: 86000,
};

export const sessionSummary = {
  ...BASE,
  event_type: 'session_summary',
  client_event_id: 'evt_sum_001',
  source_context: sessionStart.source_context,
  session_continuity: sessionStart.session_continuity,
  path_and_sequence: {
    page_path_sequence: ['/en/', '/en/buyer-motion-evidence-report/', '/en/thank-you/'],
    ms_to_first_cta_exposure: 5000,
    ms_to_first_form_start: 25000,
    same_origin_repeat_count_1h: 0,
    path_loop_count_10m: 0,
  },
  cta_and_form: {
    cta_exposed: true,
    cta_exposure_ms: 8000,
    cta_reentry_count: 0,
    form_started: true,
    form_submit: true,
    form_abandon_after_start: false,
    ms_to_first_form_start: 25000,
    form_start_to_submit_ms: 60000,
  },
  engagement_proxy: pageState.engagement_proxy,
  velocity_and_repetition: pageState.velocity_and_repetition,
};

export const allCanonical = [
  sessionStart, pageView, pageState, ctaClick,
  formStart, formSubmit, generateLead, sessionSummary,
];
