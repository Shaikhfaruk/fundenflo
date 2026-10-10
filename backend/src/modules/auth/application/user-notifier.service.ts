import { Injectable } from '@nestjs/common';

import { ContactType, NotificationChannel, UserStatus } from '../../../common/enums/db.enums.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import type { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import type { TemplateParams } from '../../notifications/domain/template-renderer.js';
import { PartyService } from '../../parties/application/party.service.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';

export type UserChannel = typeof NotificationChannel.sms | typeof NotificationChannel.email;

const CONTACT_FOR: Record<UserChannel, ContactType> = {
  [NotificationChannel.sms]: ContactType.mobile,
  [NotificationChannel.email]: ContactType.email,
};

@Injectable()
export class UserNotifier {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly parties: PartyService,
    private readonly notifications: NotificationService,
  ) {}

  async notify(userIds: Iterable<string>, templateKey: NotificationTemplateKey, params: (locale: string | null) => TemplateParams, channels: readonly UserChannel[]): Promise<number> {
    let sent = 0;
    for (const userId of new Set(userIds)) {
      const user = await this.identity.findUser(userId);
      if (user?.status !== UserStatus.active) continue;
      for (const channel of channels) {
        const recipient = await this.parties.getPrimaryContactValue(user.partyId, CONTACT_FOR[channel]);
        if (!recipient) continue;
        await this.notifications.send({ templateKey, channel, recipient, params: params(user.party.preferredLanguage), locale: user.party.preferredLanguage ?? undefined });
        sent += 1;
      }
    }
    return sent;
  }
}
