import { Injectable } from '@nestjs/common';

import { CatalogStatus } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CATALOG_CACHE_TTL_SECONDS, CatalogCacheTag } from '../domain/catalog.constants.js';
import { CatalogRepository } from '../infrastructure/catalog.repository.js';
import { type AvailabilityContext, CategoryAvailabilityService } from './category-availability.service.js';
import { type CategoryConfigView, type CategoryView, type SegmentView, toCategoryConfigView, toSegmentView } from './catalog.views.js';

@Injectable()
export class CatalogQueryService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly availability: CategoryAvailabilityService,
    private readonly cache: CacheService,
  ) {}

  segments(locale: Locale): Promise<SegmentView[]> {
    return this.cache.wrap(`segments:${locale}`, [CatalogCacheTag.Catalog], CATALOG_CACHE_TTL_SECONDS, async () =>
      (await this.catalog.listSegments(true)).map((segment) => toSegmentView(segment, locale)),
    );
  }

  async categories(locale: Locale, context: AvailabilityContext): Promise<CategoryView[]> {
    const configs = await this.categoryConfigs(locale, context.segmentKey);
    const availability = await this.availability.evaluate(
      configs.map((config) => config.key),
      context,
    );
    return configs.map((config) => ({ ...config, availability: availability.get(config.key) ?? { available: false, reason: null } }));
  }

  async findActiveCategory(key: string) {
    const category = await this.catalog.findCategoryByKey(key);
    return category && category.status === CatalogStatus.active ? category : null;
  }

  private categoryConfigs(locale: Locale, segmentKey: string | undefined): Promise<CategoryConfigView[]> {
    return this.cache.wrap(`categories:${segmentKey ?? '*'}:${locale}`, [CatalogCacheTag.Catalog], CATALOG_CACHE_TTL_SECONDS, async () => {
      const categories = await this.catalog.listCategories({
        status: CatalogStatus.active,
        ...(segmentKey ? { segments: { some: { segment: { key: segmentKey, status: CatalogStatus.active } } } } : {}),
      });
      const order = (category: (typeof categories)[number]) =>
        segmentKey ? (category.segments.find((link) => link.segment.key === segmentKey)?.sortOrder ?? category.sortOrder) : category.sortOrder;
      return categories.toSorted((a, b) => order(a) - order(b)).map((category) => toCategoryConfigView(category, locale));
    });
  }
}
