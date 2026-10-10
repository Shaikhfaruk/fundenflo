import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { SUBMISSIONS_PER_APPLICATION_LIMIT } from '../domain/submission.constants.js';
import { SubmissionRepository } from '../infrastructure/submission.repository.js';

@PrivacyParticipantFor(PrivacySection.Sharing)
export class SubmissionPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly lenders: LenderService,
  ) {}

  async export(subject: PrivacySubject) {
    const rows = await this.submissions.list({ sentAt: { not: null }, application: { OR: [{ partyId: { in: subject.partyIds } }, { actingPartyId: { in: subject.partyIds } }] } }, SUBMISSIONS_PER_APPLICATION_LIMIT);
    const lenders = await this.lenders.summaries([...new Set(rows.map((row) => row.lenderId))]);
    return rows.map((row) => ({ ref: row.ref, lender: lenders.get(row.lenderId)?.name ?? null, product: row.productKey, status: row.status, sharedAt: row.sentAt?.toISOString() ?? null }));
  }
}
