import { Controller, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import { pageQuerySchema, type PageQuery } from '../../../common/listing/cursor-page.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { toInvitationView, toMembershipView } from '../../access/application/access.views.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { PartnerKycService } from '../application/partner-kyc.service.js';
import { PartnerService } from '../application/partner.service.js';
import { ReferralCodeService } from '../application/referral-code.service.js';
import {
  type CapacityDto,
  capacitySchema,
  type InviteMemberDto,
  inviteMemberSchema,
  type PartnerKycDto,
  partnerKycSchema,
  type ServiceAreasDto,
  serviceAreasBodySchema,
  type UpdateMemberDto,
  updateMemberSchema,
} from './partners.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'PartnerProfile'));
const canManage = CheckPolicies((ability) => ability.can(AppAction.Update, 'PartnerProfile'));

@Controller('partner')
@AllowContexts(SessionContext.partner)
export class PartnerPortalController {
  constructor(
    private readonly partners: PartnerService,
    private readonly kyc: PartnerKycService,
    private readonly codes: ReferralCodeService,
  ) {}

  @Get('profile')
  @canRead
  profile(@CurrentActor() actor: UserActor) {
    return this.kyc.profile(actor);
  }

  @Patch('profile')
  @canManage
  updateProfile(@ValidBody(partnerKycSchema) body: PartnerKycDto, @CurrentActor() actor: UserActor, @IfMatchVersion() version: number | undefined) {
    return this.kyc.update(actor, body, version);
  }

  @Get('referral-codes')
  @canRead
  referralCodes(@CurrentActor() actor: UserActor) {
    return this.codes.forActor(actor);
  }

  @Get('capacity')
  @canRead
  capacity(@CurrentActor() actor: UserActor) {
    return this.partners.capacity(actor);
  }

  @Put('capacity')
  @canManage
  setCapacity(@ValidBody(capacitySchema) body: CapacityDto, @CurrentActor() actor: UserActor, @IfMatchVersion() version: number | undefined) {
    return this.partners.setCapacity(actor, body, version);
  }

  @Get('service-areas')
  @canRead
  serviceAreas(@CurrentActor() actor: UserActor) {
    return this.partners.serviceAreas(actor);
  }

  @Put('service-areas')
  @canManage
  setServiceAreas(@ValidBody(serviceAreasBodySchema) body: ServiceAreasDto, @CurrentActor() actor: UserActor) {
    return this.partners.setServiceAreas(actor, body.areas);
  }

  @Get('members')
  @canManage
  members(@ValidQuery(pageQuerySchema) query: PageQuery, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.partners.members(actor, ability, query);
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @canManage
  async invite(@ValidBody(inviteMemberSchema) body: InviteMemberDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return toInvitationView(await this.partners.inviteMember(actor, ability, body));
  }

  @Patch('members/:id')
  @canManage
  async updateMember(
    @ValidParam('id', uuidSchema) id: string,
    @ValidBody(updateMemberSchema) body: UpdateMemberDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
    @IfMatchVersion() version: number | undefined,
  ) {
    return toMembershipView(await this.partners.updateMember(actor, ability, id, body.status, version));
  }
}
