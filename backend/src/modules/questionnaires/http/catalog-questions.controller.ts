import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { QuestionnaireService } from '../application/questionnaire.service.js';
import { toQuestionnaireView } from '../application/questionnaire.views.js';
import { type QuestionnaireContextQuery, questionnaireContextSchema } from './questionnaires.dto.js';

@Controller('catalog/questions')
@Public()
export class CatalogQuestionsController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Get()
  async resolve(@ValidQuery(questionnaireContextSchema) query: QuestionnaireContextQuery, @RequestLocale() locale: Locale) {
    return toQuestionnaireView(await this.questionnaires.resolve(query), locale);
  }
}
