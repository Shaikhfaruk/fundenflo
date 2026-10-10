import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type AttributionKind, DisputeStatus, ReferralCodeStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class LeadAttributionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.LeadAttributionUncheckedCreateInput) {
    return this.txHost.tx.leadAttribution.create({ data });
  }

  findActive(leadIds: string[], now: Date) {
    return this.txHost.tx.leadAttribution.findMany({ where: { leadId: { in: leadIds }, protectedUntil: { gt: now }, endedAt: null } });
  }

  findByLeads(leadIds: string[]) {
    return this.txHost.tx.leadAttribution.findMany({ where: { leadId: { in: leadIds } } });
  }

  findById(id: string) {
    return this.txHost.tx.leadAttribution.findUnique({ where: { id } });
  }

  async lock(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM lead_attributions WHERE id = ${id}::uuid FOR UPDATE`;
  }

  update(id: string, data: Prisma.LeadAttributionUncheckedUpdateManyInput) {
    return this.txHost.tx.leadAttribution.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  createReferralCode(data: Prisma.ReferralCodeUncheckedCreateInput) {
    return this.txHost.tx.referralCode.create({ data });
  }

  findActiveReferralCode(organizationId: string, membershipId: string | null) {
    return this.txHost.tx.referralCode.findFirst({ where: { organizationId, membershipId, status: ReferralCodeStatus.active } });
  }

  findReferralCode(code: string) {
    return this.txHost.tx.referralCode.findUnique({ where: { code } });
  }

  createDispute(data: Prisma.AttributionDisputeUncheckedCreateInput) {
    return this.txHost.tx.attributionDispute.create({ data });
  }

  findOpenDispute(attributionId: string, claimantOrganizationId: string) {
    return this.txHost.tx.attributionDispute.findFirst({ where: { attributionId, claimantOrganizationId, status: DisputeStatus.open } });
  }

  findDispute(where: Prisma.AttributionDisputeWhereInput) {
    return this.txHost.tx.attributionDispute.findFirst({ where, include: { attribution: true } });
  }

  listDisputes(where: Prisma.AttributionDisputeWhereInput, take: number) {
    return this.txHost.tx.attributionDispute.findMany({ where, orderBy: { id: 'desc' }, take, include: { attribution: true } });
  }

  async lockDispute(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM attribution_disputes WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateDisputeFromStatus(id: string, status: DisputeStatus, data: Prisma.AttributionDisputeUncheckedUpdateManyInput) {
    return this.txHost.tx.attributionDispute.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  countOpenDisputes(attributionId: string) {
    return this.txHost.tx.attributionDispute.count({ where: { attributionId, status: DisputeStatus.open } });
  }

  listForOrganization(organizationId: string, idFilter: Prisma.UuidFilter | undefined, take: number) {
    return this.txHost.tx.leadAttribution.findMany({ where: { organizationId, id: idFilter }, orderBy: { id: 'desc' }, take });
  }

  countSince(organizationId: string, kind: AttributionKind, since: Date) {
    return this.txHost.tx.leadAttribution.count({ where: { organizationId, kind, createdAt: { gte: since } } });
  }

  countActive(organizationId: string, now: Date) {
    return this.txHost.tx.leadAttribution.count({ where: { organizationId, protectedUntil: { gt: now }, endedAt: null } });
  }
}
