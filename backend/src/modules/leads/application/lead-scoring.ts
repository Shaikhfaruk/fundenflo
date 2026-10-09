import { LeadConsentStatus } from '../../../common/enums/db.enums.js';
import type { Lead } from '../../../generated/prisma/client.js';
import { scoreLead } from '../domain/lead-quality.js';

export type ContactPresence = { hasMobile: boolean; hasEmail: boolean; hasName: boolean };

type ScoredFields = Pick<Lead, 'segmentKey' | 'categoryKey' | 'amountMinPaise' | 'amountMaxPaise' | 'cityId' | 'pincode' | 'consentStatus'>;

export const scoreFor = (lead: ScoredFields, presence: ContactPresence): number =>
  scoreLead({
    ...presence,
    segmentKey: lead.segmentKey,
    categoryKey: lead.categoryKey,
    hasAmount: lead.amountMinPaise !== null || lead.amountMaxPaise !== null,
    locationResolved: Boolean(lead.cityId || lead.pincode),
    consentOk: lead.consentStatus === LeadConsentStatus.ok,
  });
