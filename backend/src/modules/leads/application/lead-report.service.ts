import { Injectable } from '@nestjs/common';

import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { AccessRepository } from '../../access/infrastructure/access.repository.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { GeoService } from '../../catalog/application/geo.service.js';
import { type FunnelColumn, type FunnelRow, LeadRepository } from '../infrastructure/lead.repository.js';

type FunnelGroup = { key: string | null; label: string; total: number; byStatus: Record<string, number>; byConsent: Record<string, number> };

const ratio = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 1000);

const minutes = (seconds: number | null) => (seconds === null ? null : Math.round(seconds / 60));

@Injectable()
export class LeadReportService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly access: AccessRepository,
    private readonly catalog: CatalogQueryService,
    private readonly geo: GeoService,
  ) {}

  async funnel(groupBy: FunnelColumn, from: Date, to: Date) {
    const rows = await this.leads.funnelCounts(groupBy, from, to);
    const groups = new Map<string | null, FunnelGroup>();
    for (const row of rows) {
      const group = groups.get(row.key) ?? { key: row.key, label: row.key ?? 'unknown', total: 0, byStatus: {}, byConsent: {} };
      group.total += row.count;
      group.byStatus[row.status] = (group.byStatus[row.status] ?? 0) + row.count;
      group.byConsent[row.consent] = (group.byConsent[row.consent] ?? 0) + row.count;
      groups.set(row.key, group);
    }
    const labels = await this.labels(groupBy, rows);
    const items = [...groups.values()].map((group) => ({ ...group, label: (group.key && labels.get(group.key)) ?? group.label })).toSorted((left, right) => right.total - left.total);
    const totals = items.reduce((sum, group) => sum + group.total, 0);
    return { groupBy, from: from.toISOString(), to: to.toISOString(), total: totals, items };
  }

  async partnerPerformance(from: Date, to: Date) {
    const [rows, conversions] = await Promise.all([this.leads.partnerPerformance(from, to), this.leads.verifiedConversions(from, to)]);
    const organizations = new Map((await this.access.findOrganizations([...new Set([...rows.map((row) => row.organizationId), ...conversions.map((row) => row.organizationId)])])).map((organization) => [organization.id, organization.name]));
    const won = new Map(conversions.map((row) => [row.organizationId, { count: row._count.organizationId, disbursedPaise: row._sum.disbursedAmountPaise === null ? 0 : paiseToNumber(row._sum.disbursedAmountPaise) }]));
    const items = rows.map((row) => {
      const accepted = row.accepted;
      const decided = row.offers - row.open;
      const conversion = won.get(row.organizationId) ?? { count: 0, disbursedPaise: 0 };
      return {
        organization: { id: row.organizationId, name: organizations.get(row.organizationId) ?? null },
        offers: row.offers,
        accepted,
        declined: row.declined,
        expired: row.expired,
        returned: row.returned,
        revoked: row.revoked,
        open: row.open,
        acceptRate: ratio(accepted, decided),
        medianAcceptMinutes: minutes(row.medianAcceptSeconds),
        medianFirstContactMinutes: minutes(row.medianFirstContactSeconds),
        firstContactOnTimeRate: ratio(row.firstContactOnTime, row.firstContactOnTime + row.firstContactMissed),
        firstContactMissed: row.firstContactMissed,
        conversionsVerified: conversion.count,
        disbursedAmountPaise: conversion.disbursedPaise,
      };
    });
    return { from: from.toISOString(), to: to.toISOString(), items: items.toSorted((left, right) => right.offers - left.offers) };
  }

  private async labels(groupBy: FunnelColumn, rows: FunnelRow[]): Promise<Map<string, string>> {
    const keys = [...new Set(rows.flatMap((row) => (row.key ? [row.key] : [])))];
    if (groupBy === 'source') return new Map((await this.leads.listSources({ id: { in: keys } })).map((source) => [source.id, source.name]));
    if (groupBy === 'city') return new Map((await this.geo.findActiveCities(keys)).map((city) => [city.id, city.name]));
    if (groupBy === 'category') return new Map(await Promise.all(keys.map(async (key) => [key, await this.catalog.categoryLabel(key, DEFAULT_LOCALE)] as const)));
    return new Map(keys.map((key) => [key, key]));
  }
}
