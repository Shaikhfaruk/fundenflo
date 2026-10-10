import { Injectable } from '@nestjs/common';

import { AttributionKind, IdentifierType, RiskSeverity, RiskSignalKind, RiskSubjectType } from '../../../common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { EventName } from '../../../common/events/event-names.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { PartnerKycService } from '../../partners/application/partner-kyc.service.js';
import { CONSISTENCY_SEVERITY, GST_ITR_ATTRIBUTE_PATTERN, REFERRAL_BURST_THRESHOLD, REFERRAL_BURST_WINDOW_MS, RiskRule } from '../domain/risk.constants.js';
import { RiskService } from './risk.service.js';
import { MINUTE_MS } from '../../../common/constants/time.constants.js';

type Payload = Record<string, unknown>;

const text = (payload: Payload, key: string) => (typeof payload[key] === 'string' ? payload[key] : null);

const HOUR_BUCKET_LENGTH = 13;

@Injectable()
export class RiskDetectionService {
  constructor(
    private readonly risk: RiskService,
    private readonly documents: DocumentService,
    private readonly kyc: PartnerKycService,
    private readonly attributions: LeadAttributionService,
  ) {}

  async handle(envelope: DomainEventEnvelope): Promise<number> {
    const payload = envelope.payload ?? {};
    if (envelope.name === EventName.DocumentScanned) return this.documentReuse(payload);
    if (envelope.name === EventName.ConsistencySignalRaised) return this.consistency(payload);
    if (envelope.name === EventName.BorrowerProfileChanged) return this.panNameMismatch(payload);
    if (envelope.name === EventName.PartnerKycUpdated) return this.sharedBankAccount(payload);
    if (envelope.name === EventName.LeadReferred) return this.referralBurst(payload);
    return 0;
  }

  private async documentReuse(payload: Payload) {
    const documentId = text(payload, 'documentId');
    const reuse = documentId ? await this.documents.reuseOf(documentId) : null;
    if (!reuse || reuse.otherPartyIds.length === 0) return 0;
    const subject = reuse.applicationId ? { type: RiskSubjectType.application, id: reuse.applicationId } : { type: RiskSubjectType.party, id: reuse.partyId };
    return this.count(
      this.risk.raise({
        kind: RiskSignalKind.document_reuse,
        severity: RiskSeverity.high,
        ruleKey: RiskRule.DocumentReuse,
        subject,
        partyId: reuse.partyId,
        applicationId: reuse.applicationId,
        evidence: { documentId, documentType: reuse.documentType, otherParties: reuse.otherPartyIds.length },
        fingerprint: `${RiskRule.DocumentReuse}:${documentId}`,
      }),
    );
  }

  private async consistency(payload: Payload) {
    const severity = CONSISTENCY_SEVERITY[text(payload, 'severity') ?? ''];
    const partyId = text(payload, 'partyId');
    const signalId = text(payload, 'signalId');
    if (!severity || !partyId || !signalId) return 0;
    const applicationId = text(payload, 'applicationId');
    const attributeKey = text(payload, 'attributeKey') ?? '';
    return this.count(
      this.risk.raise({
        kind: GST_ITR_ATTRIBUTE_PATTERN.test(attributeKey) ? RiskSignalKind.gst_itr_mismatch : RiskSignalKind.inflow_mismatch,
        severity,
        ruleKey: RiskRule.ConsistencyDeviation,
        subject: applicationId ? { type: RiskSubjectType.application, id: applicationId } : { type: RiskSubjectType.party, id: partyId },
        partyId,
        applicationId,
        evidence: { consistencySignalId: signalId, attributeKey },
        fingerprint: `${RiskRule.ConsistencyDeviation}:${signalId}`,
      }),
    );
  }

  private async panNameMismatch(payload: Payload) {
    const partyId = text(payload, 'partyId');
    const borrowerProfileId = text(payload, 'borrowerProfileId');
    if (payload.kyc !== IdentifierType.pan || payload.nameMatch !== false || !partyId || !borrowerProfileId) return 0;
    return this.count(
      this.risk.raise({
        kind: RiskSignalKind.identity_mismatch,
        severity: RiskSeverity.medium,
        ruleKey: RiskRule.PanNameMismatch,
        subject: { type: RiskSubjectType.party, id: partyId },
        partyId,
        evidence: { borrowerProfileId },
        fingerprint: `${RiskRule.PanNameMismatch}:${borrowerProfileId}`,
      }),
    );
  }

  private async sharedBankAccount(payload: Payload) {
    const organizationId = text(payload, 'organizationId');
    if (!organizationId) return 0;
    const others = await this.kyc.sharingBankAccount(organizationId);
    if (others.length === 0) return 0;
    return this.count(
      this.risk.raise({
        kind: RiskSignalKind.duplicate_identity,
        severity: RiskSeverity.high,
        ruleKey: RiskRule.SharedBankAccount,
        subject: { type: RiskSubjectType.partner_organization, id: organizationId },
        organizationId,
        evidence: { sharedWithOrganizationIds: others },
        fingerprint: `${RiskRule.SharedBankAccount}:${organizationId}:${others.toSorted().join(',')}`,
      }),
    );
  }

  private async referralBurst(payload: Payload) {
    const organizationId = text(payload, 'organizationId');
    if (!organizationId || !text(payload, 'referralCodeId')) return 0;
    const now = Date.now();
    const recent = await this.attributions.countSince(organizationId, AttributionKind.referral_code, new Date(now - REFERRAL_BURST_WINDOW_MS));
    if (recent < REFERRAL_BURST_THRESHOLD) return 0;
    const bucket = new Date(now).toISOString().slice(0, HOUR_BUCKET_LENGTH);
    return this.count(
      this.risk.raise({
        kind: RiskSignalKind.referral_pattern,
        severity: RiskSeverity.medium,
        ruleKey: RiskRule.ReferralBurst,
        subject: { type: RiskSubjectType.partner_organization, id: organizationId },
        organizationId,
        evidence: { signupsWithCode: recent, windowMinutes: REFERRAL_BURST_WINDOW_MS / MINUTE_MS },
        fingerprint: `${RiskRule.ReferralBurst}:${organizationId}:${bucket}`,
      }),
    );
  }

  private async count(raised: Promise<unknown>) {
    return (await raised) ? 1 : 0;
  }
}
