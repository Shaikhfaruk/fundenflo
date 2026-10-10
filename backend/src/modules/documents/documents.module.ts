import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../infrastructure/storage/storage.port.js';
import { AntivirusModule } from '../../integrations/antivirus/antivirus.module.js';
import { ExtractionModule } from '../../integrations/extraction/extraction.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { BorrowersModule } from '../borrowers/borrowers.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { SlaModule } from '../sla/sla.module.js';
import { DocumentChecklistService } from './application/document-checklist.service.js';
import { DocumentMergeParticipant } from './application/document-merge.participant.js';
import { DocumentOwnerRegistry } from './application/document-owner.registry.js';
import { DocumentRequirementHandler } from './application/document-requirement.handler.js';
import { DocumentScanSlaHandler } from './application/document-scan-sla.handler.js';
import { DocumentScanService } from './application/document-scan.service.js';
import { DocumentTypeService } from './application/document-type.service.js';
import { DocumentService } from './application/document.service.js';
import { ExtractionService } from './application/extraction.service.js';
import { DOCUMENT_UPLOAD_LIMITS } from './domain/document.constants.js';
import { AdminDocumentTypesController } from './http/admin-document-types.controller.js';
import { CatalogDocumentChecklistController } from './http/catalog-document-checklist.controller.js';
import { DocumentsController } from './http/documents.controller.js';
import { OpsDocumentsController } from './http/ops-documents.controller.js';
import { DocumentExtractProcessor } from './infrastructure/document-extract.processor.js';
import { DocumentScanProcessor } from './infrastructure/document-scan.processor.js';
import { DocumentTypeRepository } from './infrastructure/document-type.repository.js';
import { DocumentUploadEngine } from './infrastructure/document-upload.engine.js';
import { DocumentRepository } from './infrastructure/document.repository.js';

const AdminDocumentRequirementsController = createVersionedConfigController({ resource: ConfigResource.document_requirement, path: 'document-requirements', name: 'AdminDocumentRequirementsController' });

export const DOCUMENT_PROCESSORS = [DocumentScanProcessor, DocumentExtractProcessor];

@Module({
  imports: [
    AntivirusModule,
    AttributesModule,
    BorrowersModule,
    CatalogModule,
    ConfigPublishingModule,
    ConsentsModule,
    DiscoveryModule,
    ExtractionModule,
    SlaModule,
    MulterModule.registerAsync({ inject: [OBJECT_STORAGE], useFactory: (storage: ObjectStorage) => ({ storage: new DocumentUploadEngine(storage), limits: DOCUMENT_UPLOAD_LIMITS }) }),
  ],
  controllers: [AdminDocumentTypesController, AdminDocumentRequirementsController, CatalogDocumentChecklistController, DocumentsController, OpsDocumentsController],
  providers: [
    DocumentTypeRepository,
    DocumentRepository,
    DocumentTypeService,
    DocumentRequirementHandler,
    DocumentChecklistService,
    DocumentOwnerRegistry,
    DocumentService,
    DocumentScanService,
    ExtractionService,
    DocumentScanSlaHandler,
    DocumentMergeParticipant,
  ],
  exports: [DocumentTypeService, DocumentChecklistService, DocumentService, DocumentScanService, ExtractionService],
})
export class DocumentsModule {}
