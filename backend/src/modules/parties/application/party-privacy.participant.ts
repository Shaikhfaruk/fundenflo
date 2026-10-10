import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { PartyRepository } from '../infrastructure/party.repository.js';
import { PartyService } from './party.service.js';

@PrivacyParticipantFor(PrivacySection.Profile)
export class PartyPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly parties: PartyService,
    private readonly repository: PartyRepository,
  ) {}

  async export(subject: PrivacySubject) {
    const out = [];
    for (const partyId of subject.partyIds) {
      const party = await this.repository.findById(partyId);
      if (!party) continue;
      const contacts = (await this.parties.listContacts(partyId, true)).map((contact) => ({ type: contact.type, value: contact.value, primary: contact.primary }));
      const identifiers = (await this.repository.listIdentifiers(partyId)).map((identifier) => ({ type: identifier.type, masked: identifier.valueMasked, verified: identifier.verifiedAt !== null }));
      out.push({ partyId, kind: party.kind, displayName: party.displayName, preferredLanguage: party.preferredLanguage, contacts, identifiers });
    }
    return out;
  }

  async erase(subject: PrivacySubject) {
    const contacts = await this.repository.deleteContactsOf(subject.partyIds);
    const identifiers = await this.repository.deleteIdentifiersOf(subject.partyIds);
    const parties = await this.repository.anonymise(subject.partyIds);
    return { contacts: contacts.count, identifiers: identifiers.count, parties: parties.count };
  }
}
