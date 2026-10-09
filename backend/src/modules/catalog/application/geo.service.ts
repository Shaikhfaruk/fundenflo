import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { AliasKind, CatalogStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { normaliseLookupText } from '../domain/alias.js';
import { CATALOG_CACHE_TTL_SECONDS, CatalogCacheTag, CITY_SEARCH_LIMIT } from '../domain/catalog.constants.js';
import { type CityWithState, GeoRepository } from '../infrastructure/geo.repository.js';
import { toAliasView, toCityView, toPincodeView } from './catalog.views.js';

export type ResolvedPlace = {
  cityId: string;
  cityName: string;
  stateId: string;
  stateGstCode: string;
};

@Injectable()
export class GeoService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly geo: GeoRepository,
    private readonly cache: CacheService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  states() {
    return this.cache.wrap('geo:states', [CatalogCacheTag.Geo], CATALOG_CACHE_TTL_SECONDS, async () =>
      (await this.geo.listStates()).map((state) => ({ gstCode: state.gstCode, name: state.name, kind: state.kind })),
    );
  }

  async searchCities(query: string, stateGstCode: string | undefined) {
    const prefix = normaliseLookupText(query);
    const aliases = await this.geo.findAliasesByPrefix(AliasKind.city, prefix, CITY_SEARCH_LIMIT);
    const cities = await this.geo.searchCities({ prefix, aliasCityIds: aliases.map((alias) => alias.targetId), stateGstCode, take: CITY_SEARCH_LIMIT });
    return { items: cities.map((city) => ({ id: city.id, name: city.name, state: city.state })) };
  }

  async pincode(pincode: string) {
    const found = await this.geo.findPincode(pincode);
    if (!found || found.status !== CatalogStatus.active) throw new AppError(ErrorCode.NOT_FOUND);
    return toPincodeView(found);
  }

  async resolveCity(text: string): Promise<ResolvedPlace | null> {
    const [cityPart, statePart] = text.split(',').map((part) => normaliseLookupText(part));
    if (!cityPart) return null;
    const [alias] = await this.geo.findAliases(AliasKind.city, [cityPart]);
    const candidates: CityWithState[] = alias
      ? [await this.geo.findCity(alias.targetId)].filter((city): city is CityWithState => Boolean(city))
      : await this.geo.findCitiesByExactName(cityPart);
    const matches = statePart ? candidates.filter((city) => normaliseLookupText(city.state.name) === statePart) : candidates;
    const [city] = matches;
    if (!city || matches.length > 1) return null;
    const state = await this.geo.findStateByCode(city.state.gstCode);
    return state ? { cityId: city.id, cityName: city.name, stateId: state.id, stateGstCode: state.gstCode } : null;
  }

  async listCities(filters: PageQuery & { stateGstCode?: string; q?: string }) {
    const window = pageWindow(filters);
    const rows = await this.geo.listCities(
      {
        id: window.idFilter,
        state: filters.stateGstCode ? { gstCode: filters.stateGstCode } : undefined,
        name: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
      },
      window.take,
    );
    return toPage(rows, filters.limit, toCityView);
  }

  createCity(input: { stateGstCode: string; name: string }) {
    return this.mutate(async () => {
      const state = await this.requireState(input.stateGstCode);
      const city = await this.geo.createCity({ stateId: state.id, name: input.name });
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.GeoCity, city.id, { name: city.name, state: state.gstCode });
      return toCityView(city);
    });
  }

  updateCity(id: string, patch: { name?: string; status?: CatalogStatus }, expectedVersion: number | undefined) {
    return this.mutate(async () => {
      const city = await this.geo.findCity(id);
      if (!city) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, city.version);
      const result = await this.geo.updateCityVersioned(id, city.version, patch);
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: city.version + 1 } });
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.GeoCity, id, { fields: Object.keys(patch) });
      return toCityView((await this.geo.findCity(id)) ?? city);
    });
  }

  async listPincodes(filters: { after?: string; limit: number; stateGstCode?: string; cityId?: string; prefix?: string }) {
    const rows = await this.geo.listPincodes(
      {
        pincode: { ...(filters.after ? { gt: filters.after } : {}), ...(filters.prefix ? { startsWith: filters.prefix } : {}) },
        state: filters.stateGstCode ? { gstCode: filters.stateGstCode } : undefined,
        cityId: filters.cityId,
      },
      filters.limit + 1,
    );
    const hasMore = rows.length > filters.limit;
    const items = (hasMore ? rows.slice(0, filters.limit) : rows).map(toPincodeView);
    return { items, nextCursor: hasMore ? (items.at(-1)?.pincode ?? null) : null };
  }

  upsertPincode(input: { pincode: string; stateGstCode: string; cityId?: string; district?: string; status?: CatalogStatus }) {
    return this.mutate(async () => {
      const state = await this.requireState(input.stateGstCode);
      if (input.cityId) {
        const city = await this.geo.findCity(input.cityId);
        if (!city || city.state.gstCode !== state.gstCode) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'cityId', code: 'city_state_mismatch', message: 'city must belong to the state' }] });
        }
      }
      const pincode = await this.geo.upsertPincode({
        pincode: input.pincode,
        stateId: state.id,
        cityId: input.cityId ?? null,
        district: input.district ?? null,
        status: input.status ?? CatalogStatus.active,
      });
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.GeoPincode, pincode.pincode, { state: state.gstCode });
      return toPincodeView(pincode);
    });
  }

  async listAliases(filters: PageQuery & { kind?: AliasKind }) {
    const window = pageWindow(filters);
    const rows = await this.geo.listAliases({ id: window.idFilter, kind: filters.kind }, window.take);
    return toPage(rows, filters.limit, toAliasView);
  }

  createAlias(input: { kind: AliasKind; alias: string; targetId: string }, createdByUserId: string) {
    return this.mutate(async () => {
      await this.assertAliasTarget(input.kind, input.targetId);
      const alias = await this.geo.createAlias({ kind: input.kind, alias: normaliseLookupText(input.alias), targetId: input.targetId, createdByUserId });
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.LookupAlias, alias.id, { kind: alias.kind, alias: alias.alias });
      return toAliasView(alias);
    });
  }

  deleteAlias(id: string) {
    return this.mutate(async () => {
      const alias = await this.geo.findAlias(id);
      if (!alias) throw new AppError(ErrorCode.NOT_FOUND);
      await this.geo.deleteAlias(id);
      await this.recordChange(AuditAction.CatalogDeleted, AuditEntity.LookupAlias, id, { kind: alias.kind, alias: alias.alias });
    });
  }

  private async assertAliasTarget(kind: AliasKind, targetId: string) {
    const exists =
      kind === AliasKind.city
        ? Boolean(await this.geo.findCity(targetId))
        : kind === AliasKind.state
          ? (await this.geo.stateExists(targetId)) > 0
          : (await this.geo.categoryExists(targetId)) > 0;
    if (!exists) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'targetId', code: 'unknown_target', message: `no ${kind} with this id` }] });
  }

  private async requireState(gstCode: string) {
    const state = await this.geo.findStateByCode(gstCode);
    if (!state) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'stateGstCode', code: 'unknown_state', message: 'unknown GST state code' }] });
    return state;
  }

  private async mutate<T>(work: () => Promise<T>): Promise<T> {
    const result = await this.txHost.withTransaction(work);
    await this.cache.invalidate(CatalogCacheTag.Geo, CatalogCacheTag.Catalog);
    return result;
  }

  private async recordChange(action: AuditAction, entityType: AuditEntity, entityId: string, metadata: Record<string, unknown>) {
    await this.audit.record({ action, entityType, entityId, metadata });
    await this.outbox.publish({ name: EventName.GeoChanged, aggregateType: entityType, aggregateId: entityId, payload: { entityType, entityId, action } });
  }
}
