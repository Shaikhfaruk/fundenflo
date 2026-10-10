import { Controller, Get } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { PartnerCommissionService } from '../application/partner-commission.service.js';
import { type StatementDto, statementSchema } from './commissions.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'PartnerProfile'));

@Controller('partner/commissions')
@AllowContexts(SessionContext.partner)
export class PartnerCommissionsController {
  constructor(private readonly commissions: PartnerCommissionService) {}

  @Get('summary')
  @canRead
  summary(@CurrentActor() actor: UserActor) {
    return this.commissions.summary(actor);
  }

  @Get('ledger')
  @canRead
  ledger(@ValidQuery(pageQuerySchema) query: PageQuery, @CurrentActor() actor: UserActor) {
    return this.commissions.ledgerEntries(actor, query);
  }

  @Get('statement')
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'PartnerProfile'))
  statement(@ValidQuery(statementSchema) query: StatementDto, @CurrentActor() actor: UserActor) {
    return this.commissions.statement(actor, query.month);
  }
}
