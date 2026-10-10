import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { SubmissionChannel, SubmissionService } from '../application/submission.service.js';
import { type DocumentRequestDto, documentRequestSchema, type LenderSubmissionActionDto, lenderSubmissionActionSchema, type ListSubmissionsDto, listSubmissionsSchema } from './submissions.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LenderSubmission'));

const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'LenderSubmission'));

@Controller('lender/submissions')
@AllowContexts(SessionContext.lender)
export class LenderSubmissionsController {
  constructor(private readonly submissions: SubmissionService) {}

  @Get()
  @canRead
  list(@ValidQuery(listSubmissionsSchema) query: ListSubmissionsDto, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.browse(ability, query, locale, SessionContext.lender);
  }

  @Get(':id')
  @canRead
  detail(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.detail(id, ability, locale, SessionContext.lender);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  act(@ValidParam('id', uuidSchema) id: string, @ValidBody(lenderSubmissionActionSchema) body: LenderSubmissionActionDto, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.act(id, body, SubmissionChannel.Lender, ability, locale);
  }

  @Post(':id/document-requests')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  requestDocuments(@ValidParam('id', uuidSchema) id: string, @ValidBody(documentRequestSchema) body: DocumentRequestDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.requestDocuments(id, body, actor, ability, locale);
  }

  @Get(':id/documents/:documentId/download-url')
  @canRead
  documentUrl(@ValidParam('id', uuidSchema) id: string, @ValidParam('documentId', uuidSchema) documentId: string, @CurrentAbility() ability: AppAbility) {
    return this.submissions.documentUrl(id, documentId, ability, SessionContext.lender);
  }
}
