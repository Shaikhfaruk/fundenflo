import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';

import { AllowContexts, CurrentActor } from '../../../common/auth/auth.decorators.js';
import type { UserActor } from '../../../common/context/actor.js';
import { AnswerChannel, ApplicationChannel, SessionContext } from '../../../common/enums/db.enums.js';
import { IfMatchVersion } from '../../../common/http/versioning.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { RequestLocale } from '../../../common/i18n/locale.decorator.js';
import { uuidSchema } from '../../../common/validation/common.schemas.js';
import { ValidBody, ValidParam, ValidQuery } from '../../../common/validation/zod-validation.pipe.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { CheckPolicies, CurrentAbility } from '../../access/http/policies.guard.js';
import { MeService } from '../../auth/application/me.service.js';
import { ApplicationPartyService } from '../application/application-party.service.js';
import { type ApplicationActor, ApplicationService } from '../application/application.service.js';
import {
  type AddPartyDto,
  addPartySchema,
  type AnswersDto,
  answersSchema,
  type ApplicationConsentDto,
  applicationConsentSchema,
  type ChecklistStageQuery,
  checklistStageSchema,
  type CreateApplicationDto,
  createApplicationSchema,
  type ListApplicationsDto,
  listApplicationsSchema,
  type PartyConsentConfirmDto,
  partyConsentConfirmSchema,
  type QuestionsQuery,
  questionsQuerySchema,
  type RequirementDto,
  requirementSchema,
  type WithdrawDto,
  withdrawSchema,
} from './applications.dto.js';

const canRead = CheckPolicies((ability) => ability.can(AppAction.Read, 'LoanApplication'));
const canUpdate = CheckPolicies((ability) => ability.can(AppAction.Update, 'LoanApplication'));

@Controller('applications')
@AllowContexts(SessionContext.borrower, SessionContext.partner)
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly parties: ApplicationPartyService,
    private readonly me: MeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AllowContexts(SessionContext.borrower)
  @CheckPolicies((ability) => ability.can(AppAction.Create, 'LoanApplication'))
  async create(@ValidBody(createApplicationSchema) body: CreateApplicationDto, @CurrentActor() actor: UserActor) {
    return this.applications.create(body, await this.borrowerActor(actor));
  }

  @Get()
  @canRead
  list(@ValidQuery(listApplicationsSchema) query: ListApplicationsDto, @CurrentAbility() ability: AppAbility) {
    return this.applications.list(ability, query);
  }

  @Get(':id')
  @canRead
  get(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.applications.get(id, ability);
  }

  @Patch(':id/requirement')
  @canUpdate
  requirement(@ValidParam('id', uuidSchema) id: string, @ValidBody(requirementSchema) body: RequirementDto, @IfMatchVersion() version: number | undefined, @CurrentAbility() ability: AppAbility) {
    return this.applications.updateRequirement(id, body, version, ability);
  }

  @Get(':id/next-step')
  @canRead
  nextStep(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.applications.nextStep(id, ability, locale);
  }

  @Get(':id/questions')
  @canRead
  questions(@ValidParam('id', uuidSchema) id: string, @ValidQuery(questionsQuerySchema) query: QuestionsQuery, @CurrentAbility() ability: AppAbility) {
    return this.applications.questions(id, query.stage, ability);
  }

  @Put(':id/answers')
  @canUpdate
  async answers(@ValidParam('id', uuidSchema) id: string, @ValidBody(answersSchema) body: AnswersDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.applications.submitAnswers(id, body.stage, body.answers, await this.actorOf(actor), ability);
  }

  @Get(':id/document-checklist')
  @canRead
  checklist(@ValidParam('id', uuidSchema) id: string, @ValidQuery(checklistStageSchema) query: ChecklistStageQuery, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.applications.checklist(id, ability, locale, query.stage);
  }

  @Get(':id/timeline')
  @canRead
  timeline(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.applications.timelineOf(id, ability);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  withdraw(@ValidParam('id', uuidSchema) id: string, @ValidBody(withdrawSchema) body: WithdrawDto, @CurrentAbility() ability: AppAbility) {
    return this.applications.withdraw(id, body.reason, ability);
  }

  @Post(':id/consents')
  @HttpCode(HttpStatus.OK)
  @AllowContexts(SessionContext.borrower)
  @canUpdate
  consents(@ValidParam('id', uuidSchema) id: string, @ValidBody(applicationConsentSchema) body: ApplicationConsentDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.applications.recordConsent(id, body, actor.userId, ability, locale);
  }

  @Get(':id/parties')
  @canRead
  listParties(@ValidParam('id', uuidSchema) id: string, @CurrentAbility() ability: AppAbility) {
    return this.parties.list(id, ability);
  }

  @Post(':id/parties')
  @HttpCode(HttpStatus.CREATED)
  @canUpdate
  addParty(@ValidParam('id', uuidSchema) id: string, @ValidBody(addPartySchema) body: AddPartyDto, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility) {
    return this.parties.add(id, body, actor, ability);
  }

  @Delete(':id/parties/:pid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @canUpdate
  async removeParty(@ValidParam('id', uuidSchema) id: string, @ValidParam('pid', uuidSchema) pid: string, @CurrentAbility() ability: AppAbility) {
    await this.parties.remove(id, pid, ability);
  }

  @Post(':id/parties/:pid/consent-otp')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  sendPartyConsent(@ValidParam('id', uuidSchema) id: string, @ValidParam('pid', uuidSchema) pid: string, @CurrentActor() actor: UserActor, @CurrentAbility() ability: AppAbility, @RequestLocale() locale: Locale) {
    return this.parties.sendConsentOtp(id, pid, actor, ability, locale);
  }

  @Post(':id/parties/:pid/consent-otp/verify')
  @HttpCode(HttpStatus.OK)
  @canUpdate
  confirmPartyConsent(
    @ValidParam('id', uuidSchema) id: string,
    @ValidParam('pid', uuidSchema) pid: string,
    @ValidBody(partyConsentConfirmSchema) body: PartyConsentConfirmDto,
    @CurrentActor() actor: UserActor,
    @CurrentAbility() ability: AppAbility,
    @RequestLocale() locale: Locale,
  ) {
    return this.parties.confirmConsentOtp(id, pid, body, actor, ability, locale);
  }

  private async borrowerActor(actor: UserActor): Promise<ApplicationActor> {
    return { userId: actor.userId, actingPartyId: await this.me.partyIdOf(actor.userId), channel: ApplicationChannel.direct, partnerOrganizationId: null, answerChannel: AnswerChannel.borrower };
  }

  private async actorOf(actor: UserActor): Promise<ApplicationActor> {
    if (actor.context === SessionContext.partner) return { userId: actor.userId, actingPartyId: await this.me.partyIdOf(actor.userId), channel: ApplicationChannel.partner, partnerOrganizationId: actor.organizationId, answerChannel: AnswerChannel.partner };
    return this.borrowerActor(actor);
  }
}
