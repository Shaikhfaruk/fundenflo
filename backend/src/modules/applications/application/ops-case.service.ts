import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { MembershipService } from '../../access/application/membership.service.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { CASE_ASSIGNEE_ROLES, OPS_CASE_DOCUMENTS_LIMIT } from '../domain/application.constants.js';
import { ApplicationPartyService } from './application-party.service.js';
import { ApplicationService } from './application.service.js';

@Injectable()
export class OpsCaseService {
  constructor(
    private readonly applications: ApplicationService,
    private readonly parties: ApplicationPartyService,
    private readonly documents: DocumentService,
    private readonly consents: ConsentService,
    private readonly memberships: MembershipService,
  ) {}

  async assign(id: string, assigneeUserId: string | null, ability: AppAbility) {
    if (assigneeUserId && !(await this.memberships.activeStaffUserIds(CASE_ASSIGNEE_ROLES)).includes(assigneeUserId)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'assigneeUserId', code: 'not_an_assignee', message: 'assign the case to an active ops or credit team member' }] });
    }
    return this.applications.assign(id, assigneeUserId, ability);
  }

  async detail(id: string, ability: AppAbility, locale: Locale) {
    const application = await this.applications.get(id, ability);
    const parties = await this.parties.list(id, ability);
    const documents = await this.documents.list(ability, { borrowerProfileId: application.borrowerProfileId, limit: OPS_CASE_DOCUMENTS_LIMIT });
    const checklist = await this.applications.checklist(id, ability, locale);
    const nextStep = await this.applications.nextStep(id, ability, locale);
    const consents = await this.consents.current(application.actingParty.id, locale);
    const timeline = await this.applications.timelineOf(id, ability);
    return { application, parties: parties.items, documents: documents.items, checklist, nextStep, consents, timeline: timeline.items };
  }
}
