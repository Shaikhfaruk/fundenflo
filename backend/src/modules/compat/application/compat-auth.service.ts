import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { MeService } from '../../auth/application/me.service.js';
import { type OtpVerifyInput, OtpLoginService } from '../../auth/application/otp-login.service.js';
import { BorrowerKycService } from '../../borrowers/application/borrower-kyc.service.js';
import { BorrowerProfileService } from '../../borrowers/application/borrower-profile.service.js';
import { PartyKind } from '../../../common/enums/db.enums.js';
import { nationalMobile } from './compat.views.js';

export type CompatProfile = { fullName: string; pan: string; dob: string };

const toDisplayDate = (iso: string) => iso.split('-').toReversed().join('/');

@Injectable()
export class CompatAuthService {
  constructor(
    private readonly otpLogin: OtpLoginService,
    private readonly me: MeService,
    private readonly applications: ApplicationService,
    private readonly kyc: BorrowerKycService,
    private readonly profiles: BorrowerProfileService,
  ) {}

  async verify(input: OtpVerifyInput) {
    const result = await this.otpLogin.verify(input);
    return { ...result, token: result.accessToken, user: { ...result.user, mobile: nationalMobile(result.user.mobile) } };
  }

  async profile(input: CompatProfile, actor: UserActor, ability: AppAbility) {
    const application = await this.applications.current(ability);
    if (!application) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'pan', code: 'no_application', message: 'choose your loan first, then verify your details' }] });
    await this.kyc.verifyPan(application.borrowerProfileId, { pan: input.pan, name: input.fullName, dateOfBirth: input.dob }, ability);
    await this.me.updateProfile(actor, { displayName: input.fullName }, undefined);
    if (application.party.kind === PartyKind.business && !application.party.displayName) await this.profiles.update(application.borrowerProfileId, { businessName: input.fullName }, undefined, ability);
    return { fullName: input.fullName, pan: input.pan, dob: toDisplayDate(input.dob) };
  }
}
