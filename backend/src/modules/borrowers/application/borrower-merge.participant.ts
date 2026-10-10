import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeIssue, type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { BorrowerProfileRepository } from '../infrastructure/borrower-profile.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Borrowers)
export class BorrowerMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: BorrowerProfileRepository) {}

  async check({ sourceId, targetId }: MergeParties): Promise<MergeIssue[]> {
    const source = await this.repository.findByParty(sourceId);
    const target = await this.repository.findByParty(targetId);
    return source && target ? [{ path: 'parties', code: 'two_borrower_profiles', message: 'both parties already have a borrower profile with their own applications' }] : [];
  }

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.idsOfParty(sourceId);
    await this.repository.moveParty(ids, targetId);
    return ids;
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveParty({ party: movedIds(undo, 'party'), acting: movedIds(undo, 'acting') }, sourceId);
  }
}
