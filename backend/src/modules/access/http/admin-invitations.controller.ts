import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { ContactType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { normaliseEmail, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { Idempotent } from '../../../infrastructure/idempotency/idempotent.decorator.js';
import { toInvitationView } from '../application/access.views.js';
import { InvitationService } from '../application/invitation.service.js';
import { AppAction, type AppAbility } from '../domain/ability.types.js';
import { type CreateInvitationDto, createInvitationSchema, type ListInvitationsDto, listInvitationsSchema } from './access.dto.js';
import { CheckPolicies, CurrentAbility } from './policies.guard.js';

@Controller('admin/invitations')
@StaffOnly()
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'Invitation'))
  list(@ValidQuery(listInvitationsSchema) query: ListInvitationsDto, @CurrentAbility() ability: AppAbility) {
    return this.invitations.list(query, ability);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'Invitation'))
  async create(
    @ValidBody(createInvitationSchema) body: CreateInvitationDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
  ) {
    const created = await this.invitations.create(
      { organizationId: body.organizationId, role: body.role, recipient: this.recipient(body) },
      actor.userId,
      ability,
    );
    await this.invitations.deliver(created);
    return toInvitationView(created.invitation);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'Invitation'))
  async revoke(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return toInvitationView(await this.invitations.revoke(id, ability));
  }

  private recipient(body: CreateInvitationDto) {
    if (body.email) {
      const email = normaliseEmail(body.email);
      if (!email) throw new AppError(ErrorCode.EMAIL_INVALID);
      return { channel: ContactType.email, value: email } as const;
    }
    const mobile = normaliseMobile(body.mobile ?? '', body.countryCode);
    if (!mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
    return { channel: ContactType.mobile, value: mobile.e164 } as const;
  }
}
