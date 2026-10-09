import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { AzureKeyVaultKeyProvider } from './azure-key-vault.provider.js';
import { BlindIndex } from './blind-index.service.js';
import { KEY_PROVIDER } from './crypto.constants.js';
import { FieldCipher } from './field-cipher.service.js';
import { LocalKeyProvider } from './local-key.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: KEY_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.CRYPTO_DRIVER === 'azure_key_vault' ? new AzureKeyVaultKeyProvider(config) : new LocalKeyProvider(config),
    },
    FieldCipher,
    BlindIndex,
  ],
  exports: [FieldCipher, BlindIndex],
})
export class CryptoModule {}
