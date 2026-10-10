import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { DocumentOwnerFor } from '../../documents/application/document-owner.registry.js';
import { DocumentOwnerKind } from '../../documents/domain/document.constants.js';
import type { DocumentOwner, DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { LenderService } from './lender.service.js';

@DocumentOwnerFor(DocumentOwnerKind.Lender)
export class LenderDocumentOwner implements DocumentOwner {
  constructor(private readonly lenders: LenderService) {}

  async scopeForUpload(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    const lender = await this.lenders.visible(id, ability, AppAction.Update);
    return { partyId: lender.organization.partyId, borrowerProfileId: null, applicationId: null, partnerOrganizationId: null };
  }
}
