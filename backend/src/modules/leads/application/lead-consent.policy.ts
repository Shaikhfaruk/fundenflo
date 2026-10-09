import { Injectable } from '@nestjs/common';

import { LeadConsentStatus } from '../../../common/enums/db.enums.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';

export const LEAD_SHARING_PURPOSES = [ConsentPurposeKey.Contact, ConsentPurposeKey.PartnerSharing];

@Injectable()
export class LeadConsentPolicy {
  constructor(private readonly consents: ConsentService) {}

  async statusFor(partyId: string): Promise<LeadConsentStatus> {
    const summary = await this.consents.summary(partyId, LEAD_SHARING_PURPOSES);
    const states = LEAD_SHARING_PURPOSES.map((purpose) => summary.get(purpose));
    if (states.every((state) => state?.granted)) return LeadConsentStatus.ok;
    if (states.some((state) => state?.recorded && !state.granted)) return LeadConsentStatus.withdrawn;
    return LeadConsentStatus.pending;
  }
}
