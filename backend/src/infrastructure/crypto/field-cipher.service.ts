import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { CIPHER_ALGORITHM, CIPHER_FORMAT_VERSION, CIPHER_IV_BYTES, type CipherPurpose, InjectKeyProvider } from './crypto.constants.js';
import type { DataKeyRing, KeyProvider } from './key-provider.port.js';

@Injectable()
export class FieldCipher implements OnModuleInit {
  private ring: DataKeyRing | undefined;

  constructor(@InjectKeyProvider() private readonly keyProvider: KeyProvider) {}

  async onModuleInit() {
    const ring = await this.keyProvider.loadDataKeys();
    const active = ring.keys.get(ring.activeKeyId);
    if (!active || active.length !== 32) throw new Error('Active data key is missing or not 32 bytes');
    this.ring = ring;
  }

  get activeKeyId(): string {
    return this.requireRing().activeKeyId;
  }

  reencrypt(token: string, purpose: CipherPurpose): string {
    return this.encrypt(this.decrypt(token, purpose), purpose);
  }

  encrypt(plaintext: string, purpose: CipherPurpose): string {
    const ring = this.requireRing();
    const key = ring.keys.get(ring.activeKeyId) as Buffer;
    const iv = randomBytes(CIPHER_IV_BYTES);
    const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(purpose, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [CIPHER_FORMAT_VERSION, ring.activeKeyId, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  decrypt(token: string, purpose: CipherPurpose): string {
    const [version, keyId, iv, tag, ciphertext] = token.split(':');
    if (version !== CIPHER_FORMAT_VERSION || !keyId || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unsupported ciphertext format');
    }
    const key = this.requireRing().keys.get(keyId);
    if (!key) throw new Error(`Unknown data key ${keyId}`);
    const decipher = createDecipheriv(CIPHER_ALGORITHM, key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(purpose, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown, purpose: CipherPurpose): string {
    return this.encrypt(JSON.stringify(value), purpose);
  }

  decryptJson<T>(token: string, purpose: CipherPurpose): T {
    return JSON.parse(this.decrypt(token, purpose)) as T;
  }

  private requireRing(): DataKeyRing {
    if (!this.ring) throw new Error('FieldCipher used before keys were loaded');
    return this.ring;
  }
}
