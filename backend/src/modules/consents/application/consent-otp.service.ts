import { Injectable } from '@nestjs/common';

import { type ConsentChannel, ContactType, OtpPurpose } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { OtpService } from '../../auth/application/otp.service.js';
import { NotificationTemplateKey } from '../../notifications/domain/notification.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { type ConsentItemInput, ConsentService } from './consent.service.js';
import { toTemplateView } from './consent.views.js';

export type ConsentOtpRequest = { contextKey: string; applicationId: string | null; requesterName: string; reference: string };

export type ConsentOtpConfirmation = { challengeId: string; code: string; items: ConsentItemInput[]; channel: ConsentChannel; applicationId: string | null; capturedByUserId: string };

type ConsentOtpPayload = { partyId: string; applicationId: string | null; templateVersionId: string };

@Injectable()
export class ConsentOtpService {
  constructor(
    private readonly consents: ConsentService,
    private readonly parties: PartyService,
    private readonly otp: OtpService,
  ) {}

  async send(partyId: string, request: ConsentOtpRequest, locale: Locale) {
    const template = await this.consents.template(request.contextKey);
    const mobile = await this.reachable(partyId);
    const payload: ConsentOtpPayload = { partyId, applicationId: request.applicationId, templateVersionId: template.versionId };
    const issued = await this.otp.issue({
      purpose: OtpPurpose.consent,
      channel: ContactType.mobile,
      identifier: mobile.value,
      identifierHash: mobile.hash,
      payload,
      deliver: true,
      message: { templateKey: NotificationTemplateKey.ConsentOtp, params: { requester: request.requesterName, ref: request.reference } },
    });
    return { ...issued, recipient: mobile.masked, template: toTemplateView(template, locale) };
  }

  async confirm(partyId: string, confirmation: ConsentOtpConfirmation, locale: Locale) {
    const mobile = await this.reachable(partyId);
    const verified = await this.otp.verify<ConsentOtpPayload>({ purpose: OtpPurpose.consent, challengeId: confirmation.challengeId, identifierHash: mobile.hash, code: confirmation.code });
    if (verified.payload?.partyId !== partyId || verified.payload.applicationId !== confirmation.applicationId) throw new AppError(ErrorCode.OTP_EXPIRED);
    return this.consents.record(
      partyId,
      confirmation.items,
      {
        channel: confirmation.channel,
        templateVersionId: verified.payload.templateVersionId,
        locale,
        evidence: `One-time code ${verified.challenge.id} confirmed on ${mobile.masked}`,
        capturedByUserId: confirmation.capturedByUserId,
        applicationId: confirmation.applicationId ?? undefined,
      },
      locale,
    );
  }

  private async reachable(partyId: string) {
    const mobile = await this.parties.reachableContact(partyId, ContactType.mobile);
    if (!mobile) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'party', code: 'no_reachable_mobile', message: 'this person has no mobile that may be contacted' }] });
    return mobile;
  }
}
