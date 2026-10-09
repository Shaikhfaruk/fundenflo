import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class ApiClientRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  list() {
    return this.txHost.tx.apiClient.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string) {
    return this.txHost.tx.apiClient.findUnique({ where: { id } });
  }

  findByPrefix(keyPrefix: string) {
    return this.txHost.tx.apiClient.findUnique({ where: { keyPrefix } });
  }

  create(data: Prisma.ApiClientUncheckedCreateInput) {
    return this.txHost.tx.apiClient.create({ data });
  }

  update(id: string, data: Prisma.ApiClientUpdateInput) {
    return this.txHost.tx.apiClient.update({ where: { id }, data });
  }

  touch(id: string, at: Date) {
    return this.txHost.tx.apiClient.updateMany({ where: { id }, data: { lastUsedAt: at } });
  }
}
