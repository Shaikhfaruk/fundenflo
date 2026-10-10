import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { OrganizationStatus, PartnerVerificationStatus, ReferralCodeStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { ReferralCode } from '../../../generated/prisma/client.js';
import { isUniqueViolation } from '../../../infrastructure/database/prisma-errors.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_ATTEMPTS, REFERRAL_CODE_LENGTH } from '../domain/partner.constants.js';
import { LeadAttributionRepository } from '../infrastructure/lead-attribution.repository.js';
import { PartnerRepository } from '../infrastructure/partner.repository.js';

export type ResolvedReferralCode = { referralCodeId: string; organizationId: string; membershipId: string | null };

const newCode = () => Array.from({ length: REFERRAL_CODE_LENGTH }, () => REFERRAL_CODE_ALPHABET[randomInt(0, REFERRAL_CODE_ALPHABET.length)]).join('');

const toReferralCodeView = (code: ReferralCode) => ({ id: code.id, code: code.code, scope: code.membershipId ? 'member' : 'firm', membershipId: code.membershipId, status: code.status, createdAt: code.createdAt.toISOString() });

@Injectable()
export class ReferralCodeService {
  constructor(
    private readonly repository: LeadAttributionRepository,
    private readonly partners: PartnerRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  async forActor(actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    const partner = await this.partners.findByOrganization(actor.organizationId);
    if (!partner) throw new AppError(ErrorCode.NOT_FOUND);
    if (partner.verificationStatus !== PartnerVerificationStatus.verified || partner.organization.status !== OrganizationStatus.active) return { available: false, items: [] };
    const codes = [await this.ensure(actor.organizationId, null), ...(actor.membershipId ? [await this.ensure(actor.organizationId, actor.membershipId)] : [])];
    return { available: true, items: codes.map(toReferralCodeView) };
  }

  async resolve(code: string): Promise<ResolvedReferralCode | null> {
    const row = await this.repository.findReferralCode(code.trim().toUpperCase());
    if (row?.status !== ReferralCodeStatus.active) return null;
    const partner = await this.partners.findByOrganization(row.organizationId);
    if (partner?.verificationStatus !== PartnerVerificationStatus.verified || partner.organization.status !== OrganizationStatus.active) return null;
    return { referralCodeId: row.id, organizationId: row.organizationId, membershipId: row.membershipId };
  }

  private async ensure(organizationId: string, membershipId: string | null) {
    const existing = await this.repository.findActiveReferralCode(organizationId, membershipId);
    if (existing) return existing;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const created = await this.repository.createReferralCode({ code: newCode(), organizationId, membershipId });
        await this.changes.record({ action: AuditAction.ReferralCodeIssued, entityType: AuditEntity.ReferralCode, entityId: created.id, event: EventName.ReferralCodeIssued, metadata: { organizationId, membershipId }, payload: { referralCodeId: created.id, organizationId, membershipId } });
        return created;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= REFERRAL_CODE_ATTEMPTS) throw error;
        const raced = await this.repository.findActiveReferralCode(organizationId, membershipId);
        if (raced) return raced;
      }
    }
  }
}
