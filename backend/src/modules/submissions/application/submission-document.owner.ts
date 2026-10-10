import type { AppAbility } from '../../access/domain/ability.types.js';
import { DocumentOwnerFor } from '../../documents/application/document-owner.registry.js';
import { DocumentOwnerKind } from '../../documents/domain/document.constants.js';
import type { DocumentOwner, DocumentOwnerScope } from '../../documents/domain/document-owner.types.js';
import { SubmissionService } from './submission.service.js';

@DocumentOwnerFor(DocumentOwnerKind.Submission)
export class SubmissionDocumentOwner implements DocumentOwner {
  constructor(private readonly submissions: SubmissionService) {}

  scopeForUpload(id: string, ability: AppAbility): Promise<DocumentOwnerScope> {
    return this.submissions.documentScope(id, ability);
  }
}
