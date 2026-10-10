import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type ContactType, MatchReviewStatus, PartyKind, PartyStatus, type RelationshipType } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class PartyRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: { kind: PartyKind; displayName?: string | null; preferredLanguage?: string | null }) {
    return this.txHost.tx.party.create({ data });
  }

  findById(id: string) {
    return this.txHost.tx.party.findUnique({ where: { id } });
  }

  findContactCandidates(type: ContactType, valueHash: string) {
    return this.txHost.tx.partyContact.findMany({
      where: { type, valueHash, party: { status: PartyStatus.active, kind: PartyKind.person } },
      select: { partyId: true, verifiedAt: true, doNotContact: true, invalidAt: true, party: { select: { displayName: true, user: { select: { id: true } } } } },
    });
  }

  findContact(partyId: string, type: ContactType, valueHash: string) {
    return this.txHost.tx.partyContact.findUnique({ where: { partyId_type_valueHash: { partyId, type, valueHash } } });
  }

  listContacts(partyId: string) {
    return this.txHost.tx.partyContact.findMany({ where: { partyId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
  }

  findPrimaryContact(partyId: string, type: ContactType) {
    return this.txHost.tx.partyContact.findFirst({
      where: { partyId, type, invalidAt: null },
      orderBy: [{ isPrimary: 'desc' }, { verifiedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
  }

  createContact(data: Prisma.PartyContactUncheckedCreateInput) {
    return this.txHost.tx.partyContact.create({ data });
  }

  updateContact(id: string, data: Prisma.PartyContactUpdateInput) {
    return this.txHost.tx.partyContact.update({ where: { id }, data });
  }

  clearPrimary(partyId: string, type: ContactType, exceptId: string) {
    return this.txHost.tx.partyContact.updateMany({ where: { partyId, type, isPrimary: true, id: { not: exceptId } }, data: { isPrimary: false } });
  }

  updateVersioned(id: string, expectedVersion: number, data: Prisma.PartyUpdateManyMutationInput) {
    return this.txHost.tx.party.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
  }

  createMatchReview(data: { partyId: string; candidatePartyIds: string[]; signals: Prisma.InputJsonValue }) {
    return this.txHost.tx.partyMatchReview.create({ data });
  }

  async lockParties(ids: string[]) {
    for (const id of ids.toSorted()) await this.txHost.tx.$queryRaw`SELECT id FROM parties WHERE id = ${id}::uuid FOR UPDATE`;
  }

  findWithLinks(ids: string[]) {
    return this.txHost.tx.party.findMany({
      where: { id: { in: ids } },
      include: { contacts: { orderBy: { createdAt: 'asc' } }, identifiers: true, user: { select: { id: true } }, organization: { select: { id: true, name: true, type: true } } },
    });
  }

  listIdentifiers(partyId: string) {
    return this.txHost.tx.partyIdentifier.findMany({ where: { partyId } });
  }

  moveContact(id: string, partyId: string, isPrimary: boolean) {
    return this.txHost.tx.partyContact.update({ where: { id }, data: { partyId, isPrimary } });
  }

  moveIdentifiers(ids: string[], partyId: string) {
    return this.txHost.tx.partyIdentifier.updateMany({ where: { id: { in: ids } }, data: { partyId } });
  }

  findRelationship(fromPartyId: string, toPartyId: string, type: RelationshipType) {
    return this.txHost.tx.partyRelationship.findFirst({ where: { fromPartyId, toPartyId, type, endedAt: null } });
  }

  createRelationship(data: Prisma.PartyRelationshipUncheckedCreateInput) {
    return this.txHost.tx.partyRelationship.create({ data });
  }

  businessesOf(personPartyId: string) {
    return this.txHost.tx.party.findMany({ where: { kind: PartyKind.business, status: PartyStatus.active, relationshipsTo: { some: { fromPartyId: personPartyId, endedAt: null } } } });
  }

  relationshipsTouching(partyId: string) {
    return this.txHost.tx.partyRelationship.findMany({ where: { OR: [{ fromPartyId: partyId }, { toPartyId: partyId }] } });
  }

  moveRelationshipEnds(ids: string[], end: 'fromPartyId' | 'toPartyId', partyId: string) {
    return this.txHost.tx.partyRelationship.updateMany({ where: { id: { in: ids } }, data: { [end]: partyId } });
  }

  setMerged(id: string, mergedIntoId: string | null) {
    return this.txHost.tx.party.update({ where: { id }, data: { status: mergedIntoId ? PartyStatus.merged : PartyStatus.active, mergedIntoId, version: { increment: 1 } } });
  }

  createMerge(data: Prisma.PartyMergeUncheckedCreateInput) {
    return this.txHost.tx.partyMerge.create({ data });
  }

  findMerge(id: string) {
    return this.txHost.tx.partyMerge.findUnique({ where: { id } });
  }

  listMerges(where: Prisma.PartyMergeWhereInput, take: number) {
    return this.txHost.tx.partyMerge.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  markMergeReverted(id: string, revertedByUserId: string) {
    return this.txHost.tx.partyMerge.updateMany({ where: { id, revertedAt: null }, data: { revertedAt: new Date(), revertedByUserId } });
  }

  findMatchReview(id: string) {
    return this.txHost.tx.partyMatchReview.findUnique({ where: { id } });
  }

  listMatchReviews(where: Prisma.PartyMatchReviewWhereInput, take: number) {
    return this.txHost.tx.partyMatchReview.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  resolveMatchReview(id: string, status: MatchReviewStatus, resolution: string, resolvedByUserId: string) {
    return this.txHost.tx.partyMatchReview.updateMany({ where: { id, status: MatchReviewStatus.open }, data: { status, resolution, resolvedByUserId, resolvedAt: new Date() } });
  }

  resolveOpenReviewsFor(partyId: string, resolution: string, resolvedByUserId: string) {
    return this.txHost.tx.partyMatchReview.updateMany({
      where: { status: MatchReviewStatus.open, OR: [{ partyId }, { candidatePartyIds: { has: partyId } }] },
      data: { status: MatchReviewStatus.linked, resolution, resolvedByUserId, resolvedAt: new Date() },
    });
  }
}
