import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { OWNER_NAMED_SUB_SEGMENTS } from '../domain/borrower.constants.js';
import { BorrowerProfileRepository } from '../infrastructure/borrower-profile.repository.js';

const PROFILE_SCAN_LIMIT = 100;

@PrivacyParticipantFor(PrivacySection.Borrowers)
export class BorrowerPrivacyParticipant implements PrivacyParticipant {
  constructor(private readonly profiles: BorrowerProfileRepository) {}

  async relatedParties(personPartyId: string) {
    return (await this.profiles.list({ actingPartyId: personPartyId, subSegmentKey: { in: [...OWNER_NAMED_SUB_SEGMENTS] } }, PROFILE_SCAN_LIMIT)).map((profile) => profile.partyId).filter((partyId) => partyId !== personPartyId);
  }

  async export(subject: PrivacySubject) {
    return (await this.profiles.list({ OR: [{ partyId: { in: subject.partyIds } }, { actingPartyId: subject.personPartyId }] }, PROFILE_SCAN_LIMIT)).map((profile) => ({ id: profile.id, segment: profile.segmentKey, subSegment: profile.subSegmentKey, createdAt: profile.createdAt.toISOString() }));
  }
}
