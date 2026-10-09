import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { CatalogQueryService } from '../application/catalog-query.service.js';
import { GeoService } from '../application/geo.service.js';
import { type CategoriesQuery, categoriesQuerySchema, type CitySearchQuery, citySearchSchema, pincodeSchema } from './catalog.dto.js';

@Controller('catalog')
@Public()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly geo: GeoService,
  ) {}

  @Get('segments')
  async segments(@RequestLocale() locale: Locale) {
    return { items: await this.catalog.segments(locale) };
  }

  @Get('loan-categories')
  async categories(@ValidQuery(categoriesQuerySchema) query: CategoriesQuery, @RequestLocale() locale: Locale) {
    return { items: await this.catalog.categories(locale, { segmentKey: query.segment, pincode: query.pincode }) };
  }

  @Get('geo/states')
  async states() {
    return { items: await this.geo.states() };
  }

  @Get('geo/cities')
  cities(@ValidQuery(citySearchSchema) query: CitySearchQuery) {
    return this.geo.searchCities(query.q, query.state);
  }

  @Get('geo/pincodes/:pincode')
  pincode(@ValidParam('pincode', pincodeSchema) pincode: string) {
    return this.geo.pincode(pincode);
  }
}
