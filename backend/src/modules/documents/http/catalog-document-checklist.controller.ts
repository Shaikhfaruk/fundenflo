import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { DocumentChecklistService } from '../application/document-checklist.service.js';
import { type ChecklistQuery, checklistQuerySchema } from './documents.dto.js';

@Controller('catalog/document-checklist')
@Public()
export class CatalogDocumentChecklistController {
  constructor(private readonly checklists: DocumentChecklistService) {}

  @Get()
  async checklist(@ValidQuery(checklistQuerySchema) query: ChecklistQuery, @RequestLocale() locale: Locale) {
    const facts = await this.checklists.typedFacts((query.fact ?? []).map((pair) => [pair.slice(0, pair.indexOf(':')), pair.slice(pair.indexOf(':') + 1)]));
    return this.checklists.checklist({ stage: query.stage, segment: query.segment, subSegment: query.subSegment, category: query.category }, locale, { facts });
  }
}
