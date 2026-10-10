import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { ANTIVIRUS_SCANNER } from './antivirus.port.js';
import { ClamavScanner } from './clamav.scanner.js';
import { EicarScanner } from './eicar.scanner.js';

@Module({
  providers: [
    {
      provide: ANTIVIRUS_SCANNER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.ANTIVIRUS_DRIVER === 'clamav' ? new ClamavScanner({ host: config.CLAMAV_HOST as string, port: config.CLAMAV_PORT, timeoutMs: config.CLAMAV_TIMEOUT_MS }) : new EicarScanner(),
    },
  ],
  exports: [ANTIVIRUS_SCANNER],
})
export class AntivirusModule {}
