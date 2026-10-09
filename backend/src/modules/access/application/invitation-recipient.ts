import { ContactType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { normaliseEmail, normaliseMobile } from '../../../engines/party-matching/normalise.js';

export type RecipientInput = { mobile?: string; countryCode?: string; email?: string };

export function toInvitationRecipient(input: RecipientInput) {
  if (input.email) {
    const email = normaliseEmail(input.email);
    if (!email) throw new AppError(ErrorCode.EMAIL_INVALID);
    return { channel: ContactType.email, value: email } as const;
  }
  const mobile = normaliseMobile(input.mobile ?? '', input.countryCode);
  if (!mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
  return { channel: ContactType.mobile, value: mobile.e164 } as const;
}
