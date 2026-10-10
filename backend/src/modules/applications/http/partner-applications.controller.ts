import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { AnswerChannel, ApplicationChannel, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { MeService } from '../../auth/application/me.service.js';
import { ApplicationPartyService } from '../application/application-party.service.js';
import { type ApplicationActor, ApplicationService } from '../application/application.service.js';
import { type LeadStartDto, leadStartSchema, type PartnerApplicationDto, partnerApplicationSchema, type PartyConsentConfirmDto, partyConsentConfirmSchema } from './applications.dto.js';

const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'));

@Controller('partner')
@AllowContexts(SessionContext.partner)
export class PartnerApplicationsController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly parties: ApplicationPartyService,
    private readonly me: MeService,
  ) {}

  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LoanApplication'))
  async create(@ValidBody(partnerApplicationSchema) body: PartnerApplicationDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.applications.createForProfile(body.borrowerProfileId, body.category, await this.partnerActor(actor), ability);
  }

  @Post('applications/:id/borrower-consent/send')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  sendConsent(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.parties.sendBorrowerConsent(id, actor, ability, locale);
  }

  @Post('applications/:id/borrower-consent/verify')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  confirmConsent(@ValidParam('id', uuidSchema) id: string, @ValidBody(partyConsentConfirmSchema) body: PartyConsentConfirmDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.parties.confirmBorrowerConsent(id, body, actor, ability, locale);
  }

  @Post('leads/:id/convert')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LoanApplication') && ability.can(AppAction.Update, 'LeadAssignment'))
  async convertLead(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadStartSchema) body: LeadStartDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.applications.startFromLead(id, body, await this.partnerActor(actor), ability);
  }

  private async partnerActor(actor: UserActor): Promise<ApplicationActor> {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    return { userId: actor.userId, actingPartyId: await this.me.partyIdOf(actor.userId), channel: ApplicationChannel.partner, partnerOrganizationId: actor.organizationId, answerChannel: AnswerChannel.partner };
  }
}
