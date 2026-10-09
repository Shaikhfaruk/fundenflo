import { Module } from '@nestjs/common';

import { CatalogAdminService } from './application/catalog-admin.service.js';
import { CatalogQueryService } from './application/catalog-query.service.js';
import { CategoryAvailabilityService } from './application/category-availability.service.js';
import { GeoService } from './application/geo.service.js';
import { AdminCatalogController } from './http/admin-catalog.controller.js';
import { AdminGeoController } from './http/admin-geo.controller.js';
import { CatalogController } from './http/catalog.controller.js';
import { CatalogRepository } from './infrastructure/catalog.repository.js';
import { GeoRepository } from './infrastructure/geo.repository.js';

@Module({
  controllers: [CatalogController, AdminCatalogController, AdminGeoController],
  providers: [CatalogRepository, GeoRepository, CategoryAvailabilityService, CatalogQueryService, CatalogAdminService, GeoService],
  exports: [CatalogQueryService, GeoService],
})
export class CatalogModule {}
