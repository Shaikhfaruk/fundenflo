import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import { ConfigResource } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { configSubject } from '../../config-publishing/application/config-subject.js';
import { versionNumberSchema } from '../../config-publishing/http/config.dto.js';
import { QuestionnaireService } from '../application/questionnaire.service.js';
import { toQuestionnaireView } from '../application/questionnaire.views.js';
import { type PreviewQuestionSetDto, previewQuestionSetSchema } from './questionnaires.dto.js';

@Controller('admin/question-sets/:id/versions/:number/preview')
@StaffOnly()
export class AdminQuestionSetPreviewController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Read, configSubject(ConfigResource.question_set)))
  async preview(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('number', versionNumberSchema) number: number,
    @ValidBody(previewQuestionSetSchema) body: PreviewQuestionSetDto,
    @RequestLocale() locale: Locale,
  ) {
    const { partyId, facts, ...context } = body;
    const result = await this.questionnaires.preview(id, number, context, partyId, facts as Record<string, FactValue> | undefined);
    return { valid: result.valid, issues: result.issues, questionnaire: result.questionnaire ? toQuestionnaireView(result.questionnaire, locale) : null };
  }
}
