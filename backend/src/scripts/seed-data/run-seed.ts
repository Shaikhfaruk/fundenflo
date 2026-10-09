import { AliasKind, NotificationChannel, OrganizationStatus, OrganizationType, PartyKind } from '../../common/enums/db.enums.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { FUNDENFLO_ORGANIZATION_NAME } from '../../modules/access/domain/access.constants.js';
import { normaliseLookupText } from '../../modules/catalog/domain/alias.js';
import type { NotificationTemplateKey } from '../../modules/notifications/domain/notification.constants.js';
import { CATEGORY_SEEDS, categoryAmounts, SEGMENT_CATEGORY_ORDER, SEGMENT_SEEDS } from './catalog.js';
import { CITY_ALIAS_SEEDS, CITY_SEEDS, STATE_SEEDS } from './geo.js';
import { DLT_TEMPLATE_ENV, NOTIFICATION_TEMPLATE_SEEDS, type TemplateSeed } from './notification-templates.js';

export type SeedResult = {
  organizationId: string;
  templates: number;
  segments: number;
  categories: number;
  states: number;
  cities: number;
  aliases: number;
};

function dltTemplateId(template: TemplateSeed, env: NodeJS.ProcessEnv): string | null {
  if (template.channel !== NotificationChannel.sms) return null;
  const variable = DLT_TEMPLATE_ENV[template.key as NotificationTemplateKey];
  return (variable && env[variable]?.trim()) || null;
}

async function seedOrganization(prisma: PrismaClient) {
  const existing = await prisma.organization.findFirst({ where: { type: OrganizationType.fundenflo } });
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    const party = await tx.party.create({ data: { kind: PartyKind.business, displayName: FUNDENFLO_ORGANIZATION_NAME } });
    return tx.organization.create({
      data: { partyId: party.id, type: OrganizationType.fundenflo, name: FUNDENFLO_ORGANIZATION_NAME, status: OrganizationStatus.active },
    });
  });
}

async function seedTemplates(prisma: PrismaClient, env: NodeJS.ProcessEnv) {
  for (const template of NOTIFICATION_TEMPLATE_SEEDS) {
    const providerTemplateId = dltTemplateId(template, env);
    await prisma.notificationTemplate.upsert({
      where: { key_channel_locale: { key: template.key, channel: template.channel, locale: template.locale } },
      create: { ...template, providerTemplateId },
      update: providerTemplateId ? { providerTemplateId } : {},
    });
  }
}

async function seedSegments(prisma: PrismaClient) {
  const ids = new Map<string, string>();
  for (const [index, seed] of SEGMENT_SEEDS.entries()) {
    const segment = await prisma.segment.upsert({
      where: { key: seed.key },
      create: { key: seed.key, label: { en: seed.label }, description: { en: seed.description }, icon: seed.icon, sortOrder: index },
      update: {},
    });
    ids.set(seed.key, segment.id);
    for (const [subIndex, sub] of seed.subSegments.entries()) {
      await prisma.subSegment.upsert({
        where: { key: sub.key },
        create: { key: sub.key, label: { en: sub.label }, sortOrder: subIndex, segmentId: segment.id },
        update: {},
      });
    }
  }
  return ids;
}

async function seedCategories(prisma: PrismaClient, segmentIds: Map<string, string>) {
  const ids = new Map<string, string>();
  for (const [index, seed] of CATEGORY_SEEDS.entries()) {
    const category = await prisma.loanCategory.upsert({
      where: { key: seed.key },
      create: {
        key: seed.key,
        label: { en: seed.label },
        icon: seed.icon,
        ...categoryAmounts(seed),
        illustrativeRateBps: seed.illustrativeRateBps,
        sortOrder: index,
        purposes: {
          create: seed.purposes.map((purpose, purposeIndex) => ({
            key: purpose.key,
            label: { en: purpose.label },
            requiresNote: purpose.requiresNote ?? false,
            sortOrder: purposeIndex,
          })),
        },
      },
      update: {},
    });
    ids.set(seed.key, category.id);
  }
  for (const [segmentKey, categoryKeys] of Object.entries(SEGMENT_CATEGORY_ORDER)) {
    const segmentId = segmentIds.get(segmentKey);
    if (!segmentId) continue;
    await prisma.categorySegment.createMany({
      data: categoryKeys.flatMap((key, sortOrder) => {
        const categoryId = ids.get(key);
        return categoryId ? [{ categoryId, segmentId, sortOrder }] : [];
      }),
      skipDuplicates: true,
    });
  }
  return ids;
}

async function seedGeo(prisma: PrismaClient) {
  const stateIds = new Map<string, string>();
  for (const seed of STATE_SEEDS) {
    const state = await prisma.geoState.upsert({ where: { gstCode: seed.gstCode }, create: seed, update: {} });
    stateIds.set(seed.name, state.id);
  }
  const cityIds = new Map<string, string>();
  for (const seed of CITY_SEEDS) {
    const stateId = stateIds.get(seed.state);
    if (!stateId) throw new Error(`Seed city ${seed.name} references unknown state ${seed.state}`);
    const city = await prisma.geoCity.upsert({ where: { stateId_name: { stateId, name: seed.name } }, create: { stateId, name: seed.name }, update: {} });
    cityIds.set(seed.name, city.id);
  }
  for (const seed of CITY_ALIAS_SEEDS) {
    const targetId = cityIds.get(seed.city);
    if (!targetId) throw new Error(`Seed alias ${seed.alias} references unknown city ${seed.city}`);
    const alias = normaliseLookupText(seed.alias);
    await prisma.lookupAlias.upsert({ where: { kind_alias: { kind: AliasKind.city, alias } }, create: { kind: AliasKind.city, alias, targetId }, update: {} });
  }
}

export async function runSeed(prisma: PrismaClient, env: NodeJS.ProcessEnv): Promise<SeedResult> {
  const organization = await seedOrganization(prisma);
  await seedTemplates(prisma, env);
  const segmentIds = await seedSegments(prisma);
  await seedCategories(prisma, segmentIds);
  await seedGeo(prisma);
  return {
    organizationId: organization.id,
    templates: NOTIFICATION_TEMPLATE_SEEDS.length,
    segments: SEGMENT_SEEDS.length,
    categories: CATEGORY_SEEDS.length,
    states: STATE_SEEDS.length,
    cities: CITY_SEEDS.length,
    aliases: CITY_ALIAS_SEEDS.length,
  };
}
