import { type DynamicModule, Global, Module } from '@nestjs/common';

import { EmailModule } from '../../integrations/email/email.module.js';
import { PushModule } from '../../integrations/push/push.module.js';
import { SmsModule } from '../../integrations/sms/sms.module.js';
import { NotificationPreferencePrivacyParticipant } from './application/notification-preference-privacy.participant.js';
import { NotificationPreferenceService } from './application/notification-preference.service.js';
import { NotificationTemplateService } from './application/notification-template.service.js';
import { NotificationService } from './application/notification.service.js';
import { AdminNotificationTemplatesController } from './http/admin-notification-templates.controller.js';
import { MeNotificationPreferencesController } from './http/me-notification-preferences.controller.js';
import { NotificationDispatchProcessor } from './infrastructure/notification-dispatch.processor.js';
import { NotificationPreferenceRepository } from './infrastructure/notification-preference.repository.js';
import { NotificationTemplateRepository } from './infrastructure/notification-template.repository.js';

const SHARED_PROVIDERS = [NotificationService, NotificationPreferenceService, NotificationPreferenceRepository, NotificationPreferencePrivacyParticipant];

@Global()
@Module({})
export class NotificationsModule {
  static forRoot(options: { worker: boolean }): DynamicModule {
    return {
      module: NotificationsModule,
      imports: options.worker ? [SmsModule, EmailModule, PushModule] : [],
      controllers: options.worker ? [] : [AdminNotificationTemplatesController, MeNotificationPreferencesController],
      providers: options.worker ? [...SHARED_PROVIDERS, NotificationDispatchProcessor] : [...SHARED_PROVIDERS, NotificationTemplateService, NotificationTemplateRepository],
      exports: [NotificationService, NotificationPreferenceService],
    };
  }
}
