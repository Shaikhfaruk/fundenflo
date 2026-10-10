import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { IdentifierType, PartnerKycStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { namesCompatible } from '../../../engines/party-matching/lead-match.js';
import { BlindIndexDomain, CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { BlindIndex } from '../../../infrastructure/crypto/blind-index.service.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { InjectPanVerifier, PAN_STATUS_MESSAGES, PAN_UNVERIFIED_MESSAGE, PanStatus, type PanVerifier } from '../../../integrations/kyc/pan-verifier.port.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { BANK_ACCOUNT_VISIBLE_DIGITS, BANK_SHARE_SCAN_LIMIT, DECLARED_SOURCE, GSTIN_PAN_SLICE, PARTNER_KYC_SOURCE } from '../domain/partner.constants.js';
import { type PartnerWithDetails, PartnerRepository } from '../infrastructure/partner.repository.js';
import { toPartnerView } from './partner.views.js';

export type BankAccountInput = { accountNumber: string; ifsc: string; holderName: string };

export type PartnerKycInput = { membershipNumber?: string; firmRegistrationNumber?: string; pan?: string; gstin?: string; bankAccount?: BankAccountInput };

@Injectable()
export class PartnerKycService {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly parties: PartyService,
    private readonly cipher: FieldCipher,
    private readonly blindIndex: BlindIndex,
    private readonly changes: ChangeRecorder,
    @InjectPanVerifier() private readonly verifier: PanVerifier,
  ) {}

  async profile(actor: UserActor) {
    return this.withIdentifiers(await this.requireFor(actor));
  }

  async profileOf(organizationId: string) {
    const partner = await this.partners.findByOrganization(organizationId);
    if (!partner) throw new AppError(ErrorCode.NOT_FOUND);
    return this.withIdentifiers(partner);
  }

  async payoutReady(organizationId: string) {
    return (await this.partners.findByOrganization(organizationId))?.kycStatus === PartnerKycStatus.verified;
  }

  async panVerified(organizationId: string) {
    const partner = await this.partners.findByOrganization(organizationId);
    return partner ? ((await this.parties.identifier(partner.organization.partyId, IdentifierType.pan))?.verified ?? false) : false;
  }

  async sharingBankAccount(organizationId: string) {
    const partner = await this.partners.findByOrganization(organizationId);
    if (!partner?.bankAccountHash) return [];
    return (await this.partners.list({ bankAccountHash: partner.bankAccountHash, organizationId: { not: organizationId } }, BANK_SHARE_SCAN_LIMIT)).map((row) => row.organizationId);
  }

  async bankAccount(organizationId: string): Promise<BankAccountInput | null> {
    const partner = await this.partners.findByOrganization(organizationId);
    return partner?.bankAccountEnc ? this.cipher.decryptJson<BankAccountInput>(partner.bankAccountEnc, CipherPurpose.PartnerBankAccount) : null;
  }

  @Transactional()
  async update(actor: UserActor, input: PartnerKycInput, expectedVersion: number | undefined) {
    const partner = await this.requireFor(actor);
    assertVersion(expectedVersion, partner.version);
    const partyId = partner.organization.partyId;
    if (input.gstin && input.pan && input.gstin.slice(...GSTIN_PAN_SLICE) !== input.pan) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'gstin', code: 'pan_mismatch', message: 'the GSTIN must contain the firm PAN' }] });
    if (input.pan) {
      const result = await this.verifier.verify({ pan: input.pan, name: partner.organization.name });
      if (result.status !== PanStatus.Valid) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'pan', code: result.status, message: PAN_STATUS_MESSAGES[result.status] ?? PAN_UNVERIFIED_MESSAGE }] });
      await this.parties.setIdentifier(partyId, { type: IdentifierType.pan, value: input.pan, verified: namesCompatible(result.nameOnRecord, partner.organization.name), source: `${PARTNER_KYC_SOURCE}:${result.provider}` });
    }
    if (input.gstin) await this.parties.setIdentifier(partyId, { type: IdentifierType.gstin, value: input.gstin, verified: false, source: `${PARTNER_KYC_SOURCE}:${DECLARED_SOURCE}` });
    const bank = input.bankAccount
      ? { bankAccountEnc: this.cipher.encryptJson(input.bankAccount, CipherPurpose.PartnerBankAccount), bankAccountLast4: input.bankAccount.accountNumber.slice(-BANK_ACCOUNT_VISIBLE_DIGITS), bankIfsc: input.bankAccount.ifsc, bankAccountHash: this.blindIndex.hash(BlindIndexDomain.BankAccount, `${input.bankAccount.ifsc}:${input.bankAccount.accountNumber}`), bankUpdatedAt: new Date() }
      : {};
    const panVerified = (await this.parties.identifier(partyId, IdentifierType.pan))?.verified ?? false;
    const hasBank = Boolean(input.bankAccount ?? partner.bankAccountEnc);
    const status = panVerified && hasBank ? PartnerKycStatus.verified : PartnerKycStatus.pending;
    const moved = await this.partners.updateVersioned(partner.id, partner.version, {
      membershipNumber: input.membershipNumber,
      firmRegistrationNumber: input.firmRegistrationNumber,
      ...bank,
      kycStatus: status,
      kycVerifiedAt: status === PartnerKycStatus.verified ? (partner.kycVerifiedAt ?? new Date()) : null,
    });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: partner.version + 1 } });
    await this.changes.record({
      action: AuditAction.PartnerKycUpdated,
      entityType: AuditEntity.PartnerProfile,
      entityId: partner.id,
      event: EventName.PartnerKycUpdated,
      metadata: { fields: Object.keys(input), status },
      payload: { partnerId: partner.id, organizationId: partner.organizationId, kycStatus: status },
    });
    return this.profileOf(partner.organizationId);
  }

  private async withIdentifiers(partner: PartnerWithDetails) {
    const view = toPartnerView(partner);
    const partyId = partner.organization.partyId;
    return { ...view, kyc: { ...view.kyc, pan: await this.parties.identifier(partyId, IdentifierType.pan), gstin: await this.parties.identifier(partyId, IdentifierType.gstin) } };
  }

  private async requireFor(actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    const partner = await this.partners.findByOrganization(actor.organizationId);
    if (!partner) throw new AppError(ErrorCode.NOT_FOUND);
    return partner;
  }
}
