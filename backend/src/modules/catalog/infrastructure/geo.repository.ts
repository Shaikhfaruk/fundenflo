import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { type AliasKind, CatalogStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const cityInclude = { state: { select: { gstCode: true, name: true } } } satisfies Prisma.GeoCityInclude;

export type CityWithState = Prisma.GeoCityGetPayload<{ include: typeof cityInclude }>;

export const pincodeInclude = {
  state: { select: { gstCode: true, name: true } },
  city: { select: { id: true, name: true } },
} satisfies Prisma.GeoPincodeInclude;

export type PincodeWithPlace = Prisma.GeoPincodeGetPayload<{ include: typeof pincodeInclude }>;

@Injectable()
export class GeoRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  listStates() {
    return this.txHost.tx.geoState.findMany({ where: { status: CatalogStatus.active }, orderBy: { name: 'asc' } });
  }

  findActiveStatesByCodes(gstCodes: string[]) {
    return this.txHost.tx.geoState.findMany({ where: { gstCode: { in: gstCodes }, status: CatalogStatus.active } });
  }

  findActiveCitiesByIds(ids: string[]) {
    return this.txHost.tx.geoCity.findMany({ where: { id: { in: ids }, status: CatalogStatus.active }, include: cityInclude });
  }

  findStateByCode(gstCode: string) {
    return this.txHost.tx.geoState.findUnique({ where: { gstCode } });
  }

  searchCities(input: { prefix: string; aliasCityIds: string[]; stateGstCode?: string; take: number }) {
    return this.txHost.tx.geoCity.findMany({
      where: {
        status: CatalogStatus.active,
        state: input.stateGstCode ? { gstCode: input.stateGstCode } : undefined,
        OR: [
          { name: { startsWith: input.prefix, mode: 'insensitive' } },
          { name: { contains: ` ${input.prefix}`, mode: 'insensitive' } },
          ...(input.aliasCityIds.length > 0 ? [{ id: { in: input.aliasCityIds } }] : []),
        ],
      },
      include: cityInclude,
      orderBy: { name: 'asc' },
      take: input.take,
    });
  }

  listCities(where: Prisma.GeoCityWhereInput, take: number) {
    return this.txHost.tx.geoCity.findMany({ where, include: cityInclude, orderBy: { id: 'desc' }, take });
  }

  findCity(id: string) {
    return this.txHost.tx.geoCity.findUnique({ where: { id }, include: cityInclude });
  }

  findCityByName(stateId: string, name: string) {
    return this.txHost.tx.geoCity.findUnique({ where: { stateId_name: { stateId, name } }, include: cityInclude });
  }

  findCitiesByExactName(name: string) {
    return this.txHost.tx.geoCity.findMany({ where: { name: { equals: name, mode: 'insensitive' }, status: CatalogStatus.active }, include: cityInclude });
  }

  createCity(data: Prisma.GeoCityUncheckedCreateInput) {
    return this.txHost.tx.geoCity.create({ data, include: cityInclude });
  }

  updateCityVersioned(id: string, version: number, data: Prisma.GeoCityUpdateManyMutationInput) {
    return this.txHost.tx.geoCity.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  findPincode(pincode: string) {
    return this.txHost.tx.geoPincode.findUnique({ where: { pincode }, include: pincodeInclude });
  }

  listPincodes(where: Prisma.GeoPincodeWhereInput, take: number) {
    return this.txHost.tx.geoPincode.findMany({ where, include: pincodeInclude, orderBy: { pincode: 'asc' }, take });
  }

  upsertPincode(data: { pincode: string; stateId: string; cityId: string | null; district: string | null; status: CatalogStatus }) {
    return this.txHost.tx.geoPincode.upsert({
      where: { pincode: data.pincode },
      create: data,
      update: { stateId: data.stateId, cityId: data.cityId, district: data.district, status: data.status },
      include: pincodeInclude,
    });
  }

  findAliases(kind: AliasKind, aliases: string[]) {
    return this.txHost.tx.lookupAlias.findMany({ where: { kind, alias: { in: aliases } } });
  }

  findAliasesByPrefix(kind: AliasKind, prefix: string, take: number) {
    return this.txHost.tx.lookupAlias.findMany({ where: { kind, alias: { startsWith: prefix } }, take });
  }

  listAliases(where: Prisma.LookupAliasWhereInput, take: number) {
    return this.txHost.tx.lookupAlias.findMany({ where, orderBy: { id: 'desc' }, take });
  }

  findAlias(id: string) {
    return this.txHost.tx.lookupAlias.findUnique({ where: { id } });
  }

  createAlias(data: Prisma.LookupAliasUncheckedCreateInput) {
    return this.txHost.tx.lookupAlias.create({ data });
  }

  deleteAlias(id: string) {
    return this.txHost.tx.lookupAlias.delete({ where: { id } });
  }

  categoryExists(id: string) {
    return this.txHost.tx.loanCategory.count({ where: { id } });
  }

  stateExists(id: string) {
    return this.txHost.tx.geoState.count({ where: { id } });
  }
}
