import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { DocumentChecklistService } from './application/document-checklist.service.js';
import { DocumentRequirementHandler } from './application/document-requirement.handler.js';
import { DocumentTypeService } from './application/document-type.service.js';
import { AdminDocumentTypesController } from './http/admin-document-types.controller.js';
import { CatalogDocumentChecklistController } from './http/catalog-document-checklist.controller.js';
import { DocumentTypeRepository } from './infrastructure/document-type.repository.js';

const AdminDocumentRequirementsController = createVersionedConfigController({ resource: ConfigResource.document_requirement, path: 'document-requirements', name: 'AdminDocumentRequirementsController' });

@Module({
  imports: [AttributesModule, CatalogModule, ConfigPublishingModule],
  controllers: [AdminDocumentTypesController, AdminDocumentRequirementsController, CatalogDocumentChecklistController],
  providers: [DocumentTypeRepository, DocumentTypeService, DocumentRequirementHandler, DocumentChecklistService],
  exports: [DocumentTypeService, DocumentChecklistService],
})
export class DocumentsModule {}
