/**
 * Sprint 1 PR#7 — bearer extraction + prefetch-adapter auth tests.
 */

import { describe, it, expect } from 'vitest';
import {
  extractBearerToken,
  resolveAuthForRunRequest,
} from '../../src/collector/v1/auth-route.js';
import {
  hashSiteWriteToken,
  type SiteWriteTokenRow,
} from '../../src/auth/workspace.js';

const PEPPER = 'test-site-pepper-1';

describe('extractBearerToken', () => {
  it('returns null for missing header', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for empty header', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns the token for "Bearer <tok>"', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('accepts lowercase "bearer" scheme casing', () => {
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
  });

  it('returns null for non-Bearer scheme (Basic)', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null for missing token after Bearer', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
  });

  it('returns null when more than 2 whitespace-separated parts', () => {
    expect(extractBearerToken('Bearer abc def')).toBeNull();
  });

  it('handles extra whitespace inside the header', () => {
    expect(extractBearerToken('  Bearer   abc123  ')).toBe('abc123');
  });
});

describe('resolveAuthForRunRequest — bearer rejections', () => {
  const neverCalledLookup = async (): Promise<SiteWriteTokenRow | null> => {
    throw new Error('lookup should not be called');
  };

  it('missing Authorization → auth_invalid', async () => {
    const r = await resolveAuthForRunRequest(null, PEPPER, neverCalledLookup);
    expect(r).toEqual({ status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' });
  });

  it('malformed Authorization → auth_invalid', async () => {
    const r = await resolveAuthForRunRequest('weird-not-bearer', PEPPER, neverCalledLookup);
    expect(r.status).toBe('invalid_token');
    expect(r.reason_code).toBe('auth_invalid');
  });

  it('non-Bearer scheme → auth_invalid', async () => {
    const r = await resolveAuthForRunRequest('Basic abc', PEPPER, neverCalledLookup);
    expect(r.status).toBe('invalid_token');
  });

  it('empty Bearer token → auth_invalid', async () => {
    const r = await resolveAuthForRunRequest('Bearer ', PEPPER, neverCalledLookup);
    expect(r.status).toBe('invalid_token');
  });
});

describe('resolveAuthForRunRequest — DB lookup outcomes', () => {
  it('unknown token (lookup returns null) → auth_invalid', async () => {
    const r = await resolveAuthForRunRequest(
      'Bearer unknown-token',
      PEPPER,
      async () => null,
    );
    expect(r).toEqual({ status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' });
  });

  it('disabled token → auth_site_disabled', async () => {
    const token = 'disabled-token';
    const expectedHash = hashSiteWriteToken(token, PEPPER);
    const lookup = async (hash: string): Promise<SiteWriteTokenRow | null> => {
      expect(hash).toBe(expectedHash);
      return {
        token_id: 't-1',
        workspace_id: 'w-1',
        site_id: 's-1',
        disabled_at: new Date('2026-05-01'),
      };
    };
    const r = await resolveAuthForRunRequest(`Bearer ${token}`, PEPPER, lookup);
    expect(r).toEqual({
      status: 'site_disabled',
      resolved: null,
      reason_code: 'auth_site_disabled',
    });
  });

  it('active token → ok with resolved boundary', async () => {
    const token = 'active-token';
    const lookup = async (): Promise<SiteWriteTokenRow | null> => ({
      token_id: 't-2',
      workspace_id: 'w-2',
      site_id: 's-2',
      disabled_at: null,
    });
    const r = await resolveAuthForRunRequest(`Bearer ${token}`, PEPPER, lookup);
    expect(r).toEqual({
      status: 'ok',
      resolved: { token_id: 't-2', workspace_id: 'w-2', site_id: 's-2' },
      reason_code: null,
    });
  });

  it('lookup throw propagates (route layer maps to 500 auth_lookup_failure)', async () => {
    const lookup = async (): Promise<SiteWriteTokenRow | null> => {
      throw new Error('synthetic DB failure');
    };
    await expect(
      resolveAuthForRunRequest('Bearer x', PEPPER, lookup),
    ).rejects.toThrow(/synthetic DB failure/);
  });

  it('hash passed to lookup matches hashSiteWriteToken(token, pepper)', async () => {
    const token = 'specific-token';
    const expected = hashSiteWriteToken(token, PEPPER);
    let received = '';
    const lookup = async (hash: string): Promise<SiteWriteTokenRow | null> => {
      received = hash;
      return null;
    };
    await resolveAuthForRunRequest(`Bearer ${token}`, PEPPER, lookup);
    expect(received).toBe(expected);
  });
});
