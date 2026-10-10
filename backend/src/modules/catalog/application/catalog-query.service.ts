import { Injectable } from '@nestjs/common';

import { AliasKind, CatalogStatus } from '../../../common/enums/db.enums.js';
import { DEFAULT_LOCALE, type Locale } from '../../../common/i18n/locale.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CATALOG_CACHE_TTL_SECONDS, CatalogCacheTag } from '../domain/catalog.constants.js';
import { normaliseLookupText } from '../domain/alias.js';
import { CatalogRepository } from '../infrastructure/catalog.repository.js';
import { GeoRepository } from '../infrastructure/geo.repository.js';
import { type AvailabilityContext, CategoryAvailabilityService } from './category-availability.service.js';
import { type CategoryConfigView, type CategoryView, type SegmentView, toCategoryConfigView, toSegmentView } from './catalog.views.js';

@Injectable()
export class CatalogQueryService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly availability: CategoryAvailabilityService,
    private readonly cache: CacheService,
    private readonly geo: GeoRepository,
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

  async referenceKeys(): Promise<{ segments: Set<string>; subSegments: Set<string>; categories: Set<string> }> {
    const [segments, categories] = await Promise.all([this.segments(DEFAULT_LOCALE), this.categoryConfigs(DEFAULT_LOCALE, undefined)]);
    return {
      segments: new Set(segments.map((segment) => segment.key)),
      subSegments: new Set(segments.flatMap((segment) => segment.subSegments.map((sub) => sub.key))),
      categories: new Set(categories.map((category) => category.key)),
    };
  }

  async categoryLabel(key: string, locale: Locale): Promise<string> {
    return (await this.categoryConfigs(locale, undefined)).find((config) => config.key === key)?.label ?? key;
  }

  async resolveCategory(text: string): Promise<{ key: string; purposeKeys: string[] } | null> {
    const direct = await this.findActiveCategory(text.trim().toLowerCase());
    const category = direct ?? (await this.categoryByLabel(text)) ?? (await this.categoryByAlias(text));
    return category ? { key: category.key, purposeKeys: category.purposes.filter((purpose) => purpose.status === CatalogStatus.active).map((purpose) => purpose.key) } : null;
  }

  private async categoryByLabel(text: string) {
    const wanted = normaliseLookupText(text);
    const match = (await this.categoryConfigs(DEFAULT_LOCALE, undefined)).find((config) => normaliseLookupText(config.label) === wanted);
    return match ? this.findActiveCategory(match.key) : null;
  }

  private async categoryByAlias(text: string) {
    const [alias] = await this.geo.findAliases(AliasKind.category, [normaliseLookupText(text)]);
    if (!alias) return null;
    const category = await this.catalog.findCategory(alias.targetId);
    return category && category.status === CatalogStatus.active ? category : null;
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
