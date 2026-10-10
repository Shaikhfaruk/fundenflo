import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { ApplicationRepository } from '../infrastructure/application.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Applications)
export class ApplicationMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: ApplicationRepository) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.idsOfParty(sourceId);
    await this.repository.moveParty(ids, targetId);
    return ids;
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveParty({ party: movedIds(undo, 'party'), acting: movedIds(undo, 'acting') }, sourceId);
  }
}
