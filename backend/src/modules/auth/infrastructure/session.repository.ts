import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { membershipWithOrganization } from '../../access/infrastructure/access.repository.js';

export const refreshWithSession = {
  session: { include: { user: true, membership: { include: membershipWithOrganization } } },
} satisfies Prisma.RefreshTokenInclude;

export type RefreshWithSession = Prisma.RefreshTokenGetPayload<{ include: typeof refreshWithSession }>;

@Injectable()
export class SessionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.SessionUncheckedCreateInput) {
    return this.txHost.tx.session.create({ data });
  }

  findById(id: string) {
    return this.txHost.tx.session.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.SessionUncheckedUpdateInput) {
    return this.txHost.tx.session.update({ where: { id }, data });
  }

  listActive(userId: string) {
    return this.txHost.tx.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  findActiveIds(where: Prisma.SessionWhereInput) {
    return this.txHost.tx.session.findMany({ where: { ...where, revokedAt: null }, select: { id: true } });
  }

  revokeSessions(ids: string[], reason: string) {
    return this.txHost.tx.session.updateMany({ where: { id: { in: ids }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  }

  createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput) {
    return this.txHost.tx.refreshToken.create({ data });
  }

  findRefreshByHash(tokenHash: string) {
    return this.txHost.tx.refreshToken.findUnique({ where: { tokenHash }, include: refreshWithSession });
  }

  markRefreshUsed(id: string) {
    return this.txHost.tx.refreshToken.updateMany({ where: { id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
  }

  revokeRefreshTokens(where: Prisma.RefreshTokenWhereInput) {
    return this.txHost.tx.refreshToken.updateMany({ where: { ...where, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
