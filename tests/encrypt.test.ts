import { describe, it, expect } from 'vitest';
import { encryptEmail, decryptEmail, hashEmail, classifyEmail } from '../src/probe/encrypt.js';

describe('email encryption', () => {
  const key = 'a'.repeat(64);

  it('round-trips encrypt/decrypt', () => {
    const email = 'test@example.com';
    const enc = encryptEmail(email, key);
    expect(enc).not.toBe(email);
    expect(enc).toContain(':');
    expect(decryptEmail(enc, key)).toBe(email);
  });

  it('produces deterministic SHA-256 hash', () => {
    expect(hashEmail('Test@Example.com')).toBe(hashEmail('test@example.com'));
    expect(hashEmail('test@example.com')).toHaveLength(64);
  });
});

describe('classifyEmail', () => {
  it('classifies gmail as freemail', () => expect(classifyEmail('gmail.com')).toBe('freemail'));
  it('classifies mailinator as disposable', () => expect(classifyEmail('mailinator.com')).toBe('disposable'));
  it('classifies company domain as business', () => expect(classifyEmail('acme.co.uk')).toBe('business'));
});
