import { Injectable } from '@nestjs/common';

import { ContactType, NotificationChannel, UserStatus } from '../../../common/enums/db.enums.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import type { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import type { TemplateParams } from '../../notifications/domain/template-renderer.js';
import { PartyService } from '../../parties/application/party.service.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';
import { SessionRepository } from '../infrastructure/session.repository.js';

export type UserChannel = typeof NotificationChannel.sms | typeof NotificationChannel.email | typeof NotificationChannel.push;

const CONTACT_FOR: Record<Exclude<UserChannel, typeof NotificationChannel.push>, ContactType> = {
  [NotificationChannel.sms]: ContactType.mobile,
  [NotificationChannel.email]: ContactType.email,
};

@Injectable()
export class UserNotifier {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly parties: PartyService,
    private readonly notifications: NotificationService,
    private readonly sessions: SessionRepository,
  ) {}

  async notifyParties(partyIds: Iterable<string>, templateKey: NotificationTemplateKey, params: (locale: string | null) => TemplateParams, channels: readonly UserChannel[]): Promise<number> {
    const userIds: string[] = [];
    for (const partyId of new Set(partyIds)) {
      const user = await this.identity.findUserByParty(partyId);
      if (user) userIds.push(user.id);
    }
    return this.notify(userIds, templateKey, params, channels);
  }

  async notify(userIds: Iterable<string>, templateKey: NotificationTemplateKey, params: (locale: string | null) => TemplateParams, channels: readonly UserChannel[]): Promise<number> {
    let sent = 0;
    for (const userId of new Set(userIds)) {
      const user = await this.identity.findUser(userId);
      if (user?.status !== UserStatus.active) continue;
      const locale = user.party.preferredLanguage;
      const tokens = channels.includes(NotificationChannel.push) ? await this.sessions.activePushTokens(userId) : [];
      for (const token of tokens) {
        await this.notifications.send({ templateKey, channel: NotificationChannel.push, recipient: token, params: params(locale), locale: locale ?? undefined });
        sent += 1;
      }
      for (const channel of channels) {
        if (channel === NotificationChannel.push || (channel === NotificationChannel.sms && tokens.length > 0)) continue;
        const recipient = await this.parties.getPrimaryContactValue(user.partyId, CONTACT_FOR[channel]);
        if (!recipient) continue;
        await this.notifications.send({ templateKey, channel, recipient, params: params(locale), locale: locale ?? undefined });
        sent += 1;
      }
    }
    return sent;
  }
}
