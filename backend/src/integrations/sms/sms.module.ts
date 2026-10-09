import { Module } from '@nestjs/common';

import { LogSmsSender } from './log-sms.sender.js';
import { SMS_SENDER } from './sms.port.js';

@Module({
  providers: [LogSmsSender, { provide: SMS_SENDER, useExisting: LogSmsSender }],
  exports: [SMS_SENDER],
})
export class SmsModule {}
