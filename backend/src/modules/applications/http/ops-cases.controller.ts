import { Controller, Get } from '@nestjs/common';

import { StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { ApplicationService } from '../application/application.service.js';
import { OpsCaseService } from '../application/ops-case.service.js';
import { type OpsCasesDto, opsCasesSchema } from './applications.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'));

@Controller('ops/cases')
@StaffOnly()
export class OpsCasesController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly cases: OpsCaseService,
  ) {}

  @Get()
  @canRead
  list(@ValidQuery(opsCasesSchema) query: OpsCasesDto, @CurrentAbility() ability: AppAbility) {
    return this.applications.list(ability, query);
  }

  @Get(':id')
  @canRead
  detail(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.cases.detail(id, ability, locale);
  }
}
