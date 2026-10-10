import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { DocumentRepository } from '../infrastructure/document.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Documents)
export class DocumentMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: DocumentRepository) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const documents = await this.repository.idsOfParty(sourceId);
    await this.repository.moveParty(documents, targetId);
    return { documents };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveParty(movedIds(undo, 'documents'), sourceId);
  }
}
