import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { ConsentService } from '../application/consent.service.js';
import { toTemplateView } from '../application/consent.views.js';
import { type TemplateQuery, templateQuerySchema } from './consents.dto.js';

@Controller('catalog/consent-templates')
@Public()
export class CatalogConsentTemplatesController {
  constructor(private readonly consents: ConsentService) {}

  @Get()
  async get(@ValidQuery(templateQuerySchema) query: TemplateQuery, @RequestLocale() locale: Locale) {
    return toTemplateView(await this.consents.template(query.context), locale);
  }
}
