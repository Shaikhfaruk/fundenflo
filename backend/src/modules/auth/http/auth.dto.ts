import { z } from 'zod';

import { EXPO_PUSH_TOKEN_PATTERN } from '../../../integrations/push/push.port.js';

import { LoginAs, UserStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { deviceSchema, localeSchema, otpCodeSchema, personNameSchema } from '../../../common/validation/common.schemas.js';
import { STAFF_PASSWORD_MAX_LENGTH, STAFF_PASSWORD_MIN_LENGTH } from '../domain/auth.constants.js';

const mobileSchema = z.string().trim().min(6).max(20);
const countryCodeSchema = z.string().trim().regex(/^\+?\d{1,4}$/);
const emailSchema = z.email().max(254);
const referralCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{4,24}$/, 'use 4-24 letters, numbers or hyphens')
  .transform((value) => value.toUpperCase());

const identifierFields = {
  mobile: mobileSchema.optional(),
  countryCode: countryCodeSchema.optional(),
  email: emailSchema.optional(),
};

const exactlyOneIdentifier = (value: { mobile?: string; email?: string }) => (value.mobile ? 1 : 0) + (value.email ? 1 : 0) === 1;

export const otpRequestSchema = z
  .object({
    ...identifierFields,
    loginAs: z.enum(Object.values(LoginAs)).default(LoginAs.borrower),
    referralCode: referralCodeSchema.optional(),
  })
  .strict()
  .refine(exactlyOneIdentifier, 'provide exactly one of mobile or email');

export type OtpRequestDto = z.output<typeof otpRequestSchema>;

export const otpVerifySchema = z
  .object({
    ...identifierFields,
    otp: otpCodeSchema,
    challengeId: z.uuid().optional(),
    device: deviceSchema.optional(),
  })
  .strict()
  .refine(exactlyOneIdentifier, 'provide exactly one of mobile or email');

export type OtpVerifyDto = z.output<typeof otpVerifySchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(32).max(256) }).strict();

export type RefreshDto = z.output<typeof refreshSchema>;

export const switchContextSchema = z.union([
  z.object({ membershipId: z.uuid() }).strict(),
  z.object({ loginAs: z.literal(LoginAs.borrower) }).strict(),
]);

export type SwitchContextDto = z.output<typeof switchContextSchema>;

export const staffLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(STAFF_PASSWORD_MAX_LENGTH) }).strict();

export type StaffLoginDto = z.output<typeof staffLoginSchema>;

export const staffMfaSchema = z.object({ mfaToken: z.string().min(32).max(128), code: otpCodeSchema, device: deviceSchema.optional() }).strict();

export type StaffMfaDto = z.output<typeof staffMfaSchema>;

export const acceptStaffInvitationSchema = z
  .object({
    token: z.string().min(32).max(128),
    fullName: personNameSchema,
    password: z.string().min(STAFF_PASSWORD_MIN_LENGTH).max(STAFF_PASSWORD_MAX_LENGTH),
  })
  .strict();

export type AcceptStaffInvitationDto = z.output<typeof acceptStaffInvitationSchema>;

export const updateProfileSchema = z
  .object({
    fullName: personNameSchema.optional(),
    preferredLanguage: localeSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => value.fullName !== undefined || value.preferredLanguage !== undefined, 'provide fullName or preferredLanguage');

export type UpdateProfileDto = z.output<typeof updateProfileSchema>;

export const linkEmailSchema = z.object({ email: emailSchema }).strict();

export type LinkEmailDto = z.output<typeof linkEmailSchema>;

export const challengeVerifySchema = z.object({ challengeId: z.uuid(), otp: otpCodeSchema }).strict();

export type ChallengeVerifyDto = z.output<typeof challengeVerifySchema>;

export const mobileChangeSchema = z.object({ mobile: mobileSchema, countryCode: countryCodeSchema.optional() }).strict();

export type MobileChangeDto = z.output<typeof mobileChangeSchema>;

export const adminUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().min(2).max(120).optional(),
  status: z.enum(Object.values(UserStatus)).optional(),
});

export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;

export const adminUpdateUserSchema = z.object({ status: z.enum(Object.values(UserStatus)) }).strict();

export type AdminUpdateUserDto = z.output<typeof adminUpdateUserSchema>;

export const pushTokenSchema = z.object({ token: z.string().regex(EXPO_PUSH_TOKEN_PATTERN, 'must be an Expo push token').nullable() }).strict();
export type PushTokenDto = z.output<typeof pushTokenSchema>;
