import { Inject } from '@nestjs/common';

import { MINUTE_MS } from '../../common/constants/time.constants.js';

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

export type EncryptedColumn = { table: string; key: string; column: string; jsonField?: string; purpose: CipherPurpose };

export const ENCRYPTED_COLUMNS: readonly EncryptedColumn[] = [
  { table: 'party_contacts', key: 'id', column: 'value_enc', purpose: CipherPurpose.PartyContact },
  { table: 'party_identifiers', key: 'id', column: 'value_enc', purpose: CipherPurpose.PartyIdentifier },
  { table: 'user_logins', key: 'id', column: 'identifier_enc', purpose: CipherPurpose.UserLoginIdentifier },
  { table: 'invitations', key: 'id', column: 'identifier_enc', purpose: CipherPurpose.InvitationIdentifier },
  { table: 'staff_credentials', key: 'user_id', column: 'totp_secret_enc', purpose: CipherPurpose.TotpSecret },
  { table: 'borrower_facts', key: 'id', column: 'value_enc', purpose: CipherPurpose.BorrowerFact },
  { table: 'leads', key: 'id', column: 'raw_payload_enc', purpose: CipherPurpose.LeadRawPayload },
  { table: 'import_rows', key: 'id', column: 'raw_enc', purpose: CipherPurpose.ImportRow },
  { table: 'import_batches', key: 'id', column: 'sample_rows_enc', purpose: CipherPurpose.ImportSample },
  { table: 'documents', key: 'id', column: 'password_enc', purpose: CipherPurpose.DocumentPassword },
  { table: 'lender_contacts', key: 'id', column: 'email_enc', purpose: CipherPurpose.LenderContact },
  { table: 'lender_contacts', key: 'id', column: 'mobile_enc', purpose: CipherPurpose.LenderContact },
  { table: 'partner_profiles', key: 'id', column: 'bank_account_enc', purpose: CipherPurpose.PartnerBankAccount },
  { table: 'submission_packets', key: 'id', column: 'snapshot', jsonField: 'enc', purpose: CipherPurpose.SubmissionPacket },
];

export const KEY_ROTATION_SETTING = 'fundenflo.key_rotation';

export const KEY_ROTATION_BATCH = 500;

export const KEY_ROTATION_TIME_BUDGET_MS = MINUTE_MS;

export const KEY_ROTATION_START_KEY = '00000000-0000-0000-0000-000000000000';

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
  BankAccount: 'bank_account',
} as const;

export type BlindIndexDomain = (typeof BlindIndexDomain)[keyof typeof BlindIndexDomain];
