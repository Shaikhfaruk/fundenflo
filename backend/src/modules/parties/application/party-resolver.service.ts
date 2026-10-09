import { Injectable } from '@nestjs/common';

import { EventName } from '../../../common/events/event-names.js';
import type { ContactType } from '../../../common/enums/db.enums.js';
import { decideMatch } from '../../../engines/party-matching/decide.js';
import { decideLeadMatch } from '../../../engines/party-matching/lead-match.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { type ContactSource, MatchSignal } from '../domain/party.constants.js';
import { PartyRepository } from '../infrastructure/party.repository.js';
import { ContactCodec } from './contact-codec.service.js';
import { PartyService } from './party.service.js';

export type ResolveOutcome = 'linked' | 'created' | 'created_with_review';

export type ResolvedParty = {
  partyId: string;
  outcome: ResolveOutcome;
};

export type UnverifiedContact = { type: ContactType; value: string };

export type LeadPartyResolution = ResolvedParty & { doNotContact: boolean; invalidContact: boolean };

@Injectable()
export class PartyResolver {
  constructor(
    private readonly parties: PartyRepository,
    private readonly partyService: PartyService,
    private readonly codec: ContactCodec,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async resolvePersonByVerifiedContact(
    type: ContactType,
    value: string,
    source: ContactSource,
    displayName?: string | null,
  ): Promise<ResolvedParty> {
    const hash = this.codec.hash(type, value);
    const candidates = await this.parties.findContactCandidates(type, hash);
    const decision = decideMatch(candidates.map((candidate) => ({ partyId: candidate.partyId, hasLogin: Boolean(candidate.party.user) })));
    const contact = { type, value, verified: true, primary: true, source };

    if (decision.outcome === 'single') {
      await this.partyService.addContact(decision.partyId, contact);
      return { partyId: decision.partyId, outcome: 'linked' };
    }

    const party = await this.partyService.createPerson({ displayName, contact });
    if (decision.outcome === 'none') return { partyId: party.id, outcome: 'created' };

    const verified = new Set(candidates.filter((candidate) => candidate.verifiedAt).map((candidate) => candidate.partyId));
    await this.openReview(party.id, decision.partyIds, verified, type);
    return { partyId: party.id, outcome: 'created_with_review' };
  }

  async resolvePersonForLead(contacts: UnverifiedContact[], displayName: string | null, source: ContactSource): Promise<LeadPartyResolution> {
    const found: Array<Awaited<ReturnType<PartyRepository['findContactCandidates']>>[number] & { type: ContactType }> = [];
    for (const contact of contacts) {
      for (const candidate of await this.parties.findContactCandidates(contact.type, this.codec.hash(contact.type, contact.value))) found.push({ ...candidate, type: contact.type });
    }
    const decision = decideLeadMatch(
      found.map((candidate) => ({ partyId: candidate.partyId, displayName: candidate.party.displayName, verified: Boolean(candidate.verifiedAt) })),
      displayName,
    );
    const status = (partyId: string) => ({
      doNotContact: found.some((candidate) => candidate.partyId === partyId && candidate.doNotContact),
      invalidContact: found.some((candidate) => candidate.partyId === partyId && candidate.invalidAt !== null),
    });

    if (decision.outcome === 'single') {
      for (const contact of contacts) await this.partyService.addContact(decision.partyId, { ...contact, verified: false, primary: false, source });
      return { partyId: decision.partyId, outcome: 'linked', ...status(decision.partyId) };
    }

    const seenTypes = new Set<ContactType>();
    const [first, ...rest] = contacts.map((contact) => {
      const primary = !seenTypes.has(contact.type);
      seenTypes.add(contact.type);
      return { ...contact, verified: false, primary, source };
    });
    const party = await this.partyService.createPerson({ displayName, contact: first });
    for (const contact of rest) await this.partyService.addContact(party.id, contact);
    if (decision.outcome === 'none') return { partyId: party.id, outcome: 'created', doNotContact: false, invalidContact: false };

    const verified = new Set(found.filter((candidate) => candidate.verifiedAt).map((candidate) => candidate.partyId));
    await this.openReview(party.id, decision.partyIds, verified, found[0]?.type ?? contacts[0]?.type);
    return { partyId: party.id, outcome: 'created_with_review', doNotContact: false, invalidContact: false };
  }

  private async openReview(partyId: string, candidatePartyIds: string[], verified: Set<string>, contactType: ContactType | undefined) {
    const review = await this.parties.createMatchReview({
      partyId,
      candidatePartyIds,
      signals: candidatePartyIds.map((candidateId) => ({
        partyId: candidateId,
        signal: verified.has(candidateId) ? MatchSignal.SharedVerifiedContact : MatchSignal.SharedContact,
        contactType: contactType ?? null,
      })),
    });
    await this.outbox.publish({
      name: EventName.PartyMatchReviewOpened,
      aggregateType: 'party',
      aggregateId: partyId,
      payload: { reviewId: review.id, partyId, candidatePartyIds },
    });
    await this.audit.record({
      action: AuditAction.PartyMatchReviewOpened,
      entityType: AuditEntity.Party,
      entityId: partyId,
      metadata: { reviewId: review.id, candidates: candidatePartyIds.length },
    });
  }
}
