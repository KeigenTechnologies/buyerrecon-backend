# AMS / BuyerRecon Canonical Event Contract v0.1

## Purpose

This contract defines the canonical behavioural evidence events accepted by BuyerRecon backend `/collect`.

The backend evidence ledger is not GA4. GA4 is marketing analytics. BuyerRecon backend events are evidence events used to judge whether a session, lead, or action deserves commercial trust.

## Universal Required Fields

### For new canonical events (page_view, cta_click, form_start, form_submit, generate_lead)

Every new canonical event must include:

- client_event_id
- session_id
- site_id
- event_type
- occurred_at or timestamp or client_timestamp_ms
- event_contract_version = `event-contract-v0.1`

Events missing `client_event_id` or `event_contract_version` will be rejected.

### For legacy production events (session_start, page_state, session_summary)

These events are accepted without `client_event_id` or `event_contract_version` for backward compatibility with the current production SDK.

If `event_contract_version` is absent, the backend stores `legacy-thin-v2.0`.
If `client_event_id` is absent, it is stored as null (no dedup).

### Contract version values

- `event-contract-v0.1` — required for new canonical events
- `legacy-thin-v2.0` — assigned to legacy events without explicit contract version

### Recommended for ordering and replay

- event_sequence_index
- page_view_id, when page-related
- previous_page_view_id, when available

---

## Canonical Event Types

The canonical event types are:

1. session_start
2. page_view
3. page_state
4. cta_click
5. form_start
6. form_submit
7. generate_lead
8. session_summary

Deprecated legacy event types, if encountered:

- cta_state
- form_state

These are not canonical. Do not use them for new report logic.

---

## Core Principle

Do not collapse user behaviour and business outcome.

- form_start = first meaningful form interaction
- form_submit = submit attempt, with outcome if known
- generate_lead = confirmed lead / conversion outcome

Simple distinction:

- form_submit proves the user tried to submit.
- generate_lead proves the system confirmed something lead-worthy.

---

## 1. session_start

### Meaning

A new session has started.

### Evidence question

Did a new visitor/session begin?

### Required fields

- session_id
- site_id
- event_type = session_start
- timestamp or occurred_at
- path or page URL path
- hostname
- event_contract_version

### Must not include

- email
- phone
- name
- company
- message
- raw form values

---

## 2. page_view

### Meaning

A page was viewed.

### Evidence question

Which page did the session actually visit?

### Required fields

- session_id
- page_view_id
- site_id
- event_type = page_view
- path
- timestamp or occurred_at

### Recommended fields

- previous_page_view_id
- referrer_category
- page_type
- page_group
- language
- event_sequence_index

### Must not include

- raw URL query values if they contain PII
- email
- phone
- name
- message
- raw form values

---

## 3. page_state

### Meaning

The page accumulated engagement state, such as dwell, scroll, visibility, or interaction.

### Evidence question

Was the page meaningfully engaged with, or merely loaded?

### Required fields

- session_id
- page_view_id
- site_id
- event_type = page_state

### Recommended fields

- dwell_bucket or dwell_ms
- scroll_bucket or scroll_depth
- visibility_state
- interaction_density_bucket
- heartbeat_active_ratio
- time_since_page_load_ms

### Must not include

- raw text entered by user
- email
- phone
- name
- message
- raw form values

---

## 4. cta_click

### Meaning

The user clicked a call-to-action.

### Evidence question

Did the user take a commercial navigation action?

### Required fields

- session_id
- page_view_id
- site_id
- event_type = cta_click
- cta_id or safe cta_label_bucket
- href_category
- click_offset_ms or ms_since_page_load

### Recommended fields

- cta_location
- cta_text_truncated_safe
- page_type
- page_group

### Notes

CTA text must be sanitized and truncated. Do not send arbitrary link text if it may contain PII.

### Must not include

- full user-entered values
- email
- phone
- name
- message
- raw query strings containing PII

---

## 5. form_start

### Meaning

The user made the first meaningful interaction with a form.

### Evidence question

Did the user begin form engagement?

### Definition

form_start = first meaningful form interaction.

This may include first focus, first input, or first intentional interaction with a form field.

### Required fields

- session_id
- page_view_id
- site_id
- event_type = form_start
- form_id
- ms_since_page_load or form_start_offset_ms

### Recommended fields

- form_type
- page_type
- source_page
- event_sequence_index

