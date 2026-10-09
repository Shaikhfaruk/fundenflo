import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { EMAIL_SENDER } from './email.port.js';
import { LogEmailSender } from './log-email.sender.js';
import { SmtpEmailSender } from './smtp-email.sender.js';

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => (config.EMAIL_DRIVER === 'smtp' ? new SmtpEmailSender(config) : new LogEmailSender()),
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
