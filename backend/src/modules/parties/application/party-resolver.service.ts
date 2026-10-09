import { Injectable } from '@nestjs/common';

import { EventName } from '../../../common/events/event-names.js';
import type { ContactType } from '../../../common/enums/db.enums.js';
import { decideMatch } from '../../../engines/party-matching/decide.js';
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
    const review = await this.parties.createMatchReview({
      partyId: party.id,
      candidatePartyIds: decision.partyIds,
      signals: decision.partyIds.map((partyId) => ({
        partyId,
        signal: verified.has(partyId) ? MatchSignal.SharedVerifiedContact : MatchSignal.SharedContact,
        contactType: type,
      })),
    });
    await this.outbox.publish({
      name: EventName.PartyMatchReviewOpened,
      aggregateType: 'party',
      aggregateId: party.id,
      payload: { reviewId: review.id, partyId: party.id, candidatePartyIds: decision.partyIds },
    });
    await this.audit.record({
      action: AuditAction.PartyMatchReviewOpened,
      entityType: AuditEntity.Party,
      entityId: party.id,
      metadata: { reviewId: review.id, candidates: decision.partyIds.length },
    });
    return { partyId: party.id, outcome: 'created_with_review' };
  }
}
