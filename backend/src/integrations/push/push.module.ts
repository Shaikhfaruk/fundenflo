import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { ExpoPushSender } from './expo-push.sender.js';
import { LogPushSender } from './log-push.sender.js';
import { PUSH_SENDER } from './push.port.js';

@Module({
  providers: [
    {
      provide: PUSH_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => (config.PUSH_DRIVER === 'expo' ? new ExpoPushSender(config) : new LogPushSender()),
    },
  ],
  exports: [PUSH_SENDER],
})
export class PushModule {}
