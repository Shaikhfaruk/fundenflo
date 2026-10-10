import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeIssue, type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { ApplicationRepository } from '../infrastructure/application.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Applications)
export class ApplicationMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: ApplicationRepository) {}

  async check({ sourceId, targetId }: MergeParties): Promise<MergeIssue[]> {
    const shared = await this.repository.sharedApplications(sourceId, targetId);
    return shared.length > 0 ? [{ path: 'parties', code: 'same_application', message: `both parties are on application ${shared.join(', ')}; remove one first` }] : [];
  }

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.idsOfParty(sourceId);
    const members = await this.repository.partyRowIdsOfParty(sourceId);
    await this.repository.moveParty(ids, targetId);
    await this.repository.movePartyRows(members, targetId);
    return { ...ids, members };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveParty({ party: movedIds(undo, 'party'), acting: movedIds(undo, 'acting') }, sourceId);
    await this.repository.movePartyRows(movedIds(undo, 'members'), sourceId);
  }
}
