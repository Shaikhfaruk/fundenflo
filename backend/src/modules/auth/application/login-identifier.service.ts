import { Injectable } from '@nestjs/common';

import { ContactType, LoginMethod } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { normaliseEmail, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { ContactCodec } from '../../parties/application/contact-codec.service.js';

export type IdentifierInput = {
  mobile?: string;
  countryCode?: string;
  email?: string;
};

export type ResolvedIdentifier = {
  channel: typeof ContactType.mobile | typeof ContactType.email;
  method: typeof LoginMethod.mobile_otp | typeof LoginMethod.email_otp;
  value: string;
  hash: string;
};

@Injectable()
export class LoginIdentifierService {
  constructor(private readonly codec: ContactCodec) {}

  resolve(input: IdentifierInput): ResolvedIdentifier {
    if (input.email !== undefined) {
      const email = normaliseEmail(input.email);
      if (!email) throw new AppError(ErrorCode.EMAIL_INVALID);
      return { channel: ContactType.email, method: LoginMethod.email_otp, value: email, hash: this.codec.hash(ContactType.email, email) };
    }
    const mobile = normaliseMobile(input.mobile ?? '', input.countryCode);
    if (!mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
    return { channel: ContactType.mobile, method: LoginMethod.mobile_otp, value: mobile.e164, hash: this.codec.hash(ContactType.mobile, mobile.e164) };
  }

  encodeForLogin(identifier: ResolvedIdentifier) {
    return this.codec.encode(identifier.channel, identifier.value, CipherPurpose.UserLoginIdentifier);
  }
}
