import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { AnswerChannel, AttributionKind, ConsentChannel, DisputeSource, LeadEventType, LoginAs } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { OPEN_LEAD_STATES } from '../../../engines/state-machines/machines/lead.machine.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { AttributionDisputeService } from '../../partners/application/attribution-dispute.service.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { type ResolvedReferralCode, ReferralCodeService } from '../../partners/application/referral-code.service.js';
import { LeadSourceKey, ReferralOutcome } from '../domain/lead.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadCaptureService } from './lead-capture.service.js';
import { LeadSourceService } from './lead-source.service.js';
import { LeadTimeline } from './lead-timeline.service.js';

export type SignedUpPayload = { userId?: string; partyId?: string; loginAs?: string; referralCode?: string | null };

@Injectable()
export class ReferralSignupService {
  constructor(
    private readonly codes: ReferralCodeService,
    private readonly attributions: LeadAttributionService,
    private readonly disputes: AttributionDisputeService,
    private readonly leads: LeadRepository,
    private readonly capture: LeadCaptureService,
    private readonly sources: LeadSourceService,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  async onSignedUp(payload: SignedUpPayload) {
    if (!payload.partyId || !payload.referralCode || payload.loginAs !== LoginAs.borrower) return null;
    const code = await this.codes.resolve(payload.referralCode);
    return code ? this.attribute(payload.partyId, code) : null;
  }

  @Transactional()
  async attribute(partyId: string, code: ResolvedReferralCode) {
    const open = await this.leads.listOpenForParty(partyId, OPEN_LEAD_STATES);
    const existing = await this.attributions.forLeads(open.map((lead) => lead.id));
    const now = new Date();
    const active = existing.filter((row) => row.endedAt === null && row.protectedUntil > now);
    if (active.some((row) => row.organizationId === code.organizationId)) return { outcome: ReferralOutcome.AlreadyAttributed };
    const [holder] = active;
    if (holder) {
      const dispute = await this.disputes.raise({ attribution: holder, claimantOrganizationId: code.organizationId, source: DisputeSource.signup_code, referralCodeId: code.referralCodeId });
      return { outcome: ReferralOutcome.Disputed, disputeId: dispute?.id ?? null };
    }
    const free = open.find((lead) => !existing.some((row) => row.leadId === lead.id));
    const leadId = free?.id ?? (await this.capture.capture({}, { source: await this.sources.activeByKey(LeadSourceKey.ReferralCode), partyId, consentChannel: ConsentChannel.app, answerChannel: AnswerChannel.borrower, locale: DEFAULT_LOCALE })).lead.id;
    const attribution = await this.attributions.create({ leadId, organizationId: code.organizationId, kind: AttributionKind.referral_code, referralCodeId: code.referralCodeId, createdByUserId: null }, now);
    const details = { leadId, organizationId: code.organizationId, referralCodeId: code.referralCodeId, protectedUntil: attribution.protectedUntil.toISOString() };
    await this.timeline.record(leadId, LeadEventType.referred, { data: details });
    await this.changes.record({ action: AuditAction.ReferralAttributed, entityType: AuditEntity.Lead, entityId: leadId, event: EventName.LeadReferred, metadata: details, payload: details });
    return { outcome: ReferralOutcome.Attributed, leadId, attributionId: attribution.id };
  }
}
