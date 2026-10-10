import { Controller, Get } from '@nestjs/common';

import { AllowContexts } from '../../../common/auth/auth.decorators.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { AnalysisService } from '../application/analysis.service.js';

@Controller('analyses')
@AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.staff)
export class AnalysesController {
  constructor(private readonly analyses: AnalysisService) {}

  @Get(':id')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'))
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.analyses.get(id, ability, locale);
  }
}
