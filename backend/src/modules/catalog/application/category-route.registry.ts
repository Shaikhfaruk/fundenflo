import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { type AvailabilityContext, CATEGORY_ROUTE_SOURCE_METADATA, type CategoryRouteSource } from '../domain/category-route.types.js';

export const CategoryRouteSourceFor = (key: string) => applyDecorators(Injectable(), SetMetadata(CATEGORY_ROUTE_SOURCE_METADATA, key));

@Injectable()
export class CategoryRouteRegistry implements OnModuleInit {
  private sources: CategoryRouteSource[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.sources = [...collectKeyedProviders<string, CategoryRouteSource>(this.discovery, this.reflector, CATEGORY_ROUTE_SOURCE_METADATA).values()];
  }

  async available(categoryKeys: string[], context: AvailabilityContext): Promise<Set<string>> {
    const found = new Set<string>();
    for (const source of this.sources) for (const key of await source.availableCategories(categoryKeys, context)) found.add(key);
    return found;
  }
}
