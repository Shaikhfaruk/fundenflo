import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { FactRepository } from '../infrastructure/fact.repository.js';
import { FactService } from './fact.service.js';

@PrivacyParticipantFor(PrivacySection.Facts)
export class FactPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly facts: FactService,
    private readonly repository: FactRepository,
  ) {}

  async export(subject: PrivacySubject) {
    const out = [];
    for (const partyId of subject.partyIds) for (const fact of (await this.facts.current(partyId)).values()) out.push({ partyId, attribute: fact.attributeKey, value: fact.value, provenance: fact.provenance, observedAt: fact.observedAt });
    return out;
  }

  async erase(subject: PrivacySubject) {
    return { facts: (await this.repository.deleteForParties(subject.partyIds)).count };
  }
}
