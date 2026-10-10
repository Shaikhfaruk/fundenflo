import { Injectable } from '@nestjs/common';

import { NotificationChannel, Role } from '../../../common/enums/db.enums.js';
import { formatRupees } from '../../../common/money/paise.js';
import { MembershipService } from '../../access/application/membership.service.js';
import { UserNotifier } from '../../auth/application/user-notifier.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { PartnerKycService } from '../../partners/application/partner-kyc.service.js';
import { CommissionRepository } from '../infrastructure/commission.repository.js';

const CHANNELS = [NotificationChannel.email, NotificationChannel.sms] as const;

const RECIPIENT_ROLES = [Role.partner_owner] as const;

const UNKNOWN_ACCOUNT = '----';

@Injectable()
export class CommissionNotificationService {
  constructor(
    private readonly commissions: CommissionRepository,
    private readonly memberships: MembershipService,
    private readonly kyc: PartnerKycService,
    private readonly notifier: UserNotifier,
  ) {}

  async payoutPaid(payoutId: string) {
    const payout = await this.commissions.findPayout({ id: payoutId });
    if (!payout?.utr) return 0;
    const profile = await this.kyc.profileOf(payout.partnerOrganizationId);
    const userIds = await this.memberships.activeUserIds(payout.partnerOrganizationId, RECIPIENT_ROLES);
    const params = { ref: payout.ref, amount: formatRupees(payout.netPaise), tds: formatRupees(payout.tdsPaise), account: profile.kyc.bank?.accountLast4 ?? UNKNOWN_ACCOUNT, utr: payout.utr };
    return this.notifier.notify(userIds, NotificationTemplateKey.PayoutPaid, () => params, CHANNELS);
  }
}
