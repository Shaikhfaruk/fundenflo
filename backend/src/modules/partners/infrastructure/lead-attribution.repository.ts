import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class LeadAttributionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.LeadAttributionUncheckedCreateInput) {
    return this.txHost.tx.leadAttribution.create({ data });
  }

  findActive(leadIds: string[], now: Date) {
    return this.txHost.tx.leadAttribution.findMany({ where: { leadId: { in: leadIds }, protectedUntil: { gt: now } } });
  }

  listForOrganization(organizationId: string, idFilter: Prisma.UuidFilter | undefined, take: number) {
    return this.txHost.tx.leadAttribution.findMany({ where: { organizationId, id: idFilter }, orderBy: { id: 'desc' }, take });
  }

  countActive(organizationId: string, now: Date) {
    return this.txHost.tx.leadAttribution.count({ where: { organizationId, protectedUntil: { gt: now } } });
  }
}
