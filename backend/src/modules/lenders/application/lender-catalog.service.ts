import { Injectable } from '@nestjs/common';

import { ConfigResource } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { CaseLocation, CompiledLenderProduct } from '../../../engines/lending/lending.types.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { PlaceLocator } from '../../catalog/application/place-locator.service.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { PublishedConfig } from '../../config-publishing/domain/config.types.js';
import { LENDER_CACHE_TAG, LENDER_CACHE_TTL_SECONDS } from '../domain/lender.constants.js';
import { LenderRepository } from '../infrastructure/lender.repository.js';

export type LiveProduct = PublishedConfig<CompiledLenderProduct>;

export const UNKNOWN_LOCATION: CaseLocation = { stateId: null, cityId: null, pincode: null };

@Injectable()
export class LenderCatalogService {
  constructor(
    private readonly config: ConfigPublishingService,
    private readonly lenders: LenderRepository,
    private readonly cache: CacheService,
    private readonly places: PlaceLocator,
  ) {}

  async liveProducts(now = new Date()): Promise<LiveProduct[]> {
    const products = await this.config.active<CompiledLenderProduct>(ConfigResource.lender_product, now);
    const live = await this.liveLenderIds(now);
    return products.filter((product) => live.has(product.compiled.lenderId));
  }

  async locate(input: { pincode?: string | null; cityId?: string | null; stateId?: string | null }): Promise<CaseLocation> {
    if (input.stateId) return { stateId: input.stateId, cityId: input.cityId ?? null, pincode: input.pincode ?? null };
    if (!input.pincode && !input.cityId) return UNKNOWN_LOCATION;
    try {
      const place = await this.places.locate({ pincode: input.pincode ?? undefined, cityId: input.cityId ?? undefined });
      return { stateId: place.stateId, cityId: place.cityId, pincode: place.pincode };
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCode.VALIDATION_FAILED) return { ...UNKNOWN_LOCATION, pincode: input.pincode ?? null };
      throw error;
    }
  }

  private async liveLenderIds(now: Date) {
    const day = now.toISOString().slice(0, 10);
    return new Set(await this.cache.wrap(`lenders:live:${day}`, [LENDER_CACHE_TAG], LENDER_CACHE_TTL_SECONDS, () => this.lenders.liveLenderIds(now)));
  }
}
