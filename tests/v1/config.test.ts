/**
 * Sprint 1 PR#7 — env / config loader unit tests.
 *
 * No process.env reads (loader takes an env arg for full determinism).
 * No real secrets — only obvious test placeholders.
 */

import { describe, it, expect } from 'vitest';
import { loadV1ConfigFromEnv } from '../../src/collector/v1/config.js';
import { COLLECTOR_VERSION, CANONICAL_CONTRACT_VERSION } from '../../src/constants.js';
import { VALIDATOR_VERSION } from '../../src/collector/v1/index.js';

function baseEnv(): NodeJS.ProcessEnv {
  return {
    SITE_WRITE_TOKEN_PEPPER: 'test-site-pepper-1',
    IP_HASH_PEPPER: 'test-ip-pepper-1',
  } as NodeJS.ProcessEnv;
}

describe('loadV1ConfigFromEnv — required peppers', () => {
  it('throws when SITE_WRITE_TOKEN_PEPPER is missing', () => {
    const env = { IP_HASH_PEPPER: 'test-ip-pepper-1' } as NodeJS.ProcessEnv;
    expect(() => loadV1ConfigFromEnv(env)).toThrow(/SITE_WRITE_TOKEN_PEPPER/);
  });

  it('throws when SITE_WRITE_TOKEN_PEPPER is empty string', () => {
    const env = { SITE_WRITE_TOKEN_PEPPER: '', IP_HASH_PEPPER: 'x' } as NodeJS.ProcessEnv;
    expect(() => loadV1ConfigFromEnv(env)).toThrow(/SITE_WRITE_TOKEN_PEPPER/);
  });

  it('throws when IP_HASH_PEPPER is missing', () => {
    const env = { SITE_WRITE_TOKEN_PEPPER: 'test-site-pepper-1' } as NodeJS.ProcessEnv;
    expect(() => loadV1ConfigFromEnv(env)).toThrow(/IP_HASH_PEPPER/);
  });

  it('throws when IP_HASH_PEPPER is empty string', () => {
    const env = { SITE_WRITE_TOKEN_PEPPER: 'x', IP_HASH_PEPPER: '' } as NodeJS.ProcessEnv;
    expect(() => loadV1ConfigFromEnv(env)).toThrow(/IP_HASH_PEPPER/);
  });

  it('returns LoadedV1Config when both peppers present', () => {
    const result = loadV1ConfigFromEnv(baseEnv());
    expect(result.config.ip_hash_pepper).toBe('test-ip-pepper-1');
    expect(result.site_write_token_pepper).toBe('test-site-pepper-1');
  });

  it('site_write_token_pepper is NOT placed on CollectorConfig', () => {
    const result = loadV1ConfigFromEnv(baseEnv());
    // CollectorConfig has only ip_hash_pepper, not site_write_token_pepper.
    expect(Object.keys(result.config)).not.toContain('site_write_token_pepper');
    expect(result.config.ip_hash_pepper).not.toBe(result.site_write_token_pepper);
  });
});

describe('loadV1ConfigFromEnv — CollectorConfig constants', () => {
  it('sources collector_version from src/constants.ts COLLECTOR_VERSION', () => {
    const result = loadV1ConfigFromEnv(baseEnv());
    expect(result.config.collector_version).toBe(COLLECTOR_VERSION);
  });

  it('sources validator_version from src/collector/v1/index.ts VALIDATOR_VERSION', () => {
    const result = loadV1ConfigFromEnv(baseEnv());
    expect(result.config.validator_version).toBe(VALIDATOR_VERSION);
  });

  it('sources event_contract_version from src/constants.ts CANONICAL_CONTRACT_VERSION', () => {
    const result = loadV1ConfigFromEnv(baseEnv());
    expect(result.config.event_contract_version).toBe(CANONICAL_CONTRACT_VERSION);
  });
});

describe('loadV1ConfigFromEnv — ENABLE_V1_BATCH literal-true gate', () => {
  it('defaults to false when unset', () => {
    expect(loadV1ConfigFromEnv(baseEnv()).enable_v1_batch).toBe(false);
  });

  it('is true only for literal "true"', () => {
    const env = { ...baseEnv(), ENABLE_V1_BATCH: 'true' };
    expect(loadV1ConfigFromEnv(env).enable_v1_batch).toBe(true);
  });

  it.each(['TRUE', 'True', '1', 'yes', 'on', ' true ', 'false', ''])(
    'treats %j as false',
    (value) => {
      const env = { ...baseEnv(), ENABLE_V1_BATCH: value };
      expect(loadV1ConfigFromEnv(env).enable_v1_batch).toBe(false);
    },
  );
});

describe('loadV1ConfigFromEnv — ALLOW_CONSENT_STATE_SUMMARY literal-true gate', () => {
  it('defaults to false when unset', () => {
    expect(loadV1ConfigFromEnv(baseEnv()).config.allow_consent_state_summary).toBe(false);
  });

  it('is true only for literal "true"', () => {
    const env = { ...baseEnv(), ALLOW_CONSENT_STATE_SUMMARY: 'true' };
    expect(loadV1ConfigFromEnv(env).config.allow_consent_state_summary).toBe(true);
  });

  it.each(['TRUE', 'True', '1', 'yes', 'on', ' true ', 'false', ''])(
    'treats %j as false',
    (value) => {
      const env = { ...baseEnv(), ALLOW_CONSENT_STATE_SUMMARY: value };
      expect(loadV1ConfigFromEnv(env).config.allow_consent_state_summary).toBe(false);
    },
  );
});

describe('loadV1ConfigFromEnv — scope discipline', () => {
  it('test fixtures use obvious placeholder peppers', () => {
    const env = baseEnv();
    // Real secrets are 64-char hex; placeholders are short and alphabetic.
    expect((env.SITE_WRITE_TOKEN_PEPPER ?? '').length).toBeLessThan(32);
    expect((env.IP_HASH_PEPPER ?? '').length).toBeLessThan(32);
  });
});
