import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type ContactType, PartyKind, PartyStatus } from '../../../common/enums/db.enums.js';
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
}
