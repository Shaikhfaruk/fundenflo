import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from './config.constants.js';
import { loadConfig } from './env.schema.js';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
