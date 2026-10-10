import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentActor, StaffOnly } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { DocumentRequestService } from '../application/document-request.service.js';
import { SubmissionChannel, SubmissionService } from '../application/submission.service.js';
import {
  type ApproveSubmissionDto,
  approveSubmissionSchema,
  type DocumentRequestDto,
  documentRequestSchema,
  type ListSubmissionsDto,
  listSubmissionsSchema,
  type OpsSubmissionActionDto,
  opsSubmissionActionSchema,
} from './submissions.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LenderSubmission'));

const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'LenderSubmission'));

@Controller('ops')
@StaffOnly()
export class OpsSubmissionsController {
  constructor(
    private readonly submissions: SubmissionService,
    private readonly requests: DocumentRequestService,
  ) {}

  @Get('submissions')
  @canRead
  list(@ValidQuery(listSubmissionsSchema) query: ListSubmissionsDto, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.browse(ability, query, locale, SessionContext.staff);
  }

  @Get('submissions/:id')
  @canRead
  detail(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.detail(id, ability, locale, SessionContext.staff);
  }

  @Post('submissions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  approve(@ValidParam('id', uuidSchema) id: string, @ValidBody(approveSubmissionSchema) body: ApproveSubmissionDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.approve(id, body.note, body.expectedVersion, actor, ability, locale);
  }

  @Post('submissions/:id/events')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  act(@ValidParam('id', uuidSchema) id: string, @ValidBody(opsSubmissionActionSchema) body: OpsSubmissionActionDto, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.act(id, body, SubmissionChannel.Ops, ability, locale);
  }

  @Post('cases/:id/document-requests')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'DocumentRequest'))
  requestDocuments(@ValidParam('id', uuidSchema) id: string, @ValidBody(documentRequestSchema) body: DocumentRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.requests.forApplication(id, body, actor, ability, locale);
  }
}
