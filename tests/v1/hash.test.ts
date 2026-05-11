/**
 * Sprint 1 PR#5a — hash helper tests.
 *
 * sha256Hex: pure content fingerprint.
 * ipHash: workspace-scoped HMAC-SHA256, pepper-as-parameter (Decision D8).
 *
 * No DB. No env. No network.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sha256Hex, ipHash } from '../../src/collector/v1/hash.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'hash.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const PEPPER = '0'.repeat(64); // 32 bytes hex — deterministic test pepper.

describe('sha256Hex', () => {
  it('returns a 64-char lowercase hex digest', () => {
    const h = sha256Hex('hello');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same string input', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });

  it('is deterministic for the same Buffer input', () => {
    const buf = Buffer.from('hello', 'utf8');
    expect(sha256Hex(buf)).toBe(sha256Hex(buf));
  });

  it('produces equal output for string and equivalent UTF-8 Buffer', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex(Buffer.from('hello', 'utf8')));
  });

  it('produces different output for different content', () => {
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });

  it('returns the well-known empty-input digest for the empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('throws on null input', () => {
    // @ts-expect-error — runtime null is the failure mode under test
    expect(() => sha256Hex(null)).toThrow(/sha256Hex/);
  });

  it('throws on undefined input', () => {
    // @ts-expect-error — runtime undefined is the failure mode under test
    expect(() => sha256Hex(undefined)).toThrow(/sha256Hex/);
  });
});

describe('ipHash', () => {
  it('returns a 64-char lowercase hex digest', () => {
    const h = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same (ip, workspaceId, pepper)', () => {
    const a = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    const b = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    expect(a).toBe(b);
  });

  it('different pepper → different hash (rotation invalidates prior matches)', () => {
    const a = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    const b = ipHash('192.0.2.1', 'ws_alpha', '1'.repeat(64));
    expect(a).not.toBe(b);
  });

  it('different workspaceId → different hash for same IP (cross-workspace correlation prevented)', () => {
    const a = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    const b = ipHash('192.0.2.1', 'ws_beta', PEPPER);
    expect(a).not.toBe(b);
  });

  it('IPv6 lowercase normalisation: same address in different cases produces the same hash', () => {
    const upper = ipHash('2001:DB8::1', 'ws_alpha', PEPPER);
    const lower = ipHash('2001:db8::1', 'ws_alpha', PEPPER);
    expect(upper).toBe(lower);
  });

  it('whitespace around IP is trimmed before hashing', () => {
    const trimmed = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    const padded  = ipHash('  192.0.2.1  ', 'ws_alpha', PEPPER);
    expect(trimmed).toBe(padded);
  });

  it('different IPs produce different hashes', () => {
    const a = ipHash('192.0.2.1', 'ws_alpha', PEPPER);
    const b = ipHash('192.0.2.2', 'ws_alpha', PEPPER);
    expect(a).not.toBe(b);
  });

  it('does not echo the raw IP into the hash output', () => {
    const ip = '192.0.2.123';
    const h = ipHash(ip, 'ws_alpha', PEPPER);
    expect(h).not.toContain(ip);
    expect(h).not.toContain('192');
    expect(h).not.toContain('123');
  });

  it('throws on empty ip', () => {
    expect(() => ipHash('', 'ws_alpha', PEPPER)).toThrow(/ipHash/);
  });

  it('throws on empty workspaceId', () => {
    expect(() => ipHash('192.0.2.1', '', PEPPER)).toThrow(/ipHash/);
  });

  it('throws on empty pepper', () => {
    expect(() => ipHash('192.0.2.1', 'ws_alpha', '')).toThrow(/ipHash/);
  });
});

describe('hash.ts module — import discipline (Track B only)', () => {
  it('imports only node:crypto', () => {
    expect(source).toMatch(/^import \{[^}]*\} from 'crypto';$/m);
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/from\s+['"]axios['"]/);
  });

  it('does NOT read process.env at module load (env wiring lands in PR#5c)', () => {
    expect(source).not.toMatch(/process\.env\./);
  });

  it('does NOT reference Track A or Core AMS paths', () => {
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });
});
