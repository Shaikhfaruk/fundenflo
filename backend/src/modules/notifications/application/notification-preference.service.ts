import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { NotificationChannel } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { isUniqueViolation } from '../../../infrastructure/database/prisma-errors.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { type ChannelChoices, NotificationPreferenceRepository } from '../infrastructure/notification-preference.repository.js';
import { toPreferenceView } from './notification.views.js';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    private readonly preferences: NotificationPreferenceRepository,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string) {
    return toPreferenceView(await this.preferences.find(userId));
  }

  async enabledChannels(userId: string): Promise<Set<NotificationChannel>> {
    const view = toPreferenceView(await this.preferences.find(userId));
    return new Set([view.sms && NotificationChannel.sms, view.email && NotificationChannel.email, view.push && NotificationChannel.push].filter((channel) => channel !== false));
  }

  @Transactional()
  async update(userId: string, choices: ChannelChoices, expectedVersion: number | undefined) {
    if (!choices.sms && !choices.email && !choices.push) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'channels', code: 'one_channel_required', message: 'keep at least one of SMS, email or push on so case updates reach you' }] });
    }
    const current = await this.preferences.find(userId);
    assertVersion(expectedVersion, current?.version ?? 0);
    if (current) {
      const result = await this.preferences.updateVersioned(userId, current.version, choices);
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: current.version + 1 } });
    } else {
      await this.preferences.create(userId, choices).catch((error: unknown) => {
        throw isUniqueViolation(error) ? new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: 1 } }) : error;
      });
    }
    await this.audit.record({ action: AuditAction.NotificationPreferencesChanged, entityType: AuditEntity.NotificationPreference, entityId: userId, metadata: { ...choices } });
    return this.get(userId);
  }
}
