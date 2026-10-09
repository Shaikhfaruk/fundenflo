import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { CatalogStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const categoryInclude = {
  segments: { include: { segment: { select: { key: true } } }, orderBy: { sortOrder: 'asc' } },
  purposes: { orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] },
} satisfies Prisma.LoanCategoryInclude;

export type CategoryWithRelations = Prisma.LoanCategoryGetPayload<{ include: typeof categoryInclude }>;

export const segmentInclude = {
  subSegments: { orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] },
} satisfies Prisma.SegmentInclude;

export type SegmentWithSubSegments = Prisma.SegmentGetPayload<{ include: typeof segmentInclude }>;

@Injectable()
export class CatalogRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  listSegments(activeOnly: boolean) {
    return this.txHost.tx.segment.findMany({
      where: activeOnly ? { status: CatalogStatus.active } : undefined,
      include: segmentInclude,
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
  }

  findSegment(id: string) {
    return this.txHost.tx.segment.findUnique({ where: { id }, include: segmentInclude });
  }

  findSegmentsByKeys(keys: string[]) {
    return this.txHost.tx.segment.findMany({ where: { key: { in: keys } } });
  }

  createSegment(data: Prisma.SegmentCreateInput) {
    return this.txHost.tx.segment.create({ data, include: segmentInclude });
  }

  updateSegmentVersioned(id: string, version: number, data: Prisma.SegmentUpdateManyMutationInput) {
    return this.txHost.tx.segment.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  findSubSegment(id: string) {
    return this.txHost.tx.subSegment.findUnique({ where: { id } });
  }

  createSubSegment(data: Prisma.SubSegmentUncheckedCreateInput) {
    return this.txHost.tx.subSegment.create({ data });
  }

  updateSubSegmentVersioned(id: string, version: number, data: Prisma.SubSegmentUpdateManyMutationInput) {
    return this.txHost.tx.subSegment.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  listCategories(where: Prisma.LoanCategoryWhereInput) {
    return this.txHost.tx.loanCategory.findMany({ where, include: categoryInclude, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
  }

  findCategory(id: string) {
    return this.txHost.tx.loanCategory.findUnique({ where: { id }, include: categoryInclude });
  }

  findCategoryByKey(key: string) {
    return this.txHost.tx.loanCategory.findUnique({ where: { key }, include: categoryInclude });
  }

  createCategory(data: Prisma.LoanCategoryCreateInput) {
    return this.txHost.tx.loanCategory.create({ data, include: categoryInclude });
  }

  updateCategoryVersioned(id: string, version: number, data: Prisma.LoanCategoryUpdateManyMutationInput) {
    return this.txHost.tx.loanCategory.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  async replaceCategorySegments(categoryId: string, segmentIds: string[]) {
    await this.txHost.tx.categorySegment.deleteMany({ where: { categoryId } });
    await this.txHost.tx.categorySegment.createMany({
      data: segmentIds.map((segmentId, index) => ({ categoryId, segmentId, sortOrder: index })),
    });
  }

  findPurpose(id: string) {
    return this.txHost.tx.categoryPurpose.findUnique({ where: { id } });
  }

  createPurpose(data: Prisma.CategoryPurposeUncheckedCreateInput) {
    return this.txHost.tx.categoryPurpose.create({ data });
  }

  updatePurposeVersioned(id: string, version: number, data: Prisma.CategoryPurposeUpdateManyMutationInput) {
    return this.txHost.tx.categoryPurpose.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
