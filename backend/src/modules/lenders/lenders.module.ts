import { Module } from '@nestjs/common';

import { ConfigResource } from '../../common/enums/db.enums.js';
import { AccessModule } from '../access/access.module.js';
import { AttributesModule } from '../attributes/attributes.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConfigPublishingModule } from '../config-publishing/config-publishing.module.js';
import { createVersionedConfigController } from '../config-publishing/http/versioned-config.controller.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { LenderCatalogService } from './application/lender-catalog.service.js';
import { LenderDocumentOwner } from './application/lender-document.owner.js';
import { LenderNeedSource } from './application/lender-need.source.js';
import { LenderPortalService } from './application/lender-portal.service.js';
import { LenderProductHandler } from './application/lender-product.handler.js';
import { LenderRouteSource } from './application/lender-route.source.js';
import { LenderSimulationService } from './application/lender-simulation.service.js';
import { LenderService } from './application/lender.service.js';
import { AdminLenderProductSimulateController } from './http/admin-lender-product-simulate.controller.js';
import { AdminLendersController } from './http/admin-lenders.controller.js';
import { LenderProductsController } from './http/lender-products.controller.js';
import { LenderRepository } from './infrastructure/lender.repository.js';

const AdminLenderProductsController = createVersionedConfigController({ resource: ConfigResource.lender_product, path: 'lender-products', name: 'AdminLenderProductsController' });

@Module({
  imports: [AccessModule, AttributesModule, CatalogModule, ConfigPublishingModule, DocumentsModule],
  controllers: [AdminLendersController, AdminLenderProductsController, AdminLenderProductSimulateController, LenderProductsController],
  providers: [LenderRepository, LenderService, LenderProductHandler, LenderCatalogService, LenderSimulationService, LenderRouteSource, LenderNeedSource, LenderDocumentOwner, LenderPortalService],
  exports: [LenderService, LenderCatalogService],
})
export class LendersModule {}
