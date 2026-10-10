import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeParties, movedIds, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { ConsistencyRepository } from '../infrastructure/consistency.repository.js';
import { FactRepository } from '../infrastructure/fact.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Facts)
export class FactMergeParticipant implements PartyMergeParticipant {
  constructor(
    private readonly repository: FactRepository,
    private readonly signals: ConsistencyRepository,
  ) {}

  async merge({ sourceId, targetId }: MergeParties) {
    const ids = await this.repository.factIdsOfParty(sourceId);
    const signals = await this.signals.idsOfParty(sourceId);
    await this.repository.moveFacts(ids, targetId);
    await this.signals.moveParty(signals, targetId);
    return { ids, signals };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    await this.repository.moveFacts(movedIds(undo, 'ids'), sourceId);
    await this.signals.moveParty(movedIds(undo, 'signals'), sourceId);
  }
}
