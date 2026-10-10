import { ConsentBasis, ConsentChannel } from '../../../common/enums/db.enums.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { ERASURE_EVIDENCE, PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { ConsentRepository } from '../infrastructure/consent.repository.js';
import { ConsentService } from './consent.service.js';

@PrivacyParticipantFor(PrivacySection.Consents)
export class ConsentPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly consents: ConsentService,
    private readonly repository: ConsentRepository,
  ) {}

  async export(subject: PrivacySubject) {
    const out = [];
    for (const partyId of subject.partyIds) {
      for (const record of await this.repository.listRecords(partyId)) {
        out.push({ partyId, purpose: record.purposeKey, granted: record.granted, basis: record.basis, channel: record.channel, scope: record.scope, recordedAt: record.recordedAt.toISOString(), expiresAt: record.expiresAt?.toISOString() ?? null });
      }
    }
    return out;
  }

  async erase(subject: PrivacySubject) {
    let withdrawn = 0;
    for (const partyId of subject.partyIds) {
      const granted = (await this.consents.current(partyId, DEFAULT_LOCALE)).filter((state) => state.granted).map((state) => ({ purpose: state.purpose, granted: false }));
      if (granted.length === 0) continue;
      await this.consents.record(partyId, granted, { channel: ConsentChannel.api, basis: ConsentBasis.consent, evidence: `${ERASURE_EVIDENCE} ${subject.requestRef}` }, DEFAULT_LOCALE);
      withdrawn += granted.length;
    }
    return { withdrawn };
  }
}
