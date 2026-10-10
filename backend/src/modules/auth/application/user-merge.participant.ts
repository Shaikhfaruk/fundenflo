import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeIssue, type MergeParties, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Users)
export class UserMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: IdentityRepository) {}

  async check({ sourceId, targetId }: MergeParties): Promise<MergeIssue[]> {
    const source = await this.repository.findUserByParty(sourceId);
    const target = await this.repository.findUserByParty(targetId);
    return source && target ? [{ path: 'parties', code: 'two_logins', message: 'both parties have their own login; they are treated as different people' }] : [];
  }

  async merge({ sourceId, targetId }: MergeParties) {
    const user = await this.repository.findUserByParty(sourceId);
    if (user) await this.repository.moveUserParty(user.id, targetId);
    return { userId: user?.id ?? null };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    const userId = (undo as { userId?: string | null } | null)?.userId;
    if (userId) await this.repository.moveUserParty(userId, sourceId);
  }
}
