import { BorrowerProfileStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { DocumentOwnerFor } from '../../documents/application/document-owner.registry.js';
import { DocumentOwnerKind } from '../../documents/domain/document.constants.js';
import type { DocumentOwner, DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { BorrowerProfileService } from './borrower-profile.service.js';

@DocumentOwnerFor(DocumentOwnerKind.BorrowerProfile)
export class BorrowerProfileDocumentOwner implements DocumentOwner {
  constructor(private readonly profiles: BorrowerProfileService) {}

  async scopeForUpload(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    const profile = await this.profiles.get(id, ability, AppAction.Update);
    if (profile.status !== BorrowerProfileStatus.active) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: profile.status, event: 'upload_document', allowed: [] } });
    return { partyId: profile.partyId, borrowerProfileId: profile.id, applicationId: null, partnerOrganizationId: profile.partnerOrganizationId };
  }
}
