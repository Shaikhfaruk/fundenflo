import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { LoginMethod } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const userWithParty = { party: true } satisfies Prisma.UserInclude;

export type UserWithParty = Prisma.UserGetPayload<{ include: typeof userWithParty }>;

@Injectable()
export class IdentityRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  findLogin(method: LoginMethod, identifierHash: string) {
    return this.txHost.tx.userLogin.findUnique({
      where: { method_identifierHash: { method, identifierHash } },
      include: { user: { include: { staffCredential: true } } },
    });
  }

  findLoginForUser(userId: string, loginId: string) {
    return this.txHost.tx.userLogin.findFirst({ where: { id: loginId, userId } });
  }

  findUserLogin(userId: string, method: LoginMethod) {
    return this.txHost.tx.userLogin.findFirst({ where: { userId, method } });
  }

  listLogins(userId: string) {
    return this.txHost.tx.userLogin.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  countLogins(userId: string) {
    return this.txHost.tx.userLogin.count({ where: { userId } });
  }

  createLogin(data: Prisma.UserLoginUncheckedCreateInput) {
    return this.txHost.tx.userLogin.create({ data });
  }

  updateLogin(id: string, data: Prisma.UserLoginUncheckedUpdateInput) {
    return this.txHost.tx.userLogin.update({ where: { id }, data });
  }

  deleteLogin(id: string) {
    return this.txHost.tx.userLogin.delete({ where: { id } });
  }

  createUser(data: Prisma.UserUncheckedCreateInput) {
    return this.txHost.tx.user.create({ data, include: userWithParty });
  }

  findUser(id: string) {
    return this.txHost.tx.user.findUnique({ where: { id }, include: userWithParty });
  }

  touchLastLogin(userId: string) {
    return this.txHost.tx.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  updateUserVersioned(id: string, expectedVersion: number, data: Prisma.UserUncheckedUpdateManyInput) {
    return this.txHost.tx.user.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
  }

  listUsers(where: Prisma.UserWhereInput, take: number) {
    return this.txHost.tx.user.findMany({
      where,
      include: { ...userWithParty, _count: { select: { memberships: true } } },
      orderBy: { id: 'desc' },
      take,
    });
  }

  findStaffCredential(userId: string) {
    return this.txHost.tx.staffCredential.findUnique({ where: { userId } });
  }

  createStaffCredential(data: Prisma.StaffCredentialUncheckedCreateInput) {
    return this.txHost.tx.staffCredential.create({ data });
  }

  updateStaffCredential(userId: string, data: Prisma.StaffCredentialUncheckedUpdateInput) {
    return this.txHost.tx.staffCredential.update({ where: { userId }, data });
  }

  findUserByParty(partyId: string) {
    return this.txHost.tx.user.findUnique({ where: { partyId }, select: { id: true } });
  }

  moveUserParty(userId: string, partyId: string) {
    return this.txHost.tx.user.update({ where: { id: userId }, data: { partyId } });
  }
}
