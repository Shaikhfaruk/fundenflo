import { Outcome } from '../../../engines/conditions/condition.types.js';
import { coverageOutcome } from '../../../engines/lending/coverage.js';
import { CategoryRouteSourceFor } from '../../catalog/application/category-route.registry.js';
import type { AvailabilityContext, CategoryRouteSource } from '../../catalog/domain/category-route.types.js';
import { LENDER_ROUTE_SOURCE_KEY } from '../domain/lender.constants.js';
import { LenderCatalogService } from './lender-catalog.service.js';

@CategoryRouteSourceFor(LENDER_ROUTE_SOURCE_KEY)
export class LenderRouteSource implements CategoryRouteSource {
  constructor(private readonly catalog: LenderCatalogService) {}

  async availableCategories(categoryKeys: string[], context: AvailabilityContext): Promise<Set<string>> {
    const wanted = new Set(categoryKeys);
    const location = await this.catalog.locate({ pincode: context.pincode });
    const products = await this.catalog.liveProducts();
    return new Set(
      products
        .filter(({ compiled }) => wanted.has(compiled.category) && (!context.segmentKey || compiled.segments.includes(context.segmentKey)) && coverageOutcome(compiled.coverage, location) !== Outcome.Fail)
        .map(({ compiled }) => compiled.category),
    );
  }
}
