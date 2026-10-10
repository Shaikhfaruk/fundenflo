import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { DocumentRequestStatus, Prisma, SubmissionStatus } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class SubmissionRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.LenderSubmissionUncheckedCreateInput) {
    return this.txHost.tx.lenderSubmission.create({ data });
  }

  findOne(where: Prisma.LenderSubmissionWhereInput) {
    return this.txHost.tx.lenderSubmission.findFirst({ where });
  }

  list(where: Prisma.LenderSubmissionWhereInput, take: number) {
    return this.txHost.tx.lenderSubmission.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  async lock(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM lender_submissions WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateFromStatus(id: string, status: SubmissionStatus, data: Prisma.LenderSubmissionUncheckedUpdateManyInput) {
    return this.txHost.tx.lenderSubmission.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  async statuses(applicationId: string) {
    return (await this.txHost.tx.lenderSubmission.findMany({ where: { applicationId }, select: { status: true } })).map((row) => row.status);
  }

  createEvent(data: Prisma.SubmissionEventUncheckedCreateInput) {
    return this.txHost.tx.submissionEvent.create({ data });
  }

  events(submissionId: string, take: number) {
    return this.txHost.tx.submissionEvent.findMany({ where: { submissionId }, orderBy: { createdAt: 'asc' }, take });
  }

  async evidenceIds(submissionId: string) {
    return (await this.txHost.tx.submissionEvent.findMany({ where: { submissionId, evidenceDocumentId: { not: null } }, select: { evidenceDocumentId: true } })).map((row) => row.evidenceDocumentId as string);
  }

  createPacket(data: Prisma.SubmissionPacketUncheckedCreateInput) {
    return this.txHost.tx.submissionPacket.create({ data });
  }

  latestPacket(submissionId: string) {
    return this.txHost.tx.submissionPacket.findFirst({ where: { submissionId }, orderBy: { createdAt: 'desc' } });
  }

  createRequest(data: Prisma.DocumentRequestUncheckedCreateInput) {
    return this.txHost.tx.documentRequest.create({ data });
  }

  requests(where: Prisma.DocumentRequestWhereInput, take: number) {
    return this.txHost.tx.documentRequest.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  async lockRequest(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM document_requests WHERE id = ${id}::uuid FOR UPDATE`;
  }

  findRequest(id: string) {
    return this.txHost.tx.documentRequest.findUnique({ where: { id } });
  }

  updateRequestFromStatus(id: string, status: DocumentRequestStatus, data: Prisma.DocumentRequestUncheckedUpdateManyInput) {
    return this.txHost.tx.documentRequest.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  updateRequestsWhere(where: Prisma.DocumentRequestWhereInput, data: Prisma.DocumentRequestUncheckedUpdateManyInput) {
    return this.txHost.tx.documentRequest.updateMany({ where, data: { ...data, version: { increment: 1 } } });
  }

  countRequests(where: Prisma.DocumentRequestWhereInput) {
    return this.txHost.tx.documentRequest.count({ where });
  }

  async fulfilledIds(submissionId: string) {
    return (await this.txHost.tx.documentRequest.findMany({ where: { submissionId }, select: { fulfilledDocumentIds: true } })).flatMap((row) => row.fulfilledDocumentIds);
  }
}
