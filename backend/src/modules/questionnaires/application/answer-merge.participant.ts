import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { AnswerRepository } from '../infrastructure/answer.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Answers)
export class AnswerMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: AnswerRepository) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.answerIdsOfParty(sourceId);
    await this.repository.moveAnswers(ids, targetId);
    return { ids };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveAnswers(movedIds(undo, 'ids'), sourceId);
  }
}
