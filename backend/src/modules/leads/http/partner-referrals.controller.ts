import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { type PageQuery, pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { ValidBody, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction } from '../../access/domain/ability.types.js';
import { CheckPolicies } from '../../access/http/policies.guard.js';
import { PartnerLeadService } from '../application/partner-lead.service.js';
import { type AttributionClaimDto, attributionClaimSchema } from './leads.dto.js';

@Controller('partner')
@AllowContexts(SessionContext.partner)
export class PartnerReferralsController {
  constructor(private readonly leads: PartnerLeadService) {}

  @Get('referrals')
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Lead'))
  list(@ValidQuery(pageQuerySchema) query: PageQuery, @CurrentActor() actor: UserActor) {
    return this.leads.referrals(actor, query);
  }

  @Post('attribution-disputes')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Lead'))
  claim(@ValidBody(attributionClaimSchema) body: AttributionClaimDto, @CurrentActor() actor: UserActor) {
    return this.leads.claimAttribution(actor, body);
  }
}
