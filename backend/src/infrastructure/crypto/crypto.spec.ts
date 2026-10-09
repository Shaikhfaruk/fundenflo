import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/env.schema.js';
import { BlindIndex } from './blind-index.service.js';
import { BlindIndexDomain, CipherPurpose } from './crypto.constants.js';
import { FieldCipher } from './field-cipher.service.js';
import type { KeyProvider } from './key-provider.port.js';

const ringProvider = (activeKeyId: string, keys: Record<string, Buffer>): KeyProvider => ({
  loadDataKeys: async () => ({ activeKeyId, keys: new Map(Object.entries(keys)) }),
});

async function cipherWith(activeKeyId: string, keys: Record<string, Buffer>) {
  const cipher = new FieldCipher(ringProvider(activeKeyId, keys));
  await cipher.onModuleInit();
  return cipher;
}

describe('FieldCipher', () => {
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);

  it('round-trips values with a random IV each time', async () => {
    const cipher = await cipherWith('a', { a: keyA });
    const first = cipher.encrypt('+919876543210', CipherPurpose.PartyContact);
    const second = cipher.encrypt('+919876543210', CipherPurpose.PartyContact);
    expect(first).not.toBe(second);
    expect(first.startsWith('v1:a:')).toBe(true);
    expect(cipher.decrypt(first, CipherPurpose.PartyContact)).toBe('+919876543210');
  });

  it('binds ciphertext to its purpose', async () => {
    const cipher = await cipherWith('a', { a: keyA });
    const token = cipher.encrypt('ABCDE1234F', CipherPurpose.PartyIdentifier);
    expect(() => cipher.decrypt(token, CipherPurpose.PartyContact)).toThrow();
  });

  it('detects tampering', async () => {
    const cipher = await cipherWith('a', { a: keyA });
    const [version, keyId, iv, tag, body] = cipher.encrypt('secret', CipherPurpose.TotpSecret).split(':');
    const flipped = Buffer.from(body ?? '', 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() => cipher.decrypt([version, keyId, iv, tag, flipped.toString('base64url')].join(':'), CipherPurpose.TotpSecret)).toThrow();
  });

  it('decrypts values written with a previous key after rotation', async () => {
    const before = await cipherWith('a', { a: keyA });
    const token = before.encrypt('kept', CipherPurpose.PartyContact);
    const after = await cipherWith('b', { a: keyA, b: keyB });
    expect(after.decrypt(token, CipherPurpose.PartyContact)).toBe('kept');
    expect(after.encrypt('new', CipherPurpose.PartyContact).startsWith('v1:b:')).toBe(true);
  });

  it('refuses to start without a valid active key', async () => {
    await expect(cipherWith('missing', { a: keyA })).rejects.toThrow();
    await expect(cipherWith('a', { a: randomBytes(16) })).rejects.toThrow();
  });
});

describe('BlindIndex', () => {
  const index = new BlindIndex({ BLIND_INDEX_KEY: randomBytes(32).toString('base64') } as AppConfig);

  it('is deterministic for the same domain and value', () => {
    expect(index.hash(BlindIndexDomain.Mobile, '+919876543210')).toBe(index.hash(BlindIndexDomain.Mobile, '+919876543210'));
  });

  it('separates domains', () => {
    expect(index.hash(BlindIndexDomain.Mobile, 'x')).not.toBe(index.hash(BlindIndexDomain.Email, 'x'));
  });
});
