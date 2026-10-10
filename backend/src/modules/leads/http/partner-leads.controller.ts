import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { PartnerLeadService } from '../application/partner-lead.service.js';
import {
  type DeclineAssignmentDto,
  declineAssignmentSchema,
  type LeadLoseDto,
  leadLoseSchema,
  type OfflineConversionDto,
  offlineConversionSchema,
  type PartnerLeadPatchDto,
  partnerLeadPatchSchema,
  type PartnerReferralDto,
  partnerReferralSchema,
  type PartnerInboxQuery,
  partnerInboxQuerySchema,
  type ReturnAssignmentDto,
  returnAssignmentSchema,
  type RevealContactDto,
  revealContactSchema,
  type SubAssignDto,
  subAssignSchema,
} from './leads.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LeadAssignment'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'LeadAssignment'));
const canAssign = CheckPolicies((ability) => ability.can(AppAction.Assign, 'LeadAssignment'));

@Controller('partner/leads')
@AllowContexts(SessionContext.partner)
export class PartnerLeadsController {
  constructor(private readonly leads: PartnerLeadService) {}

  @Get()
  @canRead
  inbox(@ValidQuery(partnerInboxQuerySchema) query: PartnerInboxQuery, @CurrentAbility() ability: AppAbility) {
    return this.leads.inbox(ability, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Lead'))
  refer(@ValidBody(partnerReferralSchema) body: PartnerReferralDto, @CurrentActor() actor: UserActor, @RequestLocale() locale: Locale) {
    return this.leads.refer(body, actor, locale);
  }

  @Patch(':id')
  @canUpdate
  update(@ValidParam('id', uuidSchema) id: string, @ValidBody(partnerLeadPatchSchema) body: PartnerLeadPatchDto, @IfMatchVersion() version: number | undefined, @CurrentAbility() ability: AppAbility) {
    return this.leads.update(id, body, version, ability);
  }

  @Post(':id/offline-conversion')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  offlineConversion(@ValidParam('id', uuidSchema) id: string, @ValidBody(offlineConversionSchema) body: OfflineConversionDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.leads.reportConversion(id, body, actor, ability);
  }

  @Get(':id')
  @canRead
  detail(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.leads.detail(id, ability);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  accept(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.leads.accept(id, actor, ability);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  decline(@ValidParam('id', uuidSchema) id: string, @ValidBody(declineAssignmentSchema) body: DeclineAssignmentDto, @CurrentAbility() ability: AppAbility) {
    return this.leads.decline(id, body.reason, body.note, ability);
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  giveBack(@ValidParam('id', uuidSchema) id: string, @ValidBody(returnAssignmentSchema) body: ReturnAssignmentDto, @CurrentAbility() ability: AppAbility) {
    return this.leads.giveBack(id, body.reason, body.note, ability);
  }

  @Post(':id/reveal-contact')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  reveal(@ValidParam('id', uuidSchema) id: string, @ValidBody(revealContactSchema) body: RevealContactDto, @CurrentAbility() ability: AppAbility) {
    return this.leads.revealContacts(id, body.reason, ability);
  }

  @Post(':id/sub-assign')
  @HttpCode(HttpStatus.OK)
  @canAssign
  subAssign(@ValidParam('id', uuidSchema) id: string, @ValidBody(subAssignSchema) body: SubAssignDto, @CurrentAbility() ability: AppAbility) {
    return this.leads.subAssign(id, body.membershipId, ability);
  }

  @Post(':id/lost')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  lose(@ValidParam('id', uuidSchema) id: string, @ValidBody(leadLoseSchema) body: LeadLoseDto, @CurrentAbility() ability: AppAbility) {
    return this.leads.lose(id, body.reason, body.note, ability);
  }
}
