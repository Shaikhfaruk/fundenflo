import { Inject } from '@nestjs/common';

export const KEY_PROVIDER = Symbol('KEY_PROVIDER');

export const InjectKeyProvider = () => Inject(KEY_PROVIDER);

export const CIPHER_FORMAT_VERSION = 'v1';

export const CIPHER_ALGORITHM = 'aes-256-gcm';

export const CIPHER_IV_BYTES = 12;

export const KEY_VAULT_WRAP_ALGORITHM = 'RSA-OAEP-256';

export const CipherPurpose = {
  PartyContact: 'party_contacts.value',
  PartyIdentifier: 'party_identifiers.value',
  UserLoginIdentifier: 'user_logins.identifier',
  InvitationIdentifier: 'invitations.identifier',
  OtpChallengePayload: 'otp_challenges.payload',
  TotpSecret: 'staff_credentials.totp_secret',
  NotificationPayload: 'notifications.payload',
  MfaChallenge: 'auth.mfa_challenge',
  BorrowerFact: 'borrower_facts.value',
  LeadRawPayload: 'leads.raw_payload',
  ImportRow: 'import_rows.raw',
  ImportSample: 'import_batches.sample_rows',
  DocumentPassword: 'documents.password',
  LenderContact: 'lender_contacts.value',
  SubmissionPacket: 'submission_packets.snapshot',
  PartnerBankAccount: 'partner_profiles.bank_account',
} as const;

export type CipherPurpose = (typeof CipherPurpose)[keyof typeof CipherPurpose];

export const BlindIndexDomain = {
  Mobile: 'mobile',
  Email: 'email',
  Landline: 'landline',
  Pan: 'pan',
  Gstin: 'gstin',
  Cin: 'cin',
  Udyam: 'udyam',
  Din: 'din',
  PushToken: 'push_token',
} as const;

export type BlindIndexDomain = (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain];
