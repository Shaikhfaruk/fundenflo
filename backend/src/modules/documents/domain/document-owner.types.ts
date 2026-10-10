import type { AppAbility } from '../../access/domain/ability.types.js';

export type DocumentOwnerScope = {
  partyId: string;
  borrowerProfileId: string | null;
  applicationId: string | null;
  partnerOrganizationId: string | null;
};

export interface DocumentOwner {
  scopeForUpload(id: string, ability: AppAbility): Promise<DocumentOwnerScope>;
}
