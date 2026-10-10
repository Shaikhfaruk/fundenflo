import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { ConsentRepository } from '../infrastructure/consent.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Consents)
export class ConsentMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: ConsentRepository) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.consentIdsOfParty(sourceId);
    await this.repository.moveConsents(ids, targetId);
    return ids;
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveConsents({ records: movedIds(undo, 'records'), requests: movedIds(undo, 'requests') }, sourceId);
  }
}
