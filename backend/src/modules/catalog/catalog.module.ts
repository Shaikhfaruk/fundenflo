import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CatalogAdminService } from './application/catalog-admin.service.js';
import { CatalogQueryService } from './application/catalog-query.service.js';
import { CategoryAvailabilityService } from './application/category-availability.service.js';
import { CategoryRouteRegistry } from './application/category-route.registry.js';
import { GeoService } from './application/geo.service.js';
import { PlaceLocator } from './application/place-locator.service.js';
import { AdminCatalogController } from './http/admin-catalog.controller.js';
import { AdminGeoController } from './http/admin-geo.controller.js';
import { CatalogController } from './http/catalog.controller.js';
import { CatalogRepository } from './infrastructure/catalog.repository.js';
import { GeoRepository } from './infrastructure/geo.repository.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [CatalogController, AdminCatalogController, AdminGeoController],
  providers: [CatalogRepository, GeoRepository, CategoryRouteRegistry, CategoryAvailabilityService, CatalogQueryService, CatalogAdminService, GeoService, PlaceLocator],
  exports: [CatalogQueryService, GeoService, PlaceLocator],
})
export class CatalogModule {}
