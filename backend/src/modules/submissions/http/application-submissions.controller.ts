import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { SessionContext } from '../../../common/enums/db.enums.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { DocumentRequestService } from '../application/document-request.service.js';
import { SubmissionService } from '../application/submission.service.js';
import { type RequestSubmissionDto, requestSubmissionSchema, type WithdrawSubmissionDto, withdrawSubmissionSchema } from './submissions.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LenderSubmission'));

@Controller('applications')
@AllowContexts(SessionContext.borrower, SessionContext.partner, SessionContext.staff)
export class ApplicationSubmissionsController {
  constructor(
    private readonly submissions: SubmissionService,
    private readonly requests: DocumentRequestService,
  ) {}

  @Post(':id/submissions')
  @HttpCode(HttpStatus.CREATED)
  @AllowContexts(SessionContext.borrower, SessionContext.partner)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LenderSubmission'))
  request(@ValidParam('id', uuidSchema) id: string, @ValidBody(requestSubmissionSchema) body: RequestSubmissionDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.request(id, body.matchResultId, actor, ability, locale, { shareWithLender: body.shareWithLender === true });
  }

  @Get(':id/submissions')
  @canRead
  list(@ValidParam('id', uuidSchema) id: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.list(id, ability, locale, actor.context);
  }

  @Get(':id/submissions/:submissionId')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @ValidParam('submissionId', uuidSchema) submissionId: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.submissions.get(id, submissionId, ability, locale, actor.context);
  }

  @Post(':id/submissions/:submissionId/withdraw')
  @HttpCode(HttpStatus.OK)
  @AllowContexts(SessionContext.borrower, SessionContext.partner)
  @CheckPolicies((ability) => ability.can(AppAction.Update, 'LenderSubmission'))
  withdraw(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('submissionId', uuidSchema) submissionId: string,
    @ValidBody(withdrawSubmissionSchema) body: WithdrawSubmissionDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
    @RequestLocale() locale: Locale,
  ) {
    return this.submissions.withdraw(id, submissionId, body.reason, ability, locale, actor.context);
  }

  @Get(':id/document-requests')
  @CheckPolicies((ability) => ability.can(AppAction.Read, 'DocumentRequest'))
  documentRequests(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.requests.list(id, ability, locale);
  }
}
