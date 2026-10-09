import type { AppConfig } from '../../config/env.schema.js';
import type { DataKeyRing, KeyProvider } from './key-provider.port.js';

export class LocalKeyProvider implements KeyProvider {
  constructor(private readonly config: AppConfig) {}

  async loadDataKeys(): Promise<DataKeyRing> {
    const entries = Object.entries(this.config.CRYPTO_LOCAL_KEYS ?? {});
    return {
      activeKeyId: this.config.CRYPTO_ACTIVE_KEY_ID,
      keys: new Map(entries.map(([keyId, value]) => [keyId, Buffer.from(value, 'base64')])),
    };
  }
}
