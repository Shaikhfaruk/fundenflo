import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { PartnerVerificationStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const partnerInclude = {
  organization: { select: { id: true, name: true, status: true, partyId: true } },
  serviceAreas: { include: { state: { select: { gstCode: true, name: true } }, city: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.PartnerProfileInclude;

export type PartnerWithDetails = Prisma.PartnerProfileGetPayload<{ include: typeof partnerInclude }>;

@Injectable()
export class PartnerRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.PartnerProfileUncheckedCreateInput) {
    return this.txHost.tx.partnerProfile.create({ data });
  }

  findById(id: string): Promise<PartnerWithDetails | null> {
    return this.txHost.tx.partnerProfile.findUnique({ where: { id }, include: partnerInclude });
  }

  findByOrganization(organizationId: string): Promise<PartnerWithDetails | null> {
    return this.txHost.tx.partnerProfile.findUnique({ where: { organizationId }, include: partnerInclude });
  }

  list(where: Prisma.PartnerProfileWhereInput, take: number) {
    return this.txHost.tx.partnerProfile.findMany({ where, include: partnerInclude, orderBy: { id: 'desc' }, take });
  }

  routingPool(where: Prisma.PartnerProfileWhereInput) {
    return this.txHost.tx.partnerProfile.findMany({ where, select: { organizationId: true, level: true, maxOpenLeads: true } });
  }

  updateVersioned(id: string, version: number, data: Prisma.PartnerProfileUpdateManyMutationInput) {
    return this.txHost.tx.partnerProfile.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  updateFromStatus(id: string, status: PartnerVerificationStatus, data: Prisma.PartnerProfileUpdateManyMutationInput) {
    return this.txHost.tx.partnerProfile.updateMany({ where: { id, verificationStatus: status }, data: { ...data, version: { increment: 1 } } });
  }

  async replaceServiceAreas(partnerProfileId: string, areas: Array<Omit<Prisma.PartnerServiceAreaCreateManyInput, 'partnerProfileId'>>) {
    await this.txHost.tx.partnerServiceArea.deleteMany({ where: { partnerProfileId } });
    if (areas.length > 0) await this.txHost.tx.partnerServiceArea.createMany({ data: areas.map((area) => ({ ...area, partnerProfileId })) });
  }
}
