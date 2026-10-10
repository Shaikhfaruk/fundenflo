import { Logger } from '@nestjs/common';

import { DocumentStatus } from '../../../common/enums/db.enums.js';
import { InjectObjectStorage, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { DocumentRepository } from '../infrastructure/document.repository.js';

@PrivacyParticipantFor(PrivacySection.Documents)
export class DocumentPrivacyParticipant implements PrivacyParticipant {
  private readonly logger = new Logger(DocumentPrivacyParticipant.name);

  constructor(
    private readonly documents: DocumentRepository,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  async export(subject: PrivacySubject) {
    return (await this.documents.listForParties(subject.partyIds)).map((document) => ({ id: document.id, documentType: document.documentType.key, fileName: document.fileName, status: document.status, uploadedAt: document.createdAt.toISOString(), sharedWithLenders: document.lockedAt !== null }));
  }

  async erase(subject: PrivacySubject) {
    let purged = 0;
    let blobs = 0;
    for (const document of await this.documents.listForParties(subject.partyIds)) {
      const removed = await this.removeBlob(document.storageKey);
      await this.documents.update(document.id, { status: DocumentStatus.purged, deletedAt: new Date(), passwordEnc: null, ...(removed ? { storageDeletedAt: new Date() } : {}) });
      purged += 1;
      if (removed) blobs += 1;
    }
    return { documents: purged, files: blobs };
  }

  private async removeBlob(storageKey: string) {
    try {
      await this.storage.delete(storageKey);
      return true;
    } catch (error) {
      this.logger.warn({ err: error }, 'Document file was not removed during erasure; the retention sweep retries');
      return false;
    }
  }
}
