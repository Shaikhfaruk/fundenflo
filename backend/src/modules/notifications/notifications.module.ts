import { type DynamicModule, Global, Module } from '@nestjs/common';

import { EmailModule } from '../../integrations/email/email.module.js';
import { SmsModule } from '../../integrations/sms/sms.module.js';
import { NotificationService } from './application/notification.service.js';
import { NotificationDispatchProcessor } from './infrastructure/notification-dispatch.processor.js';

@Global()
@Module({})
export class NotificationsModule {
  static forRoot(options: { worker: boolean }): DynamicModule {
    return {
      module: NotificationsModule,
      imports: options.worker ? [SmsModule, EmailModule] : [],
      providers: options.worker ? [NotificationService, NotificationDispatchProcessor] : [NotificationService],
      exports: [NotificationService],
    };
  }
}
