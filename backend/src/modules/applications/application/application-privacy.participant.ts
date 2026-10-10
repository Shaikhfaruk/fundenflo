import { ApplicationStatus } from '../../../common/enums/db.enums.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { OPEN_APPLICATION_STATES } from '../../../engines/state-machines/machines/application.machine.js';
import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { LOAN_RECORD_RETENTION_YEARS } from '../domain/application.constants.js';
import { ApplicationRepository } from '../infrastructure/application.repository.js';

const PRIVACY_SCAN_LIMIT = 500;

@PrivacyParticipantFor(PrivacySection.Applications)
export class ApplicationPrivacyParticipant implements PrivacyParticipant {
  constructor(private readonly applications: ApplicationRepository) {}

  async export(subject: PrivacySubject) {
    return (await this.of(subject)).map((application) => ({
      ref: application.ref,
      status: application.status,
      category: application.categoryKey,
      purpose: application.purposeKey,
      amountPaise: application.amountPaise === null ? null : paiseToNumber(application.amountPaise),
      tenureMonths: application.tenureMonths,
      createdAt: application.createdAt.toISOString(),
      closedAt: application.closedAt?.toISOString() ?? null,
    }));
  }

  async holds(subject: PrivacySubject) {
    const rows = await this.of(subject);
    const retentionStart = new Date();
    retentionStart.setUTCFullYear(retentionStart.getUTCFullYear() - LOAN_RECORD_RETENTION_YEARS);
    const open = rows.filter((row) => OPEN_APPLICATION_STATES.includes(row.status)).map((row) => `application ${row.ref} is still open; withdraw or close it first`);
    const retained = rows.filter((row) => row.status === ApplicationStatus.closed_won && row.closedAt && row.closedAt > retentionStart).map((row) => `loan ${row.ref} was disbursed on ${row.closedAt?.toISOString().slice(0, 10)}; lending records are kept for ${LOAN_RECORD_RETENTION_YEARS} years`);
    return [...open, ...retained];
  }

  private of(subject: PrivacySubject) {
    return this.applications.list({ OR: [{ partyId: { in: subject.partyIds } }, { actingPartyId: { in: subject.partyIds } }] }, PRIVACY_SCAN_LIMIT);
  }
}