### Dedupe rule

Emit once per form per session or once per form per page_view, depending on implementation. Do not emit repeatedly on every field focus.

### Must not include

- field values
- email
- phone
- name
- company
- message
- address
- postcode

---

## 6. form_submit

### Meaning

The user attempted to submit a form.

### Evidence question

Did the user attempt form submission, and what was the outcome if known?

### Definition

form_submit = submit attempt, with outcome if known.

It is not the same as generate_lead.

A failed submit is still behavioural evidence, but it is not a confirmed lead.

### Required fields

- session_id
- page_view_id
- site_id
- event_type = form_submit
- form_id
- submit_outcome

### Allowed submit_outcome values

- success
- error
- unknown

### Recommended fields

- error_bucket
- ms_since_form_start
- ms_since_page_load
- form_type
- source_page

### Allowed error_bucket values

- validation_error
- network_error
- provider_error
- unknown

### Must not include

- raw form values
- email
- phone
- name
- company
- message
- address
- postcode

---

## 7. generate_lead

### Meaning

The system confirmed a lead-worthy business outcome.

### Evidence question

Did this session generate a confirmed commercial outcome?

### Definition

generate_lead = confirmed lead / conversion outcome.

generate_lead may happen after a successful form submission, but it can also happen through non-form flows such as calendar booking, external booking confirmation, gated report download, or confirmed newsletter signup.

generate_lead is broader than form_submit, but it does not replace form_submit.

### Required fields

- session_id
- site_id
- event_type = generate_lead
- lead_type
- source_kind
- source_page_view_id or page_view_id
- event_contract_version

### Recommended fields

- form_id, if form-originated
- thank_you_path, if thank-you-page-originated
- confirmation_context
- dedupe_key
- ms_since_session_start

### Allowed source_kind examples

- form_success
- thank_you_page
- ajax_success
- external_booking_confirmation
- gated_download_confirmation
- newsletter_confirmation
- manual_test_isolated

### Example: form-originated lead

generate_lead:
  lead_type: demo_request
  source_kind: form_success
  source_page_view_id: pv_123
  form_id: demo_form

### Example: non-form lead

generate_lead:
  lead_type: calendar_booking
  source_kind: external_booking_confirmation
  source_page_view_id: pv_456
  form_id: null

### Scoring rule

generate_lead without prior session evidence should be degraded.

A thank-you-only hit should not automatically become a trusted lead.

### Must not include

- lead email
- name
- company
- message
- phone
- address
- postcode
- raw form values

---

## 8. session_summary

### Meaning

A derived summary of the session.

### Evidence question

What did the session look like overall?

### Required fields

- session_id
- site_id
- event_type = session_summary
- page_count
- path_summary
- timing_summary or timing_buckets
- interaction_density

### Recommended fields

- cta_count
- form_start_count
- form_submit_count
- generate_lead_count
- session_duration_bucket
- quality_coverage_status

### Important

session_summary is derived evidence. It does not replace atomic events.

Atomic events are the audit trail. session_summary is the interpretation layer.

---

## PII Rules for /collect

The `/collect` endpoint is for behavioural evidence only.

It must reject accidental PII in:

- raw payload keys
- raw payload string values
- adapter_context
- labels
- href/query strings
- form metadata
- accidental submitted values

Reject these keys or values if detected:

- email
- phone
- name
- first_name
- last_name
- message
- address
- postcode
- raw form values

Company rule:

- Reject `company` as a payload key in behavioural `/collect` events.
- Do not reject CTA text merely because it says "Company" as a normal navigation label.

---

## Evidence Chain Examples

### Normal form lead

page_view
→ page_state
→ cta_click
→ form_start
→ form_submit with submit_outcome = success
→ generate_lead with source_kind = form_success
→ session_summary

### Failed form submission

page_view
→ form_start
→ form_submit with submit_outcome = error
→ session_summary

No generate_lead.

### Thank-you-only suspicious lead

generate_lead with source_kind = thank_you_page
→ session_summary

This should be degraded because prior session chain is missing.

### External booking lead

page_view
→ cta_click
→ generate_lead with source_kind = external_booking_confirmation
→ session_summary

No local form_submit required.

---

## Validation Philosophy

Invalid events must not be silently dropped.

Invalid events should go to rejected_events with clear reason codes.

Low-quality events should not be deleted. They should be preserved and later downweighted by scoring.
