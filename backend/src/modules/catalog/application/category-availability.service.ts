import { Injectable } from '@nestjs/common';

import { AvailabilityReason } from '../domain/catalog.constants.js';
import type { AvailabilityContext } from '../domain/category-route.types.js';
import type { CategoryAvailability } from './catalog.views.js';
import { CategoryRouteRegistry } from './category-route.registry.js';

@Injectable()
export class CategoryAvailabilityService {
  constructor(private readonly routes: CategoryRouteRegistry) {}

  async evaluate(categoryKeys: string[], context: AvailabilityContext): Promise<Map<string, CategoryAvailability>> {
    const available = await this.routes.available(categoryKeys, context);
    return new Map(categoryKeys.map((key) => [key, available.has(key) ? { available: true, reason: null } : { available: false, reason: AvailabilityReason.NoVerifiedLenderRoute }]));
  }
}
