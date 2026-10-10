import type { AppAbility } from '../../access/domain/ability.types.js';
import { DocumentOwnerFor } from '../../documents/application/document-owner.registry.js';
import { DocumentOwnerKind } from '../../documents/domain/document.constants.js';
import type { DocumentOwner, DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { ApplicationService } from './application.service.js';

@DocumentOwnerFor(DocumentOwnerKind.Application)
export class ApplicationDocumentOwner implements DocumentOwner {
  constructor(private readonly applications: ApplicationService) {}

  scopeForUpload(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    return this.applications.documentScope(id, ability);
  }
}
