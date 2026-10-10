import { PartyMergeParticipantFor } from '../../parties/application/party-merge.registry.js';
import { PartyMergeParticipantKey } from '../../parties/domain/party.constants.js';
import { type MergeIssue, type MergeParties, type PartyMergeParticipant } from '../../parties/domain/party-merge.types.js';
import { AccessRepository } from '../infrastructure/access.repository.js';

@PartyMergeParticipantFor(PartyMergeParticipantKey.Organizations)
export class OrganizationMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly repository: AccessRepository) {}

  async check({ sourceId, targetId }: MergeParties): Promise<MergeIssue[]> {
    const [source, target] = await Promise.all([this.repository.findOrganizationByParty(sourceId), this.repository.findOrganizationByParty(targetId)]);
    return source && target ? [{ path: 'parties', code: 'two_organizations', message: 'both businesses operate their own organization on the platform' }] : [];
  }

  async merge({ sourceId, targetId }: MergeParties) {
    const organization = await this.repository.findOrganizationByParty(sourceId);
    if (organization) await this.repository.moveOrganizationParty(organization.id, targetId);
    return { organizationId: organization?.id ?? null };
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    const organizationId = (undo as { organizationId?: string | null } | null)?.organizationId;
    if (organizationId) await this.repository.moveOrganizationParty(organizationId, sourceId);
  }
}
