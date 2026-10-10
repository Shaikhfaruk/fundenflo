import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Leads)
export class LeadMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: LeadRepository) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.leadIdsOfParty(sourceId);
    await this.repository.moveLeads(ids, targetId);
    return ids;
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveLeads({ person: movedIds(undo, 'person'), business: movedIds(undo, 'business') }, sourceId);
  }
}
