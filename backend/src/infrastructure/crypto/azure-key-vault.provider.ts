import { DefaultAzureCredential } from '@azure/identity';
import { CryptographyClient } from '@azure/keyvault-keys';

import type { AppConfig } from '../../config/env.schema.js';
import { KEY_VAULT_WRAP_ALGORITHM } from './crypto.constants.js';
import type { DataKeyRing, KeyProvider } from './key-provider.port.js';

export class AzureKeyVaultKeyProvider implements KeyProvider {
  constructor(private readonly config: AppConfig) {}

  async loadDataKeys(): Promise<DataKeyRing> {
    const keyId = this.config.KEY_VAULT_KEY_ID;
    if (!keyId) throw new Error('KEY_VAULT_KEY_ID is not configured');
    const client = new CryptographyClient(keyId, new DefaultAzureCredential());
    const wrapped = Object.entries(this.config.CRYPTO_WRAPPED_KEYS ?? {});
    const unwrapped = await Promise.all(
      wrapped.map(async ([dataKeyId, value]) => {
        const result = await client.unwrapKey(KEY_VAULT_WRAP_ALGORITHM, Buffer.from(value, 'base64'));
        return [dataKeyId, Buffer.from(result.result)] as const;
      }),
    );
    return { activeKeyId: this.config.CRYPTO_ACTIVE_KEY_ID, keys: new Map(unwrapped) };
  }
}
