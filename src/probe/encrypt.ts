import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export function encryptEmail(email: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptEmail(encStr: string, keyHex: string): string {
  const [ivHex, cipherHex, tagHex] = encStr.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(cipherHex, 'hex')) + decipher.final('utf8');
}

const FREE = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com','mail.com','yandex.com','gmx.com']);
const DISPOSABLE = new Set(['mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com']);

export function classifyEmail(domain: string): 'business' | 'freemail' | 'disposable' | 'role' | 'unknown' {
  const d = domain.toLowerCase();
  if (FREE.has(d)) return 'freemail';
  if (DISPOSABLE.has(d)) return 'disposable';
  return 'business';
}
