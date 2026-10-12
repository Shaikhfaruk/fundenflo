import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { LogSmsSender } from './log-sms.sender.js';
import { Msg91SmsSender } from './msg91-sms.sender.js';
import { SMS_SENDER } from './sms.port.js';

@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => (config.SMS_DRIVER === 'msg91' ? new Msg91SmsSender(config) : new LogSmsSender()),
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
