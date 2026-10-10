import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { ContactType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { LeadService } from '../../leads/application/lead.service.js';
import { PartyResolver } from '../../parties/application/party-resolver.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import { type BorrowerProfileInput, BorrowerProfileService } from './borrower-profile.service.js';

export type PartnerBorrowerInput = BorrowerProfileInput & { name: string; mobile: string; countryCode?: string };

@Injectable()
export class PartnerBorrowerService {
  constructor(
    private readonly profiles: BorrowerProfileService,
    private readonly resolver: PartyResolver,
    private readonly leads: LeadService,
  ) {}

  @Transactional()
  async register(input: PartnerBorrowerInput, actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    const mobile = normaliseMobile(input.mobile, input.countryCode);
    if (!mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
    const person = await this.resolver.resolvePersonForLead([{ type: ContactType.mobile, value: mobile.e164 }], input.name, ContactSource.PartnerFiled);
    const protecting = await this.leads.protectingOrganizations([person.partyId]);
    if ([...protecting].some((organizationId) => organizationId !== actor.organizationId)) throw new AppError(ErrorCode.LEAD_PROTECTED);
    const profile = await this.profiles.ensure(person.partyId, { segment: input.segment, subSegment: input.subSegment, businessName: input.businessName, incorporatedOn: input.incorporatedOn }, actor.userId, actor.organizationId);
    return { ...profile, personOutcome: person.outcome };
  }
}
